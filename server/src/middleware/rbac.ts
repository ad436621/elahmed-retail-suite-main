// ============================================================
// ELAHMED RETAIL SUITE — RBAC (Role-Based Access Control)
// ============================================================

import { Request, Response, NextFunction } from 'express';
import prisma from '../lib/prisma.js';
import logger from '../lib/logger.js';
import { JWTPayload } from './auth.js';

export interface AuthRequest extends Request {
    user?: JWTPayload & {
        roles?: string[];
        permissions?: string[];
    };
}

/**
 * Permission categories for organizing permissions
 */
export const PermissionCategory = {
    SALES: 'sales',
    INVENTORY: 'inventory',
    CUSTOMERS: 'customers',
    SUPPLIERS: 'suppliers',
    REPORTS: 'reports',
    SETTINGS: 'settings',
    USERS: 'users',
    FINANCE: 'finance',
    PRODUCTS: 'products',
} as const;

/**
 * System permissions that cannot be modified
 */
export const SystemPermissions = {
    // Sales
    SALES_VIEW: 'sales:view',
    SALES_CREATE: 'sales:create',
    SALES_VOID: 'sales:void',
    SALES_REFUND: 'sales:refund',

    // Inventory
    INVENTORY_VIEW: 'inventory:view',
    INVENTORY_CREATE: 'inventory:create',
    INVENTORY_EDIT: 'inventory:edit',
    INVENTORY_DELETE: 'inventory:delete',
    INVENTORY_ADJUST: 'inventory:adjust',

    // Products
    PRODUCTS_VIEW: 'products:view',
    PRODUCTS_CREATE: 'products:create',
    PRODUCTS_EDIT: 'products:edit',
    PRODUCTS_DELETE: 'products:delete',

    // Customers
    CUSTOMERS_VIEW: 'customers:view',
    CUSTOMERS_CREATE: 'customers:create',
    CUSTOMERS_EDIT: 'customers:edit',
    CUSTOMERS_DELETE: 'customers:delete',

    // Suppliers
    SUPPLIERS_VIEW: 'suppliers:view',
    SUPPLIERS_CREATE: 'suppliers:create',
    SUPPLIERS_EDIT: 'suppliers:edit',
    SUPPLIERS_DELETE: 'suppliers:delete',

    // Reports
    REPORTS_VIEW: 'reports:view',
    REPORTS_EXPORT: 'reports:export',
    REPORTS_ANALYTICS: 'reports:analytics',

    // Settings
    SETTINGS_VIEW: 'settings:view',
    SETTINGS_EDIT: 'settings:edit',

    // Users
    USERS_VIEW: 'users:view',
    USERS_CREATE: 'users:create',
    USERS_EDIT: 'users:edit',
    USERS_DELETE: 'users:delete',
    USERS_ROLES: 'users:roles',

    // Finance
    FINANCE_VIEW: 'finance:view',
    FINANCE_EDIT: 'finance:edit',
    FINANCE_EXPENSES: 'finance:expenses',

    // All access (owner only)
    ALL_ACCESS: '*',
} as const;

type PermissionName = typeof SystemPermissions[keyof typeof SystemPermissions];

/**
 * Check if user has a specific permission
 */
export async function hasPermission(
    userId: string,
    permission: string
): Promise<boolean> {
    try {
        // Get user with their roles and permissions
        const user = await prisma.user.findUnique({
            where: { id: userId },
            include: {
                userRoles: {
                    include: {
                        role: {
                            include: {
                                permissions: {
                                    include: {
                                        permission: true,
                                    },
                                },
                            },
                        },
                    },
                },
            },
        });

        if (!user) return false;

        // Check system role-based access first
        if (user.role === 'owner') return true;
        if (user.role === 'admin') return true;

        // Check role permissions
        for (const userRole of user.userRoles) {
            for (const rp of userRole.role.permissions) {
                if (rp.permission.name === permission || rp.permission.name === '*') {
                    return true;
                }
            }
        }

        return false;
    } catch (error) {
        logger.error('Error checking permission', { userId, permission, error });
        return false;
    }
}

/**
 * Require a specific permission to access the route
 */
