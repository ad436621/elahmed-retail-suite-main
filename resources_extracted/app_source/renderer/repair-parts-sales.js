// ═══════════════════════════════════════════════════════════════
// 🔧 ELOS REPAIR PARTS SALES SYSTEM - v1.2 (Using Shared Utils)
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
const todayISO = window.SalesShared?.todayISO || (() => new Date().toISOString().slice(0, 10));
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
const SalesCache = window.SalesShared?.createCache('repairPartsSalesCache') || {
  data: null,
  timestamp: null,
  cacheKey: null,
  duration: window.SalesConstants?.CACHE.DURATION || 5 * 60 * 1000,
  
  set(sales, key) {
    this.data = sales;
    this.timestamp = Date.now();
    this.cacheKey = key;
    try {
      sessionStorage.setItem('accessorySalesCache', JSON.stringify({
        data: sales,
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
      const cached = sessionStorage.getItem('accessorySalesCache');
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
      sessionStorage.removeItem('accessorySalesCache');
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
    info: '#8b5cf6'
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
async function loadRepairPartsSales({ fromISO, toISO }) {
  const p = new URLSearchParams();
  if (fromISO) p.set('from', fromISO);
  if (toISO) p.set('to', toISO);
  p.set('limit', '10000');

  // جلب مبيعات نقطة البيع
  const posUrl = 'elos-db://repair-parts-pos-sales?' + p.toString();
  const ticketUrl = 'elos-db://repair-parts-sales?' + p.toString();

  const [posRes, ticketRes] = await Promise.all([
    fetch(posUrl),
    fetch(ticketUrl)
  ]);

  if (!posRes.ok) {
    const errText = await posRes.text();
    console.error('[REPAIR-PARTS-SALES] ❌ POS API Error:', errText);
    throw new Error(errText);
  }
  if (!ticketRes.ok) {
    const errText = await ticketRes.text();
    console.error('[REPAIR-PARTS-SALES] ❌ Ticket API Error:', errText);
    throw new Error(errText);
  }

  const posData = (await posRes.json()).sales || [];
  const ticketData = await ticketRes.json();
  const ticketList = Array.isArray(ticketData) ? ticketData : (ticketData.sales || []);

  // توحيد شكل مبيعات نقطة البيع مع حقل المصدر
  const posSales = posData.map(sale => ({
    id: 'pos-' + sale.id,
    rawId: sale.id,
    source: 'pos',
    part_name: sale.part_name || sale.name,
    part_category: sale.part_category || sale.category,
    part_sku: sale.part_sku || sale.sku,
    qty: sale.quantity || sale.qty || 1,
    unit_cost: sale.sell_price || sale.unit_price || sale.total_price || 0,
    customer_name: sale.client_name || sale.customer_name,
    customer_phone: sale.client_phone || sale.customer_phone,
    ticket_no: sale.invoice_number || String(sale.id),
    invoice_number: sale.invoice_number || null,
    ticket_id: sale.id,
    delivered_at: sale.sold_at || sale.created_at,
    created_at: sale.created_at,
    updated_at: sale.updated_at,
    payment_method: sale.payment_method,
    notes: sale.notes,
    profit: sale.profit || 0
  }));

  // توحيد شكل مبيعات تذكرة الصيانة مع حقل المصدر
  const ticketSales = ticketList.map(sale => {
    const unitPrice = Number(sale.unit_price) || Number(sale.unit_cost) || 0;
    const qty = Number(sale.qty) || 1;
    return {
      id: 'ticket-' + sale.id,
      rawId: sale.id,
      source: 'repair_ticket',
      part_name: sale.part_name || '-',
      part_category: sale.part_category || '-',
      part_sku: sale.part_sku || '',
      qty,
      unit_cost: unitPrice,
      customer_name: sale.customer_name || '-',
      customer_phone: sale.customer_phone || '',
      ticket_no: sale.ticket_no || '-',
      invoice_number: null,
      ticket_id: sale.ticket_id,
      delivered_at: sale.delivered_at || sale.updated_at || sale.created_at,
      created_at: sale.created_at,
      updated_at: sale.updated_at,
      payment_method: null,
      notes: null,
      profit: 0
    };
  });

  const merged = [...posSales, ...ticketSales].sort((a, b) => {
    const da = new Date(a.delivered_at || a.created_at || 0).getTime();
    const db = new Date(b.delivered_at || b.created_at || 0).getTime();
    return db - da;
  });

  console.log('[REPAIR-PARTS-SALES] 📊 Loaded POS:', posSales.length, 'Ticket:', ticketSales.length, 'Total:', merged.length);
  return merged;
}

// ═════════════════════════════════════
// 📊 STATE MANAGEMENT (Using Shared)
// ═════════════════════════════════════
let allSales = [];
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
// 🎨 RENDERING FUNCTIONS
// ═════════════════════════════════════

function getStatusLabel(status) {
  const labels = {
    consumed: 'مستهلك',
    deducted: 'مخصوم'
  };
  return labels[status] || status || 'غير محدد';
}

function getStatusBadgeClass(status) {
  if (status === 'consumed' || status === 'deducted') return 'status-sale';
  return 'status-sale';
}

function formatDate(isoString) {
  if (!isoString) return '-';
  const d = new Date(isoString);
  return d.toLocaleDateString('en-US', { 
    year: 'numeric', 
    month: 'short', 
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
}

function renderTable() {
  const tbody = document.getElementById('tbody');
  const searchTerm = (document.getElementById('q')?.value || '').toLowerCase();
  
  const sourceLabel = (src) => (src === 'pos' ? 'نقطة البيع' : 'تذكرة الصيانة');

  // Filter sales
  filteredSales = allSales.filter(s => {
    if (searchTerm) {
      const searchableText = [
        s.part_name,
        s.part_category,
        s.ticket_no,
        s.customer_name,
        s.customer_phone,
        s.part_sku,
        sourceLabel(s.source)
      ].filter(Boolean).join(' ').toLowerCase();
      if (!searchableText.includes(searchTerm)) return false;
    }
    return true;
  });

  const totalPages = Math.ceil(filteredSales.length / rowsPerPage);
  let displaySales = filteredSales;
  if (!viewingAll && filteredSales.length > rowsPerPage) {
    const start = (currentPage - 1) * rowsPerPage;
    const end = start + rowsPerPage;
    displaySales = filteredSales.slice(start, end);
  }

  updatePaginationUI(filteredSales.length);

  if (displaySales.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="12" class="empty-state">
          <div class="empty-state-icon">🔧</div>
          <div class="empty-state-text">
            ${searchTerm ? 'لا توجد نتائج مطابقة' : 'لا توجد مبيعات قطع غيار لعرضها'}
          </div>
        </td>
      </tr>
    `;
    return;
  }

  const safeId = (id) => String(id).replace(/\\/g, '\\\\').replace(/'/g, "\\'");
  tbody.innerHTML = displaySales.map((s, idx) => {
    const globalIdx = viewingAll ? idx : ((currentPage - 1) * rowsPerPage + idx);
    const totalPrice = (s.qty || 0) * (s.unit_cost || 0);
    const deliveryDate = s.delivered_at || s.updated_at || s.created_at;
    const isDelivered = !!s.delivered_at;
    const rowClass = isDelivered ? 'row-delivered' : '';
    const sid = safeId(s.id);
    const isPos = s.source === 'pos';
    return `
      <tr class="${rowClass}" onclick="showSaleDetails('${sid}')">
        <td>${globalIdx + 1}</td>
        <td>${formatDate(deliveryDate)}</td>
        <td><strong>${escapeHtml(s.part_name || '-')}</strong></td>
        <td>${escapeHtml(s.part_category || '-')}</td>
        <td><strong>#${escapeHtml(s.ticket_no || String(s.ticket_id || '-'))}</strong></td>
        <td>${fmt(s.qty || 0, 2)}</td>
        <td>${fmt(s.unit_cost || 0, 2)}</td>
        <td><strong>${fmt(totalPrice, 2)}</strong></td>
        <td>${escapeHtml(s.customer_name || '-')}</td>
        <td>${formatDate(deliveryDate)}</td>
        <td><span class="status-badge ${isPos ? 'status-sale' : 'status-adjustment'}">${isPos ? '🛒 نقطة البيع' : '🔧 تذكرة الصيانة'}</span></td>
        <td>
          <button class="action-btn" onclick="event.stopPropagation(); printRepairInvoice('${sid}')" title="طباعة الفاتورة">🖨️ طباعة</button>
          <button class="action-btn" onclick="event.stopPropagation(); showSaleDetails('${sid}')">👁️ عرض</button>
        </td>
      </tr>
    `;
  }).join('');
  
  // Update stats
  updateStats();
}

function updateStats() {
  const stats = {
    totalSales: 0,
    totalCost: 0,
    count: filteredSales.length
  };
  
  filteredSales.forEach(s => {
    const totalPrice = (s.qty || 0) * (s.unit_cost || 0);
    stats.totalSales += totalPrice;
    stats.totalCost += totalPrice; // في حالة قطع الصيانة، unit_cost هو التكلفة
  });
  
  // تحديث بالـ IDs
  const totalEl = document.getElementById('statTotalSales');
  const profitEl = document.getElementById('statTotalProfit');
  const countEl = document.getElementById('statSalesCount');
  
  if (totalEl) totalEl.textContent = fmt(stats.totalSales);
  if (profitEl) profitEl.textContent = fmt(stats.totalCost); // إجمالي التكلفة
  if (countEl) countEl.textContent = stats.count;
  
  // fallback للطريقة القديمة
  const headerStats = document.getElementById('headerStats');
  if (headerStats && !totalEl) {
    const statValues = headerStats.querySelectorAll('.stat-value');
    if (statValues[0]) statValues[0].textContent = fmt(stats.totalSales);
    if (statValues[1]) statValues[1].textContent = fmt(stats.totalCost);
    if (statValues[2]) statValues[2].textContent = stats.count;
  }
}

// ═════════════════════════════════════
// 📄 REPAIR SALE CONTROL CENTER MODAL
// ═════════════════════════════════════
window.showSaleDetails = function(saleId) {
  const sale = allSales.find(s => String(s.id) === String(saleId));
  if (!sale) {
    showToast('لم يتم العثور على العملية', 'error');
    return;
  }

  const isPos = sale.source === 'pos';
  const sourceLabel = isPos ? 'نقطة البيع' : 'تذكرة الصيانة';

  const modal = document.getElementById('saleModal');
  const detailsDiv = document.getElementById('saleDetails');
  const modalTitle = document.getElementById('modalTitle');
  const modalSubtitle = document.getElementById('modalSubtitle');
  const modalStatusBadge = document.getElementById('modalStatusBadge');

  const totalPrice = (sale.qty || 0) * (sale.unit_cost || 0);
  const deliveryDate = sale.delivered_at || sale.updated_at || sale.created_at;
  const ticketNo = sale.ticket_no || sale.ticket_id || '-';
  const isDelivered = !!sale.delivered_at;

  if (isPos) {
    modalTitle.textContent = 'تفاصيل بيع من نقطة البيع';
    modalSubtitle.innerHTML = '<span>رقم الفاتورة: <strong>#' + escapeHtml(ticketNo) + '</strong></span>';
  } else {
    modalTitle.textContent = 'تفاصيل عملية صيانة (قطعة من تذكرة)';
    modalSubtitle.innerHTML = '<span>رقم التذكرة: <strong>#' + escapeHtml(ticketNo) + '</strong></span>';
  }

  if (isDelivered) {
    modalStatusBadge.className = 'status-badge-large status-delivered';
    modalStatusBadge.textContent = 'تم التسليم';
  } else {
    modalStatusBadge.className = 'status-badge-large status-pending';
    modalStatusBadge.textContent = 'قيد الانتظار';
  }

  const saleIdEsc = String(sale.id).replace(/\\/g, '\\\\').replace(/'/g, "\\'");

  if (isPos) {
    // ─── مودال بيع عادي من نقطة البيع: تفاصيل الفاتورة فقط + طباعة
    detailsDiv.innerHTML = `
      <div class="modal-section">
        <div class="modal-section-title"><span>📄</span><span>الفاتورة والعميل</span></div>
        <div class="detail-row">
          <span class="detail-label">رقم الفاتورة</span>
          <span class="detail-value"><strong>#${escapeHtml(ticketNo)}</strong></span>
        </div>
        <div class="detail-row">
          <span class="detail-label">التاريخ</span>
          <span class="detail-value">${formatDate(deliveryDate)}</span>
        </div>
        <div class="detail-row">
          <span class="detail-label">العميل</span>
          <span class="detail-value"><strong>${escapeHtml(sale.customer_name || '-')}</strong></span>
        </div>
        ${sale.customer_phone ? `<div class="detail-row"><span class="detail-label">الهاتف</span><span class="detail-value">${escapeHtml(sale.customer_phone)}</span></div>` : ''}
        ${sale.payment_method ? `<div class="detail-row"><span class="detail-label">طريقة الدفع</span><span class="detail-value">${escapeHtml(sale.payment_method)}</span></div>` : ''}
      </div>
      <div class="modal-section">
        <div class="modal-section-title"><span>🔧</span><span>القطعة والمبلغ</span></div>
        <div class="detail-row">
          <span class="detail-label">القطعة</span>
          <span class="detail-value"><strong>${escapeHtml(sale.part_name || '-')}</strong></span>
        </div>
        ${sale.part_category ? `<div class="detail-row"><span class="detail-label">الفئة</span><span class="detail-value">${escapeHtml(sale.part_category)}</span></div>` : ''}
        <div class="detail-row">
          <span class="detail-label">الكمية × سعر الوحدة</span>
          <span class="detail-value">${fmt(sale.qty || 0, 2)} × ${fmt(sale.unit_cost || 0, 2)} ج.م</span>
        </div>
        <div class="detail-row">
          <span class="detail-label">الإجمالي</span>
          <span class="detail-value highlight"><strong>${fmt(totalPrice, 2)} ج.م</strong></span>
        </div>
      </div>
      <div class="modal-section">
        <div class="modal-section-title"><span>🖨️</span><span>إجراء</span></div>
        <div class="modal-actions-group">
          <button class="btn-print-primary" onclick="printRepairInvoice('${saleIdEsc}')">
            <span>🖨️</span><span>طباعة الفاتورة</span>
          </button>
        </div>
      </div>
    `;
  } else {
    // ─── مودال تذكرة صيانة: تفاصيل عملية صيانة كاملة + إجراءات التذكرة
    detailsDiv.innerHTML = `
      <div class="modal-section">
        <div class="modal-section-title"><span>🔧</span><span>المصدر</span></div>
        <div class="detail-row">
          <span class="detail-label">نوع العملية</span>
          <span class="detail-value"><strong>تذكرة الصيانة</strong></span>
        </div>
      </div>
      <div class="modal-section">
        <div class="modal-section-title"><span>👤</span><span>العميل والقطعة</span></div>
        <div class="detail-row">
          <span class="detail-label">اسم العميل</span>
          <span class="detail-value"><strong>${escapeHtml(sale.customer_name || '-')}</strong></span>
        </div>
        ${sale.customer_phone ? `<div class="detail-row"><span class="detail-label">هاتف العميل</span><span class="detail-value">${escapeHtml(sale.customer_phone)}</span></div>` : ''}
        <div class="detail-row">
          <span class="detail-label">اسم القطعة</span>
          <span class="detail-value"><strong>${escapeHtml(sale.part_name || '-')}</strong></span>
        </div>
        <div class="detail-row">
          <span class="detail-label">الفئة</span>
          <span class="detail-value">${escapeHtml(sale.part_category || '-')}</span>
        </div>
        ${sale.part_sku ? `<div class="detail-row"><span class="detail-label">SKU</span><span class="detail-value">${escapeHtml(sale.part_sku)}</span></div>` : ''}
        <div class="detail-row">
          <span class="detail-label">رقم التذكرة</span>
          <span class="detail-value"><strong>#${escapeHtml(ticketNo)}</strong></span>
        </div>
        ${sale.ticket_status ? `<div class="detail-row"><span class="detail-label">حالة التذكرة</span><span class="detail-value">${escapeHtml(sale.ticket_status)}</span></div>` : ''}
        <div class="detail-row">
          <span class="detail-label">التاريخ</span>
          <span class="detail-value">${formatDate(deliveryDate)}</span>
        </div>
      </div>
      <div class="modal-section">
        <div class="modal-section-title"><span>💰</span><span>ملخص مالي</span></div>
        <div class="financial-grid">
          <div class="financial-item">
            <div class="financial-item-label">سعر الوحدة</div>
            <div class="financial-item-value">${fmt(sale.unit_cost || 0, 2)} ج.م</div>
          </div>
          <div class="financial-item">
            <div class="financial-item-label">الكمية</div>
            <div class="financial-item-value">${fmt(sale.qty || 0, 2)}</div>
          </div>
          <div class="financial-item" style="grid-column: span 2;">
            <div class="financial-item-label">الإجمالي</div>
            <div class="financial-item-value highlight">${fmt(totalPrice, 2)} ج.م</div>
          </div>
        </div>
      </div>
      <div class="modal-section">
        <div class="modal-section-title"><span>⚙️</span><span>الإجراءات</span></div>
        <div class="modal-actions-group">
          <button class="btn-print-primary" onclick="printRepairInvoice('${saleIdEsc}')">
            <span>🖨️</span><span>طباعة فاتورة صيانة</span>
          </button>
          <button class="btn-print-secondary" onclick="printDeliveryReceipt('${saleIdEsc}')">
            <span>📄</span><span>طباعة إيصال استلام / تسليم</span>
          </button>
          <button class="btn-print-secondary" onclick="printDeviceBarcode('${saleIdEsc}')">
            <span>🏷️</span><span>طباعة باركود الجهاز</span>
          </button>
          ${ticketNo && ticketNo !== '-' ? `
            <button class="btn-print-secondary" onclick="openRepairTicket('${String(ticketNo).replace(/\\/g, '\\\\').replace(/'/g, "\\'")}')">
              <span>🔧</span><span>فتح تذكرة الصيانة</span>
            </button>
          ` : ''}
        </div>
      </div>
    `;
  }

  var btnPrintFooter = document.getElementById('btnPrintSaleInvoice');
  if (btnPrintFooter) {
    btnPrintFooter.style.display = 'inline-flex';
    btnPrintFooter.onclick = function(ev) { ev.preventDefault(); printRepairInvoice(sale.id); };
  }

  modal.classList.add('show');
};

// Store current sale for print functions
let currentSaleForPrint = null;

// ═════════════════════════════════════
// 🖨️ PRINT FUNCTIONS
// ═════════════════════════════════════

window.printRepairInvoice = function(saleId) {
  const sale = allSales.find(s => String(s.id) === String(saleId));
  if (!sale) {
    showToast('لم يتم العثور على العملية', 'error');
    return;
  }

  currentSaleForPrint = sale;
  const settings = JSON.parse(localStorage.getItem('appSettings') || '{}');
  const companyName = settings.companyName || 'ELOS System';
  const companyLogo = settings.companyLogo || '';

  const totalPrice = (sale.qty || 0) * (sale.unit_cost || 0);
  const ticketNo = sale.ticket_no || sale.ticket_id || '-';
  const invoiceNo = sale.source === 'pos' && sale.invoice_number ? sale.invoice_number : `REP-${sale.rawId != null ? sale.rawId : sale.id}`;
  const deliveryDate = sale.delivered_at || sale.updated_at || sale.created_at;
  const dateStr = formatDate(deliveryDate);
  
  const invoiceHTML = `
<!DOCTYPE html>
<html dir="rtl" lang="ar">
<head>
  <meta charset="UTF-8">
  <title>فاتورة صيانة ${invoiceNo}</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: 'Cairo', Arial, sans-serif;
      width: 76mm;
      padding: 8px;
      background: #fff;
      color: #000;
      direction: rtl;
    }
    .header {
      text-align: center;
      padding-bottom: 10px;
      border-bottom: 2px dashed #000;
      margin-bottom: 10px;
    }
    .logo { max-width: 50px; max-height: 50px; margin-bottom: 5px; }
    .company-name { font-size: 16px; font-weight: 900; }
    .invoice-title {
      text-align: center;
      background: #000;
      color: #fff;
      padding: 6px;
      font-weight: 900;
      font-size: 14px;
      margin: 10px 0;
    }
    .invoice-info {
      background: #f5f5f5;
      padding: 8px;
      margin-bottom: 10px;
      border: 1px solid #000;
    }
    .info-row {
      display: flex;
      justify-content: space-between;
      font-size: 11px;
      padding: 3px 0;
    }
    .items-section {
      border: 1px solid #000;
      margin-bottom: 10px;
    }
    .items-header {
      background: #000;
      color: #fff;
      padding: 5px;
      font-size: 12px;
      font-weight: 700;
      text-align: center;
    }
    .item {
      padding: 8px;
      border-bottom: 1px dashed #ccc;
    }
    .item:last-child { border-bottom: none; }
    .item-name { font-weight: 700; font-size: 12px; margin-bottom: 4px; }
    .item-detail { font-size: 10px; color: #333; padding: 1px 0; }
    .item-price { font-weight: 900; font-size: 12px; text-align: left; margin-top: 5px; }
    .totals {
      border: 1px solid #000;
      padding: 8px;
      margin-bottom: 10px;
    }
    .total-row {
      display: flex;
      justify-content: space-between;
      font-size: 11px;
      padding: 3px 0;
    }
    .grand-total {
      background: #000;
      color: #fff;
      padding: 12px;
      text-align: center;
      margin: 10px 0;
    }
    .grand-total-label { font-size: 12px; }
    .grand-total-value { font-size: 20px; font-weight: 900; margin-top: 5px; }
    .footer {
      text-align: center;
      padding-top: 10px;
      border-top: 2px dashed #000;
      margin-top: 10px;
      font-size: 10px;
    }
    .barcode {
      text-align: center;
      margin-top: 10px;
      font-family: monospace;
      font-size: 10px;
    }
    @media print {
      body { width: 100%; }
      @page { margin: 0; }
    }
  </style>
</head>
<body>
  <div class="header">
    ${companyLogo ? `<img src="${companyLogo}" class="logo" />` : ''}
    <div class="company-name">${companyName}</div>
  </div>

  <div class="invoice-title">فاتورة صيانة</div>

  <div class="invoice-info">
    <div class="info-row">
      <span>رقم الفاتورة:</span>
      <span><strong>${invoiceNo}</strong></span>
    </div>
    <div class="info-row">
      <span>رقم التذكرة:</span>
      <span><strong>#${ticketNo}</strong></span>
    </div>
    <div class="info-row">
      <span>التاريخ:</span>
      <span>${dateStr}</span>
    </div>
    <div class="info-row">
      <span>العميل:</span>
      <span>${escapeHtml(sale.customer_name || '-')}</span>
    </div>
    ${sale.customer_phone ? `
      <div class="info-row">
        <span>الهاتف:</span>
        <span>${escapeHtml(sale.customer_phone)}</span>
      </div>
    ` : ''}
  </div>

  <div class="items-section">
    <div class="items-header">تفاصيل القطعة</div>
    <div class="item">
      <div class="item-name">${escapeHtml(sale.part_name || '-')}</div>
      <div class="item-detail">الفئة: ${escapeHtml(sale.part_category || '-')}</div>
      ${sale.part_sku ? `<div class="item-detail">SKU: ${escapeHtml(sale.part_sku)}</div>` : ''}
      <div class="item-detail">الكمية: ${fmt(sale.qty || 0, 2)}</div>
      <div class="item-detail">سعر الوحدة: ${fmt(sale.unit_cost || 0, 2)} ج.م</div>
      <div class="item-price">الإجمالي: ${fmt(totalPrice, 2)} ج.م</div>
    </div>
  </div>

  <div class="totals">
    <div class="total-row">
      <span>الإجمالي:</span>
      <span><strong>${fmt(totalPrice, 2)} ج.م</strong></span>
    </div>
  </div>

  <div class="grand-total">
    <div class="grand-total-label">الإجمالي الكلي</div>
    <div class="grand-total-value">${fmt(totalPrice, 2)} ج.م</div>
  </div>

  <div class="footer">
    <div>✨ ${settings.printerFooterMessage || 'شكراً لتعاملكم معنا'} ✨</div>
    <div class="barcode">${invoiceNo}</div>
    <div style="margin-top:8px;font-size:8px;color:#999">ELOS System</div>
  </div>

  <script>
    setTimeout(() => {
      window.print();
      setTimeout(() => window.close(), 500);
    }, 300);
  </script>
</body>
</html>`;

  const printWindow = window.open('', '_blank', 'width=400,height=600');
  if (!printWindow) {
    showToast('فشل فتح نافذة الطباعة', 'error');
    return;
  }
  
  printWindow.document.write(invoiceHTML);
  printWindow.document.close();
  
  showToast('جاري طباعة الفاتورة...', 'info');
};

window.printDeliveryReceipt = function(saleId) {
  const sale = allSales.find(s => String(s.id) === String(saleId));
  if (!sale) {
    showToast('لم يتم العثور على العملية', 'error');
    return;
  }
  
  const settings = JSON.parse(localStorage.getItem('appSettings') || '{}');
  const companyName = settings.companyName || 'ELOS System';
  const companyLogo = settings.companyLogo || '';
  
  const ticketNo = sale.ticket_no || sale.ticket_id || '-';
  const deliveryDate = sale.delivered_at || sale.updated_at || sale.created_at;
  const dateStr = formatDate(deliveryDate);
  
  const receiptHTML = `
<!DOCTYPE html>
<html dir="rtl" lang="ar">
<head>
  <meta charset="UTF-8">
  <title>إيصال استلام / تسليم</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: 'Cairo', Arial, sans-serif;
      width: 76mm;
      padding: 8px;
      background: #fff;
      color: #000;
      direction: rtl;
    }
    .header {
      text-align: center;
      padding-bottom: 10px;
      border-bottom: 2px dashed #000;
      margin-bottom: 10px;
    }
    .logo { max-width: 50px; max-height: 50px; margin-bottom: 5px; }
    .company-name { font-size: 16px; font-weight: 900; }
    .receipt-title {
      text-align: center;
      background: #000;
      color: #fff;
      padding: 6px;
      font-weight: 900;
      font-size: 14px;
      margin: 10px 0;
    }
    .info-section {
      background: #f5f5f5;
      padding: 10px;
      margin-bottom: 10px;
      border: 1px solid #000;
    }
    .info-row {
      display: flex;
      justify-content: space-between;
      font-size: 11px;
      padding: 4px 0;
    }
    .device-info {
      padding: 10px;
      border: 1px solid #000;
      margin-bottom: 10px;
    }
    .device-name {
      font-weight: 700;
      font-size: 13px;
      margin-bottom: 8px;
      text-align: center;
    }
    .disclaimer {
      background: #fff3cd;
      border: 1px solid #ffc107;
      padding: 10px;
      margin-top: 15px;
      font-size: 9px;
      text-align: center;
      line-height: 1.4;
    }
    .footer {
      text-align: center;
      padding-top: 10px;
      border-top: 2px dashed #000;
      margin-top: 10px;
      font-size: 10px;
    }
    @media print {
      body { width: 100%; }
      @page { margin: 0; }
    }
  </style>
</head>
<body>
  <div class="header">
    ${companyLogo ? `<img src="${companyLogo}" class="logo" />` : ''}
    <div class="company-name">${companyName}</div>
  </div>

  <div class="receipt-title">إيصال استلام / تسليم جهاز</div>

  <div class="info-section">
    <div class="info-row">
      <span>رقم التذكرة:</span>
      <span><strong>#${ticketNo}</strong></span>
    </div>
    <div class="info-row">
      <span>التاريخ:</span>
      <span>${dateStr}</span>
    </div>
    <div class="info-row">
      <span>العميل:</span>
      <span>${escapeHtml(sale.customer_name || '-')}</span>
    </div>
    ${sale.customer_phone ? `
      <div class="info-row">
        <span>الهاتف:</span>
        <span>${escapeHtml(sale.customer_phone)}</span>
      </div>
    ` : ''}
  </div>

  <div class="device-info">
    <div class="device-name">${escapeHtml(sale.part_name || 'قطعة صيانة')}</div>
    <div style="font-size: 11px; text-align: center; color: #333;">
      ${sale.part_category ? `الفئة: ${escapeHtml(sale.part_category)}` : ''}
    </div>
  </div>

  <div class="disclaimer">
    <strong>تنبيه:</strong><br>
    يرجى التأكد من استلام / تسليم الجهاز بشكل صحيح.<br>
    هذا الإيصال يؤكد عملية الاستلام أو التسليم فقط.
  </div>

  <div class="footer">
    <div>✨ ${settings.printerFooterMessage || 'شكراً لتعاملكم معنا'} ✨</div>
    <div style="margin-top:8px;font-size:8px;color:#999">ELOS System</div>
  </div>

  <script>
    setTimeout(() => {
      window.print();
      setTimeout(() => window.close(), 500);
    }, 300);
  </script>
</body>
</html>`;

  const printWindow = window.open('', '_blank', 'width=400,height=600');
  if (!printWindow) {
    showToast('فشل فتح نافذة الطباعة', 'error');
    return;
  }
  
  printWindow.document.write(receiptHTML);
  printWindow.document.close();
  
  showToast('جاري طباعة الإيصال...', 'info');
};

window.printDeviceBarcode = function(saleId) {
  const sale = allSales.find(s => String(s.id) === String(saleId));
  if (!sale) {
    showToast('لم يتم العثور على العملية', 'error');
    return;
  }
  
  // Use ticket number or sale ID for barcode
  const barcodeValue = String(sale.ticket_no || sale.ticket_id || `REP${sale.id}`);
  
  // Wait a bit for barcode generator to load if needed
  setTimeout(() => {
    // Use barcode generator if available
    if (typeof window.BarcodeGenerator !== 'undefined' && window.BarcodeGenerator.generateCode128SVG) {
      const settings = JSON.parse(localStorage.getItem('appSettings') || '{}');
      const companyName = settings.companyName || 'ELOS';
      
      const barcodeSVG = window.BarcodeGenerator.generateCode128SVG(barcodeValue, 130, 35);
      
      const labelHTML = `
<!DOCTYPE html>
<html dir="rtl" lang="ar">
<head>
  <meta charset="UTF-8">
  <title>باركود جهاز صيانة</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: Arial, sans-serif;
      background: white;
      padding: 20px;
      display: flex;
      justify-content: center;
      align-items: center;
      min-height: 100vh;
    }
    .label {
      width: 144px;
      height: 94px;
      background: white;
      padding: 2px;
      border: 1px solid #ccc;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: space-between;
    }
    .shop-name {
      width: 95%;
      text-align: right;
      font-size: 8px;
      font-weight: bold;
      border-bottom: 1px solid #000;
      padding-bottom: 1px;
      margin-bottom: 2px;
    }
    .barcode-container {
      flex-grow: 1;
      display: flex;
      justify-content: center;
      align-items: center;
      width: 100%;
    }
    .product-name {
      width: 95%;
      text-align: center;
      font-size: 7px;
      font-weight: bold;
      direction: rtl;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
      margin-top: 2px;
    }
    .ticket-number {
      width: 95%;
      text-align: center;
      font-size: 8px;
      font-weight: bold;
      margin-top: 2px;
      font-family: monospace;
    }
    @media print {
      body { padding: 0; }
      .label { border: none; }
      @page { size: 38mm 25mm; margin: 0; }
    }
  </style>
</head>
<body>
  <div class="label">
    <div class="shop-name">${companyName}</div>
    <div class="barcode-container">
      ${barcodeSVG}
    </div>
    <div class="product-name">${escapeHtml(sale.part_name || 'قطعة صيانة')}</div>
    <div class="ticket-number">#${barcodeValue}</div>
  </div>
  <script>
    setTimeout(() => {
      window.print();
      setTimeout(() => window.close(), 500);
    }, 300);
  </script>
</body>
</html>`;

      const printWindow = window.open('', '_blank', 'width=300,height=200');
      if (!printWindow) {
        showToast('فشل فتح نافذة الطباعة', 'error');
        return;
      }
      
      printWindow.document.write(labelHTML);
      printWindow.document.close();
      showToast('جاري طباعة الباركود...', 'info');
    } else {
      // Fallback: simple text barcode
      showToast('مولد الباركود غير متاح. يرجى التأكد من تحميل barcode-generator.js', 'warning');
    }
  }, 100);
};

window.openRepairTicket = function(ticketNo) {
  // Try to navigate to repairs page with ticket filter
  if (typeof window.navigateToRepair !== 'undefined') {
    window.navigateToRepair(ticketNo);
  } else {
    // Fallback: open repairs page
    window.location.href = `repairs.html?ticket=${ticketNo}`;
  }
};

// ═════════════════════════════════════
// 🚀 BOOT FUNCTION
// ═════════════════════════════════════
window.boot = async function(useCache = true) {
  console.log('[REPAIR-PARTS-SALES] 🚀 boot() called, useCache:', useCache);
  try {
    showLoading();

    const fromInput = document.getElementById('from');
    const toInput = document.getElementById('to');

    const fromISO = fromInput?.value || null;
    const toISO = toInput?.value || null;
    console.log('[REPAIR-PARTS-SALES] Date range:', fromISO, 'to', toISO);

    // Check cache
    const cacheKey = `${fromISO}-${toISO}`;
    if (useCache && SalesCache.isValid() && SalesCache.cacheKey === cacheKey) {
      allSales = SalesCache.get();
      console.log('[REPAIR-PARTS-SALES] 📦 From cache:', allSales.length, 'sales');
      renderTable();
      hideLoading();
      showToast('تم تحميل البيانات من الذاكرة المؤقتة', 'success', 2000);
      return;
    }

    // 🔧 Load from API - مبيعات قطع الصيانة
    console.log('[REPAIR-PARTS-SALES] 🌐 Fetching from API...');
    allSales = await loadRepairPartsSales({
      fromISO,
      toISO
    });
    console.log('[REPAIR-PARTS-SALES] ✅ API returned:', allSales.length, 'sales', allSales);

    SalesCache.set(allSales, cacheKey);

    currentPage = 1;
    renderTable();

    hideLoading();
    showToast(`تم تحميل ${allSales.length} عملية بيع قطع غيار`, 'success', 2000);

  } catch (err) {
    console.error('[REPAIR-PARTS-SALES] ❌ Boot error:', err);
    // Use shared error handler if available
    if (window.SalesErrorHandler) {
      window.SalesErrorHandler.showError(err, {
        NETWORK_ERROR: 'فشل الاتصال بالخادم. يرجى التحقق من الاتصال.',
        SERVER_ERROR: 'حدث خطأ في الخادم. يرجى المحاولة مرة أخرى.'
      }, {
        duration: window.SalesConstants?.NOTIFICATIONS.ERROR_DURATION || 5000
      });
    } else {
      Logger.error('Boot error:', err);
      showToast('فشل تحميل البيانات: ' + err.message, 'error');
    }
    hideLoading();
  }
};

// ═════════════════════════════════════
// 📅 QUICK FILTERS
// ═════════════════════════════════════
function applyQuickFilter(period) {
  const fromInput = document.getElementById('from');
  const toInput = document.getElementById('to');
  const today = new Date();
  
  // Update active button
  document.querySelectorAll('.quick-filter-btn').forEach(btn => {
    btn.classList.remove('active');
  });
  event.target.classList.add('active');
  
  switch (period) {
    case 'all':
      fromInput.value = '';
      toInput.value = '';
      break;
      
    case 'today':
      fromInput.value = todayISO();
      toInput.value = todayISO();
      break;
      
    case 'week':
      const weekAgo = new Date(today);
      weekAgo.setDate(today.getDate() - 7);
      fromInput.value = weekAgo.toISOString().slice(0, 10);
      toInput.value = todayISO();
      break;
      
    case 'month':
      const monthAgo = new Date(today);
      monthAgo.setMonth(today.getMonth() - 1);
      fromInput.value = monthAgo.toISOString().slice(0, 10);
      toInput.value = todayISO();
      break;
      
    case 'year':
      const yearAgo = new Date(today);
      yearAgo.setFullYear(today.getFullYear() - 1);
      fromInput.value = yearAgo.toISOString().slice(0, 10);
      toInput.value = todayISO();
      break;
  }
  
  boot(false);
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
  
  if (!paginationControls) return;
  
  if (total === 0 || viewingAll || total <= rowsPerPage) {
    paginationControls.style.display = 'none';
    return;
  }
  
  pageInfo.textContent = `صفحة ${currentPage} من ${totalPages} (${total} عملية)`;
  
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
  
  if (!tableWrap || !paginationControls) return;
  
  if (tableWrap._scrollHandler) {
    tableWrap.removeEventListener('scroll', tableWrap._scrollHandler);
  }
  
  let scrollTimeout;
  
  function checkScroll() {
    const { scrollTop, scrollHeight, clientHeight } = tableWrap;
    const scrollableHeight = scrollHeight - clientHeight;
    
    if (scrollableHeight <= 10) {
      paginationControls.style.display = 'none';
      return;
    }
    
    const scrollPercentage = (scrollTop / scrollableHeight) * 100;
    const nearBottom = (scrollableHeight - scrollTop) < 100;
    
    if (scrollPercentage > 40 || nearBottom) {
      paginationControls.style.display = 'flex';
    } else {
      paginationControls.style.display = 'none';
    }
  }
  
  const throttledCheckScroll = throttle(checkScroll, 50);
  
  tableWrap._scrollHandler = () => {
    clearTimeout(scrollTimeout);
    throttledCheckScroll();
    
    scrollTimeout = setTimeout(() => {
      const { scrollTop, scrollHeight, clientHeight } = tableWrap;
      const nearBottom = ((scrollHeight - clientHeight) - scrollTop) < 100;
      
      if (!nearBottom) {
        paginationControls.style.display = 'none';
      }
    }, 3000);
  };
  
  tableWrap.addEventListener('scroll', tableWrap._scrollHandler, { passive: true });
  
  setTimeout(checkScroll, 100);
}

// ═════════════════════════════════════
// 🎬 INITIALIZATION
// ═════════════════════════════════════
document.addEventListener('DOMContentLoaded', async () => {
  console.log('[REPAIR-PARTS-SALES] 🎬 DOMContentLoaded fired!');
  try {
  // Set default dates
  const today = todayISO();
  const monthAgo = new Date();
  monthAgo.setMonth(monthAgo.getMonth() - 1);
  
  document.getElementById('from').value = monthAgo.toISOString().slice(0, 10);
  document.getElementById('to').value = today;
  
  // Setup event listeners
  document.querySelectorAll('.quick-filter-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const period = btn.getAttribute('data-period');
      applyQuickFilter(period);
    });
  });
  
  // Quick search with debounce
  document.getElementById('q').addEventListener('input', debouncedRenderTable);
  
  // Remove type filter (not needed for repair parts sales)
  
  // Table search bar - sync with sidebar search
  const tableSearch = document.getElementById('tableSearch');
  const clearSearchBtn = document.getElementById('clearSearch');
  const sidebarSearch = document.getElementById('q');
  
  if (tableSearch) {
    tableSearch.addEventListener('input', (e) => {
      sidebarSearch.value = e.target.value;
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
  
  // Modal close
  document.getElementById('btnClose').addEventListener('click', () => {
    document.getElementById('saleModal').classList.remove('show');
  });
  
  // Close modal on outside click
  window.addEventListener('click', (e) => {
    const saleModal = document.getElementById('saleModal');
    if (e.target === saleModal) {
      saleModal.classList.remove('show');
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
    }
  });
  
  // Initial load
  await boot(true);
  } catch (initError) {
    console.error('[REPAIR-PARTS-SALES] ❌ INIT ERROR:', initError);
    // Show error visually too
    const tbody = document.getElementById('tbody');
    if (tbody) {
      tbody.innerHTML = `<tr><td colspan="11" style="color:red;text-align:center;padding:20px;">❌ خطأ في تحميل الصفحة: ${initError.message}</td></tr>`;
    }
  }
});

