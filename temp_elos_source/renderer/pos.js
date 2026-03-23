// ═══════════════════════════════════════════════════════════════
// 🎯 ELOS POS SYSTEM - Enhanced Performance Version
// ═══════════════════════════════════════════════════════════════

// Logger fallback if utils.js not loaded yet
if (!window.Logger) window.Logger = { log: () => {}, warn: () => {}, error: console.error, debug: () => {}, info: () => {} };

// fmt fallback if utils.js not loaded yet
if (!window.fmt) window.fmt = (n, decimals = 2) => Number(n || 0).toLocaleString('en-US', { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
const fmt = window.fmt;

// escapeHtml fallback if utils.js not loaded yet
if (!window.escapeHtml) window.escapeHtml = (text) => { if (text === null || text === undefined) return ''; const div = document.createElement('div'); div.textContent = String(text); return div.innerHTML; };
const escapeHtml = window.escapeHtml;

// ═══════════════════════════════════════════════════════════════
// 🛡️ GLOBAL ERROR BOUNDARIES - حماية من الأخطاء غير المتوقعة
// ═══════════════════════════════════════════════════════════════
(function initGlobalErrorHandlers() {
  // التعامل مع أخطاء JavaScript العامة
  window.addEventListener('error', (event) => {
    Logger.error('🔴 Global Error:', {
      message: event.message,
      filename: event.filename,
      lineno: event.lineno,
      colno: event.colno,
      error: event.error
    });

    // عرض رسالة للمستخدم (لو showToast موجودة)
    if (typeof showToast === 'function') {
      showToast('حدث خطأ غير متوقع. جاري المحاولة...', 'error');
    }

    // محاولة استعادة الحالة
    try {
      if (typeof isLoading !== 'undefined') isLoading = false;
      hideSearchLoading?.();
    } catch (e) {
      Logger.error('Error in recovery:', e);
    }

    // منع الخطأ من إيقاف التطبيق
    event.preventDefault();
  });

  // التعامل مع Promise rejections غير المعالجة
  window.addEventListener('unhandledrejection', (event) => {
    Logger.error('🔴 Unhandled Promise Rejection:', event.reason);

    // عرض رسالة للمستخدم
    if (typeof showToast === 'function') {
      const message = event.reason?.message || 'حدث خطأ في العملية';
      showToast(message, 'error');
    }

    // محاولة استعادة الحالة
    try {
      if (typeof isLoading !== 'undefined') isLoading = false;
      hideSearchLoading?.();
    } catch (e) {
      Logger.error('Error in recovery:', e);
    }

    // منع الخطأ من الظهور في الكونسول كـ uncaught
    event.preventDefault();
  });

  Logger.log('✅ Global error handlers initialized');
})();

// ===== Performance Optimizations =====
const DEBOUNCE_DELAY = 150;
const SEARCH_MIN_LENGTH = 0;
const MAX_VISIBLE_CARDS = 100;
const CACHE_DURATION = 180000; // 3 minutes cache (was 30 seconds)
const LAZY_LOAD_BATCH = 20;   // عدد العناصر في كل تحميل
const VIRTUAL_LIST_THRESHOLD = 50; // Start virtualizing lists with 50+ items
const VIRTUAL_LIST_WINDOW = 20; // Render 20 items at a time

// ═══════════════════════════════════════════════════════════════
// 🏪 POS MAIN WAREHOUSE FILTERS
// ═══════════════════════════════════════════════════════════════
const posMainWarehouses = {
  devicesId: null,
  accessoriesId: null,
  repairPartsId: null,
  loaded: false,
  loadPromise: null
};

async function loadPosMainWarehouses() {
  if (posMainWarehouses.loaded) return posMainWarehouses;
  if (posMainWarehouses.loadPromise) return posMainWarehouses.loadPromise;

  posMainWarehouses.loadPromise = (async () => {
    try {
      const res = await fetch('elos-db://warehouses');
      if (!res.ok) throw new Error(await res.text());
      const data = await res.json();
      const warehouses = (data.warehouses || data || []).filter(w => w.is_active !== 0);

      posMainWarehouses.devicesId = warehouses.find(w => w.type === 'devices' && !w.is_storage_only)?.id || null;
      posMainWarehouses.accessoriesId = warehouses.find(w => w.type === 'accessories' && !w.is_storage_only)?.id || null;
      posMainWarehouses.repairPartsId = warehouses.find(w => w.type === 'repair_parts' && !w.is_storage_only)?.id || null;

      posMainWarehouses.loaded = true;
      Logger.log('[POS] Main warehouses loaded:', {
        devicesId: posMainWarehouses.devicesId,
        accessoriesId: posMainWarehouses.accessoriesId,
        repairPartsId: posMainWarehouses.repairPartsId
      });
    } catch (error) {
      Logger.error('[POS] Failed to load main warehouses:', error);
    } finally {
      posMainWarehouses.loadPromise = null;
    }
    return posMainWarehouses;
  })();

  return posMainWarehouses.loadPromise;
}

function filterToMainWarehouse(items, mainWarehouseId) {
  if (!Array.isArray(items)) return [];
  return items.filter(item => {
    const itemWarehouseId = item?.warehouse_id;
    if (itemWarehouseId === null || itemWarehouseId === undefined || itemWarehouseId === '') {
      return true;
    }
    if (!mainWarehouseId) return false;
    return String(itemWarehouseId) === String(mainWarehouseId);
  });
}

// ===== Performance Instrumentation =====
const PerfMonitor = {
  enabled: true, // Set to false in production if needed
  marks: new Map(),
  
  start(label) {
    if (!this.enabled) return;
    if (typeof performance !== 'undefined' && performance.mark) {
      performance.mark(`${label}-start`);
    }
    if (console.time) {
      console.time(label);
    }
    this.marks.set(label, performance.now());
  },
  
  end(label) {
    if (!this.enabled) return;
    if (typeof performance !== 'undefined' && performance.mark) {
      performance.mark(`${label}-end`);
      try {
        performance.measure(label, `${label}-start`, `${label}-end`);
      } catch (e) {}
    }
    if (console.timeEnd) {
      console.timeEnd(label);
    }
    const start = this.marks.get(label);
    if (start) {
      const duration = performance.now() - start;
      if (duration > 16) { // Log if > 1 frame (16ms)
        Logger.log(`⏱️ [PERF] ${label}: ${duration.toFixed(2)}ms`);
      }
      this.marks.delete(label);
    }
  }
};

// ===== localStorage Session Cache =====
const SessionCache = {
  _cache: new Map(),
  _dirty: new Set(),
  
  get(key, parseJson = true) {
    if (this._cache.has(key)) {
      return this._cache.get(key);
    }
    try {
      const value = localStorage.getItem(key);
      if (value !== null) {
        if (parseJson) {
          try {
            const parsed = JSON.parse(value);
            this._cache.set(key, parsed);
            return parsed;
          } catch {
            // If JSON parse fails, return as string
            this._cache.set(key, value);
            return value;
          }
        } else {
          // Return raw string
          this._cache.set(key, value);
          return value;
        }
      }
    } catch (e) {
      Logger.warn('SessionCache.get error:', e);
    }
    return null;
  },
  
  set(key, value, parseJson = true) {
    this._cache.set(key, value);
    this._dirty.add(key);
    // Defer localStorage write to avoid blocking
    setTimeout(() => this._flush(key, parseJson), 0);
  },
  
  _flush(key, parseJson = true) {
    if (!this._dirty.has(key)) return;
    try {
      const value = this._cache.get(key);
      if (value !== null && value !== undefined) {
        if (parseJson && typeof value !== 'string') {
          localStorage.setItem(key, JSON.stringify(value));
        } else {
          localStorage.setItem(key, String(value));
        }
      }
      this._dirty.delete(key);
    } catch (e) {
      Logger.warn('SessionCache._flush error:', e);
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
      Logger.warn('SessionCache.clear error:', e);
    }
  }
};

// Flush cache on page unload
window.addEventListener('beforeunload', () => {
  SessionCache.flushAll();
});

// ===== Security Limits =====
const MAX_DISCOUNT_PERCENT = 50; // الحد الأقصى للخصم 50%
const MIN_SALE_PRICE = 1; // الحد الأدنى لسعر البيع 1 جنيه

// ═══════════════════════════════════════════════════════════════
// 🎭 UNIFIED MODAL SYSTEM - نظام موحد للمودالات
// ═══════════════════════════════════════════════════════════════
const ModalSystem = {
  // قائمة بكل selectors المودالات
  modalSelectors: [
    '.modal[style*="display: flex"]',
    '.modal-overlay[style*="display: flex"]',
    '.cash-tx-modal.show',
    '.drawer-modal-overlay.show',
    '.unified-checkout-modal.show',
    '.checkout-modal.show',
    '#dynamicPrintModal',
    '#help-modal',
    '#shiftConfirmModal',
    '#shiftReportModal',
    '#tradeinRefundModal'
  ],

  // إغلاق كل المودالات المفتوحة - إصلاح شامل لمنع تعليق الـ overlays
  closeAll(exceptId = null) {
    const verificationModal = document.getElementById('cashVerificationModal');
    const shouldKeepVerificationOpen = verificationModal && verificationModal.style.display === 'flex';

    // ✅ FIX: Loop واحد يقفل كل أنواع المودالات بالكامل
    const allModalSelectors = '.cash-tx-modal, .drawer-modal-overlay, .unified-checkout-modal, .checkout-modal, .modal, .modal-overlay';
    document.querySelectorAll(allModalSelectors).forEach(modal => {
      if (exceptId && modal.id === exceptId) return;
      if (shouldKeepVerificationOpen && modal.id === 'cashVerificationModal') return;

      // شيل .show class + display + opacity/visibility كلهم مرة واحدة
      modal.classList.remove('show');
      if (modal.style.display === 'flex' || modal.style.display === 'block') {
        modal.style.display = 'none';
      }
      // تنظيف inline styles اللي ممكن تخلي overlay عالق
      modal.style.opacity = '';
      modal.style.visibility = '';
    });

    // إزالة المودالات الديناميكية
    ['dynamicPrintModal', 'help-modal', 'shiftConfirmModal', 'shiftReportModal', 'tradeinRefundModal'].forEach(id => {
      if (exceptId && id === exceptId) return;
      const modal = document.getElementById(id);
      if (modal) modal.remove();
    });
  },

  // التحقق من وجود مودال مفتوح
  hasOpenModal() {
    return this.modalSelectors.some(selector => document.querySelector(selector));
  }
};

// جعل ModalSystem متاح globally
window.ModalSystem = ModalSystem;

// ═══════════════════════════════════════════════════════════════
// 🛡️ OVERLAY GUARD - حماية ضد تعليق المودالات
// ═══════════════════════════════════════════════════════════════

// تنظيف أي overlay عالق بيمنع الكتابة
ModalSystem.cleanupStaleOverlays = function() {
  const allOverlays = document.querySelectorAll(
    '.modal-overlay, .drawer-modal-overlay, .cash-tx-modal, .modal, .unified-checkout-modal, .checkout-modal'
  );
  allOverlays.forEach(overlay => {
    const style = window.getComputedStyle(overlay);
    const isVisible = style.display !== 'none' && style.visibility !== 'hidden' && parseFloat(style.opacity || '1') > 0;
    if (!isVisible) return;

    // لو المودال ظاهر بس مفيش محتوى فعلي فيه = عالق
    const hasContent = overlay.querySelector('.modal-container, .drawer-modal-container, .cash-tx-content, .checkout-container');
    if (hasContent && hasContent.offsetHeight > 0) return; // مودال شغال فعلاً - متقفلوش

    console.warn('[ModalSystem] 🧹 تنظيف overlay عالق:', overlay.id || overlay.className);
    overlay.classList.remove('show');
    overlay.style.display = 'none';
    overlay.style.opacity = '';
    overlay.style.visibility = '';
  });
};

// فحص دوري كل 3 ثواني للـ overlays العالقة
setInterval(() => {
  if (!ModalSystem.hasOpenModal()) {
    ModalSystem.cleanupStaleOverlays();
  }
}, 3000);

// لو اليوزر ضغط على الـ body (مش على مودال) = في overlay عالق
document.addEventListener('click', (e) => {
  if (e.target === document.body || e.target === document.documentElement) {
    ModalSystem.cleanupStaleOverlays();
  }
}, true);

// ═══════════════════════════════════════════════════════════════
// 🌐 UNIFIED API LAYER - طبقة API موحدة
// ═══════════════════════════════════════════════════════════════
const API = {
  // Cache للبيانات المتكررة
  _cache: new Map(),
  _pendingRequests: new Map(),

  // دالة مساعدة للـ fetch مع معالجة الأخطاء
  async _fetch(url, options = {}) {
    try {
      const res = await fetch(url, options);
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || data.message || 'فشل في الاتصال');
      }
      return data;
    } catch (error) {
      Logger.error(`[API] Error fetching ${url}:`, error);
      throw error;
    }
  },

  // GET مع caching
  async get(endpoint, params = {}, useCache = false, cacheDuration = CACHE_DURATION) {
    const queryString = new URLSearchParams(params).toString();
    const url = queryString ? `elos-db://${endpoint}?${queryString}` : `elos-db://${endpoint}`;
    const cacheKey = url;

    // تحقق من الـ cache
    if (useCache && this._cache.has(cacheKey)) {
      const cached = this._cache.get(cacheKey);
      if (Date.now() - cached.timestamp < cacheDuration) {
        return cached.data;
      }
      this._cache.delete(cacheKey);
    }

    // تجنب الطلبات المتكررة المتزامنة
    if (this._pendingRequests.has(cacheKey)) {
      return this._pendingRequests.get(cacheKey);
    }

    const promise = this._fetch(url);
    this._pendingRequests.set(cacheKey, promise);

    try {
      const data = await promise;
      // حفظ في الـ cache
      if (useCache) {
        this._cache.set(cacheKey, { data, timestamp: Date.now() });
      }
      return data;
    } finally {
      this._pendingRequests.delete(cacheKey);
    }
  },

  // POST request
  async post(endpoint, body) {
    return this._fetch(`elos-db://${endpoint}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });
  },

  // PUT request
  async put(endpoint, body) {
    return this._fetch(`elos-db://${endpoint}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });
  },

  // DELETE request
  async delete(endpoint) {
    return this._fetch(`elos-db://${endpoint}`, { method: 'DELETE' });
  },

  // مسح الـ cache
  clearCache(pattern = null) {
    if (pattern) {
      for (const key of this._cache.keys()) {
        if (key.includes(pattern)) this._cache.delete(key);
      }
    } else {
      this._cache.clear();
    }
  },

  // ===== API Methods المحددة =====

  // العملاء
  clients: {
    getAll: () => API.get('clients', {}, true),
    create: (data) => API.post('clients', data),
    payment: (data) => API.post('clients-payment', data)
  },

  // الموردين
  suppliers: {
    getAll: () => API.get('suppliers', {}, true),
    payment: (data) => API.post('suppliers-payment', data)
  },

  // المخزون
  inventory: {
    search: (params) => API.get('inventory', params),
    getAccessories: () => API.get('accessories', {}, true, 60000)
  },

  // المبيعات
  sales: {
    getByDate: (from, to) => API.get('sales', { from, to }),
    sell: (data) => API.post('sell', data),
    sellAccessory: (data) => API.post('accessory-sale', data),
    getInvoiceNumber: () => API.get('invoice-number/sale'),
    getInvoice: (num) => API.get(`invoice/${num}`),
    returnInvoice: (data) => API.post('return-invoice', data)
  },

  // الإكسسوارات
  accessories: {
    getMovements: (params) => API.get('accessory-movements', params)
  },

  // الخزنة
  safe: {
    getBalance: () => API.get('main-safe-balance'),
    getLedger: (from, to) => API.get('cash-ledger', { from, to }),
    transferToDrawer: (data) => API.post('safe-to-drawer-transfer', data),
    closeShift: (data) => API.post('shift-close', data)
  },

  // التبديل (Trade-in)
  tradeIn: {
    create: (data) => API.post('trade-in-device', data),
    buyFromCustomer: (data) => API.post('buy-device-from-customer', data)
  },

  // المستخدمين
  users: {
    getCurrentRole: () => API.get('current-user-role', {}, true, 300000)
  },

  // الفواتير
  invoices: {
    getAll: () => API.get('invoices')
  }
};

// ═══════════════════════════════════════════════════════════════
// ⏳ UI LOADING STATE MANAGER - إدارة حالات التحميل
// ═══════════════════════════════════════════════════════════════
const UILoader = {
  _activeLoaders: new Set(),
  _overlay: null,

  // إنشاء الـ overlay لو مش موجود
  _ensureOverlay() {
    if (this._overlay) return this._overlay;

    this._overlay = document.createElement('div');
    this._overlay.id = 'ui-loader-overlay';
    this._overlay.innerHTML = `
      <div class="ui-loader-content">
        <div class="ui-loader-spinner"></div>
        <div class="ui-loader-text">جاري التحميل...</div>
      </div>
    `;
    this._overlay.style.cssText = `
      position: fixed;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      background: rgba(10, 14, 20, 0.85);
      backdrop-filter: blur(4px);
      z-index: 99998;
      display: none;
      align-items: center;
      justify-content: center;
      transition: opacity 0.15s ease;
      opacity: 0;
    `;

    // إضافة الـ styles
    if (!document.getElementById('ui-loader-styles')) {
      const style = document.createElement('style');
      style.id = 'ui-loader-styles';
      style.textContent = `
        .ui-loader-content {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 12px;
        }
        .ui-loader-spinner {
          width: 45px;
          height: 45px;
          border: 3px solid rgba(59, 130, 246, 0.2);
          border-top-color: #3b82f6;
          border-radius: 50%;
          animation: ui-spin 0.7s linear infinite;
        }
        .ui-loader-text {
          color: #e6e8ee;
          font-size: 14px;
          font-weight: 600;
        }
        @keyframes ui-spin {
          to { transform: rotate(360deg); }
        }

        /* Button loading state */
        .btn-loading {
          position: relative;
          pointer-events: none;
          opacity: 0.7;
        }
        .btn-loading::after {
          content: '';
          position: absolute;
          width: 16px;
          height: 16px;
          top: 50%;
          left: 50%;
          margin-top: -8px;
          margin-left: -8px;
          border: 2px solid rgba(255,255,255,0.3);
          border-top-color: #fff;
          border-radius: 50%;
          animation: ui-spin 0.6s linear infinite;
        }

        /* Input loading state */
        .input-loading {
          background-image: url('data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><circle cx="50" cy="50" r="35" fill="none" stroke="%233b82f6" stroke-width="8" stroke-dasharray="55 45" transform="rotate(0)"><animateTransform attributeName="transform" type="rotate" from="0 50 50" to="360 50 50" dur="0.8s" repeatCount="indefinite"/></circle></svg>');
          background-repeat: no-repeat;
          background-position: left 10px center;
          background-size: 20px;
          padding-left: 40px !important;
        }
      `;
      document.head.appendChild(style);
    }

    document.body.appendChild(this._overlay);
    return this._overlay;
  },

  // إظهار loader عام
  show(message = 'جاري التحميل...', key = 'default') {
    this._activeLoaders.add(key);
    const overlay = this._ensureOverlay();
    const textEl = overlay.querySelector('.ui-loader-text');
    if (textEl) textEl.textContent = message;

    overlay.style.display = 'flex';
    requestAnimationFrame(() => {
      overlay.style.opacity = '1';
    });
  },

  // إخفاء loader
  hide(key = 'default') {
    this._activeLoaders.delete(key);

    // لا تخفي لو فيه loaders تانية شغالة
    if (this._activeLoaders.size > 0) return;

    if (this._overlay) {
      this._overlay.style.opacity = '0';
      setTimeout(() => {
        if (this._activeLoaders.size === 0) {
          this._overlay.style.display = 'none';
        }
      }, 150);
    }
  },

  // تحديث النص
  updateText(message) {
    const textEl = this._overlay?.querySelector('.ui-loader-text');
    if (textEl) textEl.textContent = message;
  },

  // تفعيل loading على زر
  buttonLoading(btn, loading = true) {
    if (!btn) return;
    if (loading) {
      btn.classList.add('btn-loading');
      btn.disabled = true;
      // ✅ v1.2.7: حفظ innerHTML بدلاً من textContent للحفاظ على الأيقونات
      btn._originalHTML = btn.innerHTML;
      btn.innerHTML = '<span class="btn-spinner"></span>';
    } else {
      btn.classList.remove('btn-loading');
      btn.disabled = false;
      // استعادة المحتوى الأصلي
      if (btn._originalHTML) {
        btn.innerHTML = btn._originalHTML;
        delete btn._originalHTML;
      }
    }
  },

  // تفعيل loading على input
  inputLoading(input, loading = true) {
    if (!input) return;
    if (loading) {
      input.classList.add('input-loading');
    } else {
      input.classList.remove('input-loading');
    }
  }
};

// ═══════════════════════════════════════════════════════════════
// ↩️ UNDO MANAGER - نظام التراجع عن العمليات
// ═══════════════════════════════════════════════════════════════
const UndoManager = {
  history: [],
  maxHistory: 20,

  push(action, data, description) {
    this.history.push({
      action,
      data: JSON.parse(JSON.stringify(data)),
      description,
      timestamp: Date.now()
    });
    if (this.history.length > this.maxHistory) {
      this.history.shift();
    }
  },

  canUndo() {
    return this.history.length > 0;
  },

  undo() {
    if (!this.canUndo()) {
      showToast('لا توجد عمليات للتراجع عنها', 'info');
      return false;
    }

    const { action, data, description } = this.history.pop();

    try {
      switch (action) {
        case 'remove-from-cart':
          cart.push(data);
          renderCart();
          showToast(`↩️ تم التراجع: ${description}`, 'success', 2500);
          break;

        case 'clear-cart':
          cart = data;
          renderCart();
          showToast(`↩️ تم استرجاع السلة (${data.length} عنصر)`, 'success', 2500);
          break;

        case 'change-qty':
          const qtyItem = cart.find(c => c.id === data.itemId);
          if (qtyItem) {
            qtyItem.qty = data.oldQty;
            renderCart();
            showToast(`↩️ تم التراجع عن تغيير الكمية`, 'success', 2500);
          }
          break;

        case 'apply-discount':
          const discItem = cart.find(c => c.id === data.itemId);
          if (discItem) {
            discItem.discount = data.oldDiscount || 0;
            discItem.discountReason = data.oldReason || '';
            renderCart();
            showToast(`↩️ تم التراجع عن الخصم`, 'success', 2500);
          }
          break;

        default:
          Logger.warn('Unknown undo action:', action);
          return false;
      }
      return true;
    } catch (e) {
      Logger.error('Undo error:', e);
      return false;
    }
  },

  clear() {
    this.history = [];
  }
};

// ═══════════════════════════════════════════════════════════════
// 💡 TOOLTIP SYSTEM - نظام التلميحات
// ═══════════════════════════════════════════════════════════════
const TooltipSystem = {
  _tooltip: null,
  _hideTimeout: null,

  init() {
    // إنشاء عنصر التلميح
    this._tooltip = document.createElement('div');
    this._tooltip.id = 'ux-tooltip';
    this._tooltip.style.cssText = `
      position: fixed;
      background: var(--bg-tertiary, #1a1f29);
      color: var(--text-primary, #e6e8ee);
      padding: 8px 12px;
      border-radius: 8px;
      font-size: 12px;
      z-index: 99999;
      pointer-events: none;
      opacity: 0;
      transition: opacity 0.2s ease;
      box-shadow: 0 4px 12px rgba(0,0,0,0.3);
      border: 1px solid var(--border, #1e2530);
      max-width: 250px;
      text-align: center;
    `;
    document.body.appendChild(this._tooltip);

    // إضافة CSS للـ shortcut badge
    const style = document.createElement('style');
    style.id = 'tooltip-styles';
    style.textContent = `
      .tooltip-shortcut {
        display: inline-block;
        background: var(--accent, #3b82f6);
        color: white;
        padding: 2px 6px;
        border-radius: 4px;
        font-size: 10px;
        font-weight: 600;
        margin-top: 4px;
      }
      [data-tooltip] {
        position: relative;
      }
    `;
    document.head.appendChild(style);

    // Event delegation للـ tooltips
    document.addEventListener('mouseover', (e) => {
      try {
        if (!e.target || typeof e.target.closest !== 'function') return;
        const target = e.target.closest('[data-tooltip]');
        if (target) this.show(target);
      } catch (err) { /* ignore */ }
    }, true);

    document.addEventListener('mouseout', (e) => {
      try {
        if (!e.target || typeof e.target.closest !== 'function') return;
        const target = e.target.closest('[data-tooltip]');
        if (target) this.hide();
      } catch (err) { /* ignore */ }
    }, true);
  },

  show(element) {
    clearTimeout(this._hideTimeout);

    const text = element.dataset.tooltip;
    const shortcut = element.dataset.shortcut;

    if (!text) return;

    let html = text;
    if (shortcut) {
      html += `<div class="tooltip-shortcut">${shortcut}</div>`;
    }
    this._tooltip.innerHTML = html;

    const rect = element.getBoundingClientRect();
    const tooltipRect = this._tooltip.getBoundingClientRect();

    // حساب الموقع
    let top = rect.top - 10 - 40;
    let left = rect.left + (rect.width / 2);

    // التأكد من عدم الخروج من الشاشة
    if (top < 10) top = rect.bottom + 10;
    if (left < 10) left = 10;
    if (left > window.innerWidth - 130) left = window.innerWidth - 130;

    this._tooltip.style.top = top + 'px';
    this._tooltip.style.left = left + 'px';
    this._tooltip.style.transform = 'translateX(-50%)';
    this._tooltip.style.opacity = '1';
  },

  hide() {
    this._hideTimeout = setTimeout(() => {
      this._tooltip.style.opacity = '0';
    }, 100);
  }
};

// ═══════════════════════════════════════════════════════════════
// 📭 EMPTY STATE MANAGER - إدارة الحالات الفارغة
// ═══════════════════════════════════════════════════════════════
const EmptyStateManager = {
  templates: {
    cart: {
      icon: '🛒',
      title: 'السلة فارغة',
      description: 'ابدأ بإضافة منتجات من القائمة',
      hint: '💡 استخدم F1 للبحث أو امسح الباركود'
    },
    search: {
      icon: '🔍',
      title: 'لا توجد نتائج',
      description: 'لم يتم العثور على منتجات مطابقة',
      hint: '💡 جرب كلمات بحث مختلفة'
    },
    held: {
      icon: '📂',
      title: 'لا توجد فواتير معلقة',
      description: 'جميع الفواتير تم معالجتها',
      hint: ''
    },
    clients: {
      icon: '👥',
      title: 'لا يوجد عملاء',
      description: 'لم يتم العثور على عملاء مسجلين',
      hint: ''
    }
  },

  render(type, container, customMessage = null) {
    const template = this.templates[type];
    if (!template || !container) return;

    container.innerHTML = `
      <div class="empty-state-box">
        <div class="empty-state-icon">${template.icon}</div>
        <div class="empty-state-title">${customMessage || template.title}</div>
        <div class="empty-state-desc">${template.description}</div>
        ${template.hint ? `<div class="empty-state-hint">${template.hint}</div>` : ''}
      </div>
    `;
  },

  injectStyles() {
    if (document.getElementById('empty-state-styles')) return;

    const style = document.createElement('style');
    style.id = 'empty-state-styles';
    style.textContent = `
      .empty-state-box {
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        padding: 32px 16px;
        text-align: center;
        min-height: 200px;
        background: linear-gradient(135deg, rgba(59,130,246,0.03) 0%, rgba(168,85,247,0.03) 100%);
        border-radius: 12px;
        border: 1px dashed var(--border, #1e2530);
        margin: 16px;
      }
      .empty-state-icon {
        font-size: 48px;
        margin-bottom: 12px;
        animation: emptyFloat 3s ease-in-out infinite;
      }
      @keyframes emptyFloat {
        0%, 100% { transform: translateY(0); }
        50% { transform: translateY(-8px); }
      }
      .empty-state-title {
        font-size: 16px;
        font-weight: 600;
        color: var(--text-primary, #e6e8ee);
        margin-bottom: 6px;
      }
      .empty-state-desc {
        font-size: 13px;
        color: var(--text-secondary, #8b93a6);
        margin-bottom: 12px;
      }
      .empty-state-hint {
        font-size: 12px;
        background: rgba(59,130,246,0.1);
        padding: 8px 12px;
        border-radius: 6px;
        border-right: 3px solid var(--accent, #3b82f6);
      }
    `;
    document.head.appendChild(style);
  }
};

// ═══════════════════════════════════════════════════════════════
// 🖱️ CONTEXT MENU - قائمة السياق (Right-Click)
// ═══════════════════════════════════════════════════════════════
const ContextMenu = {
  _menu: null,

  init() {
    this._menu = document.createElement('div');
    this._menu.id = 'context-menu';
    this._menu.style.cssText = `
      position: fixed;
      background: var(--bg-secondary, #151921);
      border: 1px solid var(--border, #1e2530);
      border-radius: 8px;
      padding: 4px;
      z-index: 99999;
      box-shadow: 0 8px 24px rgba(0,0,0,0.4);
      min-width: 160px;
      display: none;
    `;
    document.body.appendChild(this._menu);

    // إغلاق عند النقر خارج القائمة
    document.addEventListener('click', () => this.hide());
    document.addEventListener('contextmenu', (e) => {
      if (!e.target.closest('#context-menu')) {
        this.hide();
      }
    });

    // إضافة CSS
    const style = document.createElement('style');
    style.id = 'context-menu-styles';
    style.textContent = `
      .ctx-menu-item {
        display: flex;
        align-items: center;
        gap: 8px;
        width: 100%;
        padding: 8px 12px;
        border: none;
        background: transparent;
        color: var(--text-primary, #e6e8ee);
        text-align: right;
        cursor: pointer;
        font-size: 13px;
        border-radius: 4px;
        transition: all 0.15s ease;
      }
      .ctx-menu-item:hover {
        background: var(--bg-tertiary, #1a1f29);
      }
      .ctx-menu-item.danger {
        color: var(--danger, #ef4444);
      }
      .ctx-menu-item.danger:hover {
        background: rgba(239,68,68,0.1);
      }
      .ctx-menu-divider {
        height: 1px;
        background: var(--border, #1e2530);
        margin: 4px 0;
      }
    `;
    document.head.appendChild(style);
  },

  show(x, y, items) {
    this._menu.innerHTML = '';

    items.forEach(item => {
      if (item.divider) {
        const div = document.createElement('div');
        div.className = 'ctx-menu-divider';
        this._menu.appendChild(div);
        return;
      }

      const btn = document.createElement('button');
      btn.className = 'ctx-menu-item' + (item.danger ? ' danger' : '');
      btn.innerHTML = `<span>${item.icon || ''}</span><span>${item.label}</span>`;
      btn.onclick = (e) => {
        e.stopPropagation();
        this.hide();
        item.action();
      };
      this._menu.appendChild(btn);
    });

    // تحديد الموقع
    this._menu.style.display = 'block';
    const menuRect = this._menu.getBoundingClientRect();

    let finalX = x;
    let finalY = y;

    if (x + menuRect.width > window.innerWidth) {
      finalX = window.innerWidth - menuRect.width - 10;
    }
    if (y + menuRect.height > window.innerHeight) {
      finalY = window.innerHeight - menuRect.height - 10;
    }

    this._menu.style.left = finalX + 'px';
    this._menu.style.top = finalY + 'px';
  },

  hide() {
    this._menu.style.display = 'none';
  }
};

// ═══════════════════════════════════════════════════════════════
// ✨ VISUAL FEEDBACK - التأثيرات البصرية
// ═══════════════════════════════════════════════════════════════
const VisualFeedback = {
  injectStyles() {
    if (document.getElementById('visual-feedback-styles')) return;

    const style = document.createElement('style');
    style.id = 'visual-feedback-styles';
    style.textContent = `
      /* تأثير إضافة للسلة */
      @keyframes addToCartPop {
        0% { transform: scale(1); }
        50% { transform: scale(1.05); background: rgba(16,185,129,0.2); }
        100% { transform: scale(1); }
      }
      .cart-item-added {
        animation: addToCartPop 0.4s ease;
      }

      /* تأثير تغيير السعر */
      @keyframes priceChange {
        0% { background: rgba(59,130,246,0.3); }
        100% { background: transparent; }
      }
      .price-updated {
        animation: priceChange 0.6s ease;
        border-radius: 4px;
      }

      /* تأثير الحذف */
      @keyframes removeSlide {
        0% { opacity: 1; transform: translateX(0); }
        100% { opacity: 0; transform: translateX(50px); }
      }
      .item-removing {
        animation: removeSlide 0.3s ease forwards;
      }

      /* Badge للسلة */
      .cart-badge {
        position: absolute;
        top: -8px;
        right: -8px;
        background: var(--danger, #ef4444);
        color: white;
        min-width: 20px;
        height: 20px;
        border-radius: 10px;
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 11px;
        font-weight: bold;
        animation: badgePop 0.3s ease;
      }
      @keyframes badgePop {
        0% { transform: scale(0); }
        50% { transform: scale(1.3); }
        100% { transform: scale(1); }
      }

      /* تأثير النجاح */
      @keyframes successPulse {
        0% { box-shadow: 0 0 0 0 rgba(16,185,129,0.4); }
        70% { box-shadow: 0 0 0 10px rgba(16,185,129,0); }
        100% { box-shadow: 0 0 0 0 rgba(16,185,129,0); }
      }
      .success-pulse {
        animation: successPulse 0.6s ease;
      }

      /* Shortcut feedback */
      .shortcut-feedback {
        position: fixed;
        bottom: 80px;
        left: 50%;
        transform: translateX(-50%);
        background: var(--bg-tertiary, #1a1f29);
        color: var(--text-primary, #e6e8ee);
        padding: 10px 16px;
        border-radius: 8px;
        font-size: 13px;
        z-index: 99999;
        box-shadow: 0 4px 12px rgba(0,0,0,0.3);
        border: 1px solid var(--border, #1e2530);
        animation: feedbackIn 0.3s ease, feedbackOut 0.3s ease 1.5s forwards;
      }
      .shortcut-feedback kbd {
        background: var(--accent, #3b82f6);
        color: white;
        padding: 2px 6px;
        border-radius: 4px;
        font-size: 11px;
        margin-right: 6px;
      }
      @keyframes feedbackIn {
        from { opacity: 0; transform: translateX(-50%) translateY(20px); }
        to { opacity: 1; transform: translateX(-50%) translateY(0); }
      }
      @keyframes feedbackOut {
        from { opacity: 1; }
        to { opacity: 0; }
      }
    `;
    document.head.appendChild(style);
  },

  showShortcutFeedback(key, action) {
    const feedback = document.createElement('div');
    feedback.className = 'shortcut-feedback';
    feedback.innerHTML = `<kbd>${key}</kbd> ${action}`;
    document.body.appendChild(feedback);
    setTimeout(() => feedback.remove(), 2000);
  },

  animateAdd(element) {
    element.classList.add('cart-item-added');
    setTimeout(() => element.classList.remove('cart-item-added'), 400);
  },

  animateRemove(element, callback) {
    element.classList.add('item-removing');
    setTimeout(() => {
      if (callback) callback();
    }, 300);
  },

  animatePriceUpdate(element) {
    element.classList.add('price-updated');
    setTimeout(() => element.classList.remove('price-updated'), 600);
  }
};

// ═══════════════════════════════════════════════════════════════
// 🔤 FONT SIZE CONTROL - التحكم بحجم الخط
// ═══════════════════════════════════════════════════════════════
const FontSizeControl = {
  levels: ['صغير', 'عادي', 'كبير', 'أكبر'],
  currentLevel: 1, // عادي

  init() {
    const saved = localStorage.getItem('elos-font-size');
    if (saved !== null) {
      this.currentLevel = parseInt(saved);
      this.apply();
    }
  },

  increase() {
    if (this.currentLevel < this.levels.length - 1) {
      this.currentLevel++;
      this.apply();
      this.save();
      showToast(`حجم الخط: ${this.levels[this.currentLevel]}`, 'info', 1500);
    } else {
      showToast('وصلت للحد الأقصى', 'warning', 1500);
    }
  },

  decrease() {
    if (this.currentLevel > 0) {
      this.currentLevel--;
      this.apply();
      this.save();
      showToast(`حجم الخط: ${this.levels[this.currentLevel]}`, 'info', 1500);
    } else {
      showToast('وصلت للحد الأدنى', 'warning', 1500);
    }
  },

  apply() {
    const sizes = [14, 16, 18, 20];
    document.documentElement.style.fontSize = sizes[this.currentLevel] + 'px';
  },

  save() {
    localStorage.setItem('elos-font-size', this.currentLevel);
  }
};

// ═══════════════════════════════════════════════════════════════
// ❓ HELP SYSTEM - نظام المساعدة
// ═══════════════════════════════════════════════════════════════
const HelpSystem = {
  shortcuts: [
    { key: 'F1', action: 'التركيز على البحث' },
    { key: 'F2', action: 'إتمام البيع' },
    { key: 'F3', action: 'مسح السلة' },
    { key: 'F4', action: 'تعليق الفاتورة' },
    { key: 'F5', action: 'استرجاع فاتورة' },
    { key: 'F8', action: 'فتح الدرج' },
    { key: 'F9', action: 'إغلاق الوردية' },
    { key: 'Ctrl+Z', action: 'التراجع عن آخر عملية' },
    { key: 'Ctrl+/', action: 'عرض الاختصارات' },
    { key: 'Ctrl++', action: 'تكبير الخط' },
    { key: 'Ctrl+-', action: 'تصغير الخط' },
    { key: 'Escape', action: 'إغلاق النوافذ' }
  ],

  showModal() {
    // إزالة modal سابق لو موجود
    const existing = document.getElementById('help-modal');
    if (existing) existing.remove();

    const modal = document.createElement('div');
    modal.id = 'help-modal';
    modal.style.cssText = `
      position: fixed;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      background: rgba(0,0,0,0.6);
      z-index: 2500;
      display: flex;
      align-items: center;
      justify-content: center;
      animation: fadeIn 0.2s ease;
    `;

    modal.innerHTML = `
      <div style="
        background: var(--bg-secondary, #151921);
        border-radius: 16px;
        padding: 24px;
        max-width: 500px;
        width: 90%;
        max-height: 80vh;
        overflow-y: auto;
        box-shadow: 0 20px 50px rgba(0,0,0,0.5);
        border: 1px solid var(--border, #1e2530);
      ">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px;">
          <h2 style="margin: 0; color: var(--text-primary, #e6e8ee); font-size: 20px;">
            ⌨️ اختصارات لوحة المفاتيح
          </h2>
          <button onclick="document.getElementById('help-modal').remove()" style="
            background: transparent;
            border: none;
            color: var(--text-secondary, #8b93a6);
            font-size: 24px;
            cursor: pointer;
            padding: 4px;
          ">&times;</button>
        </div>
        <div style="display: flex; flex-direction: column; gap: 8px;">
          ${this.shortcuts.map(s => `
            <div style="
              display: flex;
              justify-content: space-between;
              align-items: center;
              padding: 10px 12px;
              background: var(--bg-tertiary, #1a1f29);
              border-radius: 8px;
            ">
              <span style="color: var(--text-primary, #e6e8ee);">${s.action}</span>
              <kbd style="
                background: var(--accent, #3b82f6);
                color: white;
                padding: 4px 10px;
                border-radius: 6px;
                font-size: 12px;
                font-weight: 600;
              ">${s.key}</kbd>
            </div>
          `).join('')}
        </div>
        <div style="
          margin-top: 20px;
          padding: 12px;
          background: rgba(59,130,246,0.1);
          border-radius: 8px;
          border-right: 3px solid var(--accent, #3b82f6);
          font-size: 13px;
          color: var(--text-secondary, #8b93a6);
        ">
          💡 <strong>نصيحة:</strong> اضغط <kbd style="background: #333; padding: 2px 6px; border-radius: 4px;">Ctrl+/</kbd> في أي وقت لعرض هذه القائمة
        </div>
      </div>
    `;

    modal.addEventListener('click', (e) => {
      if (e.target === modal) modal.remove();
    });

    document.body.appendChild(modal);
  }
};

// ═══════════════════════════════════════════════════════════════
// 🚀 UX ENHANCEMENTS INIT - تهيئة تحسينات UX
// ═══════════════════════════════════════════════════════════════
function initUXEnhancements() {
  // تهيئة الأنظمة
  TooltipSystem.init();
  ContextMenu.init();
  EmptyStateManager.injectStyles();
  VisualFeedback.injectStyles();
  FontSizeControl.init();

  // إضافة Tooltips على الأزرار الرئيسية
  setTimeout(() => {
    const tooltips = [
      { selector: '#btnFind', text: 'بحث عن منتج', shortcut: 'F1' },
      { selector: '#btnClear', text: 'مسح السلة بالكامل', shortcut: 'F3' },
      { selector: '#btnHold', text: 'تعليق الفاتورة الحالية', shortcut: 'F4' },
      { selector: '#btnRetrieve', text: 'استرجاع فاتورة معلقة', shortcut: 'F5' },
      { selector: '#btnOpenDrawer', text: 'فتح درج النقود', shortcut: 'F8' },
      { selector: '#btnCloseShift', text: 'إغلاق الوردية وتسليمها', shortcut: 'F9' }
    ];

    tooltips.forEach(({ selector, text, shortcut }) => {
      const el = document.querySelector(selector);
      if (el) {
        el.dataset.tooltip = text;
        if (shortcut) el.dataset.shortcut = shortcut;
      }
    });
  }, 500);

  // Right-Click على عناصر السلة
  document.addEventListener('contextmenu', (e) => {
    const cartItem = e.target.closest('.cart-item, .cart-row');
    if (cartItem) {
      e.preventDefault();
      const itemId = cartItem.dataset.id || cartItem.dataset.itemId;

      ContextMenu.show(e.pageX, e.pageY, [
        { icon: '✏️', label: 'تعديل السعر', action: () => editCartItemPrice(itemId) },
        { icon: '🏷️', label: 'تطبيق خصم', action: () => openDiscountModal(itemId) },
        { icon: '📝', label: 'إضافة ملاحظة', action: () => addCartItemNote(itemId) },
        { divider: true },
        { icon: '🗑️', label: 'حذف من السلة', action: () => removeFromCartWithUndo(itemId), danger: true }
      ]);
    }
  });

  // إظهار رسالة ترحيبية للمستخدم الجديد
  const isFirstTime = !localStorage.getItem('elos-pos-welcomed');
  if (isFirstTime) {
    setTimeout(() => {
      showToast('👋 مرحباً! اضغط Ctrl+/ لعرض اختصارات لوحة المفاتيح', 'info', 5000);
      localStorage.setItem('elos-pos-welcomed', '1');
    }, 2000);
  }

  Logger.log('✅ UX Enhancements initialized');
}

// دالة حذف مع دعم Undo
function removeFromCartWithUndo(itemId) {
  const index = cart.findIndex(c => c.id == itemId || c.id === Number(itemId));
  if (index === -1) return;

  const item = cart[index];
  UndoManager.push('remove-from-cart', item, `حذف ${item.label || item.name}`);

  cart.splice(index, 1);
  renderCart();
  showToast(`🗑️ تم الحذف (Ctrl+Z للتراجع)`, 'success', 3000);
}

// تهيئة عند تحميل الصفحة
document.addEventListener('DOMContentLoaded', () => {
  initUXEnhancements();
  // تحديث بطاقة المستخدم بعد تحميل الصفحة
  setTimeout(() => {
    updateUserCard();
  }, 100);
});

// ═══════════════════════════════════════════════════════════════
// 📦 CENTRALIZED STATE MANAGEMENT - إدارة الحالة المركزية
// ═══════════════════════════════════════════════════════════════
const AppState = {
  // بيانات العملاء
  clients: {
    list: [],
    selectedId: null
  },

  // بيانات المخزون
  inventory: {
    devices: [],      // أجهزة
    accessories: [],  // إكسسوارات
    currentStore: 'devices' // 'devices' or 'accessories'
  },

  // حالة التطبيق
  ui: {
    isLoading: false,
    currentPage: 'pos'
  }
};

// Backward compatibility - للتوافق مع الكود القديم
let clientsList = AppState.clients.list;
let selectedClientId = AppState.clients.selectedId;
let currentStore = AppState.inventory.currentStore;
let accessoriesPool = AppState.inventory.accessories;
let devicesPool = AppState.inventory.devices;
let repairPartsPool = []; // قطع الغيار

// ═══════════════════════════════════════════════════════════════
// 💳 PAYMENT WALLETS MANAGEMENT - إدارة المحافظ المتعددة
// ═══════════════════════════════════════════════════════════════
let paymentWallets = []; // قائمة المحافظ المتاحة

// تحميل المحافظ من الخادم
async function loadPaymentWallets() {
  try {
    const res = await fetch('elos-db://payment-wallets?active_only=true');
    if (!res.ok) throw new Error(await res.text());
    paymentWallets = await res.json();
    Logger.log('[POS] Payment wallets loaded:', paymentWallets.length);
    return paymentWallets;
  } catch (error) {
    Logger.error('[POS] Failed to load payment wallets:', error);
    return [];
  }
}

// ✅ تحديث قائمة المحافظ حسب نوع الشراء (لشراء من موزع في POS)
async function updatePOSPurchaseWalletsList() {
  const paymentMethod = document.getElementById('purchasePaymentMethod')?.value;
  const walletSelectGroup = document.getElementById('posPurchaseWalletSelectGroup');
  const walletSelect = document.getElementById('posPurchaseWalletSelect');
  
  if (!paymentMethod || !walletSelectGroup || !walletSelect) return;
  
  // تحديد نوع المحفظة
  let walletType = null;
  if (paymentMethod === 'transfer') {
    walletType = 'mobile_wallet';
  } else if (paymentMethod === 'bank') {
    walletType = 'bank';
  }
  
  // فقط للمحافظ الإلكترونية والحسابات البنكية
  if (!walletType) {
    walletSelectGroup.style.display = 'none';
    return;
  }
  
  // Load wallets if not already loaded
  if (paymentWallets.length === 0) {
    await loadPaymentWallets();
  }
  
  // Filter wallets by type
  const filteredWallets = paymentWallets.filter(w => w.type === walletType);
  
  if (filteredWallets.length === 0) {
    walletSelectGroup.style.display = 'none';
    walletSelect.innerHTML = '<option value="">لا توجد محافظ متاحة</option>';
    return;
  }
  
  // Show the select and populate options
  walletSelectGroup.style.display = 'block';
  walletSelect.innerHTML = filteredWallets.map(w => {
    const isDefault = w.is_default ? ' (افتراضي)' : '';
    const displayName = w.name + isDefault;
    return `<option value="${w.id}" ${w.is_default ? 'selected' : ''}>${displayName}</option>`;
  }).join('');
}
window.updatePOSPurchaseWalletsList = updatePOSPurchaseWalletsList;

// ✅ تحديث قائمة المحافظ حسب نوع المرتجع (للمرتجع في POS)
async function updatePOSReturnWalletsList() {
  const walletTypeSelect = document.getElementById('returnWalletType');
  const walletSelectGroup = document.getElementById('posReturnWalletSelectGroup');
  const walletSelect = document.getElementById('posReturnWalletSelect');
  
  if (!walletTypeSelect || !walletSelectGroup || !walletSelect) return;
  
  const walletType = walletTypeSelect.value;
  
  // فقط للمحافظ الإلكترونية والحسابات البنكية
  if (walletType !== 'mobile_wallet' && walletType !== 'bank') {
    walletSelectGroup.style.display = 'none';
    return;
  }
  
  // Load wallets if not already loaded
  if (paymentWallets.length === 0) {
    await loadPaymentWallets();
  }
  
  // Filter wallets by type
  const filteredWallets = paymentWallets.filter(w => w.type === walletType);
  
  if (filteredWallets.length === 0) {
    walletSelectGroup.style.display = 'none';
    walletSelect.innerHTML = '<option value="">لا توجد محافظ متاحة</option>';
    return;
  }
  
  // Show the select and populate options
  walletSelectGroup.style.display = 'block';
  walletSelect.innerHTML = filteredWallets.map(w => {
    const isDefault = w.is_default ? ' (افتراضي)' : '';
    const displayName = w.name + isDefault;
    return `<option value="${w.id}" ${w.is_default ? 'selected' : ''}>${displayName}</option>`;
  }).join('');
}
window.updatePOSReturnWalletsList = updatePOSReturnWalletsList;

// ═══════════════════════════════════════════════════════════════
// Drag & Drop لبطاقات المحافظ في درج الكاش
// ═══════════════════════════════════════════════════════════════

function getWalletCardOrder() {
  try {
    const saved = localStorage.getItem('walletCardOrder');
    return saved ? JSON.parse(saved) : null;
  } catch (e) {
    return null;
  }
}

function saveWalletCardOrder(orderArray) {
  try {
    localStorage.setItem('walletCardOrder', JSON.stringify(orderArray));
  } catch (e) {
    Logger.error('[WALLET-DND] Failed to save wallet order:', e);
  }
}

function sortWalletsByOrder(wallets, savedOrder) {
  if (!savedOrder || savedOrder.length === 0) return wallets;

  const orderMap = {};
  savedOrder.forEach((id, index) => { orderMap[id] = index; });

  // محافظ موجودة في الترتيب المحفوظ
  const sorted = [];
  const unsorted = [];

  wallets.forEach(w => {
    if (orderMap[w.id] !== undefined) {
      sorted.push(w);
    } else {
      unsorted.push(w); // محافظ جديدة → في الآخر
    }
  });

  sorted.sort((a, b) => orderMap[a.id] - orderMap[b.id]);
  return [...sorted, ...unsorted];
}

let _draggedWalletCard = null;

function initWalletDragDrop() {
  const container = document.getElementById('drawerWalletsSection') || document.querySelector('.drawer-wallets-section');
  if (!container) return;

  const cards = container.querySelectorAll('.drawer-wallet-card[draggable="true"]');

  cards.forEach(card => {
    card.addEventListener('dragstart', (e) => {
      _draggedWalletCard = card;
      card.classList.add('dragging');
      container.classList.add('drag-active');
      e.dataTransfer.effectAllowed = 'move';
      e.dataTransfer.setData('text/plain', card.dataset.walletId);
    });

    card.addEventListener('dragend', () => {
      card.classList.remove('dragging');
      container.classList.remove('drag-active');
      container.querySelectorAll('.drag-over').forEach(el => el.classList.remove('drag-over'));
      _draggedWalletCard = null;
    });

    card.addEventListener('dragover', (e) => {
      e.preventDefault();
      e.dataTransfer.dropEffect = 'move';
      if (_draggedWalletCard && card !== _draggedWalletCard) {
        card.classList.add('drag-over');
      }
    });

    card.addEventListener('dragleave', () => {
      card.classList.remove('drag-over');
    });

    card.addEventListener('drop', (e) => {
      e.preventDefault();
      card.classList.remove('drag-over');

      if (!_draggedWalletCard || card === _draggedWalletCard) return;

      // تحديد مكان الإدراج (قبل أو بعد البطاقة الهدف)
      const allCards = [...container.querySelectorAll('.drawer-wallet-card')];
      const draggedIndex = allCards.indexOf(_draggedWalletCard);
      const targetIndex = allCards.indexOf(card);

      if (draggedIndex < targetIndex) {
        card.after(_draggedWalletCard);
      } else {
        card.before(_draggedWalletCard);
      }

      // حفظ الترتيب الجديد
      const newOrder = [...container.querySelectorAll('.drawer-wallet-card')].map(c => Number(c.dataset.walletId));
      saveWalletCardOrder(newOrder);

      Logger.log('[WALLET-DND] New order saved:', newOrder);
    });
  });
}

// ═══════════════════════════════════════════════════════════════

// تحديث عرض المحافظ في درج الكاش
async function updateDrawerWalletsDisplay(walletsMap, cashTotal, mobileTotal, bankTotal) {
  const walletsSection = document.getElementById('drawerWalletsSection') || document.querySelector('.drawer-wallets-section');
  if (!walletsSection) return;

  // تحميل المحافظ إذا لم تكن محملة
  if (paymentWallets.length === 0) {
    await loadPaymentWallets();
  }

  // أيقونات وألوان المحافظ
  const walletIcons = {
    cash: '💵',
    mobile_wallet: '📱',
    bank: '🏦'
  };

  const walletColors = {
    cash: '#10b981',
    mobile_wallet: '#8b5cf6',
    bank: '#3b82f6'
  };

  // ✅ ترتيب المحافظ حسب الترتيب المحفوظ (drag & drop)
  const activeWallets = paymentWallets.filter(w => w.is_active !== 0);
  const savedOrder = getWalletCardOrder();
  const sortedWallets = sortWalletsByOrder(activeWallets, savedOrder);

  // إنشاء HTML للمحافظ
  let walletsHTML = '';

  sortedWallets.forEach(wallet => {
    const type = wallet.type;
    const balance = walletsMap[wallet.id]?.balance || 0;
    const icon = walletIcons[type];
    const color = walletColors[type];
    const cardClass = type === 'mobile_wallet' ? 'mobile' : type;

    walletsHTML += `
      <div class="drawer-wallet-card ${cardClass}" draggable="true" data-wallet-id="${wallet.id}" data-wallet-type="${type}" style="border-left: 4px solid ${color};">
        <div class="wallet-card-header">
          <span class="wallet-drag-handle" title="اسحب لإعادة الترتيب">⠿</span>
          <div class="wallet-card-icon">${icon}</div>
          <div class="wallet-card-title">${escapeHtml(wallet.name)}${wallet.is_default ? ' <span style="font-size: 10px; color: var(--success);">(افتراضي)</span>' : ''}</div>
        </div>
        <div class="wallet-card-balance">
          <span class="wallet-amount" data-wallet-balance="${wallet.id}">${fmt(balance)}</span>
          <span class="wallet-currency">ج.م</span>
        </div>
        <div class="wallet-card-stats">
          <span class="wallet-stat"><span class="stat-icon">📥</span> <span data-wallet-in="${wallet.id}">0</span></span>
          <span class="wallet-stat"><span class="stat-icon">📤</span> <span data-wallet-out="${wallet.id}">0</span></span>
        </div>
        <div class="wallet-card-actions">
          <button class="wallet-action-btn deposit" onclick="openWalletDepositModalById(${wallet.id})" title="إيداع">
            <span>📥</span> إيداع
          </button>
          <button class="wallet-action-btn withdraw" onclick="openWalletWithdrawModalById(${wallet.id})" title="سحب">
            <span>📤</span> سحب
          </button>
          <button class="wallet-action-btn transfer" onclick="openWalletTransferModal(${wallet.id})" title="تحويل">
            <span>🔄</span> تحويل
          </button>
          <button class="wallet-action-btn history" onclick="openWalletHistoryModal(${wallet.id}, '${escapeHtml(wallet.name)}')" title="سجل المعاملات">
            <span>📋</span> السجل
          </button>
        </div>
      </div>
    `;
  });

  // تحديث HTML
  walletsSection.innerHTML = walletsHTML || walletsSection.innerHTML;

  // ✅ تفعيل Drag & Drop
  initWalletDragDrop();
}

// ✅ تحديث ملخص المحافظ في التقفيل
async function updateClosingWalletsSummary(walletsMap, data) {
  const container = document.getElementById('closingWalletsContainer');
  if (!container) return;
  
  // تحميل المحافظ إذا لم تكن محملة
  if (paymentWallets.length === 0) {
    await loadPaymentWallets();
  }
  
  if (!walletsMap || Object.keys(walletsMap).length === 0) {
    container.innerHTML = '<div style="text-align: center; padding: 20px; color: var(--text-secondary);">لا توجد محافظ</div>';
    return;
  }
  
  // أيقونات وألوان المحافظ
  const walletIcons = {
    cash: '💵',
    mobile_wallet: '📱',
    bank: '🏦'
  };
  
  const walletColors = {
    cash: '#10b981',
    mobile_wallet: '#8b5cf6',
    bank: '#3b82f6'
  };
  
  // تجميع المحافظ حسب النوع
  const walletsByType = {
    cash: [],
    mobile_wallet: [],
    bank: []
  };
  
  Object.values(walletsMap).forEach(w => {
    if (walletsByType[w.type]) {
      walletsByType[w.type].push(w);
    }
  });
  
  let walletsHTML = '';
  let grandTotal = 0;
  
  // عرض المحافظ حسب النوع
  ['cash', 'mobile_wallet', 'bank'].forEach(type => {
    const wallets = walletsByType[type];
    if (wallets.length === 0) return;
    
    wallets.forEach(wallet => {
      // ✅ استخدام الرصيد الفعلي من walletsMap (من cash_ledger)
      const actualBalance = walletsMap[wallet.id]?.balance || 0;
      
      // ✅ حساب المبيعات لهذه المحفظة المحددة (per wallet_id من API)
      let walletSales = walletsMap[wallet.id]?.sales || 0;
      // حساب الإيداعات والمسحوبات من حركات اليوم
      const deposits = data.walletDepositsById?.[wallet.id] || 0;
      const withdraws = data.walletWithdrawsById?.[wallet.id] || 0;
      
      // حساب المشتريات (حالياً per type - نعرضها للمحفظة الافتراضية فقط)
      let purchases = 0;
      if (wallet.is_default) {
        if (type === 'cash') {
          purchases = data.posPurchasesCash || 0;
        } else if (type === 'mobile_wallet') {
          purchases = data.posPurchasesMobile || 0;
        } else if (type === 'bank') {
          purchases = data.posPurchasesBank || 0;
        }
      }

      // حساب فائض السحب (حالياً per type - نعرضها للمحفظة الافتراضية فقط)
      let safeWithdrawsSurplus = 0;
      if (wallet.is_default) {
        if (type === 'cash') {
          safeWithdrawsSurplus = data.safeWithdrawsSurplusCash || 0;
        } else if (type === 'mobile_wallet') {
          safeWithdrawsSurplus = data.safeWithdrawsSurplusMobile || 0;
        } else if (type === 'bank') {
          safeWithdrawsSurplus = data.safeWithdrawsSurplusBank || 0;
        }
      }
      
      // ✅ استخدام الرصيد الفعلي بدلاً من حساب الصافي من حركات اليوم فقط
      // الرصيد الفعلي يشمل كل الحركات (منذ بداية النظام)، وليس فقط حركات اليوم
      const net = actualBalance;
      grandTotal += net;
      
      const icon = walletIcons[type];
      const color = walletColors[type];
      
      walletsHTML += `
        <div class="closing-wallet-row" data-wallet-type="${type}" style="border-right: 4px solid ${color};">
          <div class="wallet-row-header">
            <span class="wallet-row-icon">${icon}</span>
            <span class="wallet-row-name">${escapeHtml(wallet.name)}${wallet.is_default ? ' <span style="font-size: 10px; color: var(--success);">(افتراضي)</span>' : ''}</span>
          </div>
          <div class="wallet-row-details">
            <div class="wallet-detail">
              <span class="detail-label">مبيعات</span>
              <span class="detail-value positive">${fmt(walletSales)}</span>
            </div>
            ${deposits > 0 ? `
            <div class="wallet-detail">
              <span class="detail-label">إيداعات</span>
              <span class="detail-value positive">${fmt(deposits)}</span>
            </div>
            ` : ''}
            ${withdraws > 0 ? `
            <div class="wallet-detail">
              <span class="detail-label">مسحوبات</span>
              <span class="detail-value negative">${fmt(withdraws)}</span>
            </div>
            ` : ''}
            ${purchases > 0 ? `
            <div class="wallet-detail">
              <span class="detail-label">مشتريات</span>
              <span class="detail-value negative">${fmt(purchases)}</span>
            </div>
            ` : ''}
            <div class="wallet-detail net">
              <span class="detail-label">الصافي</span>
              <span class="detail-value ${net >= 0 ? 'positive' : 'negative'}">${fmt(net)}</span>
            </div>
          </div>
        </div>
      `;
    });
  });
  
  container.innerHTML = walletsHTML;
  
  // تحديث الإجمالي
  const closingGrandTotal = document.getElementById('closingGrandTotal');
  if (closingGrandTotal) {
    closingGrandTotal.textContent = fmt(grandTotal) + ' ج.م';
  }
}

// تحديث قائمة المحافظ في dropdown حسب نوع الدفع
async function updateWalletSelect(walletType, selectElementId) {
  const select = document.getElementById(selectElementId);
  if (!select) return;
  
  // تحميل المحافظ إذا لم تكن محملة
  if (paymentWallets.length === 0) {
    await loadPaymentWallets();
  }
  
  // فلترة المحافظ حسب النوع
  const filteredWallets = paymentWallets.filter(w => w.type === walletType);
  
  // تحديث options
  select.innerHTML = '';
  if (filteredWallets.length === 0) {
    select.innerHTML = '<option value="">لا توجد محافظ متاحة</option>';
    select.disabled = true;
  } else {
    select.disabled = false;
    filteredWallets.forEach(w => {
      const option = document.createElement('option');
      option.value = w.id;
      option.textContent = w.name + (w.is_default ? ' (افتراضي)' : '');
      if (w.is_default) option.selected = true;
      select.appendChild(option);
    });
  }
}

// Sync helpers
function syncClientState() {
  AppState.clients.list = clientsList;
  AppState.clients.selectedId = selectedClientId;
}

function syncInventoryState() {
  AppState.inventory.devices = devicesPool;
  AppState.inventory.accessories = accessoriesPool;
  AppState.inventory.currentStore = currentStore;
}

// ===== Error Messages Translation =====
const ERROR_TRANSLATIONS = {
  'network error': 'خطأ في الاتصال بالشبكة',
  'connection refused': 'تم رفض الاتصال بالخادم',
  'timeout': 'انتهت مهلة الاتصال',
  'not found': 'العنصر غير موجود',
  'unauthorized': 'غير مصرح لك بهذا الإجراء',
  'forbidden': 'هذا الإجراء محظور',
  'internal server error': 'خطأ داخلي في الخادم',
  'bad request': 'طلب غير صالح',
  'service unavailable': 'الخدمة غير متوفرة حالياً',
  'failed to fetch': 'فشل في الاتصال بالخادم',
  'database error': 'خطأ في قاعدة البيانات',
  'validation error': 'خطأ في البيانات المدخلة',
  'duplicate entry': 'هذا العنصر موجود مسبقاً',
  'insufficient stock': 'الكمية المطلوبة غير متوفرة',
  'insufficient balance': 'الرصيد غير كافي',
  'permission denied': 'ليس لديك صلاحية لهذا الإجراء',
  'session expired': 'انتهت صلاحية الجلسة، يرجى تسجيل الدخول مجدداً',
  'invalid credentials': 'بيانات الدخول غير صحيحة',
  'record not found': 'السجل غير موجود',
  'already exists': 'موجود مسبقاً',
  'cannot delete': 'لا يمكن الحذف',
  'operation failed': 'فشلت العملية'
};

function translateError(message) {
  if (!message) return 'حدث خطأ غير معروف';
  const lowerMsg = message.toLowerCase();
  for (const [eng, ar] of Object.entries(ERROR_TRANSLATIONS)) {
    if (lowerMsg.includes(eng)) return ar;
  }
  return message; // Return original if no translation found
}

// ═══════════════════════════════════════════════════════════════
// 🔊 SOUND TOGGLE FUNCTIONS
// ═══════════════════════════════════════════════════════════════
function toggleAppSound() {
  const isEnabled = SoundFX.toggle();
  updateSoundButtonState();
  if (isEnabled) SoundFX.play('click');
}

function updateSoundButtonState() {
  const soundOnIcon = document.getElementById('soundOnIcon');
  const soundOffIcon = document.getElementById('soundOffIcon');
  const soundBtn = document.getElementById('soundToggleBtn');

  if (!soundOnIcon || !soundOffIcon || !soundBtn) return;

  if (SoundFX.enabled) {
    soundOnIcon.style.display = 'block';
    soundOffIcon.style.display = 'none';
    soundBtn.style.background = '';
    soundBtn.title = 'كتم الصوت';
  } else {
    soundOnIcon.style.display = 'none';
    soundOffIcon.style.display = 'block';
    soundBtn.style.background = 'rgba(239, 68, 68, 0.2)';
    soundBtn.title = 'تشغيل الصوت';
  }
}

// Initialize sound button state when page loads
setTimeout(updateSoundButtonState, 100);

// ═══════════════════════════════════════════════════════════════
// 🌙 DARK MODE TOGGLE
// ═══════════════════════════════════════════════════════════════
// Theme Toggle (Default is Dark, toggle to Light)
const ThemeToggle = {
  key: 'pos_light_mode',

  init() {
    // Check saved preference - default is dark (no class)
    const isLight = localStorage.getItem(this.key) === 'true';
    if (isLight) {
      this.enableLight(false);
    }
    this.updateButton();
  },

  toggle() {
    if (document.documentElement.classList.contains('light-mode')) {
      this.enableDark(true);
    } else {
      this.enableLight(true);
    }
    this.updateButton();
  },

  enableLight(save = true) {
    document.documentElement.classList.add('light-mode');
    if (save) localStorage.setItem(this.key, 'true');
    // Removed debug ingest call
  },

  enableDark(save = true) {
    document.documentElement.classList.remove('light-mode');
    if (save) localStorage.setItem(this.key, 'false');
  },

  isLight() {
    return document.documentElement.classList.contains('light-mode');
  },

  updateButton() {
    const btn = document.getElementById('darkModeBtn');
    const moonIcon = document.getElementById('moonIcon');
    const sunIcon = document.getElementById('sunIcon');

    if (!btn) return;

    const isLight = this.isLight();

    // Moon = switch to dark, Sun = switch to light
    if (moonIcon) moonIcon.style.display = isLight ? 'block' : 'none';
    if (sunIcon) sunIcon.style.display = isLight ? 'none' : 'block';
    btn.title = isLight ? 'الوضع المظلم' : 'الوضع الفاتح';
  }
};

// Alias for backwards compatibility
const DarkMode = ThemeToggle;

function toggleDarkMode() {
  DarkMode.toggle();
}

// Initialize dark mode
setTimeout(() => DarkMode.init(), 50);

// ═══════════════════════════════════════════════════════════════
// 🔄 CROSS-PAGE SYNC - مزامنة التحديثات بين الصفحات
// ═══════════════════════════════════════════════════════════════
// الاستماع لتغييرات من صفحات أخرى (مثل المرتجعات من صفحة المبيعات)
window.addEventListener('storage', (e) => {
  if (e.key === 'pos_data_updated') {
    Logger.log('[POS] 🔄 Data updated from another page, refreshing...');
    SmartCache.invalidate();
    search();
    searchAccessories();
  }
});

// ═══════════════════════════════════════════════════════════════
// ⚠️ UNSAVED CART WARNING - تحذير عند الخروج مع وجود سلة
// ═══════════════════════════════════════════════════════════════
window.addEventListener('beforeunload', (e) => {
  if (typeof cart !== 'undefined' && cart.length > 0) {
    const message = 'يوجد منتجات في السلة! هل أنت متأكد من الخروج؟';
    e.preventDefault();
    e.returnValue = message;
    return message;
  }
});

// دالة لإخطار الصفحات الأخرى بالتحديثات
function notifyDataUpdate() {
  localStorage.setItem('pos_data_updated', Date.now().toString());
}

// ═══════════════════════════════════════════════════════════════
// 🚀 SMART CACHE SYSTEM - لتحسين الأداء
// ═══════════════════════════════════════════════════════════════
const SmartCache = {
  data: new Map(),
  timestamps: new Map(),
  maxSize: 100, // Maximum cache entries to prevent memory leaks

  set(key, value) {
    // Enforce max size - remove oldest entries if needed
    if (this.data.size >= this.maxSize) {
      const oldestKey = this._getOldestKey();
      if (oldestKey) {
        this.data.delete(oldestKey);
        this.timestamps.delete(oldestKey);
      }
    }

    this.data.set(key, value);
    this.timestamps.set(key, Date.now());
  },

  get(key) {
    const timestamp = this.timestamps.get(key);
    if (!timestamp) return null;

    // Check if cache is still valid
    if (Date.now() - timestamp > CACHE_DURATION) {
      this.data.delete(key);
      this.timestamps.delete(key);
      return null;
    }

    return this.data.get(key);
  },

  // Get the oldest cache key
  _getOldestKey() {
    let oldestKey = null;
    let oldestTime = Infinity;

    for (const [key, time] of this.timestamps) {
      if (time < oldestTime) {
        oldestTime = time;
        oldestKey = key;
      }
    }
    return oldestKey;
  },

  // Clean expired entries
  cleanup() {
    const now = Date.now();
    for (const [key, time] of this.timestamps) {
      if (now - time > CACHE_DURATION) {
        this.data.delete(key);
        this.timestamps.delete(key);
      }
    }
  },

  invalidate(key) {
    if (key) {
      this.data.delete(key);
      this.timestamps.delete(key);
    } else {
      // Clear all cache
      this.data.clear();
      this.timestamps.clear();
    }
  },

  // Get cache stats
  stats() {
    return {
      size: this.data.size,
      maxSize: this.maxSize,
      keys: Array.from(this.data.keys())
    };
  },

  // Check if cache needs refresh
  needsRefresh(key) {
    const timestamp = this.timestamps.get(key);
    if (!timestamp) return true;
    return Date.now() - timestamp > CACHE_DURATION;
  }
};

// ═══════════════════════════════════════════════════════════════
// 📜 LAZY LOADING SYSTEM - تحميل تدريجي للمنتجات
// ═══════════════════════════════════════════════════════════════
const LazyLoader = {
  currentPage: 0,
  isLoading: false,
  hasMore: true,
  allItems: [],
  displayedItems: [],

  init(items) {
    this.allItems = items;
    this.currentPage = 0;
    this.displayedItems = [];
    this.hasMore = items.length > LAZY_LOAD_BATCH;
  },

  loadMore() {
    if (this.isLoading || !this.hasMore) return [];

    this.isLoading = true;
    const start = this.currentPage * LAZY_LOAD_BATCH;
    const end = start + LAZY_LOAD_BATCH;
    const batch = this.allItems.slice(start, end);

    this.displayedItems = [...this.displayedItems, ...batch];
    this.currentPage++;
    this.hasMore = end < this.allItems.length;
    this.isLoading = false;

    Logger.log(`[LAZY] Loaded batch ${this.currentPage}: ${batch.length} items, hasMore: ${this.hasMore}`);
    return batch;
  },

  reset() {
    this.currentPage = 0;
    this.displayedItems = [];
    this.hasMore = this.allItems.length > 0;
  },

  getDisplayed() {
    return this.displayedItems;
  }
};

// ===== Helpers =====
// fmt() is now imported from utils.js (window.fmt)
const sum = (arr, k) => arr.reduce((n, x) => n + Number(k ? x[k] || 0 : x || 0), 0);

// ===== XSS Protection =====
// escapeHtml() is now imported from utils.js (window.escapeHtml)

// Safe HTML builder - escapes all dynamic content
function safeHtml(strings, ...values) {
  return strings.reduce((result, str, i) => {
    const value = values[i - 1];
    const escaped = escapeHtml(value);
    return result + escaped + str;
  });
}

// ===== Input Validation =====
const Validators = {
  // Egyptian phone: 01xxxxxxxxx (11 digits)
  phone(value) {
    if (!value) return { valid: true, value: '' };
    const cleaned = String(value).replace(/\D/g, '');
    const valid = /^01[0125]\d{8}$/.test(cleaned);
    return {
      valid,
      value: cleaned,
      error: valid ? null : 'رقم الهاتف غير صحيح (يجب أن يبدأ بـ 01)'
    };
  },

  // IMEI: 15 digits
  imei(value) {
    if (!value) return { valid: true, value: '' };
    const cleaned = String(value).replace(/\D/g, '');
    const valid = cleaned.length === 15;
    return {
      valid,
      value: cleaned,
      error: valid ? null : 'رقم IMEI يجب أن يكون 15 رقم'
    };
  },

  // Price: positive number
  price(value) {
    const num = Number(value);
    const valid = !isNaN(num) && num >= 0;
    return {
      valid,
      value: valid ? num : 0,
      error: valid ? null : 'السعر يجب أن يكون رقم موجب'
    };
  },

  // Quantity: positive integer
  quantity(value) {
    const num = parseInt(value, 10);
    const valid = !isNaN(num) && num > 0 && Number.isInteger(num);
    return {
      valid,
      value: valid ? num : 1,
      error: valid ? null : 'الكمية يجب أن تكون رقم صحيح موجب'
    };
  },

  // Discount percentage: 0-50%
  discountPercent(value) {
    const num = Number(value);
    const valid = !isNaN(num) && num >= 0 && num <= MAX_DISCOUNT_PERCENT;
    return {
      valid,
      value: valid ? num : 0,
      error: valid ? null : `الخصم يجب أن يكون بين 0% و ${MAX_DISCOUNT_PERCENT}%`
    };
  },

  // Required text
  required(value, fieldName = 'هذا الحقل') {
    const valid = value && String(value).trim().length > 0;
    return {
      valid,
      value: String(value || '').trim(),
      error: valid ? null : `${fieldName} مطلوب`
    };
  }
};

// ===== Rate Limiting =====
const RateLimiter = {
  _lastCalls: new Map(),

  // Check if action is allowed (returns true if OK, false if too soon)
  check(action, minIntervalMs = 1000) {
    const now = Date.now();
    const lastCall = this._lastCalls.get(action) || 0;

    if (now - lastCall < minIntervalMs) {
      return false;
    }

    this._lastCalls.set(action, now);
    return true;
  },

  // Reset for an action
  reset(action) {
    this._lastCalls.delete(action);
  }
};

// ===== Fetch with Retry =====
async function fetchWithRetry(url, options = {}, retries = 3, delayMs = 1000) {
  let lastError;

  for (let attempt = 0; attempt < retries; attempt++) {
    try {
      const response = await fetch(url, options);
      if (response.ok) return response;

      // Don't retry client errors (4xx)
      if (response.status >= 400 && response.status < 500) {
        throw new Error(await response.text());
      }

      lastError = new Error(`HTTP ${response.status}`);
    } catch (error) {
      lastError = error;

      // Don't retry on last attempt
      if (attempt < retries - 1) {
        // Exponential backoff
        await new Promise(r => setTimeout(r, delayMs * Math.pow(2, attempt)));
      }
    }
  }

  throw lastError;
}

// ===== Debounce Function =====
function debounce(func, wait) {
  let timeout;
  return function executedFunction(...args) {
    const later = () => {
      clearTimeout(timeout);
      func(...args);
    };
    clearTimeout(timeout);
    timeout = setTimeout(later, wait);
  };
}

// ===== Throttle Function (for scroll/resize events) =====
function throttle(func, limit) {
  let inThrottle;
  return function(...args) {
    if (!inThrottle) {
      func.apply(this, args);
      inThrottle = true;
      setTimeout(() => inThrottle = false, limit);
    }
  };
}

// ═══════════════════════════════════════════════════════════════
// 🔊 SOUND EFFECTS SYSTEM - Optimized
// ═══════════════════════════════════════════════════════════════

const SoundFX = {
  enabled: localStorage.getItem('pos_sounds') !== 'off',
  audioContext: null,
  
  getContext() {
    if (!this.audioContext) {
      this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
    }
    return this.audioContext;
  },
  
  play(type) {
    if (!this.enabled) return;
    
    try {
      const ctx = this.getContext();
      const oscillator = ctx.createOscillator();
      const gainNode = ctx.createGain();
      
      oscillator.connect(gainNode);
      gainNode.connect(ctx.destination);
      
      const sounds = {
        add: { freq: 800, duration: 0.08, type: 'sine' },
        remove: { freq: 400, duration: 0.12, type: 'triangle' },
        success: { freq: 1200, duration: 0.15, type: 'sine' },
        error: { freq: 200, duration: 0.25, type: 'square' },
        scan: { freq: 1000, duration: 0.04, type: 'sine' }
      };
      
      const config = sounds[type] || sounds.add;
      
      oscillator.frequency.value = config.freq;
      oscillator.type = config.type;
      
      gainNode.gain.setValueAtTime(0.08, ctx.currentTime);
      gainNode.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + config.duration);
      
      oscillator.start(ctx.currentTime);
      oscillator.stop(ctx.currentTime + config.duration);
    } catch (e) {
      // Sound not supported
    }
  },
  
  toggle() {
    this.enabled = !this.enabled;
    localStorage.setItem('pos_sounds', this.enabled ? 'on' : 'off');
    return this.enabled;
  }
};

// ═══════════════════════════════════════════════════════════════
// 📊 PROFIT CALCULATOR
// ═══════════════════════════════════════════════════════════════

function calculateProfit(cart) {
  return cart.reduce((total, item) => {
    const cost = Number(item.cost || 0);
    const price = Number(item.price || 0);
    return total + (price - cost);
  }, 0);
}

// ═══════════════════════════════════════════════════════════════
// 🔄 HELD INVOICES SYSTEM
// ═══════════════════════════════════════════════════════════════

const HeldInvoices = {
  key: 'pos_held_invoices',
  
  getAll() {
    try {
      return JSON.parse(localStorage.getItem(this.key) || '[]');
    } catch {
      return [];
    }
  },
  
  save(cart, customerName, customerPhone, paymentMethods = []) {
    const held = this.getAll();
    const invoice = {
      id: Date.now(),
      cart: cart,
      customerName: customerName,
      customerPhone: customerPhone,
      paymentMethods: paymentMethods,
      timestamp: new Date().toISOString()
    };
    held.push(invoice);
    localStorage.setItem(this.key, JSON.stringify(held));
    return invoice.id;
  },
  
  load(id) {
    const held = this.getAll();
    return held.find(h => h.id === id);
  },
  
  remove(id) {
    const held = this.getAll().filter(h => h.id !== id);
    localStorage.setItem(this.key, JSON.stringify(held));
  },
  
  count() {
    return this.getAll().length;
  }
};

// ═══════════════════════════════════════════════════════════════
// 📷 BARCODE SCANNER SUPPORT - Optimized
// ═══════════════════════════════════════════════════════════════

let barcodeBuffer = '';
let barcodeTimeout = null;

function initBarcodeScanner() {
  // ✅ V1.2.6 - تحسين دعم الباركود في نقطة البيع
  // الآن يعمل الباركود حتى لو كان المستخدم في حقل البحث

  let lastKeyTime = 0;
  const BARCODE_SPEED_THRESHOLD = 50; // الباركود سكانر أسرع من الكتابة اليدوية

  document.addEventListener('keypress', (e) => {
    const currentTime = Date.now();
    const timeDiff = currentTime - lastKeyTime;
    lastKeyTime = currentTime;

    const activeEl = document.activeElement;
    const isInInput = activeEl.tagName === 'INPUT' ||
                      activeEl.tagName === 'TEXTAREA' ||
                      activeEl.tagName === 'SELECT';

    // إذا كان المستخدم في input غير البحث، تجاهل (مثل modals)
    if (isInInput && activeEl.id !== 'searchInput' && activeEl.id !== 'q') {
      // لكن إذا كانت السرعة عالية جداً (باركود سكانر)، نعالجها
      if (timeDiff > BARCODE_SPEED_THRESHOLD) {
        return; // كتابة عادية - تجاهل
      }
    }

    // Clear timeout
    clearTimeout(barcodeTimeout);

    // Add character to buffer
    if (e.key !== 'Enter') {
      barcodeBuffer += e.key;
    }

    // Set timeout to process barcode
    barcodeTimeout = setTimeout(() => {
      // باركود 4 أرقام
      if (barcodeBuffer.length === 4 && /^\d{4}$/.test(barcodeBuffer)) {
        processBarcode(barcodeBuffer);
        if (isInInput) activeEl.value = ''; // مسح حقل البحث
      }
      // باركود 5 أرقام (النظام الجديد)
      else if (barcodeBuffer.length === 5 && /^\d{5}$/.test(barcodeBuffer)) {
        processBarcode(barcodeBuffer);
        if (isInInput) activeEl.value = '';
      }
      // باركود 6 أرقام
      else if (barcodeBuffer.length === 6 && /^\d{6}$/.test(barcodeBuffer)) {
        processBarcode(barcodeBuffer);
        if (isInInput) activeEl.value = '';
      }
      // باركود DV (أجهزة من التوريد) - 8 حروف DV + 6 أرقام
      else if (barcodeBuffer.length === 8 && /^DV\d{6}$/i.test(barcodeBuffer)) {
        processBarcode(barcodeBuffer);
        if (isInInput) activeEl.value = '';
      }
      // Legacy: IMEI أو باركود قديم (10+ أرقام)
      else if (barcodeBuffer.length >= 10 && /^\d+$/.test(barcodeBuffer)) {
        processBarcode(barcodeBuffer);
        if (isInInput) activeEl.value = '';
      }
      barcodeBuffer = '';
    }, 100);

    // Process on Enter
    if (e.key === 'Enter') {
      e.preventDefault(); // منع submit الفورم

      // باركود 4 أرقام
      if (barcodeBuffer.length === 4 && /^\d{4}$/.test(barcodeBuffer)) {
        processBarcode(barcodeBuffer);
        if (isInInput) activeEl.value = '';
        barcodeBuffer = '';
      }
      // باركود 5 أرقام (النظام الجديد)
      else if (barcodeBuffer.length === 5 && /^\d{5}$/.test(barcodeBuffer)) {
        processBarcode(barcodeBuffer);
        if (isInInput) activeEl.value = '';
        barcodeBuffer = '';
      }
      // باركود 6 أرقام
      else if (barcodeBuffer.length === 6 && /^\d{6}$/.test(barcodeBuffer)) {
        const numCode = parseInt(barcodeBuffer, 10);
        if ((numCode >= 1000 && numCode <= 4999) || (numCode >= 5000 && numCode <= 8999)) {
          const shortCode = String(numCode).padStart(4, '0');
          processBarcode(shortCode);
        } else {
          processBarcode(barcodeBuffer);
        }
        if (isInInput) activeEl.value = '';
        barcodeBuffer = '';
      }
      // باركود DV (أجهزة من التوريد) - 8 حروف DV + 6 أرقام
      else if (barcodeBuffer.length === 8 && /^DV\d{6}$/i.test(barcodeBuffer)) {
        processBarcode(barcodeBuffer);
        if (isInInput) activeEl.value = '';
        barcodeBuffer = '';
      }
      // Legacy: IMEI أو باركود قديم
      else if (barcodeBuffer.length >= 10 && /^\d+$/.test(barcodeBuffer)) {
        processBarcode(barcodeBuffer);
        if (isInInput) activeEl.value = '';
        barcodeBuffer = '';
      }
      // إذا كان في حقل البحث وضغط Enter بدون باركود - ابحث عادي
      else if (isInInput && barcodeBuffer.length > 0) {
        // الكتابة العادية في البحث - لا تعالج كباركود
        barcodeBuffer = '';
      }
    }
  });
}

async function processBarcode(code) {
  Logger.log('📷 Barcode scanned:', code);
  SoundFX.play('scan');

  const cleanCode = String(code).trim();
  await loadPosMainWarehouses();

  // ═══════════════════════════════════════════════════════════════════════════
  // 🔍 البحث الشامل - يبحث في كل الأصناف بأي باركود
  // ═══════════════════════════════════════════════════════════════════════════
  try {
    // البحث في الأجهزة
    const devicesResponse = await fetch(`elos-db://inventory`);
    if (devicesResponse.ok) {
      const allDevices = await devicesResponse.json();
      const numCode = parseInt(cleanCode, 10);

      const matchedDevice = allDevices.find(d => {
        const shortCode = String(d.short_code || '').trim();
        const shortCodeNum = parseInt(shortCode, 10);
        // مقارنة بكل الطرق الممكنة
        return shortCode === cleanCode ||
               shortCode.toUpperCase() === cleanCode.toUpperCase() ||
               shortCodeNum === numCode ||
               shortCode.padStart(6, '0') === cleanCode ||
               cleanCode.padStart(6, '0') === shortCode;
      });

      if (matchedDevice) {
        Logger.log(`[POS] ✅ Found device: ${matchedDevice.model}, Status: ${matchedDevice.status}`);

        if (matchedDevice.status !== 'in_stock') {
          showToast(`⚠️ الجهاز غير متاح (${matchedDevice.status})`, 'warning');
          if (q) q.value = '';
          return;
        }

        // التحقق من المخزن
        const mainWarehouse = posMainWarehouses.devicesId;
        if (mainWarehouse && matchedDevice.warehouse_id && String(matchedDevice.warehouse_id) !== String(mainWarehouse)) {
          showToast(`⚠️ الجهاز في مخزن آخر`, 'warning');
          if (q) q.value = '';
          return;
        }

        // إضافة للـ pool إذا مش موجود
        if (!pool.find(d => d.id === matchedDevice.id)) {
          pool.push(matchedDevice);
        }
        addToCart(matchedDevice);
        showToast(`📱 تم اختيار ${matchedDevice.model || 'جهاز'}`, 'success', 2000);
        if (q) q.value = '';
        return;
      }
    }

    // البحث في الإكسسوارات (server-side search للسرعة)
    const accessoriesResponse = await fetch(`elos-db://accessories?search=${encodeURIComponent(cleanCode)}`);
    const allAccessoriesData = accessoriesResponse.ok ? await accessoriesResponse.json() : [];
    const allAccessories = Array.isArray(allAccessoriesData) ? allAccessoriesData : (allAccessoriesData?.accessories || []);

    const matchedAccessory = allAccessories.find(a => {
      const shortCode = String(a.short_code || '').trim();
      const barcode = String(a.barcode || '').trim();
      const numCode = parseInt(cleanCode, 10);
      const shortCodeNum = parseInt(shortCode, 10);
      const barcodeNum = parseInt(barcode, 10);
      return shortCode === cleanCode ||
             barcode === cleanCode ||
             shortCodeNum === numCode ||
             barcodeNum === numCode;
    });

    if (matchedAccessory) {
      Logger.log(`[POS] ✅ Found accessory: ${matchedAccessory.name}`);

      // التحقق من المخزن
      const mainWarehouse = posMainWarehouses.accessoriesId;
      if (mainWarehouse && matchedAccessory.warehouse_id && String(matchedAccessory.warehouse_id) !== String(mainWarehouse)) {
        showToast(`⚠️ الإكسسوار في مخزن آخر`, 'warning');
        if (q) q.value = '';
        return;
      }

      const preventNegative = (JSON.parse(localStorage.getItem('appSettings') || '{}')).preventNegativeStock !== false;
      if (preventNegative && (matchedAccessory.quantity || 0) <= 0) {
        showToast(`⚠️ ${matchedAccessory.name} - نفذت الكمية`, 'warning');
        if (q) q.value = '';
        return;
      }

      if (!accessoriesPool.find(a => a.id === matchedAccessory.id)) {
        accessoriesPool.push(matchedAccessory);
      }
      changeAccessoryQty(matchedAccessory.id, 1);
      showToast(`🎧 تمت إضافة ${matchedAccessory.name}`, 'success', 2000);
      if (q) q.value = '';
      return;
    }

    // البحث في قطع الغيار (server-side search للسرعة)
    const partsResponse = await fetch(`elos-db://repair-parts?search=${encodeURIComponent(cleanCode)}`);
    if (partsResponse.ok) {
      const partsData = await partsResponse.json();
      const allParts = Array.isArray(partsData) ? partsData : (partsData.parts || []);

      const matchedPart = allParts.find(p => {
        const sku = String(p.sku || '').trim();
        const barcode = String(p.barcode || '').trim();
        return sku === cleanCode || barcode === cleanCode;
      });

      if (matchedPart) {
        Logger.log(`[POS] ✅ Found repair part: ${matchedPart.name}`);

        // التحقق من المخزن
        const mainWarehouse = posMainWarehouses.repairPartsId;
        if (mainWarehouse && matchedPart.warehouse_id && String(matchedPart.warehouse_id) !== String(mainWarehouse)) {
          showToast(`⚠️ قطعة الغيار في مخزن آخر`, 'warning');
          if (q) q.value = '';
          return;
        }

        const stock = matchedPart.qty || matchedPart.quantity || 0;
        const preventNegative = (JSON.parse(localStorage.getItem('appSettings') || '{}')).preventNegativeStock !== false;
        if (preventNegative && stock <= 0) {
          showToast(`⚠️ ${matchedPart.name} - نفذت الكمية`, 'warning');
          if (q) q.value = '';
          return;
        }

        if (!repairPartsPool.find(p => p.id === matchedPart.id)) {
          repairPartsPool.push(matchedPart);
        }
        changeRepairPartQty(matchedPart.id, 1);
        showToast(`🔧 تمت إضافة ${matchedPart.name}`, 'success', 2000);
        if (q) q.value = '';
        return;
      }
    }

  } catch (error) {
    Logger.error('[POS] Error in universal barcode search:', error);
  }

  // لم يتم العثور على أي منتج
  showToast('❌ لا يوجد منتج بهذا الباركود', 'error');
  if (q) q.value = '';
  return;

  // ═══ الكود القديم (للرجوع إليه) ═══
  // ═══ نظام الباركود الموحد V24.21 ═══
  // أجهزة: 000001-499999 (6 أرقام) - النظام الجديد الموحد
  // أجهزة قديمة: 1000-4999 (4 أرقام)
  // أجهزة (legacy): DV000001-DV999999 (prefix DV) - للتوافق مع الأجهزة القديمة
  // إكسسوارات: 500000-899999 (6 أرقام)
  // إكسسوارات قديمة: 5000-8999 (4 أرقام)
  // قطع غيار: 90000-99999 (5 أرقام)

  // ═══ البحث بباركود DV (أجهزة من التوريد) ═══
  if (/^DV\d{6}$/i.test(cleanCode)) {
    Logger.log(`[POS] 🔍 Searching for DV code: ${cleanCode}`);
    try {
      // البحث في كل الأجهزة أولاً (بدون فلتر status)
      const allDevicesResponse = await fetch(`elos-db://inventory`);
      if (allDevicesResponse.ok) {
        let allDevices = await allDevicesResponse.json();
        Logger.log(`[POS] Total devices in DB: ${allDevices.length}`);

        // البحث عن الجهاز بالكود
        const deviceByCode = allDevices.find(d => {
          const shortCode = String(d.short_code || '').trim().toUpperCase();
          return shortCode === cleanCode.toUpperCase();
        });

        if (deviceByCode) {
          Logger.log(`[POS] ✅ Found device: ID=${deviceByCode.id}, Model=${deviceByCode.model}, Status=${deviceByCode.status}, Warehouse=${deviceByCode.warehouse_id}`);
          Logger.log(`[POS] POS Main Warehouse ID: ${posMainWarehouses.devicesId}`);

          // التحقق من الحالة
          if (deviceByCode.status !== 'in_stock') {
            showToast(`⚠️ الجهاز موجود لكن حالته: ${deviceByCode.status}`, 'warning');
            if (q) q.value = '';
            return;
          }

          // التحقق من المخزن
          const deviceWarehouse = deviceByCode.warehouse_id;
          const mainWarehouse = posMainWarehouses.devicesId;
          if (mainWarehouse && deviceWarehouse && String(deviceWarehouse) !== String(mainWarehouse)) {
            showToast(`⚠️ الجهاز في مخزن آخر (${deviceWarehouse})`, 'warning');
            if (q) q.value = '';
            return;
          }

          // الجهاز موجود ومتاح
          selectDeviceById(deviceByCode.id);
          showToast(`📱 تم اختيار ${deviceByCode.model || 'جهاز'}`, 'success', 2000);
          if (q) q.value = '';
          return;
        } else {
          Logger.log(`[POS] ❌ No device found with code: ${cleanCode}`);
          // عرض بعض الأكواد الموجودة للتشخيص
          const sampleCodes = allDevices.slice(0, 5).map(d => d.short_code);
          Logger.log(`[POS] Sample short_codes in DB: ${sampleCodes.join(', ')}`);
        }
      }
    } catch (error) {
      Logger.error('Error searching devices by DV code:', error);
    }

    // إذا لم يتم العثور على الجهاز
    showToast('❌ لا يوجد جهاز بهذا الباركود', 'error');
    if (q) q.value = '';
    return;
  }

  // ═══ البحث بباركود 5 أرقام ═══
  if (/^\d{5}$/.test(cleanCode)) {
    const numCode = parseInt(cleanCode, 10);

    // ═══ أجهزة جديدة: 10000-19999 (5 أرقام) ═══
    if (numCode >= 10000 && numCode <= 19999) {
      try {
        const params = new URLSearchParams();
        params.append('status', 'in_stock');
        const devicesResponse = await fetch(`elos-db://inventory?${params.toString()}`);
        if (devicesResponse.ok) {
          let devices = await devicesResponse.json();
          devices = filterToMainWarehouse(devices, posMainWarehouses.devicesId);
          const matchedDevice = devices.find(d => {
            const shortCode = String(d.short_code || '').trim();
            const barcode = String(d.barcode || '').trim();
            return shortCode === cleanCode || barcode === cleanCode;
          });

          if (matchedDevice) {
            selectDeviceById(matchedDevice.id);
            showToast(`📱 تم اختيار ${matchedDevice.model || 'جهاز'}`, 'success', 2000);
            if (q) q.value = '';
            return;
          }
        }
      } catch (error) {
        Logger.error('Error searching devices by 5-digit code:', error);
      }
    }

    // ═══ إكسسوارات: 50000-89999 (5 أرقام) ═══
    if (numCode >= 50000 && numCode <= 89999) {
      try {
        const accessoriesResponse = await API.inventory.getAccessories();
        let accessories = Array.isArray(accessoriesResponse) ? accessoriesResponse : (accessoriesResponse?.accessories || []);
        accessories = filterToMainWarehouse(accessories, posMainWarehouses.accessoriesId);

        const matchedAccessory = accessories.find(a => {
          const shortCode = String(a.short_code || '').trim();
          const barcode = String(a.barcode || '').trim();
          return shortCode === cleanCode || barcode === cleanCode;
        });

        if (matchedAccessory) {
          const preventNegativeAcc = (JSON.parse(localStorage.getItem('appSettings') || '{}')).preventNegativeStock !== false;
          if (preventNegativeAcc && (matchedAccessory.quantity || 0) <= 0) {
            showToast(`⚠️ ${matchedAccessory.name} - نفذت الكمية`, 'warning');
            return;
          }

          // Make sure accessory is in the pool for changeAccessoryQty to work
          if (!accessoriesPool.find(a => a.id === matchedAccessory.id)) {
            accessoriesPool.push(matchedAccessory);
          }

          // Add accessory to cart using changeAccessoryQty
          changeAccessoryQty(matchedAccessory.id, 1);
          showToast(`🎧 تمت إضافة ${matchedAccessory.name}`, 'success', 2000);
          if (q) q.value = '';
          return;
        }
      } catch (error) {
        Logger.error('Error searching accessories by 5-digit code:', error);
      }
    }

    // ═══ قطع غيار: 90000-99999 (5 أرقام) ═══
    if (numCode >= 90000 && numCode <= 99999) {
      try {
        const partsResponse = await fetch('elos-db://repair-parts');
        if (partsResponse.ok) {
          const partsData = await partsResponse.json();
          let parts = Array.isArray(partsData) ? partsData : (partsData.parts || []);
          parts = filterToMainWarehouse(parts, posMainWarehouses.repairPartsId);

          const matchedPart = parts.find(p => {
            const sku = String(p.sku || '').trim();
            const barcode = String(p.barcode || '').trim();
            return sku === cleanCode || barcode === cleanCode;
          });

          if (matchedPart) {
            const stock = matchedPart.qty || matchedPart.quantity || 0;
            const preventNegative = (JSON.parse(localStorage.getItem('appSettings') || '{}')).preventNegativeStock !== false;
            if (preventNegative && stock <= 0) {
              showToast(`⚠️ ${matchedPart.name} - نفذت الكمية`, 'warning');
              return;
            }

            // Make sure part is in the pool for changeRepairPartQty to work
            if (!repairPartsPool.find(p => p.id === matchedPart.id)) {
              repairPartsPool.push(matchedPart);
            }

            // Add part to cart
            changeRepairPartQty(matchedPart.id, 1);
            showToast(`🔧 تمت إضافة ${matchedPart.name}`, 'success', 2000);
            if (q) q.value = '';
            return;
          }
        }
      } catch (error) {
        Logger.error('Error searching repair parts by 5-digit code:', error);
      }
    }
  }

  // ═══ البحث بباركود 6 أرقام ═══
  // أجهزة: 000001-499999 (مثال: 000001, 000123, 123456)
  // إكسسوارات: 500000-899999
  if (/^\d{6}$/.test(cleanCode)) {
    const numCode = parseInt(cleanCode, 10);

    // ═══ أجهزة: 000001-499999 (6 أرقام) ═══
    if (numCode >= 1 && numCode <= 499999) {
      try {
        const params = new URLSearchParams();
        params.append('status', 'in_stock');
        const devicesResponse = await fetch(`elos-db://inventory?${params.toString()}`);
        if (devicesResponse.ok) {
          let devices = await devicesResponse.json();
          devices = filterToMainWarehouse(devices, posMainWarehouses.devicesId);
          const matchedDevice = devices.find(d => {
            const shortCode = String(d.short_code || '').trim();
            // مقارنة مع padding لدعم 000001 = 1
            const shortCodeNum = parseInt(shortCode, 10);
            return shortCode === cleanCode || shortCodeNum === numCode;
          });

          if (matchedDevice) {
            selectDeviceById(matchedDevice.id);
            showToast(`📱 تم اختيار ${matchedDevice.model || 'جهاز'}`, 'success', 2000);
            if (q) q.value = '';
            return;
          }
        }
      } catch (error) {
        Logger.error('Error searching devices by 6-digit code:', error);
      }
    }

    // ═══ إكسسوارات: 500000-899999 (6 أرقام) ═══
    if (numCode >= 500000 && numCode <= 899999) {
      try {
        const accessoriesResponse = await API.inventory.getAccessories();
        let accessories = Array.isArray(accessoriesResponse) ? accessoriesResponse : (accessoriesResponse?.accessories || []);
        accessories = filterToMainWarehouse(accessories, posMainWarehouses.accessoriesId);

        const matchedAccessory = accessories.find(a => {
          const shortCode = String(a.short_code || '').trim();
          const barcode = String(a.barcode || '').trim();
          return shortCode === cleanCode || barcode === cleanCode;
        });

        if (matchedAccessory) {
          const preventNegativeAcc = (JSON.parse(localStorage.getItem('appSettings') || '{}')).preventNegativeStock !== false;
          if (preventNegativeAcc && (matchedAccessory.quantity || 0) <= 0) {
            showToast(`⚠️ ${matchedAccessory.name} - نفذت الكمية`, 'warning');
            return;
          }

          if (!accessoriesPool.find(a => a.id === matchedAccessory.id)) {
            accessoriesPool.push(matchedAccessory);
          }

          changeAccessoryQty(matchedAccessory.id, 1);
          showToast(`🎧 تمت إضافة ${matchedAccessory.name}`, 'success', 2000);
          if (q) q.value = '';
          return;
        }
      } catch (error) {
        Logger.error('Error searching accessories by 6-digit code:', error);
      }
    }
  }

  // ═══ البحث بباركود 4 أرقام ═══
  if (/^\d{4}$/.test(cleanCode)) {
    const numCode = parseInt(cleanCode, 10);
    
    // البحث في الأجهزة (1000-4999)
    if (numCode >= 1000 && numCode <= 4999) {
      try {
        // ✅ البحث باستخدام inventory endpoint مع filter على short_code
        const params = new URLSearchParams();
        params.set('status', 'in_stock');
        const response = await fetch(`elos-db://inventory?${params.toString()}`);
        
        if (response.ok) {
          let allDevices = await response.json();
          allDevices = filterToMainWarehouse(allDevices, posMainWarehouses.devicesId);
          
          // البحث عن الجهاز بـ short_code في النتائج
          const device = allDevices.find(d => {
            const deviceShortCode = String(d.short_code || '').trim();
            return deviceShortCode === cleanCode || 
                   deviceShortCode.padStart(4, '0') === cleanCode ||
                   cleanCode.padStart(4, '0') === deviceShortCode;
          });
          
          if (device && device.status === 'in_stock') {
            // البحث في pool أو إضافته
            let deviceInPool = pool.find(d => d.id === device.id);
            if (!deviceInPool) {
              // إضافة الجهاز للـ pool
              pool.push(device);
              deviceInPool = device;
              // تحديث العرض
              renderResults();
            }
            
            addToCart(deviceInPool);
            showToast(`📱 تمت إضافة ${device.type || ''} ${device.model || ''}`, 'success', 2000);
            // مسح خانة البحث
            if (q) q.value = '';
            return;
          } else if (device) {
            showToast(`⚠️ الجهاز غير متاح للبيع (${device.status || 'غير معروف'})`, 'warning');
            return;
          } else {
            // الجهاز غير موجود - البحث في pool الحالي أولاً
            const deviceInPool = pool.find(d => {
              const deviceShortCode = String(d.short_code || '').trim();
              return deviceShortCode === cleanCode || 
                     deviceShortCode.padStart(4, '0') === cleanCode ||
                     cleanCode.padStart(4, '0') === deviceShortCode;
            });
            
            if (deviceInPool && deviceInPool.status === 'in_stock') {
              addToCart(deviceInPool);
              showToast(`📱 تمت إضافة ${deviceInPool.type || ''} ${deviceInPool.model || ''}`, 'success', 2000);
              if (q) q.value = '';
              return;
            }
          }
        }
      } catch (error) {
        Logger.error('Error searching device by short_code:', error);
        // Fallback: البحث في pool الحالي
        const deviceInPool = pool.find(d => {
          const deviceShortCode = String(d.short_code || '').trim();
          return deviceShortCode === cleanCode || 
                 deviceShortCode.padStart(4, '0') === cleanCode ||
                 cleanCode.padStart(4, '0') === deviceShortCode;
        });
        
        if (deviceInPool && deviceInPool.status === 'in_stock') {
          addToCart(deviceInPool);
          showToast(`📱 تمت إضافة ${deviceInPool.type || ''} ${deviceInPool.model || ''}`, 'success', 2000);
          if (q) q.value = '';
          return;
        }
      }
    }
    
    // البحث في الإكسسوارات (5000-8999)
    if (numCode >= 5000 && numCode <= 8999) {
      try {
        const accessoriesResponse = await API.inventory.getAccessories();
        let accessories = Array.isArray(accessoriesResponse) ? accessoriesResponse : (accessoriesResponse?.accessories || []);
        accessories = filterToMainWarehouse(accessories, posMainWarehouses.accessoriesId);
        
        const matchedAccessory = accessories.find(a =>
          a.short_code === cleanCode || 
          (a.code && String(a.code).trim() === cleanCode) ||
          (a.barcode && String(a.barcode).trim() === cleanCode)
        );

        if (matchedAccessory) {
          const preventNegativeAcc = (JSON.parse(localStorage.getItem('appSettings') || '{}')).preventNegativeStock !== false;
          if (preventNegativeAcc && (matchedAccessory.quantity || 0) <= 0) {
            showToast(`⚠️ ${matchedAccessory.name} - نفذت الكمية`, 'warning');
            return;
          }

          if (!accessoriesPool.find(a => a.id === matchedAccessory.id)) {
            accessoriesPool.push(matchedAccessory);
          }

          changeAccessoryQty(matchedAccessory.id, 1);
          showToast(`🎧 تمت إضافة ${matchedAccessory.name}`, 'success', 2000);
          return;
        }
      } catch (error) {
        Logger.error('Error searching accessories:', error);
      }
    }
  }

  // ═══ Legacy: البحث بالـ IMEI أو الباركود القديم ═══
  // First, search for device with this IMEI or old barcode
  q.value = code;
  await search();

  // If only one device result, add to cart automatically
  if (pool.length === 1) {
    addToCart(pool[0]);
    showToast(`📱 تمت إضافة الجهاز تلقائياً`, 'success', 2000);
    return;
  }

  // If multiple devices found
  if (pool.length > 1) {
    showToast(`📱 تم العثور على ${pool.length} أجهزة`, 'info');
    return;
  }

  // No device found - search in accessories (legacy)
  try {
    const accessoriesResponse = await API.inventory.getAccessories();
    const accessories = Array.isArray(accessoriesResponse) ? accessoriesResponse : (accessoriesResponse?.accessories || []);

    // Find accessory by barcode/code (legacy)
    const matchedAccessory = accessories.find(a =>
      a.code === code || a.barcode === code || a.sku === code
    );

    if (matchedAccessory) {
      const preventNegativeAcc = (JSON.parse(localStorage.getItem('appSettings') || '{}')).preventNegativeStock !== false;
      if (preventNegativeAcc && (matchedAccessory.quantity || 0) <= 0) {
        showToast(`⚠️ ${matchedAccessory.name} - نفذت الكمية`, 'warning');
        return;
      }

      if (!accessoriesPool.find(a => a.id === matchedAccessory.id)) {
        accessoriesPool.push(matchedAccessory);
      }

      changeAccessoryQty(matchedAccessory.id, 1);
      showToast(`🎧 تمت إضافة ${matchedAccessory.name}`, 'success', 2000);
      return;
    }

    // Nothing found
    showToast(`❌ لم يتم العثور على منتج بهذا الباركود`, 'warning');

  } catch (error) {
    Logger.error('Error searching accessories:', error);
    showToast(`لم يتم العثور على جهاز بهذا الرقم`, 'warning');
  }
}

// ═══════════════════════════════════════════════════════════════
// 🎨 TOAST NOTIFICATION SYSTEM - Optimized
// ═══════════════════════════════════════════════════════════════

let toastContainer = null;

function createToastContainer() {
  if (toastContainer) return toastContainer;
  
  toastContainer = document.createElement('div');
  toastContainer.id = 'toast-container';
  toastContainer.style.cssText = `
    position: fixed;
    top: 80px;
    left: 50%;
    transform: translateX(-50%);
    z-index: 10000;
    display: flex;
    flex-direction: column;
    gap: 12px;
    pointer-events: none;
  `;
  document.body.appendChild(toastContainer);
  return toastContainer;
}

function showToast(message, type = 'info', duration = 3000) {
  const container = createToastContainer();
  
  const toast = document.createElement('div');
  const icons = {
    success: '✅',
    error: '❌',
    warning: '⚠️',
    info: 'ℹ️'
  };
  
  const colors = {
    success: '#10b981',
    error: '#ef4444',
    warning: '#f59e0b',
    info: '#3b82f6'
  };
  
  toast.innerHTML = `
    <div style="
      background: linear-gradient(135deg, #1a1f29 0%, #151921 100%);
      border: 1px solid ${colors[type]};
      border-radius: 12px;
      padding: 14px 20px;
      color: #e6e8ee;
      box-shadow: 0 8px 32px rgba(0,0,0,0.4), 0 0 0 1px ${colors[type]}40;
      display: flex;
      align-items: center;
      gap: 12px;
      min-width: 280px;
      max-width: 450px;
      pointer-events: auto;
      animation: toastSlideIn 0.3s ease-out;
      font-size: 14px;
      font-weight: 500;
    ">
      <span style="font-size: 18px;">${icons[type]}</span>
      <span style="flex: 1; line-height: 1.4;">${message}</span>
    </div>
  `;
  
  // Add animation if not exists
  if (!document.getElementById('toast-animations')) {
    const style = document.createElement('style');
    style.id = 'toast-animations';
    style.textContent = `
      @keyframes toastSlideIn {
        from { opacity: 0; transform: translateY(-20px); }
        to { opacity: 1; transform: translateY(0); }
      }
      @keyframes toastSlideOut {
        from { opacity: 1; transform: translateY(0); }
        to { opacity: 0; transform: translateY(-20px); }
      }
    `;
    document.head.appendChild(style);
  }
  
  container.appendChild(toast);

  // Auto remove
  setTimeout(() => {
    toast.style.animation = 'toastSlideOut 0.3s ease-out';
    setTimeout(() => toast.remove(), 300);
  }, duration);
}

// ═══════════════════════════════════════════════════════════════
// ✅ CONFIRM DIALOG - نافذة التأكيد
// ═══════════════════════════════════════════════════════════════

/**
 * عرض نافذة تأكيد مخصصة
 * @param {string} message - الرسالة
 * @param {string} confirmText - نص زر التأكيد (افتراضي: 'تأكيد')
 * @param {string} cancelText - نص زر الإلغاء (افتراضي: 'إلغاء')
 * @param {string} type - نوع التأكيد: 'danger', 'warning', 'info' (افتراضي: 'warning')
 * @returns {Promise<boolean>}
 */
function showConfirm(message, confirmText = 'تأكيد', cancelText = 'إلغاء', type = 'warning') {
  return new Promise((resolve) => {
    SoundFX.play('warning');

    const colors = {
      danger: '#ef4444',
      warning: '#f59e0b',
      info: '#3b82f6'
    };

    const icons = {
      danger: '⚠️',
      warning: '❓',
      info: 'ℹ️'
    };

    const overlay = document.createElement('div');
    overlay.style.cssText = `
      position: fixed;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      background: rgba(0, 0, 0, 0.6);
      backdrop-filter: none;
      z-index: 2500;
      display: flex;
      align-items: center;
      justify-content: center;
      animation: fadeIn 0.2s ease;
    `;

    const dialog = document.createElement('div');
    dialog.style.cssText = `
      background: linear-gradient(135deg, #1e2433 0%, #181c26 100%);
      border: 1px solid ${colors[type]}40;
      border-radius: 16px;
      padding: 28px;
      min-width: 320px;
      max-width: 450px;
      text-align: center;
      box-shadow: 0 20px 60px rgba(0, 0, 0, 0.5), 0 0 0 1px ${colors[type]}30;
      animation: slideUp 0.3s ease;
    `;

    dialog.innerHTML = `
      <div style="font-size: 48px; margin-bottom: 16px;">${icons[type]}</div>
      <div style="color: #e6e8ee; font-size: 16px; line-height: 1.6; margin-bottom: 24px;">${message}</div>
      <div style="display: flex; gap: 12px; justify-content: center;">
        <button id="confirmBtn" style="
          background: ${colors[type]};
          color: white;
          border: none;
          padding: 12px 28px;
          border-radius: 10px;
          font-size: 14px;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.2s;
        ">${confirmText}</button>
        <button id="cancelBtn" style="
          background: #374151;
          color: #9ca3af;
          border: 1px solid #4b5563;
          padding: 12px 28px;
          border-radius: 10px;
          font-size: 14px;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.2s;
        ">${cancelText}</button>
      </div>
    `;

    // Add animations
    if (!document.getElementById('confirm-animations')) {
      const style = document.createElement('style');
      style.id = 'confirm-animations';
      style.textContent = `
        @keyframes fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        @keyframes slideUp {
          from { opacity: 0; transform: translateY(20px) scale(0.95); }
          to { opacity: 1; transform: translateY(0) scale(1); }
        }
      `;
      document.head.appendChild(style);
    }

    overlay.appendChild(dialog);
    document.body.appendChild(overlay);

    const confirmBtn = dialog.querySelector('#confirmBtn');
    const cancelBtn = dialog.querySelector('#cancelBtn');

    const cleanup = () => {
      overlay.style.animation = 'fadeIn 0.2s ease reverse';
      setTimeout(() => overlay.remove(), 200);
    };

    confirmBtn.onclick = () => {
      cleanup();
      resolve(true);
    };

    cancelBtn.onclick = () => {
      cleanup();
      resolve(false);
    };

    overlay.onclick = (e) => {
      if (e.target === overlay) {
        cleanup();
        resolve(false);
      }
    };

    // Focus confirm button
    setTimeout(() => confirmBtn.focus(), 100);
  });
}

// ===== DOM Elements =====
const q = document.getElementById('q');
const cond = document.getElementById('cond');
const btnFind = document.getElementById('btnFind');
const cards = document.getElementById('cards');
const empty = document.getElementById('empty');

// ===== Loading Indicator Functions =====
function showSearchLoading() {
  if (!cards) return;
  cards.innerHTML = `
    <div class="search-loading" style="
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      padding: 60px 20px;
      gap: 16px;
      width: 100%;
    ">
      <div class="loading-spinner" style="
        width: 48px;
        height: 48px;
        border: 4px solid rgba(99, 102, 241, 0.2);
        border-top-color: var(--brand, #6366f1);
        border-radius: 50%;
        animation: spin 1s linear infinite;
      "></div>
      <span style="color: var(--text-secondary, #64748b); font-size: 14px;">جاري البحث...</span>
    </div>
    <style>
      @keyframes spin {
        to { transform: rotate(360deg); }
      }
    </style>
  `;
  if (empty) empty.style.display = 'none';
}

function hideSearchLoading() {
  const loadingEl = cards?.querySelector('.search-loading');
  if (loadingEl) loadingEl.remove();
}

// ===== DOM Elements Cache System =====
// Cache frequently accessed DOM elements to avoid repeated queries
const DOMCache = {
  _cache: new Map(),
  _initialized: false,

  // Get element with caching
  get(selector) {
    if (!this._cache.has(selector)) {
      this._cache.set(selector, document.querySelector(selector));
    }
    return this._cache.get(selector);
  },

  // Get by ID (most common)
  byId(id) {
    const key = `#${id}`;
    if (!this._cache.has(key)) {
      this._cache.set(key, document.getElementById(id));
    }
    return this._cache.get(key);
  },

  // Clear cache (call when DOM structure changes significantly)
  clear() {
    this._cache.clear();
  },

  // Initialize common elements
  init() {
    if (this._initialized) return;
    const commonIds = [
      'sProfit', 'discountRow', 'checkoutAmount', 'paymentSummary',
      'paymentStatus', 'invoiceSubtotal', 'invoiceDiscountRow',
      'invoiceDiscount', 'invoiceTradeinRow', 'invoiceTradeinValue',
      'checkoutGrandTotal', 'unifiedHeaderTotal', 'checkoutChangeSection',
      'checkoutChangeValue', 'checkoutCashReceived'
    ];
    commonIds.forEach(id => this.byId(id));
    this._initialized = true;
  }
};

// Initialize cache after DOM ready
setTimeout(() => DOMCache.init(), 100);

const kAvail = document.getElementById('kAvail');
const kAvgAsk = document.getElementById('kAvgAsk');
const kCartCount = document.getElementById('kCartCount');
const kCartTotal = document.getElementById('kCartTotal');

const cartBox = document.getElementById('cartBox');
const cartItemsMini = document.getElementById('cartItemsMini');
const cartEmpty = document.getElementById('cartEmpty');
const cartCount = document.getElementById('cartCount');
const cartModalCount = document.getElementById('cartModalCount');
const cName = document.getElementById('cName');
const cPhone = document.getElementById('cPhone');
const payMethod = document.getElementById('payMethod');
const discPct = document.getElementById('discPct');
const discVal = document.getElementById('discVal');
const sSubtotal = document.getElementById('sSubtotal');
const sDiscount = document.getElementById('sDiscount');
const sTotal = document.getElementById('sTotal');
const sSubtotalModal = document.getElementById('sSubtotalModal');
const sDiscountModal = document.getElementById('sDiscountModal');
const sTotalModal = document.getElementById('sTotalModal');

const btnClear = document.getElementById('btnClear');
const btnCheckout = document.getElementById('btnCheckout');
const btnOpenCart = document.getElementById('btnOpenCart');
const btnHold = document.getElementById('btnHold');
const btnLoadHeld = document.getElementById('btnLoadHeld');
const btnPrint = document.getElementById('btnPrint');
const btnPrintModal = document.getElementById('btnPrintModal');
const cartModal = document.getElementById('cartModal');

// ===== State =====
let pool = [];       // أجهزة متاحة من السيرفر
let isInitialLoad = true; // حالة التحميل الأولي
let cart = [];       // [{id, label, ask, price, cost}]
let lastSearch = { imeiOrModel: '', condition: '' };
let isLoading = false;

// ═══════════════════════════════════════════════════════════════
// 🎯 EVENT DELEGATION MANAGER - منع تسريب الذاكرة
// ═══════════════════════════════════════════════════════════════
const EventManager = {
  // تخزين الـ handlers المسجلة
  _handlers: new Map(),

  // تسجيل handler جديد (يشيل القديم لو موجود)
  register(element, event, handler, key) {
    if (!element) return;

    const handlerKey = `${key}_${event}`;

    // إزالة الـ handler القديم لو موجود
    if (this._handlers.has(handlerKey)) {
      const oldHandler = this._handlers.get(handlerKey);
      element.removeEventListener(event, oldHandler);
    }

    // تسجيل الـ handler الجديد
    element.addEventListener(event, handler);
    this._handlers.set(handlerKey, handler);
  },

  // إزالة handler معين
  unregister(element, event, key) {
    if (!element) return;

    const handlerKey = `${key}_${event}`;
    if (this._handlers.has(handlerKey)) {
      const handler = this._handlers.get(handlerKey);
      element.removeEventListener(event, handler);
      this._handlers.delete(handlerKey);
    }
  },

  // تنظيف كل الـ handlers
  cleanup() {
    this._handlers.clear();
  }
};

// ═══════════════════════════════════════════════════════════════
// 🛒 CART EVENT DELEGATION - تسجيل مرة واحدة فقط
// ═══════════════════════════════════════════════════════════════
let cartEventsInitialized = false;
let cardsEventsInitialized = false;

function initCartEventDelegation() {
  if (cartEventsInitialized || !cartBox) return;

  // Click events (remove, add accessory, etc.)
  EventManager.register(cartBox, 'click', handleCartClick, 'cartBox');

  // Input events (price, discount changes)
  EventManager.register(cartBox, 'input', handleCartInput, 'cartBox');

  // Change events (select changes)
  EventManager.register(cartBox, 'change', handleCartChange, 'cartBox');

  cartEventsInitialized = true;
  Logger.log('✅ Cart event delegation initialized');
}

// Event delegation للـ device cards
function initCardsEventDelegation() {
  if (cardsEventsInitialized || !cards) return;

  EventManager.register(cards, 'click', handleCardClick, 'cards');
  cardsEventsInitialized = true;
  Logger.log('✅ Cards event delegation initialized');
}

// Handler للضغط على الـ cards
function handleCardClick(e) {
  // تجاهل الضغط على أزرار الكمية
  if (e.target.closest('.qty-btn, .qty-input')) return;

  const card = e.target.closest('.device-card, .card.accessory, .accessory-card, .card.repair-part');
  if (!card) return;

  const deviceId = card.dataset.id;
  if (!deviceId) return;

  // البحث في الـ pool المناسب
  if (card.classList.contains('accessory') || card.classList.contains('accessory-card')) {
    // للإكسسوارات: زيادة الكمية بـ 1
    changeAccessoryQty(Number(deviceId), 1);
  } else if (card.classList.contains('repair-part')) {
    // لقطع الغيار: زيادة الكمية بـ 1
    changeRepairPartQty(Number(deviceId), 1);
  } else {
    const device = pool.find(d => d.id === Number(deviceId));
    if (device) addToCart(device);
  }
}

// ===== Load Cart from localStorage =====
(function loadCartFromStorage() {
  try {
    const saved = localStorage.getItem('elos-pos-cart');
    if (saved) {
      const savedCart = JSON.parse(saved);
      if (Array.isArray(savedCart) && savedCart.length > 0) {
        cart = savedCart;
        Logger.log('🛒 Loaded cart from storage:', cart.length, 'items');
        // Clear localStorage after loading
        localStorage.removeItem('elos-pos-cart');
      }
    }
  } catch (e) {
    Logger.error('Error loading cart from storage:', e);
  }
})();

// ═══════════════════════════════════════════════════════════════
// 🔍 SEARCH FUNCTION - Optimized
// ═══════════════════════════════════════════════════════════════

async function search() {
  if (isLoading) return;
  isLoading = true;

  // Loading states
  UILoader.inputLoading(q, true);
  UILoader.buttonLoading(btnFind, true);
  showSearchLoading();

  const searchTerm = (q?.value || '').trim();
  const condition = cond?.value || '';

  try {
    await loadPosMainWarehouses();
    const params = new URLSearchParams();

    // Optimized: Brand Index Map for O(1) lookup instead of O(n) array search
    const BRAND_INDEX = new Map([
      ['apple', ['apple', 'iphone']],
      ['samsung', ['samsung', 'galaxy']],
      ['oppo', ['oppo']],
      ['xiaomi', ['xiaomi', 'redmi', 'poco']],
      ['realme', ['realme']],
      ['vivo', ['vivo']],
      ['huawei', ['huawei', 'honor']],
      ['nokia', ['nokia']]
    ]);
    const searchLower = searchTerm.toLowerCase();
    const isTypeBrand = BRAND_INDEX.has(searchLower);

    if (searchTerm) {
      if (isTypeBrand) {
        // ✅ Search by type/brand مباشرة
        params.set('type', searchTerm);
      } else {
        // Search by IMEI or model
        params.set('imei', searchTerm);
      }
    }

    if (condition) params.set('condition', condition);
    params.set('status', 'in_stock');

    // ✨ Smart Cache - Check cache first for empty search
    const cacheKey = `inventory_${params.toString()}`;
    let devices = null;

    if (!searchTerm && !condition) {
      // Try to get from cache for full inventory
      devices = SmartCache.get(cacheKey);
    }

    if (!devices) {
      // Fetch from API
      const res = await fetch(`elos-db://inventory?${params.toString()}`);
      if (!res.ok) throw new Error(await res.text());

      devices = await res.json();
      devices = filterToMainWarehouse(devices, posMainWarehouses.devicesId);

      // Cache full inventory results
      if (!searchTerm && !condition) {
        SmartCache.set(cacheKey, devices);
      }
    } else {
      devices = filterToMainWarehouse(devices, posMainWarehouses.devicesId);
    }
    
    // Optimized: Brand filtering using BRAND_INDEX Map
    if (searchTerm && isTypeBrand) {
      const brandKeywords = BRAND_INDEX.get(searchLower) || [];
      devices = devices.filter(d => {
        const type = (d.type || '').toLowerCase();
        const model = (d.model || '').toLowerCase();
        // O(k) where k is small (2-3 keywords per brand)
        return brandKeywords.some(keyword =>
          type.includes(keyword) || model.includes(keyword)
        );
      });
    }

    // Handle "other" brand filter separately
    if (searchLower === 'other') {
      const allKnownBrands = Array.from(BRAND_INDEX.values()).flat();
      devices = devices.filter(d => {
        const type = (d.type || '').toLowerCase();
        const model = (d.model || '').toLowerCase();
        return !allKnownBrands.some(brand =>
          type.includes(brand) || model.includes(brand)
        );
      });
    }
    
    // If searching by text (not brand), also search in model
    if (searchTerm && !isTypeBrand) {
      const searchLower = searchTerm.toLowerCase();
      devices = devices.filter(d => {
        const imei1 = (d.imei1 || '').toLowerCase();
        const imei2 = (d.imei2 || '').toLowerCase();
        const model = (d.model || '').toLowerCase();
        const source = (d.source || '').toLowerCase();
        const color = (d.color || '').toLowerCase();
        const shortCode = String(d.short_code || '').trim();
        const shortCodeLower = shortCode.toLowerCase();
        // ✅ البحث في short_code مع دعم padding (1001 أو 00001001)
        const shortCodePadded = shortCode.padStart(4, '0').toLowerCase();
        const searchPadded = searchTerm.padStart(4, '0').toLowerCase();

        return imei1.includes(searchLower) ||
               imei2.includes(searchLower) ||
               model.includes(searchLower) ||
               source.includes(searchLower) ||
               color.includes(searchLower) ||
               shortCodeLower === searchLower ||
               shortCodePadded === searchLower ||
               shortCodeLower === searchPadded ||
               shortCodePadded === searchPadded;
      });
    }
    
    pool = devices;
    
    // Filter out already in cart (only device items)
    const cartDeviceIds = new Set(cart.filter(c => c.type !== 'accessory').map(c => c.id));
    pool = pool.filter(d => !cartDeviceIds.has(d.id));
    
    // Mark initial load as complete
    isInitialLoad = false;
    
    // Update devices count in tab
    updateDevicesCount(pool.length);
    
    // Update KPIs
    updateKPIs();
    
    // Render cards
    renderCards();
    
  } catch (error) {
    Logger.error('Search error:', error);
    showToast('خطأ في البحث: ' + translateError(error.message), 'error');
    pool = [];
    isInitialLoad = false; // تم التحميل (حتى لو فشل)
    renderCards();
  } finally {
    hideSearchLoading();
    UILoader.inputLoading(q, false);
    UILoader.buttonLoading(btnFind, false);
    isLoading = false;
  }
}

// Smart search - switches between devices, accessories, and repair parts based on current store
async function smartSearch() {
  if (currentStore === 'accessories') {
    await searchAccessories();
  } else if (currentStore === 'repair_parts') {
    await searchRepairParts();
  } else {
    await search();
  }
}

// Debounced search for input
const debouncedSearch = debounce(smartSearch, DEBOUNCE_DELAY);

// ═══════════════════════════════════════════════════════════════
// 📊 UPDATE KPIs
// ═══════════════════════════════════════════════════════════════

function updateKPIs() {
  PerfMonitor.start('updateKPIs');
  // Available devices
  if (kAvail) {
    // إذا كان التحميل الأولي ولم يتم تحميل البيانات بعد، نعرض "..."
    if (isInitialLoad && pool.length === 0) {
      kAvail.textContent = '...';
    } else {
      kAvail.textContent = pool.length;
      isInitialLoad = false; // تم التحميل الأولي
    }
  }
  
  // Average price
  if (kAvgAsk) {
    const avg = pool.length > 0 
      ? sum(pool, 'expected_price') / pool.length 
      : 0;
    kAvgAsk.textContent = fmt(avg);
  }
  
  // Cart count (including accessory quantities)
  const totalItems = cart.reduce((sum, item) => {
    return sum + (item.type === 'accessory' ? item.qty : 1);
  }, 0);
  if (kCartCount) kCartCount.textContent = totalItems;
  
  // Cart total
  if (kCartTotal) kCartTotal.textContent = fmt(sum(cart, 'price'));
  PerfMonitor.end('updateKPIs');
}

// ═══════════════════════════════════════════════════════════════
// 🎴 RENDER CARDS - Optimized with DocumentFragment
// ═══════════════════════════════════════════════════════════════

function renderCards() {
  PerfMonitor.start('renderCards');
  if (!cards) {
    PerfMonitor.end('renderCards');
    return;
  }
  
  if (pool.length === 0) {
    cards.innerHTML = '';
    if (empty) empty.style.display = 'block';
    return;
  }
  
  if (empty) empty.style.display = 'none';

  // Reset visible count on new search
  currentVisibleCount = MAX_VISIBLE_CARDS;

  // Use DocumentFragment for better performance
  const fragment = document.createDocumentFragment();

  // Limit visible cards for performance
  const visibleDevices = pool.slice(0, MAX_VISIBLE_CARDS);
  
  visibleDevices.forEach((device, index) => {
    const card = createDeviceCard(device, index);
    fragment.appendChild(card);
  });
  
  cards.innerHTML = '';
  cards.appendChild(fragment);

  // تسجيل event delegation مرة واحدة
  initCardsEventDelegation();

  // Show "Load More" button if truncated
  if (pool.length > MAX_VISIBLE_CARDS) {
    const loadMoreBtn = document.createElement('button');
    loadMoreBtn.className = 'load-more-btn';
    loadMoreBtn.style.cssText = `
      width: 100%;
      padding: 16px 24px;
      margin-top: 12px;
      background: linear-gradient(135deg, var(--brand) 0%, var(--purple) 100%);
      border: none;
      border-radius: 12px;
      color: white;
      font-size: 14px;
      font-weight: 700;
      cursor: pointer;
      transition: all 0.3s ease;
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 8px;
    `;
    loadMoreBtn.innerHTML = `
      <span>📦</span>
      تحميل المزيد (${pool.length - MAX_VISIBLE_CARDS} جهاز إضافي)
    `;
    loadMoreBtn.onclick = () => loadMoreCards();
    cards.appendChild(loadMoreBtn);
  }
  PerfMonitor.end('renderCards');
}

// Load more cards function
let currentVisibleCount = MAX_VISIBLE_CARDS;

function loadMoreCards() {
  if (!cards) return;

  const nextBatch = pool.slice(currentVisibleCount, currentVisibleCount + LAZY_LOAD_BATCH);
  const fragment = document.createDocumentFragment();

  nextBatch.forEach((device, index) => {
    const card = createDeviceCard(device, currentVisibleCount + index);
    fragment.appendChild(card);
  });

  // Remove load more button
  const loadMoreBtn = cards.querySelector('.load-more-btn');
  if (loadMoreBtn) loadMoreBtn.remove();

  cards.appendChild(fragment);
  currentVisibleCount += nextBatch.length;

  // Add new load more button if there are more items
  if (currentVisibleCount < pool.length) {
    const newLoadMoreBtn = document.createElement('button');
    newLoadMoreBtn.className = 'load-more-btn';
    newLoadMoreBtn.style.cssText = `
      width: 100%;
      padding: 16px 24px;
      margin-top: 12px;
      background: linear-gradient(135deg, var(--brand) 0%, var(--purple) 100%);
      border: none;
      border-radius: 12px;
      color: white;
      font-size: 14px;
      font-weight: 700;
      cursor: pointer;
      transition: all 0.3s ease;
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 8px;
    `;
    newLoadMoreBtn.innerHTML = `
      <span>📦</span>
      تحميل المزيد (${pool.length - currentVisibleCount} جهاز إضافي)
    `;
    newLoadMoreBtn.onclick = () => loadMoreCards();
    cards.appendChild(newLoadMoreBtn);
  }

  SoundFX.play('success');
  showToast(`تم تحميل ${nextBatch.length} جهاز`, 'success');
}

// ===== Infinite Scroll Implementation =====
let infiniteScrollObserver = null;

function setupInfiniteScroll() {
  // Cleanup previous observer
  if (infiniteScrollObserver) {
    infiniteScrollObserver.disconnect();
  }

  const loadMoreBtn = cards?.querySelector('.load-more-btn');
  if (!loadMoreBtn) return;

  // Use Intersection Observer for efficient scroll detection
  infiniteScrollObserver = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting && currentVisibleCount < pool.length) {
        loadMoreCards();
        // Re-setup observer for new button
        setTimeout(setupInfiniteScroll, 100);
      }
    });
  }, {
    root: null,
    rootMargin: '200px', // Start loading 200px before reaching the button
    threshold: 0.1
  });

  infiniteScrollObserver.observe(loadMoreBtn);
}

// Call setupInfiniteScroll after renderCards
const originalRenderCards = renderCards;
renderCards = function() {
  originalRenderCards();
  // Setup infinite scroll after cards are rendered
  setTimeout(setupInfiniteScroll, 50);
};

function createDeviceCard(device, index) {
  const card = document.createElement('div');
  card.className = 'card device-card';
  card.dataset.id = device.id;
  card.style.animationDelay = `${index * 0.03}s`;
  card.style.cursor = 'pointer';
  
  // ✅ استخدام type مباشرة كاسم الشركة
  let brand = device.type || 'أخرى';
  const brands = ['Apple', 'Samsung', 'Oppo', 'Realme', 'Vivo', 'Xiaomi', 'Nokia', 'Huawei'];
  // لو الـ type مش موجود في brands، ندور في الموديل
  if (!brands.includes(brand)) {
    for (const b of brands) {
      if (device.model && device.model.toLowerCase().includes(b.toLowerCase())) {
        brand = b;
        break;
      }
    }
  }

  // Check if it's an Apple device
  const isApple = brand === 'Apple' || device.type === 'Apple';
  
  // Condition badge
  const conditionLabels = {
    new: 'جديد',
    like_new: 'كالجديد',
    used: 'مستعمل',
    faulty: 'عاطل'
  };
  
  // Battery display - only for Apple devices
  let batteryHtml = '';
  if (isApple) {
    let batteryValue = device.battery_health;
    // If new device and no battery value, show 100%
    if (device.condition === 'new' && (!batteryValue || batteryValue === 0)) {
      batteryValue = 100;
    }
    if (batteryValue) {
      // Color based on battery health
      let batteryColor = '#ef4444'; // red
      if (batteryValue >= 80) batteryColor = '#10b981'; // green
      else if (batteryValue >= 60) batteryColor = '#f59e0b'; // yellow
      
      batteryHtml = `<span class="card-detail" style="color: ${batteryColor};">🔋 ${batteryValue}%</span>`;
    }
  }
  
  // Color display
  let colorHtml = '';
  if (device.color) {
    colorHtml = `<span class="card-detail" style="color: var(--purple);">🎨 ${device.color}</span>`;
  }
  
  // IMEI display (full)
  let imeiHtml = '';
  if (device.imei1) {
    imeiHtml = `<span class="card-detail" style="font-family: monospace; font-size: 10px;">📱 ${device.imei1}</span>`;
    if (device.imei2) {
      imeiHtml += `<span class="card-detail" style="font-family: monospace; font-size: 10px;">📱 ${device.imei2}</span>`;
    }
  }
  
  // Source display
  let sourceHtml = '';
  if (device.source) {
    sourceHtml = `<span class="card-detail" style="color: var(--cyan);">🏪 ${device.source}</span>`;
  }
  
  // Has box indicator
  let boxHtml = '';
  if (device.has_box === 1 || device.has_box === true) {
    boxHtml = `<span class="card-detail" style="color: var(--success);">📦</span>`;
  }
  
  // Cost display for profit calculation
  const price = Number(device.expected_price || 0);
  const tax = Number(device.ntra_tax || 0);
  
  // Tax display
  let taxHtml = '';
  if (tax > 0) {
    taxHtml = `
      <div class="card-tax">
        <span class="tax-label">💵 الضريبة</span>
        <span class="tax-value">${fmt(tax)}</span>
      </div>
    `;
  }
  
  card.innerHTML = `
    <div class="card-content">
      <div class="card-header">
        <div class="card-title">${escapeHtml(device.model) || 'جهاز'}</div>
        <span class="card-badge badge-${escapeHtml(device.condition)}">${escapeHtml(conditionLabels[device.condition] || device.condition)}</span>
      </div>
      <div class="card-details">
        <span class="card-detail">${escapeHtml(brand)}</span>
        ${device.storage ? `<span class="card-detail">${escapeHtml(device.storage)}</span>` : ''}
        ${device.ram ? `<span class="card-detail">${escapeHtml(device.ram)}</span>` : ''}
        ${colorHtml}
        ${batteryHtml}
        ${boxHtml}
      </div>
      <div class="card-details" style="margin-top: 6px; padding-top: 6px; border-top: 1px solid rgba(255,255,255,0.05);">
        ${imeiHtml}
        ${sourceHtml}
      </div>
      ${taxHtml}
      <div class="card-price">
        <span class="price-label">السعر المتوقع</span>
        <span class="price-value">${fmt(price)}</span>
      </div>
    </div>
  `;

  // Event delegation بدل addEventListener على كل card
  // الـ click handler موجود في handleCardClick

  return card;
}

// ═══════════════════════════════════════════════════════════════
// 🛒 CART FUNCTIONS - Optimized
// ═══════════════════════════════════════════════════════════════

function addToCart(device) {
  // Check if already in cart
  if (cart.some(c => c.id === device.id)) {
    showToast('الجهاز موجود بالفعل في السلة', 'warning');
    return;
  }
  
  // Get brand icon
  const brandIcons = {
    'Apple': '🍎',
    'Samsung': '📱',
    'Oppo': '📲',
    'Realme': '⚡',
    'Vivo': '🌟',
    'Xiaomi': '🎯',
    'Nokia': '📞',
    'Huawei': '🔷'
  };
  
  // ✅ استخدام type مباشرة كاسم الشركة
  let brand = device.type || 'أخرى';
  const brands = ['Apple', 'Samsung', 'Oppo', 'Realme', 'Vivo', 'Xiaomi', 'Nokia', 'Huawei'];
  if (!brands.includes(brand)) {
    for (const b of brands) {
      if (device.model && device.model.toLowerCase().includes(b.toLowerCase())) {
        brand = b;
        break;
      }
    }
  }
  
  // Add to cart with extended data
  cart.push({
    id: device.id,
    label: `${device.model || 'جهاز'} ${device.storage || ''}`.trim(),
    model: device.model,
    storage: device.storage,
    color: device.color,
    condition: device.condition,
    imei1: device.imei1,
    imei2: device.imei2,
    brand: brand,
    brandIcon: brandIcons[brand] || '📱',
    ask: Number(device.expected_price || 0),
    price: Number(device.expected_price || 0),
    cost: Number(device.purchase_cost || 0),
    discount: 0,
    discountReason: '',
    notes: '',
    accessories: []
  });
  
  // Remove from pool
  pool = pool.filter(d => d.id !== device.id);

  // Play sound
  SoundFX.play('add');

  // Visual feedback - animate the card flying to cart
  animateAddToCart(device.id);

  // Update UI
  renderCards();
  renderCart();
  updateKPIs();

  showToast(`تمت إضافة ${escapeHtml(device.model) || 'الجهاز'} للسلة`, 'success', 2000);
}

// Visual animation when adding to cart
function animateAddToCart(deviceId) {
  const card = document.querySelector(`.card[data-id="${deviceId}"]`);
  const cartIcon = document.getElementById('btnOpenCart') || document.getElementById('cartCount');

  if (!card || !cartIcon) return;

  // Create flying element
  const flyingEl = document.createElement('div');
  flyingEl.className = 'flying-to-cart';
  flyingEl.innerHTML = '🛒';
  flyingEl.style.cssText = `
    position: fixed;
    font-size: 24px;
    z-index: 10000;
    pointer-events: none;
    transition: all 0.5s cubic-bezier(0.25, 0.46, 0.45, 0.94);
  `;

  // Get positions
  const cardRect = card.getBoundingClientRect();
  const cartRect = cartIcon.getBoundingClientRect();

  // Start position (center of card)
  flyingEl.style.left = (cardRect.left + cardRect.width / 2) + 'px';
  flyingEl.style.top = (cardRect.top + cardRect.height / 2) + 'px';
  flyingEl.style.transform = 'scale(1)';
  flyingEl.style.opacity = '1';

  document.body.appendChild(flyingEl);

  // Animate to cart
  requestAnimationFrame(() => {
    flyingEl.style.left = (cartRect.left + cartRect.width / 2) + 'px';
    flyingEl.style.top = (cartRect.top + cartRect.height / 2) + 'px';
    flyingEl.style.transform = 'scale(0.3)';
    flyingEl.style.opacity = '0';
  });

  // Bounce effect on cart icon
  setTimeout(() => {
    cartIcon.style.transform = 'scale(1.3)';
    setTimeout(() => {
      cartIcon.style.transform = 'scale(1)';
    }, 150);
  }, 400);

  // Remove flying element
  setTimeout(() => flyingEl.remove(), 600);

  // Pulse effect on card before removal
  card.style.transform = 'scale(0.95)';
  card.style.opacity = '0.5';
}

// Last removed item for undo
let lastRemovedItem = null;
let undoTimeout = null;

function removeFromCart(id, skipUndo = false) {
  const item = cart.find(c => c.id === id);
  if (!item) return;
  
  // Save for undo
  if (!skipUndo) {
    lastRemovedItem = { ...item };
    showUndoToast(item.label);
  }
  
  cart = cart.filter(c => c.id !== id);
  
  // Play sound
  SoundFX.play('remove');
  
  // Reload search to show removed item
  search();
  
  // Update UI
  renderCart();
  updateKPIs();
  
  if (!skipUndo) {
    showToast('تم إزالة الجهاز من السلة', 'info', 2000);
  }
}

function showUndoToast(itemLabel) {
  // Remove existing undo toast
  const existingToast = document.querySelector('.undo-toast');
  if (existingToast) existingToast.remove();
  clearTimeout(undoTimeout);
  
  const toast = document.createElement('div');
  toast.className = 'undo-toast';
  toast.innerHTML = `
    <span>تم إزالة ${itemLabel}</span>
    <button onclick="undoRemove()">↩️ تراجع</button>
  `;
  document.body.appendChild(toast);
  
  // Auto remove after 5 seconds
  undoTimeout = setTimeout(() => {
    toast.remove();
    lastRemovedItem = null;
  }, 5000);
}

window.undoRemove = function() {
  if (!lastRemovedItem) return;
  
  // Add back to cart
  cart.push(lastRemovedItem);
  
  // Remove from pool if exists
  pool = pool.filter(d => d.id !== lastRemovedItem.id);
  
  // Clear undo
  const toast = document.querySelector('.undo-toast');
  if (toast) toast.remove();
  clearTimeout(undoTimeout);
  lastRemovedItem = null;
  
  // Update UI
  renderCards();
  renderCart();
  updateKPIs();
  
  SoundFX.play('add');
  showToast('تم استعادة الجهاز', 'success', 2000);
};

async function clearCart() {
  if (cart.length === 0) return;

  // ✅ استخدام showConfirm بدلاً من confirm
  const confirmed = await showConfirm('هل أنت متأكد من مسح السلة؟', 'مسح', 'إلغاء', 'warning');
  if (!confirmed) return;

  cart = [];
  SoundFX.play('remove');

  // ✅ إعادة تحميل البيانات حسب التاب النشط
  if (currentStore === 'accessories') {
    searchAccessories();
  } else if (currentStore === 'repair_parts') {
    searchRepairParts();
  } else {
    search();
  }

  // Update UI
  renderCart();
  updateKPIs();

  showToast('تم مسح السلة', 'info');
}

function renderCart() {
  PerfMonitor.start('renderCart');
  // Calculate counts
  const deviceCount = cart.filter(c => c.type !== 'accessory').length;
  const accessoryCount = cart.filter(c => c.type === 'accessory').reduce((sum, c) => sum + c.qty, 0);
  const totalItems = deviceCount + accessoryCount;
  
  // Update cart counts
  if (cartCount) cartCount.textContent = totalItems;
  if (cartModalCount) cartModalCount.textContent = totalItems;
  
  // Update device/accessory badges
  const cartDevicesCount = document.getElementById('cartDevicesCount');
  const cartAccessoriesCount = document.getElementById('cartAccessoriesCount');
  if (cartDevicesCount) cartDevicesCount.textContent = `📱 ${deviceCount}`;
  if (cartAccessoriesCount) cartAccessoriesCount.textContent = `🎧 ${accessoryCount}`;
  
  // Update held invoices badge
  updateHeldBadge();
  
  // Update open cart button state
  if (btnOpenCart) {
    btnOpenCart.disabled = cart.length === 0;
  }
  
  // Render mini view in sidebar
  renderCartMini();
  
  // Render full view in modal
  renderCartFull();
  
  updateSummary();
  PerfMonitor.end('renderCart');
}

// Update held invoices badge
function updateHeldBadge() {
  const heldBadge = document.getElementById('heldBadge');
  if (heldBadge) {
    const count = HeldInvoices.count();
    if (count > 0) {
      heldBadge.textContent = count;
      heldBadge.style.display = 'block';
    } else {
      heldBadge.style.display = 'none';
    }
  }
}

function renderCartMini() {
  PerfMonitor.start('renderCartMini');
  const cartItemsMini = document.getElementById('cartItemsMini');
  const cartEmpty = document.getElementById('cartEmpty');

  // Empty state
  if (cart.length === 0) {
    if (cartEmpty) cartEmpty.style.display = 'flex';
    if (cartItemsMini) cartItemsMini.style.display = 'none';
    PerfMonitor.end('renderCartMini');
    return;
  }

  if (cartEmpty) cartEmpty.style.display = 'none';
  if (cartItemsMini) cartItemsMini.style.display = 'flex';

  if (!cartItemsMini) {
    PerfMonitor.end('renderCartMini');
    return;
  }

  // ✅ PATCH 1: Use DocumentFragment instead of innerHTML
  const fragment = document.createDocumentFragment();
  
  cart.forEach((item, index) => {
    const itemTotal = item.price - (item.discount || 0);
    const isAccessory = item.type === 'accessory';
    const icon = isAccessory ? '🎧' : (item.brandIcon || '📱');

    // Condition label for devices
    const conditionLabel = !isAccessory ? getConditionLabel(item.condition) : '';

    // Create element instead of string concatenation
    const div = document.createElement('div');
    div.className = `cart-item-mini ${isAccessory ? 'accessory-item' : ''}`;
    div.style.animation = `slideInRight 0.3s ease ${index * 0.05}s both`;
    
    // Build HTML string for innerHTML (still needed for complex structure)
    const detailsHtml = isAccessory
      ? `<span class="cart-item-mini-detail-tag">×${item.qty}</span>
         <span class="cart-item-mini-detail-tag">${item.category || 'إكسسوار'}</span>`
      : `${item.storage ? `<span class="cart-item-mini-detail-tag">${item.storage}</span>` : ''}
         ${item.color ? `<span class="cart-item-mini-detail-tag">${item.color}</span>` : ''}
         ${conditionLabel ? `<span class="cart-item-mini-detail-tag">${conditionLabel}</span>` : ''}`;
    
    div.innerHTML = `
      <button class="cart-item-mini-remove" data-id="${item.id}" onclick="${isAccessory ? `removeAccessoryFromCart(${item.id})` : `removeFromCart(${item.id})`}" title="حذف من السلة">✕</button>
      <div class="cart-item-mini-info">
        <div class="cart-item-mini-main">
          <span class="cart-item-mini-brand">${icon}</span>
          <div class="cart-item-mini-name">${item.label}</div>
        </div>
        <div class="cart-item-mini-details">${detailsHtml}</div>
      </div>
      <div class="price-adjuster">
        <button class="price-adj-btn minus" onclick="event.stopPropagation(); adjustCartPrice(${item.id}, -10, '${isAccessory ? 'accessory' : 'device'}')" title="-10">−</button>
        <div class="price-adj-display">
          <input type="number"
                 class="price-adj-input"
                 value="${item.price}"
                 min="0"
                 step="1"
                 data-id="${item.id}"
                 data-type="${isAccessory ? 'accessory' : 'device'}"
                 onchange="updateCartItemPrice(${item.id}, this.value, '${isAccessory ? 'accessory' : 'device'}')"
                 onclick="event.stopPropagation(); this.select();" />
          <span class="price-adj-currency">ج.م</span>
        </div>
        <button class="price-adj-btn plus" onclick="event.stopPropagation(); adjustCartPrice(${item.id}, 10, '${isAccessory ? 'accessory' : 'device'}')" title="+10">+</button>
      </div>
    `;
    
    fragment.appendChild(div);
  });
  
  // Clear and append fragment in one operation
  cartItemsMini.innerHTML = '';
  cartItemsMini.appendChild(fragment);
  PerfMonitor.end('renderCartMini');
}

// ✅ دالة تحديث سعر العنصر في السلة
function updateCartItemPrice(itemId, newPrice, itemType) {
  const price = parseFloat(newPrice) || 0;

  const itemIndex = cart.findIndex(c => c.id === itemId);
  if (itemIndex === -1) return;

  const oldPrice = cart[itemIndex].price;
  cart[itemIndex].price = price;

  // حساب الفرق
  const priceDiff = price - oldPrice;

  // تحديث الـ UI
  renderCart();
  updateKPIs();

  // إشعار بالتغيير
  if (priceDiff !== 0) {
    const direction = priceDiff > 0 ? 'زيادة' : 'تخفيض';
    showToast(`تم ${direction} السعر بـ ${Math.abs(priceDiff).toFixed(0)} ج.م`, priceDiff > 0 ? 'success' : 'info', 1500);
    SoundFX.play('click');
  }
}

// ✅ دالة تعديل السعر بالزيادة أو النقصان
function adjustCartPrice(itemId, amount, itemType) {
  const itemIndex = cart.findIndex(c => c.id === itemId);
  if (itemIndex === -1) return;

  const newPrice = Math.max(0, cart[itemIndex].price + amount);
  cart[itemIndex].price = newPrice;

  // تحديث الـ UI
  renderCart();
  updateKPIs();

  // صوت
  SoundFX.play('click');
}

// Helper function to get condition label
function getConditionLabel(condition) {
  const labels = {
    'new': 'جديد',
    'like_new': 'ممتاز',
    'used': 'مستعمل',
    'faulty': 'معطل'
  };
  return labels[condition] || '';
}

// Remove accessory from cart
function removeAccessoryFromCart(accId) {
  const index = cart.findIndex(c => c.id === accId && c.type === 'accessory');
  if (index >= 0) {
    cart.splice(index, 1);
    SoundFX.play('remove');
    renderCart();
    
    // If on accessories tab, refresh the cards
    if (currentStore === 'accessories') {
      renderAccessoryCards(accessoriesPool);
    }
  }
}

function renderCartFull() {
  PerfMonitor.start('renderCartFull');
  if (!cartBox) {
    PerfMonitor.end('renderCartFull');
    return;
  }
  
  // Empty state
  if (cart.length === 0) {
    cartBox.innerHTML = `
      <div class="cart-empty">
        <div class="cart-empty-icon">🛒</div>
        <div>السلة فارغة</div>
        <div style="font-size:11px; margin-top:8px;">اضغط على جهاز لإضافته</div>
      </div>
    `;
    return;
  }
  
  // Condition labels
  const conditionLabels = {
    new: 'جديد',
    like_new: 'كالجديد',
    used: 'مستعمل',
    faulty: 'عاطل'
  };
  
  // Render cart items
  const fragment = document.createDocumentFragment();
  
  cart.forEach((item, index) => {
    const div = document.createElement('div');
    div.className = 'cart-item';
    div.draggable = true;
    div.dataset.index = index;
    
    // Calculate item total (price - discount)
    const itemTotal = item.price - (item.discount || 0);
    const profit = itemTotal - item.cost;
    const profitClass = profit >= 0 ? '' : 'negative';
    
    // Accessories HTML
    const accessoriesHtml = (item.accessories || []).map(acc => 
      `<span class="accessory-tag" data-id="${item.id}" data-acc="${acc}">
        ${acc}
        <span class="remove-acc">✕</span>
      </span>`
    ).join('');
    
    div.innerHTML = `
      <div class="cart-item-header">
        <span class="cart-item-name">
          <span class="cart-item-brand">${item.brandIcon || '📱'}</span>
          ${item.label}
          <span class="cart-item-condition ${item.condition || ''}">${conditionLabels[item.condition] || ''}</span>
        </span>
        <button class="cart-item-remove" data-id="${item.id}">✕</button>
      </div>
      
      <div class="cart-item-details">
        ${item.storage ? `<span class="cart-item-detail">💾 ${item.storage}</span>` : ''}
        ${item.color ? `<span class="cart-item-detail">🎨 ${item.color}</span>` : ''}
      </div>
      
      ${item.imei1 ? `<span class="cart-item-imei">📱 IMEI: ${item.imei1}</span>` : ''}
      
      <div class="cart-item-price">
        <input type="number" 
               value="${item.price}" 
               min="0" 
               step="0.01" 
               data-id="${item.id}"
               data-field="price"
               class="cart-price-input" />
        <span class="cart-item-total">${fmt(itemTotal)} ج.م</span>
      </div>
      
      <div class="cart-item-discount-row">
        <span style="font-size: 10px; color: var(--warning);">🏷️</span>
        <input type="number" 
               value="${item.discount || ''}" 
               min="0" 
               step="0.01"
               placeholder="خصم"
               data-id="${item.id}"
               data-field="discount"
               class="cart-discount-input" />
        <select data-id="${item.id}" data-field="discountReason" class="cart-discount-reason">
          <option value="" ${!item.discountReason ? 'selected' : ''}>سبب الخصم</option>
          <option value="عميل مميز" ${item.discountReason === 'عميل مميز' ? 'selected' : ''}>عميل مميز</option>
          <option value="عيب بسيط" ${item.discountReason === 'عيب بسيط' ? 'selected' : ''}>عيب بسيط</option>
          <option value="تصفية" ${item.discountReason === 'تصفية' ? 'selected' : ''}>تصفية</option>
          <option value="تفاوض" ${item.discountReason === 'تفاوض' ? 'selected' : ''}>تفاوض</option>
          <option value="أخرى" ${item.discountReason === 'أخرى' ? 'selected' : ''}>أخرى</option>
        </select>
      </div>
      
      <div class="cart-item-notes">
        <input type="text" 
               value="${item.notes || ''}" 
               placeholder="📝 ملاحظات (مثل: العميل طلب شاحن إضافي)"
               data-id="${item.id}"
               data-field="notes"
               class="cart-notes-input" />
      </div>
      
      <div class="cart-item-accessories">
        ${accessoriesHtml}
        <button class="add-accessory-btn" data-id="${item.id}">➕ ملحق</button>
      </div>
      
      <!-- Profit display hidden as per user request -->
      <div class="cart-item-profit ${profitClass}" style="display: none;">
        ${profit >= 0 ? '📈' : '📉'} الربح: ${fmt(profit)} ج.م
      </div>
    `;
    
    // Drag and drop events
    div.addEventListener('dragstart', handleDragStart);
    div.addEventListener('dragend', handleDragEnd);
    div.addEventListener('dragover', handleDragOver);
    div.addEventListener('drop', handleDrop);
    div.addEventListener('dragleave', handleDragLeave);
    
    fragment.appendChild(div);
  });
  
  cartBox.innerHTML = '';
  cartBox.appendChild(fragment);

  // تسجيل Event Delegation مرة واحدة فقط (بدل كل render)
  initCartEventDelegation();
  PerfMonitor.end('renderCartFull');
}

// Drag and Drop handlers
let draggedItem = null;

function handleDragStart(e) {
  draggedItem = this;
  this.classList.add('dragging');
  e.dataTransfer.effectAllowed = 'move';
}

function handleDragEnd(e) {
  this.classList.remove('dragging');
  document.querySelectorAll('.cart-item').forEach(item => {
    item.classList.remove('drag-over');
  });
}

function handleDragOver(e) {
  e.preventDefault();
  e.dataTransfer.dropEffect = 'move';
  this.classList.add('drag-over');
}

function handleDragLeave(e) {
  this.classList.remove('drag-over');
}

function handleDrop(e) {
  e.preventDefault();
  if (draggedItem !== this) {
    const fromIndex = parseInt(draggedItem.dataset.index);
    const toIndex = parseInt(this.dataset.index);
    
    // Reorder cart array
    const [movedItem] = cart.splice(fromIndex, 1);
    cart.splice(toIndex, 0, movedItem);
    
    renderCart();
    SoundFX.play('add');
  }
  this.classList.remove('drag-over');
}

function handleCartClick(e) {
  const removeBtn = e.target.closest('.cart-item-remove');
  if (removeBtn) {
    const id = Number(removeBtn.dataset.id);
    removeFromCart(id);
    return;
  }
  
  // Add accessory button
  const addAccBtn = e.target.closest('.add-accessory-btn');
  if (addAccBtn) {
    const id = Number(addAccBtn.dataset.id);
    showAccessoryPrompt(id);
    return;
  }
  
  // Remove accessory
  const removeAcc = e.target.closest('.remove-acc');
  if (removeAcc) {
    const tag = removeAcc.closest('.accessory-tag');
    const id = Number(tag.dataset.id);
    const acc = tag.dataset.acc;
    removeAccessory(id, acc);
    return;
  }
}

// Debounced version for summary updates (prevents rapid recalculations)
const debouncedUpdateSummary = debounce(updateSummary, 150);
const debouncedUpdateKPIs = debounce(updateKPIs, 150);

function handleCartInput(e) {
  const input = e.target.closest('.cart-price-input, .cart-discount-input, .cart-notes-input');
  if (input) {
    const id = Number(input.dataset.id);
    const field = input.dataset.field;
    const value = field === 'notes' ? input.value : (Number(input.value) || 0);

    const item = cart.find(c => c.id === id);
    if (item) {
      item[field] = value;

      // Update total display immediately for visual feedback
      if (field === 'price' || field === 'discount') {
        const itemTotal = item.price - (item.discount || 0);
        const cartItem = input.closest('.cart-item');
        const totalSpan = cartItem.querySelector('.cart-item-total');
        if (totalSpan) totalSpan.textContent = fmt(itemTotal) + ' ج.م';
      }

      // Debounced updates for performance
      debouncedUpdateSummary();
      debouncedUpdateKPIs();

      // ✅ v1.2.7: تحديث مودال إتمام البيع إذا كان مفتوحاً
      const checkoutModal = document.getElementById('checkoutModal');
      if (checkoutModal && checkoutModal.classList.contains('show')) {
        renderUnifiedCartItems();
        updateCheckoutTotals();
      }
    }
  }
}

function handleCartChange(e) {
  const select = e.target.closest('.cart-discount-reason');
  if (select) {
    const id = Number(select.dataset.id);
    const item = cart.find(c => c.id === id);
    if (item) {
      item.discountReason = select.value;
    }
  }
}

// Accessory functions
function showAccessoryPrompt(id) {
  const accessoryOptions = [
    'شاحن', 'سماعة', 'جراب', 'اسكرينة', 'كابل', 'باور بانك', 'حامل سيارة', 'أخرى'
  ];
  
  const accessory = prompt(
    'اختر أو اكتب الملحق:\n\n' + 
    accessoryOptions.map((a, i) => `${i + 1}. ${a}`).join('\n') +
    '\n\nأو اكتب اسم الملحق مباشرة:'
  );
  
  if (!accessory) return;
  
  // Check if number was entered
  const num = parseInt(accessory);
  const finalAccessory = (num >= 1 && num <= accessoryOptions.length) 
    ? accessoryOptions[num - 1] 
    : accessory.trim();
  
  if (finalAccessory) {
    addAccessory(id, finalAccessory);
  }
}

function addAccessory(id, accessory) {
  const item = cart.find(c => c.id === id);
  if (!item) return;
  
  if (!item.accessories) item.accessories = [];
  
  // Avoid duplicates
  if (!item.accessories.includes(accessory)) {
    item.accessories.push(accessory);
    renderCart();
    SoundFX.play('add');
    showToast(`تمت إضافة ${accessory}`, 'success', 1500);
  } else {
    showToast('الملحق موجود بالفعل', 'warning');
  }
}

function removeAccessory(id, accessory) {
  const item = cart.find(c => c.id === id);
  if (!item || !item.accessories) return;
  
  item.accessories = item.accessories.filter(a => a !== accessory);
  renderCart();
  SoundFX.play('remove');
}

// ═══════════════════════════════════════════════════════════════
// 💰 SUMMARY & DISCOUNT
// ═══════════════════════════════════════════════════════════════

// Optimized: Single-pass calculation for all cart totals
function calculateCartTotals() {
  const pct = Number(discPct?.value || 0);
  const val = Number(discVal?.value || 0);

  // Single reduce for all calculations - O(n) instead of O(3n)
  const totals = cart.reduce((acc, item) => {
    acc.subtotal += item.price || 0;
    acc.totalCost += item.cost || 0;
    acc.itemDiscounts += item.discount || 0;
    return acc;
  }, { subtotal: 0, totalCost: 0, itemDiscounts: 0 });

  const afterItemDiscounts = totals.subtotal - totals.itemDiscounts;

  // Calculate global discount
  let globalDiscount = 0;
  if (pct > 0) globalDiscount = afterItemDiscounts * (pct / 100);
  if (val > 0) globalDiscount += val;

  const totalDiscount = totals.itemDiscounts + globalDiscount;
  const total = Math.max(0, totals.subtotal - totalDiscount);
  const profit = total - totals.totalCost;

  return {
    subtotal: totals.subtotal,
    totalCost: totals.totalCost,
    itemDiscounts: totals.itemDiscounts,
    globalDiscount,
    totalDiscount,
    total,
    profit
  };
}

function updateSummary() {
  // Use optimized single-pass calculation
  const { subtotal, totalCost, totalDiscount, total, profit } = calculateCartTotals();

  // Batch DOM updates using requestAnimationFrame for better performance
  requestAnimationFrame(() => {
    // Update display in sidebar
    if (sSubtotal) sSubtotal.textContent = fmt(subtotal);
    if (sDiscount) sDiscount.textContent = fmt(totalDiscount);
    if (sTotal) sTotal.textContent = fmt(total);

    // Update profit display (using cached element)
    const sProfit = DOMCache.byId('sProfit');
    if (sProfit) {
      sProfit.textContent = fmt(profit);
      sProfit.style.color = profit >= 0 ? 'var(--cyan)' : 'var(--danger)';
    }

    // Show/hide discount row (using cached element)
    const discountRow = DOMCache.byId('discountRow');
    if (discountRow) {
      discountRow.style.display = totalDiscount > 0 ? 'flex' : 'none';
    }

    // Update display in modal
    if (sSubtotalModal) sSubtotalModal.textContent = fmt(subtotal);
    if (sDiscountModal) sDiscountModal.textContent = fmt(totalDiscount);
    if (sTotalModal) sTotalModal.textContent = fmt(total);

    // Enable/disable buttons with dynamic tooltip
    const isCartEmpty = cart.length === 0;
    if (btnCheckout) btnCheckout.disabled = isCartEmpty;
    if (btnOpenCart) {
      btnOpenCart.disabled = isCartEmpty;
      // Update tooltip based on cart state
      btnOpenCart.title = isCartEmpty
        ? 'السلة فارغة - أضف منتجات أولاً (F2)'
        : `إتمام البيع - ${cart.length} عنصر (F2)`;
    }

    // Update checkout button amount (using cached element)
    const checkoutAmount = DOMCache.byId('checkoutAmount');
    if (checkoutAmount) {
      checkoutAmount.textContent = fmt(total) + ' ج.م';
    }

    // Update payment summary
    updatePaymentSummary(total);
  }); // End of requestAnimationFrame
}

// Split payment management
function updatePaymentSummary(total) {
  const paymentSummary = document.getElementById('paymentSummary');
  const paymentStatus = document.getElementById('paymentStatus');
  
  if (!paymentSummary || !paymentStatus) return;
  
  const payments = document.querySelectorAll('.split-payment-row');
  let totalPaid = 0;
  
  payments.forEach(row => {
    const amountInput = row.querySelector('.payment-amount');
    if (amountInput) {
      totalPaid += Number(amountInput.value) || 0;
    }
  });
  
  if (totalPaid > 0 || payments.length > 1) {
    paymentSummary.style.display = 'block';
    const remaining = total - totalPaid;
    
    if (remaining > 0) {
      paymentStatus.innerHTML = `<span class="remaining">متبقي: ${fmt(remaining)} ج.م</span>`;
    } else if (remaining < 0) {
      paymentStatus.innerHTML = `<span class="remaining">زيادة: ${fmt(Math.abs(remaining))} ج.م</span>`;
    } else {
      paymentStatus.innerHTML = `<span class="complete">✅ المبلغ مكتمل</span>`;
    }
  } else {
    paymentSummary.style.display = 'none';
  }
}

// Discount input handlers (debounced to prevent rapid recalculations)
discPct?.addEventListener('input', () => {
  discVal.value = ''; // Clear fixed discount when using percentage
  debouncedUpdateSummary();
});

discVal?.addEventListener('input', () => {
  discPct.value = ''; // Clear percentage when using fixed discount
  debouncedUpdateSummary();
});

// ═══════════════════════════════════════════════════════════════
// ✅ CHECKOUT
// ═══════════════════════════════════════════════════════════════

async function checkout() {
  if (cart.length === 0) {
    showToast('السلة فارغة', 'warning');
    return;
  }

  if (isLoading) return;
  isLoading = true;

  // Show loading overlay
  UILoader.show('جاري إتمام عملية البيع...', 'checkout');

  try {
    // ✅ DEBUG: Log payment method at start
    console.log('[CHECKOUT] Starting checkout with paymentMethod:', checkoutPaymentMethod);

    // Get values from unified checkout modal
    const customerName = document.getElementById('checkoutName')?.value.trim() || '';
    const customerPhone = document.getElementById('checkoutPhone')?.value.trim() || '';

    // Get paid now amount for deferred payment
    const paidNowInput = document.getElementById('checkoutPaidNow');
    const paidNowAmount = Number(paidNowInput?.value || 0);
    console.log('[CHECKOUT] paidNowAmount:', paidNowAmount);

    // Collect payment methods
    const paymentMethods = [];

    // Check if using unified checkout split payment
    if (typeof checkoutPaymentMethod !== 'undefined' && checkoutPaymentMethod === 'split') {
      // Get values from unified split inputs
      const splitCash = Number(document.getElementById('splitCash')?.value || 0);
      const splitCard = Number(document.getElementById('splitCard')?.value || 0);
      const splitTransfer = Number(document.getElementById('splitTransfer')?.value || 0);
      
      // Get wallet IDs for split payment
      const splitCashWalletId = document.getElementById('splitCashWalletSelect')?.value 
        ? parseInt(document.getElementById('splitCashWalletSelect').value) : null;
      const splitCardWalletId = document.getElementById('splitCardWalletSelect')?.value 
        ? parseInt(document.getElementById('splitCardWalletSelect').value) : null;
      const splitTransferWalletId = document.getElementById('splitTransferWalletSelect')?.value 
        ? parseInt(document.getElementById('splitTransferWalletSelect').value) : null;

      if (splitCash > 0) {
        paymentMethods.push({ 
          method: 'cash', 
          amount: splitCash,
          wallet_id: splitCashWalletId
        });
      }
      if (splitCard > 0) {
        paymentMethods.push({ 
          method: 'mobile_wallet', 
          amount: splitCard,
          wallet_id: splitCardWalletId
        });
      }
      if (splitTransfer > 0) {
        paymentMethods.push({
          method: 'bank',
          amount: splitTransfer,
          wallet_id: splitTransferWalletId
        });
      }

      // ═══════════════════════════════════════════════════════════════
      // 🔒 PHASE 1 VALIDATION: Split Payment Total Validation
      // ═══════════════════════════════════════════════════════════════
      const splitTotal = splitCash + splitCard + splitTransfer;
      const subtotalForValidation = sum(cart, 'price');
      const itemDiscountsForValidation = cart.reduce((t, item) => t + (item.discount || 0), 0);
      const pctForValidation = Number(document.getElementById('checkoutDiscPct')?.value || 0);
      const valForValidation = Number(document.getElementById('checkoutDiscVal')?.value || 0);
      let globalDiscountForValidation = 0;
      if (pctForValidation > 0) globalDiscountForValidation = (subtotalForValidation - itemDiscountsForValidation) * (pctForValidation / 100);
      if (valForValidation > 0) globalDiscountForValidation += valForValidation;
      const grandTotalForValidation = Math.max(0, subtotalForValidation - itemDiscountsForValidation - globalDiscountForValidation);

      // Validate split total matches grandTotal (tolerance 0.01)
      if (Math.abs(splitTotal - grandTotalForValidation) > 0.01) {
        const diff = grandTotalForValidation - splitTotal;
        if (diff > 0) {
          showToast(`⚠️ مجموع الدفع المقسم أقل من الإجمالي بـ ${fmt(diff)} ج.م`, 'error');
        } else {
          showToast(`⚠️ مجموع الدفع المقسم يزيد عن الإجمالي بـ ${fmt(Math.abs(diff))} ج.م`, 'error');
        }
        isLoading = false;
        UILoader.hide('checkout');
        return;
      }
    } else {
      // Single payment method - get wallet_id
      const walletSelect = document.getElementById('checkoutWalletSelect');
      const walletId = walletSelect?.value ? parseInt(walletSelect.value) : null;
      
      // Fallback to old split-payment-row elements (if any)
      const paymentRows = document.querySelectorAll('.split-payment-row');
      if (paymentRows.length > 0) {
        paymentRows.forEach(row => {
          const method = row.querySelector('.payment-method-select')?.value || 'cash';
          const amount = Number(row.querySelector('.payment-amount')?.value) || 0;
          if (amount > 0) {
            paymentMethods.push({ method, amount });
          }
        });
      }
    }

    const subtotal = sum(cart, 'price');

    // Calculate individual item discounts
    const itemDiscounts = cart.reduce((total, item) => total + (item.discount || 0), 0);

    // Calculate global discount from unified checkout modal
    let globalDiscount = 0;
    let pct = Number(document.getElementById('checkoutDiscPct')?.value || 0);
    const val = Number(document.getElementById('checkoutDiscVal')?.value || 0);
    const afterItemDiscounts = subtotal - itemDiscounts;

    // Security: Enforce maximum discount percentage
    if (pct > MAX_DISCOUNT_PERCENT) {
      pct = MAX_DISCOUNT_PERCENT;
      document.getElementById('checkoutDiscPct').value = MAX_DISCOUNT_PERCENT;
      showToast(`الحد الأقصى للخصم هو ${MAX_DISCOUNT_PERCENT}%`, 'warning');
    }

    if (pct > 0) globalDiscount = afterItemDiscounts * (pct / 100);
    if (val > 0) globalDiscount += val;

    const totalDiscount = itemDiscounts + globalDiscount;

    // Trade-in value (قيمة الاستبدال)
    const tradeinCheckbox = document.getElementById('tradeinToggleCheckbox');
    const tradeinValue = tradeinCheckbox?.checked ? Number(document.getElementById('tradeinDeviceValue')?.value || 0) : 0;

    // حساب المبلغ الفعلي بعد الخصم والاستبدال
    const netAmount = subtotal - totalDiscount - tradeinValue;

    // 🔄 معالجة حالة الاستبدال - لما العميل له فلوس (قيمة الاستبدال أعلى)
    const customerDueAmount = netAmount < 0 ? Math.abs(netAmount) : 0; // المبلغ المستحق للعميل
    const total = netAmount < 0 ? 0 : Math.max(MIN_SALE_PRICE, netAmount);

    // 💰 قيمة البيع الفعلية للتسجيل في المحفظة (قبل خصم الاستبدال)
    // في حالة الاستبدال: قيمة الجهاز المباع - الخصومات (من غير الاستبدال)
    const saleValueForLedger = subtotal - totalDiscount;

    // إذا العميل له فلوس من الاستبدال، يجب اختيار محفظة للدفع منها
    if (customerDueAmount > 0) {
      // التحقق من اختيار محفظة للدفع للعميل
      const refundWalletSelect = document.getElementById('tradeinRefundWallet');
      if (!refundWalletSelect || !refundWalletSelect.value) {
        showToast('⚠️ يجب اختيار المحفظة لدفع الفرق للعميل', 'warning');
        isLoading = false;
        UILoader.hide('checkout');
        // إظهار خيارات المحفظة
        showTradeInRefundWalletModal(customerDueAmount);
        return;
      }
    }

    // Security: Prevent zero or too low price sales (فقط لو مش استبدال العميل له فلوس)
    if (customerDueAmount === 0 && total < MIN_SALE_PRICE && subtotal > 0) {
      showToast('لا يمكن البيع بسعر أقل من ' + MIN_SALE_PRICE + ' ج.م', 'error');
      isLoading = false;
      return;
    }

    // Get selected payment method from unified checkout
    const selectedMethod = (typeof checkoutPaymentMethod !== 'undefined' && checkoutPaymentMethod !== 'split' && checkoutPaymentMethod !== 'deferred')
      ? checkoutPaymentMethod
      : 'cash';

    // Calculate actual paid amount
    // 🔧 لو العميل له فلوس من الاستبدال، المدفوع الفعلي = قيمة المبيع (مش 0)
    // لأن قيمة الجهاز المباع بتتسجل كمبيعات، وفرق الاستبدال بيتسجل كسحب منفصل
    let actualPaid = customerDueAmount > 0 ? saleValueForLedger : total;

    // ✅ NEW: Check if deferred payment method is selected
    const isDeferredPaymentMethod = checkoutPaymentMethod === 'deferred';

    if (isDeferredPaymentMethod) {
      // ✅ طريقة الدفع "آجل" - استخدام المدفوع الآن (يمكن أن يكون 0 للآجل الكامل)
      actualPaid = paidNowAmount; // يمكن أن يكون 0 للبيع الآجل الكامل

      // ✅ CRITICAL: مسح كل طرق الدفع السابقة
      paymentMethods.length = 0;

      if (paidNowAmount > 0) {
        // ✅ v1.2.7: دفع جزئي آجل - استخدام المحفظة المختارة من القائمة المنسدلة
        let walletId = deferredWalletId;
        let walletType = 'cash';

        // إذا لم يتم اختيار محفظة، استخدم الافتراضية
        if (!walletId) {
          const defaultWallet = paymentWallets.find(w => w.type === 'cash' && w.is_default);
          if (defaultWallet) {
            walletId = defaultWallet.id;
          }
        }

        // تحديد نوع المحفظة من ID
        if (walletId) {
          const selectedWallet = paymentWallets.find(w => w.id === walletId);
          if (selectedWallet) {
            walletType = selectedWallet.type;
          }
        }

        paymentMethods.push({ method: walletType, amount: paidNowAmount, wallet_id: walletId });
      }
      // إذا paidNowAmount === 0، لا يتم إضافة أي طريقة دفع = لا يتم إدخال شيء في cash_ledger
    } else if (paidNowAmount > 0 && paymentMethods.length === 0) {
      // Legacy: paidNowAmount without deferred method
      actualPaid = paidNowAmount;
      paymentMethods.push({ method: selectedMethod, amount: paidNowAmount });
    } else {
      // Use payment methods total
      const totalFromMethods = paymentMethods.reduce((sum, p) => sum + p.amount, 0);
      if (totalFromMethods > 0) {
        actualPaid = totalFromMethods;
      }
    }

    // Calculate remaining
    const remaining = total - actualPaid;

    // ✅ Debug log for deferred payment
    console.log('🔴🔴🔴 [CHECKOUT] Payment Method Debug:', {
      checkoutPaymentMethod,
      isDeferredPaymentMethod,
      paidNowAmount,
      total,
      actualPaid,
      remaining,
      paymentMethodsCount: paymentMethods.length,
      paymentMethods: JSON.stringify(paymentMethods)
    });

    // ✅ CRITICAL: Verify deferred is working
    if (isDeferredPaymentMethod) {
      console.log('🟢🟢🟢 DEFERRED MODE ACTIVE - actualPaid should be:', paidNowAmount, 'paymentMethods should be empty:', paymentMethods.length === 0);
    }

    // Check if saving new client is requested
    const saveNewClientCheckbox = document.getElementById('saveNewClientCheckbox');
    const shouldSaveNewClient = saveNewClientCheckbox?.checked && !selectedClientId && (customerName || customerPhone);

    // If saving new client, create them first
    if (shouldSaveNewClient) {
      try {
        const newClientRes = await fetch('elos-db://clients-add', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name: customerName || 'عميل جديد',
            phone: customerPhone || '',
            address: '',
            notes: 'تم إضافته من نقطة البيع'
          })
        });

        if (newClientRes.ok) {
          const newClient = await newClientRes.json();
          selectedClientId = newClient.id;

          // Add to local clients list
          clientsList.push({
            id: newClient.id,
            name: customerName,
            phone: customerPhone,
            balance: 0
          });

          showToast(`تم حفظ العميل "${customerName}" بنجاح`, 'success');
        } else {
          const errorText = await newClientRes.text();
          Logger.error('Failed to save new client:', errorText);
          showToast('فشل حفظ العميل الجديد، سيتم المتابعة كعميل نقدي', 'warning');
        }
      } catch (e) {
        Logger.error('Error saving new client:', e);
        showToast('فشل حفظ العميل الجديد، سيتم المتابعة كعميل نقدي', 'warning');
      }
    }

    // ═══════════════════════════════════════════════════════════════
    // 🔒 PHASE 1 VALIDATION: Deferred Payment Requires Client
    // ═══════════════════════════════════════════════════════════════
    // Check both: explicit deferred method OR remaining > 0 (implicit deferred)
    const isDeferredPayment = checkoutPaymentMethod === 'deferred' || remaining > 0;
    if (isDeferredPayment && !selectedClientId) {
      showToast('⚠️ يجب اختيار عميل مسجل للبيع بالآجل', 'error');
      isLoading = false;
      UILoader.hide('checkout');
      return;
    }

    // If no payment entered, use selected payment method from unified checkout
    // ✅ CRITICAL: Skip this for full deferred payment (actualPaid === 0)
    if (paymentMethods.length === 0 && !isDeferredPaymentMethod) {
      // 🔧 استخدام saleValueForLedger بدل total عشان في حالة الاستبدال total ممكن يكون 0
      const paymentAmount = customerDueAmount > 0 ? saleValueForLedger : total;

      // Get wallet_id for single payment method
      const walletSelect = document.getElementById('checkoutWalletSelect');
      const walletId = walletSelect?.value ? parseInt(walletSelect.value) : null;

      paymentMethods.push({
        method: selectedMethod,
        amount: paymentAmount,
        wallet_id: walletId
      });
      actualPaid = paymentAmount;
    }
    
    // Confirm
    const deviceCount = cart.filter(c => !c.type || c.type === 'device').length;
    const accessoryCount = cart.filter(c => c.type === 'accessory').reduce((sum, c) => sum + c.qty, 0);
    const repairPartCount = cart.filter(c => c.type === 'repair_part').reduce((sum, c) => sum + c.qty, 0);

    let confirmMsg = `تأكيد البيع:\n\nالإجمالي: ${fmt(total)} ج.م\n`;
    if (deviceCount > 0) confirmMsg += `عدد الأجهزة: ${deviceCount}\n`;
    if (accessoryCount > 0) confirmMsg += `عدد الإكسسوارات: ${accessoryCount}\n`;
    if (repairPartCount > 0) confirmMsg += `عدد قطع الغيار: ${repairPartCount}\n`;
    
    if (totalDiscount > 0) {
      confirmMsg += `الخصم: ${fmt(totalDiscount)} ج.م\n`;
    }

    if (tradeinValue > 0) {
      confirmMsg += `🔄 قيمة الاستبدال: ${fmt(tradeinValue)} ج.م\n`;
    }

    if (remaining > 0 || isDeferredPaymentMethod) {
      confirmMsg += `\n⏳ طريقة الدفع: آجل`;
      confirmMsg += `\n💰 المدفوع الآن: ${fmt(actualPaid)} ج.م`;
      confirmMsg += `\n⚠️ المتبقي على العميل: ${fmt(remaining)} ج.م\n`;
    }
    
    if (paymentMethods.length > 1) {
      confirmMsg += `\nطرق الدفع:\n`;
      paymentMethods.forEach(p => {
        const methodNames = {
          cash: 'كاش سائل',
          mobile_wallet: 'محفظة إلكترونية',
          bank: 'حساب بنكي',
          deferred: 'آجل', DEFERRED: 'آجل', credit: 'آجل'
        };
        confirmMsg += `- ${methodNames[p.method] || p.method}: ${fmt(p.amount)} ج.م\n`;
      });
    }
    
    // Confirmation is already handled by the unified checkout modal
    // No need for additional confirm dialog
    
    // Separate devices, accessories, and repair parts
    const deviceItems = cart.filter(c => !c.type || c.type === 'device');
    const accessoryItems = cart.filter(c => c.type === 'accessory');
    const repairPartItems = cart.filter(c => c.type === 'repair_part');

    // Process each device
    let successCount = 0;
    const errors = [];

    // Determine primary payment method
    // ✅ للبيع الآجل الكامل (بدون دفع) نستخدم 'deferred' كطريقة دفع
    const primaryMethod = isDeferredPaymentMethod && paymentMethods.length === 0
      ? 'deferred'
      : (paymentMethods.length > 0 ? paymentMethods[0].method : 'cash');

    // Generate unique invoice number using the new unified system
    let invoiceNumber;
    try {
      const invoiceRes = await fetch('elos-db://invoice-number/sale');
      const invoiceData = await invoiceRes.json();
      if (invoiceData.success) {
        invoiceNumber = invoiceData.invoiceNumber;
      } else {
        // Fallback to old format if API fails
        invoiceNumber = `SAL-${Date.now()}`;
      }
    } catch (e) {
      Logger.error('Failed to get invoice number:', e);
      invoiceNumber = `SAL-${Date.now()}`;
    }

    // 🔄 TRADE-IN: معالجة جهاز الاستبدال (إن وجد)
    const tradeinData = getTradeInData();
    if (tradeinData) {
      // التحقق من صحة بيانات الاستبدال
      const tradeinValidation = validateTradeIn();
      if (!tradeinValidation.valid) {
        showToast(tradeinValidation.message, 'error');
        isLoading = false;
        return;
      }

      // إضافة جهاز الاستبدال للمخزون
      try {
        const tradeinRes = await fetch('elos-db://trade-in-device', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            customer_name: customerName || 'زبون استبدال',
            customer_phone: customerPhone || '',
            type: tradeinData.type,
            model: tradeinData.model,
            imei: tradeinData.imei,
            storage: tradeinData.storage,
            ram: tradeinData.ram || '',
            battery: tradeinData.battery || '',
            color: tradeinData.color,
            condition: tradeinData.condition,
            tradein_value: tradeinData.value,
            expected_price: tradeinData.expectedPrice,
            notes: tradeinData.notes,
            related_sale_id: invoiceNumber
          })
        });

        if (!tradeinRes.ok) {
          const errorText = await tradeinRes.text();
          throw new Error(errorText);
        }

        const tradeinResult = await tradeinRes.json();
        Logger.log('✅ Trade-in device added:', tradeinResult);

      } catch (tradeinError) {
        Logger.error('Trade-in error:', tradeinError);
        showToast('فشل إضافة جهاز الاستبدال: ' + tradeinError.message, 'error');
        isLoading = false;
        return;
      }
    }

    // ✅ FIX #3: توزيع الدفع بنسبة السعر بدلاً من التقسيم المتساوي
    // حساب إجمالي السلة (بعد الخصومات)
    const allItems = [...deviceItems, ...accessoryItems, ...repairPartItems];
    const cartTotalAfterItemDiscount = allItems.reduce((sum, item) => {
      return sum + (item.price || 0) - (item.discount || 0);
    }, 0);
    const cartTotalAfterDiscount = cartTotalAfterItemDiscount - globalDiscount;

    // ✅ FIX: دالة لحساب نصيب كل عنصر من الخصم العام بنسبته
    const calculateItemGlobalDiscount = (item) => {
      if (globalDiscount <= 0 || cartTotalAfterItemDiscount <= 0) return 0;
      const itemPriceAfterItemDiscount = (item.price || 0) - (item.discount || 0);
      const ratio = itemPriceAfterItemDiscount / cartTotalAfterItemDiscount;
      return Math.round(globalDiscount * ratio * 100) / 100; // تقريب لأقرب قرشين
    };

    // دالة لحساب نصيب كل عنصر من الدفع بنسبة سعره
    const calculateItemPayment = (itemTotal, index, itemsArray) => {
      console.log('🟡 calculateItemPayment called with actualPaid:', actualPaid, 'cartTotalAfterDiscount:', cartTotalAfterDiscount);
      if (cartTotalAfterDiscount <= 0) return 0;
      if (actualPaid >= cartTotalAfterDiscount) return itemTotal; // دفع كامل

      // حساب النسبة
      const ratio = itemTotal / cartTotalAfterDiscount;
      let itemPayment = actualPaid * ratio;

      // للعنصر الأخير: نعطيه الباقي لتجنب مشاكل التقريب
      if (index === itemsArray.length - 1) {
        const previousPayments = itemsArray.slice(0, index).reduce((sum, it) => {
          // ✅ FIX: حساب السعر الفعلي بعد خصم العنصر + نصيبه من الخصم العام
          const itDiscount = (it.discount || 0);
          const itGlobalDiscount = calculateItemGlobalDiscount(it);
          const itTotal = (it.price || 0) - itDiscount - itGlobalDiscount;
          return sum + Math.floor(actualPaid * (itTotal / cartTotalAfterDiscount) * 100) / 100;
        }, 0);
        itemPayment = actualPaid - previousPayments;
      } else {
        // تقريب لأقرب قرشين
        itemPayment = Math.floor(itemPayment * 100) / 100;
      }

      return Math.max(0, itemPayment);
    };

    // Sell devices
    for (let i = 0; i < deviceItems.length; i++) {
      const item = deviceItems[i];
      try {
        // ✅ FIX: حساب الخصم الكامل = خصم العنصر + نصيبه من الخصم العام
        const itemDiscount = item.discount || 0;
        const itemGlobalDiscount = calculateItemGlobalDiscount(item);
        const totalItemDiscount = itemDiscount + itemGlobalDiscount;
        const itemTotal = item.price - totalItemDiscount;
        const itemPayment = calculateItemPayment(itemTotal, i, allItems);

        // 🔴 DEBUG: Log what we're sending to API
        console.log('🔴🔴🔴 [SELL API] Sending:', {
          item_id: item.id,
          price: item.price,
          amount_paid: itemPayment,
          payment_method: primaryMethod,
          paymentMethods_count: paymentMethods.length,
          isDeferredPaymentMethod
        });

        const res = await fetch('elos-db://sell', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({
            id: item.id,
            price: item.price, // السعر الأصلي
            amount_paid: itemPayment,
            client_id: selectedClientId,
            name: customerName,
            phone: customerPhone,
            discount: totalItemDiscount, // ✅ الخصم الكامل (عنصر + عام)
            discount_reason: item.discountReason || '',
            notes: item.notes || '',
            accessories: item.accessories || [],
            payment_method: primaryMethod,
            payment_methods: paymentMethods,
            invoice_number: invoiceNumber
          })
        });

        if (!res.ok) {
          const error = await res.text();
          throw new Error(error);
        }

        successCount++;
      } catch (error) {
        errors.push(`${item.label}: ${error.message}`);
      }
    }

    // Sell accessories
    for (let i = 0; i < accessoryItems.length; i++) {
      const item = accessoryItems[i];
      try {
        // ✅ FIX: حساب الخصم الكامل = خصم العنصر + نصيبه من الخصم العام
        const itemDiscount = item.discount || 0;
        const itemGlobalDiscount = calculateItemGlobalDiscount(item);
        const totalItemDiscount = itemDiscount + itemGlobalDiscount;
        const itemTotal = item.price - totalItemDiscount;
        // حساب index في المصفوفة الكاملة (بعد الأجهزة)
        const overallIndex = deviceItems.length + i;
        const itemPayment = calculateItemPayment(itemTotal, overallIndex, allItems);

        const res = await fetch('elos-db://accessory-sale', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({
            accessory_id: item.id,
            quantity: item.qty,
            unit_price: item.unitPrice,
            discount: totalItemDiscount, // ✅ الخصم الكامل (عنصر + عام)
            total_price: itemTotal,       // ✅ السعر بعد الخصم الكامل
            client_id: selectedClientId,
            client_name: customerName,
            client_phone: customerPhone,
            payment_method: primaryMethod,
            payment_methods: paymentMethods,  // ✅ إرسال المحافظ المحددة مع wallet_id
            paid_amount: itemPayment,
            notes: item.notes || '',
            invoice_number: invoiceNumber
          })
        });

        if (!res.ok) {
          const error = await res.text();
          throw new Error(error);
        }

        successCount++;
      } catch (error) {
        errors.push(`${item.label}: ${error.message}`);
      }
    }

    // Sell repair parts
    for (let i = 0; i < repairPartItems.length; i++) {
      const item = repairPartItems[i];
      try {
        // ✅ FIX: حساب الخصم الكامل = خصم العنصر + نصيبه من الخصم العام
        const itemDiscount = item.discount || 0;
        const itemGlobalDiscount = calculateItemGlobalDiscount(item);
        const totalItemDiscount = itemDiscount + itemGlobalDiscount;
        const itemTotal = item.price - totalItemDiscount;

        // حساب index في المصفوفة الكاملة (بعد الأجهزة والإكسسوارات)
        const overallIndex = deviceItems.length + accessoryItems.length + i;
        const itemPayment = calculateItemPayment(itemTotal, overallIndex, allItems);

        const res = await fetch('elos-db://repair-part-sale', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({
            part_id: item.id,
            quantity: item.qty,
            unit_price: item.unitPrice,
            discount: totalItemDiscount, // ✅ الخصم الكامل (عنصر + عام)
            total_price: itemTotal,       // ✅ السعر بعد الخصم الكامل
            client_id: selectedClientId,
            client_name: customerName,
            client_phone: customerPhone,
            payment_method: primaryMethod,
            payment_methods: paymentMethods,  // ✅ إرسال المحافظ المحددة مع wallet_id
            paid_amount: itemPayment,
            notes: item.notes || '',
            invoice_number: invoiceNumber
          })
        });

        if (!res.ok) {
          const error = await res.text();
          throw new Error(error);
        }

        successCount++;
      } catch (error) {
        errors.push(`${item.label}: ${error.message}`);
      }
    }

    // Show result
    const totalItemsSold = deviceItems.length + accessoryItems.length + repairPartItems.length;
    if (successCount === totalItemsSold) {
      SoundFX.play('success');
      
      let successMsg = 'تم البيع بنجاح! ';
      if (deviceItems.length > 0) successMsg += `(${deviceItems.length} جهاز)`;
      if (accessoryItems.length > 0) successMsg += ` (${accessoryItems.reduce((s, a) => s + a.qty, 0)} إكسسوار)`;
      if (repairPartItems.length > 0) successMsg += ` (${repairPartItems.reduce((s, p) => s + p.qty, 0)} قطعة غيار)`;
      
      showToast(successMsg, 'success', 4000);
      
      // Show deferred payment message if applicable
      if (remaining > 0) {
        showToast(`تم تسجيل ${fmt(remaining)} ج.م على حساب العميل`, 'warning', 5000);
      }

      // Show trade-in success message
      if (tradeinValue > 0) {
        const tradeinType = document.getElementById('tradeinDeviceType')?.value || '';
        const tradeinModel = document.getElementById('tradeinDeviceModel')?.value || '';
        showToast(`🔄 تم إضافة جهاز الاستبدال ${tradeinType} ${tradeinModel} للمخزون`, 'success', 4000);
      }

      // 🔄 معالجة دفع فرق الاستبدال للعميل (لما قيمة الاستبدال أعلى)
      if (customerDueAmount > 0) {
        const refundWalletType = document.getElementById('tradeinRefundWalletType')?.value || 'cash';
        const refundWalletSelect = document.getElementById('tradeinRefundWallet');
        const refundWalletId = refundWalletSelect?.value ? parseInt(refundWalletSelect.value) : null;
        
        try {
          // تسجيل السحب من المحفظة في localStorage (مثل باقي عمليات الدرج)
          const transactions = getShiftTransactions();
          transactions.push({
            id: Date.now(),
            type: 'withdraw',
            wallet: refundWalletType, // للتوافق العكسي
            wallet_id: refundWalletId, // المحفظة المحددة
            amount: customerDueAmount,
            category: 'فرق استبدال',
            description: `دفع فرق استبدال للعميل ${customerName || 'نقدي'} - فاتورة ${invoiceNumber}`,
            created_at: new Date().toISOString()
          });
          saveShiftTransactions(transactions);

          const walletNamesMap = { cash: 'الكاش', mobile_wallet: 'المحفظة الإلكترونية', bank: 'الحساب البنكي' };
          const walletName = refundWalletId && paymentWallets.find(w => w.id === refundWalletId)?.name 
            || walletNamesMap[refundWalletType];
          showToast(`💰 تم دفع ${fmt(customerDueAmount)} ج.م للعميل من ${walletName}`, 'success', 5000);

          // تحديث عرض الدرج
          if (typeof loadCashDrawerData === 'function') {
            loadCashDrawerData();
          }
        } catch (refundErr) {
          Logger.error('Trade-in refund error:', refundErr);
          showToast(`⚠️ تم البيع لكن فشل تسجيل دفع الفرق ${fmt(customerDueAmount)} ج.م`, 'warning');
        }
      }

      // Security: Removed localStorage storage of customer data for privacy
      
      // Clear cart
      cart = [];
      if (cName) cName.value = '';
      if (cPhone) cPhone.value = '';
      if (discPct) discPct.value = '';
      if (discVal) discVal.value = '';
      
      // Reset client selection
      const cClientSelect = document.getElementById('cClientSelect');
      if (cClientSelect) cClientSelect.value = '';
      selectedClientId = null;
      const clientBalanceInfo = document.getElementById('clientBalanceInfo');
      if (clientBalanceInfo) clientBalanceInfo.style.display = 'none';
      
      // Reset paid now amount
      const paidNowInput = document.getElementById('paidNowAmount');
      if (paidNowInput) paidNowInput.value = '';
      const remainingDisplay = document.getElementById('remainingAmountDisplay');
      if (remainingDisplay) remainingDisplay.style.display = 'none';

      // Reset trade-in fields
      const tradeinToggle = document.getElementById('tradeinToggleCheckbox');
      if (tradeinToggle) tradeinToggle.checked = false;
      const tradeinContent = document.getElementById('tradeinContent');
      if (tradeinContent) tradeinContent.style.display = 'none';
      if (typeof clearTradeInFields === 'function') clearTradeInFields();

      // Reset payment rows
      const splitPayments = document.getElementById('splitPayments');
      if (splitPayments) {
        splitPayments.innerHTML = `
          <div class="split-payment-row" data-index="0">
            <select class="payment-method-select">
              <option value="cash">💵 كاش سائل</option>
              <option value="mobile_wallet">📱 محفظة إلكترونية</option>
              <option value="bank">🏦 حساب بنكي</option>
            </select>
            <input type="number" class="payment-amount" placeholder="المبلغ" min="0" step="0.01" />
          </div>
        `;
        splitPayments.querySelector('.payment-amount')?.addEventListener('input', updateSummary);
      }
      
      // Close and reset checkout modal
      closeCheckoutModal();
      resetCheckoutModal();

      // ✅ مسح الـ cache لإعادة تحميل البيانات الجديدة
      SmartCache.invalidate();

      // ✅ إخطار الصفحات الأخرى بالتحديث
      localStorage.setItem('pos_data_updated', Date.now().toString());

      // Refresh
      await search();
      await searchAccessories(); // تحديث قائمة الإكسسوارات أيضاً
      await loadRepairPartsCount(); // تحديث قطع الغيار أيضاً
      if (currentStore === 'repair_parts') await searchRepairParts(); // ✅ FIX: تحديث القائمة المعروضة
      renderCart();
      updateKPIs();

      // Update cash drawer preview - delay للتأكد من حفظ البيانات في الـ DB
      await new Promise(resolve => setTimeout(resolve, 300));
      await loadTodayCashPreview();

      // Reload clients to update balances
      await loadClients();

      // 🔧 تحديث إضافي بعد ثانية للتأكد (احتياطي)
      setTimeout(() => loadTodayCashPreview(), 1000);
      
    } else if (successCount > 0) {
      SoundFX.play('success');
      showToast(`تم بيع ${successCount} من ${totalItemsSold} عنصر`, 'warning', 5000);

      if (errors.length > 0) {
        Logger.error('Checkout errors:', errors);
        errors.forEach(e => showToast(`❌ ${e}`, 'error', 4000));
      }

      // ✅ FIX: تنظيف الـ Cache بعد البيع الجزئي لأن بيانات اتغيرت فعلاً
      SmartCache.invalidate();
      localStorage.setItem('pos_data_updated', Date.now().toString());

      // Clear sold items from cart (keep only failed ones)
      cart = cart.filter(item => errors.some(e => e.includes(item.label)));
      await search();
      await searchAccessories();
      await loadRepairPartsCount();
      if (currentStore === 'repair_parts') await searchRepairParts(); // ✅ FIX: تحديث القائمة المعروضة
      renderCart();
      updateSummary();
      updateKPIs();

      // تحديث عرض درج الكاش
      await new Promise(resolve => setTimeout(resolve, 300));
      await loadTodayCashPreview();

    } else {
      SoundFX.play('error');
      showToast('فشل البيع: ' + errors[0], 'error', 5000);
    }
    
  } catch (error) {
    Logger.error('Checkout error:', error);
    SoundFX.play('error');
    showToast('خطأ: ' + translateError(error.message), 'error');
  } finally {
    isLoading = false;
    UILoader.hide('checkout');
  }
}

// ═══════════════════════════════════════════════════════════════
// ⏸️ HOLD & LOAD INVOICES
// ═══════════════════════════════════════════════════════════════

function holdInvoice() {
  if (cart.length === 0) {
    showToast('السلة فارغة', 'warning');
    return;
  }
  
  // Collect payment methods
  const paymentMethods = [];
  const paymentRows = document.querySelectorAll('.split-payment-row');
  paymentRows.forEach(row => {
    const method = row.querySelector('.payment-method-select')?.value || 'cash';
    const amount = Number(row.querySelector('.payment-amount')?.value) || 0;
    if (amount > 0) {
      paymentMethods.push({ method, amount });
    }
  });
  
  const id = HeldInvoices.save(cart, cName?.value || '', cPhone?.value || '', paymentMethods);
  
  // Clear cart
  cart = [];
  if (cName) cName.value = '';
  if (cPhone) cPhone.value = '';
  if (discPct) discPct.value = '';
  if (discVal) discVal.value = '';
  
  // Reset payment rows
  const splitPayments = document.getElementById('splitPayments');
  if (splitPayments) {
    splitPayments.innerHTML = `
      <div class="split-payment-row" data-index="0">
        <select class="payment-method-select">
          <option value="cash">💵 كاش سائل</option>
          <option value="mobile_wallet">📱 محفظة إلكترونية</option>
          <option value="bank">🏦 حساب بنكي</option>
        </select>
        <input type="number" class="payment-amount" placeholder="المبلغ" min="0" step="0.01" />
      </div>
    `;
    // Re-add listener
    splitPayments.querySelector('.payment-amount')?.addEventListener('input', updateSummary);
  }
  
  // Refresh
  search();
  renderCart();
  updateKPIs();
  
  SoundFX.play('success');
  showToast(`تم تعليق الفاتورة #${id}`, 'success');
}

function showHeldInvoices() {
  const held = HeldInvoices.getAll();
  
  if (held.length === 0) {
    showToast('لا توجد فواتير معلقة', 'info');
    return;
  }
  
  const modal = document.getElementById('heldModal');
  const list = document.getElementById('heldList');
  
  if (!modal || !list) return;
  
  list.innerHTML = held.map(inv => {
    const total = sum(inv.cart, 'price');
    const date = new Date(inv.timestamp).toLocaleString('ar-EG');
    
    return `
      <div class="sale-item" style="margin-bottom: 12px;" data-id="${inv.id}">
        <div class="sale-item-header">
          <span class="sale-item-title">فاتورة #${inv.id}</span>
          <span class="sale-item-price">${fmt(total)} ج.م</span>
        </div>
        <div class="sale-item-details">
          ${inv.customerName || 'بدون اسم'} | ${inv.cart.length} جهاز | ${date}
        </div>
        <div style="margin-top: 10px; display: flex; gap: 8px;">
          <button class="btn btn-secondary" style="flex:1; padding:8px;" onclick="loadHeldInvoice(${inv.id})">
            📂 تحميل
          </button>
          <button class="btn btn-danger" style="padding:8px;" onclick="deleteHeldInvoice(${inv.id})">
            🗑️
          </button>
        </div>
      </div>
    `;
  }).join('');
  
  modal.style.display = 'flex';
  
  // Close button
  document.getElementById('closeHeldModal')?.addEventListener('click', () => {
    modal.style.display = 'none';
  });
  
  // Close on outside click
  modal.addEventListener('click', (e) => {
    if (e.target === modal) modal.style.display = 'none';
  });
}

window.loadHeldInvoice = function(id) {
  const invoice = HeldInvoices.load(id);
  
  if (!invoice) {
    showToast('لم يتم العثور على الفاتورة', 'error');
    return;
  }
  
  // Load invoice
  cart = invoice.cart;
  if (cName) cName.value = invoice.customerName || '';
  if (cPhone) cPhone.value = invoice.customerPhone || '';
  
  // Restore payment methods
  const splitPayments = document.getElementById('splitPayments');
  if (splitPayments && invoice.paymentMethods && invoice.paymentMethods.length > 0) {
    splitPayments.innerHTML = '';
    invoice.paymentMethods.forEach((pm, index) => {
      const row = document.createElement('div');
      row.className = 'split-payment-row';
      row.dataset.index = index;
      row.innerHTML = `
        <select class="payment-method-select">
          <option value="cash" ${pm.method === 'cash' ? 'selected' : ''}>💵 كاش سائل</option>
          <option value="mobile_wallet" ${pm.method === 'mobile_wallet' ? 'selected' : ''}>📱 محفظة إلكترونية</option>
          <option value="bank" ${pm.method === 'bank' ? 'selected' : ''}>🏦 حساب بنكي</option>
        </select>
        <input type="number" class="payment-amount" placeholder="المبلغ" min="0" step="0.01" value="${pm.amount}" />
        ${index > 0 ? '<button class="remove-split" onclick="removeSplitPaymentRow(this)">✕</button>' : ''}
      `;
      splitPayments.appendChild(row);
      row.querySelector('.payment-amount')?.addEventListener('input', updateSummary);
    });
  }
  
  renderCart();
  updateKPIs();
  
  // Remove from held
  HeldInvoices.remove(id);
  
  // Close modal
  const modal = document.getElementById('heldModal');
  if (modal) modal.style.display = 'none';
  
  SoundFX.play('success');
  showToast(`تم تحميل الفاتورة #${id}`, 'success');
};

window.deleteHeldInvoice = async function(id) {
  // ✅ استخدام showConfirm بدلاً من confirm
  const confirmed = await showConfirm('هل تريد حذف هذه الفاتورة المعلقة؟', 'حذف', 'إلغاء', 'danger');
  if (!confirmed) return;

  HeldInvoices.remove(id);
  showHeldInvoices(); // Refresh list
  showToast('تم حذف الفاتورة', 'info');
};

// ═══════════════════════════════════════════════════════════════
// 🖨️ THERMAL PRINTER RECEIPT SYSTEM
// Compatible with XPrinter S200N and similar thermal printers
// Supports 58mm and 80mm paper widths
// ═══════════════════════════════════════════════════════════════

/**
 * الحصول على إعدادات الطابعة
 */
function getPrinterSettings() {
  const saved = localStorage.getItem('appSettings');
  const settings = saved ? JSON.parse(saved) : {};

  return {
    companyName: settings.companyName || 'ELOS',
    companyLogo: settings.companyLogo || '', // Base64 logo
    companyPhone: settings.companyPhone || '',
    companyAddress: settings.companyAddress || '',
    paperWidth: settings.printerPaperWidth || '80', // 58 or 80 mm
    showLogo: settings.printerShowLogo !== false,
    footerMessage: settings.printerFooterMessage || 'شكراً لتعاملكم معنا',
    showItemDetails: settings.printerShowDetails !== false,
    fontSize: settings.printerFontSize || 'normal', // small, normal, large
    currency: settings.currency || 'ج.م'
  };
}

/**
 * إنشاء رقم فاتورة فريد
 */
function generateInvoiceNumber() {
  const now = new Date();
  const year = now.getFullYear().toString().slice(-2);
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  const random = Math.floor(Math.random() * 1000).toString().padStart(3, '0');
  return `${year}${month}${day}-${random}`;
}

/**
 * حساب ارتفاع الفاتورة بناءً على المحتوى
 */
function calculateReceiptHeight(itemCount, hasDiscount, hasCustomer, hasPaymentInfo) {
  // Base height for header, footer, totals
  let height = 120; // mm base

  // Add height per item (approximately 8mm per item)
  height += itemCount * 10;

  // Additional sections
  if (hasCustomer) height += 15;
  if (hasDiscount) height += 10;
  if (hasPaymentInfo) height += 15;

  return Math.max(height, 80); // minimum 80mm
}

// متغير لحفظ HTML الفاتورة للطباعة
let currentPrintHTML = '';

/**
 * توليد باركود Code128 كـ SVG
 * متوافق مع الطابعات الحرارية
 */
function generateBarcodeSVG(text) {
  // Use unified BarcodeService if available
  if (typeof BarcodeService !== 'undefined') {
    return BarcodeService.generateCode128SVG(text, 200, 35);
  }
  
  // Fallback implementation (should not be reached if barcode-service.js is loaded)
  Logger.warn('[BARCODE] Using fallback generateBarcodeSVG - barcode-service.js not loaded');
  // Code128B character set encoding
  const CODE128B = {
    ' ': '11011001100', '!': '11001101100', '"': '11001100110', '#': '10010011000',
    '$': '10010001100', '%': '10001001100', '&': '10011001000', "'": '10011000100',
    '(': '10001100100', ')': '11001001000', '*': '11001000100', '+': '11000100100',
    ',': '10110011100', '-': '10011011100', '.': '10011001110', '/': '10111001100',
    '0': '10011101100', '1': '11001011100', '2': '11001001110', '3': '11011100100',
    '4': '11001110100', '5': '11101101110', '6': '11101001100', '7': '11100101100',
    '8': '11100100110', '9': '11101100100', ':': '11100110100', ';': '11100110010',
    '<': '11011011000', '=': '11011000110', '>': '11000110110', '?': '10100011000',
    '@': '10001011000', 'A': '10001000110', 'B': '10110001000', 'C': '10001101000',
    'D': '10001100010', 'E': '11010001000', 'F': '11000101000', 'G': '11000100010',
    'H': '10110111000', 'I': '10110001110', 'J': '10001101110', 'K': '10111011000',
    'L': '10111000110', 'M': '10001110110', 'N': '11101110110', 'O': '11010001110',
    'P': '11000101110', 'Q': '11011101000', 'R': '11011100010', 'S': '11011101110',
    'T': '11101011000', 'U': '11101000110', 'V': '11100010110', 'W': '11101101000',
    'X': '11101100010', 'Y': '11100011010', 'Z': '11101111010', '[': '11001000010',
    '\\': '11110001010', ']': '10100110000', '^': '10100001100', '_': '10010110000',
    '`': '10010000110', 'a': '10000101100', 'b': '10000100110', 'c': '10110010000',
    'd': '10110000100', 'e': '10011010000', 'f': '10011000010', 'g': '10000110100',
    'h': '10000110010', 'i': '11000010010', 'j': '11001010000', 'k': '11110111010',
    'l': '11000010100', 'm': '10001111010', 'n': '10100111100', 'o': '10010111100',
    'p': '10010011110', 'q': '10111100100', 'r': '10011110100', 's': '10011110010',
    't': '11110100100', 'u': '11110010100', 'v': '11110010010', 'w': '11011011110',
    'x': '11011110110', 'y': '11110110110', 'z': '10101111000', '{': '10100011110',
    '|': '10001011110', '}': '10111101000', '~': '10111100010'
  };

  const START_B = '11010010000';
  const STOP = '1100011101011';
  const upperText = text.toUpperCase();
  let pattern = START_B;
  let checksum = 104;

  for (let i = 0; i < upperText.length; i++) {
    const char = upperText[i];
    const code = CODE128B[char];
    if (code) {
      pattern += code;
      const charValue = char.charCodeAt(0) - 32;
      checksum += charValue * (i + 1);
    }
  }

  const checksumChar = String.fromCharCode((checksum % 103) + 32);
  if (CODE128B[checksumChar]) {
    pattern += CODE128B[checksumChar];
  }

  pattern += STOP;

  const barWidth = 1.5;
  const height = 35;
  const width = pattern.length * barWidth;

  let svg = '<svg xmlns="http://www.w3.org/2000/svg" width="' + width + '" height="' + height + '" viewBox="0 0 ' + width + ' ' + height + '">';
  svg += '<rect width="100%" height="100%" fill="white"/>';

  let x = 0;
  for (let i = 0; i < pattern.length; i++) {
    if (pattern[i] === '1') {
      svg += '<rect x="' + x + '" y="0" width="' + barWidth + '" height="' + height + '" fill="black"/>';
    }
    x += barWidth;
  }

  svg += '</svg>';
  return svg;
}

/**
 * طباعة الفاتورة - متوافق مع الطابعات الحرارية
 * Thermal Printer Optimized Receipt
 */
function printReceipt(invoiceData = null) {
  Logger.log('[PRINT] printReceipt called', { cartLength: cart.length, invoiceData });

  if (cart.length === 0) {
    showToast('السلة فارغة', 'warning');
    return;
  }

  const settings = JSON.parse(localStorage.getItem('appSettings') || '{}');
  const invoiceNumber = invoiceData?.invoiceNumber || generateInvoiceNumber();

  const subtotal = sum(cart, 'price');
  const itemDiscounts = cart.reduce((total, item) => total + (item.discount || 0), 0);

  let globalDiscount = 0;
  // ✅ FIX: استخدام حقول الخصم من checkout modal الجديد + الحقول القديمة كـ fallback
  const checkoutDiscPctEl = document.getElementById('checkoutDiscPct');
  const checkoutDiscValEl = document.getElementById('checkoutDiscVal');
  const pct = Number(checkoutDiscPctEl?.value || discPct?.value || 0);
  const val = Number(checkoutDiscValEl?.value || discVal?.value || 0);
  const afterItemDiscounts = subtotal - itemDiscounts;

  if (pct > 0) globalDiscount = afterItemDiscounts * (pct / 100);
  if (val > 0) globalDiscount += val;

  const totalDiscount = itemDiscounts + globalDiscount;

  // 🔄 Trade-in (الاستبدال)
  const tradeinCheckbox = document.getElementById('tradeinToggleCheckbox');
  const tradeinValue = tradeinCheckbox?.checked ? Number(document.getElementById('tradeinDeviceValue')?.value || 0) : 0;
  const tradeinType = document.getElementById('tradeinDeviceType')?.value || '';
  const tradeinModel = document.getElementById('tradeinDeviceModel')?.value || '';
  const tradeinImei = document.getElementById('tradeinDeviceImei')?.value || '';
  const tradeinStorage = document.getElementById('tradeinDeviceStorage')?.value || '';
  const tradeinColor = document.getElementById('tradeinDeviceColor')?.value || '';
  const tradeinCondition = document.getElementById('tradeinDeviceCondition')?.value || '';

  // حساب الإجمالي مع الاستبدال
  const netAmount = subtotal - totalDiscount - tradeinValue;
  const customerDueAmount = netAmount < 0 ? Math.abs(netAmount) : 0; // فلوس للعميل
  const total = customerDueAmount > 0 ? 0 : Math.max(0, netAmount);

  // Calculate remaining from checkout modal if not provided in invoiceData
  let remaining = invoiceData?.remaining || 0;
  let paidAmount = total; // Default: fully paid

  // Check if deferred payment is active in checkout modal
  const deferredCheckbox = document.getElementById('deferredToggleCheckbox');
  const paidNowInput = document.getElementById('checkoutPaidNow');

  if (!invoiceData && deferredCheckbox?.checked && paidNowInput) {
    const paidNow = Number(paidNowInput.value || 0);
    paidAmount = paidNow;
    remaining = total - paidNow;
  }

  // Translate payment method to Arabic
  const paymentMethodMap = {
    'cash': 'كاش سائل',
    'mobile_wallet': 'محفظة إلكترونية',
    'bank': 'حساب بنكي',
    'split': 'تقسيم',
    'نقدي': 'كاش سائل',
    'deferred': 'آجل',
    'DEFERRED': 'آجل',
    'credit': 'آجل'
  };
  // Use checkoutPaymentMethod (the actual selected method from checkout modal)
  const rawMethod = invoiceData?.paymentMethod || checkoutPaymentMethod || 'cash';
  let paymentMethod = paymentMethodMap[rawMethod] || rawMethod;

  // If deferred payment, show appropriate label
  const isReceiptDeferred = ['deferred','DEFERRED','credit'].includes(rawMethod);
  if (isReceiptDeferred) {
    if (remaining > 0) {
      paymentMethod = 'آجل (دفع جزئي)';
    } else {
      paymentMethod = 'آجل';
    }
  } else if (remaining > 0) {
    paymentMethod = 'بالآجل (دفع جزئي)';
  }

  const customerName = cName?.value || document.getElementById('checkoutName')?.value || '';
  const customerPhone = cPhone?.value || document.getElementById('checkoutPhone')?.value || '';

  const paperWidth = settings.printerPaperWidth === '58' ? '54mm' : '72mm';
  const pageSize = settings.printerPaperWidth || '80';

  const now = new Date();
  const dateStr = now.toLocaleDateString('ar-EG');
  const timeStr = now.toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' });

  const devices = cart.filter(item => !item.type || item.type === 'device');
  const accessories = cart.filter(item => item.type === 'accessory');
  const repairParts = cart.filter(item => item.type === 'repair_part');

  // ═══════════════════════════════════════════════════════════════
  // بناء الأصناف - للطابعة الحرارية (خط أسود وكبير)
  // ═══════════════════════════════════════════════════════════════
  let itemsPreview = '';
  let itemsPrint = '';

  devices.forEach((item) => {
    const itemTotal = item.price - (item.discount || 0);
    const details = [item.storage, item.color, item.condition].filter(Boolean).join(' - ');

    // Preview
    itemsPreview += `
      <div style="padding: 8px 0; border-bottom: 1px solid #ddd;">
        <div style="display: flex; justify-content: space-between; margin-bottom: 4px;">
          <span style="font-weight: 700; font-size: 13px; color: #000;">${item.label || item.model || 'جهاز'}</span>
          <span style="font-weight: 700; font-size: 13px; color: #000;">${fmt(itemTotal)}</span>
        </div>
        ${details ? `<div style="font-size: 11px; color: #000; font-weight: 600;">${details}</div>` : ''}
        ${item.imei1 ? `<div style="font-size: 10px; color: #000; font-family: monospace;">IMEI: ${item.imei1}</div>` : ''}
        ${(item.discount || 0) > 0 ? `<div style="font-size: 10px; color: #000;">خصم: ${fmt(item.discount)}</div>` : ''}
      </div>`;

    // Print - كل النصوص سوداء وبولد
    itemsPrint += `
      <div class="item">
        <div class="item-header">
          <span>${item.label || item.model || 'جهاز'}</span>
          <span>${fmt(itemTotal)}</span>
        </div>
        ${details ? `<div class="item-details">${details}</div>` : ''}
        ${item.imei1 ? `<div class="item-imei">IMEI: ${item.imei1}</div>` : ''}
        ${(item.discount || 0) > 0 ? `<div class="item-discount">خصم: ${fmt(item.discount)}</div>` : ''}
      </div>`;
  });

  if (accessories.length > 0) {
    itemsPreview += `<div style="font-size: 11px; color: #000; font-weight: 700; padding: 8px 0 4px; border-bottom: 1px dashed #000;">الإكسسوارات</div>`;
    itemsPrint += `<div class="acc-divider">الإكسسوارات</div>`;

    accessories.forEach((item) => {
      const itemTotal = item.price - (item.discount || 0);
      const qty = item.qty || 1;
      const unitPrice = item.unitPrice || (qty > 1 ? item.price / qty : item.price);
      const qtyLine = qty > 1 ? `${qty} × ${fmt(unitPrice)}` : '';

      itemsPreview += `
        <div style="padding: 6px 0; font-size: 12px; font-weight: 600; color: #000;">
          <div style="display: flex; justify-content: space-between;">
            <span>${item.label || 'إكسسوار'}</span>
            <span>${fmt(itemTotal)}</span>
          </div>
          ${qtyLine ? `<div style="font-size: 10px; color: #000; font-weight: 600;">${qtyLine}</div>` : ''}
        </div>`;

      itemsPrint += `
        <div class="acc-item">
          <div style="display: flex; justify-content: space-between;">
            <span>${item.label || 'إكسسوار'}</span>
            <span>${fmt(itemTotal)}</span>
          </div>
          ${qtyLine ? `<div style="font-size: 10px;">${qtyLine}</div>` : ''}
        </div>`;
    });
  }

  // ✅ FIX: إضافة قطع الغيار للفاتورة
  if (repairParts.length > 0) {
    itemsPreview += `<div style="font-size: 11px; color: #000; font-weight: 700; padding: 8px 0 4px; border-bottom: 1px dashed #000;">قطع الغيار</div>`;
    itemsPrint += `<div class="acc-divider">قطع الغيار</div>`;

    repairParts.forEach((item) => {
      const qty = item.qty || 1;
      const unitPrice = item.unitPrice || (qty > 1 ? item.price / qty : item.price);
      const originalPrice = unitPrice * qty;
      const itemDiscount = item.discount || 0;
      const itemTotal = item.price - itemDiscount;
      const qtyLine = qty > 1 ? `${qty} × ${fmt(unitPrice)}` : '';

      // عرض السعر الأصلي والخصم إن وجد
      let priceDisplay = fmt(itemTotal);
      let discountLine = '';
      if (itemDiscount > 0) {
        discountLine = `<div style="font-size: 10px; color: #000;">السعر: ${fmt(originalPrice)} - خصم: ${fmt(itemDiscount)}</div>`;
      }

      itemsPreview += `
        <div style="padding: 6px 0; font-size: 12px; font-weight: 600; color: #000;">
          <div style="display: flex; justify-content: space-between;">
            <span>${item.label || 'قطعة غيار'}</span>
            <span>${priceDisplay}</span>
          </div>
          ${qtyLine ? `<div style="font-size: 10px; color: #000; font-weight: 600;">${qtyLine}</div>` : ''}
          ${discountLine}
        </div>`;

      itemsPrint += `
        <div class="acc-item">
          <div style="display: flex; justify-content: space-between;">
            <span>${item.label || 'قطعة غيار'}</span>
            <span>${priceDisplay}</span>
          </div>
          ${qtyLine ? `<div style="font-size: 10px;">${qtyLine}</div>` : ''}
          ${itemDiscount > 0 ? `<div class="item-discount">السعر: ${fmt(originalPrice)} - خصم: ${fmt(itemDiscount)}</div>` : ''}
        </div>`;
    });
  }

  // ═══════════════════════════════════════════════════════════════
  // المعاينة - متوافق مع الطابعة الحرارية
  // ═══════════════════════════════════════════════════════════════
  const companyPhone = settings.companyPhone || '';
  const companyAddress = settings.companyAddress || '';

  const previewHTML = `
    <div dir="rtl" style="font-family: Arial, Tahoma, sans-serif; max-width: 100%; padding: 16px; background: #fff; color: #000;">

      <!-- Header -->
      <div style="text-align: center; padding-bottom: 12px; border-bottom: 2px solid #000;">
        ${settings.companyLogo ? `<img src="${settings.companyLogo}" style="width: 45px; height: 45px; object-fit: contain; margin-bottom: 6px;" />` : ''}
        <div style="font-size: 18px; font-weight: 700; letter-spacing: 1px;">${settings.companyName || 'ELOS'}</div>
        ${companyPhone ? `<div style="font-size: 11px; font-weight: 600; margin-top: 4px;">📞 ${companyPhone}</div>` : ''}
        ${companyAddress ? `<div style="font-size: 10px; font-weight: 600; margin-top: 2px;">📍 ${companyAddress}</div>` : ''}
      </div>

      <!-- Invoice Info -->
      <div style="display: flex; justify-content: space-between; padding: 10px 0; font-size: 11px; color: #000; font-weight: 600; border-bottom: 1px solid #000;">
        <div>
          <div style="font-weight: 700; font-size: 12px;">#${invoiceNumber}</div>
          <div>${dateStr} - ${timeStr}</div>
        </div>
        ${customerName || customerPhone ? `
          <div style="text-align: left;">
            ${customerName ? `<div style="font-weight: 700;">${customerName}</div>` : ''}
            ${customerPhone ? `<div style="direction: ltr;">${customerPhone}</div>` : ''}
          </div>
        ` : ''}
      </div>

      <!-- Items -->
      <div style="padding: 8px 0;">
        ${itemsPreview}
      </div>

      <!-- Summary -->
      ${cart.length > 1 || totalDiscount > 0 ? `
        <div style="border-top: 1px solid #000; padding-top: 8px; font-size: 12px; color: #000; font-weight: 600;">
          ${cart.length > 1 ? `<div style="display: flex; justify-content: space-between; padding: 4px 0;"><span>المجموع (${cart.length} صنف)</span><span>${fmt(subtotal)}</span></div>` : ''}
          ${totalDiscount > 0 ? `<div style="display: flex; justify-content: space-between; padding: 4px 0;"><span>خصم</span><span>- ${fmt(totalDiscount)}</span></div>` : ''}
        </div>
      ` : ''}

      <!-- 🔄 Trade-in Section (الاستبدال) - متوافق مع الطابعة الحرارية -->
      ${tradeinValue > 0 ? `
        <div style="border: 2px solid #000; margin: 12px 0; padding: 10px;">
          <div style="font-weight: 900; font-size: 12px; color: #000; margin-bottom: 8px; text-align: center; border-bottom: 1px dashed #000; padding-bottom: 6px;">
            *** جهاز استبدال ***
          </div>
          <div style="font-size: 11px; color: #000; font-weight: 700;">
            <div style="display: flex; justify-content: space-between; padding: 3px 0;">
              <span>النوع/الموديل:</span>
              <span>${tradeinType} ${tradeinModel}</span>
            </div>
            ${tradeinStorage ? `<div style="display: flex; justify-content: space-between; padding: 3px 0;"><span>السعة:</span><span>${tradeinStorage}</span></div>` : ''}
            ${tradeinColor ? `<div style="display: flex; justify-content: space-between; padding: 3px 0;"><span>اللون:</span><span>${tradeinColor}</span></div>` : ''}
            ${tradeinImei ? `<div style="display: flex; justify-content: space-between; padding: 3px 0;"><span>IMEI:</span><span style="font-family: monospace;">${tradeinImei}</span></div>` : ''}
            ${tradeinCondition ? `<div style="display: flex; justify-content: space-between; padding: 3px 0;"><span>الحالة:</span><span>${tradeinCondition}</span></div>` : ''}
            <div style="display: flex; justify-content: space-between; padding: 6px 0; margin-top: 6px; border-top: 2px solid #000; font-size: 13px; font-weight: 900; color: #000;">
              <span>قيمة الاستبدال:</span>
              <span>- ${fmt(tradeinValue)} ج.م</span>
            </div>
          </div>
        </div>
      ` : ''}

      <!-- Total -->
      <div style="background: #000; color: #fff; margin: 12px -16px; padding: 14px 16px; text-align: center;">
        <div style="font-size: 11px; letter-spacing: 2px; margin-bottom: 4px;">${customerDueAmount > 0 ? 'مستحق للعميل' : 'الإجمالي'}</div>
        <div style="font-size: 22px; font-weight: 700;">EGP ${fmt(customerDueAmount > 0 ? customerDueAmount : total)}</div>
      </div>

      <!-- Payment -->
      <div style="display: flex; justify-content: space-between; font-size: 12px; padding: 8px 0; font-weight: 600; color: #000;">
        <span>طريقة الدفع:</span>
        <span>${paymentMethod}</span>
      </div>

      <!-- مستحق للعميل من الاستبدال - متوافق مع الطابعة الحرارية -->
      ${customerDueAmount > 0 ? `
        <div style="background: #000; margin: 0 -16px; padding: 12px 16px; display: flex; justify-content: space-between; font-size: 14px; font-weight: 900; color: #fff;">
          <span>*** تم دفعه للعميل ***</span>
          <span>${fmt(customerDueAmount)} ج.م</span>
        </div>
      ` : ''}

      ${remaining > 0 ? `
        <div style="background: #eee; margin: 0 -16px; padding: 10px 16px; display: flex; justify-content: space-between; font-size: 13px; font-weight: 900; color: #000; border-bottom: 1px solid #000;">
          <span>المدفوع الآن</span>
          <span>${fmt(paidAmount)} ج.م</span>
        </div>
        <div style="background: #000; margin: 0 -16px; padding: 12px 16px; display: flex; justify-content: space-between; font-size: 14px; font-weight: 900; color: #fff;">
          <span>المتبقي على العميل</span>
          <span>${fmt(remaining)} ج.م</span>
        </div>
      ` : ''}

      <!-- Footer -->
      <div style="text-align: center; padding-top: 12px; margin-top: 8px; border-top: 2px solid #000;">
        <div style="font-size: 11px; color: #000; font-weight: 600; margin-bottom: 10px;">${settings.printerFooterMessage || 'شكراً لتعاملكم معنا'}</div>
        <div>${generateBarcodeSVG(invoiceNumber.replace(/[^A-Z0-9]/gi, '').slice(-12))}</div>
        <div style="font-family: monospace; font-size: 10px; color: #000; font-weight: 600; margin-top: 4px;">${invoiceNumber}</div>
        <div style="margin-top: 10px; padding-top: 8px; border-top: 1px dashed #000; font-size: 9px; font-weight: 600; color: #000; letter-spacing: 0.5px;">
          <div>ELOS ACCOUNTING SYSTEM</div>
          <div>01031372078</div>
        </div>
      </div>
    </div>
  `;

  // ═══════════════════════════════════════════════════════════════
  // HTML للطباعة - محسن للطابعات الحرارية XP-D200N
  // كل النصوص سوداء - خطوط كبيرة - Bold
  // ═══════════════════════════════════════════════════════════════
  currentPrintHTML = `<!DOCTYPE html>
<html dir="rtl" lang="ar">
<head>
  <meta charset="UTF-8">
  <title>فاتورة</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    @page { size: ${pageSize}mm auto; margin: 0; }
    
    body {
      font-family: Arial, Tahoma, sans-serif;
      width: ${paperWidth};
      max-width: ${paperWidth};
      margin: 0 auto;
      padding: 3mm;
      background: #fff;
      color: #000;
      font-size: 12px;
      line-height: 1.4;
      font-weight: 600;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }
    
    .header {
      text-align: center;
      padding-bottom: 3mm;
      border-bottom: 0.5mm solid #000;
      margin-bottom: 2mm;
    }
    .logo { max-width: 14mm; max-height: 14mm; margin-bottom: 1mm; display: block; margin-left: auto; margin-right: auto; }
    .shop-name { font-size: 16px; font-weight: 700; letter-spacing: 0.5mm; }
    
    .info {
      display: flex;
      justify-content: space-between;
      padding: 2mm 0;
      font-size: 11px;
      font-weight: 600;
      color: #000;
      border-bottom: 0.3mm solid #000;
    }
    .info-num { font-weight: 700; font-size: 12px; }
    
    .items { padding: 2mm 0; }
    .item {
      padding: 2mm 0;
      border-bottom: 0.3mm solid #000;
    }
    .item:last-child { border-bottom: none; }
    .item-header {
      display: flex;
      justify-content: space-between;
      font-weight: 700;
      font-size: 12px;
      color: #000;
    }
    .item-details {
      font-size: 11px;
      font-weight: 600;
      color: #000;
      margin-top: 1mm;
    }
    .item-imei {
      font-size: 10px;
      font-weight: 600;
      color: #000;
      font-family: monospace;
      margin-top: 0.5mm;
    }
    
    .acc-divider {
      font-size: 11px;
      font-weight: 700;
      color: #000;
      padding: 2mm 0 1mm;
      border-bottom: 0.3mm dashed #000;
      margin-top: 1mm;
    }
    .acc-item {
      display: flex;
      justify-content: space-between;
      padding: 1.5mm 0;
      font-size: 11px;
      font-weight: 600;
      color: #000;
    }
    
    .summary {
      border-top: 0.3mm solid #000;
      padding-top: 2mm;
      margin-top: 1mm;
      font-size: 11px;
      font-weight: 600;
      color: #000;
    }
    .summary-row {
      display: flex;
      justify-content: space-between;
      padding: 1mm 0;
    }
    
    .total {
      background: #000;
      color: #fff;
      margin: 3mm -3mm;
      padding: 4mm 3mm;
      text-align: center;
    }
    .total-label {
      font-size: 10px;
      font-weight: 600;
      letter-spacing: 1mm;
    }
    .total-amount {
      font-size: 18px;
      font-weight: 700;
      margin-top: 1mm;
    }
    
    .payment {
      display: flex;
      justify-content: space-between;
      font-size: 11px;
      font-weight: 600;
      padding: 2mm 0;
      color: #000;
    }
    
    .remaining {
      background: #ddd;
      margin: 0 -3mm;
      padding: 2mm 3mm;
      display: flex;
      justify-content: space-between;
      font-size: 11px;
      font-weight: 700;
      color: #000;
    }
    
    .footer {
      text-align: center;
      padding-top: 3mm;
      margin-top: 2mm;
      border-top: 0.3mm solid #000;
    }
    .footer-msg {
      font-size: 11px;
      font-weight: 600;
      color: #000;
      margin-bottom: 2mm;
    }
    .barcode { margin-top: 2mm; text-align: center; }
    .barcode svg { max-width: 85%; height: auto; display: block; margin: 0 auto; }
    .barcode-num {
      font-family: monospace;
      font-size: 10px;
      font-weight: 700;
      color: #000;
      margin-top: 1mm;
    }
    .elos-sig {
      margin-top: 3mm;
      padding-top: 2mm;
      border-top: 0.3mm dashed #000;
      font-size: 9px;
      font-weight: 600;
      color: #000;
      letter-spacing: 0.3mm;
    }
    .shop-contact {
      font-size: 11px;
      font-weight: 700;
      color: #000;
      margin-top: 1mm;
    }
    .shop-address {
      font-size: 10px;
      font-weight: 600;
      color: #000;
      margin-top: 0.5mm;
    }
    .paid-row {
      background: #ddd;
      margin: 0 -3mm;
      padding: 2mm 3mm;
      display: flex;
      justify-content: space-between;
      font-size: 12px;
      font-weight: 900;
      color: #000;
      border-bottom: 0.3mm solid #000;
    }
    .remaining-row {
      background: #000;
      margin: 0 -3mm;
      padding: 2.5mm 3mm;
      display: flex;
      justify-content: space-between;
      font-size: 13px;
      font-weight: 900;
      color: #fff;
    }
  </style>
</head>
<body>

  <div class="header">
    ${settings.companyLogo ? `<img src="${settings.companyLogo}" class="logo" style="display:block; margin:0 auto 1mm auto;" />` : ''}
    <div class="shop-name">${settings.companyName || 'ELOS'}</div>
    ${companyPhone ? `<div class="shop-contact">${companyPhone}</div>` : ''}
    ${companyAddress ? `<div class="shop-address">${companyAddress}</div>` : ''}
  </div>

  <div class="info">
    <div>
      <div class="info-num">#${invoiceNumber}</div>
      <div>${dateStr} - ${timeStr}</div>
    </div>
    ${customerName || customerPhone ? `
      <div style="text-align: left;">
        ${customerName ? `<div style="font-weight: 700;">${customerName}</div>` : ''}
        ${customerPhone ? `<div>${customerPhone}</div>` : ''}
      </div>
    ` : ''}
  </div>
  
  <div class="items">
    ${itemsPrint}
  </div>
  
  ${cart.length > 1 || totalDiscount > 0 ? `
    <div class="summary">
      ${cart.length > 1 ? `<div class="summary-row"><span>المجموع (${cart.length} صنف)</span><span>${fmt(subtotal)}</span></div>` : ''}
      ${totalDiscount > 0 ? `<div class="summary-row"><span>خصم</span><span>- ${fmt(totalDiscount)}</span></div>` : ''}
    </div>
  ` : ''}
  
  <div class="total">
    <div class="total-label">الإجمالي</div>
    <div class="total-amount">EGP ${fmt(total)}</div>
  </div>
  
  <div class="payment">
    <span>طريقة الدفع:</span>
    <span>${paymentMethod}</span>
  </div>

  ${remaining > 0 ? `
    <div class="paid-row">
      <span>المدفوع الآن</span>
      <span>${fmt(paidAmount)} ج.م</span>
    </div>
    <div class="remaining-row">
      <span>المتبقي على العميل</span>
      <span>${fmt(remaining)} ج.م</span>
    </div>
  ` : ''}
  
  <div class="footer">
    <div class="footer-msg">${settings.printerFooterMessage || 'شكراً لتعاملكم معنا'}</div>
    <div class="barcode" style="text-align:center;">
      <div style="display:inline-block;">${generateBarcodeSVG(invoiceNumber.replace(/[^A-Z0-9]/gi, '').slice(-12))}</div>
      <div class="barcode-num">${invoiceNumber}</div>
    </div>
    <div class="elos-sig">
      <div>ELOS ACCOUNTING SYSTEM</div>
      <div>01031372078</div>
    </div>
  </div>

</body>
</html>`;

  showPrintPreview(currentPrintHTML);
}

// عرض نافذة المعاينة
function showPrintPreview(previewHTML) {
  // حذف أي modal قديم
  let existingModal = document.getElementById('dynamicPrintModal');
  if (existingModal) existingModal.remove();

  // إنشاء modal جديد
  const modal = document.createElement('div');
  modal.id = 'dynamicPrintModal';
  modal.style.cssText = 'position:fixed;top:0;left:0;right:0;bottom:0;background:rgba(0,0,0,0.6);z-index:2500;display:flex;justify-content:center;align-items:center;padding:20px;';

  modal.innerHTML = '<div style="background:#fff;border-radius:12px;max-width:420px;width:100%;max-height:85vh;display:flex;flex-direction:column;box-shadow:0 25px 80px rgba(0,0,0,0.6);overflow:hidden;">' +
    '<div style="display:flex;justify-content:space-between;align-items:center;padding:14px 18px;background:linear-gradient(135deg,#2563eb,#1d4ed8);color:white;">' +
    '<span style="font-weight:bold;font-size:16px;">🖨️ معاينة الفاتورة</span>' +
    '<button id="closePrintPreviewBtn" style="background:rgba(255,255,255,0.2);border:none;font-size:20px;cursor:pointer;color:white;width:32px;height:32px;border-radius:50%;display:flex;align-items:center;justify-content:center;">&times;</button>' +
    '</div>' +
    '<div id="previewContentArea" style="flex:1;overflow-y:auto;background:#fff;max-height:60vh;"></div>' +
    '<div style="display:flex;gap:12px;padding:14px 18px;background:#f1f5f9;border-top:1px solid #e2e8f0;">' +
    '<button id="cancelPrintBtn" style="flex:1;padding:14px;border:none;background:linear-gradient(135deg,#ef4444,#dc2626);color:#fff;border-radius:10px;cursor:pointer;font-size:15px;font-weight:bold;">إلغاء</button>' +
    '<button id="confirmPrintBtn" style="flex:2;padding:14px;border:none;background:linear-gradient(135deg,#10b981,#059669);color:#fff;border-radius:10px;cursor:pointer;font-size:15px;font-weight:bold;">🖨️ طباعة الآن</button>' +
    '</div>' +
    '</div>';

  document.body.appendChild(modal);

  // استخدام iframe لعزل CSS المعاينة عن الصفحة الرئيسية
  const previewArea = document.getElementById('previewContentArea');
  const iframe = document.createElement('iframe');
  iframe.style.cssText = 'width:100%;border:none;background:#fff;';
  previewArea.appendChild(iframe);

  // كتابة المحتوى في الـ iframe
  const iframeDoc = iframe.contentDocument || iframe.contentWindow.document;
  iframeDoc.open();
  iframeDoc.write(previewHTML);
  iframeDoc.close();

  // ضبط ارتفاع الـ iframe بعد تحميل المحتوى
  iframe.onload = function() {
    try {
      const height = iframeDoc.body.scrollHeight;
      iframe.style.height = Math.min(height + 20, 500) + 'px';
    } catch(e) {
      iframe.style.height = '500px';
    }
  };
  // تفعيل الـ onload يدوياً
  setTimeout(function() {
    try {
      const height = iframeDoc.body.scrollHeight;
      iframe.style.height = Math.min(height + 20, 500) + 'px';
    } catch(e) {
      iframe.style.height = '500px';
    }
  }, 100);

  // Event listeners
  document.getElementById('closePrintPreviewBtn').onclick = closePrintPreview;
  document.getElementById('cancelPrintBtn').onclick = closePrintPreview;
  document.getElementById('confirmPrintBtn').onclick = executePrint;

  // إغلاق عند الضغط خارج النافذة
  modal.onclick = function(e) {
    if (e.target === modal) closePrintPreview();
  };

  Logger.log('[PRINT] Preview modal created and shown');
}

// إغلاق نافذة المعاينة
function closePrintPreview() {
  const modal = document.getElementById('dynamicPrintModal');
  if (modal) modal.remove();
  currentPrintHTML = '';
}

// تنفيذ الطباعة
function executePrint() {
  if (!currentPrintHTML) {
    showToast('لا توجد فاتورة للطباعة', 'error');
    return;
  }

  Logger.log('[PRINT] Executing print via iframe...');

  // إنشاء iframe للطباعة
  let printFrame = document.getElementById('printFrame');
  if (!printFrame) {
    printFrame = document.createElement('iframe');
    printFrame.id = 'printFrame';
    printFrame.style.cssText = 'position: absolute; top: -9999px; left: -9999px; width: 0; height: 0; border: none;';
    document.body.appendChild(printFrame);
  }

  const doc = printFrame.contentWindow.document;
  doc.open();
  doc.write(currentPrintHTML);
  doc.close();

  setTimeout(() => {
    try {
      printFrame.contentWindow.focus();
      printFrame.contentWindow.print();
      setTimeout(() => closePrintPreview(), 1000);
    } catch (e) {
      Logger.error('[PRINT] Error:', e);
      showToast('خطأ في الطباعة', 'error');
    }
  }, 300);
}

/**
 * طباعة نسخة مختصرة (للطابعات الصغيرة 58mm)
 */
function printReceiptCompact() {
  // حفظ الإعداد الأصلي
  const settings = JSON.parse(localStorage.getItem('appSettings') || '{}');
  const originalWidth = settings.printerPaperWidth;

  // تعيين مؤقت لـ 58mm
  settings.printerPaperWidth = '58';
  localStorage.setItem('appSettings', JSON.stringify(settings));

  // طباعة
  printReceipt();

  // استعادة الإعداد الأصلي
  if (originalWidth) {
    settings.printerPaperWidth = originalWidth;
  } else {
    delete settings.printerPaperWidth;
  }
  localStorage.setItem('appSettings', JSON.stringify(settings));
}

// ═══════════════════════════════════════════════════════════════
// ⌨️ EVENT LISTENERS
// ═══════════════════════════════════════════════════════════════

// Search handlers
q?.addEventListener('input', debouncedSearch);
cond?.addEventListener('change', smartSearch);
document.getElementById('accCategory')?.addEventListener('change', searchAccessories);
document.getElementById('repairPartCategory')?.addEventListener('change', searchRepairParts);
btnFind?.addEventListener('click', smartSearch);

// Enter key for search
q?.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') smartSearch();
});

// Cart action handlers
btnClear?.addEventListener('click', clearCart);
btnCheckout?.addEventListener('click', checkout);
btnHold?.addEventListener('click', holdInvoice);
btnLoadHeld?.addEventListener('click', showHeldInvoices);
btnPrint?.addEventListener('click', printReceipt);
btnPrintModal?.addEventListener('click', printReceipt);

// Open checkout modal directly (unified checkout experience)
btnOpenCart?.addEventListener('click', openCheckoutModal);

// Close cart modal
document.getElementById('closeCartModal')?.addEventListener('click', closeCartModal);
document.getElementById('closeCartModalBtn')?.addEventListener('click', closeCartModal);

function closeCartModal() {
  if (cartModal) {
    cartModal.style.display = 'none';
  }
}

// Close modal on outside click
cartModal?.addEventListener('click', (e) => {
  if (e.target === cartModal) {
    closeCartModal();
  }
});

// Split payment handlers
document.getElementById('addSplitPayment')?.addEventListener('click', addSplitPaymentRow);

function addSplitPaymentRow() {
  const container = document.getElementById('splitPayments');
  if (!container) return;
  
  const index = container.children.length;
  const row = document.createElement('div');
  row.className = 'split-payment-row';
  row.dataset.index = index;
  row.innerHTML = `
    <select class="payment-method-select">
      <option value="cash">💵 كاش سائل</option>
      <option value="mobile_wallet">📱 محفظة إلكترونية</option>
      <option value="bank">🏦 حساب بنكي</option>
    </select>
    <input type="number" class="payment-amount" placeholder="المبلغ" min="0" step="0.01" />
    <button class="remove-split" onclick="removeSplitPaymentRow(this)">✕</button>
  `;
  
  container.appendChild(row);
  
  // Add input listener
  row.querySelector('.payment-amount')?.addEventListener('input', updateSummary);
  
  SoundFX.play('add');
}

window.removeSplitPaymentRow = function(btn) {
  const row = btn.closest('.split-payment-row');
  if (row) {
    row.remove();
    updateSummary();
    SoundFX.play('remove');
  }
};

// Add listeners to initial payment inputs
document.querySelectorAll('.payment-amount').forEach(input => {
  input.addEventListener('input', updateSummary);
});

// ═══════════════════════════════════════════════════════════════
// ⌨️ KEYBOARD SHORTCUTS - Enhanced
// ═══════════════════════════════════════════════════════════════
document.addEventListener('keydown', (e) => {
  // Don't trigger if in input (except for specific shortcuts)
  const isInput = ['INPUT', 'TEXTAREA', 'SELECT'].includes(document.activeElement.tagName);
  const checkoutModalOpen = document.getElementById('checkoutModal')?.classList.contains('show');

  // Ctrl/Cmd + Enter = Checkout (works anywhere)
  if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
    e.preventDefault();
    if (checkoutModalOpen) {
      confirmCheckout();
    } else {
      checkout();
    }
    return;
  }

  // Ctrl + D = Apply quick discount (10%)
  if ((e.ctrlKey || e.metaKey) && e.key === 'd') {
    e.preventDefault();
    if (checkoutModalOpen) {
      const discPct = document.getElementById('checkoutDiscPct');
      if (discPct) {
        discPct.value = 10;
        updateCheckoutTotals();
        showToast('تم تطبيق خصم 10%', 'success');
      }
    }
    return;
  }

  // Ctrl + Shift + D = Clear discount
  if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === 'D') {
    e.preventDefault();
    if (checkoutModalOpen) {
      document.getElementById('checkoutDiscPct').value = '';
      document.getElementById('checkoutDiscVal').value = '';
      updateCheckoutTotals();
      showToast('تم إلغاء الخصم', 'info');
    }
    return;
  }

  // F6 = Toggle between Devices and Accessories
  if (e.key === 'F6') {
    e.preventDefault();
    const newStore = currentStore === 'devices' ? 'accessories' : 'devices';
    switchStore(newStore);
    showToast(`تم التبديل إلى ${newStore === 'devices' ? 'الأجهزة' : 'الإكسسوارات'}`, 'info');
    return;
  }

  // F7 = Print receipt
  if (e.key === 'F7') {
    e.preventDefault();
    printReceipt();
    return;
  }

  // F8 = Open cash drawer
  if (e.key === 'F8') {
    e.preventDefault();
    openCashDrawerModal();
    return;
  }

  // Ctrl + B = Focus on cash received (for quick change calculation)
  if ((e.ctrlKey || e.metaKey) && e.key === 'b') {
    e.preventDefault();
    if (checkoutModalOpen) {
      const cashInput = document.getElementById('checkoutCashReceived');
      if (cashInput) {
        cashInput.focus();
        cashInput.select();
      }
    }
    return;
  }

  if (isInput) return;

  // ═══════════════════════════════════════
  // 🆕 NEW UX SHORTCUTS
  // ═══════════════════════════════════════

  // Ctrl + Z = Undo last action
  if ((e.ctrlKey || e.metaKey) && e.key === 'z') {
    e.preventDefault();
    UndoManager.undo();
    return;
  }

  // Ctrl + / = Show help/shortcuts
  if ((e.ctrlKey || e.metaKey) && e.key === '/') {
    e.preventDefault();
    HelpSystem.showModal();
    return;
  }

  // Ctrl + = or Ctrl + + = Increase font size
  if ((e.ctrlKey || e.metaKey) && (e.key === '=' || e.key === '+')) {
    e.preventDefault();
    FontSizeControl.increase();
    return;
  }

  // Ctrl + - = Decrease font size
  if ((e.ctrlKey || e.metaKey) && e.key === '-') {
    e.preventDefault();
    FontSizeControl.decrease();
    return;
  }

  // ═══════════════════════════════════════

  // F1 = Focus search
  if (e.key === 'F1' || ((e.ctrlKey || e.metaKey) && e.key === 'f')) {
    e.preventDefault();
    q?.focus();
    q?.select();
    VisualFeedback.showShortcutFeedback('F1', 'البحث');
  }

  // F2 = Focus customer name
  if (e.key === 'F2') {
    e.preventDefault();
    cName?.focus();
    VisualFeedback.showShortcutFeedback('F2', 'بيانات العميل');
  }

  // F3 = Clear cart
  if (e.key === 'F3') {
    e.preventDefault();
    // حفظ السلة قبل المسح للـ Undo
    if (cart.length > 0) {
      UndoManager.push('clear-cart', cart, 'مسح السلة');
    }
    clearCart();
    VisualFeedback.showShortcutFeedback('F3', 'مسح السلة');
  }

  // F4 = Hold invoice
  if (e.key === 'F4') {
    e.preventDefault();
    holdInvoice();
  }

  // F5 = Load held invoices
  if (e.key === 'F5') {
    e.preventDefault();
    showHeldInvoices();
  }

  // Escape = Clear search or close modal
  if (e.key === 'Escape') {
    // Close checkout modal if open
    if (checkoutModalOpen) {
      closeCheckoutModal();
      return;
    }
    // Close cart modal if open
    if (cartModal?.style.display === 'flex') {
      closeCartModal();
      return;
    }
    if (q) q.value = '';
    search();
  }

  // + = Quick add last item again
  if (e.key === '+' || e.key === '=') {
    if (cart.length > 0) {
      showToast('آخر عنصر: ' + cart[cart.length - 1].name, 'info');
    }
  }

  // F9 = Open shift close modal
  if (e.key === 'F9') {
    e.preventDefault();
    if (typeof openCloseShiftModal === 'function') openCloseShiftModal();
  }

  // Ctrl + H = Show held invoices
  if ((e.ctrlKey || e.metaKey) && e.key === 'h') {
    e.preventDefault();
    showHeldInvoices();
  }

  // Ctrl + / = Show keyboard shortcuts help
  if ((e.ctrlKey || e.metaKey) && e.key === '/') {
    e.preventDefault();
    showKeyboardShortcutsHelp();
  }

  // Delete = Remove last item from cart
  if (e.key === 'Delete' && cart.length > 0) {
    e.preventDefault();
    const lastItem = cart[cart.length - 1];
    if (lastItem.type === 'accessory') {
      removeAccessoryFromCart(lastItem.id);
    } else {
      removeFromCart(lastItem.id);
    }
  }

  // Page Up/Down = Navigate through product cards
  if (e.key === 'PageDown' || e.key === 'PageUp') {
    const cardsContainer = document.getElementById('cards');
    if (cardsContainer) {
      const scrollAmount = e.key === 'PageDown' ? 300 : -300;
      cardsContainer.scrollBy({ top: scrollAmount, behavior: 'smooth' });
    }
  }
});

// Show keyboard shortcuts help modal
function showKeyboardShortcutsHelp() {
  const shortcuts = [
    { key: 'F1 / Ctrl+F', desc: 'التركيز على البحث' },
    { key: 'F2', desc: 'التركيز على اسم العميل' },
    { key: 'F3', desc: 'مسح السلة' },
    { key: 'F4', desc: 'تعليق الفاتورة' },
    { key: 'F5', desc: 'عرض الفواتير المعلقة' },
    { key: 'F6', desc: 'التبديل بين الأجهزة والإكسسوارات' },
    { key: 'F7', desc: 'طباعة الإيصال' },
    { key: 'F8', desc: 'فتح درج الكاش' },
    { key: 'F9', desc: 'تقفيل الشفت' },
    { key: 'Ctrl+Enter', desc: 'تأكيد البيع' },
    { key: 'Ctrl+D', desc: 'تطبيق خصم 10%' },
    { key: 'Ctrl+Shift+D', desc: 'إلغاء الخصم' },
    { key: 'Ctrl+B', desc: 'التركيز على المبلغ المستلم' },
    { key: 'Ctrl+H', desc: 'الفواتير المعلقة' },
    { key: 'Delete', desc: 'حذف آخر عنصر من السلة' },
    { key: 'Escape', desc: 'إغلاق النافذة / مسح البحث' },
    { key: 'PageUp/Down', desc: 'التنقل في المنتجات' }
  ];

  const html = shortcuts.map(s =>
    `<div style="display:flex;justify-content:space-between;padding:8px 0;border-bottom:1px solid var(--border);">
      <kbd style="background:var(--surface);padding:4px 8px;border-radius:4px;font-family:monospace;">${s.key}</kbd>
      <span>${s.desc}</span>
    </div>`
  ).join('');

  showToast(`
    <div style="text-align:right;">
      <h3 style="margin-bottom:12px;">⌨️ اختصارات لوحة المفاتيح</h3>
      ${html}
    </div>
  `, 'info', 10000);
}

// ═══════════════════════════════════════════════════════════════
// 💰 CASH DRAWER SYSTEM
// ═══════════════════════════════════════════════════════════════

// Cash drawer state
let currentCashData = null;

// ✅ v1.2.3: دالة للحصول على مفتاح وقت التقفيل الخاص بالمستخدم
function getLastClosingTimeKey() {
  const currentUser = window.currentUser || JSON.parse(localStorage.getItem('currentUser') || '{}');
  const userId = currentUser?.id || 'unknown';
  return `pos_last_closing_time_user_${userId}`;
}

// 🔄 مزامنة وقت آخر تقفيل من قاعدة البيانات
// يتم استدعاؤها عند بدء التشغيل لضمان تطابق localStorage مع DB
// 🔄 Per-User: يجلب آخر تقفيل للمستخدم الحالي فقط
async function syncLastClosingTime() {
  try {
    // 🔄 Per-User: إضافة user_id للفلترة
    const currentUser = window.currentUser || JSON.parse(localStorage.getItem('currentUser') || '{}');
    const userId = currentUser?.id;
    const closingTimeKey = getLastClosingTimeKey();

    let url = 'elos-db://shift-closings?limit=1';
    if (userId) {
      url += `&user_id=${userId}`;
    }

    const res = await fetch(url);
    if (res.ok) {
      const closings = await res.json();
      if (closings && closings.length > 0 && closings[0].closed_at) {
        let dbClosingTime = closings[0].closed_at;
        // ✅ PATCH 3: Use SessionCache
        const localClosingTime = SessionCache.get(closingTimeKey, false);

        // 🔧 تنظيف صيغة الوقت من DB (إزالة T و Z إن وجدوا)
        // DB format: 'YYYY-MM-DD HH:MM:SS' (local time)
        dbClosingTime = dbClosingTime.replace('T', ' ').replace('Z', '').slice(0, 19);

        // مقارنة التواريخ - نحول لـ timestamp للمقارنة الدقيقة
        const parseDateTime = (str) => {
          if (!str) return 0;
          // تحويل 'YYYY-MM-DD HH:MM:SS' لـ Date object
          const normalized = str.replace(' ', 'T');
          return new Date(normalized).getTime() || 0;
        };

        // تحديث localStorage إذا كان التقفيل في DB أحدث
        if (!localClosingTime || parseDateTime(dbClosingTime) > parseDateTime(localClosingTime)) {
          localStorage.setItem(closingTimeKey, dbClosingTime);
          Logger.log('[SYNC] ✅ Updated last closing time from DB:', dbClosingTime, userId ? `(user: ${userId})` : '');
        } else {
          Logger.log('[SYNC] localStorage is up-to-date:', localClosingTime);
        }
      } else {
        Logger.log('[SYNC] No closing records found in DB', userId ? `for user ${userId}` : '');
      }
    }
  } catch (e) {
    Logger.error('[SYNC] Failed to sync last closing time:', e);
  }
}

/**
 * التحقق من تاريخ آخر تقفيل ومسح الحركات القديمة
 * إذا كان آخر تقفيل من يوم سابق، يتم مسح الحركات المؤقتة لتجنب الحساب المزدوج
 */
function checkAndCleanOldShiftTransactions() {
  try {
    const closingTimeKey = getLastClosingTimeKey();
    const lastClosingTime = SessionCache.get(closingTimeKey, false);

    // تاريخ اليوم
    const today = new Date();
    const todayDateOnly = new Date(today.getFullYear(), today.getMonth(), today.getDate());

    if (!lastClosingTime) {
      // ✅ FIX: حتى لو مفيش تقفيل سابق، لازم نحذر المستخدم
      return {
        shouldWarn: true,
        isUrgent: true,
        message: `⚠️ لم يتم تقفيل اليومية من قبل! يرجى تقفيل اليومية من درج الكاش.`
      };
    }

    // تحويل آخر تقفيل لـ Date object
    let closingDateStr = lastClosingTime;
    if (closingDateStr && !closingDateStr.includes('T') && !closingDateStr.includes('Z')) {
      closingDateStr = closingDateStr.replace(' ', 'T');
    }
    const closingDate = new Date(closingDateStr);

    // مقارنة التواريخ (بدون الوقت)
    const closingDateOnly = new Date(closingDate.getFullYear(), closingDate.getMonth(), closingDate.getDate());

    // إذا كان آخر تقفيل من يوم سابق
    if (closingDateOnly < todayDateOnly) {
      const oldTransactions = getShiftTransactions();
      const daysDiff = Math.floor((todayDateOnly - closingDateOnly) / (1000 * 60 * 60 * 24));
      let dateText = 'أمس';
      if (daysDiff > 1) {
        dateText = `منذ ${daysDiff} أيام`;
      }

      // ✅ FIX: لا نمسح الحركات المؤقتة! نسيبها لحد ما المستخدم يقفل
      // الحركات دي (إيداعات/سحوبات) لازم تتسجل في التقفيل
      if (oldTransactions.length > 0) {
        Logger.log('[SHIFT-CLEAN] ⚠️ Found old shift transactions from previous day:', oldTransactions.length, '- NOT clearing them');

        return {
          shouldWarn: true,
          isUrgent: true,
          message: `⚠️ تنبيه: آخر تقفيل كان ${dateText}. يوجد ${oldTransactions.length} حركة (إيداعات/سحوبات) لم تُقفَل بعد. يرجى تقفيل اليومية حالاً من درج الكاش.`
        };
      } else {
        return {
          shouldWarn: true,
          isUrgent: true,
          message: `⚠️ تنبيه: آخر تقفيل كان ${dateText}. يرجى تقفيل اليومية من درج الكاش.`
        };
      }
    }

    return { shouldWarn: false, isUrgent: false, message: null };
  } catch (e) {
    Logger.error('[SHIFT-CLEAN] Error checking old transactions:', e);
    return { shouldWarn: false, isUrgent: false, message: null };
  }
}

// ✅ بانر تحذير عدم تقفيل اليومية
function showShiftWarningBanner(message, isUrgent) {
  const banner = document.getElementById('shiftWarningBanner');
  const text = document.getElementById('shiftWarningText');
  if (!banner || !text) return;

  text.textContent = message;

  // لون مختلف حسب الأهمية
  const inner = banner.querySelector('div');
  if (inner && !isUrgent) {
    inner.style.background = 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)';
    inner.style.boxShadow = '0 4px 20px rgba(245,158,11,0.4)';
  }

  banner.style.display = 'block';
}

// ✅ FIX: Define attachVerificationButtonListener before it's used
function attachVerificationButtonListener() {
  const btn = document.getElementById('btnOpenVerification');
  if (btn) {
    // Check if listener already attached (avoid duplicates)
    if (btn.dataset.listenerAttached === 'true') {
      console.log('[VERIFICATION] Listener already attached, skipping');
      return;
    }
    
    // ✅ FIX: Simply add click listener without cloning
    // Remove inline onclick to prevent double execution
    btn.removeAttribute('onclick');
    
    // Attach listener directly
    btn.addEventListener('click', function(e) {
      console.log('[VERIFICATION] Button clicked via event listener');
      e.preventDefault();
      e.stopPropagation();
      openCashVerificationModal();
    });
    btn.dataset.listenerAttached = 'true';
    console.log('[VERIFICATION] ✅ Event listener attached successfully');
  } else {
    console.warn('[VERIFICATION] ⚠️ Button not found when attaching listener');
  }
}

// Open cash drawer modal
document.getElementById('btnOpenCashDrawer')?.addEventListener('click', openCashDrawerModal);

async function openCashDrawerModal() {
  console.log('[CASH-DRAWER] Opening cash drawer modal...');
  const modal = document.getElementById('cashDrawerModal');
  if (!modal) {
    console.error('[CASH-DRAWER] Modal not found');
    return;
  }

  // إغلاق أي مودالات مفتوحة أولاً
  ModalSystem.closeAll('cashDrawerModal');

  // ✅ v1.2.4: عرض اسم المستخدم الحالي في header الدرج
  const currentUser = window.currentUser || JSON.parse(localStorage.getItem('currentUser') || '{}');
  const drawerUserEl = document.getElementById('drawerCurrentUser');
  if (drawerUserEl && currentUser?.username) {
    drawerUserEl.textContent = `(${currentUser.username})`;
    console.log('[CASH-DRAWER] 👤 Displaying user:', currentUser.username);
  }

  // ✅ v1.2.7: تعيين المحفظة الافتراضية دائماً على "كاش سائل" عند فتح الدرج
  currentWalletTxWallet = 'cash';

  modal.style.display = 'flex';
  await loadCashDrawerData();
  console.log('[CASH-DRAWER] Data loaded, currentCashData exists:', !!currentCashData);

  // استعادة حالة طي قسم الحركات
  restoreTransactionsCollapseState();
}

// إعادة تعيين حالة المطابقة
function resetVerificationState() {
  cashVerificationData = {
    verified: false,
    actualCash: 0,
    difference: 0
  };

  // Reset UI
  const statusEl = document.getElementById('verificationStatus');
  if (statusEl) {
    statusEl.innerHTML = '<span class="status-pending">⏳ في الانتظار</span>';
  }

  const verifyBtn = document.getElementById('btnOpenVerification');
  if (verifyBtn) {
    verifyBtn.innerHTML = '<span>🔍</span> مطابقة الدرج';
    verifyBtn.classList.remove('completed');
  }

  const finalDesc = document.getElementById('closingFinalDesc');
  if (finalDesc) {
    finalDesc.textContent = 'اطبع تقرير الشفت الحالي على الطابعة الحرارية';
  }

  const notesInput = document.getElementById('closeCashNotes');
  if (notesInput) {
    notesInput.value = '';
  }
}

// Load cash drawer data
async function loadCashDrawerData() {
  PerfMonitor.start('loadCashDrawerData');
  try {
    // ✅ v1.2.3: الحصول على معلومات المستخدم الحالي للفلترة
    const currentUser = window.currentUser || JSON.parse(localStorage.getItem('currentUser') || '{}');
    const userId = currentUser?.id;

    // 🔄 مزامنة وقت آخر تقفيل من DB أولاً (للتأكد من التحديث)
    await syncLastClosingTime();

    // ✅ التحقق من تاريخ آخر تقفيل وتحذير المستخدم
    const checkResult = checkAndCleanOldShiftTransactions();
    if (checkResult.shouldWarn && checkResult.message) {
      Logger.warn('[SHIFT-CLEAN]', checkResult.message);
      // ✅ FIX: عرض بانر تحذيري ثابت (بدل toast صغير بيختفي)
      setTimeout(() => {
        showShiftWarningBanner(checkResult.message, checkResult.isUrgent);
      }, 500);
    }

    // 🔧 استخدام التاريخ المحلي بدل UTC
    const now = new Date();
    const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;

    // ✅ v1.2.4: Get last closing time FIRST to determine date range
    // 🔧 FIX: نجيب المبيعات من آخر تقفيل مش من بداية اليوم
    const closingTimeKey = getLastClosingTimeKey();
    const lastClosingTime = SessionCache.get(closingTimeKey, false) || null;

    // تحديد تاريخ البداية للجلب
    let fromDate = today;
    if (lastClosingTime) {
      // استخراج التاريخ من وقت آخر تقفيل
      let closingDateStr = lastClosingTime;
      if (closingDateStr.includes('T')) {
        fromDate = closingDateStr.split('T')[0];
      } else if (closingDateStr.includes(' ')) {
        fromDate = closingDateStr.split(' ')[0];
      } else {
        fromDate = closingDateStr.substring(0, 10);
      }
      Logger.log('[CASH-DRAWER] Fetching from last closing date:', fromDate);
    } else {
      // لو مفيش تقفيل سابق، نجيب من 30 يوم للخلف (أو من أول السنة)
      const thirtyDaysAgo = new Date(now);
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
      fromDate = `${thirtyDaysAgo.getFullYear()}-${String(thirtyDaysAgo.getMonth() + 1).padStart(2, '0')}-${String(thirtyDaysAgo.getDate()).padStart(2, '0')}`;
      Logger.log('[CASH-DRAWER] No previous closing, fetching from:', fromDate);
    }

    // ✅ PATCH 2: Batch fetches with Promise.all + per-shift cache
    // ✅ v1.2.4: Cache key يعتمد على user_id و lastClosingTime
    const cacheKey = userId
      ? `cash_drawer_${lastClosingTime || 'no_closing'}_user_${userId}`
      : `cash_drawer_${lastClosingTime || 'no_closing'}`;
    const cached = SmartCache.get(cacheKey);
    if (cached) {
      Logger.log('[CASH-DRAWER] Using cached data for shift starting:', lastClosingTime || 'no previous closing', 'user:', userId);
      // Use cached data but still update UI
      Object.assign(currentCashData || {}, cached);
      renderCashSalesList(cached.sales || []);
      PerfMonitor.end('loadCashDrawerData');
      return cached;
    }

    // ✅ v1.2.3: إضافة user_id للفلترة - كل مستخدم يرى مبيعاته فقط
    const userFilter = userId ? `&user_id=${userId}` : '';

    // ✅ v1.2.4: Batch both fetches - من تاريخ آخر تقفيل لليوم
    // ✅ FIX: include_returned=true لأن المرتجعات بتتحسب في cashTotal ثم بتتخصم من الـ API balance
    const [salesRes, accessoryRes] = await Promise.all([
      fetch(`elos-db://sales?from=${fromDate}&to=${today}${userFilter}&include_returned=true`),
      // ✅ FIX: include_returned=true عشان المرتجعات تتحسب في المبيعات ثم تتخصم من returnsTotalCash
      fetch(`elos-db://accessory-movements?type=sale&include_returned=true&from=${fromDate}&to=${today}${userFilter}`)
    ]);

    if (!salesRes.ok) throw new Error('فشل تحميل بيانات الأجهزة');
    const deviceSales = await salesRes.json();

    let accessorySales = [];
    if (accessoryRes.ok) {
      const accessoryData = await accessoryRes.json();
      accessorySales = Array.isArray(accessoryData) ? accessoryData : (accessoryData.movements || []);
      Logger.log('[CASH-DRAWER] Accessory sales loaded:', accessorySales.length);
    }

    // ✅ v1.2.4: lastClosingTime تم جلبه مسبقاً في بداية الدالة
    // Filter completed AND returned device sales after last closing
    // ✅ نحسب المرتجعة لأن المرتجعات تُخصم بشكل منفصل من المحفظة المختارة
    let completedDeviceSales = deviceSales.filter(s => s.status === 'completed' || s.status === 'returned');

    // Filter accessory sales after last closing
    let filteredAccessorySales = [...accessorySales];

    if (lastClosingTime) {
      // 🔧 Fix: معالجة صيغة التاريخ من DB (بدون T) لتكون local time
      let closingDateStr = lastClosingTime;
      if (closingDateStr && !closingDateStr.includes('T') && !closingDateStr.includes('Z')) {
        // الوقت من DB هو local time، نحوله لصيغة يفهمها JS كـ local
        closingDateStr = closingDateStr.replace(' ', 'T');
      }
      const closingTimestamp = new Date(closingDateStr).getTime();
      Logger.log('[SHIFT] Last closing time:', lastClosingTime, '| Parsed:', closingDateStr, '| Timestamp:', closingTimestamp);

      completedDeviceSales = completedDeviceSales.filter(s => {
        let saleDateTime = s.created_at;
        // 🔧 Fix: معالجة صيغة التاريخ - كلاهما local time
        if (saleDateTime && !saleDateTime.includes('T') && !saleDateTime.includes('Z')) {
          saleDateTime = saleDateTime.replace(' ', 'T');
        }
        const saleTimestamp = new Date(saleDateTime).getTime();
        return saleTimestamp > closingTimestamp;
      });

      filteredAccessorySales = filteredAccessorySales.filter(s => {
        let saleDateTime = s.created_at;
        // 🔧 Fix: معالجة صيغة التاريخ - كلاهما local time
        if (saleDateTime && !saleDateTime.includes('T') && !saleDateTime.includes('Z')) {
          saleDateTime = saleDateTime.replace(' ', 'T');
        }
        const saleTimestamp = new Date(saleDateTime).getTime();
        return saleTimestamp > closingTimestamp;
      });

      Logger.log('[SHIFT] Filtered device sales:', completedDeviceSales.length);
      Logger.log('[SHIFT] Filtered accessory sales:', filteredAccessorySales.length);
    }

    // Calculate totals - use paid_now instead of sell_price
    // ✅ دعم الدفع المقسم (payment_methods)
    let cashTotal = 0;
    let cardTotal = 0;
    let transferTotal = 0;

    // دالة مساعدة لتوزيع المبلغ حسب طرق الدفع
    // ✅ CRITICAL FIX: نستخدم totalPaid (المبلغ الفعلي للعنصر) ونوزعه بنسب payment_methods
    // لأن payment_methods فيها المبلغ الكلي للفاتورة مش نصيب العنصر
    const distributePayment = (paymentMethodsJson, fallbackMethod, totalPaid) => {
      // إذا كان هناك payment_methods (دفع مقسم)
      if (paymentMethodsJson) {
        try {
          const methods = JSON.parse(paymentMethodsJson);
          if (Array.isArray(methods) && methods.length > 0) {
            // ✅ FIX: حساب المجموع الكلي لـ payment_methods
            const pmTotal = methods.reduce((sum, pm) => sum + Number(pm.amount || 0), 0);

            if (pmTotal > 0) {
              let distributedSoFar = 0;
              methods.forEach((pm, index) => {
                const pmOriginal = Number(pm.amount || 0);
                if (pmOriginal <= 0) return;

                // ✅ حساب نصيب هذه المحفظة من totalPaid (مبلغ العنصر الواحد)
                let amount;
                if (index === methods.length - 1) {
                  amount = Math.round((totalPaid - distributedSoFar) * 100) / 100;
                } else {
                  const ratio = pmOriginal / pmTotal;
                  amount = Math.round(totalPaid * ratio * 100) / 100;
                }
                distributedSoFar += amount;

                const method = pm.method || 'cash';
                switch (method) {
                  case 'cash':
                    cashTotal += amount;
                    break;
                  case 'mobile_wallet':
                  case 'card':
                    cardTotal += amount;
                    break;
                  case 'bank':
                  case 'transfer':
                    transferTotal += amount;
                    break;
                  default:
                    cashTotal += amount;
                }
              });
              return; // تم التوزيع من payment_methods
            }
          }
        } catch (e) {
          Logger.warn('Failed to parse payment_methods:', e);
        }
      }

      // Fallback: استخدام payment_method الأساسي
      const method = fallbackMethod || 'cash';
      switch (method) {
        case 'cash':
          cashTotal += totalPaid;
          break;
        case 'mobile_wallet':
        case 'card':
          cardTotal += totalPaid;
          break;
        case 'bank':
        case 'transfer':
          transferTotal += totalPaid;
          break;
        default:
          cashTotal += totalPaid;
      }
    };

    // حساب مبيعات الأجهزة
    // ⚠️ استبعاد البيع الآجل - لا يدخل فلوس فعلية للدرج
    completedDeviceSales.forEach(sale => {
      const pm = (sale.payment_method || 'cash').toLowerCase();
      if (pm === 'deferred' || pm === 'credit') return;
      // ✅ استخدام paid_now مع فحص null/undefined (لا نعتمد على || لأن 0 قيمة صالحة)
      const paidAmount = Number(sale.paid_now != null ? sale.paid_now : sale.sell_price || 0);
      distributePayment(sale.payment_methods, sale.payment_method, paidAmount);
    });

    // حساب مبيعات الإكسسوارات
    // ⚠️ استبعاد البيع الآجل
    filteredAccessorySales.forEach(sale => {
      const pm = (sale.payment_method || 'cash').toLowerCase();
      if (pm === 'deferred' || pm === 'credit') return;
      const paidAmount = Number(sale.paid_amount != null ? sale.paid_amount : sale.total_price || 0);
      distributePayment(sale.payment_methods, sale.payment_method, paidAmount);
    });

    const total = cashTotal + cardTotal + transferTotal;

    // تحويل مبيعات الإكسسوارات لنفس شكل مبيعات الأجهزة للعرض
    const accessorySalesForDisplay = filteredAccessorySales.map(s => ({
      id: s.id,
      type: '🎧',
      model: s.accessory_name || 'إكسسوار',
      customer_name: s.client_name || '',
      created_at: s.created_at,
      sell_price: Math.abs(s.total_price || 0),
      // ✅ FIX: استخدام != null بدل || عشان 0 قيمة صالحة (آجل كامل)
      paid_now: Math.abs(s.paid_amount != null ? s.paid_amount : (s.total_price || 0)),
      payment_method: s.payment_method || 'cash',
      isAccessory: true
    }));

    // دمج المبيعات للعرض
    const allSales = [...completedDeviceSales, ...accessorySalesForDisplay];
    // ترتيب حسب الوقت
    allSales.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));

    // ✅ FIX: عدم حساب المرتجعات في عدد المبيعات
    const totalSalesCount = completedDeviceSales.filter(s => s.status !== 'returned').length + filteredAccessorySales.filter(s => s.status !== 'returned').length;

    // 🆕 حساب الإيداعات والسحوبات لكل محفظة
    const shiftTx = getShiftTransactions();

    // إيداعات وسحوبات لكل محفظة
    const walletDeposits = { cash: 0, mobile_wallet: 0, bank: 0 };
    const walletWithdraws = { cash: 0, mobile_wallet: 0, bank: 0 };

    // للإحصائيات: إيداعات وسحوبات حقيقية (بدون التحويلات)
    let realDepositsTotal = 0;
    let realWithdrawsTotal = 0;

    shiftTx.forEach(tx => {
      const wallet = tx.wallet || 'cash'; // default to cash for backward compatibility
      const isTransfer = tx.category === 'تحويل' || tx.transfer_id;

      if (tx.type === 'wallet_transfer') {
        // 🔧 تحويل بين محافظ الدرج - نقل داخلي
        const amount = Number(tx.amount || 0);
        walletWithdraws[tx.fromWallet] = (walletWithdraws[tx.fromWallet] || 0) + amount;
        walletDeposits[tx.toWallet] = (walletDeposits[tx.toWallet] || 0) + amount;
        // التحويلات لا تؤثر على الإجمالي الكلي
      } else if (tx.type === 'client_payment') {
        // ✅ FIX: تحصيلات العملاء - لا تضاف لـ walletDeposits (عشان الـ API بيحسبها)
        // بس نضيفها للـ fallback في حالة فشل الـ API
        if (!isTransfer) {
          realDepositsTotal += Number(tx.amount || 0);
        }
      } else if (tx.type === 'deposit') {
        // ⚠️ نتجاهل الحركات المحفوظة في DB عشان منحسبهاش مرتين
        if (!tx.savedToDb) {
          walletDeposits[wallet] = (walletDeposits[wallet] || 0) + Number(tx.amount || 0);
        }
        // التحويلات مش بتتحسب في الإحصائيات لأنها مش بتزود الرصيد الكلي
        if (!isTransfer) {
          realDepositsTotal += Number(tx.amount || 0);
        }
      } else if (tx.type === 'withdraw') {
        // ⚠️ نتجاهل الحركات المحفوظة في DB عشان منحسبهاش مرتين
        if (!tx.savedToDb) {
          walletWithdraws[wallet] = (walletWithdraws[wallet] || 0) + Number(tx.amount || 0);
        }
        // التحويلات مش بتتحسب في الإحصائيات لأنها مش بتنقص الرصيد الكلي
        if (!isTransfer) {
          realWithdrawsTotal += Number(tx.amount || 0);
        }
      }
    });

    // ✅ v1.2.9-hotfix3: جلب الأرصدة الفعلية من drawer-wallets-balance API
    // هذا الـ API يحسب الأرصدة بشكل صحيح من cash_ledger بما فيها المرتجعات
    let netCash = cashTotal + walletDeposits.cash - walletWithdraws.cash;
    let netMobile = cardTotal + walletDeposits.mobile_wallet - walletWithdraws.mobile_wallet;
    let netBank = transferTotal + walletDeposits.bank - walletWithdraws.bank;
    let grandTotal = netCash + netMobile + netBank;

    try {
      let walletUrl = 'elos-db://drawer-wallets-balance';
      const walletParams = [];
      if (lastClosingTime) {
        walletParams.push(`after=${encodeURIComponent(lastClosingTime)}`);
      }
      if (userId) {
        walletParams.push(`user_id=${userId}`);
      }
      if (walletParams.length > 0) {
        walletUrl += '?' + walletParams.join('&');
      }

      const walletRes = await fetch(walletUrl);
      if (walletRes.ok) {
        const walletData = await walletRes.json();
        if (walletData.wallets && Array.isArray(walletData.wallets)) {
          // استخدام الأرصدة الفعلية من الـ API
          netCash = walletData.cash || 0;
          netMobile = walletData.mobile_wallet || 0;
          netBank = walletData.bank || 0;
          grandTotal = netCash + netMobile + netBank;
          Logger.log('[CASH-DRAWER] ✅ Using actual wallet balances from API:', { netCash, netMobile, netBank, grandTotal });
        }
      }
    } catch (walletErr) {
      Logger.warn('[CASH-DRAWER] Failed to fetch wallet balances, using calculated values:', walletErr);
    }

    // Store current data (without profit)
    currentCashData = {
      sales: allSales,
      deviceSales: completedDeviceSales,
      accessorySales: filteredAccessorySales,
      cashTotal: netCash,
      mobileTotal: netMobile,
      bankTotal: netBank,
      expectedCash: netCash, // ✅ للتوافق مع مطابقة الدرج
      // Original sales totals (before deposits/withdraws)
      salesCashTotal: cashTotal,
      salesMobileTotal: cardTotal,
      salesBankTotal: transferTotal,
      // Deposits & Withdraws per wallet
      walletDeposits,
      walletWithdraws,
      total: grandTotal
    };

    // Update summary cards - new wallet design (with null checks)
    const salesCountEl = document.getElementById('drawerSalesCount');
    if (salesCountEl) salesCountEl.textContent = totalSalesCount;

    // Update wallet cards (with null checks)
    const cashTotalEl = document.getElementById('drawerCashTotal');
    const mobileTotalEl = document.getElementById('drawerMobileTotal');
    const bankTotalEl = document.getElementById('drawerBankTotal');
    const grandTotalEl = document.getElementById('drawerGrandTotal');

    if (cashTotalEl) cashTotalEl.textContent = fmt(netCash);
    if (mobileTotalEl) mobileTotalEl.textContent = fmt(netMobile);
    if (bankTotalEl) bankTotalEl.textContent = fmt(netBank);
    if (grandTotalEl) grandTotalEl.textContent = fmt(grandTotal);

    // Update in/out stats for each wallet
    const cashInEl = document.getElementById('drawerCashIn');
    const cashOutEl = document.getElementById('drawerCashOut');
    const mobileInEl = document.getElementById('drawerMobileIn');
    const mobileOutEl = document.getElementById('drawerMobileOut');
    const bankInEl = document.getElementById('drawerBankIn');
    const bankOutEl = document.getElementById('drawerBankOut');

    if (cashInEl) cashInEl.textContent = fmt(cashTotal + walletDeposits.cash);
    if (cashOutEl) cashOutEl.textContent = fmt(walletWithdraws.cash);
    if (mobileInEl) mobileInEl.textContent = fmt(cardTotal + walletDeposits.mobile_wallet);
    if (mobileOutEl) mobileOutEl.textContent = fmt(walletWithdraws.mobile_wallet);
    if (bankInEl) bankInEl.textContent = fmt(transferTotal + walletDeposits.bank);
    if (bankOutEl) bankOutEl.textContent = fmt(walletWithdraws.bank);

    // Update stats cards - نستخدم الإيداعات والسحوبات الحقيقية (بدون التحويلات)
    const depositsEl = document.getElementById('drawerDepositsTotal');
    const withdrawsEl = document.getElementById('drawerWithdrawsTotal');
    if (depositsEl) depositsEl.textContent = fmt(realDepositsTotal);
    if (withdrawsEl) withdrawsEl.textContent = fmt(realWithdrawsTotal);

    // Hide profit display
    const profitElement = document.getElementById('drawerProfit');
    if (profitElement) {
      profitElement.parentElement.style.display = 'none';
    }

    // Update preview in button - يعرض رصيد الكاش السائل فقط
    document.getElementById('todaySalesCount').textContent = totalSalesCount;
    document.getElementById('todayTotalPreview').textContent = fmt(netCash);

    // Render sales list
    renderCashSalesList(allSales);

    // ✅ PATCH 2: Cache result for today
    SmartCache.set(cacheKey, currentCashData, CACHE_DURATION);

    PerfMonitor.end('loadCashDrawerData');
    return currentCashData;

  } catch (error) {
    Logger.error('Error loading cash data:', error);
    showToast('خطأ في تحميل بيانات الكاش', 'error');
    PerfMonitor.end('loadCashDrawerData');
    return null;
  }
}

// Render sales list
function renderCashSalesList(sales) {
  PerfMonitor.start('renderCashSalesList');
  const salesList = document.getElementById('drawerSalesList');
  if (!salesList) {
    PerfMonitor.end('renderCashSalesList');
    return;
  }
  
  if (sales.length === 0) {
    salesList.innerHTML = '<div style="text-align: center; padding: 40px; color: var(--muted);">لا توجد مبيعات اليوم بعد</div>';
    PerfMonitor.end('renderCashSalesList');
    return;
  }
  
  // ✅ PATCH 1: Use DocumentFragment + virtualization for long lists
  const fragment = document.createDocumentFragment();
  const shouldVirtualize = sales.length > VIRTUAL_LIST_THRESHOLD;
  const itemsToRender = shouldVirtualize ? sales.slice(0, VIRTUAL_LIST_WINDOW) : sales;
  
  // Pre-parse dates to avoid repeated parsing in loop
  const salesWithParsedDates = itemsToRender.map(sale => ({
    ...sale,
    parsedTime: sale.created_at ? new Date(sale.created_at).toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' }) : ''
  }));
  
  salesWithParsedDates.forEach(sale => {
    const methodIcons = {
      cash: '💵',
      card: '💳',
      transfer: '🏦',
      deferred: '⏳', DEFERRED: '⏳', credit: '⏳'
    };
    const methodNames = {
      cash: 'نقدي',
      card: 'بطاقة',
      transfer: 'تحويل',
      deferred: 'آجل', DEFERRED: 'آجل', credit: 'آجل'
    };
    const method = sale.payment_method || 'cash';
    const time = sale.parsedTime;
    
    const div = document.createElement('div');
    div.className = 'cash-sale-item';
    div.innerHTML = `
      <div class="cash-sale-info">
        <div class="cash-sale-model">${escapeHtml(sale.type || '')} ${escapeHtml(sale.model || 'جهاز')}</div>
        <div class="cash-sale-details">
          ${escapeHtml(sale.customer_name || sale.client_name || 'عميل')} • ${time}
          ${sale.storage ? ` • ${escapeHtml(sale.storage)}` : ''}
        </div>
      </div>
      <div class="cash-sale-amount">
        <div class="cash-sale-price">${fmt(sale.sell_price || sale.price || 0)}</div>
        <div class="cash-sale-method">${methodIcons[method] || '💵'} ${methodNames[method] || 'نقدي'}</div>
      </div>
    `;
    fragment.appendChild(div);
  });
  
  // Clear and append in one operation
  salesList.innerHTML = '';
  salesList.appendChild(fragment);
  
  // Show "load more" indicator if virtualized
  if (shouldVirtualize && sales.length > VIRTUAL_LIST_WINDOW) {
    const loadMoreDiv = document.createElement('div');
    loadMoreDiv.style.cssText = 'text-align: center; padding: 12px; color: var(--muted); font-size: 12px;';
    loadMoreDiv.textContent = `عرض ${VIRTUAL_LIST_WINDOW} من ${sales.length} عملية`;
    salesList.appendChild(loadMoreDiv);
  }
  
  PerfMonitor.end('renderCashSalesList');
}

// Close cash drawer modal
document.getElementById('closeCashDrawerModal')?.addEventListener('click', closeCashDrawerModal);
document.getElementById('closeCashDrawerBtn')?.addEventListener('click', closeCashDrawerModal);

function closeCashDrawerModal() {
  const modal = document.getElementById('cashDrawerModal');
  if (modal) modal.style.display = 'none';
}

// Update cash difference
document.getElementById('actualCashAmount')?.addEventListener('input', updateCashDifference);

function updateCashDifference() {
  if (!currentCashData) return;

  // استخدم expectedCash (الرصيد المتوقع الصحيح)
  const expectedCash = currentCashData.expectedCash || currentCashData.cashTotal || 0;
  const actualCash = Number(document.getElementById('actualCashAmount')?.value || 0);
  const difference = actualCash - expectedCash;
  
  const diffElement = document.getElementById('cashDifference');
  if (diffElement) {
    if (!document.getElementById('actualCashAmount')?.value) {
      diffElement.className = 'cash-difference';
      diffElement.innerHTML = `<span>أدخل المبلغ الفعلي</span>`;
    } else if (difference > 0) {
      diffElement.className = 'cash-difference positive';
      diffElement.innerHTML = `<span>+ ${fmt(difference)} زيادة</span>`;
    } else if (difference < 0) {
      diffElement.className = 'cash-difference negative';
      diffElement.innerHTML = `<span>- ${fmt(Math.abs(difference))} نقص</span>`;
    } else {
      diffElement.className = 'cash-difference zero';
      diffElement.innerHTML = `<span>✅ مطابق</span>`;
    }
  }
}

// Print cash report (الزر الداخلي في خطوة التأكيد)
document.getElementById('btnPrintCashReport')?.addEventListener('click', printCashReport);

// Shift close button (الزر السفلي في footer الدرج)
document.getElementById('btnFinalClose')?.addEventListener('click', executeShiftClose);

/**
 * طباعة تقرير الكاش الحالي (بدون تقفيل)
 * متوافق مع الطابعة الحرارية
 */
function printCashReport() {
  if (!currentCashData) {
    showToast('لا توجد بيانات للطباعة', 'warning');
    return;
  }

  // استخدام نفس دالة طباعة تقرير الشفت (بدون بيانات المطابقة)
  printShiftReport(null, currentCashData);
}

// Confirm close cash and start new day
// Old close cash handler removed - new handler is in the cash drawer system section below

// Load today's cash data on startup
async function loadTodayCashPreview() {
  try {
    // 🔄 مزامنة وقت آخر تقفيل من DB أولاً
    await syncLastClosingTime();

    // 🔧 استخدام التاريخ المحلي بدل UTC
    const now = new Date();
    const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
    // 🔧 Fix: إضافة timestamp لمنع الـ caching وضمان تحديث البيانات فورياً
    const timestamp = Date.now();

    // ✅ v1.2.4: Get current user for per-user filtering
    const currentUser = window.currentUser || JSON.parse(localStorage.getItem('currentUser') || '{}');
    const userId = currentUser?.id;
    const userFilter = userId ? `&user_id=${userId}` : '';
    // 🔍 DEBUG: Log user info
    console.log('[CASH-PREVIEW] 🔐 User:', userId, currentUser?.username, 'Filter:', userFilter);

    // ✅ v1.2.4: Get last closing time FIRST to determine date range
    const closingTimeKey = getLastClosingTimeKey();
    const lastClosingTime = SessionCache.get(closingTimeKey, false) || null;

    // تحديد تاريخ البداية للجلب
    let fromDate = today;
    if (lastClosingTime) {
      // استخراج التاريخ من وقت آخر تقفيل
      let closingDateStr = lastClosingTime;
      if (closingDateStr.includes('T')) {
        fromDate = closingDateStr.split('T')[0];
      } else if (closingDateStr.includes(' ')) {
        fromDate = closingDateStr.split(' ')[0];
      } else {
        fromDate = closingDateStr.substring(0, 10);
      }
    } else {
      // لو مفيش تقفيل سابق، نجيب من 30 يوم للخلف
      const thirtyDaysAgo = new Date(now);
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
      fromDate = `${thirtyDaysAgo.getFullYear()}-${String(thirtyDaysAgo.getMonth() + 1).padStart(2, '0')}-${String(thirtyDaysAgo.getDate()).padStart(2, '0')}`;
    }

    // ✅ v1.2.4: جلب مبيعات الأجهزة من آخر تقفيل لليوم (مع فلتر المستخدم)
    const salesRes = await fetch(`elos-db://sales?from=${fromDate}&to=${today}${userFilter}&_t=${timestamp}`, {
      cache: 'no-store'
    });

    // ✅ v1.2.4: جلب مبيعات الإكسسوارات من آخر تقفيل لليوم (مع فلتر المستخدم)
    const accRes = await fetch(`elos-db://accessory-movements?type=sale&from=${fromDate}&to=${today}${userFilter}&_t=${timestamp}`, {
      cache: 'no-store'
    });

    // ✅ FIX: جلب مبيعات قطع الغيار
    const rpRes = await fetch(`elos-db://repair-parts-pos-sales?from=${fromDate}&to=${today}&_t=${timestamp}`, {
      cache: 'no-store'
    });

    let deviceSales = [];
    let accessorySales = [];
    let repairPartsSales = [];

    if (salesRes.ok) {
      deviceSales = await salesRes.json();
    }

    if (accRes.ok) {
      const accData = await accRes.json();
      accessorySales = Array.isArray(accData) ? accData : (accData.movements || []);
    }

    if (rpRes.ok) {
      const rpData = await rpRes.json();
      repairPartsSales = Array.isArray(rpData) ? rpData : (rpData.sales || []);
    }

    // Filter completed AND returned device sales
    // ✅ نحسب المرتجعة لأن المرتجعات تُخصم بشكل منفصل
    let completedDeviceSales = deviceSales.filter(s => s.status === 'completed' || s.status === 'returned');
    let filteredAccessorySales = [...accessorySales];

    if (lastClosingTime) {
      // 🔧 Fix: معالجة صيغة التاريخ من DB (بدون T) لتكون local time
      let closingDateStr = lastClosingTime;
      if (closingDateStr && !closingDateStr.includes('T') && !closingDateStr.includes('Z')) {
        closingDateStr = closingDateStr.replace(' ', 'T');
      }
      const closingTimestamp = new Date(closingDateStr).getTime();

      completedDeviceSales = completedDeviceSales.filter(s => {
        let saleDateTime = s.created_at;
        // 🔧 Fix: معالجة صيغة التاريخ - كلاهما local time
        if (saleDateTime && !saleDateTime.includes('T') && !saleDateTime.includes('Z')) {
          saleDateTime = saleDateTime.replace(' ', 'T');
        }
        const saleTimestamp = new Date(saleDateTime).getTime();
        return saleTimestamp > closingTimestamp;
      });

      filteredAccessorySales = filteredAccessorySales.filter(s => {
        let saleDateTime = s.created_at;
        // 🔧 Fix: معالجة صيغة التاريخ - كلاهما local time
        if (saleDateTime && !saleDateTime.includes('T') && !saleDateTime.includes('Z')) {
          saleDateTime = saleDateTime.replace(' ', 'T');
        }
        const saleTimestamp = new Date(saleDateTime).getTime();
        return saleTimestamp > closingTimestamp;
      });

      // ✅ FIX: فلترة مبيعات قطع الغيار بعد آخر تقفيل
      repairPartsSales = repairPartsSales.filter(s => {
        let saleDateTime = s.created_at;
        if (saleDateTime && !saleDateTime.includes('T') && !saleDateTime.includes('Z')) {
          saleDateTime = saleDateTime.replace(' ', 'T');
        }
        return new Date(saleDateTime).getTime() > closingTimestamp;
      });
    }

    // حساب الإجمالي (أجهزة + إكسسوارات + قطع غيار)
    let total = 0;

    completedDeviceSales.forEach(sale => {
      total += Number(sale.paid_now || sale.sell_price || 0);
    });

    filteredAccessorySales.forEach(sale => {
      total += Math.abs(Number(sale.paid_amount || sale.total_price || 0));
    });

    // ✅ FIX: إضافة مبيعات قطع الغيار للإجمالي
    repairPartsSales.forEach(sale => {
      total += Number(sale.paid_amount || sale.total_price || 0);
    });

    // 🆕 إضافة الإيداعات وخصم السحوبات من localStorage
    const shiftTx = getShiftTransactions();
    let depositsTotal = 0;
    let withdrawsTotal = 0;

    if (lastClosingTime) {
      // 🔧 Fix: معالجة صيغة التاريخ
      let closingDateStr = lastClosingTime;
      if (closingDateStr && !closingDateStr.includes('T') && !closingDateStr.includes('Z')) {
        closingDateStr = closingDateStr.replace(' ', 'T');
      }
      const closingTimestamp = new Date(closingDateStr).getTime();
      shiftTx.forEach(tx => {
        let txDateTime = tx.created_at;
        if (txDateTime && !txDateTime.includes('T') && !txDateTime.includes('Z')) {
          txDateTime = txDateTime.replace(' ', 'T');
        }
        const txTime = new Date(txDateTime).getTime();
        if (txTime <= closingTimestamp) return;

        // لا نحسب التحويلات (لأنها نقل بين المحافظ - مجموعها صفر)
        if (tx.category === 'تحويل' || tx.transfer_id) return;

        if (tx.type === 'deposit' || tx.type === 'client_payment') {
          depositsTotal += Number(tx.amount || 0);
        } else if (tx.type === 'withdraw' || tx.type === 'supplier_payment') {
          withdrawsTotal += Number(tx.amount || 0);
        }
      });
    } else {
      shiftTx.forEach(tx => {
        if (tx.category === 'تحويل' || tx.transfer_id) return;

        if (tx.type === 'deposit' || tx.type === 'client_payment') {
          depositsTotal += Number(tx.amount || 0);
        } else if (tx.type === 'withdraw' || tx.type === 'supplier_payment') {
          withdrawsTotal += Number(tx.amount || 0);
        }
      });
    }

    let totalCount = completedDeviceSales.length + filteredAccessorySales.length + repairPartsSales.length;

    // ✅ جلب أرصدة المحافظ الفعلية من الـ API (بدلاً من الحساب اليدوي)
    // ✅ v1.2.5: Per-User Filter
    let grandTotal = total + depositsTotal - withdrawsTotal; // fallback
    try {
      let walletUrl = 'elos-db://drawer-wallets-balance';
      const walletParams = [];
      if (lastClosingTime) {
        walletParams.push(`after=${encodeURIComponent(lastClosingTime)}`);
      }
      if (userId) {
        walletParams.push(`user_id=${userId}`);
      }
      if (walletParams.length > 0) {
        walletUrl += '?' + walletParams.join('&');
      }
      const walletRes = await fetch(walletUrl);
      if (walletRes.ok) {
        const walletData = await walletRes.json();
        if (walletData.wallets && Array.isArray(walletData.wallets)) {
          // عرض رصيد الكاش السائل فقط في زر الدرج
          const cashWallet = walletData.wallets.find(w => w.type === 'cash');
          grandTotal = cashWallet ? Number(cashWallet.balance || 0) : walletData.wallets.reduce((sum, w) => sum + Number(w.balance || 0), 0);
          Logger.log('[CASH-PREVIEW] Using cash wallet balance for preview:', grandTotal);
        }
        // ✅ استخدام عدد الحركات الفعلي من الـ API
        if (walletData.transactions_count !== undefined) {
          totalCount = walletData.transactions_count;
        }
      }
    } catch (e) {
      Logger.warn('[CASH-PREVIEW] Failed to fetch wallet balances, using calculated total:', e);
    }

    // تحديث العناصر في الـ DOM
    const countEl = document.getElementById('todaySalesCount');
    const totalEl = document.getElementById('todayTotalPreview');

    if (countEl) countEl.textContent = totalCount;
    if (totalEl) totalEl.textContent = fmt(grandTotal);

    Logger.log(`[CASH-PREVIEW] ✅ Updated: ${totalCount} transactions, ${fmt(grandTotal)} EGP`);

    // 🔧 دمج الأجهزة والإكسسوارات لعرضها في آخر المبيعات
    const accessorySalesForPreview = filteredAccessorySales.map(s => ({
      ...s,
      model: s.accessory_name || 'إكسسوار',
      type: '🎧',
      paid_now: s.paid_amount || s.total_price || 0
    }));
    const allSalesForPreview = [...completedDeviceSales, ...accessorySalesForPreview];
    // ترتيب حسب التاريخ
    allSalesForPreview.sort((a, b) => new Date(a.created_at) - new Date(b.created_at));

    // Update shift stats (recent sales preview removed)
    updateShiftStats(completedDeviceSales);
    updateSalesTarget(total);

  } catch (error) {
    Logger.error('Error loading cash preview:', error);
  }
}

// Update sales target progress
function updateSalesTarget(currentTotal) {
  // Get target from localStorage or use default
  const target = Number(localStorage.getItem('pos_sales_target') || 20000);
  
  const percentage = Math.min(100, (currentTotal / target) * 100);
  
  // Update display
  const currentSalesTotal = document.getElementById('currentSalesTotal');
  const salesTarget = document.getElementById('salesTarget');
  const targetProgressBar = document.getElementById('targetProgressBar');
  const targetPercentage = document.getElementById('targetPercentage');
  
  if (currentSalesTotal) currentSalesTotal.textContent = fmt(currentTotal);
  if (salesTarget) salesTarget.textContent = fmt(target);
  if (targetProgressBar) targetProgressBar.style.width = percentage + '%';
  if (targetPercentage) {
    targetPercentage.textContent = Math.round(percentage) + '%';
    
    // Change color based on progress
    if (percentage >= 100) {
      targetPercentage.style.color = 'var(--success)';
    } else if (percentage >= 70) {
      targetPercentage.style.color = 'var(--brand)';
    } else if (percentage >= 40) {
      targetPercentage.style.color = 'var(--warning)';
    } else {
      targetPercentage.style.color = 'var(--danger)';
    }
  }
}

// Update recent sales preview - REMOVED: replaced with button to open sales history modal

// ═══════════════════════════════════════════════════════════════
// 📋 SALES HISTORY MODAL - سجل الفواتير
// ═══════════════════════════════════════════════════════════════

let currentSaleDetails = null;
let salesHistoryData = [];

// ═══════════════════════════════════════════════════════════════
// 📋 SALES HISTORY MODAL - فواتير نقطة البيع (تصميم جديد)
// ═══════════════════════════════════════════════════════════════

// فتح modal سجل المبيعات
function openSalesHistoryModal() {
  console.log('[SALES-HISTORY] Attempting to open modal...');
  
  const modal = document.getElementById('salesHistoryModal');
  if (!modal) {
    console.error('[SALES-HISTORY] ❌ Modal element not found in DOM');
    showToast('خطأ: نافذة الفواتير غير متاحة', 'error');
    return;
  }

  console.log('[SALES-HISTORY] ✅ Modal found, opening...');

  // إغلاق أي مودالات مفتوحة أولاً
  try {
    ModalSystem.closeAll('salesHistoryModal');
  } catch (e) {
    console.warn('[SALES-HISTORY] ModalSystem.closeAll error:', e);
  }

  // تحديد تاريخ اليوم كافتراضي (✅ استخدام التوقيت المحلي بدلاً من UTC)
  const _now = new Date();
  const today = `${_now.getFullYear()}-${String(_now.getMonth() + 1).padStart(2, '0')}-${String(_now.getDate()).padStart(2, '0')}`;
  const dateInput = document.getElementById('salesHistoryDate');
  if (dateInput) {
    dateInput.value = today;
    console.log('[SALES-HISTORY] ✅ Date input set to:', today);
  } else {
    console.warn('[SALES-HISTORY] ⚠️ Date input not found');
  }

  // عرض المودال - نفس طريقة درج الكاش تماماً
  modal.classList.add('show');
  console.log('[SALES-HISTORY] ✅ Modal opened with show class');
  
  // تحميل البيانات
  setTimeout(() => {
    loadSalesHistory('today');
  }, 100);
}

// إغلاق modal سجل المبيعات
function closeSalesHistoryModal() {
  const modal = document.getElementById('salesHistoryModal');
  if (modal) {
    modal.classList.remove('show');
    console.log('[SALES-HISTORY] ✅ Modal closed');
  }
}

// تحميل سجل المبيعات - فواتير كاملة
async function loadSalesHistory(period = null) {
  const listContainer = document.getElementById('salesHistoryList');
  const countEl = document.getElementById('salesHistoryCount');
  const totalEl = document.getElementById('salesHistoryTotal');

  // تحديد التاريخ (✅ استخدام التوقيت المحلي بدلاً من UTC)
  let fromDate, toDate;
  const today = new Date();
  const _localDate = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

  if (period === 'today') {
    fromDate = toDate = _localDate(today);
    document.getElementById('salesHistoryDate').value = fromDate;
  } else if (period === 'yesterday') {
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    fromDate = toDate = _localDate(yesterday);
    document.getElementById('salesHistoryDate').value = fromDate;
  } else if (period === 'week') {
    const weekAgo = new Date(today);
    weekAgo.setDate(weekAgo.getDate() - 7);
    fromDate = _localDate(weekAgo);
    toDate = _localDate(today);
  } else {
    fromDate = toDate = document.getElementById('salesHistoryDate').value;
  }

  if (!fromDate) {
    showToast('اختر تاريخ أولاً', 'warning');
    return;
  }

  listContainer.innerHTML = '<div style="text-align:center;padding:40px;color:#94a3b8;"><span style="font-size:32px;">⏳</span><p>جاري التحميل...</p></div>';

  PerfMonitor.start('loadSalesHistory');
  try {
    // ✅ PATCH 2: Batch fetches with Promise.all (+ repair parts)
    const [salesRes, accRes, repairPartsRes] = await Promise.all([
      fetch(`elos-db://sales?from=${fromDate}&to=${toDate}&include_returned=true`),
      fetch(`elos-db://accessory-movements?type=sales_and_returns&from=${fromDate}&to=${toDate}`),
      fetch(`elos-db://repair-parts-pos-sales?from=${fromDate}&to=${toDate}`)
    ]);

    let deviceSales = [];
    if (salesRes.ok) {
      deviceSales = await salesRes.json();
      // ✅ إظهار المبيعات المكتملة والمرتجعة (استبعاد الملغية فقط)
      deviceSales = deviceSales.filter(s => s.status === 'completed' || s.status === 'returned');
    }

    let accessorySales = [];
    if (accRes.ok) {
      const accData = await accRes.json();
      accessorySales = Array.isArray(accData) ? accData : (accData.movements || []);
      // استبعاد أي مرتجعات أو عمليات غير بيع
      accessorySales = accessorySales.filter(s =>
        s.type === 'sale' &&
        !s.notes?.includes('مرتجع') &&
        !s.reference_type?.includes('return')
      );
    }

    // ✅ مبيعات قطع الغيار
    let repairPartsSales = [];
    if (repairPartsRes.ok) {
      const rpData = await repairPartsRes.json();
      repairPartsSales = Array.isArray(rpData) ? rpData : (rpData.sales || []);
    }

    // تجميع المبيعات حسب invoice_number أو إنشاء فاتورة لكل عملية
    const invoicesMap = new Map();

    // إضافة مبيعات الأجهزة
    deviceSales.forEach(sale => {
      const invNum = sale.invoice_number || `DEV-${sale.id}`;
      if (!invoicesMap.has(invNum)) {
        invoicesMap.set(invNum, {
          invoice_number: invNum,
          customer_name: sale.customer_name || sale.client_name || 'عميل نقدي',
          payment_method: sale.payment_method || 'cash',
          created_at: sale.created_at,
          items: [],
          total_amount: 0,
          total_paid: 0,
          total_discount: 0,
          status: sale.status || 'completed' // ✅ حالة الفاتورة
        });
      }
      const inv = invoicesMap.get(invNum);
      const saleDiscount = Number(sale.discount || 0);
      inv.items.push({
        item_type: 'device',
        type: sale.type,
        model: sale.model,
        storage: sale.storage,
        color: sale.color,
        imei1: sale.imei1,
        sell_price: sale.sell_price,
        discount: saleDiscount,
        quantity: 1,
        status: sale.status // ✅ حالة العنصر
      });
      inv.total_amount += Number(sale.sell_price || 0);
      inv.total_paid += Number(sale.paid_now || sale.sell_price || 0);
      inv.total_discount += saleDiscount;
      // ✅ تحديث حالة الفاتورة إذا أي عنصر مرتجع
      if (sale.status === 'returned') {
        inv.status = inv.items.every(i => i.status === 'returned') ? 'returned' : 'partially_returned';
      }
    });

    // إضافة مبيعات الإكسسوارات
    accessorySales.forEach(sale => {
      const invNum = sale.invoice_number || `ACC-${sale.id}`;
      if (!invoicesMap.has(invNum)) {
        invoicesMap.set(invNum, {
          invoice_number: invNum,
          customer_name: sale.client_name || 'عميل نقدي',
          payment_method: sale.payment_method || 'cash',
          created_at: sale.created_at,
          items: [],
          total_amount: 0,
          total_paid: 0,
          total_discount: 0
        });
      }
      const inv = invoicesMap.get(invNum);
      const saleDiscount = Number(sale.discount || 0);
      const accQty = Math.abs(sale.quantity || 1);
      // ✅ FIX: استخدام السعر الأصلي (unit_price * الكمية) بدلاً من total_price المخصوم
      const accOriginalTotal = Number(sale.unit_price || 0) * accQty;
      inv.items.push({
        item_type: 'accessory',
        name: sale.accessory_name || 'إكسسوار',
        sell_price: accOriginalTotal,
        unit_price: Number(sale.unit_price || 0),
        discount: saleDiscount,
        quantity: accQty
      });
      inv.total_amount += accOriginalTotal;
      inv.total_paid += Math.abs(Number(sale.paid_amount || sale.total_price || 0));
      inv.total_discount += saleDiscount;
    });

    // ✅ إضافة مبيعات قطع الغيار
    repairPartsSales.forEach(sale => {
      const invNum = sale.invoice_number || `RP-${sale.id}`;
      if (!invoicesMap.has(invNum)) {
        invoicesMap.set(invNum, {
          invoice_number: invNum,
          customer_name: sale.client_name || 'عميل نقدي',
          payment_method: sale.payment_method || 'cash',
          created_at: sale.created_at,
          items: [],
          total_amount: 0,
          total_paid: 0,
          total_discount: 0,
          status: sale.status || 'completed'
        });
      }
      const inv = invoicesMap.get(invNum);
      const saleDiscount = Number(sale.discount || 0);
      const rpQty = Math.abs(sale.quantity || 1);
      // ✅ FIX: استخدام السعر الأصلي (unit_price * الكمية) بدلاً من total_price المخصوم
      const rpOriginalTotal = Number(sale.unit_price || 0) * rpQty;
      inv.items.push({
        item_type: 'repair_part',
        name: sale.part_name || sale.name || 'قطعة غيار',
        category: sale.part_category || sale.category || '',
        sku: sale.part_sku || sale.sku || '',
        sell_price: rpOriginalTotal,
        unit_price: Number(sale.unit_price || 0),
        discount: saleDiscount,
        quantity: rpQty,
        status: sale.status || 'completed'
      });
      inv.total_amount += rpOriginalTotal;
      inv.total_paid += Math.abs(Number(sale.paid_amount || sale.total_price || 0));
      inv.total_discount += saleDiscount;
      // ✅ تحديث حالة الفاتورة إذا أي عنصر مرتجع
      if (sale.status === 'returned') {
        inv.status = inv.items.every(i => i.status === 'returned') ? 'returned' : 'partially_returned';
      }
    });

    // تحويل لمصفوفة وترتيب
    const invoices = Array.from(invoicesMap.values());
    invoices.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));

    salesHistoryData = invoices;

    // حساب الإجمالي (بدون المرتجعات)
    const total = invoices.reduce((sum, inv) => {
      if (inv.status === 'returned') return sum; // ✅ استبعاد المرتجعات من الإجمالي
      return sum + Number(inv.total_paid || 0);
    }, 0);

    countEl.textContent = invoices.length + ' فاتورة';
    totalEl.textContent = fmt(total);

    if (invoices.length === 0) {
      listContainer.innerHTML = '<div style="text-align:center;padding:40px;color:var(--ds-text-muted, #94a3b8);"><span style="font-size:48px;">📭</span><p>لا توجد فواتير في هذا التاريخ</p></div>';
      return;
    }

    // ✅ ألوان متوافقة مع الوضعين
    const _isDark = document.documentElement.getAttribute('data-theme') !== 'light';
    const _cardBg = _isDark ? '#1e2530' : '#fff';
    const _cardBorder = _isDark ? '#2d3548' : '#e2e8f0';
    const _textMain = _isDark ? '#f1f5f9' : '#1e293b';
    const _textSub = _isDark ? '#94a3b8' : '#64748b';
    const _itemsBg = _isDark ? '#252b38' : '#f8fafc';
    const _hoverBorder = '#6366f1';

    // عرض الفواتير
    listContainer.innerHTML = invoices.map((invoice, index) => {
      const itemsCount = (invoice.items || []).length;
      const devicesCount = (invoice.items || []).filter(i => i.item_type === 'device').length;
      const accessoriesCount = (invoice.items || []).filter(i => i.item_type === 'accessory').reduce((sum, i) => sum + (i.quantity || 1), 0);
      const repairPartsCount = (invoice.items || []).filter(i => i.item_type === 'repair_part').reduce((sum, i) => sum + (i.quantity || 1), 0);

      // تنسيق التاريخ والوقت
      let invoiceDateTime = invoice.created_at;
      if (invoiceDateTime && !invoiceDateTime.includes('T')) {
        invoiceDateTime = invoiceDateTime.replace(' ', 'T');
      }
      const dateObj = new Date(invoiceDateTime);
      const dateStr = dateObj.toLocaleDateString('ar-EG');
      const timeStr = dateObj.toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' });

      // أيقونة طريقة الدفع
      const methodIcons = { cash: '💵', mobile_wallet: '📱', bank: '🏦', mixed: '💰', deferred: '⏳', DEFERRED: '⏳', credit: '⏳' };
      const methodIcon = methodIcons[invoice.payment_method] || '💵';

      // ملخص الأصناف
      let itemsSummary = '';
      if (devicesCount > 0) itemsSummary += `📱 ${devicesCount} جهاز`;
      if (accessoriesCount > 0) itemsSummary += (itemsSummary ? ' • ' : '') + `🎧 ${accessoriesCount} إكسسوار`;
      if (repairPartsCount > 0) itemsSummary += (itemsSummary ? ' • ' : '') + `🔧 ${repairPartsCount} قطعة غيار`;

      // عرض أول صنفين
      const firstItems = (invoice.items || []).slice(0, 2).map(item => {
        if (item.item_type === 'device') {
          return `${item.type || ''} ${item.model || 'جهاز'}`.trim();
        } else if (item.item_type === 'repair_part') {
          return item.name || 'قطعة غيار';
        } else {
          return item.name || 'إكسسوار';
        }
      }).join('، ');

      const moreItems = itemsCount > 2 ? ` +${itemsCount - 2} أخرى` : '';

      // ✅ علامة المرتجع
      const isReturned = invoice.status === 'returned';
      const isPartiallyReturned = invoice.status === 'partially_returned';
      const returnBadge = isReturned
        ? '<span style="display:inline-block;background:#fef3c7;color:#d97706;font-size:10px;font-weight:700;padding:2px 8px;border-radius:6px;margin-right:6px;">🔄 مرتجع</span>'
        : isPartiallyReturned
        ? '<span style="display:inline-block;background:#fef3c7;color:#d97706;font-size:10px;font-weight:700;padding:2px 8px;border-radius:6px;margin-right:6px;">🔄 مرتجع جزئي</span>'
        : '';
      const returnedBorderColor = isReturned ? '#d97706' : _cardBorder;
      const returnedOpacity = isReturned ? 'opacity:0.7;' : '';

      return `
        <div style="background:${_cardBg};border:1px solid ${returnedBorderColor};border-radius:12px;padding:16px;margin-bottom:12px;transition:all 0.2s;cursor:pointer;${returnedOpacity}"
             onclick="showInvoiceDetails(${index})"
             onmouseover="this.style.borderColor='${_hoverBorder}';this.style.boxShadow='0 4px 12px rgba(99,102,241,0.15)'"
             onmouseout="this.style.borderColor='${returnedBorderColor}';this.style.boxShadow='none'">

          <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:12px;">
            <div>
              <div style="font-weight:700;color:${_textMain};font-size:16px;margin-bottom:4px;">
                🧾 فاتورة ${invoice.invoice_number} ${returnBadge}
              </div>
              <div style="font-size:13px;color:${_textSub};">👤 ${escapeHtml(invoice.customer_name || 'عميل نقدي')}</div>
            </div>
            <div style="text-align:left;">
              <div style="font-weight:800;color:${isReturned ? '#d97706' : '#059669'};font-size:18px;">${isReturned ? '<s>' : ''}${fmt(invoice.total_paid || 0)} ج.م${isReturned ? '</s>' : ''}</div>
              <div style="font-size:11px;color:${_textSub};">${methodIcon} ${timeStr}</div>
            </div>
          </div>

          <div style="background:${_itemsBg};border-radius:8px;padding:10px;margin-bottom:12px;">
            <div style="font-size:12px;color:${_textSub};margin-bottom:4px;">${itemsSummary}</div>
            <div style="font-size:13px;color:${_textMain};font-weight:500;">${firstItems}${moreItems}</div>
          </div>

          <div style="display:flex;justify-content:space-between;align-items:center;padding-top:10px;border-top:1px dashed ${_cardBorder};">
            <div style="font-size:12px;color:${_textSub};">
              📅 ${dateStr} | ${itemsCount} صنف
            </div>
            <div style="display:flex;gap:8px;">
              <button onclick="event.stopPropagation();showInvoiceDetails(${index})"
                      style="padding:6px 12px;background:#3b82f6;color:#fff;border:none;border-radius:6px;cursor:pointer;font-size:12px;font-weight:600;">
                📋 تفاصيل
              </button>
              <button onclick="event.stopPropagation();reprintInvoiceByIndex(${index})"
                      style="padding:6px 12px;background:#10b981;color:#fff;border:none;border-radius:6px;cursor:pointer;font-size:12px;font-weight:600;">
                🖨️ طباعة
              </button>
            </div>
          </div>
        </div>
      `;
    }).join('');

    PerfMonitor.end('loadSalesHistory');
  } catch (error) {
    Logger.error('Error loading sales history:', error);
    listContainer.innerHTML = '<div style="text-align:center;padding:40px;color:#ef4444;"><span style="font-size:48px;">❌</span><p>خطأ في تحميل البيانات</p></div>';
    PerfMonitor.end('loadSalesHistory');
  }
}

// عرض تفاصيل الفاتورة الكاملة - ✅ تعريف global فوري
window.showInvoiceDetails = function(index) {
  console.log('[INVOICE-DETAILS] Opening details for index:', index);
  const invoice = salesHistoryData[index];
  if (!invoice) {
    console.error('[INVOICE-DETAILS] Invoice not found at index:', index);
    return;
  }
  console.log('[INVOICE-DETAILS] Invoice found:', invoice.invoice_number);

  currentSaleDetails = invoice;

  const modal = document.getElementById('saleDetailsModal');
  const numberEl = document.getElementById('saleDetailsNumber');
  const contentEl = document.getElementById('saleDetailsContent');

  console.log('[INVOICE-DETAILS] Modal element:', modal ? 'found' : 'NOT FOUND');
  if (!modal) {
    showToast('خطأ: مودال التفاصيل غير موجود', 'error');
    return;
  }

  // رقم الفاتورة
  numberEl.textContent = invoice.invoice_number;

  // تنسيق التاريخ والوقت
  let invoiceDateTime = invoice.created_at;
  if (invoiceDateTime && !invoiceDateTime.includes('T')) {
    invoiceDateTime = invoiceDateTime.replace(' ', 'T');
  }
  const dateObj = new Date(invoiceDateTime);
  const dateStr = dateObj.toLocaleDateString('ar-EG');
  const timeStr = dateObj.toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' });

  // طريقة الدفع
  const methodNames = { cash: 'كاش سائل', mobile_wallet: 'محفظة إلكترونية', bank: 'حساب بنكي', mixed: 'متعدد', deferred: 'آجل', DEFERRED: 'آجل', credit: 'آجل' };
  const methodIcons = { cash: '💵', mobile_wallet: '📱', bank: '🏦', mixed: '💰', deferred: '⏳', DEFERRED: '⏳', credit: '⏳' };
  const paymentMethod = invoice.payment_method || 'cash';

  // بناء محتوى التفاصيل - متوافق مع الوضع الغامق والفاتح
  const isDark = document.documentElement.getAttribute('data-theme') !== 'light';
  const bgCard = isDark ? '#1e293b' : '#f8fafc';
  const bgItem = isDark ? '#334155' : '#f1f5f9';
  const textPrimary = isDark ? '#f1f5f9' : '#1e293b';
  const textSecondary = isDark ? '#94a3b8' : '#64748b';
  const borderColor = isDark ? '#475569' : '#e2e8f0';

  let detailsHTML = '<div style="direction:rtl;">';

  // معلومات عامة
  detailsHTML += `
    <div style="background:${bgCard};border-radius:10px;padding:14px;margin-bottom:16px;border:1px solid ${borderColor};">
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;">
        <div><span style="color:${textSecondary};font-size:12px;">📅 التاريخ</span><div style="font-weight:600;color:${textPrimary};">${dateStr}</div></div>
        <div><span style="color:${textSecondary};font-size:12px;">⏰ الوقت</span><div style="font-weight:600;color:${textPrimary};">${timeStr}</div></div>
        <div><span style="color:${textSecondary};font-size:12px;">💳 طريقة الدفع</span><div style="font-weight:600;color:${textPrimary};">${methodIcons[paymentMethod]} ${methodNames[paymentMethod]}</div></div>
        <div><span style="color:${textSecondary};font-size:12px;">👤 العميل</span><div style="font-weight:600;color:${textPrimary};">${invoice.customer_name || 'عميل نقدي'}</div></div>
      </div>
    </div>
  `;

  // قائمة الأصناف
  const items = invoice.items || [];
  if (items.length > 0) {
    detailsHTML += `
      <div style="background:${bgCard};border:1px solid ${borderColor};border-radius:10px;padding:14px;margin-bottom:16px;">
        <div style="font-weight:700;margin-bottom:12px;color:${textPrimary};border-bottom:1px solid ${borderColor};padding-bottom:8px;">
          🛒 الأصناف (${items.length})
        </div>
        <div style="display:flex;flex-direction:column;gap:10px;">
    `;

    items.forEach((item, i) => {
      const icon = item.item_type === 'device' ? '📱' : (item.item_type === 'repair_part' ? '🔧' : '🎧');
      const name = item.item_type === 'device'
        ? `${item.type || ''} ${item.model || 'جهاز'}`.trim()
        : (item.item_type === 'repair_part' ? (item.name || 'قطعة غيار') : (item.name || 'إكسسوار'));
      const qty = item.quantity || 1;
      const totalPrice = Number(item.sell_price || item.unit_price || 0);
      const unitPrice = item.unit_price ? Number(item.unit_price) : (qty > 1 ? totalPrice / qty : totalPrice);

      detailsHTML += `
        <div style="display:flex;justify-content:space-between;align-items:center;padding:10px;background:${bgItem};border-radius:8px;">
          <div style="display:flex;align-items:center;gap:8px;">
            <span style="font-size:20px;">${icon}</span>
            <div>
              <div style="font-weight:600;color:${textPrimary};">${name}</div>
              ${qty > 1 ? `<div style="font-size:11px;color:${textSecondary};">الكمية: ${qty} × ${fmt(unitPrice)}</div>` : ''}
              ${item.imei1 ? `<div style="font-size:10px;color:${textSecondary};font-family:monospace;">${item.imei1}</div>` : ''}
            </div>
          </div>
          <div style="font-weight:700;color:#10b981;">${fmt(totalPrice)} ج.م</div>
        </div>
      `;
    });

    detailsHTML += '</div></div>';
  }

  // الحسابات - مع الخصم
  const totalAmount = Number(invoice.total_amount || 0);
  const totalDiscount = Number(invoice.total_discount || 0);
  const totalPaid = Number(invoice.total_paid || 0);
  const netTotal = totalAmount - totalDiscount;
  const remaining = netTotal - totalPaid;

  const calcBg = isDark ? 'linear-gradient(135deg,#1e293b,#0f172a)' : 'linear-gradient(135deg,#e2e8f0,#cbd5e1)';
  const calcText = isDark ? '#fff' : '#1e293b';
  const calcMuted = isDark ? '#94a3b8' : '#64748b';
  const calcBorder = isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)';
  const calcBorder2 = isDark ? 'rgba(255,255,255,0.2)' : 'rgba(0,0,0,0.15)';

  detailsHTML += `
    <div style="background:${calcBg};color:${calcText};border-radius:10px;padding:16px;">
      <div style="display:flex;justify-content:space-between;margin-bottom:8px;">
        <span style="color:${calcMuted};">إجمالي الفاتورة</span>
        <span style="font-weight:700;">${fmt(totalAmount)} ج.م</span>
      </div>
      ${totalDiscount > 0 ? `
        <div style="display:flex;justify-content:space-between;margin-bottom:8px;">
          <span style="color:#f87171;">🏷️ الخصم</span>
          <span style="font-weight:700;color:#f87171;">- ${fmt(totalDiscount)} ج.م</span>
        </div>
        <div style="display:flex;justify-content:space-between;margin-bottom:8px;padding-top:8px;border-top:1px solid ${calcBorder};">
          <span style="color:${calcMuted};">الصافي بعد الخصم</span>
          <span style="font-weight:700;">${fmt(netTotal)} ج.م</span>
        </div>
      ` : ''}
      ${(() => {
        const isDeferred = ['deferred','DEFERRED','credit'].includes(paymentMethod);
        if (isDeferred) {
          // فاتورة آجل - المتبقي = الإجمالي - المدفوع فعلاً
          // ملاحظة: totalPaid هنا = مجموع paid_now من الداتابيز
          const deferredPaid = totalPaid;
          const deferredRemaining = netTotal - deferredPaid;
          if (deferredPaid > 0 && deferredRemaining > 0) {
            // آجل جزئي - تم دفع جزء
            return `
              <div style="display:flex;justify-content:space-between;margin-bottom:8px;">
                <span style="color:${calcMuted};">المدفوع مقدماً</span>
                <span style="font-weight:700;color:#4ade80;">${fmt(deferredPaid)} ج.م</span>
              </div>
              <div style="display:flex;justify-content:space-between;padding-top:8px;border-top:1px solid ${calcBorder2};">
                <span style="color:#f59e0b;">⏳ المتبقي (آجل)</span>
                <span style="font-weight:700;color:#f59e0b;">${fmt(deferredRemaining)} ج.م</span>
              </div>
            `;
          } else {
            // آجل بالكامل (سواء paid_now = 0 أو = المبلغ كله بسبب بيانات قديمة)
            return `
              <div style="display:flex;justify-content:space-between;padding-top:8px;border-top:1px solid ${calcBorder2};">
                <span style="color:#f59e0b;">⏳ آجل</span>
                <span style="font-weight:700;color:#f59e0b;">${fmt(netTotal)} ج.م</span>
              </div>
            `;
          }
        } else if (remaining > 0) {
          // عادي - فيه متبقي
          return `
            <div style="display:flex;justify-content:space-between;margin-bottom:8px;">
              <span style="color:${calcMuted};">المدفوع</span>
              <span style="font-weight:700;color:#4ade80;">${fmt(totalPaid)} ج.م</span>
            </div>
            <div style="display:flex;justify-content:space-between;padding-top:8px;border-top:1px solid ${calcBorder2};">
              <span style="color:#fbbf24;">⚠️ المتبقي</span>
              <span style="font-weight:700;color:#fbbf24;">${fmt(remaining)} ج.م</span>
            </div>
          `;
        } else {
          // مدفوع بالكامل
          return `
            <div style="display:flex;justify-content:space-between;padding-top:8px;border-top:1px solid ${calcBorder2};">
              <span style="color:#059669;">✅ مدفوع بالكامل</span>
              <span style="font-weight:700;color:#059669;">${fmt(totalPaid)} ج.م</span>
            </div>
          `;
        }
      })()}
    </div>
  `;

  detailsHTML += '</div>';

  contentEl.innerHTML = detailsHTML;
  // فتح المودال مباشرة بـ inline style للتأكد من الظهور
  modal.style.display = 'flex';
  modal.style.opacity = '1';
  modal.style.visibility = 'visible';
  modal.classList.add('show');
  console.log('[INVOICE-DETAILS] ✅ Modal opened with inline styles');
}

// إعادة طباعة فاتورة من السجل
async function reprintInvoice(invoiceNumber) {
  try {
    showToast('جاري تحميل الفاتورة...', 'info');

    const res = await fetch(`elos-db://invoice/${invoiceNumber}`);
    if (!res.ok) throw new Error(await res.text());

    const invoice = await res.json();

    // بناء بيانات الطباعة
    const printData = {
      invoiceNumber: invoice.invoice_number,
      date: invoice.created_at,
      customer: invoice.customer_name || 'عميل نقدي',
      items: (invoice.items || []).map(item => ({
        name: item.item_type === 'device'
          ? `${item.type || ''} ${item.model || 'جهاز'}`.trim()
          : (item.item_type === 'repair_part' ? (item.name || 'قطعة غيار') : (item.name || 'إكسسوار')),
        type: item.item_type,
        quantity: item.quantity || 1,
        price: item.unit_price || item.price || item.sell_price || 0,
        imei: item.imei1
      })),
      subtotal: invoice.total_amount,
      discount: invoice.discount || 0,
      total: invoice.total_paid,
      paymentMethod: invoice.payment_method
    };

    // استدعاء دالة الطباعة
    if (typeof printInvoice === 'function') {
      await printInvoice(printData);
    } else {
      showToast('دالة الطباعة غير متوفرة', 'error');
    }

  } catch (error) {
    Logger.error('Error reprinting invoice:', error);
    showToast('خطأ في طباعة الفاتورة', 'error');
  }
}

// طباعة فاتورة من الـ index - ✅ تعريف global فوري
window.reprintInvoiceByIndex = function(index) {
  const invoice = salesHistoryData[index];
  if (!invoice) return;

  // استخدام الخصم المحفوظ أو حسابه من الفرق
  const totalAmount = Number(invoice.total_amount || 0);
  const totalPaid = Number(invoice.total_paid || 0);
  const totalDiscount = Number(invoice.total_discount || 0);
  // الخصم = المحفوظ أو الفرق بين الإجمالي والمدفوع
  const discount = totalDiscount > 0 ? totalDiscount : (totalAmount - totalPaid > 0 ? totalAmount - totalPaid : 0);

  const printData = {
    invoiceNumber: invoice.invoice_number,
    date: invoice.created_at,
    customer: invoice.customer_name || 'عميل نقدي',
    items: (invoice.items || []).map(item => ({
      name: item.item_type === 'device'
        ? `${item.type || ''} ${item.model || 'جهاز'}`.trim()
        : (item.item_type === 'repair_part' ? (item.name || 'قطعة غيار') : (item.name || 'إكسسوار')),
      type: item.item_type,
      quantity: item.quantity || 1,
      price: item.unit_price || (item.sell_price || 0) / (item.quantity || 1),
      imei: item.imei1
    })),
    subtotal: totalAmount,
    discount: discount,
    total: totalPaid,
    paymentMethod: invoice.payment_method
  };

  if (typeof printInvoice === 'function') {
    printInvoice(printData);
  } else {
    showToast('دالة الطباعة غير متوفرة', 'error');
  }
}

/**
 * طباعة فاتورة من سجل المبيعات - متوافق مع الطابعات الحرارية
 * @param {Object} data - بيانات الفاتورة
 */
function printInvoice(data) {
  const settings = JSON.parse(localStorage.getItem('appSettings') || '{}');
  
  const paperWidth = settings.printerPaperWidth === '58' ? '54mm' : '72mm';
  const pageSize = settings.printerPaperWidth || '80';
  
  // التاريخ والوقت
  const invoiceDate = data.date ? new Date(data.date) : new Date();
  const dateStr = invoiceDate.toLocaleDateString('ar-EG');
  const timeStr = invoiceDate.toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' });
  
  // بناء الأصناف
  let itemsPrint = '';
  let itemsPreview = '';
  
  const devices = (data.items || []).filter(item => item.type === 'device');
  const accessories = (data.items || []).filter(item => item.type !== 'device');
  
  devices.forEach((item) => {
    const itemTotal = (item.price || 0) * (item.quantity || 1);
    
    itemsPreview += `
      <div style="padding: 8px 0; border-bottom: 1px solid #ddd;">
        <div style="display: flex; justify-content: space-between;">
          <span style="font-weight: 700; font-size: 13px; color: #000;">${item.name || 'جهاز'}</span>
          <span style="font-weight: 700; font-size: 13px; color: #000;">${fmt(itemTotal)}</span>
        </div>
        ${item.imei ? `<div style="font-size: 10px; color: #000; font-family: monospace;">IMEI: ${item.imei}</div>` : ''}
      </div>`;
    
    itemsPrint += `
      <div class="item">
        <div class="item-header">
          <span>${item.name || 'جهاز'}</span>
          <span>${fmt(itemTotal)}</span>
        </div>
        ${item.imei ? `<div class="item-imei">IMEI: ${item.imei}</div>` : ''}
      </div>`;
  });
  
  if (accessories.length > 0) {
    itemsPreview += `<div style="font-size: 11px; color: #000; font-weight: 700; padding: 8px 0 4px; border-bottom: 1px dashed #000;">الإكسسوارات</div>`;
    itemsPrint += `<div class="acc-divider">الإكسسوارات</div>`;
    
    accessories.forEach((item) => {
      const qty = item.quantity || 1;
      const unitPrice = item.price || 0;
      const itemTotal = unitPrice * qty;
      const qtyLine = qty > 1 ? `${qty} × ${fmt(unitPrice)}` : '';

      itemsPreview += `
        <div style="padding: 6px 0; font-size: 12px; font-weight: 600; color: #000;">
          <div style="display: flex; justify-content: space-between;">
            <span>${item.name || 'إكسسوار'}</span>
            <span>${fmt(itemTotal)}</span>
          </div>
          ${qtyLine ? `<div style="font-size: 10px; color: #000; font-weight: 600;">${qtyLine}</div>` : ''}
        </div>`;

      itemsPrint += `
        <div class="acc-item">
          <div style="display: flex; justify-content: space-between;">
            <span>${item.name || 'إكسسوار'}</span>
            <span>${fmt(itemTotal)}</span>
          </div>
          ${qtyLine ? `<div style="font-size: 10px;">${qtyLine}</div>` : ''}
        </div>`;
    });
  }
  
  const subtotal = data.subtotal || 0;
  const discount = data.discount || 0;
  const total = data.total || subtotal - discount;
  const customerName = data.customer || '';
  const invoiceNumber = data.invoiceNumber || '';

  // ترجمة طريقة الدفع
  const reprintMethodMap = {
    'cash': 'كاش سائل',
    'mobile_wallet': 'محفظة إلكترونية',
    'bank': 'حساب بنكي',
    'split': 'تقسيم',
    'نقدي': 'كاش سائل',
    'deferred': 'آجل',
    'DEFERRED': 'آجل',
    'credit': 'آجل'
  };
  const paymentMethod = reprintMethodMap[data.paymentMethod] || data.paymentMethod || 'نقدي';
  
  // المعاينة
  const previewHTML = `
    <div dir="rtl" style="font-family: Arial, Tahoma, sans-serif; max-width: 100%; padding: 16px; background: #fff; color: #000;">
      
      <div style="text-align: center; padding-bottom: 12px; border-bottom: 2px solid #000;">
        ${settings.companyLogo ? `<img src="${settings.companyLogo}" style="width: 45px; height: 45px; object-fit: contain; margin-bottom: 6px;" />` : ''}
        <div style="font-size: 18px; font-weight: 700; letter-spacing: 1px;">${settings.companyName || 'ELOS'}</div>
      </div>

      <div style="display: flex; justify-content: space-between; padding: 10px 0; font-size: 11px; color: #000; font-weight: 600; border-bottom: 1px solid #000;">
        <div>
          <div style="font-weight: 700; font-size: 12px;">#${invoiceNumber}</div>
          <div>${dateStr} - ${timeStr}</div>
        </div>
        ${customerName ? `<div style="text-align: left; font-weight: 700;">${customerName}</div>` : ''}
      </div>

      <div style="padding: 8px 0;">
        ${itemsPreview}
      </div>

      ${discount > 0 ? `
        <div style="border-top: 1px solid #000; padding-top: 8px; font-size: 12px; color: #000; font-weight: 600;">
          <div style="display: flex; justify-content: space-between; padding: 4px 0;"><span>المجموع</span><span>${fmt(subtotal)}</span></div>
          <div style="display: flex; justify-content: space-between; padding: 4px 0;"><span>خصم</span><span>- ${fmt(discount)}</span></div>
        </div>
      ` : ''}

      <div style="background: #000; color: #fff; margin: 12px -16px; padding: 14px 16px; text-align: center;">
        <div style="font-size: 11px; letter-spacing: 2px; margin-bottom: 4px;">الإجمالي</div>
        <div style="font-size: 22px; font-weight: 700;">EGP ${fmt(total)}</div>
      </div>

      <div style="display: flex; justify-content: space-between; font-size: 12px; padding: 8px 0; font-weight: 600; color: #000;">
        <span>طريقة الدفع:</span>
        <span>${paymentMethod}</span>
      </div>

      <div style="text-align: center; padding-top: 12px; margin-top: 8px; border-top: 2px solid #000;">
        <div style="font-size: 11px; color: #000; font-weight: 600; margin-bottom: 10px;">${settings.printerFooterMessage || 'شكراً لتعاملكم معنا'}</div>
        <div>${generateBarcodeSVG(invoiceNumber.replace(/[^A-Z0-9]/gi, '').slice(-12))}</div>
        <div style="font-family: monospace; font-size: 10px; color: #000; font-weight: 600; margin-top: 4px;">${invoiceNumber}</div>
        <div style="margin-top: 10px; padding-top: 8px; border-top: 1px dashed #000; font-size: 9px; font-weight: 600; color: #000; letter-spacing: 0.5px;">
          <div>ELOS ACCOUNTING SYSTEM</div>
          <div>01031372078</div>
        </div>
      </div>
    </div>
  `;
  
  // HTML للطباعة
  currentPrintHTML = `<!DOCTYPE html>
<html dir="rtl" lang="ar">
<head>
  <meta charset="UTF-8">
  <title>فاتورة</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    @page { size: ${pageSize}mm auto; margin: 0; }
    
    body {
      font-family: Arial, Tahoma, sans-serif;
      width: ${paperWidth};
      max-width: ${paperWidth};
      margin: 0 auto;
      padding: 3mm;
      background: #fff;
      color: #000;
      font-size: 12px;
      line-height: 1.4;
      font-weight: 600;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }
    
    .header {
      text-align: center;
      padding-bottom: 3mm;
      border-bottom: 0.5mm solid #000;
      margin-bottom: 2mm;
    }
    .logo { max-width: 14mm; max-height: 14mm; margin-bottom: 1mm; display: block; margin-left: auto; margin-right: auto; }
    .shop-name { font-size: 16px; font-weight: 700; letter-spacing: 0.5mm; }
    
    .info {
      display: flex;
      justify-content: space-between;
      padding: 2mm 0;
      font-size: 11px;
      font-weight: 600;
      color: #000;
      border-bottom: 0.3mm solid #000;
    }
    .info-num { font-weight: 700; font-size: 12px; }
    
    .items { padding: 2mm 0; }
    .item {
      padding: 2mm 0;
      border-bottom: 0.3mm solid #000;
    }
    .item:last-child { border-bottom: none; }
    .item-header {
      display: flex;
      justify-content: space-between;
      font-weight: 700;
      font-size: 12px;
      color: #000;
    }
    .item-imei {
      font-size: 10px;
      font-weight: 600;
      color: #000;
      font-family: monospace;
      margin-top: 0.5mm;
    }
    
    .acc-divider {
      font-size: 11px;
      font-weight: 700;
      color: #000;
      padding: 2mm 0 1mm;
      border-bottom: 0.3mm dashed #000;
      margin-top: 1mm;
    }
    .acc-item {
      display: flex;
      justify-content: space-between;
      padding: 1.5mm 0;
      font-size: 11px;
      font-weight: 600;
      color: #000;
    }
    
    .summary {
      border-top: 0.3mm solid #000;
      padding-top: 2mm;
      margin-top: 1mm;
      font-size: 11px;
      font-weight: 600;
      color: #000;
    }
    .summary-row {
      display: flex;
      justify-content: space-between;
      padding: 1mm 0;
    }
    
    .total {
      background: #000;
      color: #fff;
      margin: 3mm -3mm;
      padding: 4mm 3mm;
      text-align: center;
    }
    .total-label {
      font-size: 10px;
      font-weight: 600;
      letter-spacing: 1mm;
    }
    .total-amount {
      font-size: 18px;
      font-weight: 700;
      margin-top: 1mm;
    }
    
    .payment {
      display: flex;
      justify-content: space-between;
      font-size: 11px;
      font-weight: 600;
      padding: 2mm 0;
      color: #000;
    }
    
    .footer {
      text-align: center;
      padding-top: 3mm;
      margin-top: 2mm;
      border-top: 0.3mm solid #000;
    }
    .footer-msg {
      font-size: 11px;
      font-weight: 600;
      color: #000;
      margin-bottom: 2mm;
    }
    .barcode { margin-top: 2mm; text-align: center; }
    .barcode svg { max-width: 85%; height: auto; display: block; margin: 0 auto; }
    .barcode-num {
      font-family: monospace;
      font-size: 10px;
      font-weight: 700;
      color: #000;
      margin-top: 1mm;
    }
    .elos-sig {
      margin-top: 3mm;
      padding-top: 2mm;
      border-top: 0.3mm dashed #000;
      font-size: 9px;
      font-weight: 600;
      color: #000;
      letter-spacing: 0.3mm;
    }
  </style>
</head>
<body>
  
  <div class="header">
    ${settings.companyLogo ? `<img src="${settings.companyLogo}" class="logo" style="display:block; margin:0 auto 1mm auto;" />` : ''}
    <div class="shop-name">${settings.companyName || 'ELOS'}</div>
  </div>
  
  <div class="info">
    <div>
      <div class="info-num">#${invoiceNumber}</div>
      <div>${dateStr} - ${timeStr}</div>
    </div>
    ${customerName ? `<div style="text-align: left; font-weight: 700;">${customerName}</div>` : ''}
  </div>
  
  <div class="items">
    ${itemsPrint}
  </div>
  
  ${discount > 0 ? `
    <div class="summary">
      <div class="summary-row"><span>المجموع</span><span>${fmt(subtotal)}</span></div>
      <div class="summary-row"><span>خصم</span><span>- ${fmt(discount)}</span></div>
    </div>
  ` : ''}
  
  <div class="total">
    <div class="total-label">الإجمالي</div>
    <div class="total-amount">EGP ${fmt(total)}</div>
  </div>
  
  <div class="payment">
    <span>طريقة الدفع:</span>
    <span>${paymentMethod}</span>
  </div>
  
  <div class="footer">
    <div class="footer-msg">${settings.printerFooterMessage || 'شكراً لتعاملكم معنا'}</div>
    <div class="barcode" style="text-align:center;">
      <div style="display:inline-block;">${generateBarcodeSVG(invoiceNumber.replace(/[^A-Z0-9]/gi, '').slice(-12))}</div>
      <div class="barcode-num">${invoiceNumber}</div>
    </div>
    <div class="elos-sig">
      <div>ELOS ACCOUNTING SYSTEM</div>
      <div>01031372078</div>
    </div>
  </div>

</body>
</html>`;

  showPrintPreview(currentPrintHTML);
}

// عرض تفاصيل الفاتورة (للتوافق مع الكود القديم)
async function showSaleDetails(index) {
  // استخدام الدالة الجديدة
  showInvoiceDetails(index);
}

// إغلاق modal تفاصيل الفاتورة - ✅ تعريف global فوري
window.closeSaleDetailsModal = function() {
  const modal = document.getElementById('saleDetailsModal');
  if (modal) {
    modal.classList.remove('show');
    modal.style.display = 'none';
    modal.style.opacity = '';
    modal.style.visibility = '';
  }
  currentSaleDetails = null;
  console.log('[SALES-HISTORY] ✅ Modal closed');
}

// إعادة طباعة الفاتورة من التفاصيل
function reprintSaleInvoice() {
  if (!currentSaleDetails) return;
  const index = salesHistoryData.indexOf(currentSaleDetails);
  if (index >= 0) {
    reprintInvoiceByIndex(index);
  }
  closeSaleDetailsModal();
}

// إعادة طباعة فاتورة من السجل
function reprintSaleFromHistory(index) {
  const sale = salesHistoryData[index];
  if (!sale) return;

  // تحويل بيانات البيع لشكل السلة
  const cartItem = {
    id: sale.id,
    type: sale.saleType === 'accessory' ? 'accessory' : 'device',
    label: sale.model ? `${sale.type || ''} ${sale.model}`.trim() : sale.model,
    brand: sale.type,
    model: sale.model,
    storage: sale.storage,
    color: sale.color,
    condition: sale.condition,
    imei1: sale.imei1,
    imei2: sale.imei2,
    price: Number(sale.sell_price || sale.paid_now || 0),
    discount: 0,
    qty: sale.quantity || 1
  };

  // حفظ السلة الحالية مؤقتاً
  const originalCart = [...cart];

  // وضع البيع في السلة مؤقتاً
  cart = [cartItem];

  // بيانات الفاتورة
  const invoiceData = {
    invoiceNumber: sale.invoice_number || `INV-${sale.id || index + 1}`,
    paymentMethod: sale.payment_method || 'cash',
    remaining: Number(sale.sell_price || 0) - Number(sale.paid_now || sale.sell_price || 0),
    customerName: sale.customer_name || sale.client_name || '',
    customerPhone: sale.customer_phone || ''
  };

  // تحديث حقول العميل مؤقتاً
  const origCName = cName?.value;
  const origCPhone = cPhone?.value;
  if (cName) cName.value = invoiceData.customerName;
  if (cPhone) cPhone.value = invoiceData.customerPhone;

  // طباعة
  printReceipt(invoiceData);

  // استعادة السلة الأصلية
  cart = originalCart;
  if (cName) cName.value = origCName || '';
  if (cPhone) cPhone.value = origCPhone || '';

  showToast('✅ تم إرسال الفاتورة للطباعة', 'success');
}

// ═══════════════════════════════════════════════════════════════
// 🎯 EVENT LISTENERS FOR SALES HISTORY MODAL
// ═══════════════════════════════════════════════════════════════

// إغلاق modals عند الضغط خارجها
document.getElementById('salesHistoryModal')?.addEventListener('click', function(e) {
  if (e.target === this) closeSalesHistoryModal();
});

// إعداد event listeners لنافذة فواتير نقطة البيع
function setupSalesHistoryEventListeners() {
  // زر الإغلاق في الهيدر
  const btnCloseHeader = document.getElementById('btnCloseSalesHistory');
  if (btnCloseHeader) {
    btnCloseHeader.addEventListener('click', closeSalesHistoryModal);
    console.log('[SALES-HISTORY] ✅ Close header button listener attached');
  } else {
    console.warn('[SALES-HISTORY] ⚠️ Close header button not found');
  }

  // زر الإغلاق في الفوتر
  const btnCloseFooter = document.getElementById('btnCloseSalesHistoryFooter');
  if (btnCloseFooter) {
    btnCloseFooter.addEventListener('click', closeSalesHistoryModal);
    console.log('[SALES-HISTORY] ✅ Close footer button listener attached');
  } else {
    console.warn('[SALES-HISTORY] ⚠️ Close footer button not found');
  }

  // زر البحث
  const btnSearch = document.getElementById('btnSearchSalesHistory');
  if (btnSearch) {
    btnSearch.addEventListener('click', () => loadSalesHistory());
    console.log('[SALES-HISTORY] ✅ Search button listener attached');
  } else {
    console.warn('[SALES-HISTORY] ⚠️ Search button not found');
  }

  // زر اليوم
  const btnToday = document.getElementById('btnTodaySales');
  if (btnToday) {
    btnToday.addEventListener('click', () => loadSalesHistory('today'));
    console.log('[SALES-HISTORY] ✅ Today button listener attached');
  } else {
    console.warn('[SALES-HISTORY] ⚠️ Today button not found');
  }

  // زر أمس
  const btnYesterday = document.getElementById('btnYesterdaySales');
  if (btnYesterday) {
    btnYesterday.addEventListener('click', () => loadSalesHistory('yesterday'));
    console.log('[SALES-HISTORY] ✅ Yesterday button listener attached');
  } else {
    console.warn('[SALES-HISTORY] ⚠️ Yesterday button not found');
  }

  // زر آخر 7 أيام
  const btnWeek = document.getElementById('btnWeekSales');
  if (btnWeek) {
    btnWeek.addEventListener('click', () => loadSalesHistory('week'));
    console.log('[SALES-HISTORY] ✅ Week button listener attached');
  } else {
    console.warn('[SALES-HISTORY] ⚠️ Week button not found');
  }

  console.log('[SALES-HISTORY] ✅ All event listeners setup completed');
}

document.getElementById('saleDetailsModal')?.addEventListener('click', function(e) {
  if (e.target === this) closeSaleDetailsModal();
});

// Update shift statistics
function updateShiftStats(sales) {
  let cashCount = 0;
  let cardCount = 0;
  let transferCount = 0;
  let totalAmount = 0;
  
  sales.forEach(sale => {
    const method = sale.payment_method || 'cash';
    const amount = Number(sale.paid_now || sale.sell_price || 0);
    
    totalAmount += amount;
    
    switch (method) {
      case 'cash':
        cashCount++;
        break;
      case 'mobile_wallet':
      case 'card': // للتوافق مع البيانات القديمة
        cardCount++;
        break;
      case 'bank':
      case 'transfer': // للتوافق مع البيانات القديمة
        transferCount++;
        break;
      default:
        cashCount++;
    }
  });
  
  const avgSale = sales.length > 0 ? totalAmount / sales.length : 0;
  
  // Update display
  const statCashCount = document.getElementById('statCashCount');
  const statCardCount = document.getElementById('statCardCount');
  const statTransferCount = document.getElementById('statTransferCount');
  const statAvgSale = document.getElementById('statAvgSale');
  
  if (statCashCount) statCashCount.textContent = cashCount;
  if (statCardCount) statCardCount.textContent = cardCount;
  if (statTransferCount) statTransferCount.textContent = transferCount;
  if (statAvgSale) statAvgSale.textContent = fmt(avgSale);
}

// ═══════════════════════════════════════════════════════════════
// 👥 CLIENT MANAGEMENT & DEFERRED PAYMENT
// ═══════════════════════════════════════════════════════════════

// Load clients list
async function loadClients() {
  try {
    clientsList = await API.clients.getAll();
    
    // Populate select
    const select = document.getElementById('cClientSelect');
    if (select) {
      select.innerHTML = '<option value="">-- اختر عميل مسجل --</option>';
      clientsList.forEach(client => {
        const option = document.createElement('option');
        option.value = client.id;
        option.textContent = `${client.name} ${client.phone ? '(' + client.phone + ')' : ''} ${client.balance > 0 ? '- عليه: ' + fmt(client.balance) + ' ج.م' : ''}`;
        option.dataset.balance = client.balance || 0;
        option.dataset.name = client.name;
        option.dataset.phone = client.phone || '';
        select.appendChild(option);
      });
    }
    
    Logger.log('👥 Clients loaded:', clientsList.length);
  } catch (error) {
    Logger.error('Error loading clients:', error);
  }
}

// Handle client selection
document.getElementById('cClientSelect')?.addEventListener('change', function() {
  const selectedOption = this.options[this.selectedIndex];
  const clientId = this.value;
  
  selectedClientId = clientId ? Number(clientId) : null;
  
  const balanceInfo = document.getElementById('clientBalanceInfo');
  const balanceDisplay = document.getElementById('clientCurrentBalance');
  const cName = document.getElementById('cName');
  const cPhone = document.getElementById('cPhone');
  
  if (clientId && selectedOption) {
    // Fill name and phone
    cName.value = selectedOption.dataset.name || '';
    cPhone.value = selectedOption.dataset.phone || '';
    
    // Show balance
    const balance = Number(selectedOption.dataset.balance || 0);
    if (balanceInfo && balanceDisplay) {
      balanceInfo.style.display = 'block';
      balanceDisplay.textContent = fmt(balance) + ' ج.م';
      
      // Change color based on balance
      if (balance > 0) {
        balanceInfo.style.background = 'rgba(239, 68, 68, 0.1)';
        balanceInfo.style.borderColor = 'rgba(239, 68, 68, 0.3)';
        balanceDisplay.style.color = 'var(--danger)';
        balanceInfo.querySelector('span').style.color = 'var(--danger)';
        balanceInfo.querySelector('span').textContent = '⚠️ عليه مديونية';
      } else {
        balanceInfo.style.background = 'rgba(16, 185, 129, 0.1)';
        balanceInfo.style.borderColor = 'rgba(16, 185, 129, 0.3)';
        balanceDisplay.style.color = 'var(--success)';
        balanceInfo.querySelector('span').style.color = 'var(--success)';
        balanceInfo.querySelector('span').textContent = '✅ لا يوجد مديونية';
      }
    }
  } else {
    selectedClientId = null;
    if (balanceInfo) balanceInfo.style.display = 'none';
  }
  
  // Update remaining amount display
  updateRemainingAmount();
});

// Update remaining amount calculation
function updateRemainingAmount() {
  const paidNowInput = document.getElementById('paidNowAmount');
  const remainingDisplay = document.getElementById('remainingAmountDisplay');
  const remainingAmountSpan = document.getElementById('remainingAmount');
  const clientWarning = document.getElementById('clientRequiredWarning');
  
  if (!paidNowInput || !remainingDisplay || !remainingAmountSpan) return;
  
  // Calculate total
  const subtotal = sum(cart, 'price');
  const itemDiscounts = cart.reduce((total, item) => total + (item.discount || 0), 0);
  
  let globalDiscount = 0;
  const pct = Number(document.getElementById('discPct')?.value || 0);
  const val = Number(document.getElementById('discVal')?.value || 0);
  const afterItemDiscounts = subtotal - itemDiscounts;
  
  if (pct > 0) globalDiscount = afterItemDiscounts * (pct / 100);
  if (val > 0) globalDiscount += val;
  
  const total = Math.max(0, subtotal - itemDiscounts - globalDiscount);
  const paidNow = Number(paidNowInput.value || 0);
  const remaining = total - paidNow;
  
  if (paidNow > 0 && remaining > 0) {
    remainingDisplay.style.display = 'block';
    remainingAmountSpan.textContent = fmt(remaining) + ' ج.م';
    
    // Show warning if no client selected
    if (clientWarning) {
      clientWarning.style.display = selectedClientId ? 'none' : 'block';
    }
  } else {
    remainingDisplay.style.display = 'none';
  }
}

// ═══════════════════════════════════════════════════════════════
// 🔗 NAVIGATION BUTTON BY ROLE
// ═══════════════════════════════════════════════════════════════

function updateNavButtonByRole() {
  const navBtn = document.getElementById('navHomeBtn');
  if (!navBtn) return;

  // التحقق من صلاحية المستخدم
  const user = window.currentUser;

  if (user && user.role === 'cashier') {
    // الكاشير يروح للعملاء
    navBtn.href = './clients.html';
    navBtn.innerHTML = '<span>👥</span> العملاء';
  } else {
    // المدير أو أي دور آخر يروح للرئيسية
    navBtn.href = './index.html';
    navBtn.innerHTML = '<span>🏠</span> الرئيسية';
  }

  // إظهار الزر
  navBtn.style.opacity = '1';
}

// ═══════════════════════════════════════════════════════════════
// 👤 USER CARD & EXIT BUTTON
// ═══════════════════════════════════════════════════════════════

function updateUserCard() {
  // محاولة الحصول على المستخدم من localStorage مباشرة (الأحدث دائماً)
  let user = null;

  try {
    const userJson = localStorage.getItem('currentUser');
    if (userJson) {
      user = JSON.parse(userJson);
      window.currentUser = user; // تحديث window بأحدث بيانات
    }
  } catch (e) {
    Logger.error('[POS] Failed to parse currentUser:', e);
  }

  // fallback لـ window.currentUser
  if (!user) {
    user = window.currentUser;
  }

  if (!user) {
    Logger.warn('[POS] No user found for user card');
    return;
  }

  Logger.log('[POS] 👤 User Card Update:', user.username, 'Role:', user.role);

  const userAvatar = document.getElementById('userAvatar');
  const userName = document.getElementById('userName');
  const userRole = document.getElementById('userRole');
  const exitBtn = document.getElementById('exitAppBtn');

  if (userAvatar && userName && userRole) {
    // استخراج أول حرفين من اسم المستخدم
    const initials = user.username ? user.username.substring(0, 2).toUpperCase() : '--';
    userAvatar.textContent = initials;
    userName.textContent = user.username || 'مستخدم';

    // ترجمة الدور للعربية
    const roleNames = {
      'admin': 'مدير النظام',
      'manager': 'مدير',
      'cashier': 'كاشير',
      'accountant': 'محاسب'
    };
    userRole.textContent = roleNames[user.role] || user.role || '--';
  }

  // إظهار زر الخروج للكاشير فقط
  if (exitBtn) {
    if (user.role === 'cashier') {
      exitBtn.style.display = 'flex';
    } else {
      exitBtn.style.display = 'none';
    }
  }
}

// دالة الخروج من البرنامج
async function exitApplication() {
  // ✅ التحقق من وجود منتجات في السلة
  if (typeof cart !== 'undefined' && cart.length > 0) {
    showToast(`⚠️ لا يمكن الخروج! يوجد ${cart.length} منتج في السلة. أتمم البيع أو أفرغ السلة أولاً.`, 'error', 5000);

    // تأثير اهتزاز على السلة للفت الانتباه
    const cartSection = document.querySelector('.cart-section, .pos-cart, #cartContainer');
    if (cartSection) {
      cartSection.style.animation = 'shake 0.5s ease-in-out';
      setTimeout(() => cartSection.style.animation = '', 500);
    }
    return;
  }

  const confirmed = await showConfirm('هل أنت متأكد من الخروج من البرنامج؟', 'تأكيد الخروج');
  if (confirmed) {
    // إغلاق التطبيق
    if (window.electronAPI && window.electronAPI.quitApp) {
      window.electronAPI.quitApp();
    } else if (window.close) {
      window.close();
    }
  }
}

// ═══════════════════════════════════════════════════════════════
// 🚀 INITIALIZATION
// ═══════════════════════════════════════════════════════════════

(function init() {
  Logger.log('🎯 POS System v3.0 - Multi-Store Support');
  Logger.log('⚡ Initializing...');

  // ═══════════════════════════════════════════════════════════════
  // 🚀 المرحلة 1: التهيئة الفورية (بدون انتظار) - أقل من 50ms
  // ═══════════════════════════════════════════════════════════════

  // ✅ تحديث زر التنقل حسب صلاحيات المستخدم
  updateNavButtonByRole();

  // 🆕 إعداد event listeners لنافذة فواتير نقطة البيع
  setupSalesHistoryEventListeners();

  // Initialize barcode scanner
  initBarcodeScanner();
  Logger.log('📷 Barcode scanner ready');

  // Initialize inventory tabs
  initInventoryTabs();
  Logger.log('📦 Inventory tabs initialized');

  // Render cart (من localStorage إن وجد)
  renderCart();

  // Setup deferred payment listeners
  const paidNowInput = document.getElementById('paidNowAmount');
  if (paidNowInput) {
    paidNowInput.addEventListener('input', updateRemainingAmount);
    paidNowInput.addEventListener('click', function() { this.focus(); });
    paidNowInput.addEventListener('focus', function() { this.select(); });
  }

  // Also update remaining when discounts change
  const discPctInput = document.getElementById('discPct');
  const discValInput = document.getElementById('discVal');
  if (discPctInput) discPctInput.addEventListener('input', updateRemainingAmount);
  if (discValInput) discValInput.addEventListener('input', updateRemainingAmount);

  // Show profit card only for admin
  const profitCard = document.getElementById('profitCard');
  if (profitCard) {
    const user = window.currentUser || JSON.parse(localStorage.getItem('currentUser') || '{}');
    if (user && user.role === 'admin') {
      profitCard.style.display = '';
    } else {
      profitCard.style.display = 'none';
    }
  }

  // Show held invoices count
  const heldCount = HeldInvoices.count();
  if (heldCount > 0) {
    setTimeout(() => {
      showToast(`يوجد ${heldCount} فاتورة معلقة (F5 لعرضها)`, 'info', 4000);
    }, 500);
  }

  Logger.log('✅ UI ready - loading data in background...');
  Logger.log('⌨️ Shortcuts: F1=Search, F2=Customer, F3=Clear, F4=Hold, F5=Held, Ctrl+Enter=Checkout');

  // ═══════════════════════════════════════════════════════════════
  // 🔄 المرحلة 2: تحميل البيانات في الخلفية (بدون blocking)
  // ═══════════════════════════════════════════════════════════════

  // استخدام requestIdleCallback للتحميل في وقت الفراغ
  const loadDataInBackground = async () => {
    const startTime = performance.now();

    await loadPosMainWarehouses();

    // تحميل الأجهزة أولاً (الأهم)
    search().then(() => {
      Logger.log('📱 Devices loaded');
    }).catch(err => Logger.error('Search failed:', err));

    // تحميل باقي البيانات بالتوازي
    Promise.allSettled([
      loadAccessoriesCount(),
      loadRepairPartsCount(),
      loadClients(),
      loadTodayCashPreview(),
      syncLastClosingTime(),
      loadTransferCommissionRates()
    ]).then(results => {
      const loadTime = (performance.now() - startTime).toFixed(0);
      Logger.log(`⚡ Background loading completed in ${loadTime}ms`);

      if (results[0].status === 'rejected') Logger.error('Accessories count failed:', results[0].reason);
      if (results[1].status === 'rejected') Logger.error('Clients failed:', results[1].reason);
      if (results[2].status === 'rejected') Logger.error('Cash preview failed:', results[2].reason);
      if (results[3].status === 'rejected') Logger.error('Sync closing time failed:', results[3].reason);
      if (results[5].status === 'rejected') Logger.error('Transfer commission rates failed:', results[5].reason);
    });
  };

  // تأخير التحميل قليلاً للسماح بعرض الواجهة أولاً
  if ('requestIdleCallback' in window) {
    requestIdleCallback(loadDataInBackground, { timeout: 100 });
  } else {
    setTimeout(loadDataInBackground, 10);
  }
})();

// ═══════════════════════════════════════════════════════════════
// 🏪 MULTI-STORE SYSTEM - Tabs & Accessories
// ═══════════════════════════════════════════════════════════════

// Initialize inventory tabs
function initInventoryTabs() {
  const tabs = document.querySelectorAll('.inventory-tab');
  const quickFilters = document.querySelector('.quick-filters');

  tabs.forEach(tab => {
    tab.addEventListener('click', async () => {
      // Update active state
      tabs.forEach(t => t.classList.remove('active'));
      tab.classList.add('active');

      // Get store type
      currentStore = tab.dataset.store;

      // Update UI based on store
      const accCategory = document.getElementById('accCategory');
      const repairPartCategory = document.getElementById('repairPartCategory');

      // Helper: show/hide transfer panel and product UI
      const transferPanel = document.getElementById('transferPanel');
      const cardsGrid = document.getElementById('cards');
      const searchContainer = document.querySelector('.search-container');
      const kpisSection = document.querySelector('.kpis');
      const emptyState = document.getElementById('empty');

      if (currentStore === 'transfers') {
        // Hide product-related UI
        if (quickFilters) quickFilters.style.display = 'none';
        if (cond) cond.style.display = 'none';
        if (accCategory) accCategory.style.display = 'none';
        if (repairPartCategory) repairPartCategory.style.display = 'none';
        if (cardsGrid) cardsGrid.style.display = 'none';
        if (searchContainer) searchContainer.style.display = 'none';
        if (kpisSection) kpisSection.style.display = 'none';
        if (emptyState) emptyState.style.display = 'none';
        // Show transfer panel
        if (transferPanel) transferPanel.style.display = 'flex';
        // Load transfer data
        await loadTransferData();
      } else {
        // Hide transfer panel, show product UI
        if (transferPanel) transferPanel.style.display = 'none';
        if (cardsGrid) cardsGrid.style.display = '';
        if (searchContainer) searchContainer.style.display = '';
        if (kpisSection) kpisSection.style.display = '';

        if (currentStore === 'accessories') {
          // Hide device-specific filters
          if (quickFilters) quickFilters.style.display = 'none';
          // Switch dropdowns: hide condition, show accessory category
          if (cond) cond.style.display = 'none';
          if (accCategory) accCategory.style.display = '';
          if (repairPartCategory) repairPartCategory.style.display = 'none';
          // Update search placeholder
          if (q) q.placeholder = '🔍 ابحث في الإكسسوارات...';
          // Load accessories
          await searchAccessories();
        } else if (currentStore === 'repair_parts') {
          // Hide device-specific filters
          if (quickFilters) quickFilters.style.display = 'none';
          // Switch dropdowns: hide condition, show repair parts category
          if (cond) cond.style.display = 'none';
          if (accCategory) accCategory.style.display = 'none';
          if (repairPartCategory) repairPartCategory.style.display = '';
          // Update search placeholder
          if (q) q.placeholder = '🔍 ابحث في قطع الغيار...';
          // Load repair parts
          await searchRepairParts();
        } else {
          // Show device filters
          if (quickFilters) quickFilters.style.display = 'flex';
          // Switch dropdowns: show condition, hide categories
          if (cond) cond.style.display = '';
          if (accCategory) accCategory.style.display = 'none';
          if (repairPartCategory) repairPartCategory.style.display = 'none';
          // Update search placeholder
          if (q) q.placeholder = '🔍 ابحث بالموديل أو IMEI...';
          // Load devices
          await search();
        }
      }

      SoundFX.play('scan');
    });
  });
}

// Load accessories count for tab badge (lightweight - count only)
async function loadAccessoriesCount() {
  try {
    await loadPosMainWarehouses();
    // ✅ استخدام count_only للسرعة - بدل ما يجيب كل الإكسسوارات يجيب رقم واحد بس
    let url = 'elos-db://accessories?count_only=true';
    if (posMainWarehouses.accessoriesId) {
      url += `&warehouse_id=${posMainWarehouses.accessoriesId}`;
    }
    const res = await fetch(url);
    if (res.ok) {
      const data = await res.json();
      const countEl = document.getElementById('accessoriesCount');
      if (countEl) countEl.textContent = data.count || 0;
    }
  } catch (error) {
    Logger.error('Error loading accessories count:', error);
  }
}

// Search accessories (server-side filtering for speed)
async function searchAccessories() {
  if (isLoading) return;
  isLoading = true;

  // Loading states
  UILoader.inputLoading(q, true);
  UILoader.buttonLoading(btnFind, true);
  showSearchLoading();

  const searchTerm = (q?.value || '').trim();
  const categoryFilter = document.getElementById('accCategory')?.value || '';

  try {
    await loadPosMainWarehouses();

    // ✅ بناء URL مع search parameters - الفلترة من السيرفر مباشرة
    let url = 'elos-db://accessories';
    const params = new URLSearchParams();
    if (searchTerm) {
      params.set('search', searchTerm);
    } else {
      // ✅ بدون بحث = أول تحميل → نجيب أول 200 بس عشان السرعة
      params.set('limit', '200');
    }
    if (posMainWarehouses.accessoriesId) params.set('warehouse_id', posMainWarehouses.accessoriesId);
    const queryStr = params.toString();
    if (queryStr) url += '?' + queryStr;

    const res = await fetch(url);
    if (!res.ok) throw new Error(await res.text());

    const data = await res.json();

    // Handle both array and {accessories: [...]} response
    let accessories = Array.isArray(data) ? data : (data.accessories || []);

    // Filter by category (client-side - lightweight since data is already filtered)
    if (categoryFilter) {
      accessories = accessories.filter(a =>
        (a.category || '').toLowerCase() === categoryFilter.toLowerCase()
      );
    }

    // Filter only in-stock items (safety check - server already filters)
    accessories = accessories.filter(a => (a.quantity || 0) > 0);

    // Sort by sales_count (most sold first)
    accessories.sort((a, b) => (b.sales_count || 0) - (a.sales_count || 0));

    accessoriesPool = accessories;

    // Update KPIs
    updateAccessoriesKPIs(accessories);

    // Render cards
    renderAccessoryCards(accessories);

  } catch (error) {
    Logger.error('Search accessories error:', error);
    showToast('خطأ في تحميل الإكسسوارات', 'error');
  } finally {
    hideSearchLoading();
    UILoader.inputLoading(q, false);
    UILoader.buttonLoading(btnFind, false);
    isLoading = false;
  }
}

// Update KPIs for accessories (✅ يجيب الإحصائيات الحقيقية من السيرفر)
async function updateAccessoriesKPIs(accessories) {
  try {
    let statsUrl = 'elos-db://accessories?action=pos-stats';
    if (posMainWarehouses.accessoriesId) statsUrl += `&warehouse_id=${posMainWarehouses.accessoriesId}`;
    const statsRes = await fetch(statsUrl);
    if (statsRes.ok) {
      const stats = await statsRes.json();
      if (kAvail) kAvail.textContent = stats.totalQty || 0;
      if (kAvgAsk) kAvgAsk.textContent = fmt(stats.avgPrice || 0);
      const countEl = document.getElementById('accessoriesCount');
      if (countEl) countEl.textContent = stats.itemCount || 0;
      return;
    }
  } catch (e) {
    Logger.error('Error loading accessories stats:', e);
  }
  // Fallback
  const totalItems = accessories.reduce((sum, a) => sum + (a.quantity || 0), 0);
  const avgPrice = accessories.length > 0
    ? accessories.reduce((sum, a) => sum + (a.sell_price || a.sale_price || 0), 0) / accessories.length
    : 0;
  if (kAvail) kAvail.textContent = totalItems;
  if (kAvgAsk) kAvgAsk.textContent = fmt(avgPrice);
  const countEl = document.getElementById('accessoriesCount');
  if (countEl) countEl.textContent = accessories.length;
}

// ✅ Helper: create single accessory card HTML
function createAccessoryCardHTML(acc) {
  const stock = acc.quantity || 0;
  const stockClass = stock <= 3 ? (stock === 0 ? 'out' : 'low') : '';
  const stockText = stock === 0 ? 'نفذ' : `متبقي ${stock}`;
  const sellPrice = acc.sell_price || acc.sale_price || 0;
  const inCart = cart.find(c => c.id === acc.id && c.type === 'accessory');
  const inCartQty = inCart ? inCart.qty : 0;
  const availableQty = stock - inCartQty;

  return `
    <div class="card accessory fade-in" data-id="${acc.id}">
      <div class="card-content">
        <div class="card-header">
          <div class="card-title">${escapeHtml(acc.name) || 'إكسسوار'}</div>
          <span class="card-badge badge-accessory">${escapeHtml(acc.category) || 'عام'}</span>
        </div>
        <div class="card-details">
          ${acc.code ? `<span class="card-detail">🏷️ ${escapeHtml(acc.code)}</span>` : ''}
          ${acc.barcode ? `<span class="card-detail">📊 ${escapeHtml(acc.barcode)}</span>` : ''}
          ${acc.supplier_name ? `<span class="card-detail">🏪 ${escapeHtml(acc.supplier_name)}</span>` : ''}
        </div>
        <div class="card-price">
          <span class="price-label">سعر البيع</span>
          <span class="price-value">${fmt(sellPrice)}</span>
        </div>
        <div class="qty-controls">
          <button class="qty-btn" onclick="event.stopPropagation(); changeAccessoryQty(${acc.id}, -1)" ${inCartQty <= 0 ? 'disabled' : ''}>−</button>
          <input type="number" class="qty-input" id="qty-${acc.id}" value="${inCartQty}" min="0" max="${stock}" readonly>
          <button class="qty-btn" onclick="event.stopPropagation(); changeAccessoryQty(${acc.id}, 1)" ${availableQty <= 0 ? 'disabled' : ''}>+</button>
          <span class="stock-info ${stockClass}">${stockText}</span>
        </div>
      </div>
    </div>
  `;
}

// ✅ Track visible count for accessories lazy loading
let accessoriesVisibleCount = 0;

// ✅ Load more accessories (lazy loading)
function loadMoreAccessories() {
  if (!cards) return;
  const nextBatch = accessoriesPool.slice(accessoriesVisibleCount, accessoriesVisibleCount + MAX_VISIBLE_CARDS);

  const loadMoreBtn = cards.querySelector('.load-more-btn');
  if (loadMoreBtn) loadMoreBtn.remove();

  const tempDiv = document.createElement('div');
  tempDiv.innerHTML = nextBatch.map(acc => createAccessoryCardHTML(acc)).join('');
  while (tempDiv.firstChild) {
    cards.appendChild(tempDiv.firstChild);
  }
  accessoriesVisibleCount += nextBatch.length;

  if (accessoriesVisibleCount < accessoriesPool.length) {
    const newBtn = document.createElement('button');
    newBtn.className = 'load-more-btn';
    newBtn.style.cssText = `width:100%;padding:16px 24px;margin-top:12px;background:linear-gradient(135deg,var(--brand) 0%,var(--purple) 100%);border:none;border-radius:12px;color:white;font-size:14px;font-weight:700;cursor:pointer;transition:all .3s ease;display:flex;align-items:center;justify-content:center;gap:8px;`;
    newBtn.innerHTML = `<span>🎧</span> تحميل المزيد (${accessoriesPool.length - accessoriesVisibleCount} إكسسوار إضافي)`;
    newBtn.onclick = () => loadMoreAccessories();
    cards.appendChild(newBtn);
  }
}

// ✅ Update single accessory card (without re-rendering ALL cards)
function updateAccessoryCard(accId) {
  const acc = accessoriesPool.find(a => a.id === accId);
  if (!acc) return;
  const cardEl = cards?.querySelector(`.card.accessory[data-id="${accId}"]`);
  if (!cardEl) return;

  const stock = acc.quantity || 0;
  const inCart = cart.find(c => c.id === accId && c.type === 'accessory');
  const inCartQty = inCart ? inCart.qty : 0;
  const availableQty = stock - inCartQty;
  const stockClass = stock <= 3 ? (stock === 0 ? 'out' : 'low') : '';
  const stockText = stock === 0 ? 'نفذ' : `متبقي ${stock}`;

  const qtyInput = cardEl.querySelector('.qty-input');
  if (qtyInput) qtyInput.value = inCartQty;

  const btns = cardEl.querySelectorAll('.qty-btn');
  if (btns[0]) btns[0].disabled = inCartQty <= 0;
  if (btns[1]) btns[1].disabled = availableQty <= 0;

  const stockInfo = cardEl.querySelector('.stock-info');
  if (stockInfo) {
    stockInfo.textContent = stockText;
    stockInfo.className = `stock-info ${stockClass}`;
  }
}

// Render accessory cards (✅ OPTIMIZED: show first batch only + "Load More")
function renderAccessoryCards(accessories) {
  if (!cards) return;
  
  if (accessories.length === 0) {
    cards.innerHTML = '';
    if (empty) {
      empty.querySelector('.empty-icon').textContent = '🎧';
      empty.querySelector('.empty-text').textContent = 'لا توجد إكسسوارات متاحة';
      empty.style.display = 'block';
    }
    return;
  }
  
  if (empty) empty.style.display = 'none';

  // ✅ عرض أول دفعة فقط (MAX_VISIBLE_CARDS = 100)
  const visibleAccessories = accessories.slice(0, MAX_VISIBLE_CARDS);
  accessoriesVisibleCount = visibleAccessories.length;

  cards.innerHTML = visibleAccessories.map(acc => createAccessoryCardHTML(acc)).join('');

  // ✅ زر "تحميل المزيد" لو فيه أصناف أكتر
  if (accessories.length > MAX_VISIBLE_CARDS) {
    const loadMoreBtn = document.createElement('button');
    loadMoreBtn.className = 'load-more-btn';
    loadMoreBtn.style.cssText = `width:100%;padding:16px 24px;margin-top:12px;background:linear-gradient(135deg,var(--brand) 0%,var(--purple) 100%);border:none;border-radius:12px;color:white;font-size:14px;font-weight:700;cursor:pointer;transition:all .3s ease;display:flex;align-items:center;justify-content:center;gap:8px;`;
    loadMoreBtn.innerHTML = `<span>🎧</span> تحميل المزيد (${accessories.length - MAX_VISIBLE_CARDS} إكسسوار إضافي)`;
    loadMoreBtn.onclick = () => loadMoreAccessories();
    cards.appendChild(loadMoreBtn);
  }

  initCardsEventDelegation();
}

// Change accessory quantity in cart
function changeAccessoryQty(accId, delta) {
  const acc = accessoriesPool.find(a => a.id === accId);
  if (!acc) return;
  
  // Get prices (handle different field names)
  const sellPrice = acc.sell_price || acc.sale_price || 0;
  const costPrice = acc.purchase_price || acc.cost_price || 0;
  
  const existingIndex = cart.findIndex(c => c.id === accId && c.type === 'accessory');
  const currentQty = existingIndex >= 0 ? cart[existingIndex].qty : 0;
  const newQty = Math.max(0, Math.min(acc.quantity, currentQty + delta));
  
  if (newQty === 0 && existingIndex >= 0) {
    // Remove from cart
    cart.splice(existingIndex, 1);
    SoundFX.play('remove');
  } else if (newQty > 0) {
    if (existingIndex >= 0) {
      // Update quantity
      cart[existingIndex].qty = newQty;
      cart[existingIndex].price = sellPrice * newQty;
      cart[existingIndex].cost = costPrice * newQty;
    } else {
      // Add to cart
      cart.push({
        id: acc.id,
        type: 'accessory',
        label: acc.name,
        category: acc.category,
        ask: sellPrice,
        price: sellPrice * newQty,
        cost: costPrice * newQty,
        qty: newQty,
        unitPrice: sellPrice,
        unitCost: costPrice,
        maxStock: acc.quantity
      });
    }
    SoundFX.play('add');
  }
  
  // Update displays
  renderCart();
  // ✅ تحديث card واحد فقط بدل إعادة رسم الـ 3,000 كلهم
  updateAccessoryCard(accId);

  // Show feedback
  if (delta > 0 && newQty > currentQty) {
    showToast(`تمت إضافة ${acc.name}`, 'success', 1500);
  }
}

// Update devices count
function updateDevicesCount(count) {
  const countEl = document.getElementById('devicesCount');
  if (countEl) countEl.textContent = count;
}

// ═══════════════════════════════════════════════════════════════
// 🔧 REPAIR PARTS - قطع الغيار
// ═══════════════════════════════════════════════════════════════

// Load repair parts count for tab badge (lightweight - count only)
async function loadRepairPartsCount() {
  try {
    await loadPosMainWarehouses();
    // ✅ استخدام count_only للسرعة - بدل ما يجيب كل الـ 2000+ صنف يجيب رقم واحد بس
    let url = 'elos-db://repair-parts?count_only=true';
    if (posMainWarehouses.repairPartsId) {
      url += `&warehouse_id=${posMainWarehouses.repairPartsId}`;
    }
    const res = await fetch(url);
    if (res.ok) {
      const data = await res.json();
      const countEl = document.getElementById('repairPartsCount');
      if (countEl) countEl.textContent = data.count || 0;
    }
  } catch (error) {
    Logger.error('Error loading repair parts count:', error);
  }
}

// Search repair parts (server-side filtering for speed)
async function searchRepairParts() {
  if (isLoading) return;
  isLoading = true;

  // Loading states
  UILoader.inputLoading(q, true);
  UILoader.buttonLoading(btnFind, true);
  showSearchLoading();

  const searchTerm = (q?.value || '').trim();
  const categoryFilter = document.getElementById('repairPartCategory')?.value || '';

  try {
    await loadPosMainWarehouses();

    // ✅ بناء URL مع search parameters - الفلترة من السيرفر مباشرة
    let url = 'elos-db://repair-parts';
    const params = new URLSearchParams();
    if (searchTerm) {
      params.set('search', searchTerm);
    } else {
      // ✅ بدون بحث = أول تحميل → نجيب أول 200 بس عشان السرعة
      params.set('limit', '200');
    }
    if (posMainWarehouses.repairPartsId) params.set('warehouse_id', posMainWarehouses.repairPartsId);
    const queryStr = params.toString();
    if (queryStr) url += '?' + queryStr;

    const res = await fetch(url);
    if (!res.ok) throw new Error(await res.text());

    const data = await res.json();
    let parts = Array.isArray(data) ? data : (data.parts || []);

    // Filter by category (client-side - lightweight since data is already filtered)
    if (categoryFilter) {
      parts = parts.filter(p =>
        (p.category || '').toLowerCase() === categoryFilter.toLowerCase()
      );
    }

    // Filter only in-stock items
    parts = parts.filter(p => (p.qty || p.quantity || 0) > 0);

    // Sort by sales_count (most sold first)
    parts.sort((a, b) => (b.sales_count || 0) - (a.sales_count || 0));

    repairPartsPool = parts;

    // Update KPIs
    updateRepairPartsKPIs(parts);

    // Render cards
    renderRepairPartCards(parts);

  } catch (error) {
    Logger.error('Search repair parts error:', error);
    showToast('خطأ في تحميل قطع الغيار', 'error');
  } finally {
    hideSearchLoading();
    UILoader.inputLoading(q, false);
    UILoader.buttonLoading(btnFind, false);
    isLoading = false;
  }
}

// Update KPIs for repair parts (✅ يجيب الإحصائيات الحقيقية من السيرفر)
async function updateRepairPartsKPIs(parts) {
  try {
    let statsUrl = 'elos-db://repair-parts?stats=true';
    if (posMainWarehouses.repairPartsId) statsUrl += `&warehouse_id=${posMainWarehouses.repairPartsId}`;
    const statsRes = await fetch(statsUrl);
    if (statsRes.ok) {
      const stats = await statsRes.json();
      if (kAvail) kAvail.textContent = stats.totalQty || 0;
      if (kAvgAsk) kAvgAsk.textContent = fmt(stats.avgPrice || 0);
      const countEl = document.getElementById('repairPartsCount');
      if (countEl) countEl.textContent = stats.itemCount || 0;
      return;
    }
  } catch (e) {
    Logger.error('Error loading repair parts stats:', e);
  }
  // Fallback
  const totalItems = parts.reduce((sum, p) => sum + (p.qty || p.quantity || 0), 0);
  const avgPrice = parts.length > 0
    ? parts.reduce((sum, p) => sum + (p.sell_price || 0), 0) / parts.length
    : 0;
  if (kAvail) kAvail.textContent = totalItems;
  if (kAvgAsk) kAvgAsk.textContent = fmt(avgPrice);
  const countEl = document.getElementById('repairPartsCount');
  if (countEl) countEl.textContent = parts.length;
}

// ✅ Helper: create single repair part card HTML
function createRepairPartCardHTML(part) {
  const stock = part.qty || part.quantity || 0;
  const stockClass = stock <= (part.min_qty || 3) ? (stock === 0 ? 'out' : 'low') : '';
  const stockText = stock === 0 ? 'نفذ' : `متبقي ${stock}`;
  const sellPrice = part.sell_price || 0;
  const inCart = cart.find(c => c.id === part.id && c.type === 'repair_part');
  const inCartQty = inCart ? inCart.qty : 0;
  const availableQty = stock - inCartQty;

  return `
    <div class="card repair-part fade-in" data-id="${part.id}">
      <div class="card-content">
        <div class="card-header">
          <div class="card-title">${escapeHtml(part.name) || 'قطعة غيار'}</div>
          <span class="card-badge badge-repair-part">${escapeHtml(part.category) || 'عام'}</span>
        </div>
        <div class="card-details">
          ${part.sku ? `<span class="card-detail">🏷️ ${escapeHtml(part.sku)}</span>` : ''}
          ${part.barcode ? `<span class="card-detail">📊 ${escapeHtml(part.barcode)}</span>` : ''}
          ${part.notes ? `<span class="card-detail">📝 ${escapeHtml(part.notes)}</span>` : ''}
        </div>
        <div class="card-price">
          <span class="price-label">سعر البيع</span>
          <span class="price-value">${fmt(sellPrice)}</span>
        </div>
        <div class="qty-controls">
          <button class="qty-btn" onclick="event.stopPropagation(); changeRepairPartQty(${part.id}, -1)" ${inCartQty <= 0 ? 'disabled' : ''}>−</button>
          <input type="number" class="qty-input" id="qty-rp-${part.id}" value="${inCartQty}" min="0" max="${stock}" readonly>
          <button class="qty-btn" onclick="event.stopPropagation(); changeRepairPartQty(${part.id}, 1)" ${availableQty <= 0 ? 'disabled' : ''}>+</button>
          <span class="stock-info ${stockClass}">${stockText}</span>
        </div>
      </div>
    </div>
  `;
}

// ✅ Track visible count for repair parts lazy loading
let repairPartsVisibleCount = 0;

// Render repair part cards (✅ OPTIMIZED: show first batch only + "Load More")
function renderRepairPartCards(parts) {
  if (!cards) return;

  if (parts.length === 0) {
    cards.innerHTML = '';
    if (empty) {
      empty.querySelector('.empty-icon').innerHTML = '<i data-lucide="wrench" style="width:64px;height:64px;color:var(--text-muted);"></i>';
      empty.querySelector('.empty-text').textContent = 'لا توجد قطع غيار متاحة';
      empty.style.display = 'block';
      lucide?.createIcons();
    }
    return;
  }

  if (empty) empty.style.display = 'none';

  // ✅ عرض أول دفعة فقط (MAX_VISIBLE_CARDS = 100)
  const visibleParts = parts.slice(0, MAX_VISIBLE_CARDS);
  repairPartsVisibleCount = visibleParts.length;

  cards.innerHTML = visibleParts.map(part => createRepairPartCardHTML(part)).join('');

  // ✅ زر "تحميل المزيد" لو فيه أصناف أكتر
  if (parts.length > MAX_VISIBLE_CARDS) {
    const loadMoreBtn = document.createElement('button');
    loadMoreBtn.className = 'load-more-btn';
    loadMoreBtn.style.cssText = `width:100%;padding:16px 24px;margin-top:12px;background:linear-gradient(135deg,var(--brand) 0%,var(--purple) 100%);border:none;border-radius:12px;color:white;font-size:14px;font-weight:700;cursor:pointer;transition:all .3s ease;display:flex;align-items:center;justify-content:center;gap:8px;`;
    loadMoreBtn.innerHTML = `<span>🔧</span> تحميل المزيد (${parts.length - MAX_VISIBLE_CARDS} قطعة إضافية)`;
    loadMoreBtn.onclick = () => loadMoreRepairParts();
    cards.appendChild(loadMoreBtn);
  }

  initCardsEventDelegation();
}

// ✅ Load more repair parts (lazy loading)
function loadMoreRepairParts() {
  if (!cards) return;
  const nextBatch = repairPartsPool.slice(repairPartsVisibleCount, repairPartsVisibleCount + MAX_VISIBLE_CARDS);

  // Remove old load more button
  const loadMoreBtn = cards.querySelector('.load-more-btn');
  if (loadMoreBtn) loadMoreBtn.remove();

  // Append new cards
  const tempDiv = document.createElement('div');
  tempDiv.innerHTML = nextBatch.map(part => createRepairPartCardHTML(part)).join('');
  while (tempDiv.firstChild) {
    cards.appendChild(tempDiv.firstChild);
  }
  repairPartsVisibleCount += nextBatch.length;

  // Add new load more button if needed
  if (repairPartsVisibleCount < repairPartsPool.length) {
    const newBtn = document.createElement('button');
    newBtn.className = 'load-more-btn';
    newBtn.style.cssText = `width:100%;padding:16px 24px;margin-top:12px;background:linear-gradient(135deg,var(--brand) 0%,var(--purple) 100%);border:none;border-radius:12px;color:white;font-size:14px;font-weight:700;cursor:pointer;transition:all .3s ease;display:flex;align-items:center;justify-content:center;gap:8px;`;
    newBtn.innerHTML = `<span>🔧</span> تحميل المزيد (${repairPartsPool.length - repairPartsVisibleCount} قطعة إضافية)`;
    newBtn.onclick = () => loadMoreRepairParts();
    cards.appendChild(newBtn);
  }
}

// ✅ Update single repair part card (without re-rendering ALL cards)
function updateRepairPartCard(partId) {
  const part = repairPartsPool.find(p => p.id === partId);
  if (!part) return;
  const cardEl = cards?.querySelector(`.card.repair-part[data-id="${partId}"]`);
  if (!cardEl) return; // Card not visible (not loaded yet)

  const stock = part.qty || part.quantity || 0;
  const inCart = cart.find(c => c.id === partId && c.type === 'repair_part');
  const inCartQty = inCart ? inCart.qty : 0;
  const availableQty = stock - inCartQty;
  const stockClass = stock <= (part.min_qty || 3) ? (stock === 0 ? 'out' : 'low') : '';
  const stockText = stock === 0 ? 'نفذ' : `متبقي ${stock}`;

  // Update qty input
  const qtyInput = cardEl.querySelector('.qty-input');
  if (qtyInput) qtyInput.value = inCartQty;

  // Update buttons disabled state
  const btns = cardEl.querySelectorAll('.qty-btn');
  if (btns[0]) btns[0].disabled = inCartQty <= 0;
  if (btns[1]) btns[1].disabled = availableQty <= 0;

  // Update stock info
  const stockInfo = cardEl.querySelector('.stock-info');
  if (stockInfo) {
    stockInfo.textContent = stockText;
    stockInfo.className = `stock-info ${stockClass}`;
  }
}

// Change repair part quantity in cart
function changeRepairPartQty(partId, delta) {
  const part = repairPartsPool.find(p => p.id === partId);
  if (!part) return;

  const sellPrice = part.sell_price || 0;
  const costPrice = part.purchase_price || 0;
  const stock = part.qty || part.quantity || 0;

  const existingIndex = cart.findIndex(c => c.id === partId && c.type === 'repair_part');
  const currentQty = existingIndex >= 0 ? cart[existingIndex].qty : 0;
  const newQty = Math.max(0, Math.min(stock, currentQty + delta));

  if (newQty === 0 && existingIndex >= 0) {
    // Remove from cart
    cart.splice(existingIndex, 1);
    SoundFX.play('remove');
  } else if (newQty > 0) {
    if (existingIndex >= 0) {
      // Update quantity
      cart[existingIndex].qty = newQty;
      cart[existingIndex].price = sellPrice * newQty;
      cart[existingIndex].cost = costPrice * newQty;
    } else {
      // Add to cart
      cart.push({
        id: part.id,
        type: 'repair_part',
        label: part.name,
        category: part.category,
        sku: part.sku,
        ask: sellPrice,
        price: sellPrice * newQty,
        cost: costPrice * newQty,
        qty: newQty,
        unitPrice: sellPrice,
        unitCost: costPrice,
        maxStock: stock,
        discount: 0
      });
    }
    SoundFX.play('add');
  }

  // Update displays
  renderCart();
  // ✅ تحديث card واحد فقط بدل إعادة رسم الـ 12,000 كلهم
  updateRepairPartCard(partId);

  // Show feedback
  if (delta > 0 && newQty > currentQty) {
    showToast(`تمت إضافة ${part.name}`, 'success', 1500);
  }
}

// ═══════════════════════════════════════════════════════════════
// 💰 CASH DRAWER - DEPOSIT / WITHDRAW SYSTEM
// ═══════════════════════════════════════════════════════════════
// Note: السحب والإيداع يتسجلوا مؤقتاً في localStorage
// وبعد تقفيل الشفت بيتسجلوا في الخزنة

// Local storage key for shift transactions - PER USER
// ✅ v1.2.3: دعم درج كاش منفصل لكل مستخدم
function getShiftTxKey() {
  const currentUser = window.currentUser || JSON.parse(localStorage.getItem('currentUser') || '{}');
  const userId = currentUser?.id || 'unknown';
  return `pos_shift_transactions_user_${userId}`;
}

// Get current shift transactions from localStorage
// ✅ PATCH 3: Use SessionCache for in-memory caching
function getShiftTransactions() {
  try {
    const SHIFT_TX_KEY = getShiftTxKey();
    const cached = SessionCache.get(SHIFT_TX_KEY);
    if (cached !== null) {
      return cached;
    }
    // Fallback to localStorage if not in cache
    const value = localStorage.getItem(SHIFT_TX_KEY);
    if (value !== null) {
      const parsed = JSON.parse(value);
      SessionCache._cache.set(SHIFT_TX_KEY, parsed); // Cache it
      return parsed;
    }
    return [];
  } catch {
    return [];
  }
}

// Save shift transactions to localStorage
// ✅ PATCH 3: Use SessionCache for deferred writes
function saveShiftTransactions(transactions) {
  const SHIFT_TX_KEY = getShiftTxKey();
  SessionCache.set(SHIFT_TX_KEY, transactions);
}

// Clear shift transactions (after closing)
function clearShiftTransactions() {
  const SHIFT_TX_KEY = getShiftTxKey();
  SessionCache.clear(SHIFT_TX_KEY);
}

// Quick Amount Helpers
function setQuickAmount(inputId, amount) {
  const input = document.getElementById(inputId);
  if (input) {
    input.value = amount;
    input.focus();
    input.dispatchEvent(new Event('input', { bubbles: true }));
  }
}

function addQuickAmount(inputId, amount) {
  const input = document.getElementById(inputId);
  if (input) {
    const currentValue = Number(input.value) || 0;
    input.value = currentValue + amount;
    input.focus();
    input.dispatchEvent(new Event('input', { bubbles: true }));
  }
}

// Open Deposit Modal
function openCashDepositModal() {
  // إغلاق أي مودالات مفتوحة أولاً (ما عدا cash drawer)
  ModalSystem.closeAll('cashDepositModal');

  document.getElementById('cashDepositModal').classList.add('show');
  document.getElementById('depositAmount').value = '';
  document.getElementById('depositCategory').value = 'ربح صافي'; // القيمة الافتراضية الجديدة
  document.getElementById('depositDescription').value = '';
  setTimeout(() => document.getElementById('depositAmount').focus(), 100);
}

// Close Deposit Modal
function closeCashDepositModal() {
  document.getElementById('cashDepositModal').classList.remove('show');
}

// Confirm Deposit - يحفظ مؤقتاً في localStorage
async function confirmCashDeposit() {
  const amount = Number(document.getElementById('depositAmount').value || 0);
  const category = document.getElementById('depositCategory').value;
  const description = document.getElementById('depositDescription').value.trim();
  
  if (amount <= 0) {
    showToast('الرجاء إدخال مبلغ صحيح', 'error');
    document.getElementById('depositAmount').focus();
    return;
  }
  
  // Save to localStorage (NOT to safe yet)
  const transactions = getShiftTransactions();
  transactions.push({
    id: Date.now(),
    type: 'deposit',
    amount: amount,
    category: category,
    description: description || category,
    created_at: new Date().toISOString()
  });
  saveShiftTransactions(transactions);
  
  // Close modal
  closeCashDepositModal();
  
  // Refresh cash drawer display
  await loadCashDrawerData();
  
  // Show success
  SoundFX.play('success');
  showToast(`✅ تم إضافة إيداع ${fmt(amount)} ج.م (سيُسجل في الخزنة عند التقفيل)`, 'success', 4000);
}

// Open Withdraw Modal
function openCashWithdrawModal() {
  // إغلاق أي مودالات مفتوحة أولاً (ما عدا cash drawer)
  ModalSystem.closeAll('cashWithdrawModal');

  document.getElementById('cashWithdrawModal').classList.add('show');
  document.getElementById('withdrawAmount').value = '';
  document.getElementById('withdrawCategory').value = 'أكل ومشروبات'; // الخيار الأول في القائمة الجديدة
  document.getElementById('withdrawDescription').value = '';
  setTimeout(() => document.getElementById('withdrawAmount').focus(), 100);
}

// Close Withdraw Modal
function closeCashWithdrawModal() {
  document.getElementById('cashWithdrawModal').classList.remove('show');
}

// Confirm Withdraw - يحفظ مؤقتاً في localStorage
async function confirmCashWithdraw() {
  const amount = Number(document.getElementById('withdrawAmount').value || 0);
  const category = document.getElementById('withdrawCategory').value;
  const description = document.getElementById('withdrawDescription').value.trim();
  
  if (amount <= 0) {
    showToast('الرجاء إدخال مبلغ صحيح', 'error');
    document.getElementById('withdrawAmount').focus();
    return;
  }
  
  // Save to localStorage (NOT to safe yet)
  const transactions = getShiftTransactions();
  transactions.push({
    id: Date.now(),
    type: 'withdraw',
    amount: amount,
    category: category,
    description: description || category,
    created_at: new Date().toISOString()
  });
  saveShiftTransactions(transactions);
  
  // Close modal
  closeCashWithdrawModal();
  
  // Refresh cash drawer display
  await loadCashDrawerData();
  
  // Show success
  SoundFX.play('success');
  showToast(`✅ تم تسجيل سحب ${fmt(amount)} ج.م (سيُسجل في الخزنة عند التقفيل)`, 'success', 4000);
}

// ═══════════════════════════════════════════════════════════════
// 🆕 WALLET-SPECIFIC DEPOSIT/WITHDRAW FUNCTIONS
// ═══════════════════════════════════════════════════════════════

// Current transaction state
let currentWalletTxType = 'deposit'; // 'deposit' or 'withdraw'
let currentWalletTxWallet = 'cash'; // 'cash', 'mobile_wallet', 'bank'

// Wallet names for display
const walletNames = {
  'cash': { name: 'كاش سائل', icon: '💵', color: '#10b981' },
  'mobile_wallet': { name: 'محفظة إلكترونية', icon: '📱', color: '#8b5cf6' },
  'bank': { name: 'حساب بنكي', icon: '🏦', color: '#3b82f6' }
};

// Open Wallet Deposit Modal (by type - للتوافق العكسي)
function openWalletDepositModal(walletType) {
  // البحث عن المحفظة الافتراضية لهذا النوع
  const defaultWallet = paymentWallets.find(w => w.type === walletType && w.is_default);
  if (defaultWallet) {
    openWalletDepositModalById(defaultWallet.id);
  } else {
    // Fallback للكود القديم
    currentWalletTxType = 'deposit';
    currentWalletTxWallet = walletType;
    const wallet = walletNames[walletType];
    const modal = document.getElementById('walletTransactionModal');
    const header = document.getElementById('walletTxHeader');
    document.getElementById('walletTxIcon').textContent = '📥';
    document.getElementById('walletTxTitle').textContent = `إيداع في ${wallet.name}`;
    document.getElementById('walletIndicatorIcon').textContent = wallet.icon;
    document.getElementById('walletIndicatorName').textContent = wallet.name;
    header.style.background = `linear-gradient(135deg, ${wallet.color} 0%, ${wallet.color}dd 100%)`;
    document.getElementById('walletTxBanner').className = 'cash-tx-info-banner success';
    document.getElementById('walletTxBannerIcon').textContent = '💡';
    document.getElementById('walletTxBannerText').textContent = `المبلغ سيُضاف إلى ${wallet.name}`;
    const confirmBtn = document.getElementById('walletTxConfirmBtn');
    confirmBtn.className = 'cash-tx-btn confirm-deposit';
    document.getElementById('walletTxConfirmText').textContent = 'تأكيد الإيداع';
    const categorySelect = document.getElementById('walletTxCategory');
    categorySelect.innerHTML = `
      <option value="إيداع">📥 إيداع عادي</option>
      <option value="ربح صافي">💵 ربح صافي</option>
      <option value="تحصيل">💳 تحصيل دين</option>
      <option value="أخرى">📝 أخرى</option>
    `;
    document.getElementById('walletTxAmount').value = '';
    document.getElementById('walletTxDescription').value = '';
    modal.classList.add('show');
    setTimeout(() => document.getElementById('walletTxAmount').focus(), 100);
  }
}

// Open Wallet Deposit Modal (by ID - للمحافظ الجديدة)
async function openWalletDepositModalById(walletId) {
  if (paymentWallets.length === 0) {
    await loadPaymentWallets();
  }
  
  const wallet = paymentWallets.find(w => w.id === walletId);
  if (!wallet) {
    showToast('المحفظة غير موجودة', 'error');
    return;
  }
  
  currentWalletTxType = 'deposit';
  currentWalletTxWallet = wallet.id; // حفظ ID بدلاً من type
  
  const walletIcon = wallet.type === 'cash' ? '💵' : wallet.type === 'mobile_wallet' ? '📱' : '🏦';
  const walletColor = wallet.type === 'cash' ? '#10b981' : wallet.type === 'mobile_wallet' ? '#8b5cf6' : '#3b82f6';
  
  const modal = document.getElementById('walletTransactionModal');
  const header = document.getElementById('walletTxHeader');
  
  document.getElementById('walletTxIcon').textContent = '📥';
  document.getElementById('walletTxTitle').textContent = `إيداع في ${wallet.name}`;
  document.getElementById('walletIndicatorIcon').textContent = walletIcon;
  document.getElementById('walletIndicatorName').textContent = wallet.name;
  header.style.background = `linear-gradient(135deg, ${walletColor} 0%, ${walletColor}dd 100%)`;
  document.getElementById('walletTxBanner').className = 'cash-tx-info-banner success';
  document.getElementById('walletTxBannerIcon').textContent = '💡';
  document.getElementById('walletTxBannerText').textContent = `المبلغ سيُضاف إلى ${wallet.name}`;
  const confirmBtn = document.getElementById('walletTxConfirmBtn');
  confirmBtn.className = 'cash-tx-btn confirm-deposit';
  document.getElementById('walletTxConfirmText').textContent = 'تأكيد الإيداع';
  const categorySelect = document.getElementById('walletTxCategory');
  categorySelect.innerHTML = `
    <option value="إيداع">📥 إيداع عادي</option>
    <option value="ربح صافي">💵 ربح صافي</option>
    <option value="تحصيل">💳 تحصيل دين</option>
    <option value="أخرى">📝 أخرى</option>
  `;
  document.getElementById('walletTxAmount').value = '';
  document.getElementById('walletTxDescription').value = '';
  modal.classList.add('show');
  setTimeout(() => document.getElementById('walletTxAmount').focus(), 100);
}

// Open Wallet Withdraw Modal (by type - للتوافق العكسي)
function openWalletWithdrawModal(walletType) {
  // البحث عن المحفظة الافتراضية لهذا النوع
  const defaultWallet = paymentWallets.find(w => w.type === walletType && w.is_default);
  if (defaultWallet) {
    openWalletWithdrawModalById(defaultWallet.id);
  } else {
    // Fallback للكود القديم
    currentWalletTxType = 'withdraw';
    currentWalletTxWallet = walletType;
    const wallet = walletNames[walletType];
    const modal = document.getElementById('walletTransactionModal');
    const header = document.getElementById('walletTxHeader');
    document.getElementById('walletTxIcon').textContent = '📤';
    document.getElementById('walletTxTitle').textContent = `سحب من ${wallet.name}`;
    document.getElementById('walletIndicatorIcon').textContent = wallet.icon;
    document.getElementById('walletIndicatorName').textContent = wallet.name;
    header.style.background = 'linear-gradient(135deg, #ef4444 0%, #dc2626 100%)';
    document.getElementById('walletTxBanner').className = 'cash-tx-info-banner warning';
    document.getElementById('walletTxBannerIcon').textContent = '📊';
    document.getElementById('walletTxBannerText').textContent = `المبلغ سيُخصم من ${wallet.name}`;
    const confirmBtn = document.getElementById('walletTxConfirmBtn');
    confirmBtn.className = 'cash-tx-btn confirm-withdraw';
    document.getElementById('walletTxConfirmText').textContent = 'تأكيد السحب';
    const categorySelect = document.getElementById('walletTxCategory');
    categorySelect.innerHTML = `
      <option value="سحب">📤 سحب عادي</option>
      <option value="مصروف">💸 مصروف</option>
      <option value="سحب شخصي">👤 سحب شخصي</option>
      <option value="أخرى">📝 أخرى</option>
    `;
    document.getElementById('walletTxAmount').value = '';
    document.getElementById('walletTxDescription').value = '';
    modal.classList.add('show');
    setTimeout(() => document.getElementById('walletTxAmount').focus(), 100);
  }
}

// Open Wallet Withdraw Modal (by ID - للمحافظ الجديدة)
async function openWalletWithdrawModalById(walletId) {
  if (paymentWallets.length === 0) {
    await loadPaymentWallets();
  }
  
  const wallet = paymentWallets.find(w => w.id === walletId);
  if (!wallet) {
    showToast('المحفظة غير موجودة', 'error');
    return;
  }
  
  currentWalletTxType = 'withdraw';
  currentWalletTxWallet = wallet.id; // حفظ ID بدلاً من type
  
  const walletIcon = wallet.type === 'cash' ? '💵' : wallet.type === 'mobile_wallet' ? '📱' : '🏦';
  
  const modal = document.getElementById('walletTransactionModal');
  const header = document.getElementById('walletTxHeader');
  
  document.getElementById('walletTxIcon').textContent = '📤';
  document.getElementById('walletTxTitle').textContent = `سحب من ${wallet.name}`;
  document.getElementById('walletIndicatorIcon').textContent = walletIcon;
  document.getElementById('walletIndicatorName').textContent = wallet.name;
  header.style.background = 'linear-gradient(135deg, #ef4444 0%, #dc2626 100%)';
  document.getElementById('walletTxBanner').className = 'cash-tx-info-banner warning';
  document.getElementById('walletTxBannerIcon').textContent = '📊';
  document.getElementById('walletTxBannerText').textContent = `المبلغ سيُخصم من ${wallet.name}`;
  const confirmBtn = document.getElementById('walletTxConfirmBtn');
  confirmBtn.className = 'cash-tx-btn confirm-withdraw';
  document.getElementById('walletTxConfirmText').textContent = 'تأكيد السحب';
  const categorySelect = document.getElementById('walletTxCategory');
  categorySelect.innerHTML = `
    <option value="سحب">📤 سحب عادي</option>
    <option value="مصروف">💸 مصروف</option>
    <option value="سحب شخصي">👤 سحب شخصي</option>
    <option value="أخرى">📝 أخرى</option>
  `;
  document.getElementById('walletTxAmount').value = '';
  document.getElementById('walletTxDescription').value = '';
  modal.classList.add('show');
  setTimeout(() => document.getElementById('walletTxAmount').focus(), 100);
}

// Close Wallet Transaction Modal
function closeWalletTransactionModal() {
  document.getElementById('walletTransactionModal').classList.remove('show');
}

// Confirm Wallet Transaction
async function confirmWalletTransaction() {
  const amount = Number(document.getElementById('walletTxAmount').value || 0);
  const category = document.getElementById('walletTxCategory').value;
  const description = document.getElementById('walletTxDescription').value.trim();

  if (amount <= 0) {
    showToast('الرجاء إدخال مبلغ صحيح', 'error');
    document.getElementById('walletTxAmount').focus();
    return;
  }

  // ✅ تحديد wallet_id و wallet_type
  let walletId = null;
  let walletType = currentWalletTxWallet;
  let wallet = null;
  
  // إذا كان currentWalletTxWallet رقم (ID)، استخدمه مباشرة
  if (typeof currentWalletTxWallet === 'number' || !isNaN(parseInt(currentWalletTxWallet))) {
    walletId = parseInt(currentWalletTxWallet);
    wallet = paymentWallets.find(w => w.id === walletId);
    if (wallet) {
      walletType = wallet.type;
    } else {
      // Fallback للتوافق العكسي
      wallet = walletNames[walletType] || { name: 'محفظة', icon: '💵' };
    }
  } else {
    // للتوافق العكسي: البحث عن المحفظة الافتراضية لهذا النوع
    const defaultWallet = paymentWallets.find(w => w.type === currentWalletTxWallet && w.is_default);
    if (defaultWallet) {
      walletId = defaultWallet.id;
      wallet = defaultWallet;
    } else {
      wallet = walletNames[currentWalletTxWallet] || { name: 'محفظة', icon: '💵' };
    }
  }

  // Save to localStorage with wallet info
  const transactions = getShiftTransactions();
  transactions.push({
    id: Date.now(),
    type: currentWalletTxType,
    wallet: walletType, // للتوافق العكسي
    wallet_id: walletId, // ✅ المحفظة المحددة
    amount: amount,
    category: category,
    description: description || `${category} - ${wallet.name}`,
    created_at: new Date().toISOString()
  });
  saveShiftTransactions(transactions);

  // Close modal
  closeWalletTransactionModal();

  // Refresh cash drawer display
  await loadCashDrawerData();

  // Show success
  SoundFX.play('success');
  const action = currentWalletTxType === 'deposit' ? 'إيداع' : 'سحب';
  showToast(`✅ تم ${action} ${fmt(amount)} ج.م في ${wallet.name}`, 'success', 4000);
}

// ═══════════════════════════════════════════════════════════════
// 📋 WALLET HISTORY MODAL - سجل معاملات المحفظة
// ═══════════════════════════════════════════════════════════════

// Open Wallet History Modal (by wallet ID)
async function openWalletHistoryModal(walletId, walletName) {
  try {
    // جلب معاملات المحفظة من cash_ledger - فقط للمستخدم الحالي والشيفت الحالي
    const currentUser = window.currentUser || JSON.parse(localStorage.getItem('currentUser') || '{}');
    const userId = currentUser.id;

    // ✅ FIX: فلترة بعد آخر تقفيل (الشيفت الحالي فقط)
    const closingTimeKey = getLastClosingTimeKey();
    const lastClosingTime = SessionCache.get(closingTimeKey, false) || null;
    let url = `elos-db://cash-ledger?wallet_id=${walletId}&user_id=${userId}&limit=50`;
    if (lastClosingTime) {
      url += `&after=${encodeURIComponent(lastClosingTime)}`;
    }

    const res = await fetch(url);
    if (!res.ok) throw new Error('فشل تحميل سجل المعاملات');

    // ✅ معاملات من الداتابيز
    const dbTransactions = await res.json();

    // ✅ إثراء مبيعات الأجهزة القديمة (اللي note بتاعتها sale#ID بدون تفاصيل)
    // نستخدم بيانات المبيعات المحمّلة فعلاً في currentCashData
    const deviceSalesMap = {};
    if (currentCashData && currentCashData.deviceSales) {
      currentCashData.deviceSales.forEach(s => { deviceSalesMap[s.id] = s; });
    }
    dbTransactions.forEach(tx => {
      if (tx.ref === 'sale' && tx.note) {
        const m = tx.note.match(/^sale#(\d+)/);
        if (m) {
          const sale = deviceSalesMap[Number(m[1])];
          if (sale) {
            const devLabel = [sale.type || sale.device_type, sale.model || sale.device_model, sale.storage || sale.device_storage, sale.color || sale.device_color].filter(Boolean).join(' - ');
            if (devLabel) {
              tx.note = `بيع ${devLabel} - فاتورة#${m[1]}`;
            }
          }
        }
      }
    });

    // ✅ FIX: دمج معاملات localStorage (الإيداعات والسحوبات اليدوية) مع معاملات DB
    const shiftTx = getShiftTransactions();
    const localTxForWallet = shiftTx.filter(tx => {
      if (tx.type === 'wallet_transfer') return false; // التحويلات تظهر بشكل مختلف
      return tx.wallet_id === walletId || tx.wallet_id === String(walletId);
    }).map(tx => ({
      kind: tx.type === 'deposit' || tx.type === 'client_payment' ? 'in' : 'out',
      amount: tx.amount,
      note: tx.description || tx.category || (tx.type === 'deposit' ? 'إيداع' : 'سحب'),
      ref: tx.type,
      created_at: tx.created_at,
      _isLocal: true
    }));

    // دمج وترتيب حسب التاريخ (الأحدث أولاً)
    const transactions = [...dbTransactions, ...localTxForWallet]
      .sort((a, b) => new Date(b.created_at) - new Date(a.created_at));

    // إنشاء المودال
    let modalEl = document.getElementById('walletHistoryModal');
    if (!modalEl) {
      modalEl = document.createElement('div');
      modalEl.id = 'walletHistoryModal';
      modalEl.className = 'drawer-modal-overlay';
      document.body.appendChild(modalEl);
    }

    // محتوى المودال
    modalEl.innerHTML = `
      <div class="drawer-modal-container" style="max-width: 600px;">
        <div class="drawer-modal-header" style="background: linear-gradient(135deg, #3b82f6 0%, #2563eb 100%);">
          <div class="drawer-header-right">
            <div class="drawer-header-icon">📋</div>
            <div class="drawer-header-info">
              <h2 style="margin: 0; font-size: 18px;">سجل معاملات ${escapeHtml(walletName)}</h2>
              <span style="font-size: 12px; opacity: 0.9;">${transactions.length} معاملة</span>
            </div>
          </div>
          <button onclick="closeWalletHistoryModal()" style="background: rgba(255,255,255,0.2); border: none; color: white; width: 36px; height: 36px; border-radius: 50%; cursor: pointer; font-size: 20px;">×</button>
        </div>
        <div style="max-height: 400px; overflow-y: auto; padding: 16px;">
          ${transactions.length === 0 ?
            '<div style="text-align: center; padding: 40px; color: var(--muted);">لا توجد معاملات</div>' :
            transactions.map(tx => {
              const isIn = tx.kind === 'in';
              const color = isIn ? '#10b981' : '#ef4444';
              const sign = isIn ? '+' : '-';
              const time = tx.created_at ? new Date(tx.created_at).toLocaleString('ar-EG', {
                day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit'
              }) : '';

              // تحديد الأيقونة والعنوان حسب نوع المعاملة
              let txIcon = isIn ? '📥' : '📤';
              let txLabel = tx.note || tx.ref || (isIn ? 'إيداع' : 'سحب');
              if (tx.ref === 'sale' && tx.note && tx.note.startsWith('sale#')) {
                txIcon = '📱'; txLabel = 'بيع جهاز - فاتورة' + tx.note.replace('sale', '');
              } else if (tx.ref === 'sale' && tx.note && tx.note.startsWith('بيع')) {
                txIcon = '📱';
              } else if (tx.ref && tx.ref.startsWith('accessory_sale_')) {
                txIcon = '🛒';
              } else if (tx.ref && tx.ref.startsWith('repair_part_sale_')) {
                txIcon = '🔧';
              } else if (tx.ref === 'return' || tx.ref === 'accessory_return' || tx.ref === 'repair_part_return' || tx.ref === 'cancel') {
                txIcon = '↩️'; txLabel = (tx.ref === 'cancel' ? 'إلغاء' : 'مرتجع') + ' - ' + (tx.note || '');
              } else if (tx.ref === 'deposit' || tx.type === 'deposit') {
                txIcon = '💰';
              } else if (tx.ref === 'withdraw' || tx.type === 'withdraw') {
                txIcon = '💸';
              }

              return `
                <div style="display: flex; justify-content: space-between; align-items: center; padding: 12px; border-bottom: 1px solid var(--line); gap: 10px;">
                  <div style="display: flex; align-items: center; gap: 10px; flex: 1;">
                    <span style="font-size: 20px;">${txIcon}</span>
                    <div>
                      <div style="font-weight: 600; font-size: 13px;">${escapeHtml(txLabel)}</div>
                      <div style="font-size: 11px; color: var(--muted);">${time}</div>
                    </div>
                  </div>
                  <div style="font-weight: 700; font-size: 14px; color: ${color};">
                    ${sign}${fmt(tx.amount)}
                  </div>
                </div>
              `;
            }).join('')
          }
        </div>
        <div style="padding: 16px; border-top: 1px solid var(--line);">
          <button onclick="closeWalletHistoryModal()" style="width: 100%; padding: 12px; background: var(--line); color: var(--ink); border: none; border-radius: 8px; cursor: pointer; font-weight: 600;">
            إغلاق
          </button>
        </div>
      </div>
    `;

    modalEl.style.display = 'flex';
    modalEl.style.zIndex = '10001';

  } catch (error) {
    console.error('Error loading wallet history:', error);
    showToast('خطأ في تحميل سجل المعاملات', 'error');
  }
}

// Close Wallet History Modal
function closeWalletHistoryModal() {
  const modal = document.getElementById('walletHistoryModal');
  if (modal) modal.style.display = 'none';
}

// ═══════════════════════════════════════════════════════════════
// 🆕 WALLET TRANSFER FUNCTIONS
// ═══════════════════════════════════════════════════════════════

// Open Wallet Transfer Modal (by wallet ID)
async function openWalletTransferModal(fromWalletId = null) {
  const modal = document.getElementById('walletTransferModal');
  
  // تحميل المحافظ إذا لم تكن محملة
  if (paymentWallets.length === 0) {
    await loadPaymentWallets();
  }
  
  // تحديث dropdowns للمحافظ
  const fromSelect = document.getElementById('transferFromWallet');
  const toSelect = document.getElementById('transferToWallet');
  
  if (fromSelect && toSelect) {
    // ملء قائمة المحافظ
    fromSelect.innerHTML = '';
    toSelect.innerHTML = '';
    
    paymentWallets.forEach(wallet => {
      const icon = wallet.type === 'cash' ? '💵' : wallet.type === 'mobile_wallet' ? '📱' : '🏦';
      const optionFrom = document.createElement('option');
      optionFrom.value = wallet.id;
      optionFrom.textContent = `${icon} ${wallet.name}${wallet.is_default ? ' (افتراضي)' : ''}`;
      if (fromWalletId && wallet.id === fromWalletId) {
        optionFrom.selected = true;
      }
      fromSelect.appendChild(optionFrom);
      
      const optionTo = document.createElement('option');
      optionTo.value = wallet.id;
      optionTo.textContent = `${icon} ${wallet.name}${wallet.is_default ? ' (افتراضي)' : ''}`;
      toSelect.appendChild(optionTo);
    });
    
    // تحديد القيم الافتراضية
    if (!fromWalletId) {
      const defaultCash = paymentWallets.find(w => w.type === 'cash' && w.is_default);
      const defaultMobile = paymentWallets.find(w => w.type === 'mobile_wallet' && w.is_default);
      if (defaultCash) fromSelect.value = defaultCash.id;
      if (defaultMobile) toSelect.value = defaultMobile.id;
    }
  }

  // Reset form
  document.getElementById('transferAmount').value = '';
  document.getElementById('transferReason').value = '';

  // تحميل البيانات دائماً للتأكد من وجود أرصدة محدثة
  try {
    await loadCashDrawerData();
  } catch (err) {
    console.error('[TRANSFER] Error loading cash drawer data:', err);
  }

  // Update balances
  updateTransferBalances();

  // Show modal
  modal.classList.add('show');
  setTimeout(() => document.getElementById('transferAmount').focus(), 100);
}

// Close Wallet Transfer Modal
function closeWalletTransferModal() {
  document.getElementById('walletTransferModal').classList.remove('show');
}

// Update Transfer Balances Display
function updateTransferBalances() {
  const fromWalletId = parseInt(document.getElementById('transferFromWallet').value);
  const toWalletId = parseInt(document.getElementById('transferToWallet').value);

  // ✅ الحصول على الأرصدة من المحافظ الفعلية
  let fromBalance = 0;
  let toBalance = 0;
  
  if (currentCashData && currentCashData.walletsMap) {
    if (currentCashData.walletsMap[fromWalletId]) {
      fromBalance = currentCashData.walletsMap[fromWalletId].balance || 0;
    }
    if (currentCashData.walletsMap[toWalletId]) {
      toBalance = currentCashData.walletsMap[toWalletId].balance || 0;
    }
  } else {
    // Fallback للتوافق العكسي
    const balances = getCurrentWalletBalances();
    const fromWallet = paymentWallets.find(w => w.id === fromWalletId);
    const toWallet = paymentWallets.find(w => w.id === toWalletId);
    if (fromWallet) fromBalance = balances[fromWallet.type] || 0;
    if (toWallet) toBalance = balances[toWallet.type] || 0;
  }

  document.getElementById('transferFromBalance').textContent = fmt(fromBalance);
  document.getElementById('transferToBalance').textContent = fmt(toBalance);
}

// Get Current Wallet Balances (للتوافق العكسي)
function getCurrentWalletBalances() {
  // Use currentCashData if available
  if (currentCashData) {
    return {
      cash: currentCashData.cashTotal || 0,
      mobile_wallet: currentCashData.mobileTotal || 0,
      bank: currentCashData.bankTotal || 0
    };
  }
  return { cash: 0, mobile_wallet: 0, bank: 0 };
}

// Set Transfer All Amount
function setTransferAllAmount() {
  const fromWalletId = parseInt(document.getElementById('transferFromWallet').value);
  let maxAmount = 0;
  
  if (currentCashData && currentCashData.walletsMap && currentCashData.walletsMap[fromWalletId]) {
    maxAmount = currentCashData.walletsMap[fromWalletId].balance || 0;
  } else {
    // Fallback للتوافق العكسي
    const fromWallet = paymentWallets.find(w => w.id === fromWalletId);
    if (fromWallet) {
      const balances = getCurrentWalletBalances();
      maxAmount = balances[fromWallet.type] || 0;
    }
  }
  
  document.getElementById('transferAmount').value = maxAmount > 0 ? maxAmount : '';
}

// Confirm Wallet Transfer
async function confirmWalletTransfer() {
  const fromWalletId = parseInt(document.getElementById('transferFromWallet').value);
  const toWalletId = parseInt(document.getElementById('transferToWallet').value);
  const amount = Number(document.getElementById('transferAmount').value || 0);
  const reason = document.getElementById('transferReason').value.trim();

  // Validation
  if (fromWalletId === toWalletId) {
    showToast('يجب اختيار محفظتين مختلفتين', 'error');
    return;
  }

  if (amount <= 0) {
    showToast('الرجاء إدخال مبلغ صحيح', 'error');
    document.getElementById('transferAmount').focus();
    return;
  }

  // ✅ الحصول على معلومات المحافظ
  const fromWallet = paymentWallets.find(w => w.id === fromWalletId);
  const toWallet = paymentWallets.find(w => w.id === toWalletId);
  
  if (!fromWallet || !toWallet) {
    showToast('المحفظة غير موجودة', 'error');
    return;
  }

  // Check balance
  let fromBalance = 0;
  if (currentCashData && currentCashData.walletsMap && currentCashData.walletsMap[fromWalletId]) {
    fromBalance = currentCashData.walletsMap[fromWalletId].balance || 0;
  } else {
    const balances = getCurrentWalletBalances();
    fromBalance = balances[fromWallet.type] || 0;
  }
  
  if (amount > fromBalance) {
    showToast(`الرصيد غير كافي في ${fromWallet.name}`, 'error');
    return;
  }

  const timestamp = new Date().toISOString();
  const transferId = Date.now();

  // 🔧 التحويل بين محافظ الدرج = نقل داخلي فقط
  // ⚠️ لا يُسجل في cash_ledger لأنه ليس له علاقة بالخزينة الرئيسية
  // ⚠️ عند التقفيل فقط، أرصدة المحافظ تُضاف للخزينة الرئيسية

  // Save as single transfer transaction in localStorage (for shift display)
  const transactions = getShiftTransactions();

  // قيد واحد للتحويل (من محفظة لمحفظة) مع wallet_id
  transactions.push({
    id: transferId,
    type: 'wallet_transfer',
    fromWallet: fromWallet.type, // للتوافق العكسي
    toWallet: toWallet.type, // للتوافق العكسي
    fromWalletId: fromWalletId, // ✅ المحفظة المحددة
    toWalletId: toWalletId, // ✅ المحفظة المحددة
    amount: amount,
    category: 'تحويل',
    description: `تحويل من ${fromWallet.name} إلى ${toWallet.name}${reason ? ': ' + reason : ''}`,
    created_at: timestamp
  });

  saveShiftTransactions(transactions);

  // Close modal
  closeWalletTransferModal();

  // Refresh cash drawer display
  await loadCashDrawerData();

  // Show success
  SoundFX.play('success');
  showToast(`✅ تم تحويل ${fmt(amount)} ج.م من ${fromWallet.name} إلى ${toWallet.name}`, 'success', 5000);
}

// Event listeners for transfer wallet selects
document.getElementById('transferFromWallet')?.addEventListener('change', updateTransferBalances);
document.getElementById('transferToWallet')?.addEventListener('change', updateTransferBalances);

// ═══════════════════════════════════════════════════════════════
// 🏦 SAFE TO DRAWER - سحب من الخزنة لدرج الكاش
// ═══════════════════════════════════════════════════════════════

async function openSafeToDrawerModal() {
  const modal = document.getElementById('safeToDrawerModal');
  if (!modal) return;

  // تحميل المحافظ إذا لم تكن محملة
  if (paymentWallets.length === 0) {
    await loadPaymentWallets();
  }

  // ملء dropdown المحافظ
  const walletSelect = document.getElementById('safeToDrawerWallet');
  if (walletSelect) {
    walletSelect.innerHTML = '';
    paymentWallets.filter(w => w.is_active !== 0).forEach(wallet => {
      const icon = wallet.type === 'cash' ? '💵' : wallet.type === 'mobile_wallet' ? '📱' : '🏦';
      const opt = document.createElement('option');
      opt.value = wallet.id;
      opt.textContent = `${icon} ${wallet.name}${wallet.is_default ? ' (افتراضي)' : ''}`;
      walletSelect.appendChild(opt);
    });
    // اختيار الكاش الافتراضي
    const defaultCash = paymentWallets.find(w => w.type === 'cash' && w.is_default);
    if (defaultCash) walletSelect.value = defaultCash.id;
  }

  // جلب أرصدة محافظ الخزنة (لكل محفظة على حدة)
  try {
    const res = await fetch('elos-db://safe-balance');
    if (res.ok) {
      const data = await res.json();
      // تخزين أرصدة المحافظ لاستخدامها عند تغيير المحفظة المختارة
      window._safeWalletBalances = {};
      if (Array.isArray(data.wallets)) {
        data.wallets.forEach(w => {
          window._safeWalletBalances[w.id] = w.balance;
        });
      }
      // عرض رصيد المحفظة المختارة حالياً
      updateSafeToDrawerBalance();
    }
  } catch (e) {
    console.error('[SAFE-TO-DRAWER] Error loading safe balance:', e);
  }

  // تحديث الرصيد المعروض عند تغيير المحفظة المختارة
  if (walletSelect) {
    walletSelect.addEventListener('change', updateSafeToDrawerBalance);
  }

  // إظهار/إخفاء حقل باسورد المدير حسب الصلاحية
  const currentUser = window.currentUser || JSON.parse(localStorage.getItem('currentUser') || '{}');
  const isAdmin = currentUser?.role === 'admin';
  const adminAuthSection = document.getElementById('safeToDrawerAdminAuth');
  if (adminAuthSection) {
    adminAuthSection.style.display = isAdmin ? 'none' : 'block';
  }

  // Reset form
  document.getElementById('safeToDrawerAmount').value = '';
  document.getElementById('safeToDrawerReason').value = '';
  document.getElementById('safeToDrawerAdminPassword').value = '';

  // Show modal
  modal.classList.add('show');
  setTimeout(() => document.getElementById('safeToDrawerAmount').focus(), 100);
}

function updateSafeToDrawerBalance() {
  const walletSelect = document.getElementById('safeToDrawerWallet');
  const balanceEl = document.getElementById('safeToDrawerSafeBalance');
  if (!walletSelect || !balanceEl) return;

  const selectedWalletId = parseInt(walletSelect.value);
  const balances = window._safeWalletBalances || {};
  const walletBalance = balances[selectedWalletId] || 0;

  balanceEl.textContent = fmt(walletBalance) + ' ج.م';

  // تلوين الرصيد: أخضر إذا موجب، أحمر إذا صفر أو سالب
  balanceEl.style.color = walletBalance > 0 ? '#10b981' : '#ef4444';
}

function closeSafeToDrawerModal() {
  document.getElementById('safeToDrawerModal')?.classList.remove('show');
}

async function confirmSafeToDrawer() {
  const walletId = parseInt(document.getElementById('safeToDrawerWallet').value);
  const amount = Number(document.getElementById('safeToDrawerAmount').value || 0);
  const reason = document.getElementById('safeToDrawerReason').value.trim();
  const adminPassword = document.getElementById('safeToDrawerAdminPassword').value;

  // Validation
  if (!walletId) {
    showToast('الرجاء اختيار المحفظة', 'error');
    return;
  }

  if (amount <= 0) {
    showToast('الرجاء إدخال مبلغ صحيح', 'error');
    document.getElementById('safeToDrawerAmount').focus();
    return;
  }

  // التحقق من باسورد المدير للكاشير
  const currentUser = window.currentUser || JSON.parse(localStorage.getItem('currentUser') || '{}');
  const isAdmin = currentUser?.role === 'admin';
  if (!isAdmin && !adminPassword) {
    showToast('الرجاء إدخال باسورد المدير', 'error');
    document.getElementById('safeToDrawerAdminPassword').focus();
    return;
  }

  const wallet = paymentWallets.find(w => w.id === walletId);
  if (!wallet) {
    showToast('المحفظة غير موجودة', 'error');
    return;
  }

  try {
    const res = await fetch('elos-db://safe-to-drawer-transfer', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        amount: amount,
        wallet_type: wallet.type,
        wallet_id: walletId,
        admin_password: isAdmin ? null : adminPassword,
        reason: reason || `سحب من الخزنة لدرج الكاش (${wallet.name})`
      })
    });

    if (!res.ok) {
      const errorText = await res.text();
      throw new Error(errorText);
    }

    // Close modal
    closeSafeToDrawerModal();

    // Refresh cash drawer display
    await loadCashDrawerData();

    // Show success
    SoundFX.play('success');
    showToast(`✅ تم سحب ${fmt(amount)} ج.م من الخزنة إلى ${wallet.name}`, 'success', 5000);

  } catch (error) {
    Logger.error('Safe to drawer transfer error:', error);
    showToast('فشل السحب: ' + translateError(error.message), 'error');
  }
}

// ═══════════════════════════════════════════════════════════════
// 💱 MONEY TRANSFERS - تحويلات الأموال (فودافون كاش، اتصالات كاش، إلخ)
// ═══════════════════════════════════════════════════════════════

let moneyTransferDirection = 'deposit';
let transferCommissionRates = {};
let mtClientSearchDebounce = null;
let _todayTransfersCache = [];

// Transfer type display names
const TRANSFER_TYPE_NAMES = {
  vodafone_cash: 'فودافون كاش',
  etisalat_cash: 'اتصالات كاش',
  orange_cash: 'اورنج كاش',
  we_pay: 'وي باي',
  instapay: 'انستاباي',
  other: 'أخرى'
};

// Set transfer direction (deposit / withdraw / deferred)
function setTransferDirection(dir) {
  moneyTransferDirection = dir;
  const btnDeposit = document.getElementById('btnDirectionDeposit');
  const btnWithdraw = document.getElementById('btnDirectionWithdraw');
  const btnDeferred = document.getElementById('btnDirectionDeferred');
  const toWalletRow = document.getElementById('mtToWalletRow');
  const toWalletArrow = document.getElementById('mtToWalletArrow');

  // ✅ FIX: تمييز واضح بين التاب النشط والباقي - يعمل في الوضع الفاتح والغامق
  const resetBtn = (btn) => {
    if (!btn) return;
    btn.style.borderColor = 'var(--border-color, rgba(255,255,255,0.1))';
    btn.style.background = 'var(--bg-tertiary, rgba(255,255,255,0.03))';
    btn.style.color = 'var(--text-muted)';
    btn.style.boxShadow = 'none';
    btn.style.transform = 'none';
    btn.style.opacity = '0.6';
    btn.classList.remove('active');
  };

  resetBtn(btnDeposit);
  resetBtn(btnWithdraw);
  resetBtn(btnDeferred);

  if (dir === 'deposit') {
    btnDeposit.style.borderColor = '#10b981';
    btnDeposit.style.background = 'linear-gradient(135deg, #10b981, #059669)';
    btnDeposit.style.color = '#ffffff';
    btnDeposit.style.boxShadow = '0 4px 15px rgba(16,185,129,0.4)';
    btnDeposit.style.transform = 'translateY(-1px)';
    btnDeposit.style.opacity = '1';
    btnDeposit.classList.add('active');
  } else if (dir === 'withdraw') {
    btnWithdraw.style.borderColor = '#f59e0b';
    btnWithdraw.style.background = 'linear-gradient(135deg, #f59e0b, #d97706)';
    btnWithdraw.style.color = '#ffffff';
    btnWithdraw.style.boxShadow = '0 4px 15px rgba(245,158,11,0.4)';
    btnWithdraw.style.transform = 'translateY(-1px)';
    btnWithdraw.style.opacity = '1';
    btnWithdraw.classList.add('active');
  } else {
    btnDeferred.style.borderColor = '#8b5cf6';
    btnDeferred.style.background = 'linear-gradient(135deg, #8b5cf6, #7c3aed)';
    btnDeferred.style.color = '#ffffff';
    btnDeferred.style.boxShadow = '0 4px 15px rgba(139,92,246,0.4)';
    btnDeferred.style.transform = 'translateY(-1px)';
    btnDeferred.style.opacity = '1';
    btnDeferred.classList.add('active');
  }

  // ✅ التحويل الآجل: العميل إجباري + إخفاء محفظة الوصول
  const clientRequired = document.getElementById('mtClientRequired');
  const clientOptionalLabel = document.getElementById('mtClientOptionalLabel');
  if (clientRequired) clientRequired.style.display = dir === 'deferred' ? 'inline' : 'none';
  if (clientOptionalLabel) clientOptionalLabel.style.display = dir === 'deferred' ? 'none' : 'inline';

  if (toWalletRow) toWalletRow.style.display = dir === 'deferred' ? 'none' : 'block';
  if (toWalletArrow) toWalletArrow.style.display = dir === 'deferred' ? 'none' : 'flex';

  if (dir !== 'deferred') clearMtClient();

  // ✅ تحديث الوصف التوضيحي
  const hintBox = document.getElementById('transferDirectionHint');
  const hintText = document.getElementById('transferHintText');
  if (hintBox && hintText) {
    if (dir === 'deposit') {
      hintBox.style.background = 'rgba(16,185,129,0.1)';
      hintBox.style.borderColor = 'rgba(16,185,129,0.25)';
      hintText.textContent = 'عميل هيحولك على محفظتك وهتديله الفلوس كاش من الدرج';
    } else if (dir === 'withdraw') {
      hintBox.style.background = 'rgba(245,158,11,0.1)';
      hintBox.style.borderColor = 'rgba(245,158,11,0.25)';
      hintText.textContent = 'عميل هيديك فلوس كاش وهتحوله من محفظتك الإلكترونية';
    } else {
      hintBox.style.background = 'rgba(139,92,246,0.1)';
      hintBox.style.borderColor = 'rgba(139,92,246,0.25)';
      hintText.textContent = 'عميل مسجل هتحوله من محفظتك الإلكترونية وهيتسجل دين عليه في حسابه بالمبلغ + العمولة';
    }
  }

  updateMoneyTransferWallets();
}

function clearMtClient() {
  const hid = document.getElementById('mtClientId');
  const search = document.getElementById('mtClientSearch');
  const sel = document.getElementById('mtClientSelected');
  const nameEl = document.getElementById('mtClientSelectedName');
  const drop = document.getElementById('mtClientDropdown');
  const phoneRow = document.getElementById('mtClientPhoneRow');
  const phoneInput = document.getElementById('mtCustomerPhone');
  if (hid) hid.value = '';
  if (search) { search.value = ''; search.style.display = 'block'; }
  if (sel) sel.style.display = 'none';
  if (nameEl) nameEl.textContent = '';
  if (drop) { drop.style.display = 'none'; drop.innerHTML = ''; }
  if (phoneRow) phoneRow.style.display = 'block';
  if (phoneInput) phoneInput.value = '';
}

function selectMtClient(id, name, phone) {
  document.getElementById('mtClientId').value = id;
  document.getElementById('mtClientSearch').style.display = 'none';
  document.getElementById('mtClientSelectedName').textContent = `👤 ${name}` + (phone ? ` - 📞 ${phone}` : '');
  document.getElementById('mtClientSelected').style.display = 'block';
  document.getElementById('mtClientDropdown').style.display = 'none';
  document.getElementById('mtClientDropdown').innerHTML = '';
  // ✅ إخفاء حقل الهاتف عند اختيار عميل مسجل
  const phoneRow = document.getElementById('mtClientPhoneRow');
  if (phoneRow) phoneRow.style.display = 'none';
}

// ✅ بحث عن العميل مع خيار تسجيل جديد (مثل نافذة الشراء)
function onMtClientSearchInput(value) {
  const q = value.trim();
  const dropdown = document.getElementById('mtClientDropdown');
  const sel = document.getElementById('mtClientSelected');

  if (sel) sel.style.display = 'none';
  if (document.getElementById('mtClientId')) document.getElementById('mtClientId').value = '';

  // إظهار حقل الهاتف
  const phoneRow = document.getElementById('mtClientPhoneRow');
  if (phoneRow) phoneRow.style.display = 'block';

  clearTimeout(mtClientSearchDebounce);
  if (!q) {
    dropdown.style.display = 'none';
    dropdown.innerHTML = '';
    return;
  }

  mtClientSearchDebounce = setTimeout(async () => {
    const clients = await searchMtClients(q);
    dropdown.innerHTML = '';

    // ✅ عرض نتائج البحث
    if (clients.length > 0) {
      clients.forEach(c => {
        const div = document.createElement('div');
        div.setAttribute('role', 'button');
        div.style.cssText = 'padding:10px 14px; cursor:pointer; font-size:13px; border-bottom:1px solid rgba(255,255,255,0.06); display:flex; justify-content:space-between; align-items:center;';
        div.innerHTML = `
          <div>
            <div style="font-weight:600;">👤 ${c.name || 'بدون اسم'}</div>
            <div style="font-size:11px; color:var(--text-muted);">📞 ${c.phone || 'بدون رقم'}</div>
          </div>
          <div style="font-size:11px; color:${(c.balance || 0) > 0 ? '#ef4444' : '#10b981'}; font-weight:600;">
            ${fmt(c.balance || 0)} ج.م
          </div>
        `;
        div.onmouseenter = () => { div.style.background = 'rgba(139,92,246,0.15)'; };
        div.onmouseleave = () => { div.style.background = ''; };
        div.onclick = () => selectMtClient(c.id, c.name || ('#' + c.id), c.phone || '');
        dropdown.appendChild(div);
      });
    } else {
      // ✅ لا يوجد عملاء - عرض خيار التسجيل
      const noResult = document.createElement('div');
      noResult.style.cssText = 'padding:12px 14px; color:var(--text-muted); font-size:13px; text-align:center;';
      noResult.textContent = 'لا يوجد عميل بهذا الاسم';
      dropdown.appendChild(noResult);
    }

    // ✅ زر تسجيل عميل جديد (يظهر دائماً)
    const registerDiv = document.createElement('div');
    registerDiv.setAttribute('role', 'button');
    registerDiv.style.cssText = 'padding:10px 14px; cursor:pointer; font-size:13px; border-top:1px solid rgba(139,92,246,0.2); display:flex; align-items:center; gap:8px; color:#a78bfa; font-weight:600;';
    registerDiv.innerHTML = `<span style="font-size:16px;">➕</span> تسجيل "${q}" كعميل جديد`;
    registerDiv.onmouseenter = () => { registerDiv.style.background = 'rgba(139,92,246,0.15)'; };
    registerDiv.onmouseleave = () => { registerDiv.style.background = ''; };
    registerDiv.onclick = () => registerNewMtClient(q);
    dropdown.appendChild(registerDiv);

    dropdown.style.display = 'block';
  }, 250);
}

// ✅ تسجيل عميل جديد مباشرة من تاب التحويلات
async function registerNewMtClient(name) {
  const phone = document.getElementById('mtCustomerPhone')?.value?.trim() || '';

  try {
    const res = await fetch('elos-db://clients', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ name: name, phone: phone })
    });

    if (!res.ok) {
      const errText = await res.text();
      showToast('فشل تسجيل العميل: ' + errText, 'error');
      return;
    }

    const newClient = await res.json();
    showToast(`✅ تم تسجيل العميل "${name}" بنجاح`, 'success');
    selectMtClient(newClient.id || newClient.lastInsertRowid, name, phone);
  } catch (e) {
    Logger.error('[MONEY-TRANSFER] Register client error:', e);
    showToast('فشل تسجيل العميل', 'error');
  }
}

async function searchMtClients(q) {
  if (!q || q.length < 1) return [];
  const res = await fetch(`elos-db://clients?q=${encodeURIComponent(q)}`);
  if (!res.ok) return [];
  const data = await res.json();
  const list = Array.isArray(data) ? data : (data.data || data.clients || []);
  return list.slice(0, 20);
}

// Load transfer commission rates from settings
async function loadTransferCommissionRates() {
  try {
    const res = await fetch('elos-db://settings');
    if (res.ok) {
      const data = await res.json();
      // data can be object with key-value pairs or array
      if (typeof data === 'object' && !Array.isArray(data)) {
        transferCommissionRates = {};
        Object.keys(data).forEach(key => {
          if (key.startsWith('transfer')) {
            transferCommissionRates[key] = data[key];
          }
        });
      } else if (Array.isArray(data)) {
        transferCommissionRates = {};
        data.forEach(s => {
          if (s.key && s.key.startsWith('transfer')) {
            transferCommissionRates[s.key] = s.value;
          }
        });
      }

      Logger.log('[MONEY-TRANSFER] ✅ Commission rates loaded:', JSON.stringify(transferCommissionRates));

      // تحديث نص التلميح فوراً بعد التحميل
      const hintEl = document.getElementById('mtCommissionHint');
      const typeEl = document.getElementById('mtTransferType');
      if (hintEl && typeEl) {
        hintEl.textContent = getCommissionHintText(typeEl.value || 'vodafone_cash');
      }
    }
  } catch (e) {
    Logger.error('[MONEY-TRANSFER] Error loading commission rates:', e);
  }
}

// Calculate commission based on amount and type
function calculateTransferCommission(amount, transferType) {
  const rateKey = `transferCommissionRate_${transferType}`;
  const rawRate = transferCommissionRates[rateKey];
  const rate = (rawRate != null && rawRate !== '') ? Number(rawRate) : 10;
  const calcType = transferCommissionRates.transferCommissionType || 'per_1000';

  let commission = 0;
  if (calcType === 'per_1000') {
    commission = Math.ceil(amount / 1000) * rate;
  } else if (calcType === 'percentage') {
    commission = Math.round(amount * rate / 100 * 100) / 100;
  } else {
    commission = rate;
  }
  return commission;
}

// Get commission hint text
function getCommissionHintText(transferType) {
  const rateKey = `transferCommissionRate_${transferType}`;
  const rawRate = transferCommissionRates[rateKey];
  const rate = (rawRate != null && rawRate !== '') ? Number(rawRate) : 10;
  const calcType = transferCommissionRates.transferCommissionType || 'per_1000';

  if (calcType === 'per_1000') return `${rate} ج.م لكل 1000 ج.م`;
  if (calcType === 'percentage') return `${rate}% من المبلغ`;
  return `${rate} ج.م (مبلغ ثابت)`;
}

// Update commission when amount or type changes
function updateTransferCommission() {
  const amount = Number(document.getElementById('mtAmount')?.value || 0);
  const type = document.getElementById('mtTransferType')?.value || 'vodafone_cash';

  if (amount > 0) {
    const commission = calculateTransferCommission(amount, type);
    document.getElementById('mtCommission').value = commission;
    document.getElementById('mtSummaryAmount').textContent = fmt(amount) + ' ج.م';
    document.getElementById('mtSummaryCommission').textContent = fmt(commission) + ' ج.م';
  } else {
    document.getElementById('mtCommission').value = '';
    document.getElementById('mtSummaryAmount').textContent = '0';
    document.getElementById('mtSummaryCommission').textContent = '0';
  }

  // Update hint
  document.getElementById('mtCommissionHint').textContent = getCommissionHintText(type);
}

// Update summary when commission is manually changed
function updateTransferSummary() {
  const amount = Number(document.getElementById('mtAmount')?.value || 0);
  const commission = Number(document.getElementById('mtCommission')?.value || 0);
  document.getElementById('mtSummaryAmount').textContent = amount > 0 ? fmt(amount) + ' ج.م' : '0';
  document.getElementById('mtSummaryCommission').textContent = commission > 0 ? fmt(commission) + ' ج.م' : '0';
}

// Populate wallet dropdowns and auto-select based on direction/type
async function updateMoneyTransferWallets() {
  if (paymentWallets.length === 0) {
    await loadPaymentWallets();
  }

  const fromSelect = document.getElementById('mtFromWallet');
  const toSelect = document.getElementById('mtToWallet');
  if (!fromSelect || !toSelect) return;

  fromSelect.innerHTML = '';
  toSelect.innerHTML = '';

  paymentWallets.forEach(wallet => {
    const icon = wallet.type === 'cash' ? '💵' : wallet.type === 'mobile_wallet' ? '📱' : '🏦';
    const optFrom = document.createElement('option');
    optFrom.value = wallet.id;
    optFrom.textContent = `${icon} ${wallet.name}${wallet.is_default ? ' (افتراضي)' : ''}`;
    fromSelect.appendChild(optFrom);

    const optTo = document.createElement('option');
    optTo.value = wallet.id;
    optTo.textContent = `${icon} ${wallet.name}${wallet.is_default ? ' (افتراضي)' : ''}`;
    toSelect.appendChild(optTo);
  });

  // Auto-select wallets based on direction
  const defaultCash = paymentWallets.find(w => w.type === 'cash' && w.is_default);
  const transferType = document.getElementById('mtTransferType')?.value || 'vodafone_cash';

  // Try to find a matching mobile wallet for the transfer type
  let targetWallet = paymentWallets.find(w =>
    w.type === 'mobile_wallet' &&
    (w.name.toLowerCase().includes(transferType.replace('_cash', '').replace('_pay', '')) ||
     w.provider?.toLowerCase().includes(transferType.replace('_cash', '').replace('_pay', '')))
  );
  // Fallback to default mobile wallet
  if (!targetWallet) {
    targetWallet = paymentWallets.find(w => w.type === 'mobile_wallet' && w.is_default);
  }
  // Fallback for instapay = bank type
  if (!targetWallet && transferType === 'instapay') {
    targetWallet = paymentWallets.find(w => w.type === 'bank' && w.is_default);
  }

  if (moneyTransferDirection === 'deferred') {
    // تحويل آجل: من محفظة واحدة فقط (التحويل للعميل يُخصم من المحفظة المختارة)
    if (targetWallet) fromSelect.value = targetWallet.id;
    else if (defaultCash) fromSelect.value = defaultCash.id;
    if (toSelect) toSelect.value = paymentWallets[0]?.id || '';
  } else if (moneyTransferDirection === 'deposit') {
    if (defaultCash) fromSelect.value = defaultCash.id;
    if (targetWallet) toSelect.value = targetWallet.id;
  } else {
    if (targetWallet) fromSelect.value = targetWallet.id;
    if (defaultCash) toSelect.value = defaultCash.id;
  }

  // Update balances
  updateMoneyTransferBalances();
}

// Update balance display for money transfer wallets
function updateMoneyTransferBalances() {
  const fromWalletId = parseInt(document.getElementById('mtFromWallet')?.value);
  const toWalletId = parseInt(document.getElementById('mtToWallet')?.value);

  let fromBalance = 0;
  let toBalance = 0;

  if (currentCashData && currentCashData.walletsMap) {
    if (currentCashData.walletsMap[fromWalletId]) {
      fromBalance = currentCashData.walletsMap[fromWalletId].balance || 0;
    }
    if (currentCashData.walletsMap[toWalletId]) {
      toBalance = currentCashData.walletsMap[toWalletId].balance || 0;
    }
  }

  const fromEl = document.getElementById('mtFromBalance');
  const toEl = document.getElementById('mtToBalance');
  if (fromEl) fromEl.textContent = fmt(fromBalance);
  if (toEl) toEl.textContent = fmt(toBalance);
}

// Load transfer data (rates + today's transfers + wallet info)
async function loadTransferData() {
  await loadTransferCommissionRates();
  await updateMoneyTransferWallets();
  await loadTodayTransfers();
  updateTransferCommission();
}

// Load today's transfers list
async function loadTodayTransfers() {
  try {
    const now = new Date();
    const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
    const currentUser = window.currentUser || JSON.parse(localStorage.getItem('currentUser') || '{}');

    let url = `elos-db://money-transfers?from=${today}&to=${today}`;
    if (currentUser?.id) url += `&user_id=${currentUser.id}`;

    const res = await fetch(url);
    if (!res.ok) throw new Error(await res.text());

    const transfers = await res.json();
    renderTodayTransfers(transfers);

    // Update tab count
    const countEl = document.getElementById('transfersCount');
    if (countEl) countEl.textContent = transfers.length;

  } catch (e) {
    Logger.error('[MONEY-TRANSFER] Error loading today transfers:', e);
  }
}

// Update today's transfers badge and total (button replaces inline list)
function renderTodayTransfers(transfers) {
  _todayTransfersCache = transfers || [];

  const totalEl = document.getElementById('mtTodayTotal');
  const badgeEl = document.getElementById('mtTodayCountBadge');

  let totalCommission = 0;
  (transfers || []).forEach(t => { totalCommission += Number(t.commission || 0); });

  if (badgeEl) badgeEl.textContent = (transfers || []).length;
  if (totalEl) totalEl.textContent = `العمولات: ${fmt(totalCommission)} ج.م`;
}

// ═══════════════════════════════════════════════════════════════
// TRANSFERS HISTORY MODAL - نافذة تحويلات الشفت
// ═══════════════════════════════════════════════════════════════

function openTransfersHistoryModal() {
  const modal = document.getElementById('transfersHistoryModal');
  if (!modal) return;

  // Reset filters
  const typeFilter = document.getElementById('transfersModalTypeFilter');
  const dirFilter = document.getElementById('transfersModalDirFilter');
  if (typeFilter) typeFilter.value = '';
  if (dirFilter) dirFilter.value = '';

  modal.classList.add('show');

  // If we have cached data, render immediately
  if (_todayTransfersCache.length > 0) {
    renderTransfersModalList(_todayTransfersCache);
    updateTransfersModalStats(_todayTransfersCache);
  }

  // Also refresh from API
  loadTransfersForModal();
}

function closeTransfersHistoryModal() {
  const modal = document.getElementById('transfersHistoryModal');
  if (modal) modal.classList.remove('show');
}

// Close on outside click
document.getElementById('transfersHistoryModal')?.addEventListener('click', function(e) {
  if (e.target === this) closeTransfersHistoryModal();
});

async function loadTransfersForModal() {
  try {
    const now = new Date();
    const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
    const currentUser = window.currentUser || JSON.parse(localStorage.getItem('currentUser') || '{}');

    let url = `elos-db://money-transfers?from=${today}&to=${today}`;
    if (currentUser?.id) url += `&user_id=${currentUser.id}`;

    const res = await fetch(url);
    if (!res.ok) throw new Error(await res.text());

    const transfers = await res.json();
    _todayTransfersCache = transfers;
    filterTransfersModal();
  } catch (e) {
    Logger.error('[TRANSFERS-MODAL] Error loading transfers:', e);
  }
}

function filterTransfersModal() {
  const typeFilter = document.getElementById('transfersModalTypeFilter')?.value || '';
  const dirFilter = document.getElementById('transfersModalDirFilter')?.value || '';

  let filtered = [..._todayTransfersCache];

  if (typeFilter) {
    filtered = filtered.filter(t => t.transfer_type === typeFilter);
  }

  if (dirFilter) {
    if (dirFilter === 'deferred') {
      filtered = filtered.filter(t => !!t.client_id);
    } else {
      filtered = filtered.filter(t => !t.client_id && t.direction === dirFilter);
    }
  }

  renderTransfersModalList(filtered);
  updateTransfersModalStats(filtered);
}

function updateTransfersModalStats(transfers) {
  let totalAmount = 0, totalCommission = 0;
  transfers.forEach(t => {
    totalAmount += Number(t.transfer_amount || 0);
    totalCommission += Number(t.commission || 0);
  });

  const countEl = document.getElementById('transfersModalCount');
  if (countEl) countEl.textContent = `${transfers.length} تحويل`;

  const tcEl = document.getElementById('transfersModalTotalCount');
  if (tcEl) tcEl.textContent = transfers.length;

  const taEl = document.getElementById('transfersModalTotalAmount');
  if (taEl) taEl.textContent = fmt(totalAmount) + ' ج.م';

  const tcommEl = document.getElementById('transfersModalTotalCommission');
  if (tcommEl) tcommEl.textContent = fmt(totalCommission) + ' ج.م';

  const footerEl = document.getElementById('transfersModalFooterCommission');
  if (footerEl) footerEl.textContent = fmt(totalCommission);
}

function renderTransfersModalList(transfers) {
  const listEl = document.getElementById('transfersModalList');
  if (!listEl) return;

  if (!transfers || transfers.length === 0) {
    listEl.innerHTML = `
      <div style="text-align:center;color:var(--text-muted);padding:50px 20px;">
        <div style="font-size:48px;margin-bottom:12px;opacity:0.4;">💱</div>
        <div style="font-size:15px;font-weight:600;">لا توجد تحويلات</div>
      </div>`;
    return;
  }

  const esc = typeof escapeHtml === 'function' ? escapeHtml : (t => t || '');

  const TYPE_ICONS = {
    vodafone_cash: '📱', etisalat_cash: '📱', orange_cash: '📱',
    we_pay: '📱', instapay: '🏦', other: '💱'
  };
  const TYPE_COLORS = {
    vodafone_cash: '#ef4444', etisalat_cash: '#22c55e', orange_cash: '#f97316',
    we_pay: '#8b5cf6', instapay: '#3b82f6', other: '#64748b'
  };

  listEl.innerHTML = transfers.map((t, i) => {
    const typeName = TRANSFER_TYPE_NAMES[t.transfer_type] || t.transfer_type;
    const typeIcon = TYPE_ICONS[t.transfer_type] || '💱';
    const typeColor = TYPE_COLORS[t.transfer_type] || '#64748b';
    const isDeferred = !!t.client_id;
    const dirIcon = isDeferred ? '👤' : (t.direction === 'deposit' ? '📥' : '📤');
    const dirText = isDeferred ? 'تحويل آجل' : (t.direction === 'deposit' ? 'إيداع من عميل' : 'سحب لعميل');
    const dirColor = isDeferred ? '#a78bfa' : (t.direction === 'deposit' ? '#10b981' : '#f59e0b');

    const time = t.created_at ? new Date(t.created_at).toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' }) : '';
    const customerDisplay = isDeferred
      ? (t.client_name ? `<span style="color:#a78bfa;font-weight:700;">👤 ${esc(t.client_name)}</span>` : '')
      : (t.customer_name ? `<span>👤 ${esc(t.customer_name)}</span>` : '');
    const phoneDisplay = t.customer_phone ? `<span style="color:var(--text-muted);">📞 ${esc(t.customer_phone)}</span>` : '';
    const walletsDisplay = t.from_wallet_name
      ? `<span style="color:var(--text-muted);font-size:12px;">${esc(t.from_wallet_name)}${t.to_wallet_name ? ' → ' + esc(t.to_wallet_name) : (isDeferred ? ' → حساب العميل' : '')}</span>`
      : '';
    const notesDisplay = t.notes ? `<div style="font-size:12px;color:var(--text-muted);margin-top:4px;opacity:0.8;">📝 ${esc(t.notes)}</div>` : '';

    return `
      <div style="padding:14px 16px;background:rgba(255,255,255,0.04);border-radius:12px;border:1px solid rgba(255,255,255,0.06);transition:all 0.15s;"
           onmouseover="this.style.background='rgba(139,92,246,0.08)';this.style.borderColor='rgba(139,92,246,0.2)'"
           onmouseout="this.style.background='rgba(255,255,255,0.04)';this.style.borderColor='rgba(255,255,255,0.06)'">
        <div style="display:flex;align-items:flex-start;gap:12px;">
          <!-- Icon -->
          <div style="width:44px;height:44px;border-radius:12px;background:rgba(139,92,246,0.15);display:flex;align-items:center;justify-content:center;font-size:22px;flex-shrink:0;">
            ${dirIcon}
          </div>
          <!-- Content -->
          <div style="flex:1;min-width:0;">
            <!-- Row 1: Type + Amount -->
            <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px;">
              <div style="display:flex;align-items:center;gap:8px;">
                <span style="background:${typeColor}20;color:${typeColor};padding:3px 10px;border-radius:6px;font-size:12px;font-weight:700;">${typeIcon} ${typeName}</span>
                <span style="background:${dirColor}20;color:${dirColor};padding:3px 10px;border-radius:6px;font-size:12px;font-weight:700;">${dirText}</span>
              </div>
              <span style="font-weight:900;font-size:18px;color:var(--text-primary);">${fmt(t.transfer_amount)} <span style="font-size:12px;font-weight:600;">ج.م</span></span>
            </div>
            <!-- Row 2: Commission + Time -->
            <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:4px;">
              <div style="display:flex;align-items:center;gap:12px;font-size:13px;">
                <span style="color:#10b981;font-weight:700;">💰 عمولة: ${fmt(t.commission)} ج.م</span>
                ${customerDisplay}
                ${phoneDisplay}
              </div>
              <span style="font-size:12px;color:var(--text-muted);">🕐 ${time}</span>
            </div>
            <!-- Row 3: Wallets -->
            ${walletsDisplay ? `<div style="margin-top:2px;">${walletsDisplay}</div>` : ''}
            ${notesDisplay}
          </div>
        </div>
      </div>
    `;
  }).join('');
}

// Submit money transfer
async function submitMoneyTransfer() {
  const transferType = document.getElementById('mtTransferType')?.value;
  const amount = Number(document.getElementById('mtAmount')?.value || 0);
  const commission = Number(document.getElementById('mtCommission')?.value || 0);
  const fromWalletId = parseInt(document.getElementById('mtFromWallet')?.value);
  const toWalletId = parseInt(document.getElementById('mtToWallet')?.value);
  // ✅ بيانات العميل من الحقول الجديدة
  const clientIdVal = document.getElementById('mtClientId')?.value?.trim() || '';
  const customerName = clientIdVal ? '' : (document.getElementById('mtClientSearch')?.value?.trim() || '');
  const customerPhone = document.getElementById('mtCustomerPhone')?.value?.trim() || '';
  const notes = document.getElementById('mtNotes')?.value?.trim() || '';
  const isDeferred = moneyTransferDirection === 'deferred';
  const clientId = clientIdVal;

  if (amount <= 0) {
    showToast('أدخل مبلغ التحويل', 'warning');
    document.getElementById('mtAmount')?.focus();
    return;
  }
  if (commission < 0) {
    showToast('العمولة لا يمكن أن تكون سالبة', 'warning');
    return;
  }
  if (!fromWalletId) {
    showToast('يجب تحديد المحفظة المصدر', 'warning');
    return;
  }
  if (isDeferred) {
    if (!clientId) {
      showToast('اختر عميلاً مسجلاً للتحويل الآجل', 'warning');
      document.getElementById('mtClientSearch')?.focus();
      return;
    }
  } else {
    if (!toWalletId) {
      showToast('يجب تحديد المحفظة الوجهة', 'warning');
      return;
    }
    if (fromWalletId === toWalletId) {
      showToast('لا يمكن التحويل لنفس المحفظة', 'warning');
      return;
    }
  }

  // Check balance of source wallet
  let fromBalance = 0;
  if (currentCashData && currentCashData.walletsMap && currentCashData.walletsMap[fromWalletId]) {
    fromBalance = currentCashData.walletsMap[fromWalletId].balance || 0;
  }
  if (amount > fromBalance) {
    const fromWallet = paymentWallets.find(w => w.id === fromWalletId);
    showToast(`الرصيد غير كافي في ${fromWallet?.name || 'المحفظة المصدر'}`, 'error');
    return;
  }

  const currentUser = window.currentUser || JSON.parse(localStorage.getItem('currentUser') || '{}');

  try {
    const body = {
      transfer_type: transferType,
      direction: isDeferred ? 'withdraw' : moneyTransferDirection,
      transfer_amount: amount,
      commission: commission,
      from_wallet_id: fromWalletId,
      to_wallet_id: isDeferred ? null : toWalletId,
      customer_name: customerName || null,
      customer_phone: customerPhone || null,
      notes: notes || null,
      user_id: currentUser?.id || null,
      username: currentUser?.username || null
    };
    if (isDeferred && clientId) body.client_id = parseInt(clientId, 10);

    const res = await fetch('elos-db://money-transfer', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body)
    });

    if (!res.ok) {
      const error = await res.text();
      throw new Error(error);
    }

    const result = await res.json();

    SoundFX.play('success');
    if (isDeferred) {
      showToast(`✅ تم التحويل الآجل - المبلغ + العمولة مُسجّلان في حساب العميل`, 'success', 5000);
    } else {
      showToast(`✅ تم تسجيل التحويل - عمولة ${fmt(commission)} ج.م`, 'success', 5000);
    }

    document.getElementById('mtAmount').value = '';
    document.getElementById('mtCommission').value = '';
    document.getElementById('mtNotes').value = '';
    document.getElementById('mtSummaryAmount').textContent = '0';
    document.getElementById('mtSummaryCommission').textContent = '0';
    clearMtClient();

    await loadTodayTransfers();
    await loadCashDrawerData();
    updateMoneyTransferBalances();

  } catch (error) {
    Logger.error('[MONEY-TRANSFER] Submit error:', error);
    showToast('خطأ في تسجيل التحويل: ' + (typeof translateError === 'function' ? translateError(error.message) : error.message), 'error');
  }
}

// Event listeners for money transfer form
document.getElementById('mtAmount')?.addEventListener('input', updateTransferCommission);
document.getElementById('mtTransferType')?.addEventListener('change', () => {
  updateTransferCommission();
  updateMoneyTransferWallets();
});
document.getElementById('mtCommission')?.addEventListener('input', updateTransferSummary);
document.getElementById('mtFromWallet')?.addEventListener('change', updateMoneyTransferBalances);
document.getElementById('mtToWallet')?.addEventListener('change', updateMoneyTransferBalances);

// ✅ (تم نقل منطق البحث إلى onMtClientSearchInput)
document.addEventListener('click', function(e) {
  const block = document.getElementById('mtDeferredClientBlock');
  const drop = document.getElementById('mtClientDropdown');
  const search = document.getElementById('mtClientSearch');
  if (block && drop && search && !block.contains(e.target)) {
    drop.style.display = 'none';
  }
});

// ═══════════════════════════════════════════════════════════════
// 🆕 DRAWER HISTORY MODAL - سجل حركات الدرج
// ═══════════════════════════════════════════════════════════════

let currentHistoryFilter = 'all';

function openDrawerHistoryModal() {
  const modal = document.getElementById('drawerHistoryModal');
  if (!modal) return;

  currentHistoryFilter = 'all';
  // Reset active tab
  document.querySelectorAll('.history-tab').forEach(tab => {
    tab.classList.toggle('active', tab.dataset.filter === 'all');
  });

  renderDrawerHistory('all');
  modal.classList.add('show');
}

function closeDrawerHistoryModal() {
  const modal = document.getElementById('drawerHistoryModal');
  if (modal) modal.classList.remove('show');
}

function filterDrawerHistory(filter) {
  currentHistoryFilter = filter;

  // Update active tab
  document.querySelectorAll('.history-tab').forEach(tab => {
    tab.classList.toggle('active', tab.dataset.filter === filter);
  });

  renderDrawerHistory(filter);
}

function renderDrawerHistory(filter = 'all') {
  const listEl = document.getElementById('drawerHistoryList');
  if (!listEl) return;

  // جمع كل الحركات من مصادر مختلفة
  let allTransactions = [];

  // 1. إضافة حركات الشفت (إيداعات وسحوبات يدوية)
  const shiftTx = getShiftTransactions();
  shiftTx.forEach(tx => {
    allTransactions.push({
      ...tx,
      source: 'shift'
    });
  });

  // 2. إضافة المبيعات من currentCashData (إذا متوفرة)
  // ⚠️ نستبعد البيع الآجل لأنه لا يدخل فلوس فعلية للدرج
  if (currentCashData && currentCashData.sales) {
    currentCashData.sales.forEach(sale => {
      const pm = (sale.payment_method || 'cash').toLowerCase();
      const isDeferred = pm === 'deferred' || pm === 'credit';

      // ✅ البيع الآجل لا يظهر في سجل الدرج - الفلوس الفعلية في cash_ledger
      if (isDeferred) return;

      const paidAmount = Number(sale.paid_now || 0);
      // تجاهل المبيعات بدون مبلغ مدفوع
      if (paidAmount === 0) return;

      allTransactions.push({
        type: 'sale',
        amount: paidAmount,
        wallet: pm === 'cash' ? 'cash' :
                pm === 'mobile_wallet' ? 'mobile_wallet' :
                pm === 'bank' || pm === 'transfer' ? 'bank' : 'cash',
        category: 'مبيعات',
        description: `${sale.type || ''} ${sale.model || 'جهاز'} - ${sale.customer_name || sale.client_name || 'عميل'}`.trim(),
        created_at: sale.created_at,
        source: 'sales'
      });
    });
  }

  // 3. إضافة حركات من ledger (مشتريات POS، تحصيلات، إلخ)
  if (currentCashData && currentCashData.ledgerTransactions) {
    currentCashData.ledgerTransactions.forEach(tx => {
      // تجاهل المبيعات (معروضة من sales)
      if (tx.ref === 'sale' || tx.ref === 'accessory_sale' || (tx.ref && tx.ref.startsWith('accessory_sale_'))) {
        return;
      }

      let txType = tx.kind === 'in' ? 'deposit' : 'withdraw';
      let category = tx.note || tx.ref || '';

      // تحديد النوع حسب ref
      let isMoneyTransfer = false;
      if (tx.ref === 'pos_purchase') {
        category = 'شراء جهاز (POS)';
      } else if (tx.ref === 'safe_withdraw') {
        category = 'سحب من الخزنة';
        txType = 'deposit'; // يدخل للدرج
      } else if (tx.ref === 'return') {
        category = 'مرتجع مبيعات';
      } else if (tx.ref && tx.ref.startsWith('client_payment_')) {
        category = 'تحصيل من عميل';
      } else if (tx.ref && tx.ref.startsWith('money_transfer_out_')) {
        category = 'تحويلات - خروج';
        txType = 'money_transfer';
        isMoneyTransfer = true;
      } else if (tx.ref && tx.ref.startsWith('money_transfer_in_')) {
        category = 'تحويلات - دخول';
        txType = 'money_transfer';
        isMoneyTransfer = true;
      } else if (tx.ref && tx.ref.startsWith('money_transfer_commission_')) {
        category = 'تحويلات - عمولة';
        txType = 'money_transfer';
        isMoneyTransfer = true;
      }

      allTransactions.push({
        type: txType,
        amount: Number(tx.amount || 0),
        wallet: tx.wallet_type || 'cash',
        category: category,
        description: tx.note || '',
        created_at: tx.created_at,
        source: 'ledger',
        isMoneyTransfer: isMoneyTransfer
      });
    });
  }

  // ✅ v1.2.3: Per-User closing time
  const closingTimeKey = getLastClosingTimeKey();
  const lastClosingTime = localStorage.getItem(closingTimeKey) || null;

  // Filter by last closing time
  let transactions = allTransactions.filter(tx => {
    if (lastClosingTime) {
      let closingDateStr = lastClosingTime;
      if (closingDateStr && !closingDateStr.includes('T') && !closingDateStr.includes('Z')) {
        closingDateStr = closingDateStr.replace(' ', 'T');
      }
      let txDateTime = tx.created_at;
      if (txDateTime && !txDateTime.includes('T') && !txDateTime.includes('Z')) {
        txDateTime = txDateTime.replace(' ', 'T');
      }
      const txTime = new Date(txDateTime).getTime();
      if (txTime <= new Date(closingDateStr).getTime()) {
        return false;
      }
    }
    return true;
  });

  // Apply type filter
  if (filter === 'transfers') {
    transactions = transactions.filter(tx => tx.category === 'تحويل' || tx.transfer_id || tx.isMoneyTransfer);
  } else if (filter === 'deposits') {
    transactions = transactions.filter(tx =>
      (tx.type === 'deposit' || tx.type === 'sale' || tx.type === 'client_payment') &&
      tx.category !== 'تحويل' && !tx.transfer_id && !tx.isMoneyTransfer
    );
  } else if (filter === 'withdraws') {
    transactions = transactions.filter(tx =>
      (tx.type === 'withdraw' || tx.type === 'supplier_payment') &&
      tx.category !== 'تحويل' && !tx.transfer_id && !tx.isMoneyTransfer
    );
  }

  // Sort by time (newest first)
  transactions.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));

  // ✅ حساب إجماليات الحركات المعروضة وتحديث البطاقات
  let totalIn = 0, totalOut = 0;
  transactions.forEach(tx => {
    if (tx.type === 'sale' || tx.type === 'deposit' || tx.type === 'client_payment') {
      totalIn += Number(tx.amount || 0);
    } else if (tx.type === 'withdraw' || tx.type === 'supplier_payment') {
      totalOut += Number(tx.amount || 0);
    }
    // money_transfer: العمولة = in، الخروج/الدخول يُحسبان حسب الـ ref
    if (tx.type === 'money_transfer') {
      if (tx.category === 'تحويلات - عمولة' || tx.category === 'تحويلات - دخول') {
        totalIn += Number(tx.amount || 0);
      } else if (tx.category === 'تحويلات - خروج') {
        totalOut += Number(tx.amount || 0);
      }
    }
  });
  const net = totalIn - totalOut;
  const summaryInEl = document.getElementById('histSummaryIn');
  const summaryOutEl = document.getElementById('histSummaryOut');
  const summaryNetEl = document.getElementById('histSummaryNet');
  const summaryCountEl = document.getElementById('histSummaryCount');
  if (summaryInEl) summaryInEl.textContent = fmt(totalIn);
  if (summaryOutEl) summaryOutEl.textContent = fmt(totalOut);
  if (summaryNetEl) {
    summaryNetEl.textContent = (net >= 0 ? '+' : '') + fmt(net);
    summaryNetEl.style.color = net >= 0 ? '#10b981' : '#ef4444';
  }
  if (summaryCountEl) summaryCountEl.textContent = transactions.length;

  if (transactions.length === 0) {
    listEl.innerHTML = `
      <div class="history-empty">
        <div class="history-empty-icon">📭</div>
        <div>لا توجد حركات${filter !== 'all' ? ' من هذا النوع' : ''}</div>
      </div>
    `;
    return;
  }

  const walletLabels = {
    cash: '💵 كاش',
    mobile_wallet: '📱 محفظة',
    bank: '🏦 بنك'
  };

  listEl.innerHTML = transactions.map(tx => {
    let icon, iconClass, title, amountClass;
    const wallet = walletLabels[tx.wallet] || walletLabels.cash;
    const time = tx.created_at ? new Date(tx.created_at).toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' }) : '';

    if (tx.type === 'sale') {
      // مبيعات
      icon = '🧾';
      iconClass = 'sale';
      title = `مبيعات (${wallet})`;
      amountClass = 'positive';
    } else if (tx.type === 'money_transfer') {
      // تحويل رصيد (فودافون كاش، إلخ)
      icon = '💱';
      iconClass = 'transfer';
      title = tx.category + ` (${wallet})`;
      amountClass = tx.category === 'تحويلات - خروج' ? 'negative' : 'positive';
    } else if (tx.category === 'تحويل' || tx.transfer_id) {
      // تحويل بين محافظ
      icon = '🔄';
      iconClass = 'transfer';
      title = tx.type === 'withdraw' ? `تحويل من ${wallet}` : `تحويل إلى ${wallet}`;
      amountClass = 'neutral';
    } else if (tx.type === 'deposit' || tx.type === 'client_payment') {
      // إيداع
      icon = '📥';
      iconClass = 'deposit';
      title = tx.type === 'client_payment' ? `تحصيل من عميل (${wallet})` : `إيداع (${wallet})`;
      amountClass = 'positive';
    } else {
      // سحب
      icon = '📤';
      iconClass = 'withdraw';
      title = tx.type === 'supplier_payment' ? `دفع لمورد (${wallet})` : `سحب (${wallet})`;
      amountClass = 'negative';
    }

    const desc = tx.description || tx.category || '-';

    return `
      <div class="history-item">
        <div class="history-item-icon ${iconClass}">${icon}</div>
        <div class="history-item-info">
          <div class="history-item-title">${escapeHtml(title)}</div>
          <div class="history-item-desc">${escapeHtml(desc)}</div>
        </div>
        <div class="history-item-amount">
          <div class="amount ${amountClass}">${(tx.type === 'withdraw' || tx.type === 'supplier_payment' || (tx.type === 'money_transfer' && tx.category === 'تحويلات - خروج')) ? '-' : '+'}${fmt(tx.amount)}</div>
          <div class="time">${time}</div>
        </div>
      </div>
    `;
  }).join('');
}

// Close modal when clicking outside
document.getElementById('drawerHistoryModal')?.addEventListener('click', function(e) {
  if (e.target === this) closeDrawerHistoryModal();
});

// ═══════════════════════════════════════════════════════════════
// 🆕 COLLAPSIBLE TRANSACTIONS SECTION
// ═══════════════════════════════════════════════════════════════

function toggleTransactionsSection() {
  const section = document.getElementById('transactionsSection');
  if (!section) return;

  section.classList.toggle('collapsed');

  // حفظ الحالة في localStorage
  const isCollapsed = section.classList.contains('collapsed');
  localStorage.setItem('drawer_transactions_collapsed', isCollapsed ? '1' : '0');
}

// استعادة حالة الطي عند فتح الـ modal
function restoreTransactionsCollapseState() {
  const section = document.getElementById('transactionsSection');
  if (!section) return;

  const isCollapsed = localStorage.getItem('drawer_transactions_collapsed') === '1';
  if (isCollapsed) {
    section.classList.add('collapsed');
  } else {
    section.classList.remove('collapsed');
  }
}

// Filter Cash Transactions
function filterCashTransactions(filter) {
  // Update active tab - يدعم كل من التصميم القديم والجديد
  document.querySelectorAll('.cash-tab-btn, .drawer-tab-btn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.filter === filter);
  });

  // Render filtered transactions
  renderCashTransactionsList(filter);
}

// Render Cash Transactions List
function renderCashTransactionsList(filter = 'all') {
  const listEl = document.getElementById('drawerTransactionsList');
  if (!listEl) return;
  
  // Combine sales and shift transactions
  let allTransactions = [];
  
  // Add sales from currentCashData
  // ⚠️ نستبعد البيع الآجل (deferred) لأنه لا يدخل فلوس فعلية للدرج
  // ⚠️ البيع الآجل ممكن يكون: 'deferred', 'DEFERRED', 'credit' أو أي صيغة
  if (currentCashData && currentCashData.sales) {
    currentCashData.sales.forEach(sale => {
      const pm = (sale.payment_method || 'cash').toLowerCase();
      const isDeferred = pm === 'deferred' || pm === 'credit';

      // ✅ البيع الآجل الكامل: لا يدخل فلوس → لا يظهر في الدرج
      // ⚠️ paid_now في بعض الفواتير القديمة = sell_price حتى لو آجل
      if (isDeferred) {
        // لا نعرض البيع الآجل في حركات الدرج نهائياً
        // الفلوس الفعلية اللي دخلت مسجلة في cash_ledger وبتظهر من هناك
        return;
      }

      const paidAmount = Number(sale.paid_now || 0);
      // إذا كان المبلغ المدفوع = 0، لا نعرضه في حركات الدرج
      if (paidAmount === 0) {
        return;
      }
      allTransactions.push({
        type: 'sale',
        amount: paidAmount,
        title: `${sale.type || ''} ${sale.model || 'جهاز'}`.trim(),
        description: sale.customer_name || sale.client_name || 'عميل',
        created_at: sale.created_at,
        method: sale.payment_method || 'cash',
        isDeferred: false
      });
    });
  }
  
  // Add deposits and withdraws from localStorage
  // ⚠️ نستبعد دفعات الموردين والعملاء من العرض (تظهر في أماكنها المخصصة)
  const shiftTx = getShiftTransactions();
  shiftTx.forEach(tx => {
    // تجاهل دفعات الموردين والعملاء - هذه تظهر في أقسامها المخصصة
    if (tx.type === 'supplier_payment' || tx.type === 'client_payment') {
      return;
    }
    allTransactions.push({
      type: tx.type,
      amount: tx.amount,
      title: tx.category,
      description: tx.description,
      created_at: tx.created_at
    });
  });

  // Add ledger transactions from database (POS purchases, etc.)
  // ⚠️ نتجاهل عمليات الخزنة الرئيسية لأنها ليست عمليات درج الكاش
  if (currentCashData && currentCashData.ledgerTransactions) {
    // العمليات التي نتجاهلها - عمليات الخزنة الرئيسية:
    const ignoredRefs = [
      'sale', 'accessory_sale',           // مبيعات - معروضة من جدول sales
      'purchase', 'device_purchase',       // شراء أجهزة من موردين
      'accessory_purchase', 'accessory_invoice', // شراء إكسسوارات من موردين
      'supplier_payment',                  // سداد موردين
      'expense', 'safe_expense',           // مصروفات الخزنة
      'capital_withdrawal',                // سحب رأس مال
      'loan_payment',                      // سداد قرض
      'partner_withdrawal'                 // سحب شريك
    ];

    currentCashData.ledgerTransactions.forEach(tx => {
      // تجاهل عمليات البيع - أصلاً معروضة من المبيعات
      if (ignoredRefs.includes(tx.ref)) {
        return;
      }

      // تجاهل مبيعات الإكسسوارات (ref = accessory_sale_123)
      if (tx.ref && tx.ref.startsWith('accessory_sale_')) {
        return;
      }

      // تجاهل سداد الموردين والشركاء - عمليات خزنة
      if (tx.ref && (tx.ref.startsWith('supplier_payment_') || tx.ref.startsWith('partner_'))) {
        return;
      }

      // ✅ تجاهل عمليات الخزنة الأخرى (kind='out')
      if (tx.kind === 'out' && tx.ref && [
        'device_purchase', 'purchase', 'accessory_purchase', 'accessory_invoice',
        'supplier_payment', 'expense', 'safe_expense', 'capital_withdrawal',
        'loan_payment', 'partner_withdrawal'
      ].includes(tx.ref)) {
        return;
      }

      // ✅ تجاهل مرتجعات التوريد (purchase returns) - هذه تذهب للخزنة الرئيسية وليس درج الكاش
      // مرتجعات التوريد تكون kind='in' (فلوس داخلة من المورد)
      // ⚠️ لا نتجاهل 'return' أو 'accessory_return' لأنها مرتجعات مبيعات للعميل (kind='out')
      if (tx.kind === 'in' && tx.ref && (
          tx.ref === 'purchase_return_settlement' ||
          tx.ref === 'invoice_return' ||
          tx.ref === 'quick_return' ||
          tx.ref.includes('purchase_return')
      )) {
        return;
      }

      const isWithdraw = tx.kind === 'out';

      // تسميات المحافظ
      const walletLabels = {
        'cash': 'كاش',
        'mobile_wallet': 'محفظة',
        'bank': 'بنك'
      };
      const walletLabel = tx.wallet_type && tx.wallet_type !== 'cash' ? ` (${walletLabels[tx.wallet_type] || tx.wallet_type})` : '';

      // تحديد نوع العملية والعنوان والأيقونة والوصف
      let txType = isWithdraw ? 'withdraw' : 'deposit';
      let title = isWithdraw ? 'مسحوبات' : 'إيداع';
      let icon = isWithdraw ? '📤' : '📥';
      let description = '';

      if (tx.ref === 'pos_purchase') {
        txType = 'withdraw';
        title = 'شراء جهاز (POS)' + walletLabel;
        icon = '📱';
        description = tx.note || 'شراء جهاز من نقطة البيع';
      } else if (tx.ref === 'safe_withdraw') {
        txType = 'deposit';
        title = 'تحويل من الخزنة' + walletLabel;
        icon = '🏦';
        description = tx.note || 'تحويل رصيد من الخزنة الرئيسية لدرج الكاش';
      } else if (tx.ref === 'drawer_transfer') {
        txType = 'deposit';
        title = 'تحويل للدرج' + walletLabel;
        icon = '💰';
        description = tx.note || 'تحويل رصيد للدرج';
      } else if (tx.ref === 'return') {
        txType = 'withdraw';
        title = 'مرتجع مبيعات' + walletLabel;
        icon = '↩️';
        description = tx.note || 'مرتجع مبيعات جهاز للعميل';
      } else if (tx.ref === 'accessory_return') {
        txType = 'withdraw';
        title = 'مرتجع إكسسوار' + walletLabel;
        icon = '↩️';
        description = tx.note || 'مرتجع إكسسوار للعميل';
      } else if (tx.ref === 'repair_part_return') {
        txType = 'withdraw';
        title = 'مرتجع قطعة غيار' + walletLabel;
        icon = '↩️';
        description = tx.note || 'مرتجع قطعة غيار للعميل';
      } else if (tx.ref === 'client_payment' || (tx.ref && tx.ref.startsWith('client_payment_'))) {
        txType = 'deposit';
        title = 'تحصيل من عميل' + walletLabel;
        icon = '💵';
        description = tx.note || 'تحصيل دفعة من عميل';
      } else if (tx.ref === 'expense') {
        txType = 'withdraw';
        title = 'مصروفات' + walletLabel;
        icon = '💸';
        description = tx.note || 'مصروفات';
      } else if (tx.ref && tx.ref.startsWith('repair_part_sale_')) {
        txType = 'sale';
        title = 'بيع قطعة غيار' + walletLabel;
        icon = '🔧';
        description = tx.note || 'بيع قطعة غيار';
      } else if (tx.ref && tx.ref.startsWith('money_transfer_out_')) {
        txType = 'withdraw';
        title = 'تحويلات - خروج' + walletLabel;
        icon = '💱';
        description = tx.note || 'سحب لخدمة تحويل رصيد';
      } else if (tx.ref && tx.ref.startsWith('money_transfer_in_')) {
        txType = 'deposit';
        title = 'تحويلات - دخول' + walletLabel;
        icon = '💱';
        description = tx.note || 'إيداع من خدمة تحويل رصيد';
      } else if (tx.ref && tx.ref.startsWith('money_transfer_commission_')) {
        txType = 'deposit';
        title = 'تحويلات - عمولة' + walletLabel;
        icon = '💱';
        description = tx.note || 'عمولة خدمة تحويل رصيد';
      } else if (tx.ref === 'wallet_transfer') {
        txType = isWithdraw ? 'withdraw' : 'deposit';
        title = 'تحويل بين محافظ' + walletLabel;
        icon = '🔄';
        description = tx.note || 'تحويل رصيد بين المحافظ';
      } else {
        // حركات غير معروفة - نعرض الملاحظة أو وصف عام
        description = tx.note || (isWithdraw ? 'سحب من الدرج' : 'إيداع في الدرج');
      }

      allTransactions.push({
        type: txType,
        amount: Number(tx.amount || 0),
        title: title,
        description: description,
        created_at: tx.created_at,
        icon: icon,
        isLedger: true // علامة إنها من الداتابيز
      });
    });
  }

  // Sort by date (newest first) - memoize if same data
  allTransactions.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
  
  // Filter
  if (filter !== 'all') {
    if (filter === 'sales') {
      allTransactions = allTransactions.filter(tx => tx.type === 'sale');
    } else if (filter === 'deposits') {
      allTransactions = allTransactions.filter(tx => tx.type === 'deposit' || tx.type === 'client_payment');
    } else if (filter === 'withdraws') {
      allTransactions = allTransactions.filter(tx => tx.type === 'withdraw' || tx.type === 'supplier_payment');
    }
  }
  
  if (allTransactions.length === 0) {
    listEl.innerHTML = '<div style="text-align: center; padding: 40px; color: var(--muted);">لا توجد حركات</div>';
    PerfMonitor.end('renderCashTransactionsList');
    return;
  }
  
  PerfMonitor.start('renderCashTransactionsList');
  
  // ✅ PATCH 1: Use DocumentFragment + virtualization + pre-parse dates
  const fragment = document.createDocumentFragment();
  const shouldVirtualize = allTransactions.length > VIRTUAL_LIST_THRESHOLD;
  const itemsToRender = shouldVirtualize ? allTransactions.slice(0, VIRTUAL_LIST_WINDOW) : allTransactions;
  
  // Pre-parse dates to avoid repeated parsing
  const transactionsWithParsedDates = itemsToRender.map(tx => ({
    ...tx,
    parsedTime: tx.created_at ? new Date(tx.created_at).toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' }) : ''
  }));
  
  transactionsWithParsedDates.forEach(tx => {
    const time = tx.parsedTime;
    
    let iconClass = 'sale';
    let icon = tx.icon || '🧾';
    let itemClass = 'sale-item';
    let valueClass = 'positive';
    let sign = '+';

    if (tx.type === 'deposit' || tx.type === 'client_payment') {
      iconClass = 'deposit';
      icon = tx.icon || (tx.type === 'client_payment' ? '💰' : '📥');
      itemClass = 'deposit-item';
      valueClass = 'positive';
      sign = '+';
    } else if (tx.type === 'withdraw' || tx.type === 'supplier_payment') {
      iconClass = 'withdraw';
      icon = tx.icon || (tx.type === 'supplier_payment' ? '💸' : '📤');
      itemClass = 'withdraw-item';
      valueClass = 'negative';
      sign = '-';
    }
    
    const div = document.createElement('div');
    div.className = `cash-tx-item ${itemClass}`;
    div.innerHTML = `
      <div class="cash-tx-item-icon ${iconClass}">${icon}</div>
      <div class="cash-tx-item-info">
        <div class="cash-tx-item-title">${tx.title}</div>
        <div class="cash-tx-item-desc">${tx.description}</div>
      </div>
      <div class="cash-tx-item-amount">
        <div class="cash-tx-item-value ${valueClass}">${sign}${fmt(tx.amount)}</div>
        <div class="cash-tx-item-time">${time}</div>
      </div>
    `;
    fragment.appendChild(div);
  });
  
  // Clear and append in one operation
  listEl.innerHTML = '';
  listEl.appendChild(fragment);
  
  // Show "load more" indicator if virtualized
  if (shouldVirtualize && allTransactions.length > VIRTUAL_LIST_WINDOW) {
    const loadMoreDiv = document.createElement('div');
    loadMoreDiv.style.cssText = 'text-align: center; padding: 12px; color: var(--muted); font-size: 12px;';
    loadMoreDiv.textContent = `عرض ${VIRTUAL_LIST_WINDOW} من ${allTransactions.length} عملية`;
    listEl.appendChild(loadMoreDiv);
  }
  
  PerfMonitor.end('renderCashTransactionsList');
}

// Override loadCashDrawerData to include local transactions + accessories
const originalLoadCashDrawerData = loadCashDrawerData;
loadCashDrawerData = async function() {
  UILoader.show('جاري تحميل بيانات الدرج...', 'cash');
  try {
    // 🔧 استخدام التاريخ المحلي بدل UTC
    const now = new Date();
    const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;

    // ✅ v1.2.4: Get current user for per-user filtering
    const currentUser = window.currentUser || JSON.parse(localStorage.getItem('currentUser') || '{}');
    const userId = currentUser?.id;
    const userFilter = userId ? `&user_id=${userId}` : '';
    // 🔍 DEBUG: Log user info for troubleshooting
    console.log('[CASH-DRAWER] 🔐 Current User:', {
      fromWindow: window.currentUser,
      fromLocalStorage: localStorage.getItem('currentUser'),
      userId: userId,
      username: currentUser?.username,
      userFilter: userFilter
    });

    // ✅ v1.2.4: Get last closing time FIRST to determine date range
    const closingTimeKeyOverride = getLastClosingTimeKey();
    const lastClosingTime = SessionCache.get(closingTimeKeyOverride, false) || null;

    // تحديد تاريخ البداية للجلب
    let fromDate = today;
    if (lastClosingTime) {
      // استخراج التاريخ من وقت آخر تقفيل
      let closingDateStr = lastClosingTime;
      if (closingDateStr.includes('T')) {
        fromDate = closingDateStr.split('T')[0];
      } else if (closingDateStr.includes(' ')) {
        fromDate = closingDateStr.split(' ')[0];
      } else {
        fromDate = closingDateStr.substring(0, 10);
      }
    } else {
      // لو مفيش تقفيل سابق، نجيب من 30 يوم للخلف
      const thirtyDaysAgo = new Date(now);
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
      fromDate = `${thirtyDaysAgo.getFullYear()}-${String(thirtyDaysAgo.getMonth() + 1).padStart(2, '0')}-${String(thirtyDaysAgo.getDate()).padStart(2, '0')}`;
    }

    // ✅ v1.2.4: Load device sales from last closing date to today (with user filter)
    // ✅ FIX: include_returned=true لأن المرتجعات بتتحسب في salesCash ثم تتخصم بشكل منفصل من returnsTotalCash
    const salesURL = `elos-db://sales?from=${fromDate}&to=${today}${userFilter}&include_returned=true`;
    console.log('[CASH-DRAWER] 🔍 Fetching sales from:', salesURL);
    const salesRes = await fetch(salesURL);
    if (!salesRes.ok) throw new Error('فشل تحميل المبيعات');
    const deviceSales = await salesRes.json();

    // 🔍 DEBUG v1.2.5: Log returned sales with their user_ids
    console.log('[CASH-DRAWER] 🔍 Sales received:', deviceSales.length);
    if (deviceSales.length > 0) {
      const salesInfo = deviceSales.map(s => ({
        id: s.id,
        user_id: s.user_id,
        username: s.username,
        amount: s.sell_price
      }));
      console.log('[CASH-DRAWER] 🔍 Sales details:', salesInfo);
    }

    // ✅ v1.2.4: Load accessory sales from last closing date to today (with user filter)
    // ✅ FIX: نضيف include_returned=true عشان نشوف المبيعات المرتجعة
    // لأن cash_ledger فيه البيعة الأصلية (kind='in') + المرتجع (kind='out') ولازم الفرونتند يكون متسق
    const accessoryRes = await fetch(`elos-db://accessory-movements?type=sale&include_returned=true&from=${fromDate}&to=${today}${userFilter}`);
    let accessorySales = [];
    if (accessoryRes.ok) {
      const accessoryData = await accessoryRes.json();
      accessorySales = Array.isArray(accessoryData) ? accessoryData : (accessoryData.movements || []);
      Logger.log('[CASH-DRAWER] Accessory sales loaded:', accessorySales.length);
    }

    Logger.log('[CASH-DRAWER] 📊 Data loaded:', {
      deviceSales: deviceSales.length,
      accessorySales: accessorySales.length,
      fromDate: fromDate,
      lastClosingTime: lastClosingTime || 'NO CLOSING TIME (showing all sales from ' + fromDate + ')'
    });

    // Filter completed AND returned device sales after last closing
    // ✅ نحسب المرتجعة لأن المرتجعات تُخصم بشكل منفصل من المحفظة المختارة
    let completedDeviceSales = deviceSales.filter(s => s.status === 'completed' || s.status === 'returned');
    let filteredAccessorySales = [...accessorySales];

    if (lastClosingTime) {
      // 🔧 Fix: معالجة صيغة التاريخ من DB (بدون T) لتكون local time
      let closingDateStr = lastClosingTime;
      if (closingDateStr && !closingDateStr.includes('T') && !closingDateStr.includes('Z')) {
        closingDateStr = closingDateStr.replace(' ', 'T');
      }
      const closingTimestamp = new Date(closingDateStr).getTime();

      completedDeviceSales = completedDeviceSales.filter(s => {
        let saleDateTime = s.created_at;
        // 🔧 Fix: معالجة صيغة التاريخ - كلاهما local time
        if (saleDateTime && !saleDateTime.includes('T') && !saleDateTime.includes('Z')) {
          saleDateTime = saleDateTime.replace(' ', 'T');
        }
        return new Date(saleDateTime).getTime() > closingTimestamp;
      });

      filteredAccessorySales = filteredAccessorySales.filter(s => {
        let saleDateTime = s.created_at;
        // 🔧 Fix: معالجة صيغة التاريخ - كلاهما local time
        if (saleDateTime && !saleDateTime.includes('T') && !saleDateTime.includes('Z')) {
          saleDateTime = saleDateTime.replace(' ', 'T');
        }
        return new Date(saleDateTime).getTime() > closingTimestamp;
      });
    }

    // Calculate sales totals by payment method
    let salesCash = 0;
    let salesCard = 0;
    let salesTransfer = 0;

    // Device sales
    completedDeviceSales.forEach(sale => {
      // ✅ FIX: للبيع الآجل نستخدم paid_now فقط (لا نستخدم sell_price كـ fallback)
      // إذا كان البيع آجل (deferred) أو له remaining > 0، نستخدم paid_now فقط
      const isDeferred = sale.payment_method === 'deferred' || Number(sale.remaining || 0) > 0;
      const paidAmount = isDeferred
        ? Number(sale.paid_now || 0)  // للآجل: فقط المدفوع فعلياً
        : Number(sale.paid_now || sale.sell_price || 0);  // للعادي: paid_now أو sell_price

      // تجاهل البيع الآجل الكامل (لم يدفع شيء)
      if (paidAmount === 0) return;

      const method = sale.payment_method || 'cash';

      switch (method) {
        case 'cash':
          salesCash += paidAmount;
          break;
        case 'mobile_wallet':
        case 'card': // للتوافق مع البيانات القديمة
          salesCard += paidAmount;
          break;
        case 'bank':
        case 'transfer': // للتوافق مع البيانات القديمة
          salesTransfer += paidAmount;
          break;
        case 'deferred':
          // ✅ للبيع الآجل: إضافة المدفوع للمحفظة المناسبة
          // إذا دفع جزء، يتم تسجيله حسب المحفظة المستخدمة
          if (paidAmount > 0 && sale.payment_methods) {
            try {
              const methods = typeof sale.payment_methods === 'string'
                ? JSON.parse(sale.payment_methods)
                : sale.payment_methods;
              methods.forEach(pm => {
                const amt = Number(pm.amount || 0);
                if (pm.method === 'cash') salesCash += amt;
                else if (pm.method === 'mobile_wallet' || pm.method === 'card') salesCard += amt;
                else if (pm.method === 'bank' || pm.method === 'transfer') salesTransfer += amt;
                else salesCash += amt;
              });
            } catch (e) {
              // fallback: add to cash
              salesCash += paidAmount;
            }
          }
          break;
        default:
          salesCash += paidAmount;
      }
    });

    // Accessory sales
    filteredAccessorySales.forEach(sale => {
      // ✅ FIX: للبيع الآجل نستخدم paid_amount فقط (لا نستخدم total_price كـ fallback)
      const isDeferred = sale.payment_method === 'deferred' || Number(sale.remaining || 0) > 0;
      const paidAmount = isDeferred
        ? Number(sale.paid_amount || 0)  // للآجل: فقط المدفوع فعلياً
        : Number(sale.paid_amount || sale.total_price || 0);  // للعادي: paid_amount أو total_price

      // تجاهل البيع الآجل الكامل (لم يدفع شيء)
      if (paidAmount === 0) return;

      const method = sale.payment_method || 'cash';

      switch (method) {
        case 'cash':
          salesCash += paidAmount;
          break;
        case 'mobile_wallet':
        case 'card': // للتوافق مع البيانات القديمة
          salesCard += paidAmount;
          break;
        case 'bank':
        case 'transfer': // للتوافق مع البيانات القديمة
          salesTransfer += paidAmount;
          break;
        case 'deferred':
          // ✅ للبيع الآجل: إضافة المدفوع للمحفظة المناسبة
          if (paidAmount > 0 && sale.payment_methods) {
            try {
              const methods = typeof sale.payment_methods === 'string'
                ? JSON.parse(sale.payment_methods)
                : sale.payment_methods;
              methods.forEach(pm => {
                const amt = Number(pm.amount || 0);
                if (pm.method === 'cash') salesCash += amt;
                else if (pm.method === 'mobile_wallet' || pm.method === 'card') salesCard += amt;
                else if (pm.method === 'bank' || pm.method === 'transfer') salesTransfer += amt;
                else salesCash += amt;
              });
            } catch (e) {
              salesCash += paidAmount;
            }
          }
          break;
        default:
          salesCash += paidAmount;
      }
    });

    // Calculate profit (for admin only)
    let profitTotal = 0;
    // Device sales profit: sell_price - discount - purchase_cost
    // ✅ FIX: المرتجعات لا تُحسب في الربح - الصفقة ألغيت فلا ربح ولا خسارة
    completedDeviceSales.forEach(sale => {
      if (sale.status === 'returned') return; // مرتجع → تجاهل تماماً
      const sellPrice = Number(sale.sell_price || 0);
      const discount = Number(sale.discount || 0);
      const buyPrice = Number(sale.purchase_cost || 0);
      profitTotal += sellPrice - discount - buyPrice;
    });
    // Accessory sales profit: total_price (after discount) - cost
    // ✅ FIX: المرتجعات لا تُحسب في الربح
    filteredAccessorySales.forEach(sale => {
      if (sale.status === 'returned') return; // مرتجع → تجاهل تماماً
      const quantity = Math.abs(Number(sale.quantity || 1));
      const discount = Number(sale.discount || 0);
      const costPrice = Number(sale.purchase_price || 0);
      // ✅ FIX: استخدام total_price (بعد الخصم) بدل unit_price (قبل الخصم)
      const revenue = Number(sale.total_price || 0) || ((Number(sale.unit_price || 0) * quantity) - discount);
      profitTotal += revenue - (costPrice * quantity);
    });

    // ✅ FIX: مبيعات قطع الغيار من الـ ledger
    let repairPartsSalesCash = 0;
    let repairPartsSalesMobile = 0;
    let repairPartsSalesBank = 0;
    let repairPartsSalesCount = 0;

    // Get deposits and withdraws from localStorage
    const shiftTx = getShiftTransactions();
    // 🔧 إيداعات وسحوبات مفصلة حسب المحفظة
    let depositsTotalCash = 0;
    let depositsTotalMobile = 0;
    let depositsTotalBank = 0;
    let withdrawsTotalCash = 0;
    let withdrawsTotalMobile = 0;
    let withdrawsTotalBank = 0;
    let depositsCount = 0;
    let withdrawsCount = 0;

    // 🔧 مرتجعات مفصلة (منفصلة عن السحوبات اليدوية)
    let returnsTotalCash = 0;
    let returnsTotalMobile = 0;
    let returnsTotalBank = 0;
    let returnsCount = 0;

    // تحصيلات العملاء مفصلة حسب المحفظة (تُضاف للمبيعات)
    let clientPaymentsCash = 0;
    let clientPaymentsMobile = 0;
    let clientPaymentsBank = 0;

    // 🆕 إيداعات وسحوبات حسب المحفظة (للتحويلات والعمليات اليدوية)
    // ✅ دعم wallet_id للمحافظ الجديدة
    let walletDeposits = { cash: 0, mobile_wallet: 0, bank: 0 }; // للتوافق العكسي
    let walletWithdraws = { cash: 0, mobile_wallet: 0, bank: 0 }; // للتوافق العكسي
    let walletDepositsById = {}; // ✅ للمحافظ الجديدة
    let walletWithdrawsById = {}; // ✅ للمحافظ الجديدة

    // Filter by last closing time
    shiftTx.forEach(tx => {
      if (lastClosingTime) {
        // 🔧 Fix: معالجة صيغة التاريخ
        let closingDateStr = lastClosingTime;
        if (closingDateStr && !closingDateStr.includes('T') && !closingDateStr.includes('Z')) {
          closingDateStr = closingDateStr.replace(' ', 'T');
        }
        let txDateTime = tx.created_at;
        if (txDateTime && !txDateTime.includes('T') && !txDateTime.includes('Z')) {
          txDateTime = txDateTime.replace(' ', 'T');
        }
        const txTime = new Date(txDateTime).getTime();
        if (txTime <= new Date(closingDateStr).getTime()) {
          return; // Skip transactions before last closing
        }
      }

      const wallet = tx.wallet || 'cash';

      if (tx.type === 'wallet_transfer') {
        // 🔧 تحويل بين محافظ الدرج - نقل داخلي فقط
        const amount = Number(tx.amount || 0);
        
        // ✅ دعم wallet_id للمحافظ الجديدة
        if (tx.fromWalletId && tx.toWalletId) {
          walletWithdrawsById[tx.fromWalletId] = (walletWithdrawsById[tx.fromWalletId] || 0) + amount;
          walletDepositsById[tx.toWalletId] = (walletDepositsById[tx.toWalletId] || 0) + amount;
        }
        
        // للتوافق العكسي
        if (tx.fromWallet) walletWithdraws[tx.fromWallet] = (walletWithdraws[tx.fromWallet] || 0) + amount;
        if (tx.toWallet) walletDeposits[tx.toWallet] = (walletDeposits[tx.toWallet] || 0) + amount;
        // التحويلات لا تؤثر على الإجمالي - مجرد نقل داخلي
      } else if (tx.type === 'client_payment') {
        // تحصيلات العملاء - نفصلها حسب المحفظة
        const walletType = tx.wallet_type || 'cash';
        if (walletType === 'mobile_wallet') {
          clientPaymentsMobile += tx.amount;
        } else if (walletType === 'bank') {
          clientPaymentsBank += tx.amount;
        } else {
          clientPaymentsCash += tx.amount;
        }
        depositsCount++;
      } else if (tx.type === 'deposit') {
        // 🔧 إيداع حسب المحفظة - مفصل
        // ⚠️ نتجاهل الحركات المحفوظة في DB عشان منحسبهاش مرتين
        if (!tx.savedToDb) {
          const amount = Number(tx.amount || 0);
          
          // ✅ دعم wallet_id للمحافظ الجديدة
          if (tx.wallet_id) {
            walletDepositsById[tx.wallet_id] = (walletDepositsById[tx.wallet_id] || 0) + amount;
          }
          
          // للتوافق العكسي
          walletDeposits[wallet] = (walletDeposits[wallet] || 0) + amount;
        }
        // لا نضيف التحويلات للإجمالي (لأنها مجرد نقل)
        if (tx.category !== 'تحويل' && !tx.transfer_id) {
          if (wallet === 'mobile_wallet') {
            depositsTotalMobile += Number(tx.amount || 0);
          } else if (wallet === 'bank') {
            depositsTotalBank += Number(tx.amount || 0);
          } else {
            depositsTotalCash += Number(tx.amount || 0);
          }
        }
        depositsCount++;
      } else if (tx.type === 'withdraw' || tx.type === 'supplier_payment') {
        // 🔧 سحب حسب المحفظة - مفصل
        // ⚠️ نتجاهل الحركات المحفوظة في DB عشان منحسبهاش مرتين
        if (!tx.savedToDb) {
          const amount = Number(tx.amount || 0);

          // ✅ FIX: تسجيل السحب بالـ wallet_id (زي الإيداع بالظبط)
          if (tx.wallet_id) {
            walletWithdrawsById[tx.wallet_id] = (walletWithdrawsById[tx.wallet_id] || 0) + amount;
          }

          // للتوافق العكسي
          walletWithdraws[wallet] = (walletWithdraws[wallet] || 0) + amount;
        }
        // لا نضيف التحويلات للإجمالي (لأنها مجرد نقل)
        if (tx.category !== 'تحويل' && !tx.transfer_id) {
          if (wallet === 'mobile_wallet') {
            withdrawsTotalMobile += Number(tx.amount || 0);
          } else if (wallet === 'bank') {
            withdrawsTotalBank += Number(tx.amount || 0);
          } else {
            withdrawsTotalCash += Number(tx.amount || 0);
          }
        }
        withdrawsCount++;
      }
    });

    // ✅ FIX: تحصيلات العملاء تُحسب منفصلة عن المبيعات
    // كانت تُضاف للمبيعات وده غلط محاسبياً - التحصيلات بند مختلف
    // salesCash += clientPaymentsCash; // ❌ REMOVED - was causing double-counting
    // salesCard += clientPaymentsMobile; // ❌ REMOVED
    // salesTransfer += clientPaymentsBank; // ❌ REMOVED

    // ✅ v1.2.4: Get cash_ledger transactions from last closing date to today (with user filter)
    const ledgerRes = await fetch(`elos-db://cash-ledger?from=${fromDate}&to=${today}${userFilter}`);
    let ledgerTransactions = [];
    if (ledgerRes.ok) {
      ledgerTransactions = await ledgerRes.json();
      Logger.log('[CASH-DRAWER] Ledger transactions loaded:', ledgerTransactions.length);
    }

    // Filter ledger transactions after last closing
    let filteredLedgerTx = [...ledgerTransactions];
    if (lastClosingTime) {
      // 🔧 Fix: معالجة صيغة التاريخ من DB (بدون T) لتكون local time
      let closingDateStr = lastClosingTime;
      if (closingDateStr && !closingDateStr.includes('T') && !closingDateStr.includes('Z')) {
        closingDateStr = closingDateStr.replace(' ', 'T');
      }
      const closingTimestamp = new Date(closingDateStr).getTime();
      filteredLedgerTx = filteredLedgerTx.filter(tx => {
        let txDateTime = tx.created_at;
        // 🔧 Fix: معالجة صيغة التاريخ - كلاهما local time
        if (txDateTime && !txDateTime.includes('T') && !txDateTime.includes('Z')) {
          txDateTime = txDateTime.replace(' ', 'T');
        }
        return new Date(txDateTime).getTime() > closingTimestamp;
      });
    }

    // Add ledger deposits and withdrawals to totals
    // ⚠️ نفرق بين أنواع العمليات:
    // - sale: بيع جهاز (لا نحسبه هنا - أصلاً محسوب من جدول sales)
    // - accessory_sale: بيع إكسسوار (لا نحسبه - محسوب من accessory_movements)
    // - pos_purchase: شراء جهاز (يتسجل كمشتريات)
    // - safe_withdraw: سحب من الخزنة (لا يتسجل تاني - أصلاً في الخزنة)
    // - return/accessory_return/repair_part_return: مرتجعات
    let posPurchasesTotal = 0;
    let posPurchasesCount = 0;
    // مشتريات POS مفصلة حسب نوع المحفظة
    let posPurchasesCash = 0;
    let posPurchasesMobile = 0;
    let posPurchasesBank = 0;
    // سحب من الخزنة مفصل حسب نوع المحفظة (لا يتسجل في التقفيل - أصلاً في الخزنة)
    let safeWithdrawsTotal = 0;
    let safeWithdrawsCash = 0;
    let safeWithdrawsMobile = 0;
    let safeWithdrawsBank = 0;

    // العمليات التي لا نحسبها (لأنها محسوبة من مصادر أخرى)
    const ignoredRefs = ['sale', 'accessory_sale'];

    // 💱 تتبع عمولات التحويلات
    let transferCommissionsTotal = 0;
    let transferCount = 0;
    // 💱 تحويلات خارجة من الدرج (عادية أو آجلة) - تخصم من المتوقع وتظهر في تفاصيل الشفت والخزنة
    let transfersOutCash = 0;
    let transfersOutMobile = 0;
    let transfersOutBank = 0;
    let transfersOutCount = 0;
    // 💱 تحويلات واردة للدرج (الطرف الآخر من التحويل) - لتسجيل الدخول في المحفظة الهدف بالخزنة
    let transfersInCash = 0;
    let transfersInMobile = 0;
    let transfersInBank = 0;

    filteredLedgerTx.forEach(tx => {
      // تجاهل عمليات البيع لأنها محسوبة من جداول sales و accessory_movements
      if (ignoredRefs.includes(tx.ref)) {
        return;
      }

      // ✅ تجاهل مبيعات الإكسسوارات (ref = accessory_sale_123)
      // لأنها أصلاً محسوبة من accessory_movements
      if (tx.ref && tx.ref.startsWith('accessory_sale_')) {
        return;
      }

      // ✅ تجاهل عمليات الموردين - هذه عمليات خزنة وليست عمليات POS
      // سداد الموردين يتم من صفحة الموردين ويسجل في الخزنة مباشرة
      if (tx.ref && tx.ref.startsWith('supplier_payment_')) {
        return;
      }

      // ✅ تجاهل مشتريات الأجهزة والإكسسوارات من الموردين (صفحات المشتريات)
      // هذه تختلف عن pos_purchase اللي هي شراء من نقطة البيع مباشرة
      if (tx.ref === 'device_purchase' || tx.ref === 'purchase' ||
          tx.ref === 'accessory_purchase' || tx.ref === 'accessory_invoice') {
        return;
      }

      // ✅ تجاهل مرتجعات التوريد (purchase returns) - هذه تذهب للخزنة الرئيسية وليس درج الكاش
      // مرتجعات التوريد تكون kind='in' (فلوس داخلة من المورد)
      // أما مرتجعات المبيعات (return, accessory_return) تكون kind='out' (فلوس خارجة للعميل) - هذه يجب حسابها
      if (tx.kind === 'in' && tx.ref && (
          tx.ref === 'purchase_return_settlement' ||
          tx.ref === 'invoice_return' ||
          tx.ref === 'quick_return' ||
          tx.ref.includes('purchase_return')
      )) {
        return;
      }

      // 💱 تتبع عمولات التحويلات - نتبعها ونخرج (return) عشان لا تتحسب كإيداع يدوي
      if (tx.ref && tx.ref.startsWith('money_transfer_commission_')) {
        transferCommissionsTotal += Number(tx.amount || 0);
        transferCount++;
        return; // ✅ FIX: العمولة تُسجل منفصلة في الخزنة عند التقفيل، لا نحسبها كإيداع
      }

      // ✅ تتبع حركات التحويلات الواردة (money_transfer_in) - ليست إيداعات حقيقية
      // لكن نحتاج نتتبعها عشان نعرف المحفظة الهدف لتسجيلها في الخزنة عند التقفيل
      // التحويل من كاش → إلكتروني: الـ out يُسجل خروج من الكاش، والـ in يُسجل دخول في الإلكتروني
      if (tx.ref && tx.ref.startsWith('money_transfer_in_')) {
        const amount = Number(tx.amount || 0);
        const walletType = tx.wallet_type || 'cash';
        if (walletType === 'mobile_wallet') {
          transfersInMobile += amount;
        } else if (walletType === 'bank') {
          transfersInBank += amount;
        } else {
          transfersInCash += amount;
        }
        return;
      }

      if (tx.kind === 'in') {
        // سحب من الخزنة لدرج الكاش - لا نحسبه كإيداع
        if (tx.ref === 'safe_withdraw') {
          const amount = Number(tx.amount || 0);
          const walletType = tx.wallet_type || 'cash';
          safeWithdrawsTotal += amount;
          // تفصيل حسب نوع المحفظة
          if (walletType === 'mobile_wallet') {
            safeWithdrawsMobile += amount;
          } else if (walletType === 'bank') {
            safeWithdrawsBank += amount;
          } else {
            safeWithdrawsCash += amount;
          }
        } else if (tx.ref && tx.ref.startsWith('repair_part_sale_')) {
          // ✅ FIX: مبيعات قطع الغيار - نحسبها كمبيعات وليس إيداعات
          const amount = Number(tx.amount || 0);
          const walletType = tx.wallet_type || 'cash';
          repairPartsSalesCount++;
          if (walletType === 'mobile_wallet') {
            repairPartsSalesMobile += amount;
          } else if (walletType === 'bank') {
            repairPartsSalesBank += amount;
          } else {
            repairPartsSalesCash += amount;
          }
        } else if (tx.ref && tx.ref.startsWith('client_payment_')) {
          // ✅ FIX: تحصيلات العملاء - لا نحسبها كإيداعات يدوية
          // لأنها أصلاً محسوبة من shiftTx (localStorage) ومضافة على salesCash
          // نتجاهلها هنا لمنع الحساب المزدوج
          Logger.log('[CASH-DRAWER] Skipping client_payment from cash_ledger (already counted from localStorage):', tx.ref, tx.amount);
        } else {
          // إيداعات يدوية حسب نوع المحفظة
          const amount = Number(tx.amount || 0);
          const walletType = tx.wallet_type || 'cash';
          if (walletType === 'mobile_wallet') {
            depositsTotalMobile += amount;
          } else if (walletType === 'bank') {
            depositsTotalBank += amount;
          } else {
            depositsTotalCash += amount;
          }
          depositsCount++;
        }
      } else if (tx.kind === 'out') {
        // ✅ تجاهل عمليات الخزنة الرئيسية (ليست من درج الكاش)
        // هذه العمليات تتم من صفحات أخرى وتسجل في الخزنة مباشرة
        const safeOnlyRefs = [
          'device_purchase',      // شراء جهاز من مورد
          'purchase',             // مشتريات عامة
          'accessory_purchase',   // شراء إكسسوار من مورد
          'accessory_invoice',    // فاتورة إكسسوارات
          'supplier_payment',     // دفع لمورد
          'expense',              // مصروفات من الخزنة
          'safe_expense',         // مصروفات الخزنة
          'capital_withdrawal',   // سحب رأس مال
          'loan_payment',         // سداد قرض
          'partner_withdrawal'    // سحب شريك
        ];

        // تجاهل عمليات الخزنة
        if (safeOnlyRefs.includes(tx.ref)) {
          return;
        }

        // تجاهل أيضاً لو ref يبدأ بـ supplier_ أو partner_
        if (tx.ref && (tx.ref.startsWith('supplier_') || tx.ref.startsWith('partner_'))) {
          return;
        }

        // ✅ تحويلات المحافظ (عادية أو آجلة): نخصمها من المتوقع في الدرج ونظهرها في تفاصيل الشفت والخزنة (ليست مصروفاً)
        if (tx.ref && tx.ref.startsWith('money_transfer_out_')) {
          const amount = Number(tx.amount || 0);
          const walletType = tx.wallet_type || 'cash';
          if (walletType === 'mobile_wallet') {
            transfersOutMobile += amount;
          } else if (walletType === 'bank') {
            transfersOutBank += amount;
          } else {
            transfersOutCash += amount;
          }
          transfersOutCount++;
          return;
        }

        // شراء POS - نحسبه منفصل (شراء من نقطة البيع مباشرة)
        if (tx.ref === 'pos_purchase') {
          const amount = Number(tx.amount || 0);
          const walletType = tx.wallet_type || 'cash';
          posPurchasesTotal += amount;
          posPurchasesCount++;
          // تفصيل حسب نوع المحفظة
          if (walletType === 'mobile_wallet') {
            posPurchasesMobile += amount;
          } else if (walletType === 'bank') {
            posPurchasesBank += amount;
          } else {
            posPurchasesCash += amount;
          }
        } else if (tx.ref === 'return' || tx.ref === 'accessory_return' || tx.ref === 'repair_part_return') {
          // 🔧 المرتجعات - نسجلها منفصلة عن السحوبات اليدوية لوضوح التقارير
          const amount = Number(tx.amount || 0);
          const walletType = tx.wallet_type || 'cash';
          if (walletType === 'mobile_wallet') {
            returnsTotalMobile += amount;
          } else if (walletType === 'bank') {
            returnsTotalBank += amount;
          } else {
            returnsTotalCash += amount;
          }
          returnsCount++;
          return;
        } else {
          // مسحوبات يدوية من درج الكاش فقط
          // مثل: مصروفات، سحب شخصي، إلخ
          const amount = Number(tx.amount || 0);
          const walletType = tx.wallet_type || 'cash';
          if (walletType === 'mobile_wallet') {
            withdrawsTotalMobile += amount;
          } else if (walletType === 'bank') {
            withdrawsTotalBank += amount;
          } else {
            withdrawsTotalCash += amount;
          }
          withdrawsCount++;
        }
      }
    });

    // 🔧 حساب الإجماليات للعرض (بعد معالجة كل الحركات)
    const depositsTotal = depositsTotalCash + depositsTotalMobile + depositsTotalBank;
    const withdrawsTotal = withdrawsTotalCash + withdrawsTotalMobile + withdrawsTotalBank;
    const returnsTotal = returnsTotalCash + returnsTotalMobile + returnsTotalBank;
    const transfersOutTotal = transfersOutCash + transfersOutMobile + transfersOutBank;
    const transfersInTotal = transfersInCash + transfersInMobile + transfersInBank;

    // Merge all sales for display
    const accessorySalesForDisplay = filteredAccessorySales.map(s => ({
      id: s.id,
      type: '🎧',
      model: s.accessory_name || 'إكسسوار',
      customer_name: s.client_name || '',
      created_at: s.created_at,
      sell_price: Math.abs(s.total_price || 0),
      paid_now: Math.abs(s.paid_amount || s.total_price || 0),
      payment_method: s.payment_method || 'cash',
      isAccessory: true
    }));

    const allSales = [...completedDeviceSales, ...accessorySalesForDisplay];
    allSales.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));

    // ✅ FIX: إضافة مبيعات قطع الغيار للمبيعات الإجمالية
    salesCash += repairPartsSalesCash;
    salesCard += repairPartsSalesMobile;
    salesTransfer += repairPartsSalesBank;

    // ✅ FIX: عدم حساب المرتجعات في عدد المبيعات
    const activeAccessorySales = filteredAccessorySales.filter(s => s.status !== 'returned');
    const totalSalesCount = completedDeviceSales.filter(s => s.status !== 'returned').length + activeAccessorySales.length + repairPartsSalesCount;

    // ✅ إجماليات تحصيلات العملاء
    const clientPaymentsTotal = clientPaymentsCash + clientPaymentsMobile + clientPaymentsBank;

    // Calculate actual drawer balance (الكاش السائل فقط)
    // رصيد الدرج = مبيعات نقدي + تحصيلات عملاء كاش + إيداعات كاش + سحب كاش من الخزنة + عمولات تحويلات + تحويلات واردة (كاش)
    //             - سحوبات كاش - مشتريات POS كاش - مرتجعات كاش - تحويلات كاش خارجة
    // ✅ FIX: إضافة clientPaymentsCash (تحصيلات العملاء بتدخل الكاش)
    // ✅ FIX: إضافة transfersInCash (فلوس دخلت الكاش من عمليات التحويل - العميل بيديك كاش)
    // ✅ FIX: إضافة transferCommissionsTotal (عمولات التحويلات بتدخل الكاش)
    const expectedCash = salesCash + clientPaymentsCash + walletDeposits.cash + safeWithdrawsCash + transferCommissionsTotal + transfersInCash - walletWithdraws.cash - posPurchasesCash - returnsTotalCash - transfersOutCash;
    const salesTotal = salesCash + salesCard + salesTransfer;

    // إجمالي المسحوبات للعرض (يدوية + مشتريات POS - بدون مرتجعات لأنها منفصلة)
    const totalWithdrawsForDisplay = withdrawsTotal + posPurchasesTotal;
    const totalWithdrawsCountForDisplay = withdrawsCount + posPurchasesCount;

    // Store current data
    currentCashData = {
      sales: allSales,
      deviceSales: completedDeviceSales,
      accessorySales: filteredAccessorySales,
      ledgerTransactions: filteredLedgerTx, // عمليات من الداتابيز
      salesCount: totalSalesCount,
      salesCash,
      salesCard,
      salesTransfer,
      salesTotal,
      depositsCount,
      depositsTotal,
      // 🔧 إيداعات مفصلة حسب المحفظة
      depositsTotalCash,
      depositsTotalMobile,
      depositsTotalBank,
      withdrawsCount: totalWithdrawsCountForDisplay, // للعرض
      withdrawsTotal: totalWithdrawsForDisplay, // للعرض
      // 🔧 سحوبات مفصلة حسب المحفظة
      withdrawsTotalCash,
      withdrawsTotalMobile,
      withdrawsTotalBank,
      // بيانات منفصلة للتقفيل
      manualWithdrawsCount: withdrawsCount, // مسحوبات يدوية فقط
      manualWithdrawsTotal: withdrawsTotal, // مسحوبات يدوية فقط
      posPurchasesCount, // مشتريات POS
      posPurchasesTotal, // مشتريات POS
      // مشتريات POS مفصلة حسب المحفظة
      posPurchasesCash,
      posPurchasesMobile,
      posPurchasesBank,
      // 🔧 مرتجعات (منفصلة عن السحوبات اليدوية)
      returnsCount,
      returnsTotal,
      returnsTotalCash,
      returnsTotalMobile,
      returnsTotalBank,
      // سحب من الخزنة (لا يتسجل في التقفيل - أصلاً في الخزنة)
      safeWithdrawsTotal,
      safeWithdrawsCash,
      safeWithdrawsMobile,
      safeWithdrawsBank,
      // 🔧 أرصدة المحافظ الفعلية (تشمل التحويلات)
      walletDeposits,
      walletWithdraws,
      // ✅ تحصيلات العملاء (منفصلة عن المبيعات) - بند مستقل في الخزنة
      clientPaymentsCash,
      clientPaymentsMobile,
      clientPaymentsBank,
      clientPaymentsTotal,
      // أرصدة المحافظ الفعلية في الدرج (تشمل كل التحويلات والعمولات والتحصيلات)
      // ✅ FIX: إضافة clientPayments و transfersIn و transferCommissions وطرح transfersOut
      // لأن التحويلات الداخلية تنقل الفلوس بين المحافظ جوا الدرج
      finalCash: salesCash + clientPaymentsCash + walletDeposits.cash + safeWithdrawsCash + transferCommissionsTotal + transfersInCash - walletWithdraws.cash - posPurchasesCash - returnsTotalCash - transfersOutCash,
      finalMobile: salesCard + clientPaymentsMobile + walletDeposits.mobile_wallet + safeWithdrawsMobile + transfersInMobile - walletWithdraws.mobile_wallet - posPurchasesMobile - returnsTotalMobile - transfersOutMobile,
      finalBank: salesTransfer + clientPaymentsBank + walletDeposits.bank + safeWithdrawsBank + transfersInBank - walletWithdraws.bank - posPurchasesBank - returnsTotalBank - transfersOutBank,
      expectedCash,
      total: expectedCash, // الرصيد الفعلي المتوقع في الدرج
      // 💱 عمولات التحويلات
      transferCommissionsTotal,
      transferCount,
      profitTotal: profitTotal + transferCommissionsTotal, // صافي الربح (للمدير فقط) + عمولات التحويلات
      // 💱 تحويلات خارجة من الدرج (عادية أو آجلة) - للتقفيل وتفاصيل الشفت والخزنة
      transfersOutTotal,
      transfersOutCash,
      transfersOutMobile,
      transfersOutBank,
      transfersOutCount,
      // 💱 تحويلات واردة (الطرف الآخر) - لتسجيل الدخول في المحفظة الهدف بالخزنة
      transfersInTotal,
      transfersInCash,
      transfersInMobile,
      transfersInBank
    };

    // Update summary cards
    document.getElementById('drawerSalesCount').textContent = totalSalesCount;
    // ⚠️ drawerCashTotal يتم تحديثه لاحقاً بعد جلب أرصدة المحافظ الفعلية
    document.getElementById('drawerDepositsTotal').textContent = fmt(depositsTotal);
    document.getElementById('drawerWithdrawsTotal').textContent = fmt(totalWithdrawsForDisplay);
    document.getElementById('drawerGrandTotal').textContent = fmt(expectedCash);

    // Update wallet cards (التصميم الجديد)
    const drawerMobileTotal = document.getElementById('drawerMobileTotal');
    const drawerBankTotal = document.getElementById('drawerBankTotal');
    const drawerCashIn = document.getElementById('drawerCashIn');
    const drawerCashOut = document.getElementById('drawerCashOut');
    const drawerMobileIn = document.getElementById('drawerMobileIn');
    const drawerBankIn = document.getElementById('drawerBankIn');
    const drawerProfitTotal = document.getElementById('drawerProfitTotal');
    const expectedCashDisplay = document.getElementById('expectedCashDisplay');
    const drawerCurrentDate = document.getElementById('drawerCurrentDate');

    // جلب أرصدة المحافظ الفعلية من الـ API (تشمل السحب من الخزنة والشراء)
    // ✅ v1.2.5: Per-User Filter
    let walletBalances = { cash: expectedCash, mobile_wallet: salesCard, bank: salesTransfer };
    try {
      let walletUrl = 'elos-db://drawer-wallets-balance';
      const walletParams = [];
      if (lastClosingTime) {
        walletParams.push(`after=${encodeURIComponent(lastClosingTime)}`);
      }
      if (userId) {
        walletParams.push(`user_id=${userId}`);
      }
      if (walletParams.length > 0) {
        walletUrl += '?' + walletParams.join('&');
      }
      console.log('[CASH-DRAWER] 🔍 Fetching wallet balances from:', walletUrl);
      const walletRes = await fetch(walletUrl);
      if (walletRes.ok) {
        const walletData = await walletRes.json();
        // ✅ دعم البيانات الجديدة (wallets array) والقديمة (cash, mobile_wallet, bank)
        if (walletData.wallets && Array.isArray(walletData.wallets)) {
          // البيانات الجديدة: مصفوفة من المحافظ
          walletBalances = walletData;
          Logger.log('[CASH-DRAWER] Wallet balances (new format):', walletData.wallets.length, 'wallets');
        } else {
          // البيانات القديمة: للتوافق العكسي
          walletBalances = {
            wallets: [],
            cash: walletData.cash || 0,
            mobile_wallet: walletData.mobile_wallet || 0,
            bank: walletData.bank || 0
          };
        }
        // 🔍 DEBUG v1.2.5: Log wallet balances details
        console.log('[CASH-DRAWER] 🔍 Wallet balances from API:', JSON.stringify(walletBalances, null, 2));
        if (walletBalances.wallets) {
          walletBalances.wallets.forEach(w => {
            console.log(`[CASH-DRAWER] 🔍 Wallet ${w.id} (${w.name}): ${w.balance}`);
          });
        }
      }
    } catch (e) {
      Logger.error('[CASH-DRAWER] Failed to load wallet balances:', e);
      walletBalances = { wallets: [], cash: 0, mobile_wallet: 0, bank: 0 };
    }

    // ✅ حساب أرصدة المحافظ الفعلية
    const walletsMap = {};
    if (walletBalances.wallets && Array.isArray(walletBalances.wallets)) {
      walletBalances.wallets.forEach(w => {
        const deposits = walletDepositsById[w.id] || 0;
        const withdraws = walletWithdrawsById[w.id] || 0;
        walletsMap[w.id] = {
          ...w,
          balance: Number(w.balance || 0) + deposits - withdraws
        };
        Logger.log(`[WALLETS-MAP] ${w.name}: API.sales=${w.sales}, API.balance=${w.balance}, final.balance=${walletsMap[w.id].balance}`);
      });
    }
    
    // ✅ حساب الأرصدة المجمعة حسب النوع من walletsMap (المصدر الموثوق)
    let actualCashBalance = 0;
    let actualMobileBalance = 0;
    let actualBankBalance = 0;

    Object.values(walletsMap).forEach(w => {
      if (w.type === 'cash') actualCashBalance += w.balance;
      else if (w.type === 'mobile_wallet') actualMobileBalance += w.balance;
      else if (w.type === 'bank') actualBankBalance += w.balance;
    });

    // fallback لو مفيش محافظ
    if (Object.keys(walletsMap).length === 0) {
      actualCashBalance = walletBalances.cash ?? expectedCash;
      actualMobileBalance = walletBalances.mobile_wallet ?? 0;
      actualBankBalance = walletBalances.bank ?? 0;
    }

    const totalDrawerBalance = actualCashBalance + actualMobileBalance + actualBankBalance;
    
    // ✅ حفظ بيانات المحافظ الفعلية
    currentCashData.walletsMap = walletsMap;
    currentCashData.allWallets = Object.values(walletsMap);

    Logger.log('[CASH-DRAWER] Wallet adjustments from localStorage:', {
      deposits: walletDeposits,
      withdraws: walletWithdraws,
      finalBalances: { cash: actualCashBalance, mobile: actualMobileBalance, bank: actualBankBalance }
    });

    // ✅ إضافة أرصدة المحافظ الفعلية إلى currentCashData للاستخدام في التحويلات
    if (!currentCashData) {
      currentCashData = {};
    }
    currentCashData.cashTotal = actualCashBalance;
    currentCashData.expectedCash = actualCashBalance; // ✅ للتوافق مع مطابقة الدرج
    currentCashData.mobileTotal = actualMobileBalance;
    currentCashData.bankTotal = actualBankBalance;
    currentCashData.totalDrawerBalance = totalDrawerBalance;
    currentCashData.walletDeposits = walletDeposits;
    currentCashData.walletWithdraws = walletWithdraws;

    // ✅ تحديث عرض المحافظ الفعلية
    await updateDrawerWalletsDisplay(walletsMap, actualCashBalance, actualMobileBalance, actualBankBalance);
    
    // تحديث رصيد بطاقة الكاش السائل (للتوافق العكسي) - مع التحقق من وجود العناصر
    const drawerCashTotalEl = document.getElementById('drawerCashTotal');
    if (drawerCashTotalEl) drawerCashTotalEl.textContent = fmt(actualCashBalance);
    if (drawerMobileTotal) drawerMobileTotal.textContent = fmt(actualMobileBalance);
    if (drawerBankTotal) drawerBankTotal.textContent = fmt(actualBankBalance);
    if (drawerCashIn) drawerCashIn.textContent = fmt(salesCash + safeWithdrawsTotal);
    if (drawerCashOut) drawerCashOut.textContent = fmt(totalWithdrawsForDisplay);
    if (drawerMobileIn) drawerMobileIn.textContent = fmt(salesCard);
    if (drawerBankIn) drawerBankIn.textContent = fmt(salesTransfer);
    // Update profit only for admin - إخفاء بطاقة الربح للكاشير
    const profitCard = document.getElementById('profitCard');
    if (profitCard) {
      const user = window.currentUser || JSON.parse(localStorage.getItem('currentUser') || '{}');
      if (user && (user.role === 'admin' || user.role === 'manager')) {
        profitCard.style.display = 'flex';
        const drawerProfitTotal = document.getElementById('drawerProfitTotal');
        if (drawerProfitTotal) {
          drawerProfitTotal.textContent = fmt(profitTotal + transferCommissionsTotal);
        }
      } else {
        profitCard.style.display = 'none';
      }
    }
    if (expectedCashDisplay) expectedCashDisplay.textContent = fmt(actualCashBalance) + ' ج.م';

    // تحديث الرصيد الإجمالي (مجموع كل المحافظ)
    const drawerGrandTotalEl = document.getElementById('drawerGrandTotal');
    if (drawerGrandTotalEl) drawerGrandTotalEl.textContent = fmt(totalDrawerBalance);
    if (drawerCurrentDate) {
      const today = new Date();
      const options = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' };
      drawerCurrentDate.textContent = today.toLocaleDateString('ar-EG', options);
    }

    // Update preview in button - يعرض عدد كل الحركات (مبيعات + إيداعات + سحوبات + ...)
    // ✅ حساب العدد الكلي بنفس منهج renderCashTransactionsList
    let totalTransactionsCount = totalSalesCount; // مبيعات أجهزة + إكسسوارات + قطع غيار
    // + عمليات من localStorage (إيداعات، سحوبات، تحويلات بين المحافظ)
    const countShiftTx = getShiftTransactions();
    countShiftTx.forEach(tx => {
      if (tx.type === 'supplier_payment' || tx.type === 'client_payment') return;
      totalTransactionsCount++;
    });
    // + عمليات من الداتابيز (تحويلات من الخزنة، مرتجعات، مشتريات POS، عمولات)
    const countIgnoredRefs = ['sale', 'accessory_sale', 'purchase', 'device_purchase', 'accessory_purchase', 'accessory_invoice', 'supplier_payment', 'expense', 'safe_expense', 'capital_withdrawal', 'loan_payment', 'partner_withdrawal'];
    if (currentCashData && currentCashData.ledgerTransactions) {
      currentCashData.ledgerTransactions.forEach(tx => {
        if (countIgnoredRefs.includes(tx.ref)) return;
        if (tx.ref && tx.ref.startsWith('accessory_sale_')) return;
        if (tx.ref && tx.ref.startsWith('supplier_payment_')) return;
        if (tx.ref && tx.ref.startsWith('partner_')) return;
        if (tx.ref && tx.ref.startsWith('repair_part_sale_')) return; // محسوبة في totalSalesCount
        if (tx.kind === 'in' && tx.ref && (tx.ref === 'purchase_return_settlement' || tx.ref === 'invoice_return' || tx.ref === 'quick_return' || (tx.ref && tx.ref.includes('purchase_return')))) return;
        totalTransactionsCount++;
      });
    }
    const todaySalesCountEl = document.getElementById('todaySalesCount');
    if (todaySalesCountEl) todaySalesCountEl.textContent = totalTransactionsCount;
    const todayTotalPreviewEl = document.getElementById('todayTotalPreview');
    if (todayTotalPreviewEl) todayTotalPreviewEl.textContent = fmt(actualCashBalance);

    // ═══════════════════════════════════════════════════════════════
    // تحديث ملخص التقفيل (الـ UI الجديد)
    // ═══════════════════════════════════════════════════════════════

    // حساب فائض السحب من الخزنة = الرصيد الفعلي - المبيعات - الإيداعات - العمولات
    // ✅ نستخدم الأرصدة الفعلية (بعد التحويلات الداخلية) لتوزيع الفائض على المحفظة الصحيحة
    const currentFinalCash = currentCashData?.finalCash ?? (salesCash + (walletDeposits?.cash || 0) + safeWithdrawsCash + transferCommissionsTotal + transfersInCash - (walletWithdraws?.cash || 0) - posPurchasesCash - returnsTotalCash - transfersOutCash);
    const currentFinalMobile = currentCashData?.finalMobile ?? (salesCard + (walletDeposits?.mobile_wallet || 0) + safeWithdrawsMobile + transfersInMobile - (walletWithdraws?.mobile_wallet || 0) - posPurchasesMobile - returnsTotalMobile - transfersOutMobile);
    const currentFinalBank = currentCashData?.finalBank ?? (salesTransfer + (walletDeposits?.bank || 0) + safeWithdrawsBank + transfersInBank - (walletWithdraws?.bank || 0) - posPurchasesBank - returnsTotalBank - transfersOutBank);
    const safeWithdrawsSurplusCash = Math.max(0, currentFinalCash - salesCash - (walletDeposits?.cash || depositsTotalCash || 0) - transferCommissionsTotal);
    const safeWithdrawsSurplusMobile = Math.max(0, currentFinalMobile - salesCard - (walletDeposits?.mobile_wallet || depositsTotalMobile || 0));
    const safeWithdrawsSurplusBank = Math.max(0, currentFinalBank - salesTransfer - (walletDeposits?.bank || depositsTotalBank || 0));

    // ✅ تحديث ملخص المحافظ الفعلية للتقفيل
    await updateClosingWalletsSummary(walletsMap, {
      salesCash, salesCard, salesTransfer,
      walletDeposits, walletWithdraws, walletDepositsById, walletWithdrawsById,
      safeWithdrawsSurplusCash, safeWithdrawsSurplusMobile, safeWithdrawsSurplusBank,
      posPurchasesCash, posPurchasesMobile, posPurchasesBank
    });

    // Render transactions list
    renderCashTransactionsList('all');

    return currentCashData;

  } catch (error) {
    Logger.error('Error loading cash data:', error);
    showToast('خطأ في تحميل بيانات الكاش', 'error');
    return null;
  } finally {
    UILoader.hide('cash');
  }
};

// ═══════════════════════════════════════════════════════════════
// 🔐 SHIFT CLOSING - تقفيل الشفت وتسجيل في الخزنة
// ═══════════════════════════════════════════════════════════════

/**
 * عرض مودال تأكيد تقفيل الشفت - تصميم أنيق بدون confirm()
 */
function showShiftConfirmModal(data) {
  return new Promise((resolve) => {
    // إزالة أي مودال سابق
    const existing = document.getElementById('shiftConfirmModal');
    if (existing) existing.remove();

    // 🔧 حساب صافي المبلغ للخزنة - استخدام الأرصدة الفعلية من المحافظ
    // نجمع أرصدة جميع المحافظ من walletsMap (الرصيد الفعلي من قاعدة البيانات)
    let netToSafe = 0;
    if (data.walletsMap) {
      Object.values(data.walletsMap).forEach(wallet => {
        netToSafe += Number(wallet.balance || 0);
      });
    } else {
      // Fallback للتوافق العكسي
      netToSafe = (data.finalCash ?? data.salesCash) +
                  (data.finalMobile ?? data.salesCard) +
                  (data.finalBank ?? data.salesTransfer);
    }

    const modal = document.createElement('div');
    modal.id = 'shiftConfirmModal';
    modal.style.cssText = `
      position: fixed; top: 0; left: 0; right: 0; bottom: 0;
      background: rgba(0,0,0,0.6); backdrop-filter: none;
      z-index: 2500; display: flex; justify-content: center; align-items: center;
      padding: 20px; animation: fadeIn 0.2s ease;
    `;

    modal.innerHTML = `
      <div style="
        background: linear-gradient(135deg, #1e293b, #0f172a);
        border-radius: 20px; max-width: 400px; width: 100%;
        box-shadow: 0 25px 60px rgba(0,0,0,0.5);
        overflow: hidden; animation: slideUp 0.3s ease;
      ">
        <!-- Header -->
        <div style="background: linear-gradient(135deg, #059669, #047857); padding: 20px; text-align: center;">
          <div style="font-size: 40px; margin-bottom: 8px;">🔐</div>
          <div style="color: white; font-size: 20px; font-weight: bold;">تأكيد تقفيل الشفت</div>
        </div>

        <!-- Content -->
        <div style="padding: 20px; color: #e2e8f0;">
          <!-- Sales Summary -->
          <div style="background: rgba(255,255,255,0.05); border-radius: 12px; padding: 14px; margin-bottom: 12px;">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
              <span style="color: #94a3b8;">🧾 المبيعات</span>
              <span style="font-weight: bold; font-size: 18px;">${data.salesCount} عملية</span>
            </div>
            <div style="display: flex; gap: 12px; font-size: 13px; color: #94a3b8;">
              <span>نقدي: ${fmt(data.salesCash)}</span>
              <span>بطاقة: ${fmt(data.salesCard)}</span>
              <span>تحويل: ${fmt(data.salesTransfer)}</span>
            </div>
          </div>

          <!-- Deposits & Withdraws -->
          <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin-bottom: 12px;">
            <div style="background: rgba(16,185,129,0.1); border-radius: 10px; padding: 12px; text-align: center;">
              <div style="color: #10b981; font-size: 13px;">📥 إيداعات</div>
              <div style="font-size: 16px; font-weight: bold; color: #10b981;">${fmt(data.depositsTotal)}</div>
            </div>
            <div style="background: rgba(239,68,68,0.1); border-radius: 10px; padding: 12px; text-align: center;">
              <div style="color: #ef4444; font-size: 13px;">📤 مسحوبات</div>
              <div style="font-size: 16px; font-weight: bold; color: #ef4444;">${fmt(data.withdrawsTotal)}</div>
            </div>
          </div>

          <!-- Net to Safe -->
          <div style="background: linear-gradient(135deg, rgba(5,150,105,0.2), rgba(4,120,87,0.2)); border-radius: 12px; padding: 14px; text-align: center; border: 1px solid rgba(5,150,105,0.3);">
            <div style="color: #10b981; font-size: 13px; margin-bottom: 4px;">💼 صافي المبلغ للخزنة</div>
            <div style="font-size: 24px; font-weight: bold; color: #10b981;">${fmt(netToSafe)} ج.م</div>
          </div>
        </div>

        <!-- Footer -->
        <div style="display: flex; gap: 12px; padding: 16px 20px; background: rgba(0,0,0,0.2);">
          <button id="cancelShiftClose" style="
            flex: 1; padding: 14px; border: 2px solid #475569;
            background: transparent; color: #94a3b8; border-radius: 10px;
            cursor: pointer; font-size: 15px; font-weight: bold;
            transition: all 0.2s;
          ">إلغاء</button>
          <button id="confirmShiftClose" style="
            flex: 2; padding: 14px; border: none;
            background: linear-gradient(135deg, #059669, #047857);
            color: white; border-radius: 10px; cursor: pointer;
            font-size: 15px; font-weight: bold; transition: all 0.2s;
          ">✅ تأكيد التقفيل</button>
        </div>
      </div>
    `;

    document.body.appendChild(modal);

    // Event listeners
    document.getElementById('cancelShiftClose').onclick = () => {
      modal.remove();
      resolve(false);
    };

    document.getElementById('confirmShiftClose').onclick = () => {
      modal.remove();
      resolve(true);
    };

    // Close on backdrop click
    modal.onclick = (e) => {
      if (e.target === modal) {
        modal.remove();
        resolve(false);
      }
    };
  });
}

// ═══════════════════════════════════════════════════════════════
// ⚠️ VIOLATIONS & ALERTS SYSTEM - نظام الإشعارات للمخالفات
// ═══════════════════════════════════════════════════════════════

/**
 * التحقق من المخالفات وعرض الإشعارات
 * @param {Object} cashData - بيانات الدرج
 * @returns {Array} قائمة بالمخالفات المكتشفة
 */
function checkViolations(cashData) {
  const violations = [];
  const THRESHOLD_LARGE_WITHDRAW = 5000; // حد السحب الكبير
  const THRESHOLD_MULTIPLE_WITHDRAW = 3; // عدد السحوبات المتعددة
  const THRESHOLD_SUSPICIOUS_RATIO = 0.5; // نسبة السحوبات من المبيعات (50%)

  // 1. التحقق من سحوبات كبيرة
  if (cashData.withdrawsTotal > THRESHOLD_LARGE_WITHDRAW) {
    violations.push({
      type: 'large_withdraw',
      severity: 'warning',
      icon: '⚠️',
      title: 'سحوبات كبيرة',
      message: `تم تسجيل سحوبات بقيمة ${fmt(cashData.withdrawsTotal)} ج.م (أكثر من ${fmt(THRESHOLD_LARGE_WITHDRAW)} ج.م)`,
      action: 'review_withdraws'
    });
  }

  // 2. التحقق من سحوبات متعددة
  if (cashData.withdrawsCount >= THRESHOLD_MULTIPLE_WITHDRAW) {
    violations.push({
      type: 'multiple_withdraws',
      severity: 'info',
      icon: '📋',
      title: 'سحوبات متعددة',
      message: `تم تسجيل ${cashData.withdrawsCount} عملية سحب اليوم`,
      action: 'review_withdraws'
    });
  }

  // 3. التحقق من نسبة السحوبات للمبيعات (مشبوهة)
  if (cashData.salesTotal > 0) {
    const withdrawRatio = cashData.withdrawsTotal / cashData.salesTotal;
    if (withdrawRatio > THRESHOLD_SUSPICIOUS_RATIO) {
      violations.push({
        type: 'suspicious_ratio',
        severity: 'warning',
        icon: '🔍',
        title: 'نسبة سحوبات عالية',
        message: `السحوبات تمثل ${(withdrawRatio * 100).toFixed(1)}% من المبيعات (${fmt(cashData.withdrawsTotal)} من ${fmt(cashData.salesTotal)})`,
        action: 'review_withdraws'
      });
    }
  }

  // 4. التحقق من عدم وجود مبيعات مع سحوبات كبيرة
  if (cashData.salesCount === 0 && cashData.withdrawsTotal > 0) {
    violations.push({
      type: 'withdraws_without_sales',
      severity: 'warning',
      icon: '⚠️',
      title: 'سحوبات بدون مبيعات',
      message: `تم تسجيل سحوبات بقيمة ${fmt(cashData.withdrawsTotal)} ج.م بدون أي مبيعات اليوم`,
      action: 'review_withdraws'
    });
  }

  // 5. التحقق من إيداعات كبيرة غير عادية
  if (cashData.depositsTotal > cashData.salesTotal * 2 && cashData.salesTotal > 0) {
    violations.push({
      type: 'large_deposits',
      severity: 'info',
      icon: '💰',
      title: 'إيداعات كبيرة',
      message: `تم تسجيل إيداعات بقيمة ${fmt(cashData.depositsTotal)} ج.م (أكثر من ضعف المبيعات)`,
      action: 'review_deposits'
    });
  }

  return violations;
}

/**
 * عرض إشعارات المخالفات
 * @param {Array} violations - قائمة المخالفات
 */
function showViolationAlerts(violations) {
  if (!violations || violations.length === 0) return;

  violations.forEach((violation, index) => {
    // تأخير بسيط بين الإشعارات لتجنب الفوضى
    setTimeout(() => {
      showToast(
        `<strong>${violation.title}</strong><br>${violation.message}`,
        violation.severity,
        6000
      );
    }, index * 1000);
  });
}

// ═══════════════════════════════════════════════════════════════
// 🔍 CASH VERIFICATION - مطابقة درج الكاش (DEPRECATED)
// ═══════════════════════════════════════════════════════════════

let cashVerificationData = {
  verified: false,
  actualCash: 0,
  difference: 0
};

// فتح موديل المطابقة
function openCashVerificationModal() {
  console.log('[VERIFICATION] ===== openCashVerificationModal() called =====');
  console.log('[VERIFICATION] currentCashData exists:', !!currentCashData);
  
  // ✅ FIX: Ensure cash drawer data is loaded before opening verification
  if (!currentCashData) {
    console.warn('[VERIFICATION] currentCashData is null, attempting to load...');
    showToast('جاري تحميل بيانات الدرج...', 'info');
    loadCashDrawerData().then(() => {
      if (currentCashData) {
        console.log('[VERIFICATION] Data loaded, retrying...');
        openCashVerificationModal(); // إعادة المحاولة بعد التحميل
      } else {
        console.error('[VERIFICATION] Failed to load cash drawer data');
        showToast('لا توجد بيانات للمطابقة. يرجى فتح درج الكاش أولاً', 'warning');
      }
    }).catch(err => {
      console.error('[VERIFICATION] Error loading cash drawer data:', err);
      showToast('فشل تحميل بيانات الدرج', 'error');
    });
    return;
  }

  const modal = document.getElementById('cashVerificationModal');
  if (!modal) {
    console.error('[VERIFICATION] ❌ Modal element not found in DOM');
    showToast('مودال المطابقة غير موجود', 'error');
    return;
  }
  console.log('[VERIFICATION] ✅ Modal element found');

  // ✅ FIX: Prevent ModalSystem from closing this modal
  // Ensure it's excluded from closeAll operations
  modal.setAttribute('data-verification-modal', 'true');

  // تحديث المبلغ المتوقع في الموديل (رصيد الكاش السائل فقط)
  const expectedCash = currentCashData.cashTotal || currentCashData.expectedCash || 0;
  console.log('[VERIFICATION] Expected cash:', expectedCash, 'from currentCashData:', {
    cashTotal: currentCashData.cashTotal,
    expectedCash: currentCashData.expectedCash
  });
  
  const verifyExpectedCashEl = document.getElementById('verifyExpectedCash');
  if (verifyExpectedCashEl) {
    verifyExpectedCashEl.textContent = fmt(expectedCash) + ' ج.م';
    console.log('[VERIFICATION] ✅ Expected cash element updated');
  } else {
    console.warn('[VERIFICATION] ⚠️ verifyExpectedCash element not found');
  }

  // مسح الإدخال السابق
  const verifyActualCashEl = document.getElementById('verifyActualCash');
  if (verifyActualCashEl) {
    verifyActualCashEl.value = '';
    console.log('[VERIFICATION] ✅ Actual cash input cleared');
  } else {
    console.warn('[VERIFICATION] ⚠️ verifyActualCash element not found');
  }
  
  const diffBox = document.getElementById('verifyDifferenceBox');
  if (diffBox) {
    diffBox.style.display = 'none';
    console.log('[VERIFICATION] ✅ Difference box hidden');
  } else {
    console.warn('[VERIFICATION] ⚠️ verifyDifferenceBox element not found');
  }
  
  const confirmBtn = document.getElementById('btnConfirmVerification');
  if (confirmBtn) {
    confirmBtn.disabled = true;
    console.log('[VERIFICATION] ✅ Confirm button disabled');
  } else {
    console.warn('[VERIFICATION] ⚠️ btnConfirmVerification element not found');
  }

  // ✅ FIX: Ensure ModalSystem doesn't close this modal
  // Close other modals but keep cash drawer and verification open
  ModalSystem.closeAll('cashDrawerModal');
  
  // عرض الموديل - استخدام display: flex مع z-index أعلى من كل شيء
  modal.style.display = 'flex';
  modal.style.zIndex = '10000'; // Higher than cash drawer modal
  console.log('[VERIFICATION] ✅ Modal displayed with z-index 10000');
  console.log('[VERIFICATION] Modal computed style:', window.getComputedStyle(modal).display);
  
  // ✅ FIX: Ensure input focus after modal is fully rendered
  setTimeout(() => {
    if (verifyActualCashEl) {
      verifyActualCashEl.focus();
      console.log('[VERIFICATION] ✅ Input focused');
    }
  }, 150); // Slightly longer delay to ensure modal is visible
}

// إغلاق موديل المطابقة
function closeCashVerificationModal() {
  document.getElementById('cashVerificationModal').style.display = 'none';
}

// تحديث الفرق عند الإدخال
function updateVerificationDifference() {
  const actualInput = document.getElementById('verifyActualCash');
  const diffBox = document.getElementById('verifyDifferenceBox');
  const diffValue = document.getElementById('verifyDifferenceValue');
  const diffLabel = document.getElementById('verifyDifferenceLabel');
  const confirmBtn = document.getElementById('btnConfirmVerification');

  const actualCash = Number(actualInput.value || 0);
  const expectedCash = currentCashData?.expectedCash || 0;
  const difference = actualCash - expectedCash;

  if (actualInput.value === '') {
    diffBox.style.display = 'none';
    confirmBtn.disabled = true;
    return;
  }

  diffBox.style.display = 'block';
  confirmBtn.disabled = false;

  if (difference === 0) {
    diffValue.textContent = '✅ مطابق تماماً';
    diffValue.style.color = '#22c55e';
    diffLabel.textContent = '';
    diffBox.style.background = 'rgba(34,197,94,0.1)';
    diffBox.style.borderColor = 'rgba(34,197,94,0.3)';
  } else if (difference > 0) {
    diffValue.textContent = '+' + fmt(difference) + ' ج.م';
    diffValue.style.color = '#22c55e';
    diffLabel.textContent = 'زيادة في الكاش';
    diffBox.style.background = 'rgba(34,197,94,0.1)';
    diffBox.style.borderColor = 'rgba(34,197,94,0.3)';
  } else {
    diffValue.textContent = fmt(difference) + ' ج.م';
    diffValue.style.color = '#ef4444';
    diffLabel.textContent = 'عجز في الكاش';
    diffBox.style.background = 'rgba(239,68,68,0.1)';
    diffBox.style.borderColor = 'rgba(239,68,68,0.3)';
  }
}

// تأكيد المطابقة
function confirmCashVerification() {
  const actualCash = Number(document.getElementById('verifyActualCash').value || 0);
  const expectedCash = currentCashData?.expectedCash || 0;
  const difference = actualCash - expectedCash;

  // حفظ بيانات المطابقة
  cashVerificationData = {
    verified: true,
    actualCash: actualCash,
    difference: difference
  };

  // إغلاق موديل المطابقة
  closeCashVerificationModal();

  // تحديث حالة المطابقة في الواجهة
  const statusEl = document.getElementById('verificationStatus');
  const verifyBtn = document.getElementById('btnOpenVerification');
  const finalDesc = document.getElementById('closingFinalDesc');

  if (statusEl) {
    let statusText = '✅ تمت المطابقة';
    if (difference !== 0) {
      statusText += ` (${difference > 0 ? 'زيادة' : 'عجز'}: ${fmt(Math.abs(difference))} ج.م)`;
    }
    statusEl.innerHTML = `<span class="status-complete">${statusText}</span>`;
  }

  if (verifyBtn) {
    verifyBtn.innerHTML = '<span>✅</span> تم - اضغط للتعديل';
    verifyBtn.classList.add('completed');
  }

  if (finalDesc) {
    // حساب فائض السحب من الخزنة = الرصيد الفعلي - المبيعات - الإيداعات - العمولات
    // ✅ نستخدم الأرصدة الفعلية لتوزيع الفائض على المحفظة الصحيحة بعد التحويلات الداخلية
    const surplusCash = Math.max(0, (currentCashData.finalCash || 0) - (currentCashData.salesCash || 0) - (currentCashData.depositsTotalCash || 0) - (currentCashData.transferCommissionsTotal || 0));
    const surplusMobile = Math.max(0, (currentCashData.finalMobile || 0) - (currentCashData.salesCard || 0) - (currentCashData.depositsTotalMobile || 0));
    const surplusBank = Math.max(0, (currentCashData.finalBank || 0) - (currentCashData.salesTransfer || 0) - (currentCashData.depositsTotalBank || 0));

    // 🔧 مشتريات POS لا تُخصم + فائض السحب يرجع للخزنة + إيداعات/سحوبات مفصلة
    const netTotal = (currentCashData.salesCash + (currentCashData.depositsTotalCash || 0) + surplusCash - (currentCashData.withdrawsTotalCash || 0)) +
                     (currentCashData.salesCard + (currentCashData.depositsTotalMobile || 0) + surplusMobile - (currentCashData.withdrawsTotalMobile || 0)) +
                     (currentCashData.salesTransfer + (currentCashData.depositsTotalBank || 0) + surplusBank - (currentCashData.withdrawsTotalBank || 0));
    finalDesc.textContent = `سيتم تسجيل ${fmt(netTotal)} ج.م في الخزنة`;
  }

  SoundFX.play('success');
  showToast('✅ تمت المطابقة بنجاح', 'success');
}

// تنفيذ التقفيل الفعلي
async function executeShiftClose() {
  if (!currentCashData) {
    showToast('لا توجد بيانات للتقفيل', 'warning');
    return;
  }

  // Allow closing even with zero sales (for deposits/withdraws/safe transfers/client payments only)
  if (currentCashData.salesCount === 0 &&
      (currentCashData.clientPaymentsTotal || 0) === 0 &&
      currentCashData.depositsCount === 0 &&
      currentCashData.withdrawsCount === 0 &&
      (currentCashData.safeWithdrawsTotal || 0) === 0) {
    showToast('لا توجد حركات لتقفيلها', 'warning');
    return;
  }

  // ✅ التحقق من المخالفات قبل التقفيل
  const violations = checkViolations(currentCashData);
  if (violations.length > 0) {
    // عرض إشعارات المخالفات
    showViolationAlerts(violations);
  }

  const notes = document.getElementById('closeCashNotes')?.value || '';

  // عرض مودال التأكيد المخصص (بدون بيانات المطابقة)
  const confirmed = await showShiftConfirmModal(currentCashData);
  if (!confirmed) return;

  UILoader.show('جاري تقفيل الشفت...', 'shift');

  try {
    // Get detailed transactions from localStorage
    const shiftTransactions = getShiftTransactions();
    const deposits = shiftTransactions.filter(tx => tx.type === 'deposit');
    const withdraws = shiftTransactions.filter(tx => tx.type === 'withdraw');

    // Call API to close shift and record to safe
    // 🔧 نرسل الأرصدة الفعلية بعد التحويلات (finalCash, finalMobile, finalBank)
    const res = await fetch('elos-db://shift-close', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        shift_date: new Date().toISOString().split('T')[0],
        closed_by: window.currentUser?.username || 'system',

        // Sales - المبيعات الفعلية فقط (بدون تحويلات الخزنة)
        sales_count: currentCashData.salesCount,
        sales_cash: currentCashData.salesCash,
        sales_card: currentCashData.salesCard,
        sales_transfer: currentCashData.salesTransfer,

        // Deposits (إيداعات = ربح صافي) - تفاصيل كاملة
        deposits_count: currentCashData.depositsCount,
        deposits_total: currentCashData.depositsTotal,
        // إيداعات مفصلة حسب المحفظة لحساب expectedCash بدقة
        deposits_total_cash: currentCashData.depositsTotalCash || 0,
        deposits_total_mobile: currentCashData.depositsTotalMobile || 0,
        deposits_total_bank: currentCashData.depositsTotalBank || 0,
        deposits_details: deposits.map(d => ({
          amount: d.amount,
          category: d.category,
          description: d.description
        })),

        // Withdraws (مسحوبات = مصروفات) - تفاصيل كاملة
        withdraws_count: currentCashData.manualWithdrawsCount || 0,
        withdraws_total: currentCashData.manualWithdrawsTotal || 0,
        // سحوبات مفصلة حسب المحفظة لحساب expectedCash بدقة
        withdraws_total_cash: currentCashData.withdrawsTotalCash || 0,
        withdraws_total_mobile: currentCashData.withdrawsTotalMobile || 0,
        withdraws_total_bank: currentCashData.withdrawsTotalBank || 0,
        withdraws_details: withdraws.map(w => ({
          amount: w.amount,
          category: w.category,
          description: w.description
        })),

        // Returns (مرتجعات - منفصلة عن السحوبات)
        returns_count: currentCashData.returnsCount || 0,
        returns_total: currentCashData.returnsTotal || 0,
        returns_total_cash: currentCashData.returnsTotalCash || 0,
        returns_total_mobile: currentCashData.returnsTotalMobile || 0,
        returns_total_bank: currentCashData.returnsTotalBank || 0,

        // POS Purchases (مشتريات أجهزة من POS - تتسجل منفصلة حسب المحفظة)
        pos_purchases_count: currentCashData.posPurchasesCount || 0,
        pos_purchases_total: currentCashData.posPurchasesTotal || 0,
        pos_purchases_cash: currentCashData.posPurchasesCash || 0,
        pos_purchases_mobile: currentCashData.posPurchasesMobile || 0,
        pos_purchases_bank: currentCashData.posPurchasesBank || 0,

        // سحب من الخزنة (لا يتسجل - أصلاً في الخزنة) - مفصل حسب المحفظة للتوثيق
        safe_withdraws_total: currentCashData.safeWithdrawsTotal || 0,
        safe_withdraws_cash: currentCashData.safeWithdrawsCash || 0,
        safe_withdraws_mobile: currentCashData.safeWithdrawsMobile || 0,
        safe_withdraws_bank: currentCashData.safeWithdrawsBank || 0,

        // 💱 تحويلات خارجة من الدرج (عادية أو آجلة) - تظهر في تفاصيل الشفت وحركات الخزنة
        transfers_out_count: currentCashData.transfersOutCount || 0,
        transfers_out_total: currentCashData.transfersOutTotal || 0,
        transfers_out_cash: currentCashData.transfersOutCash || 0,
        transfers_out_mobile: currentCashData.transfersOutMobile || 0,
        transfers_out_bank: currentCashData.transfersOutBank || 0,

        // 💱 تحويلات واردة (الطرف الآخر من التحويل) - لتسجيل الدخول في المحفظة الهدف بالخزنة
        transfers_in_total: currentCashData.transfersInTotal || 0,
        transfers_in_cash: currentCashData.transfersInCash || 0,
        transfers_in_mobile: currentCashData.transfersInMobile || 0,
        transfers_in_bank: currentCashData.transfersInBank || 0,

        // 💱 عمولات التحويلات - لحسابها في expectedCash
        transfer_commissions_total: currentCashData.transferCommissionsTotal || 0,

        // 💰 تحصيلات العملاء (بند منفصل عن المبيعات)
        client_payments_cash: currentCashData.clientPaymentsCash || 0,
        client_payments_mobile: currentCashData.clientPaymentsMobile || 0,
        client_payments_bank: currentCashData.clientPaymentsBank || 0,
        client_payments_total: currentCashData.clientPaymentsTotal || 0,

        // 💰 أرصدة المحافظ الفعلية في الدرج (لتوزيع الفائض بشكل صحيح على المحافظ)
        final_cash: currentCashData.finalCash || 0,
        final_mobile: currentCashData.finalMobile || 0,
        final_bank: currentCashData.finalBank || 0,

        // ✅ FIX: actual_cash = رصيد الكاش السائل فقط (مش كل المحافظ)
        // لأن expectedCash في الباك إند يحسب الكاش السائل فقط
        actual_cash: currentCashData.cashTotal || currentCashData.expectedCash || 0,

        notes: notes
      })
    });
    
    if (!res.ok) {
      const error = await res.text();
      throw new Error(error || 'فشل تقفيل الشفت');
    }
    
    const result = await res.json();

    // ⚠️ حفظ نسخة من البيانات قبل المسح للطباعة
    const shiftDataForPrint = { ...currentCashData };

    // Clear local shift transactions
    clearShiftTransactions();

    // Save last closing time - بنفس صيغة DB (local time بدون Z)
    // 🔧 Fix: نستخدم صيغة متوافقة مع التواريخ في DB
    const now = new Date();
    const localTimeString = now.getFullYear() + '-' +
      String(now.getMonth() + 1).padStart(2, '0') + '-' +
      String(now.getDate()).padStart(2, '0') + ' ' +
      String(now.getHours()).padStart(2, '0') + ':' +
      String(now.getMinutes()).padStart(2, '0') + ':' +
      String(now.getSeconds()).padStart(2, '0');
    // ✅ PATCH 3: Use SessionCache
    // ✅ v1.2.3: Per-User closing time
    const closingTimeKeyShift = getLastClosingTimeKey();
    SessionCache.set(closingTimeKeyShift, localTimeString, false);
    Logger.log('[SHIFT-CLOSE] Saved closing time:', localTimeString, 'key:', closingTimeKeyShift);

    // Clear inputs (use optional chaining for elements that may not exist)
    const notesInput = document.getElementById('closeCashNotes');
    if (notesInput) notesInput.value = '';

    // Close modal
    closeCashDrawerModal();

    // Reload cash data (will show empty for new shift)
    await loadCashDrawerData();
    await loadTodayCashPreview();

    SoundFX.play('success');
    showToast(`✅ تم تقفيل الشفت وتسجيل ${fmt(result.total_to_safe)} ج.م في الخزنة!`, 'success', 5000);

    // طباعة تقرير الشفت بعد التقفيل - باستخدام البيانات المحفوظة
    printShiftReport(result, shiftDataForPrint);

  } catch (error) {
    Logger.error('Error closing shift:', error);
    showToast('خطأ في تقفيل الشفت: ' + translateError(error.message), 'error');
  } finally {
    UILoader.hide('shift');
  }
}

// ═══════════════════════════════════════════════════════════════
// 🖨️ SHIFT REPORT PRINTING - طباعة تقرير تقفيل الشفت
// ═══════════════════════════════════════════════════════════════

let currentShiftReportHTML = '';

/**
 * طباعة تقرير تقفيل الشفت على الطابعة الحرارية
 * @param {Object} shiftResult - نتيجة التقفيل من الـ API
 * @param {Number} actualCash - المبلغ الفعلي في الدرج
 * @param {Number} difference - الفرق بين المتوقع والفعلي
 * @param {Object} savedData - بيانات الشفت المحفوظة (اختياري)
 */
function printShiftReport(shiftResult, savedData = null) {
  const settings = JSON.parse(localStorage.getItem('appSettings') || '{}');

  // إعدادات الورق
  const paperWidth = settings.printerPaperWidth === '58' ? '54mm' : '76mm';
  const pageSize = settings.printerPaperWidth || '80';

  // أحجام الخط
  const fontSizes = {
    small: { title: '16px', header: '13px', normal: '11px', small: '10px' },
    normal: { title: '18px', header: '14px', normal: '12px', small: '11px' },
    large: { title: '20px', header: '16px', normal: '14px', small: '12px' }
  };
  const fonts = fontSizes[settings.printerFontSize] || fontSizes.normal;

  // التاريخ والوقت
  const now = new Date();
  const dateStr = now.toLocaleDateString('ar-EG');
  const timeStr = now.toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' });

  // تحديد نوع التقرير - تقفيل شفت أم تقرير كاش عادي
  const isClosingReport = shiftResult !== null;
  const reportPrefix = isClosingReport ? 'SH' : 'CR';
  const reportTitle = isClosingReport ? 'تقرير تقفيل الشفت' : 'تقرير درج الكاش';
  const reportNumber = reportPrefix + '-' + now.getFullYear() + (now.getMonth()+1).toString().padStart(2,'0') + now.getDate().toString().padStart(2,'0') + '-' + now.getHours().toString().padStart(2,'0') + now.getMinutes().toString().padStart(2,'0');

  // بيانات الشفت - استخدم البيانات المحفوظة إن وجدت
  const data = savedData || currentCashData || {};
  const userName = window.currentUser?.username || 'النظام';
  const footerText = isClosingReport ? 'تم التقفيل بواسطة: ' + userName : 'المستخدم: ' + userName;

  // ═══════════════════════════════════════════════════════════════
  // بناء محتوى المعاينة
  // ═══════════════════════════════════════════════════════════════
  let previewHTML = '<div dir="rtl" style="font-family: Arial, Tahoma, sans-serif; max-width: 100%; margin: 0 auto; padding: 12px; background: #fff; color: #000; line-height: 1.5;">';

  // Header
  previewHTML += '<div style="text-align:center;padding-bottom:10px;border-bottom:3px double #000;margin-bottom:10px;">';
  if (settings.companyLogo) {
    previewHTML += '<img src="' + settings.companyLogo + '" style="max-width:60px;max-height:60px;margin-bottom:5px;display:block;margin-left:auto;margin-right:auto;" />';
  }
  previewHTML += '<div style="font-size:' + fonts.title + ';font-weight:900;color:#000;">' + (settings.companyName || 'ELOS') + '</div>';
  previewHTML += '</div>';

  // عنوان التقرير
  previewHTML += '<div style="text-align:center;background:#000;color:#fff;padding:10px;font-weight:900;margin:8px 0;font-size:' + fonts.header + ';">☆ ' + reportTitle + ' ☆</div>';

  // معلومات التقرير
  previewHTML += '<div style="background:#f0f0f0;padding:8px;margin-bottom:10px;border:2px solid #000;">';
  previewHTML += '<div style="display:flex;justify-content:space-between;font-weight:800;font-size:' + fonts.normal + ';"><span>رقم التقرير:</span><span>' + reportNumber + '</span></div>';
  previewHTML += '<div style="display:flex;justify-content:space-between;font-weight:700;font-size:' + fonts.small + ';"><span>التاريخ:</span><span>' + dateStr + '</span></div>';
  previewHTML += '<div style="display:flex;justify-content:space-between;font-weight:700;font-size:' + fonts.small + ';"><span>الوقت:</span><span>' + timeStr + '</span></div>';
  previewHTML += '<div style="display:flex;justify-content:space-between;font-weight:700;font-size:' + fonts.small + ';"><span>المستخدم:</span><span>' + userName + '</span></div>';
  previewHTML += '</div>';

  // ملخص المبيعات
  previewHTML += '<div style="border:2px solid #000;margin-bottom:10px;">';
  previewHTML += '<div style="background:#000;color:#fff;padding:6px;font-weight:900;text-align:center;font-size:' + fonts.normal + ';">☆ ملخص المبيعات ☆</div>';
  previewHTML += '<div style="padding:8px;">';
  previewHTML += '<div style="display:flex;justify-content:space-between;font-weight:800;padding:4px 0;border-bottom:1px dashed #000;"><span>عدد العمليات:</span><span>' + (data.salesCount || 0) + ' عملية</span></div>';
  previewHTML += '<div style="display:flex;justify-content:space-between;font-weight:700;padding:4px 0;"><span>نقدي:</span><span>' + fmt(data.salesCash || 0) + '</span></div>';
  previewHTML += '<div style="display:flex;justify-content:space-between;font-weight:700;padding:4px 0;"><span>بطاقة:</span><span>' + fmt(data.salesCard || 0) + '</span></div>';
  previewHTML += '<div style="display:flex;justify-content:space-between;font-weight:700;padding:4px 0;"><span>تحويل:</span><span>' + fmt(data.salesTransfer || 0) + '</span></div>';
  previewHTML += '<div style="display:flex;justify-content:space-between;font-weight:900;padding:6px 0;border-top:2px solid #000;margin-top:5px;"><span>إجمالي المبيعات:</span><span>' + fmt(data.salesTotal || 0) + '</span></div>';
  previewHTML += '</div></div>';

  // تحصيلات العملاء (لو فيه)
  if ((data.clientPaymentsTotal || 0) > 0) {
    previewHTML += '<div style="border:2px solid #000;margin-bottom:10px;">';
    previewHTML += '<div style="background:#000;color:#fff;padding:6px;font-weight:900;text-align:center;font-size:' + fonts.normal + ';">☆ تحصيلات العملاء ☆</div>';
    previewHTML += '<div style="padding:8px;">';
    if ((data.clientPaymentsCash || 0) > 0) previewHTML += '<div style="display:flex;justify-content:space-between;font-weight:700;padding:4px 0;"><span>نقدي:</span><span>' + fmt(data.clientPaymentsCash) + '</span></div>';
    if ((data.clientPaymentsMobile || 0) > 0) previewHTML += '<div style="display:flex;justify-content:space-between;font-weight:700;padding:4px 0;"><span>محفظة:</span><span>' + fmt(data.clientPaymentsMobile) + '</span></div>';
    if ((data.clientPaymentsBank || 0) > 0) previewHTML += '<div style="display:flex;justify-content:space-between;font-weight:700;padding:4px 0;"><span>تحويل:</span><span>' + fmt(data.clientPaymentsBank) + '</span></div>';
    previewHTML += '<div style="display:flex;justify-content:space-between;font-weight:900;padding:6px 0;border-top:2px solid #000;margin-top:5px;color:#006400;"><span>إجمالي التحصيلات:</span><span>' + fmt(data.clientPaymentsTotal) + '</span></div>';
    previewHTML += '</div></div>';
  }

  // الإيداعات والمسحوبات
  previewHTML += '<div style="border:2px solid #000;margin-bottom:10px;">';
  previewHTML += '<div style="background:#000;color:#fff;padding:6px;font-weight:900;text-align:center;font-size:' + fonts.normal + ';">☆ الحركات المالية ☆</div>';
  previewHTML += '<div style="padding:8px;">';
  previewHTML += '<div style="display:flex;justify-content:space-between;font-weight:700;padding:4px 0;color:#006400;"><span>الإيداعات (' + (data.depositsCount || 0) + '):</span><span>+' + fmt(data.depositsTotal || 0) + '</span></div>';
  previewHTML += '<div style="display:flex;justify-content:space-between;font-weight:700;padding:4px 0;color:#8B0000;"><span>المسحوبات (' + (data.withdrawsCount || 0) + '):</span><span>-' + fmt(data.withdrawsTotal || 0) + '</span></div>';
  previewHTML += '</div></div>';

  // 💱 عمولات التحويلات
  if ((data.transferCount || 0) > 0) {
    previewHTML += '<div style="border:2px solid #000;margin-bottom:10px;">';
    previewHTML += '<div style="background:#000;color:#fff;padding:6px;font-weight:900;text-align:center;font-size:' + fonts.normal + ';">☆ عمولات التحويلات ☆</div>';
    previewHTML += '<div style="padding:8px;">';
    previewHTML += '<div style="display:flex;justify-content:space-between;font-weight:700;padding:4px 0;"><span>عدد التحويلات:</span><span>' + (data.transferCount || 0) + '</span></div>';
    previewHTML += '<div style="display:flex;justify-content:space-between;font-weight:900;padding:4px 0;border-top:1px dashed #000;color:#006400;"><span>إجمالي العمولات:</span><span>' + fmt(data.transferCommissionsTotal || 0) + '</span></div>';
    previewHTML += '</div></div>';
  }

  // المبلغ المحول للخزنة - يظهر فقط في حالة التقفيل
  if (isClosingReport) {
    previewHTML += '<div style="background:#000;color:#fff;padding:12px;text-align:center;margin:10px 0;border:3px solid #000;">';
    previewHTML += '<div style="font-size:' + fonts.header + ';font-weight:900;">☆ المحول للخزنة ☆</div>';
    previewHTML += '<div style="font-size:22px;font-weight:900;margin-top:5px;">' + fmt(shiftResult?.total_to_safe || 0) + ' ' + (settings.currency || 'ج.م') + '</div>';
    previewHTML += '</div>';
  } else {
    // في حالة التقرير العادي - إجمالي الدرج
    previewHTML += '<div style="background:#000;color:#fff;padding:12px;text-align:center;margin:10px 0;border:3px solid #000;">';
    previewHTML += '<div style="font-size:' + fonts.header + ';font-weight:900;">☆ إجمالي الدرج ☆</div>';
    previewHTML += '<div style="font-size:22px;font-weight:900;margin-top:5px;">' + fmt(data.total || data.expectedCash || 0) + ' ' + (settings.currency || 'ج.م') + '</div>';
    previewHTML += '</div>';
  }

  // Footer
  previewHTML += '<div style="text-align:center;padding:12px 0;border-top:3px double #000;margin-top:12px;">';
  previewHTML += '<div style="font-size:' + fonts.small + ';font-weight:700;color:#666;">' + footerText + '</div>';

  // باركود
  previewHTML += '<div style="margin-top:10px;text-align:center;display:flex;flex-direction:column;align-items:center;">';
  previewHTML += '<div style="max-width:200px;width:100%;">' + generateBarcodeSVG(reportNumber.replace(/[^A-Z0-9]/gi, '').slice(-12)) + '</div>';
  previewHTML += '<div style="font-family:monospace;font-size:10px;font-weight:700;letter-spacing:1px;margin-top:4px;">' + reportNumber + '</div>';
  previewHTML += '</div>';

  // توقيع ELOS
  previewHTML += '<div style="margin-top:15px;text-align:center;padding-top:8px;">';
  previewHTML += '<div style="color:#000;font-size:10px;">═══════════════════════</div>';
  previewHTML += '<div style="font-size:14px;font-weight:900;color:#000;margin:5px 0;letter-spacing:3px;">◆ ELOS ◆</div>';
  previewHTML += '<div style="font-size:9px;font-weight:600;color:#333;">Powered by ELOS System</div>';
  previewHTML += '<div style="font-size:8px;color:#666;margin-top:3px;">www.elos-system.com</div>';
  previewHTML += '</div>';
  previewHTML += '</div>';

  previewHTML += '</div>';

  // ═══════════════════════════════════════════════════════════════
  // بناء HTML الطباعة
  // ═══════════════════════════════════════════════════════════════
  currentShiftReportHTML = '<!DOCTYPE html><html dir="rtl" lang="ar"><head><meta charset="UTF-8"><title>تقرير الشفت</title>';
  currentShiftReportHTML += '<style>';
  currentShiftReportHTML += '* { margin:0; padding:0; box-sizing:border-box; }';
  currentShiftReportHTML += '@page { size:' + pageSize + 'mm auto; margin:0; }';
  currentShiftReportHTML += 'body { font-family:Arial,Tahoma,sans-serif; width:' + paperWidth + '; max-width:' + paperWidth + '; margin:0 auto; padding:2mm; background:#fff; color:#000; font-size:' + fonts.normal + '; line-height:1.3; font-weight:700; -webkit-print-color-adjust:exact; print-color-adjust:exact; }';

  // Header styles
  currentShiftReportHTML += '.header { text-align:center; padding-bottom:2mm; border-bottom:0.8mm double #000; margin-bottom:2mm; }';
  currentShiftReportHTML += '.logo { max-width:18mm; max-height:18mm; margin-bottom:1mm; display:block; margin-left:auto; margin-right:auto; }';
  currentShiftReportHTML += '.shop-name { font-size:' + fonts.title + '; font-weight:900; color:#000; }';

  // Title & boxes
  currentShiftReportHTML += '.title-box { background:#000; color:#fff; padding:2.5mm; text-align:center; font-weight:900; font-size:' + fonts.header + '; margin:2mm 0; }';
  currentShiftReportHTML += '.info-box { border:0.4mm solid #000; padding:2mm; margin-bottom:2mm; }';
  currentShiftReportHTML += '.info-row { display:flex; justify-content:space-between; font-weight:700; font-size:' + fonts.small + '; padding:0.5mm 0; }';
  currentShiftReportHTML += '.info-row.bold { font-weight:900; font-size:' + fonts.normal + '; }';

  // Section styles
  currentShiftReportHTML += '.section-box { border:0.4mm solid #000; margin-bottom:2mm; }';
  currentShiftReportHTML += '.section-header { background:#000; color:#fff; padding:1.5mm; font-weight:900; text-align:center; font-size:' + fonts.normal + '; }';
  currentShiftReportHTML += '.section-content { padding:2mm; }';
  currentShiftReportHTML += '.row { display:flex; justify-content:space-between; font-weight:700; font-size:' + fonts.small + '; padding:1mm 0; }';
  currentShiftReportHTML += '.row.border-top { border-top:0.4mm solid #000; margin-top:1mm; padding-top:2mm; }';
  currentShiftReportHTML += '.row.bold { font-weight:900; font-size:' + fonts.normal + '; }';
  currentShiftReportHTML += '.row.green { color:#000; }';
  currentShiftReportHTML += '.row.red { color:#000; }';

  // Total box
  currentShiftReportHTML += '.total-box { background:#000; color:#fff; padding:4mm 2mm; text-align:center; margin:2mm 0; }';
  currentShiftReportHTML += '.total-label { font-size:' + fonts.header + '; font-weight:900; }';
  currentShiftReportHTML += '.total-amount { font-size:' + fonts.title + '; font-weight:900; margin-top:1mm; }';

  // Footer
  currentShiftReportHTML += '.footer { text-align:center; padding-top:2mm; border-top:0.8mm double #000; margin-top:2mm; }';
  currentShiftReportHTML += '.footer-info { font-size:' + fonts.small + '; font-weight:700; color:#000; }';
  currentShiftReportHTML += '.barcode { margin-top:2mm; text-align:center; }';
  currentShiftReportHTML += '.barcode svg { max-width:90%; height:auto; }';
  currentShiftReportHTML += '.barcode-num { font-family:monospace; font-size:9px; font-weight:700; margin-top:1mm; }';
  currentShiftReportHTML += '.elos-signature { margin-top:3mm; text-align:center; }';
  currentShiftReportHTML += '.sig-line { font-size:8px; }';
  currentShiftReportHTML += '.sig-logo { font-size:11px; font-weight:900; margin:1mm 0; letter-spacing:2px; }';
  currentShiftReportHTML += '.sig-text { font-size:7px; font-weight:600; color:#333; }';
  currentShiftReportHTML += '.sig-website { font-size:6px; color:#666; margin-top:0.5mm; }';

  currentShiftReportHTML += '</style></head><body>';

  // Header
  currentShiftReportHTML += '<div class="header">';
  if (settings.companyLogo) currentShiftReportHTML += '<img src="' + settings.companyLogo + '" class="logo" />';
  currentShiftReportHTML += '<div class="shop-name">' + (settings.companyName || 'ELOS') + '</div>';
  currentShiftReportHTML += '</div>';

  // عنوان التقرير
  currentShiftReportHTML += '<div class="title-box">☆ ' + reportTitle + ' ☆</div>';

  // معلومات التقرير
  currentShiftReportHTML += '<div class="info-box">';
  currentShiftReportHTML += '<div class="info-row bold"><span>رقم التقرير:</span><span>' + reportNumber + '</span></div>';
  currentShiftReportHTML += '<div class="info-row"><span>التاريخ:</span><span>' + dateStr + '</span></div>';
  currentShiftReportHTML += '<div class="info-row"><span>الوقت:</span><span>' + timeStr + '</span></div>';
  currentShiftReportHTML += '<div class="info-row"><span>المستخدم:</span><span>' + userName + '</span></div>';
  currentShiftReportHTML += '</div>';

  // ملخص المبيعات
  currentShiftReportHTML += '<div class="section-box">';
  currentShiftReportHTML += '<div class="section-header">☆ ملخص المبيعات ☆</div>';
  currentShiftReportHTML += '<div class="section-content">';
  currentShiftReportHTML += '<div class="row bold border-top" style="border:none;margin:0;padding-top:0;"><span>عدد العمليات:</span><span>' + (data.salesCount || 0) + ' عملية</span></div>';
  currentShiftReportHTML += '<div class="row"><span>نقدي:</span><span>' + fmt(data.salesCash || 0) + '</span></div>';
  currentShiftReportHTML += '<div class="row"><span>بطاقة:</span><span>' + fmt(data.salesCard || 0) + '</span></div>';
  currentShiftReportHTML += '<div class="row"><span>تحويل:</span><span>' + fmt(data.salesTransfer || 0) + '</span></div>';
  currentShiftReportHTML += '<div class="row bold border-top"><span>إجمالي المبيعات:</span><span>' + fmt(data.salesTotal || 0) + '</span></div>';
  currentShiftReportHTML += '</div></div>';

  // تحصيلات العملاء (لو فيه)
  if ((data.clientPaymentsTotal || 0) > 0) {
    currentShiftReportHTML += '<div class="section-box">';
    currentShiftReportHTML += '<div class="section-header">☆ تحصيلات العملاء ☆</div>';
    currentShiftReportHTML += '<div class="section-content">';
    if ((data.clientPaymentsCash || 0) > 0) currentShiftReportHTML += '<div class="row"><span>نقدي:</span><span>' + fmt(data.clientPaymentsCash) + '</span></div>';
    if ((data.clientPaymentsMobile || 0) > 0) currentShiftReportHTML += '<div class="row"><span>محفظة:</span><span>' + fmt(data.clientPaymentsMobile) + '</span></div>';
    if ((data.clientPaymentsBank || 0) > 0) currentShiftReportHTML += '<div class="row"><span>تحويل:</span><span>' + fmt(data.clientPaymentsBank) + '</span></div>';
    currentShiftReportHTML += '<div class="row green" style="border-top:2px solid #000;margin-top:5px;"><span>إجمالي التحصيلات:</span><span>' + fmt(data.clientPaymentsTotal) + '</span></div>';
    currentShiftReportHTML += '</div></div>';
  }

  // الحركات المالية
  currentShiftReportHTML += '<div class="section-box">';
  currentShiftReportHTML += '<div class="section-header">☆ الحركات المالية ☆</div>';
  currentShiftReportHTML += '<div class="section-content">';
  currentShiftReportHTML += '<div class="row green"><span>الإيداعات (' + (data.depositsCount || 0) + '):</span><span>+' + fmt(data.depositsTotal || 0) + '</span></div>';
  currentShiftReportHTML += '<div class="row red"><span>المسحوبات (' + (data.withdrawsCount || 0) + '):</span><span>-' + fmt(data.withdrawsTotal || 0) + '</span></div>';
  currentShiftReportHTML += '</div></div>';

  // المحول للخزنة أو إجمالي الدرج
  currentShiftReportHTML += '<div class="total-box">';
  if (isClosingReport) {
    currentShiftReportHTML += '<div class="total-label">☆ المحول للخزنة ☆</div>';
    currentShiftReportHTML += '<div class="total-amount">' + fmt(shiftResult?.total_to_safe || 0) + ' ' + (settings.currency || 'ج.م') + '</div>';
  } else {
    currentShiftReportHTML += '<div class="total-label">☆ إجمالي الدرج ☆</div>';
    currentShiftReportHTML += '<div class="total-amount">' + fmt(data.total || data.expectedCash || 0) + ' ' + (settings.currency || 'ج.م') + '</div>';
  }
  currentShiftReportHTML += '</div>';

  // Footer
  currentShiftReportHTML += '<div class="footer">';
  currentShiftReportHTML += '<div class="footer-info">' + footerText + '</div>';

  // باركود
  currentShiftReportHTML += '<div class="barcode">';
  currentShiftReportHTML += generateBarcodeSVG(reportNumber.replace(/[^A-Z0-9]/gi, '').slice(-12));
  currentShiftReportHTML += '<div class="barcode-num">' + reportNumber + '</div>';
  currentShiftReportHTML += '</div>';

  // توقيع ELOS
  currentShiftReportHTML += '<div class="elos-signature">';
  currentShiftReportHTML += '<div class="sig-line">═══════════════════════</div>';
  currentShiftReportHTML += '<div class="sig-logo">◆ ELOS ◆</div>';
  currentShiftReportHTML += '<div class="sig-text">Powered by ELOS System</div>';
  currentShiftReportHTML += '<div class="sig-website">www.elos-system.com</div>';
  currentShiftReportHTML += '</div>';

  currentShiftReportHTML += '</div>';
  currentShiftReportHTML += '</body></html>';

  // عرض المعاينة
  showShiftReportPreview(previewHTML, isClosingReport);
}

/**
 * عرض نافذة معاينة تقرير الشفت
 * - تقفيل: toast صغير في الزاوية
 * - تقرير عادي: شاشة معاينة كاملة فيها التقرير
 */
function showShiftReportPreview(previewHTML, isClosingReport = true) {
  // إزالة أي modal سابق
  let existingModal = document.getElementById('shiftReportModal');
  if (existingModal) existingModal.remove();

  if (isClosingReport) {
    // ═══ حالة التقفيل: toast صغير في الزاوية ═══
    const modal = document.createElement('div');
    modal.id = 'shiftReportModal';
    modal.style.cssText = `
      position: fixed;
      bottom: 20px;
      left: 20px;
      background: linear-gradient(135deg, #059669, #047857);
      border-radius: 16px;
      padding: 16px 20px;
      box-shadow: 0 10px 40px rgba(0,0,0,0.3);
      z-index: 99999;
      display: flex;
      align-items: center;
      gap: 16px;
      animation: slideInUp 0.3s ease;
      max-width: 380px;
    `;

    modal.innerHTML = `
      <style>
        @keyframes slideInUp {
          from { transform: translateY(100px); opacity: 0; }
          to { transform: translateY(0); opacity: 1; }
        }
        #shiftReportModal button:hover { transform: scale(1.05); }
      </style>
      <div style="color: white;">
        <div style="font-size: 18px; font-weight: bold; margin-bottom: 4px;">✅ تم تقفيل الشفت بنجاح</div>
        <div style="font-size: 13px; opacity: 0.9;">هل تريد طباعة التقرير؟</div>
      </div>
      <div style="display: flex; gap: 8px;">
        <button id="skipShiftPrintBtn" style="
          padding: 10px 16px;
          border: 2px solid rgba(255,255,255,0.3);
          background: transparent;
          color: white;
          border-radius: 8px;
          cursor: pointer;
          font-size: 14px;
          font-weight: bold;
          transition: all 0.2s;
        ">تخطي</button>
        <button id="printShiftReportBtn" style="
          padding: 10px 16px;
          border: none;
          background: white;
          color: #047857;
          border-radius: 8px;
          cursor: pointer;
          font-size: 14px;
          font-weight: bold;
          transition: all 0.2s;
        ">🖨️ طباعة</button>
      </div>
    `;

    document.body.appendChild(modal);

    document.getElementById('skipShiftPrintBtn').onclick = closeShiftReportPreview;
    document.getElementById('printShiftReportBtn').onclick = executeShiftReportPrint;

    // إغلاق تلقائي بعد 10 ثواني
    setTimeout(() => {
      if (document.getElementById('shiftReportModal')) {
        closeShiftReportPreview();
      }
    }, 10000);

  } else {
    // ═══ حالة التقرير العادي: شاشة معاينة كاملة ═══
    const modal = document.createElement('div');
    modal.id = 'shiftReportModal';
    modal.style.cssText = `
      position: fixed;
      top: 0; left: 0; right: 0; bottom: 0;
      background: rgba(0, 0, 0, 0.6);
      z-index: 99999;
      display: flex;
      align-items: center;
      justify-content: center;
      animation: fadeIn 0.2s ease;
    `;

    modal.innerHTML = `
      <style>
        @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
        #reportPreviewContainer::-webkit-scrollbar { width: 6px; }
        #reportPreviewContainer::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.3); border-radius: 3px; }
      </style>
      <div style="
        background: var(--bg-primary, #1a1a2e);
        border-radius: 16px;
        width: 400px;
        max-height: 85vh;
        display: flex;
        flex-direction: column;
        box-shadow: 0 20px 60px rgba(0,0,0,0.5);
        overflow: hidden;
      ">
        <!-- Header -->
        <div style="
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 14px 20px;
          background: linear-gradient(135deg, #f59e0b 0%, #d97706 100%);
          color: white;
        ">
          <div style="font-size: 16px; font-weight: 800;">🖨️ معاينة التقرير</div>
          <button id="closeReportPreviewBtn" style="
            background: rgba(255,255,255,0.2);
            border: none;
            color: white;
            width: 32px; height: 32px;
            border-radius: 8px;
            cursor: pointer;
            font-size: 18px;
            display: flex;
            align-items: center;
            justify-content: center;
          ">✕</button>
        </div>

        <!-- محتوى التقرير -->
        <div id="reportPreviewContainer" style="
          flex: 1;
          overflow-y: auto;
          padding: 16px;
          background: white;
        ">
          ${previewHTML}
        </div>

        <!-- أزرار -->
        <div style="
          display: flex;
          gap: 10px;
          padding: 14px 20px;
          background: var(--bg-secondary, #16213e);
          border-top: 1px solid var(--line, #333);
        ">
          <button id="closeReportPreviewBtn2" style="
            flex: 1;
            padding: 12px;
            background: var(--bg-tertiary, #2a2a4a);
            color: var(--text-secondary, #aaa);
            border: 1px solid var(--line, #333);
            border-radius: 10px;
            cursor: pointer;
            font-size: 14px;
            font-weight: 700;
          ">إغلاق</button>
          <button id="printShiftReportBtn" style="
            flex: 2;
            padding: 12px;
            background: linear-gradient(135deg, #f59e0b 0%, #d97706 100%);
            color: white;
            border: none;
            border-radius: 10px;
            cursor: pointer;
            font-size: 15px;
            font-weight: 800;
          ">🖨️ طباعة التقرير</button>
        </div>
      </div>
    `;

    document.body.appendChild(modal);

    // إغلاق بالضغط على الخلفية
    modal.addEventListener('click', (e) => {
      if (e.target === modal) closeShiftReportPreview();
    });

    document.getElementById('closeReportPreviewBtn').onclick = closeShiftReportPreview;
    document.getElementById('closeReportPreviewBtn2').onclick = closeShiftReportPreview;
    document.getElementById('printShiftReportBtn').onclick = executeShiftReportPrint;
  }
}

/**
 * إغلاق نافذة معاينة تقرير الشفت
 */
function closeShiftReportPreview() {
  const modal = document.getElementById('shiftReportModal');
  if (modal) modal.remove();
  currentShiftReportHTML = '';
}

/**
 * تنفيذ طباعة تقرير الشفت
 */
function executeShiftReportPrint() {
  if (!currentShiftReportHTML) {
    showToast('لا يوجد تقرير للطباعة', 'error');
    return;
  }

  try {
    const printFrame = document.createElement('iframe');
    printFrame.style.cssText = 'position:absolute;width:0;height:0;border:none;left:-9999px;';
    document.body.appendChild(printFrame);

    printFrame.contentDocument.write(currentShiftReportHTML);
    printFrame.contentDocument.close();

    printFrame.onload = function() {
      setTimeout(() => {
        printFrame.contentWindow.print();
        setTimeout(() => {
          document.body.removeChild(printFrame);
          closeShiftReportPreview();
          showToast('✅ تم إرسال التقرير للطباعة', 'success');
        }, 1000);
      }, 300);
    };
  } catch (error) {
    Logger.error('Error printing shift report:', error);
    showToast('خطأ في الطباعة: ' + translateError(error.message), 'error');
  }
}

// ═══════════════════════════════════════════════════════════════
// 🧾 ENHANCED CHECKOUT MODAL SYSTEM
// ═══════════════════════════════════════════════════════════════

let checkoutPaymentMethod = 'cash';
let deferredWalletId = null; // ✅ v1.2.7: ID المحفظة المختارة للبيع الآجل

// ✅ v1.2.7: تحميل المحافظ في قائمة البيع الآجل
async function loadDeferredWalletSelect() {
  const select = document.getElementById('deferredWalletSelect');
  if (!select) return;

  // تحميل المحافظ إذا لم تكن محملة
  if (paymentWallets.length === 0) {
    await loadPaymentWallets();
  }

  // أيقونات المحافظ
  const walletIcons = {
    cash: '💵',
    mobile_wallet: '📱',
    bank: '🏦'
  };

  // بناء الخيارات
  let options = '<option value="">-- اختر المحفظة --</option>';
  paymentWallets.forEach(wallet => {
    const icon = walletIcons[wallet.type] || '💳';
    const defaultLabel = wallet.is_default ? ' (افتراضي)' : '';
    options += `<option value="${wallet.id}" data-type="${wallet.type}">${icon} ${wallet.name}${defaultLabel}</option>`;
  });

  select.innerHTML = options;

  // اختيار المحفظة الافتراضية (كاش)
  const defaultCashWallet = paymentWallets.find(w => w.type === 'cash' && w.is_default);
  if (defaultCashWallet) {
    select.value = defaultCashWallet.id;
    deferredWalletId = defaultCashWallet.id;
  }

  // مراقبة التغيير
  select.onchange = function() {
    deferredWalletId = this.value ? parseInt(this.value) : null;
  };
}

// Open Checkout Modal (called from btnCheckout)
async function openCheckoutModal() {
  if (cart.length === 0) {
    showToast('السلة فارغة', 'warning');
    return;
  }

  const modal = document.getElementById('checkoutModal');
  if (!modal) return;

  // إغلاق أي مودالات مفتوحة أولاً
  ModalSystem.closeAll('checkoutModal');

  // Populate client dropdown
  populateCheckoutClients();

  // ✅ v1.2.7: تحميل المحافظ لقائمة البيع الآجل
  await loadDeferredWalletSelect();

  // Render cart items in unified modal
  renderUnifiedCartItems();

  // Update totals
  updateCheckoutTotals();

  // Update header info
  const itemsCount = cart.length;
  const total = cart.reduce((sum, item) => sum + (Number(item.price) || 0), 0);
  document.getElementById('checkoutItemsCount').textContent = `${itemsCount} عنصر`;
  document.getElementById('cartItemsCount').textContent = itemsCount;
  document.getElementById('unifiedHeaderTotal').textContent = fmt(total) + ' ج.م';

  // Show modal
  modal.classList.add('show');

  // Auto-focus on first input
  setTimeout(() => {
    const firstInput = modal.querySelector('input:not([type="hidden"]):not([disabled])');
    if (firstInput) firstInput.focus();
  }, 100);
}

// Render cart items in unified checkout modal
function renderUnifiedCartItems() {
  const container = document.getElementById('unifiedCartItems');
  if (!container) return;

  if (cart.length === 0) {
    container.innerHTML = '<div style="text-align: center; padding: 40px; color: var(--muted);">السلة فارغة</div>';
    return;
  }

  container.innerHTML = cart.map((item, index) => {
    const isAccessory = item.isAccessory || item.type === 'accessory';
    const icon = isAccessory ? '🎧' : '📱';
    const name = item.label || item.name || 'منتج';
    const details = isAccessory ? `الكمية: ${item.qty || 1}` : (item.imei || item.condition || '');
    const price = Number(item.price) || 0;

    return `
      <div class="unified-cart-item" data-index="${index}">
        <div class="cart-item-icon">${icon}</div>
        <div class="cart-item-info">
          <span class="cart-item-name">${name}</span>
          <span class="cart-item-details">${details}</span>
        </div>
        <span class="cart-item-price">${fmt(price)} ج.م</span>
        <button class="cart-item-remove" onclick="removeFromCartUnified(${index})" title="حذف">🗑️</button>
      </div>
    `;
  }).join('');
}

// Remove item from cart in unified modal
function removeFromCartUnified(index) {
  if (index >= 0 && index < cart.length) {
    cart.splice(index, 1);
    renderUnifiedCartItems();
    updateCheckoutTotals();
    updateSummary();
    renderCart();

    // Update header
    const itemsCount = cart.length;
    const total = cart.reduce((sum, item) => sum + (Number(item.price) || 0), 0);
    document.getElementById('checkoutItemsCount').textContent = `${itemsCount} عنصر`;
    document.getElementById('cartItemsCount').textContent = itemsCount;
    document.getElementById('unifiedHeaderTotal').textContent = fmt(total) + ' ج.م';

    if (cart.length === 0) {
      closeCheckoutModal();
      showToast('تم إفراغ السلة', 'info');
    }
  }
}

// Close Checkout Modal
function closeCheckoutModal() {
  document.getElementById('checkoutModal')?.classList.remove('show');
}

// Reset Checkout Modal - تنظيف كل البيانات
function resetCheckoutModal() {
  // Reset client selection
  const clientSelect = document.getElementById('checkoutClientSelect');
  if (clientSelect) clientSelect.value = '';
  selectedClientId = null;

  // Reset client inputs
  const checkoutName = document.getElementById('checkoutName');
  const checkoutPhone = document.getElementById('checkoutPhone');
  if (checkoutName) checkoutName.value = '';
  if (checkoutPhone) checkoutPhone.value = '';

  // Reset client search
  const clientSearchInput = document.getElementById('clientSearchInput');
  if (clientSearchInput) clientSearchInput.value = '';

  // Hide save new client option
  const saveNewClientOption = document.getElementById('saveNewClientOption');
  if (saveNewClientOption) saveNewClientOption.style.display = 'none';
  const saveNewClientCheckbox = document.getElementById('saveNewClientCheckbox');
  if (saveNewClientCheckbox) saveNewClientCheckbox.checked = false;

  // Hide client balance
  const clientBalance = document.getElementById('checkoutClientBalance');
  if (clientBalance) clientBalance.style.display = 'none';

  // Reset payment method to cash
  checkoutPaymentMethod = 'cash';
  document.querySelectorAll('.payment-method-btn').forEach(btn => {
    btn.classList.remove('active');
    if (btn.dataset.method === 'cash') btn.classList.add('active');
  });

  // Hide split payment section
  const splitSection = document.getElementById('splitPaymentSection');
  if (splitSection) splitSection.style.display = 'none';

  // Reset split payment inputs
  const splitCash = document.getElementById('splitCash');
  const splitCard = document.getElementById('splitCard');
  const splitTransfer = document.getElementById('splitTransfer');
  if (splitCash) splitCash.value = '';
  if (splitCard) splitCard.value = '';
  if (splitTransfer) splitTransfer.value = '';

  // Reset cash received
  const cashReceived = document.getElementById('checkoutCashReceived');
  if (cashReceived) cashReceived.value = '';

  // Hide change section
  const changeSection = document.getElementById('checkoutChangeSection');
  if (changeSection) changeSection.style.display = 'none';

  // Reset deferred payment section (NEW)
  const deferredSection = document.getElementById('deferredPaymentSection');
  if (deferredSection) deferredSection.style.display = 'none';
  const paidNow = document.getElementById('checkoutPaidNow');
  if (paidNow) paidNow.value = '';
  const deferredRemaining = document.getElementById('deferredRemainingDisplay');
  if (deferredRemaining) deferredRemaining.textContent = '0.00 ج.م';
  const clientRequired = document.getElementById('checkoutClientRequired');
  if (clientRequired) clientRequired.style.display = 'none';

  // ✅ v1.2.7: Reset deferred wallet selection
  deferredWalletId = null;
  const deferredPaymentMethodSection = document.getElementById('deferredPaymentMethodSection');
  if (deferredPaymentMethodSection) deferredPaymentMethodSection.style.display = 'none';
  const deferredWalletSelect = document.getElementById('deferredWalletSelect');
  if (deferredWalletSelect) deferredWalletSelect.value = '';

  // Re-show cash received input (in case it was hidden for deferred)
  const cashReceivedInput = document.getElementById('checkoutCashReceived');
  if (cashReceivedInput) cashReceivedInput.style.display = 'block';

  // Reset discount
  const discPct = document.getElementById('checkoutDiscPct');
  const discVal = document.getElementById('checkoutDiscVal');
  if (discPct) discPct.value = '';
  if (discVal) discVal.value = '';

  // Reset trade-in
  const tradeinCheckbox = document.getElementById('tradeinToggleCheckbox');
  if (tradeinCheckbox) tradeinCheckbox.checked = false;
  const tradeinContent = document.getElementById('tradeinContent');
  if (tradeinContent) tradeinContent.style.display = 'none';
  const tradeinValue = document.getElementById('tradeinDeviceValue');
  if (tradeinValue) tradeinValue.value = '';
  const tradeinType = document.getElementById('tradeinDeviceType');
  if (tradeinType) tradeinType.value = '';
  const tradeinModel = document.getElementById('tradeinDeviceModel');
  if (tradeinModel) tradeinModel.value = '';
  const tradeinImei = document.getElementById('tradeinDeviceImei');
  if (tradeinImei) tradeinImei.value = '';
  const tradeinNotes = document.getElementById('tradeinDeviceNotes');
  if (tradeinNotes) tradeinNotes.value = '';

  Logger.log('[CHECKOUT] Modal reset complete');
}

// Populate checkout clients dropdown with search
function populateCheckoutClients() {
  const select = document.getElementById('checkoutClientSelect');
  const searchInput = document.getElementById('clientSearchInput');
  if (!select) return;

  // Build full clients list
  function buildClientOptions(filter = '') {
    select.innerHTML = '<option value="">-- عميل نقدي / جديد --</option>';

    if (clientsList && clientsList.length > 0) {
      const filterLower = filter.toLowerCase();
      const filtered = filter
        ? clientsList.filter(c =>
            (c.name || '').toLowerCase().includes(filterLower) ||
            (c.phone || '').includes(filter)
          )
        : clientsList;

      filtered.forEach(client => {
        const opt = document.createElement('option');
        opt.value = client.id;
        const balance = Number(client.balance || 0);
        const balanceText = balance > 0 ? ` [رصيد: ${fmt(balance)}]` : '';
        opt.textContent = `${client.name} ${client.phone ? '(' + client.phone + ')' : ''}${balanceText}`;
        select.appendChild(opt);
      });

      // Show count
      if (filter && filtered.length !== clientsList.length) {
        const countOpt = document.createElement('option');
        countOpt.disabled = true;
        countOpt.textContent = `--- عُثر على ${filtered.length} من ${clientsList.length} ---`;
        select.insertBefore(countOpt, select.firstChild.nextSibling);
      }
    }
  }

  buildClientOptions();

  // Setup search input if exists
  if (searchInput) {
    searchInput.value = '';
    searchInput.oninput = debounce((e) => {
      buildClientOptions(e.target.value);
    }, 200);
  }

  // If client was selected in cart modal, select it here
  if (selectedClientId) {
    select.value = selectedClientId;
  }

  // Listen for changes
  select.onchange = function() {
    const clientId = this.value;
    selectedClientId = clientId ? Number(clientId) : null;

    const client = clientsList.find(c => c.id === selectedClientId);
    const saveNewClientOption = document.getElementById('saveNewClientOption');
    const saveNewClientCheckbox = document.getElementById('saveNewClientCheckbox');

    if (client) {
      document.getElementById('checkoutName').value = client.name || '';
      document.getElementById('checkoutPhone').value = client.phone || '';

      // Show balance
      const balance = Number(client.balance || 0);
      const balanceSection = document.getElementById('checkoutClientBalance');
      if (balance > 0) {
        balanceSection.style.display = 'block';
        document.getElementById('checkoutClientBalanceValue').textContent = fmt(balance) + ' ج.م';
      } else {
        balanceSection.style.display = 'none';
      }

      // Hide save new client option for existing clients
      if (saveNewClientOption) saveNewClientOption.style.display = 'none';
      if (saveNewClientCheckbox) saveNewClientCheckbox.checked = false;

      // ✅ جلب معلومات إضافية عن العميل (الحد الائتماني، آخر زيارة، تحذيرات)
      loadClientQuickInfo(client.id);
    } else {
      document.getElementById('checkoutName').value = '';
      document.getElementById('checkoutPhone').value = '';
      document.getElementById('checkoutClientBalance').style.display = 'none';

      // Hide save new client option initially (will show when name/phone entered)
      if (saveNewClientOption) saveNewClientOption.style.display = 'none';
      if (saveNewClientCheckbox) saveNewClientCheckbox.checked = false;
    }

    updateCheckoutRemaining();
  };

  // Show save new client option when typing name or phone
  const nameInput = document.getElementById('checkoutName');
  const phoneInput = document.getElementById('checkoutPhone');
  const saveNewClientOption = document.getElementById('saveNewClientOption');

  function checkShowSaveClientOption() {
    const name = nameInput?.value?.trim() || '';
    const phone = phoneInput?.value?.trim() || '';
    const isNewClient = !select.value; // No existing client selected

    if (isNewClient && (name.length >= 2 || phone.length >= 6)) {
      if (saveNewClientOption) saveNewClientOption.style.display = 'block';
    } else {
      if (saveNewClientOption) saveNewClientOption.style.display = 'none';
    }
  }

  if (nameInput) nameInput.addEventListener('input', checkShowSaveClientOption);
  if (phoneInput) phoneInput.addEventListener('input', checkShowSaveClientOption);
}

// ═══════════════════════════════════════════════════════════════
// 👤 CLIENT QUICK INFO - عرض معلومات سريعة عن العميل
// ═══════════════════════════════════════════════════════════════

async function loadClientQuickInfo(clientId) {
  if (!clientId) {
    hideClientQuickInfo();
    return;
  }

  try {
    const res = await fetch(`elos-db://client-recent?id=${clientId}&limit=5`);
    if (!res.ok) return;

    const data = await res.json();
    showClientQuickInfo(data);
  } catch (e) {
    Logger.error('[POS] Failed to load client quick info:', e);
  }
}

function showClientQuickInfo(data) {
  const { client, transactions, creditWarning } = data;

  // إنشاء أو تحديث عنصر المعلومات السريعة
  let infoEl = document.getElementById('clientQuickInfo');
  if (!infoEl) {
    infoEl = document.createElement('div');
    infoEl.id = 'clientQuickInfo';
    infoEl.className = 'client-quick-info';
    // إضافة بعد قسم الرصيد
    const balanceSection = document.getElementById('checkoutClientBalance');
    if (balanceSection) {
      balanceSection.parentNode.insertBefore(infoEl, balanceSection.nextSibling);
    }
  }

  // بناء المحتوى
  let html = '';

  // تحذير الحد الائتماني
  if (creditWarning) {
    const warningClass = creditWarning.level === 'exceeded' ? 'credit-exceeded' : 'credit-warning';
    html += `
      <div class="client-credit-alert ${warningClass}">
        <span class="alert-icon">${creditWarning.level === 'exceeded' ? '🚫' : '⚠️'}</span>
        <span class="alert-text">${creditWarning.message}</span>
        <span class="alert-detail">(الحد: ${fmt(creditWarning.limit)} ج.م)</span>
      </div>
    `;
  }

  // معلومات إضافية
  const categoryLabels = { regular: '👤 عادي', vip: '⭐ VIP', new: '🆕 جديد' };
  const categoryLabel = categoryLabels[client.category] || categoryLabels.regular;

  html += `
    <div class="client-meta">
      <span class="client-category">${categoryLabel}</span>
      ${client.visit_count ? `<span class="client-visits">📊 ${client.visit_count} زيارة</span>` : ''}
      ${client.last_visit ? `<span class="client-last-visit">🕐 آخر زيارة: ${formatDate(client.last_visit)}</span>` : ''}
    </div>
  `;

  // آخر المعاملات
  if (transactions && transactions.length > 0) {
    html += `
      <div class="client-recent-transactions">
        <div class="recent-header">📜 آخر المعاملات</div>
        <div class="recent-list">
    `;

    transactions.slice(0, 3).forEach(t => {
      const icon = t.type === 'sale' ? '🛒' : '💰';
      const statusClass = t.status === 'completed' ? '' : 'status-' + t.status;
      const date = formatDate(t.created_at);
      html += `
        <div class="recent-item ${statusClass}">
          <span class="item-icon">${icon}</span>
          <span class="item-desc">${t.description || (t.type === 'payment' ? 'دفعة' : 'معاملة')}</span>
          <span class="item-amount">${fmt(t.amount)} ج.م</span>
          <span class="item-date">${date}</span>
        </div>
      `;
    });

    html += `
        </div>
      </div>
    `;
  }

  infoEl.innerHTML = html;
  infoEl.style.display = 'block';

  // إضافة الأنماط إذا لم تكن موجودة
  addClientQuickInfoStyles();
}

function hideClientQuickInfo() {
  const infoEl = document.getElementById('clientQuickInfo');
  if (infoEl) {
    infoEl.style.display = 'none';
  }
}

function formatDate(dateStr) {
  if (!dateStr) return '';

  // SQLite يخزن التاريخ بصيغة 'YYYY-MM-DD HH:MM:SS' بدون timezone
  // نحتاج نتعامل معه كتوقيت محلي وليس UTC
  let date;
  if (typeof dateStr === 'string' && !dateStr.includes('T') && !dateStr.includes('Z')) {
    const [datePart, timePart] = dateStr.split(' ');
    if (timePart) {
      date = new Date(`${datePart}T${timePart}`);
    } else {
      date = new Date(datePart + 'T00:00:00');
    }
  } else {
    date = new Date(dateStr);
  }

  const now = new Date();
  const diffDays = Math.floor((now - date) / (1000 * 60 * 60 * 24));

  if (diffDays < 0) return 'اليوم'; // في حالة فرق التوقيت
  if (diffDays === 0) return 'اليوم';
  if (diffDays === 1) return 'أمس';
  if (diffDays < 7) return `منذ ${diffDays} أيام`;
  if (diffDays < 30) return `منذ ${Math.floor(diffDays / 7)} أسابيع`;

  return date.toLocaleDateString('ar-EG', { month: 'short', day: 'numeric' });
}

function addClientQuickInfoStyles() {
  if (document.getElementById('clientQuickInfoStyles')) return;

  const style = document.createElement('style');
  style.id = 'clientQuickInfoStyles';
  style.textContent = `
    .client-quick-info {
      background: var(--surface);
      border: 1px solid var(--border);
      border-radius: 8px;
      padding: 12px;
      margin-top: 10px;
      font-size: 12px;
    }

    .client-credit-alert {
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 8px 12px;
      border-radius: 6px;
      margin-bottom: 10px;
      font-weight: 600;
    }

    .client-credit-alert.credit-warning {
      background: rgba(255, 193, 7, 0.15);
      border: 1px solid rgba(255, 193, 7, 0.3);
      color: #ffc107;
    }

    .client-credit-alert.credit-exceeded {
      background: rgba(220, 53, 69, 0.15);
      border: 1px solid rgba(220, 53, 69, 0.3);
      color: #dc3545;
    }

    .alert-detail {
      font-weight: 400;
      opacity: 0.8;
      font-size: 11px;
    }

    .client-meta {
      display: flex;
      flex-wrap: wrap;
      gap: 12px;
      margin-bottom: 10px;
      color: var(--muted);
    }

    .client-meta span {
      display: flex;
      align-items: center;
      gap: 4px;
    }

    .client-category {
      background: var(--brand-soft);
      color: var(--brand);
      padding: 2px 8px;
      border-radius: 4px;
      font-weight: 600;
    }

    .client-recent-transactions {
      border-top: 1px solid var(--border);
      padding-top: 10px;
    }

    .recent-header {
      font-weight: 600;
      margin-bottom: 8px;
      color: var(--ink);
    }

    .recent-list {
      display: flex;
      flex-direction: column;
      gap: 6px;
    }

    .recent-item {
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 6px 8px;
      background: var(--surface-hover);
      border-radius: 4px;
    }

    .recent-item.status-returned {
      opacity: 0.6;
      text-decoration: line-through;
    }

    .recent-item.status-cancelled {
      opacity: 0.5;
      text-decoration: line-through;
    }

    .item-icon {
      flex-shrink: 0;
    }

    .item-desc {
      flex: 1;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    .item-amount {
      font-weight: 600;
      color: var(--ink);
    }

    .item-date {
      color: var(--muted);
      font-size: 11px;
    }
  `;
  document.head.appendChild(style);
}

// Sync data from cart modal
function syncCheckoutFromCart() {
  // Sync customer info
  const cNameVal = document.getElementById('cName')?.value || '';
  const cPhoneVal = document.getElementById('cPhone')?.value || '';
  
  document.getElementById('checkoutName').value = cNameVal;
  document.getElementById('checkoutPhone').value = cPhoneVal;
  
  // Sync discount
  const discPctVal = document.getElementById('discPct')?.value || '';
  const discValVal = document.getElementById('discVal')?.value || '';
  
  document.getElementById('checkoutDiscPct').value = discPctVal;
  document.getElementById('checkoutDiscVal').value = discValVal;
  
  // Sync paid now
  const paidNowVal = document.getElementById('paidNowAmount')?.value || '';
  document.getElementById('checkoutPaidNow').value = paidNowVal;
}

// Update Invoice Preview - Premium Design
function updateInvoicePreview() {
  const itemsEl = document.getElementById('invoiceItems');
  if (!itemsEl) return;

  // Generate unique invoice number
  const invoiceNum = document.getElementById('invoiceNumber');
  if (invoiceNum) {
    const timestamp = Date.now().toString().slice(-6);
    invoiceNum.textContent = `#INV-${timestamp}`;
  }

  // Update date/time
  const now = new Date();
  const dateStr = now.toLocaleDateString('ar-EG', { year: 'numeric', month: 'short', day: 'numeric' });
  const timeStr = now.toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' });

  const dateTimeEl = document.getElementById('invoiceDateTime');
  if (dateTimeEl) dateTimeEl.textContent = `${dateStr} - ${timeStr}`;

  const invoiceDateEl = document.getElementById('invoiceDate');
  if (invoiceDateEl) invoiceDateEl.textContent = dateStr;

  // Render invoice items with premium design
  itemsEl.innerHTML = cart.map(item => {
    const label = item.label || item.model || 'منتج';
    const price = item.price - (item.discount || 0);
    const qty = item.qty || 1;
    const isAccessory = item.type === 'accessory';

    // Build details string
    const details = [];
    if (item.storage) details.push(item.storage);
    if (item.color) details.push(item.color);
    if (item.condition && !isAccessory) {
      const condLabels = { 'new': 'جديد', 'like_new': 'ممتاز', 'used': 'مستعمل', 'faulty': 'معطل' };
      details.push(condLabels[item.condition] || '');
    }
    if (isAccessory && item.category) details.push(item.category);

    return `
      <div class="invoice-item">
        <div class="invoice-item-info">
          <span class="invoice-item-name">${isAccessory ? '🎧' : '📱'} ${label}</span>
          ${details.length > 0 ? `
            <div class="invoice-item-details">
              ${details.map(d => `<span class="invoice-item-detail-tag">${d}</span>`).join('')}
            </div>
          ` : ''}
        </div>
        <span class="invoice-item-qty">${qty}</span>
        <span class="invoice-item-price">${fmt(price)} ج.م</span>
      </div>
    `;
  }).join('');

  // Update customer info if selected
  const customerInfoEl = document.getElementById('invoiceCustomerInfo');
  const clientSelect = document.getElementById('checkoutClientSelect');
  const nameInput = document.getElementById('checkoutName');
  const phoneInput = document.getElementById('checkoutPhone');

  if (customerInfoEl) {
    const hasClientInfo = (clientSelect && clientSelect.value) || (nameInput && nameInput.value) || (phoneInput && phoneInput.value);

    if (hasClientInfo) {
      customerInfoEl.style.display = 'flex';
      const clientName = clientSelect?.options[clientSelect.selectedIndex]?.text || nameInput?.value || 'عميل نقدي';
      const clientPhone = phoneInput?.value || '-';

      document.getElementById('invoiceCustomerName').textContent = clientName;
      document.getElementById('invoiceCustomerPhone').textContent = clientPhone;
    } else {
      customerInfoEl.style.display = 'none';
    }
  }

  // Update item count
  const deviceCount = cart.filter(c => c.type !== 'accessory').length;
  const accessoryCount = cart.filter(c => c.type === 'accessory').reduce((sum, c) => sum + c.qty, 0);
  const totalItems = deviceCount + accessoryCount;

  const itemsCountEl = document.getElementById('checkoutItemsCount');
  if (itemsCountEl) itemsCountEl.textContent = `${totalItems} عنصر في السلة`;

  const deviceCountEl = document.getElementById('checkoutDeviceCount');
  if (deviceCountEl) deviceCountEl.textContent = deviceCount;

  const accCountEl = document.getElementById('checkoutAccessoryCount');
  if (accCountEl) accCountEl.textContent = accessoryCount;

  // Update payment method display
  updateInvoicePaymentMethod();
}

// Update Invoice Payment Method
function updateInvoicePaymentMethod() {
  const methodEl = document.getElementById('invoicePaymentMethod');
  if (!methodEl) return;

  const methods = {
    'cash': { icon: '💵', name: 'كاش سائل' },
    'mobile_wallet': { icon: '📱', name: 'محفظة إلكترونية' },
    'bank': { icon: '🏦', name: 'حساب بنكي' },
    'split': { icon: '➗', name: 'دفع مقسم' }
  };

  const method = methods[checkoutPaymentMethod] || methods.cash;
  methodEl.parentElement.innerHTML = `<span>${method.icon}</span><span>${method.name}</span>`;
}

// Update Checkout Totals
function updateCheckoutTotals() {
  const subtotal = sum(cart, 'price');
  const itemDiscounts = cart.reduce((total, item) => total + (item.discount || 0), 0);

  // Global discount
  let pct = Number(document.getElementById('checkoutDiscPct')?.value || 0);
  const val = Number(document.getElementById('checkoutDiscVal')?.value || 0);
  const afterItemDiscounts = subtotal - itemDiscounts;

  // Security: Enforce maximum discount percentage
  if (pct > MAX_DISCOUNT_PERCENT) {
    pct = MAX_DISCOUNT_PERCENT;
    document.getElementById('checkoutDiscPct').value = MAX_DISCOUNT_PERCENT;
    showToast(`الحد الأقصى للخصم هو ${MAX_DISCOUNT_PERCENT}%`, 'warning');
  }

  let globalDiscount = 0;
  if (pct > 0) globalDiscount = afterItemDiscounts * (pct / 100);
  if (val > 0) globalDiscount += val;

  const totalDiscount = itemDiscounts + globalDiscount;

  // Trade-in value (قيمة الاستبدال)
  const tradeinCheckbox = document.getElementById('tradeinToggleCheckbox');
  const tradeinValue = tradeinCheckbox?.checked ? Number(document.getElementById('tradeinDeviceValue')?.value || 0) : 0;

  // الإجمالي بعد الخصم والاستبدال
  const netAmount = subtotal - totalDiscount - tradeinValue;
  // لو العميل له فلوس (قيمة الاستبدال أعلى)، الإجمالي = 0
  const total = netAmount < 0 ? 0 : Math.max(MIN_SALE_PRICE, netAmount);

  // Calculate profit
  const profit = calculateProfit(cart) - globalDiscount;

  // Update unified footer summary
  const invoiceSubtotal = document.getElementById('invoiceSubtotal');
  if (invoiceSubtotal) invoiceSubtotal.textContent = fmt(subtotal) + ' ج.م';

  const discountRow = document.getElementById('invoiceDiscountRow');
  const invoiceDiscount = document.getElementById('invoiceDiscount');
  if (totalDiscount > 0) {
    if (discountRow) discountRow.style.display = 'flex';
    if (invoiceDiscount) invoiceDiscount.textContent = '-' + fmt(totalDiscount) + ' ج.م';
  } else {
    if (discountRow) discountRow.style.display = 'none';
  }

  // Trade-in row (صف الاستبدال)
  const tradeinRow = document.getElementById('invoiceTradeinRow');
  const invoiceTradeinValue = document.getElementById('invoiceTradeinValue');
  if (tradeinValue > 0) {
    if (tradeinRow) tradeinRow.style.display = 'flex';
    if (invoiceTradeinValue) invoiceTradeinValue.textContent = '-' + fmt(tradeinValue) + ' ج.م';
  } else {
    if (tradeinRow) tradeinRow.style.display = 'none';
  }

  // 🔄 حساب المبلغ المستحق للعميل (لو قيمة الاستبدال أعلى)
  // netAmount تم حسابه أعلاه
  const customerDueAmount = netAmount < 0 ? Math.abs(netAmount) : 0;

  // عرض/إخفاء صف المبلغ المستحق للعميل
  let customerDueRow = document.getElementById('customerDueRow');
  if (customerDueAmount > 0) {
    // إنشاء الصف لو مش موجود
    if (!customerDueRow) {
      const tradeinRowEl = document.getElementById('invoiceTradeinRow');
      if (tradeinRowEl) {
        customerDueRow = document.createElement('div');
        customerDueRow.id = 'customerDueRow';
        customerDueRow.className = 'summary-row';
        customerDueRow.style.cssText = 'display: flex; justify-content: space-between; align-items: center; padding: 8px 0; border-top: 1px solid rgba(245,158,11,0.3); margin-top: 8px;';
        customerDueRow.innerHTML = `
          <span style="font-weight: 600; color: #f59e0b;">💰 مستحق للعميل:</span>
          <span id="customerDueAmount" style="font-weight: 700; color: #f59e0b; font-size: 16px;"></span>
        `;
        tradeinRowEl.parentNode.insertBefore(customerDueRow, tradeinRowEl.nextSibling);
      }
    }
    if (customerDueRow) {
      customerDueRow.style.display = 'flex';
      const amountEl = document.getElementById('customerDueAmount');
      if (amountEl) amountEl.textContent = fmt(customerDueAmount) + ' ج.م';
    }

    // إظهار اختيار المحفظة للدفع
    showTradeinRefundWalletSelect();
  } else {
    if (customerDueRow) customerDueRow.style.display = 'none';
    hideTradeinRefundWalletSelect();
  }

  // Update grand total
  const checkoutGrandTotal = document.getElementById('checkoutGrandTotal');
  if (checkoutGrandTotal) checkoutGrandTotal.textContent = fmt(total) + ' ج.م';

  // Update header total
  const unifiedHeaderTotal = document.getElementById('unifiedHeaderTotal');
  if (unifiedHeaderTotal) unifiedHeaderTotal.textContent = fmt(total) + ' ج.م';

  // Show invoice profit for admin only (not cashier)
  const profitRow = document.getElementById('invoiceProfitRow');
  if (profitRow) {
    const user = window.currentUser || JSON.parse(localStorage.getItem('currentUser') || '{}');
    if (user.role === 'admin') {
      profitRow.style.display = 'flex';
      const invoiceProfitEl = document.getElementById('invoiceProfit');
      if (invoiceProfitEl) {
        invoiceProfitEl.textContent = fmt(profit) + ' ج.م';
        invoiceProfitEl.style.color = profit >= 0 ? '#10b981' : '#ef4444';
      }
    } else {
      profitRow.style.display = 'none';
    }
  }

  updateCheckoutRemaining();
  updateCashChange();
}

// ═══════════════════════════════════════════════════════════════
// 💰 CASH CHANGE CALCULATOR - حساب الباقي للعميل
// ═══════════════════════════════════════════════════════════════
function updateCashChange() {
  const subtotal = sum(cart, 'price');
  const itemDiscounts = cart.reduce((total, item) => total + (item.discount || 0), 0);
  const pct = Number(document.getElementById('checkoutDiscPct')?.value || 0);
  const val = Number(document.getElementById('checkoutDiscVal')?.value || 0);
  const afterItemDiscounts = subtotal - itemDiscounts;
  let globalDiscount = 0;
  if (pct > 0) globalDiscount = afterItemDiscounts * (pct / 100);
  if (val > 0) globalDiscount += val;

  // Trade-in value
  const tradeinCheckbox = document.getElementById('tradeinToggleCheckbox');
  const tradeinValue = tradeinCheckbox?.checked ? Number(document.getElementById('tradeinDeviceValue')?.value || 0) : 0;

  const total = Math.max(0, subtotal - itemDiscounts - globalDiscount - tradeinValue);

  const cashReceived = Number(document.getElementById('checkoutCashReceived')?.value || 0);
  const changeSection = document.getElementById('checkoutChangeSection');
  const changeValue = document.getElementById('checkoutChangeValue');

  if (cashReceived > 0 && cashReceived >= total) {
    const change = cashReceived - total;
    changeSection.style.display = 'block';
    changeValue.textContent = fmt(change) + ' ج.م';

    // Add animation
    changeValue.style.animation = 'none';
    changeValue.offsetHeight; // Trigger reflow
    changeValue.style.animation = 'pulse 0.5s ease';

    // Play sound for change
    if (change > 0) {
      SoundFX.play('success');
    }
  } else if (cashReceived > 0 && cashReceived < total) {
    // Not enough money
    changeSection.style.display = 'block';
    changeValue.textContent = '❌ ناقص ' + fmt(total - cashReceived) + ' ج.م';
    changeValue.style.color = 'var(--danger)';
  } else {
    changeSection.style.display = 'none';
    changeValue.style.color = 'var(--success)';
  }
}

// Toggle Deferred Payment Section
function toggleDeferredPayment() {
  const content = document.getElementById('deferredPaymentContent');
  const checkbox = document.getElementById('deferredToggleCheckbox');
  const paidNowInput = document.getElementById('checkoutPaidNow');

  // Toggle checkbox state
  if (checkbox) checkbox.checked = !checkbox.checked;
  const isActive = checkbox?.checked || false;

  // Show/hide content
  if (content) {
    content.style.display = isActive ? 'block' : 'none';
  }

  if (isActive) {
    setTimeout(() => paidNowInput?.focus(), 100);
  } else {
    if (paidNowInput) paidNowInput.value = '';
    updateCheckoutRemaining();
  }
}

// Update Remaining Amount
function updateCheckoutRemaining() {
  const subtotal = sum(cart, 'price');
  const itemDiscounts = cart.reduce((total, item) => total + (item.discount || 0), 0);
  const pct = Number(document.getElementById('checkoutDiscPct')?.value || 0);
  const val = Number(document.getElementById('checkoutDiscVal')?.value || 0);
  const afterItemDiscounts = subtotal - itemDiscounts;
  let globalDiscount = 0;
  if (pct > 0) globalDiscount = afterItemDiscounts * (pct / 100);
  if (val > 0) globalDiscount += val;
  const total = Math.max(0, subtotal - itemDiscounts - globalDiscount);

  const paidNow = Number(document.getElementById('checkoutPaidNow')?.value || 0);

  // ✅ FIX: إذا كانت طريقة الدفع "آجل"، المتبقي = total - paidNow (حتى لو paidNow = 0)
  const isDeferredMethod = checkoutPaymentMethod === 'deferred';
  const remaining = isDeferredMethod ? total - paidNow : (paidNow > 0 ? total - paidNow : 0);

  const remainingSection = document.getElementById('checkoutRemainingSection');
  const clientRequired = document.getElementById('checkoutClientRequired');
  const deferredDisplay = document.getElementById('deferredRemainingDisplay');

  // Update deferred display - للآجل نعرض المتبقي دائماً
  if (deferredDisplay) {
    const displayRemaining = isDeferredMethod ? Math.max(0, total - paidNow) : (remaining > 0 ? remaining : 0);
    deferredDisplay.textContent = fmt(displayRemaining) + ' ج.م';
    deferredDisplay.style.color = displayRemaining > 0 ? '#dc2626' : 'var(--success)';
    deferredDisplay.style.borderColor = displayRemaining > 0 ? 'rgba(220, 38, 38, 0.3)' : 'rgba(16, 185, 129, 0.3)';
    deferredDisplay.style.background = displayRemaining > 0 ? 'rgba(220, 38, 38, 0.1)' : 'rgba(16, 185, 129, 0.1)';
  }

  // ✅ v1.2.7: إظهار/إخفاء قسم طريقة الدفع للمبلغ المدفوع الآن
  const deferredPaymentMethodSection = document.getElementById('deferredPaymentMethodSection');
  if (deferredPaymentMethodSection && isDeferredMethod) {
    deferredPaymentMethodSection.style.display = paidNow > 0 ? 'block' : 'none';
  }

  // ✅ للبيع الآجل: يجب وجود عميل مسجل
  if (isDeferredMethod) {
    if (!selectedClientId) {
      if (clientRequired) clientRequired.style.display = 'block';
      const confirmBtn = document.getElementById('confirmCheckoutBtn');
      if (confirmBtn) confirmBtn.disabled = true;
    } else {
      if (clientRequired) clientRequired.style.display = 'none';
      const confirmBtn = document.getElementById('confirmCheckoutBtn');
      if (confirmBtn) confirmBtn.disabled = false;
    }
  } else if (remaining > 0) {
    if (remainingSection) remainingSection.style.display = 'block';
    const remainingValue = document.getElementById('checkoutRemainingValue');
    if (remainingValue) remainingValue.textContent = fmt(remaining) + ' ج.م';

    // Check if client is selected
    if (!selectedClientId) {
      if (clientRequired) clientRequired.style.display = 'block';
      const confirmBtn = document.getElementById('confirmCheckoutBtn');
      if (confirmBtn) confirmBtn.disabled = true;
    } else {
      if (clientRequired) clientRequired.style.display = 'none';
      const confirmBtn = document.getElementById('confirmCheckoutBtn');
      if (confirmBtn) confirmBtn.disabled = false;
    }
  } else {
    if (remainingSection) remainingSection.style.display = 'none';
    const confirmBtn = document.getElementById('confirmCheckoutBtn');
    if (confirmBtn) confirmBtn.disabled = false;
  }
}

// ═══════════════════════════════════════════════════════════════
// 🔄 TRADE-IN SYSTEM (نظام الاستبدال)
// ═══════════════════════════════════════════════════════════════

// Toggle Trade-in Section
function toggleTradeIn() {
  const content = document.getElementById('tradeinContent');
  const checkbox = document.getElementById('tradeinToggleCheckbox');

  // Toggle checkbox state
  if (checkbox) checkbox.checked = !checkbox.checked;
  const isActive = checkbox?.checked || false;

  // Show/hide content
  if (content) {
    content.style.display = isActive ? 'block' : 'none';
  }

  if (isActive) {
    setTimeout(() => document.getElementById('tradeinDeviceType')?.focus(), 100);
  } else {
    // Clear trade-in fields when disabled
    clearTradeInFields();
  }

  updateCheckoutTotals();
}

// Clear Trade-in Fields
function clearTradeInFields() {
  document.getElementById('tradeinDeviceType').value = '';
  document.getElementById('tradeinDeviceModel').value = '';
  document.getElementById('tradeinDeviceImei').value = '';
  document.getElementById('tradeinDeviceStorage').value = '';
  document.getElementById('tradeinDeviceRam').value = '';
  document.getElementById('tradeinDeviceColor').value = '';
  document.getElementById('tradeinDeviceCondition').value = 'used';
  document.getElementById('tradeinDeviceValue').value = '';
  document.getElementById('tradeinExpectedPrice').value = '';
  document.getElementById('tradeinNotes').value = '';

  // Reset RAM/Battery - RAM visible, Battery hidden by default
  const ramField = document.getElementById('tradeinRamField');
  const batteryField = document.getElementById('tradeinBatteryField');
  const batteryInput = document.getElementById('tradeinDeviceBattery');
  if (ramField) ramField.style.display = 'block';
  if (batteryField) batteryField.style.display = 'none';
  if (batteryInput) batteryInput.value = '';

  updateCheckoutTotals();
}

// Toggle RAM/Battery fields in Trade-in based on device type
function toggleTradeinRamBattery() {
  const typeValue = document.getElementById('tradeinDeviceType')?.value.trim() || '';
  const ramField = document.getElementById('tradeinRamField');
  const batteryField = document.getElementById('tradeinBatteryField');
  const ramInput = document.getElementById('tradeinDeviceRam');
  const batteryInput = document.getElementById('tradeinDeviceBattery');

  // Apple: Show battery, Hide RAM
  // Others: Show RAM, Hide battery
  if (typeValue === 'Apple') {
    if (batteryField) batteryField.style.display = 'block';
    if (ramField) ramField.style.display = 'none';
    if (ramInput) ramInput.value = '';
  } else {
    if (batteryField) batteryField.style.display = 'none';
    if (batteryInput) batteryInput.value = '';
    if (ramField) ramField.style.display = 'block';
  }
}

// Get Trade-in Data (if enabled)
function getTradeInData() {
  const checkbox = document.getElementById('tradeinToggleCheckbox');
  if (!checkbox?.checked) return null;

  const tradeinValue = Number(document.getElementById('tradeinDeviceValue')?.value || 0);
  if (tradeinValue <= 0) return null;

  return {
    type: document.getElementById('tradeinDeviceType')?.value.trim() || '',
    model: document.getElementById('tradeinDeviceModel')?.value.trim() || '',
    imei: document.getElementById('tradeinDeviceImei')?.value.trim() || '',
    storage: document.getElementById('tradeinDeviceStorage')?.value.trim() || '',
    ram: document.getElementById('tradeinDeviceRam')?.value.trim() || '',
    battery: document.getElementById('tradeinDeviceBattery')?.value || '',
    color: document.getElementById('tradeinDeviceColor')?.value.trim() || '',
    condition: document.getElementById('tradeinDeviceCondition')?.value || 'used',
    value: tradeinValue,
    expectedPrice: Number(document.getElementById('tradeinExpectedPrice')?.value || 0) || Math.round(tradeinValue * 1.2),
    notes: document.getElementById('tradeinNotes')?.value.trim() || ''
  };
}

// Validate Trade-in Data
function validateTradeIn() {
  const checkbox = document.getElementById('tradeinToggleCheckbox');
  if (!checkbox?.checked) return { valid: true };

  const type = document.getElementById('tradeinDeviceType')?.value.trim();
  const model = document.getElementById('tradeinDeviceModel')?.value.trim();
  const value = Number(document.getElementById('tradeinDeviceValue')?.value || 0);

  if (!type) {
    return { valid: false, message: 'يجب إدخال نوع جهاز الاستبدال' };
  }
  if (!model) {
    return { valid: false, message: 'يجب إدخال موديل جهاز الاستبدال' };
  }
  if (value <= 0) {
    return { valid: false, message: 'يجب إدخال قيمة جهاز الاستبدال' };
  }

  return { valid: true };
}

// 🔄 إظهار select لاختيار المحفظة (inline في الـ checkout)
async function showTradeinRefundWalletSelect() {
  let walletSelect = document.getElementById('tradeinRefundWalletContainer');
  if (!walletSelect) {
    // إنشاء الـ container
    const customerDueRow = document.getElementById('customerDueRow');
    if (customerDueRow) {
      walletSelect = document.createElement('div');
      walletSelect.id = 'tradeinRefundWalletContainer';
      walletSelect.style.cssText = 'display: flex; flex-direction: column; gap: 8px; background: rgba(245,158,11,0.1); border-radius: 8px; padding: 12px; margin-top: 8px;';
      walletSelect.innerHTML = `
        <label style="font-size: 13px; color: #f59e0b; display: flex; align-items: center; gap: 6px;">
          <span>🏦</span> الدفع من:
        </label>
        <select id="tradeinRefundWalletType" onchange="updateTradeinRefundWalletSelectInline()" style="padding: 8px 12px; border-radius: 8px; border: 1px solid rgba(245,158,11,0.3); background: rgba(30,41,59,0.9); color: var(--text-primary); font-size: 14px; width: 100%;">
          <option value="cash">💵 الكاش السائل</option>
          <option value="mobile_wallet">📱 المحفظة الإلكترونية</option>
          <option value="bank">🏦 الحساب البنكي</option>
        </select>
        <select id="tradeinRefundWallet" style="padding: 8px 12px; border-radius: 8px; border: 1px solid rgba(245,158,11,0.3); background: rgba(30,41,59,0.9); color: var(--text-primary); font-size: 14px; width: 100%; display: none;">
          <option value="">جاري التحميل...</option>
        </select>
      `;
      customerDueRow.parentNode.insertBefore(walletSelect, customerDueRow.nextSibling);
      
      // Load wallets and update select
      await loadPaymentWallets();
      await updateTradeinRefundWalletSelectInline();
    }
  }
  if (walletSelect) walletSelect.style.display = 'flex';
}

// Update trade-in refund wallet select inline
async function updateTradeinRefundWalletSelectInline() {
  const walletType = document.getElementById('tradeinRefundWalletType')?.value || 'cash';
  const walletSelect = document.getElementById('tradeinRefundWallet');
  
  if (!walletSelect) return;
  
  if (walletType === 'mobile_wallet' || walletType === 'bank') {
    walletSelect.style.display = 'block';
    await updateWalletSelect(walletType, 'tradeinRefundWallet');
  } else {
    walletSelect.style.display = 'none';
  }
}

// إخفاء select اختيار المحفظة
function hideTradeinRefundWalletSelect() {
  const walletSelect = document.getElementById('tradeinRefundWalletContainer');
  if (walletSelect) walletSelect.style.display = 'none';
}

// 🔄 إظهار modal لاختيار المحفظة لدفع الفرق للعميل في حالة الاستبدال
function showTradeInRefundWalletModal(amount) {
  // إزالة أي modal سابق
  const existingModal = document.getElementById('tradeinRefundModal');
  if (existingModal) existingModal.remove();

  const modal = document.createElement('div');
  modal.id = 'tradeinRefundModal';
  modal.className = 'modal-overlay show';
  modal.innerHTML = `
    <div class="modal" style="max-width: 450px; animation: slideIn 0.3s ease;">
      <div class="modal-header" style="background: linear-gradient(135deg, #f59e0b 0%, #d97706 100%);">
        <div style="display: flex; align-items: center; gap: 10px;">
          <span style="font-size: 24px;">💰</span>
          <div>
            <h3 style="margin: 0; font-size: 18px;">دفع فرق الاستبدال للعميل</h3>
            <p style="margin: 4px 0 0; font-size: 12px; opacity: 0.9;">قيمة جهاز الاستبدال أعلى من سعر البيع</p>
          </div>
        </div>
        <button onclick="closeTradeinRefundModal()" style="background: none; border: none; color: white; font-size: 20px; cursor: pointer;">✕</button>
      </div>
      <div class="modal-body" style="padding: 20px;">
        <div style="text-align: center; margin-bottom: 20px;">
          <div style="font-size: 14px; color: #64748b; margin-bottom: 5px;">المبلغ المستحق للعميل</div>
          <div style="font-size: 32px; font-weight: 700; color: #f59e0b;">${fmt(amount)} ج.م</div>
        </div>

        <div style="background: rgba(245, 158, 11, 0.1); border: 1px solid rgba(245, 158, 11, 0.3); border-radius: 10px; padding: 12px; margin-bottom: 20px;">
          <div style="display: flex; align-items: center; gap: 8px;">
            <span style="font-size: 18px;">ℹ️</span>
            <span style="font-size: 13px; color: #92400e;">سيتم خصم هذا المبلغ من المحفظة المختارة ودفعه للعميل</span>
          </div>
        </div>

        <label style="font-size: 13px; color: #64748b; margin-bottom: 8px; display: block;">اختر نوع المحفظة:</label>
        <select id="tradeinRefundWalletType" onchange="updateTradeinRefundWalletSelect()" style="width: 100%; padding: 12px; border-radius: 10px; border: 1px solid rgba(148,163,184,0.3); background: rgba(30,41,59,0.8); color: var(--text-primary); font-size: 15px; margin-bottom: 12px;">
          <option value="cash">💵 الكاش السائل</option>
          <option value="mobile_wallet">📱 المحفظة الإلكترونية</option>
          <option value="bank">🏦 الحساب البنكي</option>
        </select>
        
        <label style="font-size: 13px; color: #64748b; margin-bottom: 8px; display: block;">اختر المحفظة المحددة:</label>
        <select id="tradeinRefundWallet" style="width: 100%; padding: 12px; border-radius: 10px; border: 1px solid rgba(148,163,184,0.3); background: rgba(30,41,59,0.8); color: var(--text-primary); font-size: 15px;">
          <option value="">جاري التحميل...</option>
        </select>
      </div>
      <div class="modal-footer" style="display: flex; gap: 10px; padding: 15px 20px; border-top: 1px solid rgba(148,163,184,0.1);">
        <button onclick="closeTradeinRefundModal()" class="btn btn-secondary" style="flex: 1;">
          إلغاء
        </button>
        <button onclick="confirmTradeinRefund()" class="btn btn-primary" style="flex: 2; background: linear-gradient(135deg, #f59e0b 0%, #d97706 100%);">
          ✅ تأكيد ومتابعة البيع
        </button>
      </div>
    </div>
  `;

  document.body.appendChild(modal);
  
  // Load wallets and populate dropdown
  loadPaymentWallets().then(() => {
    updateTradeinRefundWalletSelect();
  });
}

// Update trade-in refund wallet select
async function updateTradeinRefundWalletSelect() {
  const walletType = document.getElementById('tradeinRefundWalletType')?.value || 'cash';
  const walletSelect = document.getElementById('tradeinRefundWallet');
  
  if (!walletSelect) return;
  
  await updateWalletSelect(walletType, 'tradeinRefundWallet');
}

// إغلاق modal اختيار المحفظة للاستبدال
function closeTradeinRefundModal() {
  const modal = document.getElementById('tradeinRefundModal');
  if (modal) modal.remove();
}

// تأكيد اختيار المحفظة ومتابعة البيع
async function confirmTradeinRefund() {
  const walletTypeSelect = document.getElementById('tradeinRefundWalletType');
  const walletSelect = document.getElementById('tradeinRefundWallet');
  
  const walletType = walletTypeSelect?.value || 'cash';
  const walletId = walletSelect?.value ? parseInt(walletSelect.value) : null;
  
  if (!walletTypeSelect?.value) {
    showToast('يجب اختيار نوع المحفظة', 'warning');
    return;
  }
  
  if ((walletType === 'mobile_wallet' || walletType === 'bank') && !walletId) {
    showToast('يجب اختيار المحفظة المحددة', 'warning');
    return;
  }

  // إغلاق الـ modal
  closeTradeinRefundModal();

  // متابعة عملية البيع
  checkout();
}

// Select Payment Method
async function selectPaymentMethod(method) {
  checkoutPaymentMethod = method;

  // Update UI - both old and new button styles
  document.querySelectorAll('.payment-method-option, .payment-method-btn').forEach(opt => {
    opt.classList.toggle('active', opt.dataset.method === method);
  });

  const splitSection = document.getElementById('splitPaymentSection');
  const walletSelectGroup = document.getElementById('walletSelectGroup');
  const deferredSection = document.getElementById('deferredPaymentSection');
  const cashReceivedSection = document.getElementById('checkoutCashReceived');
  const changeSection = document.getElementById('checkoutChangeSection');

  if (method === 'split') {
    // Show split section
    splitSection.style.display = 'block';
    walletSelectGroup.style.display = 'none';
    deferredSection.style.display = 'none';
    if (cashReceivedSection) cashReceivedSection.style.display = 'block';

    // Update wallet selects for split payment
    await updateWalletSelect('cash', 'splitCashWalletSelect');
    await updateWalletSelect('mobile_wallet', 'splitCardWalletSelect');
    await updateWalletSelect('bank', 'splitTransferWalletSelect');

    updateSplitTotal();

    // ✅ v1.2.7: إعادة تفعيل زر التأكيد وإخفاء رسالة العميل المطلوب
    const confirmBtn = document.getElementById('confirmCheckoutBtn');
    if (confirmBtn) confirmBtn.disabled = false;
    const clientRequiredEl = document.getElementById('checkoutClientRequired');
    if (clientRequiredEl) clientRequiredEl.style.display = 'none';
  } else if (method === 'deferred') {
    // ✅ Show deferred payment section
    splitSection.style.display = 'none';
    walletSelectGroup.style.display = 'none';
    deferredSection.style.display = 'block';
    // إخفاء قسم المبلغ المستلم للكاش لأنه غير مطلوب للآجل
    if (cashReceivedSection) cashReceivedSection.style.display = 'none';
    if (changeSection) changeSection.style.display = 'none';

    // تحديث المتبقي
    updateCheckoutRemaining();

    // التحقق من وجود عميل
    const clientRequiredEl = document.getElementById('checkoutClientRequired');
    if (clientRequiredEl) {
      clientRequiredEl.style.display = selectedClientId ? 'none' : 'block';
    }
  } else {
    // Hide split section and deferred section
    splitSection.style.display = 'none';
    deferredSection.style.display = 'none';
    if (cashReceivedSection) cashReceivedSection.style.display = 'block';

    // Show wallet select for single payment method
    walletSelectGroup.style.display = 'block';
    await updateWalletSelect(method, 'checkoutWalletSelect');

    // ✅ v1.2.7: إعادة تفعيل زر التأكيد وإخفاء رسالة العميل المطلوب
    const confirmBtn = document.getElementById('confirmCheckoutBtn');
    if (confirmBtn) confirmBtn.disabled = false;
    const clientRequiredEl = document.getElementById('checkoutClientRequired');
    if (clientRequiredEl) clientRequiredEl.style.display = 'none';
  }
}

// Update Split Total
function updateSplitTotal() {
  const cash = Number(document.getElementById('splitCash')?.value || 0);
  const card = Number(document.getElementById('splitCard')?.value || 0);
  const transfer = Number(document.getElementById('splitTransfer')?.value || 0);
  const splitTotal = cash + card + transfer;
  
  const subtotal = sum(cart, 'price');
  const itemDiscounts = cart.reduce((total, item) => total + (item.discount || 0), 0);
  const pct = Number(document.getElementById('checkoutDiscPct')?.value || 0);
  const val = Number(document.getElementById('checkoutDiscVal')?.value || 0);
  let globalDiscount = 0;
  if (pct > 0) globalDiscount = (subtotal - itemDiscounts) * (pct / 100);
  if (val > 0) globalDiscount += val;
  const total = Math.max(0, subtotal - itemDiscounts - globalDiscount);
  
  const statusEl = document.getElementById('splitTotalStatus');
  const diff = total - splitTotal;
  
  if (diff === 0) {
    statusEl.style.background = 'rgba(16, 185, 129, 0.2)';
    statusEl.style.color = 'var(--success)';
    statusEl.textContent = '✅ المبلغ مطابق';
  } else if (diff > 0) {
    statusEl.style.background = 'rgba(245, 158, 11, 0.2)';
    statusEl.style.color = 'var(--warning)';
    statusEl.textContent = `⚠️ متبقي ${fmt(diff)} ج.م`;
  } else {
    statusEl.style.background = 'rgba(239, 68, 68, 0.2)';
    statusEl.style.color = 'var(--danger)';
    statusEl.textContent = `❌ زيادة ${fmt(Math.abs(diff))} ج.م`;
  }
}

// Print Invoice from Checkout Modal
function printCheckoutInvoice() {
  // استخدام دالة الطباعة الحرارية مع المعاينة
  printReceipt();
}

// ═══════════════════════════════════════════════════════════════
// 🔒 HIGH VALUE SALE WARNING - تحذير للعمليات الكبيرة
// ═══════════════════════════════════════════════════════════════
const HIGH_VALUE_THRESHOLDS = {
  TOTAL_AMOUNT: 15000,      // تنبيه إذا كان الإجمالي أكثر من 15000 ج.م
  DISCOUNT_PERCENT: 30,     // تنبيه إذا كان الخصم أكثر من 30%
  DEFERRED_AMOUNT: 10000    // تنبيه إذا كان المبلغ الآجل أكثر من 10000 ج.م
};

function getHighValueWarnings(saleDetails) {
  const warnings = [];

  // تحذير المبلغ الكبير
  if (saleDetails.total >= HIGH_VALUE_THRESHOLDS.TOTAL_AMOUNT) {
    warnings.push({
      icon: '💰',
      text: `مبلغ كبير: ${fmt(saleDetails.total)} ج.م`,
      type: 'high-value'
    });
  }

  // تحذير الخصم الكبير
  if (saleDetails.discount > 0 && saleDetails.total > 0) {
    const originalTotal = saleDetails.total + saleDetails.discount;
    const discountPercent = (saleDetails.discount / originalTotal) * 100;
    if (discountPercent >= HIGH_VALUE_THRESHOLDS.DISCOUNT_PERCENT) {
      warnings.push({
        icon: '📉',
        text: `خصم كبير: ${Math.round(discountPercent)}% (${fmt(saleDetails.discount)} ج.م)`,
        type: 'high-discount'
      });
    }
  }

  // تحذير المبلغ الآجل الكبير
  if (saleDetails.remaining >= HIGH_VALUE_THRESHOLDS.DEFERRED_AMOUNT) {
    warnings.push({
      icon: '⏳',
      text: `مبلغ آجل كبير: ${fmt(saleDetails.remaining)} ج.م`,
      type: 'high-deferred'
    });
  }

  return warnings;
}

// Show Sale Confirmation Dialog
function showSaleConfirmation(saleDetails) {
  return new Promise((resolve) => {
    // التحقق من التحذيرات
    const warnings = getHighValueWarnings(saleDetails);
    const hasWarnings = warnings.length > 0;

    // Create overlay
    const overlay = document.createElement('div');
    overlay.className = 'sale-confirm-overlay';
    overlay.innerHTML = `
      <div class="sale-confirm-dialog ${hasWarnings ? 'has-warnings' : ''}">
        <div class="sale-confirm-header ${hasWarnings ? 'warning-header' : ''}">
          <span class="confirm-icon">${hasWarnings ? '🚨' : '⚠️'}</span>
          <h3>${hasWarnings ? 'تأكيد عملية بيع مهمة' : 'تأكيد عملية البيع'}</h3>
        </div>
        ${hasWarnings ? `
        <div class="sale-warnings">
          ${warnings.map(w => `
            <div class="warning-item ${w.type}">
              <span class="warning-icon">${w.icon}</span>
              <span class="warning-text">${w.text}</span>
            </div>
          `).join('')}
        </div>
        ` : ''}
        <div class="sale-confirm-body">
          <div class="confirm-row">
            <span class="confirm-label">عدد الأصناف:</span>
            <span class="confirm-value">${saleDetails.itemCount} صنف</span>
          </div>
          <div class="confirm-row total-row">
            <span class="confirm-label">الإجمالي:</span>
            <span class="confirm-value">${fmt(saleDetails.total)} ج.م</span>
          </div>
          ${saleDetails.discount > 0 ? `
          <div class="confirm-row discount-row">
            <span class="confirm-label">الخصم:</span>
            <span class="confirm-value">-${fmt(saleDetails.discount)} ج.م</span>
          </div>` : ''}
          ${saleDetails.clientName ? `
          <div class="confirm-row">
            <span class="confirm-label">العميل:</span>
            <span class="confirm-value">${escapeHtml(saleDetails.clientName)}</span>
          </div>` : ''}
          ${saleDetails.remaining > 0 ? `
          <div class="confirm-row deferred-row">
            <span class="confirm-label">المتبقي (آجل):</span>
            <span class="confirm-value">${fmt(saleDetails.remaining)} ج.م</span>
          </div>` : ''}
          <div class="confirm-row">
            <span class="confirm-label">طريقة الدفع:</span>
            <span class="confirm-value">${saleDetails.paymentMethodText}</span>
          </div>
          ${saleDetails.saveNewClient ? `
          <div class="confirm-row new-client-row">
            <span class="confirm-label">👤 عميل جديد:</span>
            <span class="confirm-value new-client-badge">سيتم حفظه في قائمة العملاء</span>
          </div>` : ''}
        </div>
        <div class="sale-confirm-footer">
          <button class="confirm-btn confirm-cancel" id="saleConfirmCancel">
            <span>❌</span> إلغاء
          </button>
          <button class="confirm-btn confirm-proceed" id="saleConfirmProceed">
            <span>✅</span> تأكيد البيع
          </button>
        </div>
      </div>
    `;

    document.body.appendChild(overlay);

    // Animation
    requestAnimationFrame(() => overlay.classList.add('show'));

    // Handle buttons
    document.getElementById('saleConfirmCancel').onclick = () => {
      overlay.classList.remove('show');
      setTimeout(() => overlay.remove(), 200);
      resolve(false);
    };

    document.getElementById('saleConfirmProceed').onclick = () => {
      overlay.classList.remove('show');
      setTimeout(() => overlay.remove(), 200);
      resolve(true);
    };

    // Close on Escape
    const escHandler = (e) => {
      if (e.key === 'Escape') {
        document.removeEventListener('keydown', escHandler);
        overlay.classList.remove('show');
        setTimeout(() => overlay.remove(), 200);
        resolve(false);
      }
    };
    document.addEventListener('keydown', escHandler);
  });
}

// Get payment method text
function getPaymentMethodText(method) {
  const methods = {
    'cash': 'كاش سائل',
    'mobile_wallet': 'محفظة إلكترونية',
    'bank': 'حساب بنكي',
    'split': 'تقسيم',
    'deferred': 'آجل'
  };
  return methods[method] || 'كاش سائل';
}

// Confirm Checkout
async function confirmCheckout() {
  if (cart.length === 0) {
    showToast('السلة فارغة', 'warning');
    return;
  }

  // Get values from unified checkout modal
  const customerName = document.getElementById('checkoutName')?.value.trim() || '';
  const customerPhone = document.getElementById('checkoutPhone')?.value.trim() || '';
  const paidNow = Number(document.getElementById('checkoutPaidNow')?.value || 0);

  const subtotal = sum(cart, 'price');
  const itemDiscounts = cart.reduce((total, item) => total + (item.discount || 0), 0);
  const pct = Number(document.getElementById('checkoutDiscPct')?.value || 0);
  const val = Number(document.getElementById('checkoutDiscVal')?.value || 0);
  let globalDiscount = 0;
  if (pct > 0) globalDiscount = (subtotal - itemDiscounts) * (pct / 100);
  if (val > 0) globalDiscount += val;
  const total = Math.max(0, subtotal - itemDiscounts - globalDiscount);

  // Calculate actual paid
  let actualPaid = total;

  if (checkoutPaymentMethod === 'split') {
    const cash = Number(document.getElementById('splitCash')?.value || 0);
    const card = Number(document.getElementById('splitCard')?.value || 0);
    const transfer = Number(document.getElementById('splitTransfer')?.value || 0);
    actualPaid = cash + card + transfer;
  } else if (checkoutPaymentMethod === 'deferred') {
    // ✅ للبيع الآجل: المدفوع = paidNow (يمكن أن يكون 0 للآجل الكامل)
    actualPaid = paidNow;
  } else if (paidNow > 0) {
    actualPaid = paidNow;
  }

  const remaining = total - actualPaid;

  // Validate deferred payment - must have client
  // ✅ تحقق من اختيار طريقة آجل أو وجود متبقي
  const isDeferredSale = checkoutPaymentMethod === 'deferred' || remaining > 0;
  if (isDeferredSale && !selectedClientId) {
    showToast('يجب اختيار عميل مسجل للبيع بالآجل', 'error');
    const clientRequiredEl = document.getElementById('checkoutClientRequired');
    if (clientRequiredEl) clientRequiredEl.style.display = 'block';
    return;
  }

  // Validate split payment total
  if (checkoutPaymentMethod === 'split' && actualPaid < total) {
    showToast('مجموع المبالغ أقل من الإجمالي', 'error');
    return;
  }

  // Check if saving new client
  const saveNewClientCheckbox = document.getElementById('saveNewClientCheckbox');
  const willSaveNewClient = saveNewClientCheckbox?.checked && !selectedClientId && (customerName || customerPhone);

  // Show confirmation dialog
  const totalDiscount = itemDiscounts + globalDiscount;
  const saleDetails = {
    itemCount: cart.length,
    total: total,
    discount: totalDiscount,
    clientName: customerName || (selectedClientId ? clientsList.find(c => c.id === selectedClientId)?.name : ''),
    remaining: remaining,
    paymentMethodText: getPaymentMethodText(checkoutPaymentMethod),
    saveNewClient: willSaveNewClient
  };

  const confirmed = await showSaleConfirmation(saleDetails);
  if (!confirmed) {
    return;
  }

  // Disable confirm button to prevent double-click
  const confirmBtn = document.getElementById('confirmCheckoutBtn');
  UILoader.buttonLoading(confirmBtn, true);

  try {
    // Call actual checkout function (gets values directly from unified modal)
    // Note: checkout() handles closing the modal on success
    await checkout();

  } catch (error) {
    Logger.error('Checkout error:', error);
    showToast('حدث خطأ أثناء إتمام البيع', 'error');
  } finally {
    UILoader.buttonLoading(confirmBtn, false);
  }
}

// Override btnCheckout to open enhanced modal
const originalBtnCheckoutHandler = btnCheckout?.onclick;
if (btnCheckout) {
  btnCheckout.onclick = function(e) {
    e.preventDefault();
    openCheckoutModal();
  };
}

// Close modals on ESC
// ✅ FIX: Escape بيقفل المودال الأعلى بس - مش كلهم مرة واحدة
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') {
    const allModals = document.querySelectorAll(
      '.cash-tx-modal.show, .drawer-modal-overlay.show, .unified-checkout-modal.show, .checkout-modal.show, ' +
      '.modal[style*="display: flex"], .modal-overlay[style*="display: flex"]'
    );
    if (allModals.length === 0) return;

    // إيجاد المودال الأعلى (z-index) وقفله بس
    let topModal = null;
    let topZ = -1;
    allModals.forEach(modal => {
      const z = parseInt(window.getComputedStyle(modal).zIndex) || 0;
      if (z >= topZ) { topZ = z; topModal = modal; }
    });

    if (topModal) {
      topModal.classList.remove('show');
      topModal.style.display = 'none';
      topModal.style.opacity = '';
      topModal.style.visibility = '';
    }
  }
});

// Close modals on backdrop click
document.getElementById('cashDepositModal')?.addEventListener('click', function(e) {
  if (e.target === this) closeCashDepositModal();
});

document.getElementById('cashWithdrawModal')?.addEventListener('click', function(e) {
  if (e.target === this) closeCashWithdrawModal();
});

document.getElementById('checkoutModal')?.addEventListener('click', function(e) {
  if (e.target === this) closeCheckoutModal();
});

// Initialize close button
document.getElementById('closeCheckoutModal')?.addEventListener('click', closeCheckoutModal);

// ═══════════════════════════════════════════════════════════════
// 💸 PAY SUPPLIER SYSTEM - دفع لمورد من درج الكاش
// ═══════════════════════════════════════════════════════════════

let suppliersListForPOS = [];

// Open Pay Supplier Modal
async function openPaySupplierModal() {
  // إغلاق أي مودالات مفتوحة أولاً
  ModalSystem.closeAll('paySupplierModal');

  // Load suppliers (with caching)
  try {
    suppliersListForPOS = await API.suppliers.getAll();
  } catch (e) {
    Logger.error('Failed to load suppliers:', e);
    suppliersListForPOS = [];
  }

  // Populate dropdown
  const select = document.getElementById('paySupplierSelect');
  select.innerHTML = '<option value="">-- اختر المورد --</option>';
  suppliersListForPOS.forEach(s => {
    const balance = Number(s.balance || 0);
    const balanceText = balance > 0 ? ` (مدين: ${fmt(balance)})` : '';
    const option = document.createElement('option');
    option.value = s.id;
    option.textContent = `${s.name}${balanceText}`;
    select.appendChild(option);
  });

  // Reset form
  document.getElementById('supplierBalanceGroup').style.display = 'none';
  document.getElementById('paySupplierAmount').value = '';
  document.getElementById('paySupplierMethod').value = 'cash';
  document.getElementById('paySupplierNotes').value = '';
  
  // Load payment wallets and update wallet select
  await loadPaymentWallets();
  await updatePaySupplierWalletSelect();

  // Show modal
  document.getElementById('paySupplierModal').classList.add('show');
}

// Update wallet select for pay supplier
async function updatePaySupplierWalletSelect() {
  const method = document.getElementById('paySupplierMethod')?.value || 'cash';
  const walletGroup = document.getElementById('paySupplierWalletGroup');
  const walletSelect = document.getElementById('paySupplierWalletSelect');
  
  if (!walletGroup || !walletSelect) return;
  
  // Map method to wallet type
  let walletType = 'cash';
  if (method === 'vodafone_cash') {
    walletType = 'mobile_wallet';
  } else if (method === 'bank_transfer') {
    walletType = 'bank';
  }
  
  // Show wallet select for mobile_wallet and bank, hide for cash
  if (walletType === 'mobile_wallet' || walletType === 'bank') {
    walletGroup.style.display = 'block';
    await updateWalletSelect(walletType, 'paySupplierWalletSelect');
  } else {
    walletGroup.style.display = 'none';
  }
}

// Close Pay Supplier Modal
function closePaySupplierModal() {
  document.getElementById('paySupplierModal').classList.remove('show');
}

// On Supplier Select Change
function onSupplierSelectChange() {
  const supplierId = document.getElementById('paySupplierSelect').value;
  const balanceGroup = document.getElementById('supplierBalanceGroup');
  const balanceDisplay = document.getElementById('supplierBalanceDisplay');

  if (supplierId) {
    const supplier = suppliersListForPOS.find(s => s.id == supplierId);
    if (supplier) {
      const balance = Number(supplier.balance || 0);
      balanceDisplay.textContent = fmt(balance) + ' ج.م';
      balanceGroup.style.display = 'block';
    }
  } else {
    balanceGroup.style.display = 'none';
  }
}

// Confirm Pay Supplier
// بيانات الدفع للمورد المعلقة (عند الحاجة للسحب من الخزنة)
let pendingSupplierPayment = null;

async function confirmPaySupplier() {
  const supplierId = document.getElementById('paySupplierSelect').value;
  const amount = Number(document.getElementById('paySupplierAmount').value || 0);
  const method = document.getElementById('paySupplierMethod').value;
  const notes = document.getElementById('paySupplierNotes').value.trim();

  if (!supplierId) {
    showToast('الرجاء اختيار المورد', 'error');
    return;
  }

  if (amount <= 0) {
    showToast('الرجاء إدخال مبلغ صحيح', 'error');
    document.getElementById('paySupplierAmount').focus();
    return;
  }

  const supplier = suppliersListForPOS.find(s => s.id == supplierId);

  // ✅ التحقق من رصيد الدرج (للدفع النقدي فقط)
  if (method === 'cash') {
    // ⚠️ لازم نبعت after (آخر تقفيل) عشان نجيب رصيد الدرج فقط مش الخزنة كلها
    let currentDrawerBalance = 0;
    try {
      const currentUser = window.currentUser || JSON.parse(localStorage.getItem('currentUser') || '{}');
      const userId = currentUser?.id;
      const closingTimeKey = getLastClosingTimeKey();
      const lastClosingTime = SessionCache.get(closingTimeKey, false) || null;

      let walletUrl = `elos-db://drawer-wallets-balance`;
      const params = [];
      if (lastClosingTime) params.push(`after=${encodeURIComponent(lastClosingTime)}`);
      if (userId) params.push(`user_id=${userId}`);
      if (params.length > 0) walletUrl += '?' + params.join('&');

      const res = await fetch(walletUrl);
      if (res.ok) {
        const data = await res.json();
        currentDrawerBalance = Number(data.cash || 0);
        console.log('[SUPPLIER-PAY] ✅ Drawer cash balance:', currentDrawerBalance);
      }
    } catch (e) {
      Logger.error('Error getting cash balance:', e);
      // Fallback: نستخدم currentCashData
      if (currentCashData && currentCashData.cashTotal) {
        currentDrawerBalance = currentCashData.cashTotal;
      } else {
        currentDrawerBalance = await getCurrentDrawerBalance();
      }
    }

    if (amount > currentDrawerBalance) {
      // حفظ بيانات الدفع المعلقة
      pendingSupplierPayment = {
        supplierId,
        amount,
        method,
        notes,
        supplierName: supplier?.name || 'مورد'
      };

      // فتح مودال السحب من الخزنة
      openSupplierPaymentWithdrawalModal(amount, currentDrawerBalance);
      return;
    }
  }

  // تنفيذ الدفع
  await executeSupplierPayment(supplierId, amount, method, notes, supplier?.name);
}

// جلب رصيد الدرج الحالي
async function getCurrentDrawerBalance() {
  try {
    const res = await fetch('elos-db://cash-balance');
    if (res.ok) {
      const data = await res.json();
      return Number(data.balance) || 0;
    }
  } catch (e) {
    Logger.error('Failed to get drawer balance:', e);
  }
  return 0;
}

// فتح مودال السحب من الخزنة لدفع المورد
async function openSupplierPaymentWithdrawalModal(requiredAmount, currentBalance) {
  const shortage = requiredAmount - currentBalance;

  // تحديث القيم في المودال
  document.getElementById('withdrawalRequiredAmount').textContent = fmt(requiredAmount) + ' ج.م';
  document.getElementById('withdrawalDrawerBalance').textContent = fmt(currentBalance) + ' ج.م';
  document.getElementById('withdrawalShortage').textContent = fmt(shortage) + ' ج.م';

  // تحديث العنوان (دفع المورد دايماً كاش)
  const drawerBalanceLabel = document.querySelector('#drawerWithdrawalModal .withdrawal-info-item:nth-child(2) .withdrawal-info-label');
  if (drawerBalanceLabel) {
    drawerBalanceLabel.textContent = 'رصيد الكاش السائل:';
  }

  // المبلغ المقترح للسحب
  const suggestedAmount = Math.ceil(shortage / 100) * 100;
  document.getElementById('withdrawalAmount').value = suggestedAmount;

  // تحميل رصيد الخزنة
  await loadMainSafeBalance();

  // التحقق إذا المستخدم مدير أو كاشير
  const isAdmin = await checkIfAdmin();
  const adminAuthSection = document.getElementById('withdrawalAdminAuth');
  if (isAdmin) {
    adminAuthSection.style.display = 'none';
  } else {
    adminAuthSection.style.display = 'block';
    document.getElementById('withdrawalAdminPassword').value = '';
  }

  // حفظ المتغيرات للاستخدام في تأكيد السحب
  withdrawalRequiredAmount = requiredAmount;
  withdrawalCurrentDrawer = currentBalance;
  withdrawalTargetWallet = 'cash';

  // تغيير معالج التأكيد ليستخدم دفع المورد
  const confirmBtn = document.querySelector('#drawerWithdrawalModal .btn-primary');
  confirmBtn.onclick = confirmSupplierPaymentWithdrawal;

  // إظهار المودال
  document.getElementById('drawerWithdrawalModal').style.display = 'flex';
}

// تأكيد السحب من الخزنة ثم الدفع للمورد
async function confirmSupplierPaymentWithdrawal() {
  const amount = Number(document.getElementById('withdrawalAmount').value || 0);
  const adminPassword = document.getElementById('withdrawalAdminPassword').value;
  const adminAuthSection = document.getElementById('withdrawalAdminAuth');

  // التحقق من المبلغ
  if (amount <= 0) {
    showToast('الرجاء إدخال مبلغ صحيح', 'error');
    document.getElementById('withdrawalAmount').focus();
    return;
  }

  const shortage = withdrawalRequiredAmount - withdrawalCurrentDrawer;
  if (amount < shortage) {
    showToast(`المبلغ أقل من النقص المطلوب (${fmt(shortage)} ج.م)`, 'error');
    return;
  }

  // التحقق من باسورد المدير إذا لزم
  const needsAdminAuth = adminAuthSection.style.display !== 'none';
  if (needsAdminAuth && !adminPassword) {
    showToast('الرجاء إدخال باسورد المدير', 'error');
    document.getElementById('withdrawalAdminPassword').focus();
    return;
  }

  try {
    // سحب من الخزنة لدرج الكاش
    const res = await fetch('elos-db://safe-to-drawer-transfer', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        amount: amount,
        wallet_type: 'cash',
        admin_password: needsAdminAuth ? adminPassword : null,
        reason: `سحب لدفع مورد: ${pendingSupplierPayment?.supplierName}`
      })
    });

    if (!res.ok) {
      const errorText = await res.text();
      throw new Error(errorText);
    }

    // إغلاق مودال السحب
    closeDrawerWithdrawalModal();

    // إعادة معالج التأكيد للشراء الأصلي
    const confirmBtn = document.querySelector('#drawerWithdrawalModal .btn-primary');
    confirmBtn.onclick = confirmDrawerWithdrawal;

    showToast(`✅ تم إضافة ${fmt(amount)} ج.م للدرج`, 'success', 2000);

    // تنفيذ الدفع للمورد بعد تأخير قصير
    if (pendingSupplierPayment) {
      setTimeout(async () => {
        await executeSupplierPayment(
          pendingSupplierPayment.supplierId,
          pendingSupplierPayment.amount,
          pendingSupplierPayment.method,
          pendingSupplierPayment.notes,
          pendingSupplierPayment.supplierName
        );
        pendingSupplierPayment = null;
      }, 500);
    }

  } catch (error) {
    Logger.error('Supplier payment withdrawal error:', error);
    showToast('فشل السحب: ' + translateError(error.message), 'error');
  }
}

// تنفيذ الدفع للمورد
async function executeSupplierPayment(supplierId, amount, method, notes, supplierName) {
  // Show button loading
  const btn = document.querySelector('#paySupplierModal .btn-primary');
  if (btn) UILoader.buttonLoading(btn, true);

  try {
    // Map method to wallet type
    let walletType = 'cash';
    if (method === 'vodafone_cash') {
      walletType = 'mobile_wallet';
    } else if (method === 'bank_transfer') {
      walletType = 'bank';
    }
    
    // Get wallet_id if method is mobile_wallet or bank
    const walletSelect = document.getElementById('paySupplierWalletSelect');
    const walletId = (walletType === 'mobile_wallet' || walletType === 'bank') && walletSelect?.value 
      ? parseInt(walletSelect.value) : null;
    
    // Send to backend (using unified API)
    await API.suppliers.payment({
      supplier_id: supplierId,
      amount: amount,
      payment_method: method,
      wallet_type: walletType, // للتوافق العكسي
      wallet_id: walletId, // المحفظة المحددة
      notes: notes || `دفعة من نقطة البيع`,
      from_pos: true // علامة أن الدفع من نقطة البيع
    });

    // Clear suppliers cache to get fresh data
    API.clearCache('suppliers');

    // تسجيل في shiftTransactions للدفع النقدي
    if (method === 'cash') {
      const transactions = getShiftTransactions();
      transactions.push({
        id: Date.now(),
        type: 'supplier_payment',
        amount: amount,
        category: 'دفع لمورد',
        description: `دفعة للمورد: ${supplierName || 'مورد'}`,
        supplier_id: supplierId,
        created_at: new Date().toISOString()
      });
      saveShiftTransactions(transactions);
    }

    // Close modal
    closePaySupplierModal();

    // Refresh cash drawer
    await loadCashDrawerData();

    // Show success
    SoundFX.play('success');
    showToast(`✅ تم دفع ${fmt(amount)} ج.م للمورد: ${supplierName}`, 'success', 4000);

  } catch (error) {
    Logger.error('Pay supplier error:', error);
    showToast('فشل في الدفع: ' + translateError(error.message), 'error');
  } finally {
    if (btn) UILoader.buttonLoading(btn, false);
  }
}

// ═══════════════════════════════════════════════════════════════
// 💰 RECEIVE CLIENT PAYMENT - استلام دفعة من عميل
// ═══════════════════════════════════════════════════════════════

let clientsListForPOS = [];

// Open Receive Client Modal
async function openReceiveClientModal() {
  // إغلاق أي مودالات مفتوحة أولاً
  ModalSystem.closeAll('receiveClientModal');

  // Load clients (with caching)
  try {
    clientsListForPOS = await API.clients.getAll();
  } catch (e) {
    Logger.error('Failed to load clients:', e);
    clientsListForPOS = [];
  }

  // Populate dropdown (only clients with balance)
  const select = document.getElementById('receiveClientSelect');
  select.innerHTML = '<option value="">-- اختر العميل --</option>';
  clientsListForPOS.forEach(c => {
    const balance = Number(c.balance || 0);
    const balanceText = balance > 0 ? ` (مستحق: ${fmt(balance)})` : '';
    const option = document.createElement('option');
    option.value = c.id;
    option.textContent = `${c.name}${balanceText}`;
    select.appendChild(option);
  });

  // Reset form
  document.getElementById('clientBalanceGroup').style.display = 'none';
  document.getElementById('receiveClientAmount').value = '';
  document.getElementById('receiveClientMethod').value = 'cash';
  document.getElementById('receiveClientNotes').value = '';
  
  // Load payment wallets and update wallet select
  await loadPaymentWallets();
  await updateReceiveClientWalletSelect();

  // Show modal
  document.getElementById('receiveClientModal').classList.add('show');
}

// Update wallet select for receive client payment
async function updateReceiveClientWalletSelect() {
  const method = document.getElementById('receiveClientMethod')?.value || 'cash';
  const walletGroup = document.getElementById('receiveClientWalletGroup');
  const walletSelect = document.getElementById('receiveClientWalletSelect');
  
  if (!walletGroup || !walletSelect) return;
  
  // Show wallet select for mobile_wallet and bank, hide for cash
  if (method === 'mobile_wallet' || method === 'bank') {
    walletGroup.style.display = 'block';
    await updateWalletSelect(method, 'receiveClientWalletSelect');
  } else {
    walletGroup.style.display = 'none';
  }
}

// Close Receive Client Modal
function closeReceiveClientModal() {
  document.getElementById('receiveClientModal').classList.remove('show');
}

// On Client Select Change
function onClientSelectChange() {
  const clientId = document.getElementById('receiveClientSelect').value;
  const balanceGroup = document.getElementById('clientBalanceGroup');
  const balanceDisplay = document.getElementById('clientBalanceDisplay');

  if (clientId) {
    const client = clientsListForPOS.find(c => c.id == clientId);
    if (client) {
      const balance = Number(client.balance || 0);
      balanceDisplay.textContent = fmt(balance) + ' ج.م';
      balanceGroup.style.display = 'block';
    }
  } else {
    balanceGroup.style.display = 'none';
  }
}

// Confirm Receive Client Payment
async function confirmReceiveClient() {
  const clientId = document.getElementById('receiveClientSelect').value;
  const amount = Number(document.getElementById('receiveClientAmount').value || 0);
  const method = document.getElementById('receiveClientMethod').value;
  const notes = document.getElementById('receiveClientNotes').value.trim();

  if (!clientId) {
    showToast('الرجاء اختيار العميل', 'error');
    return;
  }

  if (amount <= 0) {
    showToast('الرجاء إدخال مبلغ صحيح', 'error');
    document.getElementById('receiveClientAmount').focus();
    return;
  }

  const client = clientsListForPOS.find(c => c.id == clientId);

  // Show button loading
  const btn = document.querySelector('#receiveClientModal .btn-success');
  UILoader.buttonLoading(btn, true);

  try {
    // تحديد نوع المحفظة بناءً على طريقة الدفع
    let walletType = 'cash';
    if (method === 'mobile_wallet' || method === 'instapay') {
      walletType = 'mobile_wallet';
    } else if (method === 'bank') {
      walletType = 'bank';
    }
    
    // Get wallet_id if method is mobile_wallet or bank
    const walletSelect = document.getElementById('receiveClientWalletSelect');
    const walletId = (method === 'mobile_wallet' || method === 'bank') && walletSelect?.value 
      ? parseInt(walletSelect.value) : null;

    // Send to backend (using unified API)
    await API.clients.payment({
      client_id: clientId,
      amount: amount,
      payment_method: method,
      wallet_type: walletType, // للتوافق العكسي
      wallet_id: walletId, // المحفظة المحددة
      notes: notes || `تحصيل من نقطة البيع`,
      from_pos: true // علامة أن الاستلام من نقطة البيع
    });

    // Clear clients cache to get fresh data
    API.clearCache('clients');

    // Record in shift transactions for shift closing
    const methodNames = {
      'cash': 'كاش',
      'mobile_wallet': 'محفظة إلكترونية',
      'instapay': 'انستاباي',
      'bank': 'تحويل بنكي',
      'deferred': 'آجل', 'DEFERRED': 'آجل', 'credit': 'آجل'
    };
    const transactions = getShiftTransactions();
    transactions.push({
      id: Date.now(),
      type: 'client_payment',
      amount: amount,
      category: 'تحصيل من عميل',
      description: `تحصيل من العميل: ${client?.name || 'عميل'} (${methodNames[method] || method})`,
      client_id: clientId,
      payment_method: method,
      wallet_type: walletType,
      created_at: new Date().toISOString()
    });
    saveShiftTransactions(transactions);

    // Close modal
    closeReceiveClientModal();

    // Refresh cash drawer
    await loadCashDrawerData();

    // Show success
    SoundFX.play('success');
    showToast(`✅ تم استلام ${fmt(amount)} ج.م من العميل: ${client?.name}`, 'success', 4000);

  } catch (error) {
    Logger.error('Receive client payment error:', error);
    showToast('فشل في الاستلام: ' + translateError(error.message), 'error');
  } finally {
    UILoader.buttonLoading(btn, false);
  }
}

// Close modals on backdrop click
document.getElementById('paySupplierModal')?.addEventListener('click', function(e) {
  if (e.target === this) closePaySupplierModal();
});

document.getElementById('receiveClientModal')?.addEventListener('click', function(e) {
  if (e.target === this) closeReceiveClientModal();
});

// ═══════════════════════════════════════════════════════════════
// 📥 PURCHASE DEVICE FROM CUSTOMER (شراء جهاز من زبون)
// ═══════════════════════════════════════════════════════════════

let purchaseDrawerBalance = 0;
let purchasePendingData = null; // بيانات الشراء المعلقة لحين إتمام السحب

// Open Purchase Modal (شراء من زبون)
async function openPurchaseModal() {
  // إغلاق أي مودالات مفتوحة أولاً
  ModalSystem.closeAll('purchaseModal');

  // Reset form - بيانات الزبون
  document.getElementById('purchaseCustomerName').value = '';
  document.getElementById('purchaseCustomerPhone').value = '';

  // Reset form - بيانات الجهاز
  document.getElementById('purchaseDeviceType').value = '';
  const customTypeField = document.getElementById('purchaseCustomTypeField');
  if (customTypeField) customTypeField.style.display = 'none';
  const customType = document.getElementById('purchaseCustomType');
  if (customType) customType.value = '';

  document.getElementById('purchaseDeviceModel').value = '';
  document.getElementById('purchaseDeviceStorage').value = '';
  document.getElementById('purchaseDeviceRam').value = '';
  document.getElementById('purchaseDeviceColor').value = '';
  document.getElementById('purchaseDeviceCondition').value = 'used';

  // الحقول الجديدة
  const batteryInput = document.getElementById('purchaseDeviceBattery');
  if (batteryInput) batteryInput.value = '';
  const boxSelect = document.getElementById('purchaseDeviceBox');
  if (boxSelect) boxSelect.value = 'without_box';
  document.getElementById('purchaseDeviceImei').value = '';
  const imei2Input = document.getElementById('purchaseDeviceImei2');
  if (imei2Input) imei2Input.value = '';

  // Reset RAM/Battery visibility - RAM visible, Battery hidden by default
  const ramField = document.getElementById('purchaseRamField');
  const batteryField = document.getElementById('purchaseBatteryField');
  if (ramField) ramField.style.display = 'block';
  if (batteryField) batteryField.style.display = 'none';

  // التقييم والدفع
  document.getElementById('purchaseDeviceCost').value = '';
  document.getElementById('purchaseDevicePrice').value = '';
  document.getElementById('purchasePaymentMethod').value = 'cash';
  document.getElementById('purchaseNotes').value = '';

  // Load drawer balance
  await loadPurchaseDrawerBalance();
  
  // ✅ تحميل المحافظ عند فتح المودال
  await loadPaymentWallets();
  await updatePOSPurchaseWalletsList();

  // Show modal
  document.getElementById('purchaseModal').style.display = 'flex';

  // Focus on customer name
  setTimeout(() => document.getElementById('purchaseCustomerName')?.focus(), 100);
}

// Toggle custom type field visibility
function togglePurchaseCustomType() {
  const typeSelect = document.getElementById('purchaseDeviceType');
  const customField = document.getElementById('purchaseCustomTypeField');

  if (typeSelect && customField) {
    if (typeSelect.value === 'Other') {
      customField.style.display = 'block';
      document.getElementById('purchaseCustomType')?.focus();
    } else {
      customField.style.display = 'none';
    }
  }
}

// Toggle RAM/Battery fields based on device type (Apple vs Others)
function togglePurchaseRamBattery() {
  const typeValue = document.getElementById('purchaseDeviceType')?.value || '';
  const ramField = document.getElementById('purchaseRamField');
  const batteryField = document.getElementById('purchaseBatteryField');
  const ramInput = document.getElementById('purchaseDeviceRam');
  const batteryInput = document.getElementById('purchaseDeviceBattery');

  // Apple: Show battery, Hide RAM
  // Others: Show RAM, Hide battery
  if (typeValue === 'Apple') {
    if (batteryField) batteryField.style.display = 'block';
    if (ramField) ramField.style.display = 'none';
    if (ramInput) ramInput.value = '';
  } else {
    if (batteryField) batteryField.style.display = 'none';
    if (batteryInput) batteryInput.value = '';
    if (ramField) ramField.style.display = 'block';
  }
}

// Load drawer balance for purchase (all wallets)
async function loadPurchaseDrawerBalance() {
  try {
    // بعت وقت آخر تقفيل شفت للـ API
    // ✅ PATCH 3: Use SessionCache
    // ✅ v1.2.3: Per-User closing time
    // ✅ v1.2.5: Per-User wallet balance
    const closingTimeKeyPurchase = getLastClosingTimeKey();
    const lastClosingTime = SessionCache.get(closingTimeKeyPurchase, false) || '';
    const currentUser = window.currentUser || JSON.parse(localStorage.getItem('currentUser') || '{}');
    const userId = currentUser?.id;
    let url = 'elos-db://drawer-wallets-balance';
    const params = [];
    if (lastClosingTime) {
      params.push(`after=${encodeURIComponent(lastClosingTime)}`);
    }
    if (userId) {
      params.push(`user_id=${userId}`);
    }
    if (params.length > 0) {
      url += '?' + params.join('&');
    }
    Logger.log('[PURCHASE] Loading drawer balance, lastClosingTime:', lastClosingTime, 'user_id:', userId);
    const res = await fetch(url);
    if (res.ok) {
      const data = await res.json();
      Logger.log('[PURCHASE] Drawer wallets response:', data);
      // رصيد الكاش
      purchaseDrawerBalance = Number(data.cash || 0);
      // أرصدة كل المحافظ
      purchaseWalletBalances = {
        cash: Number(data.cash || 0),
        mobile_wallet: Number(data.mobile_wallet || 0),
        bank: Number(data.bank || 0)
      };
      Logger.log('[PURCHASE] Final balances - Cash:', purchaseDrawerBalance, 'All:', purchaseWalletBalances);
    } else {
      Logger.error('[PURCHASE] Failed to fetch drawer balance, status:', res.status);
    }
  } catch (e) {
    Logger.error('[PURCHASE] Failed to load drawer balance:', e);
    purchaseDrawerBalance = 0;
    purchaseWalletBalances = { cash: 0, mobile_wallet: 0, bank: 0 };
  }
  updatePurchasePaymentInfo();
}

// أرصدة المحافظ في الدرج
let purchaseWalletBalances = {
  cash: 0,
  mobile_wallet: 0,
  bank: 0
};

// Update purchase payment info (show wallet balance warning)
function updatePurchasePaymentInfo() {
  const method = document.getElementById('purchasePaymentMethod')?.value;
  const cost = Number(document.getElementById('purchaseDeviceCost')?.value || 0);
  const drawerInfo = document.getElementById('purchaseDrawerInfo');
  const drawerBalanceEl = document.getElementById('purchaseDrawerBalance');
  const warningEl = document.getElementById('purchaseDrawerWarning');

  // تحديد المحفظة حسب طريقة الدفع
  const walletLabels = {
    'cash': '💵 كاش سائل',
    'transfer': '📱 محفظة إلكترونية',
    'bank': '🏦 رصيد بنكي'
  };

  if (method === 'cash' || method === 'transfer' || method === 'bank') {
    drawerInfo.style.display = 'block';

    // تحديد الرصيد المناسب
    let balance = 0;
    let walletKey = 'cash';
    if (method === 'transfer') {
      walletKey = 'mobile_wallet';
      balance = purchaseWalletBalances.mobile_wallet || 0;
    } else if (method === 'bank') {
      walletKey = 'bank';
      balance = purchaseWalletBalances.bank || 0;
    } else {
      balance = purchaseDrawerBalance || 0;
    }

    // تحديث النص
    document.querySelector('#purchaseDrawerInfo > div:first-child > span:first-child').textContent =
      `رصيد ${walletLabels[method] || 'المحفظة'}:`;
    drawerBalanceEl.textContent = fmt(balance) + ' ج.م';

    // Check if wallet has enough
    if (cost > 0 && cost > balance) {
      warningEl.style.display = 'block';
      drawerBalanceEl.style.color = 'var(--danger)';
      // تحديث رسالة التحذير
      warningEl.innerHTML = `
        <div style="font-size: 11px; color: #ef4444;">
          ⚠️ رصيد ${walletLabels[method]} غير كافي! سيتم طلب إذن سحب من الخزنة الرئيسية
        </div>
      `;
    } else {
      warningEl.style.display = 'none';
      drawerBalanceEl.style.color = 'var(--success)';
    }
  } else {
    // offset - لا يحتاج رصيد
    drawerInfo.style.display = 'none';
  }
}

// Close Purchase Modal
function closePurchaseModal() {
  document.getElementById('purchaseModal').style.display = 'none';
  purchasePendingData = null;
  // Reset client link
  unlinkPurchaseClient();
}

// ═══════════════════════════════════════════════════════════════
// 👥 CLIENT SEARCH & LINK - بحث وربط العملاء
// ═══════════════════════════════════════════════════════════════

let purchaseClientsCache = [];

// فتح موديل البحث في العملاء
function openPurchaseClientSearch() {
  document.getElementById('purchaseClientSearchModal').style.display = 'flex';
  document.getElementById('purchaseClientSearchInput').value = '';
  document.getElementById('purchaseClientSearchResults').innerHTML = `
    <div style="text-align: center; padding: 40px; color: var(--muted);">
      <div style="font-size: 32px; margin-bottom: 10px;">👥</div>
      <div>اكتب للبحث في العملاء</div>
    </div>
  `;
  document.getElementById('purchaseClientSearchInput').focus();
  // Load clients cache
  loadPurchaseClientsCache();
}

// إغلاق موديل البحث
function closePurchaseClientSearch() {
  document.getElementById('purchaseClientSearchModal').style.display = 'none';
}

// تحميل العملاء
async function loadPurchaseClientsCache() {
  try {
    const res = await fetch('elos-db://clients');
    Logger.log('[PURCHASE] Clients API response status:', res.status);
    if (res.ok) {
      const data = await res.json();
      Logger.log('[PURCHASE] Clients data received:', data?.length || 0, 'items');
      purchaseClientsCache = Array.isArray(data) ? data : (data.clients || []);
      Logger.log('[PURCHASE] Clients cache loaded:', purchaseClientsCache.length, 'clients');
    } else {
      Logger.error('[PURCHASE] Clients API error:', res.status);
    }
  } catch (e) {
    Logger.error('[PURCHASE] Error loading clients:', e);
  }
}

// البحث في العملاء
async function searchPurchaseClients() {
  const query = document.getElementById('purchaseClientSearchInput').value.trim().toLowerCase();
  const resultsDiv = document.getElementById('purchaseClientSearchResults');

  if (!query) {
    resultsDiv.innerHTML = `
      <div style="text-align: center; padding: 40px; color: var(--muted);">
        <div style="font-size: 32px; margin-bottom: 10px;">👥</div>
        <div>اكتب للبحث في العملاء</div>
      </div>
    `;
    return;
  }

  // لو الكاش فاضي، نحمل العملاء أولاً
  if (purchaseClientsCache.length === 0) {
    resultsDiv.innerHTML = `
      <div style="text-align: center; padding: 20px; color: var(--muted);">
        <div>⏳ جاري التحميل...</div>
      </div>
    `;
    await loadPurchaseClientsCache();
  }

  Logger.log('[PURCHASE] Searching in', purchaseClientsCache.length, 'clients for:', query);

  const filtered = purchaseClientsCache.filter(c =>
    (c.name || '').toLowerCase().includes(query) ||
    (c.phone || '').includes(query)
  );

  Logger.log('[PURCHASE] Found', filtered.length, 'matches');

  if (filtered.length === 0) {
    resultsDiv.innerHTML = `
      <div style="text-align: center; padding: 40px; color: var(--muted);">
        <div style="font-size: 32px; margin-bottom: 10px;">🔍</div>
        <div>لم يتم العثور على عملاء</div>
        <div style="font-size: 11px; margin-top: 5px;">يمكنك إدخال بيانات العميل يدوياً</div>
      </div>
    `;
    return;
  }

  resultsDiv.innerHTML = filtered.slice(0, 10).map(c => `
    <div onclick="selectPurchaseClient(${c.id}, '${(c.name || '').replace(/'/g, "\\'")}', '${c.phone || ''}')"
         style="padding: 12px; border: 1px solid var(--border); border-radius: 8px; margin-bottom: 8px; cursor: pointer; transition: all 0.2s; background: var(--bg-secondary);"
         onmouseover="this.style.background='var(--bg-tertiary)'; this.style.borderColor='var(--accent)';"
         onmouseout="this.style.background='var(--bg-secondary)'; this.style.borderColor='var(--border)';">
      <div style="display: flex; justify-content: space-between; align-items: center;">
        <div>
          <div style="font-size: 14px; font-weight: 600; color: var(--text-primary);">👤 ${c.name || 'بدون اسم'}</div>
          <div style="font-size: 12px; color: var(--muted);">📞 ${c.phone || 'بدون رقم'}</div>
        </div>
        <div style="text-align: left;">
          <div style="font-size: 11px; color: var(--muted);">الرصيد</div>
          <div style="font-size: 13px; font-weight: 600; color: ${(c.balance || 0) > 0 ? 'var(--danger)' : 'var(--success)'};">
            ${fmt(c.balance || 0)} ج.م
          </div>
        </div>
      </div>
    </div>
  `).join('');
}

// اختيار عميل
function selectPurchaseClient(id, name, phone) {
  document.getElementById('purchaseClientId').value = id;
  document.getElementById('purchaseCustomerName').value = name;
  document.getElementById('purchaseCustomerPhone').value = phone;

  // إظهار معلومات العميل المرتبط
  document.getElementById('purchaseLinkedClientInfo').style.display = 'block';
  document.getElementById('purchaseLinkedClientName').textContent = name;

  // إخفاء خيار الحفظ كعميل جديد
  document.getElementById('purchaseSaveAsClientOption').style.display = 'none';

  // إغلاق موديل البحث
  closePurchaseClientSearch();

  showToast(`✅ تم ربط العميل: ${name}`, 'success');
}

// إلغاء ربط العميل
function unlinkPurchaseClient() {
  document.getElementById('purchaseClientId').value = '';
  document.getElementById('purchaseLinkedClientInfo').style.display = 'none';
  document.getElementById('purchaseLinkedClientName').textContent = '';
  // تفعيل خيار الحفظ كعميل جديد لو فيه بيانات
  checkPurchaseClientExists();
}

// التحقق من وجود العميل وإظهار خيار الحفظ
let purchaseClientCheckTimeout = null;
function checkPurchaseClientExists() {
  // لو فيه عميل مرتبط، لا نعمل شيء
  if (document.getElementById('purchaseClientId').value) return;

  clearTimeout(purchaseClientCheckTimeout);
  purchaseClientCheckTimeout = setTimeout(async () => {
    const name = document.getElementById('purchaseCustomerName').value.trim();
    const phone = document.getElementById('purchaseCustomerPhone').value.trim();

    if (!name && !phone) {
      document.getElementById('purchaseSaveAsClientOption').style.display = 'none';
      return;
    }

    // بحث في الكاش
    const exists = purchaseClientsCache.some(c =>
      (phone && c.phone === phone) ||
      (name && (c.name || '').toLowerCase() === name.toLowerCase())
    );

    if (exists) {
      document.getElementById('purchaseSaveAsClientOption').style.display = 'none';
    } else {
      document.getElementById('purchaseSaveAsClientOption').style.display = 'block';
    }
  }, 300);
}

// ═══════════════════════════════════════════════════════════════
// 🖨️ PRINT PURCHASE RECEIPT - طباعة فاتورة شراء من العميل
// ═══════════════════════════════════════════════════════════════
async function printPurchaseReceipt() {
  // Get form data
  const customerName = document.getElementById('purchaseCustomerName').value.trim();
  const customerPhone = document.getElementById('purchaseCustomerPhone').value.trim();

  let type = document.getElementById('purchaseDeviceType').value.trim();
  if (type === 'Other') {
    type = document.getElementById('purchaseCustomType')?.value.trim() || '';
  }

  const model = document.getElementById('purchaseDeviceModel').value.trim();
  const imei = document.getElementById('purchaseDeviceImei').value.trim();
  const storage = document.getElementById('purchaseDeviceStorage').value.trim();
  const ram = document.getElementById('purchaseDeviceRam').value.trim();
  const color = document.getElementById('purchaseDeviceColor').value.trim();
  const condition = document.getElementById('purchaseDeviceCondition').value;
  const cost = Number(document.getElementById('purchaseDeviceCost').value || 0);
  const method = document.getElementById('purchasePaymentMethod').value;

  // Validations
  if (!customerName) {
    showToast('الرجاء إدخال اسم الزبون أولاً', 'error');
    return;
  }
  if (!type || !model) {
    showToast('الرجاء إدخال بيانات الجهاز أولاً', 'error');
    return;
  }
  if (cost <= 0) {
    showToast('الرجاء إدخال سعر الشراء', 'error');
    return;
  }

  // Get settings
  const settings = JSON.parse(localStorage.getItem('appSettings') || '{}');
  const companyName = settings.companyName || 'ELOS';
  const companyLogo = settings.companyLogo || '';
  const paperWidth = settings.printerPaperWidth === '58' ? '54mm' : '72mm';
  const pageSize = settings.printerPaperWidth || '80';

  // Format date/time
  const now = new Date();
  const dateStr = now.toLocaleDateString('ar-EG');
  const timeStr = now.toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' });

  // Generate invoice number
  const invoiceNumber = `PUR-${Date.now().toString().slice(-8)}`;

  // Translate condition
  const conditionMap = {
    'new': 'جديد',
    'like_new': 'كالجديد',
    'used': 'مستعمل',
    'faulty': 'عاطل'
  };
  const conditionAr = conditionMap[condition] || condition;

  // Translate payment method
  const methodMap = {
    'cash': 'كاش',
    'transfer': 'تحويل',
    'bank': 'تحويل بنكي'
  };
  const methodAr = methodMap[method] || method;

  // Device details
  const deviceDetails = [storage, ram, color, conditionAr].filter(Boolean).join(' - ');

  // Build receipt HTML - تصميم أنيق متوافق مع الطابعة الحرارية
  const receiptHTML = `
<!DOCTYPE html>
<html dir="rtl" lang="ar">
<head>
  <meta charset="UTF-8">
  <title>فاتورة شراء</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    @page { size: ${pageSize}mm auto; margin: 0; }
    
    body {
      font-family: Arial, Tahoma, sans-serif;
      width: ${paperWidth};
      max-width: ${paperWidth};
      margin: 0 auto;
      padding: 3mm;
      background: #fff;
      color: #000;
      font-size: 12px;
      line-height: 1.4;
      font-weight: 600;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }
    
    .header {
      text-align: center;
      padding-bottom: 3mm;
      border-bottom: 0.5mm solid #000;
      margin-bottom: 2mm;
    }
    .logo { max-width: 14mm; max-height: 14mm; margin-bottom: 1mm; display: block; margin-left: auto; margin-right: auto; }
    .shop-name { font-size: 16px; font-weight: 700; letter-spacing: 0.5mm; }
    .purchase-badge {
      display: inline-block;
      background: #000;
      color: #fff;
      padding: 1.5mm 4mm;
      font-size: 11px;
      font-weight: 700;
      margin-top: 2mm;
      letter-spacing: 0.5mm;
    }
    
    .info {
      display: flex;
      justify-content: space-between;
      padding: 2mm 0;
      font-size: 11px;
      font-weight: 600;
      color: #000;
      border-bottom: 0.3mm solid #000;
    }
    .info-num { font-weight: 700; font-size: 11px; }
    
    .section {
      padding: 2mm 0;
      border-bottom: 0.3mm solid #000;
    }
    .section-title {
      font-size: 10px;
      font-weight: 700;
      color: #000;
      margin-bottom: 1.5mm;
      padding-bottom: 1mm;
      border-bottom: 0.2mm dashed #000;
    }
    .data-row {
      display: flex;
      justify-content: space-between;
      font-size: 11px;
      padding: 1mm 0;
      font-weight: 600;
    }
    .data-value { 
      font-weight: 700; 
      max-width: 55%; 
      text-align: left; 
    }
    
    .device-box {
      background: #f0f0f0;
      padding: 2mm;
      margin: 2mm 0;
      text-align: center;
    }
    .device-name {
      font-size: 13px;
      font-weight: 700;
      color: #000;
    }
    .device-details {
      font-size: 10px;
      font-weight: 600;
      color: #000;
      margin-top: 1mm;
    }
    .device-imei {
      font-size: 9px;
      font-weight: 600;
      font-family: monospace;
      margin-top: 1mm;
    }
    
    .total {
      background: #000;
      color: #fff;
      margin: 3mm -3mm;
      padding: 4mm 3mm;
      text-align: center;
    }
    .total-label {
      font-size: 10px;
      font-weight: 600;
      letter-spacing: 1mm;
    }
    .total-amount {
      font-size: 18px;
      font-weight: 700;
      margin-top: 1mm;
    }
    
    .payment {
      display: flex;
      justify-content: space-between;
      font-size: 11px;
      font-weight: 600;
      padding: 2mm 0;
      color: #000;
      border-bottom: 0.3mm solid #000;
    }
    
    .sig-section {
      padding: 3mm 0;
    }
    .sig-row {
      display: flex;
      justify-content: space-between;
      gap: 3mm;
    }
    .sig-box {
      flex: 1;
      text-align: center;
    }
    .sig-label {
      font-size: 9px;
      font-weight: 700;
      color: #000;
    }
    .sig-line {
      height: 10mm;
      border-bottom: 0.3mm solid #000;
      margin-top: 1mm;
    }
    
    .footer {
      text-align: center;
      padding-top: 3mm;
      margin-top: 2mm;
      border-top: 0.3mm solid #000;
    }
    .footer-msg {
      font-size: 11px;
      font-weight: 600;
      color: #000;
      margin-bottom: 2mm;
    }
    .barcode { margin-top: 2mm; }
    .barcode-num {
      font-family: monospace;
      font-size: 10px;
      font-weight: 700;
      color: #000;
      margin-top: 1mm;
    }
    .elos-sig {
      margin-top: 3mm;
      padding-top: 2mm;
      border-top: 0.3mm dashed #000;
      font-size: 9px;
      font-weight: 600;
      color: #000;
      letter-spacing: 0.3mm;
    }
  </style>
</head>
<body>
  
  <div class="header">
    ${companyLogo ? `<img src="${companyLogo}" class="logo" />` : ''}
    <div class="shop-name">${companyName}</div>
    <div class="purchase-badge">فاتورة شراء جهاز</div>
  </div>
  
  <div class="info">
    <div>
      <div class="info-num">#${invoiceNumber}</div>
      <div>${dateStr} - ${timeStr}</div>
    </div>
  </div>
  
  <div class="section">
    <div class="section-title">بيانات البائع</div>
    <div class="data-row">
      <span>الاسم:</span>
      <span class="data-value">${customerName}</span>
    </div>
    ${customerPhone ? `
    <div class="data-row">
      <span>الهاتف:</span>
      <span class="data-value" style="direction: ltr;">${customerPhone}</span>
    </div>
    ` : ''}
  </div>
  
  <div class="section">
    <div class="section-title">بيانات الجهاز</div>
    <div class="device-box">
      <div class="device-name">${type} ${model}</div>
      ${deviceDetails ? `<div class="device-details">${deviceDetails}</div>` : ''}
      ${imei ? `<div class="device-imei">IMEI: ${imei}</div>` : ''}
    </div>
  </div>
  
  <div class="total">
    <div class="total-label">المبلغ المدفوع للبائع</div>
    <div class="total-amount">EGP ${cost.toLocaleString('en-US')}</div>
  </div>
  
  <div class="payment">
    <span>طريقة الدفع:</span>
    <span>${methodAr}</span>
  </div>
  
  <div class="sig-section">
    <div class="sig-row">
      <div class="sig-box">
        <div class="sig-label">توقيع البائع</div>
        <div class="sig-line"></div>
      </div>
      <div class="sig-box">
        <div class="sig-label">توقيع المشتري</div>
        <div class="sig-line"></div>
      </div>
    </div>
  </div>
  
  <div class="footer">
    <div class="footer-msg">${settings.printerFooterMessage || 'شكراً لتعاملكم معنا'}</div>
    <div class="barcode">
      ${generateBarcodeSVG(invoiceNumber.replace(/[^A-Z0-9]/gi, '').slice(-12))}
      <div class="barcode-num">${invoiceNumber}</div>
    </div>
    <div class="elos-sig">
      <div>ELOS ACCOUNTING SYSTEM</div>
      <div>01031372078</div>
    </div>
  </div>
  
</body>
</html>`;

  // Create print window
  const printWindow = window.open('', '_blank', 'width=350,height=700');
  if (!printWindow) {
    showToast('فشل فتح نافذة الطباعة', 'error');
    return;
  }

  printWindow.document.write(receiptHTML);
  printWindow.document.close();

  // Print after load
  printWindow.onload = function() {
    setTimeout(() => {
      printWindow.print();
      printWindow.close();
    }, 300);
  };

  showToast('جاري طباعة فاتورة الشراء...', 'info');
}

// Confirm Purchase from Customer
async function confirmPurchaseFromCustomer() {
  const customerName = document.getElementById('purchaseCustomerName').value.trim();
  const customerPhone = document.getElementById('purchaseCustomerPhone').value.trim();
  const clientId = document.getElementById('purchaseClientId')?.value || '';
  const saveAsClient = document.getElementById('purchaseSaveAsClient')?.checked || false;

  // نوع الجهاز (مع دعم "أخرى")
  let type = document.getElementById('purchaseDeviceType').value.trim();
  if (type === 'Other') {
    type = document.getElementById('purchaseCustomType')?.value.trim() || '';
  }

  const model = document.getElementById('purchaseDeviceModel').value.trim();
  const imei = document.getElementById('purchaseDeviceImei').value.trim();
  const imei2 = document.getElementById('purchaseDeviceImei2')?.value.trim() || '';
  const storage = document.getElementById('purchaseDeviceStorage').value.trim();
  const ram = document.getElementById('purchaseDeviceRam').value.trim();
  const color = document.getElementById('purchaseDeviceColor').value.trim();
  const condition = document.getElementById('purchaseDeviceCondition').value;
  const battery = document.getElementById('purchaseDeviceBattery')?.value || '';
  const box = document.getElementById('purchaseDeviceBox')?.value || 'without_box';
  const cost = Number(document.getElementById('purchaseDeviceCost').value || 0);
  const price = Number(document.getElementById('purchaseDevicePrice').value || 0);
  const ntraTax = Number(document.getElementById('purchaseNtraTax')?.value || 0);
  const method = document.getElementById('purchasePaymentMethod').value;
  const notes = document.getElementById('purchaseNotes').value.trim();

  // Validations
  if (!customerName) {
    showToast('الرجاء إدخال اسم الزبون', 'error');
    document.getElementById('purchaseCustomerName').focus();
    return;
  }
  if (!type) {
    showToast('الرجاء اختيار نوع الجهاز', 'error');
    document.getElementById('purchaseDeviceType').focus();
    return;
  }
  if (!model) {
    showToast('الرجاء إدخال موديل الجهاز', 'error');
    document.getElementById('purchaseDeviceModel').focus();
    return;
  }
  if (cost <= 0) {
    showToast('الرجاء إدخال سعر الشراء', 'error');
    document.getElementById('purchaseDeviceCost').focus();
    return;
  }

  // ═══════════════════════════════════════════════════════════════
  // 🚫 BLACKLIST CHECK - التحقق من IMEI قبل الشراء
  // ═══════════════════════════════════════════════════════════════
  if (imei && imei.length >= 10) {
    try {
      const checkRes = await fetch(`elos-db://check-imei/${imei}`);
      const checkData = await checkRes.json();

      if (checkData.warnings && checkData.warnings.length > 0) {
        let warningMessages = checkData.warnings.map(w => {
          if (w.type === 'blacklist') {
            return `🚫 تحذير خطير!\n${w.message}\nالسبب: ${w.reason}\nالمالك: ${w.owner || '-'}\nالتواصل: ${w.phone || '-'}`;
          } else if (w.type === 'duplicate') {
            return `⚠️ ${w.message}\n${w.device}`;
          }
          return w.message;
        }).join('\n\n');

        const proceed = await showConfirm(warningMessages + '\n\nهل تريد المتابعة رغم ذلك؟', 'متابعة', 'إلغاء', 'warning');
        if (!proceed) {
          showToast('تم إلغاء الشراء', 'info');
          return;
        }
      }
    } catch (e) {
      Logger.warn('[PURCHASE] Error checking IMEI1:', e);
    }
  }

  // فحص IMEI الثاني إذا كان موجود
  if (imei2 && imei2.length >= 10 && imei2 !== imei) {
    try {
      const checkRes = await fetch(`elos-db://check-imei/${imei2}`);
      const checkData = await checkRes.json();

      if (checkData.warnings && checkData.warnings.length > 0) {
        let warningMessages = checkData.warnings.map(w => {
          if (w.type === 'blacklist') {
            return `🚫 تحذير خطير! (IMEI2)\n${w.message}\nالسبب: ${w.reason}\nالمالك: ${w.owner || '-'}\nالتواصل: ${w.phone || '-'}`;
          } else if (w.type === 'duplicate') {
            return `⚠️ ${w.message} (IMEI2)\n${w.device}`;
          }
          return w.message;
        }).join('\n\n');

        const proceed = await showConfirm(warningMessages + '\n\nهل تريد المتابعة رغم ذلك؟', 'متابعة', 'إلغاء', 'warning');
        if (!proceed) {
          showToast('تم إلغاء الشراء', 'info');
          return;
        }
      }
    } catch (e) {
      Logger.warn('[PURCHASE] Error checking IMEI2:', e);
    }
  }

  // ✅ الحصول على المحفظة المحددة (للمحافظ الإلكترونية والحسابات البنكية)
  const walletSelect = document.getElementById('posPurchaseWalletSelect');
  const walletId = (method === 'transfer' || method === 'bank') && walletSelect?.value 
    ? parseInt(walletSelect.value) : null;
  
  // تحديد رصيد المحفظة المناسبة
  // ⚠️ نستخدم purchaseWalletBalances اللي اتحملت صح (مع after + user_id) من loadPurchaseDrawerBalance()
  // بدل ما نعمل fetch جديد بدون after ونجيب رصيد الخزنة كلها
  let currentWalletBalance = 0;
  let walletType = 'cash';
  if (method === 'cash') {
    currentWalletBalance = purchaseDrawerBalance || 0;
    walletType = 'cash';
  } else if (method === 'transfer') {
    currentWalletBalance = purchaseWalletBalances.mobile_wallet || 0;
    walletType = 'mobile_wallet';
  } else if (method === 'bank') {
    currentWalletBalance = purchaseWalletBalances.bank || 0;
    walletType = 'bank';
  }

  // If insufficient balance, show withdrawal modal (for cash, transfer, bank)
  if ((method === 'cash' || method === 'transfer' || method === 'bank') && cost > currentWalletBalance) {
    // Save pending purchase data
    purchasePendingData = {
      customerName,
      customerPhone,
      clientId,
      saveAsClient,
      type,
      model,
      imei,
      imei2,
      storage,
      ram,
      color,
      condition,
      battery,
      box,
      cost,
      price,
      ntraTax,
      method,
      walletType,
      walletId, // ✅ المحفظة المحددة
      notes
    };
    // Open withdrawal modal with wallet info
    openDrawerWithdrawalModal(cost, currentWalletBalance, walletType);
    return;
  }

  // Proceed with purchase
  await executePurchaseFromCustomer({
    customerName,
    customerPhone,
    clientId,
    saveAsClient,
    type,
    model,
    imei,
    imei2,
    storage,
    ram,
    color,
    condition,
    battery,
    box,
    cost,
    price,
    ntraTax,
    method,
    walletId, // ✅ المحفظة المحددة
    notes
  });
}

// Execute purchase from customer (actual API call)
async function executePurchaseFromCustomer(data) {
  UILoader.show('جاري تنفيذ عملية الشراء...', 'purchase');

  try {
    // Call API to buy device from customer
    const res = await fetch('elos-db://buy-device-from-customer', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        customer_name: data.customerName,
        customer_phone: data.customerPhone,
        client_id: data.clientId || null,
        save_as_client: data.saveAsClient || false,
        type: data.type,
        model: data.model,
        imei: data.imei,
        imei2: data.imei2 || '',
        storage: data.storage,
        ram: data.ram || '',
        color: data.color,
        condition: data.condition,
        battery: data.battery || '',
        box: data.box || 'without_box',
        purchase_cost: data.cost,
        expected_price: data.price || Math.round(data.cost * 1.2),
        ntra_tax: data.ntraTax || 0,
        payment_method: data.method,
        wallet_type: data.method === 'cash' ? 'cash' : (data.method === 'transfer' ? 'mobile_wallet' : 'bank'), // للتوافق العكسي
        wallet_id: data.walletId || null, // ✅ المحفظة المحددة
        notes: data.notes
      })
    });

    if (!res.ok) {
      throw new Error(await res.text());
    }

    const result = await res.json();

    // ⚠️ لا نسجل في shiftTransactions هنا!
    // لأن الـ backend يسجل في cash_ledger وهو المصدر الرئيسي
    // التسجيل المزدوج يسبب ظهور العملية مرتين في سجل الحركات

    // Close modal
    closePurchaseModal();

    // Invalidate cache and refresh
    SmartCache.invalidate();
    await search();
    await loadCashDrawerData();

    // Notify other pages
    localStorage.setItem('pos_data_updated', Date.now().toString());

    // Show success
    SoundFX.play('success');
    let successMsg = `✅ تم شراء ${data.type} ${data.model} من ${data.customerName} بـ ${fmt(data.cost)} ج.م`;
    if (result.clientCreated) {
      successMsg += '\n💾 وتم إضافته كعميل جديد';
    }
    showToast(successMsg, 'success', 4000);

    // Reload clients cache if client was created
    if (result.clientCreated) {
      loadPurchaseClientsCache();
    }

  } catch (error) {
    Logger.error('Purchase from customer error:', error);
    SoundFX.play('error');
    showToast('فشل عملية الشراء: ' + translateError(error.message), 'error');
  } finally {
    UILoader.hide('purchase');
  }
}

// ═══════════════════════════════════════════════════════════════
// 🏦 DRAWER WITHDRAWAL MODAL (إذن سحب من الخزنة الرئيسية)
// ═══════════════════════════════════════════════════════════════

let withdrawalRequiredAmount = 0;
let withdrawalCurrentDrawer = 0;
let withdrawalTargetWallet = 'cash'; // المحفظة المستهدفة للسحب

// Open Drawer Withdrawal Modal
async function openDrawerWithdrawalModal(requiredAmount, currentWalletBalance, walletType = 'cash') {
  withdrawalRequiredAmount = requiredAmount;
  withdrawalCurrentDrawer = currentWalletBalance;
  withdrawalTargetWallet = walletType;

  const shortage = requiredAmount - currentWalletBalance;

  // تسميات المحافظ
  const walletLabels = {
    'cash': '💵 كاش سائل',
    'mobile_wallet': '📱 محفظة إلكترونية',
    'bank': '🏦 رصيد بنكي'
  };

  const walletLabel = walletLabels[walletType] || walletLabels['cash'];

  // Update display values
  document.getElementById('withdrawalRequiredAmount').textContent = fmt(requiredAmount) + ' ج.م';
  document.getElementById('withdrawalDrawerBalance').textContent = fmt(currentWalletBalance) + ' ج.م';
  document.getElementById('withdrawalShortage').textContent = fmt(shortage) + ' ج.م';

  // تحديث عنوان المحفظة في الموديل
  const drawerBalanceLabel = document.querySelector('#drawerWithdrawalModal .withdrawal-info-item:nth-child(2) .withdrawal-info-label');
  if (drawerBalanceLabel) {
    drawerBalanceLabel.textContent = `رصيد ${walletLabel}:`;
  }

  // Set default withdrawal amount (shortage + some buffer)
  const suggestedAmount = Math.ceil(shortage / 100) * 100; // Round up to nearest 100
  document.getElementById('withdrawalAmount').value = suggestedAmount;

  // Load main safe balance
  await loadMainSafeBalance();

  // Check if current user is admin or cashier
  const isAdmin = await checkIfAdmin();
  const adminAuthSection = document.getElementById('withdrawalAdminAuth');
  if (isAdmin) {
    adminAuthSection.style.display = 'none';
  } else {
    adminAuthSection.style.display = 'block';
    document.getElementById('withdrawalAdminPassword').value = '';
  }

  // Show modal
  document.getElementById('drawerWithdrawalModal').style.display = 'flex';
}

// Close Drawer Withdrawal Modal
function closeDrawerWithdrawalModal() {
  document.getElementById('drawerWithdrawalModal').style.display = 'none';
}

// Load main safe balance
async function loadMainSafeBalance() {
  try {
    const res = await fetch('elos-db://main-safe-balance');
    if (res.ok) {
      const data = await res.json();
      document.getElementById('withdrawalSafeBalance').textContent = fmt(data.balance || 0) + ' ج.م';
    }
  } catch (e) {
    Logger.error('Failed to load safe balance:', e);
    document.getElementById('withdrawalSafeBalance').textContent = '-- ج.م';
  }
}

// Check if current user is admin
async function checkIfAdmin() {
  try {
    const res = await fetch('elos-db://current-user-role');
    if (res.ok) {
      const data = await res.json();
      return data.role === 'admin';
    }
  } catch (e) {
    Logger.error('Failed to check user role:', e);
  }
  return false;
}

// Confirm Drawer Withdrawal
async function confirmDrawerWithdrawal() {
  const amount = Number(document.getElementById('withdrawalAmount').value || 0);
  const adminPassword = document.getElementById('withdrawalAdminPassword').value;
  const adminAuthSection = document.getElementById('withdrawalAdminAuth');

  // Validate amount
  if (amount <= 0) {
    showToast('الرجاء إدخال مبلغ صحيح', 'error');
    document.getElementById('withdrawalAmount').focus();
    return;
  }

  const shortage = withdrawalRequiredAmount - withdrawalCurrentDrawer;
  if (amount < shortage) {
    showToast(`المبلغ أقل من النقص المطلوب (${fmt(shortage)} ج.م)`, 'error');
    return;
  }

  // If admin auth required, check password
  const needsAdminAuth = adminAuthSection.style.display !== 'none';
  if (needsAdminAuth && !adminPassword) {
    showToast('الرجاء إدخال باسورد المدير', 'error');
    document.getElementById('withdrawalAdminPassword').focus();
    return;
  }

  try {
    // تسميات المحافظ للرسالة
    const walletLabels = {
      'cash': 'كاش',
      'mobile_wallet': 'محفظة إلكترونية',
      'bank': 'بنك'
    };
    const walletLabel = walletLabels[withdrawalTargetWallet] || 'كاش';

    // Call API to transfer from safe to drawer wallet
    // ✅ FIX: إرسال wallet_id عشان السحب يتسجل صح في المحفظة المحددة
    const res = await fetch('elos-db://safe-to-drawer-transfer', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        amount: amount,
        wallet_type: withdrawalTargetWallet,
        wallet_id: purchasePendingData?.walletId || null,
        admin_password: needsAdminAuth ? adminPassword : null,
        reason: `سحب لشراء جهاز من زبون (${walletLabel}) - ${purchasePendingData?.type} ${purchasePendingData?.model}`
      })
    });

    if (!res.ok) {
      const errorText = await res.text();
      throw new Error(errorText);
    }

    // Close withdrawal modal
    closeDrawerWithdrawalModal();

    // Update drawer balance
    purchaseDrawerBalance += amount;

    // Now proceed with the pending purchase
    if (purchasePendingData) {
      showToast(`✅ تم إضافة ${fmt(amount)} ج.م للدرج`, 'success', 2000);

      // Small delay then execute purchase
      setTimeout(async () => {
        await executePurchaseFromCustomer(purchasePendingData);
      }, 500);
    }

  } catch (error) {
    Logger.error('Drawer withdrawal error:', error);
    showToast('فشل السحب: ' + translateError(error.message), 'error');
  }
}

// ═══════════════════════════════════════════════════════════════
// ↩️ RETURN BY INVOICE (مرتجع بالفاتورة)
// ═══════════════════════════════════════════════════════════════

let allInvoicesForReturn = [];
let selectedInvoiceForReturn = null;
let selectedItemsForReturn = [];

// Open Return Modal
async function openReturnModal() {
  // إغلاق أي مودالات مفتوحة أولاً
  ModalSystem.closeAll('returnModal');

  // Reset state
  selectedInvoiceForReturn = null;
  
  // ✅ تحميل المحافظ عند فتح المودال
  await loadPaymentWallets();
  await updatePOSReturnWalletsList();
  selectedItemsForReturn = [];

  // Reset UI
  document.getElementById('returnInvoiceSearch').value = '';
  document.getElementById('returnInvoicesList').style.display = 'block';  // ✅ إظهار قائمة الفواتير
  document.getElementById('returnInvoiceDetails').style.display = 'none';
  document.getElementById('returnSummary').style.display = 'none';
  document.getElementById('returnReason').value = '';
  document.getElementById('returnRestock').checked = true;
  document.getElementById('returnSelectAll').checked = false;
  updateReturnButton();

  // Show modal
  document.getElementById('returnModal').style.display = 'flex';

  // Load recent invoices
  await loadInvoicesForReturn();
}

// Close Return Modal
function closeReturnModal() {
  document.getElementById('returnModal').style.display = 'none';
  selectedInvoiceForReturn = null;
  selectedItemsForReturn = [];
}

// Load invoices for return
async function loadInvoicesForReturn() {
  const listDiv = document.getElementById('returnInvoicesList');
  if (!listDiv) {
    Logger.error('[RETURN] returnInvoicesList element not found');
    return;
  }

  listDiv.innerHTML = '<div style="padding: 30px; text-align: center; color: var(--muted);">جاري تحميل الفواتير...</div>';

  try {
    // إضافة timestamp لتجنب الـ caching
    const response = await fetch(`elos-db://invoices?_t=${Date.now()}`);
    if (!response.ok) throw new Error('فشل تحميل الفواتير');

    const data = await response.json();
    // التعامل مع كلا الحالتين: array مباشرة أو object به invoices
    allInvoicesForReturn = Array.isArray(data) ? data : (data.invoices || data || []);

    Logger.log('[RETURN] Loaded invoices:', allInvoicesForReturn.length);
    renderInvoicesList(allInvoicesForReturn);
  } catch (e) {
    Logger.error('[RETURN] Failed to load invoices:', e);
    listDiv.innerHTML = '<div style="padding: 30px; text-align: center; color: var(--danger);">❌ فشل تحميل الفواتير</div>';
  }
}

// Render invoices list
function renderInvoicesList(invoices) {
  const listDiv = document.getElementById('returnInvoicesList');
  if (!listDiv) {
    Logger.error('[RETURN] returnInvoicesList element not found in render');
    return;
  }

  // التأكد من أن invoices هو array
  if (!Array.isArray(invoices) || invoices.length === 0) {
    listDiv.innerHTML = '<div style="padding: 30px; text-align: center; color: var(--muted);">لا توجد فواتير</div>';
    return;
  }

  // Show only recent 20 invoices
  const recentInvoices = invoices.slice(0, 20);

  listDiv.innerHTML = recentInvoices.map(inv => {
    const date = new Date(inv.created_at).toLocaleString('ar-EG', {
      month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit'
    });
    const total = Number(inv.total_amount || 0);
    const isReturned = inv.status === 'returned';
    const isPartial = inv.status === 'partially_returned';

    let statusBadge = '';
    if (isReturned) statusBadge = '<span style="font-size: 10px; color: var(--danger); margin-right: 6px;">🔄 مرتجعة</span>';
    else if (isPartial) statusBadge = '<span style="font-size: 10px; color: var(--warning); margin-right: 6px;">⚠️ مرتجع جزئي</span>';

    // ✅ FIX: Show edit button for admin only on non-returned invoices
    const _cu = window.currentUser || JSON.parse(localStorage.getItem('currentUser') || '{}');
    const isAdmin = _cu.role === 'admin' || _cu.role === 'manager';
    const editBtn = (isAdmin && !isReturned) ? `
      <button onclick="event.stopPropagation(); openEditInvoiceModal('${inv.invoice_number}')"
        style="background:rgba(59,130,246,0.1); border:1px solid rgba(59,130,246,0.3); border-radius:6px; padding:4px 8px; cursor:pointer; font-size:11px; color:var(--brand, #3b82f6); margin-right:8px; white-space:nowrap;"
        title="تعديل الفاتورة">✏️ تعديل</button>` : '';

    return `
      <div class="return-invoice-item" onclick="selectInvoiceForReturn('${inv.invoice_number}')"
           style="padding: 12px 14px; border-bottom: 1px solid var(--border); cursor: pointer; transition: all 0.2s; ${isReturned ? 'opacity: 0.5;' : ''}"
           onmouseover="this.style.background='var(--hover)'" onmouseout="this.style.background=''">
        <div style="display: flex; justify-content: space-between; align-items: center;">
          <div>
            <div style="font-weight: 600; font-size: 13px; color: var(--text);">
              ${inv.invoice_number} ${statusBadge}
            </div>
            <div style="font-size: 11px; color: var(--muted); margin-top: 2px;">
              👤 ${inv.customer_name || 'عميل نقدي'} • 📅 ${date}
            </div>
            <div style="font-size: 11px; color: var(--muted); margin-top: 2px;">
              ${inv.devices_count > 0 ? `📱 ${inv.devices_count} جهاز` : ''}
              ${inv.accessories_count > 0 ? `🎧 ${inv.accessories_count} إكسسوار` : ''}
              ${inv.repair_parts_count > 0 ? `🔧 ${inv.repair_parts_count} قطعة غيار` : ''}
            </div>
          </div>
          <div style="display:flex; align-items:center; gap:6px;">
            ${editBtn}
            <div style="font-weight: 700; color: var(--success);">${fmt(total)} ج.م</div>
          </div>
        </div>
      </div>
    `;
  }).join('');
}

// Search invoices
let searchInvoiceTimeout;
function searchInvoicesForReturn(query) {
  clearTimeout(searchInvoiceTimeout);

  searchInvoiceTimeout = setTimeout(() => {
    if (!query.trim()) {
      renderInvoicesList(allInvoicesForReturn);
      return;
    }

    const q = query.toLowerCase();
    const filtered = allInvoicesForReturn.filter(inv =>
      inv.invoice_number.toLowerCase().includes(q) ||
      (inv.customer_name || '').toLowerCase().includes(q)
    );

    renderInvoicesList(filtered);
  }, 300);
}

// Select invoice for return
async function selectInvoiceForReturn(invoiceNumber) {
  try {
    const response = await fetch(`elos-db://invoice/${invoiceNumber}`);
    if (!response.ok) throw new Error('فشل تحميل الفاتورة');

    const invoice = await response.json();
    selectedInvoiceForReturn = invoice;
    selectedItemsForReturn = [];

    // Hide invoices list, show details
    document.getElementById('returnInvoicesList').style.display = 'none';
    document.getElementById('returnInvoiceDetails').style.display = 'block';

    // ✅ التحقق هل الفاتورة كانت بيع آجل - إظهار/إخفاء قسم المحفظة
    const allItemsDeferred = invoice.items.every(item => {
      const pm = (item.payment_method || 'cash').toLowerCase();
      return pm === 'deferred' || pm === 'credit';
    });
    const returnWalletSection = document.getElementById('returnWalletSection');
    const returnDeferredNotice = document.getElementById('returnDeferredNotice');
    if (returnWalletSection) returnWalletSection.style.display = allItemsDeferred ? 'none' : 'block';
    if (returnDeferredNotice) returnDeferredNotice.style.display = allItemsDeferred ? 'block' : 'none';

    // Render invoice info
    const infoDiv = document.getElementById('returnInvoiceInfo');
    const paymentLabel = allItemsDeferred ? '<span style="color:#f59e0b; font-weight:600;">آجل</span>' : '';
    infoDiv.innerHTML = `
      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
        <span style="font-weight: 700; color: var(--brand);">${invoice.invoice_number}</span>
        <button onclick="goBackToInvoicesList()" style="background: none; border: none; color: var(--muted); cursor: pointer; font-size: 12px;">
          ← رجوع للقائمة
        </button>
      </div>
      <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 8px; font-size: 12px;">
        <div>👤 ${invoice.customer_name || 'عميل نقدي'}</div>
        <div>📅 ${new Date(invoice.created_at).toLocaleString('ar-EG')}</div>
        <div>💰 الإجمالي: <strong>${fmt(invoice.total_amount)}</strong> ج.م ${paymentLabel}</div>
        <div>📱 ${invoice.devices_count} جهاز • 🎧 ${invoice.accessories_count} إكسسوار${invoice.repair_parts_count > 0 ? ` • 🔧 ${invoice.repair_parts_count} قطعة غيار` : ''}</div>
      </div>
    `;

    // Render invoice items
    renderInvoiceItems(invoice.items);

    // Reset select all
    document.getElementById('returnSelectAll').checked = false;
    updateReturnSummary();

  } catch (e) {
    Logger.error('Failed to load invoice:', e);
    showToast('فشل تحميل الفاتورة', 'error');
  }
}

// Go back to invoices list
function goBackToInvoicesList() {
  document.getElementById('returnInvoicesList').style.display = 'block';
  document.getElementById('returnInvoiceDetails').style.display = 'none';
  selectedInvoiceForReturn = null;
  selectedItemsForReturn = [];
  document.getElementById('returnSelectAll').checked = false;
  // ✅ إعادة إظهار قسم المحفظة وإخفاء تنبيه الآجل
  const returnWalletSection = document.getElementById('returnWalletSection');
  const returnDeferredNotice = document.getElementById('returnDeferredNotice');
  if (returnWalletSection) returnWalletSection.style.display = 'block';
  if (returnDeferredNotice) returnDeferredNotice.style.display = 'none';
  updateReturnButton();
}

// Render invoice items for selection
function renderInvoiceItems(items) {
  const itemsDiv = document.getElementById('returnInvoiceItems');

  if (!items || items.length === 0) {
    itemsDiv.innerHTML = '<div style="padding: 20px; text-align: center; color: var(--muted);">لا توجد عناصر</div>';
    return;
  }

  itemsDiv.innerHTML = items.map((item, index) => {
    const isDevice = item.item_type === 'device';
    const isRepairPart = item.item_type === 'repair_part';
    const isReturned = item.status === 'returned';
    const totalQty = item.quantity || 1;
    const returnedQty = item.returned_quantity || 0;
    const availableQty = totalQty - returnedQty;
    // ✅ v1.2.9-hotfix3: دعم كل أسماء الأعمدة الممكنة للسعر
    const totalPrice = Number(item.price || item.paid_now || item.total_price || item.paid_amount || item.sell_price || 0);
    const unitPrice = totalPrice / totalQty;

    // Debug log
    console.log('[RETURN] Item:', item.item_name, 'price:', item.price, 'paid_now:', item.paid_now,
                'total_price:', item.total_price, 'paid_amount:', item.paid_amount,
                'calculated totalPrice:', totalPrice, 'unitPrice:', unitPrice);

    // للإكسسوارات: حساب السعر المتاح للإرجاع
    const availableRefund = unitPrice * availableQty;

    let details = '';
    if (isDevice) {
      details = [item.storage, item.color, item.imei1].filter(Boolean).join(' • ');
    } else {
      // عرض الكمية المتاحة للإرجاع
      if (totalQty > 1) {
        details = returnedQty > 0
          ? `الكمية: ${totalQty} (متاح للإرجاع: ${availableQty})`
          : `الكمية: ${totalQty}`;
      }
    }

    // الإكسسوار تم إرجاعه بالكامل
    const fullyReturned = isReturned || availableQty <= 0;

    return `
      <div class="return-item ${fullyReturned ? 'returned' : ''}"
           data-index="${index}"
           style="padding: 12px 14px; border-bottom: 1px solid var(--border); display: flex; align-items: center; gap: 12px; ${fullyReturned ? 'opacity: 0.5; background: rgba(239,68,68,0.05);' : ''}">
        <input type="checkbox"
               class="return-item-checkbox"
               data-index="${index}"
               ${fullyReturned ? 'disabled' : ''}
               onchange="toggleReturnItem(${index})"
               style="width: 18px; height: 18px; accent-color: var(--brand);">
        <div style="width: 36px; height: 36px; border-radius: 8px; background: ${isDevice ? 'rgba(59,130,246,0.1)' : isRepairPart ? 'rgba(245,158,11,0.1)' : 'rgba(139,92,246,0.1)'}; display: flex; align-items: center; justify-content: center; font-size: 18px;">
          ${isDevice ? '📱' : isRepairPart ? '🔧' : '🎧'}
        </div>
        <div style="flex: 1; min-width: 0;">
          <div style="font-weight: 600; font-size: 13px; color: var(--text); white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">
            ${item.item_name || 'منتج'}
          </div>
          ${details ? `<div style="font-size: 11px; color: var(--muted); margin-top: 2px;">${details}</div>` : ''}
          ${fullyReturned ? '<div style="font-size: 10px; color: var(--danger); margin-top: 2px;">🔄 تم إرجاعه</div>' : ''}
          ${returnedQty > 0 && !fullyReturned ? `<div style="font-size: 10px; color: var(--warning); margin-top: 2px;">🔄 تم إرجاع ${returnedQty} من ${totalQty}</div>` : ''}
        </div>
        ${!isDevice && availableQty > 1 && !fullyReturned ? `
          <div style="display: flex; align-items: center; gap: 6px;">
            <button onclick="adjustReturnQty(${index}, -1)" style="width: 24px; height: 24px; border-radius: 6px; border: 1px solid var(--border); background: var(--bg-tertiary); cursor: pointer; font-size: 14px;">−</button>
            <input type="number"
                   id="returnQty_${index}"
                   value="1"
                   min="1"
                   max="${availableQty}"
                   data-unit-price="${unitPrice}"
                   data-max-qty="${availableQty}"
                   onchange="updateReturnItemQty(${index})"
                   style="width: 40px; text-align: center; border: 1px solid var(--border); border-radius: 6px; padding: 4px; background: var(--bg-secondary); color: var(--text);">
            <button onclick="adjustReturnQty(${index}, 1)" style="width: 24px; height: 24px; border-radius: 6px; border: 1px solid var(--border); background: var(--bg-tertiary); cursor: pointer; font-size: 14px;">+</button>
          </div>
        ` : ''}
        <div style="font-weight: 700; color: var(--success); white-space: nowrap; min-width: 70px; text-align: left;">
          ${isDevice || availableQty <= 1 ? fmt(availableRefund) : `<span id="returnPrice_${index}">${fmt(unitPrice)}</span>`} ج.م
        </div>
      </div>
    `;
  }).join('');
}

// تعديل كمية المرتجع بالأزرار +/-
function adjustReturnQty(index, delta) {
  const input = document.getElementById(`returnQty_${index}`);
  if (!input) return;

  const maxQty = parseInt(input.dataset.maxQty) || 1;
  let newQty = parseInt(input.value || 1) + delta;
  newQty = Math.max(1, Math.min(newQty, maxQty));
  input.value = newQty;

  updateReturnItemQty(index);
}

// تحديث كمية وسعر المرتجع
function updateReturnItemQty(index) {
  const input = document.getElementById(`returnQty_${index}`);
  const priceSpan = document.getElementById(`returnPrice_${index}`);
  if (!input) return;

  const maxQty = parseInt(input.dataset.maxQty) || 1;
  const unitPrice = parseFloat(input.dataset.unitPrice) || 0;
  let qty = parseInt(input.value || 1);

  // التأكد من الكمية ضمن الحدود
  qty = Math.max(1, Math.min(qty, maxQty));
  input.value = qty;

  // تحديث السعر المعروض
  if (priceSpan) {
    priceSpan.textContent = fmt(unitPrice * qty);
  }

  // تحديث في selectedItemsForReturn إذا كان محدد
  const existingIndex = selectedItemsForReturn.findIndex(i => i.index === index);
  if (existingIndex >= 0) {
    selectedItemsForReturn[existingIndex].refund_amount = unitPrice * qty;
    selectedItemsForReturn[existingIndex].return_quantity = qty;
    updateReturnSummary();
  }
}

// Toggle return item selection
function toggleReturnItem(index) {
  const item = selectedInvoiceForReturn.items[index];
  if (!item || item.status === 'returned') return;

  // التحقق من الكمية المتاحة للإرجاع
  const totalQty = item.quantity || 1;
  const returnedQty = item.returned_quantity || 0;
  const availableQty = totalQty - returnedQty;
  if (availableQty <= 0) return;

  const existingIndex = selectedItemsForReturn.findIndex(i => i.index === index);

  if (existingIndex >= 0) {
    selectedItemsForReturn.splice(existingIndex, 1);
  } else {
    // للإكسسوارات: جلب الكمية المحددة من الـ input
    const isDevice = item.item_type === 'device';
    const qtyInput = document.getElementById(`returnQty_${index}`);
    const selectedQty = (!isDevice && qtyInput) ? parseInt(qtyInput.value || 1) : (isDevice ? 1 : availableQty);
    // ✅ v1.2.9-hotfix3: دعم كل أسماء الأعمدة الممكنة للسعر
    const totalPrice = Number(item.price || item.paid_now || item.total_price || item.paid_amount || item.sell_price || 0);
    const unitPrice = totalPrice / totalQty;
    const refundAmount = unitPrice * selectedQty;

    console.log('[RETURN] Toggle item:', item.item_name, 'totalPrice:', totalPrice, 'unitPrice:', unitPrice, 'refundAmount:', refundAmount);

    selectedItemsForReturn.push({
      index: index,
      sale_id: item.sale_id,
      item_type: item.item_type,
      refund_amount: refundAmount,
      item_name: item.item_name,
      return_quantity: selectedQty  // الكمية المراد إرجاعها
    });
  }

  updateReturnSummary();
}

// Toggle select all items
function toggleSelectAllReturnItems() {
  const selectAll = document.getElementById('returnSelectAll').checked;
  const checkboxes = document.querySelectorAll('.return-item-checkbox:not(:disabled)');

  selectedItemsForReturn = [];

  checkboxes.forEach((cb, i) => {
    cb.checked = selectAll;
  });

  if (selectAll && selectedInvoiceForReturn) {
    selectedInvoiceForReturn.items.forEach((item, index) => {
      const totalQty = item.quantity || 1;
      const returnedQty = item.returned_quantity || 0;
      const availableQty = totalQty - returnedQty;

      if (item.status !== 'returned' && availableQty > 0) {
        const isDevice = item.item_type === 'device';
        const qtyInput = document.getElementById(`returnQty_${index}`);
        const selectedQty = (!isDevice && qtyInput) ? parseInt(qtyInput.value || 1) : (isDevice ? 1 : availableQty);
        // ✅ v1.2.9-hotfix3: دعم كل أسماء الأعمدة الممكنة للسعر
        const totalPrice = Number(item.price || item.paid_now || item.total_price || item.paid_amount || item.sell_price || 0);
        const unitPrice = totalPrice / totalQty;
        const refundAmount = unitPrice * selectedQty;

        selectedItemsForReturn.push({
          index: index,
          sale_id: item.sale_id,
          item_type: item.item_type,
          refund_amount: refundAmount,
          item_name: item.item_name,
          return_quantity: selectedQty
        });
      }
    });
  }

  updateReturnSummary();
}

// Update return summary
function updateReturnSummary() {
  const summaryDiv = document.getElementById('returnSummary');
  const totalSpan = document.getElementById('returnTotalAmount');
  const countSpan = document.getElementById('returnItemsCount');

  if (selectedItemsForReturn.length === 0) {
    summaryDiv.style.display = 'none';
  } else {
    const total = selectedItemsForReturn.reduce((sum, item) => sum + item.refund_amount, 0);
    totalSpan.textContent = fmt(total) + ' ج.م';
    countSpan.textContent = selectedItemsForReturn.length;
    summaryDiv.style.display = 'block';
  }

  updateReturnButton();
}

// Update confirm button state
function updateReturnButton() {
  const btn = document.getElementById('confirmReturnBtn');
  const hasItems = selectedItemsForReturn.length > 0;

  btn.disabled = !hasItems;
  btn.style.opacity = hasItems ? '1' : '0.5';
}

// بيانات المرتجع المعلقة (عند الحاجة للسحب من الخزنة)
let pendingReturnData = null;

// Confirm invoice return
async function confirmInvoiceReturn() {
  if (!selectedInvoiceForReturn || selectedItemsForReturn.length === 0) {
    showToast('الرجاء اختيار عناصر للإرجاع', 'error');
    return;
  }

  const reason = document.getElementById('returnReason').value;
  const restock = document.getElementById('returnRestock').checked;
  const walletType = document.getElementById('returnWalletType').value || 'cash';

  // ✅ الحصول على المحفظة المحددة (لجميع أنواع المحافظ بما فيها الكاش)
  const walletSelect = document.getElementById('posReturnWalletSelect');
  let walletId = null;

  if (walletSelect && walletSelect.value) {
    walletId = parseInt(walletSelect.value);
  } else if (walletType === 'cash') {
    // ✅ إذا لم يتم اختيار محفظة، نستخدم محفظة الكاش الافتراضية
    const defaultCashWallet = paymentWallets.find(w => w.type === 'cash' && w.is_default);
    if (defaultCashWallet) {
      walletId = defaultCashWallet.id;
    }
  }

  if (!reason) {
    showToast('الرجاء اختيار سبب المرتجع', 'error');
    return;
  }

  const totalRefund = selectedItemsForReturn.reduce((sum, i) => sum + i.refund_amount, 0);
  const itemsList = selectedItemsForReturn.map(i => i.item_name).join('، ');

  // ✅ التحقق هل كل العناصر المحددة للإرجاع كانت مبيعة آجل
  const allItemsDeferred = selectedItemsForReturn.every(selItem => {
    const originalItem = selectedInvoiceForReturn.items[selItem.index];
    if (!originalItem) return false;
    const pm = (originalItem.payment_method || 'cash').toLowerCase();
    return pm === 'deferred' || pm === 'credit';
  });

  console.log('[RETURN-CHECK] 🔍 allItemsDeferred:', allItemsDeferred);

  // أسماء المحافظ بالعربي
  const walletNames = {
    'cash': 'الكاش السائل',
    'mobile_wallet': 'المحفظة الإلكترونية',
    'bank': 'البنك'
  };

  // ✅ إذا كل العناصر آجل - نتخطى التحقق من المحفظة ونرجع مباشرة
  if (allItemsDeferred) {
    console.log('[RETURN-CHECK] ✅ All items are deferred - skipping wallet check');

    const confirmed = await showConfirm(
      `تأكيد مرتجع من الفاتورة ${selectedInvoiceForReturn.invoice_number}:\n\n` +
      `العناصر: ${itemsList}\n` +
      `المبلغ الأصلي: ${fmt(totalRefund)} ج.م\n` +
      `⚠️ هذه الفاتورة كانت بيع آجل - لن يتم خصم أي مبلغ من الدرج\n` +
      `سيتم إزالة المديونية من حساب العميل فقط\n` +
      `إرجاع للمخزون: ${restock ? 'نعم' : 'لا'}`,
      'تنفيذ المرتجع',
      'إلغاء',
      'warning'
    );

    if (!confirmed) return;

    // تنفيذ المرتجع بدون محفظة (آجل)
    await executeInvoiceReturn({
      invoiceNumber: selectedInvoiceForReturn.invoice_number,
      items: selectedItemsForReturn.map(i => ({
        sale_id: i.sale_id,
        item_type: i.item_type,
        refund_amount: i.refund_amount,
        return_quantity: i.return_quantity
      })),
      reason: reason,
      restock: restock,
      totalRefund: totalRefund,
      walletType: walletType,
      walletId: walletId,
      isDeferredReturn: true // ✅ علامة مرتجع آجل
    });
    return;
  }

  // ✅ التحقق من رصيد المحفظة المختارة قبل المرتجع (فقط للبيع العادي)
  // 🔧 FIX: نستخدم currentCashData.walletsMap لأنه يشمل التحويلات الداخلية (localStorage)
  // الـ API وحده لا يعرف التحويلات الداخلية بين المحافظ → رصيد غلط → مرتجع بدون تحقق كافي
  let currentWalletBalance = 0;
  try {
    // ✅ أولاً: نستخدم walletsMap (المصدر الموثوق - يشمل API + localStorage)
    if (currentCashData && currentCashData.walletsMap) {
      if (walletId && currentCashData.walletsMap[walletId]) {
        currentWalletBalance = currentCashData.walletsMap[walletId].balance || 0;
        console.log('[RETURN-CHECK] ✅ Using walletsMap balance for wallet', walletId, ':', currentWalletBalance);
      } else {
        // fallback: مجموع أرصدة المحافظ من نفس النوع
        if (walletType === 'cash') currentWalletBalance = currentCashData.cashTotal || 0;
        else if (walletType === 'mobile_wallet') currentWalletBalance = currentCashData.mobileTotal || 0;
        else if (walletType === 'bank') currentWalletBalance = currentCashData.bankTotal || 0;
        console.log('[RETURN-CHECK] ✅ Using currentCashData type balance:', walletType, '=', currentWalletBalance);
      }
    } else {
      // ⚠️ fallback: لو مفيش currentCashData، نجيب من API ونعدل بالتحويلات الداخلية
      const currentUser = window.currentUser || JSON.parse(localStorage.getItem('currentUser') || '{}');
      const userId = currentUser?.id;
      const closingTimeKey = getLastClosingTimeKey();
      const lastClosingTime = SessionCache.get(closingTimeKey, false) || null;

      let walletUrl = `elos-db://drawer-wallets-balance`;
      const params = [];
      if (lastClosingTime) params.push(`after=${encodeURIComponent(lastClosingTime)}`);
      if (userId) params.push(`user_id=${userId}`);
      if (params.length > 0) walletUrl += '?' + params.join('&');

      console.log('[RETURN-CHECK] 🔍 Fetching balance from:', walletUrl);
      const res = await fetch(walletUrl);
      if (res.ok) {
        const data = await res.json();
        console.log('[RETURN-CHECK] 🔍 walletType:', walletType, 'walletId:', walletId);
        console.log('[RETURN-CHECK] 🔍 API response - cash:', data.cash, 'mobile_wallet:', data.mobile_wallet, 'bank:', data.bank);

        // 🔧 FIX: تعديل رصيد API بالتحويلات الداخلية من localStorage
        const shiftTx = getShiftTransactions();
        const localDeposits = {};
        const localWithdraws = {};
        shiftTx.forEach(tx => {
          if (tx.type === 'wallet_transfer') {
            const amount = Number(tx.amount || 0);
            if (tx.fromWallet) localWithdraws[tx.fromWallet] = (localWithdraws[tx.fromWallet] || 0) + amount;
            if (tx.toWallet) localDeposits[tx.toWallet] = (localDeposits[tx.toWallet] || 0) + amount;
          }
        });

        if (walletId) {
          const wallet = data.wallets?.find(w => w.id == walletId);
          if (wallet) {
            // تعديل بالتحويلات الداخلية حسب wallet_id
            let localDep = 0, localWith = 0;
            shiftTx.forEach(tx => {
              if (tx.type === 'wallet_transfer') {
                const amount = Number(tx.amount || 0);
                if (tx.toWalletId == walletId) localDep += amount;
                if (tx.fromWalletId == walletId) localWith += amount;
              }
            });
            currentWalletBalance = Number(wallet.balance || 0) + localDep - localWith;
            console.log('[RETURN-CHECK] ✅ API wallet', walletId, 'adjusted:', wallet.balance, '+', localDep, '-', localWith, '=', currentWalletBalance);
          } else {
            const apiBalance = Number(data[walletType] || 0);
            currentWalletBalance = apiBalance + (localDeposits[walletType] || 0) - (localWithdraws[walletType] || 0);
            console.log('[RETURN-CHECK] ⚠️ Wallet ID', walletId, 'not found, type fallback adjusted:', currentWalletBalance);
          }
        } else {
          const apiBalance = Number(data[walletType] || 0);
          currentWalletBalance = apiBalance + (localDeposits[walletType] || 0) - (localWithdraws[walletType] || 0);
          console.log('[RETURN-CHECK] 📊 No walletId, type fallback adjusted:', walletType, '=', currentWalletBalance);
        }
      }
    }
  } catch (e) {
    Logger.error('Error getting wallet balance:', e);
    if (currentCashData) {
      if (walletType === 'cash') currentWalletBalance = currentCashData.cashTotal || 0;
      else if (walletType === 'mobile_wallet') currentWalletBalance = currentCashData.mobileTotal || 0;
      else if (walletType === 'bank') currentWalletBalance = currentCashData.bankTotal || 0;
    }
  }

  console.log('[RETURN-CHECK] 💰 totalRefund:', totalRefund, 'currentWalletBalance:', currentWalletBalance, 'walletType:', walletType);
  console.log('[RETURN-CHECK] 🔍 Need withdrawal?', totalRefund > currentWalletBalance);

  if (totalRefund > currentWalletBalance) {
    // حفظ بيانات المرتجع المعلقة
    pendingReturnData = {
      invoiceNumber: selectedInvoiceForReturn.invoice_number,
      items: selectedItemsForReturn.map(i => ({
        sale_id: i.sale_id,
        item_type: i.item_type,
        refund_amount: i.refund_amount,
        return_quantity: i.return_quantity
      })),
      reason: reason,
      restock: restock,
      totalRefund: totalRefund,
      itemsList: itemsList,
      walletType: walletType,
      walletId: walletId // ✅ المحفظة المحددة
    };

    // فتح مودال السحب من الخزنة
    openReturnWithdrawalModal(totalRefund, currentWalletBalance, walletType);
    return;
  }

  // Confirm
  const confirmed = await showConfirm(
    `تأكيد مرتجع من الفاتورة ${selectedInvoiceForReturn.invoice_number}:\n\n` +
    `العناصر: ${itemsList}\n` +
    `المبلغ: ${fmt(totalRefund)} ج.م\n` +
    `الخصم من: ${walletNames[walletType]}\n` +
    `إرجاع للمخزون: ${restock ? 'نعم' : 'لا'}`,
    'تنفيذ المرتجع',
    'إلغاء',
    'warning'
  );

  if (!confirmed) return;

  // تنفيذ المرتجع
  await executeInvoiceReturn({
    invoiceNumber: selectedInvoiceForReturn.invoice_number,
    items: selectedItemsForReturn.map(i => ({
      sale_id: i.sale_id,
      item_type: i.item_type,
      refund_amount: i.refund_amount,
      return_quantity: i.return_quantity
    })),
    reason: reason,
    restock: restock,
      totalRefund: totalRefund,
      walletType: walletType,
      walletId: walletId // ✅ المحفظة المحددة
    });
}

// فتح مودال السحب من الخزنة للمرتجع
async function openReturnWithdrawalModal(requiredAmount, currentBalance, selectedWalletType) {
  const shortage = requiredAmount - currentBalance;

  // تحديث القيم في المودال
  document.getElementById('withdrawalRequiredAmount').textContent = fmt(requiredAmount) + ' ج.م';
  document.getElementById('withdrawalDrawerBalance').textContent = fmt(currentBalance) + ' ج.م';
  document.getElementById('withdrawalShortage').textContent = fmt(shortage) + ' ج.م';

  // تحديث العنوان حسب نوع المحفظة المختارة
  const walletLabels = {
    'cash': 'رصيد الكاش السائل:',
    'mobile_wallet': 'رصيد المحفظة الإلكترونية:',
    'bank': 'رصيد الحساب البنكي:'
  };
  const drawerBalanceLabel = document.querySelector('#drawerWithdrawalModal .withdrawal-info-item:nth-child(2) .withdrawal-info-label');
  if (drawerBalanceLabel) {
    drawerBalanceLabel.textContent = walletLabels[selectedWalletType] || 'رصيد المحفظة:';
  }

  // المبلغ المقترح للسحب
  const suggestedAmount = Math.ceil(shortage / 100) * 100;
  document.getElementById('withdrawalAmount').value = suggestedAmount;

  // تحميل رصيد الخزنة
  await loadMainSafeBalance();

  // التحقق إذا المستخدم مدير أو كاشير
  const isAdmin = await checkIfAdmin();
  const adminAuthSection = document.getElementById('withdrawalAdminAuth');
  if (isAdmin) {
    adminAuthSection.style.display = 'none';
  } else {
    adminAuthSection.style.display = 'block';
    document.getElementById('withdrawalAdminPassword').value = '';
  }

  // حفظ المتغيرات للاستخدام في تأكيد السحب
  withdrawalRequiredAmount = requiredAmount;
  withdrawalCurrentDrawer = currentBalance;
  withdrawalTargetWallet = 'cash';

  // تغيير معالج التأكيد ليستخدم المرتجع
  // الزر الأول في الـ modal هو زر التأكيد
  const confirmBtn = document.querySelector('#drawerWithdrawalModal button[onclick*="confirmDrawerWithdrawal"]');
  if (confirmBtn) {
    confirmBtn.onclick = confirmReturnWithdrawal;
  }

  // إظهار المودال
  document.getElementById('drawerWithdrawalModal').style.display = 'flex';
}

// تأكيد السحب من الخزنة ثم تنفيذ المرتجع
async function confirmReturnWithdrawal() {
  const amount = Number(document.getElementById('withdrawalAmount').value || 0);
  const adminPassword = document.getElementById('withdrawalAdminPassword').value;
  const adminAuthSection = document.getElementById('withdrawalAdminAuth');

  // التحقق من المبلغ
  if (amount <= 0) {
    showToast('الرجاء إدخال مبلغ صحيح', 'error');
    document.getElementById('withdrawalAmount').focus();
    return;
  }

  const shortage = withdrawalRequiredAmount - withdrawalCurrentDrawer;
  if (amount < shortage) {
    showToast(`المبلغ أقل من النقص المطلوب (${fmt(shortage)} ج.م)`, 'error');
    return;
  }

  // التحقق من باسورد المدير إذا لزم
  const needsAdminAuth = adminAuthSection.style.display !== 'none';
  if (needsAdminAuth && !adminPassword) {
    showToast('الرجاء إدخال باسورد المدير', 'error');
    document.getElementById('withdrawalAdminPassword').focus();
    return;
  }

  try {
    // سحب من الخزنة لدرج الكاش
    const res = await fetch('elos-db://safe-to-drawer-transfer', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        amount: amount,
        wallet_type: 'cash',
        admin_password: needsAdminAuth ? adminPassword : null,
        reason: `سحب لمرتجع فاتورة: ${pendingReturnData?.invoiceNumber}`
      })
    });

    if (!res.ok) {
      const errorText = await res.text();
      throw new Error(errorText);
    }

    // 🔧 إعادة معالج التأكيد قبل إغلاق المودال
    const confirmBtn = document.querySelector('#drawerWithdrawalModal .btn-primary');
    if (confirmBtn) {
      confirmBtn.onclick = confirmDrawerWithdrawal;
    }

    // إغلاق مودال السحب
    closeDrawerWithdrawalModal();

    showToast(`✅ تم إضافة ${fmt(amount)} ج.م للدرج`, 'success', 2000);

    // تنفيذ المرتجع بعد تأخير قصير
    if (pendingReturnData) {
      const returnData = { ...pendingReturnData }; // نسخة لتجنب null
      pendingReturnData = null;

      setTimeout(async () => {
        // تأكيد المرتجع
        const confirmed = await showConfirm(
          `تأكيد مرتجع من الفاتورة ${returnData.invoiceNumber}:\n\n` +
          `العناصر: ${returnData.itemsList}\n` +
          `المبلغ: ${fmt(returnData.totalRefund)} ج.م\n` +
          `إرجاع للمخزون: ${returnData.restock ? 'نعم' : 'لا'}`,
          'تنفيذ المرتجع',
          'إلغاء',
          'warning'
        );

        if (confirmed) {
          await executeInvoiceReturn(returnData);
        }
      }, 500);
    }

  } catch (error) {
    Logger.error('Return withdrawal error:', error);
    showToast('فشل السحب: ' + translateError(error.message), 'error');
  }
}

// تنفيذ المرتجع
async function executeInvoiceReturn(data) {
  UILoader.show('جاري تنفيذ المرتجع...', 'return');

  try {
    // Call return invoice API
    const res = await fetch('elos-db://return-invoice', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        invoice_number: data.invoiceNumber,
        items: data.items,
        reason: data.reason,
        return_all: false,
        restock: data.restock,
        wallet_type: data.walletType || 'cash', // للتوافق العكسي
        wallet_id: data.walletId || null, // ✅ المحفظة المحددة للخصم منها
        is_deferred_return: data.isDeferredReturn || false // ✅ مرتجع آجل - لا يخصم من المحفظة
      })
    });

    if (!res.ok) {
      throw new Error(await res.text());
    }

    const result = await res.json();

    // Close modal
    closeReturnModal();

    // Invalidate cache and refresh
    SmartCache.invalidate();
    await search();
    await searchAccessories();
    await loadCashDrawerData();
    await loadTodayCashPreview();

    // Notify other pages
    localStorage.setItem('pos_data_updated', Date.now().toString());

    // أسماء المحافظ
    const walletNames = {
      'cash': 'الكاش',
      'mobile_wallet': 'المحفظة الإلكترونية',
      'bank': 'البنك'
    };

    // Show success
    SoundFX.play('success');
    if (data.isDeferredReturn) {
      showToast(`✅ تم المرتجع بنجاح - ${result.items_returned || data.items.length} عنصر (مرتجع آجل - تم إزالة المديونية من العميل)`, 'success');
    } else {
      showToast(`✅ تم المرتجع بنجاح - ${result.items_returned || data.items.length} عنصر - ${fmt(result.total_refund || data.totalRefund)} ج.م (من ${walletNames[data.walletType] || 'الكاش'})`, 'success');
    }

  } catch (error) {
    Logger.error('Return error:', error);
    SoundFX.play('error');
    showToast('فشل عملية المرتجع: ' + translateError(error.message), 'error');
  } finally {
    UILoader.hide('return');
  }
}

// ═══════════════════════════════════════════════════════════════
// 🌐 MAKE FUNCTIONS AVAILABLE GLOBALLY
// ═══════════════════════════════════════════════════════════════
// Make payment wallet functions available globally
if (typeof window !== 'undefined') {
  window.selectPaymentMethod = selectPaymentMethod;
  window.updateReceiveClientWalletSelect = updateReceiveClientWalletSelect;
  window.updatePaySupplierWalletSelect = updatePaySupplierWalletSelect;
  window.updateTradeinRefundWalletSelect = updateTradeinRefundWalletSelect;
  window.updateTradeinRefundWalletSelectInline = updateTradeinRefundWalletSelectInline;
  window.confirmTradeinRefund = confirmTradeinRefund;
  window.closeTradeinRefundModal = closeTradeinRefundModal;
  window.openWalletDepositModalById = openWalletDepositModalById;
  window.openWalletWithdrawModalById = openWalletWithdrawModalById;
  window.openWalletTransferModal = openWalletTransferModal;
  window.openWalletHistoryModal = openWalletHistoryModal;
  window.closeWalletHistoryModal = closeWalletHistoryModal;
  window.updateTransferBalances = updateTransferBalances;
  window.setTransferAllAmount = setTransferAllAmount;
  window.confirmWalletTransfer = confirmWalletTransfer;
  window.closeWalletTransferModal = closeWalletTransferModal;
  window.openCashVerificationModal = openCashVerificationModal;
  window.closeCashVerificationModal = closeCashVerificationModal;
  window.confirmCashVerification = confirmCashVerification;
  window.updateVerificationDifference = updateVerificationDifference;
  // ✅ Sales History Modal functions - already defined directly on window above
}

// ═══════════════════════════════════════════════════════════════
// 🔗 HEADER BUTTONS EVENT LISTENERS
// ═══════════════════════════════════════════════════════════════

// Purchase button
document.getElementById('btnPurchase')?.addEventListener('click', openPurchaseModal);

// Return button (header)
document.getElementById('btnReturn')?.addEventListener('click', openReturnModal);

// Quick Return button (sidebar)
document.getElementById('btnQuickReturn')?.addEventListener('click', openReturnModal);

// Close modals on backdrop click
document.getElementById('purchaseModal')?.addEventListener('click', function(e) {
  if (e.target === this) closePurchaseModal();
});

document.getElementById('returnModal')?.addEventListener('click', function(e) {
  if (e.target === this) closeReturnModal();
});

document.getElementById('drawerWithdrawalModal')?.addEventListener('click', function(e) {
  if (e.target === this) closeDrawerWithdrawalModal();
});

// ✅ FIX: Escape handler محذوف - بيتم التعامل معاه من الـ handler الموحد (سطر 15125)

// ═══════════════════════════════════════════════════════════════
// 🔄 SYNC EVENT LISTENERS - v1.2.6 - Real-time updates (Tab-aware)
// ═══════════════════════════════════════════════════════════════

// Helper function to refresh current tab content only
async function refreshCurrentTabContent() {
  if (currentStore === 'accessories') {
    await searchAccessories();
  } else if (currentStore === 'repair_parts') {
    await searchRepairParts();
  } else {
    await search();
  }
}

// Listen for sync updates from other devices
window.addEventListener('elos-sync-update', async (event) => {
  const { tables } = event.detail || {};
  Logger.log('[POS-SYNC] 📥 Sync update received:', tables, '| Current tab:', currentStore);

  if (!tables || !Array.isArray(tables)) return;

  // Invalidate cache first
  SmartCache.invalidate();

  // Only refresh the content for the CURRENT tab to avoid confusion
  const needsDeviceRefresh = tables.includes('devices') || tables.includes('inventory_transactions');
  const needsAccessoryRefresh = tables.includes('accessories') || tables.includes('accessory_movements');
  const needsRepairPartsRefresh = tables.includes('repair_parts') || tables.includes('repair_parts_movements');

  // Refresh only if the current tab's data changed
  if (currentStore === 'devices' && needsDeviceRefresh) {
    Logger.log('[POS-SYNC] 🔄 Refreshing devices (current tab)...');
    await search();
  } else if (currentStore === 'accessories' && needsAccessoryRefresh) {
    Logger.log('[POS-SYNC] 🔄 Refreshing accessories (current tab)...');
    await searchAccessories();
  } else if (currentStore === 'repair_parts' && needsRepairPartsRefresh) {
    Logger.log('[POS-SYNC] 🔄 Refreshing repair parts (current tab)...');
    await searchRepairParts();
  }

  // Update tab badges silently (without changing displayed content)
  if (needsAccessoryRefresh) {
    loadAccessoriesCount();
  }
  if (needsRepairPartsRefresh) {
    loadRepairPartsCount();
  }

  // Update cash drawer if sales changed (but only for current user)
  if (tables.includes('sales')) {
    Logger.log('[POS-SYNC] 🔄 Refreshing cash drawer...');
    await loadCashDrawerData();
    await loadTodayCashPreview();
  }
});

// Listen for manual refresh events
window.addEventListener('elos-refresh-data', async (event) => {
  const { tables } = event.detail || {};
  Logger.log('[POS-SYNC] 🔄 Manual refresh requested:', tables, '| Current tab:', currentStore);

  // Invalidate cache
  SmartCache.invalidate();

  // Refresh current tab content only
  await refreshCurrentTabContent();

  // Update cash drawer if sales changed
  if (!tables || tables.includes('sales')) {
    await loadCashDrawerData();
    await loadTodayCashPreview();
  }
});

// Expose search function globally for sync-client.js
window.refreshPOSData = async function() {
  Logger.log('[POS-SYNC] 🔄 Full POS refresh... | Current tab:', currentStore);
  SmartCache.invalidate();

  // Refresh only current tab content (not all tabs)
  await refreshCurrentTabContent();

  // Update badges for other tabs silently
  loadAccessoriesCount();
  loadRepairPartsCount();

  await loadCashDrawerData();
  await loadTodayCashPreview();
};