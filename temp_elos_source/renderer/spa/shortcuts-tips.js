/**
 * ELOS Shortcuts Tips System
 * نظام تعليمي للاختصارات - يظهر نصائح دورية للمستخدم
 */

// Logger fallback if utils.js not loaded yet
if (!window.Logger) window.Logger = { log: () => {}, warn: () => {}, error: console.error, debug: () => {}, info: () => {} };

class ShortcutsTips {
  constructor() {
    this.tips = [];
    this.currentIndex = 0;
    this.intervalId = null;
    this.intervalMinutes = 5; // كل 5 دقائق
    this.isEnabled = true;
    this.shownTips = new Set(); // لتتبع النصائح المعروضة
    this.storageKey = 'elos_shortcuts_tips';
    this.init();
  }

  init() {
    this.registerTips();
    this.loadSettings();
    this.start();
    Logger.log('[ShortcutsTips] Initialized with', this.tips.length, 'tips');
  }

  registerTips() {
    this.tips = [
      // اختصارات البحث والتنقل
      {
        shortcut: 'Ctrl + K',
        title: 'البحث السريع',
        description: 'افتح البحث الشامل للبحث في الأجهزة والعملاء والصفحات',
        icon: '🔍',
        category: 'navigation'
      },
      {
        shortcut: 'Alt + H',
        title: 'الصفحة الرئيسية',
        description: 'العودة للصفحة الرئيسية من أي مكان',
        icon: '🏠',
        category: 'navigation'
      },
      {
        shortcut: 'Alt + ← / →',
        title: 'التنقل للخلف',
        description: 'الرجوع للصفحة السابقة',
        icon: '↩️',
        category: 'navigation'
      },

      // اختصارات الصفحات السريعة
      {
        shortcut: 'Ctrl + 1',
        title: 'الرئيسية',
        description: 'انتقل مباشرة للصفحة الرئيسية',
        icon: '🏠',
        category: 'pages'
      },
      {
        shortcut: 'Ctrl + 2',
        title: 'نقطة البيع',
        description: 'افتح نقطة البيع مباشرة',
        icon: '🛒',
        category: 'pages'
      },
      {
        shortcut: 'Ctrl + 3',
        title: 'المخزون',
        description: 'افتح صفحة مخزون الأجهزة',
        icon: '📱',
        category: 'pages'
      },
      {
        shortcut: 'Ctrl + 4',
        title: 'الإكسسوارات',
        description: 'افتح صفحة الإكسسوارات',
        icon: '🎧',
        category: 'pages'
      },
      {
        shortcut: 'Ctrl + 5',
        title: 'المبيعات',
        description: 'افتح صفحة المبيعات',
        icon: '📈',
        category: 'pages'
      },
      {
        shortcut: 'Ctrl + 6',
        title: 'المشتريات',
        description: 'افتح صفحة المشتريات',
        icon: '📥',
        category: 'pages'
      },
      {
        shortcut: 'Ctrl + 7',
        title: 'العملاء',
        description: 'افتح صفحة العملاء',
        icon: '👥',
        category: 'pages'
      },
      {
        shortcut: 'Ctrl + 8',
        title: 'الخزينة',
        description: 'افتح صفحة الخزينة',
        icon: '🏦',
        category: 'pages'
      },
      {
        shortcut: 'Ctrl + 9',
        title: 'التقارير',
        description: 'افتح صفحة التقارير',
        icon: '📊',
        category: 'pages'
      },

      // التابات
      {
        shortcut: 'Ctrl + Click',
        title: 'فتح تاب جديد',
        description: 'اضغط Ctrl وانقر على أي صفحة في القائمة الجانبية لفتحها في تاب جديد',
        icon: '📑',
        category: 'tabs'
      },
      {
        shortcut: 'Ctrl + Shift + N',
        title: 'قائمة التنقل السريع',
        description: 'افتح قائمة التنقل السريع لفتح أي صفحة في تاب جديد',
        icon: '🚀',
        category: 'tabs'
      },
      {
        shortcut: 'Ctrl + Tab',
        title: 'التاب التالي',
        description: 'انتقل للتاب التالي',
        icon: '➡️',
        category: 'tabs'
      },
      {
        shortcut: 'Ctrl + Shift + Tab',
        title: 'التاب السابق',
        description: 'انتقل للتاب السابق',
        icon: '⬅️',
        category: 'tabs'
      },
      {
        shortcut: 'Ctrl + W',
        title: 'إغلاق التاب',
        description: 'أغلق التاب الحالي (عند وجود أكثر من تاب)',
        icon: '❌',
        category: 'tabs'
      },

      // نصائح عامة
      {
        shortcut: 'ESC',
        title: 'إغلاق النوافذ',
        description: 'أغلق أي نافذة منبثقة أو modal',
        icon: '✖️',
        category: 'general'
      },
      {
        shortcut: 'Enter',
        title: 'تأكيد الإجراء',
        description: 'في نافذة البحث: افتح النتيجة المحددة',
        icon: '✓',
        category: 'general'
      },
      {
        shortcut: '↑ ↓',
        title: 'التنقل في القوائم',
        description: 'تنقل بين النتائج في البحث أو الجداول',
        icon: '⬆️⬇️',
        category: 'general'
      }
    ];
  }

