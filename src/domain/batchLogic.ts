// ============================================================
// Batch Logic — FIFO Sales & Profit Calculation
// ============================================================

import { ProductBatch, BatchSaleResult } from './types';
export type { BatchSaleResult }; // re-export to fix lint error
import {
  getBatchesForProduct,
  updateBatchQty,
  getBatches,
  saveBatches,
  invalidateBatchesCache,
} from '@/data/batchesData';

export class BatchError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'BatchError';
  }
}

/**
 * يحسب من أي الدفعات ستُباع الكمية المطلوبة (FIFO)
 * لا يعدّل البيانات — فقط يحسب ويرجع النتيجة
 *
 * FIX: Added qty validation to prevent zero/negative/fractional
 *      quantities which would create zero-cost "free" items.
 */
export function calculateFIFOSale(
  productId: string,
  requestedQty: number,
  overrideSalePrice?: number
): BatchSaleResult {
  // ── Input validation ────────────────────────────────────
  if (!Number.isFinite(requestedQty) || requestedQty <= 0) {
    throw new BatchError(
      `الكمية المطلوبة يجب أن تكون رقماً موجباً. القيمة الواردة: ${requestedQty}`
    );
  }
  if (!Number.isInteger(requestedQty)) {
    throw new BatchError(
      `الكمية يجب أن تكون عدداً صحيحاً. القيمة: ${requestedQty}`
    );
  }

  const batches = getBatchesForProduct(productId); // مرتبة قديم → جديد

  let remaining = requestedQty;
  const result: BatchSaleResult = {
    batches: [],
    totalCost: 0,
    totalProfit: 0,
  };

  for (const batch of batches) {
    if (remaining <= 0) break;

    const takeFromBatch = Math.min(remaining, batch.remainingQty);
    // Use override price if provided (e.g. custom price in POS or Installments), otherwise batch's default sale price
    const actualSalePrice = overrideSalePrice !== undefined ? overrideSalePrice : batch.salePrice;
    const profit = (actualSalePrice - batch.costPrice) * takeFromBatch;

    result.batches.push({
      batchId: batch.id,
      qtyFromBatch: takeFromBatch,
      costPrice: batch.costPrice,
      salePrice: actualSalePrice,
      profit,
    });

    result.totalCost += batch.costPrice * takeFromBatch;
    result.totalProfit += profit;
    remaining -= takeFromBatch;
  }

  // لو الكمية المتاحة في الدفعات أقل من المطلوبة
  if (remaining > 0) {
    throw new BatchError(
      `الكمية المتاحة غير كافية. المتوفر: ${requestedQty - remaining}، المطلوب: ${requestedQty}`
    );
  }

  return result;
}

/**
 * نسخة محسّنة تأخذ الدفعات وتنفذ الخصم (لتقليل قراءة/كتابة localStorage)
 */
export function commitFIFOSaleFromBatches(
  saleResult: BatchSaleResult,
  loadedBatches: ProductBatch[] // These should be fresh enough
): void {
  for (const entry of saleResult.batches) {
    const batch = loadedBatches.find(b => b.id === entry.batchId);
    if (batch) {
      updateBatchQty(entry.batchId, batch.remainingQty - entry.qtyFromBatch);
    }
  }
}

/**
 * تنفيذ الخصم مباشرة بدون قراءة مسبقة من التابع
 * Bulk update to avoid multiple writes for one cart
 *
 * FIX: Added race-window guard — re-reads fresh data and throws if a batch
 *      went negative between calculateFIFOSale and this commit call.
 *      This prevents silent overselling in multi-tab scenarios.
 */
export function bulkCommitFIFOSales(saleResults: BatchSaleResult[]): void {
  // Invalidate cache and get fresh data to minimize the race window
  invalidateBatchesCache();
  const allBatches = getBatches() as ProductBatch[];

  let modified = false;

  // Build a mutable copy map for O(1) lookup
  const batchMap = new Map<string, ProductBatch>(allBatches.map(b => [b.id, { ...b }]));

  for (const res of saleResults) {
    for (const entry of res.batches) {
      const batch = batchMap.get(entry.batchId);
      if (!batch) {
        throw new BatchError(
          `الدفعة ${entry.batchId} غير موجودة — لا يمكن إتمام البيع`
        );
      }
      const newQty = batch.remainingQty - entry.qtyFromBatch;
      // Race guard: stock was consumed by another tab/operation between
      // calculateFIFOSale and this commit — reject to prevent going negative
      if (newQty < 0) {
        throw new BatchError(
          `الكمية المتاحة في الدفعة تغيرت. ` +
          `المتوفر: ${batch.remainingQty}، المطلوب: ${entry.qtyFromBatch}. ` +
          `يرجى إعادة المحاولة.`
        );
      }
      batchMap.set(entry.batchId, {
        ...batch,
        remainingQty: newQty,
        updatedAt: new Date().toISOString(),
      });
      modified = true;
    }
  }

  if (modified) saveBatches([...batchMap.values()]);
}

/**
 * سعر البيع الافتراضي = سعر أقدم دفعة فيها كمية
 * (ده اللي يظهر في POS عند البحث)
 */
export function getActiveSalePrice(productId: string): number | null {
  const batches = getBatchesForProduct(productId);
  return batches.length > 0 ? batches[0].salePrice : null;
}

/**
 * تكلفة أقدم دفعة متاحة (للحد الأدنى للخصم)
 */
export function getOldestCostPrice(productId: string): number | null {
  const batches = getBatchesForProduct(productId);
  return batches.length > 0 ? batches[0].costPrice : null;
}

/**
 * عدد الدفعات المتاحة حالياً
 */
export function getAvailableBatchesCount(productId: string): number {
  return getBatchesForProduct(productId).length;
}
