/**
 * ELOS SPA Router - Enhanced Version
 * نظام التوجيه للتنقل بين الصفحات بدون reload
 * يدعم Deep linking و URL hash و Preloading
 */

// Logger fallback if utils.js not loaded yet
if (!window.Logger) window.Logger = { log: () => {}, warn: () => {}, error: console.error, debug: () => {}, info: () => {} };

class SpaRouter {
  constructor() {
    this.routes = new Map();
    this.currentRoute = null;
    this.previousRoute = null;
    this.history = [];
    this.listeners = [];
    this.initialized = false;
    this.isNavigating = false;
  }

  /**
   * تسجيل route جديد
   */
  register(path, config) {
    this.routes.set(path, {
      path,
      title: config.title || path,
      icon: config.icon || '📄',
      pageFile: config.pageFile || (config.iframe ? null : `${path}.html`),
      iframe: config.iframe || null,
      cssFile: config.cssFile || null,
      permissions: config.permissions || [],
      preload: config.preload || false,
      keepAlive: config.keepAlive || false,
      priority: config.priority || 0  // للـ preloading
    });
    return this;
  }

  /**
   * تسجيل مجموعة routes
   */
  registerAll(routes) {
    Object.entries(routes).forEach(([path, config]) => {
      this.register(path, config);
    });
    return this;
  }

  /**
   * التنقل لصفحة
   */
  async navigate(path, params = {}, options = {}) {
    // منع التنقل المتكرر
    if (this.isNavigating) {
      Logger.log('[Router] Navigation in progress, skipping');
      return false;
    }

    // منع التنقل للصفحة الحالية
    if (this.currentRoute?.path === path && !options.force) {
      Logger.log('[Router] Already on this page:', path);
      return false;
    }

    // ✅ التحقق من وجود منتجات في سلة POS قبل مغادرة الصفحة
    if (this.currentRoute?.path === 'pos' && path !== 'pos') {
      const posCart = window.cart || (window.frames[0] && window.frames[0].cart);
      if (posCart && posCart.length > 0) {
        // إظهار رسالة خطأ
        if (typeof showToast === 'function') {
          showToast(`⚠️ لا يمكن مغادرة نقطة البيع! يوجد ${posCart.length} منتج في السلة. أتمم البيع أو أفرغ السلة أولاً.`, 'error', 5000);
        } else if (typeof window.showAlert === 'function') {
          window.showAlert(`لا يمكن مغادرة نقطة البيع!\nيوجد ${posCart.length} منتج في السلة.\nأتمم البيع أو أفرغ السلة أولاً.`, 'تنبيه');
        } else {
          alert(`⚠️ لا يمكن مغادرة نقطة البيع!\nيوجد ${posCart.length} منتج في السلة.\nأتمم البيع أو أفرغ السلة أولاً.`);
        }
        Logger.warn('[Router] Navigation blocked - POS cart is not empty');
        return false;
      }
    }

    const route = this.routes.get(path);
    if (!route) {
      Logger.error('[Router] Route not found:', path);
      this.showNotFound(path);
      return false;
    }

    // فحص الصلاحيات
    if (!this.checkPermissions(route.permissions)) {
      this.showAccessDenied();
      return false;
    }

    this.isNavigating = true;
    Logger.log('[Router] Navigating to:', path);

    // إطلاق event قبل التنقل
    this.emit('beforeNavigate', { from: this.currentRoute, to: route, params });

    // حفظ الـ route السابق
    if (this.currentRoute && !options.skipHistory) {
      this.previousRoute = this.currentRoute;
      this.history.push(this.currentRoute.path);

      // حد أقصى 50 صفحة في التاريخ
      if (this.history.length > 50) {
        this.history.shift();
      }
    }

    // تعيين الـ route الحالي
    this.currentRoute = route;

    // تحميل الصفحة
    try {
      await pageLoader.load(route, params);
    } catch (error) {
      Logger.error('[Router] Failed to load page:', error);
      this.emit('loadError', { route, error });
      this.isNavigating = false;
      return false;
    }

    // تحديث UI
    // إذا كان فيه warehouse_name، استخدمه كعنوان
    if (params && params.warehouse_name) {
      this.updatePageTitle({ ...route, title: params.warehouse_name });
    } else {
      this.updatePageTitle(route);
    }
    // لا تفعّل عنصر sidebar إذا كان فيه warehouse_id (مخزن تخزيني)
    const skipSidebarHighlight = params && params.warehouse_id;
    this.updateSidebar(skipSidebarHighlight ? null : path);

    // تحديث URL hash
    if (!options.skipHash) {
      this.updateURL(path, params);
    }

    // إطلاق event بعد التنقل
    this.emit('afterNavigate', { route, params });

    this.isNavigating = false;
    return true;
  }

