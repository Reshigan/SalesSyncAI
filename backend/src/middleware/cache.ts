/**
 * Advanced Caching Middleware for SalesSync
 * Redis-based caching with intelligent invalidation
 */

import { Request, Response, NextFunction } from 'express';
import Redis from 'ioredis';
import crypto from 'crypto';
import { AuthenticatedRequest } from './auth';

export interface CacheOptions {
  ttl?: number; // Time to live in seconds
  keyPrefix?: string;
  skipCache?: boolean;
  varyBy?: string[]; // Additional parameters to vary cache by
  tags?: string[]; // Cache tags for group invalidation
  compress?: boolean;
  serialize?: (data: any) => string;
  deserialize?: (data: string) => any;
}

export interface CacheStats {
  hits: number;
  misses: number;
  sets: number;
  deletes: number;
  hitRate: number;
}

class CacheManager {
  private redis: Redis;
  private stats: CacheStats = {
    hits: 0,
    misses: 0,
    sets: 0,
    deletes: 0,
    hitRate: 0
  };

  constructor() {
    this.redis = new Redis({
      host: process.env.REDIS_HOST || 'localhost',
      port: parseInt(process.env.REDIS_PORT || '6379'),
      password: process.env.REDIS_PASSWORD,
      db: parseInt(process.env.REDIS_DB || '1'), // Use DB 1 for cache
      retryDelayOnFailover: 100,
      maxRetriesPerRequest: 3,
      lazyConnect: true
    });

    this.redis.on('connect', () => {
      console.log('Cache Redis connected');
    });

    this.redis.on('error', (error) => {
      console.error('Cache Redis error:', error);
    });
  }

  /**
   * Generate cache key
   */
  generateKey(req: Request, options: CacheOptions = {}): string {
    const baseKey = `${options.keyPrefix || 'api'}:${req.method}:${req.path}`;
    
    // Include query parameters
    const queryString = new URLSearchParams(req.query as any).toString();
    
    // Include user context for authenticated requests
    const userContext = (req as AuthenticatedRequest).user?.id || 'anonymous';
    
    // Include company context for multi-tenant caching
    const companyContext = (req as AuthenticatedRequest).user?.companyId || 'global';
    
    // Include additional vary parameters
    const varyParams = options.varyBy?.map(param => req.query[param] || req.body?.[param] || '').join(':') || '';
    
    // Create hash of all components
    const keyComponents = [baseKey, queryString, userContext, companyContext, varyParams].filter(Boolean);
    const keyString = keyComponents.join(':');
    
    return crypto.createHash('md5').update(keyString).digest('hex');
  }

  /**
   * Get cached data
   */
  async get(key: string, options: CacheOptions = {}): Promise<any> {
    try {
      const cached = await this.redis.get(key);
      
      if (cached) {
        this.stats.hits++;
        this.updateHitRate();
        
        const deserialize = options.deserialize || JSON.parse;
        return deserialize(cached);
      } else {
        this.stats.misses++;
        this.updateHitRate();
        return null;
      }
    } catch (error) {
      console.error('Cache get error:', error);
      this.stats.misses++;
      this.updateHitRate();
      return null;
    }
  }

  /**
   * Set cached data
   */
  async set(key: string, data: any, options: CacheOptions = {}): Promise<boolean> {
    try {
      const serialize = options.serialize || JSON.stringify;
      const serializedData = serialize(data);
      
      const ttl = options.ttl || 300; // Default 5 minutes
      
      await this.redis.setex(key, ttl, serializedData);
      
      // Add to tag sets for group invalidation
      if (options.tags && options.tags.length > 0) {
        const pipeline = this.redis.pipeline();
        options.tags.forEach(tag => {
          pipeline.sadd(`tag:${tag}`, key);
          pipeline.expire(`tag:${tag}`, ttl + 60); // Tag expires slightly later
        });
        await pipeline.exec();
      }
      
      this.stats.sets++;
      return true;
    } catch (error) {
      console.error('Cache set error:', error);
      return false;
    }
  }

  /**
   * Delete cached data
   */
  async delete(key: string): Promise<boolean> {
    try {
      const result = await this.redis.del(key);
      if (result > 0) {
        this.stats.deletes++;
      }
      return result > 0;
    } catch (error) {
      console.error('Cache delete error:', error);
      return false;
    }
  }