  loadSettings() {
    try {
      const saved = localStorage.getItem(this.storageKey);
      if (saved) {
        const settings = JSON.parse(saved);
        this.isEnabled = settings.enabled !== false;
        this.intervalMinutes = settings.interval || 5;
        this.shownTips = new Set(settings.shownTips || []);
      }
    } catch (e) {
      Logger.warn('[ShortcutsTips] Failed to load settings');
    }
  }

  saveSettings() {
    try {
      localStorage.setItem(this.storageKey, JSON.stringify({
        enabled: this.isEnabled,
        interval: this.intervalMinutes,
        shownTips: Array.from(this.shownTips)
      }));
    } catch (e) {
      Logger.warn('[ShortcutsTips] Failed to save settings');
    }
  }

  start() {
    if (!this.isEnabled) return;

    // إظهار أول نصيحة بعد دقيقة من بدء التطبيق
    setTimeout(() => {
      this.showRandomTip();
    }, 60000); // دقيقة واحدة

    // ثم كل X دقائق
    this.intervalId = setInterval(() => {
      this.showRandomTip();
    }, this.intervalMinutes * 60 * 1000);
  }

  stop() {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
  }

  restart() {
    this.stop();
    this.start();
  }

  /**
   * إظهار نصيحة عشوائية
   */
  showRandomTip() {
    if (!this.isEnabled || !window.toast) return;

    // اختيار نصيحة لم تُعرض بعد (إن أمكن)
    let availableTips = this.tips.filter((_, i) => !this.shownTips.has(i));

    // إذا عُرضت كل النصائح، نبدأ من جديد
    if (availableTips.length === 0) {
      this.shownTips.clear();
      availableTips = this.tips;
    }

    const randomIndex = Math.floor(Math.random() * availableTips.length);
    const tip = availableTips[randomIndex];
    const originalIndex = this.tips.indexOf(tip);

    this.showTip(tip);
    this.shownTips.add(originalIndex);
    this.saveSettings();
  }

  /**
   * إظهار نصيحة محددة
   */
  showTip(tip) {
    if (!window.toast) return;

    window.toast.show({
      type: 'info',
      title: `${tip.icon} اختصار: ${tip.shortcut}`,
      message: `${tip.title}\n${tip.description}`,
      duration: 8000, // 8 ثواني للقراءة
      onClick: () => {
        // عند الضغط على الإشعار، نفتح قائمة كل الاختصارات
        this.showAllShortcuts();
      }
    });
  }

