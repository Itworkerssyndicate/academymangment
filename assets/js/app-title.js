// ============================================
// [BONUS] ITWS Platform - Dynamic Title & Favicon
// Path: assets/js/app-title.js
// ============================================
// إصلاح: يقرأ من app_identity (بدل general)
// إصلاح: يستخدم AppSettings كأولوية
// يعمل على كل الصفحات
// بدون إيموجي
// ============================================

(function () {
  'use strict';

  if (window.AppTitle && window.AppTitle.initialized) return;

  var cfg = window.ITWS_CONFIG;
  if (!cfg) return;

  var APP_NAME = cfg.APP_NAME || 'نقابة تكنولوجيا المعلومات والبرمجيات';
  var COMMITTEE_NAME = 'لجنة التحول الرقمي والتدريب';

  var state = {
    channel: null,
    currentLogo: null,
    currentTitle: null,
    initialized: false
  };

  // ============================================
  // 1. تعيين عنوان الصفحة
  // ============================================
  function setTitle(unionName, committeeName) {
    var finalTitle = unionName || APP_NAME;
    if (committeeName) {
      finalTitle += ' | ' + committeeName;
    }
    if (document.title !== finalTitle) {
      document.title = finalTitle;
      state.currentTitle = finalTitle;
      logDebug('Title set:', finalTitle);
    }
  }

  // ============================================
  // 2. تعيين الـ Favicon
  // ============================================
  function setFavicon(logoUrl) {
    if (!logoUrl) return;
    if (state.currentLogo === logoUrl) return;
    state.currentLogo = logoUrl;

    // احذف القديم
    var oldIcons = document.querySelectorAll('link[rel="icon"], link[rel="apple-touch-icon"], link[rel="shortcut icon"]');
    oldIcons.forEach(function (el) { el.remove(); });

    // نوع الملف
    var ext = logoUrl.split('.').pop().split('?')[0].toLowerCase();
    var typeMap = {
      'png': 'image/png',
      'jpg': 'image/jpeg',
      'jpeg': 'image/jpeg',
      'svg': 'image/svg+xml',
      'webp': 'image/webp',
      'ico': 'image/x-icon',
      'gif': 'image/gif'
    };
    var mime = typeMap[ext] || 'image/png';

    // icon عادي
    var icon = document.createElement('link');
    icon.rel = 'icon';
    icon.type = mime;
    icon.href = logoUrl;
    document.head.appendChild(icon);

    // shortcut icon
    var shortcut = document.createElement('link');
    shortcut.rel = 'shortcut icon';
    shortcut.type = mime;
    shortcut.href = logoUrl;
    document.head.appendChild(shortcut);

    // apple-touch-icon
    var appleIcon = document.createElement('link');
    appleIcon.rel = 'apple-touch-icon';
    appleIcon.href = logoUrl;
    document.head.appendChild(appleIcon);

    logDebug('Favicon set:', logoUrl);
  }

  // ============================================
  // 3. تعيين Meta tags
  // ============================================
  function setMetaTags(unionName, committeeName, logoUrl) {
    var desc = unionName + ' - ' + committeeName + ' | النظام الرسمي للتحقق من الشهادات';

    var descEl = document.querySelector('meta[name="description"]');
    if (descEl) descEl.setAttribute('content', desc);

    var ogTitle = document.querySelector('meta[property="og:title"]');
    if (ogTitle) ogTitle.setAttribute('content', unionName);

    var ogDesc = document.querySelector('meta[property="og:description"]');
    if (ogDesc) ogDesc.setAttribute('content', desc);

    var ogImage = document.querySelector('meta[property="og:image"]');
    if (ogImage && logoUrl) ogImage.setAttribute('content', logoUrl);

    var twTitle = document.querySelector('meta[name="twitter:title"]');
    if (twTitle) twTitle.setAttribute('content', unionName);

    var twDesc = document.querySelector('meta[name="twitter:description"]');
    if (twDesc) twDesc.setAttribute('content', desc);

    var twImage = document.querySelector('meta[name="twitter:image"]');
    if (twImage && logoUrl) twImage.setAttribute('content', logoUrl);
  }

  // ============================================
  // 4. تطبيق البيانات من settings object
  // ============================================
  function applySettings(s) {
    if (!s) return;

    var unionName = s.union_name || APP_NAME;
    var committeeName = s.committee_name || COMMITTEE_NAME;
    var logoUrl = s.logo_url || null;

    setTitle(unionName, committeeName);
    setMetaTags(unionName, committeeName, logoUrl);

    if (logoUrl) {
      setFavicon(logoUrl);
    }
  }

  // ============================================
  // 5. تحميل من Supabase
  // ============================================
  function loadFromSupabase() {
    if (!window.sb) return Promise.resolve(null);

    return window.sb
      .from('settings')
      .select('value')
      .eq('key', 'app_identity')
      .maybeSingle()
      .then(function (res) {
        if (res.error || !res.data || !res.data.value) {
          logDebug('No app_identity in Supabase');
          return null;
        }
        return res.data.value;
      })
      .catch(function (err) {
        logDebug('Supabase load error:', err.message);
        return null;
      });
  }

  // ============================================
  // 6. تحميل من AppSettings (أسرع - localStorage)
  // ============================================
  function loadFromAppSettings() {
    if (!window.AppSettings || !window.AppSettings.get) return null;

    try {
      return {
        union_name: window.AppSettings.get('app_identity.union_name', APP_NAME),
        committee_name: window.AppSettings.get('app_identity.committee_name', COMMITTEE_NAME),
        logo_url: window.AppSettings.get('app_identity.logo_url', null)
      };
    } catch (e) {
      return null;
    }
  }

  // ============================================
  // 7. الاستماع للتغييرات (Realtime)
  // ============================================
  function subscribe() {
    if (!window.sb || state.channel) return;

    try {
      state.channel = window.sb
        .channel('itws-app-title')
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'settings', filter: 'key=eq.app_identity' },
          function (payload) {
            var newValue = payload.new && payload.new.value;
            if (newValue) {
              applySettings(newValue);
              logDebug('Realtime update:', newValue);
            }
          }
        )
        .subscribe(function (status) {
          logDebug('Channel status:', status);
        });
    } catch (e) {
      logDebug('Subscribe error:', e.message);
    }
  }

  // ============================================
  // 8. الاستماع لـ AppSettings (fallback أسرع)
  // ============================================
  function subscribeAppSettings() {
    if (!window.AppSettings || !window.AppSettings.onChange) return;

    window.AppSettings.onChange(function (cache, changedKey) {
      if (changedKey === 'app_identity' || !changedKey) {
        var data = loadFromAppSettings();
        if (data) applySettings(data);
      }
    });
  }

  // ============================================
  // 9. التهيئة الرئيسية
  // ============================================
  function init() {
    if (state.initialized) return;
    state.initialized = true;

    // (1) تطبيق الافتراضي فوراً
    setTitle(APP_NAME, COMMITTEE_NAME);

    // (2) محاولة من AppSettings (سريع - localStorage)
    var cached = loadFromAppSettings();
    if (cached) {
      applySettings(cached);
    }

    // (3) تحميل من Supabase (أحدث بيانات)
    if (window.sb) {
      loadFromSupabase().then(function (data) {
        if (data) {
          applySettings(data);
        }
      });

      // (4) realtime
      subscribe();
    } else {
      // نحاول بعد ثانية (لو Supabase لسه بيتحمل)
      setTimeout(function () {
        if (window.sb) {
          loadFromSupabase().then(function (data) {
            if (data) applySettings(data);
          });
          subscribe();
        }
      }, 1000);
    }

    // (5) الاستماع لـ AppSettings
    subscribeAppSettings();

    logDebug('AppTitle initialized');
  }

  // ============================================
  // 10. Helper
  // ============================================
  function logDebug() {
    if (cfg && cfg.DEBUG) {
      console.log.apply(console, ['[AppTitle]'].concat(Array.prototype.slice.call(arguments)));
    }
  }

  // ============================================
  // 11. Public API
  // ============================================
  window.AppTitle = {
    initialized: true,
    init: init,
    refresh: function () {
      return loadFromSupabase().then(function (data) {
        if (data) applySettings(data);
      });
    },
    set: function (unionName, committeeName, logoUrl) {
      applySettings({
        union_name: unionName,
        committee_name: committeeName,
        logo_url: logoUrl
      });
    }
  };

  // ============================================
  // 12. Auto-init
  // ============================================
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

})();
