// ============================================
// [3/50] ITWS Platform - Configuration
// Path: assets/js/config.js
// ============================================
// ⚠️ تعليمات مهمة:
// 1. هذا الملف يحتوي على Publishable Key فقط (آمن للعرض في المتصفح)
// 2. ⚠️ ممنوع وضع Service Role Key هنا — يُستخدم فقط في Edge Functions
// 3. استبدل SUPABASE_URL بقيمة Project URL من Supabase Dashboard
// ============================================

(function () {
  'use strict';

  // ⚠️⚠️⚠️ غيّر السطر ده قبل التشغيل ⚠️⚠️⚠️
  // تلاقيه في: Supabase Dashboard → Settings → API → Project URL
  const SUPABASE_URL = 'https://hfupkxbajpnaillsqayc.supabase.co';

  // Publishable Key (آمن للعرض - جاهز)
  const SUPABASE_ANON_KEY = 'sb_publishable__9lVaIyTxYzyykQ_AY_u9w_On795zBK';

  window.ITWS_CONFIG = {
    // ============ Supabase ============
    SUPABASE_URL: SUPABASE_URL,
    SUPABASE_ANON_KEY: SUPABASE_ANON_KEY,

    // ============ App Info ============
    APP_NAME: 'نقابة تكنولوجيا المعلومات والبرمجيات',
    APP_NAME_EN: 'ITWS',
    APP_VERSION: '1.0.0',

    // ============ Storage Keys ============
    STORAGE_KEYS: {
      THEME: 'itws_theme',
      VISITOR_ID: 'itws_visitor_id',
      AUTH: 'itws_auth',
      LAST_ROUTE: 'itws_last_route'
    },

    // ============ Session & Presence ============
    HEARTBEAT_INTERVAL: 60000,     // 60 ثانية
    ONLINE_THRESHOLD: 120000,      // دقيقتين

    // ============ Auth ============
    MAX_LOGIN_ATTEMPTS: 5,
    SESSION_TIMEOUT_MINUTES: 30,

    // ============ Routes ============
    ROUTES: {
      INDEX: '/index.html',
      HOME: '/home.html',
      VERIFY: '/verify.html',
      LOGIN: '/login.html',
      STUDENT: '/student.html',
      ACADEMIES: '/academies.html',
      ACADEMY_APPLY: '/academy-apply.html',
      TRACK: '/track.html',
      ADMIN: '/admin/index.html',
      PORTAL: '/portal/index.html'
    },

    // ============ Feature Flags ============
    FEATURES: {
      ENABLE_CV_BUILDER: true,
      ENABLE_QR_CODE: true,
      ENABLE_AI_SUGGESTIONS: true,
      ENABLE_DARK_MODE_TOGGLE: true,
      ENABLE_REGISTRATION: false       // تسجيل أكاديميات جديدة فقط
    },

    // ============ Validation ============
    VALIDATION: {
      NATIONAL_ID_LENGTH: 14,
      PHONE_MIN_LENGTH: 10,
      PASSWORD_MIN_LENGTH: 8,
      CERT_CODE_PATTERN: /^NTI-\d{4}-[A-Z0-9]{6}$/,
      EGYPT_PHONE_PATTERN: /^01[0125][0-9]{8}$/
    },

    // ============ Pagination ============
    PAGINATION: {
      DEFAULT_PAGE_SIZE: 12,
      MAX_PAGE_SIZE: 100,
      ADMIN_PAGE_SIZE: 20
    },

    // ============ Upload Limits ============
    UPLOAD: {
      MAX_IMAGE_SIZE: 2 * 1024 * 1024,      // 2 MB
      MAX_DOCUMENT_SIZE: 10 * 1024 * 1024,  // 10 MB
      ALLOWED_IMAGE_TYPES: ['image/jpeg', 'image/png', 'image/webp', 'image/svg+xml'],
      ALLOWED_DOCUMENT_TYPES: ['application/pdf', 'image/jpeg', 'image/png']
    },

    // ============ Debug ============
    DEBUG: false
  };

  // ============ Validation Helper ============
  if (SUPABASE_URL.indexOf('YOUR_PROJECT_REF') !== -1) {
    console.error(
      '%c⚠️ [ITWS] SUPABASE_URL not configured!',
      'color: #EF4444; font-size: 14px; font-weight: bold;'
    );
    console.error(
      '📌 Update assets/js/config.js with your Project URL from:\n' +
      '   https://supabase.com/dashboard/project/_/settings/api\n\n' +
      '   Look for: Project URL (example: https://abcdefghij.supabase.co)'
    );
  } else if (window.ITWS_CONFIG.DEBUG) {
    console.log('%c✅ [ITWS] Config loaded', 'color: #10B981; font-weight: bold;');
    console.log('   URL:', SUPABASE_URL);
    console.log('   Key:', SUPABASE_ANON_KEY.substring(0, 20) + '...');
  }
})();
