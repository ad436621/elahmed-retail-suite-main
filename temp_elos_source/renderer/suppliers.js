// ═══════════════════════════════════════════════════════════════
// 🚚 ELOS SUPPLIERS MANAGEMENT SYSTEM - v2.0
// ═══════════════════════════════════════════════════════════════

// Fallbacks if utils.js not loaded yet
if (!window.Logger) window.Logger = { log: () => {}, warn: () => {}, error: console.error, debug: () => {}, info: () => {} };
if (!window.fmt) window.fmt = (n, decimals = 2) => Number(n || 0).toLocaleString('en-US', { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
if (!window.escapeHtml) window.escapeHtml = (text) => { if (text === null || text === undefined) return ''; const div = document.createElement('div'); div.textContent = String(text); return div.innerHTML; };
const fmt = window.fmt;
const escapeHtml = window.escapeHtml;

let suppliers = [];
let filteredSuppliers = [];
let currentSupplierId = null;

// Sorting state
let currentSort = { field: 'id', direction: 'asc' };

// ═══════════════════════════════════════════════════════════════
// 🚀 INITIALIZATION
// ═══════════════════════════════════════════════════════════════
document.addEventListener('DOMContentLoaded', async () => {
  Logger.log('🚚 ElOs Suppliers Management System v2.0');
  
  // Setup search
  const searchInput = document.getElementById('searchInput');
  if (searchInput) {
    searchInput.addEventListener('keypress', (e) => {
      if (e.key === 'Enter') loadSuppliers();
    });
  }
  
  // Close modals on overlay click
  document.querySelectorAll('.modal-overlay').forEach(modal => {
    modal.addEventListener('click', (e) => {
      if (e.target === modal) {
        modal.classList.remove('active');
      }
    });
  });
  
  // Keyboard shortcuts
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      closeModal();
      closePaymentModal();
      closeHistoryModal();
    }
    if ((e.ctrlKey || e.metaKey) && e.key === 'n') {
      e.preventDefault();
      openAddModal();
    }
  });
  
  // Load data
  await loadSuppliers();
  await loadTodayPayments();
  
  showToast('مرحباً بك في نظام إدارة الموردين', 'success');
});

// ═══════════════════════════════════════════════════════════════
// 📋 LOAD SUPPLIERS
// ═══════════════════════════════════════════════════════════════
async function loadSuppliers() {
  try {
    const response = await fetch('elos-db://suppliers');
    if (!response.ok) throw new Error(await response.text());
    
    suppliers = await response.json();
    filteredSuppliers = [...suppliers];
    
    renderSuppliers();
    updateStats();
    
    showToast(`تم تحميل ${suppliers.length} مورد`, 'success');
  } catch (error) {
    Logger.error('Load suppliers error:', error);
    showToast('فشل تحميل الموردين: ' + error.message, 'error');
    
    document.getElementById('suppliersTableBody').innerHTML = `
      <tr>
        <td colspan="7" class="empty-state">
          <div class="empty-state-icon">❌</div>
          <div class="empty-state-text">فشل تحميل البيانات</div>
          <button class="btn btn-ghost" onclick="loadSuppliers()" style="margin-top: 10px;">
            🔄 إعادة المحاولة
          </button>
        </td>
      </tr>
    `;
  }
}

// ═══════════════════════════════════════════════════════════════
// 🔍 FILTER SUPPLIERS
// ═══════════════════════════════════════════════════════════════
function filterSuppliers() {
  const query = document.getElementById('searchInput').value.trim().toLowerCase();
  
  if (!query) {
    filteredSuppliers = [...suppliers];
  } else {
    filteredSuppliers = suppliers.filter(s => 
      (s.name || '').toLowerCase().includes(query) ||
      (s.phone || '').toLowerCase().includes(query) ||
      (s.address || '').toLowerCase().includes(query)
    );
  }
  
  renderSuppliers();
}

// ═══════════════════════════════════════════════════════════════
// 🔀 SORT TABLE
// ═══════════════════════════════════════════════════════════════
function sortTable(field) {
  if (currentSort.field === field) {
    currentSort.direction = currentSort.direction === 'asc' ? 'desc' : 'asc';
  } else {
    currentSort.field = field;
    currentSort.direction = 'asc';
  }

  // تحديث أنماط رأس الجدول
  document.querySelectorAll('th.sortable').forEach(th => {
    th.classList.remove('asc', 'desc');
    if (th.dataset.sort === field) {
      th.classList.add(currentSort.direction);
    }
  });

  renderSuppliers();

  // تشغيل صوت النقر
  if (typeof SoundFX !== 'undefined' && SoundFX.play) {
    SoundFX.play('click');
  }
}

// ═══════════════════════════════════════════════════════════════
// 🎨 RENDER SUPPLIERS
// ═══════════════════════════════════════════════════════════════
function renderSuppliers() {
  const tbody = document.getElementById('suppliersTableBody');
  const countEl = document.getElementById('suppliersCount');

  if (countEl) countEl.textContent = filteredSuppliers.length;

  // ترتيب الموردين حسب الإعدادات الحالية
  const sortedSuppliers = [...filteredSuppliers].sort((a, b) => {
    let aVal, bVal;

    switch (currentSort.field) {
      case 'id':
        aVal = a.id;
        bVal = b.id;
        break;
      case 'name':
        aVal = (a.name || '').toLowerCase();
        bVal = (b.name || '').toLowerCase();
        break;
      case 'balance':
        aVal = Number(a.balance) || 0;
        bVal = Number(b.balance) || 0;
        break;
      case 'date':
        aVal = new Date(a.last_transaction || a.updated_at || 0).getTime();
        bVal = new Date(b.last_transaction || b.updated_at || 0).getTime();
        break;
      default:
        aVal = a.id;
        bVal = b.id;
    }

    if (currentSort.direction === 'asc') {
      return aVal > bVal ? 1 : -1;
    } else {
      return aVal < bVal ? 1 : -1;
    }
  });

  if (sortedSuppliers.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="7" class="empty-state">
          <div class="empty-state-icon">🚚</div>
          <div class="empty-state-text">لا يوجد موردين</div>
          <button class="btn btn-primary" onclick="openAddModal()" style="margin-top: 10px;">
            ➕ إضافة مورد جديد
          </button>
        </td>
      </tr>
    `;
    return;
  }

  tbody.innerHTML = sortedSuppliers.map((supplier, index) => {
    const balance = Number(supplier.balance) || 0;
    const initials = getInitials(supplier.name);
    
    // تحديد نوع الرصيد
    let balanceClass, balanceText, balanceIcon;
    if (balance > 0) {
      balanceClass = 'debt';
      balanceText = `${fmt(balance)} مستحق`;
      balanceIcon = '🔴';
    } else if (balance < 0) {
      balanceClass = 'credit';
      balanceText = `${fmt(Math.abs(balance))} لصالحه`;
      balanceIcon = '🟡';
    } else {
      balanceClass = 'clear';
      balanceText = 'لا يوجد رصيد';
      balanceIcon = '🟢';
    }
    
    // آخر معاملة
    const lastTransaction = supplier.last_transaction || supplier.updated_at;
    const lastTxDate = lastTransaction ? formatDate(lastTransaction) : '-';
    
    return `
      <tr data-id="${supplier.id}">
        <td style="color: var(--text-secondary); font-weight: 600;">${index + 1}</td>
        <td>
          <div class="supplier-name">
            <div class="supplier-avatar">${initials}</div>
            <div>
              <div style="font-weight: 700;">${escapeHtml(supplier.name || '—')}</div>
              ${supplier.notes ? `<div style="font-size: 11px; color: var(--text-secondary);">${escapeHtml(truncate(supplier.notes, 30))}</div>` : ''}
            </div>
          </div>
        </td>
        <td class="phone-cell">${escapeHtml(supplier.phone || '—')}</td>
        <td class="address-cell" title="${escapeHtml(supplier.address || '')}">${escapeHtml(supplier.address || '—')}</td>
        <td>
          <span class="balance-badge ${balanceClass}">
            ${balanceIcon} ${balanceText}
          </span>
        </td>
        <td style="color: var(--text-secondary); font-size: 12px;">${lastTxDate}</td>
        <td>
          <div class="action-btns">
            <button class="action-btn history" onclick="showHistory(${supplier.id})" title="كشف حساب">
              📜 كشف حساب
            </button>
            <button class="action-btn sales-report" onclick="showSupplierSalesReport(${supplier.id})" title="كشف مبيعات">
              📊 كشف مبيعات
            </button>
            <button class="action-btn pay ${balance > 0 ? '' : 'disabled'}" onclick="${balance > 0 ? `openPaymentModal(${supplier.id})` : ''}" title="سداد" ${balance > 0 ? '' : 'disabled'}>
              💰 سداد
            </button>
            <button class="action-btn edit" onclick="editSupplier(${supplier.id})" title="تعديل">
              ✏️ تعديل
            </button>
            <button class="action-btn delete" onclick="deleteSupplier(${supplier.id})" title="حذف">
              🗑️ حذف
            </button>
          </div>
        </td>
      </tr>
    `;
  }).join('');
}

// ═══════════════════════════════════════════════════════════════
// 📊 UPDATE STATS
// ═══════════════════════════════════════════════════════════════
function updateStats() {
  const totalSuppliers = suppliers.length;
  const totalDebt = suppliers.reduce((sum, s) => {
    const balance = Number(s.balance) || 0;
    return sum + (balance > 0 ? balance : 0);
  }, 0);
  
  document.getElementById('statTotalSuppliers').textContent = totalSuppliers;
  document.getElementById('statTotalDebt').textContent = fmt(totalDebt);
}

async function loadTodayPayments() {
  try {
    const today = new Date().toISOString().slice(0, 10);
    const response = await fetch(`elos-db://supplier-payments?date=${today}`);
    
    if (response.ok) {
      const payments = await response.json();
      const totalToday = Array.isArray(payments) 
        ? payments.reduce((sum, p) => sum + (Number(p.amount) || 0), 0)
        : 0;
      document.getElementById('statPaidToday').textContent = fmt(totalToday);
    }
  } catch (e) {
    Logger.log('No payments API or error:', e);
    document.getElementById('statPaidToday').textContent = '0.00';
  }
}

// ═══════════════════════════════════════════════════════════════
// 🪟 MODAL MANAGEMENT
// ═══════════════════════════════════════════════════════════════
function openAddModal() {
  currentSupplierId = null;
  document.getElementById('supplierForm').reset();
  document.getElementById('supplierId').value = '';
  document.getElementById('supplierBalance').value = '0';
  document.getElementById('balanceGroup').style.display = 'block';
  document.getElementById('modalTitle').innerHTML = '<span>➕</span><span class="arabic-text">إضافة مورد جديد</span>';
  document.getElementById('supplierModal').classList.add('active');
  document.getElementById('supplierName').focus();
}

function closeModal() {
  document.getElementById('supplierModal').classList.remove('active');
  document.getElementById('supplierForm').reset();
  document.getElementById('balanceGroup').style.display = 'block';
  currentSupplierId = null;
}

async function openPaymentModal(supplierId) {
  const supplier = suppliers.find(s => s.id === supplierId);
  if (!supplier) {
    showToast('المورد غير موجود', 'error');
    return;
  }
  
  currentSupplierId = supplierId;
  document.getElementById('paymentSupplierId').value = supplier.id;
  document.getElementById('paymentSupplierName').value = supplier.name;
  document.getElementById('paymentCurrentBalance').value = fmt(supplier.balance) + ' ج.م';
  document.getElementById('paymentAmount').value = '';
  document.getElementById('paymentMethod').value = 'cash';
  document.getElementById('paymentNotes').value = '';
  document.getElementById('remainingAfterPayment').style.display = 'none';

  // ✅ تحميل المحافظ وتحديث القائمة
  await loadPaymentWallets();
  await updateSupplierPaymentWalletsList();

  document.getElementById('paymentModal').classList.add('active');
  document.getElementById('paymentAmount').focus();
}

