// ============================================================
// ELAHMED RETAIL OS — Returns Domain Logic
// Full/partial returns with stock restoration and audit
//
// FIX: Added existingReturns parameter + calculateAlreadyReturnedQty
//      to prevent double-return fraud: a cashier can no longer call
//      processReturn multiple times on the same invoice to receive
//      multiple cash refunds and multiple inventory credits.
// ============================================================

import { Sale, StockMovement } from './types';
import { createStockMovement } from './stock';
import { createAuditEntry } from './audit';

export class ReturnError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ReturnError';
  }
}

export interface ReturnItem {
  productId: string;
  name: string;
  qty: number;
  price: number;
  cost: number;
}

export interface ReturnRecord {
  id: string;
  saleId: string;
  invoiceNumber: string;
  date: string;
  items: ReturnItem[];
  totalRefund: number;
  reason: string;
  processedBy: string;
}

/**
 * Minimal shape needed to check already-returned quantities.
 * Compatible with both ReturnRecord and StoredReturnRecord from returnsData.ts.
 */
interface ReturnRecordLike {
  saleId?: string;
  originalSaleId?: string; // StoredReturnRecord uses this field name
  items: Array<{ productId: string; qty: number }>;
}

/**
 * Calculate how many units of each product have already been returned
 * for a given sale, across all prior return records.
 *
 * Supports both domain ReturnRecord (saleId) and data-layer StoredReturnRecord
 * (originalSaleId) field names.
 */
export function calculateAlreadyReturnedQty(
  saleId: string,
  existingReturns: ReturnRecordLike[]
): Map<string, number> {
  const returned = new Map<string, number>();
  for (const ret of existingReturns) {
    // Support both field name conventions
    const retSaleId = ret.saleId ?? (ret as { originalSaleId?: string }).originalSaleId;
    if (retSaleId !== saleId) continue;
    for (const item of ret.items) {
      returned.set(item.productId, (returned.get(item.productId) ?? 0) + item.qty);
    }
  }
  return returned;
}

export function processReturn(
  sale: Sale,
  returnItems: { productId: string; qty: number }[],
  reason: string,
  userId: string,
  currentProductQuantities: Record<string, number>,
  /**
   * Pass ALL existing return records for this sale to prevent double-return fraud.
   * Accepts both domain ReturnRecord[] and data-layer StoredReturnRecord[].
   * If omitted (legacy callers), fraud guard is skipped — update callers!
   */
  existingReturns: ReturnRecordLike[] = []
): {
  returnRecord: ReturnRecord;
  stockMovements: StockMovement[];
  auditEntries: ReturnType<typeof createAuditEntry>[];
} {
  if (!reason.trim()) {
    throw new ReturnError('سبب الإرجاع مطلوب');
  }

  if (sale.voidedAt) {
    throw new ReturnError('لا يمكن إرجاع فاتورة ملغاة');
  }

  if (returnItems.length === 0) {
    throw new ReturnError('يجب تحديد منتج واحد على الأقل للإرجاع');
  }

  // ── Fraud guard: calculate already-returned quantities ──────────
  const alreadyReturned = calculateAlreadyReturnedQty(sale.id, existingReturns);

  const items: ReturnItem[] = [];
  const stockMovements: StockMovement[] = [];

  for (const ri of returnItems) {
    if (ri.qty <= 0) {
      throw new ReturnError('الكمية يجب أن تكون أكبر من صفر');
    }

    const saleItem = sale.items.find(si => si.productId === ri.productId);
    if (!saleItem) {
      throw new ReturnError(`المنتج ${ri.productId} غير موجود في الفاتورة`);
    }

    const previouslyReturned = alreadyReturned.get(ri.productId) ?? 0;
    const maxReturnable = saleItem.qty - previouslyReturned;

    if (maxReturnable <= 0) {
      throw new ReturnError(
        `تم إرجاع "${saleItem.name}" بالكامل مسبقاً — لا يمكن إرجاعه مرة أخرى`
      );
    }
    if (ri.qty > maxReturnable) {
      throw new ReturnError(
        `لا يمكن إرجاع ${ri.qty} من "${saleItem.name}". ` +
        `الحد الأقصى المتاح للإرجاع: ${maxReturnable} ` +
        `(المُباع: ${saleItem.qty}، المُرجَع سابقاً: ${previouslyReturned})`
      );
    }

    items.push({
      productId: ri.productId,
      name: saleItem.name,
      qty: ri.qty,
      price: saleItem.price,
      cost: saleItem.cost,
    });

    const currentQty = currentProductQuantities[ri.productId] ?? 0;
    stockMovements.push(
      createStockMovement(
        ri.productId,
        'return',
        ri.qty,
        currentQty,
        `مرتجع - فاتورة ${sale.invoiceNumber}: ${reason}`,
        userId,
        sale.id
      )
    );
  }

  const totalRefund = items.reduce((sum, i) => sum + i.price * i.qty, 0);

  const returnRecord: ReturnRecord = {
    id: crypto.randomUUID(),
    saleId: sale.id,
    invoiceNumber: sale.invoiceNumber,
    date: new Date().toISOString(),
    items,
    totalRefund,
    reason,
    processedBy: userId,
  };

  const auditEntries = [
    createAuditEntry(
      userId,
      'return_processed',
      'sale',
      sale.id,
      null,
      {
        returnId: returnRecord.id,
        invoiceNumber: sale.invoiceNumber,
        totalRefund,
        reason,
        itemCount: items.length,
      }
    ),
  ];

  return { returnRecord, stockMovements, auditEntries };
}
