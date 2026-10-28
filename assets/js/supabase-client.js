/* ============================================================
   ITWS Platform — Supabase Client V2
   File: assets/js/supabase-client.js
   Description: Initialize global window.sb + monitoring + helpers
   Load order: THIRD (after config.js, after Supabase CDN)
   
   ⚠️ SECURITY:
   - Uses ANON_KEY only (never SERVICE_ROLE_KEY)
   - Auth session managed by supabase-js internally
   
   Rules:
   - No emoji
   - ES5-style IIFE
   - Single global: window.sb
   ============================================================ */

(function () {
  'use strict';

  // Prevent double-init
  if (window.ITWS_SUPABASE_READY) return;

  /* ============================================================
     1. VALIDATE DEPENDENCIES
     ============================================================ */

  function fail(msg) {
    console.error('[ITWS Supabase] ' + msg);
    window.ITWS_SUPABASE_ERROR = msg;
  }

  // Check Supabase SDK
  if (typeof window.supabase === 'undefined') {
    fail('Supabase SDK not loaded. Add <script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2"></script> before this file.');
    return;
  }

  if (typeof window.supabase.createClient !== 'function') {
    fail('Supabase SDK is not v2 (missing createClient). You are likely using v1.');
    return;
  }

  // Check Config
  if (!window.ITWS_CONFIG) {
    fail('ITWS_CONFIG not found. Load config.js before this file.');
    return;
  }

  var cfg = window.ITWS_CONFIG;

  if (!cfg.SUPABASE_URL || cfg.SUPABASE_URL.indexOf('YOUR_PROJECT_REF') !== -1) {
    fail('SUPABASE_URL not configured in config.js');
    return;
  }

  if (!cfg.SUPABASE_ANON_KEY || cfg.SUPABASE_ANON_KEY.indexOf('YOUR_ANON_KEY') !== -1) {
    fail('SUPABASE_ANON_KEY not configured in config.js');
    return;
  }

  /* ============================================================
     2. CREATE CLIENT
     ============================================================ */

  var client;

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
          params: {
            eventsPerSecond: 10
          }
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
    fail('Failed to create Supabase client: ' + (err && err.message ? err.message : err));
    return;
  }

  if (!client || !client.auth) {
    fail('Client created but .auth is missing');
    return;
  }

  /* ============================================================
     3. VERIFY CLIENT METHODS
     ============================================================ */

  var requiredMethods = [
    'signInWithEmailAndPassword',
    'signInWithPassword',  // v2 alias
    'signOut',
    'getSession',
    'getUser',
    'onAuthStateChange',
    'resetPasswordForEmail'
  ];

  var missingMethods = [];
  requiredMethods.forEach(function (m) {
    if (typeof client.auth[m] !== 'function') {
      missingMethods.push(m);
    }
  });

  // Some methods are aliases — only one of signIn* is required
  var hasSignIn = typeof client.auth.signInWithEmailAndPassword === 'function' ||
                  typeof client.auth.signInWithPassword === 'function';

  if (!hasSignIn) {
    fail('Neither signInWithEmailAndPassword nor signInWithPassword found');
    return;
  }

  if (missingMethods.length > 0) {
    console.warn('[ITWS Supabase] Missing some auth methods:', missingMethods);
  }

  /* ============================================================
     4. EXPOSE GLOBALS
     ============================================================ */

  // Primary global
  window.sb = client;

  // Fallback aliases (للتوافق مع أكواد قديمة)
  if (!window.supabaseClient) window.supabaseClient = client;
  if (!window.ITWS_SUPABASE) window.ITWS_SUPABASE = client;

  // Getter helper (لتجنب مشاكل undefined)
  window.getSb = function () {
    return window.sb || window.supabaseClient || window.ITWS_SUPABASE || null;
  };

  /* ============================================================
     5. CONNECTION MONITORING
     ============================================================ */

  var connectionState = {
    isOnline: typeof navigator !== 'undefined' ? navigator.onLine : true,
    lastCheck: Date.now(),
    lastError: null,
    reconnectAttempts: 0,
    maxReconnectAttempts: 5
  };

  // Online/offline events
  if (typeof window.addEventListener === 'function') {
    window.addEventListener('online', function () {
      connectionState.isOnline = true;
      connectionState.lastCheck = Date.now();
      if (cfg.DEBUG) {
        console.log('[ITWS Supabase] Back online');
      }
      // Dispatch custom event
      try {
        window.dispatchEvent(new CustomEvent('itws:supabase-online'));
      } catch (e) {}
    });

    window.addEventListener('offline', function () {
      connectionState.isOnline = false;
      connectionState.lastCheck = Date.now();
      if (cfg.DEBUG) {
        console.warn('[ITWS Supabase] Offline');
      }
      try {
        window.dispatchEvent(new CustomEvent('itws:supabase-offline'));
      } catch (e) {}
    });
  }

  // Health check (lightweight — auth.getSession)
  window.sbHealthCheck = function () {
    return client.auth.getSession()
      .then(function (res) {
        connectionState.lastCheck = Date.now();
        connectionState.isOnline = true;
        connectionState.reconnectAttempts = 0;
        connectionState.lastError = null;
        return { ok: true, session: res && res.data ? res.data.session : null };
      })
      .catch(function (err) {
        connectionState.lastCheck = Date.now();
        connectionState.isOnline = false;
        connectionState.lastError = err && err.message ? err.message : String(err);
        return { ok: false, error: connectionState.lastError };
      });
  };

  window.sbConnectionState = function () {
    return {
      isOnline: connectionState.isOnline,
      lastCheck: connectionState.lastCheck,
      lastError: connectionState.lastError,
      reconnectAttempts: connectionState.reconnectAttempts
    };
  };

  /* ============================================================
     6. AUTO-RETRY WRAPPER
     Helper for calling queries with retry on network error
     ============================================================ */

  window.sbRetry = function (fn, options) {
    options = options || {};
    var maxAttempts = options.maxAttempts || 3;
    var delay = options.delay || 1000;
    var backoff = options.backoff || 2;

    return new Promise(function (resolve, reject) {
      var attempt = 0;

      function tryOnce() {
        attempt++;
        Promise.resolve()
          .then(function () { return fn(); })
          .then(function (result) {
            resolve(result);
          })
          .catch(function (err) {
            var msg = (err && err.message) ? err.message.toLowerCase() : '';
            var isNetworkError = (
              msg.indexOf('network') !== -1 ||
              msg.indexOf('fetch') !== -1 ||
              msg.indexOf('timeout') !== -1 ||
              msg.indexOf('failed to fetch') !== -1 ||
              (err && err.name === 'TypeError')
            );

            // Don't retry non-network errors
            if (!isNetworkError || attempt >= maxAttempts) {
              reject(err);
              return;
            }

            // Exponential backoff
            var waitTime = delay * Math.pow(backoff, attempt - 1);

            if (cfg.DEBUG) {
              console.warn('[ITWS Supabase] Retry attempt ' + attempt + '/' + maxAttempts +
                          ' after ' + waitTime + 'ms — ' + msg);
            }

            setTimeout(tryOnce, waitTime);
          });
      }

      tryOnce();
    });
  };

  /* ============================================================
     7. AUTH HELPERS
     Convenient wrappers around supabase.auth
     ============================================================ */

  // Get current user (returns user object or null)
  window.sbGetUser = function () {
    return client.auth.getUser()
      .then(function (res) {
        if (res && res.data && res.data.user) {
          return res.data.user;
        }
        return null;
      })
      .catch(function () {
        return null;
      });
  };

  // Get current session
  window.sbGetSession = function () {
    return client.auth.getSession()
      .then(function (res) {
        if (res && res.data && res.data.session) {
          return res.data.session;
        }
        return null;
      })
      .catch(function () {
        return null;
      });
  };

  // Get current profile (with role + scope)
  window.sbGetProfile = function () {
    return window.sbGetUser()
      .then(function (user) {
        if (!user) return null;

        return client
          .from('profiles')
          .select('id, email, full_name, role, status, is_active, is_deleted, ' +
                  'governorate_id, branch_id, academy_id, avatar_url, phone')
          .eq('id', user.id)
          .maybeSingle()
          .then(function (res) {
            if (res && res.data) return res.data;
            return null;
          });
      })
      .catch(function () {
        return null;
      });
  };

  // Sign out helper
  window.sbSignOut = function () {
    return client.auth.signOut()
      .then(function () {
        // Clear local storage auth-related keys
        try {
          Object.keys(localStorage).forEach(function (k) {
            if (k.indexOf('itws_') === 0 || k.indexOf('supabase') === 0 || k.indexOf('sb-') === 0) {
              try { localStorage.removeItem(k); } catch (e) {}
            }
          });
        } catch (e) {}
        return true;
      })
      .catch(function (err) {
        if (cfg.DEBUG) console.warn('[ITWS Supabase] signOut failed:', err);
        return false;
      });
  };

  /* ============================================================
     8. AUTH STATE LISTENER
     يبعت events عالمية عند تغير حالة الـ auth
     ============================================================ */

  try {
    client.auth.onAuthStateChange(function (event, session) {
      if (cfg.DEBUG) {
        console.log('[ITWS Supabase] Auth event:', event, session ? '(has session)' : '(no session)');
      }

      var payload = {
        event: event,
        session: session || null,
        user: session && session.user ? session.user : null
      };

      try {
        window.dispatchEvent(new CustomEvent('itws:auth-changed', { detail: payload }));
      } catch (e) {}

      // Specific events
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
  } catch (e) {
    console.warn('[ITWS Supabase] Could not attach auth state listener:', e);
  }

  /* ============================================================
     9. QUERY HELPERS
     Convenient wrappers for common operations
     ============================================================ */

  // Fetch single row
  window.sbFetchOne = function (table, filters) {
    if (!table) return Promise.reject(new Error('table is required'));

    var query = client.from(table).select('*');
    if (filters && typeof filters === 'object') {
      Object.keys(filters).forEach(function (key) {
        query = query.eq(key, filters[key]);
      });
    }

    return query.maybeSingle().then(function (res) {
      if (res.error) throw new Error(res.error.message);
      return res.data;
    });
  };

  // Fetch many rows
  window.sbFetchMany = function (table, options) {
    if (!table) return Promise.reject(new Error('table is required'));

    options = options || {};
    var select = options.select || '*';
    var query = client.from(table).select(select);

    // Filters
    if (options.filters && typeof options.filters === 'object') {
      Object.keys(options.filters).forEach(function (key) {
        var val = options.filters[key];
        if (val === null) {
          query = query.is(key, null);
        } else {
          query = query.eq(key, val);
        }
      });
    }

    // Order
    if (options.order) {
      query = query.order(options.order.column || 'created_at', {
        ascending: options.order.ascending !== false
      });
    }

    // Limit / Range
    if (options.limit) {
      query = query.limit(options.limit);
    }
    if (options.range && Array.isArray(options.range) && options.range.length === 2) {
      query = query.range(options.range[0], options.range[1]);
    }

    return query.then(function (res) {
      if (res.error) throw new Error(res.error.message);
      return res.data || [];
    });
  };

  /* ============================================================
     10. STORAGE HELPERS
     Convenient uploads to public-assets bucket
     ============================================================ */

  window.sbUploadFile = function (bucket, path, file, options) {
    if (!bucket || !path || !file) {
      return Promise.reject(new Error('bucket, path, and file are required'));
    }

    options = options || {};

    return client.storage
      .from(bucket)
      .upload(path, file, {
        cacheControl: options.cacheControl || '3600',
        upsert: options.upsert !== false,
        contentType: options.contentType || file.type
      })
      .then(function (res) {
        if (res.error) throw new Error(res.error.message);

        // Get public URL
        var urlRes = client.storage.from(bucket).getPublicUrl(path);
        var publicUrl = urlRes && urlRes.data ? urlRes.data.publicUrl : null;

        return {
          path: path,
          publicUrl: publicUrl,
          fullPath: res.data ? res.data.path : path
        };
      });
  };

  window.sbDeleteFile = function (bucket, paths) {
    if (!bucket || !paths) {
      return Promise.reject(new Error('bucket and paths are required'));
    }
    var arr = Array.isArray(paths) ? paths : [paths];
    return client.storage.from(bucket).remove(arr)
      .then(function (res) {
        if (res.error) throw new Error(res.error.message);
        return true;
      });
  };

  /* ============================================================
     11. REALTIME HELPERS
     Basic wrapper — the full realtime.js comes later
     ============================================================ */

  window.sbChannel = function (name) {
    return client.channel(name);
  };

  /* ============================================================
     12. MARK AS READY
     ============================================================ */

  window.ITWS_SUPABASE_READY = true;
  window.ITWS_SUPABASE_ERROR = null;

  /* ============================================================
     13. DISPATCH READY EVENT
     Pages waiting for sb can listen to 'itws:sb-ready'
     ============================================================ */

  try {
    window.dispatchEvent(new CustomEvent('itws:sb-ready', {
      detail: { client: client }
    }));
  } catch (e) {}

  /* ============================================================
     14. DEBUG LOG
     ============================================================ */

  if (cfg.DEBUG) {
    try {
      console.log('%c[ITWS Supabase]', 'color: #10B981; font-weight: bold;', 'Client ready', {
        url: cfg.SUPABASE_URL,
        env: cfg.ENV,
        hasAuth: !!client.auth,
        hasStorage: !!client.storage,
        hasRealtime: !!client.realtime,
        hasFrom: typeof client.from === 'function'
      });
    } catch (e) {}
  }

})();
