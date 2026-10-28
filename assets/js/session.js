/* ============================================================
   ITWS Platform — Session Manager V2
   File: assets/js/session.js
   Description: Heartbeat, online counter, idle detection,
                session timeout, auto-logout, multi-tab sync

   Load order: AFTER utils.js + realtime.js + permissions.js

   Features:
   - Heartbeat ping every N ms (configurable)
   - Session upsert to `sessions` table
   - Online counter (aggregate from sessions)
   - Idle detection (user inactivity)
   - Session timeout warning (modal)
   - Auto-logout on timeout (configurable)
   - Multi-tab sync (BroadcastChannel + storage events)
   - Activity tracking (mouse, keyboard, scroll, touch)
   - Pause heartbeat on tab hidden
   - Events: itws:session-started, itws:session-warning,
             itws:session-timeout, itws:session-extended,
             itws:online-count-changed

   Rules:
   - No emoji
   - ES5-style IIFE
   - window.sb only
   - Skips work if user not logged in
   - Respects settings from security.* + behavior.*
   ============================================================ */

(function () {
  'use strict';

  if (window.Session && window.Session._initialized) {
    return;
  }

  /* ============================================================
     1. HELPERS
     ============================================================ */

  function log(level, msg, data) {
    var cfg = window.ITWS_CONFIG || {};
    if (level === 'error' || (cfg.DEBUG && level === 'debug')) {
      try {
        var args = ['[Session]', msg];
        if (data !== undefined) args.push(data);
        if (level === 'error') console.error.apply(console, args);
        else console.log.apply(console, args);
      } catch (e) {}
    }
  }

  function getSb() {
    return window.sb || window.supabaseClient || window.ITWS_SUPABASE || null;
  }

  function getConfig() {
    return window.ITWS_CONFIG || {};
  }

  function getAppSettings(path, fallback) {
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
        return window.Labels.t(key, fallback);
      }
    } catch (e) {}
    return fallback;
  }

  function dispatchEvent(name, detail) {
    try {
      window.dispatchEvent(new CustomEvent(name, { detail: detail || {} }));
    } catch (e) {}
  }

  function uuid() {
    try {
      if (window.Utils && window.Utils.uuid) return window.Utils.uuid();
    } catch (e) {}
    if (window.crypto && window.crypto.randomUUID) return window.crypto.randomUUID();
    return 'sess_' + Date.now() + '_' + Math.random().toString(36).substring(2, 15);
  }

  function now() { return Date.now(); }

  /* ============================================================
     2. CONSTANTS
     ============================================================ */

  var STORAGE_KEY = 'itws_session_tab';
  var ACTIVITY_THROTTLE_MS = 5000;
  var HEARTBEAT_MIN_MS = 10000;
  var ONLINE_UPDATE_INTERVAL_MS = 30000;

  var ACTIVITY_EVENTS = ['mousedown', 'mousemove', 'keydown', 'scroll', 'touchstart', 'click', 'focus'];

  /* ============================================================
     3. STATE
     ============================================================ */

  var state = {
    initialized: false,
    userId: null,
    sessionId: null,        // unique per tab
    sessionRowId: null,     // DB row id (for updates)

    heartbeatIntervalMs: 60000,
    sessionTimeoutMs: 60 * 60 * 1000,
    warningBeforeMs: 5 * 60 * 1000,

    lastActivity: now(),
    lastHeartbeat: 0,
    lastOnlineUpdate: 0,
    lastActivityBroadcast: 0,

    heartbeatTimer: null,
    checkTimer: null,
    onlineTimer: null,
    warningTimer: null,
    timeoutTimer: null,

    isIdle: false,
    isWarning: false,
    isExpired: false,
    isLoggedIn: false,
    isPaused: false,        // when tab hidden or user logged out
    onlineCount: 0,

    warningModalEl: null,
    warningCountdownEl: null,

    broadcastChannel: null,
    listeners: [],
    visibilityHandler: null,
    activityHandler: null,
    storageHandler: null,
    onlineHandler: null
  };

  /* ============================================================
     4. BROADCAST CHANNEL (multi-tab sync)
     ============================================================ */

  function setupBroadcast() {
    try {
      if (typeof BroadcastChannel === 'undefined') return;
      state.broadcastChannel = new BroadcastChannel('itws_session');

      state.broadcastChannel.addEventListener('message', function (e) {
        var data = e.data || {};
        if (data.type === 'activity') {
          state.lastActivity = data.timestamp;
          state.isIdle = false;
          clearWarning();
        } else if (data.type === 'logout') {
          // Another tab logged out — do the same
          doLogout('other-tab');
        } else if (data.type === 'extend') {
          state.lastActivity = now();
          clearWarning();
        }
      });
    } catch (e) {
      log('error', 'BroadcastChannel setup failed', e);
    }
  }

  function broadcast(type, data) {
    if (!state.broadcastChannel) return;
    try {
      state.broadcastChannel.postMessage({ type: type, timestamp: now(), data: data });
    } catch (e) {}
  }

  /* ============================================================
     5. ACTIVITY TRACKING
     ============================================================ */

  function onActivity() {
    var t = now();

    // Throttle activity updates
    if (t - state.lastActivityBroadcast < ACTIVITY_THROTTLE_MS) return;
    state.lastActivityBroadcast = t;

    var wasIdle = state.isIdle;
    state.lastActivity = t;
    state.isIdle = false;

    if (wasIdle) {
      log('debug', 'User became active');
    }

    // Clear any warning
    if (state.isWarning) {
      clearWarning();
      dispatchEvent('itws:session-extended', { reason: 'activity' });
    }

    // Broadcast to other tabs
    broadcast('activity');
  }

  function bindActivityListeners() {
    state.activityHandler = function () { onActivity(); };
    ACTIVITY_EVENTS.forEach(function (evt) {
      try { document.addEventListener(evt, state.activityHandler, { passive: true }); } catch (e) {}
    });
  }

  function unbindActivityListeners() {
    if (!state.activityHandler) return;
    ACTIVITY_EVENTS.forEach(function (evt) {
      try { document.removeEventListener(evt, state.activityHandler); } catch (e) {}
    });
    state.activityHandler = null;
  }

  /* ============================================================
     6. VISIBILITY
     ============================================================ */

  function onVisibilityChange() {
    if (document.hidden) {
      log('debug', 'Tab hidden — pausing heartbeat');
      state.isPaused = true;
    } else {
      log('debug', 'Tab visible — resuming');
      state.isPaused = false;
      // Send immediate heartbeat on resume
      sendHeartbeat();
      checkTimeout();
    }
  }

  function bindVisibilityListener() {
    state.visibilityHandler = onVisibilityChange;
    try { document.addEventListener('visibilitychange', state.visibilityHandler); } catch (e) {}
  }

  function unbindVisibilityListener() {
    if (!state.visibilityHandler) return;
    try { document.removeEventListener('visibilitychange', state.visibilityHandler); } catch (e) {}
    state.visibilityHandler = null;
  }

  /* ============================================================
     7. HEARTBEAT
     ============================================================ */

  function sendHeartbeat() {
    if (!state.isLoggedIn || !state.userId) return;
    if (state.isExpired) return;
    if (state.isPaused && document.hidden) return;

    var sb = getSb();
    if (!sb) return;

    var payload = {
      user_id: state.userId,
      session_id: state.sessionId,
      last_heartbeat: new Date().toISOString(),
      user_agent: (navigator.userAgent || '').substring(0, 500)
    };

    state.lastHeartbeat = now();

    // Try upsert (session_id unique)
    Promise.resolve()
      .then(function () {
        return sb.from('sessions').upsert(payload, {
          onConflict: 'session_id'
        }).select('id').maybeSingle();
      })
      .then(function (res) {
        if (res && res.error) {
          log('error', 'Heartbeat failed', res.error.message);
          return;
        }
        if (res && res.data && res.data.id) {
          state.sessionRowId = res.data.id;
        }
        log('debug', 'Heartbeat sent');
      })
      .catch(function (err) {
        log('error', 'Heartbeat catch', err && err.message);
      });

    // Update online count periodically
    var t = now();
    if (t - state.lastOnlineUpdate >= ONLINE_UPDATE_INTERVAL_MS) {
      state.lastOnlineUpdate = t;
      fetchOnlineCount();
    }
  }

  function startHeartbeat() {
    stopHeartbeat();
    state.heartbeatTimer = setInterval(sendHeartbeat, state.heartbeatIntervalMs);
    log('debug', 'Heartbeat started', { intervalMs: state.heartbeatIntervalMs });
    // Immediate first ping
    sendHeartbeat();
  }

  function stopHeartbeat() {
    if (state.heartbeatTimer) {
      clearInterval(state.heartbeatTimer);
      state.heartbeatTimer = null;
    }
  }

  /* ============================================================
     8. ONLINE COUNTER
     ============================================================ */

  function fetchOnlineCount() {
    var sb = getSb();
    if (!sb) return;

    var thresholdMs = getAppSettings('behavior.online_threshold_ms', 120000);
    var thresholdTime = new Date(now() - thresholdMs).toISOString();

    Promise.resolve()
      .then(function () {
        return sb.from('sessions')
          .select('user_id', { count: 'exact', head: true })
          .gte('last_heartbeat', thresholdTime);
      })
      .then(function (res) {
        if (res && res.error) {
          log('error', 'Online count failed', res.error.message);
          return;
        }
        var newCount = (res && typeof res.count === 'number') ? res.count : 0;
        if (newCount !== state.onlineCount) {
          state.onlineCount = newCount;
          dispatchEvent('itws:online-count-changed', { count: newCount });
          notifyListeners({ onlineCount: newCount });
          log('debug', 'Online count updated', newCount);
        }
      })
      .catch(function (err) {
        log('error', 'Online count catch', err && err.message);
      });
  }

  function startOnlineCounter() {
    stopOnlineCounter();
    fetchOnlineCount();
    state.onlineTimer = setInterval(fetchOnlineCount, ONLINE_UPDATE_INTERVAL_MS);
  }

  function stopOnlineCounter() {
    if (state.onlineTimer) {
      clearInterval(state.onlineTimer);
      state.onlineTimer = null;
    }
  }

  /* ============================================================
     9. IDLE / TIMEOUT CHECK
     ============================================================ */

  function checkTimeout() {
    if (!state.isLoggedIn || !state.userId || state.isExpired) return;
    if (document.hidden) return;

    var elapsed = now() - state.lastActivity;
    var warningAt = state.sessionTimeoutMs - state.warningBeforeMs;

    // Session expired
    if (elapsed >= state.sessionTimeoutMs) {
      if (!state.isExpired) {
        expireSession();
      }
      return;
    }

    // Warning threshold
    if (elapsed >= warningAt && !state.isWarning) {
      showWarning();
      return;
    }

    // Idle but not yet warning
    if (elapsed >= state.heartbeatIntervalMs && !state.isIdle) {
      state.isIdle = true;
      log('debug', 'User idle');
    }
  }

  function startTimeoutChecker() {
    stopTimeoutChecker();
    state.checkTimer = setInterval(checkTimeout, 10000); // check every 10s
    log('debug', 'Timeout checker started');
  }

  function stopTimeoutChecker() {
    if (state.checkTimer) {
      clearInterval(state.checkTimer);
      state.checkTimer = null;
    }
  }

  /* ============================================================
     10. WARNING MODAL
     ============================================================ */

  function showWarning() {
    if (state.isWarning) return;
    state.isWarning = true;

    dispatchEvent('itws:session-warning', {
      secondsRemaining: Math.floor(state.warningBeforeMs / 1000)
    });

    // Build modal
    var modal = document.createElement('div');
    modal.id = 'itws-session-warning';
    modal.setAttribute('role', 'alertdialog');
    modal.setAttribute('aria-modal', 'true');
    modal.setAttribute('aria-labelledby', 'itws-session-warning-title');

    // R13 — responsive overlay
    modal.style.cssText =
      'position:fixed;inset:0;z-index:99998;' +
      'background:rgba(0,0,0,0.6);' +
      'display:flex;align-items:center;justify-content:center;' +
      'padding:max(16px, env(safe-area-inset-left)) max(16px, env(safe-area-inset-right));' +
      'animation:itwsWarnFadeIn 0.2s ease;';

    var box = document.createElement('div');
    box.style.cssText =
      'background:var(--surface-elevated, #1C2430);' +
      'color:var(--text, #F8FAFC);' +
      'border:1px solid var(--border, rgba(255,255,255,0.1));' +
      'border-radius:16px;' +
      'padding:clamp(20px, 4vw, 32px);' +
      'max-width:min(420px, 100%);' +
      'width:100%;' +
      'text-align:center;' +
      'box-shadow:0 20px 60px rgba(0,0,0,0.5);' +
      'font-family:Cairo, sans-serif;';

    var title = document.createElement('h2');
    title.id = 'itws-session-warning-title';
    title.textContent = getLabel('auth.session.warning_title', 'جلستك على وشك الانتهاء');
    title.style.cssText =
      'margin:0 0 12px;font-size:clamp(18px, 3vw, 22px);' +
      'font-weight:800;line-height:1.3;color:var(--warning, #F59E0B);';

    var text = document.createElement('p');
    text.textContent = getLabel('auth.session.warning_text', 'سيتم تسجيل خروجك تلقائياً بعد:');
    text.style.cssText =
      'margin:0 0 16px;font-size:14px;line-height:1.6;' +
      'color:var(--text-secondary, #94A3B8);';

    var countdown = document.createElement('div');
    countdown.id = 'itws-session-warning-countdown';
    countdown.style.cssText =
      'font-size:clamp(32px, 6vw, 44px);font-weight:900;' +
      'font-variant-numeric:tabular-nums;' +
      'color:var(--warning, #F59E0B);' +
      'margin:0 0 24px;letter-spacing:1px;';

    var actions = document.createElement('div');
    actions.style.cssText =
      'display:flex;gap:10px;flex-wrap:wrap;justify-content:center;';

    var extendBtn = document.createElement('button');
    extendBtn.type = 'button';
    extendBtn.textContent = getLabel('auth.session.extend', 'متابعة الجلسة');
    extendBtn.style.cssText =
      'flex:1;min-width:140px;padding:12px 20px;' +
      'background:var(--primary, #CE1126);' +
      'color:var(--primary-text, #fff);border:none;' +
      'border-radius:10px;font-family:inherit;font-size:14px;' +
      'font-weight:700;cursor:pointer;transition:all 0.2s;';
    extendBtn.addEventListener('click', function () {
      extendSession();
    });

    var logoutBtn = document.createElement('button');
    logoutBtn.type = 'button';
    logoutBtn.textContent = getLabel('auth.session.logout_now', 'تسجيل الخروج الآن');
    logoutBtn.style.cssText =
      'flex:1;min-width:140px;padding:12px 20px;' +
      'background:transparent;' +
      'color:var(--text-secondary, #94A3B8);' +
      'border:1px solid var(--border, rgba(255,255,255,0.1));' +
      'border-radius:10px;font-family:inherit;font-size:14px;' +
      'font-weight:600;cursor:pointer;transition:all 0.2s;';
    logoutBtn.addEventListener('click', function () {
      doLogout('manual-warning');
    });

    actions.appendChild(extendBtn);
    actions.appendChild(logoutBtn);

    box.appendChild(title);
    box.appendChild(text);
    box.appendChild(countdown);
    box.appendChild(actions);
    modal.appendChild(box);

    // Inject keyframes once
    if (!document.getElementById('itws-warn-keyframes')) {
      var style = document.createElement('style');
      style.id = 'itws-warn-keyframes';
      style.textContent =
        '@keyframes itwsWarnFadeIn{from{opacity:0;}to{opacity:1;}}' +
        '@keyframes itwsWarnFadeOut{from{opacity:1;}to{opacity:0;}}';
      document.head.appendChild(style);
    }

    document.body.appendChild(modal);
    state.warningModalEl = modal;
    state.warningCountdownEl = countdown;

    // Start countdown
    startWarningCountdown();
  }

  function startWarningCountdown() {
    var endAt = now() + state.warningBeforeMs;

    if (state.warningTimer) clearInterval(state.warningTimer);
    state.warningTimer = setInterval(function () {
      var remaining = Math.max(0, endAt - now());
      var seconds = Math.ceil(remaining / 1000);
      if (state.warningCountdownEl) {
        state.warningCountdownEl.textContent = seconds + 's';
      }
      if (remaining <= 0) {
        clearInterval(state.warningTimer);
        state.warningTimer = null;
      }
    }, 250);

    // Initial
    if (state.warningCountdownEl) {
      state.warningCountdownEl.textContent = Math.ceil(state.warningBeforeMs / 1000) + 's';
    }
  }

  function clearWarning() {
    if (state.warningTimer) {
      clearInterval(state.warningTimer);
      state.warningTimer = null;
    }
    if (state.warningModalEl && state.warningModalEl.parentNode) {
      try {
        state.warningModalEl.style.animation = 'itwsWarnFadeOut 0.2s ease';
        setTimeout(function () {
          if (state.warningModalEl && state.warningModalEl.parentNode) {
            state.warningModalEl.parentNode.removeChild(state.warningModalEl);
          }
        }, 200);
      } catch (e) {
        if (state.warningModalEl.parentNode) {
          state.warningModalEl.parentNode.removeChild(state.warningModalEl);
        }
      }
    }
    state.warningModalEl = null;
    state.warningCountdownEl = null;
    state.isWarning = false;
  }

  /* ============================================================
     11. EXTEND / EXPIRE / LOGOUT
     ============================================================ */

  function extendSession() {
    state.lastActivity = now();
    state.isIdle = false;
    state.isExpired = false;
    clearWarning();
    sendHeartbeat();
    broadcast('extend');
    dispatchEvent('itws:session-extended', { reason: 'manual' });
    log('debug', 'Session extended');
  }

  function expireSession() {
    if (state.isExpired) return;
    state.isExpired = true;
    clearWarning();

    dispatchEvent('itws:session-timeout', { reason: 'idle' });
    log('debug', 'Session expired — logging out');
    doLogout('timeout');
  }

  function doLogout(reason) {
    stopHeartbeat();
    stopTimeoutChecker();
    stopOnlineCounter();
    unbindActivityListeners();
    unbindVisibilityListener();

    // Clear local storage session
    try { localStorage.removeItem(STORAGE_KEY); } catch (e) {}

    // Broadcast logout to other tabs
    broadcast('logout', { reason: reason });

    // Sign out from Supabase
    var sb = getSb();
    if (sb && sb.auth) {
      Promise.resolve()
        .then(function () { return sb.auth.signOut(); })
        .then(function () {
          redirectToLogin();
        })
        .catch(function () {
          redirectToLogin();
        });
    } else {
      redirectToLogin();
    }

    function redirectToLogin() {
      var loginUrl = 'login.html';
      try {
        if (window.resolveUrl) loginUrl = window.resolveUrl('login.html');
      } catch (e) {}
      var currentPath = window.location.pathname || '';
      if (currentPath.indexOf('login.html') === -1 && currentPath.indexOf('reset-password.html') === -1) {
        var nextParam = '?next=' + encodeURIComponent(currentPath);
        window.location.href = loginUrl + nextParam;
      }
    }
  }

  /* ============================================================
     12. START / STOP (per user)
     ============================================================ */

  function startForUser(userId) {
    if (!userId) return;

    if (state.isLoggedIn && state.userId === userId) {
      log('debug', 'Already running for same user');
      return;
    }

    stop(); // cleanup previous

    state.userId = userId;
    state.sessionId = uuid();
    state.isLoggedIn = true;
    state.isPaused = false;
    state.isExpired = false;
    state.lastActivity = now();
    state.lastActivityBroadcast = 0;
    state.lastHeartbeat = 0;
    state.lastOnlineUpdate = 0;

    // Load config from settings
    state.heartbeatIntervalMs = Math.max(
      HEARTBEAT_MIN_MS,
      getAppSettings('behavior.heartbeat_interval_ms', 60000)
    );
    state.sessionTimeoutMs = getAppSettings('security.session_timeout_minutes', 60) * 60 * 1000;
    // Warning before timeout: use 5 min default, or 20% of timeout if smaller
    state.warningBeforeMs = Math.min(
      5 * 60 * 1000,
      Math.floor(state.sessionTimeoutMs * 0.2)
    );

    // Persist sessionId in storage for tab identification
    try { localStorage.setItem(STORAGE_KEY, state.sessionId); } catch (e) {}

    // Bind everything
    setupBroadcast();
    bindActivityListeners();
    bindVisibilityListener();

    // Start timers
    startHeartbeat();
    startTimeoutChecker();
    startOnlineCounter();

    dispatchEvent('itws:session-started', {
      userId: userId,
      sessionId: state.sessionId,
      heartbeatMs: state.heartbeatIntervalMs,
      timeoutMs: state.sessionTimeoutMs,
      warningMs: state.warningBeforeMs
    });

    log('debug', 'Session started', {
      userId: userId,
      heartbeatMs: state.heartbeatIntervalMs,
      timeoutMs: state.sessionTimeoutMs
    });
  }

  function stop() {
    // Clear DB session row (best-effort)
    if (state.sessionRowId) {
      var sb = getSb();
      if (sb) {
        Promise.resolve()
          .then(function () {
            return sb.from('sessions').delete().eq('id', state.sessionRowId);
          })
          .catch(function () {});
      }
    }

    stopHeartbeat();
    stopTimeoutChecker();
    stopOnlineCounter();
    unbindActivityListeners();
    unbindVisibilityListener();
    clearWarning();

    try { localStorage.removeItem(STORAGE_KEY); } catch (e) {}

    if (state.broadcastChannel) {
      try { state.broadcastChannel.close(); } catch (e) {}
      state.broadcastChannel = null;
    }

    state.userId = null;
    state.sessionId = null;
    state.sessionRowId = null;
    state.isLoggedIn = false;
    state.isExpired = false;
    state.isIdle = false;
    state.isPaused = false;

    log('debug', 'Session stopped');
  }

  /* ============================================================
     13. LISTENERS
     ============================================================ */

  function notifyListeners(payload) {
    state.listeners.slice().forEach(function (fn) {
      try { fn(payload); } catch (e) { log('error', 'Listener error', e); }
    });
  }

  function onChange(callback) {
    if (typeof callback !== 'function') return function () {};
    state.listeners.push(callback);
    return function unsubscribe() {
      var idx = state.listeners.indexOf(callback);
      if (idx !== -1) state.listeners.splice(idx, 1);
    };
  }

  /* ============================================================
     14. AUTO-BIND TO AUTH STATE
     ============================================================ */

  function bindAuthListener() {
    window.addEventListener('itws:auth-changed', function (e) {
      var detail = e && e.detail ? e.detail : {};
      var event = detail.event;

      if (event === 'SIGNED_IN' && detail.user && detail.user.id) {
        startForUser(detail.user.id);
      } else if (event === 'SIGNED_OUT') {
        stop();
      }
    });
  }

  function checkInitialAuth() {
    var sb = getSb();
    if (!sb || !sb.auth) return;

    Promise.resolve()
      .then(function () { return sb.auth.getUser(); })
      .then(function (res) {
        if (res && res.data && res.data.user) {
          startForUser(res.data.user.id);
        }
      })
      .catch(function () {});
  }

  /* ============================================================
     15. INIT
     ============================================================ */

  function init() {
    if (state.initialized) return;
    state.initialized = true;

    bindAuthListener();

    // If sb available — check initial auth
    if (getSb()) {
      checkInitialAuth();
    } else {
      // Wait for sb
      window.addEventListener('itws:sb-ready', function () {
        checkInitialAuth();
      }, { once: true });
    }
  }

  /* ============================================================
     16. EXPORT
     ============================================================ */

  window.Session = {
    _initialized: true,

    // Control
    start: startForUser,
    stop: stop,
    extend: extendSession,
    logout: function () { doLogout('manual'); },

    // Queries
    isLoggedIn: function () { return state.isLoggedIn; },
    isIdle: function () { return state.isIdle; },
    isWarning: function () { return state.isWarning; },
    isExpired: function () { return state.isExpired; },
    getUserId: function () { return state.userId; },
    getSessionId: function () { return state.sessionId; },
    getOnlineCount: function () { return state.onlineCount; },
    getIdleMs: function () { return now() - state.lastActivity; },
    getRemainingMs: function () {
      if (!state.isLoggedIn) return 0;
      return Math.max(0, state.sessionTimeoutMs - (now() - state.lastActivity));
    },
    getState: function () {
      return {
        userId: state.userId,
        sessionId: state.sessionId,
        isLoggedIn: state.isLoggedIn,
        isIdle: state.isIdle,
        isWarning: state.isWarning,
        isExpired: state.isExpired,
        onlineCount: state.onlineCount,
        idleMs: now() - state.lastActivity,
        remainingMs: Math.max(0, state.sessionTimeoutMs - (now() - state.lastActivity)),
        heartbeatIntervalMs: state.heartbeatIntervalMs,
        sessionTimeoutMs: state.sessionTimeoutMs,
        warningBeforeMs: state.warningBeforeMs
      };
    },

    // Force online count refresh
    refreshOnlineCount: fetchOnlineCount,

    // Listeners
    onChange: onChange
  };

  // Boot
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  // Cleanup on unload
  if (typeof window.addEventListener === 'function') {
    window.addEventListener('beforeunload', function () {
      stopHeartbeat();
      stopTimeoutChecker();
      stopOnlineCounter();
    });
  }

  /* ============================================================
     17. DEBUG LOG
     ============================================================ */

  var cfg = getConfig();
  if (cfg.DEBUG) {
    try {
      console.log('%c[Session]', 'color: #3B82F6; font-weight: bold;', 'Manager ready');
    } catch (e) {}
  }

})();
