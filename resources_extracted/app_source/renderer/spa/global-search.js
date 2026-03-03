/**
 * ELOS Global Search System
 * نظام البحث الشامل في كل البيانات
 */

// Logger fallback if utils.js not loaded yet
if (!window.Logger) window.Logger = { log: () => {}, warn: () => {}, error: console.error, debug: () => {}, info: () => {} };

class GlobalSearch {
  constructor() {
    this.isOpen = false;
    this.results = [];
    this.selectedIndex = 0;
    this.searchTimeout = null;
    this.cache = new Map();
    this.cacheExpiry = 60000; // 1 دقيقة
    this.init();
  }

  init() {
    this.createModal();
    this.bindKeyboardShortcuts();
  }

  createModal() {
    const modal = document.createElement('div');
    modal.id = 'global-search-modal';
    modal.innerHTML = `
      <style>
        #global-search-modal {
          display: none;
          position: fixed;
          inset: 0;
          z-index: 999998;
          background: rgba(0, 0, 0, 0.6);
          backdrop-filter: blur(4px);
          align-items: flex-start;
          justify-content: center;
          padding-top: 10vh;
        }

        #global-search-modal.open {
          display: flex;
          animation: fadeIn 0.2s ease;
        }

        @keyframes fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }

        .search-container {
          width: 600px;
          max-width: 90vw;
          background: var(--card-bg, #1e1e2e);
          border-radius: 16px;
          box-shadow: 0 20px 60px rgba(0, 0, 0, 0.5);
          border: 1px solid var(--border-color, #333);
          overflow: hidden;
          animation: slideDown 0.3s cubic-bezier(0.34, 1.56, 0.64, 1);
        }

        @keyframes slideDown {
          from {
            opacity: 0;
            transform: translateY(-20px) scale(0.95);
          }
          to {
            opacity: 1;
            transform: translateY(0) scale(1);
          }
        }

        .search-header {
          display: flex;
          align-items: center;
          gap: 12px;
          padding: 16px 20px;
          border-bottom: 1px solid var(--border-color, #333);
        }

        .search-icon {
          font-size: 20px;
          color: var(--accent, #6366f1);
        }

        .search-input {
          flex: 1;
          background: none;
          border: none;
          outline: none;
          font-size: 18px;
          color: var(--text-primary, #fff);
          font-family: inherit;
        }

        .search-input::placeholder {
          color: var(--text-secondary, #888);
        }

        .search-shortcut {
          font-size: 12px;
          padding: 4px 8px;
          background: var(--bg-tertiary, #2a2a3e);
          border-radius: 6px;
          color: var(--text-secondary, #888);
        }

        .search-results {
          max-height: 400px;
          overflow-y: auto;
        }

        .search-results::-webkit-scrollbar {
          width: 6px;
        }

        .search-results::-webkit-scrollbar-thumb {
          background: var(--border-color, #444);
          border-radius: 3px;
        }

        .search-category {
          padding: 8px 20px 4px;
          font-size: 11px;
          font-weight: 600;
          color: var(--text-secondary, #888);
          text-transform: uppercase;
          letter-spacing: 0.5px;
        }

        .search-result-item {
          display: flex;
          align-items: center;
          gap: 14px;
          padding: 12px 20px;
          cursor: pointer;
          transition: background 0.15s;
        }

        .search-result-item:hover,
        .search-result-item.selected {
          background: var(--bg-tertiary, #2a2a3e);
        }

        .search-result-icon {
          width: 40px;
          height: 40px;
          border-radius: 10px;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 18px;
          flex-shrink: 0;
        }

        .search-result-icon.device { background: linear-gradient(135deg, #6366f1, #8b5cf6); }
        .search-result-icon.accessory { background: linear-gradient(135deg, #f59e0b, #ef4444); }
        .search-result-icon.client { background: linear-gradient(135deg, #22c55e, #10b981); }
        .search-result-icon.supplier { background: linear-gradient(135deg, #3b82f6, #0ea5e9); }
        .search-result-icon.sale { background: linear-gradient(135deg, #ec4899, #f43f5e); }
        .search-result-icon.page { background: linear-gradient(135deg, #64748b, #94a3b8); }

        .search-result-info {
          flex: 1;
          min-width: 0;
        }

        .search-result-title {
          font-size: 14px;
          font-weight: 500;
          color: var(--text-primary, #fff);
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }

        .search-result-subtitle {
          font-size: 12px;
          color: var(--text-secondary, #888);
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }

        .search-result-badge {
          font-size: 11px;
          padding: 4px 10px;
          border-radius: 20px;
          background: var(--accent, #6366f1);
          color: white;
          flex-shrink: 0;
        }

        .search-empty {
          padding: 40px 20px;
          text-align: center;
          color: var(--text-secondary, #888);
        }

        .search-empty-icon {
          font-size: 48px;
          margin-bottom: 12px;
          opacity: 0.5;
        }

        .search-loading {
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 30px;
          gap: 10px;
          color: var(--text-secondary, #888);
        }

        .search-loading .spinner {
          width: 20px;
          height: 20px;
          border: 2px solid var(--border-color, #444);
          border-top-color: var(--accent, #6366f1);
          border-radius: 50%;
          animation: spin 0.8s linear infinite;
        }

        @keyframes spin {
          to { transform: rotate(360deg); }
        }

        .search-footer {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 10px 20px;
          border-top: 1px solid var(--border-color, #333);
          font-size: 12px;
          color: var(--text-secondary, #888);
        }

        .search-footer-hints {
          display: flex;
          gap: 16px;
        }

        .search-footer-hint {
          display: flex;
          align-items: center;
          gap: 6px;
        }

        .search-footer-hint kbd {
          padding: 2px 6px;
          background: var(--bg-tertiary, #2a2a3e);
          border-radius: 4px;
          font-size: 11px;
        }

        /* تمييز نص البحث */
        .highlight {
          background: var(--accent, #6366f1);
          color: white;
          padding: 0 2px;
          border-radius: 2px;
        }
      </style>

      <div class="search-container">
        <div class="search-header">
          <span class="search-icon">🔍</span>
          <input type="text" class="search-input" placeholder="ابحث عن أجهزة، عملاء، موردين، صفحات..." autofocus>
          <span class="search-shortcut">ESC للإغلاق</span>
        </div>
        <div class="search-results"></div>
        <div class="search-footer">
          <div class="search-footer-hints">
            <span class="search-footer-hint"><kbd>↑↓</kbd> للتنقل</span>
            <span class="search-footer-hint"><kbd>Enter</kbd> لفتح</span>
            <span class="search-footer-hint"><kbd>Ctrl+K</kbd> للبحث</span>
          </div>
          <span class="results-count"></span>
        </div>
      </div>
    `;

    document.body.appendChild(modal);
    this.modal = modal;
    this.input = modal.querySelector('.search-input');
    this.resultsContainer = modal.querySelector('.search-results');
    this.resultsCount = modal.querySelector('.results-count');

    // Events
    this.input.addEventListener('input', (e) => this.onSearch(e.target.value));
    modal.addEventListener('click', (e) => {
      if (e.target === modal) this.close();
    });
  }

