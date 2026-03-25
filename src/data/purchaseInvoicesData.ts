// ============================================================
// Purchase Invoices Data Layer
// ============================================================

import { getStorageItem, setStorageItem } from '@/lib/localStorageHelper';
import { STORAGE_KEYS } from '@/config';

const KEY = STORAGE_KEYS.PURCHASE_INVOICES;



// ─── Types ──────────────────────────────────────────────────

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

// ─── CRUD ────────────────────────────────────────────────────

export function getPurchaseInvoices(): PurchaseInvoice[] {
    return getStorageItem<PurchaseInvoice[]>(KEY, []);
}

function saveInvoices(invoices: PurchaseInvoice[]): void {
    setStorageItem(KEY, invoices);
}

function deriveStatus(totalAmount: number, paidAmount: number): InvoiceStatus {
    if (paidAmount <= 0) return 'confirmed';
    if (paidAmount >= totalAmount) return 'paid';
    return 'partial';
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
    data: Omit<PurchaseInvoice, 'id' | 'invoiceNumber' | 'remaining' | 'status' | 'createdAt' | 'updatedAt'>
): PurchaseInvoice {
    const all = getPurchaseInvoices();
    const invoiceNumber = getNextInvoiceNumber(all);
    const remaining = data.totalAmount - data.paidAmount;
    const status = deriveStatus(data.totalAmount, data.paidAmount);
    const invoice: PurchaseInvoice = {
        ...data,
        id: crypto.randomUUID(),
        invoiceNumber,
        remaining,
        status,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
    };
    saveInvoices([...all, invoice]);
    return invoice;
}

export function updatePurchaseInvoice(id: string, data: Partial<PurchaseInvoice>): void {
    saveInvoices(getPurchaseInvoices().map(inv => {
        if (inv.id !== id) return inv;
        const updated = { ...inv, ...data, updatedAt: new Date().toISOString() };
        updated.remaining = updated.totalAmount - updated.paidAmount;
        updated.status = deriveStatus(updated.totalAmount, updated.paidAmount);
        return updated;
    }));
}

export function applyPayment(id: string, amount: number): void {
    const inv = getPurchaseInvoices().find(i => i.id === id);
    if (!inv) return;
    updatePurchaseInvoice(id, { paidAmount: Math.min(inv.paidAmount + amount, inv.totalAmount) });
}

export function deletePurchaseInvoice(id: string): void {
    saveInvoices(getPurchaseInvoices().filter(i => i.id !== id));
}

export function getTotalUnpaid(): number {
    return getPurchaseInvoices()
        .filter(i => i.status !== 'paid')
        .reduce((sum, i) => sum + i.remaining, 0);
}

export function getInvoicesBySupplier(supplierId: string): PurchaseInvoice[] {
    return getPurchaseInvoices().filter(i => i.supplierId === supplierId);
}
