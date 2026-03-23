/**
 * ELOS SPA Application
 * ملف التهيئة الرئيسي
 */

// Logger fallback if utils.js not loaded yet
if (!window.Logger) window.Logger = { log: () => {}, warn: () => {}, error: console.error, debug: () => {}, info: () => {} };

(function() {
  'use strict';

  // ═══════════════════════════════════════
  // تسجيل الـ Routes
  // الصفحات الكبيرة تستخدم iframe للحفاظ على الأداء
  // ═══════════════════════════════════════
  router.registerAll({
    'home': {
      title: 'الرئيسية',
      icon: '🏠',
      pageFile: 'home.html',
      preload: true
    },
    'pos': {
      title: 'نقطة البيع',
      icon: '🛒',
      iframe: './pos.html',  // صفحة كبيرة - iframe
      preload: false,
      permissions: ['sales']
    },
    'inventory': {
      title: 'مخزون الأجهزة',
      icon: '📱',
      iframe: './inventory.html',  // صفحة كبيرة - iframe
      permissions: ['inventory']
    },
    'accessories': {
      title: 'الإكسسوارات',
      icon: '🎧',
      iframe: './warehouse-accessories.html?warehouse_id=2',  // مخزن الأكسسوارات (ID=2) - Clean Rebuild v2.0
      permissions: ['accessories']
    },
    'storage-accessories': {
      title: 'مخزن الإكسسوارات التخزيني',
      icon: '🎧',
      iframe: './warehouse-accessories.html',  // بدون warehouse_id - يتم تمريره كـ param
      permissions: ['accessories']
    },
    'warehouses': {
      title: 'المخازن',
      icon: '🏭',
      iframe: './warehouses.html',  // صفحة كبيرة - iframe
      permissions: ['warehouses']
    },
    'repair-parts': {
      title: 'مخزن قطع الغيار',
      icon: '🔧',
      iframe: './repair-parts.html',  // صفحة كبيرة - iframe
      permissions: ['inventory']
    },
    'sales': {
      title: 'المبيعات',
      icon: '📈',
      iframe: './sales.html',  // صفحة كبيرة - iframe
      permissions: ['sales']
    },
    'purchases': {
      title: 'المشتريات',
      icon: '📥',
      iframe: './purchases.html',  // صفحة كبيرة - iframe
      permissions: ['purchases']
    },
    'clients': {
      title: 'العملاء',
      icon: '👥',
      iframe: './clients.html',  // صفحة كبيرة - iframe
      // متاحة للكاشير - بدون صلاحيات
    },
    'suppliers': {
      title: 'الموردين',
      icon: '🚚',
      iframe: './suppliers.html',  // صفحة كبيرة - iframe
      permissions: ['suppliers']
    },
    'safe': {
      title: 'الخزينة',
      icon: '🏦',
      iframe: './safe.html',  // صفحة كبيرة - iframe
      permissions: ['cash_ledger']
    },
    'general-accounts': {
      title: 'الحسابات العامة',
      icon: '📊',
      iframe: './general-accounts.html',  // صفحة كبيرة - iframe
      preload: false
    },
    'employees': {
      title: 'الموظفين',
      icon: '👨‍💼',
      iframe: './employees.html',  // صفحة كبيرة - iframe
      permissions: ['employees']
    },
    'users': {
      title: 'المستخدمين',
      icon: '🔐',
      iframe: './users.html',  // صفحة كبيرة - iframe
      permissions: ['users']
    },
    'reports': {
      title: 'التقارير',
      icon: '📊',
      iframe: './reports.html',  // صفحة كبيرة - iframe
      permissions: ['reports']
    },
    'settings': {
      title: 'الإعدادات',
      icon: '⚙️',
      iframe: './settings.html',  // صفحة كبيرة - iframe
      permissions: ['settings']
    },
    'blacklist': {
      title: 'البلاك ليست',
      icon: '🚫',
      iframe: './blacklist.html',
      // متاحة للكاشير - بدون صلاحيات
    },
    'warehouse-inventory': {
      title: 'مخزون المستودع',
      icon: '📦',
      iframe: './warehouse-inventory.html',
      permissions: ['inventory']
    },
    'storage-devices': {
      title: 'مخزن الأجهزة التخزيني',
      icon: '📱',
      iframe: './storage-devices.html',
      permissions: ['inventory']
    },
    'purchases-general': {
      title: 'المشتريات العامة',
      icon: '📊',
      iframe: './purchases-general.html',
      permissions: ['purchases']
    },
    'accessory-purchases': {
      title: 'مشتريات الإكسسوارات',
      icon: '🎧',
      iframe: './accessory-purchases.html',
      permissions: ['purchases']
    },
    'repair-parts-purchases': {
      title: 'مشتريات قطع الغيار',
      icon: '🔧',
      iframe: './repair-parts-purchases.html',
      permissions: ['purchases']
    },
    'sales-general': {
      title: 'المبيعات العامة',
      icon: '📊',
      iframe: './sales-general.html',
      permissions: ['sales']
    },
    'accessory-sales': {
      title: 'مبيعات الإكسسوارات',
      icon: '🎧',
      iframe: './accessory-sales.html',
      permissions: ['sales']
    },
    'repair-parts-sales': {
      title: 'مبيعات قطع الغيار',
      icon: '🔧',
      iframe: './repair-parts-sales.html',
      permissions: ['repairs']
    },
    'reminders': {
      title: 'التذكيرات',
      icon: '⏰',
      iframe: './reminders.html',
      // متاحة للكاشير - بدون صلاحيات
    },
    'partners': {
      title: 'الشركاء',
      icon: '🤝',
      iframe: './partners.html',
      permissions: ['inventory']
    },
    'archive': {
      title: 'الأرشيف',
      icon: '🗄️',
      iframe: './archive.html',
      permissions: ['inventory']
    },
    'help': {
      title: 'دليل المستخدم',
      icon: '📖',
      iframe: './help.html'
      // متاحة للجميع - بدون صلاحيات
    },
    'repairs': {
      title: 'الصيانة',
      icon: '🔧',
      iframe: './repairs.html',
      permissions: ['repairs']
    },
    'stocktake': {
      title: 'الجرد',
      icon: '📋',
      iframe: './stocktake.html',
      permissions: ['inventory']
    }
  });

  // ═══════════════════════════════════════
  // تهيئة التطبيق
  // ═══════════════════════════════════════
  async function initApp() {
    Logger.log('[App] Starting ELOS SPA...');

    // ✅ انتظار الـ session من main process
    await waitForSession();

    // تحميل بيانات المستخدم
    await loadUserData();

    // تهيئة الـ page loader
    pageLoader.init();

    // تهيئة الـ router
    router.init();

    // ✅ إذا كان كاشير، افتح POS مباشرة بدل الرئيسية
    const user = window.currentUser || {};
    if (user.role === 'cashier') {
      Logger.log('[App] Cashier detected, redirecting to POS...');
      setTimeout(() => {
        router.navigate('pos');
      }, 100);
    }

    // تحميل مسبق للصفحات المهمة
    setTimeout(() => {
      router.preloadRoutes();
    }, 2000);

    Logger.log('[App] ELOS SPA Ready!');
  }

  // ═══════════════════════════════════════
  // انتظار الـ session
  // ═══════════════════════════════════════
  async function waitForSession(maxWait = 3000) {
    const startTime = Date.now();

    while (Date.now() - startTime < maxWait) {
      const sessionId = localStorage.getItem('sessionId');
      if (sessionId) {
        Logger.log('[App] ✅ Session found:', sessionId.substring(0, 16) + '...');
        return true;
      }
      // انتظار 100ms ثم محاولة مرة أخرى
      await new Promise(resolve => setTimeout(resolve, 100));
    }

    Logger.warn('[App] ⚠️ Session not found after', maxWait, 'ms');
    return false;
  }

  // ═══════════════════════════════════════
  // تحميل بيانات المستخدم
  // ═══════════════════════════════════════
  async function loadUserData() {
    try {
      const res = await fetch('elos-db://current-user-role');
      if (res.ok) {
        const user = await res.json();
        window.currentUser = user;
        updateUserUI(user);
        Logger.log('[App] User loaded:', user.username);
      }
    } catch (e) {
      Logger.error('[App] Failed to load user:', e);
      // في حالة الخطأ، نستخدم بيانات افتراضية
      window.currentUser = { username: 'مستخدم', role: 'admin' };
    }
  }

  // ═══════════════════════════════════════
  // تحديث UI المستخدم
  // ═══════════════════════════════════════
  function updateUserUI(user) {
    const nameEl = document.getElementById('userName');
    const roleEl = document.getElementById('userRole');
    const avatarEl = document.getElementById('userAvatar');

    if (nameEl) nameEl.textContent = user.username || user.name || 'مستخدم';

    if (roleEl) {
      const roleNames = {
        'admin': 'مدير النظام',
        'cashier': 'كاشير',
        'viewer': 'مشاهد'
      };
      roleEl.textContent = roleNames[user.role] || user.role;
    }

    if (avatarEl && user.username) {
      avatarEl.textContent = user.username.charAt(0).toUpperCase();
    }

    // تطبيق صلاحيات الـ Sidebar
    applySidebarPermissions(user);
  }

  // ═══════════════════════════════════════
  // تطبيق صلاحيات الـ Sidebar
  // ═══════════════════════════════════════
  function applySidebarPermissions(user) {
    const isAdmin = user.role === 'admin';

    // إخفاء العناصر التي تحتاج صلاحيات
    document.querySelectorAll('[data-permission]').forEach(el => {
      if (!isAdmin) {
        el.style.display = 'none';
      }
    });

    // للكاشير: إخفاء الرئيسية (صفحته الافتراضية POS)
    if (!isAdmin) {
      const homeItem = document.querySelector('[data-route="home"]');
      if (homeItem) homeItem.style.display = 'none';
    }

    // إخفاء عنوان "الحسابات" إذا الكاشير (يبقى العملاء فقط)
    if (!isAdmin) {
      const accountsGroup = document.querySelector('.nav-group:has([data-route="clients"])');
      if (accountsGroup) {
        const title = accountsGroup.querySelector('.nav-group-title');
        if (title) title.style.display = 'none';
      }
    }

    // إخفاء عنوان "أدوات" إذا لم يتبقى سوى التذكيرات والبلاك ليست
    if (!isAdmin) {
      const toolsGroup = document.querySelector('.nav-group:has([data-route="reminders"])');
      if (toolsGroup) {
        const title = toolsGroup.querySelector('.nav-group-title');
        if (title) title.style.display = 'none';
      }
    }

    Logger.log('[App] Sidebar permissions applied for:', user.role);
  }

  // ═══════════════════════════════════════
  // تسجيل الخروج (بدون confirm - يتم من خلال modal في app.html)
  // ═══════════════════════════════════════
  window.logout = async function() {
    try {
      const sessionId = localStorage.getItem('sessionId');
      if (sessionId) {
        await fetch('elos-db://auth/logout', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-session-id': sessionId
          },
          body: JSON.stringify({ sessionId })
        });
      }
    } catch (e) {
      Logger.error('[App] Logout error:', e);
    }

    // مسح البيانات المحلية
    localStorage.removeItem('sessionId');
    localStorage.removeItem('currentUser');

    // إغلاق البرنامج بالكامل
    if (window.electronAPI && window.electronAPI.quit) {
      window.electronAPI.quit();
    } else if (window.require) {
      const { ipcRenderer } = window.require('electron');
      ipcRenderer.send('app-quit');
    } else {
      // fallback
      window.close();
    }
  };

  // ═══════════════════════════════════════
  // Events Listeners
  // ═══════════════════════════════════════

  // عند تغيير الصفحة
  router.on('afterNavigate', ({ route }) => {
    Logger.log('[App] Page changed to:', route.title);

    // تشغيل صوت التنقل (إذا موجود)
    if (typeof playNavigationSound === 'function') {
      playNavigationSound();
    }

    // Smart preloading - تحميل الصفحات المرتبطة
    setTimeout(() => {
      router.smartPreload();
    }, 1000);
  });

  // عند حدوث خطأ في التحميل
  router.on('loadError', ({ route, error }) => {
    Logger.error('[App] Load error:', route.path, error);

    // محاولة فتح الصفحة القديمة كـ fallback
    if (confirm(`فشل تحميل ${route.title}. هل تريد فتح الصفحة بالطريقة التقليدية؟`)) {
      window.location.href = `./${route.path}.html`;
    }
  });

  // ═══════════════════════════════════════
  // بدء التطبيق
  // ═══════════════════════════════════════
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initApp);
  } else {
    initApp();
  }

})();
