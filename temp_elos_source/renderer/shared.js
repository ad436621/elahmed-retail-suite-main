// ═══════════════════════════════════════════════════════════════════════════
// shared.js - Unified Sound Effects & Toast Notifications System
// ═══════════════════════════════════════════════════════════════════════════
// استخدم هذا الملف في كل صفحات المشروع لتوحيد الأصوات والإشعارات
// ═══════════════════════════════════════════════════════════════════════════

// Prevent double-loading: if SoundFX already exists, skip redefinition
if (typeof window.SoundFX !== 'undefined' && window.SoundFX !== null) {
  // SoundFX already loaded, skip redefinition to avoid "already declared" error
  // Exit early - all exports are already available on window object
  if (typeof console !== 'undefined' && console.warn) {
    console.warn('[shared.js] Already loaded, skipping redefinition');
  }
} else {
// ═══════════════════════════════════════════════════════════════════════════
// Logger fallback if utils.js not loaded yet
// ═══════════════════════════════════════════════════════════════════════════
if (!window.Logger) window.Logger = { log: () => {}, warn: () => {}, error: console.error, debug: () => {}, info: () => {} };
var Logger = window.Logger;

// ═══════════════════════════════════════════════════════════════════════════
// 🔊 SOUND EFFECTS SYSTEM
// ═══════════════════════════════════════════════════════════════════════════

var SoundFX = {
  enabled: localStorage.getItem('app_sounds') !== 'off',
  audioContext: null,

  getContext() {
    if (!this.audioContext) {
      this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
    }
    return this.audioContext;
  },

  play(type) {
    if (!this.enabled) return;

    try {
      const ctx = this.getContext();
      const oscillator = ctx.createOscillator();
      const gainNode = ctx.createGain();

      oscillator.connect(gainNode);
      gainNode.connect(ctx.destination);

      // تعريف أنواع الأصوات المختلفة
      const sounds = {
        // أصوات إيجابية
        add: { freq: 800, duration: 0.08, type: 'sine' },
        success: { freq: 1200, duration: 0.15, type: 'sine' },
        save: { freq: 900, duration: 0.12, type: 'sine' },

        // أصوات سلبية
        remove: { freq: 400, duration: 0.12, type: 'triangle' },
        delete: { freq: 300, duration: 0.15, type: 'triangle' },
        error: { freq: 200, duration: 0.25, type: 'square' },

        // أصوات معلوماتية
        scan: { freq: 1000, duration: 0.04, type: 'sine' },
        click: { freq: 600, duration: 0.05, type: 'sine' },
        notify: { freq: 700, duration: 0.1, type: 'sine' },
        warning: { freq: 500, duration: 0.2, type: 'triangle' },

        // أصوات خاصة
        payment: { freq: 1100, duration: 0.2, type: 'sine' },
        print: { freq: 650, duration: 0.08, type: 'sine' },
        refresh: { freq: 550, duration: 0.1, type: 'triangle' }
      };

      const config = sounds[type] || sounds.click;

      oscillator.frequency.value = config.freq;
      oscillator.type = config.type;

      gainNode.gain.setValueAtTime(0.08, ctx.currentTime);
      gainNode.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + config.duration);

      oscillator.start(ctx.currentTime);
      oscillator.stop(ctx.currentTime + config.duration);
    } catch (e) {
      // Sound not supported - fail silently
    }
  },

  toggle() {
    this.enabled = !this.enabled;
    localStorage.setItem('app_sounds', this.enabled ? 'on' : 'off');
    return this.enabled;
  },

  enable() {
    this.enabled = true;
    localStorage.setItem('app_sounds', 'on');
  },

  disable() {
    this.enabled = false;
    localStorage.setItem('app_sounds', 'off');
  }
};

// ═══════════════════════════════════════════════════════════════════════════
// 🔔 TOAST NOTIFICATIONS SYSTEM
// ═══════════════════════════════════════════════════════════════════════════

let _toastContainer = null;

