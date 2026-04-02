// ============================================================
// Integration Tests — Sale Service
// Tests the full orchestration: validation → FIFO → record
// ============================================================

import { describe, it, expect, vi, beforeEach } from 'vitest';

// ─── Hoist mocks before any imports ──────────────────────────
// Mock audit to avoid getMachineId() calling localStorage at module init
vi.mock('@/domain/audit', () => ({
    createAuditEntry: vi.fn((_userId: string, action: string, entityType: string, entityId: string) => ({
        id: 'audit-mock-id',
        userId: _userId,
        action,
        entityType,
        entityId,
        beforeState: null,
        afterState: null,
        machineId: 'mock-machine-id',
        timestamp: new Date().toISOString(),
    })),
    createVoidAudit: vi.fn((_userId: string, _saleId: string, _reason: string) => ({
        id: 'audit-void-id',
        userId: _userId,
        action: 'sale_voided',
        entityType: 'sale',
        entityId: _saleId,
        beforeState: null,
        afterState: null,
        machineId: 'mock-machine-id',
        timestamp: new Date().toISOString(),
    })),
}));

// Mock batchesData to avoid localStorage dependency
vi.mock('@/data/batchesData', () => {
    let batches: unknown[] = [];
    return {
        getBatchesForProduct: vi.fn((productId: string) =>
            batches
                .filter((b: unknown) => (b as { productId: string }).productId === productId && (b as { remainingQty: number }).remainingQty > 0)
                .sort((a: unknown, b: unknown) => (a as { purchaseDate: string }).purchaseDate.localeCompare((b as { purchaseDate: string }).purchaseDate))
        ),
        getBatches: vi.fn(() => [...batches]),
        saveBatches: vi.fn((b: unknown[]) => { batches = b; }),
        updateBatchQty: vi.fn(),
        restoreBatchQty: vi.fn(),
        getWeightedAvgCost: vi.fn(() => null),
        invalidateBatchesCache: vi.fn(),
        __setMockBatches: (b: unknown[]) => { batches = b; },
    };
});

// Import AFTER mocks are hoisted
import { processSale, voidSale, getCartTotals } from '@/services/saleService';
import type { CartItem, PaymentMethod } from '@/domain/types';

// ─── Fixtures ────────────────────────────────────────────────

const makeProduct = (overrides = {}) => ({
    id: 'p1',
    name: 'iPhone 15',
    model: 'A2846',
    barcode: '123',
    category: 'mobiles',
    supplier: 'Apple',
    costPrice: 1000,
    sellingPrice: 1500,
    quantity: 10,
    minimumMarginPct: 10,
    createdAt: '2024-01-01',
    updatedAt: '2024-01-01',
    deletedAt: null as string | null,
    ...overrides,
});

const makeCartItem = (overrides: Partial<CartItem> = {}): CartItem => ({
    product: makeProduct(),
    qty: 1,
    lineDiscount: 0,
    ...overrides,
});

const makeBatch = (overrides = {}) => ({
    id: 'batch-1',
    productId: 'p1',
    inventoryType: 'mobiles',
    productName: 'iPhone 15',
    costPrice: 1000,
    salePrice: 1500,
    quantity: 10,
    remainingQty: 10,
    purchaseDate: '2024-01-01',
    supplier: 'Apple',
    notes: '',
    createdAt: '2024-01-01T00:00:00Z',
    updatedAt: '2024-01-01T00:00:00Z',
    ...overrides,
});

const makeSale = (overrides = {}) => ({
    id: 'sale-1',
    invoiceNumber: 'INV-2024-0001',
    date: '2024-01-15T10:00:00Z',
    items: [] as CartItem[],
    subtotal: 1500,
    discount: 0,
    total: 1500,
    totalCost: 1000,
    grossProfit: 500,
    marginPct: 33.3,
    paymentMethod: 'cash' as PaymentMethod,
    employee: 'Ahmed',
    voidedAt: null as string | null,
    voidReason: null as string | null,
    voidedBy: null as string | null,
    ...overrides,
}) as unknown as import('@/domain/types').Sale;

beforeEach(async () => {
    const mod = await import('@/data/batchesData') as unknown as { __setMockBatches: (b: unknown[]) => void };
    mod.__setMockBatches([makeBatch()]);
    vi.clearAllMocks();
});

// ─── processSale ─────────────────────────────────────────────

