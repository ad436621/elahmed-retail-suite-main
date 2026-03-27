// ============================================================
// Shift Closing Data Layer
// ============================================================

import { STORAGE_KEYS } from '@/config';
import { getStorageItem, setStorageItem } from '@/lib/localStorageHelper';
import { callElectronSync, emitDataChange, hasElectronIpc, readElectronSync } from '@/lib/electronDataBridge';
import { getAllSales } from '@/repositories/saleRepository';

const KEY = STORAGE_KEYS.SHIFT_CLOSINGS;

export interface ShiftClosing {
  id: string;
  shiftDate: string;
  closedAt: string;
  closedBy: string;
  salesCount: number;
  salesCash: number;
  salesCard: number;
  salesTransfer: number;
  salesTotal: number;
  expectedCash: number;
  actualCash: number;
  cashDifference: number;
  notes?: string;
  createdAt: string;
}

export interface ShiftSummary {
  salesCount: number;
  salesCash: number;
  salesCard: number;
  salesTransfer: number;
  salesTotal: number;
  expectedCash: number;
}

interface ShiftClosingRow {
  id?: string;
  shiftDate?: string;
  closedAt?: string;
  closedBy?: string;
  salesCount?: number | null;
  salesCash?: number | null;
  salesCard?: number | null;
  salesTransfer?: number | null;
  salesTotal?: number | null;
  expectedCash?: number | null;
  actualCash?: number | null;
  cashDifference?: number | null;
  notes?: string | null;
  createdAt?: string | null;
}

let closingsCache: ShiftClosing[] | null = null;

function toNumber(value: unknown): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function normalizeShiftClosing(row: ShiftClosingRow): ShiftClosing {
  const closedAt = String(row.closedAt ?? new Date().toISOString());
  return {
    id: String(row.id ?? crypto.randomUUID()),
    shiftDate: String(row.shiftDate ?? closedAt.slice(0, 10)),
    closedAt,
    closedBy: String(row.closedBy ?? 'system'),
    salesCount: Math.max(0, Math.round(toNumber(row.salesCount))),
    salesCash: toNumber(row.salesCash),
    salesCard: toNumber(row.salesCard),
    salesTransfer: toNumber(row.salesTransfer),
    salesTotal: toNumber(row.salesTotal),
    expectedCash: toNumber(row.expectedCash),
    actualCash: toNumber(row.actualCash),
    cashDifference: toNumber(row.cashDifference),
    notes: row.notes ? String(row.notes) : undefined,
    createdAt: String(row.createdAt ?? closedAt),
  };
}

function sortClosings(closings: ShiftClosing[]): ShiftClosing[] {
  return [...closings].sort((left, right) => right.closedAt.localeCompare(left.closedAt) || right.id.localeCompare(left.id));
}

function setClosingsState(closings: ShiftClosing[]): void {
  closingsCache = sortClosings(closings.map(normalizeShiftClosing));
}

function loadLocalClosings(): ShiftClosing[] {
  return sortClosings(getStorageItem<ShiftClosing[]>(KEY, []).map(normalizeShiftClosing));
}

function refreshElectronClosings(): ShiftClosing[] {
  const rows = readElectronSync<ShiftClosingRow[]>('db-sync:shift_closings:get', []);
  setClosingsState(rows.map(normalizeShiftClosing));
  return closingsCache ?? [];
}

export function getShiftClosings(): ShiftClosing[] {
  if (hasElectronIpc()) {
    if (closingsCache) return closingsCache;
    return refreshElectronClosings();
  }

  const closings = loadLocalClosings();
  setClosingsState(closings);
  return closingsCache ?? [];
}

export function addShiftClosing(data: Omit<ShiftClosing, 'id' | 'createdAt'>): ShiftClosing {
  if (hasElectronIpc()) {
    const saved = callElectronSync<ShiftClosingRow>('db-sync:shift_closings:add', data);
    const closing = normalizeShiftClosing(saved ?? { ...data, id: crypto.randomUUID(), createdAt: new Date().toISOString() });
    const closings = refreshElectronClosings();
    emitDataChange(KEY);
    return closings.find((item) => item.id === closing.id) ?? closing;
  }

  const entry = normalizeShiftClosing({
    ...data,
    id: crypto.randomUUID(),
    createdAt: new Date().toISOString(),
  });
  const closings = [...getShiftClosings(), entry];
  setStorageItem(KEY, closings);
  setClosingsState(closings);
  emitDataChange(KEY);
  return entry;
}

export function getLastShiftClosing(): ShiftClosing | null {
  const all = getShiftClosings();
  return all.length > 0 ? all[0] : null;
}

export function buildShiftSummary(closedBy: string, actualCash: number, notes?: string): Omit<ShiftClosing, 'id' | 'createdAt'> {
  if (hasElectronIpc()) {
    const summary = callElectronSync<Omit<ShiftClosing, 'id' | 'createdAt'>>(
      'db-sync:shift_closings:buildSummary',
      closedBy,
      actualCash,
      notes,
    );
    if (summary) return summary;
  }

  const today = new Date().toISOString().slice(0, 10);
  const lastClose = getLastShiftClosing();
  const lastClosedAt = lastClose?.closedAt ?? new Date(`${today}T00:00:00`).toISOString();
  const currentSales = getAllSales().filter((sale) => !sale.voidedAt && sale.date >= lastClosedAt);

  let salesCash = 0;
  let salesCard = 0;
  let salesTransfer = 0;

  currentSales.forEach((sale) => {
    if (sale.paymentMethod === 'cash') salesCash += sale.total;
    else if (sale.paymentMethod === 'card') salesCard += sale.total;
    else salesTransfer += sale.total;
  });

  const salesTotal = salesCash + salesCard + salesTransfer;
  const expectedCash = salesCash;

  return {
    shiftDate: today,
    closedAt: new Date().toISOString(),
    closedBy,
    salesCount: currentSales.length,
    salesCash,
    salesCard,
    salesTransfer,
    salesTotal,
    expectedCash,
    actualCash,
    cashDifference: actualCash - expectedCash,
    notes,
  };
}
