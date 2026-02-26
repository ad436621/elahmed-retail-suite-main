// ============================================================
// Devices & Device Accessories — Data Layer
// ============================================================

import { DeviceItem, DeviceAccessory } from '@/domain/types';
import { generateBarcode } from '@/domain/product';

const DEVICES_KEY = 'gx_devices_v2';
const ACCESSORIES_KEY = 'gx_device_accessories';

// ─── Devices ─────────────────────────────────────────────────

export function getDevices(): DeviceItem[] {
    try {
        const raw = localStorage.getItem(DEVICES_KEY);
        return raw ? JSON.parse(raw) : [];
    } catch { return []; }
}

export function saveDevices(items: DeviceItem[]): void {
    localStorage.setItem(DEVICES_KEY, JSON.stringify(items));
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
    try {
        const raw = localStorage.getItem(ACCESSORIES_KEY);
        return raw ? JSON.parse(raw) : [];
    } catch { return []; }
}

export function saveDeviceAccessories(items: DeviceAccessory[]): void {
    localStorage.setItem(ACCESSORIES_KEY, JSON.stringify(items));
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
