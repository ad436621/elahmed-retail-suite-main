// ═══════════════════════════════════════════════════════════════
// 👥 ELOS EMPLOYEES MANAGEMENT SYSTEM v2.0
// نظام شامل لإدارة الموظفين والرواتب والسلف والإجازات
// ═══════════════════════════════════════════════════════════════

// Fallbacks if utils.js not loaded yet
if (!window.Logger) window.Logger = { log: () => {}, warn: () => {}, error: console.error, debug: () => {}, info: () => {} };
if (!window.fmt) window.fmt = (n, decimals = 2) => Number(n || 0).toLocaleString('en-US', { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
if (!window.escapeHtml) window.escapeHtml = (text) => { if (text === null || text === undefined) return ''; const div = document.createElement('div'); div.textContent = String(text); return div.innerHTML; };
const fmt = window.fmt;
const escapeHtml = window.escapeHtml;

let employees = [];
let salaries = [];
let advances = [];
let vacations = [];
let attendance = [];
let currentTab = 'employees';

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
    window.IntervalManager.set('employees-clock', updateClock, 1000);
  } else {
    if (window._employeesClockInterval) clearInterval(window._employeesClockInterval);
    window._employeesClockInterval = setInterval(updateClock, 1000);
  }
}

// ═══════════════════════════════════════════════════════════════
// 📊 LOAD DATA
// ═══════════════════════════════════════════════════════════════
async function loadEmployees() {
  try {
    const res = await fetch('elos-db://employees');
    if (!res.ok) throw new Error(await res.text());
    employees = await res.json();
    renderEmployees();
    populateEmployeeSelects();
    updateDepartmentsList();
  } catch (error) {
    Logger.error('Error loading employees:', error);
  }
}

async function loadSalaries() {
  try {
    const res = await fetch('elos-db://employee-salaries');
    if (!res.ok) throw new Error(await res.text());
    salaries = await res.json();
    renderSalaries();
  } catch (error) {
    Logger.error('Error loading salaries:', error);
  }
}

async function loadAdvances() {
  try {
    const res = await fetch('elos-db://employee-advances');
    if (!res.ok) throw new Error(await res.text());
    advances = await res.json();
    renderAdvances();
    updateAdvancesSummary();
  } catch (error) {
    Logger.error('Error loading advances:', error);
  }
}

async function loadVacations() {
  try {
    const res = await fetch('elos-db://employee-vacations');
    if (!res.ok) throw new Error(await res.text());
    vacations = await res.json();
    renderVacations();
  } catch (error) {
    Logger.error('Error loading vacations:', error);
  }
}

async function loadAttendance() {
  try {
    const res = await fetch('elos-db://employee-attendance?include_sessions=true');
    if (!res.ok) throw new Error(await res.text());
    attendance = await res.json();
    renderAttendance();
  } catch (error) {
    Logger.error('Error loading attendance:', error);
  }
}

