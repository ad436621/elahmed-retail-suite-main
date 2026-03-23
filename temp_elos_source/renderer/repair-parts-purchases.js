// ═════════════════════════════════════════════════════════════
// 🔧 REPAIR PARTS PURCHASES - MODERN SYSTEM v1.0 (Using Shared Utils)
// ═════════════════════════════════════════════════════════════

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

// 🌐 GLOBAL STATE
let allRepairParts = [];
let allSuppliers = [];
let allPurchases = [];
let allInvoices = [];
let selectedQuickRepairPart = null;
let invoiceItems = [];
let paymentWallets = []; // ✅ المحافظ الفعلية من قاعدة البيانات

// 📄 PAGINATION STATE
const ITEMS_PER_PAGE = 25;
let currentPage = {
  all: 1,
  invoices: 1,
  quick: 1
};
let filteredData = {
  all: [],
  invoices: [],
  quick: []
};

// 🔍 FILTER STATE
let filters = {
  dateFrom: '',
  dateTo: '',
  supplierId: '',
  searchTerm: ''
};

// 🔧 UTILITIES
// fmt() is now imported from utils.js (window.fmt)

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

// ✅ تحديث قائمة المحافظ حسب النوع (للتوريد)
async function updateAccessoryPaymentWalletsList(prefix) {
  const walletTypeSelect = document.getElementById(`${prefix}PaymentMethod`);
  const walletSelectGroup = document.getElementById(`${prefix}WalletSelectGroup`);
  const walletSelect = document.getElementById(`${prefix}WalletSelect`);
  const paidAmountInput = document.getElementById(`${prefix}PaidAmount`);

  if (!walletTypeSelect || !walletSelectGroup || !walletSelect) return;

  const paymentMethod = walletTypeSelect.value;

  // ✅ عند اختيار "آجل"، صفّر المبلغ المدفوع تلقائياً
  if (paymentMethod === 'deferred' && paidAmountInput) {
    paidAmountInput.value = '0';
    paidAmountInput.dataset.userModified = 'true'; // منع إعادة الملء التلقائي
    // تحديث حساب المتبقي
    if (typeof calculateQuickPayment === 'function' && prefix === 'quick') {
      calculateQuickPayment();
    } else if (typeof calculateInvoicePayment === 'function' && prefix === 'invoice') {
      calculateInvoicePayment();
    }
  }

  // فقط للمحافظ الإلكترونية والحسابات البنكية
  if (paymentMethod !== 'mobile_wallet' && paymentMethod !== 'bank') {
    walletSelectGroup.style.display = 'none';
    return;
  }
  
  const walletType = paymentMethod; // mobile_wallet or bank
  
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
window.updateAccessoryPaymentWalletsList = updateAccessoryPaymentWalletsList;

// ✅ تحديث قائمة المحافظ حسب النوع (للتسوية في المرتجع)
async function updateAccessorySettlementWalletsList() {
  const settlementRadio = document.querySelector('input[name="settlementOption"]:checked');
  const walletSelectGroup = document.getElementById('settlementWalletSelectGroup');
  const walletSelect = document.getElementById('settlementWalletSelect');
  
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
window.updateAccessorySettlementWalletsList = updateAccessorySettlementWalletsList;

// ✅ تحديث قائمة المحافظ حسب النوع (للمرتجع)
async function updateAccessoryRefundWalletsList() {
  const walletTypeRadio = document.querySelector('input[name="refundWalletType"]:checked');
  const walletSelectGroup = document.getElementById('refundWalletSelectGroup');
  const walletSelect = document.getElementById('refundWalletSelect');
  
  if (!walletTypeRadio || !walletSelectGroup || !walletSelect) return;
  
  const walletType = walletTypeRadio.value;
  
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
window.updateAccessoryRefundWalletsList = updateAccessoryRefundWalletsList;

function showToast(message, type = 'success') {
  const toast = document.getElementById('toast');
  if (!toast) return;
  toast.textContent = message;
  toast.className = 'toast';
  if (type === 'error') toast.classList.add('error');
  if (type === 'info') toast.classList.add('info');
  toast.classList.add('show');
  setTimeout(() => toast.classList.remove('show'), 4000);
}

// ⏰ CLOCK - handled in HTML inline script

// 🏢 SETTINGS
async function loadSettings() {
  try {
    const saved = localStorage.getItem('appSettings');
    if (saved) {
      const settings = JSON.parse(saved);
      const brandEl = document.getElementById('brandName');
      if (brandEl) brandEl.textContent = settings.companyName || 'ElOs';
    }
  } catch (e) { Logger.error('[SETTINGS]', e); }
}

// ═════════════════════════════════════════════════════════════
// 📊 DATA LOADING - المشكلة الرئيسية كانت هنا
// ═════════════════════════════════════════════════════════════
async function loadInitialData() {
  Logger.log('[DATA] Loading...');
  
  try {
    // ✅ جلب قطع الصيانة من المخزن (جميع القطع بغض النظر عن warehouse_id)
    // في صفحة المشتريات، نريد عرض جميع القطع للتوريد لأي مخزن
    const repairPartsRes = await fetch('elos-db://repair-parts?all=true');
    if (repairPartsRes.ok) {
      const data = await repairPartsRes.json();
      // ✅ التأكد من البيانات
      if (Array.isArray(data)) {
        allRepairParts = data;
      } else if (data && Array.isArray(data.parts)) {
        allRepairParts = data.parts;
      } else if (data && typeof data === 'object') {
        allRepairParts = Object.values(data);
      } else {
        allRepairParts = [];
      }
      Logger.log(`[DATA] ✅ Repair Parts: ${allRepairParts.length}`);
    } else {
      // Fallback: جلب بدون فلترة
      const repairPartsResFallback = await fetch('elos-db://repair-parts');
      if (repairPartsResFallback.ok) {
        const data = await repairPartsResFallback.json();
        if (Array.isArray(data)) {
          allRepairParts = data;
        } else if (data && Array.isArray(data.parts)) {
          allRepairParts = data.parts;
        } else if (data && typeof data === 'object') {
          allRepairParts = Object.values(data);
        } else {
          allRepairParts = [];
        }
        Logger.log(`[DATA] ✅ Repair Parts (fallback): ${allRepairParts.length}`);
      } else {
        Logger.error('[DATA] ❌ Failed to load repair parts:', repairPartsResFallback.status);
      }
    }

    // جلب الموردين
    const suppliersRes = await fetch('elos-db://suppliers');
    if (suppliersRes.ok) {
      const data = await suppliersRes.json();
      allSuppliers = Array.isArray(data) ? data : (data?.suppliers || []);
      Logger.log(`[DATA] ✅ Suppliers: ${allSuppliers.length}`);
    }

    // جلب الحركات (التوريدات)
    const movementsRes = await fetch('elos-db://repair-parts-movements');
    if (movementsRes.ok) {
      const data = await movementsRes.json();
      const movements = Array.isArray(data) ? data : (data?.movements || []);
      // فقط التوريدات الحقيقية (نوع 'in') - استثناء الاستيراد والإضافة الأولية
      allPurchases = movements.filter(m =>
        m.type === 'in' && // ✅ فقط التوريدات (ليس import أو initial)
        m.qty > 0 &&
        m.unit_cost >= 0
      );
      Logger.log(`[DATA] ✅ Quick Purchases: ${allPurchases.length}`);
    }

    // جلب الفواتير (فواتير قطع الصيانة فقط)
    try {
      const invoicesRes = await fetch('elos-db://purchase-invoices?type=repair_parts');
      if (invoicesRes.ok) {
        const data = await invoicesRes.json();
        allInvoices = Array.isArray(data) ? data : [];
        Logger.log(`[DATA] ✅ Invoices: ${allInvoices.length}`);
      }
    } catch (e) {
      Logger.log('[DATA] Invoice table not ready');
      allInvoices = [];
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
      Logger.error('[DATA] ❌ Error:', error);
    }
    showToast('فشل تحميل البيانات', 'error');
  }

  // تحديث الواجهة
  updateStats();

  // ✅ تحديث البيانات المفلترة أولاً
  filteredData.invoices = [...allInvoices];
  filteredData.quick = [...allPurchases];

  // ✅ تحديث جميع الجداول (حتى لو غير ظاهرة) لضمان التحديث الفوري
  renderAllTable();
  renderInvoicesTable();
  renderQuickTable();

  // Debug
  Logger.log('[DEBUG] Repair Parts loaded:', allRepairParts.length);
  if (allRepairParts.length > 0) {
    Logger.log('[DEBUG] First repair part:', allRepairParts[0]);
  }
}

// 📊 STATISTICS
function updateStats() {
  const totalQuickPurchases = allPurchases.length; // التوريدات السريعة فقط
  const totalInvoices = allInvoices.length;

  // إجمالي التكلفة = تكلفة الفواتير + تكلفة التوريدات السريعة
  const quickCost = allPurchases.reduce((sum, p) => sum + ((p.qty || p.quantity || 0) * (p.unit_cost || p.unit_price || 0)), 0);
  const invoicesCost = allInvoices.reduce((sum, inv) => sum + (parseFloat(inv.total_amount) || 0), 0);
  const totalCost = quickCost + invoicesCost;

  const now = new Date();
  const currentMonth = now.toISOString().slice(0, 7);

  // تكلفة الشهر = من الفواتير + التوريدات السريعة
  const monthQuickCost = allPurchases
    .filter(p => p.created_at?.startsWith(currentMonth))
    .reduce((sum, p) => sum + ((p.qty || p.quantity || 0) * (p.unit_cost || p.unit_price || 0)), 0);
  const monthInvoicesCost = allInvoices
    .filter(inv => (inv.invoice_date || inv.created_at)?.startsWith(currentMonth))
    .reduce((sum, inv) => sum + (parseFloat(inv.total_amount) || 0), 0);
  const monthCost = monthQuickCost + monthInvoicesCost;

  // إجمالي عدد التوريدات = فواتير + توريدات سريعة
  const totalPurchases = totalInvoices + totalQuickPurchases;

  // Update main stats
  document.getElementById('totalPurchases').textContent = totalPurchases;
  document.getElementById('totalInvoices').textContent = totalInvoices;
  document.getElementById('totalCost').textContent = fmt(totalCost);
  document.getElementById('monthCost').textContent = fmt(monthCost);

  // Update header cards
  const headerPurchases = document.getElementById('headerTotalPurchases');
  const headerCost = document.getElementById('headerTotalCost');
  const headerInvoices = document.getElementById('headerInvoicesCount');

  if (headerPurchases) headerPurchases.textContent = totalPurchases;
  if (headerInvoices) headerInvoices.textContent = totalInvoices;
  if (headerCost) {
    const costDisplay = totalCost >= 1000 ? `${(totalCost / 1000).toFixed(1)}K` : Math.round(totalCost);
    headerCost.textContent = costDisplay;
  }
}

// ═════════════════════════════════════════════════════════════
// 📋 TABS
// ═════════════════════════════════════════════════════════════
function switchTab(tabName, btn) {
  document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
  btn.classList.add('active');

  document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));

  if (tabName === 'all') {
    document.getElementById('allTab').classList.add('active');
    renderAllTable();
  } else if (tabName === 'invoices') {
    document.getElementById('invoicesTab').classList.add('active');
    renderInvoicesTable();
  } else if (tabName === 'quick') {
    document.getElementById('quickTab').classList.add('active');
    renderQuickTable();
  } else if (tabName === 'returns') {
    document.getElementById('returnsTab').classList.add('active');
    loadAccessoryReturns();
  }
}

// ═════════════════════════════════════════════════════════════
// 🔍 FILTERING & SEARCH
// ═════════════════════════════════════════════════════════════
function applyFilters() {
  const dateFrom = document.getElementById('filterDateFrom')?.value;
  const dateTo = document.getElementById('filterDateTo')?.value;
  const supplierId = document.getElementById('filterSupplier')?.value;
  const searchTerm = document.getElementById('searchAll')?.value?.toLowerCase().trim();

  filters = { dateFrom, dateTo, supplierId, searchTerm };

  // فلترة الفواتير
  const invoiceSearch = document.getElementById('searchInvoices')?.value?.toLowerCase().trim() || searchTerm;
  filteredData.invoices = allInvoices.filter(inv => {
    const sup = allSuppliers.find(s => s.id === inv.supplier_id);

    if (dateFrom && (inv.invoice_date || inv.created_at) < dateFrom) return false;
    if (dateTo && (inv.invoice_date || inv.created_at) > dateTo + 'T23:59:59') return false;
    if (supplierId && inv.supplier_id != supplierId) return false;

    if (invoiceSearch) {
      const searchIn = `${inv.invoice_number || ''} ${sup?.name || ''} ${inv.notes || ''}`.toLowerCase();
      if (!searchIn.includes(invoiceSearch)) return false;
    }

    return true;
  });

  // فلترة التوريدات السريعة (allPurchases الآن تحتوي فقط على التوريدات السريعة)
  const quickSearch = document.getElementById('searchQuick')?.value?.toLowerCase().trim() || searchTerm;
  filteredData.quick = allPurchases.filter(p => {
    const part = allRepairParts.find(a => a.id === p.part_id);
    const sup = allSuppliers.find(s => s.id === p.supplier_id);

    if (dateFrom && p.created_at < dateFrom) return false;
    if (dateTo && p.created_at > dateTo + 'T23:59:59') return false;
    if (supplierId && p.supplier_id != supplierId) return false;

    if (quickSearch) {
      const searchIn = `${part?.name || ''} ${part?.category || ''} ${sup?.name || ''} ${p.note || ''}`.toLowerCase();
      if (!searchIn.includes(quickSearch)) return false;
    }

    return true;
  });

  // filteredData.all سيتم حسابها في renderAllTable (دمج الفواتير + التوريدات السريعة)

  // Reset to page 1
  currentPage.all = 1;
  currentPage.invoices = 1;
  currentPage.quick = 1;

  // Re-render
  renderAllTable();
  renderInvoicesTable();
  renderQuickTable();
}

function clearFilters() {
  document.getElementById('filterDateFrom').value = '';
  document.getElementById('filterDateTo').value = '';
  document.getElementById('filterSupplier').value = '';
  document.getElementById('searchAll').value = '';
  document.getElementById('searchInvoices').value = '';
  document.getElementById('searchQuick').value = '';
  
  filters = { dateFrom: '', dateTo: '', supplierId: '', searchTerm: '' };
  applyFilters();
}

function initFilters() {
  // Initialize filtered data
  // allPurchases الآن تحتوي فقط على التوريدات السريعة (تم استبعاد المرتبطة بفواتير في loadInitialData)
  filteredData.invoices = [...allInvoices];
  filteredData.quick = [...allPurchases]; // كلها توريدات سريعة
  // filteredData.all سيتم حسابها في renderAllTable

  // Populate supplier filter
  const supplierFilter = document.getElementById('filterSupplier');
  if (supplierFilter) {
    const options = allSuppliers
      .filter(s => s.is_active !== 0)
      .map(s => `<option value="${s.id}">${s.name}</option>`)
      .join('');
    supplierFilter.innerHTML = `<option value="">كل الموردين</option>${options}`;
  }

  // 📅 Set default filter: Last 6 months
  setDefaultDateFilter();

  // Search event listeners with debounce
  let searchTimeout;
  ['searchAll', 'searchInvoices', 'searchQuick'].forEach(id => {
    const el = document.getElementById(id);
    if (el) {
      el.addEventListener('input', () => {
        clearTimeout(searchTimeout);
        searchTimeout = setTimeout(applyFilters, 300);
      });
    }
  });

  // Filter event listeners
  ['filterDateFrom', 'filterDateTo', 'filterSupplier'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.addEventListener('change', applyFilters);
  });
}

// 📅 Set default date filter (last 6 months)
function setDefaultDateFilter() {
  const now = new Date();
  const sixMonthsAgo = new Date();
  sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);

  // ✅ استخدام التاريخ المحلي بدل UTC (toISOString كان بيرجع يوم ورا بسبب فرق التوقيت)
  const toLocal = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  const dateFrom = toLocal(sixMonthsAgo);
  const dateTo = toLocal(now);

  const dateFromInput = document.getElementById('filterDateFrom');
  const dateToInput = document.getElementById('filterDateTo');

  if (dateFromInput) dateFromInput.value = dateFrom;
  if (dateToInput) dateToInput.value = dateTo;

  // Apply the filter
  applyFilters();

  // Show welcome toast
  const monthNames = ['يناير', 'فبراير', 'مارس', 'أبريل', 'مايو', 'يونيو', 'يوليو', 'أغسطس', 'سبتمبر', 'أكتوبر', 'نوفمبر', 'ديسمبر'];
  const fromMonth = monthNames[sixMonthsAgo.getMonth()];
  const toMonth = monthNames[now.getMonth()];
  
  setTimeout(() => {
    showToast(`📅 عرض توريدات آخر 6 شهور (${fromMonth} - ${toMonth})`, 'info');
  }, 500);
}

// ═════════════════════════════════════════════════════════════
// 📄 PAGINATION
// ═════════════════════════════════════════════════════════════
function getPaginatedData(data, page) {
  const start = (page - 1) * ITEMS_PER_PAGE;
  const end = start + ITEMS_PER_PAGE;
  return data.slice(start, end);
}

function getTotalPages(data) {
  return Math.ceil(data.length / ITEMS_PER_PAGE);
}

function renderPagination(containerId, tabName, totalItems) {
  const container = document.getElementById(containerId);
  if (!container) return;

  const totalPages = Math.ceil(totalItems / ITEMS_PER_PAGE);
  const page = currentPage[tabName];

  if (totalPages <= 1) {
    container.innerHTML = '';
    return;
  }

  let html = `<div class="pagination-info">عرض ${((page - 1) * ITEMS_PER_PAGE) + 1} - ${Math.min(page * ITEMS_PER_PAGE, totalItems)} من ${totalItems}</div>`;
  html += '<div class="pagination-buttons">';

  // Previous
  html += `<button class="page-btn" ${page === 1 ? 'disabled' : ''} onclick="goToPage('${tabName}', ${page - 1})">❮</button>`;

  // Page numbers
  const maxVisible = 5;
  let startPage = Math.max(1, page - Math.floor(maxVisible / 2));
  let endPage = Math.min(totalPages, startPage + maxVisible - 1);
  
  if (endPage - startPage < maxVisible - 1) {
    startPage = Math.max(1, endPage - maxVisible + 1);
  }

  if (startPage > 1) {
    html += `<button class="page-btn" onclick="goToPage('${tabName}', 1)">1</button>`;
    if (startPage > 2) html += '<span class="page-dots">...</span>';
  }

  for (let i = startPage; i <= endPage; i++) {
    html += `<button class="page-btn ${i === page ? 'active' : ''}" onclick="goToPage('${tabName}', ${i})">${i}</button>`;
  }

  if (endPage < totalPages) {
    if (endPage < totalPages - 1) html += '<span class="page-dots">...</span>';
    html += `<button class="page-btn" onclick="goToPage('${tabName}', ${totalPages})">${totalPages}</button>`;
  }

  // Next
  html += `<button class="page-btn" ${page === totalPages ? 'disabled' : ''} onclick="goToPage('${tabName}', ${page + 1})">❯</button>`;
  html += '</div>';

  container.innerHTML = html;
}

