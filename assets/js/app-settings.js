/**
 * ================================================================
 * ITWS APP SETTINGS — V3 (EXPANDED)
 * assets/js/app-settings.js
 * ================================================================
 * طبقة الوصول الموحدة لكل الإعدادات في المنصة.
 *
 * الفكرة:
 *   أي ملف في المنصة بيكتب:
 *     var name = AppSettings.get('app_identity.name');
 *   وبياخد القيمة الصح من أول مصدر متاح.
 *
 * ترتيب المصادر (الأولوية من فوق لتحت):
 *   1. DB (settings table) — لو محمّلة وموجودة
 *   2. localStorage (user override) — لو الزائر عدّل حاجة
 *   3. settings-defaults.js — القيم الافتراضية
 *   4. fallback argument — لو اتبعت
 *
 * المزايا:
 *   - Caching (LRU بسيط — 200 entry)
 *   - Deep path resolution (a.b.c.d)
 *   - Group access (getGroup('theme') → كل مجموعة)
 *   - Listeners (onChange)
 *   - Batch load من DB (استعلام واحد)
 *   - Realtime sync (عبر Realtime.subscribe)
 *   - reload() يدوي
 *   - Type coercion helpers (getBool, getInt, getFloat, getArray)
 *   - User override API (setUserOverride / clearUserOverride)
 *
 * الترتيب في <head>:
 *   <script src="assets/js/settings-defaults.js"></script>
 *   <script src="assets/js/config.js"></script>
 *   <script src="assets/js/themes-data.js"></script>
 *   <script src="assets/js/theme.js"></script>
 *   <script src="assets/js/app-settings.js"></script>     ← إنت هنا
 *
 * ES5-safe. Silent. بدون console.error.
 * ================================================================
 */

