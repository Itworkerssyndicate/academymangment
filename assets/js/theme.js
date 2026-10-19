// ============================================
// [6/50] ITWS Platform - Theme Manager
// Path: assets/js/theme.js
// ============================================
// إصلاح: يقرأ من 'theme' key (بدل general)
// إصلاح: يعتمد على AppSettings كأولوية
// إصلاح: Event delegation للـ theme picker
// إصلاح: بدون إيموجي
// ============================================

(function () {
  'use strict';

  if (window.ThemeManager && window.ThemeManager.booted) return;

  var cfg = window.ITWS_CONFIG;
  var STORAGE_KEY = (cfg && cfg.STORAGE_KEYS && cfg.STORAGE_KEYS.THEME) || 'itws_theme';
  var root = document.documentElement;

  var state = {
    currentThemeId: null,
    currentColors: null,
    source: 'none',
    channel: null,
    initialized: false,
    currentFont: null,
    realtimeSubscribed: false
  };

  // ============================================
  // 1. تطبيق الألوان على DOM
  // ============================================
  function applyColors(colors) {
    if (!colors || typeof colors !== 'object') return;
    Object.keys(colors).forEach(function (key) {
      var value = colors[key];
      if (value != null) {
        root.style.setProperty('--' + key, value);
      }
    });
  }

  // ============================================
  // 2. تطبيق class الثيم (light/dark)
  // ============================================
  function applyThemeClass(themeObj) {
    if (!themeObj) return;
    var isLight = themeObj.is_light === true;
    root.classList.toggle('theme-light', isLight);
    root.classList.toggle('theme-dark', !isLight);
    root.setAttribute('data-theme', themeObj.id || '');
  }

  // ============================================
  // 3. تطبيق الخط ديناميكياً
  // ============================================
  function applyFont(fontFamily) {
    if (!fontFamily) fontFamily = 'Cairo';
    if (state.currentFont === fontFamily) return;
    state.currentFont = fontFamily;

    root.style.setProperty('--font', "'" + fontFamily + "', 'Segoe UI', 'Tahoma', sans-serif");

    if (fontFamily !== 'Cairo' && fontFamily !== 'system') {
      injectFontLink(fontFamily);
    }
  }

  function injectFontLink(fontFamily) {
    var id = 'itws-font-' + fontFamily.replace(/\s+/g, '-').toLowerCase();
    if (document.getElementById(id)) return;

    var link = document.createElement('link');
    link.id = id;
    link.rel = 'stylesheet';
    link.href = 'https://fonts.googleapis.com/css2?family=' +
      encodeURIComponent(fontFamily) +
      ':wght@300;400;500;600;700;800;900&display=swap';
    document.head.appendChild(link);
  }

  // ============================================
  // 4. قراءة الثيم المحلي
  // ============================================
  function readLocalTheme() {
    try {
      var raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return null;
      var parsed = JSON.parse(raw);
      if (!parsed || !parsed.id || !parsed.colors) return null;
      return parsed;
    } catch (e) {
      return null;
    }
  }

  function writeLocalTheme(themeId, colors) {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({
        id: themeId,
        colors: colors,
        savedAt: Date.now()
      }));
    } catch (e) {}
  }

  function clearLocalTheme() {
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch (e) {}
  }

  // ============================================
  // 5. تطبيق theme object
  // ============================================
  function applyThemeObject(themeObj, source) {
    if (!themeObj || !themeObj.colors) return false;
    applyColors(themeObj.colors);
    applyThemeClass(themeObj);
    state.currentThemeId = themeObj.id || null;
    state.currentColors = themeObj.colors;
    state.source = source || 'unknown';
    return true;
  }

  // ============================================
  // 6. Boot — قبل CSS (يمنع FOUC)
  // ============================================
  function boot() {
    if (state.initialized) return;

    // (أ) تطبيق الخط فوراً من AppSettings (لو متاح)
    var fontFromSettings = null;
    if (window.AppSettings && window.AppSettings.get) {
      fontFromSettings = window.AppSettings.get('behavior.font_family', 'Cairo');
    }
    if (fontFromSettings) {
      applyFont(fontFromSettings);
    } else {
      applyFont('Cairo');
    }

    // (ب) ثيم محلي
    var local = readLocalTheme();
    if (local && local.colors) {
      applyColors(local.colors);
      var localThemeObj = window.ITWS_THEMES && window.ITWS_THEMES[local.id];
      if (localThemeObj) {
        applyThemeClass(localThemeObj);
      }
      state.currentThemeId = local.id;
      state.currentColors = local.colors;
      state.source = 'local';
      state.initialized = true;
      logDebug('Boot: applied local theme', local.id);
      return;
    }

    // (ج) Fallback من themes-data
    var fallbackId = window.ITWS_DEFAULT_THEME || 'watanii_dark';
    var fallback = window.ITWS_THEMES && window.ITWS_THEMES[fallbackId];
    if (fallback) {
      applyColors(fallback.colors);
      applyThemeClass(fallback);
      state.currentThemeId = fallback.id;
      state.currentColors = fallback.colors;
      state.source = 'fallback';
      state.initialized = true;
      logDebug('Boot: applied fallback theme', fallbackId);
      return;
    }

    state.source = 'css-default';
    state.initialized = true;
  }

  // ============================================
  // 7. جلب الثيم الافتراضي
  // ============================================
  function fetchDefaultTheme() {
    // (أ) من AppSettings (أسرع - localStorage)
    if (window.AppSettings && window.AppSettings.get) {
      var themeIdFromSettings = window.AppSettings.get('theme.default_theme', null);
      if (themeIdFromSettings) {
        var localDef = window.ITWS_THEMES && window.ITWS_THEMES[themeIdFromSettings];
        if (localDef) {
          logDebug('fetchDefaultTheme: from AppSettings', themeIdFromSettings);
          return Promise.resolve({
            id: themeIdFromSettings,
            colors: localDef.colors,
            is_light: localDef.is_light
          });
        }
      }
    }

    // (ب) من Supabase (لو AppSettings مش متاح)
    if (!window.sb) return Promise.resolve(null);

    return window.sb
      .from('settings')
      .select('value')
      .eq('key', 'theme')  // ← إصلاح: 'theme' بدل 'general'
      .maybeSingle()
      .then(function (res) {
        if (res.error || !res.data || !res.data.value) {
          logDebug('fetchDefaultTheme: no theme key in Supabase');
          return null;
        }
        var themeId = res.data.value.default_theme;
        if (!themeId) return null;

        var localDef2 = window.ITWS_THEMES && window.ITWS_THEMES[themeId];
        if (localDef2) {
          return { id: themeId, colors: localDef2.colors, is_light: localDef2.is_light };
        }

        // من جدول themes
        return window.sb
          .from('themes')
          .select('id, colors, is_light')
          .eq('id', themeId)
          .maybeSingle()
          .then(function (r2) {
            if (r2.error || !r2.data) return null;
            return {
              id: r2.data.id,
              colors: r2.data.colors,
              is_light: r2.data.is_light === true
            };
          });
      })
      .catch(function (err) {
        logDebug('fetchDefaultTheme error:', err.message);
        return null;
      });
  }

  // ============================================
  // 8. Sync — مزامنة الثيم مع Supabase
  // ============================================
  function sync() {
    // لو المستخدم عنده ثيم محلي → متلمسوش
    if (state.source === 'local') {
      logDebug('Sync: skipped (user has local theme)');
      return Promise.resolve();
    }

    return fetchDefaultTheme().then(function (remote) {
      if (!remote || !remote.colors) {
        logDebug('Sync: no remote theme');
        return;
      }
      applyColors(remote.colors);
      applyThemeClass(remote);
      state.currentThemeId = remote.id;
      state.currentColors = remote.colors;
      state.source = 'default';
      notifyThemeChanged();
      logDebug('Sync: applied default theme', remote.id);
    });
  }

  // ============================================
  // 9. تغيير الثيم (من المستخدم)
  // ============================================
  function change(themeId) {
    if (!themeId) return false;

    // (أ) من themes-data
    var themeObj = window.ITWS_THEMES && window.ITWS_THEMES[themeId];
    if (themeObj) {
      applyThemeObject(themeObj, 'local');
      writeLocalTheme(themeObj.id, themeObj.colors);
      updateThemePickerUI(themeObj.id);
      notifyThemeChanged();
      logDebug('Change: applied local theme', themeId);
      return true;
    }

    // (ب) من Supabase (لو مش موجود محلياً)
    if (window.sb) {
      window.sb
        .from('themes')
        .select('id, colors, is_light')
        .eq('id', themeId)
        .maybeSingle()
        .then(function (res) {
          if (res.error || !res.data) {
            showError('الثيم غير متوفر');
            return;
          }
          var remoteTheme = {
            id: res.data.id,
            colors: res.data.colors,
            is_light: res.data.is_light === true
          };
          applyThemeObject(remoteTheme, 'local');
          writeLocalTheme(remoteTheme.id, remoteTheme.colors);
          updateThemePickerUI(remoteTheme.id);
          notifyThemeChanged();
          logDebug('Change: applied remote theme', themeId);
        });
      return true;
    }

    return false;
  }

  // ============================================
  // 10. Reset
  // ============================================
  function reset() {
    clearLocalTheme();
    state.source = 'none';

    return fetchDefaultTheme().then(function (remote) {
      if (remote && remote.colors) {
        applyColors(remote.colors);
        applyThemeClass(remote);
        state.currentThemeId = remote.id;
        state.currentColors = remote.colors;
        state.source = 'default';
      } else {
        var fb = window.ITWS_THEMES && window.ITWS_THEMES[window.ITWS_DEFAULT_THEME || 'watanii_dark'];
        if (fb) {
          applyColors(fb.colors);
          applyThemeClass(fb);
          state.currentThemeId = fb.id;
          state.currentColors = fb.colors;
          state.source = 'fallback';
        }
      }
      updateThemePickerUI(state.currentThemeId);
      notifyThemeChanged();
      logDebug('Reset to default');
    });
  }

  // ============================================
  // 11. تحديث UI الـ picker
  // ============================================
  function updateThemePickerUI(activeId) {
    var pickers = document.querySelectorAll('[data-theme-option]');
    if (!pickers.length) return;
    pickers.forEach(function (el) {
      var isActive = el.getAttribute('data-theme-option') === activeId;
      el.classList.toggle('active', isActive);
      el.setAttribute('aria-pressed', isActive ? 'true' : 'false');
    });
  }

  // ============================================
  // 12. إرسال حدث التغيير
  // ============================================
  function notifyThemeChanged() {
    try {
      window.dispatchEvent(new CustomEvent('itws:theme-changed', {
        detail: {
          themeId: state.currentThemeId,
          colors: state.currentColors,
          source: state.source
        }
      }));
    } catch (e) {}
  }

  // ============================================
  // 13. Realtime subscribe
  // ============================================
  function subscribe() {
    if (!window.sb || state.realtimeSubscribed) return;

    try {
      state.channel = window.sb
        .channel('itws-theme-realtime')
        .on(
          'postgres_changes',
          { event: 'UPDATE', schema: 'public', table: 'settings', filter: 'key=eq.theme' },
          function (payload) {
            if (state.source === 'local') {
              logDebug('Realtime: skipped (user has local theme)');
              return;
            }
            var newDefault = payload && payload.new && payload.new.value && payload.new.value.default_theme;
            if (!newDefault || newDefault === state.currentThemeId) return;

            var localDef = window.ITWS_THEMES && window.ITWS_THEMES[newDefault];
            if (localDef) {
              applyColors(localDef.colors);
              applyThemeClass(localDef);
              state.currentThemeId = localDef.id;
              state.currentColors = localDef.colors;
              state.source = 'default';
              notifyThemeChanged();
              logDebug('Realtime: applied new default theme', newDefault);
              return;
            }

            // لو مش موجود محلياً → من جدول themes
            window.sb
              .from('themes')
              .select('id, colors, is_light')
              .eq('id', newDefault)
              .maybeSingle()
              .then(function (r) {
                if (r.error || !r.data) return;
                var themeObj = {
                  id: r.data.id,
                  colors: r.data.colors,
                  is_light: r.data.is_light === true
                };
                applyThemeObject(themeObj, 'default');
                notifyThemeChanged();
                logDebug('Realtime: applied new theme from DB', newDefault);
              });
          }
        )
        .subscribe(function (status) {
          logDebug('Realtime channel:', status);
        });
      state.realtimeSubscribed = true;
    } catch (e) {
      logDebug('Realtime subscribe error:', e.message);
    }

    // استمع لتغيير الخط من AppSettings
    if (window.AppSettings && window.AppSettings.onChange) {
      window.AppSettings.onChange(function (cache, changedKey) {
        if (changedKey === 'behavior') {
          var font = window.AppSettings.get('behavior.font_family', 'Cairo');
          applyFont(font);
        }
        if (changedKey === 'theme') {
          // لو الثيم الافتراضي اتغير من الإعدادات
          if (state.source !== 'local') {
            sync();
          }
        }
      });
    }
  }

  // ============================================
  // 14. Helpers
  // ============================================
  function logDebug() {
    if (cfg && cfg.DEBUG) {
      console.log.apply(console, ['[ThemeManager]'].concat(Array.prototype.slice.call(arguments)));
    }
  }

  function showError(msg) {
    if (window.Utils && window.Utils.showToast) {
      window.Utils.showToast(msg, 'error');
    } else {
      console.warn('[ThemeManager]', msg);
    }
  }

  // ============================================
  // 15. Public API
  // ============================================
  window.ThemeManager = {
    booted: true,
    boot: boot,
    sync: sync,
    change: change,
    reset: reset,
    subscribe: subscribe,
    applyColors: applyColors,
    applyFont: applyFont,
    getCurrent: function () {
      return {
        id: state.currentThemeId,
        colors: state.currentColors,
        source: state.source,
        font: state.currentFont
      };
    },
    getCurrentId: function () {
      return state.currentThemeId;
    },
    refreshPicker: function () {
      updateThemePickerUI(state.currentThemeId);
    }
  };

  // ============================================
  // 16. التنفيذ الفوري (قبل CSS)
  // ============================================
  boot();

  // ============================================
  // 17. بعد DOMContentLoaded
  // ============================================
  function onDOMReady() {
    // تحديث الـ picker (لو موجود)
    updateThemePickerUI(state.currentThemeId);

    // Event delegation — يشتغل مع أزرار ديناميكية
    document.addEventListener('click', function (e) {
      var target = e.target.closest ? e.target.closest('[data-theme-option]') : null;
      if (!target) return;

      var themeId = target.getAttribute('data-theme-option');
      if (themeId) {
        change(themeId);
      }
    });

    // مزامنة + realtime
    sync().then(function () {
      subscribe();
    });
  }

  // إخفاء الـ boot loader
  function hideLoader() {
    var loader = document.getElementById('themeBootLoader');
    if (!loader) return;
    loader.classList.add('hide');
    setTimeout(function () {
      if (loader && loader.parentNode) {
        loader.parentNode.removeChild(loader);
      }
    }, 400);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function () {
      onDOMReady();
      hideLoader();
    });
  } else {
    onDOMReady();
    hideLoader();
  }

  // أمان إضافي: إخفاء الـ loader بعد 2.5 ثانية
  setTimeout(hideLoader, 2500);

})();