function _createToastContainer() {
  if (_toastContainer && document.body.contains(_toastContainer)) return _toastContainer;

  _toastContainer = document.createElement('div');
  _toastContainer.id = 'toast-container';
  _toastContainer.style.cssText = `
    position: fixed;
    top: 80px;
    left: 50%;
    transform: translateX(-50%);
    z-index: 10000;
    display: flex;
    flex-direction: column;
    gap: 12px;
    pointer-events: none;
  `;
  document.body.appendChild(_toastContainer);
  return _toastContainer;
}

function _ensureToastAnimations() {
  if (!document.getElementById('toast-animations')) {
    const style = document.createElement('style');
    style.id = 'toast-animations';
    style.textContent = `
      @keyframes toastSlideIn {
        from { opacity: 0; transform: translateY(-20px); }
        to { opacity: 1; transform: translateY(0); }
      }
      @keyframes toastSlideOut {
        from { opacity: 1; transform: translateY(0); }
        to { opacity: 0; transform: translateY(-20px); }
      }
    `;
    document.head.appendChild(style);
  }
}

/**
 * عرض إشعار Toast
 * @param {string} message - نص الرسالة
 * @param {string} type - نوع الإشعار: 'success', 'error', 'warning', 'info'
 * @param {number} duration - مدة العرض بالميللي ثانية (افتراضي 3000)
 * @param {boolean} playSound - تشغيل صوت مع الإشعار (افتراضي true)
 */
function showToast(message, type = 'info', duration = 3000, playSound = true) {
  const container = _createToastContainer();
  _ensureToastAnimations();

  // تشغيل صوت مناسب
  if (playSound) {
    const soundMap = {
      success: 'success',
      error: 'error',
      warning: 'warning',
      info: 'notify'
    };
    SoundFX.play(soundMap[type] || 'notify');
  }

  const toast = document.createElement('div');

  const icons = {
    success: '✅',
    error: '❌',
    warning: '⚠️',
    info: 'ℹ️'
  };

  const colors = {
    success: '#10b981',
    error: '#ef4444',
    warning: '#f59e0b',
    info: '#3b82f6'
  };

  toast.innerHTML = `
    <div style="
      background: linear-gradient(135deg, #1a1f29 0%, #151921 100%);
      border: 1px solid ${colors[type]};
      border-radius: 12px;
      padding: 14px 20px;
      color: #e6e8ee;
      box-shadow: 0 8px 32px rgba(0,0,0,0.4), 0 0 0 1px ${colors[type]}40;
      display: flex;
      align-items: center;
      gap: 12px;
      min-width: 280px;
      max-width: 450px;
      pointer-events: auto;
      animation: toastSlideIn 0.3s ease-out;
      font-size: 14px;
      font-weight: 500;
      direction: rtl;
      text-align: right;
    ">
      <span style="font-size: 18px;">${icons[type]}</span>
      <span style="flex: 1; line-height: 1.4;">${message}</span>
    </div>
  `;

  container.appendChild(toast);

  // إزالة تلقائية
  setTimeout(() => {
    toast.style.animation = 'toastSlideOut 0.3s ease-out';
    setTimeout(() => toast.remove(), 300);
  }, duration);

  return toast;
}

// ═══════════════════════════════════════════════════════════════════════════
// 🎯 QUICK HELPER FUNCTIONS
// ═══════════════════════════════════════════════════════════════════════════

// إشعارات سريعة مع أصوات مناسبة
const Toast = {
  success: (msg, duration = 3000) => showToast(msg, 'success', duration),
  error: (msg, duration = 4000) => showToast(msg, 'error', duration),
  warning: (msg, duration = 3500) => showToast(msg, 'warning', duration),
  info: (msg, duration = 3000) => showToast(msg, 'info', duration),

  // إشعارات بدون صوت
  silent: {
    success: (msg, duration = 3000) => showToast(msg, 'success', duration, false),
    error: (msg, duration = 4000) => showToast(msg, 'error', duration, false),
    warning: (msg, duration = 3500) => showToast(msg, 'warning', duration, false),
    info: (msg, duration = 3000) => showToast(msg, 'info', duration, false)
  }
};

// ═══════════════════════════════════════════════════════════════════════════
// 📋 CONFIRMATION DIALOGS
// ═══════════════════════════════════════════════════════════════════════════

