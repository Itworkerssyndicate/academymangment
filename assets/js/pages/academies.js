/* ============================================================
   ITWS Platform — Academies Directory Page Logic V2
   File: assets/js/pages/academies.js
   Description: Fetch + filter + search + sort + paginate academies

   Load order: AFTER all core modules + AFTER academies.html markup

   Features:
   - Fetches approved academies from Supabase
   - Joins academy_categories + governorates
   - Populates category & governorate filters dynamically
   - Debounced search (350ms)
   - Sort: latest / rating / name
   - Client-side pagination (pageSize from settings)
   - Active filter chips (removable)
   - Clear all filters button
   - URL state sync (?q= &category= &gov= &sort= &page=)
   - Realtime updates (new/updated/deleted academies)
   - Loading / error / empty states
   - All strings from Labels.t() with fallbacks
   - Uses SVG icons via Icons.get()
   - RTL aware, R13 responsive
   - No emoji

   Rules:
   - No emoji
   - ES5-style IIFE
   - window.sb only
   - Never exposes national_id or sensitive data
   - Resets page to 1 when filters change
   ============================================================ */

(function () {
  'use strict';

  if (window.AcademiesPage && window.AcademiesPage._initialized) {
    return;
  }

  /* ============================================================
     1. HELPERS
     ============================================================ */

  function log(level, msg, data) {
    var cfg = window.ITWS_CONFIG || {};
    if (level === 'error' || (cfg.DEBUG && level === 'debug')) {
      try {
        var args = ['[AcademiesPage]', msg];
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

  function debounce(fn, wait) {
    var timer = null;
    return function () {
      var ctx = this;
      var args = arguments;
      clearTimeout(timer);
      timer = setTimeout(function () { fn.apply(ctx, args); }, wait || 350);
    };
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

  function show(el) { if (el) el.classList.add('is-visible'); }
  function hide(el) { if (el) el.classList.remove('is-visible'); }
  function showFlex(el) { if (el) el.classList.add('is-visible'); }

  /* ============================================================
     2. STATE
     ============================================================ */

  var state = {
    _initialized: false,
    loading: false,
    error: null,
    academies: [],
    categories: [],
    governorates: [],
    filtered: [],
    page: 1,
    pageSize: 12,
    filters: {
      search: '',
      category: '',
      governorate: '',
      sort: 'latest'
    },
    realtimeUnsub: null
  };

  var DEFAULTS = {
    pageSize: 12
  };

  /* ============================================================
     3. READ URL STATE
     ============================================================ */

  function readUrlState() {
    try {
      var params = new URLSearchParams(window.location.search);

      var q = params.get('q');
      if (q) state.filters.search = String(q).trim();

      var cat = params.get('category');
      if (cat) state.filters.category = String(cat).trim();

      var gov = params.get('gov');
      if (gov) state.filters.governorate = String(gov).trim();

      var sort = params.get('sort');
      if (sort && ['latest', 'rating', 'name'].indexOf(sort) !== -1) {
        state.filters.sort = sort;
      }

      var page = parseInt(params.get('page'), 10);
      if (isFinite(page) && page > 0) state.page = page;
    } catch (e) {}
  }

  /* ============================================================
     4. WRITE URL STATE
     ============================================================ */

  function writeUrlState() {
    try {
      var url = new URL(window.location.href);

      if (state.filters.search) url.searchParams.set('q', state.filters.search);
      else url.searchParams.delete('q');

      if (state.filters.category) url.searchParams.set('category', state.filters.category);
      else url.searchParams.delete('category');

      if (state.filters.governorate) url.searchParams.set('gov', state.filters.governorate);
      else url.searchParams.delete('gov');

      if (state.filters.sort && state.filters.sort !== 'latest') {
        url.searchParams.set('sort', state.filters.sort);
      } else {
        url.searchParams.delete('sort');
      }

      if (state.page > 1) url.searchParams.set('page', String(state.page));
      else url.searchParams.delete('page');

      window.history.replaceState({}, '', url.toString());
    } catch (e) {}
  }

  /* ============================================================
     5. FETCH — ACADEMIES
     ============================================================ */

  function fetchAcademies() {
    var sb = getSb();
    if (!sb) {
      return Promise.reject(new Error(getLabel('errors.network', 'تعذر الاتصال بالخادم')));
    }

    return sb.from('academies')
      .select('id, name, description, logo_url, cover_url, category_id, governorate_id, city, status, is_deleted, rating_avg, rating_count, is_rating_visible, created_at, approved_at')
      .eq('status', 'approved')
      .eq('is_deleted', false)
      .order('created_at', { ascending: false })
      .then(function (res) {
        if (res.error) throw new Error(res.error.message);
        return res.data || [];
      });
  }

  function fetchCategories() {
    var sb = getSb();
    if (!sb) return Promise.resolve([]);

    return sb.from('academy_categories')
      .select('id, name_ar')
      .eq('is_active', true)
      .order('order_index', { ascending: true })
      .then(function (res) {
        if (res.error) return [];
        return res.data || [];
      })
      .catch(function () { return []; });
  }

  function fetchGovernorates() {
    var sb = getSb();
    if (!sb) return Promise.resolve([]);

    return sb.from('governorates')
      .select('id, name_ar, code')
      .eq('is_active', true)
      .order('order_index', { ascending: true })
      .then(function (res) {
        if (res.error) return [];
        return res.data || [];
      })
      .catch(function () { return []; });
  }

  /* ============================================================
     6. POPULATE FILTERS
     ============================================================ */

  function populateCategoryFilter() {
    var select = $('filterCategory');
    if (!select) return;

    // Keep first option ("كل التصنيفات")
    var firstOption = select.querySelector('option');
    select.innerHTML = '';

    if (firstOption) select.appendChild(firstOption);
    else {
      var allOpt = document.createElement('option');
      allOpt.value = '';
      allOpt.textContent = getLabel('academies.filter.all_categories', 'كل التصنيفات');
      select.appendChild(allOpt);
    }

    state.categories.forEach(function (cat) {
      var opt = document.createElement('option');
      opt.value = String(cat.id);
      opt.textContent = cat.name_ar || 'تصنيف';
      select.appendChild(opt);
    });

    if (state.filters.category) {
      select.value = String(state.filters.category);
    }
  }

  function populateGovernorateFilter() {
    var select = $('filterGovernorate');
    if (!select) return;

    var firstOption = select.querySelector('option');
    select.innerHTML = '';

    if (firstOption) select.appendChild(firstOption);
    else {
      var allOpt = document.createElement('option');
      allOpt.value = '';
      allOpt.textContent = getLabel('academies.filter.all_governorates', 'كل المحافظات');
      select.appendChild(allOpt);
    }

    state.governorates.forEach(function (gov) {
      var opt = document.createElement('option');
      opt.value = String(gov.id);
      opt.textContent = gov.name_ar || 'محافظة';
      select.appendChild(opt);
    });

    if (state.filters.governorate) {
      select.value = String(state.filters.governorate);
    }
  }

  /* ============================================================
     7. APPLY FILTERS + SORT
     ============================================================ */

  function applyFilters() {
    var search = (state.filters.search || '').toLowerCase().trim();
    var catId = state.filters.category ? parseInt(state.filters.category, 10) : null;
    var govId = state.filters.governorate ? parseInt(state.filters.governorate, 10) : null;

    var result = state.academies.filter(function (a) {
      // Search
      if (search) {
        var haystack = ((a.name || '') + ' ' + (a.description || '') + ' ' + (a.city || '')).toLowerCase();
        if (haystack.indexOf(search) === -1) return false;
      }

      // Category
      if (catId && a.category_id !== catId) return false;

      // Governorate
      if (govId && a.governorate_id !== govId) return false;

      return true;
    });

    // Sort
    var sort = state.filters.sort || 'latest';
    if (sort === 'rating') {
      result.sort(function (a, b) {
        var ra = Number(a.rating_avg) || 0;
        var rb = Number(b.rating_avg) || 0;
        if (rb !== ra) return rb - ra;
        return (Number(b.rating_count) || 0) - (Number(a.rating_count) || 0);
      });
    } else if (sort === 'name') {
      result.sort(function (a, b) {
        return String(a.name || '').localeCompare(String(b.name || ''), 'ar');
      });
    } else {
      // latest
      result.sort(function (a, b) {
        var da = new Date(a.approved_at || a.created_at || 0).getTime();
        var db = new Date(b.approved_at || b.created_at || 0).getTime();
        return db - da;
      });
    }

    state.filtered = result;

    // Reset page if out of range
    var maxPage = Math.max(1, Math.ceil(result.length / state.pageSize));
    if (state.page > maxPage) state.page = maxPage;
  }

  /* ============================================================
     8. RENDER CARDS
     ============================================================ */

  function renderStars(ratingAvg, ratingCount) {
    var rating = Number(ratingAvg) || 0;
    if (rating > 5) rating = 5;
    if (rating < 0) rating = 0;

    var count = Number(ratingCount) || 0;
    var fullStars = Math.floor(rating);
    var hasHalf = (rating - fullStars) >= 0.5;
    var emptyStars = 5 - fullStars - (hasHalf ? 1 : 0);

    var html = '<span class="academy-dir-card-stars" aria-hidden="true">';
    for (var i = 0; i < fullStars; i++) {
      html += icon('star-filled', 13);
    }
    if (hasHalf) {
      // Approximate half with full star — can be refined
      html += icon('star-filled', 13);
      emptyStars = 5 - fullStars - 1;
    }
    for (var j = 0; j < emptyStars; j++) {
      html += icon('star', 13).replace('class="', 'class="star-empty ');
    }
    html += '</span>';

    var displayRating = rating.toFixed(1);
    html += '<span class="academy-dir-card-rating-count">'
      + '<strong>' + escapeHtml(displayRating) + '</strong>'
      + ' (' + count + ')</span>';

    return html;
  }

  function renderCard(academy) {
    var logoHtml = '';
    if (academy.logo_url) {
      logoHtml = '<img src="' + escapeHtml(academy.logo_url) + '" alt="" loading="lazy" onerror="this.parentNode.textContent=\'' + escapeHtml((academy.name || 'أ').charAt(0)) + '\';">';
    } else {
      logoHtml = escapeHtml((academy.name || 'أ').charAt(0));
    }

    var categoryName = '';
    if (academy.category_id) {
      var cat = state.categories.find(function (c) { return c.id === academy.category_id; });
      if (cat) categoryName = cat.name_ar || '';
    }

    var govName = '';
    if (academy.governorate_id) {
      var gov = state.governorates.find(function (g) { return g.id === academy.governorate_id; });
      if (gov) govName = gov.name_ar || '';
    }

    var city = academy.city || '';
    var location = govName && city ? (govName + ' — ' + city) : (govName || city || '');

    var metaHtml = '';
    if (location) {
      metaHtml += '<span class="academy-dir-card-meta-item">'
        + icon('map-pin', 14)
        + '<span>' + escapeHtml(location) + '</span>'
        + '</span>';
    }

    var ratingHtml = '';
    if (academy.is_rating_visible !== false && (Number(academy.rating_count) > 0)) {
      ratingHtml = '<div class="academy-dir-card-rating">'
        + renderStars(academy.rating_avg, academy.rating_count)
        + '</div>';
    }

    var badgeHtml = '<span class="academy-dir-card-badge">'
      + icon('check-circle', 11)
      + '<span>' + escapeHtml(getLabel('academies.card.verified', 'معتمدة')) + '</span>'
      + '</span>';

    return ''
      + '<a href="' + escapeHtml(resolve('academy-details.html?id=' + encodeURIComponent(academy.id))) + '" '
      +   'class="academy-dir-card" role="listitem" '
      +   'aria-label="' + escapeHtml(academy.name || '') + '">'
      +   badgeHtml
      +   '<div class="academy-dir-card-header">'
      +     '<div class="academy-dir-card-logo">' + logoHtml + '</div>'
      +     '<div class="academy-dir-card-info">'
      +       '<h3 class="academy-dir-card-name">' + escapeHtml(academy.name || '') + '</h3>'
      +       (categoryName ? '<div class="academy-dir-card-category">' + icon('tag', 12) + '<span>' + escapeHtml(categoryName) + '</span></div>' : '')
      +     '</div>'
      +   '</div>'
      +   (academy.description ? '<p class="academy-dir-card-desc">' + escapeHtml(academy.description) + '</p>' : '<p class="academy-dir-card-desc"></p>')
      +   '<div class="academy-dir-card-meta">'
      +     metaHtml
      +     ratingHtml
      +   '</div>'
      + '</a>';
  }

  /* ============================================================
     9. RENDER GRID + PAGINATION
     ============================================================ */

  function renderGrid() {
    var grid = $('academiesGrid');
    if (!grid) return;

    var total = state.filtered.length;
    var start = (state.page - 1) * state.pageSize;
    var end = start + state.pageSize;
    var pageItems = state.filtered.slice(start, end);

    if (total === 0) {
      grid.innerHTML = '';
      return;
    }

    grid.innerHTML = pageItems.map(renderCard).join('');
  }

  function computePageNumbers(current, total) {
    if (total <= 7) {
      var all = [];
      for (var i = 1; i <= total; i++) all.push(i);
      return all;
    }
    var result = [1];
    if (current > 3) result.push('...');
    var start = Math.max(2, current - 1);
    var end = Math.min(total - 1, current + 1);
    for (var j = start; j <= end; j++) result.push(j);
    if (current < total - 2) result.push('...');
    result.push(total);
    return result;
  }

  function renderPagination() {
    var el = $('academiesPagination');
    if (!el) return;

    var total = state.filtered.length;
    var totalPages = Math.max(1, Math.ceil(total / state.pageSize));

    if (total === 0) {
      el.innerHTML = '';
      return;
    }

    var prevDisabled = state.page <= 1;
    var nextDisabled = state.page >= totalPages;

    var html = '<button type="button" class="academies-page-btn" data-page="prev" '
      + (prevDisabled ? 'disabled' : '')
      + ' aria-label="' + escapeHtml(getLabel('common.previous', 'السابق')) + '">'
      + icon('chevron-right', 16)
      + '</button>';

    computePageNumbers(state.page, totalPages).forEach(function (p) {
      if (p === '...') {
        html += '<span class="academies-page-ellipsis">…</span>';
      } else {
        html += '<button type="button" class="academies-page-btn'
          + (p === state.page ? ' is-active' : '')
          + '" data-page="' + p + '">' + p + '</button>';
      }
    });

    html += '<button type="button" class="academies-page-btn" data-page="next" '
      + (nextDisabled ? 'disabled' : '')
      + ' aria-label="' + escapeHtml(getLabel('common.next', 'التالي')) + '">'
      + icon('chevron-left', 16)
      + '</button>';

    el.innerHTML = html;

    // Bind pagination
    el.querySelectorAll('[data-page]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        if (btn.disabled) return;
        var target = btn.getAttribute('data-page');
        if (target === 'prev') state.page = Math.max(1, state.page - 1);
        else if (target === 'next') state.page = Math.min(totalPages, state.page + 1);
        else state.page = parseInt(target, 10);
        writeUrlState();
        renderGrid();
        renderPagination();
        // Scroll to grid top
        try {
          grid.scrollIntoView({ behavior: 'smooth', block: 'start' });
        } catch (e) {}
      });
    });
  }

  /* ============================================================
     10. RENDER COUNTER + CLEAR BTN
     ============================================================ */

  function renderCounters() {
    var count = $('academiesFiltersCount');
    if (count) {
      var total = state.filtered.length;
      var totalAll = state.academies.length;
      var text;
      if (total === totalAll) {
        text = getLabel('academies.filters.count_all', 'عرض {n} أكاديمية').replace('{n}', String(total));
      } else {
        text = getLabel('academies.filters.count_filtered', 'عرض {n} من {total} أكاديمية')
          .replace('{n}', String(total))
          .replace('{total}', String(totalAll));
      }
      count.textContent = text;
    }

    var clearBtn = $('clearFiltersBtn');
    if (clearBtn) {
      var hasFilters = !!(
        state.filters.search ||
        state.filters.category ||
        state.filters.governorate ||
        (state.filters.sort && state.filters.sort !== 'latest')
      );
      if (hasFilters) clearBtn.removeAttribute('hidden');
      else clearBtn.setAttribute('hidden', '');
    }
  }

  /* ============================================================
     11. RENDER ACTIVE FILTERS CHIPS
     ============================================================ */

  function renderActiveFilters() {
    var container = $('academiesActiveFilters');
    if (!container) return;

    var chips = [];

    if (state.filters.search) {
      chips.push({
        type: 'search',
        label: getLabel('academies.chip.search', 'بحث') + ': ' + state.filters.search
      });
    }

    if (state.filters.category) {
      var cat = state.categories.find(function (c) { return String(c.id) === String(state.filters.category); });
      chips.push({
        type: 'category',
        label: cat ? cat.name_ar : state.filters.category
      });
    }

    if (state.filters.governorate) {
      var gov = state.governorates.find(function (g) { return String(g.id) === String(state.filters.governorate); });
      chips.push({
        type: 'governorate',
        label: gov ? gov.name_ar : state.filters.governorate
      });
    }

    if (state.filters.sort && state.filters.sort !== 'latest') {
      var sortLabel = state.filters.sort === 'rating'
        ? getLabel('academies.sort.rating', 'الأعلى تقييماً')
        : getLabel('academies.sort.name', 'الأبجدي');
      chips.push({ type: 'sort', label: sortLabel });
    }

    if (chips.length === 0) {
      container.setAttribute('hidden', '');
      container.innerHTML = '';
      return;
    }

    container.innerHTML = chips.map(function (c) {
      return '<span class="chip" data-filter-type="' + escapeHtml(c.type) + '">'
        + '<span>' + escapeHtml(c.label) + '</span>'
        + '<button type="button" data-clear="' + escapeHtml(c.type) + '" '
        + 'aria-label="' + escapeHtml(getLabel('common.remove', 'إزالة')) + '">'
        + icon('x', 12)
        + '</button>'
        + '</span>';
    }).join('');

    container.removeAttribute('hidden');

    // Bind chips clear buttons
    container.querySelectorAll('[data-clear]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var type = btn.getAttribute('data-clear');
        if (type === 'search') {
          state.filters.search = '';
          var input = $('academiesSearchInput');
          if (input) input.value = '';
        } else if (type === 'category') {
          state.filters.category = '';
          var catSel = $('filterCategory');
          if (catSel) catSel.value = '';
        } else if (type === 'governorate') {
          state.filters.governorate = '';
          var govSel = $('filterGovernorate');
          if (govSel) govSel.value = '';
        } else if (type === 'sort') {
          state.filters.sort = 'latest';
          var sortSel = $('filterSort');
          if (sortSel) sortSel.value = 'latest';
        }
        state.page = 1;
        writeUrlState();
        applyFilters();
        renderGrid();
        renderPagination();
        renderCounters();
        renderActiveFilters();
        updateStates();
      });
    });
  }

  /* ============================================================
     12. UPDATE VISIBILITY STATES
     ============================================================ */

  function updateStates() {
    var loader = $('academiesLoader');
    var errorEl = $('academiesError');
    var emptyEl = $('academiesEmpty');
    var grid = $('academiesGrid');
    var pag = $('academiesPagination');
    var filters = $('academiesFilters');

    if (state.loading) {
      if (loader) loader.classList.add('is-visible');
      if (errorEl) errorEl.classList.remove('is-visible');
      if (emptyEl) emptyEl.classList.remove('is-visible');
      if (grid) grid.style.display = 'none';
      if (pag) pag.style.display = 'none';
      return;
    }

    if (loader) loader.classList.remove('is-visible');

    if (state.error) {
      if (errorEl) errorEl.classList.add('is-visible');
      if (emptyEl) emptyEl.classList.remove('is-visible');
      if (grid) grid.style.display = 'none';
      if (pag) pag.style.display = 'none';
      return;
    }

    if (errorEl) errorEl.classList.remove('is-visible');

    if (state.filtered.length === 0) {
      // Empty state
      if (emptyEl) emptyEl.classList.add('is-visible');

      // Customize empty text based on filters
      var emptyText = $('academiesEmptyText');
      if (emptyText) {
        var hasFilters = !!(
          state.filters.search ||
          state.filters.category ||
          state.filters.governorate
        );
        if (hasFilters) {
          emptyText.textContent = getLabel('academies.empty.filtered',
            'لم يتم العثور على أكاديميات مطابقة لبحثك. جرّب مسح الفلاتر');
        } else {
          emptyText.textContent = getLabel('academies.empty.none',
            'لم تتم إضافة أي أكاديميات معتمدة بعد');
        }
      }

      if (grid) grid.style.display = 'none';
      if (pag) pag.style.display = 'none';
      return;
    }

    // Has results
    if (emptyEl) emptyEl.classList.remove('is-visible');
    if (grid) grid.style.display = '';
    if (pag) pag.style.display = '';
  }

  /* ============================================================
     13. FULL REFRESH PIPELINE
     ============================================================ */

  function refreshRendering() {
    applyFilters();
    renderGrid();
    renderPagination();
    renderCounters();
    renderActiveFilters();
    updateStates();
  }

  function loadData(initialLoad) {
    state.loading = true;
    state.error = null;
    updateStates();

    var promises = [fetchAcademies()];

    if (initialLoad) {
      promises.push(fetchCategories());
      promises.push(fetchGovernorates());
    } else {
      promises.push(Promise.resolve(state.categories));
      promises.push(Promise.resolve(state.governorates));
    }

    Promise.all(promises)
      .then(function (results) {
        state.academies = results[0] || [];
        state.categories = results[1] || [];
        state.governorates = results[2] || [];

        if (initialLoad) {
          populateCategoryFilter();
          populateGovernorateFilter();
        }

        state.loading = false;
        refreshRendering();

        dispatchEvent('itws:academies-loaded', {
          count: state.academies.length
        });

        log('debug', 'Loaded academies', {
          count: state.academies.length,
          filtered: state.filtered.length
        });
      })
      .catch(function (err) {
        state.loading = false;
        state.error = (err && err.message) || getLabel('errors.network', 'تعذر الاتصال بالخادم');
        updateStates();

        var errorText = $('errorText');
        if (errorText) errorText.textContent = state.error;

        log('error', 'Load failed', err);
      });
  }

  /* ============================================================
     14. BIND FILTERS
     ============================================================ */

  function bindFilters() {
    // Search
    var searchInput = $('academiesSearchInput');
    if (searchInput) {
      if (state.filters.search) searchInput.value = state.filters.search;

      var debouncedSearch = debounce(function (value) {
        state.filters.search = value;
        state.page = 1;
        writeUrlState();
        refreshRendering();
      }, 350);

      searchInput.addEventListener('input', function (e) {
        debouncedSearch(e.target.value || '');
      });
    }

    // Category
    var catSelect = $('filterCategory');
    if (catSelect) {
      catSelect.addEventListener('change', function (e) {
        state.filters.category = e.target.value || '';
        state.page = 1;
        writeUrlState();
        refreshRendering();
      });
    }

    // Governorate
    var govSelect = $('filterGovernorate');
    if (govSelect) {
      govSelect.addEventListener('change', function (e) {
        state.filters.governorate = e.target.value || '';
        state.page = 1;
        writeUrlState();
        refreshRendering();
      });
    }

    // Sort
    var sortSelect = $('filterSort');
    if (sortSelect) {
      sortSelect.value = state.filters.sort || 'latest';
      sortSelect.addEventListener('change', function (e) {
        state.filters.sort = e.target.value || 'latest';
        state.page = 1;
        writeUrlState();
        refreshRendering();
      });
    }

    // Clear filters
    var clearBtn = $('clearFiltersBtn');
    if (clearBtn) {
      clearBtn.addEventListener('click', function () {
        state.filters.search = '';
        state.filters.category = '';
        state.filters.governorate = '';
        state.filters.sort = 'latest';
        state.page = 1;

        if (searchInput) searchInput.value = '';
        if (catSelect) catSelect.value = '';
        if (govSelect) govSelect.value = '';
        if (sortSelect) sortSelect.value = 'latest';

        writeUrlState();
        refreshRendering();
      });
    }

    // Retry
    var retryBtn = $('retryBtn');
    if (retryBtn) {
      retryBtn.addEventListener('click', function () {
        loadData(true);
      });
    }
  }

  /* ============================================================
     15. REALTIME
     ============================================================ */

  function setupRealtime() {
    if (!window.Realtime || typeof window.Realtime.subscribe !== 'function') {
      return;
    }

    try {
      state.realtimeUnsub = window.Realtime.subscribe(
        'academies',
        function () {
          // Re-fetch on any change (debounced by realtime.js)
          loadData(false);
        },
        { debounce: 800, events: ['INSERT', 'UPDATE', 'DELETE'] }
      );
    } catch (e) {
      log('error', 'Realtime subscribe failed', e);
    }
  }

  function cleanupRealtime() {
    if (state.realtimeUnsub) {
      try { state.realtimeUnsub(); } catch (e) {}
      state.realtimeUnsub = null;
    }
  }

  /* ============================================================
     16. PAGE SIZE FROM SETTINGS
     ============================================================ */

  function readPageSize() {
    var size = parseInt(getSetting('behavior.pagination_public_size', DEFAULTS.pageSize), 10);
    if (!isFinite(size) || size < 3) size = DEFAULTS.pageSize;
    if (size > 50) size = 50;
    state.pageSize = size;
  }

  /* ============================================================
     17. INIT
     ============================================================ */

  function init() {
    if (state._initialized) return;
    state._initialized = true;

    log('debug', 'Academies page initializing');

    readPageSize();
    readUrlState();
    bindFilters();
    loadData(true);
    setupRealtime();

    // Cleanup
    if (typeof window.addEventListener === 'function') {
      window.addEventListener('beforeunload', cleanupRealtime);
    }

    log('debug', 'Academies page ready');
  }

  /* ============================================================
     18. EXPORT
     ============================================================ */

  window.AcademiesPage = {
    _initialized: true,
    init: init,
    refresh: function () { return loadData(false); },
    getState: function () {
      return {
        loading: state.loading,
        error: state.error,
        total: state.academies.length,
        filtered: state.filtered.length,
        page: state.page,
        pageSize: state.pageSize,
        filters: {
          search: state.filters.search,
          category: state.filters.category,
          governorate: state.filters.governorate,
          sort: state.filters.sort
        }
      };
    },
    setFilter: function (type, value) {
      if (type === 'search' || type === 'category' || type === 'governorate' || type === 'sort') {
        state.filters[type] = value || '';
        state.page = 1;
        writeUrlState();
        refreshRendering();
      }
    },
    clearFilters: function () {
      state.filters.search = '';
      state.filters.category = '';
      state.filters.governorate = '';
      state.filters.sort = 'latest';
      state.page = 1;
      writeUrlState();
      refreshRendering();
    }
  };

  // Boot
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  /* ============================================================
     19. DEBUG
     ============================================================ */

  var cfg = window.ITWS_CONFIG || {};
  if (cfg.DEBUG) {
    try {
      console.log('%c[AcademiesPage]', 'color: #F59E0B; font-weight: bold;', 'Module ready');
    } catch (e) {}
  }

})();
