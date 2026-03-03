// ═══════════════════════════════════════════════════════════════
// 🛒 ELOS PURCHASES SYSTEM - ENHANCED v1.2 (Using Shared Utils)
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

// ═══════════════════════════════════════════════════════════════
// 🔒 DOUBLE-SUBMIT PROTECTION - منع تكرار التوريد
// ═══════════════════════════════════════════════════════════════
let isQuickPurchaseSubmitting = false;
let isBulkPurchaseSubmitting = false;

// ═══════════════════════════════════════════════════════════════
// 🔔 CUSTOM CONFIRM MODAL - بديل للـ confirm العادي
// ═══════════════════════════════════════════════════════════════
function showPaymentWarning(message, inputId) {
  return new Promise((resolve) => {
    // حذف أي popup قديم وإنشاء جديد
    let oldPopup = document.getElementById('paymentWarningPopup');
    if (oldPopup) oldPopup.remove();

    // إنشاء الـ overlay
    const overlay = document.createElement('div');
    overlay.id = 'paymentWarningPopup';
    Object.assign(overlay.style, {
      position: 'fixed',
      top: '0',
      left: '0',
      width: '100vw',
      height: '100vh',
      background: 'rgba(0, 0, 0, 0.7)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: '999999'
    });

    // إنشاء الـ popup box
    const box = document.createElement('div');
    Object.assign(box.style, {
      background: '#1e1e2e',
      borderRadius: '16px',
      boxShadow: '0 25px 80px rgba(0, 0, 0, 0.6)',
      width: '380px',
      maxWidth: '90vw',
      overflow: 'hidden',
      border: '1px solid rgba(255,255,255,0.1)'
    });

    // Header
    const header = document.createElement('div');
    Object.assign(header.style, {
      background: 'linear-gradient(135deg, #f59e0b, #d97706)',
      padding: '16px 20px',
      textAlign: 'center'
    });
    header.innerHTML = '<span style="color: white; font-size: 17px; font-weight: 700;">⚠️ تحذير: المبلغ المدفوع = 0</span>';

    // Body
    const body = document.createElement('div');
    Object.assign(body.style, {
      padding: '24px',
      textAlign: 'center'
    });

    // Message
    const msg = document.createElement('div');
    msg.id = 'paymentWarningMessage';
    Object.assign(msg.style, {
      fontSize: '15px',
      lineHeight: '1.9',
      color: '#e0e0e0',
      marginBottom: '24px',
      whiteSpace: 'pre-line'
    });
    msg.textContent = message;

    // Buttons container
    const btns = document.createElement('div');
    Object.assign(btns.style, {
      display: 'flex',
      gap: '12px',
      justifyContent: 'center'
    });

    // Cancel button (primary - إدخال المبلغ)
    const cancelBtn = document.createElement('button');
    cancelBtn.id = 'paymentWarningCancel';
    cancelBtn.innerHTML = '✏️ إدخال المبلغ';
    Object.assign(cancelBtn.style, {
      padding: '12px 28px',
      borderRadius: '10px',
      fontSize: '14px',
      fontWeight: '600',
      cursor: 'pointer',
      border: 'none',
      background: 'linear-gradient(135deg, #3b82f6, #2563eb)',
      color: 'white'
    });

    // Confirm button (secondary - متابعة)
    const confirmBtn = document.createElement('button');
    confirmBtn.id = 'paymentWarningConfirm';
    confirmBtn.innerHTML = 'متابعة بدون دفع';
    Object.assign(confirmBtn.style, {
      padding: '12px 28px',
      borderRadius: '10px',
      fontSize: '14px',
      fontWeight: '600',
      cursor: 'pointer',
      border: 'none',
      background: '#3d3d54',
      color: '#aaa'
    });

    // تجميع العناصر
    btns.appendChild(cancelBtn);
    btns.appendChild(confirmBtn);
    body.appendChild(msg);
    body.appendChild(btns);
    box.appendChild(header);
    box.appendChild(body);
    overlay.appendChild(box);
    document.body.appendChild(overlay);

    // Event handlers
    const cleanup = () => {
      overlay.remove();
    };

    confirmBtn.onclick = () => {
      cleanup();
      resolve(true); // المستخدم وافق على المتابعة بدون دفع
    };

    cancelBtn.onclick = () => {
      cleanup();
      // Focus على الـ input بعد إغلاق الـ popup
      setTimeout(() => {
        const paymentInput = document.getElementById(inputId);
        if (paymentInput) {
          paymentInput.scrollIntoView({ behavior: 'smooth', block: 'center' });
          paymentInput.focus();
          paymentInput.select();
        }
      }, 100);
      resolve(false); // المستخدم اختار الرجوع
    };
  });
}

let bulkDevices = [];
let deviceCounter = 0;
let allSuppliers = []; // قائمة الموردين

// ═══════════════════════════════════════════════════════════════
// 📄 PAGINATION & FILTER SYSTEM
// ═══════════════════════════════════════════════════════════════
let allPurchases = [];
let allInventory = [];
const ITEMS_PER_PAGE = 25;

let currentPageNum = {
  all: 1,
  quick: 1,
  bulk: 1
};

let filteredData = {
  all: [],
  quick: [],
  bulk: []
};

let filters = {
  dateFrom: '',
  dateTo: '',
  sourceType: '',
  searchTerm: ''
};

// Legacy support
let currentPage = 1;
let itemsPerPage = 50;
let totalPages = 1;

// ═══════════════════════════════════════════════════════════════
// 🌐 GLOBAL FUNCTIONS (للاستخدام من HTML)
// ═══════════════════════════════════════════════════════════════
window.openPurchaseModal = openPurchaseModal;
window.closePurchaseModal = closePurchaseModal;
window.openQuickPurchaseModal = openQuickPurchaseModal;
window.closeQuickPurchaseModal = closeQuickPurchaseModal;
window.openBulkPurchaseModal = openBulkPurchaseModal;
window.closeBulkPurchaseModal = closeBulkPurchaseModal;
window.openBulkPurchaseFastModal = openBulkPurchaseFastModal;
window.closeBulkPurchaseFastModal = closeBulkPurchaseFastModal;
window.switchTab = switchTab;
window.addDeviceRow = addDeviceRow;
window.removeDevice = removeDevice;
window.updateDevice = updateDevice;
window.loadPurchases = loadPurchases;
window.goToPage = goToPage;
window.applyFilters = applyFilters;
window.clearFilters = clearFilters;
window.showPurchaseDetails = showPurchaseDetails;

// ═══════════════════════════════════════════════════════════════
// ⏰ HEADER CLOCK
// ═══════════════════════════════════════════════════════════════
function initHeaderClock() {
  function updateClock() {
    const now = new Date();
    const hours = String(now.getHours()).padStart(2, '0');
    const minutes = String(now.getMinutes()).padStart(2, '0');
    const seconds = String(now.getSeconds()).padStart(2, '0');
    const timeStr = `${hours}:${minutes}:${seconds}`;
    
    const days = ['الأحد', 'الإثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت'];
    const months = ['يناير', 'فبراير', 'مارس', 'أبريل', 'مايو', 'يونيو', 
                    'يوليو', 'أغسطس', 'سبتمبر', 'أكتوبر', 'نوفمبر', 'ديسمبر'];
    
    const dayName = days[now.getDay()];
    const day = now.getDate();
    const month = months[now.getMonth()];
    const year = now.getFullYear();
    const dateStr = `${dayName} ${day} ${month} ${year}`;
    
    const timeEl = document.getElementById('headerTime');
    const dateEl = document.getElementById('headerDate');
    if (timeEl) timeEl.textContent = timeStr;
    if (dateEl) dateEl.textContent = dateStr;
  }
  
  updateClock();
  // ✅ استخدام IntervalManager لمنع تراكم الـ intervals
  if (window.IntervalManager) {
    window.IntervalManager.set('purchases-clock', updateClock, 1000);
  } else {
    if (window._purchasesClockInterval) clearInterval(window._purchasesClockInterval);
    window._purchasesClockInterval = setInterval(updateClock, 1000);
  }
}

// ═══════════════════════════════════════════════════════════════
// 📊 HEADER STATS
// ═══════════════════════════════════════════════════════════════
async function updateHeaderStats() {
  try {
    const allPurchasesData = await fetch('elos-db://purchases').then(r => r.json());
    const totalPurchases = allPurchasesData.length;
    const totalCost = allPurchasesData.reduce((sum, p) => sum + (Number(p.total_cost) || 0), 0);
    
    // حساب عدد الأجهزة المشتراة (كل توريد = جهاز واحد)
    const purchasedDevices = allPurchasesData.filter(p => p.device_id).length;
    
    // حساب تكلفة الشهر الحالي
    const now = new Date();
    const fom = new Date(now.getFullYear(), now.getMonth(), 1);
    const firstDayOfMonth = `${fom.getFullYear()}-${String(fom.getMonth()+1).padStart(2,'0')}-${String(fom.getDate()).padStart(2,'0')}`;
    const monthPurchases = allPurchasesData.filter(p => {
      const pDate = (p.created_at || p.purchase_date || '').split('T')[0];
      return pDate >= firstDayOfMonth;
    });
    const monthCost = monthPurchases.reduce((sum, p) => sum + (Number(p.total_cost) || 0), 0);
    
    const inventory = await fetch('elos-db://inventory').then(r => r.ok ? r.json() : []);
    const devicesInStock = inventory.filter(d => d.status === 'in_stock' || !d.status).length;
    
    // Main stat cards
    const totalPurchasesEl = document.getElementById('totalPurchases');
    const purchasedDevicesEl = document.getElementById('purchasedDevices');
    const totalCostEl = document.getElementById('totalCost');
    const devicesInStockEl = document.getElementById('devicesInStock');
    const monthCostEl = document.getElementById('monthCost');
    
    if (totalPurchasesEl) totalPurchasesEl.textContent = totalPurchases;
    if (purchasedDevicesEl) purchasedDevicesEl.textContent = purchasedDevices;
    if (totalCostEl) totalCostEl.textContent = fmt(totalCost);
    if (devicesInStockEl) devicesInStockEl.textContent = devicesInStock;
    if (monthCostEl) monthCostEl.textContent = fmt(monthCost);
    
    // Header cards
    const headerTotalPurchasesEl = document.getElementById('headerTotalPurchases');
    const headerTotalCostEl = document.getElementById('headerTotalCost');
    const headerDevicesCountEl = document.getElementById('headerDevicesCount');
    
    if (headerTotalPurchasesEl) headerTotalPurchasesEl.textContent = totalPurchases;
    if (headerTotalCostEl) headerTotalCostEl.textContent = fmt(totalCost);
    if (headerDevicesCountEl) headerDevicesCountEl.textContent = devicesInStock;
  } catch (error) {
    Logger.error('Failed to update header stats:', error);
  }
}

// ═══════════════════════════════════════════════════════════════
// 📋 LOAD PURCHASES
// ═══════════════════════════════════════════════════════════════
async function loadPurchases() {
  try {
    const purchases = await fetch('elos-db://purchases').then(r => r.json());
    
    // فلترة بالـ warehouse_id (using unified handler)
    let filteredPurchases = purchases;
    
    if (window.WarehouseHandler) {
      const warehouseId = window.WarehouseHandler.getCurrentWarehouseId('purchases');
      if (warehouseId) {
        Logger.log('[PURCHASES] Filtering by warehouse ID:', warehouseId);
        filteredPurchases = window.WarehouseHandler.filterByWarehouse(
          purchases, 
          warehouseId, 
          'device_warehouse_id'
        );
      }
    } else {
      // Fallback
      const warehouseId = localStorage.getItem('currentPurchasesWarehouseId');
      if (warehouseId) {
        Logger.log('[PURCHASES] Filtering by warehouse ID:', warehouseId);
        filteredPurchases = purchases.filter(p => {
          if (p.device_warehouse_id) {
            return p.device_warehouse_id == warehouseId;
          }
          return true;
        });
      }
    }
    
    // حفظ البيانات الكاملة
    allPurchases = filteredPurchases;
    
    // Initialize filtered data
    filteredData.all = [...allPurchases];
    filteredData.quick = allPurchases.filter(p => p.purchase_type === 'quick' || !p.purchase_type);
    filteredData.bulk = allPurchases.filter(p => p.purchase_type === 'bulk');
    
    // Apply filters and render
    initFilters();
    applyFilters();
    
    await updateHeaderStats();
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
      Logger.error('Load purchases error:', error);
      showToast('فشل تحميل المشتريات: ' + error.message, 'error');
    }
  }
}

// ═══════════════════════════════════════════════════════════════
// 🎨 RENDER CURRENT PAGE
// ═══════════════════════════════════════════════════════════════
function renderCurrentPage() {
  const tbody = document.getElementById('purchasesBody');
  
  if (allPurchases.length === 0) {
    tbody.innerHTML = '<tr><td colspan="9" class="empty-state"><div>لا توجد مشتريات في هذه الفترة</div></td></tr>';
    return;
  }
  
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = Math.min(startIndex + itemsPerPage, allPurchases.length);
  const currentPageData = allPurchases.slice(startIndex, endIndex);
  
  tbody.innerHTML = currentPageData.map((p, i) => {
    const globalIndex = startIndex + i + 1;
    const deviceLabel = escapeHtml(`${p.type || ''} ${p.model || ''}`.trim() || '—');
    const sourceLabel = p.source_type === 'customer' ? 'عميل' : 'مورد';
    const badgeClass = p.source_type === 'customer' ? 'badge-customer' : 'badge-vendor';
    const partyName = escapeHtml(p.party_name || p.supplier_name || '—');
    const paymentLabel = { cash: 'نقدي', card: 'شبكة', transfer: 'تحويل' }[p.payment_method] || '—';
    const dateStr = (p.created_at || '').replace('T', ' ').slice(0, 16);

    return `<tr>
      <td>${globalIndex}</td>
      <td><strong>${p.id}</strong></td>
      <td><strong>${deviceLabel}</strong></td>
      <td><span class="badge ${badgeClass}">${sourceLabel}</span></td>
      <td>${partyName}</td>
      <td class="num"><strong style="color: #f59e0b;">${fmt(p.total_cost)}</strong></td>
      <td class="num">${fmt(p.paid_now)}</td>
      <td>${paymentLabel}</td>
      <td style="color: var(--text-secondary); font-size: 13px;">${dateStr}</td>
    </tr>`;
  }).join('');
}

// ═══════════════════════════════════════════════════════════════
// 📄 PAGINATION CONTROLS
// ═══════════════════════════════════════════════════════════════
function updatePaginationControls() {
  const paginationContainer = document.getElementById('paginationContainer');
  const paginationNumbers = document.getElementById('paginationNumbers');
  
  // إخفاء/إظهار شريط الصفحات
  if (totalPages <= 1) {
    paginationContainer.classList.remove('visible');
    return;
  }
  
  paginationContainer.classList.add('visible');
  
  // تحديث معلومات الصفحة
  document.getElementById('currentPageNum').textContent = currentPage;
  document.getElementById('totalPagesNum').textContent = totalPages;
  
  const startIndex = (currentPage - 1) * itemsPerPage + 1;
  const endIndex = Math.min(currentPage * itemsPerPage, allPurchases.length);
  document.getElementById('showingFrom').textContent = startIndex;
  document.getElementById('showingTo').textContent = endIndex;
  document.getElementById('totalRecords').textContent = allPurchases.length;
  
  // تحديث أزرار التنقل
  document.getElementById('firstPageBtn').disabled = currentPage === 1;
  document.getElementById('prevPageBtn').disabled = currentPage === 1;
  document.getElementById('nextPageBtn').disabled = currentPage === totalPages;
  document.getElementById('lastPageBtn').disabled = currentPage === totalPages;
  
  // إنشاء أزرار أرقام الصفحات
  paginationNumbers.innerHTML = '';
  
  // حساب نطاق الصفحات المعروضة
  let startPage = Math.max(1, currentPage - 2);
  let endPage = Math.min(totalPages, currentPage + 2);
  
  // تعديل النطاق إذا كنا قرب البداية أو النهاية
  if (currentPage <= 3) {
    endPage = Math.min(5, totalPages);
  }
  if (currentPage >= totalPages - 2) {
    startPage = Math.max(1, totalPages - 4);
  }
  
  // إضافة زر الصفحة الأولى إذا لم تكن ضمن النطاق
  if (startPage > 1) {
    const btn = createPageButton(1);
    paginationNumbers.appendChild(btn);
    
    if (startPage > 2) {
      const dots = document.createElement('span');
      dots.style.cssText = 'color: var(--text-secondary); padding: 0 8px; font-size: 18px;';
      dots.textContent = '...';
      paginationNumbers.appendChild(dots);
    }
  }
  
  // إضافة أزرار الصفحات في النطاق
  for (let i = startPage; i <= endPage; i++) {
    const btn = createPageButton(i);
    paginationNumbers.appendChild(btn);
  }
  
  // إضافة زر الصفحة الأخيرة إذا لم تكن ضمن النطاق
  if (endPage < totalPages) {
    if (endPage < totalPages - 1) {
      const dots = document.createElement('span');
      dots.style.cssText = 'color: var(--text-secondary); padding: 0 8px; font-size: 18px;';
      dots.textContent = '...';
      paginationNumbers.appendChild(dots);
    }
    
    const btn = createPageButton(totalPages);
    paginationNumbers.appendChild(btn);
  }
}

function createPageButton(pageNum) {
  const btn = document.createElement('button');
  btn.className = 'pagination-btn' + (pageNum === currentPage ? ' active' : '');
  btn.textContent = pageNum;
  btn.onclick = () => goToPage(pageNum);
  return btn;
}

function goToPage(pageNum) {
  if (pageNum < 1 || pageNum > totalPages || pageNum === currentPage) return;
  
  currentPage = pageNum;
  window.currentPage = currentPage; // تحديث المتغير العام
  
  renderCurrentPage();
  updatePaginationControls();
  
  // التمرير إلى أعلى الجدول
  const tableWrapper = document.querySelector('.table-wrapper');
  if (tableWrapper) {
    tableWrapper.scrollTop = 0;
  }
}

// ═══════════════════════════════════════════════════════════════
// 🔄 SCROLL-BASED PAGINATION VISIBILITY
// ═══════════════════════════════════════════════════════════════
function setupScrollPagination() {
  const tableWrapper = document.querySelector('.table-wrapper');
  const paginationContainer = document.getElementById('paginationContainer');
  
  if (!tableWrapper || !paginationContainer) return;
  
  // إزالة المستمع السابق إذا كان موجوداً
  if (tableWrapper._scrollListener) {
    tableWrapper.removeEventListener('scroll', tableWrapper._scrollListener);
  }
  
  const scrollListener = () => {
    if (totalPages <= 1) return;
    
    const scrollHeight = tableWrapper.scrollHeight;
    const scrollTop = tableWrapper.scrollTop;
    const clientHeight = tableWrapper.clientHeight;
    
    // حساب نسبة التمرير
    const scrollPercentage = ((scrollTop + clientHeight) / scrollHeight) * 100;
    
    // إظهار شريط الصفحات عند الوصول لـ 50% من الصفحة
    if (scrollPercentage >= 50) {
      paginationContainer.style.opacity = '1';
      paginationContainer.style.transform = 'translateY(0)';
    } else {
      paginationContainer.style.opacity = '0';
      paginationContainer.style.transform = 'translateY(20px)';
    }
  };
  
  // حفظ المستمع للإشارة إليه لاحقاً
  tableWrapper._scrollListener = scrollListener;
  tableWrapper.addEventListener('scroll', scrollListener);
  
  // إضافة انتقالات سلسة
  paginationContainer.style.transition = 'opacity 0.3s ease, transform 0.3s ease';
  paginationContainer.style.opacity = '0';
  paginationContainer.style.transform = 'translateY(20px)';
}

// ═══════════════════════════════════════════════════════════════
// 🪟 MODAL MANAGEMENT
// ═══════════════════════════════════════════════════════════════
function openPurchaseModal() {
  const modal = document.getElementById('purchaseModal');
  if (modal) {
    modal.classList.add('show');
  } else {
    // Open Quick Purchase Modal
    openQuickPurchaseModal();
  }
}

async function openQuickPurchaseModal() {
  let modal = document.getElementById('quickPurchaseModal');
  if (!modal) {
    createQuickPurchaseModal();
    modal = document.getElementById('quickPurchaseModal');
  }
  // ✅ Force clean state then show
  modal.classList.remove('show');
  void modal.offsetHeight; // force reflow
  modal.classList.add('show');
  document.body.style.overflow = 'hidden';

  // Set today's date
  const dateInput = document.getElementById('quickDeviceDate');
  if (dateInput) dateInput.value = todayISO();

  // تحميل الموردين وملء القائمة
  await loadSuppliers();
  populateSupplierDropdowns();

  // تحميل المخازن للأجهزة
  if (window.WarehouseHandler) {
    await window.WarehouseHandler.populateWarehouseSelect('quickWarehouseId', 'devices', null, true);
    const currentWarehouseId = localStorage.getItem('currentWarehouseId');
    if (currentWarehouseId) {
      const select = document.getElementById('quickWarehouseId');
      if (select) select.value = currentWarehouseId;
    }
  }

  // تحميل أرصدة المحافظ
  await loadWalletBalances();
  setupWalletEvents('quick');

  // إعادة تعيين حقول المورد
  const supplierSelect = document.getElementById('quickSupplierId');
  if (supplierSelect) supplierSelect.value = '';
  const balanceInput = document.getElementById('supplierBalance');
  if (balanceInput) balanceInput.value = '';
  const nameInput = document.getElementById('quickPartyName');
  if (nameInput) { nameInput.value = ''; nameInput.readOnly = false; }
  const phoneInput = document.getElementById('quickPartyPhone');
  if (phoneInput) { phoneInput.value = ''; phoneInput.readOnly = false; }

  // Reset RAM/Battery visibility - RAM visible, Battery hidden by default
  const ramRow = document.getElementById('quickRamRow');
  const batteryRow = document.getElementById('batteryRow');
  if (ramRow) ramRow.style.display = 'block';
  if (batteryRow) batteryRow.style.display = 'none';
}

function closeQuickPurchaseModal() {
  const modal = document.getElementById('quickPurchaseModal');
  if (modal) {
    modal.classList.remove('show');
    document.body.style.overflow = '';
    
    // Reset form
    const form = document.getElementById('quickDeviceForm');
    if (form) form.reset();
    
    // Reset summary
    updateQuickSummary();
  }
}
window.closeQuickPurchaseModal = closeQuickPurchaseModal;

async function openBulkPurchaseModal() {
  let modal = document.getElementById('bulkPurchaseModal');
  if (!modal) {
    createBulkPurchaseModal();
    modal = document.getElementById('bulkPurchaseModal');
  }
  // ✅ Force clean state then show
  modal.classList.remove('show');
  void modal.offsetHeight;
  modal.classList.add('show');
  document.body.style.overflow = 'hidden';

  // Set today's date
  const dateInput = document.getElementById('bulkDate');
  if (dateInput) dateInput.value = todayISO();

  // Reset devices
  bulkDevices = [];
  deviceCounter = 0;
  renderBulkDevicesList();

  // تحميل الموردين
  await loadSuppliers();
  populateSupplierDropdowns();

  // تحميل المخازن للأجهزة
  if (window.WarehouseHandler) {
    await window.WarehouseHandler.populateWarehouseSelect('bulkWarehouseId', 'devices', null, true);
    const currentWarehouseId = localStorage.getItem('currentWarehouseId');
    if (currentWarehouseId) {
      const select = document.getElementById('bulkWarehouseId');
      if (select) select.value = currentWarehouseId;
    }
  }

  // تحميل أرصدة المحافظ
  await loadWalletBalances();
  await loadPaymentWallets(); // ✅ تحميل المحافظ الفعلية
  setupWalletEvents('bulk');

  // إعادة تعيين حقول المورد
  const supplierSelect = document.getElementById('bulkSupplierId');
  if (supplierSelect) supplierSelect.value = '';
  const balanceInput = document.getElementById('bulkSupplierBalance');
  if (balanceInput) balanceInput.value = '';
  const nameInput = document.getElementById('bulkSupplierName');
  if (nameInput) { nameInput.value = ''; nameInput.readOnly = false; }
  const phoneInput = document.getElementById('bulkSupplierPhone');
  if (phoneInput) { phoneInput.value = ''; phoneInput.readOnly = false; }
  const paidInput = document.getElementById('bulkPaidNow');
  if (paidInput) paidInput.value = '';
}

function closeBulkPurchaseModal() {
  const modal = document.getElementById('bulkPurchaseModal');
  if (modal) {
    modal.classList.remove('show');
    document.body.style.overflow = '';
    bulkDevices = [];
    deviceCounter = 0;
  }
}
window.closeBulkPurchaseModal = closeBulkPurchaseModal;

function closePurchaseModal() {
  const modal = document.getElementById('purchaseModal');
  if (modal) {
    modal.classList.remove('show');
  }
  closeQuickPurchaseModal();
  closeBulkPurchaseModal();
}

function switchTab(tab) {
  // Legacy support - redirect to new modals
  if (tab === 'quick') {
    openQuickPurchaseModal();
  } else if (tab === 'bulk') {
    openBulkPurchaseModal();
  }
}

