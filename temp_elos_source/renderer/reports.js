// ═══════════════════════════════════════════════════════════════
// 📊 ELOS ERP REPORTS & ANALYTICS SYSTEM v2.0
// نظام التقارير والتحليلات المتكامل
// ═══════════════════════════════════════════════════════════════

// Fallbacks if utils.js not loaded yet
if (!window.Logger) window.Logger = { log: () => {}, warn: () => {}, error: console.error, debug: () => {}, info: () => {} };
if (!window.fmt) window.fmt = (n, decimals = 2) => Number(n || 0).toLocaleString('en-US', { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
if (!window.escapeHtml) window.escapeHtml = (text) => { if (text === null || text === undefined) return ''; const div = document.createElement('div'); div.textContent = String(text); return div.innerHTML; };
const fmt = window.fmt;
const escapeHtml = window.escapeHtml;

let currentTab = 'dashboard';
let charts = {};
let reportsData = {
  devices: [],
  accessories: [],
  sales: [],
  purchases: [],
  partners: [],
  distributions: [],
  clients: [],
  suppliers: [],
  cashflow: [],
  warehouses: [],
  accessorySales: [],  // حركات بيع الإكسسوارات
  accessoryPurchases: [],  // حركات شراء الإكسسوارات
  invoices: [],  // فواتير نقطة البيع
  repairs: [],  // تذاكر الصيانة
  supplierTransactions: [],  // معاملات الموردين (مشتريات، مدفوعات، مرتجعات)
  repairPartsPurchases: [],  // مشتريات قطع الصيانة
  repairPartsPosSales: [],   // مبيعات قطع الغيار من نقطة البيع
  repairPartsSales: []       // مبيعات قطع الغيار من الصيانة (مستهلكة/مخصومة)
};

// ✅ المحافظ الفعلية من قاعدة البيانات (للتقارير)
let paymentWallets = [];

// fmt() is now imported from utils.js (window.fmt)

// ═══════════════════════════════════════════════════════════════
// ⏰ HEADER CLOCK
// ═══════════════════════════════════════════════════════════════
function initHeaderClock() {
  const updateClock = () => {
    const now = new Date();
    const hours = String(now.getHours()).padStart(2, '0');
    const minutes = String(now.getMinutes()).padStart(2, '0');
    const seconds = String(now.getSeconds()).padStart(2, '0');
    document.getElementById('headerTime').textContent = `${hours}:${minutes}:${seconds}`;
    
    const days = ['الأحد', 'الإثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت'];
    const dayName = days[now.getDay()];
    const day = now.getDate();
    const month = now.getMonth() + 1;
    const year = now.getFullYear();
    document.getElementById('headerDate').textContent = `${dayName} ${day}/${month}/${year}`;
  };
  
  updateClock();
  // ✅ استخدام IntervalManager لمنع تراكم الـ intervals
  if (window.IntervalManager) {
    window.IntervalManager.set('reports-clock', updateClock, 1000);
  } else {
    // حفظ الـ interval للتنظيف لاحقاً
    if (window._reportsClockInterval) clearInterval(window._reportsClockInterval);
    window._reportsClockInterval = setInterval(updateClock, 1000);
  }
}

// ═══════════════════════════════════════════════════════════════
// 🎯 TAB SWITCHING
// ═══════════════════════════════════════════════════════════════
function switchTab(tabName) {
  currentTab = tabName;
  
  document.querySelectorAll('.tab').forEach(tab => {
    tab.classList.toggle('active', tab.dataset.tab === tabName);
  });
  
  document.querySelectorAll('.panel').forEach(panel => {
    panel.classList.remove('active');
  });
  
  document.getElementById(tabName + 'Panel')?.classList.add('active');
  
  // Load specific report data
  loadTabData(tabName);
}

async function loadTabData(tabName) {
  switch(tabName) {
    case 'dashboard': await loadDashboard(); break;
    case 'devices': await loadDevicesReport(); break;
    case 'accessories': await loadAccessoriesReport(); break;
    case 'repairParts': await loadRepairPartsReport(); break;
    case 'sales': await loadSalesReport(); break;
    case 'repairs': await loadRepairsReport(); break;
    case 'purchases': await loadPurchasesReport(); break;
    case 'invoices': await loadInvoicesReport(); break;
    case 'partners': await loadPartnersReport(); break;
    case 'cashflow': await loadCashflowReport(); break;
    case 'clients': await loadClientsReport(); break;
    case 'capital': await loadCapitalReport(); break;
    case 'profits': await loadProfitsReport(); break;
    case 'expenses': await loadExpensesReport(); break;
    case 'salesReturns': await loadSalesReturnsReport(); break;
    case 'purchaseReturns': await loadPurchaseReturnsReport(); break;
    case 'moneyTransfers': await loadMoneyTransfersReport(); break;
  }
}

// ═══════════════════════════════════════════════════════════════
// 📊 LOAD ALL REPORTS
// ═══════════════════════════════════════════════════════════════
async function loadAllReports() {
  showToast('جاري تحميل التقارير...', 'info');
  
  try {
    const dateFrom = document.getElementById('dateFrom').value;
    const dateTo = document.getElementById('dateTo').value;
    
    // Load all data
    await Promise.all([
      loadDevicesData(),
      loadAccessoriesData(),
      loadAccessorySalesData(dateFrom, dateTo),
      loadAccessoryPurchasesData(dateFrom, dateTo),  // مشتريات الإكسسوارات
      loadSalesData(dateFrom, dateTo),
      loadPurchasesData(dateFrom, dateTo),
      loadRepairPartsSalesData(dateFrom, dateTo),  // مبيعات قطع الغيار POS
      loadRepairPartsData(),  // بيانات قطع الغيار
      loadPartnersData(),
      loadClientsData(),
      loadCashflowData(dateFrom, dateTo)
    ]);
    
    // Refresh current tab
    await loadTabData(currentTab);
    
    showToast('تم تحميل التقارير بنجاح', 'success');
  } catch (error) {
    Logger.error('Error loading reports:', error);
    showToast('خطأ في تحميل التقارير', 'error');
  }
}

// ═══════════════════════════════════════════════════════════════
// 📱 LOAD DATA FUNCTIONS
// ═══════════════════════════════════════════════════════════════
async function loadDevicesData() {
  try {
    const response = await fetch('elos-db://inventory');
    if (response.ok) {
      const data = await response.json();
      reportsData.devices = Array.isArray(data) ? data : (data.devices || data.inventory || []);
    }
  } catch (e) { 
    Logger.error('Error loading devices:', e);
    reportsData.devices = [];
  }
}

async function loadAccessoriesData() {
  try {
    const response = await fetch('elos-db://accessories');
    if (response.ok) {
      const data = await response.json();
      // API returns { accessories: [...] } - extract the array
      reportsData.accessories = Array.isArray(data) ? data : (data.accessories || []);
    }
  } catch (e) {
    Logger.error('Error loading accessories:', e);
    reportsData.accessories = [];
  }
}

async function loadAccessorySalesData(dateFrom, dateTo) {
  try {
    // جلب حركات البيع من accessory_movements
    let url = 'elos-db://accessory-movements?type=sale';
    if (dateFrom && dateTo) url += `&from=${dateFrom}&to=${dateTo}`;
    Logger.log('[REPORTS] Fetching accessory sales from:', url);
    const response = await fetch(url);
    Logger.log('[REPORTS] Accessory sales response status:', response.status);
    if (response.ok) {
      const data = await response.json();
      Logger.log('[REPORTS] Accessory sales raw data:', data);
      reportsData.accessorySales = Array.isArray(data) ? data : (data.movements || []);
      Logger.log('[REPORTS] Accessory sales stored:', reportsData.accessorySales.length, 'records');
    } else {
      Logger.error('[REPORTS] Failed to load accessory sales:', response.status);
      reportsData.accessorySales = [];
    }
  } catch (e) {
    Logger.error('[REPORTS] Error loading accessory sales:', e);
    reportsData.accessorySales = [];
  }
}

async function loadAccessoryPurchasesData(dateFrom, dateTo) {
  try {
    // جلب حركات الشراء من accessory_movements
    let url = 'elos-db://accessory-movements?type=purchase';
    if (dateFrom && dateTo) url += `&from=${dateFrom}&to=${dateTo}`;
    const response = await fetch(url);
    if (response.ok) {
      const data = await response.json();
      reportsData.accessoryPurchases = Array.isArray(data) ? data : (data.movements || []);
      Logger.log('[REPORTS] Accessory purchases loaded:', reportsData.accessoryPurchases.length);
    } else {
      reportsData.accessoryPurchases = [];
    }
  } catch (e) {
    Logger.error('[REPORTS] Error loading accessory purchases:', e);
    reportsData.accessoryPurchases = [];
  }
}

// جلب بيانات قطع الغيار
async function loadRepairPartsData() {
  try {
    const response = await fetch('elos-db://repair-parts?all=true');
    if (response.ok) {
      const data = await response.json();
      reportsData.repairParts = Array.isArray(data) ? data : (data.parts || []);
      Logger.log('[REPORTS] Repair parts loaded:', reportsData.repairParts.length);
    }
  } catch (e) {
    Logger.error('[REPORTS] Error loading repair parts:', e);
    reportsData.repairParts = [];
  }
}

// جلب مبيعات قطع الغيار (نقطة البيع + الصيانة)
async function loadRepairPartsSalesData(dateFrom, dateTo) {
  reportsData.repairPartsPosSales = [];
  reportsData.repairPartsSales = [];
  if (!dateFrom || !dateTo) return;
  try {
    // مبيعات قطع الغيار من نقطة البيع
    const posUrl = `elos-db://repair-parts-pos-sales?from=${dateFrom}&to=${dateTo}&limit=5000`;
    const posRes = await fetch(posUrl);
    if (posRes.ok) {
      const posData = await posRes.json();
      reportsData.repairPartsPosSales = posData.sales || [];
      Logger.log('[REPORTS] Repair parts POS sales:', reportsData.repairPartsPosSales.length);
    }
  } catch (e) {
    Logger.warn('[REPORTS] Error loading repair parts POS sales:', e);
  }
  try {
    // مبيعات قطع الغيار من الصيانة (مستهلكة/مخصومة عند التسليم)
    const repUrl = `elos-db://repair-parts-sales?from=${dateFrom}&to=${dateTo}`;
    const repRes = await fetch(repUrl);
    if (repRes.ok) {
      const repData = await repRes.json();
      reportsData.repairPartsSales = Array.isArray(repData) ? repData : [];
      Logger.log('[REPORTS] Repair parts (maintenance) sales:', reportsData.repairPartsSales.length);
    }
  } catch (e) {
    Logger.warn('[REPORTS] Error loading repair parts sales:', e);
  }
}

async function loadSalesData(dateFrom, dateTo) {
  try {
    let url = 'elos-db://sales';
    if (dateFrom && dateTo) url += `?from=${dateFrom}&to=${dateTo}&include_returned=true`;
    else url += '?include_returned=true';
    const response = await fetch(url);
    if (response.ok) {
      const data = await response.json();
      reportsData.sales = Array.isArray(data) ? data : (data.sales || []);
    }
  } catch (e) { 
    Logger.error('Error loading sales:', e);
    reportsData.sales = [];
  }
}

async function loadPurchasesData(dateFrom, dateTo) {
  try {
    // جلب مشتريات الأجهزة
    let url = 'elos-db://purchases';
    if (dateFrom && dateTo) url += `?from=${dateFrom}&to=${dateTo}`;
    const response = await fetch(url);
    if (response.ok) {
      const data = await response.json();
      reportsData.purchases = Array.isArray(data) ? data : (data.purchases || []);
    }
    
    // ✅ جلب معاملات الموردين (مشتريات، مدفوعات، مرتجعات)
    try {
      let supplierTxUrl = 'elos-db://supplier-transactions';
      if (dateFrom && dateTo) supplierTxUrl += `?from=${dateFrom}&to=${dateTo}`;
      const supplierTxRes = await fetch(supplierTxUrl);
      if (supplierTxRes.ok) {
        const supplierTxData = await supplierTxRes.json();
        reportsData.supplierTransactions = Array.isArray(supplierTxData) 
          ? supplierTxData 
          : (supplierTxData.transactions || []);
        Logger.log('[REPORTS] Loaded supplier transactions:', reportsData.supplierTransactions.length);
      }
    } catch (e) {
      Logger.warn('[REPORTS] Could not load supplier transactions:', e);
      reportsData.supplierTransactions = [];
    }
    
    // ✅ جلب مشتريات قطع الصيانة (repair_parts_movements من نوع purchase)
    try {
      let repairPartsPurchasesUrl = 'elos-db://repair-parts-purchases';
      if (dateFrom && dateTo) repairPartsPurchasesUrl += `?from=${dateFrom}&to=${dateTo}`;
      const repairPartsRes = await fetch(repairPartsPurchasesUrl);
      if (repairPartsRes.ok) {
        const repairPartsData = await repairPartsRes.json();
        reportsData.repairPartsPurchases = Array.isArray(repairPartsData) 
          ? repairPartsData 
          : (repairPartsData.purchases || repairPartsData.movements || []);
        Logger.log('[REPORTS] Loaded repair parts purchases:', reportsData.repairPartsPurchases?.length || 0);
      } else {
        reportsData.repairPartsPurchases = [];
      }
    } catch (e) {
      Logger.warn('[REPORTS] Could not load repair parts purchases:', e);
      reportsData.repairPartsPurchases = [];
    }
  } catch (e) { 
    Logger.error('Error loading purchases:', e);
    reportsData.purchases = [];
    reportsData.supplierTransactions = [];
    reportsData.repairPartsPurchases = [];
  }
}

async function loadPartnersData() {
  try {
    const response = await fetch('elos-db://partners');
    if (response.ok) {
      const data = await response.json();
      reportsData.partners = Array.isArray(data) ? data : (data.partners || []);
    }
    
    const distResponse = await fetch('elos-db://partner-distributions');
    if (distResponse.ok) {
      const distData = await distResponse.json();
      reportsData.distributions = Array.isArray(distData) ? distData : (distData.distributions || []);
    }
  } catch (e) { 
    Logger.error('Error loading partners:', e);
    reportsData.partners = [];
    reportsData.distributions = [];
  }
}

async function loadClientsData() {
  try {
    const clientsRes = await fetch('elos-db://clients');
    if (clientsRes.ok) {
      const clientsData = await clientsRes.json();
      reportsData.clients = Array.isArray(clientsData) ? clientsData : (clientsData.clients || []);
    }
    
    const suppliersRes = await fetch('elos-db://suppliers');
    if (suppliersRes.ok) {
      const suppliersData = await suppliersRes.json();
      reportsData.suppliers = Array.isArray(suppliersData) ? suppliersData : (suppliersData.suppliers || []);
    }
  } catch (e) { 
    Logger.error('Error loading clients:', e);
    reportsData.clients = [];
    reportsData.suppliers = [];
  }
}

async function loadCashflowData(dateFrom, dateTo) {
  try {
    // جلب حركات الخزنة فقط (safe_transactions)
    // ملاحظة: نعرض حركات الخزنة فقط لأن cash_ledger يحتوي على نفس العمليات
    // وعرض الاتنين معاً يؤدي لتكرار العمليات
    let safeUrl = 'elos-db://safe-transactions';
    if (dateFrom && dateTo) safeUrl += `?from=${dateFrom}&to=${dateTo}`;
    const safeRes = await fetch(safeUrl);
    let safeTransactions = [];
    if (safeRes.ok) {
      const data = await safeRes.json();
      safeTransactions = Array.isArray(data) ? data : (data.transactions || []);
    }

    // ترتيب حسب التاريخ (الأقدم أولاً)
    safeTransactions.sort((a, b) => new Date(a.created_at) - new Date(b.created_at));

    // حساب الرصيد التراكمي
    let runningBalance = 0;
    safeTransactions.forEach(t => {
      const amount = parseFloat(t.amount) || 0;
      // الإيداع والمبيعات = تدفق داخل (زيادة)
      // السحب والمصروفات والمشتريات والتحويل = تدفق خارج (نقص)
      if (['deposit', 'sale'].includes(t.type)) {
        runningBalance += amount;
      } else {
        runningBalance -= amount;
      }
      t.balance = runningBalance;
      t.source = 'safe';
    });

    reportsData.cashflow = safeTransactions;
    reportsData.safeTransactions = safeTransactions;

    Logger.log('[REPORTS] Cashflow loaded:', safeTransactions.length, 'transactions');
  } catch (e) {
    Logger.error('Error loading cashflow:', e);
    reportsData.cashflow = [];
  }
}

// ═══════════════════════════════════════════════════════════════
// 📊 DASHBOARD
// ═══════════════════════════════════════════════════════════════
async function loadDashboard() {
  const devices = reportsData.devices || [];
  const accessories = reportsData.accessories || [];
  const sales = reportsData.sales || [];
  const partners = reportsData.partners || [];
  
  // Calculate stats
  const devicesSold = devices.filter(d => d.status === 'sold');
  const devicesInStock = devices.filter(d => d.status === 'in_stock');
  
  const totalDeviceSales = devicesSold.reduce((sum, d) => sum + (parseFloat(d.sell_price) || 0), 0);
  const totalDeviceCost = devicesSold.reduce((sum, d) => sum + (parseFloat(d.purchase_cost) || 0), 0);
  const deviceProfit = totalDeviceSales - totalDeviceCost;

  // حساب أرباح الإكسسوارات من جدول accessory_movements (نوع sale)
  const accessorySalesData = reportsData.accessorySales || [];
  Logger.log('[REPORTS] Accessory sales data:', accessorySalesData.length, 'records');

  // مبيعات الإكسسوارات
  // ✅ FIX: استخدام total_price (بعد الخصم) بدل unit_price (قبل الخصم)
  const totalAccessorySales = accessorySalesData.reduce((sum, s) => {
    const qty = Math.abs(parseFloat(s.quantity) || 0);
    const revenue = parseFloat(s.total_price) || (qty * (parseFloat(s.unit_price) || 0) - (parseFloat(s.discount) || 0));
    return sum + revenue;
  }, 0);

  // حساب تكلفة الإكسسوارات المباعة - purchase_price موجود في البيانات المرجعة من API
  const totalAccessoryCost = accessorySalesData.reduce((sum, s) => {
    const qty = Math.abs(parseFloat(s.quantity) || 0);
    // purchase_price يأتي من JOIN مع جدول accessories في API
    const purchasePrice = parseFloat(s.purchase_price) || 0;
    return sum + (qty * purchasePrice);
  }, 0);

  const accessoryProfit = totalAccessorySales - totalAccessoryCost;

  // ✅ ربح قطع الغيار (POS)
  const repairPartsSalesData = reportsData.repairPartsPosSales || [];
  const repairPartsPosRevenue = repairPartsSalesData.reduce((sum, s) => sum + (parseFloat(s.total_price) || 0), 0);
  const repairPartsPosCost = repairPartsSalesData.reduce((sum, s) => {
    const qty = Math.abs(parseFloat(s.quantity) || 1);
    const cost = parseFloat(s.cost_price) || 0;
    return sum + (qty * cost);
  }, 0);
  const repairPartsPosProfit = repairPartsPosRevenue - repairPartsPosCost;
  
  // ✅ حساب قيمة المخزون من جميع المخازن (بما فيها المخازن التخزينية)
  // API route inventory يرجع جميع الأجهزة من جميع المخازن بالفعل
  const stockValue = devicesInStock.reduce((sum, d) => sum + (parseFloat(d.purchase_cost) || 0), 0);
  
  // ✅ حساب قيمة مخزون الإكسسوارات من جميع المخازن
  // API route accessories يرجع جميع الإكسسوارات من جميع المخازن بالفعل
  const accessoryStockValue = accessories.reduce((sum, a) => {
    const qty = parseInt(a.quantity) || 0;
    const cost = parseFloat(a.cost_price) || parseFloat(a.purchase_price) || 0;
    return sum + (qty * cost);
  }, 0);
  
  // ✅ حساب قيمة مخزون قطع الغيار من جميع المخازن
  let repairPartsAll = [];
  try {
    const rpRes = await fetch('elos-db://repair-parts?all=true');
    if (rpRes.ok) {
      const rpData = await rpRes.json();
      repairPartsAll = Array.isArray(rpData) ? rpData : (rpData.parts || []);
    }
  } catch (e) {
    Logger.warn('[DASHBOARD] Could not load repair parts:', e);
  }
  const repairPartsStockValue = repairPartsAll.reduce((sum, p) => {
    const qty = parseFloat(p.qty || p.quantity || 0);
    const cost = parseFloat(p.unit_cost) || parseFloat(p.purchase_price) || parseFloat(p.cost_price) || 0;
    return sum + (qty * cost);
  }, 0);
  const repairPartsTotalQty = repairPartsAll.reduce((s, p) => s + (parseFloat(p.qty || p.quantity || 0)), 0);

  const partnersCapital = partners.filter(p => p.status === 'active').reduce((sum, p) => sum + (parseFloat(p.investment_amount) || parseFloat(p.capital) || 0), 0);
  
  // ✅ Calculate repairs revenue (if available) - تحميل بيانات الصيانة
  let repairs = reportsData.repairs || [];
  if (repairs.length === 0) {
    try {
      const repairsRes = await fetch('elos-db://repairs');
      if (repairsRes.ok) {
        const repairsData = await repairsRes.json();
        repairs = Array.isArray(repairsData) ? repairsData : (repairsData.tickets || repairsData.repairs || []);
        reportsData.repairs = repairs;
      }
    } catch (e) {
      Logger.warn('[DASHBOARD] Could not load repairs:', e);
    }
  }
  const repairsRevenue = repairs.reduce((sum, r) => sum + (parseFloat(r.total || r.total_cost || 0)), 0);
  const repairsTicketsCount = repairs.length;

  // ✅ ربح الصيانة (إيرادات - تكلفة القطع)
  let dashRepairsProfit = 0;
  try {
    const repKpisRes = await fetch('elos-db://repairs/kpis');
    if (repKpisRes.ok) {
      const repKpis = await repKpisRes.json();
      dashRepairsProfit = parseFloat(repKpis.net_profit) || 0;
    }
  } catch (e) { /* ignore */ }

  // ✅ عمولات التحويل من نقطة البيع (ربح صافي)
  let dashTransferCommissions = 0;
  try {
    const dateFrom = document.getElementById('dateFrom')?.value || '';
    const dateTo = document.getElementById('dateTo')?.value || '';
    let summaryUrl = 'elos-db://money-transfers-summary';
    if (dateFrom && dateTo) summaryUrl += `?from=${dateFrom}&to=${dateTo}`;
    const summaryRes = await fetch(summaryUrl);
    if (summaryRes.ok) {
      const summary = await summaryRes.json();
      dashTransferCommissions = parseFloat(summary.total_commission) || 0;
    }
  } catch (e) { /* ignore */ }

  // ✅ الحسابات النهائية (بعد تحميل جميع البيانات)
  const totalSales = totalDeviceSales + totalAccessorySales + repairPartsPosRevenue + repairsRevenue;
  const grossProfit = deviceProfit + accessoryProfit + repairPartsPosProfit + dashRepairsProfit + dashTransferCommissions;

  // ✅ المصروفات التشغيلية (من الخزنة - مصاريف حقيقية فقط)
  const expenseSubTypes = ['salary', 'operating_expense'];
  const notExpenseCategories = [
    'مرتجعات مبيعات', 'مسحوبات درج الكاش', 'سحب لدرج الكاش', 'سحب لمرتجع',
    'عجز كاش', 'تحويل لدرج الكاش', 'فائض سحب للدرج', 'زيادة كاش'
  ];
  const isNotExpenseCat = (cat) => {
    if (!cat) return false;
    const c = String(cat).trim();
    return notExpenseCategories.includes(c) || c.includes('مرتجع') || c.includes('عجز') || c === 'سحب';
  };
  const dashExpenses = (reportsData.cashflow || []).filter(t => {
    if (t.type === 'deposit' || t.type === 'sale') return false;
    if (t.sub_type === 'internal_transfer') return false;
    if (t.type === 'expense') {
      if (isNotExpenseCat(t.category)) return false;
      if (t.description && (t.description.includes('مرتجعات') || t.description.includes('عجز في الكاش'))) return false;
      return true;
    }
    if (t.type === 'withdrawal' && expenseSubTypes.includes(t.sub_type)) return true;
    return false;
  }).reduce((sum, t) => sum + (parseFloat(t.amount) || 0), 0);

  const totalProfit = grossProfit - dashExpenses;
  const profitMargin = grossProfit > 0 ? (totalProfit / grossProfit * 100) : 0;

  // ✅ جلب الأرصدة النقدية من المحافظ المتعددة
  let totalCash = 0;
  let walletCash = 0;
  let walletMobile = 0;
  let walletBank = 0;
  let cashDrawerBalance = 0;
  
  try {
    // رصيد درج الكاش
    const cashRes = await fetch('elos-db://cash-balance');
    if (cashRes.ok) {
      const cashData = await cashRes.json();
      cashDrawerBalance = parseFloat(cashData.balance) || 0;
    }
    
    // رصيد الخزنة بالمحافظ
    const safeRes = await fetch('elos-db://safe-balance');
    if (safeRes.ok) {
      const safeData = await safeRes.json();
      
      // ✅ دعم النظام الجديد: wallets array
      if (safeData.wallets && Array.isArray(safeData.wallets)) {
        safeData.wallets.forEach(w => {
          const balance = Number(w.balance || 0);
          if (w.type === 'cash') walletCash += balance;
          else if (w.type === 'mobile_wallet') walletMobile += balance;
          else if (w.type === 'bank') walletBank += balance;
        });
      } 
      // ✅ دعم النظام القديم: wallets object
      else if (safeData.wallets && typeof safeData.wallets === 'object') {
        walletCash = parseFloat(safeData.wallets.cash?.balance) || 0;
        walletMobile = parseFloat(safeData.wallets.mobile_wallet?.balance) || 0;
        walletBank = parseFloat(safeData.wallets.bank?.balance) || 0;
      }
    }
    
    totalCash = cashDrawerBalance + walletCash + walletMobile + walletBank;
    
    Logger.log('[DASHBOARD] Cash balances:', {
      cashDrawer: cashDrawerBalance,
      walletCash: walletCash,
      walletMobile: walletMobile,
      walletBank: walletBank,
      total: totalCash
    });
  } catch (e) {
    Logger.warn('[DASHBOARD] Could not fetch cash balances:', e);
  }
  
  // Render main stats
  document.getElementById('mainStats').innerHTML = `
    <div class="stat-card green">
      <div class="stat-header">
        <span class="stat-icon">💰</span>
        <span class="stat-trend up">▲ ${profitMargin.toFixed(1)}%</span>
      </div>
      <div class="stat-label">إجمالي المبيعات</div>
      <div class="stat-value">${fmt(totalSales)} ج.م</div>
      <div class="stat-desc">${devicesSold.length} جهاز + ${accessorySalesData.length} إكسسوار + ${repairPartsSalesData.length} قطع غيار</div>
    </div>
    <div class="stat-card purple">
      <div class="stat-header">
        <span class="stat-icon">📈</span>
        <span class="stat-trend ${totalProfit >= 0 ? 'up' : 'down'}">${totalProfit >= 0 ? '▲' : '▼'}</span>
      </div>
      <div class="stat-label">صافي الربح</div>
      <div class="stat-value" style="color:${totalProfit >= 0 ? 'var(--success)' : 'var(--danger)'}">${fmt(totalProfit)} ج.م</div>
      <div class="stat-desc">هامش ${profitMargin.toFixed(1)}% بعد خصم المصروفات</div>
    </div>
    <div class="stat-card orange">
      <div class="stat-header">
        <span class="stat-icon">🔧</span>
        <span class="stat-trend">${repairsTicketsCount}</span>
      </div>
      <div class="stat-label">إيراد الصيانة</div>
      <div class="stat-value">${fmt(repairsRevenue)} ج.م</div>
      <div class="stat-desc">${repairsTicketsCount} تذكرة صيانة</div>
    </div>
    <div class="stat-card cyan">
      <div class="stat-header">
        <span class="stat-icon">📱</span>
        <span class="stat-trend">${devicesInStock.length}</span>
      </div>
      <div class="stat-label">مخزون الأجهزة</div>
      <div class="stat-value">${fmt(stockValue)} ج.م</div>
      <div class="stat-desc">${devicesInStock.length} جهاز متاح</div>
    </div>
    <div class="stat-card orange">
      <div class="stat-header">
        <span class="stat-icon">🎧</span>
        <span class="stat-trend">${accessories.length}</span>
      </div>
      <div class="stat-label">مخزون الإكسسوارات</div>
      <div class="stat-value">${fmt(accessoryStockValue)} ج.م</div>
      <div class="stat-desc">${accessories.reduce((s, a) => s + (parseInt(a.quantity) || 0), 0)} قطعة</div>
    </div>
    <div class="stat-card red">
      <div class="stat-header">
        <span class="stat-icon">🔩</span>
        <span class="stat-trend">${repairPartsAll.length}</span>
      </div>
      <div class="stat-label">مخزون قطع الغيار</div>
      <div class="stat-value">${fmt(repairPartsStockValue)} ج.م</div>
      <div class="stat-desc">${repairPartsTotalQty} قطعة</div>
    </div>
    <div class="stat-card pink">
      <div class="stat-header">
        <span class="stat-icon">🤝</span>
        <span class="stat-trend">${partners.filter(p => p.status === 'active').length}</span>
      </div>
      <div class="stat-label">رأس مال الشركاء</div>
      <div class="stat-value">${fmt(partnersCapital)} ج.م</div>
      <div class="stat-desc">${partners.filter(p => p.status === 'active').length} شريك نشط</div>
    </div>
    ${totalCash > 0 ? `
    <div class="stat-card blue">
      <div class="stat-header">
        <span class="stat-icon">💵</span>
        <span class="stat-trend">${walletCash + walletMobile + walletBank > 0 ? '3' : '1'}</span>
      </div>
      <div class="stat-label">إجمالي النقدية</div>
      <div class="stat-value">${fmt(totalCash)} ج.م</div>
      <div class="stat-desc">
        ${cashDrawerBalance > 0 ? fmt(cashDrawerBalance) + ' درج' : ''}
        ${walletCash > 0 ? (cashDrawerBalance > 0 ? ' + ' : '') + fmt(walletCash) + ' نقدي' : ''}
        ${walletMobile > 0 ? (cashDrawerBalance > 0 || walletCash > 0 ? ' + ' : '') + fmt(walletMobile) + ' محفظة' : ''}
        ${walletBank > 0 ? (cashDrawerBalance > 0 || walletCash > 0 || walletMobile > 0 ? ' + ' : '') + fmt(walletBank) + ' بنكي' : ''}
      </div>
    </div>
    ` : ''}
  `;
  
  // Update summary boxes
  document.getElementById('dashTotalSales').textContent = fmt(totalSales) + ' ج.م';
  document.getElementById('dashDeviceSales').textContent = fmt(totalDeviceSales) + ' ج.م';
  document.getElementById('dashAccessorySales').textContent = fmt(totalAccessorySales) + ' ج.م';
  document.getElementById('dashNetProfit').textContent = fmt(totalProfit) + ' ج.م';
  
  document.getElementById('dashDevicesStock').textContent = devicesInStock.length;
  document.getElementById('dashAccessoriesStock').textContent = accessories.reduce((s, a) => s + (parseInt(a.quantity) || 0), 0);
  document.getElementById('dashStockValue').textContent = fmt(stockValue + accessoryStockValue) + ' ج.م';
  document.getElementById('dashLowStock').textContent = accessories.filter(a => (parseInt(a.quantity) || 0) <= (parseInt(a.min_stock) || 5)).length;
  
  document.getElementById('dashPartnersCount').textContent = partners.filter(p => p.status === 'active').length;
  document.getElementById('dashPartnersCapital').textContent = fmt(partnersCapital) + ' ج.م';
  document.getElementById('dashPartnersProfit').textContent = fmt(totalProfit) + ' ج.م';
  document.getElementById('dashPendingDist').textContent = reportsData.distributions?.filter(d => d.status === 'pending').length || 0;
  
  // Create charts
  createDashboardCharts();
  
  // Top products
  renderTopProducts();
  
  // Top clients
  renderTopClientsPreview();
}

function createDashboardCharts() {
  // Sales Trend Chart
  const salesCtx = document.getElementById('salesTrendChart');
  if (salesCtx) {
    if (charts.salesTrend) charts.salesTrend.destroy();
    
    const last7Days = getLast7Days();
    const salesByDay = last7Days.map(day => {
      return reportsData.sales?.filter(s => s.sale_date?.startsWith(day)).reduce((sum, s) => sum + (parseFloat(s.total) || parseFloat(s.sell_price) || 0), 0) || 0;
    });
    const profitByDay = last7Days.map(day => {
      return reportsData.sales?.filter(s => s.sale_date?.startsWith(day)).reduce((sum, s) => {
        const revenue = parseFloat(s.total) || parseFloat(s.sell_price) || 0;
        const cost = parseFloat(s.cost) || parseFloat(s.purchase_cost) || 0;
        return sum + (revenue - cost);
      }, 0) || 0;
    });
    
    charts.salesTrend = new Chart(salesCtx, {
      type: 'line',
      data: {
        labels: last7Days.map(d => formatShortDate(d)),
        datasets: [
          { label: 'المبيعات', data: salesByDay, borderColor: '#3b82f6', backgroundColor: 'rgba(59,130,246,0.1)', tension: 0.4, fill: true },
          { label: 'الأرباح', data: profitByDay, borderColor: '#10b981', backgroundColor: 'rgba(16,185,129,0.1)', tension: 0.4, fill: true }
        ]
      },
      options: getChartOptions()
    });
  }
  
  // Revenue Distribution Chart
  const revenueCtx = document.getElementById('revenueDistChart');
  if (revenueCtx) {
    if (charts.revenueDist) charts.revenueDist.destroy();
    
    const deviceRevenue = reportsData.devices?.filter(d => d.status === 'sold').reduce((sum, d) => sum + (parseFloat(d.sell_price) || 0), 0) || 0;
    const accessoryRevenue = reportsData.sales?.filter(s => s.type === 'accessory').reduce((sum, s) => sum + (parseFloat(s.total) || 0), 0) || 0;
    
    // Include repairs revenue if available
    const repairsRevenue = (reportsData.repairs || []).reduce((sum, r) => sum + (parseFloat(r.total || r.total_cost || 0)), 0);
    
    const labels = repairsRevenue > 0 ? ['الأجهزة', 'الإكسسوارات', 'الصيانة'] : ['الأجهزة', 'الإكسسوارات'];
    const data = repairsRevenue > 0 ? [deviceRevenue, accessoryRevenue, repairsRevenue] : [deviceRevenue, accessoryRevenue];
    const colors = repairsRevenue > 0 ? ['#3b82f6', '#a855f7', '#f59e0b'] : ['#3b82f6', '#a855f7'];
    
    charts.revenueDist = new Chart(revenueCtx, {
      type: 'doughnut',
      data: {
        labels: labels,
        datasets: [{
          data: data,
          backgroundColor: colors,
          borderWidth: 0
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { position: 'bottom', labels: { color: '#8b93a6' } }
        }
      }
    });
  }
}

function renderTopProducts() {
  const container = document.getElementById('topProductsBody');
  
  // Combine devices and accessories sales
  const productSales = {};
  
  reportsData.devices?.filter(d => d.status === 'sold').forEach(d => {
    const name = d.model || d.name || 'غير محدد';
    if (!productSales[name]) productSales[name] = { name, type: 'جهاز', qty: 0, revenue: 0 };
    productSales[name].qty++;
    productSales[name].revenue += parseFloat(d.sell_price) || 0;
  });
  
  reportsData.sales?.filter(s => s.type === 'accessory').forEach(s => {
    const name = s.product_name || 'غير محدد';
    if (!productSales[name]) productSales[name] = { name, type: 'إكسسوار', qty: 0, revenue: 0 };
    productSales[name].qty += parseInt(s.quantity) || 1;
    productSales[name].revenue += parseFloat(s.total) || 0;
  });
  
  const sorted = Object.values(productSales).sort((a, b) => b.revenue - a.revenue).slice(0, 5);
  
  if (!sorted.length) {
    container.innerHTML = '<tr><td colspan="5" class="empty-state">لا توجد مبيعات</td></tr>';
    return;
  }
  
  container.innerHTML = sorted.map((p, i) => `
    <tr>
      <td>${i + 1}</td>
      <td>${p.name}</td>
      <td><span class="badge ${p.type === 'جهاز' ? 'badge-info' : 'badge-purple'}">${p.type}</span></td>
      <td>${p.qty}</td>
      <td><strong>${fmt(p.revenue)} ج.م</strong></td>
    </tr>
  `).join('');
}

function renderTopClientsPreview() {
  const container = document.getElementById('topClientsBody');
  
  const clientSales = {};
  reportsData.sales?.forEach(s => {
    const name = s.client_name || 'نقدي';
    if (!clientSales[name]) clientSales[name] = { name, count: 0, total: 0 };
    clientSales[name].count++;
    clientSales[name].total += parseFloat(s.total) || parseFloat(s.sell_price) || 0;
  });
  
  reportsData.devices?.filter(d => d.status === 'sold').forEach(d => {
    const name = d.client_name || 'نقدي';
    if (!clientSales[name]) clientSales[name] = { name, count: 0, total: 0 };
    clientSales[name].count++;
    clientSales[name].total += parseFloat(d.sell_price) || 0;
  });
  
  const sorted = Object.values(clientSales).sort((a, b) => b.total - a.total).slice(0, 5);
  
  if (!sorted.length) {
    container.innerHTML = '<tr><td colspan="4" class="empty-state">لا توجد بيانات</td></tr>';
    return;
  }
  
  container.innerHTML = sorted.map((c, i) => `
    <tr>
      <td>${i + 1}</td>
      <td>${c.name}</td>
      <td>${c.count}</td>
      <td><strong>${fmt(c.total)} ج.م</strong></td>
    </tr>
  `).join('');
}

// ═══════════════════════════════════════════════════════════════
// 📱 DEVICES REPORT
// ═══════════════════════════════════════════════════════════════
async function loadDevicesReport() {
  const devices = reportsData.devices || [];
  
  const inStock = devices.filter(d => d.status === 'in_stock');
  const sold = devices.filter(d => d.status === 'sold');
  const maintenance = devices.filter(d => d.status === 'maintenance');
  
  const stockValue = inStock.reduce((sum, d) => sum + (parseFloat(d.purchase_cost) || 0), 0);
  const soldValue = sold.reduce((sum, d) => sum + (parseFloat(d.sell_price) || 0), 0);
  const soldCost = sold.reduce((sum, d) => sum + (parseFloat(d.purchase_cost) || 0), 0);
  const profit = soldValue - soldCost;
  
  // Stats
  document.getElementById('devicesStats').innerHTML = `
    <div class="stat-card cyan">
      <div class="stat-header"><span class="stat-icon">📱</span></div>
      <div class="stat-label">إجمالي الأجهزة</div>
      <div class="stat-value">${devices.length}</div>
    </div>
    <div class="stat-card green">
      <div class="stat-header"><span class="stat-icon">✅</span></div>
      <div class="stat-label">متاح للبيع</div>
      <div class="stat-value">${inStock.length}</div>
      <div class="stat-desc">${fmt(stockValue)} ج.م</div>
    </div>
    <div class="stat-card purple">
      <div class="stat-header"><span class="stat-icon">💰</span></div>
      <div class="stat-label">مباع</div>
      <div class="stat-value">${sold.length}</div>
      <div class="stat-desc">${fmt(soldValue)} ج.م</div>
    </div>
    <div class="stat-card orange">
      <div class="stat-header"><span class="stat-icon">🔧</span></div>
      <div class="stat-label">صيانة</div>
      <div class="stat-value">${maintenance.length}</div>
    </div>
    <div class="stat-card ${profit >= 0 ? 'green' : 'red'}">
      <div class="stat-header"><span class="stat-icon">📈</span></div>
      <div class="stat-label">الربح من الأجهزة</div>
      <div class="stat-value" style="color:${profit >= 0 ? 'var(--success)' : 'var(--danger)'}">${fmt(profit)} ج.م</div>
    </div>
  `;
  
  // Populate brand filter - استخدام type أو brand
  const brands = [...new Set(devices.map(d => d.type || d.brand).filter(Boolean))];
  document.getElementById('deviceBrandFilter').innerHTML = '<option value="">الكل</option>' +
    brands.map(b => `<option value="${b}">${b}</option>`).join('');
  
  // Charts
  createDevicesCharts(devices);
  
  // Table
  renderDevicesTable(devices);
}

function createDevicesCharts(devices) {
  // Status Chart
  const statusCtx = document.getElementById('devicesStatusChart');
  if (statusCtx) {
    if (charts.devicesStatus) charts.devicesStatus.destroy();
    
    const statusCounts = {
      'in_stock': devices.filter(d => d.status === 'in_stock').length,
      'sold': devices.filter(d => d.status === 'sold').length,
      'maintenance': devices.filter(d => d.status === 'maintenance').length,
      'reserved': devices.filter(d => d.status === 'reserved').length
    };
    
    charts.devicesStatus = new Chart(statusCtx, {
      type: 'doughnut',
      data: {
        labels: ['متاح', 'مباع', 'صيانة', 'محجوز'],
        datasets: [{
          data: Object.values(statusCounts),
          backgroundColor: ['#10b981', '#3b82f6', '#f59e0b', '#a855f7'],
          borderWidth: 0
        }]
      },
      options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { position: 'bottom', labels: { color: '#8b93a6' } } } }
    });
  }
  
  // Brand Chart
  const brandCtx = document.getElementById('devicesBrandChart');
  if (brandCtx) {
    if (charts.devicesBrand) charts.devicesBrand.destroy();

    const brandCounts = {};
    devices.forEach(d => {
      // استخدام type أو brand مع تحويل iPhone لـ Apple و Android لاسم الشركة من الموديل
      let brand = d.type || d.brand || 'أخرى';

      // ✅ تحويل التصنيفات القديمة
      if (brand === 'iPhone') {
        brand = 'Apple';
      } else if (brand === 'Android') {
        // محاولة استخراج اسم الشركة من الموديل
        const model = (d.model || '').toLowerCase();
        if (model.includes('samsung') || model.includes('galaxy')) brand = 'Samsung';
        else if (model.includes('oppo')) brand = 'Oppo';
        else if (model.includes('realme')) brand = 'Realme';
        else if (model.includes('vivo')) brand = 'Vivo';
        else if (model.includes('xiaomi') || model.includes('redmi') || model.includes('poco')) brand = 'Xiaomi';
        else if (model.includes('huawei') || model.includes('honor')) brand = 'Huawei';
        else if (model.includes('nokia')) brand = 'Nokia';
        else brand = 'أخرى';
      }

      brandCounts[brand] = (brandCounts[brand] || 0) + 1;
    });

    charts.devicesBrand = new Chart(brandCtx, {
      type: 'bar',
      data: {
        labels: Object.keys(brandCounts),
        datasets: [{
          label: 'عدد الأجهزة',
          data: Object.values(brandCounts),
          backgroundColor: '#3b82f6',
          borderRadius: 6
        }]
      },
      options: getBarChartOptions()
    });
  }
}

function renderDevicesTable(devices) {
  const container = document.getElementById('devicesTableBody');
  document.getElementById('devicesCount').textContent = `${devices.length} جهاز`;

  if (!devices.length) {
    container.innerHTML = '<tr><td colspan="9" class="empty-state">لا توجد أجهزة</td></tr>';
    return;
  }

  container.innerHTML = devices.map((d, i) => {
    const profit = (parseFloat(d.sell_price) || 0) - (parseFloat(d.discount) || 0) - (parseFloat(d.purchase_cost) || 0);
    // استخدام imei1 أو imei2 أو imei
    const imei = d.imei1 || d.imei2 || d.imei || '-';
    // استخدام type أو brand
    const brand = d.type || d.brand || '';
    // ✅ اسم المخزن من API (warehouse_display_name أو warehouse_name)
    const warehouseName = d.warehouse_display_name || d.warehouse_name || 'مخزن الأجهزة الرئيسي';

    return `
      <tr>
        <td>${i + 1}</td>
        <td><strong>${brand} ${d.model || ''}</strong></td>
        <td style="direction:ltr;text-align:right">${imei}</td>
        <td><span class="badge badge-info">${escapeHtml(warehouseName)}</span></td>
        <td><span class="badge ${getStatusBadge(d.status)}">${getStatusLabel(d.status)}</span></td>
        <td>${fmt(d.purchase_cost)} ج.م</td>
        <td>${d.status === 'sold' ? fmt(d.sell_price) + ' ج.م' : '-'}</td>
        <td style="color:${profit >= 0 ? 'var(--success)' : 'var(--danger)'}">
          ${d.status === 'sold' ? fmt(profit) + ' ج.م' : '-'}
        </td>
        <td>${formatDate(d.purchase_date || d.created_at)}</td>
      </tr>
    `;
  }).join('');
}

function filterDevicesReport() {
  const status = document.getElementById('deviceStatusFilter').value;
  const brand = document.getElementById('deviceBrandFilter').value;
  const search = document.getElementById('deviceSearch').value.toLowerCase();

  let filtered = reportsData.devices || [];

  if (status) filtered = filtered.filter(d => d.status === status);
  // استخدام type أو brand للفلترة
  if (brand) filtered = filtered.filter(d => (d.type || d.brand) === brand);
  if (search) filtered = filtered.filter(d =>
    (d.imei1 && d.imei1.toLowerCase().includes(search)) ||
    (d.imei2 && d.imei2.toLowerCase().includes(search)) ||
    (d.imei && d.imei.toLowerCase().includes(search)) ||
    (d.model && d.model.toLowerCase().includes(search)) ||
    (d.type && d.type.toLowerCase().includes(search)) ||
    (d.brand && d.brand.toLowerCase().includes(search))
  );

  renderDevicesTable(filtered);
}

// ═══════════════════════════════════════════════════════════════
// 🎧 ACCESSORIES REPORT
// ═══════════════════════════════════════════════════════════════
async function loadAccessoriesReport() {
  const accessories = reportsData.accessories || [];
  const accessorySales = reportsData.accessorySales || [];

  const totalQty = accessories.reduce((sum, a) => sum + (parseInt(a.quantity) || 0), 0);
  const stockValue = accessories.reduce((sum, a) => sum + (parseFloat(a.cost_price) || 0) * (parseInt(a.quantity) || 0), 0);

  // حساب إجمالي المبيعات من accessory_movements
  const totalSales = accessorySales.reduce((sum, s) => {
    const qty = Math.abs(parseFloat(s.quantity) || 0);
    const price = parseFloat(s.unit_price) || parseFloat(s.total_price) / qty || 0;
    return sum + (qty * price);
  }, 0);

  // حساب التكلفة من سعر الشراء
  const totalCost = accessorySales.reduce((sum, s) => {
    const qty = Math.abs(parseFloat(s.quantity) || 0);
    const purchasePrice = parseFloat(s.purchase_price) || 0;
    return sum + (qty * purchasePrice);
  }, 0);

  const profit = totalSales - totalCost;
  const stockThreshold = parseInt((JSON.parse(localStorage.getItem('appSettings') || '{}')).stockThreshold, 10) || 5;
  const lowStock = accessories.filter(a => (parseInt(a.quantity) || 0) <= (parseInt(a.min_stock) || stockThreshold)).length;
  
  // Stats
  document.getElementById('accessoriesStats').innerHTML = `
    <div class="stat-card cyan">
      <div class="stat-header"><span class="stat-icon">🎧</span></div>
      <div class="stat-label">أنواع الإكسسوارات</div>
      <div class="stat-value">${accessories.length}</div>
    </div>
    <div class="stat-card green">
      <div class="stat-header"><span class="stat-icon">📦</span></div>
      <div class="stat-label">إجمالي الكميات</div>
      <div class="stat-value">${totalQty}</div>
      <div class="stat-desc">${fmt(stockValue)} ج.م قيمة</div>
    </div>
    <div class="stat-card purple">
      <div class="stat-header"><span class="stat-icon">💰</span></div>
      <div class="stat-label">إجمالي المبيعات</div>
      <div class="stat-value">${fmt(totalSales)} ج.م</div>
    </div>
    <div class="stat-card ${profit >= 0 ? 'green' : 'red'}">
      <div class="stat-header"><span class="stat-icon">📈</span></div>
      <div class="stat-label">الربح</div>
      <div class="stat-value" style="color:${profit >= 0 ? 'var(--success)' : 'var(--danger)'}">${fmt(profit)} ج.م</div>
    </div>
    <div class="stat-card ${lowStock > 0 ? 'red' : 'green'}">
      <div class="stat-header"><span class="stat-icon">⚠️</span></div>
      <div class="stat-label">مخزون منخفض</div>
      <div class="stat-value">${lowStock}</div>
    </div>
  `;
  
  // Charts
  createAccessoriesCharts(accessories, accessorySales);

  // Table
  await renderAccessoriesTable(accessories);
}

function createAccessoriesCharts(accessories, sales) {
  // Category Chart
  const catCtx = document.getElementById('accessoriesCategoryChart');
  if (catCtx) {
    if (charts.accessoriesCategory) charts.accessoriesCategory.destroy();
    
    const catCounts = {};
    accessories.forEach(a => {
      const cat = a.category || 'other';
      catCounts[cat] = (catCounts[cat] || 0) + (parseInt(a.quantity) || 0);
    });
    
    const catLabels = { case: 'جرابات', charger: 'شواحن', headphone: 'سماعات', cable: 'كابلات', screen: 'واقي شاشة', other: 'أخرى' };
    
    charts.accessoriesCategory = new Chart(catCtx, {
      type: 'doughnut',
      data: {
        labels: Object.keys(catCounts).map(k => catLabels[k] || k),
        datasets: [{
          data: Object.values(catCounts),
          backgroundColor: ['#3b82f6', '#10b981', '#f59e0b', '#a855f7', '#ec4899', '#6b7280'],
          borderWidth: 0
        }]
      },
      options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { position: 'bottom', labels: { color: '#8b93a6' } } } }
    });
  }
  
  // Sales Chart
  const salesCtx = document.getElementById('accessoriesSalesChart');
  if (salesCtx) {
    if (charts.accessoriesSales) charts.accessoriesSales.destroy();
    
    const last7Days = getLast7Days();
    const salesByDay = last7Days.map(day => {
      return sales.filter(s => s.sale_date?.startsWith(day)).reduce((sum, s) => sum + (parseFloat(s.total) || 0), 0);
    });
    
    charts.accessoriesSales = new Chart(salesCtx, {
      type: 'bar',
      data: {
        labels: last7Days.map(d => formatShortDate(d)),
        datasets: [{
          label: 'المبيعات',
          data: salesByDay,
          backgroundColor: '#a855f7',
          borderRadius: 6
        }]
      },
      options: getBarChartOptions()
    });
  }
}

