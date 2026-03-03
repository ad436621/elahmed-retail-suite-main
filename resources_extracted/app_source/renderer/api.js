// api.js - Enhanced API Wrapper with Advanced User Management & Network Support
// ═══════════════════════════════════════════════════════════════════

// Fallbacks if utils.js not loaded yet
if (!window.Logger) window.Logger = { log: () => {}, warn: () => {}, error: console.error, debug: () => {}, info: () => {} };
var Logger = window.Logger;

// ═══════════════════════════════════════════════════════════════════
// 🌐 NETWORK MODE CONFIGURATION
// ═══════════════════════════════════════════════════════════════════

// Cache for network configuration
let _networkConfig = null;
let _networkConfigLoaded = false;

/**
 * Get network configuration from local storage or server
 * دعم وضع العميل من شاشة التفعيل
 */
async function getNetworkConfig() {
  // Return cached config if available
  if (_networkConfigLoaded && _networkConfig) {
    return _networkConfig;
  }

  // ═══════════════════════════════════════════════════════════════════
  // 🔗 CHECK CLIENT MODE FROM LICENSE PAGE SETTINGS
  // ═══════════════════════════════════════════════════════════════════
  const elosMode = localStorage.getItem('elos_mode');
  const serverIP = localStorage.getItem('elos_server_ip');
  const serverPort = localStorage.getItem('elos_server_port');

  if (elosMode === 'client' && serverIP) {
    // تم ضبط العميل من شاشة التفعيل
    _networkConfig = {
      mode: 'client',
      clientMode: true,
      isNetworkMode: true,
      serverIP: serverIP,
      port: parseInt(serverPort) || 48572
    };
    _networkConfigLoaded = true;
    Logger.log('[API] 🔗 Client mode detected from license setup:', serverIP);
    return _networkConfig;
  }

  // Try to get from localStorage (old method)
  const cachedConfig = localStorage.getItem('networkConfig');
  if (cachedConfig) {
    try {
      _networkConfig = JSON.parse(cachedConfig);
      _networkConfigLoaded = true;
      return _networkConfig;
    } catch (e) {
      // Invalid cache, fetch fresh
    }
  }

  // Fetch from server (only for local/server mode)
  try {
    const response = await window._originalFetch('elos-db://api/network/current-config');
    if (response.ok) {
      _networkConfig = await response.json();
      _networkConfigLoaded = true;
      // Cache it
      localStorage.setItem('networkConfig', JSON.stringify(_networkConfig));
      return _networkConfig;
    }
  } catch (e) {
    Logger.warn('[API] Could not load network config:', e.message);
  }

  // Default: standalone mode
  _networkConfig = { mode: 'local', clientMode: false, isNetworkMode: false };
  _networkConfigLoaded = true;
  return _networkConfig;
}

/**
 * Clear network config cache (call after changing settings)
 */
function clearNetworkConfigCache() {
  _networkConfig = null;
  _networkConfigLoaded = false;
  localStorage.removeItem('networkConfig');
}

/**
 * Convert elos-db:// URL to HTTP URL for remote server
 */
function convertToRemoteUrl(elosUrl, serverIP, port) {
  // elos-db://route -> http://serverIP:port/route
  const route = elosUrl.replace('elos-db://', '');
  return `http://${serverIP}:${port}/${route}`;
}

// Store original fetch for later use
window._originalFetch = window.fetch;