  /**
   * إظهار كل الاختصارات في modal
   */
  showAllShortcuts() {
    // التحقق من وجود modal سابق
    let modal = document.getElementById('shortcuts-modal');
    if (modal) {
      modal.remove();
    }

    modal = document.createElement('div');
    modal.id = 'shortcuts-modal';
    modal.innerHTML = `
      <style>
        #shortcuts-modal {
          position: fixed;
          inset: 0;
          z-index: 999999;
          background: rgba(0, 0, 0, 0.7);
          backdrop-filter: blur(4px);
          display: flex;
          align-items: center;
          justify-content: center;
          animation: fadeIn 0.2s ease;
        }

        @keyframes fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }

        .shortcuts-container {
          background: var(--card-bg, #1e1e2e);
          border-radius: 16px;
          width: 700px;
          max-width: 90vw;
          max-height: 80vh;
          overflow: hidden;
          box-shadow: 0 20px 60px rgba(0, 0, 0, 0.5);
          border: 1px solid var(--border-color, #333);
          animation: slideUp 0.3s ease;
        }

        @keyframes slideUp {
          from {
            opacity: 0;
            transform: translateY(20px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }

        .shortcuts-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 20px 24px;
          border-bottom: 1px solid var(--border-color, #333);
          background: rgba(0, 0, 0, 0.2);
        }

        .shortcuts-title {
          display: flex;
          align-items: center;
          gap: 12px;
          font-size: 18px;
          font-weight: 700;
          color: var(--text-primary, #fff);
        }

        .shortcuts-title-icon {
          font-size: 24px;
        }

        .shortcuts-close {
          background: none;
          border: none;
          color: var(--text-secondary, #888);
          font-size: 24px;
          cursor: pointer;
          padding: 4px 8px;
          border-radius: 8px;
          transition: all 0.2s;
        }

        .shortcuts-close:hover {
          background: var(--bg-tertiary, #2a2a3e);
          color: var(--text-primary, #fff);
        }

        .shortcuts-body {
          padding: 20px 24px;
          overflow-y: auto;
          max-height: calc(80vh - 140px);
        }

        .shortcuts-category {
          margin-bottom: 24px;
        }

        .shortcuts-category:last-child {
          margin-bottom: 0;
        }

        .category-title {
          font-size: 12px;
          font-weight: 700;
          text-transform: uppercase;
          color: var(--text-secondary, #888);
          margin-bottom: 12px;
          letter-spacing: 1px;
        }

        .shortcuts-list {
          display: flex;
          flex-direction: column;
          gap: 8px;
        }

        .shortcut-item {
          display: flex;
          align-items: center;
          gap: 16px;
          padding: 12px 16px;
          background: var(--bg-tertiary, #2a2a3e);
          border-radius: 10px;
          transition: all 0.2s;
        }

        .shortcut-item:hover {
          background: var(--bg-secondary, #252535);
          transform: translateX(-4px);
        }

        .shortcut-icon {
          font-size: 20px;
          width: 32px;
          text-align: center;
        }

        .shortcut-info {
          flex: 1;
        }

        .shortcut-name {
          font-size: 14px;
          font-weight: 600;
          color: var(--text-primary, #fff);
        }

        .shortcut-desc {
          font-size: 12px;
          color: var(--text-secondary, #888);
          margin-top: 2px;
        }

        .shortcut-keys {
          display: flex;
          gap: 4px;
        }

        .shortcut-key {
          padding: 6px 12px;
          background: linear-gradient(135deg, var(--accent, #6366f1), #8b5cf6);
          color: white;
          border-radius: 6px;
          font-size: 12px;
          font-weight: 700;
          font-family: 'Segoe UI', monospace;
        }

        .shortcuts-footer {
          padding: 16px 24px;
          border-top: 1px solid var(--border-color, #333);
          display: flex;
          align-items: center;
          justify-content: space-between;
          background: rgba(0, 0, 0, 0.1);
        }

        .tips-toggle {
          display: flex;
          align-items: center;
          gap: 10px;
          font-size: 13px;
          color: var(--text-secondary, #888);
        }

        .tips-toggle input {
          width: 18px;
          height: 18px;
          cursor: pointer;
        }

        .tips-interval {
          display: flex;
          align-items: center;
          gap: 8px;
          font-size: 13px;
          color: var(--text-secondary, #888);
        }

        .tips-interval select {
          padding: 6px 10px;
          background: var(--bg-tertiary, #2a2a3e);
          border: 1px solid var(--border-color, #444);
          border-radius: 6px;
          color: var(--text-primary, #fff);
          font-size: 12px;
          cursor: pointer;
        }
      </style>

      <div class="shortcuts-container">
        <div class="shortcuts-header">
          <div class="shortcuts-title">
            <span class="shortcuts-title-icon">⌨️</span>
            <span>اختصارات لوحة المفاتيح</span>
          </div>
          <button class="shortcuts-close" onclick="this.closest('#shortcuts-modal').remove()">✕</button>
        </div>

        <div class="shortcuts-body">
          ${this.renderCategories()}
        </div>

        <div class="shortcuts-footer">
          <label class="tips-toggle">
            <input type="checkbox" id="tips-enabled" ${this.isEnabled ? 'checked' : ''}>
            <span>إظهار نصائح الاختصارات</span>
          </label>
          <div class="tips-interval">
            <span>كل</span>
            <select id="tips-interval">
              <option value="3" ${this.intervalMinutes === 3 ? 'selected' : ''}>3 دقائق</option>
              <option value="5" ${this.intervalMinutes === 5 ? 'selected' : ''}>5 دقائق</option>
              <option value="10" ${this.intervalMinutes === 10 ? 'selected' : ''}>10 دقائق</option>
              <option value="15" ${this.intervalMinutes === 15 ? 'selected' : ''}>15 دقيقة</option>
              <option value="30" ${this.intervalMinutes === 30 ? 'selected' : ''}>30 دقيقة</option>
            </select>
          </div>
        </div>
      </div>
    `;

    document.body.appendChild(modal);

    // إغلاق عند الضغط على الخلفية
    modal.addEventListener('click', (e) => {
      if (e.target === modal) {
        modal.remove();
      }
    });

    // إغلاق بـ ESC
    const handleEsc = (e) => {
      if (e.key === 'Escape') {
        modal.remove();
        document.removeEventListener('keydown', handleEsc);
      }
    };
    document.addEventListener('keydown', handleEsc);

    // ربط أحداث التغيير
    modal.querySelector('#tips-enabled').addEventListener('change', (e) => {
      this.isEnabled = e.target.checked;
      this.saveSettings();
      if (this.isEnabled) {
        this.restart();
        window.toast?.success('تم تفعيل نصائح الاختصارات');
      } else {
        this.stop();
        window.toast?.info('تم إيقاف نصائح الاختصارات');
      }
    });

    modal.querySelector('#tips-interval').addEventListener('change', (e) => {
      this.intervalMinutes = parseInt(e.target.value);
      this.saveSettings();
      this.restart();
      window.toast?.success(`سيتم إظهار النصائح كل ${this.intervalMinutes} دقائق`);
    });
  }

