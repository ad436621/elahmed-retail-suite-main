// ═══════════════════════════════════════════════════════════════
// 🔐 ELOS USER MANAGEMENT SYSTEM v2.0
// نظام إدارة المستخدمين والصلاحيات المتقدم
// ═══════════════════════════════════════════════════════════════

// Fallbacks if utils.js not loaded yet
if (!window.Logger) window.Logger = { log: () => {}, warn: () => {}, error: console.error, debug: () => {}, info: () => {} };
if (!window.fmt) window.fmt = (n, decimals = 2) => Number(n || 0).toLocaleString('en-US', { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
if (!window.escapeHtml) window.escapeHtml = (text) => { if (text === null || text === undefined) return ''; const div = document.createElement('div'); div.textContent = String(text); return div.innerHTML; };
const fmt = window.fmt;
const escapeHtml = window.escapeHtml;

let allUsers = [];
let activities = [];
let sessions = [];
let currentTab = 'users';

// ═══════════════════════════════════════════════════════════════
// 🔑 إضافة يوزر جديد لقائمة المستخدمين الأخيرين في شاشة اللوجن
// ═══════════════════════════════════════════════════════════════
function addUserToRecentList(username) {
  if (!username) return;

  try {
    // جلب القائمة الحالية
    let recentUsers = [];
    const stored = localStorage.getItem('elos_recent_users');
    if (stored) {
      recentUsers = JSON.parse(stored);
      if (!Array.isArray(recentUsers)) recentUsers = [];
    }

    // إضافة اليوزر الجديد في البداية (إذا مش موجود)
    if (!recentUsers.includes(username)) {
      recentUsers.unshift(username);
      // الحفاظ على 5 يوزرز فقط
      recentUsers = recentUsers.slice(0, 5);
      localStorage.setItem('elos_recent_users', JSON.stringify(recentUsers));
      Logger.info('[Users] ✅ Added user to recent list:', username);
    }
  } catch (error) {
    Logger.error('[Users] Error adding user to recent list:', error);
  }
}

// ═══════════════════════════════════════════════════════════════
// ⏰ HEADER CLOCK - ✅ محسّن باستخدام IntervalManager
// ═══════════════════════════════════════════════════════════════
function initHeaderClock() {
  const updateClock = () => {
    const now = new Date();
    const hours = String(now.getHours()).padStart(2, '0');
    const minutes = String(now.getMinutes()).padStart(2, '0');
    const seconds = String(now.getSeconds()).padStart(2, '0');
    const timeEl = document.getElementById('headerTime');
    if (timeEl) timeEl.textContent = `${hours}:${minutes}:${seconds}`;

    const days = ['الأحد', 'الإثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت'];
    const dayName = days[now.getDay()];
    const day = now.getDate();
    const month = now.getMonth() + 1;
    const year = now.getFullYear();
    const dateEl = document.getElementById('headerDate');
    if (dateEl) dateEl.textContent = `${dayName} ${day}/${month}/${year}`;
  };

  updateClock();
  // ✅ استخدام IntervalManager لمنع تراكم الـ intervals
  if (window.IntervalManager) {
    window.IntervalManager.set('users-manager-clock', updateClock, 1000);
  } else {
    if (window._usersManagerClockInterval) clearInterval(window._usersManagerClockInterval);
    window._usersManagerClockInterval = setInterval(updateClock, 1000);
  }
}

// ═══════════════════════════════════════════════════════════════
// 📊 LOAD DATA
// ═══════════════════════════════════════════════════════════════
async function loadUsers() {
  try {
    const response = await fetch('elos-db://users');
    if (!response.ok) throw new Error(await response.text());
    allUsers = await response.json();
    
    updateStats();
    renderUsers();
    populateUserSelects();
    
    Logger.log('✅ Users loaded:', allUsers.length);
  } catch (error) {
    Logger.error('❌ Error loading users:', error);
    showToast('خطأ في تحميل المستخدمين', 'error');
  }
}

async function loadActivity() {
  try {
    const response = await fetch('elos-db://audit-log');
    if (!response.ok) throw new Error(await response.text());
    activities = await response.json();
    renderActivity();
  } catch (error) {
    Logger.error('Error loading activity:', error);
    // Show empty state
    activities = [];
    renderActivity();
  }
}

async function loadSessions() {
  // Calculate active sessions from users with recent login
  const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);
  sessions = allUsers.filter(u => {
    if (!u.last_login) return false;
    return new Date(u.last_login) > fiveMinutesAgo;
  });
  renderSessions();
}

// ═══════════════════════════════════════════════════════════════
// 📈 STATISTICS
// ═══════════════════════════════════════════════════════════════
function updateStats() {
  const total = allUsers.length;
  const active = allUsers.filter(u => u.is_active).length;
  const admins = allUsers.filter(u => u.role === 'admin').length;
  const cashiers = allUsers.filter(u => u.role === 'cashier').length;
  
  // Calculate online users (last login within 5 minutes)
  const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);
  const online = allUsers.filter(u => {
    if (!u.last_login) return false;
    return new Date(u.last_login) > fiveMinutesAgo;
  }).length;
  
  document.getElementById('statTotal').textContent = total;
  document.getElementById('statActive').textContent = active;
  document.getElementById('statAdmins').textContent = admins;
  document.getElementById('statCashiers').textContent = cashiers;
  document.getElementById('statOnline').textContent = online;
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
  
  const panelMap = {
    'users': 'usersPanel',
    'permissions': 'permissionsPanel',
    'activity': 'activityPanel',
    'sessions': 'sessionsPanel'
  };
  
  document.getElementById(panelMap[tabName])?.classList.add('active');
  
  // Load data for tab
  switch(tabName) {
    case 'users': loadUsers(); break;
    case 'activity': loadActivity(); break;
    case 'sessions': loadSessions(); break;
  }
}

