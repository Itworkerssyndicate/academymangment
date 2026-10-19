// ============================================
// [NEW] ITWS Platform - Settings Defaults
// Path: assets/js/settings-defaults.js
// ============================================
// 💡 القيم الافتراضية لكل إعداد في التطبيق
// 💡 تُستخدم كـ fallback لو Supabase مش متاح
// 💡 أي قيمة هنا يمكن للنقيب تغييرها من /admin/settings
// ============================================

window.ITWS_SETTINGS_DEFAULTS = {

  // ============================================
  // 1. SPLASH SCREEN (شاشة الترحيب)
  // ============================================
  splash: {
    // عام
    enabled: true,                    // تفعيل/تعطيل الشاشة بالكامل
    min_duration_ms: 2200,            // أقل مدة للعرض
    max_duration_ms: 6000,            // أقصى مدة (أمان)

    // النصوص
    loading_texts: [
      'جاري تحميل الإعدادات...',
      'جاري التحقق من الجلسة...',
      'جاري تجهيز المنصة...',
      'على وشك الدخول...'
    ],

    // المكونات (إظهار/إخفاء)
    show_logo: true,
    show_hexagon: true,
    show_rings: true,
    show_particles: true,
    show_progress_circular: true,
    show_progress_bar: true,
    show_status_text: true,
    show_president_footer: true,
    show_shimmer: true,

    // التخصيص
    particles_count: 18,
    animation_level: 'full',          // 'full' | 'reduced' | 'none'

    // نصوص إضافية
    status_loading: 'جاري التحميل',
    status_redirecting: 'على وشك الدخول...'
  },

  // ============================================
  // 2. APP IDENTITY (هوية التطبيق)
  // ============================================
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
    website_url: 'https://itws.eg'
  },

  // ============================================
  // 3. BEHAVIOR (سلوك التطبيق)
  // ============================================
  behavior: {
    // الخط
    font_family: 'Cairo',             // 'Cairo' | 'Tajawal' | 'Almarai' | 'Noto Kufi Arabic'
    font_size: '16px',

    // التوجيه
    redirect_guest_to: '/home.html',
    redirect_admin_to: '/admin/index.html',
    redirect_user_to: '/home.html',

    // الجلسة
    session_timeout_minutes: 30,
    max_login_attempts: 5,
    heartbeat_interval_ms: 60000,
    online_threshold_ms: 120000,

    // الميزات
    enable_registration: false,
    enable_theme_picker_for_visitors: true,
    enable_dark_mode_toggle: true,
    enable_search: true,
    enable_cv_builder: true,

    // الصفحة الرئيسية
    home_show_stats: true,
    home_show_recent_academies: true,
    home_show_quick_actions: true,
    home_stats_academies_count: 6,

    // البحث
    search_min_chars: 2,
    search_debounce_ms: 300,
    search_max_results: 50,

    // الترقيم
    pagination_admin_size: 20,
    pagination_public_size: 12
  },

  // ============================================
  // 4. THEME (الثيم)
  // ============================================
  theme: {
    default_theme: 'watanii_dark',
    allow_user_override: true,
    fade_transition_ms: 200
  },

  // ============================================
  // 5. ACCREDITATION (الاعتماد)
  // ============================================
  accreditation: {
    // مسميات المراحل (قابلة للتعديل)
    stages: {
      submitted: 'تم التقديم',
      documents_review: 'مراجعة المستندات',
      site_visit: 'زيارة الموقع',
      committee_review: 'لجنة المراجعة',
      final_approval: 'الموافقة النهائية',
      approved: 'معتمدة',
      rejected: 'مرفوضة'
    },

    // المدد المتوقعة (SLA)
    sla_days: {
      submitted: 3,
      documents_review: 3,
      site_visit: 14,
      committee_review: 7,
      final_approval: 5
    },

    // متطلبات
    min_branches: 1,
    min_courses: 1,
    require_payment_receipt: false,
    require_place_photo: true,
    require_tax_card: true,
    require_commercial_registry: true
  },

  // ============================================
  // 6. CERTIFICATES (الشهادات)
  // ============================================
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

  // ============================================
  // 7. SECURITY (الأمان)
  // ============================================
  security: {
    max_login_attempts: 5,
    lockout_minutes: 15,
    session_timeout_minutes: 30,
    require_email_verification: false,
    allow_password_reset: true
  },

  // ============================================
  // 8. UPLOADS (الرفع)
  // ============================================
  uploads: {
    max_image_size_mb: 2,
    max_document_size_mb: 10,
    allowed_image_types: ['image/jpeg', 'image/png', 'image/webp', 'image/svg+xml'],
    allowed_document_types: ['application/pdf', 'image/jpeg', 'image/png'],
    cloudinary_cloud_name: 'dvxh9l4lv',
    cloudinary_upload_preset: 'itwsAcaCertification'
  },

  // ============================================
  // 9. FOOTER (تذييل الصفحة)
  // ============================================
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

  // ============================================
  // 10. FEATURES (ميزات قابلة للتشغيل/الإيقاف)
  // ============================================
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
