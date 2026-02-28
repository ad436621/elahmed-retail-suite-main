// ============================================================
// ELAHMED RETAIL SUITE — RBAC Routes (Roles & Permissions)
// ============================================================

import { Router, Request, Response } from 'express';
import { authMiddleware } from '../middleware/auth.js';
import { requireRole, requirePermission, SystemPermissions } from '../middleware/rbac.js';
import prisma from '../lib/prisma.js';
import logger from '../lib/logger.js';

const router = Router();

// ============================================================
// Roles Endpoints
// ============================================================

/**
 * GET /api/rbac/roles - List all roles
 */
router.get('/roles', authMiddleware, requirePermission(SystemPermissions.USERS_VIEW), async (req: Request, res: Response) => {
    try {
        const roles = await prisma.role.findMany({
            include: {
                _count: {
                    select: { users: true },
                },
            },
            orderBy: { name: 'asc' },
        });

        res.json({ roles });
    } catch (error) {
        logger.error('Error listing roles', { error });
        res.status(500).json({ error: 'Failed to list roles' });
    }
});

/**
 * GET /api/rbac/roles/:id - Get role details with permissions
 */
router.get('/roles/:id', authMiddleware, requirePermission(SystemPermissions.USERS_VIEW), async (req: Request, res: Response) => {
    try {
        const { id } = req.params;

        const role = await prisma.role.findUnique({
            where: { id },
            include: {
                permissions: {
                    include: {
                        permission: true,
                    },
                },
                _count: {
                    select: { users: true },
                },
            },
        });

        if (!role) {
            return res.status(404).json({ error: 'Role not found' });
        }

        res.json({ role });
    } catch (error) {
        logger.error('Error getting role', { error });
        res.status(500).json({ error: 'Failed to get role' });
    }
});

/**
 * POST /api/rbac/roles - Create a new role
 */
router.post('/roles', authMiddleware, requirePermission(SystemPermissions.USERS_ROLES), async (req: Request, res: Response) => {
    try {
        const { name, description, permissionIds } = req.body;

        if (!name) {
            return res.status(400).json({ error: 'Role name is required' });
        }

        // Check if role already exists
        const existing = await prisma.role.findUnique({ where: { name } });
        if (existing) {
            return res.status(400).json({ error: 'Role already exists' });
        }

        const role = await prisma.role.create({
            data: {
                name,
                description,
                permissions: permissionIds?.length > 0
                    ? {
                        create: permissionIds.map((id: string) => ({
                            permissionId: id,
                        })),
                    }
                    : undefined,
            },
            include: {
                permissions: {
                    include: { permission: true },
                },
            },
        });

        res.status(201).json({ role });
    } catch (error) {
        logger.error('Error creating role', { error });
        res.status(500).json({ error: 'Failed to create role' });
    }
});

/**
 * PUT /api/rbac/roles/:id - Update a role
 */
router.put('/roles/:id', authMiddleware, requirePermission(SystemPermissions.USERS_ROLES), async (req: Request, res: Response) => {
    try {
        const { id } = req.params;
        const { name, description, permissionIds } = req.body;

        // Check if role exists
        const existing = await prisma.role.findUnique({ where: { id } });
        if (!existing) {
            return res.status(404).json({ error: 'Role not found' });
        }

        // System roles cannot be modified
        if (existing.isSystem) {
            return res.status(403).json({ error: 'Cannot modify system role' });
        }

        // Update role
        const role = await prisma.role.update({
            where: { id },
            data: {
                name,
                description,
            },
        });

        // Update permissions if provided
        if (permissionIds !== undefined) {
            // Remove existing permissions
            await prisma.rolePermission.deleteMany({ where: { roleId: id } });

            // Add new permissions
            if (permissionIds.length > 0) {
                await prisma.rolePermission.createMany({
                    data: permissionIds.map((permissionId: string) => ({
                        roleId: id,
                        permissionId,
                    })),
                });
            }
        }

        // Get updated role with permissions
        const updatedRole = await prisma.role.findUnique({
            where: { id },
            include: {
                permissions: {
                    include: { permission: true },
                },
            },
        });

        res.json({ role: updatedRole });
    } catch (error) {
        logger.error('Error updating role', { error });
        res.status(500).json({ error: 'Failed to update role' });
    }
});

