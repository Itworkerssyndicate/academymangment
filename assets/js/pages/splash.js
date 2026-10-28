/* ============================================================
   ITWS Platform — Splash Screen Logic V2
   File: assets/js/pages/splash.js
   Description: Handles index.html splash + role-based redirect

   Load order: AFTER all core modules (app-settings, permissions,
   session, auth-guard, toast)

   Features:
   - Reads splash settings from AppSettings:
     enabled, min_duration_ms, max_duration_ms, loading_texts[],
     show_logo, show_hexagon, show_rings, show_particles,
     show_progress_circular, show_progress_bar, show_status_text,
     show_president_footer, show_shimmer, particles_count,
     animation_level, status_loading, status_redirecting
   - Rotating loading texts every ~1.2s
   - Progress bar/circular progress
   - Min duration display (2200ms default)
   - Max duration cap (4000ms default) to prevent hang
   - Fetches session + profile
   - Role-based redirect:
     · guest → home.html
     · super_admin / committee_* → admin/index.html
     · branch_* → branch/index.html
     · academy_* → portal/index.html
     · user → home.html
     · pending_user → login.html?pending=1
     · rejected / suspended / inactive → login.html
   - ?next= support with anti-traversal
   - ?skip=1 to skip splash (for testing/QA)
   - Respects prefers-reduced-motion
   - Respects safe-area (notch)
   - Emits: itws:splash-start, itws:splash-progress,
            itws:splash-completed
   - Handles errors gracefully (redirects to login on failure)

   Rules:
   - No emoji
   - ES5-style IIFE
   - Never blocks the user for max_duration
   - Fallback to defaults if AppSettings fails
   ============================================================ */

