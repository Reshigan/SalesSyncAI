/**
 * Advanced Monitoring and Performance Tracking Middleware for SalesSync
 * Comprehensive application monitoring, error tracking, and performance metrics
 */

import { Request, Response, NextFunction } from 'express';
import { performance } from 'perf_hooks';
import { AuthenticatedRequest } from './auth';
import Redis from 'ioredis';

export interface PerformanceMetrics {
  requestId: string;
  method: string;
  url: string;
  statusCode: number;
  responseTime: number;
  memoryUsage: NodeJS.MemoryUsage;
  cpuUsage: NodeJS.CpuUsage;
  timestamp: Date;
  userAgent?: string;
  userId?: string;
  companyId?: string;
  errorMessage?: string;
  stackTrace?: string;
}

export interface SystemHealth {
  status: 'healthy' | 'warning' | 'critical';
  uptime: number;
  memory: {
    used: number;
    total: number;
    percentage: number;
  };
  cpu: {
    usage: number;
    loadAverage: number[];
  };
  database: {
    status: 'connected' | 'disconnected' | 'error';
    responseTime: number;
    activeConnections: number;
  };
  redis: {
    status: 'connected' | 'disconnected' | 'error';
    memory: string;
    hitRate: number;
  };
  api: {
    requestsPerMinute: number;
    averageResponseTime: number;
    errorRate: number;
  };
  alerts: SystemAlert[];
}

export interface SystemAlert {
  id: string;
  type: 'performance' | 'error' | 'security' | 'resource';
  severity: 'low' | 'medium' | 'high' | 'critical';
  message: string;
  timestamp: Date;
  resolved: boolean;
  metadata?: any;
}

class MonitoringService {
  private redis: Redis;
  private metrics: PerformanceMetrics[] = [];
  private alerts: SystemAlert[] = [];
  private startTime: number = Date.now();
  private requestCount: number = 0;
  private errorCount: number = 0;
  private responseTimes: number[] = [];

  // Performance thresholds
  private readonly THRESHOLDS = {
    RESPONSE_TIME_WARNING: 1000, // 1 second
    RESPONSE_TIME_CRITICAL: 5000, // 5 seconds
    MEMORY_WARNING: 80, // 80% of available memory
    MEMORY_CRITICAL: 95, // 95% of available memory
    ERROR_RATE_WARNING: 5, // 5% error rate
    ERROR_RATE_CRITICAL: 10, // 10% error rate
    CPU_WARNING: 80, // 80% CPU usage
    CPU_CRITICAL: 95 // 95% CPU usage
  };

  constructor() {
    this.redis = new Redis({
      host: process.env.REDIS_HOST || 'localhost',
      port: parseInt(process.env.REDIS_PORT || '6379'),
      password: process.env.REDIS_PASSWORD,
      db: parseInt(process.env.REDIS_DB || '2'), // Use DB 2 for monitoring
      retryDelayOnFailover: 100,
      maxRetriesPerRequest: 3,
      lazyConnect: true
    });

    this.redis.on('connect', () => {
      console.log('Monitoring Redis connected');
    });

    this.redis.on('error', (error) => {
      console.error('Monitoring Redis error:', error);
    });

    // Start periodic health checks
    this.startHealthChecks();
  }

  /**
   * Performance monitoring middleware
   */
  performanceMiddleware() {
    return (req: Request, res: Response, next: NextFunction) => {
      const startTime = performance.now();
      const startCpuUsage = process.cpuUsage();
      const requestId = this.generateRequestId();

      // Add request ID to request object
      (req as any).requestId = requestId;

      // Override res.end to capture metrics
      const originalEnd = res.end.bind(res);
      res.end = (...args: any[]) => {
        const endTime = performance.now();
        const responseTime = endTime - startTime;
        const endCpuUsage = process.cpuUsage(startCpuUsage);

        // Collect metrics
        const metrics: PerformanceMetrics = {
          requestId,
          method: req.method,
          url: req.url,
          statusCode: res.statusCode,
          responseTime,
          memoryUsage: process.memoryUsage(),
          cpuUsage: endCpuUsage,
          timestamp: new Date(),
          userAgent: req.get('User-Agent'),
          userId: (req as AuthenticatedRequest).user?.id,
          companyId: (req as AuthenticatedRequest).user?.companyId
        };

        // Store metrics
        this.recordMetrics(metrics);

        // Check for performance issues
        this.checkPerformanceThresholds(metrics);

        return originalEnd(...args);
      };

      next();
    };
  }