function goToPage(tabName, page) {
  const data = filteredData[tabName];
  const totalPages = getTotalPages(data);
  
  if (page < 1 || page > totalPages) return;
  
  currentPage[tabName] = page;
  
  if (tabName === 'all') renderAllTable();
  else if (tabName === 'invoices') renderInvoicesTable();
  else if (tabName === 'quick') renderQuickTable();

  // Scroll to top of table
  document.getElementById(`${tabName}Tab`)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

// ═════════════════════════════════════════════════════════════
// 📋 TABLES WITH PAGINATION
// ═════════════════════════════════════════════════════════════
function renderAllTable() {
  const tbody = document.getElementById('allTableBody');
  if (!tbody) return;

  // دمج الفواتير والتوريدات السريعة في قائمة واحدة
  const quickPurchases = (filteredData.quick || allPurchases.filter(p => p.reference_type !== 'invoice'));
  const invoices = (filteredData.invoices || allInvoices);

  // تحويل الفواتير لنفس الشكل
  const invoiceItems = invoices.map(inv => ({
    id: inv.id,
    created_at: inv.invoice_date || inv.created_at,
    isInvoice: true,
    invoice_number: inv.invoice_number,
    supplier_id: inv.supplier_id,
    items_count: inv.items_count || 0,
    total_price: inv.total_amount || 0,
    status: inv.status
  }));

  // تحويل التوريدات السريعة
  const quickItems = quickPurchases.map(p => ({
    ...p,
    isInvoice: false
  }));

  // دمج وترتيب حسب التاريخ
  const allItems = [...invoiceItems, ...quickItems].sort((a, b) =>
    new Date(b.created_at) - new Date(a.created_at)
  );

  if (allItems.length === 0) {
    tbody.innerHTML = `<tr><td colspan="10"><div class="empty-state">
      <div class="empty-icon">📦</div>
      <div class="empty-title">${filters.searchTerm || filters.dateFrom ? 'لا توجد نتائج' : 'لا توجد توريدات'}</div>
      <div class="empty-text">${filters.searchTerm || filters.dateFrom ? 'جرب تغيير معايير البحث' : 'ابدأ بإضافة أول توريد'}</div>
    </div></td></tr>`;
    renderPagination('paginationAll', 'all', 0);
    return;
  }

  // تحديث filteredData.all للـ pagination
  filteredData.all = allItems;

  const paginatedData = getPaginatedData(allItems, currentPage.all);
  const startIndex = (currentPage.all - 1) * ITEMS_PER_PAGE;

  const rows = paginatedData.map((item, i) => {
    const sup = allSuppliers.find(s => s.id === item.supplier_id);
    const date = new Date(item.created_at);
    const dateStr = date.toLocaleDateString('ar-EG', { month: 'short', day: 'numeric' });
    const timeStr = date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });

    if (item.isInvoice) {
      // عرض الفاتورة
      const statusBadge = item.status === 'cancelled' ?
        '<span class="badge danger">ملغية</span>' :
        '<span class="badge success">مكتملة</span>';

      return `<tr style="background: rgba(59, 130, 246, 0.05);">
        <td>${startIndex + i + 1}</td>
        <td>${dateStr}<br><small style="color:var(--text-secondary)">${timeStr}</small></td>
        <td><span class="badge info">🧾 فاتورة</span></td>
        <td><strong>${item.invoice_number || `INV-${item.id}`}</strong></td>
        <td>-</td>
        <td><span class="badge purple">${item.items_count} صنف</span></td>
        <td>-</td>
        <td>${sup?.name || '-'}</td>
        <td><strong style="color:var(--success)">${fmt(item.total_price || 0)} ج.م</strong></td>
        <td>
          <div style="display:flex;gap:6px;">
            <button class="btn-view" onclick="viewInvoice(${item.id})" title="عرض تفاصيل الفاتورة">👁️</button>
            <button class="btn-barcode" onclick="printInvoiceBarcode(${item.id})" title="طباعة باركود">🏷️</button>
            <button class="btn-delete" onclick="deleteInvoice(${item.id})" title="حذف الفاتورة">🗑️</button>
          </div>
        </td>
      </tr>`;
    } else {
      // عرض التوريد السريع
      const isReturned = item.status === 'returned';

      // ✅ استخدام part_name من API مباشرة، مع fallback للبحث في allRepairParts
      const partName = item.part_name || (() => {
        const part = allRepairParts.find(a => a.id === item.part_id);
        return part?.name;
      })() || 'غير معروف';
      
      const partCategory = item.part_category || (() => {
        const part = allRepairParts.find(a => a.id === item.part_id);
        return part?.category;
      })() || '-';
      
      const part = allRepairParts.find(a => a.id === item.part_id);
      const hasBarcode = part?.short_code || part?.barcode;

      return `<tr class="${isReturned ? 'returned-row' : ''}">
        <td>${startIndex + i + 1}</td>
        <td>${dateStr}<br><small style="color:var(--text-secondary)">${timeStr}</small></td>
        <td><span class="badge warning">⚡ سريع</span></td>
        <td><strong>${partName}</strong></td>
        <td><span class="badge">${partCategory}</span></td>
        <td>${item.qty || 0}</td>
        <td>${fmt(item.unit_cost || 0)} ج.م</td>
        <td>${sup?.name || '-'}</td>
        <td><strong style="color:var(--success)">${fmt((item.qty || 0) * (item.unit_cost || 0))} ج.م</strong></td>
        <td>
          <div style="display:flex;gap:6px;">
            <button class="btn-details" onclick="showPurchaseDetails(${item.id})" title="تفاصيل">📋</button>
            ${hasBarcode ? `<button class="btn-barcode" onclick="printQuickPurchaseBarcode(${item.id})" title="طباعة باركود">🏷️</button>` : ''}
            ${!isReturned ? `<button class="btn-return" onclick="openAccessoryReturnModal(${item.id})" title="مرتجع">↩️</button>` : ''}
            ${!isReturned ? `<button class="btn-delete" onclick="deleteQuickPurchase(${item.id})" title="حذف التوريد">🗑️</button>` : ''}
          </div>
        </td>
      </tr>`;
    }
  }).join('');

  tbody.innerHTML = rows;
  renderPagination('paginationAll', 'all', allItems.length);
}

function renderInvoicesTable() {
  const tbody = document.getElementById('invoicesTableBody');
  if (!tbody) return;

  const data = filteredData.invoices || allInvoices;

  if (data.length === 0) {
    tbody.innerHTML = `<tr><td colspan="7"><div class="empty-state">
      <div class="empty-icon">📄</div>
      <div class="empty-title">${filters.searchTerm || filters.dateFrom ? 'لا توجد نتائج' : 'لا توجد فواتير'}</div>
    </div></td></tr>`;
    renderPagination('paginationInvoices', 'invoices', 0);
    return;
  }

  const paginatedData = getPaginatedData(data, currentPage.invoices);

  const rows = paginatedData.map(inv => {
    const sup = allSuppliers.find(s => s.id === inv.supplier_id);
    const date = new Date(inv.invoice_date || inv.created_at);
    const dateStr = date.toLocaleDateString('ar-EG', { year: 'numeric', month: 'short', day: 'numeric' });
    const statusClass = inv.status === 'completed' ? 'success' : 'danger';
    const statusText = inv.status === 'completed' ? 'مكتمل' : 'ملغي';

    return `<tr>
      <td><strong>${inv.invoice_number}</strong></td>
      <td>${dateStr}</td>
      <td>${sup?.name || '-'}</td>
      <td>${inv.items_count || 0}</td>
      <td><strong>${fmt(inv.total_amount)} ج.م</strong></td>
      <td><span class="badge ${statusClass}">${statusText}</span></td>
      <td>
        <div style="display:flex;gap:6px;">
          <button class="btn-view" onclick="viewInvoice(${inv.id})" title="عرض">👁️</button>
          <button class="btn-barcode" onclick="printInvoiceBarcode(${inv.id})" title="طباعة باركود">🏷️</button>
          <button class="btn-delete" onclick="deleteInvoice(${inv.id})" title="حذف الفاتورة">🗑️</button>
        </div>
      </td>
    </tr>`;
  }).join('');

  tbody.innerHTML = rows;
  renderPagination('paginationInvoices', 'invoices', data.length);
}

function renderQuickTable() {
  const tbody = document.getElementById('quickTableBody');
  if (!tbody) return;

  const data = filteredData.quick || allPurchases.filter(p => p.reference_type !== 'invoice');

  if (data.length === 0) {
    tbody.innerHTML = `<tr><td colspan="10"><div class="empty-state">
      <div class="empty-icon">⚡</div>
      <div class="empty-title">${filters.searchTerm || filters.dateFrom ? 'لا توجد نتائج' : 'لا توجد توريدات سريعة'}</div>
    </div></td></tr>`;
    renderPagination('paginationQuick', 'quick', 0);
    return;
  }

  const paginatedData = getPaginatedData(data, currentPage.quick);
  const startIndex = (currentPage.quick - 1) * ITEMS_PER_PAGE;

  const rows = paginatedData.map((p, i) => {
    const part = allRepairParts.find(a => a.id === p.part_id);
    const sup = allSuppliers.find(s => s.id === p.supplier_id);
    const date = new Date(p.created_at);
    const dateStr = date.toLocaleDateString('ar-EG', { month: 'short', day: 'numeric' });
    const isReturned = p.status === 'returned';

    return `<tr class="${isReturned ? 'returned-row' : ''}">
      <td>${startIndex + i + 1}</td>
      <td>${dateStr}</td>
      <td><strong>${part?.name || 'غير معروف'}</strong></td>
      <td>${part?.category || '-'}</td>
      <td>${p.qty || 0}</td>
      <td>${fmt(p.unit_cost)} ج.م</td>
      <td>${sup?.name || '-'}</td>
      <td><strong style="color:var(--success)">${fmt((p.qty || 0) * (p.unit_cost || 0))} ج.م</strong></td>
      <td><span class="badge ${isReturned ? 'warning' : 'success'}">${isReturned ? 'مرتجع' : 'مكتمل'}</span></td>
      <td>
        <div style="display:flex;gap:6px;">
          <button class="btn-details" onclick="showPurchaseDetails(${p.id})" title="تفاصيل">📋</button>
          ${(part?.short_code || part?.barcode) ? `<button class="btn-barcode" onclick="printQuickPurchaseBarcode(${p.id})" title="طباعة باركود">🏷️</button>` : ''}
          ${!isReturned ? `<button class="btn-return" onclick="openAccessoryReturnModal(${p.id})" title="مرتجع">↩️</button>` : ''}
          ${!isReturned ? `<button class="btn-delete" onclick="deleteQuickPurchase(${p.id})" title="حذف التوريد">🗑️</button>` : ''}
        </div>
      </td>
    </tr>`;
  }).join('');

  tbody.innerHTML = rows;
  renderPagination('paginationQuick', 'quick', data.length);
}

// ═════════════════════════════════════════════════════════════
// ⚡ QUICK PURCHASE MODAL
// ═════════════════════════════════════════════════════════════
function openQuickPurchaseModal() {
  const modal = document.getElementById('quickPurchaseModal');
  if (!modal) return;

  selectedQuickRepairPart = null;
  highlightedIndex = -1;
  
  // مسح الحقول
  document.getElementById('quickPurchaseForm')?.reset();
  document.getElementById('quickAccessorySearch').value = '';
  document.getElementById('quickAccessoryId').value = '';
  document.getElementById('quickAccessorySelect')?.classList.remove('has-value');
  document.getElementById('quickAccessoryInfo').classList.remove('show');
  document.getElementById('quickSummaryBox').classList.remove('show');
  document.getElementById('quickPriceWarning').classList.remove('show');
  document.getElementById('quickTotalDisplay').value = '0.00';
  
  // مسح حقول الدفع الجديدة
  const paidInput = document.getElementById('quickPaidAmount');
  if (paidInput) {
    paidInput.value = '';
    paidInput.dataset.userModified = '';
  }
  document.getElementById('quickRemainingRow').style.display = 'none';
  document.getElementById('quickSupplierBalanceRow').style.display = 'none';
  document.getElementById('quickPaymentMethod').value = 'cash';
  
  // ✅ تحميل المحافظ وتحديث القائمة
  loadPaymentWallets().then(() => {
    updateAccessoryPaymentWalletsList('quick');
  });

  // ✅ تحميل المخازن لقطع الصيانة
  // ✅ تحميل المخازن لقطع الغيار (فقط مخازن قطع الغيار - اختياري)
  if (window.WarehouseHandler) {
    window.WarehouseHandler.populateWarehouseSelect('quickWarehouseId', 'spare_parts', null, 'optional');
  }

  // تفعيل البحث
  initQuickAccessorySearch();
  populateQuickSuppliers();

  // ✅ Force clean state then show
  modal.classList.remove('active');
  void modal.offsetHeight;
  modal.classList.add('active');
  document.body.style.overflow = 'hidden';

  modal.scrollTop = 0;
  const body = modal.querySelector('.modal-body');
  if (body) body.scrollTop = 0;

  // التركيز على البحث
  setTimeout(() => {
    document.getElementById('quickAccessorySearch')?.focus();
  }, 100);
}

function closeQuickPurchaseModal() {
  const modal = document.getElementById('quickPurchaseModal');
  if (!modal) return;
  modal.classList.remove('active');
  document.body.style.overflow = '';
  modal.style.pointerEvents = 'none';
  setTimeout(() => { modal.style.pointerEvents = ''; }, 350);
}

// ═════════════════════════════════════════════════════════════
// 🔍 SEARCHABLE ACCESSORY SELECT - نظام البحث الذكي
// ═════════════════════════════════════════════════════════════
let quickSearchTimeout = null;
let highlightedIndex = -1;

function initQuickAccessorySearch() {
  const input = document.getElementById('quickAccessorySearch');
  const dropdown = document.getElementById('quickAccessoryDropdown');
  const container = document.getElementById('quickAccessorySelect');
  
  if (!input || !dropdown) return;

  // فتح dropdown عند double click فقط
  input.addEventListener('dblclick', () => {
    renderAccessoryDropdown(input.value);
    dropdown.classList.add('show');
  });

  // البحث عند الكتابة - يفتح dropdown تلقائي
  input.addEventListener('input', (e) => {
    clearTimeout(quickSearchTimeout);
    quickSearchTimeout = setTimeout(() => {
      renderAccessoryDropdown(e.target.value);
      dropdown.classList.add('show'); // يفتح عند الكتابة
      highlightedIndex = -1;
    }, 150);
  });

  // التنقل بالأسهم
  input.addEventListener('keydown', (e) => {
    const items = dropdown.querySelectorAll('.searchable-dropdown-item');
    
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (!dropdown.classList.contains('show')) {
        renderAccessoryDropdown(input.value);
        dropdown.classList.add('show');
      }
      highlightedIndex = Math.min(highlightedIndex + 1, items.length - 1);
      updateHighlight(items);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      highlightedIndex = Math.max(highlightedIndex - 1, 0);
      updateHighlight(items);
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (highlightedIndex >= 0 && items[highlightedIndex]) {
        const id = items[highlightedIndex].dataset.id;
        if (id) {
          selectQuickAccessory(id);
        } else if (items[highlightedIndex].classList.contains('add-new-item')) {
          items[highlightedIndex].click();
        }
      } else if (dropdown.classList.contains('show')) {
        const addBtn = dropdown.querySelector('.add-new-item');
        if (addBtn) {
          addBtn.click();
        }
      }
    } else if (e.key === 'Escape') {
      dropdown.classList.remove('show');
      input.blur();
    }
  });

  // إغلاق عند النقر خارج
  document.addEventListener('click', (e) => {
    if (!container.contains(e.target)) {
      dropdown.classList.remove('show');
    }
  });
}

function updateHighlight(items) {
  items.forEach((item, i) => {
    item.classList.toggle('highlighted', i === highlightedIndex);
  });
  
  if (items[highlightedIndex]) {
    items[highlightedIndex].scrollIntoView({ block: 'nearest' });
  }
}

