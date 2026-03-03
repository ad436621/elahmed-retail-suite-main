/**
 * ELOS Onboarding Tips System
 * نظام تلميحات للمستخدمين الجدد - يظهر tooltips تعليمية عند أول استخدام
 */

// Logger fallback
if (!window.Logger) window.Logger = { log: () => {}, warn: () => {}, error: console.error, debug: () => {}, info: () => {} };

class OnboardingTips {
  constructor() {
    this.storageKey = 'elos_onboarding';
    this.seenTips = new Set();
    this.activeTip = null;
    this.isEnabled = false; // ✅ تم تعطيل التلميحات نهائياً
    this.tips = {};
    // لا نقوم بـ init لأن النظام معطل
    // this.init();
  }

  init() {
    this.registerTips();
    this.loadProgress();
    Logger.log('[Onboarding] Initialized');
  }

  /**
   * تسجيل التلميحات لكل صفحة/عنصر
   */
  registerTips() {
    this.tips = {
      // الصفحة الرئيسية
      'home-stats': {
        target: '.stats-grid, .stat-card',
        title: 'إحصائيات اليوم',
        message: 'هنا تظهر إحصائيات المبيعات والأرباح اليومية بشكل مباشر',
        position: 'bottom',
        page: 'home'
      },
      'home-quick-actions': {
        target: '.quick-actions, .action-btn',
        title: 'الإجراءات السريعة',
        message: 'اضغط هنا للوصول السريع لأهم العمليات مثل البيع وإضافة منتج',
        position: 'bottom',
        page: 'home'
      },

      // نقطة البيع
      'pos-search': {
        target: '#searchInput, .search-box',
        title: 'البحث عن المنتجات',
        message: 'اكتب اسم المنتج أو الباركود للبحث السريع. يمكنك استخدام قارئ الباركود مباشرة',
        position: 'bottom',
        page: 'pos'
      },
      'pos-cart': {
        target: '.cart, .cart-items, #cartItems',
        title: 'سلة المشتريات',
        message: 'المنتجات المختارة تظهر هنا. يمكنك تعديل الكمية أو حذف منتج',
        position: 'right',
        page: 'pos'
      },
      'pos-checkout': {
        target: '.checkout-btn, #checkoutBtn, .complete-sale',
        title: 'إتمام البيع',
        message: 'اضغط هنا لإتمام عملية البيع وطباعة الفاتورة',
        position: 'top',
        page: 'pos'
      },
      'pos-client': {
        target: '.client-select, #clientSelect, .select-client',
        title: 'اختيار العميل',
        message: 'اختر العميل لتسجيل البيع باسمه. مهم للبيع بالأقساط أو التتبع',
        position: 'bottom',
        page: 'pos'
      },

      // المخزون
      'inventory-add': {
        target: '.add-btn, #addProductBtn, [onclick*="openAddModal"]',
        title: 'إضافة جهاز جديد',
        message: 'اضغط هنا لإضافة جهاز جديد للمخزون. أدخل البيانات والباركود',
        position: 'bottom',
        page: 'inventory'
      },
      'inventory-filter': {
        target: '.filters, .filter-section, .search-filter',
        title: 'تصفية المخزون',
        message: 'استخدم الفلاتر للبحث عن أجهزة محددة حسب النوع أو الحالة',
        position: 'bottom',
        page: 'inventory'
      },
      'inventory-table': {
        target: '.inventory-table, table, .table-container',
        title: 'قائمة الأجهزة',
        message: 'هنا تظهر كل الأجهزة في المخزون. اضغط على صف لعرض التفاصيل',
        position: 'top',
        page: 'inventory'
      },

      // العملاء
      'clients-add': {
        target: '.add-btn, #addClientBtn, [onclick*="openAddModal"]',
        title: 'إضافة عميل جديد',
        message: 'اضغط هنا لإضافة عميل جديد. أدخل الاسم ورقم الهاتف',
        position: 'bottom',
        page: 'clients'
      },
      'clients-search': {
        target: '.search-input, #searchInput',
        title: 'البحث عن عميل',
        message: 'ابحث بالاسم أو رقم الهاتف للعثور على عميل بسرعة',
        position: 'bottom',
        page: 'clients'
      },

      // المبيعات
      'sales-filter': {
        target: '.date-filter, .filter-row',
        title: 'تصفية المبيعات',
        message: 'اختر التاريخ لعرض مبيعات يوم أو فترة محددة',
        position: 'bottom',
        page: 'sales'
      },
      'sales-export': {
        target: '.export-btn, [onclick*="export"]',
        title: 'تصدير البيانات',
        message: 'اضغط هنا لتصدير المبيعات لملف Excel أو PDF',
        position: 'bottom',
        page: 'sales'
      },

      // الخزينة
      'safe-add': {
        target: '.add-transaction, #addTransactionBtn',
        title: 'إضافة حركة مالية',
        message: 'سجل إيراد أو مصروف جديد في الخزينة',
        position: 'bottom',
        page: 'safe'
      },
      'safe-balance': {
        target: '.balance-card, .current-balance',
        title: 'رصيد الخزينة',
        message: 'هذا هو الرصيد الحالي في الخزينة',
        position: 'bottom',
        page: 'safe'
      },

      // Sidebar
      'sidebar-nav': {
        target: '.sidebar, .nav-items',
        title: 'القائمة الجانبية',
        message: 'استخدم القائمة للتنقل بين الصفحات. أو استخدم Ctrl+1 إلى Ctrl+9',
        position: 'left',
        page: '*'
      },

      // التابات
      'tabs-feature': {
        target: '.sidebar, .nav-items',
        title: 'فتح تابات متعددة',
        message: 'اضغط Ctrl + Click على أي صفحة في القائمة لفتحها في تاب جديد. أو اضغط Ctrl+Shift+N لفتح قائمة التنقل السريع',
        position: 'left',
        page: '*'
      },
      'tabs-shortcuts': {
        target: '#tabsBar, .tabs-bar',
        title: 'اختصارات التابات',
        message: 'Ctrl+Tab للتاب التالي، Ctrl+Shift+Tab للسابق، Ctrl+W لإغلاق التاب الحالي',
        position: 'bottom',
        page: '*'
      },

      // Header
      'header-search': {
        target: '.global-search, #globalSearchBtn',
        title: 'البحث الشامل',
        message: 'اضغط Ctrl+K للبحث في كل شيء: أجهزة، عملاء، صفحات',
        position: 'bottom',
        page: '*'
      },
      'header-user': {
        target: '.user-menu, .user-info',
        title: 'قائمة المستخدم',
        message: 'اضغط هنا للوصول للإعدادات أو تسجيل الخروج',
        position: 'bottom',
        page: '*'
      }
    };
  }

