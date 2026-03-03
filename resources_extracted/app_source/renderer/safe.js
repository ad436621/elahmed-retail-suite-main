// safe.js - إدارة الخزنة المطورة v2.0
// متكامل مع نظام تقفيلات الشفت

const SAFE_TRANSFER_TYPE_NAMES = {
  vodafone_cash: 'فودافون كاش',
  etisalat_cash: 'اتصالات كاش',
  orange_cash: 'اورنج كاش',
  we_pay: 'وي باي',
  instapay: 'انستاباي',
  other: 'أخرى'
};
const SAFE_TRANSFER_TYPE_COLORS = {
  vodafone_cash: '#ef4444', etisalat_cash: '#22c55e', orange_cash: '#f97316',
  we_pay: '#8b5cf6', instapay: '#3b82f6', other: '#64748b'
};

// Fallbacks if utils.js not loaded yet
if (!window.Logger) window.Logger = { log: () => {}, warn: () => {}, error: console.error, debug: () => {}, info: () => {} };
if (!window.fmt) window.fmt = (n, decimals = 2) => Number(n || 0).toLocaleString('en-US', { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
if (!window.escapeHtml) window.escapeHtml = (text) => { if (text === null || text === undefined) return ''; const div = document.createElement('div'); div.textContent = String(text); return div.innerHTML; };
const fmt = window.fmt;
const escapeHtml = window.escapeHtml;

let transactions = [];
let shiftClosings = [];
let repairClosings = [];
let flowChart = null;
let expensesChart = null;
let walletBalances = { cash: 0, mobile_wallet: 0, bank: 0 };
let paymentWallets = []; // ✅ المحافظ الفعلية من قاعدة البيانات
let individualWalletBalances = []; // ✅ أرصدة المحافظ الفردية من safe-balance API

// Wallet Configuration
const WALLET_CONFIG = {
  cash: { name: 'كاش سائل', icon: '💵', color: 'var(--success)' },
  mobile_wallet: { name: 'محفظة إلكترونية', icon: '📱', color: 'var(--purple)' },
  bank: { name: 'حساب بنكي', icon: '🏦', color: 'var(--accent)' }
};

// ✅ فئات/أنواع لا تُحسب كمصروفات تشغيلية (مرتجعات، تحويلات درج، عجز كاش، سحب رأس مال، إلخ)
const EXPENSE_EXCLUDED_KEYS = [
  'مرتجعات مبيعات', 'عجز كاش', 'تحويل لدرج الكاش', 'مسحوبات درج الكاش', 'سحب لدرج الكاش',
  'سحب لمرتجع', 'سحب', 'فائض سحب للدرج', 'زيادة كاش',
  'to_cash_drawer', 'drawer_transfer'
];
function isExpenseExcluded(t) {
  const key = String(t.sub_type || t.category || '').trim();
  if (!key) return false;
  // ✅ FIX: استخدام some + startsWith بدل includes (exact match)
  // لأن الفئات تأتي بلاحقات مثل "مرتجعات مبيعات (نقدي)" لكن القائمة فيها "مرتجعات مبيعات"
  return EXPENSE_EXCLUDED_KEYS.some(ex => key === ex || key.startsWith(ex + ' ') || key.startsWith(ex + '('));
}

// ✅ مصروف خسارة = مصروفات تشغيلية + سحب شخصي + رواتب + فئات مصروفات الدرج (إيجار، كهرباء، إلخ). الباقي = سحب عادي
var REAL_EXPENSE_KEYS = [
  'operating_expense', 'مصروفات تشغيلية',
  'owner_withdrawal', 'سحب شخصي', 'مسحوبات المالك',
  'salary', 'رواتب',
  // فئات سحب/مصروف من درج الكاش عند التقفيل (كلها مصروف خسارة)
  'أكل ومشروبات', 'مواصلات', 'مصروف يومي', 'كهرباء', 'مياه', 'إنترنت', 'إيجار', 'صيانة',
  'أدوات مكتبية', 'مستلزمات', 'أخرى'
];
function isRealExpense(t) {
  const type = t.type;
  if (type !== 'expense' && type !== 'withdrawal') return false;
  const key = String(t.sub_type || t.category || '').trim();
  return REAL_EXPENSE_KEYS.some(function(k) { return k === key; });
}

// ═══════════════════════════════════════
// 💳 PAYMENT WALLETS MANAGEMENT
// ═══════════════════════════════════════
async function loadPaymentWallets() {
  try {
    // ✅ مزامنة المحافظ للحسابات البنكية أولاً (إنشاء محافظ للحسابات التي ليس لها محافظ)
    try {
      await fetch('elos-db://bank-accounts/sync-wallets', { method: 'POST' });
    } catch (syncErr) {
      Logger.warn('Bank accounts sync error (non-critical):', syncErr);
    }

    const res = await fetch('elos-db://payment-wallets?active_only=true');
    if (!res.ok) throw new Error(await res.text());
    paymentWallets = await res.json();
    return paymentWallets;
  } catch (error) {
    Logger.error('Failed to load payment wallets:', error);
    return [];
  }
}

// Update wallets list when deposit wallet type changes
async function updateDepositWalletsList() {
  const walletTypeSelect = document.getElementById('depositWallet');
  const walletSelectGroup = document.getElementById('depositWalletSelectGroup');
  const walletSelect = document.getElementById('depositWalletSelect');
  
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

// Update wallets list when withdraw wallet type changes
async function updateWithdrawWalletsList() {
  const walletTypeSelect = document.getElementById('withdrawWallet');
  const walletSelectGroup = document.getElementById('withdrawWalletSelectGroup');
  const walletSelect = document.getElementById('withdrawWalletSelect');
  
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

// ✅ Update wallets list when transfer FROM wallet type changes
async function updateTransferFromWalletsList() {
  const walletTypeSelect = document.getElementById('transferFrom');
  const walletSelectGroup = document.getElementById('transferFromWalletSelectGroup');
  const walletSelect = document.getElementById('transferFromWalletId');
  
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
    return;
  }
  
  // Show the select and populate options
  walletSelectGroup.style.display = 'block';
  walletSelect.innerHTML = filteredWallets.map(w => {
    const isDefault = w.is_default ? ' (افتراضي)' : '';
    const displayName = w.name + isDefault;
    return `<option value="${w.id}" ${w.is_default ? 'selected' : ''}>${displayName}</option>`;
  }).join('');
  
  // Trigger balance update
  onTransferFromChange();
}

// ✅ Update wallets list when transfer TO wallet type changes
async function updateTransferToWalletsList() {
  const walletTypeSelect = document.getElementById('transferTo');
  const walletSelectGroup = document.getElementById('transferToWalletSelectGroup');
  const walletSelect = document.getElementById('transferToWalletId');
  
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
    return;
  }
  
  // Show the select and populate options
  walletSelectGroup.style.display = 'block';
  walletSelect.innerHTML = filteredWallets.map(w => {
    const isDefault = w.is_default ? ' (افتراضي)' : '';
    const displayName = w.name + isDefault;
    return `<option value="${w.id}" ${w.is_default ? 'selected' : ''}>${displayName}</option>`;
  }).join('');
  
  // Trigger balance update
  onTransferToChange();
}

// Make functions available globally
window.updateDepositWalletsList = updateDepositWalletsList;
window.updateWithdrawWalletsList = updateWithdrawWalletsList;
window.updateTransferFromWalletsList = updateTransferFromWalletsList;
window.updateTransferToWalletsList = updateTransferToWalletsList;

// ═══════════════════════════════════════
// 🚀 Initialize
// ═══════════════════════════════════════
(async function init() {
  Logger.log('💰 Safe Management v2.0 - Initializing...');

  initClock();
  initModalCloseHandlers();

  // Load payment wallets
  await loadPaymentWallets();

  await loadBalance();
  await loadTransactions();
  await loadShiftClosings();
  await loadRepairClosings();

  initCharts();
  calculateStats();

  // ✅ تحديث البيانات عند العودة للصفحة
  document.addEventListener('visibilitychange', async () => {
    if (document.visibilityState === 'visible') {
      Logger.log('[SAFE] Page became visible - refreshing data...');
      paymentWallets = []; // مسح cache المحافظ
      await loadPaymentWallets();
      await loadBalance();
      await loadTransactions();
      await loadRepairClosings();
    }
  });

  // ✅ تحديث البيانات عند focus على النافذة
  window.addEventListener('focus', async () => {
    Logger.log('[SAFE] Window focused - refreshing data...');
    paymentWallets = []; // مسح cache المحافظ
    await loadPaymentWallets();
    await loadBalance();
  });

  Logger.log('✅ Safe Management Ready!');
})();

// ═══════════════════════════════════════
// 💰 Load Balance
// ═══════════════════════════════════════
async function loadBalance() {
  try {
    const res = await fetch('elos-db://safe-balance');
    if (!res.ok) throw new Error(await res.text());

    const data = await res.json();

    const balance = Number(data.balance || 0);
    const deposits = Number(data.deposits || 0);
    const withdrawals = Number(data.withdrawals || 0);
    const netFlow = Number(data.netFlow || 0);

    // ✅ تحديث عرض المحافظ - دعم النظام الجديد (wallets array) والقديم (grouped by type)
    if (data.wallets) {
      // النظام الجديد: wallets as array - عرض كل محفظة بشكل منفصل
      if (Array.isArray(data.wallets) && data.wallets.length > 0) {
        Logger.log('[SAFE] Loading balances for', data.wallets.length, 'wallets');
        Logger.log('[SAFE] Wallet balances:', data.wallets.map(w => ({ id: w.id, name: w.name, balance: w.balance })));
        // حفظ أرصدة المحافظ الفردية
        individualWalletBalances = data.wallets;
        // عرض جميع المحافظ الفعلية
        renderWalletsCards(data.wallets);
        
        // حساب الأرصدة المجمعة للتوافق العكسي
        const walletsByType = { cash: 0, mobile_wallet: 0, bank: 0 };
        data.wallets.forEach(w => {
          if (walletsByType.hasOwnProperty(w.type)) {
            walletsByType[w.type] += Number(w.balance || 0);
          }
        });
        walletBalances.cash = walletsByType.cash;
        walletBalances.mobile_wallet = walletsByType.mobile_wallet;
        walletBalances.bank = walletsByType.bank;
      } 
      // النظام القديم: wallets grouped by type - للتوافق العكسي
      else if (data.wallets.cash || data.wallets.mobile_wallet || data.wallets.bank) {
        walletBalances.cash = Number(data.wallets.cash?.balance || 0);
        walletBalances.mobile_wallet = Number(data.wallets.mobile_wallet?.balance || 0);
        walletBalances.bank = Number(data.wallets.bank?.balance || 0);

        // عرض المحافظ الثلاثة القديمة (للتوافق العكسي)
        const legacyWallets = [
          { id: 'cash', name: 'كاش سائل', type: 'cash', balance: walletBalances.cash, is_default: true },
          { id: 'mobile_wallet', name: 'محفظة إلكترونية', type: 'mobile_wallet', balance: walletBalances.mobile_wallet, is_default: false },
          { id: 'bank', name: 'حساب بنكي', type: 'bank', balance: walletBalances.bank, is_default: false }
        ];
        renderWalletsCards(legacyWallets);
      }
    }

    // Update main balance display
    var totalBalanceEl = document.getElementById('totalBalance');
    if (totalBalanceEl) {
      totalBalanceEl.textContent = balance.toLocaleString('en-US', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
      });
    }

    var totalDepositsEl = document.getElementById('totalDeposits');
    if (totalDepositsEl) {
      totalDepositsEl.textContent = deposits.toLocaleString();
    }

    var totalWithdrawalsEl = document.getElementById('totalWithdrawals');
    if (totalWithdrawalsEl) {
      totalWithdrawalsEl.textContent = withdrawals.toLocaleString();
    }

    const netFlowEl = document.getElementById('netFlow');
    if (netFlowEl) {
      netFlowEl.textContent = (netFlow >= 0 ? '+' : '') + netFlow.toLocaleString();
      netFlowEl.className = `balance-stat-value ${netFlow >= 0 ? 'positive' : 'negative'}`;
    }

    // Update header balance
    const headerBalanceEl = document.getElementById('headerBalance');
    if (headerBalanceEl) {
      if (balance >= 1000000) {
        headerBalanceEl.textContent = (balance / 1000000).toFixed(1) + 'M';
      } else if (balance >= 1000) {
        headerBalanceEl.textContent = (balance / 1000).toFixed(0) + 'k';
      } else {
        headerBalanceEl.textContent = balance.toFixed(0);
      }
    }

  } catch (error) {
    Logger.error('Error loading balance:', error);
    showToast('خطأ في تحميل الرصيد', 'error');
  }
}

// ✅ متغير لتخزين الفلتر الحالي
let currentWalletFilter = 'all';
let allWallets = [];

// ═══════════════════════════════════════════════════════════════
// Drag & Drop لبطاقات المحافظ في الخزينة الرئيسية
// ═══════════════════════════════════════════════════════════════

function getSafeWalletCardOrder() {
  try {
    const saved = localStorage.getItem('safeWalletCardOrder');
    return saved ? JSON.parse(saved) : null;
  } catch (e) {
    return null;
  }
}

function saveSafeWalletCardOrder(orderArray) {
  try {
    localStorage.setItem('safeWalletCardOrder', JSON.stringify(orderArray));
  } catch (e) {
    console.error('[SAFE-DND] Failed to save wallet order:', e);
  }
}

function sortSafeWalletsByOrder(wallets, savedOrder) {
  if (!savedOrder || savedOrder.length === 0) return wallets;

  const orderMap = {};
  savedOrder.forEach((id, index) => { orderMap[id] = index; });

  const sorted = [];
  const unsorted = [];

  wallets.forEach(w => {
    if (orderMap[w.id] !== undefined) {
      sorted.push(w);
    } else {
      unsorted.push(w);
    }
  });

  sorted.sort((a, b) => orderMap[a.id] - orderMap[b.id]);
  return [...sorted, ...unsorted];
}

let _draggedSafeWalletCard = null;

function initSafeWalletDragDrop() {
  const container = document.getElementById('walletsGrid');
  if (!container) return;

  const cards = container.querySelectorAll('.wallet-card[draggable="true"]');

  cards.forEach(card => {
    card.addEventListener('dragstart', (e) => {
      _draggedSafeWalletCard = card;
      card.classList.add('dragging');
      container.classList.add('drag-active');
      e.dataTransfer.effectAllowed = 'move';
      e.dataTransfer.setData('text/plain', card.dataset.walletId);
    });

    card.addEventListener('dragend', () => {
      card.classList.remove('dragging');
      container.classList.remove('drag-active');
      container.querySelectorAll('.drag-over').forEach(el => el.classList.remove('drag-over'));
      _draggedSafeWalletCard = null;
    });

    card.addEventListener('dragover', (e) => {
      e.preventDefault();
      e.dataTransfer.dropEffect = 'move';
      if (_draggedSafeWalletCard && card !== _draggedSafeWalletCard) {
        card.classList.add('drag-over');
      }
    });

    card.addEventListener('dragleave', () => {
      card.classList.remove('drag-over');
    });

    card.addEventListener('drop', (e) => {
      e.preventDefault();
      card.classList.remove('drag-over');

      if (!_draggedSafeWalletCard || card === _draggedSafeWalletCard) return;

      const allCards = [...container.querySelectorAll('.wallet-card')];
      const draggedIndex = allCards.indexOf(_draggedSafeWalletCard);
      const targetIndex = allCards.indexOf(card);

      if (draggedIndex < targetIndex) {
        card.after(_draggedSafeWalletCard);
      } else {
        card.before(_draggedSafeWalletCard);
      }

      // حفظ الترتيب الجديد
      const newOrder = [...container.querySelectorAll('.wallet-card')].map(c => Number(c.dataset.walletId));
      saveSafeWalletCardOrder(newOrder);
      console.log('[SAFE-DND] New order saved:', newOrder);
    });
  });
}

// ═══════════════════════════════════════════════════════════════

// ✅ عرض جميع المحافظ الفعلية كبطاقات منفصلة
function renderWalletsCards(wallets) {
  const container = document.getElementById('walletsGrid');
  if (!container) return;

  // حفظ جميع المحافظ
  allWallets = wallets || [];

  // ✅ ترتيب المحافظ حسب الترتيب المحفوظ (drag & drop)
  const savedOrder = getSafeWalletCardOrder();
  allWallets = sortSafeWalletsByOrder(allWallets, savedOrder);

  // تطبيق الفلتر
  let filteredWallets = allWallets;
  if (currentWalletFilter !== 'all') {
    filteredWallets = allWallets.filter(w => w.type === currentWalletFilter);
  }

  // تحديث عدادات التابات
  updateWalletTabCounts();

  // تحديث ملخص الأرصدة
  updateWalletsSummary();

  if (!filteredWallets || filteredWallets.length === 0) {
    container.innerHTML = `
      <div style="grid-column: 1 / -1; text-align: center; padding: 40px; color: var(--text-secondary);">
        <div style="font-size: 24px; margin-bottom: 10px;">—</div>
        <div>لا توجد محافظ ${currentWalletFilter !== 'all' ? 'من هذا النوع' : 'متاحة'}</div>
        <div style="margin-top: 10px; font-size: 12px;">يمكنك إضافة محافظ من زر "إدارة المحافظ"</div>
      </div>
    `;
    return;
  }

  // إضافة كلاس compact إذا كان عدد المحافظ كبير
  if (filteredWallets.length > 8) {
    container.classList.add('compact');
  } else {
    container.classList.remove('compact');
  }

  // تسميات أنواع المحافظ
  const walletTypeLabels = {
    cash: 'كاش',
    mobile_wallet: 'محفظة إلكترونية',
    bank: 'حساب بنكي'
  };
  const currency = (JSON.parse(localStorage.getItem('appSettings') || '{}')).currency || 'ج.م';

  let html = '';

  filteredWallets.forEach(wallet => {
    const balance = Number(wallet.balance || 0);
    const typeLabel = walletTypeLabels[wallet.type] || wallet.type;

    html += `
      <div class="wallet-card" draggable="true" data-wallet-id="${wallet.id}" data-wallet-type="${wallet.type}">
        <div class="wallet-header">
          <span class="wallet-drag-handle" title="اسحب لإعادة الترتيب">⠿</span>
          <div class="wallet-info">
            <div class="wallet-name">${escapeHtml(wallet.name)}${wallet.is_default ? ' (افتراضي)' : ''}</div>
            <div class="wallet-type-label">${typeLabel}</div>
          </div>
        </div>
        <div class="wallet-balance">
          <span class="wallet-amount" data-wallet-balance="${wallet.id}">${fmt(balance)}</span>
          <span class="wallet-currency">${currency}</span>
        </div>
        <div class="wallet-actions">
          <button class="wallet-btn deposit" onclick="openDepositModalById(${wallet.id})">
            <span>إيداع</span>
          </button>
          <button class="wallet-btn withdraw" onclick="openWithdrawModalById(${wallet.id})">
            <span>سحب</span>
          </button>
          <button class="wallet-btn transfer" onclick="openTransferModalFromWallet(${wallet.id})">
            <span>تحويل</span>
          </button>
          <button class="wallet-btn history" onclick="openWalletHistoryById(${wallet.id})">
            <span>كشف</span>
          </button>
        </div>
      </div>
    `;
  });

  container.innerHTML = html;

  // ✅ تفعيل Drag & Drop
  initSafeWalletDragDrop();
}

// تحديث عدادات التابات
function updateWalletTabCounts() {
  const tabs = document.querySelectorAll('#walletsTabs .wallet-tab');
  const counts = {
    all: allWallets.length,
    cash: allWallets.filter(w => w.type === 'cash').length,
    mobile_wallet: allWallets.filter(w => w.type === 'mobile_wallet').length,
    bank: allWallets.filter(w => w.type === 'bank').length
  };

  tabs.forEach(tab => {
    const filter = tab.dataset.filter;
    const count = counts[filter] || 0;
    // يمكن إضافة العدد للتاب إذا أردت
  });
}

// تحديث ملخص الأرصدة
function updateWalletsSummary() {
  let totalCash = 0, totalMobile = 0, totalBank = 0;

  allWallets.forEach(w => {
    const balance = Number(w.balance || 0);
    if (w.type === 'cash') totalCash += balance;
    else if (w.type === 'mobile_wallet') totalMobile += balance;
    else if (w.type === 'bank') totalBank += balance;
  });

  const total = totalCash + totalMobile + totalBank;

  const totalEl = document.getElementById('totalBalance');
  const cashEl = document.getElementById('totalCash');
  const mobileEl = document.getElementById('totalMobile');
  const bankEl = document.getElementById('totalBank');

  if (totalEl) totalEl.textContent = fmt(total);
  if (cashEl) cashEl.textContent = fmt(totalCash);
  if (mobileEl) mobileEl.textContent = fmt(totalMobile);
  if (bankEl) bankEl.textContent = fmt(totalBank);
}

// تبديل فلتر المحافظ
function filterWallets(filter) {
  currentWalletFilter = filter;

  // تحديث التابات
  document.querySelectorAll('#walletsTabs .wallet-tab').forEach(tab => {
    tab.classList.toggle('active', tab.dataset.filter === filter);
  });

  // إعادة عرض المحافظ
  renderWalletsCards(allWallets);
}

// إعداد أحداث التابات
document.addEventListener('DOMContentLoaded', function() {
  const tabs = document.querySelectorAll('#walletsTabs .wallet-tab');
  tabs.forEach(tab => {
    tab.addEventListener('click', () => filterWallets(tab.dataset.filter));
  });
});

// Update individual wallet card display (للتوافق العكسي)
function updateWalletCard(walletType, balance) {
  // Map wallet types to their HTML element IDs
  const elementIds = {
    cash: 'cashBalance',
    mobile_wallet: 'mobileWalletBalance',
    bank: 'bankBalance'
  };

  const balanceEl = document.getElementById(elementIds[walletType]);
  if (balanceEl) {
    balanceEl.textContent = balance.toLocaleString('en-US', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    });
  }
}