// ═══════════════════════════════════════════════════════════════
// 🎨 CREATE QUICK PURCHASE MODAL
// ═══════════════════════════════════════════════════════════════
function createQuickPurchaseModal() {
  const modalHtml = `
    <div class="modal-overlay" id="quickPurchaseModal">
      <div class="modal" style="max-width: 800px;">
        <div class="modal-header">
          <div class="modal-title-block">
            <div class="modal-title">📱 جهاز واحد</div>
            <div class="modal-subtitle arabic-text">إضافة جهاز بمفرده — شركة، موديل، IMEI</div>
          </div>
          <button class="modal-close" onclick="closeQuickPurchaseModal()">✕</button>
        </div>
        <div class="modal-body">
          <form id="quickDeviceForm" onsubmit="handleQuickDeviceSubmit(event)">

            <!-- Device Info Section -->
            <div class="form-section">
              <div class="section-title">📱 معلومات الجهاز</div>
              <div class="form-row">
                <div class="form-group">
                  <label class="form-label">الشركة <span class="required">*</span></label>
                  <select class="form-select" id="quickDeviceType" required onchange="toggleCustomType(this); toggleBatteryForApple(this)">
                    <option value="">-- اختر الشركة --</option>
                    <option value="Apple">Apple</option>
                    <option value="Samsung">Samsung</option>
                    <option value="Oppo">Oppo</option>
                    <option value="Realme">Realme</option>
                    <option value="Vivo">Vivo</option>
                    <option value="Huawei">Huawei</option>
                    <option value="Xiaomi">Xiaomi</option>
                    <option value="Other">أخرى</option>
                  </select>
                </div>
                <div class="form-group" id="customTypeGroup" style="display:none;">
                  <label class="form-label">اسم الشركة</label>
                  <input type="text" class="form-input" id="quickCustomType" placeholder="اكتب اسم الشركة">
                </div>
                <div class="form-group">
                  <label class="form-label">الموديل <span class="required">*</span></label>
                  <input type="text" class="form-input" id="quickDeviceModel" required placeholder="مثال: iPhone 15 Pro Max">
                </div>
              </div>

              <div class="form-row">
                <div class="form-group">
                  <label class="form-label">💾 المساحة</label>
                  <select class="form-select" id="quickDeviceStorage">
                    <option value="">-- اختر --</option>
                    <option value="32GB">32GB</option>
                    <option value="64GB">64GB</option>
                    <option value="128GB">128GB</option>
                    <option value="256GB">256GB</option>
                    <option value="512GB">512GB</option>
                    <option value="1TB">1TB</option>
                  </select>
                </div>
                <div class="form-group" id="quickRamRow">
                  <label class="form-label">🧠 الرام</label>
                  <select class="form-select" id="quickDeviceRam">
                    <option value="">-- اختر --</option>
                    <option value="2GB">2GB</option>
                    <option value="3GB">3GB</option>
                    <option value="4GB">4GB</option>
                    <option value="6GB">6GB</option>
                    <option value="8GB">8GB</option>
                    <option value="12GB">12GB</option>
                    <option value="16GB">16GB</option>
                  </select>
                </div>
              </div>

              <div class="form-row">
                <div class="form-group">
                  <label class="form-label">🎨 اللون</label>
                  <input type="text" class="form-input" id="quickDeviceColor" placeholder="مثال: أسود، ذهبي، فضي">
                </div>
              </div>

              <div class="form-row">
                <div class="form-group">
                  <label class="form-label">⚙️ الحالة</label>
                  <select class="form-select" id="quickDeviceCondition">
                    <option value="new">جديد</option>
                    <option value="like_new">كالجديد</option>
                    <option value="used" selected>مستعمل</option>
                    <option value="faulty">عاطل</option>
                  </select>
                </div>
                <div class="form-group">
                  <label class="form-label">📦 العلبة/الكرتونة</label>
                  <select class="form-select" id="quickBox">
                    <option value="without_box">بدون علبة</option>
                    <option value="with_box">بعلبة</option>
                  </select>
                </div>
              </div>

              <div class="form-row" id="batteryRow" style="display:none;">
                <div class="form-group">
                  <label class="form-label">🔋 صحة البطارية %</label>
                  <input type="number" class="form-input" id="quickBattery" min="0" max="100" placeholder="مثال: 87">
                </div>
              </div>

              <div class="form-row">
                <div class="form-group">
                  <label class="form-label">🔢 IMEI 1</label>
                  <input type="text" class="form-input" id="quickImei1" placeholder="الرقم التسلسلي الأول" style="font-family:monospace;">
                </div>
                <div class="form-group">
                  <label class="form-label">🔢 IMEI 2 (اختياري)</label>
                  <input type="text" class="form-input" id="quickImei2" placeholder="الرقم التسلسلي الثاني" style="font-family:monospace;">
                </div>
              </div>
            </div>

            <!-- Warehouse Selection Section -->
            <div class="form-section">
              <div class="section-title">🏪 المخزن</div>
              <div class="form-row">
                <div class="form-group">
                  <label class="form-label">المخزن <span style="color:var(--text-secondary);font-size:11px;">(اختياري)</span></label>
                  <select class="form-select" id="quickWarehouseId">
                    <option value="">-- اختر المخزن --</option>
                  </select>
                  <small style="color:var(--text-secondary);font-size:10px;margin-top:3px;display:block;">سيتم إضافة الجهاز للمخزن المحدد</small>
                </div>
              </div>
            </div>

            <!-- Source Info Section -->
            <div class="form-section">
              <div class="section-title">👤 مصدر الشراء</div>
              <div class="form-row">
                <div class="form-group">
                  <label class="form-label">نوع المصدر</label>
                  <select class="form-select" id="quickSourceType" onchange="toggleSourceFields(this)">
                    <option value="vendor">تاجر/مورد</option>
                    <option value="customer">عميل</option>
                  </select>
                </div>
                <div class="form-group">
                  <label class="form-label">📅 التاريخ</label>
                  <input type="date" class="form-input" id="quickDeviceDate">
                </div>
              </div>

              <!-- Supplier Selection (for vendor) -->
              <div class="form-row" id="supplierSelectRow">
                <div class="form-group" style="flex: 2;">
                  <label class="form-label">اختر مورد <span style="color:var(--text-secondary);font-size:11px;">(اختياري)</span></label>
                  <select class="form-select" id="quickSupplierId" onchange="handleSupplierSelect(this)">
                    <option value="">-- مورد جديد --</option>
                  </select>
                </div>
                <div class="form-group" style="flex: 1;">
                  <label class="form-label">رصيد المورد</label>
                  <input type="text" class="form-input" id="supplierBalance" readonly placeholder="-" style="text-align:center;background:var(--bg-tertiary);">
                </div>
              </div>

              <div class="form-row" id="partyInfoRow">
                <div class="form-group">
                  <label class="form-label">الاسم</label>
                  <input type="text" class="form-input" id="quickPartyName" placeholder="اسم التاجر/العميل">
                </div>
                <div class="form-group">
                  <label class="form-label">📞 الهاتف</label>
                  <input type="tel" class="form-input" id="quickPartyPhone" placeholder="رقم الهاتف" dir="ltr">
                </div>
              </div>
            </div>

            <!-- Pricing Section -->
            <div class="form-section">
              <div class="section-title">💰 التسعير</div>
              <div class="form-row">
                <div class="form-group">
                  <label class="form-label">💵 تكلفة الشراء <span class="required">*</span></label>
                  <input type="number" class="form-input" id="quickCost" required min="0" step="0.01" placeholder="0.00" oninput="updateQuickSummary()">
                </div>
                <div class="form-group">
                  <label class="form-label">🏷️ سعر البيع المتوقع <span class="required">*</span></label>
                  <input type="number" class="form-input" id="quickExpectedPrice" required min="0" step="0.01" placeholder="0.00" oninput="updateQuickSummary()">
                </div>
              </div>
              <div class="form-row">
                <div class="form-group">
                  <label class="form-label">🏛️ ضريبة NTRA (اختياري)</label>
                  <input type="number" class="form-input" id="quickNtraTax" min="0" step="0.01" placeholder="0.00" oninput="updateQuickSummary()">
                  <small style="color:var(--text-secondary);font-size:10px;margin-top:3px;display:block;">ضريبة الجمارك للأجهزة المستوردة</small>
                </div>
              </div>
              <div class="form-group">
                <label class="form-label">📝 ملاحظات</label>
                <textarea class="form-input" id="quickNotes" placeholder="ملاحظات إضافية..." style="min-height:60px;resize:vertical;"></textarea>
              </div>
            </div>

            <!-- Payment Section - في الآخر بعد كل البيانات -->
            <div class="form-section" style="background: linear-gradient(135deg, rgba(245, 158, 11, 0.1) 0%, rgba(59, 130, 246, 0.05) 100%); border: 2px solid var(--warning); border-radius: 12px;">
              <div class="section-title" style="color: var(--warning);">💰 الدفع للمورد</div>
              <div class="form-row">
                <div class="form-group">
                  <label class="form-label">نوع الدفع</label>
                  <select class="form-select" id="quickPaymentMethod" style="padding: 15px; font-weight: bold;" onchange="toggleWalletSelect('quick')">
                    <option value="cash">💵 دفع فوري</option>
                    <option value="credit">📋 آجل (على الحساب)</option>
                  </select>
                </div>
                <div class="form-group" id="quickWalletGroup">
                  <label class="form-label">🏦 من المحفظة</label>
                  <select class="form-select" id="quickWalletType" style="padding: 15px;" onchange="updatePurchaseWalletsList('quick')">
                    <option value="cash">💵 كاش سائل</option>
                    <option value="mobile_wallet">📱 محفظة إلكترونية</option>
                    <option value="bank">🏛️ البنك</option>
                  </select>
                  <!-- ✅ Dropdown للمحافظ المحددة -->
                  <div class="form-group" id="quickWalletSelectGroup" style="margin-top: 8px; display: none;">
                    <label class="form-label" style="font-size: 13px; color: var(--text-secondary);">اختر المحفظة المحددة</label>
                    <select class="form-select" id="quickWalletSelect" style="padding: 12px;" onchange="updateWalletBalanceDisplay('quick')">
                      <option value="">-- اختر المحفظة --</option>
                    </select>
                  </div>
                </div>
              </div>
              <div class="form-row" id="quickWalletRow">
                <div class="form-group" style="flex: 2;">
                  <label class="form-label">💵 المبلغ المدفوع الآن</label>
                  <input type="number" class="form-input" id="quickPaidNow" min="0" step="0.01" placeholder="أدخل المبلغ المدفوع..." oninput="updateQuickSummary()" style="font-size: 18px; font-weight: bold; padding: 15px; border: 2px solid var(--warning);">
                </div>
                <div class="form-group" style="flex: 1;">
                  <label class="form-label">💰 رصيد المحفظة</label>
                  <input type="text" class="form-input" id="quickWalletBalance" readonly style="text-align:center;background:var(--bg-tertiary);font-weight:bold;color:var(--success);" value="جاري التحميل...">
                </div>
              </div>
              <small style="color:var(--warning);font-size:11px;display:block;text-align:center;margin-top:8px;">⚠️ تأكد من إدخال المبلغ المدفوع - سيتم تحذيرك إذا كان صفر</small>
            </div>

            <!-- Summary -->
            <div class="summary-box show">
              <div class="summary-header"><span>📊</span><span>ملخص التوريد</span></div>
              <div class="summary-grid">
                <div class="summary-item">
                  <span class="summary-label">التكلفة</span>
                  <span class="summary-value" id="summaryQuickCost">0.00</span>
                </div>
                <div class="summary-item">
                  <span class="summary-label">الضريبة</span>
                  <span class="summary-value" id="summaryQuickTax">0.00</span>
                </div>
                <div class="summary-item">
                  <span class="summary-label">المتبقي للمورد</span>
                  <span class="summary-value" id="summaryQuickRemaining">0.00</span>
                </div>
                <div class="summary-item">
                  <span class="summary-label">الربح المتوقع</span>
                  <span class="summary-value text-success" id="summaryQuickProfit">0.00</span>
                </div>
              </div>
              <div class="summary-total">
                <span class="summary-total-label">إجمالي التكلفة</span>
                <span class="summary-total-value" id="summaryQuickTotal">0.00 ج.م</span>
              </div>
            </div>
          </form>
        </div>
        <div class="modal-footer">
          <button type="button" class="btn-modal btn-cancel" onclick="closeQuickPurchaseModal()">إلغاء</button>
          <button type="submit" form="quickDeviceForm" class="btn-modal btn-submit">✓ تأكيد التوريد</button>
        </div>
      </div>
    </div>
  `;

  document.body.insertAdjacentHTML('beforeend', modalHtml);
  // ✅ Backdrop click to close
  document.getElementById('quickPurchaseModal')?.addEventListener('mousedown', (e) => {
    if (e.target.id === 'quickPurchaseModal') closeQuickPurchaseModal();
  });
  // توافق: عند اختيار "جديد" → مع كرتونة
  const qCond = document.getElementById('quickDeviceCondition');
  if (qCond) qCond.addEventListener('change', function() {
    const qBox = document.getElementById('quickBox');
    if (qBox && this.value === 'new') qBox.value = 'with_box';
  });
}

// ═══════════════════════════════════════════════════════════════
// 🎨 CREATE BULK PURCHASE MODAL
// ═══════════════════════════════════════════════════════════════
function createBulkPurchaseModal() {
  const modalHtml = `
    <div class="modal-overlay" id="bulkPurchaseModal">
      <div class="modal" style="max-width: 1100px;">
        <div class="modal-header">
          <div class="modal-title-block">
            <div class="modal-title">📋 أجهزة مختلفة</div>
            <div class="modal-subtitle arabic-text">عدة أجهزة — كل جهاز بمواصفاته وسعره (مثل فاتورة)</div>
          </div>
          <button class="modal-close" onclick="closeBulkPurchaseModal()">✕</button>
        </div>
        <div class="modal-body">
          <form id="bulkDeviceForm" onsubmit="handleBulkDeviceSubmit(event)">

            <!-- Warehouse Selection Section -->
            <div class="form-section">
              <div class="section-title">🏪 المخزن</div>
              <div class="form-row">
                <div class="form-group">
                  <label class="form-label">المخزن <span style="color:var(--text-secondary);font-size:11px;">(اختياري)</span></label>
                  <select class="form-select" id="bulkWarehouseId">
                    <option value="">-- اختر المخزن --</option>
                  </select>
                  <small style="color:var(--text-secondary);font-size:10px;margin-top:3px;display:block;">سيتم إضافة جميع الأجهزة للمخزن المحدد</small>
                </div>
              </div>
            </div>

            <!-- Supplier Info -->
            <div class="form-section">
              <div class="section-title">👤 المورد</div>
              <div class="form-row">
                <div class="form-group" style="flex: 2;">
                  <label class="form-label">اختر مورد <span style="color:var(--text-secondary);font-size:11px;">(اختياري)</span></label>
                  <select class="form-select" id="bulkSupplierId" onchange="handleBulkSupplierSelect(this)">
                    <option value="">-- مورد جديد --</option>
                  </select>
                </div>
                <div class="form-group" style="flex: 1;">
                  <label class="form-label">رصيد المورد</label>
                  <input type="text" class="form-input" id="bulkSupplierBalance" readonly placeholder="-" style="text-align:center;background:var(--bg-tertiary);">
                </div>
              </div>
              <div class="form-row">
                <div class="form-group">
                  <label class="form-label">اسم المورد</label>
                  <input type="text" class="form-input" id="bulkSupplierName" placeholder="اسم المورد">
                </div>
                <div class="form-group">
                  <label class="form-label">📞 الهاتف</label>
                  <input type="tel" class="form-input" id="bulkSupplierPhone" placeholder="رقم الهاتف" dir="ltr">
                </div>
                <div class="form-group">
                  <label class="form-label">📅 التاريخ</label>
                  <input type="date" class="form-input" id="bulkDate">
                </div>
              </div>
            </div>

            <!-- Devices List -->
            <div class="form-section">
              <div class="section-title" style="display:flex;justify-content:space-between;align-items:center;">
                <span>📱 الأجهزة</span>
                <button type="button" class="btn-add-device" onclick="addBulkDevice()">+ إضافة جهاز</button>
              </div>
              <div id="bulkDevicesList"></div>
            </div>

            <!-- Payment Section - بعد إدخال الأجهزة -->
            <div class="form-section" style="background: linear-gradient(135deg, rgba(245, 158, 11, 0.1) 0%, rgba(59, 130, 246, 0.05) 100%); border: 2px solid var(--warning); border-radius: 12px;">
              <div class="section-title" style="color: var(--warning);">💰 الدفع للمورد</div>
              <div class="form-row">
                <div class="form-group">
                  <label class="form-label">نوع الدفع</label>
                  <select class="form-select" id="bulkPaymentMethod" style="padding: 15px; font-weight: bold;" onchange="toggleWalletSelect('bulk')">
                    <option value="cash">💵 دفع فوري</option>
                    <option value="credit">📋 آجل (على الحساب)</option>
                  </select>
                </div>
                <div class="form-group" id="bulkWalletGroup">
                  <label class="form-label">🏦 من المحفظة</label>
                  <select class="form-select" id="bulkWalletType" style="padding: 15px;" onchange="updatePurchaseWalletsList('bulk')">
                    <option value="cash">💵 كاش سائل</option>
                    <option value="mobile_wallet">📱 محفظة إلكترونية</option>
                    <option value="bank">🏛️ البنك</option>
                  </select>
                  <!-- ✅ Dropdown للمحافظ المحددة -->
                  <div class="form-group" id="bulkWalletSelectGroup" style="margin-top: 8px; display: none;">
                    <label class="form-label" style="font-size: 13px; color: var(--text-secondary);">اختر المحفظة المحددة</label>
                    <select class="form-select" id="bulkWalletSelect" style="padding: 12px;" onchange="updateWalletBalanceDisplay('bulk')">
                      <option value="">-- اختر المحفظة --</option>
                    </select>
                  </div>
                </div>
              </div>
              <div class="form-row" id="bulkWalletRow">
                <div class="form-group" style="flex: 2;">
                  <label class="form-label">💵 المبلغ المدفوع الآن</label>
                  <input type="number" class="form-input" id="bulkPaidNow" min="0" step="0.01" placeholder="أدخل المبلغ المدفوع..." oninput="updateBulkSummary()" style="font-size: 18px; font-weight: bold; padding: 15px; border: 2px solid var(--warning);">
                </div>
                <div class="form-group" style="flex: 1;">
                  <label class="form-label">💰 رصيد المحفظة</label>
                  <input type="text" class="form-input" id="bulkWalletBalance" readonly style="text-align:center;background:var(--bg-tertiary);font-weight:bold;color:var(--success);" value="جاري التحميل...">
                </div>
              </div>
              <small style="color:var(--warning);font-size:11px;display:block;text-align:center;margin-top:8px;">⚠️ تأكد من إدخال المبلغ المدفوع - سيتم تحذيرك إذا كان صفر</small>
            </div>

            <!-- Summary -->
            <div class="summary-box show">
              <div class="summary-header"><span>📊</span><span>ملخص الفاتورة</span></div>
              <div class="summary-grid">
                <div class="summary-item">
                  <span class="summary-label">عدد الأجهزة</span>
                  <span class="summary-value" id="summaryBulkCount">0</span>
                </div>
                <div class="summary-item">
                  <span class="summary-label">إجمالي الضرائب</span>
                  <span class="summary-value" id="summaryBulkTax">0.00</span>
                </div>
                <div class="summary-item">
                  <span class="summary-label">المدفوع</span>
                  <span class="summary-value" id="summaryBulkPaid" style="color:var(--success);">0.00</span>
                </div>
                <div class="summary-item">
                  <span class="summary-label">المتبقي للمورد</span>
                  <span class="summary-value" id="summaryBulkRemaining" style="color:var(--warning);">0.00</span>
                </div>
              </div>
              <div class="summary-total">
                <span class="summary-total-label">إجمالي التكلفة</span>
                <span class="summary-total-value" id="summaryBulkTotal">0.00 ج.م</span>
              </div>
            </div>
          </form>
        </div>
        <div class="modal-footer">
          <button type="button" class="btn-modal btn-cancel" onclick="closeBulkPurchaseModal()">إلغاء</button>
          <button type="submit" form="bulkDeviceForm" class="btn-modal btn-submit">✓ حفظ الفاتورة</button>
        </div>
      </div>
    </div>
  `;

  document.body.insertAdjacentHTML('beforeend', modalHtml);
  // ✅ Backdrop click to close
  document.getElementById('bulkPurchaseModal')?.addEventListener('mousedown', (e) => {
    if (e.target.id === 'bulkPurchaseModal') closeBulkPurchaseModal();
  });
}

// ═══════════════════════════════════════════════════════════════
// 🚀 دفعة واحدة - موديل واحد + عدة IMEI (Bulk Purchase Fast)
// ═══════════════════════════════════════════════════════════════
let bpfRowIndex = 0;

function createBulkPurchaseFastModal() {
  const modalHtml = `
    <div class="modal-overlay" id="bulkPurchaseFastModal">
      <div class="modal" style="max-width: 1000px;">
        <div class="modal-header">
          <div class="modal-title-block">
            <div class="modal-title">🚀 دفعة واحدة</div>
            <div class="modal-subtitle arabic-text">موديل واحد — إدخال عدة IMEI ولون</div>
          </div>
          <button class="modal-close" onclick="closeBulkPurchaseFastModal()">✕</button>
        </div>
        <div class="modal-body">
          <form id="bpfForm" onsubmit="submitBulkPurchaseFast(event)">

            <div class="form-section">
              <div class="section-title">📋 موديل واحد</div>
              <div class="form-row">
                <div class="form-group">
                  <label class="form-label">الشركة <span class="required">*</span></label>
                  <select class="form-select" id="bpfType" onchange="toggleBpfRamBattery()">
                    <option value="">-- اختر --</option>
                    <option value="Apple">Apple</option>
                    <option value="Samsung">Samsung</option>
                    <option value="Oppo">Oppo</option>
                    <option value="Realme">Realme</option>
                    <option value="Vivo">Vivo</option>
                    <option value="Huawei">Huawei</option>
                    <option value="Xiaomi">Xiaomi</option>
                    <option value="Other">أخرى</option>
                  </select>
                </div>
                <div class="form-group" id="bpfCustomTypeField" style="display:none;">
                  <label class="form-label">🏷️ اسم الشركة <span class="required">*</span></label>
                  <input type="text" class="form-input" id="bpfCustomType" placeholder="اكتب اسم الشركة">
                </div>
                <div class="form-group">
                  <label class="form-label">الموديل <span class="required">*</span></label>
                  <input type="text" class="form-input" id="bpfModel" placeholder="مثال: Galaxy A54">
                </div>
                <div class="form-group">
                  <label class="form-label">💾 المساحة</label>
                  <select class="form-select" id="bpfStorage">
                    <option value="">-- اختر --</option>
                    <option value="32GB">32GB</option>
                    <option value="64GB">64GB</option>
                    <option value="128GB">128GB</option>
                    <option value="256GB">256GB</option>
                    <option value="512GB">512GB</option>
                    <option value="1TB">1TB</option>
                  </select>
                </div>
                <div class="form-group" id="bpfRamField">
                  <label class="form-label">🧠 الرام</label>
                  <select class="form-select" id="bpfRam">
                    <option value="">-- اختر --</option>
                    <option value="2GB">2GB</option>
                    <option value="3GB">3GB</option>
                    <option value="4GB">4GB</option>
                    <option value="6GB">6GB</option>
                    <option value="8GB">8GB</option>
                    <option value="12GB">12GB</option>
                    <option value="16GB">16GB</option>
                  </select>
                </div>
                <div class="form-group" id="bpfBatteryField" style="display:none;">
                  <label class="form-label">🔋 البطارية %</label>
                  <input type="number" class="form-input" id="bpfBattery" placeholder="85" min="0" max="100">
                </div>
              </div>
              <div class="form-row">
                <div class="form-group">
                  <label class="form-label">⚙️ الحالة</label>
                  <select class="form-select" id="bpfCondition">
                    <option value="new">جديد</option>
                    <option value="like_new">كالجديد</option>
                    <option value="used" selected>مستعمل</option>
                    <option value="faulty">عاطل</option>
                  </select>
                </div>
                <div class="form-group">
                  <label class="form-label">📦 الكرتونة</label>
                  <select class="form-select" id="bpfBox">
                    <option value="without_box" selected>بدون علبة</option>
                    <option value="with_box">بعلبة</option>
                  </select>
                </div>
                <div class="form-group">
                  <label class="form-label">💰 سعر الشراء <span class="required">*</span></label>
                  <input type="number" class="form-input" id="bpfCost" min="0" step="0.01" placeholder="0" oninput="updateBulkPurchaseFastSummary()">
                </div>
                <div class="form-group">
                  <label class="form-label">💵 سعر البيع المتوقع</label>
                  <input type="number" class="form-input" id="bpfPrice" min="0" step="0.01" placeholder="0">
                </div>
                <div class="form-group">
                  <label class="form-label">🏪 المخزن</label>
                  <select class="form-select" id="bpfWarehouseId">
                    <option value="">-- اختر المخزن --</option>
                  </select>
                </div>
              </div>
            </div>

            <div class="form-section">
              <div class="section-title" style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:8px;">
                <span>📱 IMEI + لون</span>
                <div style="display:flex;gap:8px;">
                  <button type="button" class="btn-add-device" onclick="pasteBpfIMEIs()">📋 لصق IMEIs</button>
                  <button type="button" class="btn-add-device" onclick="addBpfRow()">➕ إضافة صف</button>
                </div>
              </div>
              <div style="overflow-x:auto;max-height:220px;overflow-y:auto;">
                <table style="width:100%;border-collapse:collapse;">
                  <thead>
                    <tr style="background:var(--bg-tertiary);">
                      <th style="padding:10px;text-align:right;font-size:12px;">#</th>
                      <th style="padding:10px;text-align:right;font-size:12px;">IMEI 1 *</th>
                      <th style="padding:10px;text-align:right;font-size:12px;">IMEI 2</th>
                      <th style="padding:10px;text-align:right;font-size:12px;">اللون</th>
                      <th style="padding:10px;text-align:right;font-size:12px;">📊 الباركود</th>
                      <th style="width:44px;"></th>
                    </tr>
                  </thead>
                  <tbody id="bpfDevicesBody"></tbody>
                </table>
              </div>
              <div style="margin-top:12px;display:flex;gap:10px;align-items:center;flex-wrap:wrap;">
                <label style="font-size:12px;color:var(--text-secondary);">🎨 تطبيق لون على الكل:</label>
                <input type="text" id="bpfApplyColor" placeholder="أسود" style="padding:8px 12px;border-radius:8px;border:1px solid var(--border);background:var(--bg-tertiary);color:var(--text-primary);font-size:13px;width:120px;">
                <button type="button" onclick="applyBpfColorToAll()" style="padding:8px 14px;border-radius:8px;border:none;background:var(--accent);color:white;font-size:13px;cursor:pointer;font-weight:600;">تطبيق</button>
              </div>
            </div>

            <div class="form-section">
              <div class="section-title">👤 المورد</div>
              <div class="form-row">
                <div class="form-group" style="flex:2;">
                  <label class="form-label">اختر مورد</label>
                  <select class="form-select" id="bpfSupplierId" onchange="handleBpfSupplierSelect(this)">
                    <option value="">-- مورد جديد --</option>
                  </select>
                </div>
                <div class="form-group">
                  <label class="form-label">رصيد المورد</label>
                  <input type="text" class="form-input" id="bpfSupplierBalance" readonly placeholder="-" style="text-align:center;background:var(--bg-tertiary);">
                </div>
              </div>
              <div class="form-row">
                <div class="form-group">
                  <label class="form-label">اسم المورد</label>
                  <input type="text" class="form-input" id="bpfSupplierName" placeholder="اسم المورد">
                </div>
                <div class="form-group">
                  <label class="form-label">📞 الهاتف</label>
                  <input type="tel" class="form-input" id="bpfSupplierPhone" placeholder="رقم الهاتف" dir="ltr">
                </div>
                <div class="form-group">
                  <label class="form-label">📅 التاريخ</label>
                  <input type="date" class="form-input" id="bpfDate">
                </div>
              </div>
            </div>

            <div class="form-section" style="background:linear-gradient(135deg,rgba(245,158,11,0.1) 0%,rgba(59,130,246,0.05) 100%);border:2px solid var(--warning);">
              <div class="section-title" style="color:var(--warning);">💰 الدفع للمورد</div>
              <div class="form-row">
                <div class="form-group">
                  <label class="form-label">نوع الدفع</label>
                  <select class="form-select" id="bpfPaymentMethod" onchange="toggleBpfWalletFields()">
                    <option value="cash">💵 دفع فوري</option>
                    <option value="credit">📋 آجل (على الحساب)</option>
                  </select>
                </div>
                <div class="form-group" id="bpfWalletGroup">
                  <label class="form-label">🏦 من المحفظة</label>
                  <select class="form-select" id="bpfWalletType" onchange="updatePurchaseWalletsList('bpf')">
                    <option value="cash">💵 كاش سائل</option>
                    <option value="mobile_wallet">📱 محفظة إلكترونية</option>
                    <option value="bank">🏛️ البنك</option>
                  </select>
                  <div class="form-group" id="bpfWalletSelectGroup" style="margin-top:8px;display:none;">
                    <label class="form-label" style="font-size:12px;">اختر المحفظة</label>
                    <select class="form-select" id="bpfWalletSelect" onchange="updateWalletBalanceDisplay('bpf')">
                      <option value="">-- اختر المحفظة --</option>
                    </select>
                  </div>
                </div>
              </div>
              <div class="form-row" id="bpfWalletRow">
                <div class="form-group" style="flex:2;">
                  <label class="form-label">💵 المبلغ المدفوع الآن</label>
                  <input type="number" class="form-input" id="bpfPaidNow" min="0" step="0.01" placeholder="أدخل المبلغ..." oninput="updateBulkPurchaseFastSummary()" style="font-weight:bold;">
                </div>
                <div class="form-group">
                  <label class="form-label">💰 رصيد المحفظة</label>
                  <input type="text" class="form-input" id="bpfWalletBalance" readonly style="text-align:center;background:var(--bg-tertiary);" value="جاري التحميل...">
                </div>
              </div>
              <small style="color:var(--warning);font-size:11px;display:block;margin-top:6px;">⚠️ تأكد من إدخال المبلغ المدفوع - سيتم تحذيرك إذا كان صفر</small>
            </div>

            <div class="summary-box show">
              <div class="summary-header"><span>📊</span><span>ملخص التوريد السريع المتعدد</span></div>
              <div class="summary-grid">
                <div class="summary-item">
                  <span class="summary-label">عدد الأجهزة</span>
                  <span class="summary-value" id="bpfSummaryCount">0</span>
                </div>
                <div class="summary-item">
                  <span class="summary-label">إجمالي التكلفة</span>
                  <span class="summary-value" id="bpfSummaryTotal">0.00</span>
                </div>
                <div class="summary-item">
                  <span class="summary-label">المدفوع</span>
                  <span class="summary-value" id="bpfSummaryPaid" style="color:var(--success);">0.00</span>
                </div>
                <div class="summary-item">
                  <span class="summary-label">المتبقي للمورد</span>
                  <span class="summary-value" id="bpfSummaryRemaining" style="color:var(--warning);">0.00</span>
                </div>
              </div>
              <div class="summary-total">
                <span class="summary-total-label">إجمالي</span>
                <span class="summary-total-value" id="bpfSummaryTotalVal">0.00 ج.م</span>
              </div>
            </div>
          </form>
        </div>
        <div class="modal-footer">
          <button type="button" class="btn-modal btn-cancel" onclick="closeBulkPurchaseFastModal()">إلغاء</button>
          <button type="submit" form="bpfForm" class="btn-modal btn-submit">✓ حفظ الدفعة</button>
        </div>
      </div>
    </div>
  `;
  document.body.insertAdjacentHTML('beforeend', modalHtml);
  // ✅ Backdrop click to close
  document.getElementById('bulkPurchaseFastModal')?.addEventListener('mousedown', (e) => {
    if (e.target.id === 'bulkPurchaseFastModal') closeBulkPurchaseFastModal();
  });
  // توافق: عند اختيار "جديد" → مع كرتونة
  const bpfCond = document.getElementById('bpfCondition');
  if (bpfCond) bpfCond.addEventListener('change', function() {
    const bpfBoxEl = document.getElementById('bpfBox');
    if (bpfBoxEl && this.value === 'new') bpfBoxEl.value = 'with_box';
  });
}

