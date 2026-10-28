/* ============================================================
   ITWS Platform — Themes Data V2
   File: assets/js/themes-data.js
   Description: 17 themes with full color palettes + helpers
   Load order: BEFORE theme.js (which applies them)
   Depends on: NOTHING (pure data + helpers)

   Features:
   - 17 themes (16 manual + 1 system)
   - Full CSS variables per theme
   - Swatch colors for theme picker UI
   - Dark/light detection
   - System theme resolution (prefers-color-scheme)
   - Matches supabase/seed.sql exactly

   Rules:
   - No emoji
   - ES5-style IIFE
   - Pure data — no DOM manipulation
   ============================================================ */

(function () {
  'use strict';

  if (window.ITWS_THEMES) return;

  /* ============================================================
     THEME DATA — 17 THEMES
     Colors match supabase/seed.sql exactly
     ============================================================ */

  var THEMES_ARRAY = [

    // ========================================================
    // 1. watanii_dark (DEFAULT)
    // ========================================================
    {
      id: 'watanii_dark',
      name_ar: 'وطني داكن',
      name_en: 'National Dark',
      description_ar: 'أحمر مصر على أسود داكن',
      is_dark: true,
      is_default: true,
      is_system: false,
      order_index: 1,
      colors: {
        '--primary': '#CE1126',
        '--primary-hover': '#E63946',
        '--primary-soft': 'rgba(206,17,38,0.14)',
        '--primary-text': '#FFFFFF',
        '--bg': '#0A0E14',
        '--bg-alt': '#05080D',
        '--surface': '#131820',
        '--surface-elevated': '#1C2430',
        '--surface-hover': '#252F3D',
        '--text': '#F8FAFC',
        '--text-secondary': '#94A3B8',
        '--text-muted': '#64748B',
        '--border': 'rgba(255,255,255,0.08)',
        '--border-strong': 'rgba(255,255,255,0.15)',
        '--success': '#10B981',
        '--success-soft': 'rgba(16,185,129,0.14)',
        '--warning': '#F59E0B',
        '--warning-soft': 'rgba(245,158,11,0.14)',
        '--error': '#EF4444',
        '--error-soft': 'rgba(239,68,68,0.14)',
        '--info': '#3B82F6',
        '--info-soft': 'rgba(59,130,246,0.14)',
        '--shadow': '0 1px 3px rgba(0,0,0,0.3)',
        '--shadow-lg': '0 10px 40px rgba(0,0,0,0.4)'
      }
    },

    // ========================================================
    // 2. watanii_light
    // ========================================================
    {
      id: 'watanii_light',
      name_ar: 'وطني فاتح',
      name_en: 'National Light',
      description_ar: 'أحمر مصر على أبيض',
      is_dark: false,
      is_default: false,
      is_system: false,
      order_index: 2,
      colors: {
        '--primary': '#CE1126',
        '--primary-hover': '#B90F1F',
        '--primary-soft': 'rgba(206,17,38,0.1)',
        '--primary-text': '#FFFFFF',
        '--bg': '#FFFFFF',
        '--bg-alt': '#F8FAFC',
        '--surface': '#F1F5F9',
        '--surface-elevated': '#FFFFFF',
        '--surface-hover': '#E2E8F0',
        '--text': '#0A0E14',
        '--text-secondary': '#475569',
        '--text-muted': '#64748B',
        '--border': 'rgba(0,0,0,0.08)',
        '--border-strong': 'rgba(0,0,0,0.15)',
        '--success': '#059669',
        '--success-soft': 'rgba(5,150,105,0.1)',
        '--warning': '#D97706',
        '--warning-soft': 'rgba(217,119,6,0.1)',
        '--error': '#DC2626',
        '--error-soft': 'rgba(220,38,38,0.1)',
        '--info': '#2563EB',
        '--info-soft': 'rgba(37,99,235,0.1)',
        '--shadow': '0 1px 3px rgba(0,0,0,0.08)',
        '--shadow-lg': '0 10px 40px rgba(0,0,0,0.12)'
      }
    },

    // ========================================================
    // 3. tech_blue
    // ========================================================
    {
      id: 'tech_blue',
      name_ar: 'تكنولوجي أزرق',
      name_en: 'Tech Blue',
      description_ar: 'أزرق كهربائي على داكن',
      is_dark: true,
      is_default: false,
      is_system: false,
      order_index: 3,
      colors: {
        '--primary': '#3B82F6',
        '--primary-hover': '#2563EB',
        '--primary-soft': 'rgba(59,130,246,0.14)',
        '--primary-text': '#FFFFFF',
        '--bg': '#0F172A',
        '--bg-alt': '#080E1F',
        '--surface': '#1E293B',
        '--surface-elevated': '#293548',
        '--surface-hover': '#334155',
        '--text': '#F8FAFC',
        '--text-secondary': '#94A3B8',
        '--text-muted': '#64748B',
        '--border': 'rgba(255,255,255,0.08)',
        '--border-strong': 'rgba(255,255,255,0.15)',
        '--success': '#10B981',
        '--success-soft': 'rgba(16,185,129,0.14)',
        '--warning': '#F59E0B',
        '--warning-soft': 'rgba(245,158,11,0.14)',
        '--error': '#EF4444',
        '--error-soft': 'rgba(239,68,68,0.14)',
        '--info': '#06B6D4',
        '--info-soft': 'rgba(6,182,212,0.14)',
        '--shadow': '0 1px 3px rgba(0,0,0,0.3)',
        '--shadow-lg': '0 10px 40px rgba(0,0,0,0.4)'
      }
    },

    // ========================================================
    // 4. tech_purple
    // ========================================================
    {
      id: 'tech_purple',
      name_ar: 'تكنولوجي بنفسجي',
      name_en: 'Tech Purple',
      description_ar: 'بنفسجي نيون',
      is_dark: true,
      is_default: false,
      is_system: false,
      order_index: 4,
      colors: {
        '--primary': '#8B5CF6',
        '--primary-hover': '#7C3AED',
        '--primary-soft': 'rgba(139,92,246,0.14)',
        '--primary-text': '#FFFFFF',
        '--bg': '#0F0A1F',
        '--bg-alt': '#080514',
        '--surface': '#1E1535',
        '--surface-elevated': '#2A1F47',
        '--surface-hover': '#362A5C',
        '--text': '#F8FAFC',
        '--text-secondary': '#A5B4FC',
        '--text-muted': '#7C7C9F',
        '--border': 'rgba(255,255,255,0.08)',
        '--border-strong': 'rgba(255,255,255,0.15)',
        '--success': '#10B981',
        '--success-soft': 'rgba(16,185,129,0.14)',
        '--warning': '#F59E0B',
        '--warning-soft': 'rgba(245,158,11,0.14)',
        '--error': '#EF4444',
        '--error-soft': 'rgba(239,68,68,0.14)',
        '--info': '#06B6D4',
        '--info-soft': 'rgba(6,182,212,0.14)',
        '--shadow': '0 1px 3px rgba(0,0,0,0.3)',
        '--shadow-lg': '0 10px 40px rgba(0,0,0,0.4)'
      }
    },

    // ========================================================
    // 5. midnight_gold
    // ========================================================
    {
      id: 'midnight_gold',
      name_ar: 'ليلي ذهبي',
      name_en: 'Midnight Gold',
      description_ar: 'ذهبي فاخر على أسود',
      is_dark: true,
      is_default: false,
      is_system: false,
      order_index: 5,
      colors: {
        '--primary': '#D4AF37',
        '--primary-hover': '#B8942E',
        '--primary-soft': 'rgba(212,175,55,0.14)',
        '--primary-text': '#0B0B12',
        '--bg': '#0B0B12',
        '--bg-alt': '#050508',
        '--surface': '#161623',
        '--surface-elevated': '#20202E',
        '--surface-hover': '#2B2B3D',
        '--text': '#F5F0DC',
        '--text-secondary': '#A8A285',
        '--text-muted': '#6B6950',
        '--border': 'rgba(212,175,55,0.12)',
        '--border-strong': 'rgba(212,175,55,0.25)',
        '--success': '#10B981',
        '--success-soft': 'rgba(16,185,129,0.14)',
        '--warning': '#F59E0B',
        '--warning-soft': 'rgba(245,158,11,0.14)',
        '--error': '#EF4444',
        '--error-soft': 'rgba(239,68,68,0.14)',
        '--info': '#3B82F6',
        '--info-soft': 'rgba(59,130,246,0.14)',
        '--shadow': '0 1px 3px rgba(0,0,0,0.4)',
        '--shadow-lg': '0 10px 40px rgba(0,0,0,0.5)'
      }
    },

    // ========================================================
    // 6. royal_purple
    // ========================================================
    {
      id: 'royal_purple',
      name_ar: 'ملكي بنفسجي',
      name_en: 'Royal Purple',
      description_ar: 'بنفسجي ملكي غامق',
      is_dark: true,
      is_default: false,
      is_system: false,
      order_index: 6,
      colors: {
        '--primary': '#7C3AED',
        '--primary-hover': '#6D28D9',
        '--primary-soft': 'rgba(124,58,237,0.14)',
        '--primary-text': '#FFFFFF',
        '--bg': '#1A0B2E',
        '--bg-alt': '#0F0519',
        '--surface': '#241141',
        '--surface-elevated': '#301858',
        '--surface-hover': '#3D1F70',
        '--text': '#F8FAFC',
        '--text-secondary': '#C4B5FD',
        '--text-muted': '#8B7AAE',
        '--border': 'rgba(255,255,255,0.08)',
        '--border-strong': 'rgba(255,255,255,0.15)',
        '--success': '#10B981',
        '--success-soft': 'rgba(16,185,129,0.14)',
        '--warning': '#F59E0B',
        '--warning-soft': 'rgba(245,158,11,0.14)',
        '--error': '#EF4444',
        '--error-soft': 'rgba(239,68,68,0.14)',
        '--info': '#3B82F6',
        '--info-soft': 'rgba(59,130,246,0.14)',
        '--shadow': '0 1px 3px rgba(0,0,0,0.4)',
        '--shadow-lg': '0 10px 40px rgba(0,0,0,0.5)'
      }
    },

    // ========================================================
    // 7. emerald_dark
    // ========================================================
    {
      id: 'emerald_dark',
      name_ar: 'زمردي داكن',
      name_en: 'Emerald Dark',
      description_ar: 'أخضر زمردي على داكن',
      is_dark: true,
      is_default: false,
      is_system: false,
      order_index: 7,
      colors: {
        '--primary': '#10B981',
        '--primary-hover': '#059669',
        '--primary-soft': 'rgba(16,185,129,0.14)',
        '--primary-text': '#FFFFFF',
        '--bg': '#0B1917',
        '--bg-alt': '#05100E',
        '--surface': '#122320',
        '--surface-elevated': '#1A2F2B',
        '--surface-hover': '#233C36',
        '--text': '#F0FDF4',
        '--text-secondary': '#86EFAC',
        '--text-muted': '#5B8F7A',
        '--border': 'rgba(255,255,255,0.08)',
        '--border-strong': 'rgba(255,255,255,0.15)',
        '--success': '#10B981',
        '--success-soft': 'rgba(16,185,129,0.14)',
        '--warning': '#F59E0B',
        '--warning-soft': 'rgba(245,158,11,0.14)',
        '--error': '#EF4444',
        '--error-soft': 'rgba(239,68,68,0.14)',
        '--info': '#3B82F6',
        '--info-soft': 'rgba(59,130,246,0.14)',
        '--shadow': '0 1px 3px rgba(0,0,0,0.3)',
        '--shadow-lg': '0 10px 40px rgba(0,0,0,0.4)'
      }
    },

    // ========================================================
    // 8. emerald_light
    // ========================================================
    {
      id: 'emerald_light',
      name_ar: 'زمردي فاتح',
      name_en: 'Emerald Light',
      description_ar: 'أخضر زمردي على أبيض',
      is_dark: false,
      is_default: false,
      is_system: false,
      order_index: 8,
      colors: {
        '--primary': '#059669',
        '--primary-hover': '#047857',
        '--primary-soft': 'rgba(5,150,105,0.1)',
        '--primary-text': '#FFFFFF',
        '--bg': '#FFFFFF',
        '--bg-alt': '#ECFDF5',
        '--surface': '#F0FDF4',
        '--surface-elevated': '#FFFFFF',
        '--surface-hover': '#D1FAE5',
        '--text': '#064E3B',
        '--text-secondary': '#047857',
        '--text-muted': '#10B981',
        '--border': 'rgba(5,150,105,0.12)',
        '--border-strong': 'rgba(5,150,105,0.25)',
        '--success': '#059669',
        '--success-soft': 'rgba(5,150,105,0.1)',
        '--warning': '#D97706',
        '--warning-soft': 'rgba(217,119,6,0.1)',
        '--error': '#DC2626',
        '--error-soft': 'rgba(220,38,38,0.1)',
        '--info': '#2563EB',
        '--info-soft': 'rgba(37,99,235,0.1)',
        '--shadow': '0 1px 3px rgba(0,0,0,0.08)',
        '--shadow-lg': '0 10px 40px rgba(0,0,0,0.12)'
      }
    },

    // ========================================================
    // 9. ocean_teal
    // ========================================================
    {
      id: 'ocean_teal',
      name_ar: 'محيط فيروزي',
      name_en: 'Ocean Teal',
      description_ar: 'تركواز عميق',
      is_dark: true,
      is_default: false,
      is_system: false,
      order_index: 9,
      colors: {
        '--primary': '#14B8A6',
        '--primary-hover': '#0D9488',
        '--primary-soft': 'rgba(20,184,166,0.14)',
        '--primary-text': '#FFFFFF',
        '--bg': '#0B1E1C',
        '--bg-alt': '#05110F',
        '--surface': '#122824',
        '--surface-elevated': '#1A3833',
        '--surface-hover': '#234842',
        '--text': '#F0FDFA',
        '--text-secondary': '#5EEAD4',
        '--text-muted': '#4F8B7F',
        '--border': 'rgba(255,255,255,0.08)',
        '--border-strong': 'rgba(255,255,255,0.15)',
        '--success': '#10B981',
        '--success-soft': 'rgba(16,185,129,0.14)',
        '--warning': '#F59E0B',
        '--warning-soft': 'rgba(245,158,11,0.14)',
        '--error': '#EF4444',
        '--error-soft': 'rgba(239,68,68,0.14)',
        '--info': '#3B82F6',
        '--info-soft': 'rgba(59,130,246,0.14)',
        '--shadow': '0 1px 3px rgba(0,0,0,0.3)',
        '--shadow-lg': '0 10px 40px rgba(0,0,0,0.4)'
      }
    },

    // ========================================================
    // 10. sunset_orange
    // ========================================================
    {
      id: 'sunset_orange',
      name_ar: 'غروب برتقالي',
      name_en: 'Sunset Orange',
      description_ar: 'برتقالي دافئ',
      is_dark: true,
      is_default: false,
      is_system: false,
      order_index: 10,
      colors: {
        '--primary': '#F97316',
        '--primary-hover': '#EA580C',
        '--primary-soft': 'rgba(249,115,22,0.14)',
        '--primary-text': '#FFFFFF',
        '--bg': '#1C0E05',
        '--bg-alt': '#100702',
        '--surface': '#2A1810',
        '--surface-elevated': '#3A231A',
        '--surface-hover': '#4D3025',
        '--text': '#FFF7ED',
        '--text-secondary': '#FDBA74',
        '--text-muted': '#A37B5C',
        '--border': 'rgba(255,255,255,0.08)',
        '--border-strong': 'rgba(255,255,255,0.15)',
        '--success': '#10B981',
        '--success-soft': 'rgba(16,185,129,0.14)',
        '--warning': '#FBBF24',
        '--warning-soft': 'rgba(251,191,36,0.14)',
        '--error': '#EF4444',
        '--error-soft': 'rgba(239,68,68,0.14)',
        '--info': '#3B82F6',
        '--info-soft': 'rgba(59,130,246,0.14)',
        '--shadow': '0 1px 3px rgba(0,0,0,0.3)',
        '--shadow-lg': '0 10px 40px rgba(0,0,0,0.4)'
      }
    },

    // ========================================================
    // 11. crimson_noir
    // ========================================================
    {
      id: 'crimson_noir',
      name_ar: 'قرمزي نوار',
      name_en: 'Crimson Noir',
      description_ar: 'قرمزي على أسود مطلق',
      is_dark: true,
      is_default: false,
      is_system: false,
      order_index: 11,
      colors: {
        '--primary': '#DC2626',
        '--primary-hover': '#B91C1C',
        '--primary-soft': 'rgba(220,38,38,0.14)',
        '--primary-text': '#FFFFFF',
        '--bg': '#0A0000',
        '--bg-alt': '#050000',
        '--surface': '#1A0505',
        '--surface-elevated': '#250808',
        '--surface-hover': '#330B0B',
        '--text': '#FEF2F2',
        '--text-secondary': '#FCA5A5',
        '--text-muted': '#946060',
        '--border': 'rgba(255,255,255,0.08)',
        '--border-strong': 'rgba(255,255,255,0.15)',
        '--success': '#10B981',
        '--success-soft': 'rgba(16,185,129,0.14)',
        '--warning': '#F59E0B',
        '--warning-soft': 'rgba(245,158,11,0.14)',
        '--error': '#EF4444',
        '--error-soft': 'rgba(239,68,68,0.14)',
        '--info': '#3B82F6',
        '--info-soft': 'rgba(59,130,246,0.14)',
        '--shadow': '0 1px 3px rgba(0,0,0,0.4)',
        '--shadow-lg': '0 10px 40px rgba(0,0,0,0.5)'
      }
    },

    // ========================================================
    // 12. slate_professional
    // ========================================================
    {
      id: 'slate_professional',
      name_ar: 'رمادي احترافي',
      name_en: 'Slate Professional',
      description_ar: 'رمادي هادئ للأعمال',
      is_dark: false,
      is_default: false,
      is_system: false,
      order_index: 12,
      colors: {
        '--primary': '#475569',
        '--primary-hover': '#334155',
        '--primary-soft': 'rgba(71,85,105,0.1)',
        '--primary-text': '#FFFFFF',
        '--bg': '#F1F5F9',
        '--bg-alt': '#E2E8F0',
        '--surface': '#FFFFFF',
        '--surface-elevated': '#FFFFFF',
        '--surface-hover': '#F8FAFC',
        '--text': '#0F172A',
        '--text-secondary': '#475569',
        '--text-muted': '#64748B',
        '--border': 'rgba(15,23,42,0.08)',
        '--border-strong': 'rgba(15,23,42,0.15)',
        '--success': '#059669',
        '--success-soft': 'rgba(5,150,105,0.1)',
        '--warning': '#D97706',
        '--warning-soft': 'rgba(217,119,6,0.1)',
        '--error': '#DC2626',
        '--error-soft': 'rgba(220,38,38,0.1)',
        '--info': '#2563EB',
        '--info-soft': 'rgba(37,99,235,0.1)',
        '--shadow': '0 1px 3px rgba(0,0,0,0.08)',
        '--shadow-lg': '0 10px 40px rgba(0,0,0,0.12)'
      }
    },

    // ========================================================
    // 13. forest_green
    // ========================================================
    {
      id: 'forest_green',
      name_ar: 'أخضر غابات',
      name_en: 'Forest Green',
      description_ar: 'أخضر غابات داكن',
      is_dark: true,
      is_default: false,
      is_system: false,
      order_index: 13,
      colors: {
        '--primary': '#16A34A',
        '--primary-hover': '#15803D',
        '--primary-soft': 'rgba(22,163,74,0.14)',
        '--primary-text': '#FFFFFF',
        '--bg': '#052E16',
        '--bg-alt': '#021A0C',
        '--surface': '#0A4222',
        '--surface-elevated': '#0F552C',
        '--surface-hover': '#156A39',
        '--text': '#F0FDF4',
        '--text-secondary': '#86EFAC',
        '--text-muted': '#5B9E70',
        '--border': 'rgba(255,255,255,0.08)',
        '--border-strong': 'rgba(255,255,255,0.15)',
        '--success': '#10B981',
        '--success-soft': 'rgba(16,185,129,0.14)',
        '--warning': '#F59E0B',
        '--warning-soft': 'rgba(245,158,11,0.14)',
        '--error': '#EF4444',
        '--error-soft': 'rgba(239,68,68,0.14)',
        '--info': '#3B82F6',
        '--info-soft': 'rgba(59,130,246,0.14)',
        '--shadow': '0 1px 3px rgba(0,0,0,0.3)',
        '--shadow-lg': '0 10px 40px rgba(0,0,0,0.4)'
      }
    },

    // ========================================================
    // 14. sky_light
    // ========================================================
    {
      id: 'sky_light',
      name_ar: 'سماوي فاتح',
      name_en: 'Sky Light',
      description_ar: 'أزرق سماوي فاتح',
      is_dark: false,
      is_default: false,
      is_system: false,
      order_index: 14,
      colors: {
        '--primary': '#0284C7',
        '--primary-hover': '#0369A1',
        '--primary-soft': 'rgba(2,132,199,0.1)',
        '--primary-text': '#FFFFFF',
        '--bg': '#F0F9FF',
        '--bg-alt': '#E0F2FE',
        '--surface': '#FFFFFF',
        '--surface-elevated': '#FFFFFF',
        '--surface-hover': '#F8FAFC',
        '--text': '#082F49',
        '--text-secondary': '#0369A1',
        '--text-muted': '#0284C7',
        '--border': 'rgba(2,132,199,0.1)',
        '--border-strong': 'rgba(2,132,199,0.2)',
        '--success': '#059669',
        '--success-soft': 'rgba(5,150,105,0.1)',
        '--warning': '#D97706',
        '--warning-soft': 'rgba(217,119,6,0.1)',
        '--error': '#DC2626',
        '--error-soft': 'rgba(220,38,38,0.1)',
        '--info': '#2563EB',
        '--info-soft': 'rgba(37,99,235,0.1)',
        '--shadow': '0 1px 3px rgba(0,0,0,0.08)',
        '--shadow-lg': '0 10px 40px rgba(0,0,0,0.12)'
      }
    },

    // ========================================================
    // 15. paper_classic
    // ========================================================
    {
      id: 'paper_classic',
      name_ar: 'ورقي كلاسيكي',
      name_en: 'Paper Classic',
      description_ar: 'بيج كلاسيكي دافئ',
      is_dark: false,
      is_default: false,
      is_system: false,
      order_index: 15,
      colors: {
        '--primary': '#92400E',
        '--primary-hover': '#78350F',
        '--primary-soft': 'rgba(146,64,14,0.1)',
        '--primary-text': '#FFFFFF',
        '--bg': '#FEF3C7',
        '--bg-alt': '#FDE68A',
        '--surface': '#FFFBEB',
        '--surface-elevated': '#FFFFFF',
        '--surface-hover': '#FEF9E7',
        '--text': '#451A03',
        '--text-secondary': '#78350F',
        '--text-muted': '#92400E',
        '--border': 'rgba(146,64,14,0.12)',
        '--border-strong': 'rgba(146,64,14,0.25)',
        '--success': '#059669',
        '--success-soft': 'rgba(5,150,105,0.1)',
        '--warning': '#D97706',
        '--warning-soft': 'rgba(217,119,6,0.1)',
        '--error': '#DC2626',
        '--error-soft': 'rgba(220,38,38,0.1)',
        '--info': '#2563EB',
        '--info-soft': 'rgba(37,99,235,0.1)',
        '--shadow': '0 1px 3px rgba(0,0,0,0.1)',
        '--shadow-lg': '0 10px 40px rgba(0,0,0,0.15)'
      }
    },

    // ========================================================
    // 16. neon_pink
    // ========================================================
    {
      id: 'neon_pink',
      name_ar: 'نيون وردي',
      name_en: 'Neon Pink',
      description_ar: 'وردي نيون على أسود',
      is_dark: true,
      is_default: false,
      is_system: false,
      order_index: 16,
      colors: {
        '--primary': '#EC4899',
        '--primary-hover': '#DB2777',
        '--primary-soft': 'rgba(236,72,153,0.14)',
        '--primary-text': '#FFFFFF',
        '--bg': '#1A0A14',
        '--bg-alt': '#0F0510',
        '--surface': '#2A0F22',
        '--surface-elevated': '#3A1530',
        '--surface-hover': '#4D1D40',
        '--text': '#FDF2F8',
        '--text-secondary': '#F9A8D4',
        '--text-muted': '#9D6B84',
        '--border': 'rgba(255,255,255,0.08)',
        '--border-strong': 'rgba(255,255,255,0.15)',
        '--success': '#10B981',
        '--success-soft': 'rgba(16,185,129,0.14)',
        '--warning': '#F59E0B',
        '--warning-soft': 'rgba(245,158,11,0.14)',
        '--error': '#EF4444',
        '--error-soft': 'rgba(239,68,68,0.14)',
        '--info': '#06B6D4',
        '--info-soft': 'rgba(6,182,212,0.14)',
        '--shadow': '0 1px 3px rgba(0,0,0,0.3)',
        '--shadow-lg': '0 10px 40px rgba(0,0,0,0.4)'
      }
    },

    // ========================================================
    // 17. system (auto — يتبع prefers-color-scheme)
    // ========================================================
    {
      id: 'system',
      name_ar: 'حسب النظام',
      name_en: 'System',
      description_ar: 'يتبع إعدادات الجهاز (فاتح/داكن)',
      is_dark: true,          // placeholder — resolved dynamically
      is_default: false,
      is_system: true,
      order_index: 17,
      colors: null            // resolved dynamically based on prefers-color-scheme
    }
  ];

  /* ============================================================
     MAP — Quick lookup by ID
     ============================================================ */

  var THEMES_MAP = {};
  THEMES_ARRAY.forEach(function (t) {
    THEMES_MAP[t.id] = t;
  });

  /* ============================================================
     SYSTEM THEME RESOLUTION
     ============================================================ */

  // Fallbacks for system theme
  var SYSTEM_LIGHT_THEME = 'watanii_light';
  var SYSTEM_DARK_THEME = 'watanii_dark';

  function prefersDark() {
    try {
      if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
        return true;
      }
      if (window.matchMedia && window.matchMedia('(prefers-color-scheme: light)').matches) {
        return false;
      }
    } catch (e) {}
    // Default: dark
    return true;
  }

  function resolveSystemTheme() {
    return prefersDark() ? SYSTEM_DARK_THEME : SYSTEM_LIGHT_THEME;
  }

  /* ============================================================
     HELPERS
     ============================================================ */

  // Get theme by ID (resolves 'system' dynamically)
  function getTheme(id) {
    if (!id) return null;
    var theme = THEMES_MAP[id];

    // If system — return actual theme to use
    if (theme && theme.is_system) {
      var resolvedId = resolveSystemTheme();
      var resolvedTheme = THEMES_MAP[resolvedId] || THEMES_MAP['watanii_dark'];
      return {
        id: theme.id,
        name_ar: theme.name_ar,
        name_en: theme.name_en,
        description_ar: theme.description_ar,
        is_system: true,
        resolved_id: resolvedId,
        resolved_theme: resolvedTheme,
        is_dark: resolvedTheme ? resolvedTheme.is_dark : true,
        colors: resolvedTheme ? resolvedTheme.colors : {}
      };
    }

    return theme || null;
  }

  // Get all themes (array)
  function getAllThemes() {
    return THEMES_ARRAY.map(function (t) { return t; });
  }

  // Get all active themes (excluding system if desired)
  function getActiveThemes(includeSystem) {
    return THEMES_ARRAY
      .filter(function (t) {
        if (!includeSystem && t.is_system) return false;
        return true;
      })
      .sort(function (a, b) { return a.order_index - b.order_index; });
  }

  // Check if a theme is dark
  function isDark(id) {
    var theme = getTheme(id);
    return theme ? theme.is_dark === true : true;
  }

  // Get swatch colors (for theme picker UI)
  function getSwatchColors(id) {
    var theme = getTheme(id);
    if (!theme || !theme.colors) {
      return {
        primary: '#CE1126',
        bg: '#0A0E14',
        surface: '#131820',
        text: '#F8FAFC',
        is_dark: true
      };
    }
    return {
      primary: theme.colors['--primary'] || '#CE1126',
      bg: theme.colors['--bg'] || '#0A0E14',
      surface: theme.colors['--surface'] || '#131820',
      text: theme.colors['--text'] || '#F8FAFC',
      is_dark: theme.is_dark === true
    };
  }

  // Get CSS variables for a theme
  function getCssVars(id) {
    var theme = getTheme(id);
    if (!theme || !theme.colors) return {};
    return JSON.parse(JSON.stringify(theme.colors));
  }

  // Get default theme ID
  function getDefaultId() {
    for (var i = 0; i < THEMES_ARRAY.length; i++) {
      if (THEMES_ARRAY[i].is_default === true) {
        return THEMES_ARRAY[i].id;
      }
    }
    return 'watanii_dark';
  }

  // Validate theme ID
  function isValidTheme(id) {
    return !!THEMES_MAP[id];
  }

  // Get safe theme ID (fallback to default if invalid)
  function getSafeId(id) {
    if (isValidTheme(id)) return id;
    return getDefaultId();
  }

  /* ============================================================
     SYSTEM THEME LISTENER
     ============================================================ */

  var systemListeners = [];

  function notifySystemChange(isDark) {
    systemListeners.forEach(function (fn) {
      try { fn(isDark); } catch (e) {}
    });
    try {
      window.dispatchEvent(new CustomEvent('itws:system-theme-changed', {
        detail: { isDark: isDark }
      }));
    } catch (e) {}
  }

  try {
    if (window.matchMedia) {
      var mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
      if (mediaQuery.addEventListener) {
        mediaQuery.addEventListener('change', function (e) {
          notifySystemChange(e.matches);
        });
      } else if (mediaQuery.addListener) {
        mediaQuery.addListener(function (e) {
          notifySystemChange(e.matches);
        });
      }
    }
  } catch (e) {}

  function onSystemThemeChange(callback) {
    if (typeof callback !== 'function') return function () {};
    systemListeners.push(callback);
    return function unsubscribe() {
      var idx = systemListeners.indexOf(callback);
      if (idx !== -1) systemListeners.splice(idx, 1);
    };
  }

  /* ============================================================
     EXPORT
     ============================================================ */

  // Primary global arrays/maps
  window.ITWS_THEMES = THEMES_ARRAY;
  window.ITWS_THEMES_MAP = THEMES_MAP;
  window.ITWS_DEFAULT_THEME = getDefaultId();

  // Helpers namespace
  window.ITWS_THEMES_HELPERS = {
    getTheme: getTheme,
    getAllThemes: getAllThemes,
    getActiveThemes: getActiveThemes,
    isDark: isDark,
    getSwatchColors: getSwatchColors,
    getCssVars: getCssVars,
    getDefaultId: getDefaultId,
    isValidTheme: isValidTheme,
    getSafeId: getSafeId,
    prefersDark: prefersDark,
    resolveSystemTheme: resolveSystemTheme,
    onSystemThemeChange: onSystemThemeChange,

    // Constants
    SYSTEM_LIGHT_THEME: SYSTEM_LIGHT_THEME,
    SYSTEM_DARK_THEME: SYSTEM_DARK_THEME
  };

  // Short-hand helpers on window
  window.getThemeById = getTheme;
  window.getAllThemes = getAllThemes;
  window.isDarkTheme = isDark;
  window.getThemeSwatch = getSwatchColors;
  window.getThemeCssVars = getCssVars;

  /* ============================================================
     DEBUG LOG
     ============================================================ */

  if (window.ITWS_CONFIG && window.ITWS_CONFIG.DEBUG) {
    try {
      console.log('%c[ThemesData]', 'color: #8B5CF6; font-weight: bold;', 'Loaded', {
        total: THEMES_ARRAY.length,
        default: window.ITWS_DEFAULT_THEME,
        dark: THEMES_ARRAY.filter(function (t) { return t.is_dark && !t.is_system; }).length,
        light: THEMES_ARRAY.filter(function (t) { return !t.is_dark && !t.is_system; }).length,
        system: prefersDark() ? 'dark' : 'light'
      });
    } catch (e) {}
  }

})();
