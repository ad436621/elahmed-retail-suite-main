// ============================================================
// ELAHMED RETAIL OS — Discount Domain Logic
// Role-based discount limits and validation
// ============================================================

import { DiscountRule, UserRole, CartItem } from './types';

const DISCOUNT_RULES: DiscountRule[] = [
  { role: 'super_admin', maxLinePct: 100, maxInvoicePct: 100 },
  { role: 'admin', maxLinePct: 30, maxInvoicePct: 20 },
  { role: 'employee', maxLinePct: 10, maxInvoicePct: 5 },
];

export class DiscountError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'DiscountError';
  }
}

export function getDiscountLimits(role: UserRole): DiscountRule {
  return DISCOUNT_RULES.find(r => r.role === role) || DISCOUNT_RULES[2];
}

/** Validate a line discount against role limits */
export function validateLineDiscount(
  discount: number,
  lineTotal: number,
  role: UserRole
): void {
  if (discount < 0) throw new DiscountError('Discount cannot be negative');
  if (lineTotal === 0) return;

  const pct = (discount / lineTotal) * 100;
  const limits = getDiscountLimits(role);

  if (pct > limits.maxLinePct) {
    throw new DiscountError(
      `Line discount ${pct.toFixed(1)}% exceeds your limit of ${limits.maxLinePct}%`
    );
  }
}

/** Validate invoice-level discount against role limits */
export function validateInvoiceDiscount(
  discount: number,
  subtotal: number,
  role: UserRole
): void {
  if (discount < 0) throw new DiscountError('Discount cannot be negative');
  if (subtotal === 0) return;

  const pct = (discount / subtotal) * 100;
  const limits = getDiscountLimits(role);

  if (pct > limits.maxInvoicePct) {
    throw new DiscountError(
      `Invoice discount ${pct.toFixed(1)}% exceeds your limit of ${limits.maxInvoicePct}%`
    );
  }
}

/** Detect abnormal discount patterns for analytics */
export function detectAbnormalDiscounts(
  discountAmounts: number[],
  threshold: number = 2
): { isAbnormal: boolean; avgDiscount: number; stdDev: number } {
  if (discountAmounts.length < 5) return { isAbnormal: false, avgDiscount: 0, stdDev: 0 };

  const avg = discountAmounts.reduce((s, v) => s + v, 0) / discountAmounts.length;
  const variance = discountAmounts.reduce((s, v) => s + Math.pow(v - avg, 2), 0) / discountAmounts.length;
  const stdDev = Math.sqrt(variance);

  const latest = discountAmounts[discountAmounts.length - 1];
  const isAbnormal = Math.abs(latest - avg) > threshold * stdDev;

  return { isAbnormal, avgDiscount: Math.round(avg * 100) / 100, stdDev: Math.round(stdDev * 100) / 100 };
}
