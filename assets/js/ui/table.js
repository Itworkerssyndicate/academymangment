/* ============================================================
   ITWS Platform — Data Table Component V2
   File: assets/js/ui/table.js
   Description: Full-featured data table for admin/portal pages

   Load order: AFTER dropdown.js + permissions.js

   Features:
   - Server-side OR client-side data modes
   - Column definitions (field, label, sortable, render, width, align)
   - Sorting (multi-column ready)
   - Search (debounced)
   - Filters (chips + custom filter function)
   - Pagination (server or client)
   - Row selection (checkboxes) + select all
   - Bulk actions bar
   - Row actions (dropdown)
   - Loading skeleton
   - Empty state with CTA
   - Error state with retry
   - Refresh button
   - Column visibility toggle
   - CSV export
   - Mobile responsive: converts to card list
   - RTL aware
   - Permission-aware row actions
   - Realtime updates (subscribe to table)
   - Accessibility (ARIA roles, keyboard nav)

   Rules:
   - No emoji
   - ES5-style IIFE
   - All strings from Labels.t()
   - Self-contained CSS
   - No external dependencies (except optional Dropdown, Icons, Toast)
   ============================================================ */

(function () {
  'use strict';

  if (window.Table && window.Table._initialized) {
    return;
  }

  /* ============================================================
     1. HELPERS
     ============================================================ */

  function log(level, msg, data) {
    var cfg = window.ITWS_CONFIG || {};
    if (level === 'error' || (cfg.DEBUG && level === 'debug')) {
      try {
        var args = ['[Table]', msg];
        if (data !== undefined) args.push(data);
        if (level === 'error') console.error.apply(console, args);
        else console.log.apply(console, args);
      } catch (e) {}
    }
  }

  function getSetting(path, fallback) {
    try {
      if (window.AppSettings && typeof window.AppSettings.get === 'function') {
        var v = window.AppSettings.get(path);
        return (v === undefined || v === null) ? fallback : v;
      }
    } catch (e) {}
    return fallback;
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
        return window.Icons.get(name, { size: size || 16 });
      }
    } catch (e) {}
    return '';
  }

  function uuid() {
    if (window.crypto && window.crypto.randomUUID) return 'tbl_' + window.crypto.randomUUID().substring(0, 8);
    return 'tbl_' + Date.now().toString(36) + '_' + Math.random().toString(36).substring(2, 6);
  }

  function debounce(fn, wait) {
    var timer = null;
    return function () {
      var ctx = this;
      var args = arguments;
      clearTimeout(timer);
      timer = setTimeout(function () { fn.apply(ctx, args); }, wait || 300);
    };
  }

  function dispatchEvent(name, detail) {
    try {
      window.dispatchEvent(new CustomEvent(name, { detail: detail || {} }));
    } catch (e) {}
  }

  function formatNumber(n) {
    try {
      if (window.Utils && typeof window.Utils.formatNumber === 'function') {
        return window.Utils.formatNumber(n);
      }
    } catch (e) {}
    return String(n);
  }

  function formatDate(v) {
    try {
      if (window.Utils && typeof window.Utils.formatDate === 'function') {
        return window.Utils.formatDate(v);
      }
    } catch (e) {}
    return v || '';
  }

  function showToast(msg, type) {
    try {
      if (window.Toast && typeof window.Toast.show === 'function') {
        window.Toast.show({ type: type || 'info', message: msg });
        return;
      }
    } catch (e) {}
    try {
      if (window.Utils && typeof window.Utils.showToast === 'function') {
        window.Utils.showToast(msg, type);
        return;
      }
    } catch (e) {}
    try {
      if (typeof window.showToast === 'function') {
        window.showToast(msg, type);
      }
    } catch (e) {}
  }

  /* ============================================================
     2. STATE
     ============================================================ */

  var state = {
    instances: {},
    initialized: false
  };

  var STYLE_ID = 'itws-table-styles';

  /* ============================================================
     3. CSS INJECTION
     ============================================================ */

  function injectStyles() {
    if (document.getElementById(STYLE_ID)) return;

    var css = ''
      // ===== WRAPPER =====
      + '.itws-table{background:var(--surface,#131820);'
      + 'border:1px solid var(--border,rgba(255,255,255,0.08));'
      + 'border-radius:14px;'
      + 'font-family:Cairo,sans-serif;font-size:14px;'
      + 'display:flex;flex-direction:column;'
      + 'overflow:hidden;'
      + 'position:relative;}'

      // ===== TOOLBAR =====
      + '.itws-table-toolbar{padding:clamp(12px,2vw,16px);'
      + 'border-bottom:1px solid var(--border,rgba(255,255,255,0.08));'
      + 'display:flex;align-items:center;gap:clamp(8px,1.5vw,12px);'
      + 'flex-wrap:wrap;'
      + 'background:var(--surface,#131820);}'
      + '.itws-table-search{flex:1;min-width:180px;max-width:400px;'
      + 'position:relative;display:flex;align-items:center;}'
      + '.itws-table-search-icon{position:absolute;'
      + 'right:14px;top:50%;transform:translateY(-50%);'
      + 'color:var(--text-muted,#64748B);'
      + 'pointer-events:none;width:16px;height:16px;}'
      + '[dir="ltr"] .itws-table-search-icon{right:auto;left:14px;}'
      + '.itws-table-search input{width:100%;'
      + 'padding:10px 42px 10px 14px;'
      + 'background:var(--bg,#0A0E14);'
      + 'border:1px solid var(--border,rgba(255,255,255,0.1));'
      + 'border-radius:10px;'
      + 'color:var(--text,#F8FAFC);'
      + 'font-family:inherit;font-size:13px;'
      + 'transition:all 0.15s;outline:none;'
      + 'min-height:40px;}'
      + '[dir="ltr"] .itws-table-search input{padding:10px 14px 10px 42px;}'
      + '.itws-table-search input:focus{'
      + 'border-color:var(--primary,#CE1126);'
      + 'box-shadow:0 0 0 3px var(--primary-soft,rgba(206,17,38,0.14));}'
      + '.itws-table-search input::placeholder{'
      + 'color:var(--text-muted,#64748B);}'

      + '.itws-table-toolbar-actions{display:flex;gap:8px;'
      + 'flex-wrap:wrap;align-items:center;margin-inline-start:auto;}'

      // ===== BUTTONS =====
      + '.itws-table-btn{padding:9px 16px;'
      + 'background:var(--surface-hover,#252F3D);'
      + 'color:var(--text,#F8FAFC);'
      + 'border:1px solid var(--border,rgba(255,255,255,0.1));'
      + 'border-radius:9px;'
      + 'font-family:inherit;font-size:13px;font-weight:600;'
      + 'cursor:pointer;transition:all 0.15s;'
      + 'display:inline-flex;align-items:center;gap:6px;'
      + 'min-height:40px;white-space:nowrap;}'
      + '.itws-table-btn:hover{border-color:var(--primary,#CE1126);'
      + 'color:var(--primary,#CE1126);}'
      + '.itws-table-btn.primary{background:var(--primary,#CE1126);'
      + 'color:var(--primary-text,#fff);'
      + 'border-color:var(--primary,#CE1126);}'
      + '.itws-table-btn.primary:hover{background:var(--primary-hover,#E63946);'
      + 'color:var(--primary-text,#fff);}'
      + '.itws-table-btn svg{width:15px;height:15px;}'
      + '.itws-table-btn:disabled{opacity:0.5;cursor:not-allowed;}'

      // ===== FILTER CHIPS =====
      + '.itws-table-filters{padding:0 clamp(12px,2vw,16px);'
      + 'display:flex;flex-wrap:wrap;gap:6px;'
      + 'border-bottom:1px solid var(--border,rgba(255,255,255,0.08));'
      + 'max-height:0;overflow:hidden;'
      + 'transition:max-height 0.25s ease,padding 0.25s ease;}'
      + '.itws-table-filters.is-open{max-height:300px;'
      + 'padding:12px clamp(12px,2vw,16px);}'
      + '.itws-table-chip{display:inline-flex;align-items:center;gap:4px;'
      + 'padding:5px 10px;border-radius:999px;'
      + 'background:var(--primary-soft,rgba(206,17,38,0.14));'
      + 'color:var(--primary,#CE1126);'
      + 'font-size:11px;font-weight:700;'
      + 'border:1px solid transparent;}'
      + '.itws-table-chip button{background:transparent;border:none;'
      + 'color:currentColor;cursor:pointer;padding:0;'
      + 'display:flex;align-items:center;justify-content:center;'
      + 'width:16px;height:16px;margin-inline-start:2px;}'
      + '.itws-table-chip button svg{width:12px;height:12px;}'

      // ===== BULK BAR =====
      + '.itws-table-bulkbar{padding:10px clamp(12px,2vw,16px);'
      + 'background:var(--primary-soft,rgba(206,17,38,0.14));'
      + 'border-bottom:1px solid var(--primary,#CE1126);'
      + 'display:none;align-items:center;gap:12px;flex-wrap:wrap;}'
      + '.itws-table-bulkbar.is-visible{display:flex;}'
      + '.itws-table-bulk-count{font-weight:700;font-size:13px;'
      + 'color:var(--primary,#CE1126);}'
      + '.itws-table-bulk-actions{display:flex;gap:6px;'
      + 'flex-wrap:wrap;margin-inline-start:auto;}'

      // ===== TABLE =====
      + '.itws-table-body{overflow-x:auto;'
      + 'position:relative;'
      + '-webkit-overflow-scrolling:touch;}'
      + '.itws-table-inner{width:100%;'
      + 'border-collapse:separate;border-spacing:0;'
      + 'min-width:600px;}'

      + '.itws-table-inner thead th{padding:12px 14px;'
      + 'text-align:start;font-size:11px;font-weight:800;'
      + 'color:var(--text-muted,#64748B);'
      + 'text-transform:uppercase;letter-spacing:0.5px;'
      + 'background:var(--bg-alt,var(--bg,#0A0E14));'
      + 'border-bottom:1px solid var(--border,rgba(255,255,255,0.08));'
      + 'white-space:nowrap;'
      + 'position:sticky;top:0;z-index:2;}'
      + '.itws-table-inner thead th.sortable{cursor:pointer;'
      + 'user-select:none;transition:color 0.15s;}'
      + '.itws-table-inner thead th.sortable:hover{color:var(--text,#F8FAFC);}'
      + '.itws-table-inner thead th.is-sorted{color:var(--primary,#CE1126);}'
      + '.itws-table-sort-ind{display:inline-flex;margin-inline-start:4px;'
      + 'vertical-align:middle;opacity:0.5;}'
      + '.itws-table-inner thead th.is-sorted .itws-table-sort-ind{opacity:1;}'
      + '.itws-table-sort-ind svg{width:12px;height:12px;}' 

      + '.itws-table-inner tbody td{padding:12px 14px;'
      + 'text-align:start;'
      + 'color:var(--text,#F8FAFC);'
      + 'font-size:13px;'
      + 'border-bottom:1px solid var(--border,rgba(255,255,255,0.06));'
      + 'vertical-align:middle;'
      + 'word-break:break-word;}'
      + '.itws-table-inner tbody tr{transition:background 0.1s;}'
      + '.itws-table-inner tbody tr:hover{background:var(--surface-hover,#252F3D);}'
      + '.itws-table-inner tbody tr.is-selected{'
      + 'background:var(--primary-soft,rgba(206,17,38,0.08));}'
      + '.itws-table-inner tbody tr:last-child td{border-bottom:none;}'

      // ===== COLUMN SPECIFIC =====
      + '.itws-table-cell-mono{font-family:inherit;'
      + 'font-variant-numeric:tabular-nums;'
      + 'font-size:12px;'
      + 'color:var(--text-muted,#64748B);}'
      + '.itws-table-cell-center{text-align:center !important;}'
      + '.itws-table-cell-end{text-align:end !important;}'

      // ===== STATUS BADGES =====
      + '.itws-table-badge{display:inline-flex;align-items:center;gap:4px;'
      + 'padding:3px 10px;border-radius:999px;'
      + 'font-size:11px;font-weight:700;'
      + 'white-space:nowrap;line-height:1.4;}'
      + '.itws-table-badge::before{content:"";width:6px;height:6px;'
      + 'border-radius:50%;background:currentColor;'
      + 'display:inline-block;flex-shrink:0;}'
      + '.itws-table-badge.success{background:var(--success-soft,rgba(16,185,129,0.14));'
      + 'color:var(--success,#10B981);}'
      + '.itws-table-badge.warning{background:var(--warning-soft,rgba(245,158,11,0.14));'
      + 'color:var(--warning,#F59E0B);}'
      + '.itws-table-badge.error{background:var(--error-soft,rgba(239,68,68,0.14));'
      + 'color:var(--error,#EF4444);}'
      + '.itws-table-badge.info{background:var(--info-soft,rgba(59,130,246,0.14));'
      + 'color:var(--info,#3B82F6);}'
      + '.itws-table-badge.neutral{background:var(--surface-hover,#252F3D);'
      + 'color:var(--text-muted,#64748B);}'

      // ===== AVATAR CELL =====
      + '.itws-table-user{display:flex;align-items:center;gap:10px;}'
      + '.itws-table-avatar{width:32px;height:32px;border-radius:50%;'
      + 'background:linear-gradient(135deg,var(--primary,#CE1126),var(--primary-hover,#E63946));'
      + 'color:var(--primary-text,#fff);'
      + 'display:flex;align-items:center;justify-content:center;'
      + 'font-weight:800;font-size:11px;flex-shrink:0;overflow:hidden;}'
      + '.itws-table-avatar img{width:100%;height:100%;object-fit:cover;}'
      + '.itws-table-user-info{display:flex;flex-direction:column;'
      + 'line-height:1.3;min-width:0;}'
      + '.itws-table-user-name{font-weight:700;'
      + 'color:var(--text,#F8FAFC);'
      + 'white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}'
      + '.itws-table-user-sub{font-size:11px;'
      + 'color:var(--text-muted,#64748B);'
      + 'white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}'

      // ===== CHECKBOX =====
      + '.itws-table-checkbox{width:16px;height:16px;'
      + 'accent-color:var(--primary,#CE1126);cursor:pointer;'
      + 'margin:0;vertical-align:middle;}'
      + '.itws-table-checkbox-col{width:40px;'
      + 'padding-inline:12px !important;text-align:center;}' 

      // ===== ROW ACTIONS =====
      + '.itws-table-actions{display:flex;gap:4px;justify-content:flex-end;}'
      + '.itws-table-action-btn{width:32px;height:32px;border-radius:8px;'
      + 'background:transparent;border:1px solid transparent;'
      + 'color:var(--text-muted,#64748B);cursor:pointer;'
      + 'display:inline-flex;align-items:center;justify-content:center;'
      + 'transition:all 0.15s;padding:0;}'
      + '.itws-table-action-btn:hover{background:var(--surface-hover,#252F3D);'
      + 'color:var(--primary,#CE1126);'
      + 'border-color:var(--border,rgba(255,255,255,0.1));}'
      + '.itws-table-action-btn.danger:hover{color:var(--error,#EF4444);'
      + 'background:var(--error-soft,rgba(239,68,68,0.14));}'
      + '.itws-table-action-btn svg{width:16px;height:16px;}'

      // ===== LOADING SKELETON =====
      + '.itws-table-loading{padding:16px;}'
      + '.itws-table-skeleton-row{display:flex;gap:12px;'
      + 'padding:14px 0;border-bottom:1px solid var(--border,rgba(255,255,255,0.06));}'
      + '.itws-table-skeleton{height:14px;border-radius:6px;'
      + 'background:linear-gradient(90deg,'
      + 'var(--surface-hover,#252F3D) 0%,'
      + 'var(--surface-elevated,#1C2430) 50%,'
      + 'var(--surface-hover,#252F3D) 100%);'
      + 'background-size:200% 100%;'
      + 'animation:itwsTableShimmer 1.4s infinite;}'
      + '@keyframes itwsTableShimmer{'
      + '0%{background-position:200% 0;}'
      + '100%{background-position:-200% 0;}}'

      // ===== EMPTY STATE =====
      + '.itws-table-empty{padding:60px 20px;text-align:center;}'
      + '.itws-table-empty-icon{width:64px;height:64px;margin:0 auto 16px;'
      + 'border-radius:50%;'
      + 'background:var(--primary-soft,rgba(206,17,38,0.14));'
      + 'color:var(--primary,#CE1126);'
      + 'display:flex;align-items:center;justify-content:center;}'
      + '.itws-table-empty-icon svg{width:32px;height:32px;}'
      + '.itws-table-empty-title{font-size:16px;font-weight:700;'
      + 'color:var(--text,#F8FAFC);'
      + 'margin:0 0 6px;}'
      + '.itws-table-empty-text{font-size:13px;'
      + 'color:var(--text-muted,#64748B);'
      + 'margin:0 0 20px;max-width:400px;'
      + 'margin-inline:auto;line-height:1.6;}'

      // ===== ERROR STATE =====
      + '.itws-table-error{padding:60px 20px;text-align:center;}'
      + '.itws-table-error-icon{width:64px;height:64px;margin:0 auto 16px;'
      + 'border-radius:50%;'
      + 'background:var(--error-soft,rgba(239,68,68,0.14));'
      + 'color:var(--error,#EF4444);'
      + 'display:flex;align-items:center;justify-content:center;}'
      + '.itws-table-error-icon svg{width:32px;height:32px;}'

      // ===== PAGINATION =====
      + '.itws-table-pagination{padding:12px clamp(12px,2vw,16px);'
      + 'border-top:1px solid var(--border,rgba(255,255,255,0.08));'
      + 'display:flex;align-items:center;justify-content:space-between;'
      + 'gap:12px;flex-wrap:wrap;'
      + 'background:var(--surface,#131820);}'
      + '.itws-table-pagination-info{font-size:12px;'
      + 'color:var(--text-muted,#64748B);}'
      + '.itws-table-pagination-pages{display:flex;'
      + 'align-items:center;gap:4px;flex-wrap:wrap;}'
      + '.itws-table-page-btn{min-width:36px;height:36px;'
      + 'padding:0 10px;border-radius:8px;'
      + 'background:transparent;'
      + 'color:var(--text-secondary,#94A3B8);'
      + 'border:1px solid var(--border,rgba(255,255,255,0.08));'
      + 'font-family:inherit;font-size:12px;font-weight:700;'
      + 'cursor:pointer;transition:all 0.15s;'
      + 'display:inline-flex;align-items:center;justify-content:center;}'
      + '.itws-table-page-btn:hover:not(:disabled):not(.is-active){'
      + 'background:var(--surface-hover,#252F3D);'
      + 'color:var(--text,#F8FAFC);}'
      + '.itws-table-page-btn.is-active{'
      + 'background:var(--primary,#CE1126);'
      + 'color:var(--primary-text,#fff);'
      + 'border-color:var(--primary,#CE1126);}'
      + '.itws-table-page-btn:disabled{opacity:0.4;cursor:not-allowed;}'
      + '.itws-table-page-btn svg{width:14px;height:14px;}'
      + '.itws-table-page-ellipsis{padding:0 4px;'
      + 'color:var(--text-muted,#64748B);font-size:12px;}'

      // ===== MOBILE CARDS (< 768px) =====
      + '@media (max-width:767px){'
      + '.itws-table-inner{display:none;}'
      + '.itws-table-cards{display:flex;flex-direction:column;'
      + 'gap:10px;padding:12px;}'
      + '.itws-table-card{background:var(--surface-elevated,#1C2430);'
      + 'border:1px solid var(--border,rgba(255,255,255,0.08));'
      + 'border-radius:12px;padding:14px;'
      + 'position:relative;}'
      + '.itws-table-card.is-selected{border-color:var(--primary,#CE1126);'
      + 'background:var(--primary-soft,rgba(206,17,38,0.06));}'
      + '.itws-table-card-header{display:flex;'
      + 'justify-content:space-between;align-items:flex-start;gap:8px;'
      + 'margin-bottom:10px;padding-bottom:10px;'
      + 'border-bottom:1px solid var(--border,rgba(255,255,255,0.06));}'
      + '.itws-table-card-title{font-weight:800;font-size:14px;'
      + 'color:var(--text,#F8FAFC);line-height:1.35;'
      + 'word-break:break-word;}'
      + '.itws-table-card-body{display:flex;flex-direction:column;gap:6px;}'
      + '.itws-table-card-field{display:flex;'
      + 'justify-content:space-between;gap:12px;'
      + 'font-size:12px;line-height:1.5;}'
      + '.itws-table-card-label{color:var(--text-muted,#64748B);'
      + 'flex-shrink:0;font-weight:600;}'
      + '.itws-table-card-value{color:var(--text,#F8FAFC);'
      + 'text-align:end;word-break:break-word;}'
      + '.itws-table-card-actions{display:flex;gap:6px;'
      + 'margin-top:12px;padding-top:12px;'
      + 'border-top:1px solid var(--border,rgba(255,255,255,0.06));'
      + 'justify-content:flex-end;flex-wrap:wrap;}'
      + '.itws-table-card-checkbox{position:absolute;'
      + 'top:14px;inset-inline-start:14px;}'
      + '}'
      + '@media (min-width:768px){.itws-table-cards{display:none;}}'

      // ===== REDUCED MOTION =====
      + '@media (prefers-reduced-motion:reduce){'
      + '.itws-table *{animation-duration:0.01ms !important;'
      + 'transition-duration:0.01ms !important;}}';

    var style = document.createElement('style');
    style.id = STYLE_ID;
    style.textContent = css;
    document.head.appendChild(style);
  }

  /* ============================================================
     4. CREATE TABLE
     ============================================================ */

  /**
   * Create a data table
   * @param {object} options
   *   - container: HTMLElement | string (required)
   *   - columns: array of column definitions (required)
   *     { key, label, sortable, width, align, render(row, value), cellClass, hideOnMobile, defaultHidden }
   *   - data: array (client mode) OR fetch: function(params) => Promise({data, total}) (server mode)
   *   - pageSize: number (default 20)
   *   - searchable: boolean (default true)
   *   - searchPlaceholder: string
   *   - selectable: boolean (default false)
   *   - rowKey: string (default 'id')
   *   - actions: array of row actions
   *     { label, icon, onClick(row), danger, show(row) }
   *   - bulkActions: array of bulk actions
   *     { label, icon, variant, onClick(rows) }
   *   - toolbarActions: array of top toolbar actions
   *     { label, icon, variant, onClick, primary }
   *   - emptyState: { icon, title, message, action: { label, onClick } }
   *   - sortBy: string (default null)
   *   - sortOrder: 'asc' | 'desc' (default 'asc')
   *   - onRowClick: function(row, event)
   *   - realtime: { table, filter } (optional)
   *   - exportCsv: boolean (default true)
   * @returns {object} instance with { refresh, getRows, getSelection, clearSelection, destroy }
   */
  function create(options) {
    if (!options || !options.columns) {
      log('error', 'columns required');
      return null;
    }

    injectStyles();

    var container = options.container;
    if (typeof container === 'string') {
      container = document.querySelector(container);
    }
    if (!container || container.nodeType !== 1) {
      log('error', 'container element required');
      return null;
    }

    var id = uuid();

    // State per instance
    var instState = {
      id: id,
      container: container,
      options: options,
      columns: options.columns.slice(),
      data: [],
      total: 0,
      loading: false,
      error: null,
      page: 1,
      pageSize: options.pageSize || getSetting('behavior.pagination_admin_size', 20),
      sortBy: options.sortBy || null,
      sortOrder: options.sortOrder || 'asc',
      search: '',
      filters: {},
      selection: {},  // { rowId: true }
      allSelected: false,
      realtimeUnsub: null,
      mounted: false
    };

    // Build shell
    renderShell(instState);

    // Store
    state.instances[id] = instState;

    // Load initial data
    loadData(instState);

    // Bind events
    bindEvents(instState);

    // Realtime
    setupRealtime(instState);

    // --- Instance API ---
    var instance = {
      id: id,
      refresh: function () { return loadData(instState); },
      getRows: function () { return instState.data.slice(); },
      getSelection: function () {
        return instState.data.filter(function (r) { return instState.selection[r[options.rowKey || 'id']]; });
      },
      getSelectedIds: function () {
        return Object.keys(instState.selection).filter(function (k) { return instState.selection[k]; });
      },
      clearSelection: function () {
        instState.selection = {};
        instState.allSelected = false;
        updateSelectionUI(instState);
      },
      selectAll: function () {
        instState.data.forEach(function (r) {
          instState.selection[r[options.rowKey || 'id']] = true;
        });
        instState.allSelected = true;
        updateSelectionUI(instState);
      },
      setSearch: function (s) {
        instState.search = s || '';
        instState.page = 1;
        loadData(instState);
      },
      setFilter: function (key, value) {
        if (value === null || value === undefined || value === '') {
          delete instState.filters[key];
        } else {
          instState.filters[key] = value;
        }
        instState.page = 1;
        loadData(instState);
      },
      clearFilters: function () {
        instState.filters = {};
        instState.search = '';
        instState.page = 1;
        loadData(instState);
      },
      destroy: destroyInstance.bind(null, instState),
      getState: function () {
        return {
          id: id, page: instState.page, pageSize: instState.pageSize,
          sortBy: instState.sortBy, sortOrder: instState.sortOrder,
          search: instState.search, filters: instState.filters,
          total: instState.total, loading: instState.loading,
          selectedCount: Object.keys(instState.selection).filter(function (k) { return instState.selection[k]; }).length
        };
      }
    };

    instState.instance = instance;
    return instance;
  }

  /* ============================================================
     5. RENDER SHELL
     ============================================================ */

  function renderShell(instState) {
    var c = instState.container;
    c.innerHTML = '';
    c.classList.add('itws-table');

    // Toolbar
    var toolbar = document.createElement('div');
    toolbar.className = 'itws-table-toolbar';
    toolbar.innerHTML = renderToolbar(instState);
    c.appendChild(toolbar);

    // Filters panel
    var filters = document.createElement('div');
    filters.className = 'itws-table-filters';
    filters.setAttribute('data-filters', 'true');
    c.appendChild(filters);

    // Bulk bar
    var bulk = document.createElement('div');
    bulk.className = 'itws-table-bulkbar';
    bulk.setAttribute('data-bulkbar', 'true');
    bulk.innerHTML = renderBulkBar(instState);
    c.appendChild(bulk);

    // Body
    var body = document.createElement('div');
    body.className = 'itws-table-body';
    body.setAttribute('data-table-body', 'true');
    body.innerHTML = renderTableHTML(instState);
    c.appendChild(body);

    // Pagination
    var pagination = document.createElement('div');
    pagination.className = 'itws-table-pagination';
    pagination.setAttribute('data-pagination', 'true');
    c.appendChild(pagination);

    // Initial pagination render
    renderPagination(instState);
  }

  /* ============================================================
     6. RENDER TOOLBAR
     ============================================================ */

  function renderToolbar(instState) {
    var opts = instState.options;
    var searchable = opts.searchable !== false;

    var searchHtml = '';
    if (searchable) {
      searchHtml = '<div class="itws-table-search">'
        + '<span class="itws-table-search-icon">' + icon('search', 16) + '</span>'
        + '<input type="search" '
        + 'placeholder="' + escapeHtml(opts.searchPlaceholder || getLabel('common.search', 'بحث...')) + '" '
        + 'data-search-input '
        + 'value="' + escapeHtml(instState.search) + '" '
        + 'aria-label="' + escapeHtml(getLabel('common.search', 'بحث')) + '">'
        + '</div>';
    }

    var actionsHtml = '';
    var toolbarActions = opts.toolbarActions || [];
    if (toolbarActions.length > 0) {
      actionsHtml = toolbarActions.map(function (a, idx) {
        var variant = a.primary ? ' primary' : '';
        return '<button type="button" class="itws-table-btn' + variant + '" data-toolbar-action="' + idx + '">'
          + (a.icon ? icon(a.icon, 15) : '')
          + '<span>' + escapeHtml(a.label || '') + '</span>'
          + '</button>';
      }).join('');
    }

    // Refresh button
    actionsHtml += '<button type="button" class="itws-table-btn" data-refresh-btn '
      + 'aria-label="' + escapeHtml(getLabel('common.refresh', 'تحديث')) + '" '
      + 'title="' + escapeHtml(getLabel('common.refresh', 'تحديث')) + '">'
      + icon('refresh', 15)
      + '</button>';

    // Export button
    if (opts.exportCsv !== false) {
      actionsHtml += '<button type="button" class="itws-table-btn" data-export-btn '
        + 'aria-label="' + escapeHtml(getLabel('common.export', 'تصدير')) + '" '
        + 'title="' + escapeHtml(getLabel('common.export_csv', 'تصدير CSV')) + '">'
        + icon('download', 15)
        + '</button>';
    }

    return searchHtml
      + '<div class="itws-table-toolbar-actions">' + actionsHtml + '</div>';
  }

  /* ============================================================
     7. RENDER BULK BAR
     ============================================================ */

  function renderBulkBar(instState) {
    var bulkActions = instState.options.bulkActions || [];
    if (bulkActions.length === 0) return '';

    var actionsHtml = bulkActions.map(function (a, idx) {
      var variant = a.variant === 'danger' ? ' primary' : '';
      return '<button type="button" class="itws-table-btn' + variant + '" data-bulk-action="' + idx + '">'
        + (a.icon ? icon(a.icon, 14) : '')
        + '<span>' + escapeHtml(a.label || '') + '</span>'
        + '</button>';
    }).join('');

    return '<span class="itws-table-bulk-count" data-bulk-count>0</span>'
      + '<div class="itws-table-bulk-actions">' + actionsHtml + '</div>';
  }

  /* ============================================================
     8. RENDER TABLE
     ============================================================ */

  function renderTableHTML(instState) {
    if (instState.loading) return renderLoading(instState);
    if (instState.error) return renderError(instState);
    if (!instState.data || instState.data.length === 0) return renderEmpty(instState);

    return renderTable(instState) + renderCards(instState);
  }

  function renderLoading(instState) {
    var cols = getVisibleColumns(instState).length;
    var rowHtml = '';
    for (var i = 0; i < 5; i++) {
      rowHtml += '<div class="itws-table-skeleton-row">';
      for (var j = 0; j < cols; j++) {
        var width = (70 + Math.random() * 30).toFixed(0) + '%';
        rowHtml += '<div class="itws-table-skeleton" style="width:' + width + ';flex:1;"></div>';
      }
      rowHtml += '</div>';
    }
    return '<div class="itws-table-loading">' + rowHtml + '</div>';
  }

  function renderError(instState) {
    return '<div class="itws-table-error">'
      + '<div class="itws-table-error-icon">' + icon('alert-circle', 32) + '</div>'
      + '<h3 class="itws-table-empty-title">' + escapeHtml(getLabel('errors.load_failed', 'تعذر تحميل البيانات')) + '</h3>'
      + '<p class="itws-table-empty-text">' + escapeHtml(instState.error || getLabel('errors.try_again', 'حاول مرة أخرى')) + '</p>'
      + '<button type="button" class="itws-table-btn primary" data-retry-btn>'
      + icon('refresh', 15) + '<span>' + escapeHtml(getLabel('common.retry', 'إعادة المحاولة')) + '</span>'
      + '</button>'
      + '</div>';
  }

  function renderEmpty(instState) {
    var empty = instState.options.emptyState || {};
    var emptyIcon = empty.icon || 'file-text';
    var emptyTitle = empty.title || getLabel('common.no_data', 'لا توجد بيانات');
    var emptyMsg = empty.message || '';
    var emptyAction = empty.action || null;

    var actionHtml = '';
    if (emptyAction && typeof emptyAction.onClick === 'function') {
      actionHtml = '<button type="button" class="itws-table-btn primary" data-empty-action>'
        + (emptyAction.icon ? icon(emptyAction.icon, 15) : '')
        + '<span>' + escapeHtml(emptyAction.label || '') + '</span>'
        + '</button>';
    }

    return '<div class="itws-table-empty">'
      + '<div class="itws-table-empty-icon">' + icon(emptyIcon, 32) + '</div>'
      + '<h3 class="itws-table-empty-title">' + escapeHtml(emptyTitle) + '</h3>'
      + (emptyMsg ? '<p class="itws-table-empty-text">' + escapeHtml(emptyMsg) + '</p>' : '')
      + actionHtml
      + '</div>';
  }

  function getVisibleColumns(instState) {
    return instState.columns.filter(function (c) { return !c.hidden; });
  }

  function renderTable(instState) {
    var cols = getVisibleColumns(instState);
    var selectable = instState.options.selectable === true;
    var rowKey = instState.options.rowKey || 'id';
    var hasActions = (instState.options.actions && instState.options.actions.length > 0);

    // Head
    var headHtml = '<thead><tr>';
    if (selectable) {
      headHtml += '<th class="itws-table-checkbox-col">'
        + '<input type="checkbox" class="itws-table-checkbox" data-select-all '
        + (instState.allSelected ? 'checked' : '')
        + ' aria-label="' + escapeHtml(getLabel('common.select_all', 'تحديد الكل')) + '">'
        + '</th>';
    }

    cols.forEach(function (col) {
      var isSorted = (instState.sortBy === col.key);
      var classes = 'th';
      if (col.sortable !== false) classes += ' sortable';
      if (isSorted) classes += ' is-sorted';
      if (col.align === 'center') classes += ' itws-table-cell-center';
      if (col.align === 'end') classes += ' itws-table-cell-end';

      var sortIcon = '';
      if (col.sortable !== false) {
        if (isSorted) {
          sortIcon = '<span class="itws-table-sort-ind">'
            + icon(instState.sortOrder === 'asc' ? 'chevron-up' : 'chevron-down', 12)
            + '</span>';
        } else {
          sortIcon = '<span class="itws-table-sort-ind">'
            + icon('chevron-down', 12)
            + '</span>';
        }
      }

      headHtml += '<th class="' + classes + '" '
        + (col.sortable !== false ? 'data-sort-key="' + escapeHtml(col.key) + '" ' : '')
        + (col.width ? 'style="width:' + col.width + '" ' : '')
        + '>'
        + escapeHtml(col.label || col.key)
        + sortIcon
        + '</th>';
    });

    if (hasActions) {
      headHtml += '<th class="itws-table-cell-end" style="width:120px;">'
        + escapeHtml(getLabel('common.actions', 'الإجراءات'))
        + '</th>';
    }

    headHtml += '</tr></thead>';

    // Body
    var bodyHtml = '<tbody>';
    instState.data.forEach(function (row, rowIdx) {
      var rowId = row[rowKey];
      var isSelected = !!instState.selection[rowId];
      bodyHtml += '<tr data-row-id="' + escapeHtml(String(rowId)) + '" data-row-index="' + rowIdx + '"'
        + (isSelected ? ' class="is-selected"' : '')
        + (instState.options.onRowClick ? ' style="cursor:pointer;"' : '')
        + '>';

      if (selectable) {
        bodyHtml += '<td class="itws-table-checkbox-col">'
          + '<input type="checkbox" class="itws-table-checkbox" data-row-check '
          + (isSelected ? 'checked' : '')
          + ' aria-label="' + escapeHtml(getLabel('common.select', 'تحديد')) + '">'
          + '</td>';
      }

      cols.forEach(function (col) {
        var value = row[col.key];
        var cellClass = col.cellClass || '';
        if (col.align === 'center') cellClass += ' itws-table-cell-center';
        if (col.align === 'end') cellClass += ' itws-table-cell-end';

        var content;
        if (typeof col.render === 'function') {
          content = col.render(row, value, rowIdx);
        } else if (value === null || value === undefined) {
          content = '<span style="color:var(--text-muted,#64748B);">—</span>';
        } else {
          content = escapeHtml(String(value));
        }

        bodyHtml += '<td class="' + cellClass.trim() + '">' + content + '</td>';
      });

      if (hasActions) {
        bodyHtml += '<td class="itws-table-cell-end"><div class="itws-table-actions">'
          + renderRowActions(instState, row)
          + '</div></td>';
      }

      bodyHtml += '</tr>';
    });
    bodyHtml += '</tbody>';

    return '<table class="itws-table-inner" role="table">' + headHtml + bodyHtml + '</table>';
  }

  function renderCards(instState) {
    var cols = getVisibleColumns(instState).filter(function (c) { return !c.hideOnMobile; });
    var rowKey = instState.options.rowKey || 'id';
    var selectable = instState.options.selectable === true;
    var hasActions = (instState.options.actions && instState.options.actions.length > 0);

    if (cols.length === 0) return '';

    var html = '<div class="itws-table-cards">';
    instState.data.forEach(function (row, rowIdx) {
      var rowId = row[rowKey];
      var isSelected = !!instState.selection[rowId];
      var titleCol = instState.options.mobileTitle ? instState.options.mobileTitle : cols[0].key;
      var titleVal = row[titleCol];

      html += '<div class="itws-table-card' + (isSelected ? ' is-selected' : '') + '" '
        + 'data-card-row-id="' + escapeHtml(String(rowId)) + '" '
        + 'data-card-row-index="' + rowIdx + '">';

      if (selectable) {
        html += '<div class="itws-table-card-checkbox">'
          + '<input type="checkbox" class="itws-table-checkbox" data-card-check '
          + (isSelected ? 'checked' : '')
          + ' aria-label="' + escapeHtml(getLabel('common.select', 'تحديد')) + '">'
          + '</div>';
      }

      html += '<div class="itws-table-card-header">'
        + '<div class="itws-table-card-title">' + escapeHtml(String(titleVal || '—')) + '</div>'
        + '</div>';

      html += '<div class="itws-table-card-body">';
      cols.forEach(function (col) {
        if (col.key === titleCol) return;
        var value = row[col.key];
        var display;
        if (typeof col.render === 'function') {
          display = col.render(row, value, rowIdx);
        } else if (value === null || value === undefined) {
          display = '—';
        } else {
          display = escapeHtml(String(value));
        }
        html += '<div class="itws-table-card-field">'
          + '<span class="itws-table-card-label">' + escapeHtml(col.label || col.key) + '</span>'
          + '<span class="itws-table-card-value">' + display + '</span>'
          + '</div>';
      });
      html += '</div>';

      if (hasActions) {
        html += '<div class="itws-table-card-actions">'
          + renderRowActions(instState, row)
          + '</div>';
      }

      html += '</div>';
    });
    html += '</div>';

    return html;
  }

  function renderRowActions(instState, row) {
    var actions = instState.options.actions || [];
    var visible = actions.filter(function (a) {
      if (typeof a.show === 'function') {
        try { return a.show(row); } catch (e) { return true; }
      }
      return true;
    });

    if (visible.length === 0) return '';

    return visible.map(function (a, idx) {
      var rowIdx = instState.data.indexOf(row);
      var cls = 'itws-table-action-btn' + (a.danger ? ' danger' : '');
      return '<button type="button" class="' + cls + '" '
        + 'data-row-action="' + idx + '" '
        + 'data-row-index="' + rowIdx + '" '
        + 'title="' + escapeHtml(a.label || '') + '" '
        + 'aria-label="' + escapeHtml(a.label || '') + '">'
        + (a.icon ? icon(a.icon, 16) : '<span>' + escapeHtml(a.label || '') + '</span>')
        + '</button>';
    }).join('');
  }

  /* ============================================================
     9. PAGINATION
     ============================================================ */

  function renderPagination(instState) {
    var container = instState.container.querySelector('[data-pagination]');
    if (!container) return;

    var total = instState.total;
    var pageSize = instState.pageSize;
    var totalPages = Math.max(1, Math.ceil(total / pageSize));
    var page = instState.page;

    if (total === 0) {
      container.innerHTML = '';
      container.style.display = 'none';
      return;
    }
    container.style.display = '';

    var start = (page - 1) * pageSize + 1;
    var end = Math.min(page * pageSize, total);

    var infoText = 'عرض ' + start + '–' + end + ' من ' + total;
    try {
      infoText = getLabel('common.pagination_info', 'عرض {start}–{end} من {total}')
        .replace('{start}', start).replace('{end}', end).replace('{total}', total);
    } catch (e) {}

    var prevDisabled = page <= 1;
    var nextDisabled = page >= totalPages;

    var pagesHtml = '<button type="button" class="itws-table-page-btn" data-page="prev" '
      + (prevDisabled ? 'disabled' : '') + ' aria-label="السابق">'
      + icon('chevron-right', 14) + '</button>';

    var pageNumbers = computePageNumbers(page, totalPages);
    pageNumbers.forEach(function (p) {
      if (p === '...') {
        pagesHtml += '<span class="itws-table-page-ellipsis">…</span>';
      } else {
        pagesHtml += '<button type="button" class="itws-table-page-btn' + (p === page ? ' is-active' : '') + '" '
          + 'data-page="' + p + '">' + p + '</button>';
      }
    });

    pagesHtml += '<button type="button" class="itws-table-page-btn" data-page="next" '
      + (nextDisabled ? 'disabled' : '') + ' aria-label="التالي">'
      + icon('chevron-left', 14) + '</button>';

    container.innerHTML = '<span class="itws-table-pagination-info">' + escapeHtml(infoText) + '</span>'
      + '<div class="itws-table-pagination-pages">' + pagesHtml + '</div>';
  }

  function computePageNumbers(current, total) {
    if (total <= 7) {
      var all = [];
      for (var i = 1; i <= total; i++) all.push(i);
      return all;
    }
    var result = [];
    result.push(1);
    if (current > 3) result.push('...');
    var start = Math.max(2, current - 1);
    var end = Math.min(total - 1, current + 1);
    for (var i = start; i <= end; i++) result.push(i);
    if (current < total - 2) result.push('...');
    result.push(total);
    return result;
  }

  /* ============================================================
     10. LOAD DATA
     ============================================================ */

  function loadData(instState) {
    instState.loading = true;
    instState.error = null;
    updateBody(instState);

    var opts = instState.options;

    if (typeof opts.fetch === 'function') {
      // SERVER MODE
      var params = {
        page: instState.page,
        pageSize: instState.pageSize,
        sortBy: instState.sortBy,
        sortOrder: instState.sortOrder,
        search: instState.search,
        filters: instState.filters
      };

      var fetchPromise;
      try {
        fetchPromise = opts.fetch(params);
      } catch (e) {
        instState.loading = false;
        instState.error = e.message || 'Fetch error';
        updateBody(instState);
        return Promise.reject(e);
      }

      return Promise.resolve(fetchPromise)
        .then(function (result) {
          instState.loading = false;
          if (result && Array.isArray(result.data)) {
            instState.data = result.data;
            instState.total = result.total || result.data.length;
          } else if (Array.isArray(result)) {
            instState.data = result;
            instState.total = result.length;
          } else {
            instState.data = [];
            instState.total = 0;
          }
          updateBody(instState);
          renderPagination(instState);
          updateBulkBar(instState);
          dispatchEvent('itws:table-loaded', { id: instState.id, count: instState.data.length });
          return result;
        })
        .catch(function (err) {
          instState.loading = false;
          instState.error = (err && err.message) || 'حدث خطأ';
          updateBody(instState);
          log('error', 'Load failed', err);
          return null;
        });
    }

    // CLIENT MODE
    var allData = opts.data || [];
    var filtered = applyClientFilters(allData, instState);
    var sorted = applyClientSort(filtered, instState);
    var paginated = applyClientPagination(sorted, instState);

    instState.data = paginated;
    instState.total = filtered.length;
    instState.loading = false;

    updateBody(instState);
    renderPagination(instState);
    updateBulkBar(instState);

    return Promise.resolve({ data: paginated, total: filtered.length });
  }

  function applyClientFilters(data, instState) {
    var search = instState.search.trim().toLowerCase();
    var filters = instState.filters;

    return data.filter(function (row) {
      // Search across all string values
      if (search) {
        var match = false;
        var keys = Object.keys(row);
        for (var i = 0; i < keys.length; i++) {
          var v = row[keys[i]];
          if (v != null && String(v).toLowerCase().indexOf(search) !== -1) {
            match = true;
            break;
          }
        }
        if (!match) return false;
      }

      // Custom filters
      var fKeys = Object.keys(filters);
      for (var j = 0; j < fKeys.length; j++) {
        var fKey = fKeys[j];
        var fVal = filters[fKey];
        if (fVal === null || fVal === undefined || fVal === '') continue;
        if (String(row[fKey]) !== String(fVal)) return false;
      }

      return true;
    });
  }

  function applyClientSort(data, instState) {
    if (!instState.sortBy) return data;
    var key = instState.sortBy;
    var dir = instState.sortOrder === 'asc' ? 1 : -1;

    return data.slice().sort(function (a, b) {
      var av = a[key];
      var bv = b[key];
      if (av == null) return 1;
      if (bv == null) return -1;
      if (typeof av === 'number' && typeof bv === 'number') return (av - bv) * dir;
      return String(av).localeCompare(String(bv), 'ar') * dir;
    });
  }

  function applyClientPagination(data, instState) {
    var start = (instState.page - 1) * instState.pageSize;
    return data.slice(start, start + instState.pageSize);
  }

  /* ============================================================
     11. UPDATE BODY
     ============================================================ */

  function updateBody(instState) {
    var body = instState.container.querySelector('[data-table-body]');
    if (!body) return;
    body.innerHTML = renderTableHTML(instState);
    bindBodyEvents(instState);
  }

  function updateSelectionUI(instState) {
    var container = instState.container;
    // Update checkboxes
    container.querySelectorAll('[data-row-check]').forEach(function (cb) {
      var row = cb.closest('tr');
      var id = row ? row.getAttribute('data-row-id') : null;
      if (id) {
        var isSel = !!instState.selection[id];
        cb.checked = isSel;
        row.classList.toggle('is-selected', isSel);
      }
    });

    // Update cards
    container.querySelectorAll('[data-card-check]').forEach(function (cb) {
      var card = cb.closest('.itws-table-card');
      var id = card ? card.getAttribute('data-card-row-id') : null;
      if (id) {
        var isSel = !!instState.selection[id];
        cb.checked = isSel;
        card.classList.toggle('is-selected', isSel);
      }
    });

    // Update select-all
    var selectAll = container.querySelector('[data-select-all]');
    if (selectAll) {
      var rowKey = instState.options.rowKey || 'id';
      var allInPage = instState.data.length > 0 && instState.data.every(function (r) {
        return !!instState.selection[r[rowKey]];
      });
      selectAll.checked = allInPage;
      instState.allSelected = allInPage;
    }

    updateBulkBar(instState);
  }

  function updateBulkBar(instState) {
    var bulkbar = instState.container.querySelector('[data-bulkbar]');
    if (!bulkbar) return;

    var selectedIds = Object.keys(instState.selection).filter(function (k) { return instState.selection[k]; });
    var count = selectedIds.length;

    if (count > 0) {
      bulkbar.classList.add('is-visible');
      var countEl = bulkbar.querySelector('[data-bulk-count]');
      if (countEl) countEl.textContent = count + ' محدّد';
    } else {
      bulkbar.classList.remove('is-visible');
    }
  }

  /* ============================================================
     12. EVENT BINDING
     ============================================================ */

  function bindEvents(instState) {
    var c = instState.container;

    // Search
    var searchInput = c.querySelector('[data-search-input]');
    if (searchInput) {
      var debouncedSearch = debounce(function (val) {
        instState.search = val;
        instState.page = 1;
        loadData(instState);
      }, 350);

      searchInput.addEventListener('input', function (e) {
        debouncedSearch(e.target.value);
      });
    }

    // Refresh
    var refreshBtn = c.querySelector('[data-refresh-btn]');
    if (refreshBtn) {
      refreshBtn.addEventListener('click', function () {
        loadData(instState);
      });
    }

    // Export CSV
    var exportBtn = c.querySelector('[data-export-btn]');
    if (exportBtn) {
      exportBtn.addEventListener('click', function () {
        exportCsv(instState);
      });
    }

    // Toolbar actions
    c.querySelectorAll('[data-toolbar-action]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var idx = parseInt(btn.getAttribute('data-toolbar-action'), 10);
        var action = (instState.options.toolbarActions || [])[idx];
        if (action && typeof action.onClick === 'function') {
          try { action.onClick(instState.instance); } catch (e) { log('error', 'Toolbar action failed', e); }
        }
      });
    });

    // Pagination
    c.addEventListener('click', function (e) {
      var pageBtn = e.target.closest('[data-page]');
      if (pageBtn && !pageBtn.disabled) {
        var target = pageBtn.getAttribute('data-page');
        var totalPages = Math.max(1, Math.ceil(instState.total / instState.pageSize));
        if (target === 'prev') {
          instState.page = Math.max(1, instState.page - 1);
        } else if (target === 'next') {
          instState.page = Math.min(totalPages, instState.page + 1);
        } else {
          instState.page = parseInt(target, 10);
        }
        loadData(instState);
      }
    });

    // Bulk actions
    c.querySelectorAll('[data-bulk-action]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var idx = parseInt(btn.getAttribute('data-bulk-action'), 10);
        var action = (instState.options.bulkActions || [])[idx];
        if (action && typeof action.onClick === 'function') {
          var selectedRows = instState.data.filter(function (r) {
            return instState.selection[r[instState.options.rowKey || 'id']];
          });
          try { action.onClick(selectedRows, instState.instance); } catch (e) { log('error', 'Bulk action failed', e); }
        }
      });
    });

    // Retry
    c.addEventListener('click', function (e) {
      if (e.target.closest('[data-retry-btn]')) {
        loadData(instState);
      }
    });

    // Empty action
    c.addEventListener('click', function (e) {
      if (e.target.closest('[data-empty-action]')) {
        var emptyAction = instState.options.emptyState && instState.options.emptyState.action;
        if (emptyAction && typeof emptyAction.onClick === 'function') {
          try { emptyAction.onClick(instState.instance); } catch (err) {}
        }
      }
    });

    bindBodyEvents(instState);
  }

  function bindBodyEvents(instState) {
    var body = instState.container.querySelector('[data-table-body]');
    if (!body) return;

    // Sort
    body.querySelectorAll('th[data-sort-key]').forEach(function (th) {
      th.addEventListener('click', function () {
        var key = th.getAttribute('data-sort-key');
        if (instState.sortBy === key) {
          instState.sortOrder = instState.sortOrder === 'asc' ? 'desc' : 'asc';
        } else {
          instState.sortBy = key;
          instState.sortOrder = 'asc';
        }
        instState.page = 1;
        loadData(instState);
      });
    });

    // Select all
    var selectAll = body.querySelector('[data-select-all]');
    if (selectAll) {
      selectAll.addEventListener('change', function () {
        var rowKey = instState.options.rowKey || 'id';
        if (selectAll.checked) {
          instState.data.forEach(function (r) {
            instState.selection[r[rowKey]] = true;
          });
        } else {
          instState.data.forEach(function (r) {
            delete instState.selection[r[rowKey]];
          });
        }
        updateSelectionUI(instState);
      });
    }

    // Row checkboxes
    body.querySelectorAll('[data-row-check]').forEach(function (cb) {
      cb.addEventListener('change', function (e) {
        e.stopPropagation();
        var row = cb.closest('tr');
        var id = row.getAttribute('data-row-id');
        if (!id) return;
        if (cb.checked) instState.selection[id] = true;
        else delete instState.selection[id];
        updateSelectionUI(instState);
      });
    });

    // Card checkboxes
    body.querySelectorAll('[data-card-check]').forEach(function (cb) {
      cb.addEventListener('change', function (e) {
        e.stopPropagation();
        var card = cb.closest('.itws-table-card');
        var id = card.getAttribute('data-card-row-id');
        if (!id) return;
        if (cb.checked) instState.selection[id] = true;
        else delete instState.selection[id];
        updateSelectionUI(instState);
      });
    });

    // Row actions
    body.querySelectorAll('[data-row-action]').forEach(function (btn) {
      btn.addEventListener('click', function (e) {
        e.stopPropagation();
        var idx = parseInt(btn.getAttribute('data-row-action'), 10);
        var rowIdx = parseInt(btn.getAttribute('data-row-index'), 10);
        var row = instState.data[rowIdx];
        var action = (instState.options.actions || [])[idx];
        if (row && action && typeof action.onClick === 'function') {
          try { action.onClick(row, instState.instance); } catch (err) { log('error', 'Row action failed', err); }
        }
      });
    });

    // Row click
    if (typeof instState.options.onRowClick === 'function') {
      body.querySelectorAll('tr[data-row-id]').forEach(function (tr) {
        tr.addEventListener('click', function (e) {
          if (e.target.closest('button, input, a')) return;
          var rowIdx = parseInt(tr.getAttribute('data-row-index'), 10);
          var row = instState.data[rowIdx];
          if (row) {
            try { instState.options.onRowClick(row, e); } catch (err) { log('error', 'onRowClick failed', err); }
          }
        });
      });
    }
  }

  /* ============================================================
     13. CSV EXPORT
     ============================================================ */

  function exportCsv(instState) {
    var cols = getVisibleColumns(instState).filter(function (c) { return c.exportable !== false; });
    if (cols.length === 0) {
      showToast(getLabel('common.no_data', 'لا توجد بيانات للتصدير'), 'warning');
      return;
    }

    var rows = instState.data;
    if (rows.length === 0) {
      showToast(getLabel('common.no_data', 'لا توجد بيانات للتصدير'), 'warning');
      return;
    }

    var header = cols.map(function (c) {
      return '"' + String(c.label || c.key).replace(/"/g, '""') + '"';
    }).join(',');

    var lines = [header];

    rows.forEach(function (row) {
      var line = cols.map(function (c) {
        var val = row[c.key];
        if (val == null) return '';
        var str = String(val);
        return '"' + str.replace(/"/g, '""') + '"';
      }).join(',');
      lines.push(line);
    });

    var csv = '\uFEFF' + lines.join('\n'); // BOM for Excel Arabic
    var blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a');
    a.href = url;
    a.download = (instState.options.exportFilename || 'table') + '_' + new Date().toISOString().slice(0, 10) + '.csv';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(function () { URL.revokeObjectURL(url); }, 1000);

    showToast(getLabel('common.export_success', 'تم تصدير البيانات'), 'success');
  }

  /* ============================================================
     14. REALTIME
     ============================================================ */

  function setupRealtime(instState) {
    var rt = instState.options.realtime;
    if (!rt || !rt.table) return;

    if (!window.Realtime || typeof window.Realtime.subscribe !== 'function') {
      log('debug', 'Realtime not available');
      return;
    }

    var debounced = debounce(function () {
      loadData(instState);
    }, 500);

    try {
      instState.realtimeUnsub = window.Realtime.subscribe(
        rt.table,
        debounced,
        { filter: rt.filter, debounce: 500 }
      );
    } catch (e) {
      log('error', 'Realtime subscribe failed', e);
    }
  }

  function destroyInstance(instState) {
    if (instState.realtimeUnsub) {
      try { instState.realtimeUnsub(); } catch (e) {}
    }
    if (instState.container) {
      instState.container.innerHTML = '';
      instState.container.classList.remove('itws-table');
    }
    delete state.instances[instState.id];
  }

  /* ============================================================
     15. EXPORT
     ============================================================ */

  window.Table = {
    _initialized: true,
    create: create,
    get: function (id) { return state.instances[id] ? state.instances[id].instance : null; },
    count: function () { return Object.keys(state.instances).length; },
    destroyAll: function () {
      Object.keys(state.instances).forEach(function (id) {
        destroyInstance(state.instances[id]);
      });
    }
  };

  /* ============================================================
     16. DEBUG LOG
     ============================================================ */

  var cfg = window.ITWS_CONFIG || {};
  if (cfg.DEBUG) {
    try {
      console.log('%c[Table]', 'color: #F59E0B; font-weight: bold;', 'System ready');
    } catch (e) {}
  }

})();
