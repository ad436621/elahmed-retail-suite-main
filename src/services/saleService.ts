// ============================================================
// ELAHMED RETAIL OS — Sale Service
// Orchestrates sale flow: validation → stock → audit → record
// ============================================================

import { restoreBatchQty } from '@/data/batchesData';
import { CartItem, PaymentMethod, Product, Sale, StockMovement } from '@/domain/types';
import { buildSaleRecord, calcCartTotals } from '@/domain/sale';
import { validateStock, createStockMovement } from '@/domain/stock';
import { createAuditEntry, createVoidAudit } from '@/domain/audit';
import { calculateFIFOSale, bulkCommitFIFOSales, BatchSaleResult } from '@/domain/batchLogic';
import { STORAGE_KEYS } from '@/config';

const INVOICE_COUNTER_KEY = STORAGE_KEYS.INVOICE_COUNTER;

function extractInvoiceSequence(invoiceNumber: string): number {
  const match = /^INV-\d{4}-(\d+)$/.exec(invoiceNumber.trim());
  if (!match) return 0;
  const parsed = Number.parseInt(match[1], 10);
  return Number.isFinite(parsed) ? parsed : 0;
}

function getStoredInvoiceCounter(): number {
  try {
    const stored = localStorage.getItem(INVOICE_COUNTER_KEY);
    if (stored) {
      const parsed = parseInt(stored, 10);
      if (!isNaN(parsed) && parsed > 0) return parsed;
    }
  } catch (e) {
    if (import.meta.env.DEV) {
      console.error('Failed to read invoice counter:', e);
    }
  }
  return 0;
}

function getPersistedInvoiceSequence(): number {
  try {
    if (window.electron?.ipcRenderer) {
      const sequence = window.electron.ipcRenderer.sendSync('db-sync:sales:maxInvoiceSequence');
      return Number.isFinite(Number(sequence)) ? Number(sequence) : 0;
    }

    const salesKeys = [STORAGE_KEYS.SALES, STORAGE_KEYS.SALES_LEGACY];
    const sales = salesKeys.flatMap((key) => {
      const rawSales = localStorage.getItem(key);
      if (!rawSales) return [];

      const parsed = JSON.parse(rawSales) as Array<{ invoiceNumber?: string }>;
      return Array.isArray(parsed) ? parsed : [];
    });
    return sales.reduce((max, sale) => Math.max(max, extractInvoiceSequence(String(sale.invoiceNumber ?? ''))), 0);
  } catch (e) {
    if (import.meta.env.DEV) {
      console.error('Failed to infer invoice counter from persisted sales:', e);
    }
    return 0;
  }
}

function saveInvoiceCounter(counter: number): void {
  try {
    localStorage.setItem(INVOICE_COUNTER_KEY, String(counter));
  } catch (e) {
    if (import.meta.env.DEV) {
      console.error('Failed to save invoice counter:', e);
    }
  }
}

// Simple lock to prevent concurrent invoice number generation
const INVOICE_LOCK_KEY = 'gx_invoice_gen_lock';

function acquireInvoiceLock(): boolean {
  try {
    // Try to set a unique value - if it already exists, lock is held
    const existing = localStorage.getItem(INVOICE_LOCK_KEY);
    if (existing) {
      // Check if lock is stale (older than 5 seconds)
      const lockTime = parseInt(existing, 10);
      if (Date.now() - lockTime > 5000) {
        // Stale lock - overwrite it
        localStorage.setItem(INVOICE_LOCK_KEY, String(Date.now()));
        return true;
      }
      return false;
    }
    localStorage.setItem(INVOICE_LOCK_KEY, String(Date.now()));
    return true;
  } catch {
    return true; // If we can't set, proceed anyway
  }
}

function releaseInvoiceLock(): void {
  try {
    localStorage.removeItem(INVOICE_LOCK_KEY);
  } catch {
    // Ignore cleanup errors
  }
}

