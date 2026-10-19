// ============================================
// [25/50] ITWS Platform - Student Page Logic
// Path: assets/js/pages/student.js
// ============================================
// يدعم فصل النقابة عن الأكاديميات (issuer_type)
// بدون إيموجي
// مسارات نسبية
// ============================================

(function () {
  'use strict';

  if (window.StudentPage && window.StudentPage.initialized) return;

  var state = {
    currentNationalId: null,
    certificates: [],
    academies: {},
    branches: {},
    studentName: '',
    initialized: false,
    loading: false
  };

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
        year: 'numeric', month: 'long', day: 'numeric'
      });
    } catch (e) {
      return '—';
    }
  }

  function getSetting(p, f) {
    if (window.AppSettings && window.AppSettings.get) {
      return window.AppSettings.get(p, f);
    }
    if (window.ITWS_SETTINGS_DEFAULTS) {
      var parts = p.split('.');
      var value = window.ITWS_SETTINGS_DEFAULTS;
      for (var i = 0; i < parts.length; i++) {
        if (value && typeof value === 'object') value = value[parts[i]];
        else { value = undefined; break; }
      }
      if (value !== undefined) return value;
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
      console.log.apply(console, ['[StudentPage]'].concat(Array.prototype.slice.call(arguments)));
    }
  }

  function resolve(path) {
    if (!path) return '#';
    if (window.resolveUrl) return window.resolveUrl(path);
    var base = (window.ITWS_CONFIG && window.ITWS_CONFIG.BASE_PATH) || '';
    return base + String(path).replace(/^\.?\//, '');
  }

  function gradeClass(grade) {
    if (!grade) return '';
    var g = String(grade).toUpperCase().replace(/[+-]/g, '');
    if (g === 'A') return 'excellent';
    if (g === 'B') return 'very-good';
    if (g === 'C') return 'good';
    if (g === 'D') return 'pass';
    return 'fail';
  }

  function gradeRank(grade) {
    if (!grade) return 0;
    var g = String(grade).toUpperCase().replace(/[+-]/g, '');
    if (g === 'A') return 5;
    if (g === 'B') return 4;
    if (g === 'C') return 3;
    if (g === 'D') return 2;
    return 1;
  }

  function getBestGrade(certs) {
    if (!certs || certs.length === 0) return '—';
    var best = certs[0].grade;
    var bestRank = gradeRank(best);
    for (var i = 1; i < certs.length; i++) {
      var rank = gradeRank(certs[i].grade);
      if (rank > bestRank) {
        best = certs[i].grade;
        bestRank = rank;
      }
    }
    return best || '—';
  }

  function applyDynamicContent() {
    setText('footerCopyright', getSetting('app_identity.footer_text', '© 2026 نقابة تكنولوجيا المعلومات والبرمجيات'));
    setText('footerPresidentLabel', getSetting('app_identity.president_label', 'النقيب العام:'));
    setText('footerPresidentName', getSetting('app_identity.president_name', 'المحاسب / محمود جميل'));
  }

  function loadCertificates(nationalId) {
    if (!window.sb) {
      return Promise.reject(new Error('Supabase not available'));
    }

    return window.sb
      .from('certificates')
      .select('*')
      .eq('student_national_id', nationalId)
      .eq('is_active', true)
      .order('issued_at', { ascending: false });
  }

  // ✅ تحميل بيانات الأكاديميات فقط (النقابة مش هتكون في الجدول)
  function loadAcademiesDetails(certs) {
    if (!certs || certs.length === 0) return Promise.resolve();

    var academyIds = [];
    var branchIds = [];

    certs.forEach(function (c) {
      // ✅ نضيف بس اللي عنده academy_id (شهادة من أكاديمية)
      if (c.academy_id && academyIds.indexOf(c.academy_id) === -1) academyIds.push(c.academy_id);
      if (c.branch_id && branchIds.indexOf(c.branch_id) === -1) branchIds.push(c.branch_id);
    });

    var promises = [];

    if (academyIds.length > 0) {
      promises.push(
        window.sb
          .from('academies')
          .select('id, name, license_number, logo_url, category_id, academy_type')
          .in('id', academyIds)
          .then(function (res) {
            if (res.data) {
              res.data.forEach(function (a) {
                state.academies[a.id] = a;
              });
            }
          })
          .catch(function () {})
      );
    } else {
      promises.push(Promise.resolve());
    }

    if (branchIds.length > 0) {
      promises.push(
        window.sb
          .from('academy_branches')
          .select('id, governorate, address')
          .in('id', branchIds)
          .then(function (res) {
            if (res.data) {
              res.data.forEach(function (b) {
                state.branches[b.id] = b;
              });
            }
          })
          .catch(function () {})
      );
    } else {
      promises.push(Promise.resolve());
    }

    return Promise.all(promises);
  }

  function logSearch(nationalId, count) {
    if (!window.sb) return;

    window.sb.from('search_logs').insert({
      search_type: 'student',
      search_value: nationalId,
      result_count: count,
      user_agent: navigator.userAgent.substring(0, 200)
    }).catch(function () {});
  }

  function renderResult(nationalId) {
    var container = $('studentResult');
    if (!container) return;

    var certs = state.certificates;
    var studentName = state.studentName || 'متدرب';
    var initial = escapeHtml(studentName.charAt(0));

    var totalCerts = certs.length;
    var totalIssuers = {};
    var unionCount = 0;
    var academyCount = 0;

    certs.forEach(function (c) {
      var isUnion = c.issuer_type === 'union' || !c.academy_id;
      if (isUnion) {
        unionCount++;
        totalIssuers['__union__'] = true;
      } else {
        academyCount++;
        var key = c.academy_id || c.academy_name || 'unknown';
        totalIssuers[key] = true;
      }
    });

    var issuersCount = Object.keys(totalIssuers).length;
    var bestGrade = getBestGrade(certs);
    var maskedId = '•••• •••• •••• ' + escapeHtml(String(nationalId).slice(-4));

    // ✅ بناء قائمة الشهادات مع مراعاة النوع
    var certsHtml = certs.map(function (cert) {
      var academy = cert.academy_id ? state.academies[cert.academy_id] : null;
      var branch = cert.branch_id ? state.branches[cert.branch_id] : null;

      // ✅ تحديد نوع الجهة
      var isUnion = cert.issuer_type === 'union' || !cert.academy_id;

      var issuerLabel, issuerName, branchLabel, branchName;

      if (isUnion) {
        issuerLabel = 'الجهة المُصدرة';
        issuerName = 'نقابة تكنولوجيا المعلومات';
        branchLabel = null;
        branchName = null;
      } else {
        issuerLabel = 'الأكاديمية';
        issuerName = academy ? academy.name : (cert.academy_name || '—');
        branchLabel = 'الفرع';
        branchName = branch ? branch.governorate : (cert.branch_name || '—');
      }

      var gradeCls = gradeClass(cert.grade);
      var issuedDate = formatDate(cert.issued_at);
      var courseHours = cert.course_hours ? cert.course_hours + ' ساعة' : '—';

      return '' +
        '<div class="cert-item">' +
          '<div class="cert-item-icon">' +
            '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">' +
              '<circle cx="12" cy="8" r="7"></circle>' +
              '<polyline points="8.21 13.89 7 23 12 20 17 23 15.79 13.88"></polyline>' +
            '</svg>' +
          '</div>' +
          '<div class="cert-item-main">' +
            '<h3 class="cert-item-course">' + escapeHtml(cert.course_name || 'دورة تدريبية') + '</h3>' +
            '<div class="cert-item-code">' + escapeHtml(cert.certificate_code || '—') + '</div>' +
          '</div>' +
          '<div class="cert-item-details">' +
            '<div class="cert-item-detail">' +
              '<span class="cert-item-detail-label">' + issuerLabel + '</span>' +
              '<span class="cert-item-detail-value">' + escapeHtml(issuerName) + '</span>' +
            '</div>' +
            (branchName
              ? '<div class="cert-item-detail">' +
                  '<span class="cert-item-detail-label">' + branchLabel + '</span>' +
                  '<span class="cert-item-detail-value">' + escapeHtml(branchName) + '</span>' +
                '</div>'
              : '') +
            '<div class="cert-item-detail">' +
              '<span class="cert-item-detail-label">الساعات</span>' +
              '<span class="cert-item-detail-value">' + escapeHtml(courseHours) + '</span>' +
            '</div>' +
            '<div class="cert-item-detail">' +
              '<span class="cert-item-detail-label">التقدير</span>' +
              '<span class="cert-item-detail-value">' +
                '<span class="cert-grade ' + gradeCls + '">' + escapeHtml(cert.grade || '—') + '</span>' +
              '</span>' +
            '</div>' +
            '<div class="cert-item-detail">' +
              '<span class="cert-item-detail-label">تاريخ الإصدار</span>' +
              '<span class="cert-item-detail-value">' + issuedDate + '</span>' +
            '</div>' +
          '</div>' +
          '<div class="cert-item-actions">' +
            '<a href="' + resolve('verify.html?code=' + encodeURIComponent(cert.certificate_code)) + '" class="cert-action-btn">' +
              '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">' +
                '<path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path>' +
                '<circle cx="12" cy="12" r="3"></circle>' +
              '</svg>' +
              '<span>عرض</span>' +
            '</a>' +
            '<button class="cert-action-btn" onclick="StudentPage.printCertificate(\'' + escapeHtml(cert.certificate_code) + '\')" type="button">' +
              '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">' +
                '<polyline points="6 9 6 2 18 2 18 9"></polyline>' +
                '<path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"></path>' +
                '<rect x="6" y="14" width="12" height="8"></rect>' +
              '</svg>' +
              '<span>طباعة</span>' +
            '</button>' +
          '</div>' +
        '</div>';
    }).join('');

    var html = '' +
      '<div class="profile-card">' +
        '<div class="profile-header">' +
          '<div class="profile-avatar">' + initial + '</div>' +
          '<div class="profile-info">' +
            '<h2 class="profile-name">' + escapeHtml(studentName) + '</h2>' +
            '<div class="profile-meta">' +
              '<div class="profile-meta-item">' +
                '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="width:14px;height:14px;">' +
                  '<rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect>' +
                  '<path d="M7 11V7a5 5 0 0 1 10 0v4"></path>' +
                '</svg>' +
                '<span class="mono">' + maskedId + '</span>' +
              '</div>' +
            '</div>' +
          '</div>' +
          '<div class="profile-actions">' +
            '<button class="profile-btn primary" onclick="StudentPage.downloadCV()" type="button">' +
              '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">' +
                '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>' +
                '<polyline points="7 10 12 15 17 10"></polyline>' +
                '<line x1="12" y1="15" x2="12" y2="3"></line>' +
              '</svg>' +
              '<span>تحميل السيرة الذاتية</span>' +
            '</button>' +
            '<button class="profile-btn" onclick="StudentPage.sharePage()" type="button">' +
              '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">' +
                '<circle cx="18" cy="5" r="3"></circle>' +
                '<circle cx="6" cy="12" r="3"></circle>' +
                '<circle cx="18" cy="19" r="3"></circle>' +
                '<line x1="8.59" y1="13.51" x2="15.42" y2="17.49"></line>' +
                '<line x1="15.41" y1="6.51" x2="8.59" y2="10.49"></line>' +
              '</svg>' +
              '<span>مشاركة الصفحة</span>' +
            '</button>' +
          '</div>' +
        '</div>' +
        '<div class="profile-stats">' +
          '<div class="profile-stat">' +
            '<div class="profile-stat-value">' + totalCerts + '</div>' +
            '<div class="profile-stat-label">شهادة معتمدة</div>' +
          '</div>' +
          '<div class="profile-stat">' +
            '<div class="profile-stat-value">' + issuersCount + '</div>' +
            '<div class="profile-stat-label">جهة مُصدرة</div>' +
          '</div>' +
          '<div class="profile-stat">' +
            '<div class="profile-stat-value">' + escapeHtml(bestGrade) + '</div>' +
            '<div class="profile-stat-label">أعلى تقدير</div>' +
          '</div>' +
        '</div>' +
      '</div>' +
      '<div class="certificates-section">' +
        '<div class="certificates-header">' +
          '<h2 class="certificates-title">الشهادات المعتمدة</h2>' +
          '<span class="certificates-count">' + totalCerts + ' شهادة</span>' +
        '</div>' +
        '<div class="certificates-list">' + certsHtml + '</div>' +
      '</div>';

    container.innerHTML = html;
    container.classList.add('show');

    var error = $('studentError');
    if (error) error.classList.remove('show');

    setTimeout(function () {
      container.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 100);
  }

  function showError(title, text) {
    var error = $('studentError');
    if (!error) return;

    setText('errorTitle', title);
    setText('errorText', text);
    error.classList.add('show');

    var result = $('studentResult');
    if (result) result.classList.remove('show');
  }

  function performSearch(nationalId) {
    if (!nationalId) {
      toast('أدخل الرقم القومي', 'error');
      return;
    }

    if (!/^\d{14}$/.test(nationalId)) {
      toast('الرقم القومي يجب أن يكون 14 رقماً', 'error');
      return;
    }

    if (state.loading) return;
    state.loading = true;

    var loader = $('studentLoader');
    var error = $('studentError');
    var result = $('studentResult');
    var btn = $('studentBtn');

    if (loader) loader.classList.add('show');
    if (error) error.classList.remove('show');
    if (result) result.classList.remove('show');
    if (btn) { btn.disabled = true; btn.textContent = 'جاري البحث...'; }

    state.certificates = [];
    state.academies = {};
    state.branches = {};
    state.studentName = '';

    loadCertificates(nationalId)
      .then(function (res) {
        if (res.error) throw new Error(res.error.message);
        var certs = res.data || [];

        if (certs.length === 0) {
          if (loader) loader.classList.remove('show');
          if (btn) { btn.disabled = false; btn.textContent = 'بحث'; }
          showError('لم يتم العثور على شهادات', 'لا توجد شهادات مسجلة بهذا الرقم القومي. تواصل مع الجهة المُصدرة.');
          logSearch(nationalId, 0);
          state.loading = false;
          return;
        }

        state.certificates = certs;
        state.studentName = certs[0].student_name || 'متدرب';
        state.currentNationalId = nationalId;

        return loadAcademiesDetails(certs).then(function () {
          if (loader) loader.classList.remove('show');
          if (btn) { btn.disabled = false; btn.textContent = 'بحث'; }
          renderResult(nationalId);
          logSearch(nationalId, certs.length);
          state.loading = false;
        });
      })
      .catch(function (err) {
        if (loader) loader.classList.remove('show');
        if (btn) { btn.disabled = false; btn.textContent = 'بحث'; }
        showError('حدث خطأ', err.message || 'يرجى المحاولة مرة أخرى');
        toast('حدث خطأ في البحث', 'error');
        state.loading = false;
      });
  }

  function printCertificate(code) {
    if (!code) return;
    var url = resolve('verify.html?code=' + encodeURIComponent(code) + '&print=1');
    window.open(url, '_blank');
  }

  function downloadCV() {
    if (!state.certificates || state.certificates.length === 0) {
      toast('لا توجد شهادات لإنشاء السيرة الذاتية', 'error');
      return;
    }

    if (getSetting('features.enable_ai_cv', true) === false) {
      toast('ميزة السيرة الذاتية غير متاحة حالياً', 'info');
      return;
    }

    toast('جاري تجهيز السيرة الذاتية...', 'info');

    if (window.html2pdf) {
      generateCVWithHtml2Pdf();
    } else {
      generateCVFallback();
    }
  }

  function generateCVWithHtml2Pdf() {
    var cvHtml = buildCVHtml();

    var tempDiv = document.createElement('div');
    tempDiv.innerHTML = cvHtml;
    tempDiv.style.position = 'absolute';
    tempDiv.style.left = '-9999px';
    tempDiv.style.top = '0';
    tempDiv.style.width = '800px';
    tempDiv.style.background = '#fff';
    tempDiv.style.color = '#000';
    document.body.appendChild(tempDiv);

    var element = tempDiv.querySelector('.cv-paper');

    var opt = {
      margin: 0,
      filename: 'CV-' + (state.studentName || 'student').replace(/\s+/g, '-') + '.pdf',
      image: { type: 'jpeg', quality: 0.98 },
      html2canvas: { scale: 2, useCORS: true, backgroundColor: '#ffffff' },
      jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' }
    };

    window.html2pdf().set(opt).from(element).save()
      .then(function () {
        document.body.removeChild(tempDiv);
        toast('تم تحميل السيرة الذاتية بنجاح', 'success');
      })
      .catch(function (err) {
        document.body.removeChild(tempDiv);
        toast('حدث خطأ في تحميل السيرة الذاتية', 'error');
        logDebug('CV error:', err.message);
      });
  }

  function buildCVHtml() {
    var certs = state.certificates;
    var studentName = state.studentName || 'متدرب';
    var unionName = getSetting('app_identity.union_name', 'نقابة تكنولوجيا المعلومات والبرمجيات');
    var committeeName = getSetting('app_identity.committee_name', 'لجنة التحول الرقمي والتدريب');
    var presidentName = getSetting('app_identity.president_name', 'المحاسب / محمود جميل');
    var logoUrl = getSetting('app_identity.logo_url', null);
    var nationalId = state.currentNationalId || '';
    var maskedId = nationalId ? '•••• •••• •••• ' + String(nationalId).slice(-4) : '';
    var issueDate = new Date().toLocaleDateString('ar-EG', { year: 'numeric', month: 'long', day: 'numeric' });

    var logoHtml = logoUrl
      ? '<img src="' + escapeHtml(logoUrl) + '" style="width:64px;height:64px;object-fit:contain;border-radius:50%;border:2px solid #CE1126;padding:4px;background:#fff;" crossorigin="anonymous">'
      : '<div style="width:64px;height:64px;border-radius:50%;background:#CE1126;color:#fff;display:flex;align-items:center;justify-content:center;font-size:24px;font-weight:800;">نت</div>';

    var certsRows = certs.map(function (c, i) {
      var isUnion = c.issuer_type === 'union' || !c.academy_id;
      var issuerName;

      if (isUnion) {
        issuerName = 'نقابة تكنولوجيا المعلومات';
      } else {
        var academy = c.academy_id ? state.academies[c.academy_id] : null;
        issuerName = academy ? academy.name : (c.academy_name || '—');
      }

      var issuedDate = formatDate(c.issued_at);

      return '' +
        '<tr style="border-bottom:1px solid #e5e5e5;">' +
          '<td style="padding:10px 8px;font-size:11px;color:#666;text-align:center;">' + (i + 1) + '</td>' +
          '<td style="padding:10px 8px;font-size:12px;color:#000;font-weight:600;">' + escapeHtml(c.course_name || '—') + '</td>' +
          '<td style="padding:10px 8px;font-size:11px;color:#333;">' + escapeHtml(issuerName) + '</td>' +
          '<td style="padding:10px 8px;font-size:11px;color:#333;text-align:center;">' + escapeHtml(c.course_hours ? c.course_hours + ' س' : '—') + '</td>' +
          '<td style="padding:10px 8px;font-size:12px;color:#CE1126;font-weight:700;text-align:center;">' + escapeHtml(c.grade || '—') + '</td>' +
          '<td style="padding:10px 8px;font-size:11px;color:#666;text-align:center;">' + escapeHtml(issuedDate) + '</td>' +
        '</tr>';
    }).join('');

    return '' +
      '<div class="cv-paper" style="width:210mm;min-height:297mm;background:#fff;color:#1a1a1a;font-family:Cairo,sans-serif;direction:rtl;padding:20mm 18mm;box-sizing:border-box;position:relative;">' +
        '<div style="display:flex;align-items:center;justify-content:space-between;border-bottom:3px solid #CE1126;padding-bottom:16px;margin-bottom:24px;">' +
          '<div style="display:flex;align-items:center;gap:14px;">' +
            logoHtml +
            '<div>' +
              '<div style="font-size:18px;font-weight:800;color:#CE1126;line-height:1.3;">' + escapeHtml(unionName) + '</div>' +
              '<div style="font-size:12px;color:#666;margin-top:4px;">' + escapeHtml(committeeName) + '</div>' +
            '</div>' +
          '</div>' +
          '<div style="text-align:left;">' +
            '<div style="font-size:11px;color:#666;">' + issueDate + '</div>' +
            '<div style="font-size:10px;color:#999;margin-top:2px;">سيرة ذاتية معتمدة</div>' +
          '</div>' +
        '</div>' +

        '<div style="background:#f8f8f8;border-right:4px solid #CE1126;padding:16px 20px;margin-bottom:24px;">' +
          '<div style="font-size:24px;font-weight:800;color:#1a1a1a;margin-bottom:6px;">' + escapeHtml(studentName) + '</div>' +
          '<div style="font-size:12px;color:#666;">الرقم القومي: ' + maskedId + '</div>' +
          '<div style="font-size:12px;color:#666;margin-top:4px;">عدد الشهادات المعتمدة: <strong style="color:#CE1126;">' + certs.length + '</strong></div>' +
        '</div>' +

        '<div style="margin-bottom:24px;">' +
          '<div style="font-size:14px;font-weight:700;color:#CE1126;border-bottom:2px solid #CE1126;padding-bottom:6px;margin-bottom:12px;">الملخص المهني</div>' +
          '<p style="font-size:12px;color:#333;line-height:1.8;margin:0;">' +
            'حاصل على ' + certs.length + ' شهادة تدريبية معتمدة من جهات معتمدة رسمياً من ' + escapeHtml(unionName) + '. ' +
            'جميع الشهادات موثقة رسمياً ومُتحقق منها إلكترونياً.' +
          '</p>' +
        '</div>' +

        '<div style="margin-bottom:24px;">' +
          '<div style="font-size:14px;font-weight:700;color:#CE1126;border-bottom:2px solid #CE1126;padding-bottom:6px;margin-bottom:12px;">الشهادات التدريبية</div>' +
          '<table style="width:100%;border-collapse:collapse;">' +
            '<thead>' +
              '<tr style="background:#CE1126;color:#fff;">' +
                '<th style="padding:8px;font-size:10px;font-weight:700;text-align:center;">#</th>' +
                '<th style="padding:8px;font-size:10px;font-weight:700;text-align:right;">اسم الدورة</th>' +
                '<th style="padding:8px;font-size:10px;font-weight:700;text-align:right;">الجهة المُصدرة</th>' +
                '<th style="padding:8px;font-size:10px;font-weight:700;text-align:center;">الساعات</th>' +
                '<th style="padding:8px;font-size:10px;font-weight:700;text-align:center;">التقدير</th>' +
                '<th style="padding:8px;font-size:10px;font-weight:700;text-align:center;">التاريخ</th>' +
              '</tr>' +
            '</thead>' +
            '<tbody>' + certsRows + '</tbody>' +
          '</table>' +
        '</div>' +

        '<div style="position:absolute;bottom:18mm;left:18mm;right:18mm;border-top:2px solid #CE1126;padding-top:12px;display:flex;justify-content:space-between;align-items:center;">' +
          '<div>' +
            '<div style="font-size:10px;color:#666;">النقيب العام</div>' +
            '<div style="font-size:12px;font-weight:700;color:#1a1a1a;margin-top:2px;">' + escapeHtml(presidentName) + '</div>' +
          '</div>' +
          '<div style="text-align:left;">' +
            '<div style="font-size:10px;color:#666;">للتحقق من صحة الشهادات</div>' +
            '<div style="font-size:11px;color:#CE1126;font-weight:700;margin-top:2px;">verify.itws.eg</div>' +
          '</div>' +
        '</div>' +
      '</div>';
  }

  function generateCVFallback() {
    var html = '<!DOCTYPE html><html dir="rtl"><head><meta charset="UTF-8"><title>CV - ' + escapeHtml(state.studentName) + '</title>' +
      '<link href="https://fonts.googleapis.com/css2?family=Cairo:wght@400;600;700;800&display=swap" rel="stylesheet">' +
      '<style>body{margin:0;background:#fff;font-family:Cairo,sans-serif;}@media print{@page{margin:0;size:A4;}.cv-paper{margin:0!important;box-shadow:none!important;}}</style>' +
      '</head><body>' + buildCVHtml() + '</body></html>';

    var win = window.open('', '_blank');
    if (!win) {
      toast('الرجاء السماح بالنوافذ المنبثقة', 'error');
      return;
    }
    win.document.write(html);
    win.document.close();

    win.onload = function () {
      setTimeout(function () {
        win.print();
      }, 500);
    };
  }

  function sharePage() {
    if (!state.currentNationalId) return;
    var url = window.location.origin + window.location.pathname + '?id=' + encodeURIComponent(state.currentNationalId);

    if (navigator.share) {
      navigator.share({
        title: 'شهادات المتدرب - ' + (state.studentName || ''),
        text: 'شهادات معتمدة من نقابة تكنولوجيا المعلومات',
        url: url
      }).catch(function () {});
    } else if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(url).then(function () {
        toast('تم نسخ الرابط', 'success');
      }).catch(function () {
        prompt('انسخ الرابط:', url);
      });
    } else {
      prompt('انسخ الرابط:', url);
    }
  }

  function handleSubmit(e) {
    if (e) e.preventDefault();
    var input = $('nationalIdInput');
    var value = input ? input.value.trim() : '';
    if (!value) {
      toast('أدخل الرقم القومي', 'error');
      if (input) input.focus();
      return false;
    }
    performSearch(value);
    return false;
  }

  function init() {
    if (state.initialized) return;
    state.initialized = true;

    applyDynamicContent();

    var form = $('studentForm');
    if (form) form.addEventListener('submit', handleSubmit);

    var input = $('nationalIdInput');
    if (input) {
      input.addEventListener('input', function () {
        this.value = this.value.replace(/[^0-9]/g, '').substring(0, 14);
      });

      input.addEventListener('keydown', function (e) {
        if (e.key === 'Enter') {
          e.preventDefault();
          handleSubmit();
        }
      });
    }

    if (window.AppSettings && window.AppSettings.onChange) {
      window.AppSettings.onChange(function (cache, key) {
        if (!key || key === 'app_identity') applyDynamicContent();
      });
    }

    var params = new URLSearchParams(window.location.search);
    var id = params.get('id') || params.get('nationalId');
    if (id && /^\d{14}$/.test(id)) {
      if (input) input.value = id;
      setTimeout(function () { performSearch(id); }, 400);
    }

    logDebug('Student page initialized');
  }

  window.StudentPage = {
    initialized: true,
    init: init,
    performSearch: performSearch,
    downloadCV: downloadCV,
    sharePage: sharePage,
    printCertificate: printCertificate
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

})();
