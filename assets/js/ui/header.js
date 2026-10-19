// ============================================
// [15/50] ITWS Platform - Public Header Component
// Path: assets/js/ui/header.js
// ============================================
// 💡 يبني الـ header تلقائياً في أي صفحة
// 💡 يدعم: تسجيل دخول / خروج، القوائم، الموبايل
// 💡 يقرأ الإعدادات من Supabase (اسم النقابة، اللوجو)
// ============================================

(function () {
  'use strict';

  if (window.PublicHeader && window.PublicHeader.initialized) return;

  var cfg = window.ITWS_CONFIG;
  var state = {
    container: null,
    settings: null,
    currentUser: null,
    mobileOpen: false
  };

  // ============ 1. جلب إعدادات النقابة ============
  function loadSettings() {
    if (!window.sb) {
      return Promise.resolve(null);
    }
    return window.sb
      .from('settings')
      .select('value')
      .eq('key', 'general')
      .maybeSingle()
      .then(function (res) {
        if (res.error || !res.data || !res.data.value) return null;
        state.settings = res.data.value;
        return state.settings;
      })
      .catch(function () { return null; });
  }

  // ============ 2. جلب المستخدم الحالي ============
  function loadCurrentUser() {
    if (window.AuthGuard) {
      return window.AuthGuard.getCurrentUser().then(function (u) {
        state.currentUser = u;
        return u;
      });
    }
    return Promise.resolve(null);
  }

  // ============ 3. بناء HTML للـ header ============
  function buildHTML() {
    var s = state.settings || {};
    var user = state.currentUser;

    var unionName = s.union_name || cfg.APP_NAME || 'نقابة تكنولوجيا المعلومات';
    var committeeName = s.committee_name || 'لجنة التحول الرقمي والتدريب';
    var logoUrl = s.logo_url || null;
    var appUrl = cfg.APP_URL || '';

    // الشعار
    var logoMarkHtml = logoUrl
      ? '<img src="' + escapeAttr(logoUrl) + '" alt="' + escapeAttr(unionName) + '">'
      : 'ن.ت';

    // أزرار الدخول/الخروج
    var actionsHtml = '';
    if (user) {
      var initial = (user.full_name || user.email || '?').charAt(0).toUpperCase();
      var roleLabel = translateRole(user.role);
      actionsHtml = '' +
        '<a href="' + (isAdminRole(user.role) ? '/admin/index.html' : '/home.html') + '" class="btn btn-outline btn-sm">' +
          'لوحة التحكم' +
        '</a>' +
        '<div class="dropdown" id="userDropdown">' +
          '<button class="avatar avatar-primary" style="width:36px;height:36px;font-size:14px;cursor:pointer;" onclick="PublicHeader.toggleUserDropdown()" title="' + escapeAttr(user.full_name) + '">' +
            escapeHtml(initial) +
          '</button>' +
          '<div class="dropdown-menu">' +
            '<div style="padding:12px;border-bottom:1px solid var(--border);">' +
              '<div style="font-weight:600;color:var(--text);font-size:13px;">' + escapeHtml(user.full_name) + '</div>' +
              '<div style="font-size:11px;color:var(--text-muted);">' + escapeHtml(roleLabel) + '</div>' +
            '</div>' +
            (isAdminRole(user.role)
              ? '<a href="/admin/index.html" class="dropdown-item">📊 لوحة التحكم</a>'
              : '') +
            '<a href="/portal/index.html" class="dropdown-item">🎓 بوابتي</a>' +
            '<button class="dropdown-item danger" onclick="PublicHeader.logout()">🚪 تسجيل الخروج</button>' +
          '</div>' +
        '</div>';
    } else {
      actionsHtml = '' +
        '<a href="/login.html" class="btn btn-primary btn-sm">تسجيل الدخول</a>';
    }

    return '' +
      '<header class="public-header" id="publicHeader">' +
        '<div class="public-header-inner">' +
          '<a href="/home.html" class="logo">' +
            '<div class="logo-mark">' + logoMarkHtml + '</div>' +
            '<div class="logo-text">' +
              '<span class="logo-title">' + escapeHtml(unionName) + '</span>' +
              '<span class="logo-subtitle">' + escapeHtml(committeeName) + '</span>' +
            '</div>' +
          '</a>' +
          '<nav class="public-nav" id="publicNav">' +
            '<a href="/home.html" class="public-nav-link" data-nav="home">الرئيسية</a>' +
            '<a href="/verify.html" class="public-nav-link" data-nav="verify">التحقق من شهادة</a>' +
            '<a href="/academies.html" class="public-nav-link" data-nav="academies">الأكاديميات</a>' +
            '<a href="/academy-apply.html" class="public-nav-link" data-nav="apply">تقديم أكاديمية</a>' +
            '<a href="/track.html" class="public-nav-link" data-nav="track">متابعة طلب</a>' +
          '</nav>' +
          '<div class="public-header-actions" id="publicHeaderActions">' +
            actionsHtml +
          '</div>' +
          '<button class="mobile-menu-btn" onclick="PublicHeader.openMobileNav()" aria-label="فتح القائمة">☰</button>' +
        '</div>' +
      '</header>' +
      '<div class="mobile-nav-overlay" id="mobileNavOverlay" onclick="PublicHeader.closeMobileNav()"></div>' +
      '<aside class="mobile-nav" id="mobileNav">' +
        '<div class="mobile-nav-header">' +
          '<div style="font-weight:700;">القائمة</div>' +
          '<button class="modal-close" onclick="PublicHeader.closeMobileNav()">×</button>' +
        '</div>' +
        '<nav class="mobile-nav-links">' +
          '<a href="/home.html" class="public-nav-link" data-nav="home">🏠 الرئيسية</a>' +
          '<a href="/verify.html" class="public-nav-link" data-nav="verify">🔍 التحقق من شهادة</a>' +
          '<a href="/academies.html" class="public-nav-link" data-nav="academies">🏛️ الأكاديميات</a>' +
          '<a href="/academy-apply.html" class="public-nav-link" data-nav="apply">📝 تقديم أكاديمية</a>' +
          '<a href="/track.html" class="public-nav-link" data-nav="track">📋 متابعة طلب</a>' +
        '</nav>' +
      '</aside>';
  }

  // ============ 4. تركيب الـ header ============
  function mount(targetSelector) {
    targetSelector = targetSelector || '#headerContainer';
    var container = document.querySelector(targetSelector);

    if (!container) {
      // لو مفيش container، نضيفه أول الـ body
      container = document.createElement('div');
      container.id = 'headerContainer';
      if (document.body) {
        document.body.insertBefore(container, document.body.firstChild);
      }
    }

    state.container = container;
    container.innerHTML = buildHTML();

    // تفعيل الـ nav النشط
    highlightActiveNav();

    // scroll listener
    setupScrollListener();

    // click outside للمستخدم dropdown
    setupClickOutside();

    logDebug('Header mounted');
  }

  // ============ 5. تفعيل الـ nav النشط ============
  function highlightActiveNav() {
    var path = window.location.pathname;
    var fileName = path.split('/').pop() || 'home.html';

    var navMap = {
      'home.html': 'home',
      'index.html': 'home',
      'verify.html': 'verify',
      'student.html': 'verify',
      'academies.html': 'academies',
      'academy-details.html': 'academies',
      'academy-apply.html': 'apply',
      'track.html': 'track'
    };

    var activeNav = navMap[fileName] || null;
    if (!activeNav) return;

    document.querySelectorAll('[data-nav="' + activeNav + '"]').forEach(function (el) {
      el.classList.add('active');
    });
  }

  // ============ 6. scroll listener ============
  function setupScrollListener() {
    var header = document.getElementById('publicHeader');
    if (!header) return;

    var onScroll = function () {
      if (window.scrollY > 20) {
        header.classList.add('scrolled');
      } else {
        header.classList.remove('scrolled');
      }
    };

    window.addEventListener('scroll', onScroll, { passive: true });
    onScroll();
  }

  // ============ 7. click outside ============
  function setupClickOutside() {
    document.addEventListener('click', function (e) {
      var dropdown = document.getElementById('userDropdown');
      if (!dropdown) return;
      if (!dropdown.contains(e.target)) {
        dropdown.classList.remove('open');
      }
    });
  }

  // ============ 8. toggle user dropdown ============
  function toggleUserDropdown() {
    var dropdown = document.getElementById('userDropdown');
    if (dropdown) dropdown.classList.toggle('open');
  }

  // ============ 9. mobile nav ============
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

  // ============ 10. logout ============
  function logout() {
    if (window.AuthGuard && window.AuthGuard.logout) {
      window.AuthGuard.logout();
    } else if (window.sb) {
      window.sb.auth.signOut().then(function () {
        window.location.href = '/login.html';
      });
    } else {
      window.location.href = '/login.html';
    }
  }

  // ============ 11. helpers ============
  function isAdminRole(role) {
    return role === 'super_admin' || role === 'admin' || role === 'committee_manager';
  }

  function translateRole(role) {
    var map = {
      'super_admin': 'سوبر أدمن',
      'admin': 'أدمن',
      'committee_manager': 'إدارة اللجنة',
      'user': 'مستخدم'
    };
    return map[role] || role || 'مستخدم';
  }

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
      console.log.apply(console, ['[PublicHeader]'].concat(Array.prototype.slice.call(arguments)));
    }
  }

  // ============ 12. init ============
  function init(options) {
    options = options || {};
    var targetSelector = options.target || '#headerContainer';

    // نحمّل الإعدادات والمستخدم أولاً
    Promise.all([loadSettings(), loadCurrentUser()]).then(function () {
      mount(targetSelector);
    }).catch(function (err) {
      logDebug('Init error:', err.message);
      mount(targetSelector); // نعرض على الأقل header بسيط
    });
  }

  // ============ 13. Public API ============
  window.PublicHeader = {
    initialized: true,
    init: init,
    mount: mount,
    toggleUserDropdown: toggleUserDropdown,
    openMobileNav: openMobileNav,
    closeMobileNav: closeMobileNav,
    logout: logout,
    refresh: function () {
      return Promise.all([loadSettings(), loadCurrentUser()]).then(function () {
        mount();
      });
    }
  };

  // ============ 14. Auto-init ============
  // لو الصفحة فيها #headerContainer، يتم التركيب تلقائياً
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function () {
      if (document.querySelector('#headerContainer')) {
        init();
      }
    });
  } else {
    if (document.querySelector('#headerContainer')) {
      init();
    }
  }

})();
