/* ============================================================
   ITWS Platform — Home Page Logic V5
   File: assets/js/pages/home.js
   
   - يربط [data-setting] attributes بـ AppSettings.get()
   - Realtime updates من Supabase
   - Live counters (academies, certificates, visitors)
   - Dynamic logo/head photo/about text
   - Theme sync + labels
   ============================================================ */

(function () {
  'use strict';

  if (window.HomePage && window.HomePage._initialized) return;

  var state = {
    _initialized: false,
    settingsUnsub: null,
    labelsUnsub: null,
    realtimeUnsubs: [],
    stats: { academies: 0, certificates: 0, visitors: 0 }
  };

  /* ============================================================
     1. HELPERS
     ============================================================ */

  function log(level, msg, data) {
    var cfg = window.ITWS_CONFIG || {};
    if (level === 'error' || (cfg.DEBUG && level === 'debug')) {
      try {
        var args = ['[Home]', msg];
        if (data !== undefined) args.push(data);
        if (level === 'error') console.error.apply(console, args);
        else console.log.apply(console, args);
      } catch (e) {}
    }
  }

  function getSb() {
    return window.sb || window.supabaseClient || null;
  }

  function getSetting(path, fallback) {
    try {
      if (window.AppSettings && typeof window.AppSettings.get === 'function') {
        var v = window.AppSettings.get(path);
        if (v !== undefined && v !== null) return v;
      }
    } catch (e) {}
    try {
      if (typeof window.getSettingDefault === 'function') {
        var d = window.getSettingDefault(path);
        if (d !== undefined && d !== null) return d;
      }
    } catch (e) {}
    return fallback;
  }

  function getLabel(key, fallback) {
    try {
      if (window.Labels && typeof window.Labels.t === 'function') {
        var v = window.Labels.t(key);
        if (v && v !== key) return v;
      }
    } catch (e) {}
    return fallback;
  }

  function $(sel, ctx) { return (ctx || document).querySelector(sel); }
  function $all(sel, ctx) {
    return Array.prototype.slice.call((ctx || document).querySelectorAll(sel));
  }

  function setText(el, text) {
    if (!el) return;
    var str = text == null ? '' : String(text);
    if (el.textContent !== str) el.textContent = str;
  }

  function escapeHtml(s) {
    if (s == null) return '';
    return String(s)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  /* ============================================================
     2. APPLY DATA-SETTING ATTRIBUTES
     ============================================================ */

  function applyDataSettings() {
    var els = $all('[data-setting]');
    for (var i = 0; i < els.length; i++) {
      var el = els[i];
      var key = el.getAttribute('data-setting');
      if (!key) continue;

      var value = getSetting('app_identity.' + key, null);
      if (value === null) {
        value = getSetting(key, null);
      }
      if (value === null || value === undefined || value === '') continue;

      // If the element has children (like <br><span>), don't override
      if (el.children.length > 0) {
        // Find the text-only span or just update the first text node
        continue;
      }

      setText(el, value);
    }
  }

  /* ============================================================
     3. APPLY BRANDING (logo + union name + head)
     ============================================================ */

  function applyBranding() {
    var unionName = getSetting('app_identity.union_name', 'نقابة تكنولوجيا المعلومات والبرمجيات');
    var unionNameEn = getSetting('app_identity.union_name_en', 'IT WORKERS SYNDICATE');
    var logoUrl = getSetting('app_identity.logo_url', '');
    var committeeName = getSetting('app_identity.committee_name', '');
    var presidentName = getSetting('app_identity.president_name', 'المحاسب / محمود جميل');
    var presidentLabel = getSetting('app_identity.president_label', 'النقيب العام');
    var presidentPhoto = getSetting('app_identity.president_photo_url', '');
    var contactEmail = getSetting('app_identity.contact_email', 'info@itws.gov.eg');
    var contactPhone = getSetting('app_identity.contact_phone', '0223456789');
    var websiteUrl = getSetting('app_identity.website_url', '');

    // Union names
    $all('[data-site-name]').forEach(function (el) {
      setText(el, unionName);
    });
    $all('[data-setting="site_name_en"]').forEach(function (el) {
      setText(el, unionNameEn);
    });

    // Logo (nav + footer)
    var logoIds = [
      { img: 'navLogoImg', fb: 'navLogoFallback' },
      { img: 'footerLogoImg', fb: 'footerLogoFallback' }
    ];

    logoIds.forEach(function (item) {
      var img = document.getElementById(item.img);
      var fb = document.getElementById(item.fb);
      if (!img || !fb) return;

      if (logoUrl && img.dataset.currentSrc !== logoUrl) {
        img.dataset.currentSrc = logoUrl;
        img.onload = function () { img.style.display = 'block'; fb.style.display = 'none'; };
        img.onerror = function () { img.style.display = 'none'; fb.style.display = 'block'; };
        img.src = logoUrl;
      } else if (!logoUrl) {
        img.style.display = 'none';
        fb.style.display = 'block';
      }
    });

    // About logo
    var aboutImg = document.getElementById('aboutLogoImg');
    var aboutFb = document.getElementById('aboutLogoFallback');
    if (aboutImg && aboutFb) {
      var aboutLogo = getSetting('about_card_logo', logoUrl);
      if (aboutLogo && aboutImg.dataset.currentSrc !== aboutLogo) {
        aboutImg.dataset.currentSrc = aboutLogo;
        aboutImg.onload = function () { aboutImg.style.display = 'block'; aboutFb.style.display = 'none'; };
        aboutImg.onerror = function () { aboutImg.style.display = 'none'; aboutFb.style.display = 'block'; };
        aboutImg.src = aboutLogo;
      } else if (!aboutLogo) {
        aboutImg.style.display = 'none';
        aboutFb.style.display = 'block';
      }
    }

    // Head (president)
    $all('[data-head-name]').forEach(function (el) {
      setText(el, presidentName);
    });
    $all('[data-head-title]').forEach(function (el) {
      setText(el, presidentLabel);
    });

    var headImg = document.getElementById('headPhotoImg');
    var headFb = document.getElementById('headPhotoFallback');
    if (headImg && headFb) {
      if (presidentPhoto && headImg.dataset.currentSrc !== presidentPhoto) {
        headImg.dataset.currentSrc = presidentPhoto;
        headImg.onload = function () { headImg.style.display = 'block'; headFb.style.display = 'none'; };
        headImg.onerror = function () { headImg.style.display = 'none'; headFb.style.display = 'block'; };
        headImg.src = presidentPhoto;
      } else if (!presidentPhoto) {
        headImg.style.display = 'none';
        headFb.style.display = 'block';
      }
    }

    // Contact
    $all('[data-contact-email]').forEach(function (el) { setText(el, contactEmail); });
    $all('[data-contact-phone]').forEach(function (el) { setText(el, contactPhone); });
    $all('[data-contact-website]').forEach(function (el) { setText(el, websiteUrl); });

    // Footer copyright
    var copyright = getSetting('footer.copyright_text', '');
    if (!copyright) {
      copyright = '© ' + new Date().getFullYear() + ' ' + unionName + ' — جميع الحقوق محفوظة';
    }
    $all('[data-footer-text]').forEach(function (el) {
      setText(el, copyright);
    });

    // Committee name (if there's a place)
    $all('[data-committee-name]').forEach(function (el) {
      setText(el, committeeName);
    });
  }

  /* ============================================================
     4. APPLY HERO TEXT (with HTML support for gradient text)
     ============================================================ */

  function applyHeroText() {
    var heroBadge = getSetting('app_identity.hero_badge', '');
    var heroTitle1 = getSetting('app_identity.hero_title_1', '');
    var heroTitle2 = getSetting('app_identity.hero_title_2', '');
    var heroDesc = getSetting('app_identity.hero_description', '');
    var heroBtn1Text = getSetting('app_identity.hero_btn1_text', '');
    var heroBtn1Url = getSetting('app_identity.hero_btn1_url', '');
    var heroBtn2Text = getSetting('app_identity.hero_btn2_text', '');
    var heroBtn2Url = getSetting('app_identity.hero_btn2_url', '');

    var badgeEl = $('[data-setting="hero_badge"]');
    if (badgeEl && heroBadge) setText(badgeEl, heroBadge);

    var title1El = $('[data-setting="hero_title_1"]');
    if (title1El && heroTitle1) setText(title1El, heroTitle1);

    var title2El = $('[data-setting="hero_title_2"]');
    if (title2El && heroTitle2) setText(title2El, heroTitle2);

    var descEl = $('[data-setting="hero_description"]');
    if (descEl && heroDesc) setText(descEl, heroDesc);
  }

  /* ============================================================
     5. APPLY SECTION HEADINGS
     ============================================================ */

  function applySectionHeadings() {
    var sections = [
      { key: 'features_title', fallback: 'لماذا المنصة؟' },
      { key: 'features_subtitle', fallback: 'منظومة رقمية شاملة لخدمة أعضاء النقابة' },
      { key: 'services_title', fallback: 'خدمات المنصة' },
      { key: 'services_subtitle', fallback: 'كل ما تحتاجه للتحقق من الشهادات' },
      { key: 'steps_title', fallback: 'كيف تستخدم المنصة؟' },
      { key: 'steps_subtitle', fallback: '4 خطوات بسيطة للتحقق أو للانضمام' },
      { key: 'cta_title', fallback: 'هل تدير أكاديمية تدريبية؟' },
      { key: 'cta_subtitle', fallback: 'قدم طلب الاعتماد وانضم لقائمة الأكاديميات' }
    ];

    sections.forEach(function (s) {
      var els = $all('[data-setting="' + s.key + '"]');
      var val = getSetting('app_identity.' + s.key, null);
      if (val === null) val = getSetting(s.key, null);
      if (val) {
        els.forEach(function (el) { setText(el, val); });
      }
    });
  }

  /* ============================================================
     6. FETCH STATS
     ============================================================ */

  function fetchStats() {
    var sb = getSb();
    if (!sb) return Promise.resolve();

    Promise.all([
      sb.from('academies').select('id', { count: 'exact', head: true }).eq('status', 'approved').eq('is_deleted', false),
      sb.from('certificates').select('id', { count: 'exact', head: true }).eq('is_active', true).eq('is_revoked', false)
    ]).then(function (results) {
      var academies = (results[0] && typeof results[0].count === 'number') ? results[0].count : 0;
      var certificates = (results[1] && typeof results[1].count === 'number') ? results[1].count : 0;

      state.stats.academies = academies;
      state.stats.certificates = certificates;

      // Update counters in DOM if exist
      $all('[data-stat="academies"]').forEach(function (el) {
        animateNumber(el, academies);
      });
      $all('[data-stat="certificates"]').forEach(function (el) {
        animateNumber(el, certificates);
      });

      log('debug', 'Stats loaded', state.stats);
    }).catch(function (err) {
      log('debug', 'Stats fetch failed', err && err.message);
    });
  }

  function animateNumber(el, target) {
    if (!el) return;
    var current = parseInt(el.textContent.replace(/[^\d]/g, ''), 10) || 0;
    if (current === target) return;

    var duration = 1200;
    var start = Date.now();
    var diff = target - current;

    function step() {
      var elapsed = Date.now() - start;
      var progress = Math.min(elapsed / duration, 1);
      var eased = 1 - Math.pow(1 - progress, 3);
      var value = Math.round(current + diff * eased);
      el.textContent = value.toLocaleString('ar-EG');
      if (progress < 1) requestAnimationFrame(step);
    }
    requestAnimationFrame(step);
  }

  /* ============================================================
     7. REALTIME UPDATES
     ============================================================ */

  function setupRealtime() {
    if (!window.Realtime || typeof window.Realtime.subscribe !== 'function') return;

    try {
      // Settings changes
      state.realtimeUnsubs.push(window.Realtime.subscribe('settings', function () {
        applyAll();
      }, { debounce: 800 }));

      // Statistics changes
      state.realtimeUnsubs.push(window.Realtime.subscribe('academies', function () {
        fetchStats();
      }, { debounce: 1500 }));

      state.realtimeUnsubs.push(window.Realtime.subscribe('certificates', function () {
        fetchStats();
      }, { debounce: 1500 }));

    } catch (e) {
      log('error', 'Realtime setup failed', e);
    }
  }

  function cleanupRealtime() {
    state.realtimeUnsubs.forEach(function (u) {
      try { u(); } catch (e) {}
    });
    state.realtimeUnsubs = [];
  }

  /* ============================================================
     8. APPLY ALL
     ============================================================ */

  function applyAll() {
    try {
      applyDataSettings();
      applyBranding();
      applyHeroText();
      applySectionHeadings();
    } catch (e) {
      log('error', 'applyAll failed', e);
    }
  }

  /* ============================================================
     9. INIT
     ============================================================ */

  function init() {
    if (state._initialized) return;
    state._initialized = true;

    log('debug', 'Home page initializing');

    // Immediate apply with cached/default settings
    applyAll();

    // Retry on settings load
    if (window.AppSettings && typeof window.AppSettings.whenReady === 'function') {
      window.AppSettings.whenReady().then(function () {
        applyAll();
        fetchStats();
      }).catch(function () {});
    } else {
      fetchStats();
    }

    // Listen for settings changes
    if (window.AppSettings && typeof window.AppSettings.onChange === 'function') {
      state.settingsUnsub = window.AppSettings.onChange(function () {
        applyAll();
      });
    }

    // Listen for labels changes
    if (window.Labels && typeof window.Labels.onChange === 'function') {
      state.labelsUnsub = window.Labels.onChange(function () {
        applyAll();
      });
    }

    // Global events
    window.addEventListener('itws:settings-loaded', function () {
      applyAll();
      fetchStats();
    });

    window.addEventListener('itws:settings-changed', function () {
      applyAll();
    });

    // Retries in case settings load late
    setTimeout(applyAll, 500);
    setTimeout(applyAll, 1500);
    setTimeout(applyAll, 3000);

    // Realtime
    setTimeout(setupRealtime, 2500);

    // Cleanup
    if (typeof window.addEventListener === 'function') {
      window.addEventListener('beforeunload', cleanupRealtime);
    }

    log('debug', 'Home page ready');
  }

  /* ============================================================
     10. EXPORT
     ============================================================ */

  window.HomePage = {
    _initialized: true,
    init: init,
    refresh: applyAll,
    refreshStats: fetchStats,
    getState: function () {
      return {
        stats: state.stats,
        hasSettings: !!(window.AppSettings && window.AppSettings.isLoaded && window.AppSettings.isLoaded())
      };
    }
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  try {
    console.log('%c[Home]', 'color: #00f0ff; font-weight: bold;', 'Ready');
  } catch (e) {}

})();