// ═══════════════════════════════════════
// 📊 Load Transactions
// ═══════════════════════════════════════
async function loadTransactions() {
  try {
    const typeFilter = document.getElementById('typeFilter')?.value || '';
    const dateFrom = document.getElementById('dateFromFilter')?.value || '';
    const dateTo = document.getElementById('dateToFilter')?.value || '';
    
    let url = 'elos-db://safe-transactions';
    const params = [];
    
    if (typeFilter) params.push(`type=${encodeURIComponent(typeFilter)}`);
    if (dateFrom) params.push(`from=${encodeURIComponent(dateFrom)}`);
    if (dateTo) params.push(`to=${encodeURIComponent(dateTo)}`);
    
    if (params.length > 0) url += '?' + params.join('&');
    
    const res = await fetch(url);
    if (!res.ok) throw new Error(await res.text());
    
    transactions = await res.json();
    
    renderRecentTransactions();
    renderTransactionsTable();
    calculateStats();
    
  } catch (error) {
    Logger.error('Error loading transactions:', error);
    showToast('خطأ في تحميل المعاملات', 'error');
  }
}

// ═══════════════════════════════════════
// 🔐 Load Shift Closings
// ═══════════════════════════════════════
async function loadShiftClosings() {
  try {
    const res = await fetch('elos-db://shift-closings?limit=50');
    if (!res.ok) throw new Error(await res.text());
    
    shiftClosings = await res.json();
    
    renderShiftClosingsList();
    renderShiftClosingsTable();
    
    // Update header count
    const headerShiftsEl = document.getElementById('headerShiftsCount');
    if (headerShiftsEl) {
      headerShiftsEl.textContent = shiftClosings.length;
    }

    // تحديث عدد نقطة البيع في التاب
    const posCountEl = document.getElementById('posClosingsCount');
    if (posCountEl) posCountEl.textContent = shiftClosings.length;
    
  } catch (error) {
    Logger.error('Error loading shift closings:', error);
    // Not critical, just log
  }
}

// ═══════════════════════════════════════
// 📋 Render Recent Transactions
// ═══════════════════════════════════════
function renderRecentTransactions() {
  const container = document.getElementById('recentTransactionsList');
  if (!container) return;
  
  if (!transactions || transactions.length === 0) {
    container.innerHTML = `
      <div class="empty-state">
        <div class="empty-state-icon">💰</div>
        <div>لا توجد معاملات حالياً</div>
      </div>
    `;
    return;
  }
  
  const recentTx = transactions.slice(0, 6);
  
  container.innerHTML = recentTx.map(t => {
    const isIncome = ['deposit', 'sale'].includes(t.type);
    const amountClass = isIncome ? 'income' : 'expense';
    const amountSign = isIncome ? '+' : '-';
    const icon = getTransactionIcon(t.type);
    const iconClass = t.type;
    
    // ✅ جلب اسم المحفظة إذا كان wallet_id موجوداً
    let walletName = '';
    if (t.wallet_id && paymentWallets.length > 0) {
      const wallet = paymentWallets.find(w => w.id == t.wallet_id);
      if (wallet) {
        walletName = wallet.name;
      }
    } else if (t.wallet_type && WALLET_CONFIG[t.wallet_type]) {
      // Fallback للتوافق العكسي
      walletName = WALLET_CONFIG[t.wallet_type].name;
    }
    
    // إضافة اسم المحفظة للوصف إذا كان موجوداً
    let description = escapeHtml(t.description || 'لا يوجد وصف');
    if (walletName) {
      description = `<span style="color: var(--text-secondary); font-size: 11px;">💼 ${escapeHtml(walletName)}</span><br>${description}`;
    }
    
    return `
      <div class="transaction-item" onclick="openTransactionsModal()">
        <div class="transaction-icon ${iconClass}">${icon}</div>
        <div class="transaction-info">
          <div class="transaction-category">${escapeHtml(t.category || getTypeLabel(t.type))}</div>
          <div class="transaction-desc">${description}</div>
        </div>
        <div class="transaction-amount-wrapper">
          <div class="transaction-amount ${amountClass}">
            ${amountSign}${Number(t.amount || 0).toLocaleString()}
          </div>
          <div class="transaction-date">${formatDateShort(t.created_at)}</div>
        </div>
      </div>
    `;
  }).join('');
}

// ═══════════════════════════════════════
// 📋 Render Transactions Table
// ═══════════════════════════════════════
function renderTransactionsTable() {
  const tbody = document.getElementById('transactionsTableBody');
  if (!tbody) return;
  
  if (!transactions || transactions.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="8" class="empty-state">
          <div class="empty-state-icon">💰</div>
          <div>لا توجد معاملات</div>
        </td>
      </tr>
    `;
    return;
  }
  
  tbody.innerHTML = transactions.map((t, idx) => {
    const isIncome = ['deposit', 'sale'].includes(t.type);
    const amountColor = isIncome ? 'var(--success)' : 'var(--danger)';
    const amountSign = isIncome ? '+' : '-';
    
    // ✅ جلب اسم المحفظة إذا كان wallet_id موجوداً
    let walletName = '-';
    if (t.wallet_id && paymentWallets.length > 0) {
      const wallet = paymentWallets.find(w => w.id == t.wallet_id);
      if (wallet) {
        walletName = wallet.name;
      }
    } else if (t.wallet_type && WALLET_CONFIG[t.wallet_type]) {
      // Fallback للتوافق العكسي
      walletName = WALLET_CONFIG[t.wallet_type].name;
    }
    
    return `
      <tr>
        <td>${idx + 1}</td>
        <td><span class="type-badge ${t.type}">${getTypeLabel(t.type)}</span></td>
        <td style="color: ${amountColor}; font-weight: 700;">
          ${amountSign} ${Number(t.amount || 0).toLocaleString()}
        </td>
        <td>${escapeHtml(t.category || '-')}</td>
        <td>${escapeHtml(t.description || '-')}</td>
        <td style="font-size: 12px; color: var(--text-secondary);">${escapeHtml(walletName)}</td>
        <td>${formatDate(t.created_at)}</td>
        <td style="text-align: center;">
          <button class="btn-icon-delete" onclick="deleteSafeTransaction(${t.id})" title="حذف المعاملة">
            🗑️
          </button>
        </td>
      </tr>
    `;
  }).join('');
}

// ═══════════════════════════════════════
// 🔐 Render Shift Closings List
// ═══════════════════════════════════════
function renderShiftClosingsList() {
  const container = document.getElementById('shiftClosingsList');
  if (!container) return;
  
  if (!shiftClosings || shiftClosings.length === 0) {
    container.innerHTML = `
      <div class="empty-state">
        <div class="empty-state-icon">🔐</div>
        <div>لا توجد تقفيلات حالياً</div>
      </div>
    `;
    return;
  }
  
  const recentClosings = shiftClosings.slice(0, 5);
  
  container.innerHTML = recentClosings.map(s => {
    const diff = Number(s.cash_difference || 0);
    let diffClass = 'zero';
    let diffText = 'متطابق';
    
    if (diff > 0) {
      diffClass = 'positive';
      diffText = `+${diff.toLocaleString()} زيادة`;
    } else if (diff < 0) {
      diffClass = 'negative';
      diffText = `${diff.toLocaleString()} عجز`;
    }
    
    // ✅ v1.2.5: عرض اسم الكاشير
    const cashierName = s.closed_by || 'غير محدد';

    return `
      <div class="shift-closing-item" onclick="openShiftDetails(${s.id})">
        <div class="shift-closing-icon">🔐</div>
        <div class="shift-closing-info">
          <div class="shift-closing-date">${formatDate(s.closed_at)} <span style="color: var(--warning); font-size: 12px; font-weight: 600;">• ${cashierName}</span></div>
          <div class="shift-closing-details">
            <div class="shift-closing-detail">
              <span>🧾</span>
              <span>${s.sales_count || 0} مبيعات</span>
            </div>
            <div class="shift-closing-detail">
              <span>📥</span>
              <span>${s.deposits_count || 0} إيداع</span>
            </div>
            <div class="shift-closing-detail">
              <span>📤</span>
              <span>${s.withdraws_count || 0} سحب</span>
            </div>
          </div>
        </div>
        <div class="shift-closing-amount">
          <div class="shift-closing-total">${Number(s.total_to_safe || 0).toLocaleString()}</div>
          <div class="shift-closing-diff ${diffClass}">${diffText}</div>
        </div>
      </div>
    `;
  }).join('');
}

// ═══════════════════════════════════════
// 🔐 Render Shift Closings Table
// ═══════════════════════════════════════
function renderShiftClosingsTable() {
  const tbody = document.getElementById('shiftClosingsTableBody');
  if (!tbody) return;
  
  if (!shiftClosings || shiftClosings.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="9" class="empty-state">
          <div class="empty-state-icon">🔐</div>
          <div>لا توجد تقفيلات</div>
        </td>
      </tr>
    `;
    return;
  }
  
  tbody.innerHTML = shiftClosings.map((s, idx) => {
    const diff = Number(s.cash_difference || 0);
    let diffColor = 'var(--text-secondary)';
    let diffText = '0';

    if (diff > 0) {
      diffColor = 'var(--success)';
      diffText = `+${diff.toLocaleString()}`;
    } else if (diff < 0) {
      diffColor = 'var(--danger)';
      diffText = diff.toLocaleString();
    }

    // ✅ v1.2.5: عرض اسم الكاشير
    const cashierName = s.closed_by || 'غير محدد';

    return `
      <tr onclick="openShiftDetails(${s.id})" style="cursor:pointer;">
        <td>${idx + 1}</td>
        <td>${formatDate(s.closed_at)}</td>
        <td style="color: var(--warning); font-weight: 600;">${cashierName}</td>
        <td style="color: var(--accent);">${Number(s.sales_total || 0).toLocaleString()}</td>
        <td style="color: var(--success);">${Number(s.deposits_total || 0).toLocaleString()}</td>
        <td style="color: var(--danger);">${Number(s.withdraws_total || 0).toLocaleString()}</td>
        <td>${Number(s.expected_cash || 0).toLocaleString()}</td>
        <td>${Number(s.actual_cash || 0).toLocaleString()}</td>
        <td style="color: ${diffColor}; font-weight: 700;">${diffText}</td>
      </tr>
    `;
  }).join('');
}

// ═══════════════════════════════════════
// 📊 Calculate Stats
// ═══════════════════════════════════════
function calculateStats() {
  const today = new Date();
  // ✅ FIX: استخدام التاريخ المحلي بدلاً من UTC (toISOString يحول لـ UTC → تاريخ خاطئ بين 12-2 صباحاً في GMT+2)
  const todayStr = today.getFullYear() + '-' +
    String(today.getMonth() + 1).padStart(2, '0') + '-' +
    String(today.getDate()).padStart(2, '0');

  let todayDeposits = 0;
  let todayExpensesOnly = 0;
  let todayWithdrawals = 0;
  let todayPurchases = 0;
  let todayCount = 0;

  Logger.log('[STATS] Today:', todayStr, 'Transactions count:', transactions.length);

  if (transactions.length > 0) {
    Logger.log('[STATS] Sample transactions:', transactions.slice(0, 3).map(t => ({
      type: t.type,
      amount: t.amount,
      created_at: t.created_at,
      extracted_date: (t.created_at || '').substring(0, 10)
    })));
  }

  transactions.forEach(t => {
    const txDateStr = (t.created_at || '').substring(0, 10);

    if (txDateStr === todayStr) {
      const amount = Number(t.amount || 0);
      const isInternalTransfer = t.type === 'transfer' || t.sub_type === 'internal_transfer';

      if (isInternalTransfer) return;

      todayCount++;

      if (['deposit', 'sale'].includes(t.type)) {
        todayDeposits += amount;
      } else if (t.type === 'withdrawal' || t.type === 'expense' || t.type === 'purchase') {
        // ✅ المشتريات = مسحوبات وليست مصروفات
        if (t.type === 'purchase') {
          todayWithdrawals += amount;
          todayPurchases += amount;
        } else if (!isExpenseExcluded(t)) {
          todayExpensesOnly += amount;
        } else {
          // ✅ المسحوبات تشمل withdrawal/expense المستبعدة (مثل المرتجعات)
          todayWithdrawals += amount;
        }
      }
    }
  });

  const todayTotalOut = todayExpensesOnly + todayWithdrawals;
  Logger.log('[STATS] Today deposits:', todayDeposits, 'expenses:', todayExpensesOnly, 'withdrawals:', todayWithdrawals, 'purchases:', todayPurchases, 'count:', todayCount);

  // Update today stats
  document.getElementById('todayDeposits').textContent = todayDeposits.toLocaleString();
  document.getElementById('todayWithdrawals').textContent = todayWithdrawals.toLocaleString();
  document.getElementById('todayExpenses').textContent = todayExpensesOnly.toLocaleString();
  document.getElementById('headerTodayCount').textContent = todayCount;

  // تقفيلات اليوم: مقارنة تاريخ التقفيل (أول 10 أحرف YYYY-MM-DD) مع تاريخ اليوم
  const todayStart = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  let todayClosingsCount = 0;
  let todayShiftTotal = 0;
  shiftClosings.forEach(s => {
    const closedAtStr = (s.closed_at || '').substring(0, 10);
    if (closedAtStr === todayStr) {
      todayClosingsCount++;
      todayShiftTotal += Number(s.total_to_safe || 0);
    }
  });
  document.getElementById('todayShiftTotal').textContent = todayClosingsCount.toLocaleString();

  // صافي اليوم = إيداعات - (مصروفات + مسحوبات + مشتريات)
  const todayNet = todayDeposits - todayTotalOut;
  document.getElementById('predictedBalance').textContent = todayNet.toLocaleString();

  // Calculate predictions for trends
  calculatePredictions();
}

// ═══════════════════════════════════════
// 🔮 Calculate Predictions
// ═══════════════════════════════════════
function calculatePredictions() {
  const now = new Date();
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
  
  let periodDeposits = 0;
  let periodExpenses = 0;
  let daysWithData = new Set();
  
  transactions.forEach(t => {
    const txDate = new Date(t.created_at);
    if (txDate >= thirtyDaysAgo) {
      daysWithData.add(txDate.toDateString());
      const amount = Number(t.amount || 0);
      
      if (['deposit', 'sale'].includes(t.type)) {
        periodDeposits += amount;
      } else {
        periodExpenses += amount;
      }
    }
  });
  
  const activeDays = Math.max(1, daysWithData.size);
  const avgDailyFlow = (periodDeposits - periodExpenses) / activeDays;
  
  // Get current balance
  const balanceText = document.getElementById('totalBalance')?.textContent || '0';
  const currentBalance = parseFloat(balanceText.replace(/,/g, '')) || 0;
  
  // Note: predictedBalance element now shows "صافي اليوم" (today's net)
  // calculated in calculateStats() - not the 30-day prediction

  // Update trends (simplified)
  const depositTrendEl = document.getElementById('depositTrend');
  const expenseTrendEl = document.getElementById('expenseTrend');
  
  if (avgDailyFlow > 0) {
    depositTrendEl.textContent = '↑ نمو';
    depositTrendEl.className = 'stat-card-trend up';
  } else {
    depositTrendEl.textContent = '↓ تراجع';
    depositTrendEl.className = 'stat-card-trend down';
  }
  
  if (periodExpenses > periodDeposits * 0.8) {
    expenseTrendEl.textContent = '↑ مرتفع';
    expenseTrendEl.className = 'stat-card-trend down';
  } else {
    expenseTrendEl.textContent = '↓ معتدل';
    expenseTrendEl.className = 'stat-card-trend up';
  }
}

// ═══════════════════════════════════════
// 📈 Initialize Charts
// ═══════════════════════════════════════
function initCharts() {
  initFlowChart();
  initExpensesChart();
}

function initFlowChart() {
  const ctx = document.getElementById('flowChart')?.getContext('2d');
  if (!ctx) return;
  
  // Get last 7 days data
  const days = [];
  const deposits = [];
  const expenses = [];
  
  for (let i = 6; i >= 0; i--) {
    const date = new Date();
    date.setDate(date.getDate() - i);
    date.setHours(0, 0, 0, 0);
    
    days.push(date.toLocaleDateString('ar-EG', { weekday: 'short' }));
    
    let dayDeposits = 0;
    let dayExpenses = 0;
    
    transactions.forEach(t => {
      const txDate = new Date(t.created_at);
      txDate.setHours(0, 0, 0, 0);
      
      if (txDate.getTime() === date.getTime()) {
        const amount = Number(t.amount || 0);
        if (['deposit', 'sale'].includes(t.type)) {
          dayDeposits += amount;
        } else {
          dayExpenses += amount;
        }
      }
    });
    
    deposits.push(dayDeposits);
    expenses.push(dayExpenses);
  }
  
  if (flowChart) flowChart.destroy();
  
  flowChart = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: days,
      datasets: [
        {
          label: 'إيداعات',
          data: deposits,
          backgroundColor: 'rgba(16, 185, 129, 0.7)',
          borderColor: 'rgb(16, 185, 129)',
          borderWidth: 1,
          borderRadius: 6
        },
        {
          label: 'مصروفات',
          data: expenses,
          backgroundColor: 'rgba(239, 68, 68, 0.7)',
          borderColor: 'rgb(239, 68, 68)',
          borderWidth: 1,
          borderRadius: 6
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          position: 'top',
          labels: { color: '#8b93a6', font: { size: 11 } }
        }
      },
      scales: {
        x: {
          grid: { color: 'rgba(255,255,255,0.05)' },
          ticks: { color: '#8b93a6' }
        },
        y: {
          grid: { color: 'rgba(255,255,255,0.05)' },
          ticks: { color: '#8b93a6' }
        }
      }
    }
  });
}

function initExpensesChart() {
  const ctx = document.getElementById('expensesChart')?.getContext('2d');
  if (!ctx) return;
  
  // Group expenses by category
  const categories = {};
  
  transactions.forEach(t => {
    if (['expense', 'withdrawal', 'purchase'].includes(t.type)) {
      const cat = t.category || 'أخرى';
      categories[cat] = (categories[cat] || 0) + Number(t.amount || 0);
    }
  });
  
  const labels = Object.keys(categories);
  const data = Object.values(categories);
  
  const colors = [
    'rgba(239, 68, 68, 0.8)',
    'rgba(245, 158, 11, 0.8)',
    'rgba(59, 130, 246, 0.8)',
    'rgba(168, 85, 247, 0.8)',
    'rgba(6, 182, 212, 0.8)',
    'rgba(236, 72, 153, 0.8)',
    'rgba(16, 185, 129, 0.8)',
    'rgba(139, 147, 166, 0.8)'
  ];
  
  if (expensesChart) expensesChart.destroy();
  
  expensesChart = new Chart(ctx, {
    type: 'doughnut',
    data: {
      labels: labels.length > 0 ? labels : ['لا توجد مصروفات'],
      datasets: [{
        data: data.length > 0 ? data : [1],
        backgroundColor: data.length > 0 ? colors.slice(0, labels.length) : ['rgba(139, 147, 166, 0.3)'],
        borderWidth: 0
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          position: 'right',
          labels: { color: '#8b93a6', font: { size: 11 }, padding: 10 }
        }
      },
      cutout: '60%'
    }
  });
}

// ═══════════════════════════════════════
// 📋 Transaction Types Configuration
// ═══════════════════════════════════════
const DEPOSIT_TYPES = {
  capital: {
    label: 'رأس مال',
    icon: '💰',
    affectsCapital: true,
    affectsProfit: false,
    hint: '✅ سيتم إضافة المبلغ إلى رأس المال',
    hintClass: 'capital'
  },
  revenue: {
    label: 'إيرادات/أرباح',
    icon: '📈',
    affectsCapital: false,
    affectsProfit: true,
    hint: '✅ سيتم إضافة المبلغ إلى الأرباح',
    hintClass: 'profit'
  },
  debt_collection: {
    label: 'تحصيل دين',
    icon: '💳',
    affectsCapital: false,
    affectsProfit: false,
    hint: 'ℹ️ تحصيل دين مسجل مسبقاً - لا يؤثر على رأس المال أو الأرباح',
    hintClass: 'neutral'
  },
  loan_received: {
    label: 'قرض/سلفة مستلمة',
    icon: '🏦',
    affectsCapital: false,
    affectsProfit: false,
    hint: '⚠️ سيتم تسجيله كالتزام (دين عليك)',
    hintClass: 'neutral'
  },
  internal_transfer: {
    label: 'تحويل داخلي',
    icon: '🔄',
    affectsCapital: false,
    affectsProfit: false,
    hint: 'ℹ️ تحويل من حساب آخر - لا يؤثر على رأس المال أو الأرباح',
    hintClass: 'neutral'
  }
};

const WITHDRAW_TYPES = {
  owner_withdrawal: {
    label: 'سحب شخصي',
    icon: '👤',
    affectsCapital: true,
    affectsProfit: false,
    hint: '⚠️ سيتم خصم المبلغ من رأس المال (مسحوبات المالك)',
    hintClass: 'capital'
  },
  operating_expense: {
    label: 'مصروفات تشغيلية',
    icon: '🧾',
    affectsCapital: false,
    affectsProfit: true,
    hint: '📉 سيتم خصم المبلغ من الأرباح (مصروف تشغيلي)',
    hintClass: 'expense'
  },
  salary: {
    label: 'رواتب',
    icon: '💵',
    affectsCapital: false,
    affectsProfit: true,
    hint: '📉 سيتم خصم المبلغ من الأرباح (رواتب)',
    hintClass: 'expense'
  },
  supplier_payment: {
    label: 'سداد مورد',
    icon: '🏭',
    affectsCapital: false,
    affectsProfit: false,
    hint: 'ℹ️ سداد دين لمورد - لا يؤثر على رأس المال أو الأرباح',
    hintClass: 'neutral'
  },
  loan_payment: {
    label: 'سداد قرض',
    icon: '🏦',
    affectsCapital: false,
    affectsProfit: false,
    hint: 'ℹ️ سداد قرض أو سلفة - لا يؤثر على رأس المال أو الأرباح',
    hintClass: 'neutral'
  },
  internal_transfer: {
    label: 'تحويل داخلي',
    icon: '🔄',
    affectsCapital: false,
    affectsProfit: false,
    hint: 'ℹ️ تحويل لحساب آخر - لا يؤثر على رأس المال أو الأرباح',
    hintClass: 'neutral'
  },
  to_cash_drawer: {
    label: 'تحويل لدرج الكاش',
    icon: '🗃️',
    affectsCapital: false,
    affectsProfit: false,
    hint: '🗃️ سيتم تحويل المبلغ لدرج نقطة البيع - لا يؤثر على رأس المال أو الأرباح',
    hintClass: 'neutral'
  }
};

