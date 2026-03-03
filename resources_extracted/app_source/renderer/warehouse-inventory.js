// ═══════════════════════════════════════════════════════════════
// 🎯 ELOS WAREHOUSE INVENTORY SYSTEM (Dynamic)
// ═══════════════════════════════════════════════════════════════

// Fallbacks if utils.js not loaded yet
if (!window.Logger) window.Logger = { log: () => {}, warn: () => {}, error: console.error, debug: () => {}, info: () => {} };
if (!window.fmt) window.fmt = (n, decimals = 2) => Number(n || 0).toLocaleString('en-US', { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
if (!window.escapeHtml) window.escapeHtml = (text) => { if (text === null || text === undefined) return ''; const div = document.createElement('div'); div.textContent = String(text); return div.innerHTML; };
const fmt = window.fmt;
const escapeHtml = window.escapeHtml;

// ═════════════════════════════════════
// 🏭 WAREHOUSE DETECTION - Single Source of Truth
// ═════════════════════════════════════
// PART A: Determine effective warehouseId (URL first, then localStorage fallback)
const urlParams = new URLSearchParams(window.location.search);
const urlWid = urlParams.get('warehouse_id') || urlParams.get('id');
const savedWid = localStorage.getItem('currentWarehouseId');

// Parse and validate
let effectiveWarehouseId = null;

// Priority 1: URL parameter (single source of truth on first load)
if (urlWid) {
  const parsedUrlWid = parseInt(urlWid);
  if (!isNaN(parsedUrlWid) && parsedUrlWid > 0) {
    effectiveWarehouseId = parsedUrlWid;
    Logger.log('[WAREHOUSE] Using warehouse_id from URL:', effectiveWarehouseId);
  }
}

// Priority 2: Fallback to localStorage ONLY if URL is missing AND saved value is valid
if (!effectiveWarehouseId && savedWid) {
  const parsedSavedWid = parseInt(savedWid);
  // Validate: not null, not undefined, not "null", not "", and is a valid number
  if (!isNaN(parsedSavedWid) && parsedSavedWid > 0 && savedWid !== 'null' && savedWid !== '') {
    effectiveWarehouseId = parsedSavedWid;
    Logger.log('[WAREHOUSE] Using saved warehouse ID from localStorage:', effectiveWarehouseId);
  }
}

// Log the decision
console.log('[WAREHOUSE] Effective warehouseId:', effectiveWarehouseId, 'urlWid:', urlWid, 'saved:', savedWid);

// If still no valid warehouse ID, redirect
if (!effectiveWarehouseId) {
  Logger.error('[WAREHOUSE] No valid warehouse_id found in URL or localStorage!');
  if (typeof showToast === 'function') {
    showToast('خطأ: لم يتم تحديد المخزن', 'error', 2000);
  }
  setTimeout(() => {
    window.location.href = 'warehouses.html';
  }, 500);
} else {
  // Immediately persist to localStorage (single source of truth)
  localStorage.setItem('currentWarehouseId', effectiveWarehouseId.toString());
  Logger.log('[WAREHOUSE] ✅ Warehouse ID set and persisted:', effectiveWarehouseId);
}

// Set as constant for use throughout the file
// Normalize to number and validate
const CURRENT_WAREHOUSE_ID = effectiveWarehouseId ? Number(effectiveWarehouseId) : null;

// Final validation guard
if (CURRENT_WAREHOUSE_ID && (!Number.isFinite(CURRENT_WAREHOUSE_ID) || CURRENT_WAREHOUSE_ID <= 0)) {
  console.error('[WAREHOUSE] Invalid CURRENT_WAREHOUSE_ID after normalization:', CURRENT_WAREHOUSE_ID);
  Logger.error('[WAREHOUSE] Invalid warehouse ID after normalization');
}

// ═════════════════════════════════════
// 🌐 GLOBAL STATE
// ═════════════════════════════════════
let allAccessories = [];
let allSuppliers = [];
let tableColumns = []; // Column definitions from meta endpoint

// ═════════════════════════════════════
// 💾 CACHING SYSTEM (Improved with LRU and auto-cleanup)
// ═════════════════════════════════════
const AccessoryCache = {
  _cache: new Map(),
  _maxSize: 50,
  _ttl: 60000, // 60 seconds TTL
  _cleanupInterval: null,

  getCacheKey() {
    const search = document.getElementById('qSearch')?.value.trim() || '';
    const condition = document.getElementById('fCondition')?.value || '';
    const category = document.getElementById('fCategory')?.value || '';
    const brand = document.getElementById('fBrand')?.value || '';
    const status = document.getElementById('fStatus')?.value || '';
    const quantity = document.getElementById('fQuantity')?.value || '';
    const page = currentPage || 1;
    const sort = sortColumn || '';
    const sortDir = sortDirection || '';
    return `${CURRENT_WAREHOUSE_ID}_${search}_${condition}_${category}_${brand}_${status}_${quantity}_${page}_${sort}_${sortDir}`;
  },

  set(type, value) {
    const key = `${type}_${this.getCacheKey()}`;

    // LRU eviction if cache is full
    if (this._cache.size >= this._maxSize) {
      const oldestKey = this._cache.keys().next().value;
      this._cache.delete(oldestKey);
    }

    this._cache.set(key, {
      value: value,
      timestamp: Date.now()
    });
  },

  get(type) {
    const key = `${type}_${this.getCacheKey()}`;
    const cached = this._cache.get(key);

    if (!cached) return null;

    const age = Date.now() - cached.timestamp;
    if (age > this._ttl) {
      this._cache.delete(key);
      return null;
    }

    // Move to end (most recently used)
    this._cache.delete(key);
    this._cache.set(key, cached);

    return cached.value;
  },

  clear() {
    this._cache.clear();
  },

  // Auto cleanup expired entries
  startCleanup() {
    if (this._cleanupInterval) return;
    this._cleanupInterval = setInterval(() => {
      const now = Date.now();
      for (const [key, entry] of this._cache) {
        if (now - entry.timestamp > this._ttl) {
          this._cache.delete(key);
        }
      }
    }, 30000); // cleanup every 30 seconds
  },

  stopCleanup() {
    if (this._cleanupInterval) {
      clearInterval(this._cleanupInterval);
      this._cleanupInterval = null;
    }
  }
};

// Start cache cleanup on load
AccessoryCache.startCleanup();

// ═════════════════════════════════════
// 🛠️ UTILITIES
// ═════════════════════════════════════
// fmt() is now imported from utils.js (window.fmt)

// Debounce function
function debounce(func, delay = 300) {
  let timeoutId;
  return function (...args) {
    clearTimeout(timeoutId);
    timeoutId = setTimeout(() => func.apply(this, args), delay);
  };
}

// ═════════════════════════════════════
// 🔄 SORTING STATE
// ═════════════════════════════════════
let sortColumn = null;
let sortDirection = 'asc';

// ═════════════════════════════════════
// 📄 PAGINATION STATE
// ═════════════════════════════════════
let currentPage = 1;
let rowsPerPage = 50;
let viewingAll = false;
let totalAccessories = 0;

// ═════════════════════════════════════
// 🔔 TOAST NOTIFICATION SYSTEM
// ═════════════════════════════════════
function createToastContainer() {
  if (document.getElementById('toast-container')) return;
  const container = document.createElement('div');
  container.id = 'toast-container';
  container.style.cssText = `
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
  document.body.appendChild(container);
}

let activeToasts = new Map();
const MAX_TOASTS = 3;

function showToast(message, type = 'info', duration = 3000) {
  createToastContainer();
  
  if (activeToasts.has(message)) {
    return;
  }
  
  const container = document.getElementById('toast-container');
  
  if (container.children.length >= MAX_TOASTS) {
    const oldest = container.firstChild;
    if (oldest) {
      oldest.remove();
      for (let [key, value] of activeToasts) {
        if (value === oldest) {
          activeToasts.delete(key);
          break;
        }
      }
    }
  }
  
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
      min-width: 300px;
      max-width: 500px;
      pointer-events: auto;
      animation: toastSlideIn 0.5s cubic-bezier(0.34, 1.56, 0.64, 1);
      font-family: system-ui, 'Cairo', sans-serif;
      font-size: 14px;
      font-weight: 500;
      backdrop-filter: blur(10px);
    ">
      <span style="font-size: 20px; animation: iconBounce 0.6s cubic-bezier(0.34, 1.56, 0.64, 1);">${icons[type]}</span>
      <span style="flex: 1;">${message}</span>
    </div>
  `;
  
  if (!document.getElementById('toast-animations')) {
    const style = document.createElement('style');
    style.id = 'toast-animations';
    style.textContent = `
      @keyframes toastSlideIn {
        from { 
          opacity: 0; 
          transform: translateX(100px) scale(0.8);
        }
        to { 
          opacity: 1; 
          transform: translateX(0) scale(1);
        }
      }
      @keyframes toastSlideOut {
        from { 
          opacity: 1; 
          transform: translateX(0) scale(1);
        }
        to { 
          opacity: 0; 
          transform: translateX(-100px) scale(0.8);
        }
      }
      @keyframes iconBounce {
        0%, 100% { transform: scale(1); }
        50% { transform: scale(1.2); }
      }
    `;
    document.head.appendChild(style);
  }
  
  container.appendChild(toast);
  activeToasts.set(message, toast);
  
  setTimeout(() => {
    const toastElement = toast.firstElementChild;
    if (toastElement && toastElement.style) {
      toastElement.style.animation = 'toastSlideOut 0.3s ease-out forwards';
    }
    setTimeout(() => {
      toast.remove();
      activeToasts.delete(message);
    }, 300);
  }, duration);
}

// ═════════════════════════════════════
// 🗄️ DATABASE WRAPPER - Using REST API
// ═════════════════════════════════════
async function dbFetch(endpoint, options = {}) {
  try {
    Logger.log('[DB] Fetching:', endpoint);
    const response = await fetch(`elos-db://${endpoint}`, options);
    
    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Database error: ${response.status} - ${errorText}`);
    }
    
    const data = await response.json();
    Logger.log('[DB] Fetch successful');
    return data;
  } catch (error) {
    Logger.error('[DB] Fetch failed:', error);
    showToast('❌ فشل الاتصال بقاعدة البيانات', 'error');
    throw error;
  }
}

// ═════════════════════════════════════
// 📊 LOAD STATISTICS
// ═════════════════════════════════════
async function loadStats() {
  try {
    Logger.log('[STATS] Loading statistics...');
    
    // Check cache first
    const cached = AccessoryCache.get('stats');
    if (cached) {
      Logger.log('[STATS] Using cached statistics');
      updateStatsUI(cached);
      return cached;
    }
    
    // Get current warehouse ID and validate
    const warehouseId = CURRENT_WAREHOUSE_ID;
    const normalizedWarehouseId = Number(warehouseId);
    
    if (!warehouseId || !Number.isFinite(normalizedWarehouseId) || normalizedWarehouseId <= 0) {
      console.error('[STATS] Invalid warehouseId:', warehouseId, 'normalized:', normalizedWarehouseId);
      Logger.warn('[STATS] No valid warehouse ID found');
      return null;
    }
    
    // Fetch all accessories from API
    const data = await dbFetch('accessories');
    const accessories = data.accessories || [];
    
    // Filter by warehouse_id and calculate stats (normalize types for comparison)
    const warehouseAccessories = accessories.filter(acc => Number(acc.warehouse_id) === normalizedWarehouseId);
    
    const stats = {
      total: warehouseAccessories.length,
      available: warehouseAccessories.filter(acc => acc.status === 'متاح').reduce((sum, acc) => sum + (acc.quantity || 0), 0),
      total_value: warehouseAccessories.reduce((sum, acc) => sum + ((acc.quantity || 0) * (acc.purchase_price || 0)), 0)
    };
    
    Logger.log('[STATS] Statistics loaded:', stats);
    
    // Cache the result
    AccessoryCache.set('stats', stats);
    
    // Update UI
    updateStatsUI(stats);
    
    return stats;
  } catch (error) {
    Logger.error('[STATS] Failed to load statistics:', error);
    return null;
  }
}

function updateStatsUI(stats) {
  const statValues = document.querySelectorAll('#headerStats .stat-value');
  
  if (statValues[0]) {
    statValues[0].textContent = stats.total || 0;
    statValues[0].classList.remove('loading');
    statValues[0].classList.add('loaded');
  }
  
  if (statValues[1]) {
    statValues[1].textContent = stats.available || 0;
    statValues[1].classList.remove('loading');
    statValues[1].classList.add('loaded');
  }
  
  if (statValues[2]) {
    statValues[2].textContent = fmt(stats.total_value || 0);
    statValues[2].classList.remove('loading');
    statValues[2].classList.add('loaded');
  }
}

// ═════════════════════════════════════
// 📦 LOAD ACCESSORIES (Server-side Pagination & Filtering)
// ═════════════════════════════════════
async function loadAccessories() {
  try {
    console.log('[ACCESSORIES] ====== loadAccessories() CALLED ======');
    Logger.log('[ACCESSORIES] Loading accessories with server-side filtering...');

    const tbody = document.getElementById('accessoriesTableBody');

    // Show skeleton loading instead of simple spinner
    tbody.innerHTML = generateSkeletonRows(10);

    // Get warehouse ID and validate
    const warehouseId = CURRENT_WAREHOUSE_ID;
    const normalizedWarehouseId = Number(warehouseId);

    if (!warehouseId || !Number.isFinite(normalizedWarehouseId) || normalizedWarehouseId <= 0) {
      console.error('[ACCESSORIES] Invalid warehouseId:', warehouseId, 'normalized:', normalizedWarehouseId);
      tbody.innerHTML = '<tr><td colspan="6" style="text-align: center; padding: 40px; color: #ef4444;">❌ لم يتم تحديد مخزن</td></tr>';
      return;
    }

    // Check cache first
    const cachedData = AccessoryCache.get('accessories');
    if (cachedData) {
      Logger.log('[ACCESSORIES] Using cached data');
      renderAccessoriesTable(cachedData.accessories);
      totalAccessories = cachedData.pagination.total;
      updatePaginationUI(cachedData.pagination);
      if (cachedData.stats) updateStatsFromAPI(cachedData.stats);
      if (cachedData.filter_options) updateFilterDropdowns(cachedData.filter_options);
      return;
    }

    // Build query parameters for server-side filtering
    const params = new URLSearchParams();
    params.append('warehouse_id', normalizedWarehouseId.toString());
    params.append('page', currentPage);
    params.append('limit', viewingAll ? 1000 : rowsPerPage);

    // Add filters
    const search = document.getElementById('qSearch')?.value.trim() || '';
    if (search) params.append('search', search);

    const condition = document.getElementById('fCondition')?.value || '';
    if (condition) params.append('condition', condition);

    const category = document.getElementById('fCategory')?.value || '';
    if (category) params.append('category', category);

    const brand = document.getElementById('fBrand')?.value || '';
    if (brand) params.append('brand', brand);

    const status = document.getElementById('fStatus')?.value || '';
    if (status) params.append('status', status);

    const quantity = document.getElementById('fQuantity')?.value || '';
    if (quantity) params.append('quantity_filter', quantity);

    // Add sorting
    if (sortColumn) {
      params.append('sort_by', sortColumn);
      params.append('sort_dir', sortDirection);
    }

    // Request filter options on first load
    if (!filterOptionsLoaded) {
      params.append('include_filter_options', 'true');
    }

    console.log('[ACCESSORIES] Fetching with params:', params.toString());
    Logger.log('[ACCESSORIES] Fetching with params:', params.toString());

    // Fetch from server
    const data = await dbFetch(`accessories?${params.toString()}`);

    console.log('[ACCESSORIES] Server response:', data);

    // Handle both response formats: array directly or object with accessories property
    let accessories = [];
    let pagination = null;
    let stats = null;
    let filterOptions = null;

    if (Array.isArray(data)) {
      // Old format: API returns array directly
      console.log('[ACCESSORIES] Response is array format, count:', data.length);
      accessories = data;
      pagination = { total: data.length, page: 1, limit: data.length, total_pages: 1 };
    } else if (data && typeof data === 'object') {
      // New format: API returns object with accessories, pagination, stats
      console.log('[ACCESSORIES] Response is object format, count:', data.accessories?.length);
      accessories = data.accessories || [];
      pagination = data.pagination || { total: accessories.length, page: 1, limit: accessories.length, total_pages: 1 };
      stats = data.stats;
      filterOptions = data.filter_options;
    }

    console.log('[ACCESSORIES] Processed:', accessories.length, 'accessories');

    // Cache the response
    AccessoryCache.set('accessories', { accessories, pagination, stats, filter_options: filterOptions });

    // Update global state for other functions
    allAccessories = accessories;
    totalAccessories = pagination?.total || accessories.length;

    // Update stats from server response
    if (stats) {
      updateStatsFromAPI(stats);
    }

    // Update filter dropdowns from server response
    if (filterOptions) {
      updateFilterDropdowns(filterOptions);
      filterOptionsLoaded = true;
    }

    // Render table
    renderAccessoriesTable(accessories);

    // Update pagination
    updatePaginationUI(pagination);

  } catch (error) {
    Logger.error('[ACCESSORIES] Failed to load:', error);
    const tbody = document.getElementById('accessoriesTableBody');
    if (tbody) {
      tbody.innerHTML = '<tr><td colspan="6" style="text-align: center; padding: 40px; color: #ef4444;">❌ فشل تحميل البيانات</td></tr>';
    }
  }
}

// Flag to track if filter options have been loaded
let filterOptionsLoaded = false;

// ═════════════════════════════════════
// 🎨 SKELETON LOADING
// ═════════════════════════════════════
function generateSkeletonRows(count = 10) {
  // 6 columns: الاسم | الفئة | الباركود | سعر الشراء | سعر البيع | إجراءات
  const skeletonRow = `
    <tr class="skeleton-row">
      <td><div class="skeleton-cell" style="width: 150px;"></div></td>
      <td><div class="skeleton-cell" style="width: 80px; margin: 0 auto;"></div></td>
      <td><div class="skeleton-cell" style="width: 70px; margin: 0 auto;"></div></td>
      <td><div class="skeleton-cell" style="width: 70px; margin: 0 auto;"></div></td>
      <td><div class="skeleton-cell" style="width: 70px; margin: 0 auto;"></div></td>
      <td><div class="skeleton-cell" style="width: 100px; margin: 0 auto;"></div></td>
    </tr>
  `;

  // Add skeleton styles if not exists
  if (!document.getElementById('skeleton-styles')) {
    const style = document.createElement('style');
    style.id = 'skeleton-styles';
    style.textContent = `
      .skeleton-row td {
        padding: 12px 10px;
      }
      .skeleton-cell {
        height: 20px;
        background: linear-gradient(90deg, var(--bg-tertiary) 25%, rgba(59,130,246,0.1) 50%, var(--bg-tertiary) 75%);
        background-size: 200% 100%;
        animation: skeleton-shimmer 1.5s infinite;
        border-radius: 4px;
      }
      @keyframes skeleton-shimmer {
        0% { background-position: 200% 0; }
        100% { background-position: -200% 0; }
      }
    `;
    document.head.appendChild(style);
  }

  return Array(count).fill(skeletonRow).join('');
}

// ═════════════════════════════════════
// 📊 UPDATE STATS FROM API RESPONSE
// ═════════════════════════════════════
function updateStatsFromAPI(stats) {
  if (!stats) return;

  const statValues = document.querySelectorAll('#headerStats .stat-value');

  if (statValues[0]) {
    statValues[0].textContent = stats.total_items || 0;
    statValues[0].classList.remove('loading');
    statValues[0].classList.add('loaded');
  }

  if (statValues[1]) {
    statValues[1].textContent = stats.available_qty || 0;
    statValues[1].classList.remove('loading');
    statValues[1].classList.add('loaded');
  }

  if (statValues[2]) {
    statValues[2].textContent = fmt(stats.total_value || 0);
    statValues[2].classList.remove('loading');
    statValues[2].classList.add('loaded');
  }

  // Update sidebar stats
  const totalEl = document.getElementById('sidebarTotalItems');
  const lowEl = document.getElementById('sidebarLowStock');
  const outEl = document.getElementById('sidebarOutOfStock');

  if (totalEl) totalEl.textContent = stats.total_items || 0;
  if (lowEl) lowEl.textContent = stats.low_stock_count || 0;
  if (outEl) outEl.textContent = stats.out_of_stock_count || 0;
}

// ═════════════════════════════════════
// 🔽 UPDATE FILTER DROPDOWNS FROM API
// ═════════════════════════════════════
function updateFilterDropdowns(filterOptions) {
  if (!filterOptions) return;

  // Update categories dropdown
  const categorySelect = document.getElementById('fCategory');
  if (categorySelect && filterOptions.categories) {
    const currentValue = categorySelect.value;
    categorySelect.innerHTML = '<option value="">الكل</option>' +
      filterOptions.categories.map(c => `<option value="${c}"${c === currentValue ? ' selected' : ''}>${c}</option>`).join('');
  }

  // Update brands dropdown
  const brandSelect = document.getElementById('fBrand');
  if (brandSelect && filterOptions.brands) {
    const currentValue = brandSelect.value;
    brandSelect.innerHTML = '<option value="">الكل</option>' +
      filterOptions.brands.map(b => `<option value="${b}"${b === currentValue ? ' selected' : ''}>${b}</option>`).join('');
  }

  Logger.log('[FILTERS] Dropdowns updated from server');
}

// ═════════════════════════════════════
// 📋 RENDER ACCESSORIES TABLE (with Quick Edit)
// ═════════════════════════════════════
// 📊 RENDER ACCESSORIES TABLE (Dynamic Columns)
// ═════════════════════════════════════
function renderAccessoriesTable(accessories) {
  const tbody = document.getElementById('accessoriesTableBody');

  if (!accessories || accessories.length === 0) {
    tbody.innerHTML = '<tr><td colspan="6" style="text-align: center; padding: 40px; color: #8b93a6;">📦 لا توجد أكسسوارات</td></tr>';
    return;
  }

  // Add quick edit styles if not exists
  addQuickEditStyles();

  // Use tableColumns directly - same order as header
  const dataColumns = [...tableColumns];
  const startTime = performance.now();

  console.log('[RENDER] Rendering rows with', dataColumns.length, 'data columns + actions');

  tbody.innerHTML = accessories.map(acc => {
    const isSelected = selectedItems.has(acc.id);
    let rowHtml = `<tr data-id="${acc.id}" class="accessory-row${isSelected ? ' selected-row' : ''}">`;

    // Data columns first (same order as header)
    dataColumns.forEach(col => {
      const value = acc[col.key];
      const alignStyle = col.key === 'name' ? 'text-align: right;' : 'text-align: center;';

      let cellContent = '';

      switch (col.type) {
        case 'id':
        case 'number':
          cellContent = `<span style="font-weight: 700; color: var(--accent);">#${value || acc.id}</span>`;
          break;

        case 'text':
          if (col.key === 'name') {
            cellContent = `
              <div style="display: flex; flex-direction: column; gap: 4px; align-items: flex-end;">
                <span style="font-weight: 600; color: var(--text-primary);">${escapeHtml(value || '-')}</span>
                ${acc.location ? `<span style="font-size: 10px; color: var(--text-secondary);">📍 ${escapeHtml(acc.location)}</span>` : ''}
              </div>
            `;
          } else {
            cellContent = `<span style="font-weight: 500; color: var(--text-primary);">${escapeHtml(value || '-')}</span>`;
          }
          break;

        case 'mono':
          cellContent = `<span style="font-family: monospace; color: var(--text-secondary); font-size: 12px;">${escapeHtml(value || acc.code || acc.sku || '-')}</span>`;
          break;

        case 'currency':
          const price = value || 0;
          if (col.key === 'sale_price') {
            const purchasePrice = acc.purchase_price || 0;
            const profitMargin = purchasePrice > 0 ? ((price - purchasePrice) / purchasePrice * 100).toFixed(1) : 0;
            cellContent = `
              <div style="display: flex; flex-direction: column; gap: 2px; align-items: center;">
                <span style="font-family: monospace; font-weight: 600; color: var(--success);">${fmt(price)} ج.م</span>
                ${profitMargin > 0 ? `<span style="font-size: 9px; color: ${profitMargin > 20 ? 'var(--success)' : profitMargin > 10 ? 'var(--warning)' : 'var(--danger)'};">ربح: ${profitMargin}%</span>` : ''}
              </div>
            `;
          } else {
            cellContent = `<span style="font-family: monospace;">${fmt(price)} ج.م</span>`;
          }
          break;

        case 'qty':
          const quantity = value || 0;
          const minStock = acc.min_stock || 5;
          const quantityColor = quantity === 0
            ? 'var(--danger)'
            : quantity <= minStock
              ? 'var(--warning)'
              : 'var(--success)';
          const quantityIcon = quantity === 0
            ? ' ❌'
            : quantity <= minStock
              ? ' ⚠️'
              : '';
          cellContent = `
            <div style="display: flex; flex-direction: column; gap: 2px; align-items: center;">
              <span style="font-weight: 700; color: ${quantityColor};">
                ${quantity}${quantityIcon}
              </span>
              ${quantity <= minStock && quantity > 0 ? `<span style="font-size: 9px; color: var(--text-secondary);">الحد الأدنى: ${minStock}</span>` : ''}
            </div>
          `;
          break;

        case 'badge':
          if (col.key === 'category') {
            cellContent = value && value !== '-'
              ? `<span class="badge badge-info" style="font-size: 11px; padding: 4px 8px;">${escapeHtml(value)}</span>`
              : '<span style="color: var(--text-secondary);">-</span>';
          } else if (col.key === 'condition') {
            const condition = value || 'جديد';
            cellContent = condition === 'جديد'
              ? `<span class="badge badge-new" style="font-size: 11px; padding: 4px 8px;">🆕 جديد</span>`
              : `<span class="badge badge-used" style="font-size: 11px; padding: 4px 8px;">♻️ مستعمل</span>`;
          } else if (col.key === 'status') {
            const status = value || 'متاح';
            cellContent = status === 'متاح'
              ? '<span class="badge badge-available">✅ متاح</span>'
              : status === 'محجوز'
                ? '<span class="badge badge-reserved">🔒 محجوز</span>'
                : '<span class="badge badge-sold">❌ مباع</span>';
          } else {
            cellContent = `<span class="badge">${escapeHtml(value || '-')}</span>`;
          }
          break;

        default:
          cellContent = escapeHtml(value || '-');
      }

      rowHtml += `<td data-col="${col.key}" style="${alignStyle}">${cellContent}</td>`;
    });

    // Actions column last (appears leftmost in RTL)
    rowHtml += `
      <td class="actions-column" style="text-align: center;">
        <div class="actions">
          <button class="action-btn action-view" onclick="viewAccessoryDetails(${acc.id})" title="عرض التفاصيل">👁️</button>
          <button class="action-btn action-edit" onclick="openEditModal(${acc.id})" title="تعديل">✏️</button>
          <button class="action-btn action-print" onclick="openPrintBarcodeModal(${acc.id})" title="طباعة الباركود">🖨️</button>
          <button class="action-btn action-delete" onclick="deleteAccessory(${acc.id})" title="حذف">🗑️</button>
        </div>
      </td>
    `;

    rowHtml += '</tr>';

    // DEBUG: Count TDs in this row
    const tdCount = (rowHtml.match(/<td/g) || []).length;
    if (acc === accessories[0]) {
      console.log('[ROW DEBUG] First row TD count:', tdCount, 'Expected:', dataColumns.length + 1);
      console.log('[ROW DEBUG] Data columns:', dataColumns.map(c => c.key));
      // Print the order of data-col values
      const colOrder = [...rowHtml.matchAll(/data-col="([^"]+)"/g)].map(m => m[1]);
      console.log('[ROW DEBUG] TD data-col order:', colOrder);
      console.log('[ROW DEBUG] First row HTML snippet:', rowHtml.substring(0, 500));
    }

    return rowHtml;
  }).join('');
  
  const renderTime = performance.now() - startTime;
  Logger.log(`[RENDER] Table rendered in ${renderTime.toFixed(2)}ms`);

  // DEBUG: Check actual widths after render
  setTimeout(() => {
    const table = document.getElementById('accessoriesTable');
    const container = table?.closest('.table-container');
    const contentArea = document.querySelector('.content-area');

    if (table && container) {
      const tableRect = table.getBoundingClientRect();
      const containerRect = container.getBoundingClientRect();
      const contentRect = contentArea?.getBoundingClientRect();

      console.log('[WIDTH DEBUG] ═══════════════════════════════════════');
      console.log('[WIDTH DEBUG] Content Area:', contentRect?.width, 'px');
      console.log('[WIDTH DEBUG] Container:', containerRect.width, 'px');
      console.log('[WIDTH DEBUG] Table:', tableRect.width, 'px');
      console.log('[WIDTH DEBUG] Table computedStyle width:', getComputedStyle(table).width);
      console.log('[WIDTH DEBUG] Table computedStyle tableLayout:', getComputedStyle(table).tableLayout);
      console.log('[WIDTH DEBUG] Gap (Container - Table):', (containerRect.width - tableRect.width).toFixed(2), 'px');

      // Check each column width
      const ths = table.querySelectorAll('thead th');
      const tbodyFirstRow = table.querySelector('tbody tr');
      const firstRowTds = tbodyFirstRow?.querySelectorAll('td');

      console.log('[WIDTH DEBUG] Column widths (TH):');
      ths.forEach((th, i) => {
        console.log(`  [${i}] ${th.dataset.column || th.textContent.trim()}: ${th.getBoundingClientRect().width.toFixed(1)}px`);
      });
      if (firstRowTds) {
        console.log('[WIDTH DEBUG] Column widths (TD):');
        firstRowTds.forEach((td, i) => {
          console.log(`  [${i}] ${td.dataset.col || 'actions'}: ${td.getBoundingClientRect().width.toFixed(1)}px, style.width="${td.style.width}"`);
        });
      }

      // Check if there's a colspan issue or wrong row
      if (tbodyFirstRow) {
        const colspanTd = tbodyFirstRow.querySelector('td[colspan]');
        if (colspanTd) {
          console.log('[WIDTH DEBUG] ⚠️ FOUND COLSPAN TD:', colspanTd.getAttribute('colspan'));
        }
        console.log('[WIDTH DEBUG] First row class:', tbodyFirstRow.className);
        console.log('[WIDTH DEBUG] First row data-id:', tbodyFirstRow.dataset.id);

        // Print full row HTML
        console.log('[WIDTH DEBUG] FULL ROW HTML:');
        console.log(tbodyFirstRow.outerHTML);
      }

      // Check THEAD HTML too
      const theadRow = table.querySelector('thead tr');
      if (theadRow) {
        console.log('[WIDTH DEBUG] THEAD children count:', theadRow.children.length);
        console.log('[WIDTH DEBUG] THEAD ROW HTML:');
        console.log(theadRow.outerHTML);

        // Debug each TH element individually
        console.log('[WIDTH DEBUG] TH elements details:');
        Array.from(theadRow.children).forEach((child, i) => {
          console.log(`  TH[${i}]: tagName=${child.tagName}, text="${child.textContent.trim()}", width=${child.getBoundingClientRect().width.toFixed(1)}px`);
        });
      }

      // Also check if there's any hidden element
      const allTableChildren = table.querySelectorAll('*');
      const hiddenElements = Array.from(allTableChildren).filter(el => {
        const style = getComputedStyle(el);
        return style.display === 'none' || style.visibility === 'hidden';
      });
      if (hiddenElements.length > 0) {
        console.log('[WIDTH DEBUG] Hidden elements in table:', hiddenElements.length);
      }

      console.log('[WIDTH DEBUG] ═══════════════════════════════════════');
    }
  }, 100);

  // Restore selection state and update UI
  updateSelectAllCheckbox();
  updateSelectionUI();

  // Attach quick edit handlers
  attachQuickEditHandlers();
}

