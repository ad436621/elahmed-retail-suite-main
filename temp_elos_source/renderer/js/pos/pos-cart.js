// ═══════════════════════════════════════════════════════════════
// 🛒 POS CART - Shopping Cart Management
// ═══════════════════════════════════════════════════════════════

/**
 * Shopping Cart Management for POS
 * إدارة سلة التسوق في نقطة البيع
 */

window.POSCart = {
  items: [],

  /**
   * Add item to cart
   */
  add(item) {
    // Check if item already exists
    const existingIndex = this.items.findIndex(i => 
      i.item_id === item.item_id && 
      i.item_type === item.item_type
    );

    if (existingIndex >= 0) {
      // Update quantity
      this.items[existingIndex].quantity += (item.quantity || 1);
    } else {
      // Add new item
      this.items.push({
        ...item,
        quantity: item.quantity || 1
      });
    }

    this.updateTotal();
    return this.items;
  },

  /**
   * Remove item from cart
   */
  remove(itemId, itemType) {
    this.items = this.items.filter(i => 
      !(i.item_id === itemId && i.item_type === itemType)
    );
    this.updateTotal();
    return this.items;
  },

  /**
   * Update item quantity
   */
  updateQuantity(itemId, itemType, quantity) {
    const item = this.items.find(i => 
      i.item_id === itemId && i.item_type === itemType
    );

    if (item) {
      if (quantity <= 0) {
        this.remove(itemId, itemType);
      } else {
        item.quantity = quantity;
        this.updateTotal();
      }
    }

    return this.items;
  },

  /**
   * Clear cart
   */
  clear() {
    this.items = [];
    this.updateTotal();
  },

  /**
   * Get cart total
   */
  getTotal() {
    return this.items.reduce((total, item) => {
      const price = Number(item.sell_price || item.unit_price || 0);
      const quantity = Number(item.quantity || 1);
      return total + (price * quantity);
    }, 0);
  },

  /**
   * Get item count
   */
  getItemCount() {
    return this.items.reduce((count, item) => {
      return count + (Number(item.quantity) || 1);
    }, 0);
  },

  /**
   * Update total (triggers UI update if needed)
   */
  updateTotal() {
    const total = this.getTotal();
    const totalEl = document.getElementById('cartTotal');
    if (totalEl) {
      totalEl.textContent = window.fmt ? window.fmt(total) : total.toFixed(2);
    }
    
    // Trigger custom event
    if (typeof window !== 'undefined' && window.dispatchEvent) {
      window.dispatchEvent(new CustomEvent('cartUpdated', {
        detail: { items: this.items, total }
      }));
    }
  }
};

// Export for use in modules
if (typeof module !== 'undefined' && module.exports) {
  module.exports = window.POSCart;
}








