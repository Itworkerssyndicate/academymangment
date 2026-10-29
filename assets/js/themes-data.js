/**
 * ================================================================
 * ITWS THEMES DATA — V7 (28 THEMES)
 * assets/js/themes-data.js
 * ================================================================
 * قاعدة بيانات الثيمات الكاملة للمنصة.
 *
 * - 8 ثيمات أساسية (core)
 * - 10 ثيمات مصرية (egyptian) — ألوان وطنية، فرعونية، جغرافية
 * - 10 ثيمات تكنولوجية (tech) — نيون، شبكات، مدن ذكية
 *
 * كل ثيم فيه 20+ token:
 *   id, name, nameEn, type, category
 *   accent, accent2, accentRgb, accent2Rgb
 *   bg, bg2, bg3, cardBg, cardBgSolid
 *   text, textMuted, textDim
 *   border, borderSoft, borderStrong
 *   glow, glow2, gradient
 *   success, successRgb, danger, dangerRgb
 *   warning, warningRgb, info, infoRgb
 *
 * الـ RGBs بتتحسب تلقائياً من الـ hex في نهاية الملف.
 *
 * ES5-safe. بدون إيموجي. مفيش hardcoded colors في الـ JS logic —
 * الألوان نفسها هي البيانات (data, not logic).
 * ================================================================
 */

