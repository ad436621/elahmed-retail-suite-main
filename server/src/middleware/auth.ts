// ============================================================
// ELAHMED RETAIL SUITE — Authentication Middleware
// Supports both Bearer token and httpOnly cookie authentication
// ============================================================

import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';

export interface JWTPayload {
    id: string;
    username: string;
    role: string;
    permissions: string[];
}

export interface AuthRequest extends Request {
    user?: JWTPayload;
}

declare global {
    namespace Express {
        interface Request {
            user?: JWTPayload;
        }
    }
}

const TOKEN_COOKIE_NAME = 'elahmed_token';

export function authMiddleware(
    req: Request,
    res: Response,
    next: NextFunction
): void {
    try {
        let token: string | undefined;

        // First check Authorization header (Bearer token)
        const authHeader = req.headers.authorization;
        if (authHeader && authHeader.startsWith('Bearer ')) {
            token = authHeader.substring(7);
        }
        // Then check httpOnly cookie
        else if (req.cookies && req.cookies[TOKEN_COOKIE_NAME]) {
            token = req.cookies[TOKEN_COOKIE_NAME];
        }

        if (!token) {
            res.status(401).json({ error: 'No token provided' });
            return;
        }

        const secret = process.env.JWT_SECRET;

        if (!secret) {
            console.error('JWT_SECRET not configured');
            res.status(500).json({ error: 'Server configuration error' });
            return;
        }

        const decoded = jwt.verify(token, secret) as JWTPayload;
        req.user = decoded;
        next();
    } catch (error) {
        res.status(401).json({ error: 'Invalid or expired token' });
    }
}

/**
 * Set JWT in httpOnly cookie
 */
export function setAuthCookie(res: Response, token: string): void {
    const isProduction = process.env.NODE_ENV === 'production';

    res.cookie(TOKEN_COOKIE_NAME, token, {
        httpOnly: true,
        secure: isProduction, // Use HTTPS in production
        sameSite: 'strict',
        maxAge: 24 * 60 * 60 * 1000, // 24 hours
        path: '/',
    });
}

/**
 * Clear auth cookie
 */
export function clearAuthCookie(res: Response): void {
    res.clearCookie(TOKEN_COOKIE_NAME, {
        path: '/',
    });
}

export function requireRole(...roles: string[]) {
    return (req: Request, res: Response, next: NextFunction): void => {
        if (!req.user) {
            res.status(401).json({ error: 'Not authenticated' });
            return;
        }

        if (!roles.includes(req.user.role)) {
            res.status(403).json({ error: 'Insufficient permissions' });
            return;
        }

        next();
    };
}

export function requirePermission(permission: string) {
    return (req: Request, res: Response, next: NextFunction): void => {
        if (!req.user) {
            res.status(401).json({ error: 'Not authenticated' });
            return;
        }

        if (!req.user.permissions.includes(permission) && req.user.role !== 'owner') {
            res.status(403).json({ error: 'Insufficient permissions' });
            return;
        }

        next();
    };
}

export function generateToken(payload: JWTPayload): string {
    return jwt.sign(payload, process.env.JWT_SECRET!, { expiresIn: '24h' });
}

export function verifyToken(token: string): JWTPayload | null {
    try {
        return jwt.verify(token, process.env.JWT_SECRET!) as JWTPayload;
    } catch {
        return null;
    }
}
