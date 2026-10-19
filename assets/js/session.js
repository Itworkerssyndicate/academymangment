// ============================================
// [8/50] ITWS Platform - Session Manager
// Path: assets/js/session.js
// ============================================
// 💡 يدير حضور المستخدم (Online Presence)
// 💡 يحدّث last_seen_at كل 60 ثانية
// 💡 يوفر عدادات المتصلين الحقيقية للـ Dashboard
// 💡 يستخدم Supabase Realtime لتحديث لحظي
// ============================================

(function () {
  'use strict';

  // ============ حماية من التهيئة المكررة ============
  if (window.SessionManager && window.SessionManager.initialized) return;

  var cfg = window.ITWS_CONFIG;
  var HEARTBEAT_INTERVAL = (cfg && cfg.HEARTBEAT_INTERVAL) || 60000;
  var ONLINE_THRESHOLD = (cfg && cfg.ONLINE_THRESHOLD) || 120000;

  // ============ حالة داخلية ============
  var state = {
    heartbeatTimer: null,
    channel: null,
    visitorId: null,
    userId: null,
    lastHeartbeatAt: null,
    isOnline: false
  };

  // ============ 1. توليد/جلب visitor ID ============
  function getVisitorId() {
    if (state.visitorId) return state.visitorId;
    if (window.Utils && window.Utils.getVisitorId) {
      state.visitorId = window.Utils.getVisitorId();
    } else {
      // Fallback لو Utils مش محمل
      var key = 'itws_visitor_id';
      try {
        var id = localStorage.getItem(key);
        if (!id) {
          id = 'v_' + Math.random().toString(36).substring(2, 20);
          localStorage.setItem(key, id);
        }
        state.visitorId = id;
      } catch (e) {
        state.visitorId = 'v_' + Math.random().toString(36).substring(2, 20);
      }
    }
    return state.visitorId;
  }

  // ============ 2. جلب المستخدم الحالي ============
  function getCurrentUser() {
    if (!window.sb) return Promise.resolve(null);
    return window.sb.auth.getUser()
      .then(function (res) {
        return res && res.data ? res.data.user : null;
      })
      .catch(function () { return null; });
  }

  // ============ 3. إرسال heartbeat واحد ============
  function sendHeartbeat() {
    if (!window.sb) return Promise.resolve(false);
    if (document.visibilityState === 'hidden') {
      // متبعتش heartbeat لو التبويب مخفي
      return Promise.resolve(false);
    }

    var visitorId = getVisitorId();
    var now = new Date().toISOString();

    return getCurrentUser().then(function (user) {
      state.userId = user ? user.id : null;

      var payload = {
        visitor_id: visitorId,
        user_id: user ? user.id : null,
        user_role: user ? 'authenticated' : 'visitor',
        user_agent: navigator.userAgent.substring(0, 200),
        last_seen_at: now
      };

      return window.sb
        .from('sessions')
        .upsert(payload, { onConflict: 'visitor_id' })
        .then(function (res) {
          if (res.error) {
            logDebug('Heartbeat failed:', res.error.message);
            return false;
          }
          state.lastHeartbeatAt = now;
          state.isOnline = true;
          logDebug('Heartbeat sent', now);
          return true;
        });
    }).catch(function (err) {
      logDebug('Heartbeat error:', err.message);
      return false;
    });
  }

  // ============ 4. بدء الـ heartbeat ============
  function start() {
    if (state.heartbeatTimer) return;

    // 1. إرسال فوري
    sendHeartbeat();

    // 2. إرسال دوري
    state.heartbeatTimer = setInterval(sendHeartbeat, HEARTBEAT_INTERVAL);

    // 3. إرسال عند عودة التبويب للظهور
    document.addEventListener('visibilitychange', onVisibilityChange);

    // 4. إرسال عند عودة الإنترنت
    window.addEventListener('online', onOnline);

    // 5. إرسال أخير عند إغلاق الصفحة (best effort)
    window.addEventListener('beforeunload', markOffline);

    logDebug('Session started', {
      interval: HEARTBEAT_INTERVAL,
      threshold: ONLINE_THRESHOLD
    });
  }

  // ============ 5. إيقاف الـ heartbeat ============
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

  // ============ 6. markOffline ============
  // ⚠️ beforeunload مش مضمون في كل المتصفحات
  // عشان كده هنستخدم last_seen_at قديم بدل ما نمسح الصف
  function markOffline() {
    // بنخلي last_seen_at قيمة قديمة جداً عشان يبقى offline فوراً
    if (!window.sb || !state.visitorId) return;

    var oldTime = new Date(Date.now() - 3600000).toISOString(); // ساعة فاتت

    // sendBeacon أسرع وأضمن من fetch وقت إغلاق الصفحة
    try {
      var url = cfg.SUPABASE_URL + '/rest/v1/sessions?visitor_id=eq.' + encodeURIComponent(state.visitorId);
      var body = JSON.stringify({ last_seen_at: oldTime });
      var headers = {
        'apikey': cfg.SUPABASE_ANON_KEY,
        'Authorization': 'Bearer ' + cfg.SUPABASE_ANON_KEY,
        'Content-Type': 'application/json',
        'Prefer': 'return=minimal'
      };

      if (navigator.sendBeacon) {
        // sendBeacon مايقدرش يبعت headers مخصصة — نستخدم fetch keepalive
        fetch(url, {
          method: 'PATCH',
          headers: headers,
          body: body,
          keepalive: true
        }).catch(function () {});
      } else {
        fetch(url, {
          method: 'PATCH',
          headers: headers,
          body: body,
          keepalive: true
        }).catch(function () {});
      }
    } catch (e) {
      // تجاهل — best effort
    }
  }

  // ============ 7. معالجة visibilitychange ============
  function onVisibilityChange() {
    if (document.visibilityState === 'visible') {
      sendHeartbeat();
    }
  }

  // ============ 8. معالجة online ============
  function onOnline() {
    sendHeartbeat();
  }

  // ============ 9. عدّ المتصلين ============
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

  // ============ 10. جلب قائمة المتصلين ============
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

  // ============ 11. جلب المتصلين المسجلين فقط ============
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

  // ============ 12. الاستماع لتغيرات sessions (realtime) ============
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

  // ============ 13. إلغاء الاشتراك ============
  function unsubscribe() {
    if (state.channel) {
      state.channel.unsubscribe();
      state.channel = null;
    }
  }

  // ============ 14. معلومات الحالة ============
  function getStatus() {
    return {
      isOnline: state.isOnline,
      visitorId: state.visitorId,
      userId: state.userId,
      lastHeartbeatAt: state.lastHeartbeatAt
    };
  }

  // ============ 15. مساعدات ============
  function logDebug() {
    if (cfg && cfg.DEBUG) {
      console.log.apply(console, ['[SessionManager]'].concat(Array.prototype.slice.call(arguments)));
    }
  }

  // ============ 16. الواجهة العامة ============
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

  // ============ 17. التشغيل التلقائي ============
  function autoStart() {
    // نتأكد إن Supabase محمّل
    if (!window.sb) {
      logDebug('Waiting for Supabase client...');
      // نحاول تاني بعد ثانية
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