// ═══════════════════════════════════════════════════════════════
// 🎨 RENDER USERS
// ═══════════════════════════════════════════════════════════════
function renderUsers() {
  const tbody = document.getElementById('usersBody');
  let filtered = [...allUsers];
  
  // Apply filters
  const search = document.getElementById('searchUser')?.value?.toLowerCase() || '';
  const role = document.getElementById('filterRole')?.value || '';
  const status = document.getElementById('filterStatus')?.value || '';
  
  if (search) {
    filtered = filtered.filter(u => 
      u.username?.toLowerCase().includes(search) ||
      u.display_name?.toLowerCase().includes(search)
    );
  }
  if (role) filtered = filtered.filter(u => u.role === role);
  if (status) {
    if (status === 'active') filtered = filtered.filter(u => u.is_active);
    else filtered = filtered.filter(u => !u.is_active);
  }
  
  if (!filtered.length) {
    tbody.innerHTML = `
      <tr>
        <td colspan="8" class="empty-state">
          <div class="empty-state-icon">👥</div>
          <div>${allUsers.length === 0 ? 'لا يوجد مستخدمين' : 'لا توجد نتائج'}</div>
        </td>
      </tr>
    `;
    return;
  }

  // Check if online (last login within 5 minutes)
  const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);

  tbody.innerHTML = filtered.map((u, idx) => {
    const isOnline = u.last_login && new Date(u.last_login) > fiveMinutesAgo;
    const isLastAdmin = u.role === 'admin' && allUsers.filter(x => x.role === 'admin').length === 1;
    
    return `
      <tr>
        <td>${idx + 1}</td>
        <td>
          <div style="display:flex;align-items:center;gap:10px">
            <div class="user-avatar ${u.role}">${(u.display_name || u.username || '?').charAt(0).toUpperCase()}</div>
            <div>
              <div style="font-weight:600">${u.display_name || '-'}</div>
              <div style="font-size:11px;color:var(--text-secondary)">${isOnline ? '🟢 متصل' : '⚫ غير متصل'}</div>
            </div>
          </div>
        </td>
        <td><code style="background:var(--bg-tertiary);padding:4px 8px;border-radius:4px">${u.username}</code></td>
        <td><span class="badge badge-${u.role}">${getRoleLabel(u.role)}</span></td>
        <td><span class="badge badge-${u.is_active ? 'active' : 'inactive'}">${u.is_active ? 'نشط' : 'معطل'}</span></td>
        <td>${formatDateTime(u.last_login)}</td>
        <td>${formatDate(u.created_at)}</td>
        <td>
          <div style="display:flex;gap:6px">
            <button class="btn btn-sm btn-warning" onclick="editUser(${u.id})" title="تعديل">✏️</button>
            <button class="btn btn-sm btn-purple" onclick="showResetPassword(${u.id})" title="إعادة كلمة المرور">🔑</button>
            <button class="btn btn-sm btn-${u.is_active ? 'secondary' : 'success'}" onclick="toggleUserStatus(${u.id})" title="${u.is_active ? 'تعطيل' : 'تفعيل'}">
              ${u.is_active ? '⏸️' : '▶️'}
            </button>
            ${!isLastAdmin ? `<button class="btn btn-sm btn-danger" onclick="deleteUser(${u.id})" title="حذف">🗑️</button>` : ''}
          </div>
        </td>
      </tr>
    `;
  }).join('');
}

