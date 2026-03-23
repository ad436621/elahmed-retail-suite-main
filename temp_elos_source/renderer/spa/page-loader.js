/**
 * ELOS Page Loader - Enhanced Version
 * تحميل الصفحات ديناميكياً مع animations موحدة
 * يدعم كلاً من HTML fragments و iframe للصفحات الكاملة
 */

// Logger fallback if utils.js not loaded yet
if (!window.Logger) window.Logger = { log: () => {}, warn: () => {}, error: console.error, debug: () => {}, info: () => {} };

class PageLoader {
  constructor() {
    this.cache = new Map();         // كاش HTML
    this.loadedScripts = new Set(); // الـ scripts المحملة
    this.loadedStyles = new Set();  // الـ styles المحملة
    this.container = null;
    this.currentCleanup = null;     // دالة تنظيف الصفحة الحالية
    this.currentIframe = null;      // الـ iframe الحالي (للصفحات الكبيرة)
    this.loadingOverlay = null;     // Loading overlay element
    this.isLoading = false;
  }

  /**
   * تهيئة الـ loader
   */
  init() {
    this.container = document.getElementById('page-container');
    this.createLoadingOverlay();
    Logger.log('[PageLoader] Initialized with enhanced features');
  }

  /**
   * إنشاء Loading Overlay موحد
   */
  createLoadingOverlay() {
    // التحقق إذا كان موجوداً بالفعل
    if (document.getElementById('spa-loading-overlay')) {
      this.loadingOverlay = document.getElementById('spa-loading-overlay');
      return;
    }

    const overlay = document.createElement('div');
    overlay.id = 'spa-loading-overlay';
    overlay.innerHTML = `
      <div class="spa-loader-content">
        <div class="spa-loader-spinner">
          <div class="spinner-ring"></div>
          <div class="spinner-ring"></div>
          <div class="spinner-ring"></div>
        </div>
        <div class="spa-loader-text">جاري التحميل...</div>
        <div class="spa-loader-progress">
          <div class="progress-fill"></div>
        </div>
      </div>
    `;

    // إضافة الـ styles
    const style = document.createElement('style');
    style.id = 'spa-loading-styles';
    style.textContent = `
      #spa-loading-overlay {
        position: fixed;
        top: 0;
        left: 0;
        right: 0;
        bottom: 0;
        background: rgba(10, 14, 20, 0.85);
        backdrop-filter: blur(8px);
        display: flex;
        align-items: center;
        justify-content: center;
        z-index: 99999;
        opacity: 0;
        visibility: hidden;
        transition: opacity 0.2s ease, visibility 0.2s ease;
      }

      #spa-loading-overlay.visible {
        opacity: 1;
        visibility: visible;
      }

      .spa-loader-content {
        text-align: center;
        transform: scale(0.9);
        transition: transform 0.3s ease;
      }

      #spa-loading-overlay.visible .spa-loader-content {
        transform: scale(1);
      }

      .spa-loader-spinner {
        position: relative;
        width: 60px;
        height: 60px;
        margin: 0 auto 20px;
      }

      .spinner-ring {
        position: absolute;
        width: 100%;
        height: 100%;
        border: 3px solid transparent;
        border-radius: 50%;
        animation: spin 1.2s cubic-bezier(0.5, 0, 0.5, 1) infinite;
      }

      .spinner-ring:nth-child(1) {
        border-top-color: #3b82f6;
        animation-delay: -0.45s;
      }

      .spinner-ring:nth-child(2) {
        border-top-color: #a855f7;
        animation-delay: -0.3s;
        width: 80%;
        height: 80%;
        top: 10%;
        left: 10%;
      }

      .spinner-ring:nth-child(3) {
        border-top-color: #06b6d4;
        animation-delay: -0.15s;
        width: 60%;
        height: 60%;
        top: 20%;
        left: 20%;
      }

      @keyframes spin {
        0% { transform: rotate(0deg); }
        100% { transform: rotate(360deg); }
      }

      .spa-loader-text {
        font-size: 14px;
        color: #e6e8ee;
        margin-bottom: 16px;
        font-weight: 600;
      }

      .spa-loader-progress {
        width: 200px;
        height: 4px;
        background: rgba(255, 255, 255, 0.1);
        border-radius: 4px;
        overflow: hidden;
        margin: 0 auto;
      }

      .progress-fill {
        height: 100%;
        width: 0%;
        background: linear-gradient(90deg, #3b82f6, #a855f7, #06b6d4);
        background-size: 200% 100%;
        animation: progressGradient 1.5s ease infinite, progressWidth 0.8s ease forwards;
        border-radius: 4px;
      }

      @keyframes progressGradient {
        0% { background-position: 0% 50%; }
        50% { background-position: 100% 50%; }
        100% { background-position: 0% 50%; }
      }

      @keyframes progressWidth {
        0% { width: 0%; }
        50% { width: 70%; }
        100% { width: 90%; }
      }

      /* Page transition animations */
      #page-container {
        transition: opacity 0.2s ease, transform 0.2s ease;
      }

      #page-container.page-exit {
        opacity: 0;
        transform: translateY(-10px);
      }

      #page-container.page-enter {
        animation: pageSlideIn 0.3s ease forwards;
      }

      @keyframes pageSlideIn {
        from {
          opacity: 0;
          transform: translateY(15px);
        }
        to {
          opacity: 1;
          transform: translateY(0);
        }
      }

      /* iframe - عرض فوري بدون fade */
      #page-iframe {
        opacity: 1;
      }
    `;

    if (!document.getElementById('spa-loading-styles')) {
      document.head.appendChild(style);
    }
    document.body.appendChild(overlay);
    this.loadingOverlay = overlay;
  }