// ═══════════════════════════════════════
// 🪟 Modals - Deposit
// ═══════════════════════════════════════
// Store clients list for debt collection
let clientsList = [];

function openDepositModal(walletType = 'cash') {
  document.getElementById('depositModal').classList.add('show');
  document.getElementById('depositWallet').value = walletType;
  document.getElementById('depositType').value = '';
  document.getElementById('depositAmount').value = '';
  document.getElementById('depositDescription').value = '';
  document.getElementById('depositTypeHint').className = 'type-hint';
  document.getElementById('depositTypeHint').textContent = '';

  // Hide client selection
  document.getElementById('clientSelectGroup').style.display = 'none';
  document.getElementById('depositClient').value = '';
  document.getElementById('clientBalanceHint').style.display = 'none';
  
  // ✅ تحديث قائمة المحافظ حسب النوع
  updateDepositWalletsList();

  setTimeout(() => document.getElementById('depositType').focus(), 100);
}

// ✅ فتح مودال الإيداع باستخدام wallet_id
async function openDepositModalById(walletId) {
  // تحميل المحافظ إذا لم تكن محملة
  if (paymentWallets.length === 0) {
    await loadPaymentWallets();
  }
  
  // البحث عن المحفظة
  const wallet = paymentWallets.find(w => w.id == walletId);
  if (!wallet) {
    showToast('المحفظة غير موجودة', 'error');
    return;
  }
  
  // فتح المودال مع تحديد النوع والمحفظة
  openDepositModal(wallet.type);
  
  // تحديد المحفظة المحددة في dropdown
  const walletSelect = document.getElementById('depositWalletSelect');
  if (walletSelect) {
    walletSelect.value = walletId;
  }
}

function closeDepositModal() {
  document.getElementById('depositModal').classList.remove('show');
}

async function onDepositTypeChange() {
  const select = document.getElementById('depositType');
  const hint = document.getElementById('depositTypeHint');
  const clientGroup = document.getElementById('clientSelectGroup');
  const typeConfig = DEPOSIT_TYPES[select.value];

  if (typeConfig) {
    hint.textContent = typeConfig.hint;
    hint.className = `type-hint show ${typeConfig.hintClass}`;
  } else {
    hint.className = 'type-hint';
    hint.textContent = '';
  }

  // Show/hide client selection based on type
  if (select.value === 'debt_collection') {
    clientGroup.style.display = 'block';
    await loadClientsList();
  } else {
    clientGroup.style.display = 'none';
    document.getElementById('depositClient').value = '';
    document.getElementById('clientBalanceHint').style.display = 'none';
  }
}

async function loadClientsList() {
  try {
    const res = await fetch('elos-db://clients');
    if (!res.ok) throw new Error(await res.text());

    clientsList = await res.json();
    const select = document.getElementById('depositClient');

    // Filter clients with positive balance (they owe us money)
    const clientsWithDebt = clientsList.filter(c => (parseFloat(c.balance) || 0) > 0);

    select.innerHTML = '<option value="">-- اختر العميل --</option>' +
      clientsWithDebt.map(c => {
        const balance = parseFloat(c.balance) || 0;
        return `<option value="${c.id}" data-balance="${balance}">${c.name} (عليه: ${balance.toLocaleString()} ج.م)</option>`;
      }).join('');

    if (clientsWithDebt.length === 0) {
      select.innerHTML = '<option value="">-- لا يوجد عملاء عليهم ديون --</option>';
    }

  } catch (error) {
    Logger.error('Error loading clients:', error);
    showToast('خطأ في تحميل قائمة العملاء', 'error');
  }
}

function onClientSelect() {
  const select = document.getElementById('depositClient');
  const hint = document.getElementById('clientBalanceHint');
  const amountInput = document.getElementById('depositAmount');
  const selectedOption = select.options[select.selectedIndex];

  if (select.value && selectedOption) {
    const balance = parseFloat(selectedOption.dataset.balance) || 0;
    const client = clientsList.find(c => c.id == select.value);

    if (balance > 0) {
      hint.innerHTML = `<span style="color: var(--warning);">💰 المستحق من العميل: <strong>${balance.toLocaleString()} ج.م</strong></span>`;
      hint.style.display = 'block';
      // Set amount to client balance as suggestion
      if (!amountInput.value) {
        amountInput.value = balance;
      }
    } else {
      hint.innerHTML = `<span style="color: var(--success);">✅ لا يوجد مستحقات على هذا العميل</span>`;
      hint.style.display = 'block';
    }
  } else {
    hint.style.display = 'none';
  }
}

async function confirmDeposit() {
  const walletType = document.getElementById('depositWallet').value;
  const walletSelect = document.getElementById('depositWalletSelect');
  const walletId = walletSelect && walletSelect.value ? parseInt(walletSelect.value) : null;
  const depositType = document.getElementById('depositType').value;
  const amount = Number(document.getElementById('depositAmount').value || 0);
  const description = document.getElementById('depositDescription').value.trim();

  // Validation
  if (!depositType) {
    showToast('الرجاء اختيار نوع الإيداع', 'error');
    document.getElementById('depositType').focus();
    return;
  }

  if (amount <= 0) {
    showToast('الرجاء إدخال مبلغ صحيح', 'error');
    document.getElementById('depositAmount').focus();
    return;
  }

  // Validate client selection for debt_collection
  const clientId = document.getElementById('depositClient')?.value;
  if (depositType === 'debt_collection') {
    if (!clientId) {
      showToast('الرجاء اختيار العميل', 'error');
      document.getElementById('depositClient').focus();
      return;
    }
  }

  const typeConfig = DEPOSIT_TYPES[depositType];
  const walletConfig = WALLET_CONFIG[walletType];

  try {
    // إذا كان تحصيل دين من عميل، نستخدم API المخصص للعملاء
    if (depositType === 'debt_collection' && clientId) {
      const client = clientsList.find(c => c.id == clientId);
      const clientName = client?.name || 'عميل';

      const res = await fetch('elos-db://clients-payment', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          client_id: parseInt(clientId),
          amount: amount,
          payment_method: walletType === 'cash' ? 'cash' : (walletType === 'bank' ? 'bank' : 'wallet'),
          wallet_type: walletType,
          wallet_id: walletId,
          notes: description || `تحصيل دين من العميل إلى ${walletConfig.name}`
        })
      });

      if (!res.ok) throw new Error(await res.text());

      const result = await res.json();

      closeDepositModal();
      await loadBalance();
      await loadTransactions();
      initCharts();

      showToast(`✅ تم تحصيل ${amount.toLocaleString()} ج.م من العميل "${clientName}" إلى ${walletConfig.name}`, 'success');

    } else {
      // إيداع عادي
      const res = await fetch('elos-db://safe-transaction-add', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          type: 'deposit',
          sub_type: depositType,
          amount: amount,
          category: typeConfig.label,
          description: description || `${typeConfig.icon} ${typeConfig.label}`,
          wallet_type: walletType,
          wallet_id: walletId,
          affects_capital: typeConfig.affectsCapital,
          affects_profit: typeConfig.affectsProfit
        })
      });

      if (!res.ok) throw new Error(await res.text());

      closeDepositModal();
      await loadBalance();
      await loadTransactions();
      initCharts();

      showToast(`✅ تم إيداع ${amount.toLocaleString()} ج.م في ${walletConfig.name} (${typeConfig.label})`, 'success');
    }

  } catch (error) {
    Logger.error('Deposit error:', error);
    showToast('❌ خطأ في الإيداع: ' + error.message, 'error');
  }
}

// ═══════════════════════════════════════
// 🪟 Modals - Withdraw
// ═══════════════════════════════════════
// Store suppliers list
let suppliersList = [];

function openWithdrawModal(walletType = 'cash') {
  document.getElementById('withdrawModal').classList.add('show');
  document.getElementById('withdrawWallet').value = walletType;
  document.getElementById('withdrawType').value = '';
  document.getElementById('withdrawAmount').value = '';
  document.getElementById('withdrawDescription').value = '';
  document.getElementById('withdrawTypeHint').className = 'type-hint';
  document.getElementById('withdrawTypeHint').textContent = '';

  // Hide supplier selection
  document.getElementById('supplierSelectGroup').style.display = 'none';
  document.getElementById('withdrawSupplier').value = '';
  document.getElementById('supplierBalanceHint').style.display = 'none';

  // ✅ تحديث قائمة المحافظ حسب النوع
  updateWithdrawWalletsList();

  setTimeout(() => document.getElementById('withdrawType').focus(), 100);
}

function closeWithdrawModal() {
  document.getElementById('withdrawModal').classList.remove('show');
}

// ✅ فتح مودال السحب باستخدام wallet_id
async function openWithdrawModalById(walletId) {
  // تحميل المحافظ إذا لم تكن محملة
  if (paymentWallets.length === 0) {
    await loadPaymentWallets();
  }
  
  // البحث عن المحفظة
  const wallet = paymentWallets.find(w => w.id == walletId);
  if (!wallet) {
    showToast('المحفظة غير موجودة', 'error');
    return;
  }
  
  // فتح المودال مع تحديد النوع والمحفظة
  openWithdrawModal(wallet.type);
  
  // ✅ انتظار تحديث dropdown المحافظ ثم تحديد المحفظة المحددة
  // نستخدم setTimeout للتأكد من أن updateWithdrawWalletsList() أنهت العمل
  setTimeout(() => {
    const walletSelect = document.getElementById('withdrawWalletSelect');
    if (walletSelect) {
      walletSelect.value = walletId;
      Logger.log('[SAFE] Selected wallet for withdrawal:', walletId, wallet.name);
    } else {
      Logger.warn('[SAFE] withdrawWalletSelect element not found');
    }
  }, 200);
}

async function onWithdrawTypeChange() {
  const select = document.getElementById('withdrawType');
  const hint = document.getElementById('withdrawTypeHint');
  const supplierGroup = document.getElementById('supplierSelectGroup');
  const typeConfig = WITHDRAW_TYPES[select.value];

  if (typeConfig) {
    hint.textContent = typeConfig.hint;
    hint.className = `type-hint show ${typeConfig.hintClass}`;
  } else {
    hint.className = 'type-hint';
    hint.textContent = '';
  }

  // Show/hide supplier selection based on type
  if (select.value === 'supplier_payment') {
    supplierGroup.style.display = 'block';
    await loadSuppliersList();
  } else {
    supplierGroup.style.display = 'none';
    document.getElementById('withdrawSupplier').value = '';
    document.getElementById('supplierBalanceHint').style.display = 'none';
  }
}

async function loadSuppliersList() {
  try {
    const res = await fetch('elos-db://suppliers');
    if (!res.ok) throw new Error(await res.text());

    suppliersList = await res.json();
    const select = document.getElementById('withdrawSupplier');

    select.innerHTML = '<option value="">-- اختر المورد --</option>' +
      suppliersList.map(s => {
        const balance = parseFloat(s.balance) || 0;
        const balanceText = balance > 0 ? ` (عليه: ${balance.toLocaleString()} ج.م)` : '';
        return `<option value="${s.id}" data-balance="${balance}">${s.name}${balanceText}</option>`;
      }).join('');

  } catch (error) {
    Logger.error('Error loading suppliers:', error);
    showToast('خطأ في تحميل قائمة الموردين', 'error');
  }
}

function onSupplierSelect() {
  const select = document.getElementById('withdrawSupplier');
  const hint = document.getElementById('supplierBalanceHint');
  const amountInput = document.getElementById('withdrawAmount');
  const selectedOption = select.options[select.selectedIndex];

  if (select.value && selectedOption) {
    const balance = parseFloat(selectedOption.dataset.balance) || 0;
    const supplier = suppliersList.find(s => s.id == select.value);

    if (balance > 0) {
      hint.innerHTML = `<span style="color: var(--danger);">💰 المستحق للمورد: <strong>${balance.toLocaleString()} ج.م</strong></span>`;
      hint.style.display = 'block';
      // Set amount to supplier balance as suggestion
      if (!amountInput.value) {
        amountInput.value = balance;
      }
    } else {
      hint.innerHTML = `<span style="color: var(--success);">✅ لا يوجد مستحقات لهذا المورد</span>`;
      hint.style.display = 'block';
    }
  } else {
    hint.style.display = 'none';
  }
}

async function confirmWithdraw() {
  const walletType = document.getElementById('withdrawWallet').value;
  const walletSelect = document.getElementById('withdrawWalletSelect');
  const walletId = walletSelect && walletSelect.value ? parseInt(walletSelect.value) : null;
  const withdrawType = document.getElementById('withdrawType').value;
  const amount = Number(document.getElementById('withdrawAmount').value || 0);
  const description = document.getElementById('withdrawDescription').value.trim();

  // Validation
  if (!withdrawType) {
    showToast('الرجاء اختيار نوع السحب', 'error');
    document.getElementById('withdrawType').focus();
    return;
  }

  if (amount <= 0) {
    showToast('الرجاء إدخال مبلغ صحيح', 'error');
    document.getElementById('withdrawAmount').focus();
    return;
  }

  // Validate supplier selection for supplier_payment
  const supplierId = document.getElementById('withdrawSupplier')?.value;
  if (withdrawType === 'supplier_payment') {
    if (!supplierId) {
      showToast('الرجاء اختيار المورد', 'error');
      document.getElementById('withdrawSupplier').focus();
      return;
    }
  }

  // ✅ جلب اسم المحفظة والرصيد الفردي
  let walletConfig = WALLET_CONFIG[walletType];
  let walletBalance = walletBalances[walletType] || 0;
  let walletName = walletConfig?.name || '-';
  
  if (walletId && paymentWallets.length > 0) {
    const wallet = paymentWallets.find(w => w.id == walletId);
    if (wallet) {
      walletName = wallet.name;
      // جلب الرصيد الفردي
      if (individualWalletBalances.length > 0) {
        const walletBalanceData = individualWalletBalances.find(w => w.id == walletId);
        if (walletBalanceData) walletBalance = Number(walletBalanceData.balance || 0);
      }
    }
  }

  // Check balance
  if (amount > walletBalance) {
    showToast(`❌ رصيد ${walletName} غير كافي (${walletBalance.toLocaleString()} ج.م)`, 'error');
    return;
  }

  const typeConfig = WITHDRAW_TYPES[withdrawType];

  try {
    // إذا كان سداد مورد، نستخدم API المخصص للموردين
    if (withdrawType === 'supplier_payment' && supplierId) {
      const supplier = suppliersList.find(s => s.id == supplierId);
      const supplierName = supplier?.name || 'مورد';

      const res = await fetch('elos-db://suppliers-payment', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          supplier_id: parseInt(supplierId),
          amount: amount,
          payment_method: walletType === 'cash' ? 'cash' : (walletType === 'bank' ? 'bank' : 'wallet'),
          wallet_type: walletType,
          wallet_id: walletId,
          notes: description || `سداد للمورد من ${walletName}`
        })
      });

      if (!res.ok) throw new Error(await res.text());

      const result = await res.json();

      closeWithdrawModal();
      await loadBalance();
      await loadTransactions();
      initCharts();

      showToast(`✅ تم سداد ${amount.toLocaleString()} ج.م للمورد "${supplierName}" من ${walletName}`, 'success');

    } else if (withdrawType === 'to_cash_drawer') {
      // تحويل لدرج الكاش (نقطة البيع)
      const currentUser = window.currentUser || JSON.parse(localStorage.getItem('currentUser') || '{}');
      const res = await fetch('elos-db://transfer-to-cash-drawer', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          amount: amount,
          wallet_type: walletType,
          wallet_id: walletId,
          user_id: currentUser?.id || null,
          username: currentUser?.username || 'system',
          notes: description || `تحويل من ${walletName} لدرج الكاش`
        })
      });

      if (!res.ok) throw new Error(await res.text());

      closeWithdrawModal();
      await loadBalance();
      await loadTransactions();
      initCharts();

      showToast(`✅ تم تحويل ${amount.toLocaleString()} ج.م من ${walletName} إلى درج الكاش`, 'success');

    } else {
      // معاملة سحب عادية
      const res = await fetch('elos-db://safe-transaction-add', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          type: 'withdrawal',
          sub_type: withdrawType,
          amount: amount,
          category: typeConfig.label,
          description: description || `${typeConfig.icon} ${typeConfig.label}`,
          wallet_type: walletType,
          wallet_id: walletId,
          affects_capital: typeConfig.affectsCapital,
          affects_profit: typeConfig.affectsProfit
        })
      });

      if (!res.ok) throw new Error(await res.text());

      closeWithdrawModal();
      
      // ✅ تحديث الرصيد بشكل صريح بعد السحب
      Logger.log('[SAFE] Withdraw completed - wallet_id:', walletId, 'wallet_type:', walletType, 'amount:', amount);
      await loadBalance();
      await loadTransactions();
      initCharts();

      showToast(`✅ تم سحب ${amount.toLocaleString()} ج.م من ${walletConfig.name} (${typeConfig.label})`, 'success');
    }

  } catch (error) {
    Logger.error('Withdraw error:', error);
    showToast('❌ خطأ في السحب: ' + error.message, 'error');
  }
}

// ═══════════════════════════════════════
// 🪟 Modals - Expense
// ═══════════════════════════════════════
function openExpenseModal() {
  document.getElementById('expenseModal').classList.add('show');
  document.getElementById('expenseAmount').value = '';
  document.getElementById('expenseCategory').value = '';
  document.getElementById('expenseDescription').value = '';
  setTimeout(() => document.getElementById('expenseAmount').focus(), 100);
}

function closeExpenseModal() {
  document.getElementById('expenseModal').classList.remove('show');
}

async function confirmExpense() {
  const amount = Number(document.getElementById('expenseAmount').value || 0);
  const category = document.getElementById('expenseCategory').value.trim() || 'مصروف';
  const description = document.getElementById('expenseDescription').value.trim();
  
  if (amount <= 0) {
    showToast('الرجاء إدخال مبلغ صحيح', 'error');
    document.getElementById('expenseAmount').focus();
    return;
  }
  
  try {
    const res = await fetch('elos-db://safe-transaction-add', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        type: 'expense',
        amount: amount,
        category: category,
        description: description || `مصروف - ${category}`,
        payment_method: 'cash'
      })
    });
    
    if (!res.ok) throw new Error(await res.text());
    
    closeExpenseModal();
    await loadBalance();
    await loadTransactions();
    initCharts();
    
    showToast(`✅ تم تسجيل مصروف ${amount.toLocaleString()} ج.م`, 'success');
    
  } catch (error) {
    Logger.error('Expense error:', error);
    showToast('❌ خطأ في تسجيل المصروف', 'error');
  }
}

// ═══════════════════════════════════════
// 🪟 Modals - Transfer (تحويل بين المحافظ)
// ═══════════════════════════════════════
async function openTransferModal(fromWalletType = '') {
  document.getElementById('transferModal').classList.add('show');
  document.getElementById('transferFrom').value = fromWalletType;
  document.getElementById('transferTo').value = '';
  document.getElementById('transferAmount').value = '';
  document.getElementById('transferDescription').value = '';
  document.getElementById('transferSummary').style.display = 'none';

  // ✅ إخفاء dropdownات المحافظ المحددة
  document.getElementById('transferFromWalletSelectGroup').style.display = 'none';
  document.getElementById('transferToWalletSelectGroup').style.display = 'none';

  // ✅ تحديث قائمة المحافظ إذا تم تحديد النوع (await لضمان تحميل القائمة قبل تحديث الرصيد)
  if (fromWalletType) {
    await updateTransferFromWalletsList();
  } else {
    document.getElementById('fromWalletBalance').className = 'wallet-balance-hint';
  }
  document.getElementById('toWalletBalance').className = 'wallet-balance-hint';

  setTimeout(() => document.getElementById('transferFrom').focus(), 100);
}

function closeTransferModal() {
  document.getElementById('transferModal').classList.remove('show');
}

// ✅ فتح مودال التحويل باستخدام wallet_id للمحفظة المصدر
async function openTransferModalFromWallet(walletId) {
  // تحميل المحافظ إذا لم تكن محملة
  if (paymentWallets.length === 0) {
    await loadPaymentWallets();
  }
  
  // البحث عن المحفظة
  const wallet = paymentWallets.find(w => w.id == walletId);
  if (!wallet) {
    showToast('المحفظة غير موجودة', 'error');
    return;
  }
  
  // فتح المودال مع تحديد النوع والمحفظة (await لضمان تحميل القائمة)
  await openTransferModal(wallet.type);

  // ✅ الآن القائمة محملة - نحدد المحفظة المطلوبة مباشرة
  const fromSelect = document.getElementById('transferFromWalletId');
  if (fromSelect) {
    fromSelect.value = walletId;
    Logger.log('[SAFE] Selected wallet for transfer FROM:', walletId, wallet.name);
    onTransferFromChange(); // تحديث الرصيد والملخص
  } else {
    Logger.warn('[SAFE] transferFromWalletId element not found');
  }
}

// ═══════════════════════════════════════
// 📋 WALLET HISTORY MODAL
// ═══════════════════════════════════════

