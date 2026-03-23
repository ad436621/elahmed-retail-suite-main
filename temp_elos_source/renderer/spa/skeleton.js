/**
 * ELOS Skeleton Loading System
 * عرض هيكل الصفحة أثناء التحميل لتجربة مستخدم أفضل
 */

class SkeletonLoader {
  constructor() {
    this.templates = new Map();
    this.init();
  }

  init() {
    this.registerTemplates();
    this.injectStyles();
  }

  injectStyles() {
    if (document.getElementById('skeleton-styles')) return;

    const style = document.createElement('style');
    style.id = 'skeleton-styles';
    style.textContent = `
      /* Base skeleton styles */
      .skeleton {
        background: linear-gradient(90deg,
          var(--bg-tertiary, #1e1e2e) 25%,
          var(--bg-secondary, #2a2a3e) 50%,
          var(--bg-tertiary, #1e1e2e) 75%
        );
        background-size: 200% 100%;
        animation: skeletonShimmer 1.5s ease-in-out infinite;
        border-radius: 8px;
      }

      @keyframes skeletonShimmer {
        0% { background-position: 200% 0; }
        100% { background-position: -200% 0; }
      }

      /* Skeleton container */
      .skeleton-page {
        padding: 20px;
        display: flex;
        flex-direction: column;
        gap: 20px;
        height: 100%;
        animation: fadeIn 0.3s ease;
      }

      /* Header skeleton */
      .skeleton-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin-bottom: 10px;
      }

      .skeleton-title {
        width: 200px;
        height: 32px;
      }

      .skeleton-actions {
        display: flex;
        gap: 12px;
      }

      .skeleton-btn {
        width: 100px;
        height: 40px;
        border-radius: 8px;
      }

      .skeleton-btn.primary {
        width: 140px;
      }

      /* Stats cards skeleton */
      .skeleton-stats {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
        gap: 16px;
      }

      .skeleton-stat-card {
        height: 100px;
        border-radius: 12px;
        padding: 16px;
        display: flex;
        flex-direction: column;
        justify-content: space-between;
      }

      .skeleton-stat-icon {
        width: 40px;
        height: 40px;
        border-radius: 10px;
      }

      .skeleton-stat-value {
        width: 80px;
        height: 24px;
        margin-top: auto;
      }

      .skeleton-stat-label {
        width: 100px;
        height: 14px;
        margin-top: 8px;
      }

      /* Table skeleton */
      .skeleton-table {
        background: var(--card-bg, #1a1a2e);
        border-radius: 12px;
        overflow: hidden;
        flex: 1;
      }

      .skeleton-table-header {
        display: flex;
        padding: 16px 20px;
        gap: 20px;
        background: var(--bg-tertiary, #1e1e2e);
        border-bottom: 1px solid var(--border-color, #333);
      }

      .skeleton-th {
        height: 16px;
        flex: 1;
        max-width: 150px;
      }

      .skeleton-table-body {
        padding: 8px 0;
      }

      .skeleton-tr {
        display: flex;
        padding: 14px 20px;
        gap: 20px;
        align-items: center;
      }

      .skeleton-td {
        height: 14px;
        flex: 1;
        max-width: 150px;
      }

      .skeleton-avatar {
        width: 36px;
        height: 36px;
        border-radius: 50%;
        flex-shrink: 0;
      }

      /* Cards grid skeleton */
      .skeleton-grid {
        display: grid;
        grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
        gap: 16px;
      }

      .skeleton-card {
        height: 180px;
        border-radius: 12px;
        padding: 20px;
        display: flex;
        flex-direction: column;
      }

      .skeleton-card-header {
        display: flex;
        align-items: center;
        gap: 12px;
        margin-bottom: 16px;
      }

      .skeleton-card-icon {
        width: 48px;
        height: 48px;
        border-radius: 12px;
      }

      .skeleton-card-title {
        width: 120px;
        height: 18px;
      }

      .skeleton-card-subtitle {
        width: 80px;
        height: 12px;
        margin-top: 6px;
      }

      .skeleton-card-content {
        flex: 1;
        display: flex;
        flex-direction: column;
        gap: 10px;
      }

      .skeleton-line {
        height: 12px;
        border-radius: 4px;
      }

      .skeleton-line.short { width: 60%; }
      .skeleton-line.medium { width: 80%; }
      .skeleton-line.long { width: 100%; }

      /* Form skeleton */
      .skeleton-form {
        display: flex;
        flex-direction: column;
        gap: 20px;
        max-width: 600px;
      }

      .skeleton-form-group {
        display: flex;
        flex-direction: column;
        gap: 8px;
      }

      .skeleton-label {
        width: 100px;
        height: 14px;
      }

      .skeleton-input {
        height: 44px;
        border-radius: 8px;
      }

      .skeleton-textarea {
        height: 100px;
        border-radius: 8px;
      }

      /* Sidebar/filter skeleton */
      .skeleton-sidebar {
        width: 280px;
        display: flex;
        flex-direction: column;
        gap: 16px;
        padding-right: 20px;
        border-right: 1px solid var(--border-color, #333);
      }

      .skeleton-filter-item {
        display: flex;
        flex-direction: column;
        gap: 10px;
      }

      .skeleton-filter-label {
        width: 80px;
        height: 14px;
      }

      .skeleton-filter-options {
        display: flex;
        flex-wrap: wrap;
        gap: 8px;
      }

      .skeleton-chip {
        width: 70px;
        height: 32px;
        border-radius: 16px;
      }

      /* Chart skeleton */
      .skeleton-chart {
        height: 300px;
        border-radius: 12px;
        position: relative;
        overflow: hidden;
      }

      .skeleton-chart-bars {
        position: absolute;
        bottom: 40px;
        left: 50px;
        right: 20px;
        display: flex;
        align-items: flex-end;
        justify-content: space-around;
        height: calc(100% - 80px);
      }

      .skeleton-bar {
        width: 30px;
        border-radius: 4px 4px 0 0;
        animation: skeletonShimmer 1.5s ease-in-out infinite;
      }

      /* Different page types */
      .skeleton-with-sidebar {
        display: flex;
        gap: 20px;
      }

      .skeleton-main-content {
        flex: 1;
        display: flex;
        flex-direction: column;
        gap: 20px;
      }

      /* Animation delays for staggered effect */
      .skeleton-tr:nth-child(1) { animation-delay: 0s; }
      .skeleton-tr:nth-child(2) { animation-delay: 0.1s; }
      .skeleton-tr:nth-child(3) { animation-delay: 0.2s; }
      .skeleton-tr:nth-child(4) { animation-delay: 0.3s; }
      .skeleton-tr:nth-child(5) { animation-delay: 0.4s; }
      .skeleton-tr:nth-child(6) { animation-delay: 0.5s; }

      .skeleton-stat-card:nth-child(1) { animation-delay: 0s; }
      .skeleton-stat-card:nth-child(2) { animation-delay: 0.1s; }
      .skeleton-stat-card:nth-child(3) { animation-delay: 0.2s; }
      .skeleton-stat-card:nth-child(4) { animation-delay: 0.3s; }
    `;

    document.head.appendChild(style);
  }

