// ============================================================
// Purchase Invoices Data Layer
// ============================================================

import { STORAGE_KEYS } from '@/config';
import { getStorageItem, setStorageItem } from '@/lib/localStorageHelper';
import { callElectronSync, emitDataChange, hasElectronIpc, readElectronSync } from '@/lib/electronDataBridge';

const KEY = STORAGE_KEYS.PURCHASE_INVOICES;

export interface PurchaseInvoiceItem {
  id: string;
  productName: string;
  category?: string;
  quantity: number;
  unitPrice: number;
  totalPrice: number;
  notes?: string;
}

export type InvoiceStatus = 'draft' | 'confirmed' | 'partial' | 'paid';
export type PaymentMethod = 'cash' | 'card' | 'wallet' | 'bank' | 'credit';

export interface PurchaseInvoice {
  id: string;
  invoiceNumber: string;
  supplierId?: string;
  supplierName: string;
  invoiceDate: string;
  totalAmount: number;
  paidAmount: number;
  remaining: number;
  paymentMethod: PaymentMethod;
  items: PurchaseInvoiceItem[];
  status: InvoiceStatus;
  notes?: string;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

interface PurchaseInvoiceItemRow {
  id?: string;
  productName?: string;
  category?: string | null;
  quantity?: number | null;
  unitPrice?: number | null;
  totalPrice?: number | null;
  notes?: string | null;
}

interface PurchaseInvoiceRow {
  id?: string;
  invoiceNumber?: string;
  supplierId?: string | null;
  supplierName?: string;
  invoiceDate?: string;
  totalAmount?: number | null;
  paidAmount?: number | null;
  remaining?: number | null;
  paymentMethod?: PaymentMethod | null;
  items?: PurchaseInvoiceItemRow[];
  status?: InvoiceStatus | null;
  notes?: string | null;
  createdBy?: string | null;
  createdAt?: string | null;
  updatedAt?: string | null;
}

let invoicesCache: PurchaseInvoice[] | null = null;

function toNumber(value: unknown): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function deriveStatus(totalAmount: number, paidAmount: number): InvoiceStatus {
  if (paidAmount <= 0) return 'confirmed';
  if (paidAmount >= totalAmount) return 'paid';
  return 'partial';
}

function sortInvoices(invoices: PurchaseInvoice[]): PurchaseInvoice[] {
  return [...invoices].sort(
    (left, right) => right.invoiceDate.localeCompare(left.invoiceDate) || right.invoiceNumber.localeCompare(left.invoiceNumber),
  );
}

function normalizeItem(row: PurchaseInvoiceItemRow): PurchaseInvoiceItem {
  return {
    id: String(row.id ?? crypto.randomUUID()),
    productName: String(row.productName ?? '').trim(),
    category: row.category ? String(row.category) : undefined,
    quantity: Math.max(0, toNumber(row.quantity)),
    unitPrice: toNumber(row.unitPrice),
    totalPrice: toNumber(row.totalPrice),
    notes: row.notes ? String(row.notes) : undefined,
  };
}

function normalizeInvoice(row: PurchaseInvoiceRow): PurchaseInvoice {
  const totalAmount = toNumber(row.totalAmount);
  const paidAmount = Math.min(totalAmount, toNumber(row.paidAmount));
  return {
    id: String(row.id ?? crypto.randomUUID()),
    invoiceNumber: String(row.invoiceNumber ?? ''),
    supplierId: row.supplierId ? String(row.supplierId) : undefined,
    supplierName: String(row.supplierName ?? '').trim(),
    invoiceDate: String(row.invoiceDate ?? new Date().toISOString().slice(0, 10)),
    totalAmount,
    paidAmount,
    remaining: Math.max(0, toNumber(row.remaining) || (totalAmount - paidAmount)),
    paymentMethod: (row.paymentMethod ?? 'cash') as PaymentMethod,
    items: Array.isArray(row.items) ? row.items.map(normalizeItem) : [],
    status: (row.status ?? deriveStatus(totalAmount, paidAmount)) as InvoiceStatus,
    notes: row.notes ? String(row.notes) : undefined,
    createdBy: String(row.createdBy ?? 'system'),
    createdAt: String(row.createdAt ?? new Date().toISOString()),
    updatedAt: String(row.updatedAt ?? row.createdAt ?? new Date().toISOString()),
  };
}

function setInvoicesState(invoices: PurchaseInvoice[]): void {
  invoicesCache = sortInvoices(invoices.map(normalizeInvoice));
}

function loadLocalInvoices(): PurchaseInvoice[] {
  const saved = getStorageItem<PurchaseInvoice[]>(KEY, []);
  return sortInvoices((Array.isArray(saved) ? saved : []).map(normalizeInvoice));
}

function refreshElectronInvoices(): PurchaseInvoice[] {
  const rows = readElectronSync<PurchaseInvoiceRow[]>('db-sync:purchase_invoices:get', []);
  const rowsArray = Array.isArray(rows) ? rows : [];
  setInvoicesState(rowsArray.map(normalizeInvoice));
  return invoicesCache ?? [];
}

export function getPurchaseInvoices(): PurchaseInvoice[] {
  if (hasElectronIpc()) {
    if (invoicesCache) return invoicesCache;
    return refreshElectronInvoices();
  }

  const invoices = loadLocalInvoices();
  setInvoicesState(invoices);
  return invoicesCache ?? [];
}

function saveInvoices(invoices: PurchaseInvoice[]): void {
  const normalized = sortInvoices(invoices.map(normalizeInvoice));
  setStorageItem(KEY, normalized);
  setInvoicesState(normalized);
  emitDataChange(KEY);
}

function getNextInvoiceNumber(invoices: PurchaseInvoice[]): string {
  const maxSequence = invoices.reduce((max, invoice) => {
    const match = /^PI-(\d+)$/.exec(invoice.invoiceNumber);
    const sequence = match ? Number.parseInt(match[1], 10) : 0;
    return Number.isFinite(sequence) ? Math.max(max, sequence) : max;
  }, 0);

  return `PI-${String(maxSequence + 1).padStart(4, '0')}`;
}

export function addPurchaseInvoice(
  data: Omit<PurchaseInvoice, 'id' | 'invoiceNumber' | 'remaining' | 'status' | 'createdAt' | 'updatedAt'>,
): PurchaseInvoice {
  if (hasElectronIpc()) {
    const saved = callElectronSync<PurchaseInvoiceRow>('db-sync:purchase_invoices:add', data);
    const invoice = normalizeInvoice(saved ?? {
      ...data,
      id: crypto.randomUUID(),
      invoiceNumber: '',
      remaining: Math.max(0, data.totalAmount - data.paidAmount),
      status: deriveStatus(data.totalAmount, data.paidAmount),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });
    const invoices = refreshElectronInvoices();
    emitDataChange(KEY);
    return invoices.find((item) => item.id === invoice.id) ?? invoice;
  }

  const all = getPurchaseInvoices();
  const invoiceNumber = getNextInvoiceNumber(all);
  const remaining = data.totalAmount - data.paidAmount;
  const status = deriveStatus(data.totalAmount, data.paidAmount);
  const invoice = normalizeInvoice({
    ...data,
    id: crypto.randomUUID(),
    invoiceNumber,
    remaining,
    status,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  });
  saveInvoices([...all, invoice]);
  return invoice;
}

export function updatePurchaseInvoice(id: string, data: Partial<PurchaseInvoice>): void {
  if (hasElectronIpc()) {
    callElectronSync('db-sync:purchase_invoices:update', id, data);
    refreshElectronInvoices();
    emitDataChange(KEY);
    return;
  }

  saveInvoices(getPurchaseInvoices().map((invoice) => {
    if (invoice.id !== id) return invoice;
    const updated = normalizeInvoice({ ...invoice, ...data, updatedAt: new Date().toISOString() });
    updated.remaining = updated.totalAmount - updated.paidAmount;
    updated.status = deriveStatus(updated.totalAmount, updated.paidAmount);
    return updated;
  }));
}

export function applyPayment(id: string, amount: number): void {
  if (hasElectronIpc()) {
    callElectronSync('db-sync:purchase_invoices:applyPayment', id, amount);
    refreshElectronInvoices();
    emitDataChange(KEY);
    return;
  }

  const invoice = getPurchaseInvoices().find((item) => item.id === id);
  if (!invoice) return;
  updatePurchaseInvoice(id, { paidAmount: Math.min(invoice.paidAmount + amount, invoice.totalAmount) });
}

export function deletePurchaseInvoice(id: string): void {
  if (hasElectronIpc()) {
    callElectronSync('db-sync:purchase_invoices:delete', id);
    refreshElectronInvoices();
    emitDataChange(KEY);
    return;
  }

  saveInvoices(getPurchaseInvoices().filter((invoice) => invoice.id !== id));
}

export function getTotalUnpaid(): number {
  return getPurchaseInvoices()
    .filter((invoice) => invoice.status !== 'paid')
    .reduce((sum, invoice) => sum + invoice.remaining, 0);
}

export function getInvoicesBySupplier(supplierId: string): PurchaseInvoice[] {
  return getPurchaseInvoices().filter((invoice) => invoice.supplierId === supplierId);
}
