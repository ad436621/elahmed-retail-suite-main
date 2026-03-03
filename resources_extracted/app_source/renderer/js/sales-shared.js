// ═══════════════════════════════════════════════════════════════
// 📊 SALES SHARED UTILITIES - Shared functions for Sales Pages
// ═══════════════════════════════════════════════════════════════

/**
 * Shared utilities for all sales pages
 * يحد من تكرار الكود بين صفحات المبيعات المختلفة
 */

// Ensure constants are loaded
if (!window.SalesConstants) {
  console.warn('[SALES-SHARED] SalesConstants not loaded, using defaults');
  window.SalesConstants = {
    PAGINATION: { ROWS_PER_PAGE: 25, DEFAULT_PAGE: 1 },
    CACHE: { DURATION: 5 * 60 * 1000 },
    TIMING: { DEBOUNCE_DELAY: 300, SEARCH_DEBOUNCE: 200 },
    LIMITS: { MAX_SEARCH_LENGTH: 100 }
  };
}

window.SalesShared = {
  // ═════════════════════════════════════
  // 🛠️ UTILITY FUNCTIONS
  // ═════════════════════════════════════

  /**
   * Get today's date in ISO format (YYYY-MM-DD)
   */
  todayISO() {
    return new Date().toISOString().slice(0, 10);
  },

  /**
   * Debounce function for search optimization
   */
  debounce(func, delay = null) {
    const delayMs = delay || window.SalesConstants.TIMING.DEBOUNCE_DELAY;
    let timeoutId;
    return function (...args) {
      clearTimeout(timeoutId);
      timeoutId = setTimeout(() => func.apply(this, args), delayMs);
    };
  },

  /**
   * Throttle function for scroll events
   */
  throttle(func, limit = null) {
    const limitMs = limit || window.SalesConstants.TIMING.THROTTLE_LIMIT;
    let inThrottle;
    return function (...args) {
      if (!inThrottle) {
        func.apply(this, args);
        inThrottle = true;
        setTimeout(() => inThrottle = false, limitMs);
      }
    };
  },

  // ═════════════════════════════════════
  // 💾 CACHE SYSTEM
  // ═════════════════════════════════════

  /**
   * Create a cache instance for sales data
   */
  createCache(storageKey = 'salesCache', duration = null) {
    const cacheDuration = duration || window.SalesConstants.CACHE.DURATION;
    
    return {
      data: null,
      timestamp: null,
      cacheKey: null,
      duration: cacheDuration,
      
      set(data, key) {
        this.data = data;
        this.timestamp = Date.now();
        this.cacheKey = key;
        try {
          sessionStorage.setItem(storageKey, JSON.stringify({
            data: data,
            timestamp: this.timestamp,
            cacheKey: key
          }));
        } catch (e) {
          Logger.warn('Cache storage failed:', e);
        }
      },
      
      get() {
        // Try memory cache first
        if (this.data && this.timestamp && (Date.now() - this.timestamp < this.duration)) {
          return this.data;
        }
        
        // Try sessionStorage
        try {
          const cached = sessionStorage.getItem(storageKey);
          if (cached) {
            const { data, timestamp, cacheKey } = JSON.parse(cached);
            if (Date.now() - timestamp < this.duration) {
              this.data = data;
              this.timestamp = timestamp;
              this.cacheKey = cacheKey;
              return data;
            }
          }
        } catch (e) {
          Logger.warn('Cache retrieval failed:', e);
        }
        
        return null;
      },
      
      invalidate() {
        this.data = null;
        this.timestamp = null;
        this.cacheKey = null;
        try {
          sessionStorage.removeItem(storageKey);
        } catch (e) {}
      },
      
      isValid() {
        return this.data && this.timestamp && (Date.now() - this.timestamp < this.duration);
      }
    };
  },

  // ═════════════════════════════════════
  // 📄 PAGINATION
  // ═════════════════════════════════════

  /**
   * Create pagination state manager
   */
  createPaginationState(rowsPerPage = null) {
    const rpp = rowsPerPage || window.SalesConstants.PAGINATION.ROWS_PER_PAGE;
    
    return {
      currentPage: window.SalesConstants.PAGINATION.DEFAULT_PAGE,
      rowsPerPage: rpp,
      viewingAll: false,
      
      reset() {
        this.currentPage = window.SalesConstants.PAGINATION.DEFAULT_PAGE;
        this.viewingAll = false;
      },
      
      getTotalPages(totalItems) {
        return Math.ceil(totalItems / this.rowsPerPage);
      },
      
      getPaginatedData(data) {
        if (this.viewingAll) return data;
        
        const start = (this.currentPage - 1) * this.rowsPerPage;
        const end = start + this.rowsPerPage;
        return data.slice(start, end);
      },
      
      goToPage(pageNum, totalItems) {
        const totalPages = this.getTotalPages(totalItems);
        if (pageNum >= 1 && pageNum <= totalPages) {
          this.currentPage = pageNum;
          return true;
        }
        return false;
      },
      
      changePage(direction, totalItems) {
        const totalPages = this.getTotalPages(totalItems);
        this.currentPage += direction;
        
        if (this.currentPage < 1) this.currentPage = 1;
        if (this.currentPage > totalPages) this.currentPage = totalPages;
        
        return this.currentPage;
      }
    };
  },

  /**
   * Update pagination UI
   */
  updatePaginationUI(paginationState, totalItems, callbacks = {}) {
    const { onUpdate, onScroll } = callbacks;
    const totalPages = paginationState.getTotalPages(totalItems);
    const paginationControls = document.getElementById('paginationControls');
    const pageInfo = document.getElementById('pageInfo');
    const prevBtn = document.getElementById('prevPage');
    const nextBtn = document.getElementById('nextPage');
    const pageJump = document.getElementById('pageJump');
    
    if (!paginationControls) return;
    
    // Hide if no data or viewing all or fits in one page
    if (totalItems === 0 || paginationState.viewingAll || totalItems <= paginationState.rowsPerPage) {
      paginationControls.style.display = 'none';
      return;
    }
    
    // Update page info
    if (pageInfo) {
      pageInfo.textContent = `صفحة ${paginationState.currentPage} من ${totalPages} (${totalItems} عملية)`;
    }
    
    // Update buttons
    if (prevBtn) {
      prevBtn.disabled = paginationState.currentPage === 1;
      prevBtn.style.opacity = paginationState.currentPage === 1 ? '0.5' : '1';
      prevBtn.style.cursor = paginationState.currentPage === 1 ? 'not-allowed' : 'pointer';
    }
    
    if (nextBtn) {
      nextBtn.disabled = paginationState.currentPage === totalPages || totalPages === 0;
      nextBtn.style.opacity = (paginationState.currentPage === totalPages || totalPages === 0) ? '0.5' : '1';
      nextBtn.style.cursor = (paginationState.currentPage === totalPages || totalPages === 0) ? 'not-allowed' : 'pointer';
    }
    
    if (pageJump) {
      pageJump.max = totalPages;
    }
    
    // Initialize scroll detection if callback provided
    if (onScroll) {
      this.initPaginationScrollDetection(paginationControls, onScroll);
    }
    
    if (onUpdate) onUpdate();
  },

  /**
   * Initialize pagination scroll detection
   */
  initPaginationScrollDetection(paginationControls, onScroll) {
    const tableWrap = document.querySelector('.table-wrap');
    if (!tableWrap || !paginationControls) return;
    
    // Remove old listener if exists
    if (tableWrap._scrollHandler) {
      tableWrap.removeEventListener('scroll', tableWrap._scrollHandler);
    }
    
    let scrollTimeout;
    const checkScroll = this.throttle(() => {
      const { scrollTop, scrollHeight, clientHeight } = tableWrap;
      const scrollableHeight = scrollHeight - clientHeight;
      
      if (scrollableHeight <= 10) {
        paginationControls.style.display = 'none';
        return;
      }
      
      const scrollPercentage = (scrollTop / scrollableHeight) * 100;
      const nearBottom = (scrollableHeight - scrollTop) < window.SalesConstants.UI.NEAR_BOTTOM_THRESHOLD;
      
      if (scrollPercentage > window.SalesConstants.UI.SCROLL_THRESHOLD || nearBottom) {
        paginationControls.style.display = 'flex';
      } else {
        paginationControls.style.display = 'none';
      }
      
      // Auto-hide after 3 seconds
      clearTimeout(scrollTimeout);
      scrollTimeout = setTimeout(() => {
        if (!nearBottom) {
          paginationControls.style.display = 'none';
        }
      }, 3000);
    }, 50);
    
    tableWrap._scrollHandler = () => {
      checkScroll();
      if (onScroll) onScroll();
    };
    
    tableWrap.addEventListener('scroll', tableWrap._scrollHandler, { passive: true });
    
    // Initial check
    setTimeout(checkScroll, 100);
  },

  // ═════════════════════════════════════
  // 🔍 SEARCH & FILTER
  // ═════════════════════════════════════

  /**
   * Apply quick search filter
   */
  applyQuickSearch(data, searchTerm, searchFields = []) {
    if (!searchTerm || !searchTerm.trim()) return data;
    
    const term = searchTerm.trim().toLowerCase();
    const hit = (v) => (v || '').toString().toLowerCase().includes(term);
    
    return data.filter(item => {
      return searchFields.some(field => {
        const value = this.getNestedValue(item, field);
        return hit(value);
      });
    });
  },

  /**
   * Get nested value from object using dot notation
   */
  getNestedValue(obj, path) {
    return path.split('.').reduce((current, prop) => current?.[prop], obj);
  },

  /**
   * Apply warehouse filter
   */
  applyWarehouseFilter(data, warehouseId, warehouseField = 'warehouse_id') {
    if (!warehouseId) return data;
    
    return data.filter(item => {
      const itemWarehouseId = this.getNestedValue(item, warehouseField);
      // If item has no warehouse_id, include it (assume all warehouses)
      return !itemWarehouseId || itemWarehouseId == warehouseId;
    });
  },

  // ═════════════════════════════════════
  // 📅 DATE FILTERS
  // ═════════════════════════════════════

  /**
   * Apply quick date filter
   */
  applyQuickDateFilter(period) {
    const today = new Date();
    let fromDate, toDate;
    
    switch(period) {
      case 'today':
        fromDate = today;
        toDate = today;
        break;
        
      case 'week':
        const startOfWeek = new Date(today);
        startOfWeek.setDate(today.getDate() - today.getDay());
        fromDate = startOfWeek;
        toDate = today;
        break;
        
      case 'month':
        const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
        fromDate = startOfMonth;
        toDate = today;
        break;
        
      case '30days':
        const thirtyDaysAgo = new Date(today);
        thirtyDaysAgo.setDate(today.getDate() - 30);
        fromDate = thirtyDaysAgo;
        toDate = today;
        break;
        
      case 'year':
        const startOfYear = new Date(today.getFullYear(), 0, 1);
        fromDate = startOfYear;
        toDate = today;
        break;
        
      default:
        return { from: null, to: null };
    }
    
    return {
      from: fromDate.toISOString().slice(0, 10),
      to: toDate.toISOString().slice(0, 10)
    };
  },

  // ═════════════════════════════════════
  // 🏪 WAREHOUSE HANDLING
  // ═════════════════════════════════════

  /**
   * Get current warehouse ID from URL or localStorage
   */
  getCurrentWarehouseId(storageKey = null) {
    const key = storageKey || window.SalesConstants.WAREHOUSE.STORAGE_KEY_PREFIX;
    
    // Try URL first
    const urlParams = new URLSearchParams(window.location.search);
    const warehouseId = urlParams.get('warehouse_id');
    
    if (warehouseId) {
      localStorage.setItem(key, warehouseId);
      return warehouseId;
    }
    
    // Try localStorage
    const savedId = localStorage.getItem(key);
    return savedId || null;
  },

  /**
   * Set warehouse ID
   */
  setWarehouseId(warehouseId, storageKey = null) {
    const key = storageKey || window.SalesConstants.WAREHOUSE.STORAGE_KEY_PREFIX;
    
    if (warehouseId) {
      localStorage.setItem(key, warehouseId);
    } else {
      localStorage.removeItem(key);
    }
  },

  // ═════════════════════════════════════
  // 🔔 ERROR HANDLING
  // ═════════════════════════════════════

  /**
   * Handle API errors consistently
   */
  handleApiError(error, defaultMessage = 'حدث خطأ أثناء العملية') {
    Logger.error('API Error:', error);
    
    let message = defaultMessage;
    
    if (error instanceof Error) {
      message = error.message;
    } else if (typeof error === 'string') {
      message = error;
    }
    
    // Show toast notification
    if (window.showToast) {
      window.showToast(message, 'error', window.SalesConstants.NOTIFICATIONS.ERROR_DURATION);
    }
    
    return message;
  },

  /**
   * Safe API call with retry
   */
  async safeApiCall(apiFunction, retries = null, errorMessage = null) {
    const maxRetries = retries || window.SalesConstants.LIMITS.MAX_RETRIES;
    const defaultError = errorMessage || 'فشل تحميل البيانات';
    
    for (let i = 0; i < maxRetries; i++) {
      try {
        return await apiFunction();
      } catch (error) {
        if (i === maxRetries - 1) {
          this.handleApiError(error, defaultError);
          throw error;
        }
        // Wait before retry (exponential backoff)
        await new Promise(resolve => setTimeout(resolve, 1000 * (i + 1)));
      }
    }
  }
};

// Export for use in modules
if (typeof module !== 'undefined' && module.exports) {
  module.exports = window.SalesShared;
}








