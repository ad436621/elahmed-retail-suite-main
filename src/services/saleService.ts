// ============================================================
// ELAHMED RETAIL OS — Sale Service
// Orchestrates sale flow: validation → stock → audit → record
// ============================================================

import { CartItem, PaymentMethod, Sale, StockMovement } from '@/domain/types';
import { buildSaleRecord, calcCartTotals } from '@/domain/sale';
import { validateStock, createStockMovement } from '@/domain/stock';
import { createAuditEntry, createVoidAudit } from '@/domain/audit';
import { calculateFIFOSale, bulkCommitFIFOSales, BatchSaleResult } from '@/domain/batchLogic';

let invoiceCounter = 5; // Start after mock data

function generateInvoiceNumber(): string {
  invoiceCounter++;
  const year = new Date().getFullYear();
  return `INV-${year}-${invoiceCounter.toString().padStart(4, '0')}`;
}

export interface SaleResult {
  sale: Sale;
  stockMovements: StockMovement[];
  auditEntries: ReturnType<typeof createAuditEntry>[];
}

/** Process a complete sale with full validation */
export function processSale(
  cart: CartItem[],
  invoiceDiscount: number,
  paymentMethod: PaymentMethod,
  employeeId: string,
  employeeName: string
): SaleResult {
  // 1. Validate stock for all items
  for (const item of cart) {
    validateStock(item.product, item.qty);
  }

  // Calculate FIFO for all items
  const fifoResults: BatchSaleResult[] = [];
  let totalFifoCost = 0;

  for (const item of cart) {
    // Pass sellingPrice so FIFO knows what revenue to calculate profit against
    const result = calculateFIFOSale(item.product.id, item.qty, item.product.sellingPrice);
    fifoResults.push(result);
    totalFifoCost += result.totalCost;
  }

  // 2. Build sale record with profit calculations
  const invoiceNumber = generateInvoiceNumber();
  const sale = buildSaleRecord(cart, invoiceDiscount, paymentMethod, employeeName, invoiceNumber);

  // Override the simplistic cost with the accurate FIFO cost
  sale.totalCost = totalFifoCost;
  sale.grossProfit = sale.total - sale.totalCost;
  sale.marginPct = sale.total > 0 ? Math.round((sale.grossProfit / sale.total) * 1000) / 10 : 0;

  // 3. Commit FIFO changes to batches
  bulkCommitFIFOSales(fifoResults);

  // 4. Create stock movements for each item
  const stockMovements = cart.map(item =>
    createStockMovement(
      item.product.id,
      'sale',
      -item.qty,
      item.product.quantity,
      `Sale ${invoiceNumber}`,
      employeeId,
      sale.id
    )
  );

  // 5. Create audit entry
  const auditEntries = [
    createAuditEntry(
      employeeId,
      'sale_completed',
      'sale',
      sale.id,
      null,
      {
        invoiceNumber,
        total: sale.total,
        grossProfit: sale.grossProfit,
        marginPct: sale.marginPct,
        itemCount: cart.length,
      }
    ),
  ];

  return { sale, stockMovements, auditEntries };
}

/** Void a sale — reason is mandatory, admin only */
export function voidSale(
  sale: Sale,
  reason: string,
  userId: string
): { voidedSale: Sale; auditEntry: ReturnType<typeof createVoidAudit> } {
  if (sale.voidedAt) {
    throw new Error('Sale is already voided');
  }

  const voidedSale: Sale = {
    ...sale,
    voidedAt: new Date().toISOString(),
    voidReason: reason,
    voidedBy: userId,
  };

  const auditEntry = createVoidAudit(userId, sale.id, reason);

  return { voidedSale, auditEntry };
}

/** Get cart totals — delegates to pure domain function */
export function getCartTotals(cart: CartItem[], invoiceDiscount: number) {
  return calcCartTotals(cart, invoiceDiscount);
}
