// ============================================================
// Unit Tests — Returns Domain Logic
// Includes fraud-guard tests for double-return prevention
// ============================================================

import { describe, it, expect, vi } from 'vitest';
import { processReturn, ReturnError, calculateAlreadyReturnedQty } from '@/domain/returns';
import type { Sale } from '@/domain/types';

// Mock audit to prevent localStorage.getItem in getMachineId()
vi.mock('@/domain/audit', () => ({
    createAuditEntry: vi.fn((_userId, action, entityType, entityId) => ({
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
    createVoidAudit: vi.fn(),
}));


// ─── Fixtures ────────────────────────────────────────────────

const makeSale = (overrides: Partial<Sale> = {}): Sale => ({
    id: 'sale-1',
    invoiceNumber: 'INV-001',
    date: '2024-01-15T10:00:00Z',
    items: [
        { productId: 'prod-1', name: 'iPhone 15', qty: 3, price: 1500, cost: 1000, lineDiscount: 0 },
        { productId: 'prod-2', name: 'Case', qty: 2, price: 100, cost: 50, lineDiscount: 0 },
    ],
    subtotal: 4700,
    discount: 0,
    total: 4700,
    totalCost: 3100,
    grossProfit: 1600,
    marginPct: 34.0,
    paymentMethod: 'cash',
    employee: 'Ahmed',
    voidedAt: null,
    voidReason: null,
    voidedBy: null,
    ...overrides,
});

const currentQtys = { 'prod-1': 10, 'prod-2': 5 };

// ─── processReturn ────────────────────────────────────────────

describe('processReturn', () => {
    it('should create a valid return record', () => {
        const sale = makeSale();
        const { returnRecord } = processReturn(
            sale,
            [{ productId: 'prod-1', qty: 1 }],
            'عيب مصنعي',
            'user-1',
            currentQtys,
            [] // no prior returns
        );
        expect(returnRecord.saleId).toBe('sale-1');
        expect(returnRecord.invoiceNumber).toBe('INV-001');
        expect(returnRecord.reason).toBe('عيب مصنعي');
        expect(returnRecord.processedBy).toBe('user-1');
    });

    it('should calculate totalRefund correctly', () => {
        const sale = makeSale();
        const { returnRecord } = processReturn(
            sale,
            [{ productId: 'prod-1', qty: 2 }], // 2 * 1500 = 3000
            'سبب الإرجاع',
            'user-1',
            currentQtys,
            []
        );
        expect(returnRecord.totalRefund).toBe(3000);
    });

    it('should create stock movements for returned items', () => {
        const sale = makeSale();
        const { stockMovements } = processReturn(
            sale,
            [{ productId: 'prod-1', qty: 1 }],
            'سبب',
            'user-1',
            currentQtys,
            []
        );
        expect(stockMovements).toHaveLength(1);
        expect(stockMovements[0].type).toBe('return');
        expect(stockMovements[0].quantityChange).toBe(1); // stock returned
    });

    it('should create audit entries', () => {
        const sale = makeSale();
        const { auditEntries } = processReturn(
            sale,
            [{ productId: 'prod-1', qty: 1 }],
            'سبب',
            'user-1',
            currentQtys,
            []
        );
        expect(auditEntries).toHaveLength(1);
    });

    it('should throw ReturnError when reason is empty', () => {
        const sale = makeSale();
        expect(() =>
            processReturn(sale, [{ productId: 'prod-1', qty: 1 }], '', 'user-1', currentQtys, [])
        ).toThrow(ReturnError);
    });

    it('should throw ReturnError when reason is only whitespace', () => {
        const sale = makeSale();
        expect(() =>
            processReturn(sale, [{ productId: 'prod-1', qty: 1 }], '   ', 'user-1', currentQtys, [])
        ).toThrow(ReturnError);
        expect(() =>
            processReturn(sale, [{ productId: 'prod-1', qty: 1 }], '   ', 'user-1', currentQtys, [])
        ).toThrow('سبب الإرجاع مطلوب');
    });

    it('should throw ReturnError for voided sale', () => {
        const sale = makeSale({ voidedAt: '2024-01-16T00:00:00Z' });
        expect(() =>
            processReturn(sale, [{ productId: 'prod-1', qty: 1 }], 'سبب', 'user-1', currentQtys, [])
        ).toThrow(ReturnError);
        expect(() =>
            processReturn(sale, [{ productId: 'prod-1', qty: 1 }], 'سبب', 'user-1', currentQtys, [])
        ).toThrow('لا يمكن إرجاع فاتورة ملغاة');
    });

    it('should throw ReturnError for product not in sale', () => {
        const sale = makeSale();
        expect(() =>
            processReturn(sale, [{ productId: 'unknown-prod', qty: 1 }], 'سبب', 'user-1', currentQtys, [])
        ).toThrow(ReturnError);
    });

    it('should throw ReturnError when returning more than sold qty', () => {
        const sale = makeSale();
        expect(() =>
            processReturn(sale, [{ productId: 'prod-1', qty: 10 }], 'سبب', 'user-1', currentQtys, []) // sold 3
        ).toThrow(ReturnError);
    });

    it('should throw ReturnError when qty is 0', () => {
        const sale = makeSale();
        expect(() =>
            processReturn(sale, [{ productId: 'prod-1', qty: 0 }], 'سبب', 'user-1', currentQtys, [])
        ).toThrow(ReturnError);
    });

    it('should handle multiple items in return', () => {
        const sale = makeSale();
        const { returnRecord, stockMovements } = processReturn(
            sale,
            [
                { productId: 'prod-1', qty: 1 },
                { productId: 'prod-2', qty: 1 },
            ],
            'سبب الإرجاع',
            'user-1',
            currentQtys,
            []
        );
        expect(returnRecord.items).toHaveLength(2);
        expect(stockMovements).toHaveLength(2);
        expect(returnRecord.totalRefund).toBe(1500 + 100);
    });

    // ── Fraud Guard Tests ──────────────────────────────────────────

    it('FRAUD GUARD: should throw when item was already fully returned', () => {
        const sale = makeSale();
        // Simulate a prior return that consumed all 3 units of prod-1
        const priorReturn = {
            saleId: 'sale-1',
            items: [{ productId: 'prod-1', qty: 3 }],
        };
        expect(() =>
            processReturn(
                sale,
                [{ productId: 'prod-1', qty: 1 }],
                'second attempt',
                'user-1',
                currentQtys,
                [priorReturn]
            )
        ).toThrow('تم إرجاع "iPhone 15" بالكامل مسبقاً');
    });

    it('FRAUD GUARD: should throw when partial double-return exceeds remaining', () => {
        const sale = makeSale();
        // Prior return consumed 2 of 3 units — only 1 remains
        const priorReturn = {
            saleId: 'sale-1',
            items: [{ productId: 'prod-1', qty: 2 }],
        };
        expect(() =>
            processReturn(
                sale,
                [{ productId: 'prod-1', qty: 2 }], // requesting 2 but only 1 available
                'second return',
                'user-1',
                currentQtys,
                [priorReturn]
            )
        ).toThrow('الحد الأقصى المتاح للإرجاع: 1');
    });

    it('FRAUD GUARD: should allow partial return when previous partial return left units remaining', () => {
        const sale = makeSale();
        // Prior return consumed 1 of 3 units — 2 remain
        const priorReturn = {
            saleId: 'sale-1',
            items: [{ productId: 'prod-1', qty: 1 }],
        };
        const { returnRecord } = processReturn(
            sale,
            [{ productId: 'prod-1', qty: 2 }],
            'rest of return',
            'user-1',
            currentQtys,
            [priorReturn]
        );
        expect(returnRecord.totalRefund).toBe(2 * 1500); // 3000
    });

    it('FRAUD GUARD: supports StoredReturnRecord field name (originalSaleId)', () => {
        const sale = makeSale();
        // StoredReturnRecord uses originalSaleId instead of saleId
        const priorReturn = {
            originalSaleId: 'sale-1', // data-layer field name
            items: [{ productId: 'prod-1', qty: 3 }],
        };
        expect(() =>
            processReturn(
                sale,
                [{ productId: 'prod-1', qty: 1 }],
                'attempt',
                'user-1',
                currentQtys,
                [priorReturn as { saleId?: string; originalSaleId?: string; items: { productId: string; qty: number }[] }]
            )
        ).toThrow('تم إرجاع "iPhone 15" بالكامل مسبقاً');
    });

    it('FRAUD GUARD: returns from other sales do not affect this sale', () => {
        const sale = makeSale();
        // This return is for a DIFFERENT sale — should not affect sale-1
        const unrelatedReturn = {
            saleId: 'sale-999',
            items: [{ productId: 'prod-1', qty: 3 }],
        };
        // Should succeed — different sale's returns don't count
        const { returnRecord } = processReturn(
            sale,
            [{ productId: 'prod-1', qty: 3 }],
            'valid return',
            'user-1',
            currentQtys,
            [unrelatedReturn]
        );
        expect(returnRecord.totalRefund).toBe(3 * 1500);
    });
});

// ─── calculateAlreadyReturnedQty ─────────────────────────────

describe('calculateAlreadyReturnedQty', () => {
    it('returns empty map when no returns exist', () => {
        const result = calculateAlreadyReturnedQty('sale-1', []);
        expect(result.size).toBe(0);
    });

    it('sums quantities from multiple returns for the same sale', () => {
        const returns = [
            { saleId: 'sale-1', items: [{ productId: 'p1', qty: 2 }] },
            { saleId: 'sale-1', items: [{ productId: 'p1', qty: 1 }, { productId: 'p2', qty: 3 }] },
        ];
        const result = calculateAlreadyReturnedQty('sale-1', returns);
        expect(result.get('p1')).toBe(3);
        expect(result.get('p2')).toBe(3);
    });

    it('ignores returns for other sales', () => {
        const returns = [
            { saleId: 'sale-other', items: [{ productId: 'p1', qty: 5 }] },
        ];
        const result = calculateAlreadyReturnedQty('sale-1', returns);
        expect(result.size).toBe(0);
    });
});