  /**
   * تحميل التقدم المحفوظ
   */
  loadProgress() {
    try {
      const saved = localStorage.getItem(this.storageKey);
      if (saved) {
        const data = JSON.parse(saved);
        this.seenTips = new Set(data.seenTips || []);
        this.isEnabled = data.enabled !== false;
      }
    } catch (e) {
      Logger.warn('[Onboarding] Failed to load progress');
    }
  }

  /**
   * حفظ التقدم
   */
  saveProgress() {
    try {
      localStorage.setItem(this.storageKey, JSON.stringify({
        seenTips: Array.from(this.seenTips),
        enabled: this.isEnabled
      }));
    } catch (e) {
      Logger.warn('[Onboarding] Failed to save progress');
    }
  }

  /**
   * إظهار التلميحات للصفحة الحالية
   */
  showTipsForPage(pageName) {
    if (!this.isEnabled) return;

    // تأخير صغير للتأكد من تحميل الصفحة
    setTimeout(() => {
      const pageTips = Object.entries(this.tips)
        .filter(([id, tip]) => {
          // التلميحات العامة (*) أو الخاصة بالصفحة
          return (tip.page === pageName || tip.page === '*') && !this.seenTips.has(id);
        })
        .sort((a, b) => {
          // الأولوية للتلميحات الخاصة بالصفحة
          if (a[1].page === '*' && b[1].page !== '*') return 1;
          if (a[1].page !== '*' && b[1].page === '*') return -1;
          return 0;
        });

      if (pageTips.length > 0) {
        // إظهار أول تلميحة غير مشاهدة
        this.showTip(pageTips[0][0], pageTips[0][1]);
      }
    }, 500);
  }

