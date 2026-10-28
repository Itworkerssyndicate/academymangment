/* ============================================================
   ITWS Platform — Configuration V2
   File: assets/js/config.js
   ============================================================ */

(function () {
  'use strict';

  if (window.ITWS_CONFIG) return;

  /* ============================================================
     ⚠️⚠️⚠️  استبدل القيمتين دول بقيم مشروعك من Supabase  ⚠️⚠️⚠️
     
     طريقة الحصول عليهم:
     1. افتح https://supabase.com/dashboard
     2. اختار مشروعك
     3. Settings (⚙️) → API
     4. كوبي Project URL و anon public key
     ============================================================ */

  var SUPABASE_URL = 'https://YOUR_PROJECT_REF.supabase.co';
  var SUPABASE_ANON_KEY = 'YOUR_ANON_KEY_HERE';

  /* ============================================================
     ⛔ متعدلش تحت السطر ده إلا لو عارف بتعمل إيه
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
    STORAGE_KEYS: {
      AUTH: 'itws_auth',
      THEME: 'itws_theme',
      SAVED_EMAIL: 'itws_saved_email',
      SETTINGS_CACHE: 'itws_settings_cache',
      LABELS_CACHE: 'itws_labels_cache',
      THEMES_CACHE: 'itws_themes_cache'
    },
    HOSTNAME: window.location.hostname,
    PROTOCOL: window.location.protocol
  };

  window.resolveUrl = resolveUrl;
  window.getBase = getBase;

  function validateConfig() {
    var errors = [];
    if (!SUPABASE_URL || SUPABASE_URL.indexOf('YOUR_PROJECT_REF') !== -1) {
      errors.push('SUPABASE_URL not configured in config.js');
    }
    if (!SUPABASE_ANON_KEY || SUPABASE_ANON_KEY.indexOf('YOUR_ANON_KEY') !== -1) {
      errors.push('SUPABASE_ANON_KEY not configured in config.js');
    }
    if (errors.length > 0) {
      console.error('[ITWS Config] Validation errors:');
      errors.forEach(function (e) { console.error('  - ' + e); });
    }
    return errors.length === 0;
  }

  try { validateConfig(); } catch (e) {}

  if (DEBUG) {
    try {
      console.log('%c[ITWS Config]', 'color: #D4A843; font-weight: bold;', {
        ENV: env, BASE_PATH: window.ITWS_CONFIG.BASE_PATH, DEBUG: DEBUG
      });
    } catch (e) {}
  }

})();
