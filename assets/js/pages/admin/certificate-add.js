// ============================================
// [39/50] ITWS Platform - Add Certificate Logic
// Path: assets/js/pages/admin/certificate-add.js
// ============================================
// إضافة شهادة جديدة
// يدعم النقابة والأكاديميات (issuer_type)
// Live preview + Validation + Draft + Uniqueness check
// بدون إيموجي
// ============================================

(function () {
  'use strict';

  if (window.AddCertificate && window.AddCertificate.initialized) return;

  var DRAFT_KEY = 'itws_certificate_draft';

  var state = {
    issuerType: 'union',
    academies: [],
    branches: {},
    submitting: false,
    draftTimer: null,
    currentUser: null,
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

  function toast(msg, type) {
    if (window.Utils && window.Utils.showToast) {
      window.Utils.showToast(msg, type || 'info');
    } else if (type === 'error') {
      alert(msg);
    }
  }

  function logDebug() {
    if (window.ITWS_CONFIG && window.ITWS_CONFIG.DEBUG) {
      console.log.apply(console, ['[AddCertificate]'].concat(Array.prototype.slice.call(arguments)));
    }
  }

  function resolve(path) {
    if (!path) return '#';
    if (window.resolveUrl) return window.resolveUrl(path);
    var base = (window.ITWS_CONFIG && window.ITWS_CONFIG.BASE_PATH) || '';
    return base + String(path).replace(/^\.?\//, '');
  }

  function getSetting(p, f) {
    if (window.AppSettings && window.AppSettings.get) {
      return window.AppSettings.get(p, f);
    }
    return f;
  }

  function hasPermission(perm) {
    if (window.Permissions && window.Permissions.can) {
      return window.Permissions.can(perm);
    }
    if (window.AuthGuard && window.AuthGuard.getUser) {
      var u = window.AuthGuard.getUser();
      if (!u) return false;
      return u.role === 'super_admin' || u.role === 'admin' || u.role === 'committee_manager';
    }
    return false;
  }

  // ============================================
  // 2. Code Generation
  // ============================================
  function generateCertificateCode() {
    var year = new Date().getFullYear();
    var chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    var random = '';
    for (var i = 0; i < 6; i++) {
      random += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return 'NTI-' + year + '-' + random;
  }

  function setCodeToInput(code) {
    var input = $('certificateCode');
    if (input) {
      input.value = code;
      updatePreview();
    }
  }

  // ============================================
  // 3. Load Academias
  // ============================================
  function loadAcademies() {
    if (!window.sb) return Promise.resolve([]);

    return window.sb
      .from('academies')
      .select('id, name, license_number')
      .eq('status', 'approved')
      .eq('is_deleted', false)
      .order('name', { ascending: true })
      .then(function (res) {
        if (res.error || !res.data) return [];
        return res.data;
      })
      .catch(function () { return []; });
  }

  function populateAcademySelect() {
    var select = $('academySelect');
    if (!select) return;

    var html = '<option value="">اختر الأكاديمية</option>';
    state.academies.forEach(function (a) {
      html += '<option value="' + escapeHtml(a.id) + '">' + escapeHtml(a.name) + '</option>';
    });
    select.innerHTML = html;
  }

  function loadBranches(academyId) {
    if (!academyId || !window.sb) return Promise.resolve([]);

    return window.sb
      .from('academy_branches')
      .select('id, governorate, address, is_main')
      .eq('academy_id', academyId)
      .order('is_main', { ascending: false })
      .order('governorate', { ascending: true })
      .then(function (res) {
        if (res.error || !res.data) return [];
        return res.data;
      })
      .catch(function () { return []; });
  }

  function populateBranchSelect(branches) {
    var select = $('branchSelect');
    if (!select) return;

    var html = '<option value="">اختر الفرع (اختياري)</option>';
    branches.forEach(function (b) {
      var label = b.governorate || 'فرع';
      if (b.is_main) label += ' (رئيسي)';
      html += '<option value="' + escapeHtml(b.id) + '">' + escapeHtml(label) + '</option>';
    });
    select.innerHTML = html;
    select.disabled = false;
  }

  function resetBranchSelect() {
    var select = $('branchSelect');
    if (!select) return;
    select.innerHTML = '<option value="">اختر الفرع (اختياري)</option>';
    select.disabled = true;
  }

  // ============================================
  // 4. Issuer Type Switch
  // ============================================
  function setIssuerType(type) {
    state.issuerType = type;

    // Update radio cards
    document.querySelectorAll('.issuer-radio-card').forEach(function (card) {
      var cardType = card.getAttribute('data-issuer');
      card.classList.toggle('active', cardType === type);
    });

    // Show/hide academy selector
    var selector = $('academySelector');
    var academySelect = $('academySelect');
    var branchSelect = $('branchSelect');

    if (type === 'academy') {
      if (selector) selector.classList.add('show');
      if (academySelect) academySelect.disabled = false;
    } else {
      if (selector) selector.classList.remove('show');
      if (academySelect) { academySelect.disabled = true; academySelect.value = ''; }
      if (branchSelect) { branchSelect.disabled = true; branchSelect.value = ''; }
      resetBranchSelect();
    }

    updatePreview();
    saveDraft();
  }

  // ============================================
  // 5. Live Preview
  // ============================================
  function updatePreview() {
    var issuer = state.issuerType;

    // Issuer label
    var issuerEl = $('previewIssuer');
    if (issuerEl) {
      if (issuer === 'union') {
        issuerEl.innerHTML = '' +
          '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">' +
            '<path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"></path>' +
          '</svg>' +
          '<span>النقابة</span>';
      } else {
        var acSelect = $('academySelect');
        var acText = 'أكاديمية';
        if (acSelect && acSelect.value) {
          var opt = acSelect.options[acSelect.selectedIndex];
          if (opt && opt.text) acText = opt.text;
        }
        issuerEl.innerHTML = '' +
          '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">' +
            '<path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"></path>' +
          '</svg>' +
          '<span>' + escapeHtml(acText) + '</span>';
      }
    }

    // Code
    var codeInput = $('certificateCode');
    setText('previewCode', codeInput ? (codeInput.value || 'NTI-YYYY-XXXXXX') : 'NTI-YYYY-XXXXXX');

    // Student
    var studentInput = $('studentName');
    var studentText = studentInput ? studentInput.value.trim() : '';
    var studentEl = $('previewStudent');
    if (studentEl) {
      studentEl.textContent = studentText || '—';
      studentEl.classList.toggle('empty', !studentText);
    }

    // National ID (masked)
    var nationalInput = $('studentNationalId');
    var nationalText = nationalInput ? nationalInput.value.trim() : '';
    var nationalEl = $('previewNationalId');
    if (nationalEl) {
      if (nationalText && nationalText.length >= 4) {
        nationalEl.textContent = '••••' + nationalText.slice(-4);
        nationalEl.classList.remove('empty');
      } else {
        nationalEl.textContent = '—';
        nationalEl.classList.add('empty');
      }
    }

    // Course
    var courseInput = $('courseName');
    var courseText = courseInput ? courseInput.value.trim() : '';
    var courseEl = $('previewCourse');
    if (courseEl) {
      courseEl.textContent = courseText || '—';
      courseEl.classList.toggle('empty', !courseText);
    }

    // Hours
    var hoursInput = $('courseHours');
    var hoursText = hoursInput ? hoursInput.value.trim() : '';
    var hoursEl = $('previewHours');
    if (hoursEl) {
      hoursEl.textContent = hoursText ? hoursText + ' ساعة' : '—';
      hoursEl.classList.toggle('empty', !hoursText);
    }

    // Grade
    var gradeSelect = $('grade');
    var gradeText = gradeSelect ? gradeSelect.value : '';
    var gradeEl = $('previewGrade');
    if (gradeEl) {
      gradeEl.textContent = gradeText || '—';
      gradeEl.classList.toggle('empty', !gradeText);
    }

    // Academy (only if academy)
    var academyEl = $('previewAcademy');
    if (academyEl) {
      if (issuer === 'academy') {
        var acSel = $('academySelect');
        if (acSel && acSel.value) {
          var opt2 = acSel.options[acSel.selectedIndex];
          academyEl.textContent = opt2 ? opt2.text : '—';
          academyEl.classList.remove('empty');
        } else {
          academyEl.textContent = '—';
          academyEl.classList.add('empty');
        }
      } else {
        academyEl.textContent = 'النقابة';
        academyEl.classList.remove('empty');
      }
    }
  }

  // ============================================
  // 6. Validation
  // ============================================
  function clearErrors() {
    document.querySelectorAll('.form-error').forEach(function (el) {
      el.classList.remove('show');
      el.textContent = '';
    });
    document.querySelectorAll('.error').forEach(function (el) {
      el.classList.remove('error');
    });
  }

  function setError(fieldId, errorId, msg) {
    var field = $(fieldId);
    var error = $(errorId);
    if (field) field.classList.add('error');
    if (error) {
      error.textContent = msg;
      error.classList.add('show');
    }
  }

  function validateForm() {
    clearErrors();
    var valid = true;

    // Academy (only if issuer = academy)
    if (state.issuerType === 'academy') {
      var academySelect = $('academySelect');
      if (!academySelect || !academySelect.value) {
        setError('academySelect', 'academySelectError', 'اختر الأكاديمية');
        valid = false;
      }
    }

    // Student name
    var studentName = $('studentName');
    if (!studentName || !studentName.value.trim() || studentName.value.trim().length < 3) {
      setError('studentName', 'studentNameError', 'أدخل اسم المتدرب (3 أحرف على الأقل)');
      valid = false;
    }

    // National ID
    var nationalInput = $('studentNationalId');
    var nationalValue = nationalInput ? nationalInput.value.trim() : '';
    if (!/^\d{14}$/.test(nationalValue)) {
      setError('studentNationalId', 'studentNationalIdError', 'الرقم القومي يجب أن يكون 14 رقماً');
      valid = false;
    }

    // Course name
    var courseInput = $('courseName');
    if (!courseInput || !courseInput.value.trim()) {
      setError('courseName', 'courseNameError', 'أدخل اسم الدورة');
      valid = false;
    }

    // Course hours
    var hoursInput = $('courseHours');
    var hoursValue = hoursInput ? parseInt(hoursInput.value, 10) : 0;
    if (!hoursValue || hoursValue < 1 || hoursValue > 500) {
      setError('courseHours', 'courseHoursError', 'عدد الساعات يجب أن يكون بين 1 و 500');
      valid = false;
    }

    // Grade
    var gradeSelect = $('grade');
    if (!gradeSelect || !gradeSelect.value) {
      setError('grade', 'gradeError', 'اختر التقدير');
      valid = false;
    }

    // Certificate code
    var codeInput = $('certificateCode');
    var codeValue = codeInput ? codeInput.value.trim() : '';
    if (!codeValue || codeValue.length < 8) {
      setError('certificateCode', 'certificateCodeError', 'كود الشهادة غير صالح');
      valid = false;
    }

    // Focus first error
    if (!valid) {
      var firstError = document.querySelector('.form-field .error');
      if (firstError) firstError.focus();
    }

    return valid;
  }

  // ============================================
  // 7. Check Code Uniqueness
  // ============================================
  function checkCodeUniqueness(code) {
    if (!window.sb) return Promise.resolve(true);

    return window.sb
      .from('certificates')
      .select('id')
      .eq('certificate_code', code)
      .maybeSingle()
      .then(function (res) {
        if (res.error) return true; // في حالة خطأ، نفترض فريد
        return !res.data; // true لو مش موجود
      })
      .catch(function () { return true; });
  }

  // ============================================
  // 8. Draft Management
  // ============================================
  function saveDraft() {
    try {
      var draft = {
        issuerType: state.issuerType,
        academyId: ($('academySelect') || {}).value || '',
        branchId: ($('branchSelect') || {}).value || '',
        studentName: ($('studentName') || {}).value || '',
        studentNationalId: ($('studentNationalId') || {}).value || '',
        courseName: ($('courseName') || {}).value || '',
        courseHours: ($('courseHours') || {}).value || '',
        grade: ($('grade') || {}).value || '',
        completionDate: ($('completionDate') || {}).value || '',
        certificateCode: ($('certificateCode') || {}).value || '',
        savedAt: Date.now()
      };

      localStorage.setItem(DRAFT_KEY, JSON.stringify(draft));
    } catch (e) {}
  }

  function restoreDraft() {
    try {
      var raw = localStorage.getItem(DRAFT_KEY);
      if (!raw) return false;

      var draft = JSON.parse(raw);
      if (!draft || !draft.savedAt) return false;

      // Skip if older than 3 days
      if (Date.now() - draft.savedAt > 3 * 24 * 60 * 60 * 1000) {
        localStorage.removeItem(DRAFT_KEY);
        return false;
      }

      // Don't restore if empty
      if (!draft.studentName && !draft.courseName && !draft.studentNationalId) {
        return false;
      }

      // Restore issuer
      if (draft.issuerType === 'academy') {
        setIssuerType('academy');
        var acSelect = $('academySelect');
        if (acSelect && draft.academyId) {
          acSelect.value = draft.academyId;
          // Load branches and restore branch
          loadBranches(draft.academyId).then(function (branches) {
            populateBranchSelect(branches);
            if (draft.branchId) {
              var bSelect = $('branchSelect');
              if (bSelect) bSelect.value = draft.branchId;
            }
          });
        }
      }

      // Restore fields
      if (draft.studentName && $('studentName')) $('studentName').value = draft.studentName;
      if (draft.studentNationalId && $('studentNationalId')) $('studentNationalId').value = draft.studentNationalId;
      if (draft.courseName && $('courseName')) $('courseName').value = draft.courseName;
      if (draft.courseHours && $('courseHours')) $('courseHours').value = draft.courseHours;
      if (draft.grade && $('grade')) $('grade').value = draft.grade;
      if (draft.completionDate && $('completionDate')) $('completionDate').value = draft.completionDate;
      if (draft.certificateCode && $('certificateCode')) $('certificateCode').value = draft.certificateCode;

      updatePreview();
      return true;
    } catch (e) {
      return false;
    }
  }

  function clearDraft() {
    try {
      localStorage.removeItem(DRAFT_KEY);
    } catch (e) {}
  }

  // ============================================
  // 9. Submit
  // ============================================
  function handleSubmit(e) {
    if (e) e.preventDefault();
    if (state.submitting) return;

    if (!validateForm()) {
      toast('يرجى مراجعة البيانات', 'error');
      return;
    }

    if (!hasPermission('certificate.create')) {
      toast('غير مصرح لك بإضافة شهادات', 'error');
      return;
    }

    if (!window.sb) {
      toast('تعذر الاتصال بالخادم', 'error');
      return;
    }

    var code = $('certificateCode').value.trim();
    state.submitting = true;
    showOverlay(true);
    disableSubmit(true);

    // ✅ Check code uniqueness first
    checkCodeUniqueness(code)
      .then(function (isUnique) {
        if (!isUnique) {
          setError('certificateCode', 'certificateCodeError', 'هذا الكود مستخدم بالفعل. جرب كوداً آخر.');
          toast('كود الشهادة مستخدم بالفعل', 'error');
          throw new Error('duplicate_code');
        }

        // Build data
        var studentName = $('studentName').value.trim();
        var studentNationalId = $('studentNationalId').value.trim();
        var courseName = $('courseName').value.trim();
        var courseHours = parseInt($('courseHours').value, 10);
        var grade = $('grade').value;
        var completionDate = $('completionDate').value || null;

        var academyId = null;
        var branchId = null;
        var academyName = null;
        var academyLicense = null;
        var branchName = null;

        if (state.issuerType === 'academy') {
          academyId = $('academySelect').value;
          branchId = $('branchSelect').value || null;

          // Snapshot academy info
          var academy = state.academies.find(function (a) { return a.id === academyId; });
          if (academy) {
            academyName = academy.name;
            academyLicense = academy.license_number;
          }

          // Snapshot branch name
          if (branchId) {
            var branchSelect = $('branchSelect');
            var opt = branchSelect.options[branchSelect.selectedIndex];
            if (opt) branchName = opt.text.replace(' (رئيسي)', '');
          }
        }

        var certificateData = {
          certificate_code: code,
          student_name: studentName,
          student_national_id: studentNationalId,
          course_name: courseName,
          course_hours: courseHours,
          grade: grade,
          completion_date: completionDate,

          // ✅ Issuer type
          issuer_type: state.issuerType,
          academy_id: academyId,
          branch_id: branchId,

          // Snapshots
          academy_name: academyName,
          academy_license_number: academyLicense,
          branch_name: branchName,

          is_active: true,
          issued_at: new Date().toISOString()
        };

        logDebug('Inserting certificate:', certificateData);

        return window.sb.from('certificates').insert(certificateData).select('id').single();
      })
      .then(function (res) {
        if (res.error) {
          throw new Error(res.error.message);
        }

        var newCertId = res.data.id;
        logDebug('Certificate created:', newCertId);

        // Log activity
        logActivity('create_certificate', 'إضافة شهادة جديدة: ' + code, {
          certificate_id: newCertId,
          student_name: $('studentName').value.trim(),
          issuer_type: state.issuerType
        });

        // Clear draft
        clearDraft();

        toast('تم حفظ الشهادة بنجاح', 'success');

        // Redirect to view after short delay
        setTimeout(function () {
          window.location.href = resolve('admin/certificate-view.html?id=' + encodeURIComponent(newCertId));
        }, 800);
      })
      .catch(function (err) {
        if (err.message === 'duplicate_code') return; // already handled

        logDebug('Submit error:', err.message);
        toast('حدث خطأ: ' + err.message, 'error');
        showOverlay(false);
        disableSubmit(false);
        state.submitting = false;
      });
  }

  function showOverlay(show) {
    var overlay = $('submitOverlay');
    if (!overlay) return;
    if (show) overlay.classList.add('show');
    else overlay.classList.remove('show');
  }

  function disableSubmit(disable) {
    var btn = $('submitBtn');
    if (!btn) return;
    btn.disabled = disable;
    if (disable) {
      btn.innerHTML = '<span>جاري الحفظ...</span>';
    } else {
      btn.innerHTML = '' +
        '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="width:16px;height:16px;">' +
          '<path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"></path>' +
          '<polyline points="17 21 17 13 7 13 7 21"></polyline>' +
          '<polyline points="7 3 7 8 15 8"></polyline>' +
        '</svg>' +
        '<span>حفظ الشهادة</span>';
    }
  }

  function logActivity(type, description, details) {
    if (!window.sb) return;
    var user = state.currentUser;
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
  // 10. Bind Events
  // ============================================
  function bindEvents() {
    // Issuer radio cards
    document.querySelectorAll('.issuer-radio-card').forEach(function (card) {
      card.addEventListener('click', function () {
        var type = card.getAttribute('data-issuer');
        if (type) setIssuerType(type);
      });
    });

    // Academy select change
    var academySelect = $('academySelect');
    if (academySelect) {
      academySelect.addEventListener('change', function () {
        var academyId = academySelect.value;
        if (!academyId) {
          resetBranchSelect();
          updatePreview();
          saveDraft();
          return;
        }

        resetBranchSelect();
        loadBranches(academyId).then(function (branches) {
          populateBranchSelect(branches);
          updatePreview();
        });
        saveDraft();
      });
    }

    // Branch select change
    var branchSelect = $('branchSelect');
    if (branchSelect) {
      branchSelect.addEventListener('change', function () {
        saveDraft();
      });
    }

    // National ID — only digits
    var nationalInput = $('studentNationalId');
    if (nationalInput) {
      nationalInput.addEventListener('input', function () {
        this.value = this.value.replace(/[^0-9]/g, '').substring(0, 14);
        updatePreview();
      });
    }

    // All inputs → live preview + draft
    ['studentName', 'courseName', 'courseHours', 'grade', 'completionDate', 'certificateCode'].forEach(function (id) {
      var el = $(id);
      if (!el) return;
      el.addEventListener('input', function () {
        updatePreview();
        if (state.draftTimer) clearTimeout(state.draftTimer);
        state.draftTimer = setTimeout(saveDraft, 800);
      });
      el.addEventListener('change', function () {
        updatePreview();
      });
    });

    // Regenerate code button
    var regenBtn = $('regenerateCode');
    if (regenBtn) {
      regenBtn.addEventListener('click', function () {
        setCodeToInput(generateCertificateCode());
        saveDraft();
        toast('تم توليد كود جديد', 'info');
      });
    }

    // Form submit
    var form = $('addForm');
    if (form) {
      form.addEventListener('submit', handleSubmit);
    }

    // Warn before leaving
    window.addEventListener('beforeunload', function (e) {
      if (!state.submitting) {
        saveDraft();
        var studentName = $('studentName');
        var courseName = $('courseName');
        if ((studentName && studentName.value) || (courseName && courseName.value)) {
          var msg = 'هل تريد المغادرة؟ سيتم حفظ مسودة تلقائياً.';
          e.returnValue = msg;
          return msg;
        }
      }
    });
  }

  // ============================================
  // 11. Init
  // ============================================
  function init() {
    if (state.initialized) return;
    state.initialized = true;

    // Permission check
    if (!hasPermission('certificate.create')) {
      toast('غير مصرح لك بالوصول لهذه الصفحة', 'error');
      setTimeout(function () {
        window.location.href = resolve('admin/certificates.html');
      }, 1500);
      return;
    }

    // Load user
    if (window.AuthGuard && window.AuthGuard.getUser) {
      state.currentUser = window.AuthGuard.getUser();
    }

    // Set initial code
    setCodeToInput(generateCertificateCode());

    // Load academies
    waitForSupabase(function () {
      loadAcademies().then(function (academies) {
        state.academies = academies;
        populateAcademySelect();

        // Try restore draft
        var restored = restoreDraft();
        if (restored) {
          toast('تم استعادة المسودة السابقة', 'info');
        }
      });
    });

    // Bind events
    bindEvents();

    // Initial preview
    updatePreview();

    logDebug('Add certificate page initialized');
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
  window.AddCertificate = {
    initialized: true,
    init: init,
    generateCode: generateCertificateCode,
    clearDraft: clearDraft,
    saveDraft: saveDraft
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

})();
