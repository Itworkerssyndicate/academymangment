// ============================================
// [3/50] ITWS Platform - Configuration
// Path: assets/js/config.js
// ============================================

(function () {
  'use strict';

  const SUPABASE_URL = 'https://YOUR_PROJECT_REF.supabase.co';
  const SUPABASE_ANON_KEY = 'sb_publishable__9lVaIyTxYzyykQ_AY_u9w_On795zBK';

  // ============ اكتشاف المسار الجذري ============
  function detectBasePath() {
    var path = window.location.pathname;
    if (/\/admin\//.test(path) || /\/portal\//.test(path)) {
      return '../';
    }
    return '';
  }

  window.ITWS_CONFIG = {
    SUPABASE_URL: SUPABASE_URL,
    SUPABASE_ANON_KEY: SUPABASE_ANON_KEY,

    APP_NAME: 'نقابة تكنولوجيا المعلومات والبرمجيات',
    APP_NAME_EN: 'ITWS',
    APP_VERSION: '1.0.0',

    BASE_PATH: detectBasePath(),

    STORAGE_KEYS: {
      THEME: 'itws_theme',
      VISITOR_ID: 'itws_visitor_id',
      AUTH: 'itws_auth'
    },

    HEARTBEAT_INTERVAL: 60000,
    ONLINE_THRESHOLD: 120000,

    ROUTES: {
      INDEX: 'index.html',
      HOME: 'home.html',
      VERIFY: 'verify.html',
      LOGIN: 'login.html',
      STUDENT: 'student.html',
      ACADEMIES: 'academies.html',
      ACADEMY_APPLY: 'academy-apply.html',
      TRACK: 'track.html',
      ADMIN: 'admin/index.html',
      PORTAL: 'portal/index.html'
    },

    VALIDATION: {
      NATIONAL_ID_LENGTH: 14,
      PASSWORD_MIN_LENGTH: 8,
      CERT_CODE_PATTERN: /^NTI-\d{4}-[A-Z0-9]{6}$/,
      EGYPT_PHONE_PATTERN: /^01[0125][0-9]{8}$/
    },

    UPLOAD: {
      MAX_IMAGE_SIZE: 2 * 1024 * 1024,
      MAX_DOCUMENT_SIZE: 10 * 1024 * 1024
    },

    DEBUG: false
  };

  // ============ Helper: بناء رابط ============
  window.resolveUrl = function (path) {
    if (!path) return '';
    if (/^https?:\/\//.test(path) || path.startsWith('mailto:') || path.startsWith('tel:')) {
      return path;
    }
    return (window.ITWS_CONFIG.BASE_PATH || '') + path.replace(/^\.?\//, '');
  };

  if (SUPABASE_URL.indexOf('YOUR_PROJECT_REF') !== -1) {
    console.error('SUPABASE_URL not configured! Update assets/js/config.js');
  }
})();
