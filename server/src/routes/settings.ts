// ============================================================
// ELAHMED RETAIL SUITE — Settings Routes (Tax, Branches)
// ============================================================

import { Router, Response } from 'express';
import prisma from '../lib/prisma.js';
import { AuthRequest } from '../middleware/auth.js';

const router = Router();

// ===== TAX SETTINGS =====

// Get tax settings
router.get('/tax', async (req: AuthRequest, res: Response) => {
    try {
        const taxEnabled = await prisma.setting.findUnique({
            where: { key: 'tax_enabled' },
        });
        const taxRate = await prisma.setting.findUnique({
            where: { key: 'tax_rate' },
        });
        const taxNumber = await prisma.setting.findUnique({
            where: { key: 'tax_number' },
        });

        res.json({
            enabled: taxEnabled?.value === 'true',
            rate: taxRate ? parseFloat(taxRate.value) : 0,
            taxNumber: taxNumber?.value || '',
        });
    } catch (error) {
        console.error('Get tax settings error:', error);
        res.status(500).json({ error: 'Failed to get tax settings' });
    }
});

// Update tax settings
router.put('/tax', async (req: AuthRequest, res: Response) => {
    try {
        const { enabled, rate, taxNumber } = req.body;

        await Promise.all([
            prisma.setting.upsert({
                where: { key: 'tax_enabled' },
                update: { value: String(enabled) },
                create: { key: 'tax_enabled', value: String(enabled), type: 'boolean' },
            }),
            prisma.setting.upsert({
                where: { key: 'tax_rate' },
                update: { value: String(rate) },
                create: { key: 'tax_rate', value: String(rate), type: 'number' },
            }),
            prisma.setting.upsert({
                where: { key: 'tax_number' },
                update: { value: taxNumber },
                create: { key: 'tax_number', value: taxNumber, type: 'string' },
            }),
        ]);

        res.json({ message: 'Tax settings updated' });
    } catch (error) {
        console.error('Update tax settings error:', error);
        res.status(500).json({ error: 'Failed to update tax settings' });
    }
});

// Calculate tax
router.post('/tax/calculate', async (req: AuthRequest, res: Response) => {
    try {
        const { amount, includeTax = false } = req.body;

        const taxRateSetting = await prisma.setting.findUnique({
            where: { key: 'tax_rate' },
        });

        const taxRate = taxRateSetting ? parseFloat(taxRateSetting.value) / 100 : 0;

        let subtotal = amount;
        let tax = 0;
        let total = amount;

        if (includeTax) {
            // Tax is already included in amount
            tax = amount * (taxRate / (1 + taxRate));
            subtotal = amount - tax;
        } else {
            // Tax is added to amount
            tax = amount * taxRate;
            total = amount + tax;
        }

        res.json({
            subtotal,
            taxRate: taxRate * 100,
            tax,
            total,
        });
    } catch (error) {
        console.error('Calculate tax error:', error);
        res.status(500).json({ error: 'Failed to calculate tax' });
    }
});

// ===== BRANCHES =====

// Get all branches
router.get('/branches', async (req: AuthRequest, res: Response) => {
    try {
        const branches = await prisma.branch.findMany({
            orderBy: { isMain: 'desc' },
        });

        res.json(branches);
    } catch (error) {
        console.error('Get branches error:', error);
        res.status(500).json({ error: 'Failed to get branches' });
    }
});

// Create branch
router.post('/branches', async (req: AuthRequest, res: Response) => {
    try {
        const { name, nameAr, address, phone, isMain } = req.body;

        if (!name) {
            res.status(400).json({ error: 'Name required' });
            return;
        }

        // If setting as main, unset other mains
        if (isMain) {
            await prisma.branch.updateMany({
                where: { isMain: true },
                data: { isMain: false },
            });
        }

        const branch = await prisma.branch.create({
            data: {
                name,
                nameAr,
                address,
                phone,
                isMain: isMain || false,
            },
        });

        res.status(201).json(branch);
    } catch (error) {
        console.error('Create branch error:', error);
        res.status(500).json({ error: 'Failed to create branch' });
    }
});

// Update branch
router.put('/branches/:id', async (req: AuthRequest, res: Response) => {
    try {
        const { id } = req.params;
        const { name, nameAr, address, phone, isActive, isMain } = req.body;

        // If setting as main, unset other mains
        if (isMain) {
            await prisma.branch.updateMany({
                where: { isMain: true, id: { not: id } },
                data: { isMain: false },
            });
        }

        const branch = await prisma.branch.update({
            where: { id },
            data: {
                name,
                nameAr,
                address,
                phone,
                isActive,
                isMain: isMain || false,
            },
        });

        res.json(branch);
    } catch (error) {
        console.error('Update branch error:', error);
        res.status(500).json({ error: 'Failed to update branch' });
    }
});

// Delete branch
router.delete('/branches/:id', async (req: AuthRequest, res: Response) => {
    try {
        const { id } = req.params;

        const branch = await prisma.branch.update({
            where: { id },
            data: { isActive: false },
        });

        res.json({ message: 'Branch deactivated', branch });
    } catch (error) {
        console.error('Delete branch error:', error);
        res.status(500).json({ error: 'Failed to delete branch' });
    }
});

// ===== GENERAL SETTINGS =====

// Get all settings
router.get('/', async (req: AuthRequest, res: Response) => {
    try {
        const settings = await prisma.setting.findMany();

        const settingsObj: Record<string, any> = {};
        for (const s of settings) {
            if (s.type === 'number') {
                settingsObj[s.key] = parseFloat(s.value);
            } else if (s.type === 'boolean') {
                settingsObj[s.key] = s.value === 'true';
            } else if (s.type === 'json') {
                settingsObj[s.key] = JSON.parse(s.value);
            } else {
                settingsObj[s.key] = s.value;
            }
        }

        res.json(settingsObj);
    } catch (error) {
        console.error('Get settings error:', error);
        res.status(500).json({ error: 'Failed to get settings' });
    }
});

// Update setting
router.put('/', async (req: AuthRequest, res: Response) => {
    try {
        const { key, value, type = 'string', description } = req.body;

        if (!key) {
            res.status(400).json({ error: 'Key required' });
            return;
        }

        const stringValue = typeof value === 'string' ? value : JSON.stringify(value);

        const setting = await prisma.setting.upsert({
            where: { key },
            update: { value: stringValue, type, description },
            create: { key, value: stringValue, type, description },
        });

        res.json(setting);
    } catch (error) {
        console.error('Update setting error:', error);
        res.status(500).json({ error: 'Failed to update setting' });
    }
});

export default router;
