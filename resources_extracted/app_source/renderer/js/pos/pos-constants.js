// ═══════════════════════════════════════════════════════════════
// 📊 POS CONSTANTS - Constants for POS System
// ═══════════════════════════════════════════════════════════════

/**
 * POS System Constants
 * جميع القيم الثابتة المستخدمة في نظام نقطة البيع
 */

window.POSConstants = {
  // ═════════════════════════════════════
  // ⏱️ TIMING
  // ═════════════════════════════════════
  TIMING: {
    DEBOUNCE_DELAY: 150,
    SEARCH_MIN_LENGTH: 0,
    CACHE_DURATION: 180000, // 3 minutes
    LAZY_LOAD_BATCH: 20,
    VIRTUAL_LIST_THRESHOLD: 50,
    VIRTUAL_LIST_WINDOW: 20
  },

  // ═════════════════════════════════════
  // 📊 LIMITS
  // ═════════════════════════════════════
  LIMITS: {
    MAX_VISIBLE_CARDS: 100,
    MAX_DISCOUNT_PERCENT: 50,
    MIN_SALE_PRICE: 1
  },

  // ═════════════════════════════════════
  // 🎨 UI
  // ═════════════════════════════════════
  UI: {
    ANIMATION_DURATION: 300,
    TOOLTIP_DELAY: 500,
    TOAST_DURATION: 3000
  }
};

// Export for use in modules
if (typeof module !== 'undefined' && module.exports) {
  module.exports = window.POSConstants;
}