async function openBulkPurchaseFastModal() {
  let modal = document.getElementById('bulkPurchaseFastModal');
  if (!modal) {
    createBulkPurchaseFastModal();
    modal = document.getElementById('bulkPurchaseFastModal');
  }
  // ✅ Force clean state then show
  modal.classList.remove('show');
  void modal.offsetHeight;
  modal.classList.add('show');
  document.body.style.overflow = 'hidden';

  const dateInput = document.getElementById('bpfDate');
  if (dateInput) dateInput.value = todayISO();

  resetBpfForm();
  await loadSuppliers();
  populateSupplierDropdowns();

  if (window.WarehouseHandler) {
    await window.WarehouseHandler.populateWarehouseSelect('bpfWarehouseId', 'devices', null, true);
    const currentWarehouseId = localStorage.getItem('currentWarehouseId');
    if (currentWarehouseId) {
      const sel = document.getElementById('bpfWarehouseId');
      if (sel) sel.value = currentWarehouseId;
    }
  }

  await loadWalletBalances();
  await loadPaymentWallets();
  updatePurchaseWalletsList('bpf').catch(() => {});
  toggleBpfWalletFields();

  const supplierSelect = document.getElementById('bpfSupplierId');
  if (supplierSelect) supplierSelect.value = '';
  const balanceInput = document.getElementById('bpfSupplierBalance');
  if (balanceInput) balanceInput.value = '';
  const nameInput = document.getElementById('bpfSupplierName');
  if (nameInput) { nameInput.value = ''; nameInput.readOnly = false; }
  const phoneInput = document.getElementById('bpfSupplierPhone');
  if (phoneInput) { phoneInput.value = ''; phoneInput.readOnly = false; }
  const paidInput = document.getElementById('bpfPaidNow');
  if (paidInput) paidInput.value = '';

  for (let i = 0; i < 5; i++) addBpfRow();
  updateBulkPurchaseFastSummary();
  toggleBpfRamBattery();
}
window.openBulkPurchaseFastModal = openBulkPurchaseFastModal;

function closeBulkPurchaseFastModal() {
  const modal = document.getElementById('bulkPurchaseFastModal');
  if (modal) {
    modal.classList.remove('show');
    document.body.style.overflow = '';
  }
}
window.closeBulkPurchaseFastModal = closeBulkPurchaseFastModal;

function resetBpfForm() {
  bpfRowIndex = 0;
  const tbody = document.getElementById('bpfDevicesBody');
  if (tbody) tbody.innerHTML = '';
  const colorInput = document.getElementById('bpfApplyColor');
  if (colorInput) colorInput.value = '';
}

window.toggleBpfRamBattery = function() {
  const typeVal = document.getElementById('bpfType')?.value || '';
  const ramField = document.getElementById('bpfRamField');
  const batteryField = document.getElementById('bpfBatteryField');
  const customTypeField = document.getElementById('bpfCustomTypeField');
  const ramInput = document.getElementById('bpfRam');
  const batteryInput = document.getElementById('bpfBattery');
  const customTypeInput = document.getElementById('bpfCustomType');

  // ✅ إظهار/إخفاء حقل اسم الشركة المخصص
  if (typeVal === 'Other') {
    if (customTypeField) customTypeField.style.display = 'block';
    if (ramField) ramField.style.display = 'none';
    if (batteryField) batteryField.style.display = 'none';
    if (ramInput) ramInput.value = '';
    if (batteryInput) batteryInput.value = '';
  } else if (typeVal === 'Apple') {
    if (customTypeField) customTypeField.style.display = 'none';
    if (customTypeInput) customTypeInput.value = '';
    if (ramField) ramField.style.display = 'none';
    if (batteryField) batteryField.style.display = 'block';
    if (ramInput) ramInput.value = '';
    if (batteryInput) batteryInput.value = '100';
  } else {
    if (customTypeField) customTypeField.style.display = 'none';
    if (customTypeInput) customTypeInput.value = '';
    if (ramField) ramField.style.display = 'block';
    if (batteryField) batteryField.style.display = 'none';
    if (batteryInput) batteryInput.value = '';
  }
};

async function toggleBpfWalletFields() {
  const pm = document.getElementById('bpfPaymentMethod')?.value;
  const row = document.getElementById('bpfWalletRow');
  const group = document.getElementById('bpfWalletGroup');
  if (pm === 'credit') {
    if (row) row.style.display = 'none';
    if (group) group.style.display = 'none';
  } else {
    if (row) row.style.display = 'grid';
    if (group) group.style.display = 'block';
    await updatePurchaseWalletsList('bpf');
  }
  updateBulkPurchaseFastSummary();
}
window.toggleBpfWalletFields = toggleBpfWalletFields;

window.addBpfRow = function() {
  const tbody = document.getElementById('bpfDevicesBody');
  if (!tbody) return;
  bpfRowIndex++;
  const row = document.createElement('tr');
  row.id = 'bpfRow_' + bpfRowIndex;
  row.innerHTML = `
    <td class="row-num">${bpfRowIndex}</td>
    <td><input type="text" id="bpfImei1_${bpfRowIndex}" placeholder="IMEI 1" maxlength="20" onchange="updateBulkPurchaseFastSummary()" style="width:100%;padding:8px;border-radius:6px;border:1px solid var(--border);background:var(--bg-tertiary);color:var(--text-primary);"></td>
    <td><input type="text" id="bpfImei2_${bpfRowIndex}" placeholder="IMEI 2" maxlength="20" style="width:100%;padding:8px;border-radius:6px;border:1px solid var(--border);background:var(--bg-tertiary);color:var(--text-primary);"></td>
    <td><input type="text" id="bpfColor_${bpfRowIndex}" placeholder="اللون" value="أسود" style="width:100%;padding:8px;border-radius:6px;border:1px solid var(--border);background:var(--bg-tertiary);color:var(--text-primary);"></td>
    <td><input type="text" id="bpfBarcode_${bpfRowIndex}" placeholder="امسح الباركود" style="width:100%;padding:8px;border-radius:6px;border:1px solid var(--border);background:var(--bg-tertiary);color:var(--text-primary);"></td>
    <td><button type="button" onclick="removeBpfRow(${bpfRowIndex})" style="width:36px;height:36px;border:none;background:rgba(239,68,68,0.15);color:var(--danger);border-radius:8px;cursor:pointer;font-size:18px;">×</button></td>
  `;
  tbody.appendChild(row);
  updateBulkPurchaseFastSummary();
  const first = document.getElementById('bpfImei1_' + bpfRowIndex);
  if (first) first.focus();
};

window.removeBpfRow = function(idx) {
  const row = document.getElementById('bpfRow_' + idx);
  if (row) {
    row.remove();
    updateBpfRowNumbers();
    updateBulkPurchaseFastSummary();
  }
};

function updateBpfRowNumbers() {
  const tbody = document.getElementById('bpfDevicesBody');
  if (!tbody) return;
  const rows = tbody.querySelectorAll('tr');
  rows.forEach((r, i) => {
    const cell = r.querySelector('.row-num');
    if (cell) cell.textContent = i + 1;
  });
}

window.pasteBpfIMEIs = async function() {
  try {
    const text = await navigator.clipboard.readText();
    if (!text) { showToast('الحافظة فارغة', 'warning'); return; }
    const lines = text.split(/[\n\r\t,;]+/).map(l => l.trim()).filter(l => l.length > 0);
    if (!lines.length) { showToast('لم يتم العثور على بيانات صالحة', 'warning'); return; }

    const tbody = document.getElementById('bpfDevicesBody');
    const existing = tbody?.querySelectorAll('tr') || [];
    existing.forEach(r => {
      const inp = r.querySelector('input[id^="bpfImei1_"]');
      if (inp && !inp.value.trim()) r.remove();
    });

    const defaultColor = document.getElementById('bpfApplyColor')?.value || 'أسود';
    lines.forEach(imei => {
      bpfRowIndex++;
      const tr = document.createElement('tr');
      tr.id = 'bpfRow_' + bpfRowIndex;
      tr.innerHTML = `
        <td class="row-num">${bpfRowIndex}</td>
        <td><input type="text" id="bpfImei1_${bpfRowIndex}" value="${escapeHtml(imei)}" maxlength="20" onchange="updateBulkPurchaseFastSummary()" style="width:100%;padding:8px;border-radius:6px;border:1px solid var(--border);background:var(--bg-tertiary);color:var(--text-primary);"></td>
        <td><input type="text" id="bpfImei2_${bpfRowIndex}" style="width:100%;padding:8px;border-radius:6px;border:1px solid var(--border);background:var(--bg-tertiary);color:var(--text-primary);"></td>
        <td><input type="text" id="bpfColor_${bpfRowIndex}" value="${escapeHtml(defaultColor)}" style="width:100%;padding:8px;border-radius:6px;border:1px solid var(--border);background:var(--bg-tertiary);color:var(--text-primary);"></td>
        <td><input type="text" id="bpfBarcode_${bpfRowIndex}" style="width:100%;padding:8px;border-radius:6px;border:1px solid var(--border);background:var(--bg-tertiary);color:var(--text-primary);"></td>
        <td><button type="button" onclick="removeBpfRow(${bpfRowIndex})" style="width:36px;height:36px;border:none;background:rgba(239,68,68,0.15);color:var(--danger);border-radius:8px;cursor:pointer;font-size:18px;">×</button></td>
      `;
      tbody.appendChild(tr);
    });
    updateBpfRowNumbers();
    updateBulkPurchaseFastSummary();
    showToast('✅ تم لصق ' + lines.length + ' IMEI', 'success');
  } catch (e) {
    Logger.error('pasteBpfIMEIs', e);
    showToast('خطأ في قراءة الحافظة', 'error');
  }
};

window.applyBpfColorToAll = function() {
  const color = document.getElementById('bpfApplyColor')?.value?.trim();
  if (!color) { showToast('أدخل اللون أولاً', 'warning'); return; }
  const tbody = document.getElementById('bpfDevicesBody');
  if (!tbody) return;
  const inputs = tbody.querySelectorAll('input[id^="bpfColor_"]');
  inputs.forEach(inp => { inp.value = color; });
  showToast('✅ تم تطبيق اللون على ' + inputs.length + ' جهاز', 'success');
};

window.updateBulkPurchaseFastSummary = function() {
  const tbody = document.getElementById('bpfDevicesBody');
  const costInput = document.getElementById('bpfCost');
  const paidInput = document.getElementById('bpfPaidNow');
  const countEl = document.getElementById('bpfSummaryCount');
  const totalEl = document.getElementById('bpfSummaryTotal');
  const paidEl = document.getElementById('bpfSummaryPaid');
  const remainingEl = document.getElementById('bpfSummaryRemaining');
  const totalValEl = document.getElementById('bpfSummaryTotalVal');

  let count = 0;
  if (tbody) {
    tbody.querySelectorAll('tr').forEach(r => {
      const inp = r.querySelector('input[id^="bpfImei1_"]');
      if (inp?.value?.trim()) count++;
    });
  }
  const cost = parseFloat(costInput?.value) || 0;
  const total = count * cost;
  const paid = parseFloat(paidInput?.value) || 0;
  const remaining = total - paid;

  if (countEl) countEl.textContent = count;
  if (totalEl) totalEl.textContent = fmt(total);
  if (paidEl) {
    paidEl.textContent = fmt(paid);
    paidEl.style.color = paid > 0 ? 'var(--success)' : 'var(--text-secondary)';
  }
  if (remainingEl) {
    remainingEl.textContent = fmt(remaining);
    remainingEl.style.color = remaining > 0 ? 'var(--warning)' : 'var(--success)';
  }
  if (totalValEl) totalValEl.textContent = fmt(total) + ' ج.م';
};

let isBulkPurchaseFastSubmitting = false;

async function submitBulkPurchaseFast(e) {
  e.preventDefault();
  if (isBulkPurchaseFastSubmitting) {
    showToast('جاري الحفظ... انتظر', 'warning');
    return;
  }

  let type = document.getElementById('bpfType')?.value?.trim();
  const model = document.getElementById('bpfModel')?.value?.trim();
  const cost = parseFloat(document.getElementById('bpfCost')?.value) || 0;
  if (!type) { showToast('يرجى اختيار الشركة', 'error'); return; }
  // ✅ استخدام اسم الشركة المخصص إذا كان "أخرى"
  if (type === 'Other') {
    const customType = document.getElementById('bpfCustomType')?.value?.trim();
    if (!customType) { showToast('يرجى كتابة اسم الشركة', 'error'); return; }
    type = customType;
  }
  if (!model) { showToast('يرجى إدخال الموديل', 'error'); return; }
  if (cost <= 0) { showToast('يرجى إدخال سعر الشراء', 'error'); return; }

  const tbody = document.getElementById('bpfDevicesBody');
  const devices = [];
  if (tbody) {
    tbody.querySelectorAll('tr').forEach(r => {
      const rowId = r.id?.replace('bpfRow_', '');
      if (!rowId) return;
      const imei1 = document.getElementById('bpfImei1_' + rowId)?.value?.trim();
      if (!imei1) return;
      const imei2 = document.getElementById('bpfImei2_' + rowId)?.value?.trim() || '';
      const color = document.getElementById('bpfColor_' + rowId)?.value?.trim() || 'أسود';
      const barcode = document.getElementById('bpfBarcode_' + rowId)?.value?.trim() || '';
      devices.push({ imei1, imei2, color, short_code: barcode || null });
    });
  }
  if (devices.length === 0) {
    showToast('يرجى إضافة جهاز واحد على الأقل مع IMEI', 'error');
    return;
  }

  const paymentMethod = document.getElementById('bpfPaymentMethod')?.value || 'cash';
  let totalPaid = parseFloat(document.getElementById('bpfPaidNow')?.value) || 0;
  const totalCost = devices.length * cost;

  if (paymentMethod !== 'credit' && totalPaid === 0) {
    const ok = await showPaymentWarning(
      'إجمالي التوريد: ' + fmt(totalCost) + ' ج.م\nعدد الأجهزة: ' + devices.length + '\n\nهل تريد التسجيل بدون دفع؟ سيُسجّل كامل المبلغ مستحقاً للمورد.',
      'bpfPaidNow'
    );
    if (!ok) return;
  }
  if (totalPaid > totalCost) {
    showToast('المبلغ المدفوع أكبر من الإجمالي', 'error');
    return;
  }

  const warehouseId = document.getElementById('bpfWarehouseId')?.value || null;
  const effectiveWh = warehouseId ? Number(warehouseId) : null;

  const common = {
    type,
    model,
    storage: document.getElementById('bpfStorage')?.value || '',
    ram: document.getElementById('bpfRam')?.value || '',
    battery_health: document.getElementById('bpfBattery')?.value || '',
    condition: document.getElementById('bpfCondition')?.value || 'used',
    has_box: document.getElementById('bpfBox')?.value === 'with_box' ? 'with_box' : 'without_box',
    purchase_cost: cost,
    expected_price: parseFloat(document.getElementById('bpfPrice')?.value) || 0,
    warehouse_id: effectiveWh || '',
    source: 'bulk_fast'
  };

  isBulkPurchaseFastSubmitting = true;
  const submitBtn = document.querySelector('#bulkPurchaseFastModal button[type="submit"]');
  const origText = submitBtn?.textContent;
  if (submitBtn) { submitBtn.disabled = true; submitBtn.textContent = '⏳ جاري الحفظ...'; }

  let results = [];
  try {
    showToast('⏳ جاري إضافة الأجهزة...', 'info', 2000);
    const bulkRes = await fetch('elos-db://inventory-bulk-add', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ common, devices })
    });
    const bulkData = await bulkRes.json();

    if (!bulkRes.ok || !bulkData.success) {
      throw new Error(bulkData.error || 'فشل إضافة الأجهزة');
    }

    results = bulkData.devices || bulkData.results || [];
    const supplierId = document.getElementById('bpfSupplierId')?.value || null;
    const supplierName = document.getElementById('bpfSupplierName')?.value || '';
    const supplierPhone = document.getElementById('bpfSupplierPhone')?.value || '';
    const walletType = document.getElementById('bpfWalletType')?.value || 'cash';
    const walletSelect = document.getElementById('bpfWalletSelect');
    const walletId = (walletSelect?.value && paymentMethod !== 'credit') ? parseInt(walletSelect.value) : null;

    let balanceWarning = null;
    let supplierDebt = 0;
    const savedForBarcode = [];
    let remainingPayment = totalPaid;

    for (let i = 0; i < results.length; i++) {
      const r = results[i];
      const dev = devices[i] || { imei1: r.imei1, imei2: '', color: 'أسود' };
      const paidNow = Math.min(remainingPayment, cost);
      remainingPayment -= paidNow;

      const purchasePayload = {
        device_id: r.id,
        device_type: type,
        device_model: model,
        device_storage: common.storage,
        device_color: dev.color,
        device_condition: common.condition,
        battery_health: common.battery_health || '',
        has_box: common.has_box === 'with_box' ? 'with_box' : 'without_box',
        imei1: dev.imei1,
        imei2: dev.imei2 || '',
        source_type: 'vendor',
        supplier_id: supplierId ? Number(supplierId) : null,
        party_name: supplierName,
        party_phone: supplierPhone,
        total_cost: cost,
        expected_price: common.expected_price,
        ntra_tax: 0,
        paid_now: paidNow,
        payment_method: paymentMethod,
        wallet_type: paymentMethod !== 'credit' ? walletType : null,
        wallet_id: paymentMethod !== 'credit' ? walletId : null,
        warehouse_id: effectiveWh || null,
        purchase_type: 'bulk'
      };

      const pr = await fetch('elos-db://purchase-add', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(purchasePayload)
      });
      let prJson = {};
      try { prJson = await pr.json(); } catch (_) { prJson = {}; }
      if (!pr.ok) {
        const errMsg = prJson.error || pr.statusText || 'فشل تسجيل التوريد';
        throw new Error(errMsg);
      }
      if (prJson.balanceWarning && !balanceWarning) balanceWarning = prJson.balanceWarning;
      if (i === 0 && prJson.supplierDebt > 0) supplierDebt = prJson.supplierDebt;

      savedForBarcode.push({
        id: r.id,
        type,
        model,
        storage: common.storage,
        ram: common.ram || '',
        color: dev.color,
        condition: common.condition,
        battery_health: common.battery_health || '',
        short_code: r.short_code || '',
        expected_price: common.expected_price
      });
    }

    if (balanceWarning) showToast('⚠️ ' + balanceWarning, 'warning', 5000);
    if (supplierDebt > 0) showToast('💳 تم تسجيل ' + fmt(supplierDebt) + ' ج.م مستحق لـ "' + supplierName + '"', 'info', 4000);
    showToast('✅ تم توريد ' + results.length + ' جهاز بإجمالي ' + fmt(totalCost) + ' ج.م', 'success');
    closeBulkPurchaseFastModal();
    if (typeof loadPurchases === 'function') await loadPurchases();

    if (savedForBarcode.length && typeof printBarcodeLabels === 'function') {
      const want = await showConfirm(
        '🏷️ هل تريد طباعة باركود للأجهزة الموردة؟\n\nعدد: ' + savedForBarcode.length,
        'طباعة الباركود',
        'لاحقاً',
        'info'
      );
      if (want) printBarcodeLabels(savedForBarcode, { type: 'device' });
    }
  } catch (err) {
    Logger.error('submitBulkPurchaseFast', err);
    if (results.length > 0) {
      try {
        for (const r of results) {
          const del = await fetch('elos-db://delete-device', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ id: r.id })
          });
          if (del.ok) Logger.log('[BPF] Rollback: deleted device ' + r.id);
        }
        showToast('تم التراجع عن الأجهزة المُضافة. ' + (err.message || 'خطأ في الحفظ'), 'error');
      } catch (e) {
        Logger.warn('[BPF] Rollback delete failed:', e);
        showToast('فشل تسجيل التوريد لكن الأجهزة مُضافة للمخزن. احذفها يدوياً أو أعد المحاولة. ' + (err.message || ''), 'error');
      }
    } else {
      showToast(err.message || 'خطأ في الحفظ', 'error');
    }
  } finally {
    isBulkPurchaseFastSubmitting = false;
    if (submitBtn) { submitBtn.disabled = false; submitBtn.textContent = origText || '✓ حفظ الدفعة'; }
  }
}
window.submitBulkPurchaseFast = submitBulkPurchaseFast;

// ═══════════════════════════════════════════════════════════════
// 🔧 MODAL HELPER FUNCTIONS
// ═══════════════════════════════════════════════════════════════
function toggleCustomType(select) {
  const customGroup = document.getElementById('customTypeGroup');
  if (customGroup) {
    customGroup.style.display = select.value === 'Other' ? 'block' : 'none';
  }
}
window.toggleCustomType = toggleCustomType;

function toggleBatteryField(select) {
  const batteryRow = document.getElementById('batteryRow');
  if (batteryRow) {
    const condition = select.value;
    if (condition === 'new') {
      batteryRow.style.opacity = '0.5';
    } else {
      batteryRow.style.opacity = '1';
    }
  }
}
window.toggleBatteryField = toggleBatteryField;