  /**
   * الرجوع للصفحة السابقة
   */
  back() {
    if (this.history.length > 0) {
      const previousPath = this.history.pop();
      this.navigate(previousPath, {}, { skipHistory: true });
    } else if (this.previousRoute) {
      this.navigate(this.previousRoute.path, {}, { skipHistory: true });
    } else {
      // الكاشير يرجع لـ POS بدل الرئيسية
      this.navigateToHome();
    }
  }

  /**
   * التنقل للصفحة الرئيسية المناسبة للمستخدم
   */
  navigateToHome() {
    const user = window.currentUser || {};
    const homePage = user.role === 'cashier' ? 'pos' : 'home';
    this.navigate(homePage);
  }

  /**
   * الذهاب لصفحة معينة في التاريخ
   */
  go(delta) {
    if (delta < 0 && this.history.length >= Math.abs(delta)) {
      // رجوع
      for (let i = 0; i < Math.abs(delta) - 1; i++) {
        this.history.pop();
      }
      this.back();
    }
  }

  /**
   * تحديث عنوان الصفحة
   */
  updatePageTitle(route) {
    document.title = `ELOS - ${route.title}`;

    const titleEl = document.getElementById('pageTitle');
    const iconEl = document.getElementById('pageIcon');

    if (titleEl) titleEl.textContent = route.title;
    if (iconEl) iconEl.textContent = route.icon;
  }

  /**
   * تحديث الـ sidebar
   */
  updateSidebar(activePath) {
    document.querySelectorAll('.nav-item').forEach(item => {
      const itemRoute = item.dataset.route;
      // إذا كان activePath = null، أزل الـ active من كل العناصر
      if (!activePath || itemRoute !== activePath) {
        item.classList.remove('active');
      } else if (itemRoute === activePath) {
        item.classList.add('active');
      }
    });

    // فتح الـ dropdown إذا كان العنصر النشط داخله
    document.querySelectorAll('.nav-dropdown').forEach(dropdown => {
      const hasActiveChild = dropdown.querySelector('.nav-item.active');
      if (hasActiveChild) {
        dropdown.classList.add('open');
      }
    });
  }

  /**
   * تحديث الـ URL hash
   */
  updateURL(path, params = {}) {
    // بناء الـ hash مع الـ params
    let hash = `#${path}`;

    if (Object.keys(params).length > 0) {
      const queryString = new URLSearchParams(params).toString();
      hash += `?${queryString}`;
    }

    // تحديث URL بدون reload
    window.history.pushState({ path, params }, '', hash);
  }

  /**
   * قراءة الـ route من الـ URL hash
   */
  parseHash() {
    const hash = window.location.hash.slice(1); // إزالة #

    if (!hash) {
      return { path: 'home', params: {} };
    }

    // فصل الـ path عن الـ params
    const [path, queryString] = hash.split('?');
    const params = {};

    if (queryString) {
      const searchParams = new URLSearchParams(queryString);
      searchParams.forEach((value, key) => {
        params[key] = value;
      });
    }

    return { path, params };
  }

  /**
   * فحص الصلاحيات
   */
  checkPermissions(required) {
    if (!required || required.length === 0) return true;

    const user = window.currentUser;
    if (!user) return false;

    // Admin يملك كل الصلاحيات
    if (user.role === 'admin') return true;

    // فحص الصلاحية المطلوبة
    return required.some(perm => {
      if (user.role === 'cashier' && ['sales', 'pos', 'home', 'inventory', 'repairs'].includes(perm)) {
        return true;
      }
      return false;
    });
  }

