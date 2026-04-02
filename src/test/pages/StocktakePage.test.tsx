import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { STORAGE_KEYS } from '@/config';
import StocktakePage from '@/pages/StocktakePage';

const mockConfirm = vi.fn();
const mockToast = vi.fn();
const mockGetAllInventoryProducts = vi.fn();

vi.mock('@/contexts/AuthContext', () => ({
  useAuth: () => ({
    user: {
      fullName: 'Inventory Tester',
      username: 'tester',
    },
  }),
}));

vi.mock('@/components/ConfirmDialog', () => ({
  useConfirm: () => ({
    confirm: mockConfirm,
  }),
}));

vi.mock('@/hooks/use-toast', () => ({
  useToast: () => ({
    toast: mockToast,
  }),
}));

vi.mock('@/repositories/productRepository', () => ({
  getAllInventoryProducts: () => mockGetAllInventoryProducts(),
}));

describe('StocktakePage', () => {
  beforeEach(() => {
    localStorage.clear();
    mockConfirm.mockReset();
    mockConfirm.mockResolvedValue(true);
    mockToast.mockReset();
    mockGetAllInventoryProducts.mockReset();
    mockGetAllInventoryProducts.mockReturnValue([
      {
        id: 'prod-1',
        name: 'Galaxy S24 Ultra',
        category: 'Mobiles',
        barcode: '111',
        source: 'mobile',
        quantity: 5,
      },
      {
        id: 'prod-2',
        name: 'USB-C Charger',
        category: 'Accessories',
        barcode: '222',
        source: 'mobile_acc',
        quantity: 8,
      },
    ]);
  });

  it('creates and finalizes stocktake sessions from a live inventory snapshot', async () => {
    render(<StocktakePage />);

    fireEvent.click(screen.getByTestId('stocktake-add'));

    const storedDrafts = JSON.parse(localStorage.getItem(STORAGE_KEYS.STOCKTAKE) ?? '[]');
    expect(storedDrafts).toHaveLength(1);
    expect(storedDrafts[0]?.status).toBe('draft');
    expect(storedDrafts[0]?.items).toHaveLength(2);
    expect(storedDrafts[0]?.items[0]?.difference).toBe(0);

    const countedInputs = screen.getAllByRole('spinbutton');
    fireEvent.change(countedInputs[0], { target: { value: '4' } });

    fireEvent.click(screen.getByRole('button', { name: 'اعتماد الجلسة' }));

    await waitFor(() => expect(mockConfirm).toHaveBeenCalled());

    const storedCompleted = JSON.parse(localStorage.getItem(STORAGE_KEYS.STOCKTAKE) ?? '[]');
    expect(storedCompleted[0]?.status).toBe('completed');
    expect(storedCompleted[0]?.items[0]?.countedQty).toBe(4);
    expect(storedCompleted[0]?.items[0]?.difference).toBe(-1);
  });
});
