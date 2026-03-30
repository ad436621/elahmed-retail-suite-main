// ============================================================
// Customers Data Layer
// ============================================================

import { STORAGE_KEYS } from '@/config';
import { getStorageItem, setStorageItem } from '@/lib/localStorageHelper';
import { callElectronSync, emitDataChange, hasElectronIpc, readElectronSync } from '@/lib/electronDataBridge';

const KEY = STORAGE_KEYS.CUSTOMERS;

export interface Customer {
  id: string;
  name: string;
  phone?: string;
  address?: string;
  email?: string;
  notes?: string;
  isArchived?: boolean;
  deletedAt?: string | null;
  createdAt: string;
}

interface CustomerRow {
  id: string;
  name: string;
  phone?: string | null;
  address?: string | null;
  email?: string | null;
  notes?: string | null;
  isArchived?: number | boolean | null;
  deletedAt?: string | null;
  createdAt?: string | null;
}

import { generateId as genId } from '@/lib/idGenerator';

function generateId(): string {
  return genId('cust');
}

function normalizeCustomer(row: Partial<CustomerRow>): Customer {
  const createdAt = row.createdAt || new Date().toISOString();
  return {
    id: String(row.id ?? generateId()),
    name: String(row.name ?? '').trim(),
    phone: row.phone ? String(row.phone) : undefined,
    address: row.address ? String(row.address) : undefined,
    email: row.email ? String(row.email) : undefined,
    notes: row.notes ? String(row.notes) : undefined,
    isArchived: Boolean(row.isArchived),
    deletedAt: row.deletedAt ? String(row.deletedAt) : null,
    createdAt,
  };
}

function toCustomerRow(customer: Customer): CustomerRow {
  return {
    id: customer.id,
    name: customer.name,
    phone: customer.phone ?? null,
    address: customer.address ?? null,
    email: customer.email ?? null,
    notes: customer.notes ?? null,
    isArchived: customer.isArchived ?? false,
    deletedAt: customer.deletedAt ?? null,
    createdAt: customer.createdAt,
  };
}

function loadLocalCustomers(): Customer[] {
  const saved = getStorageItem<Customer[]>(KEY, []);
  return (Array.isArray(saved) ? saved : []).map(normalizeCustomer);
}

function persistElectronCustomers(customers: Customer[]): void {
  const existing = new Map(getCustomers().map((customer) => [customer.id, customer]));
  const nextIds = new Set(customers.map((customer) => customer.id));

  for (const customer of customers.map(normalizeCustomer)) {
    const payload = toCustomerRow(customer);
    if (existing.has(customer.id)) {
      callElectronSync('db-sync:customers:update', customer.id, payload);
    } else {
      callElectronSync('db-sync:customers:add', payload);
    }
  }

  for (const id of existing.keys()) {
    if (!nextIds.has(id)) {
      callElectronSync('db-sync:customers:delete', id);
    }
  }

  emitDataChange(KEY);
}

export function getCustomers(): Customer[] {
  if (hasElectronIpc()) {
    const rows = readElectronSync<CustomerRow[]>('db-sync:customers:get', []);
    return rows.map(normalizeCustomer).filter((c) => !c.isArchived && !c.deletedAt);
  }

  return loadLocalCustomers().filter((c) => !c.isArchived && !c.deletedAt);
}

export function saveCustomers(customers: Customer[]): void {
  const normalized = customers.map(normalizeCustomer);

  if (hasElectronIpc()) {
    persistElectronCustomers(normalized);
    return;
  }

  setStorageItem(KEY, normalized);
}

export function addCustomer(data: Omit<Customer, 'id' | 'createdAt'>): Customer {
  const customer: Customer = normalizeCustomer({
    ...data,
    id: generateId(),
    createdAt: new Date().toISOString(),
  });

  if (hasElectronIpc()) {
    const saved = callElectronSync<CustomerRow>('db-sync:customers:add', toCustomerRow(customer));
    emitDataChange(KEY);
    return normalizeCustomer(saved ?? customer);
  }

  saveCustomers([...loadLocalCustomers(), customer]);
  return customer;
}

export function updateCustomer(id: string, data: Partial<Customer>): void {
  if (hasElectronIpc()) {
    callElectronSync('db-sync:customers:update', id, {
      name: data.name,
      phone: data.phone ?? null,
      address: data.address ?? null,
      email: data.email ?? null,
      notes: data.notes ?? null,
    });
    emitDataChange(KEY);
    return;
  }

  const all = loadLocalCustomers().map((customer) => (customer.id === id ? normalizeCustomer({ ...customer, ...data }) : customer));
  setStorageItem(KEY, all);
}

export function deleteCustomer(id: string): void {
  if (hasElectronIpc()) {
    const current = getCustomers().find((customer) => customer.id === id);
    if (!current) return;
    callElectronSync('db-sync:customers:update', id, toCustomerRow({
      ...current,
      isArchived: true,
      deletedAt: new Date().toISOString(),
    }));
    emitDataChange(KEY);
    return;
  }

  const all = loadLocalCustomers().map((customer) =>
    customer.id === id
      ? normalizeCustomer({ ...customer, isArchived: true, deletedAt: new Date().toISOString() })
      : customer
  );
  setStorageItem(KEY, all);
  emitDataChange(KEY);
}

export function findCustomer(id: string): Customer | undefined {
  return getCustomers().find((customer) => customer.id === id);
}
