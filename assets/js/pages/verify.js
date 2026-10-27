/* ============================================================
   ITWS Platform — Verify Certificate Page Logic
   File: assets/js/pages/verify.js
   Role: Verify certificate by code, render result, actions
   Rules: No emoji, all from settings, no sensitive data leaks
   ============================================================ */
(function () {
  'use strict';

  if (window.VerifyPage && window.VerifyPage.initialized) return;

  var state = {
    initialized: false,
    verifying: false,
    lastCertificate: null,
    lastAcademy: null,
    lastBranch: null,
    lastQuery: '',
    sb: null
  };

  /* ---------------- Helpers ---------------- */
  function $(sel, ctx) { return (ctx || document).querySelector(sel); }
  function $all(sel, ctx) { return Array.prototype.slice.call((ctx || document).querySelectorAll(sel)); }

  function escapeHtml(s) {
    if (s == null) return '';
    return String(s)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  function getSetting(path, fallback) {
    try {
      if (window.AppSettings && typeof window.AppSettings.get === 'function') {
        var v = window.AppSettings.get(path);
        return (v === undefined || v === null) ? fallback : v;
      }
    } catch (e) {}
    return fallback;
  }

  function resolve(path) {
    if (!path) return '#';
    if (window.resolveUrl) return window.resolveUrl(path);
    var base = (window.ITWS_CONFIG && window.ITWS_CONFIG.BASE_PATH) || '';
    if (base && base.charAt(base.length - 1) !== '/') base += '/';
    return base + String(path).replace(/^\.?\//, '');
  }

  function getSb() {
    return window.sb || window.supabaseClient || window.ITWS_SUPABASE || null;
  }

  function toast(msg, type) {
    if (window.Utils && typeof window.Utils.showToast === 'function') {
      window.Utils.showToast(msg, type || 'info');
    } else if (typeof window.showToast === 'function') {
      window.showToast(msg, type || 'info');
    }
  }

  function maskNationalId(nid) {
    if (!nid) return '';
    var s = String(nid).replace(/\D/g, '');
    if (s.length < 4) return '****';
    return '********' + s.slice(-4);
  }

  function formatDate(d) {
    if (!d) return '';
    try {
      var dt = new Date(d);
      if (isNaN(dt.getTime())) return String(d);
      var y = dt.getFullYear();
      var m = String(dt.getMonth() + 1).padStart(2, '0');
      var day = String(dt.getDate()).padStart(2, '0');
      return day + '/' + m + '/' + y;
    } catch (e) {
      return String(d);
    }
  }

  function show(el) { if (el) el.classList.add('show'); }
  function hide(el) { if (el) el.classList.remove('show'); }

  /* ---------------- Icons (SVG only, no emoji) ---------------- */
  var ICONS = {
    check: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>',
    x: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>',
    print: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 6 2 18 2 18 9"></polyline><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"></path><rect x="6" y="14" width="12" height="8"></rect></svg>',
    pdf: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="12" y1="18" x2="12" y2="12"></line><line x1="9" y1="15" x2="15" y2="15"></line></svg>',
    share: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="18" cy="5" r="3"></circle><circle cx="6" cy="12" r="3"></circle><circle cx="18" cy="19" r="3"></circle><line x1="8.59" y1="13.51" x2="15.42" y2="17.49"></line><line x1="15.41" y1="6.51" x2="8.59" y2="10.49"></line></svg>',
    copy: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg>',
    seal: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>'
  };

  /* ---------------- Apply dynamic texts ---------------- */
  function applyDynamicTexts() {
    var badge = $('[data-dynamic="verify_badge"]');
    if (badge) {
      var b = getSetting('app_identity.verify_badge', '');
      if (b) badge.textContent = b;
    }

    var label = $('[data-dynamic="verify_search_label"]');
    if (label) {
      var l = getSetting('app_identity.verify_search_label', '');
      if (l) label.textContent = l;
    }

    var btn = $('[data-dynamic="verify_btn"]');
    if (btn) {
      var bt = getSetting('app_identity.verify_button_text', '');
      if (bt) btn.textContent = bt;
    }

    var hint = $('[data-dynamic="verify_hint"]');
    if (hint) {
      var h = getSetting('app_identity.verify_hint', '');
      if (h) hint.textContent = h;
    }

    // Placeholder from certificate code pattern
    var input = $('#certCodeInput');
    if (input) {
      var pattern = getSetting('certificates.code_pattern', '');
      if (pattern) {
        input.setAttribute('placeholder', pattern);
      } else {
        var prefix = getSetting('certificates.code_prefix', 'NTI');
        var year = new Date().getFullYear();
        input.setAttribute('placeholder', prefix + '-' + year + '-XXXXXX');
      }
    }
  }

  /* ---------------- Search tab data query ---------------- */
  function fetchCertificate(code) {
    var sb = getSb();
    if (!sb || typeof sb.from !== 'function') {
      return Promise.reject(new Error('تعذر الاتصال بالخادم'));
    }

    return sb.from('certificates')
      .select('id, code, student_name, national_id, course_name, grade, issue_date, ' +
              'academy_id, branch_id, is_active, created_at, ' +
              'academies:academy_id (id, name, logo_url, status, is_deleted, description), ' +
              'academy_branches:branch_id (id, name, city, address)')
      .eq('code', code)
      .maybeSingle()
      .then(function (res) {
        if (res.error) throw new Error(res.error.message);
        return res.data;
      });
  }

  /* ---------------- Log search ---------------- */
  function logSearch(code, found) {
    var sb = getSb();
    if (!sb) return;

    // Never log the full code — hash-safe: keep only first 4 chars
    var safeCode = code ? String(code).slice(0, 4) + '***' : null;

    Promise.resolve().then(function () {
      return sb.from('search_logs').insert({
        search_type: 'certificate_verify',
        search_query: safeCode,
        found: !!found,
        user_agent: navigator.userAgent.substring(0, 200)
      });
    }).catch(function (e) {
      console.warn('[Verify] log search failed:', (e && e.message) || e);
    });
  }

  /* ---------------- Grade class mapping ---------------- */
  function getGradeClass(grade) {
    var g = String(grade || '').trim();
    if (!g) return 'good';

    var grades = getSetting('certificates.grades', ['A+', 'A', 'B+', 'B', 'C+', 'C', 'D', 'F']);
    if (!Array.isArray(grades)) grades = ['A+', 'A', 'B+', 'B', 'C+', 'C', 'D', 'F'];

    var idx = grades.indexOf(g);
    if (idx === -1) {
      // Fallback by letter
      var upper = g.toUpperCase();
      if (upper === 'A+' || upper === 'A') return 'excellent';
      if (upper === 'B+' || upper === 'B') return 'very-good';
      if (upper === 'C+' || upper === 'C') return 'good';
      if (upper === 'D') return 'pass';
      if (upper === 'F') return 'fail';
      return 'good';
    }

    var total = grades.length;
    var pct = total > 1 ? idx / (total - 1) : 0;
    if (pct <= 0.15) return 'excellent';
    if (pct <= 0.4) return 'very-good';
    if (pct <= 0.65) return 'good';
    if (pct <= 0.85) return 'pass';
    return 'fail';
  }

  /* ---------------- Render result ---------------- */
  function renderResult(cert, academy, branch, valid) {
    var container = $('#verifyResult');
    if (!container) return;

    var cardClass = valid ? 'cert-card' : 'cert-card invalid';
    var statusClass = valid ? 'valid' : 'invalid';
    var statusText = valid ? 'شهادة صحيحة' : 'شهادة غير صالحة';
    var headerClass = valid ? 'cert-header' : 'cert-header invalid';
    var sealIcon = valid ? ICONS.check : ICONS.x;

    var academyName = academy ? (academy.name || '') : '—';
    var branchName = branch ? (branch.name || '') : '';

    var gradeClass = getGradeClass(cert.grade);

    var html =
      '<div class="' + cardClass + '">' +

        '<div class="' + headerClass + '">' +
          '<div class="cert-header-left">' +
            '<div class="cert-seal" aria-hidden="true">' + sealIcon + '</div>' +
            '<div>' +
              '<h2 class="cert-header-title">' + escapeHtml(statusText) + '</h2>' +
              '<div class="cert-header-subtitle">' + escapeHtml(cert.code || '') + '</div>' +
            '</div>' +
          '</div>' +
          '<span class="cert-status ' + statusClass + '">' + escapeHtml(statusText) + '</span>' +
        '</div>' +

        '<div class="cert-body">' +

          '<div class="cert-section">' +
            '<div class="cert-section-title">بيانات المتدرب</div>' +
            '<div class="cert-grid">' +
              renderItem('اسم المتدرب', cert.student_name || '—') +
              renderItem('الرقم القومي', maskNationalId(cert.national_id), 'mono') +
            '</div>' +
          '</div>' +

          '<div class="cert-section">' +
            '<div class="cert-section-title">بيانات الدورة</div>' +
            '<div class="cert-grid">' +
              renderItem('اسم الدورة', cert.course_name || '—') +
              renderItem('التقدير', gradeHtml(cert.grade, gradeClass)) +
              renderItem('تاريخ الإصدار', formatDate(cert.issue_date), 'mono') +
            '</div>' +
          '</div>' +

          '<div class="cert-section">' +
            '<div class="cert-section-title">الأكاديمية</div>' +
            '<div class="cert-grid">' +
              renderItem('اسم الأكاديمية', academyName) +
              (branchName ? renderItem('الفرع', branchName) : '') +
            '</div>' +
          '</div>' +

        '</div>' +

        '<div class="cert-actions">' +
          '<button type="button" class="cert-action-btn primary" data-action="print">' + ICONS.print + '<span>طباعة</span></button>' +
          '<button type="button" class="cert-action-btn success" data-action="pdf">' + ICONS.pdf + '<span>تحميل PDF</span></button>' +
          '<button type="button" class="cert-action-btn" data-action="share">' + ICONS.share + '<span>مشاركة</span></button>' +
          '<button type="button" class="cert-action-btn" data-action="copy">' + ICONS.copy + '<span>نسخ الرابط</span></button>' +
        '</div>' +

        '<div class="cert-footer">' +
          'هذه الشهادة صادرة عن <strong>' + escapeHtml(getSetting('app_identity.union_name', 'نقابة تكنولوجيا المعلومات')) + '</strong>' +
          ' — يمكن التحقق منها في أي وقت عبر كود الشهادة' +
        '</div>' +

      '</div>';

    container.innerHTML = html;

    // Bind action buttons
    var printBtn = $('[data-action="print"]', container);
    if (printBtn) printBtn.addEventListener('click', handlePrint);

    var pdfBtn = $('[data-action="pdf"]', container);
    if (pdfBtn) pdfBtn.addEventListener('click', handlePDF);

    var shareBtn = $('[data-action="share"]', container);
    if (shareBtn) shareBtn.addEventListener('click', handleShare);

    var copyBtn = $('[data-action="copy"]', container);
    if (copyBtn) copyBtn.addEventListener('click', handleCopy);
  }

  function renderItem(label, value, valueClass) {
    return '<div class="cert-item">' +
      '<div class="cert-item-label">' + escapeHtml(label) + '</div>' +
      '<div class="cert-item-value' + (valueClass ? ' ' + valueClass : '') + '">' + escapeHtml(value) + '</div>' +
    '</div>';
  }

  function gradeHtml(grade, cls) {
    if (!grade) return '<span>—</span>';
    return '<span class="cert-grade ' + cls + '">' + escapeHtml(grade) + '</span>';
  }

  /* ---------------- Actions ---------------- */
  function handlePrint() {
    window.print();
  }

  function handlePDF() {
    var cert = state.lastCertificate;
    if (!cert) return;

    // Try html2pdf.js if available
    if (typeof window.html2pdf === 'function') {
      var container = $('#verifyResult');
      if (!container) return;
      var options = {
        margin: 10,
        filename: 'certificate-' + (cert.code || 'unknown') + '.pdf',
        image: { type: 'jpeg', quality: 0.98 },
        html2canvas: { scale: 2, useCORS: true },
        jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' }
      };
      window.html2pdf().set(options).from(container).save();
      toast('جاري إنشاء ملف PDF...', 'info');
      return;
    }

    // Fallback: print dialog
    toast('سيتم فتح نافذة الطباعة — اختر "حفظ كـ PDF"', 'info');
    setTimeout(function () { window.print(); }, 400);
  }

  function handleShare() {
    var cert = state.lastCertificate;
    if (!cert) return;

    var url = window.location.origin + window.location.pathname + '?code=' + encodeURIComponent(cert.code || '');
    var title = 'شهادة صحيحة — ' + (cert.code || '');
    var text = 'تحقق من الشهادة على منصة ' + getSetting('app_identity.union_name', 'النقابة');

    if (navigator.share) {
      navigator.share({ title: title, text: text, url: url }).catch(function (err) {
        // User cancelled or failed — fallback
        if (err && err.name !== 'AbortError') {
          copyToClipboard(url);
        }
      });
    } else {
      copyToClipboard(url);
    }
  }

  function handleCopy() {
    var cert = state.lastCertificate;
    if (!cert) return;

    var url = window.location.origin + window.location.pathname + '?code=' + encodeURIComponent(cert.code || '');
    copyToClipboard(url);
  }

  function copyToClipboard(text) {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(function () {
        toast('تم نسخ الرابط', 'success');
      }).catch(function () {
        fallbackCopy(text);
      });
    } else {
      fallbackCopy(text);
    }
  }

  function fallbackCopy(text) {
    try {
      var ta = document.createElement('textarea');
      ta.value = text;
      ta.style.position = 'fixed';
      ta.style.opacity = '0';
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      document.body.removeChild(ta);
      toast('تم نسخ الرابط', 'success');
    } catch (e) {
      toast('تعذر النسخ', 'error');
    }
  }

  /* ---------------- Error / State helpers ---------------- */
  function showError(title, text) {
    var errEl = $('#verifyError');
    var titleEl = $('#errorTitle');
    var textEl = $('#errorText');
    if (titleEl) titleEl.textContent = title || 'لم يتم العثور على الشهادة';
    if (textEl) textEl.textContent = text || 'تأكد من كتابة الكود بشكل صحيح';
    if (errEl) errEl.classList.add('show');
    hide($('#verifyLoader'));
    hide($('#verifyResult'));
    hide($('#verifyInfo'));
  }

  function hideAllStates() {
    hide($('#verifyError'));
    hide($('#verifyLoader'));
    hide($('#verifyResult'));
  }

  /* ---------------- Main verification ---------------- */
  function verifyCode(rawCode) {
    if (state.verifying) return;

    var code = String(rawCode || '').trim().toUpperCase();
    if (!code) {
      showError('الرجاء إدخال كود الشهادة', 'الكود مطلوب للتحقق');
      return;
    }

    if (code.length < 3) {
      showError('كود غير صحيح', 'الكود يجب أن يكون 3 أحرف على الأقل');
      return;
    }

    state.verifying = true;
    state.lastQuery = code;

    hideAllStates();
    var loader = $('#verifyLoader');
    if (loader) loader.classList.add('show');

    var verifyBtn = $('#verifyBtn');
    if (verifyBtn) {
      verifyBtn.disabled = true;
      verifyBtn.textContent = 'جاري التحقق...';
    }

    // Update URL
    try {
      var url = new URL(window.location.href);
      url.searchParams.set('code', code);
      window.history.replaceState({}, '', url.toString());
    } catch (e) {}

    fetchCertificate(code)
      .then(function (data) {
        if (!data) {
          showError('لم يتم العثور على الشهادة', 'تأكد من كتابة الكود بشكل صحيح، أو تواصل مع الأكاديمية المسؤولة');
          logSearch(code, false);
          return;
        }

        var academy = data.academies || null;
        var branch = data.academy_branches || null;

        var isActive = data.is_active !== false;
        var academyOk = !academy || (
          academy.status === 'approved' &&
          academy.is_deleted !== true
        );
        var isFullyValid = isActive && academyOk;

        state.lastCertificate = data;
        state.lastAcademy = academy;
        state.lastBranch = branch;

        hide($('#verifyError'));
        hide($('#verifyLoader'));
        hide($('#verifyInfo'));

        renderResult(data, academy, branch, isFullyValid);
        var resultEl = $('#verifyResult');
        if (resultEl) resultEl.classList.add('show');

        logSearch(code, true);
      })
      .catch(function (err) {
        var msg = (err && err.message) || 'حدث خطأ في التحقق';
        if (msg.indexOf('multiple') !== -1 || msg.indexOf('PGRST') !== -1) {
          msg = 'حدث خطأ في قراءة البيانات. تواصل مع الدعم.';
        }
        showError('تعذر التحقق', msg);
        logSearch(code, false);
      })
      .then(function () {
        state.verifying = false;
        if (verifyBtn) {
          verifyBtn.disabled = false;
          verifyBtn.textContent = getSetting('app_identity.verify_button_text', 'تحقق');
        }
      });
  }

  /* ---------------- Events ---------------- */
  function bindEvents() {
    var form = $('#verifyForm');
    if (form) {
      form.addEventListener('submit', function (e) {
        e.preventDefault();
        var input = $('#certCodeInput');
        verifyCode(input ? input.value : '');
      });
    }

    var input = $('#certCodeInput');
    if (input) {
      // Auto-uppercase on input
      input.addEventListener('input', function () {
        var pos = input.selectionStart;
        var upper = input.value.toUpperCase();
        if (input.value !== upper) {
          input.value = upper;
          try { input.setSelectionRange(pos, pos); } catch (e) {}
        }
      });

      // Enter key
      input.addEventListener('keydown', function (e) {
        if (e.key === 'Enter') {
          e.preventDefault();
          verifyCode(input.value);
        }
      });
    }
  }

  /* ---------------- URL auto-verify ---------------- */
  function readCodeFromUrl() {
    try {
      var params = new URLSearchParams(window.location.search);
      var code = params.get('code');
      if (code) {
        var input = $('#certCodeInput');
        if (input) input.value = code.toUpperCase();
        verifyCode(code);
        return true;
      }
    } catch (e) {}
    return false;
  }

  /* ---------------- Init ---------------- */
  function init() {
    if (state.initialized) return;
    state.initialized = true;

    state.sb = getSb();

    applyDynamicTexts();
    bindEvents();

    // Re-apply texts on settings change
    if (window.AppSettings && typeof window.AppSettings.onChange === 'function') {
      try {
        window.AppSettings.onChange(function () {
          applyDynamicTexts();
        });
      } catch (e) {}
    }

    // Fallback retries in case AppSettings loads late
    setTimeout(applyDynamicTexts, 600);
    setTimeout(applyDynamicTexts, 1800);

    // Auto-verify from URL
    setTimeout(function () {
      readCodeFromUrl();
    }, 400);
  }

  window.VerifyPage = {
    initialized: true,
    init: init,
    verify: verifyCode,
    refresh: applyDynamicTexts,
    getState: function () { return state; }
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
