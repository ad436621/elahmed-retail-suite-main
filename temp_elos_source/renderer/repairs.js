// ═══════════════════════════════════════════════════════════════
// 🔧 ELOS REPAIRS SYSTEM - Repair Tickets Management
// ═══════════════════════════════════════════════════════════════

// Logger fallback if utils.js not loaded yet
if (!window.Logger) window.Logger = { log: () => {}, warn: () => {}, error: console.error, debug: () => {}, info: () => {} };

// fmt fallback if utils.js not loaded yet
if (!window.fmt) window.fmt = (n, decimals = 2) => Number(n || 0).toLocaleString('en-US', { minimumFractionDigits: decimals, maximumFractionDigits: decimals });

// escapeHtml fallback if utils.js not loaded yet
if (!window.escapeHtml) window.escapeHtml = (text) => { if (text === null || text === undefined) return ''; const div = document.createElement('div'); div.textContent = String(text); return div.innerHTML; };

// ═══════════════════════════════════════════════════════════════
// 🛡️ GLOBAL ERROR BOUNDARIES
// ═══════════════════════════════════════════════════════════════
(function initGlobalErrorHandlers() {
  window.addEventListener('error', (event) => {
    Logger.error('🔴 Global Error:', {
      message: event.message,
      filename: event.filename,
      lineno: event.lineno,
      colno: event.colno,
      error: event.error
    });

    if (typeof showToast === 'function') {
      showToast('حدث خطأ غير متوقع', 'error');
    }

    event.preventDefault();
  });

  window.addEventListener('unhandledrejection', (event) => {
    Logger.error('🔴 Unhandled Promise Rejection:', event.reason);

    if (typeof showToast === 'function') {
      const message = event.reason?.message || 'حدث خطأ في العملية';
      showToast(message, 'error');
    }

    event.preventDefault();
  });

  Logger.log('✅ Repairs: Global error handlers initialized');
})();

// ═══════════════════════════════════════════════════════════════
// 🛡️ OVERLAY GUARD - حماية ضد تعليق المودالات
// ═══════════════════════════════════════════════════════════════
(function initOverlayGuard() {
  function cleanupStaleOverlays() {
    // تنظيف المودالات اللي بتستخدم .active (repairs-modal)
    document.querySelectorAll('.repairs-modal').forEach(modal => {
      if (!modal.classList.contains('active')) return; // مش ظاهر
      const container = modal.querySelector('.modal-content, .repairs-modal-content, [class*="content"]');
      if (container && container.offsetHeight > 0) return; // شغال فعلاً
      Logger.warn('[OverlayGuard] 🧹 تنظيف modal عالق:', modal.id);
      modal.classList.remove('active');
    });

    // تنظيف المودالات اللي بتستخدم .show (dayClosingModal, printPromptModal)
    document.querySelectorAll('.day-closing-modal-overlay.show, .print-prompt-modal-overlay.show').forEach(modal => {
      const container = modal.querySelector('[class*="content"], [class*="container"]');
      if (container && container.offsetHeight > 0) return;
      Logger.warn('[OverlayGuard] 🧹 تنظيف overlay عالق:', modal.id);
      modal.classList.remove('show');
    });

    // تنظيف أي مودال ديناميكي عالق
    document.querySelectorAll('.modal[style*="display: flex"], .modal-overlay[style*="display: flex"]').forEach(modal => {
      const container = modal.querySelector('[class*="content"], [class*="container"]');
      if (container && container.offsetHeight > 0) return;
      Logger.warn('[OverlayGuard] 🧹 تنظيف dynamic modal عالق:', modal.id);
      modal.style.display = 'none';
    });
  }

  // فحص دوري كل 3 ثواني
  setInterval(() => {
    const hasActiveModal = document.querySelector(
      '.repairs-modal.active, .day-closing-modal-overlay.show, .print-prompt-modal-overlay.show'
    );
    if (!hasActiveModal) cleanupStaleOverlays();
  }, 3000);

  // لو اليوزر ضغط على body = في overlay عالق
  document.addEventListener('click', (e) => {
    if (e.target === document.body || e.target === document.documentElement) {
      cleanupStaleOverlays();
    }
  }, true);

  Logger.log('✅ Repairs: Overlay guard initialized');
})();

// ═══════════════════════════════════════════════════════════════
// 📦 STATE
// ═══════════════════════════════════════════════════════════════
let tickets = [];
let allTickets = []; // Full source of tickets for search
let filteredTickets = []; // Current filtered view
let activeRowIndex = -1; // Keyboard navigation index
let quickSearchTerm = ''; // Current search term
let accessories = [];
let isLoading = false;
let currentRepairId = null;
let paymentWallets = []; // قائمة المحافظ المتاحة
let currentViewMode = 'table'; // 'table' or 'kanban'
let employees = []; // قائمة الموظفين (للاختيار كفني)
let technicianFilter = ''; // فلتر حسب الفني: '' = الكل، أو اسم الفني
const REPAIRS_PAGE_SIZE = 50;
let repairsCurrentPage = 1;

// Device category labels
const DEVICE_CATEGORIES = {
  'mobile': 'موبايل',
  'tablet': 'تابلت',
  'laptop': 'لابتوب',
  'desktop': 'كمبيوتر',
  'printer': 'طابعة',
  'other': 'أخرى'
};

// Status labels and classes
const STATUS_CONFIG = {
  'received': { label: 'مستلم', class: 'pending' },
  'diagnosing': { label: 'قيد الفحص', class: 'in-progress' },
  'waiting_approval': { label: 'في انتظار موافقة العميل', class: 'pending' },
  'in_repair': { label: 'تحت الصيانة', class: 'in-progress' },
  'ready': { label: 'جاهز للتسليم', class: 'ready' },
  'delivered': { label: 'تم التسليم', class: 'delivered' },
  'cancelled': { label: 'ملغي / لم يتم الإصلاح', class: 'cancelled' },
  'refunded': { label: 'مرتجع / تم الاسترداد', class: 'cancelled' },
  // Legacy statuses for backward compatibility
  'pending': { label: 'قيد الانتظار', class: 'pending' },
  'in_progress': { label: 'جاري العمل', class: 'in-progress' },
  'canceled': { label: 'ملغي / لم يتم الإصلاح', class: 'cancelled' }
};

// ═══════════════════════════════════════════════════════════════
// 🕐 TIME DISPLAY
// ═══════════════════════════════════════════════════════════════
function updateHeaderTime() {
  const timeEl = document.getElementById('headerTime');
  if (timeEl) {
    const now = new Date();
    timeEl.textContent = now.toLocaleTimeString('ar-EG', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false
    });
  }
}

// ═══════════════════════════════════════════════════════════════
// 👤 USER DISPLAY
// ═══════════════════════════════════════════════════════════════
function updateUserDisplay() {
  const user = window.currentUser || {};
  const nameEl = document.getElementById('userName');
  const roleEl = document.getElementById('userRole');
  const avatarEl = document.getElementById('userAvatar');

  if (nameEl) nameEl.textContent = user.username || user.name || 'المستخدم';

  if (roleEl) {
    const roleNames = {
      'admin': 'مدير النظام',
      'cashier': 'كاشير',
      'viewer': 'مشاهد',
      'technician': 'فني صيانة'
    };
    roleEl.textContent = roleNames[user.role] || user.role || 'مدير';
  }

  if (avatarEl && (user.username || user.name)) {
    avatarEl.textContent = (user.username || user.name).charAt(0).toUpperCase();
  }
}

// ═══════════════════════════════════════════════════════════════
// 🌐 API LAYER
// ═══════════════════════════════════════════════════════════════
async function apiRequest(url, options = {}) {
  try {
    const sessionId = localStorage.getItem('sessionId');
    const headers = {
      'Content-Type': 'application/json',
      ...(sessionId && { 'x-session-id': sessionId }),
      ...options.headers
    };

    const res = await fetch(url, { ...options, headers });
    const data = await res.json();

    if (!res.ok) {
      throw new Error(data.error || data.message || 'فشل في الاتصال');
    }

    return data;
  } catch (error) {
    Logger.error('API Error:', error);
    throw error;
  }
}

// ═══════════════════════════════════════════════════════════════
// 📊 DASHBOARD STATS
// ═══════════════════════════════════════════════════════════════
async function updateDashboardStats() {
  // Calculate stats from tickets array
  const openTickets = tickets.filter(t => 
    t.status === 'received' || 
    t.status === 'diagnosing' || 
    t.status === 'waiting_approval' || 
    t.status === 'in_repair' ||
    t.status === 'pending' || 
    t.status === 'in_progress'
  ).length;
  const ready = tickets.filter(t => t.status === 'ready').length;

  // Check user role for permissions
  const userRole = window.currentUser?.role;
  const isAdmin = userRole === 'admin' || userRole === 'super_admin';

  // Fetch today's collections, revenue, parts cost, and net profit from API
  let todayCollections = 0;
  let todayRevenue = 0;
  let todayPartsCost = 0;
  let todayNetProfit = 0;
  
  try {
    const stats = await apiRequest('elos-db://repairs/stats');
    todayCollections = stats.today_collections || 0;
    todayRevenue = stats.today_revenue || 0;
    // Only fetch financial KPIs if admin
    if (isAdmin) {
      todayPartsCost = stats.today_repair_parts_cost || 0;
      todayNetProfit = stats.today_repair_net_profit || 0;
    }
  } catch (error) {
    Logger.error('Failed to fetch repair stats:', error);
    // Fallback to 0, don't break the page
    todayCollections = 0;
    todayRevenue = 0;
    todayPartsCost = 0;
    todayNetProfit = 0;
  }

  const openEl = document.getElementById('openTicketsCount');
  const readyEl = document.getElementById('readyCount');
  const collectionsEl = document.getElementById('todayCollections');
  const revenueEl = document.getElementById('todayRevenue');
  const partsCostEl = document.getElementById('todayPartsCost');
  const netProfitEl = document.getElementById('todayNetProfit');
  const financialKPIsRow = document.getElementById('financialKPIsRow');

  if (openEl) openEl.textContent = openTickets;
  if (readyEl) readyEl.textContent = ready;
  if (collectionsEl) collectionsEl.textContent = window.fmt(todayCollections, 0);
  if (revenueEl) revenueEl.textContent = window.fmt(todayRevenue, 0);
  
  // Show/hide financial KPIs based on role
  if (financialKPIsRow) {
    financialKPIsRow.style.display = isAdmin ? 'grid' : 'none';
  }
  
  if (isAdmin) {
    if (partsCostEl) partsCostEl.textContent = window.fmt(todayPartsCost, 2) + ' ج.م';
    if (netProfitEl) {
      netProfitEl.textContent = window.fmt(todayNetProfit, 2) + ' ج.م';
      // Color code: green for positive, red for negative
      if (netProfitEl.parentElement) {
        if (todayNetProfit >= 0) {
          netProfitEl.style.color = 'var(--success)';
        } else {
          netProfitEl.style.color = 'var(--danger)';
        }
      }
    }
  }

  Logger.log('📊 Dashboard stats updated');
}

// ═══════════════════════════════════════════════════════════════
// 📑 DETAILS MODAL - TAB SYSTEM + STATUS STEPPER
// ═══════════════════════════════════════════════════════════════

let currentDetailsTab = 'tabInfo';

const STATUS_STEPS = [
  { key: 'received', label: 'مستلم', icon: '📋' },
  { key: 'diagnosing', label: 'فحص', icon: '🔍' },
  { key: 'waiting_approval', label: 'موافقة', icon: '⏳' },
  { key: 'in_repair', label: 'صيانة', icon: '🔧' },
  { key: 'ready', label: 'جاهز', icon: '✅' },
  { key: 'delivered', label: 'تسليم', icon: '📦' }
];

function switchDetailsTab(tabName) {
  document.querySelectorAll('.details-tab').forEach(t => t.classList.remove('active'));
  document.querySelectorAll('.details-tab-content').forEach(c => c.classList.remove('active'));

  const tabBtn = document.querySelector(`.details-tab[data-tab="${tabName}"]`);
  const tabContent = document.getElementById(tabName);

  if (tabBtn) tabBtn.classList.add('active');
  if (tabContent) tabContent.classList.add('active');

  currentDetailsTab = tabName;
}
window.switchDetailsTab = switchDetailsTab;

function updateStatusStepper(currentStatus) {
  const container = document.getElementById('ticketStepper');
  if (!container) return;

  const currentIndex = STATUS_STEPS.findIndex(s => s.key === currentStatus);
  const isCancelled = currentStatus === 'cancelled' || currentStatus === 'canceled';

  container.innerHTML = STATUS_STEPS.map((step, i) => {
    let stepClass = 'future';
    if (isCancelled) {
      stepClass = 'cancelled-all';
    } else if (i < currentIndex) {
      stepClass = 'completed';
    } else if (i === currentIndex) {
      stepClass = 'current';
    }

    const lineHtml = i < STATUS_STEPS.length - 1
      ? `<div class="stepper-line ${!isCancelled && i < currentIndex ? 'completed' : ''}"></div>`
      : '';

    return `
      <div class="stepper-step ${stepClass}">
        <div class="stepper-circle">${isCancelled && i === 0 ? '❌' : step.icon}</div>
        <div class="stepper-label">${isCancelled && i === 0 ? 'ملغي' : step.label}</div>
      </div>
      ${lineHtml}
    `;
  }).join('');
}

function getDefaultTab(status) {
  switch (status) {
    case 'received':
    case 'diagnosing':
      return 'tabInfo';
    case 'waiting_approval':
      return 'tabFinancial';
    case 'in_repair':
      return 'tabParts';
    case 'ready':
      return 'tabFinancial';
    case 'delivered':
    case 'cancelled':
    case 'canceled':
      return 'tabHistory';
    default:
      return 'tabInfo';
  }
}

function updateTabNotifications(remaining, hasReservedParts) {
  const financialDot = document.getElementById('tabDotFinancial');
  const partsDot = document.getElementById('tabDotParts');

  if (financialDot) {
    financialDot.style.display = (remaining && remaining > 0) ? 'block' : 'none';
  }
  if (partsDot) {
    partsDot.style.display = hasReservedParts ? 'block' : 'none';
  }
}

function populateSummaryCard(ticket) {
  const brandModel = [ticket.device_brand, ticket.device_model].filter(Boolean).join(' ');
  const categoryLabel = DEVICE_CATEGORIES[ticket.device_category] || ticket.device_category || '';
  const deviceDisplay = brandModel || categoryLabel || '-';
  const statusConfig = STATUS_CONFIG[ticket.status] || STATUS_CONFIG['received'] || {};
  const techName = (ticket.assigned_tech_name || '').trim();

  const el = (id, val) => { const e = document.getElementById(id); if (e) e.textContent = val || '-'; };
  el('summaryCustomerName', ticket.customer_name);
  el('summaryCustomerPhone', ticket.customer_phone);
  el('summaryDevice', deviceDisplay);
  el('summaryTechnician', techName || 'لم يُحدد');

  const summaryStatus = document.getElementById('summaryStatus');
  if (summaryStatus) {
    summaryStatus.innerHTML = `<span class="status-badge ${statusConfig.class}" style="font-size:11px; padding:2px 8px;">${statusConfig.label}</span>`;
  }
}

// ═══════════════════════════════════════════════════════════════
// 🎫 TICKETS TABLE
// ═══════════════════════════════════════════════════════════════
async function loadTickets() {
  const tbody = document.getElementById('ticketsBody');
  const emptyState = document.getElementById('emptyState');

  if (!tbody) return;

  try {
    isLoading = true;

    // Get filter from localStorage (default: 'original')
    const filterType = localStorage.getItem('repairsAdjustmentsFilter') || 'original';
    const filterSelect = document.getElementById('adjustmentsFilter');
    if (filterSelect) filterSelect.value = filterType;

    // Fetch tickets from API with filter
    const url = filterType === 'original' ? 'elos-db://repairs?type=original' : 
                filterType === 'adjustments' ? 'elos-db://repairs?type=adjustment' : 
                'elos-db://repairs?type=all';
    const data = await apiRequest(url);
    tickets = data.tickets || data || [];
    allTickets = tickets.slice(); // Store full source for search
    fillTechnicianFilterDropdown();
    applyRepairsQuickSearch(true); // Reset selection after loading

    // Update dashboard stats
    await updateDashboardStats();

    Logger.log('🎫 Tickets loaded:', tickets.length);
  } catch (error) {
    Logger.error('Failed to load tickets:', error);
    // Show empty state on error
    tbody.innerHTML = '';
    if (emptyState) emptyState.style.display = 'flex';
  } finally {
    isLoading = false;
  }
}

// ═══════════════════════════════════════════════════════════════
// 🔍 QUICK SEARCH
// ═══════════════════════════════════════════════════════════════
function normalizeSearch(s) {
  return String(s || '')
    .toLowerCase()
    .replace(/[٠-٩]/g, d => '0123456789'['٠١٢٣٤٥٦٧٨٩'.indexOf(d)])
    .trim();
}

function ticketSearchBlob(t) {
  return normalizeSearch([
    t.ticket_no, t.id,
    t.customer_name, t.customer_phone,
    t.assigned_tech_name,
    t.device_category, t.device_brand, t.device_model,
    t.problem_desc, t.notes, t.issue_description
  ].filter(Boolean).join(' | '));
}

function applyRepairsQuickSearch(resetSelection = false) {
  let list = allTickets.slice();
  const term = normalizeSearch(quickSearchTerm);
  if (term) {
    list = list.filter(t => ticketSearchBlob(t).includes(term));
  }
  if (technicianFilter) {
    list = list.filter(t => (t.assigned_tech_name || '').trim() === technicianFilter);
  }
  filteredTickets = list;

  const counter = document.getElementById('repairsSearchCounter');
  if (counter) counter.textContent = `عدد النتائج: ${filteredTickets.length}`;

  if (resetSelection) {
    activeRowIndex = filteredTickets.length ? 0 : -1;
    repairsCurrentPage = 1;
  } else {
    if (activeRowIndex >= filteredTickets.length) activeRowIndex = filteredTickets.length - 1;
  }

  refreshCurrentView();
}

function fillTechnicianFilterDropdown() {
  const sel = document.getElementById('technicianFilter');
  if (!sel) return;
  const currentVal = sel.value || '';
  const names = [...new Set(allTickets.map(t => (t.assigned_tech_name || '').trim()).filter(Boolean))].sort();
  sel.innerHTML = '<option value="">الكل</option>';
  names.forEach(name => {
    const opt = document.createElement('option');
    opt.value = name;
    opt.textContent = name;
    if (name === currentVal) opt.selected = true;
    sel.appendChild(opt);
  });
}

function getPaginatedTickets() {
  const total = filteredTickets.length;
  const totalPages = Math.max(1, Math.ceil(total / REPAIRS_PAGE_SIZE));
  const page = Math.min(Math.max(1, repairsCurrentPage), totalPages);
  const start = (page - 1) * REPAIRS_PAGE_SIZE;
  return {
    page,
    totalPages,
    start,
    end: Math.min(start + REPAIRS_PAGE_SIZE, total),
    total,
    tickets: filteredTickets.slice(start, start + REPAIRS_PAGE_SIZE)
  };
}

function renderRepairsPagination() {
  const wrap = document.getElementById('repairsPagination');
  if (!wrap) return;
  if (currentViewMode !== 'table') {
    wrap.style.display = 'none';
    return;
  }
  const info = wrap.querySelector('.repairs-pagination-info');
  const controls = wrap.querySelector('.repairs-pagination-controls');
  if (!info || !controls) return;

  const total = filteredTickets.length;
  if (total === 0) {
    wrap.style.display = 'none';
    return;
  }

  const { page, totalPages, start, end } = getPaginatedTickets();
  wrap.style.display = 'flex';

  info.textContent = `عرض ${start + 1} - ${end} من ${total} تذكرة • صفحة ${page} من ${totalPages}`;

  controls.innerHTML = '';
  const btnPrev = document.createElement('button');
  btnPrev.type = 'button';
  btnPrev.textContent = '← السابق';
  btnPrev.disabled = page <= 1;
  btnPrev.onclick = () => { repairsCurrentPage = Math.max(1, repairsCurrentPage - 1); refreshCurrentView(); };
  controls.appendChild(btnPrev);

  const pageNum = document.createElement('span');
  pageNum.style.fontSize = '12px';
  pageNum.style.padding = '0 8px';
  pageNum.textContent = `${page} / ${totalPages}`;
  controls.appendChild(pageNum);

  const btnNext = document.createElement('button');
  btnNext.type = 'button';
  btnNext.textContent = 'التالي →';
  btnNext.disabled = page >= totalPages;
  btnNext.onclick = () => { repairsCurrentPage = Math.min(totalPages, repairsCurrentPage + 1); refreshCurrentView(); };
  controls.appendChild(btnNext);
}

function renderTicketsTable() {
  const tbody = document.getElementById('ticketsBody');
  const emptyState = document.getElementById('emptyState');
  if (!tbody) return;

  if (filteredTickets.length === 0) {
    tbody.innerHTML = '';
    if (emptyState) emptyState.style.display = 'flex';
    renderRepairsPagination();
    updateRepairsFooter();
    return;
  }

  if (emptyState) emptyState.style.display = 'none';

  const { tickets: pageTickets, start } = getPaginatedTickets();

  tbody.innerHTML = pageTickets.map((ticket, i) => {
    const globalIndex = start + i;
    const statusConfig = STATUS_CONFIG[ticket.status] || STATUS_CONFIG['received'] || STATUS_CONFIG['pending'];
    const categoryLabel = DEVICE_CATEGORIES[ticket.device_category] || ticket.device_category || '-';
    const techName = (ticket.assigned_tech_name || '').trim() || '-';
    const createdAt = ticket.created_at ? new Date(ticket.created_at).toLocaleDateString('ar-EG') : '-';
    const isAdjustment = ticket.is_adjustment === 1;
    const ticketNoDisplay = `#${window.escapeHtml(ticket.ticket_no || ticket.id)}`;
    const adjBadge = isAdjustment ? '<span style="display: inline-block; margin-right: 6px; padding: 2px 6px; background: var(--warning); color: white; border-radius: 3px; font-size: 10px; font-weight: 600;">ADJ</span>' : '';
    const originalTicketInfo = isAdjustment && ticket.original_ticket_no ? `<div style="font-size: 11px; color: var(--text-secondary); margin-top: 2px;">أصل: #${window.escapeHtml(ticket.original_ticket_no)}</div>` : '';
    const rowActiveClass = globalIndex === activeRowIndex ? 'row-active' : '';

    return `
      <tr data-id="${ticket.id}" data-index="${globalIndex}" class="${rowActiveClass}" tabindex="-1">
        <td>
          <strong>${adjBadge}${ticketNoDisplay}</strong>
          ${originalTicketInfo}
        </td>
        <td>${window.escapeHtml(ticket.customer_name || '-')}</td>
        <td>${window.escapeHtml(categoryLabel)}</td>
        <td><span class="status-badge ${statusConfig.class}">${statusConfig.label}</span></td>
        <td>${window.escapeHtml(techName)}</td>
        <td>${createdAt}</td>
        <td>
          <button class="btn-action view" onclick="openDetailsModal(${ticket.id})">
            <span>👁️</span>
            <span>فتح</span>
          </button>
        </td>
      </tr>
    `;
  }).join('');

  renderRepairsPagination();
  updateRepairsFooter();

  if (!tbody.hasAttribute('data-search-initialized')) {
    tbody.setAttribute('data-search-initialized', 'true');
    tbody.addEventListener('click', (e) => {
      const tr = e.target.closest('tr[data-index]');
      if (!tr) return;
      activeRowIndex = parseInt(tr.getAttribute('data-index'), 10);
      renderTicketsTable();
    });
  }
}

function updateRepairsFooter() {
  const el = document.getElementById('repairsFooterCount');
  if (el) el.textContent = `${filteredTickets.length} تذكرة`;
}

// ═══════════════════════════════════════════════════════════════
// 📊 KANBAN VIEW - عرض Kanban
// ═══════════════════════════════════════════════════════════════
function switchRepairsView(viewMode) {
  currentViewMode = viewMode;

  const tableView = document.getElementById('tableView');
  const kanbanView = document.getElementById('kanbanView');
  const btnTableView = document.getElementById('btnTableView');
  const btnKanbanView = document.getElementById('btnKanbanView');
  const contentWrap = document.querySelector('.repairs-content-wrap');

  if (viewMode === 'kanban') {
    if (tableView) { tableView.style.display = 'none'; }
    if (kanbanView) { kanbanView.style.display = 'flex'; }
    if (btnTableView) btnTableView.classList.remove('active');
    if (btnKanbanView) btnKanbanView.classList.add('active');
    renderKanbanView();
  } else {
    if (kanbanView) { kanbanView.style.display = 'none'; }
    if (tableView) { tableView.style.display = 'flex'; }
    if (btnTableView) btnTableView.classList.add('active');
    if (btnKanbanView) btnKanbanView.classList.remove('active');
    // ✅ FIX: إعادة رسم الجدول عند الرجوع من الكانبان لتجنب ظهور "لا توجد تذاكر" لحظياً
    renderTicketsTable();
  }

  // إعادة حساب التخطيط بعد التبديل لتفادي مشكلة "الزوم" وعدم الأسكرول
  requestAnimationFrame(() => {
    if (contentWrap) void contentWrap.offsetHeight;
    if (tableView && tableView.style.display !== 'none') void tableView.offsetHeight;
    if (kanbanView && kanbanView.style.display !== 'none') void kanbanView.offsetHeight;
  });

  localStorage.setItem('repairs_view_mode', viewMode);
}
window.switchRepairsView = switchRepairsView;

function renderKanbanView() {
  // Group tickets by status
  const statusGroups = {
    received: [],
    diagnosing: [],
    waiting_approval: [],
    in_repair: [],
    ready: [],
    delivered: []
  };

  // Use filteredTickets to respect search
  const ticketsToRender = filteredTickets.length > 0 || quickSearchTerm ? filteredTickets : allTickets;

  ticketsToRender.forEach(ticket => {
    const status = ticket.status || 'received';
    if (statusGroups[status]) {
      statusGroups[status].push(ticket);
    }
  });

  // Render each column
  renderKanbanColumn('kanbanReceived', 'kanbanCountReceived', statusGroups.received);
  renderKanbanColumn('kanbanDiagnosing', 'kanbanCountDiagnosing', statusGroups.diagnosing);
  renderKanbanColumn('kanbanWaiting', 'kanbanCountWaiting', statusGroups.waiting_approval);
  renderKanbanColumn('kanbanInRepair', 'kanbanCountInRepair', statusGroups.in_repair);
  renderKanbanColumn('kanbanReady', 'kanbanCountReady', statusGroups.ready);
  renderKanbanColumn('kanbanDelivered', 'kanbanCountDelivered', statusGroups.delivered);
}

function renderKanbanColumn(containerId, countId, tickets) {
  const container = document.getElementById(containerId);
  const countEl = document.getElementById(countId);

  if (!container) return;

  // Update count
  if (countEl) {
    countEl.textContent = tickets.length;
  }

  if (tickets.length === 0) {
    container.innerHTML = '<div class="kanban-empty">لا توجد تذاكر</div>';
    return;
  }

  // Sort by date (newest first)
  tickets.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));

  container.innerHTML = tickets.map(ticket => {
    const customerName = window.escapeHtml(ticket.customer_name || '-');
    const ticketNo = ticket.ticket_no || ticket.id;
    const deviceCategory = DEVICE_CATEGORIES[ticket.device_category] || ticket.device_category || '-';
    const brandModel = [ticket.device_brand, ticket.device_model].filter(Boolean).join(' ') || '';
    const issue = window.escapeHtml(ticket.issue_description || '').substring(0, 80);
    const techName = (ticket.assigned_tech_name || '').trim();
    const createdAt = formatRelativeDate(ticket.created_at);

    return `
      <div class="kanban-card" onclick="openDetailsModal(${ticket.id})">
        <div class="kanban-card-header">
          <span class="kanban-card-ticket">#${ticketNo}</span>
          <span class="kanban-card-date">${createdAt}</span>
        </div>
        <div class="kanban-card-customer">${customerName}</div>
        <div class="kanban-card-device">
          <span>📱</span>
          <span>${deviceCategory}${brandModel ? ' - ' + window.escapeHtml(brandModel) : ''}</span>
        </div>
        ${techName ? `<div class="kanban-card-tech" style="font-size:11px;color:var(--text-secondary);margin-top:4px;">👤 ${window.escapeHtml(techName)}</div>` : ''}
        ${issue ? `<div class="kanban-card-issue">${issue}...</div>` : ''}
      </div>
    `;
  }).join('');
}

function formatRelativeDate(dateStr) {
  if (!dateStr) return '-';
  try {
    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = now - date;
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'الآن';
    if (diffMins < 60) return `منذ ${diffMins} دقيقة`;
    if (diffHours < 24) return `منذ ${diffHours} ساعة`;
    if (diffDays < 7) return `منذ ${diffDays} يوم`;

    return date.toLocaleDateString('ar-EG', { month: 'short', day: 'numeric' });
  } catch (e) {
    return dateStr;
  }
}

