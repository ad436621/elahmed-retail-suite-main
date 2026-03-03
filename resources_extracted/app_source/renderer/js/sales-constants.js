// ═══════════════════════════════════════════════════════════════
// 📊 SALES CONSTANTS - Constants for Sales System
// ═══════════════════════════════════════════════════════════════

/**
 * Sales System Constants
 * جميع القيم الثابتة المستخدمة في نظام المبيعات
 */

window.SalesConstants = {
  // ═════════════════════════════════════
  // 📄 PAGINATION
  // ═════════════════════════════════════
  PAGINATION: {
    ROWS_PER_PAGE: 25,
    DEFAULT_PAGE: 1,
    MAX_PAGES_TO_SHOW: 10
  },

  // ═════════════════════════════════════
  // 💾 CACHE
  // ═════════════════════════════════════
  CACHE: {
    DURATION: 5 * 60 * 1000, // 5 minutes
    KEY_PREFIX: 'sales_cache_',
    STORAGE_TYPE: 'sessionStorage' // 'sessionStorage' or 'localStorage'
  },

  // ═════════════════════════════════════
  // ⏱️ TIMING
  // ═════════════════════════════════════
  TIMING: {
    DEBOUNCE_DELAY: 300, // milliseconds
    THROTTLE_LIMIT: 100, // milliseconds
    SEARCH_DEBOUNCE: 200, // milliseconds
    TOAST_DURATION: 3000, // milliseconds
    LOADING_TIMEOUT: 30000 // 30 seconds
  },

  // ═════════════════════════════════════
  // 📊 LIMITS
  // ═════════════════════════════════════
  LIMITS: {
    MAX_SEARCH_LENGTH: 100,
    MAX_RESULTS: 10000,
    MAX_DISCOUNT_PERCENT: 50,
    MIN_SALE_PRICE: 1,
    MAX_RETRIES: 3
  },

  // ═════════════════════════════════════
  // 🗄️ DATABASE
  // ═════════════════════════════════════
  DATABASE: {
    DEFAULT_LIMIT: 500,
    MAX_LIMIT: 10000,
    QUERY_TIMEOUT: 30000 // 30 seconds
  },

  // ═════════════════════════════════════
  // 🏪 WAREHOUSE
  // ═════════════════════════════════════
  WAREHOUSE: {
    STORAGE_KEY_PREFIX: 'currentSalesWarehouseId',
    ALL_WAREHOUSES: 'all'
  },

  // ═════════════════════════════════════
  // 📅 DATE RANGES
  // ═════════════════════════════════════
  DATE_RANGES: {
    DEFAULT_MONTHS_BACK: 6,
    TODAY: 'today',
    WEEK: 'week',
    MONTH: 'month',
    YEAR: 'year',
    ALL: 'all'
  },

  // ═════════════════════════════════════
  // 🎨 UI
  // ═════════════════════════════════════
  UI: {
    ANIMATION_DURATION: 300, // milliseconds
    SCROLL_THRESHOLD: 40, // percentage
    NEAR_BOTTOM_THRESHOLD: 100 // pixels
  },

  // ═════════════════════════════════════
  // 🔔 NOTIFICATIONS
  // ═════════════════════════════════════
  NOTIFICATIONS: {
    SUCCESS_DURATION: 3000,
    ERROR_DURATION: 5000,
    WARNING_DURATION: 4000,
    INFO_DURATION: 3000
  }
};

// Export for use in modules
if (typeof module !== 'undefined' && module.exports) {
  module.exports = window.SalesConstants;
}








