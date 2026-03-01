// ============================================================
// Devices & Device Accessories — Data Layer
// ============================================================

import { DeviceItem, DeviceAccessory } from '@/domain/types';
import { generateBarcode } from '@/domain/product';
import { addBatch } from './batchesData';
import { getStorageItem, setStorageItem } from '@/lib/localStorageHelper';

const DEVICES_KEY = 'gx_devices_v2';
const ACCESSORIES_KEY = 'gx_device_accessories';

// ─── Devices ─────────────────────────────────────────────────

export function getDevices(): DeviceItem[] {
    return getStorageItem<DeviceItem[]>(DEVICES_KEY, []);
}

export function saveDevices(items: DeviceItem[]): void {
    setStorageItem(DEVICES_KEY, items);
}

export function addDevice(item: Omit<DeviceItem, 'id' | 'createdAt' | 'updatedAt'>): DeviceItem {
    const all = getDevices();
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
            supplier: '',
            notes: 'رصيد افتتاحي (إضافة جديدة)',
        });
    }

    return newItem;
}

export function updateDevice(id: string, updates: Partial<DeviceItem>): void {
    saveDevices(getDevices().map(d =>
        d.id === id ? { ...d, ...updates, updatedAt: new Date().toISOString() } : d
    ));
}

export function deleteDevice(id: string): void {
    saveDevices(getDevices().filter(d => d.id !== id));
}

// ─── Device Accessories ───────────────────────────────────────

export function getDeviceAccessories(): DeviceAccessory[] {
    return getStorageItem<DeviceAccessory[]>(ACCESSORIES_KEY, []);
}

export function saveDeviceAccessories(items: DeviceAccessory[]): void {
    setStorageItem(ACCESSORIES_KEY, items);
}

export function addDeviceAccessory(item: Omit<DeviceAccessory, 'id' | 'createdAt' | 'updatedAt'>): DeviceAccessory {
    const all = getDeviceAccessories();
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
            supplier: '',
            notes: 'رصيد افتتاحي (إضافة جديدة)',
        });
    }

    return newItem;
}

export function updateDeviceAccessory(id: string, updates: Partial<DeviceAccessory>): void {
    saveDeviceAccessories(getDeviceAccessories().map(a =>
        a.id === id ? { ...a, ...updates, updatedAt: new Date().toISOString() } : a
    ));
}

export function deleteDeviceAccessory(id: string): void {
    saveDeviceAccessories(getDeviceAccessories().filter(a => a.id !== id));
}