  /**
   * Error tracking middleware
   */
  errorTrackingMiddleware() {
    return (error: Error, req: Request, res: Response, next: NextFunction) => {
      const requestId = (req as any).requestId || this.generateRequestId();

      // Record error metrics
      const errorMetrics: PerformanceMetrics = {
        requestId,
        method: req.method,
        url: req.url,
        statusCode: res.statusCode || 500,
        responseTime: 0,
        memoryUsage: process.memoryUsage(),
        cpuUsage: process.cpuUsage(),
        timestamp: new Date(),
        userAgent: req.get('User-Agent'),
        userId: (req as AuthenticatedRequest).user?.id,
        companyId: (req as AuthenticatedRequest).user?.companyId,
        errorMessage: error.message,
        stackTrace: error.stack
      };

      this.recordMetrics(errorMetrics);
      this.recordError(error, req);

      next(error);
    };
  }

  /**
   * Record performance metrics
   */
  private async recordMetrics(metrics: PerformanceMetrics): Promise<void> {
    try {
      // Store in memory (keep last 1000 requests)
      this.metrics.push(metrics);
      if (this.metrics.length > 1000) {
        this.metrics.shift();
      }

      // Store in Redis for persistence
      await this.redis.lpush('metrics:requests', JSON.stringify(metrics));
      await this.redis.ltrim('metrics:requests', 0, 9999); // Keep last 10,000 requests

      // Update counters
      this.requestCount++;
      if (metrics.statusCode >= 400) {
        this.errorCount++;
      }
      this.responseTimes.push(metrics.responseTime);
      if (this.responseTimes.length > 100) {
        this.responseTimes.shift();
      }

      // Store aggregated metrics
      await this.updateAggregatedMetrics(metrics);

    } catch (error) {
      console.error('Error recording metrics:', error);
    }
  }

  /**
   * Record error details
   */
  private async recordError(error: Error, req: Request): Promise<void> {
    try {
      const errorRecord = {
        message: error.message,
        stack: error.stack,
        url: req.url,
        method: req.method,
        timestamp: new Date(),
        userId: (req as AuthenticatedRequest).user?.id,
        companyId: (req as AuthenticatedRequest).user?.companyId,
        userAgent: req.get('User-Agent'),
        ip: req.ip
      };

      await this.redis.lpush('errors:log', JSON.stringify(errorRecord));
      await this.redis.ltrim('errors:log', 0, 4999); // Keep last 5,000 errors

      // Create alert for critical errors
      if (error.message.includes('CRITICAL') || error.message.includes('FATAL')) {
        await this.createAlert({
          type: 'error',
          severity: 'critical',
          message: `Critical error: ${error.message}`,
          metadata: { url: req.url, method: req.method }
        });
      }

    } catch (redisError) {
      console.error('Error recording error:', redisError);
    }
  }

  /**
   * Update aggregated metrics
   */
  private async updateAggregatedMetrics(metrics: PerformanceMetrics): Promise<void> {
    try {
      const minute = Math.floor(Date.now() / 60000);
      const key = `metrics:minute:${minute}`;

      await this.redis.hincrby(key, 'requests', 1);
      await this.redis.hincrby(key, 'errors', metrics.statusCode >= 400 ? 1 : 0);
      await this.redis.hincrby(key, 'response_time', Math.round(metrics.responseTime));
      await this.redis.expire(key, 3600); // Expire after 1 hour

    } catch (error) {
      console.error('Error updating aggregated metrics:', error);
    }
  }

  /**
   * Check performance thresholds
   */
  private async checkPerformanceThresholds(metrics: PerformanceMetrics): Promise<void> {
    // Check response time
    if (metrics.responseTime > this.THRESHOLDS.RESPONSE_TIME_CRITICAL) {
      await this.createAlert({
        type: 'performance',
        severity: 'critical',
        message: `Critical response time: ${metrics.responseTime.toFixed(2)}ms for ${metrics.method} ${metrics.url}`,
        metadata: { requestId: metrics.requestId, responseTime: metrics.responseTime }
      });
    } else if (metrics.responseTime > this.THRESHOLDS.RESPONSE_TIME_WARNING) {
      await this.createAlert({
        type: 'performance',
        severity: 'medium',
        message: `Slow response time: ${metrics.responseTime.toFixed(2)}ms for ${metrics.method} ${metrics.url}`,
        metadata: { requestId: metrics.requestId, responseTime: metrics.responseTime }
      });
    }

    // Check memory usage
    const memoryUsagePercent = (metrics.memoryUsage.heapUsed / metrics.memoryUsage.heapTotal) * 100;
    if (memoryUsagePercent > this.THRESHOLDS.MEMORY_CRITICAL) {
      await this.createAlert({
        type: 'resource',
        severity: 'critical',
        message: `Critical memory usage: ${memoryUsagePercent.toFixed(1)}%`,
        metadata: { memoryUsage: metrics.memoryUsage }
      });
    } else if (memoryUsagePercent > this.THRESHOLDS.MEMORY_WARNING) {
      await this.createAlert({
        type: 'resource',
        severity: 'medium',
        message: `High memory usage: ${memoryUsagePercent.toFixed(1)}%`,
        metadata: { memoryUsage: metrics.memoryUsage }
      });
    }
  }

