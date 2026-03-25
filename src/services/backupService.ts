// ============================================================
// Backup Service — نسخ احتياطي تلقائي
// ============================================================

const DB_NAME = 'galaxystore.db';
const MAX_BACKUPS = 7;

export interface BackupInfo {
  filename: string;
  createdAt: string;
  sizeBytes: number;
}

/**
 * Creates a backup of the SQLite database file.
 * Stores backup files in the userData/backups directory.
 */
export async function createBackup(): Promise<BackupInfo | null> {
  try {
    // @ts-expect-error — Electron IPC bridge
    const result = await window.electronAPI?.createBackup?.();
    return result || null;
  } catch (err) {
    console.error('[Backup] Failed to create backup:', err);
    return null;
  }
}

/**
 * Lists all available backups, sorted by most recent first.
 */
export async function listBackups(): Promise<BackupInfo[]> {
  try {
    // @ts-expect-error — Electron IPC bridge
    const result = await window.electronAPI?.listBackups?.();
    return result || [];
  } catch (err) {
    console.error('[Backup] Failed to list backups:', err);
    return [];
  }
}

/**
 * Restores the database from a specific backup file.
 */
export async function restoreBackup(filename: string): Promise<boolean> {
  try {
    // @ts-expect-error — Electron IPC bridge
    const result = await window.electronAPI?.restoreBackup?.(filename);
    return !!result;
  } catch (err) {
    console.error('[Backup] Failed to restore backup:', err);
    return false;
  }
}

/**
 * Deletes old backups keeping only the most recent MAX_BACKUPS.
 */
export async function cleanupOldBackups(): Promise<number> {
  try {
    const backups = await listBackups();
    if (backups.length <= MAX_BACKUPS) return 0;

    const toDelete = backups.slice(MAX_BACKUPS);
    let deleted = 0;
    for (const b of toDelete) {
      try {
        // @ts-expect-error — Electron IPC bridge
        await window.electronAPI?.deleteBackup?.(b.filename);
        deleted++;
      } catch { /* ignore */ }
    }
    return deleted;
  } catch {
    return 0;
  }
}

/**
 * Schedules daily auto-backup. Call once on app startup.
 */
let autoBackupInterval: ReturnType<typeof setInterval> | null = null;

export function startAutoBackup(intervalMs = 24 * 60 * 60 * 1000) {
  if (autoBackupInterval) {
    clearInterval(autoBackupInterval);
  }

  // Create initial backup on startup
  setTimeout(async () => {
    console.log('[Backup] Auto-backup: creating initial backup...');
    await createBackup();
    await cleanupOldBackups();
  }, 5000); // Wait 5s after startup

  autoBackupInterval = setInterval(async () => {
    console.log('[Backup] Auto-backup: daily backup...');
    await createBackup();
    await cleanupOldBackups();
  }, intervalMs);
}

export function stopAutoBackup() {
  if (autoBackupInterval) {
    clearInterval(autoBackupInterval);
    autoBackupInterval = null;
  }
}

export { DB_NAME, MAX_BACKUPS };
