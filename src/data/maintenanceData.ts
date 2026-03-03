// ============================================================
// Maintenance Orders — Data Layer
// ============================================================

import { MaintenanceOrder } from '@/domain/types';
import { getStorageItem, setStorageItem } from '@/lib/localStorageHelper';
import { STORAGE_KEYS } from '@/config';

const KEY = STORAGE_KEYS.MAINTENANCE;

export function getMaintenanceOrders(): MaintenanceOrder[] {
    return getStorageItem<MaintenanceOrder[]>(KEY, []);
}

export function saveMaintenanceOrders(orders: MaintenanceOrder[]): void {
    setStorageItem(KEY, orders);
}

export function addMaintenanceOrder(
    order: Omit<MaintenanceOrder, 'id' | 'orderNumber' | 'totalCost' | 'totalSale' | 'netProfit' | 'createdAt' | 'updatedAt'>
): MaintenanceOrder {
    const all = getMaintenanceOrders();
    const totalCost = order.spareParts.reduce((s, p) => s + p.costPrice, 0);
    const totalSale = order.spareParts.reduce((s, p) => s + p.salePrice, 0);
    const newOrder: MaintenanceOrder = {
        ...order,
        id: crypto.randomUUID(),
        orderNumber: `MNT-${(all.length + 1).toString().padStart(4, '0')}`,
        totalCost,
        totalSale,
        netProfit: totalSale - totalCost,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
    };
    saveMaintenanceOrders([...all, newOrder]);
    return newOrder;
}

export function updateMaintenanceOrder(id: string, updates: Partial<MaintenanceOrder>): void {
    const all = getMaintenanceOrders();
    saveMaintenanceOrders(all.map(o => {
        if (o.id !== id) return o;
        const merged = { ...o, ...updates, updatedAt: new Date().toISOString() };
        // Recalculate totals if spareParts changed
        if (updates.spareParts) {
            merged.totalCost = updates.spareParts.reduce((s, p) => s + p.costPrice, 0);
            merged.totalSale = updates.spareParts.reduce((s, p) => s + p.salePrice, 0);
            merged.netProfit = merged.totalSale - merged.totalCost;
        }
        return merged;
    }));
}

export function deleteMaintenanceOrder(id: string): void {
    saveMaintenanceOrders(getMaintenanceOrders().filter(o => o.id !== id));
}
