import { Sale } from '@/domain/types';

export type SalesSummary = {
  totalRevenue: number;
  totalProfit: number;
  totalItems: number;
  avgInvoice: number;
  profitMarginPercent: number;
  returnRatePercent: number;
};

export function isVoidedSale(sale: Sale): boolean {
  return !!sale.voidedAt;
}

export function filterActiveSales(sales: Sale[]): Sale[] {
  return sales.filter(sale => !isVoidedSale(sale));
}

export function sumSaleRevenue(sales: Sale[]): number {
  return sales.reduce((acc, sale) => acc + (sale.total || 0), 0);
}

export function sumSaleProfit(sales: Sale[]): number {
  return sales.reduce((acc, sale) => acc + (sale.grossProfit || 0), 0);
}

export function summarizeSales(sales: Sale[], injuredAmount: number = 0, damagedAmount: number = 0): SalesSummary {
  const activeSales = filterActiveSales(sales);
  const totalRevenue = sumSaleRevenue(activeSales);
  const totalProfit = sumSaleProfit(activeSales);
  const totalItems = activeSales.length;
  const avgInvoice = totalItems > 0 ? totalRevenue / totalItems : 0;
  const profitMarginPercent = totalRevenue > 0 ? (totalProfit / totalRevenue) * 100 : 0;
  const returnRatePercent = totalRevenue > 0 ? (damagedAmount / totalRevenue) * 100 : 0;

  return {
    totalRevenue,
    totalProfit,
    totalItems,
    avgInvoice,
    profitMarginPercent,
    returnRatePercent,
  };
}

export function inDateRange(dateStr: string | undefined, from: string, to: string): boolean {
  if (!dateStr) return false;
  const d = dateStr.slice(0, 10);
  return d >= from && d <= to;
}

export function filterSalesByDateRange(sales: Sale[], from: string, to: string): Sale[] {
  return sales.filter(sale => inDateRange(sale.date, from, to));
}
