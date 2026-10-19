// ============================================
// [37/50] ITWS Platform - Admin Certificates Logic
// Path: assets/js/pages/admin/certificates.js
// ============================================
// إدارة الشهادات - Table + Filters + Actions
// يدعم فصل النقابة عن الأكاديميات (issuer_type)
// يعتمد على Permissions للصلاحيات
// بدون إيموجي
// ============================================

(function () {
  'use strict';

  if (window.AdminCertificates && window.AdminCertificates.initialized) return;

  var ITEMS_PER_PAGE = 15;

  var state = {
    allCertificates: [],
    allAcademies: [],
    filteredCertificates: [],
    currentPage: 1,
    filters: {
      search: '',
      issuer: '',
      academy: '',
      grade: '',
      status: '',
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

  function formatNumber(n) {
    if (n == null) return '—';
    if (n < 1000) return n.toString();
    if (n < 1000000) return (n / 1000).toFixed(1).replace(/\.0$/, '') + 'K';
    return (n / 1000000).toFixed(1).replace(/\.0$/, '') + 'M';
  }

  function formatDate(date, opts) {
    if (!date) return '—';
    try {
      var d = date instanceof Date ? date : new Date(date);
      if (isNaN(d.getTime())) return '—';
      return d.toLocaleDateString('ar-EG', opts || {
        year: 'numeric', month: 'short', day: 'numeric'
      });
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
      console.log.apply(console, ['[AdminCertificates]'].concat(Array.prototype.slice.call(arguments)));
    }
  }

  function resolve(path) {
    if (!path) return '#';
    if (window.resolveUrl) return window.resolveUrl(path);
    var base = (window.ITWS_CONFIG && window.ITWS_CONFIG.BASE_PATH) || '';
    return base + String(path).replace(/^\.?\//, '');
  }

  function hasPermission(perm) {
    if (window.Permissions && window.Permissions.can) {
      return window.Permissions.can(perm);
    }
    if (window.AuthGuard && window.AuthGuard.getUser) {
      var u = window.AuthGuard.getUser();
      if (!u) return false;
      return u.role === 'super_admin' || u.role === 'admin';
    }
    return false;
  }

  function gradeClass(grade) {
    if (!grade) return '';
    var g = String(grade).toUpperCase().replace(/[+-]/g, '');
    if (g === 'A') return 'grade-a';
    if (g === 'B') return 'grade-b';
    if (g === 'C') return 'grade-c';
    if (g === 'D') return 'grade-d';
    return 'grade-f';
  }

  // ============================================
  // 2. Load Data
  // ============================================
  function loadCertificates() {
    if (!window.sb) return Promise.reject(new Error('Supabase not available'));

    return window.sb
      .from('certificates')
      .select('id, certificate_code, student_name, student_national_id, course_name, course_hours, grade, issuer_type, academy_id, branch_id, academy_name, academy_license_number, branch_name, is_active, issued_at, completion_date')
      .order('issued_at', { ascending: false });
  }

  function loadAcademies() {
    if (!window.sb) return Promise.resolve([]);

    return window.sb
      .from('academies')
      .select('id, name, license_number')
      .eq('is_deleted', false)
      .order('name', { ascending: true })
      .then(function (res) {
        if (res.error || !res.data) return [];
        return res.data;
      })
      .catch(function () { return []; });
  }

  // ============================================
  // 3. Populate Filters
  // ============================================
  function populateFilters() {
    // Academy filter
    var academyFilter = $('academyFilter');
    if (academyFilter) {
      var currentVal = academyFilter.value;
      var html = '<option value="">كل الأكاديميات</option>';
      state.allAcademies.forEach(function (a) {
        html += '<option value="' + escapeHtml(a.id) + '">' + escapeHtml(a.name) + '</option>';
      });
      academyFilter.innerHTML = html;
      academyFilter.value = currentVal;
    }

    // Grade filter (dynamic from data)
    var gradeFilter = $('gradeFilter');
    if (gradeFilter) {
      var currentValG = gradeFilter.value;
      var gradesSet = {};
      state.allCertificates.forEach(function (c) {
        if (c.grade) gradesSet[c.grade] = true;
      });
      var grades = Object.keys(gradesSet).sort();

      // Default grades if no data
      if (grades.length === 0) {
        grades = ['A+', 'A', 'B+', 'B', 'C+', 'C', 'D', 'F'];
      }

      var htmlG = '<option value="">كل التقديرات</option>';
      grades.forEach(function (g) {
        htmlG += '<option value="' + escapeHtml(g) + '">' + escapeHtml(g) + '</option>';
      });
      gradeFilter.innerHTML = htmlG;
      gradeFilter.value = currentValG;
    }
  }

  // ============================================
  // 4. Apply Filters
  // ============================================
  function applyFilters() {
    var search = state.filters.search.trim().toLowerCase();
    var issuer = state.filters.issuer;
    var academyId = state.filters.academy;
    var grade = state.filters.grade;
    var status = state.filters.status;
    var sortBy = state.filters.sort;

    var filtered = state.allCertificates.filter(function (c) {
      // Search: code + student name + national id + course
      if (search) {
        var codeMatch = (c.certificate_code || '').toLowerCase().indexOf(search) !== -1;
        var studentMatch = (c.student_name || '').toLowerCase().indexOf(search) !== -1;
        var nationalMatch = (c.student_national_id || '').indexOf(search) !== -1;
        var courseMatch = (c.course_name || '').toLowerCase().indexOf(search) !== -1;
        if (!codeMatch && !studentMatch && !nationalMatch && !courseMatch) return false;
      }

      // Issuer type
      if (issuer) {
        var isUnion = c.issuer_type === 'union' || !c.academy_id;
        if (issuer === 'union' && !isUnion) return false;
        if (issuer === 'academy' && isUnion) return false;
      }

      // Academy
      if (academyId && c.academy_id !== academyId) return false;

      // Grade
      if (grade && c.grade !== grade) return false;

      // Status
      if (status === 'active' && c.is_active === false) return false;
      if (status === 'inactive' && c.is_active !== false) return false;

      return true;
    });

    // Sort
    filtered.sort(function (a, b) {
      if (sortBy === 'newest') {
        return new Date(b.issued_at) - new Date(a.issued_at);
      }
      if (sortBy === 'oldest') {
        return new Date(a.issued_at) - new Date(b.issued_at);
      }
      if (sortBy === 'student') {
        return (a.student_name || '').localeCompare(b.student_name || '', 'ar');
      }
      if (sortBy === 'course') {
        return (a.course_name || '').localeCompare(b.course_name || '', 'ar');
      }
      return 0;
    });

    state.filteredCertificates = filtered;
    state.currentPage = 1;
  }

  // ============================================
  // 5. Update Mini Stats
  // ============================================
  function updateMiniStats() {
    var total = state.allCertificates.length;
    var union = state.allCertificates.filter(function (c) {
      return c.issuer_type === 'union' || !c.academy_id;
    }).length;
    var academy = total - union;
    var active = state.allCertificates.filter(function (c) { return c.is_active !== false; }).length;

    setText('miniTotal', formatNumber(total));
    setText('miniUnion', formatNumber(union));
    setText('miniAcademy', formatNumber(academy));
    setText('miniActive', formatNumber(active));
  }

  // ============================================
  // 6. Render
  // ============================================
  function render() {
    var table = $('tableCard');
    var tbody = $('certsTableBody');
    var empty = $('adminEmpty');
    var loader = $('adminLoader');
    var toolbar = $('resultsToolbar');
    var pagination = $('pagination');

    if (!tbody) return;

    if (loader) loader.classList.remove('show');

    var total = state.filteredCertificates.length;

    // Toolbar
    if (toolbar) {
      toolbar.style.display = total > 0 ? 'flex' : 'none';
      setText('resultsCount', total);
    }

    // Empty
    if (total === 0) {
      if (table) table.style.display = 'none';
      if (empty) empty.classList.add('show');
      if (pagination) pagination.style.display = 'none';
      return;
    }

    if (table) table.style.display = 'block';
    if (empty) empty.classList.remove('show');

    // Pagination slice
    var startIndex = (state.currentPage - 1) * ITEMS_PER_PAGE;
    var pageItems = state.filteredCertificates.slice(startIndex, startIndex + ITEMS_PER_PAGE);

    // Render rows
    tbody.innerHTML = pageItems.map(renderRow).join('');

    // Bind row actions
    bindRowActions();

    // Pagination
    renderPagination(total);
  }

  function renderRow(c) {
    var isUnion = c.issuer_type === 'union' || !c.academy_id;
    var isActive = c.is_active !== false;
    var gradeCls = gradeClass(c.grade);

    // Issuer badge
    var issuerBadge = '';
    if (isUnion) {
      issuerBadge = '' +
        '<span class="issuer-badge union">' +
          '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">' +
            '<path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"></path>' +
          '</svg>' +
          'النقابة' +
        '</span>';
    } else {
      var acadName = c.academy_name || 'أكاديمية';
      issuerBadge = '' +
        '<span class="issuer-badge academy" title="' + escapeHtml(acadName) + '">' +
          '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">' +
            '<path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"></path>' +
          '</svg>' +
          escapeHtml(acadName.length > 20 ? acadName.substring(0, 20) + '...' : acadName) +
        '</span>';
    }

    // Status badge
    var statusBadge = isActive
      ? '<span class="status-badge active"><span class="status-badge-dot"></span>نشطة</span>'
      : '<span class="status-badge inactive"><span class="status-badge-dot"></span>غير نشطة</span>';

    // National ID masked
    var nationalId = c.student_national_id
      ? '••••' + escapeHtml(String(c.student_national_id).slice(-4))
      : '—';

    // Actions
    var actionsHtml = '';

    // View (always)
    actionsHtml += '' +
      '<button class="icon-btn" data-action="view" data-id="' + escapeHtml(c.id) + '" title="عرض">' +
        '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">' +
          '<path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path>' +
          '<circle cx="12" cy="12" r="3"></circle>' +
        '</svg>' +
      '</button>';

    // Edit (admin+)
    if (hasPermission('certificate.edit')) {
      actionsHtml += '' +
        '<button class="icon-btn" data-action="edit" data-id="' + escapeHtml(c.id) + '" title="تعديل">' +
          '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">' +
            '<path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>' +
            '<path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>' +
          '</svg>' +
        '</button>';
    }

    // Delete (super_admin only)
    if (hasPermission('certificate.delete')) {
      actionsHtml += '' +
        '<button class="icon-btn danger" data-action="delete" data-id="' + escapeHtml(c.id) + '" title="حذف">' +
          '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">' +
            '<polyline points="3 6 5 6 21 6"></polyline>' +
            '<path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>' +
          '</svg>' +
        '</button>';
    }

    return '' +
      '<tr data-cert-id="' + escapeHtml(c.id) + '">' +
        '<td class="mono">' + escapeHtml(c.certificate_code || '—') + '</td>' +
        '<td>' +
          '<div class="name">' + escapeHtml(c.student_name || '—') + '</div>' +
          '<div class="sub">' + nationalId + '</div>' +
        '</td>' +
        '<td>' +
          '<div class="name">' + escapeHtml(c.course_name || '—') + '</div>' +
          (c.course_hours ? '<div class="sub">' + escapeHtml(String(c.course_hours)) + ' ساعة</div>' : '') +
        '</td>' +
        '<td>' + issuerBadge + '</td>' +
        '<td><span class="grade-badge ' + gradeCls + '">' + escapeHtml(c.grade || '—') + '</span></td>' +
        '<td class="mono">' + formatDate(c.issued_at) + '</td>' +
        '<td>' + statusBadge + '</td>' +
        '<td>' +
          '<div class="row-actions">' + actionsHtml + '</div>' +
        '</td>' +
      '</tr>';
  }

  // ============================================
  // 7. Bind Row Actions
  // ============================================
  function bindRowActions() {
    var tbody = $('certsTableBody');
    if (!tbody) return;

    tbody.querySelectorAll('[data-action]').forEach(function (btn) {
      btn.addEventListener('click', function (e) {
        e.stopPropagation();
        var action = btn.getAttribute('data-action');
        var id = btn.getAttribute('data-id');
        if (!id) return;

        if (action === 'view') {
          viewCertificate(id);
        } else if (action === 'edit') {
          editCertificate(id);
        } else if (action === 'delete') {
          deleteCertificate(id);
        }
      });
    });
  }

  // ============================================
  // 8. Actions
  // ============================================
  function viewCertificate(id) {
    window.location.href = resolve('admin/certificate-view.html?id=' + encodeURIComponent(id));
  }

  function editCertificate(id) {
    if (!hasPermission('certificate.edit')) {
      toast('غير مصرح لك بتعديل الشهادات', 'error');
      return;
    }
    window.location.href = resolve('admin/certificate-edit.html?id=' + encodeURIComponent(id));
  }

  function deleteCertificate(id) {
    if (!hasPermission('certificate.delete')) {
      toast('غير مصرح لك بحذف الشهادات', 'error');
      return;
    }

    var cert = state.allCertificates.find(function (c) { return c.id === id; });
    if (!cert) {
      toast('الشهادة غير موجودة', 'error');
      return;
    }

    if (!window.Modal || !window.Modal.confirm) {
      if (!confirm('هل تريد حذف الشهادة "' + cert.certificate_code + '"؟')) return;
      doDelete(id, cert);
      return;
    }

    window.Modal.confirm({
      title: 'حذف شهادة',
      message: 'هل تريد حذف الشهادة "' + cert.certificate_code + '" للمتدرب "' + cert.student_name + '"? سيتم إلغاء تنشيطها (soft delete).',
      confirmText: 'حذف',
      cancelText: 'إلغاء',
      icon: 'error',
      danger: true
    }).then(function (confirmed) {
      if (confirmed) doDelete(id, cert);
    });
  }

  function doDelete(id, cert) {
    if (!window.sb) return;

    window.sb.from('certificates').update({
      is_active: false,
      deleted_at: new Date().toISOString()
    }).eq('id', id)
      .then(function (res) {
        if (res.error) {
          toast('فشل الحذف: ' + res.error.message, 'error');
          return;
        }

        toast('تم حذف الشهادة بنجاح', 'success');
        logDebug('Certificate deleted:', id);

        // تحديث محلي
        var localCert = state.allCertificates.find(function (c) { return c.id === id; });
        if (localCert) localCert.is_active = false;

        applyFilters();
        render();
        updateMiniStats();

        logActivity('delete_certificate', 'حذف شهادة: ' + cert.certificate_code, {
          certificate_id: id,
          student_name: cert.student_name
        });
      })
      .catch(function (err) {
        toast('حدث خطأ: ' + err.message, 'error');
      });
  }

  function logActivity(type, description, details) {
    if (!window.sb) return;
    var user = (window.AuthGuard && window.AuthGuard.getUser) ? window.AuthGuard.getUser() : null;
    if (!user) return;

    window.sb.from('activities').insert({
      user_id: user.id,
      user_name: user.full_name,
      user_role: user.role,
      action_type: type,
      description: description,
      details: details || {}
    }).catch(function () {});
  }

  // ============================================
  // 9. Pagination
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
  // 10. Bind UI Events
  // ============================================
  function syncFiltersFromUI() {
    state.filters.search = ($('searchInput') || {}).value || '';
    state.filters.issuer = ($('issuerFilter') || {}).value || '';
    state.filters.academy = ($('academyFilter') || {}).value || '';
    state.filters.grade = ($('gradeFilter') || {}).value || '';
    state.filters.status = ($('statusFilter') || {}).value || '';
    state.filters.sort = ($('sortFilter') || {}).value || 'newest';
    state.filters.search = state.filters.search.trim();
  }

  function applyAndRender() {
    syncFiltersFromUI();
    applyFilters();
    render();
  }

  function resetFilters() {
    ['searchInput', 'issuerFilter', 'academyFilter', 'gradeFilter', 'statusFilter'].forEach(function (id) {
      var el = $(id);
      if (el) el.value = '';
    });
    var sortEl = $('sortFilter');
    if (sortEl) sortEl.value = 'newest';

    state.filters = {
      search: '', issuer: '', academy: '', grade: '', status: '', sort: 'newest'
    };
    state.currentPage = 1;

    applyFilters();
    render();
  }

  function bindFilters() {
    // Debounced search
    var searchInput = $('searchInput');
    if (searchInput) {
      var timer = null;
      searchInput.addEventListener('input', function () {
        clearTimeout(timer);
        timer = setTimeout(applyAndRender, 250);
      });
      searchInput.addEventListener('keydown', function (e) {
        if (e.key === 'Enter') {
          e.preventDefault();
          clearTimeout(timer);
          applyAndRender();
        }
      });
    }

    // Selects
    ['issuerFilter', 'academyFilter', 'gradeFilter', 'statusFilter', 'sortFilter'].forEach(function (id) {
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
        var totalPages = Math.ceil(state.filteredCertificates.length / ITEMS_PER_PAGE);
        if (state.currentPage < totalPages) {
          state.currentPage++;
          render();
          scrollToTop();
        }
      });
    }
  }

  // ============================================
  // 11. Init
  // ============================================
  function init() {
    if (state.initialized) return;
    state.initialized = true;

    bindFilters();

    waitForSupabase(function () {
      var loader = $('adminLoader');
      if (loader) loader.classList.add('show');

      Promise.all([loadCertificates(), loadAcademies()])
        .then(function (results) {
          var certsRes = results[0];
          state.allAcademies = results[1] || [];

          if (certsRes && certsRes.error) {
            throw new Error(certsRes.error.message);
          }

          state.allCertificates = (certsRes && certsRes.data) || [];

          populateFilters();
          updateMiniStats();
          applyFilters();
          render();

          logDebug('Loaded:', {
            certificates: state.allCertificates.length,
            academies: state.allAcademies.length
          });
        })
        .catch(function (err) {
          if (loader) loader.classList.remove('show');
          toast('حدث خطأ في تحميل البيانات', 'error');
          logDebug('Load error:', err.message);

          var empty = $('adminEmpty');
          if (empty) empty.classList.add('show');
        });
    });

    logDebug('Admin certificates initialized');
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
  // 12. Public API
  // ============================================
  window.AdminCertificates = {
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
