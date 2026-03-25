// ============================================================
// Devices & Device Accessories — Data Layer
// ============================================================

import { DeviceItem, DeviceAccessory } from '@/domain/types';
import { generateBarcode } from '@/domain/product';
import { addBatch } from './batchesData';
import { getStorageItem, setStorageItem } from '@/lib/localStorageHelper';
import { STORAGE_KEYS } from '@/config';

const DEVICES_KEY = STORAGE_KEYS.DEVICES;
const ACCESSORIES_KEY = STORAGE_KEYS.DEVICE_ACCESSORIES;

// ─── Devices ─────────────────────────────────────────────────

export function getDevices(): DeviceItem[] {
    return getStorageItem<DeviceItem[]>(DEVICES_KEY, []).filter(d => !d.isArchived && !d.deletedAt);
}

export function saveDevices(items: DeviceItem[]): void {
    setStorageItem(DEVICES_KEY, items);
}

export function addDevice(item: Omit<DeviceItem, 'id' | 'createdAt' | 'updatedAt'>): DeviceItem {
    const all = getStorageItem<DeviceItem[]>(DEVICES_KEY, []);
    const newItem: DeviceItem = {
        ...item,
        id: crypto.randomUUID(),
        barcode: item.barcode || generateBarcode(),
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
    };
    saveDevices([...all, newItem]);

    if (newItem.quantity > 0) {
        addBatch({
            productId: newItem.id,
            inventoryType: 'device',
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

export function updateDevice(id: string, updates: Partial<DeviceItem>): void {
    const all = getStorageItem<DeviceItem[]>(DEVICES_KEY, []);
    saveDevices(all.map(d =>
        d.id === id ? { ...d, ...updates, updatedAt: new Date().toISOString() } : d
    ));
}

export function deleteDevice(id: string): void {
    const all = getStorageItem<DeviceItem[]>(DEVICES_KEY, []);
    saveDevices(all.map(d =>
        d.id === id ? { ...d, isArchived: true, deletedAt: new Date().toISOString() } : d
    ));
}

// ─── Device Accessories ───────────────────────────────────────

export function getDeviceAccessories(): DeviceAccessory[] {
    return getStorageItem<DeviceAccessory[]>(ACCESSORIES_KEY, []).filter(a => !a.isArchived && !a.deletedAt);
}

export function saveDeviceAccessories(items: DeviceAccessory[]): void {
    setStorageItem(ACCESSORIES_KEY, items);
}

export function addDeviceAccessory(item: Omit<DeviceAccessory, 'id' | 'createdAt' | 'updatedAt'>): DeviceAccessory {
    const all = getStorageItem<DeviceAccessory[]>(ACCESSORIES_KEY, []);
    const newItem: DeviceAccessory = {
        ...item,
        id: crypto.randomUUID(),
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
    };
    saveDeviceAccessories([...all, newItem]);

    if (newItem.quantity > 0) {
        addBatch({
            productId: newItem.id,
            inventoryType: 'device_accessory',
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

export function updateDeviceAccessory(id: string, updates: Partial<DeviceAccessory>): void {
    const all = getStorageItem<DeviceAccessory[]>(ACCESSORIES_KEY, []);
    saveDeviceAccessories(all.map(a =>
        a.id === id ? { ...a, ...updates, updatedAt: new Date().toISOString() } : a
    ));
}

export function deleteDeviceAccessory(id: string): void {
    const all = getStorageItem<DeviceAccessory[]>(ACCESSORIES_KEY, []);
    saveDeviceAccessories(all.map(a =>
        a.id === id ? { ...a, isArchived: true, deletedAt: new Date().toISOString() } : a
    ));
}
