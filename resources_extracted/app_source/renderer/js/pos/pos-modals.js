// ═══════════════════════════════════════════════════════════════
// 🎭 POS MODAL SYSTEM - Unified Modal Management
// ═══════════════════════════════════════════════════════════════

/**
 * Unified Modal System for POS
 * نظام موحد لإدارة المودالات في POS
 */

window.POSModals = {
  // قائمة بكل selectors المودالات
  modalSelectors: [
    '.modal[style*="display: flex"]',
    '.modal-overlay[style*="display: flex"]',
    '.cash-tx-modal.show',
    '.drawer-modal-overlay.show',
    '.unified-checkout-modal.show',
    '.checkout-modal.show',
    '#dynamicPrintModal',
    '#help-modal',
    '#shiftConfirmModal',
    '#shiftReportModal',
    '#tradeinRefundModal'
  ],

  // إغلاق كل المودالات المفتوحة
  closeAll(exceptId = null) {
    // ✅ FIX: Never close verification modal when cash drawer is open
    const verificationModal = document.getElementById('cashVerificationModal');
    const shouldKeepVerificationOpen = verificationModal && verificationModal.style.display === 'flex';
    
    // إغلاق مودالات بـ .show class
    document.querySelectorAll('.cash-tx-modal.show, .drawer-modal-overlay.show, .unified-checkout-modal.show, .checkout-modal.show').forEach(modal => {
      if (exceptId && modal.id === exceptId) return;
      if (shouldKeepVerificationOpen && modal.id === 'cashVerificationModal') return;
      modal.classList.remove('show');
    });

    // إغلاق مودالات بـ style="display: flex"
    document.querySelectorAll('.modal, .modal-overlay').forEach(modal => {
      if (exceptId && modal.id === exceptId) return;
      if (shouldKeepVerificationOpen && modal.id === 'cashVerificationModal') return;
      if (modal.style.display === 'flex') {
        modal.style.display = 'none';
      }
    });
  },

  // فتح مودال مع إغلاق الباقي
  open(modalId, closeOthers = true) {
    if (closeOthers) {
      this.closeAll(modalId);
    }
    
    const modal = document.getElementById(modalId);
    if (modal) {
      modal.style.display = 'flex';
      if (modal.classList) {
        modal.classList.add('show');
      }
    }
  },

  // إغلاق مودال
  close(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) {
      modal.style.display = 'none';
      if (modal.classList) {
        modal.classList.remove('show');
      }
    }
  },

  // التحقق من وجود مودال مفتوح
  isOpen(modalId) {
    const modal = document.getElementById(modalId);
    if (!modal) return false;
    return modal.style.display === 'flex' || modal.classList.contains('show');
  }
};

// Export for use in modules
if (typeof module !== 'undefined' && module.exports) {
  module.exports = window.POSModals;
}








