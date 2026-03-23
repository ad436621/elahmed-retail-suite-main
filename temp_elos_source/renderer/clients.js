// clients.js - إدارة العملاء (محسّن ✅)

// Fallbacks if utils.js not loaded yet
if (!window.Logger) window.Logger = { log: () => {}, warn: () => {}, error: console.error, debug: () => {}, info: () => {} };
if (!window.fmt) window.fmt = (n, decimals = 2) => Number(n || 0).toLocaleString('en-US', { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
if (!window.escapeHtml) window.escapeHtml = (text) => { if (text === null || text === undefined) return ''; const div = document.createElement('div'); div.textContent = String(text); return div.innerHTML; };
const fmt = window.fmt;
const escapeHtml = window.escapeHtml;

let clients = [];
let paymentWallets = []; // ✅ المحافظ الفعلية من قاعدة البيانات
let individualWalletBalances = []; // ✅ أرصدة المحافظ الفردية

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
async function updateClientPaymentWalletsList() {
  const walletTypeSelect = document.getElementById('paymentWalletType');
  const walletSelectGroup = document.getElementById('clientPaymentWalletSelectGroup');
  const walletSelect = document.getElementById('clientPaymentWalletSelect');
  
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
    updateClientPaymentWalletBalance();
    return;
  }
  
  // Show the select and populate options
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
  
  updateClientPaymentWalletBalance();
}

// ✅ تحديث رصيد المحفظة المختارة
async function updateClientPaymentWalletBalance() {
  const walletTypeSelect = document.getElementById('paymentWalletType');
  const walletSelect = document.getElementById('clientPaymentWalletSelect');
  const balanceInput = document.getElementById('clientPaymentWalletBalance');
  
  if (!walletTypeSelect || !balanceInput) return;
  
  const walletType = walletTypeSelect.value;
  
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
window.updateClientPaymentWalletsList = updateClientPaymentWalletsList;

// ═══════════════════════════════════════
// 🔒 التحقق من الصلاحيات
// ═══════════════════════════════════════
function checkPermission(action = 'edit') {
  if (!window.currentUser) {
    showError('يجب تسجيل الدخول أولاً');
    return false;
  }
  
  // المشاهد (viewer) لا يمكنه التعديل أو الحذف
  if (window.currentUser.role === 'viewer') {
    showError('ليس لديك صلاحية لتنفيذ هذا الإجراء');
    return false;
  }
  
  return true;
}

// تحميل البيانات عند فتح الصفحة
window.addEventListener('DOMContentLoaded', () => {
  loadClients();
  loadStats();
  
  // إعداد البحث
  document.getElementById('searchBox').addEventListener('input', (e) => {
    const query = e.target.value.trim();
    if (query) {
      searchClients(query);
    } else {
      loadClients();
    }
  });

  // إعداد نموذج إضافة/تعديل العميل
  document.getElementById('clientForm').addEventListener('submit', (e) => {
    e.preventDefault();
    saveClient();
  });

  // إعداد نموذج الدفع
  document.getElementById('paymentForm').addEventListener('submit', (e) => {
    e.preventDefault();
    processPayment();
  });
});

// ═══════════════════════════════════════
// 📊 تحميل الإحصائيات
// ═══════════════════════════════════════
async function loadStats() {
  try {
    const res = await fetch('elos-db://clients');
    const data = await res.json();
    
    const totalClients = data.length;
    
    // حساب الإحصائيات بشكل صحيح
    let totalDebt = 0;      // إجمالي المدين (له علينا - موجب)
    let totalCredit = 0;    // إجمالي الدائن (علينا له - سالب)
    let clientsWithDebt = 0; // عدد العملاء المدينين
    
    data.forEach(c => {
      const balance = c.balance || 0;
      if (balance > 0) {
        totalDebt += balance;
        clientsWithDebt++;
      } else if (balance < 0) {
        totalCredit += Math.abs(balance);
      }
    });
    
    const statsHtml = `
      <div class="stat-card">
        <div class="stat-label">إجمالي العملاء</div>
        <div class="stat-value">${totalClients}</div>
      </div>
      <div class="stat-card">
        <div class="stat-label">إجمالي الذمم (له علينا)</div>
        <div class="stat-value" style="color: ${totalDebt > 0 ? '#ef4444' : '#10b981'}">
          ${totalDebt.toFixed(2)} ج.م
        </div>
        <div class="stat-sub">${clientsWithDebt} عميل</div>
      </div>
      <div class="stat-card">
        <div class="stat-label">إجمالي الدائن (علينا لهم)</div>
        <div class="stat-value" style="color: ${totalCredit > 0 ? '#10b981' : '#8b93a6'}">
          ${totalCredit.toFixed(2)} ج.م
        </div>
      </div>
    `;
    
    document.getElementById('statsGrid').innerHTML = statsHtml;
  } catch (error) {
    Logger.error('خطأ في تحميل الإحصائيات:', error);
  }
}

// ═══════════════════════════════════════
// 📋 تحميل قائمة العملاء
// ═══════════════════════════════════════
async function loadClients() {
  try {
    const res = await fetch('elos-db://clients');
    if (!res.ok) {
      const errorText = await res.text();
      throw new Error(errorText || 'فشل تحميل البيانات');
    }
    
    clients = await res.json();
    renderClients(clients);
    await loadStats(); // ✅ تحديث الإحصائيات
  } catch (error) {
    Logger.error('خطأ في تحميل العملاء:', error);
    showError('فشل تحميل قائمة العملاء: ' + error.message);
  }
}

// ═══════════════════════════════════════
// 🔍 البحث عن العملاء
// ═══════════════════════════════════════
async function searchClients(query) {
  try {
    const res = await fetch(`elos-db://clients?q=${encodeURIComponent(query)}`);
    if (!res.ok) throw new Error('فشل البحث');
    
    const results = await res.json();
    renderClients(results);
  } catch (error) {
    Logger.error('خطأ في البحث:', error);
    showError('فشل البحث عن العملاء');
  }
}

// ═══════════════════════════════════════
// 🖼️ عرض العملاء في الجدول
// ═══════════════════════════════════════
function renderClients(data) {
  const tbody = document.getElementById('clientsTable');
  
  if (!data || data.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="7" class="empty-state">
          <div class="empty-state-icon">👥</div>
          <div>لا توجد عملاء مسجلين</div>
        </td>
      </tr>
    `;
    return;
  }
  
  tbody.innerHTML = data.map(client => {
    const balance = client.balance || 0;
    const invoiceCount = client.invoice_count || 0;
    
    // عمود الرصيد الحالي (رقم بسيط)
    let balanceDisplay = '';
    let balanceColor = 'var(--muted)';
    let balanceIcon = '🟢';
    
    if (balance > 0) {
      // مدين - له علينا (أحمر)
      balanceDisplay = `${balance.toFixed(2)} ج.م`;
      balanceColor = 'var(--danger)';
      balanceIcon = '🔴';
    } else if (balance < 0) {
      // دائن - علينا له (أخضر)
      balanceDisplay = `${balance.toFixed(2)} ج.م`;
      balanceColor = 'var(--success)';
      balanceIcon = '🟡';
    } else {
      // متوازن
      balanceDisplay = '0.00 ج.م';
    }
    
    const date = new Date(client.created_at).toLocaleDateString('ar-EG', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
    
    // ✅ إخفاء أزرار التعديل/الحذف للمشاهدين
    const canEdit = window.currentUser && window.currentUser.role !== 'viewer';
    
    // Get initials for avatar
    const initials = getClientInitials(client.name);
    
    return `
      <tr>
        <td>${client.id}</td>
        <td>
          <div style="display: flex; align-items: center; gap: 10px;">
            <div style="
              width: 36px;
              height: 36px;
              border-radius: 10px;
              background: linear-gradient(135deg, var(--brand), var(--purple));
              display: flex;
              align-items: center;
              justify-content: center;
              font-weight: 800;
              font-size: 13px;
              color: white;
            ">${initials}</div>
            <div>
              <div style="font-weight: 700;">${escapeHtml(client.name)}</div>
              <div style="font-size: 11px; color: var(--muted);">${escapeHtml(client.phone || '-')}</div>
            </div>
          </div>
        </td>
        <td>${escapeHtml(client.address || '-')}</td>
        <td>
          <span style="
            display: inline-flex;
            align-items: center;
            gap: 6px;
            padding: 5px 12px;
            border-radius: 20px;
            font-size: 12px;
            font-weight: 700;
            background: ${balance > 0 ? 'rgba(239,68,68,0.15)' : balance < 0 ? 'rgba(245,158,11,0.15)' : 'rgba(16,185,129,0.15)'};
            color: ${balanceColor};
            border: 1px solid ${balance > 0 ? 'rgba(239,68,68,0.3)' : balance < 0 ? 'rgba(245,158,11,0.3)' : 'rgba(16,185,129,0.3)'};
          ">
            ${balanceIcon} ${balanceDisplay}
          </span>
        </td>
        <td>${invoiceCount}</td>
        <td style="font-size: 12px; color: var(--muted);">${date}</td>
        <td style="white-space: nowrap;">
          <div style="display: flex; gap: 4px; justify-content: flex-end;">
            <button class="btn btn-sm" onclick="openStatementModal(${client.id})" title="كشف حساب" style="color: var(--cyan); background: rgba(6,182,212,0.1); border-color: rgba(6,182,212,0.3);">
              📜
            </button>
            ${canEdit ? `
            <button class="btn btn-sm btn-secondary" onclick="editClient(${client.id})" title="تعديل">
              ✏️
            </button>
            ${balance > 0 ? `
            <button class="btn btn-sm btn-success" onclick="openPaymentModal(${client.id})" title="تحصيل">
              💰
            </button>
            ` : ''}
            <button class="btn btn-sm btn-danger" onclick="deleteClient(${client.id})" title="حذف">
              🗑️
            </button>
            ` : `
            <button class="btn btn-sm btn-secondary" onclick="viewClient(${client.id})" title="عرض">
              👁️
            </button>
            `}
          </div>
        </td>
      </tr>
    `;
  }).join('');
}

// دالة للحصول على الحروف الأولى
function getClientInitials(name) {
  if (!name) return '?';
  const parts = name.trim().split(' ');
  if (parts.length >= 2) {
    return (parts[0][0] + parts[1][0]).toUpperCase();
  }
  return name.substring(0, 2).toUpperCase();
}

// ═══════════════════════════════════════
// ➕ فتح نافذة إضافة عميل جديد
// ═══════════════════════════════════════
function openAddModal() {
  if (!checkPermission('add')) return;

  document.getElementById('modalTitle').textContent = 'إضافة عميل جديد';
  document.getElementById('clientForm').reset();
  document.getElementById('clientId').value = '';
  document.getElementById('clientModal').classList.add('active');

  // ✅ إصلاح مشكلة تعليق الـ Input - التركيز بعد فتح الـ Modal
  setTimeout(() => {
    const firstInput = document.getElementById('clientName');
    if (firstInput) {
      firstInput.focus();
      firstInput.select();
    }
  }, 100);
}

// ═══════════════════════════════════════
// ✏️ فتح نافذة تعديل عميل
// ═══════════════════════════════════════
async function editClient(id) {
  if (!checkPermission('edit')) return;
  
  try {
    const res = await fetch(`elos-db://clients?id=${id}`);
    if (!res.ok) throw new Error('فشل تحميل بيانات العميل');
    
    const client = await res.json();
    if (!client) {
      showError('العميل غير موجود');
      return;
    }
    
    document.getElementById('modalTitle').textContent = 'تعديل بيانات العميل';
    document.getElementById('clientId').value = client.id;
    document.getElementById('clientName').value = client.name;
    document.getElementById('clientPhone').value = client.phone || '';
    document.getElementById('clientAddress').value = client.address || '';
    document.getElementById('clientBalance').value = client.opening_balance ?? client.balance ?? 0;
    document.getElementById('clientNotes').value = client.notes || '';
    
    document.getElementById('clientModal').classList.add('active');

    // ✅ إصلاح مشكلة تعليق الـ Input - التركيز بعد فتح الـ Modal
    setTimeout(() => {
      const firstInput = document.getElementById('clientName');
      if (firstInput) {
        firstInput.focus();
        firstInput.select();
      }
    }, 100);
  } catch (error) {
    Logger.error('خطأ في تحميل بيانات العميل:', error);
    showError('فشل تحميل بيانات العميل');
  }
}

// ═══════════════════════════════════════
// 👁️ عرض بيانات العميل (للمشاهدين)
// ═══════════════════════════════════════
async function viewClient(id) {
  try {
    const res = await fetch(`elos-db://clients?id=${id}`);
    if (!res.ok) throw new Error('فشل تحميل بيانات العميل');
    
    const client = await res.json();
    if (!client) {
      showError('العميل غير موجود');
      return;
    }
    
    // عرض البيانات في وضع القراءة فقط
    document.getElementById('modalTitle').textContent = 'عرض بيانات العميل';
    document.getElementById('clientId').value = client.id;
    document.getElementById('clientName').value = client.name;
    document.getElementById('clientPhone').value = client.phone || '';
    document.getElementById('clientAddress').value = client.address || '';
    document.getElementById('clientBalance').value = client.balance || 0;
    document.getElementById('clientNotes').value = client.notes || '';
    
    // تعطيل الحقول
    document.querySelectorAll('#clientModal input, #clientModal textarea').forEach(input => {
      input.disabled = true;
    });
    
    // إخفاء زر الحفظ
    document.querySelector('#clientModal .btn-primary').style.display = 'none';
    
    document.getElementById('clientModal').classList.add('active');
  } catch (error) {
    Logger.error('خطأ في تحميل بيانات العميل:', error);
    showError('فشل تحميل بيانات العميل');
  }
}

// ═══════════════════════════════════════
// 💾 حفظ بيانات العميل (إضافة أو تعديل)
// ═══════════════════════════════════════
async function saveClient() {
  if (!checkPermission('save')) return;
  
  const id = document.getElementById('clientId').value;
  const name = document.getElementById('clientName').value.trim();
  const phone = document.getElementById('clientPhone').value.trim();
  const address = document.getElementById('clientAddress').value.trim();
  const notes = document.getElementById('clientNotes').value.trim();
  
  if (!name) {
    showError('الرجاء إدخال اسم العميل');
    return;
  }
  
  try {
    const endpoint = id ? 'clients-update' : 'clients-add';
    const openingBalance = parseFloat(document.getElementById('clientBalance').value) || 0;
    const payload = id
      ? { id: parseInt(id), name, phone, address, notes, opening_balance: openingBalance }
      : { name, phone, address, opening_balance: openingBalance, notes };
    
    const res = await fetch(`elos-db://${endpoint}`, {
      method: 'POST',
      body: JSON.stringify(payload)
    });
    
    if (!res.ok) {
      const error = await res.text();
      throw new Error(error);
    }
    
    const result = await res.json();
    if (result.ok) {
      showSuccess(id ? 'تم تحديث بيانات العميل بنجاح' : 'تم إضافة العميل بنجاح');
      closeModal();
      await loadClients(); // ✅ استخدام await لضمان التحديث
    }
  } catch (error) {
    Logger.error('خطأ في حفظ العميل:', error);
    showError('فشل حفظ بيانات العميل: ' + error.message);
  }
}

// ═══════════════════════════════════════
// 🗑️ حذف عميل (Soft Delete للعملاء مع مبيعات)
// ═══════════════════════════════════════
async function deleteClient(id) {
  if (!checkPermission('delete')) return;

  // ✅ استخدام showConfirm بدلاً من confirm
  const confirmed = await showConfirm(
    'هل أنت متأكد من حذف هذا العميل؟\n\nإذا كان لديه مبيعات مسجلة، سيتم إخفاؤه من القائمة مع الاحتفاظ بسجلاته.',
    'حذف',
    'إلغاء',
    'danger'
  );
  if (!confirmed) {
    return;
  }

  try {
    const res = await fetch('elos-db://clients-delete', {
      method: 'POST',
      body: JSON.stringify({ id })
    });

    if (!res.ok) {
      const error = await res.text();
      throw new Error(error);
    }

    const result = await res.json();
    if (result.ok) {
      if (result.softDeleted) {
        // تم إخفاء العميل (Soft Delete)
        showSuccess(`تم إخفاء العميل من القائمة.\nالسبب: لديه ${result.salesCount} عملية بيع مسجلة.\n\nسجلاته محفوظة في النظام.`);
      } else {
        // تم حذف العميل نهائياً (Hard Delete)
        showSuccess('تم حذف العميل نهائياً.');
      }
      await loadClients(); // ✅ تحديث القائمة والإحصائيات
    }
  } catch (error) {
    Logger.error('خطأ في حذف العميل:', error);
    showError('فشل حذف العميل: ' + error.message);
  }
}

// ═══════════════════════════════════════
// 💰 فتح نافذة تحصيل دفعة
// ═══════════════════════════════════════
async function openPaymentModal(id) {
  if (!checkPermission('payment')) return;
  
  try {
    const res = await fetch(`elos-db://clients?id=${id}`);
    if (!res.ok) throw new Error('فشل تحميل بيانات العميل');
    
    const client = await res.json();
    if (!client) {
      showError('العميل غير موجود');
      return;
    }
    
    // ✅ التحقق من أن العميل لديه رصيد مدين فعلاً
    if (client.balance <= 0) {
      showError('هذا العميل ليس لديه رصيد مدين');
      return;
    }
    
    document.getElementById('paymentClientId').value = client.id;
    document.getElementById('paymentClientName').value = client.name;
    document.getElementById('paymentCurrentBalance').value = `${client.balance.toFixed(2)} ج.م`;
    document.getElementById('paymentAmount').value = '';
    document.getElementById('paymentAmount').max = client.balance; // ✅ تحديد الحد الأقصى
    
    // ✅ تحميل المحافظ وتحديث القائمة
    await loadPaymentWallets();
    document.getElementById('paymentWalletType').value = 'cash';
    await updateClientPaymentWalletsList();
    
    document.getElementById('paymentModal').classList.add('active');
    
    // التركيز على حقل المبلغ
    setTimeout(() => {
      document.getElementById('paymentAmount').focus();
    }, 300);
  } catch (error) {
    Logger.error('خطأ في تحميل بيانات العميل:', error);
    showError('فشل تحميل بيانات العميل');
  }
}

// ═══════════════════════════════════════
// 💸 معالجة تحصيل الدفعة
// ═══════════════════════════════════════
async function processPayment() {
  if (!checkPermission('payment')) return;
  
  const clientId = parseInt(document.getElementById('paymentClientId').value);
  const amount = parseFloat(document.getElementById('paymentAmount').value);
  const currentBalanceStr = document.getElementById('paymentCurrentBalance').value;
  const currentBalance = parseFloat(currentBalanceStr.replace(/[^\d.-]/g, ''));
  
  if (!amount || amount <= 0) {
    showError('الرجاء إدخال مبلغ صحيح');
    return;
  }
  
  // ✅ التحقق من عدم تجاوز الرصيد المستحق
  if (amount > currentBalance) {
    showError(`المبلغ المدخل (${amount.toFixed(2)} ج.م) أكبر من الرصيد المستحق (${currentBalance.toFixed(2)} ج.م)`);
    return;
  }
  
  try {
    // ✅ الحصول على المحفظة المختارة
    const walletType = document.getElementById('paymentWalletType')?.value || 'cash';
    const walletSelect = document.getElementById('clientPaymentWalletSelect');
    const walletId = (walletSelect && walletSelect.value && (walletType === 'mobile_wallet' || walletType === 'bank')) 
      ? parseInt(walletSelect.value) : null;
    
    const res = await fetch('elos-db://clients-payment', {
      method: 'POST',
      body: JSON.stringify({ 
        client_id: clientId, 
        amount,
        wallet_type: walletType, // للتوافق العكسي
        wallet_id: walletId // ✅ المحفظة المحددة
      })
    });
    
    if (!res.ok) {
      const error = await res.text();
      throw new Error(error);
    }
    
    const result = await res.json();
    if (result.ok) {
      showSuccess(`تم تحصيل ${amount.toFixed(2)} ج.م بنجاح`);
      closePaymentModal();
      await loadClients(); // ✅ تحديث القائمة والإحصائيات
    }
  } catch (error) {
    Logger.error('خطأ في تحصيل الدفعة:', error);
    showError('فشل تحصيل الدفعة: ' + error.message);
  }
}

// ═══════════════════════════════════════
// 🚪 إغلاق النوافذ
// ═══════════════════════════════════════
function closeModal() {
  document.getElementById('clientModal').classList.remove('active');
  document.getElementById('clientForm').reset();
  
  // ✅ إعادة تفعيل الحقول (في حالة كانت معطلة للمشاهد)
  document.querySelectorAll('#clientModal input, #clientModal textarea').forEach(input => {
    input.disabled = false;
  });
  document.querySelector('#clientModal .btn-primary').style.display = '';
}

function closePaymentModal() {
  document.getElementById('paymentModal').classList.remove('active');
  document.getElementById('paymentForm').reset();
}

// ═══════════════════════════════════════
// 📢 رسائل التنبيه (Toast System)
// ═══════════════════════════════════════
function showError(message) {
  showToast(message, 'error');
}

function showSuccess(message) {
  showToast(message, 'success');
}

function showToast(message, type = 'info', duration = 3000) {
  // Check if showToast from HTML exists
  if (window.showToastHTML && typeof window.showToastHTML === 'function') {
    window.showToastHTML(message, type);
    return;
  }
  
  let container = document.querySelector('.toast-container');
  if (!container) {
    container = document.createElement('div');
    container.className = 'toast-container';
    container.style.cssText = `
      position: fixed;
      bottom: 70px;
      left: 24px;
      z-index: 10000;
      display: flex;
      flex-direction: column;
      gap: 10px;
    `;
    document.body.appendChild(container);
  }
  
  const toast = document.createElement('div');
  const icons = { success: '✅', error: '❌', warning: '⚠️', info: 'ℹ️' };
  const colors = { 
    success: 'linear-gradient(135deg, #10b981, #059669)', 
    error: 'linear-gradient(135deg, #ef4444, #dc2626)', 
    warning: 'linear-gradient(135deg, #f59e0b, #d97706)', 
    info: 'linear-gradient(135deg, #3b82f6, #2563eb)' 
  };
  
  toast.className = `toast toast-${type}`;
  toast.style.cssText = `
    background: ${colors[type]};
    color: white;
    padding: 12px 20px;
    border-radius: 12px;
    font-size: 13px;
    font-weight: 600;
    display: flex;
    align-items: center;
    gap: 10px;
    box-shadow: 0 8px 32px rgba(0,0,0,0.3);
    animation: slideInLeft 0.3s ease;
  `;
  
  toast.innerHTML = `<span style="font-size: 18px;">${icons[type]}</span><span>${message}</span>`;
  container.appendChild(toast);
  
  // Add animation keyframes if not exists
  if (!document.getElementById('toastAnimations')) {
    const style = document.createElement('style');
    style.id = 'toastAnimations';
    style.textContent = `
      @keyframes slideInLeft { from { opacity: 0; transform: translateX(-30px); } to { opacity: 1; transform: translateX(0); } }
      @keyframes slideOutLeft { from { opacity: 1; } to { opacity: 0; transform: translateX(-30px); } }
    `;
    document.head.appendChild(style);
  }
  
  setTimeout(() => {
    toast.style.animation = 'slideOutLeft 0.3s ease';
    setTimeout(() => toast.remove(), 300);
  }, duration);
}

// ═══════════════════════════════════════
// 📜 كشف حساب العميل المحسن
// ═══════════════════════════════════════
async function openStatementModal(clientId) {
  try {
    const client = clients.find(c => c.id === clientId);
    if (!client) {
      showError('العميل غير موجود');
      return;
    }
    
    // Store for later use
    window.currentStatementClient = client;
    
    // Open modal
    const modal = document.getElementById('statementModal');
    if (modal) {
      modal.classList.add('active');
      loadClientStatement(clientId);
    }
  } catch (error) {
    Logger.error('Error opening statement:', error);
    showError('فشل فتح كشف الحساب');
  }
}

// ═══════════════════════════════════════
// 📄 تصدير كشف حساب العميل PDF
// ═══════════════════════════════════════
async function exportClientStatementPDF(clientId) {
  const client = clients.find(c => c.id === clientId) || window.currentStatementClient;
  if (!client) {
    showError('العميل غير موجود');
    return;
  }

  try {
    showToast('⏳ جاري إنشاء كشف الحساب...', 'info');

    const response = await fetch(`elos-db://client-statement?id=${clientId}`);
    if (!response.ok) throw new Error('Failed to load');

    const data = await response.json();
    const sales = data.sales || [];
    const accessorySales = data.accessory_sales || [];
    const repairPartsSales = data.repair_parts_sales || [];
    const deferredTransfers = data.deferred_transfers || [];
    const payments = data.payments || [];
    const purchases = data.purchases || [];

    // دالة التنسيق
    const fmt = (n) => Number(n || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

    // ✅ FIX: دالة حساب مبلغ الإكسسوار/قطع الغيار بعد الخصم (نفس المنطق في clients.html)
    const calcItemAmount = (item) => {
      const unitPrice = item.unit_price || 0;
      const quantity = Math.abs(item.quantity || 1);
      const discount = item.discount || 0;
      const calculatedAmount = (unitPrice * quantity) - discount;
      const storedAmount = item.total_price || 0;
      const amountBeforeDiscount = unitPrice * quantity;
      return (Math.abs(storedAmount - amountBeforeDiscount) < 0.01) ? calculatedAmount : storedAmount;
    };

    // ✅ حساب الإجماليات (شامل المرتجعات - لأن قيودها ظاهرة في الكشف)
    const totalDeviceSales = sales.filter(s => s.status !== 'cancelled').reduce((sum, s) => sum + (s.sell_price - (s.discount || 0)), 0);
    const totalAccessorySales = accessorySales.reduce((sum, a) => sum + calcItemAmount(a), 0);
    const totalRepairPartsSales = repairPartsSales.reduce((sum, rp) => sum + calcItemAmount(rp), 0);
    const totalDeferredTransfers = deferredTransfers.reduce((sum, t) => sum + Number(t.total_debt || (t.transfer_amount || 0) + (t.commission || 0)), 0);
    const totalSales = totalDeviceSales + totalAccessorySales + totalRepairPartsSales + totalDeferredTransfers;

    const totalPaidNow = sales.filter(s => s.status !== 'cancelled').reduce((sum, s) => sum + (s.paid_now || 0), 0)
      + accessorySales.reduce((sum, a) => sum + (a.paid_amount || 0), 0)
      + repairPartsSales.reduce((sum, rp) => sum + (rp.paid_amount || 0), 0);
    const totalPayments = payments.reduce((sum, p) => sum + (p.amount || 0), 0);
    // ✅ حساب المرتجعات (صافي المبلغ اللي اتخصم = refund - paidNow)
    const totalReturns = sales.filter(s => s.status === 'returned').reduce((sum, s) => {
      const amount = (s.sell_price || 0) - (s.discount || 0);
      const refund = Number(s.refund_amount || amount);
      return sum + (refund - (s.paid_now || 0));
    }, 0) + repairPartsSales.filter(rp => (rp.status || 'completed') === 'returned').reduce((sum, rp) => {
      const amount = calcItemAmount(rp);
      const refund = Number(rp.refund_amount || amount);
      return sum + (refund - (rp.paid_amount || 0));
    }, 0);
    const totalPurchases = purchases.reduce((sum, p) => sum + (p.total_cost || 0), 0);
    const openingBalance = client.opening_balance || 0;
    const currentBalance = openingBalance + totalSales - totalPaidNow - totalPayments - totalReturns;

    // دمج المعاملات وترتيبها بالتاريخ
    // المشتريات تظهر كمعلومات فقط (debit=0, credit=0) لأنها عمليات مكتملة
    // ✅ FIX: البيع يظهر كسطرين (سطر البيع كمدين + سطر المدفوع مقدم كدائن)
    const transactions = [];

    // ✅ بيعات الأجهزة (المرتجع = سطر واحد فقط)
    sales.forEach(s => {
      if (s.status === 'cancelled') return;
      const sellPrice = s.sell_price || 0;
      const discount = s.discount || 0;
      const paidNow = s.paid_now || 0;
      const amount = sellPrice - discount;
      const desc = `بيع ${s.type || 'جهاز'} ${s.model || ''} ${s.storage || ''}`.trim();

      // ✅ المرتجع = إظهار البيعة الأصلية + المدفوع مقدم + سطر المرتجع
      if (s.status === 'returned') {
        const refundAmount = Number(s.refund_amount || amount);
        const netReturn = refundAmount - paidNow;

        // سطر البيع الأصلي (عليه)
        transactions.push({
          date: s.created_at,
          type: 'sale',
          description: `${desc} (مرتجع)`,
          debit: amount,
          credit: 0
        });

        // سطر المدفوع مقدم (دفع) لو فيه
        if (paidNow > 0) {
          transactions.push({
            date: s.created_at,
            type: 'payment',
            description: `مدفوع مقدم - ${desc}`,
            debit: 0,
            credit: paidNow
          });
        }

        // سطر المرتجع (دفع)
        if (netReturn > 0) {
          transactions.push({
            date: s.returned_at || s.created_at,
            type: 'return',
            description: `مرتجع - ${desc}`,
            debit: 0,
            credit: netReturn
          });
        }
        return;
      }

      // سطر البيع (عليه)
      transactions.push({
        date: s.created_at,
        type: 'sale',
        description: desc,
        debit: amount,
        credit: 0
      });

      // سطر المدفوع مقدم (ليه)
      if (paidNow > 0) {
        transactions.push({
          date: s.created_at,
          type: 'payment',
          description: `مدفوع مقدم - ${desc}`,
          debit: 0,
          credit: paidNow
        });
      }
    });

    // ✅ FIX: بيعات الإكسسوارات
    accessorySales.forEach(a => {
      const accessoryName = a.accessory_name || a.name || 'إكسسوار';
      const quantity = Math.abs(a.quantity || 1);
      const amount = calcItemAmount(a);
      const paidNow = a.paid_amount || 0;
      const desc = quantity > 1 ? `بيع ${accessoryName} (${quantity} قطعة)` : `بيع ${accessoryName}`;

      transactions.push({
        date: a.created_at,
        type: 'accessory_sale',
        description: desc,
        debit: amount,
        credit: 0
      });

      if (paidNow > 0) {
        transactions.push({
          date: a.created_at,
          type: 'payment',
          description: `مدفوع مقدم - ${desc}`,
          debit: 0,
          credit: paidNow
        });
      }
    });

    // ✅ FIX: بيعات قطع الغيار (المرتجع = بيع أصلي + مدفوع مقدم + مرتجع)
    repairPartsSales.forEach(rp => {
      const partName = rp.part_name || 'قطعة غيار';
      const quantity = Math.abs(rp.quantity || 1);
      const amount = calcItemAmount(rp);
      const paidNow = rp.paid_amount || 0;
      const desc = quantity > 1 ? `بيع ${partName} (${quantity} قطعة)` : `بيع ${partName}`;

      // ✅ المرتجع = إظهار البيعة الأصلية + المدفوع مقدم + سطر المرتجع
      if ((rp.status || 'completed') === 'returned') {
        const refundAmount = Number(rp.refund_amount || amount);
        const netReturn = refundAmount - paidNow;

        // سطر البيع الأصلي (عليه)
        transactions.push({
          date: rp.created_at,
          type: 'repair_part_sale',
          description: `${desc} (مرتجع)`,
          debit: amount,
          credit: 0
        });

        // سطر المدفوع مقدم (دفع) لو فيه
        if (paidNow > 0) {
          transactions.push({
            date: rp.created_at,
            type: 'payment',
            description: `مدفوع مقدم - ${desc}`,
            debit: 0,
            credit: paidNow
          });
        }

        // سطر المرتجع (دفع)
        if (netReturn > 0) {
          transactions.push({
            date: rp.returned_at || rp.created_at,
            type: 'return',
            description: `مرتجع - ${desc}`,
            debit: 0,
            credit: netReturn
          });
        }
        return;
      }

      // سطر البيع (عليه)
      transactions.push({
        date: rp.created_at,
        type: 'repair_part_sale',
        description: desc,
        debit: amount,
        credit: 0
      });

      // سطر المدفوع مقدم (ليه)
      if (paidNow > 0) {
        transactions.push({
          date: rp.created_at,
          type: 'payment',
          description: `مدفوع مقدم - ${desc}`,
          debit: 0,
          credit: paidNow
        });
      }
    });

    // تحويلات آجلة (مدين = مبلغ + عمولة)
    const transferTypeNames = { vodafone_cash: 'فودافون كاش', etisalat_cash: 'اتصالات كاش', orange_cash: 'اورنج كاش', we_pay: 'وي باي', instapay: 'انستاباي', other: 'أخرى' };
    deferredTransfers.forEach(mt => {
      const totalDebt = Number(mt.transfer_amount || 0) + Number(mt.commission || 0);
      const typeName = transferTypeNames[mt.transfer_type] || mt.transfer_type || 'تحويل';
      transactions.push({
        date: mt.created_at,
        type: 'deferred_transfer',
        description: `تحويل آجل - ${typeName} (مبلغ ${fmt(mt.transfer_amount || 0)} + عمولة ${fmt(mt.commission || 0)})`,
        debit: totalDebt,
        credit: 0
      });
    });

    payments.forEach(p => {
      transactions.push({
        date: p.created_at,
        type: 'payment',
        description: p.note || 'تحصيل دفعة',
        debit: 0,
        credit: p.amount
      });
    });

    purchases.forEach(p => {
      transactions.push({
        date: p.created_at,
        type: 'purchase',
        description: `شراء منه: ${p.type || 'جهاز'} ${p.model || ''} ${p.storage || ''} (${fmt(p.total_cost)} ج.م - مدفوع)`.trim(),
        debit: 0,
        credit: 0,  // لا تؤثر على الرصيد - الفلوس اتدفعت
        isPurchase: true  // علامة للتمييز
      });
    });

    transactions.sort((a, b) => new Date(a.date) - new Date(b.date));

    // إضافة صف الرصيد الافتتاحي في البداية إذا كان موجوداً
    if (openingBalance !== 0) {
      transactions.unshift({
        date: client.created_at || new Date().toISOString(),
        type: 'opening',
        description: 'رصيد افتتاحي',
        debit: openingBalance > 0 ? openingBalance : 0,
        credit: openingBalance < 0 ? Math.abs(openingBalance) : 0
      });
    }

    // حساب الرصيد التراكمي
    let runningBalance = 0;
    transactions.forEach(tx => {
      runningBalance = runningBalance + tx.debit - tx.credit;
      tx.balance = runningBalance;
    });

    // تحميل المكتبات
    await loadPDFLibraries();

    const { jsPDF } = window.jspdf;
    const pdf = new jsPDF('p', 'mm', 'a4');
    const pageWidth = pdf.internal.pageSize.getWidth();
    const pageHeight = pdf.internal.pageSize.getHeight();
    const margin = 10;
    const contentWidth = pageWidth - (margin * 2);

    const summaryData = { totalSales, totalPaidNow, totalPayments, totalReturns, totalPurchases, currentBalance };

    // تقسيم المعاملات - 10 في كل صفحة
    const ROWS_PER_PAGE = 10;
    const totalPages = Math.max(1, Math.ceil(transactions.length / ROWS_PER_PAGE));

    for (let page = 0; page < totalPages; page++) {
      // الحصول على المعاملات الخاصة بهذه الصفحة
      const startIdx = page * ROWS_PER_PAGE;
      const pageTransactions = transactions.slice(startIdx, startIdx + ROWS_PER_PAGE);

      // إنشاء محتوى HTML لهذه الصفحة
      const printContent = generateClientStatementHTML(client, pageTransactions, summaryData, page + 1, totalPages, startIdx);

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
    const fileName = `كشف_حساب_${client.name.replace(/\s+/g, '_')}_${new Date().toISOString().slice(0,10)}.pdf`;
    pdf.save(fileName);

    showSuccess('تم حفظ كشف الحساب بنجاح');

  } catch (error) {
    Logger.error('Export PDF error:', error);
    showError('فشل إنشاء كشف الحساب: ' + error.message);
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

function generateClientStatementHTML(client, transactions, summary, currentPage = 1, totalPages = 1, startIdx = 0) {
  const settings = JSON.parse(localStorage.getItem('appSettings') || '{}');
  const companyName = settings.companyName || 'ElOs';
  const companyLogo = settings.companyLogo || null;
  const today = new Date().toLocaleDateString('ar-EG', {
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });

  const logoHTML = companyLogo
    ? `<img src="${companyLogo}" alt="Logo" style="width: 60px; height: 60px; object-fit: contain; border-radius: 10px;">`
    : `<div style="width: 60px; height: 60px; background: linear-gradient(135deg, #3b82f6, #2563eb); border-radius: 10px; display: flex; align-items: center; justify-content: center; color: white; font-size: 24px; font-weight: bold;">${companyName.charAt(0)}</div>`;

  // رقم الصفحة
  const pageInfo = totalPages > 1 ? `<span style="font-size: 12px; color: #666;">صفحة ${currentPage} من ${totalPages}</span>` : '';

  const fmt = (n) => Number(n || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  
  return `
    <!DOCTYPE html>
    <html lang="ar" dir="rtl">
    <head>
      <meta charset="UTF-8">
      <title>كشف حساب - ${client.name}</title>
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
          border-bottom: 3px solid #3b82f6;
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
          color: #3b82f6;
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
        .client-card {
          background: linear-gradient(135deg, #f8f9fa 0%, #e9ecef 100%);
          border-radius: 12px;
          padding: 20px;
          margin-bottom: 25px;
          border-right: 5px solid #3b82f6;
        }
        .client-card h3 {
          font-size: 20px;
          color: #333;
          margin-bottom: 10px;
          font-weight: 700;
        }
        .client-card .info-row {
          display: flex;
          gap: 40px;
          margin-top: 8px;
        }
        .client-card .info-item {
          display: flex;
          align-items: center;
          gap: 8px;
          font-size: 14px;
        }
        .client-card .info-item .label { color: #666; }
        .client-card .info-item .value { font-weight: 600; color: #333; }
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
        .summary-card.sales { border-top: 4px solid #ef4444; }
        .summary-card.payment { border-top: 4px solid #10b981; }
        .summary-card.balance { border-top: 4px solid #3b82f6; }
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
        .summary-card.sales .value { color: #ef4444; }
        .summary-card.payment .value { color: #10b981; }
        .summary-card.balance .value { color: #3b82f6; }
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
          font-size: 12px;
        }
        th {
          background: #3b82f6;
          color: white;
          padding: 12px 10px;
          text-align: center;
          font-weight: 700;
          font-size: 11px;
        }
        th:first-child { border-radius: 0 8px 0 0; }
        th:last-child { border-radius: 8px 0 0 0; }
        td {
          padding: 10px;
          border-bottom: 1px solid #eee;
          text-align: center;
        }
        tr:nth-child(even) { background: #f8f9fa; }
        .type-badge {
          display: inline-block;
          padding: 4px 10px;
          border-radius: 20px;
          font-size: 10px;
          font-weight: 700;
        }
        .type-badge.sale { background: #fee2e2; color: #ef4444; }
        .type-badge.payment { background: #d1fae5; color: #10b981; }
        .type-badge.purchase { background: #fef3c7; color: #f59e0b; }
        .type-badge.opening { background: #e0e7ff; color: #4f46e5; }
        .type-badge.deferred_transfer { background: #fce7f3; color: #be185d; }
        .type-badge.accessory_sale, .type-badge.repair_part_sale { background: #e0f2fe; color: #0369a1; }
        .type-badge.return { background: #fef3c7; color: #d97706; }
        .amount { font-weight: 700; font-size: 12px; }
        .amount.debit { color: #ef4444; }
        .amount.credit { color: #10b981; }
        .amount.balance { color: #3b82f6; }
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
        .header, .client-card, .summary-cards {
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
          <h2>📋 كشف حساب عميل</h2>
          <p>تاريخ الإصدار: ${today}</p>
          ${pageInfo}
        </div>
      </div>

      <div class="client-card">
        <h3>👤 ${client.name}</h3>
        <div class="info-row">
          <div class="info-item">
            <span class="label">📞 الهاتف:</span>
            <span class="value">${client.phone || 'غير محدد'}</span>
          </div>
          <div class="info-item">
            <span class="label">📍 العنوان:</span>
            <span class="value">${client.address || 'غير محدد'}</span>
          </div>
        </div>
      </div>
      
      <div class="summary-cards">
        <div class="summary-card sales">
          <div class="label">إجمالي المبيعات</div>
          <div class="value">${fmt(summary.totalSales)} ج.م</div>
        </div>
        <div class="summary-card payment">
          <div class="label">إجمالي المدفوعات</div>
          <div class="value">${fmt(summary.totalPaidNow + summary.totalPayments)} ج.م</div>
        </div>
        ${(summary.totalReturns || 0) > 0 ? `
        <div class="summary-card" style="border-top: 4px solid #f59e0b;">
          <div class="label">إجمالي المرتجعات</div>
          <div class="value" style="color: #f59e0b;">${fmt(summary.totalReturns)} ج.م</div>
        </div>
        ` : ''}
        ${(summary.totalPurchases || 0) > 0 ? `
        <div class="summary-card" style="background: linear-gradient(135deg, #fef3c7 0%, #fcd34d 100%);">
          <div class="label">مشتريات منه</div>
          <div class="value">${fmt(summary.totalPurchases)} ج.م</div>
        </div>
        ` : ''}
        <div class="summary-card balance">
          <div class="label">الرصيد المستحق</div>
          <div class="value" style="color: ${summary.currentBalance < 0 ? '#10b981' : summary.currentBalance > 0 ? '#ef4444' : '#3b82f6'};">${summary.currentBalance < 0 ? '-' : ''}${fmt(Math.abs(summary.currentBalance))} ج.م</div>
        </div>
      </div>
      
      <div class="section-title">📋 تفاصيل المعاملات</div>
      <table>
        <thead>
          <tr>
            <th style="width: 40px;">#</th>
            <th style="width: 90px;">التاريخ</th>
            <th style="width: 70px;">النوع</th>
            <th>البيان</th>
            <th style="width: 90px;">عليه</th>
            <th style="width: 90px;">دفع</th>
            <th style="width: 100px;">الرصيد</th>
          </tr>
        </thead>
        <tbody>
          ${transactions.length === 0 ? `
            <tr>
              <td colspan="7" style="text-align: center; padding: 30px; color: #999;">
                لا توجد معاملات مسجلة
              </td>
            </tr>
          ` : transactions.map((tx, i) => {
            const dateStr = new Date(tx.date).toLocaleDateString('ar-EG');
            const typeLabels = { opening: 'رصيد افتتاحي', sale: 'بيع', payment: 'تحصيل', purchase: 'شراء منه', deferred_transfer: 'تحويل آجل', accessory_sale: 'إكسسوار', repair_part_sale: 'قطع غيار', return: 'مرتجع' };
            const typeClass = typeLabels[tx.type] ? tx.type : 'payment';
            const typeText = typeLabels[tx.type] || 'تحصيل';

            return `
              <tr>
                <td style="font-weight: 600; color: #999;">${startIdx + i + 1}</td>
                <td>${dateStr}</td>
                <td><span class="type-badge ${typeClass}">${typeText}</span></td>
                <td style="text-align: right; padding-right: 15px;">${tx.description}</td>
                <td class="amount debit">${tx.debit > 0 ? fmt(tx.debit) : '-'}</td>
                <td class="amount credit">${tx.credit > 0 ? fmt(tx.credit) : '-'}</td>
                <td class="amount balance">${fmt(tx.balance)}</td>
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

// ═══════════════════════════════════════
// 📱 إرسال كشف حساب واتساب
// ═══════════════════════════════════════
async function shareClientWhatsApp(clientId) {
  const client = clients.find(c => c.id === clientId) || window.currentStatementClient;
  if (!client) {
    showError('العميل غير موجود');
    return;
  }
  
  try {
    const response = await fetch(`elos-db://client-statement?id=${clientId}`);
    if (!response.ok) throw new Error('Failed to load');

    const data = await response.json();
    const sales = data.sales || [];
    const accessorySales = data.accessory_sales || [];
    const repairPartsSales = data.repair_parts_sales || [];
    const deferredTransfers = data.deferred_transfers || [];
    const payments = data.payments || [];
    const purchases = data.purchases || [];

    // ✅ FIX: دالة حساب مبلغ الإكسسوار/قطع الغيار بعد الخصم
    const calcItemAmount = (item) => {
      const unitPrice = item.unit_price || 0;
      const quantity = Math.abs(item.quantity || 1);
      const discount = item.discount || 0;
      const calculatedAmount = (unitPrice * quantity) - discount;
      const storedAmount = item.total_price || 0;
      const amountBeforeDiscount = unitPrice * quantity;
      return (Math.abs(storedAmount - amountBeforeDiscount) < 0.01) ? calculatedAmount : storedAmount;
    };

    // حساب الإجماليات - ✅ FIX: بدون المرتجعات
    const totalDeviceSales = sales.filter(s => s.status !== 'returned' && s.status !== 'cancelled').reduce((sum, s) => sum + (s.sell_price - (s.discount || 0)), 0);
    const totalAccessorySales = accessorySales.reduce((sum, a) => sum + calcItemAmount(a), 0);
    const totalRepairPartsSales = repairPartsSales.filter(rp => (rp.status || 'completed') !== 'returned').reduce((sum, rp) => sum + calcItemAmount(rp), 0);
    const totalDeferredTransfers = deferredTransfers.reduce((sum, t) => sum + Number(t.total_debt || (t.transfer_amount || 0) + (t.commission || 0)), 0);
    const totalSales = totalDeviceSales + totalAccessorySales + totalRepairPartsSales + totalDeferredTransfers;

    const totalPaidNow = sales.filter(s => s.status !== 'returned' && s.status !== 'cancelled').reduce((sum, s) => sum + (s.paid_now || 0), 0)
      + accessorySales.reduce((sum, a) => sum + (a.paid_amount || 0), 0)
      + repairPartsSales.filter(rp => (rp.status || 'completed') !== 'returned').reduce((sum, rp) => sum + (rp.paid_amount || 0), 0);
    const totalPayments = payments.reduce((sum, p) => sum + (p.amount || 0), 0);
    const totalReturns = sales.filter(s => s.status === 'returned').reduce((sum, s) => {
      const amount = (s.sell_price || 0) - (s.discount || 0);
      const refund = Number(s.refund_amount || amount);
      return sum + (refund - (s.paid_now || 0));
    }, 0) + repairPartsSales.filter(rp => (rp.status || 'completed') === 'returned').reduce((sum, rp) => {
      const amount = calcItemAmount(rp);
      const refund = Number(rp.refund_amount || amount);
      return sum + (refund - (rp.paid_amount || 0));
    }, 0);
    const totalPurchases = purchases.reduce((sum, p) => sum + (p.total_cost || 0), 0);
    const openingBalance = client.opening_balance || 0;
    const currentBalance = openingBalance + totalSales - totalPaidNow - totalPayments - totalReturns;

    const fmt = (n) => Number(n || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    const companyName = JSON.parse(localStorage.getItem('appSettings') || '{}').companyName || 'ElOs';

    // إنشاء نص الرسالة
    let openingBalanceLine = '';
    if (openingBalance > 0) {
      openingBalanceLine = `│ 📋 رصيد افتتاحي: ${fmt(openingBalance)} ج.م\n`;
    }
    let purchasesLine = '';
    if (totalPurchases > 0) {
      purchasesLine = `│ 📥 مشتريات منه: ${fmt(totalPurchases)} ج.م (مدفوع)\n`;
    }

    const message = `
📋 *كشف حساب*
━━━━━━━━━━━━━━━
🏢 *${companyName}*
━━━━━━━━━━━━━━━

👤 *العميل:* ${client.name}
📞 *الهاتف:* ${client.phone || '-'}

📊 *ملخص الحساب:*
┌─────────────────┐
${openingBalanceLine}│ 🛒 مبيعات له: ${fmt(totalSales)} ج.م
│ 💰 مدفوعات منه: ${fmt(totalPaidNow + totalPayments)} ج.م
${totalReturns > 0 ? `│ 🔄 مرتجعات: ${fmt(totalReturns)} ج.م\n` : ''}${purchasesLine}│ ━━━━━━━━━━━━━━━
│ 💳 *المستحق: ${fmt(currentBalance)} ج.م*
└─────────────────┘

📅 تاريخ: ${new Date().toLocaleDateString('ar-EG')}

_شكراً لتعاملكم معنا_ 🙏
    `.trim();
    
    // فتح واتساب
    const phone = client.phone ? client.phone.replace(/[^0-9]/g, '') : '';
    const whatsappUrl = phone 
      ? `https://wa.me/${phone.startsWith('0') ? '2' + phone : phone}?text=${encodeURIComponent(message)}`
      : `https://wa.me/?text=${encodeURIComponent(message)}`;
    
    window.open(whatsappUrl, '_blank');
    showSuccess('تم فتح واتساب');
    
  } catch (error) {
    Logger.error('WhatsApp error:', error);
    showError('فشل إرسال الرسالة');
  }
}

// ═══════════════════════════════════════
// 🖨️ طباعة كشف الحساب
// ═══════════════════════════════════════
async function printClientStatement(clientId) {
  const client = clients.find(c => c.id === clientId) || window.currentStatementClient;
  if (!client) {
    showError('العميل غير موجود');
    return;
  }

  try {
    const response = await fetch(`elos-db://client-statement?id=${clientId}`);
    if (!response.ok) throw new Error('Failed to load');

    const data = await response.json();
    const sales = data.sales || [];
    const accessorySales = data.accessory_sales || [];
    const repairPartsSales = data.repair_parts_sales || [];
    const deferredTransfers = data.deferred_transfers || [];
    const payments = data.payments || [];
    const purchases = data.purchases || [];

    const fmt = (n) => Number(n || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

    // ✅ FIX: دالة حساب مبلغ الإكسسوار/قطع الغيار بعد الخصم
    const calcItemAmount = (item) => {
      const unitPrice = item.unit_price || 0;
      const quantity = Math.abs(item.quantity || 1);
      const discount = item.discount || 0;
      const calculatedAmount = (unitPrice * quantity) - discount;
      const storedAmount = item.total_price || 0;
      const amountBeforeDiscount = unitPrice * quantity;
      return (Math.abs(storedAmount - amountBeforeDiscount) < 0.01) ? calculatedAmount : storedAmount;
    };

    // حساب الإجماليات (بدون المرتجعات)
    const totalDeviceSales = sales.filter(s => s.status !== 'returned' && s.status !== 'cancelled').reduce((sum, s) => sum + (s.sell_price - (s.discount || 0)), 0);
    const totalAccessorySales = accessorySales.reduce((sum, a) => sum + calcItemAmount(a), 0);
    const totalRepairPartsSales = repairPartsSales.filter(rp => (rp.status || 'completed') !== 'returned').reduce((sum, rp) => sum + calcItemAmount(rp), 0);
    const totalDeferredTransfers = deferredTransfers.reduce((sum, t) => sum + Number(t.total_debt || (t.transfer_amount || 0) + (t.commission || 0)), 0);
    const totalSales = totalDeviceSales + totalAccessorySales + totalRepairPartsSales + totalDeferredTransfers;

    const totalPaidNow = sales.filter(s => s.status !== 'returned' && s.status !== 'cancelled').reduce((sum, s) => sum + (s.paid_now || 0), 0)
      + accessorySales.reduce((sum, a) => sum + (a.paid_amount || 0), 0)
      + repairPartsSales.filter(rp => (rp.status || 'completed') !== 'returned').reduce((sum, rp) => sum + (rp.paid_amount || 0), 0);
    const totalPayments = payments.reduce((sum, p) => sum + (p.amount || 0), 0);
    const totalReturns = sales.filter(s => s.status === 'returned').reduce((sum, s) => {
      const amount = (s.sell_price || 0) - (s.discount || 0);
      const refund = Number(s.refund_amount || amount);
      return sum + (refund - (s.paid_now || 0));
    }, 0) + repairPartsSales.filter(rp => (rp.status || 'completed') === 'returned').reduce((sum, rp) => {
      const amount = calcItemAmount(rp);
      const refund = Number(rp.refund_amount || amount);
      return sum + (refund - (rp.paid_amount || 0));
    }, 0);
    const totalPurchases = purchases.reduce((sum, p) => sum + (p.total_cost || 0), 0);
    const openingBalance = client.opening_balance || 0;
    const currentBalance = openingBalance + totalSales - totalPaidNow - totalPayments - totalReturns;

    // دمج المعاملات وترتيبها بالتاريخ
    // ✅ FIX: البيع يظهر كسطرين (سطر البيع كمدين + سطر المدفوع مقدم كدائن)
    const transactions = [];

    // ✅ بيعات الأجهزة (المرتجع = بيع أصلي + مدفوع مقدم + مرتجع)
    sales.forEach(s => {
      if (s.status === 'cancelled') return;
      const sellPrice = s.sell_price || 0;
      const discount = s.discount || 0;
      const paidNow = s.paid_now || 0;
      const amount = sellPrice - discount;
      const desc = `بيع ${s.type || 'جهاز'} ${s.model || ''} ${s.storage || ''}`.trim();

      // ✅ المرتجع = إظهار البيعة الأصلية + المدفوع مقدم + سطر المرتجع
      if (s.status === 'returned') {
        const refundAmount = Number(s.refund_amount || amount);
        const netReturn = refundAmount - paidNow;

        // سطر البيع الأصلي (عليه)
        transactions.push({
          date: s.created_at,
          type: 'sale',
          description: `${desc} (مرتجع)`,
          debit: amount,
          credit: 0
        });

        // سطر المدفوع مقدم (دفع) لو فيه
        if (paidNow > 0) {
          transactions.push({
            date: s.created_at,
            type: 'payment',
            description: `مدفوع مقدم - ${desc}`,
            debit: 0,
            credit: paidNow
          });
        }

        // سطر المرتجع (دفع)
        if (netReturn > 0) {
          transactions.push({
            date: s.returned_at || s.created_at,
            type: 'return',
            description: `مرتجع - ${desc}`,
            debit: 0,
            credit: netReturn
          });
        }
        return;
      }

      // سطر البيع (عليه)
      transactions.push({
        date: s.created_at,
        type: 'sale',
        description: desc,
        debit: amount,
        credit: 0
      });

      // سطر المدفوع مقدم (ليه)
      if (paidNow > 0) {
        transactions.push({
          date: s.created_at,
          type: 'payment',
          description: `مدفوع مقدم - ${desc}`,
          debit: 0,
          credit: paidNow
        });
      }
    });

    // ✅ FIX: بيعات الإكسسوارات
    accessorySales.forEach(a => {
      const accessoryName = a.accessory_name || a.name || 'إكسسوار';
      const quantity = Math.abs(a.quantity || 1);
      const amount = calcItemAmount(a);
      const paidNow = a.paid_amount || 0;
      const desc = quantity > 1 ? `بيع ${accessoryName} (${quantity} قطعة)` : `بيع ${accessoryName}`;

      transactions.push({
        date: a.created_at,
        type: 'accessory_sale',
        description: desc,
        debit: amount,
        credit: 0
      });

      if (paidNow > 0) {
        transactions.push({
          date: a.created_at,
          type: 'payment',
          description: `مدفوع مقدم - ${desc}`,
          debit: 0,
          credit: paidNow
        });
      }
    });

    // ✅ FIX: بيعات قطع الغيار (المرتجع = بيع أصلي + مدفوع مقدم + مرتجع)
    repairPartsSales.forEach(rp => {
      const partName = rp.part_name || 'قطعة غيار';
      const quantity = Math.abs(rp.quantity || 1);
      const amount = calcItemAmount(rp);
      const paidNow = rp.paid_amount || 0;
      const desc = quantity > 1 ? `بيع ${partName} (${quantity} قطعة)` : `بيع ${partName}`;

      // ✅ المرتجع = إظهار البيعة الأصلية + المدفوع مقدم + سطر المرتجع
      if ((rp.status || 'completed') === 'returned') {
        const refundAmount = Number(rp.refund_amount || amount);
        const netReturn = refundAmount - paidNow;

        // سطر البيع الأصلي (عليه)
        transactions.push({
          date: rp.created_at,
          type: 'repair_part_sale',
          description: `${desc} (مرتجع)`,
          debit: amount,
          credit: 0
        });

        // سطر المدفوع مقدم (دفع) لو فيه
        if (paidNow > 0) {
          transactions.push({
            date: rp.created_at,
            type: 'payment',
            description: `مدفوع مقدم - ${desc}`,
            debit: 0,
            credit: paidNow
          });
        }

        // سطر المرتجع (دفع)
        if (netReturn > 0) {
          transactions.push({
            date: rp.returned_at || rp.created_at,
            type: 'return',
            description: `مرتجع - ${desc}`,
            debit: 0,
            credit: netReturn
          });
        }
        return;
      }

      // سطر البيع (عليه)
      transactions.push({
        date: rp.created_at,
        type: 'repair_part_sale',
        description: desc,
        debit: amount,
        credit: 0
      });

      // سطر المدفوع مقدم (ليه)
      if (paidNow > 0) {
        transactions.push({
          date: rp.created_at,
          type: 'payment',
          description: `مدفوع مقدم - ${desc}`,
          debit: 0,
          credit: paidNow
        });
      }
    });

    // تحويلات آجلة (مدين = مبلغ + عمولة)
    const transferTypeNames = { vodafone_cash: 'فودافون كاش', etisalat_cash: 'اتصالات كاش', orange_cash: 'اورنج كاش', we_pay: 'وي باي', instapay: 'انستاباي', other: 'أخرى' };
    deferredTransfers.forEach(mt => {
      const totalDebt = Number(mt.transfer_amount || 0) + Number(mt.commission || 0);
      const typeName = transferTypeNames[mt.transfer_type] || mt.transfer_type || 'تحويل';
      transactions.push({
        date: mt.created_at,
        type: 'deferred_transfer',
        description: `تحويل آجل - ${typeName} (مبلغ ${fmt(mt.transfer_amount || 0)} + عمولة ${fmt(mt.commission || 0)})`,
        debit: totalDebt,
        credit: 0
      });
    });

    payments.forEach(p => {
      transactions.push({
        date: p.created_at,
        type: 'payment',
        description: p.note || 'تحصيل دفعة',
        debit: 0,
        credit: p.amount
      });
    });

    purchases.forEach(p => {
      transactions.push({
        date: p.created_at,
        type: 'purchase',
        description: `شراء منه: ${p.type || 'جهاز'} ${p.model || ''} ${p.storage || ''} (${fmt(p.total_cost)} ج.م - مدفوع)`.trim(),
        debit: 0,
        credit: 0,
        isPurchase: true
      });
    });

    transactions.sort((a, b) => new Date(a.date) - new Date(b.date));

    // إضافة صف الرصيد الافتتاحي في البداية إذا كان موجوداً
    if (openingBalance !== 0) {
      transactions.unshift({
        date: client.created_at || new Date().toISOString(),
        type: 'opening',
        description: 'رصيد افتتاحي',
        debit: openingBalance > 0 ? openingBalance : 0,
        credit: openingBalance < 0 ? Math.abs(openingBalance) : 0
      });
    }

    // حساب الرصيد التراكمي
    let runningBalance = 0;
    transactions.forEach(tx => {
      runningBalance = runningBalance + tx.debit - tx.credit;
      tx.balance = runningBalance;
    });

    // إنشاء محتوى HTML للطباعة
    const printContent = generateClientStatementHTML(client, transactions, {
      totalSales,
      totalPaidNow,
      totalPayments,
      totalReturns,
      totalPurchases,
      currentBalance
    });

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
    showError('فشل الطباعة');
  }
}

// ═══════════════════════════════════════════════════════════════
// 📊 EXPORT CLIENTS TO CSV
// ═══════════════════════════════════════════════════════════════
async function exportClientsToCSV() {
  try {
    showToast('📊 جاري تصدير بيانات العملاء...', 'info');

    // جلب كل العملاء
    const response = await fetch('elos-db://clients');
    const allClients = await response.json();

    if (!allClients || allClients.length === 0) {
      showToast('⚠️ لا توجد بيانات للتصدير', 'warning');
      return;
    }

    // إنشاء محتوى CSV
    const headers = ['الاسم', 'الهاتف', 'العنوان', 'الرصيد الافتتاحي', 'حد الائتمان', 'التصنيف', 'ملاحظات'];
    let csv = headers.join(',') + '\n';

    allClients.forEach(client => {
      // تصدير الرصيد الحالي (كشف الحساب) ليكون رصيداً افتتاحياً عند الاستيراد على جهاز آخر
      const balanceToExport = client.balance ?? client.opening_balance ?? 0;
      const row = [
        `"${(client.name || '').replace(/"/g, '""')}"`,
        `"${(client.phone || '').replace(/"/g, '""')}"`,
        `"${(client.address || '').replace(/"/g, '""')}"`,
        balanceToExport,
        client.credit_limit || 0,
        `"${client.category || 'regular'}"`,
        `"${(client.notes || '').replace(/"/g, '""')}"`
      ];
      csv += row.join(',') + '\n';
    });

    // إنشاء رابط التحميل
    const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `العملاء_${new Date().toISOString().split('T')[0]}.csv`;
    link.click();

    showToast(`✅ تم تصدير ${allClients.length} عميل بنجاح`, 'success');

  } catch (error) {
    Logger.error('[EXPORT] Failed:', error);
    showToast('❌ فشل التصدير', 'error');
  }
}

// ═══════════════════════════════════════════════════════════════
// 📥 IMPORT CLIENTS FROM CSV
// ═══════════════════════════════════════════════════════════════
let clientImportData = [];
let clientImportMode = 'add'; // 'add' أو 'update'

function openClientsImportModal() {
  // إنشاء modal الاستيراد إذا لم يكن موجوداً
  let modal = document.getElementById('clientsImportModal');
  if (!modal) {
    modal = document.createElement('div');
    modal.id = 'clientsImportModal';
    modal.className = 'modal';
    modal.innerHTML = `
      <div class="modal-content" style="max-width: 800px;">
        <div class="modal-header">
          <h2 class="modal-title"><span>📥</span> استيراد العملاء</h2>
          <button class="modal-close" onclick="closeClientsImportModal()">✕</button>
        </div>
        <div class="modal-body" style="padding: 20px;">
          <!-- منطقة السحب والإفلات -->
          <div id="clientsImportDropZone" style="border: 2px dashed var(--border); border-radius: 12px; padding: 30px 20px; text-align: center; cursor: pointer; transition: all 0.3s;" onclick="document.getElementById('clientsImportFileInput').click()">
            <div style="font-size: 48px; margin-bottom: 15px;">📄</div>
            <p style="color: var(--text-secondary); margin-bottom: 10px;">اسحب ملف CSV هنا أو اضغط للاختيار</p>
            <p style="font-size: 12px; color: var(--text-muted);">الأعمدة: الاسم، الهاتف، العنوان، الرصيد الافتتاحي، حد الائتمان، التصنيف، ملاحظات</p>
          </div>
          <input type="file" id="clientsImportFileInput" accept=".csv" style="display: none;" onchange="handleClientsImportFile(event)">

          <!-- معلومات الملف -->
          <div id="clientsImportFileInfo" style="display: none; margin-top: 15px; padding: 12px; background: var(--bg-tertiary); border-radius: 8px;">
            <div style="display: flex; align-items: center; justify-content: space-between;">
              <div style="display: flex; align-items: center; gap: 10px;">
                <span style="font-size: 24px;">📄</span>
                <div>
                  <div id="clientsImportFileName" style="font-weight: 600;"></div>
                  <div id="clientsImportFileCount" style="font-size: 12px; color: var(--text-secondary);"></div>
                </div>
              </div>
              <button class="btn btn-ghost" style="padding: 6px 12px; font-size: 12px;" onclick="document.getElementById('clientsImportFileInput').click()">
                🔄 تغيير الملف
              </button>
            </div>
          </div>

          <!-- وضع الاستيراد -->
          <div id="clientsImportModeSection" style="display: none; margin-top: 15px; padding: 15px; background: var(--bg-tertiary); border-radius: 8px;">
            <label style="font-weight: 600; margin-bottom: 10px; display: block;">⚙️ وضع الاستيراد:</label>
            <div style="display: flex; gap: 15px; flex-wrap: wrap;">
              <label style="display: flex; align-items: center; gap: 8px; cursor: pointer; padding: 10px 15px; background: var(--bg-secondary); border-radius: 8px; border: 2px solid var(--border); transition: all 0.3s;" id="importModeAdd">
                <input type="radio" name="clientImportMode" value="add" checked onchange="setClientImportMode('add')" style="accent-color: var(--primary);">
                <div>
                  <div style="font-weight: 600;">➕ إضافة جديد فقط</div>
                  <div style="font-size: 11px; color: var(--text-secondary);">تجاهل العملاء الموجودين</div>
                </div>
              </label>
              <label style="display: flex; align-items: center; gap: 8px; cursor: pointer; padding: 10px 15px; background: var(--bg-secondary); border-radius: 8px; border: 2px solid var(--border); transition: all 0.3s;" id="importModeUpdate">
                <input type="radio" name="clientImportMode" value="update" onchange="setClientImportMode('update')" style="accent-color: var(--warning);">
                <div>
                  <div style="font-weight: 600;">🔄 تحديث الموجودين</div>
                  <div style="font-size: 11px; color: var(--text-secondary);">تحديث بالهاتف + إضافة الجدد</div>
                </div>
              </label>
            </div>
          </div>

          <!-- معاينة البيانات -->
          <div id="clientsImportPreview" style="display: none; margin-top: 15px;">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px;">
              <label style="font-weight: 600;">👁️ معاينة البيانات:</label>
              <span id="clientsPreviewStats" style="font-size: 12px; color: var(--text-secondary);"></span>
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
                    <th style="padding: 8px; text-align: right; border-bottom: 1px solid var(--border);">التصنيف</th>
                  </tr>
                </thead>
                <tbody id="clientsPreviewTableBody"></tbody>
              </table>
            </div>
          </div>

          <!-- زر الاستيراد -->
          <button id="clientsImportBtn" class="btn btn-primary" style="width: 100%; margin-top: 20px; padding: 12px;" onclick="executeClientsImport()" disabled>
            📥 استيراد البيانات
          </button>

          <!-- ملاحظة النموذج -->
          <div style="margin-top: 15px; padding: 12px; background: rgba(59,130,246,0.1); border-radius: 8px;">
            <p style="font-size: 12px; color: var(--primary); margin: 0;">
              💡 <strong>ملاحظة:</strong> يمكنك تحميل
              <a href="#" onclick="downloadClientsTemplate(); return false;" style="color: var(--primary); text-decoration: underline;">نموذج CSV</a>
              للمساعدة في تنسيق البيانات
            </p>
          </div>
        </div>
      </div>
    `;
    document.body.appendChild(modal);
    setupClientsImportDragDrop();
  }

  clientImportData = [];
  clientImportMode = 'add';
  document.getElementById('clientsImportFileInput').value = '';
  document.getElementById('clientsImportFileInfo').style.display = 'none';
  document.getElementById('clientsImportModeSection').style.display = 'none';
  document.getElementById('clientsImportPreview').style.display = 'none';
  document.getElementById('clientsImportBtn').disabled = true;
  modal.classList.add('active');
}

function setClientImportMode(mode) {
  clientImportMode = mode;
  // تحديث تنسيق الأزرار
  const addBtn = document.getElementById('importModeAdd');
  const updateBtn = document.getElementById('importModeUpdate');
  if (mode === 'add') {
    addBtn.style.borderColor = 'var(--primary)';
    addBtn.style.background = 'rgba(59,130,246,0.1)';
    updateBtn.style.borderColor = 'var(--border)';
    updateBtn.style.background = 'var(--bg-secondary)';
  } else {
    updateBtn.style.borderColor = 'var(--warning)';
    updateBtn.style.background = 'rgba(245,158,11,0.1)';
    addBtn.style.borderColor = 'var(--border)';
    addBtn.style.background = 'var(--bg-secondary)';
  }
  // إعادة تحليل المعاينة
  if (clientImportData.length > 0) {
    renderClientsImportPreview();
  }
}
window.setClientImportMode = setClientImportMode;

function closeClientsImportModal() {
  const modal = document.getElementById('clientsImportModal');
  if (modal) modal.classList.remove('active');
  clientImportData = [];
}

function setupClientsImportDragDrop() {
  const dropZone = document.getElementById('clientsImportDropZone');
  if (!dropZone) return;

  dropZone.addEventListener('dragover', (e) => {
    e.preventDefault();
    dropZone.style.borderColor = 'var(--primary)';
    dropZone.style.background = 'rgba(59,130,246,0.1)';
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
      processClientsImportFile(file);
    } else {
      showToast('⚠️ يرجى اختيار ملف CSV', 'warning');
    }
  });
}

function handleClientsImportFile(event) {
  const file = event.target.files[0];
  if (!file) return;

  if (!file.name.endsWith('.csv')) {
    showToast('⚠️ يرجى اختيار ملف CSV', 'warning');
    return;
  }

  processClientsImportFile(file);
}

function processClientsImportFile(file) {
  const reader = new FileReader();
  reader.onload = async function(e) {
    const content = e.target.result;
    clientImportData = parseClientsCSV(content);

    document.getElementById('clientsImportFileName').textContent = file.name;
    document.getElementById('clientsImportFileCount').textContent = `${clientImportData.length} عميل`;
    document.getElementById('clientsImportFileInfo').style.display = 'block';

    if (clientImportData.length > 0) {
      // إظهار وضع الاستيراد والمعاينة
      document.getElementById('clientsImportModeSection').style.display = 'block';
      document.getElementById('clientsImportPreview').style.display = 'block';
      document.getElementById('clientsImportBtn').disabled = false;

      // رسم المعاينة
      await renderClientsImportPreview();

      showToast(`✅ تم قراءة ${clientImportData.length} عميل من الملف`, 'success');
    } else {
      document.getElementById('clientsImportModeSection').style.display = 'none';
      document.getElementById('clientsImportPreview').style.display = 'none';
      showToast('⚠️ الملف فارغ أو غير صالح', 'warning');
    }
  };
  reader.readAsText(file, 'UTF-8');
}

async function renderClientsImportPreview() {
  const tbody = document.getElementById('clientsPreviewTableBody');
  const statsEl = document.getElementById('clientsPreviewStats');

  // جلب العملاء الحاليين للمقارنة
  let existingClients = [];
  try {
    const response = await fetch('elos-db://clients');
    existingClients = await response.json();
  } catch (e) {}

  // إنشاء map للبحث السريع بالهاتف
  const existingByPhone = {};
  existingClients.forEach(c => {
    if (c.phone) existingByPhone[c.phone.trim()] = c;
  });

  let newCount = 0;
  let updateCount = 0;
  let skipCount = 0;

  let html = '';
  clientImportData.forEach((client, index) => {
    const existing = client.phone ? existingByPhone[client.phone.trim()] : null;
    let status, statusColor, statusIcon;

    if (existing) {
      if (clientImportMode === 'update') {
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

    // تمييز client لاستخدامه لاحقاً
    client._existing = existing;
    client._status = status;

    html += `
      <tr style="border-bottom: 1px solid var(--border); ${existing && clientImportMode === 'add' ? 'opacity: 0.5;' : ''}">
        <td style="padding: 8px;">
          <span style="display: inline-flex; align-items: center; gap: 4px; padding: 3px 8px; border-radius: 12px; font-size: 11px; background: ${statusColor}20; color: ${statusColor};">
            ${statusIcon} ${status}
          </span>
        </td>
        <td style="padding: 8px; font-weight: 600;">${escapeHtml(client.name || '-')}</td>
        <td style="padding: 8px; direction: ltr; font-family: monospace;">${escapeHtml(client.phone || '-')}</td>
        <td style="padding: 8px; max-width: 150px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${escapeHtml(client.address || '-')}</td>
        <td style="padding: 8px; font-family: monospace;">${client.opening_balance || 0}</td>
        <td style="padding: 8px;">${client.category || 'regular'}</td>
      </tr>
    `;
  });

  tbody.innerHTML = html;

  // تحديث الإحصائيات
  if (clientImportMode === 'add') {
    statsEl.innerHTML = `<span style="color: var(--success);">✨ ${newCount} جديد</span> | <span style="color: var(--text-secondary);">⏭️ ${skipCount} تجاهل</span>`;
  } else {
    statsEl.innerHTML = `<span style="color: var(--success);">✨ ${newCount} جديد</span> | <span style="color: var(--warning);">🔄 ${updateCount} تحديث</span>`;
  }
}

function parseClientsCSV(content) {
  const lines = content.split('\n').filter(line => line.trim());
  if (lines.length < 2) return [];

  // تجاهل السطر الأول (العناوين)
  const data = [];

  for (let i = 1; i < lines.length; i++) {
    const values = parseCSVLine(lines[i]);
    if (values.length >= 1 && values[0].trim()) {
      data.push({
        name: values[0]?.trim() || '',
        phone: values[1]?.trim() || '',
        address: values[2]?.trim() || '',
        opening_balance: parseFloat(values[3]) || 0,
        credit_limit: parseFloat(values[4]) || 0,
        category: values[5]?.trim() || 'regular',
        notes: values[6]?.trim() || ''
      });
    }
  }

  return data;
}

function parseCSVLine(line) {
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

async function executeClientsImport() {
  if (clientImportData.length === 0) {
    showToast('⚠️ لا توجد بيانات للاستيراد', 'warning');
    return;
  }

  const btn = document.getElementById('clientsImportBtn');
  btn.disabled = true;
  btn.textContent = 'جاري الاستيراد... 0%';

  let addedCount = 0;
  let updatedCount = 0;
  let skippedCount = 0;
  let errorCount = 0;

  for (let i = 0; i < clientImportData.length; i++) {
    const client = clientImportData[i];
    const existing = client._existing;

    try {
      if (existing) {
        // العميل موجود
        if (clientImportMode === 'update') {
          // تحديث العميل الموجود (بما في ذلك الرصيد الافتتاحي المستورد ليعكس الرصيد بعد النقل)
          const response = await fetch('elos-db://clients-update', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              id: existing.id,
              name: client.name || existing.name,
              phone: client.phone || existing.phone,
              address: client.address || existing.address,
              credit_limit: client.credit_limit || existing.credit_limit,
              category: client.category || existing.category,
              notes: client.notes || existing.notes,
              opening_balance: client.opening_balance ?? existing.opening_balance ?? 0
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
        // عميل جديد - إضافة
        const response = await fetch('elos-db://clients-add', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name: client.name,
            phone: client.phone,
            address: client.address,
            opening_balance: client.opening_balance || 0,
            credit_limit: client.credit_limit || 0,
            category: client.category || 'regular',
            notes: client.notes || ''
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
    const progress = Math.round(((i + 1) / clientImportData.length) * 100);
    btn.textContent = `جاري الاستيراد... ${progress}%`;
  }

  btn.textContent = '📥 استيراد البيانات';
  btn.disabled = false;

  // عرض النتائج
  let resultMsg = '';
  if (addedCount > 0) resultMsg += `✅ تم إضافة ${addedCount} عميل جديد. `;
  if (updatedCount > 0) resultMsg += `🔄 تم تحديث ${updatedCount} عميل. `;
  if (skippedCount > 0) resultMsg += `⏭️ تم تجاهل ${skippedCount} عميل موجود. `;
  if (errorCount > 0) resultMsg += `❌ فشل ${errorCount} عملية.`;

  if (addedCount > 0 || updatedCount > 0) {
    showToast(resultMsg.trim(), 'success');
    closeClientsImportModal();
    // تحديث قائمة العملاء
    if (typeof loadClients === 'function') loadClients();
  } else if (skippedCount > 0 && errorCount === 0) {
    showToast('⚠️ كل العملاء موجودين بالفعل', 'warning');
  } else {
    showToast(resultMsg.trim() || '❌ فشل الاستيراد', 'error');
  }
}

function downloadClientsTemplate() {
  const headers = ['الاسم', 'الهاتف', 'العنوان', 'الرصيد الافتتاحي', 'حد الائتمان', 'التصنيف', 'ملاحظات'];
  const sampleData = [
    ['أحمد محمد', '01012345678', 'القاهرة', '0', '5000', 'regular', 'عميل جديد'],
    ['محمد علي', '01098765432', 'الإسكندرية', '1000', '10000', 'vip', '']
  ];

  let csv = headers.join(',') + '\n';
  sampleData.forEach(row => {
    csv += row.map(v => `"${v}"`).join(',') + '\n';
  });

  const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = 'نموذج_استيراد_العملاء.csv';
  link.click();

  showToast('✅ تم تحميل النموذج', 'success');
}

// تصدير الدوال للاستخدام العام
window.exportClientsToCSV = exportClientsToCSV;
window.openClientsImportModal = openClientsImportModal;
window.closeClientsImportModal = closeClientsImportModal;
window.handleClientsImportFile = handleClientsImportFile;
window.executeClientsImport = executeClientsImport;
window.downloadClientsTemplate = downloadClientsTemplate;