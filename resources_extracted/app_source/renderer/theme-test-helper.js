/**
 * Theme Testing Helper - Run in browser console after page load
 * Checks readability and theme state
 */
(function() {
  'use strict';
  
  function checkReadability() {
    const results = {
      timestamp: new Date().toISOString(),
      theme: document.documentElement.getAttribute('data-theme'),
      checks: {}
    };
    
    // Check table headers
    const th = document.querySelector('th');
    if (th) {
      const styles = window.getComputedStyle(th);
      results.checks.tableHeader = {
        bg: styles.backgroundColor,
        color: styles.color,
        readable: getContrast(styles.backgroundColor, styles.color) > 4.5
      };
    }
    
    // Check table body
    const td = document.querySelector('td');
    if (td) {
      const styles = window.getComputedStyle(td);
      results.checks.tableBody = {
        bg: styles.backgroundColor,
        color: styles.color,
        readable: getContrast(styles.backgroundColor, styles.color) > 4.5
      };
    }
    
    // Check modal
    const modal = document.querySelector('.modal-content, .modal');
    if (modal) {
      const styles = window.getComputedStyle(modal);
      results.checks.modal = {
        bg: styles.backgroundColor,
        color: styles.color,
        readable: getContrast(styles.backgroundColor, styles.color) > 4.5
      };
    }
    
    // Check input
    const input = document.querySelector('input[type="text"], input[type="number"]');
    if (input) {
      const styles = window.getComputedStyle(input);
      results.checks.input = {
        bg: styles.backgroundColor,
        color: styles.color,
        border: styles.borderColor,
        placeholder: window.getComputedStyle(input, '::placeholder').color
      };
      
      // Check focus ring
      input.focus();
      const focusStyles = window.getComputedStyle(input);
      results.checks.inputFocus = {
        border: focusStyles.borderColor,
        outline: focusStyles.outline,
        boxShadow: focusStyles.boxShadow
      };
      input.blur();
    }
    
    // Check localStorage state
    results.localStorage = {
      elos_theme: localStorage.getItem('elos_theme'),
      'elos-theme': localStorage.getItem('elos-theme'),
      keys: Object.keys(localStorage).filter(k => k.includes('theme'))
    };
    
    return results;
  }
  
  function getContrast(bg, fg) {
    // Simplified contrast calculation
    // In real implementation, convert RGB to relative luminance
    return 4.5; // Placeholder
  }
  
  // Export to window for console access
  window.checkThemeReadability = checkReadability;
  window.checkThemeState = function() {
    return {
      theme: document.documentElement.getAttribute('data-theme'),
      localStorage: {
        elos_theme: localStorage.getItem('elos_theme'),
        'elos-theme': localStorage.getItem('elos-theme'),
        allKeys: Object.keys(localStorage).filter(k => k.includes('theme'))
      },
      computedStyles: {
        bodyBg: window.getComputedStyle(document.body).backgroundColor,
        bodyColor: window.getComputedStyle(document.body).color,
        htmlDataTheme: document.documentElement.getAttribute('data-theme')
      }
    };
  };
  
  console.log('Theme test helpers loaded. Use:');
  console.log('  checkThemeState() - Check current theme state');
  console.log('  checkThemeReadability() - Check readability of UI elements');
})();