let paymentWallets = []; // ✅ المحافظ الفعلية من قاعدة البيانات

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

// ✅ تحديث قائمة المحافظ حسب النوع
async function updateSupplierPaymentWalletsList() {
  const walletTypeSelect = document.getElementById('paymentMethod');
  const walletSelectGroup = document.getElementById('supplierPaymentWalletSelectGroup');
  const walletSelect = document.getElementById('supplierPaymentWalletSelect');
  
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
    updateSupplierPaymentWalletBalance();
    return;
  }
  
  // Show the select and populate options (only for mobile_wallet and bank)
  if (walletType === 'mobile_wallet' || walletType === 'bank') {
    walletSelectGroup.style.display = 'block';
    walletSelect.innerHTML = filteredWallets.map(w => {
      const isDefault = w.is_default ? ' (افتراضي)' : '';
      const displayName = w.name + isDefault;
      return `<option value="${w.id}" ${w.is_default ? 'selected' : ''}>${displayName}</option>`;
    }).join('');
  } else {
    walletSelectGroup.style.display = 'none';
  }
  
  updateSupplierPaymentWalletBalance();
}
window.updateSupplierPaymentWalletsList = updateSupplierPaymentWalletsList;

// دالة تحديث رصيد المحفظة المختارة
async function updateSupplierPaymentWalletBalance() {
  const walletType = document.getElementById('paymentMethod').value;
  const walletSelect = document.getElementById('supplierPaymentWalletSelect');
  const balanceInput = document.getElementById('paymentWalletBalance');

  try {
    const res = await fetch('elos-db://safe-balance');
    if (res.ok) {
      const data = await res.json();
      
      let balance = 0;
      
      // ✅ إذا كان هناك محفظة محددة (wallet_id)
      if (walletSelect && walletSelect.value && data.wallets && Array.isArray(data.wallets)) {
        const walletId = parseInt(walletSelect.value);
        const wallet = data.wallets.find(w => w.id == walletId);
        if (wallet) {
          balance = Number(wallet.balance || 0);
        }
      } else {
        // استخدام الرصيد المجمع حسب النوع (للتوافق العكسي)
        if (data.wallets && Array.isArray(data.wallets)) {
          data.wallets.forEach(w => {
            if (w.type === walletType) balance += Number(w.balance || 0);
          });
        } else if (data.wallets && typeof data.wallets === 'object') {
          balance = Number(data.wallets[walletType]?.balance || 0);
        }
      }
      
      balanceInput.value = fmt(balance) + ' ج.م';
      balanceInput.style.color = balance > 0 ? 'var(--success)' : 'var(--danger)';
    } else {
      balanceInput.value = 'غير متاح';
      balanceInput.style.color = 'var(--text-secondary)';
    }
  } catch (e) {
    Logger.error('[WALLET BALANCE] Error:', e);
    balanceInput.value = 'خطأ';
    balanceInput.style.color = 'var(--danger)';
  }
}
window.updateSupplierPaymentWalletBalance = updateSupplierPaymentWalletBalance;

function closePaymentModal() {
  document.getElementById('paymentModal').classList.remove('active');
  document.getElementById('paymentForm').reset();
  currentSupplierId = null;
}

function calculatePaymentRemaining() {
  const supplier = suppliers.find(s => s.id === currentSupplierId);
  if (!supplier) return;
  
  const currentBalance = Number(supplier.balance) || 0;
  const paymentAmount = Number(document.getElementById('paymentAmount').value) || 0;
  const remaining = currentBalance - paymentAmount;
  
  const remainingRow = document.getElementById('remainingAfterPayment');
  const remainingInput = document.getElementById('remainingAmount');
  
  if (paymentAmount > 0 && remaining !== currentBalance) {
    remainingRow.style.display = 'block';
    remainingInput.value = fmt(remaining) + ' ج.م';
    remainingInput.style.color = remaining > 0 ? 'var(--warning)' : 'var(--success)';
  } else {
    remainingRow.style.display = 'none';
  }
}

// متغيرات الفلتر
let historyDateFrom = null;
let historyDateTo = null;

async function showHistory(supplierId, dateFrom = null, dateTo = null) {
  const supplier = suppliers.find(s => s.id === supplierId);
  if (!supplier) {
    showToast('المورد غير موجود', 'error');
    return;
  }

  currentSupplierId = supplierId;
  document.getElementById('historyTitle').textContent = `كشف حساب: ${supplier.name}`;
  document.getElementById('historyModal').classList.add('active');

  // الافتراضي: كل المعاملات (بدون فلتر تاريخ) حتى تظهر التوريدات الجديدة مباشرة
  if (!dateFrom && !dateTo && !historyDateFrom) {
    setHistoryDateRange('all');
  }

  // استخدام التواريخ المحفوظة أو المُمررة
  const fromDate = dateFrom || historyDateFrom;
  const toDate = dateTo || historyDateTo;

  // تحديث حقول الإدخال
  if (fromDate) document.getElementById('historyDateFrom').value = fromDate;
  if (toDate) document.getElementById('historyDateTo').value = toDate;

  const historyList = document.getElementById('historyList');
  historyList.innerHTML = '<div style="text-align: center; padding: 40px; color: var(--text-secondary);">⏳ جاري التحميل...</div>';

  try {
    // بناء الـ URL مع الفلتر
    let url = `elos-db://supplier-transactions?supplier_id=${supplierId}`;
    if (fromDate) url += `&from=${fromDate}`;
    if (toDate) url += `&to=${toDate}`;

    const response = await fetch(url);
    
    if (!response.ok) throw new Error('Failed to load');
    
    const data = await response.json();
    const transactions = data.transactions || [];
    const summary = data.summary || {};
    const openingBalance = summary.opening_balance || data.supplier?.opening_balance || 0;

    // لو مفيش معاملات ومفيش رصيد افتتاحي
    if (transactions.length === 0 && openingBalance === 0) {
      historyList.innerHTML = `
        <div class="empty-state">
          <div class="empty-state-icon">📜</div>
          <div class="empty-state-text">لا توجد معاملات مسجلة</div>
        </div>
      `;
      return;
    }

    // إضافة صف الرصيد الافتتاحي إذا كان موجوداً ومش موجود في المعاملات
    const hasOpeningBalanceTx = transactions.some(tx => tx.type === 'opening_balance');
    if (openingBalance !== 0 && !hasOpeningBalanceTx) {
      transactions.unshift({
        id: 'opening_balance',
        type: 'opening_balance',
        amount: openingBalance,
        created_at: data.supplier?.created_at || new Date().toISOString(),
        notes: 'رصيد افتتاحي'
      });
    }
    
    // عرض ملخص + المعاملات
    historyList.innerHTML = `
      <!-- ملخص الحساب -->
      <div class="account-summary">
        <div class="summary-item">
          <span class="summary-label">إجمالي المشتريات</span>
          <span class="summary-value purchase">${fmt(summary.total_purchases || 0)} ج.م</span>
        </div>
        <div class="summary-item">
          <span class="summary-label">إجمالي المدفوعات</span>
          <span class="summary-value payment">${fmt(summary.total_payments || 0)} ج.م</span>
        </div>
        <div class="summary-item">
          <span class="summary-label">إجمالي المرتجعات</span>
          <span class="summary-value return">${fmt(summary.total_returns || 0)} ج.م</span>
        </div>
        <div class="summary-item highlight">
          <span class="summary-label">الرصيد الحالي</span>
          <span class="summary-value ${summary.current_balance > 0 ? 'debt' : 'clear'}">${fmt(summary.current_balance || 0)} ج.م</span>
        </div>
      </div>
      
      <!-- أزرار التصدير -->
      <div class="export-buttons">
        <button class="btn btn-ghost" onclick="exportStatementPDF(${supplierId})">
          <span>📄</span> تصدير PDF
        </button>
        <button class="btn btn-ghost" onclick="shareWhatsApp(${supplierId})">
          <span>📱</span> إرسال واتساب
        </button>
        <button class="btn btn-ghost" onclick="printStatement(${supplierId})">
          <span>🖨️</span> طباعة
        </button>
      </div>
      
      <!-- جدول المعاملات -->
      <div class="transactions-table">
        <table>
          <thead>
            <tr>
              <th>التاريخ</th>
              <th>النوع</th>
              <th>المبلغ</th>
              <th>ملاحظات</th>
            </tr>
          </thead>
          <tbody>
            ${transactions.map(tx => {
              const isPayment = tx.type === 'payment';
              const isPurchase = tx.type === 'purchase';
              const isOpening = tx.type === 'opening_balance';
              const isReturn = tx.type === 'return' || (tx.type === 'adjustment' && (tx.notes || '').includes('مرتجع'));

              let icon, typeText, amountClass, sign;
              if (isPayment) {
                icon = '💰';
                typeText = 'سداد';
                amountClass = 'payment';
                sign = '-';
              } else if (isPurchase) {
                icon = '📦';
                typeText = 'توريد';
                amountClass = 'purchase';
                sign = '+';
              } else if (isOpening) {
                icon = '📋';
                typeText = 'رصيد افتتاحي';
                amountClass = 'opening';
                sign = '+';
              } else if (isReturn) {
                icon = '↩️';
                typeText = 'مرتجع';
                amountClass = 'return';
                sign = '-';
              } else {
                icon = '📄';
                typeText = tx.type || 'معاملة';
                amountClass = 'other';
                sign = tx.amount < 0 ? '-' : '+';
              }

              return `
                <tr>
                  <td>${formatDateTime(tx.created_at)}</td>
                  <td><span class="type-badge ${amountClass}">${icon} ${typeText}</span></td>
                  <td class="amount ${amountClass}">${sign}${fmt(Math.abs(tx.amount))} ج.م</td>
                  <td class="notes">${escapeHtml(tx.notes || '-')}</td>
                </tr>
              `;
            }).join('')}
          </tbody>
        </table>
      </div>
    `;
    
  } catch (error) {
    Logger.error('History error:', error);
    historyList.innerHTML = `
      <div class="empty-state">
        <div class="empty-state-icon">📜</div>
        <div class="empty-state-text">لا توجد معاملات مسجلة حالياً</div>
      </div>
    `;
  }
}

