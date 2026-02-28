// ============================================================
// Products Module - Controller Layer
// ============================================================

import { Request, Response, NextFunction } from 'express';
import { ProductService } from './service.js';

const productService = new ProductService();

export class ProductController {
    /**
     * GET /api/products
     */
    async getProducts(req: Request, res: Response, next: NextFunction) {
        try {
            const { category, search, page, limit } = req.query;

            const result = await productService.getProducts({
                category: category as string,
                search: search as string,
                page: page ? Number(page) : undefined,
                limit: limit ? Number(limit) : undefined,
            });

            res.json(result);
        } catch (error) {
            next(error);
        }
    }

    /**
     * GET /api/products/:id
     */
    async getProductById(req: Request, res: Response, next: NextFunction) {
        try {
            const { id } = req.params;
            const product = await productService.getProductById(id);

            res.json(product);
        } catch (error) {
            next(error);
        }
    }

    /**
     * GET /api/products/barcode/:barcode
     */
    async getProductByBarcode(req: Request, res: Response, next: NextFunction) {
        try {
            const { barcode } = req.params;
            const product = await productService.getProductByBarcode(barcode);

            if (!product) {
                res.status(404).json({ error: 'Product not found' });
                return;
            }

            res.json(product);
        } catch (error) {
            next(error);
        }
    }

    /**
     * POST /api/products
     */
    async createProduct(req: Request, res: Response, next: NextFunction) {
        try {
            const userId = req.user?.id;
            if (!userId) {
                res.status(401).json({ error: 'Not authenticated' });
                return;
            }

            const product = await productService.createProduct(req.body);

            res.status(201).json(product);
        } catch (error) {
            next(error);
        }
    }

    /**
     * PUT /api/products/:id
     */
    async updateProduct(req: Request, res: Response, next: NextFunction) {
        try {
            const { id } = req.params;
            const product = await productService.updateProduct(id, req.body);

            res.json(product);
        } catch (error) {
            next(error);
        }
    }

    /**
     * DELETE /api/products/:id
     */
    async deleteProduct(req: Request, res: Response, next: NextFunction) {
        try {
            const { id } = req.params;
            await productService.deleteProduct(id);

            res.status(204).send();
        } catch (error) {
            next(error);
        }
    }

    /**
     * POST /api/products/:id/adjust-stock
     */
    async adjustStock(req: Request, res: Response, next: NextFunction) {
        try {
            const { id } = req.params;
            const { quantity, reason } = req.body;
            const userId = req.user?.id;

            if (!userId) {
                res.status(401).json({ error: 'Not authenticated' });
                return;
            }

            const result = await productService.adjustStock(id, quantity, reason, userId);

            res.json(result);
        } catch (error) {
            next(error);
        }
    }

    /**
     * GET /api/products/low-stock
     */
    async getLowStock(req: Request, res: Response, next: NextFunction) {
        try {
            const threshold = req.query.threshold ? Number(req.query.threshold) : 10;
            const products = await productService.getLowStock(threshold);

            res.json(products);
        } catch (error) {
            next(error);
        }
    }

    /**
     * GET /api/products/categories
     */
    async getCategories(req: Request, res: Response, next: NextFunction) {
        try {
            const categories = await productService.getCategories();
            res.json(categories);
        } catch (error) {
            next(error);
        }
    }
}

export const productController = new ProductController();
export default productController;
