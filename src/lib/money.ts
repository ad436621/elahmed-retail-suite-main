// ============================================================
// money.ts — Integer-safe financial arithmetic
// All amounts stored/computed as integer cents (×100)
// Prevents IEEE 754 float errors in financial calculations
// ============================================================

/**
 * Convert display amount (e.g. 19.99) to integer cents (1999).
 * Always use this when reading user input or stored values.
 */
export function toCents(amount: number): number {
  return Math.round(amount * 100);
}

/**
 * Convert cents back to display amount (1999 → 19.99)
 */
export function fromCents(cents: number): number {
  return cents / 100;
}

/**
 * Add two display amounts safely via integer arithmetic.
 * Avoids: 0.1 + 0.2 = 0.30000000000000004
 */
export function addMoney(a: number, b: number): number {
  return fromCents(toCents(a) + toCents(b));
}

/**
 * Subtract b from a safely via integer arithmetic.
 */
export function subtractMoney(a: number, b: number): number {
  return fromCents(toCents(a) - toCents(b));
}

/**
 * Multiply a price by a quantity safely.
 * price is float (e.g. 19.99), qty must be a positive integer.
 */
export function multiplyMoney(price: number, qty: number): number {
  return fromCents(toCents(price) * qty);
}

/**
 * Calculate margin percentage, rounded to 1 decimal place.
 * Returns 0 if revenue is zero or negative.
 */
export function calcMarginPct(profit: number, revenue: number): number {
  if (revenue <= 0) return 0;
  return Math.round((profit / revenue) * 1000) / 10; // 1 decimal place
}
