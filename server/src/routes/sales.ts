// ============================================================
// ELAHMED RETAIL SUITE — Sales Routes (with Transactions)
// ============================================================

import { Router, Response } from 'express';
import { PaymentMethod, Prisma } from '@prisma/client';
import prisma from '../lib/prisma.js';
import { AuthRequest } from '../middleware/auth.js';

const router = Router();

interface SaleRequestItem {
    productId: string;
    qty: number;
    discount?: number;
}

type SaleResponsePayload = Prisma.SaleGetPayload<{
    include: {
        items: true;
        employee: {
            select: {
                id: true;
                username: true;
                fullName: true;
            };
        };
    };
}>;

function getErrorMessage(error: unknown, fallback: string): string {
    if (error instanceof Error && error.message) {
        return error.message;
    }

    return fallback;
}

function isInvoiceConflictError(error: unknown): boolean {
    if (!error || typeof error !== 'object') {
        return false;
    }

    const prismaError = error as {
        code?: unknown;
        meta?: {
            target?: unknown;
        };
    };

    const rawTargets = prismaError.meta?.target;
    const conflictTargets = Array.isArray(rawTargets)
        ? rawTargets.map(String)
        : rawTargets ? [String(rawTargets)] : [];

    return prismaError.code === 'P2002' && conflictTargets.includes('invoiceNumber');
}

async function getNextInvoiceNumber(tx: Prisma.TransactionClient, year: number): Promise<string> {
    const prefix = `INV-${year}-`;
    const latestSale = await tx.sale.findFirst({
        where: {
            invoiceNumber: { startsWith: prefix },
        },
        orderBy: { invoiceNumber: 'desc' },
        select: { invoiceNumber: true },
    });

    const currentSequence = latestSale?.invoiceNumber.split('-').pop();
    const nextSequence = (currentSequence ? Number(currentSequence) : 0) + 1;

    return `${prefix}${String(nextSequence).padStart(4, '0')}`;
}

// Get all sales
router.get('/', async (req: AuthRequest, res: Response) => {
    try {
        const { startDate, endDate, paymentMethod, voided, page = 1, limit = 50 } = req.query;

        const where: Prisma.SaleWhereInput = {};

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
        const {
            items,
            discount = 0,
            paymentMethod,
        }: {
            items?: SaleRequestItem[];
            discount?: number;
            paymentMethod?: PaymentMethod;
        } = req.body;

        if (!items || !Array.isArray(items) || items.length === 0) {
            res.status(400).json({ error: 'Items required' });
            return;
        }

        const parsedItems = items.map((item) => ({
            ...item,
            qty: Number(item.qty),
            discount: Number(item.discount || 0),
        }));

        if (parsedItems.some(item => !item.productId || !Number.isInteger(item.qty) || item.qty <= 0)) {
            res.status(400).json({ error: 'Each sale item must include a valid product and quantity' });
            return;
        }

        let result: SaleResponsePayload | null = null;

        for (let attempt = 0; attempt < 5; attempt += 1) {
            try {
                result = await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
                    // 1. Validate stock and calculate totals with optimistic locking
                    let subtotal = 0;
                    let totalCost = 0;
                    const saleItems: Prisma.SaleItemCreateWithoutSaleInput[] = [];

                    for (const item of parsedItems) {
                        // Use findUnique with forUpdate to lock the row
                        const product = await tx.product.findUnique({
                            where: { id: item.productId },
                        });

                        if (!product || product.deletedAt) {
                            throw new Error(`Product not found: ${item.productId}`);
                        }

                        // Optimistic locking check
                        if (product.quantity < item.qty) {
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
                        const batchDeductions: Array<{ batchId: string; qty: number; version: number }> = [];

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
                                throw new Error('Concurrent modification detected for batch');
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
                            product: { connect: { id: product.id } },
                            name: product.name,
                            qty: item.qty,
                            price: product.sellingPrice,
                            cost: itemCost / item.qty,
                            lineDiscount: item.discount || 0,
                        });
                    }

                    const normalizedDiscount = Number(discount);
                    const total = subtotal - normalizedDiscount;
                    const grossProfit = total - totalCost;
                    const marginPct = total > 0 ? (grossProfit / total) * 100 : 0;
                    const year = new Date().getFullYear();
                    const invoiceNumber = await getNextInvoiceNumber(tx, year);

                    // Create sale
                    const sale = await tx.sale.create({
                        data: {
                            invoiceNumber,
                            subtotal,
                            discount: normalizedDiscount,
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
                    for (const item of parsedItems) {
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

                break;
            } catch (error) {
                if (!isInvoiceConflictError(error) || attempt === 4) {
                    throw error;
                }
            }
        }

        if (!result) {
            throw new Error('Failed to create sale after retrying invoice generation');
        }

        res.status(201).json(result);
    } catch (error: unknown) {
        console.error('Create sale error:', error);
        res.status(400).json({ error: getErrorMessage(error, 'Failed to create sale') });
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

        const result = await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
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
                const saleProduct = await tx.product.findUnique({
                    where: { id: item.productId },
                    select: { quantity: true },
                });

                if (!saleProduct) {
                    throw new Error(`Product ${item.productId} not found while voiding sale`);
                }

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
                        previousQty: saleProduct.quantity,
                        newQty: saleProduct.quantity + item.qty,
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
    } catch (error: unknown) {
        console.error('Void sale error:', error);
        res.status(400).json({ error: getErrorMessage(error, 'Failed to void sale') });
    }
});

export default router;
