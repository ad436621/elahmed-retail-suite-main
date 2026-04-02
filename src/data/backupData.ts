// ============================================================
// Backup & Restore — Data Layer
// ============================================================

export interface BackupSettings {
    autoBackupEnabled: boolean;
    intervalHours: number; // e.g. 1, 6, 12, 24
    lastBackupDate: string | null;
}

const BACKUP_SETTINGS_KEY = 'gx_backup_settings';

import { getStorageItem, setStorageItem } from '@/lib/localStorageHelper';
import { STORAGE_KEYS } from '@/config';
import { toast } from 'sonner';

export function getBackupSettings(): BackupSettings {
    return getStorageItem<BackupSettings>(BACKUP_SETTINGS_KEY, { autoBackupEnabled: false, intervalHours: 12, lastBackupDate: null });
}

export function saveBackupSettings(s: BackupSettings): void {
    setStorageItem(BACKUP_SETTINGS_KEY, s);
}

// ─── Core Backup Generation & Restoring ──────────────────────

/** Extracts all relevant app data from localStorage into a JSON string */
export function generateBackupData(): string {
    const data: Record<string, string> = {};
    for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && (key.startsWith('gx_') || key.startsWith('elahmed') || key === 'categories' || key === 'app_settings')) {
            data[key] = localStorage.getItem(key) || '';
        }
    }
    return JSON.stringify(data);
}

/** Restores JSON string into localStorage — supports BOTH native-dump format AND structured backup format */
export function restoreBackupData(jsonString: string): boolean {
    try {
        const parsed = JSON.parse(jsonString);
        if (typeof parsed !== 'object' || parsed === null) return false;

        // ── Detect format ─────────────────────────────────────────
        // Native format: all values are strings (raw localStorage dump)
        // Structured format: values are arrays or objects (user-friendly JSON)
        const isNativeFormat = Object.values(parsed).every(v => typeof v === 'string');

        if (isNativeFormat) {
            // ── Native localStorage dump ──────────────────────────
            for (let i = localStorage.length - 1; i >= 0; i--) {
                const key = localStorage.key(i);
                if (key && (key.startsWith('gx_') || key.startsWith('elahmed') || key === 'categories') && key !== 'app_settings' && key !== BACKUP_SETTINGS_KEY) {
                    localStorage.removeItem(key);
                }
            }
            Object.keys(parsed).forEach(key => {
                if (key.startsWith('gx_') || key.startsWith('elahmed') || key === 'categories' || key === 'app_settings') {
                    localStorage.setItem(key, parsed[key]);
                }
            });
            return true;
        }

        // ── Structured/Legacy format — map fields to localStorage keys ──
        return importStructuredBackup(parsed);

    } catch {
        return false;
    }
}

/**
 * Maps structured backup JSON (with mobiles[], computers[], sales[]...)
 * to the correct localStorage keys used by the app.
 */
