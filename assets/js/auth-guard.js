// ============================================
// [9/50] ITWS Platform - Auth Guard
// Path: assets/js/auth-guard.js
// ============================================
// إصلاح: استخدام resolveUrl() للتوافق مع GitHub Pages
// بدون إيموجي
// ============================================

(function () {
  'use strict';

  if (window.AuthGuard && window.AuthGuard.initialized) return;

  var cfg = window.ITWS_CONFIG;

  // ============ مساعدات المسار ============
  function resolve(path) {
    if (!path) return '#';
    if (window.resolveUrl) return window.resolveUrl(path);
    var base = (cfg && cfg.BASE_PATH) || '';
    return base + String(path).replace(/^\.?\//, '');
  }

  function getLoginPage() {
    var routes = (cfg && cfg.ROUTES) || {};
    return resolve(routes.LOGIN || 'login.html');
  }

  function getAdminPage() {
    var routes = (cfg && cfg.ROUTES) || {};
    return resolve(routes.ADMIN || 'admin/index.html');
  }

  function getHomePage() {
    var routes = (cfg && cfg.ROUTES) || {};
    return resolve(routes.HOME || 'home.html');
  }

  // ============ حالة ============
  var state = {
    currentUser: null,
    authUser: null,
    initialized: false,
    listeners: [],
    checking: null,
    authChannel: null
  };

  // ============ 1. جلب المستخدم الحالي ============
  function getCurrentUser() {
    if (!window.sb) return Promise.resolve(null);

    return window.sb.auth.getUser()
      .then(function (res) {
        if (!res || !res.data || !res.data.user) return null;
        var user = res.data.user;
        state.authUser = user;

        return window.sb
          .from('profiles')
          .select('id, email, full_name, phone, role, is_active, created_at')
          .eq('id', user.id)
          .maybeSingle()
          .then(function (r) {
            if (r.error || !r.data) return null;
            if (r.data.is_active === false) return null;

            var profile = {
              id: r.data.id,
              email: r.data.email || user.email,
              full_name: r.data.full_name || user.email,
              phone: r.data.phone || '',
              role: r.data.role || 'user',
              is_active: r.data.is_active !== false,
              created_at: r.data.created_at
            };
            state.currentUser = profile;
            return profile;
          });
      })
      .catch(function (err) {
        logDebug('getCurrentUser error:', err.message);
        return null;
      });
  }

  // ============ 2. هل مسجل دخول ============
  function isAuthenticated() {
    return getCurrentUser().then(function (u) { return !!u; });
  }

  // ============ 3. هل عنده دور ============
  function hasRole(role) {
    return getCurrentUser().then(function (u) {
      if (!u) return false;
      if (Array.isArray(role)) return role.indexOf(u.role) !== -1;
      return u.role === role;
    });
  }

  function isAdmin() {
    return hasRole(['super_admin', 'admin', 'committee_manager']);
  }

  function isSuperAdmin() {
    return hasRole('super_admin');
  }

  // ============ 4. Redirect to Login ============
  function redirectToLogin() {
    var currentPath = window.location.pathname + window.location.search;

    if (currentPath.indexOf('login.html') !== -1) return;

    var loginUrl = getLoginPage();
    var next = encodeURIComponent(currentPath);
    var sep = loginUrl.indexOf('?') !== -1 ? '&' : '?';
    window.location.href = loginUrl + sep + 'next=' + next;
  }

  // ============ 5. Redirect to Safe ============
  function redirectToSafe(user) {
    if (!user) {
      redirectToLogin();
      return;
    }

    var role = user.role;
    if (role === 'super_admin' || role === 'admin' || role === 'committee_manager') {
      window.location.href = getAdminPage();
    } else {
      window.location.href = getHomePage();
    }
  }

  // ============ 6. Guard ============
  function guard(allowedRoles, options) {
    options = options || {};
    var redirectMode = options.redirect || 'login';

    if (state.checking) return state.checking;

    hideBody();

    state.checking = getCurrentUser().then(function (user) {
      state.checking = null;

      if (!user) {
        if (redirectMode === 'login') redirectToLogin();
        else redirectToSafe(null);
        return null;
      }

      if (allowedRoles && allowedRoles.length > 0) {
        if (allowedRoles.indexOf(user.role) === -1) {
          showUnauthorizedMessage(user);
          setTimeout(function () {
            redirectToSafe(user);
          }, 1500);
          return null;
        }
      }

      showBody();
      notifyAuthReady(user);
      logDebug('Access granted:', user.email, '(', user.role, ')');
      return user;

    }).catch(function (err) {
      state.checking = null;
      logDebug('Guard error:', err.message);
      if (redirectMode === 'login') redirectToLogin();
      else redirectToSafe(null);
      return null;
    });

    return state.checking;
  }

  // ============ 7. Guard presets ============
  function guardAdmin(options) {
    return guard(['super_admin', 'admin', 'committee_manager'], options);
  }

  function guardSuperAdmin(options) {
    return guard(['super_admin'], options);
  }

  function guardAcademy(options) {
    return guard(null, options);
  }

  function optional() {
    showBody();
    return getCurrentUser().then(function (user) {
      if (user) notifyAuthReady(user);
      return user;
    });
  }

  // ============ 8. Body visibility ============
  function hideBody() {
    if (document.body) {
      document.body.style.visibility = 'hidden';
    } else {
      document.addEventListener('DOMContentLoaded', function () {
        if (document.body) document.body.style.visibility = 'hidden';
      }, { once: true });
    }
  }

  function showBody() {
    if (document.body) {
      document.body.style.visibility = '';
    }
  }

  // ============ 9. Unauthorized message ============
  function showUnauthorizedMessage(user) {
    var msg = document.createElement('div');
    msg.style.cssText = [
      'position:fixed',
      'inset:0',
      'display:flex',
      'flex-direction:column',
      'align-items:center',
      'justify-content:center',
      'background:var(--bg)',
      'z-index:99999',
      'padding:20px',
      'text-align:center',
      'direction:rtl',
      'font-family:var(--font,sans-serif)',
      'color:var(--text)'
    ].join(';');

    msg.innerHTML = '' +
      '<div style="width:80px;height:80px;border-radius:50%;background:var(--error-soft);display:flex;align-items:center;justify-content:center;font-size:40px;color:var(--error);margin-bottom:24px;font-weight:700;">&#10005;</div>' +
      '<h2 style="font-size:24px;margin-bottom:12px;font-weight:700;">غير مصرح لك بالوصول</h2>' +
      '<p style="color:var(--text-secondary);font-size:14px;margin-bottom:20px;">' +
        'هذه الصفحة مخصصة للمستخدمين المصرح لهم فقط' +
      '</p>' +
      '<p style="color:var(--text-muted);font-size:13px;">' +
        'دورك الحالي: <strong style="color:var(--primary);">' + escapeHtml(translateRole(user.role)) + '</strong>' +
      '</p>' +
      '<p style="color:var(--text-muted);font-size:13px;margin-top:20px;">' +
        'جاري تحويلك للصفحة المناسبة...' +
      '</p>';

    document.body.appendChild(msg);
  }

  // ============ 10. Logout ============
  function logout() {
    if (window.SessionManager && window.SessionManager.stop) {
      window.SessionManager.stop();
    }

    if (!window.sb) {
      window.location.href = getLoginPage();
      return Promise.resolve();
    }

    if (state.currentUser) {
      logActivity('logout', 'تسجيل خروج', {});
    }

    return window.sb.auth.signOut()
      .then(function () {
        state.currentUser = null;
        state.authUser = null;
        window.location.href = getLoginPage();
      })
      .catch(function () {
        window.location.href = getLoginPage();
      });
  }

  // ============ 11. Activity log ============
  function logActivity(type, description, details) {
    if (!window.sb || !state.currentUser) return Promise.resolve();

    return window.sb.from('activities').insert({
      user_id: state.currentUser.id,
      user_name: state.currentUser.full_name,
      user_role: state.currentUser.role,
      action_type: type,
      description: description,
      details: details || {}
    }).then(function () {
      logDebug('Activity logged:', type);
    }).catch(function (err) {
      logDebug('Activity log failed:', err.message);
    });
  }

  // ============ 12. Auth change listener ============
  function onAuthChange(callback) {
    if (!window.sb) return null;
    if (typeof callback !== 'function') return null;

    state.listeners.push(callback);

    if (!state.authChannel) {
      var result = window.sb.auth.onAuthStateChange(function (event, session) {
        logDebug('Auth state changed:', event);

        if (event === 'SIGNED_OUT') {
          state.currentUser = null;
          state.authUser = null;
        } else if (event === 'SIGNED_IN' && session) {
          setTimeout(function () {
            getCurrentUser().then(function (user) {
              if (user) notifyAuthReady(user);
            });
          }, 100);
        }

        state.listeners.forEach(function (cb) {
          try { cb(event, session); } catch (e) {}
        });
      });

      if (result && result.data && result.data.subscription) {
        state.authChannel = result.data.subscription;
      }
    }

    return function unsubscribe() {
      var idx = state.listeners.indexOf(callback);
      if (idx !== -1) state.listeners.splice(idx, 1);
    };
  }

  // ============ 13. Notify ============
  function notifyAuthReady(user) {
    try {
      window.dispatchEvent(new CustomEvent('itws:auth-ready', {
        detail: { user: user }
      }));
    } catch (e) {}
  }

  // ============ 14. Helpers ============
  function translateRole(role) {
    var map = {
      'super_admin': 'سوبر أدمن',
      'admin': 'أدمن',
      'committee_manager': 'إدارة اللجنة',
      'user': 'مستخدم'
    };
    return map[role] || role || 'غير معروف';
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

  function logDebug() {
    if (cfg && cfg.DEBUG) {
      console.log.apply(console, ['[AuthGuard]'].concat(Array.prototype.slice.call(arguments)));
    }
  }

  // ============ 15. Public API ============
  window.AuthGuard = {
    initialized: true,

    getCurrentUser: getCurrentUser,
    isAuthenticated: isAuthenticated,
    hasRole: hasRole,
    isAdmin: isAdmin,
    isSuperAdmin: isSuperAdmin,

    guard: guard,
    guardAdmin: guardAdmin,
    guardSuperAdmin: guardSuperAdmin,
    guardAcademy: guardAcademy,
    optional: optional,

    logout: logout,
    logActivity: logActivity,
    redirectToLogin: redirectToLogin,
    redirectToSafe: redirectToSafe,

    onAuthChange: onAuthChange,
    translateRole: translateRole,

    getUser: function () { return state.currentUser; }
  };

  // ============ 16. Auto-guard ============
  function autoGuard() {
    if (!document.body) return;

    var body = document.body;
    var requiresAuth = body.hasAttribute('data-requires-auth');
    var requiredRoles = body.getAttribute('data-required-roles');

    if (!requiresAuth) {
      showBody();
      getCurrentUser().then(function (user) {
        if (user) notifyAuthReady(user);
      });
      return;
    }

    var roles = null;
    if (requiredRoles) {
      roles = requiredRoles.split(',').map(function (r) { return r.trim(); });
    }

    guard(roles, { redirect: 'login' });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', autoGuard);
  } else {
    autoGuard();
  }

})();