  renderCategories() {
    const categories = {
      navigation: { title: 'التنقل والبحث', tips: [] },
      pages: { title: 'الوصول السريع للصفحات', tips: [] },
      tabs: { title: 'التابات المتعددة', tips: [] },
      general: { title: 'اختصارات عامة', tips: [] }
    };

    this.tips.forEach(tip => {
      if (categories[tip.category]) {
        categories[tip.category].tips.push(tip);
      }
    });

    return Object.values(categories).map(cat => `
      <div class="shortcuts-category">
        <div class="category-title">${cat.title}</div>
        <div class="shortcuts-list">
          ${cat.tips.map(tip => `
            <div class="shortcut-item">
              <span class="shortcut-icon">${tip.icon}</span>
              <div class="shortcut-info">
                <div class="shortcut-name">${tip.title}</div>
                <div class="shortcut-desc">${tip.description}</div>
              </div>
              <div class="shortcut-keys">
                ${tip.shortcut.split(' + ').map(key => `<span class="shortcut-key">${key}</span>`).join('')}
              </div>
            </div>
          `).join('')}
        </div>
      </div>
    `).join('');
  }

  /**
   * تغيير حالة التفعيل
   */
  setEnabled(enabled) {
    this.isEnabled = enabled;
    this.saveSettings();
    if (enabled) {
      this.restart();
    } else {
      this.stop();
    }
  }

  /**
   * تغيير الفترة الزمنية
   */
  setInterval(minutes) {
    this.intervalMinutes = minutes;
    this.saveSettings();
    this.restart();
  }
}

// إنشاء instance عام
window.shortcutsTips = new ShortcutsTips();

// إضافة اختصار لفتح قائمة الاختصارات (Ctrl + /)
document.addEventListener('keydown', (e) => {
  if ((e.ctrlKey || e.metaKey) && e.key === '/') {
    e.preventDefault();
    window.shortcutsTips?.showAllShortcuts();
  }
});
