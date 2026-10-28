/* ============================================================
   ITWS Platform — Advanced Toast Notifications V2
   File: assets/js/ui/toast.js
   Description: Professional toast system with queue & progress

   Load order: AFTER icons.js

   Features:
   - 6 positions (top-right/center/left, bottom-right/center/left)
   - 5 types (success/error/warning/info/loading) + custom
   - Progress bar with pause on hover
   - Promise-based (Toast.promise)
   - Stacking + queue (max visible configurable)
   - Swipe dismiss (touch)
   - Close button
   - Action button (Undo/View/etc.)
   - Custom HTML body
   - RTL-aware
   - Accessibility (aria-live, role)
   - R13 responsive (mobile-first, safe-area, max-width)
   - Respects prefers-reduced-motion
   - Overrides legacy window.showToast/Utils.showToast

   Rules:
   - No emoji
   - ES5-style IIFE
   - Self-contained CSS
   - No external dependencies (Icons optional)
   ============================================================ */

(function () {
  'use strict';

  if (window.Toast && window.Toast._initialized) {
    return;
  }

  /* ============================================================
     1. HELPERS
     ============================================================ */

  function log(level, msg, data) {
    var cfg = window.ITWS_CONFIG || {};
    if (level === 'error' || (cfg.DEBUG && level === 'debug')) {
      try {
        var args = ['[Toast]', msg];
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
        return window.Icons.get(name, { size: size || 20 });
      }
    } catch (e) {}

    // Fallback (inline SVG)
    var paths = {
      check: '<polyline points="20 6 9 17 4 12"></polyline>',
      'check-circle': '<path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path><polyline points="22 4 12 14.01 9 11.01"></polyline>',
      x: '<line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line>',
      'x-circle': '<circle cx="12" cy="12" r="10"></circle><line x1="15" y1="9" x2="9" y2="15"></line><line x1="9" y1="9" x2="15" y2="15"></line>',
      'alert-triangle': '<path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path><line x1="12" y1="9" x2="12" y2="13"></line><line x1="12" y1="17" x2="12.01" y2="17"></line>',
      info: '<circle cx="12" cy="12" r="10"></circle><line x1="12" y1="16" x2="12" y2="12"></line><line x1="12" y1="8" x2="12.01" y2="8"></line>',
      loader: '<line x1="12" y1="2" x2="12" y2="6"></line><line x1="12" y1="18" x2="12" y2="22"></line><line x1="4.93" y1="4.93" x2="7.76" y2="7.76"></line><line x1="16.24" y1="16.24" x2="19.07" y2="19.07"></line><line x1="2" y1="12" x2="6" y2="12"></line><line x1="18" y1="12" x2="22" y2="12"></line><line x1="4.93" y1="19.07" x2="7.76" y2="16.24"></line><line x1="16.24" y1="7.76" x2="19.07" y2="4.93"></line>'
    };
    var path = paths[name] || paths.info;
    return '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" ' +
           'width="' + (size || 20) + '" height="' + (size || 20) + '" ' +
           'fill="none" stroke="currentColor" stroke-width="2" ' +
           'stroke-linecap="round" stroke-linejoin="round">' + path + '</svg>';
  }

  function uuid() {
    if (window.crypto && window.crypto.randomUUID) return 'toast_' + window.crypto.randomUUID().substring(0, 8);
    return 'toast_' + Date.now().toString(36) + '_' + Math.random().toString(36).substring(2, 6);
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
    queue: [],
    active: [],
    containers: {},   // { position: element }
    maxVisible: 5,
    counter: 0,
    initialized: false
  };

  var POSITIONS = ['top-right', 'top-center', 'top-left', 'bottom-right', 'bottom-center', 'bottom-left'];
  var DEFAULT_POSITION = 'top-center';

  /* ============================================================
     3. CSS INJECTION
     ============================================================ */

  var STYLE_ID = 'itws-toast-styles';

  function injectStyles() {
    if (document.getElementById(STYLE_ID)) return;

    var css = ''
      // ===== CONTAINER =====
      + '.itws-toast-root{position:fixed;z-index:9998;'
      + 'pointer-events:none;'
      + 'display:flex;flex-direction:column;gap:10px;'
      + 'padding:max(16px,env(safe-area-inset-top)) max(16px,env(safe-area-inset-right)) '
      + 'max(16px,env(safe-area-inset-bottom)) max(16px,env(safe-area-inset-left));'
      + 'max-width:100vw;overflow:hidden;}'
      + '.itws-toast-root[data-position="top-right"]{top:0;right:0;align-items:flex-end;}'
      + '.itws-toast-root[data-position="top-center"]{top:0;left:50%;transform:translateX(-50%);align-items:center;}'
      + '.itws-toast-root[data-position="top-left"]{top:0;left:0;align-items:flex-start;}'
      + '.itws-toast-root[data-position="bottom-right"]{bottom:0;right:0;align-items:flex-end;flex-direction:column-reverse;}'
      + '.itws-toast-root[data-position="bottom-center"]{bottom:0;left:50%;transform:translateX(-50%);align-items:center;flex-direction:column-reverse;}'
      + '.itws-toast-root[data-position="bottom-left"]{bottom:0;left:0;align-items:flex-start;flex-direction:column-reverse;}'

      // ===== TOAST =====
      + '.itws-toast{pointer-events:auto;'
      + 'position:relative;'
      + 'display:flex;align-items:flex-start;gap:12px;'
      + 'padding:14px 16px 16px;'
      + 'min-width:280px;max-width:min(400px,calc(100vw - 32px));'
      + 'background:var(--surface-elevated,#1C2430);'
      + 'color:var(--text,#F8FAFC);'
      + 'border:1px solid var(--border,rgba(255,255,255,0.1));'
      + 'border-radius:14px;'
      + 'box-shadow:0 15px 40px rgba(0,0,0,0.35);'
      + 'font-family:Cairo,sans-serif;font-size:14px;line-height:1.55;'
      + 'opacity:0;transform:translateY(-12px) scale(0.96);'
      + 'transition:opacity 0.2s ease,transform 0.25s cubic-bezier(0.34,1.56,0.64,1);'
      + 'overflow:hidden;'
      + 'cursor:default;'
      + 'user-select:none;-webkit-user-select:none;touch-action:pan-y;}'
      + '.itws-toast.is-visible{opacity:1;transform:translateY(0) scale(1);}'
      + '.itws-toast.is-dismissing{opacity:0;transform:translateY(-8px) scale(0.96);}'
      + '[data-position^="bottom"] .itws-toast{transform:translateY(12px) scale(0.96);}'
      + '[data-position^="bottom"] .itws-toast.is-visible{transform:translateY(0) scale(1);}'
      + '[data-position^="bottom"] .itws-toast.is-dismissing{transform:translateY(8px) scale(0.96);}'

      // ===== TYPE BORDERS =====
      + '.itws-toast.type-success{border-color:var(--success,#10B981);}'
      + '.itws-toast.type-error{border-color:var(--error,#EF4444);}'
      + '.itws-toast.type-warning{border-color:var(--warning,#F59E0B);}'
      + '.itws-toast.type-info{border-color:var(--info,#3B82F6);}'
      + '.itws-toast.type-loading{border-color:var(--primary,#CE1126);}'

      // ===== ICON =====
      + '.itws-toast-icon{width:32px;height:32px;border-radius:50%;'
      + 'display:flex;align-items:center;justify-content:center;'
      + 'flex-shrink:0;}'
      + '.itws-toast-icon svg{width:18px;height:18px;}'
      + '.itws-toast.type-success .itws-toast-icon{'
      + 'background:var(--success-soft,rgba(16,185,129,0.14));'
      + 'color:var(--success,#10B981);}'
      + '.itws-toast.type-error .itws-toast-icon{'
      + 'background:var(--error-soft,rgba(239,68,68,0.14));'
      + 'color:var(--error,#EF4444);}'
      + '.itws-toast.type-warning .itws-toast-icon{'
      + 'background:var(--warning-soft,rgba(245,158,11,0.14));'
      + 'color:var(--warning,#F59E0B);}'
      + '.itws-toast.type-info .itws-toast-icon{'
      + 'background:var(--info-soft,rgba(59,130,246,0.14));'
      + 'color:var(--info,#3B82F6);}'
      + '.itws-toast.type-loading .itws-toast-icon{'
      + 'background:var(--primary-soft,rgba(206,17,38,0.14));'
      + 'color:var(--primary,#CE1126);}'
      + '.itws-toast.type-loading .itws-toast-icon svg{'
      + 'animation:itwsToastSpin 0.9s linear infinite;}'

      // ===== BODY =====
      + '.itws-toast-body{flex:1;min-width:0;'
      + 'display:flex;flex-direction:column;gap:4px;}'
      + '.itws-toast-title{font-weight:800;'
      + 'font-size:clamp(13px,1.8vw,14px);'
      + 'color:var(--text,#F8FAFC);'
      + 'line-height:1.4;word-wrap:break-word;}'
      + '.itws-toast-message{font-size:clamp(12px,1.6vw,13px);'
      + 'color:var(--text-secondary,#94A3B8);'
      + 'line-height:1.6;word-wrap:break-word;'
      + 'white-space:pre-wrap;}'
      + '.itws-toast-body p{margin:0;}'

      // ===== ACTIONS =====
      + '.itws-toast-actions{display:flex;gap:6px;margin-top:8px;flex-wrap:wrap;}'
      + '.itws-toast-btn{display:inline-flex;align-items:center;gap:5px;'
      + 'padding:6px 12px;border-radius:8px;'
      + 'font-family:inherit;font-size:12px;font-weight:700;'
      + 'cursor:pointer;transition:all 0.15s;'
      + 'border:1px solid var(--border,rgba(255,255,255,0.1));'
      + 'background:var(--surface,#131820);'
      + 'color:var(--text,#F8FAFC);'
      + 'min-height:32px;white-space:nowrap;}'
      + '.itws-toast-btn:hover{border-color:var(--primary,#CE1126);'
      + 'color:var(--primary,#CE1126);'
      + 'background:var(--primary-soft,rgba(206,17,38,0.14));}'
      + '.itws-toast-btn.primary{background:var(--primary,#CE1126);'
      + 'color:var(--primary-text,#fff);border-color:var(--primary,#CE1126);}'
      + '.itws-toast-btn.primary:hover{background:var(--primary-hover,#E63946);}'
      + '.itws-toast-btn svg{width:12px;height:12px;}'

      // ===== CLOSE =====
      + '.itws-toast-close{width:24px;height:24px;border-radius:6px;'
      + 'background:transparent;border:none;'
      + 'color:var(--text-muted,#64748B);cursor:pointer;'
      + 'display:flex;align-items:center;justify-content:center;'
      + 'flex-shrink:0;padding:0;transition:all 0.15s;'
      + 'margin-top:-2px;}'
      + '.itws-toast-close:hover{background:var(--surface-hover,#252F3D);'
      + 'color:var(--text,#F8FAFC);}'
      + '.itws-toast-close svg{width:14px;height:14px;}'

      // ===== PROGRESS BAR =====
      + '.itws-toast-progress{position:absolute;left:0;right:0;bottom:0;'
      + 'height:3px;background:transparent;overflow:hidden;}'
      + '.itws-toast-progress-bar{height:100%;'
      + 'background:currentColor;opacity:0.4;'
      + 'transform-origin:left center;'
      + 'transition:transform linear;}'
      + '.itws-toast.type-success .itws-toast-progress-bar{background:var(--success,#10B981);}'
      + '.itws-toast.type-error .itws-toast-progress-bar{background:var(--error,#EF4444);}'
      + '.itws-toast.type-warning .itws-toast-progress-bar{background:var(--warning,#F59E0B);}'
      + '.itws-toast.type-info .itws-toast-progress-bar{background:var(--info,#3B82F6);}'
      + '.itws-toast.type-loading .itws-toast-progress-bar{display:none;}'

      // ===== SWIPE (touch) =====
      + '.itws-toast.is-swiping{transition:none;}'

      // ===== REDUCED MOTION =====
      + '@media (prefers-reduced-motion:reduce){'
      + '.itws-toast,.itws-toast-progress-bar{'
      + 'animation-duration:0.01ms !important;'
      + 'transition-duration:0.01ms !important;}}'

      // ===== MOBILE =====
      + '@media (max-width:480px){'
      + '.itws-toast-root{padding:max(12px,env(safe-area-inset-top)) 12px max(12px,env(safe-area-inset-bottom));}'
      + '.itws-toast{min-width:0;max-width:calc(100vw - 24px);}'
      + '.itws-toast-btn{padding:8px 14px;font-size:12px;}}';

    var style = document.createElement('style');
    style.id = STYLE_ID;
    style.textContent = css;
    document.head.appendChild(style);

    // Keyframes
    if (!document.getElementById('itws-toast-kf')) {
      var kf = document.createElement('style');
      kf.id = 'itws-toast-kf';
      kf.textContent = '@keyframes itwsToastSpin{to{transform:rotate(360deg);}}';
      document.head.appendChild(kf);
    }
  }

  /* ============================================================
     4. CONTAINERS
     ============================================================ */

  function getContainer(position) {
    if (!POSITIONS.includes(position)) position = DEFAULT_POSITION;

    if (state.containers[position]) return state.containers[position];

    var el = document.createElement('div');
    el.className = 'itws-toast-root';
    el.setAttribute('data-position', position);
    el.setAttribute('aria-live', 'polite');
    el.setAttribute('aria-atomic', 'false');
    document.body.appendChild(el);

    state.containers[position] = el;
    return el;
  }

  /* ============================================================
     5. TYPE CONFIG
     ============================================================ */

  var TYPE_CONFIG = {
    success: { icon: 'check-circle', role: 'status', ariaLive: 'polite', defaultDuration: 4000 },
    error:   { icon: 'x-circle',     role: 'alert',  ariaLive: 'assertive', defaultDuration: 8000 },
    warning: { icon: 'alert-triangle', role: 'alert', ariaLive: 'polite', defaultDuration: 6000 },
    info:    { icon: 'info',         role: 'status', ariaLive: 'polite', defaultDuration: 4000 },
    loading: { icon: 'loader',       role: 'status', ariaLive: 'polite', defaultDuration: 0 }
  };

  /* ============================================================
     6. CORE — SHOW
     ============================================================ */

  function show(options) {
    if (typeof options === 'string') {
      options = { message: options };
    }
    options = options || {};

    injectStyles();

    var type = options.type || 'info';
    var typeCfg = TYPE_CONFIG[type] || TYPE_CONFIG.info;
    var position = options.position || DEFAULT_POSITION;
    var duration = options.duration != null ? options.duration : typeCfg.defaultDuration;

    var id = options.id || uuid();

    // Check if we need to queue (max visible per container reached)
    var container = getContainer(position);
    var activeInContainer = state.active.filter(function (a) { return a.position === position; });

    if (activeInContainer.length >= state.maxVisible) {
      // Queue it
      state.queue.push({ id: id, options: options });
      log('debug', 'Toast queued (max visible reached)', { id: id, queueLength: state.queue.length });
      return id;
    }

    // Build toast
    var toast = buildToastElement(id, type, typeCfg, options);

    // Append
    container.appendChild(toast);

    // Register active
    var toastData = {
      id: id,
      el: toast,
      type: type,
      position: position,
      duration: duration,
      timer: null,
      remaining: duration,
      paused: false,
      dismissed: false,
      onClose: options.onClose || null,
      actions: options.actions || null
    };
    state.active.push(toastData);

    // Animate in
    requestAnimationFrame(function () {
      requestAnimationFrame(function () {
        toast.classList.add('is-visible');
      });
    });

    // Start timer + progress
    if (duration > 0) {
      startTimer(toastData);
    }

    // Pause on hover
    if (options.pauseOnHover !== false && duration > 0) {
      toast.addEventListener('mouseenter', function () { pauseTimer(toastData); });
      toast.addEventListener('mouseleave', function () { resumeTimer(toastData); });
    }

    // Swipe to dismiss
    if (options.dismissible !== false) {
      bindSwipeDismiss(toastData);
    }

    // Events
    dispatchEvent('itws:toast-shown', { id: id, type: type, message: options.message });

    log('debug', 'Toast shown', { id: id, type: type, duration: duration });
    return id;
  }

  /* ============================================================
     7. BUILD TOAST ELEMENT
     ============================================================ */

  function buildToastElement(id, type, typeCfg, options) {
    var toast = document.createElement('div');
    toast.className = 'itws-toast type-' + type;
    toast.setAttribute('data-toast-id', id);
    toast.setAttribute('role', typeCfg.role);
    toast.setAttribute('aria-live', typeCfg.ariaLive);

    var iconHtml = '<div class="itws-toast-icon" aria-hidden="true">' + icon(typeCfg.icon, 18) + '</div>';

    var titleHtml = options.title
      ? '<div class="itws-toast-title">' + escapeHtml(options.title) + '</div>'
      : '';

    var messageHtml = '';
    if (options.html) {
      messageHtml = '<div class="itws-toast-message">' + options.html + '</div>';
    } else if (options.message) {
      messageHtml = '<div class="itws-toast-message">' + escapeHtml(options.message) + '</div>';
    }

    // Actions
    var actionsHtml = '';
    if (Array.isArray(options.actions) && options.actions.length > 0) {
      actionsHtml = '<div class="itws-toast-actions">';
      options.actions.forEach(function (action, idx) {
        var variant = action.variant === 'primary' ? ' primary' : '';
        actionsHtml += '<button type="button" class="itws-toast-btn' + variant + '" '
          + 'data-action-index="' + idx + '">'
          + (action.icon ? icon(action.icon, 12) : '')
          + '<span>' + escapeHtml(action.label || '') + '</span>'
          + '</button>';
      });
      actionsHtml += '</div>';
    }

    var closeHtml = options.dismissible !== false
      ? '<button type="button" class="itws-toast-close" aria-label="' + escapeHtml(getLabel('common.close', 'إغلاق')) + '">'
          + icon('x', 14)
        + '</button>'
      : '';

    var progressHtml = options.showProgress !== false && (options.duration === undefined || options.duration > 0) && type !== 'loading'
      ? '<div class="itws-toast-progress"><div class="itws-toast-progress-bar" style="transform:scaleX(1);"></div></div>'
      : '';

    toast.innerHTML = iconHtml
      + '<div class="itws-toast-body">' + titleHtml + messageHtml + actionsHtml + '</div>'
      + closeHtml
      + progressHtml;

    // Bind action buttons
    if (Array.isArray(options.actions)) {
      var actionBtns = toast.querySelectorAll('[data-action-index]');
      actionBtns.forEach(function (btn) {
        btn.addEventListener('click', function () {
          var idx = parseInt(btn.getAttribute('data-action-index'), 10);
          var action = options.actions[idx];
          if (!action) return;

          if (typeof action.onClick === 'function') {
            try {
              var result = action.onClick();
              if (result === false) return; // don't dismiss
            } catch (e) {
              log('error', 'Action onClick failed', e);
            }
          }

          if (action.dismiss !== false) {
            dismiss(id);
          }
        });
      });
    }

    // Bind close button
    var closeBtn = toast.querySelector('.itws-toast-close');
    if (closeBtn) {
      closeBtn.addEventListener('click', function () {
        dismiss(id);
      });
    }

    return toast;
  }

  /* ============================================================
     8. TIMER MANAGEMENT
     ============================================================ */

  function startTimer(toastData) {
    if (!toastData || toastData.duration <= 0) return;

    var startTime = Date.now();
    var elapsed = 0;

    toastData.timer = setTimeout(function () {
      dismiss(toastData.id);
    }, toastData.remaining);

    // Progress bar animation
    var bar = toastData.el.querySelector('.itws-toast-progress-bar');
    if (bar) {
      bar.style.transition = 'transform ' + toastData.remaining + 'ms linear';
      requestAnimationFrame(function () {
        bar.style.transform = 'scaleX(0)';
      });
    }

    toastData._startTime = startTime;
    toastData._elapsed = elapsed;
  }

  function pauseTimer(toastData) {
    if (!toastData || toastData.paused || toastData.dismissed) return;
    if (!toastData.timer) return;

    toastData.paused = true;

    // Calculate remaining
    var elapsed = Date.now() - toastData._startTime;
    toastData.remaining = Math.max(0, toastData.remaining - elapsed);

    clearTimeout(toastData.timer);
    toastData.timer = null;

    // Pause progress bar
    var bar = toastData.el.querySelector('.itws-toast-progress-bar');
    if (bar) {
      var computed = getComputedStyle(bar).transform;
      bar.style.transition = 'none';
      bar.style.transform = computed === 'none' ? 'scaleX(1)' : computed;
    }
  }

  function resumeTimer(toastData) {
    if (!toastData || !toastData.paused || toastData.dismissed) return;
    toastData.paused = false;

    if (toastData.remaining <= 0) {
      dismiss(toastData.id);
      return;
    }

    toastData._startTime = Date.now();
    toastData.timer = setTimeout(function () {
      dismiss(toastData.id);
    }, toastData.remaining);

    // Resume progress bar
    var bar = toastData.el.querySelector('.itws-toast-progress-bar');
    if (bar) {
      bar.style.transition = 'transform ' + toastData.remaining + 'ms linear';
      bar.style.transform = 'scaleX(0)';
    }
  }

  /* ============================================================
     9. DISMISS
     ============================================================ */

  function dismiss(id, reason) {
    if (!id) return;

    var idx = -1;
    for (var i = 0; i < state.active.length; i++) {
      if (state.active[i].id === id) { idx = i; break; }
    }
    if (idx === -1) return;

    var toastData = state.active[idx];
    if (toastData.dismissed) return;
    toastData.dismissed = true;

    // Clear timer
    if (toastData.timer) {
      clearTimeout(toastData.timer);
      toastData.timer = null;
    }

    // Remove from active
    state.active.splice(idx, 1);

    // onClose callback
    if (typeof toastData.onClose === 'function') {
      try { toastData.onClose(reason || 'timeout'); } catch (e) {}
    }

    // Animate out
    toastData.el.classList.add('is-dismissing');
    toastData.el.classList.remove('is-visible');

    setTimeout(function () {
      if (toastData.el.parentNode) {
        toastData.el.parentNode.removeChild(toastData.el);
      }
      // Try to process queue
      processQueue();
    }, 250);

    dispatchEvent('itws:toast-dismissed', { id: id, reason: reason || 'timeout' });
  }

  function dismissAll(reason) {
    var ids = state.active.map(function (t) { return t.id; });
    ids.forEach(function (id) { dismiss(id, reason || 'manual'); });
    state.queue = [];
  }

  function processQueue() {
    if (state.queue.length === 0) return;

    // Check active counts per position
    var countsByPosition = {};
    state.active.forEach(function (t) {
      countsByPosition[t.position] = (countsByPosition[t.position] || 0) + 1;
    });

    var remainingQueue = [];
    state.queue.forEach(function (item) {
      var position = (item.options && item.options.position) || DEFAULT_POSITION;
      var current = countsByPosition[position] || 0;

      if (current < state.maxVisible) {
        countsByPosition[position] = current + 1;
        // Re-show
        show(item.options);
      } else {
        remainingQueue.push(item);
      }
    });

    state.queue = remainingQueue;
  }

  /* ============================================================
     10. SWIPE TO DISMISS (touch)
     ============================================================ */

  function bindSwipeDismiss(toastData) {
    var el = toastData.el;
    var startX = 0;
    var startY = 0;
    var deltaX = 0;
    var deltaY = 0;
    var swiping = false;

    el.addEventListener('touchstart', function (e) {
      if (!e.touches || !e.touches[0]) return;
      startX = e.touches[0].clientX;
      startY = e.touches[0].clientY;
      swiping = true;
      el.classList.add('is-swiping');
    }, { passive: true });

    el.addEventListener('touchmove', function (e) {
      if (!swiping || !e.touches || !e.touches[0]) return;
      deltaX = e.touches[0].clientX - startX;
      deltaY = e.touches[0].clientY - startY;

      // Only allow horizontal swipe
      if (Math.abs(deltaX) > Math.abs(deltaY)) {
        el.style.transform = 'translateX(' + deltaX + 'px)';
        el.style.opacity = String(Math.max(0, 1 - Math.abs(deltaX) / 300));
      }
    }, { passive: true });

    el.addEventListener('touchend', function () {
      if (!swiping) return;
      swiping = false;
      el.classList.remove('is-swiping');

      if (Math.abs(deltaX) > 100) {
        dismiss(toastData.id, 'swipe');
      } else {
        el.style.transform = '';
        el.style.opacity = '';
      }
      deltaX = 0;
      deltaY = 0;
    });
  }

  /* ============================================================
     11. PRESET WRAPPERS
     ============================================================ */

  function success(message, options) {
    options = Object.assign({ type: 'success', message: message }, options || {});
    return show(options);
  }

  function error(message, options) {
    options = Object.assign({ type: 'error', message: message }, options || {});
    return show(options);
  }

  function warning(message, options) {
    options = Object.assign({ type: 'warning', message: message }, options || {});
    return show(options);
  }

  function info(message, options) {
    options = Object.assign({ type: 'info', message: message }, options || {});
    return show(options);
  }

  function loading(message, options) {
    options = Object.assign({ type: 'loading', message: message, duration: 0 }, options || {});
    return show(options);
  }

  /* ============================================================
     12. PROMISE-BASED TOAST
     ============================================================ */

  /**
   * Toast.promise(promise, {
   *   loading: 'جاري...',
   *   success: 'تم بنجاح',  // or function(data) => string
   *   error: 'فشل',          // or function(err) => string
   *   duration: 4000
   * })
   */
  function promise(promiseObj, messages) {
    messages = messages || {};

    var loadingMsg = messages.loading || getLabel('common.loading', 'جاري التحميل...');
    var loadingId = loading(loadingMsg);

    return Promise.resolve(promiseObj)
      .then(function (result) {
        dismiss(loadingId);

        var successMsg = messages.success;
        if (typeof successMsg === 'function') successMsg = successMsg(result);

        if (successMsg) {
          success(successMsg, {
            title: messages.successTitle || null,
            duration: messages.duration,
            position: messages.position
          });
        }
        return result;
      })
      .catch(function (err) {
        dismiss(loadingId);

        var errorMsg = messages.error;
        if (typeof errorMsg === 'function') errorMsg = errorMsg(err);
        if (!errorMsg) errorMsg = getLabel('errors.generic', 'حدث خطأ');

        error(errorMsg, {
          title: messages.errorTitle || null,
          duration: messages.errorDuration,
          position: messages.position
        });
        throw err;
      });
  }

  /* ============================================================
     13. EXPORT
     ============================================================ */

  window.Toast = {
    _initialized: true,

    // Core
    show: show,
    dismiss: dismiss,
    dismissAll: dismissAll,

    // Presets
    success: success,
    error: error,
    warning: warning,
    info: info,
    loading: loading,

    // Promise
    promise: promise,

    // Config
    setMaxVisible: function (n) {
      state.maxVisible = Math.max(1, parseInt(n, 10) || 5);
    },
    getMaxVisible: function () { return state.maxVisible; },

    // State
    count: function () { return state.active.length; },
    queuedCount: function () { return state.queue.length; },
    isAnyVisible: function () { return state.active.length > 0; }
  };

  /* ============================================================
     14. OVERRIDE LEGACY showToast / Utils.showToast
     ============================================================ */

  // Keep old API working but use new system
  window.showToast = function (message, type, options) {
    options = options || {};
    var opts = Object.assign({
      message: message,
      type: type || 'info'
    }, options);
    return show(opts);
  };

  window.toast = window.showToast;

  // Override Utils.showToast if Utils exists
  if (window.Utils && typeof window.Utils === 'object') {
    window.Utils.showToast = window.showToast;
  }

  /* ============================================================
     15. CLEANUP ON UNLOAD
     ============================================================ */

  if (typeof window.addEventListener === 'function') {
    window.addEventListener('beforeunload', function () {
      dismissAll('unload');
    });
  }

  /* ============================================================
     16. DEBUG LOG
     ============================================================ */

  var cfg = window.ITWS_CONFIG || {};
  if (cfg.DEBUG) {
    try {
      console.log('%c[Toast]', 'color: #10B981; font-weight: bold;', 'System ready (advanced)');
    } catch (e) {}
  }

})();