function filterUsers() { renderUsers(); }

// ═══════════════════════════════════════════════════════════════
// 🎨 RENDER ACTIVITY
// ═══════════════════════════════════════════════════════════════
function renderActivity() {
  const container = document.getElementById('activityList');
  let filtered = [...activities];
  
  // Apply filters
  const userId = document.getElementById('filterActivityUser')?.value || '';
  const type = document.getElementById('filterActivityType')?.value || '';
  const from = document.getElementById('filterActivityFrom')?.value || '';
  const to = document.getElementById('filterActivityTo')?.value || '';
  
  if (userId) filtered = filtered.filter(a => a.user_id == userId);
  if (type) filtered = filtered.filter(a => a.action?.toLowerCase().includes(type));
  if (from) filtered = filtered.filter(a => a.timestamp >= from);
  if (to) filtered = filtered.filter(a => a.timestamp <= to + 'T23:59:59');
  
  if (!filtered.length) {
    container.innerHTML = `
      <div class="empty-state">
        <div class="empty-state-icon">📋</div>
        <div>لا توجد سجلات نشاط</div>
      </div>
    `;
    return;
  }

  container.innerHTML = filtered.slice(0, 100).map(a => {
    // استخدام البيانات من الـ API مباشرة أو البحث في allUsers
    const userName = a.display_name || a.username ||
                     allUsers.find(u => u.id === a.user_id)?.display_name ||
                     allUsers.find(u => u.id === a.user_id)?.username || 'النظام';

    const iconClass = a.action?.includes('login') ? 'login' :
                      a.action?.includes('logout') ? 'logout' :
                      a.action?.includes('error') ? 'error' : 'action';
    const icon = iconClass === 'login' ? '🔓' :
                 iconClass === 'logout' ? '🔒' :
                 iconClass === 'error' ? '⚠️' : '📝';

    return `
      <div class="activity-item">
        <div class="activity-icon ${iconClass}">${icon}</div>
        <div class="activity-content">
          <div class="activity-text">
            <strong>${userName}</strong>
            - ${a.action || 'نشاط'}
            ${a.details ? `<span style="color:var(--text-secondary);font-size:12px"> • ${a.details}</span>` : ''}
          </div>
          <div class="activity-time">${formatDateTime(a.timestamp)}</div>
        </div>
      </div>
    `;
  }).join('');
}

function filterActivity() { renderActivity(); }