// ═══════════════════════════════════════════════════════════════
// 📄 EXPORT STATEMENT PDF
// ═══════════════════════════════════════════════════════════════
async function exportStatementPDF(supplierId) {
  const supplier = suppliers.find(s => s.id === supplierId);
  if (!supplier) {
    showToast('المورد غير موجود', 'error');
    return;
  }

  try {
    showToast('⏳ جاري إنشاء كشف الحساب...', 'info');

    const response = await fetch(`elos-db://supplier-transactions?supplier_id=${supplierId}`);
    if (!response.ok) throw new Error('Failed to load');

    const data = await response.json();
    const transactions = data.transactions || [];
    const summary = data.summary || {};
    const openingBalance = summary.opening_balance || data.supplier?.opening_balance || 0;

    // إضافة صف الرصيد الافتتاحي إذا كان موجوداً ومش موجود في المعاملات
    const hasOpeningBalanceTx = transactions.some(tx => tx.type === 'opening_balance');
    if (openingBalance !== 0 && !hasOpeningBalanceTx) {
      transactions.unshift({
        id: 'opening_balance',
        type: 'opening_balance',
        amount: openingBalance,
        created_at: data.supplier?.created_at || new Date().toISOString(),
        notes: 'رصيد افتتاحي'
      });
    }

    // تحميل المكتبات
    await loadPDFLibraries();

    const { jsPDF } = window.jspdf;
    const pdf = new jsPDF('p', 'mm', 'a4');
    const pageWidth = pdf.internal.pageSize.getWidth();
    const pageHeight = pdf.internal.pageSize.getHeight();
    const margin = 10;
    const contentWidth = pageWidth - (margin * 2);

    // تقسيم المعاملات - 10 في كل صفحة
    const ROWS_PER_PAGE = 10;
    const totalPages = Math.max(1, Math.ceil(transactions.length / ROWS_PER_PAGE));

    for (let page = 0; page < totalPages; page++) {
      // الحصول على المعاملات الخاصة بهذه الصفحة
      const startIdx = page * ROWS_PER_PAGE;
      const pageTransactions = transactions.slice(startIdx, startIdx + ROWS_PER_PAGE);

      // إنشاء محتوى HTML لهذه الصفحة
      const printContent = generateStatementHTML(supplier, pageTransactions, summary, page + 1, totalPages, startIdx);

      // إنشاء iframe مخفي
      const iframe = document.createElement('iframe');
      iframe.style.cssText = 'position:fixed;left:-9999px;top:0;width:794px;';
      document.body.appendChild(iframe);
      iframe.contentDocument.write(printContent);
      iframe.contentDocument.close();

      // انتظار تحميل المحتوى
      await new Promise(resolve => setTimeout(resolve, 500));

      const body = iframe.contentDocument.body;

      // تحويل لـ canvas
      const canvas = await html2canvas(body, {
        scale: 2,
        useCORS: true,
        allowTaint: true,
        backgroundColor: '#ffffff',
        width: 794,
        windowWidth: 794
      });

      const imgData = canvas.toDataURL('image/jpeg', 0.95);
      const imgWidth = contentWidth;
      const imgHeight = (canvas.height * contentWidth) / canvas.width;

      // إضافة صفحة جديدة (ما عدا الأولى)
      if (page > 0) {
        pdf.addPage();
      }

      pdf.addImage(imgData, 'JPEG', margin, margin, imgWidth, imgHeight);

      // تنظيف الـ iframe
      document.body.removeChild(iframe);
    }

    // حفظ الملف
    const fileName = `كشف_حساب_${supplier.name.replace(/\s+/g, '_')}_${new Date().toISOString().slice(0,10)}.pdf`;
    pdf.save(fileName);

    showToast('✅ تم حفظ كشف الحساب بنجاح', 'success');

  } catch (error) {
    Logger.error('Export PDF error:', error);
    showToast('فشل إنشاء كشف الحساب: ' + error.message, 'error');
  }
}

// تحميل المكتبات
async function loadPDFLibraries() {
  const libs = [
    { name: 'html2canvas', url: 'libs/html2canvas.min.js', check: () => window.html2canvas },
    { name: 'jspdf', url: 'libs/jspdf.min.js', check: () => window.jspdf }
  ];
  for (const lib of libs) {
    if (!lib.check()) {
      await new Promise((resolve, reject) => {
        const script = document.createElement('script');
        script.src = lib.url;
        script.onload = resolve;
        script.onerror = reject;
        document.head.appendChild(script);
      });
    }
  }
}

function generateStatementHTML(supplier, transactions, summary, currentPage = 1, totalPages = 1, startIdx = 0) {
  const settings = JSON.parse(localStorage.getItem('appSettings') || '{}');
  const companyName = settings.companyName || 'ElOs';
  const companyLogo = settings.companyLogo || null;
  const today = new Date().toLocaleDateString('ar-EG', {
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });

  // تحديد اتجاه اللوجو
  const logoHTML = companyLogo
    ? `<img src="${companyLogo}" alt="Logo" style="width: 60px; height: 60px; object-fit: contain; border-radius: 10px;">`
    : `<div style="width: 60px; height: 60px; background: linear-gradient(135deg, #8b5cf6, #a855f7); border-radius: 10px; display: flex; align-items: center; justify-content: center; color: white; font-size: 24px; font-weight: bold;">${companyName.charAt(0)}</div>`;

  // رقم الصفحة
  const pageInfo = totalPages > 1 ? `<span style="font-size: 12px; color: #666;">صفحة ${currentPage} من ${totalPages}</span>` : '';

  return `
    <!DOCTYPE html>
    <html lang="ar" dir="rtl">
    <head>
      <meta charset="UTF-8">
      <title>كشف حساب - ${supplier.name}</title>
      <link href="https://fonts.googleapis.com/css2?family=Cairo:wght@400;600;700;800&display=swap" rel="stylesheet">
      <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body {
          font-family: 'Cairo', 'Segoe UI', Tahoma, sans-serif;
          background: white;
          color: #1a1a2e;
          padding: 30px;
          line-height: 1.6;
          direction: rtl;
        }
        .header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          border-bottom: 3px solid #8b5cf6;
          padding-bottom: 20px;
          margin-bottom: 25px;
        }
        .company-info {
          display: flex;
          align-items: center;
          gap: 15px;
        }
        .company-info h1 {
          font-size: 26px;
          color: #8b5cf6;
          font-weight: 800;
        }
        .company-info p {
          color: #666;
          font-size: 12px;
        }
        .statement-info {
          text-align: left;
        }
        .statement-info h2 {
          font-size: 18px;
          color: #333;
          margin-bottom: 5px;
        }
        .statement-info p {
          font-size: 12px;
          color: #666;
        }
        .supplier-card {
          background: linear-gradient(135deg, #f8f9fa 0%, #e9ecef 100%);
          border-radius: 12px;
          padding: 20px;
          margin-bottom: 25px;
          border-right: 5px solid #8b5cf6;
        }
        .supplier-card h3 {
          font-size: 20px;
          color: #333;
          margin-bottom: 10px;
          font-weight: 700;
        }
        .supplier-card .info-row {
          display: flex;
          gap: 40px;
          margin-top: 8px;
        }
        .supplier-card .info-item {
          display: flex;
          align-items: center;
          gap: 8px;
          font-size: 14px;
        }
        .supplier-card .info-item .label {
          color: #666;
        }
        .supplier-card .info-item .value {
          font-weight: 600;
          color: #333;
        }
        .summary-cards {
          display: flex;
          gap: 15px;
          margin-bottom: 25px;
        }
        .summary-card {
          flex: 1;
          background: white;
          border: 2px solid #eee;
          border-radius: 12px;
          padding: 18px;
          text-align: center;
        }
        .summary-card.purchase { border-top: 4px solid #ef4444; }
        .summary-card.payment { border-top: 4px solid #10b981; }
        .summary-card.balance { border-top: 4px solid #8b5cf6; }
        .summary-card .label {
          font-size: 12px;
          color: #666;
          margin-bottom: 8px;
          font-weight: 600;
        }
        .summary-card .value {
          font-size: 22px;
          font-weight: 800;
        }
        .summary-card.purchase .value { color: #ef4444; }
        .summary-card.payment .value { color: #10b981; }
        .summary-card.balance .value { color: #8b5cf6; }
        .section-title {
          font-size: 16px;
          font-weight: 700;
          color: #333;
          margin-bottom: 12px;
          display: flex;
          align-items: center;
          gap: 8px;
        }
        table {
          width: 100%;
          border-collapse: collapse;
          margin-top: 10px;
          font-size: 13px;
        }
        th {
          background: #8b5cf6;
          color: white;
          padding: 12px 15px;
          text-align: right;
          font-weight: 700;
          font-size: 12px;
        }
        th:first-child { border-radius: 0 8px 0 0; }
        th:last-child { border-radius: 8px 0 0 0; }
        td {
          padding: 12px 15px;
          border-bottom: 1px solid #eee;
        }
        tr:nth-child(even) {
          background: #f8f9fa;
        }
        .type-badge {
          display: inline-block;
          padding: 4px 12px;
          border-radius: 20px;
          font-size: 11px;
          font-weight: 700;
        }
        .type-badge.purchase { background: #fee2e2; color: #ef4444; }
        .type-badge.payment { background: #d1fae5; color: #10b981; }
        .type-badge.opening { background: linear-gradient(135deg, #818cf8, #6366f1); color: white; }
        .amount { 
          font-weight: 700; 
          font-size: 14px;
        }
        .amount.purchase { color: #ef4444; }
        .amount.payment { color: #10b981; }
        .footer {
          margin-top: 30px;
          padding-top: 15px;
          border-top: 2px solid #eee;
          text-align: center;
          color: #666;
          font-size: 11px;
        }
        .footer p { margin: 3px 0; }

        /* منع قطع الصفوف بين الصفحات */
        tr {
          page-break-inside: avoid !important;
          break-inside: avoid !important;
        }
        thead {
          display: table-header-group;
        }
        tbody tr {
          page-break-inside: avoid !important;
          break-inside: avoid !important;
        }
        .header, .supplier-card, .summary-cards {
          page-break-inside: avoid !important;
          break-inside: avoid !important;
        }
        .section-title {
          page-break-after: avoid !important;
          break-after: avoid !important;
        }
        table {
          page-break-inside: auto;
        }

        @media print {
          body { padding: 15px; }
          .no-print { display: none; }
        }
      </style>
    </head>
    <body>
      <div class="header">
        <div class="company-info">
          ${logoHTML}
          <div>
            <h1>${companyName}</h1>
            <p>نظام المحاسبة المتكامل</p>
          </div>
        </div>
        <div class="statement-info">
          <h2>📜 كشف حساب مورد</h2>
          <p>تاريخ الإصدار: ${today}</p>
          ${pageInfo}
        </div>
      </div>
      
      <div class="supplier-card">
        <h3>🚚 ${supplier.name}</h3>
        <div class="info-row">
          <div class="info-item">
            <span class="label">📞 الهاتف:</span>
            <span class="value">${supplier.phone || 'غير محدد'}</span>
          </div>
          <div class="info-item">
            <span class="label">📍 العنوان:</span>
            <span class="value">${supplier.address || 'غير محدد'}</span>
          </div>
        </div>
      </div>
      
      <div class="summary-cards">
        <div class="summary-card purchase">
          <div class="label">إجمالي التوريدات</div>
          <div class="value">${fmt(summary.total_purchases || 0)} ج.م</div>
        </div>
        <div class="summary-card payment">
          <div class="label">إجمالي المدفوعات</div>
          <div class="value">${fmt(summary.total_payments || 0)} ج.م</div>
        </div>
        <div class="summary-card balance">
          <div class="label">الرصيد المستحق</div>
          <div class="value">${fmt(summary.current_balance || 0)} ج.م</div>
        </div>
      </div>
      
      <div class="section-title">📋 تفاصيل المعاملات</div>
      <table>
        <thead>
          <tr>
            <th style="width: 40px;">#</th>
            <th style="width: 100px;">التاريخ</th>
            <th style="width: 80px;">النوع</th>
            <th style="width: 120px;">المبلغ</th>
            <th>الملاحظات</th>
          </tr>
        </thead>
        <tbody>
          ${transactions.length === 0 ? `
            <tr>
              <td colspan="5" style="text-align: center; padding: 30px; color: #999;">
                لا توجد معاملات مسجلة
              </td>
            </tr>
          ` : transactions.map((tx, i) => {
            const isPayment = tx.type === 'payment';
            const isOpening = tx.type === 'opening_balance';
            const typeText = isOpening ? 'رصيد افتتاحي' : (isPayment ? 'سداد' : 'توريد');
            const typeClass = isOpening ? 'opening' : (isPayment ? 'payment' : 'purchase');
            const dateStr = new Date(tx.created_at).toLocaleDateString('ar-EG');
            const sign = isPayment ? '-' : '+';

            return `
              <tr ${isOpening ? 'style="background: linear-gradient(135deg, #e0e7ff 0%, #c7d2fe 100%);"' : ''}>
                <td style="text-align: center; font-weight: 600; color: #999;">${startIdx + i + 1}</td>
                <td>${dateStr}</td>
                <td><span class="type-badge ${typeClass}">${typeText}</span></td>
                <td class="amount ${typeClass}" style="${isOpening ? 'font-weight: 800;' : ''}">${sign}${fmt(Math.abs(tx.amount))} ج.م</td>
                <td style="color: #666;">${tx.notes || '-'}</td>
              </tr>
            `;
          }).join('')}
        </tbody>
      </table>
      
      <div class="footer">
        <p><strong>هذا كشف حساب رسمي صادر من ${companyName}</strong></p>
        <p>تاريخ الطباعة: ${new Date().toLocaleString('ar-EG')}</p>
      </div>
    </body>
    </html>
  `;
}