function renderAccessoryDropdown(searchTerm = '') {
  const dropdown = document.getElementById('quickAccessoryDropdown');
  if (!dropdown) return;

  const term = searchTerm.trim().toLowerCase();
  
  // ✅ فلترة قطع الصيانة (استخدام allRepairParts بدلاً من allAccessories)
  let filtered = allRepairParts || [];
  
  if (term) {
    filtered = filtered.filter(a => {
      const name = (a.name || '').toLowerCase();
      const category = (a.category || '').toLowerCase();
      const sku = (a.sku || '').toLowerCase();
      return name.includes(term) || category.includes(term) || sku.includes(term);
    });
  }

  // ترتيب حسب الاسم
  filtered.sort((a, b) => (a.name || '').localeCompare(b.name || '', 'ar'));

  if (filtered.length === 0) {
    if (term) {
      const safeTerm = escapeHtml((searchTerm || '').trim());
      const dataTermAttr = ((searchTerm || '').trim()).replace(/"/g, '&quot;');
      dropdown.innerHTML = `
        <div class="searchable-dropdown-empty" style="border-bottom:1px solid var(--border); padding: 10px 14px;">
          <span style="opacity:0.7;">لا توجد قطعة بهذا الاسم</span>
        </div>
        <div class="searchable-dropdown-item add-new-item" data-term="${dataTermAttr}"
             onclick="quickCreateRepairPart(this.dataset.term, 'quick', null)"
             style="background: linear-gradient(135deg, rgba(16,185,129,0.08), rgba(16,185,129,0.15)); padding: 14px; cursor: pointer; border-radius: 0 0 10px 10px;">
          <div style="display:flex; align-items:center; gap:10px; width:100%;">
            <span style="font-size:22px; flex-shrink:0;">➕</span>
            <div style="flex:1;">
              <div style="color:var(--success); font-weight:700; font-size:14px;">إضافة «${safeTerm}» وتوريدها</div>
              <div style="color:var(--text-secondary); font-size:11px; margin-top:2px;">ضغطة واحدة = إنشاء واختيار فوري</div>
            </div>
          </div>
        </div>`;
    } else {
      dropdown.innerHTML = `<div class="searchable-dropdown-empty">📦 اكتب اسم القطعة للبحث أو الإضافة</div>`;
    }
    return;
  }

  // عرض أول 50 نتيجة
  const items = filtered.slice(0, 50).map(a => {
    const stock = a.qty || 0;
    const stockClass = stock === 0 ? 'out' : stock < (a.min_qty || 5) ? 'low' : '';
    const selectedClass = selectedQuickRepairPart?.id === a.id ? 'selected' : '';
    
    return `<div class="searchable-dropdown-item ${selectedClass}" data-id="${a.id}" onclick="selectQuickAccessory(${a.id})">
      <div>
        <div class="searchable-item-name">${highlightMatch(a.name, term)}</div>
        <div class="searchable-item-details">${a.category || '-'} • SKU: ${a.sku || '-'}</div>
      </div>
      <span class="searchable-item-stock ${stockClass}">${stock}</span>
    </div>`;
  }).join('');

  dropdown.innerHTML = items + (filtered.length > 50 ? `<div class="searchable-dropdown-empty">... و ${filtered.length - 50} آخرين</div>` : '');
}

function highlightMatch(text, term) {
  if (!term || !text) return text || '';
  const regex = new RegExp(`(${term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi');
  return text.replace(regex, '<mark style="background:rgba(139,92,246,0.3);color:inherit;padding:0 2px;border-radius:2px;">$1</mark>');
}

function selectQuickAccessory(id) {
  // ✅ استخدام allRepairParts بدلاً من allAccessories
  const accessory = allRepairParts.find(a => a.id == id);
  if (!accessory) return;

  selectedQuickRepairPart = accessory;

  // تحديث الـ input
  const input = document.getElementById('quickAccessorySearch');
  const hiddenInput = document.getElementById('quickAccessoryId');
  const container = document.getElementById('quickAccessorySelect');
  const dropdown = document.getElementById('quickAccessoryDropdown');

  if (input) input.value = accessory.name;
  if (hiddenInput) hiddenInput.value = id;
  if (container) container.classList.add('has-value');
  if (dropdown) dropdown.classList.remove('show');

  // عرض معلومات الصنف
  onQuickAccessoryChange();
}

function clearQuickAccessory() {
  selectedQuickRepairPart = null;
  
  const input = document.getElementById('quickAccessorySearch');
  const hiddenInput = document.getElementById('quickAccessoryId');
  const container = document.getElementById('quickAccessorySelect');
  const infoBox = document.getElementById('quickAccessoryInfo');
  const summaryBox = document.getElementById('quickSummaryBox');

  if (input) input.value = '';
  if (hiddenInput) hiddenInput.value = '';
  if (container) container.classList.remove('has-value');
  if (infoBox) infoBox.classList.remove('show');
  if (summaryBox) summaryBox.classList.remove('show');

  document.getElementById('quickUnitPrice').value = '';
  document.getElementById('quickNewSellPrice').value = ''; // ✅ مسح سعر البيع
  document.getElementById('quickTotalDisplay').value = '0.00';
  document.getElementById('quickPriceWarning')?.classList.remove('show');
}

// للتوافق مع الكود القديم
function populateQuickAccessories() {
  // لم نعد نحتاج هذه الدالة - البحث يعمل مباشرة
  Logger.log('[SEARCH] Quick accessories search initialized');
}

function populateQuickSuppliers() {
  const select = document.getElementById('quickSupplierId');
  if (!select) return;

  const options = allSuppliers
    .filter(s => s.is_active !== 0)
    .map(s => `<option value="${s.id}">${s.name}</option>`)
    .join('');

  select.innerHTML = `<option value="">بدون مورد</option>${options}`;
}

function onQuickAccessoryChange() {
  const infoBox = document.getElementById('quickAccessoryInfo');

  if (!selectedQuickRepairPart || !infoBox) {
    infoBox?.classList.remove('show');
    updateQuickSummary();
    return;
  }

  // ✅ عرض معلومات قطع الصيانة (استخدام الحقول الصحيحة)
  document.getElementById('quickCurrentStock').textContent = `${selectedQuickRepairPart.qty || 0} قطعة`;
  document.getElementById('quickLastPrice').textContent = selectedQuickRepairPart.unit_cost ? `${fmt(selectedQuickRepairPart.unit_cost)} ج.م` : '-';
  document.getElementById('quickSalePrice').textContent = selectedQuickRepairPart.sell_price ? `${fmt(selectedQuickRepairPart.sell_price)} ج.م` : '-';
  document.getElementById('quickCategory').textContent = selectedQuickRepairPart.category || '-';
  document.getElementById('quickBrand').textContent = selectedQuickRepairPart.sku ? `SKU: ${selectedQuickRepairPart.sku}` : '-';
  document.getElementById('quickLocation').textContent = '-';

  infoBox.classList.add('show');

  // ملء السعر تلقائياً
  const priceInput = document.getElementById('quickUnitPrice');
  if (selectedQuickRepairPart.unit_cost && (!priceInput.value || priceInput.value === '0')) {
    priceInput.value = selectedQuickRepairPart.unit_cost;
    calculateQuickTotal();
  }

  // ✅ ملء سعر البيع الحالي كقيمة افتراضية
  const sellPriceInput = document.getElementById('quickNewSellPrice');
  if (sellPriceInput && selectedQuickRepairPart.sell_price && (!sellPriceInput.value || sellPriceInput.value === '0')) {
    sellPriceInput.value = selectedQuickRepairPart.sell_price;
  }

  updateQuickSummary();
}

function calculateQuickTotal() {
  const quantity = parseFloat(document.getElementById('quickQuantity')?.value || 0);
  const unitPrice = parseFloat(document.getElementById('quickUnitPrice')?.value || 0);
  const newSellPrice = parseFloat(document.getElementById('quickNewSellPrice')?.value || 0);
  const total = quantity * unitPrice;

  document.getElementById('quickTotalDisplay').value = fmt(total);

  // تحديث المبلغ المدفوع الافتراضي
  const paidInput = document.getElementById('quickPaidAmount');
  if (paidInput && !paidInput.dataset.userModified) {
    paidInput.value = total > 0 ? total.toFixed(2) : '';
  }

  calculateQuickPayment();

  // ✅ تحديث بوكس معلومات القطعة بالقيم الحالية
  if (selectedQuickRepairPart) {
    const currentStock = selectedQuickRepairPart.qty || 0;
    const newStock = currentStock + (quantity || 0);
    const stockEl = document.getElementById('quickCurrentStock');
    if (stockEl) stockEl.textContent = `${currentStock} → ${newStock} قطعة`;

    const priceEl = document.getElementById('quickLastPrice');
    if (priceEl) {
      priceEl.textContent = unitPrice > 0 ? `${fmt(unitPrice)} ج.م` : (selectedQuickRepairPart.unit_cost ? `${fmt(selectedQuickRepairPart.unit_cost)} ج.م` : '-');
    }

    const saleEl = document.getElementById('quickSalePrice');
    if (saleEl) {
      saleEl.textContent = newSellPrice > 0 ? `${fmt(newSellPrice)} ج.م` : (selectedQuickRepairPart.sell_price ? `${fmt(selectedQuickRepairPart.sell_price)} ج.م` : '-');
    }
  }

  // تحذير السعر
  const warningBox = document.getElementById('quickPriceWarning');
  const warningText = document.getElementById('quickPriceWarningText');

  if (selectedQuickRepairPart?.unit_cost && unitPrice > 0) {
    const lastPrice = selectedQuickRepairPart.unit_cost;
    const diff = ((unitPrice - lastPrice) / lastPrice) * 100;

    if (Math.abs(diff) > 20) {
      warningText.textContent = `السعر ${diff > 0 ? 'أعلى' : 'أقل'} من آخر سعر بنسبة ${Math.abs(diff).toFixed(0)}%`;
      warningBox.classList.add('show');
    } else {
      warningBox.classList.remove('show');
    }
  } else {
    warningBox.classList.remove('show');
  }

  updateQuickSummary();
}

function calculateQuickPayment() {
  const quantity = parseFloat(document.getElementById('quickQuantity')?.value || 0);
  const unitPrice = parseFloat(document.getElementById('quickUnitPrice')?.value || 0);
  const total = quantity * unitPrice;
  const paid = parseFloat(document.getElementById('quickPaidAmount')?.value || 0);
  const remaining = total - paid;
  
  const remainingRow = document.getElementById('quickRemainingRow');
  const remainingInput = document.getElementById('quickRemainingAmount');
  
  if (remaining > 0 && total > 0) {
    remainingRow.style.display = 'block';
    remainingInput.value = fmt(remaining) + ' ج.م';
  } else {
    remainingRow.style.display = 'none';
  }
  
  // تعليم أن المستخدم عدّل الحقل
  const paidInput = document.getElementById('quickPaidAmount');
  if (paidInput && document.activeElement === paidInput) {
    paidInput.dataset.userModified = 'true';
  }
}

function onQuickSupplierChange() {
  const supplierId = document.getElementById('quickSupplierId')?.value;
  const balanceRow = document.getElementById('quickSupplierBalanceRow');
  const balanceInput = document.getElementById('quickSupplierBalance');
  
  if (supplierId && balanceRow && balanceInput) {
    const supplier = allSuppliers.find(s => s.id == supplierId);
    if (supplier) {
      const balance = Number(supplier.balance) || 0;
      balanceInput.value = fmt(balance) + ' ج.م';
      balanceInput.style.color = balance > 0 ? 'var(--danger)' : balance < 0 ? 'var(--success)' : 'var(--text-primary)';
      balanceRow.style.display = 'block';
    } else {
      balanceRow.style.display = 'none';
    }
  } else if (balanceRow) {
    balanceRow.style.display = 'none';
  }
}

function updateQuickSummary() {
  const summaryBox = document.getElementById('quickSummaryBox');
  if (!selectedQuickRepairPart) {
    summaryBox?.classList.remove('show');
    return;
  }

  const quantity = parseFloat(document.getElementById('quickQuantity')?.value || 0);
  const unitPrice = parseFloat(document.getElementById('quickUnitPrice')?.value || 0);
  const total = quantity * unitPrice;
  const newStock = (selectedQuickRepairPart.qty || 0) + quantity;

  document.getElementById('summaryName').textContent = selectedQuickRepairPart.name;
  document.getElementById('summaryCategory').textContent = selectedQuickRepairPart.category || '-';
  document.getElementById('summaryQuantity').textContent = quantity;
  document.getElementById('summaryNewStock').textContent = newStock;
  document.getElementById('summaryTotal').textContent = fmt(total) + ' ج.م';

  summaryBox?.classList.add('show');
}

async function handleQuickPurchase(e) {
  e.preventDefault();

  try {
    if (!selectedQuickRepairPart) throw new Error('يجب اختيار قطعة الصيانة');

    const quantity = parseInt(document.getElementById('quickQuantity').value);
    const unitPrice = parseFloat(document.getElementById('quickUnitPrice').value);
    const newSellPrice = parseFloat(document.getElementById('quickNewSellPrice')?.value) || null; // ✅ سعر البيع الجديد
    const supplierId = document.getElementById('quickSupplierId').value;
    const paidAmount = parseFloat(document.getElementById('quickPaidAmount').value) || 0;
    const paymentMethod = document.getElementById('quickPaymentMethod').value;
    const notes = document.getElementById('quickNotes').value;
    const warehouseId = document.getElementById('quickWarehouseId')?.value || null;
    
    // ✅ الحصول على المحفظة المحددة
    const walletSelect = document.getElementById('quickWalletSelect');
    const walletId = (walletSelect && walletSelect.value && (paymentMethod === 'mobile_wallet' || paymentMethod === 'bank')) 
      ? parseInt(walletSelect.value) : null;

    if (quantity <= 0) throw new Error('الكمية يجب أن تكون أكبر من صفر');
    if (unitPrice <= 0) throw new Error('السعر يجب أن يكون أكبر من صفر');

    const totalPrice = quantity * unitPrice;
    const quantityBefore = selectedQuickRepairPart.qty || 0;
    const quantityAfter = quantityBefore + quantity;

    // إنشاء حركة التوريد
    console.log('[QUICK-PURCHASE] Sending data - supplierId:', supplierId, 'totalPrice:', totalPrice);
    const response = await fetch('elos-db://repair-parts-movements', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        part_id: selectedQuickRepairPart.id,
        type: 'in',
        qty: quantity,
        unit_cost: unitPrice,
        sell_price: (newSellPrice && newSellPrice > 0) ? newSellPrice : null,
        note: notes || 'توريد سريع',
        warehouse_id: warehouseId ? Number(warehouseId) : null,
        total_price: totalPrice,
        paid_amount: paidAmount,
        payment_method: paymentMethod,
        wallet_id: walletId,
        supplier_id: supplierId || null
      })
    });

    if (!response.ok) {
      let errorMessage = 'فشل التوريد';
      try {
        // قراءة النص أولاً
        const errorText = await response.text();
        // محاولة تحويله إلى JSON
        try {
          const err = JSON.parse(errorText);
          errorMessage = err.error || err.message || errorText || errorMessage;
        } catch (e) {
          // إذا لم يكن JSON، استخدم النص مباشرة
          errorMessage = errorText || errorMessage;
        }
      } catch (e) {
        // في حالة فشل قراءة النص
        errorMessage = `خطأ ${response.status}: ${response.statusText || errorMessage}`;
      }
      throw new Error(errorMessage);
    }
    
    const result = await response.json();

    // ✅ تحديث سعر الشراء وسعر البيع (إذا تم إدخاله)
    const updateData = { unit_cost: unitPrice };
    if (newSellPrice && newSellPrice > 0) {
      updateData.sell_price = newSellPrice;
    }
    await fetch(`elos-db://repair-parts/${selectedQuickRepairPart.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updateData)
    });

    // عرض تحذير الخزنة لو موجود
    if (result.balanceWarning) {
      showToast(`⚠️ ${result.balanceWarning}`, 'error');
    }
    
    // عرض رسالة الدين للمورد
    if (result.supplierDebt > 0) {
      const supplierName = allSuppliers.find(s => s.id == supplierId)?.name || 'المورد';
      showToast(`💳 تم تسجيل ${fmt(result.supplierDebt)} ج.م دين لـ "${supplierName}"`, 'info');
    }

    // ✅ عرض رصيد المحفظة المحددة بعد التوريد
    let successMessage = `✅ تم توريد ${quantity} قطعة من "${selectedQuickRepairPart.name}" • المخزون الجديد: ${quantityAfter}`;
    if (result.walletBalanceAfter !== null && result.walletBalanceAfter !== undefined) {
      const walletSelect = document.getElementById('quickWalletSelect');
      const walletName = walletSelect?.options[walletSelect.selectedIndex]?.text || 'المحفظة المحددة';
      successMessage += `\n💰 رصيد ${walletName}: ${fmt(result.walletBalanceAfter)} ج.م`;
    }
    showToast(successMessage);
    closeQuickPurchaseModal();

    // ═══════════════════════════════════════════════════════════════
    // 🏷️ سؤال المستخدم عن طباعة الباركود لقطعة الصيانة
    // ═══════════════════════════════════════════════════════════════
    if (selectedQuickRepairPart) {
      const shortCode = selectedQuickRepairPart.short_code || selectedQuickRepairPart.barcode || '';
      const sellPrice = newSellPrice || selectedQuickRepairPart.sell_price;

      const partForBarcode = {
        id: selectedQuickRepairPart.id,
        name: selectedQuickRepairPart.name,
        category: selectedQuickRepairPart.category || '',
        brand: selectedQuickRepairPart.brand || '',
        short_code: shortCode,
        sale_price: sellPrice,
        sell_price: sellPrice
      };

      if (shortCode) {
        // سؤال المستخدم مع خيارات الكمية
        const wantPrint = await showConfirm(
          `🏷️ هل تريد طباعة باركود لقطعة الصيانة؟\n\n` +
          `🔧 ${selectedQuickRepairPart.name}\n` +
          `📁 ${selectedQuickRepairPart.category || '-'}\n` +
          `🔢 الكمية الموردة: ${quantity}\n` +
          `🏷️ كود: ${shortCode}`,
          `طباعة ${quantity} نسخة`, 'لاحقاً', 'info'
        );

        if (wantPrint) {
          if (typeof window.BarcodeGenerator?.printBarcodeLabels === 'function') {
            // طباعة مباشرة بعدد النسخ = الكمية الموردة
            window.BarcodeGenerator.printBarcodeLabels([partForBarcode], {
              type: 'accessory', // نستخدم نفس نوع الإكسسوارات للطباعة
              copies: quantity,
              showPrice: true
            });
          } else if (typeof showBarcodePreviewModal === 'function') {
            // fallback للمعاينة
            showBarcodePreviewModal(partForBarcode, 'accessory');
          }
        }
      }
    }

    await loadInitialData();

  } catch (error) {
    Logger.error('[QUICK] Error:', error);
    showToast(error.message, 'error');
  }
}

// ═════════════════════════════════════════════════════════════
// 📄 INVOICE MODAL
// ═════════════════════════════════════════════════════════════
async function openInvoiceModal() {
  const modal = document.getElementById('invoiceModal');
  if (!modal) return;

  invoiceItems = [];
  document.getElementById('invoiceForm')?.reset();
  document.getElementById('invoiceDate').value = (() => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`; })();

  // ملء الموردين
  const supplierSelect = document.getElementById('invoiceSupplierId');
  if (supplierSelect) {
    const options = allSuppliers
      .filter(s => s.is_active !== 0)
      .map(s => `<option value="${s.id}">${s.name}</option>`)
      .join('');
    supplierSelect.innerHTML = `<option value="">بدون مورد</option>${options}`;
  }

  // مسح الأصناف
  const itemsList = document.getElementById('invoiceItemsList');
  if (itemsList) {
    itemsList.innerHTML = `<div class="invoice-item-row header">
      <span>القطعة</span><span>الكمية</span><span>سعر التكلفة</span><span>سعر البيع</span><span>الإجمالي</span><span></span>
    </div>`;
  }
  
  // مسح حقول الدفع
  const paidInput = document.getElementById('invoicePaidAmount');
  if (paidInput) {
    paidInput.value = '';
    paidInput.dataset.userModified = '';
  }
  document.getElementById('invoiceRemainingRow').style.display = 'none';
  document.getElementById('invoicePaymentMethod').value = 'cash';

  // ✅ مسح بوكس التسوية ورصيد المورد
  const settlementBox = document.getElementById('settlementBox');
  if (settlementBox) settlementBox.style.display = 'none';
  const supplierBalanceInfo = document.getElementById('supplierBalanceInfo');
  if (supplierBalanceInfo) supplierBalanceInfo.style.display = 'none';

  // ✅ تحميل المخازن لقطع الغيار (اختياري)
  await window.WarehouseHandler.populateWarehouseSelect('invoiceWarehouseId', 'spare_parts', null, 'optional');

  // ✅ تحميل المحافظ وتحديث القائمة
  loadPaymentWallets().then(() => {
    updateAccessoryPaymentWalletsList('invoice');
  });

  updateInvoiceSummary();
  // ✅ Force clean state then show
  modal.classList.remove('active');
  void modal.offsetHeight;
  modal.classList.add('active');
  document.body.style.overflow = 'hidden';

  modal.scrollTop = 0;
  const invoiceBody = modal.querySelector('.modal-body');
  if (invoiceBody) invoiceBody.scrollTop = 0;

  // إضافة صنف تلقائياً
  setTimeout(() => addInvoiceItem(), 100);
}

function closeInvoiceModal() {
  const modal = document.getElementById('invoiceModal');
  if (!modal) return;
  modal.classList.remove('active');
  document.body.style.overflow = '';
  modal.style.pointerEvents = 'none';
  setTimeout(() => { modal.style.pointerEvents = ''; }, 350);
}

function addInvoiceItem() {
  const itemsList = document.getElementById('invoiceItemsList');
  if (!itemsList) return;

  const index = invoiceItems.length;
  invoiceItems.push({ part_id: '', qty: 1, unit_cost: 0, new_sell_price: null });

  const itemRow = document.createElement('div');
  itemRow.className = 'invoice-item-row';
  itemRow.id = `invoiceItem-${index}`;
  itemRow.innerHTML = `
    <div class="searchable-select" id="invoiceAccessorySelect-${index}" title="اسم القطعة">
      <span class="searchable-select-icon">🔍</span>
      <input type="text" class="searchable-select-input" id="invoiceAccessorySearch-${index}" placeholder="بحث أو إضافة قطعة..." autocomplete="off">
      <input type="hidden" id="invoiceAccessoryId-${index}">
      <div class="searchable-dropdown" id="invoiceAccessoryDropdown-${index}"></div>
    </div>
    <input type="number" min="1" value="1" id="invoiceQty-${index}" class="invoice-qty-only" title="الكمية" onchange="updateInvoiceItem(${index}, 'quantity', this.value)">
    <input type="number" min="0" step="0.01" value="0" id="invoicePrice-${index}" class="invoice-price-input" title="سعر التكلفة (ج.م)" onchange="updateInvoiceItem(${index}, 'unit_price', this.value)" placeholder="0">
    <input type="number" min="0" step="0.01" id="invoiceSellPrice-${index}" class="invoice-sell-input" title="سعر البيع (ج.م)" onchange="updateInvoiceItem(${index}, 'new_sell_price', this.value)" placeholder="0">
    <input type="text" readonly value="0.00" id="itemTotal-${index}" class="invoice-total-display" title="الإجمالي = الكمية × سعر التكلفة" style="background:var(--bg-tertiary); font-size:12px;">
    <button type="button" class="btn-remove-item" onclick="removeInvoiceItem(${index})" title="حذف الصنف">✕</button>
  `;

  itemsList.appendChild(itemRow);
  
  // تفعيل البحث للصنف الجديد
  initInvoiceItemSearch(index);
  
  // التركيز على البحث
  setTimeout(() => {
    document.getElementById(`invoiceAccessorySearch-${index}`)?.focus();
  }, 50);
}

// تفعيل البحث لعناصر الفاتورة
function initInvoiceItemSearch(index) {
  const input = document.getElementById(`invoiceAccessorySearch-${index}`);
  const dropdown = document.getElementById(`invoiceAccessoryDropdown-${index}`);
  const container = document.getElementById(`invoiceAccessorySelect-${index}`);
  
  if (!input || !dropdown) return;

  let searchTimeout = null;
  let highlightIdx = -1;

  // فتح عند double click فقط
  input.addEventListener('dblclick', () => {
    renderInvoiceAccessoryDropdown(index, input.value);
    dropdown.classList.add('show');
  });

  // فتح عند الكتابة
  input.addEventListener('input', (e) => {
    clearTimeout(searchTimeout);
    searchTimeout = setTimeout(() => {
      renderInvoiceAccessoryDropdown(index, e.target.value);
      dropdown.classList.add('show');
      highlightIdx = -1;
    }, 150);
  });

  input.addEventListener('keydown', (e) => {
    const items = dropdown.querySelectorAll('.searchable-dropdown-item');
    
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (!dropdown.classList.contains('show')) {
        renderInvoiceAccessoryDropdown(index, input.value);
        dropdown.classList.add('show');
      }
      highlightIdx = Math.min(highlightIdx + 1, items.length - 1);
      items.forEach((item, i) => item.classList.toggle('highlighted', i === highlightIdx));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      highlightIdx = Math.max(highlightIdx - 1, 0);
      items.forEach((item, i) => item.classList.toggle('highlighted', i === highlightIdx));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (highlightIdx >= 0 && items[highlightIdx]) {
        const id = items[highlightIdx].dataset.id;
        if (id) {
          selectInvoiceAccessory(index, id);
        } else if (items[highlightIdx].classList.contains('add-new-item')) {
          items[highlightIdx].click();
        }
      } else if (dropdown.classList.contains('show')) {
        const addBtn = dropdown.querySelector('.add-new-item');
        if (addBtn) {
          addBtn.click();
        }
      }
    } else if (e.key === 'Escape') {
      dropdown.classList.remove('show');
    }
  });

  document.addEventListener('click', (e) => {
    if (!container.contains(e.target)) {
      dropdown.classList.remove('show');
    }
  });
}

function renderInvoiceAccessoryDropdown(index, searchTerm = '') {
  const dropdown = document.getElementById(`invoiceAccessoryDropdown-${index}`);
  if (!dropdown) return;

  const term = searchTerm.trim().toLowerCase();
  
  // ✅ فلترة قطع الصيانة (استخدام allRepairParts بدلاً من allAccessories)
  let filtered = allRepairParts || [];
  
  if (term) {
    filtered = filtered.filter(a => {
      const name = (a.name || '').toLowerCase();
      const category = (a.category || '').toLowerCase();
      const sku = (a.sku || '').toLowerCase();
      return name.includes(term) || category.includes(term) || sku.includes(term);
    });
  }

  filtered.sort((a, b) => (a.name || '').localeCompare(b.name || '', 'ar'));

  if (filtered.length === 0) {
    if (term) {
      const safeTerm = escapeHtml((searchTerm || '').trim());
      const dataTermAttr = ((searchTerm || '').trim()).replace(/"/g, '&quot;');
      dropdown.innerHTML = `
        <div class="searchable-dropdown-empty" style="border-bottom:1px solid var(--border); padding: 10px 14px;">
          <span style="opacity:0.7;">لا توجد قطعة بهذا الاسم</span>
        </div>
        <div class="searchable-dropdown-item add-new-item" data-term="${dataTermAttr}"
             onclick="quickCreateRepairPart(this.dataset.term, 'invoice', ${index})"
             style="background: linear-gradient(135deg, rgba(16,185,129,0.08), rgba(16,185,129,0.15)); padding: 14px; cursor: pointer; border-radius: 0 0 10px 10px;">
          <div style="display:flex; align-items:center; gap:10px; width:100%;">
            <span style="font-size:22px; flex-shrink:0;">➕</span>
            <div style="flex:1;">
              <div style="color:var(--success); font-weight:700; font-size:14px;">إضافة «${safeTerm}» وتوريدها</div>
              <div style="color:var(--text-secondary); font-size:11px; margin-top:2px;">ضغطة واحدة = إنشاء واختيار فوري</div>
            </div>
          </div>
        </div>`;
    } else {
      dropdown.innerHTML = `<div class="searchable-dropdown-empty">📦 اكتب اسم القطعة للبحث أو الإضافة</div>`;
    }
    return;
  }

  const items = filtered.slice(0, 30).map(a => {
    const stock = a.qty || 0;
    const stockClass = stock === 0 ? 'out' : stock < (a.min_qty || 5) ? 'low' : '';
    
    return `<div class="searchable-dropdown-item" data-id="${a.id}" onclick="selectInvoiceAccessory(${index}, ${a.id})">
      <div>
        <div class="searchable-item-name">${highlightMatch(a.name, term)}</div>
        <div class="searchable-item-details">${a.category || '-'} • SKU: ${a.sku || '-'}</div>
      </div>
      <span class="searchable-item-stock ${stockClass}">${stock}</span>
    </div>`;
  }).join('');

  dropdown.innerHTML = items;
}

function selectInvoiceAccessory(index, id) {
  // ✅ استخدام allRepairParts بدلاً من allAccessories
  const part = allRepairParts.find(a => a.id == id);
  if (!part) return;

  invoiceItems[index].part_id = id;

  const input = document.getElementById(`invoiceAccessorySearch-${index}`);
  const hiddenInput = document.getElementById(`invoiceAccessoryId-${index}`);
  const dropdown = document.getElementById(`invoiceAccessoryDropdown-${index}`);
  const container = document.getElementById(`invoiceAccessorySelect-${index}`);

  if (input) input.value = part.name;
  if (hiddenInput) hiddenInput.value = id;
  if (dropdown) dropdown.classList.remove('show');
  if (container) container.classList.add('has-value');

  // ✅ ملء سعر التكلفة وسعر البيع تلقائياً
  const priceInput = document.getElementById(`invoicePrice-${index}`);
  if (priceInput) {
    const unitCost = part.unit_cost || 0;
    priceInput.value = unitCost > 0 ? unitCost.toFixed(2) : '';
    invoiceItems[index].unit_price = unitCost;
    invoiceItems[index].unit_cost = unitCost;
    updateInvoiceItemTotal(index);
  }
  const sellPriceInput = document.getElementById(`invoiceSellPrice-${index}`);
  if (sellPriceInput) {
    const sp = part.sell_price || 0;
    sellPriceInput.value = sp > 0 ? sp.toFixed(2) : '';
    invoiceItems[index].new_sell_price = sp > 0 ? sp : null;
  }
}

function onInvoiceItemChange(index, select) {
  // لم نعد نحتاج هذه - تم استبدالها بـ selectInvoiceAccessory
}

function updateInvoiceItem(index, field, value) {
  if (field === 'new_sell_price') {
    const v = parseFloat(value);
    invoiceItems[index].new_sell_price = (value !== '' && value !== null && !isNaN(v) && v > 0) ? v : null;
  } else {
    const numValue = parseFloat(value) || 0;
    invoiceItems[index][field] = numValue;
    if (field === 'quantity') {
      invoiceItems[index].qty = numValue;
    } else if (field === 'qty') {
      invoiceItems[index].quantity = numValue;
    } else if (field === 'unit_price') {
      invoiceItems[index].unit_cost = numValue;
    } else if (field === 'unit_cost') {
      invoiceItems[index].unit_price = numValue;
    }
  }
  updateInvoiceItemTotal(index);
}

function updateInvoiceItemTotal(index) {
  const item = invoiceItems[index];
  const qty = item.quantity || item.qty || 0;
  const price = item.unit_price || item.unit_cost || 0;
  const total = qty * price;
  const totalEl = document.getElementById(`itemTotal-${index}`);
  if (totalEl) totalEl.value = fmt(total);
  updateInvoiceSummary();
}

function removeInvoiceItem(index) {
  const row = document.getElementById(`invoiceItem-${index}`);
  if (row) row.remove();
  invoiceItems[index] = null;
  updateInvoiceSummary();
}

// ═════════════════════════════════════════════════════════════
// ⚡ ONE-CLICK CREATE - إنشاء قطعة جديدة بضغطة واحدة بدون مودال
// ═════════════════════════════════════════════════════════════
async function quickCreateRepairPart(name, context, invoiceIndex) {
  if (!name || !name.trim()) return;
  const trimmedName = name.trim();

  // منع الضغط المتكرر
  const allBtns = document.querySelectorAll('.add-new-item');
  allBtns.forEach(b => { b.dataset.creating = '1'; b.style.opacity = '0.6'; b.style.pointerEvents = 'none'; });

  try {
    // 1. إنشاء القطعة
    const res = await fetch('elos-db://repair-parts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: trimmedName,
        category: null,
        sku: null,
        unit_cost: 0,
        sell_price: 0,
        qty: 0,
        min_qty: 0,
        notes: null,
        warehouse_id: null
      })
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'فشل إضافة القطعة');
    const newId = data.id;
    if (!newId) throw new Error('لم يُرجَع معرف القطعة');

    // 2. إعادة تحميل القطع
    const partsRes = await fetch('elos-db://repair-parts?all=true');
    if (partsRes.ok) {
      const raw = await partsRes.json();
      allRepairParts = Array.isArray(raw) ? raw : (raw?.parts || raw?.data || []);
      if (!Array.isArray(allRepairParts)) allRepairParts = [];
    }
    let added = allRepairParts.find(p => p.id == newId);

    // 3. Fallback
    if (!added) {
      try {
        const singleRes = await fetch(`elos-db://repair-parts/${newId}`);
        if (singleRes.ok) {
          const singlePart = await singleRes.json();
          if (singlePart && singlePart.id) {
            allRepairParts.unshift(singlePart);
            added = singlePart;
          }
        }
      } catch (e) {
        Logger.error('[QUICK-CREATE-PART] Fallback fetch failed:', e);
      }
    }

    // 4. اختيار القطعة فوراً
    if (added) {
      if (context === 'quick') {
        selectQuickAccessory(added.id);
      } else if (context === 'invoice' && invoiceIndex != null) {
        selectInvoiceAccessory(parseInt(invoiceIndex), added.id);
      }
      showToast(`تم إضافة «${trimmedName}» واختيارها`, 'success');
    } else {
      showToast('تم إضافة القطعة بنجاح، يرجى اختيارها يدوياً', 'info');
    }

    // إغلاق الـ dropdowns
    document.getElementById('quickAccessoryDropdown')?.classList.remove('show');
    for (let i = 0; i < (invoiceItems || []).length; i++) {
      document.getElementById(`invoiceAccessoryDropdown-${i}`)?.classList.remove('show');
    }

  } catch (err) {
    showToast(err.message || 'خطأ في الإضافة', 'error');
  } finally {
    document.querySelectorAll('.add-new-item').forEach(b => {
      delete b.dataset.creating;
      b.style.opacity = '';
      b.style.pointerEvents = '';
    });
  }
}

