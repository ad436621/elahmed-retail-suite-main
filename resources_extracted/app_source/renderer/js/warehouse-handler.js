// ═══════════════════════════════════════════════════════════════
// 🏪 WAREHOUSE HANDLER - Unified Warehouse ID Management
// ═══════════════════════════════════════════════════════════════

/**
 * Unified warehouse ID handling across all sales pages
 * توحيد معالجة warehouse_id عبر جميع صفحات المبيعات
 */

window.WarehouseHandler = {
  // ═════════════════════════════════════
  // 📋 STORAGE KEYS
  // ═════════════════════════════════════
  STORAGE_KEYS: {
    SALES: 'currentSalesWarehouseId',
    ACCESSORY_SALES: 'currentAccessorySalesWarehouseId',
    REPAIR_SALES: 'currentRepairSalesWarehouseId',
    INVENTORY: 'currentInventoryWarehouseId',
    PURCHASES: 'currentPurchasesWarehouseId'
  },

  // ═════════════════════════════════════
  // 🔍 GET WAREHOUSE ID
  // ═════════════════════════════════════

  /**
   * Get current warehouse ID from URL or localStorage
   * @param {string} pageType - Type of page: 'sales', 'accessory_sales', 'repair_sales', etc.
   * @returns {string|null} Warehouse ID or null
   */
  getCurrentWarehouseId(pageType = 'sales') {
    const storageKey = this.STORAGE_KEYS[pageType.toUpperCase()] || this.STORAGE_KEYS.SALES;
    
    // Try URL first
    const urlParams = new URLSearchParams(window.location.search);
    const warehouseId = urlParams.get('warehouse_id');
    
    if (warehouseId) {
      this.setWarehouseId(warehouseId, pageType);
      return warehouseId;
    }
    
    // Try localStorage
    const savedId = localStorage.getItem(storageKey);
    return savedId || null;
  },

  // ═════════════════════════════════════
  // 💾 SET WAREHOUSE ID
  // ═════════════════════════════════════

  /**
   * Set warehouse ID for a page type
   * @param {string} warehouseId - Warehouse ID to set
   * @param {string} pageType - Type of page
   */
  setWarehouseId(warehouseId, pageType = 'sales') {
    const storageKey = this.STORAGE_KEYS[pageType.toUpperCase()] || this.STORAGE_KEYS.SALES;
    
    if (warehouseId) {
      localStorage.setItem(storageKey, warehouseId);
      Logger.log(`[WAREHOUSE] Set ${pageType} warehouse ID:`, warehouseId);
    } else {
      localStorage.removeItem(storageKey);
      Logger.log(`[WAREHOUSE] Removed ${pageType} warehouse filter`);
    }
  },

  // ═════════════════════════════════════
  // 🗑️ CLEAR WAREHOUSE ID
  // ═════════════════════════════════════

  /**
   * Clear warehouse ID for a page type
   * @param {string} pageType - Type of page
   */
  clearWarehouseId(pageType = 'sales') {
    this.setWarehouseId(null, pageType);
  },

  // ═════════════════════════════════════
  // 🔄 INITIALIZE
  // ═════════════════════════════════════

  /**
   * Initialize warehouse handler for a page
   * Call this on page load
   * @param {string} pageType - Type of page
   */
  init(pageType = 'sales') {
    const warehouseId = this.getCurrentWarehouseId(pageType);
    
    if (warehouseId) {
      Logger.log(`[WAREHOUSE] Initialized ${pageType} with warehouse ID:`, warehouseId);
    } else {
      Logger.log(`[WAREHOUSE] Initialized ${pageType} without warehouse filter`);
    }
    
    return warehouseId;
  },

  // ═════════════════════════════════════
  // 🔍 FILTER DATA
  // ═════════════════════════════════════

  /**
   * Filter data by warehouse ID
   * @param {Array} data - Data array to filter
   * @param {string} warehouseId - Warehouse ID to filter by
   * @param {string} warehouseField - Field name containing warehouse_id (default: 'warehouse_id')
   * @returns {Array} Filtered data
   */
  filterByWarehouse(data, warehouseId, warehouseField = 'warehouse_id') {
    if (!warehouseId || !data || !Array.isArray(data)) {
      return data || [];
    }
    
    return data.filter(item => {
      const itemWarehouseId = item[warehouseField] || 
                             item.device_warehouse_id || 
                             item.accessory_warehouse_id;
      
      // If item has no warehouse_id, include it (assume all warehouses)
      return !itemWarehouseId || itemWarehouseId == warehouseId;
    });
  },

  // ═════════════════════════════════════
  // 📦 GET WAREHOUSES BY TYPE
  // ═════════════════════════════════════

  /**
   * Get warehouses filtered by storage type
   * @param {string} storageType - Type: 'devices', 'accessories', 'spare_parts', 'mixed'
   * @returns {Promise<Array>} Array of warehouses
   */
  async getWarehousesByType(storageType) {
    try {
      const res = await fetch('elos-db://warehouses');
      if (!res.ok) throw new Error(await res.text());
      
      const data = await res.json();
      const warehouses = Array.isArray(data) ? data : (data.warehouses || []);
      
      // Filter by storage_type
      if (storageType) {
        return warehouses.filter(w => {
          // Active warehouses only
          if (w.is_active === 0) return false;
          
          // For 'devices', include:
          // 1. Main warehouses with type='devices' (legacy)
          // 2. Storage warehouses with storage_type='devices'
          // 3. Mixed storage warehouses (can hold devices)
          if (storageType === 'devices') {
            if (w.type === 'devices') return true;
            if (w.is_storage_only === 1) {
              if (w.storage_type === 'devices' || w.storage_type === 'mixed') return true;
            }
          }
          
          // For 'accessories', include:
          // 1. Main warehouses with type='accessories' (legacy)
          // 2. Storage warehouses with storage_type='accessories' or 'mixed'
          if (storageType === 'accessories') {
            if (w.type === 'accessories') return true;
            if (w.is_storage_only === 1) {
              if (w.storage_type === 'accessories' || w.storage_type === 'mixed') return true;
            }
          }
          
          // For 'spare_parts', include:
          // 1. Main warehouses with type='repair_parts' (legacy)
          // 2. Storage warehouses with storage_type='spare_parts' or 'mixed'
          if (storageType === 'spare_parts') {
            // المخزن الرئيسي لقطع الغيار
            if (w.type === 'repair_parts' && w.is_storage_only !== 1) return true;
            // المخازن التخزينية
            if (w.is_storage_only === 1) {
              if (w.storage_type === 'spare_parts' || w.storage_type === 'mixed') return true;
            }
          }
          
          return false;
        });
      }
      
      // Return all active warehouses if no type specified
      return warehouses.filter(w => w.is_active !== 0);
    } catch (error) {
      Logger.error('[WAREHOUSE] Error loading warehouses:', error);
      return [];
    }
  },

  /**
   * Populate warehouse select dropdown
   * @param {string} selectId - ID of select element
   * @param {string} storageType - Type: 'devices', 'accessories', 'spare_parts'
   * @param {string} selectedId - Pre-selected warehouse ID (optional)
   * @param {boolean|string} includeAll - Include "كل المخازن" option, or 'optional' for "-- اختر المخزن --"
   */
  async populateWarehouseSelect(selectId, storageType, selectedId = null, includeAll = false) {
    const select = document.getElementById(selectId);
    if (!select) {
      Logger.warn(`[WAREHOUSE] Select element not found: ${selectId}`);
      return;
    }

    const warehouses = await this.getWarehousesByType(storageType);

    let html = '';
    if (includeAll === true) {
      html += '<option value="">كل المخازن</option>';
    } else if (includeAll === 'optional') {
      // ✅ خيار اختياري بدون إجبار على الاختيار
      html += '<option value="">-- اختر المخزن --</option>';
    }

    if (warehouses.length === 0) {
      html += '<option value="">لا توجد مخازن متاحة</option>';
    } else {
      warehouses.forEach(w => {
        const selected = selectedId && w.id == selectedId ? 'selected' : '';
        html += `<option value="${w.id}" ${selected}>${w.name || `مخزن ${w.id}`}</option>`;
      });
    }

    select.innerHTML = html;

    // Trigger change event if selectedId is provided
    if (selectedId) {
      select.dispatchEvent(new Event('change'));
    }
  }
};

// Auto-initialize on load
if (typeof window !== 'undefined') {
  // Detect page type from URL or script
  const currentScript = document.currentScript;
  const pageType = currentScript?.getAttribute('data-page-type') || 'sales';
  
  // Initialize if not already done
  if (!window.WarehouseHandler._initialized) {
    window.WarehouseHandler.init(pageType);
    window.WarehouseHandler._initialized = true;
  }
}

// Export for use in modules
if (typeof module !== 'undefined' && module.exports) {
  module.exports = window.WarehouseHandler;
}