// Update Kanban or Table when tickets change
function refreshCurrentView() {
  if (currentViewMode === 'kanban') {
    renderKanbanView();
  } else {
    renderTicketsTable();
  }
  updateRepairsFooter();
}

// ═══════════════════════════════════════════════════════════════
// 👥 EMPLOYEES - جلب الموظفين للاختيار كفني
// ═══════════════════════════════════════════════════════════════
async function loadEmployees() {
  if (employees.length > 0) return employees;
  try {
    const list = await apiRequest('elos-db://employees?status=active');
    employees = Array.isArray(list) ? list : [];
    return employees;
  } catch (e) {
    Logger.warn('Failed to load employees:', e);
    employees = [];
    return employees;
  }
}

function fillTechnicianSelect(selectEl, selectedName) {
  if (!selectEl) return;
  const firstOpt = selectEl.options[0];
  selectEl.innerHTML = '';
  if (firstOpt) selectEl.appendChild(firstOpt);
  employees.forEach(emp => {
    const name = (emp.name || '').trim();
    if (!name) return;
    const opt = document.createElement('option');
    opt.value = name;
    opt.textContent = name;
    if (selectedName && name === selectedName) opt.selected = true;
    selectEl.appendChild(opt);
  });
}

// ═══════════════════════════════════════════════════════════════
// 📋 INTAKE MODAL
// ═══════════════════════════════════════════════════════════════
async function openIntakeModal() {
  const modal = document.getElementById('intakeModal');
  if (modal) {
    // Reset form
    const form = document.getElementById('intakeForm');
    if (form) form.reset();

    // Clear accessories
    accessories = [];
    renderAccessoriesList();

    // Reset quick accessories checkboxes
    document.querySelectorAll('.accessory-quick-check').forEach(cb => cb.checked = false);

    // Reset extra details section (collapse it)
    const extraContent = document.getElementById('extraDetailsContent');
    const extraIcon = document.getElementById('extraDetailsIcon');
    const extraText = document.getElementById('extraDetailsText');
    if (extraContent) extraContent.style.display = 'none';
    if (extraIcon) extraIcon.textContent = '➕';
    if (extraText) extraText.textContent = 'إظهار تفاصيل إضافية (الماركة، الموديل، IMEI، كلمة السر...)';

    // Reset deposit fields explicitly
    const depositAmountField = document.getElementById('intakeDepositAmount');
    const depositWalletField = document.getElementById('intakeDepositWallet');
    const depositWalletSelectGroup = document.getElementById('intakeDepositWalletSelectGroup');
    if (depositAmountField) depositAmountField.value = '';
    if (depositWalletField) depositWalletField.value = 'cash';
    if (depositWalletSelectGroup) depositWalletSelectGroup.style.display = 'none';

    // Load payment wallets if not loaded
    if (paymentWallets.length === 0) {
      await loadPaymentWallets();
    }

    // Load employees and fill technician dropdown (اختياري أثناء الاستلام)
    await loadEmployees();
    const intakeTechSelect = document.getElementById('intakeTechnicianSelect');
    if (intakeTechSelect) fillTechnicianSelect(intakeTechSelect, null);

    // Show modal
    modal.classList.add('active');

    // Focus first input
    setTimeout(() => {
      const firstInput = document.getElementById('customerName');
      if (firstInput) firstInput.focus();
    }, 100);
  }
}

function closeIntakeModal() {
  const modal = document.getElementById('intakeModal');
  if (modal) {
    modal.classList.remove('active');
  }
}

async function submitIntakeForm(e) {
  e.preventDefault();

  const submitBtn = document.getElementById('btnSubmitIntake');
  if (submitBtn) submitBtn.disabled = true;

  try {
    // Gather form data
    const depositAmountVal = document.getElementById('intakeDepositAmount')?.value;
    const depositAmount = depositAmountVal ? parseFloat(depositAmountVal) : 0;

    const techSelect = document.getElementById('intakeTechnicianSelect');
    const assignedTechName = techSelect?.value?.trim() || null;

    // Collect accessories from both checkboxes and manual list
    const quickAccessories = collectQuickAccessories();
    const allAccessories = [...new Set([...accessories, ...quickAccessories])]; // Remove duplicates

    const formData = {
      customer_name: document.getElementById('customerName')?.value?.trim(),
      customer_phone: document.getElementById('customerPhone')?.value?.trim() || null,
      device_category: document.getElementById('deviceCategory')?.value,
      device_brand: document.getElementById('deviceBrand')?.value?.trim() || null,
      device_model: document.getElementById('deviceModel')?.value?.trim() || null,
      imei_or_serial: document.getElementById('imeiOrSerial')?.value?.trim() || null,
      issue_description: document.getElementById('issueDescription')?.value?.trim(),
      accessories_received: allAccessories.length > 0 ? allAccessories : null,
      device_passcode: document.getElementById('devicePasscode')?.value?.trim() || null,
      notes: document.getElementById('intakeNotes')?.value?.trim() || null,
      assigned_tech_name: assignedTechName,
      deposit_amount: depositAmount > 0 ? depositAmount : null,
      deposit_wallet_id: (() => {
        if (depositAmount <= 0) return null;
        const walletType = document.getElementById('intakeDepositWallet')?.value || 'cash';
        const walletSelect = document.getElementById('intakeDepositWalletSelect');
        
        if (walletType === 'cash') {
          const defaultCashWallet = paymentWallets.find(w => w.type === 'cash' && w.is_default);
          return defaultCashWallet ? defaultCashWallet.id : null;
        } else if (walletSelect && walletSelect.value) {
          return parseInt(walletSelect.value);
        } else {
          const defaultWallet = paymentWallets.find(w => w.type === walletType && w.is_default);
          return defaultWallet ? defaultWallet.id : null;
        }
      })()
    };

    // Validate required fields
    if (!formData.customer_name) {
      if (typeof showToast === 'function') showToast('يرجى إدخال اسم العميل', 'error');
      document.getElementById('customerName')?.focus();
      return;
    }

    if (!formData.device_category) {
      if (typeof showToast === 'function') showToast('يرجى اختيار نوع الجهاز', 'error');
      document.getElementById('deviceCategory')?.focus();
      return;
    }

    if (!formData.issue_description) {
      if (typeof showToast === 'function') showToast('يرجى وصف المشكلة', 'error');
      document.getElementById('issueDescription')?.focus();
      return;
    }

    Logger.log('📋 Submitting intake form:', formData);

    // Submit to API
    const result = await apiRequest('elos-db://repairs', {
      method: 'POST',
      body: JSON.stringify(formData)
    });

    Logger.log('✅ Ticket created:', result);

    // ✅ FIX: دمج بيانات الفورم مع نتيجة الـ API عشان الطباعة تشتغل
    // الـ API بيرجع { ok, id, ticket_no, barcode } بس - مش فيه بيانات العميل/الجهاز
    const fullTicketData = {
      ...result,
      customer_name: formData.customer_name,
      customer_phone: formData.customer_phone,
      device_category: formData.device_category,
      device_brand: formData.device_brand,
      device_model: formData.device_model,
      imei_or_serial: formData.imei_or_serial,
      issue_description: formData.issue_description,
      accessories_received: formData.accessories_received,
      deposit_amount: formData.deposit_amount || 0,
      assigned_tech_name: formData.assigned_tech_name,
      device_passcode: formData.device_passcode,
      created_at: new Date().toISOString()
    };

    // Show success message
    if (typeof showToast === 'function') {
      const depositMsg = depositAmount > 0 ? ` (عربون: ${window.fmt(depositAmount, 2)})` : '';
      showToast(`تم تسجيل الاستلام بنجاح${depositMsg}`, 'success');
    }

    // Play success sound if available
    if (typeof playSound === 'function') {
      playSound('success');
    }

    // Close modal
    closeIntakeModal();

    // Reload tickets
    await loadTickets();

    // Show print prompt modal with full data
    showPrintPromptModal(fullTicketData);

  } catch (error) {
    Logger.error('Failed to submit intake form:', error);
    if (typeof showToast === 'function') {
      showToast(error.message || 'فشل في تسجيل الاستلام', 'error');
    }
  } finally {
    if (submitBtn) submitBtn.disabled = false;
  }
}

// ═══════════════════════════════════════════════════════════════
// ⚡ QUICK TEMPLATES - قوالب الأعطال الشائعة
// ═══════════════════════════════════════════════════════════════
const quickTemplates = {
  screen_broken: {
    device_category: 'mobile',
    issue_description: 'الشاشة مكسورة وتحتاج تغيير - يرجى فحص الإطار والتاتش',
    label: 'شاشة مكسورة'
  },
  battery_replace: {
    device_category: 'mobile',
    issue_description: 'البطارية ضعيفة وتنفد بسرعة - العميل يطلب تغيير البطارية',
    label: 'تغيير بطارية'
  },
  not_charging: {
    device_category: 'mobile',
    issue_description: 'الجهاز لا يشحن - يرجى فحص مدخل الشحن والشاحن والبطارية',
    label: 'لا يشحن'
  },
  water_damage: {
    device_category: 'mobile',
    issue_description: 'الجهاز سقط في الماء - يحتاج تنظيف وفحص شامل للأجزاء الداخلية',
    label: 'سقط في الماء'
  },
  software_issue: {
    device_category: 'mobile',
    issue_description: 'مشكلة في السوفتوير - الجهاز بطيء / يعلق / يعيد التشغيل تلقائياً',
    label: 'مشكلة سوفتوير'
  },
  speaker_mic: {
    device_category: 'mobile',
    issue_description: 'مشكلة في السماعة أو المايك - الصوت غير واضح / لا يسمع الطرف الآخر',
    label: 'سماعة / مايك'
  },
  camera_issue: {
    device_category: 'mobile',
    issue_description: 'مشكلة في الكاميرا - الصورة غير واضحة / الكاميرا لا تعمل',
    label: 'مشكلة كاميرا'
  },
  buttons_issue: {
    device_category: 'mobile',
    issue_description: 'الأزرار لا تعمل - زر الباور / زر الصوت / زر الهوم',
    label: 'أزرار لا تعمل'
  }
};

function applyQuickTemplate(templateKey) {
  const template = quickTemplates[templateKey];
  if (!template) return;

  // Apply template values
  const categorySelect = document.getElementById('deviceCategory');
  const issueTextarea = document.getElementById('issueDescription');

  if (categorySelect && template.device_category) {
    categorySelect.value = template.device_category;
  }

  if (issueTextarea && template.issue_description) {
    issueTextarea.value = template.issue_description;
  }

  // Highlight the selected template button
  document.querySelectorAll('.quick-template-btn').forEach(btn => {
    btn.classList.remove('active');
  });
  event.target.closest('.quick-template-btn')?.classList.add('active');

  // Show success feedback
  if (typeof showToast === 'function') {
    showToast(`✓ تم تطبيق قالب "${template.label}"`, 'success', 2000);
  }

  // Focus on customer name if empty
  const customerName = document.getElementById('customerName');
  if (customerName && !customerName.value.trim()) {
    customerName.focus();
  }
}
window.applyQuickTemplate = applyQuickTemplate;

// ═══════════════════════════════════════════════════════════════
// ➕ TOGGLE EXTRA DETAILS - إظهار/إخفاء التفاصيل الإضافية
// ═══════════════════════════════════════════════════════════════
function toggleIntakeExtraDetails() {
  const content = document.getElementById('extraDetailsContent');
  const icon = document.getElementById('extraDetailsIcon');
  const text = document.getElementById('extraDetailsText');

  if (!content) return;

  const isHidden = content.style.display === 'none';

  if (isHidden) {
    content.style.display = 'block';
    if (icon) icon.textContent = '➖';
    if (text) text.textContent = 'إخفاء التفاصيل الإضافية';
  } else {
    content.style.display = 'none';
    if (icon) icon.textContent = '➕';
    if (text) text.textContent = 'إظهار تفاصيل إضافية (الماركة، الموديل، IMEI، كلمة السر...)';
  }
}
window.toggleIntakeExtraDetails = toggleIntakeExtraDetails;

// ═══════════════════════════════════════════════════════════════
// ✅ QUICK ACCESSORIES - جمع الملحقات من الـ checkboxes
// ═══════════════════════════════════════════════════════════════
function collectQuickAccessories() {
  const quickAccessories = [];
  document.querySelectorAll('.accessory-quick-check:checked').forEach(cb => {
    if (cb.value && !accessories.includes(cb.value)) {
      quickAccessories.push(cb.value);
    }
  });
  return quickAccessories;
}

// ═══════════════════════════════════════════════════════════════
// 🏷️ ACCESSORIES LIST
// ═══════════════════════════════════════════════════════════════
function addAccessory() {
  const input = document.getElementById('accessoryInput');
  if (!input) return;

  const value = input.value.trim();
  if (!value) return;

  // Avoid duplicates
  if (!accessories.includes(value)) {
    accessories.push(value);
    renderAccessoriesList();
  }

  input.value = '';
  input.focus();
}

function removeAccessory(index) {
  accessories.splice(index, 1);
  renderAccessoriesList();
}

function renderAccessoriesList() {
  const container = document.getElementById('accessoriesList');
  const hiddenInput = document.getElementById('accessoriesReceived');

  if (!container) return;

  if (accessories.length === 0) {
    container.innerHTML = '';
  } else {
    container.innerHTML = accessories.map((acc, idx) => `
      <span class="accessory-tag">
        <span>${window.escapeHtml(acc)}</span>
        <span class="remove" onclick="removeAccessory(${idx})">✕</span>
      </span>
    `).join('');
  }

  // Update hidden input
  if (hiddenInput) {
    hiddenInput.value = accessories.join(', ');
  }
}

// ═══════════════════════════════════════════════════════════════
// 🔐 PASSCODE TOGGLE
// ═══════════════════════════════════════════════════════════════
function togglePasscodeVisibility() {
  const input = document.getElementById('devicePasscode');
  const btn = document.getElementById('togglePasscode');

  if (!input || !btn) return;

  if (input.type === 'password') {
    input.type = 'text';
    btn.innerHTML = '<span>🙈</span> إخفاء';
  } else {
    input.type = 'password';
    btn.innerHTML = '<span>👁️</span> إظهار';
  }
}

// ═══════════════════════════════════════════════════════════════
// 📄 DETAILS MODAL
// ═══════════════════════════════════════════════════════════════
let currentTicket = null; // Store current ticket for status change
let currentTicketId = null; // Store current ticket ID

// ═══════════════════════════════════════════════════════════════
// 🔒 LOCK DETECTION (Phase 1)
// ═══════════════════════════════════════════════════════════════
function isTicketFinanciallyClosed(ticket) {
  // Check for explicit financial closure indicators
  if (ticket.is_financially_closed === 1 || ticket.is_financially_closed === true) {
    return true;
  }
  if (ticket.close_id !== null && ticket.close_id !== undefined) {
    return true;
  }
  if (ticket.day_closed === 1 || ticket.day_closed === true) {
    return true;
  }
  if (ticket.closed_at && ticket.closed_at.trim() !== '') {
    return true;
  }
  
  // Fallback: Check if ticket is delivered or cancelled (simplified check)
  // Backend already enforces day-level locks, so this is a UI simplification
  const status = ticket.status || '';
  if (status === 'delivered' || status === 'cancelled' || status === 'canceled') {
    return true;
  }
  
  return false;
}

// ═══════════════════════════════════════════════════════════════
// 🔒 LOCKED BANNER (Phase 2)
// ═══════════════════════════════════════════════════════════════
function showLockedBanner(ticket) {
  const banner = document.getElementById('lockedBanner');
  if (!banner) return;

  // Fill banner fields
  const closeDateEl = document.getElementById('lockedCloseDate');
  const closeIdEl = document.getElementById('lockedCloseId');
  const closeByEl = document.getElementById('lockedCloseBy');
  const closeByContainer = document.getElementById('lockedCloseByContainer');
  const statusReasonEl = document.getElementById('lockedStatusReason');
  const adjustmentHint = document.getElementById('adjustmentHint');

  // Format date nicely
  const formatDate = (dateStr) => {
    if (!dateStr || dateStr === '-') return '-';
    try {
      const date = new Date(dateStr);
      return date.toLocaleDateString('ar-EG', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });
    } catch (e) {
      return dateStr;
    }
  };

  if (closeDateEl) {
    const closeDate = ticket.closed_at || ticket.delivered_at || ticket.updated_at || '-';
    closeDateEl.textContent = formatDate(closeDate);
  }

  if (closeIdEl) {
    const closeId = ticket.close_id;
    closeIdEl.textContent = closeId ? `#${closeId}` : 'إقفال تلقائي';
  }

  if (closeByEl && closeByContainer) {
    if (ticket.closed_by) {
      closeByEl.textContent = ticket.closed_by;
      closeByContainer.style.display = 'flex';
    } else {
      closeByContainer.style.display = 'none';
    }
  }

  // Show status reason
  if (statusReasonEl) {
    const statusLabels = {
      'delivered': 'تم التسليم للعميل',
      'cancelled': 'تم إلغاء التذكرة',
      'canceled': 'تم إلغاء التذكرة'
    };
    const status = ticket.status || '';
    if (ticket.close_id) {
      statusReasonEl.textContent = 'إقفال وردية';
    } else if (statusLabels[status]) {
      statusReasonEl.textContent = statusLabels[status];
    } else {
      statusReasonEl.textContent = 'مقفلة مالياً';
    }
  }

  // Show create adjustment button for admin only
  const btnCreateAdjustment = document.getElementById('btnCreateAdjustment');
  const userRole = window.currentUser?.role;
  const isAdmin = userRole === 'admin' || userRole === 'super_admin';

  if (btnCreateAdjustment) {
    btnCreateAdjustment.style.display = isAdmin ? 'inline-flex' : 'none';
  }

  if (adjustmentHint) {
    adjustmentHint.style.display = isAdmin ? 'list-item' : 'none';
  }

  banner.style.display = 'block';
}

function hideLockedBanner() {
  const banner = document.getElementById('lockedBanner');
  if (banner) {
    banner.style.display = 'none';
  }
}

// ═══════════════════════════════════════════════════════════════
// 🔒 DISABLE EDIT CONTROLS (Phase 1)
// ═══════════════════════════════════════════════════════════════
function disableEditControls(locked, role) {
  // Status change controls
  const statusSelect = document.getElementById('changeStatusSelect');
  const btnChangeStatus = document.getElementById('btnChangeStatus');
  const statusChangeMessage = document.getElementById('statusChangeMessage');
  const changeStatusSection = document.getElementById('changeStatusSection');
  
  if (locked) {
    if (statusSelect) statusSelect.disabled = true;
    if (btnChangeStatus) btnChangeStatus.disabled = true;
    if (statusChangeMessage) statusChangeMessage.style.display = 'block';
    
    // Total cost input
    const repairTotalCost = document.getElementById('repairTotalCost');
    if (repairTotalCost) {
      repairTotalCost.readOnly = true;
      repairTotalCost.style.background = '#f3f4f6';
      repairTotalCost.style.cursor = 'not-allowed';
    }
    
    // Payment section
    const repairPayAmount = document.getElementById('repairPayAmount');
    const repairPayMethod = document.getElementById('repairPayMethod');
    const repairWalletSelect = document.getElementById('repairWalletSelect');
    const repairWalletSelectGroup = document.getElementById('repairWalletSelectGroup');
    const repairPayNote = document.getElementById('repairPayNote');
    const btnRepairPay = document.getElementById('btnRepairPay');
    const repairPayError = document.getElementById('repairPayError');
    
    if (repairPayAmount) {
      repairPayAmount.disabled = true;
      repairPayAmount.style.background = '#f3f4f6';
    }
    if (repairPayMethod) repairPayMethod.disabled = true;
    if (repairWalletSelect) repairWalletSelect.disabled = true;
    if (repairWalletSelectGroup) repairWalletSelectGroup.style.display = 'none';
    if (repairPayNote) repairPayNote.disabled = true;
    if (btnRepairPay) {
      btnRepairPay.disabled = true;
      btnRepairPay.style.opacity = '0.5';
      btnRepairPay.style.cursor = 'not-allowed';
    }
    if (repairPayError) repairPayError.style.display = 'none';
    
    // Parts section
    const repairPartSelect = document.getElementById('repairPartSelect');
    const repairPartQty = document.getElementById('repairPartQty');
    const btnReservePart = document.getElementById('btnReservePart');
    const repairPartError = document.getElementById('repairPartError');
    
    if (repairPartSelect) repairPartSelect.disabled = true;
    if (repairPartQty) {
      repairPartQty.disabled = true;
      repairPartQty.style.background = '#f3f4f6';
    }
    if (btnReservePart) {
      btnReservePart.disabled = true;
      btnReservePart.style.opacity = '0.5';
      btnReservePart.style.cursor = 'not-allowed';
    }
    if (repairPartError) repairPartError.style.display = 'none';

    // الفني: إخفاء زر التعديل ومنع تغيير الفني عند التذكرة المقفولة
    const btnEditTech = document.getElementById('btnEditTechnician');
    const detailTechnicianSelect = document.getElementById('detailTechnicianSelect');
    const btnSaveTech = document.getElementById('btnSaveTechnician');
    const btnCancelTech = document.getElementById('btnCancelTechnician');
    const detailTechnicianDisplay = document.getElementById('detailTechnicianDisplay');
    if (btnEditTech) btnEditTech.style.display = 'none';
    if (detailTechnicianSelect) detailTechnicianSelect.style.display = 'none';
    if (btnSaveTech) btnSaveTech.style.display = 'none';
    if (btnCancelTech) btnCancelTech.style.display = 'none';
    if (detailTechnicianDisplay) detailTechnicianDisplay.style.display = '';
  } else {
    if (statusSelect) statusSelect.disabled = false;
    if (btnChangeStatus) btnChangeStatus.disabled = false;
    if (statusChangeMessage) statusChangeMessage.style.display = 'none';
    
    // Total cost input
    const repairTotalCost = document.getElementById('repairTotalCost');
    if (repairTotalCost) {
      repairTotalCost.readOnly = false;
      repairTotalCost.style.background = '';
      repairTotalCost.style.cursor = '';
    }
    
    // Payment section
    const repairPayAmount = document.getElementById('repairPayAmount');
    const repairPayMethod = document.getElementById('repairPayMethod');
    const repairWalletSelect = document.getElementById('repairWalletSelect');
    const repairPayNote = document.getElementById('repairPayNote');
    const btnRepairPay = document.getElementById('btnRepairPay');
    
    if (repairPayAmount) {
      repairPayAmount.disabled = false;
      repairPayAmount.style.background = '';
    }
    if (repairPayMethod) repairPayMethod.disabled = false;
    if (repairWalletSelect) repairWalletSelect.disabled = false;
    if (repairPayNote) repairPayNote.disabled = false;
    if (btnRepairPay) {
      btnRepairPay.disabled = false;
      btnRepairPay.style.opacity = '';
      btnRepairPay.style.cursor = '';
    }
    
    // Parts section
    const repairPartSelect = document.getElementById('repairPartSelect');
    const repairPartQty = document.getElementById('repairPartQty');
    const btnReservePart = document.getElementById('btnReservePart');
    
    if (repairPartSelect) repairPartSelect.disabled = false;
    if (repairPartQty) {
      repairPartQty.disabled = false;
      repairPartQty.style.background = '';
    }
    if (btnReservePart) {
      btnReservePart.disabled = false;
      btnReservePart.style.opacity = '';
      btnReservePart.style.cursor = '';
    }

    // الفني: إظهار زر التعديل عندما التذكرة غير مقفولة
    const btnEditTech = document.getElementById('btnEditTechnician');
    if (btnEditTech) btnEditTech.style.display = 'inline-flex';
  }
}

// ═══════════════════════════════════════════════════════════════
// 📢 POLICY MESSAGING HELPER
// ═══════════════════════════════════════════════════════════════
function showPolicyMessage(msg) {
  if (typeof showToast === 'function') {
    showToast(msg, 'warning');
  } else {
    alert(msg);
  }
}

