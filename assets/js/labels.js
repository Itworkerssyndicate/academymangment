/* ============================================================
   ITWS Platform — Labels Manager V2
   File: assets/js/labels.js
   Description: Load, cache, realtime-sync all UI texts from Supabase

   Load order: FIFTH (after app-settings.js)

   Features:
   - Loads all labels from `labels` table
   - Caches in localStorage with instant render
   - Realtime subscription for live updates
   - Labels.t(key, fallback) API
   - Auto-applies to [data-label], [data-label-placeholder],
     [data-label-title], [data-label-aria]
   - Category filtering
   - onChange callbacks
   - Supports HTML injection only for explicitly marked labels
   - RTL Arabic by default

   Rules:
   - No emoji
   - ES5-style IIFE
   - window.sb only
   - No hardcoded UI text
   ============================================================ */

(function () {
  'use strict';

  if (window.Labels && window.Labels._initialized) {
    return;
  }

  /* ============================================================
     1. HELPERS — Dependencies
     ============================================================ */

  function log(level, msg, data) {
    var cfg = window.ITWS_CONFIG || {};
    if (level === 'error' || (cfg.DEBUG && level === 'debug')) {
      try {
        var args = ['[Labels]', msg];
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

  function getCacheKey() {
    var cfg = getConfig();
    if (cfg.STORAGE_KEYS && cfg.STORAGE_KEYS.LABELS_CACHE) {
      return cfg.STORAGE_KEYS.LABELS_CACHE;
    }
    return 'itws_labels_cache';
  }

  function getDefaultLang() {
    var cfg = getConfig();
    return (cfg.DEFAULT_LANG === 'en') ? 'en' : 'ar';
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

  function safeStorageGet(key) {
    try { return localStorage.getItem(key); } catch (e) { return null; }
  }

  function safeStorageSet(key, value) {
    try { localStorage.setItem(key, value); return true; }
    catch (e) { log('error', 'localStorage set failed', e); return false; }
  }

  function safeStorageRemove(key) {
    try { localStorage.removeItem(key); return true; } catch (e) { return false; }
  }

  function dispatchEvent(name, detail) {
    try {
      window.dispatchEvent(new CustomEvent(name, { detail: detail || {} }));
    } catch (e) {
      log('error', 'dispatchEvent failed', e);
    }
  }

  /* ============================================================
     2. STATE
     ============================================================ */

  var state = {
    loaded: false,
    loading: false,
    error: null,
    labels: {},          // { key: { ar_value, en_value, category, default_ar, is_multiline } }
    lastFetch: 0,
    listeners: [],
    realtimeChannel: null,
    readyPromise: null,
    readyResolve: null,
    lang: getDefaultLang()
  };

  state.readyPromise = new Promise(function (resolve) {
    state.readyResolve = resolve;
  });

  /* ============================================================
     3. CACHE
     ============================================================ */

  function loadFromCache() {
    var raw = safeStorageGet(getCacheKey());
    if (!raw) return false;

    try {
      var parsed = JSON.parse(raw);
      if (!parsed || typeof parsed !== 'object') return false;

      var data = parsed.data || parsed;
      var ts = parsed.timestamp || 0;

      if (!data || typeof data !== 'object' || Array.isArray(data)) return false;

      state.labels = data;
      state.lastFetch = ts;
      state.loaded = true;

      log('debug', 'Loaded from cache', Object.keys(data).length);
      return true;
    } catch (e) {
      log('error', 'Cache parse failed', e);
      return false;
    }
  }

  function saveToCache() {
    var payload = {
      data: state.labels,
      timestamp: Date.now()
    };
    safeStorageSet(getCacheKey(), JSON.stringify(payload));
  }

  function clearCache() {
    safeStorageRemove(getCacheKey());
    state.lastFetch = 0;
    log('debug', 'Cache cleared');
  }

  /* ============================================================
     4. FETCH
     ============================================================ */

  function fetchFromDb(retryCount) {
    retryCount = retryCount || 0;
    var sb = getSb();

    if (!sb) {
      return Promise.reject(new Error('Supabase client not available'));
    }

    state.loading = true;

    return sb
      .from('labels')
      .select('key, ar_value, en_value, category, default_ar, is_multiline, max_length')
      .then(function (res) {
        if (res.error) throw new Error(res.error.message);

        var map = {};
        (res.data || []).forEach(function (row) {
          if (row && row.key) {
            map[row.key] = {
              ar_value: row.ar_value || row.default_ar || '',
              en_value: row.en_value || row.ar_value || row.default_ar || '',
              category: row.category || 'common',
              default_ar: row.default_ar || row.ar_value || '',
              is_multiline: row.is_multiline === true,
              max_length: row.max_length || null
            };
          }
        });

        return map;
      })
      .catch(function (err) {
        var msg = (err && err.message ? err.message : '').toLowerCase();
        var isNetworkError = (
          msg.indexOf('fetch') !== -1 ||
          msg.indexOf('network') !== -1 ||
          msg.indexOf('timeout') !== -1
        );

        if (isNetworkError && retryCount < 2) {
          log('debug', 'Fetch retry ' + (retryCount + 1));
          return new Promise(function (resolve) {
            setTimeout(resolve, 1000 * Math.pow(2, retryCount));
          }).then(function () {
            return fetchFromDb(retryCount + 1);
          });
        }

        throw err;
      });
  }

  /* ============================================================
     5. CHANGE NOTIFICATION
     ============================================================ */

  function notifyListeners(changedKey) {
    var snapshot = state.labels;
    var listeners = state.listeners.slice();

    listeners.forEach(function (fn) {
      try { fn(snapshot, changedKey); }
      catch (e) { log('error', 'Listener error', e); }
    });

    dispatchEvent('itws:labels-changed', {
      key: changedKey,
      labels: snapshot
    });
  }

  /* ============================================================
     6. REALTIME
     ============================================================ */

  function subscribeRealtime() {
    var sb = getSb();
    if (!sb) return;

    try {
      if (state.realtimeChannel) {
        try { sb.removeChannel(state.realtimeChannel); } catch (e) {}
        state.realtimeChannel = null;
      }

      state.realtimeChannel = sb
        .channel('itws_labels_changes')
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'labels' },
          function (payload) {
            var row = payload.new || payload.old;
            if (!row || !row.key) return;

            var key = row.key;

            if (payload.eventType === 'DELETE') {
              delete state.labels[key];
            } else {
              state.labels[key] = {
                ar_value: row.ar_value || row.default_ar || '',
                en_value: row.en_value || row.ar_value || row.default_ar || '',
                category: row.category || 'common',
                default_ar: row.default_ar || row.ar_value || '',
                is_multiline: row.is_multiline === true,
                max_length: row.max_length || null
              };
            }

            saveToCache();
            applyKey(key);
            notifyListeners(key);
            log('debug', 'Realtime', { key: key, event: payload.eventType });
          }
        )
        .subscribe(function (status) {
          log('debug', 'Realtime status', status);
        });

    } catch (e) {
      log('error', 'Realtime subscription failed', e);
    }
  }

  function unsubscribeRealtime() {
    var sb = getSb();
    if (!sb || !state.realtimeChannel) return;
    try { sb.removeChannel(state.realtimeChannel); } catch (e) {}
    state.realtimeChannel = null;
  }

  /* ============================================================
     7. APPLY TO DOM
     ============================================================ */

  // Apply a single key to all matching elements
  function applyKey(key) {
    if (!key) return;
    var value = resolveValue(key);
    if (value === null) return;

    // [data-label="key"]
    var els = document.querySelectorAll('[data-label="' + cssEscape(key) + '"]');
    for (var i = 0; i < els.length; i++) {
      setElementText(els[i], value);
    }

    // [data-label-placeholder="key"]
    var phEls = document.querySelectorAll('[data-label-placeholder="' + cssEscape(key) + '"]');
    for (var j = 0; j < phEls.length; j++) {
      phEls[j].setAttribute('placeholder', value);
    }

    // [data-label-title="key"]
    var titleEls = document.querySelectorAll('[data-label-title="' + cssEscape(key) + '"]');
    for (var k = 0; k < titleEls.length; k++) {
      titleEls[k].setAttribute('title', value);
    }

    // [data-label-aria="key"]
    var ariaEls = document.querySelectorAll('[data-label-aria="' + cssEscape(key) + '"]');
    for (var m = 0; m < ariaEls.length; m++) {
      ariaEls[m].setAttribute('aria-label', value);
    }
  }

  // Apply all labels to a root element (default: document)
  function apply(root) {
    root = root || document;

    var els = root.querySelectorAll('[data-label]');
    for (var i = 0; i < els.length; i++) {
      var key = els[i].getAttribute('data-label');
      if (!key) continue;
      var value = resolveValue(key);
      if (value !== null) setElementText(els[i], value);
    }

    var phEls = root.querySelectorAll('[data-label-placeholder]');
    for (var j = 0; j < phEls.length; j++) {
      var phKey = phEls[j].getAttribute('data-label-placeholder');
      if (!phKey) continue;
      var phVal = resolveValue(phKey);
      if (phVal !== null) phEls[j].setAttribute('placeholder', phVal);
    }

    var titleEls = root.querySelectorAll('[data-label-title]');
    for (var k = 0; k < titleEls.length; k++) {
      var tKey = titleEls[k].getAttribute('data-label-title');
      if (!tKey) continue;
      var tVal = resolveValue(tKey);
      if (tVal !== null) titleEls[k].setAttribute('title', tVal);
    }

    var ariaEls = root.querySelectorAll('[data-label-aria]');
    for (var m = 0; m < ariaEls.length; m++) {
      var aKey = ariaEls[m].getAttribute('data-label-aria');
      if (!aKey) continue;
      var aVal = resolveValue(aKey);
      if (aVal !== null) ariaEls[m].setAttribute('aria-label', aVal);
    }
  }

  function setElementText(el, value) {
    // Preserve child elements marked as keep
    if (el.getAttribute('data-label-html') === 'true') {
      el.innerHTML = value;
    } else {
      el.textContent = value;
    }
  }

  function resolveValue(key) {
    var entry = state.labels[key];
    if (!entry) return null;
    var lang = state.lang;
    if (lang === 'en' && entry.en_value) return entry.en_value;
    return entry.ar_value || entry.default_ar || null;
  }

  // CSS.escape polyfill for older browsers
  function cssEscape(str) {
    if (window.CSS && typeof window.CSS.escape === 'function') {
      return window.CSS.escape(str);
    }
    return String(str).replace(/(["\\])/g, '\\$1');
  }

  /* ============================================================
     8. PUBLIC API
     ============================================================ */

  var Labels = {
    _initialized: true,

    // translate a single key
    t: function (key, fallback) {
      if (!key) return fallback || '';

      var entry = state.labels[key];
      if (!entry) {
        return fallback !== undefined ? fallback : key;
      }

      var lang = state.lang;
      var val;

      if (lang === 'en' && entry.en_value) {
        val = entry.en_value;
      } else {
        val = entry.ar_value || entry.default_ar;
      }

      if (val === undefined || val === null || val === '') {
        return fallback !== undefined ? fallback : key;
      }

      return val;
    },

    // translate with HTML (only for labels marked safe)
    tHtml: function (key, fallback) {
      var val = Labels.t(key, fallback);
      // Escape everything, then allow <br> for multiline
      var escaped = escapeHtml(val);
      return escaped.replace(/&lt;br\s*\/?&gt;/gi, '<br>');
    },

    // check if a label exists
    has: function (key) {
      return !!state.labels[key];
    },

    // get full entry
    get: function (key) {
      var entry = state.labels[key];
      if (!entry) return null;
      return {
        key: key,
        ar_value: entry.ar_value,
        en_value: entry.en_value,
        category: entry.category,
        default_ar: entry.default_ar,
        is_multiline: entry.is_multiline,
        max_length: entry.max_length
      };
    },

    // get all keys in a category
    getCategory: function (category) {
      if (!category) return {};
      var result = {};
      Object.keys(state.labels).forEach(function (k) {
        if (state.labels[k].category === category) {
          result[k] = state.labels[k];
        }
      });
      return result;
    },

    // list all categories
    getCategories: function () {
      var set = {};
      Object.keys(state.labels).forEach(function (k) {
        var c = state.labels[k].category || 'common';
        set[c] = (set[c] || 0) + 1;
      });
      return set;
    },

    // apply to DOM
    apply: apply,
    applyKey: applyKey,

    // save (super_admin only)
    set: function (key, value, lang) {
      var sb = getSb();
      if (!sb) return Promise.reject(new Error('Supabase client not available'));
      if (!key) return Promise.reject(new Error('key is required'));

      if (window.Permissions && typeof window.Permissions.can === 'function') {
        if (!window.Permissions.can('labels', 'update')) {
          return Promise.reject(new Error('Not authorized'));
        }
      }

      lang = lang || 'ar';

      var update = { key: key };
      if (lang === 'en') update.en_value = value;
      else update.ar_value = value;
      update.updated_at = new Date().toISOString();

      return sb.auth.getUser()
        .then(function (res) {
          if (res && res.data && res.data.user) {
            update.updated_by = res.data.user.id;
          }
          return sb.from('labels').update(update).eq('key', key);
        })
        .then(function (res) {
          if (res.error) throw new Error(res.error.message);

          if (!state.labels[key]) state.labels[key] = {};
          if (lang === 'en') state.labels[key].en_value = value;
          else state.labels[key].ar_value = value;

          saveToCache();
          applyKey(key);
          notifyListeners(key);
          return true;
        });
    },

    // reset a label to default
    reset: function (key) {
      var entry = state.labels[key];
      if (!entry) return Promise.reject(new Error('Label not found'));
      return Labels.set(key, entry.default_ar, 'ar');
    },

    // change language
    setLanguage: function (lang) {
      state.lang = (lang === 'en') ? 'en' : 'ar';
      apply(document);
      notifyListeners(null);
      try { document.documentElement.setAttribute('lang', state.lang); } catch (e) {}
      try { document.documentElement.setAttribute('dir', state.lang === 'ar' ? 'rtl' : 'ltr'); } catch (e) {}
      return true;
    },

    getLanguage: function () { return state.lang; },

    // reload
    refresh: function () {
      clearCache();
      state.loaded = false;
      state.lastFetch = 0;
      return load();
    },

    // change subscription
    onChange: function (callback) {
      if (typeof callback !== 'function') return function () {};
      state.listeners.push(callback);
      return function unsubscribe() {
        var idx = state.listeners.indexOf(callback);
        if (idx !== -1) state.listeners.splice(idx, 1);
      };
    },

    clearCache: function () {
      clearCache();
      return true;
    },

    isLoaded: function () { return state.loaded; },
    isLoading: function () { return state.loading; },
    getError: function () { return state.error; },
    getLastFetch: function () { return state.lastFetch; },

    whenReady: function () {
      if (state.loaded) return Promise.resolve(state.labels);
      return state.readyPromise;
    },

    // diagnostic
    count: function () {
      return Object.keys(state.labels).length;
    }
  };

  window.Labels = Labels;

  /* ============================================================
     9. MAIN LOAD
     ============================================================ */

  function load() {
    if (state.loading) return state.readyPromise;

    if (state.loaded && (Date.now() - state.lastFetch) < 60 * 1000) {
      return Promise.resolve(state.labels);
    }

    return fetchFromDb()
      .then(function (data) {
        state.labels = data;
        state.lastFetch = Date.now();
        state.loaded = true;
        state.loading = false;
        state.error = null;

        saveToCache();
        apply(document);
        notifyListeners(null);

        dispatchEvent('itws:labels-loaded', {
          labels: state.labels,
          count: Object.keys(data).length,
          source: 'db'
        });

        log('debug', 'Loaded from DB', Object.keys(data).length);

        if (state.readyResolve) state.readyResolve(state.labels);
        return state.labels;
      })
      .catch(function (err) {
        state.loading = false;
        state.error = err && err.message ? err.message : String(err);

        if (state.loaded) {
          log('error', 'Fetch failed, using cache', state.error);
          return state.labels;
        }

        log('error', 'Fetch failed, no cache available', state.error);
        state.loaded = true;
        if (state.readyResolve) state.readyResolve(state.labels);
        return state.labels;
      });
  }

  /* ============================================================
     10. INIT
     ============================================================ */

  function init() {
    // Set language on HTML
    try {
      document.documentElement.setAttribute('lang', state.lang);
      document.documentElement.setAttribute('dir', state.lang === 'ar' ? 'rtl' : 'ltr');
    } catch (e) {}

    // 1. Cache first
    var hadCache = loadFromCache();
    if (hadCache) {
      apply(document);
      dispatchEvent('itws:labels-loaded', {
        labels: state.labels,
        count: Object.keys(state.labels).length,
        source: 'cache'
      });
      if (state.readyResolve) state.readyResolve(state.labels);
    }

    // 2. Fetch from DB
    var sb = getSb();
    if (!sb) {
      if (window.ITWS_SUPABASE_ERROR) {
        log('error', 'Supabase error: ' + window.ITWS_SUPABASE_ERROR);
        if (!state.loaded) {
          state.loaded = true;
          if (state.readyResolve) state.readyResolve(state.labels);
        }
        return;
      }

      window.addEventListener('itws:sb-ready', function () {
        load().then(function () { subscribeRealtime(); });
      }, { once: true });

      setTimeout(function () {
        if (!state.loaded) {
          state.loaded = true;
          if (state.readyResolve) state.readyResolve(state.labels);
        }
      }, 5000);

      return;
    }

    load().then(function () { subscribeRealtime(); });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  // Cleanup
  if (typeof window.addEventListener === 'function') {
    window.addEventListener('beforeunload', unsubscribeRealtime);
  }

})();
