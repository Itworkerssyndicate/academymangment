// ============================================
// ITWS Platform - Admin Certificate Edit Logic
// Path: assets/js/pages/admin/certificate-edit.js
// ============================================
// تعديل شهادة موجودة (يدعم النقابة والأكاديميات)
// Live preview + Validation + Update
// بدون إيموجي
// ============================================

(function () {
  'use strict';

  if (window.AdminCertificateEdit && window.AdminCertificateEdit.initialized) return;

  var state = {
    certificateId: null,
    certificate: null,
    academies: [],
    issuerType: 'union',
    currentUser: null,
    submitting: false,
    initialized: false
  };

  // ============ Helpers ============
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
      console.log.apply(console, ['[AdminCertificateEdit]'].concat(Array.prototype.slice.call(arguments)));
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

  function gradeClass(grade) {
    if (!grade) return '';
    var g = String(grade).toUpperCase().replace(/[+-]/g, '');
    if (g === 'A') return 'grade-A';
    if (g === 'B') return 'grade-B';
    if (g === 'C') return 'grade-C';
    if (g === 'D') return 'grade-D';
    return 'grade-F';
  }

  // ============ Load Data ============
  function loadCertificate(id) {
    if (!window.sb) return Promise.reject(new Error('Supabase not available'));
    return window.sb
      .from('certificates')
      .select('*')
      .eq('id', id)
      .maybeSingle()
      .then(function (res) {
        if (res.error) throw new Error(res.error.message);
        return res.data;
      });
  }

  function loadAcademies() {
    if (!window.sb) return Promise.resolve([]);
    return window.sb
      .from('academies')
      .select('id, name, license_number')
      .eq('status', 'approved')
      .eq('is_deleted', false)
      .order('name', { ascending: true })
      .then(function (res) { return res.data || []; })
      .catch(function () { return []; });
  }

  function loadBranches(academyId) {
    if (!academyId || !window.sb) return Promise.resolve([]);
    return window.sb
      .from('academy_branches')
      .select('id, governorate, is_main')
      .eq('academy_id', academyId)
      .order('is_main', { ascending: false })
      .order('governorate', { ascending: true })
      .then(function (res) { return res.data || []; })
      .catch(function () { return []; });
  }

  // ============ Populate ============
  function populateAcademySelect() {
    var select = $('academySelect');
    if (!select) return;
    var html = '<option value="">اختر الأكاديمية</option>';
    state.academies.forEach(function (a) {
      html += '<option value="' + escapeHtml(a.id) + '">' + escapeHtml(a.name) + '</option>';
    });
    select.innerHTML = html;
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

  function populateForm(cert) {
    // Code (read-only)
    setText('codeDisplay', cert.certificate_code || '—');
    setText('headerCode', cert.certificate_code || '—');
    setText('miniCode', cert.certificate_code || '—');

    // Issuer type
    var isUnion = cert.issuer_type === 'union' || !cert.academy_id;
    setIssuerType(isUnion ? 'union' : 'academy', cert);

    // Student
    $('studentName').value = cert.student_name || '';
    $('studentNationalId').value = cert.student_national_id || '';

    // Course
    $('courseName').value = cert.course_name || '';
    $('courseHours').value = cert.course_hours || '';
    $('grade').value = cert.grade || '';
    $('completionDate').value = cert.completion_date ? cert.completion_date.split('T')[0] : '';

    // Status
    $('activeStatus').value = cert.is_active === false ? 'false' : 'true';

    // View link
    var viewBtn = $('viewBtn');
    if (viewBtn) {
      viewBtn.href = resolve('admin/certificate-view.html?id=' + encodeURIComponent(cert.id));
    }

    updatePreview();
  }

  // ============ Issuer Switch ============
  function setIssuerType(type, cert) {
    state.issuerType = type;

    document.querySelectorAll('.issuer-radio-card').forEach(function (card) {
      var t = card.getAttribute('data-issuer');
      card.classList.toggle('active', t === type);
    });

    var selector = $('academySelector');
    var academySelect = $('academySelect');

    if (type === 'academy') {
      if (selector) selector.classList.add('show');
      if (academySelect) academySelect.disabled = false;

      // Preselect academy if exists
      if (cert && cert.academy_id && academySelect) {
        academySelect.value = cert.academy_id;
        loadBranches(cert.academy_id).then(function (branches) {
          populateBranchSelect(branches);
          if (cert.branch_id) {
            var bSel = $('branchSelect');
            if (bSel) bSel.value = cert.branch_id;
          }
          updatePreview();
        });
      }
    } else {
      if (selector) selector.classList.remove('show');
      if (academySelect) { academySelect.disabled = true; academySelect.value = ''; }
      resetBranchSelect();
    }

    updatePreview();
  }

  // ============ Live Preview ============
  function updatePreview() {
    // Issuer
    var issuerEl = $('miniIssuer');
    if (issuerEl) {
      if (state.issuerType === 'union') {
        issuerEl.textContent = 'النقابة';
      } else {
        var aSel = $('academySelect');
        var text = 'أكاديمية';
        if (aSel && aSel.value) {
          var opt = aSel.options[aSel.selectedIndex];
          if (opt) text = opt.text;
        }
        issuerEl.textContent = text;
      }
    }

    // Student
    var sName = $('studentName').value.trim();
    var sEl = $('miniStudent');
    if (sEl) {
      sEl.textContent = sName || '—';
      sEl.classList.toggle('empty', !sName);
    }

    // National ID (masked)
    var nId = $('studentNationalId').value.trim();
    var nEl = $('miniNationalId');
    if (nEl) {
      if (nId.length >= 4) {
        nEl.textContent = '••••' + nId.slice(-4);
        nEl.classList.remove('empty');
      } else {
        nEl.textContent = '—';
        nEl.classList.add('empty');
      }
    }

    // Course
    var cName = $('courseName').value.trim();
    var cEl = $('miniCourse');
    if (cEl) {
      cEl.textContent = cName || '—';
      cEl.classList.toggle('empty', !cName);
    }

    // Hours
    var hours = $('courseHours').value.trim();
    var hEl = $('miniHours');
    if (hEl) {
      hEl.textContent = hours ? hours + ' ساعة' : '—';
      hEl.classList.toggle('empty', !hours);
    }

    // Grade
    var grade = $('grade').value;
    var gEl = $('miniGrade');
    if (gEl) {
      gEl.textContent = grade || '—';
      gEl.className = 'cert-mini-value' + (grade ? ' ' + gradeClass(grade) : ' empty');
    }

    // Academy (only if academy)
    var aEl = $('miniAcademy');
    if (aEl) {
      if (state.issuerType === 'academy') {
        var acSel = $('academySelect');
        if (acSel && acSel.value) {
          var opt2 = acSel.options[acSel.selectedIndex];
          aEl.textContent = opt2 ? opt2.text : '—';
          aEl.classList.remove('empty');
        } else {
          aEl.textContent = '—';
          aEl.classList.add('empty');
        }
      } else {
        aEl.textContent = 'النقابة';
        aEl.classList.remove('empty');
      }
    }
  }

  // ============ Validation ============
  function clearErrors() {
    ['studentNameError', 'studentNationalIdError', 'courseNameError', 'courseHoursError', 'gradeError', 'academySelectError'].forEach(function (id) {
      var el = $(id);
      if (el) { el.classList.remove('show'); el.textContent = ''; }
    });
    document.querySelectorAll('.form-field input.error').forEach(function (el) {
      el.classList.remove('error');
    });
  }

  function setError(fieldId, errorId, msg) {
    var field = $(fieldId);
    var error = $(errorId);
    if (field) field.classList.add('error');
    if (error) { error.textContent = msg; error.classList.add('show'); }
  }

  function validate() {
    clearErrors();
    var valid = true;

    if (state.issuerType === 'academy') {
      var aSel = $('academySelect');
      if (!aSel.value) {
        setError('academySelect', 'academySelectError', 'اختر الأكاديمية');
        valid = false;
      }
    }

    var sName = $('studentName').value.trim();
    if (!sName || sName.length < 3) {
      setError('studentName', 'studentNameError', 'الاسم 3 أحرف على الأقل');
      valid = false;
    }

    var nId = $('studentNationalId').value.trim();
    if (!/^\d{14}$/.test(nId)) {
      setError('studentNationalId', 'studentNationalIdError', 'الرقم القومي 14 رقم');
      valid = false;
    }

    var cName = $('courseName').value.trim();
    if (!cName) {
      setError('courseName', 'courseNameError', 'اسم الدورة مطلوب');
      valid = false;
    }

    var hours = parseInt($('courseHours').value, 10);
    if (!hours || hours < 1 || hours > 500) {
      setError('courseHours', 'courseHoursError', 'بين 1 و 500');
      valid = false;
    }

    if (!$('grade').value) {
      setError('grade', 'gradeError', 'اختر التقدير');
      valid = false;
    }

    return valid;
  }

  // ============ Submit ============
  function handleSubmit(e) {
    if (e) e.preventDefault();
    if (state.submitting) return;
    if (!validate()) { toast('يرجى مراجعة البيانات', 'error'); return; }
    if (!hasPermission('certificate.edit')) { toast('غير مصرح لك بالتعديل', 'error'); return; }
    if (!window.sb) { toast('تعذر الاتصال بالخادم', 'error'); return; }

    state.submitting = true;
    showOverlay(true);
    disableSaveBtn(true);

    var isUnion = state.issuerType === 'union';
    var academyId = isUnion ? null : ($('academySelect').value || null);
    var branchId = isUnion ? null : ($('branchSelect').value || null);

    // Snapshot academy info if applicable
    var academyName = null;
    var academyLicense = null;
    var branchName = null;

    if (!isUnion && academyId) {
      var academy = state.academies.find(function (a) { return a.id === academyId; });
      if (academy) {
        academyName = academy.name;
        academyLicense = academy.license_number;
      }
      if (branchId) {
        var bSel = $('branchSelect');
        var opt = bSel.options[bSel.selectedIndex];
        if (opt) branchName = opt.text.replace(' (رئيسي)', '');
      }
    }

    var completionDateVal = $('completionDate').value;

    var updateData = {
      student_name: $('studentName').value.trim(),
      student_national_id: $('studentNationalId').value.trim(),
      course_name: $('courseName').value.trim(),
      course_hours: parseInt($('courseHours').value, 10),
      grade: $('grade').value,
      completion_date: completionDateVal ? completionDateVal + 'T00:00:00Z' : null,
      issuer_type: isUnion ? 'union' : 'academy',
      academy_id: academyId,
      branch_id: branchId,
      academy_name: academyName,
      academy_license_number: academyLicense,
      branch_name: branchName,
      is_active: $('activeStatus').value === 'true',
      updated_at: new Date().toISOString()
    };

    logDebug('Updating certificate:', state.certificateId, updateData);

    window.sb.from('certificates').update(updateData).eq('id', state.certificateId)
      .then(function (res) {
        if (res.error) throw new Error(res.error.message);

        toast('تم حفظ التغييرات بنجاح', 'success');
        logActivity('update_certificate', 'تعديل شهادة: ' + state.certificate.certificate_code, {
          certificate_id: state.certificateId,
          student_name: updateData.student_name
        });

        // Reload data
        return loadCertificate(state.certificateId).then(function (cert) {
          state.certificate = cert;
          populateForm(cert);
          showOverlay(false);
          disableSaveBtn(false);
          state.submitting = false;
        });
      })
      .catch(function (err) {
        logDebug('Update error:', err.message);
        toast('حدث خطأ: ' + err.message, 'error');
        showOverlay(false);
        disableSaveBtn(false);
        state.submitting = false;
      });
  }

  function showOverlay(show) {
    var overlay = $('submitOverlay');
    if (!overlay) return;
    if (show) overlay.classList.add('show');
    else overlay.classList.remove('show');
  }

  function disableSaveBtn(disable) {
    var btn = $('saveBtn');
    if (!btn) return;
    btn.disabled = disable;
    if (disable) {
      btn.innerHTML = '<span>جاري الحفظ...</span>';
    } else {
      btn.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="width:16px;height:16px;"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"></path><polyline points="17 21 17 13 7 13 7 21"></polyline><polyline points="7 3 7 8 15 8"></polyline></svg><span>حفظ التغييرات</span>';
    }
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

  // ============ Bind Events ============
  function bindEvents() {
    // Issuer radio cards
    document.querySelectorAll('.issuer-radio-card').forEach(function (card) {
      card.addEventListener('click', function () {
        var type = card.getAttribute('data-issuer');
        if (type) setIssuerType(type, null);
      });
    });

    // Academy change
    var acSel = $('academySelect');
    if (acSel) {
      acSel.addEventListener('change', function () {
        var id = acSel.value;
        if (!id) { resetBranchSelect(); updatePreview(); return; }
        resetBranchSelect();
        loadBranches(id).then(function (branches) {
          populateBranchSelect(branches);
          updatePreview();
        });
      });
    }

    // Branch change
    var bSel = $('branchSelect');
    if (bSel) bSel.addEventListener('change', updatePreview);

    // National ID filter
    var nId = $('studentNationalId');
    if (nId) {
      nId.addEventListener('input', function () {
        this.value = this.value.replace(/[^0-9]/g, '').substring(0, 14);
        updatePreview();
      });
    }

    // Live preview inputs
    ['studentName', 'courseName', 'courseHours', 'grade', 'completionDate'].forEach(function (id) {
      var el = $(id);
      if (el) {
        el.addEventListener('input', updatePreview);
        el.addEventListener('change', updatePreview);
      }
    });

    // Submit
    var form = $('editForm');
    if (form) form.addEventListener('submit', handleSubmit);
  }

  // ============ Show Error ============
  function showError(title, text) {
    var loader = $('formLoader');
    var errorPage = $('formErrorPage');
    var main = $('mainContent');
    if (loader) loader.classList.remove('show');
    if (main) main.style.display = 'none';
    if (errorPage) {
      errorPage.classList.add('show');
      setText('errTitle', title);
      setText('errText', text);
    }
  }

  // ============ Init ============
  function init() {
    if (state.initialized) return;
    state.initialized = true;

    state.certificateId = readId();
    if (!state.certificateId) {
      showError('لم يتم تحديد الشهادة', 'تأكد من الرابط أو ارجع لصفحة الشهادات.');
      return;
    }

    if (!hasPermission('certificate.edit')) {
      toast('غير مصرح لك بتعديل الشهادات', 'error');
      setTimeout(function () {
        window.location.href = resolve('admin/certificates.html');
      }, 1500);
      return;
    }

    if (window.AuthGuard && window.AuthGuard.getUser) {
      state.currentUser = window.AuthGuard.getUser();
    }

    var loader = $('formLoader');
    if (loader) loader.classList.add('show');

    Promise.all([loadCertificate(state.certificateId), loadAcademies()])
      .then(function (results) {
        var cert = results[0];
        state.academies = results[1] || [];

        if (!cert) {
          showError('الشهادة غير موجودة', 'لم يتم العثور على شهادة بهذا المعرف.');
          return;
        }

        state.certificate = cert;

        if (loader) loader.classList.remove('show');
        $('mainContent').style.display = 'grid';

        populateAcademySelect();
        populateForm(cert);
        bindEvents();

        logDebug('Certificate edit loaded:', cert.id);
      })
      .catch(function (err) {
        showError('حدث خطأ', err.message || 'تعذر تحميل البيانات');
        logDebug('Init error:', err.message);
      });
  }

  // ============ Public API ============
  window.AdminCertificateEdit = {
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