  /**
   * إظهار تلميحة محددة
   */
  showTip(tipId, tip) {
    // إغلاق أي تلميحة سابقة
    this.closeTip();

    // البحث عن العنصر المستهدف
    const targets = tip.target.split(',').map(s => s.trim());
    let targetEl = null;

    for (const selector of targets) {
      targetEl = document.querySelector(selector);
      if (targetEl) break;
    }

    if (!targetEl) {
      Logger.log('[Onboarding] Target not found:', tip.target);
      // نعتبرها مشاهدة لنتجنب التكرار
      this.markAsSeen(tipId);
      return;
    }

    // إنشاء التلميحة
    const tooltip = document.createElement('div');
    tooltip.className = 'onboarding-tooltip';
    tooltip.id = 'onboarding-tooltip';
    tooltip.innerHTML = `
      <div class="tooltip-arrow"></div>
      <div class="tooltip-content">
        <div class="tooltip-header">
          <span class="tooltip-icon">💡</span>
          <span class="tooltip-title">${tip.title}</span>
          <button class="tooltip-close" onclick="window.onboardingTips?.closeTip()">✕</button>
        </div>
        <div class="tooltip-message">${tip.message}</div>
        <div class="tooltip-footer">
          <button class="tooltip-btn skip" onclick="window.onboardingTips?.skipAll()">تخطي الكل</button>
          <button class="tooltip-btn next" onclick="window.onboardingTips?.nextTip()">فهمت ✓</button>
        </div>
      </div>
    `;

    // إضافة الـ CSS إذا لم يكن موجوداً
    this.injectStyles();

    // إضافة التلميحة للصفحة
    document.body.appendChild(tooltip);

    // حساب موقع التلميحة
    this.positionTooltip(tooltip, targetEl, tip.position);

    // تمييز العنصر المستهدف
    targetEl.classList.add('onboarding-highlight');

    // حفظ المعلومات
    this.activeTip = { id: tipId, tip, targetEl, tooltip };
  }

  /**
   * حساب موقع التلميحة
   */
  positionTooltip(tooltip, target, position) {
    const targetRect = target.getBoundingClientRect();
    const tooltipRect = tooltip.getBoundingClientRect();
    const padding = 12;
    const arrow = tooltip.querySelector('.tooltip-arrow');

    let top, left;

    switch (position) {
      case 'top':
        top = targetRect.top - tooltipRect.height - padding;
        left = targetRect.left + (targetRect.width / 2) - (tooltipRect.width / 2);
        arrow.style.cssText = 'bottom: -8px; left: 50%; transform: translateX(-50%) rotate(180deg);';
        break;

      case 'bottom':
        top = targetRect.bottom + padding;
        left = targetRect.left + (targetRect.width / 2) - (tooltipRect.width / 2);
        arrow.style.cssText = 'top: -8px; left: 50%; transform: translateX(-50%);';
        break;

      case 'left':
        top = targetRect.top + (targetRect.height / 2) - (tooltipRect.height / 2);
        left = targetRect.left - tooltipRect.width - padding;
        arrow.style.cssText = 'right: -8px; top: 50%; transform: translateY(-50%) rotate(90deg);';
        break;

      case 'right':
        top = targetRect.top + (targetRect.height / 2) - (tooltipRect.height / 2);
        left = targetRect.right + padding;
        arrow.style.cssText = 'left: -8px; top: 50%; transform: translateY(-50%) rotate(-90deg);';
        break;

      default:
        top = targetRect.bottom + padding;
        left = targetRect.left;
    }

    // التأكد من عدم خروج التلميحة من الشاشة
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;

    if (left < padding) left = padding;
    if (left + tooltipRect.width > viewportWidth - padding) {
      left = viewportWidth - tooltipRect.width - padding;
    }
    if (top < padding) top = padding;
    if (top + tooltipRect.height > viewportHeight - padding) {
      top = viewportHeight - tooltipRect.height - padding;
    }

    tooltip.style.top = `${top}px`;
    tooltip.style.left = `${left}px`;
  }

  /**
   * إغلاق التلميحة الحالية
   */
  closeTip() {
    const tooltip = document.getElementById('onboarding-tooltip');
    if (tooltip) {
      tooltip.remove();
    }

    if (this.activeTip?.targetEl) {
      this.activeTip.targetEl.classList.remove('onboarding-highlight');
    }

    this.activeTip = null;
  }

  /**
   * التلميحة التالية
   */
  nextTip() {
    if (this.activeTip) {
      this.markAsSeen(this.activeTip.id);
    }
    this.closeTip();

    // إظهار التلميحة التالية للصفحة الحالية
    const currentPage = window.router?.getCurrentRoute()?.path || 'home';
    this.showTipsForPage(currentPage);
  }

  /**
   * تخطي كل التلميحات
   */
  skipAll() {
    this.isEnabled = false;
    this.saveProgress();
    this.closeTip();

    if (window.toast) {
      window.toast.info('تم إيقاف التلميحات. يمكنك تفعيلها من الإعدادات');
    }
  }

  /**
   * تحديد تلميحة كمشاهدة
   */
  markAsSeen(tipId) {
    this.seenTips.add(tipId);
    this.saveProgress();
  }

  /**
   * إعادة تعيين كل التلميحات
   */
  resetAll() {
    this.seenTips.clear();
    this.isEnabled = true;
    this.saveProgress();

    if (window.toast) {
      window.toast.success('تم إعادة تعيين التلميحات');
    }
  }

