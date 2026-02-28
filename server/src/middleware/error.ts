// ============================================================
// ELAHMED RETAIL SUITE — Error Handler Middleware
// ============================================================

import { Request, Response, NextFunction } from 'express';

export function errorHandler(
    err: Error,
    req: Request,
    res: Response,
    next: NextFunction
): void {
    console.error('Error:', err);

    // Handle specific error types
    if (err.name === 'ValidationError') {
        res.status(400).json({
            error: 'Validation error',
            details: err.message,
        });
        return;
    }

    if (err.name === 'UnauthorizedError') {
        res.status(401).json({
            error: 'Unauthorized',
        });
        return;
    }

    // Prisma errors
    if (err.message?.includes('Prisma')) {
        res.status(500).json({
            error: 'Database error',
        });
        return;
    }

    // Default error
    res.status(500).json({
        error: process.env.NODE_ENV === 'production'
            ? 'Internal server error'
            : err.message,
    });
}

// Async handler wrapper
export function asyncHandler(
    fn: (req: Request, res: Response, next: NextFunction) => Promise<any>
) {
    return (req: Request, res: Response, next: NextFunction) => {
        Promise.resolve(fn(req, res, next)).catch(next);
    };
}
