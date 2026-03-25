import { beforeEach, describe, expect, it } from 'vitest';
import { STORAGE_KEYS } from '@/config';
import { getStorageItem } from '@/lib/localStorageHelper';
import { getAllMovements, getMovementsByProduct, saveMovement, saveMovements } from '@/repositories/stockRepository';
import type { StockMovement } from '@/domain/types';

const makeMovement = (overrides: Partial<StockMovement> = {}): StockMovement => ({
  id: crypto.randomUUID(),
  productId: 'prod-1',
  type: 'sale',
  quantityChange: -1,
  previousQuantity: 5,
  newQuantity: 4,
  reason: 'Test movement',
  referenceId: null,
  userId: 'user-1',
  timestamp: '2026-03-25T10:00:00.000Z',
  ...overrides,
});

beforeEach(() => {
  localStorage.clear();
});

describe('stockRepository', () => {
  it('persists movements to storage', () => {
    saveMovement(makeMovement());

    const stored = getStorageItem<StockMovement[]>(STORAGE_KEYS.STOCK_MOVEMENTS, []);
    expect(stored).toHaveLength(1);
    expect(getAllMovements()).toHaveLength(1);
  });

  it('filters movements by product id after bulk save', () => {
    saveMovements([
      makeMovement({ productId: 'prod-1' }),
      makeMovement({ productId: 'prod-2', quantityChange: 2, newQuantity: 7, previousQuantity: 5, type: 'return' }),
    ]);

    expect(getMovementsByProduct('prod-1')).toHaveLength(1);
    expect(getMovementsByProduct('prod-2')).toHaveLength(1);
  });
});
