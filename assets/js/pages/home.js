// ============================================
// [20/50] ITWS Platform - Home Page Logic
// Path: assets/js/pages/home.js
// ============================================
// 💡 منطق الصفحة الرئيسية
// 💡 البحث (3 أنواع) + إحصائيات حية + أكاديميات + ثيمات
// 💡 يعتمد على: AppSettings, ThemeManager, SessionManager
// ============================================

(function () {
  'use strict';

  // ============ حماية من التهيئة المكررة ============
  if (window.HomePage && window.HomePage.initialized) return;

  // ============ حالة داخلية ============
  var state = {
    currentTab: 'certificate',
    statsInterval: null,
    initialized: false
  };

  // ============ إعدادات البحث (3 أنواع) ============
  var searchConfig = {
    certificate: {
      placeholder: 'أدخل كود الشهادة...',
      hint: 'أدخل كود الشهادة المطبوع عليها',
      url: '/verify.html?code=',
      validate: function (v) { return v.length >= 4; },
      errorMsg: 'أدخل كود شهادة صحيح (4 أحرف على الأقل)'
    },
    student: {
      placeholder: 'أدخل الرقم القومي (14 رقم)...',
      hint: 'ابحث بالرقم القومي لعرض كل الشهادات',
      url: '/student.html?id=',
      validate: function (v) { return /^\d{14}$/.test(v); },
      errorMsg: 'الرقم القومي يجب أن يكون 14 رقم'
    },
    academy: {
      placeholder: 'اسم الأكاديمية أو الرقم الاعتمادي...',
      hint: 'ابحث باسم الأكاديمية أو رقم اعتمادها',
      url: '/academies.html?search=',
      validate: function (v) { return v.length >= 2; },
      errorMsg: 'أدخل اسم أكاديمية أو رقم اعتماد'
    }
  };

  // ============================================
  // 1. Helpers
  // ============================================
  function $(id) { return document.getElementById(id); }

  function setText(id, text) {
    var el = $(id);
    if (el) el.textContent = text;
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

  function formatNumber(n) {
    if (n == null) return '—';
    if (n < 1000) return n.toString();
    if (n < 1000000) return (n / 1000).toFixed(1).replace(/\.0$/, '') + 'K';
    return (n / 1000000).toFixed(1).replace(/\.0$/, '') + 'M';
  }

  function getSetting(path, fallback) {
    if (window.AppSettings && window.AppSettings.get) {
      return window.AppSettings.get(path, fallback);
    }
    return fallback;
  }

  function showError(msg) {
    if (window.Utils && window.Utils.showToast) {
      window.Utils.showToast(msg, 'error');
    } else {
      alert(msg);
    }
  }

  function showSuccess(msg) {
    if (window.Utils && window.Utils.showToast) {
      window.Utils.showToast(msg, 'success');
    }
  }

  // ============================================
  // 2. تطبيق المحتوى الديناميكي
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

    // Footer
    setText('footerUnionName', unionName);
    setText('footerCommitteeName', committeeName);
    setText('footerCopyright', footerText);
    setText('footerPresidentLabel', presidentLabel);
    setText('footerPresidentName', presidentName);

    // Contact
    var emailEl = $('footerEmail');
    if (emailEl) {
      emailEl.textContent = contactEmail;
      emailEl.href = 'mailto:' + contactEmail;
    }

    var phoneEl = $('footerPhone');
    if (phoneEl) {
      phoneEl.textContent = contactPhone;
      phoneEl.href = 'tel:' + contactPhone;
    }

    var websiteEl = $('footerWebsite');
    if (websiteEl) {
      websiteEl.textContent = String(websiteUrl).replace(/^https?:\/\//, '');
      websiteEl.href = websiteUrl;
      websiteEl.target = '_blank';
      websiteEl.rel = 'noopener noreferrer';
    }

    // Logo
    if (logoUrl) {
      var logoEl = $('footerLogo');
      if (logoEl) {
        logoEl.innerHTML = '<img src="' + escapeHtml(logoUrl) + '" alt="' + escapeHtml(unionName) + '">';
      }
    }

    // Hero title/subtitle (لو مخصصين في الإعدادات)
    var heroTitle = getSetting('app_identity.hero_title', null);
    if (heroTitle) {
      var heroTitleEl = $('heroTitle');
      if (heroTitleEl) heroTitleEl.innerHTML = heroTitle;
    }

    var heroSubtitle = getSetting('app_identity.hero_subtitle', null);
    if (heroSubtitle) {
      setText('heroSubtitle', heroSubtitle);
    }
  }

  // ============================================
  // 3. التبويبات (Tabs)
  // ============================================
  function switchTab(tab) {
    if (!searchConfig[tab]) return;
    state.currentTab = tab;

    // Active state
    document.querySelectorAll('.search-tab').forEach(function (el) {
      el.classList.toggle('active', el.getAttribute('data-tab') === tab);
    });

    var cfg = searchConfig[tab];
    var input = $('searchInput');
    var hint = $('searchHint');

    if (input) {
      input.placeholder = cfg.placeholder;
      input.value = '';

      if (tab === 'student') {
        input.setAttribute('inputmode', 'numeric');
        input.setAttribute('maxlength', '14');
        input.setAttribute('pattern', '[0-9]{14}');
        input.setAttribute('type', 'text');
      } else {
        input.removeAttribute('inputmode');
        input.removeAttribute('maxlength');
        input.removeAttribute('pattern');
        input.setAttribute('type', 'text');
      }
    }

    if (hint) hint.textContent = cfg.hint;

    if (input) {
      setTimeout(function () { input.focus(); }, 50);
    }
  }

  function bindTabs() {
    document.querySelectorAll('.search-tab').forEach(function (el) {
      el.addEventListener('click', function () {
        switchTab(el.getAttribute('data-tab'));
      });
    });
  }

  // ============================================
  // 4. البحث
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

    // Loading state
    var btn = $('searchBtn');
    if (btn) {
      btn.disabled = true;
      btn.innerHTML = '<span>جاري البحث...</span>';
    }

    // Redirect
    window.location.href = cfg.url + encodeURIComponent(value);
    return false;
  }

  function bindSearchForm() {
    var form = $('searchForm');
    if (form) {
      form.addEventListener('submit', handleSearch);
    }

    // Enter key (للاحتياط)
    var input = $('searchInput');
    if (input) {
      input.addEventListener('keydown', function (e) {
        if (e.key === 'Enter') {
          e.preventDefault();
          handleSearch();
        }
      });
    }
  }

  // ============================================
  // 5. الإحصائيات الحية
  // ============================================
  function loadStats() {
    if (!window.sb) return;

    // (أ) عدد الأكاديميات المعتمدة
    window.sb
      .from('academies')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'approved')
      .eq('is_deleted', false)
      .then(function (res) {
        var el = $('statAcademies');
        if (el && !res.error) {
          el.textContent = formatNumber(res.count || 0);
          el.classList.remove('loading');
        }
      })
      .catch(function () {
        var el = $('statAcademies');
        if (el) {
          el.textContent = '0';
          el.classList.remove('loading');
        }
      });

    // (ب) عدد الشهادات النشطة
    window.sb
      .from('certificates')
      .select('*', { count: 'exact', head: true })
      .eq('is_active', true)
      .then(function (res) {
        var el = $('statCertificates');
        if (el && !res.error) {
          el.textContent = formatNumber(res.count || 0);
          el.classList.remove('loading');
        }
      })
      .catch(function () {
        var el = $('statCertificates');
        if (el) {
          el.textContent = '0';
          el.classList.remove('loading');
        }
      });

    // (ج) الزوار الحاليون — تحديث كل 30 ثانية
    updateOnlineCount();
    if (state.statsInterval) clearInterval(state.statsInterval);
    state.statsInterval = setInterval(updateOnlineCount, 30000);
  }

  function updateOnlineCount() {
    if (window.SessionManager && window.SessionManager.getOnlineCount) {
      window.SessionManager.getOnlineCount().then(function (count) {
        var el = $('statOnline');
        if (el) {
          el.textContent = formatNumber(count);
          el.classList.remove('loading');
        }
      }).catch(function () {
        var el = $('statOnline');
        if (el) {
          el.textContent = '0';
          el.classList.remove('loading');
        }
      });
    } else {
      var el = $('statOnline');
      if (el) {
        el.textContent = '0';
        el.classList.remove('loading');
      }
    }
  }

  // ============================================
  // 6. آخر الأكاديميات
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

    window.sb
      .from('academies')
      .select('id, name, license_number, category_id, logo_url, created_at')
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
    // نجيب التصنيفات
    window.sb
      .from('academy_categories')
      .select('id, name, color')
      .then(function (catRes) {
        var categories = {};
        if (catRes.data) {
          catRes.data.forEach(function (c) { categories[c.id] = c; });
        }

        var html = academies.map(function (a) {
          var initial = (a.name || '؟').charAt(0);
          var cat = categories[a.category_id];
          var logoHtml = a.logo_url
            ? '<img src="' + escapeHtml(a.logo_url) + '" alt="" style="width:100%;height:100%;object-fit:cover;border-radius:12px;">'
            : escapeHtml(initial);

          return '' +
            '<div class="academy-card" data-academy-id="' + escapeHtml(a.id) + '" role="button" tabindex="0">' +
              '<div class="academy-card-header">' +
                '<div class="academy-logo">' + logoHtml + '</div>' +
                '<span class="academy-badge">✓ معتمدة</span>' +
              '</div>' +
              '<div>' +
                '<div class="academy-name">' + escapeHtml(a.name) + '</div>' +
                (cat ? '<div class="academy-category">' + escapeHtml(cat.name) + '</div>' : '') +
              '</div>' +
              '<div class="academy-footer">' +
                '<span class="academy-footer-stat">🔑 ' + escapeHtml(a.license_number || '—') + '</span>' +
                '<span>→</span>' +
              '</div>' +
            '</div>';
        }).join('');

        grid.innerHTML = html;

        // Event delegation للكليك
        grid.querySelectorAll('[data-academy-id]').forEach(function (card) {
          card.addEventListener('click', function () {
            var id = card.getAttribute('data-academy-id');
            window.location.href = '/academy-details.html?id=' + encodeURIComponent(id);
          });

          card.addEventListener('keydown', function (e) {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              var id = card.getAttribute('data-academy-id');
              window.location.href = '/academy-details.html?id=' + encodeURIComponent(id);
            }
          });
        });
      })
      .catch(function () {
        // Fallback: نعرض بدون تصنيفات
        renderAcademiesFallback(academies, grid);
      });
  }

  function renderAcademiesFallback(academies, grid) {
    var html = academies.map(function (a) {
      var initial = (a.name || '؟').charAt(0);
      var logoHtml = a.logo_url
        ? '<img src="' + escapeHtml(a.logo_url) + '" alt="" style="width:100%;height:100%;object-fit:cover;border-radius:12px;">'
        : escapeHtml(initial);

      return '' +
        '<div class="academy-card" data-academy-id="' + escapeHtml(a.id) + '" role="button" tabindex="0">' +
          '<div class="academy-card-header">' +
            '<div class="academy-logo">' + logoHtml + '</div>' +
            '<span class="academy-badge">✓ معتمدة</span>' +
          '</div>' +
          '<div>' +
            '<div class="academy-name">' + escapeHtml(a.name) + '</div>' +
          '</div>' +
          '<div class="academy-footer">' +
            '<span class="academy-footer-stat">🔑 ' + escapeHtml(a.license_number || '—') + '</span>' +
            '<span>→</span>' +
          '</div>' +
        '</div>';
    }).join('');

    grid.innerHTML = html;

    grid.querySelectorAll('[data-academy-id]').forEach(function (card) {
      card.addEventListener('click', function () {
        var id = card.getAttribute('data-academy-id');
        window.location.href = '/academy-details.html?id=' + encodeURIComponent(id);
      });
    });
  }

  // ============================================
  // 7. Theme Picker (FAB + Panel)
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

    // بناء القائمة
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

    // تحديث الحالة النشطة
    if (window.ThemeManager) {
      window.ThemeManager.refreshPicker();
    }

    // Toggle panel
    fab.addEventListener('click', function (e) {
      e.stopPropagation();
      panel.classList.toggle('open');
    });

    // Close
    if (closeBtn) {
      closeBtn.addEventListener('click', function () {
        panel.classList.remove('open');
      });
    }

    // Reset
    if (resetBtn) {
      resetBtn.addEventListener('click', function () {
        if (window.ThemeManager) {
          window.ThemeManager.reset().then(function () {
            showSuccess('تم استعادة الثيم الافتراضي');
          });
        }
      });
    }

    // Click outside
    document.addEventListener('click', function (e) {
      if (panel.classList.contains('open') &&
          !panel.contains(e.target) &&
          !fab.contains(e.target)) {
        panel.classList.remove('open');
      }
    });

    // Esc to close
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && panel.classList.contains('open')) {
        panel.classList.remove('open');
      }
    });
  }

  // ============================================
  // 8. Init
  // ============================================
  function init() {
    if (state.initialized) return;
    state.initialized = true;

    // 1. المحتوى الديناميكي
    applyDynamicContent();

    // 2. التبويبات
    bindTabs();

    // 3. الفورم
    bindSearchForm();

    // 4. Theme picker
    initThemePicker();

    // 5. الاستماع لتغييرات الإعدادات
    if (window.AppSettings && window.AppSettings.onChange) {
      window.AppSettings.onChange(function (cache, changedKey) {
        // لو الإعدادات اتحدثت → نعيد تطبيق المحتوى
        if (!changedKey || changedKey === 'app_identity') {
          applyDynamicContent();
        }
      });
    }

    // 6. تحميل الإحصائيات والأكاديميات بعد تأكد Supabase
    waitForSupabase(function () {
      loadStats();
      loadRecentAcademies();
    });

    // 7. Log
    logDebug('Home page initialized');
  }

  function waitForSupabase(callback) {
    if (window.sb) {
      callback();
      return;
    }
    var waited = 0;
    var waitInterval = setInterval(function () {
      waited += 100;
      if (window.sb || waited >= 3000) {
        clearInterval(waitInterval);
        if (window.sb) callback();
      }
    }, 100);
  }

  function logDebug() {
    if (window.ITWS_CONFIG && window.ITWS_CONFIG.DEBUG) {
      console.log.apply(console, ['[HomePage]'].concat(Array.prototype.slice.call(arguments)));
    }
  }

  // ============================================
  // 9. Public API
  // ============================================
  window.HomePage = {
    initialized: true,
    init: init,
    switchTab: switchTab,
    refresh: function () {
      loadStats();
      loadRecentAcademies();
    }
  };

  // ============================================
  // 10. Auto-init
  // ============================================
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

})();
