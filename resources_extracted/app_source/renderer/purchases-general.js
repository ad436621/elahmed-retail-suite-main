// ═══════════════════════════════════════════════════════════════
// 📦 GENERAL PURCHASES PAGE - Unified View
// ═══════════════════════════════════════════════════════════════

// Fallbacks
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

// ═════════════════════════════════════
// 🔄 LOADING FUNCTIONS
// ═════════════════════════════════════
// Use Loading from shared.js if available, otherwise create fallback
function showLoading(message = 'جاري التحميل...') {
  if (window.Loading && typeof window.Loading.show === 'function') {
    window.Loading.show(message);
  } else {
    // Fallback: create simple loading overlay
    let overlay = document.getElementById('loadingOverlay');
    if (overlay) return;
    
    overlay = document.createElement('div');
    overlay.id = 'loadingOverlay';
    overlay.style.cssText = `
      position: fixed;
      inset: 0;
      background: rgba(0, 0, 0, 0.6);
      backdrop-filter: blur(4px);
      z-index: 10002;
      display: flex;
      align-items: center;
      justify-content: center;
      flex-direction: column;
      gap: 16px;
    `;
    overlay.innerHTML = `
      <style>
        @keyframes spin { to { transform: rotate(360deg); } }
      </style>
      <div style="
        width: 48px;
        height: 48px;
        border: 4px solid #3d4350;
        border-top-color: #00d4aa;
        border-radius: 50%;
        animation: spin 1s linear infinite;
      "></div>
      <span style="color: #e6e8ee; font-size: 14px;">${message}</span>
    `;
    document.body.appendChild(overlay);
  }
}

function hideLoading() {
  if (window.Loading && typeof window.Loading.hide === 'function') {
    window.Loading.hide();
  } else {
    // Fallback: remove loading overlay
    const overlay = document.getElementById('loadingOverlay');
    if (overlay) overlay.remove();
  }
}

// ═════════════════════════════════════
// 📊 STATE MANAGEMENT (Using Shared)
// ═════════════════════════════════════
let allPurchases = [];
let filteredPurchases = [];

// Pagination state (Using Shared)
const paginationState = window.SalesShared?.createPaginationState() || {
  currentPage: 1,
  rowsPerPage: 25,
  viewingAll: false
};

let currentPage = paginationState.currentPage;
let rowsPerPage = paginationState.rowsPerPage;
let viewingAll = paginationState.viewingAll;

// ═════════════════════════════════════
// 🌐 API CALLS
// ═════════════════════════════════════

/**
 * Load device purchases
 */
async function loadDevicePurchases({ fromISO, toISO }) {
  const p = new URLSearchParams();
  if (fromISO) p.set('from', fromISO);
  if (toISO) p.set('to', toISO);
  
  const res = await fetch('elos-db://purchases?' + p.toString());
  if (!res.ok) throw new Error(await res.text());
  
  const purchases = await res.json();
  // Normalize device purchases data
  return (purchases || []).map(purchase => ({
    id: purchase.id,
    type: 'device',
    purchase_type: 'device',
    product_name: `${purchase.device_model || ''} ${purchase.device_type || ''}`.trim() || 'جهاز',
    product_details: `${purchase.device_storage || ''} ${purchase.device_color || ''}`.trim() || '',
    supplier_name: purchase.supplier_name || purchase.party_name || '',
    supplier_phone: purchase.party_phone || '',
    price: Number(purchase.total_cost || 0),
    quantity: 1,
    total: Number(purchase.total_cost || 0),
    paid: Number(purchase.paid_now || 0),
    remaining: Number(purchase.total_cost || 0) - Number(purchase.paid_now || 0),
    created_at: purchase.created_at,
    status: purchase.status || 'completed',
    payment_method: purchase.payment_method || '',
    // Keep original data for details
    _original: purchase
  }));
}

/**
 * Load accessory purchases
 */