export function generateInvoiceNumber(): string {
  // Try to acquire lock - retry a few times if locked
  let lockAcquired = false;
  for (let i = 0; i < 3; i++) {
    if (acquireInvoiceLock()) {
      lockAcquired = true;
      break;
    }
    // Small delay before retry
    const start = Date.now();
    while (Date.now() - start < 10) { /* busy wait */ }
  }
  
  try {
    const currentCounter = Math.max(getStoredInvoiceCounter(), getPersistedInvoiceSequence());
    const newCounter = currentCounter + 1;
    saveInvoiceCounter(newCounter);
    const year = new Date().getFullYear();
    return `INV-${year}-${newCounter.toString().padStart(4, '0')}`;
  } finally {
    if (lockAcquired) {
      releaseInvoiceLock();
    }
  }
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
  employeeName: string,
  customerId?: string,
  customerName?: string
): SaleResult {
  // Validate invoice discount - must be non-negative
  if (invoiceDiscount < 0) {
    throw new Error('خصم الفاتورة لا يمكن أن يكون سالباً');
  }

  // 1. Validate stock for all items
  for (const item of cart) {
    validateStock(item.product, item.qty);
  }

  // Calculate FIFO for all items — with fallback when no batches exist
  const fifoResults: BatchSaleResult[] = [];
  let totalFifoCost = 0;

  for (const item of cart) {
    let result: BatchSaleResult;
    try {
      // FIX: Calculate net unit price to ensure batch profit isn't inflated by ignoring line discounts
      const netUnitPrice = Math.max(0, (item.product.sellingPrice * item.qty - (item.lineDiscount || 0)) / item.qty);
      // Try FIFO from batches first
      result = calculateFIFOSale(item.product.id, item.qty, netUnitPrice);
    } catch {
      // ── No batches fallback ─────────────────────────────────────────
      // If the product has enough quantity in its own record, use it directly.
      // This handles imported backups that lack batch records.
      const costPerUnit = item.product.costPrice ?? 0;
      const netUnitPrice = Math.max(0, (item.product.sellingPrice * item.qty - (item.lineDiscount || 0)) / item.qty);
      const profit = (netUnitPrice - costPerUnit) * item.qty;
      result = {
        batches: [{
          batchId: `auto-${item.product.id}`,
          qtyFromBatch: item.qty,
          costPrice: costPerUnit,
          salePrice: netUnitPrice,
          profit,
        }],
        totalCost: costPerUnit * item.qty,
        totalProfit: profit,
      };
    }
    fifoResults.push(result);
    totalFifoCost += result.totalCost;
  }

  // 2. Build sale record with profit calculations using FIFO data
  const invoiceNumber = generateInvoiceNumber();
  const sale = buildSaleRecord(cart, invoiceDiscount, paymentMethod, employeeName, invoiceNumber, fifoResults, customerId, customerName);

  // Profit/cost is inherently generated inside buildSaleRecord via fifoResults now,
  // but we can ensure marginPct is neat.
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
      sale.id,
      item.product.warehouseId
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
  userId: string,
  currentProducts: Record<string, Product | undefined>
): {
  voidedSale: Sale;
  auditEntry: ReturnType<typeof createVoidAudit>;
  stockMovements: StockMovement[];
} {
  if (sale.voidedAt) {
    throw new Error('Sale is already voided');
  }
  const trimmedReason = reason.trim();
  if (!trimmedReason) {
    throw new Error('Void reason is required');
  }

  const voidedSale: Sale = {
    ...sale,
    voidedAt: new Date().toISOString(),
    voidReason: trimmedReason,
    voidedBy: userId,
  };

  const validatedItems = sale.items.map((item) => {
    const currentProduct = currentProducts[item.productId];
    if (!currentProduct) {
      throw new Error(`Cannot void sale because product "${item.name}" is no longer available in inventory`);
    }

    return { item, currentProduct };
  });

  const stockMovements = validatedItems.map(({ item, currentProduct }) =>
    createStockMovement(
      item.productId,
      'return',
      item.qty,
      currentProduct.quantity,
      `Void sale ${sale.invoiceNumber}: ${trimmedReason}`,
      userId,
      sale.id,
      currentProduct.warehouseId ?? item.warehouseId
    )
  );

  validatedItems.forEach(({ item }) => {
    if (item.batches?.length) {
      item.batches.forEach((batch) => restoreBatchQty(batch.batchId, batch.qtyFromBatch));
    }
  });

  const auditEntry = createVoidAudit(userId, sale.id, trimmedReason);

  return { voidedSale, auditEntry, stockMovements };
}

/** Mark an invoice as deleted (keeps sequence but invalidates it) */
export function deleteInvoice(
  sale: Sale,
  reason: string,
  userId: string
): {
  deletedSale: Sale;
  auditEntry: ReturnType<typeof createAuditEntry>;
} {
  if (sale.status === 'deleted') {
    throw new Error('Invoice is already deleted');
  }

  const deletedSale: Sale = {
    ...sale,
    status: 'deleted',
    voidedAt: new Date().toISOString(),
    voidReason: reason.trim(),
    voidedBy: userId,
  };

  const auditEntry = createAuditEntry(userId, 'sale_deleted' as any, 'sale', sale.id, null, {
    invoiceNumber: sale.invoiceNumber,
    reason: reason.trim() // Audit logs record the deleted invoice number
  });

  return { deletedSale, auditEntry };
}

/** Get cart totals — delegates to pure domain function */
export function getCartTotals(cart: CartItem[], invoiceDiscount: number) {
  return calcCartTotals(cart, invoiceDiscount);
}
