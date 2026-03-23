/**
 * ELOS Toast Notification System
 * نظام إشعارات موحد وأنيق
 */

class ToastManager {
  constructor() {
    this.container = null;
    this.toasts = [];
    this.defaultDuration = 4000;
    this.maxToasts = 5;
    this.init();
  }

  init() {
    // إنشاء الـ container
    this.container = document.createElement('div');
    this.container.id = 'toast-container';
    this.container.innerHTML = `
      <style>
        #toast-container {
          position: fixed;
          top: 20px;
          left: 20px;
          z-index: 999999;
          display: flex;
          flex-direction: column;
          gap: 10px;
          pointer-events: none;
          max-width: 400px;
        }

        .toast {
          display: flex;
          align-items: flex-start;
          gap: 12px;
          padding: 14px 18px;
          border-radius: 12px;
          background: var(--card-bg, #1e1e2e);
          border: 1px solid var(--border-color, #333);
          box-shadow: 0 8px 32px rgba(0, 0, 0, 0.3);
          pointer-events: auto;
          transform: translateX(-120%);
          opacity: 0;
          transition: all 0.4s cubic-bezier(0.68, -0.55, 0.265, 1.55);
          cursor: pointer;
          max-width: 100%;
          backdrop-filter: blur(10px);
        }

        .toast.show {
          transform: translateX(0);
          opacity: 1;
        }

        .toast.hide {
          transform: translateX(-120%);
          opacity: 0;
        }

        .toast-icon {
          font-size: 22px;
          flex-shrink: 0;
          width: 28px;
          height: 28px;
          display: flex;
          align-items: center;
          justify-content: center;
        }

        .toast-content {
          flex: 1;
          min-width: 0;
        }

        .toast-title {
          font-weight: 600;
          font-size: 14px;
          color: var(--text-primary, #fff);
          margin-bottom: 2px;
        }

        .toast-message {
          font-size: 13px;
          color: var(--text-secondary, #aaa);
          line-height: 1.4;
          word-wrap: break-word;
        }

        .toast-close {
          background: none;
          border: none;
          color: var(--text-secondary, #888);
          cursor: pointer;
          padding: 4px;
          font-size: 16px;
          opacity: 0.6;
          transition: opacity 0.2s;
          flex-shrink: 0;
        }

        .toast-close:hover {
          opacity: 1;
        }

        .toast-progress {
          position: absolute;
          bottom: 0;
          right: 0;
          height: 3px;
          background: currentColor;
          opacity: 0.3;
          border-radius: 0 0 12px 0;
          transition: width linear;
        }

        /* أنواع التوست */
        .toast.success {
          border-color: #22c55e40;
          background: linear-gradient(135deg, rgba(34, 197, 94, 0.15), var(--card-bg, #1e1e2e));
        }
        .toast.success .toast-icon { color: #22c55e; }
        .toast.success .toast-progress { background: #22c55e; }

        .toast.error {
          border-color: #ef444440;
          background: linear-gradient(135deg, rgba(239, 68, 68, 0.15), var(--card-bg, #1e1e2e));
        }
        .toast.error .toast-icon { color: #ef4444; }
        .toast.error .toast-progress { background: #ef4444; }

        .toast.warning {
          border-color: #f59e0b40;
          background: linear-gradient(135deg, rgba(245, 158, 11, 0.15), var(--card-bg, #1e1e2e));
        }
        .toast.warning .toast-icon { color: #f59e0b; }
        .toast.warning .toast-progress { background: #f59e0b; }

        .toast.info {
          border-color: #3b82f640;
          background: linear-gradient(135deg, rgba(59, 130, 246, 0.15), var(--card-bg, #1e1e2e));
        }
        .toast.info .toast-icon { color: #3b82f6; }
        .toast.info .toast-progress { background: #3b82f6; }

        /* Animation للأيقونات */
        @keyframes toast-bounce {
          0%, 100% { transform: scale(1); }
          50% { transform: scale(1.2); }
        }

        .toast.show .toast-icon {
          animation: toast-bounce 0.5s ease;
        }
      </style>
    `;
    document.body.appendChild(this.container);
  }

