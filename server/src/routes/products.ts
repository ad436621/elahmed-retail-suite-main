// ============================================================
// ELAHMED RETAIL SUITE — Products Routes
// ============================================================

import { Router, Response } from 'express';
import prisma from '../lib/prisma.js';
import { AuthRequest } from '../middleware/auth.js';

const router = Router();

// Get all products
router.get('/', async (req: AuthRequest, res: Response) => {
    try {
        const { category, search, page = 1, limit = 50 } = req.query;

        const where: any = { deletedAt: null };

        if (category) {
            where.category = category;
        }

        if (search) {
            where.OR = [
                { name: { contains: search as string, mode: 'insensitive' } },
                { barcode: { contains: search as string, mode: 'insensitive' } },
                { model: { contains: search as string, mode: 'insensitive' } },
            ];
        }

        const [products, total] = await Promise.all([
            prisma.product.findMany({
                where,
                skip: (Number(page) - 1) * Number(limit),
                take: Number(limit),
                orderBy: { createdAt: 'desc' },
            }),
            prisma.product.count({ where }),
        ]);

        res.json({
            products,
            pagination: {
                page: Number(page),
                limit: Number(limit),
                total,
                pages: Math.ceil(total / Number(limit)),
            },
        });
    } catch (error) {
        console.error('Get products error:', error);
        res.status(500).json({ error: 'Failed to get products' });
    }
});

// Get product by ID
router.get('/:id', async (req: AuthRequest, res: Response) => {
    try {
        const { id } = req.params;

        const product = await prisma.product.findUnique({
            where: { id },
            include: {
                batches: {
                    where: { remainingQty: { gt: 0 } },
                    orderBy: { purchasedAt: 'asc' },
                },
            },
        });

        if (!product || product.deletedAt) {
            res.status(404).json({ error: 'Product not found' });
            return;
        }

        res.json(product);
    } catch (error) {
        console.error('Get product error:', error);
        res.status(500).json({ error: 'Failed to get product' });
    }
});

// Create product
router.post('/', async (req: AuthRequest, res: Response) => {
    try {
        const {
            name, model, barcode, category, supplier,
            costPrice, sellingPrice, quantity, minimumMarginPct
        } = req.body;

        if (!name || !barcode || !category) {
            res.status(400).json({ error: 'Name, barcode, and category required' });
            return;
        }

        // Check for duplicate barcode
        const existing = await prisma.product.findUnique({
            where: { barcode },
        });

        if (existing) {
            res.status(400).json({ error: 'Barcode already exists' });
            return;
        }

        const product = await prisma.product.create({
            data: {
                name,
                model: model || '',
                barcode,
                category,
                supplier: supplier || '',
                costPrice: costPrice || 0,
                sellingPrice: sellingPrice || 0,
                quantity: quantity || 0,
                minimumMarginPct: minimumMarginPct || 0,
            },
        });

        // Create initial batch if quantity > 0
        if (quantity > 0 && costPrice) {
            await prisma.productBatch.create({
                data: {
                    productId: product.id,
                    costPrice,
                    quantity: quantity,
                    remainingQty: quantity,
                },
            });
        }

        res.status(201).json(product);
    } catch (error) {
        console.error('Create product error:', error);
        res.status(500).json({ error: 'Failed to create product' });
    }
});

// Update product
router.put('/:id', async (req: AuthRequest, res: Response) => {
    try {
        const { id } = req.params;
        const {
            name, model, barcode, category, supplier,
            costPrice, sellingPrice, quantity, minimumMarginPct
        } = req.body;

        const existing = await prisma.product.findUnique({ where: { id } });
        if (!existing || existing.deletedAt) {
            res.status(404).json({ error: 'Product not found' });
            return;
        }

        // Check barcode uniqueness if changed
        if (barcode && barcode !== existing.barcode) {
            const barcodeExists = await prisma.product.findUnique({
                where: { barcode },
            });
            if (barcodeExists) {
                res.status(400).json({ error: 'Barcode already exists' });
                return;
            }
        }

        const product = await prisma.product.update({
            where: { id },
            data: {
                name,
                model,
                barcode,
                category,
                supplier,
                costPrice,
                sellingPrice,
                quantity,
                minimumMarginPct,
            },
        });

        res.json(product);
    } catch (error) {
        console.error('Update product error:', error);
        res.status(500).json({ error: 'Failed to update product' });
    }
});

// Delete (soft delete) product
router.delete('/:id', async (req: AuthRequest, res: Response) => {
    try {
        const { id } = req.params;

        const product = await prisma.product.findUnique({ where: { id } });
        if (!product || product.deletedAt) {
            res.status(404).json({ error: 'Product not found' });
            return;
        }

        await prisma.product.update({
            where: { id },
            data: { deletedAt: new Date() },
        });

        res.json({ message: 'Product deleted successfully' });
    } catch (error) {
        console.error('Delete product error:', error);
        res.status(500).json({ error: 'Failed to delete product' });
    }
});

// Get product batches
router.get('/:id/batches', async (req: AuthRequest, res: Response) => {
    try {
        const { id } = req.params;

        const batches = await prisma.productBatch.findMany({
            where: { productId: id },
            orderBy: { purchasedAt: 'asc' },
        });

        res.json(batches);
    } catch (error) {
        console.error('Get batches error:', error);
        res.status(500).json({ error: 'Failed to get batches' });
    }
});

// Add product batch
router.post('/:id/batches', async (req: AuthRequest, res: Response) => {
    try {
        const { id } = req.params;
        const { costPrice, quantity } = req.body;

        if (!costPrice || !quantity) {
            res.status(400).json({ error: 'Cost price and quantity required' });
            return;
        }

        const product = await prisma.product.findUnique({ where: { id } });
        if (!product || product.deletedAt) {
            res.status(404).json({ error: 'Product not found' });
            return;
        }

        const batch = await prisma.productBatch.create({
            data: {
                productId: id,
                costPrice,
                quantity,
                remainingQty: quantity,
            },
        });

        // Update product quantity
        await prisma.product.update({
            where: { id },
            data: { quantity: { increment: quantity } },
        });

        res.status(201).json(batch);
    } catch (error) {
        console.error('Add batch error:', error);
        res.status(500).json({ error: 'Failed to add batch' });
    }
});

export default router;
