/**
 * ELOS Tabs Manager
 * تابات داخل البرنامج + قائمة تنقل سريع
 */

class TabsManager {
  constructor() {
    this.tabs = [];
    this.activeTabId = null;
    this.tabIdCounter = 0;
    this.maxTabs = 8;
    this.initialized = false;
  }

  init() {
    if (this.initialized) return;

    // إنشاء التاب الأول من الصفحة الحالية
    const currentRoute = window.router?.getCurrentRoute();
    if (currentRoute) {
      this.createTab(currentRoute.path, currentRoute.title, currentRoute.icon, true);
    } else {
      this.createTab('home', 'الرئيسية', '🏠', true);
    }

    // تحديث التاب النشط عند تغيير الصفحة
    if (window.router) {
      window.router.on('afterNavigate', (data) => {
        if (!this._isNewTab) {
          this.updateActiveTab(data.route);
        }
        this._isNewTab = false;
      });
    }

    // اختصارات لوحة المفاتيح
    document.addEventListener('keydown', (e) => {
      // Ctrl+Shift+N = قائمة التنقل السريع
      if (e.ctrlKey && e.shiftKey && (e.key === 'n' || e.key === 'N')) {
        e.preventDefault();
        e.stopPropagation();
        this.showQuickNavigator();
      }
      // Ctrl+W = إغلاق التاب
      if (e.ctrlKey && (e.key === 'w' || e.key === 'W') && this.tabs.length > 1) {
        e.preventDefault();
        this.closeTab(this.activeTabId);
      }
      // Ctrl+Tab = التاب التالي
      if (e.ctrlKey && e.key === 'Tab' && !e.shiftKey) {
        e.preventDefault();
        this.nextTab();
      }
      // Ctrl+Shift+Tab = التاب السابق
      if (e.ctrlKey && e.shiftKey && e.key === 'Tab') {
        e.preventDefault();
        this.prevTab();
      }
    });

    // Ctrl = رفع الـ Sidebar فوق الـ modals
    document.addEventListener('keydown', (e) => {
      if (e.ctrlKey || e.metaKey) {
        this.enableSidebarOverModals(true);
      }
    });
    document.addEventListener('keyup', (e) => {
      if (e.key === 'Control' || e.key === 'Meta') {
        this.enableSidebarOverModals(false);
      }
    });

    // Ctrl+Click على الـ Sidebar = فتح تاب جديد
    document.addEventListener('click', (e) => {
      if (e.ctrlKey || e.metaKey) {
        const navItem = e.target.closest('[data-route]');
        if (navItem) {
          e.preventDefault();
          e.stopPropagation();
          e.stopImmediatePropagation();
          this.openInNewTab(navItem.dataset.route);
          return false;
        }
      }
    }, true);

    this.initialized = true;
    this.renderTabs();
    if (window.Logger) Logger.log('[TabsManager] Initialized');
  }

  createTab(path, title, icon, isActive = false) {
    if (this.tabs.length >= this.maxTabs) {
      if (typeof showToast === 'function') showToast(`الحد الأقصى ${this.maxTabs} تابات`, 'warning');
      return null;
    }

    const tab = {
      id: ++this.tabIdCounter,
      path,
      title,
      icon
    };
    this.tabs.push(tab);

    if (isActive) {
      this.activeTabId = tab.id;
    }

    this.renderTabs();
    return tab;
  }

  openInNewTab(path) {
    const route = window.router?.getRoute(path);
    if (!route) {
      if (typeof showToast === 'function') showToast('الصفحة غير موجودة', 'error');
      return;
    }

    if (window.router && !window.router.checkPermissions(route.permissions)) {
      if (typeof showToast === 'function') showToast('ليس لديك صلاحية', 'error');
      return;
    }

    // إنشاء تاب جديد
    const tab = this.createTab(path, route.title, route.icon, true);
    if (!tab) return;

    this._isNewTab = true;
    window.router.navigate(path);

    if (typeof showToast === 'function') showToast(`تم فتح "${route.title}"`, 'success', 1500);
  }

  switchToTab(tabId) {
    if (this.activeTabId === tabId) return;

    const tab = this.tabs.find(t => t.id === tabId);
    if (!tab) return;

    this.activeTabId = tabId;
    this._isNewTab = true;
    window.router.navigate(tab.path, {}, { force: true });
    this.renderTabs();
  }

