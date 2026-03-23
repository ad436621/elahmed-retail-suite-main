// shared-header.js - Header مشترك لكل الصفحات

// Fallbacks if utils.js not loaded yet
if (!window.Logger) window.Logger = { log: () => {}, warn: () => {}, error: console.error, debug: () => {}, info: () => {} };
var Logger = window.Logger;

// ═════════════════════════════════════
// 🏢 Company Name & Logo Management
// ═════════════════════════════════════
let companyName = 'ELOS ACC SYSTEM'; // القيمة الافتراضية
let companyLogo = null; // اللوجو (base64 أو null)

// جلب اسم الشركة واللوجو من localStorage
async function loadCompanyName() {
  try {
    // جلب من localStorage
    const saved = localStorage.getItem('appSettings');

    if (saved) {
      const settings = JSON.parse(saved);

      if (settings.companyName || settings.company_name) {
        companyName = settings.companyName || settings.company_name;
      }
      if (settings.companyLogo || settings.company_logo) {
        companyLogo = settings.companyLogo || settings.company_logo;
      }
    }
  } catch (error) {
    Logger.warn('[HEADER] Failed to load company name/logo:', error);
    // استخدام القيمة الافتراضية
  }
}

// الاستماع لتغييرات localStorage (للتحديث اللايف)
window.addEventListener('storage', async (e) => {
  if (e.key === 'appSettings') {
    await loadCompanyName();
    updateHeader();
  }
});

// دالة للتحقق إذا النص عربي
function isArabic(text) {
  return /[\u0600-\u06FF]/.test(text);
}

// دالة تحديث الهيدر بدون إعادة تحميل الصفحة
function updateHeader() {
  const logoIcon = document.querySelector('.shared-header .logo-icon');
  const logoText = document.querySelector('.shared-header .logo-text');
  
  if (logoIcon) {
    if (companyLogo) {
      logoIcon.innerHTML = `<img src="${companyLogo}" alt="${companyName}" />`;
    } else {
      logoIcon.innerHTML = `<svg viewBox="0 0 48 48" fill="none">
        <rect x="4" y="28" width="8" height="16" rx="2" fill="#3b82f6"/>
        <rect x="16" y="18" width="8" height="26" rx="2" fill="#3b82f6"/>
        <rect x="28" y="8" width="8" height="36" rx="2" fill="#3b82f6"/>
        <path d="M8 20L20 12L32 6L44 2" stroke="#3b82f6" stroke-width="3" stroke-linecap="round"/>
        <path d="M38 2H44V8" stroke="#3b82f6" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/>
      </svg>`;
    }
  }
  
  if (logoText) {
    logoText.textContent = companyName;
    if (isArabic(companyName)) {
      logoText.classList.add('arabic-text');
    } else {
      logoText.classList.remove('arabic-text');
    }
  }
}

