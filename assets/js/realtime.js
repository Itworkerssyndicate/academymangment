/* ============================================================
   ITWS Platform — Realtime Manager V2
   File: assets/js/realtime.js
   Description: Unified realtime subscription manager

   Load order: AFTER supabase-client.js + app-settings.js

   Features:
   - Centralized subscribe/unsubscribe for all tables
   - Multiple subscribers per table (multiplexing)
   - Debounce batching (300ms default)
   - Auto-reconnect on disconnect (exponential backoff)
   - Fallback polling when WS unavailable
   - Status tracking (connected / connecting / disconnected)
   - Per-subscription filters
   - Handles INSERT / UPDATE / DELETE events
   - Cleanup on page unload
   - Events: itws:realtime-status, itws:realtime-event

   Rules:
   - No emoji
   - ES5-style IIFE
   - window.sb only
   - Never causes infinite loops (debounced)
   ============================================================ */

(function () {
  'use strict';

  if (window.Realtime && window.Realtime._initialized) {
    return;
  }

  /* ============================================================
     1. HELPERS
     ============================================================ */

  function log(level, msg, data) {
    var cfg = window.ITWS_CONFIG || {};
    if (level === 'error' || (cfg.DEBUG && level === 'debug')) {
      try {
        var args = ['[Realtime]', msg];
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

  function dispatchEvent(name, detail) {
    try {
      window.dispatchEvent(new CustomEvent(name, { detail: detail || {} }));
    } catch (e) {}
  }

  function generateId() {
    return 'rt_' + Date.now() + '_' + Math.random().toString(36).substring(2, 9);
  }

  function now() {
    return Date.now();
  }

  /* ============================================================
     2. CONFIG
     ============================================================ */

  var CONFIG = {
    defaultDebounceMs: 300,
    defaultFallbackPollingMs: 30000,
    maxReconnectAttempts: 5,
    reconnectBaseDelayMs: 1000,
    reconnectMaxDelayMs: 30000,
    channelPrefix: 'itws_rt_'
  };

  /* ============================================================
     3. STATE
     ============================================================ */

  var state = {
    status: 'idle',                    // idle | connecting | connected | disconnected
    channels: {},                       // { channelName: channelObject }
    subscriptions: {},                  // { subscriptionId: subData }
    subscriptionsByTable: {},           // { tableName: [subscriptionId, ...] }
    pendingEvents: {},                  // { subscriptionId: [events] }
    debounceTimers: {},                 // { subscriptionId: timerId }
    pollingTimers: {},                  // { subscriptionId: timerId }
    reconnectAttempts: 0,
    reconnectTimer: null,
    initialized: false,
    lastConnectTime: 0,
    lastError: null
  };

  /* ============================================================
     4. CORE — SUBSCRIBE
     ============================================================ */

  /**
   * Subscribe to table changes
   * @param {string} table - Table name (e.g., 'certificates')
   * @param {function} callback - Called with { eventType, new, old, table }
   * @param {object} options - { filter, events, debounce, fallbackPolling, immediate }
   * @returns {function} unsubscribe function
   */
  function subscribe(table, callback, options) {
    if (!table || typeof callback !== 'function') {
      log('error', 'subscribe: table and callback are required');
      return function () {};
    }

    options = options || {};

    var sb = getSb();
    if (!sb) {
      log('error', 'subscribe: Supabase client not available');
      // Still return a no-op unsubscribe
      return function () {};
    }

    var subscriptionId = generateId();

    var sub = {
      id: subscriptionId,
      table: table,
      callback: callback,
      filter: options.filter || null,
      events: normalizeEvents(options.events),
      debounceMs: (typeof options.debounce === 'number') ? options.debounce : CONFIG.defaultDebounceMs,
      fallbackPollingMs: (typeof options.fallbackPolling === 'number')
        ? options.fallbackPolling
        : CONFIG.defaultFallbackPollingMs,
      createdAt: now(),
      eventCount: 0,
      lastEventAt: 0,
      errorCount: 0
    };

    state.subscriptions[subscriptionId] = sub;

    // Index by table
    if (!state.subscriptionsByTable[table]) {
      state.subscriptionsByTable[table] = [];
    }
    state.subscriptionsByTable[table].push(subscriptionId);

    // Create or reuse channel for this table + filter combo
    var channelKey = buildChannelKey(table, sub.filter);
    var channel = state.channels[channelKey];

    if (!channel) {
      channel = createChannel(table, sub.filter, channelKey);
      if (!channel) {
        delete state.subscriptions[subscriptionId];
        removeFromTableIndex(table, subscriptionId);
        return function () {};
      }
      state.channels[channelKey] = channel;
    }

    log('debug', 'Subscribed', {
      id: subscriptionId,
      table: table,
      filter: sub.filter,
      totalSubsForTable: state.subscriptionsByTable[table].length
    });

    // Return unsubscribe
    return function unsubscribe() {
      unsubscribeById(subscriptionId);
    };
  }

  function normalizeEvents(events) {
    if (!events) return ['INSERT', 'UPDATE', 'DELETE'];
    if (typeof events === 'string') return [events];
    if (Array.isArray(events)) return events;
    return ['INSERT', 'UPDATE', 'DELETE'];
  }

  function buildChannelKey(table, filter) {
    return CONFIG.channelPrefix + table + (filter ? '_' + filter.replace(/[^a-z0-9_]/gi, '_') : '');
  }

  /* ============================================================
     5. CORE — CREATE CHANNEL
     ============================================================ */

  function createChannel(table, filter, channelKey) {
    var sb = getSb();
    if (!sb) return null;

    try {
      var channelConfig = {
        event: '*',
        schema: 'public',
        table: table
      };

      if (filter) {
        channelConfig.filter = filter;
      }

      var channel = sb.channel(channelKey)
        .on('postgres_changes', channelConfig, function (payload) {
          handlePayload(table, filter, payload);
        })
        .subscribe(function (status, err) {
          handleChannelStatus(channelKey, status, err);
        });

      return channel;
    } catch (e) {
      log('error', 'Failed to create channel', e);
      return null;
    }
  }

  /* ============================================================
     6. CORE — HANDLE PAYLOAD
     ============================================================ */

  function handlePayload(table, filter, payload) {
    if (!payload) return;

    var subscriptionIds = state.subscriptionsByTable[table] || [];
    var eventType = payload.eventType || 'UNKNOWN';

    subscriptionIds.forEach(function (subId) {
      var sub = state.subscriptions[subId];
      if (!sub) return;

      // Filter check (filter match happens server-side, but double-check)
      if (sub.filter && filter !== sub.filter) return;

      // Event type check
      if (sub.events.indexOf(eventType) === -1) return;

      // Queue event for this subscriber
      queueEvent(subId, {
        eventType: eventType,
        new: payload.new || null,
        old: payload.old || null,
        table: table,
        timestamp: now()
      });
    });
  }

  /* ============================================================
     7. CORE — DEBOUNCE BATCHING
     ============================================================ */

  function queueEvent(subscriptionId, event) {
    if (!state.pendingEvents[subscriptionId]) {
      state.pendingEvents[subscriptionId] = [];
    }
    state.pendingEvents[subscriptionId].push(event);

    // Reset debounce timer
    if (state.debounceTimers[subscriptionId]) {
      clearTimeout(state.debounceTimers[subscriptionId]);
    }

    var sub = state.subscriptions[subscriptionId];
    if (!sub) return;

    state.debounceTimers[subscriptionId] = setTimeout(function () {
      flushEvents(subscriptionId);
    }, sub.debounceMs);
  }

  function flushEvents(subscriptionId) {
    var events = state.pendingEvents[subscriptionId];
    if (!events || events.length === 0) return;

    delete state.pendingEvents[subscriptionId];
    delete state.debounceTimers[subscriptionId];

    var sub = state.subscriptions[subscriptionId];
    if (!sub) return;

    sub.eventCount += events.length;
    sub.lastEventAt = now();

    // If multiple events — batch
    if (events.length === 1) {
      safeCall(sub.callback, events[0]);
    } else {
      // Batch callback (array of events)
      safeCall(sub.callback, {
        batched: true,
        events: events,
        table: sub.table,
        count: events.length
      });
    }

    dispatchEvent('itws:realtime-event', {
      subscriptionId: subscriptionId,
      table: sub.table,
      count: events.length
    });
  }

  function safeCall(callback, payload) {
    try {
      callback(payload);
    } catch (e) {
      log('error', 'Callback error', e);
    }
  }

  /* ============================================================
     8. CORE — UNSUBSCRIBE
     ============================================================ */

  function unsubscribeById(subscriptionId) {
    var sub = state.subscriptions[subscriptionId];
    if (!sub) return false;

    var table = sub.table;

    // Clear pending
    if (state.debounceTimers[subscriptionId]) {
      clearTimeout(state.debounceTimers[subscriptionId]);
      delete state.debounceTimers[subscriptionId];
    }
    delete state.pendingEvents[subscriptionId];

    // Clear polling
    if (state.pollingTimers[subscriptionId]) {
      clearInterval(state.pollingTimers[subscriptionId]);
      delete state.pollingTimers[subscriptionId];
    }

    // Remove from state
    delete state.subscriptions[subscriptionId];
    removeFromTableIndex(table, subscriptionId);

    // Remove channel if no more subscribers for this table+filter combo
    var channelKey = buildChannelKey(table, sub.filter);
    var stillHasSubs = (state.subscriptionsByTable[table] || []).some(function (id) {
      var other = state.subscriptions[id];
      return other && other.filter === sub.filter;
    });

    if (!stillHasSubs && state.channels[channelKey]) {
      removeChannel(channelKey);
    }

    log('debug', 'Unsubscribed', {
      id: subscriptionId,
      table: table,
      remainingForTable: (state.subscriptionsByTable[table] || []).length
    });

    return true;
  }

  function removeFromTableIndex(table, subscriptionId) {
    if (!state.subscriptionsByTable[table]) return;
    var idx = state.subscriptionsByTable[table].indexOf(subscriptionId);
    if (idx !== -1) {
      state.subscriptionsByTable[table].splice(idx, 1);
    }
    if (state.subscriptionsByTable[table].length === 0) {
      delete state.subscriptionsByTable[table];
    }
  }

  function removeChannel(channelKey) {
    var sb = getSb();
    var channel = state.channels[channelKey];
    if (!channel) return;

    try {
      if (sb) sb.removeChannel(channel);
    } catch (e) {
      log('error', 'Failed to remove channel', e);
    }

    delete state.channels[channelKey];
    log('debug', 'Channel removed', channelKey);
  }

  /* ============================================================
     9. CORE — STATUS
     ============================================================ */

  function handleChannelStatus(channelKey, status, err) {
    if (err) {
      state.lastError = err.message || String(err);
      log('error', 'Channel status error: ' + channelKey, state.lastError);
    }

    log('debug', 'Channel status', { channel: channelKey, status: status });

    if (status === 'SUBSCRIBED') {
      state.status = 'connected';
      state.reconnectAttempts = 0;
      state.lastConnectTime = now();
      stopAllPolling();
      dispatchEvent('itws:realtime-status', {
        status: 'connected',
        channel: channelKey
      });
    } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
      state.status = 'disconnected';
      startAllPolling();
      scheduleReconnect();
      dispatchEvent('itws:realtime-status', {
        status: 'disconnected',
        channel: channelKey,
        error: state.lastError
      });
    } else if (status === 'CLOSED') {
      state.status = 'disconnected';
      dispatchEvent('itws:realtime-status', {
        status: 'closed',
        channel: channelKey
      });
    } else if (status === 'CONNECTING') {
      state.status = 'connecting';
      dispatchEvent('itws:realtime-status', {
        status: 'connecting',
        channel: channelKey
      });
    }
  }

  /* ============================================================
     10. RECONNECT
     ============================================================ */

  function scheduleReconnect() {
    if (state.reconnectTimer) return;
    if (state.reconnectAttempts >= CONFIG.maxReconnectAttempts) {
      log('error', 'Max reconnect attempts reached');
      return;
    }

    state.reconnectAttempts++;
    var delay = Math.min(
      CONFIG.reconnectBaseDelayMs * Math.pow(2, state.reconnectAttempts - 1),
      CONFIG.reconnectMaxDelayMs
    );

    log('debug', 'Scheduling reconnect in ' + delay + 'ms (attempt ' + state.reconnectAttempts + ')');

    state.reconnectTimer = setTimeout(function () {
      state.reconnectTimer = null;
      reconnectAll();
    }, delay);
  }

  function reconnectAll() {
    log('debug', 'Reconnecting all channels');

    var tables = Object.keys(state.subscriptionsByTable);
    if (tables.length === 0) return;

    // Remove all old channels
    Object.keys(state.channels).forEach(function (key) {
      removeChannel(key);
    });

    // Recreate channels from existing subscriptions
    var seenKeys = {};
    tables.forEach(function (table) {
      var subIds = state.subscriptionsByTable[table] || [];
      subIds.forEach(function (subId) {
        var sub = state.subscriptions[subId];
        if (!sub) return;

        var channelKey = buildChannelKey(table, sub.filter);
        if (seenKeys[channelKey]) return;
        seenKeys[channelKey] = true;

        var channel = createChannel(table, sub.filter, channelKey);
        if (channel) {
          state.channels[channelKey] = channel;
        }
      });
    });
  }

  /* ============================================================
     11. FALLBACK POLLING
     ============================================================ */

  function startAllPolling() {
    var subIds = Object.keys(state.subscriptions);
    subIds.forEach(function (subId) {
      startPollingForSub(subId);
    });
  }

  function startPollingForSub(subscriptionId) {
    if (state.pollingTimers[subscriptionId]) return;

    var sub = state.subscriptions[subscriptionId];
    if (!sub || !sub.fallbackPollingMs) return;

    var lastPolledAt = now();

    state.pollingTimers[subscriptionId] = setInterval(function () {
      pollTable(subscriptionId, lastPolledAt);
      lastPolledAt = now();
    }, sub.fallbackPollingMs);

    log('debug', 'Polling started', { id: subscriptionId, table: sub.table });
  }

  function pollTable(subscriptionId, sinceTimestamp) {
    var sub = state.subscriptions[subscriptionId];
    if (!sub) return;

    var sb = getSb();
    if (!sb) return;

    // Read rows updated since last poll
    var query = sb.from(sub.table).select('*');

    // Apply filter if it's a simple eq filter
    if (sub.filter) {
      var match = sub.filter.match(/^(\w+)=eq\.(.+)$/);
      if (match) {
        query = query.eq(match[1], match[2]);
      }
    }

    // Fetch recent changes
    query
      .gte('updated_at', new Date(sinceTimestamp).toISOString())
      .then(function (res) {
        if (res.error) {
          log('error', 'Poll failed', res.error.message);
          return;
        }

        var rows = res.data || [];
        if (rows.length === 0) return;

        log('debug', 'Poll returned rows', { table: sub.table, count: rows.length });

        // Dispatch as UPDATE events (best-effort)
        rows.forEach(function (row) {
          queueEvent(subscriptionId, {
            eventType: 'UPDATE',
            new: row,
            old: null,
            table: sub.table,
            timestamp: now(),
            source: 'polling'
          });
        });
      })
      .catch(function (err) {
        log('error', 'Poll catch', err);
      });
  }

  function stopAllPolling() {
    Object.keys(state.pollingTimers).forEach(function (subId) {
      clearInterval(state.pollingTimers[subId]);
      delete state.pollingTimers[subId];
    });
  }

  function stopPollingForSub(subscriptionId) {
    if (state.pollingTimers[subscriptionId]) {
      clearInterval(state.pollingTimers[subscriptionId]);
      delete state.pollingTimers[subscriptionId];
    }
  }

  /* ============================================================
     12. PUBLIC API
     ============================================================ */

  function stopAll() {
    Object.keys(state.subscriptions).forEach(function (subId) {
      unsubscribeById(subId);
    });

    Object.keys(state.channels).forEach(function (key) {
      removeChannel(key);
    });

    stopAllPolling();

    if (state.reconnectTimer) {
      clearTimeout(state.reconnectTimer);
      state.reconnectTimer = null;
    }

    state.status = 'idle';
    state.reconnectAttempts = 0;

    log('debug', 'Stopped all subscriptions');
  }

  function reconnect() {
    stopAllPolling();
    state.reconnectAttempts = 0;
    reconnectAll();
  }

  function getStatus() {
    return {
      status: state.status,
      channels: Object.keys(state.channels).length,
      subscriptions: Object.keys(state.subscriptions).length,
      tables: Object.keys(state.subscriptionsByTable),
      reconnectAttempts: state.reconnectAttempts,
      lastConnectTime: state.lastConnectTime,
      lastError: state.lastError
    };
  }

  function getSubscriptions() {
    return Object.keys(state.subscriptions).map(function (id) {
      var s = state.subscriptions[id];
      return {
        id: s.id,
        table: s.table,
        filter: s.filter,
        events: s.events.slice(),
        debounceMs: s.debounceMs,
        eventCount: s.eventCount,
        lastEventAt: s.lastEventAt,
        createdAt: s.createdAt
      };
    });
  }

  function listTables() {
    return Object.keys(state.subscriptionsByTable);
  }

  /* ============================================================
     13. CONVENIENCE METHODS
     ============================================================ */

  // Subscribe with object syntax
  function subscribeTable(config) {
    if (!config || typeof config !== 'object') return function () {};
    return subscribe(config.table, config.callback, {
      filter: config.filter,
      events: config.events,
      debounce: config.debounce,
      fallbackPolling: config.fallbackPolling
    });
  }

  // Batch subscribe to multiple tables
  function subscribeMany(configs) {
    if (!Array.isArray(configs)) return [];
    return configs.map(subscribeTable);
  }

  /* ============================================================
     14. EXPORT
     ============================================================ */

  window.Realtime = {
    _initialized: true,

    // Core
    subscribe: subscribe,
    subscribeTable: subscribeTable,
    subscribeMany: subscribeMany,
    unsubscribe: unsubscribeById,

    // Control
    stopAll: stopAll,
    reconnect: reconnect,

    // Status
    status: function () { return state.status; },
    getStatus: getStatus,
    getSubscriptions: getSubscriptions,
    listTables: listTables,

    // Constants
    CONFIG: CONFIG
  };

  /* ============================================================
     15. AUTO-CLEANUP
     ============================================================ */

  if (typeof window.addEventListener === 'function') {
    window.addEventListener('beforeunload', function () {
      try { stopAll(); } catch (e) {}
    });
  }

  /* ============================================================
     16. LOG
     ============================================================ */

  if (getConfig().DEBUG) {
    try {
      console.log('%c[Realtime]', 'color: #F59E0B; font-weight: bold;', 'Manager ready');
    } catch (e) {}
  }

})();
