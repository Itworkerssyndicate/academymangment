/* ============================================================
   ITWS Platform — Theme Manager V3
   File: assets/js/theme.js
   ============================================================ */

(function () {
  'use strict';

  if (window.ITWSTheme && window.ITWSTheme._initialized) return;

  var STORAGE_KEY = 'itws_theme';
  var DEFAULT_ID = 'neon-dark';

  /* ============================================================
     HELPERS
     ============================================================ */

  function getStoredTheme() {
    try { return localStorage.getItem(STORAGE_KEY); } catch (e) { return null; }
  }

  function setStoredTheme(id) {
    try { localStorage.setItem(STORAGE_KEY, id); } catch (e) {}
  }

  function clearStoredTheme() {
    try { localStorage.removeItem(STORAGE_KEY); } catch (e) {}
  }

  function isValid(id) {
    return window.ITWS_THEMES_MAP && !!window.ITWS_THEMES_MAP[id];
  }

  function getDefaultFromSettings() {
    try {
      if (window.AppSettings && typeof window.AppSettings.get === 'function') {
        var v = window.AppSettings.get('theme.default_theme');
        if (v && isValid(v)) return v;
      }
    } catch (e) {}
    return DEFAULT_ID;
  }

  function syncMetaThemeColor(theme) {
    try {
      var meta = document.querySelector('meta[name="theme-color"]');
      if (meta && theme.bg) meta.setAttribute('content', theme.bg);
    } catch (e) {}

    try {
      var cs = document.querySelector('meta[name="color-scheme"]');
      if (cs) cs.setAttribute('content', theme.is_dark ? 'dark' : 'light');
    } catch (e) {}
  }

  function dispatchThemeEvent(themeId, theme) {
    try {
      window.dispatchEvent(new CustomEvent('itws:theme-changed', {
        detail: { themeId: themeId, theme: theme }
      }));
    } catch (e) {}
  }

  /* ============================================================
     STATE
     ============================================================ */

  var state = {
    currentId: null,
    isUserOverride: false,
    listeners: [],
    settingsUnsub: null
  };

  /* ============================================================
     APPLY THEME
     ============================================================ */

  function applyTheme(themeId, options) {
    options = options || {};
    if (!isValid(themeId)) themeId = DEFAULT_ID;

    var theme = window.ITWS_THEMES_MAP[themeId];
    var html = document.documentElement;

    html.setAttribute('data-theme', themeId);
    html.setAttribute('data-theme-mode', theme.is_dark ? 'dark' : 'light');

    syncMetaThemeColor(theme);

    state.currentId = themeId;

    if (options.persist) {
      state.isUserOverride = true;
      setStoredTheme(themeId);
    }

    dispatchThemeEvent(themeId, theme);

    var listeners = state.listeners.slice();
    for (var i = 0; i < listeners.length; i++) {
      try { listeners[i](themeId, theme); } catch (e) {}
    }

    try {
      console.log('%c[Theme]', 'color: #00f0ff; font-weight: bold;', 'Applied:', themeId);
    } catch (e) {}

    return true;
  }

  /* ============================================================
     PUBLIC API
     ============================================================ */

  function change(themeId, options) {
    options = options || {};
    options.persist = options.persist !== false;
    return applyTheme(themeId, options);
  }

  function reset() {
    clearStoredTheme();
    state.isUserOverride = false;
    var defaultId = getDefaultFromSettings();
    return applyTheme(defaultId, { persist: false });
  }

  function getCurrent() { return state.currentId; }
  function getDefault() { return getDefaultFromSettings(); }
  function isUserOverride() { return state.isUserOverride; }
  function getAll() { return (window.ITWS_THEMES || []).slice(); }
  function getTheme(id) { return window.ITWS_THEMES_MAP ? window.ITWS_THEMES_MAP[id] : null; }

  function onChange(cb) {
    if (typeof cb !== 'function') return function () {};
    state.listeners.push(cb);
    return function () {
      var idx = state.listeners.indexOf(cb);
      if (idx !== -1) state.listeners.splice(idx, 1);
    };
  }

  function isDark(id) {
    var t = getTheme(id || state.currentId);
    return t ? t.is_dark === true : true;
  }

  /* ============================================================
     SETTINGS SYNC
     ============================================================ */

  function setupSettingsSync() {
    if (!window.AppSettings || typeof window.AppSettings.onChange !== 'function') return;

    if (state.settingsUnsub) { try { state.settingsUnsub(); } catch (e) {} }
    state.settingsUnsub = window.AppSettings.onChange(function (s, key) {
      if (key === 'theme' || key === null) {
        if (state.isUserOverride) return;
        var newDefault = getDefaultFromSettings();
        if (newDefault !== state.currentId) {
          applyTheme(newDefault, { persist: false });
        }
      }
    });
  }

  /* ============================================================
     INITIAL RESOLUTION
     ============================================================ */

  function resolveInitialTheme() {
    var stored = getStoredTheme();
    if (stored && isValid(stored)) {
      state.isUserOverride = true;
      return stored;
    }

    var settingsDefault = getDefaultFromSettings();
    if (isValid(settingsDefault)) return settingsDefault;

    return DEFAULT_ID;
  }

  /* ============================================================
     EXPORT
     ============================================================ */

  window.ITWSTheme = {
    _initialized: true,
    change: change,
    reset: reset,
    getCurrent: getCurrent,
    getDefault: getDefault,
    isUserOverride: isUserOverride,
    getAll: getAll,
    getTheme: getTheme,
    isDark: isDark,
    onChange: onChange
  };

  window.theme = window.ITWSTheme;
  window.changeTheme = function (id) { return change(id); };

  /* ============================================================
     BOOTSTRAP
     ============================================================ */

  var initialId = resolveInitialTheme();
  applyTheme(initialId, { persist: false });

  if (window.AppSettings && typeof window.AppSettings.onChange === 'function') {
    setupSettingsSync();
  } else {
    window.addEventListener('itws:settings-loaded', setupSettingsSync, { once: true });
  }

  try {
    console.log('%c[Theme]', 'color: #00f0ff; font-weight: bold;',
      'Ready — ' + getAll().length + ' themes | Initial:', initialId);
  } catch (e) {}

})();
