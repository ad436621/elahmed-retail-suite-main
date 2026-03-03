// ============================================================
// Unit Tests — Stock Domain Logic
// ============================================================

import { describe, it, expect } from 'vitest';
import {
    validateStock,
    calculateNewQuantity,
    createStockMovement,
    applyStockMovement,
    isLowStock,
    predictDepletionDays,
    StockError,
} from '@/domain/stock';
import type { Product } from '@/domain/types';

// ─── Fixtures ────────────────────────────────────────────────

const makeProduct = (overrides: Partial<Product> = {}): Product => ({
    id: 'prod-1',
    name: 'Samsung Galaxy',
    model: 'S24',
    barcode: '987654321',
    category: 'mobiles',
    supplier: 'Samsung',
    costPrice: 800,
    sellingPrice: 1200,
    quantity: 10,
    minimumMarginPct: 10,
    createdAt: '2024-01-01',
    updatedAt: '2024-01-01',
    deletedAt: null,
    ...overrides,
});

// ─── validateStock ───────────────────────────────────────────

describe('validateStock', () => {
    it('should not throw when quantity is sufficient', () => {
        const product = makeProduct({ quantity: 5 });
        expect(() => validateStock(product, 3)).not.toThrow();
    });

    it('should not throw when requesting exactly available qty', () => {
        const product = makeProduct({ quantity: 5 });
        expect(() => validateStock(product, 5)).not.toThrow();
    });

    it('should throw StockError when requesting more than available', () => {
        const product = makeProduct({ quantity: 3 });
        expect(() => validateStock(product, 5)).toThrow(StockError);
    });

    it('should include product name in error message', () => {
        const product = makeProduct({ quantity: 1, name: 'iPhone 15' });
        try {
            validateStock(product, 5);
            expect.fail('should have thrown');
        } catch (e: any) {
            expect(e.message).toContain('iPhone 15');
        }
    });

    it('should throw when requestedQty is 0', () => {
        const product = makeProduct({ quantity: 10 });
        expect(() => validateStock(product, 0)).toThrow(StockError);
    });

    it('should throw when requestedQty is negative', () => {
        const product = makeProduct({ quantity: 10 });
        expect(() => validateStock(product, -1)).toThrow(StockError);
    });

    it('should throw when product has 0 stock', () => {
        const product = makeProduct({ quantity: 0 });
        expect(() => validateStock(product, 1)).toThrow(StockError);
    });
});

// ─── calculateNewQuantity ─────────────────────────────────────

describe('calculateNewQuantity', () => {
    it('should add positive changes', () => {
        expect(calculateNewQuantity(5, 3)).toBe(8);
    });

    it('should subtract negative changes', () => {
        expect(calculateNewQuantity(10, -3)).toBe(7);
    });

    it('should return 0 when change exactly depletes stock', () => {
        expect(calculateNewQuantity(5, -5)).toBe(0);
    });

    it('should throw StockError when result would be negative', () => {
        expect(() => calculateNewQuantity(5, -6)).toThrow(StockError);
    });

    it('should throw with helpful message for negative result', () => {
        try {
            calculateNewQuantity(3, -10);
            expect.fail('should have thrown');
        } catch (e: any) {
            expect(e.message).toContain('negative');
        }
    });

    it('should handle 0 change (no-op)', () => {
        expect(calculateNewQuantity(5, 0)).toBe(5);
    });
});

// ─── createStockMovement ──────────────────────────────────────

describe('createStockMovement', () => {
    it('should create a valid stock movement', () => {
        const movement = createStockMovement('prod-1', 'sale', -2, 10, 'Sale INV-001', 'user-1');
        expect(movement.productId).toBe('prod-1');
        expect(movement.type).toBe('sale');
        expect(movement.quantityChange).toBe(-2);
        expect(movement.previousQuantity).toBe(10);
        expect(movement.newQuantity).toBe(8);
        expect(movement.userId).toBe('user-1');
        expect(movement.referenceId).toBeNull();
    });

    it('should generate a UUID id', () => {
        const movement = createStockMovement('prod-1', 'purchase', 5, 10, 'restock', 'user-1');
        expect(movement.id).toMatch(/^[0-9a-f-]{36}$/i);
    });

    it('should have a valid ISO timestamp', () => {
        const movement = createStockMovement('prod-1', 'purchase', 5, 0, 'initial', 'user-1');
        expect(new Date(movement.timestamp).getTime()).not.toBeNaN();
    });

    it('should store referenceId when provided', () => {
        const movement = createStockMovement('prod-1', 'sale', -1, 5, 'sale', 'user-1', 'sale-123');
        expect(movement.referenceId).toBe('sale-123');
    });

    it('should throw StockError when change would make quantity negative', () => {
        expect(() => createStockMovement('prod-1', 'sale', -99, 5, 'oversell', 'user-1')).toThrow(StockError);
    });
});

// ─── applyStockMovement ───────────────────────────────────────

describe('applyStockMovement', () => {
    it('should return product with updated quantity', () => {
        const product = makeProduct({ quantity: 10 });
        const movement = createStockMovement('prod-1', 'sale', -3, 10, 'sale', 'user-1');
        const updated = applyStockMovement(product, movement);
        expect(updated.quantity).toBe(7);
    });

    it('should not mutate original product (immutable)', () => {
        const product = makeProduct({ quantity: 10 });
        const movement = createStockMovement('prod-1', 'sale', -3, 10, 'sale', 'user-1');
        applyStockMovement(product, movement);
        expect(product.quantity).toBe(10); // unchanged
    });

    it('should update the updatedAt timestamp', () => {
        const product = makeProduct({ updatedAt: '2020-01-01' });
        const movement = createStockMovement('prod-1', 'sale', -1, 10, 'sale', 'user-1');
        const updated = applyStockMovement(product, movement);
        expect(updated.updatedAt).toBe(movement.timestamp);
    });
});

// ─── isLowStock ──────────────────────────────────────────────

describe('isLowStock', () => {
    it('should return true when quantity is 5 (at threshold)', () => {
        const product = makeProduct({ quantity: 5 });
        expect(isLowStock(product)).toBe(true);
    });

    it('should return true when quantity is below 5', () => {
        const product = makeProduct({ quantity: 2 });
        expect(isLowStock(product)).toBe(true);
    });

    it('should return false when quantity is above 5', () => {
        const product = makeProduct({ quantity: 6 });
        expect(isLowStock(product)).toBe(false);
    });

    it('should return true when stock is 0', () => {
        const product = makeProduct({ quantity: 0 });
        expect(isLowStock(product)).toBe(true);
    });
});

// ─── predictDepletionDays ─────────────────────────────────────

describe('predictDepletionDays', () => {
    it('should return null when avgDailySales is 0', () => {
        expect(predictDepletionDays(100, 0)).toBeNull();
    });

    it('should return null when avgDailySales is negative', () => {
        expect(predictDepletionDays(100, -1)).toBeNull();
    });

    it('should predict correct days', () => {
        expect(predictDepletionDays(100, 10)).toBe(10); // 100 / 10 = 10 days
    });

    it('should floor the result', () => {
        expect(predictDepletionDays(10, 3)).toBe(3); // 10/3 = 3.33 → 3
    });

    it('should return 0 when stock is 0', () => {
        expect(predictDepletionDays(0, 5)).toBe(0);
    });
});