async function renderAccessoriesTable(accessories) {
  const container = document.getElementById('accessoriesTableBody');
  document.getElementById('accessoriesCount').textContent = `${accessories.length} منتج`;
  
  if (!accessories.length) {
    container.innerHTML = '<tr><td colspan="9" class="empty-state">لا توجد إكسسوارات</td></tr>';
    return;
  }
  
  const catLabels = { case: 'جرابات', charger: 'شواحن', headphone: 'سماعات', cable: 'كابلات', screen: 'واقي شاشة', other: 'أخرى' };
  
  // ✅ جلب قائمة المخازن لربط warehouse_id بأسماء المخازن
  let warehousesMap = {};
  try {
    const warehousesRes = await fetch('elos-db://warehouses');
    if (warehousesRes.ok) {
      const warehousesData = await warehousesRes.json();
      const warehouses = Array.isArray(warehousesData) ? warehousesData : (warehousesData.warehouses || []);
      warehouses.forEach(w => {
        warehousesMap[w.id] = w.name;
      });
    }
  } catch (e) {
    Logger.warn('[REPORTS] Could not load warehouses for accessories:', e);
  }
  
  container.innerHTML = accessories.map((a, i) => {
    const qty = parseInt(a.quantity) || 0;
    const minStock = parseInt(a.min_stock) || 5;
    const isLow = qty <= minStock;
    // ✅ سعر الشراء: API قد يرجع purchase_price أو cost_price
    const purchasePrice = parseFloat(a.purchase_price ?? a.cost_price) || 0;
    const sellPrice = parseFloat(a.sell_price ?? a.sale_price) || 0;
    const soldQty = parseInt(a.sold_qty ?? a.sales_count) || 0;
    const profit = (sellPrice - purchasePrice) * soldQty;
    // ✅ اسم المخزن
    const warehouseName = a.warehouse_name || (a.warehouse_id ? warehousesMap[a.warehouse_id] : null) || 'مخزن الإكسسوارات الرئيسي';
    
    return `
      <tr>
        <td>${i + 1}</td>
        <td><strong>${a.name || '-'}</strong></td>
        <td><span class="badge badge-purple">${catLabels[a.category] || a.category || '-'}</span></td>
        <td><span class="badge badge-info">${escapeHtml(warehouseName)}</span></td>
        <td><span style="color:${isLow ? 'var(--danger)' : 'var(--success)'}; font-weight:700">${qty}</span></td>
        <td>${fmt(purchasePrice)} ج.م</td>
        <td>${fmt(sellPrice)} ج.م</td>
        <td>${soldQty}</td>
        <td style="color:${profit >= 0 ? 'var(--success)' : 'var(--danger)'}">${fmt(profit)} ج.م</td>
      </tr>
    `;
  }).join('');
}

async function filterAccessoriesReport() {
  const category = document.getElementById('accessoryCategoryFilter').value;
  const stock = document.getElementById('accessoryStockFilter').value;
  const search = document.getElementById('accessorySearch').value.toLowerCase();
  
  let filtered = reportsData.accessories || [];
  
  if (category) filtered = filtered.filter(a => a.category === category);
  if (stock === 'low') filtered = filtered.filter(a => (parseInt(a.quantity) || 0) <= (parseInt(a.min_stock) || 5) && (parseInt(a.quantity) || 0) > 0);
  if (stock === 'out') filtered = filtered.filter(a => (parseInt(a.quantity) || 0) === 0);
  if (stock === 'available') filtered = filtered.filter(a => (parseInt(a.quantity) || 0) > (parseInt(a.min_stock) || 5));
  if (search) filtered = filtered.filter(a => a.name?.toLowerCase().includes(search));
  
  await renderAccessoriesTable(filtered);
}

// ═══════════════════════════════════════════════════════════════
// 🔩 REPAIR PARTS REPORT
// ═══════════════════════════════════════════════════════════════
async function loadRepairPartsReport() {
  const parts = reportsData.repairParts || [];
  const posSales = reportsData.repairPartsPosSales || [];
  const maintenanceSales = reportsData.repairPartsSales || [];

  const totalQty = parts.reduce((sum, p) => sum + (parseFloat(p.qty) || 0), 0);
  const stockValue = parts.reduce((sum, p) => sum + (parseFloat(p.unit_cost) || 0) * (parseFloat(p.qty) || 0), 0);

  // حساب إجمالي مبيعات POS
  const totalPosSales = posSales.reduce((sum, s) => sum + (parseFloat(s.total_price) || 0), 0);
  // حساب إجمالي مبيعات الصيانة
  const totalMaintenanceSales = maintenanceSales.reduce((sum, s) => {
    const qty = Math.abs(parseFloat(s.qty) || 0);
    const price = parseFloat(s.unit_price) || 0;
    return sum + (qty * price);
  }, 0);
  const totalSales = totalPosSales + totalMaintenanceSales;

  // حساب التكلفة
  const totalPosCost = posSales.reduce((sum, s) => sum + (parseFloat(s.cost_price) || 0) * (parseFloat(s.quantity) || 0), 0);
  const totalMaintenanceCost = maintenanceSales.reduce((sum, s) => {
    const qty = Math.abs(parseFloat(s.qty) || 0);
    const cost = parseFloat(s.unit_cost) || 0;
    return sum + (qty * cost);
  }, 0);
  const profit = totalSales - (totalPosCost + totalMaintenanceCost);

  const stockThreshold = parseInt((JSON.parse(localStorage.getItem('appSettings') || '{}')).stockThreshold, 10) || 5;
  const lowStock = parts.filter(p => (parseFloat(p.qty) || 0) <= (parseFloat(p.min_qty) || stockThreshold) && (parseFloat(p.qty) || 0) > 0).length;
  const outOfStock = parts.filter(p => (parseFloat(p.qty) || 0) <= 0).length;

  // Stats
  document.getElementById('repairPartsStats').innerHTML = `
    <div class="stat-card cyan">
      <div class="stat-header"><span class="stat-icon">🔩</span></div>
      <div class="stat-label">أنواع القطع</div>
      <div class="stat-value">${parts.length}</div>
    </div>
    <div class="stat-card green">
      <div class="stat-header"><span class="stat-icon">📦</span></div>
      <div class="stat-label">إجمالي الكميات</div>
      <div class="stat-value">${totalQty}</div>
      <div class="stat-desc">${fmt(stockValue)} ج.م قيمة</div>
    </div>
    <div class="stat-card purple">
      <div class="stat-header"><span class="stat-icon">💰</span></div>
      <div class="stat-label">إجمالي المبيعات</div>
      <div class="stat-value">${fmt(totalSales)} ج.م</div>
    </div>
    <div class="stat-card ${profit >= 0 ? 'green' : 'red'}">
      <div class="stat-header"><span class="stat-icon">📈</span></div>
      <div class="stat-label">الربح</div>
      <div class="stat-value" style="color:${profit >= 0 ? 'var(--success)' : 'var(--danger)'}">${fmt(profit)} ج.م</div>
    </div>
    <div class="stat-card ${lowStock > 0 ? 'red' : 'green'}">
      <div class="stat-header"><span class="stat-icon">⚠️</span></div>
      <div class="stat-label">مخزون منخفض</div>
      <div class="stat-value">${lowStock}</div>
      <div class="stat-desc">${outOfStock} نفذ</div>
    </div>
  `;

  // ملء فلتر التصنيفات ديناميكياً
  const categories = [...new Set(parts.map(p => p.category).filter(Boolean))].sort();
  const catFilter = document.getElementById('repairPartCategoryFilter');
  const currentCat = catFilter.value;
  catFilter.innerHTML = '<option value="">الكل</option>' + categories.map(c => `<option value="${c}">${escapeHtml(c)}</option>`).join('');
  catFilter.value = currentCat;

  // Charts
  createRepairPartsCharts(parts, posSales);

  // Table
  await renderRepairPartsTable(parts);
}

function createRepairPartsCharts(parts, sales) {
  // Category Chart
  const catCtx = document.getElementById('repairPartsCategoryChart');
  if (catCtx) {
    if (charts.repairPartsCategory) charts.repairPartsCategory.destroy();

    const catCounts = {};
    parts.forEach(p => {
      const cat = p.category || 'بدون تصنيف';
      catCounts[cat] = (catCounts[cat] || 0) + (parseFloat(p.qty) || 0);
    });

    // ترتيب التصنيفات حسب الكمية (أكبر أولاً) وعرض أول 10
    const sorted = Object.entries(catCounts).sort((a, b) => b[1] - a[1]);
    const topCategories = sorted.slice(0, 10);
    if (sorted.length > 10) {
      const othersQty = sorted.slice(10).reduce((s, [, v]) => s + v, 0);
      topCategories.push(['أخرى', othersQty]);
    }

    const colors = ['#3b82f6', '#10b981', '#f59e0b', '#a855f7', '#ec4899', '#6b7280', '#ef4444', '#14b8a6', '#f97316', '#8b5cf6', '#64748b'];

    charts.repairPartsCategory = new Chart(catCtx, {
      type: 'doughnut',
      data: {
        labels: topCategories.map(([k]) => k),
        datasets: [{
          data: topCategories.map(([, v]) => v),
          backgroundColor: colors.slice(0, topCategories.length),
          borderWidth: 0
        }]
      },
      options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { position: 'bottom', labels: { color: '#8b93a6' } } } }
    });
  }

  // Sales Chart
  const salesCtx = document.getElementById('repairPartsSalesChart');
  if (salesCtx) {
    if (charts.repairPartsSales) charts.repairPartsSales.destroy();

    const last7Days = getLast7Days();
    const salesByDay = last7Days.map(day => {
      return sales.filter(s => s.created_at?.startsWith(day)).reduce((sum, s) => sum + (parseFloat(s.total_price) || 0), 0);
    });

    charts.repairPartsSales = new Chart(salesCtx, {
      type: 'bar',
      data: {
        labels: last7Days.map(d => formatShortDate(d)),
        datasets: [{
          label: 'المبيعات',
          data: salesByDay,
          backgroundColor: '#3b82f6',
          borderRadius: 6
        }]
      },
      options: getBarChartOptions()
    });
  }
}

async function renderRepairPartsTable(parts) {
  const container = document.getElementById('repairPartsTableBody');
  document.getElementById('repairPartsCount').textContent = `${parts.length} قطعة`;

  if (!parts.length) {
    container.innerHTML = '<tr><td colspan="9" class="empty-state">لا توجد قطع غيار</td></tr>';
    return;
  }

  // جلب قائمة المخازن لربط warehouse_id بأسماء المخازن
  let warehousesMap = {};
  try {
    const warehousesRes = await fetch('elos-db://warehouses');
    if (warehousesRes.ok) {
      const warehousesData = await warehousesRes.json();
      const warehouses = Array.isArray(warehousesData) ? warehousesData : (warehousesData.warehouses || []);
      warehouses.forEach(w => {
        warehousesMap[w.id] = w.name;
      });
    }
  } catch (e) {
    Logger.warn('[REPORTS] Could not load warehouses for repair parts:', e);
  }

  // حساب المبيعات لكل قطعة من بيانات POS
  const posSales = reportsData.repairPartsPosSales || [];
  const salesByPartId = {};
  posSales.forEach(s => {
    const partId = s.part_id;
    if (!salesByPartId[partId]) salesByPartId[partId] = { qty: 0, revenue: 0, cost: 0 };
    salesByPartId[partId].qty += (parseFloat(s.quantity) || 0);
    salesByPartId[partId].revenue += (parseFloat(s.total_price) || 0);
    salesByPartId[partId].cost += (parseFloat(s.cost_price) || 0) * (parseFloat(s.quantity) || 0);
  });

  container.innerHTML = parts.map((p, i) => {
    const qty = parseFloat(p.qty) || 0;
    const minQty = parseFloat(p.min_qty) || 5;
    const isLow = qty <= minQty && qty > 0;
    const isOut = qty <= 0;
    const unitCost = parseFloat(p.unit_cost) || 0;
    const sellPrice = parseFloat(p.sell_price) || 0;
    const warehouseName = p.warehouse_name || (p.warehouse_id ? warehousesMap[p.warehouse_id] : null) || 'مخزن قطع الغيار الرئيسي';

    const partSales = salesByPartId[p.id] || { qty: 0, revenue: 0, cost: 0 };
    const profit = partSales.revenue - partSales.cost;

    return `
      <tr>
        <td>${i + 1}</td>
        <td><strong>${escapeHtml(p.name || '-')}</strong></td>
        <td><span class="badge badge-purple">${escapeHtml(p.category || '-')}</span></td>
        <td><span class="badge badge-info">${escapeHtml(warehouseName)}</span></td>
        <td><span style="color:${isOut ? 'var(--danger)' : isLow ? '#f59e0b' : 'var(--success)'}; font-weight:700">${qty}</span></td>
        <td>${fmt(unitCost)} ج.م</td>
        <td>${fmt(sellPrice)} ج.م</td>
        <td>${partSales.qty}</td>
        <td style="color:${profit >= 0 ? 'var(--success)' : 'var(--danger)'}">${fmt(profit)} ج.م</td>
      </tr>
    `;
  }).join('');
}

async function filterRepairPartsReport() {
  const category = document.getElementById('repairPartCategoryFilter').value;
  const stock = document.getElementById('repairPartStockFilter').value;
  const search = document.getElementById('repairPartSearch').value.toLowerCase();

  let filtered = reportsData.repairParts || [];

  if (category) filtered = filtered.filter(p => p.category === category);
  if (stock === 'low') filtered = filtered.filter(p => (parseFloat(p.qty) || 0) <= (parseFloat(p.min_qty) || 5) && (parseFloat(p.qty) || 0) > 0);
  if (stock === 'out') filtered = filtered.filter(p => (parseFloat(p.qty) || 0) <= 0);
  if (stock === 'available') filtered = filtered.filter(p => (parseFloat(p.qty) || 0) > (parseFloat(p.min_qty) || 5));
  if (search) filtered = filtered.filter(p => p.name?.toLowerCase().includes(search) || p.category?.toLowerCase().includes(search) || p.sku?.toLowerCase().includes(search));

  await renderRepairPartsTable(filtered);
}

// ═══════════════════════════════════════════════════════════════
// 🤝 PARTNERS REPORT
// ═══════════════════════════════════════════════════════════════
async function loadPartnersReport() {
  const partners = reportsData.partners?.filter(p => p.status === 'active') || [];
  const distributions = reportsData.distributions || [];
  const devices = reportsData.devices?.filter(d => d.status === 'sold') || [];
  const accessories = reportsData.accessories || [];
  const accessorySalesData = reportsData.accessorySales || [];

  // Calculate profits
  const deviceProfit = devices.reduce((sum, d) => sum + ((parseFloat(d.sell_price) || 0) - (parseFloat(d.discount) || 0) - (parseFloat(d.purchase_cost) || 0)), 0);

  // حساب أرباح الإكسسوارات من حركات البيع
  // ✅ FIX: استخدام total_price (بعد الخصم) بدل unit_price (قبل الخصم)
  const accessoryProfit = accessorySalesData.reduce((sum, s) => {
    const qty = Math.abs(parseFloat(s.quantity) || 0);
    const revenue = parseFloat(s.total_price) || (qty * (parseFloat(s.unit_price) || 0) - (parseFloat(s.discount) || 0));
    const accessory = accessories.find(a => a.id === s.accessory_id);
    const purchasePrice = accessory ? (parseFloat(accessory.purchase_price) || 0) : 0;
    return sum + (revenue - (qty * purchasePrice));
  }, 0);

  const totalProfit = deviceProfit + accessoryProfit;
  
  const totalCapital = partners.reduce((sum, p) => sum + (parseFloat(p.investment_amount) || parseFloat(p.capital) || 0), 0);
  const totalDistributed = distributions.filter(d => d.status === 'completed').reduce((sum, d) => sum + (parseFloat(d.total_amount) || 0), 0);
  
  // Stats
  document.getElementById('partnersStats').innerHTML = `
    <div class="stat-card purple">
      <div class="stat-header"><span class="stat-icon">🤝</span></div>
      <div class="stat-label">عدد الشركاء</div>
      <div class="stat-value">${partners.length}</div>
    </div>
    <div class="stat-card cyan">
      <div class="stat-header"><span class="stat-icon">💰</span></div>
      <div class="stat-label">رأس المال</div>
      <div class="stat-value">${fmt(totalCapital)} ج.م</div>
    </div>
    <div class="stat-card green">
      <div class="stat-header"><span class="stat-icon">📈</span></div>
      <div class="stat-label">أرباح الأجهزة</div>
      <div class="stat-value">${fmt(deviceProfit)} ج.م</div>
    </div>
    <div class="stat-card orange">
      <div class="stat-header"><span class="stat-icon">🎧</span></div>
      <div class="stat-label">أرباح الإكسسوارات</div>
      <div class="stat-value">${fmt(accessoryProfit)} ج.م</div>
    </div>
    <div class="stat-card pink">
      <div class="stat-header"><span class="stat-icon">💵</span></div>
      <div class="stat-label">موزع على الشركاء</div>
      <div class="stat-value">${fmt(totalDistributed)} ج.م</div>
    </div>
  `;
  
  // حساب إجمالي مبيعات وتكاليف الإكسسوارات
  const totalAccSales = accessorySalesData.reduce((sum, s) => {
    const qty = Math.abs(parseFloat(s.quantity) || 0);
    return sum + (qty * (parseFloat(s.unit_price) || 0));
  }, 0);
  const totalAccCost = accessorySalesData.reduce((sum, s) => {
    const qty = Math.abs(parseFloat(s.quantity) || 0);
    const acc = accessories.find(a => a.id === s.accessory_id);
    return sum + (qty * (acc ? (parseFloat(acc.purchase_price) || 0) : 0));
  }, 0);

  // Summary
  document.getElementById('partnersTotalRevenue').textContent = fmt(devices.reduce((s, d) => s + (parseFloat(d.sell_price) || 0), 0) + totalAccSales) + ' ج.م';
  document.getElementById('partnersTotalCosts').textContent = fmt(devices.reduce((s, d) => s + (parseFloat(d.purchase_cost) || 0), 0) + totalAccCost) + ' ج.م';
  document.getElementById('partnersNetProfit').textContent = fmt(totalProfit) + ' ج.م';
  document.getElementById('partnersDistributed').textContent = fmt(totalDistributed) + ' ج.م';
  
  // Distribution breakdown
  const distHtml = partners.map(p => {
    const deviceSharePct = parseFloat(p.profit_share_devices) || parseFloat(p.device_profit_share) || 0;
    const accessorySharePct = parseFloat(p.profit_share_accessories) || parseFloat(p.accessory_profit_share) || 0;
    const deviceShare = deviceProfit * deviceSharePct / 100;
    const accessoryShare = accessoryProfit * accessorySharePct / 100;
    const totalShare = deviceShare + accessoryShare;

    return `<div class="summary-row">
      <span class="summary-label">${p.name} (${deviceSharePct}% أجهزة، ${accessorySharePct}% إكسسوارات)</span>
      <span class="summary-value positive">${fmt(totalShare)} ج.م</span>
    </div>`;
  }).join('');
  document.getElementById('partnersDistribution').innerHTML = distHtml || '<div class="empty-state">لا يوجد شركاء</div>';
  
  // Charts
  createPartnersCharts(partners, deviceProfit, accessoryProfit);
  
  // Tables
  renderPartnersTable(partners, deviceProfit, accessoryProfit);
  renderDistributionsTable(distributions);
}

function createPartnersCharts(partners, deviceProfit, accessoryProfit) {
  // Share Chart
  const shareCtx = document.getElementById('partnersShareChart');
  if (shareCtx) {
    if (charts.partnersShare) charts.partnersShare.destroy();

    charts.partnersShare = new Chart(shareCtx, {
      type: 'pie',
      data: {
        labels: partners.map(p => p.name),
        datasets: [{
          data: partners.map(p => parseFloat(p.investment_amount) || parseFloat(p.capital) || 0),
          backgroundColor: ['#3b82f6', '#10b981', '#f59e0b', '#a855f7', '#ec4899', '#06b6d4'],
          borderWidth: 0
        }]
      },
      options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { position: 'bottom', labels: { color: '#8b93a6' } } } }
    });
  }

  // Profit Chart
  const profitCtx = document.getElementById('partnersProfitChart');
  if (profitCtx) {
    if (charts.partnersProfit) charts.partnersProfit.destroy();

    charts.partnersProfit = new Chart(profitCtx, {
      type: 'bar',
      data: {
        labels: partners.map(p => p.name),
        datasets: [
          {
            label: 'أرباح الأجهزة',
            data: partners.map(p => {
              const pct = parseFloat(p.profit_share_devices) || parseFloat(p.device_profit_share) || 0;
              return deviceProfit * pct / 100;
            }),
            backgroundColor: '#3b82f6',
            borderRadius: 6
          },
          {
            label: 'أرباح الإكسسوارات',
            data: partners.map(p => {
              const pct = parseFloat(p.profit_share_accessories) || parseFloat(p.accessory_profit_share) || 0;
              return accessoryProfit * pct / 100;
            }),
            backgroundColor: '#a855f7',
            borderRadius: 6
          }
        ]
      },
      options: getBarChartOptions()
    });
  }
}

function renderPartnersTable(partners, deviceProfit, accessoryProfit) {
  const container = document.getElementById('partnersTableBody');

  if (!partners.length) {
    container.innerHTML = '<tr><td colspan="9" class="empty-state">لا يوجد شركاء</td></tr>';
    return;
  }

  const partnershipTypes = { devices: 'أجهزة فقط', accessories: 'إكسسوارات فقط', both: 'الاثنين معاً' };

  container.innerHTML = partners.map((p, i) => {
    // استخدام أسماء الحقول الصحيحة من قاعدة البيانات
    const deviceSharePct = parseFloat(p.profit_share_devices) || parseFloat(p.device_profit_share) || 0;
    const accessorySharePct = parseFloat(p.profit_share_accessories) || parseFloat(p.accessory_profit_share) || 0;
    const deviceShare = deviceProfit * deviceSharePct / 100;
    const accessoryShare = accessoryProfit * accessorySharePct / 100;
    const totalShare = deviceShare + accessoryShare;
    const withdrawn = parseFloat(p.total_withdrawals) || parseFloat(p.withdrawn) || 0;
    const investment = parseFloat(p.investment_amount) || parseFloat(p.capital) || 0;
    const netBalance = investment + totalShare - withdrawn;

    return `
      <tr>
        <td>${i + 1}</td>
        <td><strong>${p.name}</strong></td>
        <td><span class="badge badge-purple">${partnershipTypes[p.partnership_type] || 'الاثنين'}</span></td>
        <td>${fmt(investment)} ج.م</td>
        <td>${deviceSharePct}%</td>
        <td>${accessorySharePct}%</td>
        <td style="color:var(--success)">${fmt(totalShare)} ج.م</td>
        <td>${fmt(withdrawn)} ج.م</td>
        <td style="color:${netBalance >= 0 ? 'var(--success)' : 'var(--danger)'}; font-weight:700">${fmt(netBalance)} ج.م</td>
      </tr>
    `;
  }).join('');
}

function renderDistributionsTable(distributions) {
  const container = document.getElementById('distributionsTableBody');

  if (!distributions.length) {
    container.innerHTML = '<tr><td colspan="7" class="empty-state">لا توجد توزيعات</td></tr>';
    return;
  }

  const statusLabels = { paid: 'مدفوع', pending: 'قيد الانتظار', calculated: 'محسوب' };
  const statusClasses = { paid: 'badge-success', pending: 'badge-warning', calculated: 'badge-info' };

  container.innerHTML = distributions.slice(0, 15).map((d, i) => `
    <tr>
      <td>${i + 1}</td>
      <td><strong>${d.partner_name || '-'}</strong></td>
      <td>${d.month || d.period_start || '-'}</td>
      <td>${fmt(d.devices_profit || d.total_profit || 0)} ج.م</td>
      <td>${fmt(d.accessories_profit || 0)} ج.م</td>
      <td style="color:var(--success);font-weight:700">${fmt(d.total_share || d.total_amount || 0)} ج.م</td>
      <td><span class="badge ${statusClasses[d.status] || 'badge-info'}">${statusLabels[d.status] || d.status}</span></td>
    </tr>
  `).join('');
}

function calculatePartnersProfit() {
  showToast('جاري حساب الأرباح...', 'info');
  setTimeout(() => {
    loadPartnersReport();
    showToast('تم حساب الأرباح بنجاح', 'success');
  }, 1000);
}

// ═══════════════════════════════════════════════════════════════
// 📅 REPORT PERIOD FILTER (مشترك لجميع التبويبات)
// prefix: sales | purchases | purchaseReturns | invoice | cashflow | profit | expense
// ═══════════════════════════════════════════════════════════════
function getReportFilterDates(prefix) {
  const today = new Date();
  const getYMD = (d) => {
    const y = d.getFullYear(), m = String(d.getMonth() + 1).padStart(2, '0'), day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  };
  const periodEl = document.getElementById(prefix + 'PeriodFilter');
  const period = periodEl?.value || 'last_month';
  const fromEl = document.getElementById(prefix + 'DateFrom');
  const toEl = document.getElementById(prefix + 'DateTo');
  let dateFrom, dateTo;
  if (period === 'custom') {
    dateFrom = fromEl?.value || '';
    dateTo = toEl?.value || '';
    return { dateFrom, dateTo };
  }
  switch (period) {
    case 'last_day':
      dateFrom = dateTo = getYMD(today);
      break;
    case 'last_7': {
      const d7 = new Date(today);
      d7.setDate(today.getDate() - 6);
      dateFrom = getYMD(d7);
      dateTo = getYMD(today);
      break;
    }
    case 'last_month': {
      // الشهر الحالي من أول الشهر لليوم (مش الشهر السابق)
      const firstOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
      dateFrom = getYMD(firstOfMonth);
      dateTo = getYMD(today);
      break;
    }
    case 'last_3_months': {
      const d3 = new Date(today.getFullYear(), today.getMonth() - 2, 1);
      dateFrom = getYMD(d3);
      dateTo = getYMD(today);
      break;
    }
    case 'last_year': {
      const y = today.getFullYear() - 1;
      dateFrom = getYMD(new Date(y, 0, 1));
      dateTo = getYMD(new Date(y, 11, 31));
      break;
    }
    default:
      dateFrom = getYMD(new Date(today.getFullYear(), today.getMonth(), 1));
      dateTo = getYMD(today);
  }
  if (fromEl) fromEl.value = dateFrom;
  if (toEl) toEl.value = dateTo;
  return { dateFrom, dateTo };
}

function applyReportPeriodFilter(prefix) {
  const period = document.getElementById(prefix + 'PeriodFilter')?.value || '';
  const group = document.getElementById(prefix + 'CustomDatesGroup');
  if (group) group.style.display = period === 'custom' ? 'flex' : 'none';
  if (period !== 'custom') getReportFilterDates(prefix);
}

function getSalesFilterDates() { return getReportFilterDates('sales'); }
function applySalesPeriodFilter() { applyReportPeriodFilter('sales'); }

