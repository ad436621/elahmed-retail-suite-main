/**
 * ELOS Theme Debug Harness
 * Toggle with ?theme_debug=1 in URL
 * Logs theme state, CSS files, and computed styles for key elements
 */

(function() {
  'use strict';

  // Check if debug mode is enabled
  const params = new URLSearchParams(window.location.search);
  const isDebugMode = params.get('theme_debug') === '1';

  if (!isDebugMode) return;

  // Telemetry removed for production

  function logThemeState() {
    const theme = document.documentElement.getAttribute('data-theme') || 'not-set';
    const storedTheme = localStorage.getItem('elos_theme') || localStorage.getItem('elos-theme') || 'not-set';
    
    console.group('🎨 Theme State');
    console.log('Current theme (data-theme):', theme);
    console.log('Stored theme (localStorage):', storedTheme);
    console.log('HTML element classes:', document.documentElement.className);
    console.log('Body classes:', document.body.className);
    console.groupEnd();

    // Telemetry removed for production
  }

  function logCSSFiles() {
    const stylesheets = Array.from(document.styleSheets);
    const cssFiles = [];

    stylesheets.forEach((sheet, index) => {
      try {
        const href = sheet.href || 'inline';
        cssFiles.push({
          index,
          href: href.includes('://') ? href.split('/').pop() : href,
          rules: sheet.cssRules ? sheet.cssRules.length : 0
        });
      } catch (e) {
        cssFiles.push({
          index,
          href: 'cross-origin',
          rules: 'N/A'
        });
      }
    });

    console.group('📄 Loaded CSS Files (in order)');
    cssFiles.forEach(file => {
      console.log(`${file.index + 1}. ${file.href} (${file.rules} rules)`);
    });
    console.groupEnd();

    // Telemetry removed for production
  }

  function getComputedStyleValue(element, property) {
    try {
      return window.getComputedStyle(element).getPropertyValue(property).trim() || 'not-set';
    } catch (e) {
      return 'error';
    }
  }

  function logElementStyles(selector, label) {
    const elements = document.querySelectorAll(selector);
    if (elements.length === 0) {
      console.log(`⚠️ ${label}: No elements found for "${selector}"`);
      return;
    }

    const element = elements[0];
    const styles = {
      backgroundColor: getComputedStyleValue(element, 'background-color'),
      color: getComputedStyleValue(element, 'color'),
      borderColor: getComputedStyleValue(element, 'border-color'),
      borderTopColor: getComputedStyleValue(element, 'border-top-color'),
      boxShadow: getComputedStyleValue(element, 'box-shadow'),
      dataTheme: element.getAttribute('data-theme') || 'none'
    };

    console.group(`🔍 ${label} (${selector})`);
    console.log('Element:', element);
    console.log('Background:', styles.backgroundColor);
    console.log('Color:', styles.color);
    console.log('Border Color:', styles.borderColor);
    console.log('Box Shadow:', styles.boxShadow);
    console.log('data-theme attr:', styles.dataTheme);
    console.groupEnd();

    // Telemetry removed for production
  }

  function auditKeyElements() {
    console.group('🔬 Computed Styles Audit');
    
    // Critical elements
    logElementStyles('body', 'Body');
    logElementStyles('html', 'HTML Root');
    logElementStyles('.card', 'Card');
    logElementStyles('.panel', 'Panel');
    logElementStyles('table', 'Table');
    logElementStyles('thead', 'Table Header');
    logElementStyles('th', 'Table Header Cell');
    logElementStyles('td', 'Table Data Cell');
    logElementStyles('input[type="text"]', 'Text Input');
    logElementStyles('input[type="number"]', 'Number Input');
    logElementStyles('select', 'Select');
    logElementStyles('textarea', 'Textarea');
    logElementStyles('button', 'Button');
    logElementStyles('.sidebar', 'Sidebar');
    logElementStyles('.top-header', 'Top Header');
    logElementStyles('.modal-content', 'Modal Content');
    logElementStyles('.dropdown-menu', 'Dropdown Menu');
    
    console.groupEnd();
  }

  function logCSSVariables() {
    const root = document.documentElement;
    const computedStyle = window.getComputedStyle(root);
    
    const keyVars = [
      '--ds-bg',
      '--ds-bg-secondary',
      '--ds-bg-card',
      '--ds-text',
      '--ds-text-muted',
      '--ds-border',
      '--sidebar-bg',
      '--sidebar-text',
      '--topbar-bg',
      '--topbar-text'
    ];

    console.group('🎨 CSS Variables (Design Tokens)');
    keyVars.forEach(varName => {
      const value = computedStyle.getPropertyValue(varName).trim();
      console.log(`${varName}: ${value || 'not-set'}`);
    });
    console.groupEnd();

    // Telemetry removed for production
  }

  // Run audit when DOM is ready
  function runAudit() {
    console.log('%c🎨 ELOS Theme Debug Harness', 'font-size: 16px; font-weight: bold; color: #3b82f6;');
    console.log('URL:', window.location.href);
    console.log('Timestamp:', new Date().toISOString());
    console.log('');

    logThemeState();
    logCSSFiles();
    logCSSVariables();
    auditKeyElements();

    console.log('%c✅ Audit Complete', 'color: #10b981; font-weight: bold;');
    console.log('Toggle theme and check console for changes');
  }

  // Wait for DOM
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', runAudit);
  } else {
    runAudit();
  }

  // Re-run audit on theme change
  window.addEventListener('themechange', () => {
    console.log('%c🔄 Theme Changed - Re-running Audit', 'color: #f59e0b; font-weight: bold;');
    setTimeout(runAudit, 100);
  });

  // Monitor theme attribute changes
  const observer = new MutationObserver((mutations) => {
    mutations.forEach((mutation) => {
      if (mutation.type === 'attributes' && mutation.attributeName === 'data-theme') {
        console.log('%c🔄 data-theme Changed - Re-running Audit', 'color: #f59e0b; font-weight: bold;');
        setTimeout(runAudit, 100);
      }
    });
  });

  observer.observe(document.documentElement, {
    attributes: true,
    attributeFilter: ['data-theme']
  });

})();

