// ============================================
// [33/50] ITWS Platform - Admin Dashboard Logic
// Path: assets/js/pages/admin/dashboard.js
// ============================================
// لوحة التحكم - إحصائيات حية + آخر النشاطات
// real-time updates
// بدون إيموجي
// ============================================

(function () {
  'use strict';

  if (window.AdminDashboard && window.AdminDashboard.initialized) return;

  var UPDATE_INTERVAL = 30000; // 30 ثانية
  var ONLINE_THRESHOLD_MS = 120000; // دقيقتين
  var ACTIVITIES_LIMIT = 8;

  var state = {
    currentUser: null,
    statsUpdateTimer: null,
    activitiesChannel: null,
    requestsChannel: null,
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

  function formatNumber(n) {
    if (n == null) return '—';
    if (n < 1000) return n.toString();
    if (n < 1000000) return (n / 1000).toFixed(1).replace(/\.0$/, '') + 'K';
    return (n / 1000000).toFixed(1).replace(/\.0$/, '') + 'M';
  }

  function formatRelativeTime(date) {
    if (!date) return '—';
    try {
      var d = date instanceof Date ? date : (date.toDate ? date.toDate() : new Date(date));
      if (isNaN(d.getTime())) return '—';
      var seconds = Math.floor((Date.now() - d.getTime()) / 1000);
      if (seconds < 5) return 'الآن';
      if (seconds < 60) return 'منذ ' + seconds + ' ثانية';
      if (seconds < 3600) return 'منذ ' + Math.floor(seconds / 60) + ' دقيقة';
      if (seconds < 86400) return 'منذ ' + Math.floor(seconds / 3600) + ' ساعة';
      if (seconds < 604800) return 'منذ ' + Math.floor(seconds / 86400) + ' يوم';
      return d.toLocaleDateString('ar-EG', { year: 'numeric', month: 'short', day: 'numeric' });
    } catch (e) {
      return '—';
    }
  }

  function logDebug() {
    if (window.ITWS_CONFIG && window.ITWS_CONFIG.DEBUG) {
      console.log.apply(console, ['[AdminDashboard]'].concat(Array.prototype.slice.call(arguments)));
    }
  }

  // ============================================
  // 2. Load current user
  // ============================================
  function loadCurrentUser() {
    if (window.AuthGuard && window.AuthGuard.getCurrentUser) {
      return window.AuthGuard.getCurrentUser().then(function (u) {
        state.currentUser = u;
        return u;
      });
    }
    return Promise.resolve(null);
  }

  function renderWelcome() {
    var user = state.currentUser;
    var nameEl = $('welcomeName');
    if (!nameEl) return;

    if (user) {
      var name = user.full_name || user.email || '';
      var firstName = name.split(' ')[0] || name;
      nameEl.textContent = firstName;
    } else {
      nameEl.textContent = 'المدير';
    }
  }

  // ============================================
  // 3. Load Statistics
  // ============================================
  function loadAcademiesStats() {
    if (!window.sb) return Promise.resolve();

    // إجمالي الأكاديميات
    var totalPromise = window.sb
      .from('academies')
      .select('*', { count: 'exact', head: true })
      .eq('is_deleted', false);

    // معتمدة
    var approvedPromise = window.sb
      .from('academies')
      .select('*', { count: 'exact', head: true })
      .eq('is_deleted', false)
      .eq('status', 'approved');

    // قيد الاعتماد (pending + suspended)
    var pendingPromise = window.sb
      .from('academies')
      .select('*', { count: 'exact', head: true })
      .eq('is_deleted', false)
      .eq('status', 'pending');

    return Promise.all([totalPromise, approvedPromise, pendingPromise])
      .then(function (results) {
        var total = (results[0] && results[0].count) || 0;
        var approved = (results[1] && results[1].count) || 0;
        var pending = (results[2] && results[2].count) || 0;

        setText('statAcademies', formatNumber(total));
        setText('statAcademiesApproved', approved);
        setText('statAcademiesPending', pending);

        logDebug('Academies stats:', { total: total, approved: approved, pending: pending });
      })
      .catch(function (err) {
        logDebug('Academies stats error:', err.message);
      });
  }

  function loadCertificatesStats() {
    if (!window.sb) return Promise.resolve();

    // إجمالي الشهادات النشطة
    var totalPromise = window.sb
      .from('certificates')
      .select('*', { count: 'exact', head: true })
      .eq('is_active', true);

    // من النقابة
    var unionPromise = window.sb
      .from('certificates')
      .select('*', { count: 'exact', head: true })
      .eq('is_active', true)
      .eq('issuer_type', 'union');

    // من أكاديميات
    var academyPromise = window.sb
      .from('certificates')
      .select('*', { count: 'exact', head: true })
      .eq('is_active', true)
      .eq('issuer_type', 'academy');

    return Promise.all([totalPromise, unionPromise, academyPromise])
      .then(function (results) {
        var total = (results[0] && results[0].count) || 0;
        var union = (results[1] && results[1].count) || 0;
        var academy = (results[2] && results[2].count) || 0;

        setText('statCertificates', formatNumber(total));
        setText('statUnionCerts', formatNumber(union));
        setText('statAcademyCerts', formatNumber(academy));

        logDebug('Certificates stats:', { total: total, union: union, academy: academy });
      })
      .catch(function (err) {
        logDebug('Certificates stats error:', err.message);
      });
  }

  function loadOnlineStats() {
    if (!window.sb) return Promise.resolve();

    var threshold = new Date(Date.now() - ONLINE_THRESHOLD_MS).toISOString();

    // إجمالي المتصلين
    var totalPromise = window.sb
      .from('sessions')
      .select('*', { count: 'exact', head: true })
      .gte('last_seen_at', threshold);

    // مسجلين
    var usersPromise = window.sb
      .from('sessions')
      .select('*', { count: 'exact', head: true })
      .gte('last_seen_at', threshold)
      .not('user_id', 'is', null);

    return Promise.all([totalPromise, usersPromise])
      .then(function (results) {
        var total = (results[0] && results[0].count) || 0;
        var users = (results[1] && results[1].count) || 0;
        var guests = Math.max(0, total - users);

        setText('statOnline', formatNumber(total));
        setText('statOnlineUsers', users);
        setText('statOnlineGuests', guests);

        logDebug('Online stats:', { total: total, users: users, guests: guests });
      })
      .catch(function (err) {
        logDebug('Online stats error:', err.message);
      });
  }

  function loadRequestsStats() {
    if (!window.sb) return Promise.resolve();

    var pendingStages = [
      'submitted',
      'documents_review',
      'site_visit',
      'committee_review',
      'final_approval'
    ];

    // إجمالي الطلبات المعلقة
    var totalPromise = window.sb
      .from('accreditation_requests')
      .select('*', { count: 'exact', head: true })
      .in('current_stage', pendingStages);

    // في المراجعة (documents_review + site_visit + committee_review + final_approval)
    var reviewPromise = window.sb
      .from('accreditation_requests')
      .select('*', { count: 'exact', head: true })
      .in('current_stage', ['documents_review', 'site_visit', 'committee_review', 'final_approval']);

    // جديدة (submitted فقط)
    var newPromise = window.sb
      .from('accreditation_requests')
      .select('*', { count: 'exact', head: true })
      .eq('current_stage', 'submitted');

    return Promise.all([totalPromise, reviewPromise, newPromise])
      .then(function (results) {
        var total = (results[0] && results[0].count) || 0;
        var review = (results[1] && results[1].count) || 0;
        var newCount = (results[2] && results[2].count) || 0;

        setText('statRequests', formatNumber(total));
        setText('statRequestsReview', review);
        setText('statRequestsNew', newCount);

        logDebug('Requests stats:', { total: total, review: review, new: newCount });
      })
      .catch(function (err) {
        logDebug('Requests stats error:', err.message);
      });
  }

  // ============================================
  // 4. Load all stats in parallel
  // ============================================
  function loadAllStats() {
    return Promise.all([
      loadAcademiesStats(),
      loadCertificatesStats(),
      loadOnlineStats(),
      loadRequestsStats()
    ]);
  }

  // ============================================
  // 5. Load Recent Activities
  // ============================================
  function loadRecentActivities() {
    if (!window.sb) return Promise.resolve();

    return window.sb
      .from('activities')
      .select('id, user_id, user_name, user_role, action_type, description, created_at, type')
      .order('created_at', { ascending: false })
      .limit(ACTIVITIES_LIMIT)
      .then(function (res) {
        if (res.error) {
          logDebug('Activities load error:', res.error.message);
          return;
        }

        renderActivities(res.data || []);
      })
      .catch(function (err) {
        logDebug('Activities catch:', err.message);
      });
  }

  // ============================================
  // 6. Render Activities
  // ============================================
  function renderActivities(activities) {
    var container = $('activitiesList');
    if (!container) return;

    if (!activities || activities.length === 0) {
      container.innerHTML = '' +
        '<div class="empty-panel">' +
          '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">' +
            '<circle cx="12" cy="12" r="10"></circle>' +
            '<polyline points="12 6 12 12 16 14"></polyline>' +
          '</svg>' +
          '<div>لا توجد نشاطات بعد</div>' +
        '</div>';
      return;
    }

    var typeLabels = {
      'login': 'دخول',
      'logout': 'خروج',
      'login_success': 'دخول',
      'login_failed': 'محاولة فاشلة',
      'create_academy': 'أكاديمية جديدة',
      'update_academy': 'تعديل أكاديمية',
      'delete_academy': 'حذف أكاديمية',
      'create_certificate': 'شهادة جديدة',
      'update_certificate': 'تعديل شهادة',
      'delete_certificate': 'حذف شهادة',
      'search_certificate': 'بحث شهادة',
      'search_academy': 'بحث أكاديمية',
      'page_enter': 'دخول صفحة',
      'page_change': 'تغيير صفحة',
      'reconnect': 'إعادة اتصال',
      'disconnect': 'انقطاع اتصال'
    };

    var typeClasses = {
      'login': 'login',
      'login_success': 'login',
      'login_failed': 'delete',
      'logout': 'logout',
      'create_academy': 'create',
      'create_certificate': 'create',
      'update_academy': 'update',
      'update_certificate': 'update',
      'delete_academy': 'delete',
      'delete_certificate': 'delete',
      'search_certificate': 'update',
      'search_academy': 'update',
      'page_enter': 'login',
      'page_change': 'update',
      'reconnect': 'login',
      'disconnect': 'logout'
    };

    container.innerHTML = activities.map(function (a) {
      var type = a.action_type || a.type || 'default';
      var label = typeLabels[type] || type;
      var cls = typeClasses[type] || 'default';
      var userName = a.user_name || 'مستخدم';
      var initial = escapeHtml(userName.charAt(0));
      var desc = a.description ? escapeHtml(a.description) : '';
      var time = formatRelativeTime(a.created_at);

      return '' +
        '<div class="activity-item">' +
          '<div class="activity-avatar">' + initial + '</div>' +
          '<div class="activity-content">' +
            '<div class="activity-title">' +
              '<strong>' + escapeHtml(userName) + '</strong> ' +
              (desc || label) +
            '</div>' +
            '<div class="activity-meta">' +
              '<span class="activity-type-badge ' + cls + '">' + escapeHtml(label) + '</span>' +
              '<span>' + time + '</span>' +
            '</div>' +
          '</div>' +
        '</div>';
    }).join('');
  }

  // ============================================
  // 7. Realtime: activities
  // ============================================
  function subscribeToActivities() {
    if (!window.sb || state.activitiesChannel) return;

    try {
      state.activitiesChannel = window.sb
        .channel('dashboard-activities')
        .on(
          'postgres_changes',
          { event: 'INSERT', schema: 'public', table: 'activities' },
          function (payload) {
            logDebug('New activity:', payload.new);
            // نعيد تحميل النشاطات
            loadRecentActivities();
          }
        )
        .subscribe(function (status) {
          logDebug('Activities channel:', status);
        });
    } catch (e) {
      logDebug('Activities subscription error:', e.message);
    }
  }

  // ============================================
  // 8. Realtime: requests
  // ============================================
  function subscribeToRequests() {
    if (!window.sb || state.requestsChannel) return;

    try {
      state.requestsChannel = window.sb
        .channel('dashboard-requests')
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'accreditation_requests' },
          function () {
            logDebug('Requests changed, refreshing stats');
            loadRequestsStats();
          }
        )
        .subscribe(function (status) {
          logDebug('Requests channel:', status);
        });
    } catch (e) {
      logDebug('Requests subscription error:', e.message);
    }
  }

  // ============================================
  // 9. Update loop
  // ============================================
  function startUpdateLoop() {
    if (state.statsUpdateTimer) return;

    state.statsUpdateTimer = setInterval(function () {
      if (document.visibilityState === 'visible') {
        logDebug('Auto-refreshing stats');
        loadAllStats();
      }
    }, UPDATE_INTERVAL);
  }

  function stopUpdateLoop() {
    if (state.statsUpdateTimer) {
      clearInterval(state.statsUpdateTimer);
      state.statsUpdateTimer = null;
    }
  }

  // ============================================
  // 10. Visibility change
  // ============================================
  function onVisibilityChange() {
    if (document.visibilityState === 'visible') {
      logDebug('Page visible, refreshing stats');
      loadAllStats();
    }
  }

  // ============================================
  // 11. Init
  // ============================================
  function init() {
    if (state.initialized) return;
    state.initialized = true;

    // Welcome message
    loadCurrentUser().then(function () {
      renderWelcome();
    });

    // Load all stats
    waitForSupabase(function () {
      logDebug('Loading stats...');
      loadAllStats();
      loadRecentActivities();

      // Real-time subscriptions
      subscribeToActivities();
      subscribeToRequests();

      // Auto-refresh
      startUpdateLoop();
      document.addEventListener('visibilitychange', onVisibilityChange);
    });

    logDebug('Admin dashboard initialized');
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
  // 12. Public API
  // ============================================
  window.AdminDashboard = {
    initialized: true,
    init: init,
    refresh: function () {
      loadAllStats();
      loadRecentActivities();
    },
    refreshStats: loadAllStats,
    refreshActivities: loadRecentActivities,
    destroy: function () {
      stopUpdateLoop();
      document.removeEventListener('visibilitychange', onVisibilityChange);
      if (state.activitiesChannel) {
        state.activitiesChannel.unsubscribe();
        state.activitiesChannel = null;
      }
      if (state.requestsChannel) {
        state.requestsChannel.unsubscribe();
        state.requestsChannel = null;
      }
    }
  };

  // ============================================
  // 13. Start
  // ============================================
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  // Cleanup عند مغادرة الصفحة
  window.addEventListener('beforeunload', function () {
    if (window.AdminDashboard && window.AdminDashboard.destroy) {
      window.AdminDashboard.destroy();
    }
  });

})();
