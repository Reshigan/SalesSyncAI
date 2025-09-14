/**
 * Advanced Security Middleware for SalesSync
 * Comprehensive security measures including rate limiting, input validation, and threat detection
 */

import { Request, Response, NextFunction } from 'express';
import rateLimit from 'express-rate-limit';
import helmet from 'helmet';
import { body, validationResult, ValidationChain } from 'express-validator';
import Redis from 'ioredis';
import crypto from 'crypto';
import { AuthenticatedRequest } from './auth';

export interface SecurityConfig {
  rateLimit: {
    windowMs: number;
    max: number;
    skipSuccessfulRequests: boolean;
  };
  bruteForce: {
    freeRetries: number;
    minWait: number;
    maxWait: number;
    lifetime: number;
  };
  ipWhitelist: string[];
  ipBlacklist: string[];
  suspiciousPatterns: RegExp[];
}

export interface SecurityEvent {
  id: string;
  type: 'rate_limit' | 'brute_force' | 'suspicious_activity' | 'blocked_ip' | 'validation_error';
  severity: 'low' | 'medium' | 'high' | 'critical';
  ip: string;
  userAgent?: string;
  userId?: string;
  companyId?: string;
  endpoint: string;
  method: string;
  details: any;
  timestamp: Date;
  blocked: boolean;
}

export interface ThreatIntelligence {
  ip: string;
  riskScore: number;
  country?: string;
  isp?: string;
  threatTypes: string[];
  lastSeen: Date;
  blocked: boolean;
}

class SecurityService {
  private redis: Redis;
  private config: SecurityConfig;
  private securityEvents: SecurityEvent[] = [];
  private threatIntelligence: Map<string, ThreatIntelligence> = new Map();

  constructor(config: SecurityConfig) {
    this.config = config;
    this.redis = new Redis({
      host: process.env.REDIS_HOST || 'localhost',
      port: parseInt(process.env.REDIS_PORT || '6379'),
      password: process.env.REDIS_PASSWORD,
      db: parseInt(process.env.REDIS_DB || '3'), // Use DB 3 for security
      retryDelayOnFailover: 100,
      maxRetriesPerRequest: 3,
      lazyConnect: true
    });

    this.redis.on('connect', () => {
      console.log('Security Redis connected');
    });

    this.redis.on('error', (error) => {
      console.error('Security Redis error:', error);
    });

    this.loadThreatIntelligence();
  }