let _addPartContext = 'quick';
let _addPartInvoiceIndex = null;

function openAddPartFromPurchaseModal(context, invoiceIndex, prefillName) {
  _addPartContext = context || 'quick';
  _addPartInvoiceIndex = invoiceIndex != null ? parseInt(invoiceIndex) : null;
  const nameInput = document.getElementById('addPartFromPurchaseName');
  const catInput = document.getElementById('addPartFromPurchaseCategory');
  const unitCostInput = document.getElementById('addPartFromPurchaseUnitCost');
  const sellPriceInput = document.getElementById('addPartFromPurchaseSellPrice');
  if (nameInput) nameInput.value = (prefillName || '').trim();
  if (catInput) catInput.value = '';
  if (unitCostInput) unitCostInput.value = '';
  if (sellPriceInput) sellPriceInput.value = '';
  const modal = document.getElementById('addPartFromPurchaseModal');
  if (modal) {
    // ✅ Force clean state then show
    modal.classList.remove('active');
    void modal.offsetHeight;
    modal.classList.add('active');
    setTimeout(() => nameInput?.focus(), 80);
  }
  const quickDrop = document.getElementById('quickAccessoryDropdown');
  if (quickDrop) quickDrop.classList.remove('show');
  (invoiceItems || []).forEach((_, i) => {
    const d = document.getElementById(`invoiceAccessoryDropdown-${i}`);
    if (d) d.classList.remove('show');
  });
}

function closeAddPartFromPurchaseModal() {
  const modal = document.getElementById('addPartFromPurchaseModal');
  if (modal) {
    modal.classList.remove('active');
    modal.style.pointerEvents = 'none';
    setTimeout(() => { modal.style.pointerEvents = ''; }, 350);
  }
}

async function submitAddPartFromPurchase(e) {
  e.preventDefault();
  const name = document.getElementById('addPartFromPurchaseName')?.value?.trim();
  if (!name) {
    showToast('اسم القطعة مطلوب', 'warning');
    return;
  }
  const category = document.getElementById('addPartFromPurchaseCategory')?.value?.trim() || '';
  const unitCost = parseFloat(document.getElementById('addPartFromPurchaseUnitCost')?.value || 0) || 0;
  const sellPrice = parseFloat(document.getElementById('addPartFromPurchaseSellPrice')?.value || 0) || 0;
  const btn = e.target.querySelector('button[type="submit"]');
  if (btn) { btn.disabled = true; btn.textContent = '⏳ جاري الإضافة...'; }
  try {
    const res = await fetch('elos-db://repair-parts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name,
        category: category || null,
        sku: null,
        unit_cost: unitCost,
        sell_price: sellPrice,
        qty: 0,
        min_qty: 0,
        notes: null,
        warehouse_id: null
      })
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'فشل إضافة القطعة');
    const newId = data.id;
    if (!newId) throw new Error('لم يُرجَع معرف القطعة');

    const partsRes = await fetch('elos-db://repair-parts?all=true');
    if (partsRes.ok) {
      const raw = await partsRes.json();
      allRepairParts = Array.isArray(raw) ? raw : (raw?.parts || raw?.data || []);
      if (!Array.isArray(allRepairParts)) allRepairParts = [];
    }
    let added = allRepairParts.find(p => p.id == newId);

    // ✅ لو القطعة مش موجودة في القائمة، جلبها مباشرة بالـ ID
    if (!added) {
      try {
        const singleRes = await fetch(`elos-db://repair-parts/${newId}`);
        if (singleRes.ok) {
          const singlePart = await singleRes.json();
          if (singlePart && singlePart.id) {
            allRepairParts.unshift(singlePart);
            added = singlePart;
          }
        }
      } catch (e) {
        Logger.error('[ADD-PART] Failed to fetch new part by ID:', e);
      }
    }

    if (added) {
      if (_addPartContext === 'quick') {
        selectQuickAccessory(added.id);
      } else if (_addPartContext === 'invoice' && _addPartInvoiceIndex != null) {
        selectInvoiceAccessory(_addPartInvoiceIndex, added.id);
      }
      closeAddPartFromPurchaseModal();
      showToast('تم إضافة القطعة واختيارها للتوريد', 'success');
    } else {
      closeAddPartFromPurchaseModal();
      showToast('تم إضافة القطعة بنجاح، يرجى اختيارها يدوياً من القائمة', 'info');
    }
  } catch (err) {
    showToast(err.message || 'خطأ في الإضافة', 'error');
  } finally {
    if (btn) { btn.disabled = false; btn.textContent = '✓ إضافة ثم اختيار'; }
  }
}

function updateInvoiceSummary() {
  const validItems = invoiceItems.filter(i => i && i.part_id);
  const totalQty = validItems.reduce((sum, i) => sum + (i.quantity || i.qty || 0), 0);
  const grandTotal = validItems.reduce((sum, i) => {
    const qty = i.quantity || i.qty || 0;
    const price = i.unit_price || i.unit_cost || 0;
    return sum + (qty * price);
  }, 0);

  document.getElementById('invoiceItemsCount').textContent = validItems.length;
  document.getElementById('invoiceTotalQuantity').textContent = totalQty;
  document.getElementById('invoiceGrandTotal').textContent = fmt(grandTotal) + ' ج.م';
  
  // تحديث المبلغ المدفوع الافتراضي
  const paidInput = document.getElementById('invoicePaidAmount');
  if (paidInput && !paidInput.dataset.userModified) {
    paidInput.value = grandTotal > 0 ? grandTotal.toFixed(2) : '';
  }
  
  calculateInvoicePayment();
}

function calculateInvoicePayment() {
  const validItems = invoiceItems.filter(i => i && i.part_id);
  const grandTotal = validItems.reduce((sum, i) => {
    const qty = i.quantity || i.qty || 0;
    const price = i.unit_price || i.unit_cost || 0;
    return sum + (qty * price);
  }, 0);
  const paid = parseFloat(document.getElementById('invoicePaidAmount')?.value || 0);
  const remaining = grandTotal - paid;

  const remainingRow = document.getElementById('invoiceRemainingRow');
  const remainingInput = document.getElementById('invoiceRemainingAmount');
  const settlementBox = document.getElementById('settlementBox');

  // ✅ جلب رصيد المورد المحدد
  const supplierId = document.getElementById('invoiceSupplierId')?.value;
  const supplier = supplierId ? allSuppliers.find(s => s.id == supplierId) : null;
  const supplierBalance = parseFloat(supplier?.balance) || 0;

  if (paid > grandTotal && grandTotal > 0 && supplierBalance > 0) {
    // ✅ حالة التسوية: المدفوع أكبر من الفاتورة والمورد عليه رصيد
    remainingRow.style.display = 'none';
    const settlementAmount = paid - grandTotal;
    const maxSettlement = Math.min(settlementAmount, supplierBalance);

    if (settlementBox) {
      settlementBox.style.display = 'block';
      document.getElementById('settlementInvoicePay').textContent = fmt(grandTotal) + ' ج.م';
      document.getElementById('settlementOldDebt').textContent = fmt(maxSettlement) + ' ج.م';
      document.getElementById('settlementTotalPay').textContent = fmt(paid) + ' ج.م';
      document.getElementById('settlementRemainingBalance').textContent = fmt(supplierBalance - maxSettlement) + ' ج.م';
    }
  } else {
    // الحالة العادية
    if (settlementBox) settlementBox.style.display = 'none';

    if (remaining > 0 && grandTotal > 0) {
      remainingRow.style.display = 'block';
      remainingInput.value = fmt(remaining) + ' ج.م';
    } else {
      remainingRow.style.display = 'none';
    }
  }

  // تعليم أن المستخدم عدّل الحقل
  const paidInput = document.getElementById('invoicePaidAmount');
  if (paidInput && document.activeElement === paidInput) {
    paidInput.dataset.userModified = 'true';
  }
}

// ✅ عند تغيير المورد في الفاتورة - عرض رصيده
function onInvoiceSupplierChange() {
  const supplierId = document.getElementById('invoiceSupplierId')?.value;
  const balanceInfo = document.getElementById('supplierBalanceInfo');
  const balanceAmount = document.getElementById('supplierBalanceAmount');

  if (supplierId) {
    const supplier = allSuppliers.find(s => s.id == supplierId);
    const balance = parseFloat(supplier?.balance) || 0;
    if (balance > 0) {
      balanceInfo.style.display = 'block';
      balanceAmount.textContent = fmt(balance);
    } else {
      balanceInfo.style.display = 'none';
    }
  } else {
    balanceInfo.style.display = 'none';
  }

  // إعادة حساب الدفع لتحديث بوكس التسوية
  calculateInvoicePayment();
}

async function handleInvoiceSubmit(e) {
  e.preventDefault();

  try {
    // ═══════════════════════════════════════════════════════════════
    // ✅ VALIDATION - التحقق من الأصناف المضافة
    // ═══════════════════════════════════════════════════════════════
    const validItems = invoiceItems.filter(i => i && i.part_id && (i.qty > 0 || i.quantity > 0));
    if (validItems.length === 0) throw new Error('يجب إضافة صنف واحد على الأقل');

    // التحقق من صحة بيانات كل صنف
    for (let i = 0; i < validItems.length; i++) {
      const item = validItems[i];
      const price = item.unit_price || item.unit_cost || 0;
      if (!price || parseFloat(price) <= 0) {
        const part = allRepairParts.find(a => a.id == item.part_id);
        throw new Error(`قطعة "${part?.name || i + 1}": يجب إدخال سعر الوحدة`);
      }
    }

    // توليد رقم فاتورة موحد للمشتريات
    let invoiceNumber = document.getElementById('invoiceNumber').value;
    if (!invoiceNumber) {
      try {
        const invoiceRes = await fetch('elos-db://invoice-number/purchase');
        const invoiceData = await invoiceRes.json();
        if (invoiceData.success) {
          invoiceNumber = invoiceData.invoiceNumber;
        } else {
          invoiceNumber = `PUR-${Date.now()}`;
        }
      } catch (e) {
        invoiceNumber = `PUR-${Date.now()}`;
      }
    }
    const invoiceDate = document.getElementById('invoiceDate').value;
    const supplierId = document.getElementById('invoiceSupplierId').value;
    const notes = document.getElementById('invoiceNotes').value;
    const paymentMethod = document.getElementById('invoicePaymentMethod').value;
    const warehouseId = document.getElementById('invoiceWarehouseId')?.value || null;
    
    // ✅ الحصول على المحفظة المحددة
    const walletSelect = document.getElementById('invoiceWalletSelect');
    const walletId = (walletSelect && walletSelect.value && (paymentMethod === 'mobile_wallet' || paymentMethod === 'bank')) 
      ? parseInt(walletSelect.value) : null;

    // حساب إجمالي الفاتورة
    const totalAmount = validItems.reduce((sum, i) =>
      sum + (parseFloat(i.quantity) * parseFloat(i.unit_price)), 0);

    // ═══════════════════════════════════════════════════════════════
    // 💰 PAYMENT VALIDATION - التحقق من المبلغ المدفوع
    // ═══════════════════════════════════════════════════════════════
    const paidAmountInput = document.getElementById('invoicePaidAmount');
    let paidAmount = parseFloat(paidAmountInput?.value) || 0;

    // لو طريقة الدفع مش آجل ومحدش كتب المبلغ المدفوع
    if (paymentMethod !== 'deferred' && paidAmount === 0) {
      const supplierName = allSuppliers.find(s => s.id == supplierId)?.name || 'المورد';
      // ✅ استخدام showConfirm بدلاً من confirm
      const confirmNoPay = await showConfirm(
        `⚠️ تحذير: المبلغ المدفوع = 0\n\n` +
        `إجمالي الفاتورة: ${fmt(totalAmount)} ج.م\n` +
        `عدد الأصناف: ${validItems.length}\n` +
        `المورد: ${supplierName}\n\n` +
        `هل تريد تسجيل الفاتورة بدون دفع أي مبلغ؟\n` +
        `سيتم تسجيل كامل المبلغ كدين على المورد.`,
        'متابعة بدون دفع', 'إدخال المبلغ', 'warning'
      );
      if (!confirmNoPay) {
        paidAmountInput?.focus();
        return;
      }
    }

    // ✅ التحقق من المبلغ المدفوع - السماح بالتسوية لو المورد عليه رصيد
    if (paidAmount > totalAmount) {
      const supplier = supplierId ? allSuppliers.find(s => s.id == supplierId) : null;
      const supplierBalance = parseFloat(supplier?.balance) || 0;
      const settlementAmount = paidAmount - totalAmount;

      if (!supplierId) {
        throw new Error(`المبلغ المدفوع (${fmt(paidAmount)}) أكبر من إجمالي الفاتورة (${fmt(totalAmount)}).\nلا يمكن عمل تسوية بدون تحديد مورد.`);
      }
      if (supplierBalance <= 0) {
        throw new Error(`المبلغ المدفوع (${fmt(paidAmount)}) أكبر من إجمالي الفاتورة (${fmt(totalAmount)}).\nالمورد ليس عليه رصيد سابق للتسوية.`);
      }
      if (settlementAmount > supplierBalance) {
        throw new Error(`مبلغ التسوية (${fmt(settlementAmount)}) أكبر من رصيد المورد (${fmt(supplierBalance)}).\nالحد الأقصى للدفع: ${fmt(totalAmount + supplierBalance)} ج.م`);
      }

      // تأكيد التسوية مع المستخدم
      const supplierName = supplier?.name || 'المورد';
      const confirmSettlement = await showConfirm(
        `💰 تسوية رصيد مورد\n\n` +
        `المورد: ${supplierName}\n` +
        `إجمالي الفاتورة: ${fmt(totalAmount)} ج.م\n` +
        `المبلغ المدفوع: ${fmt(paidAmount)} ج.م\n\n` +
        `سداد الفاتورة: ${fmt(totalAmount)} ج.م\n` +
        `تسوية رصيد سابق: ${fmt(settlementAmount)} ج.م\n` +
        `الرصيد بعد التسوية: ${fmt(supplierBalance - settlementAmount)} ج.م\n\n` +
        `هل تريد المتابعة؟`,
        'تأكيد التسوية', 'إلغاء', 'info'
      );
      if (!confirmSettlement) return;
    }

    const response = await fetch('elos-db://purchase-invoices', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        invoice_number: invoiceNumber,
        invoice_date: invoiceDate,
        supplier_id: supplierId || null,
        notes: notes,
        paid_amount: paidAmount,
        payment_method: paymentMethod,
        wallet_type: paymentMethod !== 'deferred' ? paymentMethod : null,
        wallet_id: paymentMethod !== 'deferred' ? walletId : null,
        items: validItems.map(i => ({
          part_id: parseInt(i.part_id),
          quantity: parseInt(i.quantity || i.qty || 1),
          unit_price: parseFloat(i.unit_price || i.unit_cost || 0),
          new_sell_price: (i.new_sell_price != null && i.new_sell_price > 0) ? parseFloat(i.new_sell_price) : null,
          warehouse_id: warehouseId ? Number(warehouseId) : null
        }))
      })
    });

    if (!response.ok) {
      let errorMessage = 'فشل حفظ الفاتورة';
      try {
        // قراءة النص أولاً
        const errorText = await response.text();
        // محاولة تحويله إلى JSON
        try {
          const err = JSON.parse(errorText);
          errorMessage = err.error || err.message || errorText || errorMessage;
        } catch (e) {
          // إذا لم يكن JSON، استخدم النص مباشرة
          errorMessage = errorText || errorMessage;
        }
      } catch (e) {
        // في حالة فشل قراءة النص
        errorMessage = `خطأ ${response.status}: ${response.statusText || errorMessage}`;
      }
      throw new Error(errorMessage);
    }

    const result = await response.json();
    
    // عرض تحذير الخزنة لو موجود
    if (result.balanceWarning) {
      showToast(`⚠️ ${result.balanceWarning}`, 'error');
    }
    
    // عرض رسالة الدين للمورد
    if (result.supplierDebt > 0) {
      const supplierName = allSuppliers.find(s => s.id == supplierId)?.name || 'المورد';
      showToast(`💳 تم تسجيل ${fmt(result.supplierDebt)} ج.م دين لـ "${supplierName}"`, 'info');
    }

    // ✅ عرض رسالة التسوية
    if (result.settlementAmount > 0) {
      const supplierName = allSuppliers.find(s => s.id == supplierId)?.name || 'المورد';
      showToast(`✅ تم تسوية ${fmt(result.settlementAmount)} ج.م من رصيد "${supplierName}"`, 'success');
    }

    // ✅ عرض رصيد المحفظة المحددة بعد التوريد
    let successMessage = `✅ تم حفظ الفاتورة ${result.invoice_number} • ${validItems.length} صنف`;
    if (result.walletBalanceAfter !== null && result.walletBalanceAfter !== undefined) {
      const walletSelect = document.getElementById('invoiceWalletSelect');
      const walletName = walletSelect?.options[walletSelect.selectedIndex]?.text || 'المحفظة المحددة';
      successMessage += `\n💰 رصيد ${walletName}: ${fmt(result.walletBalanceAfter)} ج.م`;
    }
    showToast(successMessage);
    closeInvoiceModal();

    // ✅ تحديث رصيد المورد في الـ allSuppliers بعد التسوية
    if (supplierId) {
      try {
        const supRes = await fetch(`elos-db://suppliers?id=${supplierId}`);
        if (supRes.ok) {
          const supData = await supRes.json();
          if (supData) {
            const idx = allSuppliers.findIndex(s => s.id == supplierId);
            if (idx !== -1) allSuppliers[idx] = supData;
          }
        }
      } catch(e) { /* ignore */ }
    }

    // ═══════════════════════════════════════════════════════════════
    // 🏷️ سؤال المستخدم عن طباعة الباركود لقطع الصيانة الموردة
    // ═══════════════════════════════════════════════════════════════
    if (validItems.length > 0) {
      // تجهيز قائمة القطع للطباعة
      const itemsForBarcode = validItems.map(item => {
        const part = allRepairParts.find(a => a.id == item.part_id);
        const qty = item.qty || item.quantity || 1;
        return {
          id: item.part_id,
          name: part?.name || 'غير معروف',
          category: part?.category || '',
          brand: part?.brand || '',
          short_code: part?.short_code || part?.barcode || '',
          sale_price: item.new_sell_price || part?.sell_price,
          sell_price: item.new_sell_price || part?.sell_price,
          quantity: qty // الكمية الموردة
        };
      }).filter(item => item.short_code); // فقط القطع التي لها كود

      if (itemsForBarcode.length > 0) {
        const totalQty = itemsForBarcode.reduce((sum, i) => sum + (i.quantity || 1), 0);
        const itemsList = itemsForBarcode.map(i => `• ${i.name} (${i.quantity} قطعة)`).join('\n');

        const wantPrint = await showConfirm(
          `🏷️ هل تريد طباعة باركود لقطع الصيانة الموردة؟\n\n` +
          `${itemsList}\n\n` +
          `📊 إجمالي: ${itemsForBarcode.length} صنف، ${totalQty} قطعة`,
          `طباعة ${totalQty} باركود`, 'لاحقاً', 'info'
        );

        if (wantPrint) {
          try {
            Logger.log('[INVOICE BARCODE] Starting barcode print...');
            Logger.log('[INVOICE BARCODE] Items to print:', itemsForBarcode.length);

            // تجهيز الأصناف للطباعة - كل قطعة بعدد الكمية الموردة
            const labelsToprint = [];
            itemsForBarcode.forEach(item => {
              for (let i = 0; i < (item.quantity || 1); i++) {
                labelsToprint.push({ ...item });
              }
            });
            Logger.log('[INVOICE BARCODE] Total labels:', labelsToprint.length);

            // محاولة الطباعة عبر BarcodeService مباشرة أولاً
            if (typeof BarcodeService !== 'undefined' && BarcodeService.printLabels) {
              Logger.log('[INVOICE BARCODE] Using BarcodeService.printLabels');
              await BarcodeService.printLabels(labelsToprint, {
                type: 'accessory',
                copies: 1,
                showPrice: true
              });
            } else if (typeof window.BarcodeGenerator?.printBarcodeLabels === 'function') {
              Logger.log('[INVOICE BARCODE] Using BarcodeGenerator.printBarcodeLabels');
              await window.BarcodeGenerator.printBarcodeLabels(labelsToprint, {
                type: 'accessory',
                copies: 1,
                showPrice: true
              });
            } else if (typeof showBarcodePreviewModal === 'function' && itemsForBarcode.length === 1) {
              Logger.log('[INVOICE BARCODE] Using showBarcodePreviewModal fallback');
              showBarcodePreviewModal(itemsForBarcode[0], 'accessory');
            } else {
              Logger.error('[INVOICE BARCODE] No barcode printing method available!');
              showToast('لا تتوفر طريقة لطباعة الباركود', 'warning');
            }
          } catch (barcodeError) {
            Logger.error('[INVOICE BARCODE] Error:', barcodeError);
            showToast('فشل طباعة الباركود: ' + barcodeError.message, 'error');
          }
        }
      }
    }

    await loadInitialData();

  } catch (error) {
    Logger.error('[INVOICE] Error:', error);
    showToast(error.message, 'error');
  }
}

