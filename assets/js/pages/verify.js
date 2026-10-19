// ============================================
// [22/50] ITWS Platform - Verify Page Logic
// Path: assets/js/pages/verify.js
// ============================================
// إصلاح: بدون إيموجي
// إصلاح: مسارات نسبية
// إصلاح: يتحقق من is_active وأيضاً status
// ============================================

(function () {
  'use strict';

  if (window.VerifyPage && window.VerifyPage.initialized) return;

  var state = {
    currentCertificate: null,
    currentAcademy: null,
    currentBranch: null,
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

  function formatDate(date, opts) {
    if (!date) return '—';
    try {
      var d = date instanceof Date ? date : new Date(date);
      if (isNaN(d.getTime())) return '—';
      return d.toLocaleDateString('ar-EG', opts || {
        year: 'numeric',
        month: 'long',
        day: 'numeric'
      });
    } catch (e) {
      return '—';
    }
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
      console.log.apply(console, ['[VerifyPage]'].concat(Array.prototype.slice.call(arguments)));
    }
  }

  function resolve(path) {
    if (!path) return '#';
    if (window.resolveUrl) return window.resolveUrl(path);
    var base = (window.ITWS_CONFIG && window.ITWS_CONFIG.BASE_PATH) || '';
    return base + String(path).replace(/^\.?\//, '');
  }

  // ============================================
  // 2. Dynamic content
  // ============================================
  function applyDynamicContent() {
    setText('footerCopyright', getSetting('app_identity.footer_text', '© 2026 نقابة تكنولوجيا المعلومات والبرمجيات'));
    setText('footerPresidentLabel', getSetting('app_identity.president_label', 'النقيب العام:'));
    setText('footerPresidentName', getSetting('app_identity.president_name', 'المحاسب / محمود جميل'));
  }

  // ============================================
  // 3. Load certificate
  // ============================================
  function loadCertificate(code) {
    if (!window.sb) return Promise.reject(new Error('Supabase not ready'));

    return window.sb
      .from('certificates')
      .select('*')
      .eq('certificate_code', code)
      .maybeSingle()
      .then(function (res) {
        if (res.error) throw new Error(res.error.message);
        return res.data;
      });
  }

  // ============================================
  // 4. Load academy details
  // ============================================
  function loadAcademyDetails(cert) {
    if (!cert) return Promise.resolve({ academy: null, branch: null });

    var promises = [];

    if (cert.academy_id) {
      promises.push(
        window.sb.from('academies')
          .select('id, name, license_number, logo_url, status, is_deleted')
          .eq('id', cert.academy_id)
          .maybeSingle()
          .then(function (r) { return r.data; })
          .catch(function () { return null; })
      );
    } else {
      promises.push(Promise.resolve(null));
    }

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
  // 5. Log search
  // ============================================
  function logSearch(code, count) {
    if (!window.sb) return;

    window.sb.from('search_logs').insert({
      search_type: 'certificate',
      search_value: code,
      result_count: count,
      user_agent: navigator.userAgent.substring(0, 200)
    }).catch(function () {});
  }

  // ============================================
  // 6. Grade class
  // ============================================
  function gradeClass(grade) {
    if (!grade) return '';
    var g = String(grade).toUpperCase().replace(/[+-]/g, '');
    if (g === 'A') return 'excellent';
    if (g === 'B') return 'very-good';
    if (g === 'C') return 'good';
    if (g === 'D') return 'pass';
    return 'fail';
  }

  // ============================================
  // 7. Render certificate (بدون إيموجي)
  // ============================================
  function renderCertificate(cert) {
    var result = $('verifyResult');
    if (!result) return;

    var isActive = cert.is_active !== false;
    var academy = state.currentAcademy;
    var branch = state.currentBranch;

    // التحقق من حالة الأكاديمية أيضاً
    var academyOk = !academy || (academy.status === 'approved' && academy.is_deleted !== true);
    var isFullyValid = isActive && academyOk;

    var statusIcon = isFullyValid ? '&#10003;' : '&#10005;';
    var statusText = isFullyValid ? 'صالحة' : 'غير صالحة';
    var statusClass = isFullyValid ? 'valid' : 'invalid';
    var headerClass = isFullyValid ? '' : 'invalid';

    // بيانات
    var studentName = escapeHtml(cert.student_name || '—');
    var nationalId = cert.student_national_id
      ? '&#8226;&#8226;&#8226;&#8226; &#8226;&#8226;&#8226;&#8226; &#8226;&#8226;&#8226;&#8226; ' + escapeHtml(String(cert.student_national_id).slice(-4))
      : '—';
    var courseName = escapeHtml(cert.course_name || '—');
    var courseHours = cert.course_hours ? escapeHtml(String(cert.course_hours)) + ' ساعة' : '—';
    var grade = cert.grade || '—';
    var gradeCls = gradeClass(cert.grade);
    var issuedDate = formatDate(cert.issued_at);
    var completionDate = cert.completion_date ? formatDate(cert.completion_date) : null;
    var academyName = academy ? escapeHtml(academy.name) : escapeHtml(cert.academy_name || '—');
    var licenseNumber = academy
      ? escapeHtml(academy.license_number || '—')
      : escapeHtml(cert.academy_license_number || '—');
    var branchName = branch
      ? escapeHtml(branch.governorate || '—')
      : escapeHtml(cert.branch_name || '—');
    var branchAddress = branch && branch.address ? escapeHtml(branch.address) : '';

    var html = '' +
      '<div class="cert-card' + (isFullyValid ? '' : ' invalid') + '">' +

        // Header
        '<div class="cert-header' + (headerClass ? ' ' + headerClass : '') + '">' +
          '<div class="cert-header-left">' +
            '<div class="cert-seal">' + statusIcon + '</div>' +
            '<div>' +
              '<h2 class="cert-header-title">شهادة اجتياز دورة تدريبية</h2>' +
              '<div class="cert-header-subtitle">' + escapeHtml(cert.certificate_code) + '</div>' +
            '</div>' +
          '</div>' +
          '<span class="cert-status ' + statusClass + '">' + statusText + '</span>' +
        '</div>' +

        // Body
        '<div class="cert-body">' +

          // بيانات المتدرب
          '<div class="cert-section">' +
            '<div class="cert-section-title">بيانات المتدرب</div>' +
            '<div class="cert-grid">' +
              '<div class="cert-item">' +
                '<div class="cert-item-label">الاسم الكامل</div>' +
                '<div class="cert-item-value">' + studentName + '</div>' +
              '</div>' +
              '<div class="cert-item">' +
                '<div class="cert-item-label">الرقم القومي</div>' +
                '<div class="cert-item-value mono">' + nationalId + '</div>' +
              '</div>' +
            '</div>' +
          '</div>' +

          // بيانات الدورة
          '<div class="cert-section">' +
            '<div class="cert-section-title">بيانات الدورة</div>' +
            '<div class="cert-grid">' +
              '<div class="cert-item">' +
                '<div class="cert-item-label">اسم الدورة</div>' +
                '<div class="cert-item-value">' + courseName + '</div>' +
              '</div>' +
              '<div class="cert-item">' +
                '<div class="cert-item-label">عدد الساعات</div>' +
                '<div class="cert-item-value">' + courseHours + '</div>' +
              '</div>' +
              '<div class="cert-item">' +
                '<div class="cert-item-label">التقدير</div>' +
                '<div class="cert-item-value">' +
                  '<span class="cert-grade ' + gradeCls + '">' + escapeHtml(grade) + '</span>' +
                '</div>' +
              '</div>' +
              (completionDate
                ? '<div class="cert-item">' +
                    '<div class="cert-item-label">تاريخ إتمام الدورة</div>' +
                    '<div class="cert-item-value">' + completionDate + '</div>' +
                  '</div>'
                : '') +
            '</div>' +
          '</div>' +

          // بيانات الأكاديمية
          '<div class="cert-section">' +
            '<div class="cert-section-title">بيانات الأكاديمية</div>' +
            '<div class="cert-grid">' +
              '<div class="cert-item">' +
                '<div class="cert-item-label">الأكاديمية</div>' +
                '<div class="cert-item-value">' + academyName + '</div>' +
              '</div>' +
              '<div class="cert-item">' +
                '<div class="cert-item-label">رقم الاعتماد</div>' +
                '<div class="cert-item-value mono">' + licenseNumber + '</div>' +
              '</div>' +
              '<div class="cert-item">' +
                '<div class="cert-item-label">الفرع</div>' +
                '<div class="cert-item-value">' + branchName + '</div>' +
              '</div>' +
              (branchAddress
                ? '<div class="cert-item">' +
                    '<div class="cert-item-label">عنوان الفرع</div>' +
                    '<div class="cert-item-value">' + branchAddress + '</div>' +
                  '</div>'
                : '') +
            '</div>' +
          '</div>' +

          // تاريخ الإصدار
          '<div class="cert-section">' +
            '<div class="cert-section-title">تاريخ الإصدار</div>' +
            '<div class="cert-grid">' +
              '<div class="cert-item">' +
                '<div class="cert-item-label">تاريخ إصدار الشهادة</div>' +
                '<div class="cert-item-value">' + issuedDate + '</div>' +
              '</div>' +
            '</div>' +
          '</div>' +

        '</div>' +

        // Actions
        (isFullyValid
          ? '<div class="cert-actions">' +
              '<button class="cert-action-btn success" onclick="VerifyPage.print()" type="button">طباعة</button>' +
              '<button class="cert-action-btn primary" onclick="VerifyPage.downloadPDF()" type="button">تحميل PDF</button>' +
              '<button class="cert-action-btn" onclick="VerifyPage.share()" type="button">مشاركة</button>' +
              '<button class="cert-action-btn" onclick="VerifyPage.copyLink()" type="button">نسخ الرابط</button>' +
            '</div>'
          : '') +

        // Footer
        '<div class="cert-footer">' +
          'تم التحقق بواسطة <strong>' + escapeHtml(getSetting('app_identity.union_name', 'نقابة تكنولوجيا المعلومات')) + '</strong>' +
          '<br>' +
          escapeHtml(getSetting('app_identity.committee_name', 'لجنة التحول الرقمي والتدريب')) +
        '</div>' +

      '</div>';

    result.innerHTML = html;
    result.classList.add('show');
  }

  // ============================================
  // 8. Print
  // ============================================
  function printCertificate() {
    window.print();
  }

  // ============================================
  // 9. PDF
  // ============================================
  function downloadPDF() {
    if (!state.currentCertificate) return;
    toast('جاري تجهيز PDF...', 'info');

    if (window.html2pdf) {
      var el = document.querySelector('.cert-card');
      if (!el) return;
      var opt = {
        margin: 10,
        filename: 'certificate-' + (state.currentCertificate.certificate_code || 'unknown') + '.pdf',
        image: { type: 'jpeg', quality: 0.98 },
        html2canvas: { scale: 2, useCORS: true, backgroundColor: '#ffffff' },
        jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' }
      };
      window.html2pdf().set(opt).from(el).save();
    } else {
      window.print();
    }
  }

  // ============================================
  // 10. Share
  // ============================================
  function share() {
    if (!state.currentCertificate) return;
    var code = state.currentCertificate.certificate_code;
    var url = window.location.origin + window.location.pathname + '?code=' + encodeURIComponent(code);

    if (navigator.share) {
      navigator.share({
        title: 'شهادة معتمدة',
        text: 'تحقق من صحة الشهادة: ' + code,
        url: url
      }).catch(function () {});
    } else {
      copyLink();
    }
  }

  function copyLink() {
    if (!state.currentCertificate) return;
    var code = state.currentCertificate.certificate_code;
    var url = window.location.origin + window.location.pathname + '?code=' + encodeURIComponent(code);

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
  // 11. Main search
  // ============================================
  function performSearch(code) {
    if (!code) {
      toast('أدخل كود الشهادة', 'error');
      return;
    }

    var loader = $('verifyLoader');
    var error = $('verifyError');
    var result = $('verifyResult');
    var btn = $('verifyBtn');

    if (loader) loader.classList.add('show');
    if (error) error.classList.remove('show');
    if (result) result.classList.remove('show');
    if (btn) { btn.disabled = true; btn.textContent = 'جاري التحقق...'; }

    loadCertificate(code)
      .then(function (cert) {
        if (!cert) {
          if (loader) loader.classList.remove('show');
          if (error) {
            var titleEl = $('errorTitle');
            var textEl = $('errorText');
            if (titleEl) titleEl.textContent = 'لم يتم العثور على الشهادة';
            if (textEl) textEl.textContent = 'تأكد من كتابة الكود بشكل صحيح، أو تواصل مع الأكاديمية المسؤولة';
            error.classList.add('show');
          }
          if (btn) { btn.disabled = false; btn.textContent = 'تحقق'; }
          logSearch(code, 0);
          return;
        }

        state.currentCertificate = cert;

        return loadAcademyDetails(cert).then(function (details) {
          state.currentAcademy = details.academy;
          state.currentBranch = details.branch;

          if (loader) loader.classList.remove('show');
          renderCertificate(cert);
          if (btn) { btn.disabled = false; btn.textContent = 'تحقق'; }
          logSearch(code, 1);

          setTimeout(function () {
            var r = $('verifyResult');
            if (r) r.scrollIntoView({ behavior: 'smooth', block: 'start' });
          }, 100);
        });
      })
      .catch(function (err) {
        if (loader) loader.classList.remove('show');
        if (error) {
          var titleEl = $('errorTitle');
          var textEl = $('errorText');
          if (titleEl) titleEl.textContent = 'حدث خطأ';
          if (textEl) textEl.textContent = err.message || 'يرجى المحاولة مرة أخرى';
          error.classList.add('show');
        }
        if (btn) { btn.disabled = false; btn.textContent = 'تحقق'; }
        toast('حدث خطأ في التحقق', 'error');
      });
  }

  // ============================================
  // 12. Submit
  // ============================================
  function handleSubmit(e) {
    if (e) e.preventDefault();
    var input = $('certCodeInput');
    var code = input ? input.value.trim() : '';
    if (!code) {
      toast('أدخل كود الشهادة', 'error');
      if (input) input.focus();
      return false;
    }
    performSearch(code);
    return false;
  }

  // ============================================
  // 13. Init
  // ============================================
  function init() {
    if (state.initialized) return;
    state.initialized = true;

    applyDynamicContent();

    var form = $('verifyForm');
    if (form) form.addEventListener('submit', handleSubmit);

    if (window.AppSettings && window.AppSettings.onChange) {
      window.AppSettings.onChange(function (cache, key) {
        if (!key || key === 'app_identity') applyDynamicContent();
      });
    }

    // Auto-verify من URL
    var params = new URLSearchParams(window.location.search);
    var code = params.get('code');
    if (code) {
      var input = $('certCodeInput');
      if (input) input.value = code;
      setTimeout(function () { performSearch(code); }, 400);
    }

    logDebug('Verify page initialized');
  }

  // ============================================
  // 14. Public API
  // ============================================
  window.VerifyPage = {
    initialized: true,
    init: init,
    print: printCertificate,
    downloadPDF: downloadPDF,
    share: share,
    copyLink: copyLink,
    performSearch: performSearch
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

})();