async function loadStats() {
  try {
    const res = await fetch('elos-db://employees-stats');
    if (!res.ok) throw new Error(await res.text());
    const stats = await res.json();
    
    document.getElementById('statEmployees').textContent = stats.totalEmployees || 0;
    document.getElementById('statSalaries').textContent = formatNumber(stats.totalSalaries || 0);
    document.getElementById('statAdvances').textContent = stats.activeAdvances || 0;
    document.getElementById('statVacations').textContent = stats.pendingVacations || 0;
    document.getElementById('statAttendance').textContent = stats.todayAttendance || 0;
  } catch (error) {
    Logger.error('Error loading stats:', error);
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
  
  const panelMap = {
    'employees': 'employeesPanel',
    'salaries': 'salariesPanel',
    'advances': 'advancesPanel',
    'vacations': 'vacationsPanel',
    'attendance': 'attendancePanel',
    'reports': 'reportsPanel'
  };
  
  document.getElementById(panelMap[tabName])?.classList.add('active');
  
  // Load data for tab
  switch(tabName) {
    case 'employees': loadEmployees(); break;
    case 'salaries': loadSalaries(); break;
    case 'advances': loadAdvances(); break;
    case 'vacations': loadVacations(); break;
    case 'attendance': loadAttendance(); break;
  }
}

// ═══════════════════════════════════════════════════════════════
// 🎨 RENDER EMPLOYEES
// ═══════════════════════════════════════════════════════════════
function renderEmployees() {
  const tbody = document.getElementById('employeesBody');
  let filtered = [...employees];
  
  // Apply filters
  const search = document.getElementById('searchEmployee')?.value?.toLowerCase() || '';
  const dept = document.getElementById('filterDepartment')?.value || '';
  const status = document.getElementById('filterStatus')?.value || '';
  
  if (search) filtered = filtered.filter(e => e.name?.toLowerCase().includes(search));
  if (dept) filtered = filtered.filter(e => e.department === dept);
  if (status) filtered = filtered.filter(e => e.status === status);
  
  if (!filtered.length) {
    tbody.innerHTML = `
      <tr>
        <td colspan="10" class="empty-state">
          <div class="empty-state-icon">👥</div>
          <div>لا يوجد موظفين</div>
        </td>
      </tr>
    `;
    return;
  }

  tbody.innerHTML = filtered.map((e, idx) => `
    <tr>
      <td>${idx + 1}</td>
      <td>
        <strong style="cursor:pointer;color:var(--accent)" onclick="viewEmployeeProfile(${e.id})">${e.name}</strong>
      </td>
      <td>${e.job_title || '-'}</td>
      <td>${e.department || '-'}</td>
      <td>${e.phone || '-'}</td>
      <td>${formatDate(e.hire_date)}</td>
      <td>
        <strong>${formatNumber(e.salary || 0)}</strong> 
        ${e.salary_type === 'hourly' ? `/ساعة (${formatNumber(e.hourly_rate || 0)} ج.م)` : 'ج.م/شهر'}
      </td>
      <td>${e.vacation_balance || 0} يوم</td>
      <td><span class="badge badge-${e.status || 'active'}">${getStatusLabel(e.status)}</span></td>
      <td>
        <div style="display:flex;gap:6px">
          <button class="btn btn-sm btn-primary" onclick="viewEmployeeProfile(${e.id})" title="عرض">👁️</button>
          <button class="btn btn-sm btn-warning" onclick="editEmployee(${e.id})" title="تعديل">✏️</button>
          <button class="btn btn-sm btn-danger" onclick="deleteEmployee(${e.id})" title="حذف">🗑️</button>
        </div>
      </td>
    </tr>
  `).join('');
}

function filterEmployees() { renderEmployees(); }

// ═══════════════════════════════════════════════════════════════
// 🎨 RENDER SALARIES
// ═══════════════════════════════════════════════════════════════
function renderSalaries() {
  const tbody = document.getElementById('salariesBody');
  let filtered = [...salaries];
  
  const empId = document.getElementById('filterSalaryEmployee')?.value || '';
  const month = document.getElementById('filterSalaryMonth')?.value || '';
  const year = document.getElementById('filterSalaryYear')?.value || '';
  
  if (empId) filtered = filtered.filter(s => s.employee_id == empId);
  if (month) filtered = filtered.filter(s => s.month === month);
  if (year) filtered = filtered.filter(s => s.year == year);
  
  if (!filtered.length) {
    tbody.innerHTML = `
      <tr>
        <td colspan="11" class="empty-state">
          <div class="empty-state-icon">💰</div>
          <div>لا توجد رواتب</div>
        </td>
      </tr>
    `;
    return;
  }

  tbody.innerHTML = filtered.map((s, idx) => {
    const emp = employees.find(e => e.id === s.employee_id);
    const isHourly = emp?.salary_type === 'hourly';
    const hoursInfo = s.total_hours ? `<br><small style="color:var(--text-secondary);font-size:10px">(${s.total_hours} ساعة)</small>` : '';
    const salaryTypeBadge = isHourly ? '<span class="badge badge-approved" style="font-size:9px;margin-right:4px">بالساعة</span>' : '';
    
    return `
      <tr>
        <td>${idx + 1}</td>
        <td>
          <strong>${emp?.name || 'غير معروف'}</strong>
          ${salaryTypeBadge}
        </td>
        <td>${getMonthName(s.month)}/${s.year}</td>
        <td>
          ${formatNumber(s.base_salary || 0)}
          ${hoursInfo}
        </td>
        <td style="color:var(--success)">${formatNumber(s.allowances || 0)}</td>
        <td style="color:var(--success)">${formatNumber(s.bonus || 0)}</td>
        <td style="color:var(--danger)">${formatNumber(s.deductions || 0)}</td>
        <td style="color:var(--danger)">${formatNumber(s.advance_deduction || 0)}</td>
        <td><strong style="color:var(--accent)">${formatNumber(s.net_salary || 0)}</strong></td>
        <td><span class="badge badge-${s.status || 'pending'}">${getSalaryStatus(s.status)}</span></td>
        <td>
          <div style="display:flex;gap:6px">
            ${s.status === 'pending' ? `<button class="btn btn-sm btn-success" onclick="paySalary(${s.id})" title="صرف">💵</button>` : ''}
            <button class="btn btn-sm btn-danger" onclick="deleteSalary(${s.id})" title="حذف">🗑️</button>
          </div>
        </td>
      </tr>
    `;
  }).join('');
}

function filterSalaries() { renderSalaries(); }

// ═══════════════════════════════════════════════════════════════
// 🎨 RENDER ADVANCES
// ═══════════════════════════════════════════════════════════════
function renderAdvances() {
  const tbody = document.getElementById('advancesBody');
  let filtered = [...advances];
  
  const empId = document.getElementById('filterAdvanceEmployee')?.value || '';
  const status = document.getElementById('filterAdvanceStatus')?.value || '';
  
  if (empId) filtered = filtered.filter(a => a.employee_id == empId);
  if (status) filtered = filtered.filter(a => a.status === status);
  
  if (!filtered.length) {
    tbody.innerHTML = `
      <tr>
        <td colspan="10" class="empty-state">
          <div class="empty-state-icon">💳</div>
          <div>لا توجد سلف</div>
        </td>
      </tr>
    `;
    return;
  }

  tbody.innerHTML = filtered.map((a, idx) => {
    const emp = employees.find(e => e.id === a.employee_id);
    const paid = a.paid_amount || 0;
    const remaining = a.amount - paid;
    
    return `
      <tr>
        <td>${idx + 1}</td>
        <td><strong>${emp?.name || 'غير معروف'}</strong></td>
        <td>${formatNumber(a.amount)}</td>
        <td>${a.installments_count || 1}</td>
        <td>${formatNumber(a.installment_amount || a.amount)}</td>
        <td style="color:var(--success)">${formatNumber(paid)}</td>
        <td style="color:var(--danger)">${formatNumber(remaining)}</td>
        <td>${formatDate(a.created_at)}</td>
        <td><span class="badge badge-${a.status}">${getAdvanceStatus(a.status)}</span></td>
        <td>
          <div style="display:flex;gap:6px">
            ${a.status === 'pending' ? `
              <button class="btn btn-sm btn-success" onclick="approveAdvance(${a.id})" title="موافقة">✅</button>
              <button class="btn btn-sm btn-danger" onclick="rejectAdvance(${a.id})" title="رفض">❌</button>
            ` : ''}
            ${a.status === 'active' ? `
              <button class="btn btn-sm btn-primary" onclick="payAdvanceInstallment(${a.id})" title="سداد قسط">💵</button>
            ` : ''}
            <button class="btn btn-sm btn-danger" onclick="deleteAdvance(${a.id})" title="حذف">🗑️</button>
          </div>
        </td>
      </tr>
    `;
  }).join('');
}

function filterAdvances() { renderAdvances(); }

function updateAdvancesSummary() {
  const active = advances.filter(a => a.status === 'active' || a.status === 'approved');
  const totalAmount = active.reduce((sum, a) => sum + (a.amount || 0), 0);
  const totalPaid = active.reduce((sum, a) => sum + (a.paid_amount || 0), 0);
  const totalRemaining = totalAmount - totalPaid;
  
  document.getElementById('totalActiveAdvances').textContent = active.length;
  document.getElementById('totalAdvancesAmount').textContent = formatNumber(totalAmount);
  document.getElementById('totalPaidAdvances').textContent = formatNumber(totalPaid);
  document.getElementById('totalRemainingAdvances').textContent = formatNumber(totalRemaining);
}

// ═══════════════════════════════════════════════════════════════
// 🎨 RENDER VACATIONS
// ═══════════════════════════════════════════════════════════════
function renderVacations() {
  const tbody = document.getElementById('vacationsBody');
  let filtered = [...vacations];
  
  const empId = document.getElementById('filterVacationEmployee')?.value || '';
  const type = document.getElementById('filterVacationType')?.value || '';
  const status = document.getElementById('filterVacationStatus')?.value || '';
  
  if (empId) filtered = filtered.filter(v => v.employee_id == empId);
  if (type) filtered = filtered.filter(v => v.vacation_type === type);
  if (status) filtered = filtered.filter(v => v.status === status);
  
  if (!filtered.length) {
    tbody.innerHTML = `
      <tr>
        <td colspan="9" class="empty-state">
          <div class="empty-state-icon">🏖️</div>
          <div>لا توجد طلبات إجازة</div>
        </td>
      </tr>
    `;
    return;
  }

  tbody.innerHTML = filtered.map((v, idx) => {
    const emp = employees.find(e => e.id === v.employee_id);
    return `
      <tr>
        <td>${idx + 1}</td>
        <td><strong>${emp?.name || 'غير معروف'}</strong></td>
        <td><span class="badge badge-${v.vacation_type === 'annual' ? 'approved' : v.vacation_type === 'sick' ? 'sick' : 'pending'}">${getVacationType(v.vacation_type)}</span></td>
        <td>${formatDate(v.from_date)}</td>
        <td>${formatDate(v.to_date)}</td>
        <td>${v.days_count || 0} يوم</td>
        <td>${v.reason || '-'}</td>
        <td><span class="badge badge-${v.status}">${getVacationStatus(v.status)}</span></td>
        <td>
          <div style="display:flex;gap:6px">
            ${v.status === 'pending' ? `
              <button class="btn btn-sm btn-success" onclick="approveVacation(${v.id})" title="موافقة">✅</button>
              <button class="btn btn-sm btn-danger" onclick="rejectVacation(${v.id})" title="رفض">❌</button>
            ` : ''}
            <button class="btn btn-sm btn-danger" onclick="deleteVacation(${v.id})" title="حذف">🗑️</button>
          </div>
        </td>
      </tr>
    `;
  }).join('');
}

function filterVacations() { renderVacations(); }

// ═══════════════════════════════════════════════════════════════
// 🎨 RENDER ATTENDANCE
// ═══════════════════════════════════════════════════════════════
function renderAttendance() {
  const tbody = document.getElementById('attendanceBody');
  let filtered = [...attendance];
  
  const empId = document.getElementById('filterAttendanceEmployee')?.value || '';
  const fromDate = document.getElementById('filterAttendanceFrom')?.value || '';
  const toDate = document.getElementById('filterAttendanceTo')?.value || '';
  const status = document.getElementById('filterAttendanceStatus')?.value || '';
  
  if (empId) filtered = filtered.filter(a => a.employee_id == empId);
  if (fromDate) filtered = filtered.filter(a => (a.attendance_date || a.date) >= fromDate);
  if (toDate) filtered = filtered.filter(a => (a.attendance_date || a.date) <= toDate);
  if (status) filtered = filtered.filter(a => a.status === status);
  
  if (!filtered.length) {
    tbody.innerHTML = `
      <tr>
        <td colspan="9" class="empty-state">
          <div class="empty-state-icon">📋</div>
          <div>لا توجد سجلات</div>
        </td>
      </tr>
    `;
    return;
  }

  tbody.innerHTML = filtered.map((a, idx) => {
    const emp = employees.find(e => e.id === a.employee_id);
    
    // حساب الساعات بناءً على الفترات المتعددة إذا كانت موجودة
    let hours = '-';
    let timeDisplay = `${a.check_in || '-'} - ${a.check_out || '-'}`;
    
    if (a.sessions && Array.isArray(a.sessions) && a.sessions.length > 0) {
      // استخدام الفترات المتعددة
      hours = calculateTotalWorkHours(a.sessions);
      const sessionsList = a.sessions.map(s => {
        if (s.check_in && s.check_out) {
          return `${s.check_in} - ${s.check_out}`;
        } else if (s.check_in) {
          return `${s.check_in} - ...`;
        }
        return '';
      }).filter(Boolean).join('<br>');
      timeDisplay = sessionsList || timeDisplay;
    } else {
      // استخدام الطريقة القديمة
      hours = calculateWorkHours(a.check_in, a.check_out);
    }
    
    const hasMultipleSessions = a.sessions && a.sessions.length > 1;
    
    return `
      <tr>
        <td>${idx + 1}</td>
        <td><strong>${emp?.name || 'غير معروف'}</strong></td>
        <td>${formatDate(a.attendance_date || a.date)}</td>
        <td style="font-size:11px;line-height:1.4">${timeDisplay}${hasMultipleSessions ? '<br><small style="color:var(--accent)">(' + a.sessions.length + ' فترة)</small>' : ''}</td>
        <td><strong style="color:var(--accent)">${hours}</strong></td>
        <td><span class="badge badge-${a.status}">${getAttendanceStatus(a.status)}</span></td>
        <td>${a.notes || '-'}</td>
        <td>
          <div style="display:flex;gap:6px">
            <button class="btn btn-sm btn-primary" onclick="editAttendance(${a.id})" title="تعديل">✏️</button>
            <button class="btn btn-sm btn-danger" onclick="deleteAttendance(${a.id})" title="حذف">🗑️</button>
          </div>
        </td>
      </tr>
    `;
  }).join('');
}

function filterAttendance() { renderAttendance(); }

// ═══════════════════════════════════════════════════════════════
// 👤 EMPLOYEE MODAL
// ═══════════════════════════════════════════════════════════════
function openEmployeeModal() {
  document.getElementById('employeeModalTitle').textContent = 'إضافة موظف جديد';
  document.getElementById('employeeForm').reset();
  document.getElementById('employeeId').value = '';
  document.getElementById('employeeHireDate').value = new Date().toISOString().split('T')[0];
  document.getElementById('employeeSalaryType').value = 'monthly';
  toggleSalaryFields(); // تحديث عرض الحقول
  document.getElementById('employeeModal').classList.add('active');
}

function closeEmployeeModal() {
  document.getElementById('employeeModal').classList.remove('active');
}

function editEmployee(id) {
  const emp = employees.find(e => e.id === id);
  if (!emp) return;
  
  document.getElementById('employeeModalTitle').textContent = 'تعديل بيانات الموظف';
  document.getElementById('employeeId').value = emp.id;
  document.getElementById('employeeName').value = emp.name || '';
  document.getElementById('employeeNationalId').value = emp.national_id || '';
  document.getElementById('employeePhone').value = emp.phone || '';
  document.getElementById('employeeEmail').value = emp.email || '';
  document.getElementById('employeeJobTitle').value = emp.job_title || '';
  document.getElementById('employeeDepartment').value = emp.department || '';
  document.getElementById('employeeSalaryType').value = emp.salary_type || 'monthly';
  document.getElementById('employeeSalary').value = emp.salary || 0;
  document.getElementById('employeeHourlyRate').value = emp.hourly_rate || 0;
  document.getElementById('employeeAllowances').value = emp.allowances || 0;
  document.getElementById('employeeVacationBalance').value = emp.vacation_balance || 21;
  document.getElementById('employeeHireDate').value = emp.hire_date || '';
  document.getElementById('employeeStatus').value = emp.status || 'active';
  
  toggleSalaryFields(); // تحديث عرض الحقول
  document.getElementById('employeeAddress').value = emp.address || '';
  document.getElementById('employeeNotes').value = emp.notes || '';
  
  document.getElementById('employeeModal').classList.add('active');
}

async function handleEmployeeSubmit(e) {
  e.preventDefault();
  
  const id = document.getElementById('employeeId').value;
  const salaryType = document.getElementById('employeeSalaryType').value;
  
  const data = {
    name: document.getElementById('employeeName').value,
    national_id: document.getElementById('employeeNationalId').value,
    phone: document.getElementById('employeePhone').value,
    email: document.getElementById('employeeEmail').value,
    job_title: document.getElementById('employeeJobTitle').value,
    department: document.getElementById('employeeDepartment').value,
    salary_type: salaryType,
    salary: parseFloat(document.getElementById('employeeSalary').value) || 0,
    hourly_rate: parseFloat(document.getElementById('employeeHourlyRate').value) || 0,
    allowances: parseFloat(document.getElementById('employeeAllowances').value) || 0,
    vacation_balance: parseInt(document.getElementById('employeeVacationBalance').value) || 21,
    hire_date: document.getElementById('employeeHireDate').value,
    status: document.getElementById('employeeStatus').value,
    address: document.getElementById('employeeAddress').value,
    notes: document.getElementById('employeeNotes').value
  };
  
  try {
    const endpoint = id ? `elos-db://employee-update/${id}` : 'elos-db://employee-add';
    const res = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
    
    if (!res.ok) throw new Error(await res.text());
    
    showToast(id ? 'تم تحديث بيانات الموظف' : 'تم إضافة الموظف بنجاح', 'success');
    closeEmployeeModal();
    await loadEmployees();
    await loadStats();
  } catch (error) {
    Logger.error('Error saving employee:', error);
    showToast('حدث خطأ أثناء الحفظ', 'error');
  }
}

async function deleteEmployee(id) {
  // ✅ استخدام showConfirm بدلاً من confirm
  const confirmed = await showConfirm('هل أنت متأكد من حذف هذا الموظف؟', 'حذف', 'إلغاء', 'danger');
  if (!confirmed) return;
  
  try {
    const res = await fetch(`elos-db://employee-delete/${id}`, { method: 'POST' });
    if (!res.ok) throw new Error(await res.text());
    
    showToast('تم حذف الموظف', 'success');
    await loadEmployees();
    await loadStats();
  } catch (error) {
    Logger.error('Error deleting employee:', error);
    showToast('حدث خطأ أثناء الحذف', 'error');
  }
}

// ═══════════════════════════════════════════════════════════════
// 👤 EMPLOYEE PROFILE
// ═══════════════════════════════════════════════════════════════
async function viewEmployeeProfile(id) {
  const emp = employees.find(e => e.id === id);
  if (!emp) return;
  
  // Get employee's data
  const empSalaries = salaries.filter(s => s.employee_id === id);
  const empAdvances = advances.filter(a => a.employee_id === id);
  const empVacations = vacations.filter(v => v.employee_id === id);
  
  const totalSalaries = empSalaries.reduce((sum, s) => sum + (s.net_salary || 0), 0);
  const activeAdvances = empAdvances.filter(a => a.status === 'active' || a.status === 'approved');
  const totalAdvances = activeAdvances.reduce((sum, a) => sum + (a.amount - (a.paid_amount || 0)), 0);
  
  const content = `
    <div class="employee-profile">
      <div class="profile-sidebar">
        <div class="profile-avatar">${emp.name?.charAt(0) || '👤'}</div>
        <div class="profile-name">${emp.name}</div>
        <div class="profile-job">${emp.job_title || '-'} • ${emp.department || '-'}</div>
        <span class="badge badge-${emp.status}">${getStatusLabel(emp.status)}</span>
        
        <div class="profile-stats">
          <div class="profile-stat">
            <div class="profile-stat-value">${formatNumber(emp.salary || 0)}</div>
            <div class="profile-stat-label">الراتب</div>
          </div>
          <div class="profile-stat">
            <div class="profile-stat-value">${emp.vacation_balance || 0}</div>
            <div class="profile-stat-label">رصيد الإجازات</div>
          </div>
          <div class="profile-stat">
            <div class="profile-stat-value">${formatNumber(totalAdvances)}</div>
            <div class="profile-stat-label">سلف متبقية</div>
          </div>
          <div class="profile-stat">
            <div class="profile-stat-value">${empSalaries.length}</div>
            <div class="profile-stat-label">رواتب مصروفة</div>
          </div>
        </div>
        
        <div style="margin-top:20px;text-align:right;font-size:12px;color:var(--text-secondary)">
          <p>📞 ${emp.phone || '-'}</p>
          <p>📧 ${emp.email || '-'}</p>
          <p>🏠 ${emp.address || '-'}</p>
          <p>📅 تاريخ التعيين: ${formatDate(emp.hire_date)}</p>
        </div>
      </div>
      
      <div class="profile-content">
        <div class="table-wrapper">
          <h4 style="padding:16px;margin:0;border-bottom:1px solid var(--border)">📜 آخر الرواتب</h4>
          <table>
            <thead>
              <tr>
                <th>الشهر</th>
                <th>الأساسي</th>
                <th>الإضافات</th>
                <th>الخصومات</th>
                <th>الصافي</th>
              </tr>
            </thead>
            <tbody>
              ${empSalaries.slice(0, 5).map(s => `
                <tr>
                  <td>${getMonthName(s.month)}/${s.year}</td>
                  <td>${formatNumber(s.base_salary || 0)}</td>
                  <td style="color:var(--success)">${formatNumber((s.allowances || 0) + (s.bonus || 0))}</td>
                  <td style="color:var(--danger)">${formatNumber((s.deductions || 0) + (s.advance_deduction || 0))}</td>
                  <td><strong>${formatNumber(s.net_salary || 0)}</strong></td>
                </tr>
              `).join('') || '<tr><td colspan="5" style="text-align:center;padding:20px">لا توجد رواتب</td></tr>'}
            </tbody>
          </table>
        </div>
        
        <div class="table-wrapper" style="margin-top:16px">
          <h4 style="padding:16px;margin:0;border-bottom:1px solid var(--border)">💳 السلف النشطة</h4>
          <table>
            <thead>
              <tr>
                <th>المبلغ</th>
                <th>الأقساط</th>
                <th>المسدد</th>
                <th>المتبقي</th>
                <th>الحالة</th>
              </tr>
            </thead>
            <tbody>
              ${activeAdvances.map(a => `
                <tr>
                  <td>${formatNumber(a.amount)}</td>
                  <td>${a.installments_count || 1}</td>
                  <td style="color:var(--success)">${formatNumber(a.paid_amount || 0)}</td>
                  <td style="color:var(--danger)">${formatNumber(a.amount - (a.paid_amount || 0))}</td>
                  <td><span class="badge badge-${a.status}">${getAdvanceStatus(a.status)}</span></td>
                </tr>
              `).join('') || '<tr><td colspan="5" style="text-align:center;padding:20px">لا توجد سلف نشطة</td></tr>'}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  `;
  
  document.getElementById('profileContent').innerHTML = content;
  document.getElementById('profileModal').classList.add('active');
}

function closeProfileModal() {
  document.getElementById('profileModal').classList.remove('active');
}

// ═══════════════════════════════════════════════════════════════
// 💰 SALARY MODAL
// ═══════════════════════════════════════════════════════════════
function openSalaryModal() {
  document.getElementById('salaryModalTitle').textContent = 'إضافة راتب';
  document.getElementById('salaryForm').reset();
  document.getElementById('salaryId').value = '';
  document.getElementById('salaryHoursInfo').style.display = 'none';
  
  const now = new Date();
  document.getElementById('salaryMonth').value = String(now.getMonth() + 1).padStart(2, '0');
  document.getElementById('salaryYear').value = now.getFullYear();
  
  calculateSalary();
  document.getElementById('salaryModal').classList.add('active');
}

// دالة حساب الراتب تلقائياً لجميع الموظفين
async function openCalculateSalaryModal() {
  const confirmed = await showConfirm(
    'هل تريد حساب الرواتب تلقائياً لجميع الموظفين النشطين لهذا الشهر؟\n\n' +
    '• الموظفين بالراتب الشهري: سيتم استخدام الراتب الأساسي\n' +
    '• الموظفين بالراتب بالساعة: سيتم الحساب من الحضور الفعلي\n' +
    '• سيتم خصم السلف النشطة تلقائياً\n' +
    '• سيتم تخطي الموظفين الذين لديهم راتب مسجل بالفعل',
    'حساب',
    'إلغاء',
    'warning'
  );
  
  if (!confirmed) return;
  
  const now = new Date();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const year = now.getFullYear();
  
  showToast('جاري حساب الرواتب... يرجى الانتظار', 'warning');
  
  try {
    // جلب جميع الموظفين النشطين
    const activeEmployees = employees.filter(e => e.status === 'active');
    
    if (activeEmployees.length === 0) {
      showToast('لا يوجد موظفين نشطين', 'error');
      return;
    }
    
    let calculatedCount = 0;
    let skippedCount = 0;
    let errorCount = 0;
    
    // تحديث قائمة السلف والرواتب
    await loadAdvances();
    await loadSalaries();
    
    for (const emp of activeEmployees) {
      try {
        // التحقق من وجود راتب لهذا الشهر
        const existingSalary = salaries.find(s => 
          s.employee_id === emp.id && 
          s.month === month && 
          s.year === year
        );
        
        if (existingSalary) {
          skippedCount++;
          continue; // تخطي إذا كان الراتب موجوداً
        }
        
        let baseSalary = 0;
        let salaryNotes = '';
        
        // حساب الراتب حسب النوع
        if (emp.salary_type === 'hourly' && emp.hourly_rate > 0) {
          // حساب من الحضور للموظفين بالراتب بالساعة
          try {
            const res = await fetch(`elos-db://employee-attendance?employee_id=${emp.id}&month=${year}-${month}&include_sessions=true`);
            if (res.ok) {
              const monthAttendance = await res.json();
              
              // حساب الساعات
              let totalMinutes = 0;
              let daysCount = 0;
              
              monthAttendance.forEach(att => {
                if (att.sessions && Array.isArray(att.sessions) && att.sessions.length > 0) {
                  att.sessions.forEach(session => {
                    if (session.check_in && session.check_out) {
                      const [inH, inM] = session.check_in.split(':').map(Number);
                      const [outH, outM] = session.check_out.split(':').map(Number);
                      const inMinutes = inH * 60 + inM;
                      const outMinutes = outH * 60 + outM;
                      const diff = outMinutes - inMinutes;
                      if (diff > 0) totalMinutes += diff;
                    }
                  });
                  if (att.sessions.length > 0) daysCount++;
                } else if (att.check_in && att.check_out) {
                  const [inH, inM] = att.check_in.split(':').map(Number);
                  const [outH, outM] = att.check_out.split(':').map(Number);
                  const inMinutes = inH * 60 + inM;
                  const outMinutes = outH * 60 + outM;
                  const diff = outMinutes - inMinutes;
                  if (diff > 0) {
                    totalMinutes += diff;
                    daysCount++;
                  }
                }
              });
              
              const totalHours = totalMinutes / 60;
              baseSalary = totalHours * emp.hourly_rate;
              salaryNotes = `حساب تلقائي - ${totalHours.toFixed(2)} ساعة × ${emp.hourly_rate} ج.م (${daysCount} يوم)`;
            }
          } catch (error) {
            Logger.error(`Error loading attendance for ${emp.id}:`, error);
          }
        } else {
          // الراتب الشهري العادي
          baseSalary = emp.salary || 0;
          salaryNotes = 'حساب تلقائي - راتب شهري';
        }
        
        if (baseSalary <= 0) {
          // تخطي الموظفين بدون راتب أو بدون حضور
          skippedCount++;
          continue;
        }
        
        // البحث عن سلف نشطة لهذا الموظف
        const activeAdvance = advances.find(a => 
          a.employee_id === emp.id && 
          (a.status === 'active' || a.status === 'approved')
        );
        
        const advanceDeduction = activeAdvance ? (activeAdvance.installment_amount || 0) : 0;
        const allowances = emp.allowances || 0;
        
        // حساب الراتب الصافي
        const netSalary = baseSalary + allowances - advanceDeduction;
        
        // إضافة الراتب
        const salaryData = {
          employee_id: emp.id,
          month: month,
          year: year,
          base_salary: baseSalary,
          allowances: allowances,
          bonus: 0,
          overtime: 0,
          absence_deduction: 0,
          deductions: 0,
          advance_deduction: advanceDeduction,
          insurance: 0,
          net_salary: Math.max(0, netSalary), // التأكد من عدم وجود قيمة سالبة
          notes: salaryNotes + (advanceDeduction > 0 ? ` - خصم سلفة: ${formatNumber(advanceDeduction)} ج.م` : ''),
          status: 'pending'
        };
        
        const addRes = await fetch('elos-db://employee-salary-add', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(salaryData)
        });
        
        if (addRes.ok) {
          calculatedCount++;
        } else {
          const errorText = await addRes.text();
          Logger.error(`Error adding salary for ${emp.id}:`, errorText);
          errorCount++;
        }
      } catch (error) {
        Logger.error(`Error calculating salary for employee ${emp.id}:`, error);
        errorCount++;
      }
    }
    
    await loadSalaries();
    await loadStats();
    
    let message = `تم حساب ${calculatedCount} راتب`;
    if (skippedCount > 0) message += `، تم تخطي ${skippedCount}`;
    if (errorCount > 0) message += `، ${errorCount} خطأ`;
    
    showToast(message, calculatedCount > 0 ? 'success' : 'error');
  } catch (error) {
    Logger.error('Error in calculate salary modal:', error);
    showToast('حدث خطأ أثناء حساب الرواتب', 'error');
  }
}

