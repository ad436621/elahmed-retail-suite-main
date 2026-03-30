import { STORAGE_KEYS } from '@/config';
import { callElectronSync, emitDataChange, hasElectronIpc, readElectronSync } from '@/lib/electronDataBridge';
import { getStorageItem, setStorageItem } from '@/lib/localStorageHelper';
import { BatchInventoryType, ProductBatch } from '@/domain/types';

const BATCHES_KEY = STORAGE_KEYS.BATCHES;

interface ProductBatchRow {
  id: string;
  productId: string;
  inventoryType?: string | null;
  productName?: string | null;
  costPrice?: number | null;
  salePrice?: number | null;
  quantity?: number | null;
  remainingQty?: number | null;
  purchaseDate?: string | null;
  supplier?: string | null;
  notes?: string | null;
  createdAt?: string | null;
  updatedAt?: string | null;
}

let batchesCache: ProductBatch[] | null = null;

function toNumber(value: unknown): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function sortBatches(batches: ProductBatch[]): ProductBatch[] {
  return [...batches].sort((left, right) => (
    left.purchaseDate.localeCompare(right.purchaseDate)
    || left.createdAt.localeCompare(right.createdAt)
    || left.id.localeCompare(right.id)
  ));
}

function normalizeBatch(row: Partial<ProductBatchRow> | Partial<ProductBatch>): ProductBatch {
  const purchaseDate = String((row as ProductBatchRow).purchaseDate ?? (row as ProductBatch).purchaseDate ?? new Date().toISOString());
  const createdAt = String((row as ProductBatchRow).createdAt ?? (row as ProductBatch).createdAt ?? purchaseDate);
  return {
    id: String(row.id ?? crypto.randomUUID()),
    productId: String(row.productId ?? ''),
    inventoryType: String((row as ProductBatchRow).inventoryType ?? (row as ProductBatch).inventoryType ?? 'mobile') as BatchInventoryType,
    productName: String((row as ProductBatchRow).productName ?? (row as ProductBatch).productName ?? '').trim(),
    costPrice: toNumber((row as ProductBatchRow).costPrice ?? (row as ProductBatch).costPrice),
    salePrice: toNumber((row as ProductBatchRow).salePrice ?? (row as ProductBatch).salePrice),
    quantity: Math.max(0, Math.round(toNumber((row as ProductBatchRow).quantity ?? (row as ProductBatch).quantity))),
    remainingQty: Math.max(0, Math.round(toNumber((row as ProductBatchRow).remainingQty ?? (row as ProductBatch).remainingQty ?? (row as ProductBatch).quantity))),
    purchaseDate,
    supplier: String((row as ProductBatchRow).supplier ?? (row as ProductBatch).supplier ?? ''),
    notes: String((row as ProductBatchRow).notes ?? (row as ProductBatch).notes ?? ''),
    createdAt,
    updatedAt: String((row as ProductBatchRow).updatedAt ?? (row as ProductBatch).updatedAt ?? createdAt),
  };
}

function toBatchRow(batch: ProductBatch): ProductBatchRow {
  return {
    id: batch.id,
    productId: batch.productId,
    inventoryType: batch.inventoryType,
    productName: batch.productName,
    costPrice: batch.costPrice,
    salePrice: batch.salePrice,
    quantity: batch.quantity,
    remainingQty: batch.remainingQty,
    purchaseDate: batch.purchaseDate,
    supplier: batch.supplier,
    notes: batch.notes,
    createdAt: batch.createdAt,
    updatedAt: batch.updatedAt,
  };
}

function setBatchesState(batches: ProductBatch[]): void {
  batchesCache = sortBatches(batches.map(normalizeBatch));
}

function loadLocalBatches(): ProductBatch[] {
  const saved = getStorageItem<ProductBatch[]>(BATCHES_KEY, []);
  return sortBatches((Array.isArray(saved) ? saved : []).map(normalizeBatch));
}

function refreshElectronBatches(): ProductBatch[] {
  const rows = readElectronSync<ProductBatchRow[]>('db-sync:product_batches:get', []);
  const rowsArray = Array.isArray(rows) ? rows : [];
  setBatchesState(rowsArray.map(normalizeBatch));
  return batchesCache ?? [];
}

export function getBatches(): ProductBatch[] {
  if (batchesCache) return batchesCache;

  if (hasElectronIpc()) {
    return refreshElectronBatches();
  }

  const localBatches = loadLocalBatches();
  setBatchesState(localBatches);
  return batchesCache ?? [];
}