(function () {
  'use strict';

  if (window.SplashPage && window.SplashPage._initialized) {
    return;
  }

  /* ============================================================
     1. HELPERS
     ============================================================ */

  function log(level, msg, data) {
    var cfg = window.ITWS_CONFIG || {};
    if (level === 'error' || (cfg.DEBUG && level === 'debug')) {
      try {
        var args = ['[SplashPage]', msg];
        if (data !== undefined) args.push(data);
        if (level === 'error') console.error.apply(console, args);
        else console.log.apply(console, args);
      } catch (e) {}
    }
  }

  function getSb() {
    return window.sb || window.supabaseClient || window.ITWS_SUPABASE || null;
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

  function getLabel(key, fallback) {
    try {
      if (window.Labels && typeof window.Labels.t === 'function') {
        var v = window.Labels.t(key);
        if (v && v !== key) return v;
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

  function preferReducedMotion() {
    try {
      return window.matchMedia &&
             window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    } catch (e) {
      return false;
    }
  }

  function getSafeNextParam() {
    try {
      var params = new URLSearchParams(window.location.search);
      var next = params.get('next');
      if (!next) return null;
      var decoded = decodeURIComponent(next);
      if (decoded.indexOf('//') !== -1) return null;
      if (decoded.indexOf(':') !== -1) return null;
      if (decoded.indexOf('..') !== -1) return null;
      return decoded.replace(/^\//, '');
    } catch (e) {
      return null;
    }
  }

  function shouldSkip() {
    try {
      var params = new URLSearchParams(window.location.search);
      return params.get('skip') === '1';
    } catch (e) {
      return false;
    }
  }

  function isBlank(value) {
    return value === undefined || value === null || value === '';
  }

  function $(id) { return document.getElementById(id); }

  function setText(id, text) {
    var el = $(id);
    if (el) el.textContent = text || '';
  }

  /* ============================================================
     2. CONFIG
     ============================================================ */

  var MIN_DEFAULT_MS = 2200;
  var MAX_DEFAULT_MS = 4500;
  var TEXT_ROTATE_MS = 1300;
  var SESSION_TIMEOUT_MS = 6000;
  var PROFILE_TIMEOUT_MS = 8000;

  /* ============================================================
     3. STATE
     ============================================================ */

  var state = {
    _initialized: false,
    enabled: true,
    minDurationMs: MIN_DEFAULT_MS,
    maxDurationMs: MAX_DEFAULT_MS,
    texts: [],
    currentTextIdx: 0,
    startedAt: 0,
    textTimer: null,
    progressTimer: null,
    maxTimer: null,
    session: null,
    profile: null,
    redirectDone: false,
    progress: 0
  };

  /* ============================================================
     4. READ SETTINGS
     ============================================================ */

  function readSplashSettings() {
    state.enabled = getSetting('splash.enabled', true) !== false;

    if (!state.enabled) {
      // Splash disabled — redirect immediately
      return false;
    }

    var minMs = parseInt(getSetting('splash.min_duration_ms', MIN_DEFAULT_MS), 10);
    var maxMs = parseInt(getSetting('splash.max_duration_ms', MAX_DEFAULT_MS), 10);
    if (!isFinite(minMs) || minMs < 500) minMs = MIN_DEFAULT_MS;
    if (!isFinite(maxMs) || maxMs < minMs) maxMs = Math.max(minMs, MAX_DEFAULT_MS);

    state.minDurationMs = minMs;
    state.maxDurationMs = maxMs;

    var texts = getSetting('splash.loading_texts', null);
    if (Array.isArray(texts) && texts.length > 0) {
      state.texts = texts.filter(function (t) { return t && String(t).trim(); });
    }
    if (state.texts.length === 0) {
      state.texts = [
        getLabel('splash.loading', 'جاري التحميل...'),
        getLabel('splash.preparing', 'تحضير المنصة...'),
        getLabel('splash.almost', 'على وشك الانتهاء...')
      ];
    }

    return true;
  }

  /* ============================================================
     5. APPLY VISUAL OPTIONS
     ============================================================ */

  function applyVisualOptions() {
    var reducedMotion = preferReducedMotion();

    // Toggle optional elements based on settings
    var toggles = {
      'splashLogo': getSetting('splash.show_logo', true),
      'splashHexagon': getSetting('splash.show_hexagon', true),
      'splashRings': getSetting('splash.show_rings', true),
      'splashParticles': getSetting('splash.show_particles', true),
      'splashProgressCircular': getSetting('splash.show_progress_circular', true),
      'splashProgressBar': getSetting('splash.show_progress_bar', false),
      'splashStatusText': getSetting('splash.show_status_text', true),
      'splashPresidentFooter': getSetting('splash.show_president_footer', true),
      'splashShimmer': getSetting('splash.show_shimmer', true)
    };

    Object.keys(toggles).forEach(function (id) {
      var el = $(id);
      if (el) {
        if (toggles[id] === false || reducedMotion && id === 'splashParticles') {
          el.setAttribute('hidden', '');
          el.style.display = 'none';
        } else {
          el.removeAttribute('hidden');
          el.style.display = '';
        }
      }
    });

    // Particles count
    var particles = $('splashParticles');
    if (particles && !reducedMotion) {
      var count = parseInt(getSetting('splash.particles_count', 20), 10);
      if (!isFinite(count) || count < 0) count = 20;
      if (count > 60) count = 60; // cap

      // If already has particles, don't recreate
      if (particles.children.length === 0) {
        for (var i = 0; i < count; i++) {
          var p = document.createElement('span');
          p.className = 'splash-particle';
          p.style.left = (Math.random() * 100) + '%';
          p.style.top = (Math.random() * 100) + '%';
          p.style.animationDelay = (Math.random() * 4) + 's';
          p.style.animationDuration = (3 + Math.random() * 4) + 's';
          particles.appendChild(p);
        }
      }
    }

    // Animation level
    var level = getSetting('splash.animation_level', 'medium');
    if (reducedMotion) level = 'low';
    document.documentElement.setAttribute('data-splash-animation', level);

    // Dynamic logo
    var logoUrl = getSetting('app_identity.logo_url', '');
    var logoEl = $('splashLogo');
    if (logoEl) {
      if (logoUrl) {
        logoEl.innerHTML = '<img src="' + escapeHtml(logoUrl) + '" alt="" onerror="this.parentNode.textContent=\'ن\';" />';
      } else {
        var name = getSetting('app_identity.union_name', 'نقابة');
        logoEl.textContent = String(name).charAt(0);
      }
    }

    // President footer
    var presEl = $('splashPresidentFooter');
    if (presEl) {
      var unionName = getSetting('app_identity.union_name', '');
      var presidentName = getSetting('app_identity.president_name', '');
      var presidentLabel = getSetting('app_identity.president_label', 'النقيب العام');
      var footerText = '';
      if (unionName) footerText += unionName;
      if (presidentName) {
        if (footerText) footerText += ' — ';
        footerText += presidentLabel + ': ' + presidentName;
      }
      presEl.textContent = footerText;
    }
  }

  /* ============================================================
     6. ROTATING TEXTS
     ============================================================ */

  function startRotatingTexts() {
    var statusEl = $('splashStatus');
    if (!statusEl) return;

    var initial = getLabel('splash.status_loading', 'جاري تحضير المنصة...');
    if (!isBlank(getSetting('splash.status_loading', ''))) {
      initial = getSetting('splash.status_loading', initial);
    }

    statusEl.textContent = state.texts[0] || initial;
    state.currentTextIdx = 0;

    if (state.texts.length <= 1) return;

    state.textTimer = setInterval(function () {
      state.currentTextIdx = (state.currentTextIdx + 1) % state.texts.length;
      // Fade out
      statusEl.style.opacity = '0';
      setTimeout(function () {
        statusEl.textContent = state.texts[state.currentTextIdx] || '';
        statusEl.style.opacity = '1';
      }, 200);
    }, TEXT_ROTATE_MS);
  }

  function stopRotatingTexts() {
    if (state.textTimer) {
      clearInterval(state.textTimer);
      state.textTimer = null;
    }
  }

  /* ============================================================
     7. PROGRESS
     ============================================================ */

  function setProgress(pct) {
    pct = Math.max(0, Math.min(100, pct));
    state.progress = pct;

    // Circular progress
    var circ = $('splashProgressCircular');
    if (circ) {
      var ring = circ.querySelector('.splash-progress-ring');
      if (ring) {
        // SVG circle: r=45, circumference = 2 * PI * 45 ≈ 282.74
        var circumference = 282.74;
        var offset = circumference - (pct / 100) * circumference;
        ring.style.strokeDashoffset = offset;
      }
    }

    // Bar progress
    var bar = $('splashProgressBar');
    if (bar) {
      var inner = bar.querySelector('.splash-progress-bar');
      if (inner) inner.style.width = pct + '%';
    }

    dispatchEvent('itws:splash-progress', { progress: pct });
  }

  function startFakeProgress() {
    setProgress(0);
    var step = 0;
    var totalSteps = Math.ceil(state.minDurationMs / 100);

    state.progressTimer = setInterval(function () {
      step++;
      var pct = Math.min(95, (step / totalSteps) * 100); // Never 100% until ready
      setProgress(pct);
    }, 100);
  }

  function completeProgress() {
    if (state.progressTimer) {
      clearInterval(state.progressTimer);
      state.progressTimer = null;
    }
    setProgress(100);
  }

  /* ============================================================
     8. AUTH CHECK
     ============================================================ */

  function fetchSession() {
    var sb = getSb();
    if (!sb || !sb.auth) return Promise.resolve(null);

    var promise = sb.auth.getSession();
    var timeout = new Promise(function (resolve) {
      setTimeout(function () { resolve(null); }, SESSION_TIMEOUT_MS);
    });

    return Promise.race([promise, timeout])
      .then(function (res) {
        if (!res || !res.data) return null;
        return res.data.session || null;
      })
      .catch(function (err) {
        log('debug', 'getSession failed', err && err.message);
        return null;
      });
  }

  function fetchProfile(userId) {
    var sb = getSb();
    if (!sb || !userId) return Promise.resolve(null);

    var promise = sb.from('profiles')
      .select('id, email, full_name, role, status, is_active, is_deleted, governorate_id, branch_id, academy_id')
      .eq('id', userId)
      .maybeSingle();

    var timeout = new Promise(function (resolve) {
      setTimeout(function () { resolve(null); }, PROFILE_TIMEOUT_MS);
    });

    return Promise.race([promise, timeout])
      .then(function (res) {
        if (!res || res.error) return null;
        return res.data || null;
      })
      .catch(function (err) {
        log('debug', 'fetchProfile failed', err && err.message);
        return null;
      });
  }

  /* ============================================================
     9. REDIRECT LOGIC
     ============================================================ */

  function computeDestination(profile) {
    // If ?next= param → use it (but validate)
    var next = getSafeNextParam();
    if (next) {
      return resolve(next);
    }

    // Guest
    if (!profile) {
      return resolve(getSetting('behavior.redirect_guest_to', 'home.html'));
    }

    // Status checks
    if (profile.status === 'pending' || profile.role === 'pending_user') {
      return resolve('login.html?pending=1');
    }
    if (profile.status === 'rejected') {
      return resolve('login.html?rejected=1');
    }
    if (profile.status === 'suspended') {
      return resolve('login.html?suspended=1');
    }
    if (profile.status !== 'active' || profile.is_active === false || profile.is_deleted === true) {
      return resolve('login.html?inactive=1');
    }

    // Role-based
    var role = profile.role || '';

    if (role === 'super_admin' || role === 'committee_head' ||
        role === 'committee_deputy' || role === 'committee_member') {
      return resolve(getSetting('behavior.redirect_admin_to', 'admin/index.html'));
    }

    if (role.indexOf('branch_') === 0) {
      return resolve('branch/index.html');
    }

    if (role === 'academy_owner' || role === 'academy_manager') {
      return resolve('portal/index.html');
    }

    // user
    return resolve(getSetting('behavior.redirect_user_to', 'home.html'));
  }

  function performRedirect(profile) {
    if (state.redirectDone) return;
    state.redirectDone = true;

    var dest = computeDestination(profile);

    // Update status text
    var statusEl = $('splashStatus');
    if (statusEl) {
      var redirectText = getSetting('splash.status_redirecting', '');
      if (isBlank(redirectText)) {
        redirectText = getLabel('splash.redirecting', 'جاري التحويل...');
      }
      statusEl.textContent = redirectText;
    }

    dispatchEvent('itws:splash-completed', {
      dest: dest,
      role: profile ? profile.role : null
    });

    log('debug', 'Redirecting', { dest: dest, role: profile ? profile.role : null });

    // Small delay for smooth transition
    setTimeout(function () {
      window.location.replace(dest);
    }, 250);
  }

  /* ============================================================
     10. SKIP (for testing)
     ============================================================ */

  function performQuickRedirect() {
    fetchSession()
      .then(function (session) {
        if (!session || !session.user) return null;
        return fetchProfile(session.user.id);
      })
      .then(function (profile) {
        performRedirect(profile);
      })
      .catch(function () {
        performRedirect(null);
      });
  }

  /* ============================================================
     11. INIT
     ============================================================ */

  function init() {
    if (state._initialized) return;
    state._initialized = true;

    state.startedAt = Date.now();

    dispatchEvent('itws:splash-start', {});

    // Skip check (?skip=1)
    if (shouldSkip()) {
      log('debug', 'Skip flag detected — redirecting fast');
      performQuickRedirect();
      return;
    }

    // Read settings
    var enabled = readSplashSettings();
    if (!enabled) {
      log('debug', 'Splash disabled by settings');
      performQuickRedirect();
      return;
    }

    // Apply visuals
    applyVisualOptions();
    startRotatingTexts();
    startFakeProgress();

    // Safety net: force redirect at max_duration
    state.maxTimer = setTimeout(function () {
      if (state.redirectDone) return;
      log('debug', 'Max duration reached, forcing redirect');
      performRedirect(state.profile);
    }, state.maxDurationMs);

    // Fetch session + profile in parallel with splash animation
    var sessionPromise = fetchSession();

    Promise.all([
      sessionPromise,
      new Promise(function (resolve) {
        // Ensure minimum duration is observed
        var elapsed = Date.now() - state.startedAt;
        var remaining = Math.max(0, state.minDurationMs - elapsed);
        setTimeout(resolve, remaining);
      })
    ])
      .then(function (results) {
        var session = results[0];

        if (!session || !session.user) {
          state.session = null;
          state.profile = null;
          completeProgress();
          stopRotatingTexts();
          performRedirect(null);
          return;
        }

        state.session = session;

        return fetchProfile(session.user.id).then(function (profile) {
          state.profile = profile;
          completeProgress();
          stopRotatingTexts();
          performRedirect(profile);
        });
      })
      .catch(function (err) {
        log('error', 'Init failed', err);
        completeProgress();
        stopRotatingTexts();
        performRedirect(null);
      });
  }

  /* ============================================================
     12. CLEANUP
     ============================================================ */

  function cleanup() {
    stopRotatingTexts();
    if (state.progressTimer) {
      clearInterval(state.progressTimer);
      state.progressTimer = null;
    }
    if (state.maxTimer) {
      clearTimeout(state.maxTimer);
      state.maxTimer = null;
    }
  }

  if (typeof window.addEventListener === 'function') {
    window.addEventListener('beforeunload', cleanup);
  }

  /* ============================================================
     13. EXPORT
     ============================================================ */

  window.SplashPage = {
    _initialized: true,
    init: init,
    skip: function () { performQuickRedirect(); },
    getState: function () {
      return {
        enabled: state.enabled,
        minDurationMs: state.minDurationMs,
        maxDurationMs: state.maxDurationMs,
        progress: state.progress,
        hasSession: !!state.session,
        hasProfile: !!state.profile,
        role: state.profile ? state.profile.role : null,
        redirectDone: state.redirectDone
      };
    }
  };

  /* ============================================================
     14. BOOT
     ============================================================ */

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  /* ============================================================
     15. DEBUG
     ============================================================ */

  var cfg = window.ITWS_CONFIG || {};
  if (cfg.DEBUG) {
    try {
      console.log('%c[SplashPage]', 'color: #F59E0B; font-weight: bold;', 'Module ready');
    } catch (e) {}
  }

})();
