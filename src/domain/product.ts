// ============================================================
// ELAHMED RETAIL OS — Product Domain Logic
// Validation rules for product pricing and data integrity
// ============================================================

import { Product } from './types';

export class ProductError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ProductError';
  }
}

/** Selling price must never be lower than cost price */
export function validatePricing(costPrice: number, sellingPrice: number): void {
  if (sellingPrice < costPrice) {
    throw new ProductError(
      `Selling price ($${sellingPrice}) cannot be lower than cost price ($${costPrice})`
    );
  }
}

/** Calculate margin percentage */
export function calcMarginPct(costPrice: number, sellingPrice: number): number {
  if (sellingPrice === 0) return 0;
  return Math.round(((sellingPrice - costPrice) / sellingPrice) * 1000) / 10;
}

/** Check if margin is below minimum threshold */
export function isBelowMinMargin(product: Product): boolean {
  const margin = calcMarginPct(product.costPrice, product.sellingPrice);
  return margin < product.minimumMarginPct;
}

import { generateBarcode as idGenBarcode } from '@/lib/idGenerator';

/** Generate an internal barcode if none provided */
export function generateBarcode(): string {
  return idGenBarcode('AUTO');
}

/** Search products by term (name, barcode) — memoize-friendly pure function */
export function filterProducts(
  products: Product[],
  searchTerm: string,
  category?: string,
  limit?: number
): Product[] {
  const term = searchTerm.toLowerCase();
  let results = products.filter(p => {
    const matchesSearch =
      !searchTerm ||
      p.name.toLowerCase().includes(term) ||
      p.barcode.includes(searchTerm);
    const matchesCategory = !category || category === 'All' || p.category === category;
    return matchesSearch && matchesCategory;
  });

  if (limit) results = results.slice(0, limit);
  return results;
}

/** Find product by exact barcode match */
export function findByBarcode(
  products: Product[],
  barcode: string
): Product | undefined {
  return products.find(p => p.barcode === barcode);
}