async function loadSalesReport() {
  applySalesPeriodFilter();
  const { dateFrom: salesFrom, dateTo: salesTo } = getSalesFilterDates();
  await loadDevicesData();
  await loadAccessorySalesData(salesFrom, salesTo);
  await loadRepairPartsSalesData(salesFrom, salesTo);

  const allSold = reportsData.devices?.filter(d => d.status === 'sold') || [];
  const dateInRange = (dateStr) => {
    if (!dateStr) return false;
    const d = (dateStr.includes('T') ? dateStr.split('T')[0] : dateStr.split(' ')[0]).trim();
    return (!salesFrom || d >= salesFrom) && (!salesTo || d <= salesTo);
  };
  const devices = salesFrom && salesTo ? allSold.filter(d => dateInRange(d.sale_date)) : allSold;
  const accessorySales = reportsData.accessorySales || [];
  const repairPartsPosSales = reportsData.repairPartsPosSales || [];
  const repairPartsSales = reportsData.repairPartsSales || [];

  const deviceRevenue = devices.reduce((sum, d) => sum + (parseFloat(d.sell_price) || 0), 0);
  const deviceCost = devices.reduce((sum, d) => sum + (parseFloat(d.purchase_cost) || 0), 0);

  // إيرادات وتكلفة الإكسسوارات
  // ✅ FIX: استخدام total_price (بعد الخصم) بدل unit_price (قبل الخصم)
  const accessoryRevenue = accessorySales.reduce((sum, s) => {
    const qty = Math.abs(parseFloat(s.quantity) || 0);
    const revenue = parseFloat(s.total_price) || (qty * (parseFloat(s.unit_price) || 0) - (parseFloat(s.discount) || 0));
    return sum + revenue;
  }, 0);
  const accessoryCost = accessorySales.reduce((sum, s) => {
    const qty = Math.abs(parseFloat(s.quantity) || 0);
    const purchasePrice = parseFloat(s.purchase_price) || 0;
    return sum + (qty * purchasePrice);
  }, 0);

  // إيرادات وتكلفة قطع الغيار (نقطة البيع)
  const repairPartsPosRevenue = repairPartsPosSales.reduce((sum, s) => sum + (parseFloat(s.total_price) || 0), 0);
  const repairPartsPosCost = repairPartsPosSales.reduce((sum, s) => {
    const qty = Math.abs(parseFloat(s.quantity) || 1);
    const cost = parseFloat(s.cost_price) || 0;
    return sum + (qty * cost);
  }, 0);
  // قطع الغيار من الصيانة (مستهلكة): إيراد = تكلفة للعرض، ربح = 0
  const repairPartsRevRevenue = repairPartsSales.reduce((sum, s) => {
    const qty = Math.abs(parseFloat(s.qty) || parseFloat(s.quantity) || 1);
    const cost = parseFloat(s.unit_cost) || 0;
    return sum + (qty * cost);
  }, 0);
  const repairPartsRevCost = repairPartsRevRevenue;
  const repairPartsTotalRevenue = repairPartsPosRevenue + repairPartsRevRevenue;
  const repairPartsTotalCost = repairPartsPosCost + repairPartsRevCost;

  const totalRevenue = deviceRevenue + accessoryRevenue + repairPartsTotalRevenue;
  const totalCost = deviceCost + accessoryCost + repairPartsTotalCost;
  const grossProfit = totalRevenue - totalCost;
  const profitMargin = totalRevenue > 0 ? (grossProfit / totalRevenue * 100) : 0;

  const totalInvoicesCount = devices.length + accessorySales.length + repairPartsPosSales.length + repairPartsSales.length;
  const repairPartsPieces = repairPartsPosSales.reduce((s, r) => s + Math.abs(parseInt(r.quantity) || 1), 0) +
    repairPartsSales.reduce((s, r) => s + Math.abs(parseInt(r.qty) || parseInt(r.quantity) || 1), 0);

  // Stats
  document.getElementById('salesStats').innerHTML = `
    <div class="stat-card green">
      <div class="stat-header"><span class="stat-icon">💰</span></div>
      <div class="stat-label">إجمالي المبيعات</div>
      <div class="stat-value">${fmt(totalRevenue)} ج.م</div>
    </div>
    <div class="stat-card purple">
      <div class="stat-header"><span class="stat-icon">📈</span></div>
      <div class="stat-label">إجمالي الربح</div>
      <div class="stat-value" style="color:var(--success)">${fmt(grossProfit)} ج.م</div>
      <div class="stat-desc">هامش ${profitMargin.toFixed(1)}%</div>
    </div>
    <div class="stat-card cyan">
      <div class="stat-header"><span class="stat-icon">📱</span></div>
      <div class="stat-label">مبيعات الأجهزة</div>
      <div class="stat-value">${fmt(deviceRevenue)} ج.م</div>
      <div class="stat-desc">${devices.length} جهاز</div>
    </div>
    <div class="stat-card orange">
      <div class="stat-header"><span class="stat-icon">🎧</span></div>
      <div class="stat-label">مبيعات الإكسسوارات</div>
      <div class="stat-value">${fmt(accessoryRevenue)} ج.م</div>
      <div class="stat-desc">${accessorySales.length} عملية</div>
    </div>
    <div class="stat-card" style="--card-color:#f59e0b">
      <div class="stat-header"><span class="stat-icon">🔧</span></div>
      <div class="stat-label">قطع الغيار (POS + صيانة)</div>
      <div class="stat-value">${fmt(repairPartsTotalRevenue)} ج.م</div>
      <div class="stat-desc">${repairPartsPosSales.length + repairPartsSales.length} عملية (${repairPartsPieces} قطعة)</div>
    </div>
  `;

  document.getElementById('salesTotalRevenue').textContent = fmt(totalRevenue) + ' ج.م';
  document.getElementById('salesCOGS').textContent = fmt(totalCost) + ' ج.م';
  document.getElementById('salesGrossProfit').textContent = fmt(grossProfit) + ' ج.م';
  document.getElementById('salesProfitMargin').textContent = profitMargin.toFixed(1) + '%';
  document.getElementById('salesInvoicesCount').textContent = totalInvoicesCount;
  document.getElementById('salesAvgInvoice').textContent = fmt(totalRevenue / (totalInvoicesCount || 1)) + ' ج.م';
  document.getElementById('salesDevicesSold').textContent = devices.length;
  document.getElementById('salesAccessoriesSold').textContent = accessorySales.reduce((s, a) => s + Math.abs(parseInt(a.quantity) || 1), 0) + (repairPartsPieces ? ` + ${repairPartsPieces} قطع غيار` : '');

  createSalesCharts(devices, accessorySales, repairPartsPosSales, repairPartsSales);
  renderSalesTable(devices, accessorySales, repairPartsPosSales, repairPartsSales);
}

function createSalesCharts(devices, accessorySales, repairPartsPosSales, repairPartsSales) {
  repairPartsPosSales = repairPartsPosSales || [];
  repairPartsSales = repairPartsSales || [];
  const getDay = (str) => (str || '').split('T')[0].split(' ')[0];

  const dailyCtx = document.getElementById('dailySalesChart');
  if (dailyCtx) {
    if (charts.dailySales) charts.dailySales.destroy();
    const last7Days = getLast7Days();
    const salesByDay = last7Days.map(day => {
      const deviceSales = devices.filter(d => getDay(d.sale_date) === day).reduce((s, d) => s + (parseFloat(d.sell_price) || 0), 0);
      const accSales = accessorySales.filter(a => getDay(a.created_at) === day).reduce((s, a) => {
        const qty = Math.abs(parseFloat(a.quantity) || 0);
        return s + (qty * (parseFloat(a.unit_price) || 0));
      }, 0);
      const posParts = repairPartsPosSales.filter(r => getDay(r.created_at) === day).reduce((s, r) => s + (parseFloat(r.total_price) || 0), 0);
      const repParts = repairPartsSales.filter(r => getDay(r.delivered_at || r.created_at) === day).reduce((s, r) => {
        const qty = Math.abs(parseFloat(r.qty) || parseFloat(r.quantity) || 1);
        return s + (qty * (parseFloat(r.unit_cost) || 0));
      }, 0);
      return deviceSales + accSales + posParts + repParts;
    });
    charts.dailySales = new Chart(dailyCtx, {
      type: 'line',
      data: {
        labels: last7Days.map(d => formatShortDate(d)),
        datasets: [{ label: 'المبيعات', data: salesByDay, borderColor: '#3b82f6', backgroundColor: 'rgba(59,130,246,0.1)', tension: 0.4, fill: true }]
      },
      options: getChartOptions()
    });
  }

  const typeCtx = document.getElementById('salesByTypeChart');
  if (typeCtx) {
    if (charts.salesByType) charts.salesByType.destroy();
    // ✅ FIX: خصم الـ discount من إيرادات الأجهزة والإكسسوارات
    const deviceRevenue = devices.reduce((s, d) => s + ((parseFloat(d.sell_price) || 0) - (parseFloat(d.discount) || 0)), 0);
    const accessoryRevenue = accessorySales.reduce((s, a) => {
      const revenue = parseFloat(a.total_price) || (Math.abs(parseFloat(a.quantity) || 0) * (parseFloat(a.unit_price) || 0) - (parseFloat(a.discount) || 0));
      return s + revenue;
    }, 0);
    const repairPartsPosRevenue = repairPartsPosSales.reduce((s, r) => s + (parseFloat(r.total_price) || 0), 0);
    const repairPartsRevRevenue = repairPartsSales.reduce((s, r) => {
      const qty = Math.abs(parseFloat(r.qty) || parseFloat(r.quantity) || 1);
      return s + (qty * (parseFloat(r.unit_cost) || 0));
    }, 0);
    const repairPartsRevenue = repairPartsPosRevenue + repairPartsRevRevenue;
    const labels = repairPartsRevenue > 0 ? ['الأجهزة', 'الإكسسوارات', 'قطع الغيار'] : ['الأجهزة', 'الإكسسوارات'];
    const data = repairPartsRevenue > 0 ? [deviceRevenue, accessoryRevenue, repairPartsRevenue] : [deviceRevenue, accessoryRevenue];
    const colors = repairPartsRevenue > 0 ? ['#3b82f6', '#a855f7', '#f59e0b'] : ['#3b82f6', '#a855f7'];
    charts.salesByType = new Chart(typeCtx, {
      type: 'doughnut',
      data: {
        labels,
        datasets: [{ data, backgroundColor: colors, borderWidth: 0 }]
      },
      options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { position: 'bottom', labels: { color: '#8b93a6' } } } }
    });
  }
}

function renderSalesTable(devices, accessorySales, repairPartsPosSales, repairPartsSales) {
  const container = document.getElementById('salesTableBody');
  repairPartsPosSales = repairPartsPosSales || [];
  repairPartsSales = repairPartsSales || [];

  // ✅ FIX: استخدام total_price (بعد الخصم) بدل unit_price (قبل الخصم)
  const formattedAccessorySales = accessorySales.map(s => {
    const qty = Math.abs(parseFloat(s.quantity) || 1);
    const revenue = parseFloat(s.total_price) || (qty * (parseFloat(s.unit_price) || 0) - (parseFloat(s.discount) || 0));
    const purchasePrice = parseFloat(s.purchase_price) || 0;
    return {
      ...s,
      type: 'accessory',
      date: s.created_at,
      product_name: s.accessory_name,
      quantity: qty,
      revenue: revenue,
      cost: qty * purchasePrice
    };
  });

  const formattedPosParts = repairPartsPosSales.map(s => {
    const qty = Math.abs(parseFloat(s.quantity) || 1);
    const revenue = parseFloat(s.total_price) || 0;
    const cost = (parseFloat(s.cost_price) || 0) * qty;
    return {
      ...s,
      type: 'repair_part',
      date: s.created_at,
      product_name: s.part_name || s.part_category || 'قطع غيار',
      quantity: qty,
      revenue,
      cost,
      invoice_number: s.invoice_number,
      client_name: s.client_name
    };
  });

  const formattedRepParts = repairPartsSales.map(s => {
    const qty = Math.abs(parseFloat(s.qty) || parseFloat(s.quantity) || 1);
    const cost = (parseFloat(s.unit_cost) || 0) * qty;
    return {
      ...s,
      type: 'repair_part',
      date: s.delivered_at || s.created_at,
      product_name: s.part_name || s.part_category || 'قطع غيار (صيانة)',
      quantity: qty,
      revenue: cost,
      cost,
      invoice_number: s.ticket_no,
      client_name: s.customer_name
    };
  });

  const allSales = [
    ...devices.map(d => ({
      ...d,
      type: 'device',
      date: d.sale_date,
      product_name: `${d.type || ''} ${d.model || ''} ${d.storage || ''}`.trim(),
      quantity: 1,
      revenue: parseFloat(d.sell_price) || 0,
      cost: parseFloat(d.purchase_cost) || 0
    })),
    ...formattedAccessorySales,
    ...formattedPosParts,
    ...formattedRepParts
  ].sort((a, b) => new Date(b.date) - new Date(a.date));

  if (!allSales.length) {
    container.innerHTML = '<tr><td colspan="9" class="empty-state">لا توجد مبيعات</td></tr>';
    return;
  }

  const typeBadge = (t) => t === 'device' ? 'badge-info' : t === 'accessory' ? 'badge-purple' : 'badge-warning';
  const typeLabel = (t) => t === 'device' ? 'جهاز' : t === 'accessory' ? 'إكسسوار' : 'قطع غيار';

  container.innerHTML = allSales.slice(0, 80).map((s, i) => {
    const profit = s.revenue - s.cost;
    return `
      <tr>
        <td>${i + 1}</td>
        <td>${formatDate(s.date)}</td>
        <td>${s.invoice_number || '-'}</td>
        <td>${s.client_name || s.customer_name || 'نقدي'}</td>
        <td><span class="badge ${typeBadge(s.type)}">${typeLabel(s.type)}</span></td>
        <td>${escapeHtml(s.product_name || '-')}</td>
        <td>${s.quantity || 1}</td>
        <td><strong>${fmt(s.revenue)} ج.م</strong></td>
        <td style="color:${profit >= 0 ? 'var(--success)' : 'var(--danger)'}">${fmt(profit)} ج.م</td>
      </tr>
    `;
  }).join('');
}

// ═══════════════════════════════════════════════════════════════
// 🏭 WAREHOUSES REPORT
// ═══════════════════════════════════════════════════════════════
async function loadWarehousesReport() {
  try {
    // ✅ جلب قائمة المخازن الفعلية من API
    const warehousesRes = await fetch('elos-db://warehouses');
    if (!warehousesRes.ok) {
      throw new Error('Failed to load warehouses');
    }
    
    const warehousesData = await warehousesRes.json();
    const warehouses = Array.isArray(warehousesData) ? warehousesData : (warehousesData.warehouses || []);
    
    // ✅ جلب الأجهزة والإكسسوارات و warehouse_items
    const devices = reportsData.devices || [];
    const accessories = reportsData.accessories || [];
    
    // ✅ جلب warehouse_items (المنتجات المخصصة) - cache في reportsData
    if (!reportsData.warehouseItems) {
      try {
        const itemsRes = await fetch('elos-db://warehouse-items');
        if (itemsRes.ok) {
          const itemsData = await itemsRes.json();
          reportsData.warehouseItems = Array.isArray(itemsData) ? itemsData : (itemsData.items || []);
        } else {
          reportsData.warehouseItems = [];
        }
      } catch (e) {
        Logger.warn('[REPORTS] Could not load warehouse items:', e);
        reportsData.warehouseItems = [];
      }
    }
    const warehouseItems = reportsData.warehouseItems;

    // ✅ جلب قطع غيار الصيانة - استخدام البيانات المحملة مسبقاً
    const repairParts = reportsData.repairParts || [];
    
    // ✅ تجميع البيانات لكل مخزن
    const warehousesWithData = warehouses.map(wh => {
      const whId = wh.id;
      const isStorageOnly = wh.is_storage_only === 1;
      const isRepairPartsMain = (wh.type === 'repair_parts' || wh.type === 'spare_parts') && !isStorageOnly;
      const isRepairPartsStorage = isStorageOnly && (wh.storage_type === 'spare_parts' || wh.storage_type === 'repair_parts');
      
      // تجميع الأجهزة
      const whDevices = devices.filter(d => {
        if (d.status !== 'in_stock') return false;
        if (isStorageOnly) {
          return d.warehouse_id === whId;
        } else {
          // المخزن الرئيسي: warehouse_id = whId أو NULL
          return d.warehouse_id === whId || (d.warehouse_id === null && wh.type === 'devices');
        }
      });
      
      // تجميع الإكسسوارات
      const whAccessories = accessories.filter(a => {
        if (isStorageOnly) {
          return a.warehouse_id === whId;
        } else {
          // المخزن الرئيسي: warehouse_id = whId أو NULL
          return a.warehouse_id === whId || (a.warehouse_id === null && wh.type === 'accessories');
        }
      });
      
      // تجميع warehouse_items (للمخازن المخصصة)
      const whItems = warehouseItems.filter(item => item.warehouse_id === whId);

      // ✅ تجميع قطع غيار الصيانة (مخزن رئيسي: warehouse_id = whId أو NULL؛ تخزيني: warehouse_id = whId فقط)
      let whRepairParts = [];
      if (isRepairPartsMain || isRepairPartsStorage) {
        whRepairParts = repairParts.filter(p => {
          const pWhId = p.warehouse_id == null ? null : p.warehouse_id;
          if (isRepairPartsStorage) return pWhId === whId;
          return pWhId === whId || pWhId === null;
        });
      }
      
      return {
        ...wh,
        devices: whDevices,
        accessories: whAccessories,
        warehouse_items: whItems,
        repair_parts: whRepairParts
      };
    });
    
    // ✅ حساب الإحصائيات (شامل قطع الغيار)
    const warehousesStats = warehousesWithData.map(wh => {
      const deviceValue = wh.devices.reduce((s, d) => s + (parseFloat(d.purchase_cost) || 0), 0);
      const accessoryValue = wh.accessories.reduce((s, a) => {
        const qty = parseInt(a.quantity) || 0;
        const cost = parseFloat(a.cost_price) || parseFloat(a.purchase_price) || 0;
        return s + (qty * cost);
      }, 0);
      const itemsValue = wh.warehouse_items.reduce((s, item) => {
        const qty = parseInt(item.quantity) || 0;
        const cost = parseFloat(item.purchase_price) || 0;
        return s + (qty * cost);
      }, 0);
      const repairPartsValue = (wh.repair_parts || []).reduce((s, p) => {
        const qty = parseFloat(p.qty) || 0;
        const cost = parseFloat(p.unit_cost) || 0;
        return s + (qty * cost);
      }, 0);
      
      const totalValue = deviceValue + accessoryValue + itemsValue + repairPartsValue;
      const totalItems = wh.devices.length + wh.accessories.length + wh.warehouse_items.length + (wh.repair_parts || []).length;
      const totalQuantity = wh.devices.length + 
        wh.accessories.reduce((s, a) => s + (parseInt(a.quantity) || 0), 0) +
        wh.warehouse_items.reduce((s, item) => s + (parseInt(item.quantity) || 0), 0) +
        (wh.repair_parts || []).reduce((s, p) => s + (parseFloat(p.qty) || 0), 0);
      
      return {
        ...wh,
        deviceValue,
        accessoryValue,
        itemsValue,
        repairPartsValue,
        totalValue,
        totalItems,
        totalQuantity
      };
    });
    
    // ✅ عرض الإحصائيات
    document.getElementById('warehousesStats').innerHTML = warehousesStats.length > 0 ? warehousesStats.map(wh => {
      const typeLabels = {
        'devices': 'الأجهزة',
        'accessories': 'الإكسسوارات',
        'custom': 'مخصص',
        'repair_parts': 'قطع الصيانة'
      };
      const typeLabel = typeLabels[wh.type] || wh.type;
      const isStorage = wh.is_storage_only === 1;
      
      return `
        <div class="stat-card cyan">
          <div class="stat-header"><span class="stat-icon">${wh.icon || '🏭'}</span></div>
          <div class="stat-label">${escapeHtml(wh.name)}</div>
          <div class="stat-value">${fmt(wh.totalValue)} ج.م</div>
          <div class="stat-desc">
            ${wh.devices.length} جهاز، 
            ${wh.accessories.reduce((s, a) => s + (parseInt(a.quantity) || 0), 0)} إكسسوار
            ${(wh.repair_parts || []).length > 0 ? `، ${(wh.repair_parts || []).length} قطع غيار` : ''}
            ${wh.warehouse_items.length > 0 ? `، ${wh.warehouse_items.length} منتج مخصص` : ''}
            ${isStorage ? ' (تخزيني)' : ''}
          </div>
        </div>
      `;
    }).join('') : '<div class="stat-card"><div class="stat-label">لا توجد مخازن</div></div>';
    
    // Charts
    createWarehousesCharts(warehousesStats);
    
    // Tables
    renderWarehousesTables(warehousesStats);
    
    Logger.log('[REPORTS] Warehouses report loaded:', warehousesStats.length, 'warehouses');
  } catch (error) {
    Logger.error('[REPORTS] Error loading warehouses report:', error);
    showToast('خطأ في تحميل تقرير المخازن', 'error');
  }
}

function createWarehousesCharts(warehouses) {
  const distCtx = document.getElementById('warehousesDistChart');
  if (distCtx) {
    if (charts.warehousesDist) charts.warehousesDist.destroy();
    
    charts.warehousesDist = new Chart(distCtx, {
      type: 'bar',
      data: {
        labels: warehouses.map(w => w.name),
        datasets: [
          {
            label: 'الأجهزة',
            data: warehouses.map(w => w.devices.length),
            backgroundColor: '#3b82f6',
            borderRadius: 6
          },
          {
            label: 'الإكسسوارات',
            data: warehouses.map(w => w.accessories.reduce((s, a) => s + (parseInt(a.quantity) || 0), 0)),
            backgroundColor: '#a855f7',
            borderRadius: 6
          },
          {
            label: 'قطع الغيار',
            data: warehouses.map(w => (w.repair_parts || []).reduce((s, p) => s + (parseFloat(p.qty) || 0), 0)),
            backgroundColor: '#f59e0b',
            borderRadius: 6
          },
          {
            label: 'منتجات مخصصة',
            data: warehouses.map(w => w.warehouse_items.reduce((s, item) => s + (parseInt(item.quantity) || 0), 0)),
            backgroundColor: '#10b981',
            borderRadius: 6
          }
        ]
      },
      options: getBarChartOptions()
    });
  }
  
  const valueCtx = document.getElementById('warehousesValueChart');
  if (valueCtx) {
    if (charts.warehousesValue) charts.warehousesValue.destroy();
    
    charts.warehousesValue = new Chart(valueCtx, {
      type: 'doughnut',
      data: {
        labels: warehouses.map(w => w.name),
        datasets: [{
          data: warehouses.map(w => w.totalValue || 0),
          backgroundColor: ['#3b82f6', '#10b981', '#f59e0b', '#a855f7', '#ef4444', '#8b5cf6', '#ec4899'],
          borderWidth: 0
        }]
      },
      options: { 
        responsive: true, 
        maintainAspectRatio: false, 
        plugins: { 
          legend: { position: 'bottom', labels: { color: '#8b93a6' } },
          tooltip: {
            callbacks: {
              label: (ctx) => `${ctx.label}: ${fmt(ctx.raw)} ج.م`
            }
          }
        } 
      }
    });
  }
}

function renderWarehousesTables(warehouses) {
  const container = document.getElementById('warehousesTables');

  if (!warehouses || warehouses.length === 0) {
    container.innerHTML = '<div class="table-card"><div class="empty-state">لا توجد مخازن</div></div>';
    return;
  }

  const MAX_ROWS = 50; // عرض أول 50 منتج فقط لكل مخزن

  // helper: بناء صفوف مخزن واحد
  function buildWarehouseRows(wh) {
    const rows = [];
    wh.devices.forEach(d => {
      const brand = d.type || d.brand || '';
      const model = d.model || '';
      rows.push(`<tr><td><span class="badge badge-info">جهاز</span></td><td><strong>${escapeHtml(brand)} ${escapeHtml(model)}</strong></td><td>1</td><td>${fmt(d.purchase_cost)} ج.م</td></tr>`);
    });
    wh.accessories.forEach(a => {
      const qty = parseInt(a.quantity) || 0;
      const cost = parseFloat(a.cost_price) || parseFloat(a.purchase_price) || 0;
      rows.push(`<tr><td><span class="badge badge-purple">إكسسوار</span></td><td><strong>${escapeHtml(a.name || '-')}</strong></td><td>${qty}</td><td>${fmt(qty * cost)} ج.م</td></tr>`);
    });
    (wh.repair_parts || []).forEach(p => {
      const qty = parseFloat(p.qty) || 0;
      const cost = parseFloat(p.unit_cost) || 0;
      rows.push(`<tr><td><span class="badge badge-orange">قطع غيار</span></td><td><strong>${escapeHtml(p.name || '-')}</strong></td><td>${qty}</td><td>${fmt(qty * cost)} ج.م</td></tr>`);
    });
    wh.warehouse_items.forEach(item => {
      const qty = parseInt(item.quantity) || 0;
      const cost = parseFloat(item.purchase_price) || 0;
      rows.push(`<tr><td><span class="badge badge-orange">منتج مخصص</span></td><td><strong>${escapeHtml(item.name || '-')}</strong></td><td>${qty}</td><td>${fmt(qty * cost)} ج.م</td></tr>`);
    });
    return rows;
  }

  // بناء الصفوف مرة واحدة لكل مخزن
  const allWarehouseRows = warehouses.map(wh => buildWarehouseRows(wh));

  container.innerHTML = warehouses.map((wh, whIdx) => {
    const totalProducts = wh.devices.length + wh.accessories.length + wh.warehouse_items.length + (wh.repair_parts || []).length;
    const typeLabels = {
      'devices': 'الأجهزة',
      'accessories': 'الإكسسوارات',
      'custom': 'مخصص',
      'repair_parts': 'قطع الصيانة',
      'spare_parts': 'قطع الصيانة'
    };
    const typeLabel = typeLabels[wh.type] || wh.type;
    const isStorage = wh.is_storage_only === 1;

    const allRows = allWarehouseRows[whIdx];
    const visibleRows = allRows.slice(0, MAX_ROWS);
    const hiddenCount = allRows.length - MAX_ROWS;

    return `
      <div class="table-card" style="margin-bottom:20px">
        <div class="table-header">
          <h3 class="table-title">${wh.icon || '🏭'} ${escapeHtml(wh.name)}</h3>
          <div style="display:flex;gap:8px;align-items:center">
            <span class="badge badge-info">${typeLabel}</span>
            ${isStorage ? '<span class="badge badge-warning">تخزيني</span>' : ''}
            <span class="badge badge-success">${totalProducts} منتج</span>
          </div>
        </div>
        <div class="table-container">
          <table>
            <thead>
              <tr>
                <th>النوع</th>
                <th>المنتج</th>
                <th>الكمية</th>
                <th>القيمة</th>
              </tr>
            </thead>
            <tbody id="whTableBody_${whIdx}">
              ${visibleRows.join('')}
              ${totalProducts === 0 ? '<tr><td colspan="4" class="empty-state">لا توجد منتجات في هذا المخزن</td></tr>' : ''}
            </tbody>
          </table>
          ${hiddenCount > 0 ? `
            <div id="whShowMore_${whIdx}" style="text-align:center;padding:12px">
              <button class="btn btn-secondary btn-sm" onclick="showMoreWarehouseItems(${whIdx})">
                عرض ${hiddenCount} منتج إضافي
              </button>
            </div>
          ` : ''}
        </div>
      </div>
    `;
  }).join('');

  // تخزين البيانات الكاملة لاستخدامها في "عرض المزيد"
  window._warehousesAllRows = allWarehouseRows;
}

function showMoreWarehouseItems(whIdx) {
  const tbody = document.getElementById(`whTableBody_${whIdx}`);
  const allRows = window._warehousesAllRows?.[whIdx] || [];
  if (tbody && allRows.length > 0) {
    tbody.innerHTML = allRows.join('');
  }
  // إخفاء زرار "عرض المزيد"
  const moreDiv = document.getElementById(`whShowMore_${whIdx}`);
  if (moreDiv) moreDiv.remove();
}

// ═══════════════════════════════════════════════════════════════
// 💵 CASHFLOW REPORT
// ═══════════════════════════════════════════════════════════════
async function loadCashflowReport() {
  applyReportPeriodFilter('cashflow');
  const { dateFrom, dateTo } = getReportFilterDates('cashflow');
  await loadCashflowData(dateFrom, dateTo);
  const allTransactions = reportsData.cashflow || [];

  // ✅ تحميل المحافظ الفعلية
  await loadPaymentWalletsForReports();

  // Get wallet filter
  const walletFilter = document.getElementById('cashflowWalletFilter')?.value || 'all';

  // Filter transactions by wallet if needed
  const transactions = walletFilter === 'all'
    ? allTransactions
    : allTransactions.filter(t => t.wallet_type === walletFilter);

  // ✅ حساب أرصدة المحافظ المجمعة حسب النوع (cash, mobile_wallet, bank)
  // نحتاج لجلب الأرصدة من API بدلاً من حسابها من المعاملات (للدقة)
  let walletBalances = { cash: 0, mobile_wallet: 0, bank: 0 };
  
  // ✅ تعريف أنواع التدفقات (مطلوبة لاحقاً في الكود)
  const inflowTypes = ['deposit', 'sale', 'opening_balance'];
  const outflowTypes = ['withdraw', 'withdrawal', 'expense', 'purchase'];
  
  try {
    const safeRes = await fetch('elos-db://safe-balance');
    if (safeRes.ok) {
      const safeData = await safeRes.json();
      
      // ✅ دعم النظام الجديد: wallets array - جمع الأرصدة حسب النوع
      if (safeData.wallets && Array.isArray(safeData.wallets)) {
        // النظام الجديد: wallets as array - جمع الأرصدة حسب النوع
        safeData.wallets.forEach(w => {
          const balance = Number(w.balance || 0);
          if (w.type === 'cash') walletBalances.cash += balance;
          else if (w.type === 'mobile_wallet') walletBalances.mobile_wallet += balance;
          else if (w.type === 'bank') walletBalances.bank += balance;
        });
      } 
      // ✅ دعم النظام القديم: wallets object (مجمعة حسب النوع)
      else if (safeData.wallets && typeof safeData.wallets === 'object') {
        walletBalances.cash = parseFloat(safeData.wallets.cash?.balance) || 0;
        walletBalances.mobile_wallet = parseFloat(safeData.wallets.mobile_wallet?.balance) || 0;
        walletBalances.bank = parseFloat(safeData.wallets.bank?.balance) || 0;
      }
    }
  } catch (e) {
    Logger.warn('[CASHFLOW] Could not fetch wallet balances, calculating from transactions:', e);
    // Fallback: حساب من المعاملات (للتوافق العكسي)
    allTransactions.forEach(t => {
      const wallet = t.wallet_type || 'cash';
      const amount = parseFloat(t.amount) || 0;
      // Handle internal transfers (sub_type = 'internal_transfer')
      if (t.sub_type === 'internal_transfer') {
        // Internal transfers: the type (withdrawal/deposit) already indicates the direction
        if (t.type === 'withdrawal') {
          walletBalances[wallet] = (walletBalances[wallet] || 0) - amount;
        } else if (t.type === 'deposit') {
          walletBalances[wallet] = (walletBalances[wallet] || 0) + amount;
        }
      } else if (inflowTypes.includes(t.type)) {
        walletBalances[wallet] = (walletBalances[wallet] || 0) + amount;
      } else if (outflowTypes.includes(t.type)) {
        walletBalances[wallet] = (walletBalances[wallet] || 0) - amount;
      }
    });
  }

  // Update wallet cards
  document.getElementById('cfWalletCash').textContent = fmt(walletBalances.cash) + ' ج.م';
  document.getElementById('cfWalletMobile').textContent = fmt(walletBalances.mobile_wallet) + ' ج.م';
  document.getElementById('cfWalletBank').textContent = fmt(walletBalances.bank) + ' ج.م';
  const totalBalance = walletBalances.cash + walletBalances.mobile_wallet + walletBalances.bank;
  document.getElementById('cfWalletTotal').textContent = fmt(totalBalance) + ' ج.م';

  // التدفقات الداخلة: إيداع + مبيعات + رصيد افتتاحي (استبعاد التحويلات الداخلية)
  const inflow = transactions.filter(t =>
    inflowTypes.includes(t.type) && t.sub_type !== 'internal_transfer'
  ).reduce((s, t) => s + (parseFloat(t.amount) || 0), 0);
  // التدفقات الخارجة: سحب + مصروفات + مشتريات (استبعاد التحويلات الداخلية)
  const outflow = transactions.filter(t =>
    outflowTypes.includes(t.type) && t.sub_type !== 'internal_transfer'
  ).reduce((s, t) => s + (parseFloat(t.amount) || 0), 0);
  const netFlow = inflow - outflow;

  // Get current balance based on filter
  const currentBalance = walletFilter === 'all' ? totalBalance : (walletBalances[walletFilter] || 0);

  // Calculate transfers (internal transfers have sub_type = 'internal_transfer')
  // Count only withdrawals to avoid double counting (each transfer = 1 withdraw + 1 deposit)
  const transfers = allTransactions.filter(t =>
    t.sub_type === 'internal_transfer' && t.type === 'withdrawal'
  );
  const transferCount = transfers.length;
  const transferTotal = transfers.reduce((s, t) => s + (parseFloat(t.amount) || 0), 0);

  // Stats
  document.getElementById('cashflowStats').innerHTML = `
    <div class="stat-card green">
      <div class="stat-header"><span class="stat-icon">📥</span></div>
      <div class="stat-label">التدفقات الداخلة</div>
      <div class="stat-value" style="color:var(--success)">${fmt(inflow)} ج.م</div>
    </div>
    <div class="stat-card red">
      <div class="stat-header"><span class="stat-icon">📤</span></div>
      <div class="stat-label">التدفقات الخارجة</div>
      <div class="stat-value" style="color:var(--danger)">${fmt(outflow)} ج.م</div>
    </div>
    <div class="stat-card ${netFlow >= 0 ? 'green' : 'red'}">
      <div class="stat-header"><span class="stat-icon">📊</span></div>
      <div class="stat-label">صافي التدفق</div>
      <div class="stat-value" style="color:${netFlow >= 0 ? 'var(--success)' : 'var(--danger)'}">${fmt(netFlow)} ج.م</div>
    </div>
    <div class="stat-card cyan">
      <div class="stat-header"><span class="stat-icon">💰</span></div>
      <div class="stat-label">${walletFilter === 'all' ? 'إجمالي الرصيد' : 'رصيد المحفظة'}</div>
      <div class="stat-value">${fmt(currentBalance)} ج.م</div>
    </div>
  `;

  // Summary
  document.getElementById('cashInflow').textContent = fmt(inflow) + ' ج.م';
  document.getElementById('cashOutflow').textContent = fmt(outflow) + ' ج.م';
  document.getElementById('netCashflow').textContent = fmt(netFlow) + ' ج.م';
  document.getElementById('currentBalance').textContent = fmt(currentBalance) + ' ج.م';
  document.getElementById('cfTransferCount').textContent = transferCount;
  document.getElementById('cfTransferTotal').textContent = fmt(transferTotal) + ' ج.م';

  // Chart
  createCashflowChart(allTransactions, walletFilter);

  // Table
  renderCashflowTable(transactions);
}

function createCashflowChart(transactions, walletFilter = 'all') {
  const ctx = document.getElementById('cashflowTrendChart');
  if (!ctx) return;

  if (charts.cashflowTrend) charts.cashflowTrend.destroy();

  // Group transactions by date and calculate daily balances per wallet
  const dailyData = {};
  const walletBalances = { cash: 0, mobile_wallet: 0, bank: 0 };
  const inflowTypes = ['deposit', 'sale', 'opening_balance'];
  const outflowTypes = ['withdraw', 'withdrawal', 'expense', 'purchase'];

  transactions.forEach(t => {
    const date = (t.date || t.created_at || '').split(' ')[0].split('T')[0];
    if (!date) return;

    const wallet = t.wallet_type || 'cash';
    const amount = parseFloat(t.amount) || 0;

    // Handle internal transfers (sub_type = 'internal_transfer')
    if (t.sub_type === 'internal_transfer') {
      // Internal transfers: withdrawal from source, deposit to target
      // The balance change is already handled by type (withdrawal/deposit)
      if (t.type === 'withdrawal') {
        walletBalances[wallet] -= amount;
      } else if (t.type === 'deposit') {
        walletBalances[wallet] += amount;
      }
    } else if (inflowTypes.includes(t.type)) {
      walletBalances[wallet] += amount;
    } else if (outflowTypes.includes(t.type)) {
      walletBalances[wallet] -= amount;
    }

    dailyData[date] = {
      cash: walletBalances.cash,
      mobile_wallet: walletBalances.mobile_wallet,
      bank: walletBalances.bank,
      total: walletBalances.cash + walletBalances.mobile_wallet + walletBalances.bank
    };
  });

  const dates = Object.keys(dailyData).sort().slice(-30);
  const datasets = [];

  if (walletFilter === 'all') {
    // Show all wallets
    datasets.push({
      label: 'كاش سائل',
      data: dates.map(d => dailyData[d]?.cash || 0),
      borderColor: '#22c55e',
      backgroundColor: 'rgba(34,197,94,0.1)',
      tension: 0.4,
      fill: false
    });
    datasets.push({
      label: 'محفظة إلكترونية',
      data: dates.map(d => dailyData[d]?.mobile_wallet || 0),
      borderColor: '#a855f7',
      backgroundColor: 'rgba(168,85,247,0.1)',
      tension: 0.4,
      fill: false
    });
    datasets.push({
      label: 'حساب بنكي',
      data: dates.map(d => dailyData[d]?.bank || 0),
      borderColor: '#3b82f6',
      backgroundColor: 'rgba(59,130,246,0.1)',
      tension: 0.4,
      fill: false
    });
    datasets.push({
      label: 'الإجمالي',
      data: dates.map(d => dailyData[d]?.total || 0),
      borderColor: '#06b6d4',
      backgroundColor: 'rgba(6,182,212,0.1)',
      tension: 0.4,
      fill: true,
      borderDash: [5, 5]
    });
  } else {
    // Show single wallet
    const walletLabels = {
      cash: 'كاش سائل',
      mobile_wallet: 'محفظة إلكترونية',
      bank: 'حساب بنكي'
    };
    const walletColors = {
      cash: '#22c55e',
      mobile_wallet: '#a855f7',
      bank: '#3b82f6'
    };
    datasets.push({
      label: walletLabels[walletFilter] || walletFilter,
      data: dates.map(d => dailyData[d]?.[walletFilter] || 0),
      borderColor: walletColors[walletFilter] || '#3b82f6',
      backgroundColor: `${walletColors[walletFilter] || '#3b82f6'}20`,
      tension: 0.4,
      fill: true
    });
  }

  charts.cashflowTrend = new Chart(ctx, {
    type: 'line',
    data: {
      labels: dates.map(d => formatShortDate(d)),
      datasets: datasets
    },
    options: getChartOptions()
  });
}

// ✅ تحميل المحافظ الفعلية (للتقارير)
async function loadPaymentWalletsForReports() {
  if (paymentWallets.length > 0) return paymentWallets;
  try {
    const res = await fetch('elos-db://payment-wallets?active_only=true');
    if (res.ok) {
      paymentWallets = await res.json();
    }
    return paymentWallets;
  } catch (error) {
    Logger.error('Failed to load payment wallets:', error);
    return [];
  }
}

