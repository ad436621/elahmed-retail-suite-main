// ============================================================
// Unit Tests — Sale Domain Logic
// ============================================================

import { describe, it, expect } from 'vitest';
import {
    calcLineTotal,
    calcLineCost,
    buildSaleRecord,
    calcCartTotals,
    SaleError,
} from '@/domain/sale';
import type { CartItem } from '@/domain/types';

// ─── Fixtures ────────────────────────────────────────────────

const makeProduct = (overrides = {}) => ({
    id: 'prod-1',
    name: 'iPhone 15',
    model: 'A2846',
    barcode: '123456789',
    category: 'mobiles',
    supplier: 'Apple',
    costPrice: 1000,
    sellingPrice: 1500,
    quantity: 10,
    minimumMarginPct: 10,
    createdAt: '2024-01-01',
    updatedAt: '2024-01-01',
    deletedAt: null,
    ...overrides,
});

const makeCartItem = (overrides: Partial<CartItem> = {}): CartItem => ({
    product: makeProduct(),
    qty: 1,
    lineDiscount: 0,
    ...overrides,
});

// ─── calcLineTotal ────────────────────────────────────────────

describe('calcLineTotal', () => {
    it('should return price * qty when no discount', () => {
        const item = makeCartItem({ qty: 2, lineDiscount: 0 });
        expect(calcLineTotal(item)).toBe(3000); // 1500 * 2
    });

    it('should subtract line discount', () => {
        const item = makeCartItem({ qty: 1, lineDiscount: 100 });
        expect(calcLineTotal(item)).toBe(1400); // 1500 - 100
    });

    it('should handle qty=1 and no discount', () => {
        const item = makeCartItem({ qty: 1, lineDiscount: 0 });
        expect(calcLineTotal(item)).toBe(1500);
    });

    it('should handle large qty', () => {
        const item = makeCartItem({ qty: 10, lineDiscount: 0 });
        expect(calcLineTotal(item)).toBe(15000);
    });
});

// ─── calcLineCost ─────────────────────────────────────────────

describe('calcLineCost', () => {
    it('should return costPrice * qty', () => {
        const item = makeCartItem({ qty: 3 });
        expect(calcLineCost(item)).toBe(3000); // 1000 * 3
    });

    it('should return costPrice for qty=1', () => {
        const item = makeCartItem({ qty: 1 });
        expect(calcLineCost(item)).toBe(1000);
    });

    it('should handle fractional cost prices', () => {
        const item = makeCartItem({
            product: makeProduct({ costPrice: 99.99 }),
            qty: 2,
        });
        expect(calcLineCost(item)).toBeCloseTo(199.98);
    });
});

// ─── calcCartTotals ───────────────────────────────────────────

describe('calcCartTotals', () => {
    it('should calculate subtotal, total, grossProfit correctly', () => {
        const cart: CartItem[] = [
            makeCartItem({ qty: 1, lineDiscount: 0 }), // 1500 revenue, 1000 cost
        ];
        const result = calcCartTotals(cart, 0);
        expect(result.subtotal).toBe(1500);
        expect(result.total).toBe(1500);
        expect(result.totalCost).toBe(1000);
        expect(result.grossProfit).toBe(500);
        expect(result.marginPct).toBeCloseTo(33.3, 0);
    });

    it('should deduct invoice discount from total', () => {
        const cart: CartItem[] = [makeCartItem({ qty: 1 })];
        const result = calcCartTotals(cart, 200);
        expect(result.total).toBe(1300);
        expect(result.grossProfit).toBe(300); // 1300 - 1000
    });

    it('should not allow total below zero', () => {
        const cart: CartItem[] = [makeCartItem({ qty: 1 })];
        const result = calcCartTotals(cart, 99999);
        expect(result.total).toBe(0);
    });

    it('should calculate correctly for multiple items', () => {
        const cart: CartItem[] = [
            makeCartItem({ qty: 2, lineDiscount: 0 }), // 3000 revenue, 2000 cost
            makeCartItem({
                product: makeProduct({ sellingPrice: 500, costPrice: 200 }),
                qty: 1,
                lineDiscount: 0,
            }), // 500 revenue, 200 cost
        ];
        const result = calcCartTotals(cart, 0);
        expect(result.subtotal).toBe(3500);
        expect(result.totalCost).toBe(2200);
        expect(result.grossProfit).toBe(1300);
    });

    it('should return 0 marginPct when cart is empty', () => {
        const result = calcCartTotals([], 0);
        expect(result.marginPct).toBe(0);
        expect(result.subtotal).toBe(0);
    });
});

// ─── buildSaleRecord ──────────────────────────────────────────

describe('buildSaleRecord', () => {
    it('should throw SaleError when cart is empty', () => {
        expect(() =>
            buildSaleRecord([], 0, 'cash', 'emp1', 'INV-001')
        ).toThrow(SaleError);
    });

    it('should throw SaleError with correct message for empty cart', () => {
        expect(() =>
            buildSaleRecord([], 0, 'cash', 'emp1', 'INV-001')
        ).toThrow('Cannot create sale with empty cart');
    });

    it('should build a valid sale record', () => {
        const cart = [makeCartItem({ qty: 1 })];
        const sale = buildSaleRecord(cart, 0, 'cash', 'Ahmed', 'INV-001');

        expect(sale.invoiceNumber).toBe('INV-001');
        expect(sale.paymentMethod).toBe('cash');
        expect(sale.employee).toBe('Ahmed');
        expect(sale.total).toBe(1500);
        expect(sale.totalCost).toBe(1000);
        expect(sale.grossProfit).toBe(500);
        expect(sale.voidedAt).toBeNull();
        expect(sale.items).toHaveLength(1);
        expect(sale.items[0].productId).toBe('prod-1');
    });

    it('should correctly apply invoice discount', () => {
        const cart = [makeCartItem({ qty: 1 })];
        const sale = buildSaleRecord(cart, 100, 'cash', 'Ahmed', 'INV-002');
        expect(sale.discount).toBe(100);
        expect(sale.total).toBe(1400);
        expect(sale.grossProfit).toBe(400);
    });

    it('should calculate marginPct correctly', () => {
        const cart = [makeCartItem({ qty: 1 })]; // 500 profit on 1500 total
        const sale = buildSaleRecord(cart, 0, 'cash', 'emp1', 'INV-003');
        expect(sale.marginPct).toBeCloseTo(33.3, 0);
    });

    it('should have a valid UUID as id', () => {
        const cart = [makeCartItem()];
        const sale = buildSaleRecord(cart, 0, 'cash', 'emp1', 'INV-004');
        expect(sale.id).toMatch(/^[0-9a-f-]{36}$/i);
    });

    it('should have a valid ISO date', () => {
        const cart = [makeCartItem()];
        const sale = buildSaleRecord(cart, 0, 'cash', 'emp1', 'INV-005');
        expect(new Date(sale.date).getTime()).not.toBeNaN();
    });

    it('should limit total to 0 if discount exceeds subtotal', () => {
        const cart = [makeCartItem({ qty: 1 })]; // subtotal = 1500
        const sale = buildSaleRecord(cart, 9999, 'cash', 'emp1', 'INV-006');
        expect(sale.total).toBe(0);
    });
});
