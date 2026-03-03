// ============================================================
// Used Devices — Data Layer
// ============================================================

import { UsedDevice } from '@/domain/types';
import { addBatch } from './batchesData';
import { getStorageItem, setStorageItem } from '@/lib/localStorageHelper';
import { STORAGE_KEYS } from '@/config';

const KEY = STORAGE_KEYS.USED_DEVICES;

export function getUsedDevices(): UsedDevice[] {
    return getStorageItem<UsedDevice[]>(KEY, []);
}

export function saveUsedDevices(items: UsedDevice[]): void {
    setStorageItem(KEY, items);
}

export function addUsedDevice(item: Omit<UsedDevice, 'id' | 'createdAt' | 'updatedAt'>): UsedDevice {
    const all = getUsedDevices();
    const newItem: UsedDevice = {
        ...item,
        id: crypto.randomUUID(),
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
    };
    saveUsedDevices([...all, newItem]);

    // Add batch for the used device
    addBatch({
        productId: newItem.id,
        inventoryType: 'used_device',
        productName: newItem.name,
        costPrice: newItem.purchasePrice,
        salePrice: newItem.salePrice,
        quantity: 1, // Used devices are tracked individually (qty 1 per entry)
        remainingQty: 1,
        purchaseDate: newItem.createdAt,
        supplier: '',
        notes: `مُرحَّل - سيريال ${newItem.serialNumber}`,
    });

    return newItem;
}

export function updateUsedDevice(id: string, updates: Partial<UsedDevice>): void {
    saveUsedDevices(getUsedDevices().map(d =>
        d.id === id ? { ...d, ...updates, updatedAt: new Date().toISOString() } : d
    ));
}

export function deleteUsedDevice(id: string): void {
    saveUsedDevices(getUsedDevices().filter(d => d.id !== id));
}
