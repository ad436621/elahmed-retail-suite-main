// ============================================================
// Other Revenue — Data Layer
// ============================================================

import { OtherRevenue } from '@/domain/types';
import { getStorageItem, setStorageItem } from '@/lib/localStorageHelper';
import { STORAGE_KEYS } from '@/config';

const KEY = STORAGE_KEYS.OTHER_REVENUE;

export function getOtherRevenues(): OtherRevenue[] {
    return getStorageItem<OtherRevenue[]>(KEY, []);
}

export function saveOtherRevenues(items: OtherRevenue[]): void {
    setStorageItem(KEY, items);
}

export function addOtherRevenue(item: Omit<OtherRevenue, 'id' | 'createdAt'>): OtherRevenue {
    const all = getOtherRevenues();
    const newItem: OtherRevenue = {
        ...item,
        id: crypto.randomUUID(),
        createdAt: new Date().toISOString(),
    };
    saveOtherRevenues([...all, newItem]);
    return newItem;
}

export function updateOtherRevenue(id: string, updates: Partial<OtherRevenue>): void {
    saveOtherRevenues(getOtherRevenues().map(r =>
        r.id === id ? { ...r, ...updates } : r
    ));
}

export function deleteOtherRevenue(id: string): void {
    saveOtherRevenues(getOtherRevenues().filter(r => r.id !== id));
}

export function getOtherRevenueCategories(): string[] {
    const items = getOtherRevenues();
    const categories = new Set(items.map(i => i.category).filter(Boolean));
    return Array.from(categories);
}

export function getTotalOtherRevenueThisMonth(): number {
    const items = getOtherRevenues();
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    return items
        .filter(item => new Date(item.date) >= startOfMonth)
        .reduce((sum, item) => sum + item.amount, 0);
}