/**
 * DELETE /api/rbac/roles/:id - Delete a role
 */
router.delete('/roles/:id', authMiddleware, requirePermission(SystemPermissions.USERS_ROLES), async (req: Request, res: Response) => {
    try {
        const { id } = req.params;

        // Check if role exists
        const existing = await prisma.role.findUnique({ where: { id } });
        if (!existing) {
            return res.status(404).json({ error: 'Role not found' });
        }

        // System roles cannot be deleted
        if (existing.isSystem) {
            return res.status(403).json({ error: 'Cannot delete system role' });
        }

        // Check if role is assigned to users
        const userCount = await prisma.userRoleAssignment.count({ where: { roleId: id } });
        if (userCount > 0) {
            return res.status(400).json({ error: 'Cannot delete role assigned to users' });
        }

        await prisma.role.delete({ where: { id } });

        res.json({ message: 'Role deleted successfully' });
    } catch (error) {
        logger.error('Error deleting role', { error });
        res.status(500).json({ error: 'Failed to delete role' });
    }
});

// ============================================================
// Permissions Endpoints
// ============================================================

/**
 * GET /api/rbac/permissions - List all permissions
 */
router.get('/permissions', authMiddleware, requirePermission(SystemPermissions.USERS_VIEW), async (req: Request, res: Response) => {
    try {
        const permissions = await prisma.permission.findMany({
            orderBy: [{ category: 'asc' }, { name: 'asc' }],
        });

        res.json({ permissions });
    } catch (error) {
        logger.error('Error listing permissions', { error });
        res.status(500).json({ error: 'Failed to list permissions' });
    }
});

// ============================================================
// User Role Assignments
// ============================================================

/**
 * GET /api/rbac/users/:userId/roles - Get user's roles
 */
router.get('/users/:userId/roles', authMiddleware, requirePermission(SystemPermissions.USERS_VIEW), async (req: Request, res: Response) => {
    try {
        const { userId } = req.params;

        const assignments = await prisma.userRoleAssignment.findMany({
            where: { userId },
            include: {
                role: {
                    include: {
                        permissions: {
                            include: { permission: true },
                        },
                    },
                },
            },
        });

        res.json({ assignments });
    } catch (error) {
        logger.error('Error getting user roles', { error });
        res.status(500).json({ error: 'Failed to get user roles' });
    }
});

/**
 * POST /api/rbac/users/:userId/roles - Assign role to user
 */
router.post('/users/:userId/roles', authMiddleware, requirePermission(SystemPermissions.USERS_ROLES), async (req: Request, res: Response) => {
    try {
        const { userId } = req.params;
        const { roleId } = req.body;

        if (!roleId) {
            return res.status(400).json({ error: 'Role ID is required' });
        }

        // Check if user exists
        const user = await prisma.user.findUnique({ where: { id: userId } });
        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }

        // Check if role exists
        const role = await prisma.role.findUnique({ where: { id: roleId } });
        if (!role) {
            return res.status(404).json({ error: 'Role not found' });
        }

        // Check if assignment already exists
        const existing = await prisma.userRoleAssignment.findUnique({
            where: {
                userId_roleId: { userId, roleId },
            },
        });

        if (existing) {
            return res.status(400).json({ error: 'User already has this role' });
        }

        await prisma.userRoleAssignment.create({
            data: { userId, roleId },
        });

        res.status(201).json({ message: 'Role assigned successfully' });
    } catch (error) {
        logger.error('Error assigning role', { error });
        res.status(500).json({ error: 'Failed to assign role' });
    }
});

/**
 * DELETE /api/rbac/users/:userId/roles/:roleId - Remove role from user
 */
router.delete('/users/:userId/roles/:roleId', authMiddleware, requirePermission(SystemPermissions.USERS_ROLES), async (req: Request, res: Response) => {
    try {
        const { userId, roleId } = req.params;

        await prisma.userRoleAssignment.delete({
            where: {
                userId_roleId: { userId, roleId },
            },
        });

        res.json({ message: 'Role removed successfully' });
    } catch (error) {
        logger.error('Error removing role', { error });
        res.status(500).json({ error: 'Failed to remove role' });
    }
});

export default router;