function renderCashflowTable(transactions) {
  const container = document.getElementById('cashflowTableBody');

  if (!transactions.length) {
    container.innerHTML = '<tr><td colspan="7" class="empty-state">لا توجد حركات</td></tr>';
    return;
  }

  const typeLabels = {
    deposit: 'إيداع',
    withdraw: 'سحب',
    withdrawal: 'سحب',
    sale: 'مبيعات',
    purchase: 'مشتريات',
    expense: 'مصروفات',
    transfer: 'تحويل',
    internal_transfer: 'تحويل داخلي',
    opening_balance: 'رصيد افتتاحي'
  };

  // ✅ للتوافق العكسي (عند عدم وجود wallet_id)
  const walletLabels = {
    cash: '💵 كاش سائل',
    mobile_wallet: '📱 محفظة إلكترونية',
    bank: '🏦 حساب بنكي'
  };

  const isInflow = (type) => ['deposit', 'sale', 'opening_balance'].includes(type);
  const isTransfer = (type) => ['transfer', 'internal_transfer'].includes(type);

  container.innerHTML = transactions.slice(-50).reverse().map((t, i) => {
    const walletType = t.wallet_type || 'cash';
    let walletDisplay = walletLabels[walletType] || walletType;

    // ✅ جلب اسم المحفظة الفعلية إذا كان wallet_id موجوداً
    if (t.wallet_id && paymentWallets.length > 0) {
      const wallet = paymentWallets.find(w => w.id == t.wallet_id);
      if (wallet) {
        const walletIcon = walletType === 'cash' ? '💵' : walletType === 'mobile_wallet' ? '📱' : '🏦';
        walletDisplay = `${walletIcon} ${escapeHtml(wallet.name)}`;
      }
    }

    // For transfers, show source → target
    if (isTransfer(t.type) && t.target_wallet) {
      let targetDisplay = walletLabels[t.target_wallet] || t.target_wallet;
      // ✅ جلب اسم المحفظة الهدف إذا كان target_wallet_id موجوداً
      // (ملاحظة: target_wallet_id غير متوفر حالياً في البيانات، لكن نضيف الدعم للمستقبل)
      walletDisplay = `${walletDisplay} → ${targetDisplay}`;
    }

    return `
    <tr>
      <td>${i + 1}</td>
      <td>${formatDate(t.date || t.created_at)}</td>
      <td style="font-size: 12px;">${walletDisplay}</td>
      <td><span class="badge ${isInflow(t.type) ? 'badge-success' : isTransfer(t.type) ? 'badge-info' : 'badge-danger'}">${typeLabels[t.type] || t.type}</span></td>
      <td>${escapeHtml(t.description || t.notes || '-')}</td>
      <td style="color:${isInflow(t.type) ? 'var(--success)' : isTransfer(t.type) ? 'var(--info)' : 'var(--danger)'}">
        ${isInflow(t.type) ? '+' : isTransfer(t.type) ? '↔' : '-'}${fmt(t.amount)} ج.م
      </td>
      <td><strong>${fmt(t.balance)} ج.م</strong></td>
    </tr>
  `;
  }).join('');
}

// ═══════════════════════════════════════════════════════════════
// 👥 CLIENTS REPORT
// ═══════════════════════════════════════════════════════════════
async function loadClientsReport() {
  const clients = reportsData.clients || [];
  const suppliers = reportsData.suppliers || [];
  
  document.getElementById('clientsStats').innerHTML = `
    <div class="stat-card cyan">
      <div class="stat-header"><span class="stat-icon">👥</span></div>
      <div class="stat-label">إجمالي العملاء</div>
      <div class="stat-value">${clients.length}</div>
    </div>
    <div class="stat-card purple">
      <div class="stat-header"><span class="stat-icon">🏪</span></div>
      <div class="stat-label">إجمالي الموردين</div>
      <div class="stat-value">${suppliers.length}</div>
    </div>
  `;
  
  // Top Clients
  const clientSales = {};
  reportsData.sales?.forEach(s => {
    const name = s.client_name || 'نقدي';
    if (!clientSales[name]) clientSales[name] = { name, count: 0, total: 0, lastDate: s.sale_date };
    clientSales[name].count++;
    clientSales[name].total += parseFloat(s.total) || 0;
    if (s.sale_date > clientSales[name].lastDate) clientSales[name].lastDate = s.sale_date;
  });
  
  reportsData.devices?.filter(d => d.status === 'sold').forEach(d => {
    const name = d.client_name || 'نقدي';
    if (!clientSales[name]) clientSales[name] = { name, count: 0, total: 0, lastDate: d.sale_date };
    clientSales[name].count++;
    clientSales[name].total += parseFloat(d.sell_price) || 0;
    if (d.sale_date > clientSales[name].lastDate) clientSales[name].lastDate = d.sale_date;
  });
  
  const topClients = Object.values(clientSales).sort((a, b) => b.total - a.total).slice(0, 10);
  
  document.getElementById('topClientsTableBody').innerHTML = topClients.length ? topClients.map((c, i) => `
    <tr>
      <td>${i + 1}</td>
      <td><strong>${escapeHtml(c.name)}</strong></td>
      <td>${c.count}</td>
      <td>${fmt(c.total)} ج.م</td>
      <td>${formatDate(c.lastDate)}</td>
    </tr>
  `).join('') : '<tr><td colspan="5" class="empty-state">لا توجد بيانات</td></tr>';
  
  // Top Suppliers
  const supplierPurchases = {};
  reportsData.purchases?.forEach(p => {
    const name = p.supplier_name || 'غير محدد';
    const purchaseDate = p.purchase_date || p.created_at || '';
    if (!supplierPurchases[name]) supplierPurchases[name] = { name, count: 0, total: 0, lastDate: purchaseDate };
    supplierPurchases[name].count++;
    supplierPurchases[name].total += parseFloat(p.total_cost) || 0;
    if (purchaseDate && purchaseDate > supplierPurchases[name].lastDate) supplierPurchases[name].lastDate = purchaseDate;
  });
  
  const topSuppliers = Object.values(supplierPurchases).sort((a, b) => b.total - a.total).slice(0, 10);
  
  document.getElementById('topSuppliersTableBody').innerHTML = topSuppliers.length ? topSuppliers.map((s, i) => `
    <tr>
      <td>${i + 1}</td>
      <td><strong>${escapeHtml(s.name)}</strong></td>
      <td>${s.count}</td>
      <td>${fmt(s.total)} ج.م</td>
      <td>${formatDate(s.lastDate)}</td>
    </tr>
  `).join('') : '<tr><td colspan="5" class="empty-state">لا توجد بيانات</td></tr>';
}

// ═══════════════════════════════════════════════════════════════
// 🛒 PURCHASES REPORT
// ═══════════════════════════════════════════════════════════════
async function loadPurchasesReport() {
  applyReportPeriodFilter('purchases');
  const { dateFrom, dateTo } = getReportFilterDates('purchases');
  await loadPurchasesData(dateFrom, dateTo);
  const devicePurchases = reportsData.purchases || [];

  // جلب فواتير توريد الإكسسوارات
  let purchaseInvoices = [];
  try {
    const res = await fetch('elos-db://purchase-invoices');
    if (res.ok) {
      purchaseInvoices = await res.json();
    }
  } catch (e) {
    Logger.error('[PURCHASES] Error loading purchase invoices:', e);
  }

  // ✅ جلب التوريدات السريعة للإكسسوارات (من accessory_movements)
  let accessoryQuickPurchases = [];
  try {
    const res = await fetch('elos-db://accessory-purchases');
    if (res.ok) {
      accessoryQuickPurchases = await res.json();
      Logger.log('[PURCHASES] Loaded accessory quick purchases:', accessoryQuickPurchases.length);
    }
  } catch (e) {
    Logger.error('[PURCHASES] Error loading accessory quick purchases:', e);
  }

  // حساب إجمالي مشتريات الأجهزة
  const totalDevicePurchases = devicePurchases.reduce((s, p) => s + (parseFloat(p.total_cost) || 0), 0);

  // حساب إجمالي فواتير توريد الإكسسوارات
  const totalInvoicePurchases = purchaseInvoices.reduce((s, inv) => s + (parseFloat(inv.total_amount) || 0), 0);

  // ✅ حساب إجمالي التوريدات السريعة للإكسسوارات
  const totalQuickAccessoryPurchases = accessoryQuickPurchases.reduce((s, p) => {
    const qty = parseFloat(p.quantity) || 0;
    const cost = parseFloat(p.unit_cost) || parseFloat(p.total_price) || 0;
    return s + (qty > 0 && cost > 0 ? qty * cost : (parseFloat(p.total_cost) || parseFloat(p.total_price) || 0));
  }, 0);

  // إجمالي مشتريات الإكسسوارات (فواتير + توريد سريع)
  const totalAccessoryPurchases = totalInvoicePurchases + totalQuickAccessoryPurchases;

  // ✅ حساب المدفوعات والمرتجعات من معاملات الموردين
  const supplierTransactions = reportsData.supplierTransactions || [];
  const totalPayments = supplierTransactions
    .filter(t => t.type === 'payment')
    .reduce((s, t) => s + Math.abs(parseFloat(t.amount) || 0), 0);
  const totalReturns = supplierTransactions
    .filter(t => t.type === 'return')
    .reduce((s, t) => s + Math.abs(parseFloat(t.amount) || 0), 0);
  const totalPurchasesFromTx = supplierTransactions
    .filter(t => t.type === 'purchase')
    .reduce((s, t) => s + Math.abs(parseFloat(t.amount) || 0), 0);

  // ✅ حساب مشتريات قطع الصيانة
  const repairPartsPurchases = reportsData.repairPartsPurchases || [];
  const totalRepairPartsPurchases = repairPartsPurchases.reduce((s, p) => {
    const qty = parseFloat(p.qty) || parseFloat(p.quantity) || 0;
    const cost = parseFloat(p.unit_cost) || parseFloat(p.cost) || 0;
    return s + (qty * cost);
  }, 0);

  const totalPurchases = totalDevicePurchases + totalAccessoryPurchases + totalPurchasesFromTx + totalRepairPartsPurchases;
  const totalAccessoryPurchasesOpsCount = purchaseInvoices.length + accessoryQuickPurchases.length;

  document.getElementById('purchasesStats').innerHTML = `
    <div class="stat-card cyan">
      <div class="stat-header"><span class="stat-icon">🛒</span></div>
      <div class="stat-label">إجمالي المشتريات</div>
      <div class="stat-value">${fmt(totalPurchases)} ج.م</div>
      <div class="stat-desc">${devicePurchases.length + totalAccessoryPurchasesOpsCount + repairPartsPurchases.length + (totalPurchasesFromTx > 0 ? 1 : 0)} عملية</div>
    </div>
    <div class="stat-card blue">
      <div class="stat-header"><span class="stat-icon">📱</span></div>
      <div class="stat-label">مشتريات الأجهزة</div>
      <div class="stat-value">${fmt(totalDevicePurchases)} ج.م</div>
      <div class="stat-desc">${devicePurchases.length} جهاز</div>
    </div>
    <div class="stat-card purple">
      <div class="stat-header"><span class="stat-icon">🧾</span></div>
      <div class="stat-label">توريدات الإكسسوارات</div>
      <div class="stat-value">${fmt(totalAccessoryPurchases)} ج.م</div>
      <div class="stat-desc">${totalAccessoryPurchasesOpsCount} عملية</div>
    </div>
    ${totalPayments > 0 ? `
    <div class="stat-card green">
      <div class="stat-header"><span class="stat-icon">💳</span></div>
      <div class="stat-label">المدفوعات للموردين</div>
      <div class="stat-value">${fmt(totalPayments)} ج.م</div>
      <div class="stat-desc">${supplierTransactions.filter(t => t.type === 'payment').length} عملية</div>
    </div>
    ` : ''}
    ${totalReturns > 0 ? `
    <div class="stat-card orange">
      <div class="stat-header"><span class="stat-icon">↩️</span></div>
      <div class="stat-label">مرتجعات التوريد</div>
      <div class="stat-value">${fmt(totalReturns)} ج.م</div>
      <div class="stat-desc">${supplierTransactions.filter(t => t.type === 'return').length} عملية</div>
    </div>
    ` : ''}
    ${totalRepairPartsPurchases > 0 ? `
    <div class="stat-card red">
      <div class="stat-header"><span class="stat-icon">🔧</span></div>
      <div class="stat-label">مشتريات قطع الصيانة</div>
      <div class="stat-value">${fmt(totalRepairPartsPurchases)} ج.م</div>
      <div class="stat-desc">${repairPartsPurchases.length} عملية</div>
    </div>
    ` : ''}
  `;

  // ✅ عرض توريدات الإكسسوارات (فواتير + توريد سريع)
  const totalAccessoryPurchasesCount = purchaseInvoices.length + accessoryQuickPurchases.length;
  document.getElementById('purchaseInvoicesCount').textContent = `${totalAccessoryPurchasesCount} عملية`;

  // دمج الفواتير والتوريدات السريعة في قائمة واحدة
  const allAccessoryPurchases = [
    // الفواتير
    ...purchaseInvoices.map(inv => ({
      type: 'invoice',
      id: inv.id,
      invoice_number: inv.invoice_number || `PUR-${String(inv.id).padStart(6, '0')}`,
      date: inv.invoice_date || inv.created_at,
      supplier_name: inv.supplier_name || '-',
      items_count: inv.items_count || '-',
      total_amount: parseFloat(inv.total_amount) || 0,
      paid_amount: parseFloat(inv.paid_amount) || 0,
      status: inv.status
    })),
    // التوريدات السريعة
    ...accessoryQuickPurchases.map(p => {
      const qty = parseFloat(p.quantity) || 0;
      const cost = parseFloat(p.unit_cost) || 0;
      const total = qty * cost || parseFloat(p.total_price) || parseFloat(p.total_cost) || 0;
      return {
        type: 'quick',
        id: p.id,
        invoice_number: `توريد سريع #${p.id}`,
        date: p.created_at,
        supplier_name: p.supplier_name || '-',
        items_count: 1,
        accessory_name: p.accessory_name || '-',
        quantity: qty,
        total_amount: total,
        paid_amount: total, // التوريد السريع يُعتبر مدفوع
        status: 'paid'
      };
    })
  ].sort((a, b) => new Date(b.date) - new Date(a.date));

  document.getElementById('purchaseInvoicesBody').innerHTML = allAccessoryPurchases.length ?
    allAccessoryPurchases.slice(0, 50).map((item, i) => {
      const remaining = item.total_amount - item.paid_amount;
      let statusBadge;
      if (item.status === 'cancelled') {
        statusBadge = '<span class="badge badge-danger">ملغية</span>';
      } else if (item.type === 'quick') {
        statusBadge = '<span class="badge badge-info">توريد سريع</span>';
      } else if (remaining <= 0) {
        statusBadge = '<span class="badge badge-success">مدفوعة</span>';
      } else {
        statusBadge = '<span class="badge badge-warning">جزئي</span>';
      }

      return `
        <tr>
          <td>${i + 1}</td>
          <td><strong>${item.invoice_number}</strong></td>
          <td>${formatDate(item.date)}</td>
          <td>${item.supplier_name}</td>
          <td>${item.type === 'quick' ? `${item.accessory_name} (${item.quantity})` : item.items_count}</td>
          <td><strong>${fmt(item.total_amount)} ج.م</strong></td>
          <td style="color: var(--success);">${fmt(item.paid_amount)} ج.م</td>
          <td style="color: ${remaining > 0 ? 'var(--danger)' : 'var(--success)'};">${fmt(remaining)} ج.م</td>
          <td>${statusBadge}</td>
          <td>
            ${item.type === 'invoice' ? `
              <button class="btn btn-sm btn-primary" onclick="showPurchaseInvoiceDetails(${item.id})" title="عرض التفاصيل">
                👁️
              </button>
            ` : '-'}
          </td>
        </tr>
      `;
    }).join('') : '<tr><td colspan="10" class="empty-state">لا توجد فواتير توريد</td></tr>';

  // عرض مشتريات الأجهزة
  document.getElementById('devicePurchasesCount').textContent = `${devicePurchases.length} جهاز`;
  document.getElementById('devicePurchasesBody').innerHTML = devicePurchases.length ?
    devicePurchases.slice(0, 50).map((p, i) => {
      const deviceName = `${p.device_type || ''} ${p.device_model || ''} ${p.device_storage || ''}`.trim() || 'جهاز';
      return `
        <tr>
          <td>${i + 1}</td>
          <td>${formatDate(p.created_at)}</td>
          <td>${p.supplier_name || p.party_name || '-'}</td>
          <td><strong>${deviceName}</strong></td>
          <td><code style="font-size: 11px;">${p.imei || '-'}</code></td>
          <td><strong>${fmt(p.total_cost)} ج.م</strong></td>
          <td>${p.payment_method || 'نقدي'}</td>
        </tr>
      `;
    }).join('') : '<tr><td colspan="7" class="empty-state">لا توجد مشتريات أجهزة</td></tr>';
  
  // ✅ عرض مشتريات قطع الصيانة
  const repairPartsPurchasesEl = document.getElementById('repairPartsPurchasesCount');
  const repairPartsPurchasesBody = document.getElementById('repairPartsPurchasesBody');
  if (repairPartsPurchasesEl && repairPartsPurchasesBody) {
    repairPartsPurchasesEl.textContent = `${repairPartsPurchases.length} عملية`;
    repairPartsPurchasesBody.innerHTML = repairPartsPurchases.length ?
      repairPartsPurchases.slice(0, 50).map((p, i) => {
        const qty = parseFloat(p.qty) || parseFloat(p.quantity) || 0;
        const cost = parseFloat(p.unit_cost) || parseFloat(p.cost) || 0;
        const total = qty * cost;
        return `
          <tr>
            <td>${i + 1}</td>
            <td>${formatDate(p.created_at || p.date)}</td>
            <td>${escapeHtml(p.part_name || p.name || '-')}</td>
            <td><span class="badge badge-purple">${p.category || 'قطع صيانة'}</span></td>
            <td><strong>${qty}</strong></td>
            <td><strong>${fmt(cost)} ج.م</strong></td>
            <td><strong>${fmt(total)} ج.م</strong></td>
            <td>${p.supplier_name || p.supplier || '-'}</td>
          </tr>
        `;
      }).join('') : '<tr><td colspan="8" class="empty-state">لا توجد مشتريات قطع صيانة</td></tr>';
  }
}

// عرض تفاصيل فاتورة التوريد
async function showPurchaseInvoiceDetails(invoiceId) {
  try {
    const res = await fetch(`elos-db://purchase-invoices/${invoiceId}`);
    if (!res.ok) {
      showToast('فشل تحميل تفاصيل الفاتورة', 'error');
      return;
    }

    const data = await res.json();
    const { invoice, items } = data;

    // عرض معلومات الفاتورة
    document.getElementById('purchaseInvoiceModalTitle').textContent =
      `تفاصيل الفاتورة: ${invoice.invoice_number || `PUR-${String(invoice.id).padStart(6, '0')}`}`;

    const remaining = (parseFloat(invoice.total_amount) || 0) - (parseFloat(invoice.paid_amount) || 0);
    document.getElementById('purchaseInvoiceInfo').innerHTML = `
      <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 15px;">
        <div>
          <div style="color: var(--text-secondary); font-size: 12px;">المورد</div>
          <div style="font-weight: 600;">${invoice.supplier_name || '-'}</div>
        </div>
        <div>
          <div style="color: var(--text-secondary); font-size: 12px;">التاريخ</div>
          <div style="font-weight: 600;">${formatDate(invoice.invoice_date || invoice.created_at)}</div>
        </div>
        <div>
          <div style="color: var(--text-secondary); font-size: 12px;">طريقة الدفع</div>
          <div style="font-weight: 600;">${invoice.payment_method === 'cash' ? 'نقدي' : invoice.payment_method === 'credit' ? 'آجل' : (invoice.payment_method || '-')}</div>
        </div>
        <div>
          <div style="color: var(--text-secondary); font-size: 12px;">الإجمالي</div>
          <div style="font-weight: 700; color: var(--accent);">${fmt(invoice.total_amount)} ج.م</div>
        </div>
        <div>
          <div style="color: var(--text-secondary); font-size: 12px;">المدفوع</div>
          <div style="font-weight: 600; color: var(--success);">${fmt(invoice.paid_amount || 0)} ج.م</div>
        </div>
        <div>
          <div style="color: var(--text-secondary); font-size: 12px;">المتبقي</div>
          <div style="font-weight: 600; color: ${remaining > 0 ? 'var(--danger)' : 'var(--success)'};">${fmt(remaining)} ج.م</div>
        </div>
      </div>
      ${invoice.notes ? `<div style="margin-top: 10px; padding-top: 10px; border-top: 1px solid var(--border);"><strong>ملاحظات:</strong> ${invoice.notes}</div>` : ''}
    `;

    // عرض الأصناف
    document.getElementById('purchaseInvoiceItemsBody').innerHTML = items.length ?
      items.map((item, i) => `
        <tr>
          <td>${i + 1}</td>
          <td><strong>${item.accessory_name || '-'}</strong></td>
          <td>${item.quantity}</td>
          <td>${fmt(item.unit_price)} ج.م</td>
          <td><strong>${fmt(item.total_price)} ج.م</strong></td>
        </tr>
      `).join('') : '<tr><td colspan="5" class="empty-state">لا توجد أصناف</td></tr>';

    document.getElementById('purchaseInvoiceTotal').textContent = `${fmt(invoice.total_amount)} ج.م`;

    // فتح المودال
    document.getElementById('purchaseInvoiceModal').style.display = 'flex';

  } catch (e) {
    Logger.error('[PURCHASES] Error loading invoice details:', e);
    showToast('خطأ في تحميل تفاصيل الفاتورة', 'error');
  }
}

function closePurchaseInvoiceModal() {
  document.getElementById('purchaseInvoiceModal').style.display = 'none';
}

// إغلاق المودال بالضغط خارجه
document.getElementById('purchaseInvoiceModal')?.addEventListener('click', function(e) {
  if (e.target === this) closePurchaseInvoiceModal();
});

// ═══════════════════════════════════════════════════════════════
// 🧾 INVOICES REPORT (فواتير نقطة البيع)
// ═══════════════════════════════════════════════════════════════
async function loadInvoicesReport() {
  Logger.log('[REPORTS] Loading invoices report...');
  applyReportPeriodFilter('invoice');

  try {
    // جلب مبيعات الأجهزة
    const devicesRes = await fetch('elos-db://inventory');
    const devicesData = await devicesRes.json();
    const soldDevices = (Array.isArray(devicesData) ? devicesData : (devicesData.devices || [])).filter(d => d.status === 'sold');

    // جلب حركات الإكسسوارات (مبيعات ومرتجعات)
    const accessorySalesRes = await fetch('elos-db://accessory-movements?type=sale');
    const accessorySalesData = await accessorySalesRes.json();
    const accessorySales = Array.isArray(accessorySalesData) ? accessorySalesData : (accessorySalesData.movements || []);

    const accessoryReturnsRes = await fetch('elos-db://accessory-movements?type=return');
    const accessoryReturnsData = await accessoryReturnsRes.json();
    let accessoryReturns = Array.isArray(accessoryReturnsData) ? accessoryReturnsData : (accessoryReturnsData.movements || []);
    // فلترة: فقط مرتجعات المبيعات (client_id موجود أو reference_type بتاع بيع)
    // استبعاد مرتجعات التوريد (purchase_return, invoice_return, quick_return)
    accessoryReturns = accessoryReturns.filter(r =>
      r.client_id ||
      r.reference_type === 'sale_return' ||
      (r.reference_type && !r.reference_type.includes('purchase') && !r.reference_type.includes('invoice_return') && !r.reference_type.includes('quick_return'))
    ).filter(r =>
      !r.notes?.includes('مرتجع توريد') &&
      !r.notes?.includes('مرتجع شراء') &&
      !r.supplier_id
    );

    // جلب مرتجعات الأجهزة (من sales table)
    const salesRes = await fetch('elos-db://sales?include_returned=true');
    const salesData = await salesRes.json();
    const allSales = Array.isArray(salesData) ? salesData : (salesData.sales || []);
    const deviceReturns = allSales.filter(s => s.status === 'returned');

    // ✅ FIX: تجميع الأصناف حسب رقم الفاتورة بدلاً من عرض كل صنف كفاتورة مستقلة
    // جمع كل عناصر البيع (أجهزة + إكسسوارات) في مصفوفة واحدة
    const allSaleItems = [];

    // أجهزة مباعة
    soldDevices.forEach(d => {
      allSaleItems.push({
        id: d.id,
        invoice_number: d.invoice_number || `SAL-${String(d.id).padStart(6, '0')}`,
        type: 'sale',
        category: 'device',
        date: d.sale_date || d.created_at,
        client_name: d.client_name || d.customer_name || 'نقدي',
        items_count: 1,
        item_name: `${d.type || ''} ${d.model || ''} ${d.storage || ''}`.trim() || 'جهاز',
        total: (parseFloat(d.sell_price) || 0) - (parseFloat(d.discount) || 0),
        discount: parseFloat(d.discount) || 0,
        paid: parseFloat(d.paid_now) || parseFloat(d.sell_price) || 0,
        payment_method: d.payment_method || 'cash',
        status: 'completed'
      });
    });

    // مبيعات إكسسوارات
    accessorySales.forEach(s => {
      const qty = Math.abs(parseFloat(s.quantity) || 1);
      allSaleItems.push({
        id: s.id,
        invoice_number: s.invoice_number || `ACC-${String(s.id).padStart(6, '0')}`,
        type: 'sale',
        category: 'accessory',
        date: s.created_at,
        client_name: s.client_name || 'نقدي',
        items_count: qty,
        item_name: s.accessory_name || 'إكسسوار',
        total: parseFloat(s.total_price) || 0,
        discount: parseFloat(s.discount) || 0,
        paid: parseFloat(s.paid_amount) || parseFloat(s.total_price) || 0,
        payment_method: s.payment_method || 'cash',
        status: 'completed'
      });
    });

    // ✅ تجميع عناصر البيع حسب invoice_number
    const saleInvoicesMap = {};
    allSaleItems.forEach(item => {
      const invNum = item.invoice_number;
      if (!saleInvoicesMap[invNum]) {
        saleInvoicesMap[invNum] = {
          id: item.id,
          invoice_number: invNum,
          type: 'sale',
          category: 'mixed', // سيتم تحديثه
          date: item.date,
          client_name: item.client_name,
          items_count: 0,
          item_names: [],
          total: 0,
          discount: 0,
          paid: 0,
          payment_method: item.payment_method,
          status: 'completed',
          categories: new Set()
        };
      }
      const inv = saleInvoicesMap[invNum];
      inv.items_count += item.items_count;
      inv.item_names.push(item.item_name);
      inv.total += item.total;
      inv.discount += item.discount;
      inv.paid += item.paid;
      inv.categories.add(item.category);
      // أقدم تاريخ
      if (new Date(item.date) < new Date(inv.date)) inv.date = item.date;
    });

    // تحويل الـ map لـ array وتحديد الفئة
    const groupedSaleInvoices = Object.values(saleInvoicesMap).map(inv => {
      const cats = Array.from(inv.categories);
      if (cats.length === 1) inv.category = cats[0];
      else inv.category = 'mixed';

      // تحديد اسم العنصر المعروض
      if (inv.item_names.length === 1) {
        inv.item_name = inv.item_names[0];
      } else {
        inv.item_name = inv.item_names.slice(0, 2).join('، ') + (inv.item_names.length > 2 ? ` +${inv.item_names.length - 2}` : '');
      }
      delete inv.item_names;
      delete inv.categories;
      return inv;
    });

    // مرتجعات الأجهزة
    const deviceReturnInvoices = deviceReturns.map(r => ({
      id: r.id,
      invoice_number: r.invoice_number ? r.invoice_number.replace('SAL-', 'RET-') : `RET-${String(r.id).padStart(6, '0')}`,
      type: 'return',
      category: 'device',
      date: r.returned_at || r.created_at,
      client_name: r.client_name || r.customer_name || 'نقدي',
      items_count: 1,
      item_name: 'مرتجع جهاز',
      total: parseFloat(r.refund_amount) || 0,
      paid: 0,
      payment_method: 'cash',
      status: 'returned',
      return_reason: r.return_reason
    }));

    // مرتجعات الإكسسوارات
    const accessoryReturnInvoices = accessoryReturns.map(r => {
      const qty = Math.abs(parseFloat(r.quantity) || 1);
      const unitPrice = parseFloat(r.unit_price) || 0;
      return {
        id: r.id,
        invoice_number: r.invoice_number ? r.invoice_number.replace('ACC-', 'RET-') : `RET-${String(r.id).padStart(6, '0')}`,
        type: 'return',
        category: 'accessory',
        date: r.created_at,
        client_name: r.client_name || 'نقدي',
        items_count: qty,
        item_name: r.accessory_name || 'مرتجع إكسسوار',
        total: qty * unitPrice,
        paid: 0,
        payment_method: 'cash',
        status: 'returned'
      };
    });

    // دمج كل الفواتير المجمّعة
    const allInvoices = [
      ...groupedSaleInvoices,
      ...deviceReturnInvoices,
      ...accessoryReturnInvoices
    ].sort((a, b) => new Date(b.date) - new Date(a.date));

    // حفظ البيانات
    reportsData.invoices = allInvoices;

    // تطبيق الفلاتر (بما فيها التاريخ من فلتر الفترة) وتحديث البطاقات والجدول
    filterInvoices();

    Logger.log('[REPORTS] Invoices loaded:', allInvoices.length);

  } catch (error) {
    Logger.error('[REPORTS] Error loading invoices:', error);
    showToast('خطأ في تحميل الفواتير', 'error');
  }
}

function renderInvoicesTable(invoices) {
  const container = document.getElementById('invoicesTableBody');
  const countEl = document.getElementById('invoicesTableCount');

  if (countEl) countEl.textContent = `${invoices.length} فاتورة`;

  if (!invoices.length) {
    container.innerHTML = '<tr><td colspan="10" class="empty-state">لا توجد فواتير</td></tr>';
    return;
  }

  const typeLabels = { sale: 'بيع', return: 'مرتجع' };
  const typeClasses = { sale: 'badge-success', return: 'badge-danger' };
  const categoryLabels = { device: 'جهاز', accessory: 'إكسسوار', mixed: 'متعدد', repair_part: 'قطع غيار' };
  const paymentLabels = { cash: 'نقدي', card: 'بطاقة', transfer: 'تحويل' };
  const statusLabels = { completed: 'مكتمل', returned: 'مرتجع', cancelled: 'ملغي' };
  const statusClasses = { completed: 'badge-success', returned: 'badge-warning', cancelled: 'badge-danger' };

  // ✅ FIX: Check if current user is admin for edit button
  const _cu = window.currentUser || JSON.parse(localStorage.getItem('currentUser') || '{}');
  const isAdmin = _cu.role === 'admin' || _cu.role === 'manager';

  container.innerHTML = invoices.slice(0, 100).map((inv, i) => {
    const remaining = inv.total - inv.paid;
    const isPaid = remaining <= 0 || inv.type === 'return';

    // ✅ Edit button: admin only, sale invoices only (not returns)
    const editBtn = (isAdmin && inv.type === 'sale') ? `
      <button class="btn btn-sm btn-warning" onclick="openEditInvoiceModal('${inv.invoice_number}')" title="تعديل">✏️</button>
    ` : '';

    return `
      <tr>
        <td>${i + 1}</td>
        <td><strong style="font-family:monospace;color:var(--primary)">${inv.invoice_number}</strong></td>
        <td>
          <span class="badge ${typeClasses[inv.type]}">${typeLabels[inv.type]}</span>
          <span class="badge badge-info" style="margin-right:4px">${categoryLabels[inv.category]}</span>
        </td>
        <td>${formatDate(inv.date)}</td>
        <td>${inv.client_name || '-'}</td>
        <td title="${inv.item_name}">${inv.items_count} عنصر (${inv.item_name.substring(0, 20)}${inv.item_name.length > 20 ? '...' : ''})</td>
        <td style="color:${inv.type === 'return' ? 'var(--danger)' : 'var(--success)'}">
          ${inv.type === 'return' ? '-' : ''}${fmt(inv.total)} ج.م
        </td>
        <td>${inv.type === 'sale' ? fmt(inv.paid) + ' ج.م' : '-'}</td>
        <td><span class="badge ${isPaid ? 'badge-success' : 'badge-warning'}">${isPaid ? 'مدفوع' : 'متبقي ' + fmt(remaining)}</span></td>
        <td>
          <button class="btn btn-sm btn-info" onclick="viewInvoiceByNumber('${inv.invoice_number}')" title="عرض">👁️</button>
          <button class="btn btn-sm btn-secondary" onclick="printInvoiceByNumber('${inv.invoice_number}')" title="طباعة">🖨️</button>
          ${editBtn}
        </td>
      </tr>
    `;
  }).join('');
}

function filterInvoices() {
  const typeFilter = document.getElementById('invoiceTypeFilter').value;
  const searchFilter = document.getElementById('invoiceSearchFilter').value.toLowerCase();
  const dateFrom = document.getElementById('invoiceDateFrom')?.value;
  const dateTo = document.getElementById('invoiceDateTo')?.value;

  let filtered = reportsData.invoices || [];

  // ✅ فلتر التاريخ (من - إلى)
  if (dateFrom) {
    const fromDate = new Date(dateFrom);
    fromDate.setHours(0, 0, 0, 0);
    filtered = filtered.filter(inv => {
      const invDate = new Date(inv.date);
      invDate.setHours(0, 0, 0, 0);
      return invDate >= fromDate;
    });
  }
  if (dateTo) {
    const toDate = new Date(dateTo);
    toDate.setHours(23, 59, 59, 999);
    filtered = filtered.filter(inv => {
      const invDate = new Date(inv.date);
      return invDate <= toDate;
    });
  }

  if (typeFilter && typeFilter !== 'all') {
    filtered = filtered.filter(inv => inv.type === typeFilter);
  }

  if (searchFilter) {
    filtered = filtered.filter(inv =>
      (inv.invoice_number && inv.invoice_number.toLowerCase().includes(searchFilter)) ||
      (inv.client_name && inv.client_name.toLowerCase().includes(searchFilter)) ||
      (inv.item_name && inv.item_name.toLowerCase().includes(searchFilter))
    );
  }

  // ✅ تحديث البطاقات بناءً على الفواتير المفلترة
  updateInvoiceStats(filtered);

  renderInvoicesTable(filtered);
}

// ✅ دالة تحديث بطاقات الإحصائيات
function updateInvoiceStats(invoices) {
  const salesInvoices = invoices.filter(i => i.type === 'sale');
  const returnInvoices = invoices.filter(i => i.type === 'return');

  const totalSalesAmount = salesInvoices.reduce((sum, i) => sum + i.total, 0);
  const totalReturnsAmount = returnInvoices.reduce((sum, i) => sum + i.total, 0);

  document.getElementById('invoicesTotalCount').textContent = salesInvoices.length;
  document.getElementById('invoicesTotalAmount').textContent = fmt(totalSalesAmount) + ' ج.م';
  document.getElementById('invoicesReturnsCount').textContent = returnInvoices.length;
  document.getElementById('invoicesReturnsAmount').textContent = fmt(totalReturnsAmount) + ' ج.م';
}

function resetInvoiceFilters() {
  document.getElementById('invoiceTypeFilter').value = 'all';
  document.getElementById('invoiceSearchFilter').value = '';
  const periodEl = document.getElementById('invoicePeriodFilter');
  if (periodEl) {
    periodEl.value = 'last_month';
    applyReportPeriodFilter('invoice');
  }
  filterInvoices();
}

// متغير لحفظ الفاتورة الحالية المعروضة
let currentViewedInvoice = null;

async function viewInvoiceDetails(id, category) {
  Logger.log('[REPORTS] Viewing invoice details:', id, category);

  try {
    let invoiceData = null;

    if (category === 'device') {
      // البحث في البيانات المحملة مسبقاً
      const device = (reportsData.devices || []).find(d => d.id === id);

      if (device) {
        invoiceData = {
          id: device.id,
          invoice_number: device.invoice_number || `SAL-${String(device.id).padStart(6, '0')}`,
          type: device.status === 'returned' ? 'return' : 'sale',
          category: 'device',
          date: device.sale_date || device.created_at,
          client_name: device.client_name || device.customer_name || 'نقدي',
          client_phone: device.client_phone || device.customer_phone || '',
          items: [{
            name: `${device.type || ''} ${device.model || ''}`.trim(),
            brand: device.type,
            model: device.model,
            storage: device.storage,
            color: device.color,
            condition: device.condition,
            imei1: device.imei1,
            imei2: device.imei2,
            battery_health: device.battery_health,
            price: parseFloat(device.sell_price) || 0
          }],
          subtotal: parseFloat(device.sell_price) || 0,
          discount: parseFloat(device.discount) || 0,
          total: (parseFloat(device.sell_price) || 0) - (parseFloat(device.discount) || 0),
          paid: parseFloat(device.paid_now) || parseFloat(device.sell_price) || 0,
          payment_method: device.payment_method || 'cash',
          return_reason: device.return_reason
        };
      }
    } else if (category === 'accessory') {
      // البحث في حركات الإكسسوارات المحملة
      const movement = (reportsData.accessorySales || []).find(m => m.id === id);

      if (movement) {
        const qty = Math.abs(parseFloat(movement.quantity) || 1);
        const unitPrice = parseFloat(movement.unit_price) || 0;

        invoiceData = {
          id: movement.id,
          invoice_number: movement.invoice_number || `ACC-${String(movement.id).padStart(6, '0')}`,
          type: movement.type === 'return' ? 'return' : 'sale',
          category: 'accessory',
          date: movement.created_at,
          client_name: movement.client_name || 'نقدي',
          client_phone: movement.client_phone || '',
          items: [{
            name: movement.accessory_name || 'إكسسوار',
            category: movement.category,
            barcode: movement.barcode,
            quantity: qty,
            unit_price: unitPrice,
            price: qty * unitPrice
          }],
          subtotal: qty * unitPrice,
          discount: 0,
          total: qty * unitPrice,
          paid: parseFloat(movement.paid_amount) || (qty * unitPrice),
          payment_method: movement.payment_method || 'cash'
        };
      }
    }

    if (!invoiceData) {
      // إذا لم نجد البيانات من API، نبحث في البيانات المحفوظة
      const cachedInvoice = (reportsData.invoices || []).find(inv => inv.id === id && inv.category === category);
      if (cachedInvoice) {
        invoiceData = {
          ...cachedInvoice,
          items: [{
            name: cachedInvoice.item_name,
            quantity: cachedInvoice.items_count,
            price: cachedInvoice.total
          }],
          subtotal: cachedInvoice.total,
          discount: 0
        };
      }
    }

    if (!invoiceData) {
      showToast('لم يتم العثور على الفاتورة', 'error');
      return;
    }

    // حفظ الفاتورة الحالية
    currentViewedInvoice = invoiceData;

    // عرض التفاصيل في Modal
    renderInvoiceDetailsModal(invoiceData);

  } catch (error) {
    Logger.error('[REPORTS] Error loading invoice details:', error);
    showToast('خطأ في تحميل تفاصيل الفاتورة', 'error');
  }
}

