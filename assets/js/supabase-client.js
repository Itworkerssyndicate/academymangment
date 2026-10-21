// ============================================
// ITWS Platform - Supabase Client
// Path: assets/js/supabase-client.js
// ============================================
// ✅ إصلاح: تعطيل navigator.locks (سبب تعليق تسجيل الدخول)
// ============================================

(function () {
  'use strict';

  if (window.sb && window.sb.from) {
    if (window.ITWS_CONFIG && window.ITWS_CONFIG.DEBUG) {
      console.log('[ITWS] Supabase client already initialized');
    }
    return;
  }

  if (typeof supabase === 'undefined' || typeof supabase.createClient !== 'function') {
    console.error('❌ [ITWS] Supabase SDK not loaded!');
    console.error('📌 Add <script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2"></script> BEFORE this file');
    return;
  }

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
    console.error('❌ [ITWS] SUPABASE_ANON_KEY not configured');
    return;
  }

  // ✅ الحل الأساسي: تعطيل navigator.locks لمنع التعليق
  // + lockAcquireTimeout كاحتياطي لو الإصدار قديم
  try {
    window.sb = supabase.createClient(cfg.SUPABASE_URL, cfg.SUPABASE_ANON_KEY, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
        storageKey: cfg.STORAGE_KEYS.AUTH,
        flowType: 'pkce',
        // ✅ تعطيل الـ Web Locks (سبب التعليق الرئيسي)
        lock: function (_name, _acquireTimeout, fn) {
          return fn();
        },
        // ✅ احتياطي للإصدارات القديمة
        lockAcquireTimeout: 5000
      },
      realtime: {
        params: { eventsPerSecond: 5 }
      },
      global: {
        headers: { 'X-Client-Info': 'itws-platform/' + cfg.APP_VERSION }
      },
      db: { schema: 'public' }
    });

    if (cfg.DEBUG) {
      console.log('✅ [ITWS] Supabase client ready (locks disabled)');
    }

    // تسجيل أحداث Auth بدون أي استدعاءات async جواه (لمنع deadlock)
    window.sb.auth.onAuthStateChange(function (event, session) {
      if (cfg.DEBUG) {
        console.log('[ITWS] Auth event:', event, session ? '(session active)' : '(no session)');
      }
      // ⚠️ ممنوع نستدعي أي supabase API هنا — بس نسجل الحدث
    });

  } catch (err) {
    console.error('❌ [ITWS] Failed to create Supabase client:', err);
  }
})();
