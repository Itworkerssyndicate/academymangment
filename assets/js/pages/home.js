/* ============================================================
   ITWS Platform — Home Page Logic
   File: assets/js/pages/home.js
   Role: Render hero, search, custom, about, academies, CTA, footer
   All content is pulled from Supabase.settings via AppSettings.get
   Rules: No emoji, no absolute paths, Cairo only, all dynamic
   ============================================================ */
(function () {
  'use strict';

  if (window.HomePage && window.HomePage.initialized) return;

  var state = {
    initialized: false,
    currentTab: 'certificate',
    academiesLoaded: false,
    sb: null
  };

  /* ---------------- Helpers ---------------- */
  function $(sel, ctx) { return (ctx || document).querySelector(sel); }
  function $all(sel, ctx) { return Array.prototype.slice.call((ctx || document).querySelectorAll(sel)); }
  function byData(name, ctx) { return $('[data-home="' + name + '"]', ctx); }

  function setText(el, v) {
    if (!el) return;
    el.textContent = (v == null ? '' : String(v));
  }

  function setHTML(el, v) {
    if (!el) return;
    el.innerHTML = v == null ? '' : String(v);
  }

  function show(el) { if (el) el.removeAttribute('hidden'); }
  function hide(el) { if (el) el.setAttribute('hidden', ''); }

  function escapeHtml(s) {
    if (s == null) return '';
    return String(s)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  function getSetting(path, fallback) {
    try {
      if (window.AppSettings && typeof window.AppSettings.get === 'function') {
        var v = window.AppSettings.get(path);
        return (v === undefined || v === null) ? fallback : v;
      }
    } catch (e) {}
    return fallback;
  }

  function getBool(path, fallback) {
    var v = getSetting(path, fallback);
    if (typeof v === 'boolean') return v;
    if (v === 'true' || v === 1 || v === '1') return true;
    if (v === 'false' || v === 0 || v === '0') return false;
    return !!v;
  }

  function resolve(path) {
    if (!path) return '#';
    if (window.resolveUrl) return window.resolveUrl(path);
    var base = (window.ITWS_CONFIG && window.ITWS_CONFIG.BASE_PATH) || '';
    if (base && base.charAt(base.length - 1) !== '/') base += '/';
    return base + String(path).replace(/^\.?\//, '');
  }

  function getSb() {
    return window.sb || window.supabaseClient || window.ITWS_SUPABASE || null;
  }

  function safe(url) {
    if (!url) return '';
    var u = String(url).trim();
    if (u.indexOf('javascript:') === 0) return '';
    if (u.indexOf('data:text/html') === 0) return '';
    return u;
  }

  /* ---------------- Hero ---------------- */
  function renderHero() {
    var badge = byData('hero-badge');
    var title = byData('hero-title');
    var subtitle = byData('hero-subtitle');

    var badgeText = getSetting('app_identity.hero_badge', '');
    if (badge) {
      if (badgeText) { setText(badge, badgeText); show(badge); }
      else hide(badge);
    }

    var titleText = getSetting('app_identity.hero_title', '');
    if (!titleText) {
      var union = getSetting('app_identity.union_name', 'نقابة تكنولوجيا المعلومات والبرمجيات');
      titleText = 'مرحباً بك في ' + union;
    }
    setText(title, titleText);

    var subtitleText = getSetting('app_identity.hero_subtitle', '');
    if (!subtitleText) {
      subtitleText = 'منصة رسمية للتحقق من الشهادات التدريبية واكتشاف الأكاديميات المعتمدة';
    }
    setText(subtitle, subtitleText);
  }

  /* ---------------- Search ---------------- */
  var SEARCH_CONFIG = {
    certificate: {
      id: 'certificate',
      placeholderKey: 'behavior.search_certificate_placeholder',
      placeholderDefault: 'NTI-2026-XXXXXX',
      hintKey: 'behavior.search_certificate_hint',
      hintDefault: 'أدخل كود الشهادة المطبوع عليها',
      minChars: 3,
      target: 'verify.html',
      param: 'code',
      dir: 'ltr'
    },
    trainee: {
      id: 'trainee',
      placeholderKey: 'behavior.search_trainee_placeholder',
      placeholderDefault: 'الرقم القومي (14 رقم)',
      hintKey: 'behavior.search_trainee_hint',
      hintDefault: 'أدخل الرقم القومي المكون من 14 رقماً',
      minChars: 14,
      target: 'student.html',
      param: 'q',
      dir: 'ltr'
    },
    academy: {
      id: 'academy',
      placeholderKey: 'behavior.search_academy_placeholder',
      placeholderDefault: 'اسم الأكاديمية أو التخصص',
      hintKey: 'behavior.search_academy_hint',
      hintDefault: 'ابحث عن أكاديمية معتمدة من النقابة',
      minChars: 2,
      target: 'academies.html',
      param: 'q',
      dir: 'rtl'
    }
  };

  function applySearchTab(tabId) {
    var cfg = SEARCH_CONFIG[tabId];
    if (!cfg) return;

    state.currentTab = tabId;

    var tabs = $all('[data-search-tab]');
    tabs.forEach(function (btn) {
      var isActive = btn.getAttribute('data-search-tab') === tabId;
      btn.classList.toggle('is-active', isActive);
      btn.setAttribute('aria-selected', isActive ? 'true' : 'false');
    });

    var input = $('#homeSearchInput');
    if (input) {
      input.value = '';
      input.setAttribute('dir', cfg.dir);
      input.setAttribute('placeholder', getSetting(cfg.placeholderKey, cfg.placeholderDefault));
      if (tabId === 'trainee') {
        input.setAttribute('inputmode', 'numeric');
        input.setAttribute('maxlength', '14');
      } else {
        input.removeAttribute('inputmode');
        input.setAttribute('maxlength', '40');
      }
    }

    var hint = byData('search-hint');
    setText(hint, getSetting(cfg.hintKey, cfg.hintDefault));
  }

  function handleSearchSubmit(e) {
    if (e) e.preventDefault();

    var input = $('#homeSearchInput');
    if (!input) return;

    var value = (input.value || '').trim();
    var cfg = SEARCH_CONFIG[state.currentTab];
    if (!cfg) return;

    if (value.length < cfg.minChars) {
      var hint = byData('search-hint');
      setText(hint, 'أدخل ' + (cfg.minChars === 14 ? '14 رقماً' : cfg.minChars + ' أحرف على الأقل'));
      input.focus();
      return;
    }

    var url;
    if (cfg.id === 'trainee') {
      url = resolve(cfg.target) + '?' + cfg.param + '=' + encodeURIComponent(value);
    } else if (cfg.id === 'certificate') {
      url = resolve(cfg.target) + '?' + cfg.param + '=' + encodeURIComponent(value.toUpperCase());
    } else {
      url = resolve(cfg.target) + '?' + cfg.param + '=' + encodeURIComponent(value);
    }

    window.location.href = url;
  }

  function initSearch() {
    var enabled = getBool('behavior.enable_search', true);
    var searchEl = byData('search');
    if (!enabled) {
      if (searchEl) hide(searchEl);
      return;
    }
    if (searchEl) show(searchEl);

    $all('[data-search-tab]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        applySearchTab(btn.getAttribute('data-search-tab'));
      });
    });

    var form = $('#homeSearchForm');
    if (form) form.addEventListener('submit', handleSearchSubmit);

    var submitBtn = $('#homeSearchBtn');
    if (submitBtn) {
      var btnText = getSetting('behavior.search_button_text', 'بحث');
      var span = $('[data-home="search-btn-text"]', submitBtn);
      setText(span, btnText);
    }

    applySearchTab('certificate');
  }

  /* ---------------- Custom Section ---------------- */
  function renderCustomSection() {
    var enabled = getBool('app_identity.custom_section.enabled', false) &&
                  getBool('behavior.home_show_custom_section', true);
    var section = byData('custom-section');
    if (!section) return;
    if (!enabled) { hide(section); return; }

    var title = getSetting('app_identity.custom_section.title', '');
    var subtitle = getSetting('app_identity.custom_section.subtitle', '');
    var content = getSetting('app_identity.custom_section.content', '');
    var btnText = getSetting('app_identity.custom_section.button_text', '');
    var btnUrl = safe(getSetting('app_identity.custom_section.button_url', ''));

    if (!title && !subtitle && !content && !btnText) { hide(section); return; }

    setText(byData('custom-title'), title);
    setText(byData('custom-subtitle'), subtitle);
    setText(byData('custom-content'), content);

    var btn = byData('custom-btn');
    if (btn) {
      if (btnText && btnUrl) {
        btn.href = resolve(btnUrl);
        btn.textContent = btnText;
        show(btn);
      } else {
        hide(btn);
      }
    }

    show(section);
  }

  /* ---------------- About Section ---------------- */
  var ABOUT_ICONS = [
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path><polyline points="22 4 12 14.01 9 11.01"></polyline></svg>',
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="16" x2="12" y2="12"></line><line x1="12" y1="8" x2="12.01" y2="8"></line></svg>',
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2L2 7l10 5 10-5-10-5z"></path><path d="M2 17l10 5 10-5"></path><path d="M2 12l10 5 10-5"></path></svg>'
  ];

  function renderAboutSection() {
    var enabled = getBool('app_identity.about_section.enabled', false) &&
                  getBool('behavior.home_show_about_section', true);
    var section = byData('about-section');
    if (!section) return;
    if (!enabled) { hide(section); return; }

    var title = getSetting('app_identity.about_section.title', '');
    var subtitle = getSetting('app_identity.about_section.subtitle', '');
    var features = getSetting('app_identity.about_section.features', []) || [];

    if (!title && !subtitle && (!features || !features.length)) { hide(section); return; }

    setText(byData('about-title'), title);
    setText(byData('about-subtitle'), subtitle);

    var grid = byData('about-features');
    if (grid) {
      grid.innerHTML = '';
      (features || []).forEach(function (f, idx) {
        if (!f || (!f.title && !f.description)) return;
        var card = document.createElement('div');
        card.className = 'home-about-card';
        var icon = ABOUT_ICONS[idx % ABOUT_ICONS.length];
        card.innerHTML =
          '<div class="home-about-icon">' + icon + '</div>' +
          '<h3 class="home-about-title">' + escapeHtml(f.title || '') + '</h3>' +
          '<p class="home-about-desc">' + escapeHtml(f.description || '') + '</p>';
        grid.appendChild(card);
      });
    }

    show(section);
  }

  /* ---------------- Recent Academies ---------------- */
  function renderAcademyCard(academy) {
    var card = document.createElement('a');
    card.className = 'academy-card';
    card.href = resolve('academy-details.html?id=' + encodeURIComponent(academy.id || ''));

    var logoHtml;
    if (academy.logo_url) {
      logoHtml = '<div class="academy-card-logo"><img src="' + escapeHtml(academy.logo_url) + '" alt="' + escapeHtml(academy.name || '') + '" loading="lazy" onerror="this.parentNode.textContent=\'أ\';"></div>';
    } else {
      var initial = (academy.name || 'أ').trim().charAt(0);
      logoHtml = '<div class="academy-card-logo">' + escapeHtml(initial) + '</div>';
    }

    var desc = academy.description || academy.short_description || '';
    card.innerHTML =
      logoHtml +
      '<div class="academy-card-body">' +
        '<h3 class="academy-card-title">' + escapeHtml(academy.name || 'أكاديمية') + '</h3>' +
        '<p class="academy-card-desc">' + escapeHtml(desc) + '</p>' +
      '</div>';

    return card;
  }

  function loadRecentAcademies() {
    var enabled = getBool('behavior.home_show_recent_academies', true);
    var section = byData('recent-academies');
    if (!section) return;
    if (!enabled) { hide(section); return; }

    var grid = $('#homeAcademiesGrid');
    if (!grid) return;

    // Loading
    grid.innerHTML = '<div class="home-academies-loading" style="grid-column:1/-1;"><div class="home-academies-spinner"></div></div>';
    show(section);

    var sb = getSb();
    if (!sb || typeof sb.from !== 'function') {
      grid.innerHTML = '<div class="home-academies-empty" style="grid-column:1/-1;">تعذر الاتصال بالخادم</div>';
      return;
    }

    var limit = parseInt(getSetting('behavior.home_stats_academies_count', 6), 10) || 6;

    try {
      sb.from('academies')
        .select('id, name, description, logo_url, status, created_at')
        .eq('status', 'approved')
        .order('created_at', { ascending: false })
        .limit(limit)
        .then(function (res) {
          if (res && res.error) throw res.error;
          var list = (res && res.data) || [];

          if (!list.length) {
            grid.innerHTML = '<div class="home-academies-empty" style="grid-column:1/-1;">لا توجد أكاديميات معتمدة بعد</div>';
            return;
          }

          grid.innerHTML = '';
          list.forEach(function (a) {
            grid.appendChild(renderAcademyCard(a));
          });
          state.academiesLoaded = true;
        })
        .catch(function (err) {
          console.warn('[Home] load academies failed:', err && err.message);
          grid.innerHTML = '<div class="home-academies-empty" style="grid-column:1/-1;">تعذر تحميل الأكاديميات</div>';
        });
    } catch (e) {
      console.warn('[Home] academies query error:', e);
      grid.innerHTML = '<div class="home-academies-empty" style="grid-column:1/-1;">خطأ في تحميل البيانات</div>';
    }
  }

  /* ---------------- CTA ---------------- */
  function renderCTA() {
    var title = getSetting('app_identity.cta_title', '') ||
                'هل تدير أكاديمية تدريبية؟';
    var subtitle = getSetting('app_identity.cta_subtitle', '') ||
                   'قدم طلب الاعتماد وانضم إلى قائمة الأكاديميات المعتمدة من النقابة';
    var btnText = getSetting('app_identity.cta_button_text', '') ||
                  'قدم أكاديميتك';
    var btnUrl = getSetting('app_identity.cta_button_url', '') ||
                 'academy-apply.html';

    setText(byData('cta-title'), title);
    setText(byData('cta-subtitle'), subtitle);
    setText(byData('cta-btn-text'), btnText);

    var btn = byData('cta-btn');
    if (btn) btn.href = resolve(btnUrl);
  }

  /* ---------------- Footer ---------------- */
  function renderFooter() {
    var unionName = getSetting('app_identity.union_name', '');
    var committeeName = getSetting('app_identity.committee_name', '');
    var logoUrl = getSetting('app_identity.logo_url', '');
    var presidentName = getSetting('app_identity.president_name', '');
    var presidentLabel = getSetting('app_identity.president_label', 'النقيب العام');

    // Logo
    var logo = byData('footer-logo');
    if (logo) {
      if (logoUrl) {
        logo.innerHTML = '<img src="' + escapeHtml(logoUrl) + '" alt="logo">';
      } else {
        logo.textContent = (unionName || 'ن').trim().charAt(0);
      }
    }

    setText(byData('footer-union'), unionName);
    setText(byData('footer-committee'), committeeName);

    // Contact
    var email = getSetting('app_identity.contact_email', '');
    var phone = getSetting('app_identity.contact_phone', '');
    var website = getSetting('app_identity.website_url', '');

    var emailEl = byData('footer-email');
    if (email && emailEl) {
      emailEl.href = 'mailto:' + email;
      setText(byData('footer-email-text'), email);
      show(emailEl);
    } else if (emailEl) {
      hide(emailEl);
    }

    var phoneEl = byData('footer-phone');
    if (phone && phoneEl) {
      phoneEl.href = 'tel:' + phone.replace(/[^0-9+]/g, '');
      setText(byData('footer-phone-text'), phone);
      show(phoneEl);
    } else if (phoneEl) {
      hide(phoneEl);
    }

    var websiteEl = byData('footer-website');
    if (website && websiteEl) {
      websiteEl.href = website;
      setText(byData('footer-website-text'), website.replace(/^https?:\/\//, '').replace(/\/$/, ''));
      show(websiteEl);
    } else if (websiteEl) {
      hide(websiteEl);
    }

    // Social
    var showSocial = getBool('footer.show_social_links', false);
    var socialWrap = byData('footer-social');
    if (showSocial && socialWrap) {
      var anyShown = false;
      var socials = [
        { key: 'footer.social_facebook', el: 'footer-facebook' },
        { key: 'footer.social_twitter', el: 'footer-twitter' },
        { key: 'footer.social_linkedin', el: 'footer-linkedin' },
        { key: 'footer.social_youtube', el: 'footer-youtube' }
      ];
      socials.forEach(function (s) {
        var el = byData(s.el);
        var url = getSetting(s.key, '');
        if (el) {
          if (url) {
            el.href = url;
            show(el);
            anyShown = true;
          } else {
            hide(el);
          }
        }
      });
      if (anyShown) show(socialWrap); else hide(socialWrap);
    } else if (socialWrap) {
      hide(socialWrap);
    }

    // Footer Link
    var flEnabled = getBool('app_identity.footer_link.enabled', false);
    var flText = getSetting('app_identity.footer_link.text', '');
    var flUrl = safe(getSetting('app_identity.footer_link.url', ''));
    var flWrap = byData('footer-link-wrap');
    if (flWrap) {
      if (flEnabled && flText && flUrl) {
        setText(byData('footer-link-text'), flText);
        var fl = byData('footer-link');
        if (fl) fl.href = resolve(flUrl);
        show(flWrap);
      } else {
        hide(flWrap);
      }
    }

    // Copyright
    var showCopyright = getBool('footer.show_copyright', true);
    var copyrightText = getSetting('footer.copyright_text', '');
    if (!copyrightText) {
      var year = new Date().getFullYear();
      copyrightText = '© ' + year + ' ' + (unionName || '');
    }
    var copyrightEl = byData('footer-copyright');
    if (copyrightEl) {
      if (showCopyright) {
        setText(copyrightEl, copyrightText);
        show(copyrightEl);
      } else {
        hide(copyrightEl);
      }
    }

    // President
    var showPresident = getBool('footer.show_president', true);
    var presidentWrap = byData('footer-president-wrap');
    if (presidentWrap) {
      if (showPresident && presidentName) {
        setText(byData('footer-president-label'), presidentLabel + ': ');
        setText(byData('footer-president-name'), presidentName);
        show(presidentWrap);
      } else {
        hide(presidentWrap);
      }
    }
  }

  /* ---------------- Theme FAB ---------------- */
  function getThemes() {
    if (window.ITWS_THEMES && Array.isArray(window.ITWS_THEMES)) {
      return window.ITWS_THEMES;
    }
    return [
      { id: 'watanii_dark', name: 'وطني داكن', colors: { primary: '#CE1126', bg: '#0A0E14', surface: '#131820' } },
      { id: 'watanii_light', name: 'وطني فاتح', colors: { primary: '#CE1126', bg: '#F8FAFC', surface: '#FFFFFF' } },
      { id: 'tech_blue', name: 'تكنولوجي', colors: { primary: '#3B82F6', bg: '#0F172A', surface: '#1E293B' } },
      { id: 'light_formal', name: 'رسمي فاتح', colors: { primary: '#1E40AF', bg: '#FFFFFF', surface: '#F3F4F6' } },
      { id: 'emerald', name: 'زمردي', colors: { primary: '#10B981', bg: '#0B1917', surface: '#122320' } },
      { id: 'midnight_gold', name: 'ليلي ذهبي', colors: { primary: '#D4AF37', bg: '#0B0B12', surface: '#161623' } }
    ];
  }

  function getCurrentTheme() {
    try {
      if (window.ITWSTheme && typeof window.ITWSTheme.getCurrent === 'function') {
        return window.ITWSTheme.getCurrent();
      }
    } catch (e) {}

    try {
      var stored = localStorage.getItem('itws_theme');
      if (stored) return stored;
    } catch (e) {}

    return document.documentElement.getAttribute('data-theme') || '';
  }

  function buildThemePanel() {
    var body = $('#themePanelBody');
    if (!body) return;
    body.innerHTML = '';

    var themes = getThemes();
    var current = getCurrentTheme();

    themes.forEach(function (t) {
      var btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'theme-option' + (t.id === current ? ' is-active' : '');
      btn.setAttribute('data-theme-option', t.id);

      var swatchColor = (t.colors && t.colors.primary) ? t.colors.primary : '#CE1126';
      var swatchBg = (t.colors && t.colors.bg) ? t.colors.bg : '#0A0E14';

      btn.innerHTML =
        '<span class="theme-swatch" style="background:linear-gradient(135deg,' + escapeHtml(swatchColor) + ' 50%,' + escapeHtml(swatchBg) + ' 50%);"></span>' +
        '<span class="theme-option-name">' + escapeHtml(t.name || t.id) + '</span>' +
        '<svg class="theme-option-check" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="20 6 9 17 4 12"></polyline></svg>';

      btn.addEventListener('click', function () {
        try {
          if (window.ITWSTheme && typeof window.ITWSTheme.change === 'function') {
            window.ITWSTheme.change(t.id);
          } else if (window.theme && typeof window.theme.change === 'function') {
            window.theme.change(t.id);
          } else if (typeof window.changeTheme === 'function') {
            window.changeTheme(t.id);
          } else {
            localStorage.setItem('itws_theme', t.id);
            document.documentElement.setAttribute('data-theme', t.id);
          }
        } catch (err) {
          console.warn('[Home] theme change failed:', err);
        }
        // Refresh active states
        $all('.theme-option', body).forEach(function (b) {
          b.classList.toggle('is-active', b.getAttribute('data-theme-option') === t.id);
        });
      });

      body.appendChild(btn);
    });
  }

  function initThemeFab() {
    var enabled = getBool('behavior.enable_theme_picker_for_visitors', true);
    var wrap = $('#themeFabWrap');
    if (!wrap) return;
    if (!enabled) { hide(wrap); return; }
    show(wrap);

    var fab = $('#themeFab');
    var panel = $('#themePanel');
    var close = $('#themePanelClose');
    var reset = $('#themeResetBtn');

    buildThemePanel();

    if (fab && panel) {
      fab.addEventListener('click', function (e) {
        e.stopPropagation();
        var isOpen = !panel.hasAttribute('hidden');
        if (isOpen) {
          panel.setAttribute('hidden', '');
          fab.setAttribute('aria-expanded', 'false');
        } else {
          buildThemePanel();
          panel.removeAttribute('hidden');
          fab.setAttribute('aria-expanded', 'true');
        }
      });
    }

    if (close && panel) {
      close.addEventListener('click', function () {
        panel.setAttribute('hidden', '');
        if (fab) fab.setAttribute('aria-expanded', 'false');
      });
    }

    document.addEventListener('click', function (e) {
      if (!wrap.contains(e.target) && panel && !panel.hasAttribute('hidden')) {
        panel.setAttribute('hidden', '');
        if (fab) fab.setAttribute('aria-expanded', 'false');
      }
    });

    if (reset) {
      reset.addEventListener('click', function () {
        try {
          var defaultTheme = getSetting('theme.default_theme', 'watanii_dark');
          if (window.ITWSTheme && typeof window.ITWSTheme.change === 'function') {
            window.ITWSTheme.change(defaultTheme);
          } else {
            localStorage.setItem('itws_theme', defaultTheme);
            document.documentElement.setAttribute('data-theme', defaultTheme);
          }
          $all('.theme-option').forEach(function (b) {
            b.classList.toggle('is-active', b.getAttribute('data-theme-option') === defaultTheme);
          });
        } catch (err) {
          console.warn('[Home] theme reset failed:', err);
        }
      });
    }
  }

  /* ---------------- Apply all ---------------- */
  function applyAll() {
    renderHero();
    renderCustomSection();
    renderAboutSection();
    renderCTA();
    renderFooter();
  }

  /* ---------------- Init ---------------- */
  function init() {
    if (state.initialized) return;
    state.initialized = true;

    state.sb = getSb();

    applyAll();
    initSearch();
    initThemeFab();
    loadRecentAcademies();

    // Re-apply on settings changes
    if (window.AppSettings && typeof window.AppSettings.onChange === 'function') {
      try {
        window.AppSettings.onChange(function () {
          applyAll();
        });
      } catch (e) {}
    }

    // Fallback retries (in case AppSettings loads late)
    setTimeout(applyAll, 600);
    setTimeout(applyAll, 1800);
    setTimeout(applyAll, 3500);
    setTimeout(loadRecentAcademies, 1500);
  }

  window.HomePage = {
    initialized: true,
    init: init,
    refresh: applyAll,
    reloadAcademies: loadRecentAcademies,
    getState: function () { return state; }
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