// ✅ FIX: View invoice by invoice_number (uses the grouped invoice API)
async function viewInvoiceByNumber(invoiceNumber) {
  Logger.log('[REPORTS] Viewing invoice by number:', invoiceNumber);
  try {
    const response = await fetch(`elos-db://invoice/${invoiceNumber}`);
    if (!response.ok) throw new Error('فشل تحميل الفاتورة');
    const invoice = await response.json();

    const invoiceData = {
      id: invoice.items?.[0]?.sale_id || 0,
      invoice_number: invoice.invoice_number,
      type: invoice.status === 'returned' ? 'return' : 'sale',
      category: 'mixed',
      date: invoice.created_at,
      client_name: invoice.customer_name || invoice.client_name || 'نقدي',
      client_phone: invoice.customer_phone || '',
      items: (invoice.items || []).map(item => ({
        name: item.item_name || 'منتج',
        item_type: item.item_type,
        brand: item.type,
        model: item.model,
        storage: item.storage,
        color: item.color,
        condition: item.condition,
        imei1: item.imei1,
        imei2: item.imei2,
        battery_health: item.battery_health,
        category: item.type,
        quantity: item.quantity || 1,
        unit_price: item.unit_price || item.price,
        price: item.price || 0,
        discount: item.discount || 0,
        paid_now: item.paid_now || 0,
        status: item.status
      })),
      subtotal: invoice.total_amount || 0,
      discount: invoice.total_discount || 0,
      total: (invoice.total_amount || 0) - (invoice.total_discount || 0),
      paid: invoice.total_paid || 0,
      payment_method: invoice.payment_method || 'cash'
    };

    currentViewedInvoice = invoiceData;
    renderInvoiceDetailsModal(invoiceData);

  } catch (error) {
    Logger.error('[REPORTS] Error loading invoice:', error);
    showToast('خطأ في تحميل تفاصيل الفاتورة', 'error');
  }
}

// ✅ FIX: Print invoice by invoice_number
async function printInvoiceByNumber(invoiceNumber) {
  Logger.log('[REPORTS] Printing invoice:', invoiceNumber);
  try {
    // Try using the POS invoice print if available
    const response = await fetch(`elos-db://invoice/${invoiceNumber}`);
    if (!response.ok) throw new Error('فشل تحميل الفاتورة');
    const invoice = await response.json();

    // Use viewInvoiceByNumber first to load, then trigger print
    await viewInvoiceByNumber(invoiceNumber);
    // Trigger print from the modal if it has a print button
    setTimeout(() => {
      const printBtn = document.querySelector('#invoiceDetailsModal .btn-print, #invoiceDetailsModal [onclick*="print"]');
      if (printBtn) printBtn.click();
      else if (typeof printCurrentInvoice === 'function') printCurrentInvoice();
      else window.print();
    }, 500);

  } catch (error) {
    Logger.error('[REPORTS] Error printing invoice:', error);
    showToast('خطأ في طباعة الفاتورة', 'error');
  }
}

function renderInvoiceDetailsModal(invoice) {
  const container = document.getElementById('invoiceDetailsContent');
  const modal = document.getElementById('invoiceDetailsModal');

  const typeLabels = { sale: 'فاتورة بيع', return: 'فاتورة مرتجع' };
  const paymentLabels = { cash: 'نقدي', card: 'بطاقة', transfer: 'تحويل' };
  const remaining = invoice.total - invoice.paid;

  let itemsHTML = '';
  invoice.items.forEach(item => {
    itemsHTML += `
      <div class="invoice-item">
        <div class="invoice-item-name">${item.name || 'منتج'}</div>
        <div class="invoice-item-details">
          ${item.brand ? `<div>الماركة: ${item.brand}</div>` : ''}
          ${item.storage ? `<div>السعة: ${item.storage}</div>` : ''}
          ${item.color ? `<div>اللون: ${item.color}</div>` : ''}
          ${item.condition ? `<div>الحالة: ${item.condition}</div>` : ''}
          ${item.imei1 ? `<div style="font-family:monospace">IMEI1: ${item.imei1}</div>` : ''}
          ${item.imei2 ? `<div style="font-family:monospace">IMEI2: ${item.imei2}</div>` : ''}
          ${item.battery_health ? `<div>صحة البطارية: ${item.battery_health}%</div>` : ''}
          ${item.category ? `<div>الصنف: ${item.category}</div>` : ''}
          ${item.quantity > 1 ? `<div>الكمية: ${item.quantity}</div>` : ''}
          ${item.unit_price ? `<div>سعر الوحدة: ${fmt(item.unit_price)} ج.م</div>` : ''}
          <div style="font-weight:700;margin-top:5px;color:var(--success)">السعر: ${fmt(item.price)} ج.م</div>
        </div>
      </div>
    `;
  });

  container.innerHTML = `
    <div class="invoice-detail-card">
      <div class="invoice-detail-header">
        <div class="invoice-number-big">${invoice.invoice_number}</div>
        <div class="invoice-type-badge ${invoice.type}">${typeLabels[invoice.type]}</div>
      </div>

      <div class="invoice-info-row">
        <span class="invoice-info-label">📅 التاريخ</span>
        <span class="invoice-info-value">${formatDate(invoice.date)}</span>
      </div>
      <div class="invoice-info-row">
        <span class="invoice-info-label">👤 العميل</span>
        <span class="invoice-info-value">${invoice.client_name || 'نقدي'}</span>
      </div>
      ${invoice.client_phone ? `
        <div class="invoice-info-row">
          <span class="invoice-info-label">📞 الهاتف</span>
          <span class="invoice-info-value">${invoice.client_phone}</span>
        </div>
      ` : ''}
      <div class="invoice-info-row">
        <span class="invoice-info-label">💳 طريقة الدفع</span>
        <span class="invoice-info-value">${paymentLabels[invoice.payment_method] || invoice.payment_method}</span>
      </div>
      ${invoice.return_reason ? `
        <div class="invoice-info-row">
          <span class="invoice-info-label">📝 سبب الإرجاع</span>
          <span class="invoice-info-value" style="color:var(--danger)">${invoice.return_reason}</span>
        </div>
      ` : ''}
    </div>

    <div class="invoice-items-section">
      <div class="invoice-items-title">📦 الأصناف</div>
      ${itemsHTML}
    </div>

    <div class="invoice-detail-card" style="margin-top:15px">
      ${invoice.discount > 0 ? `
        <div class="invoice-info-row">
          <span class="invoice-info-label">المجموع الفرعي</span>
          <span class="invoice-info-value">${fmt(invoice.subtotal)} ج.م</span>
        </div>
        <div class="invoice-info-row">
          <span class="invoice-info-label">الخصم</span>
          <span class="invoice-info-value" style="color:var(--danger)">-${fmt(invoice.discount)} ج.م</span>
        </div>
      ` : ''}
      <div class="invoice-info-row">
        <span class="invoice-info-label">المدفوع</span>
        <span class="invoice-info-value" style="color:var(--success)">${fmt(invoice.paid)} ج.م</span>
      </div>
      ${remaining > 0 ? `
        <div class="invoice-info-row">
          <span class="invoice-info-label">المتبقي</span>
          <span class="invoice-info-value" style="color:var(--warning)">${fmt(remaining)} ج.م</span>
        </div>
      ` : ''}
    </div>

    <div class="invoice-total-section">
      <div class="invoice-total-label">${invoice.type === 'return' ? 'قيمة المرتجع' : 'الإجمالي'}</div>
      <div class="invoice-total-value">${fmt(invoice.total)} ج.م</div>
    </div>
  `;

  modal.style.display = 'flex';
}

function closeInvoiceModal() {
  const modal = document.getElementById('invoiceDetailsModal');
  modal.style.display = 'none';
  currentViewedInvoice = null;
}

function printCurrentInvoice() {
  if (!currentViewedInvoice) {
    showToast('لا توجد فاتورة للطباعة', 'warning');
    return;
  }
  printSingleInvoice(currentViewedInvoice.id, currentViewedInvoice.category);
}

function printSingleInvoice(id, category) {
  // البحث عن الفاتورة
  let invoice = currentViewedInvoice;
  if (!invoice || invoice.id !== id) {
    invoice = (reportsData.invoices || []).find(inv => inv.id === id && inv.category === category);
  }

  if (!invoice) {
    showToast('لم يتم العثور على الفاتورة', 'error');
    return;
  }

  // قراءة الإعدادات
  const settings = JSON.parse(localStorage.getItem('appSettings') || '{}');

  const typeLabels = { sale: 'فاتورة بيع', return: 'فاتورة مرتجع' };
  const paymentLabels = { cash: 'نقدي', card: 'بطاقة', transfer: 'تحويل' };

  // بناء محتوى الأصناف
  let itemsHTML = '';
  if (invoice.items && invoice.items.length) {
    invoice.items.forEach(item => {
      itemsHTML += `
        <div class="item">
          <div class="item-name">${item.name || 'منتج'}</div>
          ${item.brand ? `<div class="item-detail">الماركة: ${item.brand}</div>` : ''}
          ${item.storage ? `<div class="item-detail">السعة: ${item.storage}</div>` : ''}
          ${item.color ? `<div class="item-detail">اللون: ${item.color}</div>` : ''}
          ${item.condition ? `<div class="item-detail">الحالة: ${item.condition}</div>` : ''}
          ${item.imei1 ? `<div class="item-detail imei">IMEI1: ${item.imei1}</div>` : ''}
          ${item.imei2 ? `<div class="item-detail imei">IMEI2: ${item.imei2}</div>` : ''}
          ${item.quantity > 1 ? `<div class="item-detail">الكمية: ${item.quantity}</div>` : ''}
          <div class="item-price">${fmt(item.price)} ج.م</div>
        </div>
      `;
    });
  } else {
    itemsHTML = `
      <div class="item">
        <div class="item-name">${invoice.item_name || 'منتج'}</div>
        <div class="item-detail">الكمية: ${invoice.items_count || 1}</div>
        <div class="item-price">${fmt(invoice.total)} ج.م</div>
      </div>
    `;
  }

  const remaining = (invoice.total || 0) - (invoice.paid || 0);

  // فتح نافذة الطباعة
  const printWindow = window.open('', '_blank', 'width=400,height=600');
  printWindow.document.write(`
    <!DOCTYPE html>
    <html dir="rtl" lang="ar">
    <head>
      <meta charset="UTF-8">
      <title>فاتورة ${invoice.invoice_number}</title>
      <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body {
          font-family: 'Cairo', Arial, sans-serif;
          width: ${settings.printerPaperWidth === '58' ? '54mm' : '76mm'};
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
        .company-info { font-size: 10px; color: #333; }
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
        .item-detail.imei { font-family: monospace; }
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
        .remaining {
          background: #ffcccc;
          padding: 8px;
          text-align: center;
          font-weight: 700;
          font-size: 12px;
          border: 1px solid #f00;
        }
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
        .barcode-svg {
          display: flex;
          justify-content: center;
          margin: 10px 0;
        }
        .barcode-svg svg {
          max-width: 100%;
          height: auto;
        }
        @media print {
          body { width: 100%; }
          @page { margin: 0; }
        }
      </style>
    </head>
    <body>
      <div class="header">
        ${settings.companyLogo ? `<img src="${settings.companyLogo}" class="logo" />` : ''}
        <div class="company-name">${settings.companyName || 'ELOS System'}</div>
        ${settings.companyPhone ? `<div class="company-info">📞 ${settings.companyPhone}</div>` : ''}
        ${settings.companyAddress ? `<div class="company-info">📍 ${settings.companyAddress}</div>` : ''}
      </div>

      <div class="invoice-title">${typeLabels[invoice.type] || 'فاتورة'}</div>

      <div class="invoice-info">
        <div class="info-row">
          <span>رقم الفاتورة:</span>
          <span style="font-weight:700;font-family:monospace">${invoice.invoice_number}</span>
        </div>
        <div class="info-row">
          <span>التاريخ:</span>
          <span>${formatDate(invoice.date)}</span>
        </div>
        <div class="info-row">
          <span>العميل:</span>
          <span>${invoice.client_name || 'نقدي'}</span>
        </div>
        ${invoice.client_phone ? `
          <div class="info-row">
            <span>الهاتف:</span>
            <span>${invoice.client_phone}</span>
          </div>
        ` : ''}
      </div>

      <div class="items-section">
        <div class="items-header">📦 الأصناف</div>
        ${itemsHTML}
      </div>

      <div class="totals">
        ${invoice.discount > 0 ? `
          <div class="total-row">
            <span>المجموع الفرعي:</span>
            <span>${fmt(invoice.subtotal)} ج.م</span>
          </div>
          <div class="total-row">
            <span>الخصم:</span>
            <span style="color:red">-${fmt(invoice.discount)} ج.م</span>
          </div>
        ` : ''}
        <div class="total-row">
          <span>المدفوع:</span>
          <span style="color:green">${fmt(invoice.paid)} ج.م</span>
        </div>
        <div class="total-row">
          <span>طريقة الدفع:</span>
          <span>${paymentLabels[invoice.payment_method] || invoice.payment_method}</span>
        </div>
      </div>

      <div class="grand-total">
        <div class="grand-total-label">${invoice.type === 'return' ? 'قيمة المرتجع' : 'الإجمالي'}</div>
        <div class="grand-total-value">${fmt(invoice.total)} ج.م</div>
      </div>

      ${remaining > 0 ? `
        <div class="remaining">⚠️ المتبقي: ${fmt(remaining)} ج.م</div>
      ` : ''}

      <div class="footer">
        <div>✨ ${settings.printerFooterMessage || 'شكراً لتعاملكم معنا'} ✨</div>
        ${invoice.invoice_number ? `
          <div class="barcode-svg">
            ${typeof BarcodeService !== 'undefined' 
              ? BarcodeService.generateInvoiceBarcodeLabel(invoice, { width: 200, height: 40 })
              : `<div class="barcode">${invoice.invoice_number}</div>`
            }
          </div>
          <div class="barcode" style="margin-top:5px;">${invoice.invoice_number}</div>
        ` : ''}
        <div style="margin-top:8px;font-size:8px;color:#999">ELOS System</div>
      </div>

      <script>
        setTimeout(() => {
          window.print();
          setTimeout(() => window.close(), 500);
        }, 300);
      <\/script>
    </body>
    </html>
  `);
  printWindow.document.close();
}

// ═══════════════════════════════════════════════════════════════
// 📥 EXPORT FUNCTIONS
// ═══════════════════════════════════════════════════════════════
function exportAccessoriesReport() { exportToCSV(reportsData.accessories, 'accessories_report.csv'); }
function exportRepairPartsReport() { exportToCSV(reportsData.repairParts, 'repair_parts_report.csv'); }
function exportSalesReport() { exportToCSV([...reportsData.devices.filter(d => d.status === 'sold'), ...reportsData.sales], 'sales_report.csv'); }
function exportPurchasesReport() { exportToCSV(reportsData.purchases, 'purchases_report.csv'); }
function exportPartnersReport() { exportToCSV(reportsData.partners, 'partners_report.csv'); }
function exportInvoicesReport() {
  const invoices = reportsData.invoices || [];
  if (!invoices.length) {
    showToast('لا توجد فواتير للتصدير', 'warning');
    return;
  }

  const exportData = invoices.map(inv => ({
    'رقم الفاتورة': inv.invoice_number,
    'النوع': inv.type === 'sale' ? 'بيع' : 'مرتجع',
    'الصنف': inv.category === 'device' ? 'جهاز' : 'إكسسوار',
    'التاريخ': formatDate(inv.date),
    'العميل': inv.client_name,
    'المنتج': inv.item_name,
    'الكمية': inv.items_count,
    'الإجمالي': inv.total,
    'المدفوع': inv.paid,
    'الحالة': inv.type === 'return' ? 'مرتجع' : (inv.total <= inv.paid ? 'مدفوع' : 'متبقي')
  }));

  exportToCSV(exportData, 'invoices_report.csv');
}
function exportWarehousesReport() { showToast('جاري تصدير تقرير المخازن...', 'info'); }
function exportCashflowReport() { exportToCSV(reportsData.cashflow, 'cashflow_report.csv'); }

function printInvoicesReport() {
  const invoices = reportsData.invoices || [];
  if (!invoices.length) {
    showToast('لا توجد فواتير للطباعة', 'warning');
    return;
  }

  const salesInvoices = invoices.filter(i => i.type === 'sale');
  const returnInvoices = invoices.filter(i => i.type === 'return');
  const totalSales = salesInvoices.reduce((sum, i) => sum + i.total, 0);
  const totalReturns = returnInvoices.reduce((sum, i) => sum + i.total, 0);

  const printWindow = window.open('', '_blank');
  printWindow.document.write(`
    <!DOCTYPE html>
    <html dir="rtl" lang="ar">
    <head>
      <meta charset="UTF-8">
      <title>تقرير الفواتير - ELOS System</title>
      <style>
        body { font-family: 'Cairo', Arial, sans-serif; padding: 20px; direction: rtl; }
        h1 { text-align: center; color: #3b82f6; margin-bottom: 10px; }
        .date { text-align: center; color: #666; margin-bottom: 20px; }
        .stats { display: flex; justify-content: space-around; margin-bottom: 20px; padding: 15px; background: #f5f5f5; border-radius: 8px; }
        .stat { text-align: center; }
        .stat-value { font-size: 24px; font-weight: bold; color: #3b82f6; }
        .stat-label { font-size: 12px; color: #666; }
        table { width: 100%; border-collapse: collapse; margin-top: 20px; }
        th, td { border: 1px solid #ddd; padding: 8px; text-align: right; font-size: 12px; }
        th { background: #3b82f6; color: white; }
        tr:nth-child(even) { background: #f9f9f9; }
        .badge { padding: 2px 8px; border-radius: 4px; font-size: 10px; }
        .badge-success { background: #10b981; color: white; }
        .badge-danger { background: #ef4444; color: white; }
        .footer { text-align: center; margin-top: 30px; color: #999; font-size: 10px; }
        @media print { body { padding: 10px; } }
      </style>
    </head>
    <body>
      <h1>🧾 تقرير الفواتير</h1>
      <div class="date">التاريخ: ${new Date().toLocaleDateString('ar-EG')} | ELOS System</div>

      <div class="stats">
        <div class="stat">
          <div class="stat-value">${invoices.length}</div>
          <div class="stat-label">إجمالي الفواتير</div>
        </div>
        <div class="stat">
          <div class="stat-value">${fmt(totalSales)}</div>
          <div class="stat-label">إجمالي المبيعات (ج.م)</div>
        </div>
        <div class="stat">
          <div class="stat-value">${returnInvoices.length}</div>
          <div class="stat-label">المرتجعات</div>
        </div>
        <div class="stat">
          <div class="stat-value">${fmt(totalReturns)}</div>
          <div class="stat-label">قيمة المرتجعات (ج.م)</div>
        </div>
      </div>

      <table>
        <thead>
          <tr>
            <th>#</th>
            <th>رقم الفاتورة</th>
            <th>النوع</th>
            <th>التاريخ</th>
            <th>العميل</th>
            <th>المنتج</th>
            <th>الإجمالي</th>
            <th>الحالة</th>
          </tr>
        </thead>
        <tbody>
          ${invoices.slice(0, 100).map((inv, i) => `
            <tr>
              <td>${i + 1}</td>
              <td>${inv.invoice_number}</td>
              <td><span class="badge ${inv.type === 'sale' ? 'badge-success' : 'badge-danger'}">${inv.type === 'sale' ? 'بيع' : 'مرتجع'}</span></td>
              <td>${formatDate(inv.date)}</td>
              <td>${inv.client_name}</td>
              <td>${inv.item_name}</td>
              <td>${fmt(inv.total)} ج.م</td>
              <td>${inv.total <= inv.paid || inv.type === 'return' ? 'مكتمل' : 'متبقي'}</td>
            </tr>
          `).join('')}
        </tbody>
      </table>

      <div class="footer">
        تم إنشاء هذا التقرير بواسطة ELOS ERP System - ${new Date().toLocaleString('ar-EG')}
      </div>

      <script>setTimeout(() => window.print(), 500);<\/script>
    </body>
    </html>
  `);
  printWindow.document.close();
}

function exportToCSV(data, filename) {
  if (!data || !data.length) {
    showToast('لا توجد بيانات للتصدير', 'warning');
    return;
  }
  
  const headers = Object.keys(data[0]);
  const csv = [
    headers.join(','),
    ...data.map(row => headers.map(h => `"${row[h] || ''}"`).join(','))
  ].join('\n');
  
  const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8' });
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = filename;
  link.click();
  
  showToast('تم التصدير بنجاح', 'success');
}

function printReport(type) {
  window.print();
}

// ═══════════════════════════════════════════════════════════════
// 🔧 REPAIRS REPORT - تقارير الصيانة
// ═══════════════════════════════════════════════════════════════

// Endpoint discovery strategy (يدعم from/to للفلترة من السيرفر)
async function fetchRepairsDataset(dateFrom, dateTo) {
  // المحاولة الأولى: elos-db://repairs يدعم from, to, limit
  const params = new URLSearchParams();
  if (dateFrom) params.set('from', dateFrom);
  if (dateTo) params.set('to', dateTo);
  params.set('limit', '5000');
  const repairsUrl = 'elos-db://repairs?' + params.toString();

  try {
    const response = await fetch(repairsUrl);
    if (response.ok) {
      const data = await response.json();
      Logger.log('[REPORTS] Repairs loaded:', Array.isArray(data) ? data.length : (data?.tickets?.length ?? data?.repairs?.length ?? 0));
      return { data, endpoint: 'elos-db://repairs' };
    }
  } catch (error) {
    Logger.warn('[REPORTS] elos-db://repairs failed:', error.message);
  }

  // Fallback: تجربة endpoints أخرى بدون فلتر تاريخ
  const endpoints = ['elos-db://repairs', 'elos-db://repair_tickets', 'elos-db://repairTickets', 'elos-db://maintenance'];
  for (const endpoint of endpoints) {
    try {
      const response = await fetch(endpoint);
      if (response.ok) {
        const data = await response.json();
        Logger.log('[REPORTS] Repairs endpoint found:', endpoint);
        return { data, endpoint };
      }
    } catch (error) {
      Logger.warn(`[REPORTS] Endpoint ${endpoint} failed:`, error.message);
      continue;
    }
  }

  throw new Error('تعذر العثور على endpoint بيانات الصيانة');
}

// Normalize repairs data
function normalizeRepairsData(data) {
  const tickets = Array.isArray(data) ? data : (data.tickets || data.repairs || data.items || []);
  return tickets.map(ticket => {
    // Financial fields mapping with fallbacks
    const total = parseFloat(ticket.total_cost || ticket.total || ticket.total_amount || ticket.amount || ticket.grand_total || 0);
    const paid = parseFloat(ticket.paid || ticket.paid_now || ticket.paid_amount || 
      (ticket.total_paid !== undefined ? ticket.total_paid : 0));
    const remaining = ticket.remaining !== undefined ? parseFloat(ticket.remaining) : Math.max(0, total - paid);
    
    // Status mapping
    const status = ticket.status || ticket.state || 'unknown';
    
    // Date mapping
    const created_at = ticket.created_at || ticket.date || ticket.createdAt || '';
    const delivered_at = ticket.delivered_at || ticket.deliveredAt || '';
    
    // Customer mapping
    const customer = ticket.customer_name || ticket.client_name || ticket.customer || '-';
    
    // Device/Model mapping
    const device = ticket.device_model || ticket.model || ticket.device || '-';
    const deviceBrand = ticket.device_brand || ticket.brand || '';
    const deviceModel = ticket.device_model || ticket.model || '';
    const deviceDisplay = [deviceBrand, deviceModel].filter(Boolean).join(' ') || device;
    
    // Financial lock check
    const isFinanciallyClosed = ticket.is_financially_closed === 1 || 
                                ticket.is_financially_closed === true ||
                                ticket.financially_closed === 1 ||
                                ticket.financially_closed === true ||
                                !!ticket.close_id;
    
    // Payment method
    const paymentMethod = ticket.payment_method || ticket.method || '-';
    
    // Is adjustment
    const isAdjustment = ticket.is_adjustment === 1 || ticket.is_adjustment === true;
    
    return {
      ...ticket,
      total,
      paid,
      remaining,
      status,
      created_at,
      delivered_at,
      customer,
      device: deviceDisplay,
      is_financially_closed: isFinanciallyClosed,
      payment_method: paymentMethod,
      is_adjustment: isAdjustment
    };
  });
}

// Get status label in Arabic
function getRepairStatusLabel(status) {
  const labels = {
    'received': 'مستلم',
    'diagnosing': 'قيد الفحص',
    'waiting_approval': 'في انتظار الموافقة',
    'in_repair': 'تحت الصيانة',
    'ready': 'جاهز للتسليم',
    'delivered': 'تم التسليم',
    'cancelled': 'ملغي',
    'canceled': 'ملغي',
    'open': 'مفتوحة',
    'closed': 'مقفولة',
    'unknown': 'غير معروف'
  };
  return labels[status] || status;
}

// Clear repairs filters
function clearRepairsFilters() {
  const periodEl = document.getElementById('repairsPeriodFilter');
  const statusFilter = document.getElementById('repairsStatusFilter');
  if (periodEl) { periodEl.value = 'last_month'; applyReportPeriodFilter('repairs'); }
  if (statusFilter) statusFilter.value = '';
  loadRepairsReport();
}

// Load repairs report
async function loadRepairsReport() {
  try {
    applyReportPeriodFilter('repairs');
    const { dateFrom, dateTo } = getReportFilterDates('repairs');
    const statusFilterEl = document.getElementById('repairsStatusFilter');
    const statusFilter = statusFilterEl?.value || '';

    // Fetch data (مع فلتر الفترة من السيرفر إن أمكن)
    let rawData;
    try {
      const result = await fetchRepairsDataset(dateFrom, dateTo);
      rawData = result.data;
      reportsData.repairs = normalizeRepairsData(rawData);
    } catch (error) {
      Logger.error('[REPORTS] Failed to fetch repairs data:', error);
      showToast('تعذر تحميل بيانات الصيانة', 'error');
      reportsData.repairs = [];
      
      // Show empty state
      document.getElementById('repairsTableBody').innerHTML = 
        '<tr><td colspan="12" class="empty-state"><div class="empty-state-icon">🔧</div><div>لا توجد بيانات متاحة</div><div style="font-size:11px; margin-top:8px; color:var(--text-muted);">تعذر الاتصال بخادم بيانات الصيانة</div></td></tr>';
      return;
    }
    
    // Filter data
    let filtered = reportsData.repairs || [];
    
    // استخراج التاريخ فقط (يدعم YYYY-MM-DD و YYYY-MM-DD HH:MM:SS و ISO)
    const getTicketDate = (t) => {
      const raw = (t.created_at || '').trim();
      if (!raw) return '';
      const part = raw.split('T')[0].split(' ')[0];
      return part || raw.substring(0, 10);
    };
    // Date filter (التذكرة بدون تاريخ تظهر في النتائج)
    if (dateFrom) {
      filtered = filtered.filter(t => {
        const ticketDate = getTicketDate(t);
        return !ticketDate || ticketDate >= dateFrom;
      });
    }
    if (dateTo) {
      filtered = filtered.filter(t => {
        const ticketDate = getTicketDate(t);
        return !ticketDate || ticketDate <= dateTo;
      });
    }
    
    // Status filter
    if (statusFilter) {
      if (statusFilter === 'open') {
        filtered = filtered.filter(t => 
          t.status && !['delivered', 'cancelled', 'canceled'].includes(t.status)
        );
      } else if (statusFilter === 'delivered') {
        filtered = filtered.filter(t => t.status === 'delivered');
      } else if (statusFilter === 'financially_closed') {
        filtered = filtered.filter(t => t.is_financially_closed);
      } else if (statusFilter === 'adjustment') {
        filtered = filtered.filter(t => t.is_adjustment);
      }
    }
    
    // Calculate KPIs
    const totalTickets = filtered.length;
    const totalRevenue = filtered.reduce((sum, t) => sum + (t.total || 0), 0);
    const totalCollections = filtered.reduce((sum, t) => sum + (t.paid || 0), 0);
    const avgTicket = totalTickets > 0 ? totalRevenue / totalTickets : 0;
    const openTickets = filtered.filter(t => 
      t.status && !['delivered', 'cancelled', 'canceled'].includes(t.status)
    ).length;
    const closedTickets = filtered.filter(t => t.is_financially_closed).length;
    
    // Update KPI cards
    document.getElementById('repairsTotalTickets').textContent = totalTickets;
    document.getElementById('repairsTotalRevenue').textContent = `${fmt(totalRevenue)} ج.م`;
    document.getElementById('repairsTotalCollections').textContent = `${fmt(totalCollections)} ج.م`;
    document.getElementById('repairsAvgTicket').textContent = `${fmt(avgTicket)} ج.م`;
    document.getElementById('repairsOpenTickets').textContent = openTickets;
    document.getElementById('repairsClosedTickets').textContent = closedTickets;
    
    // Create charts
    createRepairsCharts(filtered);
    
    // Render table
    renderRepairsTable(filtered);
    
    // تذاكر حسب الفني
    renderRepairsByTechnician(filtered);
    
    // Update table count
    document.getElementById('repairsTableCount').textContent = `${totalTickets} تذكرة`;
    
  } catch (error) {
    Logger.error('[REPORTS] Error loading repairs report:', error);
    showToast('خطأ في تحميل تقرير الصيانة', 'error');
  }
}

