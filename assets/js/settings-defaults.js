/* ============================================================
   ITWS Platform — Settings Defaults V2
   File: assets/js/settings-defaults.js
   Description: Default fallback values for all settings
   Load order: FIRST (before config.js, app-settings.js)
   Rules:
   - Must mirror supabase/seed.sql structure
   - No hardcoded UI logic — values only
   - No emoji, no external deps
   ============================================================ */

(function () {
  'use strict';

  if (window.ITWS_SETTINGS_DEFAULTS) return;

  window.ITWS_SETTINGS_DEFAULTS = {

    /* ==========================================================
       1. APP IDENTITY
       ========================================================== */
    app_identity: {
      union_name: 'نقابة تكنولوجيا المعلومات والبرمجيات',
      union_name_en: 'IT Workers Syndicate',
      committee_name: 'لجنة التحول الرقمي والتدريب',
      committee_head_name: '',
      president_name: 'المحاسب / محمود جميل',
      president_label: 'النقيب العام',
      president_footer: '',
      footer_text: '',
      logo_url: null,
      stamp_url: null,
      contact_email: 'info@itws.gov.eg',
      contact_phone: '0223456789',
      website_url: 'https://itworkerssyndicate.github.io/academymangment/',
      hero_title: '',
      hero_subtitle: '',
      hero_badge: 'المنصة الرسمية',
      cta_title: '',
      cta_subtitle: '',
      cta_button_text: '',
      cta_button_url: '',
      footer_link: {
        enabled: false,
        text: '',
        url: ''
      },
      about_section: {
        enabled: true,
        title: 'لماذا هذه المنصة؟',
        subtitle: 'منصة متكاملة للتحقق من الشهادات وإدارة الأكاديميات',
        features: [
          {
            title: 'التحقق الرسمي',
            description: 'تحقق فوري من صحة الشهادات التدريبية'
          },
          {
            title: 'أكاديميات معتمدة',
            description: 'قاعدة بيانات مركزية للأكاديميات المعتمدة'
          },
          {
            title: 'شهادات موثقة',
            description: 'شهادات مع QR codes للتحقق السريع'
          }
        ]
      },
      custom_section: {
        enabled: false,
        title: '',
        subtitle: '',
        content: '',
        button_text: '',
        button_url: ''
      },
      // Verify page texts (dynamic)
      verify_badge: 'التحقق الرسمي من الشهادات',
      verify_title: 'تحقق من صحة الشهادة',
      verify_subtitle: 'أدخل كود الشهادة المطبوع عليها للتحقق من صحتها بشكل فوري',
      verify_search_label: 'كود الشهادة',
      verify_button_text: 'تحقق',
      verify_hint: 'أدخل الكود المطبوع على الشهادة',
      // Track page texts
      track_badge: 'متابعة الطلب',
      track_title: 'تتبع طلب الاعتماد',
      track_subtitle: 'أدخل رقم طلب الاعتماد لمتابعة حالته والمراحل التي تم اجتيازها',
      track_search_label: 'رقم طلب الاعتماد',
      track_button_text: 'متابعة',
      track_hint: 'الرقم يبدأ بـ REQ- ويظهر بعد تقديم طلب الاعتماد',
      // Student page texts
      student_badge: 'صفحة المتدرب الرسمية',
      student_title: 'اعرض شهاداتك في مكان واحد',
      student_subtitle: 'أدخل رقمك القومي لعرض جميع شهاداتك التدريبية المعتمدة',
      student_search_label: 'الرقم القومي',
      student_button_text: 'بحث',
      student_hint: 'أدخل الرقم القومي المكون من 14 رقماً'
    },

    /* ==========================================================
       2. BEHAVIOR
       ========================================================== */
    behavior: {
      font_family: 'Cairo',
      font_size: 14,

      // Redirects
      redirect_guest_to: 'home.html',
      redirect_admin_to: 'admin/index.html',
      redirect_user_to: 'home.html',

      // Session
      session_timeout_minutes: 60,
      max_login_attempts: 5,
      heartbeat_interval_ms: 60000,
      online_threshold_ms: 120000,

      // Features
      enable_registration: true,
      enable_theme_picker_for_visitors: true,
      enable_dark_mode_toggle: true,
      enable_search: true,
      enable_cv_builder: true,

      // Home sections
      home_show_stats: false,
      home_show_recent_academies: true,
      home_show_quick_actions: true,
      home_show_about_section: true,
      home_show_custom_section: false,
      home_stats_academies_count: 6,

      // Search
      search_min_chars: 3,
      search_debounce_ms: 300,
      search_max_results: 50,
      search_button_text: 'بحث',
      search_certificate_placeholder: 'NTI-2026-XXXXXX',
      search_certificate_hint: 'أدخل كود الشهادة المطبوع عليها',
      search_trainee_placeholder: 'الرقم القومي (14 رقم)',
      search_trainee_hint: 'أدخل الرقم القومي المكون من 14 رقماً',
      search_academy_placeholder: 'اسم الأكاديمية أو التخصص',
      search_academy_hint: 'ابحث عن أكاديمية معتمدة من النقابة',

      // Pagination
      pagination_admin_size: 20,
      pagination_public_size: 12
    },

    /* ==========================================================
       3. THEME
       ========================================================== */
    theme: {
      default_theme: 'watanii_dark',
      allow_user_override: true,
      fade_transition_ms: 200
    },

    /* ==========================================================
       4. ACCREDITATION
       ========================================================== */
    accreditation: {
      stages: {
        submitted: 'تم التقديم',
        documents_review: 'مراجعة المستندات',
        site_visit: 'زيارة الموقع',
        committee_review: 'لجنة المراجعة',
        final_approval: 'الموافقة النهائية',
        approved: 'معتمدة',
        rejected: 'مرفوضة'
      },
      sla_days: {
        submitted: 3,
        documents_review: 3,
        site_visit: 14,
        committee_review: 7,
        final_approval: 5
      },
      request_code_pattern: 'REQ-{YEAR}-{RANDOM4}',
      min_branches: 1,
      min_courses: 1,
      require_payment_receipt: false,
      require_place_photo: true,
      require_tax_card: true,
      require_commercial_registry: true
    },

    /* ==========================================================
       5. CERTIFICATES
       ========================================================== */
    certificates: {
      code_prefix: 'NTI',
      code_pattern: 'NTI-{YEAR}-{RANDOM6}',
      random_length: 6,
      enable_auto_code: true,
      enable_manual_code: true,
      grades: ['A+', 'A', 'B+', 'B', 'C+', 'C', 'D', 'F'],
      show_qr: true,
      show_stamp: true,
      show_committee_head_signature: true,
      show_president_signature: true,
      revocation_enabled: true,
      batch_import_enabled: true,
      pdf_template: 'basic'
    },

    /* ==========================================================
       6. SECURITY
       ========================================================== */
    security: {
      max_login_attempts: 5,
      lockout_minutes: 15,
      session_timeout_minutes: 60,
      require_email_verification: false,
      allow_password_reset: true,
      password_min_length: 8,
      require_2fa_for_super_admin: false
    },

    /* ==========================================================
       7. UPLOADS
       ========================================================== */
    uploads: {
      max_image_size_mb: 5,
      max_document_size_mb: 20,
      allowed_image_types: ['image/png', 'image/jpeg', 'image/webp', 'image/svg+xml'],
      allowed_document_types: ['application/pdf', 'image/png', 'image/jpeg'],
      cloudinary_cloud_name: null,
      cloudinary_upload_preset: null
    },

    /* ==========================================================
       8. FOOTER
       ========================================================== */
    footer: {
      show_social_links: true,
      show_president: true,
      show_copyright: true,
      copyright_text: '',
      social_facebook: '',
      social_twitter: '',
      social_linkedin: '',
      social_youtube: ''
    },

    /* ==========================================================
       9. FEATURES (advanced)
       ========================================================== */
    features: {
      enable_ai_cv: false,
      enable_ocr: false,
      enable_qr_code: true,
      enable_pdf_export: true,
      enable_excel_export: true,
      enable_whatsapp_share: true,
      enable_email_notifications: false
    },

    /* ==========================================================
       10. RATINGS
       ========================================================== */
    ratings: {
      enable_ratings: true,
      show_on_home: true,
      show_on_directory: true,
      allow_public_rating: true,
      require_login_to_rate: true,
      min_stars: 1,
      allow_reviews: true,
      review_max_length: 500,
      auto_publish: true,
      show_rating_badge: true
    },

    /* ==========================================================
       11. SPLASH
       ========================================================== */
    splash: {
      enabled: true,
      min_duration_ms: 2200,
      max_duration_ms: 4000,
      loading_texts: ['جاري التحميل...', 'تحضير المنصة...', 'مرحباً بك...'],
      show_logo: true,
      show_hexagon: true,
      show_rings: true,
      show_particles: true,
      show_progress_circular: true,
      show_progress_bar: false,
      show_status_text: true,
      show_president_footer: true,
      show_shimmer: true,
      particles_count: 20,
      animation_level: 'medium'
    },

    /* ==========================================================
       12. REALTIME
       ========================================================== */
    realtime: {
      enabled: true,
      debounce_ms: 300,
      fallback_polling_ms: 30000,
      tables: [
        'settings',
        'labels',
        'themes',
        'academies',
        'certificates',
        'accreditation_requests',
        'user_requests',
        'activities',
        'academy_ratings'
      ]
    },

    /* ==========================================================
       13. NOTIFICATIONS
       ========================================================== */
    notifications: {
      in_app_enabled: true,
      email_enabled: false,
      digest_frequency: 'daily'
    }
  };

  /* ============================================================
     DEPRECATED KEYS MAP
     للتوافق مع الشاتات القديمة / أكواد V1
     أي كود قديم بيستخدم key قديم، بيتم تحويله تلقائياً
     ============================================================ */
  window.ITWS_DEPRECATED_KEYS = {
    'general.union_name': 'app_identity.union_name',
    'general.logo_url': 'app_identity.logo_url',
    'general.stamp_url': 'app_identity.stamp_url',
    'general.president_name': 'app_identity.president_name',
    'general.contact_email': 'app_identity.contact_email',
    'general.contact_phone': 'app_identity.contact_phone',
    'general.website_url': 'app_identity.website_url',
    'general.footer_text': 'app_identity.footer_text',
    'general.committee_name': 'app_identity.committee_name'
  };

  /* ============================================================
     HELPER: Deep freeze (منع التعديل العشوائي)
     ============================================================ */
  function deepFreeze(obj) {
    Object.getOwnPropertyNames(obj).forEach(function (prop) {
      var val = obj[prop];
      if (val && typeof val === 'object' && !Object.isFrozen(val)) {
        deepFreeze(val);
      }
    });
    return Object.freeze(obj);
  }

  // ملاحظة: لا نعمل freeze هنا، لأن بعض الأكواد بتعمل merge
  // window.ITWS_SETTINGS_DEFAULTS = deepFreeze(window.ITWS_SETTINGS_DEFAULTS);

  /* ============================================================
     HELPER: Get a default value by path
     Usage: window.getSettingDefault('app_identity.union_name', 'fallback')
     ============================================================ */
  window.getSettingDefault = function (path, fallback) {
    if (!path) return fallback;

    // Resolve deprecated
    if (window.ITWS_DEPRECATED_KEYS && window.ITWS_DEPRECATED_KEYS[path]) {
      path = window.ITWS_DEPRECATED_KEYS[path];
    }

    var parts = String(path).split('.');
    var current = window.ITWS_SETTINGS_DEFAULTS;

    for (var i = 0; i < parts.length; i++) {
      if (current == null || typeof current !== 'object') {
        return fallback;
      }
      current = current[parts[i]];
    }

    return (current === undefined || current === null) ? fallback : current;
  };

  /* ============================================================
     HELPER: Get entire group
     Usage: window.getSettingGroup('app_identity')
     ============================================================ */
  window.getSettingGroup = function (groupName) {
    if (!groupName) return null;
    var group = window.ITWS_SETTINGS_DEFAULTS[groupName];
    return group ? JSON.parse(JSON.stringify(group)) : null;
  };

  /* ============================================================
     HELPER: List all top-level groups
     ============================================================ */
  window.getSettingGroups = function () {
    return Object.keys(window.ITWS_SETTINGS_DEFAULTS);
  };

  /* ============================================================
     DEBUG: Log available groups on load
     ============================================================ */
  if (window.ITWS_CONFIG && window.ITWS_CONFIG.DEBUG) {
    try {
      console.log('[SettingsDefaults] Loaded groups:', window.getSettingGroups());
    } catch (e) {}
  }

})();
