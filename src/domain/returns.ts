// ============================================================
// ELAHMED RETAIL OS — Returns Domain Logic
// Full/partial returns with stock restoration and audit
//
// FIX: Added existingReturns parameter + calculateAlreadyReturnedQty
//      to prevent double-return fraud: a cashier can no longer call
//      processReturn multiple times on the same invoice to receive
//      multiple cash refunds and multiple inventory credits.
// ============================================================

import { Sale, StockMovement, ReturnRecord, ReturnItem } from './types';
import { createStockMovement } from './stock';
import { createAuditEntry } from './audit';

export class ReturnError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ReturnError';
  }
}

// Re-export types so callers can import from one place
export type { ReturnRecord, ReturnItem };

/**
 * Minimal shape needed to check already-returned quantities.
 * Compatible with both ReturnRecord (originalSaleId) from types.ts
 * and StoredReturnRecord from returnsData.ts (same field name).
 */
interface ReturnRecordLike {
  originalSaleId?: string;
  items: Array<{ productId: string; qty: number }>;
}

/**
 * Calculate how many units of each product have already been returned
 * for a given sale, across all prior return records.
 */
export function calculateAlreadyReturnedQty(
  saleId: string,
  existingReturns: ReturnRecordLike[]
): Map<string, number> {
  const returned = new Map<string, number>();
  for (const ret of existingReturns) {
    if (ret.originalSaleId !== saleId) continue;
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
   * Accepts StoredReturnRecord[] from returnsData.ts (uses originalSaleId field).
   * If omitted, fraud guard is skipped — update all callers!
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

  if (sale.voidedAt !== null && sale.voidedAt !== undefined) {
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
      cost: saleItem.cost,   // optional field added to ReturnItem in types.ts
      reason,
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

  // Build a ReturnRecord compatible with types.ts (uses originalSaleId, originalInvoiceNumber)
  // returnNumber and createdAt are assigned by the data layer (addReturnRecord)
  const returnRecord: ReturnRecord = {
    id: crypto.randomUUID(),
    returnNumber: '',                         // assigned by addReturnRecord
    originalSaleId: sale.id,
    originalInvoiceNumber: sale.invoiceNumber,
    date: new Date().toISOString().slice(0, 10),
    items,
    totalRefund,
    createdAt: new Date().toISOString(),
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