async function viewInvoice(id) {
  try {
    const response = await fetch(`elos-db://purchase-invoices/${id}`);
    if (!response.ok) throw new Error('فشل جلب الفاتورة');

    const data = await response.json();
    const inv = data.invoice;
    const items = data.items || [];
    const sup = allSuppliers.find(s => s.id === inv?.supplier_id);

    const itemsHtml = items.map((item, i) => {
      const part = allRepairParts.find(a => a.id === item.part_id);
      return `<div class="detail-item-row">
        <span>${i + 1}</span>
        <span>${part?.name || item.part_name || 'غير معروف'}</span>
        <span>${item.qty || item.quantity || 0}</span>
        <span>${fmt(item.unit_cost || item.unit_price)} ج.م</span>
        <span class="text-success">${fmt((item.qty || item.quantity || 0) * (item.unit_cost || item.unit_price || 0))} ج.م</span>
      </div>`;
    }).join('');

    const detailsHtml = `
      <div class="details-section">
        <div class="details-header">
          <span class="details-icon">📄</span>
          <span>فاتورة رقم: <strong>${inv?.invoice_number}</strong></span>
        </div>
        <div class="details-grid">
          <div class="detail-box">
            <span class="detail-label">التاريخ</span>
            <span class="detail-value">${new Date(inv?.invoice_date || inv?.created_at).toLocaleDateString('ar-EG', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</span>
          </div>
          <div class="detail-box">
            <span class="detail-label">المورد</span>
            <span class="detail-value">${sup?.name || 'غير محدد'}</span>
          </div>
          <div class="detail-box">
            <span class="detail-label">عدد الأصناف</span>
            <span class="detail-value">${inv?.items_count || items.length}</span>
          </div>
          <div class="detail-box">
            <span class="detail-label">الحالة</span>
            <span class="detail-value"><span class="badge ${inv?.status === 'completed' ? 'success' : 'danger'}">${inv?.status === 'completed' ? 'مكتمل' : 'ملغي'}</span></span>
          </div>
          <div class="detail-box">
            <span class="detail-label">بواسطة</span>
            <span class="detail-value">${inv?.user_name || 'النظام'}</span>
          </div>
          <div class="detail-box">
            <span class="detail-label">وقت الإنشاء</span>
            <span class="detail-value">${new Date(inv?.created_at).toLocaleTimeString('ar-EG')}</span>
          </div>
        </div>
        ${inv?.notes ? `<div class="detail-notes"><span class="detail-label">ملاحظات:</span> ${inv.notes}</div>` : ''}
      </div>
      <div class="details-section">
        <div class="details-header"><span class="details-icon">📦</span><span>الأصناف</span></div>
        <div class="detail-items-list">
          <div class="detail-item-row header">
            <span>#</span><span>الصنف</span><span>الكمية</span><span>السعر</span><span>الإجمالي</span>
          </div>
          ${itemsHtml}
        </div>
      </div>
      <div class="details-total">
        <span>الإجمالي الكلي</span>
        <span>${fmt(inv?.total_amount)} ج.م</span>
      </div>
    `;

    showDetailsModal('تفاصيل الفاتورة', detailsHtml);

  } catch (error) {
    Logger.error('[INVOICE] Error:', error);
    showToast('فشل عرض الفاتورة', 'error');
  }
}

// ═════════════════════════════════════════════════════════════
// 🏷️ BARCODE PRINTING FOR PURCHASES
// ═════════════════════════════════════════════════════════════

// طباعة باركود لتوريد سريع واحد
async function printQuickPurchaseBarcode(purchaseId) {
  const purchase = allPurchases.find(p => p.id === purchaseId);
  if (!purchase) {
    showToast('لم يتم العثور على التوريد', 'error');
    return;
  }

  const part = allRepairParts.find(a => a.id === purchase.part_id);
  if (!part) {
    showToast('لم يتم العثور على بيانات القطعة', 'error');
    return;
  }

  const shortCode = part.short_code || part.barcode || '';
  if (!shortCode) {
    showToast('هذه القطعة ليس لها كود باركود', 'warning');
    return;
  }

  const partForBarcode = {
    id: part.id,
    name: part.name,
    category: part.category || '',
    brand: part.brand || '',
    short_code: shortCode,
    sale_price: part.sell_price,
    sell_price: part.sell_price
  };

  const qty = purchase.qty || 1;

  // سؤال المستخدم عن عدد النسخ
  const wantPrint = await showConfirm(
    `🏷️ طباعة باركود لقطعة الصيانة\n\n` +
    `🔧 ${part.name}\n` +
    `🔢 الكمية الموردة: ${qty}\n` +
    `🏷️ كود: ${shortCode}`,
    `طباعة ${qty} نسخة`, 'إلغاء', 'info'
  );

  if (wantPrint) {
    if (typeof window.BarcodeGenerator?.printBarcodeLabels === 'function') {
      window.BarcodeGenerator.printBarcodeLabels([partForBarcode], {
        type: 'accessory',
        copies: qty,
        showPrice: true
      });
    } else if (typeof showBarcodePreviewModal === 'function') {
      showBarcodePreviewModal(partForBarcode, 'accessory');
    }
  }
}
window.printQuickPurchaseBarcode = printQuickPurchaseBarcode;

// طباعة باركود لفاتورة كاملة
async function printInvoiceBarcode(invoiceId) {
  try {
    const response = await fetch(`elos-db://purchase-invoices/${invoiceId}`);
    if (!response.ok) throw new Error('فشل جلب الفاتورة');

    const data = await response.json();
    const items = data.items || [];

    if (items.length === 0) {
      showToast('الفاتورة لا تحتوي على أصناف', 'warning');
      return;
    }

    // تجهيز قائمة القطع للطباعة
    const itemsForBarcode = items.map(item => {
      const part = allRepairParts.find(a => a.id == item.part_id);
      const qty = item.qty || item.quantity || 1;
      return {
        id: item.part_id,
        name: part?.name || item.part_name || 'غير معروف',
        category: part?.category || '',
        brand: part?.brand || '',
        short_code: part?.short_code || part?.barcode || '',
        sale_price: part?.sell_price,
        sell_price: part?.sell_price,
        quantity: qty
      };
    }).filter(item => item.short_code);

    if (itemsForBarcode.length === 0) {
      showToast('لا توجد قطع لها كود باركود', 'warning');
      return;
    }

    const totalQty = itemsForBarcode.reduce((sum, i) => sum + (i.quantity || 1), 0);
    const itemsList = itemsForBarcode.map(i => `• ${i.name} (${i.quantity})`).join('\n');

    const wantPrint = await showConfirm(
      `🏷️ طباعة باركود لقطع الفاتورة\n\n` +
      `${itemsList}\n\n` +
      `📊 إجمالي: ${itemsForBarcode.length} قطعة، ${totalQty} وحدة`,
      `طباعة ${totalQty} باركود`, 'إلغاء', 'info'
    );

    if (wantPrint) {
      if (typeof window.BarcodeGenerator?.printBarcodeLabels === 'function') {
        const labelsToprint = [];
        itemsForBarcode.forEach(item => {
          for (let i = 0; i < (item.quantity || 1); i++) {
            labelsToprint.push({ ...item });
          }
        });
        window.BarcodeGenerator.printBarcodeLabels(labelsToprint, {
          type: 'accessory',
          copies: 1,
          showPrice: true
        });
      }
    }
  } catch (error) {
    Logger.error('[PRINT INVOICE BARCODE] Error:', error);
    showToast('فشل طباعة الباركود: ' + error.message, 'error');
  }
}
window.printInvoiceBarcode = printInvoiceBarcode;

// ═════════════════════════════════════════════════════════════
// 📋 PURCHASE DETAILS MODAL
// ═════════════════════════════════════════════════════════════
function showPurchaseDetails(purchaseId) {
  const purchase = allPurchases.find(p => p.id === purchaseId);
  if (!purchase) {
    showToast('لم يتم العثور على التوريد', 'error');
    return;
  }

  // ✅ استخدام part_name من API مباشرة، مع fallback للبحث في allRepairParts
  const partName = purchase.part_name || (() => {
    const part = allRepairParts.find(a => a.id === purchase.part_id);
    return part?.name;
  })() || 'غير معروف';
  
  const partCategory = purchase.part_category || (() => {
    const part = allRepairParts.find(a => a.id === purchase.part_id);
    return part?.category;
  })() || '-';
  
  const partSku = purchase.part_sku || (() => {
    const part = allRepairParts.find(a => a.id === purchase.part_id);
    return part?.sku;
  })() || '-';
  
  const partUnitCost = (() => {
    const part = allRepairParts.find(a => a.id === purchase.part_id);
    return part?.unit_cost || 0;
  })();
  
  const sup = allSuppliers.find(s => s.id === purchase.supplier_id);
  const date = new Date(purchase.created_at);
  
  const typeClass = purchase.reference_type === 'invoice' ? 'info' : 'warning';
  const typeName = purchase.reference_type === 'invoice' ? 'فاتورة توريد' : 'توريد سريع';

  const detailsHtml = `
    <div class="details-section">
      <div class="details-header">
        <span class="details-icon">${purchase.reference_type === 'invoice' ? '📄' : '⚡'}</span>
        <span>${typeName}</span>
        <span class="badge ${typeClass}" style="margin-right:auto;">#${purchase.id}</span>
      </div>
      <div class="details-grid">
        <div class="detail-box highlight">
          <span class="detail-label">قطعة الصيانة</span>
          <span class="detail-value large">${partName}</span>
        </div>
        <div class="detail-box">
          <span class="detail-label">الفئة</span>
          <span class="detail-value">${partCategory}</span>
        </div>
        <div class="detail-box">
          <span class="detail-label">SKU</span>
          <span class="detail-value">${partSku}</span>
        </div>
        <div class="detail-box">
          <span class="detail-label">سعر التكلفة</span>
          <span class="detail-value" style="font-family:monospace;">${fmt(partUnitCost)} ج.م</span>
        </div>
      </div>
    </div>

    <div class="details-section">
      <div class="details-header"><span class="details-icon">📊</span><span>تفاصيل العملية</span></div>
      <div class="details-grid">
        <div class="detail-box">
          <span class="detail-label">الكمية</span>
          <span class="detail-value large text-accent">${purchase.qty || purchase.quantity || 0}</span>
        </div>
        <div class="detail-box">
          <span class="detail-label">سعر الوحدة</span>
          <span class="detail-value">${fmt(purchase.unit_cost || purchase.unit_price || 0)} ج.م</span>
        </div>
        <div class="detail-box success-box">
          <span class="detail-label">الإجمالي</span>
          <span class="detail-value large text-success">${fmt((purchase.qty || purchase.quantity || 0) * (purchase.unit_cost || purchase.unit_price || 0))} ج.م</span>
        </div>
        <div class="detail-box">
          <span class="detail-label">المخزون قبل</span>
          <span class="detail-value">${purchase.quantity_before ?? '-'}</span>
        </div>
        <div class="detail-box">
          <span class="detail-label">المخزون بعد</span>
          <span class="detail-value text-success">${purchase.quantity_after ?? '-'}</span>
        </div>
      </div>
    </div>

    <div class="details-section">
      <div class="details-header"><span class="details-icon">ℹ️</span><span>معلومات إضافية</span></div>
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
          <span class="detail-label">المورد</span>
          <span class="detail-value">${sup?.name || 'غير محدد'}</span>
        </div>
        <div class="detail-box">
          <span class="detail-label">بواسطة</span>
          <span class="detail-value">${purchase.user_name || purchase.created_by_name || 'النظام'}</span>
        </div>
        ${purchase.reference_id ? `<div class="detail-box">
          <span class="detail-label">رقم المرجع</span>
          <span class="detail-value" style="font-family:monospace;">${purchase.reference_id}</span>
        </div>` : ''}
      </div>
      ${purchase.notes ? `<div class="detail-notes"><span class="detail-label">ملاحظات:</span> ${purchase.notes}</div>` : ''}
      ${purchase.reason ? `<div class="detail-notes"><span class="detail-label">السبب:</span> ${purchase.reason}</div>` : ''}
    </div>
  `;

  showDetailsModal('تفاصيل التوريد', detailsHtml);
}

function showDetailsModal(title, content) {
  // إنشاء أو استخدام modal التفاصيل
  let modal = document.getElementById('detailsModal');
  
  if (!modal) {
    modal = document.createElement('div');
    modal.id = 'detailsModal';
    modal.className = 'modal-overlay';
    modal.innerHTML = `
      <div class="modal details-modal">
        <div class="modal-header">
          <div class="modal-title" id="detailsModalTitle"></div>
          <button class="modal-close" onclick="closeDetailsModal()">✕</button>
        </div>
        <div class="modal-body" id="detailsModalBody"></div>
        <div class="modal-footer">
          <button class="btn-modal btn-cancel" onclick="closeDetailsModal()">إغلاق</button>
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

  // ✅ Force clean state then show
  modal.classList.remove('active');
  void modal.offsetHeight;
  modal.classList.add('active');
  document.body.style.overflow = 'hidden';
}

function closeDetailsModal() {
  const modal = document.getElementById('detailsModal');
  if (modal) {
    modal.classList.remove('active');
    document.body.style.overflow = '';
    modal.style.pointerEvents = 'none';
    setTimeout(() => { modal.style.pointerEvents = ''; }, 350);
  }
}

// ═════════════════════════════════════════════════════════════
// 🔄 ACCESSORY PURCHASE RETURN - نظام مرتجع توريد الإكسسوارات
// ═════════════════════════════════════════════════════════════

// متغيرات المرتجع الحالي
let currentReturnData = null;

async function openAccessoryReturnModal(purchaseId) {
  // البحث عن التوريد
  const purchase = allPurchases.find(p => p.id === purchaseId || p.id === String(purchaseId));

  if (!purchase) {
    showToast('لم يتم العثور على التوريد', 'error');
    return;
  }

  // التحقق من حالة التوريد
  if (purchase.status === 'returned') {
    showToast('هذا التوريد تم إرجاعه مسبقاً', 'warning');
    return;
  }

  // جلب بيانات قطعة الصيانة والمورد
  const part = allRepairParts.find(a => a.id === purchase.part_id);
  const supplier = allSuppliers.find(s => s.id === purchase.supplier_id);

  // جلب رصيد المورد الحالي
  let supplierBalance = 0;
  if (purchase.supplier_id) {
    try {
      const response = await fetch(`elos-db://suppliers?id=${purchase.supplier_id}`);
      const result = await response.json();
      if (result && result.balance !== undefined) {
        supplierBalance = parseFloat(result.balance) || 0;
      } else if (result.success && result.data && result.data.length > 0) {
        supplierBalance = parseFloat(result.data[0].balance) || 0;
      }
    } catch (err) {
      Logger.error('[RETURN] Error fetching supplier balance:', err);
    }
  }

  // حفظ بيانات المرتجع
  currentReturnData = {
    purchaseId: purchase.id,
    partId: purchase.part_id,
    partName: part?.name || 'غير معروف',
    supplierId: purchase.supplier_id,
    supplierName: supplier?.name || '-',
    supplierBalance: supplierBalance,
    maxQuantity: purchase.quantity,
    unitPrice: parseFloat(purchase.unit_price) || 0,
    totalPrice: parseFloat(purchase.total_price) || 0,
    purchaseDate: purchase.created_at
  };

  // بناء الـ Modal
  const modalHtml = buildReturnModal(currentReturnData);

  // إزالة أي مودال قديم
  const existingModal = document.getElementById('accessoryReturnModal');
  if (existingModal) existingModal.remove();

  document.body.insertAdjacentHTML('beforeend', modalHtml);
  document.body.style.overflow = 'hidden';
  
  // ✅ تحميل المحافظ عند فتح المودال
  await loadPaymentWallets();

  // تحديث الحسابات الأولية
  updateReturnCalculations();
}
window.openAccessoryReturnModal = openAccessoryReturnModal;