// ═════════════════════════════════════
// ⚡ QUICK EDIT SYSTEM
// ═════════════════════════════════════
function addQuickEditStyles() {
  if (document.getElementById('quick-edit-styles')) return;

  const style = document.createElement('style');
  style.id = 'quick-edit-styles';
  style.textContent = `
    .quick-edit-cell {
      position: relative;
      cursor: pointer;
      display: flex;
      align-items: center;
      gap: 4px;
      padding: 4px 8px;
      border-radius: 6px;
      transition: all 0.2s ease;
    }
    .quick-edit-cell:hover {
      background: rgba(59,130,246,0.1);
    }
    .quick-edit-icon {
      opacity: 0;
      font-size: 10px;
      transition: opacity 0.2s ease;
      margin-right: 4px;
    }
    .quick-edit-cell:hover .quick-edit-icon {
      opacity: 0.7;
    }
    .quick-edit-cell.editing {
      background: rgba(59,130,246,0.15);
      padding: 2px 4px;
    }
    .quick-edit-input {
      width: 80px;
      padding: 6px 8px;
      background: var(--bg-tertiary);
      border: 2px solid var(--accent);
      border-radius: 6px;
      color: var(--text-primary);
      font-family: monospace;
      font-size: 13px;
      font-weight: 600;
      text-align: center;
      outline: none;
    }
    .quick-edit-input:focus {
      box-shadow: 0 0 0 3px rgba(59,130,246,0.2);
    }
    .quick-edit-actions {
      display: flex;
      gap: 4px;
      margin-right: 4px;
    }
    .quick-edit-btn {
      padding: 4px 8px;
      border: none;
      border-radius: 4px;
      cursor: pointer;
      font-size: 12px;
      transition: all 0.15s ease;
    }
    .quick-edit-save {
      background: var(--success);
      color: white;
    }
    .quick-edit-save:hover {
      transform: scale(1.1);
    }
    .quick-edit-cancel {
      background: var(--bg-tertiary);
      color: var(--text-secondary);
    }
    .quick-edit-cancel:hover {
      background: var(--danger);
      color: white;
    }
    .currency-suffix {
      font-size: 11px;
      color: var(--text-secondary);
      margin-right: 2px;
    }
    .low-stock-icon {
      margin-right: 4px;
    }
  `;
  document.head.appendChild(style);
}

function attachQuickEditHandlers() {
  document.querySelectorAll('.quick-edit-cell').forEach(cell => {
    cell.addEventListener('click', function(e) {
      // Don't trigger if clicking on input or buttons
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'BUTTON') return;

      const id = this.dataset.id;
      const field = this.dataset.field;
      const currentValue = this.dataset.value;

      // Check if already editing
      if (this.classList.contains('editing')) return;

      // Close any other open editors
      document.querySelectorAll('.quick-edit-cell.editing').forEach(other => {
        if (other !== this) closeQuickEdit(other);
      });

      // Open editor
      openQuickEdit(this, id, field, currentValue);
    });
  });
}

function openQuickEdit(cell, id, field, currentValue) {
  cell.classList.add('editing');

  // Store original HTML
  cell.dataset.originalHtml = cell.innerHTML;

  // Create input
  const input = document.createElement('input');
  input.type = 'number';
  input.className = 'quick-edit-input';
  input.value = currentValue;
  input.min = field === 'quantity' ? '0' : '0';
  input.step = field === 'quantity' ? '1' : '0.01';

  // Create action buttons
  const actions = document.createElement('div');
  actions.className = 'quick-edit-actions';
  actions.innerHTML = `
    <button class="quick-edit-btn quick-edit-save" title="حفظ">✓</button>
    <button class="quick-edit-btn quick-edit-cancel" title="إلغاء">✕</button>
  `;

  cell.innerHTML = '';
  cell.appendChild(input);
  cell.appendChild(actions);

  // Focus input
  input.focus();
  input.select();

  // Handle save
  actions.querySelector('.quick-edit-save').onclick = () => saveQuickEdit(cell, id, field, input.value);

  // Handle cancel
  actions.querySelector('.quick-edit-cancel').onclick = () => closeQuickEdit(cell);

  // Handle Enter key
  input.onkeydown = (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      saveQuickEdit(cell, id, field, input.value);
    } else if (e.key === 'Escape') {
      closeQuickEdit(cell);
    }
  };

  // Handle blur (click outside)
  input.onblur = (e) => {
    // Small delay to allow button clicks
    setTimeout(() => {
      if (cell.classList.contains('editing') && !cell.contains(document.activeElement)) {
        closeQuickEdit(cell);
      }
    }, 150);
  };
}

