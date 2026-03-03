// ============================================================
// ELAHMED RETAIL OS — Sale Repository
// Data access for sales (localStorage-backed)
// ============================================================

import { Sale } from '@/domain/types';
import { STORAGE_KEYS } from '@/config';
import { getStorageItem, setStorageItem } from '@/lib/localStorageHelper';

const STORAGE_KEY = STORAGE_KEYS.SALES_LEGACY;

function loadSales(): Sale[] {
  return getStorageItem<Sale[]>(STORAGE_KEY, []);
}

function persistSales(sales: Sale[]): void {
  setStorageItem(STORAGE_KEY, sales);
}

export function getAllSales(): Sale[] {
  return loadSales();
}

export function getSaleById(id: string): Sale | undefined {
  return loadSales().find(s => s.id === id);
}

export function saveSale(sale: Sale): void {
  const sales = loadSales();
  const idx = sales.findIndex(s => s.id === sale.id);
  if (idx >= 0) {
    sales[idx] = sale;
  } else {
    sales.push(sale);
  }
  persistSales(sales);
}

export function getSalesByDateRange(start: string, end: string): Sale[] {
  return loadSales().filter(s => s.date >= start && s.date <= end);
}

export function getActiveSales(): Sale[] {
  return loadSales().filter(s => s.voidedAt === null);
}
