// ============================================================
// Monthly Reset & Archive — Data Layer
// ============================================================
// Logic:
//  • Each section (sales, maintenance, expenses, etc.) stores data normally — no data is deleted.
//  • On the configured reset day each month, the Dashboard's "current period" view resets.
//  • Past periods are stored in the archive so the user can browse history.
//  • If resetDay = 0, auto-reset is disabled (user only sees all-time totals).

export interface MonthlyResetSettings {
    resetDay: number;       // 1–31 (day of month). 0 = disabled
    lastResetDate: string;  // ISO date of the last reset e.g. "2026-02-01"
}

export interface MonthlyArchiveEntry {
    id: string;             // e.g. "2026-02"
    label: string;          // e.g. "فبراير 2026"
    periodStart: string;    // ISO date
    periodEnd: string;      // ISO date
    archivedAt: string;     // ISO timestamp
    snapshot: Record<string, unknown>; // arbitrary stats snapshot
}

import { getStorageItem, setStorageItem } from '@/lib/localStorageHelper';
import { STORAGE_KEYS } from '@/config';

const RESET_SETTINGS_KEY = STORAGE_KEYS.MONTHLY_RESET_SETTINGS;
const MONTHLY_ARCHIVE_KEY = STORAGE_KEYS.MONTHLY_ARCHIVE;

// ─── Settings ───────────────────────────────────────────────

export function getMonthlyResetSettings(): MonthlyResetSettings {
    return getStorageItem<MonthlyResetSettings>(RESET_SETTINGS_KEY, { resetDay: 1, lastResetDate: '' });
}

export function saveMonthlyResetSettings(s: MonthlyResetSettings): void {
    setStorageItem(RESET_SETTINGS_KEY, s);
}

// ─── Archive ────────────────────────────────────────────────

export function getMonthlyArchive(): MonthlyArchiveEntry[] {
    return getStorageItem<MonthlyArchiveEntry[]>(MONTHLY_ARCHIVE_KEY, []);
}

function saveMonthlyArchive(entries: MonthlyArchiveEntry[]): void {
    setStorageItem(MONTHLY_ARCHIVE_KEY, entries);
}

/** Archive the current period stats and record the new reset date */
export function archiveCurrentPeriod(snapshot: Record<string, unknown>): void {
    const settings = getMonthlyResetSettings();
    const now = new Date();
    const monthKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    const label = now.toLocaleDateString('ar-EG', { year: 'numeric', month: 'long' });

    const entry: MonthlyArchiveEntry = {
        id: monthKey,
        label,
        periodStart: settings.lastResetDate || monthKey + '-01',
        periodEnd: now.toISOString().slice(0, 10),
        archivedAt: now.toISOString(),
        snapshot,
    };

    const archive = getMonthlyArchive();
    // Replace if same month already archived
    const idx = archive.findIndex(e => e.id === monthKey);
    if (idx >= 0) archive[idx] = entry; else archive.unshift(entry);
    saveMonthlyArchive(archive);

    // Update lastResetDate
    saveMonthlyResetSettings({ ...settings, lastResetDate: now.toISOString().slice(0, 10) });
}

/** Returns true if today is the configured reset day and we haven't reset yet this cycle */
export function shouldAutoReset(): boolean {
    const settings = getMonthlyResetSettings();
    if (!settings.resetDay) return false; // disabled

    const now = new Date();
    const currentDay = now.getDate();
    const lastDayOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();

    // Target day is either the setting or the last day if the month is shorter (e.g., Feb)
    const targetDay = Math.min(settings.resetDay, lastDayOfMonth);

    if (currentDay !== targetDay) return false;

    // Check if we already ran today
    if (settings.lastResetDate === now.toISOString().slice(0, 10)) return false;

    return true;
}

// ─── ALL DATA KEYS (for "Clear All Data") ───────────────────

export const ALL_DATA_KEYS = [
    STORAGE_KEYS.MOBILES,
    STORAGE_KEYS.MOBILE_ACCESSORIES,
    STORAGE_KEYS.DEVICES,
    STORAGE_KEYS.DEVICE_ACCESSORIES,
    STORAGE_KEYS.COMPUTERS,
    STORAGE_KEYS.COMPUTER_ACCESSORIES,
    STORAGE_KEYS.USED_DEVICES,
    STORAGE_KEYS.MAINTENANCE,
    STORAGE_KEYS.EXPENSES,
    STORAGE_KEYS.INSTALLMENTS,
    STORAGE_KEYS.SALES_LEGACY,
    STORAGE_KEYS.PRODUCTS,
    STORAGE_KEYS.LEGACY_CATEGORIES,
    STORAGE_KEYS.RETURNS,
    MONTHLY_ARCHIVE_KEY,
    RESET_SETTINGS_KEY,
];

export function clearAllData(): void {
    ALL_DATA_KEYS.forEach(key => localStorage.removeItem(key));
    // Keep app_settings (company name etc.) intact
}
