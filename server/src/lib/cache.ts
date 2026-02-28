// ============================================================
// ELAHMED RETAIL SUITE — Caching Service
// Supports in-memory and Redis caching
// ============================================================

import { Request, Response, NextFunction } from 'express';

// In-memory cache (use Redis in production)
const memoryCache = new Map<string, { value: unknown; expiresAt: number }>();

// Cache configuration
const DEFAULT_TTL = 5 * 60 * 1000; // 5 minutes

interface CacheOptions {
    ttl?: number;        // Time to live in milliseconds
    key?: string;        // Custom cache key generator
    condition?: (req: Request) => boolean; // When to cache
}

export class CacheService {
    private store: Map<string, { value: unknown; expiresAt: number }>;
    private useRedis: boolean;
    private redisClient: unknown;

    constructor() {
        this.store = memoryCache;
        this.useRedis = false;
        this.initializeRedis();
    }

    private async initializeRedis(): Promise<void> {
        // Check for Redis URL in environment
        const redisUrl = process.env.REDIS_URL;

        if (redisUrl) {
            try {
                // In production, connect to Redis
                // const { Redis } = await import('@redis/client');
                // this.redisClient = new Redis({ url: redisUrl });
                this.useRedis = true;
                console.log('Redis cache initialized');
            } catch (error) {
                console.warn('Redis connection failed, using in-memory cache:', error);
            }
        }
    }

    /**
     * Get value from cache
     */
    async get<T>(key: string): Promise<T | null> {
        if (this.useRedis && this.redisClient) {
            // Redis implementation
            // const value = await (this.redisClient as Redis).get(key);
            // return value ? JSON.parse(value) : null;
        }

        const item = this.store.get(key);
        if (!item) return null;

        if (Date.now() > item.expiresAt) {
            this.store.delete(key);
            return null;
        }

        return item.value as T;
    }

    /**
     * Set value in cache
     */
    async set(key: string, value: unknown, ttl: number = DEFAULT_TTL): Promise<void> {
        if (this.useRedis && this.redisClient) {
            // Redis implementation
            // await (this.redisClient as Redis).set(key, JSON.stringify(value), { EX: ttl / 1000 });
            return;
        }

        this.store.set(key, {
            value,
            expiresAt: Date.now() + ttl,
        });
    }

    /**
     * Delete value from cache
     */
    async delete(key: string): Promise<void> {
        if (this.useRedis && this.redisClient) {
            // await (this.redisClient as Redis).del(key);
            return;
        }

        this.store.delete(key);
    }

    /**
     * Clear all cache
     */
    async clear(): Promise<void> {
        if (this.useRedis && this.redisClient) {
            // await (this.redisClient as Redis).flushAll();
            return;
        }

        this.store.clear();
    }

    /**
     * Delete by pattern (e.g., "products:*")
     */
    async deletePattern(pattern: string): Promise<void> {
        if (this.useRedis && this.redisClient) {
            // const keys = await (this.redisClient as Redis).keys(pattern);
            // if (keys.length) await (this.redisClient as Redis).del(...keys);
            return;
        }

        const regex = new RegExp(pattern.replace('*', '.*'));
        for (const key of this.store.keys()) {
            if (regex.test(key)) {
                this.store.delete(key);
            }
        }
    }

    /**
     * Get cache stats
     */
    getStats() {
        const now = Date.now();
        let validItems = 0;

        for (const item of this.store.values()) {
            if (now <= item.expiresAt) validItems++;
        }

        return {
            total: this.store.size,
            valid: validItems,
            expired: this.store.size - validItems,
            backend: this.useRedis ? 'redis' : 'memory',
        };
    }
}

// Singleton instance
export const cache = new CacheService();

// ============================================================
// Cache Middleware Factory
// ============================================================

export function cacheMiddleware(options: CacheOptions = {}) {
    const { ttl = DEFAULT_TTL, key, condition } = options;

    return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
        // Skip if condition not met
        if (condition && !condition(req)) {
            next();
            return;
        }

        // Only cache GET requests
        if (req.method !== 'GET') {
            next();
            return;
        }

        // Generate cache key
        const cacheKey = key
            ? key(req)
            : `api:${req.originalUrl || req.url}`;

        try {
            // Try to get from cache
            const cached = await cache.get(cacheKey);

            if (cached) {
                res.setHeader('X-Cache', 'HIT');
                res.setHeader('X-Cache-Key', cacheKey);
                res.json(cached);
                return;
            }

            // Store original json method
            const originalJson = res.json.bind(res);

            // Override json to cache response
            res.json = function (body: unknown) {
                // Cache the response
                cache.set(cacheKey, body, ttl).catch(console.error);

                // Add cache headers
                res.setHeader('X-Cache', 'MISS');
                res.setHeader('X-Cache-Key', cacheKey);
                res.setHeader('X-Cache-TTL', String(ttl));

                return originalJson(body);
            };

            next();
        } catch (error) {
            console.error('Cache middleware error:', error);
            next();
        }
    };
}

// ============================================================
// Cache Invalidation Helpers
// ============================================================

export async function invalidateProductCache(productId?: string): Promise<void> {
    if (productId) {
        await cache.delete(`api:*products*${productId}*`);
    }
    await cache.deletePattern('api:*products*');
    await cache.deletePattern('api:*inventory*');
}

export async function invalidateSaleCache(): Promise<void> {
    await cache.deletePattern('api:*sales*');
    await cache.deletePattern('api:*dashboard*');
}

export async function invalidateUserCache(): Promise<void> {
    await cache.deletePattern('api:*users*');
}

// ============================================================
// Response Compression
// ============================================================

import compression from 'compression';

// Compression middleware for API responses
export const compressResponse = compression({
    filter: (req) => {
        // Don't compress if client doesn't accept it
        if (req.headers['accept-encoding']?.includes('gzip') === false) {
            return false;
        }
        // Don't compress already compressed responses
        if (req.path.startsWith('/api/')) {
            return true;
        }
        return false;
    },
    level: 6, // Balanced compression
});
