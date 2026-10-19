// ============================================
// [4/50] ITWS Platform - Supabase Client
// Path: assets/js/supabase-client.js
// ============================================
// ⚠️ يجب تحميل الملفات دي قبله (بالترتيب):
//   1. Supabase SDK (CDN)
//   2. assets/js/config.js
// ============================================
// 💡 يهيئ الاتصال مرة واحدة فقط، ويعرضه على window.sb
// ============================================

(function () {
  'use strict';

  // ============ 1. حماية من التهيئة المكررة ============
  if (window.sb && window.sb.from) {
    if (window.ITWS_CONFIG && window.ITWS_CONFIG.DEBUG) {
      console.log('[ITWS] Supabase client already initialized');
    }
    return;
  }

  // ============ 2. التحقق من تحميل الـ SDK ============
  if (typeof supabase === 'undefined' || typeof supabase.createClient !== 'function') {
    console.error(
      '%c❌ [ITWS] Supabase SDK not loaded!',
      'color: #EF4444; font-weight: bold;'
    );
    console.error(
      '📌 Add this line in <head> BEFORE supabase-client.js:\n\n' +
      '   <script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2"></script>'
    );
    return;
  }

  // ============ 3. التحقق من وجود الإعدادات ============
  if (!window.ITWS_CONFIG) {
    console.error(
      '%c❌ [ITWS] Config not found!',
      'color: #EF4444; font-weight: bold;'
    );
    console.error(
      '📌 Load assets/js/config.js BEFORE supabase-client.js'
    );
    return;
  }

  var cfg = window.ITWS_CONFIG;

  // ============ 4. التحقق من صحة الـ URL ============
  if (!cfg.SUPABASE_URL || cfg.SUPABASE_URL.indexOf('YOUR_PROJECT_REF') !== -1) {
    console.error(
      '%c❌ [ITWS] SUPABASE_URL not configured!',
      'color: #EF4444; font-weight: bold;'
    );
    console.error(
      '📌 Edit assets/js/config.js and set SUPABASE_URL to your Project URL'
    );
    return;
  }

  // ============ 5. التحقق من الـ Key ============
  if (!cfg.SUPABASE_ANON_KEY) {
    console.error(
      '%c❌ [ITWS] SUPABASE_ANON_KEY not configured!',
      'color: #EF4444; font-weight: bold;'
    );
    return;
  }

  // ============ 6. إنشاء العميل ============
  try {
    window.sb = supabase.createClient(cfg.SUPABASE_URL, cfg.SUPABASE_ANON_KEY, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
        storageKey: cfg.STORAGE_KEYS.AUTH,
        flowType: 'pkce'
      },
      realtime: {
        params: {
          eventsPerSecond: 5
        }
      },
      global: {
        headers: {
          'X-Client-Info': 'itws-platform/' + cfg.APP_VERSION
        }
      },
      db: {
        schema: 'public'
      }
    });

    // ============ 7. اختبار الاتصال (مرة واحدة) ============
    // بنعمل ping خفيف للتحقق إن البيانات شغالة
    if (cfg.DEBUG) {
      window.sb
        .from('settings')
        .select('key', { count: 'exact', head: true })
        .then(function (res) {
          if (res.error) {
            console.warn('[ITWS] Supabase reachable but returned error:', res.error.message);
          } else {
            console.log('%c✅ [ITWS] Supabase connected', 'color: #10B981; font-weight: bold;');
          }
        })
        .catch(function (err) {
          console.warn('[ITWS] Supabase connection test failed:', err.message);
        });
    }

    // ============ 8. تسجيل حدث Auth (اختياري) ============
    window.sb.auth.onAuthStateChange(function (event, session) {
      if (cfg.DEBUG) {
        console.log('[ITWS] Auth event:', event, session ? '(session active)' : '(no session)');
      }

      // تحديث تلقائي للجلسة في DB
      if (event === 'SIGNED_IN' && session && window.SessionManager) {
        // الـ session.js بيتعامل مع الـ heartbeat
      }
    });

    // ============ 9. إشعار التحميل الناجح ============
    if (cfg.DEBUG) {
      console.log('%c✅ [ITWS] Supabase client ready', 'color: #10B981; font-weight: bold;');
      console.log('   URL:', cfg.SUPABASE_URL);
      console.log('   Auth storage:', cfg.STORAGE_KEYS.AUTH);
    }

  } catch (err) {
    console.error(
      '%c❌ [ITWS] Failed to create Supabase client:',
      'color: #EF4444; font-weight: bold;',
      err
    );
    console.error('📌 Check your SUPABASE_URL and SUPABASE_ANON_KEY in config.js');
  }
})();
