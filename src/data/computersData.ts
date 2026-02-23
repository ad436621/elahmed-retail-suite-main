// ============================================================
// Computers & Computer Accessories — Data Layer
// ============================================================

import { ComputerItem, ComputerAccessory } from '@/domain/types';

const COMPUTERS_KEY = 'gx_computers_v2';
const ACCESSORIES_KEY = 'gx_computer_accessories';

// ─── Computers ────────────────────────────────────────────────

export function getComputers(): ComputerItem[] {
    try {
        const raw = localStorage.getItem(COMPUTERS_KEY);
        return raw ? JSON.parse(raw) : [];
    } catch { return []; }
}

export function saveComputers(items: ComputerItem[]): void {
    localStorage.setItem(COMPUTERS_KEY, JSON.stringify(items));
}

export function addComputer(item: Omit<ComputerItem, 'id' | 'createdAt' | 'updatedAt'>): ComputerItem {
    const all = getComputers();
    const newItem: ComputerItem = {
        ...item,
        id: crypto.randomUUID(),
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
    };
    saveComputers([...all, newItem]);
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
    try {
        const raw = localStorage.getItem(ACCESSORIES_KEY);
        return raw ? JSON.parse(raw) : [];
    } catch { return []; }
}

export function saveComputerAccessories(items: ComputerAccessory[]): void {
    localStorage.setItem(ACCESSORIES_KEY, JSON.stringify(items));
}

export function addComputerAccessory(item: Omit<ComputerAccessory, 'id' | 'createdAt' | 'updatedAt'>): ComputerAccessory {
    const all = getComputerAccessories();
    const newItem: ComputerAccessory = {
        ...item,
        id: crypto.randomUUID(),
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
    };
    saveComputerAccessories([...all, newItem]);
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
