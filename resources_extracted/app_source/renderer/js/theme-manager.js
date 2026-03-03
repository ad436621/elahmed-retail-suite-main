/**
 * ELOS Accounting System - Theme Manager
 * Version: 2.0
 * Description: Handles theme switching (dark/light) with localStorage persistence
 */

class ThemeManager {
  constructor() {
    this.storageKey = 'elos-theme';
    this.defaultTheme = 'dark';
    this.theme = this.getStoredTheme() || this.defaultTheme;

    // Initialize on DOM ready
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', () => this.init());
    } else {
      this.init();
    }
  }

  /**
   * Initialize theme manager
   */
  init() {
    this.apply();
    this.setupListeners();
    console.log(`[ThemeManager] Initialized with theme: ${this.theme}`);
  }

  /**
   * Get stored theme from localStorage
   */
  getStoredTheme() {
    try {
      return localStorage.getItem(this.storageKey);
    } catch (e) {
      console.warn('[ThemeManager] Could not read from localStorage:', e);
      return null;
    }
  }

  /**
   * Apply current theme to document
   */
  apply() {
    // Set theme attribute
    document.documentElement.setAttribute('data-theme', this.theme);

    // Update body class for backwards compatibility
    document.body.classList.remove('theme-dark', 'theme-light');
    document.body.classList.add(`theme-${this.theme}`);

    // Update theme toggle icon
    this.updateIcon();

    // Add transition class temporarily for smooth theme change
    document.body.classList.add('theme-transition');
    setTimeout(() => {
      document.body.classList.remove('theme-transition');
    }, 300);
  }

  /**
   * Toggle between dark and light themes
   */
  toggle() {
    this.theme = this.theme === 'dark' ? 'light' : 'dark';
    this.save();
    this.apply();

    // Dispatch custom event for other components to react
    window.dispatchEvent(new CustomEvent('themechange', {
      detail: { theme: this.theme }
    }));

    console.log(`[ThemeManager] Theme toggled to: ${this.theme}`);
  }

  /**
   * Set specific theme
   * @param {string} theme - 'dark' or 'light'
   */
  setTheme(theme) {
    if (theme !== 'dark' && theme !== 'light') {
      console.warn(`[ThemeManager] Invalid theme: ${theme}`);
      return;
    }

    this.theme = theme;
    this.save();
    this.apply();

    window.dispatchEvent(new CustomEvent('themechange', {
      detail: { theme: this.theme }
    }));
  }

  /**
   * Save theme to localStorage
   */
  save() {
    try {
      localStorage.setItem(this.storageKey, this.theme);
    } catch (e) {
      console.warn('[ThemeManager] Could not save to localStorage:', e);
    }
  }

  /**
   * Update theme toggle icon
   */
  updateIcon() {
    const icons = document.querySelectorAll('.theme-toggle-icon, [data-theme-icon]');

    icons.forEach(icon => {
      const newIconName = this.theme === 'dark' ? 'sun' : 'moon';

      // For Lucide icons
      if (icon.hasAttribute('data-lucide')) {
        icon.setAttribute('data-lucide', newIconName);
        // Re-render icon if Lucide is available
        if (typeof lucide !== 'undefined') {
          lucide.createIcons({ nodes: [icon] });
        }
      }

      // For custom implementation
      if (icon.hasAttribute('data-theme-icon')) {
        icon.setAttribute('data-theme-icon', newIconName);
      }
    });
  }

  /**
   * Setup event listeners for theme toggle buttons
   */
  setupListeners() {
    // Listen for clicks on theme toggle buttons
    document.addEventListener('click', (e) => {
      const toggleBtn = e.target.closest('.theme-toggle, [data-theme-toggle]');
      if (toggleBtn) {
        e.preventDefault();
        this.toggle();
      }
    });

    // Listen for keyboard shortcuts (Alt + T)
    document.addEventListener('keydown', (e) => {
      if (e.altKey && e.key === 't') {
        e.preventDefault();
        this.toggle();
      }
    });

    // Listen for system preference changes
    if (window.matchMedia) {
      const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
      mediaQuery.addEventListener('change', (e) => {
        // Only auto-switch if no preference is stored
        if (!this.getStoredTheme()) {
          this.setTheme(e.matches ? 'dark' : 'light');
        }
      });
    }
  }

  /**
   * Get current theme
   */
  getCurrentTheme() {
    return this.theme;
  }

  /**
   * Check if current theme is dark
   */
  isDark() {
    return this.theme === 'dark';
  }

  /**
   * Check if current theme is light
   */
  isLight() {
    return this.theme === 'light';
  }
}

// Create global instance
window.themeManager = new ThemeManager();

// Export for module usage
if (typeof module !== 'undefined' && module.exports) {
  module.exports = ThemeManager;
}
