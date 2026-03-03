// ============================================================
// Computers & Computer Accessories — Data Layer
// ============================================================

import { ComputerItem, ComputerAccessory } from '@/domain/types';
import { generateBarcode } from '@/domain/product';
import { addBatch } from './batchesData';
import { getStorageItem, setStorageItem } from '@/lib/localStorageHelper';
import { STORAGE_KEYS } from '@/config';

const COMPUTERS_KEY = STORAGE_KEYS.COMPUTERS;
const ACCESSORIES_KEY = STORAGE_KEYS.COMPUTER_ACCESSORIES;

// ─── Computers ────────────────────────────────────────────────

export function getComputers(): ComputerItem[] {
    return getStorageItem<ComputerItem[]>(COMPUTERS_KEY, []);
}

export function saveComputers(items: ComputerItem[]): void {
    setStorageItem(COMPUTERS_KEY, items);
}

export function addComputer(item: Omit<ComputerItem, 'id' | 'createdAt' | 'updatedAt'>): ComputerItem {
    const all = getComputers();
    const newItem: ComputerItem = {
        ...item,
        id: crypto.randomUUID(),
        barcode: item.barcode || generateBarcode(),
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
    };
    saveComputers([...all, newItem]);

    if (newItem.quantity > 0) {
        addBatch({
            productId: newItem.id,
            inventoryType: 'computer',
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

export function updateComputer(id: string, updates: Partial<ComputerItem>): void {
    saveComputers(getComputers().map(c =>
        c.id === id ? { ...c, ...updates, updatedAt: new Date().toISOString() } : c
    ));
}

export function deleteComputer(id: string): void {
    saveComputers(getComputers().filter(c => c.id !== id));
}

// ─── Computer Accessories ─────────────────────────────────────

export function getComputerAccessories(): ComputerAccessory[] {
    return getStorageItem<ComputerAccessory[]>(ACCESSORIES_KEY, []);
}

export function saveComputerAccessories(items: ComputerAccessory[]): void {
    setStorageItem(ACCESSORIES_KEY, items);
}

export function addComputerAccessory(item: Omit<ComputerAccessory, 'id' | 'createdAt' | 'updatedAt'>): ComputerAccessory {
    const all = getComputerAccessories();
    const newItem: ComputerAccessory = {
        ...item,
        id: crypto.randomUUID(),
        barcode: item.barcode || generateBarcode(),
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
    };
    saveComputerAccessories([...all, newItem]);

    if (newItem.quantity > 0) {
        addBatch({
            productId: newItem.id,
            inventoryType: 'computer_accessory',
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

export function updateComputerAccessory(id: string, updates: Partial<ComputerAccessory>): void {
    saveComputerAccessories(getComputerAccessories().map(a =>
        a.id === id ? { ...a, ...updates, updatedAt: new Date().toISOString() } : a
    ));
}

export function deleteComputerAccessory(id: string): void {
    saveComputerAccessories(getComputerAccessories().filter(a => a.id !== id));
}
