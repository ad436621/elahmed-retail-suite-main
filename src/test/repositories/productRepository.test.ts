import { beforeEach, describe, expect, it } from 'vitest';
import { STORAGE_KEYS } from '@/config';
import { getStorageItem, setStorageItem } from '@/lib/localStorageHelper';
import {
  getAllInventoryProducts,
  isBarcodeDuplicate,
  updateProductQuantity,
} from '@/repositories/productRepository';

beforeEach(() => {
  localStorage.clear();
});

describe('productRepository', () => {
  it('includes spare parts in barcode duplication checks and quantity updates', () => {
    setStorageItem(STORAGE_KEYS.MOBILE_SPARE_PARTS, [
      {
        id: 'mobile-spare-1',
        name: 'iPhone Screen',
        model: '14 Pro',
        barcode: 'MSP-001',
        category: 'screens',
        subcategory: 'display',
        quantity: 4,
        condition: 'new',
        color: 'black',
        oldCostPrice: 0,
        newCostPrice: 500,
        salePrice: 650,
        notes: '',
        description: '',
        createdAt: '2026-01-01T00:00:00.000Z',
        updatedAt: '2026-01-01T00:00:00.000Z',
      },
    ]);

    setStorageItem(STORAGE_KEYS.COMPUTER_SPARE_PARTS, [
      {
        id: 'computer-spare-1',
        name: 'Laptop RAM',
        brand: 'Kingston',
        category: 'RAM',
        model: '16GB',
        barcode: 'CSP-001',
        condition: 'new',
        quantity: 2,
        costPrice: 300,
        salePrice: 420,
        notes: '',
        description: '',
        createdAt: '2026-01-01T00:00:00.000Z',
        updatedAt: '2026-01-01T00:00:00.000Z',
      },
    ]);

    expect(isBarcodeDuplicate('MSP-001')).toBe(true);
    expect(isBarcodeDuplicate('CSP-001')).toBe(true);

    const inventoryIds = getAllInventoryProducts().map((product) => product.id);
    expect(inventoryIds).toEqual(expect.arrayContaining(['mobile-spare-1', 'computer-spare-1']));

    updateProductQuantity('mobile-spare-1', 7);
    updateProductQuantity('computer-spare-1', 5);

    const mobileSpareParts = getStorageItem<Array<{ id: string; quantity: number }>>(STORAGE_KEYS.MOBILE_SPARE_PARTS, []);
    const computerSpareParts = getStorageItem<Array<{ id: string; quantity: number }>>(STORAGE_KEYS.COMPUTER_SPARE_PARTS, []);

    expect(mobileSpareParts.find((item) => item.id === 'mobile-spare-1')?.quantity).toBe(7);
    expect(computerSpareParts.find((item) => item.id === 'computer-spare-1')?.quantity).toBe(5);
  });
});
