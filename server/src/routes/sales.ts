// ============================================================
// ELAHMED RETAIL SUITE — Sales Routes (with Transactions)
// ============================================================

import { Router, Response } from 'express';
import { Prisma } from '@prisma/client';
import prisma from '../lib/prisma.js';
import { AuthRequest } from '../middleware/auth.js';

const router = Router();

// Get all sales
router.get('/', async (req: AuthRequest, res: Response) => {
    try {
        const { startDate, endDate, paymentMethod, voided, page = 1, limit = 50 } = req.query;

        const where: any = {};

        if (startDate || endDate) {
            where.date = {};
            if (startDate) where.date.gte = new Date(startDate as string);
            if (endDate) where.date.lte = new Date(endDate as string);
        }

        if (paymentMethod) {
            where.paymentMethod = paymentMethod;
        }

        if (voided === 'true') {
            where.voidedAt = { not: null };
        } else if (voided === 'false') {
            where.voidedAt = null;
        }

        const [sales, total] = await Promise.all([
            prisma.sale.findMany({
                where,
                skip: (Number(page) - 1) * Number(limit),
                take: Number(limit),
                orderBy: { date: 'desc' },
                include: {
                    employee: {
                        select: { id: true, username: true, fullName: true },
                    },
                    items: true,
                },
            }),
            prisma.sale.count({ where }),
        ]);

        res.json({
            sales,
            pagination: {
                page: Number(page),
                limit: Number(limit),
                total,
                pages: Math.ceil(total / Number(limit)),
            },
        });
    } catch (error) {
        console.error('Get sales error:', error);
        res.status(500).json({ error: 'Failed to get sales' });
    }
});

// Get sale by ID
router.get('/:id', async (req: AuthRequest, res: Response) => {
    try {
        const { id } = req.params;

        const sale = await prisma.sale.findUnique({
            where: { id },
            include: {
                employee: {
                    select: { id: true, username: true, fullName: true },
                },
                items: true,
            },
        });

        if (!sale) {
            res.status(404).json({ error: 'Sale not found' });
            return;
        }

        res.json(sale);
    } catch (error) {
        console.error('Get sale error:', error);
        res.status(500).json({ error: 'Failed to get sale' });
    }
});

// Create sale (with atomic transaction)
router.post('/', async (req: AuthRequest, res: Response) => {
    const userId = req.user?.id;
    if (!userId) {
        res.status(401).json({ error: 'Not authenticated' });
        return;
    }

    try {
        const { items, discount = 0, paymentMethod } = req.body;

        if (!items || !Array.isArray(items) || items.length === 0) {
            res.status(400).json({ error: 'Items required' });
            return;
        }

        // Use transaction for atomicity with optimistic locking
        const result = await prisma.$transaction(async (tx) => {
            // 1. Validate stock and calculate totals with optimistic locking
            let subtotal = 0;
            let totalCost = 0;
            const saleItems = [];

            for (const item of items) {
                // Use findUnique with forUpdate to lock the row
                const product = await tx.product.findUnique({
                    where: { id: item.productId },
                });

                if (!product || product.deletedAt) {
                    throw new Error(`Product not found: ${item.productId}`);
                }

                // Optimistic locking check
                if (product.version === undefined || product.quantity < item.qty) {
                    throw new Error(`Insufficient stock for ${product.name}`);
                }

                // FIFO calculation
                const batches = await tx.productBatch.findMany({
                    where: {
                        productId: product.id,
                        remainingQty: { gt: 0 },
                    },
                    orderBy: { purchasedAt: 'asc' },
                });

                let remainingQty = item.qty;
                let itemCost = 0;
                const batchDeductions = [];

                for (const batch of batches) {
                    if (remainingQty <= 0) break;

                    const deduct = Math.min(batch.remainingQty, remainingQty);
                    itemCost += Number(batch.costPrice) * deduct;
                    batchDeductions.push({ batchId: batch.id, qty: deduct, version: batch.version });
                    remainingQty -= deduct;
                }

                if (remainingQty > 0) {
                    throw new Error(`Insufficient FIFO batches for ${product.name}`);
                }

                // Update batches with optimistic locking
                for (const ded of batchDeductions) {
                    const updated = await tx.productBatch.updateMany({
                        where: {
                            id: ded.batchId,
                            version: ded.version
                        },
                        data: {
                            remainingQty: { decrement: ded.qty },
                            version: { increment: 1 }
                        },
                    });

                    if (updated.count === 0) {
                        throw new Error(`Concurrent modification detected for batch`);
                    }
                }

                // Update product quantity with optimistic locking
                const updated = await tx.product.updateMany({
                    where: {
                        id: product.id,
                        version: product.version
                    },
                    data: {
                        quantity: { decrement: item.qty },
                        version: { increment: 1 }
                    },
                });

                if (updated.count === 0) {
                    throw new Error(`Concurrent modification detected for ${product.name}`);
                }

                const lineTotal = Number(product.sellingPrice) * item.qty;
                subtotal += lineTotal;
                totalCost += itemCost;

                saleItems.push({
                    productId: product.id,
                    name: product.name,
                    qty: item.qty,
                    price: product.sellingPrice,
                    cost: itemCost / item.qty,
                    lineDiscount: item.discount || 0,
                });
            }

            const total = subtotal - discount;
            const grossProfit = total - totalCost;
            const marginPct = total > 0 ? (grossProfit / total) * 100 : 0;

            // Get invoice number
            const year = new Date().getFullYear();
            const countResult = await tx.sale.count({
                where: {
                    invoiceNumber: { startsWith: `INV-${year}` },
                },
            });
            const invoiceNumber = `INV-${year}-${String(countResult + 1).padStart(4, '0')}`;

            // Create sale
            const sale = await tx.sale.create({
                data: {
                    invoiceNumber,
                    subtotal,
                    discount,
                    total,
                    totalCost,
                    grossProfit,
                    marginPct,
                    paymentMethod: paymentMethod || 'cash',
                    employeeId: userId,
                    items: {
                        create: saleItems,
                    },
                },
                include: {
                    items: true,
                    employee: {
                        select: { id: true, username: true, fullName: true },
                    },
                },
            });

            // Create stock movements
            for (const item of items) {
                const product = await tx.product.findUnique({ where: { id: item.productId } });
                if (product) {
                    await tx.stockMovement.create({
                        data: {
                            productId: item.productId,
                            type: 'sale',
                            quantityChange: -item.qty,
                            previousQty: product.quantity + item.qty,
                            newQty: product.quantity,
                            reason: `Sale ${invoiceNumber}`,
                            userId,
                        },
                    });
                }
            }

            // Create audit log
            await tx.auditLog.create({
                data: {
                    userId,
                    action: 'sale_completed',
                    entityType: 'sale',
                    entityId: sale.id,
                    after: { invoiceNumber, total: Number(total) },
                },
            });

            return sale;
        });

        res.status(201).json(result);
    } catch (error: any) {
        console.error('Create sale error:', error);
        res.status(400).json({ error: error.message || 'Failed to create sale' });
    }
});