  /**
   * إضافة الـ CSS
   */
  injectStyles() {
    if (document.getElementById('onboarding-styles')) return;

    const style = document.createElement('style');
    style.id = 'onboarding-styles';
    style.textContent = `
      .onboarding-tooltip {
        position: fixed;
        z-index: 999999;
        animation: tooltipFadeIn 0.3s ease;
      }

      @keyframes tooltipFadeIn {
        from {
          opacity: 0;
          transform: translateY(10px);
        }
        to {
          opacity: 1;
          transform: translateY(0);
        }
      }

      .tooltip-arrow {
        position: absolute;
        width: 0;
        height: 0;
        border-left: 10px solid transparent;
        border-right: 10px solid transparent;
        border-bottom: 10px solid var(--accent, #6366f1);
      }

      .tooltip-content {
        background: linear-gradient(135deg, var(--accent, #6366f1), #8b5cf6);
        border-radius: 12px;
        width: 300px;
        box-shadow: 0 10px 40px rgba(99, 102, 241, 0.4);
        overflow: hidden;
      }

      .tooltip-header {
        display: flex;
        align-items: center;
        gap: 10px;
        padding: 14px 16px;
        background: rgba(0, 0, 0, 0.1);
      }

      .tooltip-icon {
        font-size: 20px;
      }

      .tooltip-title {
        flex: 1;
        font-size: 15px;
        font-weight: 700;
        color: white;
      }

      .tooltip-close {
        background: rgba(255, 255, 255, 0.2);
        border: none;
        color: white;
        width: 24px;
        height: 24px;
        border-radius: 6px;
        cursor: pointer;
        font-size: 14px;
        display: flex;
        align-items: center;
        justify-content: center;
        transition: background 0.2s;
      }

      .tooltip-close:hover {
        background: rgba(255, 255, 255, 0.3);
      }

      .tooltip-message {
        padding: 14px 16px;
        font-size: 13px;
        line-height: 1.6;
        color: rgba(255, 255, 255, 0.95);
      }

      .tooltip-footer {
        display: flex;
        gap: 10px;
        padding: 12px 16px;
        background: rgba(0, 0, 0, 0.15);
      }

      .tooltip-btn {
        flex: 1;
        padding: 10px 16px;
        border: none;
        border-radius: 8px;
        font-size: 13px;
        font-weight: 600;
        cursor: pointer;
        transition: all 0.2s;
      }

      .tooltip-btn.skip {
        background: rgba(255, 255, 255, 0.15);
        color: rgba(255, 255, 255, 0.8);
      }

      .tooltip-btn.skip:hover {
        background: rgba(255, 255, 255, 0.25);
      }

      .tooltip-btn.next {
        background: white;
        color: var(--accent, #6366f1);
      }

      .tooltip-btn.next:hover {
        transform: translateY(-1px);
        box-shadow: 0 4px 12px rgba(0, 0, 0, 0.2);
      }

      /* تمييز العنصر المستهدف */
      .onboarding-highlight {
        position: relative;
        z-index: 99999;
        box-shadow: 0 0 0 4px var(--accent, #6366f1), 0 0 20px rgba(99, 102, 241, 0.4) !important;
        border-radius: 8px;
        animation: highlightPulse 2s ease-in-out infinite;
      }

      @keyframes highlightPulse {
        0%, 100% {
          box-shadow: 0 0 0 4px var(--accent, #6366f1), 0 0 20px rgba(99, 102, 241, 0.4);
        }
        50% {
          box-shadow: 0 0 0 6px var(--accent, #6366f1), 0 0 30px rgba(99, 102, 241, 0.6);
        }
      }

      /* Overlay خلف التلميحة */
      .onboarding-overlay {
        position: fixed;
        inset: 0;
        background: rgba(0, 0, 0, 0.5);
        z-index: 99998;
      }
    `;
    document.head.appendChild(style);
  }

  /**
   * تفعيل/إيقاف التلميحات
   */
  setEnabled(enabled) {
    this.isEnabled = enabled;
    this.saveProgress();
  }

  /**
   * هل المستخدم جديد؟
   */
  isNewUser() {
    return this.seenTips.size < 3;
  }

  /**
   * نسبة التقدم
   */
  getProgress() {
    const total = Object.keys(this.tips).length;
    const seen = this.seenTips.size;
    return Math.round((seen / total) * 100);
  }
}

// إنشاء instance عام
window.onboardingTips = new OnboardingTips();

// ربط مع الـ Router لإظهار التلميحات عند التنقل
if (window.router) {
  window.router.on('afterNavigate', (data) => {
    setTimeout(() => {
      window.onboardingTips?.showTipsForPage(data.route.path);
    }, 300);
  });
}