  /**
   * Helmet security headers middleware
   */
  securityHeaders() {
    return helmet({
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
          fontSrc: ["'self'", "https://fonts.gstatic.com"],
          imgSrc: ["'self'", "data:", "https:"],
          scriptSrc: ["'self'"],
          connectSrc: ["'self'", "wss:", "ws:"],
          frameSrc: ["'none'"],
          objectSrc: ["'none'"],
          upgradeInsecureRequests: [],
        },
      },
      hsts: {
        maxAge: 31536000,
        includeSubDomains: true,
        preload: true
      },
      noSniff: true,
      frameguard: { action: 'deny' },
      xssFilter: true,
      referrerPolicy: { policy: 'strict-origin-when-cross-origin' }
    });
  }

  /**
   * Rate limiting middleware
   */
  rateLimitMiddleware() {
    return rateLimit({
      windowMs: this.config.rateLimit.windowMs,
      max: this.config.rateLimit.max,
      skipSuccessfulRequests: this.config.rateLimit.skipSuccessfulRequests,
      keyGenerator: (req: Request) => {
        // Use user ID if authenticated, otherwise IP
        const userId = (req as AuthenticatedRequest).user?.id;
        return userId || req.ip;
      },
      handler: (req: Request, res: Response) => {
        this.recordSecurityEvent({
          type: 'rate_limit',
          severity: 'medium',
          ip: req.ip,
          userAgent: req.get('User-Agent'),
          userId: (req as AuthenticatedRequest).user?.id,
          companyId: (req as AuthenticatedRequest).user?.companyId,
          endpoint: req.path,
          method: req.method,
          details: { limit: this.config.rateLimit.max, window: this.config.rateLimit.windowMs },
          blocked: true
        });

        res.status(429).json({
          success: false,
          error: 'Too many requests',
          retryAfter: Math.ceil(this.config.rateLimit.windowMs / 1000)
        });
      },
      standardHeaders: true,
      legacyHeaders: false
    });
  }

  /**
   * Brute force protection middleware
   */
  bruteForceProtection() {
    return async (req: Request, res: Response, next: NextFunction) => {
      try {
        const key = `brute_force:${req.ip}:${req.path}`;
        const attempts = await this.redis.get(key);
        const attemptCount = parseInt(attempts || '0');

        if (attemptCount > this.config.bruteForce.freeRetries) {
          const ttl = await this.redis.ttl(key);
          
          this.recordSecurityEvent({
            type: 'brute_force',
            severity: 'high',
            ip: req.ip,
            userAgent: req.get('User-Agent'),
            endpoint: req.path,
            method: req.method,
            details: { attempts: attemptCount, ttl },
            blocked: true
          });

          return res.status(429).json({
            success: false,
            error: 'Too many failed attempts',
            retryAfter: ttl
          });
        }

        // Continue to next middleware
        next();

      } catch (error) {
        console.error('Brute force protection error:', error);
        next();
      }
    };
  }

  /**
   * Record failed attempt for brute force protection
   */
  async recordFailedAttempt(req: Request): Promise<void> {
    try {
      const key = `brute_force:${req.ip}:${req.path}`;
      const attempts = await this.redis.incr(key);
      
      if (attempts === 1) {
        // Set expiration on first attempt
        await this.redis.expire(key, this.config.bruteForce.lifetime);
      }

      // Calculate exponential backoff
      const waitTime = Math.min(
        this.config.bruteForce.minWait * Math.pow(2, attempts - 1),
        this.config.bruteForce.maxWait
      );

      await this.redis.expire(key, waitTime);

    } catch (error) {
      console.error('Error recording failed attempt:', error);
    }
  }

  /**
   * IP filtering middleware
   */
  ipFilteringMiddleware() {
    return (req: Request, res: Response, next: NextFunction) => {
      const clientIp = req.ip;

      // Check blacklist
      if (this.config.ipBlacklist.includes(clientIp)) {
        this.recordSecurityEvent({
          type: 'blocked_ip',
          severity: 'high',
          ip: clientIp,
          userAgent: req.get('User-Agent'),
          endpoint: req.path,
          method: req.method,
          details: { reason: 'blacklisted' },
          blocked: true
        });

        return res.status(403).json({
          success: false,
          error: 'Access denied'
        });
      }

      // Check threat intelligence
      const threat = this.threatIntelligence.get(clientIp);
      if (threat && threat.blocked) {
        this.recordSecurityEvent({
          type: 'blocked_ip',
          severity: 'critical',
          ip: clientIp,
          userAgent: req.get('User-Agent'),
          endpoint: req.path,
          method: req.method,
          details: { reason: 'threat_intelligence', riskScore: threat.riskScore },
          blocked: true
        });

        return res.status(403).json({
          success: false,
          error: 'Access denied'
        });
      }

      next();
    };
  }

  /**
   * Suspicious activity detection middleware
   */
  suspiciousActivityMiddleware() {
    return (req: Request, res: Response, next: NextFunction) => {
      const userAgent = req.get('User-Agent') || '';
      const url = req.url;
      const body = JSON.stringify(req.body);

      // Check for suspicious patterns
      for (const pattern of this.config.suspiciousPatterns) {
        if (pattern.test(userAgent) || pattern.test(url) || pattern.test(body)) {
          this.recordSecurityEvent({
            type: 'suspicious_activity',
            severity: 'medium',
            ip: req.ip,
            userAgent,
            userId: (req as AuthenticatedRequest).user?.id,
            companyId: (req as AuthenticatedRequest).user?.companyId,
            endpoint: req.path,
            method: req.method,
            details: { pattern: pattern.source, matchedContent: url },
            blocked: false
          });

          // Don't block, just log for now
          break;
        }
      }

      next();
    };
  }

  /**
   * Input validation middleware factory
   */
  static validationMiddleware(validations: ValidationChain[]) {
    return [
      ...validations,
      (req: Request, res: Response, next: NextFunction) => {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
          // Record validation error
          securityService.recordSecurityEvent({
            type: 'validation_error',
            severity: 'low',
            ip: req.ip,
            userAgent: req.get('User-Agent'),
            userId: (req as AuthenticatedRequest).user?.id,
            companyId: (req as AuthenticatedRequest).user?.companyId,
            endpoint: req.path,
            method: req.method,
            details: { errors: errors.array() },
            blocked: true
          });

          return res.status(400).json({
            success: false,
            error: 'Validation failed',
            details: errors.array()
          });
        }
        next();
      }
    ];
  }

  /**
   * SQL injection protection
   */
  static sqlInjectionValidation() {
    return [
      body('*').custom((value) => {
        if (typeof value === 'string') {
          const sqlPatterns = [
            /(\b(SELECT|INSERT|UPDATE|DELETE|DROP|CREATE|ALTER|EXEC|UNION|SCRIPT)\b)/i,
            /(--|\/\*|\*\/|;|'|"|`)/,
            /(\bOR\b|\bAND\b).*?[=<>]/i
          ];
          
          for (const pattern of sqlPatterns) {
            if (pattern.test(value)) {
              throw new Error('Potentially malicious input detected');
            }
          }
        }
        return true;
      })
    ];
  }

  /**
   * XSS protection validation
   */
  static xssProtectionValidation() {
    return [
      body('*').custom((value) => {
        if (typeof value === 'string') {
          const xssPatterns = [
            /<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi,
            /<iframe\b[^<]*(?:(?!<\/iframe>)<[^<]*)*<\/iframe>/gi,
            /javascript:/gi,
            /on\w+\s*=/gi,
            /<img[^>]+src[^>]*>/gi
          ];
          
          for (const pattern of xssPatterns) {
            if (pattern.test(value)) {
              throw new Error('Potentially malicious script detected');
            }
          }
        }
        return true;
      })
    ];
  }

  /**
   * Record security event
   */
  private recordSecurityEvent(eventData: Omit<SecurityEvent, 'id' | 'timestamp'>): void {
    const event: SecurityEvent = {
      id: this.generateEventId(),
      timestamp: new Date(),
      ...eventData
    };

    // Store in memory
    this.securityEvents.push(event);
    if (this.securityEvents.length > 1000) {
      this.securityEvents.shift();
    }

    // Store in Redis
    this.redis.lpush('security:events', JSON.stringify(event))
      .then(() => this.redis.ltrim('security:events', 0, 4999)) // Keep last 5000 events
      .catch(error => console.error('Error storing security event:', error));

    // Log critical events
    if (event.severity === 'critical') {
      console.error('CRITICAL SECURITY EVENT:', event);
    }

    // Update threat intelligence
    this.updateThreatIntelligence(event);
  }

  /**
   * Update threat intelligence
   */
  private updateThreatIntelligence(event: SecurityEvent): void {
    const existing = this.threatIntelligence.get(event.ip) || {
      ip: event.ip,
      riskScore: 0,
      threatTypes: [],
      lastSeen: new Date(),
      blocked: false
    };

    // Increase risk score based on event type and severity
    const riskIncrease = this.calculateRiskIncrease(event);
    existing.riskScore = Math.min(100, existing.riskScore + riskIncrease);
    existing.lastSeen = event.timestamp;

    // Add threat type if not already present
    if (!existing.threatTypes.includes(event.type)) {
      existing.threatTypes.push(event.type);
    }

    // Auto-block if risk score is too high
    if (existing.riskScore >= 80) {
      existing.blocked = true;
    }

    this.threatIntelligence.set(event.ip, existing);

    // Persist to Redis
    this.redis.hset('threat:intelligence', event.ip, JSON.stringify(existing))
      .catch(error => console.error('Error updating threat intelligence:', error));
  }

  /**
   * Calculate risk increase based on event
   */
  private calculateRiskIncrease(event: SecurityEvent): number {
    const baseScores = {
      rate_limit: 5,
      brute_force: 15,
      suspicious_activity: 10,
      blocked_ip: 20,
      validation_error: 3
    };

    const severityMultipliers = {
      low: 1,
      medium: 2,
      high: 3,
      critical: 5
    };

    return baseScores[event.type] * severityMultipliers[event.severity];
  }

  /**
   * Load threat intelligence from Redis
   */
  private async loadThreatIntelligence(): Promise<void> {
    try {
      const threats = await this.redis.hgetall('threat:intelligence');
      for (const [ip, data] of Object.entries(threats)) {
        this.threatIntelligence.set(ip, JSON.parse(data));
      }
      console.log(`Loaded ${this.threatIntelligence.size} threat intelligence entries`);
    } catch (error) {
      console.error('Error loading threat intelligence:', error);
    }
  }

  /**
   * Get security events
   */
  getSecurityEvents(limit: number = 100): SecurityEvent[] {
    return this.securityEvents.slice(-limit);
  }

  /**
   * Get threat intelligence
   */
  getThreatIntelligence(): ThreatIntelligence[] {
    return Array.from(this.threatIntelligence.values());
  }

  /**
   * Block IP address
   */
  async blockIP(ip: string, reason: string): Promise<void> {
    try {
      // Add to blacklist
      if (!this.config.ipBlacklist.includes(ip)) {
        this.config.ipBlacklist.push(ip);
      }

      // Update threat intelligence
      const threat = this.threatIntelligence.get(ip) || {
        ip,
        riskScore: 100,
        threatTypes: ['manual_block'],
        lastSeen: new Date(),
        blocked: true
      };
      threat.blocked = true;
      threat.riskScore = 100;
      this.threatIntelligence.set(ip, threat);

      // Persist changes
      await this.redis.hset('threat:intelligence', ip, JSON.stringify(threat));
      await this.redis.sadd('security:blacklist', ip);

      console.log(`IP ${ip} blocked: ${reason}`);

    } catch (error) {
      console.error('Error blocking IP:', error);
    }
  }

  /**
   * Unblock IP address
   */
  async unblockIP(ip: string): Promise<void> {
    try {
      // Remove from blacklist
      const index = this.config.ipBlacklist.indexOf(ip);
      if (index > -1) {
        this.config.ipBlacklist.splice(index, 1);
      }

      // Update threat intelligence
      const threat = this.threatIntelligence.get(ip);
      if (threat) {
        threat.blocked = false;
        threat.riskScore = Math.max(0, threat.riskScore - 50);
        this.threatIntelligence.set(ip, threat);
        await this.redis.hset('threat:intelligence', ip, JSON.stringify(threat));
      }

      // Remove from Redis blacklist
      await this.redis.srem('security:blacklist', ip);

      console.log(`IP ${ip} unblocked`);

    } catch (error) {
      console.error('Error unblocking IP:', error);
    }
  }

  /**
   * Generate event ID
   */
  private generateEventId(): string {
    return `sec_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;
  }

  /**
   * Get security statistics
   */
  getSecurityStats(): any {
    const events = this.securityEvents;
    const now = Date.now();
    const oneHour = 60 * 60 * 1000;
    const oneDay = 24 * oneHour;

    const recentEvents = events.filter(e => now - e.timestamp.getTime() < oneHour);
    const todayEvents = events.filter(e => now - e.timestamp.getTime() < oneDay);

    const eventsByType = events.reduce((acc, event) => {
      acc[event.type] = (acc[event.type] || 0) + 1;
      return acc;
    }, {} as { [key: string]: number });

    const eventsBySeverity = events.reduce((acc, event) => {
      acc[event.severity] = (acc[event.severity] || 0) + 1;
      return acc;
    }, {} as { [key: string]: number });

    return {
      totalEvents: events.length,
      recentEvents: recentEvents.length,
      todayEvents: todayEvents.length,
      blockedIPs: this.config.ipBlacklist.length,
      threatIntelligenceEntries: this.threatIntelligence.size,
      eventsByType,
      eventsBySeverity,
      highRiskIPs: Array.from(this.threatIntelligence.values())
        .filter(t => t.riskScore >= 50)
        .length
    };
  }

  /**
   * Close security service
   */
  async close(): Promise<void> {
    await this.redis.quit();
  }
}

// Default security configuration
const defaultSecurityConfig: SecurityConfig = {
  rateLimit: {
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100, // Limit each IP to 100 requests per windowMs
    skipSuccessfulRequests: false
  },
  bruteForce: {
    freeRetries: 5,
    minWait: 5 * 60 * 1000, // 5 minutes
    maxWait: 60 * 60 * 1000, // 1 hour
    lifetime: 24 * 60 * 60 * 1000 // 24 hours
  },
  ipWhitelist: [],
  ipBlacklist: [],
  suspiciousPatterns: [
    /bot|crawler|spider|scraper/i,
    /sqlmap|nmap|nikto|burp|owasp/i,
    /\.\./,
    /<script|javascript:|vbscript:/i,
    /union.*select|insert.*into|delete.*from/i
  ]
};

// Create security service instance
const securityService = new SecurityService(defaultSecurityConfig);

// Export middleware functions
export const securityHeaders = securityService.securityHeaders.bind(securityService);
export const rateLimitMiddleware = securityService.rateLimitMiddleware.bind(securityService);
export const bruteForceProtection = securityService.bruteForceProtection.bind(securityService);
export const ipFilteringMiddleware = securityService.ipFilteringMiddleware.bind(securityService);
export const suspiciousActivityMiddleware = securityService.suspiciousActivityMiddleware.bind(securityService);
export const validationMiddleware = SecurityService.validationMiddleware;
export const sqlInjectionValidation = SecurityService.sqlInjectionValidation;
export const xssProtectionValidation = SecurityService.xssProtectionValidation;

// Export service functions
export async function recordFailedAttempt(req: Request): Promise<void> {
  return securityService.recordFailedAttempt(req);
}

export function getSecurityEvents(limit?: number): SecurityEvent[] {
  return securityService.getSecurityEvents(limit);
}

export function getThreatIntelligence(): ThreatIntelligence[] {
  return securityService.getThreatIntelligence();
}

export async function blockIP(ip: string, reason: string): Promise<void> {
  return securityService.blockIP(ip, reason);
}

export async function unblockIP(ip: string): Promise<void> {
  return securityService.unblockIP(ip);
}

export function getSecurityStats(): any {
  return securityService.getSecurityStats();
}

export default securityService;