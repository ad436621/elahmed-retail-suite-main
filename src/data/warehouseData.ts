import { STORAGE_KEYS } from '@/config';
import { callElectronSync, emitDataChange, hasElectronIpc, readElectronSync } from '@/lib/electronDataBridge';
import { getStorageItem, setStorageItem } from '@/lib/localStorageHelper';
import { WarehouseItem } from '@/domain/types';

const KEY = STORAGE_KEYS.WAREHOUSE;

interface WarehouseItemRow {
  id: string;
  warehouseId?: string | null;
  name: string;
  category: string;
  quantity?: number | null;
  costPrice?: number | null;
  notes?: string | null;
  addedBy?: string | null;
  createdAt?: string | null;
  updatedAt?: string | null;
}

let warehouseItemsCache: WarehouseItem[] | null = null;

function toNumber(value: unknown): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function sortWarehouseItems(items: WarehouseItem[]): WarehouseItem[] {
  return [...items].sort((left, right) => (
    right.createdAt.localeCompare(left.createdAt) || right.id.localeCompare(left.id)
  ));
}

function normalizeWarehouseItem(row: Partial<WarehouseItemRow> | Partial<WarehouseItem>): WarehouseItem {
  const createdAt = String((row as WarehouseItemRow).createdAt ?? (row as WarehouseItem).createdAt ?? new Date().toISOString());
  return {
    id: String(row.id ?? crypto.randomUUID()),
    name: String(row.name ?? '').trim(),
    category: String((row as WarehouseItemRow).category ?? (row as WarehouseItem).category ?? 'general').trim(),
    quantity: Math.max(0, Math.round(toNumber((row as WarehouseItemRow).quantity ?? (row as WarehouseItem).quantity))),
    costPrice: toNumber((row as WarehouseItemRow).costPrice ?? (row as WarehouseItem).costPrice),
    notes: String((row as WarehouseItemRow).notes ?? (row as WarehouseItem).notes ?? ''),
    addedBy: String((row as WarehouseItemRow).addedBy ?? (row as WarehouseItem).addedBy ?? ''),
    createdAt,
    updatedAt: String((row as WarehouseItemRow).updatedAt ?? (row as WarehouseItem).updatedAt ?? createdAt),
  };
}

function toWarehouseItemRow(item: WarehouseItem): WarehouseItemRow {
  return {
    id: item.id,
    name: item.name,
    category: item.category,
    quantity: item.quantity,
    costPrice: item.costPrice,
    notes: item.notes,
    addedBy: item.addedBy,
    createdAt: item.createdAt,
    updatedAt: item.updatedAt,
  };
}

function setWarehouseItemsState(items: WarehouseItem[]): void {
  warehouseItemsCache = sortWarehouseItems(items.map(normalizeWarehouseItem));
}

function loadLocalWarehouseItems(): WarehouseItem[] {
  return sortWarehouseItems(getStorageItem<WarehouseItem[]>(KEY, []).map(normalizeWarehouseItem));
}

function refreshElectronWarehouseItems(): WarehouseItem[] {
  const rows = readElectronSync<WarehouseItemRow[]>('db-sync:warehouse_items:get', []);
  setWarehouseItemsState(rows.map(normalizeWarehouseItem));
  return warehouseItemsCache ?? [];
}

export function getWarehouseItems(): WarehouseItem[] {
  if (warehouseItemsCache) return warehouseItemsCache;

  if (hasElectronIpc()) {
    return refreshElectronWarehouseItems();
  }

  const localItems = loadLocalWarehouseItems();
  setWarehouseItemsState(localItems);
  return warehouseItemsCache ?? [];
}

export function saveWarehouseItems(items: WarehouseItem[]): void {
  const normalized = sortWarehouseItems(items.map(normalizeWarehouseItem));

  if (hasElectronIpc()) {
    const current = new Map(getWarehouseItems().map((item) => [item.id, item]));
    const nextIds = new Set(normalized.map((item) => item.id));

    for (const item of normalized) {
      const payload = toWarehouseItemRow(item);
      if (current.has(item.id)) {
        callElectronSync('db-sync:warehouse_items:update', item.id, payload);
      } else {
        callElectronSync('db-sync:warehouse_items:add', payload);
      }
    }

    for (const id of current.keys()) {
      if (!nextIds.has(id)) {
        callElectronSync('db-sync:warehouse_items:delete', id);
      }
    }

    setWarehouseItemsState(normalized);
    emitDataChange(KEY);
    return;
  }

  setStorageItem(KEY, normalized);
  setWarehouseItemsState(normalized);
  emitDataChange(KEY);
}

export function addWarehouseItem(item: Omit<WarehouseItem, 'id' | 'createdAt' | 'updatedAt'>): WarehouseItem {
  const nextItem = normalizeWarehouseItem({
    ...item,
    id: crypto.randomUUID(),
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  });

  if (hasElectronIpc()) {
    const saved = callElectronSync<WarehouseItemRow>('db-sync:warehouse_items:add', toWarehouseItemRow(nextItem));
    const normalized = normalizeWarehouseItem(saved ?? nextItem);
    const allItems = refreshElectronWarehouseItems();
    emitDataChange(KEY);
    return allItems.find((entry) => entry.id === normalized.id) ?? normalized;
  }

  saveWarehouseItems([...(warehouseItemsCache ?? loadLocalWarehouseItems()), nextItem]);
  return nextItem;
}

export function updateWarehouseItem(id: string, updates: Partial<WarehouseItem>): void {
  if (hasElectronIpc()) {
    const current = getWarehouseItems().find((item) => item.id === id);
    const next = normalizeWarehouseItem({ ...(current ?? { id, name: '', category: 'general' }), ...updates, updatedAt: new Date().toISOString() });
    callElectronSync('db-sync:warehouse_items:update', id, toWarehouseItemRow(next));
    setWarehouseItemsState(getWarehouseItems().map((item) => (item.id === id ? next : item)));
    emitDataChange(KEY);
    return;
  }

  saveWarehouseItems(getWarehouseItems().map((item) => (
    item.id === id ? normalizeWarehouseItem({ ...item, ...updates, updatedAt: new Date().toISOString() }) : item
  )));
}

export function deleteWarehouseItem(id: string): void {
  if (hasElectronIpc()) {
    callElectronSync('db-sync:warehouse_items:delete', id);
    setWarehouseItemsState(getWarehouseItems().filter((item) => item.id !== id));
    emitDataChange(KEY);
    return;
  }

  saveWarehouseItems(getWarehouseItems().filter((item) => item.id !== id));
}

export function getWarehouseCategories(): string[] {
  return Array.from(new Set(getWarehouseItems().map((item) => item.category).filter(Boolean))).sort();
}

export function getWarehouseCapital(): number {
  return getWarehouseItems().reduce((sum, item) => sum + (item.costPrice * item.quantity), 0);
}
