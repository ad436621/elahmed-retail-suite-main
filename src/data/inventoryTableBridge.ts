import { callElectronSync, emitDataChange, hasElectronIpc, readElectronSync } from '@/lib/electronDataBridge';
import { getStorageItem, setStorageItem } from '@/lib/localStorageHelper';

export interface InventoryProductRow {
  id: string;
  name: string;
  model?: string;
  barcode?: string;
  deviceType?: string;
  category?: string;
  condition?: string;
  storage?: string;
  ram?: string;
  color?: string;
  brand?: string;
  description?: string;
  boxNumber?: string;
  taxExcluded?: boolean;
  quantity: number;
  oldCostPrice: number;
  newCostPrice: number;
  salePrice: number;
  profitMargin?: number;
  minStock?: number;
  supplier?: string;
  source?: string;
  warehouseId?: string;
  serialNumber?: string;
  imei2?: string;
  processor?: string;
  isArchived?: boolean;
  notes?: string;
  image?: string;
  createdAt: string;
  updatedAt: string;
  deletedAt?: string | null;
}

export interface InventoryAccessoryRow {
  id: string;
  warehouseId?: string;
  inventoryType: string;
  name: string;
  category?: string;
  subcategory?: string;
  model?: string;
  barcode?: string;
  quantity: number;
  oldCostPrice: number;
  newCostPrice: number;
  costPrice: number;
  salePrice: number;
  profitMargin?: number;
  minStock?: number;
  condition?: string;
  brand?: string;
  supplier?: string;
  source?: string;
  boxNumber?: string;
  taxExcluded?: boolean;
  color?: string;
  description?: string;
  isArchived?: boolean;
  deletedAt?: string | null;
  notes?: string;
  image?: string;
  createdAt: string;
  updatedAt: string;
}

function toStringValue(value: unknown, fallback = ''): string {
  if (value === null || value === undefined) return fallback;
  return String(value);
}

function toOptionalString(value: unknown): string | undefined {
  const normalized = toStringValue(value).trim();
  return normalized ? normalized : undefined;
}

function toNumberValue(value: unknown, fallback = 0): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function toIntegerValue(value: unknown, fallback = 0): number {
  return Math.max(0, Math.round(toNumberValue(value, fallback)));
}

function toBooleanValue(value: unknown): boolean {
  if (typeof value === 'boolean') return value;
  if (typeof value === 'number') return value === 1;
  if (typeof value === 'string') return ['1', 'true', 'yes'].includes(value.toLowerCase());
  return false;
}

function sortByCreatedAtDesc<T extends { createdAt?: string; id: string }>(items: T[]): T[] {
  return [...items].sort((left, right) => {
    const leftCreatedAt = left.createdAt ?? '';
    const rightCreatedAt = right.createdAt ?? '';
    return rightCreatedAt.localeCompare(leftCreatedAt) || right.id.localeCompare(left.id);
  });
}

export function normalizeInventoryProductRow(row: Partial<InventoryProductRow>, source?: string): InventoryProductRow {
  const createdAt = toStringValue(row.createdAt, new Date().toISOString());
  const newCostPrice = toNumberValue(row.newCostPrice ?? row.oldCostPrice);
  return {
    id: toStringValue(row.id, crypto.randomUUID()),
    name: toStringValue(row.name).trim(),
    model: toOptionalString(row.model),
    barcode: toOptionalString(row.barcode),
    deviceType: toOptionalString(row.deviceType),
    category: toOptionalString(row.category),
    condition: toOptionalString(row.condition),
    storage: toOptionalString(row.storage),
    ram: toOptionalString(row.ram),
    color: toOptionalString(row.color),
    brand: toOptionalString(row.brand),
    description: toStringValue(row.description),
    boxNumber: toOptionalString(row.boxNumber),
    taxExcluded: toBooleanValue(row.taxExcluded),
    quantity: toIntegerValue(row.quantity),
    oldCostPrice: toNumberValue(row.oldCostPrice),
    newCostPrice,
    salePrice: toNumberValue(row.salePrice),
    profitMargin: toNumberValue(row.profitMargin ?? (toNumberValue(row.salePrice) - newCostPrice)),
    minStock: toIntegerValue(row.minStock),
    supplier: toOptionalString(row.supplier),
    source: toOptionalString(row.source ?? source),
    warehouseId: toOptionalString(row.warehouseId),
    serialNumber: toOptionalString(row.serialNumber),
    imei2: toOptionalString(row.imei2),
    processor: toOptionalString(row.processor),
    isArchived: toBooleanValue(row.isArchived),
    notes: toStringValue(row.notes),
    image: toOptionalString(row.image),
    createdAt,
    updatedAt: toStringValue(row.updatedAt, createdAt),
    deletedAt: row.deletedAt ? toStringValue(row.deletedAt) : null,
  };
}

