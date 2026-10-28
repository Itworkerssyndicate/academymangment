/* ============================================================
   ITWS Platform — Public Header Component V2
   File: assets/js/ui/header.js
   Description: Responsive header — logo, nav, theme, user, notif

   Load order: AFTER app-title.js + permissions.js

   Features:
   - Sticky header
   - Logo + union name from settings
   - Dynamic nav (from settings.header.nav OR defaults)
   - Theme picker (FAB or integrated)
   - Notifications bell with count (if logged in)
   - User menu (avatar + name + dropdown)
   - Login button (if guest)
   - Mobile hamburger + drawer
   - Logout with confirmation
   - Realtime updates (settings, auth, notifications)
   - R13 responsive (mobile-first, safe-area, 44px targets)
   - Accessibility (ARIA, keyboard, focus trap)

   Rules:
   - No emoji
   - ES5-style IIFE
   - All strings from Labels.t()
   - All settings from AppSettings.get()
   - Self-contained (CSS injected)
   - No external dependencies
   ============================================================ */

(function () {
  'use strict';

  if (window.Header && window.Header._initialized) {
    return;
  }

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

  function icon(name, size) {
    try {
      if (window.Icons && typeof window.Icons.get === 'function') {
        return window.Icons.get(name, { size: size || 20 });
      }
    } catch (e) {}
    return '';
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
    realtimeUnsub: null,
    realtimeNotifUnsub: null
  };

  /* ============================================================
     3. CSS INJECTION (self-contained)
     ============================================================ */

  var STYLE_ID = 'itws-header-styles';

  function injectStyles() {
    if (document.getElementById(STYLE_ID)) return;

    var css = ''
      // ============ HEADER ============
      + '.itws-header{position:sticky;top:0;z-index:900;'
      + 'background:var(--surface,rgba(19,24,32,0.92));'
      + 'backdrop-filter:blur(20px);-webkit-backdrop-filter:blur(20px);'
      + 'border-bottom:1px solid var(--border,rgba(255,255,255,0.08));'
      + 'padding-top:env(safe-area-inset-top);'
      + 'transition:box-shadow 0.2s ease;}'
      + '.itws-header.is-scrolled{box-shadow:0 4px 20px rgba(0,0,0,0.15);}'

      + '.itws-header-inner{max-width:1280px;margin:0 auto;'
      + 'padding:0 clamp(12px,3vw,24px);'
      + 'height:clamp(56px,8vw,72px);'
      + 'display:flex;align-items:center;gap:clamp(12px,2vw,20px);}'

      // ============ BRAND ============
      + '.itws-brand{display:flex;align-items:center;gap:10px;'
      + 'text-decoration:none;color:inherit;flex-shrink:0;'
      + 'min-height:44px;transition:opacity 0.2s;}'
      + '.itws-brand:hover{opacity:0.85;}'
      + '.itws-brand-logo{width:clamp(36px,5vw,44px);height:clamp(36px,5vw,44px);'
      + 'border-radius:10px;'
      + 'background:linear-gradient(135deg,var(--primary,#CE1126),var(--primary-hover,#E63946));'
      + 'color:var(--primary-text,#fff);'
      + 'display:flex;align-items:center;justify-content:center;'
      + 'font-weight:800;font-size:clamp(14px,2.5vw,18px);'
      + 'overflow:hidden;flex-shrink:0;}'
      + '.itws-brand-logo img{width:100%;height:100%;object-fit:contain;'
      + 'padding:4px;background:var(--bg,#0A0E14);}'
      + '.itws-brand-text{display:none;flex-direction:column;line-height:1.2;}'
      + '.itws-brand-name{font-size:clamp(13px,1.8vw,15px);'
      + 'font-weight:800;color:var(--text,#F8FAFC);'
      + 'white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:220px;}'
      + '.itws-brand-tagline{font-size:10px;color:var(--text-muted,#64748B);'
      + 'font-weight:500;white-space:nowrap;overflow:hidden;'
      + 'text-overflow:ellipsis;max-width:220px;}'
      + '@media (min-width:640px){.itws-brand-text{display:flex;}}'

      // ============ NAV (desktop) ============
      + '.itws-nav{display:none;flex:1;justify-content:center;gap:4px;}'
      + '.itws-nav-link{display:inline-flex;align-items:center;gap:6px;'
      + 'padding:8px 14px;border-radius:8px;'
      + 'font-family:inherit;font-size:13px;font-weight:600;'
      + 'color:var(--text-secondary,#94A3B8);text-decoration:none;'
      + 'transition:all 0.15s;white-space:nowrap;min-height:44px;}'
      + '.itws-nav-link:hover{color:var(--text,#F8FAFC);'
      + 'background:var(--surface-hover,#252F3D);}'
      + '.itws-nav-link.is-active{color:var(--primary,#CE1126);'
      + 'background:var(--primary-soft,rgba(206,17,38,0.14));}'
      + '@media (min-width:1024px){.itws-nav{display:flex;}}'

      // ============ ACTIONS ============
      + '.itws-actions{display:flex;align-items:center;gap:6px;margin-right:auto;}'
      + '@media (min-width:1024px){.itws-actions{margin-right:0;}}'

      // ============ ICON BUTTON ============
      + '.itws-icon-btn{width:44px;height:44px;border-radius:10px;'
      + 'background:transparent;border:1px solid transparent;'
      + 'color:var(--text-secondary,#94A3B8);cursor:pointer;'
      + 'display:inline-flex;align-items:center;justify-content:center;'
      + 'transition:all 0.15s;position:relative;padding:0;flex-shrink:0;'
      + 'font-family:inherit;text-decoration:none;}'
      + '.itws-icon-btn:hover{background:var(--surface-hover,#252F3D);'
      + 'color:var(--text,#F8FAFC);border-color:var(--border,rgba(255,255,255,0.08));}'
      + '.itws-icon-btn:focus-visible{outline:2px solid var(--primary,#CE1126);'
      + 'outline-offset:2px;}'
      + '.itws-icon-btn svg{width:20px;height:20px;}'

      // ============ NOTIFICATION BADGE ============
      + '.itws-notif-badge{position:absolute;top:6px;right:6px;'
      + 'min-width:18px;height:18px;padding:0 5px;'
      + 'border-radius:999px;background:var(--error,#EF4444);'
      + 'color:#fff;font-size:10px;font-weight:800;'
      + 'display:none;align-items:center;justify-content:center;'
      + 'line-height:1;border:2px solid var(--surface,#131820);}'
      + '.itws-notif-badge.is-visible{display:inline-flex;}'

      // ============ LOGIN BUTTON ============
      + '.itws-login-btn{display:inline-flex;align-items:center;gap:6px;'
      + 'padding:10px 18px;background:var(--primary,#CE1126);'
      + 'color:var(--primary-text,#fff);'
      + 'border:none;border-radius:10px;'
      + 'font-family:inherit;font-size:13px;font-weight:700;'
      + 'cursor:pointer;text-decoration:none;'
      + 'transition:all 0.15s;min-height:44px;white-space:nowrap;}'
      + '.itws-login-btn:hover{background:var(--primary-hover,#E63946);'
      + 'transform:translateY(-1px);}'
      + '.itws-login-btn:focus-visible{outline:2px solid var(--primary,#CE1126);'
      + 'outline-offset:2px;}'
      + '.itws-login-btn svg{width:16px;height:16px;}'

      // ============ USER MENU ============
      + '.itws-user{position:relative;}'
      + '.itws-user-btn{display:inline-flex;align-items:center;gap:8px;'
      + 'padding:4px 10px 4px 4px;'
      + 'background:transparent;border:1px solid var(--border,rgba(255,255,255,0.08));'
      + 'border-radius:12px;cursor:pointer;'
      + 'font-family:inherit;transition:all 0.15s;min-height:44px;}'
      + '.itws-user-btn:hover{background:var(--surface-hover,#252F3D);'
      + 'border-color:var(--border-strong,rgba(255,255,255,0.15));}'
      + '.itws-user-avatar{width:32px;height:32px;border-radius:50%;'
      + 'background:linear-gradient(135deg,var(--primary,#CE1126),var(--primary-hover,#E63946));'
      + 'color:var(--primary-text,#fff);display:flex;'
      + 'align-items:center;justify-content:center;'
      + 'font-weight:800;font-size:13px;'
      + 'overflow:hidden;flex-shrink:0;}'
      + '.itws-user-avatar img{width:100%;height:100%;object-fit:cover;}'
      + '.itws-user-name{display:none;font-size:13px;font-weight:600;'
      + 'color:var(--text,#F8FAFC);max-width:100px;'
      + 'white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}'
      + '.itws-user-btn > svg.chevron{width:14px;height:14px;'
      + 'color:var(--text-muted,#64748B);transition:transform 0.2s;}'
      + '.itws-user.is-open .itws-user-btn > svg.chevron{transform:rotate(180deg);}'
      + '@media (min-width:640px){.itws-user-name{display:block;}}'

      // ============ DROPDOWN (shared) ============
      + '.itws-dropdown{position:absolute;top:calc(100% + 8px);left:0;'
      + 'min-width:min(280px,calc(100vw - 32px));max-width:calc(100vw - 32px);'
      + 'background:var(--surface-elevated,#1C2430);'
      + 'border:1px solid var(--border,rgba(255,255,255,0.1));'
      + 'border-radius:14px;box-shadow:0 20px 60px rgba(0,0,0,0.35);'
      + 'z-index:1000;opacity:0;transform:translateY(-6px) scale(0.98);'
      + 'pointer-events:none;transition:all 0.15s;overflow:hidden;}'
      + '.is-open > .itws-dropdown{opacity:1;transform:translateY(0) scale(1);'
      + 'pointer-events:auto;}'
      + '.itws-dropdown-head{padding:14px 16px;'
      + 'border-bottom:1px solid var(--border,rgba(255,255,255,0.08));}'
      + '.itws-dropdown-title{font-size:13px;font-weight:800;'
      + 'color:var(--text,#F8FAFC);margin:0 0 3px;}'
      + '.itws-dropdown-sub{font-size:11px;'
      + 'color:var(--text-muted,#64748B);margin:0;'
      + 'word-break:break-all;}'
      + '.itws-dropdown-body{padding:6px;max-height:min(400px,60vh);'
      + 'overflow-y:auto;overscroll-behavior:contain;}'
      + '.itws-menu-item{display:flex;align-items:center;gap:10px;'
      + 'padding:10px 12px;border-radius:8px;'
      + 'color:var(--text,#F8FAFC);font-family:inherit;'
      + 'font-size:13px;font-weight:500;text-decoration:none;'
      + 'background:transparent;border:none;cursor:pointer;'
      + 'transition:all 0.12s;width:100%;text-align:right;min-height:44px;}'
      + '.itws-menu-item:hover{background:var(--surface-hover,#252F3D);'
      + 'color:var(--primary,#CE1126);}'
      + '.itws-menu-item svg{width:16px;height:16px;flex-shrink:0;'
      + 'color:var(--text-muted,#64748B);}'
      + '.itws-menu-item:hover svg{color:var(--primary,#CE1126);}'
      + '.itws-menu-item.danger{color:var(--error,#EF4444);}'
      + '.itws-menu-item.danger svg{color:var(--error,#EF4444);}'
      + '.itws-menu-item.danger:hover{background:var(--error-soft,rgba(239,68,68,0.14));'
      + 'color:var(--error,#EF4444);}'
      + '.itws-menu-sep{height:1px;background:var(--border,rgba(255,255,255,0.08));'
      + 'margin:6px 4px;}'

      // ============ NOTIFICATIONS PANEL ============
      + '.itws-notif{position:relative;}'
      + '.itws-notif-panel .itws-dropdown-body{padding:0;max-height:min(450px,65vh);}'
      + '.itws-notif-item{display:flex;gap:10px;padding:12px 14px;'
      + 'border-bottom:1px solid var(--border,rgba(255,255,255,0.06));'
      + 'text-decoration:none;color:inherit;'
      + 'background:transparent;transition:background 0.15s;min-height:44px;}'
      + '.itws-notif-item:hover{background:var(--surface-hover,#252F3D);}'
      + '.itws-notif-item.unread{background:var(--primary-soft,rgba(206,17,38,0.08));}'
      + '.itws-notif-icon{width:36px;height:36px;border-radius:50%;'
      + 'background:var(--primary-soft,rgba(206,17,38,0.14));'
      + 'color:var(--primary,#CE1126);'
      + 'display:flex;align-items:center;justify-content:center;'
      + 'flex-shrink:0;}'
      + '.itws-notif-icon svg{width:16px;height:16px;}'
      + '.itws-notif-body{flex:1;min-width:0;}'
      + '.itws-notif-title{font-size:13px;font-weight:700;'
      + 'color:var(--text,#F8FAFC);margin:0 0 2px;'
      + 'line-height:1.4;}'
      + '.itws-notif-text{font-size:11px;'
      + 'color:var(--text-muted,#64748B);margin:0;'
      + 'line-height:1.5;}'
      + '.itws-notif-empty{padding:32px 16px;text-align:center;'
      + 'font-size:12px;color:var(--text-muted,#64748B);}'

      // ============ MOBILE MENU ============
      + '.itws-hamburger{display:inline-flex;}'
      + '@media (min-width:1024px){.itws-hamburger{display:none;}}'

      + '.itws-mobile-backdrop{position:fixed;inset:0;z-index:1500;'
      + 'background:rgba(0,0,0,0.5);backdrop-filter:blur(4px);'
      + 'opacity:0;pointer-events:none;transition:opacity 0.2s;}'
      + '.itws-mobile-backdrop.is-open{opacity:1;pointer-events:auto;}'

      + '.itws-mobile-drawer{position:fixed;top:0;right:0;bottom:0;'
      + 'width:min(320px,85vw);z-index:1501;'
      + 'background:var(--surface,#131820);'
      + 'border-left:1px solid var(--border,rgba(255,255,255,0.08));'
      + 'transform:translateX(100%);'
      + 'transition:transform 0.25s cubic-bezier(0.4,0,0.2,1);'
      + 'display:flex;flex-direction:column;'
      + 'padding-top:env(safe-area-inset-top);'
      + 'padding-bottom:env(safe-area-inset-bottom);'
      + 'box-shadow:-8px 0 30px rgba(0,0,0,0.3);}'
      + '.itws-mobile-drawer.is-open{transform:translateX(0);}'
      + '.itws-mobile-head{padding:16px;'
      + 'border-bottom:1px solid var(--border,rgba(255,255,255,0.08));'
      + 'display:flex;align-items:center;justify-content:space-between;gap:12px;}'
      + '.itws-mobile-title{font-size:14px;font-weight:800;'
      + 'color:var(--text,#F8FAFC);}'
      + '.itws-mobile-body{flex:1;overflow-y:auto;padding:8px;}'
      + '.itws-mobile-nav-link{display:flex;align-items:center;gap:12px;'
      + 'padding:14px 16px;border-radius:10px;'
      + 'color:var(--text,#F8FAFC);font-family:inherit;'
      + 'font-size:14px;font-weight:600;text-decoration:none;'
      + 'transition:all 0.15s;min-height:48px;}'
      + '.itws-mobile-nav-link:hover{background:var(--surface-hover,#252F3D);}'
      + '.itws-mobile-nav-link.is-active{color:var(--primary,#CE1126);'
      + 'background:var(--primary-soft,rgba(206,17,38,0.14));}'
      + '.itws-mobile-nav-link svg{width:18px;height:18px;flex-shrink:0;'
      + 'color:currentColor;}'
      + '.itws-mobile-sep{height:1px;background:var(--border,rgba(255,255,255,0.08));'
      + 'margin:8px 12px;}'
      + '.itws-mobile-foot{padding:12px;'
      + 'border-top:1px solid var(--border,rgba(255,255,255,0.08));}'

      // ============ AVATAR INITIAL ============
      + '.itws-avatar-initial{width:100%;height:100%;'
      + 'display:flex;align-items:center;justify-content:center;'
      + 'font-weight:800;}'

      // ============ SKIP LINK (a11y) ============
      + '.itws-skip-link{position:absolute;top:-100px;right:16px;'
      + 'padding:10px 16px;background:var(--primary,#CE1126);'
      + 'color:var(--primary-text,#fff);'
      + 'border-radius:8px;text-decoration:none;'
      + 'font-weight:600;font-size:13px;z-index:2000;}'
      + '.itws-skip-link:focus{top:12px;}'

      // ============ REDUCED MOTION ============
      + '@media (prefers-reduced-motion: reduce){'
      + '.itws-header *,.itws-mobile-drawer *,.itws-mobile-backdrop{'
      + 'animation-duration:0.01ms !important;'
      + 'transition-duration:0.01ms !important;}}';

    var style = document.createElement('style');
    style.id = STYLE_ID;
    style.textContent = css;
    document.head.appendChild(style);
  }

  /* ============================================================
     4. NAV ITEMS
     ============================================================ */

  function getNavItems() {
    // Priority 1: from settings.header.nav
    var custom = getSetting('header.nav', null);
    if (custom && Array.isArray(custom) && custom.length > 0) {
      return custom.filter(function (item) {
        return item && item.enabled !== false && item.href && (item.label_key || item.label);
      }).map(function (item) {
        return {
          key: item.key || item.href,
          href: item.href,
          label: item.label_key ? getLabel(item.label_key, item.label || '') : (item.label || ''),
          icon: item.icon || 'chevron-right',
          activeOn: item.active_on || [item.href]
        };
      });
    }

    // Priority 2: default nav
    return [
      { key: 'home', href: 'home.html', label: getLabel('pages.home.title', 'الرئيسية'), icon: 'home', activeOn: ['home.html', 'index.html', ''] },
      { key: 'verify', href: 'verify.html', label: getLabel('pages.verify.title', 'التحقق'), icon: 'badge-check', activeOn: ['verify.html'] },
      { key: 'student', href: 'student.html', label: getLabel('nav.student', 'صفحة المتدرب'), icon: 'graduation-cap', activeOn: ['student.html'] },
      { key: 'academies', href: 'academies.html', label: getLabel('nav.academies', 'الأكاديميات'), icon: 'briefcase', activeOn: ['academies.html', 'academy-details.html'] },
      { key: 'track', href: 'track.html', label: getLabel('nav.track', 'متابعة الطلب'), icon: 'clock', activeOn: ['track.html'] }
    ];
  }

  function isActiveNav(item) {
    try {
      var path = window.location.pathname || '';
      var filename = path.split('/').pop() || '';
      if (!filename) filename = 'index.html';
      return item.activeOn && item.activeOn.indexOf(filename) !== -1;
    } catch (e) {
      return false;
    }
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

    // Dashboard link based on role
    if (role === 'super_admin' || role === 'committee_head' || role === 'committee_deputy' || role === 'committee_member') {
      items.push({ href: 'admin/index.html', label: getLabel('nav.admin_dashboard', 'لوحة التحكم'), icon: 'home' });
    } else if (role && role.indexOf('branch_') === 0) {
      items.push({ href: 'branch/index.html', label: getLabel('nav.branch_dashboard', 'بوابة الفرع'), icon: 'home' });
    } else if (role === 'academy_owner' || role === 'academy_manager') {
      items.push({ href: 'portal/index.html', label: getLabel('nav.portal_dashboard', 'بوابة الأكاديمية'), icon: 'home' });
    }

    // Profile
    items.push({ href: 'portal/profile.html', label: getLabel('nav.profile', 'الملف الشخصي'), icon: 'user' });

    // My certificates (for students)
    if (role === 'user' || !role) {
      items.push({ href: 'student.html', label: getLabel('nav.my_certificates', 'شهاداتي'), icon: 'certificate' });
    }

    return items;
  }

  /* ============================================================
     6. RENDER — MAIN TEMPLATE
     ============================================================ */

  function renderHeader() {
    var unionName = getSetting('app_identity.union_name', 'نقابة تكنولوجيا المعلومات والبرمجيات');
    var committeeName = getSetting('app_identity.committee_name', '');
    var logoUrl = getSetting('app_identity.logo_url', '');
    var allowThemePicker = getSetting('behavior.enable_theme_picker_for_visitors', true);

    var navItems = getNavItems();
    var isGuest = !state.profile;
    var showNotif = !isGuest && getSetting('notifications.in_app_enabled', true);

    var logoHtml;
    if (logoUrl) {
      logoHtml = '<img src="' + escapeHtml(logoUrl) + '" alt="' + escapeHtml(unionName) + '" onerror="this.parentNode.textContent=\'ن\';">';
    } else {
      logoHtml = escapeHtml((unionName || 'ن').charAt(0));
    }

    // Nav HTML (desktop)
    var navHtml = navItems.map(function (item) {
      var active = isActiveNav(item) ? ' is-active' : '';
      return '<a href="' + escapeHtml(resolve(item.href)) + '" class="itws-nav-link' + active + '">'
        + icon(item.icon, 16) + '<span>' + escapeHtml(item.label) + '</span></a>';
    }).join('');

    // Mobile nav HTML
    var mobileNavHtml = navItems.map(function (item) {
      var active = isActiveNav(item) ? ' is-active' : '';
      return '<a href="' + escapeHtml(resolve(item.href)) + '" class="itws-mobile-nav-link' + active + '">'
        + icon(item.icon, 18) + '<span>' + escapeHtml(item.label) + '</span></a>';
    }).join('');

    // User area
    var userAreaHtml = '';
    if (isGuest) {
      userAreaHtml = '<a href="' + escapeHtml(resolve('login.html')) + '" class="itws-login-btn">'
        + icon('log-in', 16)
        + '<span>' + escapeHtml(getLabel('nav.login', 'دخول')) + '</span></a>';
    } else {
      var initials = getUserInitials(state.profile);
      var avatarHtml = state.profile.avatar_url
        ? '<img src="' + escapeHtml(state.profile.avatar_url) + '" alt="">'
        : '<span class="itws-avatar-initial">' + escapeHtml(initials) + '</span>';
      var displayName = state.profile.full_name || state.profile.email || '';

      var menuItems = getUserMenuItems();
      var menuHtml = menuItems.map(function (mi) {
        return '<a href="' + escapeHtml(resolve(mi.href)) + '" class="itws-menu-item">'
          + icon(mi.icon, 16) + '<span>' + escapeHtml(mi.label) + '</span></a>';
      }).join('');

      userAreaHtml = ''
        + '<div class="itws-user" id="itwsUserMenu">'
        +   '<button type="button" class="itws-user-btn" id="itwsUserBtn" '
        +     'aria-haspopup="true" aria-expanded="false" '
        +     'aria-label="' + escapeHtml(getLabel('nav.user_menu', 'قائمة المستخدم')) + '">'
        +     '<span class="itws-user-avatar">' + avatarHtml + '</span>'
        +     '<span class="itws-user-name">' + escapeHtml(displayName) + '</span>'
        +     icon('chevron-down', 14).replace('class="', 'class="chevron ')
        +   '</button>'
        +   '<div class="itws-dropdown itws-user-panel" role="menu">'
        +     '<div class="itws-dropdown-head">'
        +       '<p class="itws-dropdown-title">' + escapeHtml(displayName) + '</p>'
        +       '<p class="itws-dropdown-sub">' + escapeHtml(state.profile.email || '') + '</p>'
        +     '</div>'
        +     '<div class="itws-dropdown-body">'
        +       menuHtml
        +       '<div class="itws-menu-sep"></div>'
        +       '<button type="button" class="itws-menu-item danger" id="itwsLogoutBtn" role="menuitem">'
        +         icon('log-out', 16)
        +         '<span>' + escapeHtml(getLabel('nav.logout', 'تسجيل الخروج')) + '</span>'
        +       '</button>'
        +     '</div>'
        +   '</div>'
        + '</div>';
    }

    // Notifications
    var notifHtml = '';
    if (showNotif) {
      notifHtml = ''
        + '<div class="itws-notif" id="itwsNotifMenu">'
        +   '<button type="button" class="itws-icon-btn" id="itwsNotifBtn" '
        +     'aria-label="' + escapeHtml(getLabel('nav.notifications', 'الإشعارات')) + '" '
        +     'aria-haspopup="true" aria-expanded="false">'
        +     icon('bell', 20)
        +     '<span class="itws-notif-badge' + (state.unreadCount > 0 ? ' is-visible' : '') + '" id="itwsNotifBadge">'
        +       (state.unreadCount > 99 ? '99+' : String(state.unreadCount))
        +     '</span>'
        +   '</button>'
        +   '<div class="itws-dropdown itws-notif-panel" role="region" aria-label="الإشعارات">'
        +     '<div class="itws-dropdown-head">'
        +       '<p class="itws-dropdown-title">' + escapeHtml(getLabel('nav.notifications', 'الإشعارات')) + '</p>'
        +       (state.unreadCount > 0
        +         ? '<button type="button" class="itws-menu-item" id="itwsMarkAllRead" style="padding:4px 0;min-height:0;justify-content:flex-start;font-size:11px;color:var(--primary);">'
        +             + escapeHtml(getLabel('notifications.mark_all_read', 'تحديد الكل كمقروء'))
        +           + '</button>'
        +         : '')
        +     '</div>'
        +     '<div class="itws-dropdown-body" id="itwsNotifBody">'
        +       '<div class="itws-notif-empty">' + escapeHtml(getLabel('notifications.loading', 'جاري التحميل...')) + '</div>'
        +     '</div>'
        +   '</div>'
        + '</div>';
    }

    // Theme picker button
    var themeBtnHtml = '';
    if (allowThemePicker) {
      themeBtnHtml = ''
        + '<button type="button" class="itws-icon-btn" id="itwsThemeBtn" '
        +   'aria-label="' + escapeHtml(getLabel('nav.theme', 'تغيير الثيم')) + '">'
        +   icon('palette', 20)
        + '</button>';
    }

    // Skip link
    var skipHtml = '<a href="#main-content" class="itws-skip-link">'
      + escapeHtml(getLabel('a11y.skip_to_content', 'تخطي إلى المحتوى'))
      + '</a>';

    // Full template
    var html = ''
      + skipHtml
      + '<header class="itws-header" id="itwsHeader" role="banner">'
      +   '<div class="itws-header-inner">'
      +     '<a href="' + escapeHtml(resolve('home.html')) + '" class="itws-brand" aria-label="' + escapeHtml(unionName) + '">'
      +       '<div class="itws-brand-logo">' + logoHtml + '</div>'
      +       '<div class="itws-brand-text">'
      +         '<span class="itws-brand-name">' + escapeHtml(unionName) + '</span>'
      +         (committeeName ? '<span class="itws-brand-tagline">' + escapeHtml(committeeName) + '</span>' : '')
      +       '</div>'
      +     '</a>'
      +     '<nav class="itws-nav" role="navigation" aria-label="' + escapeHtml(getLabel('nav.main', 'القائمة الرئيسية')) + '">'
      +       navHtml
      +     '</nav>'
      +     '<div class="itws-actions">'
      +       themeBtnHtml
      +       notifHtml
      +       userAreaHtml
      +       '<button type="button" class="itws-icon-btn itws-hamburger" id="itwsHamburger" '
      +         'aria-label="' + escapeHtml(getLabel('nav.menu', 'القائمة')) + '" '
      +         'aria-controls="itwsMobileDrawer" aria-expanded="false">'
      +         icon('menu', 22)
      +       '</button>'
      +     '</div>'
      +   '</div>'
      + '</header>'
      // Mobile drawer
      + '<div class="itws-mobile-backdrop" id="itwsMobileBackdrop" aria-hidden="true"></div>'
      + '<aside class="itws-mobile-drawer" id="itwsMobileDrawer" '
      +   'aria-label="' + escapeHtml(getLabel('nav.mobile_menu', 'القائمة')) + '" '
      +   'aria-hidden="true" role="dialog">'
      +   '<div class="itws-mobile-head">'
      +     '<span class="itws-mobile-title">' + escapeHtml(unionName) + '</span>'
      +     '<button type="button" class="itws-icon-btn" id="itwsMobileClose" aria-label="إغلاق">'
      +       icon('x', 20)
      +     '</button>'
      +   '</div>'
      +   '<nav class="itws-mobile-body" role="navigation">'
      +     mobileNavHtml
      +   '</nav>'
      +   '<div class="itws-mobile-foot">'
      +     (isGuest
      +       ? '<a href="' + escapeHtml(resolve('login.html')) + '" class="itws-login-btn" style="width:100%;justify-content:center;">'
      +           + icon('log-in', 16) + '<span>' + escapeHtml(getLabel('nav.login', 'دخول')) + '</span></a>'
      +       : '<button type="button" class="itws-login-btn" id="itwsMobileLogout" style="width:100%;justify-content:center;background:var(--error,#EF4444);">'
      +           + icon('log-out', 16) + '<span>' + escapeHtml(getLabel('nav.logout', 'تسجيل الخروج')) + '</span></button>')
      +   '</div>'
      + '</aside>';

    return html;
  }

  /* ============================================================
     7. AUTH STATE
     ============================================================ */

  function loadAuthState() {
    var sb = getSb();
    if (!sb) return Promise.resolve();

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
        log('error', 'loadAuthState failed', err && err.message);
        state.user = null;
        state.profile = null;
      });
  }

  /* ============================================================
     8. NOTIFICATIONS
     ============================================================ */

  function loadNotifications() {
    var sb = getSb();
    if (!sb || !state.profile) return Promise.resolve();

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
        renderNotifications();
        updateNotifBadge();
      })
      .catch(function () {});
  }

  function renderNotifications() {
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

    // Mark as read on click
    body.querySelectorAll('[data-notif-id]').forEach(function (el) {
      el.addEventListener('click', function () {
        var id = el.getAttribute('data-notif-id');
        markNotificationRead(id);
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

  function markNotificationRead(id) {
    if (!id) return;
    var sb = getSb();
    if (!sb) return;
    sb.from('notifications')
      .update({ is_read: true, read_at: new Date().toISOString() })
      .eq('id', id)
      .then(function () {
        loadNotifications();
      })
      .catch(function () {});
  }

  function markAllRead() {
    var sb = getSb();
    if (!sb || !state.profile) return;
    sb.from('notifications')
      .update({ is_read: true, read_at: new Date().toISOString() })
      .eq('user_id', state.profile.id)
      .eq('is_read', false)
      .then(function () {
        loadNotifications();
      })
      .catch(function () {});
  }

  /* ============================================================
     9. EVENT BINDING
     ============================================================ */

  function bindEvents() {
    // Theme button
    var themeBtn = document.getElementById('itwsThemeBtn');
    if (themeBtn) {
      themeBtn.addEventListener('click', function () {
        openThemePicker();
      });
    }

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

    var markAllBtn = document.getElementById('itwsMarkAllRead');
    if (markAllBtn) markAllBtn.addEventListener('click', markAllRead);

    // Mobile drawer
    var hamburger = document.getElementById('itwsHamburger');
    var backdrop = document.getElementById('itwsMobileBackdrop');
    var drawer = document.getElementById('itwsMobileDrawer');
    var closeBtn = document.getElementById('itwsMobileClose');

    if (hamburger && drawer && backdrop) {
      hamburger.addEventListener('click', function () {
        openMobileMenu();
      });
    }
    if (backdrop) backdrop.addEventListener('click', closeMobileMenu);
    if (closeBtn) closeBtn.addEventListener('click', closeMobileMenu);

    // Esc closes
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape') {
        closeAllDropdowns();
        closeMobileMenu();
      }
    });

    // Outside click closes dropdowns
    document.addEventListener('click', function (e) {
      var target = e.target;
      var insideUser = userMenu && userMenu.contains(target);
      var insideNotif = notifMenu && notifMenu.contains(target);
      if (!insideUser && !insideNotif) {
        closeAllDropdowns();
      }
    });

    // Scroll shadow
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

  /* ============================================================
     10. THEME PICKER (reuse theme.js)
     ============================================================ */

  function openThemePicker() {
    // If theme.js has a picker, use it
    if (window.ITWSTheme && typeof window.ITWSTheme.openPicker === 'function') {
      try { window.ITWSTheme.openPicker(); return; } catch (e) {}
    }

    // Fallback: cycle through themes
    var themes = window.ITWS_THEMES || [];
    if (themes.length === 0) return;

    var current = window.ITWSTheme && window.ITWSTheme.getCurrent ? window.ITWSTheme.getCurrent() : 'watanii_dark';
    var idx = -1;
    for (var i = 0; i < themes.length; i++) {
      if (themes[i].id === current) { idx = i; break; }
    }
    var next = themes[(idx + 1) % themes.length];
    if (next && window.ITWSTheme && typeof window.ITWSTheme.change === 'function') {
      window.ITWSTheme.change(next.id);
      if (window.Utils && window.Utils.showToast) {
        window.Utils.showToast(getLabel('nav.theme_changed', 'تم تغيير الثيم'), 'success', { duration: 1500 });
      }
    }
  }

  /* ============================================================
     11. LOGOUT
     ============================================================ */

  function doLogout() {
    if (state.mobileOpen) closeMobileMenu();

    // Confirm
    var msg = getLabel('auth.logout.confirm', 'هل تريد تسجيل الخروج؟');
    if (!window.confirm(msg)) return;

    // Use Session.logout if available
    if (window.Session && typeof window.Session.logout === 'function') {
      window.Session.logout();
      return;
    }

    // Fallback
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
     12. REALTIME
     ============================================================ */

  function setupRealtime() {
    // Listen to settings changes → re-render header
    if (window.AppSettings && typeof window.AppSettings.onChange === 'function') {
      state.settingsUnsub = window.AppSettings.onChange(function (settings, changedKey) {
        if (!changedKey || changedKey === 'app_identity' || changedKey === 'behavior' || changedKey === 'header') {
          render();
        }
      });
    }

    // Listen to labels changes
    if (window.Labels && typeof window.Labels.onChange === 'function') {
      state.labelsUnsub = window.Labels.onChange(function (labels, changedKey) {
        if (!changedKey || (changedKey && (changedKey.indexOf('nav.') === 0 || changedKey.indexOf('pages.') === 0))) {
          render();
        }
      });
    }

    // Listen to auth changes
    state.authHandler = function () {
      loadAuthState().then(function () {
        render();
        loadNotifications();
      });
    };
    window.addEventListener('itws:auth-changed', state.authHandler);
    window.addEventListener('itws:signed-in', state.authHandler);
    window.addEventListener('itws:signed-out', state.authHandler);

    // Realtime notifications
    if (window.Realtime && typeof window.Realtime.subscribe === 'function' && state.profile) {
      try {
        state.realtimeNotifUnsub = window.Realtime.subscribe(
          'notifications',
          function (payload) {
            if (!state.profile) return;
            if (payload.batched) {
              payload.events.forEach(handleNotifEvent);
            } else {
              handleNotifEvent(payload);
            }
          },
          {
            filter: 'user_id=eq.' + state.profile.id,
            debounce: 800
          }
        );
      } catch (e) {
        log('error', 'Realtime notifications failed', e);
      }
    }
  }

  function handleNotifEvent(payload) {
    if (!payload) return;
    loadNotifications();
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
    if (state.realtimeNotifUnsub) {
      try { state.realtimeNotifUnsub(); } catch (e) {}
      state.realtimeNotifUnsub = null;
    }
    if (state.scrollHandler) {
      window.removeEventListener('scroll', state.scrollHandler);
      state.scrollHandler = null;
    }
  }

  /* ============================================================
     13. RENDER (public — re-renders in place)
     ============================================================ */

  function render() {
    if (!state.rootEl) return;
    state.rootEl.innerHTML = renderHeader();
    bindEvents();
  }

  /* ============================================================
     14. MOUNT
     ============================================================ */

  function mount(containerId) {
    if (typeof containerId !== 'string') containerId = 'headerContainer';

    var container = document.getElementById(containerId);
    if (!container) {
      log('error', 'Container not found: ' + containerId);
      return;
    }

    injectStyles();

    state.containerId = containerId;
    state.rootEl = container;

    loadAuthState()
      .then(function () {
        render();
        setupRealtime();
        if (state.profile) {
          loadNotifications();
        }
        state.mounted = true;
        dispatchEvent('itws:header-mounted', { containerId: containerId });
        log('debug', 'Header mounted', { user: state.profile ? state.profile.role : 'guest' });
      })
      .catch(function (err) {
        log('error', 'Mount failed', err);
        // Fallback — render as guest
        state.user = null;
        state.profile = null;
        render();
        setupRealtime();
        state.mounted = true;
      });
  }

  function refresh() {
    if (!state.mounted) return;
    loadAuthState().then(function () {
      render();
      if (state.profile) loadNotifications();
    });
  }

  function unmount() {
    if (!state.rootEl) return;
    teardownRealtime();
    state.rootEl.innerHTML = '';
    state.rootEl = null;
    state.mounted = false;
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

  // Shorthand
  window.mountHeader = mount;

  /* ============================================================
     16. AUTO-MOUNT
     ============================================================ */

  function autoMount() {
    var container = document.getElementById('headerContainer');
    if (!container) return;
    // Don't mount if container already has content
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
     17. DEBUG LOG
     ============================================================ */

  var cfg = window.ITWS_CONFIG || {};
  if (cfg.DEBUG) {
    try {
      console.log('%c[Header]', 'color: #8B5CF6; font-weight: bold;', 'Component ready');
    } catch (e) {}
  }

})();
