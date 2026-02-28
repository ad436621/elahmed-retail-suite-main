// ============================================================
// ELAHMED RETAIL SUITE — Zod Validation Schemas
// ============================================================

import { z } from 'zod';

// Common validation patterns
const phoneRegex = /^01[0125][0-9]{8}$/; // Egyptian phone numbers
const barcodeRegex = /^[A-Za-z0-9-]{4,30}$/;

// ============================================================
// Auth Schemas
// ============================================================

export const loginSchema = z.object({
    username: z.string().min(3).max(50),
    password: z.string().min(6),
});

export const changePasswordSchema = z.object({
    currentPassword: z.string().min(6),
    newPassword: z.string().min(8).max(100),
    confirmPassword: z.string(),
}).refine(data => data.newPassword === data.confirmPassword, {
    message: "Passwords don't match",
    path: ['confirmPassword'],
});

// ============================================================
// Product Schemas
// ============================================================

export const createProductSchema = z.object({
    name: z.string().min(1).max(200),
    model: z.string().max(100).optional(),
    barcode: z.string().regex(barcodeRegex),
    category: z.string().min(1).max(100),
    supplier: z.string().max(100).optional(),
    costPrice: z.number().positive(),
    sellingPrice: z.number().positive(),
    quantity: z.number().int().min(0),
    minimumMarginPct: z.number().min(0).max(100).default(0),
});

export const updateProductSchema = createProductSchema.partial().extend({
    // Prevent barcode changes if product has sales
    barcode: z.string().regex(barcodeRegex).optional(),
});

export const productBatchSchema = z.object({
    productId: z.string().uuid(),
    costPrice: z.number().positive(),
    quantity: z.number().int().positive(),
    notes: z.string().max(500).optional(),
});

// ============================================================
// Sale Schemas
// ============================================================

const saleItemSchema = z.object({
    productId: z.string().uuid(),
    qty: z.number().int().positive(),
    discount: z.number().min(0).default(0),
});

export const createSaleSchema = z.object({
    items: z.array(saleItemSchema).min(1),
    discount: z.number().min(0).default(0),
    paymentMethod: z.enum(['cash', 'card', 'split']).default('cash'),
    customerId: z.string().uuid().optional(),
});

export const voidSaleSchema = z.object({
    reason: z.string().min(10).max(500),
});

// ============================================================
// Stock Adjustment Schema
// ============================================================

export const stockAdjustmentSchema = z.object({
    productId: z.string().uuid(),
    quantity: z.number().int(), // Can be positive or negative
    reason: z.string().min(5).max(200),
    type: z.enum(['manual_adjustment', 'correction', 'damaged', 'found']),
});

// ============================================================
// Customer Schemas
// ============================================================

export const createCustomerSchema = z.object({
    name: z.string().min(2).max(200),
    phone: z.string().regex(phoneRegex, 'Invalid Egyptian phone number').optional(),
    email: z.string().email().optional().or(z.literal('')),
    address: z.string().max(500).optional(),
    notes: z.string().max(1000).optional(),
});

export const updateCustomerSchema = createCustomerSchema.partial();

// ============================================================
// Supplier Schemas
// ============================================================

export const createSupplierSchema = z.object({
    name: z.string().min(2).max(200),
    phone: z.string().regex(phoneRegex, 'Invalid Egyptian phone number').optional(),
    email: z.string().email().optional().or(z.literal('')),
    address: z.string().max(500).optional(),
    notes: z.string().max(1000).optional(),
});

export const updateSupplierSchema = createSupplierSchema.partial();

// ============================================================
// Purchase Order Schemas
// ============================================================

const purchaseOrderItemSchema = z.object({
    productName: z.string().min(1).max(200),
    quantity: z.number().int().positive(),
    unitCost: z.number().positive(),
});

export const createPurchaseOrderSchema = z.object({
    supplierId: z.string().uuid(),
    expectedDate: z.string().datetime().optional(),
    notes: z.string().max(1000).optional(),
    items: z.array(purchaseOrderItemSchema).min(1),
});

export const updatePurchaseOrderStatusSchema = z.object({
    status: z.enum(['pending', 'ordered', 'partial', 'received', 'cancelled']),
    receivedItems: z.array(z.object({
        itemId: z.string().uuid(),
        receivedQty: z.number().int().min(0),
    })).optional(),
});

// ============================================================
// User Management Schemas
// ============================================================

export const createUserSchema = z.object({
    username: z.string().min(3).max(50).regex(/^[a-zA-Z0-9_]+$/),
    password: z.string().min(8).max(100),
    fullName: z.string().min(2).max(100),
    role: z.enum(['owner', 'admin', 'employee']),
    permissions: z.array(z.string()).default([]),
    active: z.boolean().default(true),
});

export const updateUserSchema = createUserSchema.partial().extend({
    password: z.string().min(8).max(100).optional(),
});

// ============================================================
// Settings Schemas
// ============================================================

export const taxSettingsSchema = z.object({
    enabled: z.boolean(),
    rate: z.number().min(0).max(100),
    taxNumber: z.string().max(50).optional(),
});

export const branchSchema = z.object({
    name: z.string().min(2).max(100),
    nameAr: z.string().max(100).optional(),
    address: z.string().max(500).optional(),
    phone: z.string().regex(phoneRegex, 'Invalid Egyptian phone number').optional(),
    isActive: z.boolean().default(true),
    isMain: z.boolean().default(false),
});

// ============================================================
// Pagination Schema
// ============================================================

export const paginationSchema = z.object({
    page: z.coerce.number().int().positive().default(1),
    limit: z.coerce.number().int().positive().max(100).default(50),
    sortBy: z.string().optional(),
    sortOrder: z.enum(['asc', 'desc']).default('desc'),
});

// ============================================================
// Date Range Schema
// ============================================================

export const dateRangeSchema = z.object({
    startDate: z.string().datetime().optional(),
    endDate: z.string().datetime().optional(),
});

// ============================================================
// Validation Middleware Factory
// ============================================================

import { Request, Response, NextFunction } from 'express';

export function validate<T>(schema: z.ZodSchema<T>) {
    return (req: Request, res: Response, next: NextFunction): void => {
        try {
            const validated = schema.parse(req.body);
            req.body = validated;
            next();
        } catch (error) {
            if (error instanceof z.ZodError) {
                res.status(400).json({
                    error: 'Validation failed',
                    details: error.errors.map(err => ({
                        field: err.path.join('.'),
                        message: err.message,
                    })),
                });
                return;
            }
            next(error);
        }
    };
}

export function validateQuery<T>(schema: z.ZodSchema<T>) {
    return (req: Request, res: Response, next: NextFunction): void => {
        try {
            const validated = schema.parse(req.query);
            req.query = validated;
            next();
        } catch (error) {
            if (error instanceof z.ZodError) {
                res.status(400).json({
                    error: 'Invalid query parameters',
                    details: error.errors.map(err => ({
                        field: err.path.join('.'),
                        message: err.message,
                    })),
                });
                return;
            }
            next(error);
        }
    };
}

export function validateParams<T>(schema: z.ZodSchema<T>) {
    return (req: Request, res: Response, next: NextFunction): void => {
        try {
            const validated = schema.parse(req.params);
            req.params = validated;
            next();
        } catch (error) {
            if (error instanceof z.ZodError) {
                res.status(400).json({
                    error: 'Invalid URL parameters',
                    details: error.errors.map(err => ({
                        field: err.path.join('.'),
                        message: err.message,
                    })),
                });
                return;
            }
            next(error);
        }
    };
}
