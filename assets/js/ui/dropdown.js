/* ============================================================
   ITWS Platform — Dropdown Component V2
   File: assets/js/ui/dropdown.js
   Description: Accessible dropdown menu with smart positioning

   Load order: AFTER icons.js

   Features:
   - Click or hover trigger
   - Smart positioning (auto-flip if overflow)
   - Keyboard navigation (arrows, Enter, Space, Escape, Home, End)
   - RTL aware
   - Groups + separators
   - Items with icons, badges, danger variant
   - Checkbox items (multi-select)
   - Radio groups (single select)
   - Disabled items
   - Custom item rendering
   - Match trigger width option
   - Auto-close on select / outside click / Esc
   - Multiple instances
   - Recalculate position on scroll + resize
   - R13 responsive (mobile: full-width option)
   - Accessibility (role=menu, role=menuitem, aria-expanded)
   - No emoji

   Rules:
   - No emoji
   - ES5-style IIFE
   - Self-contained CSS
   - No external dependencies
   ============================================================ */

(function () {
  'use strict';

  if (window.Dropdown && window.Dropdown._initialized) {
    return;
  }

  /* ============================================================
     1. HELPERS
     ============================================================ */

  function log(level, msg, data) {
    var cfg = window.ITWS_CONFIG || {};
    if (level === 'error' || (cfg.DEBUG && level === 'debug')) {
      try {
        var args = ['[Dropdown]', msg];
        if (data !== undefined) args.push(data);
        if (level === 'error') console.error.apply(console, args);
        else console.log.apply(console, args);
      } catch (e) {}
    }
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
        return window.Icons.get(name, { size: size || 16 });
      }
    } catch (e) {}
    return '';
  }

  function uuid() {
    if (window.crypto && window.crypto.randomUUID) return 'dd_' + window.crypto.randomUUID().substring(0, 8);
    return 'dd_' + Date.now().toString(36) + '_' + Math.random().toString(36).substring(2, 6);
  }

  function dispatchEvent(name, detail) {
    try {
      window.dispatchEvent(new CustomEvent(name, { detail: detail || {} }));
    } catch (e) {}
  }

  function isRTL() {
    try {
      return document.documentElement.getAttribute('dir') === 'rtl' ||
             getComputedStyle(document.body).direction === 'rtl';
    } catch (e) {
      return false;
    }
  }

  /* ============================================================
     2. STATE
     ============================================================ */

  var state = {
    instances: {},        // { id: instance }
    openInstanceId: null,
    globalHandlers: false
  };

  var STYLE_ID = 'itws-dropdown-styles';

  /* ============================================================
     3. CSS INJECTION
     ============================================================ */

  function injectStyles() {
    if (document.getElementById(STYLE_ID)) return;

    var css = ''
      // ===== ROOT =====
      + '.itws-dd-root{position:absolute;z-index:9500;'
      + 'min-width:180px;max-width:min(320px,calc(100vw - 20px));'
      + 'background:var(--surface-elevated,#1C2430);'
      + 'border:1px solid var(--border,rgba(255,255,255,0.1));'
      + 'border-radius:12px;'
      + 'box-shadow:0 15px 40px rgba(0,0,0,0.35);'
      + 'font-family:Cairo,sans-serif;font-size:13px;'
      + 'overflow:hidden;'
      + 'opacity:0;transform:translateY(-4px) scale(0.98);'
      + 'transition:opacity 0.15s ease,transform 0.15s cubic-bezier(0.34,1.56,0.64,1);'
      + 'pointer-events:none;}'
      + '.itws-dd-root.is-open{opacity:1;transform:translateY(0) scale(1);pointer-events:auto;}'

      // ===== BODY =====
      + '.itws-dd-body{padding:6px;max-height:min(400px,70vh);'
      + 'overflow-y:auto;overscroll-behavior:contain;}'
      + '.itws-dd-body::-webkit-scrollbar{width:6px;}'
      + '.itws-dd-body::-webkit-scrollbar-thumb{'
      + 'background:var(--border,rgba(255,255,255,0.15));border-radius:3px;}'

      // ===== GROUP =====
      + '.itws-dd-group{padding:0;}'
      + '.itws-dd-group-label{padding:8px 12px 4px;'
      + 'font-size:10px;font-weight:800;'
      + 'color:var(--text-muted,#64748B);'
      + 'text-transform:uppercase;letter-spacing:0.8px;}'

      // ===== ITEM =====
      + '.itws-dd-item{display:flex;align-items:center;gap:10px;'
      + 'padding:9px 12px;border-radius:7px;'
      + 'color:var(--text,#F8FAFC);'
      + 'font-family:inherit;font-size:13px;font-weight:500;'
      + 'text-decoration:none;background:transparent;'
      + 'border:none;cursor:pointer;'
      + 'transition:all 0.1s;width:100%;text-align:start;'
      + 'min-height:36px;line-height:1.4;'
      + 'white-space:nowrap;overflow:hidden;}'
      + '.itws-dd-item:hover:not(.is-disabled):not(.is-selected),'
      + '.itws-dd-item.is-focused:not(.is-disabled){'
      + 'background:var(--surface-hover,#252F3D);'
      + 'color:var(--primary,#CE1126);}'
      + '.itws-dd-item.is-selected{'
      + 'background:var(--primary-soft,rgba(206,17,38,0.14));'
      + 'color:var(--primary,#CE1126);font-weight:700;}'
      + '.itws-dd-item.is-disabled{opacity:0.5;cursor:not-allowed;}'
      + '.itws-dd-item.danger{color:var(--error,#EF4444);}'
      + '.itws-dd-item.danger:hover:not(.is-disabled),'
      + '.itws-dd-item.danger.is-focused{'
      + 'background:var(--error-soft,rgba(239,68,68,0.14));'
      + 'color:var(--error,#EF4444);}'
      + '.itws-dd-item svg{width:16px;height:16px;flex-shrink:0;'
      + 'color:currentColor;opacity:0.85;}'
      + '.itws-dd-item-label{flex:1;min-width:0;'
      + 'overflow:hidden;text-overflow:ellipsis;'
      + 'white-space:nowrap;}'
      + '.itws-dd-item-badge{font-size:10px;font-weight:800;'
      + 'padding:2px 6px;border-radius:999px;'
      + 'background:var(--primary-soft,rgba(206,17,38,0.14));'
      + 'color:var(--primary,#CE1126);'
      + 'flex-shrink:0;min-width:18px;text-align:center;}'
      + '.itws-dd-item.danger .itws-dd-item-badge{'
      + 'background:var(--error-soft,rgba(239,68,68,0.14));'
      + 'color:var(--error,#EF4444);}'
      + '.itws-dd-item-extra{font-size:11px;'
      + 'color:var(--text-muted,#64748B);'
      + 'flex-shrink:0;margin-start:auto;}'
      + '.itws-dd-item-check{width:16px;height:16px;'
      + 'display:flex;align-items:center;justify-content:center;'
      + 'color:var(--primary,#CE1126);flex-shrink:0;}'
      + '.itws-dd-item-check svg{width:14px;height:14px;}'
      + '.itws-dd-item[data-checkbox] .itws-dd-item-check{border:1.5px solid var(--border,rgba(255,255,255,0.2));'
      + 'border-radius:4px;background:transparent;}'
      + '.itws-dd-item[data-checkbox].is-selected .itws-dd-item-check{'
      + 'background:var(--primary,#CE1126);'
      + 'border-color:var(--primary,#CE1126);'
      + 'color:#fff;}'

      // ===== SEPARATOR =====
      + '.itws-dd-sep{height:1px;'
      + 'background:var(--border,rgba(255,255,255,0.08));'
      + 'margin:6px 4px;}'

      // ===== HEADER / FOOTER =====
      + '.itws-dd-head{padding:12px 14px;'
      + 'border-bottom:1px solid var(--border,rgba(255,255,255,0.08));}'
      + '.itws-dd-head-title{font-size:13px;font-weight:800;'
      + 'color:var(--text,#F8FAFC);margin:0 0 2px;}'
      + '.itws-dd-head-sub{font-size:11px;'
      + 'color:var(--text-muted,#64748B);margin:0;'
      + 'word-break:break-all;}'
      + '.itws-dd-foot{padding:8px 10px;'
      + 'border-top:1px solid var(--border,rgba(255,255,255,0.08));'
      + 'display:flex;justify-content:flex-end;gap:6px;}'
      + '.itws-dd-foot .itws-dd-btn{padding:6px 14px;border-radius:6px;'
      + 'background:var(--primary,#CE1126);'
      + 'color:var(--primary-text,#fff);'
      + 'font-family:inherit;font-size:12px;font-weight:700;'
      + 'border:none;cursor:pointer;min-height:32px;}'

      // ===== TRIGGER (helper) =====
      + '[data-dropdown-trigger]{cursor:pointer;}'

      // ===== ARROW / CARET =====
      + '.itws-dd-root.has-arrow::before{content:"";'
      + 'position:absolute;width:10px;height:10px;'
      + 'background:var(--surface-elevated,#1C2430);'
      + 'border:1px solid var(--border,rgba(255,255,255,0.1));'
      + 'transform:rotate(45deg);'
      + 'pointer-events:none;}'
      + '.itws-dd-root[data-arrow-pos="top"]::before{top:-5px;'
      + 'border-right:none;border-bottom:none;}'
      + '.itws-dd-root[data-arrow-pos="bottom"]::before{bottom:-5px;'
      + 'border-left:none;border-top:none;}'

      // ===== REDUCED MOTION =====
      + '@media (prefers-reduced-motion:reduce){'
      + '.itws-dd-root,.itws-dd-item{'
      + 'animation-duration:0.01ms !important;'
      + 'transition-duration:0.01ms !important;}}'

      // ===== MOBILE =====
      + '@media (max-width:480px){'
      + '.itws-dd-root{max-width:calc(100vw - 20px);}'
      + '.itws-dd-item{padding:11px 12px;font-size:14px;min-height:42px;}}';

    var style = document.createElement('style');
    style.id = STYLE_ID;
    style.textContent = css;
    document.head.appendChild(style);
  }

  /* ============================================================
     4. POSITIONING
     ============================================================ */

  function computePosition(triggerEl, dropdownEl, placement) {
    if (!triggerEl || !dropdownEl) return;

    // Reset styles
    dropdownEl.style.top = '';
    dropdownEl.style.left = '';
    dropdownEl.style.right = '';
    dropdownEl.style.bottom = '';

    var triggerRect = triggerEl.getBoundingClientRect();
    var dropdownRect = dropdownEl.getBoundingClientRect();
    var vw = window.innerWidth;
    var vh = window.innerHeight;
    var gap = 6;
    var rtl = isRTL();

    // Parse placement: 'bottom-start' | 'bottom-end' | 'top-start' | 'top-end' | 'auto'
    var parts = String(placement || 'bottom-start').split('-');
    var side = parts[0] === 'auto' ? 'bottom' : parts[0]; // 'top' | 'bottom'
    var align = parts[1] || 'start'; // 'start' | 'end' | 'center'

    // Auto-flip vertically if not enough space
    var spaceBelow = vh - triggerRect.bottom - gap;
    var spaceAbove = triggerRect.top - gap;
    var dropdownHeight = dropdownRect.height;

    if (side === 'bottom' && spaceBelow < dropdownHeight && spaceAbove > spaceBelow) {
      side = 'top';
    } else if (side === 'top' && spaceAbove < dropdownHeight && spaceBelow > spaceAbove) {
      side = 'bottom';
    }

    // Vertical position
    var top;
    if (side === 'bottom') {
      top = triggerRect.bottom + window.scrollY + gap;
    } else {
      top = triggerRect.top + window.scrollY - dropdownHeight - gap;
    }

    // Horizontal position
    var left;
    var dropdownWidth = dropdownRect.width;

    if (align === 'start') {
      // Start = aligned with trigger's start (in RTL → right)
      if (rtl) {
        left = triggerRect.right - dropdownWidth + window.scrollX;
      } else {
        left = triggerRect.left + window.scrollX;
      }
    } else if (align === 'end') {
      if (rtl) {
        left = triggerRect.left + window.scrollX;
      } else {
        left = triggerRect.right - dropdownWidth + window.scrollX;
      }
    } else { // center
      left = triggerRect.left + (triggerRect.width / 2) - (dropdownWidth / 2) + window.scrollX;
    }

    // Clamp horizontally to viewport
    var minLeft = 8;
    var maxLeft = vw - dropdownWidth - 8 + window.scrollX;
    if (left < minLeft + window.scrollX) left = minLeft + window.scrollX;
    if (left > maxLeft) left = maxLeft;

    // Apply
    dropdownEl.style.top = top + 'px';
    dropdownEl.style.left = left + 'px';

    // Arrow position
    if (dropdownEl.classList.contains('has-arrow')) {
      dropdownEl.setAttribute('data-arrow-pos', side === 'bottom' ? 'top' : 'bottom');
      var arrowLeft = (triggerRect.left + triggerRect.width / 2) - left;
      dropdownEl.style.setProperty('--arrow-left', arrowLeft + 'px');
    }
  }

  /* ============================================================
     5. BUILD ITEMS HTML
     ============================================================ */

  function renderItems(items) {
    if (!Array.isArray(items)) return '';

    var html = '';
    items.forEach(function (item) {
      if (!item) return;

      // Separator
      if (item.type === 'separator') {
        html += '<div class="itws-dd-sep" role="separator"></div>';
        return;
      }

      // Group label
      if (item.type === 'label') {
        html += '<div class="itws-dd-group-label">' + escapeHtml(item.label || '') + '</div>';
        return;
      }

      // Regular item
      var tag = item.href ? 'a' : 'button';
      var attrs = '';
      if (tag === 'a') {
        attrs += ' href="' + escapeHtml(item.href) + '"';
        if (item.target) attrs += ' target="' + escapeHtml(item.target) + '"';
        if (item.target === '_blank') attrs += ' rel="noopener"';
      } else {
        attrs += ' type="button"';
      }

      var classes = 'itws-dd-item';
      if (item.danger) classes += ' danger';
      if (item.selected) classes += ' is-selected';
      if (item.disabled) classes += ' is-disabled';
      if (item.checkbox) classes += ' is-checkable';
      if (item.role) {
        // Override default
      } else {
        if (item.checkbox) attrs += ' role="menuitemcheckbox"';
        else if (item.radio) attrs += ' role="menuitemradio"';
        else attrs += ' role="menuitem"';
      }

      if (item.checkbox) {
        attrs += ' data-checkbox="true"';
        attrs += ' aria-checked="' + (item.selected ? 'true' : 'false') + '"';
      }

      if (item.disabled) attrs += ' disabled aria-disabled="true" tabindex="-1"';
      else attrs += ' tabindex="-1"';

      if (item.id) attrs += ' data-item-id="' + escapeHtml(item.id) + '"';

      var iconHtml = item.icon ? icon(item.icon, 16) : '';
      var checkHtml = (item.checkbox || item.radio) ?
        '<span class="itws-dd-item-check" aria-hidden="true">' +
          (item.selected ? icon('check', 14) : (item.radio ? '<span style="width:8px;height:8px;border-radius:50%;background:currentColor;"></span>' : '')) +
        '</span>' : '';

      var labelHtml = '<span class="itws-dd-item-label">' + escapeHtml(item.label || '') + '</span>';
      var badgeHtml = item.badge ? '<span class="itws-dd-item-badge">' + escapeHtml(String(item.badge)) + '</span>' : '';
      var extraHtml = item.extra ? '<span class="itws-dd-item-extra">' + escapeHtml(item.extra) + '</span>' : '';

      html += '<' + tag + ' class="' + classes + '"' + attrs + '>'
        + (item.checkbox || item.radio ? checkHtml : iconHtml)
        + labelHtml
        + badgeHtml
        + extraHtml
        + '</' + tag + '>';
    });

    return html;
  }

  /* ============================================================
     6. BUILD DROPDOWN ELEMENT
     ============================================================ */

  function buildDropdown(options) {
    var root = document.createElement('div');
    root.className = 'itws-dd-root';
    root.setAttribute('role', 'menu');
    root.setAttribute('tabindex', '-1');

    if (options.hasArrow) root.classList.add('has-arrow');

    var inner = '';

    // Header
    if (options.header && (options.header.title || options.header.subtitle)) {
      inner += '<div class="itws-dd-head">'
        + (options.header.title ? '<p class="itws-dd-head-title">' + escapeHtml(options.header.title) + '</p>' : '')
        + (options.header.subtitle ? '<p class="itws-dd-head-sub">' + escapeHtml(options.header.subtitle) + '</p>' : '')
        + '</div>';
    }

    // Body
    inner += '<div class="itws-dd-body">';
    if (typeof options.body === 'string') {
      inner += options.body;
    } else if (typeof options.items !== 'undefined') {
      inner += renderItems(options.items);
    }
    inner += '</div>';

    // Footer
    if (options.footer && Array.isArray(options.footer.buttons) && options.footer.buttons.length > 0) {
      inner += '<div class="itws-dd-foot">';
      options.footer.buttons.forEach(function (btn, idx) {
        inner += '<button type="button" class="itws-dd-btn" data-footer-btn="' + idx + '">'
          + escapeHtml(btn.label || '')
          + '</button>';
      });
      inner += '</div>';
    }

    root.innerHTML = inner;

    return root;
  }

  /* ============================================================
     7. CORE — CREATE
     ============================================================ */

  /**
   * Create a dropdown
   * @param {object} options
   *   - trigger: HTMLElement (required) OR selector string
   *   - items: array (optional if body provided)
   *   - body: string (optional — custom HTML)
   *   - header: { title, subtitle }
   *   - footer: { buttons: [{ label, onClick }] }
   *   - placement: 'bottom-start' | 'bottom-end' | 'top-start' | 'top-end' | 'auto'
   *   - triggerMode: 'click' | 'hover' (default 'click')
   *   - closeOnSelect: boolean (default true)
   *   - closeOnOutside: boolean (default true)
   *   - closeOnEsc: boolean (default true)
   *   - hasArrow: boolean (default false)
   *   - matchTriggerWidth: boolean (default false)
   *   - onSelect: function(item, event)
   *   - onOpen: function()
   *   - onClose: function()
   * @returns {object} instance
   */
  function create(options) {
    if (!options) options = {};

    injectStyles();

    var triggerEl = options.trigger;
    if (typeof triggerEl === 'string') {
      triggerEl = document.querySelector(triggerEl);
    }
    if (!triggerEl || triggerEl.nodeType !== 1) {
      log('error', 'trigger element required');
      return null;
    }

    var id = uuid();
    var dropdownEl = buildDropdown(options);
    document.body.appendChild(dropdownEl);

    if (options.hasArrow && options.placement) {
      // Set arrow pos will be computed on open
    }

    var instance = {
      id: id,
      triggerEl: triggerEl,
      dropdownEl: dropdownEl,
      options: options,
      isOpen: false,
      currentPlacement: options.placement || 'bottom-start',

      // Methods
      open: function () { openInstance(instance); },
      close: function () { closeInstance(instance); },
      toggle: function () { instance.isOpen ? instance.close() : instance.open(); },
      update: function (newItems) {
        instance.options.items = newItems;
        var body = dropdownEl.querySelector('.itws-dd-body');
        if (body) body.innerHTML = renderItems(newItems);
        bindItemEvents(instance);
      },
      destroy: function () { destroyInstance(instance); },
      reposition: function () {
        if (instance.isOpen) {
          computePosition(triggerEl, dropdownEl, instance.currentPlacement);
        }
      },
      isOpen: function () { return instance.isOpen; }
    };

    // Store instance
    state.instances[id] = instance;

    // Attach data attr to trigger
    triggerEl.setAttribute('data-dropdown-id', id);
    triggerEl.setAttribute('aria-haspopup', 'menu');
    triggerEl.setAttribute('aria-expanded', 'false');

    // Bind trigger events
    var triggerMode = options.triggerMode || 'click';
    var triggerHoverTimer = null;

    if (triggerMode === 'hover') {
      triggerEl.addEventListener('mouseenter', function () {
        clearTimeout(triggerHoverTimer);
        openInstance(instance);
      });
      triggerEl.addEventListener('mouseleave', function () {
        triggerHoverTimer = setTimeout(function () {
          closeInstance(instance);
        }, 150);
      });
      dropdownEl.addEventListener('mouseenter', function () {
        clearTimeout(triggerHoverTimer);
      });
      dropdownEl.addEventListener('mouseleave', function () {
        triggerHoverTimer = setTimeout(function () {
          closeInstance(instance);
        }, 150);
      });
    } else {
      // Click mode
      triggerEl.addEventListener('click', function (e) {
        e.preventDefault();
        e.stopPropagation();
        instance.toggle();
      });
    }

    // Keyboard on trigger
    triggerEl.addEventListener('keydown', function (e) {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        openInstance(instance);
        // Focus first item
        setTimeout(function () { focusFirstItem(instance); }, 50);
      } else if (e.key === 'ArrowDown') {
        e.preventDefault();
        openInstance(instance);
        setTimeout(function () { focusFirstItem(instance); }, 50);
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        openInstance(instance);
        setTimeout(function () { focusLastItem(instance); }, 50);
      }
    });

    // Bind item + footer events
    bindItemEvents(instance);
    bindFooterEvents(instance);

    // Keyboard on dropdown
    dropdownEl.addEventListener('keydown', function (e) {
      handleKeyboard(instance, e);
    });

    // Track scroll/resize for reposition
    var repositionHandler = function () {
      if (instance.isOpen) {
        computePosition(triggerEl, dropdownEl, instance.currentPlacement);
      }
    };
    window.addEventListener('scroll', repositionHandler, { passive: true, capture: true });
    window.addEventListener('resize', repositionHandler);
    instance._repositionHandler = repositionHandler;

    // Bind outside click for all instances (once)
    ensureGlobalHandlers();

    dispatchEvent('itws:dropdown-created', { id: id });
    log('debug', 'Dropdown created', { id: id });

    return instance;
  }

  /* ============================================================
     8. ITEM EVENTS
     ============================================================ */

  function bindItemEvents(instance) {
    var dropdownEl = instance.dropdownEl;
    var items = dropdownEl.querySelectorAll('.itws-dd-item');

    items.forEach(function (itemEl) {
      itemEl.addEventListener('click', function (e) {
        if (itemEl.classList.contains('is-disabled')) {
          e.preventDefault();
          return;
        }

        var itemId = itemEl.getAttribute('data-item-id');
        var itemData = findItem(instance, itemId);

        // Toggle checkbox/radio
        if (itemData && itemData.checkbox) {
          var newState = !itemData.selected;
          itemData.selected = newState;
          itemEl.classList.toggle('is-selected', newState);
          itemEl.setAttribute('aria-checked', newState ? 'true' : 'false');
          updateCheckIcon(itemEl, newState, false);
        } else if (itemData && itemData.radio) {
          // Uncheck all radio in group
          var group = itemData.radio;
          var allItems = dropdownEl.querySelectorAll('.itws-dd-item');
          allItems.forEach(function (el) {
            var d = findItem(instance, el.getAttribute('data-item-id'));
            if (d && d.radio === group) {
              d.selected = false;
              el.classList.remove('is-selected');
              el.setAttribute('aria-checked', 'false');
              updateCheckIcon(el, false, true);
            }
          });
          itemData.selected = true;
          itemEl.classList.add('is-selected');
          itemEl.setAttribute('aria-checked', 'true');
          updateCheckIcon(itemEl, true, true);
        }

        // Callback
        if (typeof instance.options.onSelect === 'function') {
          try {
            var result = instance.options.onSelect(itemData, e);
            if (result === false) return; // Don't close
          } catch (err) {
            log('error', 'onSelect failed', err);
          }
        }

        // Close unless it's a checkbox/radio or closeOnSelect === false
        var isCheckable = (itemData && (itemData.checkbox || itemData.radio));
        var shouldClose = instance.options.closeOnSelect !== false && !isCheckable;

        if (shouldClose) {
          closeInstance(instance);
        }
      });

      // Hover focus
      itemEl.addEventListener('mouseenter', function () {
        items.forEach(function (el) { el.classList.remove('is-focused'); });
        itemEl.classList.add('is-focused');
      });
    });
  }

  function updateCheckIcon(itemEl, selected, isRadio) {
    var checkEl = itemEl.querySelector('.itws-dd-item-check');
    if (!checkEl) return;
    if (selected) {
      if (isRadio) {
        checkEl.innerHTML = '<span style="width:8px;height:8px;border-radius:50%;background:currentColor;"></span>';
      } else {
        checkEl.innerHTML = icon('check', 14);
      }
    } else {
      checkEl.innerHTML = '';
    }
  }

  function findItem(instance, itemId) {
    if (!itemId || !instance.options.items) return null;
    for (var i = 0; i < instance.options.items.length; i++) {
      var it = instance.options.items[i];
      if (it && it.id === itemId) return it;
    }
    return null;
  }

  /* ============================================================
     9. FOOTER EVENTS
     ============================================================ */

  function bindFooterEvents(instance) {
    var footerBtns = instance.dropdownEl.querySelectorAll('[data-footer-btn]');
    footerBtns.forEach(function (btnEl) {
      btnEl.addEventListener('click', function (e) {
        var idx = parseInt(btnEl.getAttribute('data-footer-btn'), 10);
        var cfg = instance.options.footer && instance.options.footer.buttons;
        if (cfg && cfg[idx] && typeof cfg[idx].onClick === 'function') {
          try { cfg[idx].onClick(instance, e); } catch (err) {}
        }
      });
    });
  }

  /* ============================================================
     10. KEYBOARD NAV
     ============================================================ */

  function handleKeyboard(instance, e) {
    var items = Array.prototype.slice.call(
      instance.dropdownEl.querySelectorAll('.itws-dd-item:not(.is-disabled)')
    );
    if (items.length === 0) return;

    var currentIdx = items.indexOf(document.activeElement);

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      var next = currentIdx < items.length - 1 ? currentIdx + 1 : 0;
      items[next].focus();
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      var prev = currentIdx > 0 ? currentIdx - 1 : items.length - 1;
      items[prev].focus();
    } else if (e.key === 'Home') {
      e.preventDefault();
      items[0].focus();
    } else if (e.key === 'End') {
      e.preventDefault();
      items[items.length - 1].focus();
    } else if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      if (document.activeElement && document.activeElement.classList.contains('itws-dd-item')) {
        document.activeElement.click();
      }
    } else if (e.key === 'Escape') {
      e.preventDefault();
      closeInstance(instance);
      instance.triggerEl.focus();
    } else if (e.key === 'Tab') {
      // Close on Tab out
      closeInstance(instance);
    }
  }

  function focusFirstItem(instance) {
    var first = instance.dropdownEl.querySelector('.itws-dd-item:not(.is-disabled)');
    if (first) first.focus();
  }

  function focusLastItem(instance) {
    var items = instance.dropdownEl.querySelectorAll('.itws-dd-item:not(.is-disabled)');
    if (items.length > 0) items[items.length - 1].focus();
  }

  /* ============================================================
     11. OPEN / CLOSE
     ============================================================ */

  function openInstance(instance) {
    // Close any open instance first
    if (state.openInstanceId && state.openInstanceId !== instance.id) {
      var other = state.instances[state.openInstanceId];
      if (other) closeInstance(other);
    }

    if (instance.isOpen) return;

    // Match trigger width
    if (instance.options.matchTriggerWidth) {
      var triggerWidth = instance.triggerEl.getBoundingClientRect().width;
      instance.dropdownEl.style.minWidth = triggerWidth + 'px';
    }

    // Reset positioning styles to measure
    instance.dropdownEl.style.top = '0px';
    instance.dropdownEl.style.left = '0px';

    // Add to DOM class
    instance.dropdownEl.classList.add('is-open');
    instance.isOpen = true;
    state.openInstanceId = instance.id;

    instance.triggerEl.setAttribute('aria-expanded', 'true');

    // Compute position (after class is applied so dimensions are known)
    requestAnimationFrame(function () {
      computePosition(instance.triggerEl, instance.dropdownEl, instance.options.placement || 'bottom-start');
    });

    if (typeof instance.options.onOpen === 'function') {
      try { instance.options.onOpen(instance); } catch (e) {}
    }

    dispatchEvent('itws:dropdown-opened', { id: instance.id });
  }

  function closeInstance(instance) {
    if (!instance || !instance.isOpen) return;

    instance.dropdownEl.classList.remove('is-open');
    instance.isOpen = false;
    if (state.openInstanceId === instance.id) state.openInstanceId = null;

    instance.triggerEl.setAttribute('aria-expanded', 'false');

    if (typeof instance.options.onClose === 'function') {
      try { instance.options.onClose(instance); } catch (e) {}
    }

    dispatchEvent('itws:dropdown-closed', { id: instance.id });
  }

  /* ============================================================
     12. GLOBAL HANDLERS
     ============================================================ */

  function ensureGlobalHandlers() {
    if (state.globalHandlers) return;
    state.globalHandlers = true;

    // Outside click
    document.addEventListener('click', function (e) {
      if (!state.openInstanceId) return;
      var instance = state.instances[state.openInstanceId];
      if (!instance) return;

      var closeOnOutside = instance.options.closeOnOutside !== false;
      if (!closeOnOutside) return;

      var target = e.target;
      if (instance.dropdownEl.contains(target)) return;
      if (instance.triggerEl.contains(target)) return;

      closeInstance(instance);
    });

    // Esc key
    document.addEventListener('keydown', function (e) {
      if (e.key !== 'Escape') return;
      if (!state.openInstanceId) return;
      var instance = state.instances[state.openInstanceId];
      if (!instance) return;
      if (instance.options.closeOnEsc === false) return;

      closeInstance(instance);
      instance.triggerEl.focus();
    });
  }

  /* ============================================================
     13. DESTROY
     ============================================================ */

  function destroyInstance(instance) {
    if (!instance) return;

    closeInstance(instance);

    if (instance._repositionHandler) {
      window.removeEventListener('scroll', instance._repositionHandler, { capture: true });
      window.removeEventListener('resize', instance._repositionHandler);
    }

    instance.triggerEl.removeAttribute('data-dropdown-id');
    instance.triggerEl.removeAttribute('aria-haspopup');
    instance.triggerEl.removeAttribute('aria-expanded');

    if (instance.dropdownEl.parentNode) {
      instance.dropdownEl.parentNode.removeChild(instance.dropdownEl);
    }

    delete state.instances[instance.id];
    log('debug', 'Dropdown destroyed', { id: instance.id });
  }

  /* ============================================================
     14. AUTO-BIND VIA data-dropdown-trigger
     ============================================================ */

  function autoBind() {
    var triggers = document.querySelectorAll('[data-dropdown-trigger]');
    triggers.forEach(function (trigger) {
      if (trigger.getAttribute('data-dropdown-bound') === 'true') return;

      var targetId = trigger.getAttribute('data-dropdown-trigger');
      if (!targetId) return;

      var templateEl = document.getElementById(targetId);
      if (!templateEl) return;

      // Extract items from template
      var items = [];
      var itemEls = templateEl.querySelectorAll('[data-dd-item]');
      itemEls.forEach(function (el) {
        items.push({
          id: el.getAttribute('data-dd-item') || undefined,
          label: el.getAttribute('data-dd-label') || el.textContent.trim(),
          icon: el.getAttribute('data-dd-icon') || undefined,
          href: el.getAttribute('href') || undefined,
          danger: el.getAttribute('data-dd-danger') === 'true',
          disabled: el.getAttribute('data-dd-disabled') === 'true'
        });
      });

      if (items.length === 0) return;

      create({
        trigger: trigger,
        items: items,
        placement: trigger.getAttribute('data-dropdown-placement') || 'bottom-start'
      });

      trigger.setAttribute('data-dropdown-bound', 'true');
    });
  }

  /* ============================================================
     15. EXPORT
     ============================================================ */

  window.Dropdown = {
    _initialized: true,

    // Core
    create: create,
    open: function (id) {
      var inst = state.instances[id];
      if (inst) openInstance(inst);
    },
    close: function (id) {
      var inst = state.instances[id];
      if (inst) closeInstance(inst);
    },
    toggle: function (id) {
      var inst = state.instances[id];
      if (inst) inst.toggle();
    },
    closeAll: function () {
      Object.keys(state.instances).forEach(function (id) {
        var inst = state.instances[id];
        if (inst && inst.isOpen) closeInstance(inst);
      });
    },
    destroy: function (id) {
      var inst = state.instances[id];
      if (inst) destroyInstance(inst);
    },
    get: function (id) {
      return state.instances[id] || null;
    },

    // State
    isAnyOpen: function () { return !!state.openInstanceId; },
    getOpenId: function () { return state.openInstanceId; },
    count: function () { return Object.keys(state.instances).length; },

    // Bind
    autoBind: autoBind,

    // Utils
    reposition: function (id) {
      var inst = state.instances[id];
      if (inst && inst.isOpen) {
        computePosition(inst.triggerEl, inst.dropdownEl, inst.options.placement || 'bottom-start');
      }
    }
  };

  /* ============================================================
     16. AUTO-BIND ON LOAD
     ============================================================ */

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', autoBind);
  } else {
    autoBind();
  }

  /* ============================================================
     17. DEBUG LOG
     ============================================================ */

  var cfg = window.ITWS_CONFIG || {};
  if (cfg.DEBUG) {
    try {
      console.log('%c[Dropdown]', 'color: #8B5CF6; font-weight: bold;', 'System ready');
    } catch (e) {}
  }

})();