/**
 * عرض مربع تأكيد مع تصميم موحد
 * @param {string} message - رسالة التأكيد
 * @param {string} confirmText - نص زر التأكيد (افتراضي: 'تأكيد')
 * @param {string} cancelText - نص زر الإلغاء (افتراضي: 'إلغاء')
 * @param {string} type - نوع التأكيد: 'danger', 'warning', 'info' (افتراضي: 'warning')
 * @returns {Promise<boolean>}
 */
function showConfirm(message, confirmText = 'تأكيد', cancelText = 'إلغاء', type = 'warning') {
  return new Promise((resolve) => {
    SoundFX.play('warning');

    const colors = {
      danger: '#ef4444',
      warning: '#f59e0b',
      info: '#3b82f6'
    };

    // ✅ دعم الوضع الفاتح والداكن
    const isLightMode = document.body.classList.contains('light-mode') ||
                        document.documentElement.getAttribute('data-theme') === 'light' ||
                        window.matchMedia('(prefers-color-scheme: light)').matches && !document.body.classList.contains('dark-mode');

    const bgColor = isLightMode ? 'linear-gradient(135deg, #ffffff 0%, #f8fafc 100%)' : 'linear-gradient(135deg, #1a1f29 0%, #151921 100%)';
    const textColor = isLightMode ? '#1e293b' : '#e6e8ee';
    const borderColor = isLightMode ? '#e2e8f0' : '#3d4350';
    const cancelTextColor = isLightMode ? '#64748b' : '#8b93a6';
    const shadowColor = isLightMode ? 'rgba(0,0,0,0.15)' : 'rgba(0,0,0,0.5)';
    const overlayBg = isLightMode ? 'rgba(0, 0, 0, 0.4)' : 'rgba(0, 0, 0, 0.7)';

    const overlay = document.createElement('div');
    overlay.style.cssText = `
      position: fixed;
      inset: 0;
      background: ${overlayBg};
      backdrop-filter: blur(4px);
      z-index: 10001;
      display: flex;
      align-items: center;
      justify-content: center;
      animation: fadeIn 0.2s ease-out;
    `;

    overlay.innerHTML = `
      <style>
        @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
        @keyframes scaleIn { from { opacity: 0; transform: scale(0.9); } to { opacity: 1; transform: scale(1); } }
        .confirm-dialog-content::-webkit-scrollbar { width: 6px; }
        .confirm-dialog-content::-webkit-scrollbar-track { background: transparent; border-radius: 3px; }
        .confirm-dialog-content::-webkit-scrollbar-thumb { background: ${colors[type]}; border-radius: 3px; }
      </style>
      <div style="
        background: ${bgColor};
        border: 1px solid ${colors[type]};
        border-radius: 16px;
        padding: 24px;
        max-width: 450px;
        width: 90%;
        max-height: 85vh;
        box-shadow: 0 20px 50px ${shadowColor};
        animation: scaleIn 0.2s ease-out;
        direction: rtl;
        text-align: center;
        display: flex;
        flex-direction: column;
      ">
        <div style="font-size: 48px; margin-bottom: 16px; flex-shrink: 0;">
          ${type === 'danger' ? '🗑️' : type === 'warning' ? '⚠️' : 'ℹ️'}
        </div>
        <div class="confirm-dialog-content" style="
          color: ${textColor};
          font-size: 15px;
          line-height: 1.7;
          margin-bottom: 20px;
          white-space: pre-line;
          overflow-y: auto;
          max-height: 50vh;
          padding: 0 8px;
          text-align: right;
          flex: 1;
          min-height: 0;
        ">
          ${message}
        </div>
        <div style="display: flex; gap: 12px; justify-content: center; flex-shrink: 0; padding-top: 4px;">
          <button id="confirmDialogCancel" style="
            padding: 12px 24px;
            border-radius: 8px;
            border: 1px solid ${borderColor};
            background: transparent;
            color: ${cancelTextColor};
            font-size: 14px;
            font-weight: 600;
            cursor: pointer;
            transition: all 0.2s;
          ">${cancelText}</button>
          <button id="confirmDialogOk" style="
            padding: 12px 24px;
            border-radius: 8px;
            border: none;
            background: ${colors[type]};
            color: white;
            font-size: 14px;
            font-weight: 600;
            cursor: pointer;
            transition: all 0.2s;
          ">${confirmText}</button>
        </div>
      </div>
    `;

    document.body.appendChild(overlay);

    const handleConfirm = () => {
      SoundFX.play('click');
      overlay.remove();
      resolve(true);
    };

    const handleCancel = () => {
      SoundFX.play('click');
      overlay.remove();
      resolve(false);
    };

    overlay.querySelector('#confirmDialogOk').addEventListener('click', handleConfirm);
    overlay.querySelector('#confirmDialogCancel').addEventListener('click', handleCancel);
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) handleCancel();
    });

    // ESC للإلغاء
    const escHandler = (e) => {
      if (e.key === 'Escape') {
        document.removeEventListener('keydown', escHandler);
        handleCancel();
      }
    };
    document.addEventListener('keydown', escHandler);
  });
}

