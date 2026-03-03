/**
 * General Accounts Page
 * صفحة الحسابات العامة
 */

// Logger fallback
if (!window.Logger) {
  window.Logger = {
    log: console.log,
    warn: console.warn,
    error: console.error,
    debug: () => {},
    info: console.info
  };
}

let accountsData = null;

// ═══════════════════════════════════════
// 🔄 Load Accounts Summary
// ═══════════════════════════════════════
async function loadAccountsSummary() {
  try {
    Logger.log('[GENERAL_ACCOUNTS] Loading summary...');
    
    const response = await fetch('elos-db://general-accounts-summary');
    
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    
    const result = await response.json();
    
    if (!result.success) {
      throw new Error(result.error || 'فشل جلب البيانات');
    }
    
    accountsData = result;
    Logger.log('[GENERAL_ACCOUNTS] Data loaded:', result);
    
    // Update summary cards
    updateSummaryCards(result.summary);
    
    // Update tables
    updateClientsTable(result.clients || []);
    updateSuppliersTable(result.suppliers || []);
    updateWalletsGrid(result.safeWallets || []);
    updatePartnersTable(result.partners || []);
    
    if (window.showNotification) {
      showNotification('تم تحديث البيانات بنجاح', 'success');
    }
    
  } catch (error) {
    Logger.error('[GENERAL_ACCOUNTS] Error loading summary:', error);
    
    // Show error in containers
    document.getElementById('clientsTableContainer').innerHTML = `
      <div class="empty-state">
        <div class="empty-state-icon">⚠️</div>
        <div class="empty-state-text">حدث خطأ في جلب البيانات</div>
        <div style="margin-top: 12px; font-size: 13px; color: var(--muted);">${error.message}</div>
      </div>
    `;
    
    if (window.showNotification) {
      showNotification('فشل تحميل البيانات: ' + error.message, 'error');
    }
  }
}

// ═══════════════════════════════════════
// 📊 Update Summary Cards
// ═══════════════════════════════════════
function updateSummaryCards(summary) {
  // Clients
  const clientsBalance = Number(summary.totalClientsBalance || 0);
  const clientsElement = document.getElementById('totalClientsBalance');
  clientsElement.textContent = clientsBalance.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  clientsElement.className = 'summary-card-value' + (clientsBalance >= 0 ? ' positive' : ' negative');
  
  document.getElementById('clientsCount').textContent = `${summary.clientsCount || 0} عميل`;
  
  // Suppliers
  const suppliersBalance = Number(summary.totalSuppliersBalance || 0);
  const suppliersElement = document.getElementById('totalSuppliersBalance');
  suppliersElement.textContent = Math.abs(suppliersBalance).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  suppliersElement.className = 'summary-card-value' + (suppliersBalance >= 0 ? ' negative' : ' positive');
  
  document.getElementById('suppliersCount').textContent = `${summary.suppliersCount || 0} مورد`;
  
  // Safe
  const safeBalance = Number(summary.totalSafeBalance || 0);
  const safeElement = document.getElementById('totalSafeBalance');
  safeElement.textContent = safeBalance.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  safeElement.className = 'summary-card-value' + (safeBalance >= 0 ? ' positive' : ' negative');
  
  const walletsCount = summary.safeWallets?.length || 0;
  document.getElementById('safeWalletsCount').textContent = `${walletsCount} محفظة`;
  
  // Partners
  const partnersBalance = Number(summary.totalPartnersBalance || 0);
  const partnersElement = document.getElementById('totalPartnersBalance');
  partnersElement.textContent = partnersBalance.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  partnersElement.className = 'summary-card-value' + (partnersBalance >= 0 ? ' positive' : ' negative');
  
  document.getElementById('partnersCount').textContent = `${summary.partnersCount || 0} شريك`;
}

// ═══════════════════════════════════════
// 👥 Update Clients Table
// ═══════════════════════════════════════
function updateClientsTable(clients) {
  const container = document.getElementById('clientsTableContainer');
  
  if (!clients || clients.length === 0) {
    container.innerHTML = `
      <div class="empty-state">
        <div class="empty-state-icon">👥</div>
        <div class="empty-state-text">لا توجد أرصدة للعملاء</div>
      </div>
    `;
    return;
  }
  
  const tableHTML = `
    <table>
      <thead>
        <tr>
          <th>#</th>
          <th>الاسم</th>
          <th>الهاتف</th>
          <th>الرصيد</th>
        </tr>
      </thead>
      <tbody>
        ${clients.map((client, index) => {
          const balance = Number(client.balance || 0);
          const balanceClass = balance >= 0 ? 'positive' : 'negative';
          const balanceText = Math.abs(balance).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
          
          return `
            <tr onclick="window.location.href='./clients.html?id=${client.id}'">
              <td>${index + 1}</td>
              <td>${escapeHtml(client.name || '-')}</td>
              <td>${escapeHtml(client.phone || '-')}</td>
              <td class="balance-cell ${balanceClass}">${balance >= 0 ? '+' : '-'} ${balanceText} ج.م</td>
            </tr>
          `;
        }).join('')}
      </tbody>
    </table>
  `;
  
  container.innerHTML = tableHTML;
}

