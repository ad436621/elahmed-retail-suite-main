// ============================================================
// Suppliers Data Layer
// ============================================================

import { STORAGE_KEYS } from '@/config';
import { getStorageItem, setStorageItem } from '@/lib/localStorageHelper';
import { callElectronSync, emitDataChange, hasElectronIpc, readElectronSync } from '@/lib/electronDataBridge';

const SUP_KEY = STORAGE_KEYS.SUPPLIERS;
const TXN_KEY = STORAGE_KEYS.SUPPLIER_TRANSACTIONS;

export interface Supplier {
  id: string;
  name: string;
  phone?: string;
  address?: string;
  balance: number;
  notes?: string;
  isArchived?: boolean;
  deletedAt?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface SupplierTransaction {
  id: string;
  supplierId: string;
  supplierName: string;
  type: 'purchase' | 'payment' | 'return';
  amount: number;
  balanceBefore: number;
  balanceAfter: number;
  notes?: string;
  createdBy: string;
  createdAt: string;
}

interface SupplierRow {
  id: string;
  name: string;
  phone?: string | null;
  address?: string | null;
  balance?: number | null;
  notes?: string | null;
  isArchived?: number | boolean | null;
  deletedAt?: string | null;
  createdAt?: string | null;
  updatedAt?: string | null;
}

interface SupplierTransactionRow {
  id: string;
  supplierId: string;
  supplierName?: string | null;
  type: SupplierTransaction['type'];
  amount?: number | null;
  balanceBefore?: number | null;
  balanceAfter?: number | null;
  notes?: string | null;
  createdBy?: string | null;
  createdAt?: string | null;
}

let suppliersCache: Supplier[] | null = null;
let supplierTransactionsCache: SupplierTransaction[] | null = null;

function toNumber(value: unknown): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function sortSuppliers(items: Supplier[]): Supplier[] {
  return [...items].sort((left, right) => left.name.localeCompare(right.name, 'ar'));
}

function sortSupplierTransactions(items: SupplierTransaction[]): SupplierTransaction[] {
  return [...items].sort(
    (left, right) => right.createdAt.localeCompare(left.createdAt) || right.id.localeCompare(left.id),
  );
}

function normalizeSupplier(row: Partial<SupplierRow>): Supplier {
  const createdAt = String(row.createdAt ?? new Date().toISOString());
  return {
    id: String(row.id ?? crypto.randomUUID()),
    name: String(row.name ?? '').trim(),
    phone: row.phone ? String(row.phone) : undefined,
    address: row.address ? String(row.address) : undefined,
    balance: toNumber(row.balance),
    notes: row.notes ? String(row.notes) : undefined,
    isArchived: Boolean(row.isArchived),
    deletedAt: row.deletedAt ? String(row.deletedAt) : null,
    createdAt,
    updatedAt: String(row.updatedAt ?? createdAt),
  };
}

function normalizeSupplierTransaction(row: Partial<SupplierTransactionRow>): SupplierTransaction {
  return {
    id: String(row.id ?? crypto.randomUUID()),
    supplierId: String(row.supplierId ?? ''),
    supplierName: String(row.supplierName ?? ''),
    type: (row.type ?? 'payment') as SupplierTransaction['type'],
    amount: toNumber(row.amount),
    balanceBefore: toNumber(row.balanceBefore),
    balanceAfter: toNumber(row.balanceAfter),
    notes: row.notes ? String(row.notes) : undefined,
    createdBy: String(row.createdBy ?? 'system'),
    createdAt: String(row.createdAt ?? new Date().toISOString()),
  };
}

function toSupplierRow(supplier: Supplier): SupplierRow {
  return {
    id: supplier.id,
    name: supplier.name,
    phone: supplier.phone ?? null,
    address: supplier.address ?? null,
    balance: supplier.balance,
    notes: supplier.notes ?? null,
    isArchived: supplier.isArchived ?? false,
    deletedAt: supplier.deletedAt ?? null,
    createdAt: supplier.createdAt,
    updatedAt: supplier.updatedAt,
  };
}

function setSuppliersState(suppliers: Supplier[]): void {
  suppliersCache = sortSuppliers(suppliers.map(normalizeSupplier));
}

function setSupplierTransactionsState(transactions: SupplierTransaction[]): void {
  supplierTransactionsCache = sortSupplierTransactions(transactions.map(normalizeSupplierTransaction));
}

function loadLocalSuppliers(): Supplier[] {
  const saved = getStorageItem<Supplier[]>(SUP_KEY, []);
  return sortSuppliers((Array.isArray(saved) ? saved : []).map(normalizeSupplier));
}

function loadLocalSupplierTransactions(): SupplierTransaction[] {
  const saved = getStorageItem<SupplierTransaction[]>(TXN_KEY, []);
  return sortSupplierTransactions(
    (Array.isArray(saved) ? saved : []).map(normalizeSupplierTransaction),
  );
}

function refreshElectronSuppliers(): Supplier[] {
  const rows = readElectronSync<SupplierRow[]>('db-sync:suppliers:get', []);
  const rowsArray = Array.isArray(rows) ? rows : [];
  setSuppliersState(rowsArray.map(normalizeSupplier));
  return suppliersCache ?? [];
}

function refreshElectronSupplierTransactions(): SupplierTransaction[] {
  const rows = readElectronSync<SupplierTransactionRow[]>('db-sync:supplier_transactions:get', []);
  const rowsArray = Array.isArray(rows) ? rows : [];
  setSupplierTransactionsState(rowsArray.map(normalizeSupplierTransaction));
  return supplierTransactionsCache ?? [];
}

function persistElectronSuppliers(suppliers: Supplier[]): void {
  const current = new Map(getSuppliers().map((supplier) => [supplier.id, supplier]));
  const nextIds = new Set(suppliers.map((supplier) => supplier.id));

  for (const supplier of suppliers) {
    const payload = toSupplierRow(supplier);
    if (current.has(supplier.id)) {
      callElectronSync('db-sync:suppliers:update', supplier.id, payload);
    } else {
      callElectronSync('db-sync:suppliers:add', payload);
    }
  }

  for (const id of current.keys()) {
    if (!nextIds.has(id)) {
      callElectronSync('db-sync:suppliers:delete', id);
    }
  }
}

export function getSuppliers(): Supplier[] {
  const all = suppliersCache ?? (hasElectronIpc() ? refreshElectronSuppliers() : (setSuppliersState(loadLocalSuppliers()), suppliersCache ?? []));
  return all.filter((supplier) => !supplier.isArchived && !supplier.deletedAt);
}

export function saveSuppliers(suppliers: Supplier[]): void {
  const normalized = sortSuppliers(suppliers.map(normalizeSupplier));

  if (hasElectronIpc()) {
    persistElectronSuppliers(normalized);
    setSuppliersState(normalized);
    emitDataChange(SUP_KEY);
    return;
  }

  setStorageItem(SUP_KEY, normalized);
  setSuppliersState(normalized);
  emitDataChange(SUP_KEY);
}

export function addSupplier(data: Omit<Supplier, 'id' | 'createdAt' | 'updatedAt'>): Supplier {
  const supplier = normalizeSupplier({
    ...data,
    id: crypto.randomUUID(),
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  });

  if (hasElectronIpc()) {
    const saved = callElectronSync<SupplierRow>('db-sync:suppliers:add', toSupplierRow(supplier));
    const next = normalizeSupplier(saved ?? supplier);
    const suppliers = refreshElectronSuppliers();
    emitDataChange(SUP_KEY);
    return suppliers.find((item) => item.id === next.id) ?? next;
  }

  saveSuppliers([...getSuppliers(), supplier]);
  return supplier;
}

export function updateSupplier(id: string, data: Partial<Supplier>): void {
  if (hasElectronIpc()) {
    const current = getSuppliers().find((supplier) => supplier.id === id);
    const next = normalizeSupplier({ ...(current ?? { id, name: '' }), ...data });
    callElectronSync('db-sync:suppliers:update', id, toSupplierRow(next));
    setSuppliersState(getSuppliers().map((supplier) => (supplier.id === id ? next : supplier)));
    emitDataChange(SUP_KEY);
    return;
  }

  saveSuppliers(getSuppliers().map((supplier) => (
    supplier.id === id
      ? normalizeSupplier({ ...supplier, ...data, updatedAt: new Date().toISOString() })
      : supplier
  )));
}

export function deleteSupplier(id: string): void {
  updateSupplier(id, {
    isArchived: true,
    deletedAt: new Date().toISOString(),
  });
}

export function getSupplierTransactions(supplierId?: string): SupplierTransaction[] {
  const transactions = supplierTransactionsCache
    ?? (hasElectronIpc()
      ? refreshElectronSupplierTransactions()
      : (setSupplierTransactionsState(loadLocalSupplierTransactions()), supplierTransactionsCache ?? []));

  return supplierId ? transactions.filter((transaction) => transaction.supplierId === supplierId) : transactions;
}

export function addSupplierTransaction(
  data: Omit<SupplierTransaction, 'id' | 'balanceBefore' | 'balanceAfter'>,
): SupplierTransaction {
  if (hasElectronIpc()) {
    const saved = callElectronSync<SupplierTransactionRow>('db-sync:supplier_transactions:add', {
      supplierId: data.supplierId,
      supplierName: data.supplierName,
      type: data.type,
      amount: data.amount,
      notes: data.notes ?? null,
      createdBy: data.createdBy,
      createdAt: data.createdAt,
    });

    const transaction = normalizeSupplierTransaction(saved ?? {
      ...data,
      id: crypto.randomUUID(),
      balanceBefore: 0,
      balanceAfter: 0,
    });

    refreshElectronSuppliers();
    const transactions = refreshElectronSupplierTransactions();
    emitDataChange(SUP_KEY);
    emitDataChange(TXN_KEY);
    return transactions.find((item) => item.id === transaction.id) ?? transaction;
  }

  const suppliers = getSuppliers();
  const supplier = suppliers.find((item) => item.id === data.supplierId);
  if (!supplier) throw new Error('Supplier not found');

  const balanceBefore = supplier.balance;
  const delta = data.type === 'purchase' ? data.amount : -data.amount;
  const balanceAfter = balanceBefore + delta;

  saveSuppliers(suppliers.map((item) => (
    item.id === data.supplierId
      ? normalizeSupplier({ ...item, balance: balanceAfter, updatedAt: new Date().toISOString() })
      : item
  )));

  const transaction = normalizeSupplierTransaction({
    ...data,
    id: crypto.randomUUID(),
    balanceBefore,
    balanceAfter,
  });
  const nextTransactions = [...getSupplierTransactions(), transaction];
  setStorageItem(TXN_KEY, nextTransactions);
  setSupplierTransactionsState(nextTransactions);
  emitDataChange(TXN_KEY);
  return transaction;
}

export function getTotalOwedToSuppliers(): number {
  return getSuppliers().reduce((sum, supplier) => sum + Math.max(0, supplier.balance), 0);
}