function toggleBatteryForApple(select) {
  const batteryRow = document.getElementById('batteryRow');
  const batteryInput = document.getElementById('quickBattery');
  const ramRow = document.getElementById('quickRamRow');
  const ramInput = document.getElementById('quickDeviceRam');

  // Apple: Show battery, Hide RAM — توافق: أيفون = بطارية 100% افتراضياً
  if (select.value === 'Apple') {
    if (batteryRow) batteryRow.style.display = 'grid';
    if (batteryInput) {
      batteryInput.placeholder = 'مثال: 87';
      batteryInput.value = '100';
    }
    if (ramRow) ramRow.style.display = 'none';
    if (ramInput) ramInput.value = '';
  } else {
    if (batteryRow) batteryRow.style.display = 'none';
    if (batteryInput) batteryInput.value = '';
    if (ramRow) ramRow.style.display = 'block';
  }
}
window.toggleBatteryForApple = toggleBatteryForApple;

function toggleSourceFields(select) {
  const partyRow = document.getElementById('partyInfoRow');
  const supplierRow = document.getElementById('supplierSelectRow');
  
  if (select.value === 'vendor') {
    // تاجر/مورد - إظهار اختيار المورد
    if (supplierRow) supplierRow.style.display = 'grid';
    if (partyRow) partyRow.style.display = 'grid';
  } else if (select.value === 'customer') {
    // عميل - إخفاء اختيار المورد
    if (supplierRow) supplierRow.style.display = 'none';
    if (partyRow) partyRow.style.display = 'grid';
    // مسح المورد المختار
    const supplierSelect = document.getElementById('quickSupplierId');
    if (supplierSelect) supplierSelect.value = '';
    const balanceInput = document.getElementById('supplierBalance');
    if (balanceInput) balanceInput.value = '';
  } else {
    // المحل - إخفاء كل شيء
    if (supplierRow) supplierRow.style.display = 'none';
    if (partyRow) partyRow.style.display = 'none';
  }
}
window.toggleSourceFields = toggleSourceFields;

// ═══════════════════════════════════════════════════════════════
// 🏦 WALLET MANAGEMENT - إدارة المحافظ
// ═══════════════════════════════════════════════════════════════
let walletBalances = { cash: 0, mobile_wallet: 0, bank: 0 };
let paymentWallets = []; // ✅ المحافظ الفعلية من قاعدة البيانات
let individualWalletBalances = []; // ✅ أرصدة المحافظ الفردية

const WALLET_CONFIG = {
  cash: { name: 'كاش سائل', icon: '💵', color: 'var(--success)' },
  mobile_wallet: { name: 'محفظة إلكترونية', icon: '📱', color: 'var(--purple)' },
  bank: { name: 'البنك', icon: '🏛️', color: 'var(--info)' }
};

// ✅ تحميل المحافظ الفعلية
async function loadPaymentWallets() {
  try {
    const res = await fetch('elos-db://payment-wallets?active_only=true');
    if (!res.ok) throw new Error(await res.text());
    paymentWallets = await res.json();
    return paymentWallets;
  } catch (error) {
    Logger.error('Failed to load payment wallets:', error);
    return [];
  }
}

// تحميل أرصدة المحافظ من الخزنة
async function loadWalletBalances() {
  try {
    const res = await fetch('elos-db://safe-balance');
    if (!res.ok) throw new Error(await res.text());
    const data = await res.json();

    // ✅ دعم النظام الجديد: wallets array
    if (data.wallets && Array.isArray(data.wallets)) {
      individualWalletBalances = data.wallets;
      // حساب الأرصدة المجمعة حسب النوع (للتوافق العكسي)
      walletBalances = { cash: 0, mobile_wallet: 0, bank: 0 };
      data.wallets.forEach(w => {
        const balance = Number(w.balance || 0);
        if (w.type === 'cash') walletBalances.cash += balance;
        else if (w.type === 'mobile_wallet') walletBalances.mobile_wallet += balance;
        else if (w.type === 'bank') walletBalances.bank += balance;
      });
    } 
    // ✅ دعم النظام القديم: wallets object
    else if (data.wallets && typeof data.wallets === 'object') {
      walletBalances.cash = Number(data.wallets.cash?.balance || 0);
      walletBalances.mobile_wallet = Number(data.wallets.mobile_wallet?.balance || 0);
      walletBalances.bank = Number(data.wallets.bank?.balance || 0);
    }

    Logger.log('[WALLETS] Loaded balances:', walletBalances);
    return walletBalances;
  } catch (error) {
    Logger.error('[WALLETS] Load error:', error);
    return walletBalances;
  }
}

// ✅ تحديث قائمة المحافظ حسب النوع
async function updatePurchaseWalletsList(prefix) {
  const walletTypeSelect = document.getElementById(`${prefix}WalletType`);
  const walletSelectGroup = document.getElementById(`${prefix}WalletSelectGroup`);
  const walletSelect = document.getElementById(`${prefix}WalletSelect`);
  
  if (!walletTypeSelect || !walletSelectGroup || !walletSelect) return;
  
  const walletType = walletTypeSelect.value;
  
  // Load wallets if not already loaded
  if (paymentWallets.length === 0) {
    await loadPaymentWallets();
  }
  
  // Filter wallets by type
  const filteredWallets = paymentWallets.filter(w => w.type === walletType);
  
  if (filteredWallets.length === 0) {
    walletSelectGroup.style.display = 'none';
    walletSelect.innerHTML = '<option value="">لا توجد محافظ متاحة</option>';
    // تحديث الرصيد المجمع
    updateWalletBalanceDisplay(prefix);
    return;
  }
  
  // Show the select and populate options
  walletSelectGroup.style.display = 'block';
  walletSelect.innerHTML = filteredWallets.map(w => {
    const isDefault = w.is_default ? ' (افتراضي)' : '';
    const displayName = w.name + isDefault;
    return `<option value="${w.id}" ${w.is_default ? 'selected' : ''}>${displayName}</option>`;
  }).join('');
  
  // تحديث الرصيد بعد اختيار المحفظة
  updateWalletBalanceDisplay(prefix);
}

// تحديث عرض رصيد المحفظة المختارة
function updateWalletBalanceDisplay(prefix) {
  const walletTypeSelect = document.getElementById(`${prefix}WalletType`);
  const walletSelect = document.getElementById(`${prefix}WalletSelect`);
  const balanceInput = document.getElementById(`${prefix}WalletBalance`);

  if (!walletTypeSelect || !balanceInput) return;

  const walletType = walletTypeSelect.value;
  let balance = 0;
  
  // ✅ إذا كان هناك محفظة محددة (wallet_id)
  if (walletSelect && walletSelect.value && individualWalletBalances.length > 0) {
    const walletId = parseInt(walletSelect.value);
    const wallet = individualWalletBalances.find(w => w.id == walletId);
    if (wallet) {
      balance = Number(wallet.balance || 0);
    }
  } else {
    // استخدام الرصيد المجمع حسب النوع (للتوافق العكسي)
    balance = walletBalances[walletType] || 0;
  }
  
  const config = WALLET_CONFIG[walletType];

  balanceInput.value = `${fmt(balance)} ج.م`;
  balanceInput.style.color = balance > 0 ? config.color : 'var(--danger)';
}

// إخفاء/إظهار صف المحفظة حسب طريقة الدفع
async function toggleWalletSelect(prefix) {
  const paymentMethod = document.getElementById(`${prefix}PaymentMethod`)?.value;
  const walletRow = document.getElementById(`${prefix}WalletRow`);
  const walletGroup = document.getElementById(`${prefix}WalletGroup`);

  // إخفاء للآجل، إظهار للدفع الفوري
  if (paymentMethod === 'credit') {
    if (walletRow) walletRow.style.display = 'none';
    if (walletGroup) walletGroup.style.display = 'none';
  } else {
    if (walletRow) walletRow.style.display = 'grid';
    if (walletGroup) walletGroup.style.display = 'block';
    // ✅ تحديث قائمة المحافظ حسب النوع
    await updatePurchaseWalletsList(prefix);
  }
}
window.toggleWalletSelect = toggleWalletSelect;

// إعداد أحداث تغيير المحفظة
function setupWalletEvents(prefix) {
  const walletSelect = document.getElementById(`${prefix}WalletType`);
  if (walletSelect) {
    walletSelect.addEventListener('change', () => updateWalletBalanceDisplay(prefix));
    // تحديث أولي
    updateWalletBalanceDisplay(prefix);
  }
}

// ═══════════════════════════════════════════════════════════════
// 🚚 SUPPLIERS MANAGEMENT
// ═══════════════════════════════════════════════════════════════
async function loadSuppliers() {
  try {
    const res = await fetch('elos-db://suppliers');
    if (!res.ok) throw new Error(await res.text());
    allSuppliers = await res.json();
    Logger.log('[SUPPLIERS] Loaded:', allSuppliers.length);
    return allSuppliers;
  } catch (error) {
    Logger.error('[SUPPLIERS] Load error:', error);
    return [];
  }
}

function populateSupplierDropdowns() {
  const dropdowns = ['quickSupplierId', 'bulkSupplierId', 'bpfSupplierId'];
  
  dropdowns.forEach(id => {
    const select = document.getElementById(id);
    if (!select) return;
    
    // حفظ القيمة الحالية
    const currentValue = select.value;
    
    // مسح وإعادة ملء
    select.innerHTML = '<option value="">-- مورد جديد --</option>';
    
    allSuppliers.forEach(s => {
      const balance = Number(s.balance) || 0;
      // المورد: balance > 0 = ليه فلوس عندنا (مستحق له)، balance < 0 = عليه فلوس لينا
      const balanceText = balance > 0 ? ` (مستحق له: ${fmt(balance)})` : balance < 0 ? ` (له عندنا: ${fmt(Math.abs(balance))})` : '';
      const option = document.createElement('option');
      option.value = s.id;
      option.textContent = `${s.name}${balanceText}`;
      option.dataset.phone = s.phone || '';
      option.dataset.balance = balance;
      select.appendChild(option);
    });
    
    // إعادة القيمة
    if (currentValue) select.value = currentValue;
  });
}

function handleSupplierSelect(select) {
  const selectedOption = select.options[select.selectedIndex];
  const supplierId = select.value;
  
  const nameInput = document.getElementById('quickPartyName');
  const phoneInput = document.getElementById('quickPartyPhone');
  const balanceInput = document.getElementById('supplierBalance');
  
  if (supplierId && selectedOption) {
    // مورد موجود - ملء البيانات
    const supplier = allSuppliers.find(s => s.id == supplierId);
    if (supplier) {
      if (nameInput) nameInput.value = supplier.name || '';
      if (phoneInput) phoneInput.value = supplier.phone || '';
      if (balanceInput) {
        const balance = Number(supplier.balance) || 0;
        // المورد: balance > 0 = مستحق له (نحن مديونين له) - أخضر، balance < 0 = له عندنا فائض
        const label = balance > 0 ? 'مستحق له: ' : balance < 0 ? 'له عندنا: ' : '';
        balanceInput.value = label + fmt(Math.abs(balance)) + ' ج.م';
        balanceInput.style.color = balance > 0 ? 'var(--warning)' : balance < 0 ? 'var(--success)' : 'var(--text-primary)';
      }
      // جعل الحقول للقراءة فقط
      if (nameInput) nameInput.readOnly = true;
      if (phoneInput) phoneInput.readOnly = true;
    }
  } else {
    // مورد جديد - تفريغ وتفعيل الحقول
    if (nameInput) { nameInput.value = ''; nameInput.readOnly = false; }
    if (phoneInput) { phoneInput.value = ''; phoneInput.readOnly = false; }
    if (balanceInput) { balanceInput.value = ''; balanceInput.style.color = ''; }
  }
}
window.handleSupplierSelect = handleSupplierSelect;

function handleBulkSupplierSelect(select) {
  const supplierId = select.value;
  
  const nameInput = document.getElementById('bulkSupplierName');
  const phoneInput = document.getElementById('bulkSupplierPhone');
  const balanceInput = document.getElementById('bulkSupplierBalance');
  
  if (supplierId) {
    const supplier = allSuppliers.find(s => s.id == supplierId);
    if (supplier) {
      if (nameInput) nameInput.value = supplier.name || '';
      if (phoneInput) phoneInput.value = supplier.phone || '';
      if (balanceInput) {
        const balance = Number(supplier.balance) || 0;
        // المورد: balance > 0 = مستحق له (نحن مديونين له)، balance < 0 = له عندنا فائض
        const label = balance > 0 ? 'مستحق له: ' : balance < 0 ? 'له عندنا: ' : '';
        balanceInput.value = label + fmt(Math.abs(balance)) + ' ج.م';
        balanceInput.style.color = balance > 0 ? 'var(--warning)' : balance < 0 ? 'var(--success)' : 'var(--text-primary)';
      }
      if (nameInput) nameInput.readOnly = true;
      if (phoneInput) phoneInput.readOnly = true;
    }
  } else {
    if (nameInput) { nameInput.value = ''; nameInput.readOnly = false; }
    if (phoneInput) { phoneInput.value = ''; phoneInput.readOnly = false; }
    if (balanceInput) { balanceInput.value = ''; balanceInput.style.color = ''; }
  }
}
window.handleBulkSupplierSelect = handleBulkSupplierSelect;

function handleBpfSupplierSelect(select) {
  const supplierId = select.value;
  const nameInput = document.getElementById('bpfSupplierName');
  const phoneInput = document.getElementById('bpfSupplierPhone');
  const balanceInput = document.getElementById('bpfSupplierBalance');
  if (!nameInput || !phoneInput || !balanceInput) return;
  if (supplierId) {
    const supplier = allSuppliers.find(s => s.id == supplierId);
    if (supplier) {
      nameInput.value = supplier.name || '';
      phoneInput.value = supplier.phone || '';
      const balance = Number(supplier.balance) || 0;
      const label = balance > 0 ? 'مستحق له: ' : balance < 0 ? 'له عندنا: ' : '';
      balanceInput.value = label + fmt(Math.abs(balance)) + ' ج.م';
      balanceInput.style.color = balance > 0 ? 'var(--warning)' : balance < 0 ? 'var(--success)' : 'var(--text-primary)';
      nameInput.readOnly = true;
      phoneInput.readOnly = true;
    }
  } else {
    nameInput.value = '';
    phoneInput.value = '';
    balanceInput.value = '';
    balanceInput.style.color = '';
    nameInput.readOnly = false;
    phoneInput.readOnly = false;
  }
}
window.handleBpfSupplierSelect = handleBpfSupplierSelect;

function updateQuickSummary() {
  const cost = parseFloat(document.getElementById('quickCost')?.value) || 0;
  const tax = parseFloat(document.getElementById('quickNtraTax')?.value) || 0;
  const paid = parseFloat(document.getElementById('quickPaidNow')?.value) || 0;
  const expected = parseFloat(document.getElementById('quickExpectedPrice')?.value) || 0;
  
  // الضريبة منفصلة - التكلفة بدون ضريبة
  // الربح = سعر البيع المتوقع - تكلفة الشراء (الضريبة الزبون بيدفعها)
  const remaining = cost - paid;
  const profit = expected - cost;
  
  const el = (id) => document.getElementById(id);
  if (el('summaryQuickCost')) el('summaryQuickCost').textContent = fmt(cost);
  if (el('summaryQuickTax')) el('summaryQuickTax').textContent = fmt(tax);
  if (el('summaryQuickRemaining')) {
    el('summaryQuickRemaining').textContent = fmt(remaining);
    el('summaryQuickRemaining').style.color = remaining > 0 ? 'var(--warning)' : 'var(--success)';
  }
  if (el('summaryQuickProfit')) {
    el('summaryQuickProfit').textContent = fmt(profit);
    el('summaryQuickProfit').style.color = profit >= 0 ? 'var(--success)' : 'var(--danger)';
  }
  if (el('summaryQuickTotal')) el('summaryQuickTotal').textContent = fmt(cost) + ' ج.م';
}
window.updateQuickSummary = updateQuickSummary;

// ═══════════════════════════════════════════════════════════════
// 📱 BULK DEVICES MANAGEMENT
// ═══════════════════════════════════════════════════════════════
function addBulkDevice() {
  deviceCounter++;
  bulkDevices.push({
    id: deviceCounter,
    type: '',
    customType: '',
    model: '',
    storage: '',
    ram: '',
    color: '',
    condition: 'used',
    battery: '',
    box: 'without_box',
    imei1: '',
    imei2: '',
    cost: 0,
    price: 0,
    tax: 0
  });
  renderBulkDevicesList();
}
window.addBulkDevice = addBulkDevice;

function removeBulkDevice(id) {
  bulkDevices = bulkDevices.filter(d => d.id !== id);
  renderBulkDevicesList();
}
window.removeBulkDevice = removeBulkDevice;

function updateBulkDevice(id, field, value) {
  const device = bulkDevices.find(d => d.id === id);
  if (device) {
    device[field] = value;
    updateBulkSummary();
  }
}
window.updateBulkDevice = updateBulkDevice;

function renderBulkDevicesList() {
  const container = document.getElementById('bulkDevicesList');
  if (!container) return;

  if (bulkDevices.length === 0) {
    container.innerHTML = '<div class="empty-devices">اضغط "إضافة جهاز" للبدء</div>';
    updateBulkSummary();
    return;
  }

  container.innerHTML = bulkDevices.map((dev, idx) => {
    const showBattery = dev.type === 'Apple';
    const showRam = dev.type && dev.type !== 'Apple' && dev.type !== 'Other';
    const showCustomType = dev.type === 'Other';
    return `
    <div class="bulk-device-card">
      <div class="device-card-header">
        <span class="device-number">📱 جهاز ${idx + 1}</span>
        <button type="button" class="btn-remove-device" onclick="removeBulkDevice(${dev.id})">🗑️</button>
      </div>
      <div class="device-card-body">
        <!-- Row 1: Company, Custom Type / Model, Storage, Color -->
        <div class="device-row">
          <select class="form-select" onchange="updateBulkDevice(${dev.id}, 'type', this.value); renderBulkDevicesList();">
            <option value="">📱 الشركة</option>
            <option value="Apple" ${dev.type === 'Apple' ? 'selected' : ''}>Apple</option>
            <option value="Samsung" ${dev.type === 'Samsung' ? 'selected' : ''}>Samsung</option>
            <option value="Oppo" ${dev.type === 'Oppo' ? 'selected' : ''}>Oppo</option>
            <option value="Xiaomi" ${dev.type === 'Xiaomi' ? 'selected' : ''}>Xiaomi</option>
            <option value="Huawei" ${dev.type === 'Huawei' ? 'selected' : ''}>Huawei</option>
            <option value="Realme" ${dev.type === 'Realme' ? 'selected' : ''}>Realme</option>
            <option value="Vivo" ${dev.type === 'Vivo' ? 'selected' : ''}>Vivo</option>
            <option value="Other" ${dev.type === 'Other' ? 'selected' : ''}>أخرى</option>
          </select>
          ${showCustomType ? `<input type="text" class="form-input" value="${dev.customType || ''}" placeholder="🏷️ اسم الشركة *" onchange="updateBulkDevice(${dev.id}, 'customType', this.value)">` : ''}
          <input type="text" class="form-input" value="${dev.model}" placeholder="📲 الموديل *" onchange="updateBulkDevice(${dev.id}, 'model', this.value)">
          <select class="form-select" onchange="updateBulkDevice(${dev.id}, 'storage', this.value)">
            <option value="">💾 المساحة</option>
            <option value="32GB" ${dev.storage === '32GB' ? 'selected' : ''}>32GB</option>
            <option value="64GB" ${dev.storage === '64GB' ? 'selected' : ''}>64GB</option>
            <option value="128GB" ${dev.storage === '128GB' ? 'selected' : ''}>128GB</option>
            <option value="256GB" ${dev.storage === '256GB' ? 'selected' : ''}>256GB</option>
            <option value="512GB" ${dev.storage === '512GB' ? 'selected' : ''}>512GB</option>
            <option value="1TB" ${dev.storage === '1TB' ? 'selected' : ''}>1TB</option>
          </select>
          ${showRam ? `
          <select class="form-select" onchange="updateBulkDevice(${dev.id}, 'ram', this.value)">
            <option value="">🧠 الرام</option>
            <option value="2GB" ${dev.ram === '2GB' ? 'selected' : ''}>2GB</option>
            <option value="3GB" ${dev.ram === '3GB' ? 'selected' : ''}>3GB</option>
            <option value="4GB" ${dev.ram === '4GB' ? 'selected' : ''}>4GB</option>
            <option value="6GB" ${dev.ram === '6GB' ? 'selected' : ''}>6GB</option>
            <option value="8GB" ${dev.ram === '8GB' ? 'selected' : ''}>8GB</option>
            <option value="12GB" ${dev.ram === '12GB' ? 'selected' : ''}>12GB</option>
            <option value="16GB" ${dev.ram === '16GB' ? 'selected' : ''}>16GB</option>
          </select>
          ` : ''}
          <input type="text" class="form-input" value="${dev.color || ''}" placeholder="🎨 اللون" onchange="updateBulkDevice(${dev.id}, 'color', this.value)">
        </div>
        <!-- Row 2: Condition, Box, Battery (for Apple), IMEI -->
        <div class="device-row">
          <select class="form-select" onchange="updateBulkDevice(${dev.id}, 'condition', this.value)">
            <option value="new" ${dev.condition === 'new' ? 'selected' : ''}>⚙️ جديد</option>
            <option value="like_new" ${dev.condition === 'like_new' ? 'selected' : ''}>⚙️ كالجديد</option>
            <option value="used" ${dev.condition === 'used' ? 'selected' : ''}>⚙️ مستعمل</option>
            <option value="faulty" ${dev.condition === 'faulty' ? 'selected' : ''}>⚙️ عاطل</option>
          </select>
          <select class="form-select" onchange="updateBulkDevice(${dev.id}, 'box', this.value)">
            <option value="without_box" ${dev.box === 'without_box' ? 'selected' : ''}>📦 بدون علبة</option>
            <option value="with_box" ${dev.box === 'with_box' ? 'selected' : ''}>📦 بعلبة</option>
          </select>
          ${showBattery ? `<input type="number" class="form-input" value="${dev.battery || ''}" min="0" max="100" placeholder="🔋 البطارية %" onchange="updateBulkDevice(${dev.id}, 'battery', this.value)">` : ''}
          <input type="text" class="form-input" value="${dev.imei1 || ''}" placeholder="🔢 IMEI 1" style="font-family:monospace;" onchange="updateBulkDevice(${dev.id}, 'imei1', this.value)">
          <input type="text" class="form-input" value="${dev.imei2 || ''}" placeholder="🔢 IMEI 2" style="font-family:monospace;" onchange="updateBulkDevice(${dev.id}, 'imei2', this.value)">
        </div>
        <!-- Row 3: Cost, Expected Price, Tax -->
        <div class="device-row">
          <input type="number" class="form-input" value="${dev.cost || ''}" placeholder="💵 التكلفة *" min="0" step="0.01" onchange="updateBulkDevice(${dev.id}, 'cost', parseFloat(this.value) || 0)" style="flex:1.5;">
          <input type="number" class="form-input" value="${dev.price || ''}" placeholder="🏷️ سعر البيع المتوقع *" min="0" step="0.01" onchange="updateBulkDevice(${dev.id}, 'price', parseFloat(this.value) || 0)" style="flex:1.5;">
          <input type="number" class="form-input" value="${dev.tax || ''}" placeholder="🏛️ ضريبة NTRA" min="0" step="0.01" onchange="updateBulkDevice(${dev.id}, 'tax', parseFloat(this.value) || 0)">
        </div>
      </div>
    </div>
  `;}).join('');

  updateBulkSummary();
}

function updateBulkSummary() {
  const count = bulkDevices.length;
  const totalCost = bulkDevices.reduce((sum, d) => sum + (parseFloat(d.cost) || 0), 0);
  const totalTax = bulkDevices.reduce((sum, d) => sum + (parseFloat(d.tax) || 0), 0);
  const paidNow = parseFloat(document.getElementById('bulkPaidNow')?.value) || 0;
  const remaining = totalCost - paidNow;

  // الإجمالي = التكلفة فقط (الضريبة منفصلة - الزبون بيدفعها)

  const el = (id) => document.getElementById(id);
  if (el('summaryBulkCount')) el('summaryBulkCount').textContent = count;
  if (el('summaryBulkTax')) el('summaryBulkTax').textContent = fmt(totalTax) + ' (منفصلة)';
  if (el('summaryBulkPaid')) {
    el('summaryBulkPaid').textContent = fmt(paidNow);
    el('summaryBulkPaid').style.color = paidNow > 0 ? 'var(--success)' : 'var(--text-secondary)';
  }
  if (el('summaryBulkRemaining')) {
    el('summaryBulkRemaining').textContent = fmt(remaining);
    el('summaryBulkRemaining').style.color = remaining > 0 ? 'var(--warning)' : 'var(--success)';
  }
  if (el('summaryBulkTotal')) el('summaryBulkTotal').textContent = fmt(totalCost) + ' ج.م';
}