async function openDetailsModal(ticketId) {
  const modal = document.getElementById('detailsModal');
  if (!modal) return;

  try {
    // Show modal immediately with loading state
    modal.classList.add('active');

    // Fetch ticket details
    const data = await apiRequest(`elos-db://repairs/${ticketId}`);
    const ticket = data.ticket || data;
    currentTicket = ticket; // Store for status change
    currentTicketId = ticketId; // Store ticket ID
    currentRepairId = ticketId; // Set global currentRepairId

    Logger.log('📄 Ticket details loaded:', ticket);
    Logger.log('📄 Received ticket keys:', Object.keys(ticket));

    // ✅ Reset tabs and stepper when opening new ticket
    switchDetailsTab('tabInfo');
    document.querySelectorAll('.tab-dot').forEach(d => d.style.display = 'none');

    // ✅ Reset adjustment badge and original ticket button
    const adjustmentBadge = document.getElementById('adjustmentBadge');
    const btnOpenOriginal = document.getElementById('btnOpenOriginalTicket');
    if (adjustmentBadge) adjustmentBadge.style.display = 'none';
    if (btnOpenOriginal) btnOpenOriginal.style.display = 'none';

    // Load employees for technician dropdown (إن وجد)
    await loadEmployees();

    // Update modal content
    document.getElementById('detailsTicketNo').textContent = `#${ticket.ticket_no || ticket.id}`;
    document.getElementById('detailCustomerName').textContent = ticket.customer_name || '-';
    document.getElementById('detailCustomerPhone').textContent = ticket.customer_phone || '-';
    document.getElementById('detailDeviceCategory').textContent = DEVICE_CATEGORIES[ticket.device_category] || ticket.device_category || '-';

    // Backward compatibility: fallback to brand/model if device_brand/device_model is empty
    const brand = ticket.device_brand || ticket.brand || '';
    const model = ticket.device_model || ticket.model || '';
    const brandModel = [brand, model].filter(Boolean).join(' ');
    document.getElementById('detailDeviceBrandModel').textContent = brandModel || '-';

    document.getElementById('detailImei').textContent = ticket.imei_or_serial || '-';

    const statusConfig = STATUS_CONFIG[ticket.status] || STATUS_CONFIG['received'] || STATUS_CONFIG['pending'];
    document.getElementById('detailStatus').innerHTML = `<span class="status-badge ${statusConfig.class}">${statusConfig.label}</span>`;

    document.getElementById('detailIssue').textContent = ticket.issue_description || '-';

    // ✅ بطاقة الملخص + شريط التقدم
    populateSummaryCard(ticket);
    updateStatusStepper(ticket.status);

    // ═══ الفني - عرض وتعديل ═══
    const techDisplay = document.getElementById('detailTechnicianDisplay');
    const techSelect = document.getElementById('detailTechnicianSelect');
    const btnEditTech = document.getElementById('btnEditTechnician');
    const btnSaveTech = document.getElementById('btnSaveTechnician');
    const btnCancelTech = document.getElementById('btnCancelTechnician');
    const techName = ticket.assigned_tech_name ? String(ticket.assigned_tech_name).trim() : '';
    if (techDisplay) techDisplay.textContent = techName || '-';
    if (techSelect) {
      fillTechnicianSelect(techSelect, techName);
      techSelect.value = techName || '';
      techSelect.style.display = 'none';
    }
    if (btnEditTech) btnEditTech.style.display = 'inline-flex';
    if (btnSaveTech) btnSaveTech.style.display = 'none';
    if (btnCancelTech) btnCancelTech.style.display = 'none';

    // ═══ Update Ticket Barcode in Details Modal (V2.0) ═══
    // استخدام الباركود المحفوظ في قاعدة البيانات أو ticket_no
    const ticketBarcode = ticket.barcode || ticket.ticket_no || ticket.id || '';
    const ticketNo = ticket.ticket_no || ticket.id || '';
    const barcodeContainer = document.getElementById('ticketBarcodeSVG');
    const barcodeNumber = document.getElementById('ticketBarcodeNumber');

    if (barcodeContainer && barcodeNumber && ticketBarcode) {
      // Generate barcode using unified service (V2.0 - with Code128-C optimization)
      if (typeof BarcodeService !== 'undefined') {
        // استخدام الدالة المحسّنة التي تختار تلقائياً Code128-C للأرقام
        const barcodeSVG = BarcodeService.generateOptimalBarcodeSVG
          ? BarcodeService.generateOptimalBarcodeSVG(ticketBarcode, 200, 50)
          : BarcodeService.generateCode128SVG(ticketBarcode, 200, 50);
        barcodeContainer.innerHTML = barcodeSVG;
        barcodeNumber.textContent = ticketBarcode;
      } else if (typeof generateBarcodeSVG === 'function') {
        // Fallback to local function
        barcodeContainer.innerHTML = generateBarcodeSVG(ticketBarcode);
        barcodeNumber.textContent = ticketBarcode;
      } else {
        // No barcode available
        barcodeContainer.innerHTML = '<div style="padding: 20px; color: var(--text-secondary);">باركود غير متاح</div>';
        barcodeNumber.textContent = `#${ticketNo}`;
      }
    }

    // ═══ تحديث زر طباعة الباركود ═══
    const printBarcodeBtn = document.getElementById('printRepairBarcodeBtn');
    if (printBarcodeBtn) {
      printBarcodeBtn.onclick = () => {
        // استخدام BarcodeGenerator لعرض باركود حقيقي
        if (window.BarcodeGenerator) {
          const labelData = {
            model: ticket.device_model || ticket.device_category || 'صيانة',
            name: ticket.customer_name || '',
            imei: ticket.ticket_no || ticket.id,
            price: 0 // بدون سعر
          };
          window.BarcodeGenerator.showBarcodePreviewModal(labelData, 'repair');
        } else {
          // Fallback إذا BarcodeGenerator غير متاح
          printRepairBarcode(ticket);
        }
      };
    }

    // ═══ LOCK DETECTION (Phase 1) ═══
    const locked = isTicketFinanciallyClosed(ticket);
    const userRole = window.currentUser?.role;
    
    // Show/hide locked banner (Phase 2)
    if (locked) {
      showLockedBanner(ticket);
    } else {
      hideLockedBanner();
    }
    
    // Disable edit controls (Phase 1)
    disableEditControls(locked, userRole);

    // Initialize status change controls
    const statusSelect = document.getElementById('changeStatusSelect');
    const statusNote = document.getElementById('changeStatusNote');
    const changeStatusSection = document.getElementById('changeStatusSection');
    
    // Check permissions - hide section if not admin or cashier
    const canChangeStatus = userRole === 'admin' || userRole === 'super_admin' || userRole === 'cashier';
    
    if (changeStatusSection) {
      changeStatusSection.style.display = canChangeStatus ? 'block' : 'none';
    }
    
    if (statusSelect) {
      const currentStatus = ticket.status || 'received';
      statusSelect.value = currentStatus;
      // Update quick status buttons
      updateQuickStatusButtons(currentStatus);
    }

    if (statusNote) {
      statusNote.value = '';
    }

    // Load and render events
    await loadTicketEvents(ticket.id);

    // Render history (backward compatibility)
    if (ticket.status_history || data.status_history) {
      renderTicketHistory(ticket.status_history || data.status_history || []);
    }

    // Load repair parts first (needed for calculating reserved parts total)
    await loadRepairParts();
    await loadTicketParts(ticket.id);

    // Load and render payments (after parts are loaded to calculate service fee correctly)
    await loadTicketPayments(ticket.id);

    // ═══ INVOICE BUTTONS VISIBILITY ═══
    let hasInvoice = false;
    try {
      const invoices = await apiRequest('elos-db://repairs/invoices');
      hasInvoice = invoices.some(inv => inv.ticket_id === ticket.id);
    } catch (e) {
      // No invoice
    }
    const isDelivered = ticket.status === 'delivered';

    // زر "طباعة فاتورة" - يظهر لو الفاتورة موجودة أو التذكرة مسلّمة
    const btnPrintInvoiceFooter = document.getElementById('btnPrintInvoice');
    if (btnPrintInvoiceFooter) {
      btnPrintInvoiceFooter.style.display = (hasInvoice || isDelivered) ? 'inline-flex' : 'none';
    }

    // ✅ FIX: زر "إنشاء فاتورة" - يظهر لو الفاتورة مش موجودة
    const btnGenerateInvoice = document.getElementById('btnGenerateInvoice');
    if (btnGenerateInvoice) {
      btnGenerateInvoice.style.display = hasInvoice ? 'none' : 'flex';
    }

    // ═══ ADJUSTMENT TICKETS HANDLING ═══
    // Check if this is an adjustment ticket or original ticket
    if (ticket.is_adjustment === 1 && ticket.original_repair_id) {
      // This is an adjustment ticket - show badge and link to original
      const adjustmentBadge = document.getElementById('adjustmentBadge');
      const btnOpenOriginal = document.getElementById('btnOpenOriginalTicket');
      if (adjustmentBadge) adjustmentBadge.style.display = 'inline-block';
      if (btnOpenOriginal) {
        btnOpenOriginal.style.display = 'inline-block';
        btnOpenOriginal.onclick = () => {
          closeDetailsModal();
          setTimeout(() => openDetailsModal(ticket.original_repair_id), 300);
        };
      }
      // Hide adjustments section for adjustment tickets
      const linkedAdjustmentsSection = document.getElementById('linkedAdjustmentsSection');
      if (linkedAdjustmentsSection) linkedAdjustmentsSection.style.display = 'none';
      const aggregatedTotalsSection = document.getElementById('aggregatedTotalsSection');
      if (aggregatedTotalsSection) aggregatedTotalsSection.style.display = 'none';
    } else {
      // This is an original ticket - hide badge and link, load adjustments
      const adjustmentBadge = document.getElementById('adjustmentBadge');
      const btnOpenOriginal = document.getElementById('btnOpenOriginalTicket');
      if (adjustmentBadge) adjustmentBadge.style.display = 'none';
      if (btnOpenOriginal) btnOpenOriginal.style.display = 'none';
      // Load and render linked adjustments
      await loadLinkedAdjustments(ticket.id);
      // Load and render aggregated totals
      await loadAggregatedTotals(ticket.id);
    }

    // ✅ اختيار التاب الافتراضي حسب حالة التذكرة
    const defaultTab = getDefaultTab(ticket.status);
    switchDetailsTab(defaultTab);

    // ✅ تحديث إشعارات التابات
    const remainingEl = document.getElementById('repairRemaining');
    const remainingText = remainingEl ? remainingEl.textContent : '0';
    const remainingVal = parseFloat(remainingText.replace(/[^0-9.-]/g, '')) || 0;
    const partsListEl = document.getElementById('repairPartsList');
    const hasReservedParts = partsListEl ? partsListEl.innerHTML.trim().length > 0 : false;
    updateTabNotifications(remainingVal, hasReservedParts);

    // ✅ عرض/إخفاء section المرتجع
    await updateRefundSection(ticket);

  } catch (error) {
    Logger.error('Failed to load ticket details:', error);
    if (typeof showToast === 'function') {
      showToast('فشل في تحميل تفاصيل التذكرة', 'error');
    }
    closeDetailsModal();
  }
}

function closeDetailsModal() {
  const modal = document.getElementById('detailsModal');
  if (modal) {
    modal.classList.remove('active');
  }
  currentTicket = null; // Clear current ticket
  currentTicketId = null; // Clear ticket ID
  currentRepairId = null; // Clear current repair ID

  // تحديث البطاقات والجدول عند إغلاق المودال لضمان تحديث KPIs
  renderTicketsTable();
  updateDashboardStats();
}

// ═══════════════════════════════════════════════════════════════
// ⚡ QUICK STATUS CHANGE - تغيير الحالة بضغطة واحدة
// ═══════════════════════════════════════════════════════════════
async function quickChangeStatus(newStatus) {
  Logger.log('[QUICK STATUS] quickChangeStatus called with:', newStatus);

  if (currentRepairId === null) {
    if (typeof showToast === 'function') {
      showToast('لا توجد تذكرة مفتوحة', 'error');
    }
    return;
  }

  // Get current status
  const statusSelect = document.getElementById('changeStatusSelect');
  const currentStatus = statusSelect?.value;

  // Don't allow changing to same status
  if (currentStatus === newStatus) {
    if (typeof showToast === 'function') {
      showToast('التذكرة بالفعل في هذه الحالة', 'info');
    }
    return;
  }

  // For delivered/cancelled status, use the normal flow (needs confirmation/refund handling)
  if (newStatus === 'delivered' || newStatus === 'cancelled') {
    // Set the select value and trigger normal change
    if (statusSelect) {
      statusSelect.value = newStatus;
    }
    await changeRepairStatus();
    return;
  }

  // For other statuses, change directly
  try {
    // Disable buttons during change
    const quickButtons = document.querySelectorAll('.quick-status-btn');
    quickButtons.forEach(btn => btn.disabled = true);

    await executeStatusChange(newStatus, 'تغيير سريع');

    if (typeof showToast === 'function') {
      const statusLabels = {
        'received': 'مستلم',
        'diagnosing': 'قيد الفحص',
        'waiting_approval': 'انتظار الموافقة',
        'in_repair': 'تحت الصيانة',
        'ready': 'جاهز للتسليم',
        'delivered': 'تم التسليم'
      };
      showToast(`✓ تم تغيير الحالة إلى "${statusLabels[newStatus] || newStatus}"`, 'success', 2000);
    }

    // Update quick status buttons
    updateQuickStatusButtons(newStatus);

  } catch (error) {
    Logger.error('[QUICK STATUS] Error:', error);
    if (typeof showToast === 'function') {
      showToast(error.message || 'فشل في تغيير الحالة', 'error');
    }
  } finally {
    // Re-enable buttons
    const quickButtons = document.querySelectorAll('.quick-status-btn');
    quickButtons.forEach(btn => btn.disabled = false);
    updateQuickStatusButtons(document.getElementById('changeStatusSelect')?.value);
  }
}
window.quickChangeStatus = quickChangeStatus;

// ═══════════════════════════════════════════════════════════════
// 🔄 UPDATE QUICK STATUS BUTTONS - تحديث أزرار الحالة السريعة
// ═══════════════════════════════════════════════════════════════
function updateQuickStatusButtons(currentStatus) {
  const buttons = document.querySelectorAll('.quick-status-btn');

  buttons.forEach(btn => {
    const btnStatus = btn.getAttribute('data-status');
    btn.classList.remove('current-status');
    btn.disabled = false;

    // Mark current status button
    if (btnStatus === currentStatus) {
      btn.classList.add('current-status');
    }

    // Disable buttons based on workflow (optional - can be removed if free flow is preferred)
    // For now, we allow free status changes
  });

  // Hide quick status section if ticket is delivered or cancelled
  const quickSection = document.getElementById('quickStatusSection');
  if (quickSection) {
    if (currentStatus === 'delivered' || currentStatus === 'cancelled' || currentStatus === 'refunded') {
      quickSection.style.display = 'none';
    } else {
      quickSection.style.display = 'block';
    }
  }
}
window.updateQuickStatusButtons = updateQuickStatusButtons;

// ═══════════════════════════════════════════════════════════════
// 🔄 STATUS CHANGE
// ═══════════════════════════════════════════════════════════════
async function changeRepairStatus() {
  console.log('🔴 changeRepairStatus() CALLED!'); // Direct console.log for debugging
  Logger.log('[STATUS] changeRepairStatus() called, currentRepairId:', currentRepairId);

  // Check if currentRepairId is set
  if (currentRepairId === null) {
    Logger.error('[STATUS] currentRepairId is null!');
    if (typeof showToast === 'function') {
      showToast('لا توجد تذكرة مفتوحة', 'error');
    }
    return;
  }

  const statusSelect = document.getElementById('changeStatusSelect');
  const statusNote = document.getElementById('changeStatusNote');
  const btnChangeStatus = document.getElementById('btnChangeStatus');

  Logger.log('[STATUS] Elements found:', { statusSelect: !!statusSelect, statusNote: !!statusNote, btnChangeStatus: !!btnChangeStatus });

  if (!statusSelect || !btnChangeStatus) {
    Logger.error('[STATUS] Required elements not found!');
    return;
  }

  const newStatus = statusSelect.value;
  const note = statusNote ? statusNote.value.trim() : '';

  Logger.log('[STATUS] newStatus:', newStatus, 'note:', note);

  // Get current ticket status
  if (!currentTicket) {
    Logger.error('[STATUS] currentTicket is null!');
    if (typeof showToast === 'function') {
      showToast('لا توجد تذكرة مفتوحة', 'error');
    }
    return;
  }

  const currentStatus = currentTicket.status || 'received';
  Logger.log('[STATUS] currentStatus:', currentStatus);

  // Check if status changed
  if (newStatus === currentStatus) {
    Logger.log('[STATUS] Status unchanged, skipping');
    if (typeof showToast === 'function') {
      showToast('لم يتم تغيير الحالة', 'info');
    }
    return;
  }

  Logger.log('[STATUS] Status will change from', currentStatus, 'to', newStatus);

  // ═══ إذا كانت الحالة الجديدة "ملغي"، تحقق من وجود مدفوعات ═══
  if (newStatus === 'cancelled' || newStatus === 'canceled') {
    console.log('[CANCEL] Checking for payments before cancellation...');
    try {
      // جلب المدفوعات للتذكرة
      console.log('[CANCEL] Fetching payments for ticket:', currentRepairId);
      const paymentsData = await apiRequest(`elos-db://repairs/${currentRepairId}/payments`);
      console.log('[CANCEL] Payments data received:', paymentsData);
      const totalPaid = paymentsData.total_paid || 0;
      console.log('[CANCEL] Total paid:', totalPaid);

      if (totalPaid > 0) {
        console.log('[CANCEL] Found payments, showing refund modal. Total paid:', totalPaid);
        // عرض نافذة استرداد العربون
        showRefundModal(totalPaid, note);
        return; // انتظار اختيار المستخدم من النافذة
      } else {
        console.log('[CANCEL] No payments found, proceeding with cancellation');
      }
    } catch (err) {
      console.error('[CANCEL] Error checking payments:', err);
      // في حالة الخطأ، نتابع بدون استرداد
    }
  }

  // متابعة تغيير الحالة بدون استرداد
  console.log('[CANCEL] Executing status change to:', newStatus);
  await executeStatusChange(newStatus, note);
}

// ═══════════════════════════════════════════════════════════════
// 💰 REFUND MODAL - نافذة استرداد العربون عند الإلغاء
// ═══════════════════════════════════════════════════════════════
function showRefundModal(totalPaid, note) {
  console.log('[REFUND MODAL] showRefundModal called with totalPaid:', totalPaid);

  // إزالة أي نافذة موجودة
  const existingModal = document.getElementById('refundModal');
  if (existingModal) existingModal.remove();

  const modal = document.createElement('div');
  modal.id = 'refundModal';
  // لا نستخدم modal-overlay لأنها مخفية بالـ CSS، نستخدم styles مباشرة
  modal.style.cssText = 'position:fixed;top:0;left:0;right:0;bottom:0;background:rgba(0,0,0,0.85);z-index:99999;display:flex;align-items:center;justify-content:center;opacity:1;visibility:visible;';

  console.log('[REFUND MODAL] Creating modal element...');

  modal.innerHTML = `
    <div style="background:var(--bg-secondary,#1a1f2e);border-radius:16px;padding:24px;max-width:450px;width:90%;box-shadow:0 8px 32px rgba(0,0,0,0.3);">
      <h3 style="margin:0 0 16px;color:var(--text-primary,white);font-size:18px;display:flex;align-items:center;gap:8px;">
        <span>💰</span>
        <span>استرداد المدفوعات</span>
      </h3>

      <p style="color:var(--text-secondary,#a0aec0);margin:0 0 16px;font-size:14px;">
        يوجد مبلغ <strong style="color:#f59e0b;">${window.fmt(totalPaid)} ج.م</strong> مدفوع على هذه التذكرة.
        <br>هل تريد استرداد المبلغ للعميل؟
      </p>

      <div style="margin-bottom:16px;">
        <label style="display:flex;align-items:center;gap:8px;padding:12px;background:var(--bg-tertiary,#252b3b);border-radius:8px;cursor:pointer;margin-bottom:8px;">
          <input type="radio" name="refundChoice" value="refund" checked style="accent-color:#10b981;">
          <span style="color:var(--text-primary,white);">نعم، استرداد المبلغ</span>
        </label>
        <label style="display:flex;align-items:center;gap:8px;padding:12px;background:var(--bg-tertiary,#252b3b);border-radius:8px;cursor:pointer;">
          <input type="radio" name="refundChoice" value="no_refund" style="accent-color:#ef4444;">
          <span style="color:var(--text-primary,white);">لا، إلغاء بدون استرداد</span>
        </label>
      </div>

      <div id="refundWalletSection" style="margin-bottom:16px;">
        <label style="display:block;color:var(--text-secondary,#a0aec0);margin-bottom:8px;font-size:13px;">استرداد من:</label>
        <select id="refundWalletType" style="width:100%;padding:12px;border-radius:8px;border:1px solid var(--border-color,#3a4557);background:var(--bg-tertiary,#252b3b);color:var(--text-primary,white);font-size:14px;">
          <option value="cash">💵 الكاش (الخزينة)</option>
          <option value="mobile_wallet">📱 المحفظة الإلكترونية</option>
          <option value="bank">🏦 الحساب البنكي</option>
        </select>
      </div>

      <div id="refundWalletIdSection" style="margin-bottom:16px;display:none;">
        <label style="display:block;color:var(--text-secondary,#a0aec0);margin-bottom:8px;font-size:13px;">اختر المحفظة:</label>
        <select id="refundWalletId" style="width:100%;padding:12px;border-radius:8px;border:1px solid var(--border-color,#3a4557);background:var(--bg-tertiary,#252b3b);color:var(--text-primary,white);font-size:14px;">
        </select>
      </div>

      <div style="display:flex;gap:12px;justify-content:flex-end;">
        <button onclick="closeRefundModal()" style="padding:10px 20px;border-radius:8px;border:1px solid var(--border-color,#3a4557);background:transparent;color:var(--text-secondary,#a0aec0);cursor:pointer;font-size:14px;">
          إلغاء
        </button>
        <button onclick="confirmCancellation('${note.replace(/'/g, "\\'")}', ${totalPaid})" style="padding:10px 20px;border-radius:8px;border:none;background:linear-gradient(135deg,#ef4444,#dc2626);color:white;cursor:pointer;font-size:14px;font-weight:600;">
          تأكيد الإلغاء
        </button>
      </div>
    </div>
  `;

  document.body.appendChild(modal);
  console.log('[REFUND MODAL] Modal appended to body. Modal element:', modal);
  console.log('[REFUND MODAL] Modal visible?', modal.offsetParent !== null);

  // إضافة event listeners
  const refundChoices = modal.querySelectorAll('input[name="refundChoice"]');
  const walletSection = document.getElementById('refundWalletSection');
  const walletIdSection = document.getElementById('refundWalletIdSection');
  const walletTypeSelect = document.getElementById('refundWalletType');

  refundChoices.forEach(radio => {
    radio.addEventListener('change', (e) => {
      walletSection.style.display = e.target.value === 'refund' ? 'block' : 'none';
      walletIdSection.style.display = 'none';
    });
  });

  // عند تغيير نوع المحفظة، جلب قائمة المحافظ
  walletTypeSelect.addEventListener('change', async (e) => {
    const walletType = e.target.value;
    if (walletType === 'mobile_wallet' || walletType === 'bank') {
      try {
        const wallets = await apiRequest(`elos-db://payment-wallets?type=${walletType === 'mobile_wallet' ? 'mobile' : 'bank'}`);
        const walletIdSelect = document.getElementById('refundWalletId');
        walletIdSelect.innerHTML = wallets.map(w => `<option value="${w.id}">${w.name}</option>`).join('');
        walletIdSection.style.display = 'block';
      } catch (err) {
        Logger.warn('Could not load wallets:', err);
        walletIdSection.style.display = 'none';
      }
    } else {
      walletIdSection.style.display = 'none';
    }
  });
}

function closeRefundModal() {
  const modal = document.getElementById('refundModal');
  if (modal) modal.remove();

  // إعادة تفعيل زر تغيير الحالة
  const btnChangeStatus = document.getElementById('btnChangeStatus');
  if (btnChangeStatus) {
    btnChangeStatus.disabled = false;
    btnChangeStatus.innerHTML = '<span>🔄</span> <span>تحديث الحالة</span>';
  }
}

// ═══════════════════════════════════════════════════════════════
// ↩️ POST-DELIVERY REFUND (مرتجع بعد التسليم)
// ═══════════════════════════════════════════════════════════════

async function updateRefundSection(ticket) {
  const section = document.getElementById('refundSection');
  if (!section) return;

  // يظهر فقط للتذاكر المُسلَّمة
  if (ticket.status !== 'delivered') {
    section.style.display = 'none';
    return;
  }

  section.style.display = 'block';

  // حساب فترة الضمان (14 يوم من التسليم)
  const deliveredAt = ticket.delivered_at ? new Date(ticket.delivered_at) : null;
  let warrantyDaysLeft = 0;
  let warrantyExpired = false;
  let deliveredDateStr = '-';

  if (deliveredAt && !isNaN(deliveredAt)) {
    deliveredDateStr = deliveredAt.toLocaleDateString('ar-EG', { year: 'numeric', month: 'short', day: 'numeric' });
    const now = new Date();
    const diffMs = now - deliveredAt;
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
    warrantyDaysLeft = Math.max(0, 14 - diffDays);
    warrantyExpired = diffDays > 14;
  }

  // جلب المبلغ المدفوع من API
  let totalPaid = Number(ticket.total_cost || 0);
  try {
    const paymentsData = await apiRequest(`elos-db://repairs/${ticket.id}/payments`);
    totalPaid = Number(paymentsData.total_paid || 0);
  } catch (e) {
    Logger.warn('Could not fetch payments for refund section:', e);
  }

  // حفظ المبلغ المدفوع في الـ ticket object للاستخدام لاحقاً
  currentTicket._refundAmount = totalPaid;

  // بناء info box
  const infoBox = document.getElementById('refundInfoBox');
  if (infoBox) {
    infoBox.innerHTML = `
      <div class="refund-info-row">
        <span class="refund-info-label"><span>💰</span> المبلغ المدفوع</span>
        <span class="refund-info-value" style="color: var(--success);">${totalPaid.toLocaleString()} ج.م</span>
      </div>
      <div class="refund-info-row">
        <span class="refund-info-label"><span>📅</span> تاريخ التسليم</span>
        <span class="refund-info-value">${deliveredDateStr}</span>
      </div>
      ${warrantyExpired ? `
        <div class="refund-warranty-badge expired">
          ⚠️ انتهت فترة الضمان (14 يوم) - المرتجع على مسؤولية الإدارة
        </div>
      ` : `
        <div class="refund-warranty-badge active">
          ✅ باقي ${warrantyDaysLeft} يوم على انتهاء فترة الضمان
        </div>
      `}
    `;
  }

  // Reset form
  const reasonEl = document.getElementById('refundReason');
  if (reasonEl) reasonEl.value = '';
  const walletTypeEl = document.getElementById('refundWalletTypeSelect');
  if (walletTypeEl) walletTypeEl.value = 'cash';
  const walletIdGroup = document.getElementById('refundWalletIdGroup');
  if (walletIdGroup) walletIdGroup.style.display = 'none';
}

async function onRefundWalletTypeChange() {
  const walletType = document.getElementById('refundWalletTypeSelect')?.value;
  const walletIdGroup = document.getElementById('refundWalletIdGroup');
  const walletIdSelect = document.getElementById('refundWalletIdSelect');

  if (walletType === 'mobile_wallet' || walletType === 'bank') {
    try {
      const wallets = await apiRequest(`elos-db://payment-wallets?type=${walletType === 'mobile_wallet' ? 'mobile' : 'bank'}`);
      walletIdSelect.innerHTML = wallets.map(w => `<option value="${w.id}">${escapeHtml(w.name)}</option>`).join('');
      walletIdGroup.style.display = 'block';
    } catch (err) {
      Logger.warn('Could not load wallets for refund:', err);
      walletIdGroup.style.display = 'none';
    }
  } else {
    walletIdGroup.style.display = 'none';
  }
}

async function confirmRefund() {
  if (!currentTicket || !currentRepairId) {
    showToast('لا توجد تذكرة مفتوحة', 'error');
    return;
  }

  // التحقق من السبب
  const reason = document.getElementById('refundReason')?.value?.trim();
  if (!reason) {
    showToast('يجب كتابة سبب المرتجع', 'error');
    document.getElementById('refundReason')?.focus();
    return;
  }

  // جمع بيانات المحفظة
  const walletType = document.getElementById('refundWalletTypeSelect')?.value || 'cash';
  const walletId = document.getElementById('refundWalletIdSelect')?.value || null;
  const refundAmount = Number(currentTicket._refundAmount || currentTicket.total_cost || 0);

  if (refundAmount <= 0) {
    showToast('لا يوجد مبلغ للاسترداد', 'error');
    return;
  }

  // تأكيد بالمودال المخصص
  const confirmed = await showCustomConfirm({
    icon: '↩️',
    title: 'تأكيد المرتجع',
    message: `سيتم استرداد مبلغ <strong>${refundAmount.toLocaleString()} ج.م</strong> للعميل وتغيير حالة التذكرة إلى "مرتجع".\n\nالسبب: ${reason}`,
    okText: '↩️ تأكيد المرتجع',
    cancelText: 'إلغاء',
    danger: true
  });

  if (!confirmed) return;

  const btn = document.getElementById('btnConfirmRefund');
  if (btn) {
    btn.disabled = true;
    btn.innerHTML = '<span>⏳</span> <span>جاري معالجة المرتجع...</span>';
  }

  try {
    const res = await fetch(`elos-db://repairs/${currentRepairId}/refund`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        reason,
        refund_amount: refundAmount,
        refund_wallet_type: walletType,
        refund_wallet_id: walletId
      })
    });

    const responseText = await res.text();
    if (!res.ok) {
      let errorMsg;
      try { const errData = JSON.parse(responseText); errorMsg = errData.error || responseText; }
      catch { errorMsg = responseText; }
      throw new Error(errorMsg);
    }

    const result = JSON.parse(responseText);
    if (result.ok) {
      showToast('✅ تم المرتجع والاسترداد بنجاح', 'success');

      // تحديث حالة التذكرة في الـ UI
      currentTicket.status = 'refunded';

      // تحديث status badge
      const statusConfig = STATUS_CONFIG['refunded'];
      const statusEl = document.getElementById('detailStatus');
      if (statusEl) {
        statusEl.innerHTML = `<span class="status-badge ${statusConfig.class}">${statusConfig.label}</span>`;
      }

      // إخفاء section المرتجع
      const refundSection = document.getElementById('refundSection');
      if (refundSection) refundSection.style.display = 'none';

      // إخفاء section تغيير الحالة
      const changeStatusSection = document.getElementById('changeStatusSection');
      if (changeStatusSection) changeStatusSection.style.display = 'none';

      // تحديث الجدول والإحصائيات
      const ticketIndex = tickets.findIndex(t => t.id === currentTicket.id);
      if (ticketIndex !== -1) tickets[ticketIndex].status = 'refunded';

      renderTicketsTable();
      await updateDashboardStats();
      await loadTicketEvents(currentRepairId);
      updateStatusStepper('refunded');
      populateSummaryCard(currentTicket);
    }
  } catch (error) {
    Logger.error('Refund failed:', error);
    showToast(error.message || 'فشل في عملية المرتجع', 'error');
  } finally {
    if (btn) {
      btn.disabled = false;
      btn.innerHTML = '<span>↩️</span> <span>تأكيد المرتجع والاسترداد</span>';
    }
  }
}

async function confirmCancellation(note, totalPaid) {
  const refundChoice = document.querySelector('input[name="refundChoice"]:checked')?.value;
  const walletType = document.getElementById('refundWalletType')?.value || 'cash';
  const walletId = document.getElementById('refundWalletId')?.value || null;

  closeRefundModal();

  // تغيير الحالة مع معلومات الاسترداد
  const refundInfo = refundChoice === 'refund' ? {
    refund: true,
    refund_amount: totalPaid,
    refund_wallet_type: walletType,
    refund_wallet_id: walletId
  } : { refund: false };

  await executeStatusChange('cancelled', note, refundInfo);
}

