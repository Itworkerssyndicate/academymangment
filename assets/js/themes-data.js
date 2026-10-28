/* ============================================================
   ITWS Platform — Themes Data V5 (8 themes - accent system)
   File: assets/js/themes-data.js
   ============================================================ */

(function () {
  'use strict';

  if (window.ITWS_THEMES) return;

  var THEMES = [
    {
      id: 'neon-dark',
      name_ar: 'نيون داكن',
      name_en: 'Neon Dark',
      is_dark: true,
      is_default: true,
      accent: '#00f0ff',
      accent2: '#b026ff',
      bg: '#0a0c14',
      order_index: 1
    },
    {
      id: 'neon-light',
      name_ar: 'نيون فاتح',
      name_en: 'Neon Light',
      is_dark: false,
      is_default: false,
      accent: '#0099ff',
      accent2: '#a020f0',
      bg: '#f5f7fb',
      order_index: 2
    },
    {
      id: 'cyberpunk',
      name_ar: 'سايبر بانك',
      name_en: 'Cyberpunk',
      is_dark: true,
      is_default: false,
      accent: '#ff0080',
      accent2: '#ffcc00',
      bg: '#0d0619',
      order_index: 3
    },
    {
      id: 'emerald',
      name_ar: 'زمردي',
      name_en: 'Emerald',
      is_dark: true,
      is_default: false,
      accent: '#10b981',
      accent2: '#fbbf24',
      bg: '#071410',
      order_index: 4
    },
    {
      id: 'royal',
      name_ar: 'ملكي',
      name_en: 'Royal',
      is_dark: true,
      is_default: false,
      accent: '#8b5cf6',
      accent2: '#06b6d4',
      bg: '#0a0618',
      order_index: 5
    },
    {
      id: 'patriot',
      name_ar: 'وطني',
      name_en: 'Patriot',
      is_dark: true,
      is_default: false,
      accent: '#e62e2e',
      accent2: '#d4af37',
      bg: '#0a0a0a',
      order_index: 6
    },
    {
      id: 'tech-cairo',
      name_ar: 'تك القاهرة',
      name_en: 'Tech Cairo',
      is_dark: true,
      is_default: false,
      accent: '#e62e2e',
      accent2: '#d4af37',
      bg: '#1a0a0a',
      order_index: 7
    },
    {
      id: 'minimal',
      name_ar: 'بسيط فاتح',
      name_en: 'Minimal',
      is_dark: false,
      is_default: false,
      accent: '#e62e2e',
      accent2: '#1a1a1a',
      bg: '#ffffff',
      order_index: 8
    }
  ];

  var MAP = {};
  for (var i = 0; i < THEMES.length; i++) {
    MAP[THEMES[i].id] = THEMES[i];
  }

  window.ITWS_THEMES = THEMES;
  window.ITWS_THEMES_MAP = MAP;
  window.ITWS_DEFAULT_THEME = 'neon-dark';

  window.ITWS_THEMES_HELPERS = {
    getTheme: function (id) { return MAP[id] || null; },
    getAllThemes: function () { return THEMES.slice(); },
    getDefaultId: function () { return 'neon-dark'; },
    isDark: function (id) {
      var t = MAP[id];
      return t ? t.is_dark === true : true;
    },
    isValidTheme: function (id) { return !!MAP[id]; },
    getSwatchColors: function (id) {
      var t = MAP[id];
      if (!t) return { accent: '#00f0ff', accent2: '#b026ff', bg: '#0a0c14', is_dark: true };
      return {
        accent: t.accent,
        accent2: t.accent2,
        bg: t.bg,
        is_dark: t.is_dark
      };
    }
  };

  try {
    console.log('%c[ThemesData]', 'color: #00f0ff; font-weight: bold;',
      THEMES.length + ' themes loaded');
  } catch (e) {}

})();