// ═══════════════════════════════════════════════════════════════════════════
// 🔄 LOADING INDICATOR
// ═══════════════════════════════════════════════════════════════════════════

const Loading = {
  overlay: null,

  show(message = 'جاري التحميل...') {
    if (this.overlay) return;

    this.overlay = document.createElement('div');
    this.overlay.id = 'loadingOverlay';
    this.overlay.style.cssText = `
      position: fixed;
      inset: 0;
      background: rgba(0, 0, 0, 0.6);
      backdrop-filter: blur(4px);
      z-index: 10002;
      display: flex;
      align-items: center;
      justify-content: center;
      flex-direction: column;
      gap: 16px;
    `;

    this.overlay.innerHTML = `
      <style>
        @keyframes spin { to { transform: rotate(360deg); } }
      </style>
      <div style="
        width: 48px;
        height: 48px;
        border: 4px solid #3d4350;
        border-top-color: #00d4aa;
        border-radius: 50%;
        animation: spin 1s linear infinite;
      "></div>
      <span style="color: #e6e8ee; font-size: 14px;">${message}</span>
    `;

    document.body.appendChild(this.overlay);
  },

  hide() {
    if (this.overlay) {
      this.overlay.remove();
      this.overlay = null;
    }
  },

  async wrap(promise, message = 'جاري التحميل...') {
    this.show(message);
    try {
      return await promise;
    } finally {
      this.hide();
    }
  }
};

// ═══════════════════════════════════════════════════════════════════════════
// 📤 EXPORTS (for module systems)
// ═══════════════════════════════════════════════════════════════════════════

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { SoundFX, showToast, Toast, showConfirm, Loading };
}

// تصدير للـ window للاستخدام في HTML
window.SoundFX = SoundFX;
window.showToast = showToast;
window.Toast = Toast;
window.showConfirm = showConfirm;
window.Loading = Loading;

} // End of double-load prevention guard

// ═══════════════════════════════════════════════════════════════════════════
// 🔧 INPUT FREEZE FIX V3 - حل مشكلة تجمد الـ inputs (محسّن للاستخدام الطويل)
// ═══════════════════════════════════════════════════════════════════════════

