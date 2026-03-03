// session-inject.js
// ═══════════════════════════════════════════════════════════════════
// 🔐 SESSION HEADER INJECTION + CLIENT MODE SUPPORT
// ═══════════════════════════════════════════════════════════════════
// هذا الملف يضيف x-session-id header تلقائياً لكل request
// ويدعم وضع العميل للاتصال بسيرفر بعيد
// يجب تحميله FIRST في كل صفحة HTML
// ═══════════════════════════════════════════════════════════════════

// Logger fallback if utils.js not loaded yet
if (!window.Logger) window.Logger = { log: () => {}, warn: () => {}, error: console.error, debug: () => {}, info: () => {} };
var Logger = window.Logger;

(function() {
  // منع التكرار
  if (window._sessionPatched) {
    Logger.log('[SESSION] Already patched');
    return;
  }
  window._sessionPatched = true;

  Logger.log('[SESSION] 🔐 Patching fetch for HTTP Server...');

  // ═══════════════════════════════════════════════════════════════════
  // 🔗 DYNAMIC CLIENT MODE DETECTION (يتم قراءتها في كل request)
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

  function isClientModeActive() {
    return localStorage.getItem('elos_mode') === 'client' && localStorage.getItem('elos_server_ip');
  }

  const originalFetch = window.fetch;

  window.fetch = function(url, options = {}) {
    let finalUrl = url;

    // قراءة الإعدادات بشكل ديناميكي في كل request
    const baseURL = getBaseURL();
    const isClientMode = isClientModeActive();

    // تحويل elos-db:// إلى HTTP URL
    if (typeof url === 'string' && url.includes('elos-db://')) {
      finalUrl = url.replace('elos-db://', baseURL + '/');
    }
    // تحويل طلبات 127.0.0.1 للسيرفر البعيد في وضع العميل
    else if (isClientMode && typeof url === 'string' && url.includes('http://127.0.0.1:48572')) {
      finalUrl = url.replace('http://127.0.0.1:48572', baseURL);
    }

    // إضافة session header لطلبات الـ API
    if (typeof finalUrl === 'string' && (finalUrl.includes(baseURL) || finalUrl.includes('127.0.0.1:48572'))) {
      const sessionId = localStorage.getItem('sessionId');

      if (sessionId) {
        // CRITICAL: إنشاء headers بشكل صحيح
        if (!options.headers) {
          options.headers = {};
        }

        if (options.headers instanceof Headers) {
          options.headers.set('x-session-id', sessionId);
        } else if (typeof options.headers === 'object') {
          // Plain object
          options.headers['x-session-id'] = sessionId;
        }

        Logger.log('[SESSION] ✅ Request:', {
          url: finalUrl.substring(0, 70),
          method: options.method || 'GET',
          sessionId: sessionId.substring(0, 16) + '...',
          isRemote: isClientMode
        });
      } else {
        Logger.error('[SESSION] ❌ No sessionId in localStorage!');
        Logger.warn('[SESSION] ⚠️ Request will fail:', finalUrl);
      }
    }

    return originalFetch.call(this, finalUrl, options);
  };

  // Log initial state
  const currentSessionId = localStorage.getItem('sessionId');
  const initialMode = isClientModeActive();
  Logger.log('[SESSION] ✅ HTTP client ready');
  Logger.log('[SESSION] Initial Mode:', initialMode ? 'CLIENT (Remote)' : 'LOCAL');
  Logger.log('[SESSION] Initial Target:', getBaseURL());
  Logger.log('[SESSION] SessionId present:', !!currentSessionId);
  if (currentSessionId) {
    Logger.log('[SESSION] SessionId value:', currentSessionId.substring(0, 16) + '...');
  }
})();