// Create repairs charts
function createRepairsCharts(tickets) {
  // Status Distribution Chart
  const statusCtx = document.getElementById('repairsStatusChart');
  if (statusCtx) {
    if (charts.repairsStatus) charts.repairsStatus.destroy();
    
    const statusCounts = {};
    tickets.forEach(t => {
      const status = t.status || 'unknown';
      statusCounts[status] = (statusCounts[status] || 0) + 1;
    });
    
    const statusLabels = {
      'received': 'مستلم',
      'diagnosing': 'قيد الفحص',
      'waiting_approval': 'في انتظار الموافقة',
      'in_repair': 'تحت الصيانة',
      'ready': 'جاهز للتسليم',
      'delivered': 'تم التسليم',
      'cancelled': 'ملغي',
      'canceled': 'ملغي',
      'open': 'مفتوحة',
      'closed': 'مقفولة',
      'unknown': 'غير معروف'
    };
    
    charts.repairsStatus = new Chart(statusCtx, {
      type: 'doughnut',
      data: {
        labels: Object.keys(statusCounts).map(k => statusLabels[k] || k),
        datasets: [{
          data: Object.values(statusCounts),
          backgroundColor: ['#3b82f6', '#10b981', '#f59e0b', '#a855f7', '#ec4899', '#6b7280', '#ef4444'],
          borderWidth: 0
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { position: 'bottom', labels: { color: '#8b93a6' } }
        }
      }
    });
  }
  
  // Revenue Trend Chart
  const revenueCtx = document.getElementById('repairsRevenueChart');
  if (revenueCtx) {
    if (charts.repairsRevenue) charts.repairsRevenue.destroy();
    
    // Group by date
    const revenueByDate = {};
    tickets.forEach(t => {
      const date = (t.created_at || '').split('T')[0];
      if (!date) return;
      if (!revenueByDate[date]) revenueByDate[date] = 0;
      revenueByDate[date] += (t.total || 0);
    });
    
    const sortedDates = Object.keys(revenueByDate).sort();
    const lastDates = sortedDates.slice(-14); // Last 14 days
    
    charts.repairsRevenue = new Chart(revenueCtx, {
      type: 'line',
      data: {
        labels: lastDates.map(d => formatShortDate(d)),
        datasets: [{
          label: 'الإيراد',
          data: lastDates.map(d => revenueByDate[d] || 0),
          borderColor: '#3b82f6',
          backgroundColor: 'rgba(59,130,246,0.1)',
          tension: 0.4,
          fill: true
        }]
      },
      options: getChartOptions()
    });
  }
}

// Render repairs table
function renderRepairsTable(tickets) {
  const container = document.getElementById('repairsTableBody');
  if (!container) return;
  
  if (!tickets || tickets.length === 0) {
    container.innerHTML = '<tr><td colspan="12" class="empty-state"><div class="empty-state-icon">🔧</div><div>لا توجد تذاكر صيانة</div></td></tr>';
    return;
  }
  
  container.innerHTML = tickets.map((ticket, i) => {
    const statusLabel = getRepairStatusLabel(ticket.status);
    const statusBadgeClass = ticket.status === 'delivered' ? 'badge-success' :
                            ticket.status === 'cancelled' || ticket.status === 'canceled' ? 'badge-danger' :
                            'badge-info';
    const isLocked = ticket.is_financially_closed ? '🔒 نعم' : '🔓 لا';
    const ticketNo = ticket.ticket_no || `#${ticket.id}`;
    const adjBadge = ticket.is_adjustment ? ' <span class="badge badge-warning" style="font-size:9px;">ADJ</span>' : '';
    
    return `
      <tr>
        <td>${i + 1}</td>
        <td><strong>${escapeHtml(ticketNo)}${adjBadge}</strong></td>
        <td>${escapeHtml(ticket.customer)}</td>
        <td>${escapeHtml(ticket.device)}</td>
        <td><span class="badge ${statusBadgeClass}">${statusLabel}</span></td>
        <td>${fmt(ticket.total)} ج.م</td>
        <td style="color:var(--success);">${fmt(ticket.paid)} ج.م</td>
        <td style="color:${ticket.remaining > 0 ? 'var(--warning)' : 'var(--success)'};">${fmt(ticket.remaining)} ج.م</td>
        <td>${escapeHtml(ticket.payment_method)}</td>
        <td>${isLocked}</td>
        <td>${formatDate(ticket.created_at)}</td>
        <td>
          <button class="btn btn-sm btn-primary" onclick="viewRepairTicket(${ticket.id})" style="padding:4px 8px; font-size:11px;">
            <span>👁️</span>
            <span>عرض</span>
          </button>
        </td>
      </tr>
    `;
  }).join('');
}

// تذاكر حسب الفني - تجميع وإظهار عدد التذاكر وإجمالي الإيراد لكل فني
function renderRepairsByTechnician(tickets) {
  const container = document.getElementById('repairsByTechnicianBody');
  if (!container) return;

  if (!tickets || tickets.length === 0) {
    container.innerHTML = '<tr><td colspan="3" class="empty-state"><div class="empty-state-icon">👤</div><div>لا توجد تذاكر في الفترة المحددة</div></td></tr>';
    return;
  }

  const byTech = {};
  tickets.forEach(t => {
    const name = (t.assigned_tech_name || '').trim() || '— بدون فني —';
    if (!byTech[name]) {
      byTech[name] = { count: 0, revenue: 0 };
    }
    byTech[name].count += 1;
    byTech[name].revenue += parseFloat(t.total || t.total_cost || 0) || 0;
  });

  const rows = Object.entries(byTech)
    .sort((a, b) => b[1].count - a[1].count)
    .map(([name, data]) => `
      <tr>
        <td>${escapeHtml(name)}</td>
        <td><strong>${data.count}</strong></td>
        <td>${fmt(data.revenue)} ج.م</td>
      </tr>
    `)
    .join('');

  container.innerHTML = rows;
}

// View repair ticket (opens repairs page if available)
function viewRepairTicket(ticketId) {
  try {
    // Try to navigate to repairs page
    if (window.location && window.location.pathname) {
      const basePath = window.location.pathname.replace(/\/reports\.html$/, '');
      window.location.href = `${basePath}/repairs.html#ticket-${ticketId}`;
    } else {
      showToast('غير متاح من التقارير حالياً', 'info');
    }
  } catch (error) {
    Logger.error('[REPORTS] Error opening repair ticket:', error);
    showToast('غير متاح من التقارير حالياً', 'info');
  }
}

// Export repairs report
function exportRepairsReport() {
  try {
    const tickets = reportsData.repairs || [];
    if (tickets.length === 0) {
      showToast('لا توجد بيانات للتصدير', 'warning');
      return;
    }
    
    // Create CSV content
    const headers = ['رقم التذكرة', 'العميل', 'الجهاز', 'الحالة', 'الإجمالي', 'المدفوع', 'المتبقي', 'تاريخ الإنشاء'];
    const rows = tickets.map(t => [
      t.ticket_no || `#${t.id}`,
      t.customer || '-',
      t.device || '-',
      getRepairStatusLabel(t.status),
      t.total || 0,
      t.paid || 0,
      t.remaining || 0,
      formatDate(t.created_at)
    ]);
    
    const csv = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `repairs_report_${new Date().toISOString().split('T')[0]}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    showToast('تم تصدير التقرير بنجاح', 'success');
  } catch (error) {
    Logger.error('[REPORTS] Error exporting repairs report:', error);
    showToast('خطأ في تصدير التقرير', 'error');
  }
}

// ═══════════════════════════════════════════════════════════════
// 🛠️ UTILITY FUNCTIONS
// ═══════════════════════════════════════════════════════════════
function formatDate(dateStr) {
  if (!dateStr) return '-';
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return '-';
  return d.toLocaleDateString('ar-EG');
}

function formatShortDate(dateStr) {
  if (!dateStr) return '-';
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return '-';
  return `${d.getDate()}/${d.getMonth() + 1}`;
}

function getLast7Days() {
  const days = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    days.push(d.toISOString().split('T')[0]);
  }
  return days;
}

function getStatusLabel(status) {
  const labels = { in_stock: 'متاح', sold: 'مباع', maintenance: 'صيانة', reserved: 'محجوز' };
  return labels[status] || status;
}

function getStatusBadge(status) {
  const badges = { in_stock: 'badge-success', sold: 'badge-info', maintenance: 'badge-warning', reserved: 'badge-purple' };
  return badges[status] || 'badge-info';
}

function getChartOptions() {
  const gridColor = getComputedStyle(document.documentElement).getPropertyValue('--chart-grid').trim() || 'rgba(0, 0, 0, 0.1)';
  const textColor = getComputedStyle(document.documentElement).getPropertyValue('--chart-text').trim() || '#6c757d';
  return {
    responsive: true,
    maintainAspectRatio: false,
    plugins: { legend: { labels: { color: textColor } } },
    scales: {
      y: { ticks: { color: textColor }, grid: { color: gridColor } },
      x: { ticks: { color: textColor }, grid: { display: false } }
    }
  };
}

function getBarChartOptions() {
  const gridColor = getComputedStyle(document.documentElement).getPropertyValue('--chart-grid').trim() || 'rgba(0, 0, 0, 0.1)';
  const textColor = getComputedStyle(document.documentElement).getPropertyValue('--chart-text').trim() || '#6c757d';
  return {
    responsive: true,
    maintainAspectRatio: false,
    plugins: { legend: { labels: { color: textColor } } },
    scales: {
      y: { beginAtZero: true, ticks: { color: textColor }, grid: { color: gridColor } },
      x: { ticks: { color: textColor }, grid: { display: false } }
    }
  };
}

function showToast(message, type = 'success') {
  document.querySelectorAll('.toast').forEach(t => t.remove());
  
  const toast = document.createElement('div');
  toast.style.cssText = `
    position: fixed; top: 80px; left: 50%; transform: translateX(-50%);
    background: ${type === 'success' ? '#10b981' : type === 'error' ? '#ef4444' : type === 'warning' ? '#f59e0b' : '#3b82f6'};
    color: white; padding: 12px 24px; border-radius: 10px; font-weight: 600;
    z-index: 10000; animation: fadeIn 0.3s ease;
  `;
  toast.textContent = message;
  document.body.appendChild(toast);
  
  setTimeout(() => {
    toast.style.animation = 'fadeIn 0.3s reverse';
    setTimeout(() => toast.remove(), 300);
  }, 3000);
}

// ═══════════════════════════════════════════════════════════════
// 💎 CAPITAL REPORT - تقرير رأس المال
// ═══════════════════════════════════════════════════════════════
async function loadCapitalReport() {
  Logger.log('[REPORTS] Loading capital report...');

  try {
    // 1. تحميل بيانات الأجهزة في المخزون
    const devices = (reportsData.devices || []).filter(d => d.status === 'in_stock');
    const devicesCount = devices.length;
    const devicesCost = devices.reduce((sum, d) => sum + (parseFloat(d.purchase_cost) || 0), 0);

    // 2. تحميل بيانات الإكسسوارات
    const accessories = reportsData.accessories || [];
    const accessoriesCount = accessories.reduce((sum, a) => sum + (parseInt(a.quantity) || 0), 0);
    const accessoriesCost = accessories.reduce((sum, a) => {
      const qty = parseInt(a.quantity) || 0;
      const cost = parseFloat(a.purchase_price) || parseFloat(a.cost_price) || 0;
      return sum + (qty * cost);
    }, 0);

    // 2.5 تحميل بيانات مخزن قطع الغيار (Repair Parts)
    let repairPartsCount = 0;
    let repairPartsCost = 0;
    try {
      const rpRes = await fetch('elos-db://repair-parts?all=true');
      if (rpRes.ok) {
        const rpData = await rpRes.json();
        const repairParts = Array.isArray(rpData) ? rpData : (rpData.parts || []);
        // حساب عدد الأصناف والتكلفة (الكمية × سعر التكلفة)
        repairParts.forEach(p => {
          const qty = parseInt(p.qty) || parseInt(p.quantity) || 0;
          const cost = parseFloat(p.unit_cost) || parseFloat(p.cost_price) || parseFloat(p.purchase_price) || 0;
          repairPartsCount += qty;
          repairPartsCost += qty * cost;
        });
        Logger.log('[CAPITAL] Repair parts count:', repairPartsCount, 'Cost:', repairPartsCost);
      }
    } catch (e) {
      Logger.warn('[CAPITAL] Could not fetch repair parts:', e);
    }

    // 2.6 تحميل بيانات المخازن التخزينية (Storage Warehouses)
    let storageWarehousesCount = 0;
    let storageWarehousesValue = 0;
    try {
      const warehousesRes = await fetch('elos-db://warehouses');
      if (warehousesRes.ok) {
        const warehousesData = await warehousesRes.json();
        const warehouses = warehousesData.warehouses || [];
        // فقط مخازن التخزين
        const storageWarehouses = warehouses.filter(w => w.is_storage_only || w.type === 'storage');
        storageWarehousesCount = storageWarehouses.length;
        storageWarehousesValue = storageWarehouses.reduce((sum, w) => sum + (parseFloat(w.total_value) || 0), 0);
        Logger.log('[CAPITAL] Storage warehouses:', storageWarehousesCount, 'Value:', storageWarehousesValue);
      }
    } catch (e) {
      Logger.warn('[CAPITAL] Could not fetch storage warehouses:', e);
    }

    // 3. جلب رصيد درج الكاش
    let cashDrawerBalance = 0;
    try {
      const cashRes = await fetch('elos-db://cash-balance');
      if (cashRes.ok) {
        const cashData = await cashRes.json();
        cashDrawerBalance = parseFloat(cashData.balance) || 0;
      }
    } catch (e) {
      Logger.warn('[CAPITAL] Could not fetch cash drawer balance:', e);
    }

    // 4. جلب رصيد الخزنة بالمحافظ (الأرقام المجمعة حسب النوع)
    let safeBalance = 0;
    let walletCash = 0;
    let walletMobile = 0;
    let walletBank = 0;
    try {
      const safeRes = await fetch('elos-db://safe-balance');
      if (safeRes.ok) {
        const safeData = await safeRes.json();
        safeBalance = parseFloat(safeData.balance) || 0;
        
        // ✅ دعم النظام الجديد: wallets array - جمع الأرصدة حسب النوع
        if (safeData.wallets && Array.isArray(safeData.wallets)) {
          // النظام الجديد: wallets as array - جمع الأرصدة حسب النوع
          safeData.wallets.forEach(w => {
            const balance = Number(w.balance || 0);
            if (w.type === 'cash') walletCash += balance;
            else if (w.type === 'mobile_wallet') walletMobile += balance;
            else if (w.type === 'bank') walletBank += balance;
          });
        } 
        // ✅ دعم النظام القديم: wallets object (مجمعة حسب النوع)
        else if (safeData.wallets && typeof safeData.wallets === 'object') {
          walletCash = parseFloat(safeData.wallets.cash?.balance) || 0;
          walletMobile = parseFloat(safeData.wallets.mobile_wallet?.balance) || 0;
          walletBank = parseFloat(safeData.wallets.bank?.balance) || 0;
        }
      }
    } catch (e) {
      Logger.warn('[CAPITAL] Could not fetch safe balance:', e);
    }

    const totalCash = cashDrawerBalance + safeBalance;

    // 5. جلب الذمم المدينة (الفلوس اللي لينا عند العملاء)
    let receivables = 0;
    let debtors = [];
    try {
      const clientsRes = await fetch('elos-db://clients');
      if (clientsRes.ok) {
        const clientsData = await clientsRes.json();
        const clients = Array.isArray(clientsData) ? clientsData : (clientsData.clients || []);
        debtors = clients.filter(c => (parseFloat(c.balance) || 0) > 0);
        receivables = debtors.reduce((sum, c) => sum + (parseFloat(c.balance) || 0), 0);
      }
    } catch (e) {
      Logger.warn('[CAPITAL] Could not fetch clients receivables:', e);
    }

    // 6. جلب الذمم الدائنة (الفلوس اللي علينا للموردين)
    let payables = 0;
    let creditors = [];
    try {
      const suppliersRes = await fetch('elos-db://suppliers');
      if (suppliersRes.ok) {
        const suppliersData = await suppliersRes.json();
        const suppliers = Array.isArray(suppliersData) ? suppliersData : (suppliersData.suppliers || []);
        // الموردين اللي لهم فلوس عندنا (رصيد موجب = مديونية علينا)
        creditors = suppliers.filter(s => (parseFloat(s.balance) || 0) > 0);
        payables = creditors.reduce((sum, s) => sum + (parseFloat(s.balance) || 0), 0);
      }
    } catch (e) {
      Logger.warn('[CAPITAL] Could not fetch suppliers payables:', e);
    }

    // 7. جلب القروض والسلف المستلمة (ديون علينا)
    // القروض = إيداعات من نوع loan_received - سداد قروض
    let loansReceived = 0;
    let loanPayments = 0;
    let loansCount = 0;
    try {
      const safeTransRes = await fetch('elos-db://safe-transactions');
      if (safeTransRes.ok) {
        const transactions = await safeTransRes.json();

        // القروض المستلمة (إيداعات من نوع loan_received)
        const loanDeposits = transactions.filter(t =>
          t.type === 'deposit' && t.sub_type === 'loan_received'
        );
        loansReceived = loanDeposits.reduce((sum, t) => sum + (parseFloat(t.amount) || 0), 0);
        loansCount = loanDeposits.length;

        // سداد القروض (سحوبات من نوع loan_payment)
        const loanPaymentTx = transactions.filter(t =>
          t.type === 'withdrawal' && t.sub_type === 'loan_payment'
        );
        loanPayments = loanPaymentTx.reduce((sum, t) => sum + (parseFloat(t.amount) || 0), 0);
      }
    } catch (e) {
      Logger.warn('[CAPITAL] Could not fetch loans:', e);
    }

    // صافي القروض (المستلم - المسدد)
    const netLoans = loansReceived - loanPayments;

    // حساب إجمالي الأصول (شامل المخازن التخزينية + قطع الغيار)
    const totalAssets = devicesCost + accessoriesCost + repairPartsCost + storageWarehousesValue + totalCash + receivables;

    // حساب إجمالي الالتزامات (ذمم الموردين + القروض)
    const totalLiabilities = payables + netLoans;

    // حساب رأس المال الصافي (الأصول - الالتزامات)
    const netCapital = totalAssets - totalLiabilities;

    // تحديث الواجهة
    document.getElementById('capitalTotal').textContent = fmt(totalAssets) + ' ج.م';
    document.getElementById('capitalDevicesCount').textContent = devicesCount;
    document.getElementById('capitalDevicesCost').textContent = fmt(devicesCost) + ' ج.م';
    document.getElementById('capitalAccessoriesCount').textContent = accessoriesCount;
    document.getElementById('capitalAccessoriesCost').textContent = fmt(accessoriesCost) + ' ج.م';

    // مخزن قطع الغيار
    const rpCountEl = document.getElementById('capitalRepairPartsCount');
    const rpCostEl = document.getElementById('capitalRepairPartsCost');
    if (rpCountEl) rpCountEl.textContent = repairPartsCount;
    if (rpCostEl) rpCostEl.textContent = fmt(repairPartsCost) + ' ج.م';

    // المخازن التخزينية
    const storageCountEl = document.getElementById('capitalStorageCount');
    const storageValueEl = document.getElementById('capitalStorageValue');
    if (storageCountEl) storageCountEl.textContent = storageWarehousesCount;
    if (storageValueEl) storageValueEl.textContent = fmt(storageWarehousesValue) + ' ج.م';

    document.getElementById('capitalCashDrawer').textContent = fmt(cashDrawerBalance) + ' ج.م';
    
    // ✅ عرض أرصدة المحافظ المجمعة حسب النوع (cash, mobile_wallet, bank)
    // إخفاء container المحافظ الفردية (لا نحتاجه في تقرير رأس المال)
    const walletsContainer = document.getElementById('capitalWalletsContainer');
    if (walletsContainer) walletsContainer.style.display = 'none';
    
    // عرض المحافظ المجمعة حسب النوع
    const walletCashEl = document.getElementById('capitalWalletCash');
    const walletMobileEl = document.getElementById('capitalWalletMobile');
    const walletBankEl = document.getElementById('capitalWalletBank');
    if (walletCashEl) {
      walletCashEl.textContent = fmt(walletCash) + ' ج.م';
      walletCashEl.closest('.summary-row')?.style.setProperty('display', 'flex', 'important');
    }
    if (walletMobileEl) {
      walletMobileEl.textContent = fmt(walletMobile) + ' ج.م';
      walletMobileEl.closest('.summary-row')?.style.setProperty('display', 'flex', 'important');
    }
    if (walletBankEl) {
      walletBankEl.textContent = fmt(walletBank) + ' ج.م';
      walletBankEl.closest('.summary-row')?.style.setProperty('display', 'flex', 'important');
    }
    
    document.getElementById('capitalSafeBalance').textContent = fmt(safeBalance) + ' ج.م';
    document.getElementById('capitalTotalCash').textContent = fmt(totalCash) + ' ج.م';
    document.getElementById('capitalDebtorsCount').textContent = debtors.length;
    document.getElementById('capitalReceivables').textContent = fmt(receivables) + ' ج.م';

    // الذمم الدائنة
    document.getElementById('capitalCreditorsCount').textContent = creditors.length;
    document.getElementById('capitalPayables').textContent = fmt(payables) + ' ج.م';

    // القروض والسلف
    const loansCountEl = document.getElementById('capitalLoansCount');
    const loansTotalEl = document.getElementById('capitalLoansTotal');
    if (loansCountEl) loansCountEl.textContent = loansCount;
    if (loansTotalEl) loansTotalEl.textContent = fmt(netLoans) + ' ج.م';

    // رأس المال الصافي
    const netCapitalEl = document.getElementById('capitalNetTotal');
    if (netCapitalEl) {
      netCapitalEl.textContent = fmt(netCapital) + ' ج.م';
      // تغيير اللون حسب القيمة
      if (netCapital < 0) {
        netCapitalEl.style.color = 'var(--danger)';
      } else {
        netCapitalEl.style.color = 'var(--success)';
      }
    }

    // رسم الـ Charts (شامل المخازن التخزينية + قطع الغيار)
    createCapitalCharts(devicesCost, accessoriesCost, repairPartsCost, storageWarehousesValue, totalCash, receivables, payables, netLoans);

    // عرض جدول الذمم المدينة
    renderDebtorsTable(debtors);

    // عرض جدول الذمم الدائنة
    renderCreditorsTable(creditors);

    Logger.log('[REPORTS] Capital report loaded successfully');

  } catch (error) {
    Logger.error('[REPORTS] Error loading capital report:', error);
    showToast('خطأ في تحميل تقرير رأس المال', 'error');
  }
}

function createCapitalCharts(devicesCost, accessoriesCost, repairPartsCost, storageValue, totalCash, receivables, payables = 0, loans = 0) {
  // Chart توزيع رأس المال (الأصول فقط)
  const distCtx = document.getElementById('capitalDistChart');
  if (distCtx) {
    if (charts.capitalDist) charts.capitalDist.destroy();

    // تضمين المخازن التخزينية + قطع الغيار في الـ Chart
    const labels = ['مخزون الأجهزة', 'مخزون الإكسسوارات', 'قطع الغيار', 'المخازن التخزينية', 'النقدية', 'الذمم المدينة'];
    const data = [devicesCost, accessoriesCost, repairPartsCost, storageValue, totalCash, receivables];
    const colors = ['#3b82f6', '#a855f7', '#f97316', '#ec4899', '#10b981', '#f59e0b'];

    charts.capitalDist = new Chart(distCtx, {
      type: 'doughnut',
      data: {
        labels: labels,
        datasets: [{
          data: data,
          backgroundColor: colors,
          borderWidth: 0
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { position: 'bottom', labels: { color: '#8b93a6', padding: 15 } },
          tooltip: {
            callbacks: {
              label: (ctx) => `${ctx.label}: ${fmt(ctx.raw)} ج.م`
            }
          }
        }
      }
    });
  }

  // Chart مقارنة الأصول والالتزامات
  const trendCtx = document.getElementById('capitalTrendChart');
  if (trendCtx) {
    if (charts.capitalTrend) charts.capitalTrend.destroy();

    const totalAssets = devicesCost + accessoriesCost + repairPartsCost + totalCash + receivables;
    const totalLiabilities = payables + loans;
    const netCapital = totalAssets - totalLiabilities;

    charts.capitalTrend = new Chart(trendCtx, {
      type: 'bar',
      data: {
        labels: ['الأجهزة', 'الإكسسوارات', 'قطع الغيار', 'النقدية', 'الذمم المدينة', 'ذمم الموردين', 'القروض', 'رأس المال الصافي'],
        datasets: [{
          label: 'القيمة (ج.م)',
          data: [devicesCost, accessoriesCost, repairPartsCost, totalCash, receivables, -payables, -loans, netCapital],
          backgroundColor: [
            '#3b82f6', // أجهزة - أزرق
            '#a855f7', // إكسسوارات - بنفسجي
            '#f97316', // قطع غيار - برتقالي
            '#10b981', // نقدية - أخضر
            '#f59e0b', // ذمم مدينة - أصفر
            '#ef4444', // ذمم دائنة - أحمر
            '#dc2626', // قروض - أحمر غامق
            netCapital >= 0 ? '#22c55e' : '#ef4444' // رأس المال الصافي
          ],
          borderRadius: 8
        }]
      },
      options: getBarChartOptions()
    });
  }
}

function renderDebtorsTable(debtors) {
  const container = document.getElementById('debtorsTableBody');
  const countEl = document.getElementById('debtorsTableCount');

  if (countEl) countEl.textContent = `${debtors.length} عميل`;

  if (!debtors.length) {
    container.innerHTML = '<tr><td colspan="5" class="empty-state">لا توجد ذمم مدينة</td></tr>';
    return;
  }

  // ترتيب حسب المبلغ المستحق (الأكبر أولاً)
  debtors.sort((a, b) => (parseFloat(b.balance) || 0) - (parseFloat(a.balance) || 0));

  container.innerHTML = debtors.map((c, i) => `
    <tr>
      <td>${i + 1}</td>
      <td><strong>${escapeHtml(c.name || '-')}</strong></td>
      <td>${escapeHtml(c.phone || '-')}</td>
      <td style="color: var(--success); font-weight: 700;">${fmt(c.balance)} ج.م</td>
      <td>${formatDate(c.last_transaction || c.updated_at)}</td>
    </tr>
  `).join('');
}

function renderCreditorsTable(creditors) {
  const container = document.getElementById('creditorsTableBody');
  const countEl = document.getElementById('creditorsTableCount');

  if (countEl) countEl.textContent = `${creditors.length} مورد`;

  if (!container) return;

  if (!creditors.length) {
    container.innerHTML = '<tr><td colspan="5" class="empty-state">لا توجد ذمم دائنة</td></tr>';
    return;
  }

  // ترتيب حسب المبلغ المستحق (الأكبر أولاً)
  creditors.sort((a, b) => (parseFloat(b.balance) || 0) - (parseFloat(a.balance) || 0));

  container.innerHTML = creditors.map((s, i) => `
    <tr>
      <td>${i + 1}</td>
      <td><strong>${escapeHtml(s.name || '-')}</strong></td>
      <td>${escapeHtml(s.phone || '-')}</td>
      <td style="color: var(--danger); font-weight: 700;">${fmt(s.balance)} ج.م</td>
      <td>${formatDate(s.last_transaction || s.updated_at)}</td>
    </tr>
  `).join('');
}

function exportCapitalReport() {
  const devices = (reportsData.devices || []).filter(d => d.status === 'in_stock');
  const accessories = reportsData.accessories || [];

  const totalCash = parseFloat(document.getElementById('capitalTotalCash')?.textContent?.replace(/[^\d.-]/g, '') || 0);
  const receivables = parseFloat(document.getElementById('capitalReceivables')?.textContent?.replace(/[^\d.-]/g, '') || 0);
  const payables = parseFloat(document.getElementById('capitalPayables')?.textContent?.replace(/[^\d.-]/g, '') || 0);
  const devicesCost = devices.reduce((s, d) => s + (parseFloat(d.purchase_cost) || 0), 0);
  const accessoriesCost = accessories.reduce((s, a) => s + ((parseInt(a.quantity) || 0) * (parseFloat(a.purchase_price) || 0)), 0);
  const repairPartsCostVal = parseFloat(document.getElementById('capitalRepairPartsCost')?.textContent?.replace(/[^\d.-]/g, '') || 0);
  const totalAssets = devicesCost + accessoriesCost + repairPartsCostVal + totalCash + receivables;
  const netCapital = totalAssets - payables;

  const data = [
    { 'البند': '=== الأصول ===', 'العدد': '', 'القيمة': '' },
    { 'البند': 'مخزون الأجهزة', 'العدد': devices.length, 'القيمة': devicesCost },
    { 'البند': 'مخزون الإكسسوارات', 'العدد': accessories.reduce((s, a) => s + (parseInt(a.quantity) || 0), 0), 'القيمة': accessoriesCost },
    { 'البند': 'مخزن قطع الغيار', 'العدد': document.getElementById('capitalRepairPartsCount')?.textContent || 0, 'القيمة': repairPartsCostVal },
    { 'البند': 'النقدية', 'العدد': '-', 'القيمة': totalCash },
    { 'البند': 'الذمم المدينة', 'العدد': '-', 'القيمة': receivables },
    { 'البند': 'إجمالي الأصول', 'العدد': '', 'القيمة': totalAssets },
    { 'البند': '', 'العدد': '', 'القيمة': '' },
    { 'البند': '=== الالتزامات ===', 'العدد': '', 'القيمة': '' },
    { 'البند': 'الذمم الدائنة (للموردين)', 'العدد': '-', 'القيمة': payables },
    { 'البند': '', 'العدد': '', 'القيمة': '' },
    { 'البند': '=== رأس المال الصافي ===', 'العدد': '', 'القيمة': netCapital }
  ];

  exportToCSV(data, 'capital_report.csv');
}

// ═══════════════════════════════════════════════════════════════
// 📊 PROFITS REPORT - تقرير الأرباح والخسائر
// ═══════════════════════════════════════════════════════════════
async function loadProfitsReport() {
  Logger.log('[REPORTS] Loading profits report...');

  try {
    applyReportPeriodFilter('profit');
    const { dateFrom, dateTo } = getReportFilterDates('profit');
    Logger.log('[PROFITS] From:', dateFrom, 'To:', dateTo);

    // تحميل بيانات الفترة (لتجنب الاعتماد على تاب آخر)
    await loadDevicesData();
    await loadAccessorySalesData(dateFrom, dateTo);
    await loadCashflowData(dateFrom, dateTo);
    await loadSalesData(dateFrom, dateTo);
    await loadPurchasesData(dateFrom, dateTo);
    await loadRepairPartsSalesData(dateFrom, dateTo);

    const getDatePart = (str) => (str || '').split('T')[0].split(' ')[0];

    // تصفية الأجهزة المباعة حسب الفترة
    const soldDevices = (reportsData.devices || []).filter(d => {
      if (d.status !== 'sold') return false;
      const saleDate = d.sale_date || d.created_at;
      if (!saleDate) return true; // لو مفيش تاريخ، نضمه
      // استخراج التاريخ فقط (بدون الوقت)
      const date = saleDate.includes('T') ? saleDate.split('T')[0] : saleDate.split(' ')[0];
      const inRange = (!dateFrom || date >= dateFrom) && (!dateTo || date <= dateTo);
      return inRange;
    });

    Logger.log('[PROFITS] Sold devices found:', soldDevices.length, 'devices');
    if (soldDevices.length > 0) {
      Logger.log('[PROFITS] Sample device:', soldDevices[0]);
    }

    // تصفية مبيعات الإكسسوارات حسب الفترة
    const accessorySales = (reportsData.accessorySales || []).filter(s => {
      const saleDate = s.created_at;
      if (!saleDate) return true;
      const date = saleDate.includes('T') ? saleDate.split('T')[0] : saleDate.split(' ')[0];
      return (!dateFrom || date >= dateFrom) && (!dateTo || date <= dateTo);
    });

    Logger.log('[PROFITS] Accessory sales found:', accessorySales.length, 'sales');

    // حساب إيرادات وأرباح الأجهزة
    const deviceRevenue = soldDevices.reduce((sum, d) => sum + (parseFloat(d.sell_price) || 0), 0);
    const deviceCost = soldDevices.reduce((sum, d) => sum + (parseFloat(d.purchase_cost) || 0), 0);
    const deviceProfit = deviceRevenue - deviceCost;

    // حساب إيرادات وأرباح الإكسسوارات
    // ✅ FIX: استخدام total_price (بعد الخصم) بدل unit_price (قبل الخصم)
    const accessoryRevenue = accessorySales.reduce((sum, s) => {
      const qty = Math.abs(parseFloat(s.quantity) || 0);
      const revenue = parseFloat(s.total_price) || (qty * (parseFloat(s.unit_price) || 0) - (parseFloat(s.discount) || 0));
      return sum + revenue;
    }, 0);

    const accessoryCost = accessorySales.reduce((sum, s) => {
      const qty = Math.abs(parseFloat(s.quantity) || 0);
      const cost = parseFloat(s.purchase_price) || 0;
      return sum + (qty * cost);
    }, 0);

    const accessoryProfit = accessoryRevenue - accessoryCost;

    // ✅ مبيعات قطع الغيار من نقطة البيع (إيراد، تكلفة، ربح)
    const repairPartsPosSales = (reportsData.repairPartsPosSales || []).filter(s => {
      const d = getDatePart(s.created_at);
      return (!dateFrom || d >= dateFrom) && (!dateTo || d <= dateTo);
    });
    const repairPartsPosRevenue = repairPartsPosSales.reduce((sum, s) => sum + (parseFloat(s.total_price) || 0), 0);
    const repairPartsPosCost = repairPartsPosSales.reduce((sum, s) => {
      const qty = Math.abs(parseFloat(s.quantity) || 1);
      const cost = parseFloat(s.cost_price) || 0;
      return sum + (qty * cost);
    }, 0);
    const repairPartsPosProfit = repairPartsPosRevenue - repairPartsPosCost;

    // ✅ المرتجعات من المبيعات
    const salesReturns = (reportsData.sales || []).filter(s => s.status === 'returned').reduce((sum, s) => sum + (parseFloat(s.refund_amount) || 0), 0);
    
    // ✅ مرتجعات المشتريات من supplier_transactions
    const purchaseReturns = (reportsData.supplierTransactions || [])
      .filter(t => {
        const txDate = (t.created_at || '').split(' ')[0].split('T')[0];
        const inRange = (!dateFrom || txDate >= dateFrom) && (!dateTo || txDate <= dateTo);
        return inRange && t.type === 'return';
      })
      .reduce((sum, t) => sum + Math.abs(parseFloat(t.amount) || 0), 0);
    
    const returns = salesReturns + purchaseReturns;

    // المصروفات الأخرى (من الخزنة) — مصروفات حقيقية فقط (لا مرتجعات ولا سحب رأس مال ولا عجز كاش)
    const expenseSubTypes = ['salary', 'operating_expense'];
    const notExpenseCategories = [
      'مرتجعات مبيعات', 'مسحوبات درج الكاش', 'سحب لدرج الكاش', 'سحب لمرتجع',
      'عجز كاش', 'تحويل لدرج الكاش', 'فائض سحب للدرج', 'زيادة كاش'
    ];
    const isNotExpenseCategory = (cat) => {
      if (!cat) return false;
      const c = String(cat).trim();
      return notExpenseCategories.includes(c) || c.includes('مرتجع') || c.includes('عجز') || c === 'سحب';
    };

    const expenseTransactions = (reportsData.cashflow || []).filter(t => {
      const txDate = (t.created_at || '').split(' ')[0].split('T')[0];
      if ((dateFrom && txDate < dateFrom) || (dateTo && txDate > dateTo)) return false;
      if (t.type === 'deposit' || t.type === 'sale') return false;
      if (t.sub_type === 'internal_transfer') return false;

      if (t.type === 'expense') {
        if (isNotExpenseCategory(t.category)) return false;
        if (t.description && (t.description.includes('مرتجعات') || t.description.includes('عجز في الكاش'))) return false;
        return true;
      }
      if (t.type === 'withdrawal' && expenseSubTypes.includes(t.sub_type)) return true;
      return false;
    });

    // Debug: طباعة المصروفات المفلترة
    Logger.log('[PROFITS DEBUG] Filtered expense transactions:', expenseTransactions.map(t => ({
      type: t.type,
      sub_type: t.sub_type,
      amount: t.amount,
      affects_profit: t.affects_profit,
      category: t.category,
      description: t.description
    })));

    const expenses = expenseTransactions.reduce((sum, t) => sum + (parseFloat(t.amount) || 0), 0);

    // ✅ الإيرادات الخارجية (إيداعات من نوع revenue تؤثر على الأرباح)
    const externalRevenue = (reportsData.cashflow || []).filter(t => {
      // تصفية حسب الفترة الزمنية
      const txDate = (t.created_at || '').split(' ')[0].split('T')[0];
      const inRange = (!dateFrom || txDate >= dateFrom) && (!dateTo || txDate <= dateTo);
      if (!inRange) return false;

      // الإيداعات التي تؤثر على الأرباح (إيرادات خارجية)
      if (t.type === 'deposit' && t.sub_type === 'revenue') return true;
      if (t.type === 'deposit' && (t.affects_profit === 1 || t.affects_profit === true)) return true;
      return false;
    }).reduce((sum, t) => sum + (parseFloat(t.amount) || 0), 0);
    
    // ✅ إيرادات وأرباح الصيانة (من API مع حساب تكلفة القطع)
    let repairsRevenue = 0;
    let repairsPartsCost = 0;
    let repairsProfit = 0;

    try {
      const repairKpisUrl = `elos-db://repairs/kpis?from=${dateFrom}&to=${dateTo}`;
      const repairKpisRes = await fetch(repairKpisUrl);
      if (repairKpisRes.ok) {
        const repairKpis = await repairKpisRes.json();
        repairsRevenue = parseFloat(repairKpis.revenue) || 0;
        repairsPartsCost = parseFloat(repairKpis.parts_cost) || 0;
        repairsProfit = parseFloat(repairKpis.net_profit) || 0;
      }
    } catch (e) {
      Logger.error('[PROFITS] Error fetching repair KPIs:', e);
    }

    // ✅ عمولات التحويل من نقطة البيع (ربح صافي - بدون تكلفة)
    let transferCommissions = 0;
    try {
      let summaryUrl = 'elos-db://money-transfers-summary';
      if (dateFrom && dateTo) summaryUrl += `?from=${dateFrom}&to=${dateTo}`;
      const summaryRes = await fetch(summaryUrl);
      if (summaryRes.ok) {
        const summary = await summaryRes.json();
        transferCommissions = parseFloat(summary.total_commission) || 0;
      }
    } catch (e) {
      Logger.error('[PROFITS] Error fetching transfer commissions:', e);
    }
    Logger.log('[PROFITS] Transfer commissions:', transferCommissions);

    // ✅ الحسابات النهائية — إجمالي الربح = أرباح الفئات + عمولات التحويل، صافي الربح = إجمالي الربح − المصروفات التشغيلية
    // تكلفة البضاعة المباعة (COGS) والمرتجعات = دورة رأس مال، ليست خسارة
    const totalRevenue = deviceRevenue + accessoryRevenue + repairPartsPosRevenue + externalRevenue + repairsRevenue + transferCommissions;
    const totalCOGS = deviceCost + accessoryCost + repairPartsPosCost + repairsPartsCost;
    const grossProfit = deviceProfit + accessoryProfit + repairPartsPosProfit + repairsProfit + externalRevenue + transferCommissions;
    const operatingExpenses = expenses; // مصروفات تشغيلية حقيقية فقط (رواتب + مصروفات تشغيل)
    const netProfit = grossProfit - operatingExpenses;
    const profitMargin = grossProfit > 0 ? (netProfit / grossProfit * 100) : 0;

    Logger.log('[PROFITS] Period:', dateFrom, '-', dateTo);
    Logger.log('[PROFITS] Device Revenue:', deviceRevenue, '| Cost:', deviceCost, '| Profit:', deviceProfit);
    Logger.log('[PROFITS] Accessory Revenue:', accessoryRevenue, '| Cost:', accessoryCost, '| Profit:', accessoryProfit);
    Logger.log('[PROFITS] Repairs Revenue:', repairsRevenue, '| Parts Cost:', repairsPartsCost, '| Profit:', repairsProfit);
    Logger.log('[PROFITS] Repair parts POS Revenue:', repairPartsPosRevenue, '| Cost:', repairPartsPosCost, '| Profit:', repairPartsPosProfit);
    Logger.log('[PROFITS] External Revenue:', externalRevenue);
    Logger.log('[PROFITS] Transfer Commissions:', transferCommissions);
    Logger.log('[PROFITS] Operating Expenses:', operatingExpenses, '| Sales Returns:', salesReturns, '| Purchase Returns:', purchaseReturns);
    Logger.log('[PROFITS] Gross Profit:', grossProfit, '| Operating Expenses:', operatingExpenses, '| Net Profit:', netProfit);

    // تحديث واجهة المستخدم
    const periodLabels = {
      last_day: 'آخر يوم',
      last_7: 'آخر 7 أيام',
      last_month: 'آخر شهر',
      last_3_months: 'آخر 3 أشهر',
      last_year: 'آخر سنة',
      custom: 'فترة مخصصة'
    };
    const periodFilter = document.getElementById('profitPeriodFilter')?.value || 'last_month';
    const periodLabelEl = document.getElementById('profitsPeriodLabel');
    if (periodLabelEl) periodLabelEl.textContent = periodLabels[periodFilter] || 'الفترة';
    document.getElementById('profitsNetProfit').textContent = fmt(netProfit) + ' ج.م';
    document.getElementById('profitsNetProfit').style.color = netProfit >= 0 ? 'var(--success)' : 'var(--danger)';
    document.getElementById('profitsGrossProfit').textContent = fmt(grossProfit) + ' ج.م';
    document.getElementById('profitsOperatingExpenses').textContent = fmt(operatingExpenses) + ' ج.م';
    document.getElementById('profitsMargin').textContent = profitMargin.toFixed(1) + '%';

    // مؤشر الربح/الخسارة
    const indicator = document.getElementById('profitLossIndicator');
    const text = document.getElementById('profitLossText');
    const amount = document.getElementById('profitLossAmount');

    if (netProfit > 0) {
      indicator.textContent = '📈';
      text.textContent = 'أنت رابح!';
      text.style.color = 'var(--success)';
      amount.textContent = `صافي الربح: ${fmt(netProfit)} ج.م`;
    } else if (netProfit < 0) {
      indicator.textContent = '📉';
      text.textContent = 'أنت خاسر!';
      text.style.color = 'var(--danger)';
      amount.textContent = `صافي الخسارة: ${fmt(Math.abs(netProfit))} ج.م`;
    } else {
      indicator.textContent = '⚖️';
      text.textContent = 'متعادل';
      text.style.color = 'var(--text-secondary)';
      amount.textContent = 'لا ربح ولا خسارة';
    }

    // ✅ تفاصيل الأرباح حسب الفئة
    document.getElementById('profitsDeviceProfit').textContent = fmt(deviceProfit) + ' ج.م';
    document.getElementById('profitsAccessoryProfit').textContent = fmt(accessoryProfit) + ' ج.م';
    const rpProfitEl = document.getElementById('profitsRepairPartsProfit');
    if (rpProfitEl) rpProfitEl.textContent = fmt(repairPartsPosProfit) + ' ج.م';
    const repairsProfitEl = document.getElementById('profitsRepairsProfit');
    if (repairsProfitEl) repairsProfitEl.textContent = fmt(repairsProfit) + ' ج.م';
    const extRevenueEl = document.getElementById('profitsExternalRevenue');
    if (extRevenueEl) extRevenueEl.textContent = fmt(externalRevenue) + ' ج.م';
    const transferCommissionsEl = document.getElementById('profitsTransferCommissions');
    if (transferCommissionsEl) transferCommissionsEl.textContent = fmt(transferCommissions) + ' ج.م';
    document.getElementById('profitsGrossProfitTotal').textContent = fmt(grossProfit) + ' ج.م';

    // ✅ تفاصيل المصروفات التشغيلية
    document.getElementById('profitsExpenses').textContent = fmt(expenses) + ' ج.م';
    document.getElementById('profitsTotalExpenses').textContent = fmt(operatingExpenses) + ' ج.م';

    // ✅ معلومات تفصيلية (للمعلومية فقط - لا تؤثر على صافي الربح)
    const devRevEl = document.getElementById('profitsDeviceRevenue');
    const devCostEl = document.getElementById('profitsDeviceCost');
    const accRevEl = document.getElementById('profitsAccessoryRevenue');
    const accCostEl = document.getElementById('profitsAccessoryCost');
    const rpRevEl = document.getElementById('profitsRepairPartsRevenue');
    const rpCostEl = document.getElementById('profitsRepairPartsCost');
    const repRevEl = document.getElementById('profitsRepairsRevenue');
    const repPartsCostEl = document.getElementById('profitsRepairsPartsCost');
    const returnsEl = document.getElementById('profitsReturns');
    if (devRevEl) devRevEl.textContent = fmt(deviceRevenue) + ' ج.م';
    if (devCostEl) devCostEl.textContent = fmt(deviceCost) + ' ج.م';
    if (accRevEl) accRevEl.textContent = fmt(accessoryRevenue) + ' ج.م';
    if (accCostEl) accCostEl.textContent = fmt(accessoryCost) + ' ج.م';
    if (rpRevEl) rpRevEl.textContent = fmt(repairPartsPosRevenue) + ' ج.م';
    if (rpCostEl) rpCostEl.textContent = fmt(repairPartsPosCost) + ' ج.م';
    if (repRevEl) repRevEl.textContent = fmt(repairsRevenue) + ' ج.م';
    if (repPartsCostEl) repPartsCostEl.textContent = fmt(repairsPartsCost) + ' ج.م';
    if (returnsEl) returnsEl.textContent = fmt(returns) + ' ج.م';

    // رسم الـ Charts (شامل قطع الغيار)
    createProfitsCharts(soldDevices, accessorySales, repairPartsPosSales, deviceProfit, accessoryProfit, repairPartsPosProfit, repairsProfit, dateFrom, dateTo);

    // عرض جدول المعاملات المربحة (شامل قطع الغيار + إجمالي الصيانة)
    renderProfitTransactions(soldDevices, accessorySales, repairPartsPosSales, {
      revenue: repairsRevenue,
      cost: repairsPartsCost,
      profit: repairsProfit
    });

    // عرض ملخص شهري (بالبيانات المفلترة للفترة)
    renderMonthlyProfitSummary(soldDevices, accessorySales, repairPartsPosSales);

    Logger.log('[REPORTS] Profits report loaded successfully');

  } catch (error) {
    Logger.error('[REPORTS] Error loading profits report:', error);
    showToast('خطأ في تحميل تقرير الأرباح', 'error');
  }
}

function createProfitsCharts(soldDevices, accessorySales, repairPartsPosSales, deviceProfit, accessoryProfit, repairPartsPosProfit, repairsProfit, dateFrom, dateTo) {
  repairPartsPosSales = repairPartsPosSales || [];
  const getDay = (str) => (str || '').split('T')[0].split(' ')[0];

  const dailyCtx = document.getElementById('dailyProfitChart');
  if (dailyCtx) {
    if (charts.dailyProfit) charts.dailyProfit.destroy();
    const dailyProfits = {};

    soldDevices.forEach(d => {
      const date = getDay(d.sale_date || d.created_at);
      if (!date) return;
      if (!dailyProfits[date]) dailyProfits[date] = 0;
      dailyProfits[date] += (parseFloat(d.sell_price) || 0) - (parseFloat(d.discount) || 0) - (parseFloat(d.purchase_cost) || 0);
    });
    accessorySales.forEach(s => {
      const date = getDay(s.created_at);
      if (!date) return;
      if (!dailyProfits[date]) dailyProfits[date] = 0;
      const qty = Math.abs(parseFloat(s.quantity) || 0);
      // ✅ FIX: استخدام total_price (بعد الخصم) بدل unit_price
      const revenue = parseFloat(s.total_price) || (qty * (parseFloat(s.unit_price) || 0) - (parseFloat(s.discount) || 0));
      dailyProfits[date] += revenue - (qty * (parseFloat(s.purchase_price) || 0));
    });
    repairPartsPosSales.forEach(s => {
      const date = getDay(s.created_at);
      if (!date) return;
      if (!dailyProfits[date]) dailyProfits[date] = 0;
      const rev = parseFloat(s.total_price) || 0;
      const qty = Math.abs(parseFloat(s.quantity) || 1);
      const cost = (parseFloat(s.cost_price) || 0) * qty;
      dailyProfits[date] += rev - cost;
    });

    const sortedDates = Object.keys(dailyProfits).sort();
    const last14Days = sortedDates.slice(-14);

    charts.dailyProfit = new Chart(dailyCtx, {
      type: 'line',
      data: {
        labels: last14Days.map(d => formatShortDate(d)),
        datasets: [{
          label: 'الربح اليومي',
          data: last14Days.map(d => dailyProfits[d] || 0),
          borderColor: '#10b981',
          backgroundColor: 'rgba(16, 185, 129, 0.1)',
          tension: 0.4,
          fill: true
        }]
      },
      options: getChartOptions()
    });
  }

  const sourcesCtx = document.getElementById('profitSourcesChart');
  if (sourcesCtx) {
    if (charts.profitSources) charts.profitSources.destroy();
    const labels = ['أرباح الأجهزة', 'أرباح الإكسسوارات', 'أرباح قطع الغيار (POS)', 'أرباح الصيانة'];
    const data = [
      Math.max(0, deviceProfit),
      Math.max(0, accessoryProfit),
      Math.max(0, repairPartsPosProfit),
      Math.max(0, repairsProfit || 0)
    ];
    const colors = ['#3b82f6', '#a855f7', '#f59e0b', '#10b981'];
    const hasRepairParts = repairPartsPosProfit > 0;
    const hasRepairs = (repairsProfit || 0) > 0;
    const finalLabels = [labels[0], labels[1]].concat(hasRepairParts ? [labels[2]] : []).concat(hasRepairs ? [labels[3]] : []);
    const finalData = [data[0], data[1]].concat(hasRepairParts ? [data[2]] : []).concat(hasRepairs ? [data[3]] : []);
    const finalColors = [colors[0], colors[1]].concat(hasRepairParts ? [colors[2]] : []).concat(hasRepairs ? [colors[3]] : []);

    charts.profitSources = new Chart(sourcesCtx, {
      type: 'doughnut',
      data: {
        labels: finalLabels,
        datasets: [{ data: finalData, backgroundColor: finalColors, borderWidth: 0 }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { position: 'bottom', labels: { color: '#8b93a6', padding: 15 } },
          tooltip: { callbacks: { label: (ctx) => `${ctx.label}: ${fmt(ctx.raw)} ج.م` } }
        }
      }
    });
  }
}

