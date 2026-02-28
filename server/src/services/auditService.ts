// ============================================================
// ELAHMED RETAIL SUITE — Immutable Audit Log Service
// ============================================================

import prisma from '../lib/prisma.js';
import logger from '../lib/logger.js';

/**
 * Audit action types
 */
export const AuditAction = {
    // User actions
    USER_LOGIN: 'user.login',
    USER_LOGOUT: 'user.logout',
    USER_CREATE: 'user.create',
    USER_UPDATE: 'user.update',
    USER_DELETE: 'user.delete',
    USER_ACTIVATE: 'user.activate',
    USER_DEACTIVATE: 'user.deactivate',
    USER_PASSWORD_CHANGE: 'user.password_change',

    // Role actions
    ROLE_CREATE: 'role.create',
    ROLE_UPDATE: 'role.update',
    ROLE_DELETE: 'role.delete',
    ROLE_ASSIGN: 'role.assign',
    ROLE_REMOVE: 'role.remove',

    // Product actions
    PRODUCT_CREATE: 'product.create',
    PRODUCT_UPDATE: 'product.update',
    PRODUCT_DELETE: 'product.delete',
    PRODUCT_IMPORT: 'product.import',

    // Inventory actions
    INVENTORY_ADJUST: 'inventory.adjust',
    INVENTORY_TRANSFER: 'inventory.transfer',
    STOCK_MOVEMENT: 'stock.movement',

    // Sales actions
    SALE_CREATE: 'sale.create',
    SALE_VOID: 'sale.void',
    SALE_REFUND: 'sale.refund',

    // Settings actions
    SETTINGS_UPDATE: 'settings.update',

    // Report actions
    REPORT_GENERATE: 'report.generate',
    REPORT_EXPORT: 'report.export',
} as const;

export type AuditActionType = typeof AuditAction[keyof typeof AuditAction];

/**
 * Entity types for audit logs
 */
export const EntityType = {
    USER: 'user',
    ROLE: 'role',
    PERMISSION: 'permission',
    PRODUCT: 'product',
    SALE: 'sale',
    CUSTOMER: 'supplier',
    SETTINGS: 'settings',
    REPORT: 'report',
    INVENTORY: 'inventory',
} as const;

/**
 * Create an immutable audit log entry
 * NOTE: This function does NOT allow updates or deletes - audit logs are append-only
 */
export async function createAuditLog(params: {
    userId: string;
    action: string;
    entityType: string;
    entityId?: string;
    description?: string;
    ipAddress?: string;
    userAgent?: string;
    before?: Record<string, unknown>;
    after?: Record<string, unknown>;
}): Promise<{ id: string }> {
    try {
        // Validate that we're creating (not updating) - audit logs are immutable
        const auditLog = await prisma.auditLog.create({
            data: {
                userId: params.userId,
                action: params.action,
                entityType: params.entityType,
                entityId: params.entityId,
                description: params.description,
                ipAddress: params.ipAddress,
                userAgent: params.userAgent,
                before: params.before as unknown as Record<string, unknown>,
                after: params.after as unknown as Record<string, unknown>,
            },
        });

        logger.info('Audit log created', {
            id: auditLog.id,
            userId: params.userId,
            action: params.action,
            entityType: params.entityType,
        });

        return { id: auditLog.id };
    } catch (error) {
        logger.error('Error creating audit log', { error, params });
        throw error;
    }
}

/**
 * Query audit logs with filters
 */
export async function queryAuditLogs(params: {
    userId?: string;
    action?: string;
    entityType?: string;
    entityId?: string;
    startDate?: Date;
    endDate?: Date;
    limit?: number;
    offset?: number;
}): Promise<{
    data: Array<{
        id: string;
        userId: string;
        action: string;
        entityType: string;
        entityId: string | null;
        description: string | null;
        ipAddress: string | null;
        userAgent: string | null;
        before: Record<string, unknown> | null;
        after: Record<string, unknown> | null;
        createdAt: Date;
    }>;
    total: number;
}> {
    try {
        const { userId, action, entityType, entityId, startDate, endDate, limit = 50, offset = 0 } = params;

        // Build where clause
        const where: Record<string, unknown> = {};

        if (userId) where.userId = userId;
        if (action) where.action = action;
        if (entityType) where.entityType = entityType;
        if (entityId) where.entityId = entityId;

        if (startDate || endDate) {
            where.createdAt = {};
            if (startDate) (where.createdAt as Record<string, Date>).gte = startDate;
            if (endDate) (where.createdAt as Record<string, Date>).lte = endDate;
        }

        // Get total count
        const total = await prisma.auditLog.count({ where });

        // Get paginated data
        const data = await prisma.auditLog.findMany({
            where,
            orderBy: { createdAt: 'desc' },
            take: limit,
            skip: offset,
        });

        return {
            data: data.map(log => ({
                id: log.id,
                userId: log.userId,
                action: log.action,
                entityType: log.entityType,
                entityId: log.entityId,
                description: log.description,
                ipAddress: log.ipAddress,
                userAgent: log.userAgent,
                before: log.before as Record<string, unknown> | null,
                after: log.after as Record<string, unknown> | null,
                createdAt: log.createdAt,
            })),
            total,
        };
    } catch (error) {
        logger.error('Error querying audit logs', { error, params });
        throw error;
    }
}

/**
 * Get audit logs for a specific entity
 */
