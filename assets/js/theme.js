/**
 * ================================================================
 * ITWS THEME MANAGER — V4 (EXPANDED)
 * assets/js/theme.js
 * ================================================================
 * مدير الثيمات الكامل.
 *
 * الوظائف:
 *   1. FOUC Prevention — بيطبق الثيم قبل تحميل CSS
 *   2. CSS Variables Generator — يولّد كل الـ tokens من theme object
 *   3. 3-Layer Override — localStorage → DB → default → neon-dark
 *   4. Public API — change, reset, next, previous, cycle, onChange
 *   5. System Preference — prefers-color-scheme support
 *   6. Reduced Motion — respect لـ prefers-reduced-motion
 *   7. Realtime Sync — يستمع لتغيير default_theme من الأدمن
 *   8. Storage Sync — بين التابات (storage event)
 *
 * الترتيب في <head>:
 *   <script src="assets/js/settings-defaults.js"></script>
 *   <script src="assets/js/config.js"></script>
 *   <script src="assets/js/themes-data.js"></script>
 *   <script src="assets/js/theme.js"></script>          ← إنت هنا
 *
 * ES5-safe. Silent. بدون console.error.
 * ================================================================
 */

(function () {
  'use strict';

  // =============================================================
  // Guard — لازم themes-data.js يكون محمّل
  // =============================================================

  if (!window.ThemesData || !window.ITWS_THEMES) {
    // نسجل تحذير في debug فقط، ونوقف بهدوء
    if (window.__itwsDebug) {
      window.__itwsDebug('theme.js: ThemesData not loaded');
    }
    // نحط stub عشان باقي الكود ما يكسرش
    window.ThemeManager = {
      change: function () {},
      reset: function () {},
      getCurrent: function () { return null; },
      getCurrentId: function () { return 'neon-dark'; },
      getAll: function () { return []; },
      onChange: function () {},
      next: function () {},
      previous: function () {},
      cycle: function () {},
      setSystemMode: function () {},
      isDark: function () { return true; },
      exists: function () { return false; }
    };
    return;
  }

  // =============================================================
  // Constants
  // =============================================================

  var STORAGE_KEY = (function () {
    try {
      if (window.ITWS_CONFIG && window.ITWS_CONFIG.storageKeys && window.ITWS_CONFIG.storageKeys.theme) {
        return window.ITWS_CONFIG.storageKeys.theme;
      }
    } catch (e) {}
    return 'itws_theme';
  })();

  var SYSTEM_KEY = 'itws_theme_system'; // flag للـ system mode
  var FALLBACK_ID = 'neon-dark';

  // =============================================================
  // State
  // =============================================================

  var state = {
    currentId: null,
    current: null,
    source: 'fallback',       // 'localStorage' | 'db' | 'default' | 'fallback' | 'system'
    systemMode: false,         // true = يتبع prefers-color-scheme
    allowOverride: true,
    listeners: [],
    initialized: false
  };

  // =============================================================
  // DOM Helpers
  // =============================================================

  function htmlEl() {
    return document.documentElement;
  }

  function setVar(name, value) {
    try {
      htmlEl().style.setProperty(name, value);
    } catch (e) {}
  }

  function setAttr(name, value) {
    try {
      htmlEl().setAttribute(name, value);
    } catch (e) {}
  }

  // =============================================================
  // Apply Theme — يولّد كل الـ CSS variables من theme object
  // =============================================================

  function applyTheme(theme) {
    if (!theme) { return; }

    var root = htmlEl();

    // ---- Meta ----
    setAttr('data-theme', theme.id);
    setAttr('data-theme-type', theme.type || 'dark');
    setAttr('data-theme-category', theme.category || 'core');

    // ---- Accent (primary) ----
    setVar('--accent', theme.accent);
    setVar('--accent-rgb', theme.accentRgb);

    // ---- Accent 2 (secondary) ----
    setVar('--accent-2', theme.accent2);
    setVar('--accent-2-rgb', theme.accent2Rgb);

    // ---- Compatibility aliases (كود قديم بيستخدم --primary) ----
    setVar('--primary', theme.accent);
    setVar('--primary-rgb', theme.accentRgb);
    setVar('--secondary', theme.accent2);
    setVar('--secondary-rgb', theme.accent2Rgb);

    // ---- Backgrounds ----
    setVar('--bg', theme.bg);
    setVar('--bg-2', theme.bg2);
    setVar('--bg-3', theme.bg3);
    setVar('--card-bg', theme.cardBg);
    setVar('--card-bg-solid', theme.cardBgSolid);

    // ---- Text ----
    setVar('--text', theme.text);
    setVar('--text-muted', theme.textMuted);
    setVar('--text-dim', theme.textDim);

    // ---- Borders ----
    setVar('--border', theme.border);
    setVar('--border-soft', theme.borderSoft);
    setVar('--border-strong', theme.borderStrong);

    // ---- Status colors ----
    setVar('--success', theme.success);
    setVar('--success-rgb', theme.successRgb);
    setVar('--danger', theme.danger);
    setVar('--danger-rgb', theme.dangerRgb);
    setVar('--warning', theme.warning);
    setVar('--warning-rgb', theme.warningRgb);
    setVar('--info', theme.info);
    setVar('--info-rgb', theme.infoRgb);

    // ---- Glows ----
    setVar('--glow-accent', '0 0 20px rgba(' + theme.accentRgb + ', 0.3)');
    setVar('--glow-accent-strong', '0 0 40px rgba(' + theme.accentRgb + ', 0.5)');
    setVar('--glow-accent-2', '0 0 20px rgba(' + theme.accent2Rgb + ', 0.3)');

    // ---- Gradient ----
    setVar('--gradient-accent',
      'linear-gradient(135deg, ' + theme.accent + ' 0%, ' + theme.accent2 + ' 100%)');

    // ---- Theme-color meta (mobile browser bar) ----
    try {
      var meta = document.querySelector('meta[name="theme-color"]');
      if (!meta) {
        meta = document.createElement('meta');
        meta.setAttribute('name', 'theme-color');
        document.head.appendChild(meta);
      }
      meta.setAttribute('content', theme.bg);
    } catch (e) {}

    // ---- Body background احتياطي (لو CSS لسه ما حملش) ----
    try {
      if (document.body) {
        document.body.style.backgroundColor = theme.bg;
        document.body.style.color = theme.text;
      }
    } catch (e) {}

    // ---- Set state ----
    state.currentId = theme.id;
    state.current = theme;
  }

  // =============================================================
  // Read — localStorage / DB / default
  // =============================================================

  function readFromLocalStorage() {
    try {
      var id = window.localStorage.getItem(STORAGE_KEY);
      if (id && window.ITWS_THEMES[id]) {
        return id;
      }
    } catch (e) {}
    return null;
  }

  function readSystemMode() {
    try {
      return window.localStorage.getItem(SYSTEM_KEY) === '1';
    } catch (e) {}
    return false;
  }

  function writeSystemMode(on) {
    try {
      if (on) {
        window.localStorage.setItem(SYSTEM_KEY, '1');
      } else {
        window.localStorage.removeItem(SYSTEM_KEY);
      }
    } catch (e) {}
  }

  function readFromDb() {
    try {
      // نحاول من AppSettings (لو محمّل)
      if (window.AppSettings && typeof window.AppSettings.get === 'function') {
        var dbId = window.AppSettings.get('theme.default_theme');
        if (dbId && window.ITWS_THEMES[dbId]) {
          return dbId;
        }
        var allow = window.AppSettings.get('theme.allow_user_override');
        if (allow === false) {
          state.allowOverride = false;
        }
      }
    } catch (e) {}

    // fallback من settings-defaults
    try {
      if (window.ITWS_SETTINGS_DEFAULTS && window.ITWS_SETTINGS_DEFAULTS.theme) {
        var def = window.ITWS_SETTINGS_DEFAULTS.theme.default_theme;
        if (def && window.ITWS_THEMES[def]) {
          return def;
        }
      }
    } catch (e) {}

    return null;
  }

  function readFromSystemPreference() {
    try {
      if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
        // بحث عن أول ثيم dark في الـ core
        var core = window.ThemesData.byCategory('core');
        for (var i = 0; i < core.length; i++) {
          if (core[i].type === 'dark') { return core[i].id; }
        }
      } else {
        var core2 = window.ThemesData.byCategory('core');
        for (var j = 0; j < core2.length; j++) {
          if (core2[j].type === 'light') { return core2[j].id; }
        }
      }
    } catch (e) {}
    return null;
  }

  // =============================================================
  // Resolve — يحدد أي theme يطبق
  // =============================================================

  function resolveThemeId() {
    // 1. system mode (لو مفعل ومفيش override)
    if (state.systemMode && state.allowOverride !== false) {
      var sysId = readFromSystemPreference();
      if (sysId) {
        state.source = 'system';
        return sysId;
      }
    }

    // 2. localStorage (override الزائر)
    if (state.allowOverride !== false) {
      var localId = readFromLocalStorage();
      if (localId) {
        state.source = 'localStorage';
        return localId;
      }
    }

    // 3. DB default
    var dbId = readFromDb();
    if (dbId) {
      state.source = 'db';
      return dbId;
    }

    // 4. themes-data default
    var defaultTheme = window.ThemesData.getDefault();
    if (defaultTheme) {
      state.source = 'default';
      return defaultTheme.id;
    }

    // 5. hard fallback
    state.source = 'fallback';
    return FALLBACK_ID;
  }

  // =============================================================
  // Change Theme — public API
  // =============================================================

  function change(themeId, opts) {
    var options = opts || {};

    if (!themeId || !window.ITWS_THEMES[themeId]) {
      return false;
    }

    var theme = window.ITWS_THEMES[themeId];

    // apply
    applyTheme(theme);

    // save to localStorage (لو override مسموح)
    if (state.allowOverride !== false && options.persist !== false) {
      try {
        window.localStorage.setItem(STORAGE_KEY, themeId);
      } catch (e) {}
    }

    // update state
    state.currentId = themeId;
    state.current = theme;
    state.source = 'manual';

    // notify listeners
    notifyListeners(theme, state.source);

    return true;
  }

  // =============================================================
  // Reset — يرجع للافتراضي
  // =============================================================

  function reset() {
    // امسح localStorage
    try {
      window.localStorage.removeItem(STORAGE_KEY);
      window.localStorage.removeItem(SYSTEM_KEY);
    } catch (e) {}

    state.systemMode = false;

    // re-resolve
    var id = resolveThemeId();
    var theme = window.ITWS_THEMES[id] || window.ITWS_THEMES[FALLBACK_ID];

    if (theme) {
      applyTheme(theme);
      notifyListeners(theme, 'reset');
    }

    return theme;
  }

  // =============================================================
  // Next / Previous / Cycle
  // =============================================================

  function getAllIds() {
    return window.ThemesData.getIds();
  }

  function next() {
    var ids = getAllIds();
    var idx = ids.indexOf(state.currentId);
    var nextIdx = (idx + 1) % ids.length;
    return change(ids[nextIdx]);
  }

  function previous() {
    var ids = getAllIds();
    var idx = ids.indexOf(state.currentId);
    var prevIdx = (idx - 1 + ids.length) % ids.length;
    return change(ids[prevIdx]);
  }

  function cycle() {
    return next();
  }

  // =============================================================
  // System Mode — يتبع prefers-color-scheme
  // =============================================================

  function setSystemMode(enabled) {
    state.systemMode = !!enabled;

    // امسح override الثيم القديم
    try {
      if (enabled) {
        window.localStorage.removeItem(STORAGE_KEY);
      }
    } catch (e) {}

    writeSystemMode(!!enabled);

    var id = resolveThemeId();
    var theme = window.ITWS_THEMES[id];
    if (theme) {
      applyTheme(theme);
      notifyListeners(theme, 'system');
    }
  }

  // =============================================================
  // Getters
  // =============================================================

  function getCurrent() {
    return state.current;
  }

  function getCurrentId() {
    return state.currentId || FALLBACK_ID;
  }

  function isDark() {
    return state.current && state.current.type === 'dark';
  }

  function exists(id) {
    return !!window.ITWS_THEMES[id];
  }

  function getSource() {
    return state.source;
  }

  // =============================================================
  // Listeners
  // =============================================================

  function notifyListeners(theme, source) {
    for (var i = 0; i < state.listeners.length; i++) {
      try {
        state.listeners[i](theme, source);
      } catch (e) {}
    }
  }

  function onChange(cb) {
    if (typeof cb === 'function') {
      state.listeners.push(cb);
      // نادي فوراً بالحالة الحالية لو initialized
      if (state.initialized && state.current) {
        try { cb(state.current, state.source); } catch (e) {}
      }
    }
  }

  function offChange(cb) {
    for (var i = state.listeners.length - 1; i >= 0; i--) {
      if (state.listeners[i] === cb) {
        state.listeners.splice(i, 1);
      }
    }
  }

  // =============================================================
  // System Preference Watcher
  // =============================================================

  function watchSystemPreference() {
    try {
      if (!window.matchMedia) { return; }
      var mq = window.matchMedia('(prefers-color-scheme: dark)');
      var handler = function () {
        if (state.systemMode) {
          var id = readFromSystemPreference();
          if (id && id !== state.currentId) {
            var theme = window.ITWS_THEMES[id];
            if (theme) {
              applyTheme(theme);
              notifyListeners(theme, 'system');
            }
          }
        }
      };
      if (mq.addEventListener) {
        mq.addEventListener('change', handler);
      } else if (mq.addListener) {
        mq.addListener(handler);
      }
    } catch (e) {}
  }

  // =============================================================
  // Reduced Motion
  // =============================================================

  function applyReducedMotion() {
    try {
      if (!window.matchMedia) { return; }
      var mq = window.matchMedia('(prefers-reduced-motion: reduce)');
      var apply = function () {
        if (mq.matches) {
          setAttr('data-reduced-motion', 'true');
        } else {
          htmlEl().removeAttribute('data-reduced-motion');
        }
      };
      apply();
      if (mq.addEventListener) {
        mq.addEventListener('change', apply);
      } else if (mq.addListener) {
        mq.addListener(apply);
      }
    } catch (e) {}
  }

  // =============================================================
  // Cross-Tab Sync (storage event)
  // =============================================================

  function watchCrossTab() {
    try {
      window.addEventListener('storage', function (ev) {
        if (!ev) { return; }
        if (ev.key === STORAGE_KEY) {
          if (state.allowOverride === false) { return; }
          var id = ev.newValue;
          if (id && window.ITWS_THEMES[id] && id !== state.currentId) {
            var theme = window.ITWS_THEMES[id];
            applyTheme(theme);
            notifyListeners(theme, 'cross-tab');
          } else if (!id) {
            // اتمسح → نرجع للافتراضي
            var defaultId = resolveThemeId();
            var def = window.ITWS_THEMES[defaultId];
            if (def) {
              applyTheme(def);
              notifyListeners(def, 'cross-tab');
            }
          }
        }
        if (ev.key === SYSTEM_KEY) {
          state.systemMode = ev.newValue === '1';
          if (state.systemMode) {
            var sysId = readFromSystemPreference();
            if (sysId) {
              var t = window.ITWS_THEMES[sysId];
              if (t) {
                applyTheme(t);
                notifyListeners(t, 'cross-tab-system');
              }
            }
          }
        }
      });
    } catch (e) {}
  }

  // =============================================================
  // Realtime — يستمع لتغيير default_theme من الأدمن
  // =============================================================

  function watchRealtime() {
    try {
      if (!window.Realtime || typeof window.Realtime.subscribe !== 'function') {
        return;
      }
      window.Realtime.subscribe('settings', function (payload) {
        // لو مفيش override محلي، نطبق الجديد
        if (state.allowOverride === false) { return; }
        var localId = readFromLocalStorage();
        if (localId) { return; } // عنده override

        var newDefault = null;
        try {
          if (payload && payload.new && payload.new.key === 'theme') {
            if (payload.new.value && payload.new.value.default_theme) {
              newDefault = payload.new.value.default_theme;
            }
          }
        } catch (e) {}

        if (newDefault && window.ITWS_THEMES[newDefault] && newDefault !== state.currentId) {
          var t = window.ITWS_THEMES[newDefault];
          applyTheme(t);
          notifyListeners(t, 'realtime-default');
        }
      }, { debounce: 500 });
    } catch (e) {}
  }

  // =============================================================
  // Init — يشتغل فوراً في <head> (FOUC prevention)
  // =============================================================

  function init() {
    if (state.initialized) { return; }

    // اقرأ systemMode flag
    state.systemMode = readSystemMode();

    // اقرأ allowOverride من DB (لو متاح)
    readFromDb();

    // resolve + apply
    var id = resolveThemeId();
    var theme = window.ITWS_THEMES[id];

    if (!theme) {
      theme = window.ITWS_THEMES[FALLBACK_ID];
      state.source = 'fallback';
    }

    if (theme) {
      applyTheme(theme);
    }

    // apply reduced motion
    applyReducedMotion();

    // watchers
    watchSystemPreference();
    watchCrossTab();
    watchRealtime();

    state.initialized = true;

    if (window.__itwsDebug) {
      window.__itwsDebug('Theme initialized:', {
        id: state.currentId,
        source: state.source,
        allowOverride: state.allowOverride,
        systemMode: state.systemMode
      });
    }
  }

  // =============================================================
  // Run init IMMEDIATELY (before CSS, before DOMContentLoaded)
  // =============================================================

  init();

  // =============================================================
  // Re-init when AppSettings loads (bعدين DB becomes available)
  // =============================================================

  function reapplyFromDbIfNeeded() {
    // لو الزائر عنده override، منلمسش
    if (state.allowOverride === false) { return; }
    var localId = readFromLocalStorage();
    if (localId) { return; }
    if (state.systemMode) { return; }

    var dbId = readFromDb();
    if (dbId && dbId !== state.currentId) {
      var t = window.ITWS_THEMES[dbId];
      if (t) {
        applyTheme(t);
        notifyListeners(t, 'db-late');
      }
    }
  }

  // استنى DOMContentLoaded عشان AppSettings يبقى متاح
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function () {
      setTimeout(reapplyFromDbIfNeeded, 50);
    });
  } else {
    setTimeout(reapplyFromDbIfNeeded, 50);
  }

  // =============================================================
  // Public API Export
  // =============================================================

  window.ThemeManager = {
    // Actions
    change:         change,
    reset:          reset,
    next:           next,
    previous:       previous,
    cycle:          cycle,
    setSystemMode:  setSystemMode,
    reapply:        reapplyFromDbIfNeeded,

    // Getters
    getCurrent:     getCurrent,
    getCurrentId:   getCurrentId,
    getAll:         function () { return window.ThemesData.all(); },
    getByCategory:  function (cat) { return window.ThemesData.byCategory(cat); },
    getSource:      getSource,
    isDark:         isDark,
    exists:         exists,
    isSystemMode:   function () { return state.systemMode; },
    allowsOverride: function () { return state.allowOverride !== false; },

    // Listeners
    onChange:       onChange,
    offChange:      offChange,

    // Meta
    storageKey:     STORAGE_KEY,
    fallbackId:     FALLBACK_ID,
    version:        '4.0.0'
  };

  // Aliases للتوافق
  window.Theme = window.ThemeManager;
  window.themeManager = window.ThemeManager;

})();