  registerTemplates() {
    // قالب جدول بسيط
    this.templates.set('table', () => `
      <div class="skeleton-page">
        <div class="skeleton-header">
          <div class="skeleton skeleton-title"></div>
          <div class="skeleton-actions">
            <div class="skeleton skeleton-btn"></div>
            <div class="skeleton skeleton-btn primary"></div>
          </div>
        </div>
        <div class="skeleton-table">
          <div class="skeleton-table-header">
            ${this.repeat('<div class="skeleton skeleton-th"></div>', 5)}
          </div>
          <div class="skeleton-table-body">
            ${this.repeat(`
              <div class="skeleton-tr">
                <div class="skeleton skeleton-avatar"></div>
                ${this.repeat('<div class="skeleton skeleton-td"></div>', 4)}
              </div>
            `, 6)}
          </div>
        </div>
      </div>
    `);

    // قالب إحصائيات + جدول
    this.templates.set('stats-table', () => `
      <div class="skeleton-page">
        <div class="skeleton-header">
          <div class="skeleton skeleton-title"></div>
          <div class="skeleton-actions">
            <div class="skeleton skeleton-btn"></div>
          </div>
        </div>
        <div class="skeleton-stats">
          ${this.repeat(`
            <div class="skeleton skeleton-stat-card">
              <div class="skeleton skeleton-stat-icon"></div>
              <div class="skeleton skeleton-stat-value"></div>
              <div class="skeleton skeleton-stat-label"></div>
            </div>
          `, 4)}
        </div>
        <div class="skeleton-table">
          <div class="skeleton-table-header">
            ${this.repeat('<div class="skeleton skeleton-th"></div>', 5)}
          </div>
          <div class="skeleton-table-body">
            ${this.repeat(`
              <div class="skeleton-tr">
                ${this.repeat('<div class="skeleton skeleton-td"></div>', 5)}
              </div>
            `, 5)}
          </div>
        </div>
      </div>
    `);

    // قالب كروت
    this.templates.set('cards', () => `
      <div class="skeleton-page">
        <div class="skeleton-header">
          <div class="skeleton skeleton-title"></div>
          <div class="skeleton-actions">
            <div class="skeleton skeleton-btn"></div>
            <div class="skeleton skeleton-btn primary"></div>
          </div>
        </div>
        <div class="skeleton-grid">
          ${this.repeat(`
            <div class="skeleton skeleton-card">
              <div class="skeleton-card-header">
                <div class="skeleton skeleton-card-icon"></div>
                <div>
                  <div class="skeleton skeleton-card-title"></div>
                  <div class="skeleton skeleton-card-subtitle"></div>
                </div>
              </div>
              <div class="skeleton-card-content">
                <div class="skeleton skeleton-line long"></div>
                <div class="skeleton skeleton-line medium"></div>
                <div class="skeleton skeleton-line short"></div>
              </div>
            </div>
          `, 6)}
        </div>
      </div>
    `);

    // قالب تقارير مع chart
    this.templates.set('reports', () => `
      <div class="skeleton-page">
        <div class="skeleton-header">
          <div class="skeleton skeleton-title"></div>
          <div class="skeleton-actions">
            <div class="skeleton skeleton-btn"></div>
            <div class="skeleton skeleton-btn"></div>
            <div class="skeleton skeleton-btn primary"></div>
          </div>
        </div>
        <div class="skeleton-stats">
          ${this.repeat(`
            <div class="skeleton skeleton-stat-card">
              <div class="skeleton skeleton-stat-icon"></div>
              <div class="skeleton skeleton-stat-value"></div>
              <div class="skeleton skeleton-stat-label"></div>
            </div>
          `, 4)}
        </div>
        <div class="skeleton skeleton-chart">
          <div class="skeleton-chart-bars">
            ${[70, 45, 85, 60, 90, 55, 75, 80, 50, 65, 40, 70].map(h =>
              `<div class="skeleton skeleton-bar" style="height: ${h}%"></div>`
            ).join('')}
          </div>
        </div>
      </div>
    `);

    // قالب مع sidebar
    this.templates.set('with-sidebar', () => `
      <div class="skeleton-page">
        <div class="skeleton-header">
          <div class="skeleton skeleton-title"></div>
        </div>
        <div class="skeleton-with-sidebar">
          <div class="skeleton-sidebar">
            ${this.repeat(`
              <div class="skeleton-filter-item">
                <div class="skeleton skeleton-filter-label"></div>
                <div class="skeleton-filter-options">
                  ${this.repeat('<div class="skeleton skeleton-chip"></div>', 3)}
                </div>
              </div>
            `, 4)}
          </div>
          <div class="skeleton-main-content">
            <div class="skeleton-table">
              <div class="skeleton-table-header">
                ${this.repeat('<div class="skeleton skeleton-th"></div>', 4)}
              </div>
              <div class="skeleton-table-body">
                ${this.repeat(`
                  <div class="skeleton-tr">
                    ${this.repeat('<div class="skeleton skeleton-td"></div>', 4)}
                  </div>
                `, 6)}
              </div>
            </div>
          </div>
        </div>
      </div>
    `);

    // قالب فورم
    this.templates.set('form', () => `
      <div class="skeleton-page">
        <div class="skeleton-header">
          <div class="skeleton skeleton-title"></div>
        </div>
        <div class="skeleton-form">
          ${this.repeat(`
            <div class="skeleton-form-group">
              <div class="skeleton skeleton-label"></div>
              <div class="skeleton skeleton-input"></div>
            </div>
          `, 4)}
          <div class="skeleton-form-group">
            <div class="skeleton skeleton-label"></div>
            <div class="skeleton skeleton-textarea"></div>
          </div>
          <div class="skeleton-actions" style="margin-top: 20px;">
            <div class="skeleton skeleton-btn"></div>
            <div class="skeleton skeleton-btn primary"></div>
          </div>
        </div>
      </div>
    `);

    // قالب POS
    this.templates.set('pos', () => `
      <div class="skeleton-page" style="flex-direction: row; gap: 20px;">
        <div style="flex: 2; display: flex; flex-direction: column; gap: 16px;">
          <div class="skeleton" style="height: 50px; border-radius: 10px;"></div>
          <div class="skeleton-grid" style="flex: 1;">
            ${this.repeat(`
              <div class="skeleton" style="height: 140px; border-radius: 12px;"></div>
            `, 8)}
          </div>
        </div>
        <div style="flex: 1; display: flex; flex-direction: column; gap: 16px;">
          <div class="skeleton" style="height: 50px; border-radius: 10px;"></div>
          <div class="skeleton" style="flex: 1; border-radius: 12px;"></div>
          <div class="skeleton" style="height: 120px; border-radius: 12px;"></div>
          <div class="skeleton" style="height: 50px; border-radius: 10px;"></div>
        </div>
      </div>
    `);

    // قالب افتراضي
    this.templates.set('default', () => `
      <div class="skeleton-page">
        <div class="skeleton-header">
          <div class="skeleton skeleton-title"></div>
          <div class="skeleton-actions">
            <div class="skeleton skeleton-btn primary"></div>
          </div>
        </div>
        <div class="skeleton-stats">
          ${this.repeat(`
            <div class="skeleton skeleton-stat-card">
              <div class="skeleton skeleton-stat-icon"></div>
              <div class="skeleton skeleton-stat-value"></div>
            </div>
          `, 3)}
        </div>
        <div class="skeleton-table">
          <div class="skeleton-table-body">
            ${this.repeat(`
              <div class="skeleton-tr">
                ${this.repeat('<div class="skeleton skeleton-td"></div>', 4)}
              </div>
            `, 5)}
          </div>
        </div>
      </div>
    `);
  }

