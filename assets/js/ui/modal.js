// ============================================
// [17/50] ITWS Platform - Modal Component
// Path: assets/js/ui/modal.js
// ============================================
// إصلاح: بدون إيموجي
// إصلاح: يستخدم SVG بدل الإيموجي
// إصلاح: Focus trap محسّن
// إصلاح: إدارة أفضل للـ stacking
// ============================================

(function () {
  'use strict';

  if (window.Modal && window.Modal.initialized) return;

  var cfg = window.ITWS_CONFIG;

  var state = {
    stack: [],
    counter: 0,
    escBound: false,
    previousActiveElement: null
  };

  // ============================================
  // 1. SVG Icons (بدل الإيموجي)
  // ============================================
  var ICONS = {
    warning: '<svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path><line x1="12" y1="9" x2="12" y2="13"></line><line x1="12" y1="17" x2="12.01" y2="17"></line></svg>',
    info: '<svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="16" x2="12" y2="12"></line><line x1="12" y1="8" x2="12.01" y2="8"></line></svg>',
    success: '<svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path><polyline points="22 4 12 14.01 9 11.01"></polyline></svg>',
    error: '<svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="15" y1="9" x2="9" y2="15"></line><line x1="9" y1="9" x2="15" y2="15"></line></svg>'
  };

  // ============================================
  // 2. توليد ID
  // ============================================
  function nextId() {
    state.counter++;
    return 'itws-modal-' + state.counter + '-' + Date.now();
  }

  // ============================================
  // 3. إنشاء Modal
  // ============================================
  function createModal(options) {
    var id = options.id || nextId();

    var backdrop = document.createElement('div');
    backdrop.className = 'modal-backdrop';
    backdrop.id = id;
    backdrop.setAttribute('role', 'dialog');
    backdrop.setAttribute('aria-modal', 'true');
    if (options.ariaLabel) {
      backdrop.setAttribute('aria-label', options.ariaLabel);
    }

    var sizeClass = options.size ? ' modal-' + options.size : '';
    var closeOnBackdrop = options.closeOnBackdrop !== false;
    var closeOnEsc = options.closeOnEsc !== false;

    // زر الإغلاق
    var closeBtnHtml = options.showClose !== false
      ? '<button class="modal-close" aria-label="إغلاق" type="button" data-modal-close>&times;</button>'
      : '';

    // Header
    var headerHtml = '';
    if (options.title || options.showClose !== false) {
      headerHtml = '' +
        '<div class="modal-header">' +
          '<h3>' + escapeHtml(options.title || '') + '</h3>' +
          closeBtnHtml +
        '</div>';
    }

    // Body
    var bodyContent = options.content || '';
    if (bodyContent instanceof HTMLElement) {
      bodyContent = bodyContent.outerHTML;
    }

    // Footer
    var footerHtml = '';
    if (options.footer) {
      footerHtml = '<div class="modal-footer">' + options.footer + '</div>';
    } else if (options.buttons && options.buttons.length > 0) {
      var btnsHtml = options.buttons.map(function (btn) {
        var cls = btn.className || 'btn btn-outline';
        var action = btn.action || 'data-modal-close';
        var dataAttrs = '';
        if (btn.value) dataAttrs += ' data-value="' + escapeAttr(btn.value) + '"';
        return '<button class="' + cls + '" type="button" ' + action + dataAttrs + '>' +
          escapeHtml(btn.label) +
        '</button>';
      }).join('');
      footerHtml = '<div class="modal-footer">' + btnsHtml + '</div>';
    }

    backdrop.innerHTML = '' +
      '<div class="modal' + sizeClass + '" role="document">' +
        headerHtml +
        '<div class="modal-body">' + bodyContent + '</div>' +
        footerHtml +
      '</div>';

    // Close on backdrop
    if (closeOnBackdrop) {
      backdrop.addEventListener('click', function (e) {
        if (e.target === backdrop) close(id);
      });
    }

    // Close buttons
    backdrop.querySelectorAll('[data-modal-close]').forEach(function (el) {
      el.addEventListener('click', function () {
        close(id);
      });
    });

    // Action buttons
    backdrop.querySelectorAll('[data-modal-action]').forEach(function (el) {
      el.addEventListener('click', function () {
        var action = el.getAttribute('data-modal-action');
        var value = el.getAttribute('data-value');
        if (typeof options.onAction === 'function') {
          options.onAction(action, value, id);
        }
        if (action === 'close') close(id);
      });
    });

    // Esc
    if (closeOnEsc && !state.escBound) {
      state.escBound = true;
      document.addEventListener('keydown', handleEsc);
    }

    return backdrop;
  }

  // ============================================
  // 4. Esc handler
  // ============================================
  function handleEsc(e) {
    if (e.key === 'Escape' && state.stack.length > 0) {
      var topId = state.stack[state.stack.length - 1];
      close(topId);
    }
  }

  // ============================================
  // 5. Focus trap
  // ============================================
  function trapFocus(modalEl) {
    var focusable = modalEl.querySelectorAll(
      'a[href], button:not([disabled]), textarea:not([disabled]), ' +
      'input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])'
    );
    if (focusable.length === 0) return;

    var first = focusable[0];
    var last = focusable[focusable.length - 1];

    setTimeout(function () { first.focus(); }, 50);

    modalEl.addEventListener('keydown', function (e) {
      if (e.key !== 'Tab') return;
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
    });
  }

  // ============================================
  // 6. Open
  // ============================================
  function open(options) {
    if (typeof options === 'string') {
      options = { content: options };
    }
    options = options || {};

    // نحفظ العنصر النشط حالياً
    if (state.stack.length === 0) {
      state.previousActiveElement = document.activeElement;
    }

    var modal = createModal(options);
    document.body.appendChild(modal);

    // Force reflow للأنيميشن
    void modal.offsetWidth;
    modal.classList.add('open');

    state.stack.push(modal.id);

    // Focus trap
    var modalInner = modal.querySelector('.modal');
    if (modalInner) trapFocus(modalInner);

    // Callback
    if (typeof options.onOpen === 'function') {
      options.onOpen(modal.id);
    }

    return modal.id;
  }

  // ============================================
  // 7. Close
  // ============================================
  function close(id) {
    var modal = document.getElementById(id);
    if (!modal) return;

    modal.classList.remove('open');
    state.stack = state.stack.filter(function (mid) { return mid !== id; });

    setTimeout(function () {
      if (modal && modal.parentNode) {
        modal.parentNode.removeChild(modal);
      }

      // رجّع التركيز للعنصر اللي كان نشط
      if (state.stack.length === 0 && state.previousActiveElement) {
        try {
          if (state.previousActiveElement.focus) {
            state.previousActiveElement.focus();
          }
        } catch (e) {}
        state.previousActiveElement = null;
      }
    }, 250);
  }

  function closeAll() {
    state.stack.slice().forEach(close);
  }

  // ============================================
  // 8. Confirm (بدون إيموجي)
  // ============================================
  function confirm(options) {
    if (typeof options === 'string') {
      options = { message: options };
    }
    options = options || {};

    return new Promise(function (resolve) {
      var confirmed = false;

      // نوع الأيقونة
      var iconType = options.icon || 'warning';
      var iconSvg = ICONS[iconType] || ICONS.warning;

      // لون الأيقونة
      var iconColor = options.danger ? 'var(--error)' : 'var(--warning)';
      if (iconType === 'info') iconColor = 'var(--info)';
      if (iconType === 'success') iconColor = 'var(--success)';
      if (iconType === 'error') iconColor = 'var(--error)';

      var id = open({
        title: options.title || 'تأكيد',
        size: options.size || 'sm',
        content: '' +
          '<div style="text-align:center;padding:12px 0;">' +
            '<div style="color:' + iconColor + ';margin-bottom:20px;">' + iconSvg + '</div>' +
            '<p style="font-size:15px;color:var(--text);line-height:1.7;margin:0;">' +
              escapeHtml(options.message || 'هل أنت متأكد؟') +
            '</p>' +
          '</div>',
        buttons: [
          {
            label: options.cancelText || 'إلغاء',
            className: 'btn btn-outline',
            action: 'data-modal-close'
          },
          {
            label: options.confirmText || 'تأكيد',
            className: 'btn ' + (options.danger ? 'btn-danger' : 'btn-primary'),
            action: 'data-modal-action',
            value: 'confirm'
          }
        ],
        onAction: function (action) {
          if (action === 'confirm') {
            confirmed = true;
            resolve(true);
          }
        },
        onOpen: function () {
          var modalEl = document.getElementById(id);
          if (modalEl) {
            var observer = new MutationObserver(function () {
              if (!document.body.contains(modalEl) && !confirmed) {
                observer.disconnect();
                resolve(false);
              }
            });
            observer.observe(document.body, { childList: true });
          }
        }
      });
    });
  }

  // ============================================
  // 9. Alert (بدون إيموجي)
  // ============================================
  function alert(options) {
    if (typeof options === 'string') {
      options = { message: options };
    }
    options = options || {};

    return new Promise(function (resolve) {
      var iconType = options.icon || 'info';
      var iconSvg = ICONS[iconType] || ICONS.info;

      var iconColor = 'var(--info)';
      if (iconType === 'success') iconColor = 'var(--success)';
      if (iconType === 'error') iconColor = 'var(--error)';
      if (iconType === 'warning') iconColor = 'var(--warning)';

      open({
        title: options.title || 'تنبيه',
        size: options.size || 'sm',
        content: '' +
          '<div style="text-align:center;padding:12px 0;">' +
            '<div style="color:' + iconColor + ';margin-bottom:20px;">' + iconSvg + '</div>' +
            '<p style="font-size:15px;color:var(--text);line-height:1.7;margin:0;">' +
              escapeHtml(options.message || '') +
            '</p>' +
          '</div>',
        buttons: [
          {
            label: options.buttonText || 'حسناً',
            className: 'btn btn-primary',
            action: 'data-modal-close'
          }
        ],
        onOpen: function (id) {
          var modalEl = document.getElementById(id);
          if (modalEl) {
            var observer = new MutationObserver(function () {
              if (!document.body.contains(modalEl)) {
                observer.disconnect();
                resolve();
              }
            });
            observer.observe(document.body, { childList: true });
          }
        }
      });
    });
  }

  // ============================================
  // 10. Prompt
  // ============================================
  function prompt(options) {
    if (typeof options === 'string') {
      options = { message: options };
    }
    options = options || {};

    return new Promise(function (resolve) {
      var resolved = false;

      var id = open({
        title: options.title || 'إدخال',
        size: options.size || 'sm',
        content: '' +
          '<div class="form-group">' +
            (options.message
              ? '<label>' + escapeHtml(options.message) + '</label>'
              : '') +
            '<input type="' + (options.inputType || 'text') + '" ' +
                   'id="' + id + '-input" ' +
                   'class="form-control" ' +
                   'value="' + escapeAttr(options.value || '') + '" ' +
                   'placeholder="' + escapeAttr(options.placeholder || '') + '">' +
          '</div>',
        buttons: [
          {
            label: options.cancelText || 'إلغاء',
            className: 'btn btn-outline',
            action: 'data-modal-close'
          },
          {
            label: options.confirmText || 'موافق',
            className: 'btn btn-primary',
            action: 'data-modal-action',
            value: 'ok'
          }
        ],
        onAction: function (action) {
          if (action === 'ok') {
            var input = document.getElementById(id + '-input');
            resolved = true;
            resolve(input ? input.value : null);
          }
        },
        onOpen: function () {
          var input = document.getElementById(id + '-input');
          if (input) {
            setTimeout(function () { input.focus(); }, 100);
            input.addEventListener('keydown', function (e) {
              if (e.key === 'Enter') {
                resolved = true;
                resolve(input.value);
                close(id);
              }
            });
          }

          var modalEl = document.getElementById(id);
          if (modalEl) {
            var observer = new MutationObserver(function () {
              if (!document.body.contains(modalEl) && !resolved) {
                observer.disconnect();
                resolve(null);
              }
            });
            observer.observe(document.body, { childList: true });
          }
        }
      });
    });
  }

  // ============================================
  // 11. Helpers
  // ============================================
  function escapeHtml(str) {
    if (str == null) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  function escapeAttr(str) {
    return escapeHtml(str);
  }

  function logDebug() {
    if (cfg && cfg.DEBUG) {
      console.log.apply(console, ['[Modal]'].concat(Array.prototype.slice.call(arguments)));
    }
  }

  // ============================================
  // 12. Public API
  // ============================================
  window.Modal = {
    initialized: true,
    open: open,
    close: close,
    closeAll: closeAll,
    confirm: confirm,
    alert: alert,
    prompt: prompt
  };

  logDebug('Modal component ready');

})();
