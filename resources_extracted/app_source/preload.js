const { contextBridge, ipcRenderer } = require('electron');

// ═══════════════════════════════════════════════════════════════════
// SESSION MANAGEMENT INJECTION - IMMEDIATE (before DOM loads)
// ═══════════════════════════════════════════════════════════════════

// Patch fetch IMMEDIATELY - don't wait for DOMContentLoaded!
if (!window._sessionInjected) {
  window._sessionInjected = true;

  console.log('[PRELOAD] 🔐 Injecting session management (immediate)...');

  const originalFetch = window.fetch;
  
  window.fetch = function(url, options = {}) {
    // Check if it's an elos-db request
    if (typeof url === 'string' && url.includes('elos-db://')) {
      // احصل على sessionId لحظياً
      const sessionId = localStorage.getItem('sessionId');
      
      if (sessionId) {
        // CRITICAL: تأكد من إنشاء headers object بشكل صحيح
        if (!options.headers) {
          options.headers = {};
        }
        
        // التعامل مع Headers object
        if (options.headers instanceof Headers) {
          options.headers.set('x-session-id', sessionId);
        } else if (typeof options.headers === 'object') {
          // Plain object - هذا هو الأكثر شيوعاً
          options.headers['x-session-id'] = sessionId;
        }
        
        console.log('[PRELOAD] ✅ Added header to:', {
          url: url.substring(0, 50),
          method: options.method || 'GET',
          sessionId: sessionId.substring(0, 16) + '...',
          headers: options.headers
        });
      } else {
        console.warn('[PRELOAD] ⚠️ No sessionId in localStorage for:', url.substring(0, 50));
        console.warn('[PRELOAD] ⚠️ localStorage keys:', Object.keys(localStorage));
      }
    }
    
    return originalFetch.call(this, url, options);
  };

  console.log('[PRELOAD] ✅ Session management ready (immediate)');
}

// ═══════════════════════════════════════════════════════════════════
// OLD API (keeping for backward compatibility)
// ═══════════════════════════════════════════════════════════════════

contextBridge.exposeInMainWorld('api', {
  list: (search = '') => ipcRenderer.invoke('trx:list', { search }),
  add: (trx) => ipcRenderer.invoke('trx:add', trx),
  update: (trx) => ipcRenderer.invoke('trx:update', trx),
  remove: (id) => ipcRenderer.invoke('trx:delete', id),
  summary: () => ipcRenderer.invoke('stats:summary')
});

// ═══════════════════════════════════════════════════════════════════
// 🔐 Secure Auth API - استخدام IPC بدلاً من executeJavaScript
// ═══════════════════════════════════════════════════════════════════
contextBridge.exposeInMainWorld('authBridge', {
  // استقبال بيانات تسجيل الدخول الناجح
  onLoginSuccess: (callback) => {
    ipcRenderer.on('auth:login-success', (event, data) => {
      callback(data);
    });
  },

  // استقبال خطأ تسجيل الدخول
  onLoginError: (callback) => {
    ipcRenderer.on('auth:login-error', (event, data) => {
      callback(data);
    });
  },

  // إرسال بيانات تسجيل الدخول
  sendLoginAttempt: (credentials) => {
    ipcRenderer.send('auth:login-attempt', credentials);
  },

  // إغلاق التطبيق
  quitApp: () => {
    ipcRenderer.send('app-quit');
  },

  // تصغير النافذة
  minimizeWindow: () => {
    ipcRenderer.send('window-minimize');
  },

  // تكبير/تصغير النافذة
  maximizeToggleWindow: () => {
    ipcRenderer.send('window-maximize-toggle');
  },

  // إغلاق النافذة
  closeWindow: () => {
    ipcRenderer.send('window-close');
  },

  // التحقق من السلة عند الإغلاق
  onCheckCart: (callback) => {
    ipcRenderer.on('app:check-cart', (event) => {
      callback(event);
    });
  },

  // إعادة تشغيل التطبيق
  restartApp: () => {
    ipcRenderer.send('app:restart');
  },

  // الانتقال إلى صفحة تسجيل الدخول
  navigateToLogin: () => {
    ipcRenderer.send('navigate:login');
  },

  // فتح رابط خارجي بأمان (Electron shell.openExternal)
  openExternal: (url) => {
    ipcRenderer.send('app:open-external', url);
  },

  // الحصول على نسخة التطبيق (بدون auth)
  getAppVersion: () => {
    return ipcRenderer.invoke('app:get-version');
  },

  // ═══════════════════════════════════════════════════════════════════
  // 🔗 CLIENT MODE SUPPORT - دعم وضع العميل
  // ═══════════════════════════════════════════════════════════════════

  // حفظ إعدادات العميل (للاتصال بسيرفر بعيد)
  saveClientConfig: (config) => {
    return ipcRenderer.invoke('client:save-config', config);
  },

  // قراءة إعدادات العميل
  getClientConfig: () => {
    return ipcRenderer.invoke('client:get-config');
  },

  // التحقق من وضع العميل
  isClientMode: () => {
    return ipcRenderer.invoke('client:is-client-mode');
  },

  // اختيار مكان حفظ النسخة الاحتياطية (نافذة حفظ ملف)
  showBackupSaveDialog: () => {
    return ipcRenderer.invoke('backup:show-save-dialog');
  },

  // استعادة نسخة احتياطية (اختيار ملف .db ثم إعادة تشغيل البرنامج)
  showRestoreBackupDialog: () => {
    return ipcRenderer.invoke('backup:show-restore-dialog');
  }
});

// ═══════════════════════════════════════════════════════════════════
// 🖨️ Print API - الطباعة المباشرة بدون Print Dialog
// ═══════════════════════════════════════════════════════════════════
contextBridge.exposeInMainWorld('printBridge', {
  // الطباعة المباشرة بدون فتح Print Dialog
  printSilent: (options = {}) => {
    ipcRenderer.send('print:silent', options);
  },

  // الحصول على قائمة الطابعات المتاحة
  getPrinters: () => {
    return ipcRenderer.invoke('print:get-printers');
  },

  // استقبال أخطاء الطباعة
  onPrintError: (callback) => {
    ipcRenderer.on('print:error', (event, data) => {
      callback(data);
    });
  }
});

console.log('[PRELOAD] ✅ Preload script loaded with secure auth bridge and print API');