// ============================================================
// ELAHMED RETAIL SUITE — Suppliers Routes
// ============================================================

import { Router, Response } from 'express';
import prisma from '../lib/prisma.js';
import { AuthRequest } from '../middleware/auth.js';

const router = Router();

// Get all suppliers
router.get('/', async (req: AuthRequest, res: Response) => {
    try {
        const { search, active, page = 1, limit = 50 } = req.query;

        const where: any = {};

        if (search) {
            where.OR = [
                { name: { contains: search as string, mode: 'insensitive' } },
                { phone: { contains: search as string, mode: 'insensitive' } },
            ];
        }

        if (active !== undefined) {
            where.active = active === 'true';
        }

        const [suppliers, total] = await Promise.all([
            prisma.supplier.findMany({
                where,
                skip: (Number(page) - 1) * Number(limit),
                take: Number(limit),
                orderBy: { name: 'asc' },
            }),
            prisma.supplier.count({ where }),
        ]);

        res.json({
            suppliers,
            pagination: {
                page: Number(page),
                limit: Number(limit),
                total,
                pages: Math.ceil(total / Number(limit)),
            },
        });
    } catch (error) {
        console.error('Get suppliers error:', error);
        res.status(500).json({ error: 'Failed to get suppliers' });
    }
});

// Get supplier by ID
router.get('/:id', async (req: AuthRequest, res: Response) => {
    try {
        const { id } = req.params;

        const supplier = await prisma.supplier.findUnique({
            where: { id },
            include: {
                products: {
                    take: 10,
                },
                purchaseOrders: {
                    orderBy: { orderDate: 'desc' },
                    take: 10,
                },
            },
        });

        if (!supplier) {
            res.status(404).json({ error: 'Supplier not found' });
            return;
        }

        res.json(supplier);
    } catch (error) {
        console.error('Get supplier error:', error);
        res.status(500).json({ error: 'Failed to get supplier' });
    }
});

// Create supplier
router.post('/', async (req: AuthRequest, res: Response) => {
    try {
        const { name, phone, email, address, notes } = req.body;

        if (!name) {
            res.status(400).json({ error: 'Name required' });
            return;
        }

        const supplier = await prisma.supplier.create({
            data: {
                name,
                phone,
                email,
                address,
                notes,
            },
        });

        res.status(201).json(supplier);
    } catch (error) {
        console.error('Create supplier error:', error);
        res.status(500).json({ error: 'Failed to create supplier' });
    }
});

// Update supplier
router.put('/:id', async (req: AuthRequest, res: Response) => {
    try {
        const { id } = req.params;
        const { name, phone, email, address, notes, active } = req.body;

        const supplier = await prisma.supplier.update({
            where: { id },
            data: {
                name,
                phone,
                email,
                address,
                notes,
                active,
            },
        });

        res.json(supplier);
    } catch (error) {
        console.error('Update supplier error:', error);
        res.status(500).json({ error: 'Failed to update supplier' });
    }
});

// Delete supplier (soft delete)
router.delete('/:id', async (req: AuthRequest, res: Response) => {
    try {
        const { id } = req.params;

        const supplier = await prisma.supplier.update({
            where: { id },
            data: { active: false },
        });

        res.json({ message: 'Supplier deactivated', supplier });
    } catch (error) {
        console.error('Delete supplier error:', error);
        res.status(500).json({ error: 'Failed to delete supplier' });
    }
});

// Purchase Orders

// Get purchase orders
router.get('/orders', async (req: AuthRequest, res: Response) => {
    try {
        const { supplierId, status, page = 1, limit = 50 } = req.query;

        const where: any = {};

        if (supplierId) where.supplierId = supplierId;
        if (status) where.status = status;

        const [orders, total] = await Promise.all([
            prisma.purchaseOrder.findMany({
                where,
                skip: (Number(page) - 1) * Number(limit),
                take: Number(limit),
                orderBy: { orderDate: 'desc' },
                include: {
                    supplier: {
                        select: { id: true, name: true },
                    },
                },
            }),
            prisma.purchaseOrder.count({ where }),
        ]);

        res.json({
            orders,
            pagination: {
                page: Number(page),
                limit: Number(limit),
                total,
                pages: Math.ceil(total / Number(limit)),
            },
        });
    } catch (error) {
        console.error('Get purchase orders error:', error);
        res.status(500).json({ error: 'Failed to get purchase orders' });
    }
});

// Create purchase order
router.post('/orders', async (req: AuthRequest, res: Response) => {
    try {
        const { supplierId, items, notes, expectedDate } = req.body;

        if (!supplierId || !items || items.length === 0) {
            res.status(400).json({ error: 'Supplier and items required' });
            return;
        }

        // Calculate total
        let total = 0;
        for (const item of items) {
            total += item.quantity * item.unitCost;
        }

        // Generate order number
        const year = new Date().getFullYear();
        const count = await prisma.purchaseOrder.count({
            where: { orderNumber: { startsWith: `PO-${year}` } },
        });
        const orderNumber = `PO-${year}-${String(count + 1).padStart(4, '0')}`;

        const order = await prisma.purchaseOrder.create({
            data: {
                orderNumber,
                supplierId,
                total,
                notes,
                expectedDate: expectedDate ? new Date(expectedDate) : null,
                items: {
                    create: items.map((item: any) => ({
                        productName: item.productName,
                        quantity: item.quantity,
                        unitCost: item.unitCost,
                    })),
                },
            },
            include: {
                supplier: true,
                items: true,
            },
        });

        res.status(201).json(order);
    } catch (error) {
        console.error('Create purchase order error:', error);
        res.status(500).json({ error: 'Failed to create purchase order' });
    }
});

// Update purchase order status
router.put('/orders/:id/status', async (req: AuthRequest, res: Response) => {
    try {
        const { id } = req.params;
        const { status, receivedDate } = req.body;

        const order = await prisma.purchaseOrder.update({
            where: { id },
            data: {
                status,
                receivedDate: receivedDate ? new Date(receivedDate) : null,
            },
            include: {
                supplier: true,
                items: true,
            },
        });

        res.json(order);
    } catch (error) {
        console.error('Update purchase order status error:', error);
        res.status(500).json({ error: 'Failed to update purchase order' });
    }
});

export default router;