function closeQuickEdit(cell) {
  cell.classList.remove('editing');
  if (cell.dataset.originalHtml) {
    cell.innerHTML = cell.dataset.originalHtml;
  }
  // Re-attach handler
  cell.onclick = null;
  attachQuickEditHandlers();
}

async function saveQuickEdit(cell, id, field, newValue) {
  const originalValue = cell.dataset.value;
  const numValue = field === 'quantity' ? parseInt(newValue) : parseFloat(newValue);

  // Validate
  if (isNaN(numValue) || numValue < 0) {
    showToast('⚠️ قيمة غير صحيحة', 'warning');
    closeQuickEdit(cell);
    return;
  }

  // Same value, just close
  if (numValue == originalValue) {
    closeQuickEdit(cell);
    return;
  }

  // Show loading state
  const input = cell.querySelector('input');
  if (input) {
    input.disabled = true;
    input.style.opacity = '0.5';
  }

  try {
    // Build update data based on field
    const updateData = {};
    if (field === 'quantity') {
      updateData.quantity = numValue;
    } else if (field === 'purchase_price') {
      updateData.purchase_price = numValue;
    } else if (field === 'sale_price') {
      updateData.sell_price = numValue;
      updateData.sale_price = numValue;
    }

    Logger.log('[QUICK-EDIT] Updating:', id, field, numValue);

    const response = await fetch(`elos-db://accessories/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updateData)
    });

    if (!response.ok) {
      throw new Error('فشل التحديث');
    }

    const result = await response.json();

    if (!result.success) {
      throw new Error(result.error || 'فشل التحديث');
    }

    Logger.log('[QUICK-EDIT] ✅ Success');
    showToast('✅ تم التحديث', 'success', 1500);

    // Clear cache and reload
    AccessoryCache.clear();
    await loadAccessories();

  } catch (error) {
    Logger.error('[QUICK-EDIT] Error:', error);
    showToast('❌ فشل التحديث', 'error');
    closeQuickEdit(cell);
  }
}

// ═════════════════════════════════════
// 🔍 POPULATE FILTER DROPDOWNS (Legacy - kept for compatibility)
// ═════════════════════════════════════
function populateFilterDropdowns() {
  // Now handled by updateFilterDropdowns() from API response
  // This function is kept for backward compatibility
  if (!allAccessories || allAccessories.length === 0) return;

  // Only populate if not already loaded from server
  if (filterOptionsLoaded) return;

  // Fallback to client-side population
  const categories = [...new Set(
    allAccessories
      .map(a => a.category)
      .filter(Boolean)
      .sort()
  )];

  const categorySelect = document.getElementById('fCategory');
  if (categorySelect && categorySelect.options.length <= 1) {
    const currentValue = categorySelect.value;
    categorySelect.innerHTML = '<option value="">الكل</option>' +
      categories.map(c => `<option value="${c}"${c === currentValue ? ' selected' : ''}>${c}</option>`).join('');
  }

  const brands = [...new Set(
    allAccessories
      .map(a => a.brand)
      .filter(Boolean)
      .sort()
  )];

  const brandSelect = document.getElementById('fBrand');
  if (brandSelect && brandSelect.options.length <= 1) {
    const currentValue = brandSelect.value;
    brandSelect.innerHTML = '<option value="">الكل</option>' +
      brands.map(b => `<option value="${b}"${b === currentValue ? ' selected' : ''}>${b}</option>`).join('');
  }

  Logger.log('[FILTERS] Populated (fallback):', categories.length, 'categories,', brands.length, 'brands');
}

// ═════════════════════════════════════
// 👁️ VIEW ACCESSORY DETAILS
// ═════════════════════════════════════
let currentViewingAccessory = null;

async function viewAccessoryDetails(id) {
  const accessory = allAccessories.find(a => a.id === id);
  if (!accessory) {
    showToast('الإكسسوار غير موجود', 'error');
    return;
  }
  
  currentViewingAccessory = accessory;
  
  // Calculate values
  const profitMargin = accessory.sale_price && accessory.purchase_price 
    ? ((accessory.sale_price - accessory.purchase_price) / accessory.purchase_price * 100).toFixed(1)
    : 0;
  const totalValue = ((accessory.quantity || 0) * (accessory.purchase_price || 0)).toFixed(2);
  
  // Fill modal
  document.getElementById('detailId').textContent = `#${accessory.id}`;
  document.getElementById('detailName').textContent = accessory.name || '-';
  document.getElementById('detailCode').textContent = accessory.code || '-';
  document.getElementById('detailCategory').textContent = accessory.category || '-';
  document.getElementById('detailBrand').textContent = accessory.brand || '-';
  
  // Condition with badge
  const conditionEl = document.getElementById('detailCondition');
  conditionEl.innerHTML = accessory.condition 
    ? `<span class="badge badge-${accessory.condition === 'جديد' ? 'new' : 'used'}">${accessory.condition === 'جديد' ? '🆕 جديد' : '♻️ مستعمل'}</span>`
    : '-';
  
  // Quantity with color
  const qtyEl = document.getElementById('detailQuantity');
  const qty = accessory.quantity || 0;
  qtyEl.innerHTML = `<span style="color: ${qty < 5 ? 'var(--warning)' : 'var(--success)'}; font-size: 18px;">${qty}</span>`;
  
  document.getElementById('detailPurchasePrice').textContent = `${fmt(accessory.purchase_price || 0)} ج.م`;
  document.getElementById('detailSalePrice').textContent = `${fmt(accessory.sale_price || 0)} ج.م`;
  
  // Profit with color
  const profitEl = document.getElementById('detailProfit');
  profitEl.innerHTML = `<span style="color: ${profitMargin > 20 ? 'var(--success)' : profitMargin > 10 ? 'var(--warning)' : 'var(--danger)'};">${profitMargin > 0 ? '+' : ''}${profitMargin}%</span>`;
  
  document.getElementById('detailTotalValue').textContent = `${totalValue} ج.م`;
  
  // Status with badge
  const statusEl = document.getElementById('detailStatus');
  const statusMap = {
    'متاح': '✅ متاح',
    'محجوز': '🔒 محجوز',
    'مباع': '❌ مباع'
  };
  statusEl.innerHTML = `<span class="badge badge-${accessory.status === 'متاح' ? 'available' : accessory.status === 'محجوز' ? 'reserved' : 'sold'}">${statusMap[accessory.status] || accessory.status}</span>`;
  
  // Get warehouse name
  const warehouseName = localStorage.getItem('currentWarehouseName') || '-';
  document.getElementById('detailWarehouse').textContent = warehouseName;
  document.getElementById('detailLocation').textContent = accessory.location || '-';
  document.getElementById('detailNotes').textContent = accessory.notes || '-';
  
  // Open modal first
  document.getElementById('viewDetailsModal').classList.add('active');
  document.body.style.overflow = 'hidden';
  
  // Load timeline
  await loadAccessoryTimeline(id);
  
  Logger.log('[VIEW] Viewing accessory:', accessory);
}

async function loadAccessoryTimeline(accessoryId) {
  const container = document.getElementById('timelineContainer');
  container.innerHTML = '<div class="timeline-loading">⏳ جاري تحميل السجل...</div>';
  
  try {
    // Get accessory movements
    const movementsRes = await fetch(`elos-db://accessory-movements?accessory_id=${accessoryId}`);
    const movementsData = await movementsRes.json();
    const movements = movementsData.movements || [];
    
    // Get accessory details for created_at
    const accessory = allAccessories.find(a => a.id === accessoryId);
    
    // Build timeline
    const timeline = [];
    
    // 1. Created event
    if (accessory && accessory.created_at) {
      timeline.push({
        type: 'created',
        icon: '🎉',
        title: 'تم إضافة الصنف',
        desc: `تم إضافة "${accessory.name}" إلى النظام`,
        date: new Date(accessory.created_at),
        meta: {
          user: 'النظام'
        }
      });
    }
    
    // 2. Movements
    movements.forEach(mov => {
      const typeMap = {
        'purchase': { icon: '📦', title: 'شراء', color: 'accent' },
        'sale': { icon: '💰', title: 'بيع', color: 'warning' },
        'return': { icon: '↩️', title: 'مرتجع', color: 'danger' },
        'adjustment': { icon: '🔧', title: 'تسوية', color: 'purple' },
        'damage': { icon: '⚠️', title: 'تالف', color: 'danger' }
      };
      
      const typeInfo = typeMap[mov.type] || { icon: '📝', title: mov.type };
      
      timeline.push({
        type: mov.type,
        icon: typeInfo.icon,
        title: typeInfo.title,
        desc: `${mov.quantity > 0 ? '+' : ''}${mov.quantity} • ${mov.notes || mov.reason || 'بدون ملاحظات'}`,
        date: new Date(mov.created_at || mov.date),
        meta: {
          before: mov.quantity_before,
          after: mov.quantity_after,
          price: mov.unit_price,
          total: mov.total_price
        }
      });
    });
    
    // Sort by date DESC (newest first)
    timeline.sort((a, b) => b.date - a.date);
    
    // Render timeline
    if (timeline.length === 0) {
      container.innerHTML = '<div class="timeline-empty">📭 لا توجد حركات مسجلة</div>';
      return;
    }
    
    container.innerHTML = timeline.map(item => {
      const dateStr = item.date.toLocaleString('ar-EG', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });
      
      return `
        <div class="timeline-item ${item.type}">
          <div class="timeline-icon">${item.icon}</div>
          <div class="timeline-content">
            <div class="timeline-title">${item.title}</div>
            <div class="timeline-desc">${item.desc}</div>
            <div class="timeline-meta">
              <span>📅 ${dateStr}</span>
              ${item.meta.before !== undefined ? `<span>قبل: ${item.meta.before}</span>` : ''}
              ${item.meta.after !== undefined ? `<span>بعد: ${item.meta.after}</span>` : ''}
              ${item.meta.price ? `<span>السعر: ${fmt(item.meta.price)} ج.م</span>` : ''}
              ${item.meta.total ? `<span>الإجمالي: ${fmt(item.meta.total)} ج.م</span>` : ''}
            </div>
          </div>
        </div>
      `;
    }).join('');
    
  } catch (error) {
    Logger.error('[TIMELINE] Error:', error);
    container.innerHTML = '<div class="timeline-empty">❌ فشل تحميل السجل</div>';
  }
}

function closeViewDetailsModal() {
  document.getElementById('viewDetailsModal').classList.remove('active');
  document.body.style.overflow = '';
  currentViewingAccessory = null;
}

function openEditFromDetails() {
  if (!currentViewingAccessory) {
    showToast('حدث خطأ في تحميل البيانات', 'error');
    return;
  }
  
  const accessoryId = currentViewingAccessory.id;
  Logger.log('[EDIT] Opening edit from details for:', accessoryId);
  
  closeViewDetailsModal();
  
  // Wait for modal to close before opening edit
  setTimeout(() => {
    openEditModal(accessoryId);
  }, 300);
}

// ═════════════════════════════════════
// ✏️ EDIT ACCESSORY MODAL
// ═════════════════════════════════════
function openEditModal(id) {
  const accessory = allAccessories.find(a => a.id === id);
  if (!accessory) {
    showToast('الإكسسوار غير موجود', 'error');
    return;
  }
  
  // Fill form
  document.getElementById('editAccessoryId').value = accessory.id;
  document.getElementById('editName').value = accessory.name || '';
  document.getElementById('editCode').value = accessory.code || '';
  document.getElementById('editCategory').value = accessory.category || '';
  document.getElementById('editBrand').value = accessory.brand || '';
  document.getElementById('editCondition').value = accessory.condition || 'جديد';
  document.getElementById('editStatus').value = accessory.status || 'متاح';
  document.getElementById('editPurchasePrice').value = accessory.purchase_price || '';
  document.getElementById('editSalePrice').value = accessory.sale_price || '';
  document.getElementById('editLocation').value = accessory.location || '';
  document.getElementById('editNotes').value = accessory.notes || '';
  
  // Open modal
  document.getElementById('editAccessoryModal').classList.add('active');
  document.body.style.overflow = 'hidden';
  
  Logger.log('[EDIT] Opening edit for:', accessory);
}

function closeEditModal() {
  document.getElementById('editAccessoryModal').classList.remove('active');
  document.body.style.overflow = '';
  document.getElementById('editAccessoryForm').reset();
}

async function handleEditAccessory(event) {
  event.preventDefault();
  
  const submitBtn = document.getElementById('editSubmitBtn');
  const originalText = submitBtn.textContent;
  
  try {
    submitBtn.disabled = true;
    submitBtn.textContent = '⏳ جاري الحفظ...';
    
    const id = document.getElementById('editAccessoryId').value;
    const updateData = {
      name: document.getElementById('editName').value.trim(),
      barcode: document.getElementById('editCode').value.trim() || null,
      category: document.getElementById('editCategory').value.trim() || null,
      brand: document.getElementById('editBrand').value.trim() || null,
      condition: document.getElementById('editCondition').value,
      status: document.getElementById('editStatus').value,
      purchase_price: parseFloat(document.getElementById('editPurchasePrice').value) || 0,
      sell_price: parseFloat(document.getElementById('editSalePrice').value) || 0,
      location: document.getElementById('editLocation').value.trim() || null,
      notes: document.getElementById('editNotes').value.trim() || null
    };
    
    Logger.log('[EDIT] Updating accessory:', id, updateData);
    
    const response = await fetch(`elos-db://accessories/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updateData)
    });
    
    Logger.log('[EDIT] Response status:', response.status, response.ok);
    
    if (!response.ok) {
      const errorText = await response.text();
      Logger.error('[EDIT] Error response:', errorText);
      throw new Error(`فشل التحديث: ${response.status}`);
    }
    
    let result;
    try {
      result = await response.json();
    } catch (parseError) {
      const text = await response.text();
      Logger.error('[EDIT] Invalid JSON:', text);
      throw new Error('استجابة غير صحيحة من الخادم');
    }
    
    Logger.log('[EDIT] Response:', result);
    
    if (!result.success) {
      throw new Error(result.error || result.message || 'فشل التحديث');
    }
    
    Logger.log('[EDIT] ✅ Updated successfully');
    
    // Clear cache and reload
    AccessoryCache.clear();
    await loadAccessories();
    await loadStats();
    updateSidebarStats();
    
    closeEditModal();
    showToast('✅ تم تحديث الإكسسوار بنجاح');
    
  } catch (error) {
    Logger.error('[EDIT] ❌ Error:', error);
    showToast(error.message || 'فشل تحديث الإكسسوار', 'error');
  } finally {
    submitBtn.disabled = false;
    submitBtn.textContent = originalText;
  }
}

// ═════════════════════════════════════
// ✏️ ATTACH CHANGE LISTENERS (DEPRECATED)
// ═════════════════════════════════════
function attachChangeListeners() {
  // لم تعد مستخدمة - تم إزالة التعديل المباشر
}

// ═════════════════════════════════════
// 💾 UPDATE ACCESSORY FIELD
// ═════════════════════════════════════
async function updateAccessoryField(id, field, value) {
  try {
    Logger.log(`[UPDATE] Updating accessory ${id}, field: ${field}, value: ${value}`);
    
    // Prepare update data
    const updateData = {};
    updateData[field] = value;
    
    await dbFetch(`accessories/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updateData)
    });
    
    showToast(`✅ تم تحديث ${field}`, 'success', 2000);
    
    // Clear cache and reload stats
    AccessoryCache.clear();
    await loadStats();
    
  } catch (error) {
    Logger.error('[UPDATE] Failed to update:', error);
    showToast(`❌ فشل التحديث`, 'error');
  }
}

// ═════════════════════════════════════
// ➕ ADD NEW ACCESSORY
// ═════════════════════════════════════
async function addAccessory() {
  try {
    const name = document.getElementById('newName').value.trim();
    let code = document.getElementById('newCode').value.trim();
    const condition = document.getElementById('newCondition').value;
    const quantity = parseInt(document.getElementById('newQuantity').value) || 1;
    const purchasePrice = parseFloat(document.getElementById('newPurchasePrice').value) || 0;
    const salePrice = parseFloat(document.getElementById('newSalePrice').value) || 0;
    const notes = document.getElementById('newNotes').value.trim();
    
    // Validation
    if (!name) {
      showToast('⚠️ يرجى إدخال اسم الأكسسوار', 'warning');
      return;
    }
    
    // ⚠️ V24.7: توليد short_code تلقائياً إذا لم يتم إدخاله (6 أرقام للإكسسوارات الجديدة)
    if (!code) {
      // استخدام BarcodeGenerator لتوليد short_code جديد
      if (window.BarcodeGenerator && typeof window.BarcodeGenerator.generateNewAccessoryCode === 'function') {
        code = await window.BarcodeGenerator.generateNewAccessoryCode();
        if (code) {
          // تحديث حقل الإدخال
          const codeInput = document.getElementById('newCode');
          if (codeInput) {
            codeInput.value = code;
          }
          Logger.log('[ADD] Auto-generated short_code:', code);
        }
      } else {
        // Fallback: توليد يدوي
        const accessoriesResponse = await fetch('elos-db://accessories');
        if (accessoriesResponse.ok) {
          const allAccessories = await accessoriesResponse.json();
          const accessories = Array.isArray(allAccessories) ? allAccessories : (allAccessories?.accessories || []);
          
          const usedCodes = new Set();
          accessories.forEach(a => {
            const existingCode = a.short_code || a.code || a.barcode;
            if (existingCode) {
              const numCode = parseInt(String(existingCode).replace(/[^0-9]/g, ''), 10);
              if (numCode >= 100000 && numCode <= 999999) {
                usedCodes.add(numCode);
              }
            }
          });
          
          // توليد أول رقم متاح في النطاق 100000-999999
          for (let numCode = 100000; numCode <= 999999; numCode++) {
            if (!usedCodes.has(numCode)) {
              code = String(numCode).padStart(6, '0');
              const codeInput = document.getElementById('newCode');
              if (codeInput) {
                codeInput.value = code;
              }
              Logger.log('[ADD] Auto-generated short_code (fallback):', code);
              break;
            }
          }
        }
        
        if (!code) {
          showToast('❌ فشل توليد الكود تلقائياً', 'error');
          return;
        }
      }
    }
    
    const warehouseId = CURRENT_WAREHOUSE_ID;
    
    if (!warehouseId) {
      showToast('❌ لم يتم تحديد مخزن', 'error');
      return;
    }
    
    // Prepare accessory data
    const accessoryData = {
      warehouse_id: parseInt(warehouseId),
      name: name,
      code: code,
      short_code: code, // ⚠️ V24.7: حفظ short_code أيضاً
      barcode: code, // حفظ في barcode أيضاً للتوافق
      condition: condition,
      quantity: quantity,
      purchase_price: purchasePrice,
      sale_price: salePrice,
      status: 'متاح',
      notes: notes
    };
    
    // Insert via API
    await dbFetch('accessories', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(accessoryData)
    });
    
    showToast('✅ تمت إضافة الأكسسوار بنجاح', 'success');
    
    // Clear form
    document.getElementById('newName').value = '';
    document.getElementById('newCode').value = '';
    document.getElementById('newCondition').value = 'جديد';
    document.getElementById('newQuantity').value = '1';
    document.getElementById('newPurchasePrice').value = '';
    document.getElementById('newSalePrice').value = '';
    document.getElementById('newNotes').value = '';
    
    // Clear cache and reload
    AccessoryCache.clear();
    await loadStats();
    await loadAccessories();
    
    playSound('success');
    
  } catch (error) {
    Logger.error('[ADD] Failed to add accessory:', error);
    showToast('❌ فشل إضافة الأكسسوار', 'error');
  }
}

