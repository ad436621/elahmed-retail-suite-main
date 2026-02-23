export interface Product {
  id: string;
  name: string;
  model: string;
  barcode: string;
  category: string;
  supplier: string;
  costPrice: number;
  sellingPrice: number;
  quantity: number;
  createdAt: string;
}

export interface Sale {
  id: string;
  invoiceNumber: string;
  date: string;
  items: { productId: string; name: string; qty: number; price: number; cost: number }[];
  subtotal: number;
  discount: number;
  total: number;
  paymentMethod: 'cash' | 'card' | 'split';
  employee: string;
}

const CATEGORIES_KEY = 'elahmed-categories';

const DEFAULT_CATEGORIES = [
  'Phones', 'Accessories', 'Cases', 'Chargers', 'Cables', 'Headphones', 'Screen Protectors', 'Tablets',
];

export function getCategories(): string[] {
  try {
    const stored = localStorage.getItem(CATEGORIES_KEY);
    if (stored) return JSON.parse(stored);
  } catch (_e) { /* ignore */ }
  return [...DEFAULT_CATEGORIES];
}

export function saveCategories(cats: string[]) {
  localStorage.setItem(CATEGORIES_KEY, JSON.stringify(cats));
}

// Keep backward-compat export for existing code
export const categories = getCategories();

export const products: Product[] = [];

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

export const recentSales: Sale[] = [];