// ═══════════════════════════════════════════════════════════════
// 💾 HANDLE QUICK DEVICE SUBMIT (NEW)
// ═══════════════════════════════════════════════════════════════
async function handleQuickDeviceSubmit(e) {
  e.preventDefault();

  // ═══════════════════════════════════════════════════════════════
  // 🔒 DOUBLE-SUBMIT PROTECTION - منع تكرار التوريد
  // ═══════════════════════════════════════════════════════════════
  if (isQuickPurchaseSubmitting) {
    Logger.warn('[QUICK PURCHASE] Submit already in progress, ignoring duplicate request');
    showToast('جاري حفظ التوريد... انتظر لحظة', 'warning');
    return;
  }

  isQuickPurchaseSubmitting = true;

  // الحصول على زر الحفظ وتعطيله
  const submitBtn = document.querySelector('#quickPurchaseModal .btn-primary, #quickPurchaseModal button[type="submit"]');
  const originalBtnText = submitBtn?.textContent || 'حفظ';
  if (submitBtn) {
    submitBtn.disabled = true;
    submitBtn.textContent = '⏳ جاري الحفظ...';
    submitBtn.style.opacity = '0.7';
  }

  try {
    // ═══════════════════════════════════════════════════════════════
    // ✅ VALIDATION - التحقق من الحقول المطلوبة
    // ═══════════════════════════════════════════════════════════════
    let deviceType = document.getElementById('quickDeviceType').value;
    if (!deviceType) throw new Error('يجب اختيار الشركة');

    if (deviceType === 'Other') {
      deviceType = document.getElementById('quickCustomType')?.value?.trim() || '';
      if (!deviceType) throw new Error('يجب كتابة اسم الشركة');
    }

    const model = document.getElementById('quickDeviceModel').value.trim();
    if (!model) throw new Error('الموديل مطلوب');

    const cost = parseFloat(document.getElementById('quickCost').value) || 0;
    if (cost <= 0) throw new Error('تكلفة الشراء مطلوبة ويجب أن تكون أكبر من صفر');

    const expectedPrice = parseFloat(document.getElementById('quickExpectedPrice').value) || 0;
    if (expectedPrice <= 0) throw new Error('سعر البيع المتوقع مطلوب');

    // ═══════════════════════════════════════════════════════════════
    // 💰 PAYMENT VALIDATION - التحقق من المبلغ المدفوع
    // ═══════════════════════════════════════════════════════════════
    const paidNowInput = document.getElementById('quickPaidNow');
    const paymentMethod = document.getElementById('quickPaymentMethod').value;
    let paidNow = parseFloat(paidNowInput?.value) || 0;

    // لو طريقة الدفع مش آجل ومحدش كتب المبلغ المدفوع
    if (paymentMethod !== 'credit' && paidNow === 0) {
      const confirmNoPay = await showPaymentWarning(
        `تكلفة الجهاز: ${fmt(cost)} ج.م\n\n` +
        `هل تريد تسجيل التوريد بدون دفع أي مبلغ؟\n` +
        `سيتم تسجيل كامل المبلغ كمستحق للمورد.`,
        'quickPaidNow'
      );
      if (!confirmNoPay) {
        return; // المستخدم اختار الرجوع لإدخال المبلغ
      }
    }

    // التحقق من أن المبلغ المدفوع لا يتجاوز التكلفة
    if (paidNow > cost) {
      throw new Error(`المبلغ المدفوع (${fmt(paidNow)}) أكبر من التكلفة (${fmt(cost)})`);
    }
    
    // الضريبة منفصلة - من تفاصيل الجهاز مش من التكلفة
    const ntraTax = parseFloat(document.getElementById('quickNtraTax').value) || 0;
    
    // Build device object - استخدام نفس أسماء الحقول الموجودة في المخزن
    const boxValue = document.getElementById('quickBox').value;
    const warehouseId = document.getElementById('quickWarehouseId')?.value || null;
    const device = {
      type: deviceType,
      model: model,
      storage: document.getElementById('quickDeviceStorage').value,
      ram: document.getElementById('quickDeviceRam').value,
      color: document.getElementById('quickDeviceColor').value,
      condition: document.getElementById('quickDeviceCondition').value,
      battery_health: document.getElementById('quickBattery')?.value || '',
      has_box: boxValue === 'with_box',
      imei1: document.getElementById('quickImei1').value.trim(),
      imei2: document.getElementById('quickImei2').value.trim(),
      purchase_cost: cost,
      expected_price: expectedPrice,
      ntra_tax: ntraTax,
      warehouse_id: warehouseId ? Number(warehouseId) : null, // ✅ إضافة warehouse_id
      notes: document.getElementById('quickNotes').value
    };
    
    Logger.log('[DEVICE] Sending to inventory:', device);

    // ═══════════════════════════════════════════════════════════════
    // 🚫 IMEI CHECK - التحقق من IMEI قبل الإضافة
    // ═══════════════════════════════════════════════════════════════
    if (device.imei1 && device.imei1.length >= 10) {
      try {
        const checkRes = await fetch(`elos-db://check-imei/${device.imei1}`);
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

          // ✅ استخدام showConfirm بدلاً من confirm لتجنب تجمد الـ inputs
          const proceed = await showConfirm(warningMessages + '\n\nهل تريد المتابعة رغم ذلك؟', 'متابعة', 'إلغاء', 'warning');
          if (!proceed) {
            showToast('تم إلغاء التوريد', 'info');
            return;
          }
        }
      } catch (e) {
        Logger.warn('[IMEI CHECK] Error:', e);
      }
    }

    if (device.imei2 && device.imei2.length >= 10 && device.imei2 !== device.imei1) {
      try {
        const checkRes = await fetch(`elos-db://check-imei/${device.imei2}`);
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

          // ✅ استخدام showConfirm بدلاً من confirm لتجنب تجمد الـ inputs
          const proceed = await showConfirm(warningMessages + '\n\nهل تريد المتابعة رغم ذلك؟', 'متابعة', 'إلغاء', 'warning');
          if (!proceed) {
            showToast('تم إلغاء التوريد', 'info');
            return;
          }
        }
      } catch (e) {
        Logger.warn('[IMEI CHECK] Error:', e);
      }
    }

    // Add device to inventory
    const deviceRes = await fetch('elos-db://inventory-add', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(device)
    });
    
    if (!deviceRes.ok) throw new Error(await deviceRes.text());
    const deviceResult = await deviceRes.json();
    
    // Create purchase record - التكلفة بدون الضريبة
    // Note: 'store' is converted to 'vendor' for database constraint
    let sourceType = document.getElementById('quickSourceType').value;
    if (sourceType === 'store') sourceType = 'vendor'; // DB constraint fix

    // الحصول على المورد المختار
    const supplierId = document.getElementById('quickSupplierId')?.value || null;
    // paidNow تم تعريفها في validation section
    const remainingAmount = cost - paidNow;
    
    // ✅ الحصول على المحفظة المختارة للدفع (wallet_id و wallet_type)
    const walletType = document.getElementById('quickWalletType')?.value || 'cash';
    const walletSelect = document.getElementById('quickWalletSelect');
    const walletId = (walletSelect && walletSelect.value && paymentMethod !== 'credit') 
      ? parseInt(walletSelect.value) : null;

    const purchase = {
      device_id: deviceResult.id,
      device_type: deviceType,
      device_model: model,
      device_color: device.color,
      device_storage: device.storage,
      device_condition: device.condition,
      battery_health: device.battery_health,
      has_box: device.has_box ? 'with_box' : 'without_box',
      imei1: device.imei1,
      imei2: device.imei2,
      source_type: sourceType,
      supplier_id: supplierId ? Number(supplierId) : null,
      party_name: document.getElementById('quickPartyName')?.value || '',
      party_phone: document.getElementById('quickPartyPhone')?.value || '',
      total_cost: cost,
      ntra_tax: ntraTax,
      expected_price: expectedPrice,
      paid_now: paidNow,
      remaining_amount: remainingAmount, // المبلغ المتبقي للمورد
      payment_method: paymentMethod,
      wallet_type: paymentMethod !== 'credit' ? walletType : null, // للتوافق العكسي
      wallet_id: paymentMethod !== 'credit' ? walletId : null, // ✅ المحفظة المحددة
      warehouse_id: warehouseId ? Number(warehouseId) : null, // ✅ إضافة warehouse_id للتوريد
      notes: device.notes,
      purchase_type: 'quick'
    };
    
    Logger.log('[PURCHASE] Sending purchase data:', purchase);
    
    const purchaseRes = await fetch('elos-db://purchase-add', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(purchase)
    });

    if (!purchaseRes.ok) {
      const errText = await purchaseRes.text();
      // تراجع: حذف الجهاز المُضاف لأن تسجيل التوريد فشل (تجنب تكرار IMEI عند إعادة المحاولة)
      try {
        const del = await fetch('elos-db://delete-device', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id: deviceResult.id })
        });
        if (del.ok) Logger.log('[QUICK] Rollback: device deleted after purchase-add failure');
        else Logger.warn('[QUICK] Rollback delete-device failed:', await del.text());
      } catch (e) { Logger.warn('[QUICK] Rollback delete-device error:', e); }
      throw new Error(errText);
    }

    const purchaseResult = await purchaseRes.json();
    
    // عرض تحذير الرصيد لو موجود
    if (purchaseResult.balanceWarning) {
      showToast(`⚠️ ${purchaseResult.balanceWarning}`, 'warning', 5000);
    }
    
    // عرض رسالة المستحق للمورد
    if (purchaseResult.supplierDebt > 0) {
      const partyName = document.getElementById('quickPartyName')?.value || 'المورد';
      showToast(`💳 تم تسجيل ${fmt(purchaseResult.supplierDebt)} ج.م مستحق لـ "${partyName}"`, 'info', 4000);
    }

    showToast(`✅ تم توريد "${deviceType} ${model}" بنجاح`, 'success');
    closeQuickPurchaseModal();
    await loadPurchases();

    // ═══════════════════════════════════════════════════════════════
    // 🏷️ سؤال المستخدم عن طباعة الباركود
    // ═══════════════════════════════════════════════════════════════
    if (typeof showBarcodePreviewModal === 'function') {
      // استخدام short_code الجديد (6 أرقام) من نتيجة الإضافة
      const shortCode = deviceResult.short_code || deviceResult.shortCode || '';
      
      const deviceForBarcode = {
        id: deviceResult.id,
        type: deviceType,
        model: model,
        storage: device.storage,
        ram: device.ram || '',
        color: device.color,
        condition: device.condition,
        battery_health: device.battery_health || '',
        short_code: shortCode, // الباركود القصير الجديد
        expected_price: expectedPrice
      };

      // سؤال المستخدم
      const wantPrint = await showConfirm(
        `🏷️ هل تريد طباعة باركود للجهاز؟\n\n📱 ${deviceType} ${model}\n💾 ${device.storage || ''} 🎨 ${device.color || ''}\n🏷️ كود: ${shortCode}`,
        'طباعة باركود', 'لاحقاً', 'info'
      );

      if (wantPrint) {
        showBarcodePreviewModal(deviceForBarcode, 'device');
      }
    }

  } catch (error) {
    Logger.error('[QUICK DEVICE] Error:', error);
    showToast(error.message, 'error');
  } finally {
    // ═══════════════════════════════════════════════════════════════
    // 🔓 إعادة تفعيل الزر وإزالة حماية التكرار
    // ═══════════════════════════════════════════════════════════════
    isQuickPurchaseSubmitting = false;
    const submitBtn = document.querySelector('#quickPurchaseModal .btn-primary, #quickPurchaseModal button[type="submit"]');
    if (submitBtn) {
      submitBtn.disabled = false;
      submitBtn.textContent = '💾 حفظ التوريد';
      submitBtn.style.opacity = '1';
    }
  }
}
window.handleQuickDeviceSubmit = handleQuickDeviceSubmit;

// ═══════════════════════════════════════════════════════════════
// 💾 HANDLE BULK DEVICE SUBMIT (NEW)
// ═══════════════════════════════════════════════════════════════
async function handleBulkDeviceSubmit(e) {
  e.preventDefault();

  // ═══════════════════════════════════════════════════════════════
  // 🔒 DOUBLE-SUBMIT PROTECTION - منع تكرار التوريد المتعدد
  // ═══════════════════════════════════════════════════════════════
  if (isBulkPurchaseSubmitting) {
    Logger.warn('[BULK PURCHASE] Submit already in progress, ignoring duplicate request');
    showToast('جاري حفظ التوريد... انتظر لحظة', 'warning');
    return;
  }

  isBulkPurchaseSubmitting = true;

  // الحصول على زر الحفظ وتعطيله
  const submitBtn = document.querySelector('#bulkPurchaseModal .btn-primary, #bulkPurchaseModal button[type="submit"]');
  const originalBtnText = submitBtn?.textContent || 'حفظ';
  if (submitBtn) {
    submitBtn.disabled = true;
    submitBtn.textContent = '⏳ جاري الحفظ...';
    submitBtn.style.opacity = '0.7';
  }

  try {
    // ═══════════════════════════════════════════════════════════════
    // ✅ VALIDATION - التحقق من الأجهزة المضافة
    // ═══════════════════════════════════════════════════════════════
    if (bulkDevices.length === 0) throw new Error('يجب إضافة جهاز واحد على الأقل');

    // التحقق من صحة بيانات كل جهاز
    for (let i = 0; i < bulkDevices.length; i++) {
      const dev = bulkDevices[i];
      if (!dev.type) throw new Error(`جهاز ${i + 1}: يجب اختيار الشركة`);
      if (dev.type === 'Other' && !dev.customType) throw new Error(`جهاز ${i + 1}: يجب كتابة اسم الشركة`);
      if (!dev.model) throw new Error(`جهاز ${i + 1}: يجب إدخال الموديل`);
      if (!dev.cost || parseFloat(dev.cost) <= 0) throw new Error(`جهاز ${i + 1}: يجب إدخال تكلفة الشراء`);
      if (!dev.price || parseFloat(dev.price) <= 0) throw new Error(`جهاز ${i + 1}: يجب إدخال سعر البيع المتوقع`);
    }

    const supplierId = document.getElementById('bulkSupplierId')?.value || null;
    const supplierName = document.getElementById('bulkSupplierName')?.value || '';
    const supplierPhone = document.getElementById('bulkSupplierPhone')?.value || '';
    const paymentMethod = document.getElementById('bulkPaymentMethod')?.value || 'cash';
    const walletType = document.getElementById('bulkWalletType')?.value || 'cash';
    // ✅ قراءة المحفظة المحددة (كان ناقص وبيسبب خطأ غير معروف)
    const walletSelect = document.getElementById('bulkWalletSelect');
    const walletId = (walletSelect?.value && paymentMethod !== 'credit') ? parseInt(walletSelect.value) : null;

    // حساب إجمالي التكلفة أولاً
    let totalCost = 0;
    for (const dev of bulkDevices) {
      if (!dev.model) continue;
      totalCost += parseFloat(dev.cost) || 0;
    }

    // ═══════════════════════════════════════════════════════════════
    // 💰 PAYMENT VALIDATION - التحقق من المبلغ المدفوع
    // ═══════════════════════════════════════════════════════════════
    const paidNowInput = document.getElementById('bulkPaidNow');
    let totalPaid = parseFloat(paidNowInput?.value) || 0;

    // لو طريقة الدفع مش آجل ومحدش كتب المبلغ المدفوع
    if (paymentMethod !== 'credit' && totalPaid === 0) {
      const confirmNoPay = await showPaymentWarning(
        `إجمالي الفاتورة: ${fmt(totalCost)} ج.م\n` +
        `عدد الأجهزة: ${bulkDevices.length}\n\n` +
        `هل تريد تسجيل التوريد بدون دفع أي مبلغ؟\n` +
        `سيتم تسجيل كامل المبلغ كمستحق للمورد.`,
        'bulkPaidNow'
      );
      if (!confirmNoPay) {
        return; // المستخدم اختار الرجوع لإدخال المبلغ
      }
    }

    // التحقق من أن المبلغ المدفوع لا يتجاوز التكلفة
    if (totalPaid > totalCost) {
      throw new Error(`المبلغ المدفوع (${fmt(totalPaid)}) أكبر من إجمالي التكلفة (${fmt(totalCost)})`);
    }

    let savedCount = 0;
    let totalSupplierDebt = 0;
    let balanceWarning = null;
    const savedDevicesForBarcode = []; // لتخزين الأجهزة المحفوظة للباركود
    const savedDeviceIds = []; // ✅ تتبع الأجهزة المحفوظة لمنع التكرار

    // حساب المبلغ المتبقي للمورد
    const remainingForSupplier = totalCost - totalPaid;

    // Get warehouse ID from modal (مرة واحدة بس مش جوا الـ loop)
    const warehouseId = document.getElementById('bulkWarehouseId')?.value || null;

    // حفظ الأجهزة
    let isFirstDevice = true; // ✅ لتتبع أول جهاز للدفع
    let remainingBulkPayment = totalPaid;
    for (let i = 0; i < bulkDevices.length; i++) {
      const dev = bulkDevices[i];
      if (!dev.model) continue;

      // ✅ حماية من التكرار: لو الجهاز ده اتحفظ قبل كده (في محاولة سابقة فشلت)
      if (dev._savedToInventory) {
        Logger.warn(`[BULK PURCHASE] Device ${i + 1} already saved, skipping`);
        savedCount++;
        continue;
      }

      const cost = parseFloat(dev.cost) || 0;
      const price = parseFloat(dev.price) || 0;
      const tax = parseFloat(dev.tax) || 0;

      // ✅ استخدام اسم الشركة المخصص إذا كان "أخرى"
      const deviceType = dev.type === 'Other' ? (dev.customType || 'Other') : dev.type;

      const deviceRes = await fetch('elos-db://inventory-add', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: deviceType,
          model: dev.model,
          storage: dev.storage,
          ram: dev.ram,
          color: dev.color,
          condition: dev.condition,
          battery_health: dev.battery,
          has_box: dev.box === 'with_box',
          imei1: dev.imei1,
          imei2: dev.imei2,
          purchase_cost: cost,
          expected_price: price,
          ntra_tax: tax,
          warehouse_id: warehouseId ? Number(warehouseId) : null
        })
      });

      if (!deviceRes.ok) continue;
      const deviceResult = await deviceRes.json();

      // ✅ علّم الجهاز إنه اتحفظ عشان لو حصل error بعده ميتحفظش تاني
      dev._savedToInventory = true;
      dev._savedDeviceId = deviceResult.id;

      // حفظ بيانات الجهاز للباركود - استخدام short_code الجديد (6 أرقام)
      savedDevicesForBarcode.push({
        id: deviceResult.id,
        type: deviceType,
        model: dev.model,
        storage: dev.storage,
        ram: dev.ram || '',
        color: dev.color,
        condition: dev.condition,
        battery_health: dev.battery || '',
        short_code: deviceResult.short_code || deviceResult.shortCode || '',
        expected_price: price
      });

      // توزيع المبلغ المدفوع على الأجهزة بالتناسب مع تكلفة كل جهاز
      const devicePaid = Math.min(remainingBulkPayment, cost);
      remainingBulkPayment -= devicePaid;

      // Create purchase record
      const purchaseRes = await fetch('elos-db://purchase-add', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          device_id: deviceResult.id,
          device_type: deviceType,
          device_model: dev.model,
          device_storage: dev.storage,
          device_ram: dev.ram,
          device_color: dev.color,
          device_condition: dev.condition,
          battery_health: dev.battery,
          has_box: dev.box,
          imei1: dev.imei1,
          imei2: dev.imei2,
          source_type: 'vendor',
          supplier_id: supplierId ? Number(supplierId) : null,
          party_name: supplierName,
          party_phone: supplierPhone,
          total_cost: cost,
          expected_price: price,
          ntra_tax: tax,
          paid_now: devicePaid, // توزيع المدفوع على كل جهاز
          payment_method: paymentMethod,
          wallet_type: paymentMethod !== 'credit' ? walletType : null,
          wallet_id: paymentMethod !== 'credit' ? walletId : null,
          warehouse_id: warehouseId ? Number(warehouseId) : null,
          purchase_type: 'bulk'
        })
      });

      if (purchaseRes.ok) {
        const result = await purchaseRes.json();
        if (result.balanceWarning && !balanceWarning) {
          balanceWarning = result.balanceWarning;
        }
        if (isFirstDevice && result.supplierDebt > 0) {
          totalSupplierDebt = result.supplierDebt;
        }
        isFirstDevice = false; // ✅ بعد أول جهاز ناجح
      }

      savedCount++;
    }
    
    // عرض التحذيرات والرسائل
    if (balanceWarning) {
      showToast(`⚠️ ${balanceWarning}`, 'warning', 5000);
    }
    
    if (totalSupplierDebt > 0) {
      showToast(`💳 تم تسجيل ${fmt(totalSupplierDebt)} ج.م مستحق لـ "${supplierName}"`, 'info', 4000);
    }
    
    showToast(`✅ تم توريد ${savedCount} جهاز بإجمالي ${fmt(totalCost)} ج.م`, 'success');
    closeBulkPurchaseModal();
    await loadPurchases();

    // ═══════════════════════════════════════════════════════════════
    // 🏷️ سؤال المستخدم عن طباعة الباركود للأجهزة
    // ═══════════════════════════════════════════════════════════════
    if (savedDevicesForBarcode.length > 0 && typeof printBarcodeLabels === 'function') {
      const devicesList = savedDevicesForBarcode.map(d => `• ${d.type} ${d.model}`).join('\n');

      const wantPrint = await showConfirm(
        `🏷️ هل تريد طباعة باركود للأجهزة الموردة؟\n\n${devicesList}\n\nعدد الأجهزة: ${savedDevicesForBarcode.length}`,
        'طباعة الباركود', 'لاحقاً', 'info'
      );

      if (wantPrint) {
        // طباعة باركود لكل الأجهزة
        printBarcodeLabels(savedDevicesForBarcode, { type: 'device' });
      }
    }

  } catch (error) {
    Logger.error('[BULK DEVICE] Error:', error);
    // ✅ رسالة واضحة لو بعض الأجهزة اتحفظت قبل الخطأ
    if (savedCount > 0) {
      showToast(`⚠️ تم حفظ ${savedCount} جهاز قبل الخطأ. اضغط حفظ مرة تانية لإكمال الباقي.\n${error.message}`, 'warning', 8000);
    } else {
      showToast(error.message, 'error');
    }
  } finally {
    // ═══════════════════════════════════════════════════════════════
    // 🔓 إعادة تفعيل الزر وإزالة حماية التكرار
    // ═══════════════════════════════════════════════════════════════
    isBulkPurchaseSubmitting = false;
    const submitBtn = document.querySelector('#bulkPurchaseModal .btn-primary, #bulkPurchaseModal button[type="submit"]');
    if (submitBtn) {
      submitBtn.disabled = false;
      submitBtn.textContent = '💾 حفظ التوريد';
      submitBtn.style.opacity = '1';
    }
  }
}
window.handleBulkDeviceSubmit = handleBulkDeviceSubmit;

// ═══════════════════════════════════════════════════════════════
// 📦 OLD BULK DEVICES MANAGEMENT (LEGACY)
// ═══════════════════════════════════════════════════════════════
function addDeviceRow() {
  addBulkDevice();
}

function removeDevice(id) {
  removeBulkDevice(id);
}

function updateDevice(id, field, value) {
  updateBulkDevice(id, field, value);
}

function renderBulkDevices() {
  renderBulkDevicesList();
}

function renderBulkDevices() {
  const container = document.getElementById('devicesList');
  
  if (bulkDevices.length === 0) {
    container.innerHTML = '';
    return;
  }
  
  container.innerHTML = bulkDevices.map((dev, index) => {
    const showBattery = dev.condition === 'used' || dev.condition === 'like_new';
    const showCustomType = dev.type === 'Other';
    
    return `
    <div class="device-item">
      <div class="device-header">
        <div class="device-number">📱 جهاز ${index + 1}</div>
        <button type="button" class="remove-device-btn" onclick="removeDevice(${dev.id})">🗑️ حذف</button>
      </div>
      
      <div class="row">
        <div class="field">
          <label>📱 الشركة</label>
          <select onchange="updateDevice(${dev.id}, 'type', this.value)">
            <option value="">-- اختر الشركة --</option>
            <option value="Apple" ${dev.type === 'Apple' ? 'selected' : ''}>Apple</option>
            <option value="Samsung" ${dev.type === 'Samsung' ? 'selected' : ''}>Samsung</option>
            <option value="Oppo" ${dev.type === 'Oppo' ? 'selected' : ''}>Oppo</option>
            <option value="Realme" ${dev.type === 'Realme' ? 'selected' : ''}>Realme</option>
            <option value="Vivo" ${dev.type === 'Vivo' ? 'selected' : ''}>Vivo</option>
            <option value="Huawei" ${dev.type === 'Huawei' ? 'selected' : ''}>Huawei</option>
            <option value="Xiaomi" ${dev.type === 'Xiaomi' ? 'selected' : ''}>Xiaomi</option>
            <option value="Other" ${dev.type === 'Other' ? 'selected' : ''}>أخرى</option>
          </select>
        </div>
        ${showCustomType ? `
        <div class="field">
          <label>🏷️ شركة أخرى</label>
          <input value="${dev.customType}" onchange="updateDevice(${dev.id}, 'customType', this.value)" placeholder="اكتب اسم الشركة" />
        </div>
        ` : `
        <div class="field">
          <label>📲 الموديل</label>
          <input value="${dev.model}" onchange="updateDevice(${dev.id}, 'model', this.value)" placeholder="مثال: iPhone 13" required />
        </div>
        `}
      </div>
      
      ${showCustomType ? `
      <div class="row">
        <div class="field">
          <label>📲 الموديل</label>
          <input value="${dev.model}" onchange="updateDevice(${dev.id}, 'model', this.value)" placeholder="مثال: iPhone 13" required />
        </div>
        <div class="field">
          <label>💾 السعة</label>
          <input value="${dev.storage}" onchange="updateDevice(${dev.id}, 'storage', this.value)" placeholder="128GB" />
        </div>
      </div>
      ` : `
      <div class="row">
        <div class="field">
          <label>💾 السعة</label>
          <input value="${dev.storage}" onchange="updateDevice(${dev.id}, 'storage', this.value)" placeholder="128GB" />
        </div>
        <div class="field">
          <label>🎨 اللون</label>
          <input value="${dev.color}" onchange="updateDevice(${dev.id}, 'color', this.value)" placeholder="أسود، أبيض..." />
        </div>
      </div>
      `}
      
      ${!showCustomType ? `
      <div class="row">
        <div class="field">
          <label>⚙️ الحالة</label>
          <select onchange="updateDevice(${dev.id}, 'condition', this.value)">
            <option value="new" ${dev.condition === 'new' ? 'selected' : ''}>جديد</option>
            <option value="like_new" ${dev.condition === 'like_new' ? 'selected' : ''}>كالجديد</option>
            <option value="used" ${dev.condition === 'used' ? 'selected' : ''}>مستعمل</option>
            <option value="faulty" ${dev.condition === 'faulty' ? 'selected' : ''}>عاطل</option>
          </select>
        </div>
        ${showBattery ? `
        <div class="field">
          <label>🔋 البطارية (%)</label>
          <input type="number" value="${dev.battery}" onchange="updateDevice(${dev.id}, 'battery', this.value)" min="0" max="100" placeholder="85" />
        </div>
        ` : `
        <div class="field">
          <label>📦 الكرتونة</label>
          <select onchange="updateDevice(${dev.id}, 'box', this.value)">
            <option value="with_box" ${dev.box === 'with_box' ? 'selected' : ''}>مع كرتونة</option>
            <option value="without_box" ${dev.box === 'without_box' ? 'selected' : ''}>بدون كرتونة</option>
          </select>
        </div>
        `}
      </div>
      ` : ''}
      
      ${showBattery && !showCustomType ? `
      <div class="row">
        <div class="field">
          <label>📦 الكرتونة</label>
          <select onchange="updateDevice(${dev.id}, 'box', this.value)">
            <option value="with_box" ${dev.box === 'with_box' ? 'selected' : ''}>مع كرتونة</option>
            <option value="without_box" ${dev.box === 'without_box' ? 'selected' : ''}>بدون كرتونة</option>
          </select>
        </div>
        <div class="field">
          <label>🔢 IMEI 1</label>
          <input value="${dev.imei1}" onchange="updateDevice(${dev.id}, 'imei1', this.value)" placeholder="IMEI الأول" />
        </div>
      </div>
      ` : `
      <div class="row">
        <div class="field">
          <label>🔢 IMEI 1</label>
          <input value="${dev.imei1}" onchange="updateDevice(${dev.id}, 'imei1', this.value)" placeholder="IMEI الأول" />
        </div>
        <div class="field">
          <label>🔢 IMEI 2</label>
          <input value="${dev.imei2}" onchange="updateDevice(${dev.id}, 'imei2', this.value)" placeholder="IMEI الثاني" />
        </div>
      </div>
      `}
      
      ${showBattery && !showCustomType ? `
      <div class="row">
        <div class="field">
          <label>🔢 IMEI 2</label>
          <input value="${dev.imei2}" onchange="updateDevice(${dev.id}, 'imei2', this.value)" placeholder="IMEI الثاني" />
        </div>
        <div class="field">
          <label>💰 التكلفة</label>
          <input type="number" value="${dev.cost}" onchange="updateDevice(${dev.id}, 'cost', this.value)" min="0" step="0.01" placeholder="0.00" required />
        </div>
      </div>
      ` : `
      <div class="row">
        <div class="field">
          <label>💰 التكلفة</label>
          <input type="number" value="${dev.cost}" onchange="updateDevice(${dev.id}, 'cost', this.value)" min="0" step="0.01" placeholder="0.00" required />
        </div>
        <div class="field">
          <label>💵 السعر المتوقع</label>
          <input type="number" value="${dev.expectedPrice}" onchange="updateDevice(${dev.id}, 'expectedPrice', this.value)" min="0" step="0.01" placeholder="0.00" />
        </div>
      </div>
      `}
      
      <div class="row">
        ${showBattery && !showCustomType ? `
        <div class="field">
          <label>💵 السعر المتوقع</label>
          <input type="number" value="${dev.expectedPrice}" onchange="updateDevice(${dev.id}, 'expectedPrice', this.value)" min="0" step="0.01" placeholder="0.00" />
        </div>
        ` : ''}
        <div class="field">
          <label>🏛️ ضريبة NTRA</label>
          <input type="number" value="${dev.ntraTax}" onchange="updateDevice(${dev.id}, 'ntraTax', this.value)" min="0" step="0.01" placeholder="0.00" />
        </div>
      </div>
      
      <div class="field">
        <label>📝 ملاحظات</label>
        <textarea onchange="updateDevice(${dev.id}, 'notes', this.value)" placeholder="ملاحظات..." style="min-height: 60px; resize: vertical;">${dev.notes}</textarea>
      </div>
    </div>
  `}).join('');
}