// ═════════════════════════════════════
// 🗑️ DELETE ACCESSORY
// ═════════════════════════════════════
async function deleteAccessory(id) {
  // ✅ استخدام showConfirm بدلاً من confirm
  const confirmed = await showConfirm('هل أنت متأكد من حذف هذا الأكسسوار؟', 'حذف', 'إلغاء', 'danger');
  if (!confirmed) {
    return;
  }
  
  try {
    await dbFetch(`accessories/${id}`, {
      method: 'DELETE'
    });
    
    showToast('✅ تم حذف الأكسسوار', 'success');
    
    // Clear cache and reload
    AccessoryCache.clear();
    await loadStats();
    await loadAccessories();
    
  } catch (error) {
    Logger.error('[DELETE] Failed to delete:', error);
    showToast('❌ فشل الحذف', 'error');
  }
}

// ═════════════════════════════════════
// 🔄 SORTING
// ═════════════════════════════════════
function setupSorting() {
  const headers = document.querySelectorAll('.table th.sortable');
  
  headers.forEach(th => {
    th.addEventListener('click', () => {
      const column = th.getAttribute('data-column');
      
      if (sortColumn === column) {
        sortDirection = sortDirection === 'asc' ? 'desc' : 'asc';
      } else {
        sortColumn = column;
        sortDirection = 'asc';
      }
      
      // Update UI
      headers.forEach(h => {
        h.classList.remove('sorted-asc', 'sorted-desc');
      });
      
      th.classList.add(sortDirection === 'asc' ? 'sorted-asc' : 'sorted-desc');
      
      // Reload data
      loadAccessories();
    });
  });
}

// ═════════════════════════════════════
// 📄 PAGINATION - Server-side Version
// ═════════════════════════════════════
function updatePaginationUI(pagination) {
  // Support both server-side pagination object and legacy mode
  let totalPages, total, start, end;

  if (pagination && typeof pagination === 'object') {
    // Server-side pagination
    totalPages = pagination.total_pages || Math.ceil(pagination.total / rowsPerPage);
    total = pagination.total || 0;
    start = viewingAll ? 1 : ((pagination.page - 1) * pagination.limit) + 1;
    end = viewingAll ? total : Math.min(pagination.page * pagination.limit, total);
    currentPage = pagination.page || currentPage;
  } else {
    // Fallback to legacy calculation
    totalPages = Math.ceil(totalAccessories / rowsPerPage);
    total = totalAccessories;
    start = viewingAll ? 1 : (currentPage - 1) * rowsPerPage + 1;
    end = viewingAll ? totalAccessories : Math.min(currentPage * rowsPerPage, totalAccessories);
  }

  Logger.log('[PAGINATION] total:', total, 'pages:', totalPages, 'current:', currentPage);

  // Update info text
  document.getElementById('paginationStart').textContent = total > 0 ? start : 0;
  document.getElementById('paginationEnd').textContent = total > 0 ? end : 0;
  document.getElementById('paginationTotal').textContent = total;

  // Enable/disable navigation buttons
  const btnFirst = document.getElementById('btnFirstPage');
  const btnPrev = document.getElementById('btnPrevPage');
  const btnNext = document.getElementById('btnNextPage');
  const btnLast = document.getElementById('btnLastPage');

  const isFirstPage = currentPage === 1;
  const isLastPage = currentPage >= totalPages || totalPages === 0;

  [btnFirst, btnPrev].forEach(btn => {
    if (btn) {
      btn.disabled = isFirstPage || viewingAll;
      btn.style.opacity = btn.disabled ? '0.4' : '1';
      btn.style.cursor = btn.disabled ? 'not-allowed' : 'pointer';
    }
  });

  [btnNext, btnLast].forEach(btn => {
    if (btn) {
      btn.disabled = isLastPage || viewingAll;
      btn.style.opacity = btn.disabled ? '0.4' : '1';
      btn.style.cursor = btn.disabled ? 'not-allowed' : 'pointer';
    }
  });

  // Render page numbers
  renderPageNumbers(totalPages);

  // Update view all button
  const btnViewAll = document.getElementById('btnViewAll');
  if (btnViewAll) {
    btnViewAll.textContent = viewingAll ? '📄 عرض بصفحات' : '📜 عرض الكل';
  }
}

function renderPageNumbers(totalPages) {
  const container = document.getElementById('pageNumbers');
  if (!container) return;

  container.innerHTML = '';

  if (viewingAll || totalPages <= 1) {
    const label = document.createElement('span');
    label.textContent = viewingAll ? 'الكل' : '1';
    label.style.cssText = 'padding: 8px 14px; background: var(--accent); color: white; border-radius: 8px; font-weight: 600; font-size: 13px;';
    container.appendChild(label);
    return;
  }

  // Calculate which page numbers to show
  let pages = [];

  if (totalPages <= 7) {
    for (let i = 1; i <= totalPages; i++) pages.push(i);
  } else {
    pages.push(1);
    if (currentPage > 3) pages.push('...');
    for (let i = Math.max(2, currentPage - 1); i <= Math.min(totalPages - 1, currentPage + 1); i++) {
      if (!pages.includes(i)) pages.push(i);
    }
    if (currentPage < totalPages - 2) pages.push('...');
    if (!pages.includes(totalPages)) pages.push(totalPages);
  }

  // Render page buttons
  pages.forEach(page => {
    if (page === '...') {
      const dots = document.createElement('span');
      dots.textContent = '...';
      dots.style.cssText = 'padding: 8px 6px; color: var(--text-secondary); font-size: 13px;';
      container.appendChild(dots);
    } else {
      const btn = document.createElement('button');
      btn.textContent = page;
      btn.className = 'page-num-btn';
      const isActive = page === currentPage;
      btn.style.cssText = `
        padding: 8px 14px;
        border-radius: 8px;
        border: 1px solid ${isActive ? 'var(--accent)' : 'rgba(148,163,184,0.2)'};
        background: ${isActive ? 'var(--accent)' : 'rgba(30,41,59,0.8)'};
        color: ${isActive ? 'white' : 'var(--text-primary)'};
        cursor: pointer;
        font-size: 13px;
        font-weight: ${isActive ? '600' : '400'};
        transition: all 0.2s;
      `;
      btn.onclick = () => {
        currentPage = page;
        loadAccessories();
      };
      btn.onmouseenter = () => {
        if (!isActive) {
          btn.style.background = 'rgba(59,130,246,0.2)';
          btn.style.borderColor = 'var(--accent)';
        }
      };
      btn.onmouseleave = () => {
        if (!isActive) {
          btn.style.background = 'rgba(30,41,59,0.8)';
          btn.style.borderColor = 'rgba(148,163,184,0.2)';
        }
      };
      container.appendChild(btn);
    }
  });
}

function setupPagination() {
  const btnFirst = document.getElementById('btnFirstPage');
  const btnPrev = document.getElementById('btnPrevPage');
  const btnNext = document.getElementById('btnNextPage');
  const btnLast = document.getElementById('btnLastPage');
  const btnViewAll = document.getElementById('btnViewAll');

  if (btnFirst) {
    btnFirst.onclick = () => {
      if (currentPage !== 1 && !viewingAll) {
        currentPage = 1;
        loadAccessories();
      }
    };
  }

  if (btnPrev) {
    btnPrev.onclick = () => {
      if (currentPage > 1 && !viewingAll) {
        currentPage--;
        loadAccessories();
      }
    };
  }

  if (btnNext) {
    btnNext.onclick = () => {
      const totalPages = Math.ceil(totalAccessories / rowsPerPage);
      if (currentPage < totalPages && !viewingAll) {
        currentPage++;
        loadAccessories();
      }
    };
  }

  if (btnLast) {
    btnLast.onclick = () => {
      const totalPages = Math.ceil(totalAccessories / rowsPerPage);
      if (currentPage !== totalPages && !viewingAll) {
        currentPage = totalPages;
        loadAccessories();
      }
    };
  }

  if (btnViewAll) {
    btnViewAll.onclick = () => {
      viewingAll = !viewingAll;
      if (!viewingAll) {
        currentPage = 1;
      }
      loadAccessories();
    };
  }

  console.log('[PAGINATION] Setup complete');
}

// ═════════════════════════════════════
// 📊 EXPORT TO EXCEL
// ═════════════════════════════════════
async function exportToExcel() {
  try {
    showToast('📊 جاري تصدير البيانات...', 'info', 2000);
    
    const warehouseId = CURRENT_WAREHOUSE_ID;
    
    // Fetch all accessories
    const data = await dbFetch('accessories');
    const allAccessories = data.accessories || [];
    
    // Filter by warehouse
    // Normalize types for comparison
    const normalizedWarehouseId = Number(warehouseId);
    const accessories = allAccessories.filter(acc => Number(acc.warehouse_id) === normalizedWarehouseId);
    
    // Create CSV content (الباركود = الرقم المستخدم في المسح، نحافظ عليه عند الاستيراد)
    let csv = 'الرقم,الاسم,الكود,الباركود,الحالة,الكمية,سعر الشراء,سعر البيع,الوضع,ملاحظات\n';
    
    accessories.forEach(acc => {
      const barcode = acc.barcode || acc.short_code || acc.code || '';
      csv += `${acc.id},"${(acc.name || '').replace(/"/g, '""')}","${(acc.code || '').replace(/"/g, '""')}","${String(barcode).replace(/"/g, '""')}","${acc.condition}",${acc.quantity},${acc.purchase_price},${acc.sale_price},"${acc.status}","${(acc.notes || '').replace(/"/g, '""')}"\n`;
    });
    
    // Create download link
    const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `accessories_${new Date().toISOString().split('T')[0]}.csv`;
    link.click();
    
    showToast('✅ تم تصدير البيانات بنجاح', 'success');
    
  } catch (error) {
    Logger.error('[EXPORT] Failed:', error);
    showToast('❌ فشل التصدير', 'error');
  }
}

// ═════════════════════════════════════
// 📥 IMPORT FROM EXCEL
// ═════════════════════════════════════
let importData = [];

function openImportModal() {
  document.getElementById('importModal').classList.add('active');
  importData = [];

  const fileInput = document.getElementById('importFileInput');
  const fileInfo = document.getElementById('importSelectedFileInfo');
  const importBtn = document.getElementById('executeImportBtn');

  if (fileInput) fileInput.value = '';
  if (fileInfo) fileInfo.style.display = 'none';
  if (importBtn) {
    importBtn.disabled = true;
    importBtn.classList.add('btn-disabled');
  }

  // Setup drag and drop
  setupImportDragDrop();
}

function closeImportModal() {
  document.getElementById('importModal').classList.remove('active');
  importData = [];
}

function setupImportDragDrop() {
  const dropZone = document.getElementById('importDropZone');
  if (!dropZone || dropZone.dataset.setup) return;

  dropZone.dataset.setup = 'true';

  dropZone.addEventListener('dragover', (e) => {
    e.preventDefault();
    dropZone.style.borderColor = 'var(--accent)';
    dropZone.style.background = 'rgba(59,130,246,0.1)';
  });

  dropZone.addEventListener('dragleave', (e) => {
    e.preventDefault();
    dropZone.style.borderColor = 'var(--border)';
    dropZone.style.background = 'var(--bg-tertiary)';
  });

  dropZone.addEventListener('drop', (e) => {
    e.preventDefault();
    dropZone.style.borderColor = 'var(--border)';
    dropZone.style.background = 'var(--bg-tertiary)';

    const file = e.dataTransfer.files[0];
    if (file && file.name.endsWith('.csv')) {
      processImportFile(file);
    } else {
      showToast('⚠️ يرجى اختيار ملف CSV', 'warning');
    }
  });
}

function handleImportFileSelect(event) {
  const file = event.target.files[0];
  if (!file) return;

  if (!file.name.endsWith('.csv')) {
    showToast('⚠️ يرجى اختيار ملف CSV', 'warning');
    return;
  }

  processImportFile(file);
}

function processImportFile(file) {
  const fileNameEl = document.getElementById('importSelectedFileName');
  const fileInfoEl = document.getElementById('importSelectedFileInfo');

  if (fileNameEl) fileNameEl.textContent = file.name;
  if (fileInfoEl) fileInfoEl.style.display = 'block';

  const reader = new FileReader();

  reader.onload = function(e) {
    try {
      const content = e.target.result;
      importData = parseImportCSV(content);

      console.log('[Import] Parsed data count:', importData.length);

      // الحصول على الزر داخل الـ callback للتأكد من وجوده
      const importBtn = document.getElementById('executeImportBtn');
      console.log('[Import] Button element:', importBtn);

      if (importData.length > 0) {
        // تفعيل الزر بشكل صحيح
        if (importBtn) {
          importBtn.disabled = false;
          importBtn.classList.remove('btn-disabled');
          importBtn.style.opacity = '';  // إزالة أي inline style
          console.log('[Import] Button enabled - disabled:', importBtn.disabled);
        } else {
          console.error('[Import] Button not found!');
        }
        showToast(`✅ تم قراءة ${importData.length} صنف من الملف`, 'success');
      } else {
        // تعطيل الزر
        if (importBtn) {
          importBtn.disabled = true;
          importBtn.classList.add('btn-disabled');
        }
        showToast('⚠️ الملف فارغ أو غير صالح', 'warning');
      }
    } catch (err) {
      console.error('[Import] Error parsing file:', err);
      showToast('⚠️ خطأ في قراءة الملف', 'error');
    }
  };

  reader.onerror = function(err) {
    console.error('[Import] FileReader error:', err);
    showToast('⚠️ خطأ في قراءة الملف', 'error');
  };

  reader.readAsText(file, 'UTF-8');
}

function parseImportCSV(content) {
  const lines = content.split('\n').filter(line => line.trim());
  if (lines.length < 2) return [];

  const headers = lines[0].split(',').map(h => h.trim().replace(/^"|"$/g, '').toLowerCase());
  const data = [];

  for (let i = 1; i < lines.length; i++) {
    const values = [];
    let current = '';
    let inQuotes = false;

    for (let char of lines[i]) {
      if (char === '"') {
        inQuotes = !inQuotes;
      } else if (char === ',' && !inQuotes) {
        values.push(current.trim().replace(/^"|"$/g, ''));
        current = '';
      } else {
        current += char;
      }
    }
    values.push(current.trim().replace(/^"|"$/g, ''));

    if (values.length >= 2 && values[0]) {
      const item = {};
      headers.forEach((header, index) => {
        item[header] = values[index] || '';
      });
      data.push(item);
    }
  }

  return data;
}

function downloadImportTemplate() {
  const headers = ['Name', 'Code', 'الباركود', 'Condition', 'Quantity', 'Purchase Price', 'Sale Price', 'Notes'];
  let csvContent = '\uFEFF';
  csvContent += headers.join(',') + '\n';
  csvContent += 'شاحن سريع 20W,ACC-001,500001,new,50,150,250,شاحن أصلي\n';
  csvContent += 'سماعة بلوتوث,ACC-002,500002,new,30,200,350,\n';

  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = 'accessories_import_template.csv';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);

  showToast('✅ تم تحميل القالب', 'success');
}

