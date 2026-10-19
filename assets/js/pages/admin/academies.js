// ============================================
// [35/50] ITWS Platform - Admin Academies Logic
// Path: assets/js/pages/admin/academies.js
// ============================================
// إدارة الأكاديميات - Grid + Filters + Actions
// يعتمد على Permissions للصلاحيات
// بدون إيموجي
// ============================================

(function () {
  'use strict';

  if (window.AdminAcademies && window.AdminAcademies.initialized) return;

  var ITEMS_PER_PAGE = 12;

  var state = {
    allAcademies: [],
    allCategories: [],
    allGovernorates: [],
    filteredAcademies: [],
    certificatesCounts: {},
    currentPage: 1,
    filters: {
      search: '',
      status: '',
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

  function getSetting(p, f) {
    if (window.AppSettings && window.AppSettings.get) {
      return window.AppSettings.get(p, f);
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
      console.log.apply(console, ['[AdminAcademies]'].concat(Array.prototype.slice.call(arguments)));
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
    // fallback: نعتمد على role من AuthGuard
    if (window.AuthGuard && window.AuthGuard.getUser) {
      var u = window.AuthGuard.getUser();
      if (!u) return false;
      return u.role === 'super_admin' || u.role === 'admin';
    }
    return false;
  }

  // ============================================
  // 2. Load data
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

  function loadAcademies() {
    if (!window.sb) return Promise.reject(new Error('Supabase not available'));

    return window.sb
      .from('academies')
      .select('id, name, license_number, tax_number, category_id, logo_url, status, is_deleted, created_at, approved_at, owner_name, email, phone, branches:academy_branches(id, governorate)')
      .eq('is_deleted', false)
      .order('created_at', { ascending: false });
  }

  function loadCertificatesCounts() {
    if (!window.sb) return Promise.resolve({});

    // نجيب كل الشهادات النشطة مجمعة حسب academy_id
    return window.sb
      .from('certificates')
      .select('academy_id')
      .eq('is_active', true)
      .eq('issuer_type', 'academy')
      .then(function (res) {
        if (res.error || !res.data) return {};

        var counts = {};
        res.data.forEach(function (c) {
          if (c.academy_id) {
            counts[c.academy_id] = (counts[c.academy_id] || 0) + 1;
          }
        });
        return counts;
      })
      .catch(function () { return {}; });
  }

  // ============================================
  // 3. Populate Filters
  // ============================================
  function populateFilters() {
    // Categories
    var catFilter = $('categoryFilter');
    if (catFilter && state.allCategories.length > 0) {
      var currentVal = catFilter.value;
      var html = '<option value="">كل التصنيفات</option>';
      state.allCategories.forEach(function (cat) {
        html += '<option value="' + escapeHtml(cat.id) + '">' + escapeHtml(cat.name) + '</option>';
      });
      catFilter.innerHTML = html;
      catFilter.value = currentVal;
    }

    // Governorates (from branches)
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
      var html2 = '<option value="">كل المحافظات</option>';
      govs.forEach(function (g) {
        html2 += '<option value="' + escapeHtml(g) + '">' + escapeHtml(g) + '</option>';
      });
      govFilter.innerHTML = html2;
      govFilter.value = currentVal2;
    }
  }

  // ============================================
  // 4. Apply Filters
  // ============================================
  function applyFilters() {
    var search = state.filters.search.trim().toLowerCase();
    var status = state.filters.status;
    var categoryId = state.filters.category;
    var governorate = state.filters.governorate;
    var sortBy = state.filters.sort;

    var filtered = state.allAcademies.filter(function (a) {
      // Search: name + license + tax
      if (search) {
        var nameMatch = (a.name || '').toLowerCase().indexOf(search) !== -1;
        var licenseMatch = (a.license_number || '').toLowerCase().indexOf(search) !== -1;
        var taxMatch = (a.tax_number || '').toLowerCase().indexOf(search) !== -1;
        if (!nameMatch && !licenseMatch && !taxMatch) return false;
      }

      // Status
      if (status && a.status !== status) return false;

      // Category
      if (categoryId && a.category_id !== categoryId) return false;

      // Governorate
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
      if (sortBy === 'certs') {
        var ac = state.certificatesCounts[a.id] || 0;
        var bc = state.certificatesCounts[b.id] || 0;
        return bc - ac;
      }
      return 0;
    });

    state.filteredAcademies = filtered;
    state.currentPage = 1;
  }

  // ============================================
  // 5. Update Mini Stats
  // ============================================
  function updateMiniStats() {
    var total = state.allAcademies.length;
    var approved = state.allAcademies.filter(function (a) { return a.status === 'approved'; }).length;
    var pending = state.allAcademies.filter(function (a) { return a.status === 'pending'; }).length;
    var certs = Object.keys(state.certificatesCounts).reduce(function (sum, id) {
      return sum + (state.certificatesCounts[id] || 0);
    }, 0);

    setText('miniTotal', formatNumber(total));
    setText('miniApproved', formatNumber(approved));
    setText('miniPending', formatNumber(pending));
    setText('miniCertificates', formatNumber(certs));
  }

  // ============================================
  // 6. Render
  // ============================================
  function render() {
    var grid = $('academiesGrid');
    var empty = $('adminEmpty');
    var loader = $('adminLoader');
    var toolbar = $('resultsToolbar');
    var pagination = $('pagination');

    if (!grid) return;

    if (loader) loader.classList.remove('show');

    var total = state.filteredAcademies.length;

    // Toolbar
    if (toolbar) {
      toolbar.style.display = total > 0 ? 'flex' : 'none';
      setText('resultsCount', total);
    }

    // Empty
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
    var pageItems = state.filteredAcademies.slice(startIndex, startIndex + ITEMS_PER_PAGE);

    // Render cards
    grid.innerHTML = pageItems.map(renderAcademyCard).join('');

    // Bind actions
    bindCardActions();

    // Render pagination
    renderPagination(total);
  }

  function renderAcademyCard(a) {
    var initial = escapeHtml((a.name || '?').charAt(0));
    var logoHtml = a.logo_url
      ? '<img src="' + escapeHtml(a.logo_url) + '" alt="">'
      : initial;

    var category = state.allCategories.find(function (c) { return c.id === a.category_id; });
    var categoryName = category ? category.name : '—';

    var branchesCount = a.branches ? a.branches.length : 0;
    var certsCount = state.certificatesCounts[a.id] || 0;

    var statusConfig = {
      'approved': { label: 'معتمدة', cls: 'approved' },
      'pending': { label: 'قيد الاعتماد', cls: 'pending' },
      'rejected': { label: 'مرفوضة', cls: 'rejected' },
      'suspended': { label: 'موقوفة', cls: 'suspended' },
      'expired': { label: 'منتهية', cls: 'suspended' }
    };
    var statusInfo = statusConfig[a.status] || { label: a.status || '—', cls: 'suspended' };

    // Actions
    var actionsHtml = '';

    // View (da2eman)
    actionsHtml += '' +
      '<button class="admin-action-btn" data-action="view" data-id="' + escapeHtml(a.id) + '">' +
        '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">' +
          '<path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path>' +
          '<circle cx="12" cy="12" r="3"></circle>' +
        '</svg>' +
        'عرض' +
      '</button>';

    // Edit (admin+)
    if (hasPermission('academy.edit')) {
      actionsHtml += '' +
        '<button class="admin-action-btn primary" data-action="edit" data-id="' + escapeHtml(a.id) + '">' +
          '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">' +
            '<path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>' +
            '<path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>' +
          '</svg>' +
          'تعديل' +
        '</button>';
    }

    // Approve (admin+ and status=pending)
    if (hasPermission('academy.approve') && a.status === 'pending') {
      actionsHtml += '' +
        '<button class="admin-action-btn success" data-action="approve" data-id="' + escapeHtml(a.id) + '">' +
          '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">' +
            '<polyline points="20 6 9 17 4 12"></polyline>' +
          '</svg>' +
          'اعتماد' +
        '</button>';
    }

    // Delete (super_admin only)
    if (hasPermission('academy.delete')) {
      actionsHtml += '' +
        '<button class="admin-action-btn danger" data-action="delete" data-id="' + escapeHtml(a.id) + '">' +
          '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">' +
            '<polyline points="3 6 5 6 21 6"></polyline>' +
            '<path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>' +
          '</svg>' +
          'حذف' +
        '</button>';
    }

    return '' +
      '<div class="admin-academy-card" data-academy-id="' + escapeHtml(a.id) + '">' +
        '<div class="admin-academy-header">' +
          '<div class="admin-academy-logo">' + logoHtml + '</div>' +
          '<div class="admin-academy-info">' +
            '<div class="admin-academy-name">' + escapeHtml(a.name || '—') + '</div>' +
            '<div class="admin-academy-license">' + escapeHtml(a.license_number || '—') + '</div>' +
          '</div>' +
          '<span class="admin-status-badge ' + statusInfo.cls + '">' + escapeHtml(statusInfo.label) + '</span>' +
        '</div>' +
        '<div class="admin-academy-body">' +
          '<div class="admin-academy-info-item">' +
            '<div class="admin-academy-info-label">التصنيف</div>' +
            '<div class="admin-academy-info-value">' + escapeHtml(categoryName) + '</div>' +
          '</div>' +
          '<div class="admin-academy-info-item">' +
            '<div class="admin-academy-info-label">البطاقة الضريبية</div>' +
            '<div class="admin-academy-info-value mono">' + escapeHtml(a.tax_number || '—') + '</div>' +
          '</div>' +
          '<div class="admin-academy-info-item">' +
            '<div class="admin-academy-info-label">الفروع</div>' +
            '<div class="admin-academy-info-value">' + branchesCount + ' فرع</div>' +
          '</div>' +
          '<div class="admin-academy-info-item">' +
            '<div class="admin-academy-info-label">الشهادات</div>' +
            '<div class="admin-academy-info-value">' + certsCount + ' شهادة</div>' +
          '</div>' +
        '</div>' +
        '<div class="admin-academy-footer">' +
          '<div style="font-size:11px;color:var(--text-muted);">' +
            'أضيفت ' + formatDate(a.created_at) +
          '</div>' +
          '<div class="admin-academy-actions">' + actionsHtml + '</div>' +
        '</div>' +
      '</div>';
  }

  // ============================================
  // 7. Bind Actions
  // ============================================
  function bindCardActions() {
    var grid = $('academiesGrid');
    if (!grid) return;

    grid.querySelectorAll('[data-action]').forEach(function (btn) {
      btn.addEventListener('click', function (e) {
        e.stopPropagation();
        var action = btn.getAttribute('data-action');
        var id = btn.getAttribute('data-id');
        if (!id) return;

        if (action === 'view') {
          viewAcademy(id);
        } else if (action === 'edit') {
          editAcademy(id);
        } else if (action === 'approve') {
          approveAcademy(id);
        } else if (action === 'delete') {
          deleteAcademy(id);
        }
      });
    });
  }

  // ============================================
  // 8. Actions
  // ============================================
  function viewAcademy(id) {
    window.location.href = resolve('admin/academy-details.html?id=' + encodeURIComponent(id));
  }

  function editAcademy(id) {
    if (!hasPermission('academy.edit')) {
      toast('غير مصرح لك بتعديل الأكاديميات', 'error');
      return;
    }
    window.location.href = resolve('admin/academy-edit.html?id=' + encodeURIComponent(id));
  }

  function approveAcademy(id) {
    if (!hasPermission('academy.approve')) {
      toast('غير مصرح لك باعتماد الأكاديميات', 'error');
      return;
    }

    var academy = state.allAcademies.find(function (a) { return a.id === id; });
    if (!academy) {
      toast('الأكاديمية غير موجودة', 'error');
      return;
    }

    if (!window.Modal || !window.Modal.confirm) {
      // fallback
      if (!confirm('هل تريد اعتماد "' + academy.name + '"؟')) return;
      doApprove(id, academy);
      return;
    }

    window.Modal.confirm({
      title: 'اعتماد أكاديمية',
      message: 'هل تريد اعتماد أكاديمية "' + academy.name + '"? سيتم منحها رقماً اعتمادياً وإتاحتها للجمهور.',
      confirmText: 'اعتماد',
      cancelText: 'إلغاء',
      icon: 'success'
    }).then(function (confirmed) {
      if (confirmed) doApprove(id, academy);
    });
  }

  function doApprove(id, academy) {
    if (!window.sb) return;

    // توليد رقم اعتماد جديد
    var year = new Date().getFullYear();
    var licenseNumber = 'NTI-' + year + '-' + String(Math.floor(100 + Math.random() * 900));

    var updateData = {
      status: 'approved',
      approved_at: new Date().toISOString(),
      license_number: licenseNumber
    };

    window.sb.from('academies').update(updateData).eq('id', id)
      .then(function (res) {
        if (res.error) {
          toast('فشل الاعتماد: ' + res.error.message, 'error');
          return;
        }

        toast('تم اعتماد الأكاديمية بنجاح', 'success');
        logDebug('Academy approved:', id, licenseNumber);

        // تحديث محلي
        academy.status = 'approved';
        academy.approved_at = updateData.approved_at;
        academy.license_number = licenseNumber;

        applyFilters();
        render();
        updateMiniStats();

        // Log activity
        logActivity('approve_academy', 'اعتماد أكاديمية: ' + academy.name, { academy_id: id });
      })
      .catch(function (err) {
        toast('حدث خطأ: ' + err.message, 'error');
      });
  }

  function deleteAcademy(id) {
    if (!hasPermission('academy.delete')) {
      toast('غير مصرح لك بحذف الأكاديميات', 'error');
      return;
    }

    var academy = state.allAcademies.find(function (a) { return a.id === id; });
    if (!academy) {
      toast('الأكاديمية غير موجودة', 'error');
      return;
    }

    if (!window.Modal || !window.Modal.confirm) {
      if (!confirm('هل تريد حذف "' + academy.name + '"؟ لا يمكن التراجع.')) return;
      doDelete(id, academy);
      return;
    }

    window.Modal.confirm({
      title: 'حذف أكاديمية',
      message: 'هل تريد حذف أكاديمية "' + academy.name + '"? سيتم حذفها من النظام نهائياً (soft delete) ولا يمكن التراجع.',
      confirmText: 'حذف نهائي',
      cancelText: 'إلغاء',
      icon: 'error',
      danger: true
    }).then(function (confirmed) {
      if (confirmed) doDelete(id, academy);
    });
  }

  function doDelete(id, academy) {
    if (!window.sb) return;

    window.sb.from('academies').update({
      is_deleted: true,
      deleted_at: new Date().toISOString()
    }).eq('id', id)
      .then(function (res) {
        if (res.error) {
          toast('فشل الحذف: ' + res.error.message, 'error');
          return;
        }

        toast('تم حذف الأكاديمية بنجاح', 'success');
        logDebug('Academy deleted:', id);

        // إزالة محلية
        state.allAcademies = state.allAcademies.filter(function (a) { return a.id !== id; });

        applyFilters();
        render();
        updateMiniStats();

        logActivity('delete_academy', 'حذف أكاديمية: ' + academy.name, { academy_id: id });
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

    // Smart page numbers
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
    state.filters.status = ($('statusFilter') || {}).value || '';
    state.filters.category = ($('categoryFilter') || {}).value || '';
    state.filters.governorate = ($('governorateFilter') || {}).value || '';
    state.filters.sort = ($('sortFilter') || {}).value || 'newest';
    state.filters.search = state.filters.search.trim();
  }

  function applyAndRender() {
    syncFiltersFromUI();
    applyFilters();
    render();
  }

  function resetFilters() {
    ['searchInput', 'statusFilter', 'categoryFilter', 'governorateFilter'].forEach(function (id) {
      var el = $(id);
      if (el) el.value = '';
    });
    var sortEl = $('sortFilter');
    if (sortEl) sortEl.value = 'newest';

    state.filters = { search: '', status: '', category: '', governorate: '', sort: 'newest' };
    state.currentPage = 1;

    applyFilters();
    render();
  }

  function bindFilters() {
    // Live search with debounce
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
    ['statusFilter', 'categoryFilter', 'governorateFilter', 'sortFilter'].forEach(function (id) {
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
        var totalPages = Math.ceil(state.filteredAcademies.length / ITEMS_PER_PAGE);
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

    // Load data
    waitForSupabase(function () {
      var loader = $('adminLoader');
      if (loader) loader.classList.add('show');

      Promise.all([
        loadCategories(),
        loadAcademies(),
        loadCertificatesCounts()
      ])
        .then(function (results) {
          state.allCategories = results[0] || [];
          var acadRes = results[1];
          state.certificatesCounts = results[2] || {};

          if (acadRes && acadRes.error) {
            throw new Error(acadRes.error.message);
          }

          state.allAcademies = (acadRes && acadRes.data) || [];

          populateFilters();
          updateMiniStats();
          applyFilters();
          render();

          logDebug('Loaded:', {
            academies: state.allAcademies.length,
            categories: state.allCategories.length
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

    logDebug('Admin academies initialized');
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
  window.AdminAcademies = {
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
