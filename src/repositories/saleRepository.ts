// ============================================================
// ELAHMED RETAIL OS - Sale Repository
// Data access for sales with SQLite bridge in Electron
// ============================================================

import { Sale, SaleItem } from '@/domain/types';
import { STORAGE_KEYS } from '@/config';
import { getStorageItem, setStorageItem } from '@/lib/localStorageHelper';
import { callElectronSync, emitDataChange, hasElectronIpc, readElectronSync } from '@/lib/electronDataBridge';

const STORAGE_KEY = STORAGE_KEYS.SALES_LEGACY;

interface SaleItemRow {
  productId?: string;
  name?: string;
  qty?: number | null;
  price?: number | null;
  cost?: number | null;
  lineDiscount?: number | null;
  batches?: unknown;
  warehouseId?: string | null;
}

interface SaleRow {
  id?: string;
  invoiceNumber?: string;
  date?: string;
  items?: SaleItemRow[];
  subtotal?: number | null;
  discount?: number | null;
  total?: number | null;
  totalCost?: number | null;
  grossProfit?: number | null;
  marginPct?: number | null;
  paymentMethod?: string | null;
  employee?: string | null;
  voidedAt?: string | null;
  voidReason?: string | null;
  voidedBy?: string | null;
  status?: string | null;
}

let salesCache: Sale[] | null = null;

function toNumber(value: unknown): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function normalizeSaleItem(item: SaleItemRow): SaleItem {
  return {
    productId: String(item.productId ?? ''),
    name: String(item.name ?? ''),
    qty: Math.max(0, Math.round(toNumber(item.qty))),
    price: toNumber(item.price),
    cost: toNumber(item.cost),
    lineDiscount: toNumber(item.lineDiscount),
    batches: Array.isArray(item.batches) ? item.batches : undefined,
    warehouseId: item.warehouseId ? String(item.warehouseId) : undefined,
  };
}

function normalizeSale(row: SaleRow): Sale {
  return {
    id: String(row.id ?? crypto.randomUUID()),
    invoiceNumber: String(row.invoiceNumber ?? ''),
    date: String(row.date ?? new Date().toISOString()),
    items: Array.isArray(row.items) ? row.items.map(normalizeSaleItem) : [],
    subtotal: toNumber(row.subtotal),
    discount: toNumber(row.discount),
    total: toNumber(row.total),
    totalCost: toNumber(row.totalCost),
    grossProfit: toNumber(row.grossProfit),
    marginPct: toNumber(row.marginPct),
    paymentMethod: (row.paymentMethod ?? 'cash') as Sale['paymentMethod'],
    employee: String(row.employee ?? 'system'),
    status: (row.status as Sale['status']) ?? 'active',
    voidedAt: row.voidedAt ? String(row.voidedAt) : null,
    voidReason: row.voidReason ? String(row.voidReason) : null,
    voidedBy: row.voidedBy ? String(row.voidedBy) : null,
  };
}

function sortSales(items: Sale[]): Sale[] {
  return [...items].sort((left, right) => right.date.localeCompare(left.date) || right.invoiceNumber.localeCompare(left.invoiceNumber));
}

function setSalesState(sales: Sale[]): void {
  salesCache = sortSales(sales.map(normalizeSale));
}

function loadSales(): Sale[] {
  return sortSales(getStorageItem<Sale[]>(STORAGE_KEY, []).map(normalizeSale));
}

function persistSales(sales: Sale[]): void {
  setStorageItem(STORAGE_KEY, sales);
}

function refreshElectronSales(activeOnly = false): Sale[] {
  const rows = readElectronSync<SaleRow[]>('db-sync:sales:get', [], activeOnly);
  const normalized = sortSales(rows.map(normalizeSale));
  if (!activeOnly) {
    salesCache = normalized;
  }
  return normalized;
}

export function getAllSales(): Sale[] {
  if (hasElectronIpc()) {
    if (salesCache) return salesCache;
    return refreshElectronSales(false);
  }

  const sales = loadSales();
  setSalesState(sales);
  return salesCache ?? [];
}

export function getSaleById(id: string): Sale | undefined {
  return getAllSales().find((sale) => sale.id === id);
}

export function saveSale(sale: Sale): void {
  const normalized = normalizeSale(sale);

  if (hasElectronIpc()) {
    callElectronSync('db-sync:sales:upsert', normalized);
    refreshElectronSales(false);
    emitDataChange(STORAGE_KEY);
    return;
  }

  const sales = loadSales();
  const index = sales.findIndex((item) => item.id === normalized.id);
  if (index >= 0) {
    sales[index] = normalized;
  } else {
    sales.push(normalized);
  }
  persistSales(sales);
  setSalesState(sales);
  emitDataChange(STORAGE_KEY);
}

export function getSalesByDateRange(start: string, end: string): Sale[] {
  return getAllSales().filter((sale) => sale.date >= start && sale.date <= end);
}

export function getActiveSales(): Sale[] {
  if (hasElectronIpc()) {
    return refreshElectronSales(true);
  }

  return getAllSales().filter((sale) => !sale.voidedAt && sale.status !== 'deleted');
}
