// ============================================
// ITWS Platform - Auth Guard
// Path: assets/js/auth-guard.js
// ============================================
// ✅ إصلاح: منع deadlock في onAuthStateChange
// ✅ إضافة timeout للاستدعاءات
// ✅ بدون إيموجي
// ============================================

(function () {
  'use strict';

  if (window.AuthGuard && window.AuthGuard.initialized) return;

  var cfg = window.ITWS_CONFIG;
  var AUTH_TIMEOUT_MS = 15000; // 15 ثانية كحد أقصى لأي عملية auth

  var state = {
    currentUser: null,
    authUser: null,
    initialized: false,
    listeners: [],
    checking: null,
    authChannel: null
  };

  // ============================================
  // 1. Timeout wrapper — يمنع التعليق للأبد
  // ============================================
  function withTimeout(promise, ms, label) {
    return Promise.race([
      promise,
      new Promise(function (_, reject) {
        setTimeout(function () {
          reject(new Error('انتهت مهلة ' + (label || 'العملية') + ' (' + ms + 'ms)'));
        }, ms);
      })
    ]);
  }

  // ============================================
  // 2. Helpers
  // ============================================
  function getLoginPage() {
    var base = (cfg && cfg.BASE_PATH) || '';
    return base + 'login.html';
  }

  function getAdminPage() {
    var base = (cfg && cfg.BASE_PATH) || '';
    return base + 'admin/index.html';
  }

  function getHomePage() {
    var base = (cfg && cfg.BASE_PATH) || '';
    return base + 'home.html';
  }

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

  // ============================================
  // 3. Get Current User (مع timeout)
  // ============================================
  function getCurrentUser() {
    if (!window.sb) return Promise.resolve(null);

    var authPromise = window.sb.auth.getUser().then(function (res) {
      if (!res || !res.data || !res.data.user) return null;
      state.authUser = res.data.user;

      return window.sb
        .from('profiles')
        .select('id, email, full_name, phone, role, is_active, created_at')
        .eq('id', res.data.user.id)
        .maybeSingle()
        .then(function (r) {
          if (r.error || !r.data) return null;
          if (r.data.is_active === false) return null;

          var profile = {
            id: r.data.id,
            email: r.data.email || res.data.user.email,
            full_name: r.data.full_name || res.data.user.email,
            phone: r.data.phone || '',
            role: r.data.role || 'user',
            is_active: r.data.is_active !== false,
            created_at: r.data.created_at
          };
          state.currentUser = profile;
          return profile;
        });
    }).catch(function (err) {
      logDebug('getCurrentUser error:', err.message);
      return null;
    });

    return withTimeout(authPromise, AUTH_TIMEOUT_MS, 'جلب بيانات المستخدم')
      .catch(function (err) {
        logDebug('getCurrentUser timeout:', err.message);
        return null;
      });
  }

  // ============================================
  // 4. Redirects
  // ============================================
  function redirectToLogin() {
    var currentPath = window.location.pathname + window.location.search;
    if (currentPath.indexOf('login.html') !== -1) return;
    var next = encodeURIComponent(currentPath);
    window.location.href = getLoginPage() + '?next=' + next;
  }

  function redirectToSafe(user) {
    if (!user) { redirectToLogin(); return; }
    var role = user.role;
    if (role === 'super_admin' || role === 'admin' || role === 'committee_manager') {
      window.location.href = getAdminPage();
    } else {
      window.location.href = getHomePage();
    }
  }

  // ============================================
  // 5. Guard
  // ============================================
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
          setTimeout(function () { redirectToSafe(user); }, 1500);
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

  function guardAdmin(options) { return guard(['super_admin', 'admin', 'committee_manager'], options); }
  function guardSuperAdmin(options) { return guard(['super_admin'], options); }
  function guardAcademy(options) { return guard(null, options); }

  function optional() {
    showBody();
    return getCurrentUser().then(function (user) {
      if (user) notifyAuthReady(user);
      return user;
    });
  }

  // ============================================
  // 6. Body visibility
  // ============================================
  function hideBody() {
    if (document.body) document.body.style.visibility = 'hidden';
    else document.addEventListener('DOMContentLoaded', function () {
      if (document.body) document.body.style.visibility = 'hidden';
    }, { once: true });
  }

  function showBody() {
    if (document.body) document.body.style.visibility = '';
  }

  // ============================================
  // 7. Unauthorized message
  // ============================================
  function showUnauthorizedMessage(user) {
    var msg = document.createElement('div');
    msg.style.cssText = [
      'position:fixed', 'inset:0', 'display:flex', 'flex-direction:column',
      'align-items:center', 'justify-content:center', 'background:var(--bg)',
      'z-index:99999', 'padding:20px', 'text-align:center', 'direction:rtl',
      'font-family:var(--font,sans-serif)', 'color:var(--text)'
    ].join(';');

    msg.innerHTML = '' +
      '<div style="width:80px;height:80px;border-radius:50%;background:var(--error-soft);display:flex;align-items:center;justify-content:center;font-size:40px;color:var(--error);margin-bottom:24px;font-weight:700;">&#10005;</div>' +
      '<h2 style="font-size:24px;margin-bottom:12px;font-weight:700;">غير مصرح لك بالوصول</h2>' +
      '<p style="color:var(--text-secondary);font-size:14px;margin-bottom:20px;">هذه الصفحة مخصصة للمستخدمين المصرح لهم فقط</p>' +
      '<p style="color:var(--text-muted);font-size:13px;">دورك الحالي: <strong style="color:var(--primary);">' + escapeHtml(translateRole(user.role)) + '</strong></p>';

    document.body.appendChild(msg);
  }

  // ============================================
  // 8. Logout
  // ============================================
  function logout() {
    if (window.SessionManager && window.SessionManager.stop) {
      try { window.SessionManager.stop(); } catch (e) {}
    }

    if (!window.sb) {
      window.location.href = getLoginPage();
      return Promise.resolve();
    }

    return window.sb.auth.signOut()
      .then(function () { window.location.href = getLoginPage(); })
      .catch(function () { window.location.href = getLoginPage(); });
  }

  // ============================================
  // 9. Log Activity
  // ============================================
  function logActivity(type, description, details) {
    if (!window.sb || !state.currentUser) return Promise.resolve();
    return window.sb.from('activities').insert({
      user_id: state.currentUser.id,
      user_name: state.currentUser.full_name,
      user_role: state.currentUser.role,
      action_type: type,
      description: description,
      details: details || {}
    }).catch(function () {});
  }

  // ============================================
  // 10. onAuthChange — ⚠️ ممنوع أي async هنا
  // ============================================
  function onAuthChange(callback) {
    if (!window.sb) return null;
    if (typeof callback !== 'function') return null;

    state.listeners.push(callback);

    if (!state.authChannel) {
      var result = window.sb.auth.onAuthStateChange(function (event, session) {
        logDebug('Auth state changed:', event);

        // ✅ نسجل الحالة بس — بدون أي استدعاءات Supabase API
        if (event === 'SIGNED_OUT') {
          state.currentUser = null;
          state.authUser = null;
        }

        // ✅ نبلغ المستمعين (بس هما مسؤولين عن أي async)
        state.listeners.forEach(function (cb) {
          try {
            // نأجل التنفيذ عشان نطلع برة الـ callback
            setTimeout(function () { cb(event, session); }, 0);
          } catch (e) {}
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

  function notifyAuthReady(user) {
    try {
      window.dispatchEvent(new CustomEvent('itws:auth-ready', { detail: { user: user } }));
    } catch (e) {}
  }

  // ============================================
  // 11. Public API
  // ============================================
  window.AuthGuard = {
    initialized: true,
    getCurrentUser: getCurrentUser,
    isAuthenticated: function () { return getCurrentUser().then(function (u) { return !!u; }); },
    hasRole: function (role) {
      return getCurrentUser().then(function (u) {
        if (!u) return false;
        if (Array.isArray(role)) return role.indexOf(u.role) !== -1;
        return u.role === role;
      });
    },
    isAdmin: function () { return window.AuthGuard.hasRole(['super_admin', 'admin', 'committee_manager']); },
    isSuperAdmin: function () { return window.AuthGuard.hasRole('super_admin'); },
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

  // ============================================
  // 12. Auto-guard
  // ============================================
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