// ═══════════════════════════════════════════════════════════════
// 💾 SAVE BULK PURCHASE
// ═══════════════════════════════════════════════════════════════
async function saveBulkPurchase(e) {
  e.preventDefault();
  
  if (bulkDevices.length === 0) {
    showToast('يجب إضافة جهاز واحد على الأقل', 'error');
    return;
  }
  
  // Validate devices
  for (const dev of bulkDevices) {
    if (!dev.model) {
      showToast('الموديل مطلوب لجميع الأجهزة', 'error');
      return;
    }
  }
  
  try {
    const sourceType = document.getElementById('bSourceType').value;
    let partyName = '';
    let partyPhone = '';
    
    // Get party info based on source type
    if (sourceType === 'vendor' || sourceType === 'customer') {
      const vendorSelect = document.getElementById('bVendorSelect');
      const selectedVendor = vendorSelect.value;
      
      if (selectedVendor) {
        // استخدام بيانات المورد المحدد
        const vendorOption = vendorSelect.options[vendorSelect.selectedIndex];
        partyName = vendorOption.text;
        partyPhone = vendorOption.dataset.phone || '';
      } else {
        // استخدام الإدخال اليدوي
        partyName = document.getElementById('bPartyName').value.trim();
        partyPhone = document.getElementById('bPartyPhone').value.trim();
      }
    } else {
      // manual entry
      partyName = document.getElementById('bPartyName').value.trim();
      partyPhone = document.getElementById('bPartyPhone').value.trim();
    }
    
    const paymentMethod = document.getElementById('bPaymentMethod').value;
    const totalPaid = Number(document.getElementById('bPaidNow').value || 0);
    
    let successCount = 0;
    
    for (const dev of bulkDevices) {
      // Get device type
      let deviceType = dev.type;
      if (deviceType === 'Other') {
        deviceType = dev.customType || 'Other';
      }
      
      // Add device to inventory
      const device = {
        type: deviceType,
        model: dev.model,
        storage: dev.storage,
        color: dev.color,
        condition: dev.condition,
        battery_health: dev.battery || null,
        box: dev.box,
        imei1: dev.imei1,
        imei2: dev.imei2,
        purchase_cost: Number(dev.cost),
        expected_price: Number(dev.expectedPrice) || Number(dev.cost) * 1.15,
        ntra_tax: Number(dev.ntraTax) || 0,
        status: 'in_stock',
        source: 'purchase',
        notes: dev.notes
      };
      
      const deviceRes = await fetch('elos-db://inventory-add', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(device)
      });
      
      if (!deviceRes.ok) throw new Error(await deviceRes.text());
      const deviceResult = await deviceRes.json();
      
      // Create purchase record
      const purchase = {
        device_id: deviceResult.id,
        source_type: sourceType,
        party_name: partyName,
        party_phone: partyPhone,
        total_cost: Number(dev.cost),
        paid_now: 0, // Will be distributed later if needed
        payment_method: paymentMethod,
        notes: dev.notes
      };
      
      const purchaseRes = await fetch('elos-db://purchase-add', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(purchase)
      });
      
      if (!purchaseRes.ok) throw new Error(await purchaseRes.text());
      successCount++;
    }
    
    showToast(`تم حفظ ${successCount} جهاز بنجاح ✅`, 'success');
    closePurchaseModal();
    await loadPurchases();
  } catch (error) {
    Logger.error('Save bulk purchase error:', error);
    showToast('فشل الحفظ: ' + error.message, 'error');
  }
}

// ═══════════════════════════════════════════════════════════════
// 🔔 TOAST NOTIFICATIONS
// ═══════════════════════════════════════════════════════════════
function showToast(message, type = 'info', duration = 3000) {
  const container = document.getElementById('toastContainer') || createToastContainer();
  
  const toast = document.createElement('div');
  const icons = { success: '✅', error: '❌', warning: '⚠️', info: 'ℹ️' };
  const colors = { success: '#10b981', error: '#ef4444', warning: '#f59e0b', info: '#3b82f6' };
  
  toast.style.cssText = `
    background: linear-gradient(135deg, #1a1f29 0%, #151921 100%);
    border: 1px solid ${colors[type]};
    border-radius: 12px;
    padding: 14px 20px;
    color: #e6e8ee;
    box-shadow: 0 8px 32px rgba(0,0,0,0.4);
    display: flex;
    align-items: center;
    gap: 12px;
    min-width: 300px;
    max-width: 500px;
    animation: slideIn 0.3s ease-out;
    font-size: 14px;
    font-weight: 500;
    margin-bottom: 12px;
  `;
  
  toast.innerHTML = `<span style="font-size: 20px;">${icons[type]}</span><span>${message}</span>`;
  container.appendChild(toast);
  
  setTimeout(() => {
    toast.style.animation = 'slideOut 0.3s ease-out';
    setTimeout(() => toast.remove(), 300);
  }, duration);
}

function createToastContainer() {
  const container = document.createElement('div');
  container.id = 'toastContainer';
  container.style.cssText = `
    position: fixed;
    top: 80px;
    left: 50%;
    transform: translateX(-50%);
    z-index: 10000;
    display: flex;
    flex-direction: column;
    pointer-events: none;
  `;
  document.body.appendChild(container);
  
  const style = document.createElement('style');
  style.textContent = `
    @keyframes slideIn { from { opacity: 0; transform: translateY(-20px); } to { opacity: 1; transform: translateY(0); } }
    @keyframes slideOut { from { opacity: 1; transform: translateY(0); } to { opacity: 0; transform: translateY(-20px); } }
  `;
  document.head.appendChild(style);
  
  return container;
}

// ═══════════════════════════════════════════════════════════════
// 👥 LOAD VENDORS
// ═══════════════════════════════════════════════════════════════
async function loadVendors() {
  try {
    const response = await fetch('elos-db://suppliers');
    if (!response.ok) {
      Logger.warn('Could not load vendors');
      return [];
    }
    const vendors = await response.json();
    return vendors;
  } catch (error) {
    Logger.error('Load vendors error:', error);
    return [];
  }
}

async function populateVendorSelects() {
  const vendors = await loadVendors();
  
  // Quick tab
  const qVendorSelect = document.getElementById('qVendorSelect');
  if (qVendorSelect && vendors.length > 0) {
    qVendorSelect.innerHTML = '<option value="">-- اختر من القائمة أو أدخل يدوياً --</option>';
    vendors.forEach(vendor => {
      const option = document.createElement('option');
      option.value = vendor.id;
      option.textContent = vendor.name;
      option.dataset.phone = vendor.phone || '';
      qVendorSelect.appendChild(option);
    });
  }
  
  // Bulk tab
  const bVendorSelect = document.getElementById('bVendorSelect');
  if (bVendorSelect && vendors.length > 0) {
    bVendorSelect.innerHTML = '<option value="">-- اختر من القائمة أو أدخل يدوياً --</option>';
    vendors.forEach(vendor => {
      const option = document.createElement('option');
      option.value = vendor.id;
      option.textContent = vendor.name;
      option.dataset.phone = vendor.phone || '';
      bVendorSelect.appendChild(option);
    });
  }
}

// ═══════════════════════════════════════════════════════════════
// 🎛️ SETUP SOURCE TYPE HANDLERS
// ═══════════════════════════════════════════════════════════════
function setupSourceTypeHandlers() {
  // Quick tab handler
  const qSourceType = document.getElementById('qSourceType');
  const qVendorSelectField = document.getElementById('qVendorSelectField');
  const qManualFields = document.getElementById('qManualFields');
  
  if (qSourceType) {
    qSourceType.addEventListener('change', function() {
      if (this.value === 'manual') {
        qVendorSelectField.style.display = 'none';
        qManualFields.style.display = 'grid';
      } else {
        qVendorSelectField.style.display = 'block';
        qManualFields.style.display = 'grid';
      }
    });
  }
  
  // Bulk tab handler
  const bSourceType = document.getElementById('bSourceType');
  const bVendorSelectField = document.getElementById('bVendorSelectField');
  const bManualFields = document.getElementById('bManualFields');
  
  if (bSourceType) {
    bSourceType.addEventListener('change', function() {
      if (this.value === 'manual') {
        bVendorSelectField.style.display = 'none';
        bManualFields.style.display = 'grid';
      } else {
        bVendorSelectField.style.display = 'block';
        bManualFields.style.display = 'grid';
      }
    });
  }
  
  // Auto-fill from vendor select - Quick
  const qVendorSelect = document.getElementById('qVendorSelect');
  if (qVendorSelect) {
    qVendorSelect.addEventListener('change', function() {
      if (this.value) {
        const option = this.options[this.selectedIndex];
        document.getElementById('qPartyName').value = option.textContent;
        document.getElementById('qPartyPhone').value = option.dataset.phone || '';
      }
    });
  }
  
  // Auto-fill from vendor select - Bulk
  const bVendorSelect = document.getElementById('bVendorSelect');
  if (bVendorSelect) {
    bVendorSelect.addEventListener('change', function() {
      if (this.value) {
        const option = this.options[this.selectedIndex];
        document.getElementById('bPartyName').value = option.textContent;
        document.getElementById('bPartyPhone').value = option.dataset.phone || '';
      }
    });
  }
}

// ═══════════════════════════════════════════════════════════════
// 🚀 INITIALIZATION
// ═══════════════════════════════════════════════════════════════
(async function init() {
  Logger.log('🛒 ELOS Purchases System - Enhanced');
  
  initHeaderClock();
  
  // Setup custom type field handler
  const typeSelect = document.getElementById('qType');
  const customTypeField = document.getElementById('customTypeField');
  
  if (typeSelect && customTypeField) {
    typeSelect.addEventListener('change', function() {
      if (this.value === 'Other') {
        customTypeField.style.display = 'block';
      } else {
        customTypeField.style.display = 'none';
      }
    });
  }
  
  // Setup battery field handler (show only for used/like_new)
  const conditionSelect = document.getElementById('qCondition');
  const batteryField = document.getElementById('batteryField');
  const batteryFieldAlt = document.getElementById('batteryFieldAlt');
  
  if (conditionSelect && batteryField && batteryFieldAlt) {
    conditionSelect.addEventListener('change', function() {
      if (this.value === 'used' || this.value === 'like_new') {
        batteryField.style.display = 'grid';
        batteryFieldAlt.style.display = 'none';
      } else {
        batteryField.style.display = 'none';
        batteryFieldAlt.style.display = 'block';
      }
    });
  }
  
  // Load vendors and setup handlers
  await populateVendorSelects();
  setupSourceTypeHandlers();
  
  await loadPurchases();
})();
// ═══════════════════════════════════════════════════════════════
// 🎯 TOGGLE ITEM TYPE FIELDS (UNIFIED PURCHASES)
// ═══════════════════════════════════════════════════════════════
window.toggleItemFields = function(type) {
  const deviceFields = document.getElementById('deviceFields');
  const accessoryFields = document.getElementById('accessoryFields');
  const deviceBtn = document.getElementById('deviceTypeBtn');
  const accessoryBtn = document.getElementById('accessoryTypeBtn');
  
  if (type === 'device') {
    deviceFields.style.display = 'block';
    accessoryFields.style.display = 'none';
    deviceBtn.classList.add('active');
    accessoryBtn.classList.remove('active');
    
    // Make device fields required
    document.getElementById('qType').required = true;
    document.getElementById('qModel').required = true;
    document.getElementById('qCost').required = true;
    
    // Remove accessory requirements
    document.getElementById('accName').required = false;
    document.getElementById('accPurchasePrice').required = false;
  } else {
    deviceFields.style.display = 'none';
    accessoryFields.style.display = 'block';
    deviceBtn.classList.remove('active');
    accessoryBtn.classList.add('active');
    
    // Remove device requirements
    document.getElementById('qType').required = false;
    document.getElementById('qModel').required = false;
    document.getElementById('qCost').required = false;
    
    // Make accessory fields required
    document.getElementById('accName').required = true;
    document.getElementById('accPurchasePrice').required = true;
  }
};

// Auto-calculate accessory total cost
setTimeout(() => {
  const accQuantity = document.getElementById('accQuantity');
  const accPurchasePrice = document.getElementById('accPurchasePrice');
  const accTotalCost = document.getElementById('accTotalCost');
  
  function calculateTotal() {
    const qty = parseFloat(accQuantity?.value) || 0;
    const price = parseFloat(accPurchasePrice?.value) || 0;
    const total = qty * price;
    if (accTotalCost) accTotalCost.value = total.toFixed(2);
  }
  
  accQuantity?.addEventListener('input', calculateTotal);
  accPurchasePrice?.addEventListener('input', calculateTotal);
}, 1000);

// ═══════════════════════════════════════════════════════════════
// 🔍 FILTER SYSTEM
// ═══════════════════════════════════════════════════════════════
function initFilters() {
  // الافتراضي: عدم تطبيق فلترة (عرض كل التوريدات) مثل "مسح الفلاتر"
  const dateFromInput = document.getElementById('filterDateFrom');
  const dateToInput = document.getElementById('filterDateTo');
  const sourceInput = document.getElementById('filterSourceType');
  const searchInput = document.getElementById('searchPurchases');
  if (dateFromInput) dateFromInput.value = '';
  if (dateToInput) dateToInput.value = '';
  if (sourceInput) sourceInput.value = '';
  if (searchInput) searchInput.value = '';

  // Event listeners
  let searchTimeout;
  if (searchInput) {
    searchInput.addEventListener('input', () => {
      clearTimeout(searchTimeout);
      const debounceDelay = window.SalesConstants?.TIMING.SEARCH_DEBOUNCE || 300;
      searchTimeout = setTimeout(applyFilters, debounceDelay);
    });
  }

  ['filterDateFrom', 'filterDateTo', 'filterSourceType'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.addEventListener('change', applyFilters);
  });
}

function setDefaultDateFilter() {
  const now = new Date();
  const sixMonthsAgo = new Date();
  sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);

  const toLocal = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  const dateFrom = toLocal(sixMonthsAgo);
  const dateTo = toLocal(now);

  const dateFromInput = document.getElementById('filterDateFrom');
  const dateToInput = document.getElementById('filterDateTo');

  if (dateFromInput) dateFromInput.value = dateFrom;
  if (dateToInput) dateToInput.value = dateTo;

  const monthNames = ['يناير', 'فبراير', 'مارس', 'أبريل', 'مايو', 'يونيو', 'يوليو', 'أغسطس', 'سبتمبر', 'أكتوبر', 'نوفمبر', 'ديسمبر'];
  const fromMonth = monthNames[sixMonthsAgo.getMonth()];
  const toMonth = monthNames[now.getMonth()];
  setTimeout(() => {
    showToast(`📅 عرض توريدات آخر 6 شهور (${fromMonth} - ${toMonth})`, 'info');
  }, 800);
}

function applyFilters() {
  const dateFrom = document.getElementById('filterDateFrom')?.value || '';
  const dateTo = document.getElementById('filterDateTo')?.value || '';
  const sourceType = document.getElementById('filterSourceType')?.value || '';
  const searchTerm = document.getElementById('searchPurchases')?.value?.toLowerCase().trim() || '';

  filters = { dateFrom, dateTo, sourceType, searchTerm };

  // Filter all purchases
  filteredData.all = allPurchases.filter(p => {
    // Get purchase date - just extract the date part directly
    let purchaseDate = '';
    if (p.created_at) {
      // Extract date part directly from ISO string (YYYY-MM-DD)
      purchaseDate = p.created_at.substring(0, 10);
    } else if (p.purchase_date) {
      purchaseDate = p.purchase_date.substring(0, 10);
    }
    
    // Date filters - include same day
    // purchaseDate >= dateFrom AND purchaseDate <= dateTo
    if (dateFrom && purchaseDate && purchaseDate < dateFrom) return false;
    if (dateTo && purchaseDate && purchaseDate > dateTo) return false;
    
    // Source type filter
    if (sourceType && p.source_type !== sourceType) return false;
    
    // Search filter
    if (searchTerm) {
      const searchIn = `${p.device_model || ''} ${p.device_type || ''} ${p.party_name || ''} ${p.imei1 || ''} ${p.imei2 || ''} ${p.notes || ''}`.toLowerCase();
      if (!searchIn.includes(searchTerm)) return false;
    }
    
    return true;
  });

  // Filter quick purchases
  filteredData.quick = filteredData.all.filter(p => p.purchase_type === 'quick' || !p.purchase_type);
  
  // Filter bulk purchases
  filteredData.bulk = filteredData.all.filter(p => p.purchase_type === 'bulk');

  // Reset pages
  currentPageNum.all = 1;
  currentPageNum.quick = 1;
  currentPageNum.bulk = 1;

  // Re-render
  renderAllPurchases();
}

function clearFilters() {
  document.getElementById('filterDateFrom').value = '';
  document.getElementById('filterDateTo').value = '';
  document.getElementById('filterSourceType').value = '';
  document.getElementById('searchPurchases').value = '';
  
  filters = { dateFrom: '', dateTo: '', sourceType: '', searchTerm: '' };
  filteredData.all = [...allPurchases];
  filteredData.quick = allPurchases.filter(p => p.purchase_type === 'quick' || !p.purchase_type);
  filteredData.bulk = allPurchases.filter(p => p.purchase_type === 'bulk');
  
  currentPageNum.all = 1;
  currentPageNum.quick = 1;
  currentPageNum.bulk = 1;
  
  renderAllPurchases();
  showToast('تم مسح الفلاتر', 'info');
}

// ═══════════════════════════════════════════════════════════════
// 📋 PURCHASE DETAILS
// ═══════════════════════════════════════════════════════════════
function showPurchaseDetails(purchaseId) {
  // البحث في allPurchases أولاً ثم في filteredData
  let purchase = allPurchases.find(p => p.id === purchaseId || p.id === String(purchaseId));
  
  if (!purchase) {
    purchase = filteredData.all.find(p => p.id === purchaseId || p.id === String(purchaseId));
  }
  
  if (!purchase) {
    Logger.log('[DETAILS] Purchase not found:', purchaseId, 'Available:', allPurchases.map(p => p.id));
    showToast('لم يتم العثور على التوريد', 'error');
    return;
  }
  
  Logger.log('[DETAILS] Found purchase:', purchase);

  const date = new Date(purchase.created_at || purchase.purchase_date);
  const sourceTypes = { vendor: 'تاجر', customer: 'عميل' };
  const conditions = { new: 'جديد', used: 'مستعمل', like_new: 'شبه جديد' };
  
  // Get device info - handle different field names
  const deviceType = purchase.device_type || purchase.type || '-';
  const deviceModel = purchase.device_model || purchase.model || '-';
  const deviceColor = purchase.device_color || purchase.color || '-';
  const deviceStorage = purchase.device_storage || purchase.storage || '-';
  const deviceCondition = purchase.device_condition || purchase.condition || '';
  const batteryHealth = purchase.battery_health || purchase.battery || '';
  const hasBox = purchase.has_box || purchase.box || '';
  const imei1 = purchase.imei1 || '-';
  const imei2 = purchase.imei2 || '-';

  const detailsHtml = `
    <div class="details-section">
      <div class="details-header">
        <span>📱</span>
        <span>معلومات الجهاز</span>
      </div>
      <div class="details-grid">
        <div class="detail-box highlight">
          <span class="detail-label">الجهاز</span>
          <span class="detail-value large">${deviceType} ${deviceModel}</span>
        </div>
        <div class="detail-box">
          <span class="detail-label">اللون</span>
          <span class="detail-value">${deviceColor}</span>
        </div>
        <div class="detail-box">
          <span class="detail-label">المساحة</span>
          <span class="detail-value">${deviceStorage}</span>
        </div>
        <div class="detail-box">
          <span class="detail-label">الحالة</span>
          <span class="detail-value">${conditions[deviceCondition] || deviceCondition || '-'}</span>
        </div>
        <div class="detail-box">
          <span class="detail-label">البطارية</span>
          <span class="detail-value">${batteryHealth ? batteryHealth + '%' : '-'}</span>
        </div>
        <div class="detail-box">
          <span class="detail-label">العلبة</span>
          <span class="detail-value">${hasBox === 'with_box' ? 'بعلبة' : 'بدون علبة'}</span>
        </div>
      </div>
    </div>

    <div class="details-section">
      <div class="details-header">
        <span>🔢</span>
        <span>IMEI</span>
      </div>
      <div class="details-grid">
        <div class="detail-box">
          <span class="detail-label">IMEI 1</span>
          <span class="detail-value" style="font-family:monospace;">${imei1}</span>
        </div>
        <div class="detail-box">
          <span class="detail-label">IMEI 2</span>
          <span class="detail-value" style="font-family:monospace;">${imei2}</span>
        </div>
      </div>
    </div>

    <div class="details-section">
      <div class="details-header">
        <span>💰</span>
        <span>معلومات الشراء</span>
      </div>
      <div class="details-grid">
        <div class="detail-box">
          <span class="detail-label">المصدر</span>
          <span class="detail-value">${sourceTypes[purchase.source_type] || purchase.source_type || '-'}</span>
        </div>
        <div class="detail-box">
          <span class="detail-label">اسم الطرف</span>
          <span class="detail-value">${purchase.party_name || '-'}</span>
        </div>
        <div class="detail-box">
          <span class="detail-label">الهاتف</span>
          <span class="detail-value" dir="ltr">${purchase.party_phone || '-'}</span>
        </div>
        <div class="detail-box">
          <span class="detail-label">التكلفة</span>
          <span class="detail-value large text-success">${fmt(purchase.total_cost)} ج.م</span>
        </div>
        <div class="detail-box">
          <span class="detail-label">المدفوع</span>
          <span class="detail-value">${fmt(purchase.paid_now)} ج.م</span>
        </div>
        <div class="detail-box">
          <span class="detail-label">المتبقي</span>
          <span class="detail-value ${(purchase.total_cost - purchase.paid_now) > 0 ? 'text-warning' : ''}">${fmt(purchase.total_cost - purchase.paid_now)} ج.م</span>
        </div>
      </div>
    </div>

    <div class="details-section">
      <div class="details-header">
        <span>ℹ️</span>
        <span>معلومات إضافية</span>
      </div>
      <div class="details-grid">
        <div class="detail-box">
          <span class="detail-label">التاريخ</span>
          <span class="detail-value">${date.toLocaleDateString('ar-EG', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</span>
        </div>
        <div class="detail-box">
          <span class="detail-label">الوقت</span>
          <span class="detail-value">${date.toLocaleTimeString('ar-EG')}</span>
        </div>
        <div class="detail-box">
          <span class="detail-label">طريقة الدفع</span>
          <span class="detail-value">${purchase.payment_method || 'كاش'}</span>
        </div>
        <div class="detail-box">
          <span class="detail-label">رقم التوريد</span>
          <span class="detail-value" style="font-family:monospace;">#${purchase.id}</span>
        </div>
      </div>
      ${purchase.notes ? `<div style="margin-top:12px;padding:12px;background:var(--bg-primary);border-radius:8px;"><span class="detail-label">ملاحظات:</span> ${purchase.notes}</div>` : ''}
    </div>
  `;

  showDetailsModal('تفاصيل التوريد', detailsHtml);
}

