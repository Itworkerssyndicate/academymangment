// ============================================
// ITWS Platform - Admin Academy Details Logic
// Path: assets/js/pages/admin/academy-details.js
// ============================================
// عرض تفاصيل أكاديمية كاملة (admin view)
// Branches + Courses + Certificates + Requests
// بدون إيموجي
// ============================================

(function () {
  'use strict';

  if (window.AdminAcademyDetails && window.AdminAcademyDetails.initialized) return;

  var state = {
    academyId: null,
    academy: null,
    category: null,
    branches: [],
    courses: [],
    certificates: [],
    requests: [],
    currentUser: null,
    initialized: false
  };

  // ============ Helpers ============
  function $(id) { return document.getElementById(id); }

  function setText(id, t) {
    var el = $(id);
    if (el) el.textContent = t;
  }

  function setHtml(id, h) {
    var el = $(id);
    if (el) el.innerHTML = h;
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
      return d.toLocaleDateString('ar-EG', opts || { year: 'numeric', month: 'short', day: 'numeric' });
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
      console.log.apply(console, ['[AdminAcademyDetails]'].concat(Array.prototype.slice.call(arguments)));
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

  function readId() {
    try {
      var params = new URLSearchParams(window.location.search);
      return params.get('id');
    } catch (e) { return null; }
  }

  function translateRole(role) {
    var m = { super_admin: 'سوبر أدمن', admin: 'أدمن', committee_manager: 'إدارة اللجنة', user: 'مستخدم' };
    return m[role] || role || '—';
  }

  function translateStage(stage) {
    var m = {
      submitted: 'تم التقديم',
      documents_review: 'مراجعة المستندات',
      site_visit: 'زيارة الموقع',
      committee_review: 'لجنة المراجعة',
      final_approval: 'الموافقة النهائية',
      approved: 'معتمدة',
      rejected: 'مرفوضة'
    };
    return m[stage] || stage || '—';
  }

  // ============ Load Data ============
  function loadAcademy(id) {
    if (!window.sb) return Promise.reject(new Error('Supabase not available'));
    return window.sb
      .from('academies')
      .select('*')
      .eq('id', id)
      .eq('is_deleted', false)
      .maybeSingle()
      .then(function (res) {
        if (res.error) throw new Error(res.error.message);
        return res.data;
      });
  }

  function loadCategory(categoryId) {
    if (!categoryId || !window.sb) return Promise.resolve(null);
    return window.sb
      .from('academy_categories')
      .select('id, name, color')
      .eq('id', categoryId)
      .maybeSingle()
      .then(function (res) { return res.data || null; })
      .catch(function () { return null; });
  }

  function loadBranches(academyId) {
    if (!window.sb) return Promise.resolve([]);
    return window.sb
      .from('academy_branches')
      .select('id, governorate, address, phone, branch_manager, is_main')
      .eq('academy_id', academyId)
      .order('is_main', { ascending: false })
      .order('governorate', { ascending: true })
      .then(function (res) { return res.data || []; })
      .catch(function () { return []; });
  }

  function loadCourses(academyId) {
    if (!window.sb) return Promise.resolve([]);
    return window.sb
      .from('academy_courses')
      .select('id, name, description, duration_hours, price, instructors_count')
      .eq('academy_id', academyId)
      .then(function (res) { return res.data || []; })
      .catch(function () { return []; });
  }

  function loadCertificates(academyId) {
    if (!window.sb) return Promise.resolve([]);
    return window.sb
      .from('certificates')
      .select('id, certificate_code, student_name, course_name, grade, issued_at, is_active')
      .eq('academy_id', academyId)
      .eq('is_active', true)
      .order('issued_at', { ascending: false })
      .limit(100)
      .then(function (res) { return res.data || []; })
      .catch(function () { return []; });
  }

  function loadRequests(academyId) {
    if (!window.sb) return Promise.resolve([]);
    return window.sb
      .from('accreditation_requests')
      .select('id, request_number, current_stage, submitted_at, updated_at')
      .eq('academy_id', academyId)
      .order('submitted_at', { ascending: false })
      .then(function (res) { return res.data || []; })
      .catch(function () { return []; });
  }

  // ============ Render Hero ============
  function renderHero() {
    var a = state.academy;
    if (!a) return;

    // Logo
    var logoEl = $('heroLogo');
    if (logoEl) {
      if (a.logo_url) {
        logoEl.innerHTML = '<img src="' + escapeHtml(a.logo_url) + '" alt="">';
      } else {
        logoEl.textContent = (a.name || '?').charAt(0);
      }
    }

    // Badges
    var badgesHtml = '';
    var statusLabels = { approved: 'معتمدة', pending: 'قيد الاعتماد', rejected: 'مرفوضة', suspended: 'موقوفة' };
    badgesHtml += '<span class="acad-hero-badge status-' + (a.status || 'pending') + '">' +
      '<span class="acad-hero-badge-dot"></span>' +
      escapeHtml(statusLabels[a.status] || a.status || '—') +
    '</span>';
    if (state.category) {
      badgesHtml += '<span class="acad-hero-badge category">' + escapeHtml(state.category.name) + '</span>';
    }
    setHtml('heroBadges', badgesHtml);

    // Name & description
    setText('heroName', a.name || '—');
    var descEl = $('heroDesc');
    if (descEl && a.description) {
      descEl.textContent = a.description;
      descEl.style.display = 'block';
    }

    // Meta
    var metaHtml = '';
    if (a.license_number) {
      metaHtml += '<div class="acad-hero-meta-item">' +
        '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect><path d="M7 11V7a5 5 0 0 1 10 0v4"></path></svg>' +
        '<span style="font-family:\'Courier New\',monospace;">' + escapeHtml(a.license_number) + '</span></div>';
    }
    if (a.owner_name) {
      metaHtml += '<div class="acad-hero-meta-item">' +
        '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path><circle cx="12" cy="7" r="4"></circle></svg>' +
        '<span>' + escapeHtml(a.owner_name) + '</span></div>';
    }
    if (a.approved_at) {
      metaHtml += '<div class="acad-hero-meta-item">' +
        '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>' +
        '<span>معتمدة منذ ' + formatDate(a.approved_at) + '</span></div>';
    }
    setHtml('heroMeta', metaHtml);

    // Header license
    setText('headerLicense', a.license_number || 'لم يتم الاعتماد بعد');
  }

  // ============ Render Stats ============
  function renderStats() {
    setText('statBranches', state.branches.length);
    setText('statCourses', state.courses.length);
    setText('statCertificates', state.certificates.length);
    setText('statRequests', state.requests.length);
  }

  // ============ Render Info Lists ============
  function renderInfoLists() {
    var a = state.academy;

    // Basic
    setHtml('basicInfoList', '' +
      infoItem('الاسم', a.name || '—') +
      infoItem('المالك', a.owner_name || '—') +
      infoItem('سنة التأسيس', a.founded_year || '—') +
      infoItem('التصنيف', state.category ? state.category.name : '—')
    );

    // Contact
    var emailHtml = a.email
      ? '<a href="mailto:' + escapeHtml(a.email) + '">' + escapeHtml(a.email) + '</a>'
      : '<span class="empty">غير مسجل</span>';
    var phoneHtml = a.phone
      ? '<a href="tel:' + escapeHtml(a.phone) + '">' + escapeHtml(a.phone) + '</a>'
      : '<span class="empty">غير مسجل</span>';
    var websiteHtml = a.website_url
      ? '<a href="' + escapeHtml(a.website_url) + '" target="_blank" rel="noopener">' + escapeHtml(a.website_url.replace(/^https?:\/\//, '')) + '</a>'
      : '<span class="empty">غير مسجل</span>';
    var facebookHtml = a.facebook_url
      ? '<a href="' + escapeHtml(a.facebook_url) + '" target="_blank" rel="noopener">صفحة Facebook</a>'
      : '<span class="empty">غير مسجل</span>';

    setHtml('contactInfoList', '' +
      infoItem('البريد', emailHtml, true) +
      infoItem('الهاتف', phoneHtml, true) +
      infoItem('الموقع', websiteHtml, true) +
      infoItem('فيسبوك', facebookHtml, true)
    );

    // Legal
    setHtml('legalInfoList', '' +
      infoItem('رقم الاعتماد', a.license_number || '—', false, 'mono') +
      infoItem('البطاقة الضريبية', a.tax_number || '—', false, 'mono') +
      infoItem('السجل التجاري', a.commercial_registry || '—', false, 'mono') +
      infoItem('تاريخ الإضافة', formatDate(a.created_at))
    );

    // Accreditation
    setHtml('accreditationInfoList', '' +
      infoItem('الحالة', translateStatus(a.status)) +
      infoItem('تاريخ الاعتماد', formatDate(a.approved_at)) +
      infoItem('تاريخ الانتهاء', formatDate(a.expires_at)) +
      infoItem('آخر تحديث', formatDate(a.updated_at))
    );
  }

  function infoItem(label, value, isHtml, extraClass) {
    var cls = 'info-item-value' + (extraClass ? ' ' + extraClass : '');
    if (!isHtml && (value === '—' || value === null || value === undefined || value === '')) {
      cls += ' empty';
    }
    return '<div class="info-item">' +
      '<span class="info-item-label">' + escapeHtml(label) + '</span>' +
      '<span class="' + cls + '">' + (isHtml ? value : escapeHtml(value)) + '</span>' +
    '</div>';
  }

  function translateStatus(s) {
    var m = { approved: 'معتمدة', pending: 'قيد الاعتماد', rejected: 'مرفوضة', suspended: 'موقوفة', expired: 'منتهية' };
    return m[s] || s || '—';
  }

  // ============ Render Branches ============
  function renderBranches() {
    var list = $('branchesList');
    if (!list) return;

    setText('branchesTabCount', '(' + state.branches.length + ')');

    if (state.branches.length === 0) {
      list.innerHTML = '<div class="empty-inline">لا توجد فروع مسجلة</div>';
      return;
    }

    list.innerHTML = state.branches.map(function (b) {
      return '' +
        '<div class="item-row">' +
          '<div class="item-row-icon">' +
            '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">' +
              '<path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path>' +
              '<circle cx="12" cy="10" r="3"></circle>' +
            '</svg>' +
          '</div>' +
          '<div class="item-row-main">' +
            '<div class="item-row-title">' + escapeHtml(b.governorate || 'فرع') +
              (b.is_main ? ' <span class="item-row-badge main">رئيسي</span>' : '') +
            '</div>' +
            '<div class="item-row-sub">' + escapeHtml(b.address || '—') +
              (b.phone ? ' - ' + escapeHtml(b.phone) : '') +
              (b.branch_manager ? ' - مدير: ' + escapeHtml(b.branch_manager) : '') +
            '</div>' +
          '</div>' +
        '</div>';
    }).join('');
  }

  // ============ Render Courses ============
  function renderCourses() {
    var list = $('coursesList');
    if (!list) return;

    setText('coursesTabCount', '(' + state.courses.length + ')');

    if (state.courses.length === 0) {
      list.innerHTML = '<div class="empty-inline">لا توجد كورسات مسجلة</div>';
      return;
    }

    list.innerHTML = state.courses.map(function (c) {
      var meta = [];
      if (c.duration_hours) meta.push(c.duration_hours + ' ساعة');
      if (c.price) meta.push(c.price + ' ج.م');
      if (c.instructors_count) meta.push(c.instructors_count + ' محاضر');

      return '' +
        '<div class="item-row">' +
          '<div class="item-row-icon">' +
            '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">' +
              '<path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"></path>' +
              '<path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"></path>' +
            '</svg>' +
          '</div>' +
          '<div class="item-row-main">' +
            '<div class="item-row-title">' + escapeHtml(c.name || '—') + '</div>' +
            '<div class="item-row-sub">' + (meta.length ? escapeHtml(meta.join(' · ')) : 'بدون تفاصيل') + '</div>' +
          '</div>' +
        '</div>';
    }).join('');
  }

  // ============ Render Certificates ============
  function renderCertificates() {
    var tbody = $('certificatesTableBody');
    if (!tbody) return;

    setText('certsTableCount', state.certificates.length + ' شهادة');

    if (state.certificates.length === 0) {
      tbody.innerHTML = '<tr><td colspan="5" style="text-align:center;padding:20px;color:var(--text-muted);">لا توجد شهادات صادرة</td></tr>';
      return;
    }

    tbody.innerHTML = state.certificates.map(function (c) {
      return '' +
        '<tr>' +
          '<td class="mono">' + escapeHtml(c.certificate_code || '—') + '</td>' +
          '<td>' + escapeHtml(c.student_name || '—') + '</td>' +
          '<td>' + escapeHtml(c.course_name || '—') + '</td>' +
          '<td>' + escapeHtml(c.grade || '—') + '</td>' +
          '<td class="mono">' + formatDate(c.issued_at) + '</td>' +
        '</tr>';
    }).join('');
  }

  // ============ Render Requests ============
  function renderRequests() {
    var tbody = $('requestsTableBody');
    if (!tbody) return;

    setText('requestsTableCount', state.requests.length + ' طلب');

    if (state.requests.length === 0) {
      tbody.innerHTML = '<tr><td colspan="4" style="text-align:center;padding:20px;color:var(--text-muted);">لا توجد طلبات اعتماد</td></tr>';
      return;
    }

    tbody.innerHTML = state.requests.map(function (r) {
      return '' +
        '<tr>' +
          '<td class="mono">' + escapeHtml(r.request_number || '—') + '</td>' +
          '<td><span class="mini-badge ' + escapeHtml(r.current_stage) + '">' + escapeHtml(translateStage(r.current_stage)) + '</span></td>' +
          '<td class="mono">' + formatDate(r.submitted_at) + '</td>' +
          '<td class="mono">' + formatDate(r.updated_at) + '</td>' +
        '</tr>';
    }).join('');
  }

  // ============ Actions ============
  function bindActions() {
    var a = state.academy;

    // Edit link
    var editBtn = $('editBtn');
    if (editBtn) {
      if (hasPermission('academy.edit')) {
        editBtn.href = resolve('admin/academy-edit.html?id=' + encodeURIComponent(a.id));
      } else {
        editBtn.style.display = 'none';
      }
    }

    // Delete
    var deleteBtn = $('deleteBtn');
    if (deleteBtn) {
      if (hasPermission('academy.delete')) {
        deleteBtn.addEventListener('click', doDelete);
      } else {
        deleteBtn.style.display = 'none';
      }
    }

    // Copy link
    var copyBtn = $('copyLinkBtn');
    if (copyBtn) {
      copyBtn.addEventListener('click', function () {
        var url = window.location.origin + resolve('academy-details.html?id=' + encodeURIComponent(a.id));
        if (navigator.clipboard && navigator.clipboard.writeText) {
          navigator.clipboard.writeText(url).then(function () {
            toast('تم نسخ الرابط', 'success');
          }).catch(function () {
            prompt('انسخ الرابط:', url);
          });
        } else {
          prompt('انسخ الرابط:', url);
        }
      });
    }

    // Tabs
    document.querySelectorAll('.detail-tab').forEach(function (tab) {
      tab.addEventListener('click', function () {
        var tabName = tab.getAttribute('data-tab');
        if (!tabName) return;
        document.querySelectorAll('.detail-tab').forEach(function (t) { t.classList.remove('active'); });
        document.querySelectorAll('.tab-content').forEach(function (c) { c.classList.remove('active'); });
        tab.classList.add('active');
        var content = $('tab' + tabName.charAt(0).toUpperCase() + tabName.slice(1));
        if (content) content.classList.add('active');
      });
    });
  }

  function doDelete() {
    if (!hasPermission('academy.delete')) {
      toast('غير مصرح لك بحذف الأكاديميات', 'error');
      return;
    }
    var a = state.academy;

    var msg = 'حذف الأكاديمية "' + a.name + '"? سيتم إخفاؤها نهائياً من النظام (soft delete) ولن تظهر في الدليل.';

    if (!window.Modal || !window.Modal.confirm) {
      if (!confirm(msg)) return;
      performDelete();
      return;
    }

    window.Modal.confirm({
      title: 'حذف أكاديمية',
      message: msg,
      confirmText: 'حذف نهائي',
      cancelText: 'إلغاء',
      icon: 'error',
      danger: true
    }).then(function (confirmed) {
      if (confirmed) performDelete();
    });
  }

  function performDelete() {
    if (!window.sb) return;
    var a = state.academy;

    window.sb.from('academies').update({
      is_deleted: true,
      deleted_at: new Date().toISOString()
    }).eq('id', a.id)
      .then(function (res) {
        if (res.error) {
          toast('فشل الحذف: ' + res.error.message, 'error');
          return;
        }
        toast('تم حذف الأكاديمية', 'success');
        logActivity('delete_academy', 'حذف أكاديمية: ' + a.name, { academy_id: a.id });
        setTimeout(function () {
          window.location.href = resolve('admin/academies.html');
        }, 800);
      })
      .catch(function (err) {
        toast('حدث خطأ: ' + err.message, 'error');
      });
  }

  function logActivity(type, description, details) {
    if (!window.sb || !state.currentUser) return;
    window.sb.from('activities').insert({
      user_id: state.currentUser.id,
      user_name: state.currentUser.full_name,
      user_role: state.currentUser.role,
      action_type: type,
      description: description,
      details: details || {}
    }).catch(function () {});
  }

  // ============ Show Error ============
  function showError(title, text) {
    var loader = $('viewLoader');
    var error = $('viewError');
    var content = $('viewContent');
    if (loader) loader.classList.remove('show');
    if (content) content.style.display = 'none';
    if (error) {
      error.classList.add('show');
      setText('errTitle', title);
      setText('errText', text);
    }
  }

  // ============ Init ============
  function init() {
    if (state.initialized) return;
    state.initialized = true;

    state.academyId = readId();
    if (!state.academyId) {
      showError('لم يتم تحديد الأكاديمية', 'تأكد من الرابط أو ارجع لصفحة الأكاديميات.');
      return;
    }

    if (window.AuthGuard && window.AuthGuard.getUser) {
      state.currentUser = window.AuthGuard.getUser();
    }

    var loader = $('viewLoader');
    if (loader) loader.classList.add('show');

    loadAcademy(state.academyId)
      .then(function (academy) {
        if (!academy) {
          showError('الأكاديمية غير موجودة', 'لم يتم العثور على أكاديمية بهذا المعرف.');
          return;
        }
        state.academy = academy;

        return Promise.all([
          loadCategory(academy.category_id),
          loadBranches(academy.id),
          loadCourses(academy.id),
          loadCertificates(academy.id),
          loadRequests(academy.id)
        ]).then(function (results) {
          state.category = results[0];
          state.branches = results[1];
          state.courses = results[2];
          state.certificates = results[3];
          state.requests = results[4];

          if (loader) loader.classList.remove('show');
          $('viewContent').style.display = 'block';

          renderHero();
          renderStats();
          renderInfoLists();
          renderBranches();
          renderCourses();
          renderCertificates();
          renderRequests();
          bindActions();

          logDebug('Academy details loaded:', academy.id);
        });
      })
      .catch(function (err) {
        showError('حدث خطأ', err.message || 'تعذر تحميل البيانات');
        logDebug('Init error:', err.message);
      });
  }

  // ============ Public API ============
  window.AdminAcademyDetails = {
    initialized: true,
    init: init,
    refresh: function () { state.initialized = false; init(); },
    getState: function () { return state; }
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
