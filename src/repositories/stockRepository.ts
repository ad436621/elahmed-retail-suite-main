// ============================================================
// ELAHMED RETAIL OS — Stock Movement Repository
// Immutable stock movement log
// ============================================================

import { StockMovement } from '@/domain/types';
import { STORAGE_KEYS } from '@/config';
import { getStorageItem, setStorageItem } from '@/lib/localStorageHelper';

const STORAGE_KEY = STORAGE_KEYS.STOCK_MOVEMENTS;

function loadMovements(): StockMovement[] {
  return getStorageItem<StockMovement[]>(STORAGE_KEY, []);
}

function persistMovements(movements: StockMovement[]): void {
  setStorageItem(STORAGE_KEY, movements);
}

let movementStore: StockMovement[] = loadMovements();

function syncStore(): StockMovement[] {
  movementStore = loadMovements();
  return movementStore;
}

export function getAllMovements(): StockMovement[] {
  return [...syncStore()];
}

export function getMovementsByProduct(productId: string): StockMovement[] {
  return syncStore().filter(m => m.productId === productId);
}

export function saveMovement(movement: StockMovement): void {
  syncStore();
  movementStore.push(movement);
  persistMovements(movementStore);
}

export function saveMovements(movements: StockMovement[]): void {
  syncStore();
  movementStore.push(...movements);
  persistMovements(movementStore);
}