(function() {
  if (window._apiFetchPatched) {
    Logger.log('[API] Already patched');
    return;
  }

  const originalFetch = window._originalFetch;

  window.fetch = async function(url, options = {}) {
    const isElosRequest = typeof url === 'string' && url.includes('elos-db://');

    if (isElosRequest) {
      const sessionId = localStorage.getItem('sessionId');

      // Add session header
      if (sessionId) {
        if (!options.headers) {
          options.headers = {};
        }

        if (options.headers instanceof Headers) {
          options.headers.set('x-session-id', sessionId);
        } else if (typeof options.headers === 'object') {
          options.headers['x-session-id'] = sessionId;
        }
      }

      // Check if we're in client mode (connecting to remote server)
      const config = await getNetworkConfig();

      if (config.clientMode && config.serverIP) {
        // Convert to HTTP request to remote server
        const remoteUrl = convertToRemoteUrl(url, config.serverIP, config.port || 48572);
        Logger.log('[API] Remote Request:', remoteUrl.substring(0, 60), options.method || 'GET');

        try {
          const response = await originalFetch.call(this, remoteUrl, options);
          return response;
        } catch (error) {
          Logger.error('[API] Remote server error:', error.message);

          // Show connection error to user
          if (window.showToast) {
            window.showToast('فشل الاتصال بالسيرفر. تأكد من تشغيله.', 'error');
          }

          throw new Error('SERVER_CONNECTION_FAILED: ' + error.message);
        }
      } else {
        // Local request (normal elos-db protocol)
        Logger.log('[API] Local Request:', url.substring(0, 50), options.method || 'GET');
      }
    }

    return originalFetch.call(this, url, options);
  };

  window._apiFetchPatched = true;
  Logger.log('[API] ✅ Fetch patched with network support');
})();

// Expose network functions globally
window.getNetworkConfig = getNetworkConfig;
window.clearNetworkConfigCache = clearNetworkConfigCache;

// ═══════════════════════════════════════════════════════════════════
// API WRAPPER
// ═══════════════════════════════════════════════════════════════════