describe('processSale', () => {
    it('should process a valid sale and return result with sale, movements, audit', () => {
        const cart = [makeCartItem()];
        const result = processSale(cart, 0, 'cash', 'user-1', 'Ahmed');

        expect(result.sale).toBeDefined();
        expect(result.sale.total).toBe(1500);
        expect(result.stockMovements).toHaveLength(1);
        expect(result.stockMovements[0].type).toBe('sale');
        expect(result.stockMovements[0].quantityChange).toBe(-1);
        expect(result.auditEntries).toHaveLength(1);
    });

    it('should generate invoice number in correct format', () => {
        const cart = [makeCartItem()];
        const result = processSale(cart, 0, 'cash', 'user-1', 'Ahmed');
        expect(result.sale.invoiceNumber).toMatch(/^INV-\d{4}-\d{4}$/);
    });

    it('should apply invoice discount', () => {
        const cart = [makeCartItem()];
        const result = processSale(cart, 200, 'cash', 'user-1', 'Ahmed');
        expect(result.sale.total).toBe(1300);
        expect(result.sale.discount).toBe(200);
    });

    it('should handle cart item with qty > 1', () => {
        const cart = [makeCartItem({ qty: 2 })];
        const result = processSale(cart, 0, 'cash', 'user-1', 'Ahmed');
        expect(result.sale.items[0].qty).toBe(2);
    });

    it('should throw when product has insufficient stock', () => {
        const cart = [makeCartItem({ product: makeProduct({ quantity: 0 }), qty: 1 })];
        expect(() => processSale(cart, 0, 'cash', 'user-1', 'Ahmed')).toThrow();
    });

    it('should record employee name', () => {
        const cart = [makeCartItem()];
        const result = processSale(cart, 0, 'cash', 'user-1', 'Khaled');
        expect(result.sale.employee).toBe('Khaled');
    });

    it('should record correct payment method', () => {
        const cart = [makeCartItem()];
        const result = processSale(cart, 0, 'cash' as unknown as PaymentMethod, 'user-1', 'Ahmed');
        expect(result.sale.paymentMethod).toBe('cash');
    });
});

// ─── voidSale ─────────────────────────────────────────────────

describe('voidSale', () => {
    it('should void a sale successfully', () => {
        const sale = makeSale({
            items: [{
                productId: 'p1',
                name: 'iPhone 15',
                qty: 1,
                price: 1500,
                cost: 1000,
                lineDiscount: 0,
            }],
        });
        const { voidedSale, stockMovements } = voidSale(sale, 'طلب العميل', 'admin-1', {
            p1: makeProduct(),
        });
        expect(voidedSale.voidedAt).not.toBeNull();
        expect(voidedSale.voidReason).toBe('طلب العميل');
        expect(voidedSale.voidedBy).toBe('admin-1');
        expect(stockMovements).toHaveLength(1);
        expect(stockMovements[0].quantityChange).toBe(1);
        expect(stockMovements[0].type).toBe('return');
    });

    it('should throw when trying to void an already voided sale', () => {
        const sale = makeSale({ voidedAt: '2024-01-16T00:00:00Z' });
        expect(() => voidSale(sale, 'سبب', 'admin-1', {})).toThrow('already voided');
    });

    it('should not mutate original sale', () => {
        const sale = makeSale({
            items: [{
                productId: 'p1',
                name: 'iPhone 15',
                qty: 1,
                price: 1500,
                cost: 1000,
                lineDiscount: 0,
            }],
        });
        voidSale(sale, 'سبب', 'admin-1', { p1: makeProduct() });
        expect(sale.voidedAt).toBeNull();
    });

    it('should create an audit entry', () => {
        const sale = makeSale({
            items: [{
                productId: 'p1',
                name: 'iPhone 15',
                qty: 1,
                price: 1500,
                cost: 1000,
                lineDiscount: 0,
            }],
        });
        const { auditEntry } = voidSale(sale, 'سبب', 'admin-1', { p1: makeProduct() });
        expect(auditEntry).toBeDefined();
    });

    it('restores sold batches when voiding a sale', async () => {
        const sale = makeSale({
            items: [{
                productId: 'p1',
                name: 'iPhone 15',
                qty: 1,
                price: 1500,
                cost: 1000,
                lineDiscount: 0,
                batches: [{ batchId: 'batch-1', qtyFromBatch: 1, costPrice: 1000, salePrice: 1500, profit: 500 }],
            }],
        });
        const batchesData = await import('@/data/batchesData');

        voidSale(sale, 'سبب', 'admin-1', { p1: makeProduct() });

        expect(batchesData.restoreBatchQty).toHaveBeenCalledWith('batch-1', 1);
    });
});

// ─── getCartTotals ────────────────────────────────────────────

describe('getCartTotals', () => {
    it('should return correct totals for non-empty cart', () => {
        const cart = [makeCartItem({ qty: 2 })];
        const result = getCartTotals(cart, 0);
        expect(result.subtotal).toBe(3000);
        expect(result.total).toBe(3000);
        expect(result.grossProfit).toBe(1000); // (1500-1000)*2
    });

    it('should return zero totals for empty cart', () => {
        const result = getCartTotals([], 0);
        expect(result.subtotal).toBe(0);
        expect(result.total).toBe(0);
        expect(result.grossProfit).toBe(0);
    });
});