// ═══════════════════════════════════════════════════════════════
// 🔄 EXECUTE STATUS CHANGE - تنفيذ تغيير الحالة
// ═══════════════════════════════════════════════════════════════
async function executeStatusChange(newStatus, note, refundInfo = null) {
  Logger.log('[EXECUTE] executeStatusChange called with:', { newStatus, note, refundInfo });

  const statusSelect = document.getElementById('changeStatusSelect');
  const btnChangeStatus = document.getElementById('btnChangeStatus');

  if (!btnChangeStatus) {
    Logger.error('[EXECUTE] btnChangeStatus not found!');
    return;
  }

  // Disable button during request
  btnChangeStatus.disabled = true;
  const originalText = btnChangeStatus.innerHTML;
  btnChangeStatus.innerHTML = '<span>⏳</span> <span>جاري التحديث...</span>';

  try {
    // Build request body
    const requestBody = {
      status: newStatus,
      note: note || null
    };

    // إضافة معلومات الاسترداد إن وجدت
    if (refundInfo) {
      Object.assign(requestBody, refundInfo);
    }

    // Call API to change status - using PUT as backend expects
    const result = await apiRequest(`elos-db://repairs/${currentRepairId}/status`, {
      method: 'PUT',
      body: JSON.stringify(requestBody)
    });

    Logger.log('✅ Status changed:', result);

    // Show success message
    if (typeof showToast === 'function') {
      const statusLabel = STATUS_CONFIG[newStatus]?.label || newStatus;
      showToast(`تم تحديث الحالة إلى: ${statusLabel}`, 'success');
    }

    // Play success sound if available
    if (typeof playSound === 'function') {
      playSound('success');
    }

    // Update current ticket status
    currentTicket.status = newStatus;

    // Update UI immediately (no full reload)
    // 1. Update status badge in modal
    const statusConfig = STATUS_CONFIG[newStatus] || STATUS_CONFIG['received'];
    document.getElementById('detailStatus').innerHTML = `<span class="status-badge ${statusConfig.class}">${statusConfig.label}</span>`;

    // 2. Update status select value
    if (statusSelect) {
      statusSelect.value = newStatus;
      
      // Disable if new status is delivered or cancelled
      const isLocked = newStatus === 'delivered' || newStatus === 'cancelled' || newStatus === 'refunded';
      statusSelect.disabled = isLocked;
      btnChangeStatus.disabled = isLocked;
      
      const statusChangeMessage = document.getElementById('statusChangeMessage');
      if (statusChangeMessage) {
        statusChangeMessage.style.display = isLocked ? 'block' : 'none';
      }
    }

    // 3. Clear note field
    const statusNote = document.getElementById('changeStatusNote');
    if (statusNote) {
      statusNote.value = '';
    }

    // 4. Append history item to detailHistoryList
    const historyList = document.getElementById('detailHistoryList');
    if (historyList) {
      const now = new Date();
      const timeStr = now.toLocaleString('ar-EG');
      const userName = window.currentUser?.username || window.currentUser?.name || 'نظام';
      const statusLabel = STATUS_CONFIG[newStatus]?.label || newStatus;
      
      // Remove empty state if exists
      const emptyState = historyList.querySelector('.empty-state');
      if (emptyState) {
        emptyState.remove();
      }
      
      const historyItem = document.createElement('div');
      historyItem.className = 'history-item';
      historyItem.innerHTML = `
        <span class="history-icon">🔄</span>
        <div class="history-content">
          <div class="history-title">تم تغيير الحالة إلى: ${window.escapeHtml(statusLabel)}${note ? ' - ' + window.escapeHtml(note) : ''}</div>
          <div class="history-meta">${window.escapeHtml(userName)} • ${timeStr}</div>
        </div>
      `;
      // Insert at the top
      historyList.insertBefore(historyItem, historyList.firstChild);
    }

    // 5. Update ticket in tickets array
    const ticketIndex = tickets.findIndex(t => t.id === currentTicket.id);
    if (ticketIndex !== -1) {
      tickets[ticketIndex].status = newStatus;
    }

    // 6. Re-render tickets table
    renderTicketsTable();

    // 7. Update dashboard stats
    await updateDashboardStats();

    // 8. Reload events to show new status_change event
    await loadTicketEvents(currentRepairId);

    // 9. Re-fetch ticket details to ensure we have latest data
    try {
      const data = await apiRequest(`elos-db://repairs/${currentRepairId}`);
      const updatedTicket = data.ticket || data;
      currentTicket = updatedTicket;
    } catch (err) {
      Logger.error('Failed to reload ticket details:', err);
    }

    // 10. ✅ تحديث شريط التقدم وبطاقة الملخص
    updateStatusStepper(newStatus);
    if (currentTicket) {
      currentTicket.status = newStatus;
      populateSummaryCard(currentTicket);
    }

  } catch (error) {
    Logger.error('Failed to change status:', error);
    if (typeof showToast === 'function') {
      showToast(error.message || 'فشل في تحديث الحالة', 'error');
    }
  } finally {
    // Re-enable button (unless locked)
    if (currentTicket) {
      const isLocked = currentTicket.status === 'delivered' || currentTicket.status === 'cancelled' || currentTicket.status === 'refunded';
      btnChangeStatus.disabled = isLocked;
      btnChangeStatus.innerHTML = originalText;
    } else {
      btnChangeStatus.disabled = false;
      btnChangeStatus.innerHTML = originalText;
    }
  }
}

// ═══════════════════════════════════════════════════════════════
// 📜 LOAD TICKET EVENTS
// ═══════════════════════════════════════════════════════════════
async function loadTicketEvents(ticketId) {
  try {
    const data = await apiRequest(`elos-db://repairs/${ticketId}/events`);
    // API returns events array directly or wrapped in object
    const events = Array.isArray(data) ? data : (data.events || []);
    renderTicketEvents(events);
  } catch (error) {
    Logger.error('Failed to load ticket events:', error);
    // Fallback to empty state
    renderTicketEvents([]);
  }
}

function renderTicketEvents(events) {
  const container = document.getElementById('detailHistoryList');
  if (!container) return;

  if (!events || events.length === 0) {
    container.innerHTML = `
      <div class="empty-state" style="padding: 20px;">
        <span class="icon" style="font-size: 32px;">📋</span>
        <div class="title" style="font-size: 14px;">لا يوجد سجل أحداث</div>
      </div>
    `;
    return;
  }

  container.innerHTML = events.map(item => {
    const date = item.created_at ? new Date(item.created_at).toLocaleString('ar-EG') : '';
    
    // Build description from event
    let description = '';
    let icon = '📌';
    
    if (item.event_type === 'status_change') {
      const fromLabel = getStatusLabel(item.from_status);
      const toLabel = getStatusLabel(item.to_status);
      description = `تغيير الحالة: ${fromLabel} → ${toLabel}`;
      icon = getHistoryIcon(item.to_status || 'status_change');
    } else if (item.event_type === 'received' || (item.from_status === null && item.to_status)) {
      const toLabel = getStatusLabel(item.to_status);
      description = `تم الاستلام - الحالة: ${toLabel}`;
      icon = '📋';
    } else if (item.event_type === 'part_consumed') {
      description = item.note || 'استهلاك قطعة غيار';
      icon = '✅';
    } else if (item.event_type === 'part_released') {
      description = item.note || 'فك حجز قطعة غيار';
      icon = '🔓';
    } else if (item.event_type === 'note') {
      description = item.note || 'ملاحظة';
      icon = '📝';
    } else {
      description = item.note || 'حدث غير محدد';
    }
    
    if (item.note && item.event_type !== 'note') {
      description += ` - ${item.note}`;
    }

    return `
      <div class="history-item">
        <span class="history-icon">${icon}</span>
        <div class="history-content">
          <div class="history-title">${window.escapeHtml(description)}</div>
          <div class="history-meta">${window.escapeHtml(item.created_by || '')} • ${date}</div>
        </div>
      </div>
    `;
  }).join('');
}

function renderTicketHistory(history) {
  const container = document.getElementById('detailHistoryList');
  if (!container) return;

  if (!history || history.length === 0) {
    container.innerHTML = `
      <div class="empty-state" style="padding: 20px;">
        <span class="icon" style="font-size: 32px;">📋</span>
        <div class="title" style="font-size: 14px;">لا يوجد سجل أحداث</div>
      </div>
    `;
    return;
  }

  container.innerHTML = history.map(item => {
    const date = item.created_at ? new Date(item.created_at).toLocaleString('ar-EG') : '';
    
    // Build description from status change
    let description = '';
    if (item.from_status === null && item.to_status) {
      description = `تم الاستلام - الحالة: ${getStatusLabel(item.to_status)}`;
    } else if (item.from_status && item.to_status) {
      description = `تغيير الحالة: ${getStatusLabel(item.from_status)} → ${getStatusLabel(item.to_status)}`;
    } else {
      description = item.note || 'حدث غير محدد';
    }
    
    if (item.note) {
      description += ` - ${item.note}`;
    }
    
    const icon = getHistoryIcon(item.to_status || 'status_change');

    return `
      <div class="history-item">
        <span class="history-icon">${icon}</span>
        <div class="history-content">
          <div class="history-title">${window.escapeHtml(description)}</div>
          <div class="history-meta">${window.escapeHtml(item.created_by || '')} • ${date}</div>
        </div>
      </div>
    `;
  }).join('');
}

function getStatusLabel(status) {
  return STATUS_CONFIG[status]?.label || status || '-';
}

function getHistoryIcon(status) {
  const icons = {
    'received': '📋',
    'diagnosing': '🔍',
    'waiting_approval': '⏳',
    'in_repair': '🔧',
    'ready': '✅',
    'delivered': '✅',
    'cancelled': '❌',
    'status_change': '🔄',
    'payment': '💰'
  };
  return icons[status] || '📌';
}

// ═══════════════════════════════════════════════════════════════
// 🔧 REPAIR PARTS MANAGEMENT
// ═══════════════════════════════════════════════════════════════
let allRepairParts = [];
let ticketParts = [];

async function loadRepairParts() {
  try {
    const parts = await apiRequest('elos-db://repair-parts');
    allRepairParts = parts || [];
    
    // Populate parts dropdown - عرض كل القطع حتى لو كانت الكمية 0
    const select = document.getElementById('repairPartSelect');
    if (select) {
      select.innerHTML = '<option value="">اختر قطعة...</option>' +
        allRepairParts.map(part => {
          const availableQty = part.qty || 0;
          // عرض الكمية المتاحة لكل قطعة
          let statusText = '';
          if (availableQty === 0) {
            statusText = ' - غير متوفر';
          } else {
            statusText = ` - متاح: ${availableQty}`;
          }
          const label = `${part.name}${part.category ? ' (' + part.category + ')' : ''}${statusText}`;
          // عرض كل القطع بدون تعطيل - المنطق في reservePart() سيمنع الحجز إذا كانت الكمية 0
          return `<option value="${part.id}">${window.escapeHtml(label)}</option>`;
        }).join('');
    }
  } catch (error) {
    Logger.error('Failed to load repair parts:', error);
    if (typeof showToast === 'function') {
      showToast('فشل في تحميل قطع الغيار', 'error');
    }
  }
}

// Make refresh function globally available for repair-parts.js
window.refreshRepairPartsList = loadRepairParts;

// ═══════════════════════════════════════════════════════════════
// 🆕 إضافة قطعة جديدة من التذكرة
// ═══════════════════════════════════════════════════════════════

function showAddPartModal() {
  // إزالة أي modal سابق
  const existingModal = document.getElementById('addPartModal');
  if (existingModal) existingModal.remove();

  const modal = document.createElement('div');
  modal.id = 'addPartModal';
  modal.style.cssText = 'position:fixed;top:0;left:0;right:0;bottom:0;background:rgba(0,0,0,0.85);z-index:99999;display:flex;align-items:center;justify-content:center;opacity:1;visibility:visible;';

  modal.innerHTML = `
    <div style="background: var(--card); border-radius: 16px; padding: 24px; width: 90%; max-width: 450px; max-height: 90vh; overflow-y: auto; box-shadow: 0 20px 60px rgba(0,0,0,0.5); border: 1px solid var(--line);">
      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px; border-bottom: 1px solid var(--line); padding-bottom: 16px;">
        <h3 style="margin: 0; font-size: 18px; font-weight: 700; color: var(--text);">
          <span style="margin-left: 8px;">➕</span>
          إضافة قطعة جديدة
        </h3>
        <button type="button" id="closeAddPartModal" style="background: none; border: none; font-size: 24px; cursor: pointer; color: var(--muted); padding: 4px 8px;">×</button>
      </div>

      <div style="display: flex; flex-direction: column; gap: 16px;">
        <div class="form-group" style="margin: 0;">
          <label class="form-label" style="margin-bottom: 6px; display: block;">اسم القطعة <span style="color: var(--danger);">*</span></label>
          <input type="text" id="newPartName" class="form-control" placeholder="مثال: شاشة آيفون 12" style="width: 100%;">
        </div>

        <div class="form-group" style="margin: 0;">
          <label class="form-label" style="margin-bottom: 6px; display: block;">الفئة</label>
          <input type="text" id="newPartCategory" class="form-control" placeholder="مثال: شاشات" style="width: 100%;">
        </div>

        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px;">
          <div class="form-group" style="margin: 0;">
            <label class="form-label" style="margin-bottom: 6px; display: block;">سعر التكلفة</label>
            <input type="number" id="newPartCost" class="form-control" placeholder="0" min="0" step="0.01" style="width: 100%;">
          </div>

          <div class="form-group" style="margin: 0;">
            <label class="form-label" style="margin-bottom: 6px; display: block;">سعر البيع</label>
            <input type="number" id="newPartSellPrice" class="form-control" placeholder="0" min="0" step="0.01" style="width: 100%;">
          </div>
        </div>

        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px;">
          <div class="form-group" style="margin: 0;">
            <label class="form-label" style="margin-bottom: 6px; display: block;">الكمية</label>
            <input type="number" id="newPartQty" class="form-control" placeholder="1" min="0" step="0.01" value="1" style="width: 100%;">
          </div>

          <div class="form-group" style="margin: 0;">
            <label class="form-label" style="margin-bottom: 6px; display: block;">الحد الأدنى</label>
            <input type="number" id="newPartMinQty" class="form-control" placeholder="0" min="0" step="1" value="0" style="width: 100%;">
          </div>
        </div>

        <div class="form-group" style="margin: 0;">
          <label class="form-label" style="margin-bottom: 6px; display: block;">ملاحظات</label>
          <textarea id="newPartNotes" class="form-control" placeholder="ملاحظات إضافية..." rows="2" style="width: 100%; resize: vertical;"></textarea>
        </div>

        <div id="addPartError" style="display: none; padding: 10px; background: var(--danger-bg); border: 1px solid var(--danger); border-radius: 8px; color: var(--danger); font-size: 13px;"></div>

        <div style="display: flex; gap: 12px; margin-top: 8px;">
          <button type="button" id="btnSaveNewPart" class="btn btn-primary" style="flex: 1; padding: 12px; font-size: 14px; font-weight: 600;">
            <span>💾</span>
            <span>حفظ القطعة</span>
          </button>
          <button type="button" id="btnCancelNewPart" class="btn btn-secondary" style="flex: 1; padding: 12px; font-size: 14px;">
            <span>إلغاء</span>
          </button>
        </div>
      </div>
    </div>
  `;

  document.body.appendChild(modal);

  // Focus على حقل الاسم
  setTimeout(() => {
    const nameInput = document.getElementById('newPartName');
    if (nameInput) nameInput.focus();
  }, 100);

  // Event handlers
  const closeModal = () => modal.remove();

  document.getElementById('closeAddPartModal').addEventListener('click', closeModal);
  document.getElementById('btnCancelNewPart').addEventListener('click', closeModal);

  // إغلاق بالضغط على الخلفية
  modal.addEventListener('click', (e) => {
    if (e.target === modal) closeModal();
  });

  // إغلاق بـ Escape
  const escHandler = (e) => {
    if (e.key === 'Escape') {
      closeModal();
      document.removeEventListener('keydown', escHandler);
    }
  };
  document.addEventListener('keydown', escHandler);

  // حفظ القطعة
  document.getElementById('btnSaveNewPart').addEventListener('click', async () => {
    const errorDiv = document.getElementById('addPartError');
    const name = document.getElementById('newPartName').value.trim();
    const category = document.getElementById('newPartCategory').value.trim();
    const unitCost = parseFloat(document.getElementById('newPartCost').value) || 0;
    const sellPrice = parseFloat(document.getElementById('newPartSellPrice').value) || 0;
    const qty = parseFloat(document.getElementById('newPartQty').value) || 0;
    const minQty = parseFloat(document.getElementById('newPartMinQty').value) || 0;
    const notes = document.getElementById('newPartNotes').value.trim();

    // التحقق من الاسم
    if (!name) {
      errorDiv.textContent = 'اسم القطعة مطلوب';
      errorDiv.style.display = 'block';
      document.getElementById('newPartName').focus();
      return;
    }

    errorDiv.style.display = 'none';

    try {
      const saveBtn = document.getElementById('btnSaveNewPart');
      saveBtn.disabled = true;
      saveBtn.innerHTML = '<span>⏳</span> <span>جاري الحفظ...</span>';

      const response = await fetch('elos-db://repair-parts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name,
          category: category || null,
          unit_cost: unitCost,
          sell_price: sellPrice,
          qty,
          min_qty: minQty,
          notes: notes || null
        })
      });

      if (!response.ok) {
        const errData = await response.json().catch(() => ({}));
        throw new Error(errData.message || 'فشل في حفظ القطعة');
      }

      const newPart = await response.json();

      // تحديث قائمة القطع
      await loadRepairParts();

      // اختيار القطعة الجديدة في الـ dropdown
      const select = document.getElementById('repairPartSelect');
      if (select && newPart.id) {
        select.value = newPart.id;
      }

      // إغلاق الـ modal
      closeModal();

      // إظهار رسالة نجاح
      if (typeof showToast === 'function') {
        showToast('تم إضافة القطعة بنجاح', 'success');
      }

    } catch (error) {
      Logger.error('Failed to save new part:', error);
      errorDiv.textContent = error.message || 'حدث خطأ أثناء حفظ القطعة';
      errorDiv.style.display = 'block';

      const saveBtn = document.getElementById('btnSaveNewPart');
      saveBtn.disabled = false;
      saveBtn.innerHTML = '<span>💾</span> <span>حفظ القطعة</span>';
    }
  });
}

async function loadTicketParts(ticketId) {
  try {
    const parts = await apiRequest(`elos-db://repairs/${ticketId}/parts`);
    ticketParts = parts || [];
    renderTicketPartsList(ticketParts);
  } catch (error) {
    Logger.error('Failed to load ticket parts:', error);
    ticketParts = [];
    renderTicketPartsList([]);
  }
}

// حساب مجموع أسعار قطع الغيار المحجوزة
function calculateReservedPartsTotal() {
  const reservedParts = ticketParts.filter(part => part.status === 'reserved');
  return reservedParts.reduce((sum, part) => {
    const unitPrice = part.unit_price && part.unit_price > 0 
      ? part.unit_price 
      : (part.part_sell_price && part.part_sell_price > 0 ? part.part_sell_price : (part.unit_cost || 0));
    return sum + ((part.qty || 0) * unitPrice);
  }, 0);
}

function renderTicketPartsList(parts) {
  const container = document.getElementById('repairPartsList');
  const emptyState = document.getElementById('repairPartsEmpty');
  if (!container) return;

  if (!parts || parts.length === 0) {
    container.innerHTML = '';
    if (emptyState) emptyState.style.display = 'flex';
    return;
  }

  if (emptyState) emptyState.style.display = 'none';

  const statusLabels = {
    'reserved': { label: 'محجوز', class: 'warning', icon: '🔒' },
    'deducted': { label: 'مستهلك', class: 'success', icon: '✅' },
    'consumed': { label: 'مستهلك', class: 'success', icon: '✅' },
    'released': { label: 'مفكوك الحجز', class: 'info', icon: '🔓' },
    'cancelled': { label: 'ملغي', class: 'cancelled', icon: '❌' }
  };

  container.innerHTML = parts.map(part => {
    const statusInfo = statusLabels[part.status] || { label: part.status, class: '', icon: '📦' };
    const canCancel = part.status === 'reserved';
    const date = part.updated_at ? new Date(part.updated_at).toLocaleString('ar-EG') : 
                 (part.created_at ? new Date(part.created_at).toLocaleString('ar-EG') : '');
    // Use unit_price (sell price) for display, fallback to sell_price or unit_cost for legacy rows
    const unitPrice = part.unit_price && part.unit_price > 0 
      ? part.unit_price 
      : (part.part_sell_price && part.part_sell_price > 0 ? part.part_sell_price : (part.unit_cost || 0));
    const totalCost = (part.qty || 0) * unitPrice;
    const partName = window.escapeHtml(part.part_name || 'غير محدد');
    const category = part.part_category ? ` <span style="color: var(--muted); font-size: 11px;">(${window.escapeHtml(part.part_category)})</span>` : '';

    return `
      <tr style="border-bottom: 1px solid var(--line);">
        <td style="padding: 10px; text-align: right; font-size: 12px;">
          <strong>${partName}</strong>${category}
        </td>
        <td style="padding: 10px; text-align: right; font-size: 12px;">
          ${window.fmt(part.qty || 0, 2)}
        </td>
        <td style="padding: 10px; text-align: right; font-size: 12px;">
          ${window.fmt(unitPrice, 2)} ج.م
        </td>
        <td style="padding: 10px; text-align: right; font-size: 12px; font-weight: 600;">
          ${window.fmt(totalCost, 2)} ج.م
        </td>
        <td style="padding: 10px; text-align: right; font-size: 12px;">
          <span class="status-badge ${statusInfo.class}">${statusInfo.label}</span>
        </td>
        <td style="padding: 10px; text-align: right; font-size: 11px; color: var(--muted);">
          ${date}
        </td>
        <td style="padding: 10px; text-align: right; font-size: 12px;">
          ${canCancel ? `
            <button class="btn-action" onclick="cancelPartReservation(${part.id})" style="background: rgba(239, 68, 68, 0.15); color: var(--danger); padding: 4px 8px; font-size: 11px;">
              <span>❌</span>
              <span>إلغاء</span>
            </button>
          ` : '-'}
        </td>
      </tr>
    `;
  }).join('');
}

async function reservePart() {
  const partSelect = document.getElementById('repairPartSelect');
  const qtyInput = document.getElementById('repairPartQty');
  const errorDiv = document.getElementById('repairPartError');

  if (!partSelect || !qtyInput || !currentRepairId) {
    return;
  }

  const partId = partSelect.value;
  const qty = parseFloat(qtyInput.value);

  // Reset error
  if (errorDiv) {
    errorDiv.style.display = 'none';
    errorDiv.textContent = '';
  }

  // Validation
  if (!partId) {
    if (errorDiv) {
      errorDiv.textContent = 'يرجى اختيار قطعة';
      errorDiv.style.display = 'block';
    }
    return;
  }

  if (!qty || qty <= 0) {
    if (errorDiv) {
      errorDiv.textContent = 'يرجى إدخال كمية صحيحة';
      errorDiv.style.display = 'block';
    }
    return;
  }

  // التحقق من الكمية المتاحة - منع الحجز إذا كانت الكمية 0
  const selectedPart = allRepairParts.find(p => p.id === parseInt(partId));
  if (selectedPart) {
    const availableQty = parseFloat(selectedPart.qty || 0);
    if (availableQty === 0) {
      if (errorDiv) {
        errorDiv.textContent = 'لا يمكن حجز هذه القطعة - الكمية غير متوفرة';
        errorDiv.style.display = 'block';
      }
      if (typeof showToast === 'function') {
        showToast('لا يمكن حجز هذه القطعة - الكمية غير متوفرة', 'error');
      }
      return;
    }
    
    if (qty > availableQty) {
      if (errorDiv) {
        errorDiv.textContent = `الكمية المطلوبة (${window.fmt(qty, 2)}) أكبر من الكمية المتاحة (${window.fmt(availableQty, 2)})`;
        errorDiv.style.display = 'block';
      }
      if (typeof showToast === 'function') {
        showToast(`الكمية المطلوبة أكبر من الكمية المتاحة`, 'error');
      }
      return;
    }
  }

  try {
    const result = await apiRequest(`elos-db://repairs/${currentRepairId}/parts/reserve`, {
      method: 'POST',
      body: JSON.stringify({
        part_id: parseInt(partId),
        qty: qty
      })
    });

    if (result.ok) {
      if (typeof showToast === 'function') {
        showToast('تم حجز القطعة بنجاح', 'success');
      }
      
      // Clear form
      partSelect.value = '';
      qtyInput.value = '';
      
      // Reload parts list
      await loadTicketParts(currentRepairId);
      await loadTicketEvents(currentRepairId); // Reload events to show the reservation event
      await loadRepairParts(); // Reload parts to update available quantities
      
      // ✅ تحديث التكلفة تلقائياً بعد حجز القطعة
      await updateRepairTotalCost();
    }
  } catch (error) {
    Logger.error('Failed to reserve part:', error);
    const errorMsg = error.message || 'فشل في حجز القطعة';
    if (errorDiv) {
      errorDiv.textContent = errorMsg;
      errorDiv.style.display = 'block';
    }
    if (typeof showToast === 'function') {
      showToast(errorMsg, 'error');
    }
  }
}

async function cancelPartReservation(ticketPartId) {
  if (!currentRepairId || !ticketPartId) {
    return;
  }

  if (!confirm('هل أنت متأكد من إلغاء حجز هذه القطعة؟')) {
    return;
  }

  try {
    const result = await apiRequest(`elos-db://repairs/${currentRepairId}/parts/cancel`, {
      method: 'POST',
      body: JSON.stringify({
        ticket_part_id: ticketPartId
      })
    });

    if (result.ok) {
      if (typeof showToast === 'function') {
        showToast('تم إلغاء الحجز بنجاح', 'success');
      }
      
      // Reload parts list
      await loadTicketParts(currentRepairId);
      await loadTicketEvents(currentRepairId); // Reload events to show the cancellation event
      await loadRepairParts(); // Reload parts to update available quantities
      
      // ✅ تحديث التكلفة تلقائياً بعد إلغاء الحجز
      await updateRepairTotalCost();
    }
  } catch (error) {
    Logger.error('Failed to cancel part reservation:', error);
    if (typeof showToast === 'function') {
      showToast(error.message || 'فشل في إلغاء الحجز', 'error');
    }
  }
}

// Make cancelPartReservation available globally
window.cancelPartReservation = cancelPartReservation;

// ═══════════════════════════════════════════════════════════════
// 💰 PAYMENT MANAGEMENT
// ═══════════════════════════════════════════════════════════════
async function loadTicketPayments(ticketId) {
  try {
    const data = await apiRequest(`elos-db://repairs/${ticketId}/payments`);
    
    // حساب مجموع قطع الغيار المحجوزة (يجب أن تكون ticketParts محملة مسبقاً)
    const reservedPartsTotal = calculateReservedPartsTotal();
    
    // Update total cost field - عرض service fee فقط (total_cost - partsTotal)
    const totalCostInput = document.getElementById('repairTotalCost');
    if (totalCostInput) {
      const serviceFee = Math.max(0, (data.total_cost || 0) - reservedPartsTotal);
      totalCostInput.value = serviceFee;
      // حفظ القيمة الحالية لمنع الحفظ المكرر
      totalCostInput.dataset.lastServiceFee = serviceFee.toString();
    }

    // Update paid and remaining displays
    const paidTotalEl = document.getElementById('repairPaidTotal');
    const remainingEl = document.getElementById('repairRemaining');
    if (paidTotalEl) {
      paidTotalEl.textContent = `${window.fmt(data.total_paid || 0, 2)} ج.م`;
    }
    if (remainingEl) {
      const remaining = data.remaining || 0;
      remainingEl.textContent = `${window.fmt(remaining, 2)} ج.م`;
      // Change color based on remaining amount
      if (remaining <= 0) {
        remainingEl.style.color = 'var(--success)';
      } else {
        remainingEl.style.color = 'var(--warning)';
      }
    }

    // Render payments list
    renderPaymentsList(data.payments || []);
  } catch (error) {
    Logger.error('Failed to load ticket payments:', error);
    // Show empty state
    renderPaymentsList([]);
  }
}

function renderPaymentsList(payments) {
  const container = document.getElementById('repairPaymentsList');
  if (!container) return;

  if (!payments || payments.length === 0) {
    container.innerHTML = `
      <div class="empty-state" style="padding: 20px;">
        <span class="icon" style="font-size: 32px;">💰</span>
        <div class="title" style="font-size: 14px;">لا توجد مدفوعات</div>
      </div>
    `;
    return;
  }

  const methodLabels = {
    'cash': 'كاش',
    'mobile_wallet': 'محفظة إلكترونية',
    'card': 'محفظة إلكترونية',
    'bank': 'تحويل بنكي',
    'transfer': 'تحويل بنكي'
  };

  const kindLabels = {
    'deposit': 'عربون',
    'partial': 'دفعة',
    'final': 'تسوية',
    'refund': 'استرداد'
  };

  container.innerHTML = payments.map(payment => {
    const methodLabel = methodLabels[payment.method || payment.wallet_type] || 'كاش';
    const kindLabel = kindLabels[payment.kind] || 'دفعة';
    const date = payment.created_at ? new Date(payment.created_at).toLocaleString('ar-EG') : '';
    const amount = payment.amount || 0;
    const note = payment.note ? ` - ${window.escapeHtml(payment.note)}` : '';

    return `
      <div class="history-item">
        <span class="history-icon">💰</span>
        <div class="history-content">
          <div class="history-title">${kindLabel}: ${window.fmt(amount, 2)} ج.م - ${methodLabel}${note}</div>
          <div class="history-meta">${window.escapeHtml(payment.created_by || '')} • ${date}</div>
        </div>
      </div>
    `;
  }).join('');
}