function renderProfitTransactions(soldDevices, accessorySales, repairPartsPosSales, repairsSummary) {
  const container = document.getElementById('profitTransactionsBody');
  const countEl = document.getElementById('profitTransactionsCount');
  repairPartsPosSales = repairPartsPosSales || [];
  repairsSummary = repairsSummary || {};
  const transactions = [];

  soldDevices.forEach(d => {
    const discount = parseFloat(d.discount) || 0;
    const profit = (parseFloat(d.sell_price) || 0) - discount - (parseFloat(d.purchase_cost) || 0);
    transactions.push({
      date: d.sale_date || d.created_at,
      type: 'جهاز',
      product: `${d.type || ''} ${d.model || ''}`.trim() || 'جهاز',
      quantity: 1,
      sellPrice: (parseFloat(d.sell_price) || 0) - discount,
      cost: parseFloat(d.purchase_cost) || 0,
      profit: profit
    });
  });
  // ✅ FIX: استخدام total_price (بعد الخصم) بدل unit_price
  accessorySales.forEach(s => {
    const qty = Math.abs(parseFloat(s.quantity) || 0);
    const revenue = parseFloat(s.total_price) || (qty * (parseFloat(s.unit_price) || 0) - (parseFloat(s.discount) || 0));
    const cost = qty * (parseFloat(s.purchase_price) || 0);
    transactions.push({
      date: s.created_at,
      type: 'إكسسوار',
      product: s.accessory_name || 'إكسسوار',
      quantity: qty,
      sellPrice: revenue,
      cost: cost,
      profit: revenue - cost
    });
  });
  repairPartsPosSales.forEach(s => {
    const qty = Math.abs(parseFloat(s.quantity) || 1);
    const sellPrice = parseFloat(s.total_price) || 0;
    const cost = (parseFloat(s.cost_price) || 0) * qty;
    transactions.push({
      date: s.created_at,
      type: 'قطع غيار',
      product: s.part_name || s.part_category || 'قطع غيار',
      quantity: qty,
      sellPrice: sellPrice,
      cost: cost,
      profit: sellPrice - cost
    });
  });

  // إجمالي الصيانة (تذاكر مُسلّمة في الفترة) — يظهر كصف واحد لتفادي التشتت وليطابق ملخص الإيرادات
  const rev = parseFloat(repairsSummary.revenue) || 0;
  const costRep = parseFloat(repairsSummary.cost) || 0;
  const profitRep = parseFloat(repairsSummary.profit) || 0;
  if (rev > 0 || profitRep !== 0) {
    transactions.push({
      date: null,
      type: 'صيانة',
      product: 'إيرادات الصيانة (إجمالي الفترة)',
      quantity: 1,
      sellPrice: rev,
      cost: costRep,
      profit: profitRep
    });
  }

  transactions.sort((a, b) => {
    if (!a.date) return 1;
    if (!b.date) return -1;
    return new Date(b.date) - new Date(a.date);
  });

  if (countEl) countEl.textContent = `${transactions.length} معاملة`;

  if (!transactions.length) {
    container.innerHTML = '<tr><td colspan="8" class="empty-state">لا توجد معاملات في هذه الفترة</td></tr>';
    return;
  }

  const badgeClass = (t) => {
    if (t.type === 'جهاز') return 'badge-info';
    if (t.type === 'إكسسوار') return 'badge-purple';
    if (t.type === 'قطع غيار') return 'badge-warning';
    if (t.type === 'صيانة') return 'badge-success';
    return 'badge-secondary';
  };
  container.innerHTML = transactions.slice(0, 100).map((t, i) => `
    <tr>
      <td>${i + 1}</td>
      <td>${t.date ? formatDate(t.date) : '—'}</td>
      <td><span class="badge ${badgeClass(t)}">${t.type}</span></td>
      <td>${escapeHtml(t.product)}</td>
      <td>${t.quantity}</td>
      <td>${fmt(t.sellPrice)} ج.م</td>
      <td>${fmt(t.cost)} ج.م</td>
      <td style="color: ${t.profit >= 0 ? 'var(--success)' : 'var(--danger)'}; font-weight: 700;">
        ${t.profit >= 0 ? '+' : ''}${fmt(t.profit)} ج.م
      </td>
    </tr>
  `).join('');
}

function renderMonthlyProfitSummary(soldDevices, accessorySales, repairPartsPosSales) {
  const container = document.getElementById('monthlyProfitBody');
  soldDevices = soldDevices || [];
  accessorySales = accessorySales || [];
  repairPartsPosSales = repairPartsPosSales || [];
  const monthlyData = {};
  const monthKeyOf = (str) => (str || '').substring(0, 7);

  soldDevices.forEach(d => {
    const monthKey = monthKeyOf(d.sale_date || d.created_at);
    if (!monthKey) return;
    if (!monthlyData[monthKey]) monthlyData[monthKey] = { revenue: 0, cost: 0, profit: 0 };
    const revenue = parseFloat(d.sell_price) || 0;
    const cost = parseFloat(d.purchase_cost) || 0;
    monthlyData[monthKey].revenue += revenue;
    monthlyData[monthKey].cost += cost;
    monthlyData[monthKey].profit += revenue - cost;
  });
  // ✅ FIX: استخدام total_price (بعد الخصم) بدل unit_price
  accessorySales.forEach(s => {
    const monthKey = monthKeyOf(s.created_at);
    if (!monthKey) return;
    if (!monthlyData[monthKey]) monthlyData[monthKey] = { revenue: 0, cost: 0, profit: 0 };
    const qty = Math.abs(parseFloat(s.quantity) || 0);
    const revenue = parseFloat(s.total_price) || (qty * (parseFloat(s.unit_price) || 0) - (parseFloat(s.discount) || 0));
    const cost = qty * (parseFloat(s.purchase_price) || 0);
    monthlyData[monthKey].revenue += revenue;
    monthlyData[monthKey].cost += cost;
    monthlyData[monthKey].profit += revenue - cost;
  });
  repairPartsPosSales.forEach(s => {
    const monthKey = monthKeyOf(s.created_at);
    if (!monthKey) return;
    if (!monthlyData[monthKey]) monthlyData[monthKey] = { revenue: 0, cost: 0, profit: 0 };
    const revenue = parseFloat(s.total_price) || 0;
    const qty = Math.abs(parseFloat(s.quantity) || 1);
    const cost = (parseFloat(s.cost_price) || 0) * qty;
    monthlyData[monthKey].revenue += revenue;
    monthlyData[monthKey].cost += cost;
    monthlyData[monthKey].profit += revenue - cost;
  });

  const months = Object.keys(monthlyData).sort().reverse();

  if (!months.length) {
    container.innerHTML = '<tr><td colspan="6" class="empty-state">لا توجد بيانات شهرية</td></tr>';
    return;
  }

  const monthNames = ['يناير', 'فبراير', 'مارس', 'أبريل', 'مايو', 'يونيو', 'يوليو', 'أغسطس', 'سبتمبر', 'أكتوبر', 'نوفمبر', 'ديسمبر'];

  container.innerHTML = months.slice(0, 12).map(monthKey => {
    const [year, month] = monthKey.split('-');
    const data = monthlyData[monthKey];
    const margin = data.revenue > 0 ? (data.profit / data.revenue * 100) : 0;
    const isProfit = data.profit >= 0;

    return `
      <tr>
        <td><strong>${monthNames[parseInt(month) - 1]} ${year}</strong></td>
        <td>${fmt(data.revenue)} ج.م</td>
        <td>${fmt(data.cost)} ج.م</td>
        <td style="color: ${isProfit ? 'var(--success)' : 'var(--danger)'}; font-weight: 700;">
          ${isProfit ? '+' : ''}${fmt(data.profit)} ج.م
        </td>
        <td>${margin.toFixed(1)}%</td>
        <td>
          <span class="badge ${isProfit ? 'badge-success' : 'badge-danger'}">
            ${isProfit ? '📈 رابح' : '📉 خاسر'}
          </span>
        </td>
      </tr>
    `;
  }).join('');
}

function exportProfitsReport() {
  const soldDevices = (reportsData.devices || []).filter(d => d.status === 'sold');
  const accessorySales = reportsData.accessorySales || [];
  const repairPartsPosSales = reportsData.repairPartsPosSales || [];
  const data = [];

  soldDevices.forEach(d => {
    data.push({
      'التاريخ': d.sale_date || d.created_at,
      'النوع': 'جهاز',
      'المنتج': `${d.type || ''} ${d.model || ''}`.trim(),
      'الكمية': 1,
      'سعر البيع': (parseFloat(d.sell_price) || 0) - (parseFloat(d.discount) || 0),
      'التكلفة': parseFloat(d.purchase_cost) || 0,
      'الربح': (parseFloat(d.sell_price) || 0) - (parseFloat(d.discount) || 0) - (parseFloat(d.purchase_cost) || 0)
    });
  });
  // ✅ FIX: استخدام total_price (بعد الخصم) بدل unit_price
  accessorySales.forEach(s => {
    const qty = Math.abs(parseFloat(s.quantity) || 0);
    const revenue = parseFloat(s.total_price) || (qty * (parseFloat(s.unit_price) || 0) - (parseFloat(s.discount) || 0));
    const cost = qty * (parseFloat(s.purchase_price) || 0);
    data.push({
      'التاريخ': s.created_at,
      'النوع': 'إكسسوار',
      'المنتج': s.accessory_name || 'إكسسوار',
      'الكمية': qty,
      'سعر البيع': revenue,
      'التكلفة': cost,
      'الربح': revenue - cost
    });
  });
  repairPartsPosSales.forEach(s => {
    const qty = Math.abs(parseFloat(s.quantity) || 1);
    const revenue = parseFloat(s.total_price) || 0;
    const cost = (parseFloat(s.cost_price) || 0) * qty;
    data.push({
      'التاريخ': s.created_at,
      'النوع': 'قطع غيار',
      'المنتج': s.part_name || s.part_category || 'قطع غيار',
      'الكمية': qty,
      'سعر البيع': revenue,
      'التكلفة': cost,
      'الربح': revenue - cost
    });
  });

  exportToCSV(data, 'profits_report.csv');
}

// ═══════════════════════════════════════════════════════════════
// 🧾 EXPENSES REPORT - تقرير المصروفات
// ═══════════════════════════════════════════════════════════════
let expensesCategoryChart = null;
let expensesTrendChart = null;

async function loadExpensesReport() {
  try {
    applyReportPeriodFilter('expense');
    const { dateFrom, dateTo } = getReportFilterDates('expense');

    // Fetch expenses from safe_transactions
    const response = await fetch('elos-db://safe-transactions');
    const allTransactions = response.ok ? await response.json() : [];

    // فلتر المصروفات الحقيقية فقط (لا مرتجعات ولا سحب من رأس المال ولا عجز كاش)
    // ⚠️ المرتجعات = استرداد فلوس للعميل، ليست مصروفاً
    // ⚠️ السحب العادي = حركة من الخزنة لرأس المال، ليست مصروفاً
    // ⚠️ عجز كاش = تسوية نقص في العد، ليست مصروف تشغيل
    const expenseSubTypes = ['salary', 'operating_expense'];
    const notExpenseCategories = [
      'مرتجعات مبيعات',
      'مسحوبات درج الكاش',
      'سحب لدرج الكاش',
      'سحب لمرتجع',
      'عجز كاش',
      'تحويل لدرج الكاش',
      'فائض سحب للدرج',
      'زيادة كاش'
    ];
    const isNotExpenseCategory = (cat) => {
      if (!cat) return false;
      const c = String(cat).trim();
      return notExpenseCategories.includes(c) ||
        c.includes('مرتجع') ||
        c.includes('عجز') ||
        c === 'سحب';
    };

    const expenses = allTransactions.filter(t => {
      const txDate = (t.created_at || '').split(' ')[0].split('T')[0];
      if (txDate < dateFrom || txDate > dateTo) return false;

      if (t.type === 'deposit' || t.type === 'sale') return false;
      if (t.sub_type === 'internal_transfer') return false;
      if (t.type === 'transfer') return false;
      if (t.description && t.description.includes('تحويل')) return false;

      // ❌ استبعاد أي نوع مصروف مسجل كـ expense لكنه مرتجع أو عجز أو سحب
      if (t.type === 'expense') {
        if (isNotExpenseCategory(t.category)) return false;
        if (t.description && (t.description.includes('مرتجعات') || t.description.includes('عجز في الكاش'))) return false;
        return true;
      }

      // ✅ سحب = مصروف فقط إذا كان راتب أو مصروف تشغيل (لا نعتبر السحب العادي من رأس المال مصروفاً)
      if (t.type === 'withdrawal') {
        if (expenseSubTypes.includes(t.sub_type)) return true;
        return false;
      }

      return false;
    });

    Logger.log('[EXPENSES] Found expenses:', expenses.length, expenses);

    // Apply category filter - use sub_type or category
    const categoryFilter = document.getElementById('expenseCategoryFilter')?.value;
    const filteredExpenses = categoryFilter
      ? expenses.filter(e => (e.category === categoryFilter) || (e.sub_type === categoryFilter))
      : expenses;

    // Populate category filter options
    populateExpenseCategoryFilter(expenses);

    // Calculate stats
    const totalAmount = filteredExpenses.reduce((sum, e) => sum + (parseFloat(e.amount) || 0), 0);
    const count = filteredExpenses.length;
    const average = count > 0 ? totalAmount / count : 0;

    // Group by category (use sub_type labels where applicable)
    const subTypeLabels = {
      salary: 'رواتب',
      operating_expense: 'مصروفات تشغيلية'
    };
    const categoryTotals = {};
    filteredExpenses.forEach(e => {
      // Prefer sub_type label, then category, then default
      let cat;
      if (e.sub_type && subTypeLabels[e.sub_type]) {
        cat = subTypeLabels[e.sub_type];
      } else {
        cat = e.category || 'أخرى';
      }
      categoryTotals[cat] = (categoryTotals[cat] || 0) + (parseFloat(e.amount) || 0);
    });

    // Find top category
    let topCategory = '-';
    let topCategoryAmount = 0;
    Object.entries(categoryTotals).forEach(([cat, amount]) => {
      if (amount > topCategoryAmount) {
        topCategory = cat;
        topCategoryAmount = amount;
      }
    });

    // Update stats
    document.getElementById('expensesTotalAmount').textContent = fmt(totalAmount) + ' ج.م';
    document.getElementById('expensesCount').textContent = count;
    document.getElementById('expensesAverage').textContent = fmt(average) + ' ج.م';
    document.getElementById('expensesTopCategory').textContent = topCategory;
    document.getElementById('expensesTopCategoryAmount').textContent = fmt(topCategoryAmount) + ' ج.م';
    document.getElementById('expensesTableCount').textContent = count + ' مصروف';

    // Render category breakdown
    renderExpensesCategoryBreakdown(categoryTotals, totalAmount);

    // Render charts
    renderExpensesCategoryChart(categoryTotals);
    renderExpensesTrendChart(filteredExpenses, dateFrom, dateTo);

    // Render table
    renderExpensesTable(filteredExpenses);

    // الملخص الشهري بنفس منطق استبعاد المرتجعات والسحب والعجز
    const allExpenses = allTransactions.filter(t => {
      const txDate = (t.created_at || '').split(' ')[0].split('T')[0];
      if (txDate < dateFrom || txDate > dateTo) return false;
      if (t.type === 'deposit' || t.type === 'sale') return false;
      if (t.sub_type === 'internal_transfer') return false;
      if (t.type === 'transfer') return false;
      if (t.description && t.description.includes('تحويل')) return false;
      if (t.type === 'expense') {
        if (isNotExpenseCategory(t.category)) return false;
        if (t.description && (t.description.includes('مرتجعات') || t.description.includes('عجز في الكاش'))) return false;
        return true;
      }
      if (t.type === 'withdrawal' && expenseSubTypes.includes(t.sub_type)) return true;
      return false;
    });
    renderExpensesMonthlyTable(allExpenses);

  } catch (error) {
    Logger.error('Error loading expenses report:', error);
    showToast('خطأ في تحميل تقرير المصروفات', 'error');
  }
}

function getExpenseDateRange() {
  const period = document.getElementById('expensePeriodFilter')?.value || 'month';
  const today = new Date();
  let from, to, label;

  switch (period) {
    case 'today':
      from = to = today.toISOString().split('T')[0];
      label = 'اليوم';
      break;
    case 'week':
      const weekStart = new Date(today);
      weekStart.setDate(today.getDate() - today.getDay());
      from = weekStart.toISOString().split('T')[0];
      to = today.toISOString().split('T')[0];
      label = 'هذا الأسبوع';
      break;
    case 'month':
      from = new Date(today.getFullYear(), today.getMonth(), 1).toISOString().split('T')[0];
      to = today.toISOString().split('T')[0];
      label = 'هذا الشهر';
      break;
    case 'year':
      from = new Date(today.getFullYear(), 0, 1).toISOString().split('T')[0];
      to = today.toISOString().split('T')[0];
      label = 'هذه السنة';
      break;
    case 'custom':
      from = document.getElementById('expenseDateFrom')?.value || today.toISOString().split('T')[0];
      to = document.getElementById('expenseDateTo')?.value || today.toISOString().split('T')[0];
      label = 'فترة مخصصة';
      break;
    default:
      from = new Date(today.getFullYear(), today.getMonth(), 1).toISOString().split('T')[0];
      to = today.toISOString().split('T')[0];
      label = 'هذا الشهر';
  }

  return { from, to, label };
}

function populateExpenseCategoryFilter(expenses) {
  const select = document.getElementById('expenseCategoryFilter');
  if (!select) return;

  const currentValue = select.value;

  // Get unique categories from both category and sub_type
  const subTypeLabels = {
    salary: 'رواتب',
    operating_expense: 'مصروفات تشغيلية'
  };

  const categories = [...new Set(expenses.map(e => {
    // Prefer sub_type label, then category, then default
    if (e.sub_type && subTypeLabels[e.sub_type]) return subTypeLabels[e.sub_type];
    return e.category || 'أخرى';
  }))].sort();

  select.innerHTML = '<option value="">الكل</option>' +
    categories.map(cat => `<option value="${cat}">${cat}</option>`).join('');

  if (currentValue) select.value = currentValue;
}

function renderExpensesCategoryBreakdown(categoryTotals, total) {
  const container = document.getElementById('expensesCategoryBreakdown');
  if (!container) return;

  const sortedCategories = Object.entries(categoryTotals)
    .sort((a, b) => b[1] - a[1]);

  if (sortedCategories.length === 0) {
    container.innerHTML = '<div class="empty-state" style="padding: 20px;">لا توجد مصروفات</div>';
    return;
  }

  container.innerHTML = sortedCategories.map(([cat, amount]) => {
    const percent = total > 0 ? ((amount / total) * 100).toFixed(1) : 0;
    return `
      <div class="summary-row">
        <span class="summary-label">${cat}</span>
        <span class="summary-value negative">${fmt(amount)} ج.م (${percent}%)</span>
      </div>
    `;
  }).join('');
}

function renderExpensesCategoryChart(categoryTotals) {
  const ctx = document.getElementById('expensesCategoryChart')?.getContext('2d');
  if (!ctx) return;

  if (expensesCategoryChart) expensesCategoryChart.destroy();

  const labels = Object.keys(categoryTotals);
  const data = Object.values(categoryTotals);
  const colors = [
    '#ef4444', '#f97316', '#f59e0b', '#eab308',
    '#84cc16', '#22c55e', '#14b8a6', '#06b6d4',
    '#3b82f6', '#6366f1', '#8b5cf6', '#a855f7'
  ];

  expensesCategoryChart = new Chart(ctx, {
    type: 'doughnut',
    data: {
      labels: labels.length > 0 ? labels : ['لا توجد مصروفات'],
      datasets: [{
        data: data.length > 0 ? data : [1],
        backgroundColor: colors.slice(0, labels.length || 1),
        borderWidth: 0
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          position: 'bottom',
          labels: { color: '#9ca3af', font: { size: 11 } }
        }
      }
    }
  });
}

function renderExpensesTrendChart(expenses, from, to) {
  const ctx = document.getElementById('expensesTrendChart')?.getContext('2d');
  if (!ctx) return;

  if (expensesTrendChart) expensesTrendChart.destroy();

  // Group by date
  const dailyTotals = {};
  expenses.forEach(e => {
    const date = (e.created_at || '').split('T')[0];
    dailyTotals[date] = (dailyTotals[date] || 0) + (parseFloat(e.amount) || 0);
  });

  // Generate all dates in range
  const dates = [];
  const values = [];
  const startDate = new Date(from);
  const endDate = new Date(to);

  for (let d = new Date(startDate); d <= endDate; d.setDate(d.getDate() + 1)) {
    const dateStr = d.toISOString().split('T')[0];
    dates.push(d.toLocaleDateString('ar-EG', { month: 'short', day: 'numeric' }));
    values.push(dailyTotals[dateStr] || 0);
  }

  expensesTrendChart = new Chart(ctx, {
    type: 'line',
    data: {
      labels: dates,
      datasets: [{
        label: 'المصروفات',
        data: values,
        borderColor: '#ef4444',
        backgroundColor: 'rgba(239, 68, 68, 0.1)',
        fill: true,
        tension: 0.4
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false }
      },
      scales: {
        x: {
          grid: { color: 'rgba(255,255,255,0.05)' },
          ticks: { color: '#9ca3af', maxTicksLimit: 10 }
        },
        y: {
          grid: { color: 'rgba(255,255,255,0.05)' },
          ticks: { color: '#9ca3af' }
        }
      }
    }
  });
}

function renderExpensesTable(expenses) {
  const tbody = document.getElementById('expensesTableBody');
  if (!tbody) return;

  if (expenses.length === 0) {
    tbody.innerHTML = '<tr><td colspan="7" class="empty-state">لا توجد مصروفات في هذه الفترة</td></tr>';
    return;
  }

  // Sort by date descending
  const sorted = [...expenses].sort((a, b) =>
    new Date(b.created_at) - new Date(a.created_at)
  );

  // Map sub_type to readable labels
  const subTypeLabels = {
    salary: '💵 رواتب',
    operating_expense: '🧾 مصروفات تشغيلية',
    expense: '📝 مصروف عام'
  };

  // Map wallet_type to readable labels
  const walletLabels = {
    cash: '💵 كاش',
    mobile_wallet: '📱 محفظة',
    bank: '🏦 بنك'
  };

  tbody.innerHTML = sorted.map((e, i) => {
    const date = new Date(e.created_at);
    const dateStr = date.toLocaleDateString('ar-EG', { year: 'numeric', month: 'short', day: 'numeric' });
    const timeStr = date.toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' });
    const expenseType = subTypeLabels[e.sub_type] || e.category || 'مصروف';
    const wallet = walletLabels[e.wallet_type] || '💵 كاش';

    return `
      <tr>
        <td>${i + 1}</td>
        <td>${dateStr}</td>
        <td>${timeStr}</td>
        <td><span class="badge badge-danger">${expenseType}</span></td>
        <td>${e.description || '-'}</td>
        <td>${wallet}</td>
        <td style="color: var(--danger); font-weight: 700;">${fmt(e.amount)} ج.م</td>
      </tr>
    `;
  }).join('');
}

function renderExpensesMonthlyTable(allExpenses) {
  const tbody = document.getElementById('expensesMonthlyBody');
  if (!tbody) return;

  // Group by month
  const monthlyData = {};
  allExpenses.forEach(e => {
    const date = new Date(e.created_at);
    const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;

    if (!monthlyData[monthKey]) {
      monthlyData[monthKey] = { total: 0, count: 0, max: 0 };
    }

    const amount = parseFloat(e.amount) || 0;
    monthlyData[monthKey].total += amount;
    monthlyData[monthKey].count++;
    monthlyData[monthKey].max = Math.max(monthlyData[monthKey].max, amount);
  });

  const sortedMonths = Object.keys(monthlyData).sort().reverse().slice(0, 12);

  if (sortedMonths.length === 0) {
    tbody.innerHTML = '<tr><td colspan="5" class="empty-state">لا توجد بيانات</td></tr>';
    return;
  }

  tbody.innerHTML = sortedMonths.map(month => {
    const data = monthlyData[month];
    const [year, m] = month.split('-');
    const monthName = new Date(year, parseInt(m) - 1, 1).toLocaleDateString('ar-EG', { year: 'numeric', month: 'long' });
    const daysInMonth = new Date(year, m, 0).getDate();
    const dailyAvg = data.total / daysInMonth;

    return `
      <tr>
        <td>${monthName}</td>
        <td>${data.count}</td>
        <td style="color: var(--danger); font-weight: 700;">${fmt(data.total)} ج.م</td>
        <td>${fmt(dailyAvg)} ج.م</td>
        <td>${fmt(data.max)} ج.م</td>
      </tr>
    `;
  }).join('');
}

function exportExpensesReport() {
  const { dateFrom, dateTo } = getReportFilterDates('expense');
  const notExpenseCategories = [
    'مرتجعات مبيعات', 'مسحوبات درج الكاش', 'سحب لدرج الكاش', 'سحب لمرتجع',
    'عجز كاش', 'تحويل لدرج الكاش', 'فائض سحب للدرج', 'زيادة كاش'
  ];
  const isNotExpenseCategory = (cat) => {
    if (!cat) return false;
    const c = String(cat).trim();
    return notExpenseCategories.includes(c) || c.includes('مرتجع') || c.includes('عجز') || c === 'سحب';
  };

  fetch('elos-db://safe-transactions')
    .then(r => r.json())
    .then(transactions => {
      const expenses = transactions.filter(t => {
        const txDate = (t.created_at || '').split('T')[0].split(' ')[0];
        if (txDate < dateFrom || txDate > dateTo) return false;
        if (t.type !== 'expense') return false;
        if (isNotExpenseCategory(t.category)) return false;
        if (t.description && (t.description.includes('مرتجعات') || t.description.includes('عجز في الكاش'))) return false;
        return true;
      });

      const data = expenses.map(e => ({
        'التاريخ': e.created_at,
        'التصنيف': e.category || 'أخرى',
        'الوصف': e.description || '',
        'طريقة الدفع': e.payment_method || 'cash',
        'المبلغ': parseFloat(e.amount) || 0
      }));

      exportToCSV(data, 'expenses_report.csv');
      showToast('تم تصدير التقرير بنجاح', 'success');
    })
    .catch(err => {
      Logger.error(err);
      showToast('خطأ في تصدير التقرير', 'error');
    });
}

// ═══════════════════════════════════════════════════════════════
// ↩️ SALES RETURNS REPORT
// تقرير مرتجعات المبيعات
// ═══════════════════════════════════════════════════════════════
let salesReturnsData = { devices: [], accessories: [] };

async function loadSalesReturnsReport() {
  try {
    applyReportPeriodFilter('salesReturns');
    let { dateFrom, dateTo } = getReportFilterDates('salesReturns');
    if (!dateFrom || !dateTo) {
      const today = new Date();
      const first = new Date(today.getFullYear(), today.getMonth() - 1, 1);
      const last = new Date(today.getFullYear(), today.getMonth(), 0);
      dateFrom = first.toISOString().split('T')[0];
      dateTo = last.toISOString().split('T')[0];
    }
    const typeFilter = document.getElementById('salesReturnsType')?.value || '';

    // Fetch returned device sales
    let deviceReturns = [];
    try {
      const deviceResponse = await fetch('elos-db://sales?include_returned=true');
      if (deviceResponse.ok) {
        const deviceData = await deviceResponse.json();
        const allSales = Array.isArray(deviceData) ? deviceData : (deviceData.sales || []);
        deviceReturns = allSales.filter(s => s.status === 'returned');

        // Filter by date
        if (dateFrom && dateTo) {
          deviceReturns = deviceReturns.filter(s => {
            const returnDate = (s.returned_at || s.created_at || '').split('T')[0];
            return returnDate >= dateFrom && returnDate <= dateTo;
          });
        }
      }
    } catch (e) {
      Logger.error('[SALES-RETURNS] Error loading device returns:', e);
    }

    // Fetch returned accessory sales
    let accessoryReturns = [];
    try {
      const accResponse = await fetch('elos-db://accessory-movements?type=sale');
      if (accResponse.ok) {
        const accData = await accResponse.json();
        const allMovements = Array.isArray(accData) ? accData : (accData.movements || []);
        accessoryReturns = allMovements.filter(m => m.status === 'returned');

        // Filter by date
        if (dateFrom && dateTo) {
          accessoryReturns = accessoryReturns.filter(m => {
            const returnDate = (m.returned_at || m.created_at || '').split('T')[0];
            return returnDate >= dateFrom && returnDate <= dateTo;
          });
        }
      }
    } catch (e) {
      Logger.error('[SALES-RETURNS] Error loading accessory returns:', e);
    }

    // Store data
    salesReturnsData = { devices: deviceReturns, accessories: accessoryReturns };

    // Apply type filter
    let filteredDevices = typeFilter === 'accessory' ? [] : deviceReturns;
    let filteredAccessories = typeFilter === 'device' ? [] : accessoryReturns;

    // Calculate stats
    const totalDeviceRefunds = filteredDevices.reduce((sum, d) => sum + (parseFloat(d.refund_amount) || 0), 0);
    const totalAccessoryRefunds = filteredAccessories.reduce((sum, a) => sum + (parseFloat(a.refund_amount) || 0), 0);
    const totalRefunds = totalDeviceRefunds + totalAccessoryRefunds;
    const totalCount = filteredDevices.length + filteredAccessories.length;

    // Render stats - update the stat values in HTML
    const salesReturnsTotalEl = document.getElementById('salesReturnsTotal');
    const salesReturnsCountEl = document.getElementById('salesReturnsCount');
    const salesReturnsDevicesEl = document.getElementById('salesReturnsDevices');
    const salesReturnsAccessoriesEl = document.getElementById('salesReturnsAccessories');

    if (salesReturnsTotalEl) salesReturnsTotalEl.textContent = fmt(totalRefunds) + ' ج.م';
    if (salesReturnsCountEl) salesReturnsCountEl.textContent = totalCount;
    if (salesReturnsDevicesEl) salesReturnsDevicesEl.textContent = filteredDevices.length;
    if (salesReturnsAccessoriesEl) salesReturnsAccessoriesEl.textContent = filteredAccessories.length;

    // Calculate financial summary
    const originalDeviceSales = filteredDevices.reduce((sum, d) => sum + (parseFloat(d.sell_price) || 0), 0);
    const originalAccessorySales = filteredAccessories.reduce((sum, a) => {
      const qty = Math.abs(parseFloat(a.quantity) || 1);
      const price = parseFloat(a.unit_price) || 0;
      return sum + (qty * price);
    }, 0);
    const originalTotal = originalDeviceSales + originalAccessorySales;
    const returnRate = originalTotal > 0 ? (totalRefunds / originalTotal * 100) : 0;

    // Financial summary
    const avgRefund = totalCount > 0 ? totalRefunds / totalCount : 0;
    const maxRefund = Math.max(
      ...filteredDevices.map(d => parseFloat(d.refund_amount) || 0),
      ...filteredAccessories.map(a => parseFloat(a.refund_amount) || 0),
      0
    );

    const salesReturnsTotalRefundEl = document.getElementById('salesReturnsTotalRefund');
    const salesReturnsAvgRefundEl = document.getElementById('salesReturnsAvgRefund');
    const salesReturnsMaxRefundEl = document.getElementById('salesReturnsMaxRefund');

    if (salesReturnsTotalRefundEl) salesReturnsTotalRefundEl.textContent = fmt(totalRefunds) + ' ج.م';
    if (salesReturnsAvgRefundEl) salesReturnsAvgRefundEl.textContent = fmt(avgRefund) + ' ج.م';
    if (salesReturnsMaxRefundEl) salesReturnsMaxRefundEl.textContent = fmt(maxRefund) + ' ج.م';

    // Calculate return reasons
    const reasonStats = {};
    filteredDevices.forEach(d => {
      const reason = d.return_reason || 'غير محدد';
      reasonStats[reason] = (reasonStats[reason] || 0) + 1;
    });
    filteredAccessories.forEach(a => {
      const reason = a.return_reason || 'غير محدد';
      reasonStats[reason] = (reasonStats[reason] || 0) + 1;
    });

    const topReasons = Object.entries(reasonStats)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5);

    const salesReturnsReasonsEl = document.getElementById('salesReturnsReasons');
    if (salesReturnsReasonsEl) {
      salesReturnsReasonsEl.innerHTML = topReasons.length > 0
        ? topReasons.map(([reason, count]) => `
            <div class="summary-row">
              <span class="summary-label">${reason}</span>
              <span class="summary-value">${count} مرة</span>
            </div>
          `).join('')
        : '<div class="summary-row"><span class="summary-label">لا توجد بيانات</span></div>';
    }

    // Render charts
    renderSalesReturnsCharts(filteredDevices, filteredAccessories, dateFrom, dateTo);

    // Render tables
    renderSalesReturnsTable(filteredDevices, filteredAccessories);
    renderSalesReturnsMonthlyTable(deviceReturns, accessoryReturns);

  } catch (error) {
    Logger.error('[SALES-RETURNS] Error loading report:', error);
    showToast('خطأ في تحميل تقرير المرتجعات', 'error');
  }
}

function renderSalesReturnsCharts(devices, accessories, dateFrom, dateTo) {
  // Daily Returns Chart
  const dailyCtx = document.getElementById('dailySalesReturnsChart')?.getContext('2d');
  if (dailyCtx) {
    if (charts.dailyReturns) charts.dailyReturns.destroy();

    // Group by date
    const dailyTotals = {};
    devices.forEach(d => {
      const date = (d.returned_at || d.created_at || '').split('T')[0];
      if (date) dailyTotals[date] = (dailyTotals[date] || 0) + (parseFloat(d.refund_amount) || 0);
    });
    accessories.forEach(a => {
      const date = (a.returned_at || a.created_at || '').split('T')[0];
      if (date) dailyTotals[date] = (dailyTotals[date] || 0) + (parseFloat(a.refund_amount) || 0);
    });

    const sortedDates = Object.keys(dailyTotals).sort().slice(-14);
    const labels = sortedDates.map(d => {
      const date = new Date(d);
      return date.toLocaleDateString('ar-EG', { month: 'short', day: 'numeric' });
    });
    const data = sortedDates.map(d => dailyTotals[d]);

    charts.dailyReturns = new Chart(dailyCtx, {
      type: 'bar',
      data: {
        labels: labels.length > 0 ? labels : ['لا توجد بيانات'],
        datasets: [{
          label: 'المرتجعات',
          data: data.length > 0 ? data : [0],
          backgroundColor: 'rgba(239, 68, 68, 0.7)',
          borderColor: '#ef4444',
          borderWidth: 1
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false }
        },
        scales: {
          x: {
            grid: { color: 'rgba(255,255,255,0.05)' },
            ticks: { color: '#9ca3af' }
          },
          y: {
            grid: { color: 'rgba(255,255,255,0.05)' },
            ticks: { color: '#9ca3af' }
          }
        }
      }
    });
  }

  // Returns by Reason Chart
  const reasonCtx = document.getElementById('salesReturnsByReasonChart')?.getContext('2d');
  if (reasonCtx) {
    if (charts.returnsByReason) charts.returnsByReason.destroy();

    const reasonStats = {};
    devices.forEach(d => {
      const reason = d.return_reason || 'غير محدد';
      reasonStats[reason] = (reasonStats[reason] || 0) + (parseFloat(d.refund_amount) || 0);
    });
    accessories.forEach(a => {
      const reason = a.return_reason || 'غير محدد';
      reasonStats[reason] = (reasonStats[reason] || 0) + (parseFloat(a.refund_amount) || 0);
    });

    const labels = Object.keys(reasonStats);
    const data = Object.values(reasonStats);
    const colors = ['#ef4444', '#f97316', '#f59e0b', '#eab308', '#84cc16', '#22c55e', '#14b8a6', '#06b6d4'];

    charts.returnsByReason = new Chart(reasonCtx, {
      type: 'doughnut',
      data: {
        labels: labels.length > 0 ? labels : ['لا توجد بيانات'],
        datasets: [{
          data: data.length > 0 ? data : [1],
          backgroundColor: colors.slice(0, labels.length || 1),
          borderWidth: 0
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            position: 'bottom',
            labels: { color: '#9ca3af', font: { size: 11 } }
          }
        }
      }
    });
  }
}

function renderSalesReturnsTable(devices, accessories) {
  const tbody = document.getElementById('salesReturnsTableBody');
  if (!tbody) return;

  // Combine and sort all returns
  const allReturns = [
    ...devices.map(d => ({
      type: 'device',
      date: d.returned_at || d.created_at,
      invoiceNum: d.invoice_number || d.id || '-',
      name: `${d.type || ''} ${d.model || ''} ${d.storage || ''}`.trim() || 'جهاز',
      client: d.client_name || d.customer_name || '-',
      reason: d.return_reason || '-',
      amount: parseFloat(d.refund_amount) || 0,
      status: 'مكتمل'
    })),
    ...accessories.map(a => ({
      type: 'accessory',
      date: a.returned_at || a.created_at,
      invoiceNum: a.invoice_number || a.id || '-',
      name: a.accessory_name || 'إكسسوار',
      client: a.client_name || '-',
      reason: a.return_reason || '-',
      amount: parseFloat(a.refund_amount) || 0,
      status: 'مكتمل'
    }))
  ].sort((a, b) => new Date(b.date) - new Date(a.date));

  // Update table count
  const tableCountEl = document.getElementById('salesReturnsTableCount');
  if (tableCountEl) tableCountEl.textContent = allReturns.length + ' عملية';

  if (allReturns.length === 0) {
    tbody.innerHTML = '<tr><td colspan="9" class="empty-state">لا توجد مرتجعات في هذه الفترة</td></tr>';
    return;
  }

  tbody.innerHTML = allReturns.map((r, i) => {
    const date = new Date(r.date);
    const dateStr = date.toLocaleDateString('ar-EG', { year: 'numeric', month: 'short', day: 'numeric' });
    const typeIcon = r.type === 'device' ? '📱' : '🎧';
    const typeName = r.type === 'device' ? 'جهاز' : 'إكسسوار';

    return `
      <tr>
        <td>${i + 1}</td>
        <td>${dateStr}</td>
        <td>${r.invoiceNum}</td>
        <td>${r.client}</td>
        <td><span class="badge ${r.type === 'device' ? 'badge-info' : 'badge-warning'}">${typeIcon} ${typeName}</span></td>
        <td>${r.name}</td>
        <td>${r.reason}</td>
        <td style="color: var(--danger); font-weight: 700;">${fmt(r.amount)} ج.م</td>
        <td><span class="badge badge-success">${r.status}</span></td>
      </tr>
    `;
  }).join('');
}

