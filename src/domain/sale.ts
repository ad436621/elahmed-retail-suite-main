// ============================================================
// ELAHMED RETAIL OS — Sale Domain Logic
// Profit engine: every sale stores cost, revenue, profit, margin
//
// FIX B1: Integer-cent arithmetic via money.ts prevents IEEE 754
//         float errors (e.g. 0.1 + 0.2 = 0.30000000000000004)
// FIX B2: calcLineTotal now throws on negative lineDiscount to
//         prevent price inflation attacks
// FIX Correction-D: calcCartTotals and buildSaleRecord now both
//         use total (post-discount) as the margin denominator,
//         so POS display and saved records are consistent.
// ============================================================

import { CartItem, Sale, SaleItem, PaymentMethod } from './types';
import { BatchSaleResult } from './types';
import { toCents, fromCents, multiplyMoney, subtractMoney, calcMarginPct } from '@/lib/money';

export class SaleError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'SaleError';
  }
}

/**
 * Calculate line total after line discount.
 * FIX: Throws on negative discount (prevents price inflation).
 *      Uses integer-cent arithmetic (prevents float rounding error).
 */
export function calcLineTotal(item: CartItem): number {
  if (item.lineDiscount < 0) {
    throw new SaleError(
      `خصم السطر لا يمكن أن يكون سالباً: ${item.lineDiscount}`
    );
  }
  const lineGross = multiplyMoney(item.product.sellingPrice, item.qty);
  if (item.lineDiscount > lineGross) {
    throw new SaleError(
      `خصم السطر (${item.lineDiscount}) أكبر من قيمة السطر (${lineGross})`
    );
  }
  return subtractMoney(lineGross, item.lineDiscount);
}

/** Calculate line cost using integer-cent arithmetic */
export function calcLineCost(item: CartItem): number {
  return multiplyMoney(item.product.costPrice, item.qty);
}

/** Build a complete sale record with full profit calculations */
export function buildSaleRecord(
  cart: CartItem[],
  invoiceDiscount: number,
  paymentMethod: PaymentMethod,
  employee: string,
  invoiceNumber: string,
  fifoResults?: BatchSaleResult[],
  customerId?: string,
  customerName?: string
): Sale {
  if (cart.length === 0) {
    throw new SaleError('Cannot create sale with empty cart');
  }
  if (invoiceDiscount < 0) {
    throw new SaleError('خصم الفاتورة لا يمكن أن يكون سالباً');
  }

  const items: SaleItem[] = cart.map((c, index) => {
    const fifoResult = fifoResults?.[index];
    return {
      productId: c.product.id,
      name: c.product.name,
      qty: c.qty,
      price: c.product.sellingPrice,
      cost: fifoResult
        ? fromCents(Math.round(toCents(fifoResult.totalCost) / c.qty)) // averaged real cost
        : c.product.costPrice,
      lineDiscount: c.lineDiscount,
      batches: fifoResult?.batches,
      warehouseId: c.product.warehouseId,
    };
  });

  // Use integer-cent arithmetic throughout
  const subtotalCents = cart.reduce((sum, c) => sum + toCents(calcLineTotal(c)), 0);
  const discountCents  = toCents(invoiceDiscount);
  const totalCents     = Math.max(0, subtotalCents - discountCents);

  // Use FIFO costs if provided, otherwise fallback to old product schema costs
  const costCents = fifoResults
    ? fifoResults.reduce((sum, r) => sum + toCents(r.totalCost), 0)
    : cart.reduce((sum, c) => sum + toCents(calcLineCost(c)), 0);

  const grossProfitCents = totalCents - costCents;

  const subtotal    = fromCents(subtotalCents);
  const total       = fromCents(totalCents);
  const totalCost   = fromCents(costCents);
  const grossProfit = fromCents(grossProfitCents);

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
    // FIX Correction-D: use total (post-discount) — same as buildSaleRecord was already doing
    marginPct: calcMarginPct(grossProfit, total),
    paymentMethod,
    employee,
    customerId: customerId || undefined,
    customerName: customerName || undefined,
    voidedAt: null,
    voidReason: null,
    voidedBy: null,
  };
}

/**
 * Calculate real-time cart totals (used in POS).
 * FIX Correction-D: margin now consistently uses total (post-discount)
 *     as denominator — matches what buildSaleRecord saves.
 */
export function calcCartTotals(cart: CartItem[], invoiceDiscount: number) {
  if (invoiceDiscount < 0) {
    throw new SaleError('خصم الفاتورة لا يمكن أن يكون سالباً');
  }

  // Integer-cent arithmetic throughout
  const subtotalCents = cart.reduce((sum, c) => sum + toCents(calcLineTotal(c)), 0);
  const discountCents  = toCents(invoiceDiscount);
  const totalCents     = Math.max(0, subtotalCents - discountCents);
  const costCents      = cart.reduce((sum, c) => sum + toCents(calcLineCost(c)), 0);
  const profitCents    = totalCents - costCents;

  const subtotal    = fromCents(subtotalCents);
  const total       = fromCents(totalCents);
  const totalCost   = fromCents(costCents);
  const grossProfit = fromCents(profitCents);

  return {
    subtotal,
    total,
    totalCost,
    grossProfit,
    // FIX: previously used subtotal as denominator — now uses total for consistency
    marginPct: calcMarginPct(grossProfit, total),
  };
}
