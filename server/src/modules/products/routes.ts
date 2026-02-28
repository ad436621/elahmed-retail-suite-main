// ============================================================
// Products Module - Routes
// ============================================================

import { Router } from 'express';
import { ProductController } from './controller.js';
import { validate } from '../../lib/validation.js';
import { createProductSchema, updateProductSchema } from '../../lib/validation.js';

const router = Router();
const controller = new ProductController();

// Public routes
router.get('/', controller.getProducts);
router.get('/categories', controller.getCategories);
router.get('/low-stock', controller.getLowStock);
router.get('/:id', controller.getProductById);
router.get('/barcode/:barcode', controller.getProductByBarcode);

// Protected routes
router.post('/', validate(createProductSchema), controller.createProduct);
router.put('/:id', validate(updateProductSchema), controller.updateProduct);
router.delete('/:id', controller.deleteProduct);
router.post('/:id/adjust-stock', controller.adjustStock);

export default router;
