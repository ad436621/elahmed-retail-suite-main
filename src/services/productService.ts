// ============================================================
// ELAHMED RETAIL OS — Product Service
// Product CRUD with validation, pricing rules, and audit
// ============================================================

import { Product } from '@/domain/types';
import { validatePricing, calcMarginPct, filterProducts, findByBarcode } from '@/domain/product';
import { createAuditEntry, createPriceChangeAudit } from '@/domain/audit';

export interface ProductUpdateResult {
  product: Product;
  auditEntries: ReturnType<typeof createAuditEntry>[];
}

/** Update product with full validation and audit trail */
export function updateProduct(
  existing: Product,
  updates: Partial<Pick<Product, 'name' | 'model' | 'costPrice' | 'sellingPrice' | 'category' | 'supplier'>>,
  userId: string
): ProductUpdateResult {
  const newCost = updates.costPrice ?? existing.costPrice;
  const newSelling = updates.sellingPrice ?? existing.sellingPrice;

  // Enforce: selling >= cost
  validatePricing(newCost, newSelling);

  const updated: Product = {
    ...existing,
    ...updates,
    costPrice: newCost,
    sellingPrice: newSelling,
    updatedAt: new Date().toISOString(),
  };

  const auditEntries: ReturnType<typeof createAuditEntry>[] = [];

  // Track price changes specifically
  if (newCost !== existing.costPrice || newSelling !== existing.sellingPrice) {
    auditEntries.push(
      createPriceChangeAudit(
        userId,
        existing.id,
        existing.costPrice,
        newCost,
        existing.sellingPrice,
        newSelling
      )
    );
  }

  // General update audit
  auditEntries.push(
    createAuditEntry(userId, 'product_updated', 'product', existing.id, existing as any, updated as any)
  );

  return { product: updated, auditEntries };
}

/** Search products — pure delegation */
export function searchProducts(
  products: Product[],
  term: string,
  category?: string,
  limit?: number
): Product[] {
  return filterProducts(products, term, category, limit);
}

/** Find by barcode — pure delegation */
export function lookupBarcode(products: Product[], barcode: string): Product | undefined {
  return findByBarcode(products, barcode);
}

/** Get margin for display */
export function getMargin(product: Product): number {
  return calcMarginPct(product.costPrice, product.sellingPrice);
}