  /**
   * Clear cache by tags
   */
  async clearByTags(tags: string[]): Promise<number> {
    try {
      let totalDeleted = 0;
      
      for (const tag of tags) {
        const keys = await this.redis.smembers(`tag:${tag}`);
        if (keys.length > 0) {
          const deleted = await this.redis.del(...keys);
          totalDeleted += deleted;
          
          // Remove the tag set
          await this.redis.del(`tag:${tag}`);
        }
      }
      
      this.stats.deletes += totalDeleted;
      return totalDeleted;
    } catch (error) {
      console.error('Cache clear by tags error:', error);
      return 0;
    }
  }

  /**
   * Clear cache by pattern
   */
  async clearByPattern(pattern: string): Promise<number> {
    try {
      const keys = await this.redis.keys(pattern);
      if (keys.length > 0) {
        const deleted = await this.redis.del(...keys);
        this.stats.deletes += deleted;
        return deleted;
      }
      return 0;
    } catch (error) {
      console.error('Cache clear by pattern error:', error);
      return 0;
    }
  }

  /**
   * Flush all cache
   */
  async flush(): Promise<boolean> {
    try {
      await this.redis.flushdb();
      return true;
    } catch (error) {
      console.error('Cache flush error:', error);
      return false;
    }
  }

  /**
   * Get cache statistics
   */
  getStats(): CacheStats {
    return { ...this.stats };
  }

  /**
   * Update hit rate
   */
  private updateHitRate(): void {
    const total = this.stats.hits + this.stats.misses;
    this.stats.hitRate = total > 0 ? (this.stats.hits / total) * 100 : 0;
  }

  /**
   * Get cache info
   */
  async getInfo(): Promise<any> {
    try {
      const info = await this.redis.info('memory');
      const keyCount = await this.redis.dbsize();
      
      return {
        stats: this.getStats(),
        keyCount,
        memoryInfo: this.parseRedisInfo(info)
      };
    } catch (error) {
      console.error('Cache info error:', error);
      return {
        stats: this.getStats(),
        keyCount: 0,
        memoryInfo: {}
      };
    }
  }

  /**
   * Parse Redis info string
   */
  private parseRedisInfo(info: string): any {
    const result: any = {};
    const lines = info.split('\r\n');
    
    for (const line of lines) {
      if (line.includes(':')) {
        const [key, value] = line.split(':');
        result[key] = isNaN(Number(value)) ? value : Number(value);
      }
    }
    
    return result;
  }

  /**
   * Close Redis connection
   */
  async close(): Promise<void> {
    await this.redis.quit();
  }
}

// Create cache manager instance
const cacheManager = new CacheManager();

/**
 * Cache middleware factory
 */
export function cacheMiddleware(ttlOrOptions?: number | CacheOptions) {
  return async (req: Request, res: Response, next: NextFunction) => {
    // Determine options
    let options: CacheOptions;
    if (typeof ttlOrOptions === 'number') {
      options = { ttl: ttlOrOptions };
    } else {
      options = ttlOrOptions || {};
    }

    // Skip cache for non-GET requests by default
    if (req.method !== 'GET' && !options.skipCache) {
      return next();
    }

    // Skip cache if explicitly requested
    if (options.skipCache || req.headers['cache-control'] === 'no-cache') {
      return next();
    }

    // Generate cache key
    const cacheKey = cacheManager.generateKey(req, options);

    try {
      // Try to get cached response
      const cached = await cacheManager.get(cacheKey, options);
      
      if (cached) {
        // Set cache headers
        res.set({
          'X-Cache': 'HIT',
          'X-Cache-Key': cacheKey,
          'Cache-Control': `max-age=${options.ttl || 300}`
        });
        
        return res.json(cached);
      }

      // Cache miss - continue to route handler
      res.set('X-Cache', 'MISS');

      // Override res.json to cache the response
      const originalJson = res.json.bind(res);
      res.json = function(data: any) {
        // Only cache successful responses
        if (res.statusCode >= 200 && res.statusCode < 300) {
          // Cache the response asynchronously
          setImmediate(() => {
            cacheManager.set(cacheKey, data, options);
          });
        }
        
        return originalJson(data);
      };

      next();

    } catch (error) {
      console.error('Cache middleware error:', error);
      next();
    }
  };
}

