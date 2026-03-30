// ============================================================
// Other Revenue - Data Layer
// ============================================================

import { OtherRevenue } from '@/domain/types';
import { STORAGE_KEYS } from '@/config';
import { getStorageItem, setStorageItem } from '@/lib/localStorageHelper';
import { callElectronSync, emitDataChange, hasElectronIpc, readElectronSync } from '@/lib/electronDataBridge';

const KEY = STORAGE_KEYS.OTHER_REVENUE;

interface OtherRevenueRow {
  id: string;
  date: string;
  description?: string | null;
  amount: number;
  source?: string | null;
  addedBy?: string | null;
  createdAt?: string | null;
}

function normalizeOtherRevenue(row: Partial<OtherRevenueRow>): OtherRevenue {
  return {
    id: String(row.id ?? crypto.randomUUID()),
    date: String(row.date ?? new Date().toISOString().slice(0, 10)),
    description: String(row.description ?? ''),
    amount: Number(row.amount ?? 0),
    category: String(row.source ?? ''),
    addedBy: row.addedBy ? String(row.addedBy) : '',
    createdAt: String(row.createdAt ?? new Date().toISOString()),
  };
}

function toOtherRevenueRow(item: OtherRevenue): OtherRevenueRow {
  return {
    id: item.id,
    date: item.date,
    description: item.description,
    amount: item.amount,
    source: item.category,
    addedBy: item.addedBy || null,
    createdAt: item.createdAt,
  };
}

function loadLocalOtherRevenue(): OtherRevenue[] {
  const saved = getStorageItem<OtherRevenue[]>(KEY, []);
  return (Array.isArray(saved) ? saved : []).map(normalizeOtherRevenue);
}

function persistElectronOtherRevenue(items: OtherRevenue[]): void {
  const existing = new Map(getOtherRevenues().map((item) => [item.id, item]));
  const nextIds = new Set(items.map((item) => item.id));

  for (const item of items.map(normalizeOtherRevenue)) {
    const payload = toOtherRevenueRow(item);
    if (existing.has(item.id)) {
      callElectronSync('db-sync:other_revenue:update', item.id, payload);
    } else {
      callElectronSync('db-sync:other_revenue:add', payload);
    }
  }

  for (const id of existing.keys()) {
    if (!nextIds.has(id)) {
      callElectronSync('db-sync:other_revenue:delete', id);
    }
  }

  emitDataChange(KEY);
}

export function getOtherRevenues(): OtherRevenue[] {
  if (hasElectronIpc()) {
    const rows = readElectronSync<OtherRevenueRow[]>('db-sync:other_revenue:get', []);
    return rows.map(normalizeOtherRevenue);
  }

  return loadLocalOtherRevenue();
}

export function saveOtherRevenues(items: OtherRevenue[]): void {
  const normalized = items.map(normalizeOtherRevenue);

  if (hasElectronIpc()) {
    persistElectronOtherRevenue(normalized);
    return;
  }

  setStorageItem(KEY, normalized);
}

export function addOtherRevenue(item: Omit<OtherRevenue, 'id' | 'createdAt'>): OtherRevenue {
  const newItem = normalizeOtherRevenue({
    ...item,
    id: crypto.randomUUID(),
    createdAt: new Date().toISOString(),
  });

  if (hasElectronIpc()) {
    const saved = callElectronSync<OtherRevenueRow>('db-sync:other_revenue:add', toOtherRevenueRow(newItem));
    emitDataChange(KEY);
    return normalizeOtherRevenue(saved ?? newItem);
  }

  saveOtherRevenues([...loadLocalOtherRevenue(), newItem]);
  return newItem;
}

export function upsertOtherRevenue(item: Omit<OtherRevenue, 'createdAt'>): OtherRevenue {
  const existing = getOtherRevenues().find((revenue) => revenue.id === item.id);

  if (existing) {
    updateOtherRevenue(item.id, item);
    return {
      ...existing,
      ...item,
      createdAt: existing.createdAt,
    };
  }

  const created = normalizeOtherRevenue({
    ...item,
    createdAt: new Date().toISOString(),
  });

  if (hasElectronIpc()) {
    const saved = callElectronSync<OtherRevenueRow>('db-sync:other_revenue:add', toOtherRevenueRow(created));
    emitDataChange(KEY);
    return normalizeOtherRevenue(saved ?? created);
  }

  saveOtherRevenues([...loadLocalOtherRevenue(), created]);
  return created;
}

export function updateOtherRevenue(id: string, updates: Partial<OtherRevenue>): void {
  if (hasElectronIpc()) {
    callElectronSync('db-sync:other_revenue:update', id, {
      date: updates.date,
      description: updates.description,
      amount: updates.amount,
      source: updates.category,
      addedBy: updates.addedBy ?? null,
    });
    emitDataChange(KEY);
    return;
  }

  const next = loadLocalOtherRevenue().map((item) =>
    item.id === id ? normalizeOtherRevenue({ ...item, ...updates, source: updates.category ?? item.category }) : item,
  );
  setStorageItem(KEY, next);
}

export function deleteOtherRevenue(id: string): void {
  if (hasElectronIpc()) {
    callElectronSync('db-sync:other_revenue:delete', id);
    emitDataChange(KEY);
    return;
  }

  setStorageItem(KEY, loadLocalOtherRevenue().filter((item) => item.id !== id));
}

export function getOtherRevenueCategories(): string[] {
  const categories = new Set(getOtherRevenues().map((item) => item.category).filter(Boolean));
  return Array.from(categories);
}

export function getTotalOtherRevenueThisMonth(): number {
  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  return getOtherRevenues()
    .filter((item) => new Date(item.date) >= startOfMonth)
    .reduce((sum, item) => sum + item.amount, 0);
}