// ═══════════════════════════════════════════════════════════════
// 📱 SHARE WHATSAPP
// ═══════════════════════════════════════════════════════════════
async function shareWhatsApp(supplierId) {
  const supplier = suppliers.find(s => s.id === supplierId);
  if (!supplier) {
    showToast('المورد غير موجود', 'error');
    return;
  }
  
  try {
    const response = await fetch(`elos-db://supplier-transactions?supplier_id=${supplierId}`);
    if (!response.ok) throw new Error('Failed to load');
    
    const data = await response.json();
    const summary = data.summary || {};
    const companyName = JSON.parse(localStorage.getItem('appSettings') || '{}').companyName || 'ElOs';
    
    // إنشاء نص الرسالة
    const message = `
📜 *كشف حساب*
━━━━━━━━━━━━━━━
🏢 *${companyName}*
━━━━━━━━━━━━━━━

👤 *المورد:* ${supplier.name}
📞 *الهاتف:* ${supplier.phone || '-'}

📊 *ملخص الحساب:*
┌─────────────────┐
│ 📦 التوريدات: ${fmt(summary.total_purchases || 0)} ج.م
│ 💰 المدفوعات: ${fmt(summary.total_payments || 0)} ج.م
│ ━━━━━━━━━━━━━━━
│ 💳 *المستحق: ${fmt(summary.current_balance || 0)} ج.م*
└─────────────────┘

📅 تاريخ: ${new Date().toLocaleDateString('ar-EG')}

_شكراً لتعاملكم معنا_ 🙏
    `.trim();
    
    // فتح واتساب
    const phone = supplier.phone ? supplier.phone.replace(/[^0-9]/g, '') : '';
    const whatsappUrl = phone 
      ? `https://wa.me/${phone.startsWith('0') ? '2' + phone : phone}?text=${encodeURIComponent(message)}`
      : `https://wa.me/?text=${encodeURIComponent(message)}`;
    
    window.open(whatsappUrl, '_blank');
    showToast('✅ تم فتح واتساب', 'success');
    
  } catch (error) {
    Logger.error('WhatsApp error:', error);
    showToast('فشل إرسال الرسالة', 'error');
  }
}

// ═══════════════════════════════════════════════════════════════
// 🖨️ PRINT STATEMENT
// ═══════════════════════════════════════════════════════════════
async function printStatement(supplierId) {
  const supplier = suppliers.find(s => s.id === supplierId);
  if (!supplier) {
    showToast('المورد غير موجود', 'error');
    return;
  }

  try {
    const response = await fetch(`elos-db://supplier-transactions?supplier_id=${supplierId}`);
    if (!response.ok) throw new Error('Failed to load');

    const data = await response.json();
    const transactions = data.transactions || [];
    const summary = data.summary || {};
    const openingBalance = summary.opening_balance || data.supplier?.opening_balance || 0;

    // إضافة صف الرصيد الافتتاحي إذا كان موجوداً ومش موجود في المعاملات
    const hasOpeningBalanceTx = transactions.some(tx => tx.type === 'opening_balance');
    if (openingBalance !== 0 && !hasOpeningBalanceTx) {
      transactions.unshift({
        id: 'opening_balance',
        type: 'opening_balance',
        amount: openingBalance,
        created_at: data.supplier?.created_at || new Date().toISOString(),
        notes: 'رصيد افتتاحي'
      });
    }

    // إنشاء محتوى HTML للطباعة
    const printContent = generateStatementHTML(supplier, transactions, summary);

    // فتح نافذة طباعة جديدة
    const printWindow = window.open('', '_blank', 'width=800,height=600');
    printWindow.document.write(printContent);
    printWindow.document.close();

    // انتظار تحميل المحتوى ثم طباعة
    printWindow.onload = function() {
      printWindow.print();
    };

  } catch (error) {
    Logger.error('Print error:', error);
    showToast('فشل الطباعة', 'error');
  }
}

function closeHistoryModal() {
  document.getElementById('historyModal').classList.remove('active');
}

// ═══════════════════════════════════════════════════════════════
// 💾 SAVE SUPPLIER
// ═══════════════════════════════════════════════════════════════
async function saveSupplier(e) {
  e.preventDefault();
  
  const submitBtn = e.target.querySelector('button[type="submit"]') || document.querySelector('#supplierForm + .modal-footer button[type="submit"]');
  const originalText = submitBtn?.innerHTML;
  
  try {
    if (submitBtn) {
      submitBtn.disabled = true;
      submitBtn.innerHTML = '⏳ جاري الحفظ...';
    }
    
    const supplierId = document.getElementById('supplierId').value;
    const isEdit = !!supplierId;
    
    const supplierData = {
      name: document.getElementById('supplierName').value.trim(),
      phone: document.getElementById('supplierPhone').value.trim(),
      address: document.getElementById('supplierAddress').value.trim(),
      notes: document.getElementById('supplierNotes').value.trim()
    };
    
    if (!supplierData.name) {
      showToast('اسم المورد مطلوب', 'error');
      return;
    }
    
    let endpoint;
    
    if (isEdit) {
      endpoint = 'elos-db://suppliers-update';
      supplierData.id = Number(supplierId);
      supplierData.opening_balance = Number(document.getElementById('supplierBalance').value || 0);
    } else {
      endpoint = 'elos-db://suppliers-add';
      supplierData.opening_balance = Number(document.getElementById('supplierBalance').value || 0);
    }
    
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(supplierData)
    });
    
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
      throw new Error(errorData.error || 'فشل في حفظ البيانات');
    }
    
    const result = await response.json();
    
    if (result.ok || result.success || result.id) {
      showToast(isEdit ? '✅ تم تحديث المورد بنجاح' : '✅ تم إضافة المورد بنجاح', 'success');
      closeModal();
      await loadSuppliers();
    } else {
      throw new Error(result.error || 'فشل في حفظ البيانات');
    }
  } catch (error) {
    Logger.error('Save supplier error:', error);
    showToast('فشل حفظ المورد: ' + error.message, 'error');
  } finally {
    if (submitBtn) {
      submitBtn.disabled = false;
      submitBtn.innerHTML = originalText;
    }
  }
}

// ═══════════════════════════════════════════════════════════════
// ✏️ EDIT SUPPLIER
// ═══════════════════════════════════════════════════════════════
function editSupplier(supplierId) {
  const supplier = suppliers.find(s => s.id === supplierId);
  
  if (!supplier) {
    showToast('المورد غير موجود', 'error');
    return;
  }
  
  currentSupplierId = supplierId;
  document.getElementById('supplierId').value = supplier.id;
  document.getElementById('supplierName').value = supplier.name || '';
  document.getElementById('supplierPhone').value = supplier.phone || '';
  document.getElementById('supplierAddress').value = supplier.address || '';
  document.getElementById('supplierNotes').value = supplier.notes || '';
  document.getElementById('supplierBalance').value = supplier.opening_balance ?? 0;
  
  // إظهار حقل الرصيد الافتتاحي في التعديل (يمكن تعديله أو إضافته)
  document.getElementById('balanceGroup').style.display = 'block';
  const balanceLabel = document.querySelector('#balanceGroup .form-label');
  if (balanceLabel) balanceLabel.textContent = 'رصيد افتتاحي';
  
  document.getElementById('modalTitle').innerHTML = '<span>✏️</span><span class="arabic-text">تعديل بيانات المورد</span>';
  document.getElementById('supplierModal').classList.add('active');
  document.getElementById('supplierName').focus();
}

// ═══════════════════════════════════════════════════════════════
// 🗑️ DELETE SUPPLIER
// ═══════════════════════════════════════════════════════════════
async function deleteSupplier(supplierId) {
  const supplier = suppliers.find(s => s.id === supplierId);
  
  if (!supplier) {
    showToast('المورد غير موجود', 'error');
    return;
  }
  
  const balance = Number(supplier.balance) || 0;
  let confirmMsg = `هل أنت متأكد من حذف المورد "${supplier.name}"؟`;
  
  if (balance > 0) {
    confirmMsg += `\n\n⚠️ تحذير: هذا المورد لديه رصيد مستحق (${fmt(balance)} ج.م)`;
  }
  
  confirmMsg += '\n\nسيتم حذف جميع البيانات المرتبطة به نهائياً.';

  // ✅ استخدام showConfirm بدلاً من confirm
  const confirmed = await showConfirm(confirmMsg, 'حذف', 'إلغاء', 'danger');
  if (!confirmed) return;
  
  try {
    const response = await fetch('elos-db://suppliers-delete', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: supplierId })
    });
    
    if (!response.ok) throw new Error(await response.text());
    
    const result = await response.json();
    
    if (result.ok || result.success) {
      showToast('✅ تم حذف المورد بنجاح', 'success');
      await loadSuppliers();
    } else {
      throw new Error(result.error || 'فشل في الحذف');
    }
  } catch (error) {
    Logger.error('Delete supplier error:', error);
    showToast('فشل حذف المورد: ' + error.message, 'error');
  }
}

// ═══════════════════════════════════════════════════════════════
// 💰 SAVE PAYMENT
// ═══════════════════════════════════════════════════════════════
async function savePayment(e) {
  e.preventDefault();
  
  const submitBtn = e.target.querySelector('button[type="submit"]');
  const originalText = submitBtn?.innerHTML;
  
  try {
    if (submitBtn) {
      submitBtn.disabled = true;
      submitBtn.innerHTML = '⏳ جاري السداد...';
    }
    
    const supplierId = Number(document.getElementById('paymentSupplierId').value);
    const amount = Number(document.getElementById('paymentAmount').value || 0);
    const method = document.getElementById('paymentMethod').value;
    const notes = document.getElementById('paymentNotes').value.trim();
    
    if (!amount || amount <= 0) {
      showToast('الرجاء إدخال مبلغ صحيح', 'error');
      return;
    }
    
    const supplier = suppliers.find(s => s.id === supplierId);
    if (!supplier) {
      showToast('المورد غير موجود', 'error');
      return;
    }
    
    // تحذير إذا كان المبلغ أكبر من الرصيد
    if (amount > supplier.balance) {
      const confirmMsg = `⚠️ المبلغ المدخل (${fmt(amount)} ج.م) أكبر من الرصيد الحالي (${fmt(supplier.balance)} ج.م)\n\nهل تريد المتابعة؟`;
      // ✅ استخدام showConfirm بدلاً من confirm
      const confirmed = await showConfirm(confirmMsg, 'متابعة', 'إلغاء', 'warning');
      if (!confirmed) return;
    }
    
    // ✅ الحصول على المحفظة المحددة
    const walletSelect = document.getElementById('supplierPaymentWalletSelect');
    const walletId = (walletSelect && walletSelect.value && (method === 'mobile_wallet' || method === 'bank')) 
      ? parseInt(walletSelect.value) : null;
    
    const response = await fetch('elos-db://suppliers-payment', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        supplier_id: supplierId,
        amount: amount,
        payment_method: method,
        wallet_type: method, // للتوافق العكسي
        wallet_id: walletId, // ✅ المحفظة المحددة
        notes: notes
      })
    });
    
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
      throw new Error(errorData.error || 'فشل في السداد');
    }
    
    const result = await response.json();
    
    if (result.ok || result.success) {
      showToast(`✅ تم سداد ${fmt(amount)} ج.م بنجاح`, 'success');
      closePaymentModal();
      await loadSuppliers();
      await loadTodayPayments();
    } else {
      throw new Error(result.error || 'فشل في السداد');
    }
  } catch (error) {
    Logger.error('Payment error:', error);
    showToast('فشل السداد: ' + error.message, 'error');
  } finally {
    if (submitBtn) {
      submitBtn.disabled = false;
      submitBtn.innerHTML = originalText;
    }
  }
}

// ═══════════════════════════════════════════════════════════════
// 🛠️ UTILITY FUNCTIONS
// ═══════════════════════════════════════════════════════════════
function getInitials(name) {
  if (!name) return '?';
  const parts = name.trim().split(' ');
  if (parts.length >= 2) {
    return (parts[0][0] + parts[1][0]).toUpperCase();
  }
  return name.substring(0, 2).toUpperCase();
}