  bindKeyboardShortcuts() {
    document.addEventListener('keydown', (e) => {
      // Ctrl+K أو Ctrl+/ للفتح
      if ((e.ctrlKey || e.metaKey) && (e.key === 'k' || e.key === '/')) {
        e.preventDefault();
        this.toggle();
        return;
      }

      // إذا كان البحث مفتوح
      if (this.isOpen) {
        switch (e.key) {
          case 'Escape':
            this.close();
            break;
          case 'ArrowDown':
            e.preventDefault();
            this.selectNext();
            break;
          case 'ArrowUp':
            e.preventDefault();
            this.selectPrev();
            break;
          case 'Enter':
            e.preventDefault();
            this.openSelected();
            break;
        }
      }
    });
  }

  toggle() {
    // منع الكاشير من استخدام البحث
    const user = window.currentUser || {};
    if (user.role !== 'admin') {
      Logger.log('[Search] Not available for non-admin users');
      return;
    }
    this.isOpen ? this.close() : this.open();
  }

  open() {
    this.isOpen = true;
    this.modal.classList.add('open');
    this.input.value = '';
    this.input.focus();
    this.showQuickLinks();
  }

  close() {
    this.isOpen = false;
    this.modal.classList.remove('open');
    this.results = [];
    this.selectedIndex = 0;
  }

  async onSearch(query) {
    clearTimeout(this.searchTimeout);

    if (!query.trim()) {
      this.showQuickLinks();
      return;
    }

    // debounce
    this.searchTimeout = setTimeout(async () => {
      this.showLoading();
      const results = await this.search(query);
      this.displayResults(results, query);
    }, 200);
  }

  showLoading() {
    this.resultsContainer.innerHTML = `
      <div class="search-loading">
        <div class="spinner"></div>
        <span>جاري البحث...</span>
      </div>
    `;
  }

