/**
 * ================================================================
 * ITWS SETTINGS DEFAULTS — V3 (EXPANDED)
 * assets/js/settings-defaults.js
 * ================================================================
 * الملف الأساسي لكل الإعدادات الافتراضية في المنصة.
 *
 * - 20 مجموعة إعدادات
 * - ~210 مفتاح
 * - كل حاجة في المنصة بتقرأ من هنا كـ fallback قبل الـ DB
 * - الـ DB (settings table) بيـ override القيم دي لما تكون متاحة
 * - AppSettings.get('group.key') بيرجع القيمة من هنا لو مش موجودة في DB
 *
 * الترتيب محسوب عشان يتحمل أول حاجة في <head>:
 *   <script src="assets/js/settings-defaults.js"></script>
 *   <script src="assets/js/config.js"></script>
 *   ...
 *
 * ES5-safe. بدون إيموجي. بدون hardcode لأي لون (الألوان من الثيم).
 * ================================================================
 */

(function () {
  'use strict';

  window.ITWS_SETTINGS_DEFAULTS = {

    // =============================================================
    // 1) app_identity — هوية المنصة
    // =============================================================
    app_identity: {
      name:               'نقابة تكنولوجيا المعلومات والبرمجيات',
      name_short:         'ITWS',
      name_en:            'IT Workers Syndicate',
      tagline:            'نحو نقابة رقمية تخدم أعضاءها على مدار الساعة',
      description:        'المنصة الرقمية الموحدة لنقابة تكنولوجيا المعلومات — التحقق من الشهادات، إدارة الأكاديميات، متابعة الطلبات، وبوابات متكاملة للأكاديميات والفروع.',
      logo_url:           'assets/images/logo.svg',
      logo_alt:           'شعار النقابة',
      stamp_url:          'assets/images/stamp.png',
      favicon_url:        'assets/images/logo.svg',
      email:              'info@itws.gov.eg',
      phone:              '+20 2 1234 5678',
      address:            'القاهرة — مدينة نصر — الحي الحكومي',
      website:            'https://itworkerssyndicate.github.io/academymangment/',
      founded_year:       2018,
      head_name:          'أ.د. محمد النقيب',
      head_title:         'نقيب تكنولوجيا المعلومات',
      head_image:         'assets/images/head.jpg',
      committee_name:     'لجنة التحول الرقمي والتدريب'
    },

    // =============================================================
    // 2) behavior — السلوك العام
    // =============================================================
    behavior: {
      default_lang:           'ar',
      default_dir:            'rtl',
      timezone:               'Africa/Cairo',
      date_format:            'DD/MM/YYYY',
      time_format:            'HH:mm',
      datetime_format:        'DD/MM/YYYY HH:mm',
      currency:               'EGP',
      currency_symbol:        'ج.م',
      numbers_locale:         'ar-EG',
      pagination_default:     20,
      pagination_options:     [10, 20, 50, 100],
      search_debounce_ms:     300,
      auto_save_delay_ms:     1000,
      confirm_delete:         true,
      confirm_logout:         true,
      toast_position:         'top-center',
      toast_duration_ms:      4000,
      empty_state_illustration: true
    },

    // =============================================================
    // 3) theme — الثيمات
    // =============================================================
    theme: {
      default_theme:          'neon-dark',
      allow_user_override:    true,
      fade_transition_ms:     200,
      storage_key:            'itws_theme',
      enable_theme_panel:     true,
      show_all_themes:        true,
      total_themes:           28,
      fallback_theme:         'neon-dark',
      respect_system_pref:    false
    },

    // =============================================================
    // 4) security — الأمان العام (deterrent + منطق)
    //    ⚠️ RLS دايماً شغالة في DB — ده طبقة JS فقط
    // =============================================================
    security: {
      enable_security_layer:      true,
      disable_f12:                true,
      disable_devtools:           true,
      disable_right_click:        true,
      disable_copy:               true,
      disable_paste:              false,
      disable_cut:                false,
      disable_select:             false,
      disable_drag_images:        true,
      disable_print_screen:       true,
      disable_ctrl_s:             true,
      disable_ctrl_u:             true,
      disable_ctrl_p:             false,
      excluded_selectors:         ['input', 'textarea', '[contenteditable]', 'select'],
      show_console_warning:       true,
      log_suspicious_activity:    true,
      max_violations_before_flag: 5,
      violation_window_seconds:   60
    },

    // =============================================================
    // 5) session — إدارة الجلسة
    // =============================================================
    session: {
      idle_timeout_minutes:       30,
      warning_before_minutes:     2,
      refresh_on_activity:        true,
      max_concurrent_sessions:    3,
      force_logout_on_new_device: false,
      remember_me_days:           30,
      auto_logout_on_browser_close: false,
      redirect_after_login:       'home.html',
      redirect_after_logout:      'login.html',
      session_storage:            'supabase'
    },

    // =============================================================
    // 6) password — سياسة كلمات المرور
    // =============================================================
    password: {
      min_length:              8,
      max_length:              64,
      require_uppercase:       true,
      require_lowercase:       true,
      require_number:          true,
      require_symbol:          true,
      prevent_reuse_count:     3,
      expiration_days:         0,
      show_strength_meter:     true,
      strength_thresholds:     { weak: 40, medium: 60, strong: 80, very_strong: 90 },
      allow_common_passwords:  false
    },

    // =============================================================
    // 7) two_factor — المصادقة الثنائية
    // =============================================================
    two_factor: {
      enabled:               false,
      required_for_roles:    ['super_admin', 'committee_head'],
      methods:               ['totp', 'email'],
      default_method:        'totp',
      backup_codes_count:    10,
      remember_device_days:  30
    },

    // =============================================================
    // 8) uploads — رفع الملفات
    // =============================================================
    uploads: {
      max_size_mb:           5,
      max_files_per_request: 10,
      allowed_image_types:   ['jpg', 'jpeg', 'png', 'webp', 'svg'],
      allowed_doc_types:     ['pdf', 'doc', 'docx'],
      allowed_video_types:   ['mp4', 'webm'],
      allowed_audio_types:   ['mp3', 'wav'],
      compress_images:       true,
      compress_quality:      0.85,
      generate_thumbnails:   true,
      thumbnail_size:        200,
      buckets: {
        public:      'public-assets',
        documents:   'academy-documents',
        certificates:'certificate-pdfs'
      }
    },

    // =============================================================
    // 9) certificates — الشهادات
    // =============================================================
    certificates: {
      code_format:                  'ITWS-{YEAR}-{RANDOM6}',
      code_length:                  16,
      hash_algorithm:               'sha256',
      validity_years:               0,
      require_approval:             true,
      auto_generate_pdf:            true,
      pdf_template_default:         'classic',
      pdf_page_size:                'A4',
      pdf_orientation:              'landscape',
      show_qr_code:                 true,
      qr_base_url:                  'https://itworkerssyndicate.github.io/academymangment/verify.html?id=',
      show_stamp:                   true,
      show_signature:               true,
      allow_revocation:             true,
      revocation_reasons:           ['fraud', 'expired', 'request', 'other'],
      verify_rate_limit_per_hour:   100
    },

    // =============================================================
    // 10) accreditation — اعتماد الأكاديميات
    // =============================================================
    accreditation: {
      require_documents:            true,
      required_documents:           ['commercial_register', 'tax_card', 'owner_id', 'premises_contract'],
      max_documents:                10,
      stages:                       ['submitted', 'under_review', 'documents_check', 'site_visit', 'approved', 'rejected'],
      default_stage:                'submitted',
      sla_days_per_stage:           { submitted: 2, under_review: 5, documents_check: 3, site_visit: 7, approved: 0, rejected: 0 },
      allow_resubmission:           true,
      max_resubmissions:            2,
      application_fee:              0,
      auto_assign_reviewer:         true,
      notify_on_stage_change:       true
    },

    // =============================================================
    // 11) ratings — التقييمات
    // =============================================================
    ratings: {
      enabled:              true,
      scale:                5,
      scale_labels:         { 1: 'ضعيف', 2: 'مقبول', 3: 'جيد', 4: 'جيد جداً', 5: 'ممتاز' },
      min_reviews_to_show:  3,
      require_verified:     true,
      allow_anonymous:      false,
      require_comment:      false,
      min_comment_length:   10,
      max_comment_length:   500,
      weighted_average:     true,
      show_breakdown:       true
    },

    // =============================================================
    // 12) notifications — الإشعارات
    // =============================================================
    notifications: {
      in_app_enabled:         true,
      email_enabled:          true,
      push_enabled:           false,
      sms_enabled:            false,
      whatsapp_enabled:       false,
      default_channel:        'in_app',
      batch_email_interval_minutes: 5,
      max_per_user_per_day:   50,
      retention_days:         90,
      mark_read_on_open:      true,
      sound_enabled:          false,
      desktop_notifications:  false,
      template_defaults: {
        welcome:            true,
        certificate_issued: true,
        request_status:     true,
        rating_received:    true,
        password_changed:   true
      }
    },

    // =============================================================
    // 13) realtime — التحديثات الفورية
    // =============================================================
    realtime: {
      enabled:            true,
      provider:           'supabase',
      tables:             ['settings', 'academies', 'certificates', 'requests', 'notifications', 'ratings'],
      debounce_ms:        500,
      polling_fallback:   true,
      polling_interval_s: 30,
      reconnect_attempts: 5,
      reconnect_delay_ms: 2000,
      show_connection_state: true,
      pause_when_hidden:  true
    },

    // =============================================================
    // 14) splash — شاشة البداية
    // =============================================================
    splash: {
      enabled:            true,
      min_duration_ms:    2200,
      max_duration_ms:    4500,
      skip_on_return:     true,
      skip_param:         'skip_splash',
      loading_texts:      ['جاري التحميل...', 'تحضير المنصة...', 'مرحباً بك...'],
      text_cycle_ms:      1200,
      show_logo:          true,
      show_progress:      true,
      progress_style:     'bar',
      background_style:   'gradient'
    },

    // =============================================================
    // 15) footer — التذييل
    // =============================================================
    footer: {
      copyright:          '© 2025 نقابة تكنولوجيا المعلومات والبرمجيات. جميع الحقوق محفوظة.',
      show_social:        true,
      show_newsletter:    false,
      show_bottom_links:  true,
      bottom_links: [
        { label: 'سياسة الخصوصية', href: 'home.html#privacy' },
        { label: 'الشروط والأحكام', href: 'home.html#terms' },
        { label: 'خريطة الموقع',    href: 'home.html#sitemap' }
      ],
      social: [
        { id: 'facebook', icon: 'facebook', href: 'https://facebook.com/itws', label: 'فيسبوك' },
        { id: 'twitter',  icon: 'twitter',  href: 'https://twitter.com/itws',  label: 'تويتر' },
        { id: 'linkedin', icon: 'linkedin', href: 'https://linkedin.com/company/itws', label: 'لينكدإن' },
        { id: 'youtube',  icon: 'youtube',  href: 'https://youtube.com/@itws', label: 'يوتيوب' }
      ]
    },

    // =============================================================
    // 16) features — Feature Flags
    // =============================================================
    features: {
      verify_enabled:         true,
      student_portal:         true,
      academy_directory:      true,
      academy_apply:          true,
      track_requests:         true,
      admin_panel:            true,
      portal_enabled:         true,
      branch_enabled:         true,
      cv_builder:             true,
      ratings_enabled:        true,
      ratings_public:         true,
      certificates_pdf:       true,
      certificates_qr:        true,
      notifications_enabled:  true,
      ai_assistant:           false,
      multi_language:         false,
      dark_mode_only:         false
    },

    // =============================================================
    // 17) accessibility — إمكانية الوصول
    // =============================================================
    accessibility: {
      respect_reduced_motion:     true,
      respect_high_contrast:      true,
      respect_dark_mode_pref:     false,
      min_touch_target_px:        44,
      min_font_size_px:           14,
      focus_visible_outline:      true,
      skip_to_content_link:       true,
      aria_labels_required:       true,
      keyboard_navigation:        true,
      screen_reader_announcements: true,
      allow_font_size_adjust:     true,
      max_font_scale:             1.5
    },

    // =============================================================
    // 18) performance — الأداء
    // =============================================================
    performance: {
      lazy_load_images:           true,
      lazy_load_videos:           true,
      lazy_load_iframes:          true,
      prefetch_links:             false,
      preconnect_supabase:        true,
      dns_prefetch_fonts:         true,
      minify_html:                false,
      cache_static_days:          7,
      service_worker_enabled:     false,
      offline_mode_enabled:       false,
      compress_assets:            true,
      defer_non_critical_js:      true,
      preload_fonts:              true
    },

    // =============================================================
    // 19) dev — أدوات المطور (تُطفى في prod)
    // =============================================================
    dev: {
      debug_mode:                 false,
      verbose_logging:            false,
      show_fps_monitor:           false,
      show_debug_panel:           false,
      log_supabase_queries:       false,
      log_realtime_events:        false,
      show_component_bounds:      false,
      mock_data_enabled:          false,
      dry_run_payments:           true,
      bypass_rate_limit:          false,
      strict_validation:          true,
      show_setting_keys:          false
    },

    // =============================================================
    // 20) integrations — التكاملات الخارجية
    // =============================================================
    integrations: {
      email_provider:             'supabase',
      sms_provider:               'none',
      whatsapp_provider:          'none',
      payment_provider:           'none',
      analytics_provider:         'none',
      maps_provider:              'none',
      storage_provider:           'supabase',
      pdf_engine:                 'html2pdf',
      qr_generator:               'supabase',
      backup_provider:            'supabase',
      webhook_endpoints:          [],
      api_rate_limit_per_minute:  60,
      enable_cors_for_origins:    ['https://itworkerssyndicate.github.io']
    }

  };

  // =============================================================
  // قفل الملف بعد التحميل (منع التعديل من الكونسول)
  // =============================================================
  if (typeof Object.freeze === 'function') {
    try {
      // Freeze shallow — المطور يقدر يعدل قيم بس مش يضيف مجموعات جديدة
      var groups = window.ITWS_SETTINGS_DEFAULTS;
      for (var k in groups) {
        if (Object.prototype.hasOwnProperty.call(groups, k)) {
          Object.freeze(groups[k]);
        }
      }
    } catch (e) {}
  }

})();
