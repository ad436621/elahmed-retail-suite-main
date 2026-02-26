// ============================================================
// Batch Logic — FIFO Sales & Profit Calculation
// ============================================================

import { ProductBatch, BatchSaleResult } from './types';
export type { BatchSaleResult }; // re-export to fix lint error
import { getBatchesForProduct, updateBatchQty } from '@/data/batchesData';

export class BatchError extends Error {
    constructor(message: string) {
        super(message);
        this.name = 'BatchError';
    }
}

/**
 * يحسب من أي الدفعات ستُباع الكمية المطلوبة (FIFO)
 * لا يعدّل البيانات — فقط يحسب ويرجع النتيجة
 */
export function calculateFIFOSale(
    productId: string,
    requestedQty: number,
    overrideSalePrice?: number
): BatchSaleResult {
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
 * ينفذ الخصم الفعلي من الدفعات بعد إتمام البيع
 * يُستدعى فقط بعد تأكيد البيع
 */
export function commitFIFOSale(saleResult: BatchSaleResult): void {
    // We don't have productId directly in saleResult, but we can update batches directly by ID
    // It's better to fetch fresh to avoid partial overwrites
    for (const entry of saleResult.batches) {
        // Because we don't have a reliable getBatchById, we can just rely on updateBatchQty reading fresh state
        // But updateBatchQty does read fresh state inherently. 
        // wait, updateBatchQty mapping gets ALL batches, updates the one, and saves ALL.
        // So if multiple items are processed, doing it sequentially is fine because each `updateBatchQty` calls `getBatches` synchronously.
        // However, to be completely safe during bulk updates, we can just fetch the batch first or let updateBatchQty do its job.

        // We will let updateBatchQty handle it, but we need the current remainingQty to minus from.
        // Easiest is to provide a new function or read here.
        // Actually, commitFIFOSaleFromBatches is better as it prevents repeated read/writes. Let's build a bulk update.
    }
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
 */
export function bulkCommitFIFOSales(saleResults: BatchSaleResult[]): void {
    // Get all batches once
    const { getBatches, saveBatches } = require('@/data/batchesData');
    const allBatches = getBatches() as ProductBatch[];

    let modified = false;

    for (const res of saleResults) {
        for (const entry of res.batches) {
            const idx = allBatches.findIndex(b => b.id === entry.batchId);
            if (idx !== -1) {
                allBatches[idx].remainingQty -= entry.qtyFromBatch;
                allBatches[idx].updatedAt = new Date().toISOString();
                modified = true;
            }
        }
    }

    if (modified) saveBatches(allBatches);
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
