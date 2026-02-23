// ============================================================
// ELAHMED RETAIL OS — Product Repository
// Data access layer — persisted to localStorage
// ============================================================

import { Product } from '@/domain/types';

const STORAGE_KEY = 'elahmed-products';

/** Load products from localStorage */
function loadStore(): Product[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return JSON.parse(raw) as Product[];
  } catch (_e) { /* ignore corrupt data */ }
  return [];
}

/** Persist products to localStorage */
function persistStore(products: Product[]): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(products));
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
  const idx = productStore.findIndex(p => p.id === productId);
  if (idx >= 0) {
    productStore[idx] = {
      ...productStore[idx],
      quantity: newQuantity,
      updatedAt: new Date().toISOString(),
    };
    persistStore(productStore);
  }
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

