// user-controls.js - User Controls & Session Management
// ═══════════════════════════════════════════════════════════════════

// Logger fallback if utils.js not loaded yet
if (!window.Logger) window.Logger = { log: () => {}, warn: () => {}, error: console.error, debug: () => {}, info: () => {} };
var Logger = window.Logger;

Logger.log('[USER-CONTROLS] 🔐 Loading user controls...');

// ═══════════════════════════════════════════════════════════════════
// 🔄 Fetch Interceptor - Convert elos-db:// to http:// + CLIENT MODE
// ═══════════════════════════════════════════════════════════════════
(function() {
  // 🔗 DYNAMIC CLIENT MODE DETECTION (يتم قراءتها في كل request)
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
  window.fetch = function(url, options) {
    // قراءة الإعدادات بشكل ديناميكي في كل request
    const baseURL = getBaseURL();
    const isClientMode = isClientModeActive();

    // Convert elos-db:// URLs to HTTP
    if (typeof url === 'string' && url.startsWith('elos-db://')) {
      url = url.replace('elos-db://', baseURL + '/');
      Logger.log('[USER-CONTROLS] 🔄 Converted:', url.substring(0, 60));
    }
    // Convert 127.0.0.1 to remote server in client mode
    else if (isClientMode && typeof url === 'string' && url.includes('http://127.0.0.1:48572')) {
      url = url.replace('http://127.0.0.1:48572', baseURL);
      Logger.log('[USER-CONTROLS] 🔄 Redirected to remote:', url.substring(0, 60));
    }

    // Auto-add x-session-id header if available
    const sessionId = localStorage.getItem('sessionId');
    if (sessionId && (url.includes(baseURL) || url.includes('127.0.0.1:48572'))) {
      options = options || {};
      options.headers = options.headers || {};

      // Convert Headers object to plain object if needed
      if (options.headers instanceof Headers) {
        const plainHeaders = {};
        options.headers.forEach((value, key) => {
          plainHeaders[key] = value;
        });
        options.headers = plainHeaders;
      }

      // Add session header if not already present
      if (!options.headers['x-session-id']) {
        options.headers['x-session-id'] = sessionId;
        Logger.log('[USER-CONTROLS] 🔑 Added session header');
      }
    }

    return originalFetch.call(this, url, options);
  };
  Logger.log('[USER-CONTROLS] ✅ Fetch interceptor installed');
  Logger.log('[USER-CONTROLS] Mode:', isClientModeActive() ? 'CLIENT' : 'LOCAL');
})();

// ═══════════════════════════════════════════════════════════════════
// 👤 USER DISPLAY
// ═══════════════════════════════════════════════════════════════════
function updateUserDisplay() {
  Logger.log('[USER-CONTROLS] Updating user display...');
  Logger.log('[USER-CONTROLS] window.currentUser:', window.currentUser);
  
  const user = window.currentUser;
  if (!user) return;
  
  // Support both old and new HTML structures
  const displayEl = document.getElementById('userDisplay') || document.getElementById('currentUserDisplay');
  const avatarEl = document.getElementById('userAvatar');
  
  if (displayEl) {
    // Check if it's the new structure (with user-name and user-role spans)
    const userNameEl = displayEl.querySelector('.user-name');
    const userRoleEl = displayEl.querySelector('.user-role');
    
    if (userNameEl && userRoleEl) {
      // New structure (index.html)
      userNameEl.textContent = user.display_name || user.username || 'مستخدم';
      
      // Role mapping
      const roleMap = {
        'admin': 'مدير',
        'manager': 'مدير',
        'cashier': 'كاشير',
        'employee': 'موظف'
      };
      userRoleEl.textContent = roleMap[user.role] || user.role || '-';
      
      Logger.log('[USER-CONTROLS] ✅ User display updated:', user.display_name || user.username);
    } else {
      // Old structure (simple text)
      displayEl.textContent = user.display_name || user.username || 'مستخدم';
      Logger.log('[USER-CONTROLS] ✅ User display updated:', user.username);
    }
  }
  
  if (avatarEl) {
    const initial = (user.display_name || user.username || 'U')[0].toUpperCase();
    avatarEl.textContent = initial;
  }
  
  // Show users management button for admins
  // Support both selector types
  const usersBtn = document.querySelector('[href="./users.html"]') || 
                   document.getElementById('usersManagementBtn');
  
  if (usersBtn && user.role === 'admin') {
    usersBtn.style.display = 'flex';
    Logger.log('[USER-CONTROLS] ✅ Users management button shown (Admin)');
  }
}

// ═══════════════════════════════════════════════════════════════════
// 🚪 LOGOUT
// ═══════════════════════════════════════════════════════════════════
async function logout() {
  try {
    Logger.log('[USER-CONTROLS] 🚪 Logging out...');
    
    const user = window.currentUser;
    const sessionId = localStorage.getItem('sessionId');
    
    if (sessionId) {
      // Notify server to invalidate session
      try {
        await fetch('elos-db://auth/logout', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-session-id': sessionId
          },
          body: JSON.stringify({ sessionId })
        });
        Logger.log('[USER-CONTROLS] ✅ Server session invalidated');
      } catch (e) {
        Logger.warn('[USER-CONTROLS] Failed to notify server:', e);
      }
    }
    
    // Clear local storage
    localStorage.removeItem('sessionId');
    localStorage.removeItem('currentUser');
    
    Logger.log('[USER-CONTROLS] ✅ Logged out successfully');
    
    // Redirect to login
    window.location.href = './login.html';
  } catch (error) {
    Logger.error('[USER-CONTROLS] ❌ Logout error:', error);
    // Force redirect anyway
    window.location.href = './login.html';
  }
}

