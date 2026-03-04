// ============================================================
// Suppliers Data Layer
// ============================================================

import { getStorageItem, setStorageItem } from '@/lib/localStorageHelper';
import { STORAGE_KEYS } from '@/config';

const SUP_KEY = STORAGE_KEYS.SUPPLIERS;
const TXN_KEY = STORAGE_KEYS.SUPPLIER_TRANSACTIONS;



// ─── Types ──────────────────────────────────────────────────

export interface Supplier {
    id: string;
    name: string;
    phone?: string;
    address?: string;
    balance: number;        // amount owed TO supplier (positive = we owe them)
    notes?: string;
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

// ─── CRUD ────────────────────────────────────────────────────

export function getSuppliers(): Supplier[] {
    return getStorageItem<Supplier[]>(SUP_KEY, []);
}

export function saveSuppliers(suppliers: Supplier[]): void {
    setStorageItem(SUP_KEY, suppliers);
}

export function addSupplier(data: Omit<Supplier, 'id' | 'createdAt' | 'updatedAt'>): Supplier {
    const sup: Supplier = {
        ...data,
        id: crypto.randomUUID(),
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
    };
    saveSuppliers([...getSuppliers(), sup]);
    return sup;
}

export function updateSupplier(id: string, data: Partial<Supplier>): void {
    saveSuppliers(getSuppliers().map(s => s.id === id ? { ...s, ...data, updatedAt: new Date().toISOString() } : s));
}

export function deleteSupplier(id: string): void {
    saveSuppliers(getSuppliers().filter(s => s.id !== id));
}

// ─── Transactions ─────────────────────────────────────────────

export function getSupplierTransactions(supplierId?: string): SupplierTransaction[] {
    const all = getStorageItem<SupplierTransaction[]>(TXN_KEY, []);
    return supplierId ? all.filter(t => t.supplierId === supplierId) : all;
}

export function addSupplierTransaction(data: Omit<SupplierTransaction, 'id' | 'balanceBefore' | 'balanceAfter'>): SupplierTransaction {
    const all = getSuppliers();
    const sup = all.find(s => s.id === data.supplierId);
    if (!sup) throw new Error('Supplier not found');

    const balanceBefore = sup.balance;
    // purchase = we owe more, payment = we owe less, return = we owe less
    const delta = data.type === 'purchase' ? data.amount : -data.amount;
    const balanceAfter = balanceBefore + delta;

    updateSupplier(data.supplierId, { balance: balanceAfter });

    const txn: SupplierTransaction = {
        ...data,
        id: crypto.randomUUID(),
        balanceBefore,
        balanceAfter,
    };
    const txns = getStorageItem<SupplierTransaction[]>(TXN_KEY, []);
    setStorageItem(TXN_KEY, [...txns, txn]);
    return txn;
}

export function getTotalOwedToSuppliers(): number {
    return getSuppliers().reduce((sum, s) => sum + Math.max(0, s.balance), 0);
}