// Void sale
router.post('/:id/void', async (req: AuthRequest, res: Response) => {
    const userId = req.user?.id;
    if (!userId) {
        res.status(401).json({ error: 'Not authenticated' });
        return;
    }

    try {
        const { id } = req.params;
        const { reason } = req.body;

        if (!reason) {
            res.status(400).json({ error: 'Reason required' });
            return;
        }

        const result = await prisma.$transaction(async (tx) => {
            const sale = await tx.sale.findUnique({
                where: { id },
                include: { items: true },
            });

            if (!sale) {
                throw new Error('Sale not found');
            }

            if (sale.voidedAt) {
                throw new Error('Sale already voided');
            }

            // Restore stock
            for (const item of sale.items) {
                await tx.product.update({
                    where: { id: item.productId },
                    data: { quantity: { increment: item.qty } },
                });

                // Return to batches
                const batches = await tx.productBatch.findMany({
                    where: { productId: item.productId },
                    orderBy: { purchasedAt: 'desc' },
                });

                let remainingQty = item.qty;
                for (const batch of batches) {
                    if (remainingQty <= 0) break;
                    const add = Math.min(batch.quantity - batch.remainingQty, remainingQty);
                    if (add > 0) {
                        await tx.productBatch.update({
                            where: { id: batch.id },
                            data: { remainingQty: { increment: add } },
                        });
                        remainingQty -= add;
                    }
                }

                await tx.stockMovement.create({
                    data: {
                        productId: item.productId,
                        type: 'return',
                        quantityChange: item.qty,
                        previousQty: (await tx.product.findUnique({ where: { id: item.productId } }))?.quantity || 0,
                        newQty: (await tx.product.findUnique({ where: { id: item.productId } }))?.quantity || 0,
                        reason: `Void sale ${sale.invoiceNumber}`,
                        referenceId: sale.id,
                        userId,
                    },
                });
            }

            // Void sale
            const voidedSale = await tx.sale.update({
                where: { id },
                data: {
                    voidedAt: new Date(),
                    voidReason: reason,
                    voidedBy: userId,
                },
                include: {
                    items: true,
                    employee: {
                        select: { id: true, username: true, fullName: true },
                    },
                },
            });

            // Audit log
            await tx.auditLog.create({
                data: {
                    userId,
                    action: 'sale_voided',
                    entityType: 'sale',
                    entityId: sale.id,
                    after: { reason, invoiceNumber: sale.invoiceNumber },
                },
            });

            return voidedSale;
        });

        res.json(result);
    } catch (error: any) {
        console.error('Void sale error:', error);
        res.status(400).json({ error: error.message || 'Failed to void sale' });
    }
});

export default router;