// Prevent double-loading: if InputFreezeFix already exists, skip redefinition
if (typeof window.InputFreezeFix === 'undefined' || window.InputFreezeFix === null) {
var InputFreezeFix = {
  checkInterval: null,
  lastCheck: 0,
  initialized: false,
  observer: null,

  // ✅ Bound handlers للـ removal لاحقاً
  _clickHandler: null,
  _focusHandler: null,
  _keydownHandler: null,

  init() {
    // ✅ منع التهيئة المتكررة
    if (this.initialized) {
      Logger.log('[InputFreezeFix] Already initialized, skipping');
      return;
    }
    this.initialized = true;

    // ✅ إنشاء handlers مرة واحدة فقط (bound)
    this._clickHandler = (e) => {
      const input = e.target.closest('input, textarea, select, button');
      if (input) this.quickFix();
    };

    this._focusHandler = (e) => {
      if (e.target.matches && e.target.matches('input, textarea, select')) {
        this.quickFix();
      }
    };

    this._keydownHandler = (e) => {
      const input = e.target.closest('input, textarea, select');
      if (input) this.quickFix();
      if (e.key === 'Escape') {
        setTimeout(() => this.fixBodyState(), 50);
      }
    };

    // ✅ إضافة الـ handlers مرة واحدة فقط
    document.addEventListener('click', this._clickHandler, true);
    document.addEventListener('focus', this._focusHandler, true);
    document.addEventListener('keydown', this._keydownHandler, true);

    // ✅ مراقبة دورية كل 5 ثواني (بدلاً من 3)
    if (this.checkInterval) clearInterval(this.checkInterval);
    this.checkInterval = setInterval(() => {
      this.cleanupOrphanedModals();
    }, 5000);

    // ✅ مراقبة MutationObserver محسّنة
    this.observeDOM();

    // ✅ تنظيف عند إغلاق الصفحة
    window.addEventListener('beforeunload', () => this.destroy());

    Logger.log('[InputFreezeFix] Initialized v3 (optimized for long sessions)');
  },

  // ✅ دالة التنظيف الكامل
  destroy() {
    if (this._clickHandler) {
      document.removeEventListener('click', this._clickHandler, true);
    }
    if (this._focusHandler) {
      document.removeEventListener('focus', this._focusHandler, true);
    }
    if (this._keydownHandler) {
      document.removeEventListener('keydown', this._keydownHandler, true);
    }
    if (this.checkInterval) {
      clearInterval(this.checkInterval);
      this.checkInterval = null;
    }
    if (this.observer) {
      this.observer.disconnect();
      this.observer = null;
    }
    this.initialized = false;
    Logger.log('[InputFreezeFix] Destroyed');
  },

  // إصلاح سريع (يتم استدعاؤه كثيراً)
  quickFix() {
    const now = Date.now();
    if (now - this.lastCheck < 100) return;
    this.lastCheck = now;

    // ✅ FIX: تغطية كل أنواع المودالات في البرنامج
    const hasActiveModal = document.querySelector(
      '.modal-overlay[style*="flex"], .modal-overlay.active, .modal.active, ' +
      '.modal-overlay.show, .cash-tx-modal.show, .drawer-modal-overlay.show, ' +
      '.repairs-modal.active, .day-closing-modal-overlay.show, ' +
      '.unified-checkout-modal.show, .checkout-modal.show, ' +
      '.elos-acc-modal-overlay.visible, .modal[style*="display: flex"]'
    );
    if (!hasActiveModal) {
      if (document.body.style.overflow === 'hidden') {
        document.body.style.overflow = '';
      }
      if (document.body.style.pointerEvents === 'none') {
        document.body.style.pointerEvents = '';
      }
    }
  },

  // ✅ مراقبة الـ DOM محسّنة (observer واحد فقط)
  observeDOM() {
    if (this.observer) {
      this.observer.disconnect();
    }

    this.observer = new MutationObserver((mutations) => {
      for (const mutation of mutations) {
        if (mutation.type === 'attributes' &&
            mutation.attributeName === 'style' &&
            mutation.target === document.body) {
          setTimeout(() => this.quickFix(), 50);
          break;
        }
      }
    });

    this.observer.observe(document.body, {
      attributes: true,
      attributeFilter: ['style']
    });
  },

  // إصلاح حالة الـ body
  fixBodyState() {
    // ✅ FIX: تغطية كل أنواع المودالات
    const activeModals = document.querySelectorAll(
      '.modal-overlay.active, .modal.active, .modal-overlay[style*="flex"], ' +
      '.modal-overlay.show, .cash-tx-modal.show, .drawer-modal-overlay.show, ' +
      '.repairs-modal.active, .day-closing-modal-overlay.show, ' +
      '.unified-checkout-modal.show, .checkout-modal.show, ' +
      '.elos-acc-modal-overlay.visible, .modal[style*="display: flex"]'
    );
    if (activeModals.length === 0) {
      document.body.style.overflow = '';
      document.body.style.pointerEvents = '';
    }
  },

  // ✅ FIX: تنظيف شامل لكل أنواع المودالات المعلقة في البرنامج
  cleanupOrphanedModals() {
    // كل أنواع المودالات في البرنامج
    const visibleModals = document.querySelectorAll(
      '.modal-overlay[style*="flex"], .modal-overlay.active, .modal-overlay.show, ' +
      '.cash-tx-modal.show, .drawer-modal-overlay.show, ' +
      '.repairs-modal.active, .day-closing-modal-overlay.show, ' +
      '.unified-checkout-modal.show, .checkout-modal.show, ' +
      '.elos-acc-modal-overlay.visible, ' +
      '.modal[style*="display: flex"], .modal[style*="display: block"]'
    );
    let hasRealModal = false;

    visibleModals.forEach(modal => {
      // تحقق إن المودال فيه محتوى فعلي (مش overlay فاضي عالق)
      const container = modal.querySelector(
        '.modal, .modal-container, .modal-content, .drawer-modal-container, ' +
        '.cash-tx-content, .checkout-container, .repairs-modal-content, ' +
        '.details-modal, [class*="content"], [class*="container"]'
      );
      if (container && container.offsetHeight > 0) {
        hasRealModal = true;
      } else {
        // ✅ لو الـ modal نفسه هو overlay وفيه child مباشر visible → اعتبره حقيقي
        const anyVisibleChild = modal.querySelector(':scope > *');
        if (anyVisibleChild && anyVisibleChild.offsetHeight > 0) {
          hasRealModal = true;
          return; // skip cleanup
        }
        // تنظيف شامل: كل الطرق الممكنة لإخفاء المودال
        modal.style.display = 'none';
        modal.style.opacity = '';
        modal.style.visibility = '';
        modal.classList.remove('active', 'show', 'visible', 'open');
        Logger.warn('[InputFreezeFix] 🧹 تنظيف modal عالق:', modal.id || modal.className);
      }
    });

    if (!hasRealModal) {
      if (document.body.style.overflow === 'hidden') {
        document.body.style.overflow = '';
      }
      if (document.body.style.pointerEvents === 'none') {
        document.body.style.pointerEvents = '';
      }
    }
  },

  // إصلاح يدوي كامل
  forceReset() {
    document.body.style.overflow = '';
    document.body.style.pointerEvents = '';
    document.body.style.position = '';

    // ✅ FIX: تنظيف كل أنواع المودالات
    document.querySelectorAll(
      '.modal-overlay, .modal, .cash-tx-modal, .drawer-modal-overlay, ' +
      '.repairs-modal, .day-closing-modal-overlay, .unified-checkout-modal, ' +
      '.checkout-modal, .elos-acc-modal-overlay, [class*="modal-overlay"]'
    ).forEach(modal => {
      modal.classList.remove('active', 'show', 'visible', 'open');
      if (modal.style.display === 'flex' || modal.style.display === 'block') {
        modal.style.display = 'none';
      }
      modal.style.opacity = '';
      modal.style.visibility = '';
    });

    document.querySelectorAll('input, textarea, select, button').forEach(el => {
      el.style.pointerEvents = '';
    });

    document.body.click();
    Logger.log('[InputFreezeFix] Force reset completed');
    showToast('تم إعادة تعيين الصفحة', 'success');
  }
};

// ✅ تشغيل الإصلاح مرة واحدة فقط
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => InputFreezeFix.init(), { once: true });
} else {
  InputFreezeFix.init();
}

