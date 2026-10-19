// ============================================
// [27/50] ITWS Platform - Academies Directory Logic
// Path: assets/js/pages/academies.js
// ============================================
// منطق صفحة دليل الأكاديميات
// بدون إيموجي
// مسارات نسبية
// ============================================

(function () {
  'use strict';

  if (window.AcademiesPage && window.AcademiesPage.initialized) return;

  var ITEMS_PER_PAGE = 12;

  var state = {
    allAcademies: [],
    allCategories: [],
    allGovernorates: [],
    filteredAcademies: [],
    currentPage: 1,
    filters: {
      search: '',
      category: '',
      governorate: '',
      sort: 'newest'
    },
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
      console.log.apply(console, ['[AcademiesPage]'].concat(Array.prototype.slice.call(arguments)));
    }
  }

  function resolve(path) {
    if (!path) return '#';
    if (window.resolveUrl) return window.resolveUrl(path);
    var base = (window.ITWS_CONFIG && window.ITWS_CONFIG.BASE_PATH) || '';
    return base + String(path).replace(/^\.?\//, '');
  }

  // ============================================
  // 2. Dynamic content
  // ============================================
  function applyDynamicContent() {
    setText('footerCopyright', getSetting('app_identity.footer_text', '© 2026 نقابة تكنولوجيا المعلومات والبرمجيات'));
    setText('footerPresidentLabel', getSetting('app_identity.president_label', 'النقيب العام:'));
    setText('footerPresidentName', getSetting('app_identity.president_name', 'المحاسب / محمود جميل'));
  }

  // ============================================
  // 3. Load categories (للفلترة)
  // ============================================
  function loadCategories() {
    if (!window.sb) return Promise.resolve([]);

    return window.sb
      .from('academy_categories')
      .select('id, name, name_en, color, sort_order')
      .eq('is_active', true)
      .order('sort_order', { ascending: true })
      .then(function (res) {
        if (res.error || !res.data) return [];
        return res.data;
      })
      .catch(function () { return []; });
  }

  // ============================================
  // 4. Load academies + branches (bulk)
  // ============================================
  function loadAcademies() {
    if (!window.sb) return Promise.reject(new Error('Supabase not available'));

    return window.sb
      .from('academies')
      .select('id, name, license_number, category_id, logo_url, description, created_at, branches:academy_branches(id, governorate, address, is_main)')
      .eq('status', 'approved')
      .eq('is_deleted', false)
      .order('created_at', { ascending: false });
  }

  // ============================================
  // 5. Populate filter dropdowns
  // ============================================
  function populateFilters() {
    // Categories
    var categoryFilter = $('categoryFilter');
    if (categoryFilter && state.allCategories.length > 0) {
      var currentVal = categoryFilter.value;
      var html = '<option value="">جميع التصنيفات</option>';
      state.allCategories.forEach(function (cat) {
        html += '<option value="' + escapeHtml(cat.id) + '">' + escapeHtml(cat.name) + '</option>';
      });
      categoryFilter.innerHTML = html;
      categoryFilter.value = currentVal;
    }

    // Governorates
    var govFilter = $('governorateFilter');
    if (govFilter) {
      var govSet = {};
      state.allAcademies.forEach(function (a) {
        if (a.branches && a.branches.length) {
          a.branches.forEach(function (b) {
            if (b.governorate) govSet[b.governorate] = true;
          });
        }
      });
      var govs = Object.keys(govSet).sort();
      state.allGovernorates = govs;

      var currentVal2 = govFilter.value;
      var html2 = '<option value="">جميع المحافظات</option>';
      govs.forEach(function (g) {
        html2 += '<option value="' + escapeHtml(g) + '">' + escapeHtml(g) + '</option>';
      });
      govFilter.innerHTML = html2;
      govFilter.value = currentVal2;
    }
  }

  // ============================================
  // 6. Apply filters
  // ============================================
  function applyFilters() {
    var search = state.filters.search.trim().toLowerCase();
    var categoryId = state.filters.category;
    var governorate = state.filters.governorate;
    var sortBy = state.filters.sort;

    var filtered = state.allAcademies.filter(function (a) {
      // Search filter
      if (search) {
        var nameMatch = (a.name || '').toLowerCase().indexOf(search) !== -1;
        var licenseMatch = (a.license_number || '').toLowerCase().indexOf(search) !== -1;
        if (!nameMatch && !licenseMatch) return false;
      }

      // Category filter
      if (categoryId && a.category_id !== categoryId) return false;

      // Governorate filter
      if (governorate) {
        var hasGov = false;
        if (a.branches && a.branches.length) {
          for (var i = 0; i < a.branches.length; i++) {
            if (a.branches[i].governorate === governorate) {
              hasGov = true;
              break;
            }
          }
        }
        if (!hasGov) return false;
      }

      return true;
    });

    // Sort
    filtered.sort(function (a, b) {
      if (sortBy === 'newest') {
        return new Date(b.created_at) - new Date(a.created_at);
      }
      if (sortBy === 'oldest') {
        return new Date(a.created_at) - new Date(b.created_at);
      }
      if (sortBy === 'name') {
        return (a.name || '').localeCompare(b.name || '', 'ar');
      }
      if (sortBy === 'branches') {
        var aCount = (a.branches && a.branches.length) || 0;
        var bCount = (b.branches && b.branches.length) || 0;
        return bCount - aCount;
      }
      return 0;
    });

    state.filteredAcademies = filtered;
    state.currentPage = 1;
  }

  // ============================================
  // 7. Get category color
  // ============================================
  function getCategoryById(id) {
    for (var i = 0; i < state.allCategories.length; i++) {
      if (state.allCategories[i].id === id) return state.allCategories[i];
    }
    return null;
  }

  // ============================================
  // 8. Render academies grid
  // ============================================
  function renderAcademies() {
    var grid = $('academiesGrid');
    var empty = $('acadEmpty');
    var loader = $('acadLoader');
    var resultsHeader = $('resultsHeader');
    var pagination = $('pagination');

    if (!grid) return;

    // Hide loader
    if (loader) loader.classList.remove('show');

    var total = state.filteredAcademies.length;

    // Show header
    if (resultsHeader) {
      resultsHeader.style.display = 'flex';
      var countEl = $('resultsCount');
      if (countEl) {
        countEl.innerHTML = '<strong>' + total + '</strong> أكاديمية';
      }
    }

    // Empty state
    if (total === 0) {
      grid.style.display = 'none';
      if (empty) empty.classList.add('show');
      if (pagination) pagination.style.display = 'none';
      return;
    }

    grid.style.display = 'grid';
    if (empty) empty.classList.remove('show');

    // Pagination
    var startIndex = (state.currentPage - 1) * ITEMS_PER_PAGE;
    var endIndex = startIndex + ITEMS_PER_PAGE;
    var pageItems = state.filteredAcademies.slice(startIndex, endIndex);

    // Build cards
    var html = pageItems.map(function (a) {
      var cat = getCategoryById(a.category_id);
      var branches = a.branches || [];
      var initial = escapeHtml((a.name || '?').charAt(0));

      var logoHtml = a.logo_url
        ? '<img src="' + escapeHtml(a.logo_url) + '" alt="">'
        : initial;

      // preview فروع (أول 3)
      var branchPreview = '';
      if (branches.length > 0) {
        var shown = branches.slice(0, 3);
        branchPreview = shown.map(function (b) {
          return '<span class="academy-branch-tag">' + escapeHtml(b.governorate || '—') + '</span>';
        }).join('');
        if (branches.length > 3) {
          branchPreview += '<span class="academy-branch-tag">+' + (branches.length - 3) + '</span>';
        }
      }

      return '' +
        '<div class="academy-card" data-academy-id="' + escapeHtml(a.id) + '" role="button" tabindex="0">' +
          '<div class="academy-header">' +
            '<div class="academy-logo">' + logoHtml + '</div>' +
            '<div class="academy-info">' +
              '<h3 class="academy-name">' + escapeHtml(a.name || 'أكاديمية') + '</h3>' +
              '<span class="academy-badge">' +
                '<span class="academy-badge-dot"></span>' +
                'معتمدة' +
              '</span>' +
            '</div>' +
          '</div>' +
          '<div class="academy-body">' +
            (cat ? 
              '<div class="academy-category">' +
                '<span class="academy-category-dot"></span>' +
                escapeHtml(cat.name) +
              '</div>' 
              : '') +
            '<div class="academy-license">' +
              '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">' +
                '<rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect>' +
                '<path d="M7 11V7a5 5 0 0 1 10 0v4"></path>' +
              '</svg>' +
              '<span>' + escapeHtml(a.license_number || '—') + '</span>' +
            '</div>' +
            (branchPreview ? 
              '<div class="academy-branches-preview">' +
                '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">' +
                  '<path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path>' +
                  '<circle cx="12" cy="10" r="3"></circle>' +
                '</svg>' +
                branchPreview +
              '</div>' 
              : '') +
          '</div>' +
          '<div class="academy-footer">' +
            '<span style="font-size:12px;color:var(--text-muted);">' + branches.length + ' فرع</span>' +
            '<span class="academy-arrow">' +
              '<span>عرض التفاصيل</span>' +
              '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">' +
                '<line x1="19" y1="12" x2="5" y2="12"></line>' +
                '<polyline points="12 19 5 12 12 5"></polyline>' +
              '</svg>' +
            '</span>' +
          '</div>' +
        '</div>';
    }).join('');

    grid.innerHTML = html;

    // Bind click
    grid.querySelectorAll('[data-academy-id]').forEach(function (card) {
      var id = card.getAttribute('data-academy-id');

      card.addEventListener('click', function () {
        window.location.href = resolve('academy-details.html?id=' + encodeURIComponent(id));
      });

      card.addEventListener('keydown', function (e) {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          window.location.href = resolve('academy-details.html?id=' + encodeURIComponent(id));
        }
      });
    });

    // Render pagination
    renderPagination(total);
  }

  // ============================================
  // 9. Render pagination
  // ============================================
  function renderPagination(total) {
    var pagination = $('pagination');
    var pageNumbers = $('pageNumbers');
    var prevBtn = $('prevBtn');
    var nextBtn = $('nextBtn');

    if (!pagination || !pageNumbers) return;

    var totalPages = Math.ceil(total / ITEMS_PER_PAGE);

    if (totalPages <= 1) {
      pagination.style.display = 'none';
      return;
    }

    pagination.style.display = 'flex';

    // Page numbers (smart: 1, ..., current-1, current, current+1, ..., last)
    var current = state.currentPage;
    var pages = [];

    function addPage(n) {
      if (pages.indexOf(n) === -1) pages.push(n);
    }

    addPage(1);
    for (var i = current - 1; i <= current + 1; i++) {
      if (i > 1 && i < totalPages) addPage(i);
    }
    if (totalPages > 1) addPage(totalPages);

    pages.sort(function (a, b) { return a - b; });

    var html = '';
    var prevPage = 0;
    pages.forEach(function (n) {
      if (prevPage && n - prevPage > 1) {
        html += '<span style="padding:0 8px;color:var(--text-muted);">...</span>';
      }
      html += '<button class="pagination-btn' + (n === current ? ' active' : '') + '" data-page="' + n + '" type="button">' + n + '</button>';
      prevPage = n;
    });

    pageNumbers.innerHTML = html;

    // Bind page buttons
    pageNumbers.querySelectorAll('[data-page]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var page = parseInt(btn.getAttribute('data-page'), 10);
        if (page && page !== state.currentPage) {
          state.currentPage = page;
          renderAcademies();
          scrollToResults();
        }
      });
    });

    // Prev/Next
    if (prevBtn) prevBtn.disabled = current <= 1;
    if (nextBtn) nextBtn.disabled = current >= totalPages;
  }

  function scrollToResults() {
    var filters = document.querySelector('.acad-filters');
    if (filters) {
      var offset = filters.getBoundingClientRect().top + window.pageYOffset - 20;
      window.scrollTo({ top: offset, behavior: 'smooth' });
    }
  }

  // ============================================
  // 10. Update URL params
  // ============================================
  function updateURL() {
    try {
      var params = new URLSearchParams();
      if (state.filters.search) params.set('q', state.filters.search);
      if (state.filters.category) params.set('cat', state.filters.category);
      if (state.filters.governorate) params.set('gov', state.filters.governorate);
      if (state.filters.sort && state.filters.sort !== 'newest') params.set('sort', state.filters.sort);
      if (state.currentPage > 1) params.set('page', state.currentPage);

      var qs = params.toString();
      var url = window.location.pathname + (qs ? '?' + qs : '');
      window.history.replaceState({}, '', url);
    } catch (e) {}
  }

  // ============================================
  // 11. Read URL params
  // ============================================
  function readURL() {
    try {
      var params = new URLSearchParams(window.location.search);
      state.filters.search = params.get('q') || params.get('search') || '';
      state.filters.category = params.get('cat') || '';
      state.filters.governorate = params.get('gov') || '';
      state.filters.sort = params.get('sort') || 'newest';
      var page = parseInt(params.get('page'), 10);
      state.currentPage = page && page > 0 ? page : 1;

      // Update UI
      var searchInput = $('searchInput');
      if (searchInput && state.filters.search) searchInput.value = state.filters.search;

      var sortFilter = $('sortFilter');
      if (sortFilter) sortFilter.value = state.filters.sort;
    } catch (e) {}
  }

  // ============================================
  // 12. Sync filters from UI
  // ============================================
  function syncFiltersFromUI() {
    var searchInput = $('searchInput');
    var categoryFilter = $('categoryFilter');
    var govFilter = $('governorateFilter');
    var sortFilter = $('sortFilter');

    state.filters.search = searchInput ? searchInput.value.trim() : '';
    state.filters.category = categoryFilter ? categoryFilter.value : '';
    state.filters.governorate = govFilter ? govFilter.value : '';
    state.filters.sort = sortFilter ? sortFilter.value : 'newest';
  }

  // ============================================
  // 13. Apply changes + update
  // ============================================
  function applyAndRender() {
    syncFiltersFromUI();
    applyFilters();
    renderAcademies();
    updateURL();
  }

  // ============================================
  // 14. Reset all filters
  // ============================================
  function resetFilters() {
    var searchInput = $('searchInput');
    var categoryFilter = $('categoryFilter');
    var govFilter = $('governorateFilter');
    var sortFilter = $('sortFilter');

    if (searchInput) searchInput.value = '';
    if (categoryFilter) categoryFilter.value = '';
    if (govFilter) govFilter.value = '';
    if (sortFilter) sortFilter.value = 'newest';

    state.filters = { search: '', category: '', governorate: '', sort: 'newest' };
    state.currentPage = 1;

    applyFilters();
    renderAcademies();
    updateURL();
    scrollToResults();
  }

  // ============================================
  // 15. Bind UI events
  // ============================================
  function bindEvents() {
    // Search button
    var searchBtn = $('searchBtn');
    if (searchBtn) {
      searchBtn.addEventListener('click', function () {
        applyAndRender();
      });
    }

    // Search input (Enter)
    var searchInput = $('searchInput');
    if (searchInput) {
      searchInput.addEventListener('keydown', function (e) {
        if (e.key === 'Enter') {
          e.preventDefault();
          applyAndRender();
        }
      });
    }

    // Category filter
    var categoryFilter = $('categoryFilter');
    if (categoryFilter) {
      categoryFilter.addEventListener('change', function () {
        applyAndRender();
      });
    }

    // Governorate filter
    var govFilter = $('governorateFilter');
    if (govFilter) {
      govFilter.addEventListener('change', function () {
        applyAndRender();
      });
    }

    // Sort filter
    var sortFilter = $('sortFilter');
    if (sortFilter) {
      sortFilter.addEventListener('change', function () {
        applyAndRender();
      });
    }

    // Reset button
    var resetBtn = $('resetBtn');
    if (resetBtn) {
      resetBtn.addEventListener('click', resetFilters);
    }

    // Empty state reset
    var emptyResetBtn = $('emptyResetBtn');
    if (emptyResetBtn) {
      emptyResetBtn.addEventListener('click', resetFilters);
    }

    // Prev/Next
    var prevBtn = $('prevBtn');
    if (prevBtn) {
      prevBtn.addEventListener('click', function () {
        if (state.currentPage > 1) {
          state.currentPage--;
          renderAcademies();
          scrollToResults();
          updateURL();
        }
      });
    }

    var nextBtn = $('nextBtn');
    if (nextBtn) {
      nextBtn.addEventListener('click', function () {
        var totalPages = Math.ceil(state.filteredAcademies.length / ITEMS_PER_PAGE);
        if (state.currentPage < totalPages) {
          state.currentPage++;
          renderAcademies();
          scrollToResults();
          updateURL();
        }
      });
    }
  }

  // ============================================
  // 16. Init
  // ============================================
  function init() {
    if (state.initialized) return;
    state.initialized = true;

    applyDynamicContent();
    readURL();
    bindEvents();

    // AppSettings changes
    if (window.AppSettings && window.AppSettings.onChange) {
      window.AppSettings.onChange(function (cache, key) {
        if (!key || key === 'app_identity') applyDynamicContent();
      });
    }

    // Load data
    waitForSupabase(function () {
      var loader = $('acadLoader');
      if (loader) loader.classList.add('show');

      Promise.all([loadCategories(), loadAcademies()])
        .then(function (results) {
          var categories = results[0] || [];
          var academiesRes = results[1];

          if (academiesRes && academiesRes.error) {
            throw new Error(academiesRes.error.message);
          }

          state.allCategories = categories;
          state.allAcademies = (academiesRes && academiesRes.data) || [];

          populateFilters();

          // Restore filter values from URL
          var categoryFilter = $('categoryFilter');
          if (categoryFilter && state.filters.category) categoryFilter.value = state.filters.category;
          var govFilter = $('governorateFilter');
          if (govFilter && state.filters.governorate) govFilter.value = state.filters.governorate;
          var searchInput = $('searchInput');
          if (searchInput && state.filters.search) searchInput.value = state.filters.search;

          applyFilters();
          renderAcademies();

          logDebug('Loaded academies:', state.allAcademies.length);
        })
        .catch(function (err) {
          if (loader) loader.classList.remove('show');
          toast('حدث خطأ في تحميل الأكاديميات', 'error');
          logDebug('Load error:', err.message);

          var empty = $('acadEmpty');
          if (empty) empty.classList.add('show');
        });
    });

    logDebug('Academies page initialized');
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

  // ============================================
  // 17. Public API
  // ============================================
  window.AcademiesPage = {
    initialized: true,
    init: init,
    refresh: function () {
      state.initialized = false;
      init();
    },
    resetFilters: resetFilters,
    getState: function () { return state; }
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

})();
