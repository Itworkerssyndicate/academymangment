// ============================================
// ITWS Platform - Admin Request Details Logic
// Path: assets/js/pages/admin/request-details.js
// ============================================
// تفاصيل طلب اعتماد + تحريك المراحل + اعتماد/رفض
// بدون إيموجي
// ============================================

(function () {
  'use strict';

  if (window.AdminRequestDetails && window.AdminRequestDetails.initialized) return;

  var STAGES_ORDER = [
    { key: 'submitted', label: 'تم التقديم', desc: 'تم استلام طلب الاعتماد' },
    { key: 'documents_review', label: 'مراجعة المستندات', desc: 'مراجعة المستندات المرفوعة' },
    { key: 'site_visit', label: 'زيارة الموقع', desc: 'زيارة ميدانية للتحقق' },
    { key: 'committee_review', label: 'لجنة المراجعة', desc: 'عرض الطلب على اللجنة' },
    { key: 'final_approval', label: 'الموافقة النهائية', desc: 'المراجعة النهائية من النقيب' },
    { key: 'approved', label: 'تم الاعتماد', desc: 'الأكاديمية معتمدة رسمياً' }
  ];

  var state = {
    requestId: null,
    request: null,
    academy: null,
    history: [],
    currentUser: null,
    loading: false,
    submitting: false,
    initialized: false
  };

  // ============ Helpers ============
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
      return d.toLocaleDateString('ar-EG', opts || { year: 'numeric', month: 'short', day: 'numeric' });
    } catch (e) { return '—'; }
  }

  function formatDateTime(date) {
    if (!date) return '—';
    try {
      var d = date instanceof Date ? date : new Date(date);
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
      console.log.apply(console, ['[AdminRequestDetails]'].concat(Array.prototype.slice.call(arguments)));
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

  function getSetting(p, f) {
    if (window.AppSettings && window.AppSettings.get) {
      return window.AppSettings.get(p, f);
    }
    return f;
  }

  function translateStage(stage) {
    var m = {};
    STAGES_ORDER.forEach(function (s) { m[s.key] = s.label; });
    m.rejected = 'مرفوضة';
    return m[stage] || stage || '—';
  }

  // ============ SLA ============
  function getSlaDays(stage) {
    var slaDays = getSetting('accreditation.sla_days', {
      submitted: 3, documents_review: 3, site_visit: 14,
      committee_review: 7, final_approval: 5
    });
    return slaDays[stage] || 7;
  }

  function calculateSLA(req) {
    var stage = req.current_stage;
    if (!stage || stage === 'approved' || stage === 'rejected') {
      return { status: 'done', daysRemaining: null };
    }
    var slaDays = getSlaDays(stage);
    var enteredAt = req.updated_at || req.submitted_at;
    if (!enteredAt) return { status: 'on-time', daysRemaining: slaDays };

    try {
      var d = new Date(enteredAt);
      if (isNaN(d.getTime())) return { status: 'on-time', daysRemaining: slaDays };
      var elapsedDays = (Date.now() - d.getTime()) / 86400000;
      var remaining = slaDays - elapsedDays;
      var status = remaining < 0 ? 'overdue' : (remaining < slaDays * 0.3 ? 'warning' : 'on-time');
      return { status: status, daysRemaining: Math.ceil(remaining) };
    } catch (e) {
      return { status: 'on-time', daysRemaining: slaDays };
    }
  }

  // ============ Load Data ============
  function loadRequest(id) {
    if (!window.sb) return Promise.reject(new Error('Supabase not available'));
    return window.sb
      .from('accreditation_requests')
      .select('*')
      .eq('id', id)
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
      .select('*')
      .eq('id', academyId)
      .maybeSingle()
      .then(function (res) { return res.data || null; })
      .catch(function () { return null; });
  }

  function loadHistory(requestId) {
    if (!window.sb) return Promise.resolve([]);
    return window.sb
      .from('request_stage_history')
      .select('id, from_stage, to_stage, notes, moved_at, moved_by')
      .eq('request_id', requestId)
      .order('moved_at', { ascending: true })
      .then(function (res) { return res.data || []; })
      .catch(function () { return []; });
  }

  // ============ Render Banner ============
  function renderStatusBanner() {
    var req = state.request;
    var stage = req.current_stage;
    var banner = $('statusBanner');
    if (!banner) return;

    banner.className = 'status-banner ' + stage;

    var stageData = STAGES_ORDER.find(function (s) { return s.key === stage; });
    setText('statusTitle', translateStage(stage));
    setText('statusText', stageData ? stageData.desc : (stage === 'rejected' ? 'تم رفض الطلب' : '—'));

    // Icon
    var iconEl = banner.querySelector('.status-banner-icon');
    if (iconEl) {
      if (stage === 'approved') {
        iconEl.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>';
      } else if (stage === 'rejected') {
        iconEl.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="15" y1="9" x2="9" y2="15"></line><line x1="9" y1="9" x2="15" y2="15"></line></svg>';
      } else {
        iconEl.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline></svg>';
      }
    }

    // SLA
    var sla = calculateSLA(req);
    var slaBadge = $('slaBadge');
    var slaText = $('slaText');
    if (slaBadge && slaText) {
      slaBadge.className = 'request-sla-badge ' + sla.status;
      if (sla.status === 'done') {
        slaText.textContent = 'منتهي';
      } else if (sla.status === 'overdue') {
        slaText.textContent = 'متأخر ' + Math.abs(sla.daysRemaining) + ' يوم';
      } else {
        slaText.textContent = 'متبقي ' + sla.daysRemaining + ' يوم';
      }
    }
  }

  // ============ Render Header ============
  function renderHeader() {
    var req = state.request;
    var a = state.academy;

    setText('headerRequestNum', req.request_number);
    setText('requestNumber', req.request_number);
    setText('academyName', a ? (a.name || '—') : '—');
    setText('academyOwner', a && a.owner_name ? 'المالك: ' + a.owner_name : '');
    setText('submittedDate', formatDate(req.submitted_at));
    setText('updatedDate', formatDate(req.updated_at || req.submitted_at));
    setText('sideReqNumber', req.request_number);
    setText('sideLastUpdate', formatDateTime(req.updated_at || req.submitted_at));

    // View academy
    var viewAcadBtn = $('viewAcademyBtn');
    if (viewAcadBtn && a) {
      viewAcadBtn.href = resolve('admin/academy-details.html?id=' + encodeURIComponent(a.id));
    }
  }

  // ============ Render Academy Info ============
  function renderAcademyInfo() {
    var a = state.academy;
    var grid = $('academyInfoGrid');
    if (!grid) return;

    if (!a) {
      grid.innerHTML = '<div class="empty-inline" style="grid-column:1/-1;">لا توجد بيانات أكاديمية</div>';
      return;
    }

    function item(label, value, isMono, isEmpty) {
      var cls = 'info-item-value' + (isMono ? ' mono' : '') + (isEmpty ? ' empty' : '');
      return '<div class="info-item-card">' +
        '<div class="info-item-label">' + escapeHtml(label) + '</div>' +
        '<div class="' + cls + '">' + (isEmpty ? '<span class="empty">غير مسجل</span>' : value) + '</div>' +
      '</div>';
    }

    var emailHtml = a.email
      ? '<a href="mailto:' + escapeHtml(a.email) + '">' + escapeHtml(a.email) + '</a>'
      : '—';
    var phoneHtml = a.phone
      ? '<a href="tel:' + escapeHtml(a.phone) + '">' + escapeHtml(a.phone) + '</a>'
      : '—';

    grid.innerHTML = '' +
      item('اسم الأكاديمية', escapeHtml(a.name || '—'), false, !a.name) +
      item('المالك', escapeHtml(a.owner_name || '—'), false, !a.owner_name) +
      item('سنة التأسيس', a.founded_year || '—', false, !a.founded_year) +
      item('البطاقة الضريبية', escapeHtml(a.tax_number || '—'), true, !a.tax_number) +
      item('السجل التجاري', escapeHtml(a.commercial_registry || '—'), true, !a.commercial_registry) +
      item('البريد الإلكتروني', emailHtml, false, !a.email) +
      item('الهاتف', phoneHtml, false, !a.phone) +
      item('تاريخ الإضافة', formatDate(a.created_at), false, false);
  }

  // ============ Render Timeline ============
  function renderTimeline() {
    var req = state.request;
    var currentStage = req.current_stage;
    var isRejected = currentStage === 'rejected';

    var currentIndex = STAGES_ORDER.findIndex(function (s) { return s.key === currentStage; });
    if (isRejected) currentIndex = STAGES_ORDER.length;

    var itemsHtml = '';
    STAGES_ORDER.forEach(function (stage, index) {
      var isCompleted = index < currentIndex;
      var isCurrent = index === currentIndex;
      if (stage.key === 'approved' && currentStage === 'approved') {
        isCompleted = true;
        isCurrent = false;
      }

      var hEntry = state.history.find(function (h) { return h.to_stage === stage.key; });
      var dateText = hEntry ? formatDateTime(hEntry.moved_at) : (isCompleted ? 'تم' : '—');
      var notes = hEntry && hEntry.notes ? hEntry.notes : null;

      var cls = 'timeline-item';
      if (isCompleted) cls += ' completed';
      if (isCurrent) cls += ' current';
      if (isRejected && index === currentIndex) cls += ' rejected';

      itemsHtml += '' +
        '<div class="' + cls + '">' +
          '<div class="timeline-header">' +
            '<div class="timeline-stage">' + escapeHtml(stage.label) + '</div>' +
            '<div class="timeline-date">' + dateText + '</div>' +
          '</div>' +
          '<p class="timeline-desc">' + escapeHtml(stage.desc) + '</p>' +
          (notes ? '<div class="timeline-notes">' + escapeHtml(notes) + '</div>' : '') +
        '</div>';
    });

    if (isRejected) {
      var rejEntry = state.history.find(function (h) { return h.to_stage === 'rejected'; });
      var rejDate = rejEntry ? formatDateTime(rejEntry.moved_at) : formatDate(req.decided_at);
      var rejNotes = req.rejection_reason || (rejEntry && rejEntry.notes);
      itemsHtml += '' +
        '<div class="timeline-item rejected">' +
          '<div class="timeline-header">' +
            '<div class="timeline-stage">مرفوض</div>' +
            '<div class="timeline-date">' + rejDate + '</div>' +
          '</div>' +
          '<p class="timeline-desc">تم رفض طلب الاعتماد</p>' +
          (rejNotes ? '<div class="timeline-notes rejected">' + escapeHtml(rejNotes) + '</div>' : '') +
        '</div>';
    }

    setHtml('timeline', itemsHtml);
  }

  // ============ Render Documents ============
  function renderDocuments() {
    var req = state.request;
    var grid = $('documentsGrid');
    if (!grid) return;

    var docs = [
      { key: 'commercial_registry_url', name: 'السجل التجاري', required: true },
      { key: 'tax_card_url', name: 'البطاقة الضريبية', required: true },
      { key: 'place_photo_url', name: 'صورة المكان', required: true },
      { key: 'payment_receipt_url', name: 'إيصال التحويل', required: false }
    ];

    var uploadedCount = 0;
    var html = docs.map(function (d) {
      var url = req[d.key];
      var uploaded = !!url;
      if (uploaded) uploadedCount++;

      var statusText = uploaded ? 'تم الرفع' : (d.required ? 'مفقود' : 'اختياري');
      var statusCls = uploaded ? 'uploaded' : (d.required ? 'missing' : '');

      var iconCls = 'document-icon' + (uploaded ? '' : (d.required ? ' missing' : ''));
      var linkHtml = uploaded
        ? '<a href="' + escapeHtml(url) + '" target="_blank" rel="noopener" class="document-link" title="عرض">' +
            '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">' +
              '<path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path>' +
              '<circle cx="12" cy="12" r="3"></circle>' +
            '</svg>' +
          '</a>'
        : '';

      return '' +
        '<div class="document-card">' +
          '<div class="' + iconCls + '">' +
            '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">' +
              '<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>' +
              '<polyline points="14 2 14 8 20 8"></polyline>' +
            '</svg>' +
          '</div>' +
          '<div class="document-info">' +
            '<div class="document-name">' + escapeHtml(d.name) + '</div>' +
            '<div class="document-status ' + statusCls + '">' + statusText + '</div>' +
          '</div>' +
          linkHtml +
        '</div>';
    }).join('');

    grid.innerHTML = html;
    setText('docsCount', uploadedCount + ' / ' + docs.length);
  }

  // ============ Render History ============
  function renderHistory() {
    var list = $('historyList');
    if (!list) return;

    setText('historyCount', state.history.length);

    if (state.history.length === 0) {
      list.innerHTML = '<div class="empty-inline">لا توجد انتقالات مسجلة</div>';
      return;
    }

    list.innerHTML = state.history.map(function (h) {
      var fromLbl = h.from_stage ? translateStage(h.from_stage) : '—';
      var toLbl = translateStage(h.to_stage);
      return '' +
        '<div class="history-item">' +
          '<div class="history-icon">' +
            '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">' +
              '<polyline points="23 4 23 10 17 10"></polyline>' +
              '<polyline points="1 20 1 14 7 14"></polyline>' +
              '<path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"></path>' +
            '</svg>' +
          '</div>' +
          '<div class="history-content">' +
            '<div class="history-title">' + escapeHtml(fromLbl) + ' ← ' + escapeHtml(toLbl) + '</div>' +
            '<div class="history-meta">' +
              '<span>' + formatDateTime(h.moved_at) + '</span>' +
            '</div>' +
            (h.notes ? '<div class="history-notes">' + escapeHtml(h.notes) + '</div>' : '') +
          '</div>' +
        '</div>';
    }).join('');
  }

  // ============ Render Actions ============
  function renderActions() {
    var body = $('actionsBody');
    if (!body) return;

    var req = state.request;
    var stage = req.current_stage;
    var canMove = hasPermission('request.move_stage');
    var canApprove = hasPermission('request.approve');
    var canReject = hasPermission('request.reject');

    if (stage === 'approved' || stage === 'rejected') {
      body.innerHTML = '<div class="empty-inline" style="padding:20px 12px;font-size:12px;">الطلب منتهي - لا توجد إجراءات متاحة</div>';
      return;
    }

    var html = '';

    // Next stage
    var currentIdx = STAGES_ORDER.findIndex(function (s) { return s.key === stage; });
    var nextStage = currentIdx >= 0 && currentIdx < STAGES_ORDER.length - 1 ? STAGES_ORDER[currentIdx + 1] : null;

    if (nextStage && canMove) {
      if (nextStage.key === 'approved') {
        // Approve needs higher permission
        if (canApprove) {
          html += '<button class="action-btn success" data-action="approve">' +
            '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>' +
            '<span>اعتماد نهائي</span>' +
          '</button>';
        }
      } else {
        html += '<button class="action-btn primary" data-action="next" data-next="' + nextStage.key + '">' +
          '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="15 18 9 12 15 6"></polyline></svg>' +
          '<span>نقل إلى: ' + escapeHtml(nextStage.label) + '</span>' +
        '</button>';
      }
    }

    // Reject
    if (canReject && stage === 'final_approval') {
      html += '<button class="action-btn danger" data-action="reject">' +
        '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="15" y1="9" x2="9" y2="15"></line><line x1="9" y1="9" x2="15" y2="15"></line></svg>' +
        '<span>رفض الطلب</span>' +
      '</button>';
    }

    // Back to previous
    if (currentIdx > 0 && canMove) {
      var prevStage = STAGES_ORDER[currentIdx - 1];
      html += '<div class="action-divider"></div>';
      html += '<button class="action-btn" data-action="back" data-prev="' + prevStage.key + '">' +
        '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 18 15 12 9 6"></polyline></svg>' +
        '<span>رجوع إلى: ' + escapeHtml(prevStage.label) + '</span>' +
      '</button>';
    }

    if (!html) {
      html = '<div class="empty-inline" style="padding:20px 12px;font-size:12px;">لا توجد إجراءات متاحة لحسابك</div>';
    }

    body.innerHTML = html;
    bindActionButtons();
  }

  function bindActionButtons() {
    document.querySelectorAll('#actionsBody [data-action]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var action = btn.getAttribute('data-action');
        if (action === 'next') doMoveStage(btn.getAttribute('data-next'));
        else if (action === 'back') doMoveStage(btn.getAttribute('data-prev'), true);
        else if (action === 'approve') doApprove();
        else if (action === 'reject') doReject();
      });
    });
  }

  // ============ Actions ============
  function doMoveStage(newStage, isBack) {
    if (!hasPermission('request.move_stage')) {
      toast('غير مصرح لك بنقل الطلبات', 'error');
      return;
    }
    var req = state.request;
    var msg = (isBack ? 'إرجاع' : 'نقل') + ' الطلب إلى "' + translateStage(newStage) + '"?';

    if (!window.Modal || !window.Modal.confirm) {
      if (!confirm(msg)) return;
      performMove(newStage);
      return;
    }

    window.Modal.confirm({
      title: 'تأكيد النقل',
      message: msg,
      confirmText: 'تأكيد',
      cancelText: 'إلغاء',
      icon: 'info'
    }).then(function (confirmed) {
      if (confirmed) performMove(newStage);
    });
  }

  function performMove(newStage) {
    if (state.submitting || !window.sb) return;
    state.submitting = true;

    var req = state.request;
    var oldStage = req.current_stage;
    var now = new Date().toISOString();

    window.sb.from('accreditation_requests').update({
      current_stage: newStage,
      updated_at: now
    }).eq('id', req.id)
      .then(function (res) {
        if (res.error) throw new Error(res.error.message);

        addHistory(req.id, oldStage, newStage, null);

        toast('تم نقل الطلب بنجاح', 'success');
        logActivity('move_request_stage', 'نقل طلب من "' + translateStage(oldStage) + '" إلى "' + translateStage(newStage) + '"', {
          request_id: req.id,
          from_stage: oldStage,
          to_stage: newStage
        });

        return reloadAll();
      })
      .catch(function (err) {
        toast('حدث خطأ: ' + err.message, 'error');
        state.submitting = false;
      });
  }

  function doApprove() {
    if (!hasPermission('request.approve')) {
      toast('غير مصرح لك باعتماد الطلبات', 'error');
      return;
    }

    var req = state.request;
    var academyName = state.academy ? state.academy.name : 'الأكاديمية';
    var msg = 'اعتماد "' + academyName + '"? سيتم منحها رقماً اعتمادياً رسمياً.';

    if (!window.Modal || !window.Modal.confirm) {
      if (!confirm(msg)) return;
      performApprove();
      return;
    }

    window.Modal.confirm({
      title: 'اعتماد نهائي',
      message: msg,
      confirmText: 'اعتماد',
      cancelText: 'إلغاء',
      icon: 'success'
    }).then(function (confirmed) {
      if (confirmed) performApprove();
    });
  }

  function performApprove() {
    if (state.submitting || !window.sb) return;
    state.submitting = true;

    var req = state.request;
    var oldStage = req.current_stage;
    var year = new Date().getFullYear();
    var licenseNumber = 'NTI-' + year + '-' + String(Math.floor(100 + Math.random() * 900));
    var now = new Date().toISOString();
    var expires = new Date();
    expires.setFullYear(expires.getFullYear() + 1);

    // 1. Approve academy
    window.sb.from('academies').update({
      status: 'approved',
      approved_at: now,
      expires_at: expires.toISOString(),
      license_number: licenseNumber
    }).eq('id', req.academy_id)
      .then(function (res) {
        if (res.error) throw new Error('فشل اعتماد الأكاديمية: ' + res.error.message);

        // 2. Update request
        return window.sb.from('accreditation_requests').update({
          current_stage: 'approved',
          decided_at: now,
          approval_expires_at: expires.toISOString(),
          updated_at: now
        }).eq('id', req.id);
      })
      .then(function (res) {
        if (res.error) throw new Error(res.error.message);

        addHistory(req.id, oldStage, 'approved', null);

        toast('تم اعتماد الأكاديمية برقم: ' + licenseNumber, 'success');
        logActivity('approve_academy', 'اعتماد أكاديمية: ' + (state.academy ? state.academy.name : ''), {
          request_id: req.id,
          academy_id: req.academy_id,
          license_number: licenseNumber
        });

        return reloadAll();
      })
      .catch(function (err) {
        toast('حدث خطأ: ' + err.message, 'error');
        state.submitting = false;
      });
  }

  function doReject() {
    if (!hasPermission('request.reject')) {
      toast('غير مصرح لك برفض الطلبات', 'error');
      return;
    }

    if (!window.Modal || !window.Modal.prompt) {
      var reason = prompt('سبب الرفض:');
      if (reason && reason.trim()) performReject(reason.trim());
      return;
    }

    window.Modal.prompt({
      title: 'رفض الطلب',
      message: 'سبب الرفض',
      placeholder: 'اكتب سبب الرفض (سيظهر للأكاديمية)',
      confirmText: 'رفض',
      cancelText: 'إلغاء'
    }).then(function (reason) {
      if (reason && reason.trim()) performReject(reason.trim());
    });
  }

  function performReject(reason) {
    if (state.submitting || !window.sb) return;
    state.submitting = true;

    var req = state.request;
    var oldStage = req.current_stage;
    var now = new Date().toISOString();

    window.sb.from('accreditation_requests').update({
      current_stage: 'rejected',
      decided_at: now,
      rejection_reason: reason,
      updated_at: now
    }).eq('id', req.id)
      .then(function (res) {
        if (res.error) throw new Error(res.error.message);

        addHistory(req.id, oldStage, 'rejected', reason);

        toast('تم رفض الطلب', 'success');
        logActivity('reject_request', 'رفض طلب اعتماد - ' + reason, {
          request_id: req.id,
          reason: reason
        });

        return reloadAll();
      })
      .catch(function (err) {
        toast('حدث خطأ: ' + err.message, 'error');
        state.submitting = false;
      });
  }

  function addHistory(requestId, fromStage, toStage, notes) {
    if (!window.sb) return;
    window.sb.from('request_stage_history').insert({
      request_id: requestId,
      from_stage: fromStage,
      to_stage: toStage,
      notes: notes || null,
      moved_by: state.currentUser ? state.currentUser.id : null,
      moved_at: new Date().toISOString()
    }).catch(function () {});
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

  // ============ Reload ============
  function reloadAll() {
    return Promise.all([
      loadRequest(state.requestId),
      loadHistory(state.requestId)
    ]).then(function (results) {
      state.request = results[0];
      state.history = results[1] || [];
      return loadAcademy(state.request.academy_id).then(function (acad) {
        state.academy = acad;
        renderAll();
        state.submitting = false;
      });
    });
  }

  function renderAll() {
    renderStatusBanner();
    renderHeader();
    renderAcademyInfo();
    renderTimeline();
    renderDocuments();
    renderHistory();
    renderActions();
  }

  // ============ Show Error ============
  function showError(title, text) {
    var loader = $('viewLoader');
    var err = $('viewError');
    var content = $('viewContent');
    if (loader) loader.classList.remove('show');
    if (content) content.style.display = 'none';
    if (err) {
      err.classList.add('show');
      setText('errTitle', title);
      setText('errText', text);
    }
  }

  // ============ Init ============
  function init() {
    if (state.initialized) return;
    state.initialized = true;

    state.requestId = readId();
    if (!state.requestId) {
      showError('لم يتم تحديد الطلب', 'تأكد من الرابط أو ارجع لصفحة الطلبات.');
      return;
    }

    if (window.AuthGuard && window.AuthGuard.getUser) {
      state.currentUser = window.AuthGuard.getUser();
    }

    var loader = $('viewLoader');
    if (loader) loader.classList.add('show');

    loadRequest(state.requestId)
      .then(function (req) {
        if (!req) {
          showError('الطلب غير موجود', 'لم يتم العثور على طلب بهذا المعرف.');
          return;
        }
        state.request = req;

        return Promise.all([
          loadAcademy(req.academy_id),
          loadHistory(req.id)
        ]).then(function (results) {
          state.academy = results[0];
          state.history = results[1] || [];

          if (loader) loader.classList.remove('show');
          $('viewContent').style.display = 'block';

          renderAll();
          logDebug('Request details loaded:', req.id);
        });
      })
      .catch(function (err) {
        showError('حدث خطأ', err.message || 'تعذر تحميل البيانات');
        logDebug('Init error:', err.message);
      });
  }

  // ============ Public API ============
  window.AdminRequestDetails = {
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
