/* ============================================================
   ITWS Platform — Configuration V2
   File: assets/js/config.js
   Description: Supabase credentials + BASE_PATH + helpers
   Load order: SECOND (after settings-defaults.js, before everything)
   
   ⚠️ SECURITY:
   - This file contains ANON_KEY ONLY (safe for client)
   - SERVICE_ROLE_KEY must NEVER be here
   - Service role key lives only in Edge Functions
   
   Rules:
   - No emoji
   - No absolute paths
   - ES5-style IIFE
   ============================================================ */

(function () {
  'use strict';

  if (window.ITWS_CONFIG) return;

  /* ============================================================
     1. SUPABASE CREDENTIALS
     ⚠️ Replace with YOUR project values
     ============================================================ */

  var SUPABASE_URL = 'https://YOUR_PROJECT_REF.supabase.co';
  var SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.YOUR_ANON_KEY_HERE';

  /* ============================================================
     2. ENVIRONMENT DETECTION
     ============================================================ */

  function detectEnvironment() {
    var hostname = window.location.hostname || '';
    var protocol = window.location.protocol || '';

    // localhost → development
    if (hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '') {
      return 'development';
    }

    // file:// protocol → local file test
    if (protocol === 'file:') {
      return 'local-file';
    }

    // GitHub Pages
    if (hostname.indexOf('github.io') !== -1) {
      return 'github-pages';
    }

    // Netlify / Vercel / custom domain
    return 'production';
  }

  /* ============================================================
     3. BASE_PATH DETECTION
     Needed for GitHub Pages subpath (/academymangment/)
     ============================================================ */

  function detectBasePath() {
    var path = window.location.pathname || '';

    // GitHub Pages subpath
    // Example: /academymangment/admin/index.html → base = /academymangment/
    if (path.indexOf('/academymangment/') === 0) {
      return '/academymangment/';
    }

    // If path ends with .html and has folders, try to infer
    // But for relative paths, we prefer returning '' (use current dir)
    
    // For localhost / custom domain — root
    return '/';
  }

  /* ============================================================
     4. ASSET PATH HELPERS
     ============================================================ */

  // Determine depth from current page
  function detectPageDepth() {
    var path = window.location.pathname || '';

    // Remove BASE_PATH first
    var base = detectBasePath();
    if (base && path.indexOf(base) === 0) {
      path = path.substring(base.length);
    }

    // Remove leading /
    path = path.replace(/^\//, '');

    // Split
    var parts = path.split('/').filter(function (p) { return p && p.length; });

    // Last part is the HTML file, rest are folders
    // admin/index.html → ['admin', 'index.html'] → depth = 1
    // admin/settings/index.html → ['admin', 'settings', 'index.html'] → depth = 2
    if (parts.length === 0) return 0;
    return Math.max(0, parts.length - 1);
  }

  /* ============================================================
     5. RESOLVE URL
     تحويل مسار نسبي إلى مسار مطلق صحيح
     
     Usage:
       resolveUrl('home.html')  → '/academymangment/home.html' (from admin/)
       resolveUrl('assets/js/x.js') → '/academymangment/assets/js/x.js'
     
     Or when from root:
       resolveUrl('home.html')  → '/academymangment/home.html'
     ============================================================ */

  function resolveUrl(path) {
    if (!path) return '';

    var str = String(path);

    // Already absolute
    if (str.indexOf('http://') === 0 || str.indexOf('https://') === 0 || str.indexOf('//') === 0) {
      return str;
    }

    // Absolute path (starts with /)
    if (str.charAt(0) === '/') {
      return str;
    }

    // From here — relative path
    var base = detectBasePath();
    var depth = detectPageDepth();

    // Build prefix from depth
    // depth 0 (root) → base + path
    // depth 1 (admin/) → base + path (still from base, since we resolve from base)
    // Actually — resolveUrl should ALWAYS resolve from the ROOT (BASE_PATH), not from current page
    // That's the whole point — it converts "home.html" (which means "root home.html") to full path
    
    // But wait — if called from admin/index.html and user passes "home.html",
    // do they mean "admin/home.html" or "root home.html"?
    // 
    // Convention: resolveUrl ALWAYS means "relative to ROOT" 
    // For "relative to current page", use direct relative paths like "./home.html"
    
    // So:
    if (base === '/') {
      return '/' + str.replace(/^\.?\//, '');
    }
    return base + str.replace(/^\.?\//, '');
  }

  /* ============================================================
     6. GET CURRENT BASE (for href/src in HTML)
     Returns '' or '/academymangment/' — WITH trailing slash
     ============================================================ */

  function getBase() {
    var base = detectBasePath();
    if (base === '/') return '/';
    return base;
  }

  /* ============================================================
     7. BUILD PAGE URL (for navigation)
     Usage: buildPageUrl('home.html') → 'home.html' (relative)
            buildPageUrl('home.html', true) → '/academymangment/home.html'
     ============================================================ */

  function buildPageUrl(page, absolute) {
    if (!page) return '';
    if (absolute) return resolveUrl(page);
    // relative — just return as-is
    return page;
  }

  /* ============================================================
     8. DEBUG MODE
     ============================================================ */

  var env = detectEnvironment();
  var DEBUG = (env === 'development' || env === 'local-file');

  // Manual override via URL: ?debug=1
  try {
    var urlParams = new URLSearchParams(window.location.search);
    if (urlParams.get('debug') === '1') DEBUG = true;
    if (urlParams.get('debug') === '0') DEBUG = false;
  } catch (e) {}

  /* ============================================================
     9. VERSION
     ============================================================ */

  var APP_VERSION = '2.0.0';
  var APP_NAME = 'ITWS Platform';

  /* ============================================================
     10. RATE LIMITS (client-side guidance)
     ============================================================ */

  var RATE_LIMITS = {
    searchDebounceMs: 300,
    toastDurationMs: 4000,
    toastErrorDurationMs: 8000,
    realtimeDebounceMs: 300
  };

  /* ============================================================
     11. STORAGE KEYS
     Centralized keys — عشان نتجنب typos
     ============================================================ */

  var STORAGE_KEYS = {
    AUTH: 'itws_auth',
    THEME: 'itws_theme',
    SAVED_EMAIL: 'itws_saved_email',
    SETTINGS_CACHE: 'itws_settings_cache',
    LABELS_CACHE: 'itws_labels_cache',
    THEMES_CACHE: 'itws_themes_cache',
    LAST_VISIT: 'itws_last_visit',
    PENDING_REDIRECT: 'itws_pending_redirect'
  };

  /* ============================================================
     12. PUBLIC API
     ============================================================ */

  window.ITWS_CONFIG = {
    // Supabase
    SUPABASE_URL: SUPABASE_URL,
    SUPABASE_ANON_KEY: SUPABASE_ANON_KEY,

    // Environment
    ENV: env,
    DEBUG: DEBUG,
    IS_DEV: env === 'development',
    IS_PROD: env === 'production' || env === 'github-pages',

    // Paths
    BASE_PATH: getBase(),
    PAGE_DEPTH: detectPageDepth(),

    // Version
    APP_VERSION: APP_VERSION,
    APP_NAME: APP_NAME,

    // Rate limits
    RATE_LIMITS: RATE_LIMITS,

    // Storage keys
    STORAGE_KEYS: STORAGE_KEYS,

    // Detection results
    HOSTNAME: window.location.hostname,
    PROTOCOL: window.location.protocol
  };

  /* ============================================================
     13. GLOBAL HELPERS
     ============================================================ */

  // resolveUrl — للاستخدام المباشر
  window.resolveUrl = resolveUrl;

  // getBase
  window.getBase = getBase;

  // buildPageUrl
  window.buildPageUrl = buildPageUrl;

  /* ============================================================
     14. VALIDATION
     ============================================================ */

  function validateConfig() {
    var errors = [];

    if (!SUPABASE_URL || SUPABASE_URL.indexOf('YOUR_PROJECT_REF') !== -1) {
      errors.push('SUPABASE_URL not configured in config.js');
    }
    if (!SUPABASE_ANON_KEY || SUPABASE_ANON_KEY.indexOf('YOUR_ANON_KEY') !== -1) {
      errors.push('SUPABASE_ANON_KEY not configured in config.js');
    }

    // Security check
    if (SUPABASE_ANON_KEY && SUPABASE_ANON_KEY.length > 0) {
      // Service role key contains "service_role" in payload
      try {
        var parts = SUPABASE_ANON_KEY.split('.');
        if (parts.length >= 2) {
          var payload = JSON.parse(atob(parts[1]));
          if (payload && payload.role === 'service_role') {
            errors.push('SECURITY: SERVICE_ROLE_KEY detected in client config — this is FORBIDDEN');
          }
        }
      } catch (e) {
        // Not a valid JWT — skip
      }
    }

    if (errors.length > 0) {
      console.error('[ITWS Config] Validation errors:');
      errors.forEach(function (e) { console.error('  - ' + e); });
    }

    return errors.length === 0;
  }

  // Run validation on load (non-blocking)
  try {
    validateConfig();
  } catch (e) {
    console.warn('[ITWS Config] Validation failed:', e);
  }

  /* ============================================================
     15. DEBUG LOG
     ============================================================ */

  if (DEBUG) {
    try {
      console.log('%c[ITWS Config]', 'color: #3B82F6; font-weight: bold;', {
        ENV: env,
        BASE_PATH: window.ITWS_CONFIG.BASE_PATH,
        PAGE_DEPTH: window.ITWS_CONFIG.PAGE_DEPTH,
        DEBUG: DEBUG,
        VERSION: APP_VERSION
      });
    } catch (e) {}
  }

})();