async function executeImport() {
  if (importData.length === 0) {
    showToast('⚠️ لا توجد بيانات للاستيراد', 'warning');
    return;
  }

  const btn = document.getElementById('executeImportBtn');
  btn.disabled = true;
  btn.textContent = 'جاري التحقق من البيانات...';

  const warehouseId = CURRENT_WAREHOUSE_ID;
  let successCount = 0;
  let errorCount = 0;
  const errorDetails = [];
  const total = importData.length;

  // === الخطوة 1: اكتشاف التكرارات داخل الملف ===
  const seenCodes = new Set();
  const duplicatesInFile = [];
  const validItems = [];

  for (let i = 0; i < importData.length; i++) {
    const item = importData[i];
    const barcode = (item['الباركود'] || item.barcode || item.code || item['code'] || '').trim();
    const code = (item.code || item['code'] || '').trim();
    const key = barcode || code;

    if (key && seenCodes.has(key)) {
      duplicatesInFile.push({ row: i + 2, code: key, name: item.name || item['name'] || '' });
    } else {
      if (key) seenCodes.add(key);
      validItems.push({ ...item, originalRow: i + 2 });
    }
  }

  // إظهار تحذير إذا وجدت تكرارات داخل الملف
  if (duplicatesInFile.length > 0) {
    const dupList = duplicatesInFile.slice(0, 5).map(d => `سطر ${d.row}: ${d.code}`).join('\n');
    const moreCount = duplicatesInFile.length > 5 ? `\n... و ${duplicatesInFile.length - 5} آخرين` : '';
    showToast(`⚠️ تم تجاهل ${duplicatesInFile.length} صنف مكرر في الملف:\n${dupList}${moreCount}`, 'warning', 6000);
  }

  if (validItems.length === 0) {
    showToast('⚠️ لا توجد بيانات صالحة للاستيراد', 'warning');
    btn.disabled = false;
    btn.textContent = 'استيراد البيانات';
    return;
  }

  // === الخطوة 2: تجهيز الأصناف وإرسالها دفعة واحدة ===
  btn.textContent = 'جاري الاستيراد...';

  const items = validItems.map(item => {
    const barcodeFromFile = (item['الباركود'] || item.barcode || item.code || item['code'] || '').trim();
    const acc = {
      name: item.name || item['name'] || '',
      code: item.code || item['code'] || '',
      condition: item.condition || item['condition'] || 'new',
      quantity: parseInt(item.quantity || item['quantity'] || 0),
      purchase_price: parseFloat(item['purchase price'] || item.purchase_price || 0),
      sale_price: parseFloat(item['sale price'] || item.sale_price || 0),
      notes: item.notes || item['notes'] || ''
    };
    if (barcodeFromFile) {
      acc.barcode = barcodeFromFile;
      acc.short_code = barcodeFromFile;
    }
    return acc;
  });

  try {
    const payload = { items };
    if (warehouseId) payload.warehouse_id = parseInt(warehouseId);

    const response = await fetch('elos-db://accessories-bulk-import', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.error || 'فشل في الاستيراد');
    }

    const result = await response.json();

    closeImportModal();

    if (result.added > 0) {
      showToast(`✅ تم استيراد ${result.added} صنف بنجاح${result.failed > 0 ? ` (${result.failed} فشل)` : ''}`, result.failed > 0 ? 'warning' : 'success');
      loadAccessories();
      loadStats();

      if (result.errors && result.errors.length > 0) {
        setTimeout(() => {
          const detailsList = result.errors.slice(0, 10).map(e =>
            `• سطر ${e.index + 2}${e.name ? ` (${e.name})` : ''}: ${e.error}`
          ).join('\n');
          const moreErrors = result.errors.length > 10 ? `\n... و ${result.errors.length - 10} خطأ آخر` : '';
          showToast(`❌ فشل ${result.failed} صنف:\n${detailsList}${moreErrors}`, 'error', 8000);
        }, 500);
      }
    } else {
      showToast('فشل في استيراد البيانات', 'error');
    }
  } catch (err) {
    console.error('[IMPORT] Bulk import error:', err);
    showToast('خطأ في الاستيراد: ' + err.message, 'error');
  }

  btn.disabled = false;
  btn.textContent = 'استيراد البيانات';
}

// ═════════════════════════════════════
// 🔊 SOUND SYSTEM
// ═════════════════════════════════════
const sounds = {
  click: () => {
    const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    const oscillator = audioCtx.createOscillator();
    const gainNode = audioCtx.createGain();
    
    oscillator.connect(gainNode);
    gainNode.connect(audioCtx.destination);
    
    oscillator.frequency.value = 800;
    oscillator.type = 'sine';
    
    gainNode.gain.setValueAtTime(0.1, audioCtx.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.1);
    
    oscillator.start(audioCtx.currentTime);
    oscillator.stop(audioCtx.currentTime + 0.1);
  },
  success: () => {
    const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    const oscillator = audioCtx.createOscillator();
    const gainNode = audioCtx.createGain();
    
    oscillator.connect(gainNode);
    gainNode.connect(audioCtx.destination);
    
    oscillator.frequency.value = 1200;
    oscillator.type = 'sine';
    
    gainNode.gain.setValueAtTime(0.15, audioCtx.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.15);
    
    oscillator.start(audioCtx.currentTime);
    oscillator.stop(audioCtx.currentTime + 0.15);
  }
};

function playSound(type) {
  if (localStorage.getItem('elos_sounds') === 'off') return;
  try {
    sounds[type]?.();
  } catch (e) {
    Logger.log('Sound disabled');
  }
}

// ═════════════════════════════════════
// 🎯 CONTEXT MENU
// ═════════════════════════════════════
function setupContextMenu() {
  const contextMenu = document.getElementById('contextMenu');
  const copyItem = document.getElementById('ctxCopy');
  const cutItem = document.getElementById('ctxCut');
  const pasteItem = document.getElementById('ctxPaste');
  
  let selectedInput = null;
  
  document.addEventListener('contextmenu', (e) => {
    if (e.target.tagName === 'INPUT' || e.target.tagName === 'SELECT') {
      e.preventDefault();
      selectedInput = e.target;
      
      contextMenu.style.left = e.pageX + 'px';
      contextMenu.style.top = e.pageY + 'px';
      contextMenu.style.display = 'block';
    } else {
      contextMenu.style.display = 'none';
    }
  });
  
  document.addEventListener('click', () => {
    contextMenu.style.display = 'none';
  });
  
  copyItem?.addEventListener('click', async () => {
    if (selectedInput) {
      try {
        const text = selectedInput.value;
        await navigator.clipboard.writeText(text);
        showToast('📋 تم النسخ', 'success', 1500);
      } catch (err) {
        Logger.error('Failed to copy:', err);
      }
    }
    contextMenu.style.display = 'none';
  });
  
  cutItem?.addEventListener('click', async () => {
    if (selectedInput) {
      try {
        const text = selectedInput.value;
        await navigator.clipboard.writeText(text);
        selectedInput.value = '';
        showToast('✂️ تم القص', 'success', 1500);
      } catch (err) {
        Logger.error('Failed to cut:', err);
      }
    }
    contextMenu.style.display = 'none';
  });
  
  pasteItem?.addEventListener('click', async () => {
    if (selectedInput) {
      try {
        const text = await navigator.clipboard.readText();
        selectedInput.value = text;
        showToast('📄 تم اللصق', 'success', 1500);
      } catch (err) {
        Logger.error('Failed to paste:', err);
      }
    }
    contextMenu.style.display = 'none';
  });
}

// ═════════════════════════════════════
// 🚀 INITIALIZATION
// ═════════════════════════════════════
// ═════════════════════════════════════
// 🚀 INITIALIZATION
// ═════════════════════════════════════

// Setup Event Listeners
function setupEventListeners() {
  // Search filter
  const searchInput = document.getElementById('qSearch');
  if (searchInput) {
    searchInput.addEventListener('input', debounce(() => {
      currentPage = 1;
      loadAccessories();
    }, 300));
  }
  
  // Condition filter
  const conditionSelect = document.getElementById('fCondition');
  if (conditionSelect) {
    conditionSelect.addEventListener('change', () => {
      currentPage = 1;
      loadAccessories();
    });
  }
  
  // Category filter
  const categorySelect = document.getElementById('fCategory');
  if (categorySelect) {
    categorySelect.addEventListener('change', () => {
      currentPage = 1;
      loadAccessories();
    });
  }
  
  // Brand filter
  const brandSelect = document.getElementById('fBrand');
  if (brandSelect) {
    brandSelect.addEventListener('change', () => {
      currentPage = 1;
      loadAccessories();
    });
  }
  
  // Status filter
  const statusSelect = document.getElementById('fStatus');
  if (statusSelect) {
    statusSelect.addEventListener('change', () => {
      currentPage = 1;
      loadAccessories();
    });
  }
  
  // Quantity filter
  const quantitySelect = document.getElementById('fQuantity');
  if (quantitySelect) {
    quantitySelect.addEventListener('change', () => {
      currentPage = 1;
      loadAccessories();
    });
  }
  
  // Clear filters button
  const clearBtn = document.getElementById('btnClearFilters');
  if (clearBtn) {
    clearBtn.addEventListener('click', () => {
      if (searchInput) searchInput.value = '';
      if (conditionSelect) conditionSelect.value = '';
      if (categorySelect) categorySelect.value = '';
      if (brandSelect) brandSelect.value = '';
      if (statusSelect) statusSelect.value = '';
      if (quantitySelect) quantitySelect.value = '';
      currentPage = 1;
      loadAccessories();
      showToast('🔄 تم مسح الفلاتر', 'info', 2000);
    });
  }
  
  Logger.log('[INIT] Event listeners ready');
}

// Debounce helper - using the one defined at the top of the file

// Load Settings
async function loadSettings() {
  try {
    const saved = localStorage.getItem('appSettings');
    if (saved) {
      const settings = JSON.parse(saved);
      Logger.log('[SETTINGS] Loaded:', settings);
    }
  } catch (error) {
    Logger.error('[SETTINGS] Error loading:', error);
  }
}

// Load Warehouse Info and Update Header
async function loadWarehouseInfo() {
  try {
    // Normalize warehouse ID to number and validate
    const wid = Number(CURRENT_WAREHOUSE_ID);
    
    // Guard: Ensure wid is valid
    if (!Number.isFinite(wid) || wid <= 0) {
      console.error('[WAREHOUSE] Invalid effectiveWarehouseId:', CURRENT_WAREHOUSE_ID, 'wid:', wid);
      Logger.error('[WAREHOUSE] Invalid warehouse ID:', CURRENT_WAREHOUSE_ID);
      return;
    }

    // جلب كل المخازن والبحث عن المخزن المطلوب
    const data = await dbFetch('warehouses');
    const warehouses = data.warehouses || data || [];
    
    console.log('[WAREHOUSE] Warehouses loaded:', warehouses.length);
    console.log('[WAREHOUSE] Lookup wid:', wid, 'CURRENT_WAREHOUSE_ID:', CURRENT_WAREHOUSE_ID);
    
    // Normalize types for comparison: convert w.id to number
    const warehouse = warehouses.find(w => Number(w.id) === wid);

    if (warehouse) {
      Logger.log('[WAREHOUSE] ✅ Loaded warehouse info:', warehouse);

      // تحديث عنوان الصفحة في الهيدر
      const titleElement = document.getElementById('warehouseTitle');
      if (titleElement && warehouse.name) {
        titleElement.innerHTML = `مخزون <span style="color: var(--accent); font-weight: 900;">${warehouse.name}</span>`;
      }

      // تحديث عنوان الصفحة في <title>
      const pageTitleElement = document.getElementById('pageTitle');
      if (pageTitleElement && warehouse.name) {
        pageTitleElement.textContent = `${warehouse.name} • نظام المخزون`;
      }

      // تحديث الأيقونة
      const iconElement = document.getElementById('warehouseIcon');
      if (iconElement && warehouse.icon) {
        iconElement.textContent = warehouse.icon;
        // Add decorative animation
        iconElement.style.animation = 'pulse 2s ease-in-out infinite';
      }

      // حفظ اسم المخزن في localStorage للاستخدام في modals
      localStorage.setItem('currentWarehouseName', warehouse.name);
      Logger.log('[WAREHOUSE] ✅ Warehouse name saved to localStorage:', warehouse.name);
      console.log('[WAREHOUSE] ✅ Header updated - Warehouse:', wid, 'Name:', warehouse.name);
    } else {
      // Log detailed info for debugging
      console.error('[WAREHOUSE] Warehouse not found!', {
        wid: wid,
        CURRENT_WAREHOUSE_ID: CURRENT_WAREHOUSE_ID,
        warehousesCount: warehouses.length,
        warehouseIds: warehouses.map(w => ({ id: w.id, idType: typeof w.id, name: w.name }))
      });
      Logger.warn('[WAREHOUSE] Warehouse not found with ID:', wid, 'Available IDs:', warehouses.map(w => Number(w.id)));
    }

  } catch (error) {
    Logger.error('[WAREHOUSE] ❌ Error loading warehouse info:', error);
  }
}

// Load Suppliers
async function loadSuppliers() {
  try {
    const response = await fetch('elos-db://suppliers');
    if (response.ok) {
      const data = await response.json();
      allSuppliers = Array.isArray(data) ? data : [];
      Logger.log(`[SUPPLIERS] ✅ Loaded ${allSuppliers.length} suppliers`);
    }
  } catch (error) {
    Logger.error('[SUPPLIERS] ❌ Error loading:', error);
    allSuppliers = [];
  }
}

// ═════════════════════════════════════
// 📋 LOAD TABLE COLUMNS
// ═════════════════════════════════════
async function loadTableColumns() {
  try {
    Logger.log('[COLUMNS] Fetching column definitions from meta endpoint...');
    const data = await dbFetch('meta/accessories-columns');
    tableColumns = data.columns || [];
    Logger.log('[COLUMNS] Loaded', tableColumns.length, 'columns from backend');
    
    if (tableColumns.length === 0) {
      Logger.warn('[COLUMNS] No columns returned from backend, using fallback');
      throw new Error('No columns returned');
    }
    
    // Build table header
    buildTableHeader();
    
    return tableColumns;
  } catch (error) {
    Logger.error('[COLUMNS] Failed to load columns from backend:', error);
    
    // Show visible warning to user
    if (typeof showToast === 'function') {
      showToast('⚠️ فشل تحميل تعريفات الأعمدة، استخدام القيم الافتراضية', 'warning');
    }
    
    // Fallback - must match static HTML header exactly (5 data columns + actions)
    // Order: الاسم | الفئة | الباركود | سعر الشراء | سعر البيع | إجراءات
    tableColumns = [
      { key: 'name', label: 'الاسم', type: 'text', align: 'right' },
      { key: 'category', label: 'الفئة', type: 'badge', align: 'center' },
      { key: 'short_code', label: '🏷️ الباركود', type: 'mono', align: 'center' },
      { key: 'purchase_price', label: 'سعر الشراء', type: 'currency', align: 'center' },
      { key: 'sale_price', label: 'سعر البيع', type: 'currency', align: 'center' }
    ];
    
    Logger.log('[COLUMNS] Using fallback columns:', tableColumns.length);
    buildTableHeader();
    return tableColumns;
  }
}

// ═════════════════════════════════════
// 🏗️ SETUP TABLE HEADER (Header is now static in HTML)
// ═════════════════════════════════════
function buildTableHeader() {
  const thead = document.getElementById('accessoriesTableHead');

  if (!thead) {
    Logger.warn('[HEADER] Missing thead element');
    return;
  }

  // Header is now static in HTML - just attach sort listeners
  console.log('[HEADER] Setting up static header sort listeners');

  // Sync tableColumns with static header (must match HTML order)
  tableColumns = [
    { key: 'name', label: 'الاسم', type: 'text', align: 'right' },
    { key: 'category', label: 'الفئة', type: 'badge', align: 'center' },
    { key: 'short_code', label: '🏷️ الباركود', type: 'mono', align: 'center' },
    { key: 'purchase_price', label: 'سعر الشراء', type: 'currency', align: 'center' },
    { key: 'sale_price', label: 'سعر البيع', type: 'currency', align: 'center' }
  ];
  console.log('[HEADER] Using static column definitions:', tableColumns.length);

  // Attach sort listeners to existing header
  thead.querySelectorAll('.sortable').forEach(th => {
    th.style.cursor = 'pointer';
    th.addEventListener('click', (e) => {
      const column = th.dataset.column;
      if (column) {
        handleSort(column);
      }
    });
  });

  const thCount = thead.querySelectorAll('th').length;
  const headerOrder = [...thead.querySelectorAll('th')].map(th => th.dataset.column || th.textContent.trim());
  console.log('[HEADER] Static header has', thCount, 'columns (including actions)');
  console.log('[HEADER] TH order:', headerOrder);
  Logger.log('[HEADER] Table header setup complete');
}

document.addEventListener('DOMContentLoaded', async () => {
  Logger.log('[INIT] Initializing Accessories Inventory...');
  try { console.info('[ELOS PAGE]', 'warehouse-inventory.html', 'warehouse_id=', new URLSearchParams(location.search).get('warehouse_id')); } catch {}
  
  // Build stamp verification
  const BUILD_STAMP = 'WAREHOUSE-INVENTORY BUILD: 2026-01-07-K';
  console.log(`[${BUILD_STAMP}] JS file loaded - DEBUG ORDER`);
  Logger.log(`[BUILD] ${BUILD_STAMP}`);
  
  // Update build stamp in UI if element exists
  const buildStampEl = document.getElementById('buildStamp');
  if (buildStampEl) {
    buildStampEl.textContent = BUILD_STAMP;
    Logger.log('[BUILD] Build stamp displayed in UI');
  } else {
    Logger.warn('[BUILD] Build stamp element not found in HTML');
  }

  try {
    await loadSettings();
    await loadWarehouseInfo(); // جلب معلومات المخزن وتحديث الهيدر
    // Load columns first (this builds the header)
    await loadTableColumns();
    await loadSuppliers();
    await loadStats();
    await loadAccessories();
    setupEventListeners();
    setupPagination();
    setupContextMenu();
    updateSidebarStats();
    setupSearchAutocomplete(); // 🔍 Setup Autocomplete
    setupDragAndDrop(); // 🖱️ Setup Drag & Drop
    addSelectionStyles(); // 🔲 Setup Selection Styles
    await loadAvailableWarehouses(); // 🔄 Load warehouses for transfer

    // DEBUG: Final column count after all init
    const finalTh = document.querySelectorAll('#accessoriesTableHead th').length;
    const finalTd = document.querySelector('#accessoriesTableBody tr')?.querySelectorAll('td').length || 0;
    console.log('[FINAL CHECK] TH:', finalTh, '| TD in first row:', finalTd);
    if (finalTh !== finalTd && finalTd > 1) {
      console.error('[FINAL CHECK] ⚠️ COLUMN MISMATCH! Header has', finalTh, 'columns but rows have', finalTd);
    }

    Logger.log('[INIT] ✅ Initialization complete');
  } catch (error) {
    Logger.error('[INIT] ❌ Initialization failed:', error);
    showToast('فشل تحميل البيانات', 'error');
  }
});

// ═════════════════════════════════════
// 🔍 SEARCH AUTOCOMPLETE SYSTEM
// ═════════════════════════════════════
let autocompleteCache = new Map();
let autocompleteTimeout = null;

function setupSearchAutocomplete() {
  const searchInput = document.getElementById('qSearch');
  if (!searchInput) return;

  // Add autocomplete styles
  addAutocompleteStyles();

  // Create autocomplete container
  const wrapper = document.createElement('div');
  wrapper.className = 'autocomplete-wrapper';
  wrapper.style.position = 'relative';

  // Wrap search input
  searchInput.parentNode.insertBefore(wrapper, searchInput);
  wrapper.appendChild(searchInput);

  // Create suggestions container
  const suggestions = document.createElement('div');
  suggestions.id = 'searchSuggestions';
  suggestions.className = 'autocomplete-suggestions';
  wrapper.appendChild(suggestions);

  // Add input event listener
  searchInput.addEventListener('input', (e) => {
    const query = e.target.value.trim();

    // Clear previous timeout
    if (autocompleteTimeout) {
      clearTimeout(autocompleteTimeout);
    }

    if (query.length < 2) {
      hideSuggestions();
      return;
    }

    // Debounce autocomplete
    autocompleteTimeout = setTimeout(() => {
      fetchSuggestions(query);
    }, 200);
  });

  // Hide on blur
  searchInput.addEventListener('blur', () => {
    setTimeout(hideSuggestions, 200);
  });

  // Keyboard navigation
  searchInput.addEventListener('keydown', handleAutocompleteKeydown);

  Logger.log('[AUTOCOMPLETE] ✅ Setup complete');
}

