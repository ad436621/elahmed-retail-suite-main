import { beforeEach, describe, expect, it, vi } from 'vitest';
import { STORAGE_KEYS } from '@/config';
import { getStorageItem, setStorageItem } from '@/lib/localStorageHelper';
import type { Sale } from '@/domain/types';

const makeSale = (overrides: Partial<Sale> = {}): Sale => ({
  id: 'sale-1',
  invoiceNumber: 'INV-2026-0001',
  date: '2026-03-31T10:00:00.000Z',
  items: [{ productId: 'prod-1', name: 'Phone', qty: 1, price: 1500, cost: 1000, lineDiscount: 0 }],
  subtotal: 1500,
  discount: 0,
  total: 1500,
  totalCost: 1000,
  grossProfit: 500,
  marginPct: 33.33,
  paymentMethod: 'cash',
  employee: 'Tester',
  status: 'active',
  voidedAt: null,
  voidReason: null,
  voidedBy: null,
  ...overrides,
});

beforeEach(() => {
  localStorage.clear();
  vi.resetModules();
  Object.defineProperty(window, 'electron', {
    configurable: true,
    value: undefined,
  });
});

describe('saleRepository', () => {
  it('reads sales from the current gx key', async () => {
    setStorageItem(STORAGE_KEYS.SALES, [makeSale()]);

    const { getAllSales } = await import('@/repositories/saleRepository');

    expect(getAllSales()).toHaveLength(1);
    expect(getAllSales()[0]?.invoiceNumber).toBe('INV-2026-0001');
  });

  it('falls back to legacy sales and migrates them to the current gx key', async () => {
    setStorageItem(STORAGE_KEYS.SALES_LEGACY, [makeSale({ id: 'legacy-sale', invoiceNumber: 'INV-2026-0003' })]);

    const { getAllSales } = await import('@/repositories/saleRepository');

    expect(getAllSales()).toHaveLength(1);
    expect(getAllSales()[0]?.invoiceNumber).toBe('INV-2026-0003');
    expect(getStorageItem<Sale[]>(STORAGE_KEYS.SALES, [])).toHaveLength(1);
  });
});
