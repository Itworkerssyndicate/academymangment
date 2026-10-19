// ============================================
// ITWS Platform - Admin Settings Logic
// Path: assets/js/pages/admin/settings.js
// ============================================
// منطق صفحة إعدادات النقيب العامة
// يدير 6 أقسام: عام / الأمان / السلوك / الاعتماد / الشهادات / الميزات
// + رفع اللوجو والختم + قراءة مباشرة من Supabase
// بدون إيموجي
// ============================================

(function () {
  'use strict';

  if (window.AdminSettings && window.AdminSettings.initialized) return;

  // ============ الـ Groups المتاحة ============
  var SETTINGS_GROUPS = [
    'app_identity',
    'behavior',
    'security',
    'accreditation',
    'certificates',
    'uploads',
    'footer',
    'features',
    'theme'
  ];

  var state = {
    settings: {},           // { key: value }
    originalSettings: {},   // للحماية من الحفظ بدون تعديل
    currentUser: null,
    uploadingLogo: false,
    uploadingStamp: false,
    loading: false,
    initialized: false,
    dirtyGroups: {}         // { groupName: true } لو فيه تعديلات
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
      console.log.apply(console, ['[AdminSettings]'].concat(Array.prototype.slice.call(arguments)));
    }
  }

  function hasPermission(perm) {
    if (window.Permissions && window.Permissions.can) {
      return window.Permissions.can(perm);
    }
    if (window.AuthGuard && window.AuthGuard.getUser) {
      var u = window.AuthGuard.getUser();
      if (!u) return false;
      return u.role === 'super_admin';
    }
    return false;
  }

  // ============================================
  // 2. Load Settings from Supabase
  // ============================================
  function loadSettings() {
    if (!window.sb) return Promise.reject(new Error('Supabase not available'));

    return window.sb
      .from('settings')
      .select('key, value')
      .in('key', SETTINGS_GROUPS)
      .then(function (res) {
        if (res.error) throw new Error(res.error.message);

        var map = {};
        (res.data || []).forEach(function (row) {
          map[row.key] = row.value || {};
        });

        state.settings = map;
        state.originalSettings = JSON.parse(JSON.stringify(map));
        return map;
      });
  }

  // ============================================
  // 3. Render All Tabs (populate values)
  // ============================================
  function renderAllTabs() {
    renderIdentityTab();
    renderBehaviorTab();
    renderSecurityTab();
    renderAccreditationTab();
    renderCertificatesTab();
    renderFooterTab();
    renderFeaturesTab();
  }

  // ============================================
  // 4. Helpers for form fields
  // ============================================
  function setFieldValue(id, value) {
    var el = $(id);
    if (!el) return;
    if (el.type === 'checkbox') {
      el.checked = !!value;
    } else {
      el.value = value == null ? '' : value;
    }
  }

  function getFieldValue(id) {
    var el = $(id);
    if (!el) return null;
    if (el.type === 'checkbox') return el.checked;
    if (el.type === 'number') {
      var n = parseFloat(el.value);
      return isNaN(n) ? null : n;
    }
    return el.value;
  }

  // ============================================
  // 5. Render: App Identity Tab
  // ============================================
  function renderIdentityTab() {
    var s = state.settings.app_identity || {};

    setFieldValue('set-union-name', s.union_name);
    setFieldValue('set-union-name-en', s.union_name_en);
    setFieldValue('set-committee-name', s.committee_name);
    setFieldValue('set-committee-head-name', s.committee_head_name);
    setFieldValue('set-president-name', s.president_name);
    setFieldValue('set-president-label', s.president_label);
    setFieldValue('set-contact-email', s.contact_email);
    setFieldValue('set-contact-phone', s.contact_phone);
    setFieldValue('set-website-url', s.website_url);
    setFieldValue('set-footer-text', s.footer_text);

    // Logo preview
    updateImagePreview('logo-preview', s.logo_url);
    updateImagePreview('stamp-preview', s.stamp_url);
  }

  function updateImagePreview(previewId, url) {
    var el = $(previewId);
    if (!el) return;
    if (url) {
      el.innerHTML = '<img src="' + escapeHtml(url) + '" alt="" style="max-width:100%;max-height:100%;object-fit:contain;">';
      el.classList.add('has-image');
    } else {
      el.innerHTML = '<span style="color:var(--text-muted);font-size:11px;">لم يتم الرفع</span>';
      el.classList.remove('has-image');
    }
  }

  // ============================================
  // 6. Render: Behavior Tab
  // ============================================
  function renderBehaviorTab() {
    var s = state.settings.behavior || {};

    setFieldValue('set-font-family', s.font_family || 'Cairo');
    setFieldValue('set-session-timeout', s.session_timeout_minutes || 30);
    setFieldValue('set-heartbeat-interval', s.heartbeat_interval_ms || 60000);
    setFieldValue('set-online-threshold', s.online_threshold_ms || 120000);
    setFieldValue('set-pagination-admin', s.pagination_admin_size || 20);
    setFieldValue('set-pagination-public', s.pagination_public_size || 12);
    setFieldValue('set-home-recent-count', s.home_stats_academies_count || 6);

    setFieldValue('set-enable-registration', s.enable_registration === true);
    setFieldValue('set-enable-theme-picker', s.enable_theme_picker_for_visitors !== false);
    setFieldValue('set-enable-search', s.enable_search !== false);
    setFieldValue('set-enable-cv-builder', s.enable_cv_builder !== false);
    setFieldValue('set-home-show-stats', s.home_show_stats !== false);
    setFieldValue('set-home-show-about', s.home_show_about_section !== false);
    setFieldValue('set-home-show-custom', s.home_show_custom_section !== false);
    setFieldValue('set-home-show-academies', s.home_show_recent_academies !== false);

    setFieldValue('set-redirect-guest', s.redirect_guest_to || 'home.html');
    setFieldValue('set-redirect-admin', s.redirect_admin_to || 'admin/index.html');
    setFieldValue('set-redirect-user', s.redirect_user_to || 'home.html');
  }

  // ============================================
  // 7. Render: Security Tab
  // ============================================
  function renderSecurityTab() {
    var s = state.settings.security || {};

    setFieldValue('set-max-login-attempts', s.max_login_attempts || 5);
    setFieldValue('set-lockout-minutes', s.lockout_minutes || 15);
    setFieldValue('set-session-timeout-sec', s.session_timeout_minutes || 30);

    setFieldValue('set-require-email-verification', s.require_email_verification === true);
    setFieldValue('set-allow-password-reset', s.allow_password_reset !== false);
  }

  // ============================================
  // 8. Render: Accreditation Tab
  // ============================================
  function renderAccreditationTab() {
    var s = state.settings.accreditation || {};
    var stages = s.stages || {};
    var slaDays = s.sla_days || {};

    // Stages (مسميات المراحل)
    setFieldValue('set-stage-submitted', stages.submitted || 'تم التقديم');
    setFieldValue('set-stage-documents-review', stages.documents_review || 'مراجعة المستندات');
    setFieldValue('set-stage-site-visit', stages.site_visit || 'زيارة الموقع');
    setFieldValue('set-stage-committee-review', stages.committee_review || 'لجنة المراجعة');
    setFieldValue('set-stage-final-approval', stages.final_approval || 'الموافقة النهائية');
    setFieldValue('set-stage-approved', stages.approved || 'معتمدة');
    setFieldValue('set-stage-rejected', stages.rejected || 'مرفوضة');

    // SLA
    setFieldValue('set-sla-submitted', slaDays.submitted || 3);
    setFieldValue('set-sla-documents-review', slaDays.documents_review || 3);
    setFieldValue('set-sla-site-visit', slaDays.site_visit || 14);
    setFieldValue('set-sla-committee-review', slaDays.committee_review || 7);
    setFieldValue('set-sla-final-approval', slaDays.final_approval || 5);

    // Requirements
    setFieldValue('set-min-branches', s.min_branches || 1);
    setFieldValue('set-min-courses', s.min_courses || 1);
    setFieldValue('set-require-payment', s.require_payment_receipt === true);
    setFieldValue('set-require-place-photo', s.require_place_photo !== false);
    setFieldValue('set-require-tax-card', s.require_tax_card !== false);
    setFieldValue('set-require-commercial-registry', s.require_commercial_registry !== false);
  }

  // ============================================
  // 9. Render: Certificates Tab
  // ============================================
  function renderCertificatesTab() {
    var s = state.settings.certificates || {};

    setFieldValue('set-cert-code-prefix', s.code_prefix || 'NTI');
    setFieldValue('set-cert-random-length', s.random_length || 6);
    setFieldValue('set-cert-grades', (s.grades || ['A+', 'A', 'B+', 'B', 'C+', 'C', 'D', 'F']).join(','));

    setFieldValue('set-show-qr', s.show_qr !== false);
    setFieldValue('set-show-stamp', s.show_stamp !== false);
    setFieldValue('set-show-committee-head-signature', s.show_committee_head_signature !== false);
    setFieldValue('set-show-president-signature', s.show_president_signature !== false);
  }

  // ============================================
  // 10. Render: Footer Tab
  // ============================================
  function renderFooterTab() {
    var s = state.settings.footer || {};

    setFieldValue('set-footer-show-social', s.show_social_links !== false);
    setFieldValue('set-footer-show-president', s.show_president !== false);
    setFieldValue('set-footer-show-copyright', s.show_copyright !== false);
    setFieldValue('set-footer-copyright-text', s.copyright_text);

    setFieldValue('set-social-facebook', s.social_facebook);
    setFieldValue('set-social-twitter', s.social_twitter);
    setFieldValue('set-social-linkedin', s.social_linkedin);
    setFieldValue('set-social-youtube', s.social_youtube);
  }

  // ============================================
  // 11. Render: Features Tab
  // ============================================
  function renderFeaturesTab() {
    var s = state.settings.features || {};

    setFieldValue('set-enable-ai-cv', s.enable_ai_cv !== false);
    setFieldValue('set-enable-ocr', s.enable_ocr !== false);
    setFieldValue('set-enable-qr-code', s.enable_qr_code !== false);
    setFieldValue('set-enable-pdf-export', s.enable_pdf_export !== false);
    setFieldValue('set-enable-excel-export', s.enable_excel_export !== false);
    setFieldValue('set-enable-whatsapp-share', s.enable_whatsapp_share !== false);
    setFieldValue('set-enable-email-notifications', s.enable_email_notifications === true);
  }

  // ============================================
  // 12. Collect: App Identity
  // ============================================
  function collectIdentity() {
    var current = state.settings.app_identity || {};
    return {
      union_name: getFieldValue('set-union-name') || current.union_name,
      union_name_en: getFieldValue('set-union-name-en') || current.union_name_en,
      committee_name: getFieldValue('set-committee-name') || current.committee_name,
      committee_head_name: getFieldValue('set-committee-head-name'),
      president_name: getFieldValue('set-president-name'),
      president_label: getFieldValue('set-president-label'),
      contact_email: getFieldValue('set-contact-email'),
      contact_phone: getFieldValue('set-contact-phone'),
      website_url: getFieldValue('set-website-url'),
      footer_text: getFieldValue('set-footer-text'),
      logo_url: current.logo_url,
      stamp_url: current.stamp_url,
      // الحقول الإضافية اللي مش في الفورم — نحافظ عليها
      hero_title: current.hero_title,
      hero_subtitle: current.hero_subtitle,
      footer_link: current.footer_link,
      about_section: current.about_section,
      custom_section: current.custom_section
    };
  }

  // ============================================
  // 13. Collect: Behavior
  // ============================================
  function collectBehavior() {
    var current = state.settings.behavior || {};
    return Object.assign({}, current, {
      font_family: getFieldValue('set-font-family') || 'Cairo',
      session_timeout_minutes: getFieldValue('set-session-timeout') || 30,
      heartbeat_interval_ms: getFieldValue('set-heartbeat-interval') || 60000,
      online_threshold_ms: getFieldValue('set-online-threshold') || 120000,
      pagination_admin_size: getFieldValue('set-pagination-admin') || 20,
      pagination_public_size: getFieldValue('set-pagination-public') || 12,
      home_stats_academies_count: getFieldValue('set-home-recent-count') || 6,

      enable_registration: getFieldValue('set-enable-registration'),
      enable_theme_picker_for_visitors: getFieldValue('set-enable-theme-picker'),
      enable_search: getFieldValue('set-enable-search'),
      enable_cv_builder: getFieldValue('set-enable-cv-builder'),
      home_show_stats: getFieldValue('set-home-show-stats'),
      home_show_about_section: getFieldValue('set-home-show-about'),
      home_show_custom_section: getFieldValue('set-home-show-custom'),
      home_show_recent_academies: getFieldValue('set-home-show-academies'),

      redirect_guest_to: getFieldValue('set-redirect-guest') || 'home.html',
      redirect_admin_to: getFieldValue('set-redirect-admin') || 'admin/index.html',
      redirect_user_to: getFieldValue('set-redirect-user') || 'home.html'
    });
  }

  // ============================================
  // 14. Collect: Security
  // ============================================
  function collectSecurity() {
    var current = state.settings.security || {};
    return Object.assign({}, current, {
      max_login_attempts: getFieldValue('set-max-login-attempts') || 5,
      lockout_minutes: getFieldValue('set-lockout-minutes') || 15,
      session_timeout_minutes: getFieldValue('set-session-timeout-sec') || 30,
      require_email_verification: getFieldValue('set-require-email-verification'),
      allow_password_reset: getFieldValue('set-allow-password-reset')
    });
  }

  // ============================================
  // 15. Collect: Accreditation
  // ============================================
  function collectAccreditation() {
    var current = state.settings.accreditation || {};
    return Object.assign({}, current, {
      stages: {
        submitted: getFieldValue('set-stage-submitted') || 'تم التقديم',
        documents_review: getFieldValue('set-stage-documents-review') || 'مراجعة المستندات',
        site_visit: getFieldValue('set-stage-site-visit') || 'زيارة الموقع',
        committee_review: getFieldValue('set-stage-committee-review') || 'لجنة المراجعة',
        final_approval: getFieldValue('set-stage-final-approval') || 'الموافقة النهائية',
        approved: getFieldValue('set-stage-approved') || 'معتمدة',
        rejected: getFieldValue('set-stage-rejected') || 'مرفوضة'
      },
      sla_days: {
        submitted: getFieldValue('set-sla-submitted') || 3,
        documents_review: getFieldValue('set-sla-documents-review') || 3,
        site_visit: getFieldValue('set-sla-site-visit') || 14,
        committee_review: getFieldValue('set-sla-committee-review') || 7,
        final_approval: getFieldValue('set-sla-final-approval') || 5
      },
      min_branches: getFieldValue('set-min-branches') || 1,
      min_courses: getFieldValue('set-min-courses') || 1,
      require_payment_receipt: getFieldValue('set-require-payment'),
      require_place_photo: getFieldValue('set-require-place-photo'),
      require_tax_card: getFieldValue('set-require-tax-card'),
      require_commercial_registry: getFieldValue('set-require-commercial-registry')
    });
  }

  // ============================================
  // 16. Collect: Certificates
  // ============================================
  function collectCertificates() {
    var current = state.settings.certificates || {};
    var gradesRaw = getFieldValue('set-cert-grades') || 'A+,A,B+,B,C+,C,D,F';
    var grades = gradesRaw.split(',').map(function (g) { return g.trim(); }).filter(Boolean);

    return Object.assign({}, current, {
      code_prefix: getFieldValue('set-cert-code-prefix') || 'NTI',
      random_length: getFieldValue('set-cert-random-length') || 6,
      grades: grades.length ? grades : ['A+', 'A', 'B+', 'B', 'C+', 'C', 'D', 'F'],
      show_qr: getFieldValue('set-show-qr'),
      show_stamp: getFieldValue('set-show-stamp'),
      show_committee_head_signature: getFieldValue('set-show-committee-head-signature'),
      show_president_signature: getFieldValue('set-show-president-signature')
    });
  }

  // ============================================
  // 17. Collect: Footer
  // ============================================
  function collectFooter() {
    var current = state.settings.footer || {};
    return Object.assign({}, current, {
      show_social_links: getFieldValue('set-footer-show-social'),
      show_president: getFieldValue('set-footer-show-president'),
      show_copyright: getFieldValue('set-footer-show-copyright'),
      copyright_text: getFieldValue('set-footer-copyright-text'),
      social_facebook: getFieldValue('set-social-facebook'),
      social_twitter: getFieldValue('set-social-twitter'),
      social_linkedin: getFieldValue('set-social-linkedin'),
      social_youtube: getFieldValue('set-social-youtube')
    });
  }

  // ============================================
  // 18. Collect: Features
  // ============================================
  function collectFeatures() {
    var current = state.settings.features || {};
    return Object.assign({}, current, {
      enable_ai_cv: getFieldValue('set-enable-ai-cv'),
      enable_ocr: getFieldValue('set-enable-ocr'),
      enable_qr_code: getFieldValue('set-enable-qr-code'),
      enable_pdf_export: getFieldValue('set-enable-pdf-export'),
      enable_excel_export: getFieldValue('set-enable-excel-export'),
      enable_whatsapp_share: getFieldValue('set-enable-whatsapp-share'),
      enable_email_notifications: getFieldValue('set-enable-email-notifications')
    });
  }

  // ============================================
  // 19. Save a settings group
  // ============================================
  function saveGroup(groupName, data, buttonEl) {
    if (!hasPermission('settings.edit')) {
      toast('غير مصرح لك بتعديل الإعدادات', 'error');
      return Promise.reject(new Error('forbidden'));
    }

    if (!window.sb) {
      toast('تعذر الاتصال بالخادم', 'error');
      return Promise.reject(new Error('no_sb'));
    }

    if (buttonEl) {
      buttonEl.disabled = true;
      buttonEl.dataset._origHtml = buttonEl.innerHTML;
      buttonEl.innerHTML = '<span>جاري الحفظ...</span>';
    }

    return window.sb
      .from('settings')
      .upsert({ key: groupName, value: data }, { onConflict: 'key' })
      .then(function (res) {
        if (res.error) throw new Error(res.error.message);

        // تحديث الحالة المحلية
        state.settings[groupName] = data;
        state.originalSettings[groupName] = JSON.parse(JSON.stringify(data));
        delete state.dirtyGroups[groupName];

        toast('تم حفظ "' + groupName + '" بنجاح', 'success');
        logDebug('Saved group:', groupName);

        // Log activity
        logActivity('update_settings', 'تحديث إعدادات: ' + groupName, { group: groupName });

        return data;
      })
      .catch(function (err) {
        toast('فشل الحفظ: ' + err.message, 'error');
        throw err;
      })
      .finally(function () {
        if (buttonEl) {
          buttonEl.disabled = false;
          if (buttonEl.dataset._origHtml) {
            buttonEl.innerHTML = buttonEl.dataset._origHtml;
            delete buttonEl.dataset._origHtml;
          }
        }
      });
  }

  // ============================================
  // 20. File Upload (Logo / Stamp)
  // ============================================
  function uploadImage(file, imageType) {
    if (!file) return;
    if (!window.sb) { toast('تعذر الاتصال بالخادم', 'error'); return; }

    // فحص الملف
    var maxSize = 2 * 1024 * 1024; // 2MB
    if (file.size > maxSize) {
      toast('حجم الصورة يجب أن يكون أقل من 2MB', 'error');
      return;
    }

    var allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/svg+xml', 'image/webp'];
    if (allowedTypes.indexOf(file.type) === -1) {
      toast('نوع الملف غير مسموح (JPG/PNG/SVG/WebP فقط)', 'error');
      return;
    }

    var previewId = imageType === 'logo' ? 'logo-preview' : 'stamp-preview';
    var uploadBtnId = imageType === 'logo' ? 'upload-logo-btn' : 'upload-stamp-btn';

    if (imageType === 'logo') state.uploadingLogo = true;
    else state.uploadingStamp = true;

    var uploadBtn = $(uploadBtnId);
    if (uploadBtn) {
      uploadBtn.disabled = true;
      uploadBtn.textContent = 'جاري الرفع...';
    }

    var ext = file.name.split('.').pop();
    var fileName = imageType + '_' + Date.now() + '.' + ext;
    var path = 'itws/' + fileName;

    window.sb.storage
      .from('public-assets')
      .upload(path, file, { cacheControl: '3600', upsert: true, contentType: file.type })
      .then(function (res) {
        if (res.error) throw new Error(res.error.message);

        var urlRes = window.sb.storage.from('public-assets').getPublicUrl(path);
        var publicUrl = urlRes.data ? urlRes.data.publicUrl : path;

        // حدّث الـ settings
        var current = state.settings.app_identity || {};
        var updated = Object.assign({}, current);
        if (imageType === 'logo') updated.logo_url = publicUrl;
        else updated.stamp_url = publicUrl;

        return saveGroup('app_identity', updated);
      })
      .then(function () {
        toast('تم رفع الصورة بنجاح', 'success');

        // تحديث Preview
        var s = state.settings.app_identity || {};
        updateImagePreview(previewId, imageType === 'logo' ? s.logo_url : s.stamp_url);

        logActivity('update_' + imageType, 'رفع ' + (imageType === 'logo' ? 'لوجو' : 'ختم') + ' جديد', {});
      })
      .catch(function (err) {
        toast('فشل الرفع: ' + err.message, 'error');
        logDebug('Upload error:', err.message);
      })
      .finally(function () {
        if (imageType === 'logo') state.uploadingLogo = false;
        else state.uploadingStamp = false;
        if (uploadBtn) {
          uploadBtn.disabled = false;
          uploadBtn.textContent = imageType === 'logo' ? 'رفع لوجو' : 'رفع ختم';
        }
      });
  }

  // ============================================
  // 21. Log Activity
  // ============================================
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

  // ============================================
  // 22. Bind Events
  // ============================================
  function bindEvents() {
    // Save buttons (data-save="group")
    document.querySelectorAll('[data-save]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var group = btn.getAttribute('data-save');
        var data;

        if (group === 'app_identity') data = collectIdentity();
        else if (group === 'behavior') data = collectBehavior();
        else if (group === 'security') data = collectSecurity();
        else if (group === 'accreditation') data = collectAccreditation();
        else if (group === 'certificates') data = collectCertificates();
        else if (group === 'footer') data = collectFooter();
        else if (group === 'features') data = collectFeatures();

        if (data) saveGroup(group, data, btn);
      });
    });

    // File inputs
    var logoInput = $('logo-input');
    if (logoInput) {
      logoInput.addEventListener('change', function (e) {
        var file = e.target.files && e.target.files[0];
        if (file) uploadImage(file, 'logo');
      });
    }

    var stampInput = $('stamp-input');
    if (stampInput) {
      stampInput.addEventListener('change', function (e) {
        var file = e.target.files && e.target.files[0];
        if (file) uploadImage(file, 'stamp');
      });
    }

    // Upload buttons — trigger file input
    var uploadLogoBtn = $('upload-logo-btn');
    if (uploadLogoBtn && logoInput) {
      uploadLogoBtn.addEventListener('click', function () { logoInput.click(); });
    }

    var uploadStampBtn = $('upload-stamp-btn');
    if (uploadStampBtn && stampInput) {
      uploadStampBtn.addEventListener('click', function () { stampInput.click(); });
    }

    // Tabs
    document.querySelectorAll('[data-settings-tab]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var tab = btn.getAttribute('data-settings-tab');
        switchTab(tab);
      });
    });
  }

  // ============================================
  // 23. Tab Switching
  // ============================================
  function switchTab(tabName) {
    // Buttons
    document.querySelectorAll('[data-settings-tab]').forEach(function (b) {
      b.classList.toggle('active', b.getAttribute('data-settings-tab') === tabName);
    });

    // Panels
    document.querySelectorAll('[data-settings-panel]').forEach(function (p) {
      p.classList.toggle('active', p.getAttribute('data-settings-panel') === tabName);
    });

    // Update URL hash
    try {
      history.replaceState({}, '', '#' + tabName);
    } catch (e) {}
  }

  function readTabFromURL() {
    try {
      var hash = window.location.hash.replace('#', '');
      if (hash) {
        var exists = document.querySelector('[data-settings-tab="' + hash + '"]');
        if (exists) return hash;
      }
    } catch (e) {}
    return 'general';
  }

  // ============================================
  // 24. Init
  // ============================================
  function init() {
    if (state.initialized) return;
    state.initialized = true;

    // Permission check
    if (!hasPermission('settings.view')) {
      toast('غير مصرح لك بالوصول للإعدادات', 'error');
      setTimeout(function () {
        window.location.href = (window.resolveUrl ? window.resolveUrl('admin/index.html') : 'index.html');
      }, 1500);
      return;
    }

    if (window.AuthGuard && window.AuthGuard.getUser) {
      state.currentUser = window.AuthGuard.getUser();
    }

    // Load data
    var loader = $('settingsLoader');
    if (loader) loader.classList.add('show');

    waitForSupabase(function () {
      loadSettings()
        .then(function () {
          if (loader) loader.classList.remove('show');

          renderAllTabs();
          bindEvents();

          // Restore last tab from URL
          var initialTab = readTabFromURL();
          switchTab(initialTab);

          // Listener لتحديثات AppSettings (لو حصل تغيير خارجي)
          if (window.AppSettings && window.AppSettings.onChange) {
            window.AppSettings.onChange(function (cache, changedKey) {
              if (changedKey && SETTINGS_GROUPS.indexOf(changedKey) !== -1) {
                logDebug('External settings change:', changedKey);
                // ما نعملش reload لو فيه تعديلات غير محفوظة
                if (!state.dirtyGroups[changedKey]) {
                  loadSettings().then(function () {
                    renderAllTabs();
                  });
                }
              }
            });
          }

          logDebug('Settings page initialized');
        })
        .catch(function (err) {
          if (loader) loader.classList.remove('show');
          toast('حدث خطأ في تحميل الإعدادات', 'error');
          logDebug('Load error:', err.message);
        });
    });
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
  // 25. Public API
  // ============================================
  window.AdminSettings = {
    initialized: true,
    init: init,
    refresh: function () { return loadSettings().then(renderAllTabs); },
    switchTab: switchTab,
    saveGroup: saveGroup,
    getState: function () { return state; }
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

})();
