// ============================================================
// Unit Tests — Returns Domain Logic
// ============================================================

import { describe, it, expect, vi } from 'vitest';
import { processReturn, ReturnError } from '@/domain/returns';
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
            currentQtys
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
            currentQtys
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
            currentQtys
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
            currentQtys
        );
        expect(auditEntries).toHaveLength(1);
    });

    it('should throw ReturnError when reason is empty', () => {
        const sale = makeSale();
        expect(() =>
            processReturn(sale, [{ productId: 'prod-1', qty: 1 }], '', 'user-1', currentQtys)
        ).toThrow(ReturnError);
    });

    it('should throw ReturnError when reason is only whitespace', () => {
        const sale = makeSale();
        expect(() =>
            processReturn(sale, [{ productId: 'prod-1', qty: 1 }], '   ', 'user-1', currentQtys)
        ).toThrow(ReturnError);
        expect(() =>
            processReturn(sale, [{ productId: 'prod-1', qty: 1 }], '   ', 'user-1', currentQtys)
        ).toThrow('سبب الإرجاع مطلوب');
    });

    it('should throw ReturnError for voided sale', () => {
        const sale = makeSale({ voidedAt: '2024-01-16T00:00:00Z' });
        expect(() =>
            processReturn(sale, [{ productId: 'prod-1', qty: 1 }], 'سبب', 'user-1', currentQtys)
        ).toThrow(ReturnError);
        expect(() =>
            processReturn(sale, [{ productId: 'prod-1', qty: 1 }], 'سبب', 'user-1', currentQtys)
        ).toThrow('لا يمكن إرجاع فاتورة ملغاة');
    });

    it('should throw ReturnError for product not in sale', () => {
        const sale = makeSale();
        expect(() =>
            processReturn(sale, [{ productId: 'unknown-prod', qty: 1 }], 'سبب', 'user-1', currentQtys)
        ).toThrow(ReturnError);
    });

    it('should throw ReturnError when returning more than sold qty', () => {
        const sale = makeSale();
        expect(() =>
            processReturn(sale, [{ productId: 'prod-1', qty: 10 }], 'سبب', 'user-1', currentQtys) // sold 3
        ).toThrow(ReturnError);
    });

    it('should throw ReturnError when qty is 0', () => {
        const sale = makeSale();
        expect(() =>
            processReturn(sale, [{ productId: 'prod-1', qty: 0 }], 'سبب', 'user-1', currentQtys)
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
            currentQtys
        );
        expect(returnRecord.items).toHaveLength(2);
        expect(stockMovements).toHaveLength(2);
        expect(returnRecord.totalRefund).toBe(1500 + 100);
    });
});