export function importStructuredBackup(data: Record<string, unknown>): boolean {
    try {
        // Clear existing business data first
        for (let i = localStorage.length - 1; i >= 0; i--) {
            const key = localStorage.key(i);
            if (key && (key.startsWith('gx_') || key.startsWith('elahmed') || key === 'categories') && key !== 'app_settings' && key !== BACKUP_SETTINGS_KEY) {
                localStorage.removeItem(key);
            }
        }

        // Helper to write an array to a storage key
        const write = (key: string, value: unknown) => {
            if (value !== undefined && value !== null) {
                localStorage.setItem(key, JSON.stringify(value));
            }
        };

        // ── Inventory ──────────────────────────────────────────────
        write(STORAGE_KEYS.MOBILES,             data.mobiles);
        write(STORAGE_KEYS.COMPUTERS,           data.computers);
        write(STORAGE_KEYS.DEVICES,             data.devices);
        write(STORAGE_KEYS.CARS,                data.cars);
        write(STORAGE_KEYS.CAR_OILS,            data.carOils);
        write(STORAGE_KEYS.CAR_SPARE_PARTS,     data.carSpareParts);
        write(STORAGE_KEYS.USED_DEVICES,        data.usedDevices);
        write(STORAGE_KEYS.MOBILE_ACCESSORIES,  data.mobileAccessories);
        write(STORAGE_KEYS.COMPUTER_ACCESSORIES, data.computerAccessories);
        write(STORAGE_KEYS.DEVICE_ACCESSORIES,  data.deviceAccessories);
        write(STORAGE_KEYS.MOBILE_SPARE_PARTS,  data.mobileSpareParts);
        write(STORAGE_KEYS.COMPUTER_SPARE_PARTS, data.computerSpareParts);
        write(STORAGE_KEYS.DEVICE_SPARE_PARTS,  data.deviceSpareParts);
        write(STORAGE_KEYS.WAREHOUSE,           data.warehouseItems);
        write(STORAGE_KEYS.BATCHES,             data.batches);
        write(STORAGE_KEYS.PRODUCTS,            data.products);

        // ── Sales & Finance ────────────────────────────────────────
        // Recalculate grossProfit for any sales where it's missing or zero
        let salesData = data.sales;
        if (Array.isArray(salesData)) {
            salesData = (salesData as any[]).map((sale: any) => {
                // Fix grossProfit if missing/zero but items exist with cost info
                if ((!sale.grossProfit || sale.grossProfit === 0) && Array.isArray(sale.items) && sale.items.length > 0) {
                    const totalCost = sale.items.reduce((sum: number, item: any) => {
                        const cost = item.cost || item.costPrice || 0;
                        const qty = item.qty || item.quantity || 1;
                        return sum + (cost * qty);
                    }, 0);
                    const total = sale.total || sale.subtotal || 0;
                    const grossProfit = total - totalCost;
                    return { ...sale, totalCost, grossProfit };
                }
                return sale;
            });
        }
        write(STORAGE_KEYS.SALES,               salesData);
        write(STORAGE_KEYS.RETURNS,             data.returns);
        write(STORAGE_KEYS.EXPENSES,            data.expenses);
        write(STORAGE_KEYS.OTHER_REVENUE,       data.otherRevenue);
        write(STORAGE_KEYS.DAMAGED,             data.damagedItems);
        write(STORAGE_KEYS.WALLETS,             data.wallets ?? []);
        write(STORAGE_KEYS.WALLET_TRANSACTIONS, data.walletTransactions);
        write(STORAGE_KEYS.PURCHASE_INVOICES,   data.purchaseInvoices);
        write(STORAGE_KEYS.SHIFT_CLOSINGS,      data.shiftClosings);
        write(STORAGE_KEYS.STOCK_MOVEMENTS,     data.stockMovements);
        write(STORAGE_KEYS.AUDIT_LOGS,          data.auditLogs);

        // ── CRM ───────────────────────────────────────────────────
        write(STORAGE_KEYS.CUSTOMERS,           data.customers);
        write(STORAGE_KEYS.SUPPLIERS,           data.suppliers);
        write(STORAGE_KEYS.SUPPLIER_TRANSACTIONS, data.supplierTransactions);
        write(STORAGE_KEYS.EMPLOYEES,           data.employees);
        write(STORAGE_KEYS.PARTNERS,            data.partners);
        write(STORAGE_KEYS.BLACKLIST,           data.blacklist);
        write(STORAGE_KEYS.REMINDERS,           data.reminders);

        // ── Payroll ───────────────────────────────────────────────
        write(STORAGE_KEYS.SALARY_RECORDS,      data.salaryRecords);
        write(STORAGE_KEYS.ADVANCES,            data.advances);

        // ── Maintenance & Installments ────────────────────────────
        write(STORAGE_KEYS.MAINTENANCE,         data.maintenances);
        write(STORAGE_KEYS.INSTALLMENTS,        data.installments);
        write(STORAGE_KEYS.REPAIR_TICKETS,      data.repairTickets);
        write(STORAGE_KEYS.REPAIR_PARTS,        data.repairParts);

        // ── Users ─────────────────────────────────────────────────
        if (Array.isArray(data.users) && (data.users as any[]).length > 0) {
            write(STORAGE_KEYS.USERS, data.users);
        }

        // ── Settings ──────────────────────────────────────────────
        if (Array.isArray(data.settings)) {
            const settingsObj: Record<string, string> = {};
            (data.settings as { key: string; value: string }[]).forEach(s => {
                settingsObj[s.key] = s.value;
            });
            write('app_settings', settingsObj);
        }

        // ── Categories ────────────────────────────────────────────
        if (Array.isArray(data.categories) && (data.categories as any[]).length > 0) {
            write(STORAGE_KEYS.CATEGORIES, data.categories);
        }

        return true;
    } catch (err) {
        console.error('[importStructuredBackup] failed:', err);
        return false;
    }
}