(function () {
  'use strict';

  // =============================================================
  // Guard
  // =============================================================

  if (!window.ITWS_SETTINGS_DEFAULTS) {
    if (window.__itwsDebug) {
      window.__itwsDebug('app-settings.js: settings-defaults not loaded');
    }
    // stub
    window.AppSettings = {
      get: function (key, fallback) { return fallback; },
      getGroup: function () { return {}; },
      getBool: function (key, fb) { return fb === true; },
      getInt: function (key, fb) { return fb || 0; },
      getFloat: function (key, fb) { return fb || 0; },
      getArray: function (key, fb) { return fb || []; },
      set: function () { return false; },
      setUserOverride: function () { return false; },
      clearUserOverride: function () { return false; },
      onChange: function () {},
      reload: function () { return null; },
      isLoaded: function () { return false; },
      getAll: function () { return {}; }
    };
    return;
  }

  // =============================================================
  // Constants
  // =============================================================

  var OVERRIDE_KEY = 'itws_user_prefs';
  var CACHE_MAX = 200;

  var DEFAULTS = window.ITWS_SETTINGS_DEFAULTS;

  // =============================================================
  // State
  // =============================================================

  var state = {
    db: {},                    // { group: { key: value } } من DB
    dbLoaded: false,
    dbLoadPromise: null,
    overrides: {},             // { group: { key: value } } من localStorage
    cache: {},                 // { 'group.key': value }
    cacheOrder: [],            // LRU
    listeners: [],
    subscribers: {},           // key → [callbacks]
    loading: false,
    lastError: null,
    version: 3
  };

  // =============================================================
  // Deep path helpers
  // =============================================================

  function splitPath(path) {
    if (!path) { return []; }
    return String(path).split('.');
  }

  function deepGet(obj, path) {
    if (!obj || !path) { return undefined; }
    var parts = splitPath(path);
    var cur = obj;
    for (var i = 0; i < parts.length; i++) {
      if (cur === null || cur === undefined) { return undefined; }
      if (typeof cur !== 'object') { return undefined; }
      cur = cur[parts[i]];
    }
    return cur;
  }

  function deepSet(obj, path, value) {
    if (!obj || !path) { return obj; }
    var parts = splitPath(path);
    var cur = obj;
    for (var i = 0; i < parts.length - 1; i++) {
      var k = parts[i];
      if (typeof cur[k] !== 'object' || cur[k] === null) {
        cur[k] = {};
      }
      cur = cur[k];
    }
    cur[parts[parts.length - 1]] = value;
    return obj;
  }

  function isObject(v) {
    return v !== null && typeof v === 'object' && !Array.isArray(v);
  }

  function deepMerge(target, source) {
    if (!isObject(source)) { return target; }
    for (var k in source) {
      if (!Object.prototype.hasOwnProperty.call(source, k)) { continue; }
      if (isObject(source[k]) && isObject(target[k])) {
        target[k] = deepMerge(target[k], source[k]);
      } else {
        target[k] = source[k];
      }
    }
    return target;
  }

  // =============================================================
  // Cache (LRU بسيط)
  // =============================================================

  function cacheGet(key) {
    if (Object.prototype.hasOwnProperty.call(state.cache, key)) {
      // move to end (most recently used)
      var idx = state.cacheOrder.indexOf(key);
      if (idx >= 0) {
        state.cacheOrder.splice(idx, 1);
        state.cacheOrder.push(key);
      }
      return state.cache[key];
    }
    return undefined;
  }

  function cacheSet(key, value) {
    if (state.cacheOrder.length >= CACHE_MAX) {
      var oldest = state.cacheOrder.shift();
      if (oldest) {
        delete state.cache[oldest];
      }
    }
    state.cache[key] = value;
    state.cacheOrder.push(key);
  }

  function cacheClear() {
    state.cache = {};
    state.cacheOrder = [];
  }

  // =============================================================
  // localStorage overrides
  // =============================================================

  function loadOverrides() {
    try {
      var raw = window.localStorage.getItem(OVERRIDE_KEY);
      if (!raw) {
        state.overrides = {};
        return;
      }
      var parsed = JSON.parse(raw);
      if (isObject(parsed)) {
        state.overrides = parsed;
      } else {
        state.overrides = {};
      }
    } catch (e) {
      state.overrides = {};
    }
  }

  function saveOverrides() {
    try {
      window.localStorage.setItem(OVERRIDE_KEY, JSON.stringify(state.overrides));
    } catch (e) {}
  }

  // =============================================================
  // Resolve value — الترتيب: overrides → DB → defaults → fallback
  // =============================================================

  function resolve(key, fallback) {
    // 1. overrides (user)
    var ov = deepGet(state.overrides, key);
    if (ov !== undefined) {
      return { value: ov, source: 'override' };
    }

    // 2. DB
    if (state.dbLoaded) {
      var dbv = deepGet(state.db, key);
      if (dbv !== undefined) {
        return { value: dbv, source: 'db' };
      }
    }

    // 3. defaults
    var def = deepGet(DEFAULTS, key);
    if (def !== undefined) {
      return { value: def, source: 'default' };
    }

    // 4. fallback
    if (fallback !== undefined) {
      return { value: fallback, source: 'fallback' };
    }

    return { value: undefined, source: 'none' };
  }

  // =============================================================
  // get — public API
  // =============================================================

  function get(key, fallback) {
    if (!key) { return fallback; }

    // cache hit (بس لو القيمة مش من fallback)
    var cached = cacheGet(key);
    if (cached !== undefined) {
      return cached;
    }

    var r = resolve(key, fallback);
    if (r.value !== undefined) {
      // مفيش cache للـ fallback عشان لو DB جت بعدين نلاقيها
      if (r.source !== 'fallback') {
        cacheSet(key, r.value);
      }
      return r.value;
    }
    return fallback;
  }

  // =============================================================
  // getWithSource — بيرجع { value, source } (للتشخيص)
  // =============================================================

  function getWithSource(key, fallback) {
    if (!key) { return { value: fallback, source: 'none' }; }
    return resolve(key, fallback);
  }

  // =============================================================
  // getGroup — بيرجع المجموعة كاملة (merged overrides + db + defaults)
  // =============================================================

  function getGroup(groupName) {
    if (!groupName) { return {}; }

    // ابدأ من defaults
    var base = {};
    var defGroup = DEFAULTS[groupName];
    if (isObject(defGroup)) {
      base = deepClone(defGroup);
    }

    // override بـ DB
    if (state.dbLoaded && isObject(state.db[groupName])) {
      base = deepMerge(base, state.db[groupName]);
    }

    // override بـ user
    if (isObject(state.overrides[groupName])) {
      base = deepMerge(base, state.overrides[groupName]);
    }

    return base;
  }

  function deepClone(obj) {
    if (!isObject(obj) && !Array.isArray(obj)) { return obj; }
    try {
      return JSON.parse(JSON.stringify(obj));
    } catch (e) {
      var out = Array.isArray(obj) ? [] : {};
      for (var k in obj) {
        if (Object.prototype.hasOwnProperty.call(obj, k)) {
          out[k] = deepClone(obj[k]);
        }
      }
      return out;
    }
  }

  // =============================================================
  // Typed getters
  // =============================================================

  function getBool(key, fallback) {
    var v = get(key, fallback);
    if (v === true || v === 'true' || v === 1 || v === '1') { return true; }
    if (v === false || v === 'false' || v === 0 || v === '0') { return false; }
    if (fallback !== undefined) { return !!fallback; }
    return !!v;
  }

  function getInt(key, fallback) {
    var v = get(key, fallback);
    var n = parseInt(v, 10);
    if (isNaN(n)) {
      return (typeof fallback === 'number') ? fallback : 0;
    }
    return n;
  }

  function getFloat(key, fallback) {
    var v = get(key, fallback);
    var n = parseFloat(v);
    if (isNaN(n)) {
      return (typeof fallback === 'number') ? fallback : 0;
    }
    return n;
  }

  function getArray(key, fallback) {
    var v = get(key, fallback);
    if (Array.isArray(v)) { return v; }
    if (typeof v === 'string') {
      // "a,b,c" → ["a","b","c"]
      try {
        var parsed = JSON.parse(v);
        if (Array.isArray(parsed)) { return parsed; }
      } catch (e) {}
      return v.split(',').map(function (s) { return s.trim(); });
    }
    return Array.isArray(fallback) ? fallback : [];
  }

  function getObject(key, fallback) {
    var v = get(key, fallback);
    if (isObject(v)) { return v; }
    return isObject(fallback) ? fallback : {};
  }

  // =============================================================
  // set — يعدل قيمة في الـ overrides (مش DB)
  // =============================================================

  function set(key, value) {
    if (!key) { return false; }

    // حط في overrides
    deepSet(state.overrides, key, value);
    saveOverrides();

    // امسح من الـ cache
    delete state.cache[key];

    // notify
    notifyChange(key, value, 'override');

    return true;
  }

  // =============================================================
  // setUserOverride / clearUserOverride
  // =============================================================

  function setUserOverride(key, value) {
    return set(key, value);
  }

  function clearUserOverride(key) {
    if (!key) {
      // امسح كل الـ overrides
      state.overrides = {};
      saveOverrides();
      cacheClear();
      notifyChange('*', null, 'cleared-all');
      return true;
    }

    // امسح مفتاح معين
    var parts = splitPath(key);
    if (parts.length === 0) { return false; }

    var cur = state.overrides;
    for (var i = 0; i < parts.length - 1; i++) {
      if (!isObject(cur[parts[i]])) { return false; }
      cur = cur[parts[i]];
    }
    var lastKey = parts[parts.length - 1];
    if (Object.prototype.hasOwnProperty.call(cur, lastKey)) {
      delete cur[lastKey];
      saveOverrides();
      delete state.cache[key];
      notifyChange(key, undefined, 'cleared');
      return true;
    }
    return false;
  }

  // =============================================================
  // Listeners
  // =============================================================

  function notifyChange(key, value, source) {
    // global listeners
    for (var i = 0; i < state.listeners.length; i++) {
      try {
        state.listeners[i](key, value, source);
      } catch (e) {}
    }
    // subscribers للـ key ده
    var subs = state.subscribers[key];
    if (subs) {
      for (var j = 0; j < subs.length; j++) {
        try {
          subs[j](value, source);
        } catch (e) {}
      }
    }
    // wildcard subs
    var wild = state.subscribers['*'];
    if (wild) {
      for (var k = 0; k < wild.length; k++) {
        try {
          wild[k](key, value, source);
        } catch (e) {}
      }
    }
  }

  function onChange(cb) {
    if (typeof cb === 'function') {
      state.listeners.push(cb);
    }
  }

  function offChange(cb) {
    for (var i = state.listeners.length - 1; i >= 0; i--) {
      if (state.listeners[i] === cb) {
        state.listeners.splice(i, 1);
      }
    }
  }

  function subscribe(key, cb) {
    if (!key || typeof cb !== 'function') { return; }
    if (!state.subscribers[key]) {
      state.subscribers[key] = [];
    }
    state.subscribers[key].push(cb);
  }

  function unsubscribe(key, cb) {
    if (!state.subscribers[key]) { return; }
    var arr = state.subscribers[key];
    for (var i = arr.length - 1; i >= 0; i--) {
      if (arr[i] === cb) {
        arr.splice(i, 1);
      }
    }
  }

  // =============================================================
  // DB loading — batch من settings table
  // =============================================================

  function loadFromDb() {
    if (!window.sb) {
      // مفيش supabase client — نستخدم defaults
      state.dbLoaded = false;
      return Promise.resolve(false);
    }

    if (state.dbLoadPromise) {
      return state.dbLoadPromise;
    }

    state.loading = true;

    state.dbLoadPromise = window.sb
      .from('settings')
      .select('key, value')
      .then(function (res) {
        state.loading = false;

        if (res && res.error) {
          state.lastError = res.error.message || 'db_error';
          state.dbLoaded = false;
          return false;
        }

        var rows = (res && res.data) || [];
        var db = {};

        for (var i = 0; i < rows.length; i++) {
          var row = rows[i];
          if (!row || !row.key) { continue; }
          // المفتاح في DB ممكن يكون "theme" أو "theme.default_theme"
          if (row.key.indexOf('.') >= 0) {
            deepSet(db, row.key, row.value);
          } else {
            db[row.key] = row.value;
          }
        }

        state.db = db;
        state.dbLoaded = true;

        // امسح الـ cache عشان القيم الجديدة تظهر
        cacheClear();

        notifyChange('*', null, 'db-loaded');

        if (window.__itwsDebug) {
          window.__itwsDebug('AppSettings: DB loaded', {
            groups: Object.keys(db).length
          });
        }

        return true;
      })
      .catch(function (err) {
        state.loading = false;
        state.lastError = (err && err.message) || 'load_failed';
        state.dbLoaded = false;
        return false;
      });

    return state.dbLoadPromise;
  }

  // =============================================================
  // reload — يمسح الـ cache ويعيد التحميل
  // =============================================================

  function reload() {
    cacheClear();
    state.dbLoadPromise = null;
    return loadFromDb();
  }

  // =============================================================
  // Realtime subscription
  // =============================================================

  function watchRealtime() {
    try {
      if (!window.Realtime || typeof window.Realtime.subscribe !== 'function') {
        return;
      }
      window.Realtime.subscribe('settings', function (payload) {
        try {
          if (!payload) { return; }
          var row = payload.new || payload.old;
          if (!row || !row.key) { return; }

          var key = row.key;
          var value = payload.new ? row.value : undefined;

          // update local db
          if (key.indexOf('.') >= 0) {
            deepSet(state.db, key, value);
          } else {
            state.db[key] = value;
          }

          state.dbLoaded = true;

          // clear cache
          delete state.cache[key];
          cacheClear();

          // notify
          notifyChange(key, value, 'realtime');
        } catch (e) {}
      }, { debounce: 500 });
    } catch (e) {}
  }

  // =============================================================
  // Init
  // =============================================================

  function init() {
    // 1. اقرأ overrides من localStorage فوراً
    loadOverrides();

    // 2. جرب تحمل من DB (async)
    if (window.sb) {
      loadFromDb();
    } else {
      // استنى لحد ما supabase-client.js يتحمل
      var tries = 0;
      var maxTries = 30; // 3 ثواني
      var interval = setInterval(function () {
        tries++;
        if (window.sb) {
          clearInterval(interval);
          loadFromDb().then(function () {
            watchRealtime();
          });
        } else if (tries >= maxTries) {
          clearInterval(interval);
          if (window.__itwsDebug) {
            window.__itwsDebug('AppSettings: supabase client not available after timeout');
          }
        }
      }, 100);
    }

    // 3. watch realtime (لو متاح فوراً)
    if (window.Realtime) {
      watchRealtime();
    }

    if (window.__itwsDebug) {
      window.__itwsDebug('AppSettings initialized', {
        overrides: Object.keys(state.overrides).length,
        hasSupabase: !!window.sb
      });
    }
  }

  // =============================================================
  // Debug info
  // =============================================================

  function getDebugInfo() {
    return {
      version: state.version,
      dbLoaded: state.dbLoaded,
      dbGroups: Object.keys(state.db).length,
      overrides: Object.keys(state.overrides).length,
      cacheSize: state.cacheOrder.length,
      listeners: state.listeners.length,
      loading: state.loading,
      lastError: state.lastError
    };
  }

  // =============================================================
  // Export
  // =============================================================

  window.AppSettings = {
    // Read
    get:              get,
    getWithSource:    getWithSource,
    getGroup:         getGroup,

    // Typed getters
    getBool:          getBool,
    getInt:           getInt,
    getFloat:         getFloat,
    getArray:         getArray,
    getObject:        getObject,

    // Write (user override)
    set:              set,
    setUserOverride:  setUserOverride,
    clearUserOverride: clearUserOverride,

    // Listeners
    onChange:         onChange,
    offChange:        offChange,
    subscribe:        subscribe,
    unsubscribe:      unsubscribe,

    // Lifecycle
    reload:           reload,
    loadFromDb:       loadFromDb,

    // Status
    isLoaded:         function () { return state.dbLoaded; },
    isLoading:        function () { return state.loading; },
    getAll:           function () { return deepClone(state.db); },
    getDebugInfo:     getDebugInfo,

    // Direct access (advanced)
    _getDb:           function () { return state.db; },
    _getOverrides:    function () { return state.overrides; },
    _clearCache:      cacheClear
  };

  // Aliases
  window.Settings = window.AppSettings;

  // =============================================================
  // Init immediately
  // =============================================================

  init();

})();
