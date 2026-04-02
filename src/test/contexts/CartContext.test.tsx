import { act, renderHook } from '@testing-library/react';
import type { ReactNode } from 'react';

import { CartProvider, useCart } from '@/contexts/CartContext';

const makeProduct = (overrides = {}) => ({
    id: 'prod-1',
    name: 'iPhone 15',
    model: 'A2846',
    barcode: '123456789',
    category: 'mobiles',
    supplier: 'Apple',
    costPrice: 1000,
    sellingPrice: 1500,
    quantity: 10,
    minimumMarginPct: 10,
    createdAt: '2024-01-01',
    updatedAt: '2024-01-01',
    deletedAt: null,
    ...overrides,
});

function wrapper({ children }: { children: ReactNode }) {
    return <CartProvider>{children}</CartProvider>;
}

describe('CartContext getTotals', () => {
    beforeEach(() => {
        localStorage.clear();
    });

    it('counts a line discount once per cart line and combines it with invoice discount', () => {
        const { result } = renderHook(() => useCart(), { wrapper });
        const product = makeProduct();

        act(() => {
            result.current.addToCart(product, 3);
            result.current.updateLineDiscount(product.id, 30);
            result.current.applyInvoiceDiscount(20);
        });

        const totals = result.current.getTotals();

        expect(totals.subtotal).toBe(4470);
        expect(totals.discount).toBe(50);
        expect(totals.total).toBe(4450);
        expect(totals.itemCount).toBe(3);
    });
});
