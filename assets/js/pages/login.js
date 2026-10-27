/* ============================================================
   ITWS Platform — Login Page Logic
   File: assets/js/pages/login.js
   Role: Supabase auth + role-based redirect + form validation
   Rules: No emoji, all from settings, auto-redirect if logged in
   ============================================================ */
(function () {
  'use strict';

  if (window.LoginPage && window.LoginPage.initialized) return;

  var AUTH_TIMEOUT_MS = 25000;
  var PROFILE_TIMEOUT_MS = 10000;
  var SESSION_TIMEOUT_MS = 8000;

  var state = {
    submitting: false,
    attempts: 0,
    maxAttempts: 5,
    initialized: false,
    sb: null
  };

  function $(id) { return document.getElementById(id); }
  function setText(id, t) { var el = $(id); if (el) el.textContent = t; }

  function escapeHtml(s) {
    if (s == null) return '';
    return String(s)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  function getSetting(p, f) {
    if (window.AppSettings && typeof window.AppSettings.get === 'function') {
      var v = window.AppSettings.get(p);
      return (v === undefined || v === null) ? f : v;
    }
    return f;
  }

  function resolve(path) {
    if (!path) return '#';
    if (window.resolveUrl) return window.resolveUrl(path);
    var base = (window.ITWS_CONFIG && window.ITWS_CONFIG.BASE_PATH) || '';
    if (base && base.charAt(base.length - 1) !== '/') base += '/';
    return base + String(path).replace(/^\.?\//, '');
  }

  function withTimeout(promise, ms, label) {
    return Promise.race([
      promise,
      new Promise(function (_, reject) {
        setTimeout(function () {
          reject(new Error('انتهت مهلة ' + (label || 'العملية') + ' — تحقق من الاتصال أو أعد تحميل الصفحة'));
        }, ms);
      })
    ]);
  }

  function safeInsert(client, table, data) {
    if (!client || typeof client.from !== 'function') return;
    Promise.resolve().then(function () {
      return client.from(table).insert(data);
    }).then(function () {
      // success — ignore
    }, function (e) {
      console.warn('[Login] insert ' + table + ' failed:', (e && e.message) || e);
    });
  }

  function showAlert(message, type) {
    var el = $('authAlert');
    if (!el) return;
    el.textContent = message;
    el.className = 'auth-alert show ' + (type || 'info');
    el.setAttribute('role', type === 'error' ? 'alert' : 'status');
    el.setAttribute('aria-live', type === 'error' ? 'assertive' : 'polite');

    var ms = type === 'error' ? 12000 : 8000;
    setTimeout(function () {
      if (el.textContent === message) el.className = 'auth-alert';
    }, ms);
  }

  function hideAlert() {
    var el = $('authAlert');
    if (el) el.className = 'auth-alert';
  }

  function setLoading(isLoading) {
    var btn = $('loginBtn');
    var text = $('loginBtnText');
    if (!btn || !text) return;

    if (isLoading) {
      btn.disabled = true;
      text.innerHTML = '<span class="spinner"></span> جاري التحقق...';
    } else {
      btn.disabled = false;
      text.textContent = 'تسجيل الدخول';
    }
  }

  function validateForm() {
    var email = $('emailInput').value.trim();
    var password = $('passwordInput').value;

    if (!email) { showAlert('الرجاء إدخال البريد الإلكتروني', 'error'); $('emailInput').focus(); return null; }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { showAlert('البريد الإلكتروني غير صحيح', 'error'); $('emailInput').focus(); return null; }
    if (!password) { showAlert('الرجاء إدخال كلمة المرور', 'error'); $('passwordInput').focus(); return null; }
    if (password.length < 6) { showAlert('كلمة المرور قصيرة جداً (6 أحرف على الأقل)', 'error'); $('passwordInput').focus(); return null; }

    return { email: email, password: password };
  }

  function initSupabase() {
    if (state.sb) return state.sb;

    if (typeof supabase === 'undefined') {
      console.error('[Login] Supabase SDK not loaded at all');
      showAlert('مكتبة Supabase لم يتم تحميلها. أعد تحميل الصفحة (Ctrl+Shift+R).', 'error');
      return null;
    }

    if (typeof supabase.createClient !== 'function') {
      console.error('[Login] SDK is not v2 (missing createClient)');
      showAlert('مكتبة Supabase قديمة. جاري إعادة تحميل الصفحة...', 'error');
      setTimeout(function () { window.location.reload(true); }, 2500);
      return null;
    }

    var cfg = window.ITWS_CONFIG || {};
    if (!cfg.SUPABASE_URL || cfg.SUPABASE_URL.indexOf('YOUR_PROJECT_REF') !== -1) {
      console.error('[Login] SUPABASE_URL not configured in config.js');
      showAlert('إعدادات Supabase غير مكتملة. تحقق من config.js.', 'error');
      return null;
    }

    try {
      state.sb = supabase.createClient(cfg.SUPABASE_URL, cfg.SUPABASE_ANON_KEY, {
        auth: {
          persistSession: true,
          autoRefreshToken: true,
          detectSessionInUrl: true,
          storageKey: 'itws_auth',
          flowType: 'pkce'
        },
        realtime: { params: { eventsPerSecond: 5 } }
      });

      var hasSignIn = typeof state.sb.auth.signInWithEmailAndPassword === 'function';
      var hasSignInWithPassword = typeof state.sb.auth.signInWithPassword === 'function';

      if (!hasSignIn && !hasSignInWithPassword) {
        console.error('[Login] Neither signIn method is available');
        showAlert('مكتبة Supabase غير متوافقة. أعد تحميل الصفحة.', 'error');
        return null;
      }

      return state.sb;
    } catch (err) {
      console.error('[Login] Failed to create Supabase client:', err);
      showAlert('تعذر الاتصال بالخادم: ' + err.message, 'error');
      return null;
    }
  }

  function redirectBasedOnRole(role) {
    var dest;
    if (role === 'super_admin' || role === 'admin' || role === 'committee_manager') {
      dest = resolve(getSetting('behavior.redirect_admin_to', 'admin/index.html'));
    } else {
      dest = resolve(getSetting('behavior.redirect_user_to', 'home.html'));
    }

    var params = new URLSearchParams(window.location.search);
    var next = params.get('next');
    if (next) {
      try {
        var decoded = decodeURIComponent(next);
        if (
          decoded.indexOf('//') === -1 &&
          decoded.indexOf(':') === -1 &&
          decoded.indexOf('..') === -1
        ) {
          dest = resolve(decoded.replace(/^\//, ''));
        }
      } catch (e) {}
    }

    setTimeout(function () { window.location.href = dest; }, 600);
  }

  function checkExistingSession() {
    if (!state.sb || !state.sb.auth) return;

    try {
      var p = state.sb.auth.getSession();
      withTimeout(p, SESSION_TIMEOUT_MS, 'فحص الجلسة')
        .then(function (res) {
          if (!res || !res.data || !res.data.session || !res.data.session.user) return;
          var user = res.data.session.user;

          var profileP = state.sb.from('profiles')
            .select('role, is_active')
            .eq('id', user.id)
            .maybeSingle();

          return withTimeout(profileP, SESSION_TIMEOUT_MS, 'جلب الصلاحيات')
            .then(function (profileRes) {
              if (!profileRes || !profileRes.data) return;
              if (profileRes.data.is_active === false) return;
              showAlert('لديك جلسة نشطة. جاري التحويل...', 'info');
              redirectBasedOnRole(profileRes.data.role);
            });
        })
        .catch(function () { /* ignore — show form */ });
    } catch (e) {}
  }

  function handleLogin(e) {
    if (e) e.preventDefault();
    if (state.submitting) return;

    hideAlert();

    var data = validateForm();
    if (!data) return;

    if (state.attempts >= state.maxAttempts) {
      showAlert('تم تجاوز الحد الأقصى للمحاولات. حاول مرة أخرى بعد قليل.', 'error');
      return;
    }

    var sb = initSupabase();
    if (!sb) return;

    state.submitting = true;
    setLoading(true);

    var signInPromise;
    if (typeof sb.auth.signInWithEmailAndPassword === 'function') {
      signInPromise = sb.auth.signInWithEmailAndPassword(data.email, data.password);
    } else if (typeof sb.auth.signInWithPassword === 'function') {
      signInPromise = sb.auth.signInWithPassword({ email: data.email, password: data.password });
    } else {
      showAlert('مكتبة Supabase غير متوافقة. أعد تحميل الصفحة.', 'error');
      state.submitting = false;
      setLoading(false);
      return;
    }

    withTimeout(signInPromise, AUTH_TIMEOUT_MS, 'تسجيل الدخول')
      .then(function (cred) {
        var user = cred && cred.user ? cred.user
                 : (cred && cred.data && cred.data.user ? cred.data.user : null);
        if (!user) throw new Error('لم يتم استلام بيانات المستخدم');

        var profilePromise = sb.from('profiles')
          .select('id, email, full_name, role, is_active')
          .eq('id', user.id)
          .maybeSingle();

        return withTimeout(profilePromise, PROFILE_TIMEOUT_MS, 'جلب بيانات الحساب')
          .then(function (profileRes) {
            if (profileRes.error || !profileRes.data) {
              return sb.auth.signOut().then(function () {
                throw new Error('الحساب غير مكتمل (لا يوجد profile). تواصل مع الدعم الفني.');
              });
            }

            if (profileRes.data.is_active === false) {
              return sb.auth.signOut().then(function () {
                throw new Error('هذا الحساب معطل. تواصل مع الإدارة.');
              });
            }

            safeInsert(sb, 'activities', {
              user_id: user.id,
              user_name: profileRes.data.full_name || user.email,
              user_role: profileRes.data.role,
              action_type: 'login',
              description: 'تسجيل دخول'
            });

            return { user: user, profile: profileRes.data };
          });
      })
      .then(function (result) {
        showAlert('تم تسجيل الدخول بنجاح. جاري التحويل...', 'success');
        redirectBasedOnRole(result.profile.role);
      })
      .catch(function (error) {
        state.attempts++;
        state.submitting = false;
        setLoading(false);

        var msg = 'فشل تسجيل الدخول';
        var code = (error && error.code) || '';
        var message = (error && error.message) || '';
        var lower = message.toLowerCase();

        if (code === 'invalid_credentials' || lower.indexOf('invalid login credentials') !== -1 || lower.indexOf('invalid_credentials') !== -1) {
          msg = 'البريد الإلكتروني أو كلمة المرور غير صحيحة';
        } else if (code === 'email_not_confirmed' || lower.indexOf('email not confirmed') !== -1) {
          msg = 'البريد الإلكتروني لم يتم تأكيده. تواصل مع الإدارة.';
        } else if (lower.indexOf('rate limit') !== -1 || lower.indexOf('too many') !== -1) {
          msg = 'محاولات كثيرة. حاول بعد دقيقة.';
        } else if (lower.indexOf('timeout') !== -1 || message.indexOf('مهلة') !== -1) {
          msg = message;
        } else if (message) {
          msg = message;
        }

        showAlert(msg, 'error');
        logAttempt(data.email, false, msg);

        $('passwordInput').value = '';
        $('passwordInput').focus();
      });
  }

  function logAttempt(email, success, errorMsg) {
    if (!state.sb) return;
    safeInsert(state.sb, 'login_logs', {
      email: email,
      success: success,
      error_message: errorMsg || null,
      user_agent: navigator.userAgent.substring(0, 200)
    });
  }

  function handleForgot(e) {
    if (e) e.preventDefault();

    var email = $('emailInput').value.trim();
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      showAlert('أدخل بريدك الإلكتروني أولاً ثم اضغط "نسيت كلمة المرور"', 'error');
      $('emailInput').focus();
      return;
    }

    var sb = initSupabase();
    if (!sb) return;

    showAlert('جاري إرسال رابط استعادة كلمة المرور...', 'info');

    var resetPromise = sb.auth.resetPasswordForEmail(email, {
      redirectTo: window.location.origin + window.location.pathname.replace(/login\.html.*/, 'reset-password.html')
    });

    withTimeout(resetPromise, AUTH_TIMEOUT_MS, 'إرسال رابط الاستعادة')
      .then(function () {
        showAlert('تم إرسال رابط الاستعادة إلى بريدك. تحقق من صندوق الوارد.', 'success');
      })
      .catch(function (err) {
        var msg = err.message || 'تعذر إرسال رابط الاستعادة';
        if (err.code === 'user_not_found' || msg.toLowerCase().indexOf('user not found') !== -1) {
          msg = 'هذا البريد غير مسجل في النظام';
        }
        showAlert(msg, 'error');
      });
  }

  function initPasswordToggle() {
    var toggle = $('passwordToggle');
    var input = $('passwordInput');
    if (!toggle || !input) return;

    var EYE_OPEN = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path><circle cx="12" cy="12" r="3"></circle></svg>';
    var EYE_CLOSED = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"></path><line x1="1" y1="1" x2="23" y2="23"></line></svg>';

    toggle.addEventListener('click', function () {
      var type = input.type === 'password' ? 'text' : 'password';
      input.type = type;
      toggle.innerHTML = (type === 'text') ? EYE_CLOSED : EYE_OPEN;
      toggle.setAttribute('aria-label', type === 'text' ? 'إخفاء كلمة المرور' : 'إظهار كلمة المرور');
    });
  }

  function initRememberMe() {
    try {
      var saved = localStorage.getItem('itws_saved_email');
      if (saved) {
        $('emailInput').value = saved;
        $('rememberMe').checked = true;
      }
    } catch (e) {}
  }

  function saveRememberMe() {
    var email = $('emailInput').value.trim();
    var remember = $('rememberMe').checked;
    try {
      if (remember && email) localStorage.setItem('itws_saved_email', email);
      else localStorage.removeItem('itws_saved_email');
    } catch (e) {}
  }

  function applyDynamicContent() {
    var unionName = getSetting('app_identity.union_name', 'نقابة تكنولوجيا المعلومات والبرمجيات');
    var committeeName = getSetting('app_identity.committee_name', 'لجنة التحول الرقمي والتدريب');
    var logoUrl = getSetting('app_identity.logo_url', null);

    setText('brandTitle', unionName);
    setText('brandSubtitle', committeeName);

    if (logoUrl) {
      var brandLogo = $('brandLogo');
      if (brandLogo) brandLogo.innerHTML = '<img src="' + escapeHtml(logoUrl) + '" alt="logo">';
      var headerLogo = $('authHeaderLogo');
      if (headerLogo) headerLogo.innerHTML = '<img src="' + escapeHtml(logoUrl) + '" alt="logo">';
    }

    if (unionName) document.title = 'تسجيل الدخول | ' + unionName;
  }

  function init() {
    if (state.initialized) return;
    state.initialized = true;

    applyDynamicContent();
    initPasswordToggle();
    initRememberMe();

    var sb = initSupabase();
    if (sb) checkExistingSession();

    var form = $('loginForm');
    if (form) {
      form.addEventListener('submit', function (e) {
        saveRememberMe();
        handleLogin(e);
      });
    }

    var forgotLink = $('forgotLink');
    if (forgotLink) forgotLink.addEventListener('click', handleForgot);

    if (window.AppSettings && typeof window.AppSettings.onChange === 'function') {
      window.AppSettings.onChange(function () {
        applyDynamicContent();
      });
    }

    setTimeout(function () {
      var emailField = $('emailInput');
      if (emailField && !emailField.value) emailField.focus();
      else {
        var pw = $('passwordInput');
        if (pw) pw.focus();
      }
    }, 300);
  }

  window.LoginPage = {
    initialized: true,
    init: init,
    handleLogin: handleLogin,
    refresh: applyDynamicContent,
    getState: function () { return state; }
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