// إنشاء الـ Header
function createSharedHeader(pageTitle, pageIcon = '📄') {
  // الحصول على الصلاحيات
  const role = window.currentUser ? window.currentUser.role : 'viewer';
  const isAdmin = role === 'admin';
  
  // تحديد زر الرجوع حسب الصلاحية
  let backButton = '';
  if (role === 'admin') {
    backButton = `
      <a href="./index.html" class="back-btn" title="الرئيسية">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>
          <polyline points="9 22 9 12 15 12 15 22"/>
        </svg>
      </a>
    `;
  } else if (role === 'cashier') {
    // الكاشير يرجع لنقطة البيع
    const currentPage = window.location.pathname.split('/').pop();
    if (currentPage !== 'pos.html') {
      backButton = `
        <a href="./pos.html" class="back-btn" title="نقطة البيع">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <circle cx="9" cy="21" r="1"/>
            <circle cx="20" cy="21" r="1"/>
            <path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"/>
          </svg>
        </a>
      `;
    }
  } else if (role === 'viewer') {
    // المشاهد يرجع للمخزون
    const currentPage = window.location.pathname.split('/').pop();
    if (currentPage !== 'inventory.html') {
      backButton = `
        <a href="./inventory.html" class="back-btn" title="المخزون">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/>
          </svg>
        </a>
      `;
    }
  }

  // أزرار التنقل للكاشير
  let navButtons = '';
  if (role === 'cashier') {
    navButtons = `
      <div class="nav-buttons">
        <a href="./pos.html" class="nav-btn ${window.location.pathname.includes('pos.html') ? 'active' : ''}" title="نقطة البيع">
          🛒 نقطة البيع
        </a>
        <a href="./clients.html" class="nav-btn ${window.location.pathname.includes('clients.html') ? 'active' : ''}" title="العملاء">
          👥 العملاء
        </a>
        <a href="./inventory.html" class="nav-btn ${window.location.pathname.includes('inventory.html') ? 'active' : ''}" title="المخزون">
          📦 المخزون
        </a>
      </div>
    `;
  }

  const headerHTML = `
    <style>
      .shared-header {
        display: flex;
        align-items: center;
        gap: 16px;
        padding: 10px 24px;
        background: linear-gradient(135deg, var(--bg-secondary) 0%, var(--bg-tertiary) 100%);
        border-bottom: 1px solid var(--border);
        box-shadow: 0 2px 8px rgba(0,0,0,0.2);
        height: 65px;
      }
      .shared-header .logo-section {
        display: flex;
        align-items: center;
        gap: 10px;
      }
      .shared-header .logo-icon svg,
      .shared-header .logo-icon img {
        width: 36px;
        height: 36px;
      }
      .shared-header .logo-icon img {
        object-fit: contain;
        border-radius: 6px;
      }
      .shared-header .logo-text {
        font-size: 24px;
        font-weight: 700;
        color: #ffffff;
      }
      
      /* خط خاص للنصوص العربية */
      .shared-header .arabic-text {
        font-family: "Tajawal", "Cairo", "Dubai", "Segoe UI", system-ui, sans-serif !important;
        letter-spacing: 0 !important;
        font-weight: 700 !important;
      }
      .shared-header .page-title {
        font-weight: 900;
        font-size: 22px;
        background: linear-gradient(135deg, var(--accent) 0%, #a855f7 100%);
        -webkit-background-clip: text;
        -webkit-text-fill-color: transparent;
        background-clip: text;
        display: flex;
        align-items: center;
        gap: 8px;
        margin: 0 auto;
      }
      .shared-header .spacer {
        flex: 1;
      }
      .shared-header .back-btn {
        background: var(--bg-tertiary);
        border: 1px solid var(--border);
        border-radius: 8px;
        padding: 8px;
        color: var(--text-secondary);
        cursor: pointer;
        transition: all 0.3s ease;
        display: flex;
        align-items: center;
        text-decoration: none;
      }
      .shared-header .back-btn:hover {
        background: var(--accent);
        color: white;
        border-color: var(--accent);
      }
      .shared-header .nav-buttons {
        display: flex;
        gap: 8px;
      }
      .shared-header .nav-btn {
        background: var(--bg-tertiary);
        border: 1px solid var(--border);
        border-radius: 8px;
        padding: 6px 12px;
        color: var(--text-secondary);
        font-size: 12px;
        font-weight: 600;
        text-decoration: none;
        transition: all 0.3s ease;
      }
      .shared-header .nav-btn:hover,
      .shared-header .nav-btn.active {
        background: var(--accent);
        color: white;
        border-color: var(--accent);
      }
      .shared-header .user-controls {
        display: flex;
        align-items: center;
        gap: 12px;
      }
      .shared-header .header-btn {
        background: var(--bg-tertiary);
        border: 1px solid var(--border);
        border-radius: 8px;
        padding: 8px;
        color: var(--text-secondary);
        cursor: pointer;
        transition: all 0.3s ease;
        display: flex;
        align-items: center;
        justify-content: center;
      }
      .shared-header .header-btn:hover {
        background: var(--accent);
        color: white;
        border-color: var(--accent);
      }
      .shared-header .logout-btn:hover {
        background: var(--danger);
        border-color: var(--danger);
      }
      .shared-header .refresh-btn:hover {
        background: var(--success);
        border-color: var(--success);
      }
      .shared-header .refresh-btn.spinning svg {
        animation: spin 0.5s linear;
      }
      @keyframes spin {
        from { transform: rotate(0deg); }
        to { transform: rotate(360deg); }
      }
      .shared-header .user-display {
        display: flex;
        flex-direction: column;
        align-items: flex-end;
        gap: 2px;
        padding: 4px 12px;
        background: var(--bg-tertiary);
        border-radius: 8px;
        border: 1px solid var(--border);
      }
      .shared-header .user-name {
        font-size: 13px;
        font-weight: 600;
        color: var(--text-primary);
      }
      .shared-header .user-role {
        font-size: 10px;
        color: var(--accent);
        font-weight: 500;
      }
    </style>
    
    <header class="shared-header">
      ${backButton}
      
      <div class="logo-section">
        <div class="logo-icon">
          ${companyLogo ? 
            `<img src="${companyLogo}" alt="${companyName}" />` :
            `<svg viewBox="0 0 48 48" fill="none">
              <rect x="4" y="28" width="8" height="16" rx="2" fill="#3b82f6"/>
              <rect x="16" y="18" width="8" height="26" rx="2" fill="#3b82f6"/>
              <rect x="28" y="8" width="8" height="36" rx="2" fill="#3b82f6"/>
              <path d="M8 20L20 12L32 6L44 2" stroke="#3b82f6" stroke-width="3" stroke-linecap="round"/>
              <path d="M38 2H44V8" stroke="#3b82f6" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/>
            </svg>`
          }
        </div>
        <span class="logo-text${isArabic(companyName) ? ' arabic-text' : ''}">${companyName}</span>
      </div>
      
      <h1 class="page-title">
        <span>${pageIcon}</span>
        ${pageTitle}
      </h1>
      
      <div class="spacer"></div>
      
      ${navButtons}
      
      <div class="user-controls">
        <!-- زر تحديث الصفحة -->
        <button class="header-btn refresh-btn" onclick="refreshPage()" title="تحديث الصفحة">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M23 4v6h-6"/>
            <path d="M1 20v-6h6"/>
            <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/>
          </svg>
        </button>

        ${isAdmin ? `
          <button class="header-btn" onclick="window.location.href='users.html'" title="إدارة المستخدمين">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
              <circle cx="9" cy="7" r="4"/>
              <path d="M23 21v-2a4 4 0 0 0-3-3.87"/>
              <path d="M16 3.13a4 4 0 0 1 0 7.75"/>
            </svg>
          </button>
        ` : ''}
        
        <div class="user-display">
          <span class="user-name">${window.currentUser ? (window.currentUser.display_name || window.currentUser.username) : 'المستخدم'}</span>
          <span class="user-role">${window.currentUser ? (window.currentUser.role === 'admin' ? 'مدير' : window.currentUser.role === 'cashier' ? 'كاشير' : 'مشاهد') : '-'}</span>
        </div>
        
        <button class="header-btn logout-btn" onclick="logout()" title="تسجيل الخروج">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/>
            <polyline points="16 17 21 12 16 7"/>
            <line x1="21" y1="12" x2="9" y2="12"/>
          </svg>
        </button>
      </div>
    </header>
  `;

  return headerHTML;
}

