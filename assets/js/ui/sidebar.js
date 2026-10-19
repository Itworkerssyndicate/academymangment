// ============================================
// [16/50] ITWS Platform - Sidebar Component
// Path: assets/js/ui/sidebar.js
// ============================================
// تصميم رسمي بدون إيموجي
// ============================================

(function () {
  'use strict';

  if (window.AppSidebar && window.AppSidebar.initialized) return;

  var cfg = window.ITWS_CONFIG;

  var state = {
    currentUser: null,
    settings: null,
    mode: 'admin',
    open: false,
    badges: {},
    container: null
  };

  // ============================================
  // 1. Menu Definition
  // ============================================
  function getMenuItems(role, mode) {
    if (mode === 'portal') {
      return [
        {
          group: 'الرئيسية',
          items: [
            { href: 'portal/index.html', label: 'لوحة التحكم', nav: 'dashboard' }
          ]
        },
        {
          group: 'ملف الأكاديمية',
          items: [
            { href: 'portal/application.html', label: 'طلب الاعتماد', nav: 'application', badge: 'requests' },
            { href: 'portal/branches.html', label: 'الفروع', nav: 'branches' },
            { href: 'portal/courses.html', label: 'الكورسات', nav: 'courses' },
            { href: 'portal/certificates.html', label: 'الشهادات', nav: 'certificates' }
          ]
        },
        {
          group: 'الحساب',
          items: [
            { href: 'portal/profile.html', label: 'بياناتي', nav: 'profile' }
          ]
        }
      ];
    }

    var isSuperAdmin = role === 'super_admin';
    var isAdmin = role === 'super_admin' || role === 'admin';
    var isCommittee = role === 'super_admin' || role === 'admin' || role === 'committee_manager';

    var menu = [];

    menu.push({
      group: 'الرئيسية',
      items: [
        { href: 'admin/index.html', label: 'لوحة التحكم', nav: 'dashboard' }
      ]
    });

    if (isCommittee) {
      var adminItems = [
        { href: 'admin/requests.html', label: 'طلبات الاعتماد', nav: 'requests', badge: 'pending_requests' },
        { href: 'admin/academies.html', label: 'الأكاديميات', nav: 'academies' },
        { href: 'admin/certificates.html', label: 'الشهادات', nav: 'certificates' }
      ];

      if (isAdmin) {
        adminItems.push({ href: 'admin/categories.html', label: 'التصنيفات', nav: 'categories' });
      }

      menu.push({
        group: 'الإدارة',
        items: adminItems
      });
    }

    if (isCommittee) {
      menu.push({
        group: 'التحليلات',
        items: [
          { href: 'admin/reports.html', label: 'التقارير', nav: 'reports' },
          { href: 'admin/activities.html', label: 'سجل النشاطات', nav: 'activities' }
        ]
      });
    }

    if (isSuperAdmin) {
      menu.push({
        group: 'النظام',
        items: [
          { href: 'admin/users.html', label: 'المستخدمون', nav: 'users' },
          { href: 'admin/login-logs.html', label: 'محاولات الدخول', nav: 'login-logs' },
          { href: 'admin/settings/index.html', label: 'الإعدادات', nav: 'settings' }
        ]
      });
    }

    return menu;
  }

  // ============================================
  // 2. Load User
  // ============================================
  function loadCurrentUser() {
    if (window.AuthGuard && window.AuthGuard.getCurrentUser) {
      return window.AuthGuard.getCurrentUser().then(function (u) {
        state.currentUser = u;
        return u;
      });
    }
    return Promise.resolve(null);
  }

  // ============================================
  // 3. Load Settings
  // ============================================
  function loadSettings() {
    if (!window.sb) return Promise.resolve(null);
    return window.sb.from('settings').select('value').eq('key', 'app_identity').maybeSingle()
      .then(function (res) {
        if (res.error || !res.data) return null;
        state.settings = res.data.value;
        return state.settings;
      })
      .catch(function () { return null; });
  }

  // ============================================
  // 4. Load Badges
  // ============================================
  function loadBadges(role, mode) {
    if (!window.sb) return Promise.resolve({});

    var promises = [];

    if (mode === 'admin' && role && role !== 'user') {
      promises.push(
        window.sb.from('accreditation_requests')
          .select('*', { count: 'exact', head: true })
          .in('current_stage', ['submitted', 'documents_review', 'site_visit', 'committee_review', 'final_approval'])
          .then(function (r) { return { key: 'pending_requests', value: r.count || 0 }; })
          .catch(function () { return { key: 'pending_requests', value: 0 }; })
      );
    }

    return Promise.all(promises).then(function (results) {
      var badges = {};
      results.forEach(function (r) { badges[r.key] = r.value; });
      state.badges = badges;
      return badges;
    });
  }

  // ============================================
  // 5. Build HTML
  // ============================================
  function buildHTML() {
    var user = state.currentUser;
    var settings = state.settings || {};
    var role = user ? user.role : 'user';

    var unionName = settings.union_name || cfg.APP_NAME || 'نقابة تكنولوجيا المعلومات';
    var logoUrl = settings.logo_url || null;
    var isPortal = state.mode === 'portal';

    var title = isPortal ? 'بوابة الأكاديمية' : 'لوحة الإدارة';
    var subtitle = isPortal ? 'نظام الاعتماد الرسمي' : 'نقابة تكنولوجيا المعلومات';

    var logoMarkHtml = logoUrl
      ? '<img src="' + escapeAttr(logoUrl) + '" alt="" style="width:100%;height:100%;object-fit:contain;padding:4px;">'
      : 'نت';

    var userInitial = user ? (user.full_name || user.email || '?').charAt(0).toUpperCase() : '?';
    var userName = user ? (user.full_name || user.email) : 'غير مسجل';
    var userRole = translateRole(role);

    var menu = getMenuItems(role, state.mode);
    var menuHtml = '';

    menu.forEach(function (group) {
      if (!group.items || group.items.length === 0) return;

      var itemsHtml = '';
      group.items.forEach(function (item) {
        var badgeHtml = '';
        if (item.badge && state.badges[item.badge] > 0) {
          badgeHtml = '<span class="sidebar-badge">' + state.badges[item.badge] + '</span>';
        }

        itemsHtml += '' +
          '<a href="' + escapeAttr(resolveUrl(item.href)) + '" ' +
             'class="sidebar-link" ' +
             'data-nav="' + escapeAttr(item.nav) + '">' +
            '<span>' + escapeHtml(item.label) + '</span>' +
            badgeHtml +
          '</a>';
      });

      menuHtml += '' +
        '<div class="sidebar-group">' +
          '<div class="sidebar-group-title">' + escapeHtml(group.group) + '</div>' +
          itemsHtml +
        '</div>';
    });

    return '' +
      '<aside class="app-sidebar" id="appSidebar">' +
        '<div class="app-sidebar-header">' +
          '<a href="' + resolveUrl(isPortal ? 'portal/index.html' : 'admin/index.html') + '" class="logo">' +
            '<div class="logo-mark">' + logoMarkHtml + '</div>' +
            '<div>' +
              '<div class="logo-title">' + escapeHtml(title) + '</div>' +
              '<div class="logo-subtitle">' + escapeHtml(subtitle) + '</div>' +
            '</div>' +
          '</a>' +
        '</div>' +
        '<nav class="app-sidebar-nav" id="sidebarNav">' +
          menuHtml +
        '</nav>' +
        '<div class="app-sidebar-footer">' +
          '<a href="' + resolveUrl(isPortal ? 'portal/profile.html' : 'home.html') + '" class="sidebar-user" style="text-decoration:none;color:inherit;">' +
            '<div class="avatar avatar-primary">' + escapeHtml(userInitial) + '</div>' +
            '<div class="sidebar-user-info">' +
              '<div class="sidebar-user-name">' + escapeHtml(userName) + '</div>' +
              '<div class="sidebar-user-role">' + escapeHtml(userRole) + '</div>' +
            '</div>' +
          '</a>' +
        '</div>' +
      '</aside>' +
      '<div class="sidebar-overlay" id="sidebarOverlay" onclick="AppSidebar.close()"></div>';
  }

  // ============================================
  // 6. Mount
  // ============================================
  function mount(targetSelector) {
    targetSelector = targetSelector || '#sidebarContainer';
    var container = document.querySelector(targetSelector);

    if (!container) {
      logDebug('Sidebar container not found:', targetSelector);
      return;
    }

    state.container = container;
    container.innerHTML = buildHTML();

    highlightActiveNav();
    setupMobileHandlers();
    logDebug('Sidebar mounted');
  }

  // ============================================
  // 7. Active Nav
  // ============================================
  function highlightActiveNav() {
    var path = window.location.pathname;
    var fileName = path.split('/').pop() || 'index.html';

    var navMap = {
      'index.html': 'dashboard',
      'dashboard.html': 'dashboard',
      'academies.html': 'academies',
      'academy-details.html': 'academies',
      'academy-edit.html': 'academies',
      'academy-add.html': 'academies',
      'categories.html': 'categories',
      'certificates.html': 'certificates',
      'certificate-add.html': 'certificates',
      'certificate-edit.html': 'certificates',
      'certificate-view.html': 'certificates',
      'requests.html': 'requests',
      'request-details.html': 'requests',
      'reports.html': 'reports',
      'activities.html': 'activities',
      'users.html': 'users',
      'login-logs.html': 'login-logs',
      'application.html': 'application',
      'branches.html': 'branches',
      'courses.html': 'courses',
      'profile.html': 'profile'
    };

    if (path.indexOf('/settings/') !== -1) {
      navMap[fileName] = 'settings';
    }

    var activeNav = navMap[fileName] || null;
    if (!activeNav) return;

    document.querySelectorAll('[data-nav="' + activeNav + '"]').forEach(function (el) {
      el.classList.add('active');
    });
  }

  // ============================================
  // 8. Mobile
  // ============================================
  function setupMobileHandlers() {
    var toggleBtn = document.getElementById('sidebarToggleBtn');
    if (toggleBtn) {
      toggleBtn.addEventListener('click', toggle);
    }

    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && state.open) close();
    });
  }

  function toggle() {
    if (state.open) close();
    else open();
  }

  function open() {
    var sidebar = document.getElementById('appSidebar');
    var overlay = document.getElementById('sidebarOverlay');
    if (sidebar) sidebar.classList.add('open');
    if (overlay) overlay.classList.add('open');
    if (document.body) document.body.classList.add('no-scroll');
    state.open = true;
  }

  function close() {
    var sidebar = document.getElementById('appSidebar');
    var overlay = document.getElementById('sidebarOverlay');
    if (sidebar) sidebar.classList.remove('open');
    if (overlay) overlay.classList.remove('open');
    if (document.body) document.body.classList.remove('no-scroll');
    state.open = false;
  }

  // ============================================
  // 9. Badges Update
  // ============================================
  function updateBadges() {
    Object.keys(state.badges).forEach(function (key) {
      var value = state.badges[key];
      var badgeEl = document.querySelector('.sidebar-badge[data-badge-key="' + key + '"]');

      if (value > 0) {
        if (badgeEl) {
          badgeEl.textContent = value;
        } else {
          var link = document.querySelector('.sidebar-link[data-nav="requests"]');
          if (link && key === 'pending_requests') {
            var badge = document.createElement('span');
            badge.className = 'sidebar-badge';
            badge.setAttribute('data-badge-key', key);
            badge.textContent = value;
            link.appendChild(badge);
          }
        }
      } else {
        if (badgeEl) badgeEl.remove();
      }
    });
  }

  // ============================================
  // 10. Helpers
  // ============================================
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

  function escapeAttr(str) { return escapeHtml(str); }

  function resolveUrl(path) {
    if (!path) return '#';
    if (window.resolveUrl) return window.resolveUrl(path);
    var base = (cfg && cfg.BASE_PATH) || '';
    return base + path;
  }

  function logDebug() {
    if (cfg && cfg.DEBUG) {
      console.log.apply(console, ['[AppSidebar]'].concat(Array.prototype.slice.call(arguments)));
    }
  }

  // ============================================
  // 11. Init
  // ============================================
  function init(options) {
    options = options || {};
    state.mode = options.mode || 'admin';
    var targetSelector = options.target || '#sidebarContainer';

    Promise.all([loadCurrentUser(), loadSettings()])
      .then(function (results) {
        var user = results[0];
        var role = user ? user.role : null;
        return loadBadges(role, state.mode).then(function () {
          mount(targetSelector);
        });
      })
      .catch(function (err) {
        logDebug('Init error:', err.message);
        mount(targetSelector);
      });
  }

  // ============================================
  // 12. Public API
  // ============================================
  window.AppSidebar = {
    initialized: true,
    init: init,
    mount: mount,
    toggle: toggle,
    open: open,
    close: close,
    updateBadges: function () {
      return loadBadges(
        state.currentUser ? state.currentUser.role : null,
        state.mode
      ).then(function () { updateBadges(); });
    },
    refresh: function () {
      return init({ mode: state.mode });
    }
  };

  // ============================================
  // 13. Auto-init
  // ============================================
  function autoInit() {
    var container = document.querySelector('#sidebarContainer');
    if (!container) return;

    var mode = container.getAttribute('data-mode') || 'admin';
    init({ mode: mode });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', autoInit);
  } else {
    autoInit();
  }

})();
