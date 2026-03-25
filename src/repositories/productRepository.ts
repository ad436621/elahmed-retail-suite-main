// ============================================================
// GLEAMEX RETAIL SUITE - Product Repository
// Data access layer - persisted to localStorage
// ============================================================

import {
  Product,
  ProductSource,
  ProductCondition,
  MobileItem,
  MobileAccessory,
  MobileSparePart,
  DeviceItem,
  DeviceAccessory,
  ComputerItem,
  ComputerAccessory,
  CarItem,
} from '@/domain/types';
import {
  getMobiles,
  getMobileAccessories,
  getMobileSpareParts,
  updateMobile,
  updateMobileAccessory,
  updateMobileSparePart,
} from '@/data/mobilesData';
import {
  getComputers,
  getComputerAccessories,
  updateComputer,
  updateComputerAccessory,
} from '@/data/computersData';
import {
  getDevices,
  getDeviceAccessories,
  updateDevice,
  updateDeviceAccessory,
} from '@/data/devicesData';
import {
  computerAccessoriesDB,
  computerSparePartsDB,
  deviceAccessoriesDB,
  deviceSparePartsDB,
} from '@/data/subInventoryData';
import { getCars } from '@/data/carsData';
import { STORAGE_KEYS } from '@/config';
import { getStorageItem, setStorageItem } from '@/lib/localStorageHelper';

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

const STORAGE_KEY = STORAGE_KEYS.PRODUCTS;

function loadStore(): Product[] {
  return getStorageItem<Product[]>(STORAGE_KEY, []);
}

function persistStore(products: Product[]): void {
  setStorageItem(STORAGE_KEY, products);
}

export function generateUniqueBarcode(): string {
  const timestamp = Date.now().toString(36).toUpperCase();
  const random = Math.random().toString(36).substring(2, 6).toUpperCase();
  return `AUTO-${timestamp}-${random}`;
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
  if ('oldCostPrice' in item) {
    const oldCost = item.oldCostPrice;
    if (oldCost && oldCost > 0) return oldCost;
  }

  if ('newCostPrice' in item) {
    return item.newCostPrice || 0;
  }

  if ('costPrice' in item) {
    return item.costPrice || 0;
  }

  return 0;
}

function getSellingPrice(item: InventoryItem): number {
  if ('salePrice' in item) return item.salePrice || 0;
  if ('sellingPrice' in item) return item.sellingPrice || 0;
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
  const mainProducts = productStore.filter((product) => product.deletedAt === null);

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
  ];
}

const productStore: Product[] = loadStore();

export function getAllProducts(): Product[] {
  return productStore.filter((product) => product.deletedAt === null);
}

export function getProductById(id: string): Product | undefined {
  return productStore.find((product) => product.id === id && product.deletedAt === null);
}

export function getProductByBarcode(barcode: string): Product | undefined {
  return productStore.find((product) => product.barcode === barcode && product.deletedAt === null);
}

export function saveProduct(product: Product): void {
  const index = productStore.findIndex((item) => item.id === product.id);
  if (index >= 0) {
    productStore[index] = product;
  } else {
    productStore.push(product);
  }

  persistStore(productStore);
}

export function updateProductQuantity(productId: string, newQuantity: number): void {
  const storeIndex = productStore.findIndex((product) => product.id === productId);
  if (storeIndex >= 0) {
    productStore[storeIndex] = {
      ...productStore[storeIndex],
      quantity: newQuantity,
      updatedAt: new Date().toISOString(),
    };
    persistStore(productStore);
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
  }
}

export function softDeleteProduct(productId: string): void {
  const index = productStore.findIndex((product) => product.id === productId);
  if (index >= 0) {
    productStore[index] = {
      ...productStore[index],
      deletedAt: new Date().toISOString(),
    };
    persistStore(productStore);
  }
}
