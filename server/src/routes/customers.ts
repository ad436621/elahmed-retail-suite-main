// ============================================================
// ELAHMED RETAIL SUITE — Customers Routes (CRM)
// ============================================================

import { Router, Response } from 'express';
import prisma from '../lib/prisma.js';
import { AuthRequest } from '../middleware/auth.js';

const router = Router();

// Get all customers
router.get('/', async (req: AuthRequest, res: Response) => {
    try {
        const { search, page = 1, limit = 50 } = req.query;

        const where: any = {};

        if (search) {
            where.OR = [
                { name: { contains: search as string, mode: 'insensitive' } },
                { phone: { contains: search as string, mode: 'insensitive' } },
                { email: { contains: search as string, mode: 'insensitive' } },
            ];
        }

        const [customers, total] = await Promise.all([
            prisma.customer.findMany({
                where,
                skip: (Number(page) - 1) * Number(limit),
                take: Number(limit),
                orderBy: { createdAt: 'desc' },
            }),
            prisma.customer.count({ where }),
        ]);

        res.json({
            customers,
            pagination: {
                page: Number(page),
                limit: Number(limit),
                total,
                pages: Math.ceil(total / Number(limit)),
            },
        });
    } catch (error) {
        console.error('Get customers error:', error);
        res.status(500).json({ error: 'Failed to get customers' });
    }
});

// Get customer by ID
router.get('/:id', async (req: AuthRequest, res: Response) => {
    try {
        const { id } = req.params;

        const customer = await prisma.customer.findUnique({
            where: { id },
            include: {
                sales: {
                    orderBy: { date: 'desc' },
                    take: 10,
                    include: {
                        employee: {
                            select: { id: true, username: true, fullName: true },
                        },
                    },
                },
            },
        });

        if (!customer) {
            res.status(404).json({ error: 'Customer not found' });
            return;
        }

        res.json(customer);
    } catch (error) {
        console.error('Get customer error:', error);
        res.status(500).json({ error: 'Failed to get customer' });
    }
});

// Create customer
router.post('/', async (req: AuthRequest, res: Response) => {
    try {
        const { name, phone, email, address, notes } = req.body;

        if (!name) {
            res.status(400).json({ error: 'Name required' });
            return;
        }

        const customer = await prisma.customer.create({
            data: {
                name,
                phone,
                email,
                address,
                notes,
            },
        });

        res.status(201).json(customer);
    } catch (error) {
        console.error('Create customer error:', error);
        res.status(500).json({ error: 'Failed to create customer' });
    }
});

// Update customer
router.put('/:id', async (req: AuthRequest, res: Response) => {
    try {
        const { id } = req.params;
        const { name, phone, email, address, notes } = req.body;

        const customer = await prisma.customer.update({
            where: { id },
            data: {
                name,
                phone,
                email,
                address,
                notes,
            },
        });

        res.json(customer);
    } catch (error) {
        console.error('Update customer error:', error);
        res.status(500).json({ error: 'Failed to update customer' });
    }
});

// Delete customer
router.delete('/:id', async (req: AuthRequest, res: Response) => {
    try {
        const { id } = req.params;

        await prisma.customer.delete({ where: { id } });

        res.json({ message: 'Customer deleted successfully' });
    } catch (error) {
        console.error('Delete customer error:', error);
        res.status(500).json({ error: 'Failed to delete customer' });
    }
});

// Get customer statistics
router.get('/stats/summary', async (req: AuthRequest, res: Response) => {
    try {
        const [total, withPhone, withEmail, totalPurchases] = await Promise.all([
            prisma.customer.count(),
            prisma.customer.count({ where: { phone: { not: null } } }),
            prisma.customer.count({ where: { email: { not: null } } }),
            prisma.customer.aggregate({ _sum: { totalPurchases: true } }),
        ]);

        res.json({
            total,
            withPhone,
            withEmail,
            totalPurchasesValue: totalPurchases._sum.totalPurchases || 0,
        });
    } catch (error) {
        console.error('Get customer stats error:', error);
        res.status(500).json({ error: 'Failed to get customer stats' });
    }
});

export default router;