// ✅ فتح سجل المحفظة باستخدام wallet_id
async function openWalletHistoryById(walletId) {
  // تحميل المحافظ إذا لم تكن محملة
  if (paymentWallets.length === 0) {
    await loadPaymentWallets();
  }
  
  // البحث عن المحفظة
  const wallet = paymentWallets.find(w => w.id == walletId);
  if (!wallet) {
    showToast('المحفظة غير موجودة', 'error');
    return;
  }
  
  // ✅ فتح السجل مع تحديد wallet_id بدلاً من wallet_type فقط
  await openWalletHistoryByIdInternal(walletId, wallet.type, wallet.name);
}

// ✅ فتح سجل المحفظة باستخدام wallet_id (الدالة الداخلية)
async function openWalletHistoryByIdInternal(walletId, walletType, walletName) {
  const modal = document.getElementById('walletHistoryModal');
  const listContainer = document.getElementById('walletHistoryList');
  const walletNameEl = document.getElementById('walletHistoryName');
  const walletIconEl = document.getElementById('walletHistoryIcon');

  // تحديد الأيقونة حسب النوع
  const walletIcon = walletType === 'cash' ? '💵' : walletType === 'mobile_wallet' ? '📱' : '🏦';
  walletNameEl.textContent = walletName;
  walletIconEl.textContent = walletIcon;

  // Show loading
  listContainer.innerHTML = `
    <div class="history-empty">
      <div class="history-empty-icon">⏳</div>
      <div>جاري تحميل السجل...</div>
    </div>
  `;

  modal.classList.add('show');

  try {
    // ✅ Fetch wallet transactions using wallet_id
    const res = await fetch(`elos-db://wallet-transactions?wallet_id=${walletId}&wallet_type=${walletType}`);
    if (!res.ok) throw new Error(await res.text());

    const data = await res.json();
    const walletTransactions = data.transactions || data || [];

    if (walletTransactions.length === 0) {
      listContainer.innerHTML = `
        <div class="history-empty">
          <div class="history-empty-icon">📋</div>
          <div>لا توجد معاملات في هذه المحفظة</div>
        </div>
      `;
      return;
    }

    // Render transactions
    listContainer.innerHTML = walletTransactions.map(t => {
      const isIncome = ['deposit', 'sale', 'transfer_in', 'client_payment'].includes(t.type);
      const iconInfo = getHistoryIcon(t.type, isIncome);

      return `
        <div class="history-item">
          <div class="history-icon ${iconInfo.class}">${iconInfo.icon}</div>
          <div class="history-content">
            <div class="history-title">${getHistoryTitle(t.type)}</div>
            <div class="history-desc">${escapeHtml(t.description || t.category || '-')}</div>
          </div>
          <div class="history-amount ${isIncome ? 'positive' : 'negative'}">
            ${isIncome ? '+' : '-'}${Number(t.amount || 0).toLocaleString()} ج.م
            <div class="history-date">${formatDateShort(t.created_at)}</div>
          </div>
        </div>
      `;
    }).join('');

  } catch (error) {
    Logger.error('Error loading wallet history:', error);
    listContainer.innerHTML = `
      <div class="history-empty">
        <div class="history-empty-icon">❌</div>
        <div>فشل في تحميل السجل</div>
      </div>
    `;
  }
}

async function openWalletHistory(walletType) {
  const modal = document.getElementById('walletHistoryModal');
  const listContainer = document.getElementById('walletHistoryList');
  const walletNameEl = document.getElementById('walletHistoryName');
  const walletIconEl = document.getElementById('walletHistoryIcon');

  const config = WALLET_CONFIG[walletType];
  if (config) {
    walletNameEl.textContent = config.name;
    walletIconEl.textContent = config.icon;
  }

  // Show loading
  listContainer.innerHTML = `
    <div class="history-empty">
      <div class="history-empty-icon">⏳</div>
      <div>جاري تحميل السجل...</div>
    </div>
  `;

  modal.classList.add('show');

  try {
    // Fetch wallet transactions
    const res = await fetch(`elos-db://wallet-transactions?wallet=${walletType}`);
    if (!res.ok) throw new Error(await res.text());

    const data = await res.json();
    const walletTransactions = data.transactions || data || [];

    if (walletTransactions.length === 0) {
      listContainer.innerHTML = `
        <div class="history-empty">
          <div class="history-empty-icon">📋</div>
          <div>لا توجد معاملات في هذه المحفظة</div>
        </div>
      `;
      return;
    }

    // Render transactions
    listContainer.innerHTML = walletTransactions.map(t => {
      const isIncome = ['deposit', 'sale', 'transfer_in', 'client_payment'].includes(t.type);
      const iconInfo = getHistoryIcon(t.type, isIncome);

      return `
        <div class="history-item">
          <div class="history-icon ${iconInfo.class}">${iconInfo.icon}</div>
          <div class="history-content">
            <div class="history-title">${getHistoryTitle(t.type)}</div>
            <div class="history-desc">${escapeHtml(t.description || t.category || '-')}</div>
          </div>
          <div class="history-amount ${isIncome ? 'positive' : 'negative'}">
            ${isIncome ? '+' : '-'}${Number(t.amount || 0).toLocaleString()} ج.م
            <div class="history-date">${formatDateShort(t.created_at)}</div>
          </div>
        </div>
      `;
    }).join('');

  } catch (error) {
    Logger.error('Error loading wallet history:', error);
    listContainer.innerHTML = `
      <div class="history-empty">
        <div class="history-empty-icon">❌</div>
        <div>فشل في تحميل السجل</div>
      </div>
    `;
  }
}

function closeWalletHistoryModal() {
  document.getElementById('walletHistoryModal').classList.remove('show');
}

function getHistoryIcon(type, isIncome) {
  const icons = {
    'deposit': { icon: '📥', class: 'deposit' },
    'withdrawal': { icon: '📤', class: 'withdraw' },
    'sale': { icon: '🧾', class: 'sale' },
    'purchase': { icon: '🛒', class: 'purchase' },
    'transfer_in': { icon: '⬅️', class: 'transfer-in' },
    'transfer_out': { icon: '➡️', class: 'transfer-out' },
    'expense': { icon: '💸', class: 'withdraw' },
    'client_payment': { icon: '💰', class: 'deposit' },
    'supplier_payment': { icon: '💸', class: 'withdraw' }
  };
  return icons[type] || { icon: '📝', class: isIncome ? 'deposit' : 'withdraw' };
}

function getHistoryTitle(type) {
  const titles = {
    'deposit': 'إيداع',
    'withdrawal': 'سحب',
    'sale': 'مبيعات',
    'purchase': 'شراء',
    'transfer_in': 'تحويل وارد',
    'transfer_out': 'تحويل صادر',
    'expense': 'مصروفات',
    'client_payment': 'استلام من عميل',
    'supplier_payment': 'دفع لمورد'
  };
  return titles[type] || type;
}

function onTransferFromChange() {
  const fromWalletType = document.getElementById('transferFrom').value;
  const fromWalletIdSelect = document.getElementById('transferFromWalletId');
  const fromWalletId = fromWalletIdSelect && fromWalletIdSelect.value ? parseInt(fromWalletIdSelect.value) : null;
  const hint = document.getElementById('fromWalletBalance');

  // ✅ إذا كان wallet_id محدداً، استخدم الرصيد الفردي
  if (fromWalletId && individualWalletBalances.length > 0) {
    const wallet = individualWalletBalances.find(w => w.id == fromWalletId);
    if (wallet) {
      const balance = Number(wallet.balance || 0);
      hint.textContent = `💰 الرصيد المتاح: ${balance.toLocaleString()} ج.م`;
      hint.className = 'wallet-balance-hint show';
      updateTransferSummary();
      return;
    }
  }

  // النظام القديم: استخدام wallet_type فقط (للتوافق العكسي)
  if (fromWalletType && WALLET_CONFIG[fromWalletType]) {
    const balance = walletBalances[fromWalletType] || 0;
    hint.textContent = `💰 الرصيد المتاح: ${balance.toLocaleString()} ج.م`;
    hint.className = 'wallet-balance-hint show';
  } else {
    hint.className = 'wallet-balance-hint';
  }

  updateTransferSummary();
}

function onTransferToChange() {
  const toWalletType = document.getElementById('transferTo').value;
  const toWalletIdSelect = document.getElementById('transferToWalletId');
  const toWalletId = toWalletIdSelect && toWalletIdSelect.value ? parseInt(toWalletIdSelect.value) : null;
  const hint = document.getElementById('toWalletBalance');

  // ✅ إذا كان wallet_id محدداً، استخدم الرصيد الفردي
  if (toWalletId && individualWalletBalances.length > 0) {
    const wallet = individualWalletBalances.find(w => w.id == toWalletId);
    if (wallet) {
      const balance = Number(wallet.balance || 0);
      hint.textContent = `💰 الرصيد الحالي: ${balance.toLocaleString()} ج.م`;
      hint.className = 'wallet-balance-hint show';
      updateTransferSummary();
      return;
    }
  }

  // النظام القديم: استخدام wallet_type فقط (للتوافق العكسي)
  if (toWalletType && WALLET_CONFIG[toWalletType]) {
    const balance = walletBalances[toWalletType] || 0;
    hint.textContent = `💰 الرصيد الحالي: ${balance.toLocaleString()} ج.م`;
    hint.className = 'wallet-balance-hint show';
  } else {
    hint.className = 'wallet-balance-hint';
  }

  updateTransferSummary();
}

function updateTransferSummary() {
  const fromWalletType = document.getElementById('transferFrom').value;
  const fromWalletIdSelect = document.getElementById('transferFromWalletId');
  const fromWalletId = fromWalletIdSelect && fromWalletIdSelect.value ? parseInt(fromWalletIdSelect.value) : null;
  
  const toWalletType = document.getElementById('transferTo').value;
  const toWalletIdSelect = document.getElementById('transferToWalletId');
  const toWalletId = toWalletIdSelect && toWalletIdSelect.value ? parseInt(toWalletIdSelect.value) : null;
  
  const summary = document.getElementById('transferSummary');

  // ✅ التحقق من أن المحفظتين مختلفتين
  const walletsMatch = (fromWalletId && toWalletId && fromWalletId === toWalletId) || 
                       (!fromWalletId && !toWalletId && fromWalletType === toWalletType);
  
  if ((fromWalletType || fromWalletId) && (toWalletType || toWalletId) && !walletsMatch) {
    // ✅ جلب أسماء المحافظ الفعلية
    let fromWalletName = '-';
    let toWalletName = '-';
    
    if (fromWalletId && paymentWallets.length > 0) {
      const wallet = paymentWallets.find(w => w.id == fromWalletId);
      if (wallet) fromWalletName = wallet.name;
    } else if (fromWalletType) {
      fromWalletName = WALLET_CONFIG[fromWalletType]?.name || '-';
    }
    
    if (toWalletId && paymentWallets.length > 0) {
      const wallet = paymentWallets.find(w => w.id == toWalletId);
      if (wallet) toWalletName = wallet.name;
    } else if (toWalletType) {
      toWalletName = WALLET_CONFIG[toWalletType]?.name || '-';
    }
    
    document.getElementById('transferFromName').textContent = fromWalletName;
    document.getElementById('transferToName').textContent = toWalletName;
    summary.style.display = 'block';
  } else {
    summary.style.display = 'none';
  }
}

async function confirmTransfer() {
  const fromWalletType = document.getElementById('transferFrom').value;
  const fromWalletIdSelect = document.getElementById('transferFromWalletId');
  const fromWalletId = fromWalletIdSelect && fromWalletIdSelect.value ? parseInt(fromWalletIdSelect.value) : null;
  
  const toWalletType = document.getElementById('transferTo').value;
  const toWalletIdSelect = document.getElementById('transferToWalletId');
  const toWalletId = toWalletIdSelect && toWalletIdSelect.value ? parseInt(toWalletIdSelect.value) : null;
  
  const amount = Number(document.getElementById('transferAmount').value || 0);
  const description = document.getElementById('transferDescription').value.trim();

  // Validations
  if (!fromWalletType && !fromWalletId) {
    showToast('الرجاء اختيار المحفظة المصدر', 'error');
    return;
  }

  if (!toWalletType && !toWalletId) {
    showToast('الرجاء اختيار المحفظة الهدف', 'error');
    return;
  }

  // ✅ التحقق من أن المحفظتين مختلفتين
  const walletsMatch = (fromWalletId && toWalletId && fromWalletId === toWalletId) || 
                       (!fromWalletId && !toWalletId && fromWalletType === toWalletType);
  if (walletsMatch) {
    showToast('لا يمكن التحويل لنفس المحفظة', 'error');
    return;
  }

  if (amount <= 0) {
    showToast('الرجاء إدخال مبلغ صحيح', 'error');
    return;
  }

  // ✅ جلب أسماء المحافظ الفعلية للرسائل
  let fromWalletName = '-';
  let toWalletName = '-';
  let fromWalletBalance = 0;
  
  if (fromWalletId && paymentWallets.length > 0) {
    const wallet = paymentWallets.find(w => w.id == fromWalletId);
    if (wallet) {
      fromWalletName = wallet.name;
      // جلب الرصيد الفردي
      if (individualWalletBalances.length > 0) {
        const walletBalance = individualWalletBalances.find(w => w.id == fromWalletId);
        if (walletBalance) fromWalletBalance = Number(walletBalance.balance || 0);
      }
    }
  } else if (fromWalletType) {
    fromWalletName = WALLET_CONFIG[fromWalletType]?.name || '-';
    fromWalletBalance = walletBalances[fromWalletType] || 0;
  }
  
  if (toWalletId && paymentWallets.length > 0) {
    const wallet = paymentWallets.find(w => w.id == toWalletId);
    if (wallet) toWalletName = wallet.name;
  } else if (toWalletType) {
    toWalletName = WALLET_CONFIG[toWalletType]?.name || '-';
  }

  // Check balance
  if (amount > fromWalletBalance) {
    showToast(`❌ رصيد ${fromWalletName} غير كافي (${fromWalletBalance.toLocaleString()} ج.م)`, 'error');
    return;
  }

  try {
    // First: Withdraw from source wallet
    const withdrawRes = await fetch('elos-db://safe-transaction-add', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        type: 'withdrawal',
        sub_type: 'internal_transfer',
        amount: amount,
        category: 'تحويل داخلي',
        description: description || `🔄 تحويل إلى ${toWalletName}`,
        wallet_type: fromWalletType,
        wallet_id: fromWalletId,
        target_wallet: toWalletType,
        affects_capital: false,
        affects_profit: false
      })
    });

    if (!withdrawRes.ok) throw new Error(await withdrawRes.text());

    // Second: Deposit to target wallet
    const depositRes = await fetch('elos-db://safe-transaction-add', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        type: 'deposit',
        sub_type: 'internal_transfer',
        amount: amount,
        category: 'تحويل داخلي',
        description: description || `🔄 تحويل من ${fromWalletName}`,
        wallet_type: toWalletType,
        wallet_id: toWalletId,
        target_wallet: fromWalletType,
        affects_capital: false,
        affects_profit: false
      })
    });

    if (!depositRes.ok) throw new Error(await depositRes.text());

    closeTransferModal();
    await loadBalance();
    await loadTransactions();
    initCharts();

    showToast(`✅ تم تحويل ${amount.toLocaleString()} ج.م من ${fromWalletName} إلى ${toWalletName}`, 'success');

  } catch (error) {
    Logger.error('Transfer error:', error);
    showToast('❌ خطأ في التحويل: ' + error.message, 'error');
  }
}

// ═══════════════════════════════════════
// 🪟 Modals - Transactions
// ═══════════════════════════════════════
function openTransactionsModal() {
  document.getElementById('transactionsModal').classList.add('show');
}

function closeTransactionsModal() {
  document.getElementById('transactionsModal').classList.remove('show');
}

// ═══════════════════════════════════════
// 🪟 Modals - Shift Closings
// ═══════════════════════════════════════
function openShiftClosingsModal() {
  document.getElementById('shiftClosingsModal').classList.add('show');
}

function closeShiftClosingsModal() {
  document.getElementById('shiftClosingsModal').classList.remove('show');
}

