// ============================================
// [47/50] ITWS Platform - Admin Reports Logic
// Path: assets/js/pages/admin/reports.js
// ============================================
// تقارير وإحصائيات النظام
// 8 Charts + 3 Tables + Export PDF/Excel
// بدون إيموجي
// ============================================

(function () {
  'use strict';

  if (window.AdminReports && window.AdminReports.initialized) return;

  // ============ حالة ============
  var state = {
    certificates: [],
    academies: [],
    categories: [],
    branches: [],
    activities: [],
    filteredCertificates: [],
    filteredAcademies: [],
    filteredActivities: [],
    currentUser: null,
    activeTab: 'certificates',
    filters: {
      dateFrom: '',
      dateTo: '',
      issuer: '',
      academyId: ''
    },
    charts: {},
    loading: false,
    initialized: false
  };

  // ============ Chart.js defaults ============
  var CHART_COLORS = [
    '#CE1126', '#10B981', '#3B82F6', '#F59E0B', '#8B5CF6',
    '#EC4899', '#06B6D4', '#F97316', '#6366F1', '#14B8A6',
    '#84CC16', '#EF4444'
  ];

  function setupChartDefaults() {
    if (typeof Chart === 'undefined') return;

    Chart.defaults.color = '#94A3B8';
    Chart.defaults.borderColor = 'rgba(255,255,255,0.06)';
    Chart.defaults.font.family = 'Cairo, sans-serif';
    Chart.defaults.font.size = 11;
    Chart.defaults.plugins.legend.labels.usePointStyle = true;
    Chart.defaults.plugins.legend.labels.pointStyle = 'circle';
    Chart.defaults.plugins.legend.labels.boxWidth = 8;
    Chart.defaults.plugins.legend.labels.padding = 10;
    Chart.defaults.plugins.tooltip.backgroundColor = '#1C2430';
    Chart.defaults.plugins.tooltip.titleColor = '#F8FAFC';
    Chart.defaults.plugins.tooltip.bodyColor = '#94A3B8';
    Chart.defaults.plugins.tooltip.borderColor = 'rgba(255,255,255,0.1)';
    Chart.defaults.plugins.tooltip.borderWidth = 1;
    Chart.defaults.plugins.tooltip.padding = 10;
    Chart.defaults.plugins.tooltip.cornerRadius = 8;
    Chart.defaults.plugins.tooltip.titleFont = { family: 'Cairo', weight: 'bold', size: 12 };
    Chart.defaults.plugins.tooltip.bodyFont = { family: 'Cairo', size: 11 };
  }

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

  function formatNumber(n) {
    if (n == null) return '0';
    return Number(n).toLocaleString('ar-EG');
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

  function toast(msg, type) {
    if (window.Utils && window.Utils.showToast) {
      window.Utils.showToast(msg, type || 'info');
    } else if (type === 'error') {
      alert(msg);
    }
  }

  function logDebug() {
    if (window.ITWS_CONFIG && window.ITWS_CONFIG.DEBUG) {
      console.log.apply(console, ['[AdminReports]'].concat(Array.prototype.slice.call(arguments)));
    }
  }

  // ============ Loaders ============
  function loadCertificates() {
    if (!window.sb) return Promise.resolve([]);
    return window.sb
      .from('certificates')
      .select('id, certificate_code, student_name, course_name, course_hours, grade, issuer_type, academy_id, academy_name, is_active, issued_at, created_at')
      .order('issued_at', { ascending: false })
      .then(function (res) {
        if (res.error) throw new Error(res.error.message);
        return res.data || [];
      });
  }

  function loadAcademies() {
    if (!window.sb) return Promise.resolve([]);
    return window.sb
      .from('academies')
      .select('id, name, license_number, category_id, status, is_deleted, approved_at, created_at')
      .eq('is_deleted', false)
      .then(function (res) {
        if (res.error) return [];
        return res.data || [];
      });
  }

  function loadCategories() {
    if (!window.sb) return Promise.resolve([]);
    return window.sb
      .from('academy_categories')
      .select('id, name, color')
      .eq('is_active', true)
      .then(function (res) {
        if (res.error) return [];
        return res.data || [];
      });
  }

  function loadBranches() {
    if (!window.sb) return Promise.resolve([]);
    return window.sb
      .from('academy_branches')
      .select('id, academy_id, governorate')
      .then(function (res) {
        if (res.error) return [];
        return res.data || [];
      });
  }

  function loadActivities() {
    if (!window.sb) return Promise.resolve([]);
    return window.sb
      .from('activities')
      .select('id, user_id, user_name, user_role, action_type, created_at, type')
      .order('created_at', { ascending: false })
      .limit(2000)
      .then(function (res) {
        if (res.error) return [];
        return res.data || [];
      });
  }

  // ============ Filters ============
  function applyDateFilter(items, dateField) {
    var from = state.filters.dateFrom ? new Date(state.filters.dateFrom) : null;
    var to = state.filters.dateTo ? new Date(state.filters.dateTo) : null;
    if (to) to.setHours(23, 59, 59, 999);

    return items.filter(function (item) {
      var d = item[dateField];
      if (!d) return true;
      var date = d instanceof Date ? d : new Date(d);
      if (isNaN(date.getTime())) return true;
      if (from && date < from) return false;
      if (to && date > to) return false;
      return true;
    });
  }

  function applyFilters() {
    // Certificates
    var certs = state.certificates;
    certs = applyDateFilter(certs, 'issued_at');

    if (state.filters.issuer) {
      certs = certs.filter(function (c) {
        var isUnion = c.issuer_type === 'union' || !c.academy_id;
        if (state.filters.issuer === 'union') return isUnion;
        if (state.filters.issuer === 'academy') return !isUnion;
        return true;
      });
    }

    if (state.filters.academyId) {
      certs = certs.filter(function (c) { return c.academy_id === state.filters.academyId; });
    }

    state.filteredCertificates = certs;

    // Academies
    var acads = state.academies;
    acads = applyDateFilter(acads, 'created_at');
    state.filteredAcademies = acads;

    // Activities
    var acts = state.activities;
    acts = applyDateFilter(acts, 'created_at');
    state.filteredActivities = acts;
  }

  function syncFiltersFromUI() {
    state.filters.dateFrom = ($('dateFrom') || {}).value || '';
    state.filters.dateTo = ($('dateTo') || {}).value || '';
    state.filters.issuer = ($('issuerFilter') || {}).value || '';
    state.filters.academyId = ($('academyFilter') || {}).value || '';
  }

  function populateAcademyFilter() {
    var select = $('academyFilter');
    if (!select) return;

    var html = '<option value="">الكل</option>';
    state.academies.forEach(function (a) {
      html += '<option value="' + escapeHtml(a.id) + '">' + escapeHtml(a.name) + '</option>';
    });
    select.innerHTML = html;
  }

  // ============ Stats Updates ============
  function updateCertificateStats() {
    var certs = state.filteredCertificates;
    var total = certs.length;
    var union = certs.filter(function (c) {
      return c.issuer_type === 'union' || !c.academy_id;
    }).length;
    var academy = total - union;
    var active = certs.filter(function (c) { return c.is_active !== false; }).length;

    setText('certTotalStat', formatNumber(total));
    setText('certUnionStat', formatNumber(union));
    setText('certAcademyStat', formatNumber(academy));
    setText('certActiveStat', formatNumber(active));
  }

  function updateAcademyStats() {
    var acads = state.filteredAcademies;
    var total = acads.length;
    var approved = acads.filter(function (a) { return a.status === 'approved'; }).length;
    var pending = acads.filter(function (a) { return a.status === 'pending'; }).length;
    var branches = state.branches.length;

    setText('acadTotalStat', formatNumber(total));
    setText('acadApprovedStat', formatNumber(approved));
    setText('acadPendingStat', formatNumber(pending));
    setText('acadBranchesStat', formatNumber(branches));
  }

  function updateActivityStats() {
    var acts = state.filteredActivities;
    var total = acts.length;

    var today = new Date();
    today.setHours(0, 0, 0, 0);
    var todayCount = acts.filter(function (a) {
      var d = a.created_at ? new Date(a.created_at) : null;
      return d && d >= today;
    }).length;

    var logins = acts.filter(function (a) {
      var t = a.action_type || a.type;
      return t === 'login' || t === 'login_success';
    }).length;

    var changes = acts.filter(function (a) {
      var t = a.action_type || a.type || '';
      return t.indexOf('create') !== -1 || t.indexOf('update') !== -1 || t.indexOf('delete') !== -1;
    }).length;

    setText('actTotalStat', formatNumber(total));
    setText('actTodayStat', formatNumber(todayCount));
    setText('actLoginStat', formatNumber(logins));
    setText('actChangesStat', formatNumber(changes));
  }

  // ============ Charts ============
  function destroyChart(name) {
    if (state.charts[name]) {
      try { state.charts[name].destroy(); } catch (e) {}
      state.charts[name] = null;
    }
  }

  function renderChartCertByCategory() {
    var canvas = $('chartCertByCategory');
    if (!canvas) return;

    var counts = {};
    state.filteredCertificates.forEach(function (c) {
      var academy = state.academies.find(function (a) { return a.id === c.academy_id; });
      var catId = academy ? academy.category_id : null;
      var cat = state.categories.find(function (x) { return x.id === catId; });
      var key = cat ? cat.name : 'غير محدد';
      counts[key] = (counts[key] || 0) + 1;
    });

    var sorted = Object.keys(counts)
      .sort(function (a, b) { return counts[b] - counts[a]; })
      .slice(0, 8);

    var labels = sorted.length ? sorted : ['لا توجد بيانات'];
    var data = sorted.length ? sorted.map(function (k) { return counts[k]; }) : [0];

    destroyChart('certByCategory');
    state.charts.certByCategory = new Chart(canvas.getContext('2d'), {
      type: 'bar',
      data: {
        labels: labels,
        datasets: [{
          label: 'عدد الشهادات',
          data: data,
          backgroundColor: labels.map(function (_, i) { return CHART_COLORS[i % CHART_COLORS.length] + '80'; }),
          borderColor: labels.map(function (_, i) { return CHART_COLORS[i % CHART_COLORS.length]; }),
          borderWidth: 2,
          borderRadius: 6
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { display: false } },
        scales: {
          y: { beginAtZero: true, ticks: { precision: 0 } },
          x: { grid: { display: false } }
        }
      }
    });
  }

  function renderChartCertByGrade() {
    var canvas = $('chartCertByGrade');
    if (!canvas) return;

    var counts = {};
    state.filteredCertificates.forEach(function (c) {
      if (c.grade) counts[c.grade] = (counts[c.grade] || 0) + 1;
    });

    var labels = Object.keys(counts).sort();
    var data = labels.map(function (k) { return counts[k]; });

    if (labels.length === 0) {
      labels = ['لا توجد بيانات'];
      data = [1];
    }

    destroyChart('certByGrade');
    state.charts.certByGrade = new Chart(canvas.getContext('2d'), {
      type: 'doughnut',
      data: {
        labels: labels,
        datasets: [{
          data: data,
          backgroundColor: labels.map(function (_, i) { return CHART_COLORS[i % CHART_COLORS.length] + '90'; }),
          borderColor: labels.map(function (_, i) { return CHART_COLORS[i % CHART_COLORS.length]; }),
          borderWidth: 2
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { position: 'bottom' }
        }
      }
    });
  }

  function renderChartCertMonthly() {
    var canvas = $('chartCertMonthly');
    if (!canvas) return;

    // آخر 12 شهر
    var monthly = {};
    var labels = [];
    var values = [];

    for (var i = 11; i >= 0; i--) {
      var d = new Date();
      d.setDate(1);
      d.setMonth(d.getMonth() - i);
      var key = d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0');
      monthly[key] = 0;
      labels.push(d.toLocaleDateString('ar-EG', { month: 'short', year: '2-digit' }));
    }

    state.filteredCertificates.forEach(function (c) {
      if (!c.issued_at) return;
      var d = new Date(c.issued_at);
      if (isNaN(d.getTime())) return;
      var key = d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0');
      if (monthly[key] !== undefined) monthly[key]++;
    });

    values = Object.keys(monthly).map(function (k) { return monthly[k]; });

    destroyChart('certMonthly');
    state.charts.certMonthly = new Chart(canvas.getContext('2d'), {
      type: 'line',
      data: {
        labels: labels,
        datasets: [{
          label: 'عدد الشهادات',
          data: values,
          borderColor: '#CE1126',
          backgroundColor: 'rgba(206, 17, 38, 0.1)',
          fill: true,
          tension: 0.4,
          pointBackgroundColor: '#CE1126',
          pointBorderColor: '#fff',
          pointBorderWidth: 2,
          pointRadius: 4
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { display: false } },
        scales: {
          y: { beginAtZero: true, ticks: { precision: 0 } },
          x: { grid: { display: false } }
        }
      }
    });
  }

  function renderChartCertTopAcademies() {
    var canvas = $('chartCertTopAcademies');
    if (!canvas) return;

    var counts = {};
    state.filteredCertificates.forEach(function (c) {
      if (!c.academy_id) return; // تجاهل النقابة
      var key = c.academy_name || 'غير محدد';
      counts[key] = (counts[key] || 0) + 1;
    });

    var sorted = Object.keys(counts)
      .sort(function (a, b) { return counts[b] - counts[a]; })
      .slice(0, 10);

    var labels = sorted.length ? sorted : ['لا توجد بيانات'];
    var data = sorted.length ? sorted.map(function (k) { return counts[k]; }) : [0];

    destroyChart('certTopAcademies');
    state.charts.certTopAcademies = new Chart(canvas.getContext('2d'), {
      type: 'bar',
      data: {
        labels: labels,
        datasets: [{
          label: 'عدد الشهادات',
          data: data,
          backgroundColor: labels.map(function (_, i) { return CHART_COLORS[i % CHART_COLORS.length] + '80'; }),
          borderColor: labels.map(function (_, i) { return CHART_COLORS[i % CHART_COLORS.length]; }),
          borderWidth: 2,
          borderRadius: 6
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        indexAxis: 'y',
        plugins: { legend: { display: false } },
        scales: {
          x: { beginAtZero: true, ticks: { precision: 0 } },
          y: { grid: { display: false } }
        }
      }
    });
  }

  function renderChartAcadByCategory() {
    var canvas = $('chartAcadByCategory');
    if (!canvas) return;

    var counts = {};
    state.filteredAcademies.forEach(function (a) {
      var cat = state.categories.find(function (c) { return c.id === a.category_id; });
      var key = cat ? cat.name : 'غير محدد';
      counts[key] = (counts[key] || 0) + 1;
    });

    var labels = Object.keys(counts);
    var data = labels.map(function (k) { return counts[k]; });

    if (labels.length === 0) {
      labels = ['لا توجد بيانات'];
      data = [1];
    }

    destroyChart('acadByCategory');
    state.charts.acadByCategory = new Chart(canvas.getContext('2d'), {
      type: 'pie',
      data: {
        labels: labels,
        datasets: [{
          data: data,
          backgroundColor: labels.map(function (_, i) { return CHART_COLORS[i % CHART_COLORS.length] + '90'; }),
          borderColor: labels.map(function (_, i) { return CHART_COLORS[i % CHART_COLORS.length]; }),
          borderWidth: 2
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { position: 'bottom' } }
      }
    });
  }

  function renderChartAcadByGovernorate() {
    var canvas = $('chartAcadByGovernorate');
    if (!canvas) return;

    var counts = {};
    state.branches.forEach(function (b) {
      var key = b.governorate || 'غير محدد';
      counts[key] = (counts[key] || 0) + 1;
    });

    var sorted = Object.keys(counts)
      .sort(function (a, b) { return counts[b] - counts[a]; })
      .slice(0, 10);

    var labels = sorted.length ? sorted : ['لا توجد بيانات'];
    var data = sorted.length ? sorted.map(function (k) { return counts[k]; }) : [0];

    destroyChart('acadByGovernorate');
    state.charts.acadByGovernorate = new Chart(canvas.getContext('2d'), {
      type: 'bar',
      data: {
        labels: labels,
        datasets: [{
          label: 'عدد الفروع',
          data: data,
          backgroundColor: labels.map(function (_, i) { return CHART_COLORS[i % CHART_COLORS.length] + '80'; }),
          borderColor: labels.map(function (_, i) { return CHART_COLORS[i % CHART_COLORS.length]; }),
          borderWidth: 2,
          borderRadius: 6
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { display: false } },
        scales: {
          y: { beginAtZero: true, ticks: { precision: 0 } },
          x: { grid: { display: false } }
        }
      }
    });
  }

  function renderChartActByType() {
    var canvas = $('chartActByType');
    if (!canvas) return;

    var typeLabels = {
      'login': 'تسجيل دخول',
      'login_success': 'دخول',
      'logout': 'خروج',
      'create_academy': 'إضافة أكاديمية',
      'update_academy': 'تعديل أكاديمية',
      'delete_academy': 'حذف أكاديمية',
      'create_certificate': 'إضافة شهادة',
      'update_certificate': 'تعديل شهادة',
      'delete_certificate': 'حذف شهادة',
      'search_certificate': 'بحث شهادة',
      'search_academy': 'بحث أكاديمية',
      'view_certificate': 'عرض شهادة',
      'create_user': 'إضافة مستخدم',
      'update_user': 'تعديل مستخدم',
      'delete_user': 'حذف مستخدم',
      'approve_request': 'اعتماد طلب',
      'reject_request': 'رفض طلب',
      'move_request_stage': 'نقل مرحلة'
    };

    var counts = {};
    state.filteredActivities.forEach(function (a) {
      var key = a.action_type || a.type || 'other';
      counts[key] = (counts[key] || 0) + 1;
    });

    var sorted = Object.keys(counts)
      .sort(function (a, b) { return counts[b] - counts[a]; })
      .slice(0, 8);

    var labels = sorted.map(function (k) { return typeLabels[k] || k; });
    var data = sorted.map(function (k) { return counts[k]; });

    if (labels.length === 0) {
      labels = ['لا توجد بيانات'];
      data = [1];
    }

    destroyChart('actByType');
    state.charts.actByType = new Chart(canvas.getContext('2d'), {
      type: 'bar',
      data: {
        labels: labels,
        datasets: [{
          label: 'عدد النشاطات',
          data: data,
          backgroundColor: labels.map(function (_, i) { return CHART_COLORS[i % CHART_COLORS.length] + '80'; }),
          borderColor: labels.map(function (_, i) { return CHART_COLORS[i % CHART_COLORS.length]; }),
          borderWidth: 2,
          borderRadius: 6
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        indexAxis: 'y',
        plugins: { legend: { display: false } },
        scales: {
          x: { beginAtZero: true, ticks: { precision: 0 } },
          y: { grid: { display: false } }
        }
      }
    });
  }

  function renderChartActDaily() {
    var canvas = $('chartActDaily');
    if (!canvas) return;

    var daily = {};
    var labels = [];

    for (var i = 13; i >= 0; i--) {
      var d = new Date();
      d.setDate(d.getDate() - i);
      var key = d.toISOString().split('T')[0];
      daily[key] = 0;
      labels.push(d.toLocaleDateString('ar-EG', { month: 'short', day: 'numeric' }));
    }

    state.filteredActivities.forEach(function (a) {
      if (!a.created_at) return;
      var d = new Date(a.created_at);
      if (isNaN(d.getTime())) return;
      var key = d.toISOString().split('T')[0];
      if (daily[key] !== undefined) daily[key]++;
    });

    var values = Object.keys(daily).map(function (k) { return daily[k]; });

    destroyChart('actDaily');
    state.charts.actDaily = new Chart(canvas.getContext('2d'), {
      type: 'line',
      data: {
        labels: labels,
        datasets: [{
          label: 'عدد النشاطات',
          data: values,
          borderColor: '#10B981',
          backgroundColor: 'rgba(16, 185, 129, 0.1)',
          fill: true,
          tension: 0.4,
          pointBackgroundColor: '#10B981',
          pointBorderColor: '#fff',
          pointBorderWidth: 2,
          pointRadius: 4
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { display: false } },
        scales: {
          y: { beginAtZero: true, ticks: { precision: 0 } },
          x: { grid: { display: false } }
        }
      }
    });
  }

  function renderAllCharts() {
    renderChartCertByCategory();
    renderChartCertByGrade();
    renderChartCertMonthly();
    renderChartCertTopAcademies();
    renderChartAcadByCategory();
    renderChartAcadByGovernorate();
    renderChartActByType();
    renderChartActDaily();
  }

  // ============ Tables ============
  function renderAcademiesTable() {
    var tbody = $('acadTableBody');
    var countEl = $('acadTableCount');
    if (!tbody) return;

    var items = state.filteredAcademies;

    if (countEl) countEl.textContent = items.length + ' أكاديمية';

    if (items.length === 0) {
      tbody.innerHTML = '<tr><td colspan="7" style="text-align:center;padding:24px;color:var(--text-muted);">لا توجد أكاديميات</td></tr>';
      return;
    }

    // حساب عدد الشهادات لكل أكاديمية
    var certCounts = {};
    state.certificates.forEach(function (c) {
      if (c.academy_id) {
        certCounts[c.academy_id] = (certCounts[c.academy_id] || 0) + 1;
      }
    });

    // حساب الفروع لكل أكاديمية
    var branchCounts = {};
    state.branches.forEach(function (b) {
      if (b.academy_id) {
        branchCounts[b.academy_id] = (branchCounts[b.academy_id] || 0) + 1;
      }
    });

    var statusLabels = {
      'approved': 'معتمدة',
      'pending': 'قيد الاعتماد',
      'rejected': 'مرفوضة',
      'suspended': 'موقوفة',
      'expired': 'منتهية'
    };

    tbody.innerHTML = items.map(function (a) {
      var cat = state.categories.find(function (c) { return c.id === a.category_id; });
      var catName = cat ? cat.name : '—';
      var certs = certCounts[a.id] || 0;
      var branches = branchCounts[a.id] || 0;

      return '' +
        '<tr>' +
          '<td><strong>' + escapeHtml(a.name || '—') + '</strong></td>' +
          '<td class="mono">' + escapeHtml(a.license_number || '—') + '</td>' +
          '<td>' + escapeHtml(catName) + '</td>' +
          '<td>' + branches + '</td>' +
          '<td>' + certs + '</td>' +
          '<td>' + escapeHtml(statusLabels[a.status] || a.status || '—') + '</td>' +
          '<td class="mono">' + formatDate(a.approved_at) + '</td>' +
        '</tr>';
    }).join('');
  }

  function renderTopUsersTable() {
    var tbody = $('usersTableBody');
    var countEl = $('usersTableCount');
    if (!tbody) return;

    // حساب نشاطات كل مستخدم
    var userStats = {};
    state.filteredActivities.forEach(function (a) {
      if (!a.user_id) return;
      var key = a.user_id;
      if (!userStats[key]) {
        userStats[key] = {
          name: a.user_name || 'مستخدم',
          role: a.user_role || 'user',
          count: 0,
          lastAt: null
        };
      }
      userStats[key].count++;
      var date = a.created_at ? new Date(a.created_at) : null;
      if (date && (!userStats[key].lastAt || date > userStats[key].lastAt)) {
        userStats[key].lastAt = date;
      }
    });

    var sorted = Object.keys(userStats)
      .map(function (k) { return Object.assign({ id: k }, userStats[k]); })
      .sort(function (a, b) { return b.count - a.count; })
      .slice(0, 10);

    if (countEl) countEl.textContent = sorted.length + ' مستخدم';

    if (sorted.length === 0) {
      tbody.innerHTML = '<tr><td colspan="5" style="text-align:center;padding:24px;color:var(--text-muted);">لا توجد بيانات</td></tr>';
      return;
    }

    var roleLabels = {
      'super_admin': 'سوبر أدمن',
      'admin': 'أدمن',
      'committee_manager': 'إدارة اللجنة',
      'user': 'مستخدم'
    };

    tbody.innerHTML = sorted.map(function (u, i) {
      return '' +
        '<tr>' +
          '<td><strong>#' + (i + 1) + '</strong></td>' +
          '<td>' + escapeHtml(u.name) + '</td>' +
          '<td>' + escapeHtml(roleLabels[u.role] || u.role) + '</td>' +
          '<td><strong>' + formatNumber(u.count) + '</strong></td>' +
          '<td class="mono">' + formatDate(u.lastAt) + '</td>' +
        '</tr>';
    }).join('');
  }

  // ============ Render All ============
  function renderAll() {
    updateCertificateStats();
    updateAcademyStats();
    updateActivityStats();
    renderAllCharts();
    renderAcademiesTable();
    renderTopUsersTable();
  }

  // ============ Tabs ============
  function switchTab(tabName) {
    state.activeTab = tabName;

    document.querySelectorAll('.report-tab').forEach(function (t) {
      t.classList.toggle('active', t.getAttribute('data-tab') === tabName);
    });

    document.querySelectorAll('.tab-content').forEach(function (c) {
      c.classList.remove('active');
    });

    var tabId = 'tab' + tabName.charAt(0).toUpperCase() + tabName.slice(1);
    var tabEl = $(tabId);
    if (tabEl) tabEl.classList.add('active');

    // إعادة رسم الرسوم (لأن canvas يحتاج resize)
    setTimeout(function () {
      if (tabName === 'certificates') {
        renderChartCertByCategory();
        renderChartCertByGrade();
        renderChartCertMonthly();
        renderChartCertTopAcademies();
      } else if (tabName === 'academies') {
        renderChartAcadByCategory();
        renderChartAcadByGovernorate();
      } else if (tabName === 'activities') {
        renderChartActByType();
        renderChartActDaily();
      }
    }, 100);
  }

  // ============ Export PDF ============
  function exportPDF() {
    if (!window.html2pdf) {
      toast('مكتبة PDF غير محملة', 'error');
      return;
    }

    var activeContent = document.querySelector('.tab-content.active');
    if (!activeContent) return;

    toast('جاري تجهيز PDF...', 'info');

    // إنشاء نسخة من المحتوى للتصدير
    var printDiv = document.createElement('div');
    printDiv.style.cssText = 'padding:20px;background:#fff;color:#000;font-family:Cairo,sans-serif;direction:rtl;width:1200px;';
    printDiv.innerHTML = '<h1 style="text-align:center;color:#CE1126;margin-bottom:20px;font-size:24px;">' +
      'تقرير: ' + getTabName(state.activeTab) +
      '</h1>' +
      '<p style="text-align:center;color:#666;margin-bottom:20px;font-size:12px;">' +
      'تاريخ التقرير: ' + new Date().toLocaleDateString('ar-EG') +
      '</p>' +
      activeContent.cloneNode(true).innerHTML;

    // تعديل الألوان للطباعة
    printDiv.querySelectorAll('*').forEach(function (el) {
      if (el.tagName === 'CANVAS') {
        var img = document.createElement('img');
        try {
          img.src = el.toDataURL('image/png');
          img.style.width = '100%';
          img.style.maxWidth = '500px';
          el.parentNode.replaceChild(img, el);
        } catch (e) {}
      }
    });

    document.body.appendChild(printDiv);

    var opt = {
      margin: [10, 10, 10, 10],
      filename: 'report-' + state.activeTab + '-' + new Date().toISOString().split('T')[0] + '.pdf',
      image: { type: 'jpeg', quality: 0.95 },
      html2canvas: { scale: 2, useCORS: true, backgroundColor: '#ffffff' },
      jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' }
    };

    window.html2pdf().set(opt).from(printDiv).save()
      .then(function () {
        toast('تم تصدير PDF بنجاح', 'success');
        document.body.removeChild(printDiv);
      })
      .catch(function (err) {
        toast('حدث خطأ في تصدير PDF', 'error');
        document.body.removeChild(printDiv);
        logDebug('PDF export error:', err.message);
      });
  }

  function getTabName(tab) {
    return {
      'certificates': 'الشهادات',
      'academies': 'الأكاديميات',
      'activities': 'النشاطات'
    }[tab] || tab;
  }

  // ============ Export Excel ============
  function exportExcel() {
    if (!window.XLSX) {
      toast('مكتبة Excel غير محملة', 'error');
      return;
    }

    toast('جاري تجهيز Excel...', 'info');

    var wb = window.XLSX.utils.book_new();

    // Sheet 1: الشهادات
    var certData = state.filteredCertificates.map(function (c) {
      return {
        'الكود': c.certificate_code || '',
        'المتدرب': c.student_name || '',
        'الدورة': c.course_name || '',
        'الساعات': c.course_hours || '',
        'التقدير': c.grade || '',
        'الجهة': (c.issuer_type === 'union' || !c.academy_id) ? 'النقابة' : (c.academy_name || 'أكاديمية'),
        'التاريخ': formatDate(c.issued_at),
        'الحالة': c.is_active !== false ? 'نشطة' : 'غير نشطة'
      };
    });
    var ws1 = window.XLSX.utils.json_to_sheet(certData.length ? certData : [{ 'الكود': 'لا توجد بيانات' }]);
    window.XLSX.utils.book_append_sheet(wb, ws1, 'الشهادات');

    // Sheet 2: الأكاديميات
    var certCounts = {};
    state.certificates.forEach(function (c) {
      if (c.academy_id) certCounts[c.academy_id] = (certCounts[c.academy_id] || 0) + 1;
    });
    var branchCounts = {};
    state.branches.forEach(function (b) {
      if (b.academy_id) branchCounts[b.academy_id] = (branchCounts[b.academy_id] || 0) + 1;
    });

    var acadData = state.filteredAcademies.map(function (a) {
      var cat = state.categories.find(function (c) { return c.id === a.category_id; });
      return {
        'الاسم': a.name || '',
        'رقم الاعتماد': a.license_number || '',
        'التصنيف': cat ? cat.name : '',
        'الفروع': branchCounts[a.id] || 0,
        'الشهادات': certCounts[a.id] || 0,
        'الحالة': a.status || '',
        'تاريخ الاعتماد': formatDate(a.approved_at)
      };
    });
    var ws2 = window.XLSX.utils.json_to_sheet(acadData.length ? acadData : [{ 'الاسم': 'لا توجد بيانات' }]);
    window.XLSX.utils.book_append_sheet(wb, ws2, 'الأكاديميات');

    // Sheet 3: النشاطات
    var actData = state.filteredActivities.slice(0, 1000).map(function (a) {
      return {
        'المستخدم': a.user_name || '',
        'الدور': a.user_role || '',
        'النوع': a.action_type || a.type || '',
        'التاريخ': formatDate(a.created_at)
      };
    });
    var ws3 = window.XLSX.utils.json_to_sheet(actData.length ? actData : [{ 'المستخدم': 'لا توجد بيانات' }]);
    window.XLSX.utils.book_append_sheet(wb, ws3, 'النشاطات');

    // Save
    try {
      window.XLSX.writeFile(wb, 'report-' + new Date().toISOString().split('T')[0] + '.xlsx');
      toast('تم تصدير Excel بنجاح', 'success');
    } catch (e) {
      toast('حدث خطأ في تصدير Excel', 'error');
      logDebug('Excel export error:', e.message);
    }
  }

  // ============ Bind Events ============
  function bindEvents() {
    // Tabs
    document.querySelectorAll('.report-tab').forEach(function (tab) {
      tab.addEventListener('click', function () {
        var tabName = tab.getAttribute('data-tab');
        if (tabName) switchTab(tabName);
      });
    });

    // Apply filters
    var applyBtn = $('applyFiltersBtn');
    if (applyBtn) {
      applyBtn.addEventListener('click', function () {
        syncFiltersFromUI();
        applyFilters();
        renderAll();
        toast('تم تطبيق الفلاتر', 'success');
      });
    }

    // Reset filters
    var resetBtn = $('resetFiltersBtn');
    if (resetBtn) {
      resetBtn.addEventListener('click', function () {
        ['dateFrom', 'dateTo', 'issuerFilter', 'academyFilter'].forEach(function (id) {
          var el = $(id);
          if (el) el.value = '';
        });
        state.filters = { dateFrom: '', dateTo: '', issuer: '', academyId: '' };
        applyFilters();
        renderAll();
        toast('تم إعادة تعيين الفلاتر', 'info');
      });
    }

    // Export buttons
    var pdfBtn = $('exportPdfBtn');
    if (pdfBtn) pdfBtn.addEventListener('click', exportPDF);

    var excelBtn = $('exportExcelBtn');
    if (excelBtn) excelBtn.addEventListener('click', exportExcel);
  }

  // ============ Load All ============
  function loadAll() {
    var loader = $('reportsLoader');
    if (loader) loader.classList.add('show');

    return Promise.all([
      loadCertificates(),
      loadAcademies(),
      loadCategories(),
      loadBranches(),
      loadActivities()
    ])
      .then(function (results) {
        state.certificates = results[0] || [];
        state.academies = results[1] || [];
        state.categories = results[2] || [];
        state.branches = results[3] || [];
        state.activities = results[4] || [];

        if (loader) loader.classList.remove('show');

        populateAcademyFilter();
        applyFilters();
        renderAll();

        logDebug('Loaded:', {
          certs: state.certificates.length,
          acads: state.academies.length,
          cats: state.categories.length,
          branches: state.branches.length,
          acts: state.activities.length
        });
      })
      .catch(function (err) {
        if (loader) loader.classList.remove('show');
        toast('حدث خطأ في تحميل البيانات', 'error');
        logDebug('Load error:', err.message);
      });
  }

  // ============ Init ============
  function init() {
    if (state.initialized) return;
    state.initialized = true;

    if (window.AuthGuard && window.AuthGuard.getUser) {
      state.currentUser = window.AuthGuard.getUser();
    }

    setupChartDefaults();
    bindEvents();

    waitForSupabase(function () {
      loadAll();
    });

    logDebug('Admin reports initialized');
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

  // ============ Public API ============
  window.AdminReports = {
    initialized: true,
    init: init,
    refresh: loadAll,
    switchTab: switchTab,
    exportPDF: exportPDF,
    exportExcel: exportExcel,
    getState: function () { return state; }
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

})();