// تصدير للاستخدام اليدوي
window.InputFreezeFix = InputFreezeFix;
window.fixInputs = () => InputFreezeFix.forceReset();
} else {
  // InputFreezeFix already exists, just ensure it's initialized
  if (window.InputFreezeFix && typeof window.InputFreezeFix.init === 'function') {
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', () => window.InputFreezeFix.init(), { once: true });
    } else {
      window.InputFreezeFix.init();
    }
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// 🎯 MODAL FOCUS HELPER V3 - إصلاح شامل لمشكلة الـ input في الـ modals
// ═══════════════════════════════════════════════════════════════════════════

// ✅ Selector موحد لكل أنواع الـ modals
const MODAL_SELECTOR = '.modal, .modal-overlay, .unified-checkout-modal';

const ModalFocusHelper = {
  initialized: false,
  modalObserver: null,
  bodyObserver: null,
  styleObserver: null,
  observedModals: new WeakSet(), // لتتبع الـ modals اللي اتراقبت

  // ✅ دالة التركيز الفوري على أول input
  focusFirstInput(modalElement, selector = 'input:not([type="hidden"]):not([disabled]), textarea:not([disabled]), select:not([disabled])') {
    if (!modalElement) return;

    const firstInput = modalElement.querySelector(selector);
    if (firstInput) {
      // إزالة أي تأخير - التركيز فوري
      firstInput.focus();
      if (firstInput.select && firstInput.type !== 'checkbox' && firstInput.type !== 'radio') {
        firstInput.select();
      }
    }
  },

  // فتح modal مع focus تلقائي على أول input
  openModal(modalElement, firstInputSelector = 'input:not([type="hidden"]), textarea, select') {
    if (!modalElement) return;

    // إظهار الـ modal
    modalElement.classList.add('active');
    modalElement.style.display = 'flex';

    // ✅ التركيز فوري باستخدام requestAnimationFrame
    requestAnimationFrame(() => {
      this.focusFirstInput(modalElement, firstInputSelector);
    });
  },

  // إغلاق modal مع تنظيف
  closeModal(modalElement) {
    if (!modalElement) return;

    modalElement.classList.remove('active');
    modalElement.style.display = 'none';

    // إعادة body لحالته الطبيعية
    requestAnimationFrame(() => {
      InputFreezeFix.fixBodyState();
    });
  },

  // ✅ مراقبة modal جديد
  observeModal(modal) {
    if (!modal || this.observedModals.has(modal)) return;

    this.observedModals.add(modal);

    if (this.modalObserver) {
      this.modalObserver.observe(modal, {
        attributes: true,
        attributeFilter: ['class', 'style']
      });
    }
  },

  // ✅ تفعيل التركيز التلقائي لكل الـ modals في الصفحة
  initAutoFocus() {
    // ✅ منع التهيئة المتكررة
    if (this.initialized) {
      Logger.log('[ModalFocusHelper] Already initialized, skipping');
      return;
    }
    this.initialized = true;

    // ✅ مراقبة فتح أي modal
    this.modalObserver = new MutationObserver((mutations) => {
      for (const mutation of mutations) {
        if (mutation.type === 'attributes') {
          const target = mutation.target;

          // ✅ لو الـ modal اتفتح (بأي طريقة)
          const isActive = target.classList?.contains('active') ||
                          target.classList?.contains('show') ||
                          (target.style?.display === 'flex' || target.style?.display === 'block');

          if (isActive && target.matches?.(MODAL_SELECTOR)) {
            // ✅ التركيز فوري
            requestAnimationFrame(() => {
              this.focusFirstInput(target);
            });
            break;
          }
        }
      }
    });

    // ✅ مراقبة الـ modals الموجودة
    document.querySelectorAll(MODAL_SELECTOR).forEach(modal => {
      this.observeModal(modal);
    });

    // ✅ مراقبة إضافة modals جديدة للـ body (للـ dynamic modals)
    this.bodyObserver = new MutationObserver((mutations) => {
      for (const mutation of mutations) {
        if (mutation.type === 'childList') {
          mutation.addedNodes.forEach(node => {
            if (node.nodeType === 1) { // Element node
              // ✅ لو الـ node نفسه modal
              if (node.matches?.(MODAL_SELECTOR)) {
                this.observeModal(node);
                // ✅ لو الـ modal اتضاف وهو مفتوح
                const isActive = node.classList?.contains('active') ||
                                node.classList?.contains('show') ||
                                node.style?.display === 'flex';
                if (isActive) {
                  requestAnimationFrame(() => {
                    this.focusFirstInput(node);
                  });
                }
              }
              // ✅ لو الـ node بيحتوي على modals
              node.querySelectorAll?.(MODAL_SELECTOR).forEach(modal => {
                this.observeModal(modal);
              });
            }
          });
        }
      }
    });

    this.bodyObserver.observe(document.body, {
      childList: true,
      subtree: false // مراقبة children المباشرين فقط
    });

    // ✅ مراقبة التغييرات في style لكل الـ document (لالتقاط display changes)
    this.styleObserver = new MutationObserver((mutations) => {
      for (const mutation of mutations) {
        if (mutation.type === 'attributes' && mutation.attributeName === 'style') {
          const target = mutation.target;
          if (target.matches?.(MODAL_SELECTOR)) {
            const isVisible = target.style?.display === 'flex' || target.style?.display === 'block';
            if (isVisible) {
              requestAnimationFrame(() => {
                this.focusFirstInput(target);
              });
            }
          }
        }
      }
    });

    // مراقبة كل الـ modals الموجودة للـ style changes
    document.querySelectorAll(MODAL_SELECTOR).forEach(modal => {
      this.styleObserver.observe(modal, {
        attributes: true,
        attributeFilter: ['style']
      });
    });

    // ✅ تنظيف عند إغلاق الصفحة
    window.addEventListener('beforeunload', () => this.destroy());

    Logger.log('[ModalFocusHelper] Auto-focus initialized v3');
  },

  // ✅ دالة التنظيف
  destroy() {
    if (this.modalObserver) {
      this.modalObserver.disconnect();
      this.modalObserver = null;
    }
    if (this.bodyObserver) {
      this.bodyObserver.disconnect();
      this.bodyObserver = null;
    }
    if (this.styleObserver) {
      this.styleObserver.disconnect();
      this.styleObserver = null;
    }
    this.observedModals = new WeakSet();
    this.initialized = false;
    Logger.log('[ModalFocusHelper] Destroyed');
  }
};

// ✅ تشغيل ModalFocusHelper مرة واحدة فقط
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => ModalFocusHelper.initAutoFocus(), { once: true });
} else {
  ModalFocusHelper.initAutoFocus();
}

