/* ============================================================
   ITWS Platform — Supabase Client V3 (Silent + ES5-safe)
   File: assets/js/supabase-client.js

   ⚠️ NO console.error / NO console.warn
   ⚠️ Silent mode — no errors even if config missing
   ⚠️ ES5-safe (no ?., no ??, no =>, no template literals)
   ============================================================ */

(function () {
  'use strict';

  if (window.ITWS_SUPABASE_READY) return;

  /* ============================================================
     1. SILENT FAIL (no console output)
     ============================================================ */

  function fail(msg) {
    window.ITWS_SUPABASE_ERROR = msg;
    try {
      window.dispatchEvent(new CustomEvent('itws:supabase-error', {
        detail: { error: msg }
      }));
    } catch (e) {}
  }

  /* ============================================================
     2. DEPENDENCY CHECKS
     ============================================================ */

  if (typeof window.supabase === 'undefined') {
    fail('Supabase SDK not loaded');
    return;
  }

  if (typeof window.supabase.createClient !== 'function') {
    fail('Supabase SDK v1 detected — v2 required');
    return;
  }

  if (!window.ITWS_CONFIG) {
    fail('ITWS_CONFIG not found');
    return;
  }

  var cfg = window.ITWS_CONFIG;

  if (!cfg.SUPABASE_URL) {
    fail('SUPABASE_URL missing');
    return;
  }

  if (!cfg.SUPABASE_ANON_KEY) {
    fail('SUPABASE_ANON_KEY missing');
    return;
  }

  /* ============================================================
     3. CREATE CLIENT
     ============================================================ */

  var client = null;

  try {
    client = window.supabase.createClient(
      cfg.SUPABASE_URL,
      cfg.SUPABASE_ANON_KEY,
      {
        auth: {
          persistSession: true,
          autoRefreshToken: true,
          detectSessionInUrl: true,
          storageKey: 'itws_auth',
          flowType: 'pkce',
          storage: window.localStorage
        },
        realtime: {
          params: { eventsPerSecond: 10 }
        },
        global: {
          headers: {
            'x-application-name': 'itws-platform-v2'
          }
        },
        db: {
          schema: 'public'
        }
      }
    );
  } catch (err) {
    fail('Failed to create client: ' + (err && err.message ? err.message : String(err)));
    return;
  }

  if (!client || !client.auth) {
    fail('Client created but .auth is missing');
    return;
  }

  /* ============================================================
     4. EXPOSE GLOBALS
     ============================================================ */

  window.sb = client;
  if (!window.supabaseClient) window.supabaseClient = client;
  if (!window.ITWS_SUPABASE) window.ITWS_SUPABASE = client;

  window.getSb = function () {
    return window.sb || window.supabaseClient || window.ITWS_SUPABASE || null;
  };

  /* ============================================================
     5. CONNECTION STATE
     ============================================================ */

  var connState = {
    isOnline: typeof navigator !== 'undefined' ? navigator.onLine : true,
    lastCheck: Date.now(),
    lastError: null
  };

  if (typeof window.addEventListener === 'function') {
    window.addEventListener('online', function () {
      connState.isOnline = true;
      connState.lastCheck = Date.now();
      try {
        window.dispatchEvent(new CustomEvent('itws:supabase-online'));
      } catch (e) {}
    });

    window.addEventListener('offline', function () {
      connState.isOnline = false;
      connState.lastCheck = Date.now();
      try {
        window.dispatchEvent(new CustomEvent('itws:supabase-offline'));
      } catch (e) {}
    });
  }

  window.sbHealthCheck = function () {
    return client.auth.getSession()
      .then(function (res) {
        connState.isOnline = true;
        connState.lastCheck = Date.now();
        connState.lastError = null;
        return {
          ok: true,
          session: res && res.data ? res.data.session : null
        };
      })
      .catch(function (err) {
        connState.isOnline = false;
        connState.lastCheck = Date.now();
        connState.lastError = err && err.message ? err.message : String(err);
        return { ok: false, error: connState.lastError };
      });
  };

  window.sbConnectionState = function () {
    return {
      isOnline: connState.isOnline,
      lastCheck: connState.lastCheck,
      lastError: connState.lastError
    };
  };

  /* ============================================================
     6. AUTH HELPERS
     ============================================================ */

  window.sbGetUser = function () {
    return client.auth.getUser()
      .then(function (res) {
        if (res && res.data && res.data.user) return res.data.user;
        return null;
      })
      .catch(function () { return null; });
  };

  window.sbGetSession = function () {
    return client.auth.getSession()
      .then(function (res) {
        if (res && res.data && res.data.session) return res.data.session;
        return null;
      })
      .catch(function () { return null; });
  };

  window.sbGetProfile = function () {
    return window.sbGetUser()
      .then(function (user) {
        if (!user) return null;
        return client.from('profiles')
          .select('id, email, full_name, role, status, is_active, is_deleted, governorate_id, branch_id, academy_id, avatar_url, phone')
          .eq('id', user.id)
          .maybeSingle()
          .then(function (res) {
            return (res && res.data) ? res.data : null;
          });
      })
      .catch(function () { return null; });
  };

  window.sbSignOut = function () {
    return client.auth.signOut()
      .then(function () {
        try {
          var keys = [];
          var i;
          for (i = 0; i < localStorage.length; i++) {
            var k = localStorage.key(i);
            if (k && (k.indexOf('itws_') === 0 || k.indexOf('supabase') === 0 || k.indexOf('sb-') === 0)) {
              keys.push(k);
            }
          }
          for (i = 0; i < keys.length; i++) {
            try { localStorage.removeItem(keys[i]); } catch (e) {}
          }
        } catch (e) {}
        return true;
      })
      .catch(function () { return false; });
  };

  /* ============================================================
     7. AUTH STATE LISTENER
     ============================================================ */

  try {
    client.auth.onAuthStateChange(function (event, session) {
      var payload = {
        event: event,
        session: session || null,
        user: (session && session.user) ? session.user : null
      };

      try {
        window.dispatchEvent(new CustomEvent('itws:auth-changed', { detail: payload }));
      } catch (e) {}

      if (event === 'SIGNED_IN') {
        try {
          window.dispatchEvent(new CustomEvent('itws:signed-in', { detail: payload }));
        } catch (e) {}
      } else if (event === 'SIGNED_OUT') {
        try {
          window.dispatchEvent(new CustomEvent('itws:signed-out', { detail: payload }));
        } catch (e) {}
      } else if (event === 'TOKEN_REFRESHED') {
        try {
          window.dispatchEvent(new CustomEvent('itws:token-refreshed', { detail: payload }));
        } catch (e) {}
      }
    });
  } catch (e) {}

  /* ============================================================
     8. QUERY HELPERS
     ============================================================ */

  window.sbFetchOne = function (table, filters) {
    if (!table) return Promise.reject(new Error('table required'));

    var query = client.from(table).select('*');

    if (filters && typeof filters === 'object') {
      var k;
      for (k in filters) {
        if (filters.hasOwnProperty(k)) {
          query = query.eq(k, filters[k]);
        }
      }
    }

    return query.maybeSingle().then(function (res) {
      if (res.error) throw new Error(res.error.message);
      return res.data;
    });
  };

  window.sbFetchMany = function (table, options) {
    if (!table) return Promise.reject(new Error('table required'));

    options = options || {};
    var select = options.select || '*';
    var query = client.from(table).select(select);

    if (options.filters && typeof options.filters === 'object') {
      var k;
      for (k in options.filters) {
        if (options.filters.hasOwnProperty(k)) {
          var val = options.filters[k];
          if (val === null) {
            query = query.is(k, null);
          } else {
            query = query.eq(k, val);
          }
        }
      }
    }

    if (options.order) {
      query = query.order(options.order.column || 'created_at', {
        ascending: options.order.ascending !== false
      });
    }

    if (options.limit) {
      query = query.limit(options.limit);
    }

    if (options.range && options.range.length === 2) {
      query = query.range(options.range[0], options.range[1]);
    }

    return query.then(function (res) {
      if (res.error) throw new Error(res.error.message);
      return res.data || [];
    });
  };

  /* ============================================================
     9. STORAGE HELPERS
     ============================================================ */

  window.sbUploadFile = function (bucket, path, file, options) {
    if (!bucket || !path || !file) {
      return Promise.reject(new Error('bucket, path, file required'));
    }

    options = options || {};

    return client.storage.from(bucket).upload(path, file, {
      cacheControl: options.cacheControl || '3600',
      upsert: options.upsert !== false,
      contentType: options.contentType || file.type
    }).then(function (res) {
      if (res.error) throw new Error(res.error.message);
      var urlRes = client.storage.from(bucket).getPublicUrl(path);
      return {
        path: path,
        publicUrl: (urlRes && urlRes.data) ? urlRes.data.publicUrl : null,
        fullPath: res.data ? res.data.path : path
      };
    });
  };

  window.sbDeleteFile = function (bucket, paths) {
    if (!bucket || !paths) {
      return Promise.reject(new Error('bucket and paths required'));
    }
    var arr = Array.isArray(paths) ? paths : [paths];
    return client.storage.from(bucket).remove(arr).then(function (res) {
      if (res.error) throw new Error(res.error.message);
      return true;
    });
  };

  /* ============================================================
     10. REALTIME HELPERS
     ============================================================ */

  window.sbChannel = function (name) {
    return client.channel(name);
  };

  /* ============================================================
     11. MARK READY
     ============================================================ */

  window.ITWS_SUPABASE_READY = true;
  window.ITWS_SUPABASE_ERROR = null;

  try {
    window.dispatchEvent(new CustomEvent('itws:sb-ready', {
      detail: { client: client }
    }));
  } catch (e) {}

  /* ============================================================
     12. DEBUG (only if enabled)
     ============================================================ */

  if (cfg.DEBUG) {
    try {
      console.log('%c[ITWS Supabase]', 'color: #10B981; font-weight: bold;', 'Client ready');
    } catch (e) {}
  }

})();
