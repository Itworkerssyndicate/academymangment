// ============================================
// [43/50] ITWS Platform - Admin Requests Logic
// Path: assets/js/pages/admin/requests.js
// ============================================
// إدارة طلبات الاعتماد - Kanban Board
// Drag & Drop + SLA + Real-time
// بدون إيموجي
// ============================================

(function () {
  'use strict';

  if (window.AdminRequests && window.AdminRequests.initialized) return;

  var AUTO_REFRESH_INTERVAL = 60000; // 60 ثانية

  // المراحل بالترتيب
  var STAGES = [
    { key: 'submitted', label: 'تم التقديم', el: 'colSubmitted', countEl: 'colCountSubmitted', slaKey: 'submitted' },
    { key: 'documents_review', label: 'مراجعة المستندات', el: 'colDocumentsReview', countEl: 'colCountDocumentsReview', slaKey: 'documents_review' },
    { key: 'site_visit', label: 'زيارة الموقع', el: 'colSiteVisit', countEl: 'colCountSiteVisit', slaKey: 'site_visit' },
    { key: 'committee_review', label: 'لجنة المراجعة', el: 'colCommitteeReview', countEl: 'colCountCommitteeReview', slaKey: 'committee_review' },
    { key: 'final_approval', label: 'الموافقة النهائية', el: 'colFinalApproval', countEl: 'colCountFinalApproval', slaKey: 'final_approval' }
  ];

  var state = {
    allRequests: [],
    academies: {},
    filteredRequests: [],
    requestsChannel: null,
    autoRefreshTimer: null,
    draggedCard: null,
    draggedRequestId: null,
    filters: {
      search: '',
      sla: '',
      sort: 'oldest'
    },
    canMoveStage: false,
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
        year: 'numeric', month: 'short', day: 'numeric'
      });
    } catch (e) { return '—'; }
  }

  function formatRelativeTime(date) {
    if (!date) return '—';
    try {
      var d = date instanceof Date ? date : (date.toDate ? date.toDate() : new Date(date));
      if (isNaN(d.getTime())) return '—';
      var sec = Math.floor((Date.now() - d.getTime()) / 1000);
      if (sec < 60) return 'الآن';
      if (sec < 3600) return 'منذ ' + Math.floor(sec / 60) + ' د';
      if (sec < 86400) return 'منذ ' + Math.floor(sec / 3600) + ' س';
      if (sec < 604800) return 'منذ ' + Math.floor(sec / 86400) + ' يوم';
      return formatDate(d);
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
      console.log.apply(console, ['[AdminRequests]'].concat(Array.prototype.slice.call(arguments)));
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

  function getStageEnteredAt(request) {
    // نستخدم submitted_at أو updated_at (الوقت اللي دخل فيه المرحلة الحالية)
    return request.updated_at || request.submitted_at;
  }

  function calculateSLA(request) {
    var stage = request.current_stage;
    if (!stage) return { status: 'on-time', daysRemaining: null, percent: 0 };

    var slaDays = getSlaDays(stage);
    var enteredAt = getStageEnteredAt(request);
    if (!enteredAt) return { status: 'on-time', daysRemaining: slaDays, percent: 0 };

    try {
      var entered = enteredAt instanceof Date ? enteredAt : (enteredAt.toDate ? enteredAt.toDate() : new Date(enteredAt));
      if (isNaN(entered.getTime())) return { status: 'on-time', daysRemaining: slaDays, percent: 0 };

      var elapsedMs = Date.now() - entered.getTime();
      var elapsedDays = elapsedMs / (1000 * 60 * 60 * 24);
      var remaining = slaDays - elapsedDays;
      var percent = Math.min(100, (elapsedDays / slaDays) * 100);

      var status;
      if (remaining < 0) status = 'overdue';
      else if (remaining < slaDays * 0.3) status = 'warning';
      else status = 'on-time';

      return {
        status: status,
        daysRemaining: Math.ceil(remaining),
        percent: percent
      };
    } catch (e) {
      return { status: 'on-time', daysRemaining: slaDays, percent: 0 };
    }
  }

  function formatSlaBadge(sla) {
    if (sla.status === 'overdue') {
      return {
        cls: 'overdue',
        text: 'متأخر ' + Math.abs(sla.daysRemaining) + ' يوم'
      };
    }
    if (sla.status === 'warning') {
      return {
        cls: 'warning',
        text: 'متبقي ' + sla.daysRemaining + ' يوم'
      };
    }
    return {
      cls: 'on-time',
      text: sla.daysRemaining + ' يوم متبقي'
    };
  }

  // ============================================
  // 3. Load Data
  // ============================================
  function loadRequests() {
    if (!window.sb) return Promise.reject(new Error('Supabase not available'));

    return window.sb
      .from('accreditation_requests')
      .select('id, academy_id, request_number, current_stage, submitted_at, updated_at, decided_at, rejection_reason, approval_expires_at')
      .in('current_stage', STAGES.map(function (s) { return s.key; }))
      .order('submitted_at', { ascending: true });
  }

  function loadAcademies() {
    if (!window.sb) return Promise.resolve({});

    return window.sb
      .from('academies')
      .select('id, name, license_number, owner_name, email, phone, branches:academy_branches(id, governorate)')
      .eq('is_deleted', false)
      .then(function (res) {
        if (res.error || !res.data) return {};
        var map = {};
        res.data.forEach(function (a) {
          map[a.id] = a;
        });
        return map;
      })
      .catch(function () { return {}; });
  }

  // ============================================
  // 4. Apply Filters
  // ============================================
  function applyFilters() {
    var search = state.filters.search.trim().toLowerCase();
    var slaFilter = state.filters.sla;
    var sortBy = state.filters.sort;

    var filtered = state.allRequests.filter(function (r) {
      // Search
      if (search) {
        var numMatch = (r.request_number || '').toLowerCase().indexOf(search) !== -1;
        var academy = state.academies[r.academy_id];
        var nameMatch = academy && (academy.name || '').toLowerCase().indexOf(search) !== -1;
        if (!numMatch && !nameMatch) return false;
      }

      // SLA
      if (slaFilter) {
        var sla = calculateSLA(r);
        if (sla.status !== slaFilter) return false;
      }

      return true;
    });

    // Sort
    filtered.sort(function (a, b) {
      if (sortBy === 'newest') {
        return new Date(b.submitted_at) - new Date(a.submitted_at);
      }
      if (sortBy === 'oldest') {
        return new Date(a.submitted_at) - new Date(b.submitted_at);
      }
      if (sortBy === 'sla') {
        // الأكثر إلحاحاً أولاً (المتبقي أقل)
        var slaA = calculateSLA(a);
        var slaB = calculateSLA(b);
        var ra = slaA.status === 'overdue' ? slaA.daysRemaining : slaA.daysRemaining;
        var rb = slaB.status === 'overdue' ? slaB.daysRemaining : slaB.daysRemaining;
        return ra - rb;
      }
      return 0;
    });

    state.filteredRequests = filtered;
  }

  // ============================================
  // 5. Update Stats
  // ============================================
  function updateMiniStats() {
    var counts = {
      submitted: 0,
      documents_review: 0,
      site_visit: 0,
      committee_review: 0,
      final_approval: 0
    };

    state.allRequests.forEach(function (r) {
      if (counts[r.current_stage] !== undefined) {
        counts[r.current_stage]++;
      }
    });

    setText('countSubmitted', counts.submitted);
    setText('countDocumentsReview', counts.documents_review);
    setText('countSiteVisit', counts.site_visit);
    setText('countCommitteeReview', counts.committee_review);
    setText('countFinalApproval', counts.final_approval);
  }

  // ============================================
  // 6. Render Kanban
  // ============================================
  function render() {
    var board = $('kanbanBoard');
    var empty = $('requestsEmpty');
    var loader = $('requestsLoader');

    if (!board) return;

    if (loader) loader.classList.remove('show');

    var total = state.filteredRequests.length;

    if (total === 0) {
      board.style.display = 'none';
      if (empty) empty.classList.add('show');
      return;
    }

    board.style.display = 'grid';
    if (empty) empty.classList.remove('show');

    // Distribute by stage
    var byStage = {};
    STAGES.forEach(function (s) { byStage[s.key] = []; });
    state.filteredRequests.forEach(function (r) {
      if (byStage[r.current_stage]) {
        byStage[r.current_stage].push(r);
      }
    });

    // Render each column
    STAGES.forEach(function (stage) {
      var colEl = $(stage.el);
      var countEl = $(stage.countEl);
      if (!colEl) return;

      var items = byStage[stage.key] || [];

      if (countEl) countEl.textContent = items.length;

      if (items.length === 0) {
        colEl.innerHTML = '<div class="kanban-empty">لا توجد طلبات</div>';
        return;
      }

      colEl.innerHTML = items.map(renderRequestCard).join('');
      bindCardActions();
    });

    // Setup drag & drop on columns
    setupDragDrop();
  }

  // ============================================
  // 7. Render Card
  // ============================================
  function renderRequestCard(request) {
    var academy = state.academies[request.academy_id] || {};
    var academyName = academy.name || 'أكاديمية';
    var sla = calculateSLA(request);
    var slaBadge = formatSlaBadge(sla);

    var branchesCount = academy.branches ? academy.branches.length : 0;

    // Card classes
    var cardClasses = ['request-card'];
    if (sla.status === 'warning') cardClasses.push('sla-warning');
    if (sla.status === 'overdue') cardClasses.push('sla-overdue');

    // Draggable attribute
    var draggable = state.canMoveStage ? 'true' : 'false';

    return '' +
      '<div class="' + cardClasses.join(' ') + '" ' +
           'data-request-id="' + escapeHtml(request.id) + '" ' +
           'data-stage="' + escapeHtml(request.current_stage) + '" ' +
           'draggable="' + draggable + '">' +
        '<div class="request-card-header">' +
          '<div class="request-academy-name">' + escapeHtml(academyName) + '</div>' +
          '<span class="request-sla-badge ' + slaBadge.cls + '">' + slaBadge.text + '</span>' +
        '</div>' +
        '<div class="request-card-meta">' +
          '<div class="request-card-meta-item">' +
            '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">' +
              '<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>' +
              '<polyline points="14 2 14 8 20 8"></polyline>' +
            '</svg>' +
            escapeHtml(request.request_number || '—') +
          '</div>' +
          (branchesCount > 0
            ? '<div class="request-card-meta-item">' +
                '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">' +
                  '<path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path>' +
                  '<circle cx="12" cy="10" r="3"></circle>' +
                '</svg>' +
                branchesCount + ' فرع' +
              '</div>'
            : '') +
        '</div>' +
        '<div class="request-card-footer">' +
          '<span class="request-card-date">' + formatRelativeTime(request.submitted_at) + '</span>' +
          '<div class="request-card-actions">' +
            '<button class="request-card-btn" data-action="view" data-id="' + escapeHtml(request.id) + '" title="عرض التفاصيل">' +
              '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">' +
                '<path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path>' +
                '<circle cx="12" cy="12" r="3"></circle>' +
              '</svg>' +
            '</button>' +
          '</div>' +
        '</div>' +
      '</div>';
  }

  // ============================================
  // 8. Bind Card Actions
  // ============================================
  function bindCardActions() {
    document.querySelectorAll('.request-card [data-action="view"]').forEach(function (btn) {
      btn.addEventListener('click', function (e) {
        e.stopPropagation();
        var id = btn.getAttribute('data-id');
        if (id) viewRequest(id);
      });
    });
  }

  // ============================================
  // 9. Drag & Drop
  // ============================================
  function setupDragDrop() {
    // Cards: dragstart, dragend
    document.querySelectorAll('.request-card[draggable="true"]').forEach(function (card) {
      card.addEventListener('dragstart', handleDragStart);
      card.addEventListener('dragend', handleDragEnd);
    });

    // Columns: dragover, dragleave, drop
    document.querySelectorAll('.kanban-column').forEach(function (col) {
      col.addEventListener('dragover', handleDragOver);
      col.addEventListener('dragleave', handleDragLeave);
      col.addEventListener('drop', handleDrop);
    });
  }

  function handleDragStart(e) {
    if (!state.canMoveStage) {
      e.preventDefault();
      return;
    }

    var card = e.currentTarget;
    state.draggedCard = card;
    state.draggedRequestId = card.getAttribute('data-request-id');

    card.classList.add('dragging');
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', state.draggedRequestId);

    logDebug('Drag start:', state.draggedRequestId);
  }

  function handleDragEnd(e) {
    var card = e.currentTarget;
    card.classList.remove('dragging');
    state.draggedCard = null;

    document.querySelectorAll('.kanban-column').forEach(function (col) {
      col.classList.remove('drag-over');
    });
  }

  function handleDragOver(e) {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    e.currentTarget.classList.add('drag-over');
  }

  function handleDragLeave(e) {
    // Only remove if leaving the column (not entering a child)
    if (!e.currentTarget.contains(e.relatedTarget)) {
      e.currentTarget.classList.remove('drag-over');
    }
  }

  function handleDrop(e) {
    e.preventDefault();
    var col = e.currentTarget;
    col.classList.remove('drag-over');

    var newStage = col.getAttribute('data-stage');
    var requestId = state.draggedRequestId;

    if (!requestId || !newStage) return;

    var request = state.allRequests.find(function (r) { return r.id === requestId; });
    if (!request) return;

    // Skip if same stage
    if (request.current_stage === newStage) {
      logDebug('Same stage, skipping');
      return;
    }

    // Validate transition
    var oldStage = request.current_stage;
    if (!validateStageTransition(oldStage, newStage)) {
      toast('لا يمكن نقل الطلب من "' + getStageLabel(oldStage) + '" إلى "' + getStageLabel(newStage) + '"', 'error');
      return;
    }

    // Show confirmation
    var academy = state.academies[request.academy_id] || {};
    var academyName = academy.name || 'أكاديمية';

    if (!window.Modal || !window.Modal.confirm) {
      if (!confirm('نقل طلب "' + academyName + '" من "' + getStageLabel(oldStage) + '" إلى "' + getStageLabel(newStage) + '"؟')) return;
      performMove(requestId, newStage, oldStage);
      return;
    }

    window.Modal.confirm({
      title: 'تأكيد نقل المرحلة',
      message: 'نقل طلب "' + academyName + '" من "' + getStageLabel(oldStage) + '" إلى "' + getStageLabel(newStage) + '"?',
      confirmText: 'نقل',
      cancelText: 'إلغاء',
      icon: 'info'
    }).then(function (confirmed) {
      if (confirmed) performMove(requestId, newStage, oldStage);
    });
  }

  // ============================================
  // 10. Stage Transitions
  // ============================================
  function getStageLabel(stage) {
    var found = STAGES.find(function (s) { return s.key === stage; });
    return found ? found.label : stage;
  }

  function validateStageTransition(from, to) {
    // Transition matrix: من → إلى (allowed)
    var transitions = {
      'submitted': ['documents_review'],
      'documents_review': ['site_visit', 'submitted'], // يمكن الرجوع
      'site_visit': ['committee_review', 'documents_review'],
      'committee_review': ['final_approval', 'site_visit'],
      'final_approval': ['approved', 'rejected', 'committee_review']
    };

    // لو كان الطلب في final_approval ونقل لـ approved/rejected
    if (from === 'final_approval' && (to === 'approved' || to === 'rejected')) {
      return true;
    }

    var allowed = transitions[from] || [];
    return allowed.indexOf(to) !== -1;
  }

  // ============================================
  // 11. Perform Move
  // ============================================
  function performMove(requestId, newStage, oldStage) {
    if (!window.sb) {
      toast('تعذر الاتصال بالخادم', 'error');
      return;
    }

    if (!hasPermission('request.move_stage')) {
      toast('غير مصرح لك بنقل الطلبات', 'error');
      return;
    }

    // Handle rejected/approved (final stages)
    if (newStage === 'approved' || newStage === 'rejected') {
      if (newStage === 'rejected') {
        showRejectModal(requestId, oldStage);
        return;
      }
      if (newStage === 'approved') {
        if (!hasPermission('request.approve')) {
          toast('غير مصرح لك باعتماد الطلبات', 'error');
          return;
        }
        // Approval = منح الأكاديمية الاعتماد
        approveRequest(requestId);
        return;
      }
    }

    var request = state.allRequests.find(function (r) { return r.id === requestId; });
    if (!request) return;

    var updateData = {
      current_stage: newStage,
      updated_at: new Date().toISOString()
    };

    // لو دخل مرحلة الموافقة النهائية → نحدد تاريخ الانتهاء
    if (newStage === 'final_approval' && !request.approval_expires_at) {
      var expires = new Date();
      expires.setFullYear(expires.getFullYear() + 1); // سنة افتراضية
      updateData.approval_expires_at = expires.toISOString();
    }

    window.sb.from('accreditation_requests').update(updateData).eq('id', requestId)
      .then(function (res) {
        if (res.error) {
          toast('فشل النقل: ' + res.error.message, 'error');
          return;
        }

        // Add to history
        addStageHistory(requestId, oldStage, newStage, null);

        toast('تم نقل الطلب بنجاح', 'success');
        logDebug('Request moved:', requestId, oldStage, '→', newStage);

        logActivity('move_request_stage', 'نقل طلب من "' + getStageLabel(oldStage) + '" إلى "' + getStageLabel(newStage) + '"', {
          request_id: requestId,
          from_stage: oldStage,
          to_stage: newStage
        });

        // Update local + re-render
        request.current_stage = newStage;
        request.updated_at = updateData.updated_at;

        applyFilters();
        updateMiniStats();
        render();
      })
      .catch(function (err) {
        toast('حدث خطأ: ' + err.message, 'error');
      });
  }

  // ============================================
  // 12. Add Stage History
  // ============================================
  function addStageHistory(requestId, fromStage, toStage, notes) {
    if (!window.sb) return;
    var user = state.currentUser;

    window.sb.from('request_stage_history').insert({
      request_id: requestId,
      from_stage: fromStage,
      to_stage: toStage,
      notes: notes || null,
      moved_by: user ? user.id : null,
      moved_at: new Date().toISOString()
    }).catch(function () {});
  }

  // ============================================
  // 13. Reject Modal
  // ============================================
  function showRejectModal(requestId, oldStage) {
    if (!window.Modal || !window.Modal.prompt) {
      var reason = prompt('سبب الرفض:');
      if (reason) performReject(requestId, oldStage, reason);
      return;
    }

    window.Modal.prompt({
      title: 'رفض طلب الاعتماد',
      message: 'سبب الرفض',
      placeholder: 'اكتب سبب الرفض (سيظهر للأكاديمية)',
      confirmText: 'رفض',
      cancelText: 'إلغاء',
      inputType: 'text'
    }).then(function (reason) {
      if (reason && reason.trim()) {
        performReject(requestId, oldStage, reason.trim());
      } else if (reason !== null) {
        toast('يجب إدخال سبب الرفض', 'error');
      }
    });
  }

  function performReject(requestId, oldStage, reason) {
    if (!window.sb) return;
    if (!hasPermission('request.reject')) {
      toast('غير مصرح لك برفض الطلبات', 'error');
      return;
    }

    var updateData = {
      current_stage: 'rejected',
      decided_at: new Date().toISOString(),
      rejection_reason: reason,
      updated_at: new Date().toISOString()
    };

    window.sb.from('accreditation_requests').update(updateData).eq('id', requestId)
      .then(function (res) {
        if (res.error) {
          toast('فشل الرفض: ' + res.error.message, 'error');
          return;
        }

        addStageHistory(requestId, oldStage, 'rejected', reason);

        toast('تم رفض الطلب', 'success');

        logActivity('reject_request', 'رفض طلب اعتماد - ' + reason, {
          request_id: requestId,
          reason: reason
        });

        // Update local
        var req = state.allRequests.find(function (r) { return r.id === requestId; });
        if (req) req.current_stage = 'rejected';

        // إزالة من الـ board
        state.allRequests = state.allRequests.filter(function (r) { return r.id !== requestId; });

        applyFilters();
        updateMiniStats();
        render();
      })
      .catch(function (err) {
        toast('حدث خطأ: ' + err.message, 'error');
      });
  }

  // ============================================
  // 14. Approve Request
  // ============================================
  function approveRequest(requestId) {
    if (!window.sb) return;
    if (!hasPermission('request.approve')) {
      toast('غير مصرح لك باعتماد الطلبات', 'error');
      return;
    }

    var request = state.allRequests.find(function (r) { return r.id === requestId; });
    if (!request) return;

    var academy = state.academies[request.academy_id] || {};
    var academyName = academy.name || 'أكاديمية';

    if (!window.Modal || !window.Modal.confirm) {
      if (!confirm('اعتماد "' + academyName + '"? سيتم منحها رقماً اعتمادياً رسمياً.')) return;
      performApprove(requestId, request);
      return;
    }

    window.Modal.confirm({
      title: 'اعتماد أكاديمية',
      message: 'اعتماد "' + academyName + '"? سيتم منحها رقماً اعتمادياً رسمياً وستظهر في الدليل العام.',
      confirmText: 'اعتماد',
      cancelText: 'إلغاء',
      icon: 'success'
    }).then(function (confirmed) {
      if (confirmed) performApprove(requestId, request);
    });
  }

  function performApprove(requestId, request) {
    // توليد رقم اعتماد
    var year = new Date().getFullYear();
    var licenseNumber = 'NTI-' + year + '-' + String(Math.floor(100 + Math.random() * 900));

    // تاريخ انتهاء الاعتماد (سنة)
    var expiresAt = new Date();
    expiresAt.setFullYear(expiresAt.getFullYear() + 1);

    var now = new Date().toISOString();

    // 1. Update academy
    window.sb.from('academies').update({
      status: 'approved',
      approved_at: now,
      expires_at: expiresAt.toISOString(),
      license_number: licenseNumber
    }).eq('id', request.academy_id)
      .then(function (res) {
        if (res.error) throw new Error('فشل اعتماد الأكاديمية: ' + res.error.message);

        // 2. Update request
        return window.sb.from('accreditation_requests').update({
          current_stage: 'approved',
          decided_at: now,
          approval_expires_at: expiresAt.toISOString(),
          updated_at: now
        }).eq('id', requestId);
      })
      .then(function (res) {
        if (res.error) throw new Error(res.error.message);

        addStageHistory(requestId, request.current_stage, 'approved', null);

        toast('تم اعتماد الأكاديمية برقم: ' + licenseNumber, 'success');

        logActivity('approve_academy', 'اعتماد أكاديمية: ' + (state.academies[request.academy_id]?.name || ''), {
          request_id: requestId,
          academy_id: request.academy_id,
          license_number: licenseNumber
        });

        // إزالة من الـ board
        state.allRequests = state.allRequests.filter(function (r) { return r.id !== requestId; });

        applyFilters();
        updateMiniStats();
        render();
      })
      .catch(function (err) {
        toast('حدث خطأ: ' + err.message, 'error');
      });
  }

  // ============================================
  // 15. Log Activity
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
  // 16. View Request
  // ============================================
  function viewRequest(id) {
    window.location.href = resolve('admin/request-details.html?id=' + encodeURIComponent(id));
  }

  // ============================================
  // 17. Filters Binding
  // ============================================
  function syncFiltersFromUI() {
    state.filters.search = ($('searchInput') || {}).value || '';
    state.filters.sla = ($('slaFilter') || {}).value || '';
    state.filters.sort = ($('sortFilter') || {}).value || 'oldest';
    state.filters.search = state.filters.search.trim();
  }

  function applyAndRender() {
    syncFiltersFromUI();
    applyFilters();
    render();
  }

  function resetFilters() {
    ['searchInput', 'slaFilter'].forEach(function (id) {
      var el = $(id);
      if (el) el.value = '';
    });
    var sortEl = $('sortFilter');
    if (sortEl) sortEl.value = 'oldest';

    state.filters = { search: '', sla: '', sort: 'oldest' };

    // إزالة active من mini stats
    document.querySelectorAll('.mini-stat').forEach(function (el) {
      el.classList.remove('active');
    });

    applyFilters();
    render();
  }

  function bindFilters() {
    // Debounced search
    var searchInput = $('searchInput');
    if (searchInput) {
      var timer = null;
      searchInput.addEventListener('input', function () {
        clearTimeout(timer);
        timer = setTimeout(applyAndRender, 250);
      });
    }

    // Selects
    ['slaFilter', 'sortFilter'].forEach(function (id) {
      var el = $(id);
      if (el) el.addEventListener('change', applyAndRender);
    });

    // Reset
    var resetBtn = $('resetBtn');
    if (resetBtn) resetBtn.addEventListener('click', resetFilters);

    var emptyResetBtn = $('emptyResetBtn');
    if (emptyResetBtn) emptyResetBtn.addEventListener('click', resetFilters);

    // Refresh
    var refreshBtn = $('refreshBtn');
    if (refreshBtn) {
      refreshBtn.addEventListener('click', function () {
        refreshBtn.disabled = true;
        refreshBtn.innerHTML = '<span>جاري التحديث...</span>';
        loadAll().finally(function () {
          refreshBtn.disabled = false;
          refreshBtn.innerHTML = '' +
            '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="width:14px;height:14px;">' +
              '<polyline points="23 4 23 10 17 10"></polyline>' +
              '<polyline points="1 20 1 14 7 14"></polyline>' +
              '<path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"></path>' +
            '</svg>' +
            '<span>تحديث</span>';
        });
      });
    }

    // Mini stats click (filter by stage)
    document.querySelectorAll('.mini-stat').forEach(function (stat) {
      stat.addEventListener('click', function () {
        var stage = stat.getAttribute('data-stage');
        if (!stage) return;

        // toggle
        var isActive = stat.classList.contains('active');
        document.querySelectorAll('.mini-stat').forEach(function (el) {
          el.classList.remove('active');
        });

        if (!isActive) {
          stat.classList.add('active');
          // Filter by stage
          state.filters.stage = stage;
        } else {
          state.filters.stage = null;
        }

        // We need to add stage filter to applyFilters
        applyFiltersWithStage();
      });
    });
  }

  function applyFiltersWithStage() {
    syncFiltersFromUI();

    // After normal filter, apply stage filter if set
    applyFilters();

    if (state.filters.stage) {
      state.filteredRequests = state.filteredRequests.filter(function (r) {
        return r.current_stage === state.filters.stage;
      });
    }

    render();
  }

  // ============================================
  // 18. Real-time Subscription
  // ============================================
  function subscribeRealtime() {
    if (!window.sb || state.requestsChannel) return;

    try {
      state.requestsChannel = window.sb
        .channel('requests-changes')
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'accreditation_requests' },
          function (payload) {
            logDebug('Realtime request change:', payload.eventType);
            // Reload all requests
            loadAndRender();
          }
        )
        .subscribe(function (status) {
          logDebug('Requests channel:', status);
        });
    } catch (e) {
      logDebug('Subscribe error:', e.message);
    }
  }

  // ============================================
  // 19. Load and Render
  // ============================================
  function loadAndRender() {
    return Promise.all([loadRequests(), loadAcademies()])
      .then(function (results) {
        var reqRes = results[0];
        var academies = results[1];

        if (reqRes && reqRes.error) throw new Error(reqRes.error.message);

        state.allRequests = (reqRes && reqRes.data) || [];
        state.academies = academies || {};

        applyFilters();
        updateMiniStats();
        render();
      })
      .catch(function (err) {
        logDebug('Load error:', err.message);
        toast('حدث خطأ في تحميل الطلبات', 'error');
      });
  }

  // ============================================
  // 20. Auto-refresh
  // ============================================
  function startAutoRefresh() {
    if (state.autoRefreshTimer) return;
    state.autoRefreshTimer = setInterval(function () {
      if (document.visibilityState === 'visible') {
        loadAndRender();
      }
    }, AUTO_REFRESH_INTERVAL);
  }

  function stopAutoRefresh() {
    if (state.autoRefreshTimer) {
      clearInterval(state.autoRefreshTimer);
      state.autoRefreshTimer = null;
    }
  }

  // ============================================
  // 21. Init
  // ============================================
  function init() {
    if (state.initialized) return;
    state.initialized = true;

    // Check permissions
    state.canMoveStage = hasPermission('request.move_stage');

    if (window.AuthGuard && window.AuthGuard.getUser) {
      state.currentUser = window.AuthGuard.getUser();
    }

    bindFilters();

    // Load
    var loader = $('requestsLoader');
    if (loader) loader.classList.add('show');

    waitForSupabase(function () {
      loadAndRender().then(function () {
        subscribeRealtime();
        startAutoRefresh();
      });
    });

    // Visibility change
    document.addEventListener('visibilitychange', function () {
      if (document.visibilityState === 'visible') {
        loadAndRender();
      }
    });

    logDebug('Admin requests initialized. canMove:', state.canMoveStage);
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
  // 22. Public API
  // ============================================
  window.AdminRequests = {
    initialized: true,
    init: init,
    refresh: function () { return loadAndRender(); },
    resetFilters: resetFilters,
    getState: function () { return state; },
    destroy: function () {
      stopAutoRefresh();
      if (state.requestsChannel) {
        state.requestsChannel.unsubscribe();
        state.requestsChannel = null;
      }
    }
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  window.addEventListener('beforeunload', function () {
    if (window.AdminRequests && window.AdminRequests.destroy) {
      window.AdminRequests.destroy();
    }
  });

})();
