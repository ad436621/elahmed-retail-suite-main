// ============================================================
// ELAHMED RETAIL SUITE — Rate Limiting Middleware
// ============================================================

import { Request, Response, NextFunction } from 'express';

// In-memory store for rate limiting (use Redis in production)
const requestCounts = new Map<string, { count: number; resetTime: number }>();

// Clean up expired entries periodically
setInterval(() => {
    const now = Date.now();
    for (const [key, value] of requestCounts.entries()) {
        if (now > value.resetTime) {
            requestCounts.delete(key);
        }
    }
}, 60000); // Clean every minute

interface RateLimitOptions {
    windowMs: number;    // Time window in milliseconds
    maxRequests: number;  // Maximum requests per window
    message?: string;
}

export function rateLimiter(options: RateLimitOptions) {
    const { windowMs, maxRequests, message = 'Too many requests, please try again later' } = options;

    return (req: Request, res: Response, next: NextFunction): void => {
        // Get client identifier (IP or user ID if authenticated)
        const identifier = req.ip || req.socket.remoteAddress || 'unknown';

        // For authenticated requests, use user ID for more accurate limiting
        const key = req.user ? `user:${req.user.id}` : `ip:${identifier}`;

        const now = Date.now();
        const record = requestCounts.get(key);

        if (!record || now > record.resetTime) {
            // New window
            requestCounts.set(key, {
                count: 1,
                resetTime: now + windowMs,
            });
            next();
            return;
        }

        if (record.count >= maxRequests) {
            // Rate limit exceeded
            const retryAfter = Math.ceil((record.resetTime - now) / 1000);
            res.setHeader('Retry-After', retryAfter);
            res.setHeader('X-RateLimit-Limit', maxRequests);
            res.setHeader('X-RateLimit-Remaining', 0);
            res.setHeader('X-RateLimit-Reset', record.resetTime);
            res.status(429).json({
                error: message,
                retryAfter
            });
            return;
        }

        // Increment count
        record.count++;
        res.setHeader('X-RateLimit-Limit', maxRequests);
        res.setHeader('X-RateLimit-Remaining', maxRequests - record.count);
        res.setHeader('X-RateLimit-Reset', record.resetTime);

        next();
    };
}

// Pre-configured rate limiters
export const strictLimiter = rateLimiter({
    windowMs: 60 * 1000, // 1 minute
    maxRequests: 10,      // 10 requests per minute
    message: 'Too many attempts, please wait',
});

export const moderateLimiter = rateLimiter({
    windowMs: 60 * 1000, // 1 minute
    maxRequests: 60,      // 60 requests per minute
    message: 'Too many requests',
});

export const authLimiter = rateLimiter({
    windowMs: 15 * 60 * 1000, // 15 minutes
    maxRequests: 5,            // 5 attempts per 15 minutes
    message: 'Too many login attempts, please try again later',
});

export const apiLimiter = rateLimiter({
    windowMs: 60 * 1000, // 1 minute
    maxRequests: 100,    // 100 requests per minute
    message: 'API rate limit exceeded',
});