export function normalizeInventoryAccessoryRow(row: Partial<InventoryAccessoryRow>, inventoryType?: string): InventoryAccessoryRow {
  const createdAt = toStringValue(row.createdAt, new Date().toISOString());
  const newCostPrice = toNumberValue(row.newCostPrice ?? row.costPrice ?? row.oldCostPrice);
  return {
    id: toStringValue(row.id, crypto.randomUUID()),
    warehouseId: toOptionalString(row.warehouseId),
    inventoryType: toStringValue(row.inventoryType ?? inventoryType).trim(),
    name: toStringValue(row.name).trim(),
    category: toOptionalString(row.category),
    subcategory: toOptionalString(row.subcategory),
    model: toOptionalString(row.model),
    barcode: toOptionalString(row.barcode),
    quantity: toIntegerValue(row.quantity),
    oldCostPrice: toNumberValue(row.oldCostPrice),
    newCostPrice,
    costPrice: toNumberValue(row.costPrice ?? newCostPrice),
    salePrice: toNumberValue(row.salePrice),
    profitMargin: toNumberValue(row.profitMargin ?? (toNumberValue(row.salePrice) - newCostPrice)),
    minStock: toIntegerValue(row.minStock),
    condition: toOptionalString(row.condition),
    brand: toOptionalString(row.brand),
    supplier: toOptionalString(row.supplier),
    source: toOptionalString(row.source),
    boxNumber: toOptionalString(row.boxNumber),
    taxExcluded: toBooleanValue(row.taxExcluded),
    color: toOptionalString(row.color),
    description: toStringValue(row.description),
    isArchived: toBooleanValue(row.isArchived),
    deletedAt: row.deletedAt ? toStringValue(row.deletedAt) : null,
    notes: toStringValue(row.notes),
    image: toOptionalString(row.image),
    createdAt,
    updatedAt: toStringValue(row.updatedAt, createdAt),
  };
}

export function getProductRows(source: string, storageKey: string): InventoryProductRow[] {
  if (hasElectronIpc()) {
    const rows = readElectronSync<InventoryProductRow[]>('db-sync:products:get', [], source);
    return sortByCreatedAtDesc(rows.map((row) => normalizeInventoryProductRow(row, source)));
  }

  return sortByCreatedAtDesc(
    getStorageItem<InventoryProductRow[]>(storageKey, []).map((row) => normalizeInventoryProductRow(row, source)),
  );
}

export function saveProductRows(source: string, storageKey: string, rows: InventoryProductRow[]): void {
  const normalized = sortByCreatedAtDesc(rows.map((row) => normalizeInventoryProductRow(row, source)));

  if (hasElectronIpc()) {
    const current = getProductRows(source, storageKey);
    const currentIds = new Set(current.map((row) => row.id));
    const nextIds = new Set(normalized.map((row) => row.id));

    for (const row of normalized) {
      if (currentIds.has(row.id)) {
        callElectronSync('db-sync:products:update', row.id, row);
      } else {
        callElectronSync('db-sync:products:add', row);
      }
    }

    for (const row of current) {
      if (!nextIds.has(row.id)) {
        callElectronSync('db-sync:products:delete', row.id);
      }
    }

    emitDataChange(storageKey);
    return;
  }

  setStorageItem(storageKey, normalized);
}

export function addProductRow(source: string, storageKey: string, row: InventoryProductRow): InventoryProductRow {
  const normalized = normalizeInventoryProductRow(row, source);

  if (hasElectronIpc()) {
    const saved = callElectronSync<InventoryProductRow>('db-sync:products:add', normalized);
    emitDataChange(storageKey);
    return normalizeInventoryProductRow(saved ?? normalized, source);
  }

  setStorageItem(storageKey, [...getProductRows(source, storageKey), normalized]);
  return normalized;
}