// ═══════════════════════════════════════════════════════════════
// ✏️ ADJUSTMENT CREATION (Phase 3 & 4)
// ═══════════════════════════════════════════════════════════════
function openAdjustmentReasonModal() {
  const modal = document.getElementById('adjustmentReasonModal');
  if (!modal) return;
  
  // Reset form
  const reasonTextarea = document.getElementById('adjustmentReason');
  const errorEl = document.getElementById('adjustmentReasonError');
  if (reasonTextarea) reasonTextarea.value = '';
  if (errorEl) {
    errorEl.textContent = '';
    errorEl.style.display = 'none';
  }
  
  modal.classList.add('active');
  
  // Focus textarea
  if (reasonTextarea) {
    setTimeout(() => reasonTextarea.focus(), 100);
  }
}

function closeAdjustmentReasonModal() {
  const modal = document.getElementById('adjustmentReasonModal');
  if (modal) {
    modal.classList.remove('active');
  }
}

async function createAdjustmentTicket() {
  Logger.log('[Adjustment] Confirm clicked', { currentTicketId });

  if (!currentTicketId) {
    showPolicyMessage('لا توجد تذكرة مفتوحة');
    return;
  }

  const reasonTextarea = document.getElementById('adjustmentReason');
  const errorEl = document.getElementById('adjustmentReasonError');
  const btnConfirm = document.getElementById('btnConfirmAdjustment');

  if (!reasonTextarea || !errorEl || !btnConfirm) {
    Logger.warn('[Adjustment] Missing DOM elements', {
      reasonTextarea: !!reasonTextarea,
      errorEl: !!errorEl,
      btnConfirm: !!btnConfirm
    });
    return;
  }
  
  const reason = reasonTextarea.value.trim();
  
  // Validation (Phase 4)
  if (reason.length < 20) {
    errorEl.textContent = 'سبب التعديل إلزامي (20 حرف على الأقل).';
    errorEl.style.display = 'block';
    return;
  }
  
  errorEl.style.display = 'none';
  btnConfirm.disabled = true;
  const originalText = btnConfirm.innerHTML;
  btnConfirm.innerHTML = '<span>⏳</span> <span>جاري الإنشاء...</span>';
  
  try {
    const result = await apiRequest(`elos-db://repairs/${currentTicketId}/create-adjustment`, {
      method: 'POST',
      body: JSON.stringify({ reason })
    });
    
    if (result.ok && result.adjustment_id) {
      closeAdjustmentReasonModal();
      
      if (typeof showToast === 'function') {
        showToast('تم إنشاء تذكرة تعديل بنجاح.', 'success');
      }
      
      // Open the newly created adjustment ticket (Phase 4)
      setTimeout(() => {
        openDetailsModal(result.adjustment_id);
      }, 300);
    } else {
      throw new Error(result.error || 'فشل إنشاء التعديل');
    }
  } catch (error) {
    Logger.error('Failed to create adjustment:', error);
    
    let errorMsg = 'فشل إنشاء التعديل';
    if (error.message && error.message.includes('403')) {
      errorMsg = 'صلاحيات غير كافية لإنشاء تعديل.';
    } else if (error.message && error.message.includes('401')) {
      errorMsg = 'صلاحيات غير كافية لإنشاء تعديل.';
    } else if (error.message) {
      errorMsg = error.message;
    }
    
    errorEl.textContent = errorMsg;
    errorEl.style.display = 'block';
    
    if (typeof showToast === 'function') {
      showToast(errorMsg, 'error');
    }
  } finally {
    btnConfirm.disabled = false;
    btnConfirm.innerHTML = originalText;
  }
}

// ═══════════════════════════════════════════════════════════════
// 🔗 LINKED ADJUSTMENTS & AGGREGATES
// ═══════════════════════════════════════════════════════════════

// Load and render linked adjustments for original ticket
async function loadLinkedAdjustments(ticketId) {
  try {
    const adjustments = await apiRequest(`elos-db://repairs/${ticketId}/adjustments`);
    
    const section = document.getElementById('linkedAdjustmentsSection');
    const list = document.getElementById('linkedAdjustmentsList');
    
    if (!section || !list) return;
    
    if (!adjustments || adjustments.length === 0) {
      section.style.display = 'none';
      return;
    }
    
    section.style.display = 'block';
    
    // Render adjustments list
    if (Array.isArray(adjustments)) {
      list.innerHTML = adjustments.map(adj => {
        const date = adj.created_at ? new Date(adj.created_at).toLocaleDateString('ar-EG') : '-';
        const reasonSnippet = (adj.adjustment_reason || '').substring(0, 50);
        const totalCost = window.fmt(adj.total_cost || 0, 2);
        const paidAmount = window.fmt(adj.paid_amount || 0, 2);
        const statusConfig = STATUS_CONFIG[adj.status] || STATUS_CONFIG['received'];
        
        return `
          <div style="padding: 12px; margin-bottom: 8px; background: var(--surface-hover); border-radius: 6px; border: 1px solid var(--border);">
            <div style="display: flex; justify-content: space-between; align-items: start; margin-bottom: 8px;">
              <div style="flex: 1;">
                <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 4px;">
                  <span style="font-weight: 600; color: var(--text-primary);">${adj.ticket_no || '#' + adj.id}</span>
                  <span class="status-badge ${statusConfig.class}" style="font-size: 10px;">${statusConfig.label}</span>
                </div>
                <div style="font-size: 12px; color: var(--text-secondary); margin-bottom: 4px;">
                  <span>📅 ${date}</span>
                  ${adj.created_by ? `<span style="margin-right: 12px;">👤 ${adj.created_by}</span>` : ''}
                </div>
                ${reasonSnippet ? `<div style="font-size: 11px; color: var(--text-muted); margin-top: 4px;">${window.escapeHtml(reasonSnippet)}${(adj.adjustment_reason || '').length > 50 ? '...' : ''}</div>` : ''}
              </div>
              <div style="text-align: left; margin-right: 12px;">
                <div style="font-size: 12px; color: var(--text-secondary);">الإجمالي</div>
                <div style="font-weight: 600; color: var(--text-primary);">${totalCost} ج.م</div>
                <div style="font-size: 11px; color: var(--success); margin-top: 2px;">مدفوع: ${paidAmount} ج.م</div>
              </div>
            </div>
            <button type="button" class="btn btn-sm btn-primary" onclick="openDetailsModal(${adj.id})" style="padding: 4px 12px; font-size: 11px;">
              <span>🔗</span>
              <span>فتح التعديل</span>
            </button>
          </div>
        `;
      }).join('');
    } else {
      list.innerHTML = '<div style="padding: 12px; text-align: center; color: var(--text-muted);">لا توجد تعديلات مرتبطة</div>';
    }
  } catch (error) {
    Logger.error('Failed to load linked adjustments:', error);
    const section = document.getElementById('linkedAdjustmentsSection');
    if (section) section.style.display = 'none';
  }
}

// Load and render aggregated totals for original ticket
async function loadAggregatedTotals(ticketId) {
  try {
    const aggregates = await apiRequest(`elos-db://repairs/${ticketId}/aggregates`);
    
    const section = document.getElementById('aggregatedTotalsSection');
    if (!section) return;
    
    if (!aggregates) {
      section.style.display = 'none';
      return;
    }
    
    // Show section only if there are adjustments (delta != 0)
    const adjustmentsDelta = aggregates.adjustments?.total_delta || aggregates.adjustments_total_delta || 0;
    const adjustmentsPaidDelta = aggregates.adjustments?.paid_delta || aggregates.adjustments_paid_delta || 0;
    
    if (adjustmentsDelta === 0 && adjustmentsPaidDelta === 0) {
      section.style.display = 'none';
      return;
    }
    
    section.style.display = 'block';
    
    // Support both nested and flat structure (backward compatibility)
    const original = aggregates.original || {
      total: aggregates.original_total || 0,
      paid: aggregates.original_paid || 0,
      remaining: aggregates.original_remaining || 0
    };
    const adjustments = aggregates.adjustments || {
      total_delta: aggregates.adjustments_total_delta || 0,
      paid_delta: aggregates.adjustments_paid_delta || 0
    };
    const final = aggregates.final || {
      total: aggregates.final_total || 0,
      paid: aggregates.final_paid || 0,
      remaining: aggregates.final_remaining || 0
    };
    
    // Update aggregate fields
    const originalTotalEl = document.getElementById('aggOriginalTotal');
    const adjustmentsDeltaEl = document.getElementById('aggAdjustmentsDelta');
    const finalTotalEl = document.getElementById('aggFinalTotal');
    const finalPaidEl = document.getElementById('aggFinalPaid');
    const finalRemainingEl = document.getElementById('aggFinalRemaining');
    
    if (originalTotalEl) {
      originalTotalEl.textContent = `${window.fmt(original.total || 0, 2)} ج.م`;
    }
    
    if (adjustmentsDeltaEl) {
      const delta = adjustments.total_delta || 0;
      adjustmentsDeltaEl.textContent = `${delta >= 0 ? '+' : ''}${window.fmt(delta, 2)} ج.م`;
      adjustmentsDeltaEl.style.color = delta >= 0 ? 'var(--success)' : 'var(--danger)';
    }
    
    if (finalTotalEl) {
      finalTotalEl.textContent = `${window.fmt(final.total || 0, 2)} ج.م`;
    }
    
    if (finalPaidEl) {
      finalPaidEl.textContent = `${window.fmt(final.paid || 0, 2)} ج.م`;
    }
    
    if (finalRemainingEl) {
      const remaining = final.remaining || 0;
      finalRemainingEl.textContent = `${window.fmt(remaining, 2)} ج.م`;
      finalRemainingEl.style.color = remaining <= 0 ? 'var(--success)' : 'var(--warning)';
    }
  } catch (error) {
    Logger.error('Failed to load aggregated totals:', error);
    const section = document.getElementById('aggregatedTotalsSection');
    if (section) section.style.display = 'none';
  }
}

// Make function globally accessible for onblur handler
window.updateRepairTotalCost = async function updateRepairTotalCost() {
  // Policy check: exit early if locked
  if (currentTicket && isTicketFinanciallyClosed(currentTicket)) {
    showPolicyMessage('لا يمكن تعديل هذه التذكرة لأنها مُقفلة مالياً. استخدم: إنشاء تعديل.');
    return;
  }
  
  if (!currentRepairId) return;

  const totalCostInput = document.getElementById('repairTotalCost');
  if (!totalCostInput) return;

  const serviceFee = parseFloat(totalCostInput.value) || 0;
  if (serviceFee < 0) {
    if (typeof showToast === 'function') {
      showToast('تكلفة الصيانة يجب أن تكون أكبر من أو تساوي صفر', 'error');
    }
    return;
  }

  // ✅ التحقق من تغيير القيمة - منع الحفظ المكرر
  const lastServiceFee = parseFloat(totalCostInput.dataset.lastServiceFee || '0');
  if (serviceFee === lastServiceFee) {
    // القيمة لم تتغير - لا حاجة للحفظ
    return;
  }

  // حساب مجموع قطع الغيار المحجوزة
  const reservedPartsTotal = calculateReservedPartsTotal();
  
  // التكلفة الإجمالية = تكلفة الصيانة + قطع الغيار المحجوزة
  const totalCost = serviceFee + reservedPartsTotal;

  try {
    const result = await apiRequest(`elos-db://repairs/${currentRepairId}/total_cost`, {
      method: 'PUT',
      body: JSON.stringify({ total_cost: totalCost })
    });

    // ✅ تحديث القيمة المحفوظة
    totalCostInput.dataset.lastServiceFee = serviceFee.toString();

    // Update displays
    const paidTotalEl = document.getElementById('repairPaidTotal');
    const remainingEl = document.getElementById('repairRemaining');
    if (paidTotalEl) {
      paidTotalEl.textContent = `${window.fmt(result.total_paid || 0, 2)} ج.م`;
    }
    if (remainingEl) {
      const remaining = result.remaining || 0;
      remainingEl.textContent = `${window.fmt(remaining, 2)} ج.م`;
      if (remaining <= 0) {
        remainingEl.style.color = 'var(--success)';
      } else {
        remainingEl.style.color = 'var(--warning)';
      }
    }

    // Reload events to show the new note event
    await loadTicketEvents(currentRepairId);

    if (typeof showToast === 'function') {
      showToast('تم تحديث التكلفة الإجمالية', 'success');
    }
  } catch (error) {
    Logger.error('Failed to update total cost:', error);
    if (typeof showToast === 'function') {
      showToast(error.message || 'فشل في تحديث التكلفة الإجمالية', 'error');
    }
  }
}

async function addRepairPayment() {
  // Policy check: exit early if locked
  if (currentTicket && isTicketFinanciallyClosed(currentTicket)) {
    showPolicyMessage('لا يمكن تعديل هذه التذكرة لأنها مُقفلة مالياً. استخدم: إنشاء تعديل.');
    return;
  }
  
  if (!currentRepairId) {
    if (typeof showToast === 'function') {
      showToast('لا توجد تذكرة مفتوحة', 'error');
    }
    return;
  }

  const amountInput = document.getElementById('repairPayAmount');
  const methodSelect = document.getElementById('repairPayMethod');
  const noteInput = document.getElementById('repairPayNote');
  const errorDiv = document.getElementById('repairPayError');
  const payButton = document.getElementById('btnRepairPay');

  if (!amountInput || !methodSelect) return;

  const amount = parseFloat(amountInput.value) || 0;
  const method = methodSelect.value;
  const walletSelect = document.getElementById('repairWalletSelect');
  const walletId = walletSelect && walletSelect.value ? parseInt(walletSelect.value) : null;
  const note = noteInput ? noteInput.value.trim() : '';

  // Validation
  if (amount <= 0) {
    if (errorDiv) {
      errorDiv.textContent = 'المبلغ يجب أن يكون أكبر من صفر';
      errorDiv.style.display = 'block';
    }
    amountInput.focus();
    return;
  }

  // Hide error
  if (errorDiv) {
    errorDiv.style.display = 'none';
  }

  // Disable button during request
  if (payButton) {
    payButton.disabled = true;
    const originalText = payButton.innerHTML;
    payButton.innerHTML = '<span>⏳</span> <span>جاري المعالجة...</span>';
  }

  try {
    const result = await apiRequest(`elos-db://repairs/${currentRepairId}/payments`, {
      method: 'POST',
      body: JSON.stringify({
        amount: amount,
        method: method,
        wallet_id: walletId,
        wallet_type: method, // للتوافق العكسي
        note: note || null
      })
    });

    // Clear form
    if (amountInput) amountInput.value = '';
    if (noteInput) noteInput.value = '';
    if (methodSelect) methodSelect.value = 'cash';
    if (walletSelect) {
      walletSelect.innerHTML = '<option value="">جاري التحميل...</option>';
      document.getElementById('repairWalletSelectGroup').style.display = 'none';
    }

    // Update displays
    const paidTotalEl = document.getElementById('repairPaidTotal');
    const remainingEl = document.getElementById('repairRemaining');
    if (paidTotalEl) {
      paidTotalEl.textContent = `${window.fmt(result.total_paid || 0, 2)} ج.م`;
    }
    if (remainingEl) {
      const remaining = result.remaining || 0;
      remainingEl.textContent = `${window.fmt(remaining, 2)} ج.م`;
      if (remaining <= 0) {
        remainingEl.style.color = 'var(--success)';
      } else {
        remainingEl.style.color = 'var(--warning)';
      }
    }

    // Reload payments list and events
    await loadTicketPayments(currentRepairId);
    await loadTicketEvents(currentRepairId);

    // Update dashboard stats to reflect new payment
    await updateDashboardStats();

    if (typeof showToast === 'function') {
      showToast('تم تسجيل الدفع بنجاح', 'success');
    }

    // Play success sound if available
    if (typeof playSound === 'function') {
      playSound('success');
    }
  } catch (error) {
    Logger.error('Failed to add payment:', error);
    if (errorDiv) {
      errorDiv.textContent = error.message || 'فشل في تسجيل الدفع';
      errorDiv.style.display = 'block';
    }
    if (typeof showToast === 'function') {
      showToast(error.message || 'فشل في تسجيل الدفع', 'error');
    }
  } finally {
    // Re-enable button
    if (payButton) {
      payButton.disabled = false;
      payButton.innerHTML = '<span>💰</span> <span>تحصيل</span>';
    }
  }
}

// ═══════════════════════════════════════════════════════════════
// 💳 PAYMENT WALLETS MANAGEMENT
// ═══════════════════════════════════════════════════════════════
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

// ✅ تحديث قائمة المحافظ للعربون في استلام الجهاز
async function updateIntakeDepositWalletsList() {
  const walletTypeSelect = document.getElementById('intakeDepositWallet');
  const walletSelectGroup = document.getElementById('intakeDepositWalletSelectGroup');
  const walletSelect = document.getElementById('intakeDepositWalletSelect');
  
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
}
window.updateIntakeDepositWalletsList = updateIntakeDepositWalletsList;

// Update wallets list when payment method changes
async function updateRepairWalletsList() {
  const methodSelect = document.getElementById('repairPayMethod');
  const walletSelectGroup = document.getElementById('repairWalletSelectGroup');
  const walletSelect = document.getElementById('repairWalletSelect');
  
  if (!methodSelect || !walletSelectGroup || !walletSelect) return;
  
  const method = methodSelect.value;
  
  // Load wallets if not already loaded
  if (paymentWallets.length === 0) {
    await loadPaymentWallets();
  }
  
  // Filter wallets by type
  const filteredWallets = paymentWallets.filter(w => w.type === method);
  
  if (filteredWallets.length === 0) {
    // No wallets of this type, hide the select
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

// Make function available globally
window.updateRepairWalletsList = updateRepairWalletsList;

// ═══════════════════════════════════════════════════════════════
// 🎯 EVENT HANDLERS
// ═══════════════════════════════════════════════════════════════
// ═══════════════════════════════════════════════════════════════
// 🔍 QUICK SEARCH INITIALIZATION
// ═══════════════════════════════════════════════════════════════
function initRepairsQuickSearch() {
  const input = document.getElementById('repairsQuickSearch');
  const clearBtn = document.getElementById('repairsQuickSearchClear');
  const helpBtn = document.getElementById('repairsShortcutsBtn');

  if (input) {
    input.addEventListener('input', () => {
      quickSearchTerm = input.value;
      applyRepairsQuickSearch(true);
    });
  }

  if (clearBtn) {
    clearBtn.addEventListener('click', () => {
      if (input) input.value = '';
      quickSearchTerm = '';
      applyRepairsQuickSearch(true);
      input?.focus();
    });
  }

  if (helpBtn) {
    helpBtn.addEventListener('click', openShortcutsModal);
  }
}

function scrollActiveRowIntoView() {
  const tbody = document.getElementById('ticketsBody');
  if (!tbody) return;
  const row = tbody.querySelector(`tr[data-index="${activeRowIndex}"]`);
  row?.scrollIntoView({block: 'nearest'});
}

function isTypingTarget(el) {
  if (!el) return false;
  const tag = el.tagName?.toLowerCase();
  return tag === 'input' || tag === 'textarea' || el.isContentEditable;
}

// Keyboard shortcuts handler
function initRepairsKeyboardShortcuts() {
  document.addEventListener('keydown', (e) => {
    const input = document.getElementById('repairsQuickSearch');

    // Ctrl+K
    if (e.ctrlKey && e.key.toLowerCase() === 'k') {
      e.preventDefault();
      input?.focus();
      input?.select();
      return;
    }

    // Ctrl+R refresh
    if (e.ctrlKey && e.key.toLowerCase() === 'r') {
      e.preventDefault();
      loadTickets();
      return;
    }

    // Ctrl+N new intake
    if (e.ctrlKey && e.key.toLowerCase() === 'n') {
      e.preventDefault();
      openIntakeModal();
      return;
    }

    // Help
    if (!e.ctrlKey && e.key === '?') {
      if (!isTypingTarget(document.activeElement)) {
        e.preventDefault();
        openShortcutsModal();
      }
      return;
    }

    // Esc behavior: if search focused and no modal open -> clear only
    const activeModal = document.querySelector('.repairs-modal.active, #shortcutsModal.active');
    if (e.key === 'Escape' && document.activeElement === input && !activeModal) {
      e.preventDefault();
      input.value = '';
      quickSearchTerm = '';
      applyRepairsQuickSearch(true);
      input.blur();
      return;
    }

    // Row navigation (only when not typing and no modal open)
    if (!isTypingTarget(document.activeElement)) {
      const activeModal = document.querySelector('.repairs-modal.active, #shortcutsModal.active');
      if (activeModal) return; // Don't navigate when modal is open

      if (e.key === 'ArrowDown') {
        if (filteredTickets.length) {
          e.preventDefault();
          activeRowIndex = Math.min(filteredTickets.length - 1, activeRowIndex + 1);
          renderTicketsTable();
          scrollActiveRowIntoView();
        }
        return;
      }
      if (e.key === 'ArrowUp') {
        if (filteredTickets.length) {
          e.preventDefault();
          activeRowIndex = Math.max(0, activeRowIndex - 1);
          renderTicketsTable();
          scrollActiveRowIntoView();
        }
        return;
      }
      if (e.key === 'Enter') {
        const t = filteredTickets[activeRowIndex];
        if (t) {
          e.preventDefault();
          openDetailsModal(t.id);
        }
        return;
      }
    }
  });
}

// Shortcuts modal functions
function openShortcutsModal() {
  const modal = document.getElementById('shortcutsModal');
  if (modal) modal.classList.add('active');
}

function closeShortcutsModal() {
  const modal = document.getElementById('shortcutsModal');
  if (modal) modal.classList.remove('active');
}

window.openShortcutsModal = openShortcutsModal;
window.closeShortcutsModal = closeShortcutsModal;

// Wire shortcuts modal close button
function initShortcutsModal() {
  const closeBtn = document.getElementById('shortcutsModalClose');
  if (closeBtn) {
    closeBtn.addEventListener('click', closeShortcutsModal);
  }
  // Also close on backdrop click
  const modal = document.getElementById('shortcutsModal');
  if (modal) {
    modal.addEventListener('click', (e) => {
      if (e.target === modal) {
        closeShortcutsModal();
      }
    });
  }
}

function initEventHandlers() {
  // New Ticket Button
  const btnNewTicket = document.getElementById('btnNewTicket');
  if (btnNewTicket) {
    btnNewTicket.addEventListener('click', openIntakeModal);
  }

  // Intake Modal - Close buttons
  const intakeModalClose = document.getElementById('intakeModalClose');
  const btnCancelIntake = document.getElementById('btnCancelIntake');

  if (intakeModalClose) intakeModalClose.addEventListener('click', closeIntakeModal);
  if (btnCancelIntake) btnCancelIntake.addEventListener('click', closeIntakeModal);

  // Intake Modal - Form submit
  const intakeForm = document.getElementById('intakeForm');
  if (intakeForm) {
    intakeForm.addEventListener('submit', submitIntakeForm);
  }

  // Add accessory button
  const btnAddAccessory = document.getElementById('btnAddAccessory');
  if (btnAddAccessory) {
    btnAddAccessory.addEventListener('click', addAccessory);
  }

  // Add accessory on Enter key
  const accessoryInput = document.getElementById('accessoryInput');
  if (accessoryInput) {
    accessoryInput.addEventListener('keypress', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        addAccessory();
      }
    });
  }

  // Toggle passcode visibility
  const togglePasscodeBtn = document.getElementById('togglePasscode');
  if (togglePasscodeBtn) {
    togglePasscodeBtn.addEventListener('click', togglePasscodeVisibility);
  }

  // Details Modal - Close buttons
  const detailsModalClose = document.getElementById('detailsModalClose');
  const btnCloseDetails = document.getElementById('btnCloseDetails');

  if (detailsModalClose) detailsModalClose.addEventListener('click', closeDetailsModal);
  if (btnCloseDetails) btnCloseDetails.addEventListener('click', closeDetailsModal);

  // Details Modal - Technician edit / save / cancel
  const btnEditTech = document.getElementById('btnEditTechnician');
  const btnSaveTech = document.getElementById('btnSaveTechnician');
  const btnCancelTech = document.getElementById('btnCancelTechnician');
  const detailTechnicianDisplay = document.getElementById('detailTechnicianDisplay');
  const detailTechnicianSelect = document.getElementById('detailTechnicianSelect');

  if (btnEditTech) {
    btnEditTech.addEventListener('click', () => {
      if (detailTechnicianDisplay) detailTechnicianDisplay.style.display = 'none';
      if (detailTechnicianSelect) {
        detailTechnicianSelect.style.display = 'block';
        detailTechnicianSelect.value = (detailTechnicianDisplay && detailTechnicianDisplay.textContent !== '-') ? detailTechnicianDisplay.textContent : '';
      }
      btnEditTech.style.display = 'none';
      if (btnSaveTech) btnSaveTech.style.display = 'inline-flex';
      if (btnCancelTech) btnCancelTech.style.display = 'inline-flex';
    });
  }
  if (btnCancelTech) {
    btnCancelTech.addEventListener('click', () => {
      if (detailTechnicianDisplay) detailTechnicianDisplay.style.display = '';
      if (detailTechnicianSelect) detailTechnicianSelect.style.display = 'none';
      if (btnEditTech) btnEditTech.style.display = 'inline-flex';
      if (btnSaveTech) btnSaveTech.style.display = 'none';
      btnCancelTech.style.display = 'none';
      if (detailTechnicianSelect) detailTechnicianSelect.value = (detailTechnicianDisplay && detailTechnicianDisplay.textContent !== '-') ? detailTechnicianDisplay.textContent : '';
    });
  }
  if (btnSaveTech) {
    btnSaveTech.addEventListener('click', async () => {
      if (currentRepairId == null) return;
      const newName = detailTechnicianSelect ? (detailTechnicianSelect.value || '').trim() : '';
      try {
        await apiRequest(`elos-db://repairs/${currentRepairId}`, {
          method: 'PUT',
          body: JSON.stringify({ assigned_tech_name: newName || null })
        });
        if (detailTechnicianDisplay) {
          detailTechnicianDisplay.textContent = newName || '-';
          detailTechnicianDisplay.style.display = '';
        }
        if (detailTechnicianSelect) detailTechnicianSelect.style.display = 'none';
        if (btnEditTech) btnEditTech.style.display = 'inline-flex';
        btnSaveTech.style.display = 'none';
        if (btnCancelTech) btnCancelTech.style.display = 'none';
        if (currentTicket) currentTicket.assigned_tech_name = newName || null;
        if (typeof showToast === 'function') showToast('تم تحديث اسم الفني', 'success');
      } catch (e) {
        Logger.error('Failed to update technician:', e);
        if (typeof showToast === 'function') showToast(e.message || 'فشل في تحديث الفني', 'error');
      }
    });
  }

  // Details Modal - Update status button
  const btnChangeStatus = document.getElementById('btnChangeStatus');
  if (btnChangeStatus) {
    btnChangeStatus.addEventListener('click', changeRepairStatus);
  }

  // Payment button
  const btnRepairPay = document.getElementById('btnRepairPay');
  if (btnRepairPay) {
    btnRepairPay.addEventListener('click', addRepairPayment);
  }

  // Repair Parts - Reserve button
  const btnReservePart = document.getElementById('btnReservePart');
  if (btnReservePart) {
    btnReservePart.addEventListener('click', reservePart);
  }

  // Repair Parts - Add new part button
  const btnAddNewPart = document.getElementById('btnAddNewPart');
  if (btnAddNewPart) {
    btnAddNewPart.addEventListener('click', showAddPartModal);
  }

  // Repair Parts - Enter key on quantity input
  const repairPartQty = document.getElementById('repairPartQty');
  if (repairPartQty) {
    repairPartQty.addEventListener('keypress', (e) => {
      if (e.key === 'Enter') {
        reservePart();
      }
    });
  }

  // Payment amount input - Enter key to submit
  const repairPayAmount = document.getElementById('repairPayAmount');
  if (repairPayAmount) {
    repairPayAmount.addEventListener('keypress', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        addRepairPayment();
      }
    });
  }

  // Close modals on backdrop click
  const modals = document.querySelectorAll('.repairs-modal');
  modals.forEach(modal => {
    modal.addEventListener('click', (e) => {
      if (e.target === modal) {
        modal.classList.remove('active');
      }
    });
  });

  // ✅ FIX: Escape handler تكراري محذوف - بيتم التعامل معاه من الـ handler الموحد (سطر 3368)

  // ═══ Adjustments Filter ═══
  const adjustmentsFilter = document.getElementById('adjustmentsFilter');
  if (adjustmentsFilter) {
    // Load saved filter
    const savedFilter = localStorage.getItem('repairsAdjustmentsFilter') || 'original';
    adjustmentsFilter.value = savedFilter;
    
    adjustmentsFilter.addEventListener('change', (e) => {
      localStorage.setItem('repairsAdjustmentsFilter', e.target.value);
      loadTickets();
    });
  }

  const technicianFilterEl = document.getElementById('technicianFilter');
  if (technicianFilterEl) {
    technicianFilterEl.addEventListener('change', () => {
      technicianFilter = (technicianFilterEl.value || '').trim();
      applyRepairsQuickSearch(true);
    });
  }

  // ═══ Day Closing Button ═══
  const btnClosingDay = document.getElementById('btnClosingDay');
  if (btnClosingDay) {
    btnClosingDay.addEventListener('click', openDayClosingModal);
  }

  // Day Closing Modal handlers
  const closeDayClosingModal = document.getElementById('closeDayClosingModal');
  const btnCancelClosing = document.getElementById('btnCancelClosing');
  const btnLoadClosingPreview = document.getElementById('btnLoadClosingPreview');
  const btnConfirmClosing = document.getElementById('btnConfirmClosing');
  const btnPrintClosingReport = document.getElementById('btnPrintClosingReport');
  const closingDateInput = document.getElementById('closingDate');

  if (closeDayClosingModal) closeDayClosingModal.addEventListener('click', closeDayClosingModalFn);
  if (btnCancelClosing) btnCancelClosing.addEventListener('click', closeDayClosingModalFn);
  if (btnLoadClosingPreview) btnLoadClosingPreview.addEventListener('click', loadClosingPreview);
  if (btnConfirmClosing) btnConfirmClosing.addEventListener('click', confirmDayClosing);
  if (btnPrintClosingReport) btnPrintClosingReport.addEventListener('click', printClosingReport);
  if (closingDateInput) {
    // Set default to today
    const today = new Date().toISOString().split('T')[0];
    closingDateInput.value = today;
    // إعادة تحميل البيانات تلقائياً عند تغيير التاريخ
    closingDateInput.addEventListener('change', () => {
      if (closingDateInput.value) {
        loadClosingPreview();
      }
    });
  }

  // ═══ Operations Panel Buttons ═══
  const btnPrintIntake = document.getElementById('btnPrintIntake');
  const btnPrintLabel = document.getElementById('btnPrintLabel');
  const btnPrintInvoiceOps = document.getElementById('btnPrintInvoiceOps');
  const btnCopyTicketNo = document.getElementById('btnCopyTicketNo');
  const btnCopyPhone = document.getElementById('btnCopyPhone');
  const btnGenerateInvoice = document.getElementById('btnGenerateInvoice');
  const btnPrintInvoice = document.getElementById('btnPrintInvoice'); // زر طباعة فاتورة في الـ footer

  if (btnPrintIntake) btnPrintIntake.addEventListener('click', printIntakeReceipt);
  if (btnPrintLabel) btnPrintLabel.addEventListener('click', printDeviceLabel);
  if (btnPrintInvoiceOps) btnPrintInvoiceOps.addEventListener('click', printRepairInvoice);
  if (btnPrintInvoice) btnPrintInvoice.addEventListener('click', printRepairInvoice); // نفس وظيفة زر فاتورة
  if (btnCopyTicketNo) btnCopyTicketNo.addEventListener('click', copyTicketNumber);
  if (btnCopyPhone) btnCopyPhone.addEventListener('click', copyCustomerPhone);
  if (btnGenerateInvoice) btnGenerateInvoice.addEventListener('click', generateRepairInvoice);

  // ═══ Enter key handler for cost input ═══
  const repairTotalCostInput = document.getElementById('repairTotalCost');
  if (repairTotalCostInput) {
    repairTotalCostInput.addEventListener('keypress', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        updateRepairTotalCost();
        repairTotalCostInput.blur();
      }
    });
  }

  // ═══ Adjustment Creation (Phase 3 & 4) ═══
  const btnCreateAdjustment = document.getElementById('btnCreateAdjustment');
  if (btnCreateAdjustment) {
    btnCreateAdjustment.addEventListener('click', openAdjustmentReasonModal);
  }

  const adjustmentReasonModalClose = document.getElementById('adjustmentReasonModalClose');
  const btnCancelAdjustment = document.getElementById('btnCancelAdjustment');
  const btnConfirmAdjustment = document.getElementById('btnConfirmAdjustment');

  if (adjustmentReasonModalClose) adjustmentReasonModalClose.addEventListener('click', closeAdjustmentReasonModal);
  if (btnCancelAdjustment) btnCancelAdjustment.addEventListener('click', closeAdjustmentReasonModal);

  if (btnConfirmAdjustment) {
    btnConfirmAdjustment.addEventListener('click', createAdjustmentTicket);
    Logger.log('[Repairs] btnConfirmAdjustment bound successfully');
  } else {
    Logger.warn('[Repairs] btnConfirmAdjustment not found - DOM not ready?');
    // Fallback: retry binding once after next paint
    requestAnimationFrame(() => {
      const retryBtn = document.getElementById('btnConfirmAdjustment');
      if (retryBtn) {
        retryBtn.addEventListener('click', createAdjustmentTicket);
        Logger.log('[Repairs] btnConfirmAdjustment bound on retry');
      } else {
        Logger.warn('[Repairs] btnConfirmAdjustment still not found after retry');
      }
    });
  }

  // ═══ Keyboard Shortcuts ═══
  document.addEventListener('keydown', (e) => {
    // Ctrl+F: Focus search box
    if (e.ctrlKey && e.key === 'f') {
      e.preventDefault();
      const searchInput = document.getElementById('searchInput');
      if (searchInput) searchInput.focus();
    }

    // ✅ FIX: Escape بيقفل المودال الأعلى بس - مع إصلاح أسماء الـ classes
    if (e.key === 'Escape') {
      // ترتيب حسب الأولوية (z-index الأعلى أولاً)
      const dayClosingModal = document.getElementById('dayClosingModal');
      if (dayClosingModal && dayClosingModal.classList.contains('show')) {
        closeDayClosingModalFn();
        return;
      }
      // printPromptModal (ممكن يكون مفتوح)
      const printModal = document.getElementById('printPromptModal');
      if (printModal && printModal.classList.contains('show')) {
        closePrintPromptModal();
        return;
      }
      // باقي المودالات بتستخدم .active مش .show
      const adjustmentReasonModal = document.getElementById('adjustmentReasonModal');
      if (adjustmentReasonModal && adjustmentReasonModal.classList.contains('active')) {
        closeAdjustmentReasonModal();
        return;
      }
      const detailsModal = document.getElementById('detailsModal');
      if (detailsModal && detailsModal.classList.contains('active')) {
        closeDetailsModal();
        return;
      }
      const intakeModal = document.getElementById('intakeModal');
      if (intakeModal && intakeModal.classList.contains('active')) {
        closeIntakeModal();
        return;
      }
      const shortcutsModal = document.getElementById('shortcutsModal');
      if (shortcutsModal && shortcutsModal.classList.contains('active')) {
        closeShortcutsModal();
        return;
      }
    }
  });

  Logger.log('✅ Event handlers initialized');
}

