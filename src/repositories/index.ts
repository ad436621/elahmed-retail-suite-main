// ============================================================
// Repositories Layer — Barrel Export
// ============================================================

export { getAllSales, saveSale, voidSale } from './saleRepository';
export { getProductById, getAllProducts, saveProduct, deleteProduct } from './productRepository';
export { addAuditEntry, getAuditLog } from './auditRepository';
export { addStockMovement } from './stockRepository';