async function openShiftDetails(shiftId) {
  const grid = document.getElementById('shiftDetailsGrid');
  const invoicesEl = document.getElementById('shiftDetailsInvoices');

  invoicesEl.innerHTML = '<p class="loading-text">جاري تحميل التفاصيل...</p>';
  grid.innerHTML = '';

  document.getElementById('shiftDetailsModal').classList.add('show');

  let shift = shiftClosings.find(s => s.id === shiftId);
  let invoices = [];
  let transfersOutTotal = 0;
  let transferCommissionsTotal = 0;
  let transfersDetails = [];
  let computedTotalToSafe = null;

  try {
    const res = await fetch(`elos-db://shift-closings/${shiftId}/details`);
    if (res.ok) {
      const data = await res.json();
      shift = data.shift;
      invoices = data.invoices || [];
      transfersOutTotal = Number(data.transfers_out_total || 0);
      transferCommissionsTotal = Number(data.transfer_commissions_total || 0);
      transfersDetails = data.transfers_details || [];
      computedTotalToSafe = data.computed_total_to_safe != null ? Number(data.computed_total_to_safe) : null;
    }
  } catch (e) {
    Logger.warn('Shift details API failed, using local data', e);
  }

  if (!shift) {
    invoicesEl.innerHTML = '<p class="danger">لم يتم العثور على بيانات التقفيل.</p>';
    return;
  }

  const hasInvoices = invoices.length > 0;
  const hasTransfers = transfersDetails.length > 0;

  if (!hasInvoices && !hasTransfers) {
    invoicesEl.innerHTML = '<p class="text-secondary">لا توجد فواتير أو تحويلات في نطاق هذا الشفت.</p>';
  } else {
    const transferTypeNames = {
      'vodafone_cash': 'فودافون كاش',
      'etisalat_cash': 'اتصالات كاش',
      'orange_cash': 'اورنج كاش',
      'we_pay': 'وي باي',
      'instapay': 'انستاباي',
      'other': 'أخرى'
    };

    // بناء التبويبات
    let tabsHtml = '<div class="shift-details-tabs">';

    if (hasInvoices) {
      tabsHtml += `<button class="shift-tab active" onclick="switchShiftTab(this, 'invoicesPanel')">🧾 الفواتير (${invoices.length})</button>`;
    }
    if (hasTransfers) {
      tabsHtml += `<button class="shift-tab ${!hasInvoices ? 'active' : ''}" onclick="switchShiftTab(this, 'transfersPanel')">💱 التحويلات (${transfersDetails.length})</button>`;
    }
    tabsHtml += '</div>';

    // محتوى الفواتير
    let invoicesPanel = '';
    if (hasInvoices) {
      invoicesPanel = `
        <div id="invoicesPanel" class="shift-tab-panel" style="display: block;">
          <table>
            <thead>
              <tr>
                <th>رقم الفاتورة</th>
                <th>المحتوى</th>
                <th>الإجمالي</th>
                <th>الربح</th>
              </tr>
            </thead>
            <tbody>
              ${invoices.map(inv => `
                <tr>
                  <td>${escapeHtml(inv.invoice_number)}</td>
                  <td>${escapeHtml(inv.items_summary || '-')}</td>
                  <td>${fmt(inv.total)}</td>
                  <td class="inv-profit">${fmt(inv.profit)}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
      `;
    }

    // محتوى التحويلات
    let transfersPanel = '';
    if (hasTransfers) {
      transfersPanel = `
        <div id="transfersPanel" class="shift-tab-panel" style="display: ${!hasInvoices ? 'block' : 'none'};">
          <table>
            <thead>
              <tr>
                <th>النوع</th>
                <th>العميل</th>
                <th>المبلغ</th>
                <th>العمولة</th>
              </tr>
            </thead>
            <tbody>
              ${transfersDetails.map(tr => `
                <tr>
                  <td>${transferTypeNames[tr.transfer_type] || tr.transfer_type || '-'}${tr.direction === 'withdraw' ? ' (سحب)' : ' (إيداع)'}</td>
                  <td>${escapeHtml(tr.customer_name || tr.customer_phone || '-')}</td>
                  <td>${fmt(Number(tr.transfer_amount || 0))}</td>
                  <td class="inv-profit">${fmt(Number(tr.commission || 0))}</td>
                </tr>
              `).join('')}
              <tr style="font-weight: bold; border-top: 2px solid var(--border);">
                <td colspan="2">الإجمالي (${transfersDetails.length} تحويل)</td>
                <td>${fmt(transfersDetails.reduce((s, t) => s + Number(t.transfer_amount || 0), 0))}</td>
                <td class="inv-profit">${fmt(transferCommissionsTotal)}</td>
              </tr>
            </tbody>
          </table>
        </div>
      `;
    }

    invoicesEl.innerHTML = tabsHtml + invoicesPanel + transfersPanel;
  }

  const diff = Number(shift.cash_difference || 0);
  let diffClass = '';
  if (diff > 0) diffClass = 'success';
  else if (diff < 0) diffClass = 'danger';
  const cashierName = shift.closed_by || 'غير محدد';

  grid.innerHTML = `
    <div class="shift-summary-item">
      <div class="shift-summary-label">📅 تاريخ التقفيل</div>
      <div class="shift-summary-value">${formatDate(shift.closed_at)}</div>
    </div>
    <div class="shift-summary-item">
      <div class="shift-summary-label">👤 الكاشير</div>
      <div class="shift-summary-value" style="color: var(--warning); font-weight: 700;">${escapeHtml(cashierName)}</div>
    </div>
    <div class="shift-summary-item">
      <div class="shift-summary-label">🧾 عدد المبيعات</div>
      <div class="shift-summary-value">${shift.sales_count || 0}</div>
    </div>
    <div class="shift-summary-item">
      <div class="shift-summary-label">💵 مبيعات نقدي</div>
      <div class="shift-summary-value success">${Number(shift.sales_cash || 0).toLocaleString()}</div>
    </div>
    <div class="shift-summary-item">
      <div class="shift-summary-label">💳 مبيعات بطاقة</div>
      <div class="shift-summary-value">${Number(shift.sales_card || 0).toLocaleString()}</div>
    </div>
    <div class="shift-summary-item">
      <div class="shift-summary-label">🏦 مبيعات تحويل</div>
      <div class="shift-summary-value">${Number(shift.sales_transfer || 0).toLocaleString()}</div>
    </div>
    <div class="shift-summary-item">
      <div class="shift-summary-label">📥 الإيداعات</div>
      <div class="shift-summary-value success">${Number(shift.deposits_total || 0).toLocaleString()}</div>
    </div>
    <div class="shift-summary-item">
      <div class="shift-summary-label">📤 المسحوبات</div>
      <div class="shift-summary-value danger">${Number(shift.withdraws_total || 0).toLocaleString()}</div>
    </div>
    ${transfersOutTotal > 0 ? `
    <div class="shift-summary-item">
      <div class="shift-summary-label">💱 تحويلات من الدرج</div>
      <div class="shift-summary-value" style="color: var(--warning);">${Number(transfersOutTotal).toLocaleString()}</div>
    </div>
    ` : ''}
    ${transferCommissionsTotal > 0 ? `
    <div class="shift-summary-item">
      <div class="shift-summary-label">💰 عمولات تحويلات</div>
      <div class="shift-summary-value success">${Number(transferCommissionsTotal).toLocaleString()}</div>
    </div>
    ` : ''}
    <div class="shift-summary-item">
      <div class="shift-summary-label">💰 المتوقع في الدرج</div>
      <div class="shift-summary-value">${Number(shift.expected_cash || 0).toLocaleString()}</div>
    </div>
    <div class="shift-summary-item">
      <div class="shift-summary-label">💵 الفعلي في الدرج</div>
      <div class="shift-summary-value">${Number(shift.actual_cash || 0).toLocaleString()}</div>
    </div>
    <div class="shift-summary-item">
      <div class="shift-summary-label">📊 الفرق</div>
      <div class="shift-summary-value ${diffClass}">${diff >= 0 ? '+' : ''}${diff.toLocaleString()}</div>
    </div>
    <div class="shift-summary-item" style="grid-column: span 2;">
      <div class="shift-summary-label">🏦 إجمالي للخزنة</div>
      <div class="shift-summary-value success" style="font-size: 32px;">${(computedTotalToSafe != null ? computedTotalToSafe : Number(shift.total_to_safe || 0)).toLocaleString()}</div>
    </div>
    ${shift.notes ? `
      <div class="shift-summary-item" style="grid-column: span 2;">
        <div class="shift-summary-label">📝 ملاحظات</div>
        <div class="shift-summary-value" style="font-size: 14px;">${escapeHtml(shift.notes)}</div>
      </div>
    ` : ''}
  `;
}

function closeShiftDetailsModal() {
  document.getElementById('shiftDetailsModal').classList.remove('show');
}

function switchShiftTab(btn, panelId) {
  // إزالة active من كل التبويبات
  btn.parentElement.querySelectorAll('.shift-tab').forEach(t => t.classList.remove('active'));
  btn.classList.add('active');
  // إخفاء كل الأقسام وإظهار المطلوب
  btn.parentElement.parentElement.querySelectorAll('.shift-tab-panel').forEach(p => p.style.display = 'none');
  const panel = document.getElementById(panelId);
  if (panel) panel.style.display = 'block';
}

// ═══════════════════════════════════════
// 📊 Reports - التقارير الاحترافية
// ═══════════════════════════════════════

// Daily Report
function generateDailyReport() {
  const today = new Date();
  const todayStr = today.toISOString().split('T')[0]; // YYYY-MM-DD

  let deposits = 0;
  let expensesOnly = 0;   // ✅ مصروفات فعلية فقط (نوع expense)
  let withdrawals = 0;    // مسحوبات (تشمل سحب لمرتجع وغيرها)
  let purchases = 0;      // مشتريات
  let transfers = 0;      // التحويلات الداخلية (لا تؤثر على الصافي)
  let count = 0;
  const todayTx = [];

  Logger.log('[DAILY REPORT] Generating for:', todayStr, 'Total transactions:', transactions.length);

  transactions.forEach(t => {
    const txDateStr = (t.created_at || '').substring(0, 10);

    if (txDateStr === todayStr) {
      count++;
      const amount = Number(t.amount || 0);
      const isInternalTransfer = t.type === 'transfer' || t.sub_type === 'internal_transfer';

      if (isInternalTransfer) {
        transfers += amount;
      } else if (['deposit', 'sale'].includes(t.type)) {
        deposits += amount;
      } else if (t.type === 'withdrawal' || t.type === 'expense' || t.type === 'purchase') {
        // ✅ المشتريات = مسحوبات وليست مصروفات
        if (t.type === 'purchase') {
          withdrawals += amount;
          purchases += amount;
        } else if (!isExpenseExcluded(t)) {
          expensesOnly += amount;
        } else {
          // ✅ المسحوبات تشمل withdrawal/expense المستبعدة (مثل المرتجعات)
          withdrawals += amount;
        }
      }
      todayTx.push(t);
    }
  });

  // صافي اليوم = الإيداعات - كل المخرجات (expensesOnly تشمل مصروفات + مشتريات غير مستبعدة؛ withdrawals = مسحوبات مستبعدة فقط)
  const totalOut = expensesOnly + withdrawals;
  const net = deposits - totalOut;

  Logger.log('[DAILY REPORT] deposits:', deposits, 'expenses:', expensesOnly, 'withdrawals:', withdrawals, 'purchases:', purchases, 'net:', net);

  // Update modal content
  document.getElementById('dailyReportDate').textContent = todayStr;
  document.getElementById('dailyDepositsTotal').textContent = deposits.toLocaleString();
  document.getElementById('dailyExpensesTotal').textContent = expensesOnly.toLocaleString();
  const dailyWithdrawalsEl = document.getElementById('dailyWithdrawalsTotal');
  const dailyPurchasesEl = document.getElementById('dailyPurchasesTotal');
  if (dailyWithdrawalsEl) dailyWithdrawalsEl.textContent = withdrawals.toLocaleString();
  if (dailyPurchasesEl) dailyPurchasesEl.textContent = purchases.toLocaleString();
  document.getElementById('dailyNetTotal').textContent = (net >= 0 ? '+' : '') + net.toLocaleString();
  document.getElementById('dailyTxCount').textContent = count;
  document.getElementById('dailyCurrentBalance').textContent = (document.getElementById('totalBalance')?.textContent || '0') + ' ج.م';
  
  // Update net color
  const netEl = document.getElementById('dailyNetTotal');
  if (net > 0) netEl.style.color = 'var(--success)';
  else if (net < 0) netEl.style.color = 'var(--danger)';
  else netEl.style.color = 'var(--text-primary)';
  
  // Render transactions list
  const listEl = document.getElementById('dailyTransactionsList');
  if (todayTx.length === 0) {
    listEl.innerHTML = '<div class="empty-state"><div class="empty-state-icon">💰</div><div>لا توجد معاملات اليوم</div></div>';
  } else {
    listEl.innerHTML = todayTx.slice(0, 10).map(t => {
      // ✅ التحقق من التحويلات الداخلية (بالنوع القديم أو sub_type الجديد)
      const isInternalTransfer = t.type === 'transfer' || t.sub_type === 'internal_transfer';
      const isIncome = !isInternalTransfer && ['deposit', 'sale'].includes(t.type);
      // ✅ التحويلات تعرض بلون محايد (أزرق)
      const amountClass = isInternalTransfer ? 'transfer' : (isIncome ? 'positive' : 'negative');
      const sign = isInternalTransfer ? '↔' : (isIncome ? '+' : '-');

      return `
        <div class="report-tx-item">
          <div class="report-tx-info">
            <div class="report-tx-category">${escapeHtml(t.category || getTypeLabel(t.type))}</div>
            <div class="report-tx-time">${formatDateShort(t.created_at)}</div>
          </div>
          <div class="report-tx-amount ${amountClass}">${sign}${Number(t.amount || 0).toLocaleString()}</div>
        </div>
      `;
    }).join('');
  }
  
  // Open modal
  document.getElementById('dailyReportModal').classList.add('show');
}

function closeDailyReportModal() {
  document.getElementById('dailyReportModal').classList.remove('show');
}

// Monthly Report
function generateMonthlyReport() {
  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

  let deposits = 0;
  let expensesOnly = 0;
  let withdrawals = 0;
  let purchases = 0;
  let transfers = 0;
  let count = 0;
  const categories = {}; // فئات المصروفات الفعلية فقط (نوع expense)

  transactions.forEach(t => {
    const txDate = new Date(t.created_at);

    if (txDate >= monthStart) {
      count++;
      const amount = Number(t.amount || 0);
      const isInternalTransfer = t.type === 'transfer' || t.sub_type === 'internal_transfer';

      if (isInternalTransfer) {
        transfers += amount;
      } else if (['deposit', 'sale'].includes(t.type)) {
        deposits += amount;
      } else if (t.type === 'withdrawal' || t.type === 'expense' || t.type === 'purchase') {
        // ✅ المشتريات = مسحوبات وليست مصروفات
        if (t.type === 'purchase') {
          withdrawals += amount;
          purchases += amount;
        } else if (!isExpenseExcluded(t)) {
          expensesOnly += amount;
          const cat = t.category || t.sub_type || 'أخرى';
          categories[cat] = (categories[cat] || 0) + amount;
        } else {
          // ✅ المسحوبات تشمل withdrawal/expense المستبعدة (مثل المرتجعات)
          withdrawals += amount;
        }
      }
    }
  });

  const totalOut = expensesOnly + withdrawals;
  const net = deposits - totalOut;

  // Update modal content
  document.getElementById('monthlyReportDate').textContent = now.toLocaleDateString('ar-EG', { month: 'long', year: 'numeric' });
  document.getElementById('monthlyDepositsTotal').textContent = deposits.toLocaleString();
  document.getElementById('monthlyExpensesTotal').textContent = expensesOnly.toLocaleString();
  const monthlyWithdrawalsEl = document.getElementById('monthlyWithdrawalsTotal');
  const monthlyPurchasesEl = document.getElementById('monthlyPurchasesTotal');
  if (monthlyWithdrawalsEl) monthlyWithdrawalsEl.textContent = withdrawals.toLocaleString();
  if (monthlyPurchasesEl) monthlyPurchasesEl.textContent = purchases.toLocaleString();
  document.getElementById('monthlyNetTotal').textContent = (net >= 0 ? '+' : '') + net.toLocaleString();
  document.getElementById('monthlyTxCount').textContent = count;
  document.getElementById('monthlyCurrentBalance').textContent = (document.getElementById('totalBalance')?.textContent || '0') + ' ج.م';
  
  // Update net color
  const netEl = document.getElementById('monthlyNetTotal');
  if (net > 0) netEl.style.color = 'var(--success)';
  else if (net < 0) netEl.style.color = 'var(--danger)';
  else netEl.style.color = 'var(--text-primary)';
  
  // Render top categories
  const topCategories = Object.entries(categories)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5);
  
  const maxAmount = topCategories.length > 0 ? topCategories[0][1] : 1;
  
  const categoriesEl = document.getElementById('monthlyTopCategories');
  if (topCategories.length === 0) {
    categoriesEl.innerHTML = '<div class="empty-state" style="padding: 20px;"><div>لا توجد مصروفات هذا الشهر</div></div>';
  } else {
    categoriesEl.innerHTML = topCategories.map(([cat, amt]) => {
      const percentage = Math.round((amt / maxAmount) * 100);
      return `
        <div class="report-category-item">
          <div style="flex: 1;">
            <div class="report-category-name">
              <span>🏷️</span>
              <span>${escapeHtml(cat)}</span>
            </div>
            <div class="report-category-bar" style="width: ${percentage}%;"></div>
          </div>
          <div class="report-category-amount">${amt.toLocaleString()} ج.م</div>
        </div>
      `;
    }).join('');
  }
  
  // Open modal
  document.getElementById('monthlyReportModal').classList.add('show');
}

function closeMonthlyReportModal() {
  document.getElementById('monthlyReportModal').classList.remove('show');
}

// Shift Report
function generateShiftReport() {
  if (!shiftClosings || shiftClosings.length === 0) {
    showToast('لا توجد تقفيلات حالياً', 'warning');
    return;
  }
  
  let totalSales = 0;
  let totalDeposits = 0;
  let totalWithdraws = 0;
  let totalDiff = 0;
  let positiveDiff = 0;
  let negativeDiff = 0;
  let zeroDiff = 0;
  
  shiftClosings.forEach(s => {
    totalSales += Number(s.sales_total || 0);
    totalDeposits += Number(s.deposits_total || 0);
    totalWithdraws += Number(s.withdraws_total || 0);
    
    const diff = Number(s.cash_difference || 0);
    totalDiff += diff;
    
    if (diff > 0) positiveDiff++;
    else if (diff < 0) negativeDiff++;
    else zeroDiff++;
  });
  
  const netToSafe = totalSales + totalDeposits - totalWithdraws;
  
  // Update modal content
  document.getElementById('shiftReportCount').textContent = shiftClosings.length;
  document.getElementById('shiftReportSales').textContent = totalSales.toLocaleString();
  document.getElementById('shiftReportDeposits').textContent = totalDeposits.toLocaleString();
  document.getElementById('shiftReportWithdraws').textContent = totalWithdraws.toLocaleString();
  document.getElementById('shiftReportNet').textContent = netToSafe.toLocaleString() + ' ج.م';
  
  // Render diff summary
  document.getElementById('shiftDiffSummary').innerHTML = `
    <div class="shift-diff-item">
      <div class="shift-diff-label">✅ تقفيلات متطابقة</div>
      <div class="shift-diff-value zero">${zeroDiff}</div>
    </div>
    <div class="shift-diff-item">
      <div class="shift-diff-label">📈 تقفيلات بزيادة</div>
      <div class="shift-diff-value positive">${positiveDiff}</div>
    </div>
    <div class="shift-diff-item">
      <div class="shift-diff-label">📉 تقفيلات بعجز</div>
      <div class="shift-diff-value negative">${negativeDiff}</div>
    </div>
  `;
  
  // Render recent shifts
  const listEl = document.getElementById('shiftReportList');
  listEl.innerHTML = shiftClosings.slice(0, 5).map(s => {
    const diff = Number(s.cash_difference || 0);
    let diffText = 'متطابق';
    if (diff > 0) diffText = `+${diff.toLocaleString()} زيادة`;
    else if (diff < 0) diffText = `${diff.toLocaleString()} عجز`;
    
    return `
      <div class="report-shift-item">
        <div class="report-shift-icon">🔐</div>
        <div class="report-shift-info">
          <div class="report-shift-date">${formatDateShort(s.closed_at)}</div>
          <div class="report-shift-details">${s.sales_count || 0} مبيعات • ${diffText}</div>
        </div>
        <div class="report-shift-total">${Number(s.total_to_safe || 0).toLocaleString()}</div>
      </div>
    `;
  }).join('');
  
  // Open modal
  document.getElementById('shiftReportModal').classList.add('show');
}

function closeShiftReportModal() {
  document.getElementById('shiftReportModal').classList.remove('show');
}

// Print Report
function printReport(type) {
  let title = '';
  let contentId = '';
  
  switch(type) {
    case 'daily':
      title = 'التقرير اليومي';
      contentId = 'dailyReportModal';
      break;
    case 'monthly':
      title = 'التقرير الشهري';
      contentId = 'monthlyReportModal';
      break;
    case 'shift':
      title = 'تقرير تقفيلات الشفت';
      contentId = 'shiftReportModal';
      break;
  }
  
  const modal = document.getElementById(contentId);
  const content = modal.querySelector('.modal-body').innerHTML;
  
  const printWindow = window.open('', '_blank');
  printWindow.document.write(`
    <!DOCTYPE html>
    <html dir="rtl">
    <head>
      <meta charset="UTF-8">
      <title>${title}</title>
      <style>
        body {
          font-family: 'Cairo', 'Segoe UI', sans-serif;
          padding: 20px;
          background: white;
          color: #333;
        }
        h1 { text-align: center; margin-bottom: 20px; }
        .report-summary-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 16px; margin: 20px 0; }
        .report-summary-card { border: 1px solid #ddd; padding: 16px; text-align: center; border-radius: 8px; }
        .report-summary-value { font-size: 24px; font-weight: bold; }
        .report-section { margin: 20px 0; }
        .report-section-title { font-weight: bold; margin-bottom: 10px; border-bottom: 2px solid #333; padding-bottom: 5px; }
        .report-balance-box { background: #f5f5f5; border: 2px solid #333; padding: 20px; text-align: center; margin-top: 20px; border-radius: 8px; }
        .report-balance-value { font-size: 32px; font-weight: bold; }
        @media print { body { padding: 0; } }
      </style>
    </head>
    <body>
      <h1>🏦 ${title}</h1>
      ${content}
      <script>window.onload = () => { window.print(); }</script>
    </body>
    </html>
  `);
  printWindow.document.close();
}

// ═══════════════════════════════════════
// 🛠️ Utilities
// ═══════════════════════════════════════
function initModalCloseHandlers() {
  // Close on backdrop click
  document.querySelectorAll('.modal').forEach(modal => {
    modal.addEventListener('click', (e) => {
      if (e.target === modal) {
        modal.classList.remove('show');
      }
    });
  });
  
  // Close on ESC
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      document.querySelectorAll('.modal.show').forEach(modal => {
        modal.classList.remove('show');
      });
    }
  });
}

function getTypeLabel(type) {
  const labels = {
    deposit: 'إيداع',
    withdrawal: 'سحب',
    expense: 'مصروف',
    sale: 'مبيعات',
    purchase: 'مشتريات',
    transfer: 'تحويل',
    supplier_payment: 'سداد مورد'
  };
  return labels[type] || type;
}

function getTransactionIcon(type) {
  const icons = {
    deposit: '📥',
    withdrawal: '📤',
    expense: '🧾',
    sale: '💰',
    purchase: '🛒',
    transfer: '🔄',
    supplier_payment: '💸'
  };
  return icons[type] || '💵';
}

// ═══════════════════════════════════════
// ⚙️ MANAGE WALLETS MODAL
// ═══════════════════════════════════════
async function openManageWalletsModal() {
  const modal = document.getElementById('manageWalletsModal');
  if (!modal) {
    console.error('[SAFE] manageWalletsModal not found');
    return;
  }
  
  modal.style.display = 'flex';
  await loadWalletsInSafe();
  await loadBankAccountsInSafe();
}

function closeManageWalletsModal() {
  const modal = document.getElementById('manageWalletsModal');
  if (modal) modal.style.display = 'none';
}

// Make functions available globally immediately
if (typeof window !== 'undefined') {
  window.openManageWalletsModal = openManageWalletsModal;
  window.closeManageWalletsModal = closeManageWalletsModal;
}

async function loadWalletsInSafe() {
  try {
    const res = await fetch('elos-db://payment-wallets?active_only=false');
    if (!res.ok) throw new Error(await res.text());
    const wallets = await res.json();
    
    const listEl = document.getElementById('walletsListInSafe');
    if (!listEl) return;
    
    if (wallets.length === 0) {
      listEl.innerHTML = '<div style="text-align: center; padding: 20px; color: var(--text-secondary);">لا توجد محافظ</div>';
      return;
    }
    
    const walletTypeNames = {
      'cash': 'كاش سائل',
      'mobile_wallet': 'محفظة إلكترونية',
      'bank': 'حساب بنكي'
    };
    
    listEl.innerHTML = wallets.map(w => `
      <div style="background: var(--bg-tertiary); border: 1px solid var(--border); border-radius: 10px; padding: 12px; margin-bottom: 8px;">
        <div style="display: flex; justify-content: space-between; align-items: start; margin-bottom: 8px;">
          <div>
            <div style="font-weight: 700; font-size: 13px; margin-bottom: 4px;">${w.name}</div>
            <div style="font-size: 11px; color: var(--text-secondary);">
              ${walletTypeNames[w.type] || w.type}
              ${w.provider ? ` • ${w.provider}` : ''}
              ${w.account_number ? ` • ${w.account_number}` : ''}
            </div>
          </div>
          <div style="display: flex; gap: 4px;">
            ${w.is_default ? '<span style="background: var(--success); color: white; padding: 2px 6px; border-radius: 4px; font-size: 10px;">افتراضي</span>' : ''}
            ${!w.is_active ? '<span style="background: var(--danger); color: white; padding: 2px 6px; border-radius: 4px; font-size: 10px;">معطل</span>' : ''}
          </div>
        </div>
        <div style="display: flex; gap: 6px;">
          <button class="btn btn-secondary" style="flex: 1; font-size: 11px; padding: 6px;" onclick="editWalletFromSafe(${w.id})">✏️ تعديل</button>
          <button class="btn btn-danger" style="flex: 1; font-size: 11px; padding: 6px;" onclick="deleteWalletFromSafe(${w.id})">🗑️ حذف</button>
        </div>
      </div>
    `).join('');
  } catch (error) {
    Logger.error('[WALLETS] Load error:', error);
    showToast('فشل تحميل المحافظ', 'error');
  }
}

async function loadBankAccountsInSafe() {
  try {
    const res = await fetch('elos-db://bank-accounts?active_only=false');
    if (!res.ok) throw new Error(await res.text());
    const accounts = await res.json();
    
    const listEl = document.getElementById('bankAccountsListInSafe');
    if (!listEl) return;
    
    if (accounts.length === 0) {
      listEl.innerHTML = '<div style="text-align: center; padding: 20px; color: var(--text-secondary);">لا توجد حسابات بنكية</div>';
      return;
    }
    
    listEl.innerHTML = accounts.map(a => `
      <div style="background: var(--bg-tertiary); border: 1px solid var(--border); border-radius: 10px; padding: 12px; margin-bottom: 8px;">
        <div style="display: flex; justify-content: space-between; align-items: start; margin-bottom: 8px;">
          <div>
            <div style="font-weight: 700; font-size: 13px; margin-bottom: 4px;">${a.bank_name}</div>
            <div style="font-size: 11px; color: var(--text-secondary);">
              ${a.account_number}
              ${a.account_name ? ` • ${a.account_name}` : ''}
            </div>
          </div>
          <div style="display: flex; gap: 4px;">
            ${a.is_default ? '<span style="background: var(--success); color: white; padding: 2px 6px; border-radius: 4px; font-size: 10px;">افتراضي</span>' : ''}
            ${!a.is_active ? '<span style="background: var(--danger); color: white; padding: 2px 6px; border-radius: 4px; font-size: 10px;">معطل</span>' : ''}
          </div>
        </div>
        <div style="display: flex; gap: 6px;">
          <button class="btn btn-secondary" style="flex: 1; font-size: 11px; padding: 6px;" onclick="editBankAccountFromSafe(${a.id})">✏️ تعديل</button>
          <button class="btn btn-danger" style="flex: 1; font-size: 11px; padding: 6px;" onclick="deleteBankAccountFromSafe(${a.id})">🗑️ حذف</button>
        </div>
      </div>
    `).join('');
  } catch (error) {
    Logger.error('[BANK-ACCOUNTS] Load error:', error);
    showToast('فشل تحميل الحسابات البنكية', 'error');
  }
}

function openWalletModalFromSafe() {
  closeManageWalletsModal();
  // Redirect to settings page with wallets tab
  window.location.href = 'settings.html?tab=wallets';
}

function editWalletFromSafe(walletId) {
  closeManageWalletsModal();
  window.location.href = `settings.html?tab=wallets&edit_wallet=${walletId}`;
}

async function deleteWalletFromSafe(walletId) {
  if (!confirm('هل أنت متأكد من حذف هذه المحفظة؟')) return;
  
  try {
    const res = await fetch(`elos-db://payment-wallets/${walletId}`, { method: 'DELETE' });
    if (!res.ok) throw new Error(await res.text());
    showToast('تم حذف المحفظة بنجاح', 'success');
    await loadWalletsInSafe();
  } catch (error) {
    showToast('فشل حذف المحفظة: ' + error.message, 'error');
  }
}

function openBankAccountModalFromSafe() {
  closeManageWalletsModal();
  window.location.href = 'settings.html?tab=wallets';
}

function editBankAccountFromSafe(accountId) {
  closeManageWalletsModal();
  window.location.href = `settings.html?tab=wallets&edit_account=${accountId}`;
}

async function deleteBankAccountFromSafe(accountId) {
  if (!confirm('هل أنت متأكد من حذف هذا الحساب البنكي؟')) return;
  
  try {
    const res = await fetch(`elos-db://bank-accounts/${accountId}`, { method: 'DELETE' });
    if (!res.ok) throw new Error(await res.text());
    showToast('تم حذف الحساب البنكي بنجاح', 'success');
    await loadBankAccountsInSafe();
  } catch (error) {
    showToast('فشل حذف الحساب البنكي: ' + error.message, 'error');
  }
}

// ═══════════════════════════════════════
// 📊 WALLET REPORT MODAL - تقرير شامل للمحافظ
// ═══════════════════════════════════════

async function openWalletReportModal() {
  const modal = document.getElementById('walletReportModal');
  if (!modal) {
    // إنشاء المودال إذا لم يكن موجوداً
    createWalletReportModal();
  }

  document.getElementById('walletReportModal').classList.add('show');
  await generateWalletReport();
}

function createWalletReportModal() {
  const modalHtml = `
    <div id="walletReportModal" class="modal">
      <div class="modal-content" style="max-width: 900px;">
        <div class="modal-header">
          <div class="modal-title">تقرير شامل للخزنة</div>
          <button class="modal-close" onclick="closeWalletReportModal()">×</button>
        </div>
        <div class="modal-body">
          <!-- فلاتر التقرير -->
          <div class="report-filters" style="display: flex; gap: 16px; margin-bottom: 20px; flex-wrap: wrap;">
            <div class="form-group" style="flex: 1; min-width: 150px;">
              <label class="form-label">من تاريخ</label>
              <input type="date" class="form-input" id="reportDateFrom" onchange="generateWalletReport()">
            </div>
            <div class="form-group" style="flex: 1; min-width: 150px;">
              <label class="form-label">إلى تاريخ</label>
              <input type="date" class="form-input" id="reportDateTo" onchange="generateWalletReport()">
            </div>
            <div class="form-group" style="flex: 1; min-width: 150px;">
              <label class="form-label">المحفظة</label>
              <select class="form-input" id="reportWalletFilter" onchange="generateWalletReport()">
                <option value="all">جميع المحافظ</option>
              </select>
            </div>
          </div>

          <!-- محتوى التقرير -->
          <div id="walletReportContent">
            <div style="text-align: center; padding: 40px; color: var(--text-secondary);">
              جاري تحميل التقرير...
            </div>
          </div>
        </div>
        <div class="modal-footer">
          <button class="btn btn-secondary" onclick="closeWalletReportModal()">إغلاق</button>
          <button class="btn btn-primary" onclick="exportWalletReportPDF()">تصدير PDF</button>
        </div>
      </div>
    </div>
  `;

  document.body.insertAdjacentHTML('beforeend', modalHtml);
}

async function generateWalletReport() {
  const container = document.getElementById('walletReportContent');
  const walletFilter = document.getElementById('reportWalletFilter');
  const dateFrom = document.getElementById('reportDateFrom')?.value || '';
  const dateTo = document.getElementById('reportDateTo')?.value || '';
  const selectedWallet = walletFilter?.value || 'all';

  // تحديث قائمة المحافظ
  if (walletFilter && walletFilter.options.length <= 1 && allWallets.length > 0) {
    allWallets.forEach(w => {
      const opt = document.createElement('option');
      opt.value = w.id;
      opt.textContent = w.name;
      walletFilter.appendChild(opt);
    });
  }

  container.innerHTML = '<div style="text-align: center; padding: 40px;">جاري تحميل التقرير...</div>';

  try {
    // جلب المعاملات
    let url = 'elos-db://safe-transactions?limit=500';
    if (dateFrom) url += `&from=${dateFrom}`;
    if (dateTo) url += `&to=${dateTo}`;

    const res = await fetch(url);
    if (!res.ok) throw new Error(await res.text());

    let transactions = await res.json();

    // فلترة حسب المحفظة
    if (selectedWallet !== 'all') {
      transactions = transactions.filter(t => t.wallet_id == selectedWallet);
    }

    // حساب الإحصائيات — المصروف الحقيقي = مصروفات تشغيلية فقط. مرتجعات/مسحوبات درج/عجز = سحوبات أخرى
    let totalDeposits = 0, totalWithdrawals = 0, totalExpensesReal = 0, totalPurchasesWithdrawals = 0, totalOtherWithdrawals = 0;
    let depositsByType = {};
    let withdrawalsByType = {};
    let withdrawalsByTypeReal = {}; // مصروف تشغيلي فقط (خسارة)
    let purchasesByType = {};
    let otherWithdrawalsByType = {}; // مرتجعات، مسحوبات درج، عجز كاش، سحب، إلخ

    transactions.forEach(t => {
      const amount = Number(t.amount || 0);
      const isInternalTransfer = t.type === 'transfer' || t.sub_type === 'internal_transfer';
      if (isInternalTransfer) return;

      if (t.type === 'deposit' || t.type === 'sale') {
        totalDeposits += amount;
        const subType = t.sub_type || t.category || 'أخرى';
        depositsByType[subType] = (depositsByType[subType] || 0) + amount;
      } else if (t.type === 'withdrawal' || t.type === 'expense' || t.type === 'purchase') {
        totalWithdrawals += amount;
        const subType = t.sub_type || t.category || 'أخرى';
        withdrawalsByType[subType] = (withdrawalsByType[subType] || 0) + amount;
        if (isRealExpense(t)) {
          totalExpensesReal += amount;
          withdrawalsByTypeReal[subType] = (withdrawalsByTypeReal[subType] || 0) + amount;
        } else if (t.type === 'purchase') {
          totalPurchasesWithdrawals += amount;
          purchasesByType[subType] = (purchasesByType[subType] || 0) + amount;
        } else {
          // سحوبات أخرى: مرتجعات، مسحوبات درج، عجز كاش، سحب، إلخ
          totalOtherWithdrawals += amount;
          otherWithdrawalsByType[subType] = (otherWithdrawalsByType[subType] || 0) + amount;
        }
      }
    });

    const netFlow = totalDeposits - totalWithdrawals;

    let depositsHtml = '';
    Object.entries(depositsByType).forEach(([type, amount]) => {
      depositsHtml += '<div style="display: flex; justify-content: space-between; padding: 12px; background: var(--bg-tertiary); border-radius: 8px;">' +
        '<span>' + getDepositTypeLabel(type) + '</span>' +
        '<span style="color: #10b981; font-weight: 600;">' + fmt(amount) + ' ج.م</span>' +
        '</div>';
    });
    if (!depositsHtml) {
      depositsHtml = '<div style="text-align: center; padding: 20px; color: var(--text-secondary);">لا توجد إيداعات</div>';
    }

    // تفاصيل المصروفات = مصروف حقيقي (خسارة) فقط type=expense
    let withdrawalsHtml = '';
    Object.entries(withdrawalsByTypeReal).forEach(([type, amount]) => {
      withdrawalsHtml += '<div style="display: flex; justify-content: space-between; padding: 12px; background: var(--bg-tertiary); border-radius: 8px;">' +
        '<span>' + getWithdrawTypeLabel(type) + '</span>' +
        '<span style="color: #ef4444; font-weight: 600;">' + fmt(amount) + ' ج.م</span>' +
        '</div>';
    });
    if (!withdrawalsHtml) {
      withdrawalsHtml = '<div style="text-align: center; padding: 20px; color: var(--text-secondary);">لا توجد مصروفات (خسارة)</div>';
    }

    // تفاصيل السحوبات (مشتريات وتوريد) = سحب عادي وليس مصروفاً
    let purchasesHtml = '';
    Object.entries(purchasesByType).forEach(([type, amount]) => {
      purchasesHtml += '<div style="display: flex; justify-content: space-between; padding: 12px; background: var(--bg-tertiary); border-radius: 8px;">' +
        '<span>' + getWithdrawTypeLabel(type) + '</span>' +
        '<span style="color: #f59e0b; font-weight: 600;">' + fmt(amount) + ' ج.م</span>' +
        '</div>';
    });
    if (!purchasesHtml) {
      purchasesHtml = '<div style="text-align: center; padding: 20px; color: var(--text-secondary);">لا توجد سحوبات مشتريات/توريد</div>';
    }

    // تفاصيل السحوبات الأخرى (مرتجعات، مسحوبات درج، عجز كاش، سحب — ليست مصروفاً)
    let otherWithdrawalsHtml = '';
    Object.entries(otherWithdrawalsByType).forEach(([type, amount]) => {
      otherWithdrawalsHtml += '<div style="display: flex; justify-content: space-between; padding: 12px; background: var(--bg-tertiary); border-radius: 8px;">' +
        '<span>' + getWithdrawTypeLabel(type) + '</span>' +
        '<span style="color: #6366f1; font-weight: 600;">' + fmt(amount) + ' ج.م</span>' +
        '</div>';
    });
    if (!otherWithdrawalsHtml) {
      otherWithdrawalsHtml = '<div style="text-align: center; padding: 20px; color: var(--text-secondary);">لا توجد سحوبات أخرى</div>';
    }

    let transactionsHtml = '';
    transactions.slice(0, 50).forEach(t => {
      const isIncome = ['deposit', 'sale'].includes(t.type);
      const colorStyle = isIncome ? '#10b981' : '#ef4444';
      const sign = isIncome ? '+' : '-';
      transactionsHtml += '<tr>' +
        '<td style="padding: 10px; border-bottom: 1px solid var(--border);">' + formatDateShort(t.created_at) + '</td>' +
        '<td style="padding: 10px; border-bottom: 1px solid var(--border);">' + getTransactionTypeLabel(t.type) + '</td>' +
        '<td style="padding: 10px; border-bottom: 1px solid var(--border);">' + escapeHtml(t.description || t.category || '-') + '</td>' +
        '<td style="padding: 10px; border-bottom: 1px solid var(--border); color: ' + colorStyle + '; font-weight: 600;">' +
          sign + fmt(t.amount) + ' ج.م' +
        '</td>' +
        '</tr>';
    });

    const netFlowColor = netFlow >= 0 ? '#10b981' : '#ef4444';
    const netFlowSign = netFlow >= 0 ? '+' : '';

    container.innerHTML =
      '<div class="report-summary-grid" style="display: grid; grid-template-columns: repeat(4, 1fr); gap: 16px; margin-bottom: 24px;">' +
        '<div class="report-summary-card success">' +
          '<div class="report-summary-value" style="color: #10b981; font-size: 24px; font-weight: 700;">' +
            fmt(totalDeposits) + ' ج.م' +
          '</div>' +
          '<div class="report-summary-label">إجمالي الإيداعات</div>' +
        '</div>' +
        '<div class="report-summary-card danger">' +
          '<div class="report-summary-value" style="color: #ef4444; font-size: 24px; font-weight: 700;">' +
            fmt(totalExpensesReal) + ' ج.م' +
          '</div>' +
          '<div class="report-summary-label">إجمالي المصروفات (خسارة)</div>' +
        '</div>' +
        '<div class="report-summary-card" style="border: 1px solid #f59e0b;">' +
          '<div class="report-summary-value" style="color: #f59e0b; font-size: 24px; font-weight: 700;">' +
            fmt(totalPurchasesWithdrawals) + ' ج.م' +
          '</div>' +
          '<div class="report-summary-label">سحوبات (مشتريات وتوريد)</div>' +
        '</div>' +
        '<div class="report-summary-card info">' +
          '<div class="report-summary-value" style="color: ' + netFlowColor + '; font-size: 24px; font-weight: 700;">' +
            netFlowSign + fmt(netFlow) + ' ج.م' +
          '</div>' +
          '<div class="report-summary-label">صافي التدفق</div>' +
        '</div>' +
      '</div>' +

      '<div style="display: grid; grid-template-columns: 1fr 1fr 1fr 1fr; gap: 20px;">' +
        '<div>' +
          '<h4 style="margin-bottom: 12px; color: var(--text-primary);">تفاصيل الإيداعات</h4>' +
          '<div style="display: flex; flex-direction: column; gap: 8px;">' +
            depositsHtml +
          '</div>' +
        '</div>' +
        '<div>' +
          '<h4 style="margin-bottom: 12px; color: var(--text-primary);">تفاصيل المصروفات (خسارة) — مصروفات تشغيلية فقط</h4>' +
          '<div style="display: flex; flex-direction: column; gap: 8px;">' +
            withdrawalsHtml +
          '</div>' +
        '</div>' +
        '<div>' +
          '<h4 style="margin-bottom: 12px; color: var(--text-primary);">تفاصيل السحوبات (مشتريات وتوريد)</h4>' +
          '<div style="display: flex; flex-direction: column; gap: 8px;">' +
            purchasesHtml +
          '</div>' +
        '</div>' +
        '<div>' +
          '<h4 style="margin-bottom: 12px; color: var(--text-primary);">تفاصيل السحوبات الأخرى (مرتجعات، درج، عجز، سحب)</h4>' +
          '<div style="display: flex; flex-direction: column; gap: 8px;">' +
            otherWithdrawalsHtml +
          '</div>' +
        '</div>' +
      '</div>' +

      '<div style="margin-top: 24px;">' +
        '<h4 style="margin-bottom: 12px; color: var(--text-primary);">آخر المعاملات (' + transactions.length + ')</h4>' +
        '<div style="max-height: 300px; overflow-y: auto;">' +
          '<table style="width: 100%; border-collapse: collapse;">' +
            '<thead>' +
              '<tr style="background: var(--bg-tertiary);">' +
                '<th style="padding: 10px; text-align: right; border-bottom: 1px solid var(--border);">التاريخ</th>' +
                '<th style="padding: 10px; text-align: right; border-bottom: 1px solid var(--border);">النوع</th>' +
                '<th style="padding: 10px; text-align: right; border-bottom: 1px solid var(--border);">الوصف</th>' +
                '<th style="padding: 10px; text-align: right; border-bottom: 1px solid var(--border);">المبلغ</th>' +
              '</tr>' +
            '</thead>' +
            '<tbody>' +
              transactionsHtml +
            '</tbody>' +
          '</table>' +
        '</div>' +
      '</div>';

  } catch (error) {
    console.error('Error generating report:', error);
    container.innerHTML = '<div style="text-align: center; padding: 40px; color: var(--danger);">فشل في تحميل التقرير</div>';
  }
}

function closeWalletReportModal() {
  const modal = document.getElementById('walletReportModal');
  if (modal) modal.classList.remove('show');
}

// تسميات أنواع الإيداع
function getDepositTypeLabel(type) {
  const labels = {
    'capital': 'رأس مال',
    'revenue': 'إيرادات/أرباح',
    'debt_collection': 'تحصيل ديون',
    'loan_received': 'قرض مستلم',
    'internal_transfer': 'تحويل داخلي',
    'shift_closing': 'تقفيل شفت'
  };
  return labels[type] || type;
}

// تسميات أنواع السحب/المصروفات
function getWithdrawTypeLabel(type) {
  const labels = {
    'owner_withdrawal': 'سحب شخصي',
    'operating_expense': 'مصروفات تشغيلية',
    'salary': 'رواتب',
    'supplier_payment': 'سداد موردين',
    'loan_payment': 'سداد قرض',
    'internal_transfer': 'تحويل داخلي',
    'to_cash_drawer': 'تحويل لدرج الكاش',
    'توريد أجهزة': 'توريد أجهزة',
    'مصروفات تشغيلية': 'مصروفات تشغيلية'
  };
  return labels[type] || type;
}

// تسميات أنواع المعاملات
function getTransactionTypeLabel(type) {
  const labels = {
    'deposit': 'إيداع',
    'withdrawal': 'سحب',
    'sale': 'بيع',
    'purchase': 'شراء',
    'expense': 'مصروف',
    'transfer': 'تحويل'
  };
  return labels[type] || type;
}

// تحميل مكتبات PDF
async function loadPDFLibraries() {
  var libs = [
    { name: 'html2canvas', url: 'libs/html2canvas.min.js', check: function() { return window.html2canvas; } },
    { name: 'jspdf', url: 'libs/jspdf.min.js', check: function() { return window.jspdf; } }
  ];
  for (var i = 0; i < libs.length; i++) {
    var lib = libs[i];
    if (!lib.check()) {
      await new Promise(function(resolve, reject) {
        var script = document.createElement('script');
        script.src = lib.url;
        script.onload = resolve;
        script.onerror = reject;
        document.head.appendChild(script);
      });
    }
  }
}

// تصدير PDF - نفس أسلوب كشف حساب العميل
async function exportWalletReportPDF() {
  var walletFilter = document.getElementById('reportWalletFilter');
  var dateFrom = document.getElementById('reportDateFrom');
  var dateTo = document.getElementById('reportDateTo');
  var selectedWalletId = walletFilter ? walletFilter.value : 'all';
  var dateFromValue = dateFrom ? dateFrom.value : '';
  var dateToValue = dateTo ? dateTo.value : '';

  // الحصول على اسم المحفظة المختارة
  var walletName = 'جميع المحافظ';
  if (selectedWalletId !== 'all' && allWallets && allWallets.length > 0) {
    var selectedWallet = allWallets.find(function(w) { return w.id == selectedWalletId; });
    if (selectedWallet) walletName = selectedWallet.name;
  }

  try {
    showToast('جاري إنشاء تقرير PDF...', 'info');

    // جلب المعاملات
    var url = 'elos-db://safe-transactions?limit=500';
    if (dateFromValue) url += '&from=' + dateFromValue;
    if (dateToValue) url += '&to=' + dateToValue;

    var res = await fetch(url);
    if (!res.ok) throw new Error(await res.text());

    var transactions = await res.json();

    // فلترة حسب المحفظة
    if (selectedWalletId !== 'all') {
      transactions = transactions.filter(function(t) { return t.wallet_id == selectedWalletId; });
    }

    // حساب الإحصائيات — المصروف الحقيقي = مصروفات تشغيلية فقط. مرتجعات/درج/عجز = سحوبات أخرى
    var totalDeposits = 0, totalWithdrawals = 0, totalExpensesReal = 0, totalPurchasesWithdrawals = 0, totalOtherWithdrawals = 0;
    var depositsByType = {};
    var withdrawalsByType = {};
    var withdrawalsByTypeReal = {};
    var purchasesByType = {};
    var otherWithdrawalsByType = {};

    transactions.forEach(function(t) {
      var amount = Number(t.amount || 0);
      var isInternalTransfer = t.type === 'transfer' || t.sub_type === 'internal_transfer';
      if (isInternalTransfer) return;

      if (t.type === 'deposit' || t.type === 'sale') {
        totalDeposits += amount;
        var subType = t.sub_type || t.category || 'أخرى';
        depositsByType[subType] = (depositsByType[subType] || 0) + amount;
      } else if (t.type === 'withdrawal' || t.type === 'expense' || t.type === 'purchase') {
        totalWithdrawals += amount;
        var subType = t.sub_type || t.category || 'أخرى';
        withdrawalsByType[subType] = (withdrawalsByType[subType] || 0) + amount;
        if (isRealExpense(t)) {
          totalExpensesReal += amount;
          withdrawalsByTypeReal[subType] = (withdrawalsByTypeReal[subType] || 0) + amount;
        } else if (t.type === 'purchase') {
          totalPurchasesWithdrawals += amount;
          purchasesByType[subType] = (purchasesByType[subType] || 0) + amount;
        } else {
          totalOtherWithdrawals += amount;
          otherWithdrawalsByType[subType] = (otherWithdrawalsByType[subType] || 0) + amount;
        }
      }
    });

    var netFlow = totalDeposits - totalWithdrawals;

    // تحميل المكتبات
    await loadPDFLibraries();

    var jsPDF = window.jspdf.jsPDF;
    var pdf = new jsPDF('p', 'mm', 'a4');
    var pageWidth = pdf.internal.pageSize.getWidth();
    var margin = 10;
    var contentWidth = pageWidth - (margin * 2);

    var summaryData = {
      totalDeposits: totalDeposits,
      totalWithdrawals: totalWithdrawals,
      totalExpensesReal: totalExpensesReal,
      totalPurchasesWithdrawals: totalPurchasesWithdrawals,
      totalOtherWithdrawals: totalOtherWithdrawals,
      netFlow: netFlow,
      depositsByType: depositsByType,
      withdrawalsByType: withdrawalsByTypeReal,
      purchasesByType: purchasesByType,
      otherWithdrawalsByType: otherWithdrawalsByType
    };

    // تقسيم المعاملات - 12 في كل صفحة
    var ROWS_PER_PAGE = 12;
    var totalPages = Math.max(1, Math.ceil(transactions.length / ROWS_PER_PAGE));

    for (var page = 0; page < totalPages; page++) {
      var startIdx = page * ROWS_PER_PAGE;
      var pageTransactions = transactions.slice(startIdx, startIdx + ROWS_PER_PAGE);

      // إنشاء محتوى HTML لهذه الصفحة
      var printContent = generateWalletStatementHTML(walletName, pageTransactions, summaryData, page + 1, totalPages, startIdx, dateFromValue, dateToValue);

      // إنشاء iframe مخفي
      var iframe = document.createElement('iframe');
      iframe.style.cssText = 'position:fixed;left:-9999px;top:0;width:794px;';
      document.body.appendChild(iframe);
      iframe.contentDocument.write(printContent);
      iframe.contentDocument.close();

      // انتظار تحميل المحتوى
      await new Promise(function(resolve) { setTimeout(resolve, 500); });

      var body = iframe.contentDocument.body;

      // تحويل لـ canvas
      var canvas = await html2canvas(body, {
        scale: 2,
        useCORS: true,
        allowTaint: true,
        backgroundColor: '#ffffff',
        width: 794,
        windowWidth: 794
      });

      var imgData = canvas.toDataURL('image/jpeg', 0.95);
      var imgWidth = contentWidth;
      var imgHeight = (canvas.height * contentWidth) / canvas.width;

      // إضافة صفحة جديدة (ما عدا الأولى)
      if (page > 0) {
        pdf.addPage();
      }

      pdf.addImage(imgData, 'JPEG', margin, margin, imgWidth, imgHeight);

      // تنظيف الـ iframe
      document.body.removeChild(iframe);
    }

    // حفظ الملف
    var fileName = 'كشف_حساب_' + walletName.replace(/\s+/g, '_') + '_' + new Date().toISOString().slice(0, 10) + '.pdf';
    pdf.save(fileName);

    showToast('تم حفظ التقرير بنجاح', 'success');

  } catch (error) {
    console.error('Export PDF error:', error);
    showToast('فشل إنشاء التقرير: ' + error.message, 'error');
  }
}

// قالب HTML لكشف حساب المحفظة
function generateWalletStatementHTML(walletName, transactions, summary, currentPage, totalPages, startIdx, dateFrom, dateTo) {
  var settings = JSON.parse(localStorage.getItem('appSettings') || '{}');
  var companyName = settings.companyName || 'ElOs';
  var companyLogo = settings.companyLogo || null;
  var today = new Date().toLocaleDateString('ar-EG', {
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });

  var logoHTML = companyLogo
    ? '<img src="' + companyLogo + '" alt="Logo" style="width: 60px; height: 60px; object-fit: contain; border-radius: 10px;">'
    : '<div style="width: 60px; height: 60px; background: linear-gradient(135deg, #3b82f6, #2563eb); border-radius: 10px; display: flex; align-items: center; justify-content: center; color: white; font-size: 24px; font-weight: bold;">' + companyName.charAt(0) + '</div>';

  var pageInfo = totalPages > 1 ? '<span style="font-size: 12px; color: #666;">صفحة ' + currentPage + ' من ' + totalPages + '</span>' : '';

  var fmt = function(n) { return Number(n || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }); };

  var dateRange = (dateFrom || 'البداية') + ' إلى ' + (dateTo || 'الآن');

  // بناء صفوف الجدول
  var tableRows = '';
  if (transactions.length === 0) {
    tableRows = '<tr><td colspan="5" style="text-align: center; padding: 30px; color: #999;">لا توجد معاملات مسجلة</td></tr>';
  } else {
    for (var i = 0; i < transactions.length; i++) {
      var tx = transactions[i];
      var dateStr = new Date(tx.created_at).toLocaleDateString('ar-EG');
      var isIncome = (tx.type === 'deposit' || tx.type === 'sale');
      var typeClass = isIncome ? 'deposit' : 'withdrawal';
      var typeText = getTransactionTypeLabel(tx.type);
      var colorStyle = isIncome ? '#10b981' : '#ef4444';
      var sign = isIncome ? '+' : '-';

      tableRows += '<tr>' +
        '<td style="font-weight: 600; color: #999;">' + (startIdx + i + 1) + '</td>' +
        '<td>' + dateStr + '</td>' +
        '<td><span class="type-badge ' + typeClass + '">' + typeText + '</span></td>' +
        '<td style="text-align: right; padding-right: 15px;">' + escapeHtml(tx.description || tx.category || '-') + '</td>' +
        '<td class="amount" style="color: ' + colorStyle + ';">' + sign + fmt(tx.amount) + ' ج.م</td>' +
        '</tr>';
    }
  }

  // بناء تفاصيل الإيداعات
  var depositsDetails = '';
  var depositEntries = Object.entries(summary.depositsByType);
  if (depositEntries.length === 0) {
    depositsDetails = '<div style="text-align: center; padding: 10px; color: #999; font-size: 12px;">لا توجد إيداعات</div>';
  } else {
    for (var j = 0; j < depositEntries.length; j++) {
      var type = depositEntries[j][0];
      var amount = depositEntries[j][1];
      depositsDetails += '<div style="display: flex; justify-content: space-between; padding: 8px; background: #f8f9fa; border-radius: 6px; margin-bottom: 4px;">' +
        '<span style="font-size: 12px;">' + getDepositTypeLabel(type) + '</span>' +
        '<span style="color: #10b981; font-weight: 600; font-size: 12px;">' + fmt(amount) + '</span>' +
        '</div>';
    }
  }

  // بناء تفاصيل المصروفات (خسارة فقط)
  var withdrawalsDetails = '';
  var withdrawalEntries = Object.entries(summary.withdrawalsByType || {});
  if (withdrawalEntries.length === 0) {
    withdrawalsDetails = '<div style="text-align: center; padding: 10px; color: #999; font-size: 12px;">لا توجد مصروفات (خسارة)</div>';
  } else {
    for (var k = 0; k < withdrawalEntries.length; k++) {
      var type = withdrawalEntries[k][0];
      var amount = withdrawalEntries[k][1];
      withdrawalsDetails += '<div style="display: flex; justify-content: space-between; padding: 8px; background: #f8f9fa; border-radius: 6px; margin-bottom: 4px;">' +
        '<span style="font-size: 12px;">' + getWithdrawTypeLabel(type) + '</span>' +
        '<span style="color: #ef4444; font-weight: 600; font-size: 12px;">' + fmt(amount) + '</span>' +
        '</div>';
    }
  }

  // بناء تفاصيل السحوبات (مشتريات وتوريد)
  var purchasesDetails = '';
  var purchaseEntries = Object.entries(summary.purchasesByType || {});
  if (purchaseEntries.length === 0) {
    purchasesDetails = '<div style="text-align: center; padding: 10px; color: #999; font-size: 12px;">لا توجد سحوبات مشتريات/توريد</div>';
  } else {
    for (var p = 0; p < purchaseEntries.length; p++) {
      var pType = purchaseEntries[p][0];
      var pAmount = purchaseEntries[p][1];
      purchasesDetails += '<div style="display: flex; justify-content: space-between; padding: 8px; background: #f8f9fa; border-radius: 6px; margin-bottom: 4px;">' +
        '<span style="font-size: 12px;">' + getWithdrawTypeLabel(pType) + '</span>' +
        '<span style="color: #f59e0b; font-weight: 600; font-size: 12px;">' + fmt(pAmount) + '</span>' +
        '</div>';
    }
  }

  // بناء تفاصيل السحوبات الأخرى (مرتجعات، مسحوبات درج، عجز، سحب)
  var otherWithdrawalsDetails = '';
  var otherEntries = Object.entries(summary.otherWithdrawalsByType || {});
  if (otherEntries.length === 0) {
    otherWithdrawalsDetails = '<div style="text-align: center; padding: 10px; color: #999; font-size: 12px;">لا توجد سحوبات أخرى</div>';
  } else {
    for (var o = 0; o < otherEntries.length; o++) {
      var oType = otherEntries[o][0];
      var oAmount = otherEntries[o][1];
      otherWithdrawalsDetails += '<div style="display: flex; justify-content: space-between; padding: 8px; background: #f8f9fa; border-radius: 6px; margin-bottom: 4px;">' +
        '<span style="font-size: 12px;">' + getWithdrawTypeLabel(oType) + '</span>' +
        '<span style="color: #6366f1; font-weight: 600; font-size: 12px;">' + fmt(oAmount) + '</span>' +
        '</div>';
    }
  }

  var netFlowColor = summary.netFlow >= 0 ? '#10b981' : '#ef4444';
  var netFlowSign = summary.netFlow >= 0 ? '+' : '';

  return '<!DOCTYPE html>' +
    '<html lang="ar" dir="rtl">' +
    '<head>' +
      '<meta charset="UTF-8">' +
      '<title>كشف حساب - ' + walletName + '</title>' +
      '<link href="https://fonts.googleapis.com/css2?family=Cairo:wght@400;600;700;800&display=swap" rel="stylesheet">' +
      '<style>' +
        '* { margin: 0; padding: 0; box-sizing: border-box; }' +
        'body {' +
          'font-family: "Cairo", "Segoe UI", Tahoma, sans-serif;' +
          'background: white;' +
          'color: #1a1a2e;' +
          'padding: 30px;' +
          'line-height: 1.6;' +
          'direction: rtl;' +
        '}' +
        '.header {' +
          'display: flex;' +
          'justify-content: space-between;' +
          'align-items: center;' +
          'border-bottom: 3px solid #3b82f6;' +
          'padding-bottom: 20px;' +
          'margin-bottom: 25px;' +
        '}' +
        '.company-info {' +
          'display: flex;' +
          'align-items: center;' +
          'gap: 15px;' +
        '}' +
        '.company-info h1 {' +
          'font-size: 26px;' +
          'color: #3b82f6;' +
          'font-weight: 800;' +
        '}' +
        '.company-info p {' +
          'color: #666;' +
          'font-size: 12px;' +
        '}' +
        '.statement-info {' +
          'text-align: left;' +
        '}' +
        '.statement-info h2 {' +
          'font-size: 18px;' +
          'color: #333;' +
          'margin-bottom: 5px;' +
        '}' +
        '.statement-info p {' +
          'font-size: 12px;' +
          'color: #666;' +
        '}' +
        '.wallet-card {' +
          'background: linear-gradient(135deg, #f8f9fa 0%, #e9ecef 100%);' +
          'border-radius: 12px;' +
          'padding: 20px;' +
          'margin-bottom: 25px;' +
          'border-right: 5px solid #3b82f6;' +
        '}' +
        '.wallet-card h3 {' +
          'font-size: 20px;' +
          'color: #333;' +
          'margin-bottom: 10px;' +
          'font-weight: 700;' +
        '}' +
        '.wallet-card .info-row {' +
          'display: flex;' +
          'gap: 40px;' +
          'margin-top: 8px;' +
        '}' +
        '.wallet-card .info-item {' +
          'display: flex;' +
          'align-items: center;' +
          'gap: 8px;' +
          'font-size: 14px;' +
        '}' +
        '.wallet-card .info-item .label { color: #666; }' +
        '.wallet-card .info-item .value { font-weight: 600; color: #333; }' +
        '.summary-cards {' +
          'display: flex;' +
          'gap: 15px;' +
          'margin-bottom: 25px;' +
        '}' +
        '.summary-card {' +
          'flex: 1;' +
          'background: white;' +
          'border: 2px solid #eee;' +
          'border-radius: 12px;' +
          'padding: 18px;' +
          'text-align: center;' +
        '}' +
        '.summary-card.deposits { border-top: 4px solid #10b981; }' +
        '.summary-card.withdrawals { border-top: 4px solid #ef4444; }' +
        '.summary-card.purchases { border-top: 4px solid #f59e0b; }' +
        '.summary-card.balance { border-top: 4px solid #3b82f6; }' +
        '.summary-card .label {' +
          'font-size: 12px;' +
          'color: #666;' +
          'margin-bottom: 8px;' +
          'font-weight: 600;' +
        '}' +
        '.summary-card .value {' +
          'font-size: 22px;' +
          'font-weight: 800;' +
        '}' +
        '.summary-card.deposits .value { color: #10b981; }' +
        '.summary-card.withdrawals .value { color: #ef4444; }' +
        '.summary-card.purchases .value { color: #f59e0b; }' +
        '.summary-card.balance .value { color: #3b82f6; }' +
        '.details-grid {' +
          'display: grid;' +
          'grid-template-columns: 1fr 1fr 1fr 1fr;' +
          'gap: 20px;' +
          'margin-bottom: 25px;' +
        '}' +
        '.details-section {' +
          'background: #fff;' +
          'border: 1px solid #eee;' +
          'border-radius: 10px;' +
          'padding: 15px;' +
        '}' +
        '.details-section h4 {' +
          'font-size: 14px;' +
          'color: #333;' +
          'margin-bottom: 10px;' +
          'padding-bottom: 8px;' +
          'border-bottom: 2px solid #eee;' +
        '}' +
        '.section-title {' +
          'font-size: 16px;' +
          'font-weight: 700;' +
          'color: #333;' +
          'margin-bottom: 12px;' +
          'display: flex;' +
          'align-items: center;' +
          'gap: 8px;' +
        '}' +
        'table {' +
          'width: 100%;' +
          'border-collapse: collapse;' +
          'margin-top: 10px;' +
          'font-size: 12px;' +
        '}' +
        'th {' +
          'background: #3b82f6;' +
          'color: white;' +
          'padding: 12px 10px;' +
          'text-align: center;' +
          'font-weight: 700;' +
          'font-size: 11px;' +
        '}' +
        'th:first-child { border-radius: 0 8px 0 0; }' +
        'th:last-child { border-radius: 8px 0 0 0; }' +
        'td {' +
          'padding: 10px;' +
          'border-bottom: 1px solid #eee;' +
          'text-align: center;' +
        '}' +
        'tr:nth-child(even) { background: #f8f9fa; }' +
        '.type-badge {' +
          'display: inline-block;' +
          'padding: 4px 10px;' +
          'border-radius: 20px;' +
          'font-size: 10px;' +
          'font-weight: 700;' +
        '}' +
        '.type-badge.deposit { background: #d1fae5; color: #10b981; }' +
        '.type-badge.withdrawal { background: #fee2e2; color: #ef4444; }' +
        '.amount { font-weight: 700; font-size: 12px; }' +
        '.footer {' +
          'margin-top: 30px;' +
          'padding-top: 15px;' +
          'border-top: 2px solid #eee;' +
          'text-align: center;' +
          'color: #666;' +
          'font-size: 11px;' +
        '}' +
        '.footer p { margin: 3px 0; }' +
      '</style>' +
    '</head>' +
    '<body>' +
      '<div class="header">' +
        '<div class="company-info">' +
          logoHTML +
          '<div>' +
            '<h1>' + companyName + '</h1>' +
            '<p>نظام المحاسبة المتكامل</p>' +
          '</div>' +
        '</div>' +
        '<div class="statement-info">' +
          '<h2>كشف حساب الخزنة</h2>' +
          '<p>تاريخ الإصدار: ' + today + '</p>' +
          pageInfo +
        '</div>' +
      '</div>' +

      '<div class="wallet-card">' +
        '<h3>' + walletName + '</h3>' +
        '<div class="info-row">' +
          '<div class="info-item">' +
            '<span class="label">الفترة:</span>' +
            '<span class="value">' + dateRange + '</span>' +
          '</div>' +
          '<div class="info-item">' +
            '<span class="label">عدد المعاملات:</span>' +
            '<span class="value">' + transactions.length + '</span>' +
          '</div>' +
        '</div>' +
      '</div>' +

      '<div class="summary-cards">' +
        '<div class="summary-card deposits">' +
          '<div class="label">إجمالي الإيداعات</div>' +
          '<div class="value">' + fmt(summary.totalDeposits) + ' ج.م</div>' +
        '</div>' +
        '<div class="summary-card withdrawals">' +
          '<div class="label">إجمالي المصروفات (خسارة)</div>' +
          '<div class="value">' + fmt(summary.totalExpensesReal != null ? summary.totalExpensesReal : 0) + ' ج.م</div>' +
        '</div>' +
        '<div class="summary-card purchases">' +
          '<div class="label">سحوبات (مشتريات وتوريد)</div>' +
          '<div class="value">' + fmt(summary.totalPurchasesWithdrawals != null ? summary.totalPurchasesWithdrawals : 0) + ' ج.م</div>' +
        '</div>' +
        '<div class="summary-card balance">' +
          '<div class="label">صافي التدفق</div>' +
          '<div class="value" style="color: ' + netFlowColor + ';">' + netFlowSign + fmt(summary.netFlow) + ' ج.م</div>' +
        '</div>' +
      '</div>' +

      '<div class="details-grid">' +
        '<div class="details-section">' +
          '<h4>تفاصيل الإيداعات</h4>' +
          depositsDetails +
        '</div>' +
        '<div class="details-section">' +
          '<h4>تفاصيل المصروفات (خسارة)</h4>' +
          withdrawalsDetails +
        '</div>' +
        '<div class="details-section">' +
          '<h4>تفاصيل السحوبات (مشتريات وتوريد)</h4>' +
          purchasesDetails +
        '</div>' +
        '<div class="details-section">' +
          '<h4>تفاصيل السحوبات الأخرى (مرتجعات، درج، عجز، سحب)</h4>' +
          otherWithdrawalsDetails +
        '</div>' +
      '</div>' +

      '<div class="section-title">تفاصيل المعاملات</div>' +
      '<table>' +
        '<thead>' +
          '<tr>' +
            '<th style="width: 40px;">#</th>' +
            '<th style="width: 90px;">التاريخ</th>' +
            '<th style="width: 80px;">النوع</th>' +
            '<th>الوصف</th>' +
            '<th style="width: 110px;">المبلغ</th>' +
          '</tr>' +
        '</thead>' +
        '<tbody>' +
          tableRows +
        '</tbody>' +
      '</table>' +

      '<div class="footer">' +
        '<p><strong>هذا كشف حساب رسمي صادر من ' + companyName + '</strong></p>' +
        '<p>تاريخ الطباعة: ' + new Date().toLocaleString('ar-EG') + '</p>' +
      '</div>' +
    '</body>' +
    '</html>';
}

// ═══════════════════════════════════════
// 🗑️ حذف معاملة من الخزنة
// ═══════════════════════════════════════
async function deleteSafeTransaction(transactionId) {
  const tx = transactions.find(t => t.id === transactionId);
  if (!tx) {
    showToast('المعاملة غير موجودة', 'error');
    return;
  }

  const confirmMsg = `هل أنت متأكد من حذف هذه المعاملة؟\n\nالنوع: ${getTypeLabel(tx.type)}\nالمبلغ: ${Number(tx.amount || 0).toLocaleString()} ج.م\nالفئة: ${tx.category || '-'}\nالوصف: ${tx.description || '-'}`;

  if (!confirm(confirmMsg)) return;

  try {
    const res = await fetch('elos-db://safe-transaction-delete', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: transactionId })
    });

    if (!res.ok) {
      const errData = await res.json().catch(() => ({}));
      throw new Error(errData.error || 'فشل في حذف المعاملة');
    }

    showToast('✅ تم حذف المعاملة بنجاح', 'success');

    // إعادة تحميل البيانات
    await loadTransactions();
    await loadPaymentWallets();
    renderTransactionsTable();

  } catch (err) {
    console.error('[SAFE] Delete transaction error:', err);
    showToast('❌ ' + err.message, 'error');
  }
}

