// ============================================================
// Unit Tests — Discount Domain Logic
// ============================================================

import { describe, it, expect } from 'vitest';
import {
    getDiscountLimits,
    validateLineDiscount,
    validateInvoiceDiscount,
    detectAbnormalDiscounts,
    DiscountError,
} from '@/domain/discount';
// UserRole in types.ts now includes 'super_admin' | 'admin' | 'employee'

// ─── getDiscountLimits ────────────────────────────────────────

describe('getDiscountLimits', () => {
    it('should return 100% limits for super_admin', () => {
        const limits = getDiscountLimits('super_admin');
        expect(limits.maxLinePct).toBe(100);
        expect(limits.maxInvoicePct).toBe(100);
    });

    it('should return correct limits for admin', () => {
        const limits = getDiscountLimits('admin');
        expect(limits.maxLinePct).toBe(30);
        expect(limits.maxInvoicePct).toBe(20);
    });

    it('should return employee limits for employee', () => {
        const limits = getDiscountLimits('employee');
        expect(limits.maxLinePct).toBe(10);
        expect(limits.maxInvoicePct).toBe(5);
    });

    it('should fallback to employee limits for unknown role', () => {
        const limits = getDiscountLimits('unknown_role' as any);
        expect(limits.maxLinePct).toBe(10);
        expect(limits.maxInvoicePct).toBe(5);
    });
});

// ─── validateLineDiscount ─────────────────────────────────────

describe('validateLineDiscount', () => {
    it('should not throw when discount is 0', () => {
        expect(() => validateLineDiscount(0, 1000, 'admin')).not.toThrow();
    });

    it('should not throw when discount is within employee limit (10%)', () => {
        expect(() => validateLineDiscount(100, 1000, 'employee')).not.toThrow(); // 10%
    });

    it('should throw when employee discount exceeds 10%', () => {
        expect(() => validateLineDiscount(101, 1000, 'employee')).toThrow(DiscountError);
    });

    it('should not throw when admin discount is within 30%', () => {
        expect(() => validateLineDiscount(300, 1000, 'admin')).not.toThrow();
    });

    it('should throw when admin discount exceeds 30%', () => {
        expect(() => validateLineDiscount(301, 1000, 'admin')).toThrow(DiscountError);
    });

    it('should allow super_admin to give 100% discount', () => {
        expect(() => validateLineDiscount(1000, 1000, 'super_admin')).not.toThrow();
    });

    it('should throw DiscountError for negative discount', () => {
        expect(() => validateLineDiscount(-10, 1000, 'admin')).toThrow(DiscountError);
        expect(() => validateLineDiscount(-10, 1000, 'admin')).toThrow('Discount cannot be negative');
    });

    it('should not throw when lineTotal is 0 (avoids division by zero)', () => {
        expect(() => validateLineDiscount(0, 0, 'employee')).not.toThrow();
    });

    it('should include percentage info in the error message', () => {
        try {
            validateLineDiscount(200, 1000, 'employee'); // 20% — exceeds employee 10%
            expect.fail('should have thrown');
        } catch (e: any) {
            expect(e.message).toContain('%');
            expect(e.message).toContain('10');
        }
    });
});

// ─── validateInvoiceDiscount ──────────────────────────────────

describe('validateInvoiceDiscount', () => {
    it('should not throw when invoice discount is within limit', () => {
        expect(() => validateInvoiceDiscount(50, 1000, 'employee')).not.toThrow(); // 5%
    });

    it('should throw when employee invoice discount exceeds 5%', () => {
        expect(() => validateInvoiceDiscount(51, 1000, 'employee')).toThrow(DiscountError);
    });

    it('should not throw when admin invoice discount is within 20%', () => {
        expect(() => validateInvoiceDiscount(200, 1000, 'admin')).not.toThrow();
    });

    it('should throw when admin invoice discount exceeds 20%', () => {
        expect(() => validateInvoiceDiscount(201, 1000, 'admin')).toThrow(DiscountError);
    });

    it('should not throw when subtotal is 0', () => {
        expect(() => validateInvoiceDiscount(0, 0, 'employee')).not.toThrow();
    });

    it('should throw DiscountError for negative discount', () => {
        expect(() => validateInvoiceDiscount(-50, 1000, 'admin')).toThrow(DiscountError);
    });
});

// ─── detectAbnormalDiscounts ──────────────────────────────────

describe('detectAbnormalDiscounts', () => {
    it('should return isAbnormal=false when fewer than 5 data points', () => {
        const result = detectAbnormalDiscounts([100, 200, 150]);
        expect(result.isAbnormal).toBe(false);
        expect(result.avgDiscount).toBe(0);
    });

    it('should detect normal distribution as non-abnormal', () => {
        const values = [100, 110, 100, 105, 100]; // similar values
        const result = detectAbnormalDiscounts(values);
        expect(result.isAbnormal).toBe(false);
        expect(result.avgDiscount).toBeGreaterThan(0);
    });

    it('should detect extreme outlier as abnormal (clearly exceeds threshold)', () => {
        // With 5 identical + 1 outlier, |outlier-avg| > 2*stdDev (ratio ≈ 2.27 > 2.0)
        // Mathematical note: n=5 always gives exactly 2*stdDev, n>=6 breaks past it
        const values = [100, 100, 100, 100, 100, 9999]; // 6 values — outlier truly exceeds 2σ
        const result = detectAbnormalDiscounts(values);
        expect(result.isAbnormal).toBe(true);
    });

    it('should return rounded avgDiscount', () => {
        const values = [10, 20, 30, 40, 25, 15];
        const result = detectAbnormalDiscounts(values);
        expect(result.avgDiscount).toBe(Math.round(result.avgDiscount * 100) / 100);
    });

    it('should use custom threshold', () => {
        const values = [100, 100, 100, 100, 200]; // small outlier
        const strictResult = detectAbnormalDiscounts(values, 0.5);
        const looseResult = detectAbnormalDiscounts(values, 10);
        expect(strictResult.isAbnormal).toBe(true);
        expect(looseResult.isAbnormal).toBe(false);
    });
});