  closeTab(tabId) {
    const index = this.tabs.findIndex(t => t.id === tabId);
    if (index === -1 || this.tabs.length === 1) return;

    // لو التاب المغلق هو النشط، روح للتاب اللي قبله أو بعده
    if (this.activeTabId === tabId) {
      const newIndex = index > 0 ? index - 1 : 1;
      this.switchToTab(this.tabs[newIndex].id);
    }

    this.tabs.splice(index, 1);
    this.renderTabs();
  }

  updateActiveTab(route) {
    const tab = this.tabs.find(t => t.id === this.activeTabId);
    if (tab && route) {
      tab.path = route.path;
      tab.title = route.title;
      tab.icon = route.icon;
      this.renderTabs();
    }
  }

  nextTab() {
    if (this.tabs.length <= 1) return;
    const i = this.tabs.findIndex(t => t.id === this.activeTabId);
    this.switchToTab(this.tabs[(i + 1) % this.tabs.length].id);
  }

  prevTab() {
    if (this.tabs.length <= 1) return;
    const i = this.tabs.findIndex(t => t.id === this.activeTabId);
    this.switchToTab(this.tabs[(i - 1 + this.tabs.length) % this.tabs.length].id);
  }

  enableSidebarOverModals(enable) {
    const sidebar = document.querySelector('.sidebar');
    if (!sidebar) return;

    if (enable) {
      sidebar.style.zIndex = '100001';
      sidebar.classList.add('ctrl-active');
    } else {
      sidebar.style.zIndex = '';
      sidebar.classList.remove('ctrl-active');
    }
  }

