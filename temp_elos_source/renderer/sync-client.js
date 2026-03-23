// sync-client.js - Real-time Sync Client
// ═══════════════════════════════════════════════════════════════════
// 🔄 POLLING-BASED SYNC CLIENT
// ═══════════════════════════════════════════════════════════════════
// يتحقق من التحديثات من السيرفر ويُنعش البيانات تلقائياً
// ═══════════════════════════════════════════════════════════════════

// Logger fallback
if (!window.Logger) window.Logger = { log: () => {}, warn: () => {}, error: console.error, debug: () => {}, info: () => {} };
var Logger = window.Logger;

(function() {
  // منع التكرار
  if (window._syncClientInitialized) {
    Logger.log('[SYNC] Already initialized');
    return;
  }
  window._syncClientInitialized = true;

  Logger.log('[SYNC] 🔄 Initializing sync client...');

  // ═══════════════════════════════════════════════════════════════════
  // ⚙️ CONFIGURATION
  // ═══════════════════════════════════════════════════════════════════
  const SYNC_CONFIG = {
    pollInterval: 5000,        // فحص كل 5 ثواني
    retryInterval: 10000,      // إعادة المحاولة بعد 10 ثواني في حالة الخطأ
    maxRetries: 3,             // عدد المحاولات قبل التوقف المؤقت
    pauseAfterError: 30000,    // توقف 30 ثانية بعد أخطاء متكررة
    enabled: true              // تفعيل/تعطيل المزامنة
  };

  // ═══════════════════════════════════════════════════════════════════
  // 📊 STATE
  // ═══════════════════════════════════════════════════════════════════
  let localTimestamps = {};
  let pollTimer = null;
  let retryCount = 0;
  let isPaused = false;
  let lastSyncTime = 0;

  // ═══════════════════════════════════════════════════════════════════
  // 🔧 HELPERS
  // ═══════════════════════════════════════════════════════════════════
  function getBaseURL() {
    const isClientMode = localStorage.getItem('elos_mode') === 'client';
    const serverIP = localStorage.getItem('elos_server_ip');
    const serverPort = localStorage.getItem('elos_server_port') || '48572';

    if (isClientMode && serverIP) {
      return `http://${serverIP}:${serverPort}`;
    }
    return 'http://127.0.0.1:48572';
  }

  function isClientMode() {
    return localStorage.getItem('elos_mode') === 'client' && localStorage.getItem('elos_server_ip');
  }

  // ═══════════════════════════════════════════════════════════════════
  // 🔄 SYNC FUNCTIONS
  // ═══════════════════════════════════════════════════════════════════

  // فحص التحديثات من السيرفر
  async function checkForUpdates() {
    if (!SYNC_CONFIG.enabled || isPaused) return;

    const sessionId = localStorage.getItem('sessionId');
    if (!sessionId) {
      Logger.log('[SYNC] ⏭️ No session, skipping sync check');
      return;
    }

    try {
      const response = await fetch(`${getBaseURL()}/api/sync/check`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-session-id': sessionId
        },
        body: JSON.stringify({
          timestamps: localTimestamps
        })
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const data = await response.json();

      // Reset retry count on success
      retryCount = 0;
      lastSyncTime = Date.now();

      if (data.hasUpdates && data.updates && data.updates.length > 0) {
        Logger.log('[SYNC] 📥 Updates detected:', data.updates.map(u => u.table));

        // تحديث الـ timestamps المحلية
        localTimestamps = data.serverTimestamps;

        // إرسال حدث للصفحات المهتمة
        handleUpdates(data.updates);
      } else {
        Logger.debug('[SYNC] ✓ No updates');
      }

    } catch (error) {
      retryCount++;
      Logger.warn(`[SYNC] ⚠️ Check failed (${retryCount}/${SYNC_CONFIG.maxRetries}):`, error.message);

      if (retryCount >= SYNC_CONFIG.maxRetries) {
        isPaused = true;
        Logger.warn(`[SYNC] ⏸️ Pausing sync for ${SYNC_CONFIG.pauseAfterError / 1000}s`);

        setTimeout(() => {
          isPaused = false;
          retryCount = 0;
          Logger.log('[SYNC] ▶️ Resuming sync');
        }, SYNC_CONFIG.pauseAfterError);
      }
    }
  }

  // معالجة التحديثات
  function handleUpdates(updates) {
    const updatedTables = updates.map(u => u.table);

    // إرسال حدث مخصص
    const event = new CustomEvent('elos-sync-update', {
      detail: {
        tables: updatedTables,
        updates: updates,
        timestamp: Date.now()
      }
    });
    window.dispatchEvent(event);

    // عرض إشعار
    showSyncNotification(updatedTables);

    // تحديث البيانات تلقائياً حسب الصفحة الحالية
    autoRefreshCurrentPage(updatedTables);
  }

  // إشعار بالتحديثات
  function showSyncNotification(tables) {
    // إنشاء إشعار مرئي
    const tableNames = {
      'devices': 'الأجهزة',
      'clients': 'العملاء',
      'suppliers': 'الموردين',
      'sales': 'المبيعات',
      'repairs': 'الصيانة',
      'accessories': 'الإكسسوارات',
      'accessory_movements': 'حركات الإكسسوارات',
      'categories': 'التصنيفات',
      'safe_transactions': 'الخزنة',
      'cash_ledger': 'دفتر الأستاذ',
      'reminders': 'التذكيرات',
      'users': 'المستخدمين',
      'inventory_transactions': 'حركات المخزون',
      'repair_parts': 'قطع الغيار',
      'repair_parts_movements': 'حركات قطع الغيار'
    };

    const translatedTables = tables.map(t => tableNames[t] || t).join('، ');

    // إنشاء عنصر الإشعار
    let notification = document.getElementById('sync-notification');
    if (!notification) {
      notification = document.createElement('div');
      notification.id = 'sync-notification';
      notification.style.cssText = `
        position: fixed;
        bottom: 20px;
        left: 20px;
        background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
        color: white;
        padding: 12px 20px;
        border-radius: 8px;
        box-shadow: 0 4px 15px rgba(0,0,0,0.2);
        z-index: 10000;
        font-family: 'Segoe UI', Tahoma, sans-serif;
        font-size: 14px;
        display: flex;
        align-items: center;
        gap: 10px;
        transform: translateX(-120%);
        transition: transform 0.3s ease;
        direction: rtl;
      `;
      document.body.appendChild(notification);
    }

    notification.innerHTML = `
      <span style="font-size: 18px;">🔄</span>
      <span>تم تحديث: ${translatedTables}</span>
    `;

    // إظهار الإشعار
    setTimeout(() => notification.style.transform = 'translateX(0)', 10);

    // إخفاء بعد 3 ثواني
    setTimeout(() => {
      notification.style.transform = 'translateX(-120%)';
    }, 3000);
  }

  // تحديث الصفحة الحالية تلقائياً
  function autoRefreshCurrentPage(updatedTables) {
    const currentPage = window.location.pathname.split('/').pop() || 'index.html';

    // خريطة الصفحات والجداول المرتبطة بها
    const pageTableMap = {
      'index.html': ['devices', 'sales', 'repairs', 'safe_transactions'],
      'app.html': ['devices', 'sales', 'repairs', 'safe_transactions'],
      'inventory.html': ['devices', 'categories', 'inventory_transactions'],
      'pos.html': ['devices', 'accessories', 'accessory_movements', 'repair_parts', 'repair_parts_movements', 'clients', 'sales'],
      'clients.html': ['clients'],
      'suppliers.html': ['suppliers'],
      'repairs.html': ['repairs', 'devices', 'repair_parts', 'repair_parts_movements'],
      'accessories.html': ['accessories', 'accessory_movements', 'categories'],
      'repair-parts.html': ['repair_parts', 'repair_parts_movements', 'categories'],
      'reports.html': ['sales', 'devices', 'repairs', 'accessories', 'repair_parts'],
      'safe.html': ['safe_transactions', 'cash_ledger'],
      'reminders.html': ['reminders'],
      'users.html': ['users']
    };

    const relevantTables = pageTableMap[currentPage] || [];
    const hasRelevantUpdate = updatedTables.some(t => relevantTables.includes(t));

    if (hasRelevantUpdate) {
      Logger.log('[SYNC] 🔄 Auto-refreshing data for current page:', currentPage);

      // إرسال حدث للتحديث
      window.dispatchEvent(new CustomEvent('elos-refresh-data', {
        detail: { tables: updatedTables.filter(t => relevantTables.includes(t)) }
      }));

      // محاولة استدعاء دوال التحديث المعروفة
      if (typeof window.loadDashboardData === 'function') {
        window.loadDashboardData();
      }
      if (typeof window.loadDevices === 'function') {
        window.loadDevices();
      }
      if (typeof window.loadInventory === 'function') {
        window.loadInventory();
      }
      if (typeof window.loadClients === 'function') {
        window.loadClients();
      }
      if (typeof window.loadSuppliers === 'function') {
        window.loadSuppliers();
      }
      if (typeof window.loadRepairs === 'function') {
        window.loadRepairs();
      }
      if (typeof window.loadAccessories === 'function') {
        window.loadAccessories();
      }
      if (typeof window.loadSales === 'function') {
        window.loadSales();
      }
      if (typeof window.refreshData === 'function') {
        window.refreshData();
      }
      // ✅ v1.2.4 - POS page refresh
      if (typeof window.refreshPOSData === 'function') {
        window.refreshPOSData();
      }
    }
  }

  // ═══════════════════════════════════════════════════════════════════
  // 🎛️ CONTROL FUNCTIONS
  // ═══════════════════════════════════════════════════════════════════

  // بدء المزامنة
  function startSync() {
    if (pollTimer) {
      Logger.log('[SYNC] Already running');
      return;
    }

    Logger.log('[SYNC] ▶️ Starting sync polling...');

    // فحص فوري
    checkForUpdates();

    // ثم فحص دوري
    pollTimer = setInterval(checkForUpdates, SYNC_CONFIG.pollInterval);
  }

  // إيقاف المزامنة
  function stopSync() {
    if (pollTimer) {
      clearInterval(pollTimer);
      pollTimer = null;
      Logger.log('[SYNC] ⏹️ Sync stopped');
    }
  }

  // إعادة التشغيل
  function restartSync() {
    stopSync();
    retryCount = 0;
    isPaused = false;
    startSync();
  }

  // فحص يدوي
  function forceSync() {
    Logger.log('[SYNC] 🔄 Force sync requested');
    isPaused = false;
    retryCount = 0;
    checkForUpdates();
  }

  // الحصول على حالة المزامنة
  function getSyncStatus() {
    return {
      enabled: SYNC_CONFIG.enabled,
      running: !!pollTimer,
      paused: isPaused,
      lastSync: lastSyncTime,
      retryCount: retryCount,
      isClientMode: isClientMode(),
      serverURL: getBaseURL()
    };
  }

  // ═══════════════════════════════════════════════════════════════════
  // 🚀 INITIALIZE
  // ═══════════════════════════════════════════════════════════════════

  // انتظار تحميل الصفحة
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
      // تأخير بسيط للسماح بتحميل باقي السكربتات
      setTimeout(startSync, 1000);
    });
  } else {
    setTimeout(startSync, 1000);
  }

  // إيقاف عند إغلاق الصفحة
  window.addEventListener('beforeunload', stopSync);

  // إيقاف مؤقت عند فقدان التركيز (لتوفير الموارد)
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
      Logger.log('[SYNC] 📴 Page hidden, pausing sync');
      stopSync();
    } else {
      Logger.log('[SYNC] 📱 Page visible, resuming sync');
      startSync();
    }
  });

  // ═══════════════════════════════════════════════════════════════════
  // 🌍 EXPOSE GLOBALLY
  // ═══════════════════════════════════════════════════════════════════
  window.ElosSync = {
    start: startSync,
    stop: stopSync,
    restart: restartSync,
    forceSync: forceSync,
    getStatus: getSyncStatus,
    config: SYNC_CONFIG
  };

  Logger.log('[SYNC] ✅ Sync client initialized');
  Logger.log('[SYNC] Mode:', isClientMode() ? 'CLIENT (Remote)' : 'LOCAL');
  Logger.log('[SYNC] Server:', getBaseURL());

})();
