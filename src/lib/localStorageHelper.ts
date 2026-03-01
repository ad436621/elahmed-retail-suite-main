// ============================================================
// LocalStorage Helper — Type-safe get/set with error handling
// ============================================================

/**
 * Read and parse a JSON value from localStorage.
 * Returns `fallback` if key is missing or data is corrupt.
 */
export function getStorageItem<T>(key: string, fallback: T): T {
    try {
        const raw = localStorage.getItem(key);
        if (raw === null) return fallback;
        return JSON.parse(raw) as T;
    } catch {
        return fallback;
    }
}

/**
 * Serialize and save a value to localStorage.
 */
export function setStorageItem<T>(key: string, value: T): void {
    localStorage.setItem(key, JSON.stringify(value));
}

/**
 * Remove a key from localStorage.
 */
export function removeStorageItem(key: string): void {
    localStorage.removeItem(key);
}
