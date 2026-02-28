// ============================================================
// ELAHMED RETAIL SUITE — Prometheus Metrics Service
// ============================================================

import { Registry, Counter, Histogram, Gauge } from 'prom-client';

// Create a custom registry
export const register = new Registry();

// Add default metrics (CPU, memory, etc.)
// Note: In production, you'd use node-exporter for system metrics

// ============================================================
// Request Metrics
// ============================================================

export const httpRequestDuration = new Histogram({
    name: 'http_request_duration_seconds',
    help: 'Duration of HTTP requests in seconds',
    labelNames: ['method', 'route', 'status_code'],
    buckets: [0.001, 0.005, 0.01, 0.05, 0.1, 0.5, 1, 2, 5],
    registers: [register],
});

export const httpRequestTotal = new Counter({
    name: 'http_requests_total',
    help: 'Total number of HTTP requests',
    labelNames: ['method', 'route', 'status_code'],
    registers: [register],
});

export const httpRequestInProgress = new Gauge({
    name: 'http_requests_in_progress',
    help: 'Number of HTTP requests currently in progress',
    labelNames: ['method', 'route'],
    registers: [register],
});

// ============================================================
// Business Metrics
// ============================================================

export const salesTotal = new Counter({
    name: 'sales_total',
    help: 'Total number of sales',
    labelNames: ['payment_method', 'status'],
    registers: [register],
});

export const salesRevenue = new Counter({
    name: 'sales_revenue_total',
    help: 'Total revenue from sales',
    labelNames: ['payment_method'],
    registers: [register],
});

export const productsViewed = new Counter({
    name: 'products_viewed_total',
    help: 'Total number of product views',
    labelNames: ['category'],
    registers: [register],
});

export const activeUsers = new Gauge({
    name: 'active_users',
    help: 'Number of currently active users',
    registers: [register],
});

// ============================================================
// Database Metrics
// ============================================================

export const dbQueryDuration = new Histogram({
    name: 'db_query_duration_seconds',
    help: 'Duration of database queries in seconds',
    labelNames: ['operation', 'table'],
    buckets: [0.001, 0.005, 0.01, 0.05, 0.1, 0.5, 1],
    registers: [register],
});

export const dbQueryErrors = new Counter({
    name: 'db_query_errors_total',
    help: 'Total number of database query errors',
    labelNames: ['operation', 'table', 'error_type'],
    registers: [register],
});

// ============================================================
// Background Job Metrics
// ============================================================

export const jobDuration = new Histogram({
    name: 'background_job_duration_seconds',
    help: 'Duration of background jobs in seconds',
    labelNames: ['job_type', 'status'],
    buckets: [0.1, 0.5, 1, 5, 10, 30, 60, 300],
    registers: [register],
});

export const jobTotal = new Counter({
    name: 'background_jobs_total',
    help: 'Total number of background jobs',
    labelNames: ['job_type', 'status'],
    registers: [register],
});

// ============================================================
// Cache Metrics
// ============================================================

export const cacheHits = new Counter({
    name: 'cache_hits_total',
    help: 'Total number of cache hits',
    labelNames: ['cache_name'],
    registers: [register],
});

export const cacheMisses = new Counter({
    name: 'cache_misses_total',
    help: 'Total number of cache misses',
    labelNames: ['cache_name'],
    registers: [register],
});

// ============================================================
// Metrics Middleware
// ============================================================

import { Request, Response, NextFunction } from 'express';

export function metricsMiddleware(req: Request, res: Response, next: NextFunction): void {
    const startTime = Date.now();

    // Increment in-progress requests
    httpRequestInProgress.inc({ method: req.method, route: req.path });

    // On response finish
    res.on('finish', () => {
        const duration = (Date.now() - startTime) / 1000;
        const route = req.route?.path || req.path;

        // Decrement in-progress requests
        httpRequestInProgress.dec({ method: req.method, route });

        // Record request duration
        httpRequestDuration.observe({
            method: req.method,
            route,
            status_code: res.statusCode
        }, duration);

        // Increment request total
        httpRequestTotal.inc({
            method: req.method,
            route,
            status_code: res.statusCode
        });
    });

    next();
}

/**
 * Get all metrics in Prometheus format
 */
export async function getMetrics(): Promise<string> {
    return register.metrics();
}

/**
 * Get metrics as JSON
 */
export async function getMetricsJSON(): Promise<Record<string, unknown>> {
    return register.getMetricsAsJSON();
}

/**
 * Clear all metrics
 */
export function clearMetrics(): void {
    register.clear();
}

export default {
    register,
    httpRequestDuration,
    httpRequestTotal,
    httpRequestInProgress,
    salesTotal,
    salesRevenue,
    productsViewed,
    activeUsers,
    dbQueryDuration,
    dbQueryErrors,
    jobDuration,
    jobTotal,
    cacheHits,
    cacheMisses,
    metricsMiddleware,
    getMetrics,
    getMetricsJSON,
    clearMetrics,
};