(function () {
  'use strict';

  // =============================================================
  // Helpers
  // =============================================================

  function hexToRgb(hex) {
    if (!hex) { return '0,0,0'; }
    var h = String(hex).replace('#', '').trim();
    if (h.length === 3) {
      h = h[0] + h[0] + h[1] + h[1] + h[2] + h[2];
    }
    if (h.length !== 6) { return '0,0,0'; }
    var r = parseInt(h.substring(0, 2), 16);
    var g = parseInt(h.substring(2, 4), 16);
    var b = parseInt(h.substring(4, 6), 16);
    if (isNaN(r) || isNaN(g) || isNaN(b)) { return '0,0,0'; }
    return r + ',' + g + ',' + b;
  }

  // =============================================================
  // THEMES DATA — 28 themes
  // =============================================================

  var THEMES = {

    // ===========================================================
    // CATEGORY 1: CORE (8)
    // ===========================================================

    'neon-dark': {
      id: 'neon-dark',
      name: 'نيون داكن',
      nameEn: 'Neon Dark',
      type: 'dark',
      category: 'core',
      accent: '#00f0ff',
      accent2: '#b026ff',
      bg: '#0a0c14',
      bg2: '#0f1220',
      bg3: '#141829',
      cardBg: 'rgba(15,18,32,0.55)',
      cardBgSolid: '#0f1220',
      text: '#e8ecf4',
      textMuted: '#8a93a8',
      textDim: '#5a6378',
      border: 'rgba(0,240,255,0.10)',
      borderSoft: 'rgba(0,240,255,0.06)',
      borderStrong: 'rgba(0,240,255,0.22)',
      success: '#10b981',
      danger: '#ef4444',
      warning: '#f59e0b',
      info: '#3b82f6'
    },

    'neon-light': {
      id: 'neon-light',
      name: 'نيون فاتح',
      nameEn: 'Neon Light',
      type: 'light',
      category: 'core',
      accent: '#0099ff',
      accent2: '#a020f0',
      bg: '#f5f7fb',
      bg2: '#ffffff',
      bg3: '#eef1f8',
      cardBg: 'rgba(255,255,255,0.75)',
      cardBgSolid: '#ffffff',
      text: '#0f172a',
      textMuted: '#475569',
      textDim: '#94a3b8',
      border: 'rgba(0,153,255,0.15)',
      borderSoft: 'rgba(0,153,255,0.08)',
      borderStrong: 'rgba(0,153,255,0.30)',
      success: '#059669',
      danger: '#dc2626',
      warning: '#d97706',
      info: '#2563eb'
    },

    'cyberpunk': {
      id: 'cyberpunk',
      name: 'سايبر بانك',
      nameEn: 'Cyberpunk',
      type: 'dark',
      category: 'core',
      accent: '#ff0080',
      accent2: '#ffcc00',
      bg: '#0d0619',
      bg2: '#150a26',
      bg3: '#1e1033',
      cardBg: 'rgba(21,10,38,0.55)',
      cardBgSolid: '#150a26',
      text: '#f5e8ff',
      textMuted: '#a78bfa',
      textDim: '#7c3aed',
      border: 'rgba(255,0,128,0.15)',
      borderSoft: 'rgba(255,0,128,0.08)',
      borderStrong: 'rgba(255,0,128,0.30)',
      success: '#22d3ee',
      danger: '#f43f5e',
      warning: '#fbbf24',
      info: '#8b5cf6'
    },

    'emerald': {
      id: 'emerald',
      name: 'زمردي',
      nameEn: 'Emerald',
      type: 'dark',
      category: 'core',
      accent: '#10b981',
      accent2: '#fbbf24',
      bg: '#071410',
      bg2: '#0b1f18',
      bg3: '#0f2a20',
      cardBg: 'rgba(11,31,24,0.55)',
      cardBgSolid: '#0b1f18',
      text: '#ecfdf5',
      textMuted: '#6ee7b7',
      textDim: '#34d399',
      border: 'rgba(16,185,129,0.15)',
      borderSoft: 'rgba(16,185,129,0.08)',
      borderStrong: 'rgba(16,185,129,0.30)',
      success: '#22c55e',
      danger: '#ef4444',
      warning: '#fbbf24',
      info: '#06b6d4'
    },

    'royal': {
      id: 'royal',
      name: 'ملكي',
      nameEn: 'Royal',
      type: 'dark',
      category: 'core',
      accent: '#8b5cf6',
      accent2: '#06b6d4',
      bg: '#0a0618',
      bg2: '#120b26',
      bg3: '#1a1033',
      cardBg: 'rgba(18,11,38,0.55)',
      cardBgSolid: '#120b26',
      text: '#f3e8ff',
      textMuted: '#c4b5fd',
      textDim: '#a78bfa',
      border: 'rgba(139,92,246,0.15)',
      borderSoft: 'rgba(139,92,246,0.08)',
      borderStrong: 'rgba(139,92,246,0.30)',
      success: '#10b981',
      danger: '#f43f5e',
      warning: '#f59e0b',
      info: '#06b6d4'
    },

    'patriot': {
      id: 'patriot',
      name: 'وطني',
      nameEn: 'Patriot',
      type: 'dark',
      category: 'core',
      accent: '#e62e2e',
      accent2: '#d4af37',
      bg: '#0a0a0a',
      bg2: '#141414',
      bg3: '#1e1e1e',
      cardBg: 'rgba(20,20,20,0.55)',
      cardBgSolid: '#141414',
      text: '#f5f5f5',
      textMuted: '#a3a3a3',
      textDim: '#737373',
      border: 'rgba(230,46,46,0.15)',
      borderSoft: 'rgba(230,46,46,0.08)',
      borderStrong: 'rgba(230,46,46,0.30)',
      success: '#16a34a',
      danger: '#dc2626',
      warning: '#d97706',
      info: '#2563eb'
    },

    'tech-cairo': {
      id: 'tech-cairo',
      name: 'تك القاهرة',
      nameEn: 'Tech Cairo',
      type: 'dark',
      category: 'core',
      accent: '#e62e2e',
      accent2: '#d4af37',
      bg: '#1a0a0a',
      bg2: '#241010',
      bg3: '#2e1616',
      cardBg: 'rgba(36,16,16,0.55)',
      cardBgSolid: '#241010',
      text: '#fef2f2',
      textMuted: '#fca5a5',
      textDim: '#f87171',
      border: 'rgba(230,46,46,0.15)',
      borderSoft: 'rgba(230,46,46,0.08)',
      borderStrong: 'rgba(230,46,46,0.30)',
      success: '#16a34a',
      danger: '#dc2626',
      warning: '#d97706',
      info: '#2563eb'
    },

    'minimal': {
      id: 'minimal',
      name: 'بسيط فاتح',
      nameEn: 'Minimal Light',
      type: 'light',
      category: 'core',
      accent: '#e62e2e',
      accent2: '#1a1a1a',
      bg: '#ffffff',
      bg2: '#fafafa',
      bg3: '#f5f5f5',
      cardBg: 'rgba(250,250,250,0.75)',
      cardBgSolid: '#ffffff',
      text: '#0a0a0a',
      textMuted: '#525252',
      textDim: '#737373',
      border: 'rgba(230,46,46,0.15)',
      borderSoft: 'rgba(230,46,46,0.08)',
      borderStrong: 'rgba(230,46,46,0.30)',
      success: '#059669',
      danger: '#dc2626',
      warning: '#d97706',
      info: '#2563eb'
    },

    // ===========================================================
    // CATEGORY 2: EGYPTIAN (10)
    // ===========================================================

    'pharaoh-gold': {
      id: 'pharaoh-gold',
      name: 'ذهبي فرعوني',
      nameEn: 'Pharaoh Gold',
      type: 'dark',
      category: 'egyptian',
      accent: '#d4af37',
      accent2: '#1e40af',
      bg: '#0a0a0f',
      bg2: '#12121a',
      bg3: '#1a1a24',
      cardBg: 'rgba(18,18,26,0.55)',
      cardBgSolid: '#12121a',
      text: '#fef9e7',
      textMuted: '#e5d3a0',
      textDim: '#b8a76a',
      border: 'rgba(212,175,55,0.15)',
      borderSoft: 'rgba(212,175,55,0.08)',
      borderStrong: 'rgba(212,175,55,0.30)',
      success: '#16a34a',
      danger: '#dc2626',
      warning: '#f59e0b',
      info: '#2563eb'
    },

    'kemet': {
      id: 'kemet',
      name: 'كيميت',
      nameEn: 'Kemet',
      type: 'dark',
      category: 'egyptian',
      accent: '#fbbf24',
      accent2: '#dc2626',
      bg: '#000000',
      bg2: '#0a0505',
      bg3: '#141010',
      cardBg: 'rgba(10,5,5,0.65)',
      cardBgSolid: '#0a0505',
      text: '#fef3c7',
      textMuted: '#fcd34d',
      textDim: '#f59e0b',
      border: 'rgba(251,191,36,0.18)',
      borderSoft: 'rgba(251,191,36,0.10)',
      borderStrong: 'rgba(251,191,36,0.35)',
      success: '#22c55e',
      danger: '#dc2626',
      warning: '#f59e0b',
      info: '#3b82f6'
    },

    'nile-delta': {
      id: 'nile-delta',
      name: 'دلتا النيل',
      nameEn: 'Nile Delta',
      type: 'light',
      category: 'egyptian',
      accent: '#0ea5e9',
      accent2: '#22c55e',
      bg: '#f0fdf4',
      bg2: '#ffffff',
      bg3: '#e0f2fe',
      cardBg: 'rgba(255,255,255,0.80)',
      cardBgSolid: '#ffffff',
      text: '#052e16',
      textMuted: '#166534',
      textDim: '#15803d',
      border: 'rgba(14,165,233,0.18)',
      borderSoft: 'rgba(14,165,233,0.10)',
      borderStrong: 'rgba(14,165,233,0.35)',
      success: '#16a34a',
      danger: '#dc2626',
      warning: '#d97706',
      info: '#0284c7'
    },

    'hieroglyph': {
      id: 'hieroglyph',
      name: 'هيروغليفي',
      nameEn: 'Hieroglyph',
      type: 'dark',
      category: 'egyptian',
      accent: '#06b6d4',
      accent2: '#fbbf24',
      bg: '#050508',
      bg2: '#0d0d14',
      bg3: '#141420',
      cardBg: 'rgba(13,13,20,0.60)',
      cardBgSolid: '#0d0d14',
      text: '#ecfeff',
      textMuted: '#67e8f9',
      textDim: '#22d3ee',
      border: 'rgba(6,182,212,0.16)',
      borderSoft: 'rgba(6,182,212,0.08)',
      borderStrong: 'rgba(6,182,212,0.32)',
      success: '#10b981',
      danger: '#ef4444',
      warning: '#fbbf24',
      info: '#22d3ee'
    },

    'papyrus': {
      id: 'papyrus',
      name: 'بردية',
      nameEn: 'Papyrus',
      type: 'light',
      category: 'egyptian',
      accent: '#b45309',
      accent2: '#d97706',
      bg: '#fef3c7',
      bg2: '#fffbeb',
      bg3: '#fde68a',
      cardBg: 'rgba(255,251,235,0.85)',
      cardBgSolid: '#fffbeb',
      text: '#451a03',
      textMuted: '#78350f',
      textDim: '#92400e',
      border: 'rgba(180,83,9,0.18)',
      borderSoft: 'rgba(180,83,9,0.10)',
      borderStrong: 'rgba(180,83,9,0.35)',
      success: '#15803d',
      danger: '#b91c1c',
      warning: '#b45309',
      info: '#0369a1'
    },

    'luxor-temple': {
      id: 'luxor-temple',
      name: 'معبد الأقصر',
      nameEn: 'Luxor Temple',
      type: 'dark',
      category: 'egyptian',
      accent: '#d97706',
      accent2: '#1e40af',
      bg: '#1a0f0a',
      bg2: '#241812',
      bg3: '#2e201a',
      cardBg: 'rgba(36,24,18,0.55)',
      cardBgSolid: '#241812',
      text: '#fef3c7',
      textMuted: '#fcd34d',
      textDim: '#d97706',
      border: 'rgba(217,119,6,0.18)',
      borderSoft: 'rgba(217,119,6,0.10)',
      borderStrong: 'rgba(217,119,6,0.35)',
      success: '#16a34a',
      danger: '#dc2626',
      warning: '#f59e0b',
      info: '#2563eb'
    },

    'alexandria': {
      id: 'alexandria',
      name: 'إسكندرية',
      nameEn: 'Alexandria',
      type: 'light',
      category: 'egyptian',
      accent: '#0891b2',
      accent2: '#fbbf24',
      bg: '#f0f9ff',
      bg2: '#ffffff',
      bg3: '#e0f2fe',
      cardBg: 'rgba(255,255,255,0.80)',
      cardBgSolid: '#ffffff',
      text: '#0c4a6e',
      textMuted: '#0369a1',
      textDim: '#0284c7',
      border: 'rgba(8,145,178,0.18)',
      borderSoft: 'rgba(8,145,178,0.10)',
      borderStrong: 'rgba(8,145,178,0.35)',
      success: '#059669',
      danger: '#dc2626',
      warning: '#d97706',
      info: '#0284c7'
    },

    'sinai-copper': {
      id: 'sinai-copper',
      name: 'سيناء النحاسي',
      nameEn: 'Sinai Copper',
      type: 'dark',
      category: 'egyptian',
      accent: '#ea580c',
      accent2: '#14b8a6',
      bg: '#14080a',
      bg2: '#1e0e0e',
      bg3: '#281414',
      cardBg: 'rgba(30,14,14,0.55)',
      cardBgSolid: '#1e0e0e',
      text: '#fff7ed',
      textMuted: '#fdba74',
      textDim: '#fb923c',
      border: 'rgba(234,88,12,0.18)',
      borderSoft: 'rgba(234,88,12,0.10)',
      borderStrong: 'rgba(234,88,12,0.35)',
      success: '#10b981',
      danger: '#f43f5e',
      warning: '#f59e0b',
      info: '#06b6d4'
    },

    'red-sea': {
      id: 'red-sea',
      name: 'البحر الأحمر',
      nameEn: 'Red Sea',
      type: 'dark',
      category: 'egyptian',
      accent: '#dc2626',
      accent2: '#06b6d4',
      bg: '#0a0505',
      bg2: '#140808',
      bg3: '#1e0c0c',
      cardBg: 'rgba(20,8,8,0.60)',
      cardBgSolid: '#140808',
      text: '#fef2f2',
      textMuted: '#fca5a5',
      textDim: '#f87171',
      border: 'rgba(220,38,38,0.18)',
      borderSoft: 'rgba(220,38,38,0.10)',
      borderStrong: 'rgba(220,38,38,0.35)',
      success: '#10b981',
      danger: '#ef4444',
      warning: '#f59e0b',
      info: '#06b6d4'
    },

    'ramses': {
      id: 'ramses',
      name: 'رمسيس',
      nameEn: 'Ramses',
      type: 'dark',
      category: 'egyptian',
      accent: '#fbbf24',
      accent2: '#991b1b',
      bg: '#0f0a05',
      bg2: '#1a120a',
      bg3: '#241a10',
      cardBg: 'rgba(26,18,10,0.55)',
      cardBgSolid: '#1a120a',
      text: '#fef9e7',
      textMuted: '#fcd34d',
      textDim: '#f59e0b',
      border: 'rgba(251,191,36,0.20)',
      borderSoft: 'rgba(251,191,36,0.10)',
      borderStrong: 'rgba(251,191,36,0.38)',
      success: '#16a34a',
      danger: '#b91c1c',
      warning: '#d97706',
      info: '#2563eb'
    },

    // ===========================================================
    // CATEGORY 3: TECH (10)
    // ===========================================================

    'national-tech': {
      id: 'national-tech',
      name: 'وطني تكنولوجي',
      nameEn: 'National Tech',
      type: 'dark',
      category: 'tech',
      accent: '#dc2626',
      accent2: '#06b6d4',
      bg: '#0a0a0a',
      bg2: '#141414',
      bg3: '#1e1e1e',
      cardBg: 'rgba(20,20,20,0.60)',
      cardBgSolid: '#141414',
      text: '#fafafa',
      textMuted: '#a3a3a3',
      textDim: '#737373',
      border: 'rgba(220,38,38,0.18)',
      borderSoft: 'rgba(220,38,38,0.10)',
      borderStrong: 'rgba(220,38,38,0.35)',
      success: '#10b981',
      danger: '#ef4444',
      warning: '#f59e0b',
      info: '#06b6d4'
    },

    'cairo-neon': {
      id: 'cairo-neon',
      name: 'القاهرة النيون',
      nameEn: 'Cairo Neon',
      type: 'dark',
      category: 'tech',
      accent: '#a855f7',
      accent2: '#fbbf24',
      bg: '#0a0514',
      bg2: '#120a1e',
      bg3: '#1a1028',
      cardBg: 'rgba(18,10,30,0.55)',
      cardBgSolid: '#120a1e',
      text: '#faf5ff',
      textMuted: '#d8b4fe',
      textDim: '#c084fc',
      border: 'rgba(168,85,247,0.18)',
      borderSoft: 'rgba(168,85,247,0.10)',
      borderStrong: 'rgba(168,85,247,0.35)',
      success: '#10b981',
      danger: '#f43f5e',
      warning: '#fbbf24',
      info: '#06b6d4'
    },

    'smart-village': {
      id: 'smart-village',
      name: 'القرية الذكية',
      nameEn: 'Smart Village',
      type: 'dark',
      category: 'tech',
      accent: '#8b5cf6',
      accent2: '#06b6d4',
      bg: '#0a0618',
      bg2: '#120b26',
      bg3: '#1a1033',
      cardBg: 'rgba(18,11,38,0.55)',
      cardBgSolid: '#120b26',
      text: '#f5f3ff',
      textMuted: '#c4b5fd',
      textDim: '#a78bfa',
      border: 'rgba(139,92,246,0.18)',
      borderSoft: 'rgba(139,92,246,0.10)',
      borderStrong: 'rgba(139,92,246,0.35)',
      success: '#10b981',
      danger: '#f43f5e',
      warning: '#f59e0b',
      info: '#06b6d4'
    },

    'suez-tech': {
      id: 'suez-tech',
      name: 'قناة السويس تك',
      nameEn: 'Suez Tech',
      type: 'dark',
      category: 'tech',
      accent: '#0284c7',
      accent2: '#06b6d4',
      bg: '#020617',
      bg2: '#0a1220',
      bg3: '#121a28',
      cardBg: 'rgba(10,18,32,0.55)',
      cardBgSolid: '#0a1220',
      text: '#f0f9ff',
      textMuted: '#7dd3fc',
      textDim: '#38bdf8',
      border: 'rgba(2,132,199,0.18)',
      borderSoft: 'rgba(2,132,199,0.10)',
      borderStrong: 'rgba(2,132,199,0.35)',
      success: '#10b981',
      danger: '#ef4444',
      warning: '#f59e0b',
      info: '#22d3ee'
    },

    'neon-nile': {
      id: 'neon-nile',
      name: 'النيل النيون',
      nameEn: 'Neon Nile',
      type: 'dark',
      category: 'tech',
      accent: '#00f0ff',
      accent2: '#10b981',
      bg: '#02120f',
      bg2: '#061a16',
      bg3: '#0a221d',
      cardBg: 'rgba(6,26,22,0.55)',
      cardBgSolid: '#061a16',
      text: '#ecfeff',
      textMuted: '#6ee7b7',
      textDim: '#22d3ee',
      border: 'rgba(0,240,255,0.18)',
      borderSoft: 'rgba(0,240,255,0.10)',
      borderStrong: 'rgba(0,240,255,0.35)',
      success: '#22c55e',
      danger: '#ef4444',
      warning: '#f59e0b',
      info: '#38bdf8'
    },

    'delta-green': {
      id: 'delta-green',
      name: 'الدلتا الخضراء',
      nameEn: 'Delta Green',
      type: 'dark',
      category: 'tech',
      accent: '#16a34a',
      accent2: '#fbbf24',
      bg: '#04140a',
      bg2: '#0a1e12',
      bg3: '#10281a',
      cardBg: 'rgba(10,30,18,0.55)',
      cardBgSolid: '#0a1e12',
      text: '#f0fdf4',
      textMuted: '#86efac',
      textDim: '#4ade80',
      border: 'rgba(22,163,74,0.18)',
      borderSoft: 'rgba(22,163,74,0.10)',
      borderStrong: 'rgba(22,163,74,0.35)',
      success: '#22c55e',
      danger: '#ef4444',
      warning: '#fbbf24',
      info: '#06b6d4'
    },

    'pyramids-dawn': {
      id: 'pyramids-dawn',
      name: 'فجر الأهرامات',
      nameEn: 'Pyramids Dawn',
      type: 'dark',
      category: 'tech',
      accent: '#f97316',
      accent2: '#ec4899',
      bg: '#1a0a14',
      bg2: '#24101c',
      bg3: '#2e1624',
      cardBg: 'rgba(36,16,28,0.55)',
      cardBgSolid: '#24101c',
      text: '#fff7ed',
      textMuted: '#fdba74',
      textDim: '#fb923c',
      border: 'rgba(249,115,22,0.18)',
      borderSoft: 'rgba(249,115,22,0.10)',
      borderStrong: 'rgba(249,115,22,0.35)',
      success: '#10b981',
      danger: '#f43f5e',
      warning: '#fbbf24',
      info: '#06b6d4'
    },

    'octagon-tech': {
      id: 'octagon-tech',
      name: 'أوكتاجون تك',
      nameEn: 'Octagon Tech',
      type: 'dark',
      category: 'tech',
      accent: '#dc2626',
      accent2: '#eab308',
      bg: '#0a0a0a',
      bg2: '#141010',
      bg3: '#1e1818',
      cardBg: 'rgba(20,16,16,0.60)',
      cardBgSolid: '#141010',
      text: '#fafafa',
      textMuted: '#a3a3a3',
      textDim: '#737373',
      border: 'rgba(220,38,38,0.18)',
      borderSoft: 'rgba(220,38,38,0.10)',
      borderStrong: 'rgba(220,38,38,0.35)',
      success: '#16a34a',
      danger: '#ef4444',
      warning: '#eab308',
      info: '#2563eb'
    },

    'mediterranean': {
      id: 'mediterranean',
      name: 'البحر المتوسط',
      nameEn: 'Mediterranean',
      type: 'light',
      category: 'tech',
      accent: '#0ea5e9',
      accent2: '#14b8a6',
      bg: '#f0f9ff',
      bg2: '#ffffff',
      bg3: '#e0f2fe',
      cardBg: 'rgba(255,255,255,0.80)',
      cardBgSolid: '#ffffff',
      text: '#0c4a6e',
      textMuted: '#0369a1',
      textDim: '#0284c7',
      border: 'rgba(14,165,233,0.18)',
      borderSoft: 'rgba(14,165,233,0.10)',
      borderStrong: 'rgba(14,165,233,0.35)',
      success: '#059669',
      danger: '#dc2626',
      warning: '#d97706',
      info: '#0284c7'
    },

    'deshret': {
      id: 'deshret',
      name: 'دشرت',
      nameEn: 'Deshret',
      type: 'dark',
      category: 'tech',
      accent: '#dc2626',
      accent2: '#fbbf24',
      bg: '#1a0a0a',
      bg2: '#241010',
      bg3: '#2e1616',
      cardBg: 'rgba(36,16,16,0.55)',
      cardBgSolid: '#241010',
      text: '#fef2f2',
      textMuted: '#fca5a5',
      textDim: '#f87171',
      border: 'rgba(220,38,38,0.18)',
      borderSoft: 'rgba(220,38,38,0.10)',
      borderStrong: 'rgba(220,38,38,0.35)',
      success: '#16a34a',
      danger: '#dc2626',
      warning: '#fbbf24',
      info: '#2563eb'
    }

  };

  // =============================================================
  // Post-process: احسب الـ RGBs + gradients + glows
  // =============================================================

  var themeIds = [];
  var key;

  for (key in THEMES) {
    if (!Object.prototype.hasOwnProperty.call(THEMES, key)) { continue; }
    themeIds.push(key);

    var t = THEMES[key];

    // RGB
    t.accentRgb  = hexToRgb(t.accent);
    t.accent2Rgb = hexToRgb(t.accent2);
    t.successRgb = hexToRgb(t.success);
    t.dangerRgb  = hexToRgb(t.danger);
    t.warningRgb = hexToRgb(t.warning);
    t.infoRgb    = hexToRgb(t.info);

    // Glow (box-shadow ready)
    t.glow  = '0 0 24px rgba(' + t.accentRgb  + ',0.35)';
    t.glow2 = '0 0 24px rgba(' + t.accent2Rgb + ',0.30)';

    // Gradient
    t.gradient = 'linear-gradient(135deg,' + t.accent + ' 0%,' + t.accent2 + ' 100%)';

    // isDark flag (سريع)
    t.isDark = t.type === 'dark';
  }

  // ترتيب: core → egyptian → tech
  var orderedThemes = {};
  var i;
  var orderGroups = ['core', 'egyptian', 'tech'];
  var g;

  for (g = 0; g < orderGroups.length; g++) {
    var group = orderGroups[g];
    for (i = 0; i < themeIds.length; i++) {
      var id = themeIds[i];
      if (THEMES[id].category === group) {
        orderedThemes[id] = THEMES[id];
      }
    }
  }

  // =============================================================
  // Public API
  // =============================================================

  function getAllThemes() {
    var out = [];
    for (var id in orderedThemes) {
      if (Object.prototype.hasOwnProperty.call(orderedThemes, id)) {
        out.push(orderedThemes[id]);
      }
    }
    return out;
  }

  function getTheme(id) {
    if (!id) { return null; }
    return orderedThemes[id] || null;
  }

  function getThemesByCategory(cat) {
    var out = [];
    for (var id in orderedThemes) {
      if (Object.prototype.hasOwnProperty.call(orderedThemes, id)) {
        if (orderedThemes[id].category === cat) {
          out.push(orderedThemes[id]);
        }
      }
    }
    return out;
  }

  function getDefaultTheme() {
    try {
      if (window.ITWS_SETTINGS_DEFAULTS &&
          window.ITWS_SETTINGS_DEFAULTS.theme &&
          window.ITWS_SETTINGS_DEFAULTS.theme.default_theme) {
        var def = window.ITWS_SETTINGS_DEFAULTS.theme.default_theme;
        if (orderedThemes[def]) { return orderedThemes[def]; }
      }
    } catch (e) {}
    return orderedThemes['neon-dark'] || null;
  }

  function getThemeIds() {
    return themeIds.slice();
  }

  function getCategoryLabels() {
    return {
      core:     'الأساسية',
      egyptian: 'المصرية',
      tech:     'التكنولوجية'
    };
  }

  function getThemeCount() {
    return themeIds.length;
  }

  function hasTheme(id) {
    return !!orderedThemes[id];
  }

  // =============================================================
  // Export
  // =============================================================

  window.ITWS_THEMES = orderedThemes;

  window.ThemesData = {
    all:                getAllThemes,
    get:                getTheme,
    byCategory:         getThemesByCategory,
    getDefault:         getDefaultTheme,
    getIds:             getThemeIds,
    getCategoryLabels:  getCategoryLabels,
    count:              getThemeCount,
    has:                hasTheme,
    hexToRgb:           hexToRgb
  };

  // Aliases للتوافق مع كود قديم
  window.ITWS_THEMES_META = {
    categories:   ['core', 'egyptian', 'tech'],
    labels:       getCategoryLabels(),
    total:        themeIds.length,
    schemaVersion: 'themes.v7'
  };

})();