export function requirePermission(permission: string) {
    return async (req: AuthRequest, res: Response, next: NextFunction) => {
        try {
            if (!req.user) {
                return res.status(401).json({ error: 'Unauthorized' });
            }

            const hasAccess = await hasPermission(req.user.id, permission);

            if (!hasAccess) {
                logger.warn('Permission denied', {
                    userId: req.user.id,
                    username: req.user.username,
                    permission,
                    path: req.path,
                });

                return res.status(403).json({
                    error: 'Forbidden',
                    message: `Permission required: ${permission}`,
                });
            }

            next();
        } catch (error) {
            logger.error('Error in requirePermission middleware', { error });
            next(error);
        }
    };
}

/**
 * Require any of the specified permissions
 */
export function requireAnyPermission(...permissions: string[]) {
    return async (req: AuthRequest, res: Response, next: NextFunction) => {
        try {
            if (!req.user) {
                return res.status(401).json({ error: 'Unauthorized' });
            }

            for (const permission of permissions) {
                const hasAccess = await hasPermission(req.user.id, permission);
                if (hasAccess) {
                    return next();
                }
            }

            logger.warn('Permission denied - none matched', {
                userId: req.user.id,
                username: req.user.username,
                requiredPermissions: permissions,
                path: req.path,
            });

            return res.status(403).json({
                error: 'Forbidden',
                message: `One of these permissions required: ${permissions.join(', ')}`,
            });
        } catch (error) {
            logger.error('Error in requireAnyPermission middleware', { error });
            next(error);
        }
    };
}

/**
 * Require all specified permissions
 */
export function requireAllPermissions(...permissions: string[]) {
    return async (req: AuthRequest, res: Response, next: NextFunction) => {
        try {
            if (!req.user) {
                return res.status(401).json({ error: 'Unauthorized' });
            }

            for (const permission of permissions) {
                const hasAccess = await hasPermission(req.user.id, permission);
                if (!hasAccess) {
                    logger.warn('Permission denied - missing required', {
                        userId: req.user.id,
                        username: req.user.username,
                        missingPermission: permission,
                        path: req.path,
                    });

                    return res.status(403).json({
                        error: 'Forbidden',
                        message: `Permission required: ${permission}`,
                    });
                }
            }

            next();
        } catch (error) {
            logger.error('Error in requireAllPermissions middleware', { error });
            next(error);
        }
    };
}

/**
 * Require a specific role
 */
export function requireRole(...roles: string[]) {
    return (req: AuthRequest, res: Response, next: NextFunction) => {
        try {
            if (!req.user) {
                return res.status(401).json({ error: 'Unauthorized' });
            }

            // Owner has access to everything
            if (req.user.role === 'owner') {
                return next();
            }

            if (!roles.includes(req.user.role)) {
                logger.warn('Role denied', {
                    userId: req.user.id,
                    username: req.user.username,
                    userRole: req.user.role,
                    requiredRoles: roles,
                    path: req.path,
                });

                return res.status(403).json({
                    error: 'Forbidden',
                    message: `Role required: ${roles.join(' or ')}`,
                });
            }

            next();
        } catch (error) {
            logger.error('Error in requireRole middleware', { error });
            next(error);
        }
    };
}

/**
 * Seed default roles and permissions into the database
 */
