// ============================================
// ITWS Platform - Settings Defaults
// Path: assets/js/settings-defaults.js
// ============================================

window.ITWS_SETTINGS_DEFAULTS = {

  splash: {
    enabled: true,
    min_duration_ms: 2200,
    max_duration_ms: 6000,
    loading_texts: [
      'جاري تحميل الإعدادات...',
      'جاري التحقق من الجلسة...',
      'جاري تجهيز المنصة...',
      'على وشك الدخول...'
    ],
    show_logo: true,
    show_hexagon: true,
    show_rings: true,
    show_particles: true,
    show_progress_circular: true,
    show_progress_bar: true,
    show_status_text: true,
    show_president_footer: true,
    show_shimmer: true,
    particles_count: 18,
    animation_level: 'full',
    status_loading: 'جاري التحميل',
    status_redirecting: 'على وشك الدخول...'
  },

  app_identity: {
    union_name: 'نقابة تكنولوجيا المعلومات والبرمجيات',
    union_name_en: 'ITWS',
    committee_name: 'لجنة التحول الرقمي والتدريب',
    committee_head_name: 'د. أحمد محمد',
    president_name: 'المحاسب / محمود جميل',
    president_label: 'النقيب العام:',
    president_footer: 'النقيب العام:',
    footer_text: '© 2026 نقابة تكنولوجيا المعلومات والبرمجيات',
    logo_url: null,
    stamp_url: null,
    contact_email: 'info@itws.eg',
    contact_phone: '01234567890',
    website_url: 'https://itws.eg',

    hero_title: '',
    hero_subtitle: '',

    footer_link: {
      enabled: true,
      text: 'الموقع الرسمي للنقابة',
      url: 'https://itws.eg'
    },

    about_section: {
      enabled: true,
      title: 'لماذا هذه المنصة؟',
      subtitle: 'النظام الرسمي للتحقق من صحة الشهادات التدريبية',
      features: [
        {
          title: 'التحقق الفوري',
          description: 'تأكد من صحة أي شهادة في ثوانٍ من خلال الكود المطبوع عليها'
        },
        {
          title: 'موثوق 100%',
          description: 'كل شهادة صادرة عن أكاديمية معتمدة رسمياً من النقابة'
        },
        {
          title: 'متاح 24/7',
          description: 'خدمة التحقق متاحة على مدار الساعة من أي مكان'
        }
      ]
    },

    custom_section: {
      enabled: true,
      title: 'قسم مخصص',
      subtitle: 'يمكنك تعديل هذا القسم بالكامل من الإعدادات',
      content: 'هذا القسم قابل للتخصيص الكامل. يمكنك تغيير العنوان والمحتوى والزر من صفحة الإعدادات.',
      button_text: 'اعرف المزيد',
      button_url: 'https://itws.eg'
    }
  },

  behavior: {
    font_family: 'Cairo',
    font_size: '16px',
    redirect_guest_to: 'home.html',
    redirect_admin_to: 'admin/index.html',
    redirect_user_to: 'home.html',
    session_timeout_minutes: 30,
    max_login_attempts: 5,
    heartbeat_interval_ms: 60000,
    online_threshold_ms: 120000,
    enable_registration: false,
    enable_theme_picker_for_visitors: true,
    enable_dark_mode_toggle: true,
    enable_search: true,
    enable_cv_builder: true,
    home_show_stats: false,
    home_show_recent_academies: true,
    home_show_quick_actions: true,
    home_show_about_section: true,
    home_show_custom_section: true,
    home_stats_academies_count: 6,
    search_min_chars: 2,
    search_debounce_ms: 300,
    search_max_results: 50,
    pagination_admin_size: 20,
    pagination_public_size: 12
  },

  theme: {
    default_theme: 'watanii_dark',
    allow_user_override: true,
    fade_transition_ms: 200
  },

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
    min_branches: 1,
    min_courses: 1,
    require_payment_receipt: false,
    require_place_photo: true,
    require_tax_card: true,
    require_commercial_registry: true
  },

  certificates: {
    code_prefix: 'NTI',
    code_pattern: 'NTI-{year}-{random}',
    random_length: 6,
    grades: ['A+', 'A', 'B+', 'B', 'C+', 'C', 'D', 'F'],
    show_qr: true,
    show_stamp: true,
    show_committee_head_signature: true,
    show_president_signature: true
  },

  security: {
    max_login_attempts: 5,
    lockout_minutes: 15,
    session_timeout_minutes: 30,
    require_email_verification: false,
    allow_password_reset: true
  },

  uploads: {
    max_image_size_mb: 2,
    max_document_size_mb: 10,
    allowed_image_types: ['image/jpeg', 'image/png', 'image/webp', 'image/svg+xml'],
    allowed_document_types: ['application/pdf', 'image/jpeg', 'image/png'],
    cloudinary_cloud_name: 'dvxh9l4lv',
    cloudinary_upload_preset: 'itwsAcaCertification'
  },

  footer: {
    show_social_links: true,
    show_president: true,
    show_copyright: true,
    copyright_text: '© 2026 نقابة تكنولوجيا المعلومات والبرمجيات',
    social_facebook: '',
    social_twitter: '',
    social_linkedin: '',
    social_youtube: ''
  },

  features: {
    enable_ai_cv: true,
    enable_ocr: true,
    enable_qr_code: true,
    enable_pdf_export: true,
    enable_excel_export: true,
    enable_whatsapp_share: true,
    enable_email_notifications: false
  }
};