// ═══════════════════════════════════════════════════════════════
// 📊 DAY CLOSING FUNCTIONS - تقفيل يومية الصيانة
// ═══════════════════════════════════════════════════════════════
let closingPreviewData = null;

function openDayClosingModal() {
  const modal = document.getElementById('dayClosingModal');
  if (modal) {
    // Only use classList - CSS handles display via .show class
    modal.classList.add('show');
    // Set default date to today
    const closingDateInput = document.getElementById('closingDate');
    if (closingDateInput) {
      const today = new Date().toISOString().split('T')[0];
      closingDateInput.value = today;
    }
    // Reset state
    const closingPreview = document.getElementById('closingPreview');
    const closingLoading = document.getElementById('closingLoading');
    const closingError = document.getElementById('closingError');
    const closingAlreadyClosed = document.getElementById('closingAlreadyClosed');
    const btnConfirmClosing = document.getElementById('btnConfirmClosing');
    const btnPrintClosingReport = document.getElementById('btnPrintClosingReport');

    if (closingPreview) closingPreview.style.display = 'none';
    if (closingLoading) closingLoading.style.display = 'block';
    if (closingError) closingError.style.display = 'none';
    if (closingAlreadyClosed) closingAlreadyClosed.style.display = 'none';
    if (btnConfirmClosing) btnConfirmClosing.style.display = 'none';
    if (btnPrintClosingReport) btnPrintClosingReport.style.display = 'none';
    closingPreviewData = null;

    // تحميل البيانات تلقائياً
    loadClosingPreview();
  }
}

function closeDayClosingModalFn() {
  const modal = document.getElementById('dayClosingModal');
  if (modal) {
    // Only use classList - CSS handles display via .show class
    modal.classList.remove('show');
  }
  closingPreviewData = null;
}

async function loadClosingPreview() {
  const closingDateInput = document.getElementById('closingDate');
  if (!closingDateInput || !closingDateInput.value) {
    if (typeof showToast === 'function') showToast('يرجى اختيار التاريخ', 'error');
    return;
  }

  const date = closingDateInput.value;
  const loadingDiv = document.getElementById('closingLoading');
  const previewDiv = document.getElementById('closingPreview');
  const errorDiv = document.getElementById('closingError');
  const alreadyClosedDiv = document.getElementById('closingAlreadyClosed');
  const confirmBtn = document.getElementById('btnConfirmClosing');
  const printBtn = document.getElementById('btnPrintClosingReport');

  // Show loading, hide others
  if (loadingDiv) loadingDiv.style.display = 'block';
  if (previewDiv) previewDiv.style.display = 'none';
  if (errorDiv) errorDiv.style.display = 'none';
  if (alreadyClosedDiv) alreadyClosedDiv.style.display = 'none';
  if (confirmBtn) confirmBtn.style.display = 'none';
  if (printBtn) printBtn.style.display = 'none';

  try {
    const data = await apiRequest(`elos-db://repairs/close-day?date=${date}`);
    closingPreviewData = data;

    // Update stats
    document.getElementById('closingNewTickets').textContent = data.stats.new_tickets || 0;
    document.getElementById('closingDelivered').textContent = data.stats.delivered || 0;
    document.getElementById('closingCancelled').textContent = data.stats.cancelled || 0;
    document.getElementById('closingOpen').textContent = data.stats.open || 0;

    // Update financial
    const originalRevenue = data.financial.revenue || 0;
    const adjustmentsTotal = data.financial.adjustments_total || 0;
    const finalRevenue = data.financial.final_revenue || originalRevenue;

    document.getElementById('closingRevenue').textContent = `${window.fmt(finalRevenue)} ج.م`;
    document.getElementById('closingCollections').textContent = `${window.fmt(data.financial.collections || 0)} ج.م`;
    document.getElementById('closingCash').textContent = window.fmt(data.financial.by_wallet?.cash || 0);
    document.getElementById('closingMobile').textContent = window.fmt(data.financial.by_wallet?.mobile_wallet || 0);
    document.getElementById('closingBank').textContent = window.fmt(data.financial.by_wallet?.bank || 0);

    // Adjustment breakdown (show if adjustments exist)
    const adjustmentsBreakdown = document.getElementById('closingAdjustmentsBreakdown');
    if (adjustmentsBreakdown) {
      if (adjustmentsTotal !== 0) {
        adjustmentsBreakdown.style.display = 'block';
        document.getElementById('closingOriginalRevenue').textContent = `${window.fmt(originalRevenue)} ج.م`;
        const adjustmentsEl = document.getElementById('closingAdjustmentsRevenue');
        adjustmentsEl.textContent = `${adjustmentsTotal >= 0 ? '+' : ''}${window.fmt(adjustmentsTotal)} ج.م`;
        adjustmentsEl.style.color = adjustmentsTotal >= 0 ? '#10b981' : '#ef4444';
        document.getElementById('closingFinalRevenue').textContent = `${window.fmt(finalRevenue)} ج.م`;
      } else {
        adjustmentsBreakdown.style.display = 'none';
      }
    }

    // تفصيل التحصيلات حسب النوع (عربونات / تحصيل نهائي / مستردات)
    const kindBreakdownDiv = document.getElementById('closingKindBreakdown');
    const kindItemsDiv = document.getElementById('closingKindItems');
    const byKind = data.financial.by_kind;
    if (kindBreakdownDiv && kindItemsDiv && byKind) {
      const kindLabels = {
        deposit: { label: 'عربونات / دفعات مقدمة', icon: '💰' },
        final: { label: 'تحصيل نهائي (أجهزة مُسلَّمة)', icon: '✅' },
        refund: { label: 'مستردات', icon: '↩️' }
      };
      let kindHtml = '';
      let hasAnyKind = false;
      ['final', 'deposit', 'refund'].forEach(kind => {
        const amount = byKind[kind] || 0;
        const count = byKind[kind + '_count'] || 0;
        if (count > 0) {
          hasAnyKind = true;
          const info = kindLabels[kind];
          const displayAmount = kind === 'refund' ? `-${window.fmt(amount)}` : window.fmt(amount);
          kindHtml += `<span class="dc-kind-tag ${kind}">${info.icon} ${info.label}: ${displayAmount} ج.م <span class="dc-kind-count">(${count})</span></span>`;
        }
      });
      if (hasAnyKind) {
        kindItemsDiv.innerHTML = kindHtml;
        kindBreakdownDiv.style.display = 'block';
      } else {
        kindBreakdownDiv.style.display = 'none';
      }
    }

    // Admin KPIs
    const adminKpisDiv = document.getElementById('closingAdminKpis');
    if (data.is_admin) {
      if (adminKpisDiv) adminKpisDiv.style.display = 'block';
      document.getElementById('closingPartsCost').textContent = `${window.fmt(data.financial.parts_cost || 0)} ج.م`;
      const netProfit = data.financial.net_profit || 0;
      const netProfitEl = document.getElementById('closingNetProfit');
      netProfitEl.textContent = `${window.fmt(netProfit)} ج.م`;
      netProfitEl.style.color = netProfit >= 0 ? '#10b981' : '#ef4444';
    } else {
      if (adminKpisDiv) adminKpisDiv.style.display = 'none';
    }

    // Check if already closed
    if (data.is_closed && data.closing) {
      if (alreadyClosedDiv) alreadyClosedDiv.style.display = 'block';
      document.getElementById('closingClosedBy').textContent = data.closing.closed_by || '';
      document.getElementById('closingClosedAt').textContent = data.closing.closed_at ? new Date(data.closing.closed_at).toLocaleString('ar-EG') : '';
      if (confirmBtn) confirmBtn.style.display = 'none';
      // Show print button for already-closed days
      if (printBtn) printBtn.style.display = 'inline-flex';
    } else {
      if (alreadyClosedDiv) alreadyClosedDiv.style.display = 'none';
      // Show both confirm and print buttons
      if (confirmBtn) confirmBtn.style.display = 'inline-flex';
      if (printBtn) printBtn.style.display = 'inline-flex';
    }

    if (loadingDiv) loadingDiv.style.display = 'none';
    if (previewDiv) previewDiv.style.display = 'block';

  } catch (error) {
    Logger.error('Failed to load closing preview:', error);
    if (loadingDiv) loadingDiv.style.display = 'none';
    if (errorDiv) errorDiv.style.display = 'block';
    if (typeof showToast === 'function') showToast(error.message || 'فشل في تحميل البيانات', 'error');
  }
}

// ═══════════════════════════════════════════════════════════════
// ⚠️ CUSTOM CONFIRM DIALOG - بديل لـ confirm() المتصفح
// ═══════════════════════════════════════════════════════════════
function showCustomConfirm({ icon = '⚠️', title = 'تأكيد', message = 'هل أنت متأكد؟', okText = 'تأكيد', cancelText = 'إلغاء', danger = false }) {
  return new Promise((resolve) => {
    const overlay = document.getElementById('customConfirmOverlay');
    const iconEl = document.getElementById('confirmIcon');
    const titleEl = document.getElementById('confirmTitle');
    const messageEl = document.getElementById('confirmMessage');
    const okBtn = document.getElementById('confirmOkBtn');
    const cancelBtn = document.getElementById('confirmCancelBtn');

    if (!overlay) { resolve(confirm(message)); return; }

    iconEl.textContent = icon;
    titleEl.textContent = title;
    messageEl.innerHTML = message;
    okBtn.textContent = okText;
    cancelBtn.textContent = cancelText;

    // Apply danger style
    okBtn.classList.toggle('danger', danger);

    overlay.classList.add('show');

    function cleanup() {
      overlay.classList.remove('show');
      okBtn.removeEventListener('click', onOk);
      cancelBtn.removeEventListener('click', onCancel);
      overlay.removeEventListener('click', onOverlayClick);
    }

    function onOk() { cleanup(); resolve(true); }
    function onCancel() { cleanup(); resolve(false); }
    function onOverlayClick(e) { if (e.target === overlay) { cleanup(); resolve(false); } }

    okBtn.addEventListener('click', onOk);
    cancelBtn.addEventListener('click', onCancel);
    overlay.addEventListener('click', onOverlayClick);
  });
}

async function confirmDayClosing() {
  const closingDateInput = document.getElementById('closingDate');
  const notesInput = document.getElementById('closingNotes');

  if (!closingDateInput || !closingDateInput.value) {
    if (typeof showToast === 'function') showToast('يرجى اختيار التاريخ', 'error');
    return;
  }

  const date = closingDateInput.value;
  const notes = notesInput ? notesInput.value.trim() : '';

  const confirmed = await showCustomConfirm({
    icon: '🔒',
    title: 'تأكيد تقفيل اليومية',
    message: `سيتم تقفيل يوم <strong style="color: #3b82f6;">${date}</strong><br><span style="color: #f59e0b;">لن يمكن تعديل تذاكر هذا اليوم بعد التقفيل</span>`,
    okText: '✅ تأكيد التقفيل',
    cancelText: 'رجوع',
    danger: false
  });

  if (!confirmed) return;

  const confirmBtn = document.getElementById('btnConfirmClosing');
  if (confirmBtn) {
    confirmBtn.disabled = true;
    confirmBtn.innerHTML = '<span>⏳</span> <span>جاري التقفيل...</span>';
  }

  try {
    // استخدام fetch مباشرة لمعالجة الـ plain text errors
    const sessionId = localStorage.getItem('sessionId');
    const res = await fetch('elos-db://repairs/close-day', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(sessionId && { 'x-session-id': sessionId })
      },
      body: JSON.stringify({ date, notes })
    });

    // قراءة الـ body كـ text أولاً (لتفادي body stream already read)
    const responseText = await res.text();

    if (!res.ok) {
      // محاولة parse الـ text كـ JSON
      let errorMsg;
      try {
        const errData = JSON.parse(responseText);
        errorMsg = errData.error || errData.message || responseText;
      } catch {
        errorMsg = responseText;
      }
      throw new Error(errorMsg);
    }

    const result = JSON.parse(responseText);

    if (result.ok) {
      // إغلاق المودال فوراً + إشعار نجاح
      closeDayClosingModalFn();
      if (typeof showToast === 'function') showToast('✅ تم تقفيل اليومية بنجاح', 'success');

      // تحديث التذاكر والبطاقات في الخلفية
      await loadTickets();
    }
  } catch (error) {
    Logger.error('Failed to close day:', error);
    const errMsg = error.message || 'فشل في تقفيل اليومية';
    // لو اليوم متقفل فعلاً → إظهار رسالة مناسبة مش error
    if (errMsg.includes('تم تقفيل') || errMsg.includes('بالفعل')) {
      if (typeof showToast === 'function') showToast('🔒 ' + errMsg, 'info');
      // تحديث الواجهة لتعكس الحالة
      if (confirmBtn) confirmBtn.style.display = 'none';
      const alreadyClosedDiv = document.getElementById('closingAlreadyClosed');
      if (alreadyClosedDiv) alreadyClosedDiv.style.display = 'block';
    } else {
      if (typeof showToast === 'function') showToast(errMsg, 'error');
    }
  } finally {
    if (confirmBtn) {
      confirmBtn.disabled = false;
      confirmBtn.innerHTML = '<span>✅</span> <span>تأكيد تقفيل اليوم</span>';
    }
  }
}

function printClosingReport() {
  if (!closingPreviewData) {
    if (typeof showToast === 'function') showToast('لا توجد بيانات للطباعة', 'error');
    return;
  }

  const shopName = getShopName();
  const date = document.getElementById('closingDate').value;
  const notes = document.getElementById('closingNotes').value || '';

  const printContent = `
<!DOCTYPE html>
<html dir="rtl" lang="ar">
<head>
  <meta charset="UTF-8">
  <title>تقرير تقفيل يومية الصيانة - ${date}</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: 'Segoe UI', Tahoma, sans-serif; padding: 20px; direction: rtl; }
    .header { text-align: center; margin-bottom: 30px; border-bottom: 2px solid #333; padding-bottom: 20px; }
    .header h1 { font-size: 24px; margin-bottom: 8px; }
    .header .shop-name { font-size: 18px; color: #666; }
    .header .date { font-size: 16px; margin-top: 12px; color: #333; font-weight: bold; }
    .section { margin: 25px 0; }
    .section-title { font-size: 16px; font-weight: bold; margin-bottom: 12px; color: #8b5cf6; border-bottom: 1px solid #8b5cf6; padding-bottom: 8px; }
    .stats-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 15px; }
    .stat-item { text-align: center; padding: 15px; background: #f8f9fa; border-radius: 8px; }
    .stat-value { font-size: 24px; font-weight: bold; color: #333; }
    .stat-label { font-size: 12px; color: #666; margin-top: 6px; }
    .financial-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 15px; }
    .financial-item { padding: 15px; background: #f8f9fa; border-radius: 8px; }
    .financial-item.highlight { background: #e8f5e9; border: 1px solid #4caf50; }
    .financial-value { font-size: 20px; font-weight: bold; }
    .financial-label { font-size: 12px; color: #666; }
    .wallet-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px; margin-top: 15px; }
    .wallet-item { text-align: center; padding: 10px; background: #fff; border: 1px solid #ddd; border-radius: 6px; }
    .notes { background: #fff3e0; padding: 15px; border-radius: 8px; margin-top: 20px; }
    .footer { text-align: center; margin-top: 40px; padding-top: 20px; border-top: 1px solid #ddd; font-size: 12px; color: #666; }
    @media print { body { padding: 10px; } }
  </style>
</head>
<body>
  <div class="header">
    <h1>📊 تقرير تقفيل يومية الصيانة</h1>
    <div class="shop-name">${window.escapeHtml(shopName)}</div>
    <div class="date">التاريخ: ${date}</div>
  </div>

  <div class="section">
    <div class="section-title">📈 ملخص التذاكر</div>
    <div class="stats-grid">
      <div class="stat-item">
        <div class="stat-value" style="color: #8b5cf6;">${closingPreviewData.stats.new_tickets || 0}</div>
        <div class="stat-label">تذاكر جديدة</div>
      </div>
      <div class="stat-item">
        <div class="stat-value" style="color: #10b981;">${closingPreviewData.stats.delivered || 0}</div>
        <div class="stat-label">تم التسليم</div>
      </div>
      <div class="stat-item">
        <div class="stat-value" style="color: #ef4444;">${closingPreviewData.stats.cancelled || 0}</div>
        <div class="stat-label">ملغاة</div>
      </div>
      <div class="stat-item">
        <div class="stat-value" style="color: #f59e0b;">${closingPreviewData.stats.open || 0}</div>
        <div class="stat-label">مفتوحة</div>
      </div>
    </div>
  </div>

  <div class="section">
    <div class="section-title">💰 الملخص المالي</div>
    <div class="financial-grid">
      <div class="financial-item highlight">
        <div class="financial-value" style="color: #10b981;">${window.fmt(closingPreviewData.financial.revenue || 0)} ج.م</div>
        <div class="financial-label">إيرادات اليوم</div>
      </div>
      <div class="financial-item">
        <div class="financial-value" style="color: #8b5cf6;">${window.fmt(closingPreviewData.financial.collections || 0)} ج.م</div>
        <div class="financial-label">التحصيلات</div>
      </div>
    </div>
    <div class="wallet-grid">
      <div class="wallet-item">
        <div style="font-size: 11px; color: #666;">💵 كاش</div>
        <div style="font-weight: bold;">${window.fmt(closingPreviewData.financial.by_wallet?.cash || 0)}</div>
      </div>
      <div class="wallet-item">
        <div style="font-size: 11px; color: #666;">📱 محفظة</div>
        <div style="font-weight: bold;">${window.fmt(closingPreviewData.financial.by_wallet?.mobile_wallet || 0)}</div>
      </div>
      <div class="wallet-item">
        <div style="font-size: 11px; color: #666;">🏦 بنك</div>
        <div style="font-weight: bold;">${window.fmt(closingPreviewData.financial.by_wallet?.bank || 0)}</div>
      </div>
    </div>
    ${(() => {
      const bk = closingPreviewData.financial.by_kind;
      if (!bk) return '';
      const kinds = [
        { key: 'final', label: 'تحصيل نهائي (أجهزة مُسلَّمة)', color: '#10b981' },
        { key: 'deposit', label: 'عربونات / دفعات مقدمة', color: '#f59e0b' },
        { key: 'refund', label: 'مستردات', color: '#ef4444' }
      ];
      const items = kinds.filter(k => (bk[k.key + '_count'] || 0) > 0);
      if (items.length === 0) return '';
      return '<div style="margin-top: 12px; padding: 10px; background: #f8f9fa; border-radius: 8px; border: 1px dashed #ddd;"><div style="font-size: 12px; font-weight: 600; color: #666; margin-bottom: 8px;">📋 تفصيل التحصيلات:</div><div style="display: flex; flex-wrap: wrap; gap: 8px;">' +
        items.map(k => {
          const amt = bk[k.key] || 0;
          const cnt = bk[k.key + '_count'] || 0;
          const display = k.key === 'refund' ? '-' + window.fmt(amt) : window.fmt(amt);
          return '<span style="padding: 4px 10px; border-radius: 20px; font-size: 12px; font-weight: 600; border: 1px solid ' + k.color + '33; color: ' + k.color + '; background: ' + k.color + '11;">' + k.label + ': ' + display + ' ج.م (' + cnt + ')</span>';
        }).join('') +
        '</div></div>';
    })()}
    ${closingPreviewData.is_admin ? `
    <div class="financial-grid" style="margin-top: 15px;">
      <div class="financial-item">
        <div class="financial-value" style="color: #ef4444;">${window.fmt(closingPreviewData.financial.parts_cost || 0)} ج.م</div>
        <div class="financial-label">تكلفة القطع</div>
      </div>
      <div class="financial-item highlight">
        <div class="financial-value" style="color: #10b981;">${window.fmt(closingPreviewData.financial.net_profit || 0)} ج.م</div>
        <div class="financial-label">صافي الربح</div>
      </div>
    </div>
    ` : ''}
  </div>

  ${notes ? `
  <div class="section">
    <div class="section-title">📝 ملاحظات</div>
    <div class="notes">${window.escapeHtml(notes)}</div>
  </div>
  ` : ''}

  <div class="footer">
    <p>تم التقفيل بواسطة: ${window.currentUser?.username || ''} - ${new Date().toLocaleString('ar-EG')}</p>
  </div>
</body>
</html>
  `;

  const printWindow = window.open('', '_blank');
  printWindow.document.write(printContent);
  printWindow.document.close();
  printWindow.focus();
  setTimeout(() => printWindow.print(), 500);
}

// ═══════════════════════════════════════════════════════════════
// 🖨️ PRINTING FUNCTIONS - طباعة الإيصالات والفواتير
// ═══════════════════════════════════════════════════════════════

// Store newly created ticket for print prompt
let newlyCreatedTicket = null;

/**
 * توليد باركود Code128 كـ SVG - متوافق مع الطابعات الحرارية
 * (نسخ من pos.js للاستخدام في repairs.js)
 */
