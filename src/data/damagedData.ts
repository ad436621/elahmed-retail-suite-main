// ============================================================
// Damaged/Waste Items — Data Layer
// ============================================================

import { DamagedItem, DamagedItemCategory } from '@/domain/types';

const KEY = 'gx_damaged_items';

export function getDamagedItems(): DamagedItem[] {
    try {
        const raw = localStorage.getItem(KEY);
        return raw ? JSON.parse(raw) : [];
    } catch (e) {
        console.error('Failed to load damaged items:', e);
        return [];
    }
}

export function saveDamagedItems(items: DamagedItem[]): void {
    localStorage.setItem(KEY, JSON.stringify(items));
}

export function addDamagedItem(item: Omit<DamagedItem, 'id' | 'createdAt'>): DamagedItem {
    const all = getDamagedItems();
    const newItem: DamagedItem = {
        ...item,
        id: crypto.randomUUID(),
        createdAt: new Date().toISOString(),
    };
    saveDamagedItems([...all, newItem]);
    return newItem;
}

export function updateDamagedItem(id: string, updates: Partial<DamagedItem>): void {
    saveDamagedItems(getDamagedItems().map(d =>
        d.id === id ? { ...d, ...updates } : d
    ));
}

export function deleteDamagedItem(id: string): void {
    saveDamagedItems(getDamagedItems().filter(d => d.id !== id));
}

export function getTotalLossesThisMonth(): number {
    const items = getDamagedItems();
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    return items
        .filter(item => new Date(item.date) >= startOfMonth)
        .reduce((sum, item) => sum + item.totalLoss, 0);
}