function truncate(str, length) {
  if (!str) return '';
  return str.length > length ? str.substring(0, length) + '...' : str;
}

function formatDate(dateStr) {
  if (!dateStr) return '-';
  const date = new Date(dateStr);
  return date.toLocaleDateString('ar-EG', { 
    year: 'numeric', 
    month: 'short', 
    day: 'numeric' 
  });
}

function formatDateTime(dateStr) {
  if (!dateStr) return '-';
  const date = new Date(dateStr);
  return date.toLocaleDateString('ar-EG', { 
    year: 'numeric', 
    month: 'short', 
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
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
    background: linear-gradient(135deg, #1d2330 0%, #151921 100%);
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
    pointer-events: auto;
  `;
  
  toast.innerHTML = `<span style="font-size: 20px;">${icons[type]}</span><span>${message}</span>`;
  container.appendChild(toast);
  
  setTimeout(() => {
    toast.style.animation = 'slideOut 0.3s ease-out';
    setTimeout(() => toast.remove(), 300);
  }, duration);
}

function createToastContainer() {
  let container = document.getElementById('toastContainer');
  if (container) return container;
  
  container = document.createElement('div');
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
  return container;
}

// ═══════════════════════════════════════════════════════════════
// 📅 DATE FILTER FUNCTIONS
// ═══════════════════════════════════════════════════════════════
function setHistoryDateRange(range) {
  const today = new Date();
  let fromDate = new Date();
  let toDate = today;

  switch (range) {
    case 'week':
      fromDate.setDate(today.getDate() - 7);
      break;
    case 'month':
      fromDate.setMonth(today.getMonth() - 1);
      break;
    case '3months':
      fromDate.setMonth(today.getMonth() - 3);
      break;
    case 'year':
      fromDate.setFullYear(today.getFullYear() - 1);
      break;
    case 'all':
      fromDate = null;
      toDate = null;
      break;
  }

  // تحديث المتغيرات
  historyDateFrom = fromDate ? fromDate.toISOString().slice(0, 10) : '';
  historyDateTo = toDate ? toDate.toISOString().slice(0, 10) : '';

  // تحديث حقول الإدخال
  document.getElementById('historyDateFrom').value = historyDateFrom;
  document.getElementById('historyDateTo').value = historyDateTo;

  // تحديث معلومات الفلتر
  updateFilterInfo(range);

  // تحديث تمييز الأزرار
  document.querySelectorAll('.date-filter-bar .btn-ghost').forEach(btn => {
    btn.style.background = '';
    btn.style.color = '';
  });
  event?.target?.style && (event.target.style.background = 'rgba(139,92,246,0.15)', event.target.style.color = 'var(--brand)');
}

function updateFilterInfo(range) {
  const infoEl = document.getElementById('historyFilterInfo');
  if (!infoEl) return;

  const labels = {
    'week': 'آخر أسبوع',
    'month': 'آخر شهر',
    '3months': 'آخر 3 شهور',
    'year': 'آخر سنة',
    'all': 'كل المعاملات'
  };

  infoEl.textContent = labels[range] || '';
}

function applyHistoryDateFilter() {
  // قراءة القيم من حقول الإدخال
  historyDateFrom = document.getElementById('historyDateFrom').value;
  historyDateTo = document.getElementById('historyDateTo').value;

  // إعادة تحميل البيانات
  if (currentSupplierId) {
    showHistory(currentSupplierId, historyDateFrom, historyDateTo);
  }
}

// ═══════════════════════════════════════════════════════════════
// 🌐 GLOBAL EXPORTS
// ═══════════════════════════════════════════════════════════════
window.loadSuppliers = loadSuppliers;
window.filterSuppliers = filterSuppliers;
window.openAddModal = openAddModal;
window.closeModal = closeModal;
window.saveSupplier = saveSupplier;
window.editSupplier = editSupplier;
window.deleteSupplier = deleteSupplier;
window.openPaymentModal = openPaymentModal;
window.closePaymentModal = closePaymentModal;
window.calculatePaymentRemaining = calculatePaymentRemaining;
window.savePayment = savePayment;
window.showHistory = showHistory;
window.closeHistoryModal = closeHistoryModal;
window.exportStatementPDF = exportStatementPDF;
window.shareWhatsApp = shareWhatsApp;
window.printStatement = printStatement;
window.setHistoryDateRange = setHistoryDateRange;
window.applyHistoryDateFilter = applyHistoryDateFilter;

// ═══════════════════════════════════════════════════════════════
// 📊 SUPPLIER SALES REPORT - كشف حساب مبيعات المورد
// ═══════════════════════════════════════════════════════════════

async function showSupplierSalesReport(supplierId) {
  const supplier = suppliers.find(s => s.id === supplierId);
  if (!supplier) {
    showToast('المورد غير موجود', 'error');
    return;
  }
  
  currentSupplierId = supplierId;
  
  // فتح مودال كشف المبيعات
  const modal = document.getElementById('supplierSalesReportModal');
  if (!modal) {
    showToast('مودال كشف المبيعات غير موجود', 'error');
    return;
  }
  
  document.getElementById('salesReportTitle').textContent = `كشف مبيعات: ${supplier.name}`;
  document.getElementById('salesReportBody').innerHTML = '<div style="text-align:center;padding:40px;">⏳ جاري التحميل...</div>';
  modal.classList.add('active');
  
  // تعيين التواريخ الافتراضية (آخر 3 أشهر)
  const today = new Date();
  const threeMonthsAgo = new Date();
  threeMonthsAgo.setMonth(threeMonthsAgo.getMonth() - 3);
  
  const dateFromInput = document.getElementById('salesReportDateFrom');
  const dateToInput = document.getElementById('salesReportDateTo');
  
  if (dateFromInput) dateFromInput.value = threeMonthsAgo.toISOString().split('T')[0];
  if (dateToInput) dateToInput.value = today.toISOString().split('T')[0];
  
  await loadSupplierSalesReport(supplierId);
}

async function loadSupplierSalesReport(supplierId) {
  if (!supplierId) supplierId = currentSupplierId;
  if (!supplierId) {
    showToast('معرف المورد غير موجود', 'error');
    return;
  }
  
  try {
    const fromDate = document.getElementById('salesReportDateFrom')?.value;
    const toDate = document.getElementById('salesReportDateTo')?.value;
    
    let url = `elos-db://supplier-sales-report?supplier_id=${supplierId}`;
    if (fromDate) url += `&from=${fromDate}`;
    if (toDate) url += `&to=${toDate}`;
    
    const response = await fetch(url);
    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(errorText || 'فشل تحميل البيانات');
    }
    
    const data = await response.json();
    if (!data.success) throw new Error(data.error || 'فشل تحميل البيانات');
    
    renderSupplierSalesReport(data);
  } catch (error) {
    Logger.error('Load sales report error:', error);
    const body = document.getElementById('salesReportBody');
    if (body) {
      body.innerHTML = `
        <div class="empty-state">
          <div class="empty-state-icon">❌</div>
          <div class="empty-state-text">فشل تحميل البيانات: ${error.message}</div>
        </div>
      `;
    }
    showToast('فشل تحميل كشف المبيعات: ' + error.message, 'error');
  }
}

function renderSupplierSalesReport(data) {
  const { supplier, purchases, sales, stats } = data;
  const body = document.getElementById('salesReportBody');
  
  body.innerHTML = `
    <!-- ملخص الإحصائيات -->
    <div class="sales-report-summary">
      <div class="summary-card">
        <div class="summary-icon">📦</div>
        <div class="summary-content">
          <div class="summary-label">إجمالي المشتريات</div>
          <div class="summary-value">${stats.total_purchased} جهاز</div>
          <div class="summary-amount">${fmt(stats.total_purchase_value)} ج.م</div>
        </div>
      </div>
      <div class="summary-card">
        <div class="summary-icon">💰</div>
        <div class="summary-content">
          <div class="summary-label">إجمالي المبيعات</div>
          <div class="summary-value">${stats.total_sold} جهاز</div>
          <div class="summary-amount">${fmt(stats.total_sales_value)} ج.م</div>
        </div>
      </div>
    </div>
    
    <!-- أزرار التصدير -->
    <div class="export-buttons" style="margin: 20px 0; display: flex; gap: 12px; flex-wrap: wrap;">
      <button class="btn btn-primary" onclick="exportSupplierSalesPDF(${supplier.id})">
        📄 تصدير PDF
      </button>
      <button class="btn btn-secondary" onclick="printSupplierSalesReport(${supplier.id})">
        🖨️ طباعة
      </button>
    </div>
    
    <!-- جدول المبيعات -->
    <div class="sales-report-table">
      <h3 style="margin: 20px 0 10px; font-size: 18px; color: var(--text-primary);">📊 تفاصيل المبيعات</h3>
      <div style="overflow-x: auto;">
        <table style="width: 100%; border-collapse: collapse;">
          <thead>
            <tr style="background: var(--bg-secondary); border-bottom: 2px solid var(--border);">
              <th style="padding: 12px; text-align: right; font-weight: 600; color: var(--text-secondary);">#</th>
              <th style="padding: 12px; text-align: right; font-weight: 600; color: var(--text-secondary);">تاريخ البيع</th>
              <th style="padding: 12px; text-align: right; font-weight: 600; color: var(--text-secondary);">الجهاز</th>
              <th style="padding: 12px; text-align: right; font-weight: 600; color: var(--text-secondary);">IMEI</th>
              <th style="padding: 12px; text-align: right; font-weight: 600; color: var(--text-secondary);">اسم العميل</th>
              <th style="padding: 12px; text-align: right; font-weight: 600; color: var(--text-secondary);">هاتف العميل</th>
              <th style="padding: 12px; text-align: right; font-weight: 600; color: var(--text-secondary);">سعر البيع</th>
              <th style="padding: 12px; text-align: right; font-weight: 600; color: var(--text-secondary);">الخصم</th>
            </tr>
          </thead>
          <tbody>
            ${sales.length === 0 ? `
              <tr>
                <td colspan="8" style="padding: 40px; text-align: center; color: var(--text-secondary);">
                  <div>لا توجد مبيعات في الفترة المحددة</div>
                </td>
              </tr>
            ` : sales.map((sale, idx) => {
              const customerName = sale.client_name_from_table || sale.customer_name || 'غير محدد';
              const customerPhone = sale.customer_phone || '-';
              const deviceName = `${sale.type || ''} ${sale.model || ''}`.trim() || 'جهاز';
              const deviceDetails = `${sale.storage || ''} ${sale.color || ''}`.trim() || '';
              
              return `
                <tr style="border-bottom: 1px solid var(--border); transition: background 0.2s;" onmouseover="this.style.background='var(--bg-secondary)'" onmouseout="this.style.background='transparent'">
                  <td style="padding: 12px; text-align: center; color: var(--text-secondary);">${idx + 1}</td>
                  <td style="padding: 12px; color: var(--text-primary);">${formatDate(sale.sale_date)}</td>
                  <td style="padding: 12px;">
                    <strong style="color: var(--text-primary);">${escapeHtml(deviceName)}</strong>
                    ${deviceDetails ? `<br><small style="color: var(--text-secondary); font-size: 11px;">${escapeHtml(deviceDetails)}</small>` : ''}
                  </td>
                  <td style="padding: 12px; font-family: monospace; font-size: 11px; color: var(--text-secondary);">${sale.imei1 || '-'}</td>
                  <td style="padding: 12px; color: var(--text-primary);">${escapeHtml(customerName)}</td>
                  <td style="padding: 12px; color: var(--text-secondary);">${escapeHtml(customerPhone)}</td>
                  <td style="padding: 12px; font-weight: 600; color: var(--text-primary);">${fmt(sale.sell_price)} ج.م</td>
                  <td style="padding: 12px; color: var(--warning);">${fmt(sale.discount || 0)} ج.م</td>
                </tr>
              `;
            }).join('')}
          </tbody>
        </table>
      </div>
    </div>
  `;
}

function closeSupplierSalesReport() {
  const modal = document.getElementById('supplierSalesReportModal');
  if (modal) {
    modal.classList.remove('active');
  }
}

async function exportSupplierSalesPDF(supplierId) {
  const supplier = suppliers.find(s => s.id === supplierId);
  if (!supplier) {
    showToast('المورد غير موجود', 'error');
    return;
  }

  try {
    showToast('⏳ جاري إنشاء كشف المبيعات...', 'info');

    // جلب البيانات
    const fromDate = document.getElementById('salesReportDateFrom')?.value;
    const toDate = document.getElementById('salesReportDateTo')?.value;
    
    let url = `elos-db://supplier-sales-report?supplier_id=${supplierId}`;
    if (fromDate) url += `&from=${fromDate}`;
    if (toDate) url += `&to=${toDate}`;
    
    const response = await fetch(url);
    if (!response.ok) throw new Error('فشل تحميل البيانات');
    
    const data = await response.json();
    if (!data.success) throw new Error(data.error || 'فشل تحميل البيانات');
    
    const { supplier: supplierData, purchases, sales, stats } = data;

    // تحميل المكتبات
    await loadPDFLibraries();

    const { jsPDF } = window.jspdf;
    const pdf = new jsPDF('p', 'mm', 'a4');
    const pageWidth = pdf.internal.pageSize.getWidth();
    const pageHeight = pdf.internal.pageSize.getHeight();
    const margin = 10;
    const contentWidth = pageWidth - (margin * 2);

    // تقسيم المبيعات - 8 في كل صفحة (لأن الجدول أوسع)
    const ROWS_PER_PAGE = 8;
    const totalPages = Math.max(1, Math.ceil(sales.length / ROWS_PER_PAGE));

    for (let page = 0; page < totalPages; page++) {
      // الحصول على المبيعات الخاصة بهذه الصفحة
      const startIdx = page * ROWS_PER_PAGE;
      const pageSales = sales.slice(startIdx, startIdx + ROWS_PER_PAGE);

      // إنشاء محتوى HTML لهذه الصفحة
      const printContent = generateSupplierSalesReportHTML(
        supplierData, 
        pageSales, 
        purchases, 
        stats, 
        page + 1, 
        totalPages, 
        startIdx,
        fromDate,
        toDate
      );

      // إنشاء iframe مخفي
      const iframe = document.createElement('iframe');
      iframe.style.cssText = 'position:fixed;left:-9999px;top:0;width:794px;';
      document.body.appendChild(iframe);
      iframe.contentDocument.write(printContent);
      iframe.contentDocument.close();

      // انتظار تحميل المحتوى
      await new Promise(resolve => setTimeout(resolve, 500));

      const body = iframe.contentDocument.body;

      // تحويل لـ canvas
      const canvas = await html2canvas(body, {
        scale: 2,
        useCORS: true,
        allowTaint: true,
        backgroundColor: '#ffffff',
        width: 794,
        windowWidth: 794
      });

      const imgData = canvas.toDataURL('image/jpeg', 0.95);
      const imgWidth = contentWidth;
      const imgHeight = (canvas.height * contentWidth) / canvas.width;

      // إضافة صفحة جديدة (ما عدا الأولى)
      if (page > 0) {
        pdf.addPage();
      }

      pdf.addImage(imgData, 'JPEG', margin, margin, imgWidth, imgHeight);

      // تنظيف الـ iframe
      document.body.removeChild(iframe);
    }

    // حفظ الملف
    const dateRange = fromDate && toDate 
      ? `${fromDate}_${toDate}` 
      : new Date().toISOString().slice(0,10);
    const fileName = `كشف_مبيعات_${supplierData.name.replace(/\s+/g, '_')}_${dateRange}.pdf`;
    pdf.save(fileName);

    showToast('✅ تم حفظ كشف المبيعات بنجاح', 'success');

  } catch (error) {
    Logger.error('Export sales PDF error:', error);
    showToast('فشل إنشاء كشف المبيعات: ' + error.message, 'error');
  }
}

function generateSupplierSalesReportHTML(supplier, sales, purchases, stats, currentPage = 1, totalPages = 1, startIdx = 0, fromDate = null, toDate = null) {
  const settings = JSON.parse(localStorage.getItem('appSettings') || '{}');
  const companyName = settings.companyName || 'ElOs Accounting System';
  const companyLogo = settings.companyLogo || null;
  const today = new Date().toLocaleDateString('ar-EG', {
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });

  // تحديد اتجاه اللوجو
  const logoHTML = companyLogo
    ? `<img src="${companyLogo}" alt="Logo" style="width: 60px; height: 60px; object-fit: contain; border-radius: 10px;">`
    : `<div style="width: 60px; height: 60px; background: linear-gradient(135deg, #8b5cf6, #a855f7); border-radius: 10px; display: flex; align-items: center; justify-content: center; color: white; font-size: 24px; font-weight: bold;">${companyName.charAt(0)}</div>`;

  // رقم الصفحة
  const pageInfo = totalPages > 1 ? `<span style="font-size: 12px; color: #666;">صفحة ${currentPage} من ${totalPages}</span>` : '';

  // نطاق التاريخ
  const dateRange = fromDate && toDate 
    ? `من ${new Date(fromDate).toLocaleDateString('ar-EG')} إلى ${new Date(toDate).toLocaleDateString('ar-EG')}`
    : 'جميع الفترات';

  return `
    <!DOCTYPE html>
    <html lang="ar" dir="rtl">
    <head>
      <meta charset="UTF-8">
      <title>كشف مبيعات - ${supplier.name}</title>
      <link href="https://fonts.googleapis.com/css2?family=Cairo:wght@400;600;700;800&display=swap" rel="stylesheet">
      <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body {
          font-family: 'Cairo', 'Segoe UI', Tahoma, sans-serif;
          background: white;
          color: #1a1a2e;
          padding: 30px;
          line-height: 1.6;
          direction: rtl;
        }
        .header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          border-bottom: 3px solid #8b5cf6;
          padding-bottom: 20px;
          margin-bottom: 25px;
        }
        .company-info {
          display: flex;
          align-items: center;
          gap: 15px;
        }
        .company-info h1 {
          font-size: 26px;
          color: #8b5cf6;
          font-weight: 800;
        }
        .company-info p {
          color: #666;
          font-size: 12px;
        }
        .report-info {
          text-align: left;
        }
        .report-info h2 {
          font-size: 18px;
          color: #333;
          margin-bottom: 5px;
        }
        .report-info p {
          font-size: 12px;
          color: #666;
        }
        .supplier-card {
          background: linear-gradient(135deg, #f8f9fa 0%, #e9ecef 100%);
          border-radius: 12px;
          padding: 20px;
          margin-bottom: 25px;
          border-right: 5px solid #8b5cf6;
        }
        .supplier-card h3 {
          font-size: 20px;
          color: #333;
          margin-bottom: 10px;
          font-weight: 700;
        }
        .supplier-card .info-row {
          display: flex;
          gap: 40px;
          margin-top: 8px;
          flex-wrap: wrap;
        }
        .supplier-card .info-item {
          display: flex;
          align-items: center;
          gap: 8px;
          font-size: 14px;
        }
        .supplier-card .info-item .label {
          color: #666;
        }
        .supplier-card .info-item .value {
          font-weight: 600;
          color: #333;
        }
        .summary-cards {
          display: grid;
          grid-template-columns: repeat(2, 1fr);
          gap: 15px;
          margin-bottom: 25px;
        }
        .summary-card {
          background: white;
          border: 2px solid #eee;
          border-radius: 12px;
          padding: 18px;
          text-align: center;
        }
        .summary-card.purchase { border-top: 4px solid #ef4444; }
        .summary-card.sales { border-top: 4px solid #3b82f6; }
        .summary-card .label {
          font-size: 12px;
          color: #666;
          margin-bottom: 8px;
          font-weight: 600;
        }
        .summary-card .value {
          font-size: 20px;
          font-weight: 800;
          margin-bottom: 4px;
        }
        .summary-card .sub-value {
          font-size: 11px;
          color: #999;
        }
        .summary-card.purchase .value { color: #ef4444; }
        .summary-card.sales .value { color: #3b82f6; }
        .section-title {
          font-size: 16px;
          font-weight: 700;
          color: #333;
          margin-bottom: 12px;
          display: flex;
          align-items: center;
          gap: 8px;
        }
        table {
          width: 100%;
          border-collapse: collapse;
          margin-top: 10px;
          font-size: 11px;
        }
        th {
          background: #8b5cf6;
          color: white;
          padding: 10px 8px;
          text-align: right;
          font-weight: 700;
          font-size: 10px;
        }
        th:first-child { border-radius: 0 8px 0 0; }
        th:last-child { border-radius: 8px 0 0 0; }
        td {
          padding: 10px 8px;
          border-bottom: 1px solid #eee;
          font-size: 10px;
        }
        tr:nth-child(even) {
          background: #f8f9fa;
        }
        .device-info {
          font-weight: 600;
          color: #333;
        }
        .device-details {
          font-size: 9px;
          color: #666;
          margin-top: 2px;
        }
        .imei {
          font-family: 'Courier New', monospace;
          font-size: 9px;
          color: #666;
        }
        .customer-name {
          font-weight: 600;
          color: #333;
        }
        .customer-phone {
          font-size: 9px;
          color: #666;
          margin-top: 2px;
        }
        .amount {
          font-weight: 700;
          font-size: 11px;
        }
        .amount.sale { color: #3b82f6; }
        .amount.discount { color: #f59e0b; }
        .footer {
          margin-top: 30px;
          padding-top: 15px;
          border-top: 2px solid #eee;
          text-align: center;
          color: #666;
          font-size: 11px;
        }
        .footer p { margin: 3px 0; }
        tr {
          page-break-inside: avoid !important;
          break-inside: avoid !important;
        }
        thead {
          display: table-header-group;
        }
        tbody tr {
          page-break-inside: avoid !important;
          break-inside: avoid !important;
        }
      </style>
    </head>
    <body>
      <div class="header">
        <div class="company-info">
          ${logoHTML}
          <div>
            <h1>${companyName}</h1>
            <p>كشف حساب مبيعات المورد</p>
          </div>
        </div>
        <div class="report-info">
          <h2>📊 كشف مبيعات المورد</h2>
          <p>تاريخ التقرير: ${today}</p>
          <p>الفترة: ${dateRange}</p>
          ${pageInfo}
        </div>
      </div>

      <div class="supplier-card">
        <h3>${escapeHtml(supplier.name)}</h3>
        <div class="info-row">
          <div class="info-item">
            <span class="label">الهاتف:</span>
            <span class="value">${supplier.phone || 'غير محدد'}</span>
          </div>
          <div class="info-item">
            <span class="label">العنوان:</span>
            <span class="value">${supplier.address || 'غير محدد'}</span>
          </div>
        </div>
      </div>

      <div class="summary-cards">
        <div class="summary-card purchase">
          <div class="label">إجمالي المشتريات</div>
          <div class="value">${stats.total_purchased}</div>
          <div class="sub-value">${fmt(stats.total_purchase_value)} ج.م</div>
        </div>
        <div class="summary-card sales">
          <div class="label">إجمالي المبيعات</div>
          <div class="value">${stats.total_sold}</div>
          <div class="sub-value">${fmt(stats.total_sales_value)} ج.م</div>
        </div>
      </div>

      <div class="section-title">
        <span>📋</span>
        <span>تفاصيل المبيعات ${startIdx > 0 ? `(من ${startIdx + 1} إلى ${startIdx + sales.length})` : ''}</span>
      </div>

      <table>
        <thead>
          <tr>
            <th>#</th>
            <th>تاريخ البيع</th>
            <th>الجهاز</th>
            <th>IMEI</th>
            <th>اسم العميل</th>
            <th>هاتف العميل</th>
            <th>سعر البيع</th>
            <th>الخصم</th>
          </tr>
        </thead>
        <tbody>
          ${sales.length === 0 ? `
            <tr>
              <td colspan="8" style="text-align: center; padding: 40px; color: #666;">
                لا توجد مبيعات في الفترة المحددة
              </td>
            </tr>
          ` : sales.map((sale, idx) => {
            const customerName = sale.client_name_from_table || sale.customer_name || 'غير محدد';
            const customerPhone = sale.customer_phone || '-';
            const deviceName = `${sale.type || ''} ${sale.model || ''}`.trim() || 'جهاز';
            const deviceDetails = `${sale.storage || ''} ${sale.color || ''}`.trim() || '';
            const saleDate = new Date(sale.sale_date).toLocaleDateString('ar-EG', {
              year: 'numeric',
              month: 'short',
              day: 'numeric',
              hour: '2-digit',
              minute: '2-digit'
            });
            
            return `
              <tr>
                <td style="text-align: center; color: #666;">${startIdx + idx + 1}</td>
                <td style="color: #333;">${saleDate}</td>
                <td>
                  <div class="device-info">${escapeHtml(deviceName)}</div>
                  ${deviceDetails ? `<div class="device-details">${escapeHtml(deviceDetails)}</div>` : ''}
                </td>
                <td class="imei">${sale.imei1 || '-'}</td>
                <td>
                  <div class="customer-name">${escapeHtml(customerName)}</div>
                </td>
                <td>
                  <div class="customer-phone">${escapeHtml(customerPhone)}</div>
                </td>
                <td class="amount sale">${fmt(sale.sell_price)} ج.م</td>
                <td class="amount discount">${fmt(sale.discount || 0)} ج.م</td>
              </tr>
            `;
          }).join('')}
        </tbody>
      </table>

      <div class="footer">
        <p><strong>${companyName}</strong></p>
        <p>تم إنشاء هذا التقرير تلقائياً من نظام ElOs Accounting</p>
        <p>تاريخ الإنشاء: ${today}</p>
      </div>
    </body>
    </html>
  `;
}

function printSupplierSalesReport(supplierId) {
  const supplier = suppliers.find(s => s.id === supplierId);
  if (!supplier) {
    showToast('المورد غير موجود', 'error');
    return;
  }

  // جلب البيانات
  const fromDate = document.getElementById('salesReportDateFrom')?.value;
  const toDate = document.getElementById('salesReportDateTo')?.value;
  
  let url = `elos-db://supplier-sales-report?supplier_id=${supplierId}`;
  if (fromDate) url += `&from=${fromDate}`;
  if (toDate) url += `&to=${toDate}`;
  
  fetch(url)
    .then(res => res.json())
    .then(data => {
      if (!data.success) throw new Error(data.error || 'فشل تحميل البيانات');
      
      const { supplier: supplierData, purchases, sales, stats } = data;
      
      // إنشاء محتوى HTML للطباعة
      const printContent = generateSupplierSalesReportHTML(
        supplierData,
        sales,
        purchases,
        stats,
        1,
        1,
        0,
        fromDate,
        toDate
      );
      
      // فتح نافذة طباعة
      const printWindow = window.open('', '_blank');
      printWindow.document.write(printContent);
      printWindow.document.close();
      
      // انتظار تحميل الصور ثم الطباعة
      setTimeout(() => {
        printWindow.print();
      }, 500);
    })
    .catch(error => {
      Logger.error('Print sales report error:', error);
      showToast('فشل تحميل البيانات للطباعة: ' + error.message, 'error');
    });
}

window.showSupplierSalesReport = showSupplierSalesReport;
window.loadSupplierSalesReport = loadSupplierSalesReport;
window.closeSupplierSalesReport = closeSupplierSalesReport;
window.exportSupplierSalesPDF = exportSupplierSalesPDF;
window.printSupplierSalesReport = printSupplierSalesReport;

// ═══════════════════════════════════════════════════════════════
// 📤 EXPORT SUPPLIERS TO CSV
// ═══════════════════════════════════════════════════════════════
async function exportSuppliersToCSV() {
  try {
    showToast('📊 جاري تصدير بيانات الموردين...', 'info');

    // جلب كل الموردين
    const response = await fetch('elos-db://suppliers');
    const allSuppliers = await response.json();

    if (!allSuppliers || allSuppliers.length === 0) {
      showToast('⚠️ لا توجد بيانات للتصدير', 'warning');
      return;
    }

    // إنشاء محتوى CSV
    const headers = ['الاسم', 'الهاتف', 'العنوان', 'الرصيد الافتتاحي', 'ملاحظات'];
    let csv = headers.join(',') + '\n';

    allSuppliers.forEach(supplier => {
      // تصدير الرصيد الحالي (كشف الحساب) ليكون رصيداً افتتاحياً عند الاستيراد على جهاز آخر
      const balanceToExport = supplier.balance ?? supplier.opening_balance ?? 0;
      const row = [
        `"${(supplier.name || '').replace(/"/g, '""')}"`,
        `"${(supplier.phone || '').replace(/"/g, '""')}"`,
        `"${(supplier.address || '').replace(/"/g, '""')}"`,
        balanceToExport,
        `"${(supplier.notes || '').replace(/"/g, '""')}"`
      ];
      csv += row.join(',') + '\n';
    });

    // إنشاء رابط التحميل
    const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `الموردين_${new Date().toISOString().split('T')[0]}.csv`;
    link.click();

    showToast(`✅ تم تصدير ${allSuppliers.length} مورد بنجاح`, 'success');

  } catch (error) {
    Logger.error('[EXPORT] Failed:', error);
    showToast('❌ فشل التصدير', 'error');
  }
}

// ═══════════════════════════════════════════════════════════════
// 📥 IMPORT SUPPLIERS FROM CSV
// ═══════════════════════════════════════════════════════════════
let supplierImportData = [];
let supplierImportMode = 'add'; // 'add' أو 'update'

function openSuppliersImportModal() {
  // إنشاء modal الاستيراد إذا لم يكن موجوداً
  let modal = document.getElementById('suppliersImportModal');
  if (!modal) {
    modal = document.createElement('div');
    modal.id = 'suppliersImportModal';
    modal.className = 'modal-overlay';
    modal.innerHTML = `
      <div class="modal-content" style="max-width: 800px;">
        <div class="modal-header">
          <h3 class="modal-title"><span>📥</span> <span class="arabic-text">استيراد الموردين</span></h3>
          <button class="modal-close" onclick="closeSuppliersImportModal()">✕</button>
        </div>
        <div class="modal-body" style="padding: 20px;">
          <!-- منطقة السحب والإفلات -->
          <div id="suppliersImportDropZone" style="border: 2px dashed var(--border); border-radius: 12px; padding: 30px 20px; text-align: center; cursor: pointer; transition: all 0.3s;" onclick="document.getElementById('suppliersImportFileInput').click()">
            <div style="font-size: 48px; margin-bottom: 15px;">📄</div>
            <p style="color: var(--text-secondary); margin-bottom: 10px;">اسحب ملف CSV هنا أو اضغط للاختيار</p>
            <p style="font-size: 12px; color: var(--text-secondary);">الأعمدة: الاسم، الهاتف، العنوان، الرصيد الافتتاحي، ملاحظات</p>
          </div>
          <input type="file" id="suppliersImportFileInput" accept=".csv" style="display: none;" onchange="handleSuppliersImportFile(event)">

          <!-- معلومات الملف -->
          <div id="suppliersImportFileInfo" style="display: none; margin-top: 15px; padding: 12px; background: var(--bg-tertiary); border-radius: 8px;">
            <div style="display: flex; align-items: center; justify-content: space-between;">
              <div style="display: flex; align-items: center; gap: 10px;">
                <span style="font-size: 24px;">📄</span>
                <div>
                  <div id="suppliersImportFileName" style="font-weight: 600;"></div>
                  <div id="suppliersImportFileCount" style="font-size: 12px; color: var(--text-secondary);"></div>
                </div>
              </div>
              <button class="btn btn-ghost" style="padding: 6px 12px; font-size: 12px;" onclick="document.getElementById('suppliersImportFileInput').click()">
                🔄 تغيير الملف
              </button>
            </div>
          </div>

          <!-- وضع الاستيراد -->
          <div id="suppliersImportModeSection" style="display: none; margin-top: 15px; padding: 15px; background: var(--bg-tertiary); border-radius: 8px;">
            <label style="font-weight: 600; margin-bottom: 10px; display: block;">⚙️ وضع الاستيراد:</label>
            <div style="display: flex; gap: 15px; flex-wrap: wrap;">
              <label style="display: flex; align-items: center; gap: 8px; cursor: pointer; padding: 10px 15px; background: var(--bg-secondary); border-radius: 8px; border: 2px solid var(--border); transition: all 0.3s;" id="supplierImportModeAdd">
                <input type="radio" name="supplierImportMode" value="add" checked onchange="setSupplierImportMode('add')" style="accent-color: var(--accent);">
                <div>
                  <div style="font-weight: 600;">➕ إضافة جديد فقط</div>
                  <div style="font-size: 11px; color: var(--text-secondary);">تجاهل الموردين الموجودين</div>
                </div>
              </label>
              <label style="display: flex; align-items: center; gap: 8px; cursor: pointer; padding: 10px 15px; background: var(--bg-secondary); border-radius: 8px; border: 2px solid var(--border); transition: all 0.3s;" id="supplierImportModeUpdate">
                <input type="radio" name="supplierImportMode" value="update" onchange="setSupplierImportMode('update')" style="accent-color: var(--warning);">
                <div>
                  <div style="font-weight: 600;">🔄 تحديث الموجودين</div>
                  <div style="font-size: 11px; color: var(--text-secondary);">تحديث بالهاتف + إضافة الجدد</div>
                </div>
              </label>
            </div>
          </div>

          <!-- معاينة البيانات -->
          <div id="suppliersImportPreview" style="display: none; margin-top: 15px;">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px;">
              <label style="font-weight: 600;">👁️ معاينة البيانات:</label>
              <span id="suppliersPreviewStats" style="font-size: 12px; color: var(--text-secondary);"></span>
            </div>
            <div style="max-height: 250px; overflow: auto; border: 1px solid var(--border); border-radius: 8px;">
              <table style="width: 100%; border-collapse: collapse; font-size: 12px;">
                <thead style="position: sticky; top: 0; background: var(--bg-tertiary);">
                  <tr>
                    <th style="padding: 8px; text-align: right; border-bottom: 1px solid var(--border);">الحالة</th>
                    <th style="padding: 8px; text-align: right; border-bottom: 1px solid var(--border);">الاسم</th>
                    <th style="padding: 8px; text-align: right; border-bottom: 1px solid var(--border);">الهاتف</th>
                    <th style="padding: 8px; text-align: right; border-bottom: 1px solid var(--border);">العنوان</th>
                    <th style="padding: 8px; text-align: right; border-bottom: 1px solid var(--border);">الرصيد</th>
                  </tr>
                </thead>
                <tbody id="suppliersPreviewTableBody"></tbody>
              </table>
            </div>
          </div>

          <!-- زر الاستيراد -->
          <button id="suppliersImportBtn" class="btn btn-primary" style="width: 100%; margin-top: 20px; padding: 12px;" onclick="executeSuppliersImport()" disabled>
            📥 استيراد البيانات
          </button>

          <!-- ملاحظة النموذج -->
          <div style="margin-top: 15px; padding: 12px; background: rgba(139,92,246,0.1); border-radius: 8px;">
            <p style="font-size: 12px; color: var(--accent); margin: 0;">
              💡 <strong>ملاحظة:</strong> يمكنك تحميل
              <a href="#" onclick="downloadSuppliersTemplate(); return false;" style="color: var(--accent); text-decoration: underline;">نموذج CSV</a>
              للمساعدة في تنسيق البيانات
            </p>
          </div>
        </div>
      </div>
    `;
    document.body.appendChild(modal);
    setupSuppliersImportDragDrop();
  }

  supplierImportData = [];
  supplierImportMode = 'add';
  document.getElementById('suppliersImportFileInput').value = '';
  document.getElementById('suppliersImportFileInfo').style.display = 'none';
  document.getElementById('suppliersImportModeSection').style.display = 'none';
  document.getElementById('suppliersImportPreview').style.display = 'none';
  document.getElementById('suppliersImportBtn').disabled = true;
  modal.classList.add('active');
}

function setSupplierImportMode(mode) {
  supplierImportMode = mode;
  // تحديث تنسيق الأزرار
  const addBtn = document.getElementById('supplierImportModeAdd');
  const updateBtn = document.getElementById('supplierImportModeUpdate');
  if (mode === 'add') {
    addBtn.style.borderColor = 'var(--accent)';
    addBtn.style.background = 'rgba(139,92,246,0.1)';
    updateBtn.style.borderColor = 'var(--border)';
    updateBtn.style.background = 'var(--bg-secondary)';
  } else {
    updateBtn.style.borderColor = 'var(--warning)';
    updateBtn.style.background = 'rgba(245,158,11,0.1)';
    addBtn.style.borderColor = 'var(--border)';
    addBtn.style.background = 'var(--bg-secondary)';
  }
  // إعادة تحليل المعاينة
  if (supplierImportData.length > 0) {
    renderSuppliersImportPreview();
  }
}
window.setSupplierImportMode = setSupplierImportMode;

function closeSuppliersImportModal() {
  const modal = document.getElementById('suppliersImportModal');
  if (modal) modal.classList.remove('active');
  supplierImportData = [];
}

function setupSuppliersImportDragDrop() {
  const dropZone = document.getElementById('suppliersImportDropZone');
  if (!dropZone) return;

  dropZone.addEventListener('dragover', (e) => {
    e.preventDefault();
    dropZone.style.borderColor = 'var(--accent)';
    dropZone.style.background = 'rgba(139,92,246,0.1)';
  });

  dropZone.addEventListener('dragleave', (e) => {
    e.preventDefault();
    dropZone.style.borderColor = 'var(--border)';
    dropZone.style.background = 'transparent';
  });

  dropZone.addEventListener('drop', (e) => {
    e.preventDefault();
    dropZone.style.borderColor = 'var(--border)';
    dropZone.style.background = 'transparent';

    const file = e.dataTransfer.files[0];
    if (file && file.name.endsWith('.csv')) {
      processSuppliersImportFile(file);
    } else {
      showToast('⚠️ يرجى اختيار ملف CSV', 'warning');
    }
  });
}

function handleSuppliersImportFile(event) {
  const file = event.target.files[0];
  if (!file) return;

  if (!file.name.endsWith('.csv')) {
    showToast('⚠️ يرجى اختيار ملف CSV', 'warning');
    return;
  }

  processSuppliersImportFile(file);
}

function processSuppliersImportFile(file) {
  const reader = new FileReader();
  reader.onload = async function(e) {
    const content = e.target.result;
    supplierImportData = parseSuppliersCSV(content);

    document.getElementById('suppliersImportFileName').textContent = file.name;
    document.getElementById('suppliersImportFileCount').textContent = `${supplierImportData.length} مورد`;
    document.getElementById('suppliersImportFileInfo').style.display = 'block';

    if (supplierImportData.length > 0) {
      // إظهار وضع الاستيراد والمعاينة
      document.getElementById('suppliersImportModeSection').style.display = 'block';
      document.getElementById('suppliersImportPreview').style.display = 'block';
      document.getElementById('suppliersImportBtn').disabled = false;

      // رسم المعاينة
      await renderSuppliersImportPreview();

      showToast(`✅ تم قراءة ${supplierImportData.length} مورد من الملف`, 'success');
    } else {
      document.getElementById('suppliersImportModeSection').style.display = 'none';
      document.getElementById('suppliersImportPreview').style.display = 'none';
      showToast('⚠️ الملف فارغ أو غير صالح', 'warning');
    }
  };
  reader.readAsText(file, 'UTF-8');
}

async function renderSuppliersImportPreview() {
  const tbody = document.getElementById('suppliersPreviewTableBody');
  const statsEl = document.getElementById('suppliersPreviewStats');

  // جلب الموردين الحاليين للمقارنة
  let existingSuppliers = [];
  try {
    const response = await fetch('elos-db://suppliers');
    existingSuppliers = await response.json();
  } catch (e) {}

  // إنشاء map للبحث السريع بالهاتف
  const existingByPhone = {};
  existingSuppliers.forEach(s => {
    if (s.phone) existingByPhone[s.phone.trim()] = s;
  });

  let newCount = 0;
  let updateCount = 0;
  let skipCount = 0;

  let html = '';
  supplierImportData.forEach((supplier, index) => {
    const existing = supplier.phone ? existingByPhone[supplier.phone.trim()] : null;
    let status, statusColor, statusIcon;

    if (existing) {
      if (supplierImportMode === 'update') {
        status = 'تحديث';
        statusColor = 'var(--warning)';
        statusIcon = '🔄';
        updateCount++;
      } else {
        status = 'تجاهل';
        statusColor = 'var(--text-secondary)';
        statusIcon = '⏭️';
        skipCount++;
      }
    } else {
      status = 'جديد';
      statusColor = 'var(--success)';
      statusIcon = '✨';
      newCount++;
    }

    // تمييز supplier لاستخدامه لاحقاً
    supplier._existing = existing;
    supplier._status = status;

    html += `
      <tr style="border-bottom: 1px solid var(--border); ${existing && supplierImportMode === 'add' ? 'opacity: 0.5;' : ''}">
        <td style="padding: 8px;">
          <span style="display: inline-flex; align-items: center; gap: 4px; padding: 3px 8px; border-radius: 12px; font-size: 11px; background: ${statusColor}20; color: ${statusColor};">
            ${statusIcon} ${status}
          </span>
        </td>
        <td style="padding: 8px; font-weight: 600;">${escapeHtml(supplier.name || '-')}</td>
        <td style="padding: 8px; direction: ltr; font-family: monospace;">${escapeHtml(supplier.phone || '-')}</td>
        <td style="padding: 8px; max-width: 150px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${escapeHtml(supplier.address || '-')}</td>
        <td style="padding: 8px; font-family: monospace;">${supplier.opening_balance || 0}</td>
      </tr>
    `;
  });

  tbody.innerHTML = html;

  // تحديث الإحصائيات
  if (supplierImportMode === 'add') {
    statsEl.innerHTML = `<span style="color: var(--success);">✨ ${newCount} جديد</span> | <span style="color: var(--text-secondary);">⏭️ ${skipCount} تجاهل</span>`;
  } else {
    statsEl.innerHTML = `<span style="color: var(--success);">✨ ${newCount} جديد</span> | <span style="color: var(--warning);">🔄 ${updateCount} تحديث</span>`;
  }
}

function parseSuppliersCSV(content) {
  const lines = content.split('\n').filter(line => line.trim());
  if (lines.length < 2) return [];

  // تجاهل السطر الأول (العناوين)
  const data = [];

  for (let i = 1; i < lines.length; i++) {
    const values = parseSupplierCSVLine(lines[i]);
    if (values.length >= 1 && values[0].trim()) {
      data.push({
        name: values[0]?.trim() || '',
        phone: values[1]?.trim() || '',
        address: values[2]?.trim() || '',
        opening_balance: parseFloat(values[3]) || 0,
        notes: values[4]?.trim() || ''
      });
    }
  }

  return data;
}

function parseSupplierCSVLine(line) {
  const values = [];
  let current = '';
  let inQuotes = false;

  for (let char of line) {
    if (char === '"') {
      inQuotes = !inQuotes;
    } else if (char === ',' && !inQuotes) {
      values.push(current.trim());
      current = '';
    } else {
      current += char;
    }
  }
  values.push(current.trim());

  return values.map(v => v.replace(/^"|"$/g, '').replace(/""/g, '"'));
}

async function executeSuppliersImport() {
  if (supplierImportData.length === 0) {
    showToast('⚠️ لا توجد بيانات للاستيراد', 'warning');
    return;
  }

  const btn = document.getElementById('suppliersImportBtn');
  btn.disabled = true;
  btn.textContent = 'جاري الاستيراد... 0%';

  let addedCount = 0;
  let updatedCount = 0;
  let skippedCount = 0;
  let errorCount = 0;

  for (let i = 0; i < supplierImportData.length; i++) {
    const supplier = supplierImportData[i];
    const existing = supplier._existing;

    try {
      if (existing) {
        // المورد موجود
        if (supplierImportMode === 'update') {
          // تحديث المورد الموجود (الرصيد المستورد = رصيد افتتاحي + رصيد معروض في القائمة بعد النقل)
          const importedBalance = supplier.opening_balance ?? existing.opening_balance ?? 0;
          const response = await fetch('elos-db://suppliers-update', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              id: existing.id,
              name: supplier.name || existing.name,
              phone: supplier.phone || existing.phone,
              address: supplier.address || existing.address,
              notes: supplier.notes || existing.notes,
              opening_balance: importedBalance,
              balance: importedBalance
            })
          });

          if (response.ok) {
            updatedCount++;
          } else {
            errorCount++;
          }
        } else {
          // وضع الإضافة فقط - تجاهل الموجودين
          skippedCount++;
        }
      } else {
        // مورد جديد - إضافة
        const response = await fetch('elos-db://suppliers-add', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name: supplier.name,
            phone: supplier.phone,
            address: supplier.address,
            opening_balance: supplier.opening_balance || 0,
            notes: supplier.notes || ''
          })
        });

        if (response.ok) {
          addedCount++;
        } else {
          errorCount++;
        }
      }
    } catch (error) {
      errorCount++;
    }

    // تحديث نسبة التقدم
    const progress = Math.round(((i + 1) / supplierImportData.length) * 100);
    btn.textContent = `جاري الاستيراد... ${progress}%`;
  }

  btn.textContent = '📥 استيراد البيانات';
  btn.disabled = false;

  // عرض النتائج
  let resultMsg = '';
  if (addedCount > 0) resultMsg += `✅ تم إضافة ${addedCount} مورد جديد. `;
  if (updatedCount > 0) resultMsg += `🔄 تم تحديث ${updatedCount} مورد. `;
  if (skippedCount > 0) resultMsg += `⏭️ تم تجاهل ${skippedCount} مورد موجود. `;
  if (errorCount > 0) resultMsg += `❌ فشل ${errorCount} عملية.`;

  if (addedCount > 0 || updatedCount > 0) {
    showToast(resultMsg.trim(), 'success');
    closeSuppliersImportModal();
    // تحديث قائمة الموردين
    await loadSuppliers();
  } else if (skippedCount > 0 && errorCount === 0) {
    showToast('⚠️ كل الموردين موجودين بالفعل', 'warning');
  } else {
    showToast(resultMsg.trim() || '❌ فشل الاستيراد', 'error');
  }
}

function downloadSuppliersTemplate() {
  const headers = ['الاسم', 'الهاتف', 'العنوان', 'الرصيد الافتتاحي', 'ملاحظات'];
  const sampleData = [
    ['شركة التقنية', '01012345678', 'القاهرة', '0', 'مورد أجهزة'],
    ['مؤسسة النور', '01098765432', 'الإسكندرية', '5000', 'مورد اكسسوارات']
  ];

  let csv = headers.join(',') + '\n';
  sampleData.forEach(row => {
    csv += row.map(v => `"${v}"`).join(',') + '\n';
  });

  const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = 'نموذج_استيراد_الموردين.csv';
  link.click();

  showToast('✅ تم تحميل النموذج', 'success');
}

// تصدير دوال الاستيراد والتصدير
window.exportSuppliersToCSV = exportSuppliersToCSV;
window.openSuppliersImportModal = openSuppliersImportModal;
window.closeSuppliersImportModal = closeSuppliersImportModal;
window.handleSuppliersImportFile = handleSuppliersImportFile;
window.executeSuppliersImport = executeSuppliersImport;
window.downloadSuppliersTemplate = downloadSuppliersTemplate;