function renderSalesReturnsMonthlyTable(devices, accessories) {
  const tbody = document.getElementById('salesReturnsMonthlyBody');
  if (!tbody) return;

  // Group by month
  const monthlyData = {};

  devices.forEach(d => {
    const date = new Date(d.returned_at || d.created_at);
    const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;

    if (!monthlyData[monthKey]) {
      monthlyData[monthKey] = { count: 0, devices: 0, accessories: 0, totalAmount: 0 };
    }
    monthlyData[monthKey].count++;
    monthlyData[monthKey].devices++;
    monthlyData[monthKey].totalAmount += parseFloat(d.refund_amount) || 0;
  });

  accessories.forEach(a => {
    const date = new Date(a.returned_at || a.created_at);
    const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;

    if (!monthlyData[monthKey]) {
      monthlyData[monthKey] = { count: 0, devices: 0, accessories: 0, totalAmount: 0 };
    }
    monthlyData[monthKey].count++;
    monthlyData[monthKey].accessories++;
    monthlyData[monthKey].totalAmount += parseFloat(a.refund_amount) || 0;
  });

  const sortedMonths = Object.keys(monthlyData).sort().reverse().slice(0, 12);

  if (sortedMonths.length === 0) {
    tbody.innerHTML = '<tr><td colspan="6" class="empty-state">لا توجد بيانات</td></tr>';
    return;
  }

  tbody.innerHTML = sortedMonths.map(month => {
    const data = monthlyData[month];
    const [year, m] = month.split('-');
    const monthName = new Date(year, parseInt(m) - 1, 1).toLocaleDateString('ar-EG', { year: 'numeric', month: 'long' });
    // Calculate return rate (placeholder - would need total sales data)
    const returnRate = '-';

    return `
      <tr>
        <td>${monthName}</td>
        <td>${data.count}</td>
        <td>${data.devices}</td>
        <td>${data.accessories}</td>
        <td style="color: var(--danger); font-weight: 700;">${fmt(data.totalAmount)} ج.م</td>
        <td>${returnRate}</td>
      </tr>
    `;
  }).join('');
}

function clearSalesReturnsFilters() {
  const periodEl = document.getElementById('salesReturnsPeriodFilter');
  const typeFilter = document.getElementById('salesReturnsType');
  if (periodEl) { periodEl.value = 'last_month'; applyReportPeriodFilter('salesReturns'); }
  if (typeFilter) typeFilter.value = '';

  loadSalesReturnsReport();
}

function exportSalesReturnsReport() {
  const { devices, accessories } = salesReturnsData;

  const data = [
    ...devices.map(d => ({
      'التاريخ': d.returned_at || d.created_at,
      'النوع': 'جهاز',
      'الاسم': `${d.type || ''} ${d.model || ''} ${d.storage || ''}`.trim(),
      'IMEI': d.imei1 || d.imei2 || '',
      'العميل': d.client_name || d.customer_name || '',
      'سبب الإرجاع': d.return_reason || '',
      'المبلغ المسترد': parseFloat(d.refund_amount) || 0
    })),
    ...accessories.map(a => ({
      'التاريخ': a.returned_at || a.created_at,
      'النوع': 'إكسسوار',
      'الاسم': a.accessory_name || '',
      'IMEI': '',
      'العميل': a.client_name || '',
      'سبب الإرجاع': a.return_reason || '',
      'المبلغ المسترد': parseFloat(a.refund_amount) || 0
    }))
  ];

  exportToCSV(data, 'sales_returns_report.csv');
  showToast('تم تصدير التقرير بنجاح', 'success');
}

// ═══════════════════════════════════════════════════════════════
// ↩️ PURCHASE RETURNS REPORT
// تقرير مرتجعات المشتريات
// ═══════════════════════════════════════════════════════════════
let purchaseReturnsData = [];

async function loadPurchaseReturnsReport() {
  try {
    applyReportPeriodFilter('purchaseReturns');
    const { dateFrom, dateTo } = getReportFilterDates('purchaseReturns');
    const typeFilter = document.getElementById('purchaseReturnsType')?.value || '';
    const supplierFilter = document.getElementById('purchaseReturnsSupplier')?.value || '';

    // Fetch purchase returns from API
    let allReturns = [];
    try {
      const response = await fetch('elos-db://purchase-returns');
      if (response.ok) {
        const data = await response.json();
        allReturns = Array.isArray(data) ? data : (data.returns || []);
        Logger.log('[PURCHASE-RETURNS] Loaded:', allReturns.length, 'returns');
      }
    } catch (e) {
      Logger.error('[PURCHASE-RETURNS] Error loading returns:', e);
    }
    
    // ✅ جلب مرتجعات قطع الصيانة
    let repairPartsReturns = [];
    try {
      let repairPartsReturnsUrl = 'elos-db://repair-parts-purchase-returns';
      if (dateFrom && dateTo) repairPartsReturnsUrl += `?from=${dateFrom}&to=${dateTo}`;
      const repairPartsRes = await fetch(repairPartsReturnsUrl);
      if (repairPartsRes.ok) {
        const repairPartsData = await repairPartsRes.json();
        repairPartsReturns = Array.isArray(repairPartsData) 
          ? repairPartsData 
          : (repairPartsData.returns || repairPartsData.movements || []);
        Logger.log('[PURCHASE-RETURNS] Loaded repair parts returns:', repairPartsReturns.length);
        
        // ✅ تحويل مرتجعات قطع الصيانة إلى نفس الشكل
        const formattedRepairPartsReturns = repairPartsReturns.map(r => ({
          ...r,
          item_type: 'repair_part',
          return_reason: r.reason || r.note || 'مرتجع قطع صيانة',
          refund_amount: (parseFloat(r.qty) || parseFloat(r.quantity) || 0) * (parseFloat(r.unit_cost) || parseFloat(r.cost) || 0),
          part_name: r.part_name || r.name || 'قطعة صيانة'
        }));
        
        // ✅ دمج مرتجعات قطع الصيانة مع المرتجعات الأخرى
        allReturns = [...allReturns, ...formattedRepairPartsReturns];
      }
    } catch (e) {
      Logger.warn('[PURCHASE-RETURNS] Could not load repair parts returns:', e);
    }

    // Filter by date
    if (dateFrom && dateTo) {
      allReturns = allReturns.filter(r => {
        const returnDate = (r.created_at || '').split('T')[0];
        return returnDate >= dateFrom && returnDate <= dateTo;
      });
      Logger.log('[PURCHASE-RETURNS] After date filter:', allReturns.length, 'returns');
    }

    // Filter by type
    if (typeFilter) {
      allReturns = allReturns.filter(r => r.item_type === typeFilter);
    }

    // Filter by supplier
    if (supplierFilter) {
      allReturns = allReturns.filter(r => r.supplier_id == supplierFilter);
    }

    // Store data
    purchaseReturnsData = allReturns;

    // Populate supplier filter
    await populatePurchaseReturnsSupplierFilter();

    // ✅ Calculate stats (شاملة مرتجعات قطع الصيانة)
    const deviceReturns = allReturns.filter(r => r.item_type === 'device');
    const accessoryReturns = allReturns.filter(r => r.item_type === 'accessory');
    const repairPartsReturnsFiltered = allReturns.filter(r => r.item_type === 'repair_part');

    const totalDeviceRefunds = deviceReturns.reduce((sum, r) => sum + (parseFloat(r.refund_amount) || 0), 0);
    const totalAccessoryRefunds = accessoryReturns.reduce((sum, r) => sum + (parseFloat(r.refund_amount) || 0), 0);
    const totalRepairPartsRefunds = repairPartsReturnsFiltered.reduce((sum, r) => sum + (parseFloat(r.refund_amount) || 0), 0);
    const totalRefunds = totalDeviceRefunds + totalAccessoryRefunds + totalRepairPartsRefunds;
    const totalCount = allReturns.length;

    // ✅ Render stats (شاملة مرتجعات قطع الصيانة)
    const purchaseReturnsTotalEl = document.getElementById('purchaseReturnsTotal');
    const purchaseReturnsCountEl = document.getElementById('purchaseReturnsCount');
    const purchaseReturnsDevicesEl = document.getElementById('purchaseReturnsDevices');
    const purchaseReturnsAccessoriesEl = document.getElementById('purchaseReturnsAccessories');
    const purchaseReturnsRepairPartsEl = document.getElementById('purchaseReturnsRepairParts');

    if (purchaseReturnsTotalEl) purchaseReturnsTotalEl.textContent = fmt(totalRefunds) + ' ج.م';
    if (purchaseReturnsCountEl) purchaseReturnsCountEl.textContent = totalCount;
    if (purchaseReturnsDevicesEl) purchaseReturnsDevicesEl.textContent = deviceReturns.length;
    if (purchaseReturnsAccessoriesEl) purchaseReturnsAccessoriesEl.textContent = accessoryReturns.length;
    if (purchaseReturnsRepairPartsEl) purchaseReturnsRepairPartsEl.textContent = repairPartsReturnsFiltered.length;

    // Financial summary
    const avgRefund = totalCount > 0 ? totalRefunds / totalCount : 0;
    const maxRefund = allReturns.length > 0
      ? Math.max(...allReturns.map(r => parseFloat(r.refund_amount) || 0))
      : 0;

    const purchaseReturnsTotalRefundEl = document.getElementById('purchaseReturnsTotalRefund');
    const purchaseReturnsAvgRefundEl = document.getElementById('purchaseReturnsAvgRefund');
    const purchaseReturnsMaxRefundEl = document.getElementById('purchaseReturnsMaxRefund');

    if (purchaseReturnsTotalRefundEl) purchaseReturnsTotalRefundEl.textContent = fmt(totalRefunds) + ' ج.م';
    if (purchaseReturnsAvgRefundEl) purchaseReturnsAvgRefundEl.textContent = fmt(avgRefund) + ' ج.م';
    if (purchaseReturnsMaxRefundEl) purchaseReturnsMaxRefundEl.textContent = fmt(maxRefund) + ' ج.م';

    // Calculate return reasons
    const reasonStats = {};
    allReturns.forEach(r => {
      const reason = r.return_reason || 'غير محدد';
      reasonStats[reason] = (reasonStats[reason] || 0) + 1;
    });

    const topReasons = Object.entries(reasonStats)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5);

    const purchaseReturnsReasonsEl = document.getElementById('purchaseReturnsReasons');
    if (purchaseReturnsReasonsEl) {
      purchaseReturnsReasonsEl.innerHTML = topReasons.length > 0
        ? topReasons.map(([reason, count]) => `
            <div class="summary-row">
              <span class="summary-label">${reason}</span>
              <span class="summary-value">${count} مرة</span>
            </div>
          `).join('')
        : '<div class="summary-row"><span class="summary-label">لا توجد بيانات</span></div>';
    }

    // Render charts
    renderPurchaseReturnsCharts(allReturns);

    // Render tables
    renderPurchaseReturnsTable(allReturns);
    renderPurchaseReturnsMonthlyTable(allReturns);

  } catch (error) {
    Logger.error('[PURCHASE-RETURNS] Error loading report:', error);
    showToast('خطأ في تحميل تقرير المرتجعات', 'error');
  }
}

async function populatePurchaseReturnsSupplierFilter() {
  const select = document.getElementById('purchaseReturnsSupplier');
  if (!select) return;

  // Keep current value
  const currentValue = select.value;

  try {
    const response = await fetch('elos-db://suppliers');
    if (response.ok) {
      const data = await response.json();
      const suppliers = Array.isArray(data) ? data : (data.suppliers || []);

      // Keep only first option
      select.innerHTML = '<option value="">الكل</option>';

      suppliers.forEach(s => {
        const option = document.createElement('option');
        option.value = s.id;
        option.textContent = s.name;
        if (s.id == currentValue) option.selected = true;
        select.appendChild(option);
      });
    }
  } catch (e) {
    Logger.error('[PURCHASE-RETURNS] Error loading suppliers:', e);
  }
}

function renderPurchaseReturnsCharts(returns) {
  // Daily Returns Chart
  const dailyCtx = document.getElementById('dailyPurchaseReturnsChart')?.getContext('2d');
  if (dailyCtx) {
    if (charts.dailyPurchaseReturns) charts.dailyPurchaseReturns.destroy();

    // Group by date
    const dailyTotals = {};
    returns.forEach(r => {
      const date = (r.created_at || '').split('T')[0];
      if (date) dailyTotals[date] = (dailyTotals[date] || 0) + (parseFloat(r.refund_amount) || 0);
    });

    const sortedDates = Object.keys(dailyTotals).sort().slice(-14);
    const labels = sortedDates.map(d => {
      const date = new Date(d);
      return date.toLocaleDateString('ar-EG', { month: 'short', day: 'numeric' });
    });
    const data = sortedDates.map(d => dailyTotals[d]);

    charts.dailyPurchaseReturns = new Chart(dailyCtx, {
      type: 'bar',
      data: {
        labels: labels.length > 0 ? labels : ['لا توجد بيانات'],
        datasets: [{
          label: 'المرتجعات',
          data: data.length > 0 ? data : [0],
          backgroundColor: 'rgba(34, 197, 94, 0.7)',
          borderColor: '#22c55e',
          borderWidth: 1
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false }
        },
        scales: {
          x: {
            grid: { color: 'rgba(255,255,255,0.05)' },
            ticks: { color: '#9ca3af' }
          },
          y: {
            grid: { color: 'rgba(255,255,255,0.05)' },
            ticks: { color: '#9ca3af' }
          }
        }
      }
    });
  }

  // Returns by Reason Chart
  const reasonCtx = document.getElementById('purchaseReturnsByReasonChart')?.getContext('2d');
  if (reasonCtx) {
    if (charts.purchaseReturnsByReason) charts.purchaseReturnsByReason.destroy();

    const reasonStats = {};
    returns.forEach(r => {
      const reason = r.return_reason || 'غير محدد';
      reasonStats[reason] = (reasonStats[reason] || 0) + (parseFloat(r.refund_amount) || 0);
    });

    const labels = Object.keys(reasonStats);
    const data = Object.values(reasonStats);
    const colors = ['#22c55e', '#14b8a6', '#06b6d4', '#3b82f6', '#6366f1', '#8b5cf6', '#a855f7', '#ec4899'];

    charts.purchaseReturnsByReason = new Chart(reasonCtx, {
      type: 'doughnut',
      data: {
        labels: labels.length > 0 ? labels : ['لا توجد بيانات'],
        datasets: [{
          data: data.length > 0 ? data : [1],
          backgroundColor: colors.slice(0, labels.length || 1),
          borderWidth: 0
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            position: 'bottom',
            labels: { color: '#9ca3af', font: { size: 11 } }
          }
        }
      }
    });
  }
}

function renderPurchaseReturnsTable(returns) {
  const tbody = document.getElementById('purchaseReturnsTableBody');
  if (!tbody) return;

  // Update table count
  const tableCountEl = document.getElementById('purchaseReturnsTableCount');
  if (tableCountEl) tableCountEl.textContent = returns.length + ' عملية';

  if (returns.length === 0) {
    tbody.innerHTML = '<tr><td colspan="8" class="empty-state">لا توجد مرتجعات في هذه الفترة</td></tr>';
    return;
  }

  // Sort by date descending
  const sorted = [...returns].sort((a, b) => new Date(b.created_at) - new Date(a.created_at));

  tbody.innerHTML = sorted.map((r, i) => {
    const date = new Date(r.created_at);
    const dateStr = date.toLocaleDateString('ar-EG', { year: 'numeric', month: 'short', day: 'numeric' });
    
    // ✅ دعم أنواع المرتجعات (device, accessory, repair_part)
    const typeIcon = r.item_type === 'device' ? '📱' : r.item_type === 'repair_part' ? '🔧' : '🎧';
    const typeName = r.item_type === 'device' ? 'جهاز' : r.item_type === 'repair_part' ? 'قطع صيانة' : 'إكسسوار';
    const typeBadge = r.item_type === 'device' ? 'badge-info' : r.item_type === 'repair_part' ? 'badge-danger' : 'badge-warning';

    // ✅ Build product name (يشمل قطع الصيانة)
    let productName = '-';
    if (r.item_type === 'device') {
      productName = `${r.device_type || ''} ${r.device_model || ''} ${r.storage || ''}`.trim() || 'جهاز';
    } else if (r.item_type === 'repair_part') {
      productName = r.part_name || r.name || 'قطعة صيانة';
    } else {
      productName = r.accessory_name || 'إكسسوار';
    }

    return `
      <tr>
        <td>${i + 1}</td>
        <td>${dateStr}</td>
        <td>${r.supplier_name || r.supplier || '-'}</td>
        <td><span class="badge ${typeBadge}">${typeIcon} ${typeName}</span></td>
        <td><strong>${escapeHtml(productName)}</strong></td>
        <td>${escapeHtml(r.return_reason || r.reason || '-')}</td>
        <td style="color: var(--success); font-weight: 700;">${fmt(r.refund_amount || 0)} ج.م</td>
        <td><span class="badge badge-success">${r.status || 'مكتمل'}</span></td>
      </tr>
    `;
  }).join('');
}

function renderPurchaseReturnsMonthlyTable(returns) {
  const tbody = document.getElementById('purchaseReturnsMonthlyBody');
  if (!tbody) return;

  // Group by month
  const monthlyData = {};

  returns.forEach(r => {
    const date = new Date(r.created_at);
    const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;

    if (!monthlyData[monthKey]) {
      monthlyData[monthKey] = { count: 0, devices: 0, accessories: 0, repairParts: 0, totalAmount: 0 };
    }
    monthlyData[monthKey].count++;
    if (r.item_type === 'device') {
      monthlyData[monthKey].devices++;
    } else if (r.item_type === 'repair_part') {
      monthlyData[monthKey].repairParts++;
    } else {
      monthlyData[monthKey].accessories++;
    }
    monthlyData[monthKey].totalAmount += parseFloat(r.refund_amount) || 0;
  });

  const sortedMonths = Object.keys(monthlyData).sort().reverse().slice(0, 12);

  if (sortedMonths.length === 0) {
    tbody.innerHTML = '<tr><td colspan="6" class="empty-state">لا توجد بيانات</td></tr>';
    return;
  }

  tbody.innerHTML = sortedMonths.map(month => {
    const data = monthlyData[month];
    const [year, m] = month.split('-');
    const monthName = new Date(year, parseInt(m) - 1, 1).toLocaleDateString('ar-EG', { year: 'numeric', month: 'long' });

    return `
      <tr>
        <td>${monthName}</td>
        <td>${data.count}</td>
        <td>${data.devices}</td>
        <td>${data.accessories}</td>
        <td>${data.repairParts || 0}</td>
        <td style="color: var(--success); font-weight: 700;">${fmt(data.totalAmount)} ج.م</td>
      </tr>
    `;
  }).join('');
}

function clearPurchaseReturnsFilters() {
  const today = new Date();
  const firstDay = new Date(today.getFullYear(), today.getMonth(), 1);

  const dateFrom = document.getElementById('purchaseReturnsDateFrom');
  const dateTo = document.getElementById('purchaseReturnsDateTo');
  const typeFilter = document.getElementById('purchaseReturnsType');
  const supplierFilter = document.getElementById('purchaseReturnsSupplier');

  if (dateFrom) dateFrom.valueAsDate = firstDay;
  if (dateTo) dateTo.valueAsDate = today;
  if (typeFilter) typeFilter.value = '';
  if (supplierFilter) supplierFilter.value = '';

  loadPurchaseReturnsReport();
}

function exportPurchaseReturnsReport() {
  const data = purchaseReturnsData.map(r => {
    let productName = '-';
    if (r.item_type === 'device') {
      productName = `${r.device_type || ''} ${r.device_model || ''} ${r.storage || ''}`.trim();
    } else {
      productName = r.accessory_name || '';
    }

    return {
      'التاريخ': r.created_at,
      'المورد': r.supplier_name || '',
      'النوع': r.item_type === 'device' ? 'جهاز' : 'إكسسوار',
      'المنتج': productName,
      'سبب الإرجاع': r.return_reason || '',
      'المبلغ المسترد': parseFloat(r.refund_amount) || 0,
      'الحالة': r.status || 'مكتمل'
    };
  });

  exportToCSV(data, 'purchase_returns_report.csv');
  showToast('تم تصدير التقرير بنجاح', 'success');
}

// ═══════════════════════════════════════════════════════════════
// 🚀 INITIALIZATION
// ═══════════════════════════════════════════════════════════════
window.addEventListener('DOMContentLoaded', () => {
  Logger.log('📊 ELOS ERP Reports System v2.0 - Initializing...');
  
  initHeaderClock();
  
  // Set default date range
  const today = new Date();
  const firstDay = new Date(today.getFullYear(), today.getMonth(), 1);
  document.getElementById('dateFrom').valueAsDate = firstDay;
  document.getElementById('dateTo').valueAsDate = today;
  
  // Load all reports
  loadAllReports();
  
  Logger.log('✅ ELOS ERP Reports System Ready!');
});

// ═══════════════════════════════════════════════════════════════
// 💱 MONEY TRANSFERS REPORT
// ═══════════════════════════════════════════════════════════════

const MT_TYPE_NAMES = {
  vodafone_cash: 'فودافون كاش', etisalat_cash: 'اتصالات كاش', orange_cash: 'اورنج كاش',
  we_pay: 'وي باي', instapay: 'انستاباي', other: 'أخرى'
};
const MT_TYPE_COLORS = {
  vodafone_cash: '#ef4444', etisalat_cash: '#22c55e', orange_cash: '#f97316',
  we_pay: '#8b5cf6', instapay: '#3b82f6', other: '#64748b'
};
const MT_DIR_LABELS = { deposit: '📥 إيداع', withdraw: '📤 سحب', deferred: '⏳ آجل' };
const MT_DIR_COLORS = { deposit: '#10b981', withdraw: '#f59e0b', deferred: '#a78bfa' };

async function loadMoneyTransfersReport() {
  try {
    applyReportPeriodFilter('moneyTransfers');
    const { dateFrom, dateTo } = getReportFilterDates('moneyTransfers');
    const typeFilter = document.getElementById('mtReportTypeFilter')?.value || '';
    const dirFilter = document.getElementById('mtReportDirFilter')?.value || '';

    let url = `elos-db://money-transfers?from=${dateFrom}&to=${dateTo}`;
    if (typeFilter) url += `&transfer_type=${typeFilter}`;

    const res = await fetch(url);
    if (!res.ok) throw new Error(await res.text());
    let transfers = await res.json();

    // Client-side direction filter
    if (dirFilter) {
      if (dirFilter === 'deferred') {
        transfers = transfers.filter(t => !!t.client_id);
      } else {
        transfers = transfers.filter(t => !t.client_id && t.direction === dirFilter);
      }
    }

    // Stats
    const count = transfers.length;
    let totalAmount = 0, totalCommission = 0;
    transfers.forEach(t => {
      totalAmount += Number(t.transfer_amount || 0);
      totalCommission += Number(t.commission || 0);
    });
    const avgCommission = count > 0 ? totalCommission / count : 0;

    document.getElementById('mtReportCount').textContent = count;
    document.getElementById('mtReportTotalAmount').textContent = fmt(totalAmount) + ' ج.م';
    document.getElementById('mtReportTotalCommission').textContent = fmt(totalCommission) + ' ج.م';
    document.getElementById('mtReportAvgCommission').textContent = fmt(avgCommission) + ' ج.م';
    document.getElementById('mtReportTableCount').textContent = count + ' تحويل';

    // Period label
    const periodLabels = { last_day: 'اليوم', last_7: 'آخر 7 أيام', last_month: 'هذا الشهر', last_3_months: 'آخر 3 أشهر', last_year: 'آخر سنة', custom: 'فترة مخصصة' };
    const period = document.getElementById('moneyTransfersPeriodFilter')?.value || 'last_month';
    document.getElementById('mtReportPeriodLabel').textContent = periodLabels[period] || '';

    // Group by type
    const typeGroups = {};
    transfers.forEach(t => {
      const type = t.transfer_type || 'other';
      if (!typeGroups[type]) typeGroups[type] = { count: 0, amount: 0, commission: 0 };
      typeGroups[type].count++;
      typeGroups[type].amount += Number(t.transfer_amount || 0);
      typeGroups[type].commission += Number(t.commission || 0);
    });

    // Group by direction
    const dirGroups = {};
    transfers.forEach(t => {
      const dir = t.client_id ? 'deferred' : t.direction;
      if (!dirGroups[dir]) dirGroups[dir] = { count: 0, amount: 0, commission: 0 };
      dirGroups[dir].count++;
      dirGroups[dir].amount += Number(t.transfer_amount || 0);
      dirGroups[dir].commission += Number(t.commission || 0);
    });

    renderMTTypeBreakdown(typeGroups, totalAmount);
    renderMTTypeChart(typeGroups);
    renderMTDirBreakdown(dirGroups, totalAmount);
    renderMTDirChart(dirGroups);
    renderMTTrendChart(transfers, dateFrom, dateTo);
    renderMTDetailTable(transfers);
    renderMTMonthlyTable(transfers);

  } catch (error) {
    Logger.error('Error loading money transfers report:', error);
    showToast('خطأ في تحميل تقرير التحويلات', 'error');
  }
}

function renderMTTypeBreakdown(typeGroups, totalAmount) {
  const container = document.getElementById('mtReportTypeBreakdown');
  if (!container) return;

  const entries = Object.entries(typeGroups).sort((a, b) => b[1].amount - a[1].amount);
  if (entries.length === 0) {
    container.innerHTML = '<div class="empty-state" style="padding:20px;">لا توجد تحويلات</div>';
    return;
  }

  container.innerHTML = entries.map(([type, data]) => {
    const name = MT_TYPE_NAMES[type] || type;
    const color = MT_TYPE_COLORS[type] || '#64748b';
    const pct = totalAmount > 0 ? (data.amount / totalAmount * 100) : 0;
    return `
      <div style="margin-bottom:12px;">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:4px;">
          <span style="font-weight:600;font-size:13px;color:var(--text-primary);">${name}</span>
          <span style="font-size:12px;color:var(--text-muted);">${data.count} تحويل - ${fmt(data.amount)} ج.م</span>
        </div>
        <div style="background:var(--bg-tertiary);border-radius:6px;height:8px;overflow:hidden;">
          <div style="background:${color};height:100%;width:${pct}%;border-radius:6px;transition:width 0.5s;"></div>
        </div>
        <div style="font-size:11px;color:#10b981;margin-top:2px;">عمولة: ${fmt(data.commission)} ج.م (${pct.toFixed(1)}%)</div>
      </div>
    `;
  }).join('');
}

function renderMTDirBreakdown(dirGroups, totalAmount) {
  const container = document.getElementById('mtReportDirBreakdown');
  if (!container) return;

  const entries = Object.entries(dirGroups).sort((a, b) => b[1].amount - a[1].amount);
  if (entries.length === 0) {
    container.innerHTML = '<div class="empty-state" style="padding:20px;">لا توجد تحويلات</div>';
    return;
  }

  container.innerHTML = entries.map(([dir, data]) => {
    const label = MT_DIR_LABELS[dir] || dir;
    const color = MT_DIR_COLORS[dir] || '#64748b';
    const pct = totalAmount > 0 ? (data.amount / totalAmount * 100) : 0;
    return `
      <div style="margin-bottom:12px;">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:4px;">
          <span style="font-weight:600;font-size:13px;color:var(--text-primary);">${label}</span>
          <span style="font-size:12px;color:var(--text-muted);">${data.count} تحويل - ${fmt(data.amount)} ج.م</span>
        </div>
        <div style="background:var(--bg-tertiary);border-radius:6px;height:8px;overflow:hidden;">
          <div style="background:${color};height:100%;width:${pct}%;border-radius:6px;transition:width 0.5s;"></div>
        </div>
        <div style="font-size:11px;color:#10b981;margin-top:2px;">عمولة: ${fmt(data.commission)} ج.م (${pct.toFixed(1)}%)</div>
      </div>
    `;
  }).join('');
}

function renderMTTypeChart(typeGroups) {
  const ctx = document.getElementById('mtReportTypeChart');
  if (!ctx) return;
  if (charts.mtType) charts.mtType.destroy();

  const entries = Object.entries(typeGroups);
  if (entries.length === 0) return;

  charts.mtType = new Chart(ctx, {
    type: 'doughnut',
    data: {
      labels: entries.map(([t]) => MT_TYPE_NAMES[t] || t),
      datasets: [{
        data: entries.map(([, d]) => d.amount),
        backgroundColor: entries.map(([t]) => MT_TYPE_COLORS[t] || '#64748b'),
        borderWidth: 0
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: true,
      plugins: {
        legend: { position: 'bottom', labels: { color: '#94a3b8', font: { size: 12 } } },
        tooltip: {
          callbacks: {
            label: function(context) {
              const total = context.dataset.data.reduce((a, b) => a + b, 0);
              const pct = total > 0 ? (context.raw / total * 100).toFixed(1) : 0;
              return `${context.label}: ${fmt(context.raw)} ج.م (${pct}%)`;
            }
          }
        }
      }
    }
  });
}

function renderMTDirChart(dirGroups) {
  const ctx = document.getElementById('mtReportDirChart');
  if (!ctx) return;
  if (charts.mtDir) charts.mtDir.destroy();

  const entries = Object.entries(dirGroups);
  if (entries.length === 0) return;

  charts.mtDir = new Chart(ctx, {
    type: 'doughnut',
    data: {
      labels: entries.map(([d]) => (MT_DIR_LABELS[d] || d).replace(/📥|📤|⏳/g, '').trim()),
      datasets: [{
        data: entries.map(([, d]) => d.amount),
        backgroundColor: entries.map(([d]) => MT_DIR_COLORS[d] || '#64748b'),
        borderWidth: 0
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: true,
      plugins: {
        legend: { position: 'bottom', labels: { color: '#94a3b8', font: { size: 12 } } },
        tooltip: {
          callbacks: {
            label: function(context) {
              const total = context.dataset.data.reduce((a, b) => a + b, 0);
              const pct = total > 0 ? (context.raw / total * 100).toFixed(1) : 0;
              return `${context.label}: ${fmt(context.raw)} ج.م (${pct}%)`;
            }
          }
        }
      }
    }
  });
}

function renderMTTrendChart(transfers, dateFrom, dateTo) {
  const ctx = document.getElementById('mtReportTrendChart');
  if (!ctx) return;
  if (charts.mtTrend) charts.mtTrend.destroy();

  if (!transfers || transfers.length === 0) return;

  // Group by date
  const dailyData = {};
  transfers.forEach(t => {
    const date = (t.created_at || '').split(' ')[0].split('T')[0];
    if (!dailyData[date]) dailyData[date] = { commission: 0, amount: 0, count: 0 };
    dailyData[date].commission += Number(t.commission || 0);
    dailyData[date].amount += Number(t.transfer_amount || 0);
    dailyData[date].count++;
  });

  const sortedDates = Object.keys(dailyData).sort();
  const labels = sortedDates.map(d => {
    const date = new Date(d);
    return date.toLocaleDateString('ar-EG', { month: 'short', day: 'numeric' });
  });

  charts.mtTrend = new Chart(ctx, {
    type: 'line',
    data: {
      labels: labels,
      datasets: [
        {
          label: 'العمولات',
          data: sortedDates.map(d => dailyData[d].commission),
          borderColor: '#10b981',
          backgroundColor: 'rgba(16, 185, 129, 0.1)',
          fill: true,
          tension: 0.4,
          pointRadius: 4
        },
        {
          label: 'المبالغ',
          data: sortedDates.map(d => dailyData[d].amount),
          borderColor: '#8b5cf6',
          backgroundColor: 'rgba(139, 92, 246, 0.1)',
          fill: true,
          tension: 0.4,
          pointRadius: 4
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { labels: { color: '#94a3b8' } },
        tooltip: { callbacks: { label: (ctx) => `${ctx.dataset.label}: ${fmt(ctx.raw)} ج.م` } }
      },
      scales: {
        x: { ticks: { color: '#64748b' }, grid: { color: 'rgba(255,255,255,0.05)' } },
        y: { ticks: { color: '#64748b', callback: v => fmt(v, 0) }, grid: { color: 'rgba(255,255,255,0.05)' } }
      }
    }
  });
}

function renderMTDetailTable(transfers) {
  const tbody = document.getElementById('mtReportTableBody');
  if (!tbody) return;

  if (!transfers || transfers.length === 0) {
    tbody.innerHTML = '<tr><td colspan="13" class="empty-state">لا توجد تحويلات في هذه الفترة</td></tr>';
    return;
  }

  const sorted = [...transfers].sort((a, b) => new Date(b.created_at) - new Date(a.created_at));

  tbody.innerHTML = sorted.map((t, i) => {
    const date = t.created_at ? new Date(t.created_at) : new Date();
    const dateStr = date.toLocaleDateString('ar-EG', { year: 'numeric', month: 'short', day: 'numeric' });
    const timeStr = date.toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' });
    const typeName = MT_TYPE_NAMES[t.transfer_type] || t.transfer_type;
    const typeColor = MT_TYPE_COLORS[t.transfer_type] || '#64748b';
    const isDeferred = !!t.client_id;
    const dirText = isDeferred ? 'آجل' : (t.direction === 'deposit' ? 'إيداع' : 'سحب');
    const dirColor = isDeferred ? '#a78bfa' : (t.direction === 'deposit' ? '#10b981' : '#f59e0b');
    const customerName = isDeferred ? escapeHtml(t.client_name || '-') : escapeHtml(t.customer_name || '-');
    const customerPhone = escapeHtml(t.customer_phone || '-');

    return `
      <tr>
        <td>${i + 1}</td>
        <td>${dateStr}</td>
        <td>${timeStr}</td>
        <td><span class="badge" style="background:${typeColor}20;color:${typeColor};padding:2px 8px;border-radius:6px;font-size:11px;">${typeName}</span></td>
        <td><span style="color:${dirColor};font-weight:700;">${dirText}</span></td>
        <td style="font-weight:800;">${fmt(t.transfer_amount)} ج.م</td>
        <td style="color:var(--success);font-weight:700;">${fmt(t.commission)} ج.م</td>
        <td>${customerName}</td>
        <td style="font-size:12px;">${customerPhone}</td>
        <td style="font-size:12px;">${escapeHtml(t.from_wallet_name || '-')}</td>
        <td style="font-size:12px;">${isDeferred ? 'حساب العميل' : escapeHtml(t.to_wallet_name || '-')}</td>
        <td style="font-size:12px;color:var(--text-muted);">${escapeHtml(t.username || '-')}</td>
        <td style="font-size:12px;color:var(--text-muted);">${escapeHtml(t.notes || '-')}</td>
      </tr>
    `;
  }).join('');
}

function renderMTMonthlyTable(transfers) {
  const tbody = document.getElementById('mtReportMonthlyBody');
  if (!tbody) return;

  if (!transfers || transfers.length === 0) {
    tbody.innerHTML = '<tr><td colspan="6" class="empty-state">لا توجد تحويلات</td></tr>';
    return;
  }

  // Group by month
  const monthly = {};
  transfers.forEach(t => {
    const date = (t.created_at || '').split(' ')[0].split('T')[0];
    const month = date.substring(0, 7); // YYYY-MM
    if (!monthly[month]) monthly[month] = { count: 0, amount: 0, commission: 0, maxAmount: 0 };
    monthly[month].count++;
    monthly[month].amount += Number(t.transfer_amount || 0);
    monthly[month].commission += Number(t.commission || 0);
    if (Number(t.transfer_amount || 0) > monthly[month].maxAmount) {
      monthly[month].maxAmount = Number(t.transfer_amount || 0);
    }
  });

  const sortedMonths = Object.keys(monthly).sort().reverse();

  const monthNames = ['يناير', 'فبراير', 'مارس', 'أبريل', 'مايو', 'يونيو', 'يوليو', 'أغسطس', 'سبتمبر', 'أكتوبر', 'نوفمبر', 'ديسمبر'];

  tbody.innerHTML = sortedMonths.map(month => {
    const data = monthly[month];
    const [year, m] = month.split('-');
    const monthName = monthNames[parseInt(m) - 1] + ' ' + year;
    const avg = data.count > 0 ? data.commission / data.count : 0;

    return `
      <tr>
        <td style="font-weight:700;">${monthName}</td>
        <td>${data.count}</td>
        <td style="font-weight:700;">${fmt(data.amount)} ج.م</td>
        <td style="color:var(--success);font-weight:700;">${fmt(data.commission)} ج.م</td>
        <td>${fmt(avg)} ج.م</td>
        <td>${fmt(data.maxAmount)} ج.م</td>
      </tr>
    `;
  }).join('');
}

function exportMoneyTransfersReport() {
  const { dateFrom, dateTo } = getReportFilterDates('moneyTransfers');
  const typeFilter = document.getElementById('mtReportTypeFilter')?.value || '';

  let url = `elos-db://money-transfers?from=${dateFrom}&to=${dateTo}`;
  if (typeFilter) url += `&transfer_type=${typeFilter}`;

  fetch(url)
    .then(r => r.json())
    .then(transfers => {
      const data = transfers.map(t => ({
        'التاريخ': (t.created_at || '').split(' ')[0],
        'الوقت': (t.created_at || '').split(' ')[1] || '',
        'النوع': MT_TYPE_NAMES[t.transfer_type] || t.transfer_type,
        'الاتجاه': t.client_id ? 'آجل' : (t.direction === 'deposit' ? 'إيداع' : 'سحب'),
        'المبلغ': Number(t.transfer_amount || 0),
        'العمولة': Number(t.commission || 0),
        'العميل': t.client_name || t.customer_name || '',
        'الهاتف': t.customer_phone || '',
        'من محفظة': t.from_wallet_name || '',
        'إلى محفظة': t.to_wallet_name || '',
        'المستخدم': t.username || '',
        'ملاحظات': t.notes || ''
      }));

      exportToCSV(data, `تحويلات_الاموال_${dateFrom}_${dateTo}.csv`);
      showToast('تم تصدير التقرير بنجاح', 'success');
    })
    .catch(err => {
      Logger.error('Error exporting transfers report:', err);
      showToast('خطأ في تصدير التقرير', 'error');
    });
}
