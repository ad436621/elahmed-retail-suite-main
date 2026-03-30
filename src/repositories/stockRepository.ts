// ============================================================
// ELAHMED RETAIL OS - Stock Movement Repository
// Immutable stock movement log with SQLite bridge in Electron
// ============================================================

import { StockMovement } from '@/domain/types';
import { STORAGE_KEYS } from '@/config';
import { getStorageItem, setStorageItem } from '@/lib/localStorageHelper';
import { callElectronSync, emitDataChange, hasElectronIpc, readElectronSync } from '@/lib/electronDataBridge';

const STORAGE_KEY = STORAGE_KEYS.STOCK_MOVEMENTS;

let movementStore: StockMovement[] | null = null;

function toNumber(value: unknown): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function normalizeMovement(movement: Partial<StockMovement>): StockMovement {
  return {
    id: String(movement.id ?? crypto.randomUUID()),
    productId: String(movement.productId ?? ''),
    type: String(movement.type ?? 'correction') as StockMovement['type'],
    quantityChange: toNumber(movement.quantityChange),
    previousQuantity: toNumber(movement.previousQuantity),
    newQuantity: toNumber(movement.newQuantity),
    reason: String(movement.reason ?? ''),
    referenceId: movement.referenceId ? String(movement.referenceId) : null,
    userId: String(movement.userId ?? 'system'),
    timestamp: String(movement.timestamp ?? new Date().toISOString()),
    warehouseId: movement.warehouseId ? String(movement.warehouseId) : undefined,
  };
}

function sortMovements(movements: StockMovement[]): StockMovement[] {
  return [...movements].sort((left, right) => right.timestamp.localeCompare(left.timestamp) || right.id.localeCompare(left.id));
}

function setMovementsState(movements: StockMovement[]): void {
  movementStore = sortMovements(movements.map(normalizeMovement));
}

function loadMovements(): StockMovement[] {
  const saved = getStorageItem<StockMovement[]>(STORAGE_KEY, []);
  return sortMovements((Array.isArray(saved) ? saved : []).map(normalizeMovement));
}

function refreshElectronMovements(productId?: string): StockMovement[] {
  const rows = readElectronSync<StockMovement[]>('db-sync:stock_movements:get', [], productId);
  const rowsArray = Array.isArray(rows) ? rows : [];
  const normalized = sortMovements(rowsArray.map(normalizeMovement));
  if (!productId) {
    movementStore = normalized;
  }
  return normalized;
}

function syncStore(): StockMovement[] {
  if (hasElectronIpc()) {
    if (movementStore) return movementStore;
    return refreshElectronMovements();
  }

  const movements = loadMovements();
  setMovementsState(movements);
  return movementStore ?? [];
}

export function getAllMovements(): StockMovement[] {
  return [...syncStore()];
}

export function getMovementsByProduct(productId: string): StockMovement[] {
  if (hasElectronIpc()) {
    return refreshElectronMovements(productId).filter((movement) => movement.productId === productId);
  }

  return syncStore().filter((movement) => movement.productId === productId);
}

export function saveMovement(movement: StockMovement): void {
  const normalized = normalizeMovement(movement);

  if (hasElectronIpc()) {
    callElectronSync('db-sync:stock_movements:add', normalized);
    refreshElectronMovements();
    emitDataChange(STORAGE_KEY);
    return;
  }

  const movements = [...syncStore(), normalized];
  setStorageItem(STORAGE_KEY, movements);
  setMovementsState(movements);
  emitDataChange(STORAGE_KEY);
}

export function saveMovements(movements: StockMovement[]): void {
  const normalized = movements.map(normalizeMovement);

  if (hasElectronIpc()) {
    callElectronSync('db-sync:stock_movements:addBulk', normalized);
    refreshElectronMovements();
    emitDataChange(STORAGE_KEY);
    return;
  }

  const nextMovements = [...syncStore(), ...normalized];
  setStorageItem(STORAGE_KEY, nextMovements);
  setMovementsState(nextMovements);
  emitDataChange(STORAGE_KEY);
}
