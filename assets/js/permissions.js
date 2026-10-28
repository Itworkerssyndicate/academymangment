/* ============================================================
   ITWS Platform — Permissions Engine V2
   File: assets/js/permissions.js
   Description: Role-based access control (RBAC) engine

   Load order: SIXTH (after labels.js)

   Features:
   - Loads permissions matrix from `permissions` table
   - Loads current user profile (role, scope)
   - Permissions.can(resource, action, options) API
   - Scope-aware checks (global | governorate | branch | academy | self)
   - Role helpers: isSuperAdmin, isCommittee, isBranchLevel, isAcademyLevel
   - Cache in localStorage
   - Realtime subscription
   - onChange callbacks
   - Events: itws:permissions-loaded, itws:permissions-changed, itws:role-changed

   Rules:
   - No emoji
   - ES5-style IIFE
   - window.sb only
   - Never trust client-side only — RLS is authoritative
   - Client-side is UX layer; DB enforces real rules
   ============================================================ */

(function () {
  'use strict';

  if (window.Permissions && window.Permissions._initialized) {
    return;
  }

  /* ============================================================
     1. HELPERS
     ============================================================ */

  function log(level, msg, data) {
    var cfg = window.ITWS_CONFIG || {};
    if (level === 'error' || (cfg.DEBUG && level === 'debug')) {
      try {
        var args = ['[Permissions]', msg];
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

  function getCacheKey() {
    return 'itws_permissions_cache';
  }

  function getProfileCacheKey() {
    return 'itws_user_profile_cache';
  }

  function safeStorageGet(key) {
    try { return localStorage.getItem(key); } catch (e) { return null; }
  }

  function safeStorageSet(key, value) {
    try { localStorage.setItem(key, value); return true; }
    catch (e) { log('error', 'localStorage set failed', e); return false; }
  }

  function safeStorageRemove(key) {
    try { localStorage.removeItem(key); return true; } catch (e) { return false; }
  }

  function dispatchEvent(name, detail) {
    try {
      window.dispatchEvent(new CustomEvent(name, { detail: detail || {} }));
    } catch (e) {
      log('error', 'dispatchEvent failed', e);
    }
  }

  /* ============================================================
     2. STATE
     ============================================================ */

  var state = {
    loaded: false,
    loading: false,
    profileLoaded: false,
    error: null,
    permissions: {},          // { 'role:resource:action:scope': true }
    profile: null,            // current user profile
    lastFetch: 0,
    listeners: [],
    roleListeners: [],
    permissionsChannel: null,
    profileChannel: null,
    readyPromise: null,
    readyResolve: null
  };

  state.readyPromise = new Promise(function (resolve) {
    state.readyResolve = resolve;
  });

  /* ============================================================
     3. ROLE CONSTANTS
     ============================================================ */

  var ROLES = {
    SUPER_ADMIN: 'super_admin',
    COMMITTEE_HEAD: 'committee_head',
    COMMITTEE_DEPUTY: 'committee_deputy',
    COMMITTEE_MEMBER: 'committee_member',
    BRANCH_PRESIDENT: 'branch_president',
    BRANCH_FIRST_DEPUTY: 'branch_first_deputy',
    BRANCH_SECOND_DEPUTY: 'branch_second_deputy',
    BRANCH_SECRETARY: 'branch_secretary',
    BRANCH_SECRETARY_ASSISTANT: 'branch_secretary_assistant',
    BRANCH_TREASURER: 'branch_treasurer',
    BRANCH_TREASURER_ASSISTANT: 'branch_treasurer_assistant',
    BRANCH_AGENT: 'branch_agent',
    BRANCH_AGENT_ASSISTANT: 'branch_agent_assistant',
    ACADEMY_OWNER: 'academy_owner',
    ACADEMY_MANAGER: 'academy_manager',
    USER: 'user',
    PENDING_USER: 'pending_user'
  };

  var COMMITTEE_ROLES = [
    ROLES.COMMITTEE_HEAD,
    ROLES.COMMITTEE_DEPUTY,
    ROLES.COMMITTEE_MEMBER
  ];

  var BRANCH_ROLES = [
    ROLES.BRANCH_PRESIDENT,
    ROLES.BRANCH_FIRST_DEPUTY,
    ROLES.BRANCH_SECOND_DEPUTY,
    ROLES.BRANCH_SECRETARY,
    ROLES.BRANCH_SECRETARY_ASSISTANT,
    ROLES.BRANCH_TREASURER,
    ROLES.BRANCH_TREASURER_ASSISTANT,
    ROLES.BRANCH_AGENT,
    ROLES.BRANCH_AGENT_ASSISTANT
  ];

  var ACADEMY_ROLES = [
    ROLES.ACADEMY_OWNER,
    ROLES.ACADEMY_MANAGER
  ];

  /* ============================================================
     4. CACHE — Permissions
     ============================================================ */

  function buildPermissionKey(role, resource, action, scope) {
    return role + ':' + resource + ':' + action + ':' + (scope || 'global');
  }

  function loadPermissionsFromCache() {
    var raw = safeStorageGet(getCacheKey());
    if (!raw) return false;

    try {
      var parsed = JSON.parse(raw);
      if (!parsed || typeof parsed !== 'object') return false;

      var data = parsed.data || parsed;
      if (!data || typeof data !== 'object') return false;

      state.permissions = data;
      state.lastFetch = parsed.timestamp || 0;
      state.loaded = true;

      log('debug', 'Permissions from cache', Object.keys(data).length);
      return true;
    } catch (e) {
      log('error', 'Permissions cache parse failed', e);
      return false;
    }
  }

  function savePermissionsToCache() {
    safeStorageSet(getCacheKey(), JSON.stringify({
      data: state.permissions,
      timestamp: Date.now()
    }));
  }

  /* ============================================================
     5. CACHE — Profile
     ============================================================ */

  function loadProfileFromCache() {
    var raw = safeStorageGet(getProfileCacheKey());
    if (!raw) return false;

    try {
      var parsed = JSON.parse(raw);
      if (!parsed || typeof parsed !== 'object') return false;

      var data = parsed.data || parsed;
      if (!data || !data.id) return false;

      // Check cache is not too old (5 min)
      var ts = parsed.timestamp || 0;
      if (Date.now() - ts > 5 * 60 * 1000) return false;

      state.profile = data;
      state.profileLoaded = true;
      log('debug', 'Profile from cache', data.role);
      return true;
    } catch (e) {
      log('error', 'Profile cache parse failed', e);
      return false;
    }
  }

  function saveProfileToCache() {
    if (!state.profile) return;
    safeStorageSet(getProfileCacheKey(), JSON.stringify({
      data: state.profile,
      timestamp: Date.now()
    }));
  }

  function clearProfileCache() {
    safeStorageRemove(getProfileCacheKey());
    state.profile = null;
    state.profileLoaded = false;
  }

  /* ============================================================
     6. FETCH — Permissions
     ============================================================ */

  function fetchPermissionsFromDb(retryCount) {
    retryCount = retryCount || 0;
    var sb = getSb();

    if (!sb) {
      return Promise.reject(new Error('Supabase client not available'));
    }

    state.loading = true;

    return sb
      .from('permissions')
      .select('role, resource, action, allowed, scope')
      .eq('allowed', true)
      .then(function (res) {
        if (res.error) throw new Error(res.error.message);

        var map = {};
        (res.data || []).forEach(function (row) {
          if (!row || !row.role || !row.resource || !row.action) return;
          var key = buildPermissionKey(row.role, row.resource, row.action, row.scope);
          map[key] = true;
        });

        return map;
      })
      .catch(function (err) {
        var msg = (err && err.message ? err.message : '').toLowerCase();
        var isNetworkError = (
          msg.indexOf('fetch') !== -1 ||
          msg.indexOf('network') !== -1 ||
          msg.indexOf('timeout') !== -1
        );

        if (isNetworkError && retryCount < 2) {
          return new Promise(function (resolve) {
            setTimeout(resolve, 1000 * Math.pow(2, retryCount));
          }).then(function () {
            return fetchPermissionsFromDb(retryCount + 1);
          });
        }

        throw err;
      });
  }

  /* ============================================================
     7. FETCH — Profile
     ============================================================ */

  function fetchProfileFromDb() {
    var sb = getSb();
    if (!sb) {
      return Promise.reject(new Error('Supabase client not available'));
    }

    return sb.auth.getUser()
      .then(function (res) {
        if (!res || !res.data || !res.data.user) {
          return null;
        }
        var user = res.data.user;

        return sb
          .from('profiles')
          .select('id, email, full_name, phone, avatar_url, role, status, is_active, is_deleted, governorate_id, branch_id, academy_id, is_primary')
          .eq('id', user.id)
          .maybeSingle()
          .then(function (profileRes) {
            if (profileRes.error) return null;
            if (!profileRes.data) return null;
            return profileRes.data;
          });
      })
      .catch(function (err) {
        log('error', 'Fetch profile failed', err);
        return null;
      });
  }

  /* ============================================================
     8. NOTIFICATIONS
     ============================================================ */

  function notifyListeners(changedKey) {
    var snapshot = {
      role: state.profile ? state.profile.role : null,
      profile: state.profile
    };

    var listeners = state.listeners.slice();
    listeners.forEach(function (fn) {
      try { fn(snapshot, changedKey); }
      catch (e) { log('error', 'Listener error', e); }
    });

    dispatchEvent('itws:permissions-changed', {
      key: changedKey,
      role: snapshot.role,
      profile: state.profile
    });
  }

  function notifyRoleListeners(previousRole) {
    var newRole = state.profile ? state.profile.role : null;
    if (previousRole === newRole) return;

    var listeners = state.roleListeners.slice();
    listeners.forEach(function (fn) {
      try { fn(newRole, previousRole); }
      catch (e) { log('error', 'Role listener error', e); }
    });

    dispatchEvent('itws:role-changed', {
      previousRole: previousRole,
      newRole: newRole,
      profile: state.profile
    });
  }

  /* ============================================================
     9. REALTIME
     ============================================================ */

  function subscribePermissionsRealtime() {
    var sb = getSb();
    if (!sb) return;

    try {
      if (state.permissionsChannel) {
        try { sb.removeChannel(state.permissionsChannel); } catch (e) {}
        state.permissionsChannel = null;
      }

      state.permissionsChannel = sb
        .channel('itws_permissions_changes')
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'permissions' },
          function (payload) {
            var row = payload.new || payload.old;
            if (!row) return;

            var role = row.role;
            var resource = row.resource;
            var action = row.action;
            var scope = row.scope || 'global';
            var allowed = payload.eventType === 'DELETE' ? false : (row.allowed === true);

            if (!role || !resource || !action) return;

            var key = buildPermissionKey(role, resource, action, scope);

            if (allowed) {
              state.permissions[key] = true;
            } else {
              delete state.permissions[key];
            }

            savePermissionsToCache();
            notifyListeners(key);
            log('debug', 'Permission changed', key);
          }
        )
        .subscribe(function (status) {
          log('debug', 'Permissions realtime status', status);
        });
    } catch (e) {
      log('error', 'Permissions realtime failed', e);
    }
  }

  function subscribeProfileRealtime() {
    var sb = getSb();
    if (!sb || !state.profile || !state.profile.id) return;

    try {
      if (state.profileChannel) {
        try { sb.removeChannel(state.profileChannel); } catch (e) {}
        state.profileChannel = null;
      }

      var userId = state.profile.id;

      state.profileChannel = sb
        .channel('itws_profile_changes_' + userId)
        .on(
          'postgres_changes',
          {
            event: 'UPDATE',
            schema: 'public',
            table: 'profiles',
            filter: 'id=eq.' + userId
          },
          function (payload) {
            if (!payload.new) return;

            var previousRole = state.profile ? state.profile.role : null;

            // Update profile data
            state.profile = {
              id: payload.new.id,
              email: payload.new.email,
              full_name: payload.new.full_name,
              phone: payload.new.phone,
              avatar_url: payload.new.avatar_url,
              role: payload.new.role,
              status: payload.new.status,
              is_active: payload.new.is_active,
              is_deleted: payload.new.is_deleted,
              governorate_id: payload.new.governorate_id,
              branch_id: payload.new.branch_id,
              academy_id: payload.new.academy_id,
              is_primary: payload.new.is_primary
            };

            saveProfileToCache();
            notifyRoleListeners(previousRole);
            notifyListeners(null);
            log('debug', 'Profile updated', { role: state.profile.role });
          }
        )
        .subscribe(function (status) {
          log('debug', 'Profile realtime status', status);
        });
    } catch (e) {
      log('error', 'Profile realtime failed', e);
    }
  }

  function unsubscribeAll() {
    var sb = getSb();
    if (!sb) return;
    if (state.permissionsChannel) {
      try { sb.removeChannel(state.permissionsChannel); } catch (e) {}
      state.permissionsChannel = null;
    }
    if (state.profileChannel) {
      try { sb.removeChannel(state.profileChannel); } catch (e) {}
      state.profileChannel = null;
    }
  }

  /* ============================================================
     10. CORE LOGIC
     ============================================================ */

  function getRole() {
    return state.profile ? state.profile.role : null;
  }

  function isActive() {
    if (!state.profile) return false;
    if (state.profile.is_active === false) return false;
    if (state.profile.is_deleted === true) return false;
    if (state.profile.status !== 'active') return false;
    return true;
  }

  function getScopeContext() {
    if (!state.profile) return null;
    return {
      role: state.profile.role,
      governorate_id: state.profile.governorate_id || null,
      branch_id: state.profile.branch_id || null,
      academy_id: state.profile.academy_id || null,
      user_id: state.profile.id
    };
  }

  // Core check: does this role have permission for resource+action in scope?
  function hasPermission(role, resource, action, scope) {
    if (!role || !resource || !action) return false;

    scope = scope || 'global';
    var key = buildPermissionKey(role, resource, action, scope);

    return state.permissions[key] === true;
  }

  // Check any of multiple scopes
  function hasPermissionAnyScope(role, resource, action, scopes) {
    if (!Array.isArray(scopes) || scopes.length === 0) {
      return hasPermission(role, resource, action, 'global');
    }
    for (var i = 0; i < scopes.length; i++) {
      if (hasPermission(role, resource, action, scopes[i])) return true;
    }
    return false;
  }

  // Full scope-aware check with user context
  function canDo(resource, action, options) {
    options = options || {};

    if (!state.profile) return false;
    if (!isActive()) return false;

    var role = state.profile.role;
    if (role === ROLES.SUPER_ADMIN) return true;
    if (role === ROLES.PENDING_USER) return false;

    // Check which scope this operation targets
    var targetScope = options.scope || null;
    var allowedScopes = [];

    if (targetScope) {
      // Specific scope requested
      allowedScopes = [targetScope];
    } else {
      // Determine scopes from user role
      if (role === ROLES.COMMITTEE_HEAD || role === ROLES.COMMITTEE_DEPUTY || role === ROLES.COMMITTEE_MEMBER) {
        allowedScopes = ['global'];
      } else if (BRANCH_ROLES.indexOf(role) !== -1) {
        allowedScopes = ['governorate', 'global'];
      } else if (ACADEMY_ROLES.indexOf(role) !== -1) {
        allowedScopes = ['academy', 'global'];
      } else {
        allowedScopes = ['global', 'self'];
      }
    }

    // Check any allowed scope
    if (!hasPermissionAnyScope(role, resource, action, allowedScopes)) {
      return false;
    }

    // Extra scope validation
    if (options.checkOwnership && options.ownerId) {
      if (state.profile.id !== options.ownerId) {
        // Only allow if global permission exists
        if (!hasPermission(role, resource, action, 'global')) return false;
      }
    }

    return true;
  }

  /* ============================================================
     11. ROLE HELPERS
     ============================================================ */

  function isSuperAdmin() {
    return getRole() === ROLES.SUPER_ADMIN;
  }

  function isCommittee() {
    return COMMITTEE_ROLES.indexOf(getRole()) !== -1;
  }

  function isBranchLevel() {
    return BRANCH_ROLES.indexOf(getRole()) !== -1;
  }

  function isAcademyLevel() {
    return ACADEMY_ROLES.indexOf(getRole()) !== -1;
  }

  function isPending() {
    if (!state.profile) return false;
    return state.profile.status === 'pending';
  }

  function isActiveUser() {
    return isActive();
  }

  function hasRole(role) {
    if (!role) return false;
    if (Array.isArray(role)) {
      return role.indexOf(getRole()) !== -1;
    }
    return getRole() === role;
  }

  function isInGovernorate(govId) {
    if (!state.profile || !state.profile.governorate_id) return false;
    return state.profile.governorate_id === govId;
  }

  function isInBranch(branchId) {
    if (!state.profile || !state.profile.branch_id) return false;
    return state.profile.branch_id === branchId;
  }

  function isInAcademy(academyId) {
    if (!state.profile || !state.profile.academy_id) return false;
    return state.profile.academy_id === academyId;
  }

  /* ============================================================
     12. PUBLIC API
     ============================================================ */

  var Permissions = {
    _initialized: true,

    // Core check
    can: function (resource, action, options) {
      return canDo(resource, action, options);
    },

    // Check multiple
    canAny: function (checks) {
      if (!Array.isArray(checks)) return false;
      for (var i = 0; i < checks.length; i++) {
        var c = checks[i];
        if (Permissions.can(c.resource, c.action, c.options)) return true;
      }
      return false;
    },

    canAll: function (checks) {
      if (!Array.isArray(checks)) return false;
      for (var i = 0; i < checks.length; i++) {
        var c = checks[i];
        if (!Permissions.can(c.resource, c.action, c.options)) return false;
      }
      return true;
    },

    // Direct matrix lookup (for admin/settings UI)
    hasPermission: function (role, resource, action, scope) {
      return hasPermission(role, resource, action, scope);
    },

    // Role helpers
    getRole: getRole,
    hasRole: hasRole,
    isSuperAdmin: isSuperAdmin,
    isCommittee: isCommittee,
    isBranchLevel: isBranchLevel,
    isAcademyLevel: isAcademyLevel,
    isPending: isPending,
    isActive: isActiveUser,

    // Scope helpers
    isInGovernorate: isInGovernorate,
    isInBranch: isInBranch,
    isInAcademy: isInAcademy,
    getScopeContext: getScopeContext,

    // Profile
    getProfile: function () {
      return state.profile ? JSON.parse(JSON.stringify(state.profile)) : null;
    },

    setProfile: function (profile) {
      var previousRole = state.profile ? state.profile.role : null;
      state.profile = profile;
      state.profileLoaded = !!profile;
      if (profile) saveProfileToCache();
      else clearProfileCache();
      notifyRoleListeners(previousRole);
      notifyListeners(null);
    },

    // Reload from DB
    refresh: function () {
      safeStorageRemove(getCacheKey());
      state.loaded = false;
      state.lastFetch = 0;
      return loadAll();
    },

    // Reload profile only
    refreshProfile: function () {
      clearProfileCache();
      return fetchProfileFromDb().then(function (profile) {
        var previousRole = state.profile ? state.profile.role : null;
        state.profile = profile;
        state.profileLoaded = !!profile;
        if (profile) saveProfileToCache();
        subscribeProfileRealtime();
        notifyRoleListeners(previousRole);
        notifyListeners(null);
        return profile;
      });
    },

    // Change subscription
    onChange: function (callback) {
      if (typeof callback !== 'function') return function () {};
      state.listeners.push(callback);
      return function unsubscribe() {
        var idx = state.listeners.indexOf(callback);
        if (idx !== -1) state.listeners.splice(idx, 1);
      };
    },

    onRoleChange: function (callback) {
      if (typeof callback !== 'function') return function () {};
      state.roleListeners.push(callback);
      return function unsubscribe() {
        var idx = state.roleListeners.indexOf(callback);
        if (idx !== -1) state.roleListeners.splice(idx, 1);
      };
    },

    // State
    isLoaded: function () { return state.loaded && state.profileLoaded; },
    isLoading: function () { return state.loading; },
    getError: function () { return state.error; },
    clearCache: function () {
      safeStorageRemove(getCacheKey());
      clearProfileCache();
      return true;
    },

    whenReady: function () {
      if (state.loaded && state.profileLoaded) {
        return Promise.resolve({
          profile: state.profile,
          role: getRole()
        });
      }
      return state.readyPromise;
    },

    // Roles constants
    ROLES: ROLES,
    COMMITTEE_ROLES: COMMITTEE_ROLES,
    BRANCH_ROLES: BRANCH_ROLES,
    ACADEMY_ROLES: ACADEMY_ROLES
  };

  window.Permissions = Permissions;

  /* ============================================================
     13. MAIN LOAD
     ============================================================ */

  function loadAll() {
    if (state.loading) return state.readyPromise;

    state.loading = true;

    return Promise.all([
      fetchPermissionsFromDb().catch(function (err) {
        log('error', 'Permissions fetch failed', err && err.message);
        return state.permissions || {};
      }),
      fetchProfileFromDb().catch(function (err) {
        log('error', 'Profile fetch failed', err && err.message);
        return state.profile;
      })
    ]).then(function (results) {
      state.permissions = results[0] || {};
      var newProfile = results[1];
      var previousRole = state.profile ? state.profile.role : null;

      if (newProfile) {
        state.profile = newProfile;
        state.profileLoaded = true;
        saveProfileToCache();
      } else {
        state.profile = null;
        state.profileLoaded = true;
        clearProfileCache();
      }

      state.loaded = true;
      state.loading = false;
      state.error = null;
      state.lastFetch = Date.now();

      savePermissionsToCache();

      subscribePermissionsRealtime();
      subscribeProfileRealtime();

      notifyRoleListeners(previousRole);
      notifyListeners(null);

      dispatchEvent('itws:permissions-loaded', {
        role: getRole(),
        profile: state.profile,
        permissionsCount: Object.keys(state.permissions).length
      });

      log('debug', 'Loaded', {
        role: getRole(),
        permissionsCount: Object.keys(state.permissions).length
      });

      if (state.readyResolve) {
        state.readyResolve({ profile: state.profile, role: getRole() });
      }

      return { profile: state.profile, role: getRole() };
    });
  }

  /* ============================================================
     14. INIT
     ============================================================ */

  function init() {
    // 1. Try caches first
    var hadPermsCache = loadPermissionsFromCache();
    var hadProfileCache = loadProfileFromCache();

    if (hadPermsCache && hadProfileCache) {
      dispatchEvent('itws:permissions-loaded', {
        role: getRole(),
        profile: state.profile,
        source: 'cache'
      });
      if (state.readyResolve) {
        state.readyResolve({ profile: state.profile, role: getRole() });
      }
    }

    // 2. Wait for sb
    var sb = getSb();
    if (!sb) {
      if (window.ITWS_SUPABASE_ERROR) {
        log('error', 'Supabase error: ' + window.ITWS_SUPABASE_ERROR);
        state.loaded = true;
        state.profileLoaded = true;
        if (state.readyResolve) state.readyResolve({ profile: null, role: null });
        return;
      }

      window.addEventListener('itws:sb-ready', function () {
        loadAll();
      }, { once: true });

      setTimeout(function () {
        if (!state.loaded) {
          state.loaded = true;
          state.profileLoaded = true;
          if (state.readyResolve) state.readyResolve({ profile: null, role: null });
        }
      }, 5000);

      return;
    }

    // 3. Load
    loadAll();

    // 4. Refresh on auth changes
    window.addEventListener('itws:auth-changed', function (e) {
      var event = e && e.detail ? e.detail.event : null;
      if (event === 'SIGNED_IN' || event === 'SIGNED_OUT') {
        log('debug', 'Auth changed: ' + event);
        clearProfileCache();
        loadAll();
      }
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  if (typeof window.addEventListener === 'function') {
    window.addEventListener('beforeunload', unsubscribeAll);
  }

})();
