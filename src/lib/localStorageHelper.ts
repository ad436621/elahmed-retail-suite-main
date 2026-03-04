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
 * #19 FIX: Checks storage usage and warns when approaching limits.
 */
export function setStorageItem<T>(key: string, value: T): void {
    const data = JSON.stringify(value);
    try {
        localStorage.setItem(key, data);
    } catch (e) {
        console.error(`[localStorage] ⚠ Failed to save key "${key}" — storage may be full!`, e);
        return;
    }
    // Check storage usage (rough estimate)
    checkStorageUsage();
}

/** Estimate total localStorage usage and warn if high */
function checkStorageUsage(): void {
    try {
        let total = 0;
        for (let i = 0; i < localStorage.length; i++) {
            const key = localStorage.key(i);
            if (key) {
                total += key.length + (localStorage.getItem(key)?.length || 0);
            }
        }
        const totalMB = total * 2 / (1024 * 1024); // chars are ~2 bytes each
        const MAX_MB = 5; // Most browsers allow 5MB
        const usagePercent = (totalMB / MAX_MB) * 100;

        if (usagePercent >= 90) {
            console.error(`[localStorage] 🔴 CRITICAL: ${usagePercent.toFixed(1)}% used (${totalMB.toFixed(2)}MB / ${MAX_MB}MB). Consider cleaning up data!`);
        } else if (usagePercent >= 70) {
            console.warn(`[localStorage] 🟡 WARNING: ${usagePercent.toFixed(1)}% used (${totalMB.toFixed(2)}MB / ${MAX_MB}MB).`);
        }
    } catch {
        // Silently fail — not critical
    }
}

/**
 * Remove a key from localStorage.
 */
export function removeStorageItem(key: string): void {
    localStorage.removeItem(key);
}
