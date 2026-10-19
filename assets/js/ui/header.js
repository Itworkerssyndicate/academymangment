// ============================================
// ITWS Platform - Public Header
// Path: assets/js/ui/header.js
// ============================================
// ✅ إصلاح: كل الروابط تستخدم resolveUrl
// ✅ بدون إيموجي
// ============================================

(function () {
  'use strict';

  if (window.PublicHeader && window.PublicHeader.initialized) return;

  var cfg = window.ITWS_CONFIG;
  var state = { currentUser: null, settings: null, mobileOpen: false };

  // ✅ دالة محلية مضمونة
  function resolve(path) {
    if (!path) return '#';
    if (window.resolveUrl) return window.resolveUrl(path);
    var base = (cfg && cfg.BASE_PATH) || '';
    if (base && !base.endsWith('/')) base += '/';
    return base + String(path).replace(/^\.?\//, '');
  }

  function loadSettings() {
    if (!window.sb) return Promise.resolve(null);
    return window.sb.from('settings').select('value').eq('key', 'app_identity').maybeSingle()
      .then(function (res) {
        if (res.error || !res.data || !res.data.value) return null;
        state.settings = res.data.value;
        return state.settings;
      })
      .catch(function () { return null; });
  }

  function loadCurrentUser() {
    if (window.AuthGuard) {
      return window.AuthGuard.getCurrentUser().then(function (u) {
        state.currentUser = u;
        return u;
      });
    }
    return Promise.resolve(null);
  }

  function buildHTML() {
    var s = state.settings || {};
    var user = state.currentUser;

    var unionName = s.union_name || cfg.APP_NAME || 'نقابة تكنولوجيا المعلومات';
    var committeeName = s.committee_name || 'لجنة التحول الرقمي والتدريب';
    var logoUrl = s.logo_url || null;

    var logoMarkHtml = logoUrl
      ? '<img src="' + escapeAttr(logoUrl) + '" alt="" style="width:100%;height:100%;object-fit:contain;padding:4px;">'
      : 'نت';

    var actionsHtml = '';
    if (user) {
      var initial = (user.full_name || user.email || '?').charAt(0).toUpperCase();
      var roleLabel = translateRole(user.role);
      actionsHtml = '' +
        '<a href="' + resolve(isAdminRole(user.role) ? 'admin/index.html' : 'home.html') + '" class="btn btn-outline btn-sm">لوحة التحكم</a>' +
        '<div class="dropdown" id="userDropdown">' +
          '<button class="avatar avatar-primary" style="width:36px;height:36px;font-size:14px;cursor:pointer;" onclick="PublicHeader.toggleUserDropdown()">' +
            escapeHtml(initial) +
          '</button>' +
          '<div class="dropdown-menu">' +
            '<div style="padding:12px;border-bottom:1px solid var(--border);">' +
              '<div style="font-weight:600;font-size:13px;">' + escapeHtml(user.full_name) + '</div>' +
              '<div style="font-size:11px;color:var(--text-muted);">' + escapeHtml(roleLabel) + '</div>' +
            '</div>' +
            (isAdminRole(user.role) ? '<a href="' + resolve('admin/index.html') + '" class="dropdown-item">لوحة التحكم</a>' : '') +
            '<a href="' + resolve('portal/index.html') + '" class="dropdown-item">بوابتي</a>' +
            '<button class="dropdown-item danger" onclick="PublicHeader.logout()">تسجيل الخروج</button>' +
          '</div>' +
        '</div>';
    } else {
      actionsHtml = '<a href="' + resolve('login.html') + '" class="btn btn-primary btn-sm">تسجيل الدخول</a>';
    }

    return '' +
      '<header class="public-header" id="publicHeader">' +
        '<div class="public-header-inner">' +
          '<a href="' + resolve('home.html') + '" class="logo">' +
            '<div class="logo-mark">' + logoMarkHtml + '</div>' +
            '<div class="logo-text">' +
              '<span class="logo-title">' + escapeHtml(unionName) + '</span>' +
              '<span class="logo-subtitle">' + escapeHtml(committeeName) + '</span>' +
            '</div>' +
          '</a>' +
          '<nav class="public-nav">' +
            '<a href="' + resolve('home.html') + '" class="public-nav-link" data-nav="home">الرئيسية</a>' +
            '<a href="' + resolve('verify.html') + '" class="public-nav-link" data-nav="verify">التحقق من شهادة</a>' +
            '<a href="' + resolve('academies.html') + '" class="public-nav-link" data-nav="academies">الأكاديميات</a>' +
            '<a href="' + resolve('academy-apply.html') + '" class="public-nav-link" data-nav="apply">تقديم أكاديمية</a>' +
            '<a href="' + resolve('track.html') + '" class="public-nav-link" data-nav="track">متابعة طلب</a>' +
          '</nav>' +
          '<div class="public-header-actions">' + actionsHtml + '</div>' +
          '<button class="mobile-menu-btn" onclick="PublicHeader.openMobileNav()" aria-label="القائمة">&#9776;</button>' +
        '</div>' +
      '</header>' +
      '<div class="mobile-nav-overlay" id="mobileNavOverlay" onclick="PublicHeader.closeMobileNav()"></div>' +
      '<aside class="mobile-nav" id="mobileNav">' +
        '<div class="mobile-nav-header">' +
          '<div style="font-weight:700;">القائمة</div>' +
          '<button class="modal-close" onclick="PublicHeader.closeMobileNav()">&times;</button>' +
        '</div>' +
        '<nav class="mobile-nav-links">' +
          '<a href="' + resolve('home.html') + '" class="public-nav-link">الرئيسية</a>' +
          '<a href="' + resolve('verify.html') + '" class="public-nav-link">التحقق من شهادة</a>' +
          '<a href="' + resolve('academies.html') + '" class="public-nav-link">الأكاديميات</a>' +
          '<a href="' + resolve('academy-apply.html') + '" class="public-nav-link">تقديم أكاديمية</a>' +
          '<a href="' + resolve('track.html') + '" class="public-nav-link">متابعة طلب</a>' +
        '</nav>' +
      '</aside>';
  }

  function mount(targetSelector) {
    targetSelector = targetSelector || '#headerContainer';
    var container = document.querySelector(targetSelector);
    if (!container) {
      container = document.createElement('div');
      container.id = 'headerContainer';
      if (document.body) document.body.insertBefore(container, document.body.firstChild);
    }
    container.innerHTML = buildHTML();
    highlightActiveNav();
    setupScrollListener();
    setupClickOutside();
  }

  function highlightActiveNav() {
    var path = window.location.pathname;
    var fileName = path.split('/').pop() || 'home.html';
    var map = {
      'home.html': 'home', 'index.html': 'home',
      'verify.html': 'verify', 'student.html': 'verify',
      'academies.html': 'academies', 'academy-details.html': 'academies',
      'academy-apply.html': 'apply', 'track.html': 'track'
    };
    var nav = map[fileName];
    if (!nav) return;
    document.querySelectorAll('[data-nav="' + nav + '"]').forEach(function (el) {
      el.classList.add('active');
    });
  }

  function setupScrollListener() {
    var header = document.getElementById('publicHeader');
    if (!header) return;
    var onScroll = function () {
      header.classList.toggle('scrolled', window.scrollY > 20);
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    onScroll();
  }

  function setupClickOutside() {
    document.addEventListener('click', function (e) {
      var d = document.getElementById('userDropdown');
      if (d && !d.contains(e.target)) d.classList.remove('open');
    });
  }

  function toggleUserDropdown() {
    var d = document.getElementById('userDropdown');
    if (d) d.classList.toggle('open');
  }

  function openMobileNav() {
    var nav = document.getElementById('mobileNav');
    var overlay = document.getElementById('mobileNavOverlay');
    if (nav) nav.classList.add('open');
    if (overlay) overlay.classList.add('open');
    if (document.body) document.body.classList.add('no-scroll');
    state.mobileOpen = true;
  }

  function closeMobileNav() {
    var nav = document.getElementById('mobileNav');
    var overlay = document.getElementById('mobileNavOverlay');
    if (nav) nav.classList.remove('open');
    if (overlay) overlay.classList.remove('open');
    if (document.body) document.body.classList.remove('no-scroll');
    state.mobileOpen = false;
  }

  function logout() {
    if (window.AuthGuard && window.AuthGuard.logout) window.AuthGuard.logout();
    else if (window.sb) window.sb.auth.signOut().then(function () { window.location.href = resolve('login.html'); });
    else window.location.href = resolve('login.html');
  }

  function isAdminRole(r) { return r === 'super_admin' || r === 'admin' || r === 'committee_manager'; }

  function translateRole(r) {
    return { super_admin: 'سوبر أدمن', admin: 'أدمن', committee_manager: 'إدارة اللجنة', user: 'مستخدم' }[r] || 'مستخدم';
  }

  function escapeHtml(s) {
    if (s == null) return '';
    return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#039;');
  }

  function escapeAttr(s) { return escapeHtml(s); }

  function init(options) {
    options = options || {};
    var target = options.target || '#headerContainer';
    Promise.all([loadSettings(), loadCurrentUser()])
      .then(function () { mount(target); })
      .catch(function () { mount(target); });
  }

  window.PublicHeader = {
    initialized: true,
    init: init,
    mount: mount,
    toggleUserDropdown: toggleUserDropdown,
    openMobileNav: openMobileNav,
    closeMobileNav: closeMobileNav,
    logout: logout
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function () {
      if (document.querySelector('#headerContainer')) init();
    });
  } else {
    if (document.querySelector('#headerContainer')) init();
  }
})();
