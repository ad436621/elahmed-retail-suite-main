// ============================================================
// ELAHMED RETAIL SUITE — Users Routes
// ============================================================

import { Router, Response } from 'express';
import bcrypt from 'bcryptjs';
import prisma from '../lib/prisma.js';
import { AuthRequest, requireRole } from '../middleware/auth.js';

const router = Router();

// Get all users
router.get('/', async (req: AuthRequest, res: Response) => {
    try {
        const users = await prisma.user.findMany({
            select: {
                id: true,
                username: true,
                fullName: true,
                role: true,
                permissions: true,
                active: true,
                createdAt: true,
                updatedAt: true,
            },
            orderBy: { createdAt: 'desc' },
        });

        res.json(users);
    } catch (error) {
        console.error('Get users error:', error);
        res.status(500).json({ error: 'Failed to get users' });
    }
});

// Get user by ID
router.get('/:id', async (req: AuthRequest, res: Response) => {
    try {
        const { id } = req.params;

        const user = await prisma.user.findUnique({
            where: { id },
            select: {
                id: true,
                username: true,
                fullName: true,
                role: true,
                permissions: true,
                active: true,
                createdAt: true,
            },
        });

        if (!user) {
            res.status(404).json({ error: 'User not found' });
            return;
        }

        res.json(user);
    } catch (error) {
        console.error('Get user error:', error);
        res.status(500).json({ error: 'Failed to get user' });
    }
});

// Create user
router.post('/', async (req: AuthRequest, res: Response) => {
    try {
        const { username, password, fullName, role, permissions, active } = req.body;

        if (!username || !password || !fullName) {
            res.status(400).json({ error: 'Username, password, and fullName required' });
            return;
        }

        // Only owner can create other owners
        if (role === 'owner' && req.user?.role !== 'owner') {
            res.status(403).json({ error: 'Only owner can create owner accounts' });
            return;
        }

        const hashedPassword = await bcrypt.hash(password, 12);

        const user = await prisma.user.create({
            data: {
                username,
                password: hashedPassword,
                fullName,
                role: role || 'employee',
                permissions: permissions || [],
                active: active !== false,
            },
            select: {
                id: true,
                username: true,
                fullName: true,
                role: true,
                permissions: true,
                active: true,
                createdAt: true,
            },
        });

        res.status(201).json(user);
    } catch (error: any) {
        if (error.code === 'P2002') {
            res.status(400).json({ error: 'Username already exists' });
            return;
        }
        console.error('Create user error:', error);
        res.status(500).json({ error: 'Failed to create user' });
    }
});

// Update user
router.put('/:id', async (req: AuthRequest, res: Response) => {
    try {
        const { id } = req.params;
        const { fullName, role, permissions, active } = req.body;

        // Prevent modifying owner unless you're owner
        const existingUser = await prisma.user.findUnique({ where: { id } });
        if (!existingUser) {
            res.status(404).json({ error: 'User not found' });
            return;
        }

        if (existingUser.role === 'owner' && req.user?.role !== 'owner') {
            res.status(403).json({ error: 'Cannot modify owner' });
            return;
        }

        const updateData: any = {};
        if (fullName) updateData.fullName = fullName;
        if (role) {
            if (role === 'owner' && req.user?.role !== 'owner') {
                res.status(403).json({ error: 'Only owner can assign owner role' });
                return;
            }
            updateData.role = role;
        }
        if (permissions) updateData.permissions = permissions;
        if (active !== undefined) updateData.active = active;

        const user = await prisma.user.update({
            where: { id },
            data: updateData,
            select: {
                id: true,
                username: true,
                fullName: true,
                role: true,
                permissions: true,
                active: true,
                updatedAt: true,
            },
        });

        res.json(user);
    } catch (error) {
        console.error('Update user error:', error);
        res.status(500).json({ error: 'Failed to update user' });
    }
});

// Delete user
router.delete('/:id', async (req: AuthRequest, res: Response) => {
    try {
        const { id } = req.params;

        const existingUser = await prisma.user.findUnique({ where: { id } });
        if (!existingUser) {
            res.status(404).json({ error: 'User not found' });
            return;
        }

        if (existingUser.role === 'owner') {
            res.status(403).json({ error: 'Cannot delete owner' });
            return;
        }

        await prisma.user.delete({ where: { id } });

        res.json({ message: 'User deleted successfully' });
    } catch (error) {
        console.error('Delete user error:', error);
        res.status(500).json({ error: 'Failed to delete user' });
    }
});

export default router;