window.ModalFocusHelper = ModalFocusHelper;

// ═══════════════════════════════════════════════════════════════════════════
// ⏰ INTERVAL MANAGER - إدارة الـ setInterval لمنع التراكم
// ═══════════════════════════════════════════════════════════════════════════

const IntervalManager = {
  intervals: new Map(),

  // ✅ تسجيل interval جديد (يُلغي القديم إن وُجد)
  set(name, callback, delay) {
    // إلغاء الـ interval القديم بنفس الاسم
    if (this.intervals.has(name)) {
      clearInterval(this.intervals.get(name));
    }

    const id = setInterval(callback, delay);
    this.intervals.set(name, id);
    return id;
  },

  // ✅ إلغاء interval معين
  clear(name) {
    if (this.intervals.has(name)) {
      clearInterval(this.intervals.get(name));
      this.intervals.delete(name);
    }
  },

  // ✅ إلغاء كل الـ intervals
  clearAll() {
    this.intervals.forEach((id, name) => {
      clearInterval(id);
    });
    this.intervals.clear();
    Logger.log('[IntervalManager] All intervals cleared');
  },

  // ✅ عدد الـ intervals النشطة
  count() {
    return this.intervals.size;
  }
};

// تنظيف عند إغلاق الصفحة
window.addEventListener('beforeunload', () => IntervalManager.clearAll());

