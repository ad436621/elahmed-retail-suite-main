// ═══════════════════════════════════════════════════════════════
// 💾 POS CACHE SYSTEM - Session Cache for POS
// ═══════════════════════════════════════════════════════════════

/**
 * Session Cache System for POS
 * نظام تخزين مؤقت للبيانات في POS
 */

window.POSCache = {
  _cache: new Map(),
  _dirty: new Set(),

  get(key, defaultValue = null) {
    if (this._cache.has(key)) {
      return this._cache.get(key);
    }
    
    try {
      const stored = localStorage.getItem(key);
      if (stored !== null) {
        try {
          const parsed = JSON.parse(stored);
          this._cache.set(key, parsed);
          return parsed;
        } catch (e) {
          // If not JSON, return as string
          this._cache.set(key, stored);
          return stored;
        }
      }
    } catch (e) {
      Logger.warn('POSCache.get error:', e);
    }
    
    return defaultValue;
  },

  set(key, value, persist = true) {
    this._cache.set(key, value);
    if (persist) {
      this._dirty.add(key);
    }
  },

  _flush(key, parseJson = true) {
    if (!this._dirty.has(key)) return;
    
    try {
      const value = this._cache.get(key);
      if (value === undefined) {
        localStorage.removeItem(key);
      } else {
        const toStore = parseJson ? JSON.stringify(value) : value;
        localStorage.setItem(key, toStore);
      }
      this._dirty.delete(key);
    } catch (e) {
      Logger.warn('POSCache._flush error:', e);
    }
  },

  flushAll() {
    this._dirty.forEach(key => {
      const value = this._cache.get(key);
      const parseJson = typeof value !== 'string';
      this._flush(key, parseJson);
    });
  },

  clear(key) {
    this._cache.delete(key);
    this._dirty.delete(key);
    try {
      localStorage.removeItem(key);
    } catch (e) {
      Logger.warn('POSCache.clear error:', e);
    }
  }
};

// Flush cache on page unload
if (typeof window !== 'undefined') {
  window.addEventListener('beforeunload', () => {
    window.POSCache.flushAll();
  });
}

// Export for use in modules
if (typeof module !== 'undefined' && module.exports) {
  module.exports = window.POSCache;
}








