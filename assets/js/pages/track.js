// ============================================
// ITWS Platform - Track Request Logic
// Path: assets/js/pages/track.js
// ============================================
// متابعة طلب الاعتماد - بالرقم
// Timeline + Documents + SLA + Status
// بدون إيموجي
// ============================================

(function () {
  'use strict';

  if (window.TrackPage && window.TrackPage.initialized) return;

  var STAGES_ORDER = [
    { key: 'submitted', label: 'تم التقديم', desc: 'تم استلام طلب الاعتماد بنجاح' },
    { key: 'documents_review', label: 'مراجعة المستندات', desc: 'يقوم فريق النقابة بمراجعة المستندات المرفوعة' },
    { key: 'site_visit', label: 'زيارة الموقع', desc: 'زيارة ميدانية للتحقق من مقر الأكاديمية' },
    { key: 'committee_review', label: 'لجنة المراجعة', desc: 'عرض الطلب على لجنة المراجعة للتصويت' },
    { key: 'final_approval', label: 'الموافقة النهائية', desc: 'المراجعة النهائية من النقيب العام' },
    { key: 'approved', label: 'تم الاعتماد', desc: 'تم اعتماد الأكاديمية رسمياً' }
  ];

  var state = {
    requestNumber: null,
    request: null,
    academy: null,
    history: [],
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
      var d = date instanceof Date ? date : (date.toDate ? date.toDate() : new Date(date));
      if (isNaN(d.getTime())) return '—';
      return d.toLocaleDateString('ar-EG', opts || {
        year: 'numeric', month: 'long', day: 'numeric'
      });
    } catch (e) { return '—'; }
  }

  function formatDateTime(date) {
    if (!date) return '—';
    try {
      var d = date instanceof Date ? date : (date.toDate ? date.toDate() : new Date(date));
      if (isNaN(d.getTime())) return '—';
      return d.toLocaleDateString('ar-EG', {
        year: 'numeric', month: 'short', day: 'numeric',
        hour: '2-digit', minute: '2-digit'
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
      console.log.apply(console, ['[TrackPage]'].concat(Array.prototype.slice.call(arguments)));
    }
  }

  function getSetting(p, f) {
    if (window.AppSettings && window.AppSettings.get) {
      return window.AppSettings.get(p, f);
    }
    return f;
  }

  function resolve(path) {
    if (!path) return '#';
    if (window.resolveUrl) return window.resolveUrl(path);
    var base = (window.ITWS_CONFIG && window.ITWS_CONFIG.BASE_PATH) || '';
    return base + String(path).replace(/^\.?\//, '');
  }

  // ============================================
  // 2. SLA Calculation
  // ============================================
  function getSlaDays(stage) {
    var slaDays = getSetting('accreditation.sla_days', {
      submitted: 3,
      documents_review: 3,
      site_visit: 14,
      committee_review: 7,
      final_approval: 5
    });
    return slaDays[stage] || 7;
  }

  function calculateSLA(request) {
    var stage = request.current_stage;
    if (!stage || stage === 'approved' || stage === 'rejected') {
      return { status: 'done', daysRemaining: null };
    }

    var slaDays = getSlaDays(stage);
    var enteredAt = request.updated_at || request.submitted_at;
    if (!enteredAt) return { status: 'on-time', daysRemaining: slaDays };

    try {
      var entered = enteredAt instanceof Date ? enteredAt : (enteredAt.toDate ? enteredAt.toDate() : new Date(enteredAt));
      if (isNaN(entered.getTime())) return { status: 'on-time', daysRemaining: slaDays };

      var elapsedMs = Date.now() - entered.getTime();
      var elapsedDays = elapsedMs / (1000 * 60 * 60 * 24);
      var remaining = slaDays - elapsedDays;

      var status;
      if (remaining < 0) status = 'overdue';
      else if (remaining < slaDays * 0.3) status = 'warning';
      else status = 'on-time';

      return {
        status: status,
        daysRemaining: Math.ceil(remaining),
        percent: Math.min(100, (elapsedDays / slaDays) * 100)
      };
    } catch (e) {
      return { status: 'on-time', daysRemaining: slaDays };
    }
  }

  // ============================================
  // 3. Load Request
  // ============================================
  function loadRequest(requestNumber) {
    if (!window.sb) return Promise.reject(new Error('Supabase not available'));

    return window.sb
      .from('accreditation_requests')
      .select('*')
      .eq('request_number', requestNumber)
      .maybeSingle()
      .then(function (res) {
        if (res.error) throw new Error(res.error.message);
        return res.data;
      });
  }

  function loadAcademy(academyId) {
    if (!academyId || !window.sb) return Promise.resolve(null);

    return window.sb
      .from('academies')
      .select('id, name, owner_name, license_number, tax_number, commercial_registry, email, phone, founded_year, description, category_id, created_at, approved_at, expires_at')
      .eq('id', academyId)
      .maybeSingle()
      .then(function (res) {
        if (res.error || !res.data) return null;
        return res.data;
      })
      .catch(function () { return null; });
  }

  function loadHistory(requestId) {
    if (!requestId || !window.sb) return Promise.resolve([]);

    return window.sb
      .from('request_stage_history')
      .select('id, from_stage, to_stage, notes, moved_at')
      .eq('request_id', requestId)
      .order('moved_at', { ascending: true })
      .then(function (res) {
        if (res.error || !res.data) return [];
        return res.data;
      })
      .catch(function () { return []; });
  }

  // ============================================
  // 4. Log Search
  // ============================================
  function logSearch(requestNumber, resultCount) {
    if (!window.sb) return;

    window.sb.from('search_logs').insert({
      search_type: 'request',
      search_value: requestNumber,
      result_count: resultCount,
      user_agent: navigator.userAgent.substring(0, 200)
    }).catch(function () {});
  }

  // ============================================
  // 5. Status Info
  // ============================================
  function getStatusInfo(stage) {
    var map = {
      'submitted': { label: 'تم التقديم', cls: 'submitted' },
      'documents_review': { label: 'مراجعة المستندات', cls: 'documents_review' },
      'site_visit': { label: 'زيارة الموقع', cls: 'site_visit' },
      'committee_review': { label: 'لجنة المراجعة', cls: 'committee_review' },
      'final_approval': { label: 'الموافقة النهائية', cls: 'final_approval' },
      'approved': { label: 'معتمدة', cls: 'approved' },
      'rejected': { label: 'مرفوضة', cls: 'rejected' }
    };
    return map[stage] || { label: stage || '—', cls: 'submitted' };
  }

  // ============================================
  // 6. Render Result
  // ============================================
  function renderResult() {
    var container = $('trackResult');
    if (!container) return;

    var request = state.request;
    var academy = state.academy;
    var history = state.history;

    var isApproved = request.current_stage === 'approved';
    var isRejected = request.current_stage === 'rejected';
    var statusInfo = getStatusInfo(request.current_stage);
    var sla = calculateSLA(request);

    // ===== Banner (Approved/Rejected) =====
    var bannerHtml = '';
    if (isApproved) {
      bannerHtml = '' +
        '<div class="approved-banner">' +
          '<div class="approved-banner-icon">' +
            '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">' +
              '<polyline points="20 6 9 17 4 12"></polyline>' +
            '</svg>' +
          '</div>' +
          '<div class="approved-banner-content">' +
            '<h3 class="approved-banner-title">تم اعتماد الأكاديمية بنجاح</h3>' +
            '<p class="approved-banner-text">' +
              'أصبحت أكاديميتك معتمدة رسمياً من ' + escapeHtml(getSetting('app_identity.union_name', 'نقابة تكنولوجيا المعلومات')) +
              (academy && academy.license_number ? ' - رقم الاعتماد: ' + escapeHtml(academy.license_number) : '') +
              (academy && academy.expires_at ? ' - تاريخ الانتهاء: ' + formatDate(academy.expires_at) : '') +
            '</p>' +
          '</div>' +
        '</div>';
    } else if (isRejected) {
      bannerHtml = '' +
        '<div class="rejected-banner">' +
          '<div class="rejected-banner-icon">' +
            '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">' +
              '<circle cx="12" cy="12" r="10"></circle>' +
              '<line x1="15" y1="9" x2="9" y2="15"></line>' +
              '<line x1="9" y1="9" x2="15" y2="15"></line>' +
            '</svg>' +
          '</div>' +
          '<div class="rejected-banner-content">' +
            '<h3 class="rejected-banner-title">تم رفض طلب الاعتماد</h3>' +
            '<p class="rejected-banner-text">' +
              (request.rejection_reason ? 'السبب: ' + escapeHtml(request.rejection_reason) : 'يرجى التواصل مع النقابة للمزيد من التفاصيل.') +
            '</p>' +
          '</div>' +
        '</div>';
    }

    // ===== Header =====
    var slaBadgeHtml = '';
    if (!isApproved && !isRejected) {
      var slaText = sla.status === 'overdue'
        ? 'متأخر ' + Math.abs(sla.daysRemaining) + ' يوم'
        : 'متبقي ' + sla.daysRemaining + ' يوم';
      var slaCls = sla.status === 'overdue' ? 'overdue' : sla.status;
      slaBadgeHtml = '<span class="request-sla-badge ' + slaCls + '">' + slaText + '</span>';
    }

    var headerHtml = '' +
      '<div class="request-header-card">' +
        '<div class="request-header-top">' +
          '<div class="request-title-box">' +
            '<div class="request-number">' + escapeHtml(request.request_number) + '</div>' +
            '<h2 class="request-academy-name">' + escapeHtml(academy ? academy.name : 'أكاديمية') + '</h2>' +
          '</div>' +
          '<span class="request-status-badge ' + statusInfo.cls + '">' +
            '<span class="request-status-dot"></span>' +
            escapeHtml(statusInfo.label) +
          '</span>' +
        '</div>' +
        '<div class="request-meta-grid">' +
          '<div class="request-meta-item">' +
            '<div class="request-meta-label">تاريخ التقديم</div>' +
            '<div class="request-meta-value">' + formatDate(request.submitted_at) + '</div>' +
          '</div>' +
          '<div class="request-meta-item">' +
            '<div class="request-meta-label">آخر تحديث</div>' +
            '<div class="request-meta-value">' + formatDate(request.updated_at) + '</div>' +
          '</div>' +
          (slaBadgeHtml ? '<div class="request-meta-item">' +
            '<div class="request-meta-label">حالة SLA</div>' +
            '<div>' + slaBadgeHtml + '</div>' +
          '</div>' : '') +
        '</div>' +
      '</div>';

    // ===== Timeline =====
    var timelineHtml = renderTimeline(history);

    // ===== Info Cards =====
    var academyInfoHtml = academy ? renderAcademyInfo(academy) : '';
    var documentsHtml = renderDocuments(request);

    // Assemble
    container.innerHTML = '' +
      bannerHtml +
      headerHtml +
      '<div class="timeline-card">' +
        '<h3 class="timeline-title">' +
          '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">' +
            '<circle cx="12" cy="12" r="10"></circle>' +
            '<polyline points="12 6 12 12 16 14"></polyline>' +
          '</svg>' +
          'مراحل الطلب' +
        '</h3>' +
        timelineHtml +
      '</div>' +
      academyInfoHtml +
      documentsHtml;

    container.classList.add('show');

    // Hide error, scroll
    var errorEl = $('trackError');
    if (errorEl) errorEl.classList.remove('show');

    setTimeout(function () {
      var searchCard = $('searchCard');
      if (searchCard) {
        var offset = searchCard.getBoundingClientRect().top + window.pageYOffset - 20;
        window.scrollTo({ top: offset, behavior: 'smooth' });
      }
    }, 100);
  }

  // ============================================
  // 7. Render Timeline
  // ============================================
  function renderTimeline(history) {
    var request = state.request;
    var currentStage = request.current_stage;
    var isRejected = currentStage === 'rejected';

    // تحديد الـ stage الحالي (index)
    var currentIndex = STAGES_ORDER.findIndex(function (s) { return s.key === currentStage; });
    if (isRejected) currentIndex = STAGES_ORDER.length; // بعد كل المراحل

    var itemsHtml = '';

    STAGES_ORDER.forEach(function (stage, index) {
      var isCompleted = index < currentIndex;
      var isCurrent = index === currentIndex;
      var isFinal = stage.key === 'approved' && currentStage === 'approved';

      // في حالة rejected → كل المراحل اللي عدت تبقى completed
      if (isRejected && index <= currentIndex - 1) {
        isCompleted = true;
        isCurrent = false;
      }

      if (isFinal) {
        isCompleted = true;
        isCurrent = false;
      }

      // البحث عن تاريخ المرحلة في history
      var historyEntry = history.find(function (h) {
        return h.to_stage === stage.key;
      });

      var dateText = historyEntry ? formatDateTime(historyEntry.moved_at) : (isCompleted ? 'تم' : '—');
      var notes = historyEntry && historyEntry.notes ? historyEntry.notes : null;

      var itemCls = 'timeline-item';
      if (isCompleted) itemCls += ' completed';
      if (isCurrent) itemCls += ' current';
      if (isRejected && index === currentIndex) itemCls += ' rejected';

      itemsHtml += '' +
        '<div class="' + itemCls + '">' +
          '<div class="timeline-header">' +
            '<div class="timeline-stage">' + escapeHtml(stage.label) + '</div>' +
            '<div class="timeline-date">' + dateText + '</div>' +
          '</div>' +
          '<p class="timeline-desc">' + escapeHtml(stage.desc) + '</p>' +
          (notes ? '<div class="timeline-notes">' + escapeHtml(notes) + '</div>' : '') +
        '</div>';
    });

    // إضافة rejected في النهاية لو الطلب مرفوض
    if (isRejected) {
      var rejectedEntry = history.find(function (h) { return h.to_stage === 'rejected'; });
      var rejectedDate = rejectedEntry ? formatDateTime(rejectedEntry.moved_at) : formatDate(request.decided_at);
      var rejectedNotes = request.rejection_reason || (rejectedEntry && rejectedEntry.notes);

      itemsHtml += '' +
        '<div class="timeline-item rejected">' +
          '<div class="timeline-header">' +
            '<div class="timeline-stage">مرفوض</div>' +
            '<div class="timeline-date">' + rejectedDate + '</div>' +
          '</div>' +
          '<p class="timeline-desc">تم رفض طلب الاعتماد</p>' +
          (rejectedNotes ? '<div class="timeline-notes rejected">' + escapeHtml(rejectedNotes) + '</div>' : '') +
        '</div>';
    }

    return '<div class="timeline">' + itemsHtml + '</div>';
  }

  // ============================================
  // 8. Render Academy Info
  // ============================================
  function renderAcademyInfo(academy) {
    return '' +
      '<div class="info-grid">' +
        '<div class="info-card">' +
          '<div class="info-card-header">' +
            '<div class="info-card-icon">' +
              '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">' +
                '<path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"></path>' +
              '</svg>' +
            '</div>' +
            '<h3 class="info-card-title">بيانات الأكاديمية</h3>' +
          '</div>' +
          '<div class="info-list">' +
            '<div class="info-item">' +
              '<span class="info-item-label">الاسم</span>' +
              '<span class="info-item-value">' + escapeHtml(academy.name || '—') + '</span>' +
            '</div>' +
            '<div class="info-item">' +
              '<span class="info-item-label">المالك</span>' +
              '<span class="info-item-value">' + escapeHtml(academy.owner_name || '—') + '</span>' +
            '</div>' +
            '<div class="info-item">' +
              '<span class="info-item-label">سنة التأسيس</span>' +
              '<span class="info-item-value">' + escapeHtml(String(academy.founded_year || '—')) + '</span>' +
            '</div>' +
            '<div class="info-item">' +
              '<span class="info-item-label">البطاقة الضريبية</span>' +
              '<span class="info-item-value mono">' + escapeHtml(academy.tax_number || '—') + '</span>' +
            '</div>' +
            '<div class="info-item">' +
              '<span class="info-item-label">السجل التجاري</span>' +
              '<span class="info-item-value mono">' + escapeHtml(academy.commercial_registry || '—') + '</span>' +
            '</div>' +
            (academy.license_number ? '<div class="info-item">' +
              '<span class="info-item-label">رقم الاعتماد</span>' +
              '<span class="info-item-value mono">' + escapeHtml(academy.license_number) + '</span>' +
            '</div>' : '') +
          '</div>' +
        '</div>' +
        '<div class="info-card">' +
          '<div class="info-card-header">' +
            '<div class="info-card-icon">' +
              '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">' +
                '<path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"></path>' +
              '</svg>' +
            '</div>' +
            '<h3 class="info-card-title">بيانات الاتصال</h3>' +
          '</div>' +
          '<div class="info-list">' +
            '<div class="info-item">' +
              '<span class="info-item-label">البريد الإلكتروني</span>' +
              '<span class="info-item-value" style="font-size:11px;">' + escapeHtml(academy.email || '—') + '</span>' +
            '</div>' +
            '<div class="info-item">' +
              '<span class="info-item-label">الهاتف</span>' +
              '<span class="info-item-value mono">' + escapeHtml(academy.phone || '—') + '</span>' +
            '</div>' +
            '<div class="info-item">' +
              '<span class="info-item-label">تاريخ التقديم</span>' +
              '<span class="info-item-value">' + formatDate(academy.created_at) + '</span>' +
            '</div>' +
          '</div>' +
        '</div>' +
      '</div>';
  }

  // ============================================
  // 9. Render Documents
  // ============================================
  function renderDocuments(request) {
    var docs = [
      { name: 'السجل التجاري', key: 'commercial_registry_url', required: true },
      { name: 'البطاقة الضريبية', key: 'tax_card_url', required: true },
      { name: 'صورة المكان', key: 'place_photo_url', required: true },
      { name: 'إيصال التحويل', key: 'payment_receipt_url', required: false }
    ];

    var itemsHtml = docs.map(function (doc) {
      var url = request[doc.key];
      var isUploaded = !!url;
      var statusText = isUploaded ? 'تم الرفع' : (doc.required ? 'مفقود' : 'اختياري');
      var statusCls = isUploaded ? 'uploaded' : (doc.required ? 'missing' : '');

      return '' +
        '<div class="document-item">' +
          '<div class="document-icon">' +
            '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">' +
              '<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>' +
              '<polyline points="14 2 14 8 20 8"></polyline>' +
            '</svg>' +
          '</div>' +
          '<div class="document-info">' +
            '<div class="document-name">' + escapeHtml(doc.name) + '</div>' +
            '<div class="document-status ' + statusCls + '">' + statusText + '</div>' +
          '</div>' +
          (isUploaded ? '<a href="' + escapeHtml(url) + '" target="_blank" rel="noopener noreferrer" class="document-action" title="عرض">' +
            '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">' +
              '<path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path>' +
              '<circle cx="12" cy="12" r="3"></circle>' +
            '</svg>' +
          '</a>' : '') +
        '</div>';
    }).join('');

    return '' +
      '<div class="info-card" style="margin-bottom:24px;">' +
        '<div class="info-card-header">' +
          '<div class="info-card-icon">' +
            '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">' +
              '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>' +
              '<polyline points="17 8 12 3 7 8"></polyline>' +
              '<line x1="12" y1="3" x2="12" y2="15"></line>' +
            '</svg>' +
          '</div>' +
          '<h3 class="info-card-title">المستندات المرفوعة</h3>' +
        '</div>' +
        '<div class="documents-grid">' + itemsHtml + '</div>' +
      '</div>';
  }

  // ============================================
  // 10. Show Error
  // ============================================
  function showError(title, text) {
    var loader = $('trackLoader');
    var error = $('trackError');
    var result = $('trackResult');

    if (loader) loader.classList.remove('show');
    if (result) result.classList.remove('show');
    if (error) {
      error.classList.add('show');
      setText('errorTitle', title);
      setText('errorText', text);
    }
  }

  // ============================================
  // 11. Perform Search
  // ============================================
  function performSearch(requestNumber) {
    if (!requestNumber) {
      toast('أدخل رقم الطلب', 'error');
      return;
    }

    if (state.loading) return;
    state.loading = true;

    var loader = $('trackLoader');
    var error = $('trackError');
    var result = $('trackResult');
    var btn = $('trackBtn');

    if (loader) loader.classList.add('show');
    if (error) error.classList.remove('show');
    if (result) result.classList.remove('show');
    if (btn) { btn.disabled = true; btn.textContent = 'جاري البحث...'; }

    state.requestNumber = requestNumber;
    state.request = null;
    state.academy = null;
    state.history = [];

    loadRequest(requestNumber)
      .then(function (request) {
        if (!request) {
          if (loader) loader.classList.remove('show');
          if (btn) { btn.disabled = false; btn.textContent = 'متابعة'; }
          showError('لم يتم العثور على الطلب', 'تأكد من رقم الطلب أو تواصل مع النقابة.');
          logSearch(requestNumber, 0);
          state.loading = false;
          return;
        }

        state.request = request;

        // Load academy + history in parallel
        return Promise.all([
          loadAcademy(request.academy_id),
          loadHistory(request.id)
        ]).then(function (results) {
          state.academy = results[0];
          state.history = results[1] || [];

          if (loader) loader.classList.remove('show');
          if (btn) { btn.disabled = false; btn.textContent = 'متابعة'; }

          renderResult();
          logSearch(requestNumber, 1);
          state.loading = false;
        });
      })
      .catch(function (err) {
        if (loader) loader.classList.remove('show');
        if (btn) { btn.disabled = false; btn.textContent = 'متابعة'; }
        showError('حدث خطأ', err.message || 'يرجى المحاولة مرة أخرى.');
        logDebug('Search error:', err.message);
        state.loading = false;
      });
  }

  // ============================================
  // 12. Handle Submit
  // ============================================
  function handleSubmit(e) {
    if (e) e.preventDefault();
    var input = $('requestNumberInput');
    var value = input ? input.value.trim().toUpperCase() : '';
    if (!value) {
      toast('أدخل رقم الطلب', 'error');
      if (input) input.focus();
      return false;
    }
    performSearch(value);
    return false;
  }

  // ============================================
  // 13. Init
  // ============================================
  function init() {
    if (state.initialized) return;
    state.initialized = true;

    // Footer
    setText('footerCopyright', getSetting('app_identity.footer_text', '© 2026 نقابة تكنولوجيا المعلومات'));
    setText('footerPresidentLabel', getSetting('app_identity.president_label', 'النقيب العام:'));
    setText('footerPresidentName', getSetting('app_identity.president_name', 'المحاسب / محمود جميل'));

    // Form
    var form = $('trackForm');
    if (form) form.addEventListener('submit', handleSubmit);

    // Input formatting
    var input = $('requestNumberInput');
    if (input) {
      input.addEventListener('input', function () {
        this.value = this.value.toUpperCase();
      });
      input.addEventListener('keydown', function (e) {
        if (e.key === 'Enter') { e.preventDefault(); handleSubmit(); }
      });
    }

    // AppSettings changes
    if (window.AppSettings && window.AppSettings.onChange) {
      window.AppSettings.onChange(function (cache, key) {
        if (!key || key === 'app_identity') {
          setText('footerCopyright', getSetting('app_identity.footer_text', '© 2026 نقابة تكنولوجيا المعلومات'));
          setText('footerPresidentLabel', getSetting('app_identity.president_label', 'النقيب العام:'));
          setText('footerPresidentName', getSetting('app_identity.president_name', 'المحاسب / محمود جميل'));
        }
      });
    }

    // Auto-load from URL: ?request=REQ-2026-XXXX
    var params = new URLSearchParams(window.location.search);
    var reqNum = params.get('request') || params.get('number');
    if (reqNum) {
      if (input) input.value = reqNum.toUpperCase();
      setTimeout(function () { performSearch(reqNum.toUpperCase()); }, 400);
    }

    logDebug('Track page initialized');
  }

  // ============================================
  // 14. Public API
  // ============================================
  window.TrackPage = {
    initialized: true,
    init: init,
    search: performSearch,
    getState: function () { return state; }
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

})();