// ═══════════════════════════════════════════════════════════════════
// 🕒 UPDATE LAST LOGIN TIME
// ═══════════════════════════════════════════════════════════════════
async function updateLastLogin() {
  try {
    const user = window.currentUser;
    const sessionId = localStorage.getItem('sessionId');
    
    if (!user || !user.id || !sessionId) {
      Logger.log('[USER-CONTROLS] ⏭️  Skipping last login update (no user/session)');
      return;
    }
    
    Logger.log('[USER-CONTROLS] 🕒 Auto-tracked login time');
    
    // Update last login via API (route متاح لكل المستخدمين)
    await fetch('elos-db://users/update-login', {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'x-session-id': sessionId
      },
      body: JSON.stringify({
        last_login: new Date().toISOString()
      })
    });
    
    Logger.log('[USER-CONTROLS] ✅ Last login updated');
  } catch (error) {
    Logger.error('[USER-CONTROLS] ❌ Error updating last login:', error);
    // Not critical - don't block user
  }
}

// ═══════════════════════════════════════════════════════════════════
// 🚀 INITIALIZE
// ═══════════════════════════════════════════════════════════════════
document.addEventListener('DOMContentLoaded', async () => {
  Logger.log('[USER-CONTROLS] DOMContentLoaded event fired');

  const sessionId = localStorage.getItem('sessionId');

  Logger.log('[USER-CONTROLS] localStorage sessionId:', sessionId ? 'Present' : 'Missing');

  // دائماً نتحقق من الـ session أولاً للحصول على أحدث بيانات المستخدم
  if (sessionId) {
    Logger.log('[USER-CONTROLS] 🔄 Verifying session and getting current user...');
    try {
      // استخدام elos-db:// ليتم تحويله تلقائياً للسيرفر الصحيح
      const response = await fetch('elos-db://auth/verify', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-session-id': sessionId
        }
      });

      if (response.ok) {
        const data = await response.json();
        if (data.user) {
          // تحديث localStorage بأحدث بيانات من السيرفر
          localStorage.setItem('currentUser', JSON.stringify(data.user));
          window.currentUser = data.user;
          Logger.log('[USER-CONTROLS] ✅ User verified from session:', data.user.username, 'Role:', data.user.role);
          updateUserDisplay();
          setTimeout(() => updateLastLogin(), 2000);
          return; // Exit early - we're done
        }
      } else if (response.status === 401) {
        // Session انتهت صلاحيتها - redirect to login
        Logger.warn('[USER-CONTROLS] ⚠️ Session expired (401), redirecting to login...');
        localStorage.removeItem('currentUser');
        localStorage.removeItem('sessionId');
        window.location.href = './login.html';
        return;
      } else {
        // خطأ آخر - نستخدم localStorage كـ fallback
        Logger.warn('[USER-CONTROLS] ⚠️ Session verify returned:', response.status);
      }
    } catch (e) {
      Logger.warn('[USER-CONTROLS] Failed to verify session:', e);
      // Fallback to localStorage if server unreachable
    }
  }

  // Fallback: استخدام localStorage إذا فشل التحقق من السيرفر
  const userJson = localStorage.getItem('currentUser');
  if (userJson) {
    try {
      window.currentUser = JSON.parse(userJson);
      Logger.log('[USER-CONTROLS] ✅ User loaded from localStorage (fallback):', window.currentUser);

      // Update display
      updateUserDisplay();

      // Update last login (deferred)
      setTimeout(() => updateLastLogin(), 2000);
    } catch (e) {
      Logger.error('[USER-CONTROLS] ❌ Failed to parse user:', e);
      // Clear corrupted data
      localStorage.removeItem('currentUser');
      localStorage.removeItem('sessionId');
      // Redirect to login
      window.location.href = './login.html';
    }
  } else {
    Logger.warn('[USER-CONTROLS] ⚠️  No user in localStorage');
    // Allow page to load - some pages don't require auth
  }
  
  // Setup logout button
  const logoutBtn = document.getElementById('logoutBtn');
  if (logoutBtn) {
    logoutBtn.addEventListener('click', (e) => {
      e.preventDefault();
      logout();
    });
    Logger.log('[USER-CONTROLS] ✅ Logout button configured');
  }
});

// ═══════════════════════════════════════════════════════════════════
// 🌍 EXPOSE FUNCTIONS GLOBALLY
// ═══════════════════════════════════════════════════════════════════
window.updateUserDisplay = updateUserDisplay;
window.logout = logout;
window.updateLastLogin = updateLastLogin;

Logger.log('[USER-CONTROLS] ✅ User controls script loaded');
