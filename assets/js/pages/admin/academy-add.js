// ============================================
// ITWS Platform - Admin Academy Add Logic
// Path: assets/js/pages/admin/academy-add.js
// ============================================

(function () {
  'use strict';

  if (window.AcademyAdd && window.AcademyAdd.initialized) return;

  var GOV_LIST = [
    'القاهرة', 'الجيزة', 'الإسكندرية', 'القليوبية', 'الشرقية',
    'الدقهلية', 'المنوفية', 'الغربية', 'كفر الشيخ', 'دمياط',
    'بورسعيد', 'الإسماعيلية', 'السويس', 'شمال سيناء', 'جنوب سيناء',
    'البحر الأحمر', 'الأقصر', 'أسوان', 'أسيوط', 'سوهاج',
    'قنا', 'المنيا', 'بني سويف', 'الفيوم', 'مطروح', 'الوادي الجديد', 'البحيرة'
  ];

  var state = {
    categories: [],
    branches: [],
    courses: [],
    status: 'approved',
    currentUser: null,
    submitting: false,
    initialized: false
  };

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

  function generateId() {
    return 'tmp_' + Math.random().toString(36).substring(2, 15);
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
      console.log.apply(console, ['[AcademyAdd]'].concat(Array.prototype.slice.call(arguments)));
    }
  }

  function resolve(path) {
    if (!path) return '#';
    if (window.resolveUrl) return window.resolveUrl(path);
    var base = (window.ITWS_CONFIG && window.ITWS_CONFIG.BASE_PATH) || '';
    return base + String(path).replace(/^\.?\//, '');
  }

  // ============ Load Categories ============
  function loadCategories() {
    if (!window.sb) return Promise.resolve([]);
    return window.sb.from('academy_categories')
      .select('id, name')
      .eq('is_active', true)
      .order('sort_order')
      .then(function (res) {
        if (res.error || !res.data) return [];
        return res.data;
      })
      .catch(function () { return []; });
  }

  function populateCategories() {
    var select = $('categoryId');
    if (!select) return;
    var html = '<option value="">اختر التصنيف</option>';
    state.categories.forEach(function (c) {
      html += '<option value="' + escapeHtml(c.id) + '">' + escapeHtml(c.name) + '</option>';
    });
    select.innerHTML = html;
  }

  // ============ Status Switch ============
  function setStatus(status) {
    state.status = status;
    document.querySelectorAll('.status-radio-card').forEach(function (card) {
      card.classList.toggle('active', card.getAttribute('data-status') === status);
    });
    var summary = $('summaryStatus');
    if (summary) {
      summary.textContent = status === 'approved' ? 'معتمدة' : 'قيد المراجعة';
      summary.className = 'summary-value ' + (status === 'approved' ? 'success' : 'warning');
    }
    var licenseEl = $('summaryLicense');
    if (licenseEl) {
      licenseEl.textContent = status === 'approved' ? 'تلقائي عند الحفظ' : 'لاحقاً بعد الاعتماد';
    }
  }

  // ============ Branches ============
  function addBranch(data) {
    var branch = data || {
      id: generateId(),
      governorate: '',
      address: '',
      phone: '',
      is_main: state.branches.length === 0,
      branch_manager: ''
    };
    state.branches.push(branch);
    renderBranches();
    updateSummary();
  }

  function removeBranch(id) {
    state.branches = state.branches.filter(function (b) { return b.id !== id; });
    if (state.branches.length > 0 && !state.branches.some(function (b) { return b.is_main; })) {
      state.branches[0].is_main = true;
    }
    renderBranches();
    updateSummary();
  }

  function updateBranch(id, field, value) {
    var b = state.branches.find(function (x) { return x.id === id; });
    if (!b) return;
    if (field === 'is_main' && value === true) {
      state.branches.forEach(function (x) { x.is_main = false; });
    }
    b[field] = value;
  }

  function renderBranches() {
    var list = $('branchesList');
    var empty = $('branchesEmpty');
    if (!list) return;

    if (state.branches.length === 0) {
      list.innerHTML = '';
      if (empty) empty.style.display = 'block';
      return;
    }

    if (empty) empty.style.display = 'none';

    list.innerHTML = state.branches.map(function (b, i) {
      var govOptions = '<option value="">اختر المحافظة</option>';
      GOV_LIST.forEach(function (g) {
        govOptions += '<option value="' + g + '"' + (b.governorate === g ? ' selected' : '') + '>' + g + '</option>';
      });

      return '' +
        '<div class="dynamic-item">' +
          '<div class="dynamic-item-header">' +
            '<div class="dynamic-item-title">الفرع ' + (i + 1) + (b.is_main ? ' (رئيسي)' : '') + '</div>' +
            '<button type="button" class="dynamic-item-remove" onclick="AcademyAdd.removeBranch(\'' + escapeHtml(b.id) + '\')">' +
              '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">' +
                '<line x1="18" y1="6" x2="6" y2="18"></line>' +
                '<line x1="6" y1="6" x2="18" y2="18"></line>' +
              '</svg>' +
            '</button>' +
          '</div>' +
          '<div class="form-row">' +
            '<div class="form-field">' +
              '<label class="required">المحافظة</label>' +
              '<select onchange="AcademyAdd.updateBranch(\'' + escapeHtml(b.id) + '\', \'governorate\', this.value)">' + govOptions + '</select>' +
            '</div>' +
            '<div class="form-field">' +
              '<label>رقم الهاتف</label>' +
              '<input type="tel" value="' + escapeHtml(b.phone || '') + '" placeholder="01012345678" oninput="AcademyAdd.updateBranch(\'' + escapeHtml(b.id) + '\', \'phone\', this.value)">' +
            '</div>' +
          '</div>' +
          '<div class="form-field">' +
            '<label class="required">العنوان</label>' +
            '<input type="text" value="' + escapeHtml(b.address || '') + '" placeholder="الشارع - الحي - رقم المبنى" oninput="AcademyAdd.updateBranch(\'' + escapeHtml(b.id) + '\', \'address\', this.value)">' +
          '</div>' +
          '<div class="form-row">' +
            '<div class="form-field">' +
              '<label>مدير الفرع</label>' +
              '<input type="text" value="' + escapeHtml(b.branch_manager || '') + '" placeholder="اسم مدير الفرع" oninput="AcademyAdd.updateBranch(\'' + escapeHtml(b.id) + '\', \'branch_manager\', this.value)">' +
            '</div>' +
            '<div class="form-field">' +
              '<label>الفرع الرئيسي</label>' +
              '<select onchange="AcademyAdd.updateBranch(\'' + escapeHtml(b.id) + '\', \'is_main\', this.value === \'yes\')">' +
                '<option value="no"' + (!b.is_main ? ' selected' : '') + '>لا</option>' +
                '<option value="yes"' + (b.is_main ? ' selected' : '') + '>نعم</option>' +
              '</select>' +
            '</div>' +
          '</div>' +
        '</div>';
    }).join('');
  }

  // ============ Courses ============
  function addCourse(data) {
    var course = data || {
      id: generateId(),
      name: '',
      description: '',
      duration_hours: '',
      price: '',
      instructors_count: ''
    };
    state.courses.push(course);
    renderCourses();
    updateSummary();
  }

  function removeCourse(id) {
    state.courses = state.courses.filter(function (c) { return c.id !== id; });
    renderCourses();
    updateSummary();
  }

  function updateCourse(id, field, value) {
    var c = state.courses.find(function (x) { return x.id === id; });
    if (c) c[field] = value;
  }

  function renderCourses() {
    var list = $('coursesList');
    var empty = $('coursesEmpty');
    if (!list) return;

    if (state.courses.length === 0) {
      list.innerHTML = '';
      if (empty) empty.style.display = 'block';
      return;
    }

    if (empty) empty.style.display = 'none';

    list.innerHTML = state.courses.map(function (c, i) {
      return '' +
        '<div class="dynamic-item">' +
          '<div class="dynamic-item-header">' +
            '<div class="dynamic-item-title">الكورس ' + (i + 1) + '</div>' +
            '<button type="button" class="dynamic-item-remove" onclick="AcademyAdd.removeCourse(\'' + escapeHtml(c.id) + '\')">' +
              '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">' +
                '<line x1="18" y1="6" x2="6" y2="18"></line>' +
                '<line x1="6" y1="6" x2="18" y2="18"></line>' +
              '</svg>' +
            '</button>' +
          '</div>' +
          '<div class="form-field">' +
            '<label class="required">اسم الكورس</label>' +
            '<input type="text" value="' + escapeHtml(c.name || '') + '" placeholder="اسم الكورس" oninput="AcademyAdd.updateCourse(\'' + escapeHtml(c.id) + '\', \'name\', this.value)">' +
          '</div>' +
          '<div class="form-row-3">' +
            '<div class="form-field">' +
              '<label>الساعات</label>' +
              '<input type="number" value="' + escapeHtml(String(c.duration_hours || '')) + '" min="1" placeholder="40" oninput="AcademyAdd.updateCourse(\'' + escapeHtml(c.id) + '\', \'duration_hours\', this.value)">' +
            '</div>' +
            '<div class="form-field">' +
              '<label>السعر</label>' +
              '<input type="number" value="' + escapeHtml(String(c.price || '')) + '" min="0" placeholder="1500" oninput="AcademyAdd.updateCourse(\'' + escapeHtml(c.id) + '\', \'price\', this.value)">' +
            '</div>' +
            '<div class="form-field">' +
              '<label>المحاضرين</label>' +
              '<input type="number" value="' + escapeHtml(String(c.instructors_count || '')) + '" min="1" placeholder="2" oninput="AcademyAdd.updateCourse(\'' + escapeHtml(c.id) + '\', \'instructors_count\', this.value)">' +
            '</div>' +
          '</div>' +
        '</div>';
    }).join('');
  }

  // ============ Summary ============
  function updateSummary() {
    setText('summaryBranches', state.branches.length);
    setText('summaryCourses', state.courses.length);
  }

  // ============ Validation ============
  function clearErrors() {
    document.querySelectorAll('.form-error').forEach(function (el) {
      el.classList.remove('show');
      el.textContent = '';
    });
    document.querySelectorAll('.error').forEach(function (el) {
      el.classList.remove('error');
    });
  }

  function setError(fieldId, errId, msg) {
    var f = $(fieldId);
    var e = $(errId);
    if (f) f.classList.add('error');
    if (e) { e.textContent = msg; e.classList.add('show'); }
  }

  function validate() {
    clearErrors();
    var valid = true;

    if (!$('academyName').value.trim()) {
      setError('academyName', 'academyNameError', 'أدخل اسم الأكاديمية');
      valid = false;
    }

    var email = $('email').value.trim();
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setError('email', 'emailError', 'البريد الإلكتروني غير صحيح');
      valid = false;
    }

    var phone = $('phone').value.trim();
    if (phone && !/^01[0125][0-9]{8}$/.test(phone)) {
      setError('phone', 'phoneError', 'رقم الهاتف غير صحيح (11 رقم)');
      valid = false;
    }

    return valid;
  }

  // ============ Submit ============
  function handleSubmit(e) {
    if (e) e.preventDefault();
    if (state.submitting) return;
    if (!validate()) { toast('يرجى مراجعة البيانات', 'error'); return; }

    if (!window.sb) { toast('تعذر الاتصال بالخادم', 'error'); return; }

    state.submitting = true;
    showOverlay(true);
    disableBtn(true);

    var status = state.status;
    var licenseNumber = null;

    // Generate license number if approved
    if (status === 'approved') {
      var year = new Date().getFullYear();
      var rand = String(Math.floor(100 + Math.random() * 900));
      licenseNumber = 'NTI-' + year + '-' + rand;
    }

    var academyData = {
      name: $('academyName').value.trim(),
      owner_name: $('ownerName').value.trim() || null,
      founded_year: parseInt($('foundedYear').value, 10) || null,
      tax_number: $('taxNumber').value.trim() || null,
      commercial_registry: $('commercialRegistry').value.trim() || null,
      license_number: licenseNumber,
      category_id: $('categoryId').value || null,
      email: $('email').value.trim() || null,
      phone: $('phone').value.trim() || null,
      website_url: $('websiteUrl').value.trim() || null,
      facebook_url: $('facebookUrl').value.trim() || null,
      description: $('description').value.trim() || null,
      logo_url: $('logoUrl').value.trim() || null,
      status: status,
      is_deleted: false,
      created_at: new Date().toISOString()
    };

    if (status === 'approved') {
      academyData.approved_at = new Date().toISOString();
      var expires = new Date();
      expires.setFullYear(expires.getFullYear() + 1);
      academyData.expires_at = expires.toISOString();
    }

    var academyId = null;

    // Insert academy
    window.sb.from('academies').insert(academyData).select('id').single()
      .then(function (res) {
        if (res.error) throw new Error(res.error.message);
        academyId = res.data.id;
        logDebug('Academy created:', academyId);

        // Insert branches
        if (state.branches.length > 0) {
          var branchData = state.branches.map(function (b) {
            return {
              academy_id: academyId,
              governorate: b.governorate,
              address: b.address,
              phone: b.phone || null,
              branch_manager: b.branch_manager || null,
              is_main: b.is_main || false
            };
          });
          return window.sb.from('academy_branches').insert(branchData);
        }
        return Promise.resolve();
      })
      .then(function () {
        // Insert courses
        if (state.courses.length > 0) {
          var courseData = state.courses.map(function (c) {
            return {
              academy_id: academyId,
              name: c.name,
              duration_hours: parseInt(c.duration_hours, 10) || null,
              price: parseFloat(c.price) || null,
              instructors_count: parseInt(c.instructors_count, 10) || null
            };
          });
          return window.sb.from('academy_courses').insert(courseData);
        }
        return Promise.resolve();
      })
      .then(function () {
        toast('تم إضافة الأكاديمية بنجاح', 'success');

        logActivity('create_academy',
          'إضافة أكاديمية: ' + academyData.name + ' (' + (status === 'approved' ? 'معتمدة' : 'قيد المراجعة') + ')',
          {
            academy_id: academyId,
            name: academyData.name,
            status: status,
            license_number: licenseNumber
          });

        setTimeout(function () {
          window.location.href = resolve('admin/academy-details.html?id=' + encodeURIComponent(academyId));
        }, 800);
      })
      .catch(function (err) {
        logDebug('Save error:', err.message);
        toast('فشل الحفظ: ' + err.message, 'error');
        showOverlay(false);
        disableBtn(false);
        state.submitting = false;
      });
  }

  function showOverlay(show) {
    var o = $('submitOverlay');
    if (o) o.classList.toggle('show', show);
  }

  function disableBtn(disable) {
    var btn = $('saveAcademyBtn');
    if (!btn) return;
    btn.disabled = disable;
    btn.innerHTML = disable
      ? '<span>جاري الحفظ...</span>'
      : '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="width:16px;height:16px;"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"></path><polyline points="17 21 17 13 7 13 7 21"></polyline><polyline points="7 3 7 8 15 8"></polyline></svg><span>حفظ الأكاديمية</span>';
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

  // ============ Bind ============
  function bindEvents() {
    // Status radio
    document.querySelectorAll('.status-radio-card').forEach(function (card) {
      card.addEventListener('click', function () {
        setStatus(card.getAttribute('data-status'));
      });
    });

    // Form submit
    var form = $('academyForm');
    if (form) form.addEventListener('submit', handleSubmit);

    // Warn before leaving
    window.addEventListener('beforeunload', function (e) {
      if (!state.submitting) {
        var name = $('academyName').value.trim();
        if (name) {
          var msg = 'هل تريد المغادرة؟ سيتم فقد البيانات.';
          e.returnValue = msg;
          return msg;
        }
      }
    });
  }

  // ============ Init ============
  function init() {
    if (state.initialized) return;
    state.initialized = true;

    if (window.AuthGuard && window.AuthGuard.getUser) {
      state.currentUser = window.AuthGuard.getUser();
    }

    bindEvents();
    setStatus('approved');
    updateSummary();

    waitForSupabase(function () {
      loadCategories().then(function (cats) {
        state.categories = cats;
        populateCategories();
      });
    });

    logDebug('Academy add initialized');
  }

  function waitForSupabase(cb) {
    if (window.sb) { cb(); return; }
    var w = 0;
    var i = setInterval(function () {
      w += 100;
      if (window.sb || w >= 3000) { clearInterval(i); if (window.sb) cb(); }
    }, 100);
  }

  // ============ Public API ============
  window.AcademyAdd = {
    initialized: true,
    init: init,
    addBranch: addBranch,
    removeBranch: removeBranch,
    updateBranch: updateBranch,
    addCourse: addCourse,
    removeCourse: removeCourse,
    updateCourse: updateCourse
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

})();
