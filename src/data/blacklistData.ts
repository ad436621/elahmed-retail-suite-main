// ============================================================
// Blacklist Data Layer — IMEI & Device Blacklist
// ============================================================

import { getStorageItem, setStorageItem } from '@/lib/localStorageHelper';
import { STORAGE_KEYS } from '@/config';

const KEY = STORAGE_KEYS.BLACKLIST;



// ─── Types ──────────────────────────────────────────────────

export type BlacklistReason = 'stolen' | 'lost' | 'fraud' | 'other';

export interface BlacklistedDevice {
    id: string;
    imei: string;
    deviceName: string;
    ownerName?: string;
    ownerPhone?: string;
    reason: BlacklistReason;
    reportedDate: string;
    status: 'active' | 'resolved';
    notes?: string;
    createdBy: string;
    createdAt: string;
    updatedAt: string;
}

export const REASON_LABELS: Record<BlacklistReason, string> = {
    stolen: 'مسروق',
    lost: 'مفقود',
    fraud: 'احتيال',
    other: 'أخرى',
};

// ─── CRUD ────────────────────────────────────────────────────

export function getBlacklist(): BlacklistedDevice[] {
    return getStorageItem<BlacklistedDevice[]>(KEY, []);
}

export function saveBlacklist(list: BlacklistedDevice[]): void {
    setStorageItem(KEY, list);
}

export function addToBlacklist(data: Omit<BlacklistedDevice, 'id' | 'createdAt' | 'updatedAt'>): BlacklistedDevice {
    const entry: BlacklistedDevice = {
        ...data,
        id: crypto.randomUUID(),
        imei: data.imei.replace(/\s/g, ''),
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
    };
    saveBlacklist([...getBlacklist(), entry]);
    return entry;
}

export function updateBlacklistEntry(id: string, data: Partial<BlacklistedDevice>): void {
    saveBlacklist(getBlacklist().map(e =>
        e.id === id ? { ...e, ...data, updatedAt: new Date().toISOString() } : e
    ));
}

export function removeFromBlacklist(id: string): void {
    saveBlacklist(getBlacklist().filter(e => e.id !== id));
}

/** Returns the blacklist entry if IMEI is found and active, null otherwise */
export function checkIMEI(imei: string): BlacklistedDevice | null {
    const clean = imei.replace(/\s/g, '');
    if (!clean) return null;
    return getBlacklist().find(e => e.imei === clean && e.status === 'active') ?? null;
}
