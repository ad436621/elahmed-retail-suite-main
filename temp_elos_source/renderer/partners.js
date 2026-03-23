// ═══════════════════════════════════════════════════════════════
// 🤝 PARTNERS MANAGEMENT SYSTEM v2.0
// With Profit Distribution System
// ═══════════════════════════════════════════════════════════════

// Fallbacks if utils.js not loaded yet
if (!window.Logger) window.Logger = { log: () => {}, warn: () => {}, error: console.error, debug: () => {}, info: () => {} };
if (!window.fmt) window.fmt = (n, decimals = 2) => Number(n || 0).toLocaleString('en-US', { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
if (!window.escapeHtml) window.escapeHtml = (text) => { if (text === null || text === undefined) return ''; const div = document.createElement('div'); div.textContent = String(text); return div.innerHTML; };
const fmt = window.fmt;
const escapeHtml = window.escapeHtml;

let partners = [];
let currentPartnerId = null;
let currentEditingPartnerId = null;
let calculatedDistributions = [];

// ═══════════════════════════════════════
// ⏰ HEADER CLOCK
// ═══════════════════════════════════════
function initHeaderClock() {
  const updateClock = () => {
    const now = new Date();
    const hours = String(now.getHours()).padStart(2, '0');
    const minutes = String(now.getMinutes()).padStart(2, '0');
    const seconds = String(now.getSeconds()).padStart(2, '0');
    
    const el = document.getElementById('headerTime');
    if (el) el.textContent = `${hours}:${minutes}:${seconds}`;
    
    const days = ['الأحد', 'الإثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت'];
    const dateEl = document.getElementById('headerDate');
    if (dateEl) {
      dateEl.textContent = `${days[now.getDay()]} ${now.getDate()}/${now.getMonth() + 1}/${now.getFullYear()}`;
    }
  };
  
  updateClock();
  // ✅ استخدام IntervalManager لمنع تراكم الـ intervals
  if (window.IntervalManager) {
    window.IntervalManager.set('partners-clock', updateClock, 1000);
  } else {
    if (window._partnersClockInterval) clearInterval(window._partnersClockInterval);
    window._partnersClockInterval = setInterval(updateClock, 1000);
  }
}

// ═══════════════════════════════════════
// 🚀 Initialize
// ═══════════════════════════════════════
(async function init() {
  Logger.log('🤝 Partners System v2.0 - Initializing...');
  
  initHeaderClock();
  setDefaultMonth();
  
  await loadPartners();
  updateStats();
  
  Logger.log('✅ Partners System Ready!');
})();

function setDefaultMonth() {
  const now = new Date();
  // Set to previous month by default
  now.setMonth(now.getMonth() - 1);
  const month = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  const el = document.getElementById('profitMonth');
  if (el) el.value = month;
}

// ═══════════════════════════════════════
// 📊 Load Partners
// ═══════════════════════════════════════
async function loadPartners() {
  try {
    const res = await fetch('elos-db://partners');
    if (!res.ok) throw new Error(await res.text());
    
    partners = await res.json();
    renderPartners();
  } catch (error) {
    Logger.error('Error loading partners:', error);
    showNotification('حدث خطأ أثناء تحميل البيانات', 'error');
  }
}

// ═══════════════════════════════════════
// 🎨 Render Partners Table
// ═══════════════════════════════════════
function renderPartners() {
  const tbody = document.getElementById('partnersBody');
  
  if (!partners || partners.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="10" class="empty-state">
          <div class="empty-state-icon">🤝</div>
          <div>لا توجد بيانات شركاء حالياً</div>
        </td>
      </tr>
    `;
    return;
  }

  tbody.innerHTML = partners.map((p, idx) => {
    const typeLabels = {
      devices: '📱 أجهزة',
      accessories: '🎧 إكسسوارات',
      both: '📱🎧 أجهزة+إكسسوارات',
      repair_parts: '🔩 قطع غيار',
      repairs: '🔧 صيانة'
    };
    const typeClass = p.partnership_type || 'both';
    const statusClass = p.status || 'active';
    const statusLabels = { active: 'نشط', paused: 'متوقف', ended: 'منتهي' };
    
    return `
      <tr>
        <td>${idx + 1}</td>
        <td><strong>${escapeHtml(p.name)}</strong></td>
        <td>${escapeHtml(p.phone || '-')}</td>
        <td><span class="type-badge ${typeClass}">${typeLabels[typeClass] || typeClass}</span></td>
        <td>${Number(p.profit_share_devices || 0).toFixed(1)}%</td>
        <td>${Number(p.profit_share_accessories || 0).toFixed(1)}%</td>
        <td>${Number(p.profit_share_repair_parts ?? 0).toFixed(1)}%</td>
        <td>${Number(p.profit_share_repairs ?? 0).toFixed(1)}%</td>
        <td style="color: var(--success)">${Number(p.investment_amount || 0).toLocaleString()}</td>
        <td style="color: var(--danger)">${Number(p.total_withdrawals || 0).toLocaleString()}</td>
        <td><span class="status-badge ${statusClass}">${statusLabels[statusClass]}</span></td>
        <td class="actions-cell">
          <button class="btn btn-sm btn-primary" onclick="openEditModal(${p.id})" title="تعديل">
            <span class="btn-icon">✏️</span>
            <span class="btn-text">تعديل</span>
          </button>
          <button class="btn btn-sm btn-success" onclick="viewTransactions(${p.id})" title="المعاملات">
            <span class="btn-icon">💰</span>
            <span class="btn-text">المعاملات</span>
          </button>
          <button class="btn btn-sm btn-danger" onclick="deletePartner(${p.id})" title="حذف">
            <span class="btn-icon">🗑️</span>
            <span class="btn-text">حذف</span>
          </button>
        </td>
      </tr>
    `;
  }).join('');
}

// ═══════════════════════════════════════
// 📊 Update Statistics
// ═══════════════════════════════════════
function updateStats() {
  const totalPartners = partners.filter(p => p.status === 'active').length;
  const totalInvestments = partners.reduce((sum, p) => sum + (p.investment_amount || 0), 0);
  const totalWithdrawals = partners.reduce((sum, p) => sum + (p.total_withdrawals || 0), 0);
  const netBalance = totalInvestments - totalWithdrawals;

  document.getElementById('totalPartners').textContent = totalPartners;
  document.getElementById('totalInvestments').textContent = formatNumber(totalInvestments);
  document.getElementById('totalWithdrawals').textContent = formatNumber(totalWithdrawals);
  document.getElementById('netBalance').textContent = formatNumber(netBalance);
}

function formatNumber(num) {
  if (num >= 1000000) return (num / 1000000).toFixed(1) + 'M';
  if (num >= 1000) return (num / 1000).toFixed(0) + 'k';
  return num.toFixed(0);
}

// ═══════════════════════════════════════
// 📱 Partnership Type Selection
// ═══════════════════════════════════════
function selectPartnershipType(type) {
  document.querySelectorAll('.partnership-type-btn').forEach(btn => {
    btn.classList.remove('active');
  });
  const btn = document.querySelector(`.partnership-type-btn[data-type="${type}"]`);
  if (btn) btn.classList.add('active');
  document.getElementById('partnershipType').value = type;
  
  const devicesGroup = document.getElementById('devicesShareGroup');
  const accessoriesGroup = document.getElementById('accessoriesShareGroup');
  const repairPartsGroup = document.getElementById('repairPartsShareGroup');
  const repairsGroup = document.getElementById('repairsShareGroup');
  
  devicesGroup.style.display = 'none';
  accessoriesGroup.style.display = 'none';
  if (repairPartsGroup) repairPartsGroup.style.display = 'none';
  if (repairsGroup) repairsGroup.style.display = 'none';
  
  if (type === 'devices') {
    devicesGroup.style.display = 'block';
    document.getElementById('profitShareAccessories').value = 0;
    if (document.getElementById('profitShareRepairParts')) document.getElementById('profitShareRepairParts').value = 0;
    if (document.getElementById('profitShareRepairs')) document.getElementById('profitShareRepairs').value = 0;
  } else if (type === 'accessories') {
    accessoriesGroup.style.display = 'block';
    document.getElementById('profitShareDevices').value = 0;
    if (document.getElementById('profitShareRepairParts')) document.getElementById('profitShareRepairParts').value = 0;
    if (document.getElementById('profitShareRepairs')) document.getElementById('profitShareRepairs').value = 0;
  } else if (type === 'repair_parts') {
    if (repairPartsGroup) repairPartsGroup.style.display = 'block';
    document.getElementById('profitShareDevices').value = 0;
    document.getElementById('profitShareAccessories').value = 0;
    if (document.getElementById('profitShareRepairs')) document.getElementById('profitShareRepairs').value = 0;
  } else if (type === 'repairs') {
    if (repairsGroup) repairsGroup.style.display = 'block';
    document.getElementById('profitShareDevices').value = 0;
    document.getElementById('profitShareAccessories').value = 0;
    if (document.getElementById('profitShareRepairParts')) document.getElementById('profitShareRepairParts').value = 0;
  } else {
    devicesGroup.style.display = 'block';
    accessoriesGroup.style.display = 'block';
    if (document.getElementById('profitShareRepairParts')) document.getElementById('profitShareRepairParts').value = 0;
    if (document.getElementById('profitShareRepairs')) document.getElementById('profitShareRepairs').value = 0;
  }
}

// ═══════════════════════════════════════
// ➕ Open Add Modal
// ═══════════════════════════════════════
function openAddModal() {
  currentEditingPartnerId = null;
  document.getElementById('modalTitle').innerHTML = '<span>🤝</span><span>إضافة شريك جديد</span>';
  document.getElementById('partnerForm').reset();
  document.getElementById('partnerId').value = '';
  document.getElementById('partnershipType').value = 'both';
  
  // Reset partnership type selection
  document.querySelectorAll('.partnership-type-btn').forEach(btn => btn.classList.remove('active'));
  document.querySelector('.partnership-type-btn[data-type="both"]').classList.add('active');
  document.getElementById('devicesShareGroup').style.display = 'block';
  document.getElementById('accessoriesShareGroup').style.display = 'block';
  const rpGroup = document.getElementById('repairPartsShareGroup');
  const repGroup = document.getElementById('repairsShareGroup');
  if (rpGroup) rpGroup.style.display = 'none';
  if (repGroup) repGroup.style.display = 'none';
  
  // Set default date
  document.getElementById('agreementStartDate').value = new Date().toISOString().split('T')[0];
  
  document.getElementById('partnerModal').classList.add('show');
}

// ═══════════════════════════════════════
// ✏️ Open Edit Modal
// ═══════════════════════════════════════
function openEditModal(id) {
  const partner = partners.find(p => p.id === id);
  if (!partner) return;

  currentEditingPartnerId = id;
  document.getElementById('modalTitle').innerHTML = '<span>✏️</span><span>تعديل بيانات الشريك</span>';
  document.getElementById('partnerId').value = partner.id;
  document.getElementById('name').value = partner.name;
  document.getElementById('phone').value = partner.phone || '';
  document.getElementById('email').value = partner.email || '';
  document.getElementById('investmentAmount').value = partner.investment_amount || 0;
  document.getElementById('profitShareDevices').value = partner.profit_share_devices || 0;
  document.getElementById('profitShareAccessories').value = partner.profit_share_accessories || 0;
  const profitShareRepairPartsEl = document.getElementById('profitShareRepairParts');
  const profitShareRepairsEl = document.getElementById('profitShareRepairs');
  if (profitShareRepairPartsEl) profitShareRepairPartsEl.value = partner.profit_share_repair_parts ?? 0;
  if (profitShareRepairsEl) profitShareRepairsEl.value = partner.profit_share_repairs ?? 0;
  document.getElementById('agreementStartDate').value = partner.agreement_start_date || '';
  document.getElementById('agreementEndDate').value = partner.agreement_end_date || '';
  document.getElementById('agreementTerms').value = partner.agreement_terms || '';
  document.getElementById('notes').value = partner.notes || '';
  
  // Set partnership type
  const type = partner.partnership_type || 'both';
  document.getElementById('partnershipType').value = type;
  selectPartnershipType(type);
  
  document.getElementById('partnerModal').classList.add('show');
}

// ═══════════════════════════════════════
// ❌ Close Modal
// ═══════════════════════════════════════
function closeModal() {
  document.getElementById('partnerModal').classList.remove('show');
  document.getElementById('partnerForm').reset();
  currentEditingPartnerId = null;
}

// ═══════════════════════════════════════
// 💾 Handle Form Submit
// ═══════════════════════════════════════
async function handleSubmit(event) {
  event.preventDefault();

  const partnershipType = document.getElementById('partnershipType').value;
  
  const data = {
    name: document.getElementById('name').value.trim(),
    phone: document.getElementById('phone').value.trim(),
    email: document.getElementById('email').value.trim(),
    partnership_type: partnershipType,
    profit_share_devices: Number(document.getElementById('profitShareDevices').value) || 0,
    profit_share_accessories: Number(document.getElementById('profitShareAccessories').value) || 0,
    profit_share_repair_parts: Number(document.getElementById('profitShareRepairParts')?.value) || 0,
    profit_share_repairs: Number(document.getElementById('profitShareRepairs')?.value) || 0,
    investment_amount: Number(document.getElementById('investmentAmount').value) || 0,
    agreement_start_date: document.getElementById('agreementStartDate').value || null,
    agreement_end_date: document.getElementById('agreementEndDate').value || null,
    agreement_terms: document.getElementById('agreementTerms').value.trim(),
    status: 'active',
    notes: document.getElementById('notes').value.trim(),
    share_percentage: Number(document.getElementById('profitShareDevices').value) || 0
  };

  if (!data.name) {
    showNotification('الرجاء إدخال اسم الشريك', 'error');
    return;
  }

  // Validate profit shares based on type
  if (partnershipType === 'devices' && data.profit_share_devices <= 0) {
    showNotification('الرجاء إدخال نسبة الربح من الأجهزة', 'error');
    return;
  }
  if (partnershipType === 'accessories' && data.profit_share_accessories <= 0) {
    showNotification('الرجاء إدخال نسبة الربح من الإكسسوارات', 'error');
    return;
  }
  if (partnershipType === 'both' && data.profit_share_devices <= 0 && data.profit_share_accessories <= 0) {
    showNotification('الرجاء إدخال نسبة الربح', 'error');
    return;
  }
  if (partnershipType === 'repair_parts' && data.profit_share_repair_parts <= 0) {
    showNotification('الرجاء إدخال نسبة الربح من قطع الغيار', 'error');
    return;
  }
  if (partnershipType === 'repairs' && data.profit_share_repairs <= 0) {
    showNotification('الرجاء إدخال نسبة الربح من الصيانة', 'error');
    return;
  }

  try {
    let res;
    if (currentEditingPartnerId) {
      data.id = currentEditingPartnerId;
      res = await fetch('elos-db://partners-update', {
        method: 'POST',
        body: JSON.stringify(data)
      });
    } else {
      res = await fetch('elos-db://partners-add', {
        method: 'POST',
        body: JSON.stringify(data)
      });
    }

    if (!res.ok) throw new Error(await res.text());

    showNotification(
      currentEditingPartnerId ? '✅ تم تحديث بيانات الشريك بنجاح' : '✅ تم إضافة الشريك بنجاح',
      'success'
    );

    closeModal();
    await loadPartners();
    updateStats();
  } catch (error) {
    Logger.error('Error saving partner:', error);
    showNotification('❌ حدث خطأ أثناء حفظ البيانات', 'error');
  }
}

// ═══════════════════════════════════════
// 🗑️ Delete Partner
// ═══════════════════════════════════════
async function deletePartner(id) {
  const partner = partners.find(p => p.id === id);
  if (!partner) return;

  // ✅ استخدام showConfirm بدلاً من confirm
  const confirmed = await showConfirm(`هل أنت متأكد من حذف الشريك "${partner.name}"؟\nسيتم حذف جميع معاملاته أيضاً.`, 'حذف', 'إلغاء', 'danger');
  if (!confirmed) {
    return;
  }

  try {
    const res = await fetch('elos-db://partners-delete', {
      method: 'POST',
      body: JSON.stringify({ id })
    });

    if (!res.ok) throw new Error(await res.text());

    showNotification('✅ تم حذف الشريك بنجاح', 'success');
    await loadPartners();
    updateStats();
  } catch (error) {
    Logger.error('Error deleting partner:', error);
    showNotification('❌ ' + (error.message || 'حدث خطأ أثناء حذف الشريك'), 'error');
  }
}

// ═══════════════════════════════════════
// 💰 View Partner Transactions
// ═══════════════════════════════════════
async function viewTransactions(partnerId) {
  currentPartnerId = partnerId;
  const partner = partners.find(p => p.id === partnerId);
  if (!partner) return;

  document.getElementById('transPartnerName').textContent = partner.name;
  document.getElementById('transactionsModal').classList.add('show');

  await loadTransactions(partnerId);
}

async function loadTransactions(partnerId) {
  try {
    const res = await fetch(`elos-db://partner-transactions?partner_id=${partnerId}`);
    if (!res.ok) throw new Error(await res.text());

    const transactions = await res.json();
    renderTransactions(transactions);
  } catch (error) {
    Logger.error('Error loading transactions:', error);
    showNotification('❌ حدث خطأ أثناء تحميل المعاملات', 'error');
  }
}

function renderTransactions(transactions) {
  const tbody = document.getElementById('transactionsBody');

  if (!transactions || transactions.length === 0) {
    tbody.innerHTML = `<tr><td colspan="5" class="empty-state">لا توجد معاملات</td></tr>`;
    return;
  }

  const typeLabels = {
    investment: '💰 استثمار',
    withdrawal: '💸 سحب',
    profit_distribution: '📊 توزيع أرباح'
  };

  tbody.innerHTML = transactions.map((t, idx) => `
    <tr>
      <td>${idx + 1}</td>
      <td>${typeLabels[t.type] || t.type}</td>
      <td style="color: ${t.type === 'withdrawal' ? 'var(--danger)' : 'var(--success)'}">
        ${Number(t.amount || 0).toLocaleString()}
      </td>
      <td>${escapeHtml(t.description || '-')}</td>
      <td>${formatDate(t.created_at)}</td>
    </tr>
  `).join('');
}

function closeTransactionsModal() {
  document.getElementById('transactionsModal').classList.remove('show');
  currentPartnerId = null;
}

// ═══════════════════════════════════════
// ➕ Add Transaction
// ═══════════════════════════════════════
function openAddTransactionModal() {
  if (!currentPartnerId) return;
  
  document.getElementById('transPartnerId').value = currentPartnerId;
  document.getElementById('transactionForm').reset();
  document.getElementById('addTransactionModal').classList.add('show');
}

function closeAddTransactionModal() {
  document.getElementById('addTransactionModal').classList.remove('show');
  document.getElementById('transactionForm').reset();
}

async function handleTransactionSubmit(event) {
  event.preventDefault();

  const data = {
    partner_id: Number(document.getElementById('transPartnerId').value),
    type: document.getElementById('transType').value,
    amount: Number(document.getElementById('transAmount').value) || 0,
    description: document.getElementById('transDescription').value.trim()
  };

  if (!data.type || data.amount <= 0) {
    showNotification('الرجاء إدخال نوع المعاملة والمبلغ', 'error');
    return;
  }

  try {
    const res = await fetch('elos-db://partner-transaction-add', {
      method: 'POST',
      body: JSON.stringify(data)
    });

    if (!res.ok) throw new Error(await res.text());

    showNotification('✅ تم إضافة المعاملة بنجاح', 'success');
    closeAddTransactionModal();
    await loadTransactions(data.partner_id);
    await loadPartners();
    updateStats();
  } catch (error) {
    Logger.error('Error adding transaction:', error);
    showNotification('❌ حدث خطأ أثناء إضافة المعاملة', 'error');
  }
}

// ═══════════════════════════════════════
// 📊 PROFIT CALCULATION
// ═══════════════════════════════════════
function openProfitModal() {
  document.getElementById('profitSummarySection').style.display = 'none';
  document.getElementById('profitModal').classList.add('show');
}

function closeProfitModal() {
  document.getElementById('profitModal').classList.remove('show');
  calculatedDistributions = [];
}

async function calculateProfits() {
  const month = document.getElementById('profitMonth').value;
  
  if (!month) {
    showNotification('الرجاء اختيار الشهر', 'error');
    return;
  }
  
  try {
    const res = await fetch('elos-db://partner-calculate-profits', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ month })
    });
    
    if (!res.ok) throw new Error(await res.text());
    
    const data = await res.json();
    
    if (!data.ok) {
      showNotification(data.error || 'لا يوجد شركاء نشطين', 'error');
      return;
    }
    
    // Update summary - أرباح إجمالية لكل فئة
    document.getElementById('devicesSalesCount').textContent = data.summary.devices_sales_count ?? 0;
    document.getElementById('devicesProfitValue').textContent = (data.summary.devices_profit_gross ?? 0).toLocaleString();
    document.getElementById('accessoriesSalesCount').textContent = data.summary.accessories_sales_count ?? 0;
    document.getElementById('accessoriesProfitValue').textContent = (data.summary.accessories_profit_gross ?? 0).toLocaleString();
    const repairPartsCountEl = document.getElementById('repairPartsSalesCount');
    const repairPartsProfitEl = document.getElementById('repairPartsProfitValue');
    const repairsCountEl = document.getElementById('repairsCount');
    const repairsProfitEl = document.getElementById('repairsProfitValue');
    if (repairPartsCountEl) repairPartsCountEl.textContent = data.summary.repair_parts_sales_count ?? 0;
    if (repairPartsProfitEl) repairPartsProfitEl.textContent = (data.summary.repair_parts_profit_gross ?? 0).toLocaleString();
    if (repairsCountEl) repairsCountEl.textContent = data.summary.repairs_count ?? 0;
    if (repairsProfitEl) repairsProfitEl.textContent = (data.summary.repairs_profit_gross ?? 0).toLocaleString();
    document.getElementById('grossProfitValue').textContent = (data.summary.gross_profit ?? 0).toLocaleString();
    // الخصومات وصافي الربح
    document.getElementById('totalExpensesValue').textContent = (data.summary.total_expenses ?? 0).toLocaleString();
    document.getElementById('totalSalariesValue').textContent = (data.summary.total_salaries ?? 0).toLocaleString();
    document.getElementById('netProfitValue').textContent = (data.summary.net_profit ?? 0).toLocaleString();
    
    // Render distributions
    calculatedDistributions = data.distributions.map(d => ({
      ...d,
      devices_sales_count: data.summary.devices_sales_count,
      accessories_sales_count: data.summary.accessories_sales_count
    }));
    
    renderDistributionList(calculatedDistributions);
    
    document.getElementById('profitSummarySection').style.display = 'block';
    
  } catch (error) {
    Logger.error('Error calculating profits:', error);
    showNotification('❌ حدث خطأ أثناء حساب الأرباح', 'error');
  }
}

