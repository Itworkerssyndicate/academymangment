/* ============================================================
   ITWS Platform — App Settings Manager V2
   File: assets/js/app-settings.js
   Description: Load, cache, realtime-sync settings from Supabase
   Load order: FOURTH (after supabase-client.js)

   Features:
   - Loads all settings from Supabase
   - Merges with ITWS_SETTINGS_DEFAULTS
   - Caches in localStorage (instant render)
   - Realtime subscription for live updates
   - Public API: get, getGroup, set, refresh, onChange
   - Handles deprecated keys (general.* → app_identity.*)
   - Retry on network errors
   - Fallback to defaults if Supabase fails

   Rules:
   - No emoji
   - ES5-style IIFE
   - window.sb only
   ============================================================ */

(function () {
  'use strict';

  if (window.AppSettings && window.AppSettings._initialized) {
    return;
  }

  /* ============================================================
     1. HELPERS — Dependencies
     ============================================================ */

  function log(level, msg, data) {
    var cfg = window.ITWS_CONFIG || {};
    if (level === 'error' || (cfg.DEBUG && level === 'debug')) {
      try {
        var args = ['[AppSettings]', msg];
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

  function getDefaults() {
    return window.ITWS_SETTINGS_DEFAULTS || {};
  }

  function getDeprecatedKeys() {
    return window.ITWS_DEPRECATED_KEYS || {};
  }

  function getCacheKey() {
    var cfg = getConfig();
    if (cfg.STORAGE_KEYS && cfg.STORAGE_KEYS.SETTINGS_CACHE) {
      return cfg.STORAGE_KEYS.SETTINGS_CACHE;
    }
    return 'itws_settings_cache';
  }

  /* ============================================================
     2. STATE
     ============================================================ */

  var state = {
    loaded: false,
    loading: false,
    error: null,
    settings: {},
    rawSettings: {},
    lastFetch: 0,
    listeners: [],
    realtimeChannel: null,
    readyPromise: null,
    readyResolve: null
  };

  state.readyPromise = new Promise(function (resolve) {
    state.readyResolve = resolve;
  });

  /* ============================================================
     3. HELPERS — Objects
     ============================================================ */

  function isPlainObject(v) {
    return v !== null && typeof v === 'object' && !Array.isArray(v);
  }

  function deepMerge(target, source) {
    if (!isPlainObject(target)) target = {};
    if (!isPlainObject(source)) return target;

    Object.keys(source).forEach(function (key) {
      var tVal = target[key];
      var sVal = source[key];

      if (isPlainObject(tVal) && isPlainObject(sVal)) {
        target[key] = deepMerge(tVal, sVal);
      } else if (sVal !== undefined) {
        target[key] = sVal;
      }
    });

    return target;
  }

  function getByPath(obj, path) {
    if (!obj || !path) return undefined;
    var parts = String(path).split('.');
    var current = obj;
    for (var i = 0; i < parts.length; i++) {
      if (current == null || typeof current !== 'object') return undefined;
      current = current[parts[i]];
    }
    return current;
  }

  function setByPath(obj, path, value) {
    if (!obj || !path) return;
    var parts = String(path).split('.');
    var current = obj;
    for (var i = 0; i < parts.length - 1; i++) {
      var p = parts[i];
      if (!isPlainObject(current[p])) current[p] = {};
      current = current[p];
    }
    current[parts[parts.length - 1]] = value;
  }

  function resolveDeprecatedPath(path) {
    if (!path) return path;
    var map = getDeprecatedKeys();
    return map[path] || path;
  }

  function clone(v) {
    if (v === null || typeof v !== 'object') return v;
    try {
      return JSON.parse(JSON.stringify(v));
    } catch (e) {
      return v;
    }
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
     4. CACHE
     ============================================================ */

  function loadFromCache() {
    var raw = safeStorageGet(getCacheKey());
    if (!raw) return false;

    try {
      var parsed = JSON.parse(raw);
      if (!parsed || typeof parsed !== 'object') return false;

      var data = parsed.data || parsed;
      var ts = parsed.timestamp || 0;
      if (!data || typeof data !== 'object') return false;

      state.rawSettings = data;
      state.settings = buildMergedSettings(data);
      state.lastFetch = ts;
      state.loaded = true;

      log('debug', 'Loaded from cache', Object.keys(data));
      return true;
    } catch (e) {
      log('error', 'Cache parse failed', e);
      return false;
    }
  }

  function saveToCache() {
    var payload = {
      data: state.rawSettings,
      timestamp: Date.now()
    };
    safeStorageSet(getCacheKey(), JSON.stringify(payload));
  }

  function clearCache() {
    safeStorageRemove(getCacheKey());
    state.lastFetch = 0;
    log('debug', 'Cache cleared');
  }

  /* ============================================================
     5. FETCH — Supabase
     ============================================================ */

  function fetchFromDb(retryCount) {
    retryCount = retryCount || 0;
    var sb = getSb();

    if (!sb) {
      return Promise.reject(new Error('Supabase client not available'));
    }

    state.loading = true;

    return sb
      .from('settings')
      .select('key, value')
      .then(function (res) {
        if (res.error) {
          throw new Error(res.error.message);
        }

        var data = {};
        (res.data || []).forEach(function (row) {
          if (row && row.key) {
            data[row.key] = row.value || {};
          }
        });

        return data;
      })
      .catch(function (err) {
        var msg = (err && err.message ? err.message : '').toLowerCase();
        var isNetworkError = (
          msg.indexOf('fetch') !== -1 ||
          msg.indexOf('network') !== -1 ||
          msg.indexOf('timeout') !== -1
        );

        if (isNetworkError && retryCount < 2) {
          log('debug', 'Fetch retry ' + (retryCount + 1));
          return new Promise(function (resolve) {
            setTimeout(resolve, 1000 * Math.pow(2, retryCount));
          }).then(function () {
            return fetchFromDb(retryCount + 1);
          });
        }

        throw err;
      });
  }

  /* ============================================================
     6. MERGE — Defaults + DB
     ============================================================ */

  function buildMergedSettings(rawData) {
    var defaults = getDefaults();
    var merged = {};

    // Start with defaults (deep clone)
    Object.keys(defaults).forEach(function (key) {
      merged[key] = clone(defaults[key]);
    });

    // Override with DB
    Object.keys(rawData || {}).forEach(function (key) {
      var dbVal = rawData[key];
      var defVal = merged[key];

      if (isPlainObject(defVal) && isPlainObject(dbVal)) {
        merged[key] = deepMerge(clone(defVal), dbVal);
      } else if (dbVal !== undefined && dbVal !== null) {
        merged[key] = clone(dbVal);
      }
    });

    return merged;
  }

  /* ============================================================
     7. CHANGE NOTIFICATION
     ============================================================ */

  function notifyListeners(changedKey) {
    var snapshot = state.settings;
    var listeners = state.listeners.slice();

    listeners.forEach(function (fn) {
      try { fn(snapshot, changedKey); }
      catch (e) { log('error', 'Listener error', e); }
    });

    dispatchEvent('itws:settings-changed', {
      key: changedKey,
      settings: snapshot
    });
  }

  /* ============================================================
     8. REALTIME
     ============================================================ */

  function subscribeRealtime() {
    var sb = getSb();
    if (!sb) return;

    try {
      if (state.realtimeChannel) {
        try { sb.removeChannel(state.realtimeChannel); } catch (e) {}
        state.realtimeChannel = null;
      }

      state.realtimeChannel = sb
        .channel('itws_settings_changes')
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'settings' },
          function (payload) {
            var row = payload.new || payload.old;
            if (!row || !row.key) return;

            var key = row.key;

            if (payload.eventType === 'DELETE') {
              delete state.rawSettings[key];
              var defVal = getDefaults()[key];
              if (defVal) state.settings[key] = clone(defVal);
              else delete state.settings[key];
            } else {
              var dbVal = row.value || {};
              state.rawSettings[key] = dbVal;
              var defVal2 = getDefaults()[key];
              if (isPlainObject(defVal2)) {
                state.settings[key] = deepMerge(clone(defVal2), dbVal);
              } else {
                state.settings[key] = clone(dbVal);
              }
            }

            saveToCache();
            notifyListeners(key);
            log('debug', 'Realtime', { key: key, event: payload.eventType });
          }
        )
        .subscribe(function (status) {
          log('debug', 'Realtime status', status);
        });

    } catch (e) {
      log('error', 'Realtime subscription failed', e);
    }
  }

  function unsubscribeRealtime() {
    var sb = getSb();
    if (!sb || !state.realtimeChannel) return;
    try { sb.removeChannel(state.realtimeChannel); } catch (e) {}
    state.realtimeChannel = null;
  }

  /* ============================================================
     9. MAIN LOAD
     ============================================================ */

  function load() {
    if (state.loading) return state.readyPromise;

    if (state.loaded && (Date.now() - state.lastFetch) < 60 * 1000) {
      return Promise.resolve(state.settings);
    }

    return fetchFromDb()
      .then(function (data) {
        state.rawSettings = data;
        state.settings = buildMergedSettings(data);
        state.lastFetch = Date.now();
        state.loaded = true;
        state.loading = false;
        state.error = null;

        saveToCache();
        notifyListeners(null);
        dispatchEvent('itws:settings-loaded', {
          settings: state.settings,
          source: 'db'
        });

        log('debug', 'Loaded from DB', Object.keys(data));

        if (state.readyResolve) state.readyResolve(state.settings);
        return state.settings;
      })
      .catch(function (err) {
        state.loading = false;
        state.error = err && err.message ? err.message : String(err);

        if (state.loaded) {
          log('error', 'Fetch failed, using cache', state.error);
          return state.settings;
        }

        log('error', 'Fetch failed, using defaults', state.error);
        state.settings = buildMergedSettings({});
        state.loaded = true;

        if (state.readyResolve) state.readyResolve(state.settings);
        return state.settings;
      });
  }

  /* ============================================================
     10. PUBLIC API
     ============================================================ */

  var AppSettings = {
    _initialized: true,

    get: function (path, fallback) {
      if (!path) return fallback;

      var resolvedPath = resolveDeprecatedPath(path);
      var val = getByPath(state.settings, resolvedPath);

      if (val === undefined || val === null) {
        if (typeof window.getSettingDefault === 'function') {
          return window.getSettingDefault(resolvedPath, fallback);
        }
        var defVal = getByPath(getDefaults(), resolvedPath);
        return defVal === undefined ? fallback : defVal;
      }

      return val;
    },

    getGroup: function (groupName) {
      if (!groupName) return null;
      var val = state.settings[groupName];
      if (val === undefined) val = getDefaults()[groupName];
      return clone(val) || null;
    },

    getGroups: function () {
      return Object.keys(state.settings);
    },

    getRaw: function () {
      return clone(state.rawSettings);
    },

    set: function (key, value, options) {
      options = options || {};
      var sb = getSb();

      if (!sb) {
        return Promise.reject(new Error('Supabase client not available'));
      }

      if (!key) {
        return Promise.reject(new Error('key is required'));
      }

      // Optional client-side permission check
      if (window.Permissions && typeof window.Permissions.can === 'function') {
        if (!window.Permissions.can('settings', 'update')) {
          return Promise.reject(new Error('Not authorized'));
        }
      }

      var payload = value;

      if (options.merge) {
        var current = state.rawSettings[key] || {};
        payload = deepMerge(clone(current), value || {});
      }

      var update = {
        key: key,
        value: payload,
        updated_at: new Date().toISOString()
      };

      return sb.auth.getUser()
        .then(function (res) {
          if (res && res.data && res.data.user) {
            update.updated_by = res.data.user.id;
          }
          return sb.from('settings').upsert(update, { onConflict: 'key' });
        })
        .then(function (res) {
          if (res.error) throw new Error(res.error.message);

          state.rawSettings[key] = payload;
          var defVal = getDefaults()[key];
          if (isPlainObject(defVal)) {
            state.settings[key] = deepMerge(clone(defVal), payload);
          } else {
            state.settings[key] = clone(payload);
          }

          saveToCache();
          notifyListeners(key);
          log('debug', 'Setting saved', key);
          return true;
        });
    },

    refresh: function () {
      clearCache();
      state.loaded = false;
      state.lastFetch = 0;
      return load();
    },

    onChange: function (callback) {
      if (typeof callback !== 'function') return function () {};
      state.listeners.push(callback);
      return function unsubscribe() {
        var idx = state.listeners.indexOf(callback);
        if (idx !== -1) state.listeners.splice(idx, 1);
      };
    },

    clearCache: function () {
      clearCache();
      return true;
    },

    isLoaded: function () { return state.loaded; },
    isLoading: function () { return state.loading; },
    getError: function () { return state.error; },
    getLastFetch: function () { return state.lastFetch; },

    whenReady: function () {
      if (state.loaded) return Promise.resolve(state.settings);
      return state.readyPromise;
    }
  };

  window.AppSettings = AppSettings;

  /* ============================================================
     11. INIT
     ============================================================ */

  function fallbackToDefaults() {
    if (state.loaded) return;
    state.settings = buildMergedSettings({});
    state.loaded = true;
    state.loading = false;
    if (state.readyResolve) state.readyResolve(state.settings);
    log('error', 'Fallback to defaults');
  }

  function init() {
    // 1. Load from cache first
    var hadCache = loadFromCache();
    if (hadCache) {
      dispatchEvent('itws:settings-loaded', {
        settings: state.settings,
        source: 'cache'
      });
      if (state.readyResolve) state.readyResolve(state.settings);
    }

    // 2. Check Supabase availability
    var sb = getSb();
    if (!sb) {
      if (window.ITWS_SUPABASE_ERROR) {
        log('error', 'Supabase error: ' + window.ITWS_SUPABASE_ERROR);
        fallbackToDefaults();
        return;
      }

      // Wait for sb-ready event
      window.addEventListener('itws:sb-ready', function () {
        load().then(function () { subscribeRealtime(); });
      }, { once: true });

      // Timeout fallback
      setTimeout(function () {
        if (!state.loaded) fallbackToDefaults();
      }, 5000);

      return;
    }

    // 3. sb available — load immediately
    load().then(function () { subscribeRealtime(); });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  // Cleanup
  if (typeof window.addEventListener === 'function') {
    window.addEventListener('beforeunload', unsubscribeRealtime);
  }

})();