  renderTabs() {
    let bar = document.getElementById('tabsBar');

    // إنشاء شريط التابات لو مش موجود
    if (!bar) {
      bar = document.createElement('div');
      bar.id = 'tabsBar';
      bar.className = 'tabs-bar';

      const header = document.querySelector('.top-header');
      if (header && header.nextSibling) {
        header.parentNode.insertBefore(bar, header.nextSibling);
      }

      // إضافة الأنماط
      if (!document.getElementById('tabsStyles')) {
        const style = document.createElement('style');
        style.id = 'tabsStyles';
        style.textContent = `
          .tabs-bar {
            display: none;
            align-items: center;
            background: var(--shell-sidebar-bg, #f8f9fa);
            border-bottom: 1px solid var(--ds-border, #e5e7eb);
            padding: 0 8px;
            height: 36px;
            gap: 2px;
            overflow-x: auto;
          }
          .tabs-bar.visible { display: flex; }
          .tabs-bar::-webkit-scrollbar { height: 2px; }
          .tab-item {
            display: flex;
            align-items: center;
            gap: 6px;
            padding: 6px 12px;
            background: transparent;
            border: none;
            border-radius: 6px 6px 0 0;
            cursor: pointer;
            font-size: 12px;
            font-family: inherit;
            color: var(--ds-text-secondary, #6b7280);
            white-space: nowrap;
            max-width: 160px;
            position: relative;
            transition: all 0.15s;
          }
          .tab-item:hover { background: var(--ds-bg-hover, #f3f4f6); color: var(--ds-text, #111); }
          .tab-item.active {
            background: var(--ds-bg, #fff);
            color: var(--ds-text, #111);
            font-weight: 600;
          }
          .tab-item.active::after {
            content: '';
            position: absolute;
            bottom: 0;
            left: 0;
            right: 0;
            height: 2px;
            background: var(--ds-accent, #3b82f6);
          }
          .tab-icon { font-size: 14px; }
          .tab-title { overflow: hidden; text-overflow: ellipsis; }
          .tab-close {
            opacity: 0;
            margin-right: -4px;
            padding: 2px;
            border-radius: 4px;
            font-size: 14px;
            line-height: 1;
          }
          .tab-item:hover .tab-close { opacity: 0.5; }
          .tab-close:hover { opacity: 1 !important; background: var(--ds-danger, #ef4444); color: white; }
          .tabs-bar-new {
            padding: 4px 8px;
            background: none;
            border: none;
            border-radius: 4px;
            cursor: pointer;
            font-size: 16px;
            color: var(--ds-text-secondary, #6b7280);
            margin-right: auto;
          }
          .tabs-bar-new:hover { background: var(--ds-bg-hover, #f3f4f6); color: var(--ds-accent, #3b82f6); }

          /* Sidebar Ctrl highlight */
          .sidebar.ctrl-active {
            box-shadow: 0 0 0 3px var(--ds-accent, #3b82f6), 0 0 20px rgba(59,130,246,0.3);
          }
          .sidebar.ctrl-active::before {
            content: '⌨️ Ctrl+Click = تاب جديد';
            position: absolute;
            top: 8px;
            left: 50%;
            transform: translateX(-50%);
            background: var(--ds-accent, #3b82f6);
            color: white;
            padding: 5px 10px;
            border-radius: 6px;
            font-size: 11px;
            white-space: nowrap;
            z-index: 10;
          }
          .sidebar.ctrl-active .nav-item:hover {
            background: var(--ds-accent, #3b82f6) !important;
            color: white !important;
          }

          /* Quick Navigator */
          #quickNavigator {
            position: fixed;
            inset: 0;
            z-index: 200000;
            display: flex;
            align-items: flex-start;
            justify-content: center;
            padding-top: 80px;
          }
          .qn-overlay {
            position: absolute;
            inset: 0;
            background: rgba(0,0,0,0.5);
            backdrop-filter: blur(2px);
          }
          .qn-modal {
            position: relative;
            background: var(--ds-bg-card, #fff);
            border-radius: 12px;
            box-shadow: 0 20px 60px rgba(0,0,0,0.3);
            width: 400px;
            max-width: 90vw;
            max-height: 70vh;
            display: flex;
            flex-direction: column;
            animation: qnSlide 0.15s ease;
          }
          @keyframes qnSlide {
            from { opacity: 0; transform: translateY(-20px); }
            to { opacity: 1; transform: translateY(0); }
          }
          .qn-header {
            display: flex;
            align-items: center;
            justify-content: space-between;
            padding: 14px 16px;
            border-bottom: 1px solid var(--ds-border, #eee);
            font-weight: 600;
          }
          .qn-header button {
            background: none;
            border: none;
            font-size: 20px;
            cursor: pointer;
            opacity: 0.6;
          }
          .qn-header button:hover { opacity: 1; }
          .qn-search {
            margin: 12px;
            padding: 10px 12px;
            border: 2px solid var(--ds-border, #ddd);
            border-radius: 8px;
            font-size: 14px;
            font-family: inherit;
            outline: none;
          }
          .qn-search:focus { border-color: var(--ds-accent, #3b82f6); }
          .qn-list { flex: 1; overflow-y: auto; padding: 0 8px 8px; }
          .qn-item {
            display: flex;
            align-items: center;
            gap: 10px;
            width: 100%;
            padding: 10px 12px;
            background: none;
            border: none;
            border-radius: 8px;
            cursor: pointer;
            text-align: right;
            font-family: inherit;
            font-size: 14px;
            color: var(--ds-text, #333);
          }
          .qn-item:hover { background: var(--ds-bg-hover, #f5f5f5); }
          .qn-item.selected { background: var(--ds-accent, #3b82f6); color: white; }
          .qn-item.hidden { display: none; }
          .qn-icon { font-size: 18px; width: 24px; text-align: center; }
          .qn-title { flex: 1; }
          .qn-footer {
            padding: 10px 16px;
            border-top: 1px solid var(--ds-border, #eee);
            font-size: 11px;
            color: var(--ds-text-secondary, #999);
            text-align: center;
          }
          .qn-footer kbd {
            background: var(--ds-bg-hover, #f0f0f0);
            padding: 2px 5px;
            border-radius: 3px;
            font-family: monospace;
          }
        `;
        document.head.appendChild(style);
      }
    }

    // إظهار/إخفاء الشريط
    bar.classList.toggle('visible', this.tabs.length > 1);

    // رسم التابات
    bar.innerHTML = this.tabs.map(tab => `
      <button class="tab-item ${tab.id === this.activeTabId ? 'active' : ''}" data-id="${tab.id}">
        <span class="tab-icon">${tab.icon}</span>
        <span class="tab-title">${tab.title}</span>
        ${this.tabs.length > 1 ? '<span class="tab-close">×</span>' : ''}
      </button>
    `).join('') + '<button class="tabs-bar-new" title="Ctrl+Shift+N">+</button>';

    // Events
    bar.querySelectorAll('.tab-item').forEach(el => {
      el.onclick = (e) => {
        if (e.target.classList.contains('tab-close')) {
          this.closeTab(parseInt(el.dataset.id));
        } else {
          this.switchToTab(parseInt(el.dataset.id));
        }
      };
      el.onmousedown = (e) => {
        if (e.button === 1) { // Middle click
          e.preventDefault();
          this.closeTab(parseInt(el.dataset.id));
        }
      };
    });

    bar.querySelector('.tabs-bar-new').onclick = () => this.showQuickNavigator();
  }

