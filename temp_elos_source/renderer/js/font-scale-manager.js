/**
 * ELOS Accounting System - Font Scale Manager
 * Version: 1.0
 * Description: Handles dynamic font scaling across the entire application
 * with localStorage persistence and real-time preview
 */

class FontScaleManager {
  constructor() {
    this.storageKey = 'elos-font-scale';
    this.defaultScale = 1.0; // 100%
    this.minScale = 0.8;     // 80%
    this.maxScale = 1.4;     // 140%
    this.step = 0.1;         // 10% increments

    // Preset scale options
    this.presets = {
      small: 0.85,      // 85% - صغير
      normal: 1.0,      // 100% - عادي
      medium: 1.15,     // 115% - متوسط
      large: 1.3,       // 130% - كبير
      xlarge: 1.4       // 140% - كبير جداً
    };

    this.scale = this.getStoredScale() || this.defaultScale;

    // Initialize immediately to prevent flash of unstyled content
    this.applyScale();

    // Setup listeners on DOM ready
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', () => this.init());
    } else {
      this.init();
    }
  }

  /**
   * Initialize font scale manager
   */
  init() {
    this.setupListeners();
    this.updateUI();
    console.log(`[FontScaleManager] Initialized with scale: ${this.scale} (${Math.round(this.scale * 100)}%)`);
  }

  /**
   * Get stored scale from localStorage
   */
  getStoredScale() {
    try {
      const stored = localStorage.getItem(this.storageKey);
      if (stored) {
        const scale = parseFloat(stored);
        if (scale >= this.minScale && scale <= this.maxScale) {
          return scale;
        }
      }
      return null;
    } catch (e) {
      console.warn('[FontScaleManager] Could not read from localStorage:', e);
      return null;
    }
  }

  /**
   * Apply current scale to document
   */
  applyScale() {
    // Set CSS custom property for font scaling
    document.documentElement.style.setProperty('--font-scale', this.scale);

    // Set data attribute for CSS targeting
    document.documentElement.setAttribute('data-font-scale', this.getScaleLabel());

    // Apply base font size calculation
    const baseFontSize = Math.round(16 * this.scale);
    document.documentElement.style.setProperty('--base-font-size', `${baseFontSize}px`);

    // Calculate and set scaled font sizes
    this.setScaledFontSizes();
  }

  /**
   * Set all scaled font size variables
   */
  setScaledFontSizes() {
    const root = document.documentElement;

    // Base sizes (will be multiplied by scale)
    const baseSizes = {
      'fs-xs': 12,
      'fs-sm': 13,
      'fs-base': 16,
      'fs-md': 17,
      'fs-lg': 20,
      'fs-xl': 24,
      'fs-2xl': 28,
      'fs-3xl': 32,
      'fs-4xl': 38
    };

    // Apply scaled sizes
    Object.entries(baseSizes).forEach(([name, size]) => {
      const scaledSize = Math.round(size * this.scale);
      root.style.setProperty(`--${name}`, `${scaledSize}px`);
    });
  }

  /**
   * Get current scale label
   */
  getScaleLabel() {
    if (this.scale <= 0.85) return 'small';
    if (this.scale <= 1.05) return 'normal';
    if (this.scale <= 1.2) return 'medium';
    if (this.scale <= 1.35) return 'large';
    return 'xlarge';
  }

  /**
   * Get scale display text
   */
  getScaleDisplayText() {
    const labels = {
      small: 'صغير',
      normal: 'عادي',
      medium: 'متوسط',
      large: 'كبير',
      xlarge: 'كبير جداً'
    };
    return labels[this.getScaleLabel()] || 'عادي';
  }

  /**
   * Set scale from preset
   * @param {string} preset - 'small', 'normal', 'medium', 'large', 'xlarge'
   */
  setPreset(preset) {
    if (this.presets[preset] !== undefined) {
      this.setScale(this.presets[preset]);
    }
  }

  /**
   * Set specific scale value
   * @param {number} scale - Scale value between minScale and maxScale
   */
  setScale(scale) {
    // Clamp scale value
    scale = Math.max(this.minScale, Math.min(this.maxScale, scale));

    // Round to one decimal place
    scale = Math.round(scale * 10) / 10;

    if (scale === this.scale) return;

    this.scale = scale;
    this.save();
    this.applyScale();
    this.updateUI();

    // Dispatch custom event
    window.dispatchEvent(new CustomEvent('fontscalechange', {
      detail: {
        scale: this.scale,
        percentage: Math.round(this.scale * 100),
        label: this.getScaleLabel()
      }
    }));

    console.log(`[FontScaleManager] Scale changed to: ${this.scale} (${Math.round(this.scale * 100)}%)`);
  }

  /**
   * Increase font scale
   */
  increase() {
    this.setScale(this.scale + this.step);
  }

  /**
   * Decrease font scale
   */
  decrease() {
    this.setScale(this.scale - this.step);
  }

  /**
   * Reset to default scale
   */
  reset() {
    this.setScale(this.defaultScale);
  }

  /**
   * Save scale to localStorage
   */
  save() {
    try {
      localStorage.setItem(this.storageKey, this.scale.toString());
    } catch (e) {
      console.warn('[FontScaleManager] Could not save to localStorage:', e);
    }
  }

  /**
   * Update UI elements that show current scale
   */
  updateUI() {
    // Update range slider
    const slider = document.getElementById('fontScaleSlider');
    if (slider) {
      slider.value = this.scale;
    }

    // Update percentage display
    const display = document.getElementById('fontScaleDisplay');
    if (display) {
      display.textContent = `${Math.round(this.scale * 100)}%`;
    }

    // Update label display
    const label = document.getElementById('fontScaleLabel');
    if (label) {
      label.textContent = this.getScaleDisplayText();
    }

    // Update select dropdown
    const select = document.getElementById('fontScaleSelect');
    if (select) {
      select.value = this.getScaleLabel();
    }

    // Update preset buttons
    const presetButtons = document.querySelectorAll('[data-font-scale-preset]');
    presetButtons.forEach(btn => {
      const preset = btn.getAttribute('data-font-scale-preset');
      btn.classList.toggle('active', preset === this.getScaleLabel());
    });
  }

  /**
   * Setup event listeners
   */
  setupListeners() {
    // Listen for slider changes
    document.addEventListener('input', (e) => {
      if (e.target.id === 'fontScaleSlider') {
        this.setScale(parseFloat(e.target.value));
      }
    });

    // Listen for select changes
    document.addEventListener('change', (e) => {
      if (e.target.id === 'fontScaleSelect') {
        this.setPreset(e.target.value);
      }
    });

    // Listen for preset button clicks
    document.addEventListener('click', (e) => {
      const presetBtn = e.target.closest('[data-font-scale-preset]');
      if (presetBtn) {
        e.preventDefault();
        this.setPreset(presetBtn.getAttribute('data-font-scale-preset'));
      }

      // Increase button
      if (e.target.closest('#fontScaleIncrease')) {
        e.preventDefault();
        this.increase();
      }

      // Decrease button
      if (e.target.closest('#fontScaleDecrease')) {
        e.preventDefault();
        this.decrease();
      }

      // Reset button
      if (e.target.closest('#fontScaleReset')) {
        e.preventDefault();
        this.reset();
      }
    });

    // Keyboard shortcuts (Ctrl/Cmd + Plus/Minus)
    document.addEventListener('keydown', (e) => {
      if (e.ctrlKey || e.metaKey) {
        if (e.key === '+' || e.key === '=') {
          e.preventDefault();
          this.increase();
        } else if (e.key === '-') {
          e.preventDefault();
          this.decrease();
        } else if (e.key === '0') {
          e.preventDefault();
          this.reset();
        }
      }
    });
  }

  /**
   * Get current scale
   */
  getCurrentScale() {
    return this.scale;
  }

  /**
   * Get scale percentage
   */
  getPercentage() {
    return Math.round(this.scale * 100);
  }
}

// Create global instance
window.fontScaleManager = new FontScaleManager();

// Export for module usage
if (typeof module !== 'undefined' && module.exports) {
  module.exports = FontScaleManager;
}
