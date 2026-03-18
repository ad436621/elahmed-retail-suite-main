import { describe, it, expect } from 'vitest';
import { filterActiveSales, summarizeSales, inDateRange, filterSalesByDateRange } from '@/lib/statistics';
import type { Sale } from '@/domain/types';

describe('statistics helpers', () => {
  const allSales: Sale[] = [
    { id: '1', invoiceNumber: 'INV-1', date: '2025-06-01', items: [], subtotal: 100, discount: 0, total: 100, totalCost: 70, grossProfit: 30, marginPct: 30, paymentMethod: 'cash', employee: 'u1', voidedAt: null, voidReason: null, voidedBy: null },
    { id: '2', invoiceNumber: 'INV-2', date: '2025-06-02', items: [], subtotal: 200, discount: 0, total: 200, totalCost: 130, grossProfit: 70, marginPct: 35, paymentMethod: 'card', employee: 'u2', voidedAt: '2025-06-03', voidReason: 'cancel', voidedBy: 'u2' },
    { id: '3', invoiceNumber: 'INV-3', date: '2025-06-03', items: [], subtotal: 50, discount: 0, total: 50, totalCost: 25, grossProfit: 25, marginPct: 50, paymentMethod: 'cash', employee: 'u1', voidedAt: null, voidReason: null, voidedBy: null },
  ];

  it('filters out voided sales', () => {
    const active = filterActiveSales(allSales);
    expect(active).toHaveLength(2);
    expect(active.map(s => s.id)).toEqual(['1', '3']);
  });

  it('summarizes totals excluding voided sales', () => {
    const summary = summarizeSales(allSales);
    expect(summary.totalRevenue).toBe(150);
    expect(summary.totalProfit).toBe(55);
    expect(summary.totalItems).toBe(2);
    expect(summary.avgInvoice).toBe(75);
    expect(summary.profitMarginPercent).toBeCloseTo((55 / 150) * 100);
  });

  it('validates inDateRange', () => {
    expect(inDateRange('2025-06-10', '2025-06-01', '2025-06-15')).toBe(true);
    expect(inDateRange('2025-06-20', '2025-06-01', '2025-06-15')).toBe(false);
    expect(inDateRange(undefined, '2025-06-01', '2025-06-15')).toBe(false);
  });

  it('filters sales in date range', () => {
    const filtered = filterSalesByDateRange(allSales, '2025-06-02', '2025-06-03');
    expect(filtered.map(s => s.id)).toEqual(['2', '3']);
  });
});