// Make remaining functions available globally
if (typeof window !== 'undefined') {
  window.openDepositModalById = openDepositModalById;
  window.openWithdrawModalById = openWithdrawModalById;
  window.openTransferModalFromWallet = openTransferModalFromWallet;
  window.openWalletHistoryById = openWalletHistoryById;
  window.openWalletModalFromSafe = openWalletModalFromSafe;
  window.editWalletFromSafe = editWalletFromSafe;
  window.deleteWalletFromSafe = deleteWalletFromSafe;
  window.openBankAccountModalFromSafe = openBankAccountModalFromSafe;
  window.editBankAccountFromSafe = editBankAccountFromSafe;
  window.deleteBankAccountFromSafe = deleteBankAccountFromSafe;
  window.openWalletReportModal = openWalletReportModal;
  window.closeWalletReportModal = closeWalletReportModal;
  window.generateWalletReport = generateWalletReport;
  window.exportWalletReportPDF = exportWalletReportPDF;
  window.filterWallets = filterWallets;
  window.deleteSafeTransaction = deleteSafeTransaction;
}

function formatDate(dateStr) {
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

function formatDateShort(dateStr) {
  if (!dateStr) return '-';
  const date = new Date(dateStr);
  const now = new Date();
  
  if (date.toDateString() === now.toDateString()) {
    return date.toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' });
  }
  
  return date.toLocaleDateString('ar-EG', { month: 'short', day: 'numeric' });
}

// escapeHtml() is now imported from utils.js (window.escapeHtml)

// ═══════════════════════════════════════
// ⏰ Clock
// ═══════════════════════════════════════
function initClock() {
  updateClock();
  // ✅ استخدام IntervalManager لمنع تراكم الـ intervals
  if (window.IntervalManager) {
    window.IntervalManager.set('safe-clock', updateClock, 1000);
  } else {
    if (window._safeClockInterval) clearInterval(window._safeClockInterval);
    window._safeClockInterval = setInterval(updateClock, 1000);
  }
}

function updateClock() {
  const now = new Date();
  
  let hours = now.getHours();
  const minutes = now.getMinutes();
  const seconds = now.getSeconds();
  const ampm = hours >= 12 ? 'PM' : 'AM';
  
  hours = hours % 12 || 12;
  
  const timeStr = `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
  
  const timeEl = document.getElementById('clockTime');
  if (timeEl) {
    timeEl.innerHTML = `${timeStr} <span class="clock-period">${ampm}</span>`;
  }
  
  const dateEl = document.getElementById('clockDate');
  if (dateEl) {
    dateEl.textContent = now.toLocaleDateString('ar-EG', {
      weekday: 'short',
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  }
}

// ═══════════════════════════════════════
// 💬 Toast
// ═══════════════════════════════════════
function showToast(message, type = 'info', duration = 3000) {
  const toast = document.getElementById('toast');
  if (!toast) return;
  
  toast.textContent = message;
  toast.className = `toast ${type} show`;

  setTimeout(() => {
    toast.classList.remove('show');
  }, duration);
}

// ═══════════════════════════════════════════════════════════════
// MONEY TRANSFERS MODAL - تحويلات الأموال
// ═══════════════════════════════════════════════════════════════

function openMoneyTransfersModal() {
  const modal = document.getElementById('moneyTransfersModal');
  if (!modal) return;

  // Set default dates: current month
  const now = new Date();
  const firstOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const getYMD = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

  const fromEl = document.getElementById('safeTransfersDateFrom');
  const toEl = document.getElementById('safeTransfersDateTo');
  if (fromEl) fromEl.value = getYMD(firstOfMonth);
  if (toEl) toEl.value = getYMD(now);

  // Reset filters
  const typeFilter = document.getElementById('safeTransfersTypeFilter');
  const dirFilter = document.getElementById('safeTransfersDirFilter');
  if (typeFilter) typeFilter.value = '';
  if (dirFilter) dirFilter.value = '';

  modal.style.display = 'flex';
  loadSafeMoneyTransfers();
}

function closeMoneyTransfersModal() {
  const modal = document.getElementById('moneyTransfersModal');
  if (modal) modal.style.display = 'none';
}

// Close on outside click
document.getElementById('moneyTransfersModal')?.addEventListener('click', function(e) {
  if (e.target === this) closeMoneyTransfersModal();
});

async function loadSafeMoneyTransfers() {
  try {
    const dateFrom = document.getElementById('safeTransfersDateFrom')?.value || '';
    const dateTo = document.getElementById('safeTransfersDateTo')?.value || '';
    const typeFilter = document.getElementById('safeTransfersTypeFilter')?.value || '';
    const dirFilter = document.getElementById('safeTransfersDirFilter')?.value || '';

    let url = 'elos-db://money-transfers?';
    if (dateFrom) url += `from=${dateFrom}&`;
    if (dateTo) url += `to=${dateTo}&`;
    if (typeFilter) url += `transfer_type=${typeFilter}&`;

    const res = await fetch(url);
    if (!res.ok) throw new Error(await res.text());
    let transfers = await res.json();

    // Client-side direction filter (deferred = has client_id)
    if (dirFilter) {
      if (dirFilter === 'deferred') {
        transfers = transfers.filter(t => !!t.client_id);
      } else {
        transfers = transfers.filter(t => !t.client_id && t.direction === dirFilter);
      }
    }

    // Calculate stats
    let totalAmount = 0, totalCommission = 0;
    transfers.forEach(t => {
      totalAmount += Number(t.transfer_amount || 0);
      totalCommission += Number(t.commission || 0);
    });

    document.getElementById('safeTransfersCount').textContent = transfers.length;
    document.getElementById('safeTransfersTotalAmount').textContent = fmt(totalAmount) + ' ج.م';
    document.getElementById('safeTransfersTotalCommission').textContent = fmt(totalCommission) + ' ج.م';
    document.getElementById('safeTransfersTableCount').textContent = transfers.length + ' تحويل';

    renderSafeTransfersTypeBreakdown(transfers);
    renderSafeTransfersTable(transfers);

  } catch (e) {
    console.error('[SAFE] Error loading money transfers:', e);
    showToast('خطأ في تحميل التحويلات: ' + e.message, 'error');
  }
}

function renderSafeTransfersTypeBreakdown(transfers) {
  const container = document.getElementById('safeTransfersTypeBreakdown');
  if (!container) return;

  if (!transfers || transfers.length === 0) {
    container.innerHTML = '<div style="text-align:center; color:var(--text-muted); padding:12px; font-size:13px;">لا توجد تحويلات في هذه الفترة</div>';
    return;
  }

  // Group by type
  const groups = {};
  transfers.forEach(t => {
    const type = t.transfer_type || 'other';
    if (!groups[type]) groups[type] = { count: 0, amount: 0, commission: 0 };
    groups[type].count++;
    groups[type].amount += Number(t.transfer_amount || 0);
    groups[type].commission += Number(t.commission || 0);
  });

  const totalAmount = transfers.reduce((s, t) => s + Number(t.transfer_amount || 0), 0);

  container.innerHTML = Object.entries(groups)
    .sort((a, b) => b[1].amount - a[1].amount)
    .map(([type, data]) => {
      const name = SAFE_TRANSFER_TYPE_NAMES[type] || type;
      const color = SAFE_TRANSFER_TYPE_COLORS[type] || '#64748b';
      const pct = totalAmount > 0 ? (data.amount / totalAmount * 100).toFixed(1) : 0;
      return `
        <div style="display:flex; align-items:center; gap:10px; padding:8px 0; border-bottom:1px solid rgba(255,255,255,0.05);">
          <div style="width:8px; height:8px; border-radius:50%; background:${color}; flex-shrink:0;"></div>
          <span style="flex:1; font-size:13px; font-weight:600; color:var(--text-primary);">${name}</span>
          <span style="font-size:12px; color:var(--text-muted);">${data.count} تحويل</span>
          <span style="font-size:13px; font-weight:700; color:var(--text-primary); min-width:90px; text-align:left;">${fmt(data.amount)} ج.م</span>
          <span style="font-size:12px; color:#10b981; font-weight:600; min-width:80px; text-align:left;">عمولة: ${fmt(data.commission)}</span>
          <span style="font-size:11px; color:var(--text-muted); min-width:40px; text-align:left;">${pct}%</span>
        </div>
      `;
    }).join('');
}

function renderSafeTransfersTable(transfers) {
  const tbody = document.getElementById('safeTransfersTableBody');
  if (!tbody) return;

  if (!transfers || transfers.length === 0) {
    tbody.innerHTML = '<tr><td colspan="10" style="padding:30px; text-align:center; color:var(--text-secondary); font-size:13px;">لا توجد تحويلات في هذه الفترة</td></tr>';
    return;
  }

  // Sort by date descending
  const sorted = [...transfers].sort((a, b) => new Date(b.created_at) - new Date(a.created_at));

  tbody.innerHTML = sorted.map((t, i) => {
    const date = t.created_at ? new Date(t.created_at) : new Date();
    const dateStr = date.toLocaleDateString('ar-EG', { year: 'numeric', month: 'short', day: 'numeric' });
    const timeStr = date.toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' });
    const typeName = SAFE_TRANSFER_TYPE_NAMES[t.transfer_type] || t.transfer_type;
    const typeColor = SAFE_TRANSFER_TYPE_COLORS[t.transfer_type] || '#64748b';
    const isDeferred = !!t.client_id;
    const dirText = isDeferred ? '⏳ آجل' : (t.direction === 'deposit' ? '📥 إيداع' : '📤 سحب');
    const dirColor = isDeferred ? '#a78bfa' : (t.direction === 'deposit' ? '#10b981' : '#f59e0b');
    const customerName = isDeferred
      ? (t.client_name ? escapeHtml(t.client_name) : '-')
      : (t.customer_name ? escapeHtml(t.customer_name) : '-');
    const customerPhone = isDeferred
      ? (t.client_phone ? escapeHtml(t.client_phone) : '-')
      : (t.customer_phone ? escapeHtml(t.customer_phone) : '-');
    const wallets = (t.from_wallet_name || '-') + (t.to_wallet_name ? ' → ' + t.to_wallet_name : (isDeferred ? ' → حساب العميل' : ''));

    return `
      <tr style="border-bottom:1px solid rgba(255,255,255,0.04);">
        <td style="padding:10px 8px; font-size:12px; color:var(--text-muted);">${i + 1}</td>
        <td style="padding:10px 8px; font-size:12px; white-space:nowrap;">${dateStr}<br><span style="color:var(--text-muted);font-size:11px;">${timeStr}</span></td>
        <td style="padding:10px 8px;"><span style="background:${typeColor}20;color:${typeColor};padding:2px 8px;border-radius:6px;font-size:11px;font-weight:700;">${typeName}</span></td>
        <td style="padding:10px 8px;"><span style="color:${dirColor};font-weight:700;font-size:12px;">${dirText}</span></td>
        <td style="padding:10px 8px; font-weight:800; font-size:13px;">${fmt(t.transfer_amount)} ج.م</td>
        <td style="padding:10px 8px; color:#10b981; font-weight:700; font-size:12px;">${fmt(t.commission)} ج.م</td>
        <td style="padding:10px 8px; font-size:12px;">${customerName}</td>
        <td style="padding:10px 8px; font-size:12px; color:var(--text-muted); direction:ltr; text-align:center;">${customerPhone}</td>
        <td style="padding:10px 8px; font-size:11px; color:var(--text-muted);">${escapeHtml(wallets)}</td>
        <td style="padding:10px 8px; font-size:12px; color:var(--text-muted);">${escapeHtml(t.username || '-')}</td>
      </tr>
    `;
  }).join('');
}

// ═══════════════════════════════════════
// 🔧 REPAIR DAY CLOSINGS
// ═══════════════════════════════════════

// تبديل التابز (نقطة البيع / الصيانة)
function switchClosingsTab(tab) {
  // تحديث أزرار التابز
  document.querySelectorAll('.closings-tab').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.tab === tab);
  });
  // تحديث محتوى التابز
  document.getElementById('posClosingsTab').classList.toggle('active', tab === 'pos');
  document.getElementById('repairsClosingsTab').classList.toggle('active', tab === 'repairs');
}

// تحميل تقفيلات يومية الصيانة
async function loadRepairClosings() {
  try {
    const res = await fetch('elos-db://repair-day-closings?limit=50');
    if (!res.ok) throw new Error(await res.text());

    const data = await res.json();
    repairClosings = data.closings || [];

    renderRepairClosingsList();
    renderRepairClosingsTable();

    // تحديث عدد التقفيلات في التاب
    const countEl = document.getElementById('repairClosingsCount');
    if (countEl) countEl.textContent = repairClosings.length;

    // تحديث عدد نقطة البيع
    const posCountEl = document.getElementById('posClosingsCount');
    if (posCountEl) posCountEl.textContent = shiftClosings.length;

  } catch (error) {
    Logger.error('Error loading repair closings:', error);
  }
}

// عرض قائمة تقفيلات الصيانة (الكروت في الصفحة الرئيسية)
function renderRepairClosingsList() {
  const container = document.getElementById('repairClosingsList');
  if (!container) return;

  if (!repairClosings || repairClosings.length === 0) {
    container.innerHTML = `
      <div class="empty-state">
        <div class="empty-state-icon">🔧</div>
        <div>لا توجد تقفيلات صيانة حالياً</div>
      </div>
    `;
    return;
  }

  const recent = repairClosings.slice(0, 5);

  container.innerHTML = recent.map(c => {
    const walletParts = [];
    if (Number(c.cash_total || 0) > 0) walletParts.push(`💵 ${Number(c.cash_total).toLocaleString()}`);
    if (Number(c.mobile_wallet_total || 0) > 0) walletParts.push(`📱 ${Number(c.mobile_wallet_total).toLocaleString()}`);
    if (Number(c.bank_total || 0) > 0) walletParts.push(`🏦 ${Number(c.bank_total).toLocaleString()}`);

    return `
      <div class="shift-closing-item" onclick="openRepairClosingDetails(${c.id})">
        <div class="shift-closing-icon" style="background: linear-gradient(135deg, rgba(245,158,11,0.15) 0%, rgba(249,115,22,0.15) 100%); border-color: rgba(245,158,11,0.3);">
          🔧
        </div>
        <div class="shift-closing-info">
          <div class="shift-closing-date">${formatDate(c.closing_date)} <span style="color: var(--warning); font-size: 12px; font-weight: 600;">• ${escapeHtml(c.closed_by || 'غير محدد')}</span></div>
          <div class="shift-closing-details">
            <div class="shift-closing-detail">
              <span>📋</span>
              <span>${c.new_tickets || 0} جديدة</span>
            </div>
            <div class="shift-closing-detail">
              <span>✅</span>
              <span>${c.delivered_tickets || 0} تسليم</span>
            </div>
            <div class="shift-closing-detail">
              <span>${walletParts.join(' • ') || '-'}</span>
            </div>
          </div>
        </div>
        <div class="shift-closing-amount">
          <div class="shift-closing-total">${Number(c.collections || 0).toLocaleString()}</div>
          <div style="font-size: 11px; color: var(--text-secondary);">ج.م تحصيلات</div>
        </div>
      </div>
    `;
  }).join('');
}

// عرض جدول تقفيلات الصيانة (في المودال)
function renderRepairClosingsTable() {
  const tbody = document.getElementById('repairClosingsTableBody');
  if (!tbody) return;

  if (!repairClosings || repairClosings.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="9" class="empty-state">
          <div class="empty-state-icon">🔧</div>
          <div>لا توجد تقفيلات صيانة</div>
        </td>
      </tr>
    `;
    return;
  }

  tbody.innerHTML = repairClosings.map((c, idx) => {
    return `
      <tr onclick="openRepairClosingDetails(${c.id})" style="cursor:pointer;">
        <td>${idx + 1}</td>
        <td>${formatDate(c.closing_date)}</td>
        <td style="color: var(--warning); font-weight: 600;">${escapeHtml(c.closed_by || 'غير محدد')}</td>
        <td>${c.new_tickets || 0}</td>
        <td style="color: var(--success); font-weight: 600;">${c.delivered_tickets || 0}</td>
        <td style="font-weight: 700;">${Number(c.collections || 0).toLocaleString()}</td>
        <td>${Number(c.cash_total || 0).toLocaleString()}</td>
        <td>${Number(c.mobile_wallet_total || 0).toLocaleString()}</td>
        <td>${Number(c.bank_total || 0).toLocaleString()}</td>
      </tr>
    `;
  }).join('');
}

