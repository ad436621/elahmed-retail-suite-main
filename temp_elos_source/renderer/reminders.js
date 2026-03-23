// ═══════════════════════════════════════════════════════════════
// ⏰ ELOS REMINDERS & TASKS SYSTEM v2.0
// نظام التذكيرات والمهام المتقدم
// ═══════════════════════════════════════════════════════════════

// Fallbacks if utils.js not loaded yet
if (!window.Logger) window.Logger = { log: () => {}, warn: () => {}, error: console.error, debug: () => {}, info: () => {} };
if (!window.fmt) window.fmt = (n, decimals = 2) => Number(n || 0).toLocaleString('en-US', { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
if (!window.escapeHtml) window.escapeHtml = (text) => { if (text === null || text === undefined) return ''; const div = document.createElement('div'); div.textContent = String(text); return div.innerHTML; };
const fmt = window.fmt;
const escapeHtml = window.escapeHtml;

let reminders = [];
let currentTab = 'all';
let currentEditingId = null;
let currentMonth = new Date().getMonth();
let currentYear = new Date().getFullYear();
let selectedDate = null;

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
    window.IntervalManager.set('reminders-clock', updateClock, 1000);
  } else {
    if (window._remindersClockInterval) clearInterval(window._remindersClockInterval);
    window._remindersClockInterval = setInterval(updateClock, 1000);
  }
}

// ═══════════════════════════════════════════════════════════════
// 📊 LOAD DATA
// ═══════════════════════════════════════════════════════════════
async function loadReminders() {
  try {
    const response = await fetch('elos-db://reminders');
    if (!response.ok) throw new Error(await response.text());
    reminders = await response.json();
    
    updateStats();
    renderReminders();
    
    Logger.log('✅ Reminders loaded:', reminders.length);
  } catch (error) {
    Logger.error('Error loading reminders:', error);
    showToast('خطأ في تحميل التذكيرات', 'error');
  }
}

// ═══════════════════════════════════════════════════════════════
// 📈 UPDATE STATISTICS
// ═══════════════════════════════════════════════════════════════
function updateStats() {
  const today = new Date().toISOString().split('T')[0];
  
  const total = reminders.length;
  const pending = reminders.filter(r => r.status === 'pending').length;
  const completed = reminders.filter(r => r.status === 'completed').length;
  const urgent = reminders.filter(r => r.priority === 'urgent' && r.status === 'pending').length;
  const todayCount = reminders.filter(r => r.reminder_date === today && r.status === 'pending').length;
  const overdue = reminders.filter(r => r.reminder_date < today && r.status === 'pending').length;
  
  // Header cards
  document.getElementById('statTotal').textContent = total;
  document.getElementById('statPending').textContent = pending;
  document.getElementById('statToday').textContent = todayCount;
  document.getElementById('statUrgent').textContent = urgent;
  document.getElementById('statCompleted').textContent = completed;
  
  // Tab badges
  document.getElementById('tabAll').textContent = total;
  document.getElementById('tabPending').textContent = pending;
  document.getElementById('tabToday').textContent = todayCount;
  document.getElementById('tabUrgent').textContent = urgent;
  document.getElementById('tabOverdue').textContent = overdue;
  document.getElementById('tabCompleted').textContent = completed;
}

// ═══════════════════════════════════════════════════════════════
// 🎯 TAB SWITCHING
// ═══════════════════════════════════════════════════════════════
function switchTab(tabName) {
  currentTab = tabName;
  
  // Update tab styles
  document.querySelectorAll('.tab').forEach(tab => {
    tab.classList.toggle('active', tab.dataset.tab === tabName);
  });
  
  // Show/hide panels
  document.querySelectorAll('.panel').forEach(panel => {
    panel.classList.remove('active');
  });
  
  if (tabName === 'calendar') {
    document.getElementById('calendarPanel').classList.add('active');
    renderCalendar();
  } else {
    document.getElementById('remindersPanel').classList.add('active');
    updatePanelTitle();
    renderReminders();
  }
}

function updatePanelTitle() {
  const titles = {
    'all': 'كل التذكيرات',
    'pending': 'التذكيرات قيد الانتظار',
    'today': 'تذكيرات اليوم',
    'urgent': 'التذكيرات العاجلة',
    'overdue': 'التذكيرات المتأخرة',
    'completed': 'التذكيرات المكتملة'
  };
  document.getElementById('panelTitle').textContent = titles[currentTab] || 'التذكيرات';
}