  showQuickLinks() {
    // الصفحات الأكثر استخداماً
    const quickLinks = [
      { type: 'page', icon: '🏠', title: 'الرئيسية', path: 'home' },
      { type: 'page', icon: '🛒', title: 'نقطة البيع', path: 'pos' },
      { type: 'page', icon: '📱', title: 'المخزون', path: 'inventory' },
      { type: 'page', icon: '📈', title: 'المبيعات', path: 'sales' },
      { type: 'page', icon: '👥', title: 'العملاء', path: 'clients' },
      { type: 'page', icon: '🏦', title: 'الخزينة', path: 'safe' },
      { type: 'page', icon: '📊', title: 'التقارير', path: 'reports' },
    ];

    this.results = quickLinks;
    this.selectedIndex = 0;
    this.resultsCount.textContent = '';

    this.resultsContainer.innerHTML = `
      <div class="search-category">الانتقال السريع</div>
      ${quickLinks.map((item, i) => this.renderResultItem(item, i)).join('')}
    `;

    this.bindResultEvents();
  }

  async search(query) {
    const q = query.toLowerCase().trim();
    const results = [];

    // التحقق من صلاحيات المستخدم
    const user = window.currentUser || {};
    const isAdmin = user.role === 'admin';

    // الصفحات المسموحة للكاشير
    const cashierAllowedPages = ['home', 'pos', 'clients', 'blacklist', 'reminders', 'repairs'];
    // الأقسام المسموحة للكاشير في البحث
    const cashierAllowedCategories = ['صفحات', 'عملاء'];

    // 1. البحث في الصفحات (مع فلترة الصلاحيات)
    if (window.router) {
      const pages = window.router.getRoutes();
      pages.forEach(page => {
        // فلترة الصفحات للكاشير
        if (!isAdmin && !cashierAllowedPages.includes(page.path)) {
          return;
        }

        if (page.title.toLowerCase().includes(q) || page.path.toLowerCase().includes(q)) {
          results.push({
            type: 'page',
            icon: page.icon,
            title: page.title,
            subtitle: `الانتقال إلى صفحة ${page.title}`,
            path: page.path,
            category: 'صفحات'
          });
        }
      });
    }

    // 2. البحث في الأجهزة (للأدمن فقط)
    if (isAdmin) try {
      const devicesRes = await this.fetchWithCache('elos-db://inventory');
      if (devicesRes.ok) {
        const data = await devicesRes.json();
        const devices = Array.isArray(data) ? data : (data.devices || data.inventory || []);

        devices.forEach(device => {
          const searchText = `${device.type || ''} ${device.model || ''} ${device.imei1 || ''} ${device.imei2 || ''} ${device.color || ''}`.toLowerCase();
          if (searchText.includes(q)) {
            results.push({
              type: 'device',
              icon: '📱',
              title: `${device.type || ''} ${device.model || ''}`.trim() || 'جهاز',
              subtitle: `IMEI: ${device.imei1 || 'N/A'} | ${device.color || ''} | ${device.storage || ''}`,
              badge: device.status === 'in_stock' ? 'متاح' : device.status,
              data: device,
              category: 'أجهزة',
              action: () => {
                if (window.router) {
                  window.router.navigate('inventory', { search: device.imei1 });
                }
              }
            });
          }
        });
      }
    } catch (e) {
      Logger.error('[Search] Error fetching devices:', e);
    }

    // 3. البحث في العملاء
    try {
      const clientsRes = await this.fetchWithCache('elos-db://clients');
      if (clientsRes.ok) {
        const clients = await clientsRes.json();

        clients.forEach(client => {
          const searchText = `${client.name || ''} ${client.phone || ''}`.toLowerCase();
          if (searchText.includes(q)) {
            results.push({
              type: 'client',
              icon: '👤',
              title: client.name || 'عميل',
              subtitle: `📞 ${client.phone || 'N/A'}`,
              badge: client.balance ? `${client.balance} ج.م` : null,
              data: client,
              category: 'عملاء',
              action: () => {
                if (window.router) {
                  window.router.navigate('clients', { id: client.id });
                }
              }
            });
          }
        });
      }
    } catch (e) {
      Logger.error('[Search] Error fetching clients:', e);
    }

    // 4. البحث في الموردين (للأدمن فقط)
    if (isAdmin) try {
      const suppliersRes = await this.fetchWithCache('elos-db://suppliers');
      if (suppliersRes.ok) {
        const suppliers = await suppliersRes.json();

        suppliers.forEach(supplier => {
          const searchText = `${supplier.name || ''} ${supplier.phone || ''}`.toLowerCase();
          if (searchText.includes(q)) {
            results.push({
              type: 'supplier',
              icon: '🚚',
              title: supplier.name || 'مورد',
              subtitle: `📞 ${supplier.phone || 'N/A'}`,
              badge: supplier.balance ? `${supplier.balance} ج.م` : null,
              data: supplier,
              category: 'موردين',
              action: () => {
                if (window.router) {
                  window.router.navigate('suppliers', { id: supplier.id });
                }
              }
            });
          }
        });
      }
    } catch (e) {
      Logger.error('[Search] Error fetching suppliers:', e);
    }

    // 5. البحث في الإكسسوارات (للأدمن فقط)
    if (isAdmin) try {
      const accRes = await this.fetchWithCache('elos-db://accessories');
      if (accRes.ok) {
        const data = await accRes.json();
        const accessories = Array.isArray(data) ? data : (data.accessories || []);

        accessories.forEach(acc => {
          const searchText = `${acc.name || ''} ${acc.category || ''} ${acc.barcode || ''}`.toLowerCase();
          if (searchText.includes(q)) {
            results.push({
              type: 'accessory',
              icon: '🎧',
              title: acc.name || 'إكسسوار',
              subtitle: `الكمية: ${acc.quantity || 0} | ${acc.category || ''}`,
              badge: acc.sell_price ? `${acc.sell_price} ج.م` : null,
              data: acc,
              category: 'إكسسوارات',
              action: () => {
                if (window.router) {
                  window.router.navigate('accessories', { search: acc.name });
                }
              }
            });
          }
        });
      }
    } catch (e) {
      Logger.error('[Search] Error fetching accessories:', e);
    }

    return results;
  }

