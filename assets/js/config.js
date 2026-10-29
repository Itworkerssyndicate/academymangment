/**
 * ================================================================
 * ITWS CONFIG — V4 (EXPANDED)
 * assets/js/config.js
 * ================================================================
 * ملف التكوين الأساسي للمنصة.
 *
 * المسؤوليات:
 *   1. BASE_PATH + resolveUrl() — حل المسارات النسبية
 *   2. Supabase credentials (URL + Anon Key فقط — ممنوع Service Role)
 *   3. فحص صحة الإعدادات + ITWS_CONFIG_VALID flag
 *   4. Feature Gates (من settings.features)
 *   5. Version Pinning (يمنع تحميل نسخ قديمة من cache)
 *   6. Connection Health Check (بدون console.error)
 *   7. Runtime helpers (isDev, isProd, isLocal, isGitHubPages)
 *
 * قواعد صارمة:
 *   - Silent تماماً — بدون console.error
 *   - ES5-safe (بدون ?. / ?? / =>)
 *   - المسارات دايماً نسبية
 *   - ممنوع postgresql:// connection string هنا (CLI فقط)
 *
 * الترتيب:
 *   <script src="assets/js/settings-defaults.js"></script>
 *   <script src="assets/js/config.js"></script>          ← إنت هنا
 *   <script src="assets/js/themes-data.js"></script>
 *   ...
 * ================================================================
 */

