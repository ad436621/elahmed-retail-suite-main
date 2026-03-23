/**
 * ELOS Theme Sync Script v3.0
 * Centralized theme management - uses data-theme attribute only
 * Theme colors are driven by CSS variables in tokens.css
 */

(function() {
  'use strict';

  const THEME_KEY = 'elos_theme';
  const THEME_KEY_ALT = 'elos-theme'; // Backward compatibility

  /**
   * Get theme from URL parameter, localStorage, or default to 'dark'
   */
  function getTheme() {
    // Telemetry removed for production
    const params = new URLSearchParams(window.location.search);
    const urlTheme = params.get('theme');
    if (urlTheme === 'light' || urlTheme === 'dark') {
      return urlTheme;
    }
    const result = localStorage.getItem(THEME_KEY) || localStorage.getItem(THEME_KEY_ALT) || 'dark';
    return result;
  }

  /**
   * Set theme - only sets data-theme attribute, CSS handles colors
   */
  function setTheme(theme) {
    // Telemetry removed for production
    if (theme !== 'light' && theme !== 'dark') {
      theme = 'dark';
    }

    const html = document.documentElement;
    html.setAttribute('data-theme', theme);
    
    // Store in localStorage
    localStorage.setItem(THEME_KEY, theme);
    
    // Remove old key if exists (migration)
    if (localStorage.getItem(THEME_KEY_ALT)) {
      localStorage.removeItem(THEME_KEY_ALT);
    }

    console.log('[Theme-Sync] Theme set to:', theme);
  }

  /**
   * Apply theme on page load (immediate, prevents flash)
   */
  function initTheme() {
    const savedTheme = getTheme();
    setTheme(savedTheme);
  }

  // ⚡ Immediate application to prevent flash (runs before DOMContentLoaded)
  if (document.documentElement) {
    const savedTheme = getTheme();
    document.documentElement.setAttribute('data-theme', savedTheme);
  }

  // Listen for messages from parent window (iframe sync)
  window.addEventListener('message', (event) => {
    if (event.data && event.data.type === 'theme-change') {
      setTheme(event.data.theme);
    }
  });

  // Listen for localStorage changes (cross-tab sync)
  window.addEventListener('storage', (e) => {
    if (e.key === THEME_KEY || e.key === THEME_KEY_ALT) {
      const newTheme = e.newValue || 'dark';
      setTheme(newTheme);
    }
  });

  // Listen for custom themechange event
  window.addEventListener('themechange', (e) => {
    if (e.detail && e.detail.theme) {
      setTheme(e.detail.theme);
    }
  });

  // Apply theme when DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initTheme);
  } else {
    initTheme();
  }
  
  // Monitor localStorage operations for testing
  const originalSetItem = localStorage.setItem;
  const originalRemoveItem = localStorage.removeItem;
  localStorage.setItem = function(key, value) {
    // Telemetry removed for production
    return originalSetItem.call(this, key, value);
  };
  localStorage.removeItem = function(key) {
    // Telemetry removed for production
    return originalRemoveItem.call(this, key);
  };

  // Export for external use
  window.ThemeSync = {
    getTheme,
    setTheme
  };
})();
