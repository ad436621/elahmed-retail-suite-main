// ============================================================
// GLEAMEX RETAIL SUITE - Product Repository
// Unified inventory access backed by SQLite/local fallback
// ============================================================

import { STORAGE_KEYS } from '@/config';
import {
  CarItem,
  ComputerAccessory,
  ComputerItem,
  DeviceAccessory,
  DeviceItem,
  MobileAccessory,
  MobileItem,
  MobileSparePart,
  Product,
  ProductCondition,
  ProductSource,
} from '@/domain/types';
import {
  getMobileAccessories,
  getMobileSpareParts,
  getMobiles,
  updateMobile,
  updateMobileAccessory,
  updateMobileSparePart,
} from '@/data/mobilesData';
import {
  getComputerAccessories,
  getComputers,
  updateComputer,
  updateComputerAccessory,
} from '@/data/computersData';
import {
  getDeviceAccessories,
  getDevices,
  updateDevice,
  updateDeviceAccessory,
} from '@/data/devicesData';
import {
  computerAccessoriesDB,
  computerSparePartsDB,
  deviceAccessoriesDB,
  deviceSparePartsDB,
  carSparePartsDB,
  carOilsDB,
} from '@/data/subInventoryData';
import { getCars } from '@/data/carsData';
import {
  addProductRow,
  getProductRows,
  InventoryProductRow,
  updateProductRow,
} from '@/data/inventoryTableBridge';

type SubInventoryItem = ReturnType<typeof computerAccessoriesDB.get>[number];
type InventoryItem =
  | MobileItem
  | MobileAccessory
  | MobileSparePart
  | DeviceItem
  | DeviceAccessory
  | ComputerItem
  | ComputerAccessory
  | SubInventoryItem
  | CarItem;

const LEGACY_STORAGE_KEY = STORAGE_KEYS.PRODUCTS;
const LEGACY_SOURCE = 'legacy';

function getLegacyProductRows(): InventoryProductRow[] {
  return getProductRows(LEGACY_SOURCE, LEGACY_STORAGE_KEY);
}

function rowToProduct(row: InventoryProductRow): Product {
  const costPrice = Number(row.newCostPrice ?? row.oldCostPrice ?? 0) || 0;
  return {
    id: row.id,
    name: row.name,
    model: row.model ?? '',
    barcode: row.barcode ?? row.id,
    category: row.category ?? '',
    source: LEGACY_SOURCE,
    condition: (row.condition as ProductCondition | undefined) ?? 'new',
    supplier: row.supplier ?? '',
    costPrice,
    sellingPrice: Number(row.salePrice ?? 0) || 0,
    quantity: Math.max(0, Math.round(Number(row.quantity ?? 0) || 0)),
    minimumMarginPct: 0,
    image: row.image,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    deletedAt: row.deletedAt ?? null,
    warehouseId: row.warehouseId,
  };
}

function productToRow(product: Product): InventoryProductRow {
  return {
    id: product.id,
    name: product.name,
    model: product.model,
    barcode: product.barcode,
    category: product.category,
    condition: product.condition,
    quantity: product.quantity,
    oldCostPrice: product.costPrice,
    newCostPrice: product.costPrice,
    salePrice: product.sellingPrice,
    profitMargin: product.sellingPrice - product.costPrice,
    supplier: product.supplier,
    source: LEGACY_SOURCE,
    warehouseId: product.warehouseId,
    notes: '',
    image: product.image,
    createdAt: product.createdAt,
    updatedAt: product.updatedAt,
    deletedAt: product.deletedAt,
  };
}

import { generateBarcode as idGenBarcode } from '@/lib/idGenerator';

export function generateUniqueBarcode(): string {
  return idGenBarcode('AUTO');
}

export function isBarcodeDuplicate(barcode: string, excludeId?: string): boolean {
  if (!barcode || barcode.startsWith('AUTO-')) return false;
  const allProducts = getAllInventoryProducts();
  return allProducts.some((product) => product.barcode === barcode && product.id !== excludeId && product.deletedAt === null);
}

function getBarcode(item: InventoryItem): string {
  return 'barcode' in item && typeof item.barcode === 'string' && item.barcode.trim()
    ? item.barcode
    : item.id;
}

function getSupplier(item: InventoryItem): string {
  return 'supplier' in item && typeof item.supplier === 'string' ? item.supplier : '';
}

