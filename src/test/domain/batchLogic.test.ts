// ============================================================
// Unit Tests — Batch Logic (FIFO)
// ============================================================

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
    calculateFIFOSale,
    getActiveSalePrice,
    getOldestCostPrice,
    getAvailableBatchesCount,
    BatchError,
} from '@/domain/batchLogic';
import type { ProductBatch } from '@/domain/types';

// ─── Mock batchesData ─────────────────────────────────────────
// batchLogic depends on @/data/batchesData which uses localStorage
// We mock it to run pure logic tests

vi.mock('@/data/batchesData', () => {
    let mockBatches: ProductBatch[] = [];
    return {
        getBatchesForProduct: vi.fn((productId: string) =>
            mockBatches
                .filter(b => b.productId === productId && b.remainingQty > 0)
                .sort((a, b) => a.purchaseDate.localeCompare(b.purchaseDate))
        ),
        getBatches: vi.fn(() => [...mockBatches]),
        saveBatches: vi.fn((batches: ProductBatch[]) => { mockBatches = batches; }),
        updateBatchQty: vi.fn(),
        __setMockBatches: (batches: ProductBatch[]) => { mockBatches = batches; },
    };
});

// ─── Helper to set mock data ─────────────────────────────────

async function setMockBatches(batches: ProductBatch[]) {
    const mod = await import('@/data/batchesData') as any;
    mod.__setMockBatches(batches);
}

const makeBatch = (overrides: Partial<ProductBatch> = {}): ProductBatch => ({
    id: `batch-${Math.random().toString(36).slice(2)}`,
    productId: 'prod-1',
    inventoryType: 'mobiles',
    productName: 'iPhone 15',
    costPrice: 1000,
    salePrice: 1500,
    quantity: 5,
    remainingQty: 5,
    purchaseDate: '2024-01-01',
    supplier: 'Apple',
    notes: '',
    createdAt: '2024-01-01T00:00:00Z',
    updatedAt: '2024-01-01T00:00:00Z',
    ...overrides,
});

// ─── calculateFIFOSale ────────────────────────────────────────

describe('calculateFIFOSale', () => {
    beforeEach(async () => {
        await setMockBatches([
            makeBatch({ id: 'b1', purchaseDate: '2024-01-01', costPrice: 800, salePrice: 1200, remainingQty: 3 }),
            makeBatch({ id: 'b2', purchaseDate: '2024-02-01', costPrice: 1000, salePrice: 1500, remainingQty: 5 }),
        ]);
    });

    it('should deduct from oldest batch first (FIFO)', () => {
        const result = calculateFIFOSale('prod-1', 2);
        expect(result.batches[0].batchId).toBe('b1');
        expect(result.batches[0].qtyFromBatch).toBe(2);
    });

    it('should span multiple batches when needed', () => {
        const result = calculateFIFOSale('prod-1', 5);
        expect(result.batches).toHaveLength(2);
        expect(result.batches[0].batchId).toBe('b1');
        expect(result.batches[0].qtyFromBatch).toBe(3);
        expect(result.batches[1].batchId).toBe('b2');
        expect(result.batches[1].qtyFromBatch).toBe(2);
    });

    it('should calculate totalCost correctly', () => {
        // Takes 3 from b1 (cost 800) + 2 from b2 (cost 1000)
        const result = calculateFIFOSale('prod-1', 5);
        expect(result.totalCost).toBe(3 * 800 + 2 * 1000); // 4400
    });

    it('should calculate totalProfit correctly', () => {
        const result = calculateFIFOSale('prod-1', 3); // all from b1: (1200-800)*3 = 1200
        expect(result.totalProfit).toBe((1200 - 800) * 3);
    });

    it('should use overrideSalePrice when provided', () => {
        const result = calculateFIFOSale('prod-1', 1, 999);
        expect(result.batches[0].salePrice).toBe(999);
        expect(result.batches[0].profit).toBe(999 - 800);
    });

    it('should throw BatchError when requested qty exceeds available stock', () => {
        expect(() => calculateFIFOSale('prod-1', 100)).toThrow(BatchError);
    });

    it('should throw BatchError for product with no batches', () => {
        expect(() => calculateFIFOSale('no-such-product', 1)).toThrow(BatchError);
    });

    it('should handle exact stock quantity (no leftovers)', () => {
        const result = calculateFIFOSale('prod-1', 8); // exactly 3+5
        expect(result.batches).toHaveLength(2);
        const totalTaken = result.batches.reduce((s, b) => s + b.qtyFromBatch, 0);
        expect(totalTaken).toBe(8);
    });
});

// ─── getActiveSalePrice ───────────────────────────────────────

describe('getActiveSalePrice', () => {
    it('should return sale price of oldest available batch', async () => {
        await setMockBatches([
            makeBatch({ purchaseDate: '2024-01-01', salePrice: 1200, remainingQty: 3 }),
            makeBatch({ purchaseDate: '2024-02-01', salePrice: 1500, remainingQty: 5 }),
        ]);
        const price = getActiveSalePrice('prod-1');
        expect(price).toBe(1200); // oldest first
    });

    it('should return null when no batches available', async () => {
        await setMockBatches([]);
        const price = getActiveSalePrice('prod-1');
        expect(price).toBeNull();
    });
});

// ─── getOldestCostPrice ───────────────────────────────────────

describe('getOldestCostPrice', () => {
    it('should return cost price of oldest batch', async () => {
        await setMockBatches([
            makeBatch({ purchaseDate: '2024-01-01', costPrice: 800, remainingQty: 2 }),
        ]);
        expect(getOldestCostPrice('prod-1')).toBe(800);
    });

    it('should return null when no batches', async () => {
        await setMockBatches([]);
        expect(getOldestCostPrice('prod-1')).toBeNull();
    });
});

// ─── getAvailableBatchesCount ─────────────────────────────────

describe('getAvailableBatchesCount', () => {
    it('should count available batches', async () => {
        await setMockBatches([
            makeBatch({ remainingQty: 3 }),
            makeBatch({ remainingQty: 1 }),
        ]);
        expect(getAvailableBatchesCount('prod-1')).toBe(2);
    });

    it('should return 0 when no batches', async () => {
        await setMockBatches([]);
        expect(getAvailableBatchesCount('prod-1')).toBe(0);
    });
});
