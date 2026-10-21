// ============================================
// ITWS Platform - Supabase Client
// Path: assets/js/supabase-client.js
// ============================================
// ✅ إصلاح: تعطيل navigator.locks (سبب تعليق تسجيل الدخول)
// ✅ إصلاح: منع deadlock في onAuthStateChange
// ✅ إصدار SDK: 2.110.1 (يحتوي على إصلاحات للمشكلة)
// ============================================

(function () {
  'use strict';

  // ============================================
  // 1. حماية من التهيئة المكررة
  // ============================================
  if (window.sb && window.sb.from) {
    if (window.ITWS_CONFIG && window.ITWS_CONFIG.DEBUG) {
      console.log('[ITWS] Supabase client already initialized');
    }
    return;
  }

  // ============================================
  // 2. التحقق من تحميل SDK
  // ============================================
  if (typeof supabase === 'undefined' || typeof supabase.createClient !== 'function') {
    console.error('❌ [ITWS] Supabase SDK not loaded!');
    console.error('📌 Add this BEFORE supabase-client.js:');
    console.error('   <script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.110.1/dist/umd/supabase.js"></script>');
    return;
  }

  // ============================================
  // 3. التحقق من config.js
  // ============================================
  if (!window.ITWS_CONFIG) {
    console.error('❌ [ITWS] config.js not loaded!');
    return;
  }

  var cfg = window.ITWS_CONFIG;

  if (!cfg.SUPABASE_URL || cfg.SUPABASE_URL.indexOf('YOUR_PROJECT_REF') !== -1) {
    console.error('❌ [ITWS] SUPABASE_URL not configured in config.js');
    return;
  }

  if (!cfg.SUPABASE_ANON_KEY) {
    console.error('❌ [ITWS] SUPABASE_ANON_KEY not configured in config.js');
    return;
  }

  // ============================================
  // 4. إنشاء Supabase client
  // ============================================
  try {
    window.sb = supabase.createClient(cfg.SUPABASE_URL, cfg.SUPABASE_ANON_KEY, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
        storageKey: cfg.STORAGE_KEYS.AUTH || 'itws_auth',
        flowType: 'pkce',

        // ✅ الحل الأساسي: تعطيل navigator.locks تماماً
        // هذا يمنع أي deadlock في عمليات الـ auth
        lock: function (_name, _acquireTimeout, fn) {
          return fn();
        },

        // ✅ احتياطي (لو SDK قديم بيستخدم lockAcquireTimeout)
        lockAcquireTimeout: 5000
      },

      realtime: {
        params: {
          eventsPerSecond: 5
        }
      },

      global: {
        headers: {
          'X-Client-Info': 'itws-platform/' + (cfg.APP_VERSION || '1.0.0')
        }
      },

      db: {
        schema: 'public'
      }
    });

    // ============================================
    // 5. تسجيل أحداث Auth (بدون أي async)
    // ============================================
    // ⚠️ ممنوع تماماً: استدعاء أي supabase API داخل onAuthStateChange
    // ⚠️ ممنوع تماماً: استخدام async/await داخل onAuthStateChange
    window.sb.auth.onAuthStateChange(function (event, session) {
      if (cfg.DEBUG) {
        console.log('[ITWS] Auth event:', event, session ? '(session active)' : '(no session)');
      }

      // ❌ متعملش أي استدعاء Supabase هنا
      // ❌ متستخدمش await أو .then() هنا
      // بس نسجل الحدث، خلاص

      // لو حد تاني عايز يستمع، هيستخدم AuthGuard.onAuthChange
      // واللي بيتعامل مع async بشكل آمن (setTimeout)
    });

    // ============================================
    // 6. إشعار النجاح
    // ============================================
    if (cfg.DEBUG) {
      console.log('%c✅ [ITWS] Supabase client ready', 'color: #10B981; font-weight: bold;');
      console.log('   URL:', cfg.SUPABASE_URL);
      console.log('   Auth locks: DISABLED (deadlock prevention)');
    }

  } catch (err) {
    console.error('❌ [ITWS] Failed to create Supabase client:', err);
    console.error('📌 Check your SUPABASE_URL and SUPABASE_ANON_KEY in config.js');
  }

})();
