// ============================================
// [31/50] ITWS Platform - Academy Apply Logic
// Path: assets/js/pages/academy-apply.js
// ============================================
// منطق فورم تقديم طلب اعتماد أكاديمية (5 خطوات)
// التقديم للأكاديميات فقط (issuer_type = 'academy')
// بدون إيموجي
// مسارات نسبية
// ============================================

(function () {
  'use strict';

  if (window.ApplyForm && window.ApplyForm.initialized) return;

  // ============ الثوابت ============
  var TOTAL_STEPS = 5;
  var DRAFT_KEY = 'itws_academy_draft';
  var MAX_FILE_SIZE = 10 * 1024 * 1024;
  var ALLOWED_MIME = ['application/pdf', 'image/jpeg', 'image/png'];
  var GOV_LIST = [
    'القاهرة', 'الجيزة', 'الإسكندرية', 'القليوبية', 'الشرقية',
    'الدقهلية', 'المنوفية', 'الغربية', 'كفر الشيخ', 'دمياط',
    'بورسعيد', 'الإسماعيلية', 'السويس', 'شمال سيناء', 'جنوب سيناء',
    'البحر الأحمر', 'الأقصر', 'أسوان', 'أسيوط', 'سوهاج',
    'قنا', 'المنيا', 'بني سويف', 'الفيوم', 'مطروح', 'الوادي الجديد', 'البحيرة'
  ];

  // ============ الحالة ============
  var state = {
    currentStep: 1,
    categories: [],
    branches: [],
    courses: [],
    files: {
      commercial_registry: null,
      tax_card: null,
      place_photo: null
    },
    submitting: false,
    submitted: false,
    draftSaveTimer: null,
    initialized: false
  };

  // ============ Helpers ============
  function $(id) { return document.getElementById(id); }

  function escapeHtml(s) {
    if (s == null) return '';
    return String(s)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
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
      console.log.apply(console, ['[ApplyForm]'].concat(Array.prototype.slice.call(arguments)));
    }
  }

  function generateId() {
    return 'tmp_' + Math.random().toString(36).substring(2, 15);
  }

  function formatFileSize(bytes) {
    if (!bytes) return '0 B';
    var sizes = ['B', 'KB', 'MB', 'GB'];
    var i = Math.floor(Math.log(bytes) / Math.log(1024));
    return (bytes / Math.pow(1024, i)).toFixed(2) + ' ' + sizes[i];
  }

  function generateRequestNumber() {
    var year = new Date().getFullYear();
    var random = Math.floor(1000 + Math.random() * 9000);
    return 'REQ-' + year + '-' + random;
  }

  function getSetting(p, f) {
    if (window.AppSettings && window.AppSettings.get) {
      return window.AppSettings.get(p, f);
    }
    return f;
  }

  // ============================================
  // 1. Load Categories
  // ============================================
  function loadCategories() {
    if (!window.sb) return Promise.resolve([]);

    return window.sb
      .from('academy_categories')
      .select('id, name, sort_order')
      .eq('is_active', true)
      .order('sort_order', { ascending: true })
      .then(function (res) {
        if (res.error || !res.data) return [];
        return res.data;
      })
      .catch(function () { return []; });
  }

  function populateCategorySelect() {
    var select = $('categoryId');
    if (!select) return;

    var html = '<option value="">اختر تصنيف الأكاديمية</option>';
    state.categories.forEach(function (cat) {
      html += '<option value="' + escapeHtml(cat.id) + '">' + escapeHtml(cat.name) + '</option>';
    });
    select.innerHTML = html;
  }

  // ============================================
  // 2. Populate Governorate dropdown
  // ============================================
  function buildGovernorateOptions(selected) {
    var html = '<option value="">اختر المحافظة</option>';
    GOV_LIST.forEach(function (g) {
      html += '<option value="' + escapeHtml(g) + '"' + (g === selected ? ' selected' : '') + '>' + escapeHtml(g) + '</option>';
    });
    return html;
  }

  // ============================================
  // 3. Navigation (next/prev)
  // ============================================
  function goToStep(step) {
    if (step < 1 || step > TOTAL_STEPS) return;

    document.querySelectorAll('[data-step-panel]').forEach(function (panel) {
      panel.classList.toggle('active', parseInt(panel.getAttribute('data-step-panel'), 10) === step);
    });

    document.querySelectorAll('.progress-step').forEach(function (el) {
      var s = parseInt(el.getAttribute('data-step'), 10);
      el.classList.remove('active', 'completed');
      if (s === step) el.classList.add('active');
      else if (s < step) el.classList.add('completed');
    });

    document.querySelectorAll('.progress-line').forEach(function (el) {
      var l = parseInt(el.getAttribute('data-line'), 10);
      el.classList.toggle('completed', l < step);
    });

    // Update buttons
    var prevBtn = $('prevBtn');
    var nextBtn = $('nextBtn');
    var submitBtn = $('submitBtn');

    if (prevBtn) prevBtn.style.visibility = step === 1 ? 'hidden' : 'visible';

    if (step === TOTAL_STEPS) {
      if (nextBtn) nextBtn.style.display = 'none';
      if (submitBtn) submitBtn.style.display = 'inline-flex';
      renderReview();
    } else {
      if (nextBtn) nextBtn.style.display = 'inline-flex';
      if (submitBtn) submitBtn.style.display = 'none';
    }

    // Update next button label
    if (nextBtn) {
      var span = nextBtn.querySelector('span');
      if (span) {
        span.textContent = step === TOTAL_STEPS - 1 ? 'المراجعة' : 'التالي';
      }
    }

    state.currentStep = step;

    // Scroll to top
    window.scrollTo({ top: 0, behavior: 'smooth' });

    // Save draft
    saveDraft();
  }

  function nextStep() {
    if (!validateStep(state.currentStep)) return;
    if (state.currentStep < TOTAL_STEPS) {
      goToStep(state.currentStep + 1);
    }
  }

  function prevStep() {
    if (state.currentStep > 1) {
      goToStep(state.currentStep - 1);
    }
  }

  // ============================================
  // 4. Validation
  // ============================================
  function validateStep(step) {
    clearErrors();
    var valid = true;

    if (step === 1) {
      valid = validateStep1() && valid;
    } else if (step === 2) {
      valid = validateStep2() && valid;
    } else if (step === 3) {
      // Step 3 optional (courses)
      valid = true;
    } else if (step === 4) {
      valid = validateStep4() && valid;
    }

    if (!valid) {
      var firstError = document.querySelector('.form-field input.error, .form-field select.error, .form-field textarea.error');
      if (firstError) firstError.focus();
    }

    return valid;
  }

  function clearErrors() {
    document.querySelectorAll('.form-error').forEach(function (el) {
      el.classList.remove('show');
      el.textContent = '';
    });
    document.querySelectorAll('.error').forEach(function (el) {
      el.classList.remove('error');
    });
  }

  function setFieldError(fieldId, errorId, msg) {
    var field = $(fieldId);
    var error = $(errorId);
    if (field) field.classList.add('error');
    if (error) {
      error.textContent = msg;
      error.classList.add('show');
    }
  }

  function validateStep1() {
    var valid = true;

    var name = $('academyName') ? $('academyName').value.trim() : '';
    if (!name || name.length < 3) {
      setFieldError('academyName', 'academyNameError', 'أدخل اسم الأكاديمية (3 أحرف على الأقل)');
      valid = false;
    }

    var owner = $('ownerName') ? $('ownerName').value.trim() : '';
    if (!owner || owner.length < 3) {
      setFieldError('ownerName', 'ownerNameError', 'أدخل اسم المالك');
      valid = false;
    }

    var year = $('foundedYear') ? $('foundedYear').value.trim() : '';
    if (year) {
      var yr = parseInt(year, 10);
      if (isNaN(yr) || yr < 1990 || yr > 2030) {
        setFieldError('foundedYear', 'foundedYearError', 'سنة التأسيس غير صحيحة (1990 - 2030)');
        valid = false;
      }
    }

    var tax = $('taxNumber') ? $('taxNumber').value.trim() : '';
    if (!tax) {
      setFieldError('taxNumber', 'taxNumberError', 'أدخل رقم البطاقة الضريبية');
      valid = false;
    }

    var registry = $('commercialRegistry') ? $('commercialRegistry').value.trim() : '';
    if (!registry) {
      setFieldError('commercialRegistry', 'commercialRegistryError', 'أدخل رقم السجل التجاري');
      valid = false;
    }

    var category = $('categoryId') ? $('categoryId').value : '';
    if (!category) {
      setFieldError('categoryId', 'categoryIdError', 'اختر تصنيف الأكاديمية');
      valid = false;
    }

    var email = $('email') ? $('email').value.trim() : '';
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setFieldError('email', 'emailError', 'البريد الإلكتروني غير صحيح');
      valid = false;
    }

    var phone = $('phone') ? $('phone').value.trim() : '';
    if (phone && !/^01[0125][0-9]{8}$/.test(phone)) {
      setFieldError('phone', 'phoneError', 'رقم الهاتف غير صحيح (11 رقم يبدأ بـ 010/011/012/015)');
      valid = false;
    }

    return valid;
  }

  function validateStep2() {
    if (state.branches.length === 0) {
      toast('أضف فرع واحد على الأقل', 'error');
      return false;
    }

    var valid = true;
    var branchErrors = [];

    state.branches.forEach(function (b, i) {
      if (!b.governorate) {
        branchErrors.push('الفرع ' + (i + 1) + ': اختر المحافظة');
        valid = false;
      }
      if (!b.address || b.address.trim().length < 5) {
        branchErrors.push('الفرع ' + (i + 1) + ': أدخل العنوان');
        valid = false;
      }
    });

    if (!valid) {
      toast(branchErrors[0], 'error');
    }

    // Verify only one main branch
    var mainCount = state.branches.filter(function (b) { return b.is_main; }).length;
    if (mainCount === 0) {
      state.branches[0].is_main = true;
    }

    return valid;
  }

  function validateStep4() {
    var valid = true;

    // Commercial registry
    if (!state.files.commercial_registry) {
      toast('ارفع صورة السجل التجاري', 'error');
      valid = false;
    } else if (!state.files.tax_card && valid) {
      toast('ارفع صورة البطاقة الضريبية', 'error');
      valid = false;
    } else if (!state.files.place_photo && valid) {
      toast('ارفع صورة المكان', 'error');
      valid = false;
    }

    return valid;
  }

  // ============================================
  // 5. Branches Management
  // ============================================
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
    saveDraft();

    // Focus on new branch's governorate
    setTimeout(function () {
      var lastBranch = state.branches[state.branches.length - 1];
      var govSelect = document.querySelector('[data-branch-gov="' + lastBranch.id + '"]');
      if (govSelect) govSelect.focus();
    }, 100);
  }

  function removeBranch(id) {
    if (state.branches.length === 1) {
      toast('يجب أن يكون هناك فرع واحد على الأقل', 'error');
      return;
    }

    state.branches = state.branches.filter(function (b) { return b.id !== id; });

    // Ensure one main
    if (!state.branches.some(function (b) { return b.is_main; })) {
      state.branches[0].is_main = true;
    }

    renderBranches();
    saveDraft();
  }

  function updateBranchField(id, field, value) {
    var branch = state.branches.find(function (b) { return b.id === id; });
    if (!branch) return;

    if (field === 'is_main' && value === true) {
      // Unset other main
      state.branches.forEach(function (b) { b.is_main = false; });
    }

    branch[field] = value;
    saveDraft();
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

    list.innerHTML = state.branches.map(function (b, index) {
      return '' +
        '<div class="dynamic-item">' +
          '<div class="dynamic-item-header">' +
            '<div class="dynamic-item-title">الفرع ' + (index + 1) + (b.is_main ? ' (الرئيسي)' : '') + '</div>' +
            '<button type="button" class="dynamic-item-remove" onclick="ApplyForm.removeBranch(\'' + escapeHtml(b.id) + '\')" aria-label="حذف الفرع">' +
              '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">' +
                '<line x1="18" y1="6" x2="6" y2="18"></line>' +
                '<line x1="6" y1="6" x2="18" y2="18"></line>' +
              '</svg>' +
            '</button>' +
          '</div>' +
          '<div class="form-row">' +
            '<div class="form-field">' +
              '<label class="required">المحافظة</label>' +
              '<select data-branch-gov="' + escapeHtml(b.id) + '" onchange="ApplyForm.updateBranch(\'' + escapeHtml(b.id) + '\', \'governorate\', this.value)">' +
                buildGovernorateOptions(b.governorate) +
              '</select>' +
            '</div>' +
            '<div class="form-field">' +
              '<label>رقم الهاتف</label>' +
              '<input type="tel" data-branch-phone="' + escapeHtml(b.id) + '" value="' + escapeHtml(b.phone) + '" placeholder="01012345678" oninput="ApplyForm.updateBranch(\'' + escapeHtml(b.id) + '\', \'phone\', this.value)">' +
            '</div>' +
          '</div>' +
          '<div class="form-field">' +
            '<label class="required">العنوان</label>' +
            '<input type="text" data-branch-addr="' + escapeHtml(b.id) + '" value="' + escapeHtml(b.address) + '" placeholder="الشارع - الحي - رقم المبنى" oninput="ApplyForm.updateBranch(\'' + escapeHtml(b.id) + '\', \'address\', this.value)">' +
          '</div>' +
          '<div class="form-row">' +
            '<div class="form-field">' +
              '<label>مدير الفرع</label>' +
              '<input type="text" data-branch-mgr="' + escapeHtml(b.id) + '" value="' + escapeHtml(b.branch_manager) + '" placeholder="اسم مدير الفرع" oninput="ApplyForm.updateBranch(\'' + escapeHtml(b.id) + '\', \'branch_manager\', this.value)">' +
            '</div>' +
            '<div class="form-field">' +
              '<label>الفرع الرئيسي</label>' +
              '<select onchange="ApplyForm.updateBranch(\'' + escapeHtml(b.id) + '\', \'is_main\', this.value === \'yes\')">' +
                '<option value="no"' + (!b.is_main ? ' selected' : '') + '>لا</option>' +
                '<option value="yes"' + (b.is_main ? ' selected' : '') + '>نعم</option>' +
              '</select>' +
            '</div>' +
          '</div>' +
        '</div>';
    }).join('');
  }

  // ============================================
  // 6. Courses Management
  // ============================================
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
    saveDraft();

    setTimeout(function () {
      var lastCourse = state.courses[state.courses.length - 1];
      var nameInput = document.querySelector('[data-course-name="' + lastCourse.id + '"]');
      if (nameInput) nameInput.focus();
    }, 100);
  }

  function removeCourse(id) {
    state.courses = state.courses.filter(function (c) { return c.id !== id; });
    renderCourses();
    saveDraft();
  }

  function updateCourseField(id, field, value) {
    var course = state.courses.find(function (c) { return c.id === id; });
    if (!course) return;
    course[field] = value;
    saveDraft();
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

    list.innerHTML = state.courses.map(function (c, index) {
      return '' +
        '<div class="dynamic-item">' +
          '<div class="dynamic-item-header">' +
            '<div class="dynamic-item-title">الكورس ' + (index + 1) + '</div>' +
            '<button type="button" class="dynamic-item-remove" onclick="ApplyForm.removeCourse(\'' + escapeHtml(c.id) + '\')" aria-label="حذف الكورس">' +
              '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">' +
                '<line x1="18" y1="6" x2="6" y2="18"></line>' +
                '<line x1="6" y1="6" x2="18" y2="18"></line>' +
              '</svg>' +
            '</button>' +
          '</div>' +
          '<div class="form-field">' +
            '<label class="required">اسم الكورس</label>' +
            '<input type="text" data-course-name="' + escapeHtml(c.id) + '" value="' + escapeHtml(c.name) + '" placeholder="مثال: أمن سيبراني متقدم" oninput="ApplyForm.updateCourse(\'' + escapeHtml(c.id) + '\', \'name\', this.value)">' +
          '</div>' +
          '<div class="form-row-3">' +
            '<div class="form-field">' +
              '<label>عدد الساعات</label>' +
              '<input type="number" value="' + escapeHtml(c.duration_hours) + '" min="1" placeholder="40" oninput="ApplyForm.updateCourse(\'' + escapeHtml(c.id) + '\', \'duration_hours\', this.value)">' +
            '</div>' +
            '<div class="form-field">' +
              '<label>السعر (ج.م)</label>' +
              '<input type="number" value="' + escapeHtml(c.price) + '" min="0" placeholder="1500" oninput="ApplyForm.updateCourse(\'' + escapeHtml(c.id) + '\', \'price\', this.value)">' +
            '</div>' +
            '<div class="form-field">' +
              '<label>عدد المحاضرين</label>' +
              '<input type="number" value="' + escapeHtml(c.instructors_count) + '" min="1" placeholder="2" oninput="ApplyForm.updateCourse(\'' + escapeHtml(c.id) + '\', \'instructors_count\', this.value)">' +
            '</div>' +
          '</div>' +
          '<div class="form-field">' +
            '<label>وصف مختصر</label>' +
            '<textarea placeholder="وصف الكورس" rows="2" oninput="ApplyForm.updateCourse(\'' + escapeHtml(c.id) + '\', \'description\', this.value)">' + escapeHtml(c.description) + '</textarea>' +
          '</div>' +
        '</div>';
    }).join('');
  }

  // ============================================
  // 7. File Uploads
  // ============================================
  function handleFileSelect(fileType, file) {
    if (!file) return;

    // Validate size
    if (file.size > MAX_FILE_SIZE) {
      toast('حجم الملف يتجاوز 10 ميجا', 'error');
      return;
    }

    // Validate type
    if (ALLOWED_MIME.indexOf(file.type) === -1) {
      toast('نوع الملف غير مسموح (PDF أو صورة فقط)', 'error');
      return;
    }

    state.files[fileType] = file;
    renderFilePreview(fileType);
    saveDraft();
  }

  function removeFile(fileType) {
    state.files[fileType] = null;
    renderFilePreview(fileType);

    var inputIds = {
      commercial_registry: 'commercialRegistryFile',
      tax_card: 'taxCardFile',
      place_photo: 'placePhotoFile'
    };

    var input = $(inputIds[fileType]);
    if (input) input.value = '';

    saveDraft();
  }

  function renderFilePreview(fileType) {
    var previewIds = {
      commercial_registry: { preview: 'commercialRegistryPreview', name: 'commercialRegistryName', size: 'commercialRegistrySize' },
      tax_card: { preview: 'taxCardPreview', name: 'taxCardName', size: 'taxCardSize' },
      place_photo: { preview: 'placePhotoPreview', name: 'placePhotoName', size: 'placePhotoSize' }
    };

    var ids = previewIds[fileType];
    if (!ids) return;

    var preview = $(ids.preview);
    var nameEl = $(ids.name);
    var sizeEl = $(ids.size);

    var file = state.files[fileType];

    if (file && preview) {
      preview.classList.add('show');
      if (nameEl) nameEl.textContent = file.name;
      if (sizeEl) sizeEl.textContent = formatFileSize(file.size);
    } else if (preview) {
      preview.classList.remove('show');
    }
  }

  function bindFileInputs() {
    var inputs = {
      commercialRegistryFile: 'commercial_registry',
      taxCardFile: 'tax_card',
      placePhotoFile: 'place_photo'
    };

    Object.keys(inputs).forEach(function (inputId) {
      var input = $(inputId);
      if (!input) return;
      input.addEventListener('change', function (e) {
        var file = e.target.files && e.target.files[0];
        handleFileSelect(inputs[inputId], file);
      });
    });

    // Drag & drop
    document.querySelectorAll('[data-upload]').forEach(function (area) {
      var type = area.getAttribute('data-upload');

      area.addEventListener('dragover', function (e) {
        e.preventDefault();
        area.classList.add('dragging');
      });

      area.addEventListener('dragleave', function () {
        area.classList.remove('dragging');
      });

      area.addEventListener('drop', function (e) {
        e.preventDefault();
        area.classList.remove('dragging');
        var file = e.dataTransfer.files && e.dataTransfer.files[0];
        if (file) handleFileSelect(type, file);
      });
    });
  }

  // ============================================
  // 8. Read Form Data (for review & save)
  // ============================================
  function readBasicInfo() {
    return {
      academy_name: $('academyName') ? $('academyName').value.trim() : '',
      owner_name: $('ownerName') ? $('ownerName').value.trim() : '',
      founded_year: $('foundedYear') ? $('foundedYear').value.trim() : '',
      tax_number: $('taxNumber') ? $('taxNumber').value.trim() : '',
      commercial_registry: $('commercialRegistry') ? $('commercialRegistry').value.trim() : '',
      category_id: $('categoryId') ? $('categoryId').value : '',
      description: $('description') ? $('description').value.trim() : '',
      email: $('email') ? $('email').value.trim() : '',
      phone: $('phone') ? $('phone').value.trim() : ''
    };
  }

  // ============================================
  // 9. Review Rendering
  // ============================================
  function renderReview() {
    var container = $('reviewContent');
    if (!container) return;

    var basic = readBasicInfo();
    var category = state.categories.find(function (c) { return c.id === basic.category_id; });

    var branchesHtml = state.branches.map(function (b, i) {
      return '' +
        '<div class="review-sub-item">' +
          '<div class="review-sub-main">' +
            (i + 1) + '. ' + escapeHtml(b.governorate) +
            (b.is_main ? ' <span style="font-size:11px;color:var(--primary);">(رئيسي)</span>' : '') +
          '</div>' +
          '<div class="review-sub-meta">' + escapeHtml(b.address) + '</div>' +
        '</div>';
    }).join('');

    var coursesHtml = state.courses.length > 0
      ? state.courses.map(function (c, i) {
          return '' +
            '<div class="review-sub-item">' +
              '<div class="review-sub-main">' + (i + 1) + '. ' + escapeHtml(c.name) + '</div>' +
              '<div class="review-sub-meta">' +
                (c.duration_hours ? c.duration_hours + ' ساعة' : '') +
                (c.price ? ' - ' + c.price + ' ج.م' : '') +
              '</div>' +
            '</div>';
        }).join('')
      : '<div class="empty-inline">لم تتم إضافة كورسات</div>';

    var filesHtml = '' +
      '<div class="review-sub-item">' +
        '<div class="review-sub-main">السجل التجاري</div>' +
        '<div class="review-sub-meta">' + (state.files.commercial_registry ? state.files.commercial_registry.name : 'غير مرفوع') + '</div>' +
      '</div>' +
      '<div class="review-sub-item">' +
        '<div class="review-sub-main">البطاقة الضريبية</div>' +
        '<div class="review-sub-meta">' + (state.files.tax_card ? state.files.tax_card.name : 'غير مرفوع') + '</div>' +
      '</div>' +
      '<div class="review-sub-item">' +
        '<div class="review-sub-main">صورة المكان</div>' +
        '<div class="review-sub-meta">' + (state.files.place_photo ? state.files.place_photo.name : 'غير مرفوع') + '</div>' +
      '</div>';

    container.innerHTML = '' +
      // Basic Info
      '<div class="review-section">' +
        '<div class="review-header">' +
          '<div class="review-title">البيانات الأساسية</div>' +
          '<button type="button" class="review-edit" onclick="ApplyForm.goToStep(1)">تعديل</button>' +
        '</div>' +
        '<div class="review-grid">' +
          '<div class="review-item">' +
            '<div class="review-item-label">اسم الأكاديمية</div>' +
            '<div class="review-item-value' + (!basic.academy_name ? ' empty' : '') + '">' + escapeHtml(basic.academy_name || 'غير محدد') + '</div>' +
          '</div>' +
          '<div class="review-item">' +
            '<div class="review-item-label">المالك</div>' +
            '<div class="review-item-value' + (!basic.owner_name ? ' empty' : '') + '">' + escapeHtml(basic.owner_name || 'غير محدد') + '</div>' +
          '</div>' +
          '<div class="review-item">' +
            '<div class="review-item-label">التصنيف</div>' +
            '<div class="review-item-value' + (!category ? ' empty' : '') + '">' + (category ? escapeHtml(category.name) : 'غير محدد') + '</div>' +
          '</div>' +
          '<div class="review-item">' +
            '<div class="review-item-label">سنة التأسيس</div>' +
            '<div class="review-item-value' + (!basic.founded_year ? ' empty' : '') + '">' + escapeHtml(basic.founded_year || 'غير محدد') + '</div>' +
          '</div>' +
          '<div class="review-item">' +
            '<div class="review-item-label">البطاقة الضريبية</div>' +
            '<div class="review-item-value' + (!basic.tax_number ? ' empty' : '') + '">' + escapeHtml(basic.tax_number || 'غير محدد') + '</div>' +
          '</div>' +
          '<div class="review-item">' +
            '<div class="review-item-label">السجل التجاري</div>' +
            '<div class="review-item-value' + (!basic.commercial_registry ? ' empty' : '') + '">' + escapeHtml(basic.commercial_registry || 'غير محدد') + '</div>' +
          '</div>' +
          '<div class="review-item">' +
            '<div class="review-item-label">البريد الإلكتروني</div>' +
            '<div class="review-item-value' + (!basic.email ? ' empty' : '') + '">' + escapeHtml(basic.email || 'غير محدد') + '</div>' +
          '</div>' +
          '<div class="review-item">' +
            '<div class="review-item-label">الهاتف</div>' +
            '<div class="review-item-value' + (!basic.phone ? ' empty' : '') + '">' + escapeHtml(basic.phone || 'غير محدد') + '</div>' +
          '</div>' +
        '</div>' +
      '</div>' +

      // Branches
      '<div class="review-section">' +
        '<div class="review-header">' +
          '<div class="review-title">الفروع (' + state.branches.length + ')</div>' +
          '<button type="button" class="review-edit" onclick="ApplyForm.goToStep(2)">تعديل</button>' +
        '</div>' +
        '<div class="review-sub-list">' + branchesHtml + '</div>' +
      '</div>' +

      // Courses
      '<div class="review-section">' +
        '<div class="review-header">' +
          '<div class="review-title">الكورسات (' + state.courses.length + ')</div>' +
          '<button type="button" class="review-edit" onclick="ApplyForm.goToStep(3)">تعديل</button>' +
        '</div>' +
        '<div class="review-sub-list">' + coursesHtml + '</div>' +
      '</div>' +

      // Documents
      '<div class="review-section">' +
        '<div class="review-header">' +
          '<div class="review-title">المستندات</div>' +
          '<button type="button" class="review-edit" onclick="ApplyForm.goToStep(4)">تعديل</button>' +
        '</div>' +
        '<div class="review-sub-list">' + filesHtml + '</div>' +
      '</div>';
  }

  // ============================================
  // 10. Draft Save/Restore
  // ============================================
  function saveDraft() {
    // Don't save if submitted
    if (state.submitted) return;

    try {
      var draft = {
        currentStep: state.currentStep,
        basic: readBasicInfo(),
        branches: state.branches,
        courses: state.courses,
        savedAt: Date.now()
      };

      localStorage.setItem(DRAFT_KEY, JSON.stringify(draft));
      logDebug('Draft saved');
    } catch (e) {
      logDebug('Draft save error:', e.message);
    }
  }

  function restoreDraft() {
    try {
      var raw = localStorage.getItem(DRAFT_KEY);
      if (!raw) return false;

      var draft = JSON.parse(raw);
      if (!draft || !draft.savedAt) return false;

      // Don't restore if older than 7 days
      var age = Date.now() - draft.savedAt;
      if (age > 7 * 24 * 60 * 60 * 1000) {
        localStorage.removeItem(DRAFT_KEY);
        return false;
      }

      // Restore basic
      if (draft.basic) {
        var fields = ['academyName', 'ownerName', 'foundedYear', 'taxNumber', 'commercialRegistry', 'description', 'email', 'phone'];
        fields.forEach(function (f) {
          var el = $(f);
          var key = f.replace(/([A-Z])/g, '_$1').toLowerCase();
          if (el && draft.basic[key]) {
            el.value = draft.basic[key];
          }
        });

        // Category
        if (draft.basic.category_id) {
          setTimeout(function () {
            var catSel = $('categoryId');
            if (catSel) catSel.value = draft.basic.category_id;
          }, 200);
        }
      }

      // Restore branches
      if (draft.branches && Array.isArray(draft.branches)) {
        state.branches = draft.branches.map(function (b) {
          return {
            id: b.id || generateId(),
            governorate: b.governorate || '',
            address: b.address || '',
            phone: b.phone || '',
            is_main: b.is_main || false,
            branch_manager: b.branch_manager || ''
          };
        });
      }

      // Restore courses
      if (draft.courses && Array.isArray(draft.courses)) {
        state.courses = draft.courses.map(function (c) {
          return {
            id: c.id || generateId(),
            name: c.name || '',
            description: c.description || '',
            duration_hours: c.duration_hours || '',
            price: c.price || '',
            instructors_count: c.instructors_count || ''
          };
        });
      }

      state.currentStep = draft.currentStep || 1;

      return true;
    } catch (e) {
      logDebug('Draft restore error:', e.message);
      return false;
    }
  }

  function clearDraft() {
    try {
      localStorage.removeItem(DRAFT_KEY);
    } catch (e) {}
  }

  function startDraftAutoSave() {
    if (state.draftSaveTimer) return;

    state.draftSaveTimer = setInterval(function () {
      if (!state.submitted) saveDraft();
    }, 30000);
  }

  // ============================================
  // 11. Upload files to Supabase Storage
  // ============================================
  function uploadFile(file, academyId, fileType) {
    if (!file || !window.sb) return Promise.reject(new Error('No file'));

    var ext = file.name.split('.').pop();
    var fileName = fileType + '_' + Date.now() + '.' + ext;
    var path = academyId + '/' + fileType + '/' + fileName;

    return window.sb.storage
      .from('academy-documents')
      .upload(path, file, {
        cacheControl: '3600',
        upsert: false,
        contentType: file.type
      })
      .then(function (res) {
        if (res.error) throw new Error(res.error.message);

        // Get public URL
        var urlRes = window.sb.storage
          .from('academy-documents')
          .getPublicUrl(path);

        return {
          path: path,
          url: urlRes.data ? urlRes.data.publicUrl : path
        };
      });
  }

  // ============================================
  // 12. Submit
  // ============================================
  function submit() {
    if (state.submitting || state.submitted) return;

    // Validate all steps
    if (!validateStep1()) {
      toast('راجع البيانات الأساسية', 'error');
      goToStep(1);
      return;
    }

    if (!validateStep2()) {
      goToStep(2);
      return;
    }

    if (!validateStep4()) {
      goToStep(4);
      return;
    }

    var termsCheck = $('termsAccept');
    if (!termsCheck || !termsCheck.checked) {
      toast('يجب الموافقة على الشروط والأحكام', 'error');
      return;
    }

    if (!window.sb) {
      toast('تعذر الاتصال بالخادم', 'error');
      return;
    }

    state.submitting = true;
    var submitBtn = $('submitBtn');
    if (submitBtn) {
      submitBtn.disabled = true;
      submitBtn.innerHTML = '<span>جاري التقديم...</span>';
    }

    var basic = readBasicInfo();
    var academyId = null;
    var requestNumber = generateRequestNumber();
    var uploadedFiles = {};

    // ===== STEP 1: Insert academy =====
    var academyData = {
      name: basic.academy_name,
      owner_name: basic.owner_name,
      founded_year: basic.founded_year ? parseInt(basic.founded_year, 10) : null,
      tax_number: basic.tax_number,
      commercial_registry: basic.commercial_registry,
      category_id: basic.category_id || null,
      description: basic.description || null,
      email: basic.email || null,
      phone: basic.phone || null,
      academy_type: 'external',
      status: 'pending',
      is_deleted: false,
      created_at: new Date().toISOString()
    };

    window.sb.from('academies').insert(academyData).select('id').single()
      .then(function (res) {
        if (res.error) throw new Error('فشل إنشاء الأكاديمية: ' + res.error.message);
        academyId = res.data.id;
        logDebug('Academy created:', academyId);

        // ===== STEP 2: Upload files =====
        var uploadPromises = [];

        if (state.files.commercial_registry) {
          uploadPromises.push(
            uploadFile(state.files.commercial_registry, academyId, 'commercial_registry')
              .then(function (r) {
                uploadedFiles.commercial_registry = r;
              })
              .catch(function (err) {
                logDebug('Upload commercial_registry failed:', err.message);
              })
          );
        }

        if (state.files.tax_card) {
          uploadPromises.push(
            uploadFile(state.files.tax_card, academyId, 'tax_card')
              .then(function (r) {
                uploadedFiles.tax_card = r;
              })
              .catch(function (err) {
                logDebug('Upload tax_card failed:', err.message);
              })
          );
        }

        if (state.files.place_photo) {
          uploadPromises.push(
            uploadFile(state.files.place_photo, academyId, 'place_photo')
              .then(function (r) {
                uploadedFiles.place_photo = r;
              })
              .catch(function (err) {
                logDebug('Upload place_photo failed:', err.message);
              })
          );
        }

        return Promise.all(uploadPromises);
      })
      .then(function () {
        // ===== STEP 3: Insert branches =====
        if (state.branches.length > 0) {
          var branchesData = state.branches.map(function (b) {
            return {
              academy_id: academyId,
              governorate: b.governorate,
              address: b.address,
              phone: b.phone || null,
              is_main: b.is_main || false,
              branch_manager: b.branch_manager || null
            };
          });

          return window.sb.from('academy_branches').insert(branchesData)
            .then(function (res) {
              if (res.error) {
                logDebug('Branches insert error:', res.error.message);
              }
            });
        }
        return Promise.resolve();
      })
      .then(function () {
        // ===== STEP 4: Insert courses =====
        if (state.courses.length > 0) {
          var coursesData = state.courses.map(function (c) {
            return {
              academy_id: academyId,
              name: c.name,
              description: c.description || null,
              duration_hours: c.duration_hours ? parseInt(c.duration_hours, 10) : null,
              price: c.price ? parseFloat(c.price) : null,
              instructors_count: c.instructors_count ? parseInt(c.instructors_count, 10) : null
            };
          });

          return window.sb.from('academy_courses').insert(coursesData)
            .then(function (res) {
              if (res.error) {
                logDebug('Courses insert error:', res.error.message);
              }
            });
        }
        return Promise.resolve();
      })
      .then(function () {
        // ===== STEP 5: Insert accreditation request =====
        var requestData = {
          academy_id: academyId,
          request_number: requestNumber,
          current_stage: 'submitted',
          submitted_at: new Date().toISOString(),
          commercial_registry_url: uploadedFiles.commercial_registry ? uploadedFiles.commercial_registry.url : null,
          tax_card_url: uploadedFiles.tax_card ? uploadedFiles.tax_card.url : null,
          place_photo_url: uploadedFiles.place_photo ? uploadedFiles.place_photo.url : null
        };

        return window.sb.from('accreditation_requests').insert(requestData)
          .then(function (res) {
            if (res.error) {
              logDebug('Request insert error:', res.error.message);
              // Request insert failed but academy exists - try to update academy
              throw new Error('فشل إنشاء طلب الاعتماد: ' + res.error.message);
            }
          });
      })
      .then(function () {
        // ===== SUCCESS =====
        state.submitted = true;
        clearDraft();
        showSuccess(requestNumber);
        logDebug('Application submitted successfully:', requestNumber);
      })
      .catch(function (err) {
        logDebug('Submit error:', err.message);
        toast(err.message || 'حدث خطأ في التقديم. حاول مرة أخرى.', 'error');

        state.submitting = false;
        if (submitBtn) {
          submitBtn.disabled = false;
          submitBtn.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="width:16px;height:16px;"><line x1="22" y1="2" x2="11" y2="13"></line><polygon points="22 2 15 22 11 13 2 9 22 2"></polygon></svg><span>تقديم الطلب</span>';
        }
      });
  }

  function showSuccess(requestNumber) {
    // Hide form & progress
    var progress = $('progressWrap');
    var main = document.querySelector('.apply-main form');
    var stepNav = $('stepNav');
    var successScreen = $('successScreen');

    if (progress) progress.style.display = 'none';
    if (main) main.style.display = 'none';
    if (stepNav) stepNav.style.display = 'none';

    // Update success
    var reqEl = $('successRequestNumber');
    if (reqEl) reqEl.textContent = requestNumber;

    var trackBtn = $('successTrackBtn');
    if (trackBtn) {
      trackBtn.href = (window.resolveUrl ? window.resolveUrl('track.html') : 'track.html') + '?request=' + encodeURIComponent(requestNumber);
    }

    if (successScreen) {
      successScreen.classList.add('show');
      successScreen.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }

    // Store last request for convenience
    try {
      localStorage.setItem('itws_last_request', requestNumber);
    } catch (e) {}
  }

  function copyRequestNumber() {
    var el = $('successRequestNumber');
    if (!el) return;

    var text = el.textContent;

    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(function () {
        toast('تم نسخ رقم الطلب', 'success');
      }).catch(function () {
        prompt('انسخ رقم الطلب:', text);
      });
    } else {
      prompt('انسخ رقم الطلب:', text);
    }
  }

  // ============================================
  // 13. Init
  // ============================================
  function init() {
    if (state.initialized) return;
    state.initialized = true;

    // Restore draft
    var restored = restoreDraft();
    if (restored) {
      toast('تم استعادة المسودة السابقة', 'info');
    }

    // Load categories
    if (window.sb) {
      loadCategories().then(function (cats) {
        state.categories = cats;
        populateCategorySelect();

        // Restore category from draft
        if (restored) {
          var draft = null;
          try {
            var raw = localStorage.getItem(DRAFT_KEY);
            if (raw) draft = JSON.parse(raw);
          } catch (e) {}

          if (draft && draft.basic && draft.basic.category_id) {
            var catSel = $('categoryId');
            if (catSel) catSel.value = draft.basic.category_id;
          }
        }
      });
    }

    // Bind file inputs
    bindFileInputs();

    // Render branches & courses from draft
    renderBranches();
    renderCourses();

    // If no branches, add one default
    if (state.branches.length === 0) {
      addBranch();
    }

    // Go to restored step
    if (restored && state.currentStep > 1) {
      goToStep(state.currentStep);
    } else {
      goToStep(1);
    }

    // Start auto-save
    startDraftAutoSave();

    // Warn before leaving
    window.addEventListener('beforeunload', function (e) {
      if (!state.submitted && (state.branches.length > 0 || state.courses.length > 0 || state.files.commercial_registry)) {
        saveDraft();
        var msg = 'هل أنت متأكد من المغادرة؟ سيتم حفظ مسودة تلقائياً.';
        e.returnValue = msg;
        return msg;
      }
    });

    logDebug('Apply form initialized');
  }

  // ============================================
  // 14. Public API
  // ============================================
  window.ApplyForm = {
    initialized: true,
    init: init,
    nextStep: nextStep,
    prevStep: prevStep,
    goToStep: goToStep,
    addBranch: addBranch,
    removeBranch: removeBranch,
    updateBranch: updateBranchField,
    addCourse: addCourse,
    removeCourse: removeCourse,
    updateCourse: updateCourseField,
    removeFile: removeFile,
    submit: submit,
    copyRequestNumber: copyRequestNumber,
    saveDraft: saveDraft,
    clearDraft: clearDraft
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

})();
