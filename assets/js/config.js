/* ============================================================
   ITWS Platform — Configuration V3 (Silent + ES5-safe)
   File: assets/js/config.js
   ============================================================ */

(function () {
  'use strict';

  if (window.ITWS_CONFIG) return;

  /* ============================================================
     ✅ Supabase Credentials (filled with your project)
     ============================================================ */

  var SUPABASE_URL = 'https://hfupkxbajpnaillsqayc.supabase.co';
  var SUPABASE_ANON_KEY = 'sb_publishable__9lVaIyTxYzyykQ_AY_u9w_On795zBK';

  /* ============================================================
     ⛔ لا تعدل تحت السطر ده
     ============================================================ */

  function detectEnvironment() {
    var hostname = window.location.hostname || '';
    var protocol = window.location.protocol || '';
    if (hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '') return 'development';
    if (protocol === 'file:') return 'local-file';
    if (hostname.indexOf('github.io') !== -1) return 'github-pages';
    return 'production';
  }

  function detectBasePath() {
    var path = window.location.pathname || '';
    if (path.indexOf('/academymangment/') === 0) return '/academymangment/';
    return '/';
  }

  function detectPageDepth() {
    var path = window.location.pathname || '';
    var base = detectBasePath();
    if (base && path.indexOf(base) === 0) path = path.substring(base.length);
    path = path.replace(/^\//, '');
    var parts = path.split('/').filter(function (p) { return p && p.length; });
    if (parts.length === 0) return 0;
    return Math.max(0, parts.length - 1);
  }

  function resolveUrl(path) {
    if (!path) return '';
    var str = String(path);
    if (str.indexOf('http://') === 0 || str.indexOf('https://') === 0 || str.indexOf('//') === 0) return str;
    if (str.charAt(0) === '/') return str;
    var base = detectBasePath();
    if (base === '/') return '/' + str.replace(/^\.?\//, '');
    return base + str.replace(/^\.?\//, '');
  }

  function getBase() {
    var base = detectBasePath();
    return base === '/' ? '/' : base;
  }

  var env = detectEnvironment();
  var DEBUG = (env === 'development' || env === 'local-file');
  try {
    var urlParams = new URLSearchParams(window.location.search);
    if (urlParams.get('debug') === '1') DEBUG = true;
    if (urlParams.get('debug') === '0') DEBUG = false;
  } catch (e) {}

  window.ITWS_CONFIG = {
    SUPABASE_URL: SUPABASE_URL,
    SUPABASE_ANON_KEY: SUPABASE_ANON_KEY,
    ENV: env,
    DEBUG: DEBUG,
    IS_DEV: env === 'development',
    IS_PROD: env === 'production' || env === 'github-pages',
    BASE_PATH: getBase(),
    PAGE_DEPTH: detectPageDepth(),
    APP_VERSION: '2.0.0',
    APP_NAME: 'ITWS Platform',
    RATE_LIMITS: {
      searchDebounceMs: 300,
      toastDurationMs: 4000,
      toastErrorDurationMs: 8000,
      realtimeDebounceMs: 300
    },
    STORAGE_KEYS: {
      AUTH: 'itws_auth',
      THEME: 'itws_theme',
      SAVED_EMAIL: 'itws_saved_email',
      SETTINGS_CACHE: 'itws_settings_cache',
      LABELS_CACHE: 'itws_labels_cache',
      THEMES_CACHE: 'itws_themes_cache',
      LAST_VISIT: 'itws_last_visit',
      PENDING_REDIRECT: 'itws_pending_redirect'
    },
    HOSTNAME: window.location.hostname,
    PROTOCOL: window.location.protocol
  };

  window.resolveUrl = resolveUrl;
  window.getBase = getBase;

  var isValid = true;
  if (!SUPABASE_URL || SUPABASE_URL.indexOf('YOUR_PROJECT_REF') !== -1) isValid = false;
  if (!SUPABASE_ANON_KEY || SUPABASE_ANON_KEY.indexOf('YOUR_ANON_KEY') !== -1) isValid = false;

  if (SUPABASE_ANON_KEY && SUPABASE_ANON_KEY.length > 0) {
    try {
      var parts = SUPABASE_ANON_KEY.split('.');
      if (parts.length >= 2) {
        var payload = JSON.parse(atob(parts[1]));
        if (payload && payload.role === 'service_role') isValid = false;
      }
    } catch (e) {}
  }

  window.ITWS_CONFIG_VALID = isValid;

  if (DEBUG) {
    try {
      console.log('%c[ITWS Config]', 'color: #D4A843; font-weight: bold;',
        'Env:', env, '| Valid:', isValid);
    } catch (e) {}
  }

})();