  showQuickNavigator() {
    if (document.getElementById('quickNavigator')) {
      this.hideQuickNavigator();
      return;
    }

    const routes = window.router?.getRoutes() || [];
    const available = routes.filter(r => window.router.checkPermissions(r.permissions));

    const nav = document.createElement('div');
    nav.id = 'quickNavigator';
    nav.innerHTML = `
      <div class="qn-overlay" onclick="tabsManager.hideQuickNavigator()"></div>
      <div class="qn-modal">
        <div class="qn-header">
          <span>🚀 فتح تاب جديد</span>
          <button onclick="tabsManager.hideQuickNavigator()">×</button>
        </div>
        <input type="text" class="qn-search" placeholder="ابحث عن صفحة..." autofocus>
        <div class="qn-list">
          ${available.map(r => `
            <button class="qn-item" data-route="${r.path}">
              <span class="qn-icon">${r.icon}</span>
              <span class="qn-title">${r.title}</span>
            </button>
          `).join('')}
        </div>
        <div class="qn-footer">
          <kbd>↑↓</kbd> تنقل &nbsp; <kbd>Enter</kbd> فتح &nbsp; <kbd>Esc</kbd> إغلاق
        </div>
      </div>
    `;

    document.body.appendChild(nav);

    const search = nav.querySelector('.qn-search');
    const items = nav.querySelectorAll('.qn-item');
    if (items[0]) items[0].classList.add('selected');

    search.oninput = () => {
      const term = search.value.toLowerCase();
      items.forEach(item => {
        const match = item.querySelector('.qn-title').textContent.toLowerCase().includes(term);
        item.classList.toggle('hidden', !match);
      });
      items.forEach(i => i.classList.remove('selected'));
      const first = nav.querySelector('.qn-item:not(.hidden)');
      if (first) first.classList.add('selected');
    };

    items.forEach(item => {
      item.onclick = () => {
        this.hideQuickNavigator();
        this.openInNewTab(item.dataset.route);
      };
    });

    this._qnKey = (e) => {
      if (e.key === 'Escape') this.hideQuickNavigator();
      if (e.key === 'Enter') {
        const sel = nav.querySelector('.qn-item.selected') || nav.querySelector('.qn-item:not(.hidden)');
        if (sel) { this.hideQuickNavigator(); this.openInNewTab(sel.dataset.route); }
      }
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
        e.preventDefault();
        const visible = Array.from(nav.querySelectorAll('.qn-item:not(.hidden)'));
        if (!visible.length) return;
        const cur = visible.findIndex(i => i.classList.contains('selected'));
        visible.forEach(i => i.classList.remove('selected'));
        let next = cur + (e.key === 'ArrowDown' ? 1 : -1);
        if (next < 0) next = visible.length - 1;
        if (next >= visible.length) next = 0;
        visible[next].classList.add('selected');
        visible[next].scrollIntoView({ block: 'nearest' });
      }
    };
    document.addEventListener('keydown', this._qnKey);
    search.focus();
  }

  hideQuickNavigator() {
    const nav = document.getElementById('quickNavigator');
    if (nav) nav.remove();
    if (this._qnKey) {
      document.removeEventListener('keydown', this._qnKey);
      this._qnKey = null;
    }
  }
}

window.tabsManager = new TabsManager();
document.addEventListener('DOMContentLoaded', () => setTimeout(() => window.tabsManager.init(), 300));
