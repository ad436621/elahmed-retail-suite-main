// ============================================================
// Warehouse — Data Layer
// ============================================================

import { WarehouseItem } from '@/domain/types';
import { getStorageItem, setStorageItem } from '@/lib/localStorageHelper';
import { STORAGE_KEYS } from '@/config';

const KEY = STORAGE_KEYS.WAREHOUSE;

export function getWarehouseItems(): WarehouseItem[] {
    return getStorageItem<WarehouseItem[]>(KEY, []);
}

export function saveWarehouseItems(items: WarehouseItem[]): void {
    setStorageItem(KEY, items);
}

export function addWarehouseItem(item: Omit<WarehouseItem, 'id' | 'createdAt' | 'updatedAt'>): WarehouseItem {
    const all = getWarehouseItems();
    const newItem: WarehouseItem = {
        ...item,
        id: crypto.randomUUID(),
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
    };
    saveWarehouseItems([...all, newItem]);
    return newItem;
}

export function updateWarehouseItem(id: string, updates: Partial<WarehouseItem>): void {
    saveWarehouseItems(getWarehouseItems().map(w =>
        w.id === id ? { ...w, ...updates, updatedAt: new Date().toISOString() } : w
    ));
}

export function deleteWarehouseItem(id: string): void {
    saveWarehouseItems(getWarehouseItems().filter(w => w.id !== id));
}

export function getWarehouseCategories(): string[] {
    const items = getWarehouseItems();
    const categories = new Set(items.map(i => i.category).filter(Boolean));
    return Array.from(categories);
}

export function getWarehouseCapital(): number {
    return getWarehouseItems().reduce((sum, item) => sum + (item.costPrice * item.quantity), 0);
}