async function loadAccessoryPurchases({ fromISO, toISO }) {
  const p = new URLSearchParams();
  if (fromISO) p.set('from', fromISO);
  if (toISO) p.set('to', toISO);
  p.set('type', 'purchase'); // Only purchases, not returns
  
  const res = await fetch('elos-db://accessory-movements?' + p.toString());
  if (!res.ok) throw new Error(await res.text());
  
  const movements = await res.json();
  // Normalize accessory purchases data
  return (movements || []).map(movement => ({
    id: movement.id,
    type: 'accessory',
    purchase_type: 'accessory',
    product_name: movement.accessory_name || 'إكسسوار',
    product_details: movement.category || '',
    supplier_name: movement.supplier_name || '',
    supplier_phone: '',
    price: Number(movement.unit_price || 0),
    quantity: Math.abs(Number(movement.quantity || 1)), // Use absolute value (quantity is positive for purchases)
    total: Number(movement.total_price || 0),
    paid: Number(movement.paid_amount || 0),
    remaining: Number(movement.total_price || 0) - Number(movement.paid_amount || 0),
    created_at: movement.created_at,
    status: movement.status || 'completed',
    payment_method: movement.payment_method || '',
    // Keep original data for details
    _original: movement
  }));
}

/**
 * Load repair parts purchases
 */
async function loadRepairPartsPurchases({ fromISO, toISO }) {
  try {
    const res = await fetch('elos-db://repair-parts-movements');
    if (!res.ok) throw new Error(await res.text());
    
    const movements = await res.json();
    // Filter only purchases (type='in' and qty > 0) and apply date filter
    let filtered = (movements || []).filter(m => m.type === 'in' && m.qty > 0);
    
    // Apply date filter if provided
    if (fromISO || toISO) {
      filtered = filtered.filter(m => {
        if (!m.created_at) return false;
        const movementDate = new Date(m.created_at).toISOString().slice(0, 10);
        if (fromISO && movementDate < fromISO) return false;
        if (toISO && movementDate > toISO) return false;
        return true;
      });
    }
    
    // Normalize repair parts purchases data
    return filtered.map(movement => ({
      id: movement.id,
      type: 'repair_part',
      purchase_type: 'repair_part',
      product_name: movement.part_name || 'قطعة صيانة',
      product_details: movement.part_category || '',
      supplier_name: movement.supplier_name || '',
      supplier_phone: '',
      price: Number(movement.unit_cost || 0),
      quantity: Math.abs(Number(movement.qty || 1)),
      total: Math.abs(Number(movement.qty || 0) * Number(movement.unit_cost || 0)),
      paid: 0, // TODO: جلب من safe_transactions إذا لزم الأمر
      remaining: Math.abs(Number(movement.qty || 0) * Number(movement.unit_cost || 0)),
      created_at: movement.created_at,
      status: 'completed',
      payment_method: '',
      // Keep original data for details
      _original: movement
    }));
  } catch (error) {
    Logger.error('Error loading repair parts purchases:', error);
    return []; // Return empty array on error
  }
}

/**
 * Load all purchases and combine
 */
async function loadAllPurchases() {
  try {
    showLoading();
    
    const fromInput = document.getElementById('from');
    const toInput = document.getElementById('to');
    const fromISO = fromInput?.value || null;
    const toISO = toInput?.value || null;

    // Load all purchase types in parallel
    const [devicePurchases, accessoryPurchases, repairPartsPurchases] = await Promise.all([
      loadDevicePurchases({ fromISO, toISO }),
      loadAccessoryPurchases({ fromISO, toISO }),
      loadRepairPartsPurchases({ fromISO, toISO })
    ]);

    // Combine and sort by date (newest first)
    allPurchases = [...devicePurchases, ...accessoryPurchases, ...repairPartsPurchases].sort((a, b) => {
      return new Date(b.created_at) - new Date(a.created_at);
    });

    // Apply filters
    applyFilters();
    
    hideLoading();
  } catch (error) {
    hideLoading();
    // Use shared error handler if available
    if (window.SalesErrorHandler) {
      window.SalesErrorHandler.showError(error, {
        NETWORK_ERROR: 'فشل الاتصال بالخادم. يرجى التحقق من الاتصال.',
        SERVER_ERROR: 'حدث خطأ في الخادم. يرجى المحاولة مرة أخرى.'
      }, {
        duration: window.SalesConstants?.NOTIFICATIONS.ERROR_DURATION || 5000
      });
    } else {
      Logger.error('Load purchases error:', error);
      showToast('فشل تحميل المشتريات: ' + error.message, 'error');
    }
  }
}

// ═════════════════════════════════════
// 🔍 FILTERS
// ═════════════════════════════════════

