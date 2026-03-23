// permissions.js - نظام الصلاحيات

// Fallbacks if utils.js not loaded yet
if (!window.Logger) window.Logger = { log: () => {}, warn: () => {}, error: console.error, debug: () => {}, info: () => {} };
if (!window.fmt) window.fmt = (n, decimals = 2) => Number(n || 0).toLocaleString('en-US', { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
if (!window.escapeHtml) window.escapeHtml = (text) => { if (text === null || text === undefined) return ''; const div = document.createElement('div'); div.textContent = String(text); return div.innerHTML; };

const PERMISSIONS = {
  // المدير - كل الصلاحيات
  admin: {
    homePage: 'index.html',
    pages: ['*'], // كل الصفحات
    tiles: ['*'], // كل الأزرار
    canManageUsers: true,
    canViewReports: true,
    canEditSettings: true,
    canDeleteRecords: true,
    canViewCash: true,
    canExport: true
  },
  
  // الكاشير - صلاحيات محدودة
  cashier: {
    homePage: 'pos.html', // يدخل على نقطة البيع مباشرة
    pages: [
      'pos.html',        // نقطة البيع
      'clients.html',    // العملاء
      'inventory.html',  // المخزون (عرض فقط)
      'repairs.html'     // الصيانة
    ],
    tiles: [
      { id: 'pos', href: 'pos.html', icon: '🛒', name: 'نقطة البيع', desc: 'بيع سريع ومباشر' },
      { id: 'clients', href: 'clients.html', icon: '👥', name: 'العملاء', desc: 'إدارة بيانات العملاء' },
      { id: 'inventory', href: 'inventory.html', icon: '📦', name: 'المخزون', desc: 'عرض الأجهزة المتاحة' },
      { id: 'repairs', href: 'repairs.html', icon: '🔧', name: 'الصيانة', desc: 'إدارة تذاكر الصيانة' }
    ],
    canManageUsers: false,
    canViewReports: false,
    canEditSettings: false,
    canDeleteRecords: false,
    canViewCash: false,
    canExport: false
  },
  
  // المشاهد - عرض فقط
  viewer: {
    homePage: 'inventory.html', // يدخل على المخزون
    pages: [
      'inventory.html',  // المخزون
      'reports.html'     // التقارير
    ],
    tiles: [
      { id: 'inventory', href: 'inventory.html', icon: '📦', name: 'المخزون', desc: 'عرض الأجهزة والمنتجات' },
      { id: 'reports', href: 'reports.html', icon: '📊', name: 'التقارير', desc: 'تقارير شاملة' }
    ],
    canManageUsers: false,
    canViewReports: true,
    canEditSettings: false,
    canDeleteRecords: false,
    canViewCash: false,
    canExport: false
  }
};

// أسماء الصفحات بالعربي
const PAGE_NAMES = {
  'index.html': 'الرئيسية',
  'pos.html': 'نقطة البيع',
  'inventory.html': 'المخزون',
  'sales.html': 'المبيعات',
  'purchases.html': 'المشتريات',
  'clients.html': 'العملاء',
  'suppliers.html': 'الموردين',
  'partners.html': 'الشركاء',
  'employees.html': 'الموظفين',
  'cash.html': 'الخزنة',
  'reminders.html': 'التذكيرات',
  'reports.html': 'التقارير',
  'settings.html': 'الإعدادات',
  'users.html': 'إدارة المستخدمين',
  'repairs.html': 'الصيانة'
};

// الحصول على الصفحة الرئيسية حسب الصلاحية
function getHomePage(role) {
  const permissions = PERMISSIONS[role];
  return permissions ? permissions.homePage : 'index.html';
}

// الحصول على الأزرار المتاحة
function getAllowedTiles(role) {
  const permissions = PERMISSIONS[role];
  if (!permissions) return [];
  
  if (permissions.tiles.includes('*')) {
    return null; // يعني كل الأزرار الافتراضية
  }
  
  return permissions.tiles;
}

// التحقق من صلاحية الوصول للصفحة
function canAccessPage(role, pageName) {
  const permissions = PERMISSIONS[role];
  if (!permissions) return false;
  
  // المدير له كل الصلاحيات
  if (permissions.pages.includes('*')) return true;
  
  // التحقق من الصفحة
  return permissions.pages.includes(pageName);
}

// التحقق من صلاحية معينة
function hasPermission(role, permission) {
  const permissions = PERMISSIONS[role];
  if (!permissions) return false;
  
  return permissions[permission] === true;
}

// الحصول على قائمة الصفحات المتاحة
function getAllowedPages(role) {
  const permissions = PERMISSIONS[role];
  if (!permissions) return [];
  
  if (permissions.pages.includes('*')) {
    return Object.keys(PAGE_NAMES);
  }
  
  return permissions.pages;
}

// التحقق من الصلاحيات عند تحميل الصفحة
function checkPageAccess() {
  if (!window.currentUser) {
    Logger.log('No user found');
    return false;
  }
  
  const currentPage = window.location.pathname.split('/').pop() || 'index.html';
  const userRole = window.currentUser.role;
  
  // لو المستخدم مش admin ودخل على index.html، حوله لصفحته الرئيسية
  if (currentPage === 'index.html' && userRole !== 'admin') {
    const homePage = getHomePage(userRole);
    if (homePage !== 'index.html') {
      window.location.href = homePage;
      return false;
    }
  }
  
  if (!canAccessPage(userRole, currentPage)) {
    // مفيش صلاحية - ✅ استخدام showToast بدلاً من alert
    showToast('⛔ ليس لديك صلاحية للوصول لهذه الصفحة', 'error', 3000);
    setTimeout(() => {
      window.location.href = getHomePage(userRole);
    }, 1000);
    return false;
  }
  
  // إخفاء العناصر حسب الصلاحيات
  applyPermissions(userRole);
  
  return true;
}

// تطبيق الصلاحيات على العناصر
function applyPermissions(role) {
  const permissions = PERMISSIONS[role];
  if (!permissions) return;
  
  // إخفاء أزرار الحذف لو مش مسموح
  if (!permissions.canDeleteRecords) {
    document.querySelectorAll('[data-permission="delete"]').forEach(el => {
      el.style.display = 'none';
    });
  }
  
  // إخفاء الإعدادات لو مش مسموح
  if (!permissions.canEditSettings) {
    document.querySelectorAll('[data-permission="settings"]').forEach(el => {
      el.style.display = 'none';
    });
  }
  
  // إخفاء الخزنة لو مش مسموح
  if (!permissions.canViewCash) {
    document.querySelectorAll('[data-permission="cash"]').forEach(el => {
      el.style.display = 'none';
    });
  }
  
  // إخفاء التصدير لو مش مسموح
  if (!permissions.canExport) {
    document.querySelectorAll('[data-permission="export"]').forEach(el => {
      el.style.display = 'none';
    });
  }
  
  // إخفاء الروابط للصفحات الغير مسموحة
  document.querySelectorAll('a[href]').forEach(link => {
    const href = link.getAttribute('href');
    if (href && href.endsWith('.html')) {
      const pageName = href.replace('./', '');
      if (!canAccessPage(role, pageName)) {
        link.style.opacity = '0.3';
        link.style.pointerEvents = 'none';
        link.title = 'ليس لديك صلاحية';
      }
    }
  });
}

// تصدير للاستخدام
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { PERMISSIONS, PAGE_NAMES, canAccessPage, hasPermission, getAllowedPages, checkPageAccess, getHomePage, getAllowedTiles };
}