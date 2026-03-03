/**
 * ELOS Accounting System - Lucide Icons Initializer
 * Version: 2.0
 * Description: Initializes and manages Lucide icons throughout the application
 */

(function() {
  'use strict';

  /**
   * Initialize Lucide icons
   */
  function initLucideIcons() {
    if (typeof lucide === 'undefined') {
      console.warn('[Lucide] Lucide library not loaded');
      return false;
    }

    try {
      lucide.createIcons();
      console.log('[Lucide] Icons initialized successfully');
      return true;
    } catch (error) {
      console.error('[Lucide] Failed to initialize icons:', error);
      return false;
    }
  }

  /**
   * Refresh icons (useful after dynamic content updates)
   */
  function refreshIcons(container) {
    if (typeof lucide === 'undefined') {
      console.warn('[Lucide] Lucide library not loaded');
      return;
    }

    try {
      if (container) {
        // Refresh icons within a specific container
        const icons = container.querySelectorAll('[data-lucide]');
        icons.forEach(icon => {
          lucide.createIcons({ nodes: [icon] });
        });
      } else {
        // Refresh all icons
        lucide.createIcons();
      }
    } catch (error) {
      console.error('[Lucide] Failed to refresh icons:', error);
    }
  }

  /**
   * Create a single icon element
   * @param {string} name - Icon name (e.g., 'shopping-cart', 'users')
   * @param {Object} options - Icon options
   * @returns {HTMLElement} Icon element
   */
  function createIcon(name, options = {}) {
    const {
      size = 24,
      color = 'currentColor',
      strokeWidth = 2,
      className = ''
    } = options;

    const icon = document.createElement('i');
    icon.setAttribute('data-lucide', name);
    icon.style.width = `${size}px`;
    icon.style.height = `${size}px`;
    icon.style.color = color;
    icon.style.strokeWidth = `${strokeWidth}px`;

    if (className) {
      icon.className = className;
    }

    // Immediately render if Lucide is available
    if (typeof lucide !== 'undefined') {
      lucide.createIcons({ nodes: [icon] });
    }

    return icon;
  }

  /**
   * Replace emoji with Lucide icon
   * @param {HTMLElement} element - Element containing emoji
   * @param {string} iconName - Lucide icon name
   */
  function replaceEmoji(element, iconName) {
    const icon = document.createElement('i');
    icon.setAttribute('data-lucide', iconName);
    element.replaceWith(icon);

    if (typeof lucide !== 'undefined') {
      lucide.createIcons({ nodes: [icon] });
    }
  }

  /**
   * Emoji to Lucide icon mapping
   */
  const emojiToIconMap = {
    // Navigation & Pages
    '🛒': 'shopping-cart',
    '📦': 'package',
    '🎧': 'headphones',
    '💰': 'wallet',
    '👥': 'users',
    '🏭': 'building-2',
    '👔': 'user-cog',
    '📈': 'trending-up',
    '🛍️': 'shopping-bag',
    '📊': 'bar-chart-3',
    '⚙️': 'settings',

    // Actions
    '➕': 'plus',
    '🗑️': 'trash-2',
    '✏️': 'pencil',
    '🔍': 'search',
    '💾': 'save',
    '🖨️': 'printer',
    '📤': 'download',
    '❌': 'x',
    '✅': 'check',
    '⚠️': 'alert-triangle',
    'ℹ️': 'info',

    // Time & Date
    '🕐': 'clock',
    '📅': 'calendar',

    // Device & Tech
    '📱': 'smartphone',
    '📟': 'scan-barcode',

    // Arrows & Directions
    '⬇️': 'arrow-down-circle',
    '⬆️': 'arrow-up-circle',
    '←': 'arrow-right', // RTL
    '→': 'arrow-left',  // RTL

    // Theme
    '🌙': 'moon',
    '☀️': 'sun',

    // Status
    '✔️': 'check-circle',
    '❎': 'x-circle',

    // Money
    '💵': 'banknote',
    '💳': 'credit-card',

    // Communication
    '📞': 'phone',
    '✉️': 'mail',

    // Files
    '📁': 'folder',
    '📄': 'file-text',

    // Other
    '🏠': 'home',
    '🔒': 'lock',
    '🔓': 'unlock',
    '🔔': 'bell',
    '⭐': 'star',
    '❤️': 'heart',
    '🔄': 'refresh-cw',
    '📋': 'clipboard',
    '🏷️': 'tag',
  };

  /**
   * Get icon name from emoji
   * @param {string} emoji - Emoji character
   * @returns {string|null} Icon name or null if not found
   */
  function getIconFromEmoji(emoji) {
    return emojiToIconMap[emoji] || null;
  }

  /**
   * Auto-replace all emojis with Lucide icons
   * @param {HTMLElement} container - Container to search in (default: document.body)
   */
  function autoReplaceEmojis(container = document.body) {
    const emojiRegex = /[\u{1F300}-\u{1F9FF}]|[\u{2600}-\u{26FF}]|[\u{2700}-\u{27BF}]|[\u{1F600}-\u{1F64F}]|[\u{1F680}-\u{1F6FF}]|[\u{1F1E0}-\u{1F1FF}]/gu;

    // Find text nodes containing emojis
    const walker = document.createTreeWalker(
      container,
      NodeFilter.SHOW_TEXT,
      {
        acceptNode: (node) => {
          return emojiRegex.test(node.textContent)
            ? NodeFilter.FILTER_ACCEPT
            : NodeFilter.FILTER_REJECT;
        }
      }
    );

    const nodesToReplace = [];
    let node;

    while (node = walker.nextNode()) {
      nodesToReplace.push(node);
    }

    nodesToReplace.forEach(textNode => {
      const text = textNode.textContent;
      const matches = text.match(emojiRegex);

      if (matches) {
        matches.forEach(emoji => {
          const iconName = getIconFromEmoji(emoji);
          if (iconName) {
            // Replace emoji with icon placeholder
            const span = document.createElement('span');
            span.innerHTML = text.replace(emoji, `<i data-lucide="${iconName}"></i>`);
            textNode.parentNode.replaceChild(span, textNode);
          }
        });
      }
    });

    // Re-initialize icons
    refreshIcons(container);
  }

  // Initialize on DOM ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initLucideIcons);
  } else {
    initLucideIcons();
  }

  // Expose globally
  window.LucideInit = {
    init: initLucideIcons,
    refresh: refreshIcons,
    createIcon: createIcon,
    replaceEmoji: replaceEmoji,
    getIconFromEmoji: getIconFromEmoji,
    autoReplaceEmojis: autoReplaceEmojis,
    emojiToIconMap: emojiToIconMap
  };

  // Also expose as global function for convenience
  window.refreshLucideIcons = refreshIcons;

})();
