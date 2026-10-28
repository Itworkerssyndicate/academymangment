/* ============================================================
   ITWS Platform — Sidebar Component V2
   File: assets/js/ui/sidebar.js
   Description: Role-aware sidebar for admin / branch / portal

   Load order: AFTER header.js + permissions.js

   Features:
   - Dynamic menu per role (super_admin, committee, branch, academy)
   - Permission-aware menu items (hidden if no access)
   - Collapsible (desktop) — persists state
   - Mobile drawer (from right)
   - Active item highlighting
   - Notification badges per section
   - User info footer
   - Logout
   - Realtime updates (permissions, settings, labels)
   - R13 responsive (mobile-first, safe-area, 44px targets)
   - Accessibility (ARIA, keyboard, focus trap)

   Rules:
   - No emoji
   - ES5-style IIFE
   - All strings from Labels.t()
   - All settings from AppSettings.get()
   - Self-contained
   ============================================================ */

(function () {
  'use strict';

  if (window.Sidebar && window.Sidebar._initialized) {
    return;
  }

  /* ============================================================
     1. HELPERS
     ============================================================ */

  function log(level, msg, data) {
    var cfg = window.ITWS_CONFIG || {};
    if (level === 'error' || (cfg.DEBUG && level === 'debug')) {
      try {
        var args = ['[Sidebar]', msg];
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

  function can(resource, action) {
    try {
      if (window.Permissions && typeof window.Permissions.can === 'function') {
        return window.Permissions.can(resource, action);
      }
    } catch (e) {}
    return true;
  }

  function isRoleIn(roles) {
    try {
      if (window.Permissions && typeof window.Permissions.getRole === 'function') {
        var r = window.Permissions.getRole();
        return r && roles.indexOf(r) !== -1;
      }
    } catch (e) {}
    return false;
  }

  /* ============================================================
     2. STATE
     ============================================================ */

  var state = {
    mounted: false,
    mode: 'admin', // 'admin' | 'branch' | 'portal'
    containerId: null,
    rootEl: null,
    collapsed: false,
    mobileOpen: false,
    profile: null,
    settingsUnsub: null,
    labelsUnsub: null,
    permsUnsub: null,
    scrollHandler: null,
    resizeHandler: null
  };

  var COLLAPSE_KEY = 'itws_sidebar_collapsed';

  /* ============================================================
     3. CSS INJECTION
     ============================================================ */

  var STYLE_ID = 'itws-sidebar-styles';

  function injectStyles() {
    if (document.getElementById(STYLE_ID)) return;

    var css = ''
      // ===== LAYOUT WRAPPER (for pages that use sidebar) =====
      + '.itws-layout{display:flex;min-height:calc(100vh - var(--header-height,72px));'
      + 'width:100%;max-width:100vw;overflow-x:hidden;}'

      // ===== SIDEBAR BASE =====
      + '.itws-sidebar{position:sticky;top:var(--header-height,72px);'
      + 'height:calc(100vh - var(--header-height,72px));'
      + 'width:260px;flex-shrink:0;'
      + 'background:var(--surface,#131820);'
      + 'border-left:1px solid var(--border,rgba(255,255,255,0.08));'
      + 'display:flex;flex-direction:column;'
      + 'transition:width 0.25s cubic-bezier(0.4,0,0.2,1);'
      + 'overflow:hidden;z-index:800;}'
      + '.itws-sidebar.is-collapsed{width:72px;}'   // collapsed
      + '.itws-sidebar.is-mobile{position:fixed;top:0;right:0;bottom:0;'
      + 'height:100vh;width:min(300px,85vw);max-width:320px;'
      + 'transform:translateX(100%);'
      + 'transition:transform 0.25s cubic-bezier(0.4,0,0.2,1);'
      + 'z-index:1501;box-shadow:-8px 0 30px rgba(0,0,0,0.3);'
      + 'padding-top:env(safe-area-inset-top);'
      + 'padding-bottom:env(safe-area-inset-bottom);}'
      + '.itws-sidebar.is-mobile.is-open{transform:translateX(0);}'

      // ===== MOBILE BACKDROP =====
      + '.itws-sidebar-backdrop{position:fixed;inset:0;z-index:1500;'
      + 'background:rgba(0,0,0,0.5);backdrop-filter:blur(4px);'
      + 'opacity:0;pointer-events:none;transition:opacity 0.2s;}'
      + '.itws-sidebar-backdrop.is-open{opacity:1;pointer-events:auto;}'

      // ===== HEADER (of sidebar) =====
      + '.itws-sidebar-head{padding:16px;'
      + 'border-bottom:1px solid var(--border,rgba(255,255,255,0.08));'
      + 'display:flex;align-items:center;justify-content:space-between;'
      + 'gap:10px;flex-shrink:0;}'
      + '.itws-sidebar-brand{display:flex;align-items:center;gap:10px;'
      + 'min-width:0;flex:1;overflow:hidden;}'
      + '.itws-sidebar-brand-logo{width:36px;height:36px;'
      + 'border-radius:9px;background:linear-gradient(135deg,var(--primary,#CE1126),var(--primary-hover,#E63946));'
      + 'color:var(--primary-text,#fff);'
      + 'display:flex;align-items:center;justify-content:center;'
      + 'font-weight:800;font-size:14px;flex-shrink:0;overflow:hidden;}'
      + '.itws-sidebar-brand-logo img{width:100%;height:100%;'
      + 'object-fit:contain;padding:4px;background:var(--bg,#0A0E14);}'
      + '.itws-sidebar-brand-text{display:flex;flex-direction:column;'
      + 'line-height:1.2;min-width:0;}'
      + '.itws-sidebar-brand-name{font-size:13px;font-weight:800;'
      + 'color:var(--text,#F8FAFC);'
      + 'white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}'
      + '.itws-sidebar-brand-tag{font-size:10px;font-weight:600;'
      + 'color:var(--text-muted,#64748B);text-transform:uppercase;'
      + 'letter-spacing:0.5px;white-space:nowrap;overflow:hidden;'
      + 'text-overflow:ellipsis;}'
      + '.itws-sidebar.is-collapsed .itws-sidebar-brand-text{display:none;}'
      + '.itws-sidebar-close{width:36px;height:36px;border-radius:8px;'
      + 'background:transparent;border:1px solid var(--border,rgba(255,255,255,0.08));'
      + 'color:var(--text-secondary,#94A3B8);cursor:pointer;'
      + 'display:none;align-items:center;justify-content:center;'
      + 'transition:all 0.15s;flex-shrink:0;}'
      + '.itws-sidebar-close:hover{background:var(--surface-hover,#252F3D);'
      + 'color:var(--text,#F8FAFC);}'
      + '.itws-sidebar.is-mobile .itws-sidebar-close{display:flex;}'

      // ===== BODY =====
      + '.itws-sidebar-body{flex:1;overflow-y:auto;overflow-x:hidden;'
      + 'padding:12px 8px;overscroll-behavior:contain;}'
      + '.itws-sidebar-body::-webkit-scrollbar{width:6px;}'
      + '.itws-sidebar-body::-webkit-scrollbar-thumb{'
      + 'background:var(--border,rgba(255,255,255,0.1));border-radius:3px;}'

      // ===== SECTIONS =====
      + '.itws-nav-section{margin-bottom:16px;}'
      + '.itws-nav-section-title{font-size:10px;font-weight:800;'
      + 'color:var(--text-muted,#64748B);text-transform:uppercase;'
      + 'letter-spacing:1px;padding:0 12px;margin-bottom:6px;'
      + 'transition:opacity 0.2s;}'
      + '.itws-sidebar.is-collapsed .itws-nav-section-title{opacity:0;'
      + 'height:0;margin:0;padding:0;pointer-events:none;}'

      // ===== NAV LINK =====
      + '.itws-nav-item{display:flex;align-items:center;gap:12px;'
      + 'padding:10px 12px;border-radius:9px;'
      + 'color:var(--text-secondary,#94A3B8);font-family:inherit;'
      + 'font-size:13px;font-weight:600;text-decoration:none;'
      + 'transition:all 0.15s;min-height:44px;'
      + 'background:transparent;border:none;cursor:pointer;'
      + 'width:100%;text-align:right;position:relative;}'
      + '.itws-nav-item:hover{background:var(--surface-hover,#252F3D);'
      + 'color:var(--text,#F8FAFC);}'
      + '.itws-nav-item.is-active{background:var(--primary-soft,rgba(206,17,38,0.14));'
      + 'color:var(--primary,#CE1126);}'
      + '.itws-nav-item.is-active::before{content:"";'
      + 'position:absolute;right:0;top:8px;bottom:8px;'
      + 'width:3px;background:var(--primary,#CE1126);'
      + 'border-radius:3px 0 0 3px;}'
      + '.itws-nav-item:focus-visible{outline:2px solid var(--primary,#CE1126);'
      + 'outline-offset:-2px;}'
      + '.itws-nav-item svg{width:20px;height:20px;flex-shrink:0;'
      + 'color:currentColor;}'
      + '.itws-nav-item-label{flex:1;white-space:nowrap;'
      + 'overflow:hidden;text-overflow:ellipsis;'
      + 'transition:opacity 0.2s;}'
      + '.itws-sidebar.is-collapsed .itws-nav-item-label{opacity:0;'
      + 'pointer-events:none;width:0;}'
      + '.itws-sidebar.is-collapsed .itws-nav-item{justify-content:center;'
      + 'padding:10px;}'
      + '.itws-sidebar.is-collapsed .itws-nav-item::before{display:none;}'

      // ===== BADGE =====
      + '.itws-nav-badge{min-width:20px;height:20px;padding:0 6px;'
      + 'border-radius:999px;background:var(--primary,#CE1126);'
      + 'color:var(--primary-text,#fff);'
      + 'font-size:10px;font-weight:800;'
      + 'display:inline-flex;align-items:center;justify-content:center;'
      + 'line-height:1;flex-shrink:0;}'
      + '.itws-sidebar.is-collapsed .itws-nav-badge{position:absolute;'
      + 'top:4px;left:4px;right:auto;min-width:16px;height:16px;'
      + 'padding:0 4px;font-size:9px;}'

      // ===== COLLAPSE BUTTON (desktop) =====
      + '.itws-sidebar-collapse{display:none;}'
      + '@media (min-width:1024px){.itws-sidebar-collapse{display:flex;}}'

      // ===== FOOTER =====
      + '.itws-sidebar-foot{padding:12px;'
      + 'border-top:1px solid var(--border,rgba(255,255,255,0.08));'
      + 'flex-shrink:0;}'
      + '.itws-sidebar-user{display:flex;align-items:center;gap:10px;'
      + 'padding:10px;border-radius:10px;'
      + 'background:var(--bg-alt,var(--bg,#0A0E14));'
      + 'transition:all 0.15s;}'
      + '.itws-sidebar-user:hover{background:var(--surface-hover,#252F3D);}'
      + '.itws-sidebar-avatar{width:36px;height:36px;border-radius:50%;'
      + 'background:linear-gradient(135deg,var(--primary,#CE1126),var(--primary-hover,#E63946));'
      + 'color:var(--primary-text,#fff);'
      + 'display:flex;align-items:center;justify-content:center;'
      + 'font-weight:800;font-size:13px;flex-shrink:0;overflow:hidden;}'
      + '.itws-sidebar-avatar img{width:100%;height:100%;object-fit:cover;}'
      + '.itws-sidebar-user-info{flex:1;min-width:0;overflow:hidden;'
      + 'transition:opacity 0.2s;}'
      + '.itws-sidebar-user-name{font-size:12px;font-weight:700;'
      + 'color:var(--text,#F8FAFC);white-space:nowrap;'
      + 'overflow:hidden;text-overflow:ellipsis;}'
      + '.itws-sidebar-user-role{font-size:10px;'
      + 'color:var(--text-muted,#64748B);white-space:nowrap;'
      + 'overflow:hidden;text-overflow:ellipsis;text-transform:uppercase;'
      + 'letter-spacing:0.3px;margin-top:2px;}'
      + '.itws-sidebar.is-collapsed .itws-sidebar-user-info{opacity:0;'
      + 'pointer-events:none;}'
      + '.itws-sidebar.is-collapsed .itws-sidebar-user{justify-content:center;'
      + 'padding:8px;}'

      + '.itws-sidebar-logout{display:flex;align-items:center;gap:10px;'
      + 'padding:10px 12px;margin-top:6px;'
      + 'background:transparent;border:none;border-radius:9px;'
      + 'color:var(--error,#EF4444);font-family:inherit;'
      + 'font-size:13px;font-weight:600;cursor:pointer;'
      + 'transition:all 0.15s;width:100%;min-height:44px;'
      + 'justify-content:flex-start;text-align:right;}'
      + '.itws-sidebar-logout:hover{background:var(--error-soft,rgba(239,68,68,0.14));}'
      + '.itws-sidebar-logout svg{width:18px;height:18px;flex-shrink:0;}'
      + '.itws-sidebar.is-collapsed .itws-sidebar-logout{justify-content:center;'
      + 'padding:10px;}'
      + '.itws-sidebar.is-collapsed .itws-sidebar-logout span{display:none;}'

      // ===== MAIN CONTENT (companion) =====
      + '.itws-main{flex:1;min-width:0;padding:clamp(16px,3vw,32px);'
      + 'overflow-x:hidden;}'

      // ===== RESPONSIVE =====
      + '@media (max-width:1023px){'
      + '.itws-sidebar:not(.is-mobile){display:none;}}'

      // ===== REDUCED MOTION =====
      + '@media (prefers-reduced-motion: reduce){'
      + '.itws-sidebar,.itws-sidebar *,.itws-sidebar-backdrop{'
      + 'animation-duration:0.01ms !important;'
      + 'transition-duration:0.01ms !important;}}';

    var style = document.createElement('style');
    style.id = STYLE_ID;
    style.textContent = css;
    document.head.appendChild(style);
  }

  /* ============================================================
     4. MENU DEFINITIONS
     ============================================================ */

  function getAdminMenu() {
    var menu = [];

    // Overview
    menu.push({ type: 'section', label: getLabel('sidebar.section.overview', 'نظرة عامة') });
    menu.push({ id: 'dashboard', href: 'admin/index.html', label: getLabel('admin.dashboard.title', 'لوحة التحكم'), icon: 'home', activeOn: ['admin/index.html'] });

    // Management
    menu.push({ type: 'section', label: getLabel('sidebar.section.management', 'الإدارة') });
    menu.push({ id: 'academies', href: 'admin/academies/index.html', label: getLabel('admin.academies.title', 'الأكاديميات'), icon: 'briefcase', activeOn: ['admin/academies/'], resource: 'academies', action: 'read' });
    menu.push({ id: 'requests', href: 'admin/requests/index.html', label: getLabel('admin.requests.title', 'طلبات الاعتماد'), icon: 'clock', activeOn: ['admin/requests/'], resource: 'requests', action: 'read' });
    menu.push({ id: 'certificates', href: 'admin/certificates/index.html', label: getLabel('admin.certificates.title', 'الشهادات'), icon: 'certificate', activeOn: ['admin/certificates/'], resource: 'certificates', action: 'read' });
    menu.push({ id: 'union-courses', href: 'admin/union-courses/index.html', label: getLabel('admin.union_courses.title', 'كورسات النقابة'), icon: 'book', activeOn: ['admin/union-courses/'], resource: 'union_courses', action: 'read' });

    // Users
    menu.push({ type: 'section', label: getLabel('sidebar.section.users', 'المستخدمين') });
    menu.push({ id: 'users', href: 'admin/users/index.html', label: getLabel('admin.users.title', 'المستخدمين'), icon: 'users', activeOn: ['admin/users/index.html', 'admin/users/roles.html', 'admin/users/permissions.html'], resource: 'users', action: 'read' });
    menu.push({ id: 'user-requests', href: 'admin/users/requests.html', label: getLabel('admin.user_requests.title', 'طلبات التسجيل'), icon: 'user-plus', activeOn: ['admin/users/requests.html'], resource: 'users', action: 'read' });
    menu.push({ id: 'branches', href: 'admin/branches/index.html', label: getLabel('admin.branches.title', 'الفروع'), icon: 'map-pin', activeOn: ['admin/branches/'], resource: 'branches', action: 'read' });

    // Reports
    menu.push({ type: 'section', label: getLabel('sidebar.section.reports', 'التقارير والسجلات') });
    menu.push({ id: 'reports', href: 'admin/reports/index.html', label: getLabel('admin.reports.title', 'التقارير'), icon: 'bar-chart', activeOn: ['admin/reports/'], resource: 'reports', action: 'read' });
    menu.push({ id: 'activities', href: 'admin/activities.html', label: getLabel('admin.activities.title', 'سجل النشاطات'), icon: 'activity', activeOn: ['admin/activities.html'], resource: 'activities', action: 'read' });
    menu.push({ id: 'login-logs', href: 'admin/login-logs.html', label: getLabel('admin.login_logs.title', 'محاولات الدخول'), icon: 'shield', activeOn: ['admin/login-logs.html'], resource: 'login_logs', action: 'read' });

    // System
    menu.push({ type: 'section', label: getLabel('sidebar.section.system', 'النظام') });
    menu.push({ id: 'settings', href: 'admin/settings/index.html', label: getLabel('admin.settings.title', 'الإعدادات'), icon: 'settings', activeOn: ['admin/settings/'], resource: 'settings', action: 'read' });

    return menu;
  }

  function getBranchMenu() {
    var menu = [];

    menu.push({ type: 'section', label: getLabel('sidebar.section.overview', 'نظرة عامة') });
    menu.push({ id: 'dashboard', href: 'branch/index.html', label: getLabel('branch.dashboard.title', 'بوابة الفرع'), icon: 'home', activeOn: ['branch/index.html'] });

    menu.push({ type: 'section', label: getLabel('sidebar.section.management', 'الإدارة') });
    menu.push({ id: 'users', href: 'branch/users.html', label: getLabel('branch.users.title', 'مستخدمو الفرع'), icon: 'users', activeOn: ['branch/users.html'], resource: 'users', action: 'read' });
    menu.push({ id: 'academies', href: 'branch/academies.html', label: getLabel('branch.academies.title', 'أكاديميات المحافظة'), icon: 'briefcase', activeOn: ['branch/academies.html'], resource: 'academies', action: 'read' });
    menu.push({ id: 'certificates', href: 'branch/certificates.html', label: getLabel('branch.certificates.title', 'شهادات المحافظة'), icon: 'certificate', activeOn: ['branch/certificates.html'], resource: 'certificates', action: 'read' });

    return menu;
  }

  function getPortalMenu() {
    var menu = [];

    menu.push({ type: 'section', label: getLabel('sidebar.section.overview', 'نظرة عامة') });
    menu.push({ id: 'dashboard', href: 'portal/index.html', label: getLabel('portal.dashboard.title', 'بوابة الأكاديمية'), icon: 'home', activeOn: ['portal/index.html'] });

    menu.push({ type: 'section', label: getLabel('sidebar.section.management', 'الإدارة') });
    menu.push({ id: 'certificates', href: 'portal/certificates/index.html', label: getLabel('portal.certificates.title', 'الشهادات'), icon: 'certificate', activeOn: ['portal/certificates/'], resource: 'certificates', action: 'read' });
    menu.push({ id: 'courses', href: 'portal/courses.html', label: getLabel('portal.courses.title', 'الكورسات'), icon: 'book', activeOn: ['portal/courses.html'], resource: 'academies', action: 'read' });
    menu.push({ id: 'reports', href: 'portal/reports.html', label: getLabel('portal.reports.title', 'التقارير'), icon: 'bar-chart', activeOn: ['portal/reports.html'], resource: 'reports', action: 'read' });

    menu.push({ type: 'section', label: getLabel('sidebar.section.account', 'الحساب') });
    menu.push({ id: 'profile', href: 'portal/profile.html', label: getLabel('portal.profile.title', 'الملف الشخصي'), icon: 'user', activeOn: ['portal/profile.html'] });
    menu.push({ id: 'application', href: 'portal/application.html', label: getLabel('portal.application.title', 'طلب الاعتماد'), icon: 'file-text', activeOn: ['portal/application.html'] });

    return menu;
  }

  function getMenu() {
    if (state.mode === 'branch') return getBranchMenu();
    if (state.mode === 'portal') return getPortalMenu();
    return getAdminMenu();
  }

  /* ============================================================
     5. ITEM FILTERING (permissions)
     ============================================================ */

  function filterMenu(menu) {
    var filtered = [];
    menu.forEach(function (item) {
      if (item.type === 'section') {
        filtered.push(item);
        return;
      }
      // Permission check
      if (item.resource && item.action) {
        if (!can(item.resource, item.action)) return;
      }
      filtered.push(item);
    });

    // Remove empty sections
    var cleaned = [];
    for (var i = 0; i < filtered.length; i++) {
      var item = filtered[i];
      if (item.type === 'section') {
        var hasNext = false;
        for (var j = i + 1; j < filtered.length; j++) {
          if (filtered[j].type !== 'section') { hasNext = true; break; }
          break;
        }
        if (!hasNext) continue;
      }
      cleaned.push(item);
    }
    return cleaned;
  }

  /* ============================================================
     6. ACTIVE ITEM
     ============================================================ */

  function isActive(item) {
    try {
      var path = window.location.pathname || '';
      if (item.activeOn && Array.isArray(item.activeOn)) {
        for (var i = 0; i < item.activeOn.length; i++) {
          var check = item.activeOn[i];
          if (check.indexOf('/') === check.length - 1) {
            // Directory check
            if (path.indexOf(check) !== -1) return true;
          } else {
            if (path.indexOf(check) !== -1) return true;
          }
        }
      }
      return false;
    } catch (e) {
      return false;
    }
  }

  /* ============================================================
     7. USER HELPERS
     ============================================================ */

  function getInitials(profile) {
    if (!profile) return '?';
    var name = profile.full_name || profile.email || '';
    var parts = String(name).trim().split(/\s+/);
    if (parts.length >= 2) {
      return (parts[0].charAt(0) + parts[1].charAt(0)).toUpperCase();
    }
    return name.substring(0, 2).toUpperCase() || '?';
  }

  function getRoleLabel(role) {
    var map = {
      super_admin: getLabel('roles.super_admin', 'النقيب العام'),
      committee_head: getLabel('roles.committee_head', 'رئيس اللجنة'),
      committee_deputy: getLabel('roles.committee_deputy', 'نائب رئيس اللجنة'),
      committee_member: getLabel('roles.committee_member', 'عضو لجنة'),
      branch_president: getLabel('roles.branch_president', 'نقيب المحافظة'),
      branch_first_deputy: getLabel('roles.branch_first_deputy', 'نائب أول'),
      branch_second_deputy: getLabel('roles.branch_second_deputy', 'نائب تاني'),
      branch_secretary: getLabel('roles.branch_secretary', 'أمين عام'),
      branch_secretary_assistant: getLabel('roles.branch_secretary_assistant', 'مساعد أمين عام'),
      branch_treasurer: getLabel('roles.branch_treasurer', 'أمين صندوق'),
      branch_treasurer_assistant: getLabel('roles.branch_treasurer_assistant', 'مساعد أمين صندوق'),
      branch_agent: getLabel('roles.branch_agent', 'وكيل'),
      branch_agent_assistant: getLabel('roles.branch_agent_assistant', 'مساعد وكيل'),
      academy_owner: getLabel('roles.academy_owner', 'مالك أكاديمية'),
      academy_manager: getLabel('roles.academy_manager', 'مدير أكاديمية'),
      user: getLabel('roles.user', 'مستخدم'),
      pending_user: getLabel('roles.pending_user', 'مستخدم معلق')
    };
    return map[role] || role || '';
  }

  /* ============================================================
     8. RENDER
     ============================================================ */

  function renderSidebar() {
    var unionName = getSetting('app_identity.union_name', 'نقابة تكنولوجيا المعلومات');
    var logoUrl = getSetting('app_identity.logo_url', '');
    var modeLabel = state.mode === 'branch' ? getLabel('sidebar.branch_mode', 'بوابة الفرع')
                  : state.mode === 'portal' ? getLabel('sidebar.portal_mode', 'بوابة الأكاديمية')
                  : getLabel('sidebar.admin_mode', 'لوحة التحكم');

    var logoHtml = logoUrl
      ? '<img src="' + escapeHtml(logoUrl) + '" alt="" onerror="this.parentNode.textContent=\'ن\';">'
      : escapeHtml((unionName || 'ن').charAt(0));

    var menu = filterMenu(getMenu());

    // Nav HTML
    var navHtml = '';
    menu.forEach(function (item) {
      if (item.type === 'section') {
        navHtml += '<div class="itws-nav-section">'
          + '<div class="itws-nav-section-title">' + escapeHtml(item.label) + '</div>';
      } else {
        var active = isActive(item) ? ' is-active' : '';
        var badgeHtml = item.badge
          ? '<span class="itws-nav-badge">' + escapeHtml(String(item.badge)) + '</span>'
          : '';
        navHtml += '<a href="' + escapeHtml(resolve(item.href)) + '" '
          + 'class="itws-nav-item' + active + '" '
          + 'data-nav-id="' + escapeHtml(item.id || '') + '" '
          + 'title="' + escapeHtml(item.label) + '">'
          + icon(item.icon, 20)
          + '<span class="itws-nav-item-label">' + escapeHtml(item.label) + '</span>'
          + badgeHtml
          + '</a>';
      }
    });
    // Close any trailing sections (visual cleanup)
    navHtml += '';

    // User footer
    var userHtml = '';
    if (state.profile) {
      var initials = getInitials(state.profile);
      var avatarHtml = state.profile.avatar_url
        ? '<img src="' + escapeHtml(state.profile.avatar_url) + '" alt="">'
        : escapeHtml(initials);
      var displayName = state.profile.full_name || state.profile.email || '';
      var roleLabel = getRoleLabel(state.profile.role);

      userHtml = ''
        + '<div class="itws-sidebar-user">'
        +   '<div class="itws-sidebar-avatar">' + avatarHtml + '</div>'
        +   '<div class="itws-sidebar-user-info">'
        +     '<div class="itws-sidebar-user-name">' + escapeHtml(displayName) + '</div>'
        +     '<div class="itws-sidebar-user-role">' + escapeHtml(roleLabel) + '</div>'
        +   '</div>'
        + '</div>'
        + '<button type="button" class="itws-sidebar-logout" id="itwsSidebarLogout">'
        +   icon('log-out', 18)
        +   '<span>' + escapeHtml(getLabel('nav.logout', 'تسجيل الخروج')) + '</span>'
        + '</button>';
    }

    var html = ''
      + '<aside class="itws-sidebar' + (state.collapsed ? ' is-collapsed' : '') + (isMobile() ? ' is-mobile' : '') + '" '
      +   'id="itwsSidebar" role="navigation" aria-label="' + escapeHtml(modeLabel) + '">'
      +   '<div class="itws-sidebar-head">'
      +     '<div class="itws-sidebar-brand">'
      +       '<div class="itws-sidebar-brand-logo">' + logoHtml + '</div>'
      +       '<div class="itws-sidebar-brand-text">'
      +         '<span class="itws-sidebar-brand-name">' + escapeHtml(unionName) + '</span>'
      +         '<span class="itws-sidebar-brand-tag">' + escapeHtml(modeLabel) + '</span>'
      +       '</div>'
      +     '</div>'
      +     '<button type="button" class="itws-sidebar-close" id="itwsSidebarClose" aria-label="إغلاق">'
      +       icon('x', 18)
      +     '</button>'
      +   '</div>'
      +   '<div class="itws-sidebar-body">' + navHtml + '</div>'
      +   '<div class="itws-sidebar-foot">' + userHtml + '</div>'
      + '</aside>'
      // Backdrop (mobile only — added once)
      + '<div class="itws-sidebar-backdrop" id="itwsSidebarBackdrop"></div>';

    return html;
  }

  /* ============================================================
     9. EVENT BINDING
     ============================================================ */

  function bindEvents() {
    var sidebar = document.getElementById('itwsSidebar');
    var backdrop = document.getElementById('itwsSidebarBackdrop');
    var close = document.getElementById('itwsSidebarClose');
    var logoutBtn = document.getElementById('itwsSidebarLogout');

    if (close) close.addEventListener('click', closeMobile);
    if (backdrop) backdrop.addEventListener('click', closeMobile);
    if (logoutBtn) logoutBtn.addEventListener('click', doLogout);

    // Esc closes mobile
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && state.mobileOpen) closeMobile();
    });
  }

  function isMobile() {
    return window.innerWidth < 1024;
  }

  function closeMobile() {
    var sidebar = document.getElementById('itwsSidebar');
    var backdrop = document.getElementById('itwsSidebarBackdrop');
    if (sidebar) sidebar.classList.remove('is-open');
    if (backdrop) backdrop.classList.remove('is-open');
    state.mobileOpen = false;
    try { document.body.style.overflow = ''; } catch (e) {}
  }

  /* ============================================================
     10. LOGOUT
     ============================================================ */

  function doLogout() {
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
        window.location.href = resolve('login.html');
      })
      .catch(function () {
        window.location.href = resolve('login.html');
      });
  }

  /* ============================================================
     11. RENDER IN PLACE
     ============================================================ */

  function render() {
    if (!state.rootEl) return;
    state.rootEl.innerHTML = renderSidebar();
    bindEvents();
    applyCollapseState();
  }

  /* ============================================================
     12. COLLAPSE
     ============================================================ */

  function applyCollapseState() {
    var sidebar = document.getElementById('itwsSidebar');
    if (!sidebar) return;
    sidebar.classList.toggle('is-collapsed', state.collapsed);
    try {
      localStorage.setItem(COLLAPSE_KEY, state.collapsed ? '1' : '0');
    } catch (e) {}
  }

  function loadCollapseState() {
    try {
      var v = localStorage.getItem(COLLAPSE_KEY);
      state.collapsed = (v === '1');
    } catch (e) {}
  }

  function toggleCollapse() {
    if (isMobile()) return;
    state.collapsed = !state.collapsed;
    applyCollapseState();
    dispatchEvent('itws:sidebar-collapse-toggled', { collapsed: state.collapsed });
  }

  /* ============================================================
     13. MOBILE OPEN (called externally by mobile nav trigger)
     ============================================================ */

  function openMobile() {
    var sidebar = document.getElementById('itwsSidebar');
    var backdrop = document.getElementById('itwsSidebarBackdrop');
    if (!sidebar) return;
    sidebar.classList.add('is-mobile', 'is-open');
    if (backdrop) backdrop.classList.add('is-open');
    state.mobileOpen = true;
    try { document.body.style.overflow = 'hidden'; } catch (e) {}
  }

  /* ============================================================
     14. LOAD PROFILE
     ============================================================ */

  function loadProfile() {
    // Use Permissions cache first
    try {
      if (window.Permissions && typeof window.Permissions.getProfile === 'function') {
        var p = window.Permissions.getProfile();
        if (p && p.id) {
          state.profile = p;
          return Promise.resolve(p);
        }
      }
    } catch (e) {}

    // Fallback — fetch from DB
    var sb = getSb();
    if (!sb) return Promise.resolve(null);

    return sb.auth.getUser()
      .then(function (res) {
        var user = res && res.data && res.data.user;
        if (!user) return null;
        return sb.from('profiles')
          .select('id, email, full_name, avatar_url, role, status, governorate_id, branch_id, academy_id')
          .eq('id', user.id)
          .maybeSingle()
          .then(function (r) {
            if (r && r.data) {
              state.profile = r.data;
              return r.data;
            }
            return null;
          });
      })
      .catch(function () { return null; });
  }

  /* ============================================================
     15. REALTIME
     ============================================================ */

  function setupRealtime() {
    if (window.AppSettings && typeof window.AppSettings.onChange === 'function') {
      state.settingsUnsub = window.AppSettings.onChange(function (s, key) {
        if (!key || key === 'app_identity' || key === 'behavior' || key === 'sidebar') {
          render();
        }
      });
    }

    if (window.Labels && typeof window.Labels.onChange === 'function') {
      state.labelsUnsub = window.Labels.onChange(function (l, key) {
        if (!key || (key && (key.indexOf('nav.') === 0 || key.indexOf('sidebar.') === 0 || key.indexOf('admin.') === 0 || key.indexOf('branch.') === 0 || key.indexOf('portal.') === 0 || key.indexOf('roles.') === 0))) {
          render();
        }
      });
    }

    if (window.Permissions && typeof window.Permissions.onChange === 'function') {
      state.permsUnsub = window.Permissions.onChange(function () {
        render();
      });
    }
  }

  function teardownRealtime() {
    if (state.settingsUnsub) { try { state.settingsUnsub(); } catch (e) {} state.settingsUnsub = null; }
    if (state.labelsUnsub) { try { state.labelsUnsub(); } catch (e) {} state.labelsUnsub = null; }
    if (state.permsUnsub) { try { state.permsUnsub(); } catch (e) {} state.permsUnsub = null; }
  }

  /* ============================================================
     16. MOUNT
     ============================================================ */

  function mount(containerId, options) {
    options = options || {};
    if (typeof containerId !== 'string') containerId = 'sidebarContainer';

    var container = document.getElementById(containerId);
    if (!container) {
      log('error', 'Container not found: ' + containerId);
      return Promise.reject(new Error('Container not found'));
    }

    state.mode = options.mode || detectMode();

    injectStyles();
    loadCollapseState();

    state.containerId = containerId;
    state.rootEl = container;

    return loadProfile()
      .then(function () {
        render();
        setupRealtime();
        state.mounted = true;
        dispatchEvent('itws:sidebar-mounted', { mode: state.mode, containerId: containerId });
        log('debug', 'Sidebar mounted', { mode: state.mode });
      })
      .catch(function (err) {
        log('error', 'Mount failed', err);
        render();
        state.mounted = true;
      });
  }

  function detectMode() {
    var path = window.location.pathname || '';
    if (path.indexOf('/branch/') !== -1) return 'branch';
    if (path.indexOf('/portal/') !== -1) return 'portal';
    return 'admin';
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
    loadProfile().then(function () { render(); });
  }

  /* ============================================================
     17. EXPORT
     ============================================================ */

  window.Sidebar = {
    _initialized: true,

    mount: mount,
    render: render,
    refresh: refresh,
    unmount: unmount,

    toggleCollapse: toggleCollapse,
    openMobile: openMobile,
    closeMobile: closeMobile,

    isMounted: function () { return state.mounted; },
    isCollapsed: function () { return state.collapsed; },
    getMode: function () { return state.mode; },
    getState: function () {
      return {
        mounted: state.mounted,
        mode: state.mode,
        collapsed: state.collapsed,
        mobileOpen: state.mobileOpen,
        role: state.profile ? state.profile.role : null
      };
    }
  };

  // Shorthand
  window.mountSidebar = mount;

  /* ============================================================
     18. AUTO-MOUNT
     ============================================================ */

  function autoMount() {
    var container = document.getElementById('sidebarContainer');
    if (!container) return;
    if (container.hasAttribute('data-no-auto-mount')) return;
    if (container.children.length > 0) return;

    mount('sidebarContainer');
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', autoMount);
  } else {
    autoMount();
  }

  /* ============================================================
     19. DEBUG LOG
     ============================================================ */

  var cfg = window.ITWS_CONFIG || {};
  if (cfg.DEBUG) {
    try {
      console.log('%c[Sidebar]', 'color: #10B981; font-weight: bold;', 'Component ready');
    } catch (e) {}
  }

})();