(function () {
  'use strict';

  // =============================================================
  // 1) BASE_PATH — المسار الأساسي على GitHub Pages
  // =============================================================
  // - على GitHub Pages: /academymangment/
  // - محلياً (localhost): /
  // - مفيش build step — بنحسبه من window.location

  var BASE_PATH = '/academymangment/';

  // كشف تلقائي — لو الموقع مرفوع في مكان تاني، بنصلحه
  (function detectBasePath() {
    try {
      var path = window.location.pathname || '';
      var marker = '/academymangment/';
      var idx = path.indexOf(marker);
      if (idx >= 0) {
        BASE_PATH = path.substring(0, idx + marker.length);
      } else if (path.indexOf('/academymangment') === 0) {
        // لسه في الصفحة الأولى
        BASE_PATH = '/academymangment/';
      } else if (path === '/' || path === '' || path === '/index.html') {
        // localhost أو root
        BASE_PATH = '/';
      } else {
        // احتياطي — لو مش عارفين، نستخدم الافتراضي
        BASE_PATH = '/academymangment/';
      }
    } catch (e) {
      BASE_PATH = '/academymangment/';
    }
  })();

  // =============================================================
  // 2) Supabase Credentials
  // =============================================================
  // ⚠️ الـ Anon Key ده public — مصمم يبقى في client-side
  // ⚠️ الـ Service Role Key ممنوع هنا نهائياً (server-side فقط)
  // ⚠️ الحماية الحقيقية = RLS في DB، مش إخفاء المفتاح

  var SUPABASE_URL = 'https://hfupkxbajpnaillsqayc.supabase.co';
  var SUPABASE_ANON_KEY = 'sb_publishable__9lVaIyTxYzyykQ_AY_u9w_On795zBK';

  // =============================================================
  // 3) Version Pinning — يمنع cache قديم
  // =============================================================

  var APP_VERSION = '1.0.0';
  var BUILD_NUMBER = '2025-01-15-001';
  var SCHEMA_VERSION = 'home.v2';

  // =============================================================
  // 4) Environment Detection
  // =============================================================

  var ENV = (function detectEnv() {
    try {
      var host = window.location.hostname || '';
      var port = window.location.port || '';
      var protocol = window.location.protocol || '';

      if (host === 'localhost' || host === '127.0.0.1' || host === '0.0.0.0') {
        return 'local';
      }
      if (host.indexOf('github.io') >= 0) {
        return 'github-pages';
      }
      if (protocol === 'file:') {
        return 'file';
      }
      return 'production';
    } catch (e) {
      return 'unknown';
    }
  })();

  var IS_DEV = (ENV === 'local' || ENV === 'file');
  var IS_PROD = (ENV === 'production' || ENV === 'github-pages');

  // =============================================================
  // 5) resolveUrl — حل المسار النسبي على BASE_PATH
  // =============================================================
  // القواعد:
  //   - مسار يبدأ بـ http:// أو https:// → يرجع زي ما هو
  //   - مسار يبدأ بـ // (protocol-relative) → يرجع زي ما هو
  //   - مسار يبدأ بـ data: أو blob: → يرجع زي ما هو
  //   - مسار يبدأ بـ / → يشيل الـ / ويضيف BASE_PATH
  //   - مسار نسبي (home.html) → يضيف BASE_PATH قبله
  //   - مسار ../ → يرجع زي ما هو (browser يحلها)
  //   - مسار # → يرجع زي ما هو
  //   - مسار mailto:/tel: → يرجع زي ما هو

  function resolveUrl(path) {
    if (path === undefined || path === null || path === '') {
      return BASE_PATH;
    }
    var s = String(path);

    // absolute URLs
    if (s.indexOf('http://') === 0) { return s; }
    if (s.indexOf('https://') === 0) { return s; }
    if (s.indexOf('//') === 0) { return s; }

    // special protocols
    if (s.indexOf('data:') === 0) { return s; }
    if (s.indexOf('blob:') === 0) { return s; }
    if (s.indexOf('mailto:') === 0) { return s; }
    if (s.indexOf('tel:') === 0) { return s; }
    if (s.indexOf('javascript:') === 0) { return s; }

    // anchors
    if (s.charAt(0) === '#') { return s; }

    // relative parent
    if (s.indexOf('../') === 0) { return s; }

    // leading slash → strip + add BASE_PATH
    if (s.charAt(0) === '/') {
      return BASE_PATH + s.substring(1);
    }

    // relative → add BASE_PATH
    return BASE_PATH + s;
  }

  // نسخة ترجع URL كامل (مع origin)
  function resolveFullUrl(path) {
    var rel = resolveUrl(path);
    if (rel.indexOf('http://') === 0 || rel.indexOf('https://') === 0 || rel.indexOf('//') === 0) {
      return rel;
    }
    try {
      return window.location.origin + rel;
    } catch (e) {
      return rel;
    }
  }

  // =============================================================
  // 6) Feature Gates — من settings.features مع fallback
  // =============================================================

  function getFeatures() {
    try {
      if (window.ITWS_SETTINGS_DEFAULTS && window.ITWS_SETTINGS_DEFAULTS.features) {
        return window.ITWS_SETTINGS_DEFAULTS.features;
      }
    } catch (e) {}
    return {
      verify_enabled: true,
      student_portal: true,
      academy_directory: true,
      academy_apply: true,
      track_requests: true,
      admin_panel: true,
      portal_enabled: true,
      branch_enabled: true,
      cv_builder: true,
      ratings_enabled: true,
      ratings_public: true,
      certificates_pdf: true,
      certificates_qr: true,
      notifications_enabled: true,
      ai_assistant: false,
      multi_language: false,
      dark_mode_only: false
    };
  }

  function isFeatureEnabled(key) {
    var f = getFeatures();
    if (!f) { return false; }
    if (f[key] === undefined) { return false; }
    return f[key] === true;
  }

  // =============================================================
  // 7) Health Check — فحص صحة الإعدادات (silent)
  // =============================================================

  var healthIssues = [];

  function validateConfig() {
    healthIssues = [];

    // URL validation
    if (!SUPABASE_URL || SUPABASE_URL.indexOf('https://') !== 0) {
      healthIssues.push('INVALID_SUPABASE_URL');
    }
    if (!SUPABASE_ANON_KEY || SUPABASE_ANON_KEY.length < 20) {
      healthIssues.push('INVALID_SUPABASE_KEY');
    }

    // BASE_PATH validation
    if (!BASE_PATH || BASE_PATH.charAt(0) !== '/') {
      healthIssues.push('INVALID_BASE_PATH');
    }
    if (BASE_PATH.charAt(BASE_PATH.length - 1) !== '/') {
      healthIssues.push('BASE_PATH_MUST_END_WITH_SLASH');
    }

    // forbidden patterns
    if (SUPABASE_ANON_KEY.indexOf('service_role') >= 0) {
      healthIssues.push('SERVICE_ROLE_KEY_DETECTED');
    }
    if (SUPABASE_ANON_KEY.indexOf('postgresql://') >= 0) {
      healthIssues.push('POSTGRES_STRING_IN_CLIENT');
    }

    return healthIssues.length === 0;
  }

  var CONFIG_VALID = validateConfig();

  // =============================================================
  // 8) Connection Health — فحص اتصال Supabase (silent)
  // =============================================================

  var connectionState = {
    status: 'unknown',       // 'unknown' | 'online' | 'offline' | 'checking'
    lastCheck: null,
    lastSuccess: null,
    latencyMs: null,
    attempts: 0,
    listeners: []
  };

  function notifyConnectionListeners() {
    for (var i = 0; i < connectionState.listeners.length; i++) {
      try {
        connectionState.listeners[i](connectionState.status);
      } catch (e) {}
    }
  }

  function checkConnection() {
    connectionState.status = 'checking';
    connectionState.attempts++;
    notifyConnectionListeners();

    var start = Date.now();

    // fetch بسيط — Supabase health endpoint
    try {
      if (typeof fetch !== 'function') {
        connectionState.status = 'unknown';
        return;
      }
      fetch(SUPABASE_URL + '/rest/v1/', {
        method: 'HEAD',
        headers: {
          'apikey': SUPABASE_ANON_KEY,
          'Authorization': 'Bearer ' + SUPABASE_ANON_KEY
        },
        cache: 'no-store'
      }).then(function (resp) {
        connectionState.latencyMs = Date.now() - start;
        connectionState.lastCheck = new Date().toISOString();
        if (resp.ok || resp.status === 400 || resp.status === 401) {
          // 400/401 يعني السيرفر شغال، بس الـ request ناقص
          connectionState.status = 'online';
          connectionState.lastSuccess = new Date().toISOString();
        } else {
          connectionState.status = 'offline';
        }
        notifyConnectionListeners();
      }).catch(function () {
        connectionState.latencyMs = Date.now() - start;
        connectionState.lastCheck = new Date().toISOString();
        connectionState.status = 'offline';
        notifyConnectionListeners();
      });
    } catch (e) {
      connectionState.status = 'unknown';
      notifyConnectionListeners();
    }
  }

  function onConnectionChange(cb) {
    if (typeof cb === 'function') {
      connectionState.listeners.push(cb);
      // نادي فوراً بالحالة الحالية
      try { cb(connectionState.status); } catch (e) {}
    }
  }

  function getConnectionState() {
    return {
      status: connectionState.status,
      latencyMs: connectionState.latencyMs,
      lastCheck: connectionState.lastCheck,
      lastSuccess: connectionState.lastSuccess,
      attempts: connectionState.attempts
    };
  }

  // =============================================================
  // 9) Storage Keys — مفاتيح موحدة
  // =============================================================

  var STORAGE_KEYS = {
    theme:          'itws_theme',
    userPrefs:      'itws_user_prefs',
    homePrefs:      'itws_home_prefs',
    sessionHint:    'itws_session_hint',
    lastRoute:      'itws_last_route',
    lang:           'itws_lang',
    sidebarCollapsed: 'itws_sidebar_collapsed',
    notificationRead: 'itws_notif_read',
    disclaimerAccepted: 'itws_disclaimer_accepted'
  };

  // =============================================================
  // 10) Route Helpers — مسارات موحدة
  // =============================================================

  var ROUTES = {
    home:           'home.html',
    verify:         'verify.html',
    student:        'student.html',
    academies:      'academies.html',
    academyDetails: 'academy-details.html',
    academyApply:   'academy-apply.html',
    track:          'track.html',
    login:          'login.html',
    resetPassword:  'reset-password.html',
    notFound:       '404.html',
    splash:         'index.html',
    admin:          'admin/index.html',
    portal:         'portal/index.html',
    branch:         'branch/index.html'
  };

  function getRoute(key) {
    if (!key || !ROUTES[key]) { return resolveUrl('home.html'); }
    return resolveUrl(ROUTES[key]);
  }

  // =============================================================
  // 11) Debug Logger — silent في prod
  // =============================================================

  function debugLog() {
    if (!IS_DEV) { return; }
    try {
      if (window.ITWS_SETTINGS_DEFAULTS &&
          window.ITWS_SETTINGS_DEFAULTS.dev &&
          window.ITWS_SETTINGS_DEFAULTS.dev.verbose_logging) {
        var args = ['[ITWS:config]'];
        for (var i = 0; i < arguments.length; i++) {
          args.push(arguments[i]);
        }
        if (typeof console !== 'undefined' && console.log) {
          console.log.apply(console, args);
        }
      }
    } catch (e) {}
  }

  // =============================================================
  // 12) Cache Buster — يضيف ?v= للتحديث
  // =============================================================

  function withCacheBuster(url) {
    var u = resolveUrl(url);
    if (u.indexOf('#') >= 0) {
      u = u.substring(0, u.indexOf('#'));
    }
    var sep = u.indexOf('?') >= 0 ? '&' : '?';
    return u + sep + 'v=' + APP_VERSION;
  }

  // =============================================================
  // 13) Export Global Config
  // =============================================================

  window.ITWS_CONFIG = {
    // Identity
    appName:        'ITWS Platform',
    version:        APP_VERSION,
    buildNumber:    BUILD_NUMBER,
    schemaVersion:  SCHEMA_VERSION,

    // Environment
    env:            ENV,
    isDev:          IS_DEV,
    isProd:         IS_PROD,
    isLocal:        ENV === 'local',
    isGitHubPages:  ENV === 'github-pages',

    // Paths
    basePath:       BASE_PATH,

    // Supabase
    supabaseUrl:    SUPABASE_URL,
    supabaseKey:    SUPABASE_ANON_KEY,

    // Routes
    routes:         ROUTES,

    // Storage
    storageKeys:    STORAGE_KEYS,

    // Validity
    valid:          CONFIG_VALID,
    issues:         healthIssues.slice()
  };

  window.ITWS_CONFIG_VALID = CONFIG_VALID;

  // =============================================================
  // 14) Export Global Helpers
  // =============================================================

  window.resolveUrl = resolveUrl;
  window.resolveFullUrl = resolveFullUrl;
  window.getRoute = getRoute;
  window.isFeatureEnabled = isFeatureEnabled;
  window.withCacheBuster = withCacheBuster;
  window.getConfigHealth = function () {
    return {
      valid: CONFIG_VALID,
      issues: healthIssues.slice(),
      version: APP_VERSION,
      env: ENV
    };
  };

  // Connection helpers
  window.ITWSConnection = {
    check: checkConnection,
    state: getConnectionState,
    onChange: onConnectionChange
  };

  // Debug helper
  window.__itwsDebug = debugLog;

  // =============================================================
  // 15) فحص أولي عند التحميل (بدون console.error)
  // =============================================================

  // لو في مشاكل في الإعدادات، نسجل تحذير في debug فقط
  if (!CONFIG_VALID) {
    debugLog('Config validation issues:', healthIssues);
  }

  // فحص الاتصال تلقائياً في الخلفية (مرة واحدة عند التحميل)
  // نأجله شوية عشان ما نبطأش الصفحة
  try {
    if (typeof setTimeout === 'function') {
      setTimeout(function () {
        try { checkConnection(); } catch (e) {}
      }, 800);
    }
  } catch (e) {}

  debugLog('Config loaded:', {
    version: APP_VERSION,
    env: ENV,
    basePath: BASE_PATH,
    valid: CONFIG_VALID
  });

})();