// ═══════════════════════════════════════
// 🚚 Update Suppliers Table
// ═══════════════════════════════════════
function updateSuppliersTable(suppliers) {
  const container = document.getElementById('suppliersTableContainer');
  
  if (!suppliers || suppliers.length === 0) {
    container.innerHTML = `
      <div class="empty-state">
        <div class="empty-state-icon">🚚</div>
        <div class="empty-state-text">لا توجد أرصدة للموردين</div>
      </div>
    `;
    return;
  }
  
  const tableHTML = `
    <table>
      <thead>
        <tr>
          <th>#</th>
          <th>الاسم</th>
          <th>الهاتف</th>
          <th>الرصيد</th>
        </tr>
      </thead>
      <tbody>
        ${suppliers.map((supplier, index) => {
          const balance = Number(supplier.balance || 0);
          // للموردين: الرصيد الإيجابي يعني أننا مدينون لهم (دين)
          const balanceClass = balance >= 0 ? 'negative' : 'positive';
          const balanceText = Math.abs(balance).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
          
          return `
            <tr onclick="window.location.href='./suppliers.html?id=${supplier.id}'">
              <td>${index + 1}</td>
              <td>${escapeHtml(supplier.name || '-')}</td>
              <td>${escapeHtml(supplier.phone || '-')}</td>
              <td class="balance-cell ${balanceClass}">${balance >= 0 ? '-' : '+'} ${balanceText} ج.م</td>
            </tr>
          `;
        }).join('')}
      </tbody>
    </table>
  `;
  
  container.innerHTML = tableHTML;
}

// ═══════════════════════════════════════
// 🏦 Update Wallets Grid
// ═══════════════════════════════════════
function updateWalletsGrid(wallets) {
  const container = document.getElementById('walletsGrid');
  
  if (!wallets || wallets.length === 0) {
    container.innerHTML = `
      <div class="empty-state">
        <div class="empty-state-icon">🏦</div>
        <div class="empty-state-text">لا توجد محافظ</div>
      </div>
    `;
    return;
  }
  
  const walletTypeNames = {
    'cash': 'كاش',
    'mobile_wallet': 'محفظة إلكترونية',
    'bank': 'بنك'
  };
  
  const walletsHTML = wallets.map(wallet => {
    const balance = Number(wallet.balance || 0);
    const balanceClass = balance >= 0 ? 'positive' : 'negative';
    const balanceText = Math.abs(balance).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    
    return `
      <div class="wallet-card" onclick="window.location.href='./safe.html'">
        <div class="wallet-header">
          <div class="wallet-name">${escapeHtml(wallet.name || '-')}</div>
          <div class="wallet-type">${walletTypeNames[wallet.type] || wallet.type}</div>
        </div>
        <div class="wallet-balance ${balanceClass}">${balance >= 0 ? '+' : '-'} ${balanceText} ج.م</div>
        ${wallet.is_default ? '<div style="margin-top: 8px; font-size: 11px; color: var(--accent);">افتراضية</div>' : ''}
      </div>
    `;
  }).join('');
  
  container.innerHTML = walletsHTML;
}

// ═══════════════════════════════════════
// 🤝 Update Partners Table
// ═══════════════════════════════════════
function updatePartnersTable(partners) {
  const container = document.getElementById('partnersTableContainer');
  
  if (!partners || partners.length === 0) {
    container.innerHTML = `
      <div class="empty-state">
        <div class="empty-state-icon">🤝</div>
        <div class="empty-state-text">لا يوجد شركاء نشطين</div>
      </div>
    `;
    return;
  }
  
  const tableHTML = `
    <table>
      <thead>
        <tr>
          <th>#</th>
          <th>الاسم</th>
          <th>الهاتف</th>
          <th>الاستثمار</th>
          <th>السحوبات</th>
          <th>الأرباح</th>
          <th>الرصيد</th>
        </tr>
      </thead>
      <tbody>
        ${partners.map((partner, index) => {
          const investment = Number(partner.investment_amount || 0);
          const withdrawals = Number(partner.total_withdrawals || 0);
          const profit = Number(partner.profit_share_devices || 0) + Number(partner.profit_share_accessories || 0);
          const balance = Number(partner.balance || 0);
          const balanceClass = balance >= 0 ? 'positive' : 'negative';
          
          return `
            <tr onclick="window.location.href='./partners.html?id=${partner.id}'">
              <td>${index + 1}</td>
              <td>${escapeHtml(partner.name || '-')}</td>
              <td>${escapeHtml(partner.phone || '-')}</td>
              <td>${investment.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ج.م</td>
              <td>${withdrawals.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ج.م</td>
              <td>${profit.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ج.م</td>
              <td class="balance-cell ${balanceClass}">${balance >= 0 ? '+' : '-'} ${Math.abs(balance).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ج.م</td>
            </tr>
          `;
        }).join('')}
      </tbody>
    </table>
  `;
  
  container.innerHTML = tableHTML;
}

// ═══════════════════════════════════════
// 🔧 Utility Functions
// ═══════════════════════════════════════
function escapeHtml(text) {
  if (!text) return '-';
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

function formatDate(dateString) {
  if (!dateString) return '-';
  try {
    const date = new Date(dateString);
    return date.toLocaleDateString('ar-EG', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  } catch (e) {
    return dateString;
  }
}

// ═══════════════════════════════════════
// 🚀 Initialize
// ═══════════════════════════════════════
document.addEventListener('DOMContentLoaded', () => {
  Logger.log('[GENERAL_ACCOUNTS] Page loaded, initializing...');
  loadAccountsSummary();
  
  // Auto refresh every 5 minutes
  setInterval(() => {
    Logger.log('[GENERAL_ACCOUNTS] Auto-refreshing...');
    loadAccountsSummary();
  }, 5 * 60 * 1000);
});
