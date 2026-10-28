/* ============================================================
   ITWS Platform — Auth Guard V2
   File: assets/js/auth-guard.js
   Description: Page-level access control + redirect handling

   Load order: AFTER permissions.js + session.js

   Features:
   - AuthGuard.require(roles, options) → throws redirect if not allowed
   - AuthGuard.requireScope(type, id) → validates governorate/branch/academy
   - AuthGuard.requirePermission(resource, action) → permission check
   - AuthGuard.getUser() → current profile
   - AuthGuard.getRole() → current role
   - AuthGuard.isAuthenticated() → bool
   - Loading state UI while checking
   - Handles: not logged in, pending, rejected, suspended, wrong role
   - Safe redirect with ?next= param
   - Prevents loops (checks current URL before redirect)
   - Auto-detects page role needs via [data-requires-role] attribute
   - Events: itws:guard-passed, itws:guard-failed

   Rules:
   - No emoji
   - ES5-style IIFE
   - window.sb only
   - Uses Permissions engine (single source of truth)
   - Never trusts client-side only — RLS still enforced
   ============================================================ */

(function () {
  'use strict';

  if (window.AuthGuard && window.AuthGuard._initialized) {
    return;
  }

  /* ============================================================
     1. HELPERS
     ============================================================ */

  function log(level, msg, data) {
    var cfg = window.ITWS_CONFIG || {};
    if (level === 'error' || (cfg.DEBUG && level === 'debug')) {
      try {
        var args = ['[AuthGuard]', msg];
        if (data !== undefined) args.push(data);
        if (level === 'error') console.error.apply(console, args);
        else console.log.apply(console, args);
      } catch (e) {}
    }
  }

  function getSb() {
    return window.sb || window.supabaseClient || window.ITWS_SUPABASE || null;
  }

  function getConfig() {
    return window.ITWS_CONFIG || {};
  }

  function resolve(path) {
    if (!path) return '#';
    if (window.resolveUrl) return window.resolveUrl(path);
    var base = (getConfig().BASE_PATH) || '/';
    if (base.charAt(base.length - 1) !== '/') base += '/';
    return base + String(path).replace(/^\.?\//, '');
  }

  function dispatchEvent(name, detail) {
    try {
      window.dispatchEvent(new CustomEvent(name, { detail: detail || {} }));
    } catch (e) {}
  }

  function getLabel(key, fallback) {
    try {
      if (window.Labels && typeof window.Labels.t === 'function') {
        return window.Labels.t(key, fallback);
      }
    } catch (e) {}
    return fallback;
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

  /* ============================================================
     2. STATE
     ============================================================ */

  var state = {
    initialized: false,
    checking: false,
    passed: false,
    failed: false,
    failReason: null,
    user: null,
    profile: null,
    role: null,
    loadingEl: null,
    pendingCheckPromise: null,
    lastCheckAt: 0
  };

  /* ============================================================
     3. LOADING UI
     ============================================================ */

  function createLoadingOverlay() {
    if (document.getElementById('itws-auth-loading')) return;

    var overlay = document.createElement('div');
    overlay.id = 'itws-auth-loading';
    overlay.setAttribute('role', 'status');
    overlay.setAttribute('aria-live', 'polite');
    overlay.setAttribute('aria-label', getLabel('auth.checking', 'جاري التحقق من الصلاحيات'));

    // R13 — responsive, safe areas
    overlay.style.cssText =
      'position:fixed;inset:0;z-index:99997;' +
      'background:var(--bg, #0A0E14);' +
      'display:flex;flex-direction:column;align-items:center;justify-content:center;' +
      'gap:20px;font-family:Cairo, sans-serif;' +
      'padding:max(20px, env(safe-area-inset-top)) max(20px, env(safe-area-inset-right)) ' +
      'max(20px, env(safe-area-inset-bottom)) max(20px, env(safe-area-inset-left));' +
      'color:var(--text, #F8FAFC);' +
      'transition:opacity 0.2s ease;';

    var spinner = document.createElement('div');
    spinner.style.cssText =
      'width:48px;height:48px;' +
      'border:3px solid var(--border, rgba(255,255,255,0.1));' +
      'border-top-color:var(--primary, #CE1126);' +
      'border-radius:50%;' +
      'animation:itwsAuthSpin 0.8s linear infinite;';

    var text = document.createElement('div');
    text.textContent = getLabel('auth.checking', 'جاري التحقق من الصلاحيات...');
    text.style.cssText =
      'font-size:clamp(13px, 2vw, 15px);' +
      'color:var(--text-muted, #64748B);' +
      'font-weight:500;text-align:center;max-width:340px;line-height:1.6;';

    overlay.appendChild(spinner);
    overlay.appendChild(text);

    // Inject keyframes once
    if (!document.getElementById('itws-auth-spin-kf')) {
      var style = document.createElement('style');
      style.id = 'itws-auth-spin-kf';
      style.textContent = '@keyframes itwsAuthSpin{to{transform:rotate(360deg);}}';
      document.head.appendChild(style);
    }

    document.body.appendChild(overlay);
    state.loadingEl = overlay;
  }

  function removeLoadingOverlay() {
    if (!state.loadingEl || !state.loadingEl.parentNode) return;
    var el = state.loadingEl;
    el.style.opacity = '0';
    setTimeout(function () {
      if (el.parentNode) el.parentNode.removeChild(el);
    }, 200);
    state.loadingEl = null;
  }

  /* ============================================================
     4. REDIRECT HELPER
     ============================================================ */

  function redirectTo(target, options) {
    options = options || {};
    if (!target) return;

    var url = resolve(target);
    var currentPath = window.location.pathname + window.location.search;

    // Prevent redirect loops
    try {
      var targetUrl = new URL(url, window.location.origin);
      var currentUrl = new URL(window.location.href);
      if (targetUrl.pathname === currentUrl.pathname &&
          targetUrl.search === currentUrl.search) {
        log('error', 'Redirect loop prevented:', target);
        return;
      }
    } catch (e) {}

    // Add ?next= if requested
    if (options.addNext) {
      try {
        var u = new URL(url, window.location.origin);
        u.searchParams.set('next', currentPath);
        url = u.toString();
      } catch (e) {}
    }

    log('debug', 'Redirecting', { from: currentPath, to: url, reason: options.reason });
    window.location.replace(url);
  }

  /* ============================================================
     5. FAILURE HANDLERS
     ============================================================ */

  function failWith(reason, options) {
    options = options || {};
    state.failed = true;
    state.failReason = reason;
    removeLoadingOverlay();

    dispatchEvent('itws:guard-failed', {
      reason: reason,
      path: window.location.pathname,
      message: options.message || null
    });

    log('debug', 'Guard failed', { reason: reason });

    switch (reason) {
      case 'not-logged-in':
        redirectTo('login.html', {
          addNext: true,
          reason: 'not-logged-in'
        });
        break;

      case 'pending':
        redirectTo('login.html?pending=1', { reason: 'pending' });
        break;

      case 'rejected':
        redirectTo('login.html?rejected=1', { reason: 'rejected' });
        break;

      case 'suspended':
        redirectTo('login.html?suspended=1', { reason: 'suspended' });
        break;

      case 'inactive':
        redirectTo('login.html?inactive=1', { reason: 'inactive' });
        break;

      case 'wrong-role':
        // Redirect to appropriate portal based on actual role
        redirectToHomeForRole(state.role);
        break;

      case 'wrong-scope':
        // Same — go home for role
        redirectToHomeForRole(state.role);
        break;

      case 'no-permission':
        // Show error page or redirect
        showErrorPage(
          getLabel('errors.403.title', 'غير مصرح لك بالوصول'),
          getLabel('errors.403.message', 'ليس لديك صلاحية للوصول إلى هذه الصفحة')
        );
        break;

      case 'error':
        showErrorPage(
          getLabel('errors.generic', 'حدث خطأ غير متوقع'),
          options.message || ''
        );
        break;

      default:
        redirectToHomeForRole(state.role);
    }
  }

  function redirectToHomeForRole(role) {
    if (!role) {
      redirectTo('login.html', { reason: 'no-role' });
      return;
    }

    var dest = 'home.html';

    if (role === 'super_admin' || role === 'committee_head' ||
        role === 'committee_deputy' || role === 'committee_member') {
      dest = 'admin/index.html';
    } else if (role === 'branch_president' || role === 'branch_first_deputy' ||
               role === 'branch_second_deputy' || role === 'branch_secretary' ||
               role === 'branch_secretary_assistant' || role === 'branch_treasurer' ||
               role === 'branch_treasurer_assistant' || role === 'branch_agent' ||
               role === 'branch_agent_assistant') {
      dest = 'branch/index.html';
    } else if (role === 'academy_owner' || role === 'academy_manager') {
      dest = 'portal/index.html';
    } else if (role === 'user') {
      dest = 'home.html';
    } else if (role === 'pending_user') {
      dest = 'login.html?pending=1';
    }

    redirectTo(dest, { reason: 'home-for-role', addNext: false });
  }

  function showErrorPage(title, message) {
    // Clear body and show error
    try {
      document.body.innerHTML = '';
      document.body.style.cssText =
        'margin:0;padding:max(40px, env(safe-area-inset-top)) ' +
        'max(20px, env(safe-area-inset-right)) max(40px, env(safe-area-inset-bottom)) ' +
        'max(20px, env(safe-area-inset-left));' +
        'font-family:Cairo, sans-serif;' +
        'background:var(--bg, #0A0E14);color:var(--text, #F8FAFC);' +
        'min-height:100vh;display:flex;align-items:center;justify-content:center;';

      var wrap = document.createElement('div');
      wrap.style.cssText =
        'text-align:center;max-width:min(480px, 100%);padding:24px;';

      var icon = document.createElement('div');
      icon.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" ' +
        'width="64" height="64" fill="none" stroke="currentColor" stroke-width="2" ' +
        'stroke-linecap="round" stroke-linejoin="round" style="color:var(--error, #EF4444);margin:0 auto 20px;">' +
        '<circle cx="12" cy="12" r="10"></circle>' +
        '<line x1="12" y1="8" x2="12" y2="12"></line>' +
        '<line x1="12" y1="16" x2="12.01" y2="16"></line></svg>';

      var h1 = document.createElement('h1');
      h1.textContent = title;
      h1.style.cssText =
        'margin:0 0 12px;font-size:clamp(22px, 4vw, 28px);font-weight:800;line-height:1.3;';

      var p = document.createElement('p');
      p.textContent = message;
      p.style.cssText =
        'margin:0 0 28px;font-size:clamp(14px, 2vw, 16px);' +
        'color:var(--text-secondary, #94A3B8);line-height:1.7;';

      var btn = document.createElement('a');
      btn.href = resolve('home.html');
      btn.textContent = getLabel('common.back_to_home', 'العودة إلى الرئيسية');
      btn.style.cssText =
        'display:inline-flex;align-items:center;gap:8px;padding:12px 28px;' +
        'background:var(--primary, #CE1126);' +
        'color:var(--primary-text, #fff);text-decoration:none;' +
        'border-radius:10px;font-weight:700;font-size:14px;' +
        'transition:all 0.2s;';

      wrap.appendChild(icon);
      wrap.appendChild(h1);
      wrap.appendChild(p);
      wrap.appendChild(btn);
      document.body.appendChild(wrap);
    } catch (e) {
      log('error', 'showErrorPage failed', e);
    }
  }

  /* ============================================================
     6. STATUS CHECKS
     ============================================================ */

  function checkUserStatus(profile) {
    if (!profile) return { ok: false, reason: 'not-logged-in' };

    // is_deleted → treat as not-logged-in
    if (profile.is_deleted === true) {
      return { ok: false, reason: 'inactive' };
    }

    // status check
    if (profile.status === 'pending') {
      return { ok: false, reason: 'pending' };
    }
    if (profile.status === 'rejected') {
      return { ok: false, reason: 'rejected' };
    }
    if (profile.status === 'suspended') {
      return { ok: false, reason: 'suspended' };
    }
    if (profile.status !== 'active') {
      return { ok: false, reason: 'inactive' };
    }

    // is_active boolean
    if (profile.is_active === false) {
      return { ok: false, reason: 'inactive' };
    }

    return { ok: true, reason: null };
  }

  /* ============================================================
     7. ROLE / SCOPE / PERMISSION CHECKS
     ============================================================ */

  function checkRole(role, requiredRoles) {
    if (!requiredRoles || requiredRoles.length === 0) return true;

    // super_admin always passes
    if (role === 'super_admin') return true;

    if (Array.isArray(requiredRoles)) {
      return requiredRoles.indexOf(role) !== -1;
    }
    return role === requiredRoles;
  }

  function checkScope(profile, options) {
    if (!options) return true;

    var scope = options.scope;

    if (scope === 'governorate' && options.governorateId != null) {
      return profile.governorate_id === options.governorateId;
    }
    if (scope === 'branch' && options.branchId) {
      return profile.branch_id === options.branchId;
    }
    if (scope === 'academy' && options.academyId) {
      return profile.academy_id === options.academyId;
    }
    if (scope === 'self' && options.userId) {
      return profile.id === options.userId;
    }
    return true;
  }

  function checkPermission(resource, action, options) {
    if (!resource || !action) return true;

    try {
      if (window.Permissions && typeof window.Permissions.can === 'function') {
        return window.Permissions.can(resource, action, options || {});
      }
    } catch (e) {}
    return true; // fallback — RLS still enforces
  }

  /* ============================================================
     8. CORE — CHECK
     ============================================================ */

  function checkAccess(requiredRoles, options) {
    options = options || {};

    // Wait for Permissions to be ready
    var ready = (window.Permissions && typeof window.Permissions.whenReady === 'function')
      ? window.Permissions.whenReady()
      : Promise.resolve(null);

    return ready
      .then(function (result) {
        var sb = getSb();
        if (!sb) throw new Error('Supabase not available');

        // Fetch user
        return sb.auth.getUser().then(function (res) {
          var user = res && res.data && res.data.user ? res.data.user : null;

          if (!user) {
            return { ok: false, reason: 'not-logged-in' };
          }

          state.user = user;

          // Fetch profile (use cache if available)
          if (result && result.profile && result.profile.id === user.id) {
            return { user: user, profile: result.profile };
          }

          return sb.from('profiles')
            .select('id, email, full_name, role, status, is_active, is_deleted, ' +
                    'governorate_id, branch_id, academy_id, avatar_url, phone')
            .eq('id', user.id)
            .maybeSingle()
            .then(function (profileRes) {
              if (profileRes.error) throw new Error(profileRes.error.message);
              if (!profileRes.data) {
                return { ok: false, reason: 'no-profile' };
              }
              return { user: user, profile: profileRes.data };
            });
        });
      })
      .then(function (data) {
        if (!data || data.ok === false) {
          return { ok: false, reason: data ? data.reason : 'error' };
        }

        var user = data.user;
        var profile = data.profile;

        state.user = user;
        state.profile = profile;
        state.role = profile.role;

        // Sync to Permissions engine
        try {
          if (window.Permissions && typeof window.Permissions.setProfile === 'function') {
            window.Permissions.setProfile(profile);
          }
        } catch (e) {}

        // Check user status
        var statusCheck = checkUserStatus(profile);
        if (!statusCheck.ok) {
          return statusCheck;
        }

        // Check role
        if (!checkRole(profile.role, requiredRoles)) {
          return { ok: false, reason: 'wrong-role', role: profile.role };
        }

        // Check scope
        if (options && !checkScope(profile, options)) {
          return { ok: false, reason: 'wrong-scope', role: profile.role };
        }

        // Check permission
        if (options && options.resource && options.action) {
          if (!checkPermission(options.resource, options.action, options.permissionOptions)) {
            return { ok: false, reason: 'no-permission', role: profile.role };
          }
        }

        return { ok: true, user: user, profile: profile };
      })
      .catch(function (err) {
        log('error', 'Check failed', err && err.message);
        return { ok: false, reason: 'error', message: err && err.message };
      });
  }

  /* ============================================================
     9. PUBLIC API — REQUIRE
     ============================================================ */

  /**
   * Require access to current page
   * @param {array|string} roles - Required roles (super_admin always passes)
   * @param {object} options - { scope, governorateId, branchId, academyId, userId,
   *                            resource, action, permissionOptions,
   *                            showLoading, redirectTo }
   * @returns {Promise} Resolves with { user, profile } if allowed,
   *                    or redirects & rejects if not
   */
  function require_(roles, options) {
    options = options || {};

    if (typeof roles === 'string') roles = [roles];
    if (!Array.isArray(roles)) roles = [];

    if (state.passed) {
      return Promise.resolve({ user: state.user, profile: state.profile });
    }

    if (state.pendingCheckPromise) {
      return state.pendingCheckPromise;
    }

    state.checking = true;

    // Show loading overlay (default true)
    if (options.showLoading !== false) {
      createLoadingOverlay();
    }

    state.pendingCheckPromise = checkAccess(roles, options)
      .then(function (result) {
        state.checking = false;
        state.pendingCheckPromise = null;

        if (result.ok) {
          state.passed = true;
          state.failed = false;
          state.lastCheckAt = Date.now();
          removeLoadingOverlay();

          dispatchEvent('itws:guard-passed', {
            role: result.profile.role,
            userId: result.user.id,
            path: window.location.pathname
          });

          return result;
        }

        // Failed
        var failOptions = {
          message: result.message || null,
          redirectTo: options.redirectTo || null
        };

        if (options.redirectTo) {
          removeLoadingOverlay();
          redirectTo(options.redirectTo, {
            reason: result.reason,
            addNext: result.reason === 'not-logged-in'
          });
        } else {
          failWith(result.reason, failOptions);
        }

        // Reject so callers know access denied
        var err = new Error('Access denied: ' + result.reason);
        err.reason = result.reason;
        err.role = result.role;
        throw err;
      })
      .catch(function (err) {
        state.checking = false;
        state.pendingCheckPromise = null;
        removeLoadingOverlay();
        throw err;
      });

    return state.pendingCheckPromise;
  }

  /* ============================================================
     10. CONVENIENCE — requirePermission
     ============================================================ */

  function requirePermission(resource, action, options) {
    options = options || {};
    options.resource = resource;
    options.action = action;
    return require_([], options);
  }

  /* ============================================================
     11. CONVENIENCE — requireScope
     ============================================================ */

  function requireScope(scopeType, scopeId, roles) {
    var options = { scope: scopeType };

    if (scopeType === 'governorate') options.governorateId = scopeId;
    else if (scopeType === 'branch') options.branchId = scopeId;
    else if (scopeType === 'academy') options.academyId = scopeId;
    else if (scopeType === 'self') options.userId = scopeId;

    return require_(roles || [], options);
  }

  /* ============================================================
     12. AUTO-DETECT [data-requires-role]
     ============================================================ */

  function autoDetect() {
    var body = document.body;
    if (!body) return null;

    var requiresRole = body.getAttribute('data-requires-role');
    if (!requiresRole) return null;

    var roles = requiresRole.split(',').map(function (r) { return r.trim(); }).filter(Boolean);

    var requiresScope = body.getAttribute('data-requires-scope');
    var options = {};

    if (requiresScope) {
      var parts = requiresScope.split(':');
      options.scope = parts[0];
      var scopeId = parts[1] || null;

      if (options.scope === 'governorate' && scopeId) options.governorateId = parseInt(scopeId, 10);
      else if (options.scope === 'branch' && scopeId) options.branchId = scopeId;
      else if (options.scope === 'academy' && scopeId) options.academyId = scopeId;
      else if (options.scope === 'self' && scopeId) options.userId = scopeId;
    }

    return { roles: roles, options: options };
  }

  /* ============================================================
     13. CONVENIENCE — currentUser / currentProfile / currentRole
     ============================================================ */

  function getUser() {
    return state.user;
  }

  function getProfile() {
    return state.profile;
  }

  function getRole() {
    return state.role;
  }

  function isAuthenticated() {
    return !!(state.user && state.profile && state.profile.status === 'active');
  }

  function hasRole(role) {
    if (!role) return false;
    if (Array.isArray(role)) return role.indexOf(state.role) !== -1;
    return state.role === role;
  }

  function isSuperAdmin() {
    return state.role === 'super_admin';
  }

  function isCommittee() {
    return state.role === 'committee_head' ||
           state.role === 'committee_deputy' ||
           state.role === 'committee_member';
  }

  function isBranchLevel() {
    return state.role && state.role.indexOf('branch_') === 0;
  }

  function isAcademyLevel() {
    return state.role === 'academy_owner' || state.role === 'academy_manager';
  }

  /* ============================================================
     14. INIT — AUTO-RUN IF [data-requires-role]
     ============================================================ */

  function init() {
    if (state.initialized) return;
    state.initialized = true;

    // Auto-detect page requirement
    var detected = autoDetect();
    if (detected && detected.roles.length > 0) {
      log('debug', 'Auto-detected page requirement', detected);
      require_(detected.roles, detected.options).catch(function () {
        // Already redirected by require_()
      });
    }
  }

  /* ============================================================
     15. EXPORT
     ============================================================ */

  window.AuthGuard = {
    _initialized: true,

    // Core
    require: require_,
    requirePermission: requirePermission,
    requireScope: requireScope,
    init: init,

    // User info
    getUser: getUser,
    getProfile: getProfile,
    getRole: getRole,
    isAuthenticated: isAuthenticated,
    hasRole: hasRole,

    // Role helpers
    isSuperAdmin: isSuperAdmin,
    isCommittee: isCommittee,
    isBranchLevel: isBranchLevel,
    isAcademyLevel: isAcademyLevel,

    // State
    isPassed: function () { return state.passed; },
    isFailed: function () { return state.failed; },
    getFailReason: function () { return state.failReason; },
    getState: function () {
      return {
        checking: state.checking,
        passed: state.passed,
        failed: state.failed,
        failReason: state.failReason,
        role: state.role,
        userId: state.user ? state.user.id : null,
        profile: state.profile,
        lastCheckAt: state.lastCheckAt
      };
    },

    // Utilities
    redirectToHomeForRole: redirectToHomeForRole,
    redirectToLogin: function () {
      redirectTo('login.html', { addNext: true, reason: 'manual' });
    }
  };

  // Shorthands
  window.requireAuth = function (roles, options) {
    return require_(roles, options);
  };

  // Auto-init
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  /* ============================================================
     16. DEBUG LOG
     ============================================================ */

  var cfg = getConfig();
  if (cfg.DEBUG) {
    try {
      console.log('%c[AuthGuard]', 'color: #EF4444; font-weight: bold;', 'Ready');
    } catch (e) {}
  }

})();
