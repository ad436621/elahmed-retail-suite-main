// ============================================================
// Products Module - Repository Layer
// ============================================================

import { Prisma } from '@prisma/client';
import prisma from '../../lib/prisma.js';

export class ProductRepository {
    /**
     * Find all products with pagination and filters
     */
    async findAll(params: {
        category?: string;
        search?: string;
        page?: number;
        limit?: number;
        includeDeleted?: boolean;
    }) {
        const { category, search, page = 1, limit = 50, includeDeleted = false } = params;

        const where: Prisma.ProductWhereInput = {};

        // Category filter
        if (category) {
            where.category = category;
        }

        // Search by name or barcode
        if (search) {
            where.OR = [
                { name: { contains: search, mode: 'insensitive' } },
                { barcode: { contains: search, mode: 'insensitive' } },
                { model: { contains: search, mode: 'insensitive' } },
            ];
        }

        // Soft delete filter
        if (!includeDeleted) {
            where.deletedAt = null;
        }

        const [products, total] = await Promise.all([
            prisma.product.findMany({
                where,
                skip: (page - 1) * limit,
                take: limit,
                orderBy: { createdAt: 'desc' },
                include: {
                    _count: {
                        select: { saleItems: true },
                    },
                },
            }),
            prisma.product.count({ where }),
        ]);

        return {
            products,
            pagination: {
                page,
                limit,
                total,
                pages: Math.ceil(total / limit),
            },
        };
    }

    /**
     * Find product by ID
     */
    async findById(id: string, includeDeleted = false) {
        const where: Prisma.ProductWhereInput = { id };

        if (!includeDeleted) {
            where.deletedAt = null;
        }

        return prisma.product.findUnique({
            where,
            include: {
                batches: {
                    where: { remainingQty: { gt: 0 } },
                    orderBy: { purchasedAt: 'asc' },
                },
            },
        });
    }

    /**
     * Find product by barcode
     */
    async findByBarcode(barcode: string) {
        return prisma.product.findUnique({
            where: { barcode },
        });
    }

    /**
     * Create product
     */
    async create(data: Prisma.ProductCreateInput) {
        return prisma.product.create({
            data,
        });
    }

    /**
     * Update product
     */
    async update(id: string, data: Prisma.ProductUpdateInput) {
        return prisma.product.update({
            where: { id },
            data,
        });
    }

    /**
     * Soft delete product
     */
    async softDelete(id: string) {
        return prisma.product.update({
            where: { id },
            data: { deletedAt: new Date() },
        });
    }

    /**
     * Adjust stock quantity
     */
    async adjustStock(id: string, quantity: number) {
        return prisma.product.update({
            where: { id },
            data: { quantity: { increment: quantity } },
        });
    }

    /**
     * Get products with low stock
     */
    async getLowStock(threshold = 10) {
        return prisma.product.findMany({
            where: {
                quantity: { lte: threshold },
                deletedAt: null,
            },
            orderBy: { quantity: 'asc' },
        });
    }

    /**
     * Get categories list
     */
    async getCategories() {
        const products = await prisma.product.findMany({
            where: { deletedAt: null },
            select: { category: true },
            distinct: ['category'],
        });
        return products.map(p => p.category);
    }
}

export const productRepository = new ProductRepository();
export default productRepository;
