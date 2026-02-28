// ============================================================
// Products Module - Service Layer
// ============================================================

import { ProductRepository } from './repository.js';
import { createProductSchema, updateProductSchema } from '../../lib/validation.js';
import { invalidateProductCache } from '../../lib/cache.js';

export class ProductService {
    private repository: ProductRepository;

    constructor() {
        this.repository = new ProductRepository();
    }

    /**
     * Get all products
     */
    async getProducts(params: {
        category?: string;
        search?: string;
        page?: number;
        limit?: number;
    }) {
        return this.repository.findAll(params);
    }

    /**
     * Get product by ID
     */
    async getProductById(id: string) {
        const product = await this.repository.findById(id);
        if (!product) {
            throw new Error('Product not found');
        }
        return product;
    }

    /**
     * Get product by barcode
     */
    async getProductByBarcode(barcode: string) {
        return this.repository.findByBarcode(barcode);
    }

    /**
     * Create new product
     */
    async createProduct(data: unknown) {
        // Validate input
        const validated = createProductSchema.parse(data);

        // Check barcode uniqueness
        const existing = await this.repository.findByBarcode(validated.barcode);
        if (existing) {
            throw new Error('Barcode already exists');
        }

        // Create product
        const product = await this.repository.create(validated);

        // Invalidate cache
        await invalidateProductCache();

        return product;
    }

    /**
     * Update product
     */
    async updateProduct(id: string, data: unknown) {
        // Validate input
        const validated = updateProductSchema.parse(data);

        // Check product exists
        const existing = await this.repository.findById(id);
        if (!existing) {
            throw new Error('Product not found');
        }

        // Check barcode uniqueness if changing
        if (validated.barcode && validated.barcode !== existing.barcode) {
            const barcodeExists = await this.repository.findByBarcode(validated.barcode);
            if (barcodeExists) {
                throw new Error('Barcode already exists');
            }
        }

        // Update product
        const product = await this.repository.update(id, validated);

        // Invalidate cache
        await invalidateProductCache(id);

        return product;
    }

    /**
     * Delete product (soft delete)
     */
    async deleteProduct(id: string) {
        const existing = await this.repository.findById(id);
        if (!existing) {
            throw new Error('Product not found');
        }

        const product = await this.repository.softDelete(id);

        // Invalidate cache
        await invalidateProductCache(id);

        return product;
    }

    /**
     * Adjust stock
     */
    async adjustStock(id: string, quantity: number, reason: string, userId: string) {
        const product = await this.repository.findById(id);
        if (!product) {
            throw new Error('Product not found');
        }

        const newQty = product.quantity + quantity;
        if (newQty < 0) {
            throw new Error('Insufficient stock');
        }

        await this.repository.adjustStock(id, quantity);

        // Invalidate cache
        await invalidateProductCache(id);

        return { productId: id, newQuantity: newQty, reason };
    }

    /**
     * Get low stock products
     */
    async getLowStock(threshold = 10) {
        return this.repository.getLowStock(threshold);
    }

    /**
     * Get categories
     */
    async getCategories() {
        return this.repository.getCategories();
    }
}

export const productService = new ProductService();
export default productService;