  async fetchWithCache(url) {
    const cached = this.cache.get(url);
    if (cached && Date.now() - cached.time < this.cacheExpiry) {
      return {
        ok: true,
        json: () => Promise.resolve(cached.data)
      };
    }

    const res = await fetch(url);
    if (res.ok) {
      const data = await res.json();
      this.cache.set(url, { data, time: Date.now() });
      return {
        ok: true,
        json: () => Promise.resolve(data)
      };
    }

    return res;
  }

  displayResults(results, query) {
    this.results = results;
    this.selectedIndex = 0;

    if (results.length === 0) {
      this.resultsContainer.innerHTML = `
        <div class="search-empty">
          <div class="search-empty-icon">🔍</div>
          <div>لا توجد نتائج لـ "${query}"</div>
        </div>
      `;
      this.resultsCount.textContent = '';
      return;
    }

    // تجميع النتائج حسب الفئة
    const grouped = {};
    results.forEach(r => {
      const cat = r.category || 'أخرى';
      if (!grouped[cat]) grouped[cat] = [];
      grouped[cat].push(r);
    });

    let html = '';
    let index = 0;
    Object.entries(grouped).forEach(([category, items]) => {
      html += `<div class="search-category">${category}</div>`;
      items.forEach(item => {
        html += this.renderResultItem(item, index, query);
        index++;
      });
    });

    this.resultsContainer.innerHTML = html;
    this.resultsCount.textContent = `${results.length} نتيجة`;
    this.bindResultEvents();
  }

  renderResultItem(item, index, query = '') {
    const title = query ? this.highlightText(item.title, query) : item.title;
    const subtitle = item.subtitle ? (query ? this.highlightText(item.subtitle, query) : item.subtitle) : '';

    return `
      <div class="search-result-item ${index === this.selectedIndex ? 'selected' : ''}" data-index="${index}">
        <div class="search-result-icon ${item.type}">${item.icon}</div>
        <div class="search-result-info">
          <div class="search-result-title">${title}</div>
          ${subtitle ? `<div class="search-result-subtitle">${subtitle}</div>` : ''}
        </div>
        ${item.badge ? `<span class="search-result-badge">${item.badge}</span>` : ''}
      </div>
    `;
  }

  highlightText(text, query) {
    if (!query) return text;
    const regex = new RegExp(`(${query})`, 'gi');
    return text.replace(regex, '<span class="highlight">$1</span>');
  }

  bindResultEvents() {
    this.resultsContainer.querySelectorAll('.search-result-item').forEach(item => {
      item.addEventListener('click', () => {
        this.selectedIndex = parseInt(item.dataset.index);
        this.openSelected();
      });

      item.addEventListener('mouseenter', () => {
        this.selectedIndex = parseInt(item.dataset.index);
        this.updateSelection();
      });
    });
  }

  selectNext() {
    if (this.results.length === 0) return;
    this.selectedIndex = (this.selectedIndex + 1) % this.results.length;
    this.updateSelection();
  }

  selectPrev() {
    if (this.results.length === 0) return;
    this.selectedIndex = (this.selectedIndex - 1 + this.results.length) % this.results.length;
    this.updateSelection();
  }

  updateSelection() {
    this.resultsContainer.querySelectorAll('.search-result-item').forEach((item, i) => {
      item.classList.toggle('selected', i === this.selectedIndex);
      if (i === this.selectedIndex) {
        item.scrollIntoView({ block: 'nearest' });
      }
    });
  }

  openSelected() {
    const selected = this.results[this.selectedIndex];
    if (!selected) return;

    this.close();

    if (selected.action) {
      selected.action();
    } else if (selected.path && window.router) {
      window.router.navigate(selected.path);
    }
  }
}

// إنشاء instance عام
window.globalSearch = new GlobalSearch();
