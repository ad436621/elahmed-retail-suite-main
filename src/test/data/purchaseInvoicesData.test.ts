import { beforeEach, describe, expect, it } from 'vitest';
import { addPurchaseInvoice, deletePurchaseInvoice, getPurchaseInvoices } from '@/data/purchaseInvoicesData';

beforeEach(() => {
  localStorage.clear();
});

describe('purchaseInvoicesData', () => {
  it('keeps invoice numbers monotonic after deletion', () => {
    const first = addPurchaseInvoice({
      supplierName: 'Supplier A',
      supplierId: 'sup-1',
      invoiceDate: '2026-03-25',
      totalAmount: 1000,
      paidAmount: 200,
      paymentMethod: 'cash',
      items: [{ id: 'item-1', productName: 'Phone', quantity: 1, unitPrice: 1000, totalPrice: 1000 }],
      notes: '',
      createdBy: 'tester',
    });

    const second = addPurchaseInvoice({
      supplierName: 'Supplier B',
      supplierId: 'sup-2',
      invoiceDate: '2026-03-25',
      totalAmount: 500,
      paidAmount: 500,
      paymentMethod: 'cash',
      items: [{ id: 'item-2', productName: 'Case', quantity: 5, unitPrice: 100, totalPrice: 500 }],
      notes: '',
      createdBy: 'tester',
    });

    deletePurchaseInvoice(first.id);

    const third = addPurchaseInvoice({
      supplierName: 'Supplier C',
      supplierId: 'sup-3',
      invoiceDate: '2026-03-25',
      totalAmount: 750,
      paidAmount: 0,
      paymentMethod: 'credit',
      items: [{ id: 'item-3', productName: 'Cable', quantity: 3, unitPrice: 250, totalPrice: 750 }],
      notes: '',
      createdBy: 'tester',
    });

    expect(second.invoiceNumber).toBe('PI-0002');
    expect(third.invoiceNumber).toBe('PI-0003');
    expect(getPurchaseInvoices()).toHaveLength(2);
  });
});
