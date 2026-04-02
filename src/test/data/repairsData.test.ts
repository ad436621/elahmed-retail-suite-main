import { beforeEach, describe, expect, it, vi } from 'vitest';

import { STORAGE_KEYS } from '@/config';

beforeEach(() => {
  localStorage.clear();
  vi.resetModules();

  Object.defineProperty(window, 'electron', {
    configurable: true,
    value: undefined,
  });
});

describe('repairsData local fallback', () => {
  it('persists repair parts when Electron IPC is unavailable', async () => {
    const { addRepairPart, getRepairParts, updateRepairPart } = await import('@/data/repairsData');

    const created = await addRepairPart({
      name: 'iPhone 13 Screen',
      category: 'Screens',
      qty: 2,
      min_qty: 1,
      unit_cost: 1800,
      selling_price: 2400,
    });

    expect(created.id).toBeTruthy();

    const persistedParts = JSON.parse(localStorage.getItem(STORAGE_KEYS.REPAIR_PARTS) ?? '[]');
    expect(persistedParts).toHaveLength(1);
    expect(persistedParts[0]?.name).toBe('iPhone 13 Screen');

    const updated = await updateRepairPart(created.id, { qty: 5 });
    expect(updated.qty).toBe(5);

    const parts = await getRepairParts();
    expect(parts).toHaveLength(1);
    expect(parts[0]?.qty).toBe(5);
    expect(parts[0]?.min_qty).toBe(1);
  });

  it('normalizes legacy repair-part fields from storage', async () => {
    localStorage.setItem(STORAGE_KEYS.REPAIR_PARTS, JSON.stringify([
      {
        id: 'repair-part-1',
        name: 'Samsung Battery',
        current_stock: 3,
        min_stock: 1,
        cost_price: 250,
        selling_price: 400,
        created_at: '2026-04-01T10:00:00.000Z',
      },
    ]));

    const { getRepairParts } = await import('@/data/repairsData');
    const parts = await getRepairParts();

    expect(parts).toHaveLength(1);
    expect(parts[0]?.qty).toBe(3);
    expect(parts[0]?.min_qty).toBe(1);
    expect(parts[0]?.unit_cost).toBe(250);
    expect(parts[0]?.selling_price).toBe(400);
    expect(parts[0]?.createdAt).toBe('2026-04-01T10:00:00.000Z');
  });
});