function generateBarcodeSVG(text) {
  // Use unified BarcodeService if available
  if (typeof BarcodeService !== 'undefined') {
    return BarcodeService.generateCode128SVG(text, 200, 35);
  }
  
  // Fallback implementation (should not be reached if barcode-service.js is loaded)
  Logger.warn('[REPAIRS] Using fallback generateBarcodeSVG - barcode-service.js not loaded');
  const CODE128B = {
    ' ': '11011001100', '!': '11001101100', '"': '11001100110', '#': '10010011000',
    '$': '10010001100', '%': '10001001100', '&': '10011001000', "'": '10011000100',
    '(': '10001100100', ')': '11001001000', '*': '11001000100', '+': '11000100100',
    ',': '10110011100', '-': '10011011100', '.': '10011001110', '/': '10111001100',
    '0': '10011101100', '1': '11001011100', '2': '11001001110', '3': '11011100100',
    '4': '11001110100', '5': '11101101110', '6': '11101001100', '7': '11100101100',
    '8': '11100100110', '9': '11101100100', ':': '11100110100', ';': '11100110010',
    '<': '11011011000', '=': '11011000110', '>': '11000110110', '?': '10100011000',
    '@': '10001011000', 'A': '10001000110', 'B': '10110001000', 'C': '10001101000',
    'D': '10001100010', 'E': '11010001000', 'F': '11000101000', 'G': '11000100010',
    'H': '10110111000', 'I': '10110001110', 'J': '10001101110', 'K': '10111011000',
    'L': '10111000110', 'M': '10001110110', 'N': '11101110110', 'O': '11010001110',
    'P': '11000101110', 'Q': '11011101000', 'R': '11011100010', 'S': '11011101110',
    'T': '11101011000', 'U': '11101000110', 'V': '11100010110', 'W': '11101101000',
    'X': '11101100010', 'Y': '11100011010', 'Z': '11101111010', '[': '11001000010',
    '\\': '11110001010', ']': '10100110000', '^': '10100001100', '_': '10010110000',
    '`': '10010000110', 'a': '10000101100', 'b': '10000100110', 'c': '10110010000',
    'd': '10110000100', 'e': '10011010000', 'f': '10011000010', 'g': '10000110100',
    'h': '10000110010', 'i': '11000010010', 'j': '11001010000', 'k': '11110111010',
    'l': '11000010100', 'm': '10001111010', 'n': '10100111100', 'o': '10010111100',
    'p': '10010011110', 'q': '10111100100', 'r': '10011110100', 's': '10011110010',
    't': '11110100100', 'u': '11110010100', 'v': '11110010010', 'w': '11011011110',
    'x': '11011110110', 'y': '11110110110', 'z': '10101111000', '{': '10100011110',
    '|': '10001011110', '}': '10111101000', '~': '10111100010'
  };

  const START_B = '11010010000';
  const STOP = '1100011101011';

  const upperText = text.toUpperCase();
  let pattern = START_B;
  let checksum = 104;

  for (let i = 0; i < upperText.length; i++) {
    const char = upperText[i];
    const code = CODE128B[char];
    if (code) {
      pattern += code;
      const charValue = char.charCodeAt(0) - 32;
      checksum += charValue * (i + 1);
    }
  }

  const checksumChar = String.fromCharCode((checksum % 103) + 32);
  if (CODE128B[checksumChar]) {
    pattern += CODE128B[checksumChar];
  }

  pattern += STOP;

  const barWidth = 1.5;
  const height = 35;
  const width = pattern.length * barWidth;

  let svg = '<svg xmlns="http://www.w3.org/2000/svg" width="' + width + '" height="' + height + '" viewBox="0 0 ' + width + ' ' + height + '">';
  svg += '<rect width="100%" height="100%" fill="white"/>';

  let x = 0;
  for (let i = 0; i < pattern.length; i++) {
    if (pattern[i] === '1') {
      svg += '<rect x="' + x + '" y="0" width="' + barWidth + '" height="' + height + '" fill="black"/>';
    }
    x += barWidth;
  }

  svg += '</svg>';
  return svg;
}

function showPrintPromptModal(ticket) {
  newlyCreatedTicket = ticket;

  // Create modal if not exists
  let modal = document.getElementById('printPromptModal');
  if (!modal) {
    modal = document.createElement('div');
    modal.id = 'printPromptModal';
    modal.className = 'print-prompt-modal-overlay';
    modal.innerHTML = `
      <div class="print-prompt-modal-content">
        <div class="print-prompt-header">
          <span class="print-prompt-icon">✅</span>
          <h3>تم تسجيل الاستلام بنجاح!</h3>
          <p class="print-prompt-ticket-no"></p>
        </div>
        <div class="print-prompt-body">
          <p>هل تريد طباعة المستندات؟</p>
          <div class="print-prompt-buttons">
            <button type="button" class="btn btn-primary" id="btnPrintPromptLabel">
              <span>🏷️</span>
              <span>طباعة ستيكر الجهاز</span>
            </button>
            <button type="button" class="btn btn-primary" id="btnPrintPromptReceipt">
              <span>📄</span>
              <span>طباعة إيصال الاستلام</span>
            </button>
            <button type="button" class="btn btn-secondary" id="btnPrintPromptBoth">
              <span>🖨️</span>
              <span>طباعة الاثنين</span>
            </button>
          </div>
        </div>
        <div class="print-prompt-footer">
          <button type="button" class="btn btn-ghost" id="btnPrintPromptSkip">تخطي</button>
        </div>
      </div>
    `;
    document.body.appendChild(modal);

    // Add event listeners
    document.getElementById('btnPrintPromptLabel').addEventListener('click', () => {
      printNewTicketLabel();
      closePrintPromptModal();
    });
    document.getElementById('btnPrintPromptReceipt').addEventListener('click', () => {
      printNewTicketReceipt();
      closePrintPromptModal();
    });
    document.getElementById('btnPrintPromptBoth').addEventListener('click', () => {
      // ✅ FIX: نحفظ نسخة من البيانات قبل إغلاق المودال (اللي بيعمل null لـ newlyCreatedTicket)
      const ticketBackup = newlyCreatedTicket ? { ...newlyCreatedTicket } : null;
      printNewTicketLabel();
      closePrintPromptModal();
      // الإيصال بعد تأخير - نستخدم النسخة المحفوظة
      setTimeout(() => {
        if (ticketBackup) {
          newlyCreatedTicket = ticketBackup;
          printNewTicketReceipt();
          newlyCreatedTicket = null;
        }
      }, 800);
    });
    document.getElementById('btnPrintPromptSkip').addEventListener('click', closePrintPromptModal);

    // Click outside to close
    modal.addEventListener('click', (e) => {
      if (e.target === modal) closePrintPromptModal();
    });
  }

  // Update ticket number
  modal.querySelector('.print-prompt-ticket-no').textContent = `رقم التذكرة: ${ticket.ticket_no}`;

  // Show modal
  modal.classList.add('show');
}

function closePrintPromptModal() {
  const modal = document.getElementById('printPromptModal');
  if (modal) {
    modal.classList.remove('show');
  }
  newlyCreatedTicket = null;
}

function printNewTicketLabel() {
  if (!newlyCreatedTicket) return;

  // ✅ FIX: نستخدم printRepairBarcode المتخصصة للصيانة بدل BarcodeGenerator بتاع المنتجات
  printRepairBarcode(newlyCreatedTicket);
}

function printLabelDirect(ticketNo, customerName, deviceModel, shopName, qrData, size = '58mm') {
  const is58mm = size === '58mm';
  const width = is58mm ? '58mm' : '50mm';
  const height = is58mm ? '40mm' : '25mm';

  const printContent = `
<!DOCTYPE html>
<html dir="rtl">
<head>
  <meta charset="UTF-8">
  <title>ستيكر - ${ticketNo}</title>
  <style>
    @page { size: ${width} ${height}; margin: 0; }
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: 'Segoe UI', Arial, sans-serif;
      width: ${width};
      height: ${height};
      padding: 2mm;
      display: flex;
      flex-direction: column;
      justify-content: space-between;
    }
    .header {
      text-align: center;
      font-size: ${is58mm ? '10px' : '8px'};
      font-weight: bold;
      border-bottom: 1px solid #000;
      padding-bottom: 1mm;
      margin-bottom: 1mm;
    }
    .ticket-no {
      text-align: center;
      font-size: ${is58mm ? '16px' : '12px'};
      font-weight: bold;
      letter-spacing: 1px;
      margin: 1mm 0;
    }
    .info {
      font-size: ${is58mm ? '9px' : '7px'};
      text-align: center;
      line-height: 1.3;
    }
    .qr-placeholder {
      text-align: center;
      margin-top: auto;
      font-size: 8px;
      padding: 2mm;
      background: #f5f5f5;
      border: 1px dashed #999;
    }
  </style>
</head>
<body>
  <div class="header">${window.escapeHtml(shopName)}</div>
  <div class="ticket-no">🎫 ${window.escapeHtml(ticketNo)}</div>
  <div class="info">
    ${window.escapeHtml(customerName)}<br>
    ${window.escapeHtml(deviceModel)}
  </div>
  <div class="qr-placeholder">
    <small>QR: ${window.escapeHtml(ticketNo)}</small>
  </div>
</body>
</html>
  `;

  const printWindow = window.open('', '_blank', 'width=250,height=200');
  if (printWindow) {
    printWindow.document.write(printContent);
    printWindow.document.close();
    printWindow.focus();
    setTimeout(() => printWindow.print(), 300);
  }
}

function printNewTicketReceipt() {
  if (!newlyCreatedTicket) return;

  const ticket = newlyCreatedTicket;
  
  // Get settings
  const settings = JSON.parse(localStorage.getItem('appSettings') || '{}');
  const companyName = settings.companyName || 'ELOS';
  const companyLogo = settings.companyLogo || '';
  const paperWidth = settings.printerPaperWidth === '58' ? '54mm' : '72mm';
  const pageSize = settings.printerPaperWidth || '80';

  const ticketNo = ticket.ticket_no || '';
  const customerName = ticket.customer_name || '';
  const customerPhone = ticket.customer_phone || '';
  const deviceCategory = translateDeviceCategory(ticket.device_category);
  const deviceBrand = ticket.device_brand || '';
  const deviceModel = ticket.device_model || '';
  const deviceInfo = [deviceBrand, deviceModel].filter(Boolean).join(' ') || deviceCategory;
  const issueDescription = ticket.issue_description || '';
  const accessories = ticket.accessories_received || [];
  const accessoriesStr = Array.isArray(accessories) ? accessories.join('، ') : (accessories || '-');
  const deposit = ticket.deposit_amount || 0;
  const now = new Date();
  const dateStr = now.toLocaleDateString('ar-EG');
  const timeStr = now.toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' });
  const imei = ticket.imei_or_serial || '-';
  const techName = (ticket.assigned_tech_name || '').trim() || '';

  const printContent = `
<!DOCTYPE html>
<html dir="rtl" lang="ar">
<head>
  <meta charset="UTF-8">
  <title>إيصال استلام - ${ticketNo}</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    @page { size: ${pageSize}mm auto; margin: 0; }
    
    body {
      font-family: Arial, Tahoma, sans-serif;
      width: ${paperWidth};
      max-width: ${paperWidth};
      margin: 0 auto;
      padding: 3mm;
      background: #fff;
      color: #000;
      font-size: 12px;
      line-height: 1.4;
      font-weight: 600;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }
    
    .header {
      text-align: center;
      padding-bottom: 3mm;
      border-bottom: 0.5mm solid #000;
      margin-bottom: 2mm;
    }
    .logo { max-width: 14mm; max-height: 14mm; margin-bottom: 1mm; }
    .shop-name { font-size: 16px; font-weight: 700; letter-spacing: 0.5mm; }
    
    .ticket-no {
      text-align: center;
      font-size: 18px;
      font-weight: 700;
      margin: 3mm 0;
      padding: 2mm;
      background: #f0f0f0;
      border: 0.3mm dashed #000;
    }
    
    .info {
      display: flex;
      justify-content: space-between;
      padding: 2mm 0;
      font-size: 11px;
      font-weight: 600;
      color: #000;
      border-bottom: 0.3mm solid #000;
    }
    .info-num { font-weight: 700; font-size: 12px; }
    
    .section {
      padding: 2mm 0;
      border-bottom: 0.3mm solid #000;
    }
    .section-title {
      font-size: 10px;
      font-weight: 700;
      color: #000;
      margin-bottom: 1.5mm;
      padding-bottom: 1mm;
      border-bottom: 0.2mm dashed #000;
    }
    .data-row {
      display: flex;
      justify-content: space-between;
      font-size: 11px;
      padding: 1mm 0;
      font-weight: 600;
    }
    .data-value { 
      font-weight: 700; 
      max-width: 55%; 
      text-align: left; 
    }
    
    .issue-box {
      background: #f0f0f0;
      padding: 2mm;
      margin: 2mm 0;
      font-size: 10px;
      font-weight: 600;
      color: #000;
    }
    
    .deposit {
      background: #000;
      color: #fff;
      margin: 2mm -3mm;
      padding: 2.5mm 3mm;
      text-align: center;
      font-size: 13px;
      font-weight: 700;
    }
    
    .policy {
      background: #fff8e1;
      border: 0.3mm solid #ffc107;
      padding: 2mm;
      margin: 2mm 0;
      font-size: 8px;
      text-align: center;
      line-height: 1.4;
    }
    
    .footer {
      text-align: center;
      padding-top: 3mm;
      margin-top: 2mm;
      border-top: 0.3mm solid #000;
    }
    .footer-msg {
      font-size: 11px;
      font-weight: 600;
      color: #000;
      margin-bottom: 2mm;
    }
    .barcode { margin-top: 2mm; }
    .barcode svg { max-width: 85%; height: auto; }
    .barcode-num {
      font-family: monospace;
      font-size: 10px;
      font-weight: 700;
      color: #000;
      margin-top: 1mm;
    }
    .elos-sig {
      margin-top: 3mm;
      padding-top: 2mm;
      border-top: 0.3mm dashed #000;
      font-size: 9px;
      font-weight: 600;
      color: #000;
      letter-spacing: 0.3mm;
    }
  </style>
</head>
<body>

  <div class="header">
    ${companyLogo ? `<img src="${companyLogo}" class="logo" />` : ''}
    <div class="shop-name">${companyName}</div>
  </div>

  <div class="ticket-no">🎫 #${window.escapeHtml(ticketNo)}</div>

  <div class="info">
    <div>
      <div class="info-num">${dateStr} - ${timeStr}</div>
    </div>
    ${customerName || customerPhone ? `
      <div style="text-align: left;">
        ${customerName ? `<div style="font-weight: 700;">${window.escapeHtml(customerName)}</div>` : ''}
        ${customerPhone ? `<div>${window.escapeHtml(customerPhone)}</div>` : ''}
      </div>
    ` : ''}
  </div>

  <div class="section">
    <div class="section-title">📱 بيانات الجهاز</div>
    <div class="data-row">
      <span>النوع:</span>
      <span class="data-value">${window.escapeHtml(deviceCategory)}</span>
    </div>
    ${deviceInfo ? `
      <div class="data-row">
        <span>الماركة/الموديل:</span>
        <span class="data-value">${window.escapeHtml(deviceInfo)}</span>
      </div>
    ` : ''}
    ${imei && imei !== '-' ? `
      <div class="data-row">
        <span>IMEI/Serial:</span>
        <span class="data-value" style="font-family: monospace;">${window.escapeHtml(imei)}</span>
      </div>
    ` : ''}
    ${techName ? `
      <div class="data-row">
        <span>الفني:</span>
        <span class="data-value">${window.escapeHtml(techName)}</span>
      </div>
    ` : ''}
  </div>

  ${issueDescription ? `
    <div class="section">
      <div class="section-title">🔧 المشكلة</div>
      <div class="issue-box">${window.escapeHtml(issueDescription)}</div>
    </div>
  ` : ''}

  ${accessoriesStr && accessoriesStr !== '-' && accessoriesStr !== 'لا توجد ملحقات' ? `
    <div class="section">
      <div class="section-title">📦 الملحقات المستلمة</div>
      <div class="issue-box">${window.escapeHtml(accessoriesStr)}</div>
    </div>
  ` : ''}

  ${deposit > 0 ? `
    <div class="deposit">
      💰 العربون المدفوع: ${window.fmt(deposit)} ج.م
    </div>
  ` : ''}

  <div class="policy">
    ⚠️ يرجى الاحتفاظ بهذا الإيصال لاستلام الجهاز<br>
    المحل غير مسؤول عن الأجهزة التي لم تُستلم خلال 30 يوم
  </div>

  <div class="footer">
    <div class="footer-msg">${settings.printerFooterMessage || 'شكراً لتعاملكم معنا'}</div>
    <div class="barcode">
      ${generateBarcodeSVG((ticketNo || ticket.id || '000000').toString().replace(/[^A-Z0-9]/gi, '') || '000000')}
      <div class="barcode-num">#${window.escapeHtml(ticketNo || ticket.id || '')}</div>
    </div>
    <div class="elos-sig">
      <div>ELOS ACCOUNTING SYSTEM</div>
      <div>01031372078</div>
    </div>
  </div>

</body>
</html>`;

  const printWindow = window.open('', '_blank', 'width=350,height=700');
  if (!printWindow) {
    if (typeof showToast === 'function') showToast('فشل فتح نافذة الطباعة', 'error');
    return;
  }

  printWindow.document.write(printContent);
  printWindow.document.close();

  printWindow.onload = function() {
    setTimeout(() => {
      printWindow.print();
      printWindow.close();
    }, 300);
  };
}

function translateDeviceCategory(category) {
  const categories = {
    'mobile': 'موبايل',
    'tablet': 'تابلت',
    'laptop': 'لابتوب',
    'desktop': 'كمبيوتر',
    'printer': 'طابعة',
    'other': 'أخرى'
  };
  return categories[category] || category || '-';
}

function getShopName() {
  try {
    const settings = JSON.parse(localStorage.getItem('appSettings') || '{}');
    return settings.companyName || 'ELOS';
  } catch (e) {
    return 'ELOS';
  }
}

// Minimal QR Code generator (inline, no external dependencies)
function generateQRCode(data, size = 100) {
  // Use a simple base64 QR code placeholder with data encoded in URL
  // In production, you'd use a library like qrcode-generator
  // This creates a simple QR-like pattern for demonstration
  const encoded = encodeURIComponent(data);
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${size} ${size}" width="${size}" height="${size}">
    <rect width="${size}" height="${size}" fill="white"/>
    <text x="50%" y="50%" text-anchor="middle" dominant-baseline="middle" font-size="8" font-family="monospace">${data.substring(0, 15)}</text>
    <rect x="5" y="5" width="20" height="20" fill="black"/>
    <rect x="${size-25}" y="5" width="20" height="20" fill="black"/>
    <rect x="5" y="${size-25}" width="20" height="20" fill="black"/>
    <rect x="10" y="10" width="10" height="10" fill="white"/>
    <rect x="${size-20}" y="10" width="10" height="10" fill="white"/>
    <rect x="10" y="${size-20}" width="10" height="10" fill="white"/>
  </svg>`;
}

function printIntakeReceipt() {
  if (!currentRepairId) {
    if (typeof showToast === 'function') showToast('لا توجد تذكرة مفتوحة', 'error');
    return;
  }

  // Get current ticket data from the DOM
  const ticketNo = document.getElementById('detailTicketNo')?.textContent?.replace('#', '') || '';
  const customerName = document.getElementById('detailCustomerName')?.textContent || '';
  const customerPhone = document.getElementById('detailCustomerPhone')?.textContent || '';
  const deviceCategory = document.getElementById('detailDeviceCategory')?.textContent || '';
  const deviceBrandModel = document.getElementById('detailDeviceBrandModel')?.textContent || '';
  const detailImei = document.getElementById('detailImei')?.textContent || '';
  const issueDescription = document.getElementById('detailIssue')?.textContent || '';
  const createdAt = document.getElementById('detailCreatedAt')?.textContent || '';
  const depositText = document.getElementById('repairPaidTotal')?.textContent || '0.00 ج.م';
  const depositAmount = parseFloat(depositText.replace(/[^0-9.]/g, '')) || 0;

  // Get settings
  const settings = JSON.parse(localStorage.getItem('appSettings') || '{}');
  const companyName = settings.companyName || 'ELOS';
  const companyLogo = settings.companyLogo || '';
  const paperWidth = settings.printerPaperWidth === '58' ? '54mm' : '72mm';
  const pageSize = settings.printerPaperWidth || '80';

  const now = new Date();
  const dateStr = createdAt || now.toLocaleDateString('ar-EG');
  const timeStr = now.toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' });
  const techDisplay = document.getElementById('detailTechnicianDisplay');
  const techNameReceipt = (techDisplay?.textContent || '').trim();
  const techNameForReceipt = techNameReceipt && techNameReceipt !== '-' ? techNameReceipt : '';

  const printContent = `
<!DOCTYPE html>
<html dir="rtl" lang="ar">
<head>
  <meta charset="UTF-8">
  <title>إيصال استلام - ${ticketNo}</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    @page { size: ${pageSize}mm auto; margin: 0; }
    
    body {
      font-family: Arial, Tahoma, sans-serif;
      width: ${paperWidth};
      max-width: ${paperWidth};
      margin: 0 auto;
      padding: 3mm;
      background: #fff;
      color: #000;
      font-size: 12px;
      line-height: 1.4;
      font-weight: 600;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }
    
    .header {
      text-align: center;
      padding-bottom: 3mm;
      border-bottom: 0.5mm solid #000;
      margin-bottom: 2mm;
    }
    .logo { max-width: 14mm; max-height: 14mm; margin-bottom: 1mm; }
    .shop-name { font-size: 16px; font-weight: 700; letter-spacing: 0.5mm; }
    
    .ticket-no {
      text-align: center;
      font-size: 18px;
      font-weight: 700;
      margin: 3mm 0;
      padding: 2mm;
      background: #f0f0f0;
      border: 0.3mm dashed #000;
    }
    
    .info {
      display: flex;
      justify-content: space-between;
      padding: 2mm 0;
      font-size: 11px;
      font-weight: 600;
      color: #000;
      border-bottom: 0.3mm solid #000;
    }
    .info-num { font-weight: 700; font-size: 12px; }
    
    .section {
      padding: 2mm 0;
      border-bottom: 0.3mm solid #000;
    }
    .section-title {
      font-size: 10px;
      font-weight: 700;
      color: #000;
      margin-bottom: 1.5mm;
      padding-bottom: 1mm;
      border-bottom: 0.2mm dashed #000;
    }
    .data-row {
      display: flex;
      justify-content: space-between;
      font-size: 11px;
      padding: 1mm 0;
      font-weight: 600;
    }
    .data-value { 
      font-weight: 700; 
      max-width: 55%; 
      text-align: left; 
    }
    
    .issue-box {
      background: #f0f0f0;
      padding: 2mm;
      margin: 2mm 0;
      font-size: 10px;
      font-weight: 600;
      color: #000;
    }
    
    .deposit {
      background: #000;
      color: #fff;
      margin: 2mm -3mm;
      padding: 2.5mm 3mm;
      text-align: center;
      font-size: 13px;
      font-weight: 700;
    }
    
    .policy {
      background: #fff8e1;
      border: 0.3mm solid #ffc107;
      padding: 2mm;
      margin: 2mm 0;
      font-size: 8px;
      text-align: center;
      line-height: 1.4;
    }
    
    .footer {
      text-align: center;
      padding-top: 3mm;
      margin-top: 2mm;
      border-top: 0.3mm solid #000;
    }
    .footer-msg {
      font-size: 11px;
      font-weight: 600;
      color: #000;
      margin-bottom: 2mm;
    }
    .barcode { margin-top: 2mm; }
    .barcode svg { max-width: 85%; height: auto; }
    .barcode-num {
      font-family: monospace;
      font-size: 10px;
      font-weight: 700;
      color: #000;
      margin-top: 1mm;
    }
    .elos-sig {
      margin-top: 3mm;
      padding-top: 2mm;
      border-top: 0.3mm dashed #000;
      font-size: 9px;
      font-weight: 600;
      color: #000;
      letter-spacing: 0.3mm;
    }
  </style>
</head>
<body>

  <div class="header">
    ${companyLogo ? `<img src="${companyLogo}" class="logo" />` : ''}
    <div class="shop-name">${companyName}</div>
  </div>

  <div class="ticket-no">🎫 #${window.escapeHtml(ticketNo)}</div>

  <div class="info">
    <div>
      <div class="info-num">${dateStr} - ${timeStr}</div>
    </div>
    ${customerName || customerPhone ? `
      <div style="text-align: left;">
        ${customerName ? `<div style="font-weight: 700;">${window.escapeHtml(customerName)}</div>` : ''}
        ${customerPhone ? `<div>${window.escapeHtml(customerPhone)}</div>` : ''}
      </div>
    ` : ''}
  </div>

  <div class="section">
    <div class="section-title">📱 بيانات الجهاز</div>
    <div class="data-row">
      <span>النوع:</span>
      <span class="data-value">${window.escapeHtml(deviceCategory)}</span>
    </div>
    ${deviceBrandModel ? `
      <div class="data-row">
        <span>الماركة/الموديل:</span>
        <span class="data-value">${window.escapeHtml(deviceBrandModel)}</span>
      </div>
    ` : ''}
    ${detailImei && detailImei !== '-' ? `
      <div class="data-row">
        <span>IMEI/Serial:</span>
        <span class="data-value" style="font-family: monospace;">${window.escapeHtml(detailImei)}</span>
      </div>
    ` : ''}
    ${techNameForReceipt ? `
      <div class="data-row">
        <span>الفني:</span>
        <span class="data-value">${window.escapeHtml(techNameForReceipt)}</span>
      </div>
    ` : ''}
  </div>

  ${issueDescription && issueDescription !== '-' ? `
    <div class="section">
      <div class="section-title">🔧 المشكلة</div>
      <div class="issue-box">${window.escapeHtml(issueDescription)}</div>
    </div>
  ` : ''}

  ${depositAmount > 0 ? `
    <div class="deposit">
      💰 العربون المدفوع: ${window.fmt(depositAmount)} ج.م
    </div>
  ` : ''}

  <div class="policy">
    ⚠️ يرجى الاحتفاظ بهذا الإيصال لاستلام الجهاز<br>
    المحل غير مسؤول عن الأجهزة التي لم تُستلم خلال 30 يوم
  </div>

  <div class="footer">
    <div class="footer-msg">${settings.printerFooterMessage || 'شكراً لتعاملكم معنا'}</div>
    <div class="barcode" style="margin: 4mm 0; text-align: center; padding: 2mm 0; border-top: 0.3mm dashed #000; border-bottom: 0.3mm dashed #000;">
      ${typeof BarcodeService !== 'undefined'
        ? BarcodeService.generateCode128SVG((ticketNo || currentRepairId || '000000').toString().replace(/[^A-Z0-9]/gi, '') || '000000', 200, 45)
        : generateBarcodeSVG((ticketNo || currentRepairId || '000000').toString().replace(/[^A-Z0-9]/gi, '') || '000000')
      }
      <div class="barcode-num" style="margin-top: 2mm; font-size: 12px; font-weight: 700; letter-spacing: 1px;">#${window.escapeHtml(ticketNo || currentRepairId || '')}</div>
    </div>
    <div class="elos-sig">
      <div>ELOS ACCOUNTING SYSTEM</div>
      <div>01031372078</div>
    </div>
  </div>

</body>
</html>`;

  const printWindow = window.open('', '_blank', 'width=350,height=700');
  if (!printWindow) {
    if (typeof showToast === 'function') showToast('فشل فتح نافذة الطباعة', 'error');
    return;
  }

  printWindow.document.write(printContent);
  printWindow.document.close();

  printWindow.onload = function() {
    setTimeout(() => {
      printWindow.print();
      printWindow.close();
    }, 300);
  };

  if (typeof showToast === 'function') showToast('جاري طباعة إيصال الاستلام...', 'info');
}

async function printDeviceLabel() {
  if (!currentRepairId) {
    if (typeof showToast === 'function') showToast('لا توجد تذكرة مفتوحة', 'error');
    return;
  }

  try {
    // الحصول على البيانات من API للحصول على جميع البيانات
    const data = await apiRequest(`elos-db://repairs/${currentRepairId}`);
    const ticket = data.ticket || data;
    
    // الحصول على البيانات من التذكرة
    const ticketNo = ticket.ticket_no || ticket.id || '';
    const customerName = ticket.customer_name || '-';
    const customerPhone = ticket.customer_phone || '';
    const deviceModel = ticket.device_model || ticket.model || '';
    const deviceBrand = ticket.device_brand || ticket.brand || '';
    const deviceCategory = DEVICE_CATEGORIES[ticket.device_category] || ticket.device_category || '';
    const issueDescription = ticket.issue_description || 'صيانة';
    const imeiSerial = ticket.imei_or_serial || '';
    const estimatedCost = ticket.estimated_cost || ticket.package_price || 0;
    const receivedDate = ticket.created_at ? new Date(ticket.created_at).toLocaleDateString('ar-EG') : '';
    const shopName = getShopName();
    const techNameSticker = (ticket.assigned_tech_name || '').trim() || '';

    // دمج الموديل مع النوع
    const deviceInfo = [deviceBrand, deviceModel, deviceCategory].filter(v => v && v !== '-').join(' | ');

  // Open preview window with proper size
  const printWindow = window.open('', '_blank', 'width=450,height=380');
  printWindow.document.write(`
<!DOCTYPE html>
<html dir="rtl">
<head>
  <meta charset="UTF-8">
  <title>ملصق استلام صيانة - ${window.escapeHtml(ticketNo)}</title>
  <style>
    @page {
      size: 38mm 25mm;
      margin: 0;
    }
    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }
    body {
      font-family: Arial, sans-serif;
      background: #f5f5f5;
      padding: 20px;
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 15px;
    }
    .preview-title {
      font-size: 14px;
      color: #333;
      font-weight: bold;
    }
    .label-preview {
      width: 38mm;
      height: 25mm;
      background: #ffffff;
      border: 1px solid #ccc;
      padding: 2px;
      display: flex;
      flex-direction: column;
      justify-content: flex-start;
      overflow: hidden;
      direction: rtl;
      box-shadow: 0 2px 8px rgba(0,0,0,0.15);
      gap: 1px;
    }
    .shop-name {
      font-size: 10px;
      font-weight: bold;
      text-align: center;
      border-bottom: 1px solid #000;
      padding-bottom: 2px;
      margin-bottom: 2px;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }
    .ticket-no {
      font-size: 12px;
      font-weight: bold;
      text-align: center;
      margin: 2px 0;
      color: #000;
    }
    .problem {
      font-size: 10px;
      font-weight: bold;
      text-align: center;
      line-height: 1.3;
      padding: 1px 0;
      word-wrap: break-word;
      overflow-wrap: break-word;
    }
    .device-model {
      font-size: 10px;
      font-weight: bold;
      text-align: center;
      padding: 1px 0;
      word-wrap: break-word;
      overflow-wrap: break-word;
      display: flex;
      justify-content: space-between;
      align-items: center;
      gap: 4px;
      overflow: hidden;
    }
    .device-info {
      flex: 1;
      min-width: 0;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
      direction: rtl;
      text-align: right;
    }
    .customer-info {
      font-size: 10px;
      font-weight: bold;
      text-align: left;
      padding: 0;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
      color: #000000;
      flex-shrink: 0;
      direction: ltr;
    }
    .info-row {
      font-size: 8px;
      text-align: center;
      padding: 1px 0;
      word-wrap: break-word;
      overflow-wrap: break-word;
      border-top: 1px solid #000;
      padding-top: 2px;
      margin-top: 2px;
    }
    .controls {
      display: flex;
      gap: 10px;
    }
    .btn {
      padding: 8px 20px;
      border: none;
      border-radius: 6px;
      cursor: pointer;
      font-size: 13px;
      font-weight: bold;
    }
    .btn-print {
      background: #4CAF50;
      color: white;
    }
    .btn-close {
      background: #666;
      color: white;
    }
    .btn:hover {
      opacity: 0.9;
    }
    @media print {
      body {
        background: white;
        padding: 0;
      }
      .preview-title, .controls {
        display: none !important;
      }
      .label-preview {
        border: none;
        box-shadow: none;
      }
    }
  </style>
</head>
<body>
  <div class="preview-title">معاينة ملصق الجهاز</div>
  <div class="label-preview">
    <div class="shop-name">${window.escapeHtml(shopName)}</div>
    <div class="ticket-no">#${window.escapeHtml(ticketNo)}</div>
    <div class="device-model">
      <div class="device-info">📱 ${window.escapeHtml(deviceInfo)}</div>
      <div class="customer-info">👤 ${window.escapeHtml(customerName)}</div>
    </div>
    <div class="problem">🔧 ${window.escapeHtml(issueDescription)}</div>
    <div class="info-row">${techNameSticker ? '👤 ' + window.escapeHtml(techNameSticker) + ' | ' : ''}${customerPhone && customerPhone !== '-' ? '📞 ' + window.escapeHtml(customerPhone) + ' | ' : ''}${imeiSerial && imeiSerial !== '-' ? 'IMEI: ' + window.escapeHtml(imeiSerial) + ' | ' : ''}${receivedDate ? '📅 ' + window.escapeHtml(receivedDate) : ''}${estimatedCost > 0 ? ' | 💰 ' + estimatedCost.toLocaleString() + ' ج' : ''}</div>
  </div>
  <div class="controls">
    <button class="btn btn-print" onclick="window.print()">طباعة</button>
    <button class="btn btn-close" onclick="window.close()">إغلاق</button>
  </div>
</body>
</html>
  `);
  printWindow.document.close();

  if (typeof showToast === 'function') showToast('جاري عرض ملصق الجهاز...', 'info');
  } catch (error) {
    Logger.error('Error printing device label:', error);
    if (typeof showToast === 'function') showToast('فشل في طباعة ملصق الجهاز', 'error');
  }
}

