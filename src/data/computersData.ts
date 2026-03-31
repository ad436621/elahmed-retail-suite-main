// ============================================================
// Computers & Computer Accessories - Data Layer
// ============================================================

import { STORAGE_KEYS } from '@/config';
import { generateBarcode } from '@/domain/product';
import { ComputerAccessory, ComputerItem } from '@/domain/types';
import {
  addAccessoryRow,
  addProductRow,
  getAccessoryRows,
  getProductRows,
  InventoryAccessoryRow,
  InventoryProductRow,
  saveAccessoryRows,
  saveProductRows,
  updateAccessoryRow,
  updateProductRow,
} from './inventoryTableBridge';
import { addBatch } from './batchesData';

const COMPUTERS_KEY = STORAGE_KEYS.COMPUTERS;
const ACCESSORIES_KEY = STORAGE_KEYS.COMPUTER_ACCESSORIES;

const COMPUTER_SOURCE = 'computer';
const COMPUTER_ACCESSORY_TYPE = 'computer_accessory_legacy';

function isActiveItem<T extends { isArchived?: boolean; deletedAt?: string | null }>(item: T): boolean {
  return !item.isArchived && !item.deletedAt;
}

function normalizeComputer(row: Partial<ComputerItem>): ComputerItem {
  const createdAt = String(row.createdAt ?? new Date().toISOString());
  const newCostPrice = Number(row.newCostPrice ?? row.costPrice ?? row.oldCostPrice ?? 0) || 0;
  return {
    id: String(row.id ?? crypto.randomUUID()),
    name: String(row.name ?? '').trim(),
    model: String(row.model ?? ''),
    barcode: row.barcode ? String(row.barcode) : undefined,
    deviceType: row.deviceType === 'laptop' ? 'laptop' : 'computer',
    category: row.category ? String(row.category) : undefined,
    condition: row.condition ?? 'new',
    color: String(row.color ?? ''),
    brand: row.brand ? String(row.brand) : undefined,
    supplier: row.supplier ? String(row.supplier) : undefined,
    source: row.source ? String(row.source) : undefined,
    quantity: Math.max(0, Math.round(Number(row.quantity ?? 0) || 0)),
    processor: row.processor ? String(row.processor) : undefined,
    ram: row.ram ? String(row.ram) : undefined,
    storage: row.storage ? String(row.storage) : undefined,
    oldCostPrice: Number(row.oldCostPrice ?? 0) || 0,
    newCostPrice,
    costPrice: newCostPrice,
    salePrice: Number(row.salePrice ?? 0) || 0,
    profitMargin: Number(row.profitMargin ?? (Number(row.salePrice ?? 0) - newCostPrice)) || 0,
    minStock: Math.max(0, Math.round(Number(row.minStock ?? 0) || 0)),
    notes: String(row.notes ?? ''),
    description: String(row.description ?? ''),
    image: row.image ? String(row.image) : undefined,
    warehouseId: row.warehouseId ? String(row.warehouseId) : undefined,
    isArchived: Boolean(row.isArchived),
    deletedAt: row.deletedAt ? String(row.deletedAt) : null,
    createdAt,
    updatedAt: String(row.updatedAt ?? createdAt),
  };
}

function toComputerRow(item: ComputerItem): InventoryProductRow {
  return {
    id: item.id,
    name: item.name,
    model: item.model,
    barcode: item.barcode,
    deviceType: item.deviceType,
    category: item.category,
    condition: item.condition,
    color: item.color,
    brand: item.brand,
    description: item.description,
    quantity: item.quantity,
    oldCostPrice: item.oldCostPrice ?? 0,
    newCostPrice: item.newCostPrice ?? item.costPrice ?? 0,
    salePrice: item.salePrice,
    profitMargin: item.profitMargin,
    minStock: item.minStock,
    supplier: item.supplier,
    source: COMPUTER_SOURCE,
    warehouseId: item.warehouseId,
    processor: item.processor,
    storage: item.storage,
    ram: item.ram,
    isArchived: item.isArchived,
    notes: item.notes,
    image: item.image,
    createdAt: item.createdAt,
    updatedAt: item.updatedAt,
    deletedAt: item.deletedAt ?? null,
  };
}

function normalizeComputerAccessory(row: Partial<ComputerAccessory>): ComputerAccessory {
  const createdAt = String(row.createdAt ?? new Date().toISOString());
  const newCostPrice = Number(row.newCostPrice ?? row.costPrice ?? row.oldCostPrice ?? 0) || 0;
  return {
    id: String(row.id ?? crypto.randomUUID()),
    name: String(row.name ?? '').trim(),
    model: String(row.model ?? ''),
    barcode: row.barcode ? String(row.barcode) : undefined,
    category: row.category ? String(row.category) : undefined,
    subcategory: String(row.subcategory ?? ''),
    condition: row.condition ?? 'new',
    quantity: Math.max(0, Math.round(Number(row.quantity ?? 0) || 0)),
    color: String(row.color ?? ''),
    brand: row.brand ? String(row.brand) : undefined,
    supplier: row.supplier ? String(row.supplier) : undefined,
    source: row.source ? String(row.source) : undefined,
    oldCostPrice: Number(row.oldCostPrice ?? 0) || 0,
    newCostPrice,
    costPrice: newCostPrice,
    salePrice: Number(row.salePrice ?? 0) || 0,
    profitMargin: Number(row.profitMargin ?? (Number(row.salePrice ?? 0) - newCostPrice)) || 0,
    minStock: Math.max(0, Math.round(Number(row.minStock ?? 0) || 0)),
    notes: String(row.notes ?? ''),
    description: String(row.description ?? ''),
    image: row.image ? String(row.image) : undefined,
    warehouseId: row.warehouseId ? String(row.warehouseId) : undefined,
    isArchived: Boolean(row.isArchived),
    deletedAt: row.deletedAt ? String(row.deletedAt) : null,
    createdAt,
    updatedAt: String(row.updatedAt ?? createdAt),
  };
}

function toComputerAccessoryRow(item: ComputerAccessory): InventoryAccessoryRow {
  const newCostPrice = item.newCostPrice ?? item.costPrice ?? 0;
  return {
    id: item.id,
    warehouseId: item.warehouseId,
    inventoryType: COMPUTER_ACCESSORY_TYPE,
    name: item.name,
    category: item.category,
    subcategory: item.subcategory,
    model: item.model,
    barcode: item.barcode,
    quantity: item.quantity,
    oldCostPrice: item.oldCostPrice ?? 0,
    newCostPrice,
    costPrice: newCostPrice,
    salePrice: item.salePrice,
    profitMargin: item.profitMargin,
    minStock: item.minStock,
    condition: item.condition,
    brand: item.brand,
    supplier: item.supplier,
    source: item.source,
    color: item.color,
    description: item.description,
    isArchived: item.isArchived,
    deletedAt: item.deletedAt ?? null,
    notes: item.notes,
    image: item.image,
    createdAt: item.createdAt,
    updatedAt: item.updatedAt,
  };
}

function registerBatch(
  productId: string,
  inventoryType: 'computer' | 'computer_accessory',
  productName: string,
  costPrice: number,
  salePrice: number,
  quantity: number,
  purchaseDate: string,
): void {
  if (quantity <= 0) return;

  addBatch({
    productId,
    inventoryType,
    productName,
    costPrice,
    salePrice,
    quantity,
    remainingQty: quantity,
    purchaseDate,
    supplier: '',
    notes: 'رصيد افتتاحي (إضافة جديدة)',
  });
}

export function getComputers(): ComputerItem[] {
  return getProductRows(COMPUTER_SOURCE, COMPUTERS_KEY)
    .map((row) => normalizeComputer(row))
    .filter(isActiveItem);
}

export function saveComputers(items: ComputerItem[]): void {
  saveProductRows(COMPUTER_SOURCE, COMPUTERS_KEY, items.map((item) => toComputerRow(normalizeComputer(item))));
}

export function addComputer(item: Omit<ComputerItem, 'id' | 'createdAt' | 'updatedAt'>): ComputerItem {
  const nextItem = normalizeComputer({
    ...item,
    id: crypto.randomUUID(),
    barcode: item.barcode || generateBarcode(),
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  });
  const saved = normalizeComputer(addProductRow(COMPUTER_SOURCE, COMPUTERS_KEY, toComputerRow(nextItem)));
  registerBatch(saved.id, 'computer', saved.name, saved.newCostPrice || saved.oldCostPrice || 0, saved.salePrice, saved.quantity, saved.createdAt);
  return saved;
}

export function updateComputer(id: string, updates: Partial<ComputerItem>): void {
  const payload: any = { ...updates, updatedAt: new Date().toISOString() };
  if ('costPrice' in updates && !('newCostPrice' in updates)) {
    payload.newCostPrice = updates.costPrice;
  }
  updateProductRow(COMPUTER_SOURCE, COMPUTERS_KEY, id, payload);
}

export function deleteComputer(id: string): void {
  updateProductRow(COMPUTER_SOURCE, COMPUTERS_KEY, id, {
    isArchived: true,
    deletedAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  });
}

export function getComputerAccessories(): ComputerAccessory[] {
  return getAccessoryRows(COMPUTER_ACCESSORY_TYPE, ACCESSORIES_KEY)
    .map((row) => normalizeComputerAccessory(row))
    .filter(isActiveItem);
}

export function saveComputerAccessories(items: ComputerAccessory[]): void {
  saveAccessoryRows(COMPUTER_ACCESSORY_TYPE, ACCESSORIES_KEY, items.map((item) => toComputerAccessoryRow(normalizeComputerAccessory(item))));
}

export function addComputerAccessory(item: Omit<ComputerAccessory, 'id' | 'createdAt' | 'updatedAt'>): ComputerAccessory {
  const nextItem = normalizeComputerAccessory({
    ...item,
    id: crypto.randomUUID(),
    barcode: item.barcode || generateBarcode(),
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  });
  const saved = normalizeComputerAccessory(addAccessoryRow(COMPUTER_ACCESSORY_TYPE, ACCESSORIES_KEY, toComputerAccessoryRow(nextItem)));
  registerBatch(saved.id, 'computer_accessory', saved.name, saved.newCostPrice || saved.oldCostPrice || 0, saved.salePrice, saved.quantity, saved.createdAt);
  return saved;
}

export function updateComputerAccessory(id: string, updates: Partial<ComputerAccessory>): void {
  const payload: any = { ...updates, updatedAt: new Date().toISOString() };
  if ('costPrice' in updates && !('newCostPrice' in updates)) {
    payload.newCostPrice = updates.costPrice;
  }
  updateAccessoryRow(COMPUTER_ACCESSORY_TYPE, ACCESSORIES_KEY, id, payload);
}

export function deleteComputerAccessory(id: string): void {
  updateAccessoryRow(COMPUTER_ACCESSORY_TYPE, ACCESSORIES_KEY, id, {
    isArchived: true,
    deletedAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  });
}