  /**
   * Create system alert
   */
  private async createAlert(alertData: Omit<SystemAlert, 'id' | 'timestamp' | 'resolved'>): Promise<void> {
    try {
      const alert: SystemAlert = {
        id: this.generateRequestId(),
        timestamp: new Date(),
        resolved: false,
        ...alertData
      };

      this.alerts.push(alert);
      if (this.alerts.length > 100) {
        this.alerts.shift();
      }

      await this.redis.lpush('alerts:system', JSON.stringify(alert));
      await this.redis.ltrim('alerts:system', 0, 499); // Keep last 500 alerts

      // Log critical alerts
      if (alert.severity === 'critical') {
        console.error('CRITICAL ALERT:', alert.message, alert.metadata);
      }

    } catch (error) {
      console.error('Error creating alert:', error);
    }
  }

  /**
   * Get system health status
   */
  async getSystemHealth(): Promise<SystemHealth> {
    try {
      const memoryUsage = process.memoryUsage();
      const cpuUsage = process.cpuUsage();
      const loadAverage = process.loadavg();

      // Calculate error rate
      const errorRate = this.requestCount > 0 ? (this.errorCount / this.requestCount) * 100 : 0;

      // Calculate average response time
      const avgResponseTime = this.responseTimes.length > 0 
        ? this.responseTimes.reduce((sum, time) => sum + time, 0) / this.responseTimes.length 
        : 0;

      // Determine overall status
      let status: 'healthy' | 'warning' | 'critical' = 'healthy';
      
      if (errorRate > this.THRESHOLDS.ERROR_RATE_CRITICAL || 
          avgResponseTime > this.THRESHOLDS.RESPONSE_TIME_CRITICAL ||
          (memoryUsage.heapUsed / memoryUsage.heapTotal) * 100 > this.THRESHOLDS.MEMORY_CRITICAL) {
        status = 'critical';
      } else if (errorRate > this.THRESHOLDS.ERROR_RATE_WARNING || 
                 avgResponseTime > this.THRESHOLDS.RESPONSE_TIME_WARNING ||
                 (memoryUsage.heapUsed / memoryUsage.heapTotal) * 100 > this.THRESHOLDS.MEMORY_WARNING) {
        status = 'warning';
      }

      return {
        status,
        uptime: Date.now() - this.startTime,
        memory: {
          used: memoryUsage.heapUsed,
          total: memoryUsage.heapTotal,
          percentage: (memoryUsage.heapUsed / memoryUsage.heapTotal) * 100
        },
        cpu: {
          usage: (cpuUsage.user + cpuUsage.system) / 1000000, // Convert to seconds
          loadAverage
        },
        database: await this.checkDatabaseHealth(),
        redis: await this.checkRedisHealth(),
        api: {
          requestsPerMinute: await this.getRequestsPerMinute(),
          averageResponseTime: avgResponseTime,
          errorRate
        },
        alerts: this.alerts.filter(alert => !alert.resolved).slice(0, 10)
      };

    } catch (error) {
      console.error('Error getting system health:', error);
      return {
        status: 'critical',
        uptime: Date.now() - this.startTime,
        memory: { used: 0, total: 0, percentage: 0 },
        cpu: { usage: 0, loadAverage: [0, 0, 0] },
        database: { status: 'error', responseTime: 0, activeConnections: 0 },
        redis: { status: 'error', memory: '0MB', hitRate: 0 },
        api: { requestsPerMinute: 0, averageResponseTime: 0, errorRate: 100 },
        alerts: []
      };
    }
  }

  /**
   * Check database health
   */
  private async checkDatabaseHealth(): Promise<any> {
    try {
      const startTime = performance.now();
      // In production, would check actual database connection
      const responseTime = performance.now() - startTime;
      
      return {
        status: 'connected',
        responseTime,
        activeConnections: 10 // Mock value
      };
    } catch (error) {
      return {
        status: 'error',
        responseTime: 0,
        activeConnections: 0
      };
    }
  }