function closeSalaryModal() {
  document.getElementById('salaryModal').classList.remove('active');
}

async function loadEmployeeSalaryData() {
  const empId = document.getElementById('salaryEmployeeId').value;
  if (!empId) {
    document.getElementById('salaryHoursInfo').style.display = 'none';
    return;
  }
  
  const emp = employees.find(e => e.id == empId);
  if (!emp) {
    document.getElementById('salaryHoursInfo').style.display = 'none';
    return;
  }
  
  const month = document.getElementById('salaryMonth').value;
  const year = document.getElementById('salaryYear').value;
  
  // إخفاء/إظهار معلومات الساعات
  const hoursInfoDiv = document.getElementById('salaryHoursInfo');
  
  // إذا كان الراتب بالساعة، حساب الراتب بناءً على الحضور
  if (emp.salary_type === 'hourly' && emp.hourly_rate > 0) {
    hoursInfoDiv.style.display = 'block';
    hoursInfoDiv.innerHTML = '<div style="padding:12px;background:var(--bg-tertiary);border-radius:8px;margin-bottom:12px"><div style="color:var(--text-secondary);font-size:11px">جاري حساب الساعات من الحضور...</div></div>';
    
    try {
      // جلب الحضور للشهر المحدد
      const res = await fetch(`elos-db://employee-attendance?employee_id=${empId}&month=${year}-${month}&include_sessions=true`);
      if (res.ok) {
        const monthAttendance = await res.json();
        
        // حساب إجمالي الساعات
        let totalMinutes = 0;
        let daysCount = 0;
        
        monthAttendance.forEach(att => {
          if (att.sessions && Array.isArray(att.sessions) && att.sessions.length > 0) {
            att.sessions.forEach(session => {
              if (session.check_in && session.check_out) {
                const [inH, inM] = session.check_in.split(':').map(Number);
                const [outH, outM] = session.check_out.split(':').map(Number);
                const inMinutes = inH * 60 + inM;
                const outMinutes = outH * 60 + outM;
                const diff = outMinutes - inMinutes;
                if (diff > 0) totalMinutes += diff;
              }
            });
            if (att.sessions.length > 0) daysCount++;
          } else if (att.check_in && att.check_out) {
            // الطريقة القديمة
            const [inH, inM] = att.check_in.split(':').map(Number);
            const [outH, outM] = att.check_out.split(':').map(Number);
            const inMinutes = inH * 60 + inM;
            const outMinutes = outH * 60 + outM;
            const diff = outMinutes - inMinutes;
            if (diff > 0) {
              totalMinutes += diff;
              daysCount++;
            }
          }
        });
        
        // حساب الراتب بناءً على الساعات
        const totalHours = totalMinutes / 60;
        const calculatedSalary = totalHours * emp.hourly_rate;
        
        document.getElementById('salaryBaseSalary').value = calculatedSalary.toFixed(2);
        document.getElementById('salaryOvertime').value = 0;
        
        // عرض معلومات الساعات
        const hoursDisplay = totalHours.toFixed(2);
        const hoursText = hoursDisplay.replace('.', 'س ') + 'د';
        hoursInfoDiv.innerHTML = `
          <div style="padding:12px;background:var(--bg-tertiary);border-radius:8px;margin-bottom:12px;border:1px solid var(--accent)">
            <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px">
              <span style="color:var(--text-secondary);font-size:11px">📊 ملخص الحضور</span>
              <span style="color:var(--accent);font-weight:bold">${hoursText}</span>
            </div>
            <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:8px;font-size:10px;color:var(--text-secondary)">
              <div>عدد الأيام: <strong style="color:var(--text-primary)">${daysCount}</strong></div>
              <div>إجمالي الساعات: <strong style="color:var(--text-primary)">${hoursDisplay}</strong></div>
              <div>معدل الساعة: <strong style="color:var(--text-primary)">${formatNumber(emp.hourly_rate)} ج.م</strong></div>
            </div>
            <div style="margin-top:8px;padding-top:8px;border-top:1px solid var(--border);font-size:11px">
              <span style="color:var(--text-secondary)">الراتب المحسوب:</span>
              <strong style="color:var(--success);font-size:14px;margin-right:8px">${formatNumber(calculatedSalary)} ج.م</strong>
            </div>
          </div>
        `;
      } else {
        hoursInfoDiv.innerHTML = '<div style="padding:12px;background:var(--bg-tertiary);border-radius:8px;margin-bottom:12px;color:var(--warning)">⚠️ لم يتم العثور على بيانات حضور لهذا الشهر</div>';
        document.getElementById('salaryBaseSalary').value = emp.salary || 0;
      }
    } catch (error) {
      Logger.error('Error loading attendance for salary calculation:', error);
      hoursInfoDiv.innerHTML = '<div style="padding:12px;background:var(--bg-tertiary);border-radius:8px;margin-bottom:12px;color:var(--danger)">❌ خطأ في حساب الساعات</div>';
      document.getElementById('salaryBaseSalary').value = emp.salary || 0;
    }
  } else {
    // الراتب الشهري العادي
    hoursInfoDiv.style.display = 'none';
    document.getElementById('salaryBaseSalary').value = emp.salary || 0;
  }
  
  document.getElementById('salaryAllowances').value = emp.allowances || 0;
  
  // Check for active advances
  const activeAdvance = advances.find(a => a.employee_id == empId && a.status === 'active');
  if (activeAdvance) {
    document.getElementById('salaryAdvanceDeduction').value = activeAdvance.installment_amount || 0;
  } else {
    document.getElementById('salaryAdvanceDeduction').value = 0;
  }
  
  calculateSalary();
}

