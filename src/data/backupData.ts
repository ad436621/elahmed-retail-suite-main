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

/** Restores JSON string into localStorage */
export function restoreBackupData(jsonString: string): boolean {
    try {
        const data = JSON.parse(jsonString);
        if (typeof data !== 'object' || data === null) return false;

        // Optionally clear existing business keys first so deleted items don't linger
        for (let i = localStorage.length - 1; i >= 0; i--) {
            const key = localStorage.key(i);
            if (key && (key.startsWith('gx_') || key.startsWith('elahmed') || key === 'categories') && key !== 'app_settings' && key !== BACKUP_SETTINGS_KEY) {
                localStorage.removeItem(key);
            }
        }

        Object.keys(data).forEach(key => {
            if (key.startsWith('gx_') || key.startsWith('elahmed') || key === 'categories' || key === 'app_settings') {
                localStorage.setItem(key, data[key]);
            }
        });
        return true;
    } catch {
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
            const requestStatus = await (dirHandle as any).requestPermission(permOptions);
            if (requestStatus !== 'granted') return false;
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
