// ============================================
// [6/50] ITWS Platform - Theme Manager
// Path: assets/js/theme.js
// ============================================
// 💡 الملف الأهم في نظام الثيمات
// 💡 يعمل قبل تحميل CSS لمنع FOUC (وميض الألوان)
// 💡 يزامن مع Supabase للثيم الافتراضي
// 💡 يستمع لتغيير الافتراضي في الوقت الحقيقي
// ============================================

(function () {
  'use strict';

  // ============ حماية من التهيئة المكررة ============
  if (window.ThemeManager && window.ThemeManager.booted) return;

  var cfg = window.ITWS_CONFIG;
  var STORAGE_KEY = (cfg && cfg.STORAGE_KEYS && cfg.STORAGE_KEYS.THEME) || 'itws_theme';
  var root = document.documentElement;

  // ============ حالة داخلية ============
  var state = {
    currentThemeId: null,
    currentColors: null,
    source: 'none',        // 'local' | 'default' | 'fallback' | 'none'
    channel: null,
    initialized: false
  };

  // ============ 1. تطبيق الألوان على DOM ============
  function applyColors(colors) {
    if (!colors || typeof colors !== 'object') return;
    Object.keys(colors).forEach(function (key) {
      var value = colors[key];
      if (value != null) {
        root.style.setProperty('--' + key, value);
      }
    });
  }

  // ============ 2. إضافة/إزالة class بناءً على نوع الثيم ============
  function applyThemeClass(themeObj) {
    if (!themeObj) return;
    var isLight = themeObj.is_light === true;
    root.classList.toggle('theme-light', isLight);
    root.classList.toggle('theme-dark', !isLight);
    root.setAttribute('data-theme', themeObj.id || '');
  }

  // ============ 3. قراءة الثيم المحلي ============
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

  // ============ 4. حفظ الثيم المحلي ============
  function writeLocalTheme(themeId, colors) {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({
        id: themeId,
        colors: colors,
        savedAt: Date.now()
      }));
    } catch (e) {
      // قد يكون localStorage ممتلئ — نتجاهل بهدوء
    }
  }

  // ============ 5. مسح الثيم المحلي ============
  function clearLocalTheme() {
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch (e) {}
  }

  // ============ 6. تطبيق الثيم من الكائن الكامل ============
  function applyThemeObject(themeObj, source) {
    if (!themeObj || !themeObj.colors) return false;
    applyColors(themeObj.colors);
    applyThemeClass(themeObj);
    state.currentThemeId = themeObj.id || null;
    state.currentColors = themeObj.colors;
    state.source = source || 'unknown';
    return true;
  }

  // ============ 7. Boot — التنفيذ الفوري قبل CSS ============
  // ده الجزء اللي بيمنع FOUC
  function boot() {
    if (state.initialized) return;

    // (أ) لو فيه ثيم محلي → طبقه فوراً
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

    // (ب) لو مفيش محلي → استخدم fallback من themes-data
    var fallbackId = window.ITWS_DEFAULT_THEME || 'formal_dark';
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

    // (ج) مفيش ولا حاجة → نسيب CSS الافتراضي في theme.css
    state.source = 'css-default';
    state.initialized = true;
    logDebug('Boot: using CSS defaults');
  }

  // ============ 8. جلب الثيم الافتراضي من Supabase ============
  function fetchDefaultTheme() {
    if (!window.sb) return Promise.resolve(null);

    return window.sb
      .from('settings')
      .select('value')
      .eq('key', 'general')
      .maybeSingle()
      .then(function (res) {
        if (res.error) {
          logDebug('fetchDefaultTheme error:', res.error.message);
          return null;
        }
        if (!res.data || !res.data.value) return null;
        var themeId = res.data.value.default_theme;
        if (!themeId) return null;

        // (أ) لو الثيم موجود محلياً في themes-data → استخدمه مباشرة
        var localDef = window.ITWS_THEMES && window.ITWS_THEMES[themeId];
        if (localDef) {
          return { id: themeId, colors: localDef.colors, is_light: localDef.is_light };
        }

        // (ب) لو مش موجود → اجلبه من جدول themes
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
        logDebug('fetchDefaultTheme catch:', err.message);
        return null;
      });
  }

  // ============ 9. المزامنة مع Supabase ============
  function sync() {
    // لو فيه ثيم محلي → المستخدم اختار بنفسه، متلمسوش
    if (state.source === 'local') {
      logDebug('Sync: skipped (user has local theme)');
      return Promise.resolve();
    }

    return fetchDefaultTheme().then(function (remote) {
      if (!remote || !remote.colors) {
        logDebug('Sync: no remote theme, keeping fallback');
        return;
      }
      applyColors(remote.colors);
      applyThemeClass(remote);
      state.currentThemeId = remote.id;
      state.currentColors = remote.colors;
      state.source = 'default';
      logDebug('Sync: applied remote default theme', remote.id);
      notifyThemeChanged();
    });
  }

  // ============ 10. تغيير الثيم (من المستخدم) ============
  function change(themeId) {
    if (!themeId) return false;

    // (أ) لو الثيم موجود في themes-data
    var themeObj = window.ITWS_THEMES && window.ITWS_THEMES[themeId];
    if (themeObj) {
      applyThemeObject(themeObj, 'local');
      writeLocalTheme(themeObj.id, themeObj.colors);
      updateThemePickerUI(themeObj.id);
      notifyThemeChanged();
      return true;
    }

    // (ب) لو مش موجود محلياً → نحاول نجيبه من Supabase
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
        });
      return true;
    }

    return false;
  }

  // ============ 11. الرجوع للافتراضي ============
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
        // Fallback
        var fb = window.ITWS_THEMES && window.ITWS_THEMES[window.ITWS_DEFAULT_THEME || 'formal_dark'];
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
    });
  }

  // ============ 12. تحديث UI اختيار الثيم ============
  function updateThemePickerUI(activeId) {
    var pickers = document.querySelectorAll('[data-theme-option]');
    if (!pickers.length) return;
    pickers.forEach(function (el) {
      var isActive = el.getAttribute('data-theme-option') === activeId;
      el.classList.toggle('active', isActive);
      el.setAttribute('aria-pressed', isActive ? 'true' : 'false');
    });
  }

  // ============ 13. إرسال حدث عند التغيير ============
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

  // ============ 14. الاستماع لتغيير الافتراضي (realtime) ============
  function subscribe() {
    if (!window.sb || state.channel) return;

    try {
      state.channel = window.sb
        .channel('itws-theme-realtime')
        .on(
          'postgres_changes',
          {
            event: 'UPDATE',
            schema: 'public',
            table: 'settings',
            filter: 'key=eq.general'
          },
          function (payload) {
            // لو المستخدم عنده ثيم محلي → متلمسوش
            if (state.source === 'local') {
              logDebug('Realtime: skipped (user has local theme)');
              return;
            }
            // نجيب الافتراضي الجديد
            var newDefault = payload && payload.new && payload.new.value && payload.new.value.default_theme;
            if (!newDefault) return;
            if (newDefault === state.currentThemeId) return;

            // نطبقه
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

            // لو مش موجود محلياً → نجيبه من themes
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
                logDebug('Realtime: applied new default theme (from DB)', newDefault);
              });
          }
        )
        .subscribe(function (status) {
          logDebug('Realtime channel:', status);
        });
    } catch (err) {
      logDebug('Realtime subscribe failed:', err.message);
    }
  }

  // ============ 15. مساعدات ============
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

  // ============ 16. الواجهة العامة ============
  window.ThemeManager = {
    booted: true,
    boot: boot,
    sync: sync,
    change: change,
    reset: reset,
    subscribe: subscribe,
    applyColors: applyColors,
    getCurrent: function () {
      return {
        id: state.currentThemeId,
        colors: state.currentColors,
        source: state.source
      };
    },
    getCurrentId: function () {
      return state.currentThemeId;
    },
    refreshPicker: function () {
      updateThemePickerUI(state.currentThemeId);
    }
  };

  // ============ 17. التنفيذ الفوري ============
  // (١) Boot — قبل أي CSS أو HTML
  boot();

  // (٢) عند DOMContentLoaded — نربط الـ pickers
  function onDOMReady() {
    updateThemePickerUI(state.currentThemeId);

    // ربط الـ pickers
    document.querySelectorAll('[data-theme-option]').forEach(function (el) {
      if (el.__themeBound) return;
      el.__themeBound = true;
      el.addEventListener('click', function () {
        var themeId = el.getAttribute('data-theme-option');
        if (themeId) change(themeId);
      });
    });

    // مزامنة مع Supabase
    sync().then(function () {
      subscribe();
    });
  }

  // (٣) عند تحميل الصفحة — إخفاء loader
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

  // (٤) أمان إضافي: لو الـ loader لسه موجود بعد 2.5 ثانية → اخفيه
  setTimeout(hideLoader, 2500);

})();