/**
 * Cache invalidation middleware
 */
export function invalidateCache(tagsOrPattern: string[] | string) {
  return async (req: Request, res: Response, next: NextFunction) => {
    // Store invalidation info for after response
    (res as any).cacheInvalidation = tagsOrPattern;
    
    // Override res.end to invalidate cache after response
    const originalEnd = res.end.bind(res);
    res.end = function(...args: any[]) {
      // Only invalidate on successful operations
      if (res.statusCode >= 200 && res.statusCode < 300) {
        setImmediate(async () => {
          try {
            if (Array.isArray(tagsOrPattern)) {
              await cacheManager.clearByTags(tagsOrPattern);
            } else {
              await cacheManager.clearByPattern(tagsOrPattern);
            }
          } catch (error) {
            console.error('Cache invalidation error:', error);
          }
        });
      }
      
      return originalEnd(...args);
    };

    next();
  };
}

/**
 * Clear cache by tags
 */
export async function clearCache(tags: string[]): Promise<number> {
  return cacheManager.clearByTags(tags);
}

/**
 * Clear cache by pattern
 */
export async function clearCachePattern(pattern: string): Promise<number> {
  return cacheManager.clearByPattern(pattern);
}

/**
 * Get cache statistics
 */
export function getCacheStats(): CacheStats {
  return cacheManager.getStats();
}

/**
 * Get cache info
 */
export async function getCacheInfo(): Promise<any> {
  return cacheManager.getInfo();
}

/**
 * Flush all cache
 */
export async function flushCache(): Promise<boolean> {
  return cacheManager.flush();
}

/**
 * Smart cache tags for different data types
 */
export const CacheTags = {
  // Sales related
  SALES: 'sales',
  SALES_AGENT: (agentId: string) => `sales:agent:${agentId}`,
  SALES_CUSTOMER: (customerId: string) => `sales:customer:${customerId}`,
  SALES_PRODUCT: (productId: string) => `sales:product:${productId}`,
  SALES_TERRITORY: (territory: string) => `sales:territory:${territory}`,
  
  // Visit related
  VISITS: 'visits',
  VISITS_AGENT: (agentId: string) => `visits:agent:${agentId}`,
  VISITS_CUSTOMER: (customerId: string) => `visits:customer:${customerId}`,
  
  // Performance related
  PERFORMANCE: 'performance',
  PERFORMANCE_AGENT: (agentId: string) => `performance:agent:${agentId}`,
  PERFORMANCE_TERRITORY: (territory: string) => `performance:territory:${territory}`,
  
  // Campaign related
  CAMPAIGNS: 'campaigns',
  CAMPAIGN: (campaignId: string) => `campaign:${campaignId}`,
  
  // Analytics related
  ANALYTICS: 'analytics',
  ANALYTICS_DASHBOARD: 'analytics:dashboard',
  ANALYTICS_REPORTS: 'analytics:reports',
  
  // Company related
  COMPANY: (companyId: string) => `company:${companyId}`,
  COMPANY_USERS: (companyId: string) => `company:${companyId}:users`,
  COMPANY_SETTINGS: (companyId: string) => `company:${companyId}:settings`
};

/**
 * Cache warming functions
 */
export class CacheWarmer {
  /**
   * Warm dashboard cache
   */
  static async warmDashboardCache(companyId: string): Promise<void> {
    // Implementation would pre-populate common dashboard queries
    console.log(`Warming dashboard cache for company: ${companyId}`);
  }

  /**
   * Warm analytics cache
   */
  static async warmAnalyticsCache(companyId: string): Promise<void> {
    // Implementation would pre-populate common analytics queries
    console.log(`Warming analytics cache for company: ${companyId}`);
  }

  /**
   * Warm performance cache
   */
  static async warmPerformanceCache(companyId: string): Promise<void> {
    // Implementation would pre-populate performance metrics
    console.log(`Warming performance cache for company: ${companyId}`);
  }
}

export default cacheManager;