export async function seedRBAC(): Promise<void> {
    try {
        // Check if roles already exist
        const existingRoles = await prisma.role.count();
        if (existingRoles > 0) {
            logger.info('RBAC already seeded');
            return;
        }

        // Create system roles
        const ownerRole = await prisma.role.create({
            data: {
                name: 'owner',
                description: 'Full system access',
                isSystem: true,
            },
        });

        const adminRole = await prisma.role.create({
            data: {
                name: 'admin',
                description: 'Administrative access',
                isSystem: true,
            },
        });

        const managerRole = await prisma.role.create({
            data: {
                name: 'manager',
                description: 'Management access',
                isSystem: true,
            },
        });

        const employeeRole = await prisma.role.create({
            data: {
                name: 'employee',
                description: 'Standard employee access',
                isSystem: true,
            },
        });

        const viewerRole = await prisma.role.create({
            data: {
                name: 'viewer',
                description: 'Read-only access',
                isSystem: true,
            },
        });

        // Create all permissions
        const permissionsData = Object.values(SystemPermissions).map((perm: string) => ({
            name: perm,
            category: perm.split(':')[0],
        }));

        await prisma.permission.createMany({
            data: permissionsData,
            skipDuplicates: true,
        });

        // Get all permissions
        const allPermissions = await prisma.permission.findMany();

        // Assign all permissions to owner
        await prisma.rolePermission.createMany({
            data: allPermissions.map((p: { id: string }) => ({
                roleId: ownerRole.id,
                permissionId: p.id,
            })),
        });

        // Assign most permissions to admin (except user roles management)
        const adminPermissions = allPermissions.filter(
            (p: { name: string }) => p.name !== SystemPermissions.ALL_ACCESS
        );
        await prisma.rolePermission.createMany({
            data: adminPermissions.map((p: { id: string }) => ({
                roleId: adminRole.id,
                permissionId: p.id,
            })),
        });

        // Assign limited permissions to manager
        const managerPermissionNames = [
            SystemPermissions.SALES_VIEW,
            SystemPermissions.SALES_CREATE,
            SystemPermissions.INVENTORY_VIEW,
            SystemPermissions.INVENTORY_CREATE,
            SystemPermissions.INVENTORY_EDIT,
            SystemPermissions.PRODUCTS_VIEW,
            SystemPermissions.PRODUCTS_CREATE,
            SystemPermissions.PRODUCTS_EDIT,
            SystemPermissions.CUSTOMERS_VIEW,
            SystemPermissions.CUSTOMERS_CREATE,
            SystemPermissions.SUPPLIERS_VIEW,
            SystemPermissions.REPORTS_VIEW,
            SystemPermissions.REPORTS_EXPORT,
        ];
        const managerPermissions = allPermissions.filter((p: { name: string }) =>
            managerPermissionNames.includes(p.name as PermissionName)
        );
        await prisma.rolePermission.createMany({
            data: managerPermissions.map((p: { id: string }) => ({
                roleId: managerRole.id,
                permissionId: p.id,
            })),
        });

        // Assign basic permissions to employee
        const employeePermissionNames = [
            SystemPermissions.SALES_VIEW,
            SystemPermissions.SALES_CREATE,
            SystemPermissions.INVENTORY_VIEW,
            SystemPermissions.PRODUCTS_VIEW,
            SystemPermissions.CUSTOMERS_VIEW,
        ];
        const employeePermissions = allPermissions.filter((p: { name: string }) =>
            employeePermissionNames.includes(p.name as PermissionName)
        );
        await prisma.rolePermission.createMany({
            data: employeePermissions.map((p: { id: string }) => ({
                roleId: employeeRole.id,
                permissionId: p.id,
            })),
        });

        // Assign read-only permissions to viewer
        const viewerPermissions = allPermissions.filter((p: { name: string }) =>
            p.name.endsWith(':view')
        );
        await prisma.rolePermission.createMany({
            data: viewerPermissions.map((p: { id: string }) => ({
                roleId: viewerRole.id,
                permissionId: p.id,
            })),
        });

        logger.info('RBAC seeded successfully');
    } catch (error) {
        logger.error('Error seeding RBAC', { error });
        throw error;
    }
}

/**
 * Get user's effective permissions (from all their roles)
 */
export async function getUserPermissions(userId: string): Promise<string[]> {
    try {
        const user = await prisma.user.findUnique({
            where: { id: userId },
            include: {
                userRoles: {
                    include: {
                        role: {
                            include: {
                                permissions: {
                                    include: {
                                        permission: true,
                                    },
                                },
                            },
                        },
                    },
                },
            },
        });

        if (!user) return [];

        // Owner gets all permissions
        if (user.role === 'owner') {
            const allPerms = await prisma.permission.findMany();
            return allPerms.map((p: { name: string }) => p.name);
        }

        const permissions = new Set<string>();

        for (const userRole of user.userRoles) {
            for (const rp of userRole.role.permissions) {
                permissions.add(rp.permission.name);
            }
        }

        return Array.from(permissions);
    } catch (error) {
        logger.error('Error getting user permissions', { userId, error });
        return [];
    }
}
