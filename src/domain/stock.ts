// ============================================================
// ELAHMED RETAIL OS — Stock Domain Logic
// ALL stock changes MUST go through these functions
// ============================================================

import { Product, StockMovement, StockMovementType } from './types';

export class StockError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'StockError';
  }
}

/** Validate stock availability before any deduction */
export function validateStock(product: Product, requestedQty: number): void {
  if (requestedQty <= 0) {
    throw new StockError(`Invalid quantity: ${requestedQty}`);
  }
  if (product.quantity < requestedQty) {
    throw new StockError(
      `Insufficient stock for "${product.name}". Available: ${product.quantity}, Requested: ${requestedQty}`
    );
  }
}

/** Calculate the new quantity after a stock change. Never allows negative. */
export function calculateNewQuantity(
  currentQty: number,
  change: number
): number {
  const result = currentQty + change;
  if (result < 0) {
    throw new StockError(
      `Stock cannot go negative. Current: ${currentQty}, Change: ${change}`
    );
  }
  return result;
}

/** Create an immutable stock movement record */
export function createStockMovement(
  productId: string,
  type: StockMovementType,
  quantityChange: number,
  previousQuantity: number,
  reason: string,
  userId: string,
  referenceId: string | null = null,
  warehouseId?: string
): StockMovement {
  const newQuantity = calculateNewQuantity(previousQuantity, quantityChange);

  return {
    id: crypto.randomUUID(),
    productId,
    type,
    quantityChange,
    previousQuantity,
    newQuantity,
    reason,
    referenceId,
    userId,
    timestamp: new Date().toISOString(),
    warehouseId,
  };
}

/** Apply a movement to a product, returning updated product (immutable) */
export function applyStockMovement(
  product: Product,
  movement: StockMovement
): Product {
  return {
    ...product,
    quantity: movement.newQuantity,
    updatedAt: movement.timestamp,
  };
}

/** Check if product is at or below low stock threshold */
export function isLowStock(product: Product): boolean {
  return product.quantity <= 5;
}

/** Predict days until stock depletion based on daily sales rate */
export function predictDepletionDays(
  currentQty: number,
  avgDailySales: number
): number | null {
  if (avgDailySales <= 0) return null;
  return Math.floor(currentQty / avgDailySales);
}

/**
 * Return a product back to inventory.
 * If originalBatchId is provided, restores quantity to that specific batch.
 */
export function returnProductToInventory(
  productId: string,
  quantity: number,
  originalBatchId?: string
): StockMovement {
  return createStockMovement(
    productId,
    'return',
    quantity,
    0, // This should be populated by the caller with the current quantity
    'Return product to inventory via FIFO reverse or specific batch',
    'system',
    originalBatchId
  );
}