// فتح/إغلاق مودال قائمة تقفيلات الصيانة
function openRepairClosingsModal() {
  document.getElementById('repairClosingsModal').classList.add('show');
}

function closeRepairClosingsModal() {
  document.getElementById('repairClosingsModal').classList.remove('show');
}

// فتح/إغلاق مودال تفاصيل تقفيل صيانة
function closeRepairClosingDetailsModal() {
  document.getElementById('repairClosingDetailsModal').classList.remove('show');
}

async function openRepairClosingDetails(closingId) {
  const modal = document.getElementById('repairClosingDetailsModal');
  const headerEl = document.getElementById('rcDetailHeader');
  const statsEl = document.getElementById('rcStatsRow');
  const financialEl = document.getElementById('rcFinancialBox');
  const paymentsEl = document.getElementById('rcPaymentsList');
  const deliveredSection = document.getElementById('rcDeliveredSection');
  const deliveredEl = document.getElementById('rcDeliveredList');

  // Reset
  paymentsEl.innerHTML = '<p class="loading-text">جاري تحميل التفاصيل...</p>';
  deliveredSection.style.display = 'none';
  headerEl.innerHTML = '';
  statsEl.innerHTML = '';
  financialEl.innerHTML = '';

  modal.classList.add('show');

  // إيجاد بيانات التقفيل المحلية
  let closing = repairClosings.find(c => c.id === closingId);

  try {
    const res = await fetch(`elos-db://repair-day-closings/${closingId}/details`);
    if (!res.ok) throw new Error(await res.text());

    const data = await res.json();
    closing = data.closing || closing;
    const payments = data.payments || [];
    const deliveredTickets = data.delivered_tickets || [];

    // هيدر - التاريخ والموظف
    headerEl.innerHTML = `
      <div class="rc-date">📅 ${formatDate(closing.closing_date)}</div>
      <div class="rc-employee">👤 ${escapeHtml(closing.closed_by || 'غير محدد')}</div>
    `;

    // بطاقات الإحصائيات
    statsEl.innerHTML = `
      <div class="rc-stat-card">
        <div class="rc-stat-icon">📋</div>
        <div class="rc-stat-value">${closing.new_tickets || 0}</div>
        <div class="rc-stat-label">تذاكر جديدة</div>
      </div>
      <div class="rc-stat-card">
        <div class="rc-stat-icon">✅</div>
        <div class="rc-stat-value" style="color: var(--success);">${closing.delivered_tickets || 0}</div>
        <div class="rc-stat-label">تم التسليم</div>
      </div>
      <div class="rc-stat-card">
        <div class="rc-stat-icon">❌</div>
        <div class="rc-stat-value" style="color: var(--danger);">${closing.cancelled_tickets || 0}</div>
        <div class="rc-stat-label">ملغاة</div>
      </div>
      <div class="rc-stat-card">
        <div class="rc-stat-icon">📂</div>
        <div class="rc-stat-value" style="color: var(--accent);">${closing.open_tickets || 0}</div>
        <div class="rc-stat-label">مفتوحة</div>
      </div>
    `;

    // الملخص المالي
    financialEl.innerHTML = `
      <div class="rc-fin-title">💰 الملخص المالي</div>
      <div class="rc-fin-row">
        <span class="rc-fin-label">إيرادات (فواتير مُسلَّمة)</span>
        <span class="rc-fin-value" style="color: var(--success);">${Number(closing.revenue || 0).toLocaleString()} ج.م</span>
      </div>
      <div class="rc-fin-row">
        <span class="rc-fin-label">التحصيلات (عربونات + دفعات)</span>
        <span class="rc-fin-value">${Number(closing.collections || 0).toLocaleString()} ج.م</span>
      </div>
      <div class="rc-fin-divider"></div>
      <div class="rc-wallets-row">
        <div class="rc-wallet-item">
          <span>💵</span>
          <span>كاش:</span>
          <span class="rc-wallet-value">${Number(closing.cash_total || 0).toLocaleString()}</span>
        </div>
        <div class="rc-wallet-item">
          <span>📱</span>
          <span>محفظة:</span>
          <span class="rc-wallet-value">${Number(closing.mobile_wallet_total || 0).toLocaleString()}</span>
        </div>
        <div class="rc-wallet-item">
          <span>🏦</span>
          <span>بنكي:</span>
          <span class="rc-wallet-value">${Number(closing.bank_total || 0).toLocaleString()}</span>
        </div>
      </div>
    `;

    // تفاصيل المدفوعات
    if (payments.length === 0) {
      paymentsEl.innerHTML = '<p style="text-align: center; color: var(--text-secondary); padding: 16px;">لا توجد مدفوعات في هذا اليوم</p>';
    } else {
      const kindLabels = {
        deposit: { text: '💰 عربون / دفعة مقدمة', cls: 'deposit', icon: '💰' },
        final: { text: '✅ تحصيل نهائي (جهاز مُسلَّم)', cls: 'final', icon: '✅' },
        refund: { text: '↩️ استرداد', cls: 'refund', icon: '↩️' }
      };

      const walletLabels = {
        cash: '💵 كاش',
        mobile_wallet: '📱 محفظة',
        bank: '🏦 بنكي'
      };

      paymentsEl.innerHTML = payments.map(p => {
        const kind = kindLabels[p.effective_kind] || kindLabels.deposit;
        const walletLabel = walletLabels[p.wallet_type] || p.wallet_type;
        const isRefund = p.effective_kind === 'refund';

        return `
          <div class="rc-payment-item">
            <div class="rc-pay-icon ${kind.cls}">${kind.icon}</div>
            <div class="rc-pay-info">
              <div class="rc-pay-device">${escapeHtml(p.device_brand || '')} ${escapeHtml(p.device_model || 'جهاز')}</div>
              <div class="rc-pay-customer">${escapeHtml(p.customer_name || '-')} • تذكرة #${p.ticket_no || '-'}</div>
              <span class="rc-pay-kind-label ${kind.cls}">${kind.text}</span>
            </div>
            <div style="text-align: left;">
              <div class="rc-pay-amount ${isRefund ? 'refund' : ''}">${isRefund ? '-' : ''}${Number(p.amount || 0).toLocaleString()} ج.م</div>
              <div class="rc-pay-wallet-tag">${walletLabel}</div>
            </div>
          </div>
        `;
      }).join('');
    }

    // أجهزة تم تسليمها
    if (deliveredTickets.length > 0) {
      deliveredSection.style.display = 'block';
      deliveredEl.innerHTML = deliveredTickets.map(t => `
        <div class="rc-delivered-item">
          <div class="rc-del-info">
            <strong>#${t.ticket_no}</strong> • ${escapeHtml(t.device_brand || '')} ${escapeHtml(t.device_model || '')} • ${escapeHtml(t.customer_name || '-')}
          </div>
          <div class="rc-del-cost">${Number(t.total_cost || 0).toLocaleString()} ج.م</div>
        </div>
      `).join('');
    }

  } catch (error) {
    Logger.error('Error loading repair closing details:', error);
    paymentsEl.innerHTML = `<p style="text-align: center; color: var(--danger); padding: 16px;">❌ فشل في تحميل التفاصيل: ${escapeHtml(error.message)}</p>`;
  }
}