function addAutocompleteStyles() {
  if (document.getElementById('autocomplete-styles')) return;

  const style = document.createElement('style');
  style.id = 'autocomplete-styles';
  style.textContent = `
    .autocomplete-wrapper {
      position: relative;
      width: 100%;
    }
    .autocomplete-suggestions {
      display: none;
      position: absolute;
      top: 100%;
      left: 0;
      right: 0;
      background: var(--bg-secondary);
      border: 1px solid var(--border);
      border-top: none;
      border-radius: 0 0 8px 8px;
      box-shadow: 0 8px 24px rgba(0,0,0,0.4);
      z-index: 1000;
      max-height: 250px;
      overflow-y: auto;
    }
    .autocomplete-suggestions.show {
      display: block;
    }
    .autocomplete-item {
      padding: 10px 14px;
      cursor: pointer;
      display: flex;
      align-items: center;
      gap: 10px;
      border-bottom: 1px solid var(--border);
      transition: all 0.15s ease;
    }
    .autocomplete-item:last-child {
      border-bottom: none;
    }
    .autocomplete-item:hover,
    .autocomplete-item.selected {
      background: rgba(59,130,246,0.15);
    }
    .autocomplete-icon {
      font-size: 18px;
      opacity: 0.7;
    }
    .autocomplete-content {
      flex: 1;
      overflow: hidden;
    }
    .autocomplete-name {
      font-weight: 600;
      color: var(--text-primary);
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }
    .autocomplete-name mark {
      background: rgba(59,130,246,0.3);
      color: var(--accent);
      padding: 0 2px;
      border-radius: 2px;
    }
    .autocomplete-meta {
      font-size: 11px;
      color: var(--text-secondary);
      display: flex;
      gap: 10px;
    }
    .autocomplete-loading {
      padding: 20px;
      text-align: center;
      color: var(--text-secondary);
    }
    .autocomplete-empty {
      padding: 15px;
      text-align: center;
      color: var(--text-secondary);
      font-size: 13px;
    }
  `;
  document.head.appendChild(style);
}

async function fetchSuggestions(query) {
  const suggestions = document.getElementById('searchSuggestions');
  if (!suggestions) return;

  // Check cache
  const cacheKey = `${CURRENT_WAREHOUSE_ID}_${query.toLowerCase()}`;
  if (autocompleteCache.has(cacheKey)) {
    renderSuggestions(autocompleteCache.get(cacheKey), query);
    return;
  }

  // Show loading
  suggestions.innerHTML = '<div class="autocomplete-loading"><div class="spinner" style="width: 20px; height: 20px; margin: 0 auto;"></div></div>';
  suggestions.classList.add('show');

  try {
    // Fetch from server with search
    const params = new URLSearchParams({
      warehouse_id: CURRENT_WAREHOUSE_ID,
      search: query,
      limit: 10
    });

    const data = await dbFetch(`accessories?${params.toString()}`);
    const results = data.accessories || [];

    // Cache results
    autocompleteCache.set(cacheKey, results);

    // Clean old cache entries (keep max 20)
    if (autocompleteCache.size > 20) {
      const firstKey = autocompleteCache.keys().next().value;
      autocompleteCache.delete(firstKey);
    }

    renderSuggestions(results, query);

  } catch (error) {
    Logger.error('[AUTOCOMPLETE] Error:', error);
    suggestions.innerHTML = '<div class="autocomplete-empty">❌ خطأ في البحث</div>';
  }
}

function renderSuggestions(results, query) {
  const suggestions = document.getElementById('searchSuggestions');
  if (!suggestions) return;

  if (!results || results.length === 0) {
    suggestions.innerHTML = '<div class="autocomplete-empty">📦 لا توجد نتائج</div>';
    suggestions.classList.add('show');
    return;
  }

  const highlightMatch = (text, query) => {
    if (!text) return '';
    const regex = new RegExp(`(${escapeRegExp(query)})`, 'gi');
    return text.replace(regex, '<mark>$1</mark>');
  };

  suggestions.innerHTML = results.map((item, index) => `
    <div class="autocomplete-item" data-id="${item.id}" data-index="${index}">
      <span class="autocomplete-icon">📦</span>
      <div class="autocomplete-content">
        <div class="autocomplete-name">${highlightMatch(item.name, query)}</div>
        <div class="autocomplete-meta">
          <span>🏷️ ${item.code || item.barcode || '-'}</span>
          <span>📊 ${item.quantity || 0}</span>
          <span>💰 ${fmt(item.sale_price || item.sell_price || 0)} ج.م</span>
        </div>
      </div>
    </div>
  `).join('');

  suggestions.classList.add('show');

  // Add click handlers
  suggestions.querySelectorAll('.autocomplete-item').forEach(item => {
    item.addEventListener('click', () => {
      selectSuggestion(item.dataset.id);
    });
  });
}

function selectSuggestion(id) {
  const searchInput = document.getElementById('qSearch');
  const item = allAccessories.find(a => a.id == id) ||
               Array.from(autocompleteCache.values()).flat().find(a => a.id == id);

  if (item && searchInput) {
    searchInput.value = item.name;
    hideSuggestions();

    // Trigger search with the selected item
    currentPage = 1;
    AccessoryCache.clear();
    loadAccessories();
  }
}

function hideSuggestions() {
  const suggestions = document.getElementById('searchSuggestions');
  if (suggestions) {
    suggestions.classList.remove('show');
  }
}

function handleAutocompleteKeydown(e) {
  const suggestions = document.getElementById('searchSuggestions');
  if (!suggestions || !suggestions.classList.contains('show')) return;

  const items = suggestions.querySelectorAll('.autocomplete-item');
  const selected = suggestions.querySelector('.autocomplete-item.selected');
  let selectedIndex = selected ? parseInt(selected.dataset.index) : -1;

  switch (e.key) {
    case 'ArrowDown':
      e.preventDefault();
      selectedIndex = Math.min(selectedIndex + 1, items.length - 1);
      updateSelectedItem(items, selectedIndex);
      break;

    case 'ArrowUp':
      e.preventDefault();
      selectedIndex = Math.max(selectedIndex - 1, 0);
      updateSelectedItem(items, selectedIndex);
      break;

    case 'Enter':
      if (selected) {
        e.preventDefault();
        selectSuggestion(selected.dataset.id);
      }
      break;

    case 'Escape':
      hideSuggestions();
      break;
  }
}

function updateSelectedItem(items, index) {
  items.forEach((item, i) => {
    item.classList.toggle('selected', i === index);
    if (i === index) {
      item.scrollIntoView({ block: 'nearest' });
    }
  });
}

function escapeRegExp(string) {
  return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// ═════════════════════════════════════
// ✅ MULTI-SELECT SYSTEM
// ═════════════════════════════════════
let selectedItems = new Set();

function toggleSelectAll(checkbox) {
  const isChecked = checkbox.checked;
  const rowCheckboxes = document.querySelectorAll('.row-checkbox');

  rowCheckboxes.forEach(cb => {
    cb.checked = isChecked;
    const id = parseInt(cb.dataset.id);
    if (isChecked) {
      selectedItems.add(id);
    } else {
      selectedItems.delete(id);
    }
    // Update row highlight
    const row = cb.closest('tr');
    if (row) {
      row.classList.toggle('selected-row', isChecked);
    }
  });

  updateSelectionUI();
}

function toggleItemSelection(checkbox, id) {
  const itemId = parseInt(id);
  if (checkbox.checked) {
    selectedItems.add(itemId);
  } else {
    selectedItems.delete(itemId);
  }

  // Update row highlight
  const row = checkbox.closest('tr');
  if (row) {
    row.classList.toggle('selected-row', checkbox.checked);
  }

  // Update "select all" checkbox
  updateSelectAllCheckbox();
  updateSelectionUI();
}

function updateSelectAllCheckbox() {
  const selectAll = document.getElementById('selectAllCheckbox');
  const rowCheckboxes = document.querySelectorAll('.row-checkbox');
  const checkedCount = document.querySelectorAll('.row-checkbox:checked').length;

  if (selectAll) {
    selectAll.checked = rowCheckboxes.length > 0 && checkedCount === rowCheckboxes.length;
    selectAll.indeterminate = checkedCount > 0 && checkedCount < rowCheckboxes.length;
  }
}

function updateSelectionUI() {
  const count = selectedItems.size;
  const countEl = document.getElementById('selectionCount');
  const transferBtn = document.getElementById('btnBulkTransfer');

  if (countEl) {
    if (count > 0) {
      countEl.textContent = `${count} محدد`;
      countEl.style.display = 'inline-block';
    } else {
      countEl.style.display = 'none';
    }
  }

  if (transferBtn) {
    transferBtn.style.display = count > 0 ? 'flex' : 'none';
  }
}

function clearSelection() {
  selectedItems.clear();
  document.querySelectorAll('.row-checkbox').forEach(cb => {
    cb.checked = false;
    const row = cb.closest('tr');
    if (row) row.classList.remove('selected-row');
  });
  const selectAll = document.getElementById('selectAllCheckbox');
  if (selectAll) {
    selectAll.checked = false;
    selectAll.indeterminate = false;
  }
  updateSelectionUI();
}

// Add selection styles
function addSelectionStyles() {
  if (document.getElementById('selection-styles')) return;

  const style = document.createElement('style');
  style.id = 'selection-styles';
  style.textContent = `
    .row-checkbox {
      width: 18px;
      height: 18px;
      cursor: pointer;
      accent-color: var(--accent);
    }
    .selected-row {
      background: rgba(59,130,246,0.1) !important;
    }
    .selected-row td {
      border-color: rgba(59,130,246,0.2);
    }
    #selectAllCheckbox {
      accent-color: var(--accent);
    }
  `;
  document.head.appendChild(style);
}

// ═════════════════════════════════════
// 🔄 BULK TRANSFER FUNCTIONS
// ═════════════════════════════════════
let availableWarehouses = [];

async function loadAvailableWarehouses() {
  try {
    const data = await dbFetch('warehouses');
    availableWarehouses = (data.warehouses || data || []).filter(w => w.is_active !== 0);
    Logger.log('[WAREHOUSES] Loaded:', availableWarehouses.length);
  } catch (error) {
    Logger.error('[WAREHOUSES] Failed to load:', error);
    availableWarehouses = [];
  }
}

function openBulkTransferModal() {
  if (selectedItems.size === 0) {
    showToast('⚠️ يرجى تحديد صنف واحد على الأقل', 'warning');
    return;
  }

  const modal = document.getElementById('bulkTransferModal');
  if (!modal) return;

  // Update source warehouse info (normalize types for comparison)
  const fromWarehouseEl = document.getElementById('transferFromWarehouse');
  const normalizedCurrentWid = Number(CURRENT_WAREHOUSE_ID);
  const currentWarehouse = availableWarehouses.find(w => Number(w.id) === normalizedCurrentWid);
  if (fromWarehouseEl && currentWarehouse) {
    fromWarehouseEl.textContent = `${currentWarehouse.icon || '📦'} ${currentWarehouse.name}`;
  }

  // Update items count
  const countEl = document.getElementById('transferItemsCount');
  if (countEl) countEl.textContent = selectedItems.size;

  // Populate target warehouse dropdown - فقط مخازن الإكسسوارات
  const targetSelect = document.getElementById('transferTargetWarehouse');
  if (targetSelect) {
    // تصفية: فقط مخازن الإكسسوارات
    // - المخازن الأساسية: type = 'accessories'
    // - المخازن التخزينية: is_storage_only = 1 AND storage_type = 'accessories'
    const accessoryWarehouses = availableWarehouses.filter(w => {
      if (Number(w.id) === normalizedCurrentWid) return false;

      // مخزن أساسي للإكسسوارات
      if (w.type === 'accessories') return true;

      // مخزن تخزيني للإكسسوارات
      if (w.is_storage_only === 1 && w.storage_type === 'accessories') return true;

      return false;
    });

    if (accessoryWarehouses.length === 0) {
      targetSelect.innerHTML = '<option value="">-- لا توجد مخازن إكسسوارات متاحة --</option>';
    } else {
      targetSelect.innerHTML = '<option value="">-- اختر المخزن الوجهة --</option>' +
        accessoryWarehouses
          .map(w => `<option value="${w.id}">${w.icon || '🎧'} ${w.name}</option>`)
          .join('');
    }
  }

  // Populate items list
  renderTransferItemsList();

  // Clear notes
  const notesEl = document.getElementById('transferNotes');
  if (notesEl) notesEl.value = '';

  // Show modal
  modal.style.display = 'flex';
}

function closeBulkTransferModal() {
  const modal = document.getElementById('bulkTransferModal');
  if (modal) modal.style.display = 'none';
}

function renderTransferItemsList() {
  const listEl = document.getElementById('transferItemsList');
  if (!listEl) return;

  const selectedAccessories = allAccessories.filter(a => selectedItems.has(a.id));

  if (selectedAccessories.length === 0) {
    listEl.innerHTML = '<div style="padding: 20px; text-align: center; color: var(--text-secondary);">لا توجد أصناف محددة</div>';
    return;
  }

  listEl.innerHTML = selectedAccessories.map(item => `
    <div class="transfer-item" data-id="${item.id}">
      <div class="transfer-item-info">
        <span style="font-size: 20px;">📦</span>
        <div>
          <div class="transfer-item-name">${escapeHtml(item.name)}</div>
          <div class="transfer-item-meta">
            الكود: ${item.code || item.barcode || '-'} | المتاح: <strong>${item.quantity || 0}</strong>
          </div>
        </div>
      </div>
      <div class="transfer-item-qty">
        <label style="font-size: 12px; color: var(--text-secondary);">كمية:</label>
        <input type="number"
               id="transferQty_${item.id}"
               value="${item.quantity || 1}"
               min="1"
               max="${item.quantity || 1}"
               onchange="validateTransferQty(${item.id}, ${item.quantity || 0})"
        />
        <button class="transfer-item-remove" onclick="removeFromTransfer(${item.id})" title="إزالة">
          ✕
        </button>
      </div>
    </div>
  `).join('');
}

function validateTransferQty(itemId, maxQty) {
  const input = document.getElementById(`transferQty_${itemId}`);
  if (!input) return;

  let value = parseInt(input.value) || 1;
  if (value < 1) value = 1;
  if (value > maxQty) value = maxQty;
  input.value = value;
}

function removeFromTransfer(itemId) {
  selectedItems.delete(itemId);

  // Update checkbox in table
  const checkbox = document.querySelector(`.row-checkbox[data-id="${itemId}"]`);
  if (checkbox) {
    checkbox.checked = false;
    const row = checkbox.closest('tr');
    if (row) row.classList.remove('selected-row');
  }

  updateSelectAllCheckbox();
  updateSelectionUI();
  renderTransferItemsList();

  // Update count
  const countEl = document.getElementById('transferItemsCount');
  if (countEl) countEl.textContent = selectedItems.size;

  // Close modal if no items left
  if (selectedItems.size === 0) {
    closeBulkTransferModal();
    showToast('تم إزالة جميع الأصناف', 'info');
  }
}

async function executeBulkTransfer() {
  const targetWarehouseId = document.getElementById('transferTargetWarehouse')?.value;
  const notes = document.getElementById('transferNotes')?.value || '';

  if (!targetWarehouseId) {
    showToast('⚠️ يرجى اختيار المخزن الوجهة', 'warning');
    return;
  }

  if (selectedItems.size === 0) {
    showToast('⚠️ لا توجد أصناف للتحويل', 'warning');
    return;
  }

  // Build items array
  const items = [];
  for (const itemId of selectedItems) {
    const qtyInput = document.getElementById(`transferQty_${itemId}`);
    const quantity = parseInt(qtyInput?.value) || 1;
    items.push({
      item_type: 'accessory',
      item_id: itemId,
      quantity: quantity
    });
  }

  // Disable button and show loading
  const btn = document.getElementById('btnExecuteTransfer');
  const originalText = btn?.innerHTML;
  if (btn) {
    btn.disabled = true;
    btn.innerHTML = '<span class="spinner" style="width: 18px; height: 18px; margin-left: 8px;"></span> جاري التحويل...';
  }

  try {
    Logger.log('[TRANSFER] Starting bulk transfer:', {
      from: CURRENT_WAREHOUSE_ID,
      to: targetWarehouseId,
      items: items.length
    });

    const response = await fetch('elos-db://warehouse-transfers/bulk', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from_warehouse_id: CURRENT_WAREHOUSE_ID,
        to_warehouse_id: parseInt(targetWarehouseId),
        items: items,
        notes: notes
      })
    });

    const result = await response.json();

    if (!response.ok || !result.success) {
      throw new Error(result.error || 'فشل التحويل');
    }

    Logger.log('[TRANSFER] ✅ Success:', result);

    // Show success message
    const targetWarehouse = availableWarehouses.find(w => w.id == targetWarehouseId);
    showToast(`✅ ${result.message}`, 'success', 4000);

    // Show detailed result if there were errors
    if (result.errors && result.errors.length > 0) {
      setTimeout(() => {
        showToast(`⚠️ ${result.errors.length} أخطاء: ${result.errors.map(e => e.name || e.item_id).join(', ')}`, 'warning', 5000);
      }, 1000);
    }

    // Close modal and clear selection
    closeBulkTransferModal();
    clearSelection();

    // Reload data
    AccessoryCache.clear();
    await loadAccessories();

  } catch (error) {
    Logger.error('[TRANSFER] Error:', error);
    showToast(`❌ ${error.message}`, 'error');
  } finally {
    // Restore button
    if (btn) {
      btn.disabled = false;
      btn.innerHTML = originalText;
    }
  }
}