function buildReturnModal(data) {
  return `
    <div id="accessoryReturnModal" class="modal-overlay" style="display:flex;position:fixed;inset:0;background:rgba(0,0,0,0.8);backdrop-filter:blur(6px);z-index:10000;align-items:center;justify-content:center;">
      <div class="modal" style="background:var(--bg-secondary);border:1px solid var(--border);border-radius:16px;max-width:600px;width:95%;max-height:90vh;display:flex;flex-direction:column;box-shadow:0 25px 50px -12px rgba(0,0,0,0.5);">

        <!-- Header -->
        <div class="modal-header" style="display:flex;justify-content:space-between;align-items:center;padding:20px 24px;border-bottom:1px solid var(--border);background:linear-gradient(135deg, rgba(239,68,68,0.15) 0%, rgba(239,68,68,0.05) 100%);">
          <div style="display:flex;align-items:center;gap:12px;">
            <div style="width:40px;height:40px;background:rgba(239,68,68,0.2);border-radius:10px;display:flex;align-items:center;justify-content:center;font-size:20px;">↩️</div>
            <div>
              <div style="font-size:18px;font-weight:700;color:var(--danger);">مرتجع توريد إكسسوار</div>
              <div style="font-size:12px;color:var(--text-secondary);margin-top:2px;">إرجاع بضاعة للمورد</div>
            </div>
          </div>
          <button onclick="closeAccessoryReturnModal()" style="background:var(--bg-tertiary);border:none;color:var(--text-secondary);width:36px;height:36px;border-radius:8px;cursor:pointer;font-size:18px;display:flex;align-items:center;justify-content:center;transition:all 0.2s;" onmouseover="this.style.background='var(--danger)';this.style.color='white'" onmouseout="this.style.background='var(--bg-tertiary)';this.style.color='var(--text-secondary)'">✕</button>
        </div>

        <!-- Body -->
        <div class="modal-body" style="padding:24px;overflow-y:auto;flex:1;">

          <!-- معلومات التوريد الأصلي -->
          <div style="background:var(--bg-tertiary);border:1px solid var(--border);border-radius:12px;padding:16px;margin-bottom:20px;">
            <div style="display:flex;align-items:center;gap:10px;margin-bottom:14px;padding-bottom:10px;border-bottom:1px solid var(--border);">
              <span style="font-size:18px;">📦</span>
              <span style="font-weight:600;color:var(--text-primary);">معلومات التوريد الأصلي</span>
            </div>
            <div style="display:grid;grid-template-columns:1fr 1fr;gap:14px;">
              <div style="background:var(--bg-secondary);padding:12px;border-radius:8px;">
                <div style="font-size:11px;color:var(--text-secondary);margin-bottom:4px;">الإكسسوار</div>
                <div style="font-weight:600;color:var(--text-primary);font-size:14px;">${data.accessoryName}</div>
              </div>
              <div style="background:var(--bg-secondary);padding:12px;border-radius:8px;">
                <div style="font-size:11px;color:var(--text-secondary);margin-bottom:4px;">المورد</div>
                <div style="font-weight:600;color:var(--text-primary);font-size:14px;">${data.supplierName}</div>
              </div>
              <div style="background:var(--bg-secondary);padding:12px;border-radius:8px;">
                <div style="font-size:11px;color:var(--text-secondary);margin-bottom:4px;">الكمية المشتراة</div>
                <div style="font-weight:700;color:var(--info);font-size:16px;">${data.maxQuantity} <span style="font-size:12px;font-weight:400;">قطعة</span></div>
              </div>
              <div style="background:var(--bg-secondary);padding:12px;border-radius:8px;">
                <div style="font-size:11px;color:var(--text-secondary);margin-bottom:4px;">سعر الوحدة</div>
                <div style="font-weight:700;color:var(--success);font-size:16px;">${fmt(data.unitPrice)} <span style="font-size:12px;font-weight:400;">ج.م</span></div>
              </div>
            </div>
          </div>

          <!-- الكمية المرتجعة -->
          <div style="background:var(--bg-tertiary);border:1px solid var(--border);border-radius:12px;padding:16px;margin-bottom:20px;">
            <div style="display:flex;align-items:center;gap:10px;margin-bottom:14px;padding-bottom:10px;border-bottom:1px solid var(--border);">
              <span style="font-size:18px;">🔢</span>
              <span style="font-weight:600;color:var(--text-primary);">الكمية المرتجعة</span>
            </div>

            <div style="display:flex;align-items:center;gap:16px;margin-bottom:16px;">
              <div style="flex:1;">
                <label style="display:block;font-size:12px;color:var(--text-secondary);margin-bottom:6px;">كم قطعة تريد إرجاعها؟</label>
                <div style="display:flex;align-items:center;gap:8px;">
                  <button onclick="adjustReturnQty(-1)" style="width:40px;height:40px;background:var(--bg-secondary);border:1px solid var(--border);border-radius:8px;font-size:20px;cursor:pointer;color:var(--text-primary);transition:all 0.2s;" onmouseover="this.style.background='var(--danger)';this.style.color='white'" onmouseout="this.style.background='var(--bg-secondary)';this.style.color='var(--text-primary)'">−</button>
                  <input type="number" id="returnQtyInput" value="${data.maxQuantity}" min="1" max="${data.maxQuantity}"
                    style="flex:1;text-align:center;padding:12px;background:var(--bg-secondary);border:2px solid var(--accent);border-radius:8px;color:var(--text-primary);font-size:18px;font-weight:700;"
                    onchange="validateAndUpdateReturnQty()" oninput="validateAndUpdateReturnQty()">
                  <button onclick="adjustReturnQty(1)" style="width:40px;height:40px;background:var(--bg-secondary);border:1px solid var(--border);border-radius:8px;font-size:20px;cursor:pointer;color:var(--text-primary);transition:all 0.2s;" onmouseover="this.style.background='var(--success)';this.style.color='white'" onmouseout="this.style.background='var(--bg-secondary)';this.style.color='var(--text-primary)'">+</button>
                </div>
                <div id="qtyValidationMsg" style="font-size:11px;color:var(--text-secondary);margin-top:6px;text-align:center;">
                  الحد الأقصى: ${data.maxQuantity} قطعة
                </div>
              </div>

              <div style="text-align:center;padding:16px 24px;background:linear-gradient(135deg, rgba(239,68,68,0.1) 0%, rgba(239,68,68,0.05) 100%);border:1px solid rgba(239,68,68,0.3);border-radius:12px;">
                <div style="font-size:11px;color:var(--text-secondary);margin-bottom:4px;">قيمة المرتجع</div>
                <div id="returnTotalValue" style="font-size:24px;font-weight:700;color:var(--danger);">${fmt(data.totalPrice)}</div>
                <div style="font-size:12px;color:var(--text-secondary);">ج.م</div>
              </div>
            </div>
          </div>

          <!-- قسم رصيد المورد والتسوية -->
          <div id="settlementSection" style="background:var(--bg-tertiary);border:1px solid var(--border);border-radius:12px;padding:16px;margin-bottom:20px;">
            <div style="display:flex;align-items:center;gap:10px;margin-bottom:14px;padding-bottom:10px;border-bottom:1px solid var(--border);">
              <span style="font-size:18px;">💰</span>
              <span style="font-weight:600;color:var(--text-primary);">رصيد المورد والتسوية</span>
            </div>

            <!-- معلومات الرصيد -->
            <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:12px;margin-bottom:16px;">
              <div style="text-align:center;padding:12px;background:var(--bg-secondary);border-radius:8px;">
                <div style="font-size:11px;color:var(--text-secondary);margin-bottom:4px;">رصيد المورد الحالي</div>
                <div style="font-weight:700;color:${data.supplierBalance > 0 ? 'var(--danger)' : data.supplierBalance < 0 ? 'var(--success)' : 'var(--text-secondary)'};">${fmt(data.supplierBalance)} ج.م</div>
                <div style="font-size:10px;color:var(--text-secondary);margin-top:2px;">${data.supplierBalance > 0 ? '(مدين لك)' : data.supplierBalance < 0 ? '(دائن له)' : '(لا يوجد رصيد)'}</div>
              </div>
              <div style="text-align:center;padding:12px;background:var(--bg-secondary);border-radius:8px;">
                <div style="font-size:11px;color:var(--text-secondary);margin-bottom:4px;">قيمة المرتجع</div>
                <div id="settlementReturnValue" style="font-weight:700;color:var(--warning);">${fmt(data.totalPrice)} ج.م</div>
              </div>
              <div style="text-align:center;padding:12px;background:var(--bg-secondary);border-radius:8px;">
                <div style="font-size:11px;color:var(--text-secondary);margin-bottom:4px;">الفرق</div>
                <div id="settlementDifference" style="font-weight:700;color:var(--success);">0 ج.م</div>
                <div id="differenceLabel" style="font-size:10px;color:var(--text-secondary);margin-top:2px;"></div>
              </div>
            </div>

            <!-- تنبيه التسوية -->
            <div id="settlementAlert" style="display:none;background:linear-gradient(135deg, rgba(245,158,11,0.15) 0%, rgba(245,158,11,0.05) 100%);border:1px solid rgba(245,158,11,0.4);border-radius:8px;padding:12px;margin-bottom:16px;">
              <div style="display:flex;align-items:center;gap:10px;">
                <span style="font-size:20px;">⚠️</span>
                <div>
                  <div style="font-weight:600;color:var(--warning);font-size:13px;">قيمة المرتجع أكبر من رصيد المورد</div>
                  <div style="font-size:12px;color:var(--text-secondary);margin-top:2px;">المورد لازم يدفع الفرق أو يبقى كرصيد دائن عليه</div>
                </div>
              </div>
            </div>

            <!-- خيارات التسوية -->
            <div id="settlementOptions" style="display:none;">
              <div style="font-size:13px;color:var(--text-secondary);margin-bottom:10px;font-weight:500;">كيف تريد التعامل مع الفرق؟</div>
              <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;">
                <label style="display:flex;align-items:center;gap:10px;padding:12px;background:var(--bg-secondary);border:2px solid var(--border);border-radius:8px;cursor:pointer;transition:all 0.2s;" onclick="this.querySelector('input').checked=true;highlightSettlementOption(this)">
                  <input type="radio" name="settlementOption" value="refund_cash" checked style="accent-color:var(--success);">
                  <div>
                    <div style="font-weight:600;font-size:13px;">💵 استرداد نقدي</div>
                    <div style="font-size:11px;color:var(--text-secondary);">إضافة للكاش السائل</div>
                  </div>
                </label>
                <label style="display:flex;align-items:center;gap:10px;padding:12px;background:var(--bg-secondary);border:2px solid var(--border);border-radius:8px;cursor:pointer;transition:all 0.2s;" onclick="this.querySelector('input').checked=true;highlightSettlementOption(this);updateAccessorySettlementWalletsList();">
                  <input type="radio" name="settlementOption" value="refund_wallet" onchange="updateAccessorySettlementWalletsList()" style="accent-color:var(--success);">
                  <div>
                    <div style="font-weight:600;font-size:13px;">📱 محفظة إلكترونية</div>
                    <div style="font-size:11px;color:var(--text-secondary);">إضافة للمحفظة</div>
                  </div>
                </label>
                <label style="display:flex;align-items:center;gap:10px;padding:12px;background:var(--bg-secondary);border:2px solid var(--border);border-radius:8px;cursor:pointer;transition:all 0.2s;" onclick="this.querySelector('input').checked=true;highlightSettlementOption(this);updateAccessorySettlementWalletsList();">
                  <input type="radio" name="settlementOption" value="refund_bank" onchange="updateAccessorySettlementWalletsList()" style="accent-color:var(--success);">
                  <div>
                    <div style="font-weight:600;font-size:13px;">🏦 تحويل بنكي</div>
                    <div style="font-size:11px;color:var(--text-secondary);">إضافة للبنك</div>
                  </div>
                </label>
                <!-- ✅ Dropdown للمحافظ المحددة للتسوية -->
                <div id="settlementWalletSelectGroup" style="margin-top: 8px; display: none; margin-right: 24px;">
                  <label style="font-size: 13px; color: var(--text-secondary); display: block; margin-bottom: 6px;">اختر المحفظة المحددة</label>
                  <select id="settlementWalletSelect" style="width: 100%; padding: 10px; background: var(--bg-secondary); border: 1px solid var(--border); border-radius: 8px; color: var(--text-primary); font-size: 14px;">
                    <option value="">-- اختر المحفظة --</option>
                  </select>
                </div>
                <label style="display:flex;align-items:center;gap:10px;padding:12px;background:var(--bg-secondary);border:2px solid var(--border);border-radius:8px;cursor:pointer;transition:all 0.2s;" onclick="this.querySelector('input').checked=true;highlightSettlementOption(this)">
                  <input type="radio" name="settlementOption" value="keep_credit" style="accent-color:var(--success);">
                  <div>
                    <div style="font-weight:600;font-size:13px;">📋 رصيد دائن</div>
                    <div style="font-size:11px;color:var(--text-secondary);">يُخصم من فاتورة قادمة</div>
                  </div>
                </label>
              </div>
            </div>

            <!-- رسالة الرصيد كافٍ -->
            <div id="balanceSufficientMsg" style="display:none;background:rgba(16,185,129,0.1);border:1px solid rgba(16,185,129,0.3);border-radius:8px;padding:12px;">
              <div style="display:flex;align-items:center;gap:10px;">
                <span style="font-size:20px;">✅</span>
                <div>
                  <div style="font-weight:600;color:var(--success);font-size:13px;">رصيد المورد كافٍ</div>
                  <div id="balanceSufficientText" style="font-size:12px;color:var(--text-secondary);margin-top:2px;"></div>
                </div>
              </div>
            </div>
          </div>

          <!-- سبب الإرجاع -->
          <div style="background:var(--bg-tertiary);border:1px solid var(--border);border-radius:12px;padding:16px;margin-bottom:20px;">
            <div style="display:flex;align-items:center;gap:10px;margin-bottom:14px;padding-bottom:10px;border-bottom:1px solid var(--border);">
              <span style="font-size:18px;">📝</span>
              <span style="font-weight:600;color:var(--text-primary);">سبب الإرجاع</span>
            </div>
            <select id="returnReasonSelect" style="width:100%;padding:12px;background:var(--bg-secondary);border:1px solid var(--border);border-radius:8px;color:var(--text-primary);font-size:14px;cursor:pointer;">
              <option value="عيب مصنعي">عيب مصنعي</option>
              <option value="مواصفات غير مطابقة">مواصفات غير مطابقة</option>
              <option value="تلف أثناء الشحن">تلف أثناء الشحن</option>
              <option value="خطأ في الطلب">خطأ في الطلب</option>
              <option value="منتج منتهي الصلاحية">منتج منتهي الصلاحية</option>
              <option value="كمية زائدة">كمية زائدة</option>
              <option value="اتفاق مع المورد">اتفاق مع المورد</option>
              <option value="سبب آخر">سبب آخر</option>
            </select>
            <textarea id="returnNotes" placeholder="ملاحظات إضافية (اختياري)..." rows="2"
              style="width:100%;margin-top:12px;padding:12px;background:var(--bg-secondary);border:1px solid var(--border);border-radius:8px;color:var(--text-primary);font-size:13px;resize:vertical;"></textarea>
          </div>

          <!-- ملخص العملية -->
          <div id="returnSummary" style="background:linear-gradient(135deg, rgba(139,92,246,0.1) 0%, rgba(139,92,246,0.05) 100%);border:1px solid rgba(139,92,246,0.3);border-radius:12px;padding:16px;">
            <div style="display:flex;align-items:center;gap:10px;margin-bottom:12px;">
              <span style="font-size:18px;">📋</span>
              <span style="font-weight:600;color:var(--accent);">ملخص العملية</span>
            </div>
            <div id="summaryContent" style="font-size:13px;color:var(--text-secondary);line-height:1.8;"></div>
          </div>

        </div>

        <!-- Footer -->
        <div class="modal-footer" style="display:flex;gap:12px;justify-content:space-between;align-items:center;padding:16px 24px;border-top:1px solid var(--border);background:var(--bg-tertiary);">
          <div id="returnErrorMsg" style="color:var(--danger);font-size:13px;font-weight:500;"></div>
          <div style="display:flex;gap:12px;">
            <button onclick="closeAccessoryReturnModal()" style="padding:12px 24px;background:var(--bg-secondary);color:var(--text-secondary);border:1px solid var(--border);border-radius:8px;cursor:pointer;font-weight:600;transition:all 0.2s;">إلغاء</button>
            <button id="confirmReturnBtn" onclick="executeAccessoryReturn()" style="padding:12px 28px;background:linear-gradient(135deg, var(--danger) 0%, #dc2626 100%);color:white;border:none;border-radius:8px;cursor:pointer;font-weight:600;display:flex;align-items:center;gap:8px;transition:all 0.2s;">
              <span>↩️</span>
              <span>تأكيد الإرجاع</span>
            </button>
          </div>
        </div>

      </div>
    </div>
  `;
}

// تعديل الكمية بالأزرار
function adjustReturnQty(delta) {
  if (!currentReturnData) return;

  const input = document.getElementById('returnQtyInput');
  let newValue = (parseInt(input.value) || 0) + delta;

  // التحقق من الحدود
  newValue = Math.max(1, Math.min(newValue, currentReturnData.maxQuantity));

  input.value = newValue;
  updateReturnCalculations();
}
window.adjustReturnQty = adjustReturnQty;

// التحقق من الكمية المدخلة
function validateAndUpdateReturnQty() {
  if (!currentReturnData) return;

  const input = document.getElementById('returnQtyInput');
  const msgEl = document.getElementById('qtyValidationMsg');
  const errorEl = document.getElementById('returnErrorMsg');
  let value = parseInt(input.value) || 0;

  // التحقق من الحدود
  if (value < 1) {
    value = 1;
    input.value = 1;
    msgEl.innerHTML = `<span style="color:var(--danger);">⚠️ الحد الأدنى: 1 قطعة</span>`;
    errorEl.textContent = '';
  } else if (value > currentReturnData.maxQuantity) {
    value = currentReturnData.maxQuantity;
    input.value = currentReturnData.maxQuantity;
    msgEl.innerHTML = `<span style="color:var(--danger);">⚠️ لا يمكن إرجاع أكثر من ${currentReturnData.maxQuantity} قطعة (الكمية المشتراة)</span>`;
    errorEl.textContent = `الكمية المطلوبة أكبر من الكمية المشتراة!`;
    setTimeout(() => { errorEl.textContent = ''; }, 3000);
  } else {
    msgEl.innerHTML = `الحد الأقصى: ${currentReturnData.maxQuantity} قطعة`;
    errorEl.textContent = '';
  }

  updateReturnCalculations();
}
window.validateAndUpdateReturnQty = validateAndUpdateReturnQty;

// تحديث جميع الحسابات
function updateReturnCalculations() {
  if (!currentReturnData) return;

  const qty = parseInt(document.getElementById('returnQtyInput').value) || 0;
  const returnValue = qty * currentReturnData.unitPrice;
  const supplierBalance = currentReturnData.supplierBalance;

  // تحديث قيمة المرتجع
  document.getElementById('returnTotalValue').textContent = fmt(returnValue);
  document.getElementById('settlementReturnValue').textContent = fmt(returnValue) + ' ج.م';

  // حساب الفرق وتحديد حالة التسوية
  const needsSettlement = returnValue > supplierBalance && supplierBalance >= 0;
  const difference = needsSettlement ? returnValue - supplierBalance : (supplierBalance >= returnValue ? returnValue : returnValue);

  // تحديث عرض الفرق
  const diffEl = document.getElementById('settlementDifference');
  const diffLabelEl = document.getElementById('differenceLabel');

  if (needsSettlement) {
    // المرتجع أكبر من رصيد المورد
    const settlementAmount = returnValue - supplierBalance;
    diffEl.textContent = fmt(settlementAmount) + ' ج.م';
    diffEl.style.color = 'var(--success)';
    diffLabelEl.textContent = '(لصالحك)';

    // إظهار خيارات التسوية
    document.getElementById('settlementAlert').style.display = 'block';
    document.getElementById('settlementOptions').style.display = 'block';
    document.getElementById('balanceSufficientMsg').style.display = 'none';
  } else if (supplierBalance <= 0) {
    // رصيد المورد صفر أو سالب - كل المرتجع يحتاج تسوية
    diffEl.textContent = fmt(returnValue) + ' ج.م';
    diffEl.style.color = 'var(--success)';
    diffLabelEl.textContent = '(لصالحك)';

    document.getElementById('settlementAlert').style.display = 'block';
    document.getElementById('settlementOptions').style.display = 'block';
    document.getElementById('balanceSufficientMsg').style.display = 'none';
  } else {
    // رصيد المورد كافٍ
    diffEl.textContent = fmt(returnValue) + ' ج.م';
    diffEl.style.color = 'var(--info)';
    diffLabelEl.textContent = '(يُخصم من الرصيد)';

    document.getElementById('settlementAlert').style.display = 'none';
    document.getElementById('settlementOptions').style.display = 'none';
    document.getElementById('balanceSufficientMsg').style.display = 'block';
    document.getElementById('balanceSufficientText').textContent =
      `سيتم خصم ${fmt(returnValue)} ج.م من رصيد المورد (${fmt(supplierBalance)} ج.م)`;
  }

  // تحديث الملخص
  updateReturnSummary(qty, returnValue, needsSettlement || supplierBalance <= 0);

  // تمييز الخيار المحدد
  highlightSelectedSettlementOption();
}

// تحديث الملخص
function updateReturnSummary(qty, returnValue, needsSettlement) {
  const summaryEl = document.getElementById('summaryContent');
  const supplierBalance = currentReturnData.supplierBalance;

  let summaryHtml = `
    <div style="display:flex;justify-content:space-between;padding:4px 0;border-bottom:1px dashed var(--border);">
      <span>الكمية المرتجعة:</span>
      <span style="font-weight:600;">${qty} قطعة</span>
    </div>
    <div style="display:flex;justify-content:space-between;padding:4px 0;border-bottom:1px dashed var(--border);">
      <span>قيمة المرتجع:</span>
      <span style="font-weight:600;color:var(--danger);">${fmt(returnValue)} ج.م</span>
    </div>
  `;

  if (needsSettlement) {
    const settlementAmount = supplierBalance > 0 ? returnValue - supplierBalance : returnValue;
    const selectedOption = document.querySelector('input[name="settlementOption"]:checked')?.value || 'refund_cash';
    const optionLabels = {
      refund_cash: 'استرداد نقدي (كاش)',
      refund_wallet: 'استرداد على المحفظة',
      refund_bank: 'استرداد على البنك',
      keep_credit: 'رصيد دائن على المورد'
    };

    if (supplierBalance > 0) {
      summaryHtml += `
        <div style="display:flex;justify-content:space-between;padding:4px 0;border-bottom:1px dashed var(--border);">
          <span>خصم من رصيد المورد:</span>
          <span style="font-weight:600;">${fmt(supplierBalance)} ج.م</span>
        </div>
      `;
    }

    summaryHtml += `
      <div style="display:flex;justify-content:space-between;padding:4px 0;border-bottom:1px dashed var(--border);">
        <span>المبلغ المسترد:</span>
        <span style="font-weight:600;color:var(--success);">${fmt(settlementAmount)} ج.م</span>
      </div>
      <div style="display:flex;justify-content:space-between;padding:4px 0;">
        <span>طريقة الاسترداد:</span>
        <span style="font-weight:600;color:var(--accent);">${optionLabels[selectedOption]}</span>
      </div>
    `;
  } else {
    summaryHtml += `
      <div style="display:flex;justify-content:space-between;padding:4px 0;">
        <span>التعامل:</span>
        <span style="font-weight:600;color:var(--info);">خصم من رصيد المورد</span>
      </div>
    `;
  }

  summaryEl.innerHTML = summaryHtml;
}

// تمييز خيار التسوية
function highlightSettlementOption(element) {
  document.querySelectorAll('#settlementOptions label').forEach(label => {
    label.style.borderColor = 'var(--border)';
    label.style.background = 'var(--bg-secondary)';
  });
  element.style.borderColor = 'var(--accent)';
  element.style.background = 'rgba(139,92,246,0.1)';
  updateReturnCalculations();
}
window.highlightSettlementOption = highlightSettlementOption;

function highlightSelectedSettlementOption() {
  const selected = document.querySelector('input[name="settlementOption"]:checked');
  if (selected) {
    const label = selected.closest('label');
    if (label) highlightSettlementOption(label);
  }
}

