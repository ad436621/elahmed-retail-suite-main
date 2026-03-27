// ============================================================
// Mobiles & Mobile Accessories - Data Layer
// ============================================================

import { STORAGE_KEYS } from '@/config';
import { generateBarcode } from '@/domain/product';
import { MobileAccessory, MobileItem, MobileSparePart } from '@/domain/types';
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

const MOBILES_KEY = STORAGE_KEYS.MOBILES;
const ACCESSORIES_KEY = STORAGE_KEYS.MOBILE_ACCESSORIES;
const SPARE_PARTS_KEY = STORAGE_KEYS.MOBILE_SPARE_PARTS;

const MOBILE_SOURCE = 'mobile';
const MOBILE_ACCESSORY_TYPE = 'mobile_accessory';
const MOBILE_SPARE_PART_TYPE = 'mobile_spare_part';

function isActiveItem<T extends { isArchived?: boolean; deletedAt?: string | null }>(item: T): boolean {
  return !item.isArchived && !item.deletedAt;
}

function normalizeMobileItem(row: Partial<MobileItem>): MobileItem {
  const createdAt = String(row.createdAt ?? new Date().toISOString());
  const newCostPrice = Number(row.newCostPrice ?? row.costPrice ?? row.oldCostPrice ?? 0) || 0;
  return {
    id: String(row.id ?? crypto.randomUUID()),
    name: String(row.name ?? '').trim(),
    barcode: row.barcode ? String(row.barcode) : undefined,
    deviceType: row.deviceType === 'tablet' ? 'tablet' : 'mobile',
    category: row.category ? String(row.category) : undefined,
    condition: row.condition ?? 'new',
    quantity: Math.max(0, Math.round(Number(row.quantity ?? 0) || 0)),
    boxNumber: row.boxNumber ? String(row.boxNumber) : undefined,
    source: row.source ? String(row.source) : undefined,
    taxExcluded: Boolean(row.taxExcluded),
    storage: String(row.storage ?? ''),
    ram: String(row.ram ?? ''),
    color: String(row.color ?? ''),
    model: row.model ? String(row.model) : undefined,
    brand: row.brand ? String(row.brand) : undefined,
    supplier: String(row.supplier ?? ''),
    oldCostPrice: Number(row.oldCostPrice ?? 0) || 0,
    newCostPrice,
    costPrice: newCostPrice,
    salePrice: Number(row.salePrice ?? 0) || 0,
    profitMargin: Number(row.profitMargin ?? (Number(row.salePrice ?? 0) - newCostPrice)) || 0,
    serialNumber: String(row.serialNumber ?? ''),
    imei2: row.imei2 ? String(row.imei2) : undefined,
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

function toMobileRow(item: MobileItem): InventoryProductRow {
  return {
    id: item.id,
    name: item.name,
    barcode: item.barcode,
    deviceType: item.deviceType,
    category: item.category,
    condition: item.condition,
    storage: item.storage,
    ram: item.ram,
    color: item.color,
    model: item.model,
    brand: item.brand,
    description: item.description,
    boxNumber: item.boxNumber,
    taxExcluded: item.taxExcluded,
    quantity: item.quantity,
    oldCostPrice: item.oldCostPrice ?? 0,
    newCostPrice: item.newCostPrice ?? item.costPrice ?? 0,
    salePrice: item.salePrice,
    profitMargin: item.profitMargin,
    supplier: item.supplier,
    source: MOBILE_SOURCE,
    warehouseId: item.warehouseId,
    serialNumber: item.serialNumber,
    imei2: item.imei2,
    isArchived: item.isArchived,
    notes: item.notes,
    image: item.image,
    createdAt: item.createdAt,
    updatedAt: item.updatedAt,
    deletedAt: item.deletedAt ?? null,
  };
}

function normalizeMobileAccessory(row: Partial<MobileAccessory>): MobileAccessory {
  const createdAt = String(row.createdAt ?? new Date().toISOString());
  const newCostPrice = Number(row.newCostPrice ?? row.costPrice ?? row.oldCostPrice ?? 0) || 0;
  return {
    id: String(row.id ?? crypto.randomUUID()),
    name: String(row.name ?? '').trim(),
    model: String(row.model ?? ''),
    barcode: row.barcode ? String(row.barcode) : undefined,
    category: row.category ? String(row.category) : undefined,
    subcategory: String(row.subcategory ?? ''),
    quantity: Math.max(0, Math.round(Number(row.quantity ?? 0) || 0)),
    condition: row.condition ?? 'new',
    boxNumber: row.boxNumber ? String(row.boxNumber) : undefined,
    source: row.source ? String(row.source) : undefined,
    taxExcluded: Boolean(row.taxExcluded),
    brand: row.brand ? String(row.brand) : undefined,
    supplier: row.supplier ? String(row.supplier) : undefined,
    color: String(row.color ?? ''),
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

function toMobileAccessoryRow(item: MobileAccessory, inventoryType: string): InventoryAccessoryRow {
  const newCostPrice = item.newCostPrice ?? item.costPrice ?? 0;
  return {
    id: item.id,
    warehouseId: item.warehouseId,
    inventoryType,
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
    boxNumber: item.boxNumber,
    taxExcluded: item.taxExcluded,
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

function normalizeMobileSparePart(row: Partial<MobileSparePart>): MobileSparePart {
  const createdAt = String(row.createdAt ?? new Date().toISOString());
  const newCostPrice = Number(row.newCostPrice ?? row.costPrice ?? row.oldCostPrice ?? 0) || 0;
  return {
    id: String(row.id ?? crypto.randomUUID()),
    name: String(row.name ?? '').trim(),
    model: String(row.model ?? ''),
    barcode: row.barcode ? String(row.barcode) : undefined,
    category: row.category ? String(row.category) : undefined,
    subcategory: String(row.subcategory ?? ''),
    quantity: Math.max(0, Math.round(Number(row.quantity ?? 0) || 0)),
    condition: row.condition ?? 'new',
    boxNumber: row.boxNumber ? String(row.boxNumber) : undefined,
    source: row.source ? String(row.source) : undefined,
    taxExcluded: Boolean(row.taxExcluded),
    brand: row.brand ? String(row.brand) : undefined,
    supplier: row.supplier ? String(row.supplier) : undefined,
    color: String(row.color ?? ''),
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

function toMobileSparePartRow(item: MobileSparePart): InventoryAccessoryRow {
  const newCostPrice = item.newCostPrice ?? item.costPrice ?? 0;
  return {
    id: item.id,
    warehouseId: item.warehouseId,
    inventoryType: MOBILE_SPARE_PART_TYPE,
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
    boxNumber: item.boxNumber,
    taxExcluded: item.taxExcluded,
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
  inventoryType: 'mobile' | 'mobile_accessory' | 'mobile_spare_part',
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

export function getMobiles(): MobileItem[] {
  return getProductRows(MOBILE_SOURCE, MOBILES_KEY)
    .map((row) => normalizeMobileItem(row))
    .filter(isActiveItem);
}

export function saveMobiles(items: MobileItem[]): void {
  saveProductRows(MOBILE_SOURCE, MOBILES_KEY, items.map((item) => toMobileRow(normalizeMobileItem(item))));
}

export function addMobile(item: Omit<MobileItem, 'id' | 'createdAt' | 'updatedAt'>): MobileItem {
  const nextItem = normalizeMobileItem({
    ...item,
    id: crypto.randomUUID(),
    barcode: item.barcode || generateBarcode(),
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  });
  const saved = normalizeMobileItem(addProductRow(MOBILE_SOURCE, MOBILES_KEY, toMobileRow(nextItem)));
  registerBatch(saved.id, 'mobile', saved.name, saved.newCostPrice || saved.oldCostPrice || 0, saved.salePrice, saved.quantity, saved.createdAt, saved.supplier || '');
  return saved;
}

export function updateMobile(id: string, updates: Partial<MobileItem>): void {
  updateProductRow(MOBILE_SOURCE, MOBILES_KEY, id, {
    barcode: updates.barcode,
    deviceType: updates.deviceType,
    category: updates.category,
    condition: updates.condition,
    storage: updates.storage,
    ram: updates.ram,
    color: updates.color,
    model: updates.model,
    brand: updates.brand,
    description: updates.description,
    boxNumber: updates.boxNumber,
    taxExcluded: updates.taxExcluded,
    quantity: updates.quantity,
    oldCostPrice: updates.oldCostPrice,
    newCostPrice: updates.newCostPrice ?? updates.costPrice,
    salePrice: updates.salePrice,
    profitMargin: updates.profitMargin,
    supplier: updates.supplier,
    warehouseId: updates.warehouseId,
    serialNumber: updates.serialNumber,
    imei2: updates.imei2,
    isArchived: updates.isArchived,
    notes: updates.notes,
    image: updates.image,
    deletedAt: updates.deletedAt,
    updatedAt: new Date().toISOString(),
    name: updates.name,
  });
}

export function deleteMobile(id: string): void {
  updateProductRow(MOBILE_SOURCE, MOBILES_KEY, id, {
    isArchived: true,
    deletedAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  });
}

export function getMobileAccessories(): MobileAccessory[] {
  return getAccessoryRows(MOBILE_ACCESSORY_TYPE, ACCESSORIES_KEY)
    .map((row) => normalizeMobileAccessory(row))
    .filter(isActiveItem);
}

export function saveMobileAccessories(items: MobileAccessory[]): void {
  saveAccessoryRows(MOBILE_ACCESSORY_TYPE, ACCESSORIES_KEY, items.map((item) => toMobileAccessoryRow(normalizeMobileAccessory(item), MOBILE_ACCESSORY_TYPE)));
}

export function addMobileAccessory(item: Omit<MobileAccessory, 'id' | 'createdAt' | 'updatedAt'>): MobileAccessory {
  const nextItem = normalizeMobileAccessory({
    ...item,
    id: crypto.randomUUID(),
    barcode: item.barcode || generateBarcode(),
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  });
  const saved = normalizeMobileAccessory(addAccessoryRow(MOBILE_ACCESSORY_TYPE, ACCESSORIES_KEY, toMobileAccessoryRow(nextItem, MOBILE_ACCESSORY_TYPE)));
  registerBatch(saved.id, 'mobile_accessory', saved.name, saved.newCostPrice || saved.oldCostPrice || 0, saved.salePrice, saved.quantity, saved.createdAt, saved.supplier || '');
  return saved;
}

export function updateMobileAccessory(id: string, updates: Partial<MobileAccessory>): void {
  updateAccessoryRow(MOBILE_ACCESSORY_TYPE, ACCESSORIES_KEY, id, {
    name: updates.name,
    category: updates.category,
    subcategory: updates.subcategory,
    model: updates.model,
    barcode: updates.barcode,
    quantity: updates.quantity,
    oldCostPrice: updates.oldCostPrice,
    newCostPrice: updates.newCostPrice ?? updates.costPrice,
    costPrice: updates.newCostPrice ?? updates.costPrice,
    salePrice: updates.salePrice,
    profitMargin: updates.profitMargin,
    minStock: updates.minStock,
    condition: updates.condition,
    brand: updates.brand,
    supplier: updates.supplier,
    source: updates.source,
    boxNumber: updates.boxNumber,
    taxExcluded: updates.taxExcluded,
    color: updates.color,
    description: updates.description,
    warehouseId: updates.warehouseId,
    isArchived: updates.isArchived,
    deletedAt: updates.deletedAt,
    notes: updates.notes,
    image: updates.image,
    updatedAt: new Date().toISOString(),
  });
}

export function deleteMobileAccessory(id: string): void {
  updateAccessoryRow(MOBILE_ACCESSORY_TYPE, ACCESSORIES_KEY, id, {
    isArchived: true,
    deletedAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  });
}

export function getMobileSpareParts(): MobileSparePart[] {
  return getAccessoryRows(MOBILE_SPARE_PART_TYPE, SPARE_PARTS_KEY)
    .map((row) => normalizeMobileSparePart(row))
    .filter(isActiveItem);
}

export function saveMobileSpareParts(items: MobileSparePart[]): void {
  saveAccessoryRows(MOBILE_SPARE_PART_TYPE, SPARE_PARTS_KEY, items.map((item) => toMobileSparePartRow(normalizeMobileSparePart(item))));
}

export function addMobileSparePart(item: Omit<MobileSparePart, 'id' | 'createdAt' | 'updatedAt'>): MobileSparePart {
  const nextItem = normalizeMobileSparePart({
    ...item,
    id: crypto.randomUUID(),
    barcode: item.barcode || generateBarcode(),
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  });
  const saved = normalizeMobileSparePart(addAccessoryRow(MOBILE_SPARE_PART_TYPE, SPARE_PARTS_KEY, toMobileSparePartRow(nextItem)));
  registerBatch(saved.id, 'mobile_spare_part', saved.name, saved.newCostPrice || saved.oldCostPrice || 0, saved.salePrice, saved.quantity, saved.createdAt, saved.supplier || '');
  return saved;
}

export function updateMobileSparePart(id: string, updates: Partial<MobileSparePart>): void {
  updateAccessoryRow(MOBILE_SPARE_PART_TYPE, SPARE_PARTS_KEY, id, {
    name: updates.name,
    category: updates.category,
    subcategory: updates.subcategory,
    model: updates.model,
    barcode: updates.barcode,
    quantity: updates.quantity,
    oldCostPrice: updates.oldCostPrice,
    newCostPrice: updates.newCostPrice ?? updates.costPrice,
    costPrice: updates.newCostPrice ?? updates.costPrice,
    salePrice: updates.salePrice,
    profitMargin: updates.profitMargin,
    minStock: updates.minStock,
    condition: updates.condition,
    brand: updates.brand,
    supplier: updates.supplier,
    source: updates.source,
    boxNumber: updates.boxNumber,
    taxExcluded: updates.taxExcluded,
    color: updates.color,
    description: updates.description,
    warehouseId: updates.warehouseId,
    isArchived: updates.isArchived,
    deletedAt: updates.deletedAt,
    notes: updates.notes,
    image: updates.image,
    updatedAt: new Date().toISOString(),
  });
}

export function deleteMobileSparePart(id: string): void {
  updateAccessoryRow(MOBILE_SPARE_PART_TYPE, SPARE_PARTS_KEY, id, {
    isArchived: true,
    deletedAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  });
}