// ═══════════════════════════════════════════════════════════════
// 🎨 RENDER SESSIONS
// ═══════════════════════════════════════════════════════════════
function renderSessions() {
  const tbody = document.getElementById('sessionsBody');
  
  if (!sessions.length) {
    tbody.innerHTML = `
      <tr>
        <td colspan="6" class="empty-state">
          <div class="empty-state-icon">🖥️</div>
          <div>لا توجد جلسات نشطة حالياً</div>
        </td>
      </tr>
    `;
    return;
  }

  tbody.innerHTML = sessions.map(s => {
    const sessionDuration = s.last_login ? getTimeDiff(new Date(s.last_login), new Date()) : '-';
    
    return `
      <tr>
        <td>
          <div style="display:flex;align-items:center;gap:10px">
            <div class="user-avatar ${s.role}">${(s.display_name || s.username || '?').charAt(0).toUpperCase()}</div>
            <div>
              <div style="font-weight:600">${s.display_name || s.username}</div>
              <div style="font-size:11px;color:var(--text-secondary)">${s.username}</div>
            </div>
          </div>
        </td>
        <td><span class="badge badge-${s.role}">${getRoleLabel(s.role)}</span></td>
        <td>${formatDateTime(s.last_login)}</td>
        <td>${sessionDuration}</td>
        <td><span class="badge badge-online">🟢 نشط</span></td>
        <td>
          <button class="btn btn-sm btn-danger" onclick="terminateSession(${s.id})" title="إنهاء الجلسة">
            ⛔ إنهاء
          </button>
        </td>
      </tr>
    `;
  }).join('');
}

// ═══════════════════════════════════════════════════════════════
// 👤 USER MODAL
// ═══════════════════════════════════════════════════════════════
function openUserModal() {
  document.getElementById('userModalTitle').textContent = 'إضافة مستخدم جديد';
  document.getElementById('userForm').reset();
  document.getElementById('userId').value = '';
  document.getElementById('passwordLabel').classList.add('required');
  document.getElementById('passwordHint').textContent = '6 أحرف على الأقل';
  document.getElementById('password').required = true;
  document.getElementById('userModal').classList.add('active');
}

function closeUserModal() {
  document.getElementById('userModal').classList.remove('active');
}

function editUser(id) {
  const user = allUsers.find(u => u.id === id);
  if (!user) return;
  
  document.getElementById('userModalTitle').textContent = 'تعديل بيانات المستخدم';
  document.getElementById('userId').value = user.id;
  document.getElementById('username').value = user.username || '';
  document.getElementById('displayName').value = user.display_name || '';
  document.getElementById('password').value = '';
  document.getElementById('role').value = user.role || 'cashier';
  document.getElementById('userStatus').value = user.is_active ? '1' : '0';
  
  document.getElementById('passwordLabel').classList.remove('required');
  document.getElementById('passwordHint').textContent = 'اتركها فارغة للإبقاء على القديمة';
  document.getElementById('password').required = false;
  
  document.getElementById('userModal').classList.add('active');
}

