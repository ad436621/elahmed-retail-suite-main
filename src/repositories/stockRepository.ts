// ============================================================
// ELAHMED RETAIL OS — Stock Movement Repository
// Immutable stock movement log
// ============================================================

import { StockMovement } from '@/domain/types';

let movementStore: StockMovement[] = [];

export function getAllMovements(): StockMovement[] {
  return [...movementStore];
}

export function getMovementsByProduct(productId: string): StockMovement[] {
  return movementStore.filter(m => m.productId === productId);
}

export function saveMovement(movement: StockMovement): void {
  movementStore.push(movement);
}

export function saveMovements(movements: StockMovement[]): void {
  movementStore.push(...movements);
}