  /**
   * Check Redis health
   */
  private async checkRedisHealth(): Promise<any> {
    try {
      const info = await this.redis.info('memory');
      const memoryMatch = info.match(/used_memory_human:(.+)/);
      const memory = memoryMatch ? memoryMatch[1].trim() : '0MB';

      return {
        status: 'connected',
        memory,
        hitRate: 85.5 // Mock value
      };
    } catch (error) {
      return {
        status: 'error',
        memory: '0MB',
        hitRate: 0
      };
    }
  }

  /**
   * Get requests per minute
   */
  private async getRequestsPerMinute(): Promise<number> {
    try {
      const currentMinute = Math.floor(Date.now() / 60000);
      const key = `metrics:minute:${currentMinute}`;
      const requests = await this.redis.hget(key, 'requests');
      return parseInt(requests || '0');
    } catch (error) {
      return 0;
    }
  }

  /**
   * Get performance metrics
   */
  getMetrics(limit: number = 100): PerformanceMetrics[] {
    return this.metrics.slice(-limit);
  }

  /**
   * Get error logs
   */
  async getErrorLogs(limit: number = 50): Promise<any[]> {
    try {
      const errors = await this.redis.lrange('errors:log', 0, limit - 1);
      return errors.map(error => JSON.parse(error));
    } catch (error) {
      console.error('Error getting error logs:', error);
      return [];
    }
  }

  /**
   * Get alerts
   */
  getAlerts(resolved: boolean = false): SystemAlert[] {
    return this.alerts.filter(alert => alert.resolved === resolved);
  }

  /**
   * Resolve alert
   */
  async resolveAlert(alertId: string): Promise<boolean> {
    try {
      const alert = this.alerts.find(a => a.id === alertId);
      if (alert) {
        alert.resolved = true;
        return true;
      }
      return false;
    } catch (error) {
      console.error('Error resolving alert:', error);
      return false;
    }
  }

  /**
   * Start periodic health checks
   */
  private startHealthChecks(): void {
    // Check system health every minute
    setInterval(async () => {
      try {
        const health = await this.getSystemHealth();
        
        // Create alerts based on health status
        if (health.status === 'critical') {
          await this.createAlert({
            type: 'performance',
            severity: 'critical',
            message: 'System health is critical',
            metadata: { health }
          });
        }

        // Log health status
        console.log(`System Health: ${health.status} | Memory: ${health.memory.percentage.toFixed(1)}% | Error Rate: ${health.api.errorRate.toFixed(2)}%`);

      } catch (error) {
        console.error('Health check error:', error);
      }
    }, 60000); // Every minute

    // Clean up old metrics every hour
    setInterval(() => {
      this.cleanupOldData();
    }, 3600000); // Every hour
  }

  /**
   * Clean up old data
   */
  private cleanupOldData(): void {
    // Keep only last 1000 metrics in memory
    if (this.metrics.length > 1000) {
      this.metrics = this.metrics.slice(-1000);
    }

    // Keep only last 100 alerts in memory
    if (this.alerts.length > 100) {
      this.alerts = this.alerts.slice(-100);
    }

    // Reset counters periodically
    if (this.requestCount > 10000) {
      this.requestCount = Math.floor(this.requestCount * 0.9);
      this.errorCount = Math.floor(this.errorCount * 0.9);
    }
  }

  /**
   * Generate unique request ID
   */
  private generateRequestId(): string {
    return `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Close monitoring service
   */
  async close(): Promise<void> {
    await this.redis.quit();
  }
}

// Create monitoring service instance
const monitoringService = new MonitoringService();

// Export middleware functions
export const performanceMiddleware = monitoringService.performanceMiddleware.bind(monitoringService);
export const errorTrackingMiddleware = monitoringService.errorTrackingMiddleware.bind(monitoringService);

// Export service functions
export async function getSystemHealth(): Promise<SystemHealth> {
  return monitoringService.getSystemHealth();
}

export function getMetrics(limit?: number): PerformanceMetrics[] {
  return monitoringService.getMetrics(limit);
}

export async function getErrorLogs(limit?: number): Promise<any[]> {
  return monitoringService.getErrorLogs(limit);
}

export function getAlerts(resolved?: boolean): SystemAlert[] {
  return monitoringService.getAlerts(resolved);
}

export async function resolveAlert(alertId: string): Promise<boolean> {
  return monitoringService.resolveAlert(alertId);
}

export default monitoringService;