function applyFilters() {
  const typeFilter = document.getElementById('typeFilter')?.value || 'all';
  const searchTerm = (document.getElementById('searchInput')?.value || '').toLowerCase().trim();

  // Filter by type
  let filtered = allPurchases;
  if (typeFilter !== 'all') {
    filtered = filtered.filter(p => p.type === typeFilter);
  }

  // Filter by search term
  if (searchTerm) {
    filtered = filtered.filter(p => {
      return (
        (p.product_name || '').toLowerCase().includes(searchTerm) ||
        (p.supplier_name || '').toLowerCase().includes(searchTerm) ||
        (p.product_details || '').toLowerCase().includes(searchTerm) ||
        String(p.id || '').includes(searchTerm)
      );
    });
  }

  filteredPurchases = filtered;
  currentPage = 1;
  renderTable();
  updatePagination();
}

// ═════════════════════════════════════
// 🎨 RENDER TABLE
// ═════════════════════════════════════

function renderTable() {
  const tbody = document.getElementById('purchasesBody');
  if (!tbody) return;

  if (filteredPurchases.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="10" class="empty-state">
          <div class="empty-state-icon">📦</div>
          <div class="empty-state-text">لا توجد مشتريات</div>
          <div class="empty-state-subtext">جرب تغيير الفلاتر أو نطاق التاريخ</div>
        </td>
      </tr>
    `;
    return;
  }

  // Calculate pagination
  const start = (currentPage - 1) * rowsPerPage;
  const end = start + rowsPerPage;
  const pageData = filteredPurchases.slice(start, end);

  // Use document fragment for better performance
  const fragment = document.createDocumentFragment();

  pageData.forEach(purchase => {
    const tr = document.createElement('tr');
    tr.onclick = () => showPurchaseDetails(purchase);
    
    const date = purchase.created_at ? new Date(purchase.created_at).toLocaleDateString('ar-EG', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    }) : '-';

    const typeBadge = purchase.type === 'device' 
      ? '<span class="type-badge type-device">جهاز</span>'
      : purchase.type === 'repair_part'
      ? '<span class="type-badge type-repair-part">قطعة صيانة</span>'
      : '<span class="type-badge type-accessory">إكسسوار</span>';

    const statusBadge = purchase.status === 'returned'
      ? '<span class="status-badge status-returned">مرتجع</span>'
      : '<span class="status-badge status-completed">مكتمل</span>';

    tr.innerHTML = `
      <td>${escapeHtml(date)}</td>
      <td>${typeBadge}</td>
      <td>
        <div style="font-weight: 600;">${escapeHtml(purchase.product_name)}</div>
        ${purchase.product_details ? `<div style="font-size: 12px; color: var(--text-secondary);">${escapeHtml(purchase.product_details)}</div>` : ''}
      </td>
      <td>${escapeHtml(purchase.supplier_name || '-')}</td>
      <td>${purchase.quantity || 1}</td>
      <td>${fmt(purchase.price)} ج.م</td>
      <td style="font-weight: 600;">${fmt(purchase.total)} ج.م</td>
      <td style="color: var(--success);">${fmt(purchase.paid)} ج.م</td>
      <td style="color: ${purchase.remaining > 0 ? 'var(--warning)' : 'var(--text-secondary)'};">
        ${fmt(purchase.remaining)} ج.م
      </td>
      <td>${statusBadge}</td>
    `;

    fragment.appendChild(tr);
  });

  tbody.innerHTML = '';
  tbody.appendChild(fragment);

  // Update total count
  const totalCountEl = document.getElementById('totalCount');
  if (totalCountEl) {
    totalCountEl.textContent = `${filteredPurchases.length} عنصر`;
  }
}

// ═════════════════════════════════════
// 📄 PAGINATION
// ═════════════════════════════════════

function updatePagination() {
  const totalPages = Math.ceil(filteredPurchases.length / rowsPerPage);
  
  // Update pagination info
  const start = filteredPurchases.length === 0 ? 0 : (currentPage - 1) * rowsPerPage + 1;
  const end = Math.min(currentPage * rowsPerPage, filteredPurchases.length);
  const paginationInfo = document.getElementById('paginationInfo');
  if (paginationInfo) {
    paginationInfo.textContent = `${start} - ${end} من ${filteredPurchases.length}`;
  }

  // Update buttons
  const prevBtn = document.getElementById('prevPage');
  const nextBtn = document.getElementById('nextPage');
  if (prevBtn) prevBtn.disabled = currentPage === 1;
  if (nextBtn) nextBtn.disabled = currentPage >= totalPages;

  // Update page numbers (show max 5 pages)
  const pageNumbers = document.getElementById('pageNumbers');
  if (pageNumbers && totalPages > 0) {
    let startPage = Math.max(1, currentPage - 2);
    let endPage = Math.min(totalPages, startPage + 4);
    if (endPage - startPage < 4) {
      startPage = Math.max(1, endPage - 4);
    }

    let html = '';
    for (let i = startPage; i <= endPage; i++) {
      html += `<button class="pagination-btn ${i === currentPage ? 'active' : ''}" onclick="goToPage(${i})">${i}</button>`;
    }
    pageNumbers.innerHTML = html;
  }
}

function goToPage(page) {
  const totalPages = Math.ceil(filteredPurchases.length / rowsPerPage);
  if (page < 1 || page > totalPages) return;
  currentPage = page;
  renderTable();
  updatePagination();
  // Scroll to top
  document.querySelector('.table-wrapper')?.scrollTo(0, 0);
}

// ═════════════════════════════════════
// 📅 QUICK FILTERS
// ═════════════════════════════════════

function setQuickFilter(filter) {
  const now = new Date();
  const fromInput = document.getElementById('from');
  const toInput = document.getElementById('to');

  let fromDate, toDate;

  switch (filter) {
    case 'today':
      fromDate = toDate = todayISO();
      break;
    case 'week':
      const weekAgo = new Date(now);
      weekAgo.setDate(weekAgo.getDate() - 7);
      fromDate = weekAgo.toISOString().slice(0, 10);
      toDate = todayISO();
      break;
    case 'month':
      const monthAgo = new Date(now);
      monthAgo.setMonth(monthAgo.getMonth() - 1);
      fromDate = monthAgo.toISOString().slice(0, 10);
      toDate = todayISO();
      break;
    case 'year':
      const yearAgo = new Date(now);
      yearAgo.setFullYear(yearAgo.getFullYear() - 1);
      fromDate = yearAgo.toISOString().slice(0, 10);
      toDate = todayISO();
      break;
    default:
      return;
  }

  if (fromInput) fromInput.value = fromDate;
  if (toInput) toInput.value = toDate;

  // Update active button
  document.querySelectorAll('.quick-filter-btn').forEach(btn => {
    btn.classList.remove('active');
    if (btn.dataset.filter === filter) {
      btn.classList.add('active');
    }
  });

  loadAllPurchases();
}

// ═════════════════════════════════════
// 🔍 DETAILS MODAL (Placeholder)
// ═════════════════════════════════════

function showPurchaseDetails(purchase) {
  // TODO: Implement purchase details modal
  Logger.log('Purchase details:', purchase);
  showToast(`تفاصيل المشتري: ${purchase.product_name}`, 'info');
}

// ═════════════════════════════════════
// 🚀 INITIALIZATION
// ═════════════════════════════════════

window.boot = async function() {
  // Set default date range (last 6 months)
  const now = new Date();
  const sixMonthsAgo = new Date();
  sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);

  const fromInput = document.getElementById('from');
  const toInput = document.getElementById('to');
  if (fromInput) fromInput.value = sixMonthsAgo.toISOString().slice(0, 10);
  if (toInput) toInput.value = now.toISOString().slice(0, 10);

  // Event listeners
  document.getElementById('from')?.addEventListener('change', loadAllPurchases);
  document.getElementById('to')?.addEventListener('change', loadAllPurchases);
  document.getElementById('typeFilter')?.addEventListener('change', applyFilters);
  
  const searchInput = document.getElementById('searchInput');
  if (searchInput) {
    searchInput.addEventListener('input', debounce(applyFilters, 300));
  }

  // Quick filter buttons
  document.querySelectorAll('.quick-filter-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      setQuickFilter(btn.dataset.filter);
    });
  });

  // Refresh button
  document.getElementById('refreshBtn')?.addEventListener('click', loadAllPurchases);

  // Pagination buttons
  document.getElementById('prevPage')?.addEventListener('click', () => goToPage(currentPage - 1));
  document.getElementById('nextPage')?.addEventListener('click', () => goToPage(currentPage + 1));

  // Initial load
  await loadAllPurchases();
};

// Auto-boot if DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', window.boot);
} else {
  window.boot();
}