function renderDistributionList(distributions) {
  const container = document.getElementById('distributionList');
  
  if (!distributions || distributions.length === 0) {
    container.innerHTML = '<div class="empty-state">لا يوجد شركاء للتوزيع</div>';
    return;
  }
  
  const typeLabels = {
    devices: '📱 أجهزة',
    accessories: '🎧 إكسسوارات',
    both: '📱🎧 أجهزة+إكسسوارات',
    repair_parts: '🔩 قطع غيار',
    repairs: '🔧 صيانة'
  };
  
  container.innerHTML = distributions.map(d => {
    const parts = [];
    if (d.partner_devices_share > 0) parts.push(`📱 ${d.partner_devices_share.toLocaleString()}`);
    if (d.partner_accessories_share > 0) parts.push(`🎧 ${d.partner_accessories_share.toLocaleString()}`);
    if ((d.partner_repair_parts_share ?? 0) > 0) parts.push(`🔩 ${d.partner_repair_parts_share.toLocaleString()}`);
    if ((d.partner_repairs_share ?? 0) > 0) parts.push(`🔧 ${d.partner_repairs_share.toLocaleString()}`);
    const breakdown = parts.join(' • ');
    const typeLabel = typeLabels[d.partnership_type] || d.partnership_type;
    return `
    <div class="distribution-item">
      <div class="distribution-avatar">🤝</div>
      <div class="distribution-info">
        <h4>${escapeHtml(d.partner_name)}</h4>
        <p>${typeLabel}${breakdown ? ' • ' + breakdown : ''}</p>
      </div>
      <div class="distribution-amount">
        <div class="distribution-amount-value">${(d.total_share ?? 0).toLocaleString()} ج.م</div>
        ${breakdown ? `<div class="distribution-amount-breakdown">${breakdown}</div>` : ''}
      </div>
    </div>
  `;
  }).join('');
}

