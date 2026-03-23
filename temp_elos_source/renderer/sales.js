// ═══════════════════════════════════════════════════════════════
// 📈 ELOS SALES SYSTEM - Enhanced Version v1.2 (Using Shared Utils)
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

// Use shared utilities if available, otherwise fallback
// ✅ استخدام التوقيت المحلي بدلاً من UTC
const todayISO = window.SalesShared?.todayISO || (() => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
});
const debounce = window.SalesShared?.debounce || function(func, delay = 300) {
  let timeoutId;
  return function (...args) {
    clearTimeout(timeoutId);
    timeoutId = setTimeout(() => func.apply(this, args), delay);
  };
};
const throttle = window.SalesShared?.throttle || function(func, limit = 100) {
  let inThrottle;
  return function (...args) {
    if (!inThrottle) {
      func.apply(this, args);
      inThrottle = true;
      setTimeout(() => inThrottle = false, limit);
    }
  };
};

// Debounced search using shared constants
const searchDebounceDelay = window.SalesConstants?.TIMING.SEARCH_DEBOUNCE || 200;
const debouncedRenderTable = debounce(renderTable, searchDebounceDelay);

// ═════════════════════════════════════
// 💾 CACHE SYSTEM (Using Shared)
// ═════════════════════════════════════
// Use shared cache if available, otherwise create local one
const SalesCache = window.SalesShared?.createCache('salesCache') || {
  data: null,
  timestamp: null,
  cacheKey: null,
  duration: window.SalesConstants?.CACHE.DURATION || 5 * 60 * 1000,
  
  set(sales, key) {
    this.data = sales;
    this.timestamp = Date.now();
    this.cacheKey = key;
    // Store in sessionStorage for persistence
    try {
      sessionStorage.setItem('salesCache', JSON.stringify({
        data: sales,
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
      const cached = sessionStorage.getItem('salesCache');
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
      sessionStorage.removeItem('salesCache');
    } catch (e) {}
  },
  
  isValid() {
    return this.data && this.timestamp && (Date.now() - this.timestamp < this.duration);
  }
};

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

function showToast(message, type = 'info', duration = 3000) {
  createToastContainer();
  
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
      animation: slideIn 0.3s ease-out;
      font-family: system-ui, 'Cairo', sans-serif;
      font-size: 14px;
      font-weight: 500;
    ">
      <span style="font-size: 20px;">${icons[type]}</span>
      <span style="flex: 1;">${message}</span>
    </div>
  `;
  
  if (!document.getElementById('toast-animations')) {
    const style = document.createElement('style');
    style.id = 'toast-animations';
    style.textContent = `
      @keyframes slideIn {
        from { opacity: 0; transform: translateY(-20px); }
        to { opacity: 1; transform: translateY(0); }
      }
      @keyframes slideOut {
        from { opacity: 1; transform: translateY(0); }
        to { opacity: 0; transform: translateY(-20px); }
      }
    `;
    document.head.appendChild(style);
  }
  
  const container = document.getElementById('toast-container');
  container.appendChild(toast);
  
  setTimeout(() => {
    toast.style.animation = 'slideOut 0.3s ease-out';
    setTimeout(() => toast.remove(), 300);
  }, duration);
}

// ═════════════════════════════════════
// 🔄 LOADING SPINNER
// ═════════════════════════════════════
let isLoading = false;

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
      border: 4px solid rgba(59, 130, 246, 0.1);
      border-top-color: #3b82f6;
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
  document.getElementById('loading-spinner').style.display = 'block';
  isLoading = true;
}

function hideLoading() {
  const spinner = document.getElementById('loading-spinner');
  if (spinner) spinner.style.display = 'none';
  isLoading = false;
}

// ═════════════════════════════════════
// 🌐 API CALLS
// ═════════════════════════════════════
async function loadSales({ fromISO, toISO }) {
  const p = new URLSearchParams();
  if (fromISO) p.set('from', fromISO);
  if (toISO) p.set('to', toISO);
  
  p.set('include_returned', 'true');
  const res = await fetch('elos-db://sales?' + p.toString());
  if (!res.ok) throw new Error(await res.text());
  
  return await res.json();
}

async function returnSaleAPI(saleId, refundAmount, reason, restock) {
  const res = await fetch('elos-db://return-sale', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ 
      sale_id: saleId, 
      refund_amount: refundAmount, 
      reason, 
      restock 
    })
  });
  
  const text = await res.text();
  if (!res.ok) throw new Error(text);
  
  return JSON.parse(text);
}

// ═════════════════════════════════════
// 🎨 RENDERING FUNCTIONS
// ═════════════════════════════════════

function getStatusLabel(status) {
  const labels = {
    completed: 'مكتمل',
    returned: 'مرتجع'
  };
  return labels[status] || status || 'مكتمل';
}

function statusBadge(status) {
  if (status === 'returned') {
    return `<span class="badge badge-returned">مرتجع</span>`;
  }
  return `<span class="badge badge-completed">مكتمل</span>`;
}

function rowHtml(s, i) {
  const canReturn = (s.status || 'completed') === 'completed';
  const isReturned = s.status === 'returned';
  const dateStr = (s.created_at || '').replace('T', ' ').slice(0, 16);
  
  // Extract brand from model (same logic as inventory)
  let displayType = s.type || "—";
  let displayModel = s.model || "—";
  
  const brands = ['Apple', 'Samsung', 'Oppo', 'Realme', 'Vivo', 'Xiaomi', 'Nokia', 'Huawei', 'OnePlus', 'Google'];
  for (const brand of brands) {
    if (displayModel.startsWith(brand + ' ')) {
      displayType = brand;
      break;
    }
  }
  
  // ✅ استخدام type مباشرة لو موجود ومش محدد من الموديل
  if (s.type && !displayType) {
    displayType = s.type;
  }
  
  // Better customer display - check both customer_name and client_name
  const customerDisplay = escapeHtml((s.client_name && s.client_name.trim() !== '')
    ? s.client_name
    : (s.customer_name && s.customer_name.trim() !== '')
      ? s.customer_name
      : '—');
  
  // Row class based on status
  const rowClass = isReturned ? 'returned-row' : '';
  
  // Action buttons based on status
  let actionButtons = '';
  if (isReturned) {
    actionButtons = `
      <button class="action-btn view-btn" data-view="${s.id}" title="عرض التفاصيل">👁️ تفاصيل</button>
      <button class="action-btn delete-btn" data-delete="${s.id}" title="حذف">🗑️ حذف</button>
    `;
  } else {
    actionButtons = `
      <button class="action-btn view-btn" data-view="${s.id}" title="عرض التفاصيل">👁️ تفاصيل</button>
    `;
  }
  
  return `<tr class="${rowClass}" data-sale-id="${s.id}" style="animation: fadeIn 0.3s ease-out ${i * 0.01}s both;">
    <td class="cell-index">${i + 1}</td>
    <td class="cell-id"><strong>#${s.id}</strong></td>
    <td class="cell-type">${displayType}</td>
    <td class="cell-model"><strong>${displayModel}</strong></td>
    <td class="cell-storage">${s.storage || '—'}</td>
    <td class="cell-price num"><strong>${fmt((s.sell_price || 0) - (s.discount || 0))}</strong></td>
    <td class="cell-customer">${customerDisplay}</td>
    <td class="cell-date">${dateStr}</td>
    <td class="cell-actions">
      ${statusBadge(s.status || 'completed')}
      ${actionButtons}
    </td>
  </tr>`;
}

// ═════════════════════════════════════
// 📊 STATE & FILTERING
// ═════════════════════════════════════
let currentSales = [];
let filteredSales = [];
let currentReturnSaleId = null;

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

function applyQuickSearch() {
  const term = (document.getElementById('q').value || '').trim();
  
  // Use shared utilities if available
  if (window.SalesShared && window.WarehouseHandler) {
    // Apply warehouse filter first
    const warehouseId = window.WarehouseHandler.getCurrentWarehouseId('sales');
    let filtered = window.WarehouseHandler.filterByWarehouse(
      currentSales, 
      warehouseId, 
      'device_warehouse_id'
    );
    
    // Apply search filter
    if (term) {
      filtered = window.SalesShared.applyQuickSearch(filtered, term, [
        'model',
        'type', 
        'storage',
        'customer_name',
        'client_name'
      ]);
    }
    
    return filtered;
  }
  
  // Fallback to original implementation
  const termLower = term.toLowerCase();
  let filteredByWarehouse = [...currentSales];
  
  const warehouseId = localStorage.getItem('currentSalesWarehouseId');
  if (warehouseId) {
    Logger.log('[SALES] Filtering by warehouse ID:', warehouseId);
    filteredByWarehouse = currentSales.filter(s => {
      if (s.device_warehouse_id) {
        return s.device_warehouse_id == warehouseId;
      }
      return true;
    });
  }
  
  if (!term) {
    return filteredByWarehouse;
  }

  const hit = (v) => (v || '').toString().toLowerCase().includes(termLower);
  
  return filteredByWarehouse.filter(s => 
    hit(s.model) || 
    hit(s.type) || 
    hit(s.storage) || 
    hit(s.customer_name) ||
    hit(s.client_name)
  );
}

function recalcKpis(list) {
  const total = list.reduce((sum, x) => sum + (Number(x.sell_price || 0) - Number(x.discount || 0)), 0);
  const totalCost = list.reduce((sum, x) => sum + Number(x.purchase_cost || 0), 0);
  const profit = total - totalCost;
  const count = list.length;
  
  // تحديث القيم مع animation
  const kCount = document.getElementById('kCount');
  const kTotal = document.getElementById('kTotal');
  const kProfit = document.getElementById('kProfit');
  const kAvg = document.getElementById('kAvg');
  
  // إضافة animation class
  [kCount, kTotal, kProfit, kAvg].forEach(el => {
    if (el) {
      el.classList.add('updating');
      setTimeout(() => el.classList.remove('updating'), 500);
    }
  });
  
  if (kCount) kCount.textContent = count.toLocaleString();
  if (kTotal) kTotal.textContent = fmt(total);
  if (kProfit) kProfit.textContent = fmt(profit);
  if (kAvg) kAvg.textContent = count ? fmt(total / count) : '0.00';
  
  // Update Quick Stats - استخدام كل البيانات مش المفلترة
  updateQuickStats(currentSales);
  
  // Update Best Sellers - استخدام كل البيانات مش المفلترة
  updateBestSellers(currentSales);
}

// ═════════════════════════════════════
// 📊 QUICK STATS
// ═════════════════════════════════════
function updateQuickStats(list) {
  Logger.log('[QUICK STATS] Updating with', list.length, 'sales');
  
  if (list.length === 0) {
    document.getElementById('bestDay').textContent = '—';
    document.getElementById('bestDayTotal').textContent = '—';
    document.getElementById('returnCount').textContent = '0';
    return;
  }
  
  // حساب المرتجعات
  const returnedCount = list.filter(s => s.status === 'returned').length;
  
  // حساب أكتر يوم بيع
  const salesByDay = {};
  list.forEach(sale => {
    if (sale.status === 'returned') return; // تجاهل المرتجعات
    
    const date = (sale.created_at || '').slice(0, 10); // YYYY-MM-DD
    if (!date) return;
    
    if (!salesByDay[date]) {
      salesByDay[date] = { count: 0, total: 0 };
    }
    salesByDay[date].count++;
    salesByDay[date].total += (Number(sale.sell_price || 0) - Number(sale.discount || 0));
  });
  
  // إيجاد أكتر يوم
  let bestDay = null;
  let bestDayData = { count: 0, total: 0 };
  
  for (const [date, data] of Object.entries(salesByDay)) {
    if (data.count > bestDayData.count || 
        (data.count === bestDayData.count && data.total > bestDayData.total)) {
      bestDay = date;
      bestDayData = data;
    }
  }
  
  // تنسيق التاريخ
  let bestDayFormatted = '—';
  if (bestDay) {
    const dateObj = new Date(bestDay);
    const day = dateObj.getDate();
    const month = dateObj.getMonth() + 1;
    const year = dateObj.getFullYear();
    bestDayFormatted = `${day}/${month}/${year}`;
  }
  
  Logger.log('[QUICK STATS] Best day:', bestDay, 'Count:', bestDayData.count, 'Total:', bestDayData.total, 'Returns:', returnedCount);
  
  document.getElementById('bestDay').textContent = bestDayFormatted;
  document.getElementById('bestDayTotal').textContent = bestDayData.count > 0 ? `${fmt(bestDayData.total)} (${bestDayData.count} جهاز)` : '—';
  document.getElementById('returnCount').textContent = returnedCount.toLocaleString();
}

// ═════════════════════════════════════
// 🔥 BEST SELLERS
// ═════════════════════════════════════
function updateBestSellers(list) {
  const container = document.getElementById('bestSellers');
  
  if (list.length === 0) {
    container.innerHTML = '<div class="best-seller-item loading">لا توجد بيانات</div>';
    return;
  }
  
  // Count sales by model - optimized with brand cache
  const modelCounts = {};
  const modelInfo = {};
  const brands = ['Apple', 'Samsung', 'Oppo', 'Realme', 'Vivo', 'Xiaomi', 'Nokia', 'Huawei', 'OnePlus', 'Google'];
  const brandSet = new Set(brands); // O(1) lookup instead of O(n)

  list.forEach(sale => {
    const model = sale.model || 'غير محدد';
    if (!modelCounts[model]) {
      modelCounts[model] = 0;

      // ✅ استخدام type مباشرة كاسم الشركة
      let brand = sale.type || '';
      // لو الـ type مش موجود في brands، ندور في الموديل
      if (!brandSet.has(brand)) {
        brand = brands.find(b => model.startsWith(b + ' ')) || brand;
      }

      modelInfo[model] = { brand };
    }
    modelCounts[model]++;
  });
  
  // Sort by count and get top 5
  const sorted = Object.entries(modelCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5);
  
  if (sorted.length === 0) {
    container.innerHTML = '<div class="best-seller-item loading">لا توجد بيانات</div>';
    return;
  }
  
  container.innerHTML = sorted.map(([model, count], index) => {
    const info = modelInfo[model];
    const rankClass = index === 0 ? 'gold' : index === 1 ? 'silver' : index === 2 ? 'bronze' : '';
    
    return `
      <div class="best-seller-item">
        <div class="best-seller-rank ${rankClass}">${index + 1}</div>
        <div class="best-seller-info">
          <div class="best-seller-name">${escapeHtml(model)}</div>
          <div class="best-seller-brand">${escapeHtml(info.brand)}</div>
        </div>
        <div class="best-seller-count">${count} جهاز</div>
      </div>
    `;
  }).join('');
}

// ═════════════════════════════════════
// 🎬 RENDERING
// ═════════════════════════════════════
function renderTable() {
  const startTime = performance.now();
  
  filteredSales = applyQuickSearch();
  
  const tbody = document.getElementById('rows');
  const empty = document.getElementById('empty');
  const resCount = document.getElementById('resCount');
  
  // Add animations CSS if not exists
  if (!document.getElementById('table-animations')) {
    const style = document.createElement('style');
    style.id = 'table-animations';
    style.textContent = `
      @keyframes fadeIn {
        from { opacity: 0; transform: translateY(10px); }
        to { opacity: 1; transform: translateY(0); }
      }
      @keyframes rowDelete {
        to { opacity: 0; transform: translateX(-20px); height: 0; padding: 0; }
      }
    `;
    document.head.appendChild(style);
  }
  
  if (filteredSales.length === 0) {
    tbody.innerHTML = '';
    empty.style.display = 'flex';
    updatePaginationUI(0);
  } else {
    empty.style.display = 'none';
    
    // Apply pagination (using shared utilities if available)
    let paginatedSales;
    if (window.SalesShared && paginationState) {
      // Sync state
      paginationState.currentPage = currentPage;
      paginationState.viewingAll = viewingAll;
      paginationState.rowsPerPage = rowsPerPage;
      
      paginatedSales = paginationState.getPaginatedData(filteredSales);
    } else {
      // Fallback
      if (viewingAll) {
        paginatedSales = filteredSales;
      } else {
        const totalPages = Math.ceil(filteredSales.length / rowsPerPage);
        if (currentPage > totalPages) currentPage = totalPages;
        if (currentPage < 1) currentPage = 1;
        
        const start = (currentPage - 1) * rowsPerPage;
        const end = start + rowsPerPage;
        paginatedSales = filteredSales.slice(start, end);
      }
    }
    
    // Use Document Fragment for better performance
    const fragment = document.createDocumentFragment();
    const tempContainer = document.createElement('tbody');
    
    // Build HTML string (faster than individual DOM operations)
    const htmlString = paginatedSales.map((s, i) => {
      const actualIndex = viewingAll ? i : ((currentPage - 1) * rowsPerPage) + i;
      return rowHtml(s, actualIndex);
    }).join('');
    
    tempContainer.innerHTML = htmlString;
    
    // Move all children to fragment
    while (tempContainer.firstChild) {
      fragment.appendChild(tempContainer.firstChild);
    }
    
    // Clear and append in one operation
    tbody.innerHTML = '';
    tbody.appendChild(fragment);
    
    // Bind events using event delegation
    bindTableEvents();
    
    // Update pagination UI (using shared utilities if available)
    if (window.SalesShared && paginationState) {
      window.SalesShared.updatePaginationUI(
        paginationState,
        filteredSales.length,
        {
          onScroll: () => initPaginationScrollDetection()
        }
      );
    } else {
      updatePaginationUI(filteredSales.length);
    }
  }
  
  resCount.textContent = filteredSales.length.toLocaleString();
  recalcKpis(filteredSales);
  
  const endTime = performance.now();
  Logger.log(`[PERFORMANCE] Render took ${(endTime - startTime).toFixed(2)}ms for ${filteredSales.length} items`);
}

// ═════════════════════════════════════
// 🎯 EVENT DELEGATION (Better Performance)
// ═════════════════════════════════════
let tableEventsInitialized = false;

function bindTableEvents() {
  const tbody = document.getElementById('rows');
  
  if (!tableEventsInitialized) {
    // Add single event listeners using delegation (only once)
    tbody.addEventListener('click', handleTableClick);
    tbody.addEventListener('dblclick', handleTableDblClick);
    tableEventsInitialized = true;
  }
}

async function handleTableClick(e) {
  const btn = e.target.closest('button');
  if (!btn) return;

  e.stopPropagation();

  if (btn.dataset.view) {
    openSaleDetails(Number(btn.dataset.view));
  } else if (btn.dataset.return) {
    currentReturnSaleId = Number(btn.dataset.return);
    const amount = Number(btn.dataset.amount || 0);
    document.getElementById('retAmount').value = amount;
    document.getElementById('retReason').value = '';
    document.getElementById('retRestock').checked = true;
    document.getElementById('returnModal').classList.add('show');
  } else if (btn.dataset.delete) {
    const saleId = Number(btn.dataset.delete);
    // ✅ استخدام showConfirm بدلاً من confirm
    const confirmed = await showConfirm('هل أنت متأكد من حذف هذه العملية نهائياً؟\nلا يمكن التراجع عن هذا الإجراء.', 'حذف', 'إلغاء', 'danger');
    if (confirmed) {
      deleteSale(saleId);
    }
  }
}

function handleTableDblClick(e) {
  if (e.target.closest('button')) return;
  
  const row = e.target.closest('tr[data-sale-id]');
  if (row) {
    openSaleDetails(Number(row.dataset.saleId));
  }
}

// ═════════════════════════════════════
// 👁️ VIEW DETAILS (Legacy - kept for compatibility)
// ═════════════════════════════════════
function bindViewButtons() {
  // Now handled by event delegation in bindTableEvents()
}

function bindReturnButtons() {
  // Now handled by event delegation in bindTableEvents()
}

function openSaleDetails(saleId) {
  const sale = currentSales.find(s => s.id === saleId);
  
  if (!sale) {
    showToast('لم يتم العثور على العملية', 'error');
    return;
  }
  
  const dateStr = (sale.created_at || '').replace('T', ' ').slice(0, 16);
  
  // Extract brand from model (same logic as rowHtml)
  let displayType = sale.type || "—";
  let displayModel = sale.model || "—";
  
  const brands = ['Apple', 'Samsung', 'Oppo', 'Realme', 'Vivo', 'Xiaomi', 'Nokia', 'Huawei', 'OnePlus', 'Google'];
  for (const brand of brands) {
    if (displayModel.startsWith(brand + ' ')) {
      displayType = brand;
      break;
    }
  }
  
  // ✅ استخدام type مباشرة لو موجود ومش محدد من الموديل
  if (sale.type && !displayType) {
    displayType = sale.type;
  }
  
  // Check both customer_name and client_name
  const customerDisplay = escapeHtml((sale.client_name && sale.client_name.trim() !== '')
    ? sale.client_name
    : (sale.customer_name && sale.customer_name.trim() !== '')
      ? sale.customer_name
      : 'غير محدد');
  
  // Calculate discount percentage if exists
  const discount = Number(sale.discount || 0);
  const discountPercent = sale.sell_price > 0 ? ((discount / sale.sell_price) * 100).toFixed(1) : 0;
      
      // ✅ FIX: حساب السعر الفعلي بعد الخصم
      const paidNow = Number(sale.paid_now || 0);
      const sellPrice = Number(sale.sell_price || 0);
      const actualPrice = sellPrice - discount; // السعر بعد الخصم
      const remaining = actualPrice - paidNow;

      // Device info - الهامش يُحسب على السعر الفعلي بعد الخصم
      const cost = Number(sale.purchase_cost || 0);
      const ntraTax = Number(sale.ntra_tax || 0);
      const margin = actualPrice - cost;
      const marginPct = cost > 0 ? ((margin / cost) * 100).toFixed(1) : 0;
      
      // Condition labels
      const conditionLabels = {
        'new': 'جديد',
        'like_new': 'ممتاز',
        'used': 'مستعمل',
        'faulty': 'به عيب'
      };
      const conditionDisplay = conditionLabels[sale.condition] || sale.condition || '—';
      
      // Format date
      const formatDate = (dateStr) => {
        if (!dateStr) return '—';
        const d = new Date(dateStr);
        return d.toLocaleDateString('en-US', { 
          year: 'numeric', 
          month: 'short', 
          day: 'numeric',
          hour: '2-digit',
          minute: '2-digit'
        });
      };
      
      document.getElementById('saleFields').innerHTML = `
        <!-- Header -->
        <div class="detail-header">
          <div style="font-size: 11px; color: var(--text-secondary); margin-bottom: 4px;">رقم البيع</div>
          <div class="detail-header-number">#${sale.id}</div>
          <div style="margin-top: 8px;">${statusBadge(sale.status || 'completed')}</div>
        </div>
        
        <!-- Device Info -->
        <div class="detail-section">
          <div class="detail-section-title">📱 الجهاز</div>
          <div class="detail-grid">
            <div class="detail-item">
              <div class="detail-item-label">الموديل</div>
              <div class="detail-item-value">${displayModel}</div>
            </div>
            <div class="detail-item">
              <div class="detail-item-label">النوع / السعة</div>
              <div class="detail-item-value">${displayType} • ${sale.storage || '—'}</div>
            </div>
            <div class="detail-item">
              <div class="detail-item-label">الحالة</div>
              <div class="detail-item-value">${conditionDisplay}${(displayType === 'Apple' && sale.battery_health) ? ` • 🔋${sale.battery_health}%` : ''}</div>
            </div>
            ${sale.imei1 ? `
              <div class="detail-item">
                <div class="detail-item-label">IMEI</div>
                <div class="detail-item-value mono">${sale.imei1}</div>
              </div>
            ` : ''}
          </div>
        </div>
        
        <div class="detail-divider"></div>
        
        <!-- Financial Info -->
        <div class="detail-section">
          <div class="detail-section-title">💰 المالية</div>
          <div class="detail-grid">
            ${discount > 0 ? `
              <div class="detail-item full-width" style="background: linear-gradient(135deg, rgba(16,185,129,0.1) 0%, rgba(16,185,129,0.05) 100%); border-color: rgba(16,185,129,0.3);">
                <div class="detail-item-label">سعر البيع بعد الخصم</div>
                <div class="detail-item-value large success">${fmt(actualPrice)} EGP</div>
              </div>
              <div class="detail-item">
                <div class="detail-item-label">السعر الأصلي</div>
                <div class="detail-item-value" style="text-decoration: line-through; opacity: 0.7;">${fmt(sellPrice)} EGP</div>
              </div>
              <div class="detail-item">
                <div class="detail-item-label">الخصم</div>
                <div class="detail-item-value" style="color: var(--warning);">- ${fmt(discount)} EGP (${discountPercent}%)</div>
              </div>
            ` : `
              <div class="detail-item full-width" style="background: linear-gradient(135deg, rgba(16,185,129,0.1) 0%, rgba(16,185,129,0.05) 100%); border-color: rgba(16,185,129,0.3);">
                <div class="detail-item-label">سعر البيع</div>
                <div class="detail-item-value large success">${fmt(sellPrice)} EGP</div>
              </div>
            `}
            <div class="detail-item">
              <div class="detail-item-label">التكلفة</div>
              <div class="detail-item-value">${fmt(cost)} EGP</div>
            </div>
            <div class="detail-item">
              <div class="detail-item-label">المدفوع</div>
              <div class="detail-item-value ${paidNow >= actualPrice ? 'success' : 'warning'}">${fmt(paidNow)} EGP</div>
            </div>
            <div class="detail-item">
              <div class="detail-item-label">الهامش</div>
              <div class="detail-item-value ${margin >= 0 ? 'success' : 'danger'}">${fmt(margin)} EGP (${marginPct}%)</div>
            </div>
            ${remaining > 0 ? `
              <div class="detail-item">
                <div class="detail-item-label">المتبقي</div>
                <div class="detail-item-value danger">${fmt(remaining)} EGP</div>
              </div>
            ` : ''}
          </div>
        </div>
        
        <div class="detail-divider"></div>
        
        <!-- Customer & Date -->
        <div class="detail-section">
          <div class="detail-section-title">👤 العميل</div>
          <div class="detail-grid">
            <div class="detail-item">
              <div class="detail-item-label">الاسم</div>
              <div class="detail-item-value">${customerDisplay}</div>
            </div>
            ${sale.customer_phone ? `
              <div class="detail-item">
                <div class="detail-item-label">الهاتف</div>
                <div class="detail-item-value mono">${escapeHtml(sale.customer_phone)}</div>
              </div>
            ` : ''}
            <div class="detail-item ${!sale.customer_phone ? 'full-width' : ''}">
              <div class="detail-item-label">تاريخ البيع</div>
              <div class="detail-item-value">${formatDate(sale.created_at)}</div>
            </div>
          </div>
        </div>
        
        <!-- Return Info -->
        ${sale.status === 'returned' ? `
          <div class="detail-divider"></div>
          <div class="detail-section">
            <div class="detail-section-title" style="color: var(--danger);">🔄 المرتجع</div>
            <div class="detail-grid">
              <div class="detail-item" style="border-color: rgba(239,68,68,0.3);">
                <div class="detail-item-label">القيمة</div>
                <div class="detail-item-value danger">${fmt(sale.refund_amount || 0)} EGP</div>
              </div>
              ${sale.return_reason ? `
                <div class="detail-item" style="border-color: rgba(239,68,68,0.3);">
                  <div class="detail-item-label">السبب</div>
                  <div class="detail-item-value">${sale.return_reason}</div>
                </div>
              ` : ''}
              ${sale.returned_at ? `
                <div class="detail-item ${!sale.return_reason ? 'full-width' : ''}" style="border-color: rgba(239,68,68,0.3);">
                  <div class="detail-item-label">التاريخ</div>
                  <div class="detail-item-value">${formatDate(sale.returned_at)}</div>
                </div>
              ` : ''}
            </div>
          </div>
        ` : ''}
      `;
      
      // Update modal actions based on status
      const actionsDiv = document.getElementById('saleModalActions');
      if (sale.status === 'returned') {
        actionsDiv.innerHTML = `
          <button class="btn" id="btnPrint">🖨️ طباعة</button>
          <button class="btn-danger" id="btnDeleteSale" data-id="${sale.id}">🗑️ حذف</button>
          <button class="btn-ghost" id="btnClose">إغلاق</button>
        `;
        
        // Bind delete button
        document.getElementById('btnDeleteSale').addEventListener('click', async () => {
          // ✅ استخدام showConfirm بدلاً من confirm
          const confirmed = await showConfirm('هل أنت متأكد من حذف هذه العملية نهائياً؟\nلا يمكن التراجع عن هذا الإجراء.', 'حذف', 'إلغاء', 'danger');
          if (confirmed) {
            await deleteSale(sale.id);
          }
        });
      } else {
        actionsDiv.innerHTML = `
          <button class="btn" id="btnPrint">🖨️ طباعة</button>
          <button class="btn-ghost" id="btnClose">إغلاق</button>
        `;
      }
      
      // Re-bind close and print buttons
      document.getElementById('btnClose').addEventListener('click', () => {
        document.getElementById('saleModal').classList.remove('show');
      });
      document.getElementById('btnPrint').addEventListener('click', printSaleDetails);
      
      document.getElementById('saleModal').classList.add('show');
}

// ═════════════════════════════════════
// 🗑️ DELETE SALE
// ═════════════════════════════════════
async function deleteSale(saleId) {
  if (isLoading) return;
  
  try {
    showLoading();
    
    const res = await fetch('elos-db://delete-sale', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ sale_id: saleId })
    });
    
    const text = await res.text();
    if (!res.ok) throw new Error(text);
    
    // Close modal
    document.getElementById('saleModal').classList.remove('show');
    
    // إزالة الصف فوراً من الجدول بدون إعادة تحميل
    const row = document.querySelector(`tr[data-sale-id="${saleId}"]`);
    if (row) {
      row.style.animation = 'rowDelete 0.4s ease-out forwards';
      await new Promise(r => setTimeout(r, 400));
      row.remove();
      
      // تحديث البيانات المحلية
      currentSales = currentSales.filter(s => s.id !== saleId);
      filteredSales = filteredSales.filter(s => s.id !== saleId);
      
      // تحديث الإحصائيات
      recalcKpis(filteredSales);
      
      // إعادة ترقيم الصفوف
      document.querySelectorAll('#rows tr').forEach((tr, idx) => {
        const indexCell = tr.querySelector('.cell-index');
        if (indexCell) {
          indexCell.textContent = idx + 1;
        }
      });
      
      // تحديث الـ pagination
      updatePaginationUI(filteredSales.length);
      
      // تحديث عدد النتائج
      document.getElementById('resCount').textContent = filteredSales.length.toLocaleString();
    }
    
    showToast('تم حذف العملية بنجاح', 'success');
    
  } catch (error) {
    Logger.error('Delete sale error:', error);
    showToast('تعذر حذف العملية: ' + error.message, 'error');
  } finally {
    hideLoading();
  }
}

// ═════════════════════════════════════
// 🔄 RETURN HANDLING
// ═════════════════════════════════════
async function doReturn() {
  if (isLoading) return;
  
  const refund = Number(document.getElementById('retAmount').value || 0);
  const reason = document.getElementById('retReason').value.trim();
  const restock = document.getElementById('retRestock').checked;

  // Validation
  if (!currentReturnSaleId) {
    showToast('لا توجد عملية محددة', 'error');
    return;
  }
  
  if (refund < 0) {
    showToast('قيمة المرتجع غير صحيحة', 'warning');
    document.getElementById('retAmount').focus();
    return;
  }

  // Confirmation - ✅ استخدام showConfirm بدلاً من confirm
  const confirmMsg = `هل تريد تنفيذ المرتجع؟\n\nالقيمة: ${fmt(refund)}\nإرجاع للمخزون: ${restock ? 'نعم' : 'لا'}`;
  const confirmed = await showConfirm(confirmMsg, 'تنفيذ المرتجع', 'إلغاء', 'warning');
  if (!confirmed) return;

  try {
    showLoading();
    
    await returnSaleAPI(currentReturnSaleId, refund, reason, restock);
    
    showToast('تم تنفيذ المرتجع بنجاح ✅', 'success');

    // ✅ إخطار صفحة POS بالتحديث
    localStorage.setItem('pos_data_updated', Date.now().toString());

    // Animation للصف قبل التحديث
    const row = document.querySelector(`button[data-return="${currentReturnSaleId}"]`)?.closest('tr');
    if (row) {
      row.style.animation = 'rowDelete 0.4s ease-out forwards';
      await new Promise(r => setTimeout(r, 400));
    }

    document.getElementById('returnModal').classList.remove('show');
    currentReturnSaleId = null;

    await boot(false);
    
  } catch (error) {
    Logger.error('Return error:', error);
    showToast('تعذر تنفيذ المرتجع: ' + error.message, 'error');
  } finally {
    hideLoading();
  }
}

// ═════════════════════════════════════
// 🖨️ PRINT FUNCTION
// ═════════════════════════════════════
function printSaleDetails() {
  // ✅ طباعة فاتورة بيع حقيقية (مثل فاتورة نقطة البيع)
  const sale = currentSales.find(s => {
    const modal = document.getElementById('saleModal');
    const idEl = modal?.querySelector('.detail-header-number');
    if (idEl) {
      const id = Number(idEl.textContent.replace('#', ''));
      return s.id === id;
    }
    return false;
  });

  if (!sale) {
    showToast('لم يتم العثور على بيانات البيع', 'error');
    return;
  }

  const settings = JSON.parse(localStorage.getItem('appSettings') || '{}');
  const paperWidth = settings.printerPaperWidth === '58' ? '54mm' : '72mm';
  const pageSize = settings.printerPaperWidth || '80';

  // بيانات البيع
  const sellPrice = Number(sale.sell_price || 0);
  const discount = Number(sale.discount || 0);
  const actualPrice = sellPrice - discount;
  const paidNow = Number(sale.paid_now || 0);
  const remaining = actualPrice - paidNow;
  const invoiceNumber = sale.invoice_number || `INV-${sale.id}`;

  // اسم الجهاز
  let deviceName = sale.model || 'جهاز';
  const details = [sale.storage, sale.color, sale.condition].filter(Boolean).join(' - ');

  // اسم العميل
  const customerName = sale.client_name || sale.customer_name || '';

  // التاريخ
  const invoiceDate = sale.created_at ? new Date(sale.created_at) : new Date();
  const dateStr = invoiceDate.toLocaleDateString('ar-EG');
  const timeStr = invoiceDate.toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' });

  // طريقة الدفع
  const paymentMethodMap = {
    'cash': 'نقدي',
    'mobile_wallet': 'محفظة إلكترونية',
    'bank': 'حساب بنكي',
    'split': 'تقسيم',
    'deferred': 'آجل',
    'DEFERRED': 'آجل',
    'credit': 'آجل'
  };
  const rawSaleMethod = sale.payment_method || 'cash';
  const isSaleDeferred = ['deferred','DEFERRED','credit'].includes(rawSaleMethod);
  let paymentMethod = paymentMethodMap[rawSaleMethod] || rawSaleMethod || 'نقدي';
  if (isSaleDeferred) {
    paymentMethod = remaining > 0 ? 'آجل (دفع جزئي)' : 'آجل';
  } else if (remaining > 0) {
    paymentMethod = 'آجل (دفع جزئي)';
  }

  const companyPhone = settings.companyPhone || '';
  const companyAddress = settings.companyAddress || '';

  const invoiceHTML = `<!DOCTYPE html>
<html dir="rtl" lang="ar">
<head>
  <meta charset="UTF-8">
  <title>فاتورة بيع #${invoiceNumber}</title>
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
    .header { text-align: center; padding-bottom: 3mm; border-bottom: 0.5mm solid #000; margin-bottom: 2mm; }
    .logo { max-width: 14mm; max-height: 14mm; margin-bottom: 1mm; display: block; margin-left: auto; margin-right: auto; }
    .shop-name { font-size: 16px; font-weight: 700; letter-spacing: 0.5mm; }
    .shop-info { font-size: 10px; font-weight: 600; margin-top: 1mm; }
    .info { display: flex; justify-content: space-between; padding: 2mm 0; font-size: 11px; font-weight: 600; border-bottom: 0.3mm solid #000; }
    .info-num { font-weight: 700; font-size: 12px; }
    .item { padding: 2mm 0; border-bottom: 0.3mm solid #000; }
    .item-header { display: flex; justify-content: space-between; font-weight: 700; font-size: 12px; }
    .item-details { font-size: 10px; font-weight: 600; margin-top: 0.5mm; }
    .item-imei { font-size: 10px; font-weight: 600; font-family: monospace; margin-top: 0.5mm; }
    .summary { border-top: 0.3mm solid #000; padding-top: 2mm; margin-top: 1mm; font-size: 11px; font-weight: 600; }
    .summary-row { display: flex; justify-content: space-between; padding: 1mm 0; }
    .total { background: #000; color: #fff; margin: 3mm -3mm; padding: 4mm 3mm; text-align: center; }
    .total-label { font-size: 10px; font-weight: 600; letter-spacing: 1mm; }
    .total-amount { font-size: 18px; font-weight: 700; margin-top: 1mm; }
    .payment { display: flex; justify-content: space-between; font-size: 11px; font-weight: 600; padding: 2mm 0; }
    .remaining { display: flex; justify-content: space-between; font-size: 11px; font-weight: 700; padding: 2mm 0; color: #000; border-top: 0.3mm dashed #000; }
    .footer { text-align: center; padding-top: 3mm; margin-top: 2mm; border-top: 0.3mm solid #000; }
    .footer-msg { font-size: 11px; font-weight: 600; margin-bottom: 2mm; }
    .elos-sig { margin-top: 3mm; padding-top: 2mm; border-top: 0.3mm dashed #000; font-size: 9px; font-weight: 600; letter-spacing: 0.3mm; }
  </style>
</head>
<body>
  <div class="header">
    ${settings.companyLogo ? `<img src="${settings.companyLogo}" class="logo" />` : ''}
    <div class="shop-name">${settings.companyName || 'ELOS'}</div>
    ${companyPhone ? `<div class="shop-info">📞 ${companyPhone}</div>` : ''}
    ${companyAddress ? `<div class="shop-info">📍 ${companyAddress}</div>` : ''}
  </div>

  <div class="info">
    <div>
      <div class="info-num">#${invoiceNumber}</div>
      <div>${dateStr} - ${timeStr}</div>
    </div>
    ${customerName ? `<div style="text-align: left; font-weight: 700;">${customerName}</div>` : ''}
  </div>

  <div style="padding: 2mm 0;">
    <div class="item">
      <div class="item-header">
        <span>${deviceName}</span>
        <span>${fmt(actualPrice)}</span>
      </div>
      ${details ? `<div class="item-details">${details}</div>` : ''}
      ${sale.imei1 ? `<div class="item-imei">IMEI: ${sale.imei1}</div>` : ''}
      ${discount > 0 ? `<div class="item-details">خصم: ${fmt(discount)}</div>` : ''}
    </div>
  </div>

  ${discount > 0 ? `
    <div class="summary">
      <div class="summary-row"><span>السعر الأصلي</span><span>${fmt(sellPrice)}</span></div>
      <div class="summary-row"><span>الخصم</span><span>- ${fmt(discount)}</span></div>
    </div>
  ` : ''}

  <div class="total">
    <div class="total-label">الإجمالي</div>
    <div class="total-amount">EGP ${fmt(actualPrice)}</div>
  </div>

  <div class="payment">
    <span>طريقة الدفع:</span>
    <span>${paymentMethod}</span>
  </div>

  ${paidNow > 0 && paidNow < actualPrice ? `
    <div class="payment">
      <span>المدفوع:</span>
      <span>${fmt(paidNow)} EGP</span>
    </div>
    <div class="remaining">
      <span>المتبقي:</span>
      <span>${fmt(remaining)} EGP</span>
    </div>
  ` : ''}

  <div class="footer">
    <div class="footer-msg">${settings.printerFooterMessage || 'شكراً لتعاملكم معنا'}</div>
    <div class="elos-sig">
      <div>ELOS ACCOUNTING SYSTEM</div>
    </div>
  </div>

</body>
</html>`;

  const w = window.open('', '_blank', 'width=400,height=700');
  w.document.write(invoiceHTML);
  w.document.close();

  setTimeout(() => {
    w.focus();
    w.print();
    setTimeout(() => w.close(), 500);
  }, 300);
}

// ═════════════════════════════════════
// ⚡ QUICK FILTERS
// ═════════════════════════════════════
function applyQuickFilter(period) {
  Logger.log('[QUICK FILTER] Applying period:', period);
  const today = new Date();
  let fromDate, toDate;
  
  switch(period) {
    case 'today':
      fromDate = today;
      toDate = today;
      break;
      
    case 'week':
      // Get start of week (Sunday)
      const startOfWeek = new Date(today);
      startOfWeek.setDate(today.getDate() - today.getDay());
      fromDate = startOfWeek;
      toDate = today;
      break;
      
    case 'month':
      // Get start of month
      const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
      fromDate = startOfMonth;
      toDate = today;
      break;
      
    case '30days':
      // Last 30 days
      const thirtyDaysAgo = new Date(today);
      thirtyDaysAgo.setDate(today.getDate() - 30);
      fromDate = thirtyDaysAgo;
      toDate = today;
      break;
      
    default:
      Logger.log('[QUICK FILTER] Unknown period:', period);
      return;
  }
  
  // Format dates as YYYY-MM-DD (✅ استخدام التوقيت المحلي بدلاً من UTC)
  const formatDate = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  
  const from = formatDate(fromDate);
  const to = formatDate(toDate);
  
  Logger.log('[QUICK FILTER] Setting dates - From:', from, 'To:', to);
  
  document.getElementById('from').value = from;
  document.getElementById('to').value = to;
  
  // Apply the filter
  boot(false);
}

// ═════════════════════════════════════
// 📅 LOAD SALES DATA
// ═════════════════════════════════════
async function boot(loadToday = false, forceRefresh = false) {
  if (isLoading) return;
  
  try {
    showLoading();
    
    let fromDate = document.getElementById('from').value || '';
    let toDate = document.getElementById('to').value || '';
    
    Logger.log('[BOOT] Initial dates - from:', fromDate, 'to:', toDate);
    
    if (loadToday) {
      // Load today only
      const today = todayISO();
      fromDate = today;
      toDate = today;
      document.getElementById('from').value = today;
      document.getElementById('to').value = today;
    } else if (!fromDate || !toDate) {
      // Default: Last 6 months (if either date is empty)
      const today = new Date();
      const sixMonthsAgo = new Date();
      sixMonthsAgo.setMonth(today.getMonth() - 6);
      
      const _ld = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
      fromDate = _ld(sixMonthsAgo);
      toDate = _ld(today);
      document.getElementById('from').value = fromDate;
      document.getElementById('to').value = toDate;
      Logger.log('[BOOT] Set default dates - from:', fromDate, 'to:', toDate);
    }
    
    // Create cache key based on date range
    const cacheKey = `${fromDate}_${toDate}`;
    
    // Try to use cached data if not forcing refresh
    if (!forceRefresh && SalesCache.isValid() && SalesCache.cacheKey === cacheKey) {
      Logger.log('[CACHE] Using cached data');
      currentSales = SalesCache.get();
    } else {
      Logger.log('[SALES] Loading sales from', fromDate, 'to', toDate);
      const startTime = performance.now();
      
      const apiUrl = 'elos-db://sales?' + new URLSearchParams({ from: fromDate, to: toDate }).toString();
      Logger.log('[SALES] API URL:', apiUrl);
      
      currentSales = await loadSales({ fromISO: fromDate, toISO: toDate });
      
      const endTime = performance.now();
      Logger.log(`[PERFORMANCE] API call took ${(endTime - startTime).toFixed(2)}ms`);
      Logger.log('[SALES] Loaded', currentSales.length, 'sales');
      Logger.log('[SALES] First sale:', currentSales[0]);
      
      // Cache the data
      SalesCache.set(currentSales, cacheKey);
    }
    
    // Reset to first page
    currentPage = 1;
    
    renderTable();
    
    if (currentSales.length === 0) {
      showToast('لا توجد مبيعات في هذه الفترة', 'info', 2000);
    } else {
      showToast(`تم تحميل ${currentSales.length} عملية بيع`, 'success', 2000);
    }
    
  } catch (error) {
    // Use shared error handler if available
    if (window.SalesErrorHandler) {
      window.SalesErrorHandler.showError(error, {
        NETWORK_ERROR: 'فشل الاتصال بالخادم. يرجى التحقق من الاتصال.',
        SERVER_ERROR: 'حدث خطأ في الخادم. يرجى المحاولة مرة أخرى.'
      }, {
        duration: window.SalesConstants?.NOTIFICATIONS.ERROR_DURATION || 5000
      });
    } else {
      Logger.error('Load sales error:', error);
      showToast('تعذر تحميل المبيعات: ' + error.message, 'error');
    }
    currentSales = [];
    renderTable();
  } finally {
    hideLoading();
  }
}

// Force refresh (invalidate cache)
function forceRefresh() {
  SalesCache.invalidate();
  boot(false, true);
}

// ═════════════════════════════════════
// 🚀 INITIALIZATION
// ═════════════════════════════════════
(async function init() {
  Logger.log('📈 ElOs Sales System - Enhanced Version v1.2 (Performance Optimized)');
  Logger.log('✨ Loading...');
  
  // Clear old cache on startup to ensure fresh data
  SalesCache.invalidate();
  
  // Setup Event Listeners after DOM is ready
  setupEventListeners();
  
  try {
    await boot(false); // تحميل آخر 6 شهور بدلاً من اليوم فقط
    
    // Initialize scroll detection after render
    setTimeout(() => initPaginationScrollDetection(), 500);
    
    Logger.log('✅ Sales system ready!');
    Logger.log('⌨️ Keyboard shortcuts:');
    Logger.log('  - Ctrl/Cmd + F: Focus search');
    Logger.log('  - Ctrl/Cmd + R: Refresh data');
    Logger.log('  - Escape: Close modals');
    
    showToast('مرحباً بك في نظام المبيعات', 'success', 2000);
    
  } catch (error) {
    Logger.error('❌ Init error:', error);
    showToast('حدث خطأ أثناء تحميل النظام', 'error');
  }
})();

// ═════════════════════════════════════
// 🎛️ SETUP EVENT LISTENERS
// ═════════════════════════════════════
function setupEventListeners() {
  // Filter buttons
  document.getElementById('btnApply').addEventListener('click', () => boot(false));
  document.getElementById('btnToday').addEventListener('click', () => boot(true));
  document.getElementById('btnRefresh').addEventListener('click', () => forceRefresh());

  // Quick filter buttons
  document.querySelectorAll('.quick-filter-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const period = btn.getAttribute('data-period');
      applyQuickFilter(period);
    });
  });

  // Quick search with debounce
  document.getElementById('q').addEventListener('input', debouncedRenderTable);

  // Table search bar (above table) - sync with sidebar search
  const tableSearch = document.getElementById('tableSearch');
  const clearSearchBtn = document.getElementById('clearSearch');
  const sidebarSearch = document.getElementById('q');

  if (tableSearch) {
    tableSearch.addEventListener('input', (e) => {
      // Sync with sidebar search
      sidebarSearch.value = e.target.value;
      // Show/hide clear button
      if (clearSearchBtn) {
        clearSearchBtn.classList.toggle('visible', e.target.value.length > 0);
      }
      debouncedRenderTable();
    });
  }

  if (clearSearchBtn) {
    clearSearchBtn.addEventListener('click', () => {
      tableSearch.value = '';
      sidebarSearch.value = '';
      clearSearchBtn.classList.remove('visible');
      renderTable();
      tableSearch.focus();
    });
  }

  // Sync sidebar search to table search
  sidebarSearch.addEventListener('input', (e) => {
    if (tableSearch) {
      tableSearch.value = e.target.value;
      if (clearSearchBtn) {
        clearSearchBtn.classList.toggle('visible', e.target.value.length > 0);
      }
    }
  });

  // Sale details modal
  document.getElementById('btnClose').addEventListener('click', () => {
    document.getElementById('saleModal').classList.remove('show');
  });

  document.getElementById('btnPrint').addEventListener('click', printSaleDetails);

  // Return modal
  document.getElementById('btnCancelReturn').addEventListener('click', () => {
    document.getElementById('returnModal').classList.remove('show');
    currentReturnSaleId = null;
  });

  document.getElementById('btnDoReturn').addEventListener('click', doReturn);

  // Close modals on outside click
  window.addEventListener('click', (e) => {
    const saleModal = document.getElementById('saleModal');
    const returnModal = document.getElementById('returnModal');
    
    if (e.target === saleModal) {
      saleModal.classList.remove('show');
    }
    
    if (e.target === returnModal) {
      returnModal.classList.remove('show');
      currentReturnSaleId = null;
    }
  });

  // Enter key for date inputs
  ['from', 'to'].forEach(id => {
    document.getElementById(id).addEventListener('keydown', (e) => {
      if (e.key === 'Enter') boot(false);
    });
  });

  // Keyboard shortcuts
  document.addEventListener('keydown', (e) => {
    // Ctrl/Cmd + F = Focus table search
    if ((e.ctrlKey || e.metaKey) && e.key === 'f') {
      e.preventDefault();
      const tableSearch = document.getElementById('tableSearch');
      if (tableSearch) {
        tableSearch.focus();
        tableSearch.select();
      } else {
        document.getElementById('q').focus();
      }
    }
    
    // Ctrl/Cmd + R = Refresh
    if ((e.ctrlKey || e.metaKey) && e.key === 'r') {
      e.preventDefault();
      boot(false);
    }
    
    // Escape = Close modals
    if (e.key === 'Escape') {
      document.getElementById('saleModal').classList.remove('show');
      document.getElementById('returnModal').classList.remove('show');
      currentReturnSaleId = null;
    }
  });
}

// ═════════════════════════════════════
// 📄 PAGINATION FUNCTIONS
// ═════════════════════════════════════
function updatePaginationUI(total) {
  const totalPages = Math.ceil(total / rowsPerPage);
  const paginationControls = document.getElementById('paginationControls');
  const pageInfo = document.getElementById('pageInfo');
  const prevBtn = document.getElementById('prevPage');
  const nextBtn = document.getElementById('nextPage');
  const pageJump = document.getElementById('pageJump');
  
  if (!paginationControls) {
    return;
  }
  
  // Hide pagination if:
  // 1. No data
  // 2. Viewing all records
  // 3. Total records fit in one page (≤ rowsPerPage)
  if (total === 0 || viewingAll || total <= rowsPerPage) {
    paginationControls.style.display = 'none';
    return;
  }
  
  // Update page info but keep hidden (will show on scroll)
  pageInfo.textContent = `صفحة ${currentPage} من ${totalPages} (${total} عملية)`;
  
  // Initialize scroll detection
  initPaginationScrollDetection();
  
  if (pageJump) {
    pageJump.max = totalPages;
  }
  
  if (prevBtn) {
    prevBtn.disabled = currentPage === 1;
    prevBtn.style.opacity = currentPage === 1 ? '0.5' : '1';
    prevBtn.style.cursor = currentPage === 1 ? 'not-allowed' : 'pointer';
  }
  
  if (nextBtn) {
    nextBtn.disabled = currentPage === totalPages || totalPages === 0;
    nextBtn.style.opacity = (currentPage === totalPages || totalPages === 0) ? '0.5' : '1';
    nextBtn.style.cursor = (currentPage === totalPages || totalPages === 0) ? 'not-allowed' : 'pointer';
  }
}

window.goToPage = function(pageNum) {
  const totalPages = Math.ceil(filteredSales.length / rowsPerPage);
  if (pageNum >= 1 && pageNum <= totalPages) {
    currentPage = pageNum;
    renderTable();
    
    const tableWrap = document.querySelector('.table-wrap');
    if (tableWrap) {
      tableWrap.scrollTop = 0;
    }
  }
};

window.changePage = function(direction) {
  const totalPages = Math.ceil(filteredSales.length / rowsPerPage);
  currentPage += direction;
  
  if (currentPage < 1) currentPage = 1;
  if (currentPage > totalPages) currentPage = totalPages;
  
  renderTable();
  
  const tableWrap = document.querySelector('.table-wrap');
  if (tableWrap) {
    tableWrap.scrollTop = 0;
  }
};

window.jumpToPage = function() {
  const input = document.getElementById('pageJump');
  const pageNum = parseInt(input.value);
  const totalPages = Math.ceil(filteredSales.length / rowsPerPage);
  
  if (pageNum >= 1 && pageNum <= totalPages) {
    currentPage = pageNum;
    renderTable();
    input.value = '';
    
    const tableWrap = document.querySelector('.table-wrap');
    if (tableWrap) {
      tableWrap.scrollTop = 0;
    }
    
    showToast(`انتقلت إلى الصفحة ${pageNum}`, 'success', 2000);
  } else {
    showToast(`الرجاء إدخال رقم صفحة بين 1 و ${totalPages}`, 'warning');
  }
};

window.toggleViewAll = function() {
  viewingAll = !viewingAll;
  const btn = document.getElementById('viewAllBtn');
  
  if (viewingAll) {
    btn.textContent = 'عرض بصفحات';
    showToast(`يتم عرض ${filteredSales.length} عملية`, 'info', 2000);
  } else {
    btn.textContent = 'عرض الكل';
    currentPage = 1;
    showToast('تم تفعيل نظام الصفحات (25 عملية/صفحة)', 'info', 2000);
  }
  
  renderTable();
};

// ═════════════════════════════════════
// 📜 PAGINATION SCROLL DETECTION
// ═════════════════════════════════════
function initPaginationScrollDetection() {
  const tableWrap = document.querySelector('.table-wrap');
  const paginationControls = document.getElementById('paginationControls');
  
  if (!tableWrap || !paginationControls) {
    return;
  }
  
  // Remove old listener if exists
  if (tableWrap._scrollHandler) {
    tableWrap.removeEventListener('scroll', tableWrap._scrollHandler);
  }
  
  let scrollTimeout;
  
  function checkScroll() {
    const { scrollTop, scrollHeight, clientHeight } = tableWrap;
    const scrollableHeight = scrollHeight - clientHeight;
    
    // If no scroll needed, hide pagination
    if (scrollableHeight <= 10) {
      paginationControls.style.display = 'none';
      return;
    }
    
    const scrollPercentage = (scrollTop / scrollableHeight) * 100;
    
    // Show when scrolled past 40% OR near bottom (within 100px)
    const nearBottom = (scrollableHeight - scrollTop) < 100;
    
    if (scrollPercentage > 40 || nearBottom) {
      paginationControls.style.display = 'flex';
    } else {
      paginationControls.style.display = 'none';
    }
  }
  
  // Use throttled scroll handler for better performance
  const throttledCheckScroll = throttle(checkScroll, 50);
  
  tableWrap._scrollHandler = () => {
    clearTimeout(scrollTimeout);
    throttledCheckScroll();
    
    // Auto-hide after 3 seconds of no scrolling (unless near bottom)
    scrollTimeout = setTimeout(() => {
      const { scrollTop, scrollHeight, clientHeight } = tableWrap;
      const nearBottom = ((scrollHeight - clientHeight) - scrollTop) < 100;
      
      if (!nearBottom) {
        paginationControls.style.display = 'none';
      }
    }, 3000);
  };
  
  tableWrap.addEventListener('scroll', tableWrap._scrollHandler, { passive: true });
  
  // Initial check
  setTimeout(checkScroll, 100);
}