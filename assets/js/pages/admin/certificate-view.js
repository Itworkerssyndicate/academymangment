// ============================================
// [41/50] ITWS Platform - Certificate View Logic
// Path: assets/js/pages/admin/certificate-view.js
// ============================================
// عرض الشهادة - تفاصيل كاملة + QR + PDF
// يدعم النقابة والأكاديميات (issuer_type)
// بدون إيموجي
// ============================================

(function () {
  'use strict';

  if (window.CertificateView && window.CertificateView.initialized) return;

  var state = {
    certificateId: null,
    certificate: null,
    academy: null,
    branch: null,
    currentUser: null,
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
      return d.toLocaleDateString('ar-EG', opts || {
        year: 'numeric', month: 'long', day: 'numeric'
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
      console.log.apply(console, ['[CertificateView]'].concat(Array.prototype.slice.call(arguments)));
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
      return u.role === 'super_admin' || u.role === 'admin';
    }
    return false;
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

  // ============================================
  // 2. Read ID from URL
  // ============================================
  function readCertificateId() {
    try {
      var params = new URLSearchParams(window.location.search);
      return params.get('id') || params.get('cert') || null;
    } catch (e) {
      return null;
    }
  }

  // ============================================
  // 3. Load Certificate
  // ============================================
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

  // ============================================
  // 4. Load Academy & Branch
  // ============================================
  function loadAcademyDetails(cert) {
    if (!cert || !cert.academy_id) {
      return Promise.resolve({ academy: null, branch: null });
    }

    var promises = [];

    // Academy
    promises.push(
      window.sb.from('academies')
        .select('id, name, license_number, logo_url, status, is_deleted')
        .eq('id', cert.academy_id)
        .maybeSingle()
        .then(function (r) { return r.data; })
        .catch(function () { return null; })
    );

    // Branch
    if (cert.branch_id) {
      promises.push(
        window.sb.from('academy_branches')
          .select('id, governorate, address')
          .eq('id', cert.branch_id)
          .maybeSingle()
          .then(function (r) { return r.data; })
          .catch(function () { return null; })
      );
    } else {
      promises.push(Promise.resolve(null));
    }

    return Promise.all(promises).then(function (r) {
      return { academy: r[0], branch: r[1] };
    });
  }

  // ============================================
  // 5. Log Activity (auto on view)
  // ============================================
  function logViewActivity(cert) {
    if (!window.sb || !state.currentUser) return;

    window.sb.from('activities').insert({
      user_id: state.currentUser.id,
      user_name: state.currentUser.full_name,
      user_role: state.currentUser.role,
      action_type: 'view_certificate',
      description: 'عرض شهادة: ' + (cert.certificate_code || ''),
      details: {
        certificate_id: cert.id,
        student_name: cert.student_name,
        issuer_type: cert.issuer_type || 'academy'
      }
    }).catch(function () {});
  }

  // ============================================
  // 6. Render Status Banner
  // ============================================
  function renderStatusBanner() {
    var banner = $('statusBanner');
    var titleEl = $('statusTitle');
    var textEl = $('statusText');
    if (!banner) return;

    var isActive = state.certificate && state.certificate.is_active !== false;

    if (isActive) {
      banner.className = 'status-banner valid';
      if (titleEl) titleEl.textContent = 'الشهادة نشطة';
      if (textEl) textEl.textContent = 'هذه الشهادة صالحة ويمكن التحقق منها عبر الموقع العام.';
      setHtml('statusBanner', '' +
        '<div class="status-banner-icon">' +
          '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">' +
            '<polyline points="20 6 9 17 4 12"></polyline>' +
          '</svg>' +
        '</div>' +
        '<div class="status-banner-content">' +
          '<h3 class="status-banner-title" id="statusTitle">الشهادة نشطة</h3>' +
          '<p class="status-banner-text" id="statusText">هذه الشهادة صالحة ويمكن التحقق منها عبر الموقع العام.</p>' +
        '</div>'
      );
    } else {
      banner.className = 'status-banner invalid';
      setHtml('statusBanner', '' +
        '<div class="status-banner-icon">' +
          '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">' +
            '<circle cx="12" cy="12" r="10"></circle>' +
            '<line x1="15" y1="9" x2="9" y2="15"></line>' +
            '<line x1="9" y1="9" x2="15" y2="15"></line>' +
          '</svg>' +
        '</div>' +
        '<div class="status-banner-content">' +
          '<h3 class="status-banner-title">الشهادة غير نشطة</h3>' +
          '<p class="status-banner-text">تم إلغاء تنشيط هذه الشهادة. لن تظهر في التحقق العام.</p>' +
        '</div>'
      );
    }
  }

  // ============================================
  // 7. Render Certificate Preview
  // ============================================
  function renderCertificatePreview() {
    var cert = state.certificate;
    if (!cert) return;

    var isUnion = cert.issuer_type === 'union' || !cert.academy_id;
    var isActive = cert.is_active !== false;

    // Header code
    setText('headerCode', cert.certificate_code || '—');

    // Certificate union & committee
    setText('certUnionName', getSetting('app_identity.union_name', 'نقابة تكنولوجيا المعلومات والبرمجيات'));
    setText('certCommitteeName', getSetting('app_identity.committee_name', 'لجنة التحول الرقمي والتدريب'));
    setText('certCommitteeHead', getSetting('app_identity.committee_head_name', 'د. أحمد محمد'));
    setText('certPresident', getSetting('app_identity.president_name', 'المحاسب / محمود جميل'));

    // Logo
    var logoUrl = getSetting('app_identity.logo_url', null);
    var logoEl = $('certLogo');
    if (logoEl && logoUrl) {
      logoEl.innerHTML = '<img src="' + escapeHtml(logoUrl) + '" alt="">';
    }

    // Code
    setText('certCode', cert.certificate_code || '—');

    // Status badge
    var badgeEl = $('certStatusBadge');
    if (badgeEl) {
      badgeEl.textContent = isActive ? 'صالحة' : 'غير صالحة';
      badgeEl.className = 'cert-real-status-badge ' + (isActive ? 'valid' : 'invalid');
    }

    // Fields
    var issuerLabel, issuerName, licenseLabel, licenseValue, branchLabel, branchName;
    if (isUnion) {
      issuerLabel = 'الجهة المُصدرة';
      issuerName = getSetting('app_identity.union_name', 'نقابة تكنولوجيا المعلومات');
      licenseLabel = 'اللجنة المُنظمة';
      licenseValue = getSetting('app_identity.committee_name', 'لجنة التحول الرقمي والتدريب');
      branchLabel = null;
      branchName = null;
    } else {
      issuerLabel = 'الأكاديمية';
      issuerName = state.academy ? state.academy.name : (cert.academy_name || '—');
      licenseLabel = 'رقم الاعتماد';
      licenseValue = state.academy ? state.academy.license_number : (cert.academy_license_number || '—');
      branchLabel = 'الفرع';
      branchName = state.branch ? state.branch.governorate : (cert.branch_name || '—');
    }

    var gradeCls = gradeClass(cert.grade);
    var fieldsHtml = '' +
      '<div class="cert-real-field">' +
        '<div class="cert-real-field-label">اسم المتدرب</div>' +
        '<div class="cert-real-field-value">' + escapeHtml(cert.student_name || '—') + '</div>' +
      '</div>' +
      '<div class="cert-real-field">' +
        '<div class="cert-real-field-label">الرقم القومي</div>' +
        '<div class="cert-real-field-value mono">' + escapeHtml(cert.student_national_id || '—') + '</div>' +
      '</div>' +
      '<div class="cert-real-field">' +
        '<div class="cert-real-field-label">اسم الدورة</div>' +
        '<div class="cert-real-field-value">' + escapeHtml(cert.course_name || '—') + '</div>' +
      '</div>' +
      '<div class="cert-real-field">' +
        '<div class="cert-real-field-label">عدد الساعات</div>' +
        '<div class="cert-real-field-value">' + (cert.course_hours ? escapeHtml(String(cert.course_hours)) + ' ساعة' : '—') + '</div>' +
      '</div>' +
      '<div class="cert-real-field">' +
        '<div class="cert-real-field-label">التقدير</div>' +
        '<div class="cert-real-field-value ' + gradeCls + '">' + escapeHtml(cert.grade || '—') + '</div>' +
      '</div>' +
      '<div class="cert-real-field">' +
        '<div class="cert-real-field-label">' + escapeHtml(issuerLabel) + '</div>' +
        '<div class="cert-real-field-value">' + escapeHtml(issuerName || '—') + '</div>' +
      '</div>' +
      '<div class="cert-real-field">' +
        '<div class="cert-real-field-label">' + escapeHtml(licenseLabel) + '</div>' +
        '<div class="cert-real-field-value mono">' + escapeHtml(licenseValue || '—') + '</div>' +
      '</div>' +
      (branchName
        ? '<div class="cert-real-field">' +
            '<div class="cert-real-field-label">' + escapeHtml(branchLabel) + '</div>' +
            '<div class="cert-real-field-value">' + escapeHtml(branchName) + '</div>' +
          '</div>'
        : '') +
      '<div class="cert-real-field">' +
        '<div class="cert-real-field-label">تاريخ الإصدار</div>' +
        '<div class="cert-real-field-value">' + formatDate(cert.issued_at) + '</div>' +
      '</div>';

    setHtml('certFields', fieldsHtml);

    // Bottom footer
    setText('certBottom', 'تم التحقق بواسطة ' + getSetting('app_identity.union_name', 'نقابة تكنولوجيا المعلومات'));

    // Data panels
    renderDataPanels(cert, isUnion);
  }

  // ============================================
  // 8. Render Data Panels
  // ============================================
  function renderDataPanels(cert, isUnion) {
    // Student
    setText('dataStudentName', cert.student_name || '—');
    setText('dataNationalId', cert.student_national_id || '—');

    // Course
    setText('dataCourseName', cert.course_name || '—');
    setText('dataHours', cert.course_hours ? cert.course_hours + ' ساعة' : '—');
    setText('dataGrade', cert.grade || '—');

    // Issuer
    setText('dataIssuerType', isUnion ? 'النقابة (مباشر)' : 'أكاديمية معتمدة');

    var academyWrap = $('dataAcademyWrap');
    var licenseWrap = $('dataLicenseWrap');
    var branchWrap = $('dataBranchWrap');
    var completionWrap = $('dataCompletionWrap');

    if (isUnion) {
      if (academyWrap) academyWrap.style.display = 'none';
      if (licenseWrap) licenseWrap.style.display = 'none';
      if (branchWrap) branchWrap.style.display = 'none';
    } else {
      if (academyWrap) academyWrap.style.display = 'flex';
      if (licenseWrap) licenseWrap.style.display = 'flex';

      var acName = state.academy ? state.academy.name : (cert.academy_name || '—');
      var acLicense = state.academy ? state.academy.license_number : (cert.academy_license_number || '—');
      setText('dataAcademy', acName);
      setText('dataLicense', acLicense);

      // Branch
      if (cert.branch_id || state.branch) {
        if (branchWrap) branchWrap.style.display = 'flex';
        var bName = state.branch ? state.branch.governorate : (cert.branch_name || '—');
        setText('dataBranch', bName);
      } else {
        if (branchWrap) branchWrap.style.display = 'none';
      }
    }

    // Dates
    setText('dataIssuedAt', formatDate(cert.issued_at));
    if (cert.completion_date) {
      if (completionWrap) completionWrap.style.display = 'flex';
      setText('dataCompletion', formatDate(cert.completion_date));
    } else {
      if (completionWrap) completionWrap.style.display = 'none';
    }
  }

  // ============================================
  // 9. Generate QR Code
  // ============================================
  function generateQR() {
    var container = $('qrContainer');
    if (!container || !state.certificate) return;

    container.innerHTML = '';

    var code = state.certificate.certificate_code;
    if (!code) return;

    var verifyUrl = window.location.origin +
      ((window.ITWS_CONFIG && window.ITWS_CONFIG.BASE_PATH) || '/') +
      'verify.html?code=' + encodeURIComponent(code);

    // qrcodejs
    if (window.QRCode) {
      try {
        new window.QRCode(container, {
          text: verifyUrl,
          width: 180,
          height: 180,
          colorDark: '#0A0E14',
          colorLight: '#ffffff',
          correctLevel: window.QRCode.CorrectLevel.M
        });
      } catch (e) {
        logDebug('QR generation failed:', e.message);
        container.innerHTML = '<div style="padding:40px;color:var(--text-muted);font-size:12px;">تعذر توليد QR</div>';
      }
    } else {
      container.innerHTML = '<div style="padding:40px;color:var(--text-muted);font-size:12px;">مكتبة QR غير محملة</div>';
    }
  }

  // ============================================
  // 10. Bind Actions
  // ============================================
  function bindActions() {
    var cert = state.certificate;

    // Public view
    var viewPublicBtn = $('viewPublicBtn');
    if (viewPublicBtn && cert) {
      viewPublicBtn.href = resolve('verify.html?code=' + encodeURIComponent(cert.certificate_code));
    }

    // Print
    var printBtn = $('printBtn');
    if (printBtn) printBtn.addEventListener('click', doPrint);

    // PDF
    var pdfBtn = $('pdfBtn');
    if (pdfBtn) pdfBtn.addEventListener('click', doDownloadPDF);

    // Share
    var shareBtn = $('shareBtn');
    if (shareBtn) shareBtn.addEventListener('click', doShare);

    // Copy link
    var copyLinkBtn = $('copyLinkBtn');
    if (copyLinkBtn) copyLinkBtn.addEventListener('click', doCopyLink);

    // Admin actions
    var adminActions = $('adminActions');
    var canEdit = hasPermission('certificate.edit');
    var canDelete = hasPermission('certificate.delete');

    if (adminActions && (canEdit || canDelete)) {
      adminActions.style.display = 'flex';
      adminActions.style.flexDirection = 'column';
      adminActions.style.gap = '8px';
      adminActions.style.borderTop = '1px solid var(--border)';
      adminActions.style.paddingTop = '8px';
      adminActions.style.marginTop = '8px';
    }

    // Edit
    var editBtn = $('editBtn');
    if (editBtn) {
      if (canEdit) {
        editBtn.href = resolve('admin/certificate-edit.html?id=' + encodeURIComponent(cert.id));
      } else {
        editBtn.style.display = 'none';
      }
    }

    // Delete
    var deleteBtn = $('deleteBtn');
    if (deleteBtn) {
      if (canDelete) {
        deleteBtn.addEventListener('click', doDelete);
      } else {
        deleteBtn.style.display = 'none';
      }
    }
  }

  // ============================================
  // 11. Action: Print
  // ============================================
  function doPrint() {
    window.print();
  }

  // ============================================
  // 12. Action: Download PDF
  // ============================================
  function doDownloadPDF() {
    if (!state.certificate) return;
    if (!window.html2pdf) {
      toast('مكتبة PDF غير محملة، سيتم فتح نافذة الطباعة', 'info');
      window.print();
      return;
    }

    toast('جاري تجهيز PDF...', 'info');

    var el = $('certReal');
    if (!el) return;

    var opt = {
      margin: [5, 5, 5, 5],
      filename: 'certificate-' + (state.certificate.certificate_code || 'unknown') + '.pdf',
      image: { type: 'jpeg', quality: 0.98 },
      html2canvas: {
        scale: 2,
        useCORS: true,
        backgroundColor: '#ffffff',
        logging: false
      },
      jsPDF: { unit: 'mm', format: 'a4', orientation: 'landscape' },
      pagebreak: { mode: ['avoid-all'] }
    };

    window.html2pdf().set(opt).from(el).save()
      .then(function () {
        toast('تم تحميل PDF بنجاح', 'success');
      })
      .catch(function (err) {
        logDebug('PDF error:', err.message);
        toast('حدث خطأ في تحميل PDF', 'error');
      });
  }

  // ============================================
  // 13. Action: Share
  // ============================================
  function doShare() {
    if (!state.certificate) return;

    var code = state.certificate.certificate_code;
    var url = window.location.origin +
      ((window.ITWS_CONFIG && window.ITWS_CONFIG.BASE_PATH) || '/') +
      'verify.html?code=' + encodeURIComponent(code);

    if (navigator.share) {
      navigator.share({
        title: 'شهادة معتمدة',
        text: 'تحقق من صحة الشهادة: ' + code,
        url: url
      }).catch(function () {});
    } else {
      doCopyLink();
    }
  }

  function doCopyLink() {
    if (!state.certificate) return;

    var code = state.certificate.certificate_code;
    var url = window.location.origin +
      ((window.ITWS_CONFIG && window.ITWS_CONFIG.BASE_PATH) || '/') +
      'verify.html?code=' + encodeURIComponent(code);

    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(url).then(function () {
        toast('تم نسخ الرابط', 'success');
      }).catch(function () {
        prompt('انسخ الرابط:', url);
      });
    } else {
      prompt('انسخ الرابط:', url);
    }
  }

  // ============================================
  // 14. Action: Delete
  // ============================================
  function doDelete() {
    if (!state.certificate) return;

    if (!hasPermission('certificate.delete')) {
      toast('غير مصرح لك بحذف الشهادات', 'error');
      return;
    }

    var cert = state.certificate;

    if (!window.Modal || !window.Modal.confirm) {
      if (!confirm('هل تريد حذف الشهادة "' + cert.certificate_code + '"؟')) return;
      performDelete();
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
      if (confirmed) performDelete();
    });
  }

  function performDelete() {
    if (!window.sb || !state.certificate) return;

    var cert = state.certificate;

    window.sb.from('certificates').update({
      is_active: false,
      deleted_at: new Date().toISOString()
    }).eq('id', cert.id)
      .then(function (res) {
        if (res.error) {
          toast('فشل الحذف: ' + res.error.message, 'error');
          return;
        }

        toast('تم حذف الشهادة بنجاح', 'success');
        logDebug('Certificate deleted:', cert.id);

        // Log activity
        logActivity('delete_certificate', 'حذف شهادة: ' + cert.certificate_code, {
          certificate_id: cert.id,
          student_name: cert.student_name
        });

        // Redirect after short delay
        setTimeout(function () {
          window.location.href = resolve('admin/certificates.html');
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

  // ============================================
  // 15. Meta Info
  // ============================================
  function renderMeta() {
    if (!state.certificate) return;

    setText('metaId', state.certificate.id ? state.certificate.id.substring(0, 8) + '...' : '—');
    setText('metaStatus', state.certificate.is_active !== false ? 'نشطة' : 'غير نشطة');
  }

  // ============================================
  // 16. Show Error
  // ============================================
  function showError(title, text) {
    var loader = $('viewLoader');
    var content = $('viewContent');
    var error = $('viewError');

    if (loader) loader.classList.remove('show');
    if (content) content.style.display = 'none';
    if (error) {
      error.classList.add('show');
      if (title) setText('errorTitle', title);
      if (text) setText('errorText', text);
    }
  }

  // ============================================
  // 17. Init
  // ============================================
  function init() {
    if (state.initialized) return;
    state.initialized = true;

    // Read ID
    state.certificateId = readCertificateId();
    if (!state.certificateId) {
      showError('لم يتم تحديد الشهادة', 'تأكد من الرابط أو ارجع لصفحة الشهادات.');
      return;
    }

    // Current user
    if (window.AuthGuard && window.AuthGuard.getUser) {
      state.currentUser = window.AuthGuard.getUser();
    }

    // Show loader
    var loader = $('viewLoader');
    if (loader) loader.classList.add('show');

    // Load
    waitForSupabase(function () {
      loadCertificate(state.certificateId)
        .then(function (cert) {
          if (!cert) {
            showError('الشهادة غير موجودة', 'لم يتم العثور على شهادة بهذا المعرف.');
            return;
          }

          state.certificate = cert;

          return loadAcademyDetails(cert).then(function (details) {
            state.academy = details.academy;
            state.branch = details.branch;

            // Show content
            if (loader) loader.classList.remove('show');
            var content = $('viewContent');
            if (content) content.style.display = 'block';

            // Render
            renderStatusBanner();
            renderCertificatePreview();
            renderMeta();
            bindActions();

            // QR (after short delay for DOM ready)
            setTimeout(generateQR, 100);

            // Log view activity
            if (state.currentUser) {
              logViewActivity(cert);
            }

            logDebug('Certificate loaded:', cert.id);
          });
        })
        .catch(function (err) {
          showError('حدث خطأ', err.message || 'يرجى المحاولة مرة أخرى.');
          logDebug('Load error:', err.message);
        });
    });

    logDebug('Certificate view initialized. ID:', state.certificateId);
  }

  function waitForSupabase(cb) {
    if (window.sb) { cb(); return; }
    var w = 0;
    var i = setInterval(function () {
      w += 100;
      if (window.sb || w >= 3000) {
        clearInterval(i);
        if (window.sb) cb();
        else showError('تعذر الاتصال بالخادم', 'يرجى إعادة تحميل الصفحة.');
      }
    }, 100);
  }

  // ============================================
  // 18. Public API
  // ============================================
  window.CertificateView = {
    initialized: true,
    init: init,
    print: doPrint,
    downloadPDF: doDownloadPDF,
    share: doShare,
    copyLink: doCopyLink,
    delete: doDelete,
    getState: function () { return state; }
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

})();