async function confirmDistribution() {
  if (!calculatedDistributions || calculatedDistributions.length === 0) {
    showNotification('لا يوجد توزيعات للتأكيد', 'error');
    return;
  }
  
  const month = document.getElementById('profitMonth').value;
  
  // Calculate total
  const totalShare = calculatedDistributions.reduce((sum, d) => sum + d.total_share, 0);
  
  // ✅ استخدام showConfirm بدلاً من confirm
  const confirmed = await showConfirm(`هل تريد تأكيد توزيع الأرباح؟\n\nالشهر: ${month}\nإجمالي التوزيع: ${totalShare.toLocaleString()} ج.م\nعدد الشركاء: ${calculatedDistributions.length}`, 'تأكيد', 'إلغاء', 'warning');
  if (!confirmed) {
    return;
  }
  
  try {
    const res = await fetch('elos-db://partner-confirm-distribution', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        month: month,
        distributions: calculatedDistributions
      })
    });
    
    if (!res.ok) throw new Error(await res.text());
    
    const data = await res.json();
    
    if (data.ok) {
      showNotification('✅ تم تأكيد توزيع الأرباح بنجاح', 'success');
      closeProfitModal();
      await loadPartners();
      updateStats();
    }
    
  } catch (error) {
    Logger.error('Error confirming distribution:', error);
    showNotification('❌ حدث خطأ أثناء تأكيد التوزيع', 'error');
  }
}

