// ═══════════════════════════════════════════════════════════════════════════
// modal-dialogs.js - نوافذ تأكيد وتحذير بتصميم وألوان البرنامج
// بديل لـ confirm() و alert() الأصليتين
// ═══════════════════════════════════════════════════════════════════════════
(function () {
  'use strict';

  var id = 'elos-modal-dialogs-styles';
  if (!document.getElementById(id)) {
    var style = document.createElement('style');
    style.id = id;
    style.textContent = [
      '.elos-modal-overlay {',
      '  position: fixed; inset: 0;',
      '  background: rgba(0,0,0,0.6);',
      '  backdrop-filter: blur(4px);',
      '  z-index: 999999;',
      '  display: flex; align-items: center; justify-content: center;',
      '  padding: 20px;',
      '  animation: elos-modal-fadeIn 0.2s ease;',
      '}',
      '@keyframes elos-modal-fadeIn { from { opacity: 0; } to { opacity: 1; } }',
      '.elos-modal-box {',
      '  min-width: 320px; max-width: 440px; width: 100%;',
      '  background: var(--ds-bg-secondary, var(--bg-secondary, #151921));',
      '  border: 1px solid var(--ds-border, var(--border, #1e2530));',
      '  border-radius: var(--ds-radius-lg, 16px);',
      '  box-shadow: 0 24px 48px rgba(0,0,0,0.4);',
      '  overflow: hidden;',
      '  animation: elos-modal-scaleIn 0.25s ease;',
      '  direction: rtl; text-align: right;',
      '}',
      '@keyframes elos-modal-scaleIn { from { opacity: 0; transform: scale(0.95); } to { opacity: 1; transform: scale(1); } }',
      '.elos-modal-header {',
      '  padding: 16px 20px;',
      '  border-bottom: 1px solid var(--ds-border, var(--border));',
      '  font-weight: 700; font-size: 18px;',
      '  color: var(--ds-text, var(--text-primary, #f1f5f9));',
      '}',
      '.elos-modal-body {',
      '  padding: 20px;',
      '  color: var(--ds-text-secondary, var(--text-secondary, #94a3b8));',
      '  font-size: 15px; line-height: 1.6;',
      '  white-space: pre-wrap; word-break: break-word;',
      '}',
      '.elos-modal-footer {',
      '  padding: 16px 20px;',
      '  border-top: 1px solid var(--ds-border, var(--border));',
      '  display: flex; gap: 12px; justify-content: flex-start; flex-wrap: wrap;',
      '}',
      '.elos-modal-btn {',
      '  padding: 10px 20px;',
      '  border: none; border-radius: var(--ds-radius-sm, 8px);',
      '  font-weight: 600; font-size: 14px; cursor: pointer;',
      '  transition: transform 0.15s, box-shadow 0.15s;',
      '}',
      '.elos-modal-btn:hover { transform: translateY(-1px); }',
      '.elos-modal-btn:active { transform: translateY(0); }',
      '.elos-modal-btn-primary {',
      '  background: linear-gradient(135deg, var(--ds-brand, var(--accent, #3b82f6)) 0%, var(--ds-brand-active, #1d4ed8) 100%);',
      '  color: var(--ds-brand-contrast, #fff);',
      '  box-shadow: 0 2px 8px rgba(59,130,246,0.35);',
      '}',
      '.elos-modal-btn-primary:hover { box-shadow: 0 4px 12px rgba(59,130,246,0.45); }',
      '.elos-modal-btn-danger {',
      '  background: linear-gradient(135deg, var(--ds-danger, #ef4444)) 0%, var(--ds-danger-hover, #dc2626) 100%);',
      '  color: #fff;',
      '  box-shadow: 0 2px 8px rgba(239,68,68,0.35);',
      '}',
      '.elos-modal-btn-danger:hover { box-shadow: 0 4px 12px rgba(239,68,68,0.45); }',
      '.elos-modal-btn-secondary {',
      '  background: var(--ds-bg-tertiary, var(--bg-tertiary));',
      '  color: var(--ds-text-secondary, var(--text-secondary));',
      '  border: 1px solid var(--ds-border, var(--border));',
      '}',
      '.elos-modal-btn-secondary:hover {',
      '  background: var(--ds-bg-hover, var(--bg-hover));',
      '  border-color: var(--ds-border-hover, var(--border-hover));',
      '}'
    ].join('\n');
    (document.head || document.documentElement).appendChild(style);
  }

  function getContainer() {
    var c = document.getElementById('elos-modal-container');
    if (!c) {
      c = document.createElement('div');
      c.id = 'elos-modal-container';
      document.body.appendChild(c);
    }
    return c;
  }

  function closeModal(overlay, resolve, value) {
    if (overlay && overlay.parentNode) {
      overlay.style.animation = 'elos-modal-fadeIn 0.15s ease reverse';
      setTimeout(function () {
        if (overlay.parentNode) overlay.parentNode.removeChild(overlay);
        if (resolve) resolve(value);
      }, 120);
    } else if (resolve) resolve(value);
  }

  /**
   * نافذة تأكيد (بديل confirm) - تعيد Promise<boolean>
   * توقيع 1: showConfirm(message, title, opts) - opts = { confirmText, cancelText, danger }
   * توقيع 2 (توافق مع shared.js): showConfirm(message, confirmText, cancelText, type) - type = 'warning'|'danger'|'info'
   */
  function showConfirm(message, titleOrConfirmText, optsOrCancelText, typeOrNothing) {
    var title, confirmText, cancelText, danger;
    var useOldApi = arguments.length >= 4 || (arguments.length === 3 && typeof optsOrCancelText === 'string');
    if (arguments.length === 3 && typeof optsOrCancelText === 'object' && optsOrCancelText !== null) {
      var opts = optsOrCancelText;
      title = titleOrConfirmText || 'تأكيد';
      confirmText = opts.confirmText || 'موافق';
      cancelText = opts.cancelText || 'إلغاء';
      danger = !!opts.danger;
    } else if (useOldApi) {
      confirmText = titleOrConfirmText || 'موافق';
      cancelText = optsOrCancelText || 'إلغاء';
      var t = typeOrNothing || 'warning';
      danger = t === 'danger';
      title = t === 'danger' ? 'تأكيد' : t === 'info' ? 'معلومات' : 'تأكيد';
    } else {
      title = titleOrConfirmText || 'تأكيد';
      confirmText = 'موافق';
      cancelText = 'إلغاء';
      danger = false;
    }

    return new Promise(function (resolve) {
      var overlay = document.createElement('div');
      overlay.className = 'elos-modal-overlay';
      overlay.setAttribute('role', 'dialog');
      overlay.setAttribute('aria-modal', 'true');
      overlay.setAttribute('aria-label', title);

      var box = document.createElement('div');
      box.className = 'elos-modal-box';
      box.innerHTML =
        '<div class="elos-modal-header">' + escapeHtml(title) + '</div>' +
        '<div class="elos-modal-body">' + escapeHtml(message) + '</div>' +
        '<div class="elos-modal-footer">' +
        '<button type="button" class="elos-modal-btn elos-modal-btn-secondary elos-modal-cancel">' + escapeHtml(cancelText) + '</button>' +
        '<button type="button" class="elos-modal-btn ' + (danger ? 'elos-modal-btn-danger' : 'elos-modal-btn-primary') + ' elos-modal-confirm">' + escapeHtml(confirmText) + '</button>' +
        '</div>';
      overlay.appendChild(box);

      overlay.addEventListener('click', function (e) {
        if (e.target === overlay) closeModal(overlay, resolve, false);
      });
      box.querySelector('.elos-modal-cancel').addEventListener('click', function () { closeModal(overlay, resolve, false); });
      box.querySelector('.elos-modal-confirm').addEventListener('click', function () { closeModal(overlay, resolve, true); });

      getContainer().appendChild(overlay);
      box.querySelector('.elos-modal-confirm').focus();
    });
  }

  /**
   * نافذة تنبيه (بديل alert) - تعيد Promise<void>
   * @param {string} message - النص
   * @param {string} [title='تنبيه']
   * @param {{ buttonText?: string }} [opts]
   */
  function showAlert(message, title, opts) {
    opts = opts || {};
    var buttonText = opts.buttonText || 'موافق';
    title = title || 'تنبيه';

    return new Promise(function (resolve) {
      var overlay = document.createElement('div');
      overlay.className = 'elos-modal-overlay';
      overlay.setAttribute('role', 'alertdialog');
      overlay.setAttribute('aria-modal', 'true');
      overlay.setAttribute('aria-label', title);

      var box = document.createElement('div');
      box.className = 'elos-modal-box';
      box.innerHTML =
        '<div class="elos-modal-header">' + escapeHtml(title) + '</div>' +
        '<div class="elos-modal-body">' + escapeHtml(message) + '</div>' +
        '<div class="elos-modal-footer">' +
        '<button type="button" class="elos-modal-btn elos-modal-btn-primary elos-modal-ok">' + escapeHtml(buttonText) + '</button>' +
        '</div>';
      overlay.appendChild(box);

      overlay.addEventListener('click', function (e) {
        if (e.target === overlay) closeModal(overlay, resolve, undefined);
      });
      box.querySelector('.elos-modal-ok').addEventListener('click', function () { closeModal(overlay, resolve, undefined); });

      getContainer().appendChild(overlay);
      box.querySelector('.elos-modal-ok').focus();
    });
  }

  function escapeHtml(s) {
    if (s == null) return '';
    var div = document.createElement('div');
    div.textContent = s;
    return div.innerHTML;
  }

  window.showConfirm = showConfirm;
  window.showAlert = showAlert;
})();
