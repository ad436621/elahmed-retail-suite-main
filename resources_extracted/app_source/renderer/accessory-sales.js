// ═══════════════════════════════════════════════════════════════
// 🎧 ELOS ACCESSORY SALES SYSTEM - v1.2 (Using Shared Utils)
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
const SalesCache = window.SalesShared?.createCache('accessorySalesCache') || {
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
async function loadAccessoryMovements({ fromISO, toISO, type }) {
  const p = new URLSearchParams();
  if (fromISO) p.set('from', fromISO);
  if (toISO) p.set('to', toISO);
  if (type && type !== 'all') p.set('type', type);
  
  const res = await fetch('elos-db://accessory-movements?' + p.toString());
  if (!res.ok) throw new Error(await res.text());
  
  return await res.json();
}

// ═════════════════════════════════════
// 📊 STATE MANAGEMENT (Using Shared)
// ═════════════════════════════════════
let allMovements = [];
let filteredMovements = [];

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

function getTypeLabel(type) {
  const labels = {
    sale: 'بيع',
    return: 'مرتجع',
    purchase: 'شراء',
    adjustment_increase: 'تسوية (زيادة)',
    adjustment_decrease: 'تسوية (نقص)',
    transfer_in: 'تحويل وارد',
    transfer_out: 'تحويل صادر'
  };
  return labels[type] || type || 'غير محدد';
}

function getTypeBadgeClass(type) {
  if (type === 'sale') return 'status-sale';
  if (type === 'return') return 'status-return';
  if (type && type.startsWith('adjustment')) return 'status-adjustment';
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
  const typeFilter = document.getElementById('typeFilter')?.value || 'all';
  
  // Filter movements
  filteredMovements = allMovements.filter(m => {
    // Warehouse filter أولاً
    const warehouseId = localStorage.getItem('currentAccessorySalesWarehouseId');
    if (warehouseId) {
      Logger.log('[ACC-SALES] Filtering by warehouse ID:', warehouseId);
      // فلترة بالـ warehouse_id من الإكسسوار
      if (m.accessory_warehouse_id && m.accessory_warehouse_id != warehouseId) {
        return false;
      }
    }
    
    // Type filter
    if (typeFilter !== 'all') {
      if (typeFilter === 'sale' && m.type !== 'sale') return false;
      if (typeFilter === 'return' && m.type !== 'return') return false;
      if (typeFilter === 'adjustment' && !m.type?.startsWith('adjustment')) return false;
    }
    
    // Search filter
    if (searchTerm) {
      const searchableText = [
        m.accessory_name,
        m.category,
        m.client_name,
        m.supplier_name,
        m.notes,
        getTypeLabel(m.type)
      ].filter(Boolean).join(' ').toLowerCase();
      
      if (!searchableText.includes(searchTerm)) return false;
    }
    
    return true;
  });
  
  // Pagination (using shared utilities if available)
  let displayMovements = filteredMovements;
  
  if (window.SalesShared && paginationState) {
    // Sync state
    paginationState.currentPage = currentPage;
    paginationState.viewingAll = viewingAll;
    paginationState.rowsPerPage = rowsPerPage;
    
    displayMovements = paginationState.getPaginatedData(filteredMovements);
    
    // Update pagination UI
    window.SalesShared.updatePaginationUI(
      paginationState,
      filteredMovements.length,
      {
        onScroll: () => initPaginationScrollDetection()
      }
    );
  } else {
    // Fallback
    const totalPages = Math.ceil(filteredMovements.length / rowsPerPage);
    if (!viewingAll && filteredMovements.length > rowsPerPage) {
      const start = (currentPage - 1) * rowsPerPage;
      const end = start + rowsPerPage;
      displayMovements = filteredMovements.slice(start, end);
    }
    
    // Update pagination UI
    updatePaginationUI(filteredMovements.length);
  }
  
  // Render rows
  if (displayMovements.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="11" class="empty-state">
          <div class="empty-state-icon">🎧</div>
          <div class="empty-state-text">
            ${searchTerm || typeFilter !== 'all' ? 'لا توجد نتائEGPطابقة' : 'لا توجد مبيعات لعرضها'}
          </div>
        </td>
      </tr>
    `;
    return;
  }
  
  tbody.innerHTML = displayMovements.map((m, idx) => {
    const globalIdx = viewingAll ? idx : ((currentPage - 1) * rowsPerPage + idx);
    return `
      <tr onclick="showSaleDetails(${m.id})">
        <td>${globalIdx + 1}</td>
        <td>${formatDate(m.created_at)}</td>
        <td><strong>${m.accessory_name || '-'}</strong></td>
        <td>${m.category || '-'}</td>
        <td>
          <span class="status-badge ${getTypeBadgeClass(m.type)}">
            ${getTypeLabel(m.type)}
          </span>
        </td>
        <td>${m.type === 'sale' ? Math.abs(m.quantity || 0) : (m.quantity || 0)}</td>
        <td>${fmt(m.unit_price || 0)}</td>
        <td><strong>${fmt(m.total_price || 0)}</strong></td>
        <td>${m.client_name || m.supplier_name || '-'}</td>
        <td>${m.notes || '-'}</td>
        <td>
          ${m.type === 'sale' && m.invoice_number ? `
          <button class="action-btn" onclick="event.stopPropagation(); printAccessoryInvoice('${escapeHtml(m.invoice_number)}')" title="طباعة الفاتورة">
            🖨️ طباعة
          </button>
          ` : ''}
          <button class="action-btn" onclick="event.stopPropagation(); showSaleDetails(${m.id})">
            👁️ عرض
          </button>
        </td>
      </tr>
    `;
  }).join('');
  
  // Update stats
  updateStats();
}

function updateStats() {
  // فلترة المبيعات فقط
  const salesOnly = filteredMovements.filter(m => m.type === 'sale');
  
  const stats = {
    totalSales: 0,
    netProfit: 0,
    count: salesOnly.length
  };
  
  salesOnly.forEach(m => {
    stats.totalSales += Math.abs(m.total_price || 0);
    // ✅ FIX: Profit = total_price (after discount) - (purchase_price * quantity)
    const totalAfterDiscount = Math.abs(m.total_price || 0);
    const totalCost = (m.purchase_price || 0) * Math.abs(m.quantity || 0);
    const profit = totalAfterDiscount - totalCost;
    stats.netProfit += profit;
  });
  
  // تحديث بالـ IDs
  const totalEl = document.getElementById('statTotalSales');
  const profitEl = document.getElementById('statTotalProfit');
  const countEl = document.getElementById('statSalesCount');
  
  if (totalEl) totalEl.textContent = fmt(stats.totalSales);
  if (profitEl) profitEl.textContent = fmt(stats.netProfit);
  if (countEl) countEl.textContent = stats.count;
  
  // fallback للطريقة القديمة
  const headerStats = document.getElementById('headerStats');
  if (headerStats && !totalEl) {
    const statValues = headerStats.querySelectorAll('.stat-value');
    if (statValues[0]) statValues[0].textContent = fmt(stats.totalSales);
    if (statValues[1]) statValues[1].textContent = fmt(stats.netProfit);
    if (statValues[2]) statValues[2].textContent = stats.count;
  }
}

// ═════════════════════════════════════
// 🖨️ طباعة فاتورة (نفس شكل الطباعة عند البيع)
// ═════════════════════════════════════
window.printAccessoryInvoice = async function(invoiceNumber) {
  if (!invoiceNumber || !invoiceNumber.trim()) {
    showToast('لا يوجد رقم فاتورة لهذه العملية', 'warning');
    return;
  }
  try {
    showToast('جاري تحميل الفاتورة...', 'info');
    const res = await fetch(`elos-db://invoice/${encodeURIComponent(invoiceNumber.trim())}`);
    if (!res.ok) throw new Error(await res.text());
    const invoice = await res.json();

    const settings = JSON.parse(localStorage.getItem('appSettings') || '{}');
    const invoiceDate = invoice.created_at ? new Date(invoice.created_at) : new Date();
    const dateStr = invoiceDate.toLocaleDateString('ar-EG');
    const timeStr = invoiceDate.toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' });
    const paymentMethodMap = { cash: 'كاش سائل', mobile_wallet: 'محفظة إلكترونية', bank: 'حساب بنكي', split: 'تقسيم', transfer: 'تحويل' };
    const paymentMethod = paymentMethodMap[invoice.payment_method] || invoice.payment_method || 'نقدي';
    const subtotal = Number(invoice.total_amount) || 0;
    const discount = Number(invoice.total_discount) || 0;
    const total = Number(invoice.total_paid) || (subtotal - discount);
    const customerName = invoice.customer_name || 'عميل نقدي';

    let itemsHtml = '';
    (invoice.items || []).forEach(function(item) {
      const itemTotal = (Number(item.price) || 0) * (Number(item.quantity) || 1);
      const name = item.item_type === 'device' ? ((item.type || '') + ' ' + (item.model || 'جهاز')).trim() || 'جهاز'
        : (item.item_type === 'repair_part' ? (item.item_name || 'قطعة غيار') : (item.item_name || 'إكسسوار'));
      const qty = (Number(item.quantity) || 1) > 1 ? ' \u00D7' + item.quantity : '';
      itemsHtml += '<div style="display:flex;justify-content:space-between;padding:6px 0;font-size:12px;font-weight:600;color:#000;border-bottom:1px solid #eee;">' +
        '<span>' + (name + qty) + '</span>' +
        '<span>' + fmt(itemTotal) + '</span>' +
        '</div>';
    });

    const printContent = '<!DOCTYPE html><html dir="rtl" lang="ar"><head><meta charset="UTF-8"><title>فاتورة ' + escapeHtml(invoiceNumber) + '</title>' +
      '<style>body{font-family:Arial,Tahoma,sans-serif;max-width:320px;margin:0 auto;padding:16px;background:#fff;color:#000;} ' +
      '.head{text-align:center;padding-bottom:12px;border-bottom:2px solid #000;} .head img{max-width:50px;max-height:50px;} ' +
      '.info{display:flex;justify-content:space-between;padding:10px 0;font-size:12px;font-weight:700;border-bottom:1px solid #000;} ' +
      '.total-block{background:#000;color:#fff;margin:12px 0;padding:14px;text-align:center;} .total-block .amt{font-size:22px;font-weight:700;} ' +
      '.pay{display:flex;justify-content:space-between;font-size:12px;font-weight:600;padding:8px 0;} ' +
      '.foot{text-align:center;padding-top:12px;margin-top:8px;border-top:2px solid #000;font-size:11px;font-weight:600;}</style></head><body>' +
      (settings.companyLogo ? '<div class="head"><img src="' + settings.companyLogo + '" alt="" /></div>' : '') +
      '<div class="head" style="' + (settings.companyLogo ? '' : '') + '"><div style="font-size:18px;font-weight:700;">' + (settings.companyName || 'ELOS') + '</div></div>' +
      '<div class="info"><div><div style="font-size:13px;">#' + escapeHtml(invoiceNumber) + '</div><div>' + dateStr + ' - ' + timeStr + '</div></div>' +
      (customerName ? '<div style="font-weight:700;">' + escapeHtml(customerName) + '</div>' : '') + '</div>' +
      '<div style="padding:8px 0;">' + itemsHtml + '</div>' +
      (discount > 0 ? '<div style="border-top:1px solid #000;padding-top:8px;font-size:12px;font-weight:600;"><div style="display:flex;justify-content:space-between;"><span>المجموع</span><span>' + fmt(subtotal) + '</span></div><div style="display:flex;justify-content:space-between;"><span>خصم</span><span>- ' + fmt(discount) + '</span></div></div>' : '') +
      '<div class="total-block"><div style="font-size:11px;">الإجمالي</div><div class="amt">EGP ' + fmt(total) + '</div></div>' +
      '<div class="pay"><span>طريقة الدفع:</span><span>' + escapeHtml(paymentMethod) + '</span></div>' +
      '<div class="foot">' + (settings.printerFooterMessage || 'شكراً لتعاملكم معنا') + '<br><span style="font-family:monospace;">' + escapeHtml(invoiceNumber) + '</span></div>' +
      '</body></html>';

    const w = window.open('', '_blank', 'width=400,height=600');
    if (!w) {
      showToast('الرجاء السماح بالنوافذ المنبثقة للطباعة', 'warning');
      return;
    }
    w.document.write(printContent);
    w.document.close();
    w.focus();
    setTimeout(function() {
      w.print();
      w.onafterprint = w.close;
    }, 350);
    showToast('تم فتح نافذة الطباعة', 'success');
  } catch (e) {
    Logger.error('Print accessory invoice error:', e);
    showToast('خطأ في طباعة الفاتورة: ' + (e.message || 'فاتورة غير موجودة'), 'error');
  }
};

// ═════════════════════════════════════
// 📄 SALE DETAILS MODAL
// ═════════════════════════════════════
window.showSaleDetails = function(movementId) {
  const movement = allMovements.find(m => m.id === movementId);
  if (!movement) {
    showToast('لم يتم العثور على العملية', 'error');
    return;
  }
  
  const modal = document.getElementById('saleModal');
  const detailsDiv = document.getElementById('saleDetails');
  
  detailsDiv.innerHTML = `
    <div class="detail-row">
      <span class="detail-label">رقم العملية</span>
      <span class="detail-value">#${movement.id}</span>
    </div>
    <div class="detail-row">
      <span class="detail-label">التاريخ</span>
      <span class="detail-value">${formatDate(movement.created_at)}</span>
    </div>
    <div class="detail-row">
      <span class="detail-label">نوع العملية</span>
      <span class="detail-value">
        <span class="status-badge ${getTypeBadgeClass(movement.type)}">
          ${getTypeLabel(movement.type)}
        </span>
      </span>
    </div>
    <div class="detail-row">
      <span class="detail-label">المنتج</span>
      <span class="detail-value"><strong>${movement.accessory_name || '-'}</strong></span>
    </div>
    <div class="detail-row">
      <span class="detail-label">الفئة</span>
      <span class="detail-value">${movement.category || '-'}</span>
    </div>
    <div class="detail-row">
      <span class="detail-label">الباركود</span>
      <span class="detail-value">${movement.barcode || '-'}</span>
    </div>
    <div class="detail-row">
      <span class="detail-label">الكمية</span>
      <span class="detail-value"><strong>${movement.type === 'sale' ? Math.abs(movement.quantity || 0) : (movement.quantity || 0)}</strong></span>
    </div>
    <div class="detail-row">
      <span class="detail-label">سعر الوحدة</span>
      <span class="detail-value">${fmt(movement.unit_price || 0)}</span>
    </div>
    ${(movement.discount || 0) > 0 ? `
    <div class="detail-row">
      <span class="detail-label">السعر قبل الخصم</span>
      <span class="detail-value"><s style="color:var(--text-muted)">${fmt((movement.unit_price || 0) * Math.abs(movement.quantity || 1))}</s></span>
    </div>
    <div class="detail-row">
      <span class="detail-label">الخصم</span>
      <span class="detail-value" style="color:var(--danger)">- ${fmt(movement.discount)}</span>
    </div>
    ` : ''}
    <div class="detail-row">
      <span class="detail-label">الإجمالي${(movement.discount || 0) > 0 ? ' بعد الخصم' : ''}</span>
      <span class="detail-value"><strong>${fmt(movement.total_price || 0)}</strong></span>
    </div>
    ${movement.payment_method ? `
    <div class="detail-row">
      <span class="detail-label">طريقة الدفع</span>
      <span class="detail-value">${movement.payment_method === 'cash' ? '💵 كاش' : movement.payment_method === 'deferred' ? '📋 آجل' : movement.payment_method === 'mobile_wallet' ? '📱 محفظة' : movement.payment_method === 'bank' ? '🏦 بنكي' : movement.payment_method === 'split' ? '➗ تقسيم' : movement.payment_method}</span>
    </div>
    ` : ''}
    ${movement.payment_method === 'deferred' && movement.paid_amount != null ? `
    <div class="detail-row">
      <span class="detail-label">المدفوع</span>
      <span class="detail-value" style="color:var(--success)">${fmt(movement.paid_amount || 0)}</span>
    </div>
    <div class="detail-row">
      <span class="detail-label">المتبقي</span>
      <span class="detail-value" style="color:var(--danger)">${fmt(Math.abs(movement.total_price || 0) - (movement.paid_amount || 0))}</span>
    </div>
    ` : ''}
    ${movement.client_name ? `
      <div class="detail-row">
        <span class="detail-label">العميل</span>
        <span class="detail-value">${movement.client_name}</span>
      </div>
    ` : ''}
    ${movement.supplier_name ? `
      <div class="detail-row">
        <span class="detail-label">المورد</span>
        <span class="detail-value">${movement.supplier_name}</span>
      </div>
    ` : ''}
    <div class="detail-row">
      <span class="detail-label">الكمية قبل</span>
      <span class="detail-value">${movement.quantity_before || 0}</span>
    </div>
    <div class="detail-row">
      <span class="detail-label">الكمية بعد</span>
      <span class="detail-value">${movement.quantity_after || 0}</span>
    </div>
    ${movement.notes ? `
      <div class="detail-row">
        <span class="detail-label">ملاحظات</span>
        <span class="detail-value">${movement.notes}</span>
      </div>
    ` : ''}
    ${movement.reason ? `
      <div class="detail-row">
        <span class="detail-label">السبب</span>
        <span class="detail-value">${movement.reason}</span>
      </div>
    ` : ''}
  `;

  var btnPrint = document.getElementById('btnPrintSaleInvoice');
  if (btnPrint) {
    if (movement.type === 'sale' && movement.invoice_number) {
      btnPrint.style.display = 'inline-flex';
      btnPrint.onclick = function(ev) { ev.preventDefault(); printAccessoryInvoice(movement.invoice_number); };
    } else {
      btnPrint.style.display = 'none';
      btnPrint.onclick = null;
    }
  }

  modal.classList.add('show');
};

// ═════════════════════════════════════
// 🚀 BOOT FUNCTION
// ═════════════════════════════════════
window.boot = async function(useCache = true) {
  try {
    showLoading();
    
    const fromInput = document.getElementById('from');
    const toInput = document.getElementById('to');
    const typeFilter = document.getElementById('typeFilter')?.value || 'all'; // 🔧 افتراضي: الكل (مبيعات + مرتجعات)

    const fromISO = fromInput?.value || null;
    const toISO = toInput?.value || null;

    // Check cache
    const cacheKey = `${fromISO}-${toISO}-${typeFilter}`;
    if (useCache && SalesCache.isValid() && SalesCache.cacheKey === cacheKey) {
      allMovements = SalesCache.get();
      renderTable();
      hideLoading();
      showToast('تم تحميل البيانات من الذاكرة المؤقتة', 'success', 2000);
      return;
    }

    // 🔧 Load from API - المبيعات والمرتجعات
    allMovements = await loadAccessoryMovements({
      fromISO,
      toISO,
      type: typeFilter === 'all' ? 'sales_and_returns' : typeFilter // جلب المبيعات والمرتجعات معاً
    });

    // فلترة حسب نوع العملية إذا تم اختيار نوع محدد
    if (typeFilter === 'sale') {
      allMovements = allMovements.filter(m => m.type === 'sale');
    } else if (typeFilter === 'return') {
      allMovements = allMovements.filter(m => m.type === 'return');
    }
    // لو all أو sales_and_returns نعرض المبيعات والمرتجعات فقط (بدون adjustments)
    else if (typeFilter === 'all') {
      allMovements = allMovements.filter(m => m.type === 'sale' || m.type === 'return');
    }

    SalesCache.set(allMovements, cacheKey);

    currentPage = 1;
    renderTable();

    hideLoading();
    const salesCount = allMovements.filter(m => m.type === 'sale').length;
    const returnsCount = allMovements.filter(m => m.type === 'return').length;
    showToast(`تم تحميل ${salesCount} بيع و ${returnsCount} مرتجع`, 'success', 2000);
    
  } catch (err) {
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
  const totalPages = Math.ceil(filteredMovements.length / rowsPerPage);
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
  const totalPages = Math.ceil(filteredMovements.length / rowsPerPage);
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
  const totalPages = Math.ceil(filteredMovements.length / rowsPerPage);
  
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
    showToast(`يتم عرض ${filteredMovements.length} عملية`, 'info', 2000);
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
document.addEventListener('DOMContentLoaded', () => {
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
  
  // Type filter
  document.getElementById('typeFilter').addEventListener('change', renderTable);
  
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
  boot(true);
});
