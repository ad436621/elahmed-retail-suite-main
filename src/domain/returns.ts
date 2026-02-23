// ============================================================
// ELAHMED RETAIL OS — Returns Domain Logic
// Full/partial returns with stock restoration and audit
// ============================================================

import { Sale, SaleItem, StockMovement } from './types';
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

export function processReturn(
  sale: Sale,
  returnItems: { productId: string; qty: number }[],
  reason: string,
  userId: string,
  currentProductQuantities: Record<string, number>
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

  const items: ReturnItem[] = [];
  const stockMovements: StockMovement[] = [];

  for (const ri of returnItems) {
    const saleItem = sale.items.find(si => si.productId === ri.productId);
    if (!saleItem) {
      throw new ReturnError(`المنتج ${ri.productId} غير موجود في الفاتورة`);
    }
    if (ri.qty > saleItem.qty) {
      throw new ReturnError(`لا يمكن إرجاع كمية أكبر من المُباعة لـ ${saleItem.name}`);
    }
    if (ri.qty <= 0) {
      throw new ReturnError('الكمية يجب أن تكون أكبر من صفر');
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
