// ============================================
// [NEW] ITWS Platform - App Settings Manager
// Path: assets/js/app-settings.js
// ============================================
// 💡 يقرأ الإعدادات من Supabase (مع cache في localStorage)
// 💡 يوفر API بسيط: get(path), onChange(cb), set(key, value)
// 💡 يطبق تلقائياً: font, splash config, إلخ
// 💡 يحدث نفسه عند تغيير الإعدادات من النقيب (realtime)
// ============================================

(function () {
  'use strict';

  if (window.AppSettings && window.AppSettings._initialized) return;

  var STORAGE_KEY = 'itws_settings_v1';
  var CHANNEL_NAME = 'itws-app-settings';

  var SETTINGS_KEYS = [
    'splash',
    'app_identity',
    'behavior',
    'theme',
    'accreditation',
    'certificates',
    'security',
    'uploads',
    'footer',
    'features'
  ];

  var state = {
    cache: {},                 // الإعدادات المحملة
    defaults: window.ITWS_SETTINGS_DEFAULTS || {},
    subscribers: [],
    channel: null,
    loaded: false,
    _initialized: true
  };

  // ============================================
  // 1. قراءة من localStorage (sync - فوري)
  // ============================================
  function readLocalCache() {
    try {
      var raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return {};
      var parsed = JSON.parse(raw);
      return parsed && typeof parsed === 'object' ? parsed : {};
    } catch (e) {
      return {};
    }
  }

  // ============================================
  // 2. حفظ في localStorage
  // ============================================
  function saveLocalCache(data) {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    } catch (e) {
      // localStorage ممتلئ — نتجاهل
    }
  }

  // ============================================
  // 3. Get — قراءة قيمة (sync)
  // ============================================
  // path = 'splash.min_duration_ms' أو 'app_identity.union_name'
  function get(path, fallback) {
    if (!path) return fallback;

    var parts = path.split('.');
    var value = state.cache;
    var i;

    // نبحث في cache
    for (i = 0; i < parts.length; i++) {
      if (value && typeof value === 'object') {
        value = value[parts[i]];
      } else {
        value = undefined;
        break;
      }
    }

    // لو لقيته في cache
    if (value !== undefined && value !== null) return value;

    // نبحث في defaults
    value = state.defaults;
    for (i = 0; i < parts.length; i++) {
      if (value && typeof value === 'object') {
        value = value[parts[i]];
      } else {
        value = undefined;
        break;
      }
    }

    return value !== undefined ? value : fallback;
  }

  // ============================================
  // 4. Get All في group
  // ============================================
  function getGroup(groupName) {
    var cached = state.cache[groupName] || {};
    var defaults = state.defaults[groupName] || {};
    // merge: defaults ثم cache فوقه
    return Object.assign({}, defaults, cached);
  }

  // ============================================
  // 5. Set — تحديث قيمة (للاستخدام من الإعدادات)
  // ============================================
  function set(groupName, newData) {
    if (!window.sb) return Promise.reject(new Error('Supabase not available'));

    var current = getGroup(groupName);
    var updated = Object.assign({}, current, newData);

    return window.sb
      .from('settings')
      .upsert({ key: groupName, value: updated }, { onConflict: 'key' })
      .then(function (res) {
        if (res.error) throw res.error;
        // نحدث الـ cache محلياً
        state.cache[groupName] = updated;
        saveLocalCache(state.cache);
        applyToDOM();
        notifySubscribers();
        return updated;
      });
  }

  // ============================================
  // 6. Load — جلب من Supabase
  // ============================================
  function load() {
    if (!window.sb) return Promise.resolve(false);

    return window.sb
      .from('settings')
      .select('key, value')
      .in('key', SETTINGS_KEYS)
      .then(function (res) {
        if (res.error || !res.data) {
          logDebug('Load failed:', res.error ? res.error.message : 'no data');
          return false;
        }

        // نبني الـ cache
        var newCache = {};
        res.data.forEach(function (row) {
          if (row.key && row.value) {
            newCache[row.key] = row.value;
          }
        });

        // نستخدم cache السابق كـ merge (لو فيه مفتاح ناقص)
        state.cache = Object.assign({}, state.cache, newCache);
        saveLocalCache(state.cache);
        state.loaded = true;

        applyToDOM();
        notifySubscribers();

        logDebug('Settings loaded:', Object.keys(newCache).length, 'groups');
        return true;
      })
      .catch(function (err) {
        logDebug('Load error:', err.message);
        return false;
      });
  }

  // ============================================
  // 7. تطبيق الإعدادات على DOM
  // ============================================
  function applyToDOM() {
    // (أ) الخط
    var fontFamily = get('behavior.font_family', 'Cairo');
    var fontSize = get('behavior.font_size', '16px');
    document.documentElement.style.setProperty('--font', "'" + fontFamily + "', 'Segoe UI', sans-serif");
    document.documentElement.style.setProperty('--font-size-base', fontSize);

    // (ب) لو الخط مش Cairo → نضيفه من Google Fonts
    if (fontFamily !== 'Cairo' && fontFamily !== 'system') {
      injectFontLink(fontFamily);
    }

    // (ج) عنوان الصفحة (لو مش موجود في app-title.js)
    var unionName = get('app_identity.union_name');
    if (unionName && !window.__itwsTitleSet) {
      // app-title.js بيتعامل مع ده
    }
  }

  // ============================================
  // 8. تحميل خط ديناميكي
  // ============================================
  function injectFontLink(fontFamily) {
    var id = 'itws-font-' + fontFamily.replace(/\s+/g, '-').toLowerCase();
    if (document.getElementById(id)) return;

    var link = document.createElement('link');
    link.id = id;
    link.rel = 'stylesheet';
    link.href = 'https://fonts.googleapis.com/css2?family=' +
      encodeURIComponent(fontFamily) +
      ':wght@300;400;500;600;700;800;900&display=swap';
    document.head.appendChild(link);
  }

  // ============================================
  // 9. Subscribe — يستمع لتغييرات النقيب
  // ============================================
  function subscribe() {
    if (!window.sb || state.channel) return;

    try {
      state.channel = window.sb
        .channel(CHANNEL_NAME)
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'settings' },
          function (payload) {
            var key = payload.new && payload.new.key;
            var value = payload.new && payload.new.value;
            if (key && SETTINGS_KEYS.indexOf(key) !== -1) {
              state.cache[key] = value;
              saveLocalCache(state.cache);
              applyToDOM();
              notifySubscribers(key, value);
              logDebug('Realtime update:', key);
            }
          }
        )
        .subscribe(function (status) {
          logDebug('Realtime channel:', status);
        });
    } catch (e) {
      logDebug('Subscribe failed:', e.message);
    }
  }

  // ============================================
  // 10. Notify Subscribers
  // ============================================
  function notifySubscribers(changedKey, changedValue) {
    state.subscribers.forEach(function (cb) {
      try {
        cb(state.cache, changedKey, changedValue);
      } catch (e) {}
    });

    // أحداث DOM
    try {
      window.dispatchEvent(new CustomEvent('itws:settings-changed', {
        detail: { key: changedKey, value: changedValue }
      }));
    } catch (e) {}
  }

  // ============================================
  // 11. onChange — للمكونات
  // ============================================
  function onChange(callback) {
    if (typeof callback !== 'function') return function () {};
    state.subscribers.push(callback);
    return function unsubscribe() {
      var idx = state.subscribers.indexOf(callback);
      if (idx !== -1) state.subscribers.splice(idx, 1);
    };
  }

  // ============================================
  // 12. Helpers للقراءة السريعة
  // ============================================
  function getSplash() { return getGroup('splash'); }
  function getAppIdentity() { return getGroup('app_identity'); }
  function getBehavior() { return getGroup('behavior'); }
  function getTheme() { return getGroup('theme'); }
  function getAccreditation() { return getGroup('accreditation'); }
  function getSecurity() { return getGroup('security'); }
  function getFeatures() { return getGroup('features'); }

  // ============================================
  // 13. Debug
  // ============================================
  function logDebug() {
    if (window.ITWS_CONFIG && window.ITWS_CONFIG.DEBUG) {
      console.log.apply(console, ['[AppSettings]'].concat(Array.prototype.slice.call(arguments)));
    }
  }

  // ============================================
  // 14. Init — التشغيل
  // ============================================
  function init() {
    // (1) نقرأ من localStorage فوراً (sync)
    state.cache = readLocalCache();

    // (2) نطبق اللي عندنا
    applyToDOM();

    // (3) نبدأ المستمعين
    if (window.sb) {
      // ننتظر تحميل Supabase
      load().then(function () {
        subscribe();
      });
    } else {
      // نحاول بعد ثانية
      setTimeout(function () {
        if (window.sb) {
          load().then(function () { subscribe(); });
        }
      }, 1000);
    }

    logDebug('AppSettings initialized', {
      fromCache: Object.keys(state.cache).length,
      defaults: Object.keys(state.defaults).length
    });
  }

  // ============================================
  // 15. Public API
  // ============================================
  window.AppSettings = {
    _initialized: true,
    _state: state,

    // Lifecycle
    init: init,
    load: load,
    reload: function () { return load(); },

    // Read
    get: get,
    getGroup: getGroup,
    getSplash: getSplash,
    getAppIdentity: getAppIdentity,
    getBehavior: getBehavior,
    getTheme: getTheme,
    getAccreditation: getAccreditation,
    getSecurity: getSecurity,
    getFeatures: getFeatures,

    // Write
    set: set,

    // Events
    onChange: onChange,

    // Apply manually
    apply: applyToDOM,

    // Status
    isLoaded: function () { return state.loaded; },
    getCache: function () { return state.cache; }
  };

  // ============================================
  // 16. Auto-init عند تحميل الملف
  // ============================================
  // نطبقه فوراً — قبل DOMContentLoaded
  state.cache = readLocalCache();
  applyToDOM();

  // بعد DOMContentLoaded → نكمل التحميل
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function () {
      init();
    });
  } else {
    init();
  }

})();