// ═══════════════════════════════════════════════════════════════
// 🎨 RENDER REMINDERS
// ═══════════════════════════════════════════════════════════════
function renderReminders() {
  const container = document.getElementById('remindersList');
  let filtered = getFilteredReminders();
  
  // Apply search and filters
  const search = document.getElementById('searchReminder')?.value?.toLowerCase() || '';
  const category = document.getElementById('filterCategory')?.value || '';
  const priority = document.getElementById('filterPriority')?.value || '';
  
  if (search) filtered = filtered.filter(r => r.title?.toLowerCase().includes(search));
  if (category) filtered = filtered.filter(r => r.category === category);
  if (priority) filtered = filtered.filter(r => r.priority === priority);
  
  // Sort by date
  filtered.sort((a, b) => {
    const dateA = new Date(a.reminder_date + ' ' + (a.reminder_time || '00:00'));
    const dateB = new Date(b.reminder_date + ' ' + (b.reminder_time || '00:00'));
    return dateA - dateB;
  });
  
  if (!filtered.length) {
    container.innerHTML = `
      <div class="empty-state" style="grid-column:1/-1">
        <div class="empty-state-icon">⏰</div>
        <div>لا توجد تذكيرات ${getFilterLabel()}</div>
      </div>
    `;
    return;
  }

  const today = new Date().toISOString().split('T')[0];

  container.innerHTML = filtered.map(r => {
    const isOverdue = r.reminder_date < today && r.status === 'pending';
    const cardClass = r.status === 'completed' ? 'completed' : 
                      isOverdue ? 'overdue' : r.priority;
    
    return `
      <div class="reminder-card ${cardClass}">
        <div class="reminder-header">
          <div class="reminder-icon">${getCategoryIcon(r.category)}</div>
          <div class="reminder-content">
            <div class="reminder-title">${escapeHtml(r.title)}</div>
            ${r.description ? `<div class="reminder-desc">${escapeHtml(r.description)}</div>` : ''}
            <div class="reminder-meta">
              <div class="reminder-meta-item">
                <span>📅</span>
                <span>${formatDate(r.reminder_date)}</span>
              </div>
              ${r.reminder_time ? `
                <div class="reminder-meta-item">
                  <span>🕐</span>
                  <span>${r.reminder_time}</span>
                </div>
              ` : ''}
              <span class="badge badge-${r.priority}">${getPriorityLabel(r.priority)}</span>
              ${r.status === 'completed' ? '<span class="badge badge-completed">✅ مكتمل</span>' : ''}
              ${isOverdue ? '<span class="badge badge-overdue">⚠️ متأخر</span>' : ''}
            </div>
          </div>
        </div>
        <div class="reminder-actions">
          ${r.status === 'pending' ? `
            <button class="btn btn-sm btn-success" onclick="completeReminder(${r.id})" title="إنجاز">
              ✓ إنجاز
            </button>
          ` : `
            <button class="btn btn-sm btn-warning" onclick="reopenReminder(${r.id})" title="إعادة فتح">
              ↩️ إعادة
            </button>
          `}
          <button class="btn btn-sm btn-primary" onclick="editReminder(${r.id})" title="تعديل">
            ✏️ تعديل
          </button>
          <button class="btn btn-sm btn-danger" onclick="deleteReminder(${r.id})" title="حذف">
            🗑️
          </button>
        </div>
      </div>
    `;
  }).join('');
}

function getFilteredReminders() {
  const today = new Date().toISOString().split('T')[0];
  
  switch(currentTab) {
    case 'pending':
      return reminders.filter(r => r.status === 'pending');
    case 'completed':
      return reminders.filter(r => r.status === 'completed');
    case 'today':
      return reminders.filter(r => r.reminder_date === today && r.status === 'pending');
    case 'urgent':
      return reminders.filter(r => r.priority === 'urgent' && r.status === 'pending');
    case 'overdue':
      return reminders.filter(r => r.reminder_date < today && r.status === 'pending');
    default:
      return [...reminders];
  }
}