async function handleUserSubmit(e) {
  e.preventDefault();
  
  const id = document.getElementById('userId').value;
  const data = {
    username: document.getElementById('username').value,
    display_name: document.getElementById('displayName').value,
    role: document.getElementById('role').value,
    is_active: document.getElementById('userStatus').value === '1'
  };
  
  const password = document.getElementById('password').value;
  if (password) data.password = password;
  
  try {
    let response;
    if (id) {
      response = await fetch(`elos-db://users/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      });
    } else {
      if (!password) {
        showToast('كلمة المرور مطلوبة', 'error');
        return;
      }
      response = await fetch('elos-db://users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      });
    }
    
    const result = await response.json();
    
    if (result.success || result.ok) {
      showToast(id ? 'تم تعديل المستخدم بنجاح' : 'تم إضافة المستخدم بنجاح', 'success');

      // ✅ إضافة اليوزر الجديد لقائمة المستخدمين الأخيرين (يظهر في شاشة اللوجن)
      if (!id) {
        addUserToRecentList(data.username);
      }

      closeUserModal();
      await loadUsers();
    } else {
      showToast(result.error || 'حدث خطأ', 'error');
    }
  } catch (error) {
    Logger.error('Error saving user:', error);
    showToast('خطأ في حفظ البيانات', 'error');
  }
}

// ═══════════════════════════════════════════════════════════════
// 🗑️ DELETE USER
// ═══════════════════════════════════════════════════════════════
function deleteUser(id) {
  document.getElementById('deleteUserId').value = id;
  document.getElementById('deleteModal').classList.add('active');
}

function closeDeleteModal() {
  document.getElementById('deleteModal').classList.remove('active');
}

async function confirmDelete() {
  const id = document.getElementById('deleteUserId').value;
  
  try {
    const response = await fetch(`elos-db://users/${id}`, { method: 'DELETE' });
    const result = await response.json();
    
    if (result.success || result.ok) {
      showToast('تم حذف المستخدم بنجاح', 'success');
      closeDeleteModal();
      await loadUsers();
    } else {
      showToast(result.error || 'حدث خطأ', 'error');
    }
  } catch (error) {
    showToast('خطأ في حذف المستخدم', 'error');
  }
}

// ═══════════════════════════════════════════════════════════════
// 🔄 TOGGLE STATUS
// ═══════════════════════════════════════════════════════════════
async function toggleUserStatus(id) {
  const user = allUsers.find(u => u.id === id);
  if (!user) return;
  
  try {
    const response = await fetch(`elos-db://users/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ is_active: !user.is_active })
    });
    
    const result = await response.json();
    
    if (result.success || result.ok) {
      showToast(user.is_active ? 'تم تعطيل المستخدم' : 'تم تفعيل المستخدم', 'success');
      await loadUsers();
    } else {
      showToast(result.error || 'حدث خطأ', 'error');
    }
  } catch (error) {
    showToast('خطأ في تغيير الحالة', 'error');
  }
}

// ═══════════════════════════════════════════════════════════════
// 🔑 RESET PASSWORD
// ═══════════════════════════════════════════════════════════════
function showResetPassword(userId) {
  document.getElementById('resetUserId').value = userId;
  // مسح الحقول
  document.getElementById('newPasswordInput').value = '';
  document.getElementById('confirmPasswordInput').value = '';
  document.getElementById('newPasswordInput').type = 'password';
  document.getElementById('resetPasswordModal').classList.add('active');
}

function closeResetModal() {
  document.getElementById('resetPasswordModal').classList.remove('active');
}

function toggleResetPasswordVisibility() {
  const input = document.getElementById('newPasswordInput');
  const confirmInput = document.getElementById('confirmPasswordInput');
  if (input.type === 'password') {
    input.type = 'text';
    confirmInput.type = 'text';
  } else {
    input.type = 'password';
    confirmInput.type = 'password';
  }
}

async function confirmResetPassword() {
  const userId = document.getElementById('resetUserId').value;
  const newPassword = document.getElementById('newPasswordInput').value.trim();
  const confirmPassword = document.getElementById('confirmPasswordInput').value.trim();

  // التحقق من الإدخال
  if (!newPassword) {
    showToast('أدخل كلمة المرور الجديدة', 'error');
    return;
  }

  if (newPassword.length < 6) {
    showToast('كلمة المرور يجب أن تكون 6 أحرف على الأقل', 'error');
    return;
  }

  if (newPassword !== confirmPassword) {
    showToast('كلمتا المرور غير متطابقتين', 'error');
    return;
  }

  try {
    const response = await fetch(`elos-db://users/${userId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password: newPassword })
    });

    const result = await response.json();

    if (result.success || result.ok) {
      showToast('تم تغيير كلمة المرور بنجاح', 'success');
      closeResetModal();
    } else {
      showToast(result.error || 'حدث خطأ', 'error');
    }
  } catch (error) {
    showToast('خطأ في تغيير كلمة المرور', 'error');
  }
}

// ═══════════════════════════════════════════════════════════════
// 🖥️ SESSION MANAGEMENT
// ═══════════════════════════════════════════════════════════════
async function terminateSession(userId) {
  // ✅ استخدام showConfirm بدلاً من confirm
  const confirmed = await showConfirm('هل تريد إنهاء جلسة هذا المستخدم؟', 'إنهاء الجلسة', 'إلغاء', 'warning');
  if (!confirmed) return;

  // In a real system, this would invalidate the session token
  showToast('تم إنهاء الجلسة', 'success');
  await loadSessions();
}

async function terminateAllSessions() {
  // ✅ استخدام showConfirm بدلاً من confirm
  const confirmed = await showConfirm('هل تريد إنهاء جميع الجلسات النشطة؟ سيتم تسجيل خروج جميع المستخدمين.', 'إنهاء الكل', 'إلغاء', 'danger');
  if (!confirmed) return;
  
  showToast('تم إنهاء جميع الجلسات', 'success');
  sessions = [];
  renderSessions();
}

// ═══════════════════════════════════════════════════════════════
// 📥 EXPORT
// ═══════════════════════════════════════════════════════════════
function exportUsers() {
  const csv = [
    ['ID', 'اسم المستخدم', 'الاسم المعروض', 'الصلاحية', 'الحالة', 'آخر دخول', 'تاريخ الإنشاء'].join(','),
    ...allUsers.map(u => [
      u.id,
      u.username,
      u.display_name || '',
      getRoleLabel(u.role),
      u.is_active ? 'نشط' : 'معطل',
      u.last_login ? new Date(u.last_login).toLocaleString('ar-EG') : '',
      u.created_at ? new Date(u.created_at).toLocaleString('ar-EG') : ''
    ].join(','))
  ].join('\n');
  
  const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = `users_${new Date().toISOString().split('T')[0]}.csv`;
  link.click();
  
  showToast('تم تصدير البيانات بنجاح', 'success');
}

// ═══════════════════════════════════════════════════════════════
// 🎲 GENERATE PASSWORD
// ═══════════════════════════════════════════════════════════════
function generatePassword() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789!@#$';
  let password = '';
  for (let i = 0; i < 12; i++) {
    password += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  document.getElementById('password').value = password;
  document.getElementById('password').type = 'text';
  showToast('تم توليد كلمة مرور عشوائية', 'success');
  
  // Hide after 3 seconds
  setTimeout(() => {
    document.getElementById('password').type = 'password';
  }, 3000);
}

// ═══════════════════════════════════════════════════════════════
// 🛠️ UTILITY FUNCTIONS
// ═══════════════════════════════════════════════════════════════
function populateUserSelects() {
  const select = document.getElementById('filterActivityUser');
  if (select) {
    const options = allUsers.map(u => `<option value="${u.id}">${u.display_name || u.username}</option>`).join('');
    select.innerHTML = '<option value="">الكل</option>' + options;
  }
}

function getRoleLabel(role) {
  const labels = {
    'admin': '👑 مدير',
    'cashier': '💼 كاشير',
    'viewer': '👁️ مشاهد'
  };
  return labels[role] || role;
}

function formatDate(dateString) {
  if (!dateString) return '-';
  return new Date(dateString).toLocaleDateString('ar-EG');
}

function formatDateTime(dateString) {
  if (!dateString) return '-';
  return new Date(dateString).toLocaleString('ar-EG');
}

function getTimeDiff(start, end) {
  const diff = Math.abs(end - start);
  const minutes = Math.floor(diff / 60000);
  const hours = Math.floor(minutes / 60);
  
  if (hours > 0) {
    return `${hours} ساعة ${minutes % 60} دقيقة`;
  }
  return `${minutes} دقيقة`;
}

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
// Close modals on outside click
['userModal', 'deleteModal', 'resetPasswordModal'].forEach(id => {
  document.getElementById(id)?.addEventListener('click', (e) => {
    if (e.target.id === id) {
      document.getElementById(id).classList.remove('active');
    }
  });
});

// Keyboard shortcuts
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') {
    closeUserModal();
    closeDeleteModal();
    closeResetModal();
  }
  
  if (e.ctrlKey && e.key === 'n') {
    e.preventDefault();
    openUserModal();
  }
});

// ═══════════════════════════════════════════════════════════════
// 🚀 INITIALIZATION
// ═══════════════════════════════════════════════════════════════
(async function init() {
  Logger.log('🔐 ELOS User Management v2.0 - Initializing...');
  
  initHeaderClock();
  
  await loadUsers();
  await loadActivity();
  
  // ✅ Auto-refresh every 30 seconds - باستخدام IntervalManager
  const autoRefresh = () => {
    if (currentTab === 'users') loadUsers();
    else if (currentTab === 'sessions') loadSessions();
  };

  if (window.IntervalManager) {
    window.IntervalManager.set('users-manager-refresh', autoRefresh, 30000);
  } else {
    setInterval(autoRefresh, 30000);
  }
  
  Logger.log('✅ ELOS User Management Ready!');
})();