  /**
   * عرض إشعار
   */
  show(options) {
    const {
      type = 'info',
      title = '',
      message = '',
      duration = this.defaultDuration,
      closable = true,
      onClick = null
    } = typeof options === 'string' ? { message: options } : options;

    // التحقق من الحد الأقصى
    while (this.toasts.length >= this.maxToasts) {
      this.dismiss(this.toasts[0].id);
    }

    const id = Date.now() + Math.random();
    const icons = {
      success: '✓',
      error: '✕',
      warning: '⚠',
      info: 'ℹ'
    };

    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.dataset.id = id;
    toast.innerHTML = `
      <div class="toast-icon">${icons[type] || icons.info}</div>
      <div class="toast-content">
        ${title ? `<div class="toast-title">${title}</div>` : ''}
        <div class="toast-message">${message}</div>
      </div>
      ${closable ? '<button class="toast-close">✕</button>' : ''}
      ${duration > 0 ? '<div class="toast-progress"></div>' : ''}
    `;

    // إضافة للـ container
    this.container.appendChild(toast);
    this.toasts.push({ id, element: toast });

    // Animation للدخول
    requestAnimationFrame(() => {
      toast.classList.add('show');
    });

    // Progress bar
    if (duration > 0) {
      const progress = toast.querySelector('.toast-progress');
      if (progress) {
        progress.style.width = '100%';
        progress.style.transitionDuration = duration + 'ms';
        requestAnimationFrame(() => {
          progress.style.width = '0%';
        });
      }

      // إزالة تلقائية
      setTimeout(() => this.dismiss(id), duration);
    }

    // أحداث
    if (closable) {
      toast.querySelector('.toast-close')?.addEventListener('click', (e) => {
        e.stopPropagation();
        this.dismiss(id);
      });
    }

    if (onClick) {
      toast.addEventListener('click', () => {
        onClick();
        this.dismiss(id);
      });
    }

    return id;
  }

  /**
   * إزالة إشعار
   */
  dismiss(id) {
    const index = this.toasts.findIndex(t => t.id === id);
    if (index === -1) return;

    const { element } = this.toasts[index];
    element.classList.remove('show');
    element.classList.add('hide');

    setTimeout(() => {
      element.remove();
      this.toasts.splice(index, 1);
    }, 400);
  }

  /**
   * إزالة كل الإشعارات
   */
  dismissAll() {
    [...this.toasts].forEach(t => this.dismiss(t.id));
  }

  // Shortcuts
  success(message, title = 'نجاح') {
    return this.show({ type: 'success', title, message });
  }

  error(message, title = 'خطأ') {
    return this.show({ type: 'error', title, message });
  }

  warning(message, title = 'تنبيه') {
    return this.show({ type: 'warning', title, message });
  }

  info(message, title = '') {
    return this.show({ type: 'info', title, message });
  }

  /**
   * إشعار تأكيد مع action
   */
  confirm(message, onConfirm, title = 'تأكيد') {
    return this.show({
      type: 'warning',
      title,
      message: message + ' (اضغط للتأكيد)',
      duration: 8000,
      onClick: onConfirm
    });
  }

  /**
   * إشعار تحميل (بدون إغلاق تلقائي)
   */
  loading(message, title = 'جاري التحميل...') {
    return this.show({
      type: 'info',
      title,
      message,
      duration: 0,
      closable: false
    });
  }

  /**
   * تحديث إشعار موجود
   */
  update(id, options) {
    const toast = this.toasts.find(t => t.id === id);
    if (!toast) return;

    const { type, title, message } = options;
    const el = toast.element;

    if (type) {
      el.className = `toast ${type} show`;
      const icons = { success: '✓', error: '✕', warning: '⚠', info: 'ℹ' };
      el.querySelector('.toast-icon').textContent = icons[type];
    }

    if (title !== undefined) {
      const titleEl = el.querySelector('.toast-title');
      if (titleEl) titleEl.textContent = title;
    }

    if (message !== undefined) {
      el.querySelector('.toast-message').textContent = message;
    }

    // إذا كان الإشعار loading وتم تحديثه لنوع آخر، نضيف إغلاق تلقائي
    if (options.autoDismiss !== false && type && type !== 'info') {
      setTimeout(() => this.dismiss(id), 3000);
    }
  }
}

// إنشاء instance عام
window.toast = new ToastManager();

// دالة مساعدة عامة
window.showToast = (type, message, title) => {
  if (window.toast[type]) {
    return window.toast[type](message, title);
  }
  return window.toast.show({ type, message, title });
};
