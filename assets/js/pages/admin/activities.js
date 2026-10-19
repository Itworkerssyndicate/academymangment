// ============================================
// [49/50] ITWS Platform - Admin Activities Logic
// Path: assets/js/pages/admin/activities.js
// ============================================
// سجل النشاطات - Table + Filters + Pagination
// بدون إيموجي
// ============================================

(function () {
  'use strict';

  if (window.AdminActivities && window.AdminActivities.initialized) return;

  var ITEMS_PER_PAGE = 20;
  var MAX_LOAD = 500;

  var state = {
    allActivities: [],
    filteredActivities: [],
    currentPage: 1,
    currentUser: null,
    loading: false,
    initialized: false,
    filters: {
      search: '',
      type: '',
      dateFrom: '',
      dateTo: ''
    }
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

  function formatNumber(n) {
    if (n == null) return '0';
    return Number(n).toLocaleString('ar-EG');
  }

  function formatDateTime(date) {
    if (!date) return '—';
    try {
      var d = date instanceof Date ? date : (date.toDate ? date.toDate() : new Date(date));
      if (isNaN(d.getTime())) return '—';
      return d.toLocaleDateString('ar-EG', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });
    } catch (e) { return '—'; }
  }

  function formatRelativeTime(date) {
    if (!date) return '—';
    try {
      var d = date instanceof Date ? date : (date.toDate ? date.toDate() : new Date(date));
      if (isNaN(d.getTime())) return '—';
      var sec = Math.floor((Date.now() - d.getTime()) / 1000);
      if (sec < 60) return 'الآن';
      if (sec < 3600) return 'منذ ' + Math.floor(sec / 60) + ' د';
      if (sec < 86400) return 'منذ ' + Math.floor(sec / 3600) + ' س';
      if (sec < 604800) return 'منذ ' + Math.floor(sec / 86400) + ' يوم';
      return formatDateTime(d);
    } catch (e) { return '—'; }
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
      console.log.apply(console, ['[AdminActivities]'].concat(Array.prototype.slice.call(arguments)));
    }
  }

  // ============================================
  // 2. Activity Type Classification
  // ============================================
  function classifyActivityType(type) {
    var t = String(type || '').toLowerCase();

    // Login
    if (t === 'login' || t === 'login_success') {
      return {
        key: 'login',
        label: 'تسجيل دخول',
        icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4"></path><polyline points="10 17 15 12 10 7"></polyline><line x1="15" y1="12" x2="3" y2="12"></line></svg>'
      };
    }

    // Logout
    if (t === 'logout' || t === 'login_failed') {
      return {
        key: 'logout',
        label: 'تسجيل خروج',
        icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"></path><polyline points="16 17 21 12 16 7"></polyline><line x1="21" y1="12" x2="9" y2="12"></line></svg>'
      };
    }

    // Create
    if (t.indexOf('create') !== -1) {
      return {
        key: 'create',
        label: 'إضافة',
        icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="8" x2="12" y2="16"></line><line x1="8" y1="12" x2="16" y2="12"></line></svg>'
      };
    }

    // Update
    if (t.indexOf('update') !== -1) {
      return {
        key: 'update',
        label: 'تعديل',
        icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg>'
      };
    }

    // Delete
    if (t.indexOf('delete') !== -1 || t.indexOf('reject') !== -1) {
      return {
        key: 'delete',
        label: 'حذف / رفض',
        icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>'
      };
    }

    // Search
    if (t.indexOf('search') !== -1) {
      return {
        key: 'search',
        label: 'بحث',
        icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>'
      };
    }

    // View
    if (t.indexOf('view') !== -1 || t.indexOf('page_enter') !== -1) {
      return {
        key: 'view',
        label: 'عرض',
        icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path><circle cx="12" cy="12" r="3"></circle></svg>'
      };
    }

    // Approve / Move
    if (t.indexOf('approve') !== -1 || t.indexOf('move') !== -1) {
      return {
        key: 'update',
        label: 'اعتماد / نقل',
        icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>'
      };
    }

    // Default
    return {
      key: 'default',
      label: type || 'نشاط',
      icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline></svg>'
    };
  }

  function translateRole(role) {
    var map = {
      'super_admin': 'سوبر أدمن',
      'admin': 'أدمن',
      'committee_manager': 'إدارة اللجنة',
      'user': 'مستخدم'
    };
    return map[role] || role || 'مستخدم';
  }

  // ============================================
  // 3. Load Activities
  // ============================================
  function loadActivities() {
    if (!window.sb) return Promise.reject(new Error('Supabase not available'));

    return window.sb
      .from('activities')
      .select('id, user_id, user_name, user_role, action_type, type, description, created_at, timestamp, details')
      .order('created_at', { ascending: false })
      .limit(MAX_LOAD);
  }

  // ============================================
  // 4. Apply Filters
  // ============================================
  function applyFilters() {
    var search = state.filters.search.trim().toLowerCase();
    var typeFilter = state.filters.type;
    var dateFrom = state.filters.dateFrom;
    var dateTo = state.filters.dateTo;

    var fromDate = dateFrom ? new Date(dateFrom) : null;
    if (fromDate) fromDate.setHours(0, 0, 0, 0);

    var toDate = dateTo ? new Date(dateTo) : null;
    if (toDate) toDate.setHours(23, 59, 59, 999);

    var filtered = state.allActivities.filter(function (a) {
      // Search (user name + description)
      if (search) {
        var nameMatch = (a.user_name || '').toLowerCase().indexOf(search) !== -1;
        var descMatch = (a.description || '').toLowerCase().indexOf(search) !== -1;
        if (!nameMatch && !descMatch) return false;
      }

      // Type
      if (typeFilter) {
        var classified = classifyActivityType(a.action_type || a.type);
        if (classified.key !== typeFilter) return false;
      }

      // Date range
      var dateRaw = a.created_at || a.timestamp;
      if (dateRaw && (fromDate || toDate)) {
        var d = dateRaw.toDate ? dateRaw.toDate() : new Date(dateRaw);
        if (!isNaN(d.getTime())) {
          if (fromDate && d < fromDate) return false;
          if (toDate && d > toDate) return false;
        }
      }

      return true;
    });

    state.filteredActivities = filtered;
    state.currentPage = 1;
  }

  // ============================================
  // 5. Update Mini Stats
  // ============================================
  function updateMiniStats() {
    var all = state.allActivities;
    var total = all.length;

    var today = new Date();
    today.setHours(0, 0, 0, 0);

    var todayCount = 0;
    var loginCount = 0;
    var changesCount = 0;

    all.forEach(function (a) {
      var raw = a.created_at || a.timestamp;
      if (raw) {
        var d = raw.toDate ? raw.toDate() : new Date(raw);
        if (!isNaN(d.getTime()) && d >= today) todayCount++;
      }

      var classified = classifyActivityType(a.action_type || a.type);
      if (classified.key === 'login') loginCount++;
      if (classified.key === 'create' || classified.key === 'update' || classified.key === 'delete') {
        changesCount++;
      }
    });

    setText('miniTotal', formatNumber(total));
    setText('miniToday', formatNumber(todayCount));
    setText('miniLogin', formatNumber(loginCount));
    setText('miniChanges', formatNumber(changesCount));
  }

  // ============================================
  // 6. Render Table
  // ============================================
  function render() {
    var tableCard = $('tableCard');
    var tbody = $('activitiesTableBody');
    var empty = $('adminEmpty');
    var loader = $('adminLoader');
    var toolbar = $('resultsToolbar');
    var pagination = $('pagination');

    if (!tbody) return;

    if (loader) loader.classList.remove('show');

    var total = state.filteredActivities.length;

    // Toolbar
    if (toolbar) {
      toolbar.style.display = total > 0 ? 'flex' : 'none';
      setText('resultsCount', total);
    }

    // Empty
    if (total === 0) {
      if (tableCard) tableCard.style.display = 'none';
      if (empty) empty.classList.add('show');
      return;
    }

    if (tableCard) tableCard.style.display = 'block';
    if (empty) empty.classList.remove('show');

    // Slice
    var startIndex = (state.currentPage - 1) * ITEMS_PER_PAGE;
    var pageItems = state.filteredActivities.slice(startIndex, startIndex + ITEMS_PER_PAGE);

    tbody.innerHTML = pageItems.map(renderRow).join('');

    // Pagination
    renderPagination(total);
  }

  function renderRow(activity) {
    var userName = activity.user_name || 'مستخدم';
    var userRole = activity.user_role || 'user';
    var initial = escapeHtml(userName.charAt(0).toUpperCase());

    var classified = classifyActivityType(activity.action_type || activity.type);
    var description = activity.description || '—';

    var dateRaw = activity.created_at || activity.timestamp;
    var dateText = formatDateTime(dateRaw);
    var relTime = formatRelativeTime(dateRaw);

    return '' +
      '<tr>' +
        '<td>' +
          '<div class="act-user-cell">' +
            '<div class="act-user-avatar">' + initial + '</div>' +
            '<div class="act-user-info">' +
              '<div class="act-user-name">' + escapeHtml(userName) + '</div>' +
              '<div class="act-user-role">' + escapeHtml(translateRole(userRole)) + '</div>' +
            '</div>' +
          '</div>' +
        '</td>' +
        '<td>' +
          '<span class="act-type-badge ' + classified.key + '">' +
            classified.icon +
            '<span>' + escapeHtml(classified.label) + '</span>' +
          '</span>' +
        '</td>' +
        '<td>' +
          '<div class="act-description">' + escapeHtml(description) + '</div>' +
        '</td>' +
        '<td class="mono" title="' + escapeHtml(relTime) + '">' +
          escapeHtml(dateText) +
        '</td>' +
      '</tr>';
  }

  // ============================================
  // 7. Pagination
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
      html += '<button class="admin-page-btn' + (n === current ? ' active' : '') + '" data-page="' + n + '" type="button">' + n + '</button>';
      prevPage = n;
    });

    pageNumbers.innerHTML = html;

    pageNumbers.querySelectorAll('[data-page]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var p = parseInt(btn.getAttribute('data-page'), 10);
        if (p && p !== state.currentPage) {
          state.currentPage = p;
          render();
          scrollToTop();
        }
      });
    });

    if (prevBtn) prevBtn.disabled = current <= 1;
    if (nextBtn) nextBtn.disabled = current >= totalPages;
  }

  function scrollToTop() {
    var toolbar = $('resultsToolbar');
    if (toolbar) {
      var offset = toolbar.getBoundingClientRect().top + window.pageYOffset - 20;
      window.scrollTo({ top: offset, behavior: 'smooth' });
    }
  }

  // ============================================
  // 8. Filters Binding
  // ============================================
  function syncFiltersFromUI() {
    state.filters.search = ($('searchInput') || {}).value || '';
    state.filters.type = ($('typeFilter') || {}).value || '';
    state.filters.dateFrom = ($('dateFrom') || {}).value || '';
    state.filters.dateTo = ($('dateTo') || {}).value || '';
    state.filters.search = state.filters.search.trim();
  }

  function applyAndRender() {
    syncFiltersFromUI();
    applyFilters();
    render();
  }

  function resetFilters() {
    ['searchInput', 'typeFilter', 'dateFrom', 'dateTo'].forEach(function (id) {
      var el = $(id);
      if (el) el.value = '';
    });

    state.filters = { search: '', type: '', dateFrom: '', dateTo: '' };

    applyFilters();
    render();
  }

  function bindFilters() {
    // Search (debounced)
    var searchInput = $('searchInput');
    if (searchInput) {
      var timer = null;
      searchInput.addEventListener('input', function () {
        clearTimeout(timer);
        timer = setTimeout(applyAndRender, 250);
      });
    }

    // Selects & dates
    ['typeFilter', 'dateFrom', 'dateTo'].forEach(function (id) {
      var el = $(id);
      if (el) el.addEventListener('change', applyAndRender);
    });

    // Reset
    var resetBtn = $('resetBtn');
    if (resetBtn) resetBtn.addEventListener('click', resetFilters);

    var emptyResetBtn = $('emptyResetBtn');
    if (emptyResetBtn) emptyResetBtn.addEventListener('click', resetFilters);

    // Prev/Next
    var prevBtn = $('prevBtn');
    if (prevBtn) {
      prevBtn.addEventListener('click', function () {
        if (state.currentPage > 1) {
          state.currentPage--;
          render();
          scrollToTop();
        }
      });
    }

    var nextBtn = $('nextBtn');
    if (nextBtn) {
      nextBtn.addEventListener('click', function () {
        var totalPages = Math.ceil(state.filteredActivities.length / ITEMS_PER_PAGE);
        if (state.currentPage < totalPages) {
          state.currentPage++;
          render();
          scrollToTop();
        }
      });
    }

    // Refresh
    var refreshBtn = $('refreshBtn');
    if (refreshBtn) {
      refreshBtn.addEventListener('click', function () {
        refreshBtn.disabled = true;
        refreshBtn.innerHTML = '<span>جاري التحديث...</span>';
        loadAll().finally(function () {
          refreshBtn.disabled = false;
          refreshBtn.innerHTML = '' +
            '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="width:14px;height:14px;">' +
              '<polyline points="23 4 23 10 17 10"></polyline>' +
              '<polyline points="1 20 1 14 7 14"></polyline>' +
              '<path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"></path>' +
            '</svg>' +
            '<span>تحديث</span>';
        });
      });
    }
  }

  // ============================================
  // 9. Load All
  // ============================================
  function loadAll() {
    var loader = $('adminLoader');
    if (loader) loader.classList.add('show');

    return loadActivities()
      .then(function (activities) {
        state.allActivities = activities || [];

        if (loader) loader.classList.remove('show');

        updateMiniStats();
        applyFilters();
        render();

        logDebug('Loaded activities:', state.allActivities.length);
      })
      .catch(function (err) {
        if (loader) loader.classList.remove('show');
        toast('حدث خطأ في تحميل النشاطات', 'error');
        logDebug('Load error:', err.message);

        var empty = $('adminEmpty');
        if (empty) empty.classList.add('show');
      });
  }

  // ============================================
  // 10. Init
  // ============================================
  function init() {
    if (state.initialized) return;
    state.initialized = true;

    if (window.AuthGuard && window.AuthGuard.getUser) {
      state.currentUser = window.AuthGuard.getUser();
    }

    bindFilters();

    waitForSupabase(function () {
      loadAll();
    });

    logDebug('Admin activities initialized');
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
  // 11. Public API
  // ============================================
  window.AdminActivities = {
    initialized: true,
    init: init,
    refresh: loadAll,
    resetFilters: resetFilters,
    getState: function () { return state; }
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

})();