  /**
   * صفحة غير موجودة
   */
  showNotFound(path) {
    const container = document.getElementById('page-container');
    if (container) {
      container.innerHTML = `
        <div style="display:flex;flex-direction:column;align-items:center;justify-content:center;height:60vh;text-align:center;">
          <div style="font-size:80px;margin-bottom:20px;">🔍</div>
          <h2 style="font-size:24px;color:var(--text-primary);margin-bottom:10px;">الصفحة غير موجودة</h2>
          <p style="color:var(--text-secondary);margin-bottom:20px;">الصفحة "${path}" غير موجودة</p>
          <button onclick="router.navigateToHome()" style="padding:12px 24px;background:var(--accent);color:white;border:none;border-radius:8px;cursor:pointer;font-size:14px;">
            العودة للرئيسية
          </button>
        </div>
      `;
    }
  }

  /**
   * صفحة عدم الصلاحية
   */
  showAccessDenied() {
    const container = document.getElementById('page-container');
    if (container) {
      container.innerHTML = `
        <div style="display:flex;flex-direction:column;align-items:center;justify-content:center;height:60vh;text-align:center;">
          <div style="font-size:80px;margin-bottom:20px;">🔒</div>
          <h2 style="font-size:24px;color:var(--text-primary);margin-bottom:10px;">غير مصرح</h2>
          <p style="color:var(--text-secondary);margin-bottom:20px;">ليس لديك صلاحية للوصول لهذه الصفحة</p>
          <button onclick="router.navigateToHome()" style="padding:12px 24px;background:var(--accent);color:white;border:none;border-radius:8px;cursor:pointer;font-size:14px;">
            العودة للرئيسية
          </button>
        </div>
      `;
    }
  }

  /**
   * نظام الـ Events
   */
  on(event, callback) {
    this.listeners.push({ event, callback });
    return this;
  }

  off(event, callback) {
    this.listeners = this.listeners.filter(
      l => !(l.event === event && l.callback === callback)
    );
    return this;
  }

  emit(event, data) {
    this.listeners
      .filter(l => l.event === event)
      .forEach(l => {
        try {
          l.callback(data);
        } catch (e) {
          Logger.error('[Router] Event handler error:', e);
        }
      });
  }

