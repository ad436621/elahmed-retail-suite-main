export function normalizeCostPrice(costPrice?: number, fallbackCostPrice?: number): number {
  if (typeof costPrice === 'number' && Number.isFinite(costPrice) && costPrice > 0) {
    return costPrice;
  }

  if (typeof fallbackCostPrice === 'number' && Number.isFinite(fallbackCostPrice) && fallbackCostPrice > 0) {
    return fallbackCostPrice;
  }

  if (typeof costPrice === 'number' && Number.isFinite(costPrice)) {
    return costPrice;
  }

  if (typeof fallbackCostPrice === 'number' && Number.isFinite(fallbackCostPrice)) {
    return fallbackCostPrice;
  }

  return 0;
}

export function calculateProfitAmount(costPrice: number, salePrice: number): number {
  return salePrice - costPrice;
}

export function calculateMarginPercent(costPrice: number, salePrice: number): number {
  if (salePrice <= 0) return 0;
  return (calculateProfitAmount(costPrice, salePrice) / salePrice) * 100;
}

export function calculateSalePriceFromProfit(costPrice: number, profitAmount: number): number {
  return costPrice + profitAmount;
}

export function getMarginTone(marginPercent: number): string {
  if (marginPercent >= 20) return 'text-emerald-600';
  if (marginPercent >= 10) return 'text-amber-600';
  return 'text-red-500';
}