  /**
   * تحميل صفحة
   */
  async load(route, params = {}) {
    if (!this.container) this.init();
    if (this.isLoading) return; // منع التحميل المتكرر

    this.isLoading = true;
    Logger.log('[PageLoader] Loading:', route.path);
    const startTime = performance.now();

    // تنظيف الصفحة السابقة
    await this.cleanup();

    // تطبيق animation الخروج (سريع)
    await this.transitionOut();

    // عرض progress bar فقط (التطبيق محلي لا يحتاج skeleton/spinner)
    this.showLoading(route.title);

    try {

      // 3. تحقق إذا كانت صفحة iframe (صفحة كاملة قديمة)
      if (route.iframe) {
        await this.loadIframe(route, params);
      } else {
        // تحميل HTML fragment
        const html = await this.loadHTML(route.pageFile);

        // تبديل المحتوى
        this.container.innerHTML = html;

        // تحميل CSS إذا موجود
        if (route.cssFile) {
          await this.loadCSS(route.cssFile);
        }

        // تنفيذ الـ scripts الموجودة في الصفحة
        await this.executeInlineScripts();

        // استدعاء دالة التهيئة
        await this.initPage(route.path, params);
      }

      // 4. تطبيق animation الدخول
      await this.transitionIn();

      const loadTime = Math.round(performance.now() - startTime);
      Logger.log(`[PageLoader] Loaded ${route.path} in ${loadTime}ms`);

    } catch (error) {
      Logger.error('[PageLoader] Error:', error);
      this.showError(error);
      throw error;
    } finally {
      // إخفاء loading
      this.hideLoading();
      this.isLoading = false;
    }
  }

  /**
   * إظهار Loading overlay
   * ملاحظة: تم تعطيل الـ overlay والـ progress bar - التطبيق محلي وسريع
   */
  showLoading(title = 'جاري التحميل...') {
    // لا نظهر أي loading - التطبيق محلي وسريع جداً
    // الـ progress bar معطل لتجربة أسرع
  }

  /**
   * إخفاء Loading overlay
   */
  hideLoading() {
    // إخفاء progress bar فقط
    const progressBar = document.getElementById('progressBar');
    if (progressBar) progressBar.classList.remove('active');
  }

