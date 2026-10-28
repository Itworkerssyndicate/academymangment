/* ============================================================
   ITWS Platform — Modal System V2
   File: assets/js/ui/modal.js
   Description: Confirm/Alert/Prompt + custom modals + focus trap

   Load order: AFTER utils.js + icons.js

   Features:
   - Modal.confirm({ title, message }) → Promise<boolean>
   - Modal.alert({ title, message }) → Promise<void>
   - Modal.prompt({ title, message, defaultValue }) → Promise<string|null>
   - Modal.create({ ... }) → custom modal with DOM
   - Modal.loading({ message }) → loading modal
   - Modal.close(id) → close specific modal
   - Modal.closeAll() → close all
   - Focus trap + restore focus
   - Esc closes (optional)
   - Backdrop click closes (optional)
   - Multiple modals stack support
   - RTL support (Arabic by default)
   - R13 responsive (max-width, safe-area, mobile-first)
   - Accessibility (role=dialog, aria-modal, labelledby)
   - Animations (respects prefers-reduced-motion)

   Rules:
   - No emoji
   - ES5-style IIFE
   - All strings from Labels.t() with fallbacks
   - Self-contained CSS
   - No external dependencies
   ============================================================ */

(function () {
  'use strict';

  if (window.Modal && window.Modal._initialized) {
    return;
  }

  /* ============================================================
     1. HELPERS
     ============================================================ */

  function log(level, msg, data) {
    var cfg = window.ITWS_CONFIG || {};
    if (level === 'error' || (cfg.DEBUG && level === 'debug')) {
      try {
        var args = ['[Modal]', msg];
        if (data !== undefined) args.push(data);
        if (level === 'error') console.error.apply(console, args);
        else console.log.apply(console, args);
      } catch (e) {}
    }
  }

  function getLabel(key, fallback) {
    try {
      if (window.Labels && typeof window.Labels.t === 'function') {
        return window.Labels.t(key, fallback);
      }
    } catch (e) {}
    return fallback;
  }

  function escapeHtml(s) {
    if (s == null) return '';
    return String(s)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  function icon(name, size) {
    try {
      if (window.Icons && typeof window.Icons.get === 'function') {
        return window.Icons.get(name, { size: size || 24 });
      }
    } catch (e) {}
    return '';
  }

  function uuid() {
    if (window.crypto && window.crypto.randomUUID) return 'mdl_' + window.crypto.randomUUID();
    return 'mdl_' + Date.now() + '_' + Math.random().toString(36).substring(2, 9);
  }

  function dispatchEvent(name, detail) {
    try {
      window.dispatchEvent(new CustomEvent(name, { detail: detail || {} }));
    } catch (e) {}
  }

  /* ============================================================
     2. STATE
     ============================================================ */

  var state = {
    stack: [],           // array of { id, el, resolve, reject, ... }
    escapeHandler: null,
    focusTraps: []
  };

  var STYLE_ID = 'itws-modal-styles';
  var KEYFRAMES_ID = 'itws-modal-keyframes';

  /* ============================================================
     3. CSS INJECTION
     ============================================================ */

  function injectStyles() {
    if (document.getElementById(STYLE_ID)) return;

    var css = ''
      // ===== BACKDROP =====
      + '.itws-modal-backdrop{position:fixed;inset:0;z-index:9999;'
      + 'background:rgba(0,0,0,0.6);'
      + 'backdrop-filter:blur(4px);-webkit-backdrop-filter:blur(4px);'
      + 'display:flex;align-items:center;justify-content:center;'
      + 'padding:max(16px,env(safe-area-inset-top)) max(16px,env(safe-area-inset-right)) '
      + 'max(16px,env(safe-area-inset-bottom)) max(16px,env(safe-area-inset-left));'
      + 'opacity:0;transition:opacity 0.2s ease;'
      + 'overflow-y:auto;overscroll-behavior:contain;}'
      + '.itws-modal-backdrop.is-open{opacity:1;}'

      // ===== MODAL BOX =====
      + '.itws-modal{width:100%;max-width:min(520px,100%);'
      + 'background:var(--surface-elevated,#1C2430);'
      + 'color:var(--text,#F8FAFC);'
      + 'border:1px solid var(--border,rgba(255,255,255,0.1));'
      + 'border-radius:16px;'
      + 'box-shadow:0 25px 60px rgba(0,0,0,0.45);'
      + 'font-family:Cairo,sans-serif;'
      + 'transform:translateY(12px) scale(0.98);'
      + 'opacity:0;'
      + 'transition:transform 0.25s cubic-bezier(0.34,1.56,0.64,1), opacity 0.2s;'
      + 'max-height:calc(100vh - 32px);'
      + 'display:flex;flex-direction:column;'
      + 'overflow:hidden;'
      + 'margin:auto;}'
      + '.itws-modal.is-open{transform:translateY(0) scale(1);opacity:1;}'
      + '.itws-modal.itws-modal-sm{max-width:min(400px,100%);}'
      + '.itws-modal.itws-modal-lg{max-width:min(720px,100%);}'
      + '.itws-modal.itws-modal-xl{max-width:min(960px,100%);}'

      // ===== HEADER =====
      + '.itws-modal-head{padding:20px 24px 16px;'
      + 'display:flex;align-items:flex-start;gap:14px;'
      + 'border-bottom:1px solid var(--border,rgba(255,255,255,0.08));'
      + 'flex-shrink:0;}'
      + '.itws-modal-head-icon{width:44px;height:44px;border-radius:12px;'
      + 'background:var(--primary-soft,rgba(206,17,38,0.14));'
      + 'color:var(--primary,#CE1126);'
      + 'display:flex;align-items:center;justify-content:center;'
      + 'flex-shrink:0;}'
      + '.itws-modal-head-icon svg{width:22px;height:22px;}'
      + '.itws-modal-head-icon.danger{background:var(--error-soft,rgba(239,68,68,0.14));'
      + 'color:var(--error,#EF4444);}'
      + '.itws-modal-head-icon.warning{background:var(--warning-soft,rgba(245,158,11,0.14));'
      + 'color:var(--warning,#F59E0B);}'
      + '.itws-modal-head-icon.success{background:var(--success-soft,rgba(16,185,129,0.14));'
      + 'color:var(--success,#10B981);}'
      + '.itws-modal-head-icon.info{background:var(--info-soft,rgba(59,130,246,0.14));'
      + 'color:var(--info,#3B82F6);}'
      + '.itws-modal-head-content{flex:1;min-width:0;}'
      + '.itws-modal-title{margin:0 0 4px;'
      + 'font-size:clamp(16px,2vw,18px);'
      + 'font-weight:800;line-height:1.3;'
      + 'color:var(--text,#F8FAFC);}'
      + '.itws-modal-subtitle{margin:0;'
      + 'font-size:12px;color:var(--text-muted,#64748B);'
      + 'line-height:1.5;}'
      + '.itws-modal-close{width:36px;height:36px;border-radius:8px;'
      + 'background:transparent;border:1px solid transparent;'
      + 'color:var(--text-muted,#64748B);cursor:pointer;'
      + 'display:flex;align-items:center;justify-content:center;'
      + 'flex-shrink:0;transition:all 0.15s;padding:0;}'
      + '.itws-modal-close:hover{background:var(--surface-hover,#252F3D);'
      + 'color:var(--text,#F8FAFC);border-color:var(--border,rgba(255,255,255,0.08));}'
      + '.itws-modal-close svg{width:18px;height:18px;}'

      // ===== BODY =====
      + '.itws-modal-body{padding:20px 24px;'
      + 'font-size:14px;line-height:1.7;'
      + 'color:var(--text-secondary,#94A3B8);'
      + 'overflow-y:auto;flex:1;min-height:0;}'
      + '.itws-modal-body p{margin:0 0 12px;}'
      + '.itws-modal-body p:last-child{margin:0;}'
      + '.itws-modal-body input,.itws-modal-body textarea,.itws-modal-body select{'
      + 'width:100%;padding:12px 14px;'
      + 'background:var(--bg,#0A0E14);'
      + 'border:2px solid var(--border,rgba(255,255,255,0.08));'
      + 'border-radius:10px;'
      + 'color:var(--text,#F8FAFC);'
      + 'font-family:inherit;font-size:14px;'
      + 'transition:all 0.2s;outline:none;'
      + 'margin-top:8px;}'
      + '.itws-modal-body input:focus,.itws-modal-body textarea:focus,.itws-modal-body select:focus{'
      + 'border-color:var(--primary,#CE1126);'
      + 'box-shadow:0 0 0 4px var(--primary-soft,rgba(206,17,38,0.14));}'

      // ===== FOOTER =====
      + '.itws-modal-foot{padding:16px 24px 20px;'
      + 'display:flex;gap:10px;'
      + 'border-top:1px solid var(--border,rgba(255,255,255,0.08));'
      + 'flex-shrink:0;flex-wrap:wrap;justify-content:flex-end;}'
      + '@media (max-width:480px){'
      + '.itws-modal-foot{flex-direction:column-reverse;}'
      + '.itws-modal-foot .itws-modal-btn{width:100%;}}'

      // ===== BUTTONS =====
      + '.itws-modal-btn{padding:11px 22px;border-radius:10px;'
      + 'font-family:inherit;font-size:14px;font-weight:700;'
      + 'cursor:pointer;transition:all 0.15s;'
      + 'border:1px solid transparent;'
      + 'min-height:44px;'
      + 'display:inline-flex;align-items:center;justify-content:center;gap:8px;'
      + 'white-space:nowrap;}'
      + '.itws-modal-btn svg{width:16px;height:16px;}'
      + '.itws-modal-btn:focus-visible{outline:2px solid var(--primary,#CE1126);'
      + 'outline-offset:2px;}'
      + '.itws-modal-btn.primary{background:var(--primary,#CE1126);'
      + 'color:var(--primary-text,#fff);}'
      + '.itws-modal-btn.primary:hover{background:var(--primary-hover,#E63946);}'
      + '.itws-modal-btn.danger{background:var(--error,#EF4444);color:#fff;}'
      + '.itws-modal-btn.danger:hover{background:#dc2626;}'
      + '.itws-modal-btn.success{background:var(--success,#10B981);color:#fff;}'
      + '.itws-modal-btn.success:hover{background:#059669;}'
      + '.itws-modal-btn.secondary{background:var(--surface,#131820);'
      + 'color:var(--text,#F8FAFC);'
      + 'border-color:var(--border,rgba(255,255,255,0.1));}'
      + '.itws-modal-btn.secondary:hover{background:var(--surface-hover,#252F3D);}'
      + '.itws-modal-btn.ghost{background:transparent;'
      + 'color:var(--text-secondary,#94A3B8);}'
      + '.itws-modal-btn.ghost:hover{color:var(--text,#F8FAFC);'
      + 'background:var(--surface-hover,#252F3D);}'
      + '.itws-modal-btn:disabled{opacity:0.5;cursor:not-allowed;}'

      // ===== LOADING SPINNER =====
      + '.itws-modal-spinner{width:36px;height:36px;'
      + 'border:3px solid var(--border,rgba(255,255,255,0.1));'
      + 'border-top-color:var(--primary,#CE1126);'
      + 'border-radius:50%;'
      + 'animation:itwsModalSpin 0.8s linear infinite;'
      + 'margin:0 auto 16px;}'

      // ===== BODY SCROLL LOCK =====
      + 'body.itws-modal-open{overflow:hidden !important;}'

      // ===== REDUCED MOTION =====
      + '@media (prefers-reduced-motion:reduce){'
      + '.itws-modal,.itws-modal-backdrop,.itws-modal *{'
      + 'animation-duration:0.01ms !important;'
      + 'transition-duration:0.01ms !important;}}';

    var style = document.createElement('style');
    style.id = STYLE_ID;
    style.textContent = css;
    document.head.appendChild(style);
  }

  function injectKeyframes() {
    if (document.getElementById(KEYFRAMES_ID)) return;
    var style = document.createElement('style');
    style.id = KEYFRAMES_ID;
    style.textContent = '@keyframes itwsModalSpin{to{transform:rotate(360deg);}}';
    document.head.appendChild(style);
  }

  /* ============================================================
     4. FOCUS TRAP
     ============================================================ */

  function getFocusable(container) {
    var selectors = [
      'button:not([disabled])',
      'a[href]',
      'input:not([disabled])',
      'select:not([disabled])',
      'textarea:not([disabled])',
      '[tabindex]:not([tabindex="-1"])'
    ].join(',');
    return Array.prototype.slice.call(container.querySelectorAll(selectors)).filter(function (el) {
      return el.offsetParent !== null && el.offsetWidth > 0 && el.offsetHeight > 0;
    });
  }

  function trapFocus(container) {
    var handler = function (e) {
      if (e.key !== 'Tab') return;
      var focusable = getFocusable(container);
      if (focusable.length === 0) { e.preventDefault(); return; }
      var first = focusable[0];
      var last = focusable[focusable.length - 1];
      if (e.shiftKey) {
        if (document.activeElement === first) {
          e.preventDefault();
          last.focus();
        }
      } else {
        if (document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };
    container.addEventListener('keydown', handler);
    return function () { container.removeEventListener('keydown', handler); };
  }

  /* ============================================================
     5. CORE — CREATE MODAL
     ============================================================ */

  /**
   * Create and open a modal
   * @param {object} options
   *   - title: string
   *   - subtitle: string
   *   - body: string | HTMLElement | function(container)
   *   - icon: string (Icons name)
   *   - iconVariant: 'primary'|'danger'|'warning'|'success'|'info'
   *   - size: 'sm'|'md'|'lg'|'xl'
   *   - buttons: [{ label, variant, action, closeOnClick }]
   *   - closable: boolean (default true)
   *   - closeOnBackdrop: boolean (default true)
   *   - closeOnEsc: boolean (default true)
   *   - onOpen: function(modalEl)
   *   - onClose: function(reason)
   * @returns {object} { id, el, close, resolve(result) }
   */
  function create(options) {
    options = options || {};

    injectStyles();
    injectKeyframes();

    var id = uuid();
    var resolveFn = null;
    var promise = new Promise(function (res) { resolveFn = res; });

    // Backdrop
    var backdrop = document.createElement('div');
    backdrop.className = 'itws-modal-backdrop';
    backdrop.setAttribute('data-modal-id', id);
    backdrop.setAttribute('aria-hidden', 'true');

    // Modal box
    var modal = document.createElement('div');
    modal.className = 'itws-modal';
    if (options.size && ['sm', 'lg', 'xl'].indexOf(options.size) !== -1) {
      modal.classList.add('itws-modal-' + options.size);
    }
    modal.setAttribute('role', 'dialog');
    modal.setAttribute('aria-modal', 'true');
    modal.setAttribute('data-modal-id', id);

    var titleId = 'modal-title-' + id;
    if (options.title) modal.setAttribute('aria-labelledby', titleId);

    // --- Header ---
    var headerHtml = '';
    var hasHeader = options.title || options.icon || options.closable !== false;
    if (hasHeader) {
      var iconVariant = options.iconVariant || 'primary';
      var iconHtml = options.icon
        ? '<div class="itws-modal-head-icon ' + iconVariant + '">' + icon(options.icon, 22) + '</div>'
        : '';

      var headerContentHtml = '<div class="itws-modal-head-content">';
      if (options.title) {
        headerContentHtml += '<h2 class="itws-modal-title" id="' + titleId + '">' + escapeHtml(options.title) + '</h2>';
      }
      if (options.subtitle) {
        headerContentHtml += '<p class="itws-modal-subtitle">' + escapeHtml(options.subtitle) + '</p>';
      }
      headerContentHtml += '</div>';

      var closeBtnHtml = options.closable !== false
        ? '<button type="button" class="itws-modal-close" data-modal-close aria-label="' + escapeHtml(getLabel('common.close', 'إغلاق')) + '">'
            + icon('x', 18)
          + '</button>'
        : '';

      headerHtml = '<div class="itws-modal-head">' + iconHtml + headerContentHtml + closeBtnHtml + '</div>';
    }

    // --- Body ---
    var bodyContent = '';
    var bodyIsElement = false;
    if (options.body) {
      if (typeof options.body === 'string') {
        bodyContent = options.body;
      } else if (typeof options.body === 'function') {
        bodyContent = '';
      } else if (options.body.nodeType) {
        bodyIsElement = true;
      }
    }

    var bodyHtml = '<div class="itws-modal-body" data-modal-body>' + (bodyIsElement ? '' : bodyContent) + '</div>';

    // --- Footer ---
    var footerHtml = '';
    var buttons = options.buttons || [];
    if (buttons.length > 0) {
      var buttonsHtml = buttons.map(function (btn, idx) {
        var variant = btn.variant || (idx === buttons.length - 1 ? 'primary' : 'secondary');
        var btnAttrs = 'data-modal-btn="' + idx + '"';
        var disabled = btn.disabled ? ' disabled' : '';
        return '<button type="button" class="itws-modal-btn ' + variant + '" ' + btnAttrs + disabled + '>'
          + (btn.icon ? icon(btn.icon, 16) : '')
          + '<span>' + escapeHtml(btn.label || '') + '</span>'
          + '</button>';
      }).join('');
      footerHtml = '<div class="itws-modal-foot">' + buttonsHtml + '</div>';
    }

    modal.innerHTML = headerHtml + bodyHtml + footerHtml;

    // Inject body element if provided
    if (bodyIsElement) {
      var bodyEl = modal.querySelector('[data-modal-body]');
      if (bodyEl) bodyEl.appendChild(options.body);
    }

    // If body is function — call it with body element
    if (typeof options.body === 'function') {
      var bodyEl2 = modal.querySelector('[data-modal-body]');
      if (bodyEl2) {
        try { options.body(bodyEl2, modal); } catch (e) { log('error', 'body function failed', e); }
      }
    }

    backdrop.appendChild(modal);
    document.body.appendChild(backdrop);
    document.body.classList.add('itws-modal-open');

    // Store modal data
    var modalEntry = {
      id: id,
      el: modal,
      backdrop: backdrop,
      resolve: resolveFn,
      promise: promise,
      options: options,
      cleanup: null,
      previousFocus: document.activeElement
    };
    state.stack.push(modalEntry);

    // --- Button handlers ---
    buttons.forEach(function (btn, idx) {
      var btnEl = modal.querySelector('[data-modal-btn="' + idx + '"]');
      if (!btnEl) return;
      btnEl.addEventListener('click', function () {
        // Prevent double click
        if (btnEl.disabled) return;

        var shouldClose = btn.closeOnClick !== false;

        if (typeof btn.action === 'function') {
          try {
            var result = btn.action(modal, modalEntry);
            if (result instanceof Promise) {
              btnEl.disabled = true;
              result.then(function (resolved) {
                btnEl.disabled = false;
                if (shouldClose && resolved !== false) {
                  closeModal(modalEntry, { value: resolved || btn.value || btn.label });
                }
              }).catch(function () {
                btnEl.disabled = false;
              });
              return;
            } else if (result === false) {
              // Explicit false — don't close
              return;
            }
          } catch (e) {
            log('error', 'Button action failed', e);
          }
        }

        if (shouldClose) {
          closeModal(modalEntry, { value: btn.value !== undefined ? btn.value : btn.label });
        }
      });
    });

    // --- Close button ---
    var closeBtn = modal.querySelector('[data-modal-close]');
    if (closeBtn) {
      closeBtn.addEventListener('click', function () {
        closeModal(modalEntry, { value: null, reason: 'close-button' });
      });
    }

    // --- Backdrop click ---
    if (options.closeOnBackdrop !== false) {
      backdrop.addEventListener('click', function (e) {
        if (e.target === backdrop) {
          closeModal(modalEntry, { value: null, reason: 'backdrop' });
        }
      });
    }

    // --- Esc handler ---
    if (options.closeOnEsc !== false) {
      var escHandler = function (e) {
        if (e.key === 'Escape') {
          // Only close topmost
          if (state.stack.length > 0 && state.stack[state.stack.length - 1].id === id) {
            e.preventDefault();
            closeModal(modalEntry, { value: null, reason: 'esc' });
          }
        }
      };
      document.addEventListener('keydown', escHandler);
      modalEntry.cleanup = escHandler;
    }

    // --- Focus trap ---
    var releaseFocus = trapFocus(modal);
    var originalCleanup = modalEntry.cleanup;
    modalEntry.cleanup = function () {
      releaseFocus();
      if (originalCleanup) {
        if (typeof originalCleanup === 'function') originalCleanup();
        else document.removeEventListener('keydown', originalCleanup);
      }
    };

    // --- Animation in ---
    requestAnimationFrame(function () {
      requestAnimationFrame(function () {
        backdrop.classList.add('is-open');
        modal.classList.add('is-open');

        // Auto focus first focusable
        setTimeout(function () {
          var focusable = getFocusable(modal);
          if (focusable.length > 0) {
            focusable[0].focus();
          } else {
            modal.setAttribute('tabindex', '-1');
            modal.focus();
          }
        }, 60);
      });
    });

    // --- onOpen callback ---
    if (typeof options.onOpen === 'function') {
      setTimeout(function () {
        try { options.onOpen(modal, modalEntry); } catch (e) { log('error', 'onOpen failed', e); }
      }, 80);
    }

    dispatchEvent('itws:modal-opened', { id: id, options: options });

    return {
      id: id,
      el: modal,
      promise: promise,
      close: function (value) { closeModal(modalEntry, { value: value }); },
      resolve: function (value) { closeModal(modalEntry, { value: value }); }
    };
  }

  /* ============================================================
     6. CORE — CLOSE MODAL
     ============================================================ */

  function closeModal(entry, options) {
    if (!entry || !entry.backdrop) return;
    options = options || {};

    var backdrop = entry.backdrop;
    var modal = entry.el;

    backdrop.classList.remove('is-open');
    if (modal) modal.classList.remove('is-open');

    // Remove from stack immediately
    var idx = state.stack.indexOf(entry);
    if (idx !== -1) state.stack.splice(idx, 1);

    // Restore body scroll only if no more modals
    if (state.stack.length === 0) {
      document.body.classList.remove('itws-modal-open');
    }

    // Cleanup
    if (entry.cleanup) {
      try { entry.cleanup(); } catch (e) {}
    }

    // onClose callback
    if (typeof entry.options.onClose === 'function') {
      try {
        entry.options.onClose(options.reason || 'unknown', options.value);
      } catch (e) { log('error', 'onClose failed', e); }
    }

    // Resolve promise
    if (entry.resolve) {
      entry.resolve(options.value);
    }

    // Remove from DOM after animation
    setTimeout(function () {
      if (backdrop.parentNode) backdrop.parentNode.removeChild(backdrop);
    }, 250);

    // Restore focus
    if (entry.previousFocus && entry.previousFocus.focus) {
      try { entry.previousFocus.focus(); } catch (e) {}
    }

    dispatchEvent('itws:modal-closed', {
      id: entry.id,
      reason: options.reason,
      value: options.value
    });
  }

  /* ============================================================
     7. CONFIRM
     ============================================================ */

  function confirm_(options) {
    if (typeof options === 'string') {
      options = { message: options };
    }
    options = options || {};

    return create({
      title: options.title || getLabel('common.confirm', 'تأكيد'),
      subtitle: options.subtitle || '',
      body: options.message || '',
      icon: options.icon || 'help-circle',
      iconVariant: options.variant || 'primary',
      size: options.size || 'sm',
      closable: options.closable !== false,
      closeOnBackdrop: options.closeOnBackdrop !== false,
      closeOnEsc: options.closeOnEsc !== false,
      buttons: [
        {
          label: options.cancelText || getLabel('common.cancel', 'إلغاء'),
          variant: 'secondary',
          value: false
        },
        {
          label: options.confirmText || getLabel('common.confirm', 'تأكيد'),
          variant: options.confirmVariant || 'primary',
          value: true
        }
      ]
    }).promise.then(function (result) {
      return result === true;
    });
  }

  /* ============================================================
     8. ALERT
     ============================================================ */

  function alert_(options) {
    if (typeof options === 'string') {
      options = { message: options };
    }
    options = options || {};

    return create({
      title: options.title || getLabel('common.notice', 'تنبيه'),
      subtitle: options.subtitle || '',
      body: options.message || '',
      icon: options.icon || 'info',
      iconVariant: options.variant || 'info',
      size: options.size || 'sm',
      closable: true,
      closeOnBackdrop: options.closeOnBackdrop !== false,
      closeOnEsc: options.closeOnEsc !== false,
      buttons: [
        {
          label: options.okText || getLabel('common.ok', 'حسناً'),
          variant: 'primary'
        }
      ]
    }).promise;
  }

  /* ============================================================
     9. PROMPT
     ============================================================ */

  function prompt_(options) {
    if (typeof options === 'string') {
      options = { message: options };
    }
    options = options || {};

    var inputValue = options.defaultValue || '';
    var inputType = options.type || 'text';
    var inputPlaceholder = options.placeholder || '';

    var bodyEl = document.createElement('div');
    var labelEl = document.createElement('div');
    labelEl.textContent = options.message || '';
    labelEl.style.cssText = 'margin-bottom:8px;color:var(--text,#F8FAFC);font-weight:600;font-size:13px;';
    bodyEl.appendChild(labelEl);

    var input = document.createElement('input');
    input.type = inputType;
    input.value = inputValue;
    input.placeholder = inputPlaceholder;
    input.setAttribute('data-modal-prompt-input', 'true');
    if (options.maxlength) input.setAttribute('maxlength', options.maxlength);
    bodyEl.appendChild(input);

    var validationMsg = document.createElement('div');
    validationMsg.style.cssText = 'margin-top:6px;font-size:11px;color:var(--error,#EF4444);display:none;';
    bodyEl.appendChild(validationMsg);

    return create({
      title: options.title || getLabel('common.input', 'إدخال'),
      subtitle: options.subtitle || '',
      body: bodyEl,
      icon: options.icon || 'edit',
      iconVariant: options.variant || 'primary',
      size: options.size || 'sm',
      closable: true,
      closeOnBackdrop: options.closeOnBackdrop !== false,
      closeOnEsc: true,
      buttons: [
        {
          label: options.cancelText || getLabel('common.cancel', 'إلغاء'),
          variant: 'secondary',
          value: null
        },
        {
          label: options.okText || getLabel('common.confirm', 'تأكيد'),
          variant: 'primary',
          action: function () {
            var val = input.value;
            if (typeof options.validate === 'function') {
              var err = options.validate(val);
              if (err && typeof err === 'string') {
                validationMsg.textContent = err;
                validationMsg.style.display = 'block';
                input.focus();
                return false;
              }
            }
            return { value: val };
          }
        }
      ],
      onOpen: function (modalEl) {
        // Focus input + Enter submits
        setTimeout(function () {
          input.focus();
          input.select();
        }, 100);
        input.addEventListener('keydown', function (e) {
          if (e.key === 'Enter') {
            e.preventDefault();
            var okBtn = modalEl.querySelector('.itws-modal-foot .primary');
            if (okBtn) okBtn.click();
          }
        });
      }
    }).promise.then(function (result) {
      if (result && result.value !== undefined) return result.value;
      return result;
    });
  }

  /* ============================================================
     10. LOADING
     ============================================================ */

  function loading_(options) {
    if (typeof options === 'string') {
      options = { message: options };
    }
    options = options || {};

    var bodyEl = document.createElement('div');
    bodyEl.innerHTML = '<div class="itws-modal-spinner"></div>'
      + '<div style="text-align:center;font-size:13px;color:var(--text-muted,#64748B);">'
      + escapeHtml(options.message || getLabel('common.loading', 'جاري التحميل...'))
      + '</div>';

    return create({
      title: options.title || '',
      subtitle: '',
      body: bodyEl,
      icon: null,
      size: 'sm',
      closable: false,
      closeOnBackdrop: false,
      closeOnEsc: false,
      buttons: []
    });
  }

  /* ============================================================
     11. CLOSE HELPERS
     ============================================================ */

  function closeById(id) {
    if (!id) return;
    var entry = null;
    for (var i = 0; i < state.stack.length; i++) {
      if (state.stack[i].id === id) { entry = state.stack[i]; break; }
    }
    if (entry) closeModal(entry, { reason: 'manual' });
  }

  function closeAll(reason) {
    var toClose = state.stack.slice();
    toClose.forEach(function (entry) {
      closeModal(entry, { reason: reason || 'manual' });
    });
  }

  function closeTop(reason) {
    if (state.stack.length === 0) return;
    var top = state.stack[state.stack.length - 1];
    closeModal(top, { reason: reason || 'manual' });
  }

  /* ============================================================
     12. EXPORT
     ============================================================ */

  window.Modal = {
    _initialized: true,

    // Core
    create: create,
    close: closeById,
    closeTop: closeTop,
    closeAll: closeAll,

    // Presets
    confirm: confirm_,
    alert: alert_,
    prompt: prompt_,
    loading: loading_,

    // State
    isAnyOpen: function () { return state.stack.length > 0; },
    count: function () { return state.stack.length; },
    getTop: function () {
      return state.stack.length > 0 ? state.stack[state.stack.length - 1] : null;
    }
  };

  // Shorthand globals (legacy compatibility)
  window.modalConfirm = confirm_;
  window.modalAlert = alert_;
  window.modalPrompt = prompt_;
  window.modalLoading = loading_;

  /* ============================================================
     13. DEBUG LOG
     ============================================================ */

  var cfg = window.ITWS_CONFIG || {};
  if (cfg.DEBUG) {
    try {
      console.log('%c[Modal]', 'color: #F97316; font-weight: bold;', 'System ready');
    } catch (e) {}
  }

})();