window.IntervalManager = IntervalManager;

// ═══════════════════════════════════════════════════════════════════════════
// 🕐 CLOCK UPDATER - ساعة موحدة لكل الصفحات
// ═══════════════════════════════════════════════════════════════════════════

const ClockManager = {
  initialized: false,

  init() {
    if (this.initialized) return;
    this.initialized = true;

    // ✅ استخدام IntervalManager لضمان interval واحد فقط
    IntervalManager.set('global-clock', () => this.updateAll(), 1000);
    this.updateAll(); // تحديث فوري
  },

  updateAll() {
    const now = new Date();
    const timeStr = now.toLocaleTimeString('ar-EG', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    });
    const dateStr = now.toLocaleDateString('ar-EG', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });

    // تحديث كل عناصر الوقت في الصفحة
    document.querySelectorAll('#clock, .clock, [data-clock]').forEach(el => {
      el.textContent = timeStr;
    });

    document.querySelectorAll('#date, .date, [data-date]').forEach(el => {
      el.textContent = dateStr;
    });

    document.querySelectorAll('#datetime, .datetime, [data-datetime]').forEach(el => {
      el.textContent = `${dateStr} - ${timeStr}`;
    });
  }
};

// تشغيل تلقائي
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => ClockManager.init(), { once: true });
} else {
  ClockManager.init();
}

window.ClockManager = ClockManager;

Logger.log('[Shared] Sound & Toast system loaded');
Logger.log('[Shared] Input freeze fix v3 loaded - use fixInputs() if inputs freeze');
Logger.log('[Shared] IntervalManager & ClockManager loaded');