  /**
   * تهيئة الـ Router
   */
  init() {
    if (this.initialized) return;

    Logger.log('[Router] Initializing...');

    // معالج النقر على روابط التنقل
    document.addEventListener('click', (e) => {
      const navItem = e.target.closest('[data-route]');
      if (navItem) {
        e.preventDefault();
        const route = navItem.dataset.route;
        this.navigate(route);
      }
    });

    // معالج زر الرجوع في المتصفح (popstate)
    window.addEventListener('popstate', (e) => {
      if (e.state?.path) {
        this.navigate(e.state.path, e.state.params || {}, { skipHistory: true, skipHash: true });
      } else {
        // إذا لا يوجد state، نقرأ من الـ hash
        const { path, params } = this.parseHash();
        if (path && this.routes.has(path)) {
          this.navigate(path, params, { skipHistory: true, skipHash: true });
        }
      }
    });

    // معالج تغيير الـ hash (للدعم الإضافي)
    window.addEventListener('hashchange', (e) => {
      // نتجاهل إذا كنا في منتصف التنقل
      if (this.isNavigating) return;

      const { path, params } = this.parseHash();
      if (path && path !== this.currentRoute?.path && this.routes.has(path)) {
        this.navigate(path, params, { skipHistory: true, skipHash: true });
      }
    });

    // معالج اختصارات لوحة المفاتيح
    document.addEventListener('keydown', (e) => {
      const user = window.currentUser || {};
      const isCashier = user.role === 'cashier';

      // Alt + Arrow Right = رجوع (للعربية)
      if (e.altKey && e.key === 'ArrowRight') {
        e.preventDefault();
        this.back();
      }
      // Alt + Arrow Left = رجوع (للإنجليزية)
      if (e.altKey && e.key === 'ArrowLeft') {
        e.preventDefault();
        this.back();
      }
      // Alt + H = الرئيسية (حسب صلاحية المستخدم)
      if (e.altKey && (e.key === 'h' || e.key === 'H')) {
        e.preventDefault();
        this.navigateToHome();
      }
      // Ctrl + 1-9 للتنقل السريع (مع فحص الصلاحيات)
      if (e.ctrlKey && e.key >= '1' && e.key <= '9') {
        // الصفحات المتاحة للكاشير فقط
        const cashierRoutes = ['pos', 'pos', 'pos', 'pos', 'pos', 'pos', 'clients', 'pos', 'pos'];
        // الصفحات الكاملة للمدير
        const adminRoutes = ['home', 'pos', 'inventory', 'accessories', 'sales', 'purchases', 'clients', 'safe', 'reports'];

        const quickRoutes = isCashier ? cashierRoutes : adminRoutes;
        const index = parseInt(e.key) - 1;

        if (quickRoutes[index]) {
          e.preventDefault();
          // فحص إضافي: هل الصفحة متاحة لهذا المستخدم؟
          const route = this.routes.get(quickRoutes[index]);
          if (route && this.checkPermissions(route.permissions)) {
            this.navigate(quickRoutes[index]);
          } else {
            // الكاشير يرجع لـ POS دائماً
            if (isCashier) {
              this.navigate('pos');
            }
          }
        }
      }
    });

    // تحميل الصفحة الأولية من الـ hash
    const { path: initialPath, params: initialParams } = this.parseHash();

    // تأخير صغير للتأكد من تحميل كل شيء
    setTimeout(() => {
      this.navigate(initialPath, initialParams, { skipHash: true });
    }, 100);

    this.initialized = true;
    Logger.log('[Router] Initialized with deep linking support');
  }

  /**
   * الحصول على الـ route الحالي
   */
  getCurrentRoute() {
    return this.currentRoute;
  }

  /**
   * الحصول على قائمة الـ routes
   */
  getRoutes() {
    return Array.from(this.routes.values());
  }

  /**
   * تحميل مسبق للصفحات المهمة
   */
  async preloadRoutes() {
    // الصفحات ذات الأولوية العالية
    const highPriority = ['home'];

    // الصفحات التي عليها preload: true
    const toPreload = this.getRoutes()
      .filter(r => r.preload && r.pageFile)
      .map(r => r.pageFile);

    // دمج القوائم
    const allToPreload = [...new Set([...highPriority.map(p => `${p}.html`), ...toPreload])];

    Logger.log('[Router] Preloading', allToPreload.length, 'pages');

    // تحميل مسبق
    await pageLoader.preloadMultiple(allToPreload);
  }

  /**
   * تحميل مسبق ذكي - يحمل الصفحات المتوقع زيارتها
   */
  smartPreload() {
    // بناءً على الصفحة الحالية، نحمل الصفحات المرتبطة
    const relatedPages = {
      'home': ['pos', 'inventory', 'sales'],
      'pos': ['inventory', 'clients', 'sales'],
      'inventory': ['pos', 'purchases', 'warehouses'],
      'sales': ['pos', 'clients', 'reports'],
      'purchases': ['inventory', 'suppliers'],
    };

    const current = this.currentRoute?.path;
    if (current && relatedPages[current]) {
      const toPreload = relatedPages[current]
        .filter(p => !this.routes.get(p)?.iframe) // فقط الصفحات غير iframe
        .map(p => `${p}.html`);

      if (toPreload.length > 0) {
        Logger.log('[Router] Smart preloading:', toPreload);
        pageLoader.preloadMultiple(toPreload);
      }
    }
  }

  /**
   * التحقق إذا كانت الصفحة موجودة
   */
  hasRoute(path) {
    return this.routes.has(path);
  }

  /**
   * الحصول على معلومات route
   */
  getRoute(path) {
    return this.routes.get(path);
  }
}

// إنشاء instance عام
window.router = new SpaRouter();