function getCostPrice(item: InventoryItem): number {
  // Prefer newCostPrice (latest purchase cost) for accurate profit calculation
  if ('newCostPrice' in item) {
    const newCost = item.newCostPrice;
    if (newCost && newCost > 0) return newCost;
  }

  if ('oldCostPrice' in item) {
    const oldCost = item.oldCostPrice;
    if (oldCost && oldCost > 0) return oldCost;
  }

  if ('costPrice' in item) {
    return item.costPrice || 0;
  }

  return 0;
}

function getSellingPrice(item: InventoryItem): number {
  if ('salePrice' in item) return item.salePrice || 0;
  if ('sellingPrice' in item) return (item as any).sellingPrice || 0;
  return 0;
}

function getCreatedAt(item: InventoryItem): string {
  return 'createdAt' in item && typeof item.createdAt === 'string'
    ? item.createdAt
    : new Date().toISOString();
}

function getUpdatedAt(item: InventoryItem): string {
  return 'updatedAt' in item && typeof item.updatedAt === 'string'
    ? item.updatedAt
    : new Date().toISOString();
}

function getModel(item: InventoryItem): string {
  return 'model' in item && typeof item.model === 'string' ? item.model : '';
}

function getCondition(item: InventoryItem, fallback?: ProductCondition): ProductCondition {
  if (fallback) return fallback;
  return 'condition' in item && item.condition ? item.condition : 'new';
}

function getCategoryId(item: InventoryItem, fallback?: string): string | undefined {
  if (fallback) return fallback;
  return 'category' in item && typeof item.category === 'string' ? item.category : undefined;
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
  model: getModel(item),
  barcode: getBarcode(item),
  category: categoryLabel,
  categoryId: getCategoryId(item, categoryId),
  source,
  condition: getCondition(item, condition),
  supplier: getSupplier(item),
  costPrice: getCostPrice(item),
  sellingPrice: getSellingPrice(item),
  quantity: 'quantity' in item ? item.quantity : 1,
  minimumMarginPct: 0,
  image: 'image' in item ? item.image : undefined,
  createdAt: getCreatedAt(item),
  updatedAt: getUpdatedAt(item),
  deletedAt: null,
  warehouseId: 'warehouseId' in item ? item.warehouseId : undefined,
});

export function getAllInventoryProducts(): Product[] {
  const mainProducts = getAllProducts();

  const mobiles = getMobiles().map((item) => mapToProduct(item, 'موبايلات', 'mobile', item.condition));
  const mobileAccessories = getMobileAccessories().map((item) => mapToProduct(item, 'إكسسوارات موبايل', 'mobile_acc'));
  const mobileSpareParts = getMobileSpareParts().map((item) => mapToProduct(item, 'قطع غيار موبايل', 'mobile_spare', item.condition));

  const computers = getComputers().map((item) => mapToProduct(item, 'كمبيوتر', 'computer', item.condition));
  const legacyComputerAccessories = getComputerAccessories().map((item) => mapToProduct(item, 'إكسسوارات كمبيوتر', 'computer_acc'));
  const computerAccessories = computerAccessoriesDB.get().map((item) => mapToProduct(item, 'إكسسوارات كمبيوتر', 'computer_acc', item.condition));
  const computerSpareParts = computerSparePartsDB.get().map((item) => mapToProduct(item, 'قطع غيار كمبيوتر', 'computer_spare', item.condition));

  const devices = getDevices().map((item) => mapToProduct(item, 'أجهزة', 'device', item.condition));
  const legacyDeviceAccessories = getDeviceAccessories().map((item) => mapToProduct(item, 'إكسسوارات أجهزة', 'device_acc'));
  const deviceAccessories = deviceAccessoriesDB.get().map((item) => mapToProduct(item, 'إكسسوارات أجهزة', 'device_acc', item.condition));
  const deviceSpareParts = deviceSparePartsDB.get().map((item) => mapToProduct(item, 'قطع غيار أجهزة', 'device_spare', item.condition));

  const cars = getCars().map((item) => mapToProduct(item, 'سيارات', 'car', item.condition));
  const carSpareParts = carSparePartsDB.get().map((item) => mapToProduct(item, 'قطع غيار سيارات', 'car_spare', item.condition));
  const carOils = carOilsDB.get().map((item) => mapToProduct(item, 'زيوت سيارات', 'car_oils', item.condition));

  return [
    ...mainProducts,
    ...mobiles,
    ...mobileAccessories,
    ...mobileSpareParts,
    ...computers,
    ...legacyComputerAccessories,
    ...computerAccessories,
    ...computerSpareParts,
    ...devices,
    ...legacyDeviceAccessories,
    ...deviceAccessories,
    ...deviceSpareParts,
    ...cars,
    ...carSpareParts,
    ...carOils,
  ];
}

