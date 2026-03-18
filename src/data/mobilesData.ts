// ============================================================
// Mobiles & Mobile Accessories — Data Layer
// ============================================================

import { MobileItem, MobileAccessory, MobileSparePart } from '@/domain/types';
import { generateBarcode } from '@/domain/product';
import { addBatch } from './batchesData';
import { getStorageItem, setStorageItem } from '@/lib/localStorageHelper';
import { STORAGE_KEYS } from '@/config';

const MOBILES_KEY = STORAGE_KEYS.MOBILES;
const ACCESSORIES_KEY = STORAGE_KEYS.MOBILE_ACCESSORIES;
const SPARE_PARTS_KEY = STORAGE_KEYS.MOBILE_SPARE_PARTS;

// ─── Mobiles ────────────────────────────────────────────────

export function getMobiles(): MobileItem[] {
    return getStorageItem<MobileItem[]>(MOBILES_KEY, []);
}

export function saveMobiles(items: MobileItem[]): void {
    setStorageItem(MOBILES_KEY, items);
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
    return getStorageItem<MobileAccessory[]>(ACCESSORIES_KEY, []);
}

export function saveMobileAccessories(items: MobileAccessory[]): void {
    setStorageItem(ACCESSORIES_KEY, items);
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
            supplier: newItem.supplier || '',
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

// ─── Mobile Spare Parts ──────────────────────────────────────

export function getMobileSpareParts(): MobileSparePart[] {
    return getStorageItem<MobileSparePart[]>(SPARE_PARTS_KEY, []);
}

export function saveMobileSpareParts(items: MobileSparePart[]): void {
    setStorageItem(SPARE_PARTS_KEY, items);
}

export function addMobileSparePart(item: Omit<MobileSparePart, 'id' | 'createdAt' | 'updatedAt'>): MobileSparePart {
    const all = getMobileSpareParts();
    const newItem: MobileSparePart = {
        ...item,
        id: crypto.randomUUID(),
        barcode: item.barcode || generateBarcode(),
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
    };
    saveMobileSpareParts([...all, newItem]);

    if (newItem.quantity > 0) {
        addBatch({
            productId: newItem.id,
            inventoryType: 'mobile_spare_part',
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

export function updateMobileSparePart(id: string, updates: Partial<MobileSparePart>): void {
    saveMobileSpareParts(getMobileSpareParts().map(a =>
        a.id === id ? { ...a, ...updates, updatedAt: new Date().toISOString() } : a
    ));
}

export function deleteMobileSparePart(id: string): void {
    saveMobileSpareParts(getMobileSpareParts().filter(a => a.id !== id));
}
