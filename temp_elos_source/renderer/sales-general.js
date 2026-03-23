// ═══════════════════════════════════════════════════════════════
// 📈 ELOS GENERAL SALES SYSTEM - All Sales in One Page
// ═══════════════════════════════════════════════════════════════

// Fallbacks if utils.js not loaded yet
if (!window.Logger) window.Logger = { log: () => {}, warn: () => {}, error: console.error, debug: () => {}, info: () => {} };
if (!window.fmt) window.fmt = (n, decimals = 2) => Number(n || 0).toLocaleString('en-US', { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
if (!window.escapeHtml) window.escapeHtml = (text) => { if (text === null || text === undefined) return ''; const div = document.createElement('div'); div.textContent = String(text); return div.innerHTML; };
const fmt = window.fmt;
const escapeHtml = window.escapeHtml;

// ═════════════════════════════════════
// 🛠️ UTILITIES (Using Shared)
// ═════════════════════════════════════
const todayISO = window.SalesShared?.todayISO || (() => new Date().toISOString().slice(0, 10));
const debounce = window.SalesShared?.debounce || function(func, delay = 300) {
  let timeoutId;
  return function (...args) {
    clearTimeout(timeoutId);
    timeoutId = setTimeout(() => func.apply(this, args), delay);
  };
};

const searchDebounceDelay = window.SalesConstants?.TIMING.SEARCH_DEBOUNCE || 200;
const debouncedRenderTable = debounce(renderTable, searchDebounceDelay);

// ═════════════════════════════════════
// 💾 CACHE SYSTEM (Using Shared)
// ═════════════════════════════════════
const SalesCache = window.SalesShared?.createCache('generalSalesCache') || {
  data: null,
  timestamp: null,
  cacheKey: null,
  duration: window.SalesConstants?.CACHE.DURATION || 5 * 60 * 1000,
  set(data, key) {
    this.data = data;
    this.timestamp = Date.now();
    this.cacheKey = key;
    try {
      sessionStorage.setItem('generalSalesCache', JSON.stringify({
        data: data,
        timestamp: this.timestamp,
        cacheKey: key
      }));
    } catch (e) {
      Logger.warn('Cache storage failed:', e);
    }
  },
  get() {
    if (this.data && this.timestamp && (Date.now() - this.timestamp < this.duration)) {
      return this.data;
    }
    try {
      const cached = sessionStorage.getItem('generalSalesCache');
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
      sessionStorage.removeItem('generalSalesCache');
    } catch (e) {}
  }
};

// ═════════════════════════════════════
// 📊 STATE MANAGEMENT
// ═════════════════════════════════════
let allSales = []; // Combined sales from all sources
let filteredSales = [];

// Pagination state (Using Shared)
const paginationState = window.SalesShared?.createPaginationState() || {
  currentPage: 1,
  rowsPerPage: window.SalesConstants?.PAGINATION.ROWS_PER_PAGE || 25,
  viewingAll: false,
  reset() { this.currentPage = 1; this.viewingAll = false; },
  getTotalPages(total) { return Math.ceil(total / this.rowsPerPage); },
  getPaginatedData(data) { 
    if (this.viewingAll) return data;
    const start = (this.currentPage - 1) * this.rowsPerPage;
    return data.slice(start, start + this.rowsPerPage);
  }
};

// Backward compatibility
let currentPage = paginationState.currentPage;
let rowsPerPage = paginationState.rowsPerPage;
let viewingAll = paginationState.viewingAll;

// ═════════════════════════════════════
// 🌐 API CALLS
// ═════════════════════════════════════

/**
 * Load device sales
 */
async function loadDeviceSales({ fromISO, toISO }) {
  const p = new URLSearchParams();
  if (fromISO) p.set('from', fromISO);
  if (toISO) p.set('to', toISO);
  
  p.set('include_returned', 'true');
  const res = await fetch('elos-db://sales?' + p.toString());
  if (!res.ok) throw new Error(await res.text());
  
  const sales = await res.json();
  // Normalize device sales data
  return (sales || []).map(sale => ({
    id: sale.id,
    type: 'device',
    sale_type: 'device',
    product_name: `${sale.model || ''} ${sale.type || ''}`.trim() || 'جهاز',
    product_details: `${sale.storage || ''} ${sale.color || ''}`.trim() || '',
    customer_name: sale.customer_name || sale.client_name || '',
    customer_phone: sale.customer_phone || '',
    price: Number(sale.sell_price || 0),
    quantity: 1,
    total: Number(sale.sell_price || 0) - Number(sale.discount || 0),
    discount: Number(sale.discount || 0),
    created_at: sale.created_at,
    status: sale.status || 'completed',
    profit: Number(sale.sell_price || 0) - Number(sale.discount || 0) - Number(sale.purchase_cost || 0),
    // Keep original data for details
    _original: sale
  }));
}

/**
 * Load accessory sales
 */
async function loadAccessorySales({ fromISO, toISO }) {
  const p = new URLSearchParams();
  if (fromISO) p.set('from', fromISO);
  if (toISO) p.set('to', toISO);
  p.set('type', 'sale'); // Only sales, not returns
  
  const res = await fetch('elos-db://accessory-movements?' + p.toString());
  if (!res.ok) throw new Error(await res.text());
  
  const movements = await res.json();
  // Normalize accessory sales data
  return (movements || []).map(movement => ({
    id: movement.id,
    type: 'accessory',
    sale_type: 'accessory',
    product_name: movement.accessory_name || 'إكسسوار',
    product_details: movement.category || '',
    customer_name: movement.client_name || '',
    customer_phone: '',
    price: Number(movement.unit_price || 0),
    quantity: Math.abs(Number(movement.quantity || 1)), // Use absolute value for sales (quantity is negative in DB)
    total: Number(movement.total_price || 0),
    discount: 0,
    created_at: movement.created_at,
    status: 'completed',
    profit: Number(movement.profit || 0),
    // Keep original data for details
    _original: movement
  }));
}

/**
 * Load repair parts sales (from maintenance tickets)
 */
async function loadRepairPartsSales({ fromISO, toISO }) {
  const p = new URLSearchParams();
  if (fromISO) p.set('from', fromISO);
  if (toISO) p.set('to', toISO);

  const res = await fetch('elos-db://repair-parts-sales?' + p.toString());
  if (!res.ok) throw new Error(await res.text());

  const sales = await res.json();
  // Normalize repair parts sales data
  return (sales || []).map(sale => ({
    id: sale.id,
    type: 'repair',
    sale_type: 'repair',
    product_name: sale.part_name || 'قطعة صيانة',
    product_details: sale.part_category || '',
    customer_name: sale.customer_name || '',
    customer_phone: sale.customer_phone || '',
    price: Number(sale.unit_price || 0),
    quantity: Number(sale.quantity || 1),
    total: Number(sale.total_price || sale.unit_price * sale.quantity || 0),
    discount: 0,
    created_at: sale.created_at,
    status: sale.is_delivered ? 'completed' : 'pending',
    profit: Number(sale.total_price || 0) - Number(sale.cost || 0),
    ticket_no: sale.ticket_no,
    // Keep original data for details
    _original: sale
  }));
}

/**
 * Load repair parts POS sales (direct sales from POS)
 */
async function loadRepairPartsPOSSales({ fromISO, toISO }) {
  const p = new URLSearchParams();
  if (fromISO) p.set('from', fromISO);
  if (toISO) p.set('to', toISO);

  const res = await fetch('elos-db://repair-parts-pos-sales?' + p.toString());
  if (!res.ok) throw new Error(await res.text());

  const result = await res.json();
  const sales = result.sales || result || [];

  // Normalize POS repair parts sales data
  return sales.map(sale => ({
    id: `pos_rp_${sale.id}`,
    type: 'repair_pos',
    sale_type: 'repair_pos',
    product_name: sale.part_name || 'قطعة غيار',
    product_details: sale.part_category || sale.part_sku || '',
    customer_name: sale.client_name || '',
    customer_phone: sale.client_phone || '',
    price: Number(sale.unit_price || 0),
    quantity: Number(sale.quantity || 1),
    total: Number(sale.total_price || 0),
    discount: Number(sale.discount || 0),
    created_at: sale.created_at,
    status: 'completed',
    profit: Number(sale.profit || 0),
    payment_method: sale.payment_method || 'cash',
    invoice_number: sale.invoice_number,
    // Keep original data for details
    _original: sale
  }));
}

/**
 * Load all sales from all sources
 */
async function loadAllSales({ fromISO, toISO, forceRefresh = false }) {
  const cacheKey = `all_sales_${fromISO || 'all'}_${toISO || 'all'}`;
  
  // Check cache
  if (!forceRefresh) {
    const cached = SalesCache.get();
    if (cached && cached.cacheKey === cacheKey) {
      Logger.log('[GENERAL-SALES] Using cached data');
      return cached.data;
    }
  }
  
  Logger.log('[GENERAL-SALES] Loading all sales data...');
  showLoading();

  try {
    // Load from all sources in parallel
    const [deviceSales, accessorySales, repairSales, repairPOSSales] = await Promise.all([
      loadDeviceSales({ fromISO, toISO }),
      loadAccessorySales({ fromISO, toISO }),
      loadRepairPartsSales({ fromISO, toISO }),
      loadRepairPartsPOSSales({ fromISO, toISO })
    ]);

    // Combine all sales
    const combined = [
      ...deviceSales,
      ...accessorySales,
      ...repairSales,
      ...repairPOSSales
    ];

    // Sort by date (newest first)
    combined.sort((a, b) => {
      const dateA = new Date(a.created_at || 0);
      const dateB = new Date(b.created_at || 0);
      return dateB - dateA;
    });

    // Cache the result
    SalesCache.set(combined, cacheKey);

    Logger.log(`[GENERAL-SALES] Loaded ${combined.length} total sales (${deviceSales.length} devices, ${accessorySales.length} accessories, ${repairSales.length} repair tickets, ${repairPOSSales.length} repair parts POS)`);
    
    return combined;
  } catch (error) {
    if (window.SalesErrorHandler) {
      window.SalesErrorHandler.showError(error, {
        NETWORK_ERROR: 'فشل الاتصال بالخادم. يرجى التحقق من الاتصال.',
        SERVER_ERROR: 'حدث خطأ في الخادم. يرجى المحاولة مرة أخرى.'
      });
    } else {
      Logger.error('Load all sales error:', error);
      showToast('تعذر تحميل المبيعات: ' + error.message, 'error');
    }
    return [];
  } finally {
    hideLoading();
  }
}

// ═════════════════════════════════════
// 🎨 RENDERING FUNCTIONS
// ═════════════════════════════════════

function getTypeBadge(type) {
  const badges = {
    device: '<span class="badge badge-device">📱 جهاز</span>',
    accessory: '<span class="badge badge-accessory">🎧 إكسسوار</span>',
    repair: '<span class="badge badge-repair">🔧 صيانة</span>',
    repair_pos: '<span class="badge badge-repair-pos">🔩 قطعة غيار</span>'
  };
  return badges[type] || badges.device;
}

function getStatusBadge(status) {
  if (status === 'returned') {
    return '<span class="badge badge-returned">مرتجع</span>';
  }
  if (status === 'pending') {
    return '<span class="badge badge-warning">قيد الانتظار</span>';
  }
  return '<span class="badge badge-completed">مكتمل</span>';
}

function formatDate(isoString) {
  if (!isoString) return '-';
  const d = new Date(isoString);
  return d.toLocaleDateString('ar-EG', { 
    year: 'numeric', 
    month: 'short', 
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
}

function rowHtml(sale, index) {
  const rowClass = sale.status === 'returned' ? 'returned-row' : '';
  
  return `
    <tr class="${rowClass}" data-sale-id="${sale.id}" data-sale-type="${sale.type}">
      <td class="cell-index">${index + 1}</td>
      <td>${getTypeBadge(sale.type)}</td>
      <td class="cell-model">
        <div style="font-weight: 600;">${escapeHtml(sale.product_name)}</div>
        ${sale.product_details ? `<div style="font-size: 11px; color: var(--text-secondary);">${escapeHtml(sale.product_details)}</div>` : ''}
      </td>
      <td class="cell-customer">
        <div>${escapeHtml(sale.customer_name || '-')}</div>
        ${sale.customer_phone ? `<div style="font-size: 11px; color: var(--text-secondary);">${escapeHtml(sale.customer_phone)}</div>` : ''}
      </td>
      <td class="cell-price num">${fmt(sale.quantity === 1 ? sale.total : sale.price)}</td>
      <td class="num">${sale.quantity}</td>
      <td class="cell-price num">${fmt(sale.total)}</td>
      <td class="cell-date">${formatDate(sale.created_at)}</td>
      <td>${getStatusBadge(sale.status)}</td>
    </tr>
  `;
}

function renderTable() {
  const tbody = document.getElementById('rows');
  if (!tbody) return;
  
  const searchTerm = (document.getElementById('q')?.value || '').trim();
  const typeFilter = document.getElementById('typeFilter')?.value || 'all';
  
  // Filter sales
  let filtered = [...allSales];
  
  // Type filter
  if (typeFilter !== 'all') {
    filtered = filtered.filter(s => s.type === typeFilter);
  }
  
  // Search filter (using shared utilities if available)
  if (window.SalesShared && searchTerm) {
    filtered = window.SalesShared.applyQuickSearch(filtered, searchTerm, [
      'product_name',
      'product_details',
      'customer_name',
      'customer_phone',
      'ticket_no'
    ]);
  } else if (searchTerm) {
    // Fallback
    const searchTermLower = searchTerm.toLowerCase();
    filtered = filtered.filter(s => {
      const searchableText = [
        s.product_name,
        s.product_details,
        s.customer_name,
        s.customer_phone,
        s.ticket_no
      ].filter(Boolean).join(' ').toLowerCase();
      
      return searchableText.includes(searchTermLower);
    });
  }
  
  filteredSales = filtered;
  
  // Pagination (using shared utilities if available)
  let displaySales = filteredSales;
  
  if (window.SalesShared && paginationState) {
    // Sync state
    paginationState.currentPage = currentPage;
    paginationState.viewingAll = viewingAll;
    paginationState.rowsPerPage = rowsPerPage;
    
    displaySales = paginationState.getPaginatedData(filteredSales);
    
    // Update pagination UI
    window.SalesShared.updatePaginationUI(
      paginationState,
      filteredSales.length,
      {
        onScroll: () => initPaginationScrollDetection()
      }
    );
  } else {
    // Fallback
    const totalPages = Math.ceil(filteredSales.length / rowsPerPage);
    if (!viewingAll && filteredSales.length > rowsPerPage) {
      const start = (currentPage - 1) * rowsPerPage;
      const end = start + rowsPerPage;
      displaySales = filteredSales.slice(start, end);
    }
    
    // Update pagination UI
    updatePaginationUI(filteredSales.length);
  }
  
  // Render rows
  if (displaySales.length === 0) {
    tbody.innerHTML = '<tr><td colspan="9" class="empty">لا توجد مبيعات</td></tr>';
    return;
  }
  
  const fragment = document.createDocumentFragment();
  displaySales.forEach((sale, index) => {
    const tr = document.createElement('tr');
    tr.innerHTML = rowHtml(sale, (currentPage - 1) * rowsPerPage + index);
    fragment.appendChild(tr);
  });
  
  tbody.innerHTML = '';
  tbody.appendChild(fragment);
  
  // Update stats
  updateStats(filteredSales);
}

// ═════════════════════════════════════
// 📊 STATS & KPIs
// ═════════════════════════════════════

function updateStats(sales) {
  const totalSales = sales.reduce((sum, s) => sum + Number(s.total || 0), 0);
  const totalProfit = sales.reduce((sum, s) => sum + Number(s.profit || 0), 0);
  const totalCount = sales.length;
  
  const totalSalesEl = document.getElementById('totalSales');
  const totalCountEl = document.getElementById('totalCount');
  const totalProfitEl = document.getElementById('totalProfit');
  
  if (totalSalesEl) totalSalesEl.textContent = fmt(totalSales);
  if (totalCountEl) totalCountEl.textContent = totalCount;
  if (totalProfitEl) totalProfitEl.textContent = fmt(totalProfit);
}

// ═════════════════════════════════════
// 📄 PAGINATION
// ═════════════════════════════════════

function updatePaginationUI(totalItems) {
  const totalPages = Math.ceil(totalItems / rowsPerPage);
  const paginationControls = document.getElementById('paginationControls');
  const pageInfo = document.getElementById('pageInfo');
  const prevBtn = document.getElementById('prevPage');
  const nextBtn = document.getElementById('nextPage');
  
  if (!paginationControls) return;
  
  if (totalItems === 0 || viewingAll || totalItems <= rowsPerPage) {
    paginationControls.style.display = 'none';
    return;
  }
  
  paginationControls.style.display = 'flex';
  
  if (pageInfo) {
    pageInfo.textContent = `صفحة ${currentPage} من ${totalPages} (${totalItems} عملية)`;
  }
  
  if (prevBtn) {
    prevBtn.disabled = currentPage === 1;
    prevBtn.style.opacity = currentPage === 1 ? '0.5' : '1';
  }
  
  if (nextBtn) {
    nextBtn.disabled = currentPage === totalPages || totalPages === 0;
    nextBtn.style.opacity = (currentPage === totalPages || totalPages === 0) ? '0.5' : '1';
  }
}

function goToPage(pageNum) {
  const totalPages = Math.ceil(filteredSales.length / rowsPerPage);
  if (pageNum >= 1 && pageNum <= totalPages) {
    currentPage = pageNum;
    paginationState.currentPage = pageNum;
    renderTable();
  }
}

function changePage(direction) {
  const totalPages = Math.ceil(filteredSales.length / rowsPerPage);
  currentPage += direction;
  
  if (currentPage < 1) currentPage = 1;
  if (currentPage > totalPages) currentPage = totalPages;
  
  paginationState.currentPage = currentPage;
  renderTable();
}

function initPaginationScrollDetection() {
  // Handled by shared utilities if available
  if (window.SalesShared) {
    const paginationControls = document.getElementById('paginationControls');
    if (paginationControls) {
      window.SalesShared.initPaginationScrollDetection(
        paginationControls,
        () => {}
      );
    }
  }
}

// ═════════════════════════════════════
// 🔍 FILTERS
// ═════════════════════════════════════

function applyQuickFilter(period) {
  const dates = window.SalesShared?.applyQuickDateFilter(period) || { from: null, to: null };
  
  const fromInput = document.getElementById('from');
  const toInput = document.getElementById('to');
  
  if (fromInput && dates.from) fromInput.value = dates.from;
  if (toInput && dates.to) toInput.value = dates.to;
  
  // Update active button
  document.querySelectorAll('.quick-filter-btn').forEach(btn => {
    btn.classList.remove('active');
    if (btn.dataset.period === period) {
      btn.classList.add('active');
    }
  });
  
  // Reload data
  boot(false, true);
}

// ═════════════════════════════════════
// 🚀 INITIALIZATION
// ═════════════════════════════════════

function createSpinner() {
  if (document.getElementById('loading-spinner')) return;
  
  const spinner = document.createElement('div');
  spinner.id = 'loading-spinner';
  spinner.style.cssText = `
    position: fixed;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    z-index: 9999;
    display: none;
  `;
  
  spinner.innerHTML = `
    <div style="
      width: 60px;
      height: 60px;
      border: 4px solid rgba(139, 92, 246, 0.1);
      border-top-color: #8b5cf6;
      border-radius: 50%;
      animation: spin 0.8s linear infinite;
    "></div>
  `;
  
  if (!document.getElementById('spinner-animations')) {
    const style = document.createElement('style');
    style.id = 'spinner-animations';
    style.textContent = `
      @keyframes spin {
        to { transform: rotate(360deg); }
      }
    `;
    document.head.appendChild(style);
  }
  
  document.body.appendChild(spinner);
}

function showLoading() {
  createSpinner();
  const spinner = document.getElementById('loading-spinner');
  if (spinner) spinner.style.display = 'block';
}

function hideLoading() {
  const spinner = document.getElementById('loading-spinner');
  if (spinner) spinner.style.display = 'none';
}

async function boot(loadToday = false, forceRefresh = false) {
  try {
    let fromISO = null;
    let toISO = null;
    
    if (loadToday) {
      fromISO = todayISO();
      toISO = todayISO();
    } else {
      const fromInput = document.getElementById('from');
      const toInput = document.getElementById('to');
      
      if (fromInput && fromInput.value) fromISO = fromInput.value;
      if (toInput && toInput.value) toISO = toInput.value;
    }
    
    // Load all sales
    allSales = await loadAllSales({ fromISO, toISO, forceRefresh });
    
    // Render table
    renderTable();
    
    // Set default dates if not set
    if (!fromISO && !toISO) {
      const fromInput = document.getElementById('from');
      const toInput = document.getElementById('to');
      
      if (fromInput && !fromInput.value) {
        const sixMonthsAgo = new Date();
        sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);
        fromInput.value = sixMonthsAgo.toISOString().slice(0, 10);
      }
      
      if (toInput && !toInput.value) {
        toInput.value = todayISO();
      }
    }
  } catch (err) {
    if (window.SalesErrorHandler) {
      window.SalesErrorHandler.showError(err, {
        NETWORK_ERROR: 'فشل الاتصال بالخادم. يرجى التحقق من الاتصال.',
        SERVER_ERROR: 'حدث خطأ في الخادم. يرجى المحاولة مرة أخرى.'
      });
    } else {
      Logger.error('Boot error:', err);
      showToast('فشل تحميل البيانات: ' + err.message, 'error');
    }
    hideLoading();
  }
}

// ═════════════════════════════════════
// 🎯 EVENT LISTENERS
// ═════════════════════════════════════

document.addEventListener('DOMContentLoaded', () => {
  // Search input
  const searchInput = document.getElementById('q');
  if (searchInput) {
    searchInput.addEventListener('input', debouncedRenderTable);
  }
  
  // Type filter
  const typeFilter = document.getElementById('typeFilter');
  if (typeFilter) {
    typeFilter.addEventListener('change', renderTable);
  }
  
  // Date filters
  const btnApply = document.getElementById('btnApply');
  if (btnApply) {
    btnApply.addEventListener('click', () => boot(false, true));
  }
  
  const btnToday = document.getElementById('btnToday');
  if (btnToday) {
    btnToday.addEventListener('click', () => {
      const fromInput = document.getElementById('from');
      const toInput = document.getElementById('to');
      if (fromInput) fromInput.value = todayISO();
      if (toInput) toInput.value = todayISO();
      boot(false, true);
    });
  }
  
  // Quick filter buttons
  document.querySelectorAll('.quick-filter-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const period = btn.dataset.period;
      if (period) applyQuickFilter(period);
    });
  });
  
  // Pagination
  const prevBtn = document.getElementById('prevPage');
  const nextBtn = document.getElementById('nextPage');
  
  if (prevBtn) {
    prevBtn.addEventListener('click', () => changePage(-1));
  }
  
  if (nextBtn) {
    nextBtn.addEventListener('click', () => changePage(1));
  }
  
  // Initialize
  boot(false, false);
});

// Export for debugging
window.GeneralSales = {
  loadAllSales,
  renderTable,
  updateStats,
  allSales,
  filteredSales
};

