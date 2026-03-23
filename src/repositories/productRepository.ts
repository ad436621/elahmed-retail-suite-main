// ============================================================
// GLEAMEX RETAIL SUITE — Product Repository
// Data access layer — persisted to localStorage
// ============================================================

import { Product, ProductSource, ProductCondition, MobileItem, MobileAccessory, DeviceItem, DeviceAccessory, ComputerItem, ComputerAccessory, CarItem } from '@/domain/types';
import { getMobiles, getMobileAccessories, updateMobile, updateMobileAccessory } from '@/data/mobilesData';
import { getComputers, getComputerAccessories, updateComputer, updateComputerAccessory } from '@/data/computersData';
import { getDevices, getDeviceAccessories, updateDevice, updateDeviceAccessory } from '@/data/devicesData';
import { getCars } from '@/data/carsData';
import { STORAGE_KEYS } from '@/config';
import { getStorageItem, setStorageItem } from '@/lib/localStorageHelper';

// Union type for all inventory item types
type InventoryItem = MobileItem | MobileAccessory | DeviceItem | DeviceAccessory | ComputerItem | ComputerAccessory | CarItem;

const STORAGE_KEY = STORAGE_KEYS.PRODUCTS;

/** Load products from localStorage */
function loadStore(): Product[] {
  return getStorageItem<Product[]>(STORAGE_KEY, []);
}

/** Persist products to localStorage */
function persistStore(products: Product[]): void {
  setStorageItem(STORAGE_KEY, products);
}

/** Generate unique barcode */
export function generateUniqueBarcode(): string {
  const timestamp = Date.now().toString(36).toUpperCase();
  const random = Math.random().toString(36).substring(2, 6).toUpperCase();
  return `AUTO-${timestamp}-${random}`;
}

/** Check if barcode already exists across all inventories */
export function isBarcodeDuplicate(barcode: string, excludeId?: string): boolean {
  if (!barcode || barcode.startsWith('AUTO-')) return false; // Auto-generated are always unique
  const allProds = getAllInventoryProducts();
  return allProds.some(p => p.barcode === barcode && p.id !== excludeId && p.deletedAt === null);
}

// Type-safe field access with fallbacks
function getBarcode(item: InventoryItem): string {
  return 'barcode' in item ? (item as { barcode: string }).barcode : item.id;
}

function getSupplier(item: InventoryItem): string {
  return 'supplier' in item ? (item as { supplier: string }).supplier : '';
}

function getCostPrice(item: InventoryItem): number {
  if ('oldCostPrice' in item) {
    const oldCost = (item as { oldCostPrice: number }).oldCostPrice;
    if (oldCost && oldCost > 0) return oldCost;
  }
  if ('newCostPrice' in item) {
    const newCost = (item as { newCostPrice: number }).newCostPrice;
    return newCost || 0;
  }
  if ('costPrice' in item) {
    return (item as { costPrice: number }).costPrice || 0;
  }
  return 0;
}

function getSellingPrice(item: InventoryItem): number {
  if ('salePrice' in item) return (item as { salePrice: number }).salePrice || 0;
  if ('sellingPrice' in item) return (item as { sellingPrice: number }).sellingPrice || 0;
  return 0;
}

function getCreatedAt(item: InventoryItem): string {
  return 'createdAt' in item ? (item as { createdAt: string }).createdAt : new Date().toISOString();
}

function getUpdatedAt(item: InventoryItem): string {
  return 'updatedAt' in item ? (item as { updatedAt: string }).updatedAt : new Date().toISOString();
}