export function getAllProducts(): Product[] {
  return getLegacyProductRows()
    .map(rowToProduct)
    .filter((product) => product.deletedAt === null);
}

export function getProductById(id: string): Product | undefined {
  return getLegacyProductRows()
    .map(rowToProduct)
    .find((product) => product.id === id && product.deletedAt === null);
}

export function getProductByBarcode(barcode: string): Product | undefined {
  return getLegacyProductRows()
    .map(rowToProduct)
    .find((product) => product.barcode === barcode && product.deletedAt === null);
}

export function saveProduct(product: Product): void {
  const existing = getLegacyProductRows().find((row) => row.id === product.id);
  const payload = productToRow(product);

  if (existing) {
    updateProductRow(LEGACY_SOURCE, LEGACY_STORAGE_KEY, product.id, payload);
    return;
  }

  addProductRow(LEGACY_SOURCE, LEGACY_STORAGE_KEY, payload);
}

export function updateProductQuantity(productId: string, newQuantity: number): void {
  const storeProduct = getProductById(productId);
  if (storeProduct) {
    updateProductRow(LEGACY_SOURCE, LEGACY_STORAGE_KEY, productId, {
      quantity: newQuantity,
      updatedAt: new Date().toISOString(),
    });
    return;
  }

  const mobile = getMobiles().find((item) => item.id === productId);
  if (mobile) {
    updateMobile(productId, { quantity: newQuantity });
    return;
  }

  const mobileAccessory = getMobileAccessories().find((item) => item.id === productId);
  if (mobileAccessory) {
    updateMobileAccessory(productId, { quantity: newQuantity });
    return;
  }

  const mobileSparePart = getMobileSpareParts().find((item) => item.id === productId);
  if (mobileSparePart) {
    updateMobileSparePart(productId, { quantity: newQuantity });
    return;
  }

  const computer = getComputers().find((item) => item.id === productId);
  if (computer) {
    updateComputer(productId, { quantity: newQuantity });
    return;
  }

  const legacyComputerAccessory = getComputerAccessories().find((item) => item.id === productId);
  if (legacyComputerAccessory) {
    updateComputerAccessory(productId, { quantity: newQuantity });
    return;
  }

  const computerAccessory = computerAccessoriesDB.get().find((item) => item.id === productId);
  if (computerAccessory) {
    computerAccessoriesDB.update(productId, { quantity: newQuantity });
    return;
  }

  const computerSparePart = computerSparePartsDB.get().find((item) => item.id === productId);
  if (computerSparePart) {
    computerSparePartsDB.update(productId, { quantity: newQuantity });
    return;
  }

  const device = getDevices().find((item) => item.id === productId);
  if (device) {
    updateDevice(productId, { quantity: newQuantity });
    return;
  }

  const legacyDeviceAccessory = getDeviceAccessories().find((item) => item.id === productId);
  if (legacyDeviceAccessory) {
    updateDeviceAccessory(productId, { quantity: newQuantity });
    return;
  }

  const deviceAccessory = deviceAccessoriesDB.get().find((item) => item.id === productId);
  if (deviceAccessory) {
    deviceAccessoriesDB.update(productId, { quantity: newQuantity });
    return;
  }

  const deviceSparePart = deviceSparePartsDB.get().find((item) => item.id === productId);
  if (deviceSparePart) {
    deviceSparePartsDB.update(productId, { quantity: newQuantity });
    return;
  }

  const carSparePart = carSparePartsDB.get().find((item) => item.id === productId);
  if (carSparePart) {
    carSparePartsDB.update(productId, { quantity: newQuantity });
    return;
  }

  const carOil = carOilsDB.get().find((item) => item.id === productId);
  if (carOil) {
    carOilsDB.update(productId, { quantity: newQuantity });
  }
}

export function softDeleteProduct(productId: string): void {
  updateProductRow(LEGACY_SOURCE, LEGACY_STORAGE_KEY, productId, {
    isArchived: true,
    deletedAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  });
}
