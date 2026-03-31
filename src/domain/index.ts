// ============================================================
// Domain Layer — Barrel Export
// Import everything domain-related from here
// ============================================================

// Types
export type {
    UserRole, User, Product, CartItem, PaymentMethod, SaleItem, Sale,
    StockMovementType, StockMovement, AuditAction, AuditEntry, DiscountRule,
    PriceHistoryEntry, BatchInventoryType, ProductBatch, BatchSaleResult,
    MobileDeviceType, MobileItem, MobileAccessory,
} from './types';

// Sale domain
export { buildSaleRecord, calcLineTotal, calcLineCost, calcCartTotals, SaleError } from './sale';

// Discount domain
export { validateLineDiscount, validateInvoiceDiscount, getDiscountLimits, detectAbnormalDiscounts, DiscountError } from './discount';

// Stock domain
export { validateStock, calculateNewQuantity, createStockMovement, applyStockMovement, isLowStock, predictDepletionDays, StockError } from './stock';

// Batch FIFO domain
export { calculateFIFOSale, commitFIFOSaleFromBatches, bulkCommitFIFOSales, getActiveSalePrice, getOldestCostPrice, getAvailableBatchesCount, BatchError } from './batchLogic';

// Returns domain
export { processReturn, ReturnError, calculateAlreadyReturnedQty } from './returns';
export type { ReturnRecord, ReturnItem } from './returns';

// Audit domain
export { createAuditEntry } from './audit';

// Product domain
export { validateProduct, formatProductForDisplay } from './product';