// إغلاق المودال
function closeAccessoryReturnModal() {
  const modal = document.getElementById('accessoryReturnModal');
  if (modal) {
    modal.remove();
    document.body.style.overflow = '';
  }
  currentReturnData = null;
}
window.closeAccessoryReturnModal = closeAccessoryReturnModal;

// تنفيذ المرتجع
async function executeRepairPartReturn() {
  if (!selectedPurchaseForReturn || selectedReturnItems.length === 0) {
    showToast('خطأ: يرجى تحديد الأصناف المراد إرجاعها', 'error');
    return;
  }

  const errorEl = document.getElementById('returnErrorMsg');
  const confirmBtn = document.getElementById('confirmReturnBtn');

  // جمع البيانات من الأصناف المختارة
  const returnItems = selectedReturnItems.map(item => ({
    part_id: item.part_id,
    quantity: item.return_quantity,
    unit_cost: item.unit_cost,
    total: item.return_quantity * item.unit_cost
  }));

  const totalReturnValue = returnItems.reduce((sum, item) => sum + item.total, 0);
  const reason = document.getElementById('returnReason')?.value || 'سبب آخر';
  const notes = document.getElementById('returnNotes')?.value || '';

  // Validation
  if (returnItems.length === 0) {
    errorEl.textContent = 'يرجى تحديد صنف واحد على الأقل للإرجاع';
    return;
  }

  // تحديد خيار التسوية
  let settlementOption = null;
  let settlementWalletId = null;
  const supplierBalance = selectedPurchaseForReturn.supplier_balance || 0;
  const needsSettlement = totalReturnValue > supplierBalance && supplierBalance >= 0 || supplierBalance <= 0;

  if (needsSettlement) {
    const settlementRadio = document.querySelector('input[name="settlementOption"]:checked');
    settlementOption = settlementRadio ? settlementRadio.value : 'refund_cash';
    
    if (settlementOption === 'refund_wallet' || settlementOption === 'refund_bank') {
      const walletSelect = document.getElementById('settlementWalletSelect');
      settlementWalletId = walletSelect ? parseInt(walletSelect.value) : null;
      if (!settlementWalletId) {
        errorEl.textContent = 'يرجى اختيار المحفظة';
        return;
      }
    }
  }

  // تعطيل الزر أثناء المعالجة
  confirmBtn.disabled = true;
  confirmBtn.innerHTML = '<span>⏳</span><span>جاري المعالجة...</span>';
  errorEl.textContent = '';

  try {
    const response = await fetch(`${window.DB_API}/repair-parts-purchase-return`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        reference_type: selectedPurchaseForReturn.type, // 'invoice' or 'quick'
        reference_id: selectedPurchaseForReturn.id,
        supplier_id: selectedPurchaseForReturn.supplier_id,
        items: returnItems,
        total_refund: totalReturnValue,
        reason: reason + (notes ? ` - ${notes}` : ''),
        settlement_option: settlementOption,
        settlement_wallet_id: settlementWalletId
      })
    });

    let result;
    const responseText = await response.text();
    try {
      result = JSON.parse(responseText);
    } catch (e) {
      result = { success: false, error: responseText || 'حدث خطأ غير متوقع' };
    }

    if (result.success) {
      const totalQty = returnItems.reduce((sum, item) => sum + item.quantity, 0);
      showToast(`✅ تم إرجاع ${totalQty} قطعة بنجاح`, 'success');

      // رسالة التسوية
      if (result.settlement_refund > 0) {
        const settlementMessages = {
          refund_cash: `💵 تم استرداد ${fmt(result.settlement_refund)} ج.م نقداً للكاش السائل`,
          refund_wallet: `📱 تم استرداد ${fmt(result.settlement_refund)} ج.م على المحفظة الإلكترونية`,
          refund_bank: `🏦 تم استرداد ${fmt(result.settlement_refund)} ج.م على الحساب البنكي`,
          keep_credit: `📋 تم إضافة ${fmt(result.settlement_refund)} ج.م كرصيد دائن على المورد`
        };
        setTimeout(() => {
          showToast(settlementMessages[settlementOption] || `تم تسوية ${fmt(result.settlement_refund)} ج.م`, 'success');
        }, 600);
      }

      closeReturnModal();
      // تحديث البيانات
      await loadInitialData();
      renderAllTable();
      updateStats();
    } else {
      errorEl.textContent = result.error || 'حدث خطأ أثناء الإرجاع';
      confirmBtn.disabled = false;
      confirmBtn.innerHTML = '<span>↩️</span><span>تأكيد المرتجع</span>';
    }
  } catch (error) {
    Logger.error('[RETURN] Error:', error);
    errorEl.textContent = 'حدث خطأ في الاتصال بالخادم';
    confirmBtn.disabled = false;
    confirmBtn.innerHTML = '<span>↩️</span><span>تأكيد المرتجع</span>';
  }
}
window.executeRepairPartReturn = executeRepairPartReturn;

// ═════════════════════════════════════════════════════════════
// ↩️ RETURN MODAL FUNCTIONS - نظام المرتجع المتكامل
// ═════════════════════════════════════════════════════════════

let selectedPurchaseForReturn = null;
let selectedReturnItems = [];

function openReturnModal() {
  const modal = document.getElementById('returnModal');
  if (!modal) return;

  // إعادة ضبط الحالة
  selectedPurchaseForReturn = null;
  selectedReturnItems = [];

  // إظهار قسم البحث وإخفاء التفاصيل
  document.getElementById('returnSearchSection').style.display = 'block';
  document.getElementById('returnDetailsSection').style.display = 'none';
  document.getElementById('returnSearchInput').value = '';
  document.getElementById('confirmReturnBtn').disabled = true;

  // تحميل آخر التوريدات
  loadRecentPurchasesForReturn();

  // ✅ Force clean state then show
  modal.classList.remove('active');
  void modal.offsetHeight;
  modal.classList.add('active');
  document.body.style.overflow = 'hidden';

  setTimeout(() => {
    document.getElementById('returnSearchInput')?.focus();
  }, 100);
}
window.openReturnModal = openReturnModal;

function closeReturnModal() {
  const modal = document.getElementById('returnModal');
  if (!modal) return;
  modal.classList.remove('active');
  document.body.style.overflow = '';
  modal.style.pointerEvents = 'none';
  setTimeout(() => { modal.style.pointerEvents = ''; }, 350);
  selectedPurchaseForReturn = null;
  selectedReturnItems = [];
}
window.closeReturnModal = closeReturnModal;

async function loadRecentPurchasesForReturn() {
  const list = document.getElementById('returnPurchasesList');
  if (!list) return;

  // دمج الفواتير والتوريدات السريعة
  const combinedPurchases = [];

  // إضافة الفواتير
  allInvoices.filter(inv => inv.status !== 'cancelled' && inv.status !== 'returned').forEach(inv => {
    combinedPurchases.push({
      id: inv.id,
      type: 'invoice',
      number: inv.invoice_number,
      date: inv.created_at || inv.invoice_date,
      supplier_name: allSuppliers.find(s => s.id === inv.supplier_id)?.name || '-',
      supplier_id: inv.supplier_id,
      total: inv.total_amount,
      items_count: inv.items_count || 0
    });
  });

  // إضافة التوريدات السريعة
  // ✅ التوريدات السريعة هي التي type === 'in' وليست مرتبطة بفاتورة
  allPurchases.filter(p => {
    // التوريدات السريعة: type === 'in' وليس لها reference_type يشير إلى فاتورة
    return p.type === 'in' && !p.reference_type;
  }).forEach(p => {
    const part = allRepairParts.find(a => a.id === p.part_id);
    // ✅ جلب supplier_id من note أو من supplier_transactions
    let supplierId = p.supplier_id;
    if (!supplierId && p.note) {
      // محاولة استخراج supplier_id من note إذا كان موجوداً
      const supplierMatch = p.note.match(/supplier[_\s]*id[:\s]*(\d+)/i);
      if (supplierMatch) {
        supplierId = parseInt(supplierMatch[1]);
      }
    }
    
    combinedPurchases.push({
      id: p.id,
      type: 'quick',
      number: `QP-${p.id}`,
      date: p.created_at,
      supplier_name: allSuppliers.find(s => s.id === supplierId)?.name || '-',
      supplier_id: supplierId,
      part_name: part?.name || 'غير معروف',
      part_id: p.part_id,
      qty: p.qty || p.quantity || 0,
      unit_cost: p.unit_cost || p.unit_price || 0,
      total: (p.qty || p.quantity || 0) * (p.unit_cost || p.unit_price || 0)
    });
  });

  // ترتيب حسب التاريخ (الأحدث أولاً)
  combinedPurchases.sort((a, b) => new Date(b.date) - new Date(a.date));

  renderReturnPurchasesList(combinedPurchases.slice(0, 20)); // عرض آخر 20 فقط
}

function searchPurchasesForReturn(query) {
  const q = query.trim().toLowerCase();

  if (!q) {
    loadRecentPurchasesForReturn();
    return;
  }

  const results = [];

  // بحث في الفواتير
  allInvoices.filter(inv =>
    inv.status !== 'cancelled' && inv.status !== 'returned' &&
    ((inv.invoice_number || '').toLowerCase().includes(q) ||
     (allSuppliers.find(s => s.id === inv.supplier_id)?.name || '').toLowerCase().includes(q))
  ).forEach(inv => {
    results.push({
      id: inv.id,
      type: 'invoice',
      number: inv.invoice_number,
      date: inv.created_at || inv.invoice_date,
      supplier_name: allSuppliers.find(s => s.id === inv.supplier_id)?.name || '-',
      supplier_id: inv.supplier_id,
      total: inv.total_amount,
      items_count: inv.items_count || 0
    });
  });

  // بحث في التوريدات السريعة
  // ✅ التوريدات السريعة هي التي type === 'in' وليست مرتبطة بفاتورة
  allPurchases.filter(p => {
    // التوريدات السريعة: type === 'in' وليس لها reference_type يشير إلى فاتورة
    if (p.type !== 'in' || p.reference_type) return false;
    const part = allRepairParts.find(a => a.id === p.part_id);
    let supplierId = p.supplier_id;
    if (!supplierId && p.note) {
      const supplierMatch = p.note.match(/supplier[_\s]*id[:\s]*(\d+)/i);
      if (supplierMatch) {
        supplierId = parseInt(supplierMatch[1]);
      }
    }
    const sup = allSuppliers.find(s => s.id === supplierId);
    return (part?.name || '').toLowerCase().includes(q) ||
           (sup?.name || '').toLowerCase().includes(q) ||
           String(p.id).includes(q);
  }).forEach(p => {
    const part = allRepairParts.find(a => a.id === p.part_id);
    results.push({
      id: p.id,
      type: 'quick',
      number: `QP-${p.id}`,
      date: p.created_at,
      supplier_name: allSuppliers.find(s => s.id === p.supplier_id)?.name || '-',
      supplier_id: p.supplier_id,
      part_name: part?.name || 'غير معروف',
      part_id: p.part_id,
      qty: p.qty || p.quantity,
      unit_cost: p.unit_cost || p.unit_price,
      total: (p.qty || p.quantity) * (p.unit_cost || p.unit_price)
    });
  });

  results.sort((a, b) => new Date(b.date) - new Date(a.date));
  renderReturnPurchasesList(results);
}
window.searchPurchasesForReturn = searchPurchasesForReturn;

function renderReturnPurchasesList(purchases) {
  const list = document.getElementById('returnPurchasesList');
  if (!list) return;

  if (!purchases.length) {
    list.innerHTML = `
      <div class="empty-state" style="padding: 40px; text-align: center; color: var(--text-secondary);">
        <div style="font-size: 48px; margin-bottom: 12px;">🔍</div>
        <div class="arabic-text">لا توجد نتائج</div>
      </div>
    `;
    return;
  }

  list.innerHTML = purchases.map(p => {
    const date = new Date(p.date);
    const dateStr = date.toLocaleDateString('ar-EG', { year: 'numeric', month: 'short', day: 'numeric' });
    const isInvoice = p.type === 'invoice';

    return `
      <div class="return-purchase-item" onclick="selectPurchaseForReturn('${p.type}', ${p.id})">
        <div class="purchase-info">
          <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 4px;">
            <span style="font-weight: 600; color: var(--text-primary);">
              ${isInvoice ? '📄' : '⚡'} ${p.number}
            </span>
            <span class="purchase-type ${isInvoice ? 'type-invoice' : 'type-quick'}">
              ${isInvoice ? 'فاتورة' : 'توريد سريع'}
            </span>
          </div>
          <div class="purchase-date">
            ${dateStr} • ${p.supplier_name}
            ${!isInvoice ? ` • ${p.part_name || 'غير معروف'}` : ''}
            ${isInvoice ? ` • ${p.items_count} صنف` : ` • ${p.quantity} قطعة`}
          </div>
        </div>
        <div class="purchase-amount">${fmt(p.total)} ج.م</div>
      </div>
    `;
  }).join('');
}

async function selectPurchaseForReturn(type, id) {
  selectedReturnItems = [];

  // أولاً: جلب المرتجعات السابقة لحساب الكمية المتبقية
  let previousReturns = [];
  try {
    // ✅ استخدام endpoint قطع الصيانة
    const returnsResponse = await fetch('elos-db://repair-parts-purchase-returns');
    const returnsResult = await returnsResponse.json();
    previousReturns = returnsResult.success ? (returnsResult.data || []) : (Array.isArray(returnsResult) ? returnsResult : []);
    Logger.log('[RETURN] Previous returns loaded:', previousReturns.length);
  } catch (err) {
    Logger.error('[RETURN] Error loading previous returns:', err);
  }

  if (type === 'invoice') {
    // جلب تفاصيل الفاتورة
    try {
      const response = await fetch(`elos-db://purchase-invoices/${id}`);
      if (!response.ok) throw new Error('فشل جلب الفاتورة');

      const data = await response.json();

      // حساب الكمية المرتجعة سابقاً لكل قطعة في هذه الفاتورة
      const getReturnedQty = (partId) => {
        return previousReturns
          .filter(r => r.reference_id == id && r.part_id == partId)
          .reduce((sum, r) => sum + Math.abs(r.qty || r.quantity || 0), 0);
      };

      const items = (data.items || []).map(item => {
        const part = allRepairParts.find(a => a.id === item.part_id);
        const returnedQty = getReturnedQty(item.part_id);
        const remainingQty = Math.max(0, (item.qty || item.quantity) - returnedQty);

        return {
          id: item.id,
          part_id: item.part_id,
          part_name: part?.name || 'غير معروف',
          qty: remainingQty,
          max_quantity: remainingQty,
          original_quantity: item.qty || item.quantity,
          returned_quantity: returnedQty,
          unit_cost: item.unit_cost || item.unit_price,
          total: remainingQty * (item.unit_cost || item.unit_price)
        };
      }).filter(item => item.max_quantity > 0);

      if (items.length === 0) {
        showToast('⚠️ تم إرجاع جميع أصناف هذه الفاتورة مسبقاً', 'warning');
        return;
      }

      selectedPurchaseForReturn = {
        type: 'invoice',
        id: data.invoice.id,
        number: data.invoice.invoice_number,
        date: data.invoice.created_at || data.invoice.invoice_date,
        supplier_id: data.invoice.supplier_id,
        supplier_name: allSuppliers.find(s => s.id === data.invoice.supplier_id)?.name || '-',
        total: data.invoice.total_amount,
        paid_amount: data.invoice.paid_amount || 0,
        items: items
      };
    } catch (error) {
      Logger.error('Error loading invoice:', error);
      showToast('فشل تحميل تفاصيل الفاتورة', 'error');
      return;
    }
  } else {
    // توريد سريع
    const purchase = allPurchases.find(p => p.id === id);
    if (!purchase) {
      showToast('التوريد غير موجود', 'error');
      return;
    }

    // حساب الكمية المرتجعة سابقاً لهذا التوريد السريع
    const returnedQty = previousReturns
      .filter(r => r.reference_id == id && r.part_id == purchase.part_id)
      .reduce((sum, r) => sum + Math.abs(r.qty || r.quantity || 0), 0);

    const remainingQty = Math.max(0, (purchase.qty || purchase.quantity || 0) - returnedQty);

    if (remainingQty === 0) {
      showToast('⚠️ تم إرجاع هذا التوريد بالكامل مسبقاً', 'warning');
      return;
    }

    const part = allRepairParts.find(a => a.id === purchase.part_id);
    const supplierId = purchase.supplier_id || null;
    const totalPrice = (purchase.qty || purchase.quantity || 0) * (purchase.unit_cost || purchase.unit_price || 0);
    
    selectedPurchaseForReturn = {
      type: 'quick',
      id: purchase.id,
      number: `QP-${purchase.id}`,
      date: purchase.created_at,
      supplier_id: supplierId,
      supplier_name: allSuppliers.find(s => s.id === supplierId)?.name || '-',
      total: totalPrice,
      paid_amount: 0, // TODO: جلب من safe_transactions إذا لزم الأمر
      items: [{
        id: purchase.id,
        part_id: purchase.part_id,
        part_name: part?.name || 'غير معروف',
        qty: remainingQty,
        max_quantity: remainingQty,
        original_quantity: purchase.qty || purchase.quantity || 0,
        returned_quantity: returnedQty,
        unit_cost: purchase.unit_cost || purchase.unit_price || 0,
        total: remainingQty * (purchase.unit_cost || purchase.unit_price || 0)
      }]
    };
  }

  // إظهار التفاصيل
  showReturnDetails();
}
window.selectPurchaseForReturn = selectPurchaseForReturn;

function showReturnDetails() {
  document.getElementById('returnSearchSection').style.display = 'none';
  document.getElementById('returnDetailsSection').style.display = 'block';

  // معلومات التوريد
  const infoHtml = `
    <div class="info-row">
      <span class="arabic-text">رقم التوريد:</span>
      <span style="font-weight: 600;">${selectedPurchaseForReturn.number}</span>
    </div>
    <div class="info-row">
      <span class="arabic-text">النوع:</span>
      <span>${selectedPurchaseForReturn.type === 'invoice' ? '📄 فاتورة توريد' : '⚡ توريد سريع'}</span>
    </div>
    <div class="info-row">
      <span class="arabic-text">التاريخ:</span>
      <span>${new Date(selectedPurchaseForReturn.date).toLocaleDateString('ar-EG')}</span>
    </div>
    <div class="info-row">
      <span class="arabic-text">المورد:</span>
      <span>${selectedPurchaseForReturn.supplier_name}</span>
    </div>
    <div class="info-row">
      <span class="arabic-text">الإجمالي:</span>
      <span style="font-weight: 700; color: var(--accent);">${fmt(selectedPurchaseForReturn.total)} ج.م</span>
    </div>
  `;
  document.getElementById('returnPurchaseInfo').innerHTML = infoHtml;

  // قائمة الأصناف
  const itemsHtml = selectedPurchaseForReturn.items.map((item, index) => {
    const hasReturned = item.returned_quantity > 0;
    const qtyInfo = hasReturned
      ? `<span style="color:var(--warning);font-size:11px;">أصلي: ${item.original_quantity} | مرتجع: ${item.returned_quantity} | متبقي: ${item.max_quantity}</span>`
      : `<span style="color:var(--text-secondary);font-size:11px;">الكمية المتاحة: ${item.max_quantity}</span>`;

    return `
    <div class="return-item" id="returnItem-${index}">
      <input type="checkbox" id="returnItemCheck-${index}" onchange="toggleReturnItemSelection(${index})">
      <div class="item-info">
        <div class="item-name">${item.part_name || item.accessory_name || 'غير معروف'}</div>
        <div class="item-details">سعر الوحدة: ${fmt(item.unit_cost || item.unit_price)} ج.م</div>
        <div class="item-details">${qtyInfo}</div>
      </div>
      <input type="number" class="item-quantity" id="returnItemQty-${index}"
             value="${item.qty || item.quantity}" min="1" max="${item.max_quantity}"
             onchange="updateReturnItemQuantity(${index}, this.value)"
             title="الحد الأقصى: ${item.max_quantity}">
      <div class="item-total" id="returnItemTotal-${index}">${fmt(item.total)} ج.م</div>
    </div>
  `;
  }).join('');

  document.getElementById('returnItemsList').innerHTML = itemsHtml;
  document.getElementById('selectAllReturnItems').checked = false;

  updateReturnSummaryDisplay();
}

function backToReturnList() {
  document.getElementById('returnSearchSection').style.display = 'block';
  document.getElementById('returnDetailsSection').style.display = 'none';
  selectedPurchaseForReturn = null;
  selectedReturnItems = [];
  document.getElementById('confirmReturnBtn').disabled = true;
}
window.backToReturnList = backToReturnList;

function toggleReturnItemSelection(index) {
  const checkbox = document.getElementById(`returnItemCheck-${index}`);
  const itemEl = document.getElementById(`returnItem-${index}`);
  const item = selectedPurchaseForReturn.items[index];

  if (checkbox.checked) {
    itemEl.classList.add('selected');
    const qty = parseInt(document.getElementById(`returnItemQty-${index}`).value) || item.quantity;
    selectedReturnItems.push({
      index,
      item_id: item.id,
      part_id: item.part_id,
      part_name: item.part_name,
      return_quantity: qty,
      max_quantity: item.max_quantity,
      unit_cost: item.unit_cost,
      total: qty * item.unit_cost
    });
  } else {
    itemEl.classList.remove('selected');
    selectedReturnItems = selectedReturnItems.filter(i => i.index !== index);
  }

  updateReturnSummaryDisplay();
}
window.toggleReturnItemSelection = toggleReturnItemSelection;

function toggleSelectAllReturnItems(checked) {
  selectedPurchaseForReturn.items.forEach((item, index) => {
    const checkbox = document.getElementById(`returnItemCheck-${index}`);
    if (checkbox && checkbox.checked !== checked) {
      checkbox.checked = checked;
      toggleReturnItemSelection(index);
    }
  });
}
window.toggleSelectAllReturnItems = toggleSelectAllReturnItems;

