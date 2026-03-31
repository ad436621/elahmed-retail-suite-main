// ============================================================
// storage.ts — Production-safe localStorage operations
// Handles: quota exhaustion, JSON parse errors
// Surfaces errors that the original helper silently swallowed
// ============================================================

export class StorageFullError extends Error {
  public readonly usedBytes: number;
  public readonly totalBytes: number;
  constructor(used: number, total: number) {
    super(
      `مساحة التخزين ممتلئة. المستخدم: ${(used / 1024).toFixed(1)} KB من ${(total / 1024).toFixed(1)} KB`
    );
    this.name = 'StorageFullError';
    this.usedBytes = used;
    this.totalBytes = total;
  }
}

/** Estimate total localStorage usage in bytes (chars × 2 for UTF-16) */
export function estimateStorageUsage(): number {
  let total = 0;
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key) {
        total += (key.length + (localStorage.getItem(key)?.length ?? 0)) * 2;
      }
    }
  } catch {
    // Ignore — not critical
  }
  return total;
}

/** Conservative localStorage capacity estimate: 5 MB */
export function estimateStorageCapacity(): number {
  return 5 * 1024 * 1024;
}

/** Returns usage ratio 0–1 */
export function getStorageUsageRatio(): number {
  return estimateStorageUsage() / estimateStorageCapacity();
}

/**
 * Safe read — returns defaultValue on any error (missing key, JSON parse fail, etc.)
 */
export function safeGetItem<T>(key: string, defaultValue: T): T {
  try {
    const raw = localStorage.getItem(key);
    if (raw === null) return defaultValue;
    return JSON.parse(raw) as T;
  } catch {
    return defaultValue;
  }
}

/**
 * Safe write — throws StorageFullError if storage quota is exceeded.
 * Callers must catch StorageFullError and alert the user.
 */
export function safeSetItem<T>(key: string, value: T): void {
  const serialized = JSON.stringify(value);
  try {
    localStorage.setItem(key, serialized);
  } catch (error) {
    if (
      error instanceof DOMException &&
      (error.name === 'QuotaExceededError' ||
        error.name === 'NS_ERROR_DOM_QUOTA_REACHED')
    ) {
      const used = estimateStorageUsage();
      const total = estimateStorageCapacity();
      throw new StorageFullError(used, total);
    }
    throw error; // re-throw unknown errors
  }
}

/** Safe remove — never throws */
export function safeRemoveItem(key: string): void {
  try {
    localStorage.removeItem(key);
  } catch {
    // localStorage.removeItem never throws in practice
  }
}

/** Returns true if storage is at or above 70% capacity */
export function shouldWarnStorageFull(): boolean {
  return getStorageUsageRatio() >= 0.7;
}

/** Returns true if storage is at or above 90% capacity */
export function isStorageCritical(): boolean {
  return getStorageUsageRatio() >= 0.9;
}
