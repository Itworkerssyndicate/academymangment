// ============================================
// [17/50] ITWS Platform - Modal Component
// Path: assets/js/ui/modal.js
// ============================================
// 💡 Modal بسيط وقوي
// 💡 يدعم: open/close/confirm/alert/prompt
// 💡 Stacking (فتح modal فوق modal)
// 💡 Focus trap (Accessibility)
// 💡 Esc to close + Click backdrop
// ============================================

(function () {
  'use strict';

  if (window.Modal && window.Modal.initialized) return;

  var cfg = window.ITWS_CONFIG;

  var state = {
    stack: [],           // [modalId, modalId, ...]
    counter: 0,
    escBound: false
  };

  // ============================================
  // 1. توليد ID فريد
  // ============================================
  function nextId() {
    state.counter++;
    return 'itws-modal-' + state.counter + '-' + Date.now();
  }

  // ============================================
  // 2. إنشاء Modal Element
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
      ? '<button class="modal-close" aria-label="إغلاق" data-modal-close>×</button>'
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
        return '<button class="' + cls + '" ' + action + dataAttrs + '>' +
          (btn.icon ? btn.icon + ' ' : '') + escapeHtml(btn.label) +
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

    // مستمع الإغلاق بالضغط على الـ backdrop
    if (closeOnBackdrop) {
      backdrop.addEventListener('click', function (e) {
        if (e.target === backdrop) {
          close(id);
        }
      });
    }

    // مستمع الإغلاق بالأزرار
    backdrop.querySelectorAll('[data-modal-close]').forEach(function (el) {
      el.addEventListener('click', function () {
        close(id);
      });
    });

    // مستمع لأزرار الأفعال
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
  // 3. Esc handler
  // ============================================
  function handleEsc(e) {
    if (e.key === 'Escape' && state.stack.length > 0) {
      var topId = state.stack[state.stack.length - 1];
      close(topId);
    }
  }

  // ============================================
  // 4. Focus Trap
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
  // 5. Open
  // ============================================
  function open(options) {
    if (typeof options === 'string') {
      options = { content: options };
    }
    options = options || {};

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
  // 6. Close
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
    }, 250);
  }

  function closeAll() {
    state.stack.slice().forEach(close);
  }

  // ============================================
  // 7. Confirm (سريع)
  // ============================================
  function confirm(options) {
    if (typeof options === 'string') {
      options = { message: options };
    }
    options = options || {};

    return new Promise(function (resolve) {
      var confirmed = false;

      var id = open({
        title: options.title || 'تأكيد',
        size: options.size || 'sm',
        content: '' +
          '<div style="text-align:center;padding:8px 0;">' +
            '<div style="font-size:48px;margin-bottom:16px;">' +
              (options.icon || '⚠️') +
            '</div>' +
            '<p style="font-size:15px;color:var(--text);line-height:1.6;">' +
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
          // في حالة الإغلاق بـ Esc أو backdrop
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
  // 8. Alert (سريع)
  // ============================================
  function alert(options) {
    if (typeof options === 'string') {
      options = { message: options };
    }
    options = options || {};

    return new Promise(function (resolve) {
      open({
        title: options.title || 'تنبيه',
        size: options.size || 'sm',
        content: '' +
          '<div style="text-align:center;padding:8px 0;">' +
            '<div style="font-size:48px;margin-bottom:16px;">' +
              (options.icon || 'ℹ️') +
            '</div>' +
            '<p style="font-size:15px;color:var(--text);line-height:1.6;">' +
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
  // 9. Prompt (سريع)
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
  // 10. Helpers
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
  // 11. Public API
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
