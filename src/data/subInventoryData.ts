// ============================================================
// subInventoryData.ts - Generic factory for sub-inventory data
// ============================================================

import { STORAGE_KEYS } from '@/config';
import { SubItem } from '@/components/SubSectionPage';
import {
  addAccessoryRow,
  getAccessoryRows,
  InventoryAccessoryRow,
  saveAccessoryRows,
  updateAccessoryRow,
} from './inventoryTableBridge';

const INVENTORY_TYPE_BY_KEY: Record<string, string> = {
  [STORAGE_KEYS.MOBILE_SPARE_PARTS]: 'mobile_spare_part',
  [STORAGE_KEYS.COMPUTER_ACCESSORIES_SA]: 'computer_accessory',
  [STORAGE_KEYS.COMPUTER_SPARE_PARTS]: 'computer_spare_part',
  [STORAGE_KEYS.DEVICE_ACCESSORIES_SA]: 'device_accessory',
  [STORAGE_KEYS.DEVICE_SPARE_PARTS]: 'device_spare_part',
};

function normalizeSubItem(item: Partial<SubItem>): SubItem {
  const createdAt = String(item.createdAt ?? new Date().toISOString());
  const costPrice = Number(item.costPrice ?? 0) || 0;
  const salePrice = Number(item.salePrice ?? 0) || 0;
  return {
    id: String(item.id ?? crypto.randomUUID()),
    name: String(item.name ?? '').trim(),
    brand: item.brand ? String(item.brand) : undefined,
    category: item.category ? String(item.category) : undefined,
    model: item.model ? String(item.model) : undefined,
    quantity: Math.max(0, Math.round(Number(item.quantity ?? 0) || 0)),
    costPrice,
    salePrice,
    profitMargin: Number(item.profitMargin ?? (salePrice - costPrice)) || 0,
    minStock: Math.max(0, Math.round(Number(item.minStock ?? 0) || 0)),
    barcode: item.barcode ? String(item.barcode) : undefined,
    supplier: item.supplier ? String(item.supplier) : undefined,
    source: item.source ? String(item.source) : undefined,
    condition: item.condition ?? 'new',
    notes: item.notes ? String(item.notes) : undefined,
    image: item.image ? String(item.image) : undefined,
    createdAt,
    updatedAt: String(item.updatedAt ?? createdAt),
  };
}

function toAccessoryRow(item: SubItem, inventoryType: string): InventoryAccessoryRow {
  return {
    id: item.id,
    inventoryType,
    name: item.name,
    category: item.category,
    model: item.model,
    barcode: item.barcode,
    quantity: item.quantity,
    oldCostPrice: item.costPrice,
    newCostPrice: item.costPrice,
    costPrice: item.costPrice,
    salePrice: item.salePrice,
    profitMargin: item.profitMargin,
    minStock: item.minStock,
    condition: item.condition,
    brand: item.brand,
    supplier: item.supplier,
    source: item.source,
    description: '',
    notes: item.notes,
    image: item.image,
    createdAt: String(item.createdAt),
    updatedAt: String(item.updatedAt),
  };
}

function fromAccessoryRow(row: InventoryAccessoryRow): SubItem {
  return normalizeSubItem({
    id: row.id,
    name: row.name,
    brand: row.brand,
    category: row.category,
    model: row.model,
    quantity: row.quantity,
    costPrice: row.costPrice ?? row.newCostPrice,
    salePrice: row.salePrice,
    profitMargin: row.profitMargin,
    minStock: row.minStock,
    barcode: row.barcode,
    supplier: row.supplier,
    source: row.source,
    condition: row.condition as SubItem['condition'],
    notes: row.notes,
    image: row.image,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  });
}

function resolveInventoryType(storageKey: string): string {
  return INVENTORY_TYPE_BY_KEY[storageKey] ?? storageKey;
}

export function createSubInventory(storageKey: string) {
  const inventoryType = resolveInventoryType(storageKey);

  const get = (): SubItem[] => (
    getAccessoryRows(inventoryType, storageKey)
      .filter((item) => !item.isArchived && !item.deletedAt)
      .map(fromAccessoryRow)
  );

  const save = (items: SubItem[]): void => {
    saveAccessoryRows(inventoryType, storageKey, items.map((item) => toAccessoryRow(normalizeSubItem(item), inventoryType)));
  };

  const add = (item: Omit<SubItem, 'id' | 'createdAt' | 'updatedAt'>): SubItem => {
    const nextItem = normalizeSubItem({
      ...item,
      id: crypto.randomUUID(),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });
    return fromAccessoryRow(addAccessoryRow(inventoryType, storageKey, toAccessoryRow(nextItem, inventoryType)));
  };

  const update = (id: string, updates: Partial<SubItem>): void => {
    updateAccessoryRow(inventoryType, storageKey, id, {
      name: updates.name,
      category: updates.category,
      model: updates.model,
      barcode: updates.barcode,
      quantity: updates.quantity,
      oldCostPrice: updates.costPrice,
      newCostPrice: updates.costPrice,
      costPrice: updates.costPrice,
      salePrice: updates.salePrice,
      profitMargin: updates.profitMargin,
      minStock: updates.minStock,
      condition: updates.condition,
      brand: updates.brand,
      supplier: updates.supplier,
      source: updates.source,
      notes: updates.notes,
      image: updates.image,
      updatedAt: new Date().toISOString(),
    });
  };

  const remove = (id: string): void => {
    updateAccessoryRow(inventoryType, storageKey, id, {
      isArchived: true,
      deletedAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });
  };

  const capital = (): number => get().reduce((sum, item) => sum + item.costPrice * item.quantity, 0);

  return { get, save, add, update, remove, capital };
}

export const mobileSparePartsDB = createSubInventory(STORAGE_KEYS.MOBILE_SPARE_PARTS);
export const computerAccessoriesDB = createSubInventory(STORAGE_KEYS.COMPUTER_ACCESSORIES_SA);
export const computerSparePartsDB = createSubInventory(STORAGE_KEYS.COMPUTER_SPARE_PARTS);
export const deviceAccessoriesDB = createSubInventory(STORAGE_KEYS.DEVICE_ACCESSORIES_SA);
export const deviceSparePartsDB = createSubInventory(STORAGE_KEYS.DEVICE_SPARE_PARTS);
