/**
 * ELOS Login Page Enhancements
 * تحسينات صفحة تسجيل الدخول
 * Version: 1.0
 */

(function() {
  'use strict';

  // انتظار تحميل الصفحة
  document.addEventListener('DOMContentLoaded', initEnhancements);

  function initEnhancements() {
    console.log('[Login Enhancements] جاري التهيئة...');

    initHeaderFunctionality();
    initFooterFunctionality();
    initKeyboardNavigation();
    initThemeShortcut();
    initLastUserRemember();

    console.log('[Login Enhancements] تم التهيئة بنجاح');
  }

  // ═══════════════════════════════════════
  // HEADER FUNCTIONALITY - وظائف الترويسة
  // ═══════════════════════════════════════

  function initHeaderFunctionality() {
    const headerTime = document.getElementById('headerTime');
    const connectionStatus = document.getElementById('connectionStatus');
    const connectionText = document.getElementById('connectionText');
    const btnCloseHeader = document.getElementById('btnCloseHeader');
    const btnMinHeader = document.getElementById('btnMinHeader');

    // أزرار التحكم في النافذة
    if (btnCloseHeader) {
      btnCloseHeader.addEventListener('click', () => {
        if (window.authBridge && window.authBridge.closeWindow) {
          window.authBridge.closeWindow();
        } else if (window.electronAPI && window.electronAPI.closeWindow) {
          window.electronAPI.closeWindow();
        }
      });
    }

    if (btnMinHeader) {
      btnMinHeader.addEventListener('click', () => {
        if (window.authBridge && window.authBridge.minimizeWindow) {
          window.authBridge.minimizeWindow();
        } else if (window.electronAPI && window.electronAPI.minimizeWindow) {
          window.electronAPI.minimizeWindow();
        }
      });
    }

    // تحديث الوقت
    function updateTime() {
      if (headerTime) {
        const now = new Date();
        const hours = now.getHours().toString().padStart(2, '0');
        const minutes = now.getMinutes().toString().padStart(2, '0');
        headerTime.textContent = `${hours}:${minutes}`;
      }
    }

    // تحديث الوقت فوراً ثم كل دقيقة
    updateTime();
    setInterval(updateTime, 60000);

    // تحديث حالة الاتصال
    function updateConnectionStatus(isOnline) {
      if (connectionStatus && connectionText) {
        if (isOnline) {
          connectionStatus.classList.remove('offline');
          connectionText.textContent = 'متصل';
        } else {
          connectionStatus.classList.add('offline');
          connectionText.textContent = 'غير متصل';
        }
      }
    }

    // فحص حالة الاتصال
    updateConnectionStatus(navigator.onLine);

    // الاستماع لتغييرات الاتصال
    window.addEventListener('online', () => updateConnectionStatus(true));
    window.addEventListener('offline', () => updateConnectionStatus(false));
  }

  // ═══════════════════════════════════════
  // FOOTER FUNCTIONALITY - وظائف الفوتر
  // ═══════════════════════════════════════

  function initFooterFunctionality() {
    const themeToggleFooter = document.getElementById('themeToggleFooter');
    const themeIconFooter = document.getElementById('themeIconFooter');
    const themeTextFooter = document.getElementById('themeTextFooter');
    const helpLink = document.getElementById('helpLink');
    const appVersionEl = document.getElementById('appVersion');
    const forgotModal = document.getElementById('forgotModal');

    // تحديث حالة زر الثيم
    function updateThemeButton() {
      const currentTheme = document.documentElement.getAttribute('data-theme');
      if (themeIconFooter && themeTextFooter) {
        if (currentTheme === 'dark') {
          themeIconFooter.textContent = '🌙';
          themeTextFooter.textContent = 'داكن';
        } else {
          themeIconFooter.textContent = '☀️';
          themeTextFooter.textContent = 'فاتح';
        }
      }
    }

    // تبديل الثيم
    window.toggleThemeFromFooter = function() {
      const currentTheme = document.documentElement.getAttribute('data-theme');
      const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
      document.documentElement.setAttribute('data-theme', newTheme);
      document.documentElement.style.colorScheme = newTheme;
      localStorage.setItem('elos_theme', newTheme);
      updateThemeButton();
      console.log('[Theme] تم التبديل إلى:', newTheme);
    };

    if (themeToggleFooter) {
      themeToggleFooter.addEventListener('click', window.toggleThemeFromFooter);
    }

    // رابط المساعدة
    if (helpLink) {
      helpLink.addEventListener('click', (e) => {
        e.preventDefault();
        if (forgotModal) {
          forgotModal.classList.add('show');
        }
      });
    }

    // جلب رقم الإصدار
    if (appVersionEl) {
      if (window.authBridge && window.authBridge.getAppVersion) {
        window.authBridge.getAppVersion().then(version => {
          appVersionEl.textContent = version || 'V 2.0';
        }).catch(() => {
          appVersionEl.textContent = 'V 2.0';
        });
      } else {
        // محاولة قراءة من package.json (غير متاح في renderer)
        appVersionEl.textContent = 'V 2.0';
      }
    }

    // تحديث زر الثيم عند التحميل
    updateThemeButton();
  }

  // ═══════════════════════════════════════
  // THEME SHORTCUT - اختصار تبديل الثيم
  // ═══════════════════════════════════════

  function initThemeShortcut() {
    document.addEventListener('keydown', (e) => {
      // Ctrl+Shift+T لتبديل الثيم
      if (e.ctrlKey && e.shiftKey && (e.key === 'T' || e.key === 't')) {
        e.preventDefault();
        if (window.toggleThemeFromFooter) {
          window.toggleThemeFromFooter();
        }
      }
    });
  }

  // ═══════════════════════════════════════
  // KEYBOARD NAVIGATION - التنقل بلوحة المفاتيح
  // ═══════════════════════════════════════

  function initKeyboardNavigation() {
    const userPicker = document.getElementById('userPicker');
    const userCards = document.getElementById('userCards');

    if (!userPicker || !userCards) return;

    let currentCardIndex = -1;

    // التنقل بين بطاقات المستخدمين بالأسهم
    document.addEventListener('keydown', (e) => {
      // تجاهل إذا كان التركيز على حقل إدخال
      if (document.activeElement.tagName === 'INPUT') return;

      // تجاهل إذا لم تكن شاشة اختيار المستخدمين ظاهرة
      if (userPicker.classList.contains('hidden')) return;

      const cards = userCards.querySelectorAll('.user-card');
      if (cards.length === 0) return;

      // التنقل بالأسهم (RTL: يسار = التالي، يمين = السابق)
      if (e.key === 'ArrowLeft' || e.key === 'ArrowDown') {
        e.preventDefault();
        currentCardIndex = Math.min(currentCardIndex + 1, cards.length - 1);
        focusCard(cards, currentCardIndex);
      } else if (e.key === 'ArrowRight' || e.key === 'ArrowUp') {
        e.preventDefault();
        currentCardIndex = Math.max(currentCardIndex - 1, 0);
        focusCard(cards, currentCardIndex);
      } else if (e.key === 'Enter' && currentCardIndex >= 0) {
        e.preventDefault();
        cards[currentCardIndex].click();
      } else if (e.key === 'Tab' && !e.shiftKey) {
        // Tab للتنقل التالي
        e.preventDefault();
        currentCardIndex = (currentCardIndex + 1) % cards.length;
        focusCard(cards, currentCardIndex);
      } else if (e.key === 'Tab' && e.shiftKey) {
        // Shift+Tab للتنقل السابق
        e.preventDefault();
        currentCardIndex = currentCardIndex <= 0 ? cards.length - 1 : currentCardIndex - 1;
        focusCard(cards, currentCardIndex);
      }
    });

    function focusCard(cards, index) {
      cards.forEach((card) => {
        card.classList.remove('keyboard-focus');
        card.removeAttribute('tabindex');
      });
      if (cards[index]) {
        cards[index].classList.add('keyboard-focus');
        cards[index].setAttribute('tabindex', '0');
        cards[index].focus();
      }
    }

    // إضافة tabindex للبطاقات عند التحميل
    const observer = new MutationObserver(() => {
      const cards = userCards.querySelectorAll('.user-card');
      cards.forEach((card, index) => {
        if (!card.hasAttribute('tabindex')) {
          card.setAttribute('tabindex', index === 0 ? '0' : '-1');
        }
      });
    });

    observer.observe(userCards, { childList: true });
  }

  // ═══════════════════════════════════════
  // REMEMBER LAST USER - تذكر آخر مستخدم
  // ═══════════════════════════════════════

  function initLastUserRemember() {
    // حفظ آخر مستخدم ووقت الدخول عند تسجيل الدخول بنجاح
    window.addEventListener('message', (event) => {
      if (event.data.type === 'login-success') {
        const usernameInput = document.getElementById('username');
        if (usernameInput && usernameInput.value) {
          const username = usernameInput.value.trim();
          localStorage.setItem('elos_last_user', username);

          // حفظ تاريخ آخر تسجيل دخول لكل مستخدم
          const loginDates = JSON.parse(localStorage.getItem('elos_login_dates') || '{}');
          loginDates[username] = new Date().toISOString();
          localStorage.setItem('elos_login_dates', JSON.stringify(loginDates));
        }
      }
    });

    // الاستماع أيضاً لـ authBridge (إذا كانت قابلة للتعديل)
    if (window.authBridge && typeof window.authBridge.onLoginSuccess === 'function') {
      try {
        const originalOnSuccess = window.authBridge.onLoginSuccess;
        // محاولة تغليف الدالة الأصلية - قد تفشل إذا كانت read-only
        const wrappedCallback = function(callback) {
          return originalOnSuccess(function(data) {
            const usernameInput = document.getElementById('username');
            if (usernameInput && usernameInput.value) {
              const username = usernameInput.value.trim();
              localStorage.setItem('elos_last_user', username);

              const loginDates = JSON.parse(localStorage.getItem('elos_login_dates') || '{}');
              loginDates[username] = new Date().toISOString();
              localStorage.setItem('elos_login_dates', JSON.stringify(loginDates));
            }
            callback(data);
          });
        };

        // فحص إذا كانت الخاصية قابلة للكتابة
        const descriptor = Object.getOwnPropertyDescriptor(window.authBridge, 'onLoginSuccess');
        if (!descriptor || descriptor.writable !== false) {
          window.authBridge.onLoginSuccess = wrappedCallback;
        }
      } catch (e) {
        // الخاصية للقراءة فقط - نتجاهل الخطأ
        console.log('[Login Enhancements] authBridge.onLoginSuccess is read-only, skipping wrap');
      }
    }

    // تحديد آخر مستخدم تلقائياً وإضافة تاريخ آخر دخول
    setTimeout(() => {
      addLastLoginDates();

      const userCardsEl = document.getElementById('userCards');
      const savedUsername = localStorage.getItem('elos_saved_username');
      const lastUser = localStorage.getItem('elos_last_user');

      if (!savedUsername && lastUser && userCardsEl) {
        const cards = userCardsEl.querySelectorAll('.user-card:not(.other-user)');
        cards.forEach(card => {
          const nameEl = card.querySelector('.user-name');
          if (nameEl && nameEl.textContent.trim() === lastUser) {
            card.classList.add('selected');
          }
        });
      }
    }, 200);

    // مراقبة التغييرات في بطاقات المستخدمين
    const userCardsEl = document.getElementById('userCards');
    if (userCardsEl) {
      const observer = new MutationObserver(() => {
        setTimeout(addLastLoginDates, 50);
      });
      observer.observe(userCardsEl, { childList: true });
    }
  }

  // ═══════════════════════════════════════
  // LAST LOGIN DATES - تواريخ آخر تسجيل دخول
  // ═══════════════════════════════════════

  function addLastLoginDates() {
    const userCardsEl = document.getElementById('userCards');
    if (!userCardsEl) return;

    const loginDates = JSON.parse(localStorage.getItem('elos_login_dates') || '{}');
    const cards = userCardsEl.querySelectorAll('.user-card:not(.other-user)');

    cards.forEach(card => {
      // تجاهل إذا كان التاريخ موجوداً بالفعل
      if (card.querySelector('.user-last-login')) return;

      const nameEl = card.querySelector('.user-name');
      if (!nameEl) return;

      const username = nameEl.textContent.trim();
      const lastLogin = loginDates[username];

      if (lastLogin) {
        const dateEl = document.createElement('div');
        dateEl.className = 'user-last-login';
        dateEl.innerHTML = `<span>🕐</span><span>${formatLastLogin(lastLogin)}</span>`;
        nameEl.parentNode.appendChild(dateEl);
      }
    });
  }

  // تنسيق تاريخ آخر دخول
  function formatLastLogin(isoDate) {
    try {
      const date = new Date(isoDate);
      const now = new Date();
      const diffMs = now - date;
      const diffMins = Math.floor(diffMs / 60000);
      const diffHours = Math.floor(diffMs / 3600000);
      const diffDays = Math.floor(diffMs / 86400000);

      if (diffMins < 1) return 'الآن';
      if (diffMins < 60) return `منذ ${diffMins} دقيقة`;
      if (diffHours < 24) return `منذ ${diffHours} ساعة`;
      if (diffDays < 7) return `منذ ${diffDays} يوم`;

      // تنسيق التاريخ بالعربية
      return date.toLocaleDateString('ar-EG', {
        day: 'numeric',
        month: 'short'
      });
    } catch (e) {
      return '';
    }
  }

})();
