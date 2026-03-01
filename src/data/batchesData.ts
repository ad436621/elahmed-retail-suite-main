// ============================================================
// Product Batches — Data Layer (localStorage)
// ============================================================

import { ProductBatch, BatchInventoryType } from '@/domain/types';
import { getStorageItem, setStorageItem } from '@/lib/localStorageHelper';

const BATCHES_KEY = 'gx_product_batches_v1';

export function getBatches(): ProductBatch[] {
    return getStorageItem<ProductBatch[]>(BATCHES_KEY, []);
}

export function saveBatches(batches: ProductBatch[]): void {
    setStorageItem(BATCHES_KEY, batches);
}

/** جلب دفعات منتج معين مرتبة من الأقدم للأحدث (FIFO) */
export function getBatchesForProduct(productId: string): ProductBatch[] {
    return getBatches()
        .filter(b => b.productId === productId && b.remainingQty > 0)
        .sort((a, b) => new Date(a.purchaseDate).getTime() - new Date(b.purchaseDate).getTime());
}

/** جلب كل دفعات منتج معين (بما فيها الفارغة - مفيدة لسجل الدفعات) */
export function getAllBatchesForProduct(productId: string): ProductBatch[] {
    return getBatches()
        .filter(b => b.productId === productId)
        .sort((a, b) => new Date(a.purchaseDate).getTime() - new Date(b.purchaseDate).getTime());
}

/** جلب دفعات حسب نوع المخزون */
export function getBatchesByType(type: BatchInventoryType): ProductBatch[] {
    return getBatches().filter(b => b.inventoryType === type);
}

/** إضافة دفعة جديدة */
export function addBatch(
    data: Omit<ProductBatch, 'id' | 'createdAt' | 'updatedAt'>
): ProductBatch {
    const all = getBatches();
    const newBatch: ProductBatch = {
        ...data,
        id: crypto.randomUUID(),
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
    };
    saveBatches([...all, newBatch]);
    return newBatch;
}

/** تحديث دفعة بالكامل (مثلا تعديل سعر بيع أو مورد) */
export function updateBatch(batchId: string, updates: Partial<ProductBatch>): void {
    const all = getBatches();
    saveBatches(all.map(b =>
        b.id === batchId
            ? { ...b, ...updates, updatedAt: new Date().toISOString() }
            : b
    ));
}

/** تحديث الكمية المتبقية في دفعة */
export function updateBatchQty(batchId: string, newRemainingQty: number): void {
    saveBatches(getBatches().map(b =>
        b.id === batchId
            ? { ...b, remainingQty: newRemainingQty, updatedAt: new Date().toISOString() }
            : b
    ));
}

/** إرجاع كمية لدفعة (في حالة مرتجع أو إلغاء بيع) */
export function restoreBatchQty(batchId: string, qtyToRestore: number): void {
    saveBatches(getBatches().map(b =>
        b.id === batchId
            ? { ...b, remainingQty: b.remainingQty + qtyToRestore, updatedAt: new Date().toISOString() }
            : b
    ));
}

/** حذف دفعة */
export function deleteBatch(batchId: string): void {
    saveBatches(getBatches().filter(b => b.id !== batchId));
}

/** إجمالي الكمية المتاحة لمنتج معين (من كل الدفعات) */
export function getTotalAvailableQty(productId: string): number {
    return getBatchesForProduct(productId)
        .reduce((sum, b) => sum + b.remainingQty, 0);
}

/** متوسط التكلفة الحالي لمنتج (للعرض في الداشبورد) */
export function getWeightedAvgCost(productId: string): number {
    const batches = getBatchesForProduct(productId);
    const totalQty = batches.reduce((s, b) => s + b.remainingQty, 0);
    if (totalQty === 0) return 0;
    const totalCost = batches.reduce((s, b) => s + (b.costPrice * b.remainingQty), 0);
    return Math.round(totalCost / totalQty);
}
