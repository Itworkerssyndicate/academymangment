/* ============================================================
   ITWS Platform — Official Header V4 (100% ES5-safe)
   File: assets/js/ui/header.js
   
   ⚠️ NO optional chaining (?.), NO nullish coalescing (??),
      NO arrow functions, NO template literals, NO const/let
   
   ⚠️ Renders IMMEDIATELY — even if Supabase fails
   🎨 Official Egyptian design (Navy + Gold + Red + Cairo)
   ============================================================ */

(function () {
  'use strict';

  if (window.Header && window.Header._initialized) return;

  /* ============================================================
     1. STATE
     ============================================================ */

  var state = {
    _initialized: true,
    mounted: false,
    containerId: null,
    rootEl: null,
    profile: null,
    user: null,
    mobileOpen: false,
    userMenuOpen: false,
    unreadCount: 0,
    notifications: [],
    settingsUnsub: null,
    authHandler: null,
    documentClickHandler: null,
    escapeHandler: null,
    scrollHandler: null
  };

  /* ============================================================
     2. HELPERS
     ============================================================ */

  function log(level, msg, data) {
    var cfg = window.ITWS_CONFIG || {};
    if (level === 'error' || (cfg.DEBUG && level === 'debug')) {
      try {
        var args = ['[Header]', msg];
        if (data !== undefined) args.push(data);
        if (level === 'error') console.error.apply(console, args);
        else console.log.apply(console, args);
      } catch (e) {}
    }
  }

  function getSb() {
    return window.sb || window.supabaseClient || window.ITWS_SUPABASE || null;
  }

  function getSetting(path, fallback) {
    try {
      if (window.AppSettings && typeof window.AppSettings.get === 'function') {
        var v = window.AppSettings.get(path);
        if (v !== undefined && v !== null) return v;
      }
    } catch (e) {}
    try {
      if (typeof window.getSettingDefault === 'function') {
        var d = window.getSettingDefault(path);
        if (d !== undefined && d !== null) return d;
      }
    } catch (e) {}
    return fallback;
  }

  function getLabel(key, fallback) {
    try {
      if (window.Labels && typeof window.Labels.t === 'function') {
        var v = window.Labels.t(key);
        if (v && v !== key) return v;
      }
    } catch (e) {}
    return fallback;
  }

  function resolve(path) {
    if (!path) return '#';
    if (window.resolveUrl) return window.resolveUrl(path);
    var base = (window.ITWS_CONFIG && window.ITWS_CONFIG.BASE_PATH) || '/';
    if (base.charAt(base.length - 1) !== '/') base += '/';
    return base + String(path).replace(/^\.?\//, '');
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

  function $(id) {
    return document.getElementById(id);
  }

  function dispatchEvent(name, detail) {
    try {
      window.dispatchEvent(new CustomEvent(name, { detail: detail || {} }));
    } catch (e) {}
  }

  /* ============================================================
     3. ICONS — fallback inline SVG (ES5-safe)
     ============================================================ */

  var ICONS = {
    menu: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="18" x2="21" y2="18"/></svg>',
    x: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>',
    chevronDown: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><polyline points="6 9 12 15 18 9"/></svg>',
    chevronLeft: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><polyline points="15 18 9 12 15 6"/></svg>',
    bell: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg>',
    palette: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="4" fill="currentColor" stroke="none"/></svg>',
    logIn: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4"/><polyline points="10 17 15 12 10 7"/><line x1="15" y1="12" x2="3" y2="12"/></svg>',
    logOut: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>',
    user: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>',
    home: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>',
    badgeCheck: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M12 2l2.4 2.4h3.2v3.2L20 10l-2.4 2.4v3.2h-3.2L12 18l-2.4-2.4H6.4v-3.2L4 10l2.4-2.4V4.4h3.2z"/><polyline points="8.5 10.5 11 13 15.5 8.5"/></svg>',
    graduationCap: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M22 10v6M2 10l10-5 10 5-10 5z"/><path d="M6 12v5c3 3 9 3 12 0v-5"/></svg>',
    briefcase: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><rect x="2" y="7" width="20" height="14" rx="2" ry="2"/><path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"/></svg>',
    clock: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>',
    checkCircle: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>',
    alertTriangle: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>',
    alertCircle: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>',
    info: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>',
    certificate: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><rect x="3" y="4" width="18" height="14" rx="2"/><path d="M7 20h10"/><path d="M12 14v6"/><circle cx="12" cy="9" r="2"/></svg>'
  };

  function icon(name, size) {
    try {
      if (window.Icons && typeof window.Icons.get === 'function') {
        var s = window.Icons.get(name, { size: size || 20 });
        if (s) return s;
      }
    } catch (e) {}
    return ICONS[name] || ICONS.info;
  }

  /* ============================================================
     4. CSS INJECTION
     ============================================================ */

  var STYLE_ID = 'itws-header-official-styles';

  function injectStyles() {
    if (document.getElementById(STYLE_ID)) return;

    var css = '';

    /* Root fallbacks */
    css += ':root{';
    css += '--itws-navy:#0A1628;';
    css += '--itws-navy-alt:#0F1E33;';
    css += '--itws-navy-surface:#142540;';
    css += '--itws-gold:#D4A843;';
    css += '--itws-gold-soft:rgba(212,168,67,0.15);';
    css += '--itws-red:#C8102E;';
    css += '--itws-red-hover:#A50D26;';
    css += '--itws-text:#F5F3EE;';
    css += '--itws-text-secondary:#B8C4D6;';
    css += '--itws-text-muted:#7A8BA5;';
    css += '--itws-border:rgba(255,255,255,0.08);';
    css += '--itws-border-strong:rgba(255,255,255,0.15);';
    css += '}';

    /* Header shell */
    css += '.itws-header{position:sticky;top:0;z-index:900;background:var(--itws-navy,#0A1628);border-bottom:2px solid var(--itws-gold,#D4A843);box-shadow:0 2px 12px rgba(0,0,0,0.3);padding-top:env(safe-area-inset-top);font-family:"Cairo","Segoe UI",sans-serif;transition:box-shadow 0.25s ease;}';
    css += '.itws-header.is-scrolled{box-shadow:0 4px 24px rgba(0,0,0,0.45);}';
    css += '.itws-header::before{content:"";position:absolute;top:0;left:0;right:0;height:1px;background:linear-gradient(90deg,transparent,var(--itws-gold,#D4A843),transparent);opacity:0.6;pointer-events:none;}';

    /* Inner */
    css += '.itws-header-inner{max-width:1280px;margin:0 auto;padding:0 clamp(14px,3vw,24px);height:76px;display:flex;align-items:center;gap:clamp(12px,2vw,20px);}';

    /* Brand */
    css += '.itws-brand{display:flex;align-items:center;gap:12px;text-decoration:none;color:inherit;min-height:52px;flex-shrink:0;transition:opacity 0.2s;}';
    css += '.itws-brand:hover{opacity:0.88;}';
    css += '.itws-brand-logo{width:clamp(42px,5.5vw,52px);height:clamp(42px,5.5vw,52px);border-radius:6px;background:linear-gradient(135deg,var(--itws-red,#C8102E),var(--itws-red-hover,#A50D26));border:2px solid var(--itws-gold,#D4A843);color:#FFFFFF;display:flex;align-items:center;justify-content:center;font-weight:800;font-size:clamp(16px,2.2vw,20px);overflow:hidden;flex-shrink:0;box-shadow:0 2px 8px rgba(200,16,46,0.4);}';
    css += '.itws-brand-logo img{width:100%;height:100%;object-fit:contain;padding:4px;background:var(--itws-navy-alt,#0F1E33);}';
    css += '.itws-brand-text{display:none;flex-direction:column;line-height:1.25;min-width:0;overflow:hidden;}';
    css += '.itws-brand-name{font-size:clamp(14px,1.7vw,17px);font-weight:800;color:var(--itws-text,#F5F3EE);letter-spacing:-0.2px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:280px;}';
    css += '.itws-brand-sub{font-size:clamp(10px,1.2vw,11.5px);font-weight:600;color:var(--itws-gold,#D4A843);letter-spacing:0.3px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:280px;margin-top:2px;}';
    css += '@media(min-width:640px){.itws-brand-text{display:flex;}}';

    /* Nav */
    css += '.itws-nav{display:none;flex:1;justify-content:center;gap:2px;}';
    css += '.itws-nav-link{position:relative;display:inline-flex;align-items:center;gap:8px;padding:10px 16px;border-radius:4px;font-family:inherit;font-size:14px;font-weight:600;color:var(--itws-text-secondary,#B8C4D6);text-decoration:none;transition:all 0.2s;white-space:nowrap;min-height:44px;letter-spacing:0.2px;}';
    css += '.itws-nav-link::after{content:"";position:absolute;bottom:2px;left:50%;right:50%;height:2px;background:var(--itws-gold,#D4A843);transition:left 0.3s,right 0.3s;border-radius:1px;}';
    css += '.itws-nav-link:hover{color:var(--itws-text,#F5F3EE);background:rgba(212,168,67,0.08);}';
    css += '.itws-nav-link:hover::after{left:16px;right:16px;}';
    css += '.itws-nav-link.is-active{color:var(--itws-gold,#D4A843);}';
    css += '.itws-nav-link.is-active::after{left:16px;right:16px;}';
    css += '@media(min-width:1024px){.itws-nav{display:flex;}}';

    /* Actions */
    css += '.itws-actions{display:flex;align-items:center;gap:6px;margin-inline-start:auto;}';
    css += '@media(min-width:1024px){.itws-actions{margin-inline-start:0;}}';

    /* Icon button */
    css += '.itws-icon-btn{width:44px;height:44px;border-radius:6px;background:transparent;border:1px solid transparent;color:var(--itws-text-secondary,#B8C4D6);cursor:pointer;display:inline-flex;align-items:center;justify-content:center;transition:all 0.2s;position:relative;padding:0;flex-shrink:0;font-family:inherit;text-decoration:none;}';
    css += '.itws-icon-btn:hover{background:rgba(212,168,67,0.1);color:var(--itws-gold,#D4A843);border-color:var(--itws-gold-soft,rgba(212,168,67,0.15));}';
    css += '.itws-icon-btn:focus-visible{outline:2px solid var(--itws-gold,#D4A843);outline-offset:2px;}';
    css += '.itws-icon-btn svg{width:20px;height:20px;}';

    /* Notif badge */
    css += '.itws-notif-badge{position:absolute;top:6px;right:6px;min-width:18px;height:18px;padding:0 5px;border-radius:999px;background:var(--itws-red,#C8102E);color:#FFFFFF;font-size:10px;font-weight:800;display:none;align-items:center;justify-content:center;line-height:1;border:2px solid var(--itws-navy,#0A1628);}';
    css += '.itws-notif-badge.is-visible{display:inline-flex;}';

    /* Login button */
    css += '.itws-login-btn{display:inline-flex;align-items:center;gap:8px;padding:10px 20px;background:var(--itws-red,#C8102E);color:#FFFFFF;border:1px solid var(--itws-red,#C8102E);border-radius:6px;font-family:inherit;font-size:13px;font-weight:700;cursor:pointer;text-decoration:none;transition:all 0.2s;min-height:44px;white-space:nowrap;letter-spacing:0.3px;box-shadow:0 2px 8px rgba(200,16,46,0.3);}';
    css += '.itws-login-btn:hover{background:var(--itws-red-hover,#A50D26);border-color:var(--itws-gold,#D4A843);transform:translateY(-1px);box-shadow:0 4px 16px rgba(212,168,67,0.4);}';
    css += '.itws-login-btn svg{width:16px;height:16px;}';

    /* User menu */
    css += '.itws-user{position:relative;}';
    css += '.itws-user-btn{display:inline-flex;align-items:center;gap:8px;padding:5px 12px 5px 6px;background:transparent;border:1px solid var(--itws-border,rgba(255,255,255,0.08));border-radius:6px;cursor:pointer;font-family:inherit;transition:all 0.2s;min-height:44px;color:var(--itws-text,#F5F3EE);}';
    css += '.itws-user-btn:hover{background:rgba(212,168,67,0.08);border-color:var(--itws-gold-soft,rgba(212,168,67,0.15));}';
    css += '.itws-user-avatar{width:32px;height:32px;border-radius:4px;background:linear-gradient(135deg,var(--itws-red,#C8102E),var(--itws-red-hover,#A50D26));border:1px solid var(--itws-gold,#D4A843);color:#FFFFFF;display:flex;align-items:center;justify-content:center;font-weight:800;font-size:12px;overflow:hidden;flex-shrink:0;}';
    css += '.itws-user-avatar img{width:100%;height:100%;object-fit:cover;}';
    css += '.itws-user-name{display:none;font-size:13px;font-weight:600;color:var(--itws-text,#F5F3EE);max-width:120px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}';
    css += '.itws-user-btn > svg{width:14px;height:14px;color:var(--itws-text-muted,#7A8BA5);transition:transform 0.2s;}';
    css += '.itws-user.is-open .itws-user-btn > svg{transform:rotate(180deg);}';
    css += '@media(min-width:640px){.itws-user-name{display:block;}}';

    /* Dropdown */
    css += '.itws-dropdown{position:absolute;top:calc(100% + 8px);left:0;min-width:min(300px,calc(100vw - 32px));max-width:calc(100vw - 32px);background:var(--itws-navy-surface,#142540);border:1px solid var(--itws-border,rgba(255,255,255,0.08));border-top:2px solid var(--itws-gold,#D4A843);border-radius:6px;box-shadow:0 20px 60px rgba(0,0,0,0.5);z-index:1000;opacity:0;transform:translateY(-4px);pointer-events:none;transition:all 0.2s;overflow:hidden;}';
    css += '.is-open > .itws-dropdown{opacity:1;transform:translateY(0);pointer-events:auto;}';
    css += '.itws-dropdown-head{padding:14px 16px;background:var(--itws-navy-alt,#0F1E33);border-bottom:1px solid var(--itws-border,rgba(255,255,255,0.08));}';
    css += '.itws-dropdown-title{font-size:13px;font-weight:800;color:var(--itws-text,#F5F3EE);margin:0 0 3px;}';
    css += '.itws-dropdown-sub{font-size:11px;color:var(--itws-text-muted,#7A8BA5);margin:0;word-break:break-all;}';
    css += '.itws-dropdown-body{padding:6px;max-height:min(420px,65vh);overflow-y:auto;overscroll-behavior:contain;}';
    css += '.itws-menu-item{display:flex;align-items:center;gap:10px;padding:11px 12px;border-radius:4px;color:var(--itws-text,#F5F3EE);font-family:inherit;font-size:13px;font-weight:500;text-decoration:none;background:transparent;border:none;cursor:pointer;transition:all 0.15s;width:100%;text-align:right;min-height:44px;}';
    css += '.itws-menu-item:hover{background:rgba(212,168,67,0.1);color:var(--itws-gold,#D4A843);}';
    css += '.itws-menu-item svg{width:16px;height:16px;flex-shrink:0;color:var(--itws-text-muted,#7A8BA5);}';
    css += '.itws-menu-item:hover svg{color:var(--itws-gold,#D4A843);}';
    css += '.itws-menu-item.danger{color:var(--itws-red,#C8102E);}';
    css += '.itws-menu-item.danger svg{color:var(--itws-red,#C8102E);}';
    css += '.itws-menu-item.danger:hover{background:rgba(200,16,46,0.12);}';
    css += '.itws-menu-sep{height:1px;background:var(--itws-border,rgba(255,255,255,0.08));margin:6px 4px;}';

    /* Notif */
    css += '.itws-notif{position:relative;}';
    css += '.itws-notif-panel .itws-dropdown-body{padding:0;}';
    css += '.itws-notif-item{display:flex;gap:12px;padding:14px 16px;border-bottom:1px solid var(--itws-border,rgba(255,255,255,0.08));text-decoration:none;color:inherit;background:transparent;transition:background 0.15s;min-height:44px;}';
    css += '.itws-notif-item:hover{background:rgba(212,168,67,0.06);}';
    css += '.itws-notif-item.unread{background:rgba(212,168,67,0.05);border-inline-start:3px solid var(--itws-gold,#D4A843);}';
    css += '.itws-notif-icon{width:36px;height:36px;border-radius:6px;background:var(--itws-gold-soft,rgba(212,168,67,0.15));color:var(--itws-gold,#D4A843);display:flex;align-items:center;justify-content:center;flex-shrink:0;}';
    css += '.itws-notif-icon svg{width:16px;height:16px;}';
    css += '.itws-notif-body{flex:1;min-width:0;}';
    css += '.itws-notif-title{font-size:13px;font-weight:700;color:var(--itws-text,#F5F3EE);margin:0 0 3px;line-height:1.4;}';
    css += '.itws-notif-text{font-size:11.5px;color:var(--itws-text-muted,#7A8BA5);margin:0;line-height:1.55;}';
    css += '.itws-notif-empty{padding:40px 20px;text-align:center;font-size:12.5px;color:var(--itws-text-muted,#7A8BA5);}';

    /* Mobile */
    css += '.itws-hamburger{display:inline-flex;}';
    css += '@media(min-width:1024px){.itws-hamburger{display:none;}}';
    css += '.itws-mobile-backdrop{position:fixed;inset:0;z-index:1500;background:rgba(10,22,40,0.75);backdrop-filter:blur(6px);opacity:0;pointer-events:none;transition:opacity 0.25s;}';
    css += '.itws-mobile-backdrop.is-open{opacity:1;pointer-events:auto;}';
    css += '.itws-mobile-drawer{position:fixed;top:0;right:0;bottom:0;width:min(340px,88vw);z-index:1501;background:var(--itws-navy,#0A1628);border-left:2px solid var(--itws-gold,#D4A843);transform:translateX(100%);transition:transform 0.3s cubic-bezier(0.4,0,0.2,1);display:flex;flex-direction:column;padding-top:env(safe-area-inset-top);padding-bottom:env(safe-area-inset-bottom);box-shadow:-8px 0 40px rgba(0,0,0,0.5);font-family:"Cairo",sans-serif;}';
    css += '.itws-mobile-drawer.is-open{transform:translateX(0);}';
    css += '.itws-mobile-head{padding:16px;border-bottom:1px solid var(--itws-border,rgba(255,255,255,0.08));display:flex;align-items:center;justify-content:space-between;gap:12px;background:var(--itws-navy-alt,#0F1E33);}';
    css += '.itws-mobile-brand{display:flex;align-items:center;gap:10px;min-width:0;}';
    css += '.itws-mobile-brand-logo{width:36px;height:36px;border-radius:4px;background:linear-gradient(135deg,var(--itws-red,#C8102E),var(--itws-red-hover,#A50D26));border:1.5px solid var(--itws-gold,#D4A843);color:#FFFFFF;display:flex;align-items:center;justify-content:center;font-weight:800;font-size:14px;flex-shrink:0;overflow:hidden;}';
    css += '.itws-mobile-brand-logo img{width:100%;height:100%;object-fit:contain;padding:3px;background:var(--itws-navy-alt,#0F1E33);}';
    css += '.itws-mobile-brand-text{display:flex;flex-direction:column;line-height:1.2;min-width:0;}';
    css += '.itws-mobile-brand-name{font-size:13px;font-weight:800;color:var(--itws-text,#F5F3EE);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}';
    css += '.itws-mobile-brand-sub{font-size:10px;font-weight:600;color:var(--itws-gold,#D4A843);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;margin-top:1px;}';
    css += '.itws-mobile-body{flex:1;overflow-y:auto;padding:12px;}';
    css += '.itws-mobile-nav-link{display:flex;align-items:center;gap:12px;padding:14px 16px;border-radius:4px;color:var(--itws-text,#F5F3EE);font-family:inherit;font-size:14px;font-weight:600;text-decoration:none;transition:all 0.2s;min-height:48px;border-inline-start:3px solid transparent;}';
    css += '.itws-mobile-nav-link:hover{background:rgba(212,168,67,0.08);}';
    css += '.itws-mobile-nav-link.is-active{color:var(--itws-gold,#D4A843);background:rgba(212,168,67,0.1);border-inline-start-color:var(--itws-gold,#D4A843);}';
    css += '.itws-mobile-foot{padding:14px;border-top:1px solid var(--itws-border,rgba(255,255,255,0.08));background:var(--itws-navy-alt,#0F1E33);}';

    /* Skip link */
    css += '.itws-skip-link{position:absolute;top:-100px;right:16px;padding:10px 16px;background:var(--itws-red,#C8102E);color:#FFFFFF;border-radius:4px;text-decoration:none;font-weight:600;font-size:13px;z-index:2000;font-family:"Cairo",sans-serif;transition:top 0.2s;}';
    css += '.itws-skip-link:focus{top:12px;}';

    /* Reduced motion */
    css += '@media (prefers-reduced-motion:reduce){.itws-header *,.itws-mobile-drawer *{animation-duration:0.01ms !important;transition-duration:0.01ms !important;}}';

    /* Print */
    css += '@media print{.itws-header,.itws-mobile-drawer,.itws-mobile-backdrop{display:none !important;}}';

    var style = document.createElement('style');
    style.id = STYLE_ID;
    style.textContent = css;
    document.head.appendChild(style);
  }

  /* ============================================================
     5. CONFIG FROM SETTINGS
     ============================================================ */

  function getNavItems() {
    var custom = getSetting('header.nav', null);
    var defaults = [
      { key: 'home',      href: 'home.html',      labelKey: 'pages.home.title',      label: 'الرئيسية',       icon: 'home',          enabled: true, order: 1 },
      { key: 'verify',    href: 'verify.html',    labelKey: 'pages.verify.title',    label: 'التحقق',         icon: 'badgeCheck',    enabled: true, order: 2 },
      { key: 'student',   href: 'student.html',   labelKey: 'pages.student.title',   label: 'صفحة المتدرب',   icon: 'graduationCap', enabled: true, order: 3 },
      { key: 'academies', href: 'academies.html', labelKey: 'pages.academies.title', label: 'الأكاديميات',    icon: 'briefcase',     enabled: true, order: 4 },
      { key: 'track',     href: 'track.html',     labelKey: 'pages.track.title',     label: 'متابعة الطلب',   icon: 'clock',         enabled: true, order: 5 }
    ];

    var items = defaults;

    if (custom && custom.length && custom.length > 0) {
      items = [];
      for (var i = 0; i < custom.length; i++) {
        var c = custom[i] || {};
        items.push({
          key: c.key || c.href || ('nav-' + i),
          href: c.href || '#',
          labelKey: c.label_key || null,
          label: c.label || '',
          icon: c.icon || 'chevronLeft',
          enabled: c.enabled !== false,
          order: (typeof c.order === 'number') ? c.order : 999
        });
      }
    }

    // Filter + sort
    var filtered = [];
    for (var j = 0; j < items.length; j++) {
      if (items[j].enabled !== false && items[j].href && items[j].href !== '#') {
        filtered.push(items[j]);
      }
    }
    filtered.sort(function (a, b) { return a.order - b.order; });

    return filtered;
  }

  function isActiveNav(item) {
    try {
      var path = window.location.pathname || '';
      var filename = path.split('/').pop() || '';
      if (!filename) filename = 'index.html';
      var target = (item.href || '').split('?')[0].split('#')[0];
      var targetName = target.split('/').pop() || '';
      return targetName === filename;
    } catch (e) { return false; }
  }

  function getUserInitials(profile) {
    if (!profile) return '?';
    var name = profile.full_name || profile.email || '';
    var parts = String(name).trim().split(/\s+/);
    if (parts.length >= 2) {
      return (parts[0].charAt(0) + parts[1].charAt(0)).toUpperCase();
    }
    return name.substring(0, 2).toUpperCase() || '?';
  }

  function getUserMenuItems() {
    var items = [];
    var role = state.profile ? state.profile.role : null;

    if (role === 'super_admin' || role === 'committee_head' || role === 'committee_deputy' || role === 'committee_member') {
      items.push({ href: 'admin/index.html', labelKey: 'nav.admin_dashboard', label: 'لوحة التحكم', icon: 'home' });
    } else if (role && role.indexOf('branch_') === 0) {
      items.push({ href: 'branch/index.html', labelKey: 'nav.branch_dashboard', label: 'بوابة الفرع', icon: 'home' });
    } else if (role === 'academy_owner' || role === 'academy_manager') {
      items.push({ href: 'portal/index.html', labelKey: 'nav.portal_dashboard', label: 'بوابة الأكاديمية', icon: 'home' });
    }

    items.push({ href: 'portal/profile.html', labelKey: 'nav.profile', label: 'الملف الشخصي', icon: 'user' });

    if (!role || role === 'user') {
      items.push({ href: 'student.html', labelKey: 'nav.my_certificates', label: 'شهاداتي', icon: 'certificate' });
    }

    return items;
  }

  /* ============================================================
     6. RENDER
     ============================================================ */

  function renderHeader() {
    var unionName = getSetting('app_identity.union_name', 'نقابة تكنولوجيا المعلومات والبرمجيات');
    var committeeName = getSetting('app_identity.committee_name', 'لجنة التحول الرقمي والتدريب');
    var logoUrl = getSetting('app_identity.logo_url', '');
    var showNotifications = getSetting('header.show_notifications', true) !== false;
    var showThemePicker = getSetting('header.show_theme_picker', true) !== false;
    var showLoginButton = getSetting('header.show_login_button', true) !== false;
    var showCommitteeName = getSetting('header.show_committee_name', true) !== false;

    var navItems = getNavItems();
    var isGuest = !state.profile;

    var logoHtml;
    if (logoUrl) {
      logoHtml = '<img src="' + escapeHtml(logoUrl) + '" alt="' + escapeHtml(unionName) + '" onerror="this.parentNode.textContent=\'ن\';">';
    } else {
      logoHtml = escapeHtml((unionName || 'ن').charAt(0));
    }

    // Desktop nav
    var navHtml = '';
    for (var i = 0; i < navItems.length; i++) {
      var item = navItems[i];
      var active = isActiveNav(item) ? ' is-active' : '';
      var label = item.labelKey ? getLabel(item.labelKey, item.label) : item.label;
      navHtml += '<a href="' + escapeHtml(resolve(item.href)) + '" class="itws-nav-link' + active + '">';
      navHtml += '<span>' + escapeHtml(label) + '</span>';
      navHtml += '</a>';
    }

    // Mobile nav
    var mobileNavHtml = '';
    for (var m = 0; m < navItems.length; m++) {
      var mItem = navItems[m];
      var mActive = isActiveNav(mItem) ? ' is-active' : '';
      var mLabel = mItem.labelKey ? getLabel(mItem.labelKey, mItem.label) : mItem.label;
      mobileNavHtml += '<a href="' + escapeHtml(resolve(mItem.href)) + '" class="itws-mobile-nav-link' + mActive + '">';
      mobileNavHtml += '<span>' + escapeHtml(mLabel) + '</span>';
      mobileNavHtml += '</a>';
    }

    // User area
    var userAreaHtml = '';
    if (isGuest) {
      if (showLoginButton) {
        userAreaHtml = '<a href="' + escapeHtml(resolve('login.html')) + '" class="itws-login-btn">'
          + icon('logIn', 16)
          + '<span>' + escapeHtml(getLabel('nav.login', 'دخول')) + '</span>'
          + '</a>';
      }
    } else {
      var initials = getUserInitials(state.profile);
      var avatarHtml = state.profile.avatar_url
        ? '<img src="' + escapeHtml(state.profile.avatar_url) + '" alt="">'
        : '<span>' + escapeHtml(initials) + '</span>';
      var displayName = state.profile.full_name || state.profile.email || '';

      var menuItems = getUserMenuItems();
      var menuHtml = '';
      for (var k = 0; k < menuItems.length; k++) {
        var mi = menuItems[k];
        menuHtml += '<a href="' + escapeHtml(resolve(mi.href)) + '" class="itws-menu-item">'
          + icon(mi.icon, 16)
          + '<span>' + escapeHtml(getLabel(mi.labelKey, mi.label)) + '</span>'
          + '</a>';
      }

      userAreaHtml = '<div class="itws-user" id="itwsUserMenu">'
        + '<button type="button" class="itws-user-btn" id="itwsUserBtn" aria-haspopup="true" aria-expanded="false">'
        +   '<span class="itws-user-avatar">' + avatarHtml + '</span>'
        +   '<span class="itws-user-name">' + escapeHtml(displayName) + '</span>'
        +   icon('chevronDown', 14)
        + '</button>'
        + '<div class="itws-dropdown">'
        +   '<div class="itws-dropdown-head">'
        +     '<p class="itws-dropdown-title">' + escapeHtml(displayName) + '</p>'
        +     '<p class="itws-dropdown-sub">' + escapeHtml(state.profile.email || '') + '</p>'
        +   '</div>'
        +   '<div class="itws-dropdown-body">'
        +     menuHtml
        +     '<div class="itws-menu-sep"></div>'
        +     '<button type="button" class="itws-menu-item danger" id="itwsLogoutBtn">'
        +       icon('logOut', 16)
        +       '<span>' + escapeHtml(getLabel('nav.logout', 'تسجيل الخروج')) + '</span>'
        +     '</button>'
        +   '</div>'
        + '</div>'
        + '</div>';
    }

    // Notifications
    var notifHtml = '';
    if (!isGuest && showNotifications) {
      notifHtml = '<div class="itws-notif" id="itwsNotifMenu">'
        + '<button type="button" class="itws-icon-btn" id="itwsNotifBtn" aria-label="' + escapeHtml(getLabel('nav.notifications', 'الإشعارات')) + '" aria-haspopup="true" aria-expanded="false">'
        +   icon('bell', 20)
        +   '<span class="itws-notif-badge' + (state.unreadCount > 0 ? ' is-visible' : '') + '" id="itwsNotifBadge">'
        +     (state.unreadCount > 99 ? '99+' : String(state.unreadCount))
        +   '</span>'
        + '</button>'
        + '<div class="itws-dropdown itws-notif-panel">'
        +   '<div class="itws-dropdown-head">'
        +     '<p class="itws-dropdown-title">' + escapeHtml(getLabel('nav.notifications', 'الإشعارات')) + '</p>'
        +   '</div>'
        +   '<div class="itws-dropdown-body" id="itwsNotifBody">'
        +     '<div class="itws-notif-empty">' + escapeHtml(getLabel('notifications.empty', 'لا توجد إشعارات')) + '</div>'
        +   '</div>'
        + '</div>'
        + '</div>';
    }

    // Theme
    var themeBtnHtml = '';
    if (showThemePicker) {
      themeBtnHtml = '<button type="button" class="itws-icon-btn" id="itwsThemeBtn" aria-label="' + escapeHtml(getLabel('nav.theme', 'تغيير الثيم')) + '">'
        + icon('palette', 20)
        + '</button>';
    }

    // Committee subtitle (conditional)
    var subtitleHtml = (showCommitteeName && committeeName)
      ? '<span class="itws-brand-sub">' + escapeHtml(committeeName) + '</span>'
      : '';

    return ''
      + '<a href="#main-content" class="itws-skip-link">' + escapeHtml(getLabel('a11y.skip_to_content', 'تخطي إلى المحتوى')) + '</a>'
      + '<header class="itws-header" id="itwsHeader" role="banner">'
      +   '<div class="itws-header-inner">'
      +     '<a href="' + escapeHtml(resolve('home.html')) + '" class="itws-brand">'
      +       '<div class="itws-brand-logo">' + logoHtml + '</div>'
      +       '<div class="itws-brand-text">'
      +         '<span class="itws-brand-name">' + escapeHtml(unionName) + '</span>'
      +         subtitleHtml
      +       '</div>'
      +     '</a>'
      +     '<nav class="itws-nav" role="navigation">' + navHtml + '</nav>'
      +     '<div class="itws-actions">'
      +       themeBtnHtml
      +       notifHtml
      +       userAreaHtml
      +       '<button type="button" class="itws-icon-btn itws-hamburger" id="itwsHamburger" aria-label="' + escapeHtml(getLabel('nav.menu', 'القائمة')) + '" aria-expanded="false">'
      +         icon('menu', 22)
      +       '</button>'
      +     '</div>'
      +   '</div>'
      + '</header>'
      + '<div class="itws-mobile-backdrop" id="itwsMobileBackdrop" aria-hidden="true"></div>'
      + '<aside class="itws-mobile-drawer" id="itwsMobileDrawer" aria-hidden="true">'
      +   '<div class="itws-mobile-head">'
      +     '<div class="itws-mobile-brand">'
      +       '<div class="itws-mobile-brand-logo">' + logoHtml + '</div>'
      +       '<div class="itws-mobile-brand-text">'
      +         '<span class="itws-mobile-brand-name">' + escapeHtml(unionName) + '</span>'
      +         (showCommitteeName && committeeName ? '<span class="itws-mobile-brand-sub">' + escapeHtml(committeeName) + '</span>' : '')
      +       '</div>'
      +     '</div>'
      +     '<button type="button" class="itws-icon-btn" id="itwsMobileClose" aria-label="إغلاق">' + icon('x', 20) + '</button>'
      +   '</div>'
      +   '<nav class="itws-mobile-body">' + mobileNavHtml + '</nav>'
      +   '<div class="itws-mobile-foot">'
      +     (isGuest
      +       ? (showLoginButton
      +         ? '<a href="' + escapeHtml(resolve('login.html')) + '" class="itws-login-btn" style="width:100%;justify-content:center;">'
      +             + icon('logIn', 16) + '<span>' + escapeHtml(getLabel('nav.login', 'دخول')) + '</span></a>'
      +         : '')
      +       : '<button type="button" class="itws-login-btn" id="itwsMobileLogout" style="width:100%;justify-content:center;background:var(--itws-red);">'
      +           + icon('logOut', 16) + '<span>' + escapeHtml(getLabel('nav.logout', 'تسجيل الخروج')) + '</span></button>')
      +   '</div>'
      + '</aside>';
  }

  /* ============================================================
     7. EVENT BINDING
     ============================================================ */

  function bindEvents() {
    var themeBtn = $('itwsThemeBtn');
    if (themeBtn) {
      themeBtn.addEventListener('click', function () {
        if (window.ITWSTheme && typeof window.ITWSTheme.openPicker === 'function') {
          try { window.ITWSTheme.openPicker(); return; } catch (e) {}
        }
        // fallback: cycle themes
        var themes = window.ITWS_THEMES || [];
        if (!themes.length) return;
        var current = (window.ITWSTheme && typeof window.ITWSTheme.getCurrent === 'function') ? window.ITWSTheme.getCurrent() : '';
        var idx = -1;
        for (var i = 0; i < themes.length; i++) { if (themes[i].id === current) { idx = i; break; } }
        var next = themes[(idx + 1) % themes.length];
        if (next && window.ITWSTheme && typeof window.ITWSTheme.change === 'function') {
          window.ITWSTheme.change(next.id);
        }
      });
    }

    var userBtn = $('itwsUserBtn');
    var userMenu = $('itwsUserMenu');
    if (userBtn && userMenu) {
      userBtn.addEventListener('click', function (e) {
        e.stopPropagation();
        var isOpen = userMenu.classList.contains('is-open');
        closeAllDropdowns();
        if (!isOpen) {
          userMenu.classList.add('is-open');
          userBtn.setAttribute('aria-expanded', 'true');
        }
      });
    }

    var logoutBtn = $('itwsLogoutBtn');
    if (logoutBtn) logoutBtn.addEventListener('click', doLogout);

    var mobileLogout = $('itwsMobileLogout');
    if (mobileLogout) mobileLogout.addEventListener('click', doLogout);

    var notifBtn = $('itwsNotifBtn');
    var notifMenu = $('itwsNotifMenu');
    if (notifBtn && notifMenu) {
      notifBtn.addEventListener('click', function (e) {
        e.stopPropagation();
        var isOpen = notifMenu.classList.contains('is-open');
        closeAllDropdowns();
        if (!isOpen) {
          notifMenu.classList.add('is-open');
          notifBtn.setAttribute('aria-expanded', 'true');
        }
      });
    }

    var hamburger = $('itwsHamburger');
    var backdrop = $('itwsMobileBackdrop');
    var drawer = $('itwsMobileDrawer');
    var closeBtn = $('itwsMobileClose');

    if (hamburger) hamburger.addEventListener('click', openMobile);
    if (backdrop) backdrop.addEventListener('click', closeMobile);
    if (closeBtn) closeBtn.addEventListener('click', closeMobile);

    if (state.documentClickHandler) {
      document.removeEventListener('click', state.documentClickHandler);
    }
    state.documentClickHandler = function (e) {
      var target = e.target;
      var insideUser = userMenu && userMenu.contains(target);
      var insideNotif = notifMenu && notifMenu.contains(target);
      if (!insideUser && !insideNotif) closeAllDropdowns();
    };
    document.addEventListener('click', state.documentClickHandler);

    if (state.escapeHandler) {
      document.removeEventListener('keydown', state.escapeHandler);
    }
    state.escapeHandler = function (e) {
      if (e.key === 'Escape') {
        closeAllDropdowns();
        closeMobile();
      }
    };
    document.addEventListener('keydown', state.escapeHandler);

    if (state.scrollHandler) {
      window.removeEventListener('scroll', state.scrollHandler);
    }
    state.scrollHandler = function () {
      var header = $('itwsHeader');
      if (!header) return;
      if (window.scrollY > 8) header.classList.add('is-scrolled');
      else header.classList.remove('is-scrolled');
    };
    window.addEventListener('scroll', state.scrollHandler, { passive: true });
    state.scrollHandler();
  }

  function openMobile() {
    var drawer = $('itwsMobileDrawer');
    var backdrop = $('itwsMobileBackdrop');
    var hamburger = $('itwsHamburger');
    if (!drawer || !backdrop) return;
    state.mobileOpen = true;
    drawer.classList.add('is-open');
    backdrop.classList.add('is-open');
    drawer.setAttribute('aria-hidden', 'false');
    if (hamburger) hamburger.setAttribute('aria-expanded', 'true');
    try { document.body.style.overflow = 'hidden'; } catch (e) {}
  }

  function closeMobile() {
    var drawer = $('itwsMobileDrawer');
    var backdrop = $('itwsMobileBackdrop');
    var hamburger = $('itwsHamburger');
    if (!drawer || !backdrop) return;
    state.mobileOpen = false;
    drawer.classList.remove('is-open');
    backdrop.classList.remove('is-open');
    drawer.setAttribute('aria-hidden', 'true');
    if (hamburger) hamburger.setAttribute('aria-expanded', 'false');
    try { document.body.style.overflow = ''; } catch (e) {}
  }

  function closeAllDropdowns() {
    var userMenu = $('itwsUserMenu');
    var notifMenu = $('itwsNotifMenu');
    var userBtn = $('itwsUserBtn');
    var notifBtn = $('itwsNotifBtn');
    if (userMenu) userMenu.classList.remove('is-open');
    if (notifMenu) notifMenu.classList.remove('is-open');
    if (userBtn) userBtn.setAttribute('aria-expanded', 'false');
    if (notifBtn) notifBtn.setAttribute('aria-expanded', 'false');
  }

  function doLogout() {
    if (state.mobileOpen) closeMobile();
    var msg = getLabel('auth.logout.confirm', 'هل تريد تسجيل الخروج؟');
    if (!window.confirm(msg)) return;
    if (window.Session && typeof window.Session.logout === 'function') {
      window.Session.logout();
      return;
    }
    var sb = getSb();
    if (!sb) { window.location.href = resolve('login.html'); return; }
    sb.auth.signOut().then(function () {
      window.location.href = resolve('login.html');
    }).catch(function () {
      window.location.href = resolve('login.html');
    });
  }

  /* ============================================================
     8. AUTH (non-blocking — background)
     ============================================================ */

  function loadAuth() {
    var sb = getSb();
    if (!sb || !sb.auth) return Promise.resolve();
    return sb.auth.getUser().then(function (res) {
      var user = res && res.data && res.data.user;
      if (!user) { state.profile = null; state.user = null; return; }
      state.user = user;
      return sb.from('profiles')
        .select('id, email, full_name, avatar_url, role, status, governorate_id, branch_id, academy_id')
        .eq('id', user.id)
        .maybeSingle()
        .then(function (r) {
          state.profile = (r && r.data) ? r.data : null;
        });
    }).catch(function () {
      state.profile = null;
      state.user = null;
    });
  }

  /* ============================================================
     9. RENDER (public)
     ============================================================ */

  function render() {
    if (!state.rootEl) return;
    state.rootEl.innerHTML = renderHeader();
    bindEvents();
  }

  /* ============================================================
     10. MOUNT — CRITICAL: renders IMMEDIATELY
     ============================================================ */

  function mount(containerId) {
    if (typeof containerId !== 'string') containerId = 'headerContainer';

    var container = document.getElementById(containerId);
    if (!container) {
      log('error', 'Header container not found: ' + containerId);
      return;
    }

    injectStyles();
    state.containerId = containerId;
    state.rootEl = container;

    // ⚡ CRITICAL: render immediately with fallbacks
    render();
    state.mounted = true;

    // Then load auth in background
    loadAuth().then(function () {
      render();

      // Settings realtime
      if (window.AppSettings && typeof window.AppSettings.onChange === 'function') {
        if (state.settingsUnsub) { try { state.settingsUnsub(); } catch (e) {} }
        state.settingsUnsub = window.AppSettings.onChange(function (s, key) {
          if (!key || key === 'app_identity' || key === 'header' || key === 'behavior') {
            render();
            if (window.AppTitle && typeof window.AppTitle.refresh === 'function') {
              try { window.AppTitle.refresh(); } catch (e) {}
            }
          }
        });
      }

      dispatchEvent('itws:header-mounted', { containerId: containerId });
      log('debug', 'Header mounted', { role: state.profile ? state.profile.role : 'guest' });
    }).catch(function (err) {
      log('error', 'Mount background failed', err);
    });
  }

  function refresh() {
    if (!state.mounted) return;
    loadAuth().then(function () { render(); });
  }

  function unmount() {
    if (!state.rootEl) return;
    if (state.settingsUnsub) { try { state.settingsUnsub(); } catch (e) {} state.settingsUnsub = null; }
    if (state.documentClickHandler) {
      document.removeEventListener('click', state.documentClickHandler);
      state.documentClickHandler = null;
    }
    if (state.escapeHandler) {
      document.removeEventListener('keydown', state.escapeHandler);
      state.escapeHandler = null;
    }
    if (state.scrollHandler) {
      window.removeEventListener('scroll', state.scrollHandler);
      state.scrollHandler = null;
    }
    state.rootEl.innerHTML = '';
    state.rootEl = null;
    state.mounted = false;
  }

  /* ============================================================
     11. EXPORT
     ============================================================ */

  window.Header = {
    _initialized: true,
    mount: mount,
    render: render,
    refresh: refresh,
    unmount: unmount,
    getUser: function () { return state.user; },
    getProfile: function () { return state.profile; },
    isMounted: function () { return state.mounted; },
    getState: function () {
      return {
        mounted: state.mounted,
        role: state.profile ? state.profile.role : null,
        unreadCount: state.unreadCount,
        mobileOpen: state.mobileOpen
      };
    }
  };

  window.mountHeader = mount;

  /* ============================================================
     12. AUTO-MOUNT
     ============================================================ */

  function autoMount() {
    var container = document.getElementById('headerContainer');
    if (!container) return;
    if (container.hasAttribute('data-no-auto-mount')) return;
    if (container.children.length > 0) return;
    mount('headerContainer');
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', autoMount);
  } else {
    autoMount();
  }

  /* ============================================================
     13. LOG
     ============================================================ */

  try {
    console.log('%c[Header]', 'color: #D4A843; font-weight: bold;', 'Official header V4 ready (ES5-safe)');
  } catch (e) {}

})();/* ============================================================
   ITWS Platform — Official Header V3
   File: assets/js/ui/header.js
   Description: Egyptian Government Portal Header

   ⚠️ CRITICAL FIXES:
   - Renders IMMEDIATELY with fallbacks (never blank)
   - Loads auth/settings in background, updates progressively
   - Never fails if Supabase or Icons or Labels unavailable
   - Sets --header-height globally for other components

   🎨 OFFICIAL DESIGN:
   - Navy (#0A1628) background
   - Gold (#D4A843) accents
   - Egyptian Red (#C8102E) for CTAs
   - Sharp corners (6px, not 16px)
   - Cairo font only
   - Professional motion (no bouncing)

   ⚙️ FULLY CONFIGURABLE:
   - Union name, committee name, president, logo (from app_identity)
   - Nav items + order (from header.nav)
   - Show/hide: logo, committee, notifications, theme picker, login, search
   - Header height, sticky mode

   Rules:
   - No emoji (SVG icons only)
   - ES5-style IIFE
   - Self-contained CSS injection
   - Renders even if all dependencies fail
   ============================================================ */

(function () {
  'use strict';

  if (window.Header && window.Header._initialized) return;

  /* ============================================================
     1. HELPERS
     ============================================================ */

  function log(level, msg, data) {
    var cfg = window.ITWS_CONFIG || {};
    if (level === 'error' || (cfg.DEBUG && level === 'debug')) {
      try {
        var args = ['[Header]', msg];
        if (data !== undefined) args.push(data);
        if (level === 'error') console.error.apply(console, args);
        else console.log.apply(console, args);
      } catch (e) {}
    }
  }

  function getSb() {
    return window.sb || window.supabaseClient || window.ITWS_SUPABASE || null;
  }

  function getSetting(path, fallback) {
    try {
      if (window.AppSettings && typeof window.AppSettings.get === 'function') {
        var v = window.AppSettings.get(path);
        return (v === undefined || v === null) ? fallback : v;
      }
    } catch (e) {}
    try {
      if (typeof window.getSettingDefault === 'function') {
        var d = window.getSettingDefault(path);
        if (d !== undefined && d !== null) return d;
      }
    } catch (e) {}
    return fallback;
  }

  function getLabel(key, fallback) {
    try {
      if (window.Labels && typeof window.Labels.t === 'function') {
        var v = window.Labels.t(key);
        if (v && v !== key) return v;
      }
    } catch (e) {}
    return fallback;
  }

  function resolve(path) {
    if (!path) return '#';
    if (window.resolveUrl) return window.resolveUrl(path);
    var base = (window.ITWS_CONFIG && window.ITWS_CONFIG.BASE_PATH) || '/';
    if (base.charAt(base.length - 1) !== '/') base += '/';
    return base + String(path).replace(/^\.?\//, '');
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

  function dispatchEvent(name, detail) {
    try {
      window.dispatchEvent(new CustomEvent(name, { detail: detail || {} }));
    } catch (e) {}
  }

  // Inline SVG fallback (in case icons.js is not ready yet)
  var FALLBACK_ICONS = {
    menu: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="18" x2="21" y2="18"/></svg>',
    x: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>',
    'chevron-down': '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><polyline points="6 9 12 15 18 9"/></svg>',
    bell: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg>',
    palette: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="4" fill="currentColor" stroke="none"/></svg>',
    'log-in': '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4"/><polyline points="10 17 15 12 10 7"/><line x1="15" y1="12" x2="3" y2="12"/></svg>',
    'log-out': '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>',
    home: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>',
    user: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>',
    'chevron-left': '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><polyline points="15 18 9 12 15 6"/></svg>'
  };

  function icon(name, size) {
    try {
      if (window.Icons && typeof window.Icons.get === 'function') {
        var svg = window.Icons.get(name, { size: size || 20 });
        if (svg) return svg;
      }
    } catch (e) {}
    var fb = FALLBACK_ICONS[name];
    if (fb) return fb;
    return '';
  }

  function $(id) { return document.getElementById(id); }

  /* ============================================================
     2. STATE
     ============================================================ */

  var state = {
    _initialized: false,
    mounted: false,
    containerId: null,
    rootEl: null,
    mobileOpen: false,
    userMenuOpen: false,
    notifOpen: false,
    notifications: [],
    unreadCount: 0,
    user: null,
    profile: null,
    settingsUnsub: null,
    labelsUnsub: null,
    authHandler: null,
    scrollHandler: null,
    notifUnsub: null,
    documentClickHandler: null,
    escapeHandler: null
  };

  /* ============================================================
     3. OFFICIAL CSS INJECTION
     ============================================================ */

  var STYLE_ID = 'itws-header-official-styles';

  function injectStyles() {
    if (document.getElementById(STYLE_ID)) return;

    var css = ''

      /* ===== ROOT FALLBACKS (in case theme.css not updated) ===== */
      + ':root{'
      + '--itws-navy:var(--bg, #0A1628);'
      + '--itws-navy-alt:var(--bg-alt, #0F1E33);'
      + '--itws-navy-surface:var(--surface, #142540);'
      + '--itws-gold:var(--gold, #D4A843);'
      + '--itws-gold-soft:var(--gold-soft, rgba(212,168,67,0.15));'
      + '--itws-red:var(--primary, #C8102E);'
      + '--itws-red-hover:var(--primary-hover, #A50D26);'
      + '--itws-text:var(--text, #F5F3EE);'
      + '--itws-text-secondary:var(--text-secondary, #B8C4D6);'
      + '--itws-text-muted:var(--text-muted, #7A8BA5);'
      + '--itws-border:var(--border, rgba(255,255,255,0.08));'
      + '--itws-border-strong:var(--border-strong, rgba(255,255,255,0.15));'
      + '}'

      /* ===== HEADER SHELL ===== */
      + '.itws-header{'
      + 'position:sticky;top:0;z-index:900;'
      + 'background:var(--itws-navy);'
      + 'border-bottom:2px solid var(--itws-gold);'
      + 'box-shadow:0 2px 12px rgba(0,0,0,0.3);'
      + 'padding-top:env(safe-area-inset-top);'
      + 'font-family:"Cairo","Segoe UI",sans-serif;'
      + 'transition:box-shadow 0.25s ease;'
      + '}'
      + '.itws-header.is-scrolled{'
      + 'box-shadow:0 4px 24px rgba(0,0,0,0.45);'
      + '}'
      + '.itws-header[data-sticky="false"]{position:relative;}'

      /* Top accent line (gold gradient) */
      + '.itws-header::before{'
      + 'content:"";position:absolute;top:0;left:0;right:0;height:1px;'
      + 'background:linear-gradient(90deg, transparent, var(--itws-gold), transparent);'
      + 'opacity:0.6;'
      + '}'

      /* ===== INNER CONTAINER ===== */
      + '.itws-header-inner{'
      + 'max-width:1440px;margin:0 auto;'
      + 'padding:0 clamp(14px,3vw,28px);'
      + 'height:var(--header-height,76px);'
      + 'display:flex;align-items:center;gap:clamp(12px,2vw,24px);'
      + '}'

      /* ===== BRAND ===== */
      + '.itws-brand{'
      + 'display:flex;align-items:center;gap:12px;'
      + 'text-decoration:none;color:inherit;'
      + 'min-height:52px;flex-shrink:0;'
      + 'transition:opacity 0.2s ease;'
      + '}'
      + '.itws-brand:hover{opacity:0.88;}'
      + '.itws-brand-logo{'
      + 'width:clamp(42px,5.5vw,52px);height:clamp(42px,5.5vw,52px);'
      + 'border-radius:6px;'
      + 'background:linear-gradient(135deg,var(--itws-red),var(--itws-red-hover));'
      + 'border:2px solid var(--itws-gold);'
      + 'color:#FFFFFF;'
      + 'display:flex;align-items:center;justify-content:center;'
      + 'font-weight:800;font-size:clamp(16px,2.2vw,20px);'
      + 'overflow:hidden;flex-shrink:0;'
      + 'box-shadow:0 2px 8px rgba(200,16,46,0.4),inset 0 0 0 1px rgba(255,255,255,0.1);'
      + 'transition:box-shadow 0.25s ease,transform 0.25s ease;'
      + '}'
      + '.itws-brand:hover .itws-brand-logo{'
      + 'box-shadow:0 4px 16px rgba(212,168,67,0.5),inset 0 0 0 1px rgba(255,255,255,0.15);'
      + 'transform:translateY(-1px);'
      + '}'
      + '.itws-brand-logo img{'
      + 'width:100%;height:100%;object-fit:contain;padding:4px;'
      + 'background:var(--itws-navy-alt);'
      + '}'
      + '.itws-brand-text{'
      + 'display:none;flex-direction:column;line-height:1.25;'
      + 'min-width:0;overflow:hidden;'
      + '}'
      + '.itws-brand-name{'
      + 'font-size:clamp(14px,1.7vw,17px);font-weight:800;'
      + 'color:var(--itws-text);letter-spacing:-0.2px;'
      + 'white-space:nowrap;overflow:hidden;text-overflow:ellipsis;'
      + 'max-width:280px;'
      + '}'
      + '.itws-brand-subtitle{'
      + 'font-size:clamp(10px,1.2vw,11.5px);font-weight:600;'
      + 'color:var(--itws-gold);letter-spacing:0.3px;'
      + 'white-space:nowrap;overflow:hidden;text-overflow:ellipsis;'
      + 'max-width:280px;margin-top:2px;'
      + '}'
      + '@media (min-width:640px){.itws-brand-text{display:flex;}}'

      /* ===== NAV ===== */
      + '.itws-nav{'
      + 'display:none;flex:1;justify-content:center;gap:2px;'
      + '}'
      + '.itws-nav-link{'
      + 'position:relative;display:inline-flex;align-items:center;gap:8px;'
      + 'padding:10px 16px;border-radius:4px;'
      + 'font-family:inherit;font-size:14px;font-weight:600;'
      + 'color:var(--itws-text-secondary);text-decoration:none;'
      + 'transition:all 0.2s ease;white-space:nowrap;min-height:44px;'
      + 'letter-spacing:0.2px;'
      + '}'
      + '.itws-nav-link::after{'
      + 'content:"";position:absolute;bottom:2px;left:50%;right:50%;'
      + 'height:2px;background:var(--itws-gold);'
      + 'transition:left 0.3s ease,right 0.3s ease;'
      + 'border-radius:1px;'
      + '}'
      + '.itws-nav-link:hover{'
      + 'color:var(--itws-text);background:rgba(212,168,67,0.08);'
      + '}'
      + '.itws-nav-link:hover::after{left:16px;right:16px;}'
      + '.itws-nav-link.is-active{color:var(--itws-gold);}'
      + '.itws-nav-link.is-active::after{left:16px;right:16px;}'
      + '.itws-nav-link svg{width:16px;height:16px;flex-shrink:0;}'
      + '@media (min-width:1024px){.itws-nav{display:flex;}}'

      /* ===== ACTIONS ===== */
      + '.itws-actions{'
      + 'display:flex;align-items:center;gap:6px;margin-right:auto;'
      + '}'
      + '@media (min-width:1024px){.itws-actions{margin-right:0;}}'

      /* ===== ICON BUTTON ===== */
      + '.itws-icon-btn{'
      + 'width:44px;height:44px;border-radius:6px;'
      + 'background:transparent;border:1px solid transparent;'
      + 'color:var(--itws-text-secondary);cursor:pointer;'
      + 'display:inline-flex;align-items:center;justify-content:center;'
      + 'transition:all 0.2s ease;position:relative;padding:0;'
      + 'flex-shrink:0;font-family:inherit;text-decoration:none;'
      + '}'
      + '.itws-icon-btn:hover{'
      + 'background:rgba(212,168,67,0.1);'
      + 'color:var(--itws-gold);'
      + 'border-color:var(--itws-gold-soft);'
      + '}'
      + '.itws-icon-btn:focus-visible{'
      + 'outline:2px solid var(--itws-gold);outline-offset:2px;'
      + '}'
      + '.itws-icon-btn svg{width:20px;height:20px;}'

      /* ===== NOTIFICATION BADGE ===== */
      + '.itws-notif-badge{'
      + 'position:absolute;top:6px;right:6px;'
      + 'min-width:18px;height:18px;padding:0 5px;'
      + 'border-radius:999px;background:var(--itws-red);'
      + 'color:#FFFFFF;font-size:10px;font-weight:800;'
      + 'display:none;align-items:center;justify-content:center;'
      + 'line-height:1;border:2px solid var(--itws-navy);'
      + 'box-shadow:0 2px 6px rgba(200,16,46,0.4);'
      + '}'
      + '.itws-notif-badge.is-visible{display:inline-flex;}'

      /* ===== LOGIN BUTTON ===== */
      + '.itws-login-btn{'
      + 'display:inline-flex;align-items:center;gap:8px;'
      + 'padding:10px 20px;'
      + 'background:var(--itws-red);color:#FFFFFF;'
      + 'border:1px solid var(--itws-red);'
      + 'border-radius:6px;'
      + 'font-family:inherit;font-size:13px;font-weight:700;'
      + 'cursor:pointer;text-decoration:none;'
      + 'transition:all 0.2s ease;min-height:44px;white-space:nowrap;'
      + 'letter-spacing:0.3px;'
      + 'box-shadow:0 2px 8px rgba(200,16,46,0.3);'
      + '}'
      + '.itws-login-btn:hover{'
      + 'background:var(--itws-red-hover);border-color:var(--itws-gold);'
      + 'transform:translateY(-1px);'
      + 'box-shadow:0 4px 16px rgba(212,168,67,0.4);'
      + '}'
      + '.itws-login-btn:focus-visible{'
      + 'outline:2px solid var(--itws-gold);outline-offset:2px;'
      + '}'
      + '.itws-login-btn svg{width:16px;height:16px;}'

      /* ===== USER MENU ===== */
      + '.itws-user{position:relative;}'
      + '.itws-user-btn{'
      + 'display:inline-flex;align-items:center;gap:8px;'
      + 'padding:5px 12px 5px 6px;'
      + 'background:transparent;'
      + 'border:1px solid var(--itws-border);'
      + 'border-radius:6px;cursor:pointer;'
      + 'font-family:inherit;transition:all 0.2s ease;min-height:44px;'
      + '}'
      + '.itws-user-btn:hover{'
      + 'background:rgba(212,168,67,0.08);'
      + 'border-color:var(--itws-gold-soft);'
      + '}'
      + '.itws-user-avatar{'
      + 'width:32px;height:32px;border-radius:4px;'
      + 'background:linear-gradient(135deg,var(--itws-red),var(--itws-red-hover));'
      + 'border:1px solid var(--itws-gold);'
      + 'color:#FFFFFF;display:flex;align-items:center;justify-content:center;'
      + 'font-weight:800;font-size:12px;'
      + 'overflow:hidden;flex-shrink:0;'
      + '}'
      + '.itws-user-avatar img{width:100%;height:100%;object-fit:cover;}'
      + '.itws-user-name{'
      + 'display:none;font-size:13px;font-weight:600;'
      + 'color:var(--itws-text);max-width:120px;'
      + 'white-space:nowrap;overflow:hidden;text-overflow:ellipsis;'
      + '}'
      + '.itws-user-btn > svg.chevron{'
      + 'width:14px;height:14px;color:var(--itws-text-muted);'
      + 'transition:transform 0.2s ease;'
      + '}'
      + '.itws-user.is-open .itws-user-btn > svg.chevron{transform:rotate(180deg);}'
      + '@media (min-width:640px){.itws-user-name{display:block;}}'

      /* ===== DROPDOWN ===== */
      + '.itws-dropdown{'
      + 'position:absolute;top:calc(100% + 8px);left:0;'
      + 'min-width:min(300px,calc(100vw - 32px));max-width:calc(100vw - 32px);'
      + 'background:var(--itws-navy-surface);'
      + 'border:1px solid var(--itws-border);'
      + 'border-top:2px solid var(--itws-gold);'
      + 'border-radius:6px;'
      + 'box-shadow:0 20px 60px rgba(0,0,0,0.5);'
      + 'z-index:1000;opacity:0;transform:translateY(-4px);'
      + 'pointer-events:none;transition:all 0.2s ease;overflow:hidden;'
      + '}'
      + '.is-open > .itws-dropdown{'
      + 'opacity:1;transform:translateY(0);pointer-events:auto;'
      + '}'
      + '.itws-dropdown-head{'
      + 'padding:14px 16px;'
      + 'background:var(--itws-navy-alt);'
      + 'border-bottom:1px solid var(--itws-border);'
      + '}'
      + '.itws-dropdown-title{'
      + 'font-size:13px;font-weight:800;'
      + 'color:var(--itws-text);margin:0 0 3px;'
      + '}'
      + '.itws-dropdown-sub{'
      + 'font-size:11px;color:var(--itws-text-muted);margin:0;'
      + 'word-break:break-all;'
      + '}'
      + '.itws-dropdown-body{'
      + 'padding:6px;max-height:min(420px,65vh);'
      + 'overflow-y:auto;overscroll-behavior:contain;'
      + '}'
      + '.itws-menu-item{'
      + 'display:flex;align-items:center;gap:10px;'
      + 'padding:11px 12px;border-radius:4px;'
      + 'color:var(--itws-text);font-family:inherit;'
      + 'font-size:13px;font-weight:500;text-decoration:none;'
      + 'background:transparent;border:none;cursor:pointer;'
      + 'transition:all 0.15s ease;width:100%;text-align:right;'
      + 'min-height:44px;'
      + '}'
      + '.itws-menu-item:hover{'
      + 'background:rgba(212,168,67,0.1);color:var(--itws-gold);'
      + '}'
      + '.itws-menu-item svg{'
      + 'width:16px;height:16px;flex-shrink:0;'
      + 'color:var(--itws-text-muted);'
      + '}'
      + '.itws-menu-item:hover svg{color:var(--itws-gold);}'
      + '.itws-menu-item.danger{color:var(--itws-red);}'
      + '.itws-menu-item.danger svg{color:var(--itws-red);}'
      + '.itws-menu-item.danger:hover{'
      + 'background:rgba(200,16,46,0.12);color:var(--itws-red);'
      + '}'
      + '.itws-menu-sep{'
      + 'height:1px;background:var(--itws-border);margin:6px 4px;'
      + '}'

      /* ===== NOTIFICATIONS PANEL ===== */
      + '.itws-notif{position:relative;}'
      + '.itws-notif-panel .itws-dropdown-body{padding:0;max-height:min(480px,65vh);}'
      + '.itws-notif-item{'
      + 'display:flex;gap:12px;padding:14px 16px;'
      + 'border-bottom:1px solid var(--itws-border);'
      + 'text-decoration:none;color:inherit;'
      + 'background:transparent;transition:background 0.15s ease;'
      + 'min-height:44px;'
      + '}'
      + '.itws-notif-item:hover{background:rgba(212,168,67,0.06);}'
      + '.itws-notif-item.unread{'
      + 'background:rgba(212,168,67,0.05);'
      + 'border-inline-start:3px solid var(--itws-gold);'
      + '}'
      + '.itws-notif-icon{'
      + 'width:36px;height:36px;border-radius:6px;'
      + 'background:var(--itws-gold-soft);'
      + 'color:var(--itws-gold);'
      + 'display:flex;align-items:center;justify-content:center;flex-shrink:0;'
      + '}'
      + '.itws-notif-icon svg{width:16px;height:16px;}'
      + '.itws-notif-body{flex:1;min-width:0;}'
      + '.itws-notif-title{'
      + 'font-size:13px;font-weight:700;'
      + 'color:var(--itws-text);margin:0 0 3px;line-height:1.4;'
      + '}'
      + '.itws-notif-text{'
      + 'font-size:11.5px;color:var(--itws-text-muted);margin:0;'
      + 'line-height:1.55;'
      + '}'
      + '.itws-notif-empty{'
      + 'padding:40px 20px;text-align:center;'
      + 'font-size:12.5px;color:var(--itws-text-muted);'
      + '}'

      /* ===== MOBILE MENU ===== */
      + '.itws-hamburger{display:inline-flex;}'
      + '@media (min-width:1024px){.itws-hamburger{display:none;}}'

      + '.itws-mobile-backdrop{'
      + 'position:fixed;inset:0;z-index:1500;'
      + 'background:rgba(10,22,40,0.75);backdrop-filter:blur(6px);'
      + 'opacity:0;pointer-events:none;transition:opacity 0.25s ease;'
      + '}'
      + '.itws-mobile-backdrop.is-open{opacity:1;pointer-events:auto;}'

      + '.itws-mobile-drawer{'
      + 'position:fixed;top:0;right:0;bottom:0;'
      + 'width:min(340px,88vw);z-index:1501;'
      + 'background:var(--itws-navy);'
      + 'border-left:2px solid var(--itws-gold);'
      + 'transform:translateX(100%);'
      + 'transition:transform 0.3s cubic-bezier(0.4,0,0.2,1);'
      + 'display:flex;flex-direction:column;'
      + 'padding-top:env(safe-area-inset-top);'
      + 'padding-bottom:env(safe-area-inset-bottom);'
      + 'box-shadow:-8px 0 40px rgba(0,0,0,0.5);'
      + 'font-family:"Cairo",sans-serif;'
      + '}'
      + '.itws-mobile-drawer.is-open{transform:translateX(0);}'
      + '.itws-mobile-head{'
      + 'padding:16px;'
      + 'border-bottom:1px solid var(--itws-border);'
      + 'display:flex;align-items:center;justify-content:space-between;gap:12px;'
      + 'background:var(--itws-navy-alt);'
      + '}'
      + '.itws-mobile-brand{'
      + 'display:flex;align-items:center;gap:10px;min-width:0;'
      + '}'
      + '.itws-mobile-brand-logo{'
      + 'width:36px;height:36px;border-radius:4px;'
      + 'background:linear-gradient(135deg,var(--itws-red),var(--itws-red-hover));'
      + 'border:1.5px solid var(--itws-gold);'
      + 'color:#FFFFFF;display:flex;align-items:center;justify-content:center;'
      + 'font-weight:800;font-size:14px;flex-shrink:0;overflow:hidden;'
      + '}'
      + '.itws-mobile-brand-logo img{width:100%;height:100%;object-fit:contain;padding:3px;background:var(--itws-navy-alt);}'
      + '.itws-mobile-brand-text{display:flex;flex-direction:column;line-height:1.2;min-width:0;}'
      + '.itws-mobile-brand-name{font-size:13px;font-weight:800;color:var(--itws-text);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}'
      + '.itws-mobile-brand-sub{font-size:10px;font-weight:600;color:var(--itws-gold);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;margin-top:1px;}'

      + '.itws-mobile-body{flex:1;overflow-y:auto;padding:12px;}'
      + '.itws-mobile-nav-link{'
      + 'display:flex;align-items:center;gap:12px;'
      + 'padding:14px 16px;border-radius:4px;'
      + 'color:var(--itws-text);font-family:inherit;'
      + 'font-size:14px;font-weight:600;text-decoration:none;'
      + 'transition:all 0.2s ease;min-height:48px;'
      + 'border-inline-start:3px solid transparent;'
      + '}'
      + '.itws-mobile-nav-link:hover{background:rgba(212,168,67,0.08);}'
      + '.itws-mobile-nav-link.is-active{'
      + 'color:var(--itws-gold);'
      + 'background:rgba(212,168,67,0.1);'
      + 'border-inline-start-color:var(--itws-gold);'
      + '}'
      + '.itws-mobile-nav-link svg{width:18px;height:18px;flex-shrink:0;color:currentColor;}'
      + '.itws-mobile-sep{height:1px;background:var(--itws-border);margin:10px 12px;}'
      + '.itws-mobile-foot{'
      + 'padding:14px;'
      + 'border-top:1px solid var(--itws-border);'
      + 'background:var(--itws-navy-alt);'
      + '}'

      /* ===== SKIP LINK ===== */
      + '.itws-skip-link{'
      + 'position:absolute;top:-100px;right:16px;'
      + 'padding:10px 16px;'
      + 'background:var(--itws-red);color:#FFFFFF;'
      + 'border-radius:4px;text-decoration:none;'
      + 'font-weight:600;font-size:13px;z-index:2000;'
      + 'font-family:"Cairo",sans-serif;'
      + 'transition:top 0.2s ease;'
      + '}'
      + '.itws-skip-link:focus{top:12px;}'

      /* ===== REDUCED MOTION ===== */
      + '@media (prefers-reduced-motion: reduce){'
      + '.itws-header *,.itws-mobile-drawer *,.itws-mobile-backdrop{'
      + 'animation-duration:0.01ms !important;'
      + 'transition-duration:0.01ms !important;'
      + '}'
      + '.itws-brand:hover .itws-brand-logo{transform:none;}'
      + '.itws-login-btn:hover{transform:none;}'
      + '}'

      /* ===== PRINT ===== */
      + '@media print{'
      + '.itws-header,.itws-mobile-drawer,.itws-mobile-backdrop{display:none !important;}'
      + '}';

    var style = document.createElement('style');
    style.id = STYLE_ID;
    style.textContent = css;
    document.head.appendChild(style);
  }

  /* ============================================================
     4. CONFIG FROM SETTINGS
     ============================================================ */

  function getHeaderConfig() {
    return {
      sticky: getSetting('header.sticky', true),
      height: parseInt(getSetting('header.height', 76), 10) || 76,
      showLogo: getSetting('header.show_logo', true) !== false,
      showCommitteeName: getSetting('header.show_committee_name', true) !== false,
      showNotifications: getSetting('header.show_notifications', true) !== false,
      showThemePicker: getSetting('header.show_theme_picker', true) !== false,
      showLoginButton: getSetting('header.show_login_button', true) !== false,
      showSearchButton: getSetting('header.show_search_button', false) !== false
    };
  }

  function getNavItems() {
    var custom = getSetting('header.nav', null);
    var defaults = [
      { key: 'home', href: 'home.html', labelKey: 'pages.home.title', label: 'الرئيسية', icon: 'home', enabled: true, order: 1 },
      { key: 'verify', href: 'verify.html', labelKey: 'pages.verify.title', label: 'التحقق', icon: 'badge-check', enabled: true, order: 2 },
      { key: 'student', href: 'student.html', labelKey: 'pages.student.title', label: 'صفحة المتدرب', icon: 'graduation-cap', enabled: true, order: 3 },
      { key: 'academies', href: 'academies.html', labelKey: 'pages.academies.title', label: 'الأكاديميات', icon: 'briefcase', enabled: true, order: 4 },
      { key: 'track', href: 'track.html', labelKey: 'pages.track.title', label: 'متابعة الطلب', icon: 'clock', enabled: true, order: 5 }
    ];

    var items = defaults;

    if (Array.isArray(custom) && custom.length > 0) {
      items = custom.map(function (c) {
        return {
          key: c.key || c.href || ('nav-' + Math.random()),
          href: c.href || '#',
          labelKey: c.label_key || null,
          label: c.label || '',
          icon: c.icon || 'chevron-left',
          enabled: c.enabled !== false,
          order: (typeof c.order === 'number') ? c.order : 999
        };
      });
    }

    return items
      .filter(function (it) { return it.enabled !== false && it.href && it.href !== '#'; })
      .sort(function (a, b) { return a.order - b.order; });
  }

  /* ============================================================
     5. USER HELPERS
     ============================================================ */

  function getUserInitials(profile) {
    if (!profile) return '?';
    var name = profile.full_name || profile.email || '';
    var parts = String(name).trim().split(/\s+/);
    if (parts.length >= 2) {
      return (parts[0].charAt(0) + parts[1].charAt(0)).toUpperCase();
    }
    return name.substring(0, 2).toUpperCase() || '?';
  }

  function getUserMenuItems() {
    var items = [];
    var role = state.profile ? state.profile.role : null;

    if (role === 'super_admin' || role === 'committee_head' || role === 'committee_deputy' || role === 'committee_member') {
      items.push({ href: 'admin/index.html', labelKey: 'nav.admin_dashboard', label: 'لوحة التحكم', icon: 'home' });
    } else if (role && role.indexOf('branch_') === 0) {
      items.push({ href: 'branch/index.html', labelKey: 'nav.branch_dashboard', label: 'بوابة الفرع', icon: 'home' });
    } else if (role === 'academy_owner' || role === 'academy_manager') {
      items.push({ href: 'portal/index.html', labelKey: 'nav.portal_dashboard', label: 'بوابة الأكاديمية', icon: 'home' });
    }

    items.push({ href: 'portal/profile.html', labelKey: 'nav.profile', label: 'الملف الشخصي', icon: 'user' });

    if (!role || role === 'user') {
      items.push({ href: 'student.html', labelKey: 'nav.my_certificates', label: 'شهاداتي', icon: 'certificate' });
    }

    return items;
  }

  /* ============================================================
     6. IS ACTIVE NAV
     ============================================================ */

  function isActiveNav(item) {
    try {
      var path = window.location.pathname || '';
      var filename = path.split('/').pop() || '';
      if (!filename) filename = 'index.html';
      var target = (item.href || '').split('?')[0].split('#')[0];
      var targetName = target.split('/').pop() || '';
      return targetName === filename;
    } catch (e) { return false; }
  }

  /* ============================================================
     7. RENDER
     ============================================================ */

  function renderHeader() {
    var cfg = getHeaderConfig();
    var unionName = getSetting('app_identity.union_name', 'نقابة تكنولوجيا المعلومات والبرمجيات');
    var committeeName = getSetting('app_identity.committee_name', 'لجنة التحول الرقمي والتدريب');
    var logoUrl = getSetting('app_identity.logo_url', '');

    var navItems = getNavItems();
    var isGuest = !state.profile;

    // Logo HTML
    var logoHtml;
    if (cfg.showLogo && logoUrl) {
      logoHtml = '<img src="' + escapeHtml(logoUrl) + '" alt="' + escapeHtml(unionName) + '" onerror="this.parentNode.textContent=\'ن\';">';
    } else {
      logoHtml = escapeHtml((unionName || 'ن').charAt(0));
    }

    // Nav HTML (desktop)
    var navHtml = navItems.map(function (item) {
      var active = isActiveNav(item) ? ' is-active' : '';
      var label = item.labelKey ? getLabel(item.labelKey, item.label) : item.label;
      return '<a href="' + escapeHtml(resolve(item.href)) + '" class="itws-nav-link' + active + '">'
        + icon(item.icon, 16)
        + '<span>' + escapeHtml(label) + '</span>'
        + '</a>';
    }).join('');

    // Nav HTML (mobile)
    var mobileNavHtml = navItems.map(function (item) {
      var active = isActiveNav(item) ? ' is-active' : '';
      var label = item.labelKey ? getLabel(item.labelKey, item.label) : item.label;
      return '<a href="' + escapeHtml(resolve(item.href)) + '" class="itws-mobile-nav-link' + active + '">'
        + icon(item.icon, 18)
        + '<span>' + escapeHtml(label) + '</span>'
        + '</a>';
    }).join('');

    // User area
    var userAreaHtml = '';
    if (isGuest) {
      if (cfg.showLoginButton) {
        userAreaHtml = '<a href="' + escapeHtml(resolve('login.html')) + '" class="itws-login-btn">'
          + icon('log-in', 16)
          + '<span>' + escapeHtml(getLabel('nav.login', 'دخول')) + '</span>'
          + '</a>';
      }
    } else {
      var initials = getUserInitials(state.profile);
      var avatarHtml = state.profile.avatar_url
        ? '<img src="' + escapeHtml(state.profile.avatar_url) + '" alt="">'
        : '<span>' + escapeHtml(initials) + '</span>';
      var displayName = state.profile.full_name || state.profile.email || '';

      var menuHtml = getUserMenuItems().map(function (mi) {
        return '<a href="' + escapeHtml(resolve(mi.href)) + '" class="itws-menu-item">'
          + icon(mi.icon, 16)
          + '<span>' + escapeHtml(getLabel(mi.labelKey, mi.label)) + '</span>'
          + '</a>';
      }).join('');

      userAreaHtml = '<div class="itws-user" id="itwsUserMenu">'
        + '<button type="button" class="itws-user-btn" id="itwsUserBtn" aria-haspopup="true" aria-expanded="false">'
        +   '<span class="itws-user-avatar">' + avatarHtml + '</span>'
        +   '<span class="itws-user-name">' + escapeHtml(displayName) + '</span>'
        +   icon('chevron-down', 14).replace('class="', 'class="chevron ')
        + '</button>'
        + '<div class="itws-dropdown">'
        +   '<div class="itws-dropdown-head">'
        +     '<p class="itws-dropdown-title">' + escapeHtml(displayName) + '</p>'
        +     '<p class="itws-dropdown-sub">' + escapeHtml(state.profile.email || '') + '</p>'
        +   '</div>'
        +   '<div class="itws-dropdown-body">'
        +     menuHtml
        +     '<div class="itws-menu-sep"></div>'
        +     '<button type="button" class="itws-menu-item danger" id="itwsLogoutBtn">'
        +       icon('log-out', 16)
        +       '<span>' + escapeHtml(getLabel('nav.logout', 'تسجيل الخروج')) + '</span>'
        +     '</button>'
        +   '</div>'
        + '</div>'
        + '</div>';
    }

    // Notifications
    var notifHtml = '';
    if (!isGuest && cfg.showNotifications) {
      notifHtml = '<div class="itws-notif" id="itwsNotifMenu">'
        + '<button type="button" class="itws-icon-btn" id="itwsNotifBtn" aria-label="' + escapeHtml(getLabel('nav.notifications', 'الإشعارات')) + '" aria-haspopup="true" aria-expanded="false">'
        +   icon('bell', 20)
        +   '<span class="itws-notif-badge' + (state.unreadCount > 0 ? ' is-visible' : '') + '" id="itwsNotifBadge">'
        +     (state.unreadCount > 99 ? '99+' : String(state.unreadCount))
        +   '</span>'
        + '</button>'
        + '<div class="itws-dropdown itws-notif-panel">'
        +   '<div class="itws-dropdown-head">'
        +     '<p class="itws-dropdown-title">' + escapeHtml(getLabel('nav.notifications', 'الإشعارات')) + '</p>'
        +   '</div>'
        +   '<div class="itws-dropdown-body" id="itwsNotifBody">'
        +     '<div class="itws-notif-empty">' + escapeHtml(getLabel('notifications.empty', 'لا توجد إشعارات')) + '</div>'
        +   '</div>'
        + '</div>'
        + '</div>';
    }

    // Theme picker
    var themeBtnHtml = '';
    if (cfg.showThemePicker) {
      themeBtnHtml = '<button type="button" class="itws-icon-btn" id="itwsThemeBtn" aria-label="' + escapeHtml(getLabel('nav.theme', 'تغيير الثيم')) + '">'
        + icon('palette', 20)
        + '</button>';
    }

    // Full template
    var html = ''
      + '<a href="#main-content" class="itws-skip-link">' + escapeHtml(getLabel('a11y.skip_to_content', 'تخطي إلى المحتوى')) + '</a>'
      + '<header class="itws-header" id="itwsHeader" data-sticky="' + (cfg.sticky ? 'true' : 'false') + '" role="banner">'
      +   '<div class="itws-header-inner">'
      +     '<a href="' + escapeHtml(resolve('home.html')) + '" class="itws-brand">'
      +       '<div class="itws-brand-logo">' + logoHtml + '</div>'
      +       '<div class="itws-brand-text">'
      +         '<span class="itws-brand-name">' + escapeHtml(unionName) + '</span>'
      +         (cfg.showCommitteeName && committeeName ? '<span class="itws-brand-subtitle">' + escapeHtml(committeeName) + '</span>' : '')
      +       '</div>'
      +     '</a>'
      +     '<nav class="itws-nav" role="navigation">' + navHtml + '</nav>'
      +     '<div class="itws-actions">'
      +       themeBtnHtml
      +       notifHtml
      +       userAreaHtml
      +       '<button type="button" class="itws-icon-btn itws-hamburger" id="itwsHamburger" aria-label="' + escapeHtml(getLabel('nav.menu', 'القائمة')) + '" aria-expanded="false">'
      +         icon('menu', 22)
      +       '</button>'
      +     '</div>'
      +   '</div>'
      + '</header>'
      + '<div class="itws-mobile-backdrop" id="itwsMobileBackdrop" aria-hidden="true"></div>'
      + '<aside class="itws-mobile-drawer" id="itwsMobileDrawer" aria-hidden="true">'
      +   '<div class="itws-mobile-head">'
      +     '<div class="itws-mobile-brand">'
      +       '<div class="itws-mobile-brand-logo">' + logoHtml + '</div>'
      +       '<div class="itws-mobile-brand-text">'
      +         '<span class="itws-mobile-brand-name">' + escapeHtml(unionName) + '</span>'
      +         (cfg.showCommitteeName && committeeName ? '<span class="itws-mobile-brand-sub">' + escapeHtml(committeeName) + '</span>' : '')
      +       '</div>'
      +     '</div>'
      +     '<button type="button" class="itws-icon-btn" id="itwsMobileClose" aria-label="إغلاق">' + icon('x', 20) + '</button>'
      +   '</div>'
      +   '<nav class="itws-mobile-body">' + mobileNavHtml + '</nav>'
      +   '<div class="itws-mobile-foot">'
      +     (isGuest
      +       ? (cfg.showLoginButton
      +         ? '<a href="' + escapeHtml(resolve('login.html')) + '" class="itws-login-btn" style="width:100%;justify-content:center;">'
      +             + icon('log-in', 16) + '<span>' + escapeHtml(getLabel('nav.login', 'دخول')) + '</span></a>'
      +         : '')
      +       : '<button type="button" class="itws-login-btn" id="itwsMobileLogout" style="width:100%;justify-content:center;background:var(--itws-red);">'
      +           + icon('log-out', 16) + '<span>' + escapeHtml(getLabel('nav.logout', 'تسجيل الخروج')) + '</span></button>')
      +   '</div>'
      + '</aside>';

    return html;
  }

  /* ============================================================
     8. AUTH STATE (non-blocking)
     ============================================================ */

  function loadAuthState() {
    var sb = getSb();
    if (!sb || !sb.auth) {
      state.user = null;
      state.profile = null;
      return Promise.resolve();
    }

    return sb.auth.getUser()
      .then(function (res) {
        var user = res && res.data && res.data.user;
        if (!user) {
          state.user = null;
          state.profile = null;
          return;
        }
        state.user = user;

        return sb.from('profiles')
          .select('id, email, full_name, avatar_url, role, status, governorate_id, branch_id, academy_id')
          .eq('id', user.id)
          .maybeSingle()
          .then(function (profileRes) {
            state.profile = (profileRes && profileRes.data) ? profileRes.data : null;
          });
      })
      .catch(function (err) {
        log('debug', 'loadAuthState failed', err && err.message);
        state.user = null;
        state.profile = null;
      });
  }

  /* ============================================================
     9. NOTIFICATIONS
     ============================================================ */

  function loadNotifications() {
    if (!state.profile) return Promise.resolve();
    var sb = getSb();
    if (!sb) return Promise.resolve();

    return sb.from('notifications')
      .select('id, type, title, body, link_url, is_read, created_at')
      .eq('user_id', state.profile.id)
      .order('created_at', { ascending: false })
      .limit(20)
      .then(function (res) {
        if (res.error) return;
        var list = res.data || [];
        state.notifications = list;
        state.unreadCount = list.filter(function (n) { return n.is_read === false; }).length;
        renderNotificationsList();
        updateNotifBadge();
      })
      .catch(function () {});
  }

  function renderNotificationsList() {
    var body = document.getElementById('itwsNotifBody');
    if (!body) return;

    if (state.notifications.length === 0) {
      body.innerHTML = '<div class="itws-notif-empty">'
        + escapeHtml(getLabel('notifications.empty', 'لا توجد إشعارات'))
        + '</div>';
      return;
    }

    body.innerHTML = state.notifications.map(function (n) {
      var iconName = 'info';
      if (n.type === 'success' || n.type === 'approval') iconName = 'check-circle';
      else if (n.type === 'warning') iconName = 'alert-triangle';
      else if (n.type === 'error') iconName = 'alert-circle';
      else if (n.type === 'request') iconName = 'bell';

      var unread = n.is_read === false ? ' unread' : '';
      var inner = '<div class="itws-notif-icon">' + icon(iconName, 16) + '</div>'
        + '<div class="itws-notif-body">'
        +   '<p class="itws-notif-title">' + escapeHtml(n.title || '') + '</p>'
        +   (n.body ? '<p class="itws-notif-text">' + escapeHtml(n.body) + '</p>' : '')
        + '</div>';

      if (n.link_url) {
        return '<a href="' + escapeHtml(resolve(n.link_url)) + '" class="itws-notif-item' + unread + '" data-notif-id="' + escapeHtml(n.id) + '">' + inner + '</a>';
      }
      return '<div class="itws-notif-item' + unread + '" data-notif-id="' + escapeHtml(n.id) + '">' + inner + '</div>';
    }).join('');

    body.querySelectorAll('[data-notif-id]').forEach(function (el) {
      el.addEventListener('click', function () {
        markNotifRead(el.getAttribute('data-notif-id'));
      });
    });
  }

  function updateNotifBadge() {
    var badge = document.getElementById('itwsNotifBadge');
    if (!badge) return;
    if (state.unreadCount > 0) {
      badge.textContent = state.unreadCount > 99 ? '99+' : String(state.unreadCount);
      badge.classList.add('is-visible');
    } else {
      badge.classList.remove('is-visible');
    }
  }

  function markNotifRead(id) {
    if (!id) return;
    var sb = getSb();
    if (!sb) return;
    sb.from('notifications')
      .update({ is_read: true, read_at: new Date().toISOString() })
      .eq('id', id)
      .then(function () { loadNotifications(); })
      .catch(function () {});
  }

  /* ============================================================
     10. EVENT BINDING
     ============================================================ */

  function bindEvents() {
    // Theme
    var themeBtn = document.getElementById('itwsThemeBtn');
    if (themeBtn) themeBtn.addEventListener('click', openThemePicker);

    // User menu
    var userBtn = document.getElementById('itwsUserBtn');
    var userMenu = document.getElementById('itwsUserMenu');
    if (userBtn && userMenu) {
      userBtn.addEventListener('click', function (e) {
        e.stopPropagation();
        var isOpen = userMenu.classList.contains('is-open');
        closeAllDropdowns();
        if (!isOpen) {
          userMenu.classList.add('is-open');
          userBtn.setAttribute('aria-expanded', 'true');
        }
      });
    }

    // Logout
    var logoutBtn = document.getElementById('itwsLogoutBtn');
    if (logoutBtn) logoutBtn.addEventListener('click', doLogout);

    var mobileLogoutBtn = document.getElementById('itwsMobileLogout');
    if (mobileLogoutBtn) mobileLogoutBtn.addEventListener('click', doLogout);

    // Notifications
    var notifBtn = document.getElementById('itwsNotifBtn');
    var notifMenu = document.getElementById('itwsNotifMenu');
    if (notifBtn && notifMenu) {
      notifBtn.addEventListener('click', function (e) {
        e.stopPropagation();
        var isOpen = notifMenu.classList.contains('is-open');
        closeAllDropdowns();
        if (!isOpen) {
          notifMenu.classList.add('is-open');
          notifBtn.setAttribute('aria-expanded', 'true');
        }
      });
    }

    // Mobile drawer
    var hamburger = document.getElementById('itwsHamburger');
    var backdrop = document.getElementById('itwsMobileBackdrop');
    var drawer = document.getElementById('itwsMobileDrawer');
    var closeBtn = document.getElementById('itwsMobileClose');

    if (hamburger) hamburger.addEventListener('click', openMobileMenu);
    if (backdrop) backdrop.addEventListener('click', closeMobileMenu);
    if (closeBtn) closeBtn.addEventListener('click', closeMobileMenu);

    // Document click
    if (state.documentClickHandler) {
      document.removeEventListener('click', state.documentClickHandler);
    }
    state.documentClickHandler = function (e) {
      var target = e.target;
      var insideUser = userMenu && userMenu.contains(target);
      var insideNotif = notifMenu && notifMenu.contains(target);
      if (!insideUser && !insideNotif) closeAllDropdowns();
    };
    document.addEventListener('click', state.documentClickHandler);

    // Escape
    if (state.escapeHandler) {
      document.removeEventListener('keydown', state.escapeHandler);
    }
    state.escapeHandler = function (e) {
      if (e.key === 'Escape') {
        closeAllDropdowns();
        closeMobileMenu();
      }
    };
    document.addEventListener('keydown', state.escapeHandler);

    // Scroll
    if (state.scrollHandler) {
      window.removeEventListener('scroll', state.scrollHandler);
    }
    state.scrollHandler = function () {
      var header = document.getElementById('itwsHeader');
      if (!header) return;
      if (window.scrollY > 8) header.classList.add('is-scrolled');
      else header.classList.remove('is-scrolled');
    };
    window.addEventListener('scroll', state.scrollHandler, { passive: true });
    state.scrollHandler();
  }

  function openMobileMenu() {
    var drawer = document.getElementById('itwsMobileDrawer');
    var backdrop = document.getElementById('itwsMobileBackdrop');
    var hamburger = document.getElementById('itwsHamburger');
    if (!drawer || !backdrop) return;

    state.mobileOpen = true;
    drawer.classList.add('is-open');
    backdrop.classList.add('is-open');
    drawer.setAttribute('aria-hidden', 'false');
    if (hamburger) hamburger.setAttribute('aria-expanded', 'true');
    try { document.body.style.overflow = 'hidden'; } catch (e) {}
  }

  function closeMobileMenu() {
    var drawer = document.getElementById('itwsMobileDrawer');
    var backdrop = document.getElementById('itwsMobileBackdrop');
    var hamburger = document.getElementById('itwsHamburger');
    if (!drawer || !backdrop) return;

    state.mobileOpen = false;
    drawer.classList.remove('is-open');
    backdrop.classList.remove('is-open');
    drawer.setAttribute('aria-hidden', 'true');
    if (hamburger) hamburger.setAttribute('aria-expanded', 'false');
    try { document.body.style.overflow = ''; } catch (e) {}
  }

  function closeAllDropdowns() {
    var userMenu = document.getElementById('itwsUserMenu');
    var notifMenu = document.getElementById('itwsNotifMenu');
    var userBtn = document.getElementById('itwsUserBtn');
    var notifBtn = document.getElementById('itwsNotifBtn');
    if (userMenu) userMenu.classList.remove('is-open');
    if (notifMenu) notifMenu.classList.remove('is-open');
    if (userBtn) userBtn.setAttribute('aria-expanded', 'false');
    if (notifBtn) notifBtn.setAttribute('aria-expanded', 'false');
  }

  function openThemePicker() {
    if (window.ITWSTheme && typeof window.ITWSTheme.openPicker === 'function') {
      try { window.ITWSTheme.openPicker(); return; } catch (e) {}
    }
    // Fallback: cycle themes
    var themes = window.ITWS_THEMES || [];
    if (themes.length === 0) return;
    var current = (window.ITWSTheme && window.ITWSTheme.getCurrent) ? window.ITWSTheme.getCurrent() : 'watanii_dark';
    var idx = -1;
    for (var i = 0; i < themes.length; i++) {
      if (themes[i].id === current) { idx = i; break; }
    }
    var next = themes[(idx + 1) % themes.length];
    if (next && window.ITWSTheme && typeof window.ITWSTheme.change === 'function') {
      window.ITWSTheme.change(next.id);
    }
  }

  function doLogout() {
    if (state.mobileOpen) closeMobileMenu();
    var msg = getLabel('auth.logout.confirm', 'هل تريد تسجيل الخروج؟');
    if (!window.confirm(msg)) return;

    if (window.Session && typeof window.Session.logout === 'function') {
      window.Session.logout();
      return;
    }

    var sb = getSb();
    if (!sb) {
      window.location.href = resolve('login.html');
      return;
    }

    sb.auth.signOut()
      .then(function () {
        try {
          Object.keys(localStorage).forEach(function (k) {
            if (k.indexOf('itws_') === 0 || k.indexOf('supabase') === 0 || k.indexOf('sb-') === 0) {
              try { localStorage.removeItem(k); } catch (e) {}
            }
          });
        } catch (e) {}
        window.location.href = resolve('login.html');
      })
      .catch(function () {
        window.location.href = resolve('login.html');
      });
  }

  /* ============================================================
     11. RENDER (public — re-renders in place)
     ============================================================ */

  function render() {
    if (!state.rootEl) return;
    state.rootEl.innerHTML = renderHeader();
    bindEvents();
  }

  /* ============================================================
     12. UPDATE GLOBAL CSS VAR (header height)
     ============================================================ */

  function applyHeaderHeight() {
    var cfg = getHeaderConfig();
    try {
      document.documentElement.style.setProperty('--header-height', cfg.height + 'px');
    } catch (e) {}
  }

  /* ============================================================
     13. REALTIME
     ============================================================ */

  function setupRealtime() {
    // Settings changes
    if (window.AppSettings && typeof window.AppSettings.onChange === 'function') {
      state.settingsUnsub = window.AppSettings.onChange(function (s, key) {
        if (!key || key === 'app_identity' || key === 'behavior' || key === 'header') {
          applyHeaderHeight();
          render();
          // Also update document title / favicon
          if (window.AppTitle && typeof window.AppTitle.refresh === 'function') {
            try { window.AppTitle.refresh(); } catch (e) {}
          }
        }
      });
    }

    // Labels changes
    if (window.Labels && typeof window.Labels.onChange === 'function') {
      state.labelsUnsub = window.Labels.onChange(function (l, key) {
        if (!key || (key && (key.indexOf('nav.') === 0 || key.indexOf('pages.') === 0))) {
          render();
        }
      });
    }

    // Auth changes
    state.authHandler = function () {
      loadAuthState().then(function () {
        render();
        if (state.profile) loadNotifications();
      });
    };
    window.addEventListener('itws:auth-changed', state.authHandler);
    window.addEventListener('itws:signed-in', state.authHandler);
    window.addEventListener('itws:signed-out', state.authHandler);
  }

  function teardownRealtime() {
    if (state.settingsUnsub) { try { state.settingsUnsub(); } catch (e) {} state.settingsUnsub = null; }
    if (state.labelsUnsub) { try { state.labelsUnsub(); } catch (e) {} state.labelsUnsub = null; }
    if (state.authHandler) {
      window.removeEventListener('itws:auth-changed', state.authHandler);
      window.removeEventListener('itws:signed-in', state.authHandler);
      window.removeEventListener('itws:signed-out', state.authHandler);
      state.authHandler = null;
    }
    if (state.notifUnsub) { try { state.notifUnsub(); } catch (e) {} state.notifUnsub = null; }
    if (state.documentClickHandler) {
      document.removeEventListener('click', state.documentClickHandler);
      state.documentClickHandler = null;
    }
    if (state.escapeHandler) {
      document.removeEventListener('keydown', state.escapeHandler);
      state.escapeHandler = null;
    }
    if (state.scrollHandler) {
      window.removeEventListener('scroll', state.scrollHandler);
      state.scrollHandler = null;
    }
  }

  /* ============================================================
     14. MOUNT — CRITICAL: renders IMMEDIATELY
     ============================================================ */

  function mount(containerId) {
    if (typeof containerId !== 'string') containerId = 'headerContainer';

    var container = document.getElementById(containerId);
    if (!container) {
      log('error', 'Container not found: ' + containerId);
      return;
    }

    injectStyles();
    applyHeaderHeight();

    state.containerId = containerId;
    state.rootEl = container;

    // ⚡ CRITICAL: render IMMEDIATELY with fallbacks (guest view)
    render();
    state.mounted = true;

    // Then load auth in background
    loadAuthState()
      .then(function () {
        render();
        setupRealtime();
        if (state.profile) loadNotifications();

        // Trigger app-title refresh (favicon + tab title)
        if (window.AppTitle && typeof window.AppTitle.refresh === 'function') {
          try { window.AppTitle.refresh(); } catch (e) {}
        }

        dispatchEvent('itws:header-mounted', { containerId: containerId });
        log('debug', 'Header mounted', { role: state.profile ? state.profile.role : 'guest' });
      })
      .catch(function (err) {
        log('error', 'Mount background failed', err);
        setupRealtime();
      });
  }

  function unmount() {
    if (!state.rootEl) return;
    teardownRealtime();
    state.rootEl.innerHTML = '';
    state.rootEl = null;
    state.mounted = false;
  }

  function refresh() {
    if (!state.mounted) return;
    loadAuthState().then(function () {
      render();
      if (state.profile) loadNotifications();
    });
  }

  /* ============================================================
     15. EXPORT
     ============================================================ */

  window.Header = {
    _initialized: true,
    mount: mount,
    render: render,
    refresh: refresh,
    unmount: unmount,
    getUser: function () { return state.user; },
    getProfile: function () { return state.profile; },
    isMounted: function () { return state.mounted; },
    getState: function () {
      return {
        mounted: state.mounted,
        role: state.profile ? state.profile.role : null,
        unreadCount: state.unreadCount,
        mobileOpen: state.mobileOpen
      };
    }
  };

  window.mountHeader = mount;

  /* ============================================================
     16. AUTO-MOUNT
     ============================================================ */

  function autoMount() {
    var container = document.getElementById('headerContainer');
    if (!container) return;
    if (container.hasAttribute('data-no-auto-mount')) return;
    if (container.children.length > 0) return;

    mount('headerContainer');
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', autoMount);
  } else {
    autoMount();
  }

  var cfg = window.ITWS_CONFIG || {};
  if (cfg.DEBUG) {
    try {
      console.log('%c[Header]', 'color: #D4A843; font-weight: bold;', 'Official header ready');
    } catch (e) {}
  }

})();
