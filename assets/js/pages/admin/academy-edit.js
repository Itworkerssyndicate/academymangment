// ============================================
// ITWS Platform - Admin Academy Edit Logic
// Path: assets/js/pages/admin/academy-edit.js
// ============================================
// تعديل بيانات أكاديمية موجودة
// يحمّل البيانات من Supabase، يحدثها، ويدير اللوجو
// بدون إيموجي
// ============================================

(function () {
  'use strict';

  if (window.AdminAcademyEdit && window.AdminAcademyEdit.initialized) return;

  var state = {
    academyId: null,
    academy: null,
    categories: [],
    currentUser: null,
    submitting: false,
    currentLogoUrl: null,
    pendingLogoFile: null,
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

  function formatDate(date) {
    if (!date) return '—';
    try {
      var d = date instanceof Date ? date : new Date(date);
      if (isNaN(d.getTime())) return '—';
      return d.toLocaleDateString('ar-EG', { year: 'numeric', month: 'short', day: 'numeric' });
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
      console.log.apply(console, ['[AdminAcademyEdit]'].concat(Array.prototype.slice.call(arguments)));
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

  // ============ Load Data ============
  function loadCategories() {
    if (!window.sb) return Promise.resolve([]);
    return window.sb
      .from('academy_categories')
      .select('id, name')
      .eq('is_active', true)
      .order('sort_order', { ascending: true })
      .then(function (res) {
        if (res.error || !res.data) return [];
        return res.data;
      })
      .catch(function () { return []; });
  }

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

  // ============ Populate Form ============
  function populateCategoriesSelect() {
    var select = $('categoryId');
    if (!select) return;
    var html = '<option value="">بدون تصنيف</option>';
    state.categories.forEach(function (c) {
      html += '<option value="' + escapeHtml(c.id) + '">' + escapeHtml(c.name) + '</option>';
    });
    select.innerHTML = html;
  }

  function populateForm(academy) {
    $('academyName').value = academy.name || '';
    $('ownerName').value = academy.owner_name || '';
    $('foundedYear').value = academy.founded_year || '';
    $('categoryId').value = academy.category_id || '';
    $('description').value = academy.description || '';
    $('taxNumber').value = academy.tax_number || '';
    $('commercialRegistry').value = academy.commercial_registry || '';
    $('licenseNumber').value = academy.license_number || '';
    $('approvedAt').value = academy.approved_at ? formatDate(academy.approved_at) : '—';
    $('email').value = academy.email || '';
    $('phone').value = academy.phone || '';
    $('websiteUrl').value = academy.website_url || '';
    $('facebookUrl').value = academy.facebook_url || '';

    // Header
    setText('headerLic', academy.license_number || 'لم يتم الاعتماد بعد');

    // Logo
    state.currentLogoUrl = academy.logo_url || null;
    renderLogoPreview();

    // Status (super_admin only can change)
    if (hasPermission('academy.approve')) {
      $('statusField').style.display = 'block';
      $('statusSelect').value = academy.status || 'pending';
    } else {
      $('statusField').style.display = 'none';
    }

    // Update mini preview
    updateMiniPreview();
  }

  // ============ Logo Handling ============
  function renderLogoPreview() {
    var preview = $('logoPreview');
    var removeBtn = $('logoRemoveBtn');
    if (!preview) return;

    if (state.pendingLogoFile) {
      var reader = new FileReader();
      reader.onload = function (e) {
        preview.innerHTML = '<img src="' + e.target.result + '" alt="">';
      };
      reader.readAsDataURL(state.pendingLogoFile);
    } else if (state.currentLogoUrl) {
      preview.innerHTML = '<img src="' + escapeHtml(state.currentLogoUrl) + '" alt="">';
    } else {
      preview.innerHTML = '<span style="color:var(--text-muted);font-size:14px;">—</span>';
    }

    if (removeBtn) {
      removeBtn.style.display = (state.currentLogoUrl || state.pendingLogoFile) ? 'inline-block' : 'none';
    }
  }

  function handleLogoSelect(file) {
    if (!file) return;

    // Validate
    var allowed = ['image/png', 'image/jpeg', 'image/jpg', 'image/webp', 'image/svg+xml'];
    if (allowed.indexOf(file.type) === -1) {
      toast('نوع الملف غير مدعوم (PNG, JPG, SVG)', 'error');
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      toast('حجم اللوجو يتجاوز 2 ميجا', 'error');
      return;
    }

    state.pendingLogoFile = file;
    renderLogoPreview();
    updateMiniPreview();
  }

  function removeLogo() {
    state.pendingLogoFile = null;
    state.currentLogoUrl = null;
    renderLogoPreview();
    updateMiniPreview();
  }

  function uploadLogo(academyId) {
    if (!state.pendingLogoFile || !window.sb) return Promise.resolve(null);

    var file = state.pendingLogoFile;
    var ext = file.name.split('.').pop();
    var fileName = 'logo_' + Date.now() + '.' + ext;
    var path = 'academies/' + academyId + '/' + fileName;

    return window.sb.storage
      .from('public-assets')
      .upload(path, file, { cacheControl: '3600', upsert: true, contentType: file.type })
      .then(function (res) {
        if (res.error) throw new Error(res.error.message);
        var urlRes = window.sb.storage.from('public-assets').getPublicUrl(path);
        return urlRes.data ? urlRes.data.publicUrl : null;
      });
  }

  // ============ Mini Preview ============
  function updateMiniPreview() {
    var name = $('academyName') ? $('academyName').value.trim() : '';
    var catId = $('categoryId') ? $('categoryId').value : '';
    var cat = state.categories.find(function (c) { return c.id === catId; });

    setText('miniName', name || 'اسم الأكاديمية');
    setText('miniCategory', cat ? cat.name : 'بدون تصنيف');

    var initial = (name || '?').charAt(0);
    var logo = $('miniLogo');
    if (logo) {
      if (state.pendingLogoFile) {
        var reader = new FileReader();
        reader.onload = function (e) {
          logo.innerHTML = '<img src="' + e.target.result + '" alt="">';
        };
        reader.readAsDataURL(state.pendingLogoFile);
      } else if (state.currentLogoUrl) {
        logo.innerHTML = '<img src="' + escapeHtml(state.currentLogoUrl) + '" alt="">';
      } else {
        logo.textContent = initial;
      }
    }

    // Status badge
    var statusEl = $('miniStatus');
    if (statusEl && state.academy) {
      var st = (hasPermission('academy.approve') && $('statusSelect'))
        ? $('statusSelect').value
        : state.academy.status;
      var labels = { approved: 'معتمدة', pending: 'قيد الاعتماد', suspended: 'موقوفة', rejected: 'مرفوضة' };
      statusEl.textContent = labels[st] || st || '—';
      statusEl.className = 'acad-mini-status ' + (st || 'pending');
    }
  }

  // ============ Validation ============
  function clearErrors() {
    ['academyNameError', 'ownerNameError', 'emailError', 'phoneError'].forEach(function (id) {
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

    var name = $('academyName').value.trim();
    if (!name || name.length < 3) {
      setError('academyName', 'academyNameError', 'الاسم يجب أن يكون 3 أحرف على الأقل');
      valid = false;
    }

    var owner = $('ownerName').value.trim();
    if (!owner || owner.length < 3) {
      setError('ownerName', 'ownerNameError', 'اسم المالك مطلوب');
      valid = false;
    }

    var email = $('email').value.trim();
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setError('email', 'emailError', 'البريد الإلكتروني غير صحيح');
      valid = false;
    }

    var phone = $('phone').value.trim();
    if (phone && !/^01[0125][0-9]{8}$/.test(phone)) {
      setError('phone', 'phoneError', 'رقم الهاتف غير صحيح (11 رقم يبدأ بـ 01)');
      valid = false;
    }

    return valid;
  }

  // ============ Submit ============
  function handleSubmit(e) {
    if (e) e.preventDefault();
    if (state.submitting) return;
    if (!validate()) { toast('يرجى مراجعة البيانات', 'error'); return; }
    if (!hasPermission('academy.edit')) { toast('غير مصرح لك بالتعديل', 'error'); return; }
    if (!window.sb) { toast('تعذر الاتصال بالخادم', 'error'); return; }

    state.submitting = true;
    disableSaveBtn(true);

    var academyId = state.academyId;

    // 1. Upload logo first (if new)
    uploadLogo(academyId)
      .then(function (newLogoUrl) {
        // 2. Build update data
        var updateData = {
          name: $('academyName').value.trim(),
          owner_name: $('ownerName').value.trim(),
          founded_year: $('foundedYear').value ? parseInt($('foundedYear').value, 10) : null,
          category_id: $('categoryId').value || null,
          description: $('description').value.trim() || null,
          tax_number: $('taxNumber').value.trim() || null,
          commercial_registry: $('commercialRegistry').value.trim() || null,
          email: $('email').value.trim() || null,
          phone: $('phone').value.trim() || null,
          website_url: $('websiteUrl').value.trim() || null,
          facebook_url: $('facebookUrl').value.trim() || null,
          logo_url: newLogoUrl !== null ? newLogoUrl : (state.currentLogoUrl || null)
        };

        // Status change (super_admin only)
        if (hasPermission('academy.approve') && $('statusSelect').value !== state.academy.status) {
          updateData.status = $('statusSelect').value;
          if (updateData.status === 'approved' && !state.academy.approved_at) {
            updateData.approved_at = new Date().toISOString();
          }
        }

        logDebug('Updating academy:', updateData);
        return window.sb.from('academies').update(updateData).eq('id', academyId);
      })
      .then(function (res) {
        if (res && res.error) throw new Error(res.error.message);

        toast('تم حفظ التغييرات بنجاح', 'success');
        logDebug('Academy updated successfully');

        // Log activity
        logActivity('update_academy', 'تعديل أكاديمية: ' + $('academyName').value.trim(), {
          academy_id: academyId
        });

        // Reload academy data
        return loadAcademy(academyId).then(function (academy) {
          state.academy = academy;
          populateForm(academy);
          state.submitting = false;
          disableSaveBtn(false);
        });
      })
      .catch(function (err) {
        logDebug('Update error:', err.message);
        toast('حدث خطأ: ' + err.message, 'error');
        state.submitting = false;
        disableSaveBtn(false);
      });
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
    // Live preview updates
    ['academyName', 'categoryId', 'statusSelect'].forEach(function (id) {
      var el = $(id);
      if (el) el.addEventListener('input', updateMiniPreview);
      if (el) el.addEventListener('change', updateMiniPreview);
    });

    // Logo
    var logoBtn = $('logoUploadBtn');
    var logoInput = $('logoFileInput');
    if (logoBtn && logoInput) {
      logoBtn.addEventListener('click', function () { logoInput.click(); });
      logoInput.addEventListener('change', function (e) {
        var f = e.target.files && e.target.files[0];
        handleLogoSelect(f);
      });
    }

    var logoRemoveBtn = $('logoRemoveBtn');
    if (logoRemoveBtn) logoRemoveBtn.addEventListener('click', removeLogo);

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

    state.academyId = readId();
    if (!state.academyId) {
      showError('لم يتم تحديد الأكاديمية', 'تأكد من الرابط أو ارجع لصفحة الأكاديميات.');
      return;
    }

    if (!hasPermission('academy.edit')) {
      toast('غير مصرح لك بتعديل الأكاديميات', 'error');
      setTimeout(function () {
        window.location.href = resolve('admin/academies.html');
      }, 1500);
      return;
    }

    if (window.AuthGuard && window.AuthGuard.getUser) {
      state.currentUser = window.AuthGuard.getUser();
    }

    var loader = $('formLoader');
    if (loader) loader.classList.add('show');

    Promise.all([loadAcademy(state.academyId), loadCategories()])
      .then(function (results) {
        var academy = results[0];
        state.categories = results[1] || [];

        if (!academy) {
          showError('الأكاديمية غير موجودة', 'لم يتم العثور على أكاديمية بهذا المعرف.');
          return;
        }

        state.academy = academy;

        if (loader) loader.classList.remove('show');
        $('mainContent').style.display = 'grid';

        populateCategoriesSelect();
        populateForm(academy);
        bindEvents();

        logDebug('Academy edit loaded:', academy.id);
      })
      .catch(function (err) {
        showError('حدث خطأ', err.message || 'تعذر تحميل البيانات');
        logDebug('Init error:', err.message);
      });
  }

  // ============ Public API ============
  window.AdminAcademyEdit = {
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