// دالة logout
async function logout() {
  // ✅ استخدام showConfirm بدلاً من confirm
  const confirmed = await showConfirm('هل تريد تسجيل الخروج؟', 'خروج', 'بقاء', 'warning');
  if (confirmed) {
    Logger.log('logout-request');
  }
}

// دالة تحديث الصفحة
function refreshPage() {
  const btn = document.querySelector('.shared-header .refresh-btn');
  if (btn) {
    btn.classList.add('spinning');
    setTimeout(() => btn.classList.remove('spinning'), 500);
  }

  // تحديث البيانات بدون إعادة تحميل كاملة
  if (typeof loadData === 'function') {
    loadData();
  } else if (typeof init === 'function') {
    init();
  } else if (typeof loadInventory === 'function') {
    loadInventory();
  } else if (typeof loadSales === 'function') {
    loadSales();
  } else if (typeof loadClients === 'function') {
    loadClients();
  } else if (typeof refreshAll === 'function') {
    refreshAll();
  } else {
    // Fallback: إعادة تحميل الصفحة
    window.location.reload();
  }
}

// إضافة الـ Header تلقائياً
function initSharedHeader(pageTitle, pageIcon) {
  document.addEventListener('DOMContentLoaded', async () => {
    // جلب اسم الشركة أولاً
    await loadCompanyName();
    
    // انتظار بيانات المستخدم
    const checkUser = setInterval(() => {
      if (window.currentUser) {
        clearInterval(checkUser);
        const headerContainer = document.getElementById('sharedHeader') || document.body.insertBefore(document.createElement('div'), document.body.firstChild);
        headerContainer.id = 'sharedHeader';
        headerContainer.innerHTML = createSharedHeader(pageTitle, pageIcon);
      }
    }, 100);
    
    // Timeout بعد 3 ثواني
    setTimeout(() => clearInterval(checkUser), 3000);
  });
}