// ═══════════════════════════════════════
// 📋 Distributions History
// ═══════════════════════════════════════
async function viewDistributions(partnerId) {
  try {
    const res = await fetch(`elos-db://partner-distributions?partner_id=${partnerId}`);
    if (!res.ok) throw new Error(await res.text());
    
    const distributions = await res.json();
    renderDistributionsHistory(distributions);
    
    document.getElementById('distributionsModal').classList.add('show');
  } catch (error) {
    Logger.error('Error loading distributions:', error);
    showNotification('❌ حدث خطأ أثناء تحميل التوزيعات', 'error');
  }
}

function renderDistributionsHistory(distributions) {
  const tbody = document.getElementById('distributionsBody');
  
  if (!distributions || distributions.length === 0) {
    tbody.innerHTML = `<tr><td colspan="7" class="empty-state">لا توجد توزيعات</td></tr>`;
    return;
  }
  
  const statusLabels = { pending: 'قيد الانتظار', paid: 'مدفوع', cancelled: 'ملغي' };
  const statusColors = { pending: 'var(--warning)', paid: 'var(--success)', cancelled: 'var(--danger)' };
  
  tbody.innerHTML = distributions.map(d => `
    <tr>
      <td>${d.month}</td>
      <td>${escapeHtml(d.partner_name)}</td>
      <td>${Number(d.devices_profit || 0).toLocaleString()}</td>
      <td>${Number(d.accessories_profit || 0).toLocaleString()}</td>
      <td>${Number(d.repair_parts_profit ?? 0).toLocaleString()}</td>
      <td>${Number(d.repairs_profit ?? 0).toLocaleString()}</td>
      <td style="color: var(--success); font-weight: 700;">${Number(d.total_share || 0).toLocaleString()}</td>
      <td style="color: ${statusColors[d.status]}">${statusLabels[d.status]}</td>
      <td>
        ${d.status === 'pending' ? `
          <button class="btn btn-sm btn-success" onclick="markAsPaid(${d.id})">✅ دفع</button>
          <button class="btn btn-sm btn-danger" onclick="cancelDistribution(${d.id})">❌</button>
        ` : '-'}
      </td>
    </tr>
  `).join('');
}