export function updateProductRow(
  source: string,
  storageKey: string,
  id: string,
  updates: Partial<InventoryProductRow>,
): InventoryProductRow | null {
  if (hasElectronIpc()) {
    const saved = callElectronSync<InventoryProductRow>('db-sync:products:update', id, updates);
    emitDataChange(storageKey);
    return saved ? normalizeInventoryProductRow(saved, source) : null;
  }

  const current = getProductRows(source, storageKey);
  const existing = current.find((row) => row.id === id);
  if (!existing) return null;

  const next = normalizeInventoryProductRow({ ...existing, ...updates, updatedAt: new Date().toISOString() }, source);
  setStorageItem(storageKey, current.map((row) => (row.id === id ? next : row)));
  return next;
}

export function deleteProductRow(source: string, storageKey: string, id: string): void {
  if (hasElectronIpc()) {
    callElectronSync('db-sync:products:delete', id);
    emitDataChange(storageKey);
    return;
  }

  setStorageItem(
    storageKey,
    getProductRows(source, storageKey).filter((row) => row.id !== id),
  );
}

export function getAccessoryRows(inventoryType: string, storageKey: string): InventoryAccessoryRow[] {
  if (hasElectronIpc()) {
    const rows = readElectronSync<InventoryAccessoryRow[]>('db-sync:accessories:get', [], inventoryType);
    return sortByCreatedAtDesc(rows.map((row) => normalizeInventoryAccessoryRow(row, inventoryType)));
  }

  return sortByCreatedAtDesc(
    getStorageItem<InventoryAccessoryRow[]>(storageKey, []).map((row) => normalizeInventoryAccessoryRow(row, inventoryType)),
  );
}

export function saveAccessoryRows(inventoryType: string, storageKey: string, rows: InventoryAccessoryRow[]): void {
  const normalized = sortByCreatedAtDesc(rows.map((row) => normalizeInventoryAccessoryRow(row, inventoryType)));

  if (hasElectronIpc()) {
    const current = getAccessoryRows(inventoryType, storageKey);
    const currentIds = new Set(current.map((row) => row.id));
    const nextIds = new Set(normalized.map((row) => row.id));

    for (const row of normalized) {
      if (currentIds.has(row.id)) {
        callElectronSync('db-sync:accessories:update', row.id, row);
      } else {
        callElectronSync('db-sync:accessories:add', row);
      }
    }

    for (const row of current) {
      if (!nextIds.has(row.id)) {
        callElectronSync('db-sync:accessories:delete', row.id);
      }
    }

    emitDataChange(storageKey);
    return;
  }

  setStorageItem(storageKey, normalized);
}

export function addAccessoryRow(
  inventoryType: string,
  storageKey: string,
  row: InventoryAccessoryRow,
): InventoryAccessoryRow {
  const normalized = normalizeInventoryAccessoryRow(row, inventoryType);

  if (hasElectronIpc()) {
    const saved = callElectronSync<InventoryAccessoryRow>('db-sync:accessories:add', normalized);
    emitDataChange(storageKey);
    return normalizeInventoryAccessoryRow(saved ?? normalized, inventoryType);
  }

  setStorageItem(storageKey, [...getAccessoryRows(inventoryType, storageKey), normalized]);
  return normalized;
}

export function updateAccessoryRow(
  inventoryType: string,
  storageKey: string,
  id: string,
  updates: Partial<InventoryAccessoryRow>,
): InventoryAccessoryRow | null {
  if (hasElectronIpc()) {
    const saved = callElectronSync<InventoryAccessoryRow>('db-sync:accessories:update', id, updates);
    emitDataChange(storageKey);
    return saved ? normalizeInventoryAccessoryRow(saved, inventoryType) : null;
  }

  const current = getAccessoryRows(inventoryType, storageKey);
  const existing = current.find((row) => row.id === id);
  if (!existing) return null;

  const next = normalizeInventoryAccessoryRow({ ...existing, ...updates, updatedAt: new Date().toISOString() }, inventoryType);
  setStorageItem(storageKey, current.map((row) => (row.id === id ? next : row)));
  return next;
}

export function deleteAccessoryRow(inventoryType: string, storageKey: string, id: string): void {
  if (hasElectronIpc()) {
    callElectronSync('db-sync:accessories:delete', id);
    emitDataChange(storageKey);
    return;
  }

  setStorageItem(
    storageKey,
    getAccessoryRows(inventoryType, storageKey).filter((row) => row.id !== id),
  );
}
