// ============================================================
// ELAHMED RETAIL SUITE — Authentication Routes
// ============================================================

import { Router, Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import prisma from '../lib/prisma.js';
import { generateToken, JWTPayload } from '../middleware/auth.js';

const router = Router();

// Login
router.post('/login', async (req: Request, res: Response) => {
    try {
        const { username, password } = req.body;

        if (!username || !password) {
            res.status(400).json({ error: 'Username and password required' });
            return;
        }

        const user = await prisma.user.findUnique({
            where: { username },
        });

        if (!user || !user.active) {
            res.status(401).json({ error: 'Invalid credentials' });
            return;
        }

        const validPassword = await bcrypt.compare(password, user.password);
        if (!validPassword) {
            res.status(401).json({ error: 'Invalid credentials' });
            return;
        }

        const payload: JWTPayload = {
            id: user.id,
            username: user.username,
            role: user.role,
            permissions: user.permissions as string[],
        };

        const token = generateToken(payload);

        res.json({
            token,
            user: {
                id: user.id,
                username: user.username,
                fullName: user.fullName,
                role: user.role,
                permissions: user.permissions,
            },
        });
    } catch (error) {
        console.error('Login error:', error);
        res.status(500).json({ error: 'Login failed' });
    }
});

// Register (owner only - first user)
router.post('/register', async (req: Request, res: Response) => {
    try {
        const { username, password, fullName } = req.body;

        // Check if any users exist
        const userCount = await prisma.user.count();
        if (userCount > 0) {
            res.status(403).json({ error: 'Registration closed' });
            return;
        }

        if (!username || !password || !fullName) {
            res.status(400).json({ error: 'All fields required' });
            return;
        }

        const hashedPassword = await bcrypt.hash(password, 12);

        const user = await prisma.user.create({
            data: {
                username,
                password: hashedPassword,
                fullName,
                role: 'owner',
                permissions: [
                    'dashboard', 'pos', 'sales', 'inventory', 'mobiles', 'computers',
                    'devices', 'used', 'cars', 'warehouse', 'maintenance', 'installments',
                    'expenses', 'damaged', 'otherRevenue', 'returns', 'settings', 'users'
                ],
            },
        });

        const payload: JWTPayload = {
            id: user.id,
            username: user.username,
            role: user.role,
            permissions: user.permissions as string[],
        };

        const token = generateToken(payload);

        res.status(201).json({
            token,
            user: {
                id: user.id,
                username: user.username,
                fullName: user.fullName,
                role: user.role,
                permissions: user.permissions,
            },
        });
    } catch (error: any) {
        if (error.code === 'P2002') {
            res.status(400).json({ error: 'Username already exists' });
            return;
        }
        console.error('Register error:', error);
        res.status(500).json({ error: 'Registration failed' });
    }
});

// Verify token
router.get('/verify', async (req: Request, res: Response) => {
    try {
        const authHeader = req.headers.authorization;
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            res.status(401).json({ error: 'No token' });
            return;
        }

        const token = authHeader.substring(7);
        const jwt = await import('jsonwebtoken');
        const secret = process.env.JWT_SECRET || 'default-secret';

        const decoded = jwt.default.verify(token, secret) as JWTPayload;

        const user = await prisma.user.findUnique({
            where: { id: decoded.id },
            select: {
                id: true,
                username: true,
                fullName: true,
                role: true,
                permissions: true,
                active: true,
            },
        });

        if (!user || !user.active) {
            res.status(401).json({ error: 'User not found or inactive' });
            return;
        }

        res.json({
            id: user.id,
            username: user.username,
            fullName: user.fullName,
            role: user.role,
            permissions: user.permissions,
        });
    } catch (error) {
        res.status(401).json({ error: 'Invalid token' });
    }
});

// Change password
router.post('/change-password', async (req: Request, res: Response) => {
    try {
        const { currentPassword, newPassword } = req.body;
        const userId = req.user?.id;

        if (!userId) {
            res.status(401).json({ error: 'Not authenticated' });
            return;
        }

        if (!currentPassword || !newPassword) {
            res.status(400).json({ error: 'Current and new password required' });
            return;
        }

        const user = await prisma.user.findUnique({
            where: { id: userId },
        });

        if (!user) {
            res.status(404).json({ error: 'User not found' });
            return;
        }

        const validPassword = await bcrypt.compare(currentPassword, user.password);
        if (!validPassword) {
            res.status(401).json({ error: 'Current password is incorrect' });
            return;
        }

        const hashedPassword = await bcrypt.hash(newPassword, 12);

        await prisma.user.update({
            where: { id: userId },
            data: { password: hashedPassword },
        });

        res.json({ message: 'Password changed successfully' });
    } catch (error) {
        console.error('Change password error:', error);
        res.status(500).json({ error: 'Failed to change password' });
    }
});

export default router;