const mapToProduct = (
  item: InventoryItem,
  categoryLabel: string,
  source: ProductSource = 'legacy',
  condition?: ProductCondition,
  categoryId?: string,
): Product => ({
  id: item.id,
  name: item.name,
  model: 'model' in item ? item.model : '',
  barcode: getBarcode(item),
  category: categoryLabel,
  categoryId: categoryId || ('category' in item ? (item as any).category : undefined),
  source,
  condition: condition || ('condition' in item ? (item as any).condition : 'new'),
  supplier: getSupplier(item),
  costPrice: getCostPrice(item),
  sellingPrice: getSellingPrice(item),
  quantity: 'quantity' in item ? (item as any).quantity : 1,
  minimumMarginPct: 0,
  image: 'image' in item ? (item as any).image : undefined,
  createdAt: getCreatedAt(item),
  updatedAt: getUpdatedAt(item),
  deletedAt: null,
  warehouseId: 'warehouseId' in item ? (item as any).warehouseId : undefined,
});

export function getAllInventoryProducts(): Product[] {
  const mainProducts = productStore.filter(p => p.deletedAt === null);

  const mobiles = getMobiles().map(m => mapToProduct(m, 'موبايلات', 'mobile', m.condition));
  const mAcc = getMobileAccessories().map(m => mapToProduct(m, 'إكسسوارات موبايل', 'mobile_acc'));

  const computers = getComputers().map(c => mapToProduct(c, 'كمبيوتر', 'computer', c.condition));
  const cAcc = getComputerAccessories().map(c => mapToProduct(c, 'إكسسوارات كمبيوتر', 'computer_acc'));

  const devices = getDevices().map(d => mapToProduct(d, 'أجهزة', 'device', d.condition));
  const dAcc = getDeviceAccessories().map(d => mapToProduct(d, 'إكسسوارات أجهزة', 'device_acc'));

  const cars = getCars().map(c => mapToProduct(c, 'سيارات', 'car', c.condition));

  return [...mainProducts, ...mobiles, ...mAcc, ...computers, ...cAcc, ...devices, ...dAcc, ...cars];
}

// Initialize from localStorage
let productStore: Product[] = loadStore();

export function getAllProducts(): Product[] {
  return productStore.filter(p => p.deletedAt === null);
}

export function getProductById(id: string): Product | undefined {
  return productStore.find(p => p.id === id && p.deletedAt === null);
}

export function getProductByBarcode(barcode: string): Product | undefined {
  return productStore.find(p => p.barcode === barcode && p.deletedAt === null);
}

export function saveProduct(product: Product): void {
  const idx = productStore.findIndex(p => p.id === product.id);
  if (idx >= 0) {
    productStore[idx] = product;
  } else {
    productStore.push(product);
  }
  persistStore(productStore);
}

export function updateProductQuantity(productId: string, newQuantity: number): void {
  // 1. Try Main Product Store
  const idx = productStore.findIndex(p => p.id === productId);
  if (idx >= 0) {
    productStore[idx] = {
      ...productStore[idx],
      quantity: newQuantity,
      updatedAt: new Date().toISOString(),
    };
    persistStore(productStore);
    return;
  }

  // 2. Try External Data Stores
  const m = getMobiles().find(x => x.id === productId);
  if (m) { updateMobile(productId, { quantity: newQuantity }); return; }

  const mAcc = getMobileAccessories().find(x => x.id === productId);
  if (mAcc) { updateMobileAccessory(productId, { quantity: newQuantity }); return; }

  const c = getComputers().find(x => x.id === productId);
  if (c) { updateComputer(productId, { quantity: newQuantity }); return; }

  const cAcc = getComputerAccessories().find(x => x.id === productId);
  if (cAcc) { updateComputerAccessory(productId, { quantity: newQuantity }); return; }

  const d = getDevices().find(x => x.id === productId);
  if (d) { updateDevice(productId, { quantity: newQuantity }); return; }

  const dAcc = getDeviceAccessories().find(x => x.id === productId);
  if (dAcc) { updateDeviceAccessory(productId, { quantity: newQuantity }); return; }
}

export function softDeleteProduct(productId: string): void {
  const idx = productStore.findIndex(p => p.id === productId);
  if (idx >= 0) {
    productStore[idx] = {
      ...productStore[idx],
      deletedAt: new Date().toISOString(),
    };
    persistStore(productStore);
  }
}

