// ============================================================
// Stocktake Data Layer
// ============================================================

import { getStorageItem, setStorageItem } from '@/lib/localStorageHelper';

const KEY = 'gx_stocktakes';

function genId(prefix = 'stk') {
    return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
}

// ─── Types ──────────────────────────────────────────────────

export type WarehouseType = 'mobiles' | 'accessories' | 'devices' | 'computers' | 'cars' | 'all';
export type StocktakeStatus = 'draft' | 'in_progress' | 'completed';

export interface StocktakeItem {
    id: string;
    stocktakeId: string;
    itemName: string;
    barcode?: string;
    systemQuantity: number;
    countedQuantity: number;
    unitCost: number;
    varianceReason?: string;
    notes?: string;
}

export interface Stocktake {
    id: string;
    stocktakeNo: string;
    warehouseType: WarehouseType;
    status: StocktakeStatus;
    totalItems: number;
    countedItems: number;
    varianceItems: number;
    totalVarianceValue: number;
    startedAt: string;
    completedAt?: string;
    createdBy: string;
    notes?: string;
    items: StocktakeItem[];
    createdAt: string;
}

export const WAREHOUSE_LABELS: Record<WarehouseType, string> = {
    mobiles: 'الموبايلات',
    accessories: 'الإكسسوارات',
    devices: 'الأجهزة',
    computers: 'الكمبيوترات',
    cars: 'السيارات',
    all: 'كل المخزون',
};

// ─── CRUD ───────────────────────────────────────────────────

export function getStocktakes(): Stocktake[] {
    return getStorageItem<Stocktake[]>(KEY, []);
}

function save(stocktakes: Stocktake[]): void {
    setStorageItem(KEY, stocktakes);
}

export function createStocktake(data: { warehouseType: WarehouseType; createdBy: string; notes?: string }): Stocktake {
    const all = getStocktakes();
    const stk: Stocktake = {
        id: genId(),
        stocktakeNo: `STK-${String(all.length + 1).padStart(4, '0')}`,
        warehouseType: data.warehouseType,
        status: 'in_progress',
        totalItems: 0,
        countedItems: 0,
        varianceItems: 0,
        totalVarianceValue: 0,
        startedAt: new Date().toISOString(),
        createdBy: data.createdBy,
        notes: data.notes,
        items: [],
        createdAt: new Date().toISOString(),
    };
    save([...all, stk]);
    return stk;
}

export function updateStocktake(id: string, data: Partial<Stocktake>): void {
    save(getStocktakes().map(s => s.id === id ? { ...s, ...data } : s));
}

export function saveStocktakeItems(stocktakeId: string, items: StocktakeItem[]): void {
    const varianceItems = items.filter(i => i.countedQuantity !== i.systemQuantity).length;
    const totalVarianceValue = items.reduce((sum, i) => {
        const diff = i.countedQuantity - i.systemQuantity;
        return sum + Math.abs(diff) * i.unitCost;
    }, 0);
    updateStocktake(stocktakeId, {
        items,
        totalItems: items.length,
        countedItems: items.filter(i => i.countedQuantity >= 0).length,
        varianceItems,
        totalVarianceValue,
    });
}

export function completeStocktake(id: string): void {
    updateStocktake(id, { status: 'completed', completedAt: new Date().toISOString() });
}

// ─── Snapshot Builder ────────────────────────────────────────

/** Reads items from relevant localStorage keys and builds a snapshot for counting */
export function buildInventorySnapshot(type: WarehouseType): Omit<StocktakeItem, 'stocktakeId' | 'countedQuantity' | 'varianceReason'>[] {
    const items: Omit<StocktakeItem, 'stocktakeId' | 'countedQuantity' | 'varianceReason'>[] = [];

    const readItems = (key: string, mapFn: (item: Record<string, unknown>) => Omit<StocktakeItem, 'stocktakeId' | 'countedQuantity' | 'varianceReason'> | null) => {
        try {
            const raw: Record<string, unknown>[] = JSON.parse(localStorage.getItem(key) || '[]');
            raw.forEach(item => {
                const mapped = mapFn(item);
                if (mapped) items.push(mapped);
            });
        } catch { /* ignore invalid storage */ }
    };

    if (type === 'mobiles' || type === 'all') {
        readItems('gx_mobiles', (m) => m.name ? { id: genId('si'), itemName: String(m.name), barcode: String(m.barcode ?? ''), systemQuantity: Number(m.quantity ?? 0), unitCost: Number(m.costPrice ?? 0), notes: '' } : null);
    }
    if (type === 'accessories' || type === 'all') {
        readItems('gx_mobile_accessories', (m) => m.name ? { id: genId('si'), itemName: String(m.name), systemQuantity: Number(m.quantity ?? 0), unitCost: Number(m.costPrice ?? 0), notes: '' } : null);
    }
    if (type === 'devices' || type === 'all') {
        readItems('gx_devices', (m) => m.name ? { id: genId('si'), itemName: String(m.name), systemQuantity: Number(m.quantity ?? 0), unitCost: Number(m.costPrice ?? 0), notes: '' } : null);
    }
    if (type === 'computers' || type === 'all') {
        readItems('gx_computers', (m) => m.name ? { id: genId('si'), itemName: String(m.name), systemQuantity: Number(m.quantity ?? 0), unitCost: Number(m.costPrice ?? 0), notes: '' } : null);
    }
    if (type === 'cars' || type === 'all') {
        readItems('gx_cars', (m) => m.name ? { id: genId('si'), itemName: `${String(m.name)} ${String(m.model ?? '')}`.trim(), systemQuantity: 1, unitCost: Number(m.purchasePrice ?? 0), notes: '' } : null);
    }

    return items;
}
