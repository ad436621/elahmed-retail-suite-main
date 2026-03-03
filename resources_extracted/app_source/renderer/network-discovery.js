// network-discovery.js - Network Discovery and Connection Management
// ═══════════════════════════════════════════════════════════════════

(function() {
  'use strict';

  // ═══════════════════════════════════════════════════════════════════
  // 🌐 NETWORK DISCOVERY MODULE
  // ═══════════════════════════════════════════════════════════════════

  const NetworkDiscovery = {
    // Configuration
    config: {
      port: 48572,
      scanTimeout: 500,       // Timeout per host in ms
      maxParallelScans: 20,   // Number of parallel scans
      retryAttempts: 2        // Number of retry attempts
    },

    // Cached discovered servers
    discoveredServers: [],

    // ═══════════════════════════════════════════════════════════════════
    // 🔍 DISCOVERY METHODS
    // ═══════════════════════════════════════════════════════════════════

    /**
     * Discover ELOS servers on the local network
     * @returns {Promise<Array>} Array of discovered servers
     */
    async discover() {
      console.log('[NETWORK-DISCOVERY] Starting network scan...');

      try {
        const response = await fetch('elos-db://api/network/discover');
        if (!response.ok) {
          throw new Error('Discovery API failed');
        }

        const data = await response.json();
        this.discoveredServers = data.servers || [];

        console.log(`[NETWORK-DISCOVERY] Found ${this.discoveredServers.length} servers`);
        return this.discoveredServers;

      } catch (error) {
        console.error('[NETWORK-DISCOVERY] Discovery failed:', error);
        return [];
      }
    },

    /**
     * Test connection to a specific server
     * @param {string} ip - Server IP address
     * @param {number} port - Server port (default 48572)
     * @returns {Promise<Object>} Connection test result
     */
    async testConnection(ip, port = 48572) {
      console.log(`[NETWORK-DISCOVERY] Testing connection to ${ip}:${port}...`);

      try {
        const response = await fetch(`elos-db://api/network/test-connection?ip=${ip}&port=${port}`);
        const data = await response.json();

        if (data.success) {
          console.log(`[NETWORK-DISCOVERY] Connection successful to ${data.serverName}`);
          return {
            success: true,
            serverName: data.serverName,
            ip: ip,
            port: port
          };
        } else {
          console.warn(`[NETWORK-DISCOVERY] Connection failed: ${data.error}`);
          return {
            success: false,
            error: data.error,
            ip: ip,
            port: port
          };
        }

      } catch (error) {
        console.error(`[NETWORK-DISCOVERY] Connection test error:`, error);
        return {
          success: false,
          error: error.message,
          ip: ip,
          port: port
        };
      }
    },

    /**
     * Get local IP addresses
     * @returns {Promise<Array>} Array of local IP addresses
     */
    async getLocalIPs() {
      try {
        const response = await fetch('elos-db://api/network/local-ips');
        if (!response.ok) {
          throw new Error('Failed to get local IPs');
        }

        const data = await response.json();
        return data.ips || [];

      } catch (error) {
        console.error('[NETWORK-DISCOVERY] Error getting local IPs:', error);
        return [];
      }
    },

    /**
     * Get current network configuration
     * @returns {Promise<Object>} Network configuration
     */
    async getConfig() {
      try {
        const response = await fetch('elos-db://api/network/current-config');
        if (!response.ok) {
          throw new Error('Failed to get network config');
        }

        return await response.json();

      } catch (error) {
        console.error('[NETWORK-DISCOVERY] Error getting config:', error);
        return {
          mode: 'local',
          clientMode: false,
          isNetworkMode: false
        };
      }
    },

    /**
     * Save network configuration
     * @param {Object} config - Network configuration
     * @returns {Promise<Object>} Save result
     */
    async saveConfig(config) {
      try {
        const response = await fetch('elos-db://api/network/configure', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(config)
        });

        const data = await response.json();

        if (data.success) {
          // Clear cached config
          if (window.clearNetworkConfigCache) {
            window.clearNetworkConfigCache();
          }
          console.log('[NETWORK-DISCOVERY] Configuration saved successfully');
        }

        return data;

      } catch (error) {
        console.error('[NETWORK-DISCOVERY] Error saving config:', error);
        return {
          success: false,
          error: error.message
        };
      }
    },

    // ═══════════════════════════════════════════════════════════════════
    // 🔄 CONNECTION MONITORING
    // ═══════════════════════════════════════════════════════════════════

    // Connection state
    connectionState: {
      isConnected: true,
      lastCheck: null,
      serverInfo: null
    },

    // Monitoring interval
    _monitorInterval: null,

    /**
     * Start connection monitoring
     * @param {number} intervalMs - Check interval in milliseconds
     */
    startMonitoring(intervalMs = 30000) {
      if (this._monitorInterval) {
        this.stopMonitoring();
      }

      console.log('[NETWORK-DISCOVERY] Starting connection monitoring...');

      this._monitorInterval = setInterval(async () => {
        await this.checkConnection();
      }, intervalMs);

      // Initial check
      this.checkConnection();
    },

    /**
     * Stop connection monitoring
     */
    stopMonitoring() {
      if (this._monitorInterval) {
        clearInterval(this._monitorInterval);
        this._monitorInterval = null;
        console.log('[NETWORK-DISCOVERY] Connection monitoring stopped');
      }
    },

    /**
     * Check current connection status
     */
    async checkConnection() {
      try {
        const config = await this.getConfig();

        if (config.clientMode && config.serverIP) {
          // Client mode - check connection to server
          const result = await this.testConnection(config.serverIP, config.port || 48572);

          this.connectionState = {
            isConnected: result.success,
            lastCheck: new Date(),
            serverInfo: result.success ? {
              name: result.serverName,
              ip: config.serverIP,
              port: config.port || 48572
            } : null
          };

          // Dispatch event for UI updates
          window.dispatchEvent(new CustomEvent('network-status-change', {
            detail: this.connectionState
          }));

        } else {
          // Server/Standalone mode - always connected locally
          this.connectionState = {
            isConnected: true,
            lastCheck: new Date(),
            serverInfo: { name: 'Local', ip: '127.0.0.1' }
          };
        }

      } catch (error) {
        console.error('[NETWORK-DISCOVERY] Connection check error:', error);
        this.connectionState.isConnected = false;
        this.connectionState.lastCheck = new Date();
      }
    },

    /**
     * Get current connection status
     * @returns {Object} Connection state
     */
    getConnectionStatus() {
      return this.connectionState;
    },

    // ═══════════════════════════════════════════════════════════════════
    // 🛠️ UTILITY METHODS
    // ═══════════════════════════════════════════════════════════════════

    /**
     * Format IP address for display
     * @param {string} ip - IP address
     * @param {number} port - Port number
     * @returns {string} Formatted address
     */
    formatAddress(ip, port = 48572) {
      return `${ip}:${port}`;
    },

    /**
     * Parse address string into IP and port
     * @param {string} address - Address string (e.g., "192.168.1.100:48572")
     * @returns {Object} { ip, port }
     */
    parseAddress(address) {
      const parts = address.split(':');
      return {
        ip: parts[0],
        port: parseInt(parts[1]) || 48572
      };
    },

    /**
     * Validate IP address format
     * @param {string} ip - IP address to validate
     * @returns {boolean} True if valid
     */
    isValidIP(ip) {
      const pattern = /^(\d{1,3}\.){3}\d{1,3}$/;
      if (!pattern.test(ip)) return false;

      const parts = ip.split('.');
      return parts.every(part => {
        const num = parseInt(part);
        return num >= 0 && num <= 255;
      });
    },

    /**
     * Validate port number
     * @param {number|string} port - Port number to validate
     * @returns {boolean} True if valid
     */
    isValidPort(port) {
      const num = parseInt(port);
      return num >= 1 && num <= 65535;
    }
  };

  // ═══════════════════════════════════════════════════════════════════
  // 🎯 NETWORK STATUS UI COMPONENT
  // ═══════════════════════════════════════════════════════════════════

  const NetworkStatusUI = {
    // Status indicator element
    _element: null,

    /**
     * Create and inject status indicator
     * @param {string} containerId - ID of container element (optional)
     */
    init(containerId = null) {
      // Listen for status changes
      window.addEventListener('network-status-change', (event) => {
        this.updateStatus(event.detail);
      });

      // Start monitoring
      NetworkDiscovery.startMonitoring();
    },

    /**
     * Update status display
     * @param {Object} status - Connection status
     */
    updateStatus(status) {
      if (!this._element) return;

      if (status.isConnected) {
        this._element.innerHTML = `
          <span style="color: #10b981;">● متصل</span>
          ${status.serverInfo ? `<small>${status.serverInfo.name}</small>` : ''}
        `;
      } else {
        this._element.innerHTML = `
          <span style="color: #ef4444;">● غير متصل</span>
        `;
      }
    },

    /**
     * Create status indicator element
     * @returns {HTMLElement} Status indicator element
     */
    createIndicator() {
      const indicator = document.createElement('div');
      indicator.className = 'network-status-indicator';
      indicator.style.cssText = `
        position: fixed;
        bottom: 20px;
        left: 20px;
        background: var(--bg-secondary, #1f2937);
        border: 1px solid var(--border, #374151);
        border-radius: 8px;
        padding: 8px 16px;
        font-size: 12px;
        display: flex;
        align-items: center;
        gap: 8px;
        z-index: 9999;
        box-shadow: 0 4px 12px rgba(0,0,0,0.2);
      `;

      this._element = indicator;
      return indicator;
    }
  };

  // ═══════════════════════════════════════════════════════════════════
  // 🌍 EXPORT TO GLOBAL SCOPE
  // ═══════════════════════════════════════════════════════════════════

  window.NetworkDiscovery = NetworkDiscovery;
  window.NetworkStatusUI = NetworkStatusUI;

  console.log('[NETWORK-DISCOVERY] Module loaded successfully');

})();
