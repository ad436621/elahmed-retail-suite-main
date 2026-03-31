// ============================================================
// Devices & Device Accessories - Data Layer
// ============================================================

import { STORAGE_KEYS } from '@/config';
import { generateBarcode } from '@/domain/product';
import { DeviceAccessory, DeviceItem } from '@/domain/types';
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

const DEVICES_KEY = STORAGE_KEYS.DEVICES;
const ACCESSORIES_KEY = STORAGE_KEYS.DEVICE_ACCESSORIES;

const DEVICE_SOURCE = 'device';
const DEVICE_ACCESSORY_TYPE = 'device_accessory_legacy';

function isActiveItem<T extends { isArchived?: boolean; deletedAt?: string | null }>(item: T): boolean {
  return !item.isArchived && !item.deletedAt;
}

function normalizeDevice(row: Partial<DeviceItem>): DeviceItem {
  const createdAt = String(row.createdAt ?? new Date().toISOString());
  const newCostPrice = Number(row.newCostPrice ?? row.costPrice ?? row.oldCostPrice ?? 0) || 0;
  return {
    id: String(row.id ?? crypto.randomUUID()),
    name: String(row.name ?? '').trim(),
    model: String(row.model ?? ''),
    barcode: row.barcode ? String(row.barcode) : undefined,
    category: row.category ? String(row.category) : undefined,
    condition: row.condition ?? 'new',
    color: String(row.color ?? ''),
    brand: row.brand ? String(row.brand) : undefined,
    supplier: row.supplier ? String(row.supplier) : undefined,
    source: row.source ? String(row.source) : undefined,
    quantity: Math.max(0, Math.round(Number(row.quantity ?? 0) || 0)),
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

function toDeviceRow(item: DeviceItem): InventoryProductRow {
  return {
    id: item.id,
    name: item.name,
    model: item.model,
    barcode: item.barcode,
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
    source: DEVICE_SOURCE,
    warehouseId: item.warehouseId,
    isArchived: item.isArchived,
    notes: item.notes,
    image: item.image,
    createdAt: item.createdAt,
    updatedAt: item.updatedAt,
    deletedAt: item.deletedAt ?? null,
  };
}

function normalizeDeviceAccessory(row: Partial<DeviceAccessory>): DeviceAccessory {
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

function toDeviceAccessoryRow(item: DeviceAccessory): InventoryAccessoryRow {
  const newCostPrice = item.newCostPrice ?? item.costPrice ?? 0;
  return {
    id: item.id,
    warehouseId: item.warehouseId,
    inventoryType: DEVICE_ACCESSORY_TYPE,
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
  inventoryType: 'device' | 'device_accessory',
  productName: string,
  costPrice: number,
  salePrice: number,
  quantity: number,
  purchaseDate: string,
  supplier: string,
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
    supplier,
    notes: 'رصيد افتتاحي (إضافة جديدة)',
  });
}

export function getDevices(): DeviceItem[] {
  return getProductRows(DEVICE_SOURCE, DEVICES_KEY)
    .map((row) => normalizeDevice(row))
    .filter(isActiveItem);
}

export function saveDevices(items: DeviceItem[]): void {
  saveProductRows(DEVICE_SOURCE, DEVICES_KEY, items.map((item) => toDeviceRow(normalizeDevice(item))));
}

export function addDevice(item: Omit<DeviceItem, 'id' | 'createdAt' | 'updatedAt'>): DeviceItem {
  const nextItem = normalizeDevice({
    ...item,
    id: crypto.randomUUID(),
    barcode: item.barcode || generateBarcode(),
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  });
  const saved = normalizeDevice(addProductRow(DEVICE_SOURCE, DEVICES_KEY, toDeviceRow(nextItem)));
  registerBatch(saved.id, 'device', saved.name, saved.newCostPrice || saved.oldCostPrice || 0, saved.salePrice, saved.quantity, saved.createdAt, saved.supplier || '');
  return saved;
}

export function updateDevice(id: string, updates: Partial<DeviceItem>): void {
  const payload: any = { ...updates, updatedAt: new Date().toISOString() };
  if ('costPrice' in updates && !('newCostPrice' in updates)) {
    payload.newCostPrice = updates.costPrice;
  }
  updateProductRow(DEVICE_SOURCE, DEVICES_KEY, id, payload);
}

export function deleteDevice(id: string): void {
  updateProductRow(DEVICE_SOURCE, DEVICES_KEY, id, {
    isArchived: true,
    deletedAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  });
}

export function getDeviceAccessories(): DeviceAccessory[] {
  return getAccessoryRows(DEVICE_ACCESSORY_TYPE, ACCESSORIES_KEY)
    .map((row) => normalizeDeviceAccessory(row))
    .filter(isActiveItem);
}

export function saveDeviceAccessories(items: DeviceAccessory[]): void {
  saveAccessoryRows(DEVICE_ACCESSORY_TYPE, ACCESSORIES_KEY, items.map((item) => toDeviceAccessoryRow(normalizeDeviceAccessory(item))));
}

export function addDeviceAccessory(item: Omit<DeviceAccessory, 'id' | 'createdAt' | 'updatedAt'>): DeviceAccessory {
  const nextItem = normalizeDeviceAccessory({
    ...item,
    id: crypto.randomUUID(),
    barcode: item.barcode || generateBarcode(),
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  });
  const saved = normalizeDeviceAccessory(addAccessoryRow(DEVICE_ACCESSORY_TYPE, ACCESSORIES_KEY, toDeviceAccessoryRow(nextItem)));
  registerBatch(saved.id, 'device_accessory', saved.name, saved.newCostPrice || saved.oldCostPrice || 0, saved.salePrice, saved.quantity, saved.createdAt, saved.supplier || '');
  return saved;
}

export function updateDeviceAccessory(id: string, updates: Partial<DeviceAccessory>): void {
  const payload: any = { ...updates, updatedAt: new Date().toISOString() };
  if ('costPrice' in updates && !('newCostPrice' in updates)) {
    payload.newCostPrice = updates.costPrice;
  }
  updateAccessoryRow(DEVICE_ACCESSORY_TYPE, ACCESSORIES_KEY, id, payload);
}

export function deleteDeviceAccessory(id: string): void {
  updateAccessoryRow(DEVICE_ACCESSORY_TYPE, ACCESSORIES_KEY, id, {
    isArchived: true,
    deletedAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  });
}
