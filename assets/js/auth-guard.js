// ============================================
// [9/50] ITWS Platform - Auth Guard
// Path: assets/js/auth-guard.js
// ============================================
// 💡 يحمي الصفحات المحمية
// 💡 يتحقق من تسجيل الدخول + الدور قبل أي محتوى
// 💡 يمنع flash of content غير مصرح به
// 💡 يوفر بيانات المستخدم لكل الصفحات
// ============================================

(function () {
  'use strict';

  // ============ حماية من التهيئة المكررة ============
  if (window.AuthGuard && window.AuthGuard.initialized) return;

  var cfg = window.ITWS_CONFIG;
  var ROUTES = (cfg && cfg.ROUTES) || {};
  var LOGIN_PAGE = ROUTES.LOGIN || '/login.html';

  // ============ حالة داخلية ============
  var state = {
    currentUser: null,        // { id, email, role, full_name, is_active }
    authUser: null,           // raw Supabase user
    initialized: false,
    listeners: [],
    checking: false
  };

  // ============ 1. جلب المستخدم الحالي (كامل) ============
  function getCurrentUser() {
    if (!window.sb) return Promise.resolve(null);

    return window.sb.auth.getUser()
      .then(function (res) {
        if (!res || !res.data || !res.data.user) {
          return null;
        }
        var user = res.data.user;
        state.authUser = user;

        // جلب بيانات الملف الشخصي من جدول profiles
        return window.sb
          .from('profiles')
          .select('id, email, full_name, phone, role, is_active, created_at')
          .eq('id', user.id)
          .maybeSingle()
          .then(function (r) {
            if (r.error || !r.data) {
              return null;
            }
            if (r.data.is_active === false) {
              return null; // حساب معطل
            }
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

  // ============ 2. هل المستخدم مسجل دخول؟ ============
  function isAuthenticated() {
    return getCurrentUser().then(function (u) {
      return !!u;
    });
  }

  // ============ 3. هل المستخدم له دور محدد؟ ============
  function hasRole(role) {
    return getCurrentUser().then(function (u) {
      if (!u) return false;
      if (Array.isArray(role)) return role.indexOf(u.role) !== -1;
      return u.role === role;
    });
  }

  // ============ 4. هل المستخدم أدمن (أي نوع)؟ ============
  function isAdmin() {
    return hasRole(['super_admin', 'admin', 'committee_manager']);
  }

  // ============ 5. هل المستخدم سوبر أدمن؟ ============
  function isSuperAdmin() {
    return hasRole('super_admin');
  }

  // ============ 6. إعادة التوجيه للـ login ============
  function redirectToLogin() {
    var currentPath = window.location.pathname + window.location.search;
    // متحولش لو أصلاً في login
    if (currentPath.indexOf('login.html') !== -1) return;

    var next = encodeURIComponent(currentPath);
    window.location.href = LOGIN_PAGE + '?next=' + next;
  }

  // ============ 7. إعادة التوجيه لصفحة آمنة ============
  function redirectToSafe(user) {
    if (!user) {
      redirectToLogin();
      return;
    }

    var role = user.role;
    var dest;

    if (role === 'super_admin' || role === 'admin' || role === 'committee_manager') {
      dest = ROUTES.ADMIN || '/admin/index.html';
    } else {
      dest = ROUTES.HOME || '/home.html';
    }

    window.location.href = dest;
  }

  // ============ 8. حماية الصفحة (الوظيفة الأساسية) ============
  // allowedRoles: مصفوفة الأدوار المسموحة (أو null = أي مسجل دخول)
  // options: { redirect: 'login' | 'safe', showLoader: true }
  function guard(allowedRoles, options) {
    options = options || {};
    var redirectMode = options.redirect || 'login';

    if (state.checking) {
      // لو فيه فحص جاري، ارجع Promise موجود
      return state.checking;
    }

    // إخفاء المحتوى مؤقتاً لمنع flash
    hideBody();

    state.checking = getCurrentUser().then(function (user) {
      state.checking = null;

      // (أ) مفيش مستخدم → اروح login
      if (!user) {
        if (redirectMode === 'login') {
          redirectToLogin();
        } else {
          redirectToSafe(null);
        }
        return null;
      }

      // (ب) فيه مستخدم — اتحقق من الدور
      if (allowedRoles && allowedRoles.length > 0) {
        if (allowedRoles.indexOf(user.role) === -1) {
          // مش مصرح — اروح لصفحة آمنة
          showUnauthorizedMessage(user);
          setTimeout(function () {
            redirectToSafe(user);
          }, 1500);
          return null;
        }
      }

      // (ج) كل حاجة تمام — اعرض المحتوى
      showBody();
      notifyAuthReady(user);
      logDebug('Access granted:', user.email, '(', user.role, ')');
      return user;

    }).catch(function (err) {
      state.checking = null;
      logDebug('Guard error:', err.message);
      if (redirectMode === 'login') {
        redirectToLogin();
      } else {
        redirectToSafe(null);
      }
      return null;
    });

    return state.checking;
  }

  // ============ 9. حماية خاصة للأدمن ============
  function guardAdmin(options) {
    return guard(['super_admin', 'admin', 'committee_manager'], options);
  }

  // ============ 10. حماية خاصة للسوبر أدمن ============
  function guardSuperAdmin(options) {
    return guard(['super_admin'], options);
  }

  // ============ 11. حماية للأكاديميات (بوابة الأكاديمية) ============
  function guardAcademy(options) {
    // في المرحلة الأولى، الأكاديميات مش بتسجل دخول
    // لما نضيف الحسابات، هيتعدل هنا
    return guard(null, options);
  }

  // ============ 12. حماية للصفحات العامة (بدون تحقق) ============
  function optional() {
    showBody();
    return getCurrentUser().then(function (user) {
      if (user) notifyAuthReady(user);
      return user;
    });
  }

  // ============ 13. إخفاء/إظهار الـ body ============
  function hideBody() {
    if (document.body) {
      document.body.style.visibility = 'hidden';
    } else {
      // لو الـ body لسه ما اتحملش، نستنى
      document.addEventListener('DOMContentLoaded', function () {
        document.body.style.visibility = 'hidden';
      }, { once: true });
    }
  }

  function showBody() {
    if (document.body) {
      document.body.style.visibility = '';
    }
  }

  // ============ 14. عرض رسالة عدم التصريح ============
  function showUnauthorizedMessage(user) {
    // نعرض الرسالة فوق المحتوى المخفي
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
      '<div style="font-size:64px;margin-bottom:16px;">🔒</div>' +
      '<h2 style="font-size:24px;margin-bottom:8px;font-weight:700;">غير مصرح لك بالوصول</h2>' +
      '<p style="color:var(--text-secondary);font-size:14px;margin-bottom:16px;">' +
      'هذه الصفحة مخصصة لـ ' + formatRolesDisplay() +
      '</p>' +
      '<p style="color:var(--text-muted);font-size:13px;">' +
      'دورك الحالي: <strong>' + escapeHtml(translateRole(user.role)) + '</strong>' +
      '</p>' +
      '<p style="color:var(--text-muted);font-size:13px;margin-top:16px;">' +
      'جاري تحويلك للصفحة المناسبة...' +
      '</p>';

    document.body.appendChild(msg);
  }

  function formatRolesDisplay() {
    return 'المستخدمين المصرح لهم';
  }

  // ============ 15. تسجيل الخروج ============
  function logout() {
    // نوقف الـ session heartbeat أولاً
    if (window.SessionManager && window.SessionManager.stop) {
      window.SessionManager.stop();
    }

    if (!window.sb) {
      window.location.href = LOGIN_PAGE;
      return Promise.resolve();
    }

    // تسجيل الحدث في activities
    if (state.currentUser) {
      logActivity('logout', 'تسجيل خروج', {});
    }

    return window.sb.auth.signOut()
      .then(function () {
        state.currentUser = null;
        state.authUser = null;
        window.location.href = LOGIN_PAGE;
      })
      .catch(function () {
        window.location.href = LOGIN_PAGE;
      });
  }

  // ============ 16. تسجيل نشاط ============
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

  // ============ 17. الاستماع لتغيير حالة Auth ============
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
          // بنحدّث بعد شوية عشان ميتعارضش مع الـ callback
          setTimeout(function () {
            getCurrentUser().then(function (user) {
              if (user) notifyAuthReady(user);
            });
          }, 100);
        }

        // استدعاء المستمعين
        state.listeners.forEach(function (cb) {
          try {
            cb(event, session);
          } catch (e) {
            logDebug('Listener error:', e.message);
          }
        });
      });

      // تخزين الـ subscription
      if (result && result.data && result.data.subscription) {
        state.authChannel = result.data.subscription;
      }
    }

    return function unsubscribe() {
      var idx = state.listeners.indexOf(callback);
      if (idx !== -1) state.listeners.splice(idx, 1);
    };
  }

  // ============ 18. إشعار كل الصفحات ببيانات المستخدم ============
  function notifyAuthReady(user) {
    try {
      window.dispatchEvent(new CustomEvent('itws:auth-ready', {
        detail: { user: user }
      }));
    } catch (e) {}
  }

  // ============ 19. مساعدات ============
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

  // ============ 20. الواجهة العامة ============
  window.AuthGuard = {
    initialized: true,

    // Core
    getCurrentUser: getCurrentUser,
    isAuthenticated: isAuthenticated,
    hasRole: hasRole,
    isAdmin: isAdmin,
    isSuperAdmin: isSuperAdmin,

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

    // Listeners
    onAuthChange: onAuthChange,

    // Helpers
    translateRole: translateRole,

    // Utility
    getUser: function () {
      return state.currentUser;
    }
  };

  // ============ 21. التهيئة التلقائية ============
  // بندعم السيناريوهين:
  // 1. لو الصفحة عايزة تتحكم يدوياً → بتنادي AuthGuard.guard()
  // 2. لو الصفحة محددة data-requires-auth → بيشتغل تلقائي

  function autoGuard() {
    if (!document.body) return;

    var body = document.body;
    var requiresAuth = body.hasAttribute('data-requires-auth');
    var requiredRoles = body.getAttribute('data-required-roles');

    if (!requiresAuth) {
      // الصفحة عامة — بس نتأكد إن الـ body ظاهر
      showBody();
      // نجلب بيانات المستخدم لو مسجل (بس مش إلزامي)
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
