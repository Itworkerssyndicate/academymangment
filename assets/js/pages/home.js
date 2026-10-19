// ============================================
// ITWS Platform - Home Page Logic
// Path: assets/js/pages/home.js
// ============================================

(function () {
  'use strict';

  if (window.HomePage && window.HomePage.initialized) return;

  var state = {
    currentTab: 'certificate',
    initialized: false,
    contentRetries: 0
  };

  var searchConfig = {
    certificate: {
      placeholder: 'أدخل كود الشهادة...',
      hint: 'أدخل كود الشهادة المطبوع عليها',
      url: 'verify.html?code=',
      validate: function (v) { return v.length >= 4; },
      errorMsg: 'أدخل كود شهادة صحيح (4 أحرف على الأقل)'
    },
    student: {
      placeholder: 'أدخل الرقم القومي (14 رقم)...',
      hint: 'ابحث بالرقم القومي لعرض كل الشهادات',
      url: 'student.html?id=',
      validate: function (v) { return /^\d{14}$/.test(v); },
      errorMsg: 'الرقم القومي يجب أن يكون 14 رقم'
    },
    academy: {
      placeholder: 'اسم الأكاديمية أو الرقم الاعتمادي...',
      hint: 'ابحث باسم الأكاديمية أو رقم اعتمادها',
      url: 'academies.html?search=',
      validate: function (v) { return v.length >= 2; },
      errorMsg: 'أدخل اسم أكاديمية أو رقم اعتماد'
    }
  };

  function $(id) { return document.getElementById(id); }
  function setText(id, t) {
    var el = $(id);
    if (el) el.textContent = t;
  }

  function escapeHtml(s) {
    if (s == null) return '';
    return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#039;');
  }

  function getSetting(path, fallback) {
    if (window.AppSettings && window.AppSettings.get) {
      return window.AppSettings.get(path, fallback);
    }
    if (window.ITWS_SETTINGS_DEFAULTS) {
      var parts = path.split('.');
      var value = window.ITWS_SETTINGS_DEFAULTS;
      for (var i = 0; i < parts.length; i++) {
        if (value && typeof value === 'object') value = value[parts[i]];
        else { value = undefined; break; }
      }
      if (value !== undefined) return value;
    }
    return fallback;
  }

  function showError(msg) {
    if (window.Utils && window.Utils.showToast) window.Utils.showToast(msg, 'error');
    else alert(msg);
  }

  // ============================================
  // 1. المحتوى الديناميكي
  // ============================================
  function applyDynamicContent() {
    var unionName = getSetting('app_identity.union_name', 'نقابة تكنولوجيا المعلومات والبرمجيات');
    var committeeName = getSetting('app_identity.committee_name', 'لجنة التحول الرقمي والتدريب');
    var presidentName = getSetting('app_identity.president_name', 'المحاسب / محمود جميل');
    var presidentLabel = getSetting('app_identity.president_label', 'النقيب العام:');
    var footerText = getSetting('app_identity.footer_text', '© 2026 نقابة تكنولوجيا المعلومات والبرمجيات');
    var contactEmail = getSetting('app_identity.contact_email', 'info@itws.eg');
    var contactPhone = getSetting('app_identity.contact_phone', '01234567890');
    var websiteUrl = getSetting('app_identity.website_url', 'https://itws.eg');
    var logoUrl = getSetting('app_identity.logo_url', null);

    setText('footerUnionName', unionName);
    setText('footerCommitteeName', committeeName);
    setText('footerCopyright', footerText);
    setText('footerPresidentLabel', presidentLabel);
    setText('footerPresidentName', presidentName);

    var emailEl = $('footerEmail');
    if (emailEl) { emailEl.textContent = contactEmail; emailEl.href = 'mailto:' + contactEmail; }
    var phoneEl = $('footerPhone');
    if (phoneEl) { phoneEl.textContent = contactPhone; phoneEl.href = 'tel:' + contactPhone; }
    var websiteEl = $('footerWebsite');
    if (websiteEl) { websiteEl.textContent = String(websiteUrl).replace(/^https?:\/\//, ''); websiteEl.href = websiteUrl; websiteEl.target = '_blank'; }

    if (logoUrl) {
      var logoEl = $('footerLogo');
      if (logoEl) logoEl.innerHTML = '<img src="' + escapeHtml(logoUrl) + '" alt="">';
    }

    // Footer Link (زر اللينك)
    applyFooterLink();

    // About Section
    applyAboutSection();

    // Custom Section
    applyCustomSection();

    // Hero
    var heroTitle = getSetting('app_identity.hero_title', '');
    if (heroTitle && heroTitle.trim()) {
      var ht = $('heroTitle');
      if (ht) ht.innerHTML = heroTitle;
    }
    var heroSubtitle = getSetting('app_identity.hero_subtitle', '');
    if (heroSubtitle && heroSubtitle.trim()) {
      setText('heroSubtitle', heroSubtitle);
    }
  }

  // ============================================
  // 2. Footer Link (زر تحت الفوتر)
  // ============================================
  function applyFooterLink() {
    var footerLink = getSetting('app_identity.footer_link', null);
    var footerLinkEl = $('footerLink');
    var footerLinkTextEl = $('footerLinkText');

    if (!footerLinkEl) return;

    // إظهار الزر لو footer_link موجود + enabled + فيه نص
    if (footerLink && footerLink.enabled !== false && footerLink.text) {
      if (footerLinkTextEl) footerLinkTextEl.textContent = footerLink.text;
      footerLinkEl.href = footerLink.url || '#';
      footerLinkEl.style.display = 'inline-flex';
      footerLinkEl.style.visibility = 'visible';
    } else {
      footerLinkEl.style.display = 'none';
    }
  }

  // ============================================
  // 3. About Section
  // ============================================
  function applyAboutSection() {
    var showAbout = getSetting('behavior.home_show_about_section', true);
    var about = getSetting('app_identity.about_section', null);
    var sec = $('aboutSection');

    if (!showAbout || !about || about.enabled === false) {
      if (sec) sec.style.display = 'none';
      return;
    }

    if (sec) sec.style.display = 'block';
    setText('aboutTitle', about.title || 'لماذا هذه المنصة؟');
    setText('aboutSubtitle', about.subtitle || '');

    var container = $('aboutFeatures');
    if (!container) return;

    var features = about.features || [];
    if (features.length === 0) {
      container.innerHTML = '';
      return;
    }

    container.innerHTML = features.map(function (f) {
      return '' +
        '<div class="about-feature">' +
          '<h3 class="about-feature-title">' + escapeHtml(f.title || '') + '</h3>' +
          '<p class="about-feature-desc">' + escapeHtml(f.description || '') + '</p>' +
        '</div>';
    }).join('');
  }

  // ============================================
  // 4. Custom Section (قسم مخصص)
  // ============================================
  function applyCustomSection() {
    var showCustom = getSetting('behavior.home_show_custom_section', true);
    var custom = getSetting('app_identity.custom_section', null);
    var sec = $('customSection');

    if (!showCustom || !custom || custom.enabled === false) {
      if (sec) sec.style.display = 'none';
      return;
    }

    if (sec) sec.style.display = 'block';

    setText('customTitle', custom.title || '');
    setText('customSubtitle', custom.subtitle || '');

    var contentEl = $('customContent');
    if (contentEl) {
      // نسمح بـ HTML بسيط لكن نعمل escape للنصوص العادية
      if (custom.content) {
        contentEl.innerHTML = escapeHtml(custom.content).replace(/\n/g, '<br>');
      } else {
        contentEl.style.display = 'none';
      }
    }

    // زر القسم المخصص
    var btnEl = $('customBtn');
    var btnTextEl = $('customBtnText');
    if (custom.button_text && custom.button_url && btnEl) {
      if (btnTextEl) btnTextEl.textContent = custom.button_text;
      btnEl.href = custom.button_url;
      btnEl.style.display = 'inline-flex';
    } else if (btnEl) {
      btnEl.style.display = 'none';
    }
  }

  // ============================================
  // 5. التبويبات
  // ============================================
  function switchTab(tab) {
    if (!searchConfig[tab] || tab === state.currentTab) return;
    state.currentTab = tab;

    document.querySelectorAll('.search-tab').forEach(function (el) {
      el.classList.toggle('active', el.getAttribute('data-tab') === tab);
    });

    var cfg = searchConfig[tab];
    var form = $('searchForm');
    var input = $('searchInput');
    var hint = $('searchHint');

    if (form) form.classList.add('switching-out');
    if (hint) hint.style.opacity = '0';

    setTimeout(function () {
      if (input) {
        input.placeholder = cfg.placeholder;
        input.value = '';
        if (tab === 'student') {
          input.setAttribute('inputmode', 'numeric');
          input.setAttribute('maxlength', '14');
        } else {
          input.removeAttribute('inputmode');
          input.removeAttribute('maxlength');
        }
      }
      if (hint) {
        hint.textContent = cfg.hint;
        hint.style.opacity = '1';
      }
      if (form) {
        form.classList.remove('switching-out');
        form.classList.add('switching-in');
        setTimeout(function () { form.classList.remove('switching-in'); }, 50);
      }

      if (input) input.focus();
    }, 200);
  }

  function bindTabs() {
    document.querySelectorAll('.search-tab').forEach(function (el) {
      el.addEventListener('click', function () {
        switchTab(el.getAttribute('data-tab'));
      });
    });
  }

  // ============================================
  // 6. البحث
  // ============================================
  function handleSearch(e) {
    if (e) e.preventDefault();
    var input = $('searchInput');
    var value = input ? input.value.trim() : '';
    var cfg = searchConfig[state.currentTab];

    if (!cfg.validate(value)) {
      showError(cfg.errorMsg);
      if (input) input.focus();
      return false;
    }

    var btn = $('searchBtn');
    if (btn) { btn.disabled = true; btn.textContent = 'جاري البحث...'; }

    window.location.href = cfg.url + encodeURIComponent(value);
    return false;
  }

  // ============================================
  // 7. الأكاديميات
  // ============================================
  function loadRecentAcademies() {
    if (!window.sb) return;
    if (!getSetting('behavior.home_show_recent_academies', true)) {
      var sec = $('academiesSection');
      if (sec) sec.style.display = 'none';
      return;
    }

    var limit = getSetting('behavior.home_stats_academies_count', 6);
    var grid = $('academiesGrid');
    if (!grid) return;

    window.sb.from('academies')
      .select('id, name, license_number, category_id, logo_url')
      .eq('status', 'approved')
      .eq('is_deleted', false)
      .order('created_at', { ascending: false })
      .limit(limit)
      .then(function (res) {
        if (res.error || !res.data || res.data.length === 0) {
          grid.innerHTML = '<div class="empty-section">لا توجد أكاديميات معتمدة بعد</div>';
          return;
        }
        renderAcademies(res.data, grid);
      })
      .catch(function () {
        grid.innerHTML = '<div class="empty-section">تعذر تحميل الأكاديميات</div>';
      });
  }

  function renderAcademies(academies, grid) {
    window.sb.from('academy_categories').select('id, name').then(function (catRes) {
      var cats = {};
      if (catRes.data) catRes.data.forEach(function (c) { cats[c.id] = c; });
      renderAcademiesGrid(academies, cats, grid);
    }).catch(function () {
      renderAcademiesGrid(academies, {}, grid);
    });
  }

  function renderAcademiesGrid(academies, cats, grid) {
    var html = academies.map(function (a) {
      var initial = escapeHtml((a.name || '?').charAt(0));
      var cat = cats[a.category_id];
      var logoHtml = a.logo_url
        ? '<img src="' + escapeHtml(a.logo_url) + '" alt="">'
        : initial;

      return '' +
        '<div class="academy-card" data-academy-id="' + escapeHtml(a.id) + '" role="button" tabindex="0">' +
          '<div class="academy-card-header">' +
            '<div class="academy-logo">' + logoHtml + '</div>' +
            '<span class="academy-badge">معتمدة</span>' +
          '</div>' +
          '<div class="academy-body">' +
            '<div class="academy-name">' + escapeHtml(a.name) + '</div>' +
            (cat ? '<div class="academy-category">' + escapeHtml(cat.name) + '</div>' : '') +
          '</div>' +
          '<div class="academy-footer">' +
            '<span class="academy-license">' + escapeHtml(a.license_number || '—') + '</span>' +
            '<span class="academy-arrow">&#8592;</span>' +
          '</div>' +
        '</div>';
    }).join('');

    grid.innerHTML = html;

    grid.querySelectorAll('[data-academy-id]').forEach(function (card) {
      card.addEventListener('click', function () {
        var id = card.getAttribute('data-academy-id');
        window.location.href = 'academy-details.html?id=' + encodeURIComponent(id);
      });
      card.addEventListener('keydown', function (e) {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          var id = card.getAttribute('data-academy-id');
          window.location.href = 'academy-details.html?id=' + encodeURIComponent(id);
        }
      });
    });
  }

  // ============================================
  // 8. Theme Picker (مع fallback)
  // ============================================
  function initThemePicker() {
    if (!getSetting('behavior.enable_theme_picker_for_visitors', true)) {
      var fab = $('themeFab');
      if (fab) fab.style.display = 'none';
      return;
    }

    var fab = $('themeFab');
    var panel = $('themePanel');
    var closeBtn = $('themePanelClose');
    var resetBtn = $('themeReset');
    var listEl = $('themeList');

    if (!fab || !panel || !listEl) return;

    var themes = window.getThemesList ? window.getThemesList() : [];
    listEl.innerHTML = themes.map(function (t) {
      var swatches = (t.preview || []).map(function (c) {
        return '<span class="theme-swatch" style="background:' + c + '"></span>';
      }).join('');
      return '' +
        '<button class="theme-option" data-theme-option="' + escapeHtml(t.id) + '" type="button">' +
          '<div class="theme-swatches">' + swatches + '</div>' +
          '<span class="theme-name">' + escapeHtml(t.name) + '</span>' +
        '</button>';
    }).join('');

    if (window.ThemeManager) window.ThemeManager.refreshPicker();

    // Bind theme options (fallback - مستقل عن theme.js)
    bindThemeOptions();

    fab.addEventListener('click', function (e) {
      e.stopPropagation();
      panel.classList.toggle('open');
    });

    if (closeBtn) closeBtn.addEventListener('click', function () { panel.classList.remove('open'); });

    if (resetBtn) {
      resetBtn.addEventListener('click', function () {
        if (window.ThemeManager) {
          window.ThemeManager.reset().then(function () {
            if (window.Utils && window.Utils.showToast) {
              window.Utils.showToast('تم استعادة الثيم الافتراضي', 'success');
            }
          });
        }
      });
    }

    document.addEventListener('click', function (e) {
      if (panel.classList.contains('open') && !panel.contains(e.target) && !fab.contains(e.target)) {
        panel.classList.remove('open');
      }
    });

    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && panel.classList.contains('open')) {
        panel.classList.remove('open');
      }
    });
  }

  // Fallback: event delegation على theme-list (يشتغل دايماً)
  function bindThemeOptions() {
    var listEl = $('themeList');
    if (!listEl) return;
    if (listEl.__themeBound) return;
    listEl.__themeBound = true;

    listEl.addEventListener('click', function (e) {
      var btn = e.target.closest ? e.target.closest('[data-theme-option]') : null;
      if (!btn) return;
      var themeId = btn.getAttribute('data-theme-option');
      if (!themeId) return;

      if (window.ThemeManager && window.ThemeManager.change) {
        window.ThemeManager.change(themeId);
      } else if (window.ITWS_THEMES && window.ITWS_THEMES[themeId]) {
        // fallback: تطبيق مباشر
        var theme = window.ITWS_THEMES[themeId];
        var root = document.documentElement;
        Object.keys(theme.colors).forEach(function (k) {
          root.style.setProperty('--' + k, theme.colors[k]);
        });
        try {
          localStorage.setItem('itws_theme', JSON.stringify({ id: themeId, colors: theme.colors }));
        } catch (err) {}
        // تحديث UI
        listEl.querySelectorAll('[data-theme-option]').forEach(function (el) {
          el.classList.toggle('active', el.getAttribute('data-theme-option') === themeId);
        });
      }
    });
  }

  // ============================================
  // 9. Init
  // ============================================
  function init() {
    if (state.initialized) return;
    state.initialized = true;

    applyDynamicContent();
    bindTabs();
    initThemePicker();

    var searchForm = $('searchForm');
    if (searchForm) searchForm.addEventListener('submit', handleSearch);

    var input = $('searchInput');
    if (input) {
      input.addEventListener('keydown', function (e) {
        if (e.key === 'Enter') { e.preventDefault(); handleSearch(); }
      });
    }

    // الاستماع لتغييرات الإعدادات
    if (window.AppSettings && window.AppSettings.onChange) {
      window.AppSettings.onChange(function () {
        applyDynamicContent();
      });
    }

    // إعادة المحاولة للتأكد من تحديث القيم (بعد Supabase load)
    var retryTimes = [500, 1500, 3000, 5000];
    retryTimes.forEach(function (t) {
      setTimeout(function () {
        if (state.contentRetries < 10) {
          state.contentRetries++;
          applyDynamicContent();
        }
      }, t);
    });

    // تحميل الأكاديميات
    waitForSupabase(function () {
      loadRecentAcademies();
    });
  }

  function waitForSupabase(cb) {
    if (window.sb) { cb(); return; }
    var w = 0;
    var i = setInterval(function () {
      w += 100;
      if (window.sb || w >= 3000) {
        clearInterval(i);
        if (window.sb) cb();
      }
    }, 100);
  }

  window.HomePage = {
    initialized: true,
    init: init,
    switchTab: switchTab,
    refresh: function () { loadRecentAcademies(); }
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

})();