async function printRepairInvoice() {
  if (!currentRepairId) {
    if (typeof showToast === 'function') showToast('لا توجد تذكرة مفتوحة', 'error');
    return;
  }

  try {
    // Try to get invoice from the ticket
    const ticket = await apiRequest(`elos-db://repairs/${currentRepairId}`);

    // Check if invoice exists
    let invoice;
    try {
      const invoices = await apiRequest('elos-db://repairs/invoices');
      invoice = invoices.find(inv => inv.ticket_id === currentRepairId);
    } catch (e) {
      // No invoice yet
    }

    if (!invoice && ticket.status !== 'delivered') {
      if (typeof showToast === 'function') showToast('لا توجد فاتورة. يتم إنشاء الفاتورة عند التسليم.', 'warning');
      return;
    }

    // Get settings
    const settings = JSON.parse(localStorage.getItem('appSettings') || '{}');
    const companyName = settings.companyName || 'ELOS';
    const companyLogo = settings.companyLogo || '';
    const paperWidth = settings.printerPaperWidth === '58' ? '54mm' : '72mm';
    const pageSize = settings.printerPaperWidth || '80';

    const ticketNo = ticket.ticket_no || '';
    const invoiceNo = invoice?.invoice_no || `INV-${ticketNo}`;
    const customerName = ticket.customer_name || '';
    const customerPhone = ticket.customer_phone || '';
    const deviceModel = ticket.device_model || ticket.device_category || '';
    const totalCost = ticket.total_cost || 0;
    const issueDescription = ticket.issue_description || '';

    // Get payments
    const paymentsData = await apiRequest(`elos-db://repairs/${currentRepairId}/payments`);
    const payments = paymentsData.payments || [];
    const totalPaid = paymentsData.total_paid || 0;
    const remaining = paymentsData.remaining || 0;

    // Get parts
    let parts = [];
    try {
      parts = await apiRequest(`elos-db://repairs/${currentRepairId}/parts`);
    } catch (e) {}

    // Use unit_price (sell price) for total calculation, fallback for legacy rows
    const partsTotal = parts.reduce((sum, p) => {
      const unitPrice = p.unit_price && p.unit_price > 0 
        ? p.unit_price 
        : (p.part_sell_price && p.part_sell_price > 0 ? p.part_sell_price : (p.unit_cost || 0));
      return sum + (p.qty * unitPrice);
    }, 0);

    const serviceFee = totalCost - partsTotal;

    const methodLabels = { cash: 'كاش', mobile_wallet: 'محفظة', bank: 'بنك', card: 'محفظة', transfer: 'تحويل' };
    const kindLabels = { deposit: 'عربون', partial: 'دفعة', final: 'تسوية', refund: 'استرداد' };

    const now = new Date();
    const dateStr = now.toLocaleDateString('ar-EG');
    const timeStr = now.toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' });

    // Build parts HTML - using unit_price (sell price)
    let partsHTML = '';
    if (parts.length > 0) {
      partsHTML += '<div class="acc-divider">قطع الغيار</div>';
      parts.forEach(p => {
        const unitPrice = p.unit_price && p.unit_price > 0 
          ? p.unit_price 
          : (p.part_sell_price && p.part_sell_price > 0 ? p.part_sell_price : (p.unit_cost || 0));
        const lineTotal = p.qty * unitPrice;
        partsHTML += `
          <div class="acc-item">
            <span>${window.escapeHtml(p.part_name)} × ${p.qty}</span>
            <span>${window.fmt(lineTotal)}</span>
          </div>`;
      });
    }

    // Build payments HTML
    let paymentsHTML = '';
    if (payments.length > 0) {
      paymentsHTML += '<div class="acc-divider">المدفوعات</div>';
      payments.forEach(p => {
        const methodLabel = methodLabels[p.method || p.wallet_type] || 'كاش';
        const kindLabel = kindLabels[p.kind] || 'دفعة';
        const payDate = new Date(p.created_at).toLocaleDateString('ar-EG');
        paymentsHTML += `
          <div class="acc-item">
            <span>${kindLabel} - ${methodLabel} (${payDate})</span>
            <span>${window.fmt(p.amount)}</span>
          </div>`;
      });
    }

    const printContent = `
<!DOCTYPE html>
<html dir="rtl" lang="ar">
<head>
  <meta charset="UTF-8">
  <title>فاتورة صيانة - ${invoiceNo}</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    @page { size: ${pageSize}mm auto; margin: 0; }
    
    body {
      font-family: Arial, Tahoma, sans-serif;
      width: ${paperWidth};
      max-width: ${paperWidth};
      margin: 0 auto;
      padding: 3mm;
      background: #fff;
      color: #000;
      font-size: 12px;
      line-height: 1.4;
      font-weight: 600;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }
    
    .header {
      text-align: center;
      padding-bottom: 3mm;
      border-bottom: 0.5mm solid #000;
      margin-bottom: 2mm;
    }
    .logo { max-width: 14mm; max-height: 14mm; margin-bottom: 1mm; }
    .shop-name { font-size: 16px; font-weight: 700; letter-spacing: 0.5mm; }
    
    .info {
      display: flex;
      justify-content: space-between;
      padding: 2mm 0;
      font-size: 11px;
      font-weight: 600;
      color: #000;
      border-bottom: 0.3mm solid #000;
    }
    .info-num { font-weight: 700; font-size: 12px; }
    
    .section {
      padding: 2mm 0;
      font-size: 11px;
      font-weight: 600;
      color: #000;
      border-bottom: 0.3mm solid #000;
    }
    .section-title {
      font-size: 10px;
      font-weight: 700;
      color: #000;
      margin-bottom: 1.5mm;
      padding-bottom: 1mm;
      border-bottom: 0.2mm dashed #000;
    }
    .data-row {
      display: flex;
      justify-content: space-between;
      font-size: 11px;
      padding: 1mm 0;
      font-weight: 600;
    }
    
    .items { padding: 2mm 0; }
    .item {
      padding: 2mm 0;
      border-bottom: 0.3mm solid #000;
    }
    .item:last-child { border-bottom: none; }
    .item-header {
      display: flex;
      justify-content: space-between;
      font-weight: 700;
      font-size: 12px;
      color: #000;
    }
    
    .acc-divider {
      font-size: 11px;
      font-weight: 700;
      color: #000;
      padding: 2mm 0 1mm;
      border-bottom: 0.3mm dashed #000;
      margin-top: 1mm;
    }
    .acc-item {
      display: flex;
      justify-content: space-between;
      padding: 1.5mm 0;
      font-size: 11px;
      font-weight: 600;
      color: #000;
    }
    
    .summary {
      border-top: 0.3mm solid #000;
      padding-top: 2mm;
      margin-top: 1mm;
      font-size: 11px;
      font-weight: 600;
      color: #000;
    }
    .summary-row {
      display: flex;
      justify-content: space-between;
      padding: 1mm 0;
    }
    
    .total {
      background: #000;
      color: #fff;
      margin: 3mm -3mm;
      padding: 4mm 3mm;
      text-align: center;
    }
    .total-label {
      font-size: 10px;
      font-weight: 600;
      letter-spacing: 1mm;
    }
    .total-amount {
      font-size: 18px;
      font-weight: 700;
      margin-top: 1mm;
    }
    
    .payment {
      display: flex;
      justify-content: space-between;
      font-size: 11px;
      font-weight: 600;
      padding: 2mm 0;
      color: #000;
    }
    
    .remaining-row {
      background: #000;
      margin: 0 -3mm;
      padding: 2.5mm 3mm;
      display: flex;
      justify-content: space-between;
      font-size: 13px;
      font-weight: 900;
      color: #fff;
    }
    .paid-row {
      background: #ddd;
      margin: 0 -3mm;
      padding: 2mm 3mm;
      display: flex;
      justify-content: space-between;
      font-size: 12px;
      font-weight: 900;
      color: #000;
      border-bottom: 0.3mm solid #000;
    }
    
    .footer {
      text-align: center;
      padding-top: 3mm;
      margin-top: 2mm;
      border-top: 0.3mm solid #000;
    }
    .footer-msg {
      font-size: 11px;
      font-weight: 600;
      color: #000;
      margin-bottom: 2mm;
    }
    .barcode { margin-top: 2mm; }
    .barcode svg { max-width: 85%; height: auto; }
    .barcode-num {
      font-family: monospace;
      font-size: 10px;
      font-weight: 700;
      color: #000;
      margin-top: 1mm;
    }
    .elos-sig {
      margin-top: 3mm;
      padding-top: 2mm;
      border-top: 0.3mm dashed #000;
      font-size: 9px;
      font-weight: 600;
      color: #000;
      letter-spacing: 0.3mm;
    }
  </style>
</head>
<body>

  <div class="header">
    ${companyLogo ? `<img src="${companyLogo}" class="logo" />` : ''}
    <div class="shop-name">${companyName}</div>
  </div>

  <div class="info">
    <div>
      <div class="info-num">#${window.escapeHtml(invoiceNo)}</div>
      <div>${dateStr} - ${timeStr}</div>
      <div style="font-size: 10px; margin-top: 1mm;">تذكرة: #${window.escapeHtml(ticketNo)}</div>
    </div>
    ${customerName || customerPhone ? `
      <div style="text-align: left;">
        ${customerName ? `<div style="font-weight: 700;">${window.escapeHtml(customerName)}</div>` : ''}
        ${customerPhone ? `<div>${window.escapeHtml(customerPhone)}</div>` : ''}
      </div>
    ` : ''}
  </div>

  <div class="section">
    <div class="section-title">📱 بيانات الجهاز</div>
    <div class="data-row">
      <span>الجهاز:</span>
      <span style="font-weight: 700;">${window.escapeHtml(deviceModel)}</span>
    </div>
  </div>

  <div class="items">
    ${serviceFee > 0 ? `
      <div class="item">
        <div class="item-header">
          <span>أجرة الصيانة</span>
          <span>${window.fmt(serviceFee)}</span>
        </div>
        ${issueDescription ? `<div style="font-size: 10px; color: #000; margin-top: 0.5mm;">${window.escapeHtml(issueDescription.substring(0, 40))}</div>` : ''}
      </div>
    ` : ''}
    ${partsHTML}
    ${paymentsHTML}
  </div>

  ${parts.length > 0 || payments.length > 0 ? `
    <div class="summary">
      ${serviceFee > 0 ? `<div class="summary-row"><span>أجرة الصيانة</span><span>${window.fmt(serviceFee)}</span></div>` : ''}
      ${parts.length > 0 ? `<div class="summary-row"><span>قطع الغيار</span><span>${window.fmt(partsTotal)}</span></div>` : ''}
    </div>
  ` : ''}

  <div class="total">
    <div class="total-label">الإجمالي</div>
    <div class="total-amount">EGP ${window.fmt(totalCost)}</div>
  </div>

  ${remaining > 0 ? `
    <div class="paid-row">
      <span>المدفوع</span>
      <span>${window.fmt(totalPaid)} ج.م</span>
    </div>
    <div class="remaining-row">
      <span>المتبقي</span>
      <span>${window.fmt(remaining)} ج.م</span>
    </div>
  ` : `
    <div class="payment">
      <span>حالة الدفع:</span>
      <span>تم الدفع بالكامل</span>
    </div>
  `}

  <div class="footer">
    <div class="footer-msg">${settings.printerFooterMessage || 'شكراً لتعاملكم معنا'}</div>
    ${ticket.warranty_days ? `<div class="footer-msg" style="font-size: 10px;">ضمان الصيانة: ${ticket.warranty_days} يوم</div>` : ''}
    <div class="barcode" style="margin: 4mm 0; text-align: center;">
      ${typeof BarcodeService !== 'undefined' 
        ? BarcodeService.generateCode128SVG(invoiceNo.replace(/[^A-Z0-9]/gi, '').slice(-12), 200, 40)
        : generateBarcodeSVG(invoiceNo.replace(/[^A-Z0-9]/gi, '').slice(-12))
      }
      <div class="barcode-num" style="margin-top: 2mm; font-size: 11px; font-weight: 700;">${window.escapeHtml(invoiceNo)}</div>
    </div>
    <div class="elos-sig">
      <div>ELOS ACCOUNTING SYSTEM</div>
      <div>01031372078</div>
    </div>
  </div>

</body>
</html>`;

    const printWindow = window.open('', '_blank', 'width=350,height=700');
    if (!printWindow) {
      if (typeof showToast === 'function') showToast('فشل فتح نافذة الطباعة', 'error');
      return;
    }

    printWindow.document.write(printContent);
    printWindow.document.close();

    printWindow.onload = function() {
      setTimeout(() => {
        printWindow.print();
        printWindow.close();
      }, 300);
    };

    if (typeof showToast === 'function') showToast('جاري طباعة فاتورة الصيانة...', 'info');

  } catch (error) {
    Logger.error('Failed to print invoice:', error);
    if (typeof showToast === 'function') showToast(error.message || 'فشل في طباعة الفاتورة', 'error');
  }
}

async function generateRepairInvoice() {
  if (!currentRepairId) {
    if (typeof showToast === 'function') showToast('لا توجد تذكرة مفتوحة', 'error');
    return;
  }

  try {
    const result = await apiRequest(`elos-db://repairs/${currentRepairId}/generate-invoice`, {
      method: 'POST',
      body: JSON.stringify({})
    });

    if (result.ok || result.invoice_no) {
      if (typeof showToast === 'function') showToast(`تم إنشاء الفاتورة: ${result.invoice_no}`, 'success');
      // Update UI
      document.getElementById('btnGenerateInvoice').style.display = 'none';
      // Show print invoice button after invoice created
      const btnPrintInvoiceFooter = document.getElementById('btnPrintInvoice');
      if (btnPrintInvoiceFooter) btnPrintInvoiceFooter.style.display = 'inline-flex';
      await loadTicketEvents(currentRepairId);
      // تحديث بطاقات KPI بعد إنشاء الفاتورة
      await updateDashboardStats();
    }
  } catch (error) {
    Logger.error('Failed to generate invoice:', error);
    if (typeof showToast === 'function') showToast(error.message || 'فشل في إنشاء الفاتورة', 'error');
  }
}

function copyTicketNumber() {
  const ticketNo = document.getElementById('detailTicketNo')?.textContent || '';
  if (ticketNo) {
    navigator.clipboard.writeText(ticketNo).then(() => {
      if (typeof showToast === 'function') showToast('تم نسخ رقم التذكرة', 'success');
    }).catch(err => {
      Logger.error('Failed to copy:', err);
    });
  }
}

function copyCustomerPhone() {
  const phone = document.getElementById('detailCustomerPhone')?.textContent || '';
  if (phone) {
    navigator.clipboard.writeText(phone).then(() => {
      if (typeof showToast === 'function') showToast('تم نسخ رقم الهاتف', 'success');
    }).catch(err => {
      Logger.error('Failed to copy:', err);
    });
  }
}

// ═══════════════════════════════════════════════════════════════
// 🏷️ BARCODE PRINTING FOR REPAIRS (V2.0)
// ═══════════════════════════════════════════════════════════════

/**
 * طباعة ملصق استلام الصيانة (نص فقط - بدون باركود)
 * يُطبع على ملصق 38×25mm بخط واضح قابل للقراءة
 * @param {Object} ticket - بيانات التذكرة
 * @param {Object} options - خيارات الطباعة
 */
async function printRepairBarcode(ticket, options = {}) {
  if (!ticket) {
    if (typeof showToast === 'function') showToast('لا توجد تذكرة للطباعة', 'error');
    return;
  }

  try {
    // إعداد بيانات الاستلام
    const ticketNo = ticket.ticket_no || ticket.id || '';
    const deviceModel = ticket.device_model || ticket.model || 'غير محدد';
    const deviceCategory = DEVICE_CATEGORIES[ticket.device_category] || ticket.device_category || '';
    const clientName = ticket.customer_name || '';
    const clientPhone = ticket.customer_phone || '';
    const problemDesc = (ticket.issue_description || '').substring(0, 40); // اقطع لو طويل
    const receivedDate = ticket.created_at ? new Date(ticket.created_at).toLocaleDateString('ar-EG') : '';
    const estimatedCost = ticket.estimated_cost || ticket.package_price || 0;
    const techLabel = (ticket.assigned_tech_name || '').trim() || '';

    Logger.log('🖨️ Printing repair receipt label:', ticketNo);

    // إنشاء ملصق نصي (38×25mm = 140×90px)
    const labelHTML = `
      <div class="repair-receipt-label" style="
        width: 140px;
        height: 90px;
        max-width: 140px;
        max-height: 90px;
        background: #ffffff;
        padding: 3px;
        font-family: Arial, sans-serif;
        box-sizing: border-box;
        display: flex;
        flex-direction: column;
        justify-content: space-between;
        overflow: hidden;
        direction: rtl;
        color: #000000;
      ">
        <!-- رقم التذكرة (كبير وواضح) -->
        <div style="
          text-align: center;
          font-size: 12px;
          font-weight: bold;
          color: #000000;
          border-bottom: 1px solid #000;
          padding-bottom: 2px;
          margin-bottom: 2px;
        ">#${ticketNo}</div>

        <!-- الجهاز -->
        <div style="
          font-size: 8px;
          font-weight: bold;
          color: #000000;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
          line-height: 1.2;
        ">${deviceModel}${deviceCategory ? ' - ' + deviceCategory : ''}</div>

        <!-- العميل -->
        <div style="
          font-size: 7px;
          color: #000000;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
          line-height: 1.2;
        ">${clientName}${clientPhone ? ' | ' + clientPhone : ''}</div>

        <!-- المشكلة -->
        <div style="
          font-size: 6px;
          color: #000000;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
          line-height: 1.2;
        ">${problemDesc || 'صيانة'}</div>

        ${techLabel ? `<!-- الفني --><div style="font-size: 6px; color: #000000; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">👤 ${window.escapeHtml(techLabel)}</div>` : ''}

        <!-- التاريخ والتكلفة -->
        <div style="
          display: flex;
          justify-content: space-between;
          align-items: center;
          font-size: 7px;
          font-weight: bold;
          color: #000000;
          border-top: 1px solid #000;
          padding-top: 2px;
          margin-top: 2px;
        ">
          <span>${receivedDate}</span>
          ${estimatedCost > 0 ? `<span style="border: 1px solid #000; padding: 1px 3px;">${estimatedCost.toLocaleString()} ج</span>` : ''}
        </div>
      </div>
    `;

    // بناء HTML الطباعة الكامل
    const printHTML = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <title>ملصق استلام صيانة - #${ticketNo}</title>
        <style>
          * { margin: 0; padding: 0; box-sizing: border-box; }
          body { background: white; margin: 0; padding: 0; }
          @media print {
            @page { size: 38mm 25mm; margin: 0; }
            body { background: white; }
            .repair-receipt-label {
              page-break-after: always;
              page-break-inside: avoid;
            }
            .repair-receipt-label * {
              color: #000000 !important;
              -webkit-print-color-adjust: exact !important;
              print-color-adjust: exact !important;
            }
          }
        </style>
      </head>
      <body>${labelHTML}</body>
      </html>
    `;

    // فتح نافذة معاينة الطباعة (دائماً معاينة أولاً)
    const printWindow = window.open('', '_blank', 'width=400,height=350');
    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <title>ملصق استلام صيانة - #${ticketNo}</title>
        <style>
          * { margin: 0; padding: 0; box-sizing: border-box; }
          body { font-family: Arial, sans-serif; background: #f0f0f0; padding: 20px; text-align: center; }
          .controls { margin-bottom: 20px; }
          .controls button {
            padding: 10px 20px; margin: 0 5px; border: none; border-radius: 5px;
            font-size: 14px; font-weight: bold; cursor: pointer;
          }
          .btn-print { background: #3b82f6; color: white; }
          .btn-close { background: #666; color: white; }
          .preview { display: inline-block; border: 1px dashed #999; background: white; }
          @media print {
            @page { size: 38mm 25mm; margin: 0; }
            .controls { display: none !important; }
            body { background: white; padding: 0; }
            .preview { border: none; }
            .repair-receipt-label * {
              color: #000000 !important;
              -webkit-print-color-adjust: exact !important;
              print-color-adjust: exact !important;
            }
          }
        </style>
      </head>
      <body>
        <div class="controls">
          <button class="btn-print" onclick="window.print()">🖨️ طباعة</button>
          <button class="btn-close" onclick="window.close()">✕ إغلاق</button>
        </div>
        <div class="preview">${labelHTML}</div>
      </body>
      </html>
    `);
    printWindow.document.close();

    if (typeof showToast === 'function') {
      showToast('تم فتح نافذة طباعة ملصق الاستلام', 'info');
    }

  } catch (error) {
    Logger.error('Print repair receipt error:', error);
    if (typeof showToast === 'function') {
      showToast(error.message || 'فشل في طباعة ملصق الاستلام', 'error');
    }
  }
}

/**
 * البحث عن تذكرة بالباركود
 * @param {String} barcode - الباركود
 * @returns {Object} بيانات التذكرة
 */
async function searchTicketByBarcode(barcode) {
  if (!barcode || barcode.trim().length < 2) {
    return null;
  }

  try {
    const data = await apiRequest(`elos-db://repairs/by-barcode/${encodeURIComponent(barcode.trim())}`);
    return data;
  } catch (error) {
    Logger.error('Search by barcode error:', error);
    return null;
  }
}

/**
 * فتح تذكرة عبر السكانر
 * يستخدم عند مسح الباركود من السكانر
 */
async function openTicketByBarcodeScan(barcode) {
  if (!barcode) return;

  try {
    const ticket = await searchTicketByBarcode(barcode);
    if (ticket && ticket.id) {
      // فتح نافذة تفاصيل التذكرة
      openDetailsModal(ticket.id);
    } else {
      if (typeof showToast === 'function') {
        showToast('لم يتم العثور على تذكرة بهذا الباركود', 'warning');
      }
    }
  } catch (error) {
    Logger.error('Open ticket by barcode error:', error);
    if (typeof showToast === 'function') {
      showToast('خطأ في البحث عن التذكرة', 'error');
    }
  }
}

// ═══════════════════════════════════════════════════════════════
// 📷 BARCODE SCANNER SUPPORT
// ═══════════════════════════════════════════════════════════════
let repairBarcodeBuffer = '';
let repairBarcodeTimeout = null;

// إعداد السكانر للبحث السريع عن التذاكر
function setupRepairBarcodeScanner() {
  document.addEventListener('keypress', (e) => {
    // تجاهل إذا كان المستخدم يكتب في حقل إدخال
    if (document.activeElement.tagName === 'INPUT' ||
        document.activeElement.tagName === 'TEXTAREA' ||
        document.activeElement.tagName === 'SELECT') {
      return;
    }

    // تجاهل إذا كان موديل مفتوح (عدا موديل التفاصيل)
    const openModals = document.querySelectorAll('.modal[style*="display: flex"], .modal[style*="display:flex"]');
    if (openModals.length > 0) {
      return;
    }

    // مسح المؤقت
    clearTimeout(repairBarcodeTimeout);

    // إضافة الحرف للـ buffer
    if (e.key !== 'Enter') {
      repairBarcodeBuffer += e.key;
    }

    // معالجة عند الضغط على Enter (الأولوية للـ Enter)
    if (e.key === 'Enter') {
      clearTimeout(repairBarcodeTimeout);
      if (repairBarcodeBuffer.length >= 6 && /^\d+$/.test(repairBarcodeBuffer)) {
        processRepairBarcode(repairBarcodeBuffer);
      }
      repairBarcodeBuffer = '';
      return;
    }

    // مؤقت لمعالجة الباركود (للسكانرات بدون Enter)
    repairBarcodeTimeout = setTimeout(() => {
      // باركود تذاكر الصيانة: رقم يبدأ من 202... (مثل 202601000008)
      // أو باركود قصير 8 أرقام على الأقل
      if (repairBarcodeBuffer.length >= 8 && /^\d+$/.test(repairBarcodeBuffer)) {
        processRepairBarcode(repairBarcodeBuffer);
      }
      repairBarcodeBuffer = '';
    }, 150);
  });

  Logger.log('✅ Repair barcode scanner initialized');
}

async function processRepairBarcode(code) {
  Logger.log('📷 Repair barcode scanned:', code);

  // تشغيل صوت المسح
  if (typeof SoundFX !== 'undefined' && SoundFX.play) {
    SoundFX.play('scan');
  }

  const cleanCode = String(code).trim();

  // فتح التذكرة بالباركود
  await openTicketByBarcodeScan(cleanCode);
}

// ═══════════════════════════════════════════════════════════════
// 🚀 INITIALIZATION
// ═══════════════════════════════════════════════════════════════
(async function init() {
  Logger.log('🔧 Initializing Repairs page...');

  // Update time immediately and every second
  updateHeaderTime();
  setInterval(updateHeaderTime, 1000);

  // Update user display
  updateUserDisplay();

  // Initialize event handlers
  initEventHandlers();

  // Initialize quick search
  initRepairsQuickSearch();

  // Initialize keyboard shortcuts
  initRepairsKeyboardShortcuts();

  // Initialize shortcuts modal
  initShortcutsModal();

  // Load saved view mode preference
  const savedViewMode = localStorage.getItem('repairs_view_mode') || 'table';
  currentViewMode = savedViewMode;

  // Load tickets from API
  await loadTickets();

  // Apply saved view mode after loading
  switchRepairsView(savedViewMode);

  // Initialize barcode scanner for quick search
  setupRepairBarcodeScanner();

  Logger.log('✅ Repairs page ready!');
})();

