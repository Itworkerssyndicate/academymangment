// ============================================
// [29/50] ITWS Platform - Academy Details Logic
// Path: assets/js/pages/academy-details.js
// ============================================
// منطق صفحة تفاصيل الأكاديمية
// بدون إيموجي
// مسارات نسبية
// ============================================

(function () {
  'use strict';

  if (window.AcademyDetailsPage && window.AcademyDetailsPage.initialized) return;

  var state = {
    academyId: null,
    academy: null,
    category: null,
    branches: [],
    courses: [],
    certificatesCount: 0,
    loading: false,
    initialized: false
  };

  // ============================================
  // 1. Helpers
  // ============================================
  function $(id) { return document.getElementById(id); }

  function setText(id, t) {
    var el = $(id);
    if (el) el.textContent = t;
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

  function formatDate(date, opts) {
    if (!date) return '—';
    try {
      var d = date instanceof Date ? date : new Date(date);
      if (isNaN(d.getTime())) return '—';
      return d.toLocaleDateString('ar-EG', opts || {
        year: 'numeric',
        month: 'long',
        day: 'numeric'
      });
    } catch (e) {
      return '—';
    }
  }

  function getSetting(p, f) {
    if (window.AppSettings && window.AppSettings.get) {
      return window.AppSettings.get(p, f);
    }
    if (window.ITWS_SETTINGS_DEFAULTS) {
      var parts = p.split('.');
      var value = window.ITWS_SETTINGS_DEFAULTS;
      for (var i = 0; i < parts.length; i++) {
        if (value && typeof value === 'object') value = value[parts[i]];
        else { value = undefined; break; }
      }
      if (value !== undefined) return value;
    }
    return f;
  }

  function toast(msg, type) {
    if (window.Utils && window.Utils.showToast) {
      window.Utils.showToast(msg, type || 'info');
    } else if (type === 'error') {
      alert(msg);
    }
  }

  function logDebug() {
    if (window.ITWS_CONFIG && window.ITWS_CONFIG.DEBUG) {
      console.log.apply(console, ['[AcademyDetailsPage]'].concat(Array.prototype.slice.call(arguments)));
    }
  }

  function resolve(path) {
    if (!path) return '#';
    if (window.resolveUrl) return window.resolveUrl(path);
    var base = (window.ITWS_CONFIG && window.ITWS_CONFIG.BASE_PATH) || '';
    return base + String(path).replace(/^\.?\//, '');
  }

  function isValidUUID(str) {
    if (!str) return false;
    return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(str);
  }

  // ============================================
  // 2. Read URL
  // ============================================
  function readAcademyId() {
    try {
      var params = new URLSearchParams(window.location.search);
      var id = params.get('id') || params.get('academy');
      return id ? id.trim() : null;
    } catch (e) {
      return null;
    }
  }

  // ============================================
  // 3. Load academy (with category)
  // ============================================
  function loadAcademy(id) {
    if (!window.sb) return Promise.reject(new Error('Supabase not available'));

    return window.sb
      .from('academies')
      .select('id, name, license_number, tax_number, description, logo_url, category_id, status, is_deleted, created_at, approved_at, expires_at, owner_name, founded_year, email, phone, website_url, facebook_url')
      .eq('id', id)
      .eq('is_deleted', false)
      .maybeSingle()
      .then(function (res) {
        if (res.error) throw new Error(res.error.message);
        return res.data;
      });
  }

  // ============================================
  // 4. Load category
  // ============================================
  function loadCategory(categoryId) {
    if (!categoryId || !window.sb) return Promise.resolve(null);

    return window.sb
      .from('academy_categories')
      .select('id, name, name_en, color')
      .eq('id', categoryId)
      .maybeSingle()
      .then(function (res) {
        if (res.error || !res.data) return null;
        return res.data;
      })
      .catch(function () { return null; });
  }

  // ============================================
  // 5. Load branches
  // ============================================
  function loadBranches(academyId) {
    if (!window.sb) return Promise.resolve([]);

    return window.sb
      .from('academy_branches')
      .select('id, governorate, address, phone, is_main, branch_manager')
      .eq('academy_id', academyId)
      .order('is_main', { ascending: false })
      .order('governorate', { ascending: true })
      .then(function (res) {
        if (res.error || !res.data) return [];
        return res.data;
      })
      .catch(function () { return []; });
  }

  // ============================================
  // 6. Load courses
  // ============================================
  function loadCourses(academyId) {
    if (!window.sb) return Promise.resolve([]);

    return window.sb
      .from('academy_courses')
      .select('id, name, description, duration_hours, price, instructors_count')
      .eq('academy_id', academyId)
      .order('created_at', { ascending: false })
      .then(function (res) {
        if (res.error || !res.data) return [];
        return res.data;
      })
      .catch(function () { return []; });
  }

  // ============================================
  // 7. Count certificates (اختياري)
  // ============================================
  function countCertificates(academyId) {
    if (!window.sb) return Promise.resolve(0);

    return window.sb
      .from('certificates')
      .select('*', { count: 'exact', head: true })
      .eq('academy_id', academyId)
      .eq('is_active', true)
      .then(function (res) {
        if (res.error) return 0;
        return res.count || 0;
      })
      .catch(function () { return 0; });
  }

  // ============================================
  // 8. Log search
  // ============================================
  function logSearch(academyName) {
    if (!window.sb) return;

    window.sb.from('search_logs').insert({
      search_type: 'academy',
      search_value: academyName || '',
      result_count: 1,
      user_agent: navigator.userAgent.substring(0, 200)
    }).catch(function () {});
  }

  // ============================================
  // 9. Dynamic SEO
  // ============================================
  function updateSEO(academy) {
    if (!academy) return;

    var unionName = getSetting('app_identity.union_name', 'نقابة تكنولوجيا المعلومات والبرمجيات');
    var title = academy.name + ' | ' + unionName;
    var desc = academy.description
      ? String(academy.description).substring(0, 160)
      : 'أكاديمية ' + academy.name + ' - معتمدة رسمياً من ' + unionName;

    document.title = title;

    // Meta description
    var descEl = document.querySelector('meta[name="description"]');
    if (descEl) descEl.setAttribute('content', desc);

    // OG tags
    var ogTitle = document.querySelector('meta[property="og:title"]');
    if (ogTitle) ogTitle.setAttribute('content', title);

    var ogDesc = document.querySelector('meta[property="og:description"]');
    if (ogDesc) ogDesc.setAttribute('content', desc);

    var ogImage = document.querySelector('meta[property="og:image"]');
    if (ogImage && academy.logo_url) ogImage.setAttribute('content', academy.logo_url);

    var ogUrl = document.querySelector('meta[property="og:url"]');
    if (ogUrl) ogUrl.setAttribute('content', window.location.href);

    var ogType = document.querySelector('meta[property="og:type"]');
    if (ogType) ogType.setAttribute('content', 'website');
  }

  // ============================================
  // 10. Render hero
  // ============================================
  function renderHero() {
    var academy = state.academy;
    if (!academy) return;

    // Show hero
    var hero = $('acadHero');
    if (hero) hero.style.display = 'block';

    var main = $('acadMain');
    if (main) main.style.display = 'block';

    // Breadcrumb
    setText('breadcrumbCurrent', academy.name || 'تفاصيل الأكاديمية');

    // Logo
    var logoEl = $('acadLogo');
    if (logoEl) {
      if (academy.logo_url) {
        logoEl.innerHTML = '<img src="' + escapeHtml(academy.logo_url) + '" alt="' + escapeHtml(academy.name) + '">';
      } else {
        logoEl.textContent = (academy.name || '?').charAt(0);
      }
    }

    // Name
    setText('acadName', academy.name || 'أكاديمية');

    // Description
    var descEl = $('acadDescription');
    if (descEl && academy.description) {
      descEl.textContent = academy.description;
      descEl.style.display = 'block';
    }

    // License
    setText('acadLicense', academy.license_number || '—');

    // Category
    if (state.category) {
      var catWrap = $('acadCategoryWrap');
      var catEl = $('acadCategory');
      if (catWrap) catWrap.style.display = 'flex';
      if (catEl) catEl.textContent = state.category.name || '—';
    }
  }

  // ============================================
  // 11. Render info grid
  // ============================================
  function renderInfoGrid() {
    var grid = $('infoGrid');
    if (!grid || !state.academy) return;

    var academy = state.academy;
    var cards = [];

    // رقم الاعتماد
    if (academy.license_number) {
      cards.push(makeInfoCard(
        '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect><path d="M7 11V7a5 5 0 0 1 10 0v4"></path></svg>',
        'رقم الاعتماد',
        academy.license_number,
        true
      ));
    }

    // البطاقة الضريبية
    if (academy.tax_number) {
      cards.push(makeInfoCard(
        '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="1" y="4" width="22" height="16" rx="2" ry="2"></rect><line x1="1" y1="10" x2="23" y2="10"></line></svg>',
        'البطاقة الضريبية',
        academy.tax_number,
        true
      ));
    }

    // تاريخ الاعتماد
    if (academy.approved_at) {
      cards.push(makeInfoCard(
        '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path><polyline points="22 4 12 14.01 9 11.01"></polyline></svg>',
        'تاريخ الاعتماد',
        formatDate(academy.approved_at)
      ));
    }

    // الشهادات الصادرة
    if (state.certificatesCount > 0) {
      cards.push(makeInfoCard(
        '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="8" r="7"></circle><polyline points="8.21 13.89 7 23 12 20 17 23 15.79 13.88"></polyline></svg>',
        'الشهادات الصادرة',
        state.certificatesCount + ' شهادة'
      ));
    }

    // سنة التأسيس
    if (academy.founded_year) {
      cards.push(makeInfoCard(
        '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"></path><polyline points="9 22 9 12 15 12 15 22"></polyline></svg>',
        'سنة التأسيس',
        String(academy.founded_year)
      ));
    }

    // عدد الفروع
    if (state.branches.length > 0) {
      cards.push(makeInfoCard(
        '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path><circle cx="12" cy="10" r="3"></circle></svg>',
        'الفروع',
        state.branches.length + ' فرع'
      ));
    }

    // البريد الإلكتروني
    if (academy.email) {
      cards.push(makeInfoCard(
        '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"></path><polyline points="22,6 12,13 2,6"></polyline></svg>',
        'البريد الإلكتروني',
        academy.email,
        false,
        'mailto:' + academy.email
      ));
    }

    // الهاتف
    if (academy.phone) {
      cards.push(makeInfoCard(
        '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"></path></svg>',
        'الهاتف',
        academy.phone,
        false,
        'tel:' + academy.phone
      ));
    }

    // الموقع الإلكتروني
    if (academy.website_url) {
      cards.push(makeInfoCard(
        '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="2" y1="12" x2="22" y2="12"></line><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"></path></svg>',
        'الموقع الإلكتروني',
        String(academy.website_url).replace(/^https?:\/\//, ''),
        false,
        academy.website_url
      ));
    }

    grid.innerHTML = cards.join('');
  }

  function makeInfoCard(iconSvg, label, value, isMono, linkUrl) {
    var valueHtml = linkUrl
      ? '<a href="' + escapeHtml(linkUrl) + '" target="_blank" rel="noopener noreferrer" style="color:inherit;text-decoration:none;" onmouseover="this.style.color=\'var(--primary)\'" onmouseout="this.style.color=\'\'">' + escapeHtml(value) + '</a>'
      : escapeHtml(value);

    return '' +
      '<div class="info-card">' +
        '<div class="info-card-icon">' + iconSvg + '</div>' +
        '<div class="info-card-label">' + escapeHtml(label) + '</div>' +
        '<div class="info-card-value' + (isMono ? ' mono' : '') + '">' + valueHtml + '</div>' +
      '</div>';
  }

  // ============================================
  // 12. Render branches
  // ============================================
  function renderBranches() {
    var grid = $('branchesGrid');
    var countEl = $('branchesCount');
    if (!grid) return;

    var branches = state.branches || [];

    if (countEl) {
      countEl.textContent = branches.length + ' فرع';
    }

    if (branches.length === 0) {
      grid.innerHTML = '<div class="empty-inline" style="grid-column:1/-1;">لا توجد فروع مسجلة لهذه الأكاديمية</div>';
      return;
    }

    grid.innerHTML = branches.map(function (b) {
      var mainBadge = b.is_main
        ? '<span class="branch-main-badge">الفرع الرئيسي</span>'
        : '';

      var phoneHtml = b.phone
        ? '<div class="branch-info-row">' +
            '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"></path></svg>' +
            '<a href="tel:' + escapeHtml(b.phone) + '">' + escapeHtml(b.phone) + '</a>' +
          '</div>'
        : '';

      var managerHtml = b.branch_manager
        ? '<div class="branch-info-row">' +
            '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path><circle cx="12" cy="7" r="4"></circle></svg>' +
            '<span>' + escapeHtml(b.branch_manager) + '</span>' +
          '</div>'
        : '';

      return '' +
        '<div class="branch-card">' +
          '<div class="branch-header">' +
            '<div class="branch-gov">' +
              '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">' +
                '<path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path>' +
                '<circle cx="12" cy="10" r="3"></circle>' +
              '</svg>' +
              escapeHtml(b.governorate || 'فرع') +
            '</div>' +
            mainBadge +
          '</div>' +
          '<div class="branch-body">' +
            (b.address
              ? '<div class="branch-info-row">' +
                  '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"></path></svg>' +
                  '<span>' + escapeHtml(b.address) + '</span>' +
                '</div>'
              : '') +
            phoneHtml +
            managerHtml +
          '</div>' +
        '</div>';
    }).join('');
  }

  // ============================================
  // 13. Render courses
  // ============================================
  function renderCourses() {
    var section = $('coursesSection');
    var grid = $('coursesGrid');
    var countEl = $('coursesCount');

    if (!grid) return;

    var courses = state.courses || [];

    if (courses.length === 0) {
      if (section) section.style.display = 'none';
      return;
    }

    if (section) section.style.display = 'block';
    if (countEl) countEl.textContent = courses.length + ' كورس';

    grid.innerHTML = courses.map(function (c) {
      var metaItems = [];
      if (c.duration_hours) {
        metaItems.push(
          '<span class="course-meta-item">' +
            '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline></svg>' +
            escapeHtml(c.duration_hours + ' ساعة') +
          '</span>'
        );
      }
      if (c.price) {
        metaItems.push(
          '<span class="course-meta-item">' +
            '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="1" x2="12" y2="23"></line><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"></path></svg>' +
            escapeHtml(String(c.price)) + ' ج.م' +
          '</span>'
        );
      }
      if (c.instructors_count) {
        metaItems.push(
          '<span class="course-meta-item">' +
            '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path><circle cx="9" cy="7" r="4"></circle></svg>' +
            escapeHtml(String(c.instructors_count)) +
          '</span>'
        );
      }

      return '' +
        '<div class="course-card">' +
          '<div class="course-icon">' +
            '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">' +
              '<path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"></path>' +
              '<path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"></path>' +
            '</svg>' +
          '</div>' +
          '<div class="course-info">' +
            '<h3 class="course-name">' + escapeHtml(c.name || 'كورس') + '</h3>' +
            (metaItems.length > 0
              ? '<div class="course-meta">' + metaItems.join('') + '</div>'
              : '') +
          '</div>' +
        '</div>';
    }).join('');
  }

  // ============================================
  // 14. Share
  // ============================================
  function shareAcademy() {
    if (!state.academy) return;

    var url = window.location.href;
    var title = state.academy.name;
    var text = 'أكاديمية ' + title + ' - معتمدة من نقابة تكنولوجيا المعلومات';

    if (navigator.share) {
      navigator.share({
        title: title,
        text: text,
        url: url
      }).catch(function () {});
    } else if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(url).then(function () {
        toast('تم نسخ الرابط', 'success');
      }).catch(function () {
        prompt('انسخ الرابط:', url);
      });
    } else {
      prompt('انسخ الرابط:', url);
    }
  }

  // ============================================
  // 15. Show error
  // ============================================
  function showError(message) {
    var loader = $('acadLoader');
    var error = $('acadError');
    var hero = $('acadHero');
    var main = $('acadMain');

    if (loader) loader.classList.remove('show');
    if (hero) hero.style.display = 'none';
    if (main) main.style.display = 'none';

    if (error) {
      if (message) {
        var errText = $('acadErrorText');
        if (errText) errText.textContent = message;
      }
      error.classList.add('show');
    }
  }

  // ============================================
  // 16. Load all data
  // ============================================
  function loadAll() {
    if (!state.academyId) {
      showError('لم يتم تحديد الأكاديمية. تأكد من الرابط.');
      return;
    }

    state.loading = true;

    var loader = $('acadLoader');
    if (loader) loader.classList.add('show');

    loadAcademy(state.academyId)
      .then(function (academy) {
        if (!academy) {
          throw new Error('الأكاديمية غير موجودة أو غير معتمدة');
        }

        if (academy.status !== 'approved') {
          throw new Error('هذه الأكاديمية ليست معتمدة حالياً');
        }

        state.academy = academy;

        // Load related data in parallel
        return Promise.all([
          loadCategory(academy.category_id),
          loadBranches(state.academyId),
          loadCourses(state.academyId),
          countCertificates(state.academyId)
        ]).then(function (results) {
          state.category = results[0];
          state.branches = results[1] || [];
          state.courses = results[2] || [];
          state.certificatesCount = results[3] || 0;

          // Hide loader
          if (loader) loader.classList.remove('show');

          // Render
          renderHero();
          renderInfoGrid();
          renderBranches();
          renderCourses();
          updateSEO(academy);

          // Log search
          logSearch(academy.name);

          state.loading = false;
        });
      })
      .catch(function (err) {
        showError(err.message || 'حدث خطأ في تحميل البيانات');
        logDebug('Load error:', err.message);
        state.loading = false;
      });
  }

  // ============================================
  // 17. Init
  // ============================================
  function init() {
    if (state.initialized) return;
    state.initialized = true;

    state.academyId = readAcademyId();

    // Check ID format
    if (!state.academyId) {
      showError('لم يتم تحديد الأكاديمية. تأكد من الرابط.');
      return;
    }

    // Bind share button
    var shareBtn = $('shareBtn');
    if (shareBtn) {
      shareBtn.addEventListener('click', shareAcademy);
    }

    // Wait for Supabase
    waitForSupabase(function () {
      loadAll();
    });

    logDebug('Academy details page initialized. ID:', state.academyId);
  }

  function waitForSupabase(cb) {
    if (window.sb) { cb(); return; }
    var w = 0;
    var i = setInterval(function () {
      w += 100;
      if (window.sb || w >= 3000) {
        clearInterval(i);
        if (window.sb) cb();
        else showError('تعذر الاتصال بالخادم');
      }
    }, 100);
  }

  // ============================================
  // 18. Public API
  // ============================================
  window.AcademyDetailsPage = {
    initialized: true,
    init: init,
    share: shareAcademy,
    refresh: function () {
      state.initialized = false;
      init();
    },
    getState: function () { return state; }
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

})();