// ═════════════════════════════════════
// 🖱️ DRAG & DROP REORDERING
// ═════════════════════════════════════
let draggedRow = null;
let dragPlaceholder = null;

function setupDragAndDrop() {
  const tbody = document.getElementById('accessoriesTableBody');
  if (!tbody) return;

  // Add drag and drop styles
  addDragDropStyles();

  // Use event delegation for dynamically created rows
  tbody.addEventListener('mousedown', handleDragStart);
  document.addEventListener('mousemove', handleDragMove);
  document.addEventListener('mouseup', handleDragEnd);

  Logger.log('[DRAG-DROP] ✅ Setup complete');
}

function addDragDropStyles() {
  if (document.getElementById('drag-drop-styles')) return;

  const style = document.createElement('style');
  style.id = 'drag-drop-styles';
  style.textContent = `
    .accessory-row {
      position: relative;
    }
    .accessory-row::before {
      content: '⠿';
      position: absolute;
      left: 8px;
      top: 50%;
      transform: translateY(-50%);
      font-size: 14px;
      color: var(--text-secondary);
      opacity: 0;
      cursor: grab;
      transition: opacity 0.2s ease;
      z-index: 5;
    }
    .accessory-row:hover::before {
      opacity: 0.5;
    }
    .accessory-row.dragging {
      opacity: 0.4;
      background: rgba(59,130,246,0.1) !important;
    }
    .accessory-row.drag-over {
      border-top: 2px solid var(--accent) !important;
    }
    .accessory-row.drag-over-bottom {
      border-bottom: 2px solid var(--accent) !important;
    }
    .drag-ghost {
      position: fixed;
      pointer-events: none;
      z-index: 10000;
      background: var(--bg-secondary);
      border: 2px solid var(--accent);
      border-radius: 8px;
      padding: 10px 16px;
      box-shadow: 0 8px 24px rgba(0,0,0,0.4);
      font-weight: 600;
      color: var(--text-primary);
      display: flex;
      align-items: center;
      gap: 8px;
    }
    .drag-placeholder {
      height: 50px;
      background: rgba(59,130,246,0.1);
      border: 2px dashed var(--accent);
      border-radius: 6px;
    }
    .drag-handle {
      cursor: grab;
      padding: 4px;
      opacity: 0.4;
      transition: opacity 0.2s;
    }
    .accessory-row:hover .drag-handle {
      opacity: 1;
    }
  `;
  document.head.appendChild(style);
}

function handleDragStart(e) {
  // Only handle drag from the row itself, not from buttons or inputs
  if (e.target.tagName === 'BUTTON' || e.target.tagName === 'INPUT' ||
      e.target.closest('button') || e.target.closest('input') ||
      e.target.closest('.quick-edit-cell.editing')) {
    return;
  }

  const row = e.target.closest('.accessory-row');
  if (!row) return;

  // Check if right-click
  if (e.button !== 0) return;

  // Prevent text selection
  e.preventDefault();

  draggedRow = row;
  draggedRow.classList.add('dragging');

  // Create ghost element
  const ghost = document.createElement('div');
  ghost.className = 'drag-ghost';
  ghost.innerHTML = `📦 ${row.querySelector('td:nth-child(2)')?.textContent || 'صنف'}`;
  ghost.style.left = `${e.clientX + 10}px`;
  ghost.style.top = `${e.clientY + 10}px`;
  ghost.id = 'dragGhost';
  document.body.appendChild(ghost);
}

function handleDragMove(e) {
  if (!draggedRow) return;

  // Move ghost
  const ghost = document.getElementById('dragGhost');
  if (ghost) {
    ghost.style.left = `${e.clientX + 10}px`;
    ghost.style.top = `${e.clientY + 10}px`;
  }

  // Find row under cursor
  const tbody = document.getElementById('accessoriesTableBody');
  const rows = tbody.querySelectorAll('.accessory-row:not(.dragging)');

  // Clear all drag-over classes
  rows.forEach(row => {
    row.classList.remove('drag-over', 'drag-over-bottom');
  });

  // Find target row
  for (const row of rows) {
    const rect = row.getBoundingClientRect();
    const midY = rect.top + rect.height / 2;

    if (e.clientY >= rect.top && e.clientY <= rect.bottom) {
      if (e.clientY < midY) {
        row.classList.add('drag-over');
      } else {
        row.classList.add('drag-over-bottom');
      }
      break;
    }
  }
}

function handleDragEnd(e) {
  if (!draggedRow) return;

  // Remove ghost
  const ghost = document.getElementById('dragGhost');
  if (ghost) ghost.remove();

  // Find target row
  const tbody = document.getElementById('accessoriesTableBody');
  const targetOver = tbody.querySelector('.drag-over');
  const targetBottom = tbody.querySelector('.drag-over-bottom');

  // Perform reorder
  if (targetOver && targetOver !== draggedRow) {
    targetOver.parentNode.insertBefore(draggedRow, targetOver);
    showToast('🔄 تم إعادة الترتيب', 'info', 1500);
    saveRowOrder();
  } else if (targetBottom && targetBottom !== draggedRow) {
    targetBottom.parentNode.insertBefore(draggedRow, targetBottom.nextSibling);
    showToast('🔄 تم إعادة الترتيب', 'info', 1500);
    saveRowOrder();
  }

  // Clean up
  draggedRow.classList.remove('dragging');
  tbody.querySelectorAll('.accessory-row').forEach(row => {
    row.classList.remove('drag-over', 'drag-over-bottom');
  });

  draggedRow = null;
}

function saveRowOrder() {
  // Get new order of IDs
  const rows = document.querySelectorAll('.accessory-row');
  const newOrder = Array.from(rows).map(row => parseInt(row.dataset.id));

  // Save to localStorage for this warehouse
  const key = `warehouse_${CURRENT_WAREHOUSE_ID}_order`;
  localStorage.setItem(key, JSON.stringify(newOrder));

  Logger.log('[DRAG-DROP] Order saved:', newOrder.slice(0, 5), '...');
}

function getCustomRowOrder() {
  const key = `warehouse_${CURRENT_WAREHOUSE_ID}_order`;
  try {
    const saved = localStorage.getItem(key);
    return saved ? JSON.parse(saved) : null;
  } catch {
    return null;
  }
}

// ═════════════════════════════════════════════════════════════
// 🎭 MODALS - ADD SINGLE & BULK ADD
// ═════════════════════════════════════════════════════════════

// Global variables
let bulkItemCounter = 0;

// ═══════════════════════════════════
// 📊 UPDATE SIDEBAR STATS
// ═══════════════════════════════════
function updateSidebarStats() {
  if (!allAccessories || !Array.isArray(allAccessories)) {
    Logger.warn('[STATS] allAccessories not ready yet');
    return;
  }

  const totalItems = allAccessories.length;
  const threshold = parseInt((JSON.parse(localStorage.getItem('appSettings') || '{}')).stockThreshold, 10) || 10;
  const lowStock = allAccessories.filter(a => a.quantity > 0 && a.quantity < threshold).length;
  const outOfStock = allAccessories.filter(a => a.quantity === 0).length;

  const totalEl = document.getElementById('sidebarTotalItems');
  const lowEl = document.getElementById('sidebarLowStock');
  const outEl = document.getElementById('sidebarOutOfStock');

  if (totalEl) totalEl.textContent = totalItems;
  if (lowEl) lowEl.textContent = lowStock;
  if (outEl) outEl.textContent = outOfStock;
}

// ═════════════════════════════════════
// 🖨️ PRINT BARCODE MODAL
// ═════════════════════════════════════
let currentPrintAccessory = null;

function openPrintBarcodeModal(id) {
  const accessory = allAccessories.find(a => a.id === id);
  if (!accessory) {
    showToast('الإكسسوار غير موجود', 'error');
    return;
  }

  // استخراج الباركود القصير (short_code) أولاً، ثم barcode، ثم code
  const barcodeCode = accessory.short_code || accessory.barcode || accessory.code;
  
  if (!barcodeCode) {
    showToast('⚠️ هذا الصنف ليس له باركود', 'warning');
    return;
  }

  // ✅ استخدام modal المعاينة أولاً (BarcodeGenerator) - يعرض الخيارات قبل الطباعة
  // التحقق من وجود BarcodeGenerator.showBarcodePreviewModal
  // هذه الدالة تفتح modal معاينة يسمح باختيار:
  // - نوع الملصق: عادي أو مقسوم (2×)
  // - إظهار السعر: نعم/لا
  // - عدد النسخ: 1-100
  // ثم يطبع بعد اختيار الإعدادات
  
  if (window.BarcodeGenerator && typeof window.BarcodeGenerator.showBarcodePreviewModal === 'function') {
    try {
      // ✅ استخدام barcode أو code أولاً (لضمان استخدام القيمة الكاملة)
      // ثم نستخدم short_code فقط إذا لم يكن barcode أو code موجودين
      const accessoryData = {
        ...accessory, // ✅ تمرير جميع بيانات الإكسسوار
        barcode: accessory.barcode || accessory.code || accessory.short_code, // استخدام barcode أو code أولاً
        short_code: accessory.short_code,
        code: accessory.code || accessory.barcode, // التأكد من وجود code
        sale_price: accessory.sale_price || accessory.sell_price || accessory.price || 0
      };
      
      Logger.log('[PRINT] ✅ Calling showBarcodePreviewModal with accessory:', accessory.id, accessory.name);
      Logger.log('[PRINT] Accessory barcode fields:', { 
        barcode: accessory.barcode, 
        code: accessory.code, 
        short_code: accessory.short_code,
        final_barcode: accessoryData.barcode 
      });
      
      // ✅ استدعاء modal المعاينة (يجب أن يظهر قبل الطباعة)
      // هذا الـ modal يسمح باختيار:
      // - نوع الملصق (عادي/مقسوم)
      // - إظهار السعر أم لا
      // - عدد النسخ
      // ثم يطبع بعد اختيار الإعدادات
      window.BarcodeGenerator.showBarcodePreviewModal(accessoryData, 'accessory');
      Logger.log('[PRINT] ✅ showBarcodePreviewModal called successfully');
      return;
    } catch (error) {
      Logger.error('[PRINT] ❌ Error opening preview modal:', error);
      Logger.error('[PRINT] Error stack:', error.stack);
      showToast('خطأ في فتح نافذة المعاينة: ' + error.message, 'error');
      // Fallback إلى modal القديم في حالة الخطأ
    }
  } else {
    Logger.warn('[PRINT] ⚠️ BarcodeGenerator.showBarcodePreviewModal not available');
    Logger.warn('[PRINT] BarcodeGenerator:', typeof window.BarcodeGenerator);
    if (window.BarcodeGenerator) {
      Logger.warn('[PRINT] showBarcodePreviewModal:', typeof window.BarcodeGenerator.showBarcodePreviewModal);
    }
    showToast('⚠️ نظام المعاينة غير متاح، سيتم استخدام النافذة القديمة', 'warning');
    // Fallback إلى modal القديم
  }

  // Fallback to old modal
  currentPrintAccessory = accessory;

  // Fill info - استخدام الباركود القصير أولاً (استخدام نفس المتغير المعرّف أعلاه)
  document.getElementById('printAccessoryName').textContent = accessory.name;
  document.getElementById('printBarcodeValue').textContent = barcodeCode;

  // Reset options
  document.getElementById('printCopies').value = 1;
  document.getElementById('printSize').value = 'medium';
  document.getElementById('printWithName').checked = true;
  document.getElementById('printWithPrice').checked = false;

  // Generate preview
  updateBarcodePreview();

  // Open modal
  document.getElementById('printBarcodeModal').classList.add('active');
  document.body.style.overflow = 'hidden';

  Logger.log('[PRINT] Opening print modal for:', accessory);
}

function closePrintBarcodeModal() {
  document.getElementById('printBarcodeModal').classList.remove('active');
  document.body.style.overflow = '';
  currentPrintAccessory = null;
}

function updateBarcodePreview() {
  if (!currentPrintAccessory) return;
  
  const copies = parseInt(document.getElementById('printCopies').value) || 1;
  const size = document.getElementById('printSize').value;
  const withName = document.getElementById('printWithName').checked;
  const withPrice = document.getElementById('printWithPrice').checked;
  
  const container = document.getElementById('barcodePreviewContainer');
  container.innerHTML = '';
  
  // Generate copies
  for (let i = 0; i < Math.min(copies, 10); i++) { // Preview max 10
    const label = generateBarcodeLabel(currentPrintAccessory, size, withName, withPrice);
    container.appendChild(label);
  }
  
  if (copies > 10) {
    const note = document.createElement('div');
    note.style.cssText = 'color: #666; font-size: 11px; margin-top: 10px; text-align: center;';
    note.textContent = `... وسيتم طباعة ${copies - 10} نسخة إضافية`;
    container.appendChild(note);
  }
}

function generateBarcodeLabel(accessory, size, withName, withPrice) {
  // Use unified BarcodeService if available
  if (typeof BarcodeService !== 'undefined') {
    const labelType = size === 'small' ? 'split' : 'single';
    return BarcodeService.generateLabel(accessory, 'accessory', {
      labelType: labelType,
      showPrice: withPrice
    });
  }
  
  // Use BarcodeGenerator if available (backward compatibility)
  if (typeof BarcodeGenerator !== 'undefined') {
    return BarcodeGenerator.generateAccessoryBarcodeLabel(accessory, { size });
  }

  // Fallback to original implementation
  Logger.warn('[BARCODE] Using fallback implementation - barcode-service.js not loaded');
  const label = document.createElement('div');
  label.className = `barcode-label size-${size}`;

  const shopName = getShopNameForBarcode();
  const shop = document.createElement('div');
  shop.className = 'barcode-shop-name';
  shop.style.cssText = 'font-weight: bold; font-size: 14px; border-bottom: 2px solid #000; padding-bottom: 5px; margin-bottom: 8px;';
  shop.textContent = shopName;
  label.appendChild(shop);

  if (withName) {
    const name = document.createElement('div');
    name.className = 'barcode-product-name';
    name.textContent = accessory.name;
    label.appendChild(name);
  }

  // استخراج الباركود القصير (short_code) أولاً
  const barcodeValue = accessory.short_code || accessory.barcode || accessory.code;
  const barcodeSvg = generateBarcodeSVG(barcodeValue, size);
  label.appendChild(barcodeSvg);

  const number = document.createElement('div');
  number.className = 'barcode-number';
  number.textContent = barcodeValue;
  label.appendChild(number);

  if (accessory.sale_price) {
    const price = document.createElement('div');
    price.className = 'barcode-price';
    price.style.cssText = 'font-weight: bold; background: #f0f0f0; padding: 5px 10px; border-radius: 4px; margin-top: 5px;';
    price.textContent = `${fmt(accessory.sale_price)} ج.م`;
    label.appendChild(price);
  }

  return label;
}

function getShopNameForBarcode() {
  try {
    const settings = JSON.parse(localStorage.getItem('appSettings') || '{}');
    return settings.companyName || 'ELOS';
  } catch (e) {
    return 'ELOS';
  }
}

function generateBarcodeSVG(code, size) {
  // Use unified BarcodeService if available
  if (typeof BarcodeService !== 'undefined') {
    const width = size === 'small' ? 130 : 200;
    const height = size === 'small' ? 30 : 50;
    const svgHTML = BarcodeService.generateCode128SVG(code, width, height);
    const tempDiv = document.createElement('div');
    tempDiv.innerHTML = svgHTML;
    return tempDiv.firstElementChild || tempDiv;
  }
  
  // Fallback implementation
  Logger.warn('[BARCODE] Using fallback SVG generation - barcode-service.js not loaded');
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('class', 'barcode-image');
  svg.setAttribute('viewBox', '0 0 200 60');
  svg.setAttribute('preserveAspectRatio', 'xMidYMid meet');
  
  let x = 10;
  const barWidth = 180 / (code.length * 2);
  
  for (let i = 0; i < code.length; i++) {
    const charCode = code.charCodeAt(i);
    const isWide = charCode % 2 === 0;
    
    // Black bar
    const rect1 = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
    rect1.setAttribute('x', x);
    rect1.setAttribute('y', '5');
    rect1.setAttribute('width', isWide ? barWidth * 1.5 : barWidth);
    rect1.setAttribute('height', '50');
    rect1.setAttribute('fill', '#000');
    svg.appendChild(rect1);
    
    x += isWide ? barWidth * 1.5 : barWidth;
    
    // White space
    x += barWidth * 0.8;
  }
  
  return svg;
}

function printBarcode() {
  if (!currentPrintAccessory) return;
  
  const copies = parseInt(document.getElementById('printCopies').value) || 1;
  const size = document.getElementById('printSize').value;
  const withName = document.getElementById('printWithName').checked;
  const withPrice = document.getElementById('printWithPrice').checked;
  
  // Generate all copies for print
  const container = document.getElementById('barcodePreviewContainer');
  container.innerHTML = '';
  
  for (let i = 0; i < copies; i++) {
    const label = generateBarcodeLabel(currentPrintAccessory, size, withName, withPrice);
    container.appendChild(label);
  }
  
  // Print
  setTimeout(() => {
    window.print();
    
    // Restore preview after print
    setTimeout(() => {
      updateBarcodePreview();
    }, 500);
  }, 100);
  
  Logger.log('[PRINT] Printing', copies, 'copies');
}