function closeDistributionsModal() {
  document.getElementById('distributionsModal').classList.remove('show');
}

async function markAsPaid(id) {
  // ✅ استخدام showConfirm بدلاً من confirm
  const confirmed = await showConfirm('هل تريد تأكيد دفع هذا التوزيع؟', 'تأكيد الدفع', 'إلغاء', 'warning');
  if (!confirmed) return;
  
  try {
    const res = await fetch('elos-db://partner-distribution-pay', {
      method: 'POST',
      body: JSON.stringify({ id })
    });
    
    if (!res.ok) throw new Error(await res.text());
    
    showNotification('✅ تم تأكيد الدفع', 'success');
    await loadPartners();
    updateStats();
  } catch (error) {
    Logger.error('Error:', error);
    showNotification('❌ حدث خطأ', 'error');
  }
}

async function cancelDistribution(id) {
  // ✅ استخدام showConfirm بدلاً من confirm
  const confirmed = await showConfirm('هل تريد إلغاء هذا التوزيع؟', 'إلغاء التوزيع', 'تراجع', 'danger');
  if (!confirmed) return;
  
  try {
    const res = await fetch('elos-db://partner-distribution-cancel', {
      method: 'POST',
      body: JSON.stringify({ id })
    });
    
    if (!res.ok) throw new Error(await res.text());
    
    showNotification('✅ تم الإلغاء', 'success');
  } catch (error) {
    Logger.error('Error:', error);
    showNotification('❌ حدث خطأ', 'error');
  }
}

// ═══════════════════════════════════════
// 💬 Notification
// ═══════════════════════════════════════
function showNotification(message, type = 'success') {
  const notification = document.getElementById('notification');
  notification.textContent = message;
  notification.className = `notification ${type} show`;

  setTimeout(() => {
    notification.classList.remove('show');
  }, 3000);
}

// ═══════════════════════════════════════
// 🔧 Utilities
// ═══════════════════════════════════════
// escapeHtml() is now imported from utils.js (window.escapeHtml)

function formatDate(dateStr) {
  if (!dateStr) return '-';
  const date = new Date(dateStr);
  return date.toLocaleDateString('ar-EG', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit'
  });
}
