// ============================================================
// Mobiles & Mobile Accessories — Data Layer
// ============================================================

import { MobileItem, MobileAccessory } from '@/domain/types';

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
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
    };
    saveMobiles([...all, newItem]);
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
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
    };
    saveMobileAccessories([...all, newItem]);
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
