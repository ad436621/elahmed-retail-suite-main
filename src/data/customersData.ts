// ============================================================
// Customers Data Layer
// ============================================================

import { getStorageItem, setStorageItem } from '@/lib/localStorageHelper';
import { STORAGE_KEYS } from '@/config';

const KEY = STORAGE_KEYS.CUSTOMERS;

export interface Customer {
    id: string;
    name: string;
    phone?: string;
    address?: string;
    email?: string;
    notes?: string;
    createdAt: string;
}

function generateId(): string {
    return `cust_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
}

export function getCustomers(): Customer[] {
    return getStorageItem<Customer[]>(KEY, []);
}

export function saveCustomers(customers: Customer[]): void {
    setStorageItem(KEY, customers);
}

export function addCustomer(data: Omit<Customer, 'id' | 'createdAt'>): Customer {
    const customer: Customer = {
        ...data,
        id: generateId(),
        createdAt: new Date().toISOString(),
    };
    const all = getCustomers();
    saveCustomers([...all, customer]);
    return customer;
}

export function updateCustomer(id: string, data: Partial<Customer>): void {
    const all = getCustomers().map(c => c.id === id ? { ...c, ...data } : c);
    saveCustomers(all);
}

export function deleteCustomer(id: string): void {
    saveCustomers(getCustomers().filter(c => c.id !== id));
}

export function findCustomer(id: string): Customer | undefined {
    return getCustomers().find(c => c.id === id);
}