function showDetailsModal(title, content) {
  let modal = document.getElementById('detailsModal');
  
  if (!modal) {
    modal = document.createElement('div');
    modal.id = 'detailsModal';
    modal.className = 'modal-overlay';
    modal.style.cssText = 'display:none;position:fixed;inset:0;background:rgba(0,0,0,0.75);backdrop-filter:blur(4px);z-index:10000;align-items:center;justify-content:center;';
    modal.innerHTML = `
      <div class="modal details-modal" style="background:var(--bg-secondary);border:1px solid var(--border);border-radius:16px;max-width:650px;width:95%;max-height:90vh;display:flex;flex-direction:column;">
        <div class="modal-header" style="display:flex;justify-content:space-between;align-items:center;padding:20px 24px;border-bottom:1px solid var(--border);">
          <div class="modal-title" id="detailsModalTitle" style="font-size:18px;font-weight:700;color:var(--accent);"></div>
          <button onclick="closeDetailsModal()" style="background:none;border:none;color:var(--text-secondary);font-size:24px;cursor:pointer;">✕</button>
        </div>
        <div class="modal-body" id="detailsModalBody" style="padding:20px;overflow-y:auto;flex:1;"></div>
        <div class="modal-footer" style="display:flex;gap:12px;justify-content:flex-end;padding:16px 24px;border-top:1px solid var(--border);">
          <button onclick="closeDetailsModal()" style="padding:10px 24px;background:var(--bg-tertiary);color:var(--text-primary);border:1px solid var(--border);border-radius:8px;cursor:pointer;">إغلاق</button>
        </div>
      </div>
    `;
    document.body.appendChild(modal);
    // ✅ Backdrop click to close
    modal.addEventListener('mousedown', (e) => {
      if (e.target === modal) closeDetailsModal();
    });
  }

  document.getElementById('detailsModalTitle').innerHTML = `📋 ${title}`;
  document.getElementById('detailsModalBody').innerHTML = content;

  modal.style.display = 'flex';
  document.body.style.overflow = 'hidden';
}

function closeDetailsModal() {
  const modal = document.getElementById('detailsModal');
  if (modal) {
    modal.style.display = 'none';
    document.body.style.overflow = '';
  }
}
window.closeDetailsModal = closeDetailsModal;

// ═══════════════════════════════════════════════════════════════
// 📦 BULK INVOICE DETAILS - عرض تفاصيل فاتورة التوريد المتعدد
// ═══════════════════════════════════════════════════════════════
function showBulkInvoiceDetails(deviceIds) {
  // جلب بيانات الأجهزة من allPurchases
  const devices = deviceIds.map(id =>
    allPurchases.find(p => p.id === id || p.id === String(id))
  ).filter(Boolean);

  if (devices.length === 0) {
    showToast('لم يتم العثور على بيانات الفاتورة', 'error');
    return;
  }

  // حساب الإجماليات
  const totalCost = devices.reduce((sum, d) => sum + (parseFloat(d.total_cost) || 0), 0);
  const totalPaid = devices.reduce((sum, d) => sum + (parseFloat(d.paid_now) || 0), 0);
  const date = new Date(devices[0].created_at || devices[0].purchase_date);
  const supplierName = devices[0].party_name || devices[0].supplier_name || '-';
  const conditions = { new: 'جديد', used: 'مستعمل', like_new: 'شبه جديد', faulty: 'عاطل' };

  // بناء جدول الأجهزة
  const devicesTable = devices.map((d, i) => `
    <tr>
      <td>${i + 1}</td>
      <td><strong>${d.device_type || ''} ${d.device_model || '-'}</strong></td>
      <td>${d.device_storage || '-'}</td>
      <td>${d.device_color || '-'}</td>
      <td>${conditions[d.device_condition] || d.device_condition || '-'}</td>
      <td style="font-family:monospace;font-size:11px;">${d.imei1 || '-'}</td>
      <td><strong style="color:var(--success)">${fmt(d.total_cost)}</strong></td>
    </tr>
  `).join('');

  const detailsHtml = `
    <div class="details-section">
      <div class="details-header">
        <span>📦</span>
        <span>معلومات الفاتورة</span>
      </div>
      <div class="details-grid">
        <div class="detail-box highlight">
          <span class="detail-label">عدد الأجهزة</span>
          <span class="detail-value large" style="color:var(--info)">${devices.length} جهاز</span>
        </div>
        <div class="detail-box">
          <span class="detail-label">المورد</span>
          <span class="detail-value">${supplierName}</span>
        </div>
        <div class="detail-box">
          <span class="detail-label">التاريخ</span>
          <span class="detail-value">${date.toLocaleDateString('ar-EG', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</span>
        </div>
        <div class="detail-box">
          <span class="detail-label">إجمالي التكلفة</span>
          <span class="detail-value large text-success">${fmt(totalCost)} ج.م</span>
        </div>
        <div class="detail-box">
          <span class="detail-label">المدفوع</span>
          <span class="detail-value">${fmt(totalPaid)} ج.م</span>
        </div>
        <div class="detail-box">
          <span class="detail-label">المتبقي</span>
          <span class="detail-value ${(totalCost - totalPaid) > 0 ? 'text-warning' : ''}">${fmt(totalCost - totalPaid)} ج.م</span>
        </div>
      </div>
    </div>

    <div class="details-section">
      <div class="details-header">
        <span>📱</span>
        <span>قائمة الأجهزة</span>
      </div>
      <div style="overflow-x:auto;">
        <table style="width:100%;border-collapse:collapse;font-size:13px;">
          <thead>
            <tr style="background:var(--bg-tertiary);">
              <th style="padding:10px;text-align:right;border-bottom:1px solid var(--border);">#</th>
              <th style="padding:10px;text-align:right;border-bottom:1px solid var(--border);">الجهاز</th>
              <th style="padding:10px;text-align:right;border-bottom:1px solid var(--border);">المساحة</th>
              <th style="padding:10px;text-align:right;border-bottom:1px solid var(--border);">اللون</th>
              <th style="padding:10px;text-align:right;border-bottom:1px solid var(--border);">الحالة</th>
              <th style="padding:10px;text-align:right;border-bottom:1px solid var(--border);">IMEI</th>
              <th style="padding:10px;text-align:right;border-bottom:1px solid var(--border);">التكلفة</th>
            </tr>
          </thead>
          <tbody>
            ${devicesTable}
          </tbody>
          <tfoot>
            <tr style="background:var(--bg-tertiary);font-weight:bold;">
              <td colspan="6" style="padding:10px;text-align:left;border-top:2px solid var(--border);">الإجمالي</td>
              <td style="padding:10px;border-top:2px solid var(--border);color:var(--success);">${fmt(totalCost)} ج.م</td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  `;

  showDetailsModal('تفاصيل فاتورة التوريد المتعدد', detailsHtml);
}
window.showBulkInvoiceDetails = showBulkInvoiceDetails;

// ═══════════════════════════════════════════════════════════════
// 📄 ENHANCED PAGINATION
// ═══════════════════════════════════════════════════════════════
function renderPaginationNew(containerId, tabName, totalItems) {
  const container = document.getElementById(containerId);
  if (!container) return;

  const totalPagesCount = Math.ceil(totalItems / ITEMS_PER_PAGE);
  const page = currentPageNum[tabName];

  if (totalPagesCount <= 1) {
    container.innerHTML = '';
    container.classList.remove('visible');
    return;
  }

  let html = `<div class="pagination-info">عرض ${((page - 1) * ITEMS_PER_PAGE) + 1} - ${Math.min(page * ITEMS_PER_PAGE, totalItems)} من ${totalItems}</div>`;
  html += '<div class="pagination-buttons">';

  html += `<button class="page-btn" ${page === 1 ? 'disabled' : ''} onclick="goToPageNew('${tabName}', ${page - 1})">❮</button>`;

  const maxVisible = 5;
  let startPage = Math.max(1, page - Math.floor(maxVisible / 2));
  let endPage = Math.min(totalPagesCount, startPage + maxVisible - 1);
  
  if (endPage - startPage < maxVisible - 1) {
    startPage = Math.max(1, endPage - maxVisible + 1);
  }

  if (startPage > 1) {
    html += `<button class="page-btn" onclick="goToPageNew('${tabName}', 1)">1</button>`;
    if (startPage > 2) html += '<span class="page-dots">...</span>';
  }

  for (let i = startPage; i <= endPage; i++) {
    html += `<button class="page-btn ${i === page ? 'active' : ''}" onclick="goToPageNew('${tabName}', ${i})">${i}</button>`;
  }

  if (endPage < totalPagesCount) {
    if (endPage < totalPagesCount - 1) html += '<span class="page-dots">...</span>';
    html += `<button class="page-btn" onclick="goToPageNew('${tabName}', ${totalPagesCount})">${totalPagesCount}</button>`;
  }

  html += `<button class="page-btn" ${page === totalPagesCount ? 'disabled' : ''} onclick="goToPageNew('${tabName}', ${page + 1})">❯</button>`;
  html += '</div>';

  container.innerHTML = html;
  
  // Setup scroll listener for showing pagination at 40%
  setupPaginationScrollListener(containerId, tabName);
}

// Scroll listener for pagination visibility
function setupPaginationScrollListener(containerId, tabName) {
  const container = document.getElementById(containerId);
  if (!container) return;
  
  // Find the table wrapper
  const tableWrapper = container.closest('.table-section')?.querySelector('.table-wrapper');
  if (!tableWrapper) {
    // لو مفيش table wrapper، يظهر الـ pagination مباشرة
    container.classList.add('visible');
    return;
  }
  
  // Remove old listener if exists
  if (tableWrapper._scrollHandler) {
    tableWrapper.removeEventListener('scroll', tableWrapper._scrollHandler);
  }
  
  // Create new scroll handler
  tableWrapper._scrollHandler = function() {
    const scrollTop = tableWrapper.scrollTop;
    const scrollHeight = tableWrapper.scrollHeight - tableWrapper.clientHeight;
    const scrollPercent = scrollHeight > 0 ? (scrollTop / scrollHeight) * 100 : 100;
    
    if (scrollPercent >= 40) {
      container.classList.add('visible');
    } else {
      container.classList.remove('visible');
    }
  };
  
  // Add listener
  tableWrapper.addEventListener('scroll', tableWrapper._scrollHandler);
  
  // Initial check - لو الجدول صغير أو مفيش scroll، يظهر مباشرة
  if (tableWrapper.scrollHeight <= tableWrapper.clientHeight) {
    container.classList.add('visible');
  } else {
    // Trigger initial check
    tableWrapper._scrollHandler();
  }
}

function goToPageNew(tabName, page) {
  const data = filteredData[tabName];
  const totalPagesCount = Math.ceil(data.length / ITEMS_PER_PAGE);
  
  if (page < 1 || page > totalPagesCount) return;
  
  currentPageNum[tabName] = page;
  renderAllPurchases();
}
window.goToPageNew = goToPageNew;

// ═══════════════════════════════════════════════════════════════
// 📊 RENDER ALL PURCHASES (UPDATED)
// ═══════════════════════════════════════════════════════════════
function renderAllPurchases() {
  const allBody = document.getElementById('allTableBody');
  const quickBody = document.getElementById('quickTableBody');
  
  // Render All tab
  if (allBody) {
    const data = filteredData.all || allPurchases;
    if (data.length === 0) {
      allBody.innerHTML = `<tr><td colspan="8"><div class="empty-state">
        <div class="empty-icon">${filters.searchTerm || filters.dateFrom ? '🔍' : '📱'}</div>
        <div class="empty-title arabic-text">${filters.searchTerm || filters.dateFrom ? 'لا توجد نتائج' : 'لا توجد توريدات'}</div>
      </div></td></tr>`;
      renderPaginationNew('paginationAll', 'all', 0);
    } else {
      const start = (currentPageNum.all - 1) * ITEMS_PER_PAGE;
      const paginatedData = data.slice(start, start + ITEMS_PER_PAGE);
      
      allBody.innerHTML = paginatedData.map((p, i) => {
        const date = new Date(p.created_at || p.purchase_date);
        const dateStr = date.toLocaleDateString('ar-EG', { month: 'short', day: 'numeric' });
        const sourceTypes = { vendor: 'تاجر', customer: 'عميل', store: 'المحل' };
        
        const isReturned = p.status === 'returned';
        return `<tr class="${isReturned ? 'returned-row' : ''}">
          <td>${start + i + 1}</td>
          <td>${dateStr}</td>
          <td><span class="badge ${p.purchase_type === 'bulk' ? 'info' : 'success'}">${p.purchase_type === 'bulk' ? 'متعدد' : 'سريع'}</span></td>
          <td><strong>${p.device_type || ''} ${p.device_model || '-'}</strong></td>
          <td>${sourceTypes[p.source_type] || p.source_type || '-'}</td>
          <td><strong style="color:var(--success)">${fmt(p.total_cost)}</strong></td>
          <td><span class="badge ${isReturned ? 'warning' : 'success'}">${isReturned ? 'مرتجع' : 'مكتمل'}</span></td>
          <td>
            <div style="display:flex;gap:6px;">
              <button class="btn-details" onclick="showPurchaseDetails(${p.id})">📋</button>
              <button class="btn-barcode" onclick="printDevicePurchaseBarcode(${p.id})" title="طباعة باركود">🏷️</button>
              ${!isReturned ? `<button class="btn-return" onclick="openPurchaseReturnModal(${p.id})" title="مرتجع">↩️</button>` : ''}
              ${!isReturned ? `<button class="btn-delete" onclick="deletePurchase(${p.id})" title="حذف التوريد">🗑️</button>` : ''}
            </div>
          </td>
        </tr>`;
      }).join('');

      renderPaginationNew('paginationAll', 'all', data.length);
    }
  }

  // Render Quick tab
  if (quickBody) {
    const data = filteredData.quick || [];
    if (data.length === 0) {
      quickBody.innerHTML = `<tr><td colspan="8"><div class="empty-state">
        <div class="empty-icon">⚡</div>
        <div class="empty-title arabic-text">لا توجد توريدات سريعة</div>
      </div></td></tr>`;
      renderPaginationNew('paginationQuick', 'quick', 0);
    } else {
      const start = (currentPageNum.quick - 1) * ITEMS_PER_PAGE;
      const paginatedData = data.slice(start, start + ITEMS_PER_PAGE);
      
      quickBody.innerHTML = paginatedData.map((p, i) => {
        const date = new Date(p.created_at || p.purchase_date);
        const dateStr = date.toLocaleDateString('ar-EG', { month: 'short', day: 'numeric' });
        const sourceTypes = { vendor: 'تاجر', customer: 'عميل', store: 'المحل' };
        const isReturned = p.status === 'returned';

        return `<tr class="${isReturned ? 'returned-row' : ''}">
          <td>${start + i + 1}</td>
          <td>${dateStr}</td>
          <td><strong>${p.device_type || ''} ${p.device_model || '-'}</strong></td>
          <td style="font-family:monospace;font-size:12px;">${p.imei1 || '-'}</td>
          <td>${sourceTypes[p.source_type] || '-'}</td>
          <td><strong style="color:var(--success)">${fmt(p.total_cost)}</strong></td>
          <td><span class="badge ${isReturned ? 'warning' : 'success'}">${isReturned ? 'مرتجع' : 'مكتمل'}</span></td>
          <td>
            <div style="display:flex;gap:6px;">
              <button class="btn-details" onclick="showPurchaseDetails(${p.id})">📋</button>
              <button class="btn-barcode" onclick="printDevicePurchaseBarcode(${p.id})" title="طباعة باركود">🏷️</button>
              ${!isReturned ? `<button class="btn-return" onclick="openPurchaseReturnModal(${p.id})" title="مرتجع">↩️</button>` : ''}
              ${!isReturned ? `<button class="btn-delete" onclick="deletePurchase(${p.id})" title="حذف التوريد">🗑️</button>` : ''}
            </div>
          </td>
        </tr>`;
      }).join('');

      renderPaginationNew('paginationQuick', 'quick', data.length);
    }
  }

  // Render Bulk tab - تجميع الأجهزة كفواتير
  const bulkBody = document.getElementById('bulkTableBody');
  if (bulkBody) {
    const bulkData = filteredData.bulk || [];

    if (bulkData.length === 0) {
      bulkBody.innerHTML = `<tr><td colspan="7"><div class="empty-state">
        <div class="empty-icon">📦</div>
        <div class="empty-title arabic-text">لا توجد توريدات متعددة</div>
      </div></td></tr>`;
      renderPaginationNew('paginationBulk', 'bulk', 0);
    } else {
      // تجميع الأجهزة كفواتير بناءً على التاريخ والمورد
      const invoicesMap = new Map();

      for (const p of bulkData) {
        // إنشاء مفتاح فريد للفاتورة (التاريخ + المورد)
        const dateKey = (p.created_at || p.purchase_date || '').split('T')[0];
        const supplierKey = p.supplier_id || p.party_name || 'unknown';
        const invoiceKey = `${dateKey}_${supplierKey}`;

        if (!invoicesMap.has(invoiceKey)) {
          invoicesMap.set(invoiceKey, {
            date: p.created_at || p.purchase_date,
            supplier_name: p.party_name || p.supplier_name || '-',
            supplier_id: p.supplier_id,
            devices: [],
            total_cost: 0,
            device_ids: []
          });
        }

        const invoice = invoicesMap.get(invoiceKey);
        invoice.devices.push(p);
        invoice.total_cost += parseFloat(p.total_cost) || 0;
        invoice.device_ids.push(p.id);
      }

      // تحويل الـ Map لـ Array وترتيبها بالتاريخ
      const invoices = Array.from(invoicesMap.values()).sort((a, b) =>
        new Date(b.date) - new Date(a.date)
      );

      const start = (currentPageNum.bulk - 1) * ITEMS_PER_PAGE;
      const paginatedInvoices = invoices.slice(start, start + ITEMS_PER_PAGE);

      bulkBody.innerHTML = paginatedInvoices.map((inv, i) => {
        const date = new Date(inv.date);
        const dateStr = date.toLocaleDateString('ar-EG', { month: 'short', day: 'numeric' });
        const deviceIds = inv.device_ids.join(',');

        return `<tr>
          <td>${start + i + 1}</td>
          <td>${dateStr}</td>
          <td><strong style="color:var(--info)">${inv.devices.length} جهاز</strong></td>
          <td>${inv.supplier_name}</td>
          <td><strong style="color:var(--success)">${fmt(inv.total_cost)}</strong></td>
          <td><span class="badge success">مكتمل</span></td>
          <td><button class="btn-details" onclick="showBulkInvoiceDetails([${deviceIds}])">📋 تفاصيل</button></td>
        </tr>`;
      }).join('');

      renderPaginationNew('paginationBulk', 'bulk', invoices.length);
    }
  }
}

// ═══════════════════════════════════════════════════════════════
// 🔄 PURCHASE RETURN FUNCTIONS
// ═══════════════════════════════════════════════════════════════

// متغير لتخزين بيانات المرتجع الحالي
let currentReturnPurchase = null;
let currentSupplierBalance = 0;

async function openPurchaseReturnModal(purchaseId) {
  // البحث عن التوريد
  let purchase = allPurchases.find(p => p.id === purchaseId || p.id === String(purchaseId));

  if (!purchase) {
    purchase = filteredData.all.find(p => p.id === purchaseId || p.id === String(purchaseId));
  }

  if (!purchase) {
    showToast('لم يتم العثور على التوريد', 'error');
    return;
  }

  // التحقق من حالة الجهاز
  if (purchase.status === 'returned') {
    showToast('هذا التوريد تم إرجاعه مسبقاً', 'warning');
    return;
  }

  currentReturnPurchase = purchase;

  // جلب رصيد المورد لو موجود
  currentSupplierBalance = 0;
  if (purchase.supplier_id) {
    try {
      const response = await fetch(`elos-db://suppliers?id=${purchase.supplier_id}`);
      const result = await response.json();
      // الـ API بيرجع الـ object مباشرة لما نطلب بـ id
      if (result && result.balance !== undefined) {
        currentSupplierBalance = parseFloat(result.balance) || 0;
      } else if (result.success && result.data && result.data.length > 0) {
        currentSupplierBalance = parseFloat(result.data[0].balance) || 0;
      }
      Logger.log('[RETURN] Supplier balance:', currentSupplierBalance, 'for supplier_id:', purchase.supplier_id);
    } catch (err) {
      Logger.error('[RETURN] Error fetching supplier balance:', err);
    }
  } else {
    Logger.log('[RETURN] No supplier_id found in purchase:', purchase);
  }

  const deviceInfo = `${purchase.device_type || ''} ${purchase.device_model || ''}`.trim() || 'جهاز';
  const supplierName = purchase.party_name || purchase.supplier_name || '-';
  const totalCost = parseFloat(purchase.total_cost) || 0;

  // التحقق من حالة التسوية
  const needsSettlement = totalCost > currentSupplierBalance && currentSupplierBalance >= 0;
  const settlementAmount = needsSettlement ? totalCost - currentSupplierBalance : 0;

  const modalHtml = `
    <div id="purchaseReturnModal" class="modal-overlay" style="display:flex;position:fixed;inset:0;background:rgba(0,0,0,0.75);backdrop-filter:blur(4px);z-index:10000;align-items:center;justify-content:center;">
      <div class="modal" style="background:var(--bg-secondary);border:1px solid var(--border);border-radius:16px;max-width:550px;width:95%;max-height:90vh;display:flex;flex-direction:column;">
        <div class="modal-header" style="display:flex;justify-content:space-between;align-items:center;padding:20px 24px;border-bottom:1px solid var(--border);background:linear-gradient(135deg, rgba(239,68,68,0.1) 0%, rgba(239,68,68,0.05) 100%);">
          <div style="display:flex;align-items:center;gap:10px;font-size:18px;font-weight:700;color:var(--danger);">
            <span>↩️</span>
            <span>مرتجع مشتريات</span>
          </div>
          <button onclick="closePurchaseReturnModal()" style="background:none;border:none;color:var(--text-secondary);font-size:24px;cursor:pointer;">✕</button>
        </div>

        <div class="modal-body" style="padding:24px;overflow-y:auto;flex:1;">
          <!-- معلومات الجهاز -->
          <div style="background:var(--bg-tertiary);border:1px solid var(--border);border-radius:12px;padding:16px;margin-bottom:20px;">
            <div style="display:flex;align-items:center;gap:10px;margin-bottom:12px;color:var(--accent);font-weight:600;">
              <span>📱</span>
              <span>معلومات الجهاز</span>
            </div>
            <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;">
              <div>
                <div style="font-size:11px;color:var(--text-secondary);margin-bottom:4px;">الجهاز</div>
                <div style="font-weight:600;">${deviceInfo}</div>
              </div>
              <div>
                <div style="font-size:11px;color:var(--text-secondary);margin-bottom:4px;">المورد</div>
                <div style="font-weight:600;">${supplierName}</div>
              </div>
              <div>
                <div style="font-size:11px;color:var(--text-secondary);margin-bottom:4px;">IMEI</div>
                <div style="font-family:monospace;font-size:12px;">${purchase.imei1 || '-'}</div>
              </div>
              <div>
                <div style="font-size:11px;color:var(--text-secondary);margin-bottom:4px;">سعر الشراء</div>
                <div style="font-weight:700;color:var(--success);">${fmt(totalCost)} ج.م</div>
              </div>
            </div>
          </div>

          ${needsSettlement ? `
          <!-- قسم التسوية الذكية -->
          <div id="settlementSection" style="background:linear-gradient(135deg, rgba(245,158,11,0.15) 0%, rgba(245,158,11,0.05) 100%);border:2px solid rgba(245,158,11,0.4);border-radius:12px;padding:16px;margin-bottom:20px;">
            <div style="display:flex;align-items:center;gap:10px;margin-bottom:16px;">
              <span style="font-size:24px;">⚠️</span>
              <div>
                <div style="font-weight:700;color:var(--warning);font-size:15px;">قيمة المرتجع أكبر من رصيد المورد</div>
                <div style="font-size:12px;color:var(--text-secondary);margin-top:4px;">يجب تحديد كيفية التعامل مع الفرق</div>
              </div>
            </div>

            <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:12px;margin-bottom:16px;background:var(--bg-secondary);border-radius:8px;padding:12px;">
              <div style="text-align:center;">
                <div style="font-size:11px;color:var(--text-secondary);margin-bottom:4px;">رصيد المورد الحالي</div>
                <div style="font-weight:700;color:var(--danger);">${fmt(currentSupplierBalance)} ج.م</div>
              </div>
              <div style="text-align:center;">
                <div style="font-size:11px;color:var(--text-secondary);margin-bottom:4px;">قيمة المرتجع</div>
                <div style="font-weight:700;color:var(--warning);">${fmt(totalCost)} ج.م</div>
              </div>
              <div style="text-align:center;">
                <div style="font-size:11px;color:var(--text-secondary);margin-bottom:4px;">الفرق لصالحك</div>
                <div style="font-weight:700;color:var(--success);">${fmt(settlementAmount)} ج.م</div>
              </div>
            </div>

            <div style="font-size:13px;color:var(--text-secondary);margin-bottom:10px;">كيف تريد التعامل مع الفرق؟</div>
            <div style="display:flex;flex-direction:column;gap:8px;">
              <label style="display:flex;align-items:center;gap:10px;padding:10px 12px;background:var(--bg-secondary);border:1px solid var(--border);border-radius:8px;cursor:pointer;transition:all 0.2s;">
                <input type="radio" name="settlementOption" value="refund_cash" checked style="accent-color:var(--success);">
                <span>💵 استرداد نقدي (إضافة للكاش)</span>
              </label>
              <label style="display:flex;align-items:center;gap:10px;padding:10px 12px;background:var(--bg-secondary);border:1px solid var(--border);border-radius:8px;cursor:pointer;transition:all 0.2s;">
                <input type="radio" name="settlementOption" value="refund_wallet" onchange="updatePurchaseReturnWalletsList()" style="accent-color:var(--success);">
                <span>📱 استرداد على المحفظة الإلكترونية</span>
              </label>
              <label style="display:flex;align-items:center;gap:10px;padding:10px 12px;background:var(--bg-secondary);border:1px solid var(--border);border-radius:8px;cursor:pointer;transition:all 0.2s;">
                <input type="radio" name="settlementOption" value="refund_bank" onchange="updatePurchaseReturnWalletsList()" style="accent-color:var(--success);">
                <span>🏦 استرداد على الحساب البنكي</span>
              </label>
              <!-- ✅ Dropdown للمحافظ المحددة -->
              <div id="purchaseReturnWalletSelectGroup" style="margin-top: 8px; display: none; margin-right: 24px;">
                <label style="font-size: 13px; color: var(--text-secondary); display: block; margin-bottom: 6px;">اختر المحفظة المحددة</label>
                <select id="purchaseReturnWalletSelect" style="width: 100%; padding: 10px; background: var(--bg-secondary); border: 1px solid var(--border); border-radius: 8px; color: var(--text-primary); font-size: 14px;">
                  <option value="">-- اختر المحفظة --</option>
                </select>
              </div>
              <label style="display:flex;align-items:center;gap:10px;padding:10px 12px;background:var(--bg-secondary);border:1px solid var(--border);border-radius:8px;cursor:pointer;transition:all 0.2s;">
                <input type="radio" name="settlementOption" value="keep_credit" style="accent-color:var(--success);">
                <span>📋 إبقاء كرصيد دائن (يُخصم من الفاتورة القادمة)</span>
              </label>
            </div>
          </div>
          ` : `
          <!-- تفاصيل المرتجع العادي -->
          <div style="background:var(--bg-tertiary);border:1px solid var(--border);border-radius:12px;padding:16px;margin-bottom:20px;">
            <div style="display:flex;align-items:center;gap:10px;margin-bottom:12px;color:var(--success);font-weight:600;">
              <span>✅</span>
              <span>رصيد المورد كافٍ</span>
            </div>
            <div style="font-size:13px;color:var(--text-secondary);">
              رصيد المورد الحالي: <strong>${fmt(currentSupplierBalance)} ج.م</strong><br>
              سيتم خصم <strong>${fmt(totalCost)} ج.م</strong> من رصيده
            </div>
          </div>
          `}

          <!-- سبب الإرجاع -->
          <div style="background:var(--bg-tertiary);border:1px solid var(--border);border-radius:12px;padding:16px;margin-bottom:20px;">
            <div class="form-group">
              <label style="display:block;margin-bottom:6px;font-size:13px;color:var(--text-secondary);">سبب الإرجاع</label>
              <select id="returnReason"
                style="width:100%;padding:12px;background:var(--bg-secondary);border:1px solid var(--border);border-radius:8px;color:var(--text-primary);font-size:14px;">
                <option value="عيب مصنعي">عيب مصنعي</option>
                <option value="مواصفات غير مطابقة">مواصفات غير مطابقة</option>
                <option value="تلف أثناء الشحن">تلف أثناء الشحن</option>
                <option value="خطأ في الطلب">خطأ في الطلب</option>
                <option value="جهاز مستعمل/ليس جديد">جهاز مستعمل/ليس جديد</option>
                <option value="مشكلة في البطارية">مشكلة في البطارية</option>
                <option value="مشكلة في الشاشة">مشكلة في الشاشة</option>
                <option value="اتفاق مع المورد">اتفاق مع المورد</option>
                <option value="سبب آخر">سبب آخر</option>
              </select>
            </div>
          </div>

          <!-- ملخص العملية -->
          <div style="background:rgba(16,185,129,0.1);border:1px solid rgba(16,185,129,0.3);border-radius:8px;padding:12px;display:flex;align-items:center;gap:10px;">
            <span style="font-size:18px;">📋</span>
            <div style="font-size:13px;color:var(--success);">
              ${needsSettlement
                ? `سيتم تصفير دين المورد (${fmt(currentSupplierBalance)} ج.م) واسترداد الفرق (${fmt(settlementAmount)} ج.م) حسب اختيارك`
                : `سيتم خصم ${fmt(totalCost)} ج.م من رصيد المورد`
              }
            </div>
          </div>
        </div>

        <div class="modal-footer" style="display:flex;gap:12px;justify-content:flex-end;padding:16px 24px;border-top:1px solid var(--border);background:var(--bg-tertiary);">
          <button onclick="closePurchaseReturnModal()" style="padding:12px 24px;background:var(--bg-secondary);color:var(--text-secondary);border:1px solid var(--border);border-radius:8px;cursor:pointer;font-weight:600;">إلغاء</button>
          <button onclick="submitPurchaseReturn(${purchase.id})" style="padding:12px 24px;background:linear-gradient(135deg, var(--danger) 0%, #dc2626 100%);color:white;border:none;border-radius:8px;cursor:pointer;font-weight:600;">تأكيد الإرجاع</button>
        </div>
      </div>
    </div>
  `;

  // إزالة أي مودال قديم
  const existingModal = document.getElementById('purchaseReturnModal');
  if (existingModal) existingModal.remove();

  document.body.insertAdjacentHTML('beforeend', modalHtml);
  document.body.style.overflow = 'hidden';
  
  // ✅ تحميل المحافظ عند فتح المودال
  await loadPaymentWallets();
}
window.openPurchaseReturnModal = openPurchaseReturnModal;