export async function getEntityAuditTrail(
    entityType: string,
    entityId: string
): Promise<Array<{
    id: string;
    action: string;
    description: string | null;
    userId: string;
    before: Record<string, unknown> | null;
    after: Record<string, unknown> | null;
    createdAt: Date;
}>> {
    try {
        const logs = await prisma.auditLog.findMany({
            where: {
                entityType,
                entityId,
            },
            orderBy: { createdAt: 'asc' },
        });

        return logs.map(log => ({
            id: log.id,
            action: log.action,
            description: log.description,
            userId: log.userId,
            before: log.before as Record<string, unknown> | null,
            after: log.after as Record<string, unknown> | null,
            createdAt: log.createdAt,
        }));
    } catch (error) {
        logger.error('Error getting entity audit trail', { error, entityType, entityId });
        throw error;
    }
}

/**
 * Get all actions performed by a user
 */
export async function getUserActivity(
    userId: string,
    limit: number = 50
): Promise<Array<{
    id: string;
    action: string;
    entityType: string;
    entityId: string | null;
    description: string | null;
    createdAt: Date;
}>> {
    try {
        const logs = await prisma.auditLog.findMany({
            where: { userId },
            orderBy: { createdAt: 'desc' },
            take: limit,
        });

        return logs.map(log => ({
            id: log.id,
            action: log.action,
            entityType: log.entityType,
            entityId: log.entityId,
            description: log.description,
            createdAt: log.createdAt,
        }));
    } catch (error) {
        logger.error('Error getting user activity', { error, userId });
        throw error;
    }
}

/**
 * Get audit statistics
 */
export async function getAuditStats(params: {
    startDate?: Date;
    endDate?: Date;
}): Promise<{
    totalLogs: number;
    uniqueUsers: number;
    actionsByType: Record<string, number>;
    actionsByEntity: Record<string, number>;
}> {
    try {
        const { startDate, endDate } = params;

        const where: Record<string, unknown> = {};

        if (startDate || endDate) {
            where.createdAt = {};
            if (startDate) (where.createdAt as Record<string, Date>).gte = startDate;
            if (endDate) (where.createdAt as Record<string, Date>).lte = endDate;
        }

        const [totalLogs, uniqueUsers, actionCounts] = await Promise.all([
            prisma.auditLog.count({ where }),
            prisma.auditLog.findMany({
                where,
                distinct: ['userId'],
                select: { userId: true },
            }),
            prisma.auditLog.groupBy({
                by: ['action'],
                where,
                _count: { action: true },
            }),
        ]);

        const entityCounts = await prisma.auditLog.groupBy({
            by: ['entityType'],
            where,
            _count: { entityType: true },
        });

        const actionsByType = actionCounts.reduce((acc, curr) => {
            acc[curr.action] = curr._count.action;
            return acc;
        }, {} as Record<string, number>);

        const actionsByEntity = entityCounts.reduce((acc, curr) => {
            acc[curr.entityType] = curr._count.entityType;
            return acc;
        }, {} as Record<string, number>);

        return {
            totalLogs,
            uniqueUsers: uniqueUsers.length,
            actionsByType,
            actionsByEntity,
        };
    } catch (error) {
        logger.error('Error getting audit stats', { error, params });
        throw error;
    }
}

/**
 * Search audit logs by keyword
 */
export async function searchAuditLogs(
    searchTerm: string,
    limit: number = 50
): Promise<Array<{
    id: string;
    userId: string;
    action: string;
    entityType: string;
    entityId: string | null;
    description: string | null;
    createdAt: Date;
}>> {
    try {
        // Search in description, entityType, action
        const logs = await prisma.auditLog.findMany({
            where: {
                OR: [
                    { description: { contains: searchTerm, mode: 'insensitive' } },
                    { entityType: { contains: searchTerm, mode: 'insensitive' } },
                    { action: { contains: searchTerm, mode: 'insensitive' } },
                ],
            },
            orderBy: { createdAt: 'desc' },
            take: limit,
        });

        return logs.map(log => ({
            id: log.id,
            userId: log.userId,
            action: log.action,
            entityType: log.entityType,
            entityId: log.entityId,
            description: log.description,
            createdAt: log.createdAt,
        }));
    } catch (error) {
        logger.error('Error searching audit logs', { error, searchTerm });
        throw error;
    }
}

/**
 * Middleware helper to automatically log actions
 */
export function auditMiddleware(
    action: string,
    entityType: string,
    getEntityId?: (req: any) => string | undefined,
    getDescription?: (req: any, before?: unknown, after?: unknown) => string
) {
    return async (req: any, res: any, next: any) => {
        // Store original json method
        const originalJson = res.json.bind(res);

        // Override json to log after successful response
        res.json = function (data: any) {
            // Only log on successful responses
            if (res.statusCode >= 200 && res.statusCode < 300 && req.user) {
                const entityId = getEntityId ? getEntityId(req) : undefined;
                const description = getDescription ? getDescription(req, req.body?.before, req.body?.after) : undefined;

                createAuditLog({
                    userId: req.user.id,
                    action,
                    entityType,
                    entityId,
                    description,
                    ipAddress: req.ip || req.connection?.remoteAddress,
                    userAgent: req.headers['user-agent'],
                    before: req.body?.before,
                    after: req.body?.after || data,
                }).catch(err => logger.error('Failed to create audit log in middleware', { error: err }));
            }

            return originalJson(data);
        };

        next();
    };
}

export default {
    createAuditLog,
    queryAuditLogs,
    getEntityAuditTrail,
    getUserActivity,
    getAuditStats,
    searchAuditLogs,
    auditMiddleware,
    AuditAction,
    EntityType,
};
