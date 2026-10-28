/* ============================================================
   ITWS Platform — Login Page Logic V2
   File: assets/js/pages/login.js
   Description: Login form + auth flow + session banner

   Load order: AFTER all core modules
   (app-settings, labels, permissions, session, auth-guard, toast)

   Features:
   - Sign in with email/password via Supabase Auth
   - Role-based redirect (super_admin → admin, branch → branch, academy → portal, user → home)
   - ?next= parameter support (with anti-traversal check)
   - Session banner if already logged in (with Continue / Logout)
   - Pending / Rejected / Suspended state handling
   - Forgot password flow (resetPasswordForEmail)
   - Remember me (email only, NOT password)
   - Password visibility toggle
   - Rate limiting (5 attempts)
   - Detailed error messages (per error code)
   - Loading state on button
   - Login logging (success/failure in login_logs)
   - Activity logging (success in activities)
   - All strings from Labels.t() with fallbacks
   - All settings from AppSettings.get()
   - Uses window.sb, window.Session, window.Toast, window.Labels, window.Utils

   Rules:
   - No emoji
   - ES5-style IIFE
   - Never stores password anywhere
   - Never stores national_id or sensitive data
   - Anti-enumeration on login errors
   ============================================================ */

(function () {
  'use strict';

  if (window.LoginPage && window.LoginPage._initialized) {
    return;
  }

  /* ============================================================
     1. HELPERS
     ============================================================ */

  function log(level, msg, data) {
    var cfg = window.ITWS_CONFIG || {};
    if (level === 'error' || (cfg.DEBUG && level === 'debug')) {
      try {
        var args = ['[LoginPage]', msg];
        if (data !== undefined) args.push(data);
        if (level === 'error') console.error.apply(console, args);
        else console.log.apply(console, args);
      } catch (e) {}
    }
  }

  function getSb() {
    return window.sb || window.supabaseClient || window.ITWS_SUPABASE || null;
  }

  function getLabel(key, fallback) {
    try {
      if (window.Labels && typeof window.Labels.t === 'function') {
        var v = window.Labels.t(key);
        if (v && v !== key) return v;
      }
    } catch (e) {}
    return fallback;
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
    var base = (window.ITWS_CONFIG && window.ITWS_CONFIG.BASE_PATH) || '/';
    if (base.charAt(base.length - 1) !== '/') base += '/';
    return base + String(path).replace(/^\.?\//, '');
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

  function dispatchEvent(name, detail) {
    try {
      window.dispatchEvent(new CustomEvent(name, { detail: detail || {} }));
    } catch (e) {}
  }

  function showToast(msg, type) {
    try {
      if (window.Toast && typeof window.Toast.show === 'function') {
        window.Toast.show({ type: type || 'info', message: msg });
      } else if (window.Utils && typeof window.Utils.showToast === 'function') {
        window.Utils.showToast(msg, type);
      } else if (typeof window.showToast === 'function') {
        window.showToast(msg, type);
      }
    } catch (e) {}
  }

  function safeStorageGet(key) {
    try { return localStorage.getItem(key); } catch (e) { return null; }
  }

  function safeStorageSet(key, value) {
    try { localStorage.setItem(key, value); return true; }
    catch (e) { return false; }
  }

  function safeStorageRemove(key) {
    try { localStorage.removeItem(key); return true; } catch (e) { return false; }
  }

  function $(id) { return document.getElementById(id); }
  function setText(id, text) {
    var el = $(id);
    if (el) el.textContent = text || '';
  }

  function withTimeout(promise, ms, label) {
    return Promise.race([
      promise,
      new Promise(function (_, reject) {
        setTimeout(function () {
          reject(new Error(
            getLabel('errors.timeout', 'انتهت مهلة العملية') +
            (label ? ' — ' + label : '')
          ));
        }, ms);
      })
    ]);
  }

  /* ============================================================
     2. CONFIG
     ============================================================ */

  var AUTH_TIMEOUT_MS = 25000;
  var PROFILE_TIMEOUT_MS = 10000;
  var SESSION_TIMEOUT_MS = 6000;
  var MAX_ATTEMPTS = 5;
  var REMEMBER_KEY = 'itws_saved_email';

  /* ============================================================
     3. STATE
     ============================================================ */

  var state = {
    _initialized: false,
    submitting: false,
    attempts: 0,
    existingUser: null,
    existingProfile: null
  };

  /* ============================================================
     4. ALERT
     ============================================================ */

  function showAlert(message, type) {
    var el = $('authAlert');
    if (!el) {
      // Fallback to toast if no alert element
      showToast(message, type);
      return;
    }
    el.textContent = message;
    el.className = 'auth-alert show ' + (type || 'info');
    el.setAttribute('role', type === 'error' ? 'alert' : 'status');
    el.setAttribute('aria-live', type === 'error' ? 'assertive' : 'polite');

    var timeout = type === 'error' ? 12000 : 8000;
    setTimeout(function () {
      if (el.textContent === message) el.className = 'auth-alert';
    }, timeout);
  }

  function hideAlert() {
    var el = $('authAlert');
    if (el) el.className = 'auth-alert';
  }

  /* ============================================================
     5. BUTTON STATE
     ============================================================ */

  function setLoading(isLoading) {
    var btn = $('loginBtn');
    var text = $('loginBtnText');
    if (!btn || !text) return;

    if (isLoading) {
      btn.disabled = true;
      text.textContent = getLabel('auth.login.loading', 'جاري التحقق...');
    } else {
      btn.disabled = false;
      text.textContent = getLabel('auth.login.button', 'تسجيل الدخول');
    }
  }

  /* ============================================================
     6. VALIDATION
     ============================================================ */

  function validateEmail(email) {
    if (!email) return false;
    return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(String(email).trim());
  }

  function validateForm() {
    var emailEl = $('emailInput');
    var pwEl = $('passwordInput');
    if (!emailEl || !pwEl) return null;

    var email = emailEl.value.trim();
    var password = pwEl.value;

    if (!email) {
      showAlert(getLabel('auth.login.errors.email_required', 'الرجاء إدخال البريد الإلكتروني'), 'error');
      emailEl.focus();
      return null;
    }
    if (!validateEmail(email)) {
      showAlert(getLabel('auth.login.errors.email_invalid', 'البريد الإلكتروني غير صحيح'), 'error');
      emailEl.focus();
      return null;
    }
    if (!password) {
      showAlert(getLabel('auth.login.errors.password_required', 'الرجاء إدخال كلمة المرور'), 'error');
      pwEl.focus();
      return null;
    }

    var minLen = getSetting('security.password_min_length', 6);
    if (password.length < minLen) {
      showAlert(
        getLabel('auth.login.errors.password_short', 'كلمة المرور قصيرة جداً') +
        ' (' + minLen + ' ' + getLabel('auth.login.errors.chars_min', 'أحرف على الأقل') + ')',
        'error'
      );
      pwEl.focus();
      return null;
    }

    return { email: email, password: password };
  }

  /* ============================================================
     7. REMEMBER ME
     ============================================================ */

  function loadRememberMe() {
    var saved = safeStorageGet(REMEMBER_KEY);
    if (!saved) return;
    var emailEl = $('emailInput');
    var rememberEl = $('rememberMe');
    if (emailEl) emailEl.value = saved;
    if (rememberEl) rememberEl.checked = true;
  }

  function saveRememberMe() {
    var emailEl = $('emailInput');
    var rememberEl = $('rememberMe');
    if (!emailEl || !rememberEl) return;

    var email = emailEl.value.trim();
    if (rememberEl.checked && email) {
      safeStorageSet(REMEMBER_KEY, email);
    } else {
      safeStorageRemove(REMEMBER_KEY);
    }
  }

  /* ============================================================
     8. PASSWORD TOGGLE
     ============================================================ */

  var EYE_OPEN_SVG = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path><circle cx="12" cy="12" r="3"></circle></svg>';
  var EYE_CLOSED_SVG = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"></path><line x1="1" y1="1" x2="23" y2="23"></line></svg>';

  function initPasswordToggle() {
    var toggle = $('passwordToggle');
    var input = $('passwordInput');
    if (!toggle || !input) return;

    toggle.addEventListener('click', function () {
      var show = input.type === 'password';
      input.type = show ? 'text' : 'password';
      toggle.innerHTML = show ? EYE_CLOSED_SVG : EYE_OPEN_SVG;
      toggle.setAttribute(
        'aria-label',
        show
          ? getLabel('auth.login.hide_password', 'إخفاء كلمة المرور')
          : getLabel('auth.login.show_password', 'إظهار كلمة المرور')
      );
      input.focus();
    });
  }

  /* ============================================================
     9. REDIRECT
     ============================================================ */

  function getDestForRole(role) {
    if (!role) return 'home.html';

    if (role === 'super_admin' || role === 'committee_head' ||
        role === 'committee_deputy' || role === 'committee_member') {
      return resolve(getSetting('behavior.redirect_admin_to', 'admin/index.html'));
    }
    if (role === 'branch_president' || role === 'branch_first_deputy' ||
        role === 'branch_second_deputy' || role === 'branch_secretary' ||
        role === 'branch_secretary_assistant' || role === 'branch_treasurer' ||
        role === 'branch_treasurer_assistant' || role === 'branch_agent' ||
        role === 'branch_agent_assistant') {
      return resolve('branch/index.html');
    }
    if (role === 'academy_owner' || role === 'academy_manager') {
      return resolve('portal/index.html');
    }
    return resolve(getSetting('behavior.redirect_user_to', 'home.html'));
  }

  function getSafeNextParam() {
    try {
      var params = new URLSearchParams(window.location.search);
      var next = params.get('next');
      if (!next) return null;
      var decoded = decodeURIComponent(next);
      // Security: reject protocol, double slash, dotdot
      if (decoded.indexOf('//') !== -1) return null;
      if (decoded.indexOf(':') !== -1) return null;
      if (decoded.indexOf('..') !== -1) return null;
      return decoded.replace(/^\//, '');
    } catch (e) {
      return null;
    }
  }

  function redirectTo(url) {
    if (!url) return;
    window.location.href = url;
  }

  function redirectAfterLogin(profile) {
    var dest = getDestForRole(profile ? profile.role : null);
    var next = getSafeNextParam();
    if (next) {
      dest = resolve(next);
    }
    log('debug', 'Redirecting after login', { role: profile ? profile.role : null, dest: dest });
    setTimeout(function () { redirectTo(dest); }, 600);
  }

  /* ============================================================
     10. LOG ATTEMPT
     ============================================================ */

  function logAttempt(email, success, errorMessage) {
    var sb = getSb();
    if (!sb) return;

    // Fire and forget — ignore errors
    Promise.resolve()
      .then(function () {
        return sb.from('login_logs').insert({
          email: email,
          success: success,
          error_message: errorMessage || null,
          user_agent: (navigator.userAgent || '').substring(0, 200)
        });
      })
      .catch(function (e) {
        log('debug', 'logAttempt failed', e && e.message);
      });
  }

  function logActivity(user, profile) {
    var sb = getSb();
    if (!sb || !user || !profile) return;

    Promise.resolve()
      .then(function () {
        return sb.from('activities').insert({
          actor_id: user.id,
          actor_name: profile.full_name || user.email,
          actor_role: profile.role,
          action_type: 'login',
          resource_type: 'auth',
          resource_id: user.id,
          description: getLabel('activities.login', 'تسجيل دخول'),
          user_agent: (navigator.userAgent || '').substring(0, 200)
        });
      })
      .catch(function (e) {
        log('debug', 'logActivity failed', e && e.message);
      });
  }

  /* ============================================================
     11. FETCH PROFILE
     ============================================================ */

  function fetchProfile(userId) {
    var sb = getSb();
    if (!sb) {
      return Promise.reject(new Error('Supabase not available'));
    }

    var query = sb.from('profiles')
      .select('id, email, full_name, phone, avatar_url, role, status, is_active, is_deleted, governorate_id, branch_id, academy_id, is_primary')
      .eq('id', userId)
      .maybeSingle();

    return withTimeout(query, PROFILE_TIMEOUT_MS, getLabel('auth.login.loading_profile', 'جلب بيانات الحساب'))
      .then(function (res) {
        if (res && res.error) throw new Error(res.error.message);
        return res ? res.data : null;
      });
  }

  /* ============================================================
     12. STATUS HANDLERS
     ============================================================ */

  function handlePendingState(profile) {
    var sb = getSb();
    if (sb && sb.auth) {
      Promise.resolve().then(function () { return sb.auth.signOut(); }).catch(function () {});
    }
    showAlert(
      getLabel('auth.login.pending_title', 'طلبك قيد المراجعة') +
      '. ' +
      getLabel('auth.login.pending_msg', 'طلبك في انتظار الموافقة من الإدارة'),
      'info'
    );
    dispatchEvent('itws:login-pending', { profile: profile });
  }

  function handleRejectedState(profile) {
    var sb = getSb();
    if (sb && sb.auth) {
      Promise.resolve().then(function () { return sb.auth.signOut(); }).catch(function () {});
    }
    var reason = profile.rejection_reason
      ? ' — ' + getLabel('auth.login.reason', 'السبب') + ': ' + profile.rejection_reason
      : '';
    showAlert(
      getLabel('auth.login.rejected_title', 'تم رفض طلبك') + reason,
      'error'
    );
    dispatchEvent('itws:login-rejected', { profile: profile });
  }

  function handleSuspendedState(profile) {
    var sb = getSb();
    if (sb && sb.auth) {
      Promise.resolve().then(function () { return sb.auth.signOut(); }).catch(function () {});
    }
    showAlert(
      getLabel('auth.login.suspended_title', 'هذا الحساب موقوف') +
      '. ' +
      getLabel('auth.login.suspended_msg', 'تواصل مع الإدارة لمعرفة السبب'),
      'error'
    );
    dispatchEvent('itws:login-suspended', { profile: profile });
  }

  function handleInactiveState() {
    var sb = getSb();
    if (sb && sb.auth) {
      Promise.resolve().then(function () { return sb.auth.signOut(); }).catch(function () {});
    }
    showAlert(
      getLabel('auth.login.inactive_title', 'هذا الحساب معطل') +
      '. ' +
      getLabel('auth.login.inactive_msg', 'تواصل مع الإدارة'),
      'error'
    );
    dispatchEvent('itws:login-inactive', {});
  }

  /* ============================================================
     13. ERROR MAPPING
     ============================================================ */

  function mapAuthError(error) {
    var code = (error && error.code) || '';
    var msg = (error && error.message) || '';
    var lower = msg.toLowerCase();

    if (code === 'invalid_credentials' || lower.indexOf('invalid login credentials') !== -1) {
      return getLabel('auth.login.errors.invalid_credentials', 'البريد الإلكتروني أو كلمة المرور غير صحيحة');
    }
    if (code === 'email_not_confirmed' || lower.indexOf('email not confirmed') !== -1) {
      return getLabel('auth.login.errors.email_not_confirmed', 'البريد الإلكتروني لم يتم تأكيده. تحقق من بريدك');
    }
    if (lower.indexOf('rate limit') !== -1 || lower.indexOf('too many') !== -1) {
      return getLabel('auth.login.errors.rate_limit', 'محاولات كثيرة. حاول بعد دقيقة');
    }
    if (lower.indexOf('timeout') !== -1 || lower.indexOf('مهلة') !== -1) {
      return msg;
    }
    if (code === 'user_not_found') {
      return getLabel('auth.login.errors.invalid_credentials', 'البريد الإلكتروني أو كلمة المرور غير صحيحة');
    }
    return msg || getLabel('auth.login.errors.generic', 'فشل تسجيل الدخول');
  }

  /* ============================================================
     14. HANDLE LOGIN
     ============================================================ */

  function handleLogin(e) {
    if (e) e.preventDefault();
    if (state.submitting) return;

    hideAlert();

    var data = validateForm();
    if (!data) return;

    if (state.attempts >= MAX_ATTEMPTS) {
      showAlert(
        getLabel('auth.login.errors.too_many_attempts', 'تم تجاوز الحد الأقصى للمحاولات. حاول بعد قليل'),
        'error'
      );
      return;
    }

    var sb = getSb();
    if (!sb) {
      showAlert(
        getLabel('errors.network', 'تعذر الاتصال بالخادم') +
        '. ' +
        getLabel('errors.reload', 'أعد تحميل الصفحة'),
        'error'
      );
      return;
    }

    state.submitting = true;
    setLoading(true);

    var signInPromise;
    if (typeof sb.auth.signInWithPassword === 'function') {
      signInPromise = sb.auth.signInWithPassword({
        email: data.email,
        password: data.password
      });
    } else if (typeof sb.auth.signInWithEmailAndPassword === 'function') {
      signInPromise = sb.auth.signInWithEmailAndPassword(data.email, data.password);
    } else {
      state.submitting = false;
      setLoading(false);
      showAlert(getLabel('errors.generic', 'خطأ في النظام'), 'error');
      return;
    }

    withTimeout(signInPromise, AUTH_TIMEOUT_MS, getLabel('auth.login.title', 'تسجيل الدخول'))
      .then(function (res) {
        if (res && res.error) throw res.error;

        var user = (res && res.data && res.data.user) ||
                   (res && res.user) ||
                   null;
        if (!user) throw new Error(getLabel('auth.login.errors.no_user', 'لم يتم استلام بيانات المستخدم'));

        return fetchProfile(user.id)
          .then(function (profile) {
            if (!profile) {
              var sbInner = getSb();
              if (sbInner && sbInner.auth) {
                Promise.resolve().then(function () { return sbInner.auth.signOut(); }).catch(function () {});
              }
              throw new Error(getLabel('auth.login.errors.no_profile', 'الحساب غير مكتمل. تواصل مع الدعم'));
            }
            return { user: user, profile: profile };
          });
      })
      .then(function (result) {
        var user = result.user;
        var profile = result.profile;

        // Deleted?
        if (profile.is_deleted === true) {
          handleInactiveState();
          logAttempt(data.email, false, 'deleted');
          state.submitting = false;
          setLoading(false);
          return;
        }

        // Status checks
        if (profile.status === 'pending') {
          handlePendingState(profile);
          logAttempt(data.email, true, 'pending');
          state.submitting = false;
          setLoading(false);
          return;
        }
        if (profile.status === 'rejected') {
          handleRejectedState(profile);
          logAttempt(data.email, true, 'rejected');
          state.submitting = false;
          setLoading(false);
          return;
        }
        if (profile.status === 'suspended') {
          handleSuspendedState(profile);
          logAttempt(data.email, true, 'suspended');
          state.submitting = false;
          setLoading(false);
          return;
        }
        if (profile.status !== 'active' || profile.is_active === false) {
          handleInactiveState();
          logAttempt(data.email, false, 'inactive');
          state.submitting = false;
          setLoading(false);
          return;
        }

        // Success!
        log('debug', 'Login success', { role: profile.role });

        logAttempt(data.email, true, null);
        logActivity(user, profile);

        dispatchEvent('itws:login-success', { user: user, profile: profile });

        showAlert(
          getLabel('auth.login.success', 'تم تسجيل الدخول بنجاح') +
          '. ' +
          getLabel('auth.login.redirecting', 'جاري التحويل...'),
          'success'
        );

        // Sync to Permissions engine
        try {
          if (window.Permissions && typeof window.Permissions.setProfile === 'function') {
            window.Permissions.setProfile(profile);
          }
        } catch (err) {}

        state.submitting = false;
        setLoading(false);

        redirectAfterLogin(profile);
      })
      .catch(function (error) {
        state.attempts++;
        state.submitting = false;
        setLoading(false);

        log('error', 'Login failed', {
          code: error && error.code,
          message: error && error.message
        });

        var msg = mapAuthError(error);
        showAlert(msg, 'error');
        logAttempt(data.email, false, msg);

        var pwEl = $('passwordInput');
        if (pwEl) {
          pwEl.value = '';
          pwEl.focus();
        }

        dispatchEvent('itws:login-failed', { error: error, attempts: state.attempts });
      });
  }

  /* ============================================================
     15. FORGOT PASSWORD
     ============================================================ */

  function handleForgot(e) {
    if (e) e.preventDefault();

    var emailEl = $('emailInput');
    if (!emailEl) return;

    var email = emailEl.value.trim();
    if (!email || !validateEmail(email)) {
      showAlert(
        getLabel('auth.login.errors.email_for_reset', 'أدخل بريدك الإلكتروني أولاً ثم اضغط "نسيت كلمة المرور"'),
        'error'
      );
      emailEl.focus();
      return;
    }

    var sb = getSb();
    if (!sb) {
      showAlert(getLabel('errors.network', 'تعذر الاتصال بالخادم'), 'error');
      return;
    }

    showAlert(getLabel('auth.login.sending_reset', 'جاري إرسال رابط الاستعادة...'), 'info');

    var redirectTo = window.location.origin +
      window.location.pathname.replace(/login\.html.*/, 'reset-password.html');

    var resetPromise = sb.auth.resetPasswordForEmail(email, { redirectTo: redirectTo });

    withTimeout(resetPromise, AUTH_TIMEOUT_MS, getLabel('auth.login.sending_reset', 'إرسال رابط الاستعادة'))
      .then(function (res) {
        if (res && res.error) throw res.error;
        showAlert(
          getLabel('auth.login.reset_sent', 'تم إرسال رابط الاستعادة إلى بريدك. تحقق من صندوق الوارد'),
          'success'
        );
      })
      .catch(function (err) {
        var msg = (err && err.message) || getLabel('auth.login.errors.reset_failed', 'تعذر إرسال رابط الاستعادة');
        if (err && err.code === 'user_not_found') {
          // Anti-enumeration: show generic message anyway
          showAlert(
            getLabel('auth.login.reset_sent', 'تم إرسال رابط الاستعادة إلى بريدك. تحقق من صندوق الوارد'),
            'success'
          );
          return;
        }
        showAlert(msg, 'error');
      });
  }

  /* ============================================================
     16. SESSION BANNER
     ============================================================ */

  function showSessionBanner(user, profile) {
    var banner = $('authSessionBanner');
    if (!banner) return;

    state.existingUser = user;
    state.existingProfile = profile;

    var name = (profile && profile.full_name) || (user && user.email) || '';
    setText('authSessionText', name
      ? getLabel('auth.session.signed_in_as', 'مسجل الدخول كـ') + ' ' + name
      : getLabel('auth.session.signed_in', 'لديك جلسة نشطة على هذا الجهاز'));

    banner.classList.add('show');
  }

  function hideSessionBanner() {
    var banner = $('authSessionBanner');
    if (banner) banner.classList.remove('show');
    state.existingUser = null;
    state.existingProfile = null;
  }

  function checkExistingSession() {
    var sb = getSb();
    if (!sb || !sb.auth) return Promise.resolve();

    return withTimeout(sb.auth.getSession(), SESSION_TIMEOUT_MS, getLabel('auth.session.checking', 'فحص الجلسة'))
      .then(function (res) {
        var session = res && res.data && res.data.session;
        if (!session || !session.user) return;

        var user = session.user;

        return fetchProfile(user.id)
          .then(function (profile) {
            if (!profile) return;
            if (profile.status !== 'active' || profile.is_active === false || profile.is_deleted === true) {
              return;
            }
            showSessionBanner(user, profile);
            dispatchEvent('itws:session-banner-shown', { profile: profile });
          });
      })
      .catch(function (err) {
        log('debug', 'checkExistingSession failed', err && err.message);
      });
  }

  function handleSessionLogout() {
    var btn = $('authSessionLogout');
    if (btn) {
      btn.disabled = true;
      btn.textContent = getLabel('auth.session.logging_out', 'جاري الخروج...');
    }

    var doLogout = (window.Session && typeof window.Session.logout === 'function')
      ? window.Session.logout
      : function () {
          var sb = getSb();
          if (sb && sb.auth) {
            return sb.auth.signOut().catch(function () {});
          }
          return Promise.resolve();
        };

    Promise.resolve(doLogout())
      .catch(function () {})
      .then(function () {
        hideSessionBanner();
        hideAlert();
        showAlert(getLabel('auth.logout.success', 'تم تسجيل الخروج بنجاح'), 'success');
        if (btn) {
          btn.disabled = false;
          btn.textContent = getLabel('auth.session.logout', 'تسجيل الخروج');
        }
        var emailEl = $('emailInput');
        if (emailEl) emailEl.focus();
      });
  }

  function handleSessionContinue() {
    if (!state.existingProfile) {
      window.location.reload();
      return;
    }
    showAlert(getLabel('auth.login.redirecting', 'جاري التحويل...'), 'info');
    redirectAfterLogin(state.existingProfile);
  }

  /* ============================================================
     17. DYNAMIC CONTENT
     ============================================================ */

  function applyDynamicContent() {
    var unionName = getSetting('app_identity.union_name', 'نقابة تكنولوجيا المعلومات والبرمجيات');
    var committeeName = getSetting('app_identity.committee_name', '');
    var logoUrl = getSetting('app_identity.logo_url', '');

    setText('brandTitle', unionName);
    setText('brandSubtitle', committeeName || getLabel('auth.login.subtitle', 'مرحباً بك في النظام الرسمي'));

    if (logoUrl) {
      var brandLogo = $('brandLogo');
      if (brandLogo) {
        brandLogo.innerHTML = '<img src="' + escapeHtml(logoUrl) + '" alt="" onerror="this.parentNode.textContent=\'ن\';" />';
      }
      var headerLogo = $('authHeaderLogo');
      if (headerLogo) {
        headerLogo.innerHTML = '<img src="' + escapeHtml(logoUrl) + '" alt="" onerror="this.parentNode.textContent=\'ن\';" />';
      }
    }
  }

  /* ============================================================
     18. BIND EVENTS
     ============================================================ */

  function bindEvents() {
    var form = $('loginForm');
    if (form) {
      form.addEventListener('submit', function (e) {
        saveRememberMe();
        handleLogin(e);
      });
    }

    var forgotLink = $('forgotLink');
    if (forgotLink) forgotLink.addEventListener('click', handleForgot);

    var continueBtn = $('authSessionContinue');
    if (continueBtn) continueBtn.addEventListener('click', handleSessionContinue);

    var logoutBtn = $('authSessionLogout');
    if (logoutBtn) logoutBtn.addEventListener('click', handleSessionLogout);

    // Clear alert on input
    var emailInput = $('emailInput');
    var pwInput = $('passwordInput');
    [emailInput, pwInput].forEach(function (el) {
      if (el) el.addEventListener('input', hideAlert);
    });
  }

  /* ============================================================
     19. INIT
     ============================================================ */

  function init() {
    if (state._initialized) return;
    state._initialized = true;

    log('debug', 'Login page initializing');

    applyDynamicContent();
    initPasswordToggle();
    loadRememberMe();
    bindEvents();

    // Update content on settings change
    if (window.AppSettings && typeof window.AppSettings.onChange === 'function') {
      window.AppSettings.onChange(function (settings, key) {
        if (!key || key === 'app_identity') {
          applyDynamicContent();
        }
      });
    }

    // Check existing session (banner)
    checkExistingSession();

    // Check URL flags for pending/rejected/suspended from redirects
    try {
      var params = new URLSearchParams(window.location.search);
      if (params.get('pending') === '1') {
        showAlert(
          getLabel('auth.login.pending_title', 'طلبك قيد المراجعة') +
          '. ' +
          getLabel('auth.login.pending_msg', 'طلبك في انتظار الموافقة من الإدارة'),
          'info'
        );
      } else if (params.get('rejected') === '1') {
        showAlert(
          getLabel('auth.login.rejected_title', 'تم رفض طلبك') +
          '. ' +
          getLabel('auth.login.rejected_msg', 'تواصل مع الإدارة لمعرفة السبب'),
          'error'
        );
      } else if (params.get('suspended') === '1') {
        showAlert(
          getLabel('auth.login.suspended_title', 'هذا الحساب موقوف') +
          '. ' +
          getLabel('auth.login.suspended_msg', 'تواصل مع الإدارة'),
          'error'
        );
      } else if (params.get('inactive') === '1') {
        showAlert(
          getLabel('auth.login.inactive_title', 'هذا الحساب معطل') +
          '. ' +
          getLabel('auth.login.inactive_msg', 'تواصل مع الإدارة'),
          'error'
        );
      }
    } catch (e) {}

    // Focus management
    setTimeout(function () {
      var emailInput = $('emailInput');
      var pwInput = $('passwordInput');
      if (emailInput && !emailInput.value) emailInput.focus();
      else if (pwInput) pwInput.focus();
    }, 300);

    log('debug', 'Login page ready');
  }

  /* ============================================================
     20. EXPORT
     ============================================================ */

  window.LoginPage = {
    _initialized: true,
    init: init,
    refresh: applyDynamicContent,
    checkSession: checkExistingSession,
    getState: function () {
      return {
        submitting: state.submitting,
        attempts: state.attempts,
        hasExistingSession: !!(state.existingUser && state.existingProfile)
      };
    }
  };

  // Boot
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  /* ============================================================
     21. DEBUG
     ============================================================ */

  var cfg = window.ITWS_CONFIG || {};
  if (cfg.DEBUG) {
    try {
      console.log('%c[LoginPage]', 'color: #F59E0B; font-weight: bold;', 'Module ready');
    } catch (e) {}
  }

})();
