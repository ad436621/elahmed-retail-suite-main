// ═══════════════════════════════════════════════════════════════
// 🎯 ELOS NAVIGATION SYSTEM - Fast & Smooth Page Transitions
// ═══════════════════════════════════════════════════════════════

// Fallbacks if utils.js not loaded yet
if (!window.Logger) window.Logger = { log: () => {}, warn: () => {}, error: console.error, debug: () => {}, info: () => {} };
var Logger = window.Logger;

(function() {
  'use strict';

  // ═════════════════════════════════════
  // ⚡ Performance: Prefetch pages
  // ═════════════════════════════════════
  const prefetchedPages = new Set();

  function prefetchPage(href) {
    if (prefetchedPages.has(href)) return;
    prefetchedPages.add(href);

    const link = document.createElement('link');
    link.rel = 'prefetch';
    link.href = href;
    link.as = 'document';
    document.head.appendChild(link);
  }

  // ═════════════════════════════════════
  // 🎨 Page Fade In Animation (faster)
  // ═════════════════════════════════════
  function initPageTransition() {
    // Faster fade-in
    document.body.style.animation = 'pageTransitionIn 0.15s ease-out';
  }

  // ═════════════════════════════════════
  // ⏳ Loading Indicator (lighter)
  // ═════════════════════════════════════
  let loaderStyleAdded = false;

  function ensureLoaderStyles() {
    if (loaderStyleAdded) return;
    loaderStyleAdded = true;

    const style = document.createElement('style');
    style.id = 'nav-loader-styles';
    style.textContent = `
      #page-loader {
        position: fixed;
        top: 0;
        left: 0;
        right: 0;
        bottom: 0;
        background: rgba(10, 14, 20, 0.9);
        z-index: 99999;
        display: none;
        align-items: center;
        justify-content: center;
        opacity: 0;
        transition: opacity 0.1s ease;
      }

      #page-loader.show {
        display: flex !important;
        opacity: 1;
      }

      .loader-content {
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 12px;
      }

      .loader-spinner {
        width: 40px;
        height: 40px;
        border: 3px solid rgba(59, 130, 246, 0.2);
        border-top-color: #3b82f6;
        border-radius: 50%;
        animation: spin 0.6s linear infinite;
      }

      .loader-text {
        color: #e6e8ee;
        font-size: 13px;
        font-weight: 600;
        font-family: system-ui, 'Cairo', sans-serif;
      }

      @keyframes spin {
        to { transform: rotate(360deg); }
      }

      @keyframes pageTransitionIn {
        from { opacity: 0; }
        to { opacity: 1; }
      }

      @keyframes pageTransitionOut {
        from { opacity: 1; }
        to { opacity: 0; }
      }
    `;
    document.head.appendChild(style);
  }

  function createLoadingIndicator() {
    ensureLoaderStyles();

    let loader = document.getElementById('page-loader');
    if (loader) return loader;

    loader = document.createElement('div');
    loader.id = 'page-loader';
    loader.innerHTML = `
      <div class="loader-content">
        <div class="loader-spinner"></div>
        <div class="loader-text">جاري التحميل...</div>
      </div>
    `;
    document.body.appendChild(loader);
    return loader;
  }

  function showLoader() {
    const loader = createLoadingIndicator();
    // Use requestAnimationFrame for smoother display
    requestAnimationFrame(() => {
      loader.classList.add('show');
    });
  }

  function hideLoader() {
    const loader = document.getElementById('page-loader');
    if (loader) {
      loader.classList.remove('show');
    }
  }

  // ═════════════════════════════════════
  // 🔊 Navigation Sound Effect (cached)
  // ═════════════════════════════════════
  let audioCtx = null;

  function playNavigationSound() {
    if (localStorage.getItem('elos_sounds') === 'off') return;

    try {
      // Reuse AudioContext
      if (!audioCtx) {
        audioCtx = new (window.AudioContext || window.webkitAudioContext)();
      }

      // Resume if suspended
      if (audioCtx.state === 'suspended') {
        audioCtx.resume();
      }

      const oscillator = audioCtx.createOscillator();
      const gainNode = audioCtx.createGain();

      oscillator.connect(gainNode);
      gainNode.connect(audioCtx.destination);

      oscillator.frequency.setValueAtTime(600, audioCtx.currentTime);
      oscillator.frequency.exponentialRampToValueAtTime(200, audioCtx.currentTime + 0.1);
      oscillator.type = 'sine';

      gainNode.gain.setValueAtTime(0.1, audioCtx.currentTime);
      gainNode.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.1);

      oscillator.start(audioCtx.currentTime);
      oscillator.stop(audioCtx.currentTime + 0.1);
    } catch (e) {
      // Silent fail
    }
  }

  // ═════════════════════════════════════
  // 🔗 Fast Navigation
  // ═════════════════════════════════════
  function enhanceNavigation() {
    const navLinks = document.querySelectorAll('a[href$=".html"], .tile, .back-btn, .action-btn');

    navLinks.forEach(link => {
      if (link.dataset.enhanced) return;
      link.dataset.enhanced = 'true';

      const href = link.getAttribute('href');
      if (!href || !href.endsWith('.html')) return;

      // Prefetch on hover for instant navigation
      link.addEventListener('mouseenter', function() {
        prefetchPage(href);
      }, { once: true, passive: true });

      link.addEventListener('click', function(e) {
        e.preventDefault();

        // Play sound (non-blocking)
        playNavigationSound();

        // Quick fade out
        document.body.style.animation = 'pageTransitionOut 0.08s ease-in';
        document.body.style.opacity = '0';

        // Navigate immediately (no artificial delay)
        // The browser will show new page once ready
        requestAnimationFrame(() => {
          window.location.href = href;
        });
      });
    });
  }

  // ═════════════════════════════════════
  // 🚀 Initialize
  // ═════════════════════════════════════
  function init() {
    initPageTransition();
    hideLoader();
    enhanceNavigation();

    // Prefetch common pages in background
    requestIdleCallback ? requestIdleCallback(prefetchCommonPages) : setTimeout(prefetchCommonPages, 1000);
  }

  function prefetchCommonPages() {
    // Prefetch most used pages
    const commonPages = ['./pos.html', './warehouses.html', './index.html', './clients.html'];
    commonPages.forEach(page => {
      // Check if different from current page
      if (!window.location.href.includes(page.replace('./', ''))) {
        prefetchPage(page);
      }
    });
  }

  // Run on DOM ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  window.enhanceNavigation = enhanceNavigation;

})();