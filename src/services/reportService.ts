// ============================================================
// ELAHMED RETAIL OS — Report & Analytics Service
// Smart local analytics: predictions, patterns, dead stock
// ============================================================

import { Product, Sale } from '@/domain/types';
import { predictDepletionDays } from '@/domain/stock';
import { detectAbnormalDiscounts } from '@/domain/discount';

/** Predict stock depletion for all products */
export function getStockDepletionReport(
  products: Product[],
  sales: Sale[],
  daysOfHistory: number = 30
): Array<{ product: Product; depletionDays: number | null; suggestedReorderDate: string | null }> {
  return products.map(product => {
    // Calculate avg daily sales from history
    const totalSold = sales.reduce((sum, sale) => {
      return sum + sale.items
        .filter(i => i.productId === product.id)
        .reduce((s, i) => s + i.qty, 0);
    }, 0);

    const avgDailySales = totalSold / Math.max(daysOfHistory, 1);
    const depletionDays = predictDepletionDays(product.quantity, avgDailySales);

    let suggestedReorderDate: string | null = null;
    if (depletionDays !== null && depletionDays <= 14) {
      const reorderDate = new Date();
      reorderDate.setDate(reorderDate.getDate() + Math.max(0, depletionDays - 3));
      suggestedReorderDate = reorderDate.toISOString().split('T')[0];
    }

    return { product, depletionDays, suggestedReorderDate };
  });
}

/** Identify peak sales hours from sale timestamps */
export function getPeakHours(sales: Sale[]): Array<{ hour: number; count: number; revenue: number }> {
  const hourMap = new Map<number, { count: number; revenue: number }>();

  for (let h = 0; h < 24; h++) {
    hourMap.set(h, { count: 0, revenue: 0 });
  }

  sales.forEach(sale => {
    const hour = new Date(sale.date).getHours();
    const entry = hourMap.get(hour)!;
    entry.count++;
    entry.revenue += sale.total;
  });

  return Array.from(hourMap.entries())
    .map(([hour, data]) => ({ hour, ...data }))
    .sort((a, b) => b.revenue - a.revenue);
}

/** Detect dead stock — products with zero sales in N days */
export function getDeadStock(
  products: Product[],
  sales: Sale[],
  deadThresholdDays: number = 30
): Product[] {
  const soldProductIds = new Set<string>();
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - deadThresholdDays);

  sales
    .filter(s => new Date(s.date) >= cutoffDate)
    .forEach(s => s.items.forEach(i => soldProductIds.add(i.productId)));

  return products.filter(p => !soldProductIds.has(p.id) && p.quantity > 0);
}

/** Analyze discount patterns for fraud detection */
export function getDiscountAnalysis(sales: Sale[]) {
  const discountAmounts = sales.filter(s => s.discount > 0).map(s => s.discount);
  const analysis = detectAbnormalDiscounts(discountAmounts);

  const highDiscountSales = sales
    .filter(s => s.subtotal > 0 && (s.discount / s.subtotal) * 100 > 15)
    .map(s => ({
      invoiceNumber: s.invoiceNumber,
      discountPct: Math.round((s.discount / s.subtotal) * 100),
      employee: s.employee,
    }));

  return { ...analysis, highDiscountSales };
}

/** Top products by revenue */
export function getTopProducts(
  products: Product[],
  sales: Sale[],
  limit: number = 10
): Array<{ product: Product; totalRevenue: number; totalQtySold: number }> {
  const revenueMap = new Map<string, { revenue: number; qty: number }>();

  sales.forEach(sale => {
    sale.items.forEach(item => {
      const existing = revenueMap.get(item.productId) || { revenue: 0, qty: 0 };
      existing.revenue += item.price * item.qty;
      existing.qty += item.qty;
      revenueMap.set(item.productId, existing);
    });
  });

  return products
    .map(p => {
      const data = revenueMap.get(p.id) || { revenue: 0, qty: 0 };
      return { product: p, totalRevenue: data.revenue, totalQtySold: data.qty };
    })
    .sort((a, b) => b.totalRevenue - a.totalRevenue)
    .slice(0, limit);
}

/** Worst performing products (by margin or sales volume) */
export function getWorstProducts(
  products: Product[],
  sales: Sale[],
  limit: number = 10
): Array<{ product: Product; totalRevenue: number; totalQtySold: number }> {
  const topAll = getTopProducts(products, sales, products.length);
  return topAll.slice(-limit).reverse();
}
