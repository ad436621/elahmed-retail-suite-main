// ============================================================
// Mock / Seed Data — Chart defaults & empty collections
// ============================================================
//
// NOTE: Types (Product, Sale) are defined in @/domain/types.
// Legacy categories are in @/data/categoriesData.
// ============================================================

import type { Sale } from '@/domain/types';

/** Default monthly chart data structure. */
export const monthlySalesData = [
  { month: 'Jan', revenue: 0, profit: 0 },
  { month: 'Feb', revenue: 0, profit: 0 },
  { month: 'Mar', revenue: 0, profit: 0 },
  { month: 'Apr', revenue: 0, profit: 0 },
  { month: 'May', revenue: 0, profit: 0 },
  { month: 'Jun', revenue: 0, profit: 0 },
  { month: 'Jul', revenue: 0, profit: 0 },
  { month: 'Aug', revenue: 0, profit: 0 },
  { month: 'Sep', revenue: 0, profit: 0 },
  { month: 'Oct', revenue: 0, profit: 0 },
  { month: 'Nov', revenue: 0, profit: 0 },
  { month: 'Dec', revenue: 0, profit: 0 },
];

/** Empty recent sales placeholder. */
export const recentSales: Sale[] = [];
