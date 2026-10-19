// ============================================
// [8/50] ITWS Platform - Session Manager
// Path: assets/js/session.js
// ============================================
// إصلاح: fallback للـ upsert لو مفيش unique constraint
// إصلاح: بدون إيموجي
// إصلاح: heartbeat أكثر كفاءة
// إصلاح: uses keepalive on beforeunload
// ============================================

(function () {
  'use strict';

  if (window.SessionManager && window.SessionManager.initialized) return;

  var cfg = window.ITWS_CONFIG;
  var HEARTBEAT_INTERVAL = (cfg && cfg.HEARTBEAT_INTERVAL) || 60000;
  var ONLINE_THRESHOLD = (cfg && cfg.ONLINE_THRESHOLD) || 120000;

  var state = {
    heartbeatTimer: null,
    channel: null,
    visitorId: null,
    userId: null,
    lastHeartbeatAt: null,
    isOnline: false,
    initialized: false,
    upsertSupported: true,
    useFallback: false
  };

  // ============================================
  // 1. توليد/جلب visitor ID
  // ============================================
  function getVisitorId() {
    if (state.visitorId) return state.visitorId;

    if (window.Utils && window.Utils.getVisitorId) {
      state.visitorId = window.Utils.getVisitorId();
      return state.visitorId;
    }

    var key = 'itws_visitor_id';
    try {
      var id = localStorage.getItem(key);
      if (!id) {
        id = 'v_' + generateId();
        localStorage.setItem(key, id);
      }
      state.visitorId = id;
    } catch (e) {
      state.visitorId = 'v_' + generateId();
    }
    return state.visitorId;
  }

  function generateId() {
    return Math.random().toString(36).substring(2) + Date.now().toString(36);
  }

  // ============================================
  // 2. جلب المستخدم الحالي
  // ============================================
  function getCurrentUser() {
    if (!window.sb) return Promise.resolve(null);
    return window.sb.auth.getUser()
      .then(function (res) {
        return res && res.data ? res.data.user : null;
      })
      .catch(function () { return null; });
  }

  // ============================================
  // 3. بناء payload
  // ============================================
  function buildPayload(user) {
    return {
      visitor_id: getVisitorId(),
      user_id: user ? user.id : null,
      user_role: user ? 'authenticated' : 'visitor',
      user_agent: String(navigator.userAgent).substring(0, 200),
      last_seen_at: new Date().toISOString()
    };
  }

  // ============================================
  // 4. محاولة upsert
  // ============================================
  function tryUpsert(payload) {
    return window.sb
      .from('sessions')
      .upsert(payload, { onConflict: 'visitor_id' })
      .then(function (res) {
        if (res.error) {
          logDebug('upsert error:', res.error.message);
          return { success: false, error: res.error.message };
        }
        return { success: true };
      })
      .catch(function (err) {
        logDebug('upsert catch:', err.message);
        return { success: false, error: err.message };
      });
  }

  // ============================================
  // 5. Fallback: select ثم update/insert
  // ============================================
  function fallbackUpsert(payload) {
    // نبحث عن صف موجود بنفس visitor_id
    return window.sb
      .from('sessions')
      .select('id')
      .eq('visitor_id', payload.visitor_id)
      .limit(1)
      .then(function (res) {
        if (res.error) {
          throw new Error(res.error.message);
        }

        var existing = res.data && res.data.length > 0 ? res.data[0] : null;

        if (existing) {
          // update
          return window.sb
            .from('sessions')
            .update({
              user_id: payload.user_id,
              user_role: payload.user_role,
              user_agent: payload.user_agent,
              last_seen_at: payload.last_seen_at
            })
            .eq('id', existing.id)
            .then(function (r) {
              if (r.error) throw new Error(r.error.message);
              return { success: true };
            });
        } else {
          // insert
          return window.sb
            .from('sessions')
            .insert(payload)
            .then(function (r) {
              if (r.error) throw new Error(r.error.message);
              return { success: true };
            });
        }
      })
      .catch(function (err) {
        logDebug('fallbackUpsert error:', err.message);
        return { success: false, error: err.message };
      });
  }

  // ============================================
  // 6. إرسال heartbeat واحد
  // ============================================
  function sendHeartbeat() {
    if (!window.sb) return Promise.resolve(false);

    // متبعتش heartbeat لو التبويب مخفي
    if (document.visibilityState === 'hidden') {
      return Promise.resolve(false);
    }

    return getCurrentUser().then(function (user) {
      state.userId = user ? user.id : null;
      var payload = buildPayload(user);

      // جرب upsert أولاً
      return tryUpsert(payload).then(function (result) {
        // لو نجح → تمام
        if (result.success) {
          state.lastHeartbeatAt = payload.last_seen_at;
          state.isOnline = true;
          return true;
        }

        // لو فشل → جرب الـ fallback
        logDebug('Switching to fallback strategy');
        return fallbackUpsert(payload).then(function (fbResult) {
          if (fbResult.success) {
            state.lastHeartbeatAt = payload.last_seen_at;
            state.isOnline = true;
            state.useFallback = true;
            return true;
          }
          return false;
        });
      });
    }).catch(function (err) {
      logDebug('Heartbeat error:', err.message);
      return false;
    });
  }

  // ============================================
  // 7. البدء
  // ============================================
  function start() {
    if (state.heartbeatTimer) return;

    // إرسال فوري
    sendHeartbeat();

    // إرسال دوري
    state.heartbeatTimer = setInterval(sendHeartbeat, HEARTBEAT_INTERVAL);

    // عند عودة التبويب
    document.addEventListener('visibilitychange', onVisibilityChange);

    // عند عودة الإنترنت
    window.addEventListener('online', onOnline);

    // عند إغلاق الصفحة (best effort)
    window.addEventListener('beforeunload', markOffline);

    logDebug('Session started (interval:', HEARTBEAT_INTERVAL, 'ms)');
  }

  // ============================================
  // 8. الإيقاف
  // ============================================
  function stop() {
    if (state.heartbeatTimer) {
      clearInterval(state.heartbeatTimer);
      state.heartbeatTimer = null;
    }
    document.removeEventListener('visibilitychange', onVisibilityChange);
    window.removeEventListener('online', onOnline);
    window.removeEventListener('beforeunload', markOffline);
    logDebug('Session stopped');
  }

  // ============================================
  // 9. markOffline (عند إغلاق الصفحة)
  // ============================================
  function markOffline() {
    if (!window.sb || !state.visitorId) return;

    // نخلي last_seen_at قديم جداً عشان يبقى offline
    var oldTime = new Date(Date.now() - 3600000).toISOString();
    var url = cfg.SUPABASE_URL + '/rest/v1/sessions?visitor_id=eq.' +
      encodeURIComponent(state.visitorId);

    try {
      fetch(url, {
        method: 'PATCH',
        headers: {
          'apikey': cfg.SUPABASE_ANON_KEY,
          'Authorization': 'Bearer ' + cfg.SUPABASE_ANON_KEY,
          'Content-Type': 'application/json',
          'Prefer': 'return=minimal'
        },
        body: JSON.stringify({ last_seen_at: oldTime }),
        keepalive: true
      }).catch(function () {});
    } catch (e) {
      // best effort
    }
  }

  // ============================================
  // 10. Visibility change
  // ============================================
  function onVisibilityChange() {
    if (document.visibilityState === 'visible') {
      sendHeartbeat();
    }
  }

  // ============================================
  // 11. Online
  // ============================================
  function onOnline() {
    sendHeartbeat();
  }

  // ============================================
  // 12. عدد المتصلين
  // ============================================
  function getOnlineCount() {
    if (!window.sb) return Promise.resolve(0);

    var threshold = new Date(Date.now() - ONLINE_THRESHOLD).toISOString();

    return window.sb
      .from('sessions')
      .select('*', { count: 'exact', head: true })
      .gte('last_seen_at', threshold)
      .then(function (res) {
        if (res.error) {
          logDebug('getOnlineCount error:', res.error.message);
          return 0;
        }
        return res.count || 0;
      })
      .catch(function () { return 0; });
  }

  // ============================================
  // 13. قائمة المتصلين
  // ============================================
  function getOnlineUsers() {
    if (!window.sb) return Promise.resolve([]);

    var threshold = new Date(Date.now() - ONLINE_THRESHOLD).toISOString();

    return window.sb
      .from('sessions')
      .select('visitor_id, user_id, user_role, last_seen_at, user_agent')
      .gte('last_seen_at', threshold)
      .order('last_seen_at', { ascending: false })
      .then(function (res) {
        if (res.error) return [];
        return res.data || [];
      })
      .catch(function () { return []; });
  }

  // ============================================
  // 14. المتصلين المسجلين فقط
  // ============================================
  function getOnlineAuthenticatedUsers() {
    if (!window.sb) return Promise.resolve([]);

    var threshold = new Date(Date.now() - ONLINE_THRESHOLD).toISOString();

    return window.sb
      .from('sessions')
      .select('user_id, user_role, last_seen_at')
      .gte('last_seen_at', threshold)
      .not('user_id', 'is', null)
      .then(function (res) {
        if (res.error) return [];
        return res.data || [];
      })
      .catch(function () { return []; });
  }

  // ============================================
  // 15. Subscribe to changes (realtime)
  // ============================================
  function subscribeToSessions(onChange) {
    if (!window.sb) return null;

    if (state.channel) {
      state.channel.unsubscribe();
    }

    try {
      state.channel = window.sb
        .channel('sessions-presence')
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'sessions' },
          function (payload) {
            logDebug('Sessions changed:', payload.eventType);
            if (typeof onChange === 'function') {
              onChange(payload);
            }
          }
        )
        .subscribe(function (status) {
          logDebug('Sessions channel:', status);
        });
      return state.channel;
    } catch (e) {
      logDebug('subscribeToSessions error:', e.message);
      return null;
    }
  }

  // ============================================
  // 16. Unsubscribe
  // ============================================
  function unsubscribe() {
    if (state.channel) {
      state.channel.unsubscribe();
      state.channel = null;
    }
  }

  // ============================================
  // 17. Status
  // ============================================
  function getStatus() {
    return {
      isOnline: state.isOnline,
      visitorId: state.visitorId,
      userId: state.userId,
      lastHeartbeatAt: state.lastHeartbeatAt,
      useFallback: state.useFallback
    };
  }

  // ============================================
  // 18. Helpers
  // ============================================
  function logDebug() {
    if (cfg && cfg.DEBUG) {
      console.log.apply(console, ['[SessionManager]'].concat(Array.prototype.slice.call(arguments)));
    }
  }

  // ============================================
  // 19. Public API
  // ============================================
  window.SessionManager = {
    initialized: true,
    start: start,
    stop: stop,
    getVisitorId: getVisitorId,
    sendHeartbeat: sendHeartbeat,
    getOnlineCount: getOnlineCount,
    getOnlineUsers: getOnlineUsers,
    getOnlineAuthenticatedUsers: getOnlineAuthenticatedUsers,
    subscribeToSessions: subscribeToSessions,
    unsubscribe: unsubscribe,
    getStatus: getStatus
  };

  // ============================================
  // 20. Auto-start
  // ============================================
  function autoStart() {
    if (!window.sb) {
      logDebug('Waiting for Supabase client...');
      setTimeout(autoStart, 1000);
      return;
    }
    start();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', autoStart);
  } else {
    autoStart();
  }

})();
