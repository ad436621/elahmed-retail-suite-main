// ============================================================
// ELAHMED RETAIL SUITE — Professional Logging Service
// Uses Winston for production-grade logging
// ============================================================

import winston from 'winston';
import path from 'path';

// Define log format
const logFormat = winston.format.combine(
    winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
    winston.format.errors({ stack: true }),
    winston.format.printf(({ timestamp, level, message, stack, ...meta }) => {
        let log = `${timestamp} [${level.toUpperCase()}]: ${message}`;

        // Add request ID if present
        if (meta.requestId) {
            log = `[${meta.requestId}] ${log}`;
        }

        // Add user ID if present
        if (meta.userId) {
            log = `[User: ${meta.userId}] ${log}`;
        }

        // Add extra metadata
        if (Object.keys(meta).length > 0 && !meta.requestId && !meta.userId) {
            log += ` ${JSON.stringify(meta)}`;
        }

        // Add stack trace for errors
        if (stack) {
            log += `\n${stack}`;
        }

        return log;
    })
);

// Create logger instance
const logger = winston.createLogger({
    level: process.env.LOG_LEVEL || 'info',
    format: logFormat,
    defaultMeta: { service: 'elahmed-retail' },
    transports: [],
});

// Add console transport in development
if (process.env.NODE_ENV !== 'production') {
    logger.add(new winston.transports.Console({
        format: winston.format.combine(
            winston.format.colorize(),
            logFormat
        ),
    }));
}

// Add file transports in production
if (process.env.NODE_ENV === 'production') {
    // Error log
    logger.add(new winston.transports.File({
        filename: path.join(process.cwd(), 'logs', 'error.log'),
        level: 'error',
        maxsize: 10 * 1024 * 1024, // 10MB
        maxFiles: 5,
    }));

    // Combined log
    logger.add(new winston.transports.File({
        filename: path.join(process.cwd(), 'logs', 'combined.log'),
        maxsize: 10 * 1024 * 1024, // 10MB
        maxFiles: 5,
    }));
}

// ============================================================
// Request ID Middleware
// ============================================================

import { Request, Response, NextFunction } from 'express';
import { v4 as uuidv4 } from 'uuid';

declare global {
    namespace Express {
        interface Request {
            requestId?: string;
        }
    }
}

export function requestIdMiddleware(req: Request, res: Response, next: NextFunction): void {
    req.requestId = uuidv4();
    res.setHeader('X-Request-ID', req.requestId);
    next();
}

// ============================================================
// Logging Helpers
// ============================================================

export function logRequest(req: Request, res: Response, next: NextFunction): void {
    const start = Date.now();

    // Log request
    logger.info('Incoming request', {
        method: req.method,
        url: req.url,
        ip: req.ip,
        userAgent: req.get('user-agent'),
        requestId: req.requestId,
    });

    // Log response
    res.on('finish', () => {
        const duration = Date.now() - start;
        logger.info('Request completed', {
            method: req.method,
            url: req.url,
            status: res.statusCode,
            duration: `${duration}ms`,
            requestId: req.requestId,
        });
    });

    next();
}

export function logError(error: Error, req: Request): void {
    logger.error('Unhandled error', {
        message: error.message,
        stack: error.stack,
        method: req.method,
        url: req.url,
        requestId: req.requestId,
        userId: req.user?.id,
    });
}

// ============================================================
// API Log Helper
// ============================================================

export function logApiCall(
    service: string,
    action: string,
    params?: Record<string, unknown>,
    result?: unknown,
    error?: Error
): void {
    if (error) {
        logger.error(`API Call Failed: ${service}.${action}`, {
            service,
            action,
            params,
            error: error.message,
            stack: error.stack,
        });
    } else {
        logger.info(`API Call: ${service}.${action}`, {
            service,
            action,
            params,
            result: typeof result === 'object' ? '[object]' : result,
        });
    }
}

// ============================================================
// Audit Log Helper (for critical actions)
// ============================================================

export function auditLog(
    action: string,
    userId: string,
    details: Record<string, unknown>
): void {
    logger.info(`AUDIT: ${action}`, {
        audit: true,
        action,
        userId,
        ...details,
        timestamp: new Date().toISOString(),
    });
}

export default logger;
