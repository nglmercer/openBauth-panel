import { defaultLogger } from '../utils/logger';

export interface RateLimitConfig {
  windowMs: number;
  maxRequests: number;
}

export interface RateLimitEntry {
  key: string;
  count: number;
  resetTime: number;
}

export class RateLimitService {
  private config: RateLimitConfig;
  private store: Map<string, RateLimitEntry> = new Map();
  private cleanupInterval: NodeJS.Timeout | null = null;

  constructor(config: RateLimitConfig) {
    this.config = config;
    this.startCleanupInterval();
  }

  private startCleanupInterval() {
    // Clean up expired entries every 5 minutes
    this.cleanupInterval = setInterval(() => {
      this.cleanup();
    }, 5 * 60 * 1000);
  }

  private cleanup() {
    const now = Date.now();
    let cleaned = 0;
    
    for (const [key, entry] of this.store.entries()) {
      if (now > entry.resetTime) {
        this.store.delete(key);
        cleaned++;
      }
    }
    
    if (cleaned > 0) {
      defaultLogger.debug(`Cleaned up ${cleaned} expired rate limit entries`);
    }
  }

  async consume(key: string, pointsToConsume: number = 1): Promise<{
    allowed: boolean;
    remaining: number;
    resetTime: number;
    retryAfter?: number;
  }> {
    const now = Date.now();
    const entry = this.store.get(key);

    // Create new entry if doesn't exist or is expired
    if (!entry || now > entry.resetTime) {
      const newEntry: RateLimitEntry = {
        key,
        count: pointsToConsume,
        resetTime: now + this.config.windowMs
      };
      this.store.set(key, newEntry);

      defaultLogger.debug(`Rate limit: New entry created for ${key}`, {
        count: pointsToConsume,
        remaining: this.config.maxRequests - pointsToConsume,
        resetTime: newEntry.resetTime
      });

      return {
        allowed: true,
        remaining: Math.max(0, this.config.maxRequests - pointsToConsume),
        resetTime: newEntry.resetTime
      };
    }

    // Check if we can consume points
    if (entry.count + pointsToConsume > this.config.maxRequests) {
      const retryAfter = Math.ceil((entry.resetTime - now) / 1000);
      
      defaultLogger.warn(`Rate limit exceeded for ${key}`, {
        current: entry.count,
        requested: pointsToConsume,
        limit: this.config.maxRequests,
        retryAfter
      });

      return {
        allowed: false,
        remaining: 0,
        resetTime: entry.resetTime,
        retryAfter
      };
    }

    // Consume points
    entry.count += pointsToConsume;
    this.store.set(key, entry);

    defaultLogger.debug(`Rate limit: Consumed ${pointsToConsume} points for ${key}`, {
      total: entry.count,
      remaining: Math.max(0, this.config.maxRequests - entry.count)
    });

    return {
      allowed: true,
      remaining: Math.max(0, this.config.maxRequests - entry.count),
      resetTime: entry.resetTime
    };
  }

  async check(key: string): Promise<{
    allowed: boolean;
    remaining: number;
    resetTime: number;
  }> {
    const now = Date.now();
    const entry = this.store.get(key);

    if (!entry || now > entry.resetTime) {
      return {
        allowed: true,
        remaining: this.config.maxRequests,
        resetTime: now + this.config.windowMs
      };
    }

    return {
      allowed: entry.count < this.config.maxRequests,
      remaining: Math.max(0, this.config.maxRequests - entry.count),
      resetTime: entry.resetTime
    };
  }

  async reset(key: string): Promise<void> {
    this.store.delete(key);
    defaultLogger.info(`Rate limit reset for ${key}`);
  }

  getStats(): {
    totalEntries: number;
    windowSize: number;
    maxRequests: number;
  } {
    return {
      totalEntries: this.store.size,
      windowSize: this.config.windowMs,
      maxRequests: this.config.maxRequests
    };
  }

  destroy() {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }
    this.store.clear();
  }
}

// Middleware factory for Hono integration
export function createRateLimitMiddleware(rateLimitService: RateLimitService, options: {
  keyGenerator?: (c: any) => string;
  skipSuccessfulRequests?: boolean;
  skipFailedRequests?: boolean;
} = {}) {
  const { keyGenerator, skipSuccessfulRequests, skipFailedRequests } = options;

  return async (c: any, next: any) => {
    const key = keyGenerator ? keyGenerator(c) : c.req.header('x-forwarded-for') || c.req.header('x-real-ip') || 'unknown';
    
    const result = await rateLimitService.consume(key);
    
    // Set rate limit headers
    c.header('X-RateLimit-Limit', String(rateLimitService.getStats().maxRequests));
    c.header('X-RateLimit-Remaining', String(result.remaining));
    c.header('X-RateLimit-Reset', String(result.resetTime));
    
    if (!result.allowed) {
      c.header('Retry-After', String(result.retryAfter || 60));
      return c.json({
        error: 'Too many requests',
        message: 'Rate limit exceeded',
        retryAfter: result.retryAfter
      }, 429);
    }

    try {
      await next();
      
      // Skip logging successful requests if configured
      if (skipSuccessfulRequests && c.res.status < 400) {
        return;
      }
      
      // Skip logging failed requests if configured
      if (skipFailedRequests && c.res.status >= 400) {
        return;
      }
      
    } catch (error) {
      // Re-check rate limit after error if needed
      if (!skipFailedRequests) {
        throw error;
      }
    }
  };
}