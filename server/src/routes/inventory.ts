// ============================================================
// ELAHMED RETAIL SUITE — Inventory Routes
// ============================================================

import { Prisma } from '@prisma/client';
import { Router, Response } from 'express';
import prisma from '../lib/prisma.js';
import { AuthRequest } from '../middleware/auth.js';

const router = Router();

// Get inventory summary
router.get('/summary', async (req: AuthRequest, res: Response) => {
    try {
        const [totalProducts, quantitySummary, inventoryProducts, lowStock, categories] = await Promise.all([
            prisma.product.count({ where: { deletedAt: null } }),
            prisma.product.aggregate({
                _sum: { quantity: true },
                where: { deletedAt: null },
            }),
            prisma.product.findMany({
                where: { deletedAt: null },
                select: {
                    quantity: true,
                    costPrice: true,
                },
            }),
            prisma.product.count({
                where: {
                    deletedAt: null,
                    quantity: { lt: 5 },
                },
            }),
            prisma.product.groupBy({
                by: ['category'],
                _count: { id: true },
                _sum: { quantity: true },
                where: { deletedAt: null },
            }),
        ]);

        const totalValue = inventoryProducts.reduce(
            (sum: number, product: { costPrice: Prisma.Decimal; quantity: number }) =>
                sum + Number(product.costPrice) * product.quantity,
            0
        );

        res.json({
            totalProducts,
            totalQuantity: quantitySummary._sum.quantity || 0,
            totalValue,
            lowStock,
            byCategory: categories.map((c: {
                category: string;
                _count: { id: number };
                _sum: { quantity: number | null };
            }) => ({
                category: c.category,
                count: c._count.id,
                quantity: c._sum.quantity || 0,
            })),
        });
    } catch (error) {
        console.error('Get inventory summary error:', error);
        res.status(500).json({ error: 'Failed to get inventory summary' });
    }
});

// Get stock movements
router.get('/movements', async (req: AuthRequest, res: Response) => {
    try {
        const { productId, type, startDate, endDate, page = 1, limit = 100 } = req.query;

        const where: Prisma.StockMovementWhereInput = {};

        if (productId) where.productId = productId;
        if (type) where.type = type;

        if (startDate || endDate) {
            where.createdAt = {};
            if (startDate) where.createdAt.gte = new Date(startDate as string);
            if (endDate) where.createdAt.lte = new Date(endDate as string);
        }

        const [movements, total] = await Promise.all([
            prisma.stockMovement.findMany({
                where,
                skip: (Number(page) - 1) * Number(limit),
                take: Number(limit),
                orderBy: { createdAt: 'desc' },
                include: {
                    product: {
                        select: { id: true, name: true, barcode: true },
                    },
                    user: {
                        select: { id: true, username: true, fullName: true },
                    },
                },
            }),
            prisma.stockMovement.count({ where }),
        ]);

        res.json({
            movements,
            pagination: {
                page: Number(page),
                limit: Number(limit),
                total,
                pages: Math.ceil(total / Number(limit)),
            },
        });
    } catch (error) {
        console.error('Get movements error:', error);
        res.status(500).json({ error: 'Failed to get movements' });
    }
});

// Manual stock adjustment
router.post('/adjust', async (req: AuthRequest, res: Response) => {
    const userId = req.user?.id;
    if (!userId) {
        res.status(401).json({ error: 'Not authenticated' });
        return;
    }

    try {
        const { productId, quantity, reason } = req.body;

        if (!productId || quantity === undefined || !reason) {
            res.status(400).json({ error: 'Product, quantity, and reason required' });
            return;
        }

        const adjustment = Number(quantity);
        if (!Number.isFinite(adjustment) || adjustment === 0) {
            res.status(400).json({ error: 'Quantity must be a non-zero number' });
            return;
        }

        const product = await prisma.product.findUnique({ where: { id: productId } });
        if (!product || product.deletedAt) {
            res.status(404).json({ error: 'Product not found' });
            return;
        }

        const newQty = product.quantity + adjustment;
        if (newQty < 0) {
            res.status(400).json({ error: 'Insufficient stock' });
            return;
        }

        const result = await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
            const updated = await tx.product.update({
                where: { id: productId },
                data: { quantity: newQty },
            });

            await tx.stockMovement.create({
                data: {
                    productId,
                    type: 'manual_adjustment',
                    quantityChange: adjustment,
                    previousQty: product.quantity,
                    newQty: updated.quantity,
                    reason,
                    userId,
                },
            });

            return updated;
        });

        res.json(result);
    } catch (error) {
        console.error('Stock adjustment error:', error);
        res.status(500).json({ error: 'Failed to adjust stock' });
    }
});

// Get audit logs
router.get('/audit', async (req: AuthRequest, res: Response) => {
    try {
        const { userId, action, entityType, startDate, endDate, page = 1, limit = 100 } = req.query;

        const where: Prisma.AuditLogWhereInput = {};

        if (userId) where.userId = userId;
        if (action) where.action = action;
        if (entityType) where.entityType = entityType;

        if (startDate || endDate) {
            where.createdAt = {};
            if (startDate) where.createdAt.gte = new Date(startDate as string);
            if (endDate) where.createdAt.lte = new Date(endDate as string);
        }

        const [logs, total] = await Promise.all([
            prisma.auditLog.findMany({
                where,
                skip: (Number(page) - 1) * Number(limit),
                take: Number(limit),
                orderBy: { createdAt: 'desc' },
                include: {
                    user: {
                        select: { id: true, username: true, fullName: true },
                    },
                },
            }),
            prisma.auditLog.count({ where }),
        ]);

        res.json({
            logs,
            pagination: {
                page: Number(page),
                limit: Number(limit),
                total,
                pages: Math.ceil(total / Number(limit)),
            },
        });
    } catch (error) {
        console.error('Get audit logs error:', error);
        res.status(500).json({ error: 'Failed to get audit logs' });
    }
});

export default router;