function calculateSalary() {
  const base = parseFloat(document.getElementById('salaryBaseSalary').value) || 0;
  const allowances = parseFloat(document.getElementById('salaryAllowances').value) || 0;
  const bonus = parseFloat(document.getElementById('salaryBonus').value) || 0;
  const overtime = parseFloat(document.getElementById('salaryOvertime').value) || 0;
  
  const absenceDeduction = parseFloat(document.getElementById('salaryAbsenceDeduction').value) || 0;
  const deductions = parseFloat(document.getElementById('salaryDeductions').value) || 0;
  const advanceDeduction = parseFloat(document.getElementById('salaryAdvanceDeduction').value) || 0;
  const insurance = parseFloat(document.getElementById('salaryInsurance').value) || 0;
  
  const totalEarnings = base + allowances + bonus + overtime;
  const totalDeductions = absenceDeduction + deductions + advanceDeduction + insurance;
  const net = totalEarnings - totalDeductions;
  
  document.getElementById('totalEarnings').textContent = formatNumber(totalEarnings) + ' ج.م';
  document.getElementById('totalDeductions').textContent = formatNumber(totalDeductions) + ' ج.م';
  document.getElementById('netSalaryDisplay').textContent = formatNumber(net) + ' ج.م';
  document.getElementById('salaryNetSalary').value = net;
}

