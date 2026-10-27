/* ============================================================
   ITWS Platform — Track Accreditation Request Page Logic
   File: assets/js/pages/track.js
   Role: Search by request number, render timeline + stages + SLA
   Rules: No emoji, all from settings, no sensitive data leaks
   ============================================================ */
(function () {
  'use strict';

  if (window.TrackPage && window.TrackPage.initialized) return;

  var state = {
    initialized: false,
    searching: false,
    lastRequest: null,
    lastStages: [],
    lastAcademy: null,
    lastQuery: '',
    sb: null
  };

  // Fixed stage order — mirrors DB schema
  var STAGE_ORDER = ['submitted', 'documents_review', 'site_visit', 'committee_review', 'final_approval'];

  // Default stage labels — overridden by accreditation.stages from settings
  var DEFAULT_STAGE_LABELS = {
    submitted: 'تم التقديم',
    documents_review: 'مراجعة المستندات',
    site_visit: 'زيارة الموقع',
    committee_review: 'لجنة المراجعة',
    final_approval: 'الموافقة النهائية',
    approved: 'معتمدة',
    rejected: 'مرفوضة'
  };

  // Default SLA — overridden by accreditation.sla_days from settings
  var DEFAULT_SLA_DAYS = {
    submitted: 3,
    documents_review: 3,
    site_visit: 14,
    committee_review: 7,
    final_approval: 5
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

  function show(el) { if (el) el.classList.add('show'); }
  function hide(el) { if (el) el.classList.remove('show'); }

  // Tries multiple field names — schema-tolerant
  function pickField(obj, keys) {
    if (!obj) return null;
    for (var i = 0; i < keys.length; i++) {
      var k = keys[i];
      if (obj[k] !== undefined && obj[k] !== null && obj[k] !== '') {
        return obj[k];
      }
    }
    return null;
  }

  function formatDate(d) {
    if (!d) return '';
    try {
      var dt = new Date(d);
      if (isNaN(dt.getTime())) return String(d);
      var y = dt.getFullYear();
      var m = String(dt.getMonth() + 1).padStart(2, '0');
      var day = String(dt.getDate()).padStart(2, '0');
      var hh = String(dt.getHours()).padStart(2, '0');
      var mm = String(dt.getMinutes()).padStart(2, '0');
      return day + '/' + m + '/' + y + ' — ' + hh + ':' + mm;
    } catch (e) {
      return String(d);
    }
  }

  function daysBetween(a, b) {
    if (!a || !b) return 0;
    var d1 = new Date(a);
    var d2 = new Date(b);
    if (isNaN(d1.getTime()) || isNaN(d2.getTime())) return 0;
    return Math.floor((d2 - d1) / (1000 * 60 * 60 * 24));
  }

  function getStageLabel(stage) {
    var stages = getSetting('accreditation.stages', {}) || {};
    if (stages && stages[stage]) return stages[stage];
    return DEFAULT_STAGE_LABELS[stage] || stage;
  }

  function getSlaDays(stage) {
    var sla = getSetting('accreditation.sla_days', {}) || {};
    if (sla && typeof sla[stage] === 'number') return sla[stage];
    return DEFAULT_SLA_DAYS[stage] || 5;
  }

  /* ---------------- Icons ---------------- */
  var ICONS = {
    clock: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline></svg>',
    check: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>',
    x: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>',
    timeline: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline></svg>',
    academy: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"></path><polyline points="9 22 9 12 15 12 15 22"></polyline></svg>',
    doc: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline></svg>',
    download: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="7 10 12 15 17 10"></polyline><line x1="12" y1="15" x2="12" y2="3"></line></svg>',
    badgeCheck: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path><polyline points="22 4 12 14.01 9 11.01"></polyline></svg>',
    alert: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="8" x2="12" y2="12"></line><line x1="12" y1="16" x2="12.01" y2="16"></line></svg>'
  };

  /* ---------------- Dynamic texts ---------------- */
  function applyDynamicTexts() {
    var badge = $('[data-dynamic="track_badge"]');
    if (badge) {
      var b = getSetting('app_identity.track_badge', '');
      if (b) badge.textContent = b;
    }

    var label = $('[data-dynamic="track_search_label"]');
    if (label) {
      var l = getSetting('app_identity.track_search_label', '');
      if (l) label.textContent = l;
    }

    var btn = $('[data-dynamic="track_btn"]');
    if (btn) {
      var bt = getSetting('app_identity.track_button_text', '');
      if (bt) btn.textContent = bt;
    }

    var hint = $('[data-dynamic="track_hint"]');
    if (hint) {
      var h = getSetting('app_identity.track_hint', '');
      if (h) hint.textContent = h;
    }

    var input = $('#requestNumberInput');
    if (input) {
      var pattern = getSetting('accreditation.request_code_pattern', '');
      if (pattern) input.setAttribute('placeholder', pattern);
    }
  }

  /* ---------------- Fetch helpers ---------------- */
  function fetchRequest(code) {
    var sb = getSb();
    if (!sb) return Promise.reject(new Error('تعذر الاتصال بالخادم'));

    return sb.from('accreditation_requests')
      .select('*')
      .eq('request_number', code)
      .maybeSingle()
      .then(function (res) {
        if (res.error) throw new Error(res.error.message);
        return res.data;
      });
  }

  function fetchStages(requestId) {
    var sb = getSb();
    if (!sb) return Promise.resolve([]);

    return sb.from('request_stage_history')
      .select('*')
      .eq('request_id', requestId)
      .order('created_at', { ascending: true })
      .then(function (res) {
        if (res.error) {
          console.warn('[Track] stages fetch failed:', res.error.message);
          return [];
        }
        return res.data || [];
      })
      .catch(function (e) {
        console.warn('[Track] stages fetch error:', e && e.message);
        return [];
      });
  }

  function fetchAcademy(academyId) {
    if (!academyId) return Promise.resolve(null);
    var sb = getSb();
    if (!sb) return Promise.resolve(null);

    return sb.from('academies')
      .select('id, name, logo_url, contact_email, contact_phone, city, address, status')
      .eq('id', academyId)
      .maybeSingle()
      .then(function (res) {
        if (res.error) return null;
        return res.data || null;
      })
      .catch(function () { return null; });
  }

  /* ---------------- Log search ---------------- */
  function logSearch(code, found) {
    var sb = getSb();
    if (!sb) return;

    var safeCode = code ? String(code).slice(0, 5) + '***' : null;

    Promise.resolve().then(function () {
      return sb.from('search_logs').insert({
        search_type: 'request_track',
        search_query: safeCode,
        found: !!found,
        user_agent: navigator.userAgent.substring(0, 200)
      });
    }).catch(function (e) {
      console.warn('[Track] log search failed:', (e && e.message) || e);
    });
  }

  /* ---------------- SLA calculation ---------------- */
  function getSlaInfo(stage, stageEnteredAt, currentStage) {
    if (!stageEnteredAt) return null;

    var slaDays = getSlaDays(stage);
    if (!slaDays) return null;

    // If stage is finished (we've moved past it), SLA doesn't matter anymore
    var isCurrent = (stage === currentStage);
    if (!isCurrent) return null;

    var elapsed = daysBetween(stageEnteredAt, new Date());
    var remaining = slaDays - elapsed;

    if (remaining < 0) {
      return {
        class: 'overdue',
        text: 'متأخر ' + Math.abs(remaining) + ' يوم'
      };
    }
    if (remaining <= 2) {
      return {
        class: 'warning',
        text: 'متبقي ' + remaining + ' يوم'
      };
    }
    return {
      class: 'on-time',
      text: 'في الموعد'
    };
  }

  /* ---------------- Status badge ---------------- */
  function renderStatusBadge(status) {
    var label = getStageLabel(status) || status || '—';
    return '<span class="request-status-badge ' + escapeHtml(status) + '">' +
      '<span class="request-status-dot" aria-hidden="true"></span>' +
      '<span>' + escapeHtml(label) + '</span>' +
    '</span>';
  }

  /* ---------------- Request Header Card ---------------- */
  function renderRequestHeader(request, academy) {
    var requestNumber = pickField(request, ['request_number', 'tracking_code', 'code']) || '—';
    var academyName = (academy && academy.name)
      || pickField(request, ['academy_name', 'academy'])
      || '—';
    var status = pickField(request, ['status', 'current_status']) || 'submitted';
    var currentStage = pickField(request, ['current_stage', 'stage']) || status;
    var submittedAt = pickField(request, ['submitted_at', 'created_at']);
    var updatedAt = pickField(request, ['updated_at']);

    var slaInfo = getSlaInfo(currentStage, updatedAt || submittedAt, currentStage);

    return '<div class="request-header-card">' +
      '<div class="request-header-top">' +
        '<div class="request-title-box">' +
          '<div class="request-number">' + escapeHtml(requestNumber) + '</div>' +
          '<h1 class="request-academy-name">' + escapeHtml(academyName) + '</h1>' +
        '</div>' +
        renderStatusBadge(status) +
      '</div>' +
      '<div class="request-meta-grid">' +
        renderMetaItem('رقم الطلب', requestNumber, 'mono') +
        renderMetaItem('تاريخ التقديم', formatDate(submittedAt)) +
        (updatedAt ? renderMetaItem('آخر تحديث', formatDate(updatedAt)) : '') +
        renderMetaItemWithSla('المرحلة الحالية', getStageLabel(currentStage), slaInfo) +
      '</div>' +
    '</div>';
  }

  function renderMetaItem(label, value, valueClass) {
    return '<div class="request-meta-item">' +
      '<div class="request-meta-label">' + escapeHtml(label) + '</div>' +
      '<div class="request-meta-value' + (valueClass ? ' ' + valueClass : '') + '">' +
        escapeHtml(value || '—') +
      '</div>' +
    '</div>';
  }

  function renderMetaItemWithSla(label, value, slaInfo) {
    var slaHtml = slaInfo
      ? '<div class="request-sla-badge ' + slaInfo.class + '">' + escapeHtml(slaInfo.text) + '</div>'
      : '';
    return '<div class="request-meta-item">' +
      '<div class="request-meta-label">' + escapeHtml(label) + '</div>' +
      '<div class="request-meta-value">' + escapeHtml(value || '—') + '</div>' +
      slaHtml +
    '</div>';
  }

  /* ---------------- Timeline ---------------- */
  function buildTimeline(request, stageHistory) {
    var currentStage = pickField(request, ['current_stage', 'stage']) || pickField(request, ['status']);
    var finalStatus = pickField(request, ['status']);

    // Build a map of stage → history entry
    var historyMap = {};
    (stageHistory || []).forEach(function (h) {
      var stage = pickField(h, ['stage', 'stage_name', 'to_stage']);
      if (stage) historyMap[stage] = h;
    });

    var items = [];

    // Render fixed stages in order
    STAGE_ORDER.forEach(function (stage, idx) {
      var history = historyMap[stage];
      var isCompleted = false;
      var isCurrent = false;
      var isRejected = false;
      var date = null;
      var notes = null;

      // Check status field
      if (history) {
        var histStatus = pickField(history, ['status']) || '';
        if (histStatus === 'completed' || histStatus === 'done') isCompleted = true;
        else if (histStatus === 'rejected') isRejected = true;
        else if (histStatus === 'current' || histStatus === 'in_progress') isCurrent = true;
        date = pickField(history, ['completed_at', 'created_at', 'updated_at']);
        notes = pickField(history, ['notes', 'comment', 'reason']);
      }

      // Compare against current stage if not from history
      if (!history && currentStage) {
        var currentIdx = STAGE_ORDER.indexOf(currentStage);
        if (currentIdx > idx) isCompleted = true;
        else if (currentIdx === idx) isCurrent = true;
      }

      // If final status is rejected, mark rejected stage
      if (finalStatus === 'rejected' && (currentStage === stage || isRejected)) {
        isRejected = true;
        isCurrent = false;
      }

      var cls = 'timeline-item';
      if (isCompleted) cls += ' completed';
      if (isCurrent) cls += ' current';
      if (isRejected) cls += ' rejected';

      items.push(
        '<div class="' + cls + '">' +
          '<div class="timeline-header">' +
            '<span class="timeline-stage">' + escapeHtml(getStageLabel(stage)) + '</span>' +
            (date ? '<span class="timeline-date">' + escapeHtml(formatDate(date)) + '</span>' : '') +
          '</div>' +
          (isRejected
            ? '<p class="timeline-desc">تم رفض الطلب في هذه المرحلة</p>'
            : isCurrent
              ? '<p class="timeline-desc">المرحلة الحالية — جاري المراجعة</p>'
              : isCompleted
                ? '<p class="timeline-desc">تم اجتياز هذه المرحلة</p>'
                : '<p class="timeline-desc">لم تبدأ بعد</p>') +
          (notes ? '<div class="timeline-notes' + (isRejected ? ' rejected' : '') + '">' + escapeHtml(notes) + '</div>' : '') +
        '</div>'
      );
    });

    // Add approval/rejection terminal stage if applicable
    if (finalStatus === 'approved') {
      var approvalDate = pickField(request, ['approved_at', 'updated_at']);
      items.push(
        '<div class="timeline-item completed">' +
          '<div class="timeline-header">' +
            '<span class="timeline-stage">' + escapeHtml(getStageLabel('approved')) + '</span>' +
            (approvalDate ? '<span class="timeline-date">' + escapeHtml(formatDate(approvalDate)) + '</span>' : '') +
          '</div>' +
          '<p class="timeline-desc">تم اعتماد الأكاديمية رسمياً</p>' +
        '</div>'
      );
    } else if (finalStatus === 'rejected') {
      var rejectDate = pickField(request, ['rejected_at', 'updated_at']);
      var rejectReason = pickField(request, ['rejection_reason', 'reject_reason']);
      items.push(
        '<div class="timeline-item rejected">' +
          '<div class="timeline-header">' +
            '<span class="timeline-stage">' + escapeHtml(getStageLabel('rejected')) + '</span>' +
            (rejectDate ? '<span class="timeline-date">' + escapeHtml(formatDate(rejectDate)) + '</span>' : '') +
          '</div>' +
          '<p class="timeline-desc">تم رفض الطلب</p>' +
          (rejectReason ? '<div class="timeline-notes rejected">' + escapeHtml(rejectReason) + '</div>' : '') +
        '</div>'
      );
    }

    return '<div class="timeline-card">' +
      '<h2 class="timeline-title">' + ICONS.timeline + '<span>مراحل الطلب</span></h2>' +
      '<div class="timeline">' + items.join('') + '</div>' +
    '</div>';
  }

  /* ---------------- Approved/Rejected Banners ---------------- */
  function renderBanners(request) {
    var status = pickField(request, ['status']);
    var out = '';

    if (status === 'approved') {
      var approvedAt = pickField(request, ['approved_at', 'updated_at']);
      out += '<div class="approved-banner">' +
        '<div class="approved-banner-icon" aria-hidden="true">' + ICONS.badgeCheck + '</div>' +
        '<div class="approved-banner-content">' +
          '<h2 class="approved-banner-title">تم اعتماد أكاديميتك</h2>' +
          '<p class="approved-banner-text">' +
            'تهانينا! تم اعتماد الأكاديمية رسمياً من النقابة' +
            (approvedAt ? ' بتاريخ ' + escapeHtml(formatDate(approvedAt)) : '') +
            '. يمكنك الآن إصدار الشهادات والاستفادة من خدمات النقابة.' +
          '</p>' +
        '</div>' +
      '</div>';
    } else if (status === 'rejected') {
      var reason = pickField(request, ['rejection_reason', 'reject_reason']);
      out += '<div class="rejected-banner">' +
        '<div class="rejected-banner-icon" aria-hidden="true">' + ICONS.x + '</div>' +
        '<div class="rejected-banner-content">' +
          '<h2 class="rejected-banner-title">تم رفض الطلب</h2>' +
          '<p class="rejected-banner-text">' +
            (reason ? escapeHtml(reason) : 'يرجى التواصل مع النقابة لمعرفة أسباب الرفض وإمكانية إعادة التقديم.') +
          '</p>' +
        '</div>' +
      '</div>';
    }

    return out;
  }

  /* ---------------- Info Cards ---------------- */
  function renderInfoCards(request, academy) {
    var academyName = (academy && academy.name)
      || pickField(request, ['academy_name'])
      || '—';
    var contactEmail = (academy && academy.contact_email)
      || pickField(request, ['contact_email'])
      || '';
    var contactPhone = (academy && academy.contact_phone)
      || pickField(request, ['contact_phone'])
      || '';
    var city = (academy && academy.city)
      || pickField(request, ['city'])
      || '';
    var address = (academy && academy.address)
      || pickField(request, ['address'])
      || '';

    var academyCard = '<div class="info-card">' +
      '<div class="info-card-header">' +
        '<div class="info-card-icon" aria-hidden="true">' + ICONS.academy + '</div>' +
        '<h3 class="info-card-title">بيانات الأكاديمية</h3>' +
      '</div>' +
      '<div class="info-list">' +
        renderInfoItem('الاسم', academyName) +
        (city ? renderInfoItem('المدينة', city) : '') +
        (address ? renderInfoItem('العنوان', address) : '') +
        (contactEmail ? renderInfoItem('البريد', contactEmail, 'mono') : '') +
        (contactPhone ? renderInfoItem('الهاتف', contactPhone, 'mono') : '') +
      '</div>' +
    '</div>';

    return '<div class="info-grid">' + academyCard + '</div>';
  }

  function renderInfoItem(label, value, valueClass) {
    return '<div class="info-item">' +
      '<span class="info-item-label">' + escapeHtml(label) + '</span>' +
      '<span class="info-item-value' + (valueClass ? ' ' + valueClass : '') + '">' +
        escapeHtml(value || '—') +
      '</span>' +
    '</div>';
  }

  /* ---------------- Documents (optional) ---------------- */
  function renderDocuments(request) {
    // Try to read documents list — field name varies
    var docs = pickField(request, ['documents', 'attachments', 'files']);
    if (!docs) return '';

    var arr = [];
    if (Array.isArray(docs)) arr = docs;
    else if (typeof docs === 'object') {
      Object.keys(docs).forEach(function (k) {
        arr.push({ name: k, url: docs[k], uploaded: !!docs[k] });
      });
    }

    if (!arr.length) return '';

    var itemsHtml = arr.map(function (d) {
      var name = d.name || d.label || 'مستند';
      var url = d.url || d.link || '';
      var uploaded = !!url;
      var statusText = uploaded ? 'مرفوع' : 'مفقود';
      var statusClass = uploaded ? 'uploaded' : 'missing';

      return '<div class="document-item">' +
        '<div class="document-icon" aria-hidden="true">' + ICONS.doc + '</div>' +
        '<div class="document-info">' +
          '<div class="document-name">' + escapeHtml(name) + '</div>' +
          '<div class="document-status ' + statusClass + '">' + statusText + '</div>' +
        '</div>' +
        (uploaded
          ? '<a href="' + escapeHtml(url) + '" target="_blank" rel="noopener" class="document-action" aria-label="تحميل">' + ICONS.download + '</a>'
          : '') +
      '</div>';
    }).join('');

    return '<div class="timeline-card">' +
      '<h2 class="timeline-title">' + ICONS.doc + '<span>المستندات</span></h2>' +
      '<div class="documents-grid">' + itemsHtml + '</div>' +
    '</div>';
  }

  /* ---------------- Main render ---------------- */
  function renderRequest(request, stages, academy) {
    var container = $('#trackResult');
    if (!container) return;

    var status = pickField(request, ['status']);
    var html = '';

    // Banners first (approved/rejected)
    html += renderBanners(request);

    // Header card
    html += renderRequestHeader(request, academy);

    // Info cards
    html += renderInfoCards(request, academy);

    // Timeline
    html += buildTimeline(request, stages || []);

    // Documents (optional)
    html += renderDocuments(request);

    container.innerHTML = html;
  }

  /* ---------------- Error / State ---------------- */
  function showError(title, text) {
    var errEl = $('#trackError');
    var titleEl = $('#errorTitle');
    var textEl = $('#errorText');
    if (titleEl) titleEl.textContent = title || 'لم يتم العثور على الطلب';
    if (textEl) textEl.textContent = text || 'تأكد من رقم الطلب أو تواصل مع النقابة';
    if (errEl) errEl.classList.add('show');
    hide($('#trackLoader'));
    hide($('#trackResult'));
  }

  function hideAllStates() {
    hide($('#trackError'));
    hide($('#trackLoader'));
    hide($('#trackResult'));
  }

  /* ---------------- Main search ---------------- */
  function searchRequest(rawCode) {
    if (state.searching) return;

    var code = String(rawCode || '').trim().toUpperCase();
    if (!code) {
      showError('الرجاء إدخال رقم الطلب', 'رقم الطلب مطلوب للمتابعة');
      return;
    }

    if (code.length < 4) {
      showError('رقم غير صحيح', 'رقم الطلب يجب أن يكون 4 أحرف على الأقل');
      return;
    }

    state.searching = true;
    state.lastQuery = code;

    hideAllStates();
    var loader = $('#trackLoader');
    if (loader) loader.classList.add('show');

    var trackBtn = $('#trackBtn');
    if (trackBtn) {
      trackBtn.disabled = true;
      trackBtn.textContent = 'جاري البحث...';
    }

    // Update URL
    try {
      var url = new URL(window.location.href);
      url.searchParams.set('req', code);
      window.history.replaceState({}, '', url.toString());
    } catch (e) {}

    fetchRequest(code)
      .then(function (request) {
        if (!request) {
          showError('لم يتم العثور على الطلب', 'تأكد من رقم الطلب أو تواصل مع النقابة');
          logSearch(code, false);
          return;
        }

        state.lastRequest = request;

        var academyId = pickField(request, ['academy_id']);
        var requestId = pickField(request, ['id', 'request_id']);

        return Promise.all([
          fetchStages(requestId),
          fetchAcademy(academyId)
        ]).then(function (results) {
          var stages = results[0] || [];
          var academy = results[1] || null;

          state.lastStages = stages;
          state.lastAcademy = academy;

          hide($('#trackError'));
          hide($('#trackLoader'));

          renderRequest(request, stages, academy);

          var resultEl = $('#trackResult');
          if (resultEl) resultEl.classList.add('show');

          logSearch(code, true);
        });
      })
      .catch(function (err) {
        var msg = (err && err.message) || 'حدث خطأ أثناء البحث';
        showError('تعذر البحث', msg);
        logSearch(code, false);
      })
      .then(function () {
        state.searching = false;
        if (trackBtn) {
          trackBtn.disabled = false;
          trackBtn.textContent = getSetting('app_identity.track_button_text', 'متابعة');
        }
      });
  }

  /* ---------------- Events ---------------- */
  function bindEvents() {
    var form = $('#trackForm');
    if (form) {
      form.addEventListener('submit', function (e) {
        e.preventDefault();
        var input = $('#requestNumberInput');
        searchRequest(input ? input.value : '');
      });
    }

    var input = $('#requestNumberInput');
    if (input) {
      input.addEventListener('input', function () {
        var pos = input.selectionStart;
        var upper = input.value.toUpperCase();
        if (input.value !== upper) {
          input.value = upper;
          try { input.setSelectionRange(pos, pos); } catch (e) {}
        }
      });

      input.addEventListener('keydown', function (e) {
        if (e.key === 'Enter') {
          e.preventDefault();
          searchRequest(input.value);
        }
      });
    }
  }

  /* ---------------- URL auto-search ---------------- */
  function readFromUrl() {
    try {
      var params = new URLSearchParams(window.location.search);
      var code = params.get('req') || params.get('code');
      if (code) {
        var input = $('#requestNumberInput');
        if (input) input.value = code.toUpperCase();
        searchRequest(code);
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

    if (window.AppSettings && typeof window.AppSettings.onChange === 'function') {
      try {
        window.AppSettings.onChange(function () {
          applyDynamicTexts();
        });
      } catch (e) {}
    }

    setTimeout(applyDynamicTexts, 600);
    setTimeout(applyDynamicTexts, 1800);

    setTimeout(function () {
      readFromUrl();
    }, 400);
  }

  window.TrackPage = {
    initialized: true,
    init: init,
    search: searchRequest,
    refresh: applyDynamicTexts,
    getState: function () { return state; }
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
