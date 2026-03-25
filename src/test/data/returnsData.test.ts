import { beforeEach, describe, expect, it } from 'vitest';
import { addReturnRecord, getReturnedQuantitiesBySaleId, getReturnsBySaleId } from '@/data/returnsData';

beforeEach(() => {
  localStorage.clear();
});

describe('returnsData', () => {
  it('assigns monotonic return numbers even after manual gaps', () => {
    const first = addReturnRecord({
      originalInvoiceNumber: 'INV-001',
      originalSaleId: 'sale-1',
      date: '2026-03-25',
      items: [{ productId: 'prod-1', name: 'Phone', qty: 1, price: 100, reason: '' }],
      totalRefund: 100,
      reason: 'Test',
      processedBy: 'user-1',
    });

    expect(first.returnNumber).toBe('RET-0001');

    const second = addReturnRecord({
      originalInvoiceNumber: 'INV-002',
      originalSaleId: 'sale-2',
      date: '2026-03-25',
      items: [{ productId: 'prod-2', name: 'Case', qty: 2, price: 50, reason: '' }],
      totalRefund: 100,
      reason: 'Test',
      processedBy: 'user-1',
    });

    expect(second.returnNumber).toBe('RET-0002');
  });

  it('aggregates returned quantities per sale', () => {
    addReturnRecord({
      originalInvoiceNumber: 'INV-001',
      originalSaleId: 'sale-1',
      date: '2026-03-25',
      items: [
        { productId: 'prod-1', name: 'Phone', qty: 1, price: 100, reason: '' },
        { productId: 'prod-2', name: 'Case', qty: 2, price: 50, reason: '' },
      ],
      totalRefund: 200,
      reason: 'Test',
      processedBy: 'user-1',
    });

    addReturnRecord({
      originalInvoiceNumber: 'INV-001',
      originalSaleId: 'sale-1',
      date: '2026-03-26',
      items: [{ productId: 'prod-1', name: 'Phone', qty: 2, price: 100, reason: '' }],
      totalRefund: 200,
      reason: 'Test',
      processedBy: 'user-1',
    });

    expect(getReturnsBySaleId('sale-1')).toHaveLength(2);
    expect(getReturnedQuantitiesBySaleId('sale-1')).toEqual({
      'prod-1': 3,
      'prod-2': 2,
    });
  });
});
