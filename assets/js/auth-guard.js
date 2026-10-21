// ============================================
// ITWS Platform - Auth Guard
// Path: assets/js/auth-guard.js
// ============================================
// ✅ إصلاح: منع deadlock في onAuthStateChange
// ✅ إضافة timeout لكل استدعاء (يمنع التعليق للأبد)
// ✅ مسارات نسبية (GitHub Pages)
// ✅ بدون إيموجي
// ============================================

(function () {
  'use strict';

  // ============================================
  // حماية من التهيئة المكررة
  // ============================================
  if (window.AuthGuard && window.AuthGuard.initialized) return;

  var cfg = window.ITWS_CONFIG || {};

  // مهلة قصوى لأي عملية auth (15 ثانية)
  var AUTH_TIMEOUT_MS = 15000;

  // حالة داخلية
  var state = {
    currentUser: null,
    authUser: null,
    initialized: false,
    listeners: [],
    checking: null,
    authChannel: null
  };

  // ============================================
  // 1. Timeout wrapper
  // ============================================
  // يمنع أي promise من التعليق للأبد
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
  function getBasePath() {
    if (window.resolveUrl) {
      return window.resolveUrl('').replace(/\/$/, '');
    }
    var base = cfg.BASE_PATH || '';
    return base.replace(/\/$/, '');
  }

  function resolvePath(path) {
    if (!path) return '#';
    if (/^https?:\/\//.test(path) || path.indexOf('mailto:') === 0 || path.indexOf('tel:') === 0) {
      return path;
    }
    if (window.resolveUrl) return window.resolveUrl(path);
    var base = cfg.BASE_PATH || '';
    if (base && base.charAt(base.length - 1) !== '/') base += '/';
    return base + String(path).replace(/^\.?\//, '');
  }

  function getLoginPage() {
    return resolvePath('login.html');
  }

  function getAdminPage() {
    return resolvePath('admin/index.html');
  }

  function getHomePage() {
    return resolvePath('home.html');
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
    if (cfg.DEBUG) {
      console.log.apply(console, ['[AuthGuard]'].concat(Array.prototype.slice.call(arguments)));
    }
  }

  // ============================================
  // 3. جلب المستخدم الحالي (مع timeout)
  // ============================================
  function getCurrentUser() {
    if (!window.sb) return Promise.resolve(null);

    var authPromise = window.sb.auth.getUser()
      .then(function (res) {
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
      })
      .catch(function (err) {
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

    // لو أصلاً في login، متحولش
    if (currentPath.indexOf('login.html') !== -1) return;

    var loginUrl = getLoginPage();
    var next = encodeURIComponent(currentPath);
    var sep = loginUrl.indexOf('?') !== -1 ? '&' : '?';
    window.location.href = loginUrl + sep + 'next=' + next;
  }

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

  // ============================================
  // 5. Guard (حماية الصفحة)
  // ============================================
  function guard(allowedRoles, options) {
    options = options || {};
    var redirectMode = options.redirect || 'login';

    // لو فيه فحص جاري، رجّع نفس الـ promise
    if (state.checking) return state.checking;

    // إخفاء المحتوى فوراً (منع flash)
    hideBody();

    state.checking = getCurrentUser()
      .then(function (user) {
        state.checking = null;

        // (أ) مش مسجل دخول
        if (!user) {
          if (redirectMode === 'login') redirectToLogin();
          else redirectToSafe(null);
          return null;
        }

        // (ب) الدور مش مطابق
        if (allowedRoles && allowedRoles.length > 0) {
          if (allowedRoles.indexOf(user.role) === -1) {
            showUnauthorizedMessage(user);
            setTimeout(function () {
              redirectToSafe(user);
            }, 1500);
            return null;
          }
        }

        // (ج) كل حاجة تمام
        showBody();
        notifyAuthReady(user);
        logDebug('Access granted:', user.email, '(', user.role, ')');
        return user;
      })
      .catch(function (err) {
        state.checking = null;
        logDebug('Guard error:', err.message);
        if (redirectMode === 'login') redirectToLogin();
        else redirectToSafe(null);
        return null;
      });

    return state.checking;
  }

  // ============================================
  // 6. Guards جاهزة
  // ============================================
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

  // ============================================
  // 7. Body visibility
  // ============================================
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

  // ============================================
  // 8. رسالة عدم التصريح
  // ============================================
  function showUnauthorizedMessage(user) {
    var msg = document.createElement('div');
    msg.id = 'itws-unauthorized-msg';
    msg.style.cssText = [
      'position:fixed',
      'inset:0',
      'display:flex',
      'flex-direction:column',
      'align-items:center',
      'justify-content:center',
      'background:var(--bg,#0A0E14)',
      'z-index:99999',
      'padding:20px',
      'text-align:center',
      'direction:rtl',
      'font-family:var(--font,Cairo,sans-serif)',
      'color:var(--text,#F8FAFC)'
    ].join(';');

    msg.innerHTML = '' +
      '<div style="width:80px;height:80px;border-radius:50%;background:var(--error-soft,rgba(239,68,68,0.12));display:flex;align-items:center;justify-content:center;font-size:40px;color:var(--error,#EF4444);margin-bottom:24px;font-weight:700;">&#10005;</div>' +
      '<h2 style="font-size:24px;margin-bottom:12px;font-weight:700;">غير مصرح لك بالوصول</h2>' +
      '<p style="color:var(--text-secondary,#94A3B8);font-size:14px;margin-bottom:20px;">هذه الصفحة مخصصة للمستخدمين المصرح لهم فقط</p>' +
      '<p style="color:var(--text-muted,#64748B);font-size:13px;">دورك الحالي: <strong style="color:var(--primary,#CE1126);">' +
        escapeHtml(translateRole(user.role)) +
      '</strong></p>' +
      '<p style="color:var(--text-muted,#64748B);font-size:13px;margin-top:20px;">جاري تحويلك للصفحة المناسبة...</p>';

    document.body.appendChild(msg);
  }

  // ============================================
  // 9. Logout
  // ============================================
  function logout() {
    // إيقاف session heartbeat أولاً
    if (window.SessionManager && window.SessionManager.stop) {
      try { window.SessionManager.stop(); } catch (e) {}
    }

    if (!window.sb) {
      window.location.href = getLoginPage();
      return Promise.resolve();
    }

    // تسجيل النشاط (اختياري، بدون انتظار)
    if (state.currentUser) {
      logActivity('logout', 'تسجيل خروج', {});
    }

    var signOutPromise = window.sb.auth.signOut();

    return withTimeout(signOutPromise, 5000, 'تسجيل الخروج')
      .then(function () {
        state.currentUser = null;
        state.authUser = null;
        window.location.href = getLoginPage();
      })
      .catch(function () {
        window.location.href = getLoginPage();
      });
  }

  // ============================================
  // 10. Log Activity
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
  // 11. onAuthChange (⚠️ ممنوع أي async هنا)
  // ============================================
  function onAuthChange(callback) {
    if (!window.sb) return null;
    if (typeof callback !== 'function') return null;

    state.listeners.push(callback);

    // تسجيل listener مرة واحدة فقط
    if (!state.authChannel) {
      var result = window.sb.auth.onAuthStateChange(function (event, session) {
        logDebug('Auth state changed:', event);

        // ✅ آمن: تحديث الحالة بس (متزامن)
        if (event === 'SIGNED_OUT') {
          state.currentUser = null;
          state.authUser = null;
        }

        // ✅ آمن: تأجيل تنفيذ كل listener بره الـ callback
        // عشان أي async جوه المستمع ميعملش deadlock
        var listeners = state.listeners.slice();
        listeners.forEach(function (cb) {
          setTimeout(function () {
            try {
              cb(event, session);
            } catch (e) {
              logDebug('Listener error:', e.message);
            }
          }, 0);
        });
      });

      // تخزين subscription لو متاح
      if (result && result.data && result.data.subscription) {
        state.authChannel = result.data.subscription;
      }
    }

    // return unsubscribe function
    return function unsubscribe() {
      var idx = state.listeners.indexOf(callback);
      if (idx !== -1) state.listeners.splice(idx, 1);
    };
  }

  // ============================================
  // 12. Notify
  // ============================================
  function notifyAuthReady(user) {
    try {
      window.dispatchEvent(new CustomEvent('itws:auth-ready', {
        detail: { user: user }
      }));
    } catch (e) {}
  }

  // ============================================
  // 13. Public API
  // ============================================
  window.AuthGuard = {
    initialized: true,

    // Core
    getCurrentUser: getCurrentUser,
    isAuthenticated: function () {
      return getCurrentUser().then(function (u) { return !!u; });
    },
    hasRole: function (role) {
      return getCurrentUser().then(function (u) {
        if (!u) return false;
        if (Array.isArray(role)) return role.indexOf(u.role) !== -1;
        return u.role === role;
      });
    },
    isAdmin: function () {
      return window.AuthGuard.hasRole(['super_admin', 'admin', 'committee_manager']);
    },
    isSuperAdmin: function () {
      return window.AuthGuard.hasRole('super_admin');
    },

    // Guards
    guard: guard,
    guardAdmin: guardAdmin,
    guardSuperAdmin: guardSuperAdmin,
    guardAcademy: guardAcademy,
    optional: optional,

    // Actions
    logout: logout,
    logActivity: logActivity,
    redirectToLogin: redirectToLogin,
    redirectToSafe: redirectToSafe,

    // Events
    onAuthChange: onAuthChange,

    // Helpers
    translateRole: translateRole,

    // State
    getUser: function () { return state.currentUser; }
  };

  // ============================================
  // 14. Auto-guard (حماية تلقائية بـ data attributes)
  // ============================================
  function autoGuard() {
    if (!document.body) return;

    var body = document.body;
    var requiresAuth = body.hasAttribute('data-requires-auth');
    var requiredRoles = body.getAttribute('data-required-roles');

    // صفحة عامة
    if (!requiresAuth) {
      showBody();
      getCurrentUser().then(function (user) {
        if (user) notifyAuthReady(user);
      });
      return;
    }

    // صفحة محمية
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

  // ============================================
  // 15. إشعار
  // ============================================
  if (cfg.DEBUG) {
    console.log('%c✅ [ITWS] AuthGuard ready', 'color: #10B981; font-weight: bold;');
  }

})();
