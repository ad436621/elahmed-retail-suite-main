// ============================================================
// ELAHMED RETAIL OS — Sale Domain Logic
// Profit engine: every sale stores cost, revenue, profit, margin
// ============================================================

import { CartItem, Sale, SaleItem, PaymentMethod } from './types';

export class SaleError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'SaleError';
  }
}

/** Calculate line total after line discount */
export function calcLineTotal(item: CartItem): number {
  return item.product.sellingPrice * item.qty - item.lineDiscount;
}

/** Calculate line cost */
export function calcLineCost(item: CartItem): number {
  return item.product.costPrice * item.qty;
}

/** Build a complete sale record with full profit calculations */
export function buildSaleRecord(
  cart: CartItem[],
  invoiceDiscount: number,
  paymentMethod: PaymentMethod,
  employee: string,
  invoiceNumber: string
): Sale {
  if (cart.length === 0) {
    throw new SaleError('Cannot create sale with empty cart');
  }

  const items: SaleItem[] = cart.map(c => ({
    productId: c.product.id,
    name: c.product.name,
    qty: c.qty,
    price: c.product.sellingPrice,
    cost: c.product.costPrice,
    lineDiscount: c.lineDiscount,
  }));

  const subtotal = cart.reduce((sum, c) => sum + calcLineTotal(c), 0);
  const total = Math.max(0, subtotal - invoiceDiscount);
  const totalCost = cart.reduce((sum, c) => sum + calcLineCost(c), 0);
  const grossProfit = total - totalCost;
  const marginPct = total > 0 ? (grossProfit / total) * 100 : 0;

  return {
    id: crypto.randomUUID(),
    invoiceNumber,
    date: new Date().toISOString(),
    items,
    subtotal,
    discount: invoiceDiscount,
    total,
    totalCost,
    grossProfit,
    marginPct: Math.round(marginPct * 10) / 10,
    paymentMethod,
    employee,
    voidedAt: null,
    voidReason: null,
    voidedBy: null,
  };
}

/** Calculate real-time cart totals (used in POS) */
export function calcCartTotals(cart: CartItem[], invoiceDiscount: number) {
  const subtotal = cart.reduce((sum, c) => sum + calcLineTotal(c), 0);
  const total = Math.max(0, subtotal - invoiceDiscount);
  const totalCost = cart.reduce((sum, c) => sum + calcLineCost(c), 0);
  const grossProfit = total - totalCost;
  const marginPct = subtotal > 0 ? (grossProfit / subtotal) * 100 : 0;

  return {
    subtotal,
    total,
    totalCost,
    grossProfit,
    marginPct: Math.round(marginPct * 10) / 10,
  };
}