export function saveBatches(batches: ProductBatch[]): void {
  const normalized = sortBatches(batches.map(normalizeBatch));

  if (hasElectronIpc()) {
    const current = new Map(getBatches().map((batch) => [batch.id, batch]));
    const nextIds = new Set(normalized.map((batch) => batch.id));

    for (const batch of normalized) {
      const payload = toBatchRow(batch);
      if (current.has(batch.id)) {
        callElectronSync('db-sync:product_batches:update', batch.id, payload);
      } else {
        callElectronSync('db-sync:product_batches:add', payload);
      }
    }

    for (const id of current.keys()) {
      if (!nextIds.has(id)) {
        callElectronSync('db-sync:product_batches:delete', id);
      }
    }

    setBatchesState(normalized);
    emitDataChange(BATCHES_KEY);
    return;
  }

  setStorageItem(BATCHES_KEY, normalized);
  setBatchesState(normalized);
  emitDataChange(BATCHES_KEY);
}

export function getBatchesForProduct(productId: string): ProductBatch[] {
  return getBatches()
    .filter((batch) => batch.productId === productId && batch.remainingQty > 0)
    .sort((left, right) => new Date(left.purchaseDate).getTime() - new Date(right.purchaseDate).getTime());
}

export function getAllBatchesForProduct(productId: string): ProductBatch[] {
  return getBatches()
    .filter((batch) => batch.productId === productId)
    .sort((left, right) => new Date(left.purchaseDate).getTime() - new Date(right.purchaseDate).getTime());
}

export function getBatchesByType(type: BatchInventoryType): ProductBatch[] {
  return getBatches().filter((batch) => batch.inventoryType === type);
}

export function addBatch(data: Omit<ProductBatch, 'id' | 'createdAt' | 'updatedAt'>): ProductBatch {
  const batch = normalizeBatch({
    ...data,
    id: crypto.randomUUID(),
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  });

  if (hasElectronIpc()) {
    const saved = callElectronSync<ProductBatchRow>('db-sync:product_batches:add', toBatchRow(batch));
    const next = normalizeBatch(saved ?? batch);
    const allBatches = refreshElectronBatches();
    emitDataChange(BATCHES_KEY);
    return allBatches.find((item) => item.id === next.id) ?? next;
  }

  saveBatches([...getBatches(), batch]);
  return batch;
}

export function updateBatch(batchId: string, updates: Partial<ProductBatch>): void {
  if (hasElectronIpc()) {
    const current = getBatches().find((batch) => batch.id === batchId);
    const next = normalizeBatch({ ...(current ?? { id: batchId, productId: '', productName: '' }), ...updates });
    const updatedBatch = normalizeBatch({ ...next, updatedAt: new Date().toISOString() });
    callElectronSync('db-sync:product_batches:update', batchId, toBatchRow(updatedBatch));
    setBatchesState(getBatches().map((batch) => (batch.id === batchId ? updatedBatch : batch)));
    emitDataChange(BATCHES_KEY);
    return;
  }

  saveBatches(getBatches().map((batch) => (
    batch.id === batchId
      ? normalizeBatch({ ...batch, ...updates, updatedAt: new Date().toISOString() })
      : batch
  )));
}

export function updateBatchQty(batchId: string, newRemainingQty: number): void {
  updateBatch(batchId, { remainingQty: Math.max(0, Math.round(newRemainingQty)) });
}

export function restoreBatchQty(batchId: string, qtyToRestore: number): void {
  const batch = getBatches().find((entry) => entry.id === batchId);
  if (!batch) return;
  updateBatch(batchId, { remainingQty: batch.remainingQty + Math.max(0, Math.round(qtyToRestore)) });
}

export function deleteBatch(batchId: string): void {
  if (hasElectronIpc()) {
    callElectronSync('db-sync:product_batches:delete', batchId);
    setBatchesState(getBatches().filter((batch) => batch.id !== batchId));
    emitDataChange(BATCHES_KEY);
    return;
  }

  saveBatches(getBatches().filter((batch) => batch.id !== batchId));
}

export function getTotalAvailableQty(productId: string): number {
  return getBatchesForProduct(productId).reduce((sum, batch) => sum + batch.remainingQty, 0);
}

export function getWeightedAvgCost(productId: string): number {
  const batches = getBatchesForProduct(productId);
  const totalQty = batches.reduce((sum, batch) => sum + batch.remainingQty, 0);
  if (totalQty === 0) return 0;
  const totalCost = batches.reduce((sum, batch) => sum + (batch.costPrice * batch.remainingQty), 0);
  return Math.round(totalCost / totalQty);
}
