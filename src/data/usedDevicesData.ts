// ============================================================
// Used Devices — Data Layer
// ============================================================

import { UsedDevice } from '@/domain/types';

const KEY = 'gx_used_devices';

export function getUsedDevices(): UsedDevice[] {
    try {
        const raw = localStorage.getItem(KEY);
        return raw ? JSON.parse(raw) : [];
    } catch { return []; }
}

export function saveUsedDevices(items: UsedDevice[]): void {
    localStorage.setItem(KEY, JSON.stringify(items));
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
