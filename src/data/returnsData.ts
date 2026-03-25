import { STORAGE_KEYS } from '@/config';
import { ReturnRecord } from '@/domain/types';
import { getStorageItem, setStorageItem } from '@/lib/localStorageHelper';

export interface StoredReturnRecord extends ReturnRecord {
  reason?: string;
  processedBy?: string;
}

const STORAGE_KEY = STORAGE_KEYS.RETURNS;

function loadReturns(): StoredReturnRecord[] {
  return getStorageItem<StoredReturnRecord[]>(STORAGE_KEY, []);
}

function persistReturns(records: StoredReturnRecord[]): void {
  setStorageItem(STORAGE_KEY, records);
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
  return loadReturns().sort((a, b) => (b.createdAt ?? '').localeCompare(a.createdAt ?? ''));
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
  data: Omit<StoredReturnRecord, 'id' | 'returnNumber' | 'createdAt'>
): StoredReturnRecord {
  const records = loadReturns();
  const record: StoredReturnRecord = {
    ...data,
    id: crypto.randomUUID(),
    returnNumber: getNextReturnNumber(records),
    createdAt: new Date().toISOString(),
  };

  persistReturns([...records, record]);
  return record;
}