// ─── Manual File Download ────────────────────────────────────

export function downloadManualBackup(): void {
    const json = generateBackupData();
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `GX_Retail_Backup_${new Date().toISOString().replace(/[:.]/g, '-')}.json`;
    a.click();
    URL.revokeObjectURL(url);
}

// ─── IndexedDB for Directory Handle (Auto Backup) ────────────

const DB_NAME = 'gx_backup_db';
const STORE_NAME = 'handles';

function getDB(): Promise<IDBDatabase> {
    return new Promise((resolve, reject) => {
        const req = indexedDB.open(DB_NAME, 1);
        req.onupgradeneeded = () => req.result.createObjectStore(STORE_NAME);
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
    });
}

export async function saveDirHandle(handle: FileSystemDirectoryHandle): Promise<void> {
    const db = await getDB();
    return new Promise((resolve, reject) => {
        const tx = db.transaction(STORE_NAME, 'readwrite');
        tx.objectStore(STORE_NAME).put(handle, 'backupDir');
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
    });
}

export async function getDirHandle(): Promise<FileSystemDirectoryHandle | null> {
    const db = await getDB();
    return new Promise((resolve, reject) => {
        const tx = db.transaction(STORE_NAME, 'readonly');
        const req = tx.objectStore(STORE_NAME).get('backupDir');
        req.onsuccess = () => resolve(req.result || null);
        req.onerror = () => reject(tx.error || req.error);
    });
}

export async function clearDirHandle(): Promise<void> {
    const db = await getDB();
    return new Promise((resolve, reject) => {
        const tx = db.transaction(STORE_NAME, 'readwrite');
        tx.objectStore(STORE_NAME).delete('backupDir');
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
    });
}

// ─── Auto Backup Execution ───────────────────────────────────

let _permissionToastShown = false;

export async function executeAutoBackupIfDue(): Promise<boolean> {
    const settings = getBackupSettings();
    if (!settings.autoBackupEnabled) return false;

    // Check interval
    if (settings.lastBackupDate) {
        const last = new Date(settings.lastBackupDate).getTime();
        const now = Date.now();
        const hoursPassed = (now - last) / (1000 * 60 * 60);
        if (hoursPassed < settings.intervalHours) return false; // not due yet
    }

    try {
        const dirHandle = await getDirHandle();
        if (!dirHandle) return false;

        // Verify permission to write
        // Using any since TypeScript DOM lib might not have queryPermission yet fully typed in all configs
        const permOptions = { mode: 'readwrite' };
        if ((await (dirHandle as any).queryPermission(permOptions)) !== 'granted') {
            if (_permissionToastShown) return false;
            
            _permissionToastShown = true;
            toast.error('أذونات النسخ الاحتياطي التلقائي', {
                description: 'يرجى إعطاء الصلاحية حتى يتمكن النظام من حفظ النسخة الاحتياطية تلقائياً.',
                action: {
                    label: 'منح الصلاحية',
                    onClick: async () => {
                        try {
                            const requestStatus = await (dirHandle as any).requestPermission(permOptions);
                            if (requestStatus === 'granted') {
                                toast.success('تم منح الصلاحية بنجاح! سيتم استئناف النسخ الاحتياطي.');
                                executeAutoBackupIfDue();
                            }
                        } catch (e) {
                            console.error('Failed to grant permission manually', e);
                        }
                    }
                },
                duration: 15000,
            });
            return false;
        }

        const fileName = `GX_AutoBackup_${new Date().toISOString().replace(/[:.]/g, '-')}.json`;
        const fileHandle = await dirHandle.getFileHandle(fileName, { create: true });
        const writable = await fileHandle.createWritable();
        const json = generateBackupData();
        await writable.write(json);
        await writable.close();

        // Update last backup date
        saveBackupSettings({ ...settings, lastBackupDate: new Date().toISOString() });
        return true;
    } catch (err) {
        console.error('Auto backup failed:', err);
        return false;
    }
}
