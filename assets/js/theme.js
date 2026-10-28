/* ============================================================
   ITWS Platform — Theme Manager V2
   File: assets/js/theme.js
   Description: Apply themes with FOUC prevention + localStorage
                + system detection + realtime sync

   Load order: In <head> BEFORE any CSS, AFTER themes-data.js
   ⚠️ CRITICAL: Must run synchronously — cannot wait for DOMContentLoaded

   Features:
   - Applies theme immediately (before CSS paints)
   - FOUC prevention
   - Reads user override from localStorage
   - Falls back to AppSettings default
   - Falls back to ITWS_DEFAULT_THEME
   - System theme (prefers-color-scheme) with live updates
   - Realtime sync from settings changes
   - Public API: change, reset, getCurrent, getDefault, isUserOverride
   - Events: itws:theme-changed, itws:theme-mode-changed
   - Applies to <html> via data-theme + data-theme-mode

   Rules:
   - No emoji
   - ES5-style IIFE
   - Synchronous on load (FOUC prevention)
   - No external dependencies
   ============================================================ */

(function () {
  'use strict';

  if (window.ITWSTheme && window.ITWSTheme._initialized) {
    return;
  }

  /* ============================================================
     1. DEPENDENCIES CHECK
     ============================================================ */

  var H = window.ITWS_THEMES_HELPERS;

  if (!H || !window.ITWS_THEMES_MAP) {
    // themes-data.js not loaded — fail silently, will retry
    try {
      console.error('[ITWS Theme] themes-data.js must be loaded before theme.js');
    } catch (e) {}
    return;
  }

  /* ============================================================
     2. HELPERS
     ============================================================ */

  function log(level, msg, data) {
    var cfg = window.ITWS_CONFIG || {};
    if (level === 'error' || (cfg.DEBUG && level === 'debug')) {
      try {
        var args = ['[ITWS Theme]', msg];
        if (data !== undefined) args.push(data);
        if (level === 'error') console.error.apply(console, args);
        else console.log.apply(console, args);
      } catch (e) {}
    }
  }

  function getConfig() {
    return window.ITWS_CONFIG || {};
  }

  function getStorageKey() {
    var cfg = getConfig();
    if (cfg.STORAGE_KEYS && cfg.STORAGE_KEYS.THEME) {
      return cfg.STORAGE_KEYS.THEME;
    }
    return 'itws_theme';
  }

  function safeStorageGet(key) {
    try { return localStorage.getItem(key); } catch (e) { return null; }
  }

  function safeStorageSet(key, value) {
    try { localStorage.setItem(key, value); return true; }
    catch (e) { return false; }
  }

  function safeStorageRemove(key) {
    try { localStorage.removeItem(key); return true; } catch (e) { return false; }
  }

  function dispatchEvent(name, detail) {
    try {
      window.dispatchEvent(new CustomEvent(name, { detail: detail || {} }));
    } catch (e) {}
  }

  function getHtmlElement() {
    return document.documentElement || document.getElementsByTagName('html')[0];
  }

  /* ============================================================
     3. STATE
     ============================================================ */

  var state = {
    currentId: null,         // active theme ID (user override or default)
    defaultId: null,         // system default from settings
    isUserOverride: false,   // user picked explicitly
    resolvedId: null,        // actual theme applied (system resolved)
    isDark: true,
    isSystemTheme: false,
    listeners: [],
    modeListeners: [],
    initialized: false,
    systemThemeUnsubscribe: null,
    settingsUnsubscribe: null,
    settingsApplied: false
  };

  /* ============================================================
     4. INJECT STYLE TAG (for dynamic CSS vars)
     ============================================================ */

  var styleElementId = 'itws-theme-vars';

  function getOrCreateStyleElement() {
    var el = document.getElementById(styleElementId);
    if (el) return el;

    el = document.createElement('style');
    el.id = styleElementId;
    el.setAttribute('data-generated', 'true');

    // Insert at very top of head — before any linked CSS
    var head = document.head || document.getElementsByTagName('head')[0];
    if (head) {
      head.insertBefore(el, head.firstChild);
    } else {
      document.documentElement.appendChild(el);
    }
    return el;
  }

  /* ============================================================
     5. APPLY THEME — CORE
     ============================================================ */

  function buildCssVarsBlock(theme, scopeSelector) {
    if (!theme || !theme.colors) return '';

    var lines = [];
    Object.keys(theme.colors).forEach(function (key) {
      var val = theme.colors[key];
      if (val === null || val === undefined) return;
      lines.push('  ' + key + ': ' + val + ';');
    });

    if (lines.length === 0) return '';

    return scopeSelector + ' {\n' + lines.join('\n') + '\n}\n';
  }

  function applyTheme(themeId, options) {
    options = options || {};

    var theme = H.getTheme(themeId);
    if (!theme) {
      log('error', 'Theme not found: ' + themeId);
      return false;
    }

    var html = getHtmlElement();
    if (!html) return false;

    // Determine if this is the system theme
    var isSystem = theme.is_system === true;
    var resolvedTheme = isSystem ? theme.resolved_theme : theme;
    var resolvedId = isSystem ? theme.resolved_id : themeId;

    if (!resolvedTheme) {
      log('error', 'Could not resolve theme: ' + themeId);
      return false;
    }

    // Apply data-theme (what user chose) + data-theme-mode (dark/light)
    var mode = resolvedTheme.is_dark === true ? 'dark' : 'light';
    html.setAttribute('data-theme', themeId);
    html.setAttribute('data-theme-mode', mode);
    html.setAttribute('data-theme-resolved', resolvedId);

    // Inject CSS vars
    var styleEl = getOrCreateStyleElement();
    var cssText = ':root,\n[data-theme="' + resolvedId + '"]';
    var block = buildCssVarsBlock(resolvedTheme, cssText);
    styleEl.textContent = block;

    // Update state
    var previousResolvedId = state.resolvedId;
    var previousIsDark = state.isDark;
    var previousCurrentId = state.currentId;

    state.currentId = themeId;
    state.resolvedId = resolvedId;
    state.isDark = resolvedTheme.is_dark === true;
    state.isSystemTheme = isSystem;

    // Update color-scheme meta
    try {
      var metaColorScheme = document.querySelector('meta[name="color-scheme"]');
      if (!metaColorScheme) {
        metaColorScheme = document.createElement('meta');
        metaColorScheme.setAttribute('name', 'color-scheme');
        document.head.appendChild(metaColorScheme);
      }
      metaColorScheme.setAttribute('content', mode);
    } catch (e) {}

    // Update theme-color meta (for mobile browsers)
    try {
      var metaThemeColor = document.querySelector('meta[name="theme-color"]');
      if (metaThemeColor && resolvedTheme.colors && resolvedTheme.colors['--bg']) {
        metaThemeColor.setAttribute('content', resolvedTheme.colors['--bg']);
      }
    } catch (e) {}

    // Dispatch events
    if (previousCurrentId !== themeId || previousResolvedId !== resolvedId) {
      dispatchEvent('itws:theme-changed', {
        themeId: themeId,
        resolvedId: resolvedId,
        isSystem: isSystem,
        isDark: state.isDark,
        isUserOverride: state.isUserOverride
      });
      notifyListeners(themeId, resolvedId, state.isDark, isSystem);
    }

    if (previousIsDark !== state.isDark) {
      dispatchEvent('itws:theme-mode-changed', {
        isDark: state.isDark,
        mode: mode
      });
      notifyModeListeners(state.isDark);
    }

    if (options.persist) {
      safeStorageSet(getStorageKey(), themeId);
      state.isUserOverride = true;
    }

    log('debug', 'Applied theme', {
      themeId: themeId,
      resolvedId: resolvedId,
      isDark: state.isDark,
      isSystem: isSystem,
      persisted: !!options.persist
    });

    return true;
  }

  /* ============================================================
     6. LISTENERS
     ============================================================ */

  function notifyListeners(themeId, resolvedId, isDark, isSystem) {
    var payload = {
      themeId: themeId,
      resolvedId: resolvedId,
      isDark: isDark,
      isSystem: isSystem,
      isUserOverride: state.isUserOverride
    };
    state.listeners.slice().forEach(function (fn) {
      try { fn(payload); } catch (e) { log('error', 'Listener error', e); }
    });
  }

  function notifyModeListeners(isDark) {
    state.modeListeners.slice().forEach(function (fn) {
      try { fn(isDark); } catch (e) { log('error', 'Mode listener error', e); }
    });
  }

  /* ============================================================
     7. SYSTEM THEME (prefers-color-scheme)
     ============================================================ */

  function setupSystemThemeListener() {
    if (state.systemThemeUnsubscribe) {
      try { state.systemThemeUnsubscribe(); } catch (e) {}
      state.systemThemeUnsubscribe = null;
    }

    state.systemThemeUnsubscribe = H.onSystemThemeChange(function (isDark) {
      // Only re-apply if user is currently on system theme
      if (state.isSystemTheme) {
        log('debug', 'System theme changed, re-applying', { isDark: isDark });
        applyTheme('system', { persist: false });
      }
    });
  }

  /* ============================================================
     8. SETTINGS SYNC (default theme from admin)
     ============================================================ */

  function getDefaultFromSettings() {
    var settingsDefault = null;

    try {
      if (window.AppSettings && typeof window.AppSettings.get === 'function') {
        settingsDefault = window.AppSettings.get('theme.default_theme');
      }
    } catch (e) {}

    if (settingsDefault && H.isValidTheme(settingsDefault)) {
      return settingsDefault;
    }

    return H.getDefaultId();
  }

  function getAllowUserOverride() {
    try {
      if (window.AppSettings && typeof window.AppSettings.get === 'function') {
        var v = window.AppSettings.get('theme.allow_user_override');
        return v !== false;
      }
    } catch (e) {}
    return true;
  }

  function checkSettingsSync() {
    var newDefaultId = getDefaultFromSettings();

    if (!state.defaultId) {
      state.defaultId = newDefaultId;
      return;
    }

    if (newDefaultId !== state.defaultId) {
      var previousDefault = state.defaultId;
      state.defaultId = newDefaultId;

      log('debug', 'Default theme changed', { from: previousDefault, to: newDefaultId });

      // If user has NO override → follow the new default
      if (!state.isUserOverride) {
        applyTheme(newDefaultId, { persist: false });
      }

      // If user override is now disabled → force default
      if (!getAllowUserOverride() && state.isUserOverride) {
        safeStorageRemove(getStorageKey());
        state.isUserOverride = false;
        applyTheme(newDefaultId, { persist: false });
      }
    }
  }

  function setupSettingsListener() {
    if (state.settingsUnsubscribe) {
      try { state.settingsUnsubscribe(); } catch (e) {}
      state.settingsUnsubscribe = null;
    }

    try {
      if (window.AppSettings && typeof window.AppSettings.onChange === 'function') {
        state.settingsUnsubscribe = window.AppSettings.onChange(function (settings, changedKey) {
          if (changedKey === 'theme' || changedKey === null) {
            checkSettingsSync();
          }
        });
      }
    } catch (e) {
      log('error', 'Settings listener failed', e);
    }

    // Also listen to global event
    window.addEventListener('itws:settings-changed', function (e) {
      var key = e && e.detail ? e.detail.key : null;
      if (key === 'theme' || key === null || key === undefined) {
        checkSettingsSync();
      }
    });
  }

  /* ============================================================
     9. INITIAL THEME RESOLUTION
     ============================================================ */

  function resolveInitialTheme() {
    // Priority 1: User override from localStorage
    var stored = safeStorageGet(getStorageKey());
    if (stored && H.isValidTheme(stored)) {
      state.isUserOverride = true;
      return stored;
    }

    // Priority 2: Default from settings
    var settingsDefault = null;
    try {
      if (window.AppSettings && typeof window.AppSettings.get === 'function') {
        settingsDefault = window.AppSettings.get('theme.default_theme');
      }
    } catch (e) {}

    if (settingsDefault && H.isValidTheme(settingsDefault)) {
      state.defaultId = settingsDefault;
      return settingsDefault;
    }

    // Priority 3: ITWS_DEFAULT_THEME (from themes-data.js)
    state.defaultId = H.getDefaultId();
    return state.defaultId;
  }

  /* ============================================================
     10. PUBLIC API
     ============================================================ */

  function change(themeId, options) {
    options = options || {};
    options.persist = options.persist !== false; // default true

    if (!H.isValidTheme(themeId)) {
      log('error', 'Invalid theme: ' + themeId);
      return false;
    }

    // If user override disabled — deny changes (except system)
    if (!getAllowUserOverride() && !state.isSystemTheme) {
      log('debug', 'User override disabled by settings');
      return false;
    }

    if (options.persist) {
      state.isUserOverride = true;
    }

    return applyTheme(themeId, options);
  }

  function reset() {
    safeStorageRemove(getStorageKey());
    state.isUserOverride = false;

    var defaultId = getDefaultFromSettings();
    return applyTheme(defaultId, { persist: false });
  }

  function getCurrent() {
    return state.currentId;
  }

  function getResolved() {
    return state.resolvedId;
  }

  function getDefault() {
    return state.defaultId || getDefaultFromSettings();
  }

  function isUserOverride() {
    return state.isUserOverride === true;
  }

  function isDark() {
    return state.isDark === true;
  }

  function isSystem() {
    return state.isSystemTheme === true;
  }

  function onChange(callback) {
    if (typeof callback !== 'function') return function () {};
    state.listeners.push(callback);
    return function unsubscribe() {
      var idx = state.listeners.indexOf(callback);
      if (idx !== -1) state.listeners.splice(idx, 1);
    };
  }

  function onModeChange(callback) {
    if (typeof callback !== 'function') return function () {};
    state.modeListeners.push(callback);
    return function unsubscribe() {
      var idx = state.modeListeners.indexOf(callback);
      if (idx !== -1) state.modeListeners.splice(idx, 1);
    };
  }

  function getState() {
    return {
      currentId: state.currentId,
      resolvedId: state.resolvedId,
      defaultId: state.defaultId,
      isUserOverride: state.isUserOverride,
      isDark: state.isDark,
      isSystem: state.isSystemTheme
    };
  }

  function clearOverride() {
    return reset();
  }

  /* ============================================================
     11. EXPORT
     ============================================================ */

  window.ITWSTheme = {
    _initialized: true,
    change: change,
    reset: reset,
    applyDefault: reset,
    clearOverride: clearOverride,
    getCurrent: getCurrent,
    getResolved: getResolved,
    getDefault: getDefault,
    isUserOverride: isUserOverride,
    isDark: isDark,
    isSystem: isSystem,
    onChange: onChange,
    onModeChange: onModeChange,
    getState: getState
  };

  // Legacy / shorthand aliases
  if (!window.theme) {
    window.theme = window.ITWSTheme;
  }
  if (!window.changeTheme) {
    window.changeTheme = function (id) { return change(id); };
  }

  /* ============================================================
     12. BOOTSTRAP — RUN SYNCHRONOUSLY NOW
     ⚠️ This is the critical part for FOUC prevention
     ============================================================ */

  function bootstrap() {
    state.initialized = true;

    // Resolve and apply initial theme immediately
    var initialId = resolveInitialTheme();
    applyTheme(initialId, { persist: false });

    // Setup system listener
    setupSystemThemeListener();

    log('debug', 'Bootstrap complete', {
      initialId: initialId,
      isUserOverride: state.isUserOverride,
      isDark: state.isDark
    });
  }

  // Run NOW (synchronously in <head>)
  bootstrap();

  /* ============================================================
     13. DEFERRED SETTINGS SYNC
     ⚠️ AppSettings not ready yet — attach listener after ready
     ============================================================ */

  function deferredSetup() {
    setupSettingsListener();
    checkSettingsSync();
  }

  // If AppSettings is already loaded
  if (window.AppSettings && typeof window.AppSettings.onChange === 'function') {
    deferredSetup();
  } else {
    // Wait for settings to be ready
    var waitForSettings = function () {
      if (window.AppSettings && typeof window.AppSettings.onChange === 'function') {
        deferredSetup();
        return true;
      }
      return false;
    };

    if (!waitForSettings()) {
      window.addEventListener('itws:settings-loaded', function () {
        deferredSetup();
      }, { once: true });

      // Timeout fallback — try again after 2s
      setTimeout(function () {
        if (!state.settingsApplied) {
          deferredSetup();
        }
      }, 2000);
    }
  }

  /* ============================================================
     14. CLEANUP
     ============================================================ */

  if (typeof window.addEventListener === 'function') {
    window.addEventListener('beforeunload', function () {
      if (state.systemThemeUnsubscribe) {
        try { state.systemThemeUnsubscribe(); } catch (e) {}
      }
      if (state.settingsUnsubscribe) {
        try { state.settingsUnsubscribe(); } catch (e) {}
      }
    });
  }

})();