  /**
   * تحميل صفحة في iframe (للصفحات الكبيرة القديمة)
   * محسّن للتحميل الفوري بدون تأخير
   */
  async loadIframe(route, params = {}) {
    // إنشاء iframe
    const iframe = document.createElement('iframe');
    // إضافة ?spa=1 و theme للـ URL لتطبيق الثيم فوراً
    const separator = route.iframe.includes('?') ? '&' : '?';
    const currentTheme = localStorage.getItem('elos-theme') || localStorage.getItem('elos_theme') || 'dark';

    // بناء URL مع الـ params
    let iframeSrc = route.iframe + separator + 'spa=1&theme=' + currentTheme;

    // إضافة الـ params للـ URL
    if (params && Object.keys(params).length > 0) {
      const paramsString = Object.entries(params)
        .map(([key, value]) => `${encodeURIComponent(key)}=${encodeURIComponent(value)}`)
        .join('&');
      iframeSrc += '&' + paramsString;
    }

    iframe.src = iframeSrc;
    Logger.log('[PageLoader] Loading iframe with URL:', iframeSrc);
    iframe.style.cssText = `
      width: 100%;
      height: 100%;
      border: none;
      background: var(--bg-primary);
      border-radius: 8px;
      opacity: 1;
    `;
    iframe.id = 'page-iframe';

    // إضافة listener للتحميل
    const loadPromise = new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error('انتهت مهلة تحميل الصفحة'));
      }, 30000); // 30 ثانية timeout

      iframe.onload = () => {
        clearTimeout(timeout);

        // إخفاء header في الـ iframe
        try {
          const iframeDoc = iframe.contentDocument || iframe.contentWindow.document;
          const header = iframeDoc.querySelector('.hdr, .header, header, .top-bar');
          if (header) {
            header.style.display = 'none';
          }
          const body = iframeDoc.body;
          if (body) {
            body.style.paddingTop = '0';
          }
        } catch (e) {
          // تجاهل - قد لا نتمكن من الوصول للمحتوى
        }

        // إظهار فوري بدون تأخير
        iframe.classList.add('loaded');
        resolve();
      };

      iframe.onerror = () => {
        clearTimeout(timeout);
        reject(new Error('فشل تحميل الصفحة'));
      };
    });

    // تفريغ الـ container وإضافة الـ iframe
    this.container.innerHTML = '';
    this.container.appendChild(iframe);
    this.currentIframe = iframe;

    await loadPromise;
  }

  /**
   * تحميل HTML من ملف
   */
  async loadHTML(file) {
    // تحقق من الكاش
    if (this.cache.has(file)) {
      Logger.log('[PageLoader] Using cached:', file);
      return this.cache.get(file);
    }

    const response = await fetch(`./pages/${file}`);
    if (!response.ok) {
      throw new Error(`فشل تحميل الصفحة: ${file}`);
    }

    const html = await response.text();

    // حفظ في الكاش
    this.cache.set(file, html);

    return html;
  }

  /**
   * تحميل مسبق لـ HTML
   */
  async preload(file) {
    if (!file) return;
    if (this.cache.has(file)) return;

    try {
      await this.loadHTML(file);
      Logger.log('[PageLoader] Preloaded:', file);
    } catch (e) {
      // تجاهل أخطاء التحميل المسبق
      Logger.warn('[PageLoader] Preload failed:', file);
    }
  }

  /**
   * تحميل مسبق لعدة صفحات
   */
  async preloadMultiple(files) {
    const promises = files.map(file => this.preload(file));
    await Promise.allSettled(promises);
    Logger.log('[PageLoader] Preloaded', files.length, 'pages');
  }

  /**
   * تحميل CSS
   */
  async loadCSS(file) {
    if (this.loadedStyles.has(file)) return;

    return new Promise((resolve, reject) => {
      const link = document.createElement('link');
      link.rel = 'stylesheet';
      link.href = `./styles/${file}`;
      link.onload = () => {
        this.loadedStyles.add(file);
        resolve();
      };
      link.onerror = reject;
      document.head.appendChild(link);
    });
  }

  /**
   * تنفيذ الـ inline scripts في الصفحة
   */
  async executeInlineScripts() {
    const scripts = this.container.querySelectorAll('script');

    for (const oldScript of scripts) {
      const newScript = document.createElement('script');

      // نسخ الـ attributes
      Array.from(oldScript.attributes).forEach(attr => {
        newScript.setAttribute(attr.name, attr.value);
      });

      // نسخ المحتوى
      newScript.textContent = oldScript.textContent;

      // استبدال الـ script
      oldScript.parentNode.replaceChild(newScript, oldScript);

      // انتظار التحميل إذا كان external
      if (newScript.src) {
        await new Promise((resolve, reject) => {
          newScript.onload = resolve;
          newScript.onerror = reject;
        });
      }
    }
  }

  /**
   * استدعاء دالة تهيئة الصفحة
   */
  async initPage(pageName, params) {
    // البحث عن دالة initPage في الـ window
    const initFn = window[`init_${pageName}`] || window.initPage;

    if (typeof initFn === 'function') {
      Logger.log('[PageLoader] Calling init function for:', pageName);
      try {
        const result = initFn(params);
        if (result instanceof Promise) {
          await result;
        }
      } catch (e) {
        Logger.error('[PageLoader] Init function error:', e);
      }

      // تنظيف
      if (window.initPage) delete window.initPage;
    }

    // حفظ دالة التنظيف إذا موجودة
    this.currentCleanup = window[`cleanup_${pageName}`] || window.cleanupPage || null;
    if (window.cleanupPage) delete window.cleanupPage;
  }

  /**
   * تنظيف الصفحة السابقة
   */
  async cleanup() {
    // تنظيف iframe إذا موجود
    if (this.currentIframe) {
      Logger.log('[PageLoader] Removing iframe');
      this.currentIframe.remove();
      this.currentIframe = null;
    }

    if (typeof this.currentCleanup === 'function') {
      Logger.log('[PageLoader] Running cleanup');
      try {
        await this.currentCleanup();
      } catch (e) {
        Logger.error('[PageLoader] Cleanup error:', e);
      }
      this.currentCleanup = null;
    }
  }

  /**
   * Animation خروج (سريع للتنقل المحلي)
   */
  async transitionOut() {
    this.container.classList.add('page-exit');
    await this.wait(50);
    this.container.classList.remove('page-exit');
  }

  /**
   * Animation دخول (سريع للتنقل المحلي)
   */
  async transitionIn() {
    this.container.classList.add('page-enter');
    await this.wait(100);
    this.container.classList.remove('page-enter');
  }

  /**
   * عرض خطأ
   */
  showError(error) {
    this.container.innerHTML = `
      <div style="display:flex;flex-direction:column;align-items:center;justify-content:center;height:60vh;text-align:center;">
        <div style="font-size:80px;margin-bottom:20px;">⚠️</div>
        <h2 style="font-size:24px;color:var(--text-primary);margin-bottom:10px;">حدث خطأ</h2>
        <p style="color:var(--text-secondary);margin-bottom:10px;">${error.message}</p>
        <p style="color:var(--text-muted);font-size:12px;margin-bottom:20px;">يمكنك المحاولة مرة أخرى أو العودة للرئيسية</p>
        <div style="display:flex;gap:12px;">
          <button onclick="location.reload()" style="padding:12px 24px;background:var(--bg-tertiary);color:var(--text-primary);border:1px solid var(--border);border-radius:8px;cursor:pointer;font-size:14px;">
            إعادة تحميل
          </button>
          <button onclick="router.navigate('home')" style="padding:12px 24px;background:var(--accent);color:white;border:none;border-radius:8px;cursor:pointer;font-size:14px;">
            العودة للرئيسية
          </button>
        </div>
      </div>
    `;
  }

  /**
   * انتظار
   */
  wait(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * مسح الكاش
   */
  clearCache() {
    this.cache.clear();
    Logger.log('[PageLoader] Cache cleared');
  }

  /**
   * الحصول على حجم الكاش
   */
  getCacheSize() {
    return this.cache.size;
  }

  /**
   * الحصول على الصفحات المحفوظة في الكاش
   */
  getCachedPages() {
    return Array.from(this.cache.keys());
  }
}

// إنشاء instance عام
window.pageLoader = new PageLoader();