  repeat(template, count) {
    return Array(count).fill(template).join('');
  }

  /**
   * الحصول على قالب skeleton حسب نوع الصفحة
   */
  getTemplate(pageType) {
    const template = this.templates.get(pageType) || this.templates.get('default');
    return template();
  }

  /**
   * تطبيق skeleton على الصفحات حسب نوعها
   */
  getPageSkeleton(pagePath) {
    const pageTypes = {
      'inventory': 'stats-table',
      'pos': 'pos',
      'sales': 'stats-table',
      'purchases': 'stats-table',
      'clients': 'table',
      'suppliers': 'table',
      'employees': 'table',
      'users': 'table',
      'reports': 'reports',
      'safe': 'stats-table',
      'settings': 'form',
      'warehouses': 'cards',
      'accessories': 'stats-table',
      'blacklist': 'table',
      'partners': 'cards',
      'archive': 'with-sidebar',
      'home': 'default'
    };

    const type = pageTypes[pagePath] || 'default';
    return this.getTemplate(type);
  }

  /**
   * عرض skeleton في container
   */
  show(container, pagePath) {
    if (!container) return;
    container.innerHTML = this.getPageSkeleton(pagePath);
  }
}

// إنشاء instance عام
window.skeletonLoader = new SkeletonLoader();
