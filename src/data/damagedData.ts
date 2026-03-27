// ============================================================
// Damaged/Waste Items - Data Layer
// ============================================================

import { DamagedItem } from '@/domain/types';
import { STORAGE_KEYS } from '@/config';
import { getStorageItem, setStorageItem } from '@/lib/localStorageHelper';
import { callElectronSync, emitDataChange, hasElectronIpc, readElectronSync } from '@/lib/electronDataBridge';

const KEY = STORAGE_KEYS.DAMAGED_ITEMS;

interface DamagedRow {
  id: string;
  date: string;
  productName?: string | null;
  productId?: string | null;
  quantity?: number | null;
  costPrice?: number | null;
  estimatedLoss?: number | null;
  reason?: string | null;
  inventoryType?: string | null;
  reportedBy?: string | null;
  createdAt?: string | null;
}

function normalizeDamagedItem(row: Partial<DamagedRow>): DamagedItem {
  const quantity = Math.max(1, Number(row.quantity ?? 1));
  const totalLoss = Number(row.estimatedLoss ?? 0);
  const costPrice = Number(row.costPrice ?? (quantity > 0 ? totalLoss / quantity : 0));

  return {
    id: String(row.id ?? crypto.randomUUID()),
    date: String(row.date ?? new Date().toISOString().slice(0, 10)),
    productName: String(row.productName ?? ''),
    productId: row.productId ? String(row.productId) : undefined,
    quantity,
    costPrice,
    totalLoss,
    reason: String(row.reason ?? ''),
    category: (row.inventoryType ?? 'other') as DamagedItem['category'],
    addedBy: row.reportedBy ? String(row.reportedBy) : '',
    createdAt: String(row.createdAt ?? new Date().toISOString()),
  };
}

function toDamagedRow(item: DamagedItem): DamagedRow {
  return {
    id: item.id,
    date: item.date,
    productName: item.productName,
    productId: item.productId ?? null,
    quantity: item.quantity,
    costPrice: item.costPrice,
    estimatedLoss: item.totalLoss,
    reason: item.reason,
    inventoryType: item.category,
    reportedBy: item.addedBy || null,
    createdAt: item.createdAt,
  };
}

function loadLocalDamagedItems(): DamagedItem[] {
  return getStorageItem<DamagedItem[]>(KEY, []).map(normalizeDamagedItem);
}

function persistElectronDamagedItems(items: DamagedItem[]): void {
  const existing = new Map(getDamagedItems().map((item) => [item.id, item]));
  const nextIds = new Set(items.map((item) => item.id));

  for (const item of items.map(normalizeDamagedItem)) {
    const payload = toDamagedRow(item);
    if (existing.has(item.id)) {
      callElectronSync('db-sync:damaged_items:update', item.id, payload);
    } else {
      callElectronSync('db-sync:damaged_items:add', payload);
    }
  }

  for (const id of existing.keys()) {
    if (!nextIds.has(id)) {
      callElectronSync('db-sync:damaged_items:delete', id);
    }
  }

  emitDataChange(KEY);
}

export function getDamagedItems(): DamagedItem[] {
  if (hasElectronIpc()) {
    const rows = readElectronSync<DamagedRow[]>('db-sync:damaged_items:get', []);
    return rows.map(normalizeDamagedItem);
  }

  return loadLocalDamagedItems();
}

export function saveDamagedItems(items: DamagedItem[]): void {
  const normalized = items.map(normalizeDamagedItem);

  if (hasElectronIpc()) {
    persistElectronDamagedItems(normalized);
    return;
  }

  setStorageItem(KEY, normalized);
}

export function addDamagedItem(item: Omit<DamagedItem, 'id' | 'createdAt'>): DamagedItem {
  const newItem = normalizeDamagedItem({
    ...item,
    id: crypto.randomUUID(),
    createdAt: new Date().toISOString(),
  });

  if (hasElectronIpc()) {
    const saved = callElectronSync<DamagedRow>('db-sync:damaged_items:add', toDamagedRow(newItem));
    emitDataChange(KEY);
    return normalizeDamagedItem(saved ?? newItem);
  }

  saveDamagedItems([...loadLocalDamagedItems(), newItem]);
  return newItem;
}

export function updateDamagedItem(id: string, updates: Partial<DamagedItem>): void {
  if (hasElectronIpc()) {
    callElectronSync('db-sync:damaged_items:update', id, {
      date: updates.date,
      productName: updates.productName,
      productId: updates.productId ?? null,
      quantity: updates.quantity,
      costPrice: updates.costPrice,
      estimatedLoss: updates.totalLoss,
      reason: updates.reason,
      inventoryType: updates.category,
      reportedBy: updates.addedBy ?? null,
    });
    emitDataChange(KEY);
    return;
  }

  const next = loadLocalDamagedItems().map((item) =>
    item.id === id ? normalizeDamagedItem({ ...item, ...updates }) : item,
  );
  setStorageItem(KEY, next);
}

export function deleteDamagedItem(id: string): void {
  if (hasElectronIpc()) {
    callElectronSync('db-sync:damaged_items:delete', id);
    emitDataChange(KEY);
    return;
  }

  setStorageItem(KEY, loadLocalDamagedItems().filter((item) => item.id !== id));
}

export function getTotalLossesThisMonth(): number {
  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  return getDamagedItems()
    .filter((item) => new Date(item.date) >= startOfMonth)
    .reduce((sum, item) => sum + item.totalLoss, 0);
}
