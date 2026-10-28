/* ============================================================
   ITWS Platform — Academy Details Page Logic V2
   File: assets/js/pages/academy-details.js
   Description: Fetch academy + related data + render + review flow

   Load order: AFTER all core modules + AFTER academy-details.html

   Features:
   - Reads academy ID from URL (?id=uuid)
   - Fetches academy (approved only) + branches + courses + ratings
   - Renders profile card + sections (description / contact / branches / courses / reviews)
   - Rating summary (avg + distribution bars) + reviews list
   - Add review flow (modal): stars + review text
   - Respects ratings settings (enable_ratings / allow_public_rating / require_login / allow_reviews)
   - Edit own review
   - Delete own review
   - Realtime updates (academy / ratings changes)
   - Share button (navigator.share / clipboard)
   - All strings from Labels.t() with fallbacks
   - Uses Icons / Toast / Modal
   - RTL-aware, R13 responsive

   Rules:
   - No emoji
   - ES5-style IIFE
   - window.sb only
   - Never render unapproved academies
   - Never expose internal IDs of other users
   ============================================================ */

(function () {
  'use strict';

  if (window.AcademyDetailsPage && window.AcademyDetailsPage._initialized) {
    return;
  }

  /* ============================================================
     1. HELPERS
     ============================================================ */

  function log(level, msg, data) {
    var cfg = window.ITWS_CONFIG || {};
    if (level === 'error' || (cfg.DEBUG && level === 'debug')) {
      try {
        var args = ['[AcademyDetailsPage]', msg];
        if (data !== undefined) args.push(data);
        if (level === 'error') console.error.apply(console, args);
        else console.log.apply(console, args);
      } catch (e) {}
    }
  }

  function getSb() {
    return window.sb || window.supabaseClient || window.ITWS_SUPABASE || null;
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

  function getSetting(path, fallback) {
    try {
      if (window.AppSettings && typeof window.AppSettings.get === 'function') {
        var v = window.AppSettings.get(path);
        return (v === undefined || v === null) ? fallback : v;
      }
    } catch (e) {}
    return fallback;
  }

  function resolve(path) {
    if (!path) return '#';
    if (window.resolveUrl) return window.resolveUrl(path);
    var base = (window.ITWS_CONFIG && window.ITWS_CONFIG.BASE_PATH) || '/';
    if (base.charAt(base.length - 1) !== '/') base += '/';
    return base + String(path).replace(/^\.?\//, '');
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

  function icon(name, size) {
    try {
      if (window.Icons && typeof window.Icons.get === 'function') {
        return window.Icons.get(name, { size: size || 16 });
      }
    } catch (e) {}
    return '';
  }

  function dispatchEvent(name, detail) {
    try {
      window.dispatchEvent(new CustomEvent(name, { detail: detail || {} }));
    } catch (e) {}
  }

  function showToast(msg, type) {
    try {
      if (window.Toast && typeof window.Toast.show === 'function') {
        window.Toast.show({ type: type || 'info', message: msg });
      } else if (window.Utils && typeof window.Utils.showToast === 'function') {
        window.Utils.showToast(msg, type);
      }
    } catch (e) {}
  }

  function $(id) { return document.getElementById(id); }

  function formatDate(v) {
    try {
      if (window.Utils && typeof window.Utils.formatDate === 'function') {
        return window.Utils.formatDate(v);
      }
    } catch (e) {}
    if (!v) return '';
    try {
      var d = new Date(v);
      if (isNaN(d.getTime())) return '';
      return d.getDate() + '/' + (d.getMonth() + 1) + '/' + d.getFullYear();
    } catch (e) { return ''; }
  }

  function daysAgo(v) {
    if (!v) return '';
    try {
      var d = new Date(v).getTime();
      var now = Date.now();
      var diff = Math.floor((now - d) / (1000 * 60 * 60 * 24));
      if (diff === 0) return getLabel('common.today', 'اليوم');
      if (diff === 1) return getLabel('common.yesterday', 'أمس');
      if (diff < 7) return getLabel('common.days_ago', 'منذ {n} أيام').replace('{n}', diff);
      if (diff < 30) {
        var weeks = Math.floor(diff / 7);
        return getLabel('common.weeks_ago', 'منذ {n} أسابيع').replace('{n}', weeks);
      }
      if (diff < 365) {
        var months = Math.floor(diff / 30);
        return getLabel('common.months_ago', 'منذ {n} أشهر').replace('{n}', months);
      }
      return formatDate(v);
    } catch (e) { return ''; }
  }

  /* ============================================================
     2. STATE
     ============================================================ */

  var state = {
    _initialized: false,
    academyId: null,
    loading: false,
    error: null,
    notFound: false,
    academy: null,
    branches: [],
    courses: [],
    ratings: [],
    category: null,
    governorate: null,
    currentUser: null,
    currentProfile: null,
    myRating: null,
    realtimeUnsubs: []
  };

  /* ============================================================
     3. READ ID FROM URL
     ============================================================ */

  function readAcademyId() {
    try {
      var params = new URLSearchParams(window.location.search);
      var id = params.get('id');
      if (id && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) {
        return id;
      }
    } catch (e) {}
    return null;
  }

  /* ============================================================
     4. FETCH DATA
     ============================================================ */

  function fetchAcademy(id) {
    var sb = getSb();
    if (!sb) return Promise.reject(new Error(getLabel('errors.network', 'تعذر الاتصال بالخادم')));

    return sb.from('academies')
      .select('id, name, description, logo_url, cover_url, category_id, governorate_id, city, address, contact_email, contact_phone, website_url, status, is_deleted, rating_avg, rating_count, is_rating_visible, approved_at, created_at')
      .eq('id', id)
      .eq('status', 'approved')
      .eq('is_deleted', false)
      .maybeSingle()
      .then(function (res) {
        if (res.error) throw new Error(res.error.message);
        return res.data;
      });
  }

  function fetchCategory(categoryId) {
    if (!categoryId) return Promise.resolve(null);
    var sb = getSb();
    if (!sb) return Promise.resolve(null);

    return sb.from('academy_categories')
      .select('id, name_ar')
      .eq('id', categoryId)
      .maybeSingle()
      .then(function (res) { return res.data || null; })
      .catch(function () { return null; });
  }

  function fetchGovernorate(govId) {
    if (!govId) return Promise.resolve(null);
    var sb = getSb();
    if (!sb) return Promise.resolve(null);

    return sb.from('governorates')
      .select('id, name_ar')
      .eq('id', govId)
      .maybeSingle()
      .then(function (res) { return res.data || null; })
      .catch(function () { return null; });
  }

  function fetchBranches(academyId) {
    var sb = getSb();
    if (!sb) return Promise.resolve([]);

    return sb.from('academy_branches')
      .select('id, name, governorate_id, address, phone, is_main, is_active')
      .eq('academy_id', academyId)
      .eq('is_active', true)
      .order('is_main', { ascending: false })
      .order('name', { ascending: true })
      .then(function (res) { return res.data || []; })
      .catch(function () { return []; });
  }

  function fetchCourses(academyId) {
    var sb = getSb();
    if (!sb) return Promise.resolve([]);

    return sb.from('academy_courses')
      .select('id, title, description, duration_hours, price, level, is_active')
      .eq('academy_id', academyId)
      .eq('is_active', true)
      .order('order_index', { ascending: true })
      .order('title', { ascending: true })
      .then(function (res) { return res.data || []; })
      .catch(function () { return []; });
  }

  function fetchRatings(academyId) {
    var sb = getSb();
    if (!sb) return Promise.resolve([]);

    var ratingsEnabled = getSetting('ratings.enable_ratings', true);
    if (ratingsEnabled === false) return Promise.resolve([]);

    return sb.from('academy_ratings')
      .select('id, academy_id, rated_by, stars, review, is_visible, is_verified, created_at, updated_at')
      .eq('academy_id', academyId)
      .eq('is_visible', true)
      .order('created_at', { ascending: false })
      .limit(50)
      .then(function (res) { return res.data || []; })
      .catch(function () { return []; });
  }

  function fetchMyRating(academyId, userId) {
    if (!userId) return Promise.resolve(null);
    var sb = getSb();
    if (!sb) return Promise.resolve(null);

    return sb.from('academy_ratings')
      .select('id, stars, review, is_visible, created_at')
      .eq('academy_id', academyId)
      .eq('rated_by', userId)
      .maybeSingle()
      .then(function (res) { return res.data || null; })
      .catch(function () { return null; });
  }

  /* ============================================================
     5. LOAD CURRENT USER
     ============================================================ */

  function loadCurrentUser() {
    var sb = getSb();
    if (!sb || !sb.auth) return Promise.resolve();

    return sb.auth.getUser()
      .then(function (res) {
        var user = res && res.data && res.data.user;
        if (!user) return;
        state.currentUser = user;

        return sb.from('profiles')
          .select('id, full_name, avatar_url, role')
          .eq('id', user.id)
          .maybeSingle()
          .then(function (profileRes) {
            state.currentProfile = (profileRes && profileRes.data) ? profileRes.data : null;
          });
      })
      .catch(function () {});
  }

  /* ============================================================
     6. STATE UI
     ============================================================ */

  function showLoading() {
    var l = $('academyLoader');
    if (l) l.classList.add('is-visible');
    var e = $('academyError');
    if (e) e.classList.remove('is-visible');
    var n = $('academyNotFound');
    if (n) n.classList.remove('is-visible');
    var r = $('academyResult');
    if (r) r.classList.remove('show');
    var cta = $('academyCTA');
    if (cta) cta.setAttribute('hidden', '');
  }

  function showError(msg) {
    var l = $('academyLoader');
    if (l) l.classList.remove('is-visible');
    var e = $('academyError');
    if (e) e.classList.add('is-visible');
    var n = $('academyNotFound');
    if (n) n.classList.remove('is-visible');
    var r = $('academyResult');
    if (r) r.classList.remove('show');

    var txt = $('errorText');
    if (txt) txt.textContent = msg || getLabel('errors.network', 'تعذر الاتصال بالخادم');
  }

  function showNotFound() {
    var l = $('academyLoader');
    if (l) l.classList.remove('is-visible');
    var e = $('academyError');
    if (e) e.classList.remove('is-visible');
    var n = $('academyNotFound');
    if (n) n.classList.add('is-visible');
    var r = $('academyResult');
    if (r) r.classList.remove('show');
    var cta = $('academyCTA');
    if (cta) cta.setAttribute('hidden', '');
  }

  function showResult() {
    var l = $('academyLoader');
    if (l) l.classList.remove('is-visible');
    var e = $('academyError');
    if (e) e.classList.remove('is-visible');
    var n = $('academyNotFound');
    if (n) n.classList.remove('is-visible');
    var r = $('academyResult');
    if (r) {
      r.removeAttribute('hidden');
      r.classList.add('show');
    }
    var cta = $('academyCTA');
    if (cta) cta.removeAttribute('hidden');
  }

  /* ============================================================
     7. RENDER — PROFILE CARD
     ============================================================ */

  function renderStars(rating, opts) {
    opts = opts || {};
    var size = opts.size || 14;
    var max = opts.max || 5;
    var r = Math.round(Number(rating) || 0);
    if (r > max) r = max;
    if (r < 0) r = 0;

    var html = '';
    for (var i = 0; i < max; i++) {
      if (i < r) {
        html += icon('star-filled', size);
      } else {
        html += icon('star', size).replace('class="', 'class="star-empty ');
      }
    }
    return html;
  }

  function renderProfileCard(a) {
    var logoHtml;
    if (a.logo_url) {
      logoHtml = '<img src="' + escapeHtml(a.logo_url) + '" alt="" onerror="this.parentNode.textContent=\'' + escapeHtml((a.name || 'أ').charAt(0)) + '\';">';
    } else {
      logoHtml = escapeHtml((a.name || 'أ').charAt(0));
    }

    var coverHtml;
    if (a.cover_url) {
      coverHtml = '<div class="academy-profile-cover" style="background-image: url(\'' + escapeHtml(a.cover_url) + '\');"></div>';
    } else {
      coverHtml = '<div class="academy-profile-cover"></div>';
    }

    var categoryHtml = '';
    if (state.category && state.category.name_ar) {
      categoryHtml = '<span class="academy-profile-category">'
        + icon('tag', 14)
        + '<span>' + escapeHtml(state.category.name_ar) + '</span>'
        + '</span>';
    }

    var locationText = '';
    if (state.governorate && state.governorate.name_ar) {
      locationText = state.governorate.name_ar;
      if (a.city) locationText += ' — ' + a.city;
    } else if (a.city) {
      locationText = a.city;
    }

    var locationHtml = '';
    if (locationText) {
      locationHtml = '<span class="academy-profile-location">'
        + icon('map-pin', 14)
        + '<span>' + escapeHtml(locationText) + '</span>'
        + '</span>';
    }

    var ratingHtml = '';
    var ratingsEnabled = getSetting('ratings.enable_ratings', true) !== false;
    if (ratingsEnabled && a.is_rating_visible !== false && Number(a.rating_count) > 0) {
      ratingHtml = '<span class="academy-profile-rating">'
        + icon('star-filled', 14)
        + '<span>' + escapeHtml((Number(a.rating_avg) || 0).toFixed(1)) + '</span>'
        + '<span class="academy-profile-rating-count">(' + (Number(a.rating_count) || 0) + ')</span>'
        + '</span>';
    }

    var actionsHtml = ''
      + '<a href="' + escapeHtml(resolve('verify.html')) + '" class="academy-action-btn primary">'
      +   icon('badge-check', 16)
      +   '<span>' + escapeHtml(getLabel('academy_details.action_verify', 'تحقق من شهادة')) + '</span>'
      + '</a>';

    if (a.website_url) {
      actionsHtml += '<a href="' + escapeHtml(a.website_url) + '" target="_blank" rel="noopener" class="academy-action-btn">'
        + icon('external-link', 16)
        + '<span>' + escapeHtml(getLabel('academy_details.action_website', 'الموقع الرسمي')) + '</span>'
        + '</a>';
    }

    if (a.contact_phone) {
      actionsHtml += '<a href="tel:' + escapeHtml(String(a.contact_phone).replace(/[^0-9+]/g, '')) + '" class="academy-action-btn">'
        + icon('phone', 16)
        + '<span>' + escapeHtml(getLabel('academy_details.action_call', 'اتصل')) + '</span>'
        + '</a>';
    }

    actionsHtml += '<button type="button" class="academy-action-btn" id="academyShareBtn">'
      + icon('share', 16)
      + '<span>' + escapeHtml(getLabel('academy_details.action_share', 'مشاركة')) + '</span>'
      + '</button>';

    return ''
      + '<div class="academy-profile-card">'
      +   coverHtml
      +   '<div class="academy-profile-body">'
      +     '<div class="academy-profile-header">'
      +       '<div class="academy-profile-logo">' + logoHtml + '</div>'
      +       '<div class="academy-profile-info">'
      +         '<h2 class="academy-profile-name">' + escapeHtml(a.name || '') + '</h2>'
      +         '<div class="academy-profile-meta">'
      +           '<span class="academy-profile-badge">' + icon('check-circle', 13) + '<span>' + escapeHtml(getLabel('academies.card.verified', 'معتمدة')) + '</span></span>'
      +           categoryHtml
      +           locationHtml
      +           ratingHtml
      +         '</div>'
      +       '</div>'
      +     '</div>'
      +     '<div class="academy-profile-actions">' + actionsHtml + '</div>'
      +   '</div>'
      + '</div>';
  }

  /* ============================================================
     8. RENDER — DESCRIPTION
     ============================================================ */

  function renderDescription(a) {
    if (!a.description) return '';
    return ''
      + '<section class="academy-section">'
      +   '<h3 class="academy-section-title">' + icon('file-text', 22) + '<span>' + escapeHtml(getLabel('academy_details.section_about', 'عن الأكاديمية')) + '</span></h3>'
      +   '<div class="academy-description">' + escapeHtml(a.description) + '</div>'
      + '</section>';
  }

  /* ============================================================
     9. RENDER — CONTACT
     ============================================================ */

  function renderContact(a) {
    var items = [];

    if (a.contact_email) {
      items.push({
        icon: 'mail',
        label: getLabel('academy_details.contact.email', 'البريد الإلكتروني'),
        value: a.contact_email,
        href: 'mailto:' + a.contact_email
      });
    }

    if (a.contact_phone) {
      items.push({
        icon: 'phone',
        label: getLabel('academy_details.contact.phone', 'الهاتف'),
        value: a.contact_phone,
        href: 'tel:' + String(a.contact_phone).replace(/[^0-9+]/g, '')
      });
    }

    if (a.website_url) {
      items.push({
        icon: 'globe',
        label: getLabel('academy_details.contact.website', 'الموقع'),
        value: String(a.website_url).replace(/^https?:\/\//, '').replace(/\/$/, ''),
        href: a.website_url,
        target: '_blank'
      });
    }

    if (a.address) {
      items.push({
        icon: 'map-pin',
        label: getLabel('academy_details.contact.address', 'العنوان'),
        value: a.address,
        href: null
      });
    }

    if (items.length === 0) return '';

    var itemsHtml = items.map(function (it) {
      var inner = ''
        + '<div class="academy-contact-icon">' + icon(it.icon, 18) + '</div>'
        + '<div class="academy-contact-info">'
        +   '<div class="academy-contact-label">' + escapeHtml(it.label) + '</div>'
        +   '<div class="academy-contact-value">' + escapeHtml(it.value) + '</div>'
        + '</div>';

      if (it.href) {
        return '<a href="' + escapeHtml(it.href) + '" '
          + (it.target ? 'target="' + it.target + '" rel="noopener" ' : '')
          + 'class="academy-contact-item">' + inner + '</a>';
      }
      return '<div class="academy-contact-item">' + inner + '</div>';
    }).join('');

    return ''
      + '<section class="academy-section">'
      +   '<h3 class="academy-section-title">' + icon('message-circle', 22) + '<span>' + escapeHtml(getLabel('academy_details.section_contact', 'بيانات التواصل')) + '</span></h3>'
      +   '<div class="academy-contact-grid">' + itemsHtml + '</div>'
      + '</section>';
  }

  /* ============================================================
     10. RENDER — BRANCHES
     ============================================================ */

  function renderBranches() {
    if (!state.branches || state.branches.length === 0) return '';

    var itemsHtml = state.branches.map(function (b) {
      var mainTag = b.is_main
        ? '<span class="academy-branch-main-tag">' + escapeHtml(getLabel('academy_details.branch_main', 'رئيسي')) + '</span>'
        : '';

      var detailsHtml = '';
      if (b.address) {
        detailsHtml += '<div class="academy-branch-detail">' + icon('map-pin', 12) + '<span>' + escapeHtml(b.address) + '</span></div>';
      }
      if (b.phone) {
        detailsHtml += '<div class="academy-branch-detail">' + icon('phone', 12) + '<span>' + escapeHtml(b.phone) + '</span></div>';
      }

      return ''
        + '<div class="academy-branch-card' + (b.is_main ? ' main' : '') + '">'
        +   '<div class="academy-branch-header">'
        +     '<div class="academy-branch-icon">' + icon('map-pin', 16) + '</div>'
        +     '<div class="academy-branch-name">' + escapeHtml(b.name || '') + '</div>'
        +     mainTag
        +   '</div>'
        +   detailsHtml
        + '</div>';
    }).join('');

    return ''
      + '<section class="academy-section" data-section="branches">'
      +   '<h3 class="academy-section-title">' + icon('map', 22) + '<span>' + escapeHtml(getLabel('academy_details.section_branches', 'الفروع')) + '</span></h3>'
      +   '<div class="academy-branches-grid">' + itemsHtml + '</div>'
      + '</section>';
  }

  /* ============================================================
     11. RENDER — COURSES
     ============================================================ */

  function renderCourses() {
    if (!state.courses || state.courses.length === 0) return '';

    var itemsHtml = state.courses.map(function (c) {
      var metaHtml = '';
      if (c.duration_hours) {
        metaHtml += '<span class="academy-course-meta-item">' + icon('clock', 12) + '<span>' + c.duration_hours + ' ' + escapeHtml(getLabel('common.hours', 'ساعة')) + '</span></span>';
      }
      if (c.level) {
        var levelLabel = c.level === 'beginner'
          ? getLabel('common.level_beginner', 'مبتدئ')
          : c.level === 'intermediate'
            ? getLabel('common.level_intermediate', 'متوسط')
            : getLabel('common.level_advanced', 'متقدم');
        metaHtml += '<span class="academy-course-meta-item">' + icon('trending-up', 12) + '<span>' + levelLabel + '</span></span>';
      }
      if (c.price) {
        metaHtml += '<span class="academy-course-meta-item">' + icon('tag', 12) + '<span>' + Number(c.price).toFixed(0) + ' ' + escapeHtml(getLabel('common.currency_egp', 'ج.م')) + '</span></span>';
      }

      return ''
        + '<div class="academy-course-card">'
        +   '<div class="academy-course-icon">' + icon('book', 20) + '</div>'
        +   '<div class="academy-course-body">'
        +     '<h4 class="academy-course-title">' + escapeHtml(c.title || '') + '</h4>'
        +     (c.description ? '<p class="academy-course-desc">' + escapeHtml(c.description) + '</p>' : '')
        +     (metaHtml ? '<div class="academy-course-meta">' + metaHtml + '</div>' : '')
        +   '</div>'
        + '</div>';
    }).join('');

    return ''
      + '<section class="academy-section" data-section="courses">'
      +   '<h3 class="academy-section-title">' + icon('book', 22) + '<span>' + escapeHtml(getLabel('academy_details.section_courses', 'الكورسات')) + '</span></h3>'
      +   '<div class="academy-courses-grid">' + itemsHtml + '</div>'
      + '</section>';
  }

  /* ============================================================
     12. RENDER — REVIEWS
     ============================================================ */

  function computeRatingDistribution(ratings) {
    var dist = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
    var total = 0;
    ratings.forEach(function (r) {
      var s = Math.max(1, Math.min(5, Math.round(Number(r.stars) || 0)));
      if (s >= 1 && s <= 5) {
        dist[s]++;
        total++;
      }
    });
    return { dist: dist, total: total };
  }

  function renderReviewsSection(a) {
    var ratingsEnabled = getSetting('ratings.enable_ratings', true) !== false;
    if (!ratingsEnabled) return '';

    var showOnDirectory = getSetting('ratings.show_on_directory', true) !== false;
    if (!showOnDirectory) return '';

    var ratings = state.ratings || [];
    var count = Number(a.rating_count) || ratings.length;
    var avg = Number(a.rating_avg) || 0;
    var dist = computeRatingDistribution(ratings);

    // Summary
    var summaryHtml = '';
    if (count > 0) {
      var barsHtml = '';
      for (var star = 5; star >= 1; star--) {
        var c = dist.dist[star] || 0;
        var pct = dist.total > 0 ? Math.round((c / dist.total) * 100) : 0;
        barsHtml += ''
          + '<div class="academy-rating-bar-row">'
          +   '<span class="academy-rating-bar-label">' + star + ' ' + icon('star-filled', 10) + '</span>'
          +   '<div class="academy-rating-bar"><div class="academy-rating-bar-fill" style="width:' + pct + '%;"></div></div>'
          +   '<span class="academy-rating-bar-count">' + c + '</span>'
          + '</div>';
      }

      summaryHtml = ''
        + '<div class="academy-reviews-summary">'
        +   '<div class="academy-rating-big">'
        +     '<div class="academy-rating-value">' + avg.toFixed(1) + '</div>'
        +     '<div class="academy-rating-stars-lg">' + renderStars(avg, { size: 18 }) + '</div>'
        +     '<div class="academy-rating-total">' + count + ' ' + escapeHtml(getLabel('academy_details.rating_count', 'تقييم')) + '</div>'
        +   '</div>'
        +   '<div class="academy-rating-bars">' + barsHtml + '</div>'
        + '</div>';
    }

    // Reviews list
    var reviewsHtml = '';
    if (ratings.length === 0) {
      reviewsHtml = '<div class="academy-reviews-empty">'
        + escapeHtml(getLabel('academy_details.reviews_empty', 'لا توجد تقييمات بعد. كن أول من يقيّم هذه الأكاديمية'))
        + '</div>';
    } else {
      reviewsHtml = '<div class="academy-reviews-list">'
        + ratings.map(renderReviewCard).join('')
        + '</div>';
    }

    // Add review button (conditionally)
    var addBtnHtml = '';
    var canReview = canSubmitReview();
    if (canReview.allowed) {
      addBtnHtml = '<button type="button" class="academy-add-review-btn" id="addReviewBtn">'
        + icon(state.myRating ? 'edit' : 'star-filled', 16)
        + '<span>' + escapeHtml(state.myRating
            ? getLabel('academy_details.edit_review', 'تعديل تقييمك')
            : getLabel('academy_details.add_review', 'أضف تقييمك'))
        + '</span>'
        + '</button>';
    } else if (canReview.reason === 'not-logged-in') {
      addBtnHtml = '<a href="' + escapeHtml(resolve('login.html?next=' + encodeURIComponent(window.location.pathname + window.location.search))) + '" class="academy-add-review-btn">'
        + icon('log-in', 16)
        + '<span>' + escapeHtml(getLabel('academy_details.login_to_review', 'سجل دخولك لتقييم الأكاديمية')) + '</span>'
        + '</a>';
    }

    return ''
      + '<section class="academy-section" data-section="reviews">'
      +   '<h3 class="academy-section-title">' + icon('star', 22) + '<span>' + escapeHtml(getLabel('academy_details.section_reviews', 'التقييمات')) + '</span></h3>'
      +   summaryHtml
      +   reviewsHtml
      +   addBtnHtml
      + '</section>';
  }

  function renderReviewCard(r) {
    var stars = Math.max(1, Math.min(5, Math.round(Number(r.stars) || 0)));
    var starsHtml = renderStars(stars, { size: 12 });
    var dateText = daysAgo(r.created_at);
    var isMine = state.myRating && r.id === state.myRating.id;

    var reviewerName = getLabel('academy_details.reviewer_anonymous', 'مستخدم');
    if (isMine && state.currentProfile && state.currentProfile.full_name) {
      reviewerName = state.currentProfile.full_name;
    } else if (r.is_verified) {
      reviewerName = getLabel('academy_details.reviewer_verified', 'تقييم موثّق');
    }

    var initials = String(reviewerName).trim().substring(0, 2).toUpperCase();

    return ''
      + '<div class="academy-review-card">'
      +   '<div class="academy-review-header">'
      +     '<div class="academy-review-avatar">' + escapeHtml(initials) + '</div>'
      +     '<div class="academy-review-info">'
      +       '<div class="academy-review-author">' + escapeHtml(reviewerName) + '</div>'
      +       '<div class="academy-review-stars">' + starsHtml + '</div>'
      +     '</div>'
      +     '<div class="academy-review-date">' + escapeHtml(dateText) + '</div>'
      +   '</div>'
      +   (r.review ? '<p class="academy-review-text">' + escapeHtml(r.review) + '</p>' : '')
      + '</div>';
  }

  /* ============================================================
     13. REVIEW PERMISSIONS
     ============================================================ */

  function canSubmitReview() {
    if (!state.currentUser) return { allowed: false, reason: 'not-logged-in' };

    var requireLogin = getSetting('ratings.require_login_to_rate', true);
    if (requireLogin !== false && !state.currentUser) {
      return { allowed: false, reason: 'not-logged-in' };
    }

    var allowPublic = getSetting('ratings.allow_public_rating', true);
    if (allowPublic === false) {
      // Only committee/admin can rate
      var role = state.currentProfile ? state.currentProfile.role : null;
      if (role !== 'super_admin' && role !== 'committee_head' &&
          role !== 'committee_deputy' && role !== 'committee_member') {
        return { allowed: false, reason: 'not-allowed' };
      }
    }

    return { allowed: true };
  }

  /* ============================================================
     14. ADD/EDIT REVIEW MODAL
     ============================================================ */

  function openReviewModal() {
    if (!window.Modal || typeof window.Modal.create !== 'function') {
      showToast(getLabel('errors.generic', 'حدث خطأ'), 'error');
      return;
    }

    var currentStars = state.myRating ? Number(state.myRating.stars) : 0;
    var currentReview = state.myRating ? (state.myRating.review || '') : '';
    var selectedStars = currentStars;

    var bodyEl = document.createElement('div');

    // Star selector
    var starLabel = document.createElement('div');
    starLabel.textContent = getLabel('academy_details.review_stars', 'تقييمك:');
    starLabel.style.cssText = 'margin-bottom:8px;color:var(--text,#F8FAFC);font-weight:600;font-size:13px;';
    bodyEl.appendChild(starLabel);

    var starsRow = document.createElement('div');
    starsRow.style.cssText = 'display:flex;gap:6px;margin-bottom:16px;justify-content:center;';
    bodyEl.appendChild(starsRow);

    var starButtons = [];
    for (var i = 1; i <= 5; i++) {
      (function (value) {
        var btn = document.createElement('button');
        btn.type = 'button';
        btn.setAttribute('data-star', String(value));
        btn.style.cssText = 'width:48px;height:48px;border-radius:10px;background:transparent;border:2px solid var(--border,rgba(255,255,255,0.1));color:var(--text-muted,#64748B);cursor:pointer;display:flex;align-items:center;justify-content:center;transition:all 0.15s;padding:0;';
        btn.innerHTML = icon('star', 24);
        btn.addEventListener('click', function () {
          selectedStars = value;
          starButtons.forEach(function (b) {
            var v = parseInt(b.getAttribute('data-star'), 10);
            if (v <= value) {
              b.style.background = 'var(--warning-soft, rgba(245,158,11,0.14))';
              b.style.borderColor = 'var(--warning, #F59E0B)';
              b.style.color = 'var(--warning, #F59E0B)';
              b.innerHTML = icon('star-filled', 24);
            } else {
              b.style.background = 'transparent';
              b.style.borderColor = 'var(--border, rgba(255,255,255,0.1))';
              b.style.color = 'var(--text-muted, #64748B)';
              b.innerHTML = icon('star', 24);
            }
          });
        });
        starsRow.appendChild(btn);
        starButtons.push(btn);
      })(i);
    }

    // Trigger initial
    if (currentStars > 0) {
      var btn0 = starButtons[currentStars - 1];
      if (btn0) btn0.click();
    }

    // Review textarea (if allowed)
    var allowReviews = getSetting('ratings.allow_reviews', true) !== false;
    var reviewMaxLength = parseInt(getSetting('ratings.review_max_length', 500), 10) || 500;
    var textareaEl = null;

    if (allowReviews) {
      var reviewLabel = document.createElement('div');
      reviewLabel.textContent = getLabel('academy_details.review_text', 'تعليقك (اختياري):');
      reviewLabel.style.cssText = 'margin-bottom:8px;color:var(--text,#F8FAFC);font-weight:600;font-size:13px;';
      bodyEl.appendChild(reviewLabel);

      textareaEl = document.createElement('textarea');
      textareaEl.value = currentReview;
      textareaEl.setAttribute('maxlength', String(reviewMaxLength));
      textareaEl.setAttribute('placeholder', getLabel('academy_details.review_placeholder', 'شاركنا تجربتك مع هذه الأكاديمية...'));
      textareaEl.style.cssText = 'width:100%;padding:12px 14px;background:var(--bg,#0A0E14);border:2px solid var(--border,rgba(255,255,255,0.08));border-radius:10px;color:var(--text,#F8FAFC);font-family:inherit;font-size:14px;min-height:100px;resize:vertical;outline:none;';
      bodyEl.appendChild(textareaEl);

      var counterEl = document.createElement('div');
      counterEl.style.cssText = 'text-align:end;font-size:11px;color:var(--text-muted,#64748B);margin-top:4px;';
      counterEl.textContent = currentReview.length + ' / ' + reviewMaxLength;
      bodyEl.appendChild(counterEl);

      textareaEl.addEventListener('input', function () {
        counterEl.textContent = textareaEl.value.length + ' / ' + reviewMaxLength;
      });
    }

    // Modal
    var modal = window.Modal.create({
      title: state.myRating
        ? getLabel('academy_details.edit_review_title', 'تعديل التقييم')
        : getLabel('academy_details.add_review_title', 'أضف تقييمك'),
      subtitle: state.academy ? state.academy.name : '',
      icon: 'star',
      iconVariant: 'warning',
      size: 'sm',
      closable: true,
      closeOnBackdrop: true,
      closeOnEsc: true,
      body: bodyEl,
      buttons: [
        {
          label: getLabel('common.cancel', 'إلغاء'),
          variant: 'secondary'
        },
        {
          label: state.myRating
            ? getLabel('common.update', 'تحديث')
            : getLabel('common.submit', 'إرسال'),
          variant: 'primary',
          icon: 'check',
          action: function () {
            if (selectedStars < 1) {
              showToast(getLabel('academy_details.review_stars_required', 'اختر عدد النجوم'), 'warning');
              return false;
            }
            submitReview(selectedStars, textareaEl ? textareaEl.value : '');
            return true;
          }
        }
      ]
    });

    // Delete button (if existing review)
    if (state.myRating) {
      var footerEl = modal.el.querySelector('.itws-modal-foot');
      if (footerEl) {
        var delBtn = document.createElement('button');
        delBtn.type = 'button';
        delBtn.className = 'itws-modal-btn danger';
        delBtn.innerHTML = icon('trash', 16) + '<span>' + escapeHtml(getLabel('common.delete', 'حذف')) + '</span>';
        delBtn.style.cssText = 'margin-inline-end:auto;';
        delBtn.addEventListener('click', function () {
          var confirmed = window.confirm(getLabel('academy_details.delete_review_confirm', 'هل تريد حذف تقييمك؟'));
          if (confirmed) {
            deleteReview();
            modal.close();
          }
        });
        footerEl.insertBefore(delBtn, footerEl.firstChild);
      }
    }
  }

  /* ============================================================
     15. SUBMIT / DELETE REVIEW
     ============================================================ */

  function submitReview(stars, review) {
    var sb = getSb();
    if (!sb || !state.currentUser || !state.academyId) {
      showToast(getLabel('errors.generic', 'حدث خطأ'), 'error');
      return;
    }

    var payload = {
      academy_id: state.academyId,
      rated_by: state.currentUser.id,
      stars: Math.max(1, Math.min(5, parseInt(stars, 10) || 0)),
      review: review ? String(review).trim().substring(0, 500) : null,
      is_visible: getSetting('ratings.auto_publish', true) !== false
    };

    Promise.resolve()
      .then(function () {
        if (state.myRating) {
          return sb.from('academy_ratings')
            .update(payload)
            .eq('id', state.myRating.id);
        }
        return sb.from('academy_ratings').insert(payload);
      })
      .then(function (res) {
        if (res.error) {
          if (res.error.code === '23505') {
            throw new Error(getLabel('academy_details.already_reviewed', 'لقد قيّمت هذه الأكاديمية بالفعل'));
          }
          throw new Error(res.error.message);
        }
        showToast(
          state.myRating
            ? getLabel('academy_details.review_updated', 'تم تحديث تقييمك')
            : getLabel('academy_details.review_added', 'تم إضافة تقييمك بنجاح'),
          'success'
        );
        state.myRating = null;
        return reloadData();
      })
      .catch(function (err) {
        showToast(err.message || getLabel('errors.generic', 'حدث خطأ'), 'error');
      });
  }

  function deleteReview() {
    var sb = getSb();
    if (!sb || !state.myRating) return;

    Promise.resolve()
      .then(function () {
        return sb.from('academy_ratings').delete().eq('id', state.myRating.id);
      })
      .then(function (res) {
        if (res.error) throw new Error(res.error.message);
        showToast(getLabel('academy_details.review_deleted', 'تم حذف تقييمك'), 'success');
        state.myRating = null;
        return reloadData();
      })
      .catch(function (err) {
        showToast(err.message || getLabel('errors.generic', 'حدث خطأ'), 'error');
      });
  }

  /* ============================================================
     16. RENDER — FULL PAGE
     ============================================================ */

  function render() {
    var container = $('academyResult');
    if (!container || !state.academy) return;

    var html = ''
      + renderProfileCard(state.academy)
      + renderDescription(state.academy)
      + renderContact(state.academy)
      + renderBranches()
      + renderCourses()
      + renderReviewsSection(state.academy);

    container.innerHTML = html;
    bindLocalEvents();
    showResult();
  }

  /* ============================================================
     17. SHARE
     ============================================================ */

  function shareAcademy() {
    var a = state.academy;
    if (!a) return;

    var url = window.location.href;
    var title = a.name || '';
    var text = getLabel('academy_details.share_text', 'تفقد هذه الأكاديمية المعتمدة: ') + title;

    if (navigator.share) {
      navigator.share({ title: title, text: text, url: url })
        .catch(function (err) {
          if (err && err.name !== 'AbortError') copyToClipboard(url);
        });
    } else {
      copyToClipboard(url);
    }
  }

  function copyToClipboard(text) {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text)
        .then(function () {
          showToast(getLabel('common.link_copied', 'تم نسخ الرابط'), 'success');
        })
        .catch(function () { fallbackCopy(text); });
    } else {
      fallbackCopy(text);
    }
  }

  function fallbackCopy(text) {
    try {
      var ta = document.createElement('textarea');
      ta.value = text;
      ta.style.cssText = 'position:fixed;opacity:0;';
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      document.body.removeChild(ta);
      showToast(getLabel('common.link_copied', 'تم نسخ الرابط'), 'success');
    } catch (e) {
      showToast(getLabel('common.copy_failed', 'تعذر النسخ'), 'error');
    }
  }

  /* ============================================================
     18. LOCAL EVENT BINDING
     ============================================================ */

  function bindLocalEvents() {
    var shareBtn = $('academyShareBtn');
    if (shareBtn) shareBtn.addEventListener('click', shareAcademy);

    var addReviewBtn = $('addReviewBtn');
    if (addReviewBtn) addReviewBtn.addEventListener('click', openReviewModal);
  }

  /* ============================================================
     19. RELOAD
     ============================================================ */

  function reloadData() {
    var id = state.academyId;
    if (!id) return Promise.resolve();

    return fetchAcademy(id)
      .then(function (academy) {
        if (!academy) {
          showNotFound();
          return;
        }
        state.academy = academy;

        return Promise.all([
          fetchCategory(academy.category_id),
          fetchGovernorate(academy.governorate_id),
          fetchBranches(id),
          fetchCourses(id),
          fetchRatings(id),
          fetchMyRating(id, state.currentUser ? state.currentUser.id : null)
        ]).then(function (results) {
          state.category = results[0];
          state.governorate = results[1];
          state.branches = results[2] || [];
          state.courses = results[3] || [];
          state.ratings = results[4] || [];
          state.myRating = results[5] || null;
          render();
        });
      })
      .catch(function (err) {
        showError(err.message);
      });
  }

  /* ============================================================
     20. REALTIME
     ============================================================ */

  function setupRealtime() {
    if (!window.Realtime || typeof window.Realtime.subscribe !== 'function') return;
    if (!state.academyId) return;

    try {
      var u1 = window.Realtime.subscribe('academies', function () {
        reloadData();
      }, {
        filter: 'id=eq.' + state.academyId,
        debounce: 800
      });

      var u2 = window.Realtime.subscribe('academy_ratings', function () {
        reloadData();
      }, {
        filter: 'academy_id=eq.' + state.academyId,
        debounce: 800
      });

      state.realtimeUnsubs = [u1, u2];
    } catch (e) {
      log('error', 'Realtime setup failed', e);
    }
  }

  function cleanup() {
    state.realtimeUnsubs.forEach(function (u) {
      try { u(); } catch (e) {}
    });
    state.realtimeUnsubs = [];
  }

  /* ============================================================
     21. INIT
     ============================================================ */

  function init() {
    if (state._initialized) return;
    state._initialized = true;

    log('debug', 'Academy details initializing');

    state.academyId = readAcademyId();

    if (!state.academyId) {
      showNotFound();
      log('debug', 'No academy id in URL');
      return;
    }

    showLoading();

    loadCurrentUser()
      .then(function () {
        return reloadData();
      })
      .then(function () {
        setupRealtime();
      })
      .catch(function (err) {
        showError(err.message);
      });

    // Retry button
    var retryBtn = $('retryBtn');
    if (retryBtn) {
      retryBtn.addEventListener('click', function () {
        showLoading();
        reloadData().then(setupRealtime);
      });
    }

    if (typeof window.addEventListener === 'function') {
      window.addEventListener('beforeunload', cleanup);
    }
  }

  /* ============================================================
     22. EXPORT
     ============================================================ */

  window.AcademyDetailsPage = {
    _initialized: true,
    init: init,
    refresh: reloadData,
    getState: function () {
      return {
        academyId: state.academyId,
        loading: state.loading,
        error: state.error,
        notFound: state.notFound,
        academy: state.academy ? state.academy.name : null,
        branches: state.branches.length,
        courses: state.courses.length,
        ratings: state.ratings.length,
        myRating: !!state.myRating
      };
    }
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  var cfg = window.ITWS_CONFIG || {};
  if (cfg.DEBUG) {
    try {
      console.log('%c[AcademyDetailsPage]', 'color: #F59E0B; font-weight: bold;', 'Module ready');
    } catch (e) {}
  }

})();
