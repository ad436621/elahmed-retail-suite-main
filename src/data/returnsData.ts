import { STORAGE_KEYS } from '@/config';
import { ReturnRecord } from '@/domain/types';
import { getStorageItem, setStorageItem } from '@/lib/localStorageHelper';
import { callElectronSync, emitDataChange, hasElectronIpc, readElectronSync } from '@/lib/electronDataBridge';

export interface StoredReturnRecord extends ReturnRecord {
  reason?: string;
  processedBy?: string;
}

const STORAGE_KEY = STORAGE_KEYS.RETURNS;

let returnsCache: StoredReturnRecord[] | null = null;

function normalizeRecord(record: Partial<StoredReturnRecord>): StoredReturnRecord {
  return {
    id: String(record.id ?? crypto.randomUUID()),
    returnNumber: String(record.returnNumber ?? ''),
    originalInvoiceNumber: String(record.originalInvoiceNumber ?? ''),
    originalSaleId: String(record.originalSaleId ?? ''),
    date: String(record.date ?? new Date().toISOString().slice(0, 10)),
    items: Array.isArray(record.items)
      ? record.items.map((item) => ({
        productId: String(item.productId ?? ''),
        name: String(item.name ?? ''),
        qty: Number(item.qty ?? 0),
        price: Number(item.price ?? 0),
        reason: String(item.reason ?? ''),
      }))
      : [],
    totalRefund: Number(record.totalRefund ?? 0),
    reason: record.reason ? String(record.reason) : undefined,
    processedBy: record.processedBy ? String(record.processedBy) : undefined,
    createdAt: String(record.createdAt ?? new Date().toISOString()),
  };
}

function sortRecords(records: StoredReturnRecord[]): StoredReturnRecord[] {
  return [...records].sort((left, right) => (right.createdAt ?? '').localeCompare(left.createdAt ?? '') || right.id.localeCompare(left.id));
}

function setReturnsState(records: StoredReturnRecord[]): void {
  returnsCache = sortRecords(records.map(normalizeRecord));
}

function loadReturns(): StoredReturnRecord[] {
  return sortRecords(getStorageItem<StoredReturnRecord[]>(STORAGE_KEY, []).map(normalizeRecord));
}

function refreshElectronReturns(): StoredReturnRecord[] {
  const rows = readElectronSync<StoredReturnRecord[]>('db-sync:returns:get', []);
  setReturnsState(rows.map(normalizeRecord));
  return returnsCache ?? [];
}

function persistReturns(records: StoredReturnRecord[]): void {
  setStorageItem(STORAGE_KEY, records);
  setReturnsState(records);
  emitDataChange(STORAGE_KEY);
}

function getNextReturnNumber(records: StoredReturnRecord[]): string {
  const maxSequence = records.reduce((max, record) => {
    const match = /^RET-(\d+)$/.exec(record.returnNumber);
    const sequence = match ? Number.parseInt(match[1], 10) : 0;
    return Number.isFinite(sequence) ? Math.max(max, sequence) : max;
  }, 0);

  return `RET-${String(maxSequence + 1).padStart(4, '0')}`;
}

export function getReturnRecords(): StoredReturnRecord[] {
  if (hasElectronIpc()) {
    if (returnsCache) return returnsCache;
    return refreshElectronReturns();
  }

  const records = loadReturns();
  setReturnsState(records);
  return returnsCache ?? [];
}

export function getReturnsBySaleId(originalSaleId: string): StoredReturnRecord[] {
  return getReturnRecords().filter((record) => record.originalSaleId === originalSaleId);
}

export function getReturnedQuantitiesBySaleId(originalSaleId: string): Record<string, number> {
  return getReturnsBySaleId(originalSaleId).reduce<Record<string, number>>((acc, record) => {
    record.items.forEach((item) => {
      acc[item.productId] = (acc[item.productId] ?? 0) + item.qty;
    });
    return acc;
  }, {});
}

export function addReturnRecord(
  data: Omit<StoredReturnRecord, 'id' | 'returnNumber' | 'createdAt'>,
): StoredReturnRecord {
  if (hasElectronIpc()) {
    const saved = callElectronSync<StoredReturnRecord>('db-sync:returns:add', data);
    const record = normalizeRecord(saved ?? {
      ...data,
      id: crypto.randomUUID(),
      returnNumber: '',
      createdAt: new Date().toISOString(),
    });
    const records = refreshElectronReturns();
    emitDataChange(STORAGE_KEY);
    return records.find((item) => item.id === record.id) ?? record;
  }

  const records = loadReturns();
  const record: StoredReturnRecord = normalizeRecord({
    ...data,
    id: crypto.randomUUID(),
    returnNumber: getNextReturnNumber(records),
    createdAt: new Date().toISOString(),
  });

  persistReturns([...records, record]);
  return record;
}