window.api = {
  // GET request
  async get(route) {
    const sessionId = localStorage.getItem('sessionId');
    
    const response = await fetch(`elos-db://${route}`, {
      method: 'GET',
      headers: {
        'x-session-id': sessionId
      }
    });
    
    if (response.status === 401) {
      Logger.error('[API] 401 Unauthorized - redirecting to login');
      window.location.href = 'login.html';
      throw new Error('Unauthorized');
    }
    
    if (!response.ok) {
      const error = await response.text();
      throw new Error(error);
    }
    
    return response.json();
  },
  
  // POST request
  async post(route, data) {
    const sessionId = localStorage.getItem('sessionId');
    
    const response = await fetch(`elos-db://${route}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-session-id': sessionId
      },
      body: JSON.stringify(data)
    });
    
    if (response.status === 401) {
      Logger.error('[API] 401 Unauthorized - redirecting to login');
      window.location.href = 'login.html';
      throw new Error('Unauthorized');
    }
    
    if (!response.ok) {
      const error = await response.text();
      throw new Error(error);
    }
    
    return response.json();
  },
  
  // PUT request
  async put(route, data) {
    const sessionId = localStorage.getItem('sessionId');
    
    const response = await fetch(`elos-db://${route}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'x-session-id': sessionId
      },
      body: JSON.stringify(data)
    });
    
    if (response.status === 401) {
      Logger.error('[API] 401 Unauthorized - redirecting to login');
      window.location.href = 'login.html';
      throw new Error('Unauthorized');
    }
    
    if (!response.ok) {
      const error = await response.text();
      throw new Error(error);
    }
    
    return response.json();
  },
  
  // DELETE request
  async delete(route) {
    const sessionId = localStorage.getItem('sessionId');
    
    const response = await fetch(`elos-db://${route}`, {
      method: 'DELETE',
      headers: {
        'x-session-id': sessionId
      }
    });
    
    if (response.status === 401) {
      Logger.error('[API] 401 Unauthorized - redirecting to login');
      window.location.href = 'login.html';
      throw new Error('Unauthorized');
    }
    
    if (!response.ok) {
      const error = await response.text();
      throw new Error(error);
    }
    
    return response.json();
  },
  
  // Check if user is logged in
  isLoggedIn() {
    return !!localStorage.getItem('sessionId');
  },

  // Get current user
  getCurrentUser() {
    const userStr = localStorage.getItem('user');
    return userStr ? JSON.parse(userStr) : null;
  },

  // Logout
  async logout() {
    try {
      await this.post('auth/logout', {});
    } catch (err) {
      Logger.error('[API] Logout error:', err);
    } finally {
      localStorage.removeItem('sessionId');
      localStorage.removeItem('user');
      window.location.href = 'login.html';
    }
  },

  // ═══════════════════════════════════════════════════════════════════
  // 🔄 SESSION KEEP-ALIVE SYSTEM - للحفاظ على الجلسة نشطة
  // ═══════════════════════════════════════════════════════════════════

  _keepAliveInterval: null,
  _keepAliveStarted: false,

  /**
   * بدء نظام تجديد الجلسة التلقائي
   * يجدد الجلسة كل 5 دقائق للحفاظ عليها نشطة
   */
  startSessionKeepAlive() {
    if (this._keepAliveStarted) return;

    const KEEP_ALIVE_INTERVAL = 5 * 60 * 1000; // كل 5 دقائق

    this._keepAliveInterval = setInterval(async () => {
      if (!this.isLoggedIn()) {
        this.stopSessionKeepAlive();
        return;
      }

      try {
        const sessionId = localStorage.getItem('sessionId');
        const response = await fetch('elos-db://session/keepalive', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-session-id': sessionId
          }
        });

        if (response.ok) {
          const data = await response.json();
          Logger.log(`[SESSION] ♻️ Keep-alive OK - ${data.remainingHours}h remaining`);
        } else if (response.status === 401) {
          Logger.warn('[SESSION] ⚠️ Session expired - redirecting to login');
          this.stopSessionKeepAlive();
          localStorage.removeItem('sessionId');
          localStorage.removeItem('user');
          // عرض رسالة للمستخدم قبل إعادة التوجيه
          if (typeof showToast === 'function') {
            showToast('انتهت الجلسة. يرجى تسجيل الدخول مرة أخرى.', 'warning');
          }
          setTimeout(() => {
            window.location.href = 'login.html';
          }, 2000);
        }
      } catch (err) {
        Logger.warn('[SESSION] Keep-alive failed:', err.message);
      }
    }, KEEP_ALIVE_INTERVAL);

    this._keepAliveStarted = true;
    Logger.log('[SESSION] 🟢 Session keep-alive started (every 5 minutes)');
  },

  /**
   * إيقاف نظام تجديد الجلسة
   */
  stopSessionKeepAlive() {
    if (this._keepAliveInterval) {
      clearInterval(this._keepAliveInterval);
      this._keepAliveInterval = null;
      this._keepAliveStarted = false;
      Logger.log('[SESSION] 🔴 Session keep-alive stopped');
    }
  },
  
  // ═══════════════════════════════════════════════════════════════════
  // USER MANAGEMENT METHODS
  // ═══════════════════════════════════════════════════════════════════
  
  users: {
    // Get all users
    async getAll() {
      return api.get('users');
    },
    
    // Get single user
    async get(userId) {
      return api.get(`users/${userId}`);
    },
    
    // Create user
    async create(userData) {
      return api.post('users', userData);
    },
    
    // Update user
    async update(userId, userData) {
      return api.put(`users/${userId}`, userData);
    },
    
    // Delete user
    async delete(userId) {
      return api.delete(`users/${userId}`);
    },
    
    // Get user activity log
    async getActivity(userId) {
      return api.get(`users/${userId}/activity`);
    },
    
    // Get user sessions
    async getSessions(userId) {
      return api.get(`users/${userId}/sessions`);
    },
    
    // Terminate user session
    async terminateSession(userId, sessionId) {
      return api.delete(`users/${userId}/sessions/${sessionId}`);
    },
    
    // Bulk enable users
    async bulkEnable(userIds) {
      return api.post('users/bulk/enable', { user_ids: userIds });
    },
    
    // Bulk disable users
    async bulkDisable(userIds) {
      return api.post('users/bulk/disable', { user_ids: userIds });
    },
    
    // Bulk delete users
    async bulkDelete(userIds) {
      return api.post('users/bulk/delete', { user_ids: userIds });
    },
    
    // Reset password
    async resetPassword(userId, newPassword) {
      return api.put(`users/${userId}`, { password: newPassword });
    },
    
    // Export users
    async export(format = 'csv') {
      return api.get(`users/export?format=${format}`);
    },
    
    // Import users
    async import(fileData) {
      return api.post('users/import', fileData);
    },
    
    // Get statistics
    async getStats() {
      return api.get('users/stats');
    }
  }
};

Logger.log('[API] ✅ Enhanced API wrapper loaded');
Logger.log('[API] Available methods: get, post, put, delete, users.*');

// 🔄 بدء نظام تجديد الجلسة تلقائياً إذا كان المستخدم مسجل دخوله
if (api.isLoggedIn()) {
  api.startSessionKeepAlive();
}