function closePurchaseReturnModal() {
  const modal = document.getElementById('purchaseReturnModal');
  if (modal) {
    modal.remove();
    document.body.style.overflow = '';
  }
  currentReturnPurchase = null;
  currentSupplierBalance = 0;
}
window.closePurchaseReturnModal = closePurchaseReturnModal;

async function submitPurchaseReturn(purchaseId) {
  if (!currentReturnPurchase) {
    showToast('خطأ: بيانات التوريد غير متوفرة', 'error');
    return;
  }

  const totalCost = parseFloat(currentReturnPurchase.total_cost) || 0;
  const reason = document.getElementById('returnReason')?.value || 'سبب آخر';

  // ✅ تحديد خيار التسوية والمحفظة المحددة
  let settlementOption = null;
  const settlementRadio = document.querySelector('input[name="settlementOption"]:checked');
  if (settlementRadio) {
    settlementOption = settlementRadio.value;
  }
  
  // ✅ الحصول على المحفظة المحددة (للمحافظ الإلكترونية والحسابات البنكية)
  let walletId = null;
  if (settlementOption === 'refund_wallet' || settlementOption === 'refund_bank') {
    const walletSelect = document.getElementById('purchaseReturnWalletSelect');
    if (walletSelect && walletSelect.value) {
      walletId = parseInt(walletSelect.value);
    }
    // تحديد wallet_type بناءً على settlementOption
    const walletType = settlementOption === 'refund_wallet' ? 'mobile_wallet' : 'bank';
    // إرسال wallet_type و wallet_id
    // (سيتم إرسالهما في body)
  }

  try {
    const response = await fetch('elos-db://purchase-return', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        purchase_id: purchaseId,
        refund_amount: totalCost,
        settlement_option: settlementOption,
        wallet_type: (settlementOption === 'refund_wallet' || settlementOption === 'refund_bank') 
          ? (settlementOption === 'refund_wallet' ? 'mobile_wallet' : 'bank') 
          : null, // للتوافق العكسي
        wallet_id: walletId, // ✅ المحفظة المحددة
        reason: reason
      })
    });

    const result = await response.json();

    if (result.success) {
      showToast('تم إرجاع الجهاز بنجاح', 'success');

      // رسالة التسوية
      if (result.settlementRefund > 0) {
        const settlementMessages = {
          refund_cash: `💵 تم استرداد ${fmt(result.settlementRefund)} ج.م نقداً`,
          refund_wallet: `📱 تم استرداد ${fmt(result.settlementRefund)} ج.م على المحفظة`,
          refund_bank: `🏦 تم استرداد ${fmt(result.settlementRefund)} ج.م على البنك`,
          keep_credit: `📋 تم إضافة ${fmt(result.settlementRefund)} ج.م كرصيد دائن للمورد`
        };
        setTimeout(() => {
          showToast(settlementMessages[result.settlementOption] || `تم تسوية ${fmt(result.settlementRefund)} ج.م`, 'success');
        }, 500);
      }

      closePurchaseReturnModal();
      // تحديث البيانات
      await loadPurchases();
    } else {
      showToast(result.error || 'حدث خطأ أثناء الإرجاع', 'error');
    }
  } catch (error) {
    Logger.error('[RETURN] Error:', error);
    showToast('حدث خطأ في الاتصال', 'error');
  }
}
window.submitPurchaseReturn = submitPurchaseReturn;

// ✅ تحديث قائمة المحافظ حسب نوع التسوية (للمرتجع)
async function updatePurchaseReturnWalletsList() {
  const settlementRadio = document.querySelector('input[name="settlementOption"]:checked');
  const walletSelectGroup = document.getElementById('purchaseReturnWalletSelectGroup');
  const walletSelect = document.getElementById('purchaseReturnWalletSelect');
  
  if (!settlementRadio || !walletSelectGroup || !walletSelect) return;
  
  const settlementOption = settlementRadio.value;
  
  // فقط للمحافظ الإلكترونية والحسابات البنكية
  if (settlementOption !== 'refund_wallet' && settlementOption !== 'refund_bank') {
    walletSelectGroup.style.display = 'none';
    return;
  }
  
  const walletType = settlementOption === 'refund_wallet' ? 'mobile_wallet' : 'bank';
  
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
window.updatePurchaseReturnWalletsList = updatePurchaseReturnWalletsList;

// ═══════════════════════════════════════════════════════════════
// 🔄 RETURNS TAB FUNCTIONS
// ═══════════════════════════════════════════════════════════════

let allReturns = [];
let currentReturnsPage = 1;
const RETURNS_PER_PAGE = 20;

function showReturnsTab() {
  switchViewTab('returns');
  loadPurchaseReturns();
}
window.showReturnsTab = showReturnsTab;

async function loadPurchaseReturns() {
  try {
    const response = await fetch('elos-db://purchase-returns');
    allReturns = await response.json();

    // تحديث العداد
    const countEl = document.getElementById('returnsCount');
    if (countEl) {
      if (allReturns.length > 0) {
        countEl.textContent = allReturns.length;
        countEl.style.display = 'inline';
      } else {
        countEl.style.display = 'none';
      }
    }

    // تحديث الإجمالي
    const totalRefund = allReturns.reduce((sum, r) => sum + (parseFloat(r.refund_amount) || 0), 0);
    const totalEl = document.getElementById('returnsTotal');
    if (totalEl) {
      totalEl.textContent = `إجمالي المستردات: ${fmt(totalRefund)} ج.م`;
    }

    renderReturnsTable();
  } catch (error) {
    Logger.error('Error loading returns:', error);
    showToast('خطأ في تحميل المرتجعات', 'error');
  }
}

function renderReturnsTable() {
  const tbody = document.getElementById('returnsTableBody');
  if (!tbody) return;

  if (allReturns.length === 0) {
    tbody.innerHTML = `<tr><td colspan="8"><div class="empty-state">
      <div class="empty-icon">↩️</div>
      <div class="empty-title arabic-text">لا توجد مرتجعات</div>
      <div class="empty-text arabic-text">لم يتم تسجيل أي مرتجعات بعد</div>
    </div></td></tr>`;
    renderPaginationNew('paginationReturns', 'returns', 0);
    return;
  }

  const start = (currentReturnsPage - 1) * RETURNS_PER_PAGE;
  const paginatedData = allReturns.slice(start, start + RETURNS_PER_PAGE);

  tbody.innerHTML = paginatedData.map((r, i) => {
    const date = new Date(r.created_at);
    const dateStr = date.toLocaleDateString('ar-EG', { month: 'short', day: 'numeric', year: 'numeric' });
    const itemType = r.item_type === 'accessory' ? 'إكسسوار' : 'جهاز';
    const itemName = r.item_type === 'accessory'
      ? `${r.device_type || ''}`
      : `${r.device_type || ''} ${r.device_model || ''}`;
    const statusBadge = r.status === 'completed'
      ? '<span class="badge success">مكتمل</span>'
      : '<span class="badge warning">معلق</span>';

    return `<tr>
      <td>${start + i + 1}</td>
      <td>${dateStr}</td>
      <td><span class="badge ${r.item_type === 'accessory' ? 'info' : 'purple'}">${itemType}</span></td>
      <td><strong>${itemName}</strong>${r.imei1 ? `<br><small style="font-family:monospace;color:var(--text-secondary)">${r.imei1}</small>` : ''}</td>
      <td>${r.supplier_name || r.party_name || '-'}</td>
      <td><strong style="color:var(--success)">${fmt(r.refund_amount)} ج.م</strong></td>
      <td style="max-width:150px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;" title="${r.return_reason || ''}">${r.return_reason || '-'}</td>
      <td>${statusBadge}</td>
    </tr>`;
  }).join('');

  // Pagination
  const totalPages = Math.ceil(allReturns.length / RETURNS_PER_PAGE);
  const container = document.getElementById('paginationReturns');
  if (container && totalPages > 1) {
    let html = `<div class="pagination-info">عرض ${start + 1} - ${Math.min(start + RETURNS_PER_PAGE, allReturns.length)} من ${allReturns.length}</div>`;
    html += '<div class="pagination-buttons">';
    html += `<button class="page-btn" ${currentReturnsPage === 1 ? 'disabled' : ''} onclick="goToReturnsPage(${currentReturnsPage - 1})">❮</button>`;

    for (let p = 1; p <= totalPages; p++) {
      if (p === 1 || p === totalPages || (p >= currentReturnsPage - 2 && p <= currentReturnsPage + 2)) {
        html += `<button class="page-btn ${p === currentReturnsPage ? 'active' : ''}" onclick="goToReturnsPage(${p})">${p}</button>`;
      } else if (p === currentReturnsPage - 3 || p === currentReturnsPage + 3) {
        html += '<span class="page-dots">...</span>';
      }
    }

    html += `<button class="page-btn" ${currentReturnsPage === totalPages ? 'disabled' : ''} onclick="goToReturnsPage(${currentReturnsPage + 1})">❯</button>`;
    html += '</div>';
    container.innerHTML = html;
    container.classList.add('visible');
  } else if (container) {
    container.innerHTML = '';
    container.classList.remove('visible');
  }
}

function goToReturnsPage(page) {
  const totalPages = Math.ceil(allReturns.length / RETURNS_PER_PAGE);
  if (page < 1 || page > totalPages) return;
  currentReturnsPage = page;
  renderReturnsTable();
}
window.goToReturnsPage = goToReturnsPage;

// ═══════════════════════════════════════════════════════════════
// 🔄 RETURN SELECTION MODAL - مودال اختيار المشتريات للإرجاع
// ═══════════════════════════════════════════════════════════════

let returnSelectionData = [];

function openReturnSelectionModal() {
  // جلب المشتريات الغير مرتجعة
  const availablePurchases = allPurchases.filter(p => p.status !== 'returned');

  returnSelectionData = availablePurchases;

  const modalHtml = `
    <div id="returnSelectionModal" class="modal-overlay" style="display:flex;position:fixed;inset:0;background:rgba(0,0,0,0.75);backdrop-filter:blur(4px);z-index:10000;align-items:center;justify-content:center;">
      <div class="modal" style="background:var(--bg-secondary);border:1px solid var(--border);border-radius:16px;max-width:900px;width:95%;max-height:90vh;display:flex;flex-direction:column;">
        <div class="modal-header" style="display:flex;justify-content:space-between;align-items:center;padding:20px 24px;border-bottom:1px solid var(--border);background:linear-gradient(135deg, rgba(245,158,11,0.1) 0%, rgba(245,158,11,0.05) 100%);">
          <div style="display:flex;align-items:center;gap:10px;font-size:18px;font-weight:700;color:var(--warning);">
            <span>↩️</span>
            <span>اختر المشتريات للإرجاع</span>
          </div>
          <button onclick="closeReturnSelectionModal()" style="background:none;border:none;color:var(--text-secondary);font-size:24px;cursor:pointer;">✕</button>
        </div>

        <div style="padding:16px 24px;border-bottom:1px solid var(--border);background:var(--bg-tertiary);">
          <input type="text" id="returnSearchInput" placeholder="🔍 بحث بالموديل، IMEI، اسم المورد..."
            style="width:100%;padding:12px 16px;background:var(--bg-secondary);border:1px solid var(--border);border-radius:8px;color:var(--text-primary);font-size:14px;"
            oninput="filterReturnSelectionList()">
        </div>

        <div class="modal-body" style="padding:0;overflow-y:auto;flex:1;max-height:500px;">
          <table style="width:100%;border-collapse:collapse;">
            <thead style="position:sticky;top:0;background:var(--bg-tertiary);z-index:1;">
              <tr>
                <th style="padding:12px;text-align:right;border-bottom:1px solid var(--border);">التاريخ</th>
                <th style="padding:12px;text-align:right;border-bottom:1px solid var(--border);">الجهاز</th>
                <th style="padding:12px;text-align:right;border-bottom:1px solid var(--border);">IMEI</th>
                <th style="padding:12px;text-align:right;border-bottom:1px solid var(--border);">المورد</th>
                <th style="padding:12px;text-align:right;border-bottom:1px solid var(--border);">التكلفة</th>
                <th style="padding:12px;text-align:center;border-bottom:1px solid var(--border);">إرجاع</th>
              </tr>
            </thead>
            <tbody id="returnSelectionList">
              ${renderReturnSelectionRows(availablePurchases)}
            </tbody>
          </table>
          ${availablePurchases.length === 0 ? `
            <div style="padding:40px;text-align:center;">
              <div style="font-size:48px;margin-bottom:16px;">📦</div>
              <div style="color:var(--text-secondary);">لا توجد مشتريات متاحة للإرجاع</div>
            </div>
          ` : ''}
        </div>

        <div class="modal-footer" style="display:flex;gap:12px;justify-content:space-between;padding:16px 24px;border-top:1px solid var(--border);background:var(--bg-tertiary);">
          <div style="color:var(--text-secondary);font-size:13px;">
            إجمالي المشتريات المتاحة: <strong style="color:var(--text-primary)">${availablePurchases.length}</strong>
          </div>
          <button onclick="closeReturnSelectionModal()" style="padding:12px 24px;background:var(--bg-secondary);color:var(--text-secondary);border:1px solid var(--border);border-radius:8px;cursor:pointer;font-weight:600;">إغلاق</button>
        </div>
      </div>
    </div>
  `;

  // إزالة أي مودال قديم
  const existingModal = document.getElementById('returnSelectionModal');
  if (existingModal) existingModal.remove();

  document.body.insertAdjacentHTML('beforeend', modalHtml);
  document.body.style.overflow = 'hidden';

  // التركيز على البحث
  setTimeout(() => {
    document.getElementById('returnSearchInput')?.focus();
  }, 100);
}
window.openReturnSelectionModal = openReturnSelectionModal;

function renderReturnSelectionRows(purchases) {
  if (!purchases || purchases.length === 0) return '';

  return purchases.map(p => {
    const date = new Date(p.created_at || p.purchase_date);
    const dateStr = date.toLocaleDateString('ar-EG', { month: 'short', day: 'numeric' });
    const deviceName = `${p.device_type || ''} ${p.device_model || ''}`.trim() || '-';
    const supplierName = p.supplier_name || p.party_name || '-';

    return `<tr style="border-bottom:1px solid var(--border);transition:background 0.2s;" onmouseover="this.style.background='var(--bg-tertiary)'" onmouseout="this.style.background=''">
      <td style="padding:12px;">${dateStr}</td>
      <td style="padding:12px;"><strong>${deviceName}</strong></td>
      <td style="padding:12px;font-family:monospace;font-size:12px;">${p.imei1 || '-'}</td>
      <td style="padding:12px;">${supplierName}</td>
      <td style="padding:12px;"><strong style="color:var(--success)">${fmt(p.total_cost)} ج.م</strong></td>
      <td style="padding:12px;text-align:center;">
        <button onclick="selectPurchaseForReturn(${p.id})" style="padding:8px 16px;background:linear-gradient(135deg, var(--warning) 0%, #d97706 100%);color:white;border:none;border-radius:6px;cursor:pointer;font-weight:600;font-size:12px;">
          ↩️ إرجاع
        </button>
      </td>
    </tr>`;
  }).join('');
}

function filterReturnSelectionList() {
  const searchTerm = document.getElementById('returnSearchInput').value.toLowerCase().trim();
  const tbody = document.getElementById('returnSelectionList');

  if (!searchTerm) {
    tbody.innerHTML = renderReturnSelectionRows(returnSelectionData);
    return;
  }

  const filtered = returnSelectionData.filter(p => {
    const deviceName = `${p.device_type || ''} ${p.device_model || ''}`.toLowerCase();
    const imei = (p.imei1 || '').toLowerCase();
    const supplier = (p.supplier_name || p.party_name || '').toLowerCase();
    return deviceName.includes(searchTerm) || imei.includes(searchTerm) || supplier.includes(searchTerm);
  });

  tbody.innerHTML = renderReturnSelectionRows(filtered);

  if (filtered.length === 0) {
    tbody.innerHTML = `<tr><td colspan="6" style="padding:40px;text-align:center;color:var(--text-secondary);">لا توجد نتائج مطابقة</td></tr>`;
  }
}
window.filterReturnSelectionList = filterReturnSelectionList;

function selectPurchaseForReturn(purchaseId) {
  closeReturnSelectionModal();
  openPurchaseReturnModal(purchaseId);
}
window.selectPurchaseForReturn = selectPurchaseForReturn;

function closeReturnSelectionModal() {
  const modal = document.getElementById('returnSelectionModal');
  if (modal) {
    modal.remove();
    document.body.style.overflow = '';
  }
}
window.closeReturnSelectionModal = closeReturnSelectionModal;

// ═══════════════════════════════════════════════════════════════
// 🗑️ DELETE PURCHASE (حذف التوريد مع عكس العمليات)
// ═══════════════════════════════════════════════════════════════

/**
 * حذف توريد جهاز مع عكس كل العمليات المحاسبية
 */
async function deletePurchase(purchaseId) {
  const purchase = allPurchases.find(p => p.id === purchaseId);
  if (!purchase) {
    showToast('لم يتم العثور على التوريد', 'error');
    return;
  }

  const deviceName = `${purchase.device_type || ''} ${purchase.device_model || ''}`.trim() || 'غير معروف';
  const partyName = purchase.party_name || purchase.supplier_name || 'غير محدد';

  const confirmed = await showConfirm(
    `⚠️ تأكيد حذف التوريد\n\n📱 الجهاز: ${deviceName}\n🔢 IMEI: ${purchase.imei1 || '-'}\n🏢 المصدر: ${partyName}\n💰 التكلفة: ${fmt(purchase.total_cost)} ج.م\n\n❗ سيتم:\n• حذف الجهاز من المخزون (لو موجود)\n• عكس حركات الخزنة\n• تعديل رصيد المورد`,
    'حذف وعكس العمليات',
    'إلغاء',
    'danger'
  );

  if (!confirmed) return;

  try {
    const response = await fetch(`elos-db://purchases/${purchaseId}`, {
      method: 'DELETE'
    });

    const result = await response.json();

    if (result.success) {
      showToast(`تم حذف توريد ${deviceName} وعكس العمليات بنجاح ✓`, 'success');
      await loadPurchases();
    } else {
      throw new Error(result.message || 'فشل حذف التوريد');
    }
  } catch (error) {
    console.error('[DELETE PURCHASE] Error:', error);
    showToast('فشل حذف التوريد: ' + error.message, 'error');
  }
}
window.deletePurchase = deletePurchase;

// ═══════════════════════════════════════════════════════════════
// 🏷️ PRINT DEVICE BARCODE (طباعة باركود الجهاز)
// ═══════════════════════════════════════════════════════════════

/**
 * طباعة باركود لجهاز من التوريد
 */
async function printDevicePurchaseBarcode(purchaseId) {
  const purchase = allPurchases.find(p => p.id === purchaseId);
  if (!purchase) {
    showToast('لم يتم العثور على التوريد', 'error');
    return;
  }

  try {
    // جلب بيانات الجهاز الفعلية من الـ API للحصول على short_code
    let device = null;
    if (purchase.device_id) {
      const response = await fetch(`elos-db://devices/${purchase.device_id}`);
      if (response.ok) {
        const data = await response.json();
        device = data.device || data;
        console.log('[BARCODE] Device from API:', device);
      }
    }

    if (!device) {
      showToast('لم يتم العثور على الجهاز في المخزن', 'error');
      return;
    }

    // استخدام short_code من الجهاز أو توليد واحد جديد
    let shortCode = device.short_code;

    // لو مفيش short_code، نولد واحد جديد ونحفظه
    if (!shortCode) {
      console.log('[BARCODE] No short_code found, generating new one...');
      if (typeof window.BarcodeGenerator?.generateAndSaveShortCode === 'function') {
        await window.BarcodeGenerator.generateAndSaveShortCode(device, 'device');
        shortCode = device.short_code;
        console.log('[BARCODE] Generated short_code:', shortCode);
      }
    }

    // تجهيز بيانات الجهاز للباركود (نفس طريقة صفحة المخزون)
    const deviceData = {
      ...device,
      short_code: device.short_code || device.barcode || device.code,
      barcode: device.short_code || device.barcode || device.code,
      code: device.short_code || device.code || device.barcode
    };

    console.log('[BARCODE] Device data for print:', deviceData);
    console.log('[BARCODE] short_code:', deviceData.short_code);

    // استخدام showBarcodePreviewModal مثل صفحة المخزون
    if (window.BarcodeGenerator && typeof window.BarcodeGenerator.showBarcodePreviewModal === 'function') {
      window.BarcodeGenerator.showBarcodePreviewModal(deviceData, 'device');
    } else if (typeof BarcodeService !== 'undefined' && BarcodeService.printLabels) {
      await BarcodeService.printLabels([deviceData], {
        type: 'device',
        copies: 1,
        showPrice: true
      });
    } else {
      showToast('لا تتوفر طريقة لطباعة الباركود', 'warning');
    }
  } catch (error) {
    console.error('[PRINT BARCODE] Error:', error);
    showToast('فشل طباعة الباركود: ' + error.message, 'error');
  }
}
window.printDevicePurchaseBarcode = printDevicePurchaseBarcode;

// ═══════════════════════════════════════════════════════════════