async function handleSalarySubmit(e) {
  e.preventDefault();
  
  const data = {
    employee_id: parseInt(document.getElementById('salaryEmployeeId').value),
    month: document.getElementById('salaryMonth').value,
    year: parseInt(document.getElementById('salaryYear').value),
    base_salary: parseFloat(document.getElementById('salaryBaseSalary').value) || 0,
    allowances: parseFloat(document.getElementById('salaryAllowances').value) || 0,
    bonus: parseFloat(document.getElementById('salaryBonus').value) || 0,
    overtime: parseFloat(document.getElementById('salaryOvertime').value) || 0,
    absence_deduction: parseFloat(document.getElementById('salaryAbsenceDeduction').value) || 0,
    deductions: parseFloat(document.getElementById('salaryDeductions').value) || 0,
    advance_deduction: parseFloat(document.getElementById('salaryAdvanceDeduction').value) || 0,
    insurance: parseFloat(document.getElementById('salaryInsurance').value) || 0,
    net_salary: parseFloat(document.getElementById('salaryNetSalary').value) || 0,
    notes: document.getElementById('salaryNotes').value,
    status: 'pending'
  };
  
  try {
    const res = await fetch('elos-db://employee-salary-add', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
    
    if (!res.ok) throw new Error(await res.text());
    
    showToast('تم إضافة الراتب بنجاح', 'success');
    closeSalaryModal();
    await loadSalaries();
    await loadStats();
  } catch (error) {
    Logger.error('Error saving salary:', error);
    showToast('حدث خطأ أثناء الحفظ', 'error');
  }
}

async function paySalary(id) {
  // ✅ استخدام showConfirm بدلاً من confirm
  const confirmed = await showConfirm('هل تريد تأكيد صرف هذا الراتب؟', 'صرف', 'إلغاء', 'warning');
  if (!confirmed) return;
  
  try {
    const res = await fetch(`elos-db://employee-salary-pay/${id}`, { method: 'POST' });
    if (!res.ok) throw new Error(await res.text());
    
    showToast('تم صرف الراتب بنجاح', 'success');
    await loadSalaries();
  } catch (error) {
    Logger.error('Error paying salary:', error);
    showToast('حدث خطأ', 'error');
  }
}

async function deleteSalary(id) {
  // ✅ استخدام showConfirm بدلاً من confirm
  const confirmed = await showConfirm('هل أنت متأكد من حذف هذا الراتب؟', 'حذف', 'إلغاء', 'danger');
  if (!confirmed) return;
  
  try {
    const res = await fetch(`elos-db://employee-salary-delete/${id}`, { method: 'POST' });
    if (!res.ok) throw new Error(await res.text());
    
    showToast('تم حذف الراتب', 'success');
    await loadSalaries();
    await loadStats();
  } catch (error) {
    Logger.error('Error deleting salary:', error);
    showToast('حدث خطأ أثناء الحذف', 'error');
  }
}

// ═══════════════════════════════════════════════════════════════
// 💳 ADVANCE MODAL
// ═══════════════════════════════════════════════════════════════
function openAdvanceModal() {
  document.getElementById('advanceModalTitle').textContent = 'طلب سلفة جديدة';
  document.getElementById('advanceForm').reset();
  document.getElementById('advanceId').value = '';
  document.getElementById('advanceStartDate').value = new Date().toISOString().split('T')[0];
  document.getElementById('advanceModal').classList.add('active');
}

function closeAdvanceModal() {
  document.getElementById('advanceModal').classList.remove('active');
}

function calculateInstallment() {
  const amount = parseFloat(document.getElementById('advanceAmount').value) || 0;
  const count = parseInt(document.getElementById('advanceInstallments').value) || 1;
  const installment = count > 0 ? amount / count : amount;
  document.getElementById('advanceInstallmentAmount').value = installment.toFixed(2);
}

async function handleAdvanceSubmit(e) {
  e.preventDefault();
  
  const amount = parseFloat(document.getElementById('advanceAmount').value) || 0;
  const count = parseInt(document.getElementById('advanceInstallments').value) || 1;
  
  const data = {
    employee_id: parseInt(document.getElementById('advanceEmployeeId').value),
    amount: amount,
    installments_count: count,
    installment_amount: amount / count,
    start_date: document.getElementById('advanceStartDate').value,
    reason: document.getElementById('advanceReason').value,
    status: 'pending'
  };
  
  try {
    const res = await fetch('elos-db://employee-advance-add', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
    
    if (!res.ok) throw new Error(await res.text());
    
    showToast('تم تقديم طلب السلفة', 'success');
    closeAdvanceModal();
    await loadAdvances();
    await loadStats();
  } catch (error) {
    Logger.error('Error saving advance:', error);
    showToast('حدث خطأ أثناء الحفظ', 'error');
  }
}

async function approveAdvance(id) {
  try {
    const res = await fetch(`elos-db://employee-advance-approve/${id}`, { method: 'POST' });
    if (!res.ok) throw new Error(await res.text());
    
    showToast('تمت الموافقة على السلفة', 'success');
    await loadAdvances();
    await loadStats();
  } catch (error) {
    Logger.error('Error approving advance:', error);
    showToast('حدث خطأ', 'error');
  }
}

async function rejectAdvance(id) {
  // ✅ استخدام showConfirm بدلاً من confirm
  const confirmed = await showConfirm('هل تريد رفض هذه السلفة؟', 'رفض', 'إلغاء', 'warning');
  if (!confirmed) return;
  
  try {
    const res = await fetch(`elos-db://employee-advance-reject/${id}`, { method: 'POST' });
    if (!res.ok) throw new Error(await res.text());
    
    showToast('تم رفض السلفة', 'success');
    await loadAdvances();
    await loadStats();
  } catch (error) {
    Logger.error('Error rejecting advance:', error);
    showToast('حدث خطأ', 'error');
  }
}

async function payAdvanceInstallment(id) {
  const advance = advances.find(a => a.id === id);
  if (!advance) return;

  const installmentAmount = advance.installment_amount || 0;
  // ✅ استخدام showConfirm بدلاً من confirm
  const confirmed = await showConfirm(`هل تريد سداد قسط بقيمة ${formatNumber(installmentAmount)} ج.م؟`, 'سداد', 'إلغاء', 'warning');
  if (!confirmed) return;
  
  try {
    const res = await fetch(`elos-db://employee-advance-pay/${id}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ amount: installmentAmount })
    });
    
    if (!res.ok) throw new Error(await res.text());
    
    showToast('تم سداد القسط بنجاح', 'success');
    await loadAdvances();
  } catch (error) {
    Logger.error('Error paying installment:', error);
    showToast('حدث خطأ', 'error');
  }
}

async function deleteAdvance(id) {
  // ✅ استخدام showConfirm بدلاً من confirm
  const confirmed = await showConfirm('هل أنت متأكد من حذف هذه السلفة؟', 'حذف', 'إلغاء', 'danger');
  if (!confirmed) return;
  
  try {
    const res = await fetch(`elos-db://employee-advance-delete/${id}`, { method: 'POST' });
    if (!res.ok) throw new Error(await res.text());
    
    showToast('تم حذف السلفة', 'success');
    await loadAdvances();
    await loadStats();
  } catch (error) {
    Logger.error('Error deleting advance:', error);
    showToast('حدث خطأ أثناء الحذف', 'error');
  }
}

// ═══════════════════════════════════════════════════════════════
// 🏖️ VACATION MODAL
// ═══════════════════════════════════════════════════════════════
function openVacationModal() {
  document.getElementById('vacationModalTitle').textContent = 'طلب إجازة جديدة';
  document.getElementById('vacationForm').reset();
  document.getElementById('vacationId').value = '';
  document.getElementById('vacationBalance').value = '--';
  document.getElementById('vacationModal').classList.add('active');
}

function closeVacationModal() {
  document.getElementById('vacationModal').classList.remove('active');
}

function showVacationBalance() {
  const empId = document.getElementById('vacationEmployeeId').value;
  if (!empId) {
    document.getElementById('vacationBalance').value = '--';
    return;
  }
  
  const emp = employees.find(e => e.id == empId);
  document.getElementById('vacationBalance').value = (emp?.vacation_balance || 0) + ' يوم';
}

function calculateVacationDays() {
  const from = document.getElementById('vacationFromDate').value;
  const to = document.getElementById('vacationToDate').value;
  
  if (!from || !to) {
    document.getElementById('vacationDays').value = 0;
    return;
  }
  
  const fromDate = new Date(from);
  const toDate = new Date(to);
  const diffTime = Math.abs(toDate - fromDate);
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;
  
  document.getElementById('vacationDays').value = diffDays;
}

async function handleVacationSubmit(e) {
  e.preventDefault();
  
  const data = {
    employee_id: parseInt(document.getElementById('vacationEmployeeId').value),
    vacation_type: document.getElementById('vacationType').value,
    from_date: document.getElementById('vacationFromDate').value,
    to_date: document.getElementById('vacationToDate').value,
    days_count: parseInt(document.getElementById('vacationDays').value) || 0,
    reason: document.getElementById('vacationReason').value,
    status: 'pending'
  };
  
  try {
    const res = await fetch('elos-db://employee-vacation-add', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
    
    if (!res.ok) throw new Error(await res.text());
    
    showToast('تم تقديم طلب الإجازة', 'success');
    closeVacationModal();
    await loadVacations();
    await loadStats();
  } catch (error) {
    Logger.error('Error saving vacation:', error);
    showToast('حدث خطأ أثناء الحفظ', 'error');
  }
}

async function approveVacation(id) {
  try {
    const res = await fetch(`elos-db://employee-vacation-approve/${id}`, { method: 'POST' });
    if (!res.ok) throw new Error(await res.text());
    
    showToast('تمت الموافقة على الإجازة', 'success');
    await loadVacations();
    await loadEmployees(); // Refresh vacation balance
    await loadStats();
  } catch (error) {
    Logger.error('Error approving vacation:', error);
    showToast('حدث خطأ', 'error');
  }
}

async function rejectVacation(id) {
  // ✅ استخدام showConfirm بدلاً من confirm
  const confirmed = await showConfirm('هل تريد رفض هذه الإجازة؟', 'رفض', 'إلغاء', 'warning');
  if (!confirmed) return;
  
  try {
    const res = await fetch(`elos-db://employee-vacation-reject/${id}`, { method: 'POST' });
    if (!res.ok) throw new Error(await res.text());
    
    showToast('تم رفض الإجازة', 'success');
    await loadVacations();
    await loadStats();
  } catch (error) {
    Logger.error('Error rejecting vacation:', error);
    showToast('حدث خطأ', 'error');
  }
}

async function deleteVacation(id) {
  // ✅ استخدام showConfirm بدلاً من confirm
  const confirmed = await showConfirm('هل أنت متأكد من حذف هذه الإجازة؟', 'حذف', 'إلغاء', 'danger');
  if (!confirmed) return;
  
  try {
    const res = await fetch(`elos-db://employee-vacation-delete/${id}`, { method: 'POST' });
    if (!res.ok) throw new Error(await res.text());
    
    showToast('تم حذف الإجازة', 'success');
    await loadVacations();
    await loadStats();
  } catch (error) {
    Logger.error('Error deleting vacation:', error);
    showToast('حدث خطأ أثناء الحذف', 'error');
  }
}

// ═══════════════════════════════════════════════════════════════
// 📋 ATTENDANCE MODAL
// ═══════════════════════════════════════════════════════════════
function openAttendanceModal() {
  document.getElementById('attendanceForm').reset();
  document.getElementById('attendanceId').value = '';
  document.getElementById('attendanceDate').value = new Date().toISOString().split('T')[0];
  
  // إعادة تعيين الفترات
  const container = document.getElementById('attendanceSessionsContainer');
  container.innerHTML = `
    <div class="session-row" style="display:flex;gap:8px;margin-bottom:8px;align-items:flex-end">
      <div style="flex:1">
        <label class="form-label" style="font-size:11px">وقت الحضور</label>
        <input type="time" class="form-input session-checkin" style="font-size:12px">
      </div>
      <div style="flex:1">
        <label class="form-label" style="font-size:11px">وقت الانصراف</label>
        <input type="time" class="form-input session-checkout" style="font-size:12px">
      </div>
      <button type="button" class="btn btn-sm btn-danger" onclick="removeSession(this)" style="height:38px">🗑️</button>
    </div>
  `;
  
  document.getElementById('attendanceModal').classList.add('active');
}

function addSession() {
  const container = document.getElementById('attendanceSessionsContainer');
  const sessionRow = document.createElement('div');
  sessionRow.className = 'session-row';
  sessionRow.style.cssText = 'display:flex;gap:8px;margin-bottom:8px;align-items:flex-end';
  sessionRow.innerHTML = `
    <div style="flex:1">
      <label class="form-label" style="font-size:11px">وقت الحضور</label>
      <input type="time" class="form-input session-checkin" style="font-size:12px">
    </div>
    <div style="flex:1">
      <label class="form-label" style="font-size:11px">وقت الانصراف</label>
      <input type="time" class="form-input session-checkout" style="font-size:12px">
    </div>
    <button type="button" class="btn btn-sm btn-danger" onclick="removeSession(this)" style="height:38px">🗑️</button>
  `;
  container.appendChild(sessionRow);
}

function removeSession(btn) {
  const container = document.getElementById('attendanceSessionsContainer');
  const sessions = container.querySelectorAll('.session-row');
  if (sessions.length > 1) {
    btn.closest('.session-row').remove();
  } else {
    showToast('يجب وجود فترة واحدة على الأقل', 'warning');
  }
}

function toggleSalaryFields() {
  const salaryType = document.getElementById('employeeSalaryType').value;
  const monthlyGroup = document.getElementById('monthlySalaryGroup');
  const hourlyGroup = document.getElementById('hourlyRateGroup');
  const salaryInput = document.getElementById('employeeSalary');
  const hourlyInput = document.getElementById('employeeHourlyRate');
  
  if (salaryType === 'hourly') {
    monthlyGroup.style.display = 'none';
    hourlyGroup.style.display = 'block';
    salaryInput.removeAttribute('required');
    hourlyInput.setAttribute('required', 'required');
  } else {
    monthlyGroup.style.display = 'block';
    hourlyGroup.style.display = 'none';
    salaryInput.setAttribute('required', 'required');
    hourlyInput.removeAttribute('required');
  }
}

function closeAttendanceModal() {
  document.getElementById('attendanceModal').classList.remove('active');
}

async function handleAttendanceSubmit(e) {
  e.preventDefault();
  
  // جمع الفترات
  const sessionRows = document.querySelectorAll('#attendanceSessionsContainer .session-row');
  const sessions = [];
  
  sessionRows.forEach(row => {
    const checkIn = row.querySelector('.session-checkin').value;
    const checkOut = row.querySelector('.session-checkout').value;
    
    if (checkIn) {
      sessions.push({
        check_in: checkIn,
        check_out: checkOut || null,
        notes: ''
      });
    }
  });
  
  // إذا لم تكن هناك فترات، استخدام الحقول القديمة
  let checkIn = null;
  let checkOut = null;
  
  if (sessions.length === 0) {
    checkIn = document.getElementById('attendanceCheckIn')?.value || null;
    checkOut = document.getElementById('attendanceCheckOut')?.value || null;
  } else if (sessions.length === 1) {
    // إذا كانت فترة واحدة، استخدامها كقيم رئيسية
    checkIn = sessions[0].check_in;
    checkOut = sessions[0].check_out;
  } else {
    // عدة فترات، استخدام أول فترة كقيم رئيسية
    checkIn = sessions[0].check_in;
    checkOut = sessions[sessions.length - 1].check_out || null;
  }
  
  const data = {
    employee_id: parseInt(document.getElementById('attendanceEmployeeId').value),
    date: document.getElementById('attendanceDate').value,
    attendance_date: document.getElementById('attendanceDate').value,
    check_in: checkIn,
    check_out: checkOut,
    status: document.getElementById('attendanceStatus').value,
    notes: document.getElementById('attendanceNotes').value,
    sessions: sessions.length > 0 ? sessions : undefined
  };
  
  try {
    const res = await fetch('elos-db://employee-attendance-add', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
    
    if (!res.ok) throw new Error(await res.text());
    
    showToast('تم تسجيل الحضور', 'success');
    closeAttendanceModal();
    await loadAttendance();
    await loadStats();
  } catch (error) {
    Logger.error('Error saving attendance:', error);
    showToast('حدث خطأ أثناء الحفظ', 'error');
  }
}

async function deleteAttendance(id) {
  // ✅ استخدام showConfirm بدلاً من confirm
  const confirmed = await showConfirm('هل أنت متأكد من حذف هذا السجل؟', 'حذف', 'إلغاء', 'danger');
  if (!confirmed) return;
  
  try {
    const res = await fetch(`elos-db://employee-attendance-delete/${id}`, { method: 'POST' });
    if (!res.ok) throw new Error(await res.text());
    
    showToast('تم حذف السجل', 'success');
    await loadAttendance();
    await loadStats();
  } catch (error) {
    Logger.error('Error deleting attendance:', error);
    showToast('حدث خطأ أثناء الحذف', 'error');
  }
}

// ═══════════════════════════════════════════════════════════════
// 📊 REPORTS
// ═══════════════════════════════════════════════════════════════
function generatePayslipReport() {
  const empId = document.getElementById('filterSalaryEmployee')?.value;
  const month = document.getElementById('filterSalaryMonth')?.value;
  const year = document.getElementById('filterSalaryYear')?.value;

  let filtered = [...salaries];
  if (empId) filtered = filtered.filter(s => s.employee_id == empId);
  if (month) filtered = filtered.filter(s => s.month === month);
  if (year) filtered = filtered.filter(s => String(s.year) === String(year));

  if (!filtered.length) {
    showToast('لا توجد بيانات للطباعة', 'error');
    return;
  }

  const rows = filtered.map((s, idx) => {
    const emp = employees.find(e => e.id === s.employee_id);
    const isHourly = emp?.salary_type === 'hourly';
    const salaryTypeLabel = isHourly ? `<br><small style="color:#666">(بالساعة)</small>` : '';
    return `
      <tr>
        <td>${idx + 1}</td>
        <td>${emp?.name || 'غير معروف'}</td>
        <td>${getMonthName(s.month)}/${s.year}</td>
        <td>${formatNumber(s.base_salary || 0)}${salaryTypeLabel}</td>
        <td>${formatNumber(s.allowances || 0)}</td>
        <td>${formatNumber(s.bonus || 0)}</td>
        <td>${formatNumber(s.deductions || 0)}</td>
        <td>${formatNumber(s.advance_deduction || 0)}</td>
        <td><strong>${formatNumber(s.net_salary || 0)}</strong></td>
        <td>${getSalaryStatus(s.status)}</td>
      </tr>
    `;
  }).join('');

  const totalNet = filtered.reduce((sum, s) => sum + (s.net_salary || 0), 0);

  const printWindow = window.open('', '_blank');
  printWindow.document.write(`
    <!DOCTYPE html>
    <html dir="rtl">
    <head>
      <meta charset="UTF-8">
      <title>كشف الرواتب</title>
      <style>
        body { font-family: 'Cairo', 'Segoe UI', sans-serif; padding: 20px; background: white; color: #333; }
        h1 { text-align: center; margin-bottom: 20px; }
        table { width: 100%; border-collapse: collapse; margin: 20px 0; }
        th, td { border: 1px solid #ddd; padding: 10px; text-align: center; }
        th { background: #f5f5f5; font-weight: bold; }
        .total-row { background: #e8f5e9; font-weight: bold; }
        @media print { body { padding: 0; } }
      </style>
    </head>
    <body>
      <h1>📊 كشف الرواتب</h1>
      <p style="text-align:center">تاريخ الطباعة: ${new Date().toLocaleDateString('ar-EG')}</p>
      <table>
        <thead>
          <tr>
            <th>#</th>
            <th>الموظف</th>
            <th>الشهر/السنة</th>
            <th>الراتب الأساسي</th>
            <th>البدلات</th>
            <th>المكافآت</th>
            <th>الخصومات</th>
            <th>خصم السلف</th>
            <th>صافي الراتب</th>
            <th>الحالة</th>
          </tr>
        </thead>
        <tbody>
          ${rows}
          <tr class="total-row">
            <td colspan="8">الإجمالي</td>
            <td>${formatNumber(totalNet)}</td>
            <td></td>
          </tr>
        </tbody>
      </table>
      <script>window.onload = () => { window.print(); }</script>
    </body>
    </html>
  `);
  printWindow.document.close();
}

function generateMonthlySalaryReport() {
  const now = new Date();
  const currentMonth = String(now.getMonth() + 1).padStart(2, '0');
  const currentYear = String(now.getFullYear());

  const monthlySalaries = salaries.filter(s => s.month === currentMonth && s.year === currentYear);

  if (!monthlySalaries.length) {
    showToast('لا توجد رواتب لهذا الشهر', 'error');
    return;
  }

  const totalBase = monthlySalaries.reduce((sum, s) => sum + (s.base_salary || 0), 0);
  const totalAllowances = monthlySalaries.reduce((sum, s) => sum + (s.allowances || 0), 0);
  const totalBonus = monthlySalaries.reduce((sum, s) => sum + (s.bonus || 0), 0);
  const totalDeductions = monthlySalaries.reduce((sum, s) => sum + (s.deductions || 0), 0);
  const totalAdvanceDeduction = monthlySalaries.reduce((sum, s) => sum + (s.advance_deduction || 0), 0);
  const totalNet = monthlySalaries.reduce((sum, s) => sum + (s.net_salary || 0), 0);
  const paidCount = monthlySalaries.filter(s => s.status === 'paid').length;
  const pendingCount = monthlySalaries.filter(s => s.status === 'pending').length;

  const rows = monthlySalaries.map((s, idx) => {
    const emp = employees.find(e => e.id === s.employee_id);
    const isHourly = emp?.salary_type === 'hourly';
    const salaryTypeLabel = isHourly ? `<br><small style="color:#666;font-size:10px">(بالساعة)</small>` : '';
    return `
      <tr>
        <td>${idx + 1}</td>
        <td>${emp?.name || 'غير معروف'}</td>
        <td>${emp?.department || '-'}</td>
        <td>${formatNumber(s.base_salary || 0)}${salaryTypeLabel}</td>
        <td>${formatNumber(s.allowances || 0)}</td>
        <td>${formatNumber(s.bonus || 0)}</td>
        <td>${formatNumber(s.deductions || 0)}</td>
        <td>${formatNumber(s.advance_deduction || 0)}</td>
        <td><strong>${formatNumber(s.net_salary || 0)}</strong></td>
        <td>${getSalaryStatus(s.status)}</td>
      </tr>
    `;
  }).join('');

  const printWindow = window.open('', '_blank');
  printWindow.document.write(`
    <!DOCTYPE html>
    <html dir="rtl">
    <head>
      <meta charset="UTF-8">
      <title>تقرير الرواتب الشهري</title>
      <style>
        body { font-family: 'Cairo', 'Segoe UI', sans-serif; padding: 20px; background: white; color: #333; }
        h1 { text-align: center; margin-bottom: 10px; }
        .summary { display: grid; grid-template-columns: repeat(4, 1fr); gap: 15px; margin: 20px 0; }
        .summary-card { border: 1px solid #ddd; padding: 15px; text-align: center; border-radius: 8px; }
        .summary-card .value { font-size: 20px; font-weight: bold; color: #2196F3; }
        .summary-card .label { color: #666; margin-top: 5px; }
        table { width: 100%; border-collapse: collapse; margin: 20px 0; }
        th, td { border: 1px solid #ddd; padding: 10px; text-align: center; }
        th { background: #f5f5f5; font-weight: bold; }
        .total-row { background: #e8f5e9; font-weight: bold; }
        @media print { body { padding: 0; } }
      </style>
    </head>
    <body>
      <h1>📊 تقرير الرواتب الشهري</h1>
      <p style="text-align:center">${getMonthName(currentMonth)} ${currentYear}</p>
      <div class="summary">
        <div class="summary-card">
          <div class="value">${monthlySalaries.length}</div>
          <div class="label">عدد الموظفين</div>
        </div>
        <div class="summary-card">
          <div class="value">${formatNumber(totalNet)}</div>
          <div class="label">إجمالي الصافي</div>
        </div>
        <div class="summary-card">
          <div class="value" style="color:green">${paidCount}</div>
          <div class="label">تم الصرف</div>
        </div>
        <div class="summary-card">
          <div class="value" style="color:orange">${pendingCount}</div>
          <div class="label">قيد الانتظار</div>
        </div>
      </div>
      <table>
        <thead>
          <tr>
            <th>#</th>
            <th>الموظف</th>
            <th>القسم</th>
            <th>الراتب الأساسي</th>
            <th>البدلات</th>
            <th>المكافآت</th>
            <th>الخصومات</th>
            <th>خصم السلف</th>
            <th>صافي الراتب</th>
            <th>الحالة</th>
          </tr>
        </thead>
        <tbody>
          ${rows}
          <tr class="total-row">
            <td colspan="3">الإجمالي</td>
            <td>${formatNumber(totalBase)}</td>
            <td>${formatNumber(totalAllowances)}</td>
            <td>${formatNumber(totalBonus)}</td>
            <td>${formatNumber(totalDeductions)}</td>
            <td>${formatNumber(totalAdvanceDeduction)}</td>
            <td>${formatNumber(totalNet)}</td>
            <td></td>
          </tr>
        </tbody>
      </table>
      <script>window.onload = () => { window.print(); }</script>
    </body>
    </html>
  `);
  printWindow.document.close();
}

async function generateAttendanceReport() {
  const empId = document.getElementById('filterAttendanceEmployee')?.value;
  const dateFrom = document.getElementById('filterAttendanceFrom')?.value;
  const dateTo = document.getElementById('filterAttendanceTo')?.value;

  // جلب بيانات الحضور مع الفترات المتعددة
  try {
    let attendanceData = [...attendance];
    
    // إذا كان هناك فلترات، نحتاج إعادة جلب البيانات
    if (empId || dateFrom || dateTo) {
      let url = 'elos-db://employee-attendance?include_sessions=true';
      if (empId) url += `&employee_id=${empId}`;
      if (dateFrom) url += `&date=${dateFrom}`;
      
      const res = await fetch(url);
      if (res.ok) {
        attendanceData = await res.json();
        // تطبيق فلتر التاريخ النهائي
        if (dateTo) {
          attendanceData = attendanceData.filter(a => (a.attendance_date || a.date) <= dateTo);
        }
      }
    } else {
      // جلب جميع البيانات مع الفترات
      const res = await fetch('elos-db://employee-attendance?include_sessions=true');
      if (res.ok) {
        attendanceData = await res.json();
      }
    }
    
    let filtered = attendanceData;

    if (!filtered.length) {
      showToast('لا توجد بيانات حضور للطباعة', 'error');
      return;
    }

  const presentCount = filtered.filter(a => a.status === 'present').length;
  const absentCount = filtered.filter(a => a.status === 'absent').length;
  const lateCount = filtered.filter(a => a.status === 'late').length;
  const vacationCount = filtered.filter(a => a.status === 'vacation').length;
  const sickCount = filtered.filter(a => a.status === 'sick').length;

    const rows = filtered.map((a, idx) => {
      const emp = employees.find(e => e.id === a.employee_id);
      
      // حساب الساعات من الفترات المتعددة
      let hours = '-';
      let timeDisplay = `${a.check_in || '-'} - ${a.check_out || '-'}`;
      
      if (a.sessions && Array.isArray(a.sessions) && a.sessions.length > 0) {
        hours = calculateTotalWorkHours(a.sessions);
        const sessionsList = a.sessions.map(s => {
          if (s.check_in && s.check_out) {
            return `${s.check_in} - ${s.check_out}`;
          } else if (s.check_in) {
            return `${s.check_in} - ...`;
          }
          return '';
        }).filter(Boolean).join(' | ');
        timeDisplay = sessionsList || timeDisplay;
      } else {
        hours = calculateWorkHours(a.check_in, a.check_out);
      }
      
      return `
        <tr>
          <td>${idx + 1}</td>
          <td>${emp?.name || 'غير معروف'}</td>
          <td>${formatDate(a.attendance_date || a.date)}</td>
          <td style="font-size:11px">${timeDisplay}</td>
          <td><strong>${hours}</strong></td>
          <td>${getAttendanceStatus(a.status)}</td>
          <td>${a.notes || '-'}</td>
        </tr>
      `;
    }).join('');

  const printWindow = window.open('', '_blank');
  printWindow.document.write(`
    <!DOCTYPE html>
    <html dir="rtl">
    <head>
      <meta charset="UTF-8">
      <title>تقرير الحضور</title>
      <style>
        body { font-family: 'Cairo', 'Segoe UI', sans-serif; padding: 20px; background: white; color: #333; }
        h1 { text-align: center; margin-bottom: 10px; }
        .summary { display: grid; grid-template-columns: repeat(5, 1fr); gap: 10px; margin: 20px 0; }
        .summary-card { border: 1px solid #ddd; padding: 12px; text-align: center; border-radius: 8px; }
        .summary-card .value { font-size: 18px; font-weight: bold; }
        .summary-card .label { color: #666; margin-top: 5px; font-size: 12px; }
        table { width: 100%; border-collapse: collapse; margin: 20px 0; }
        th, td { border: 1px solid #ddd; padding: 8px; text-align: center; }
        th { background: #f5f5f5; font-weight: bold; }
        @media print { body { padding: 0; } }
      </style>
    </head>
    <body>
      <h1>📋 تقرير الحضور والانصراف</h1>
      <p style="text-align:center">تاريخ الطباعة: ${new Date().toLocaleDateString('ar-EG')}</p>
      <div class="summary">
        <div class="summary-card">
          <div class="value" style="color:green">${presentCount}</div>
          <div class="label">حاضر</div>
        </div>
        <div class="summary-card">
          <div class="value" style="color:red">${absentCount}</div>
          <div class="label">غائب</div>
        </div>
        <div class="summary-card">
          <div class="value" style="color:orange">${lateCount}</div>
          <div class="label">متأخر</div>
        </div>
        <div class="summary-card">
          <div class="value" style="color:blue">${vacationCount}</div>
          <div class="label">إجازة</div>
        </div>
        <div class="summary-card">
          <div class="value" style="color:purple">${sickCount}</div>
          <div class="label">مريض</div>
        </div>
      </div>
      <table>
        <thead>
          <tr>
            <th>#</th>
            <th>الموظف</th>
            <th>التاريخ</th>
            <th>الفترات</th>
            <th>إجمالي الساعات</th>
            <th>الحالة</th>
            <th>ملاحظات</th>
          </tr>
        </thead>
        <tbody>
          ${rows}
        </tbody>
      </table>
      <script>window.onload = () => { window.print(); }</script>
    </body>
    </html>
  `);
  printWindow.document.close();
  } catch (error) {
    Logger.error('Error generating attendance report:', error);
    showToast('حدث خطأ أثناء إنشاء التقرير', 'error');
  }
}

function generateAdvancesReport() {
  const empId = document.getElementById('filterAdvanceEmployee')?.value;
  const status = document.getElementById('filterAdvanceStatus')?.value;

  let filtered = [...advances];
  if (empId) filtered = filtered.filter(a => a.employee_id == empId);
  if (status) filtered = filtered.filter(a => a.status === status);

  if (!filtered.length) {
    showToast('لا توجد بيانات سلف للطباعة', 'error');
    return;
  }

  const totalAmount = filtered.reduce((sum, a) => sum + (a.amount || 0), 0);
  const totalPaid = filtered.reduce((sum, a) => sum + (a.paid_amount || 0), 0);
  const totalRemaining = totalAmount - totalPaid;
  const pendingCount = filtered.filter(a => a.status === 'pending').length;
  const activeCount = filtered.filter(a => a.status === 'active' || a.status === 'approved').length;
  const paidCount = filtered.filter(a => a.status === 'paid').length;

  const rows = filtered.map((a, idx) => {
    const emp = employees.find(e => e.id === a.employee_id);
    const paid = a.paid_amount || 0;
    const remaining = a.amount - paid;
    return `
      <tr>
        <td>${idx + 1}</td>
        <td>${emp?.name || 'غير معروف'}</td>
        <td>${formatNumber(a.amount)}</td>
        <td>${a.installments_count || 1}</td>
        <td>${formatNumber(a.installment_amount || a.amount)}</td>
        <td style="color:green">${formatNumber(paid)}</td>
        <td style="color:red">${formatNumber(remaining)}</td>
        <td>${formatDate(a.created_at)}</td>
        <td>${getAdvanceStatus(a.status)}</td>
      </tr>
    `;
  }).join('');

  const printWindow = window.open('', '_blank');
  printWindow.document.write(`
    <!DOCTYPE html>
    <html dir="rtl">
    <head>
      <meta charset="UTF-8">
      <title>تقرير السلف</title>
      <style>
        body { font-family: 'Cairo', 'Segoe UI', sans-serif; padding: 20px; background: white; color: #333; }
        h1 { text-align: center; margin-bottom: 10px; }
        .summary { display: grid; grid-template-columns: repeat(3, 1fr); gap: 15px; margin: 20px 0; }
        .summary-card { border: 1px solid #ddd; padding: 15px; text-align: center; border-radius: 8px; }
        .summary-card .value { font-size: 20px; font-weight: bold; }
        .summary-card .label { color: #666; margin-top: 5px; }
        .status-summary { display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px; margin: 15px 0; }
        .status-card { padding: 10px; text-align: center; border-radius: 6px; background: #f5f5f5; }
        table { width: 100%; border-collapse: collapse; margin: 20px 0; }
        th, td { border: 1px solid #ddd; padding: 8px; text-align: center; }
        th { background: #f5f5f5; font-weight: bold; }
        .total-row { background: #e8f5e9; font-weight: bold; }
        @media print { body { padding: 0; } }
      </style>
    </head>
    <body>
      <h1>💳 تقرير السلف</h1>
      <p style="text-align:center">تاريخ الطباعة: ${new Date().toLocaleDateString('ar-EG')}</p>
      <div class="summary">
        <div class="summary-card">
          <div class="value" style="color:#2196F3">${formatNumber(totalAmount)}</div>
          <div class="label">إجمالي السلف</div>
        </div>
        <div class="summary-card">
          <div class="value" style="color:green">${formatNumber(totalPaid)}</div>
          <div class="label">المسدد</div>
        </div>
        <div class="summary-card">
          <div class="value" style="color:red">${formatNumber(totalRemaining)}</div>
          <div class="label">المتبقي</div>
        </div>
      </div>
      <div class="status-summary">
        <div class="status-card">قيد الانتظار: <strong>${pendingCount}</strong></div>
        <div class="status-card">جاري السداد: <strong>${activeCount}</strong></div>
        <div class="status-card">مسددة: <strong>${paidCount}</strong></div>
      </div>
      <table>
        <thead>
          <tr>
            <th>#</th>
            <th>الموظف</th>
            <th>المبلغ</th>
            <th>عدد الأقساط</th>
            <th>قيمة القسط</th>
            <th>المسدد</th>
            <th>المتبقي</th>
            <th>تاريخ الطلب</th>
            <th>الحالة</th>
          </tr>
        </thead>
        <tbody>
          ${rows}
          <tr class="total-row">
            <td colspan="2">الإجمالي</td>
            <td>${formatNumber(totalAmount)}</td>
            <td colspan="2"></td>
            <td>${formatNumber(totalPaid)}</td>
            <td>${formatNumber(totalRemaining)}</td>
            <td colspan="2"></td>
          </tr>
        </tbody>
      </table>
      <script>window.onload = () => { window.print(); }</script>
    </body>
    </html>
  `);
  printWindow.document.close();
}

// ═══════════════════════════════════════════════════════════════
// 🛠️ UTILITY FUNCTIONS
// ═══════════════════════════════════════════════════════════════
function populateEmployeeSelects() {
  const selects = [
    'salaryEmployeeId', 'advanceEmployeeId', 'vacationEmployeeId', 
    'attendanceEmployeeId', 'filterSalaryEmployee', 'filterAdvanceEmployee',
    'filterVacationEmployee', 'filterAttendanceEmployee'
  ];
  
  const options = employees.map(e => `<option value="${e.id}">${e.name}</option>`).join('');
  
  selects.forEach(id => {
    const select = document.getElementById(id);
    if (select) {
      const firstOption = select.querySelector('option');
      select.innerHTML = (firstOption ? firstOption.outerHTML : '<option value="">الكل</option>') + options;
    }
  });
}

function updateDepartmentsList() {
  const departments = [...new Set(employees.map(e => e.department).filter(Boolean))];
  
  // Update datalist
  const datalist = document.getElementById('departmentsList');
  if (datalist) {
    datalist.innerHTML = departments.map(d => `<option value="${d}">`).join('');
  }
  
  // Update filter
  const filter = document.getElementById('filterDepartment');
  if (filter) {
    const options = departments.map(d => `<option value="${d}">${d}</option>`).join('');
    filter.innerHTML = '<option value="">الكل</option>' + options;
  }
}

function formatNumber(num) {
  return Number(num || 0).toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 2 });
}

function formatDate(dateString) {
  if (!dateString) return '-';
  return new Date(dateString).toLocaleDateString('ar-EG');
}

function getMonthName(month) {
  const months = {
    '01': 'يناير', '02': 'فبراير', '03': 'مارس', '04': 'أبريل',
    '05': 'مايو', '06': 'يونيو', '07': 'يوليو', '08': 'أغسطس',
    '09': 'سبتمبر', '10': 'أكتوبر', '11': 'نوفمبر', '12': 'ديسمبر'
  };
  return months[month] || month;
}

function getStatusLabel(status) {
  const labels = { 'active': 'نشط', 'inactive': 'غير نشط', 'suspended': 'معلق' };
  return labels[status] || 'نشط';
}

function getSalaryStatus(status) {
  const labels = { 'pending': 'قيد الانتظار', 'paid': 'مصروف' };
  return labels[status] || 'قيد الانتظار';
}

function getAdvanceStatus(status) {
  const labels = {
    'pending': 'قيد الانتظار', 'approved': 'موافق عليها',
    'active': 'جاري السداد', 'paid': 'مسددة', 'rejected': 'مرفوضة'
  };
  return labels[status] || status;
}

function getVacationType(type) {
  const labels = {
    'annual': 'سنوية', 'sick': 'مرضية',
    'emergency': 'طارئة', 'unpaid': 'بدون راتب'
  };
  return labels[type] || type;
}

function getVacationStatus(status) {
  const labels = { 'pending': 'قيد الانتظار', 'approved': 'موافق عليها', 'rejected': 'مرفوضة' };
  return labels[status] || status;
}

function getAttendanceStatus(status) {
  const labels = {
    'present': 'حاضر', 'absent': 'غائب', 'late': 'متأخر',
    'vacation': 'إجازة', 'sick': 'مريض'
  };
  return labels[status] || status;
}

function calculateWorkHours(checkIn, checkOut) {
  if (!checkIn || !checkOut) return '-';
  
  const [inH, inM] = checkIn.split(':').map(Number);
  const [outH, outM] = checkOut.split(':').map(Number);
  
  const inMinutes = inH * 60 + inM;
  const outMinutes = outH * 60 + outM;
  const diff = outMinutes - inMinutes;
  
  if (diff <= 0) return '-';
  
  const hours = Math.floor(diff / 60);
  const mins = diff % 60;
  return `${hours}س ${mins}د`;
}

// حساب إجمالي ساعات العمل من عدة فترات
function calculateTotalWorkHours(sessions) {
  if (!sessions || !Array.isArray(sessions) || sessions.length === 0) return '-';
  
  let totalMinutes = 0;
  
  sessions.forEach(session => {
    if (session.check_in && session.check_out) {
      const [inH, inM] = session.check_in.split(':').map(Number);
      const [outH, outM] = session.check_out.split(':').map(Number);
      
      const inMinutes = inH * 60 + inM;
      const outMinutes = outH * 60 + outM;
      const diff = outMinutes - inMinutes;
      
      if (diff > 0) {
        totalMinutes += diff;
      }
    }
  });
  
  if (totalMinutes <= 0) return '-';
  
  const hours = Math.floor(totalMinutes / 60);
  const mins = totalMinutes % 60;
  return `${hours}س ${mins}د`;
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
['employeeModal', 'salaryModal', 'advanceModal', 'vacationModal', 'attendanceModal', 'profileModal'].forEach(id => {
  document.getElementById(id)?.addEventListener('click', (e) => {
    if (e.target.id === id) {
      document.getElementById(id).classList.remove('active');
    }
  });
});

// ═══════════════════════════════════════════════════════════════
// 🚀 INITIALIZATION
// ═══════════════════════════════════════════════════════════════
(async function init() {
  Logger.log('👥 ELOS Employees System v2.0 - Initializing...');
  
  initHeaderClock();
  
  // تعيين السنة الحالية في الفلاتر
  const currentYear = new Date().getFullYear();
  const filterYearInput = document.getElementById('filterSalaryYear');
  const salaryYearInput = document.getElementById('salaryYear');
  
  if (filterYearInput && !filterYearInput.value) {
    filterYearInput.value = currentYear;
  }
  if (salaryYearInput && !salaryYearInput.value) {
    salaryYearInput.value = currentYear;
  }
  
  await loadEmployees();
  await loadSalaries();
  await loadAdvances();
  await loadVacations();
  await loadAttendance();
  await loadStats();
  
  Logger.log('✅ ELOS Employees System Ready!');
})();