function updateReturnItemQuantity(index, value) {
  const item = selectedPurchaseForReturn.items[index];
  const qty = Math.max(1, Math.min(parseInt(value) || 1, item.max_quantity));
  const total = qty * item.unit_cost;

  document.getElementById(`returnItemQty-${index}`).value = qty;
  document.getElementById(`returnItemTotal-${index}`).textContent = fmt(total) + ' ج.م';

  // تحديث في القائمة المختارة
  const selected = selectedReturnItems.find(i => i.index === index);
  if (selected) {
    selected.return_quantity = qty;
    selected.total = total;
    updateReturnSummaryDisplay();
  }
}
window.updateReturnItemQuantity = updateReturnItemQuantity;

async function updateReturnSummaryDisplay() {
  const count = selectedReturnItems.length;
  const totalQty = selectedReturnItems.reduce((sum, i) => sum + (i.return_quantity || i.quantity || 0), 0);
  const totalAmount = selectedReturnItems.reduce((sum, i) => sum + i.total, 0);

  document.getElementById('selectedItemsCount').textContent = count;
  document.getElementById('selectedItemsQuantity').textContent = totalQty;
  document.getElementById('returnTotalAmount').textContent = fmt(totalAmount) + ' ج.م';

  document.getElementById('confirmReturnBtn').disabled = count === 0;

  // التحقق من رصيد المورد لعرض خيارات التسوية
  const settlementSection = document.getElementById('balanceSettlementSection');
  const normalRefundSection = document.getElementById('normalRefundSection');

  if (settlementSection && selectedPurchaseForReturn && selectedPurchaseForReturn.supplier_id) {
    try {
      // جلب رصيد المورد الحالي
      const response = await fetch(`elos-db://suppliers?id=${selectedPurchaseForReturn.supplier_id}`);
      const result = await response.json();

      Logger.log('[RETURN] Supplier balance response:', result);

      // التعامل مع مختلف أشكال الرد
      let supplierBalance = 0;
      if (result.success && result.data && result.data.length > 0) {
        supplierBalance = parseFloat(result.data[0].balance) || 0;
      } else if (result.balance !== undefined) {
        supplierBalance = parseFloat(result.balance) || 0;
      } else if (Array.isArray(result) && result.length > 0) {
        supplierBalance = parseFloat(result[0].balance) || 0;
      }

      Logger.log('[RETURN] Supplier balance:', supplierBalance, 'Total amount:', totalAmount);

      if (true) { // دائماً نتحقق من التسوية

        // ✅ إظهار خيارات التسوية في حالتين:
        // 1. رصيد المورد = 0 أو سالب (المورد لازم يدفع)
        // 2. المرتجع أكبر من رصيد المورد الموجب
        const needsSettlement = totalAmount > 0 && (supplierBalance <= 0 || totalAmount > supplierBalance);

        if (needsSettlement) {
          // حساب الفرق اللي المورد هيدفعه
          const amountFromBalance = Math.max(0, Math.min(totalAmount, supplierBalance));
          const difference = totalAmount - amountFromBalance;

          document.getElementById('supplierCurrentBalance').textContent = fmt(supplierBalance) + ' ج.م';
          document.getElementById('returnValueDisplay').textContent = fmt(totalAmount) + ' ج.م';
          document.getElementById('differenceAmount').textContent = fmt(difference) + ' ج.م';

          settlementSection.style.display = 'block';
          if (normalRefundSection) normalRefundSection.style.display = 'none';
        } else {
          settlementSection.style.display = 'none';
          if (normalRefundSection) normalRefundSection.style.display = 'block';
        }
      }
    } catch (err) {
      Logger.error('[RETURN] Error fetching supplier balance:', err);
      settlementSection.style.display = 'none';
      if (normalRefundSection) normalRefundSection.style.display = 'block';
    }
  } else {
    if (settlementSection) settlementSection.style.display = 'none';
    if (normalRefundSection) normalRefundSection.style.display = 'block';
  }
}

// دالة تحديث خيار التسوية (للعرض فقط حالياً)
function updateSettlementOption() {
  const selected = document.querySelector('input[name="settlementOption"]:checked');
  if (selected) {
    Logger.log('[RETURN] Settlement option changed to:', selected.value);
  }
}
window.updateSettlementOption = updateSettlementOption;

// دالة إظهار/إخفاء اختيار المحفظة
function toggleWalletSelection() {
  const checkbox = document.getElementById('refundToWallet');
  const walletSection = document.getElementById('walletSelectionSection');
  if (walletSection) {
    walletSection.style.display = checkbox.checked ? 'block' : 'none';
  }
}
window.toggleWalletSelection = toggleWalletSelection;

async function confirmPurchaseReturn() {
  if (!selectedPurchaseForReturn || selectedReturnItems.length === 0) {
    showToast('يرجى اختيار أصناف للإرجاع', 'warning');
    return;
  }

  const reason = document.getElementById('returnReason').value;
  const refundToWallet = document.getElementById('refundToWallet').checked;
  const notes = document.getElementById('returnNotes').value.trim();

  // ✅ جلب نوع المحفظة المختارة والمحفظة المحددة
  let walletType = 'cash'; // default
  const walletTypeRadio = document.querySelector('input[name="refundWalletType"]:checked');
  if (walletTypeRadio) {
    walletType = walletTypeRadio.value;
  }
  
  // ✅ الحصول على المحفظة المحددة (للمحافظ الإلكترونية والحسابات البنكية)
  let walletId = null;
  if (walletType === 'mobile_wallet' || walletType === 'bank') {
    const walletSelect = document.getElementById('refundWalletSelect');
    if (walletSelect && walletSelect.value) {
      walletId = parseInt(walletSelect.value);
    }
  }

  const totalRefund = selectedReturnItems.reduce((sum, i) => sum + i.total, 0);

  // ✅ التحقق من خيار التسوية والمحفظة المحددة
  let settlementOption = null;
  let settlementWalletId = null;
  const settlementSection = document.getElementById('balanceSettlementSection');
  if (settlementSection && settlementSection.style.display !== 'none') {
    const selectedSettlement = document.querySelector('input[name="settlementOption"]:checked');
    settlementOption = selectedSettlement ? selectedSettlement.value : 'refund_cash';
    
    // ✅ الحصول على المحفظة المحددة للتسوية (للمحافظ الإلكترونية والحسابات البنكية)
    if (settlementOption === 'refund_wallet' || settlementOption === 'refund_bank') {
      const settlementWalletSelect = document.getElementById('settlementWalletSelect');
      if (settlementWalletSelect && settlementWalletSelect.value) {
        settlementWalletId = parseInt(settlementWalletSelect.value);
      }
    }
  }

  const reasonTexts = {
    defective: 'منتج معيب',
    wrong_item: 'صنف خاطئ',
    excess: 'كمية زائدة',
    quality: 'جودة غير مقبولة',
    other: 'سبب آخر'
  };

  try {
    // ✅ استخدام endpoint قطع الصيانة
    const response = await fetch('elos-db://repair-parts-purchase-return', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        reference_type: selectedPurchaseForReturn.type, // 'invoice' or 'quick'
        reference_id: selectedPurchaseForReturn.id,
        supplier_id: selectedPurchaseForReturn.supplier_id,
        items: selectedReturnItems.map(i => ({
          item_id: i.item_id,
          part_id: i.part_id,
          quantity: i.return_quantity || i.quantity,
          unit_cost: i.unit_cost,
          refund_amount: i.total
        })),
        total_refund: totalRefund,
        refund_to_wallet: refundToWallet,
        wallet_type: walletType,
        wallet_id: walletId, // ✅ المحفظة المحددة للاسترداد العادي
        settlement_option: settlementOption,
        settlement_wallet_type: (settlementOption === 'refund_wallet' || settlementOption === 'refund_bank') 
          ? (settlementOption === 'refund_wallet' ? 'mobile_wallet' : 'bank') 
          : null,
        settlement_wallet_id: settlementWalletId, // ✅ المحفظة المحددة للتسوية
        reason: reasonTexts[reason] || reason,
        notes: notes
      })
    });

    const result = await response.json();

    if (result.success) {
      showToast(`✅ تم إرجاع ${selectedReturnItems.length} صنف بنجاح • ${fmt(totalRefund)} ج.م`, 'success');

      if (result.walletRefund > 0) {
        const walletMessages = {
          cash: `💵 تم إضافة ${fmt(result.walletRefund)} ج.م للكاش السائل`,
          mobile_wallet: `📱 تم إضافة ${fmt(result.walletRefund)} ج.م للمحفظة الإلكترونية`,
          bank: `🏦 تم إضافة ${fmt(result.walletRefund)} ج.م للحساب البنكي`
        };
        showToast(walletMessages[result.walletType] || walletMessages[walletType] || `💰 تم إضافة ${fmt(result.walletRefund)} ج.م للخزنة`, 'info');
      }

      if (result.settlementRefund > 0) {
        const settlementMessages = {
          refund_cash: `💵 تم استرداد ${fmt(result.settlementRefund)} ج.م نقداً`,
          refund_wallet: `📱 تم استرداد ${fmt(result.settlementRefund)} ج.م على المحفظة`,
          refund_bank: `🏦 تم استرداد ${fmt(result.settlementRefund)} ج.م على البنك`,
          keep_credit: `📋 تم إضافة ${fmt(result.settlementRefund)} ج.م كرصيد دائن`
        };
        showToast(settlementMessages[settlementOption] || `تم تسوية ${fmt(result.settlementRefund)} ج.م`, 'success');
      }

      if (result.supplierBalanceUpdate) {
        showToast(`📝 تم تحديث رصيد المورد`, 'info');
      }

      closeReturnModal();
      await loadInitialData();
      // تحديث عداد المرتجعات
      await loadAccessoryReturnsCount();
    } else {
      showToast(result.error || 'حدث خطأ أثناء الإرجاع', 'error');
    }
  } catch (error) {
    Logger.error('[RETURN] Error:', error);
    showToast('حدث خطأ في الاتصال', 'error');
  }
}
window.confirmPurchaseReturn = confirmPurchaseReturn;

// ═════════════════════════════════════════════════════════════
// ↩️ RETURNS LOG FUNCTIONS - سجل المرتجعات
// ═════════════════════════════════════════════════════════════

let allAccessoryReturns = [];
let currentReturnsPage = 1;
const RETURNS_PER_PAGE = 20;

async function loadAccessoryReturns() {
  try {
    // ✅ استخدام endpoint قطع الصيانة
    const response = await fetch('elos-db://repair-parts-purchase-returns');
    const result = await response.json();

    if (result.success) {
      allAccessoryReturns = result.data || [];
    } else {
      allAccessoryReturns = Array.isArray(result) ? result : [];
    }

    // تحديث العداد في التاب
    const countEl = document.getElementById('returnsCount');
    if (countEl) {
      if (allAccessoryReturns.length > 0) {
        countEl.textContent = allAccessoryReturns.length;
        countEl.style.display = 'inline';
      } else {
        countEl.style.display = 'none';
      }
    }

    // تحديث البطاقة في الـ header
    const headerCountEl = document.getElementById('headerReturnsCount');
    if (headerCountEl) {
      headerCountEl.textContent = allAccessoryReturns.length;
    }

    // تحديث الإجمالي
    const totalEl = document.getElementById('returnsTotal');
    if (totalEl) {
      const total = allAccessoryReturns.reduce((sum, r) => sum + (parseFloat(r.refund_amount) || parseFloat(r.total_price) || 0), 0);
      totalEl.textContent = total > 0 ? `إجمالي: ${fmt(total)} ج.م` : '';
    }

    currentReturnsPage = 1;
    renderReturnsTable();
  } catch (error) {
    Logger.error('Error loading returns:', error);
    showToast('خطأ في تحميل المرتجعات', 'error');
  }
}

function renderReturnsTable() {
  const tbody = document.getElementById('returnsTableBody');
  if (!tbody) return;

  if (!allAccessoryReturns || allAccessoryReturns.length === 0) {
    tbody.innerHTML = `
      <tr><td colspan="8" style="text-align:center;padding:40px;">
        <div class="empty-title arabic-text">لا توجد مرتجعات</div>
        <div class="empty-text arabic-text">لم يتم تسجيل أي مرتجعات بعد</div>
      </td></tr>`;
    renderPaginationReturns(0);
    return;
  }

  // تطبيق البحث
  const searchTerm = (document.getElementById('searchReturns')?.value || '').toLowerCase().trim();
  let filtered = allAccessoryReturns;
  if (searchTerm) {
    filtered = allAccessoryReturns.filter(r => {
      const partName = (r.part_name || r.accessory_name || '').toLowerCase();
      const supplierName = (r.supplier_name || '').toLowerCase();
      const reason = (r.return_reason || r.notes || '').toLowerCase();
      return partName.includes(searchTerm) || supplierName.includes(searchTerm) || reason.includes(searchTerm);
    });
  }

  const totalPages = Math.ceil(filtered.length / RETURNS_PER_PAGE);
  const start = (currentReturnsPage - 1) * RETURNS_PER_PAGE;
  const pageData = filtered.slice(start, start + RETURNS_PER_PAGE);

  tbody.innerHTML = pageData.map((r, idx) => {
    const date = r.created_at || r.returned_at || '';
    const formattedDate = date ? new Date(date).toLocaleDateString('ar-EG', { year: 'numeric', month: 'short', day: 'numeric' }) : '-';
    const amount = parseFloat(r.refund_amount) || parseFloat(r.total_price) || 0;
    const qty = Math.abs(r.quantity) || 0;

    // تحديد نوع التسوية
    let settlementBadge = '';
    if (r.settlement_type || r.reference_type) {
      const refType = r.settlement_type || r.reference_type || '';
      if (refType.includes('settlement') || refType.includes('refund')) {
        settlementBadge = '<span class="badge success">استرداد نقدي</span>';
      } else if (refType.includes('credit')) {
        settlementBadge = '<span class="badge info">رصيد دائن</span>';
      } else {
        settlementBadge = '<span class="badge">خصم من الرصيد</span>';
      }
    } else {
      settlementBadge = '<span class="badge">خصم من الرصيد</span>';
    }

    return `<tr>
      <td>${start + idx + 1}</td>
      <td>${formattedDate}</td>
      <td style="font-weight:600;">${r.part_name || r.accessory_name || '-'}</td>
      <td>${r.supplier_name || '-'}</td>
      <td style="text-align:center;">${qty}</td>
      <td style="font-weight:700;color:var(--danger);">${fmt(amount)} ج.م</td>
      <td style="max-width:150px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;" title="${r.return_reason || r.notes || ''}">${r.return_reason || r.notes || '-'}</td>
      <td>${settlementBadge}</td>
    </tr>`;
  }).join('');

  renderPaginationReturns(totalPages);
}

function renderPaginationReturns(totalPages) {
  const container = document.getElementById('paginationReturns');
  if (!container) return;

  if (totalPages <= 1) {
    container.innerHTML = '';
    return;
  }

  let html = '<div class="pagination">';
  html += `<button onclick="changeReturnsPage(${currentReturnsPage - 1})" ${currentReturnsPage === 1 ? 'disabled' : ''}>«</button>`;

  for (let i = 1; i <= totalPages; i++) {
    if (i === 1 || i === totalPages || (i >= currentReturnsPage - 2 && i <= currentReturnsPage + 2)) {
      html += `<button onclick="changeReturnsPage(${i})" class="${i === currentReturnsPage ? 'active' : ''}">${i}</button>`;
    } else if (i === currentReturnsPage - 3 || i === currentReturnsPage + 3) {
      html += '<span>...</span>';
    }
  }

  html += `<button onclick="changeReturnsPage(${currentReturnsPage + 1})" ${currentReturnsPage === totalPages ? 'disabled' : ''}>»</button>`;
  html += '</div>';

  container.innerHTML = html;
}

function changeReturnsPage(page) {
  const totalPages = Math.ceil(allAccessoryReturns.length / RETURNS_PER_PAGE);
  if (page < 1 || page > totalPages) return;
  currentReturnsPage = page;
  renderReturnsTable();
}
window.changeReturnsPage = changeReturnsPage;

// ═════════════════════════════════════════════════════════════
// 🗑️ DELETE FUNCTIONS (حذف التوريدات والفواتير)
// ═════════════════════════════════════════════════════════════

/**
 * حذف توريد سريع لقطعة صيانة مع عكس كل العمليات المحاسبية
 */
async function deleteQuickPurchase(purchaseId) {
  const purchase = allPurchases.find(p => p.id === purchaseId);
  if (!purchase) {
    showToast('لم يتم العثور على التوريد', 'error');
    return;
  }

  const part = allRepairParts.find(a => a.id === purchase.part_id);
  const partName = part?.name || 'غير معروف';

  const confirmed = await showConfirm(
    `⚠️ تأكيد حذف التوريد السريع\n\n🔧 القطعة: ${partName}\n🔢 الكمية: ${purchase.qty}\n💰 المبلغ: ${fmt((purchase.qty || 0) * (purchase.unit_cost || 0))} ج.م\n\n❗ سيتم:\n• تقليل المخزون بـ ${purchase.qty} قطعة\n• عكس حركات الخزنة\n• تعديل رصيد المورد`,
    'حذف وعكس العمليات',
    'إلغاء',
    'danger'
  );

  if (!confirmed) return;

  try {
    const response = await fetch(`elos-db://repair-parts-movements/${purchaseId}`, {
      method: 'DELETE'
    });

    const result = await response.json();

    if (result.success) {
      showToast(`تم حذف توريد ${partName} وعكس العمليات بنجاح ✓`, 'success');
      await loadInitialData();
    } else {
      throw new Error(result.message || 'فشل حذف التوريد');
    }
  } catch (error) {
    Logger.error('[DELETE QUICK PURCHASE] Error:', error);
    showToast('فشل حذف التوريد: ' + error.message, 'error');
  }
}
window.deleteQuickPurchase = deleteQuickPurchase;

/**
 * حذف فاتورة توريد قطع صيانة مع عكس كل العمليات المحاسبية
 */
async function deleteInvoice(invoiceId) {
  const invoice = allInvoices.find(inv => inv.id === invoiceId);
  if (!invoice) {
    showToast('لم يتم العثور على الفاتورة', 'error');
    return;
  }

  const sup = allSuppliers.find(s => s.id === invoice.supplier_id);
  const supName = sup?.name || 'غير محدد';

  const confirmed = await showConfirm(
    `⚠️ تأكيد حذف الفاتورة\n\n📄 رقم الفاتورة: ${invoice.invoice_number}\n🏢 المورد: ${supName}\n📦 عدد الأصناف: ${invoice.items_count || 0}\n💰 الإجمالي: ${fmt(invoice.total_amount)} ج.م\n\n❗ سيتم:\n• تقليل المخزون لكل الأصناف\n• عكس حركات الخزنة\n• تعديل رصيد المورد`,
    'حذف وعكس العمليات',
    'إلغاء',
    'danger'
  );

  if (!confirmed) return;

  try {
    const response = await fetch(`elos-db://purchase-invoices/${invoiceId}`, {
      method: 'DELETE'
    });

    const result = await response.json();

    if (result.success) {
      showToast(`تم حذف الفاتورة ${invoice.invoice_number} وعكس العمليات بنجاح ✓`, 'success');
      await loadInitialData();
    } else {
      throw new Error(result.message || 'فشل حذف الفاتورة');
    }
  } catch (error) {
    Logger.error('[DELETE INVOICE] Error:', error);
    showToast('فشل حذف الفاتورة: ' + error.message, 'error');
  }
}
window.deleteInvoice = deleteInvoice;

// Event listener for returns search
document.addEventListener('DOMContentLoaded', () => {
  const searchReturns = document.getElementById('searchReturns');
  if (searchReturns) {
    searchReturns.addEventListener('input', () => {
      currentReturnsPage = 1;
      renderReturnsTable();
    });
  }
});

// ═════════════════════════════════════════════════════════════
// 🚀 INIT
// ═════════════════════════════════════════════════════════════
document.addEventListener('DOMContentLoaded', async () => {
  Logger.log('[INIT] Starting...');
  await loadSettings();
  await loadInitialData();
  initFilters();
  // تحميل عدد المرتجعات في الخلفية
  loadAccessoryReturnsCount();

  // ✅ Backdrop mousedown to close modals
  ['quickPurchaseModal', 'invoiceModal', 'addPartFromPurchaseModal', 'returnModal'].forEach(id => {
    document.getElementById(id)?.addEventListener('mousedown', (e) => {
      if (e.target.id === id) {
        if (id === 'quickPurchaseModal') closeQuickPurchaseModal();
        else if (id === 'invoiceModal') closeInvoiceModal();
        else if (id === 'addPartFromPurchaseModal') closeAddPartFromPurchaseModal();
        else if (id === 'returnModal') closeReturnModal();
      }
    });
  });

  Logger.log('[INIT] Ready!');
});

// تحميل عدد المرتجعات فقط للعداد
async function loadAccessoryReturnsCount() {
  try {
    // ✅ استخدام endpoint قطع الصيانة
    const response = await fetch('elos-db://repair-parts-purchase-returns');
    const result = await response.json();
    Logger.log('[RETURNS COUNT] API Response:', result);
    const returns = result.success ? (result.data || []) : (Array.isArray(result) ? result : []);
    Logger.log('[RETURNS COUNT] Parsed returns:', returns.length);

    // تحديث العداد في التاب
    const countEl = document.getElementById('returnsCount');
    if (countEl) {
      if (returns.length > 0) {
        countEl.textContent = returns.length;
        countEl.style.display = 'inline';
      } else {
        countEl.style.display = 'none';
      }
    }

    // تحديث البطاقة في الـ header
    const headerCountEl = document.getElementById('headerReturnsCount');
    if (headerCountEl) {
      headerCountEl.textContent = returns.length;
    }
  } catch (err) {
    Logger.error('[RETURNS] Error loading count:', err);
  }
}
