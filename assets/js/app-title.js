/* ============================================================
   ITWS Platform — App Title Manager V2
   File: assets/js/app-title.js
   Description: Sync <title>, favicon, meta tags, OG tags
                from settings + realtime updates

   Load order: AFTER labels.js

   Features:
   - Updates document.title from settings + page context
   - Updates favicon (from logo_url)
   - Updates meta description
   - Updates OG tags (og:title, og:description, og:image, og:site_name)
   - Updates Twitter Card tags
   - Updates theme-color meta (from active theme)
   - Updates apple-mobile-web-app-title
   - Page-specific titles via [data-page-title] or meta name="page-name"
   - Dynamic updates when settings change (realtime)
   - Events: itws:app-title-changed

   Rules:
   - No emoji
   - ES5-style IIFE
   - No hardcoded strings (all from settings/labels)
   - Never breaks if settings not loaded (uses fallbacks)
   ============================================================ */

(function () {
  'use strict';

  if (window.AppTitle && window.AppTitle._initialized) {
    return;
  }

  /* ============================================================
     1. HELPERS
     ============================================================ */

  function log(level, msg, data) {
    var cfg = window.ITWS_CONFIG || {};
    if (level === 'error' || (cfg.DEBUG && level === 'debug')) {
      try {
        var args = ['[AppTitle]', msg];
        if (data !== undefined) args.push(data);
        if (level === 'error') console.error.apply(console, args);
        else console.log.apply(console, args);
      } catch (e) {}
    }
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
        return window.Labels.t(key, fallback);
      }
    } catch (e) {}
    return fallback;
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

  /* ============================================================
     2. META TAG HELPERS
     ============================================================ */

  function getOrCreateMeta(attribute, value) {
    if (!attribute || !value) return null;
    var selector = 'meta[' + attribute + '="' + value + '"]';
    var el = document.querySelector(selector);
    if (el) return el;

    el = document.createElement('meta');
    el.setAttribute(attribute, value);
    document.head.appendChild(el);
    return el;
  }

  function setMetaName(name, content) {
    if (!name) return;
    var el = getOrCreateMeta('name', name);
    if (el) el.setAttribute('content', content == null ? '' : String(content));
  }

  function setMetaProperty(prop, content) {
    if (!prop) return;
    var el = getOrCreateMeta('property', prop);
    if (el) el.setAttribute('content', content == null ? '' : String(content));
  }

  function getOrCreateLink(rel, extras) {
    var selector = 'link[rel="' + rel + '"]';
    var el = document.querySelector(selector);
    if (!el) {
      el = document.createElement('link');
      el.setAttribute('rel', rel);
      document.head.appendChild(el);
    }
    if (extras && typeof extras === 'object') {
      Object.keys(extras).forEach(function (k) {
        el.setAttribute(k, extras[k]);
      });
    }
    return el;
  }

  /* ============================================================
     3. PAGE CONTEXT
     ============================================================ */

  /**
   * Detect current page identifier from:
   * 1. <body data-page="...">
   * 2. <meta name="page-name" content="...">
   * 3. URL pathname (fallback)
   */
  function detectPageName() {
    try {
      // 1. body data-page
      var bodyPage = document.body && document.body.getAttribute('data-page');
      if (bodyPage) return bodyPage;

      // 2. meta name="page-name"
      var metaPage = document.querySelector('meta[name="page-name"]');
      if (metaPage) {
        var content = metaPage.getAttribute('content');
        if (content) return content;
      }
    } catch (e) {}

    // 3. URL pathname
    try {
      var path = window.location.pathname || '';
      var filename = path.split('/').pop() || '';
      filename = filename.replace(/\.html?$/i, '');
      if (filename) return filename;
    } catch (e) {}

    return '';
  }

  /**
   * Get page-specific title from label.
   * Tries: pages.<name>.title → falls back to page name
   */
  function getPageTitle(pageName) {
    if (!pageName) return '';

    var key = 'pages.' + pageName + '.title';
    var title = getLabel(key, '');
    if (title && title !== key) return title;

    // Fallback: page titles defined in settings
    var settingsTitle = getSetting('pages.titles.' + pageName, '');
    if (settingsTitle) return settingsTitle;

    return '';
  }

  /* ============================================================
     4. CORE UPDATES
     ============================================================ */

  function updateTitle() {
    var unionName = getSetting('app_identity.union_name', 'نقابة تكنولوجيا المعلومات والبرمجيات');
    var pageName = detectPageName();
    var pageTitle = getPageTitle(pageName);

    // Format: [Page Title] | [Union Name]  OR  [Union Name]
    var fullTitle;
    if (pageTitle && unionName) {
      fullTitle = pageTitle + ' | ' + unionName;
    } else if (pageTitle) {
      fullTitle = pageTitle;
    } else if (unionName) {
      fullTitle = unionName;
    } else {
      fullTitle = 'ITWS Platform';
    }

    if (document.title !== fullTitle) {
      document.title = fullTitle;
      log('debug', 'Title updated', fullTitle);
      return true;
    }
    return false;
  }

  function updateFavicon() {
    var logoUrl = getSetting('app_identity.logo_url', '');
    if (!logoUrl) return false;

    // Get or create main favicon
    var mainIcon = getOrCreateLink('icon');
    mainIcon.setAttribute('href', logoUrl);

    // Determine MIME type based on extension
    var ext = (logoUrl.split('.').pop() || '').toLowerCase().split('?')[0];
    var type = 'image/png';
    if (ext === 'svg') type = 'image/svg+xml';
    else if (ext === 'ico') type = 'image/x-icon';
    else if (ext === 'jpg' || ext === 'jpeg') type = 'image/jpeg';
    else if (ext === 'webp') type = 'image/webp';
    else if (ext === 'png') type = 'image/png';

    mainIcon.setAttribute('type', type);

    // Apple touch icon
    var appleIcon = getOrCreateLink('apple-touch-icon');
    appleIcon.setAttribute('href', logoUrl);

    // Shortcut icon
    var shortIcon = getOrCreateLink('shortcut icon');
    shortIcon.setAttribute('href', logoUrl);
    shortIcon.setAttribute('type', type);

    log('debug', 'Favicon updated', logoUrl);
    return true;
  }

  function updateMetaDescription() {
    var description = getSetting('app_identity.meta_description', '');
    if (!description) {
      var unionName = getSetting('app_identity.union_name', '');
      var committeeName = getSetting('app_identity.committee_name', '');
      if (unionName) {
        description = committeeName
          ? unionName + ' — ' + committeeName
          : unionName;
      }
    }

    if (description) {
      setMetaName('description', description);
    }

    return description;
  }

  function updateOGTags() {
    var unionName = getSetting('app_identity.union_name', '');
    var committeeName = getSetting('app_identity.committee_name', '');
    var logoUrl = getSetting('app_identity.logo_url', '');
    var websiteUrl = getSetting('app_identity.website_url', '');
    var pageName = detectPageName();
    var pageTitle = getPageTitle(pageName);

    // Title (page + union)
    var ogTitle = document.title || unionName;
    if (pageTitle && unionName) ogTitle = pageTitle + ' | ' + unionName;
    else if (unionName) ogTitle = unionName;

    setMetaProperty('og:title', ogTitle);
    setMetaProperty('og:site_name', unionName || 'ITWS Platform');
    setMetaProperty('og:type', 'website');

    // Description
    var description = getSetting('app_identity.meta_description', '');
    if (!description && committeeName && unionName) {
      description = unionName + ' — ' + committeeName;
    }
    if (description) {
      setMetaProperty('og:description', description);
    }

    // Image
    if (logoUrl) {
      setMetaProperty('og:image', logoUrl);
    }

    // URL
    if (websiteUrl) {
      setMetaProperty('og:url', websiteUrl);
    } else {
      try {
        setMetaProperty('og:url', window.location.href);
      } catch (e) {}
    }

    // Locale
    setMetaProperty('og:locale', 'ar_EG');

    log('debug', 'OG tags updated');
  }

  function updateTwitterTags() {
    var unionName = getSetting('app_identity.union_name', '');
    var logoUrl = getSetting('app_identity.logo_url', '');

    setMetaName('twitter:card', 'summary');
    setMetaName('twitter:title', document.title || unionName);
    if (logoUrl) {
      setMetaName('twitter:image', logoUrl);
    }

    var description = getSetting('app_identity.meta_description', '');
    if (description) {
      setMetaName('twitter:description', description);
    }
  }

  function updateThemeColorMeta() {
    // Read --bg CSS variable from current theme
    try {
      var bg = getComputedStyle(document.documentElement).getPropertyValue('--bg').trim();
      if (bg) {
        setMetaName('theme-color', bg);
      }
    } catch (e) {}
  }

  function updateAppManifest() {
    var unionName = getSetting('app_identity.union_name', '');
    if (!unionName) return;

    // Apple mobile web app title
    setMetaName('apple-mobile-web-app-title', unionName);
    setMetaName('application-name', unionName);

    // Apple mobile web app capable
    var metaApple = getOrCreateMeta('name', 'apple-mobile-web-app-capable');
    if (metaApple) metaApple.setAttribute('content', 'yes');

    var metaStatus = getOrCreateMeta('name', 'apple-mobile-web-app-status-bar-style');
    if (metaStatus) metaStatus.setAttribute('content', 'default');
  }

  function updateLangDir() {
    try {
      var lang = getSetting('behavior.language', 'ar');
      if (lang === 'en') {
        document.documentElement.setAttribute('lang', 'en');
        document.documentElement.setAttribute('dir', 'ltr');
      } else {
        document.documentElement.setAttribute('lang', 'ar');
        document.documentElement.setAttribute('dir', 'rtl');
      }
    } catch (e) {}
  }

  /* ============================================================
     5. MAIN UPDATE
     ============================================================ */

  function updateAll() {
    var changed = false;

    try {
      if (updateTitle()) changed = true;
    } catch (e) { log('error', 'updateTitle failed', e); }

    try { updateFavicon(); } catch (e) { log('error', 'updateFavicon failed', e); }
    try { updateMetaDescription(); } catch (e) { log('error', 'updateMetaDescription failed', e); }
    try { updateOGTags(); } catch (e) { log('error', 'updateOGTags failed', e); }
    try { updateTwitterTags(); } catch (e) { log('error', 'updateTwitterTags failed', e); }
    try { updateThemeColorMeta(); } catch (e) { log('error', 'updateThemeColorMeta failed', e); }
    try { updateAppManifest(); } catch (e) { log('error', 'updateAppManifest failed', e); }
    try { updateLangDir(); } catch (e) { log('error', 'updateLangDir failed', e); }

    dispatchEvent('itws:app-title-changed', {
      title: document.title,
      pageName: detectPageName()
    });

    return changed;
  }

  /* ============================================================
     6. LISTENERS
     ============================================================ */

  function setupSettingsListener() {
    try {
      if (window.AppSettings && typeof window.AppSettings.onChange === 'function') {
        window.AppSettings.onChange(function (settings, changedKey) {
          // Update on app_identity change, theme change, or full reload
          if (!changedKey ||
              changedKey === 'app_identity' ||
              changedKey === 'theme' ||
              changedKey === 'behavior') {
            updateAll();
          }
        });
      }
    } catch (e) {
      log('error', 'Settings listener failed', e);
    }

    // Global events
    window.addEventListener('itws:settings-changed', function (e) {
      var key = e && e.detail ? e.detail.key : null;
      if (!key || key === 'app_identity' || key === 'theme' || key === 'behavior') {
        updateAll();
      }
    });

    window.addEventListener('itws:theme-changed', function () {
      updateThemeColorMeta();
    });
  }

  function setupLabelsListener() {
    try {
      if (window.Labels && typeof window.Labels.onChange === 'function') {
        window.Labels.onChange(function (labels, changedKey) {
          // Update if the changed label affects the title
          if (!changedKey || (changedKey && changedKey.indexOf('pages.') === 0)) {
            updateTitle();
            updateOGTags();
            updateTwitterTags();
          }
        });
      }
    } catch (e) {
      log('error', 'Labels listener failed', e);
    }
  }

  /* ============================================================
     7. INIT
     ============================================================ */

  function init() {
    // Initial update (sync, no waiting)
    updateAll();

    // After AppSettings ready → re-update with real values
    var waitForSettings = function () {
      return new Promise(function (resolve) {
        if (window.AppSettings && typeof window.AppSettings.whenReady === 'function') {
          window.AppSettings.whenReady().then(resolve).catch(resolve);
        } else if (window.AppSettings && typeof window.AppSettings.isLoaded === 'function' && window.AppSettings.isLoaded()) {
          resolve();
        } else {
          // Wait for event with timeout
          var done = false;
          var handler = function () {
            if (done) return;
            done = true;
            window.removeEventListener('itws:settings-loaded', handler);
            resolve();
          };
          window.addEventListener('itws:settings-loaded', handler);
          setTimeout(function () {
            if (done) return;
            done = true;
            window.removeEventListener('itws:settings-loaded', handler);
            resolve();
          }, 3000);
        }
      });
    };

    waitForSettings().then(function () {
      updateAll();
      setupSettingsListener();
      setupLabelsListener();
    });

    // Also update on theme change
    window.addEventListener('itws:theme-mode-changed', function () {
      updateThemeColorMeta();
    });

    log('debug', 'AppTitle initialized', { page: detectPageName() });
  }

  /* ============================================================
     8. EXPORT
     ============================================================ */

  window.AppTitle = {
    _initialized: true,

    // Public API
    refresh: updateAll,
    updateTitle: updateTitle,
    updateFavicon: updateFavicon,
    updateMeta: function () {
      updateMetaDescription();
      updateOGTags();
      updateTwitterTags();
      updateAppManifest();
    },
    updateThemeColor: updateThemeColorMeta,

    // Query
    getPageName: detectPageName,
    getCurrentTitle: function () { return document.title; },

    // Manual override (for specific pages)
    setPageTitle: function (title) {
      if (!title) return;
      var unionName = getSetting('app_identity.union_name', '');
      document.title = unionName ? title + ' | ' + unionName : title;
      setMetaProperty('og:title', document.title);
      setMetaName('twitter:title', document.title);
      dispatchEvent('itws:app-title-changed', { title: document.title });
    }
  };

  // Boot
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  /* ============================================================
     9. DEBUG LOG
     ============================================================ */

  var cfg = window.ITWS_CONFIG || {};
  if (cfg.DEBUG) {
    try {
      console.log('%c[AppTitle]', 'color: #F59E0B; font-weight: bold;', 'Ready');
    } catch (e) {}
  }

})();
