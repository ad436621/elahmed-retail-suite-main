// ============================================================
// Mobiles & Mobile Accessories — Data Layer
// ============================================================

import { MobileItem, MobileAccessory } from '@/domain/types';
import { generateBarcode } from '@/domain/product';
import { addBatch } from './batchesData';

const MOBILES_KEY = 'gx_mobiles_v2';
const ACCESSORIES_KEY = 'gx_mobile_accessories';

// ─── Mobiles ────────────────────────────────────────────────

export function getMobiles(): MobileItem[] {
    try {
        const raw = localStorage.getItem(MOBILES_KEY);
        return raw ? JSON.parse(raw) : [];
    } catch { return []; }
}

export function saveMobiles(items: MobileItem[]): void {
    localStorage.setItem(MOBILES_KEY, JSON.stringify(items));
}

export function addMobile(item: Omit<MobileItem, 'id' | 'createdAt' | 'updatedAt'>): MobileItem {
    const all = getMobiles();
    const newItem: MobileItem = {
        ...item,
        id: crypto.randomUUID(),
        barcode: item.barcode || generateBarcode(),
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
    };
    saveMobiles([...all, newItem]);

    // Register initial stock as a new FIFO batch
    if (newItem.quantity > 0) {
        addBatch({
            productId: newItem.id,
            inventoryType: 'mobile',
            productName: newItem.name,
            costPrice: newItem.newCostPrice || newItem.oldCostPrice || 0,
            salePrice: newItem.salePrice,
            quantity: newItem.quantity,
            remainingQty: newItem.quantity,
            purchaseDate: newItem.createdAt,
            supplier: newItem.supplier || '',
            notes: 'رصيد افتتاحي (إضافة جديدة)',
        });
    }

    return newItem;
}

export function updateMobile(id: string, updates: Partial<MobileItem>): void {
    saveMobiles(getMobiles().map(m =>
        m.id === id ? { ...m, ...updates, updatedAt: new Date().toISOString() } : m
    ));
}

export function deleteMobile(id: string): void {
    saveMobiles(getMobiles().filter(m => m.id !== id));
}

// ─── Mobile Accessories ──────────────────────────────────────

export function getMobileAccessories(): MobileAccessory[] {
    try {
        const raw = localStorage.getItem(ACCESSORIES_KEY);
        return raw ? JSON.parse(raw) : [];
    } catch { return []; }
}

export function saveMobileAccessories(items: MobileAccessory[]): void {
    localStorage.setItem(ACCESSORIES_KEY, JSON.stringify(items));
}

export function addMobileAccessory(item: Omit<MobileAccessory, 'id' | 'createdAt' | 'updatedAt'>): MobileAccessory {
    const all = getMobileAccessories();
    const newItem: MobileAccessory = {
        ...item,
        id: crypto.randomUUID(),
        barcode: item.barcode || generateBarcode(),
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
    };
    saveMobileAccessories([...all, newItem]);

    if (newItem.quantity > 0) {
        addBatch({
            productId: newItem.id,
            inventoryType: 'mobile_accessory',
            productName: newItem.name,
            costPrice: newItem.newCostPrice || newItem.oldCostPrice || 0,
            salePrice: newItem.salePrice,
            quantity: newItem.quantity,
            remainingQty: newItem.quantity,
            purchaseDate: newItem.createdAt,
            supplier: '',
            notes: 'رصيد افتتاحي (إضافة جديدة)',
        });
    }

    return newItem;
}

export function updateMobileAccessory(id: string, updates: Partial<MobileAccessory>): void {
    saveMobileAccessories(getMobileAccessories().map(a =>
        a.id === id ? { ...a, ...updates, updatedAt: new Date().toISOString() } : a
    ));
}

export function deleteMobileAccessory(id: string): void {
    saveMobileAccessories(getMobileAccessories().filter(a => a.id !== id));
}
