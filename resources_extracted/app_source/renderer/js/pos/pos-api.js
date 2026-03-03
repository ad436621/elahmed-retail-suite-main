// ═══════════════════════════════════════════════════════════════
// 🌐 POS API - API Calls for POS System
// ═══════════════════════════════════════════════════════════════

/**
 * API wrapper for POS system
 * واجهة برمجية موحدة لجميع استدعاءات API في POS
 */

window.POSAPI = {
  /**
   * Generic API call with error handling
   */
  async call(endpoint, options = {}) {
    try {
      const response = await fetch(`elos-db://${endpoint}`, {
        method: options.method || 'GET',
        headers: {
          'Content-Type': 'application/json',
          ...options.headers
        },
        body: options.body ? JSON.stringify(options.body) : undefined
      });

      if (!response.ok) {
        throw new Error(`API Error: ${response.status} ${response.statusText}`);
      }

      return await response.json();
    } catch (error) {
      Logger.error(`[POSAPI] Error calling ${endpoint}:`, error);
      throw error;
    }
  },

  /**
   * Get devices
   */
  async getDevices(params = {}) {
    const queryParams = new URLSearchParams(params).toString();
    return this.call(`devices?${queryParams}`);
  },

  /**
   * Get accessories
   */
  async getAccessories(params = {}) {
    const queryParams = new URLSearchParams(params).toString();
    return this.call(`accessories?${queryParams}`);
  },

  /**
   * Get clients
   */
  async getClients(params = {}) {
    const queryParams = new URLSearchParams(params).toString();
    return this.call(`clients?${queryParams}`);
  },

  /**
   * Create sale
   */
  async createSale(saleData) {
    return this.call('sell', {
      method: 'POST',
      body: saleData
    });
  },

  /**
   * Get today's sales
   */
  async getTodaySales() {
    const today = new Date().toISOString().slice(0, 10);
    return this.call(`sales?from=${today}&to=${today}`);
  }
};

// Export for use in modules
if (typeof module !== 'undefined' && module.exports) {
  module.exports = window.POSAPI;
}








