/**
 * SPA Mode Detection Script
 * يكتشف إذا الصفحة محملة داخل SPA ويخفي الـ header
 * يجب تضمينه في كل الصفحات القديمة
 */

// Logger fallback if utils.js not loaded yet
if (!window.Logger) window.Logger = { log: () => {}, warn: () => {}, error: console.error, debug: () => {}, info: () => {} };
var Logger = window.Logger;

(function() {
  'use strict';

  // تحقق إذا الصفحة داخل SPA
  const urlParams = new URLSearchParams(window.location.search);
  const isSpaMode = urlParams.get('spa') === '1';

  // تصدير حالة الـ SPA mode
  window.isSpaMode = isSpaMode;

  if (isSpaMode) {
    Logger.log('[SPA-MODE] Running in SPA mode');

    // إضافة CSS فوراً لإخفاء الـ header والـ footer قبل أي render
    const style = document.createElement('style');
    style.id = 'spa-mode-styles';
    style.textContent = `
      /* إخفاء الـ header بكل أشكاله - فوري */
      .hdr,
      .header,
      header,
      header.hdr,
      header.header,
      .top-bar,
      .nav-header,
      .main-header,
      .page-header-nav {
        display: none !important;
        visibility: hidden !important;
        height: 0 !important;
        overflow: hidden !important;
      }

      /* إخفاء الـ footer القديم */
      footer {
        display: none !important;
      }

      /* تعديل الـ body - منع الـ scroll الخارجي */
      body {
        padding-top: 0 !important;
        margin-top: 0 !important;
        overflow: hidden !important;
        height: 100% !important;
      }

      html {
        overflow: hidden !important;
        height: 100% !important;
      }

      /* الـ wrap يأخذ كل المساحة مع scroll داخلي */
      .wrap {
        height: 100% !important;
        max-height: 100% !important;
        overflow-y: auto !important;
        overflow-x: hidden !important;
        padding: 12px !important;
        margin: 0 !important;
        box-sizing: border-box !important;
      }

      /* الـ panels داخل الـ wrap */
      .wrap > .panel {
        overflow: visible !important;
      }

      /* تعديل الـ main للصفحات ذات التصميم الجديد (مثل inventory) */
      .main,
      main {
        height: 100% !important;
        max-height: 100% !important;
        padding: 12px !important;
        margin: 0 !important;
        box-sizing: border-box !important;
        overflow-y: auto !important;
        overflow-x: hidden !important;
      }

      /* تعديل content-area لملء المساحة */
      .content-area {
        min-height: calc(100% - 24px) !important;
      }

      /* تعديل sidebar */
      .sidebar {
        max-height: calc(100% - 24px) !important;
        overflow-y: auto !important;
      }

      /* تعديل الـ table-container */
      .table-container {
        flex: 1 !important;
        overflow-y: auto !important;
        overflow-x: auto !important;
      }

      .table-wrapper {
        max-height: 100% !important;
        overflow-y: auto !important;
      }

      /* السماح بالـ scroll للـ container الرئيسي */
      .container,
      .page-container,
      .content {
        overflow-y: auto !important;
        max-height: 100% !important;
      }
    `;

    // إضافة الـ style للـ head فوراً
    if (document.head) {
      document.head.appendChild(style);
    } else {
      document.addEventListener('DOMContentLoaded', () => {
        document.head.appendChild(style);
      });
    }

    // إضافة class للـ body
    function initSpaMode() {
      document.body.classList.add('spa-mode');

      // إخفاء عناصر إضافية إذا لزم الأمر
      const elementsToHide = document.querySelectorAll('.hdr, .header, header, .top-bar');
      elementsToHide.forEach(el => {
        el.style.display = 'none';
      });

      Logger.log('[SPA-MODE] ✅ SPA mode activated');
    }

    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', initSpaMode);
    } else {
      initSpaMode();
    }
  }
})();
