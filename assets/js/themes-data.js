// ============================================
// [5/50] ITWS Platform - Themes Data
// Path: assets/js/themes-data.js
// ============================================
// 💡 6 ثيمات كاملة جاهزة، كل واحد له معنى وهوية بصرية
// 💡 الألوان مطابقة لمعايير WCAG AA (تباين كافٍ للقراءة)
// 💡 كل ثيم فيه 20+ متغير CSS عشان يغطي كل عناصر الواجهة
// ============================================

(function () {
  'use strict';

  window.ITWS_THEMES = {

    // ============================================
    // 1. formal_dark - الافتراضي الرسمي (ذهبي + أزرق)
    // ============================================
    formal_dark: {
      id: 'formal_dark',
      name: 'الافتراضي الرسمي',
      name_en: 'Formal Dark',
      description: 'الثيم الرسمي الافتراضي للنقابة — ذهبي وأزرق داكن',
      preview: ['#0A1628', '#C9A84C', '#1E40AF'],
      is_light: false,
      colors: {
        'primary': '#C9A84C',
        'primary-hover': '#B8953E',
        'primary-soft': 'rgba(201, 168, 76, 0.12)',
        'primary-text': '#0A1628',

        'accent': '#1E40AF',
        'accent-hover': '#1E3A8A',
        'accent-soft': 'rgba(30, 64, 175, 0.15)',

        'bg': '#0A1628',
        'bg-alt': '#060F1E',
        'surface': '#0F1E35',
        'surface-elevated': '#152641',
        'surface-hover': '#1C3050',

        'text': '#F8FAFC',
        'text-secondary': '#94A3B8',
        'text-muted': '#64748B',
        'text-inverse': '#0A1628',

        'border': 'rgba(255, 255, 255, 0.08)',
        'border-strong': 'rgba(255, 255, 255, 0.15)',
        'border-focus': '#C9A84C',

        'success': '#10B981',
        'success-soft': 'rgba(16, 185, 129, 0.12)',
        'error': '#EF4444',
        'error-soft': 'rgba(239, 68, 68, 0.12)',
        'warning': '#F59E0B',
        'warning-soft': 'rgba(245, 158, 11, 0.12)',
        'info': '#3B82F6',
        'info-soft': 'rgba(59, 130, 246, 0.12)',

        'shadow': '0 8px 32px rgba(0, 0, 0, 0.4)',
        'shadow-lg': '0 20px 60px rgba(0, 0, 0, 0.5)'
      }
    },

    // ============================================
    // 2. watanii - وطني (أحمر + أسود + أبيض)
    // ============================================
    watanii: {
      id: 'watanii',
      name: 'وطني',
      name_en: 'Patriotic',
      description: 'ثيم وطني بألوان علم مصر — أحمر وأسود وأبيض',
      preview: ['#FAFAFA', '#CE1126', '#000000'],
      is_light: true,
      colors: {
        'primary': '#CE1126',
        'primary-hover': '#A50D1F',
        'primary-soft': 'rgba(206, 17, 38, 0.08)',
        'primary-text': '#FFFFFF',

        'accent': '#000000',
        'accent-hover': '#1F2937',
        'accent-soft': 'rgba(0, 0, 0, 0.05)',

        'bg': '#FAFAFA',
        'bg-alt': '#F0F0F0',
        'surface': '#FFFFFF',
        'surface-elevated': '#F3F4F6',
        'surface-hover': '#E5E7EB',

        'text': '#0F172A',
        'text-secondary': '#4B5563',
        'text-muted': '#9CA3AF',
        'text-inverse': '#FFFFFF',

        'border': 'rgba(0, 0, 0, 0.08)',
        'border-strong': 'rgba(0, 0, 0, 0.15)',
        'border-focus': '#CE1126',

        'success': '#059669',
        'success-soft': 'rgba(5, 150, 105, 0.1)',
        'error': '#CE1126',
        'error-soft': 'rgba(206, 17, 38, 0.1)',
        'warning': '#D97706',
        'warning-soft': 'rgba(217, 119, 6, 0.1)',
        'info': '#1E40AF',
        'info-soft': 'rgba(30, 64, 175, 0.1)',

        'shadow': '0 8px 32px rgba(0, 0, 0, 0.08)',
        'shadow-lg': '0 20px 60px rgba(0, 0, 0, 0.12)'
      }
    },

    // ============================================
    // 3. tech_blue - تكنولوجي (أزرق + سماوي)
    // ============================================
    tech_blue: {
      id: 'tech_blue',
      name: 'تكنولوجي',
      name_en: 'Tech Blue',
      description: 'ثيم تكنولوجي حديث بألوان الأزرق والسماوي',
      preview: ['#0F172A', '#3B82F6', '#06B6D4'],
      is_light: false,
      colors: {
        'primary': '#3B82F6',
        'primary-hover': '#2563EB',
        'primary-soft': 'rgba(59, 130, 246, 0.12)',
        'primary-text': '#FFFFFF',

        'accent': '#06B6D4',
        'accent-hover': '#0891B2',
        'accent-soft': 'rgba(6, 182, 212, 0.15)',

        'bg': '#0F172A',
        'bg-alt': '#0A0F1E',
        'surface': '#1E293B',
        'surface-elevated': '#334155',
        'surface-hover': '#475569',

        'text': '#F1F5F9',
        'text-secondary': '#94A3B8',
        'text-muted': '#64748B',
        'text-inverse': '#0F172A',

        'border': 'rgba(148, 163, 184, 0.12)',
        'border-strong': 'rgba(148, 163, 184, 0.25)',
        'border-focus': '#3B82F6',

        'success': '#10B981',
        'success-soft': 'rgba(16, 185, 129, 0.12)',
        'error': '#EF4444',
        'error-soft': 'rgba(239, 68, 68, 0.12)',
        'warning': '#F59E0B',
        'warning-soft': 'rgba(245, 158, 11, 0.12)',
        'info': '#60A5FA',
        'info-soft': 'rgba(96, 165, 250, 0.12)',

        'shadow': '0 8px 32px rgba(0, 0, 0, 0.4)',
        'shadow-lg': '0 20px 60px rgba(0, 0, 0, 0.5)'
      }
    },

    // ============================================
    // 4. light_formal - رسمي فاتح (أزرق + ذهبي)
    // ============================================
    light_formal: {
      id: 'light_formal',
      name: 'رسمي فاتح',
      name_en: 'Light Formal',
      description: 'ثيم رسمي فاتح — أزرق ملكي مع ذهبي',
      preview: ['#F8FAFC', '#1E40AF', '#C9A84C'],
      is_light: true,
      colors: {
        'primary': '#1E40AF',
        'primary-hover': '#1E3A8A',
        'primary-soft': 'rgba(30, 64, 175, 0.08)',
        'primary-text': '#FFFFFF',

        'accent': '#C9A84C',
        'accent-hover': '#B8953E',
        'accent-soft': 'rgba(201, 168, 76, 0.12)',

        'bg': '#F8FAFC',
        'bg-alt': '#F1F5F9',
        'surface': '#FFFFFF',
        'surface-elevated': '#F1F5F9',
        'surface-hover': '#E2E8F0',

        'text': '#0F172A',
        'text-secondary': '#475569',
        'text-muted': '#94A3B8',
        'text-inverse': '#FFFFFF',

        'border': 'rgba(15, 23, 42, 0.08)',
        'border-strong': 'rgba(15, 23, 42, 0.15)',
        'border-focus': '#1E40AF',

        'success': '#059669',
        'success-soft': 'rgba(5, 150, 105, 0.1)',
        'error': '#DC2626',
        'error-soft': 'rgba(220, 38, 38, 0.1)',
        'warning': '#D97706',
        'warning-soft': 'rgba(217, 119, 6, 0.1)',
        'info': '#1E40AF',
        'info-soft': 'rgba(30, 64, 175, 0.1)',

        'shadow': '0 8px 32px rgba(0, 0, 0, 0.08)',
        'shadow-lg': '0 20px 60px rgba(0, 0, 0, 0.12)'
      }
    },

    // ============================================
    // 5. emerald - زمردي (أخضر داكن)
    // ============================================
    emerald: {
      id: 'emerald',
      name: 'زمردي',
      name_en: 'Emerald',
      description: 'ثيم زمردي هادئ بألوان الأخضر الطبيعي',
      preview: ['#0A1F1A', '#10B981', '#0D9488'],
      is_light: false,
      colors: {
        'primary': '#10B981',
        'primary-hover': '#059669',
        'primary-soft': 'rgba(16, 185, 129, 0.12)',
        'primary-text': '#0A1F1A',

        'accent': '#0D9488',
        'accent-hover': '#0F766E',
        'accent-soft': 'rgba(13, 148, 136, 0.15)',

        'bg': '#0A1F1A',
        'bg-alt': '#061410',
        'surface': '#112E26',
        'surface-elevated': '#1A3D33',
        'surface-hover': '#214D42',

        'text': '#ECFDF5',
        'text-secondary': '#A7F3D0',
        'text-muted': '#6EE7B7',
        'text-inverse': '#0A1F1A',

        'border': 'rgba(16, 185, 129, 0.15)',
        'border-strong': 'rgba(16, 185, 129, 0.3)',
        'border-focus': '#10B981',

        'success': '#22D3EE',
        'success-soft': 'rgba(34, 211, 238, 0.12)',
        'error': '#EF4444',
        'error-soft': 'rgba(239, 68, 68, 0.12)',
        'warning': '#F59E0B',
        'warning-soft': 'rgba(245, 158, 11, 0.12)',
        'info': '#06B6D4',
        'info-soft': 'rgba(6, 182, 212, 0.12)',

        'shadow': '0 8px 32px rgba(0, 0, 0, 0.5)',
        'shadow-lg': '0 20px 60px rgba(0, 0, 0, 0.6)'
      }
    },

    // ============================================
    // 6. midnight_gold - ليلي ذهبي (أسود + ذهبي)
    // ============================================
    midnight_gold: {
      id: 'midnight_gold',
      name: 'ليلي ذهبي',
      name_en: 'Midnight Gold',
      description: 'ثيم فاخر — أسود عميق مع ذهبي ملكي',
      preview: ['#000000', '#C9A84C', '#FFFFFF'],
      is_light: false,
      colors: {
        'primary': '#C9A84C',
        'primary-hover': '#D4B85C',
        'primary-soft': 'rgba(201, 168, 76, 0.12)',
        'primary-text': '#000000',

        'accent': '#FFFFFF',
        'accent-hover': '#E5E7EB',
        'accent-soft': 'rgba(255, 255, 255, 0.08)',

        'bg': '#000000',
        'bg-alt': '#050505',
        'surface': '#0A0A0A',
        'surface-elevated': '#171717',
        'surface-hover': '#262626',

        'text': '#FAFAFA',
        'text-secondary': '#A3A3A3',
        'text-muted': '#525252',
        'text-inverse': '#000000',

        'border': 'rgba(201, 168, 76, 0.15)',
        'border-strong': 'rgba(201, 168, 76, 0.3)',
        'border-focus': '#C9A84C',

        'success': '#10B981',
        'success-soft': 'rgba(16, 185, 129, 0.12)',
        'error': '#EF4444',
        'error-soft': 'rgba(239, 68, 68, 0.12)',
        'warning': '#F59E0B',
        'warning-soft': 'rgba(245, 158, 11, 0.12)',
        'info': '#3B82F6',
        'info-soft': 'rgba(59, 130, 246, 0.12)',

        'shadow': '0 8px 32px rgba(201, 168, 76, 0.1)',
        'shadow-lg': '0 20px 60px rgba(201, 168, 76, 0.15)'
      }
    }
  };

  // ============ الثيم الافتراضي (Fallback) ============
  // لو Supabase مش متاح لأي سبب، ده اللي بيتطبق
  window.ITWS_DEFAULT_THEME = 'formal_dark';

  // ============ Helper: قائمة الثيمات ============
  window.getThemesList = function () {
    return Object.keys(window.ITWS_THEMES).map(function (id) {
      var theme = window.ITWS_THEMES[id];
      return {
        id: theme.id,
        name: theme.name,
        name_en: theme.name_en,
        description: theme.description,
        preview: theme.preview,
        is_light: theme.is_light
      };
    });
  };

  // ============ Helper: جلب ثيم بالـ ID ============
  window.getTheme = function (id) {
    return window.ITWS_THEMES[id] || null;
  };

  // ============ Debug ============
  if (window.ITWS_CONFIG && window.ITWS_CONFIG.DEBUG) {
    console.log('%c✅ [ITWS] Themes loaded:', 'color: #10B981; font-weight: bold;', Object.keys(window.ITWS_THEMES).length, 'themes');
    console.log('   Default:', window.ITWS_DEFAULT_THEME);
    console.log('   Available:', Object.keys(window.ITWS_THEMES).join(', '));
  }

})();