function getFilterLabel() {
  const labels = {
    'all': '', 'pending': 'قيد الانتظار', 'completed': 'مكتملة',
    'today': 'اليوم', 'urgent': 'عاجلة', 'overdue': 'متأخرة'
  };
  return labels[currentTab] || '';
}

function filterReminders() { renderReminders(); }

// ═══════════════════════════════════════════════════════════════
// 📆 CALENDAR
// ═══════════════════════════════════════════════════════════════
function renderCalendar() {
  const grid = document.getElementById('calendarGrid');
  const title = document.getElementById('calendarTitle');
  
  const months = ['يناير', 'فبراير', 'مارس', 'أبريل', 'مايو', 'يونيو',
                  'يوليو', 'أغسطس', 'سبتمبر', 'أكتوبر', 'نوفمبر', 'ديسمبر'];
  
  title.textContent = `${months[currentMonth]} ${currentYear}`;
  
  const firstDay = new Date(currentYear, currentMonth, 1);
  const lastDay = new Date(currentYear, currentMonth + 1, 0);
  const startDay = firstDay.getDay();
  const daysInMonth = lastDay.getDate();
  
  const prevMonthLastDay = new Date(currentYear, currentMonth, 0).getDate();
  
  const today = new Date();
  const todayStr = today.toISOString().split('T')[0];
  
  // Get reminders dates for this month
  const reminderDates = new Set();
  reminders.forEach(r => {
    if (r.reminder_date && r.status === 'pending') {
      const d = new Date(r.reminder_date);
      if (d.getMonth() === currentMonth && d.getFullYear() === currentYear) {
        reminderDates.add(d.getDate());
      }
    }
  });
  
  let html = '';
  
  // Day headers
  const dayNames = ['أحد', 'إثن', 'ثلا', 'أرب', 'خمي', 'جمع', 'سبت'];
  dayNames.forEach(day => {
    html += `<div class="calendar-day-header">${day}</div>`;
  });
  
  // Previous month days
  for (let i = startDay - 1; i >= 0; i--) {
    html += `<div class="calendar-day other-month">${prevMonthLastDay - i}</div>`;
  }
  
  // Current month days
  for (let day = 1; day <= daysInMonth; day++) {
    const dateStr = `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    const isToday = dateStr === todayStr;
    const hasReminders = reminderDates.has(day);
    const isSelected = selectedDate === dateStr;
    
    html += `
      <div class="calendar-day ${isToday ? 'today' : ''} ${hasReminders ? 'has-reminders' : ''} ${isSelected ? 'selected' : ''}"
           onclick="selectDate('${dateStr}')"
           style="${isSelected ? 'background:var(--purple);color:white;' : ''}">
        ${day}
      </div>
    `;
  }
  
  // Next month days
  const totalCells = startDay + daysInMonth;
  const remainingCells = 42 - totalCells;
  for (let i = 1; i <= remainingCells && totalCells + i <= 42; i++) {
    html += `<div class="calendar-day other-month">${i}</div>`;
  }
  
  grid.innerHTML = html;
}

function prevMonth() {
  currentMonth--;
  if (currentMonth < 0) {
    currentMonth = 11;
    currentYear--;
  }
  renderCalendar();
}

function nextMonth() {
  currentMonth++;
  if (currentMonth > 11) {
    currentMonth = 0;
    currentYear++;
  }
  renderCalendar();
}

function goToToday() {
  const today = new Date();
  currentMonth = today.getMonth();
  currentYear = today.getFullYear();
  renderCalendar();
}

function selectDate(dateStr) {
  selectedDate = dateStr;
  renderCalendar();
  showDateReminders(dateStr);
}

function showDateReminders(dateStr) {
  const container = document.getElementById('selectedDateReminders');
  const dateReminders = reminders.filter(r => r.reminder_date === dateStr);
  
  if (!dateReminders.length) {
    container.innerHTML = `
      <div class="empty-state" style="grid-column:1/-1">
        <div class="empty-state-icon">📅</div>
        <div>لا توجد تذكيرات في ${formatDate(dateStr)}</div>
        <button class="btn btn-primary" style="margin-top:12px" onclick="openReminderModalWithDate('${dateStr}')">
          ➕ إضافة تذكير
        </button>
      </div>
    `;
    return;
  }

  container.innerHTML = dateReminders.map(r => `
    <div class="reminder-card ${r.status === 'completed' ? 'completed' : r.priority}">
      <div class="reminder-header">
        <div class="reminder-icon">${getCategoryIcon(r.category)}</div>
        <div class="reminder-content">
          <div class="reminder-title">${escapeHtml(r.title)}</div>
          <div class="reminder-meta">
            ${r.reminder_time ? `<div class="reminder-meta-item"><span>🕐</span><span>${r.reminder_time}</span></div>` : ''}
            <span class="badge badge-${r.priority}">${getPriorityLabel(r.priority)}</span>
          </div>
        </div>
      </div>
      <div class="reminder-actions">
        ${r.status === 'pending' ? `
          <button class="btn btn-sm btn-success" onclick="completeReminder(${r.id})">✓</button>
        ` : ''}
        <button class="btn btn-sm btn-primary" onclick="editReminder(${r.id})">✏️</button>
        <button class="btn btn-sm btn-danger" onclick="deleteReminder(${r.id})">🗑️</button>
      </div>
    </div>
  `).join('');
}

// ═══════════════════════════════════════════════════════════════
// 🪟 REMINDER MODAL
// ═══════════════════════════════════════════════════════════════
function openReminderModal() {
  document.getElementById('reminderModalTitle').textContent = 'إضافة تذكير جديد';
  document.getElementById('reminderForm').reset();
  document.getElementById('reminderId').value = '';
  document.getElementById('reminderDate').value = new Date().toISOString().split('T')[0];
  currentEditingId = null;
  document.getElementById('reminderModal').classList.add('active');
}

function openReminderModalWithDate(dateStr) {
  openReminderModal();
  document.getElementById('reminderDate').value = dateStr;
}

function closeReminderModal() {
  document.getElementById('reminderModal').classList.remove('active');
  currentEditingId = null;
}

function editReminder(id) {
  const reminder = reminders.find(r => r.id === id);
  if (!reminder) return;
  
  currentEditingId = id;
  document.getElementById('reminderModalTitle').textContent = 'تعديل التذكير';
  document.getElementById('reminderId').value = reminder.id;
  document.getElementById('reminderTitle').value = reminder.title || '';
  document.getElementById('reminderDescription').value = reminder.description || '';
  document.getElementById('reminderDate').value = reminder.reminder_date || '';
  document.getElementById('reminderTime').value = reminder.reminder_time || '';
  document.getElementById('reminderCategory').value = reminder.category || 'task';
  document.getElementById('reminderPriority').value = reminder.priority || 'medium';
  document.getElementById('reminderNotes').value = reminder.notes || '';
  
  document.getElementById('reminderModal').classList.add('active');
}

async function handleReminderSubmit(event) {
  event.preventDefault();
  
  const data = {
    title: document.getElementById('reminderTitle').value.trim(),
    description: document.getElementById('reminderDescription').value.trim(),
    reminder_date: document.getElementById('reminderDate').value,
    reminder_time: document.getElementById('reminderTime').value || null,
    category: document.getElementById('reminderCategory').value,
    priority: document.getElementById('reminderPriority').value,
    notes: document.getElementById('reminderNotes').value.trim()
  };
  
  if (!data.title || !data.reminder_date) {
    showToast('العنوان والتاريخ مطلوبان', 'error');
    return;
  }
  
  try {
    let endpoint;
    if (currentEditingId) {
      endpoint = 'elos-db://reminders-update';
      data.id = currentEditingId;
    } else {
      endpoint = 'elos-db://reminders-add';
    }
    
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
    
    if (!response.ok) throw new Error(await response.text());
    
    showToast(currentEditingId ? 'تم تحديث التذكير' : 'تم إضافة التذكير', 'success');
    closeReminderModal();
    await loadReminders();
    
    if (currentTab === 'calendar') renderCalendar();
  } catch (error) {
    Logger.error('Error saving reminder:', error);
    showToast('حدث خطأ أثناء الحفظ', 'error');
  }
}

// ═══════════════════════════════════════════════════════════════
// ✅ COMPLETE / REOPEN REMINDER
// ═══════════════════════════════════════════════════════════════
async function completeReminder(id) {
  try {
    const response = await fetch('elos-db://reminders-complete', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id })
    });
    
    if (!response.ok) throw new Error(await response.text());
    
    showToast('تم إنجاز التذكير ✅', 'success');
    await loadReminders();
    if (currentTab === 'calendar' && selectedDate) showDateReminders(selectedDate);
  } catch (error) {
    Logger.error('Error completing reminder:', error);
    showToast('حدث خطأ', 'error');
  }
}

async function reopenReminder(id) {
  try {
    const response = await fetch('elos-db://reminders-update', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, status: 'pending' })
    });
    
    if (!response.ok) throw new Error(await response.text());
    
    showToast('تم إعادة فتح التذكير', 'success');
    await loadReminders();
  } catch (error) {
    Logger.error('Error reopening reminder:', error);
    showToast('حدث خطأ', 'error');
  }
}

// ═══════════════════════════════════════════════════════════════
// 🗑️ DELETE REMINDER
// ═══════════════════════════════════════════════════════════════
async function deleteReminder(id) {
  const reminder = reminders.find(r => r.id === id);
  if (!reminder) return;
  
  // ✅ استخدام showConfirm بدلاً من confirm
  const confirmed = await showConfirm(`هل أنت متأكد من حذف "${reminder.title}"؟`, 'حذف', 'إلغاء', 'danger');
  if (!confirmed) return;
  
  try {
    const response = await fetch('elos-db://reminders-delete', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id })
    });
    
    if (!response.ok) throw new Error(await response.text());
    
    showToast('تم حذف التذكير', 'success');
    await loadReminders();
    if (currentTab === 'calendar' && selectedDate) showDateReminders(selectedDate);
  } catch (error) {
    Logger.error('Error deleting reminder:', error);
    showToast('حدث خطأ أثناء الحذف', 'error');
  }
}

// ═══════════════════════════════════════════════════════════════
// 🛠️ UTILITY FUNCTIONS
// ═══════════════════════════════════════════════════════════════
function getCategoryIcon(category) {
  const icons = {
    task: '📝', payment: '💰', meeting: '🤝',
    followup: '📞', maintenance: '🔧', other: '📌'
  };
  return icons[category] || '📌';
}

function getPriorityLabel(priority) {
  const labels = {
    urgent: '🔥 عاجل', high: '⚠️ عالية',
    medium: 'ℹ️ متوسطة', low: '✅ منخفضة'
  };
  return labels[priority] || 'متوسطة';
}

function formatDate(dateStr) {
  if (!dateStr) return '-';
  return new Date(dateStr).toLocaleDateString('ar-EG', {
    weekday: 'short', month: 'short', day: 'numeric'
  });
}

// escapeHtml() is now imported from utils.js (window.escapeHtml)

function showToast(message, type = 'success') {
  document.querySelectorAll('.toast').forEach(t => t.remove());
  
  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  toast.innerHTML = `<span>${type === 'success' ? '✓' : type === 'error' ? '✕' : '⚠'}</span> ${message}`;
  document.body.appendChild(toast);
  
  setTimeout(() => {
    toast.style.animation = 'toastIn 0.3s reverse';
    setTimeout(() => toast.remove(), 300);
  }, 3000);
}

// ═══════════════════════════════════════════════════════════════
// 📝 EVENT LISTENERS
// ═══════════════════════════════════════════════════════════════
document.getElementById('reminderModal')?.addEventListener('click', (e) => {
  if (e.target.id === 'reminderModal') closeReminderModal();
});

document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') closeReminderModal();
  if (e.ctrlKey && e.key === 'n') {
    e.preventDefault();
    openReminderModal();
  }
});

// ═══════════════════════════════════════════════════════════════
// 🚀 INITIALIZATION
// ═══════════════════════════════════════════════════════════════
(async function init() {
  Logger.log('⏰ ELOS Reminders System v2.0 - Initializing...');
  
  initHeaderClock();
  await loadReminders();
  
  // Check for overdue reminders
  const today = new Date().toISOString().split('T')[0];
  const overdueCount = reminders.filter(r => r.reminder_date < today && r.status === 'pending').length;
  if (overdueCount > 0) {
    showToast(`لديك ${overdueCount} تذكير متأخر!`, 'warning');
  }
  
  Logger.log('✅ ELOS Reminders System Ready!');
})();