// ═════════════════════════════════════
// 📊 BARCODE GENERATOR
// ═════════════════════════════════════
async function generateBarcode() {
  try {
    // Use unified BarcodeService if available
    if (typeof BarcodeService !== 'undefined') {
      const barcodes = allAccessories
        .map(a => a.code)
        .filter(code => code && /^\d+$/.test(code));
      
      const newBarcode = BarcodeService.generateNewBarcode(barcodes);
      
      if (newBarcode) {
        const input = document.getElementById('singleCode');
        if (input) {
          input.value = newBarcode;
          input.focus();
          
          input.style.background = 'rgba(34,197,94,0.1)';
          input.style.borderColor = 'var(--success)';
          
          setTimeout(() => {
            input.style.background = '';
            input.style.borderColor = '';
          }, 1000);
          
          showToast(`✅ تم توليد باركود: ${newBarcode}`, 'success', 2000);
          Logger.log('[BARCODE] Generated:', newBarcode);
        }
      } else {
        showToast('❌ فشل توليد الباركود', 'error');
      }
      return;
    }
    
    // Fallback to old implementation
    const barcodes = allAccessories
      .map(a => a.code)
      .filter(code => code && /^\d+$/.test(code))
      .map(code => parseInt(code))
      .filter(num => !isNaN(num));
    
    let newBarcode;
    
    if (barcodes.length === 0) {
      newBarcode = '1000000001';
    } else {
      const maxBarcode = Math.max(...barcodes);
      newBarcode = (maxBarcode + 1).toString();
    }
    
    const input = document.getElementById('singleCode');
    if (input) {
      input.value = newBarcode;
      input.focus();
      
      input.style.background = 'rgba(34,197,94,0.1)';
      input.style.borderColor = 'var(--success)';
      
      setTimeout(() => {
        input.style.background = '';
        input.style.borderColor = '';
      }, 1000);
      
      showToast(`✅ تم توليد باركود: ${newBarcode}`, 'success', 2000);
      Logger.log('[BARCODE] Generated:', newBarcode);
    }
    
  } catch (error) {
    Logger.error('[BARCODE] Error:', error);
    showToast('❌ فشل توليد الباركود', 'error');
  }
}

// Focus barcode input when modal opens
function openAddSingleModal() {
  const modal = document.getElementById('addSingleModal');
  if (!modal) return;

  document.getElementById('addSingleForm')?.reset();
  modal.classList.add('active');
  document.body.style.overflow = 'hidden';
  
  // Focus barcode input for scanner
  setTimeout(() => {
    const barcodeInput = document.getElementById('singleCode');
    if (barcodeInput) {
      barcodeInput.focus();
      
      // Use unified BarcodeService scanner if available
      if (typeof BarcodeService !== 'undefined') {
        BarcodeService.setupScanner(barcodeInput, (barcode) => {
          Logger.log('[SCANNER] Detected barcode:', barcode);
          showToast(`📊 تم قراءة الباركود من السكانر`, 'success', 2000);
          document.getElementById('singleName')?.focus();
        });
      } else {
        // Fallback scanner implementation
        let scanBuffer = '';
        let scanTimeout = null;
        
        const handleScan = (e) => {
          if (scanTimeout) clearTimeout(scanTimeout);
          
          if (e.key && e.key.length === 1) {
            scanBuffer += e.key;
          }
          
          if (e.key === 'Enter' && scanBuffer.length > 3) {
            e.preventDefault();
            Logger.log('[SCANNER] Detected barcode:', scanBuffer);
            barcodeInput.value = scanBuffer;
            
            barcodeInput.style.background = 'rgba(34,197,94,0.1)';
            barcodeInput.style.borderColor = 'var(--success)';
            
            setTimeout(() => {
              barcodeInput.style.background = '';
              barcodeInput.style.borderColor = '';
            }, 500);
            
            showToast(`📊 تم قراءة الباركود من السكانر`, 'success', 2000);
            scanBuffer = '';
            document.getElementById('singleName')?.focus();
            return;
          }
          
          scanTimeout = setTimeout(() => {
            scanBuffer = '';
          }, 100);
        };
        
        barcodeInput.addEventListener('keypress', handleScan);
        barcodeInput._scanHandler = handleScan;
      }
    }
  }, 100);
}

// ═════════════════════════════════════
// ➕ ADD SINGLE MODAL
// ═════════════════════════════════════
function closeAddSingleModal() {
  const modal = document.getElementById('addSingleModal');
  if (!modal) return;
  
  // Remove scanner handler
  const barcodeInput = document.getElementById('singleCode');
  if (barcodeInput && barcodeInput._scanHandler) {
    barcodeInput.removeEventListener('keypress', barcodeInput._scanHandler);
    delete barcodeInput._scanHandler;
  }
  
  modal.classList.remove('active');
  document.body.style.overflow = '';
}

async function handleAddSingle(event) {
  event.preventDefault();

  const submitBtn = document.getElementById('singleSubmitBtn');
  const originalText = submitBtn.textContent;

  try {
    submitBtn.disabled = true;
    submitBtn.textContent = '⏳ جاري الإضافة...';

    // Get warehouse ID
    const warehouseId = CURRENT_WAREHOUSE_ID;
    if (!warehouseId) {
      throw new Error('لم يتم تحديد مخزن');
    }

    const formData = {
      warehouse_id: parseInt(warehouseId),
      name: document.getElementById('singleName').value.trim(),
      code: document.getElementById('singleCode').value.trim() || null,
      category: document.getElementById('singleCategory').value.trim() || null,
      brand: document.getElementById('singleBrand').value.trim() || null,
      condition: document.getElementById('singleCondition').value,
      quantity: parseInt(document.getElementById('singleQuantity').value) || 0,
      purchase_price: parseFloat(document.getElementById('singlePurchasePrice').value) || 0,
      sale_price: parseFloat(document.getElementById('singleSalePrice').value) || 0,
      status: document.getElementById('singleStatus').value,
      location: document.getElementById('singleLocation').value.trim() || null,
      notes: document.getElementById('singleNotes').value.trim() || null,
      is_active: 1
    };

    Logger.log('[ADD-SINGLE] Submitting:', formData);

    const response = await fetch('elos-db://accessories', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(formData)
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'فشل إضافة الصنف');
    }

    const result = await response.json();
    Logger.log('[ADD-SINGLE] ✅ Success:', result);

    // Note: Backend already records opening balance movement in POST /accessories
    // No need to record it again here to avoid doubling the quantity

    // Clear cache and reload
    AccessoryCache.clear();
    await loadStats();
    await loadAccessories();
    updateSidebarStats();
    closeAddSingleModal();
    showToast('✅ تم إضافة الصنف بنجاح');
    
    // ═══════════════════════════════════════════════════════════════
    // 🏷️ سؤال المستخدم عن طباعة الباركود (الباركود القصير 6 أرقام)
    // ═══════════════════════════════════════════════════════════════
    if (typeof showBarcodePreviewModal === 'function' && result.id) {
      const shortCode = result.short_code || '';
      
      const accessoryForBarcode = {
        id: result.id,
        name: formData.name,
        category: formData.category,
        brand: formData.brand,
        short_code: shortCode,
        sale_price: formData.sale_price
      };

      const wantPrint = await showConfirm(
        `🏷️ هل تريد طباعة باركود للإكسسوار؟\n\n📦 ${formData.name}\n📁 ${formData.category || '-'}\n🏷️ كود: ${shortCode || 'غير متوفر'}`,
        'طباعة باركود', 'لاحقاً', 'info'
      );

      if (wantPrint && shortCode) {
        showBarcodePreviewModal(accessoryForBarcode, 'accessory');
      }
    }

  } catch (error) {
    Logger.error('[ADD-SINGLE] ❌ Error:', error);
    showToast(error.message || 'فشل إضافة الصنف', 'error');
  } finally {
    submitBtn.disabled = false;
    submitBtn.textContent = originalText;
  }
}

// ═══════════════════════════════════
// 📦 BULK ADD MODAL
// ═══════════════════════════════════
function openBulkAddModal() {
  const modal = document.getElementById('bulkAddModal');
  if (!modal) return;

  bulkItemCounter = 0;
  document.getElementById('bulkAddForm')?.reset();
  document.getElementById('bulkItemsContainer').innerHTML = '';

  // Set date to today
  const today = new Date().toISOString().split('T')[0];
  document.getElementById('bulkDate').value = today;

  // Populate supplier dropdown
  const supplierSelect = document.getElementById('bulkSupplierId');
  if (supplierSelect) {
    const supplierOptions = allSuppliers
      .filter(s => s.is_active !== 0)
      .map(s => `<option value="${s.id}">${s.name}</option>`)
      .join('');
    supplierSelect.innerHTML = `<option value="">بدون مورد محدد</option>${supplierOptions}`;
  }

  // Add first item
  addBulkItem();

  updateBulkTotals();

  modal.classList.add('active');
  document.body.style.overflow = 'hidden';
}

function closeBulkAddModal() {
  const modal = document.getElementById('bulkAddModal');
  if (!modal) return;
  modal.classList.remove('active');
  document.body.style.overflow = '';
}

function addBulkItem() {
  const container = document.getElementById('bulkItemsContainer');
  if (!container) return;

  const itemId = bulkItemCounter++;

  const accessoryOptions = allAccessories
    .filter(a => a.is_active !== 0)
    .map(a => `<option value="${a.id}" data-last-price="${a.purchase_price || 0}">${a.name} (${a.quantity || 0})</option>`)
    .join('');

  const itemHTML = `
    <div class="bulk-item" id="bulk-item-${itemId}">
      <div class="form-group">
        <label class="form-label">
          <span>الإكسسوار</span>
          <span class="required">*</span>
        </label>
        <div class="select-with-button">
          <select class="form-select" data-item="${itemId}" data-field="accessory" required onchange="onAccessorySelect(this)">
            <option value="">اختر الإكسسوار...</option>
            ${accessoryOptions}
          </select>
          <button type="button" class="btn-add-new" onclick="openQuickAddAccessoryModal(${itemId})" title="إضافة إكسسوار">➕</button>
        </div>
      </div>

      <div class="form-group">
        <label class="form-label">
          <span>الكمية</span>
          <span class="required">*</span>
        </label>
        <input type="number" class="form-input" data-item="${itemId}" data-field="quantity" min="1" step="1" required oninput="updateBulkTotals()" />
      </div>

      <div class="form-group">
        <label class="form-label">
          <span>سعر الشراء</span>
          <span class="required">*</span>
        </label>
        <input type="number" class="form-input" data-item="${itemId}" data-field="price" min="0" step="0.01" required oninput="updateBulkTotals()" placeholder="آخر سعر: -" />
      </div>

      <button type="button" class="btn-remove-item" onclick="removeBulkItem(${itemId})">🗑️</button>
    </div>
  `;

  container.insertAdjacentHTML('beforeend', itemHTML);
}

function removeBulkItem(itemId) {
  const item = document.getElementById(`bulk-item-${itemId}`);
  if (item) {
    item.remove();
    updateBulkTotals();
  }
}

// ═════════════════════════════════════
// 📝 ON ACCESSORY SELECT - Auto-fill last price
// ═════════════════════════════════════
function onAccessorySelect(selectElement) {
  const selectedOption = selectElement.options[selectElement.selectedIndex];
  const lastPrice = selectedOption.getAttribute('data-last-price');
  
  if (lastPrice && lastPrice !== '0') {
    // Find the price input in the same bulk-item
    const bulkItem = selectElement.closest('.bulk-item');
    const priceInput = bulkItem.querySelector('[data-field="price"]');
    
    if (priceInput) {
      priceInput.value = lastPrice;
      priceInput.placeholder = `آخر سعر: ${fmt(parseFloat(lastPrice))} ج.م`;
      Logger.log(`[BULK-ADD] Auto-filled price: ${lastPrice}`);
    }
  }
  
  updateBulkTotals();
}

function updateBulkTotals() {
  const container = document.getElementById('bulkItemsContainer');
  if (!container) return;

  const items = container.querySelectorAll('.bulk-item');
  let totalItems = 0;
  let totalQuantity = 0;
  let grandTotal = 0;

  items.forEach(item => {
    const accessorySelect = item.querySelector('[data-field="accessory"]');
    const quantityInput = item.querySelector('[data-field="quantity"]');
    const priceInput = item.querySelector('[data-field="price"]');

    const quantity = parseFloat(quantityInput?.value || 0);
    const price = parseFloat(priceInput?.value || 0);

    if (accessorySelect?.value && quantity > 0 && price >= 0) {
      totalItems++;
      totalQuantity += quantity;
      grandTotal += quantity * price;
    }
  });

  document.getElementById('bulkItemsCount').textContent = totalItems;
  document.getElementById('bulkTotalQuantity').textContent = totalQuantity;
  document.getElementById('bulkGrandTotal').textContent = `${grandTotal.toFixed(2)} ج.م`;
}

async function handleBulkAdd(event) {
  event.preventDefault();

  const submitBtn = document.getElementById('bulkSubmitBtn');
  const originalText = submitBtn.textContent;

  try {
    submitBtn.disabled = true;
    submitBtn.textContent = '⏳ جاري الحفظ...';

    // Collect items
    const container = document.getElementById('bulkItemsContainer');
    const items = [];

    container.querySelectorAll('.bulk-item').forEach(item => {
      const accessoryId = parseInt(item.querySelector('[data-field="accessory"]')?.value);
      const quantity = parseInt(item.querySelector('[data-field="quantity"]')?.value);
      const unitPrice = parseFloat(item.querySelector('[data-field="price"]')?.value);

      if (accessoryId && quantity > 0 && unitPrice >= 0) {
        items.push({ accessory_id: accessoryId, quantity, unit_price: unitPrice });
      }
    });

    if (items.length === 0) {
      throw new Error('يجب إضافة صنف واحد على الأقل');
    }

    const bulkData = {
      date: document.getElementById('bulkDate').value,
      supplier_id: document.getElementById('bulkSupplierId').value || null,
      notes: document.getElementById('bulkNotes').value.trim() || 'رصيد افتتاحي',
      items: items
    };

    Logger.log('[BULK-ADD] Submitting:', bulkData);

    // Save each item as a movement
    for (const item of items) {
      // Get current quantity
      const accessory = allAccessories.find(a => a.id === item.accessory_id);
      const currentQty = accessory ? accessory.quantity : 0;

      Logger.log(`[BULK-ADD] Adding movement for accessory ${item.accessory_id}: ${currentQty} -> ${currentQty + item.quantity}`);

      const response = await fetch('elos-db://accessory-movements', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          accessory_id: item.accessory_id,
          type: 'initial',  // رصيد افتتاحي - مش عملية شراء
          quantity: item.quantity,
          quantity_before: currentQty,
          quantity_after: currentQty + item.quantity,
          unit_price: item.unit_price,
          total_price: item.quantity * item.unit_price,
          supplier_id: bulkData.supplier_id,
          notes: bulkData.notes,
          reason: 'رصيد افتتاحي'
        })
      });

      Logger.log(`[BULK-ADD] Response status: ${response.status}`);
      
      if (!response.ok) {
        let errorMsg = `HTTP ${response.status}`;
        try {
          const errorText = await response.text();
          Logger.error(`[BULK-ADD] Error response:`, errorText);
          errorMsg = errorText || errorMsg;
        } catch (e) {
          Logger.error(`[BULK-ADD] Could not parse error:`, e);
        }
        throw new Error(`فشل حفظ الحركة: ${errorMsg}`);
      }

      let result;
      try {
        result = await response.json();
      } catch (parseError) {
        const text = await response.text();
        Logger.error(`[BULK-ADD] Invalid JSON response:`, text);
        throw new Error(`استجابة غير صحيحة من الخادم`);
      }
      
      Logger.log(`[BULK-ADD] Movement result:`, result);
      
      if (!result.success) {
        throw new Error(result.error || result.message || 'فشل حفظ الحركة');
      }
    }

    Logger.log('[BULK-ADD] ✅ All movements saved, reloading data...');

    // Clear cache to force fresh data
    AccessoryCache.clear();
    
    // Reload all data
    await loadAccessories();
    await loadStats();
    updateSidebarStats();
    closeBulkAddModal();
    showToast(`✅ تم إضافة ${items.length} صنف بنجاح`);

  } catch (error) {
    Logger.error('[BULK-ADD] ❌ Error:', error);
    showToast(error.message || 'فشل حفظ الكميات', 'error');
  } finally {
    submitBtn.disabled = false;
    submitBtn.textContent = originalText;
  }
}

// ═══════════════════════════════════
// ➕ QUICK ADD ACCESSORY (from bulk)
// ═══════════════════════════════════
let currentBulkItemId = null;

function openQuickAddAccessoryModal(itemId) {
  currentBulkItemId = itemId;
  const modal = document.getElementById('quickAddAccessoryModal');
  if (!modal) return;

  document.getElementById('quickAddAccessoryForm')?.reset();
  modal.classList.add('active');
}

function closeQuickAddAccessoryModal() {
  const modal = document.getElementById('quickAddAccessoryModal');
  if (!modal) return;
  modal.classList.remove('active');
  currentBulkItemId = null;
}

async function handleQuickAddAccessory(event) {
  event.preventDefault();

  const submitBtn = document.getElementById('quickAccessoryBtn');
  const originalText = submitBtn.textContent;

  try {
    submitBtn.disabled = true;
    submitBtn.textContent = '⏳ جاري الإضافة...';

    const formData = {
      name: document.getElementById('quickAccessoryName').value.trim(),
      category: document.getElementById('quickAccessoryCategory').value.trim() || null,
      brand: document.getElementById('quickAccessoryBrand').value.trim() || null,
      quantity: 0,
      is_active: 1
    };

    Logger.log('[QUICK-ADD-ACCESSORY] Submitting:', formData);

    const response = await fetch('elos-db://accessories', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(formData)
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'فشل إضافة الإكسسوار');
    }

    const result = await response.json();
    Logger.log('[QUICK-ADD-ACCESSORY] ✅ Success:', result);

    // Reload accessories
    const accessoriesRes = await fetch('elos-db://accessories');
    if (accessoriesRes.ok) {
      allAccessories = await accessoriesRes.json();
      
      // Update the dropdown in bulk modal
      if (currentBulkItemId !== null) {
        const select = document.querySelector(`[data-item="${currentBulkItemId}"][data-field="accessory"]`);
        if (select) {
          const options = allAccessories
            .filter(a => a.is_active !== 0)
            .map(a => `<option value="${a.id}">${a.name} (${a.quantity || 0})</option>`)
            .join('');
          select.innerHTML = `<option value="">اختر الإكسسوار...</option>${options}`;
          select.value = result.id;
        }
      }
    }

    closeQuickAddAccessoryModal();
    showToast('✅ تم إضافة الإكسسوار بنجاح');

  } catch (error) {
    Logger.error('[QUICK-ADD-ACCESSORY] ❌ Error:', error);
    showToast(error.message || 'فشل إضافة الإكسسوار', 'error');
  } finally {
    submitBtn.disabled = false;
    submitBtn.textContent = originalText;
  }
}

// Close modals on overlay click
document.addEventListener('click', (e) => {
  if (e.target.classList.contains('modal-overlay')) {
    e.target.classList.remove('active');
    document.body.style.overflow = '';
  }
});