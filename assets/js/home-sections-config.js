/**
 * ================================================================
 * ITWS HOME SECTIONS CONFIG — V1
 * ================================================================
 * ده الملف الوحيد اللي هتعدل فيه كل حاجة في الصفحة الرئيسية.
 *
 * - ترتيب التبويبات: غيّر رقم order (الأصغر يظهر الأول)
 * - إخفاء تبويب: enabled: false
 * - تغيير أي نص: عدل title / subtitle / description
 * - إضافة كارت: ضيف في array الـ items
 * - إضافة تبويب جديد: ضيف section جديدة بـ customHtml
 *
 * كل الإعدادات دي قابلة للتجاوز من DB عبر settings.home_sections
 * (يعني الأدمن يقدر يغيرها من لوحة التحكم بدون تعديل الملف)
 * ================================================================
 */

window.ITWS_HOME_SECTIONS = {

  version: 1,

  // =============================================================
  // 1) إعدادات عامة للصفحة
  // =============================================================
  global: {
    showParticles:      true,   // Canvas particles في الخلفية
    particleCount:      60,     // عدد النقط
    showBgGrid:         true,   // grid الخلفية
    showBgGlow:         true,   // glows (accent + accent-2)
    showLiveClock:      true,   // الساعة في الـ code card
    showThemePanel:     true,   // زر تغيير الثيم
    showMobileMenu:     true,   // قائمة الموبايل
    scrollAnimation:    'fadeUp', // 'fadeUp' | 'fadeIn' | 'none'
    lazyLoadIcons:      true
  },

  // =============================================================
  // 2) الـ Navbar (اللينكات اللي فوق)
  // =============================================================
  navbar: {
    brandName: 'نقابة تكنولوجيا المعلومات',
    brandNameShort: 'ITWS',
    logoUrl: 'assets/images/logo.svg',
    links: [
      { id: 'home',     label: 'الرئيسية',    href: 'home.html',     order: 10, enabled: true },
      { id: 'verify',   label: 'التحقق',      href: 'verify.html',   order: 20, enabled: true },
      { id: 'student',  label: 'المتدرب',     href: 'student.html',  order: 30, enabled: true },
      { id: 'academies',label: 'الأكاديميات', href: 'academies.html',order: 40, enabled: true },
      { id: 'track',    label: 'متابعة طلب',  href: 'track.html',    order: 50, enabled: true },
      { id: 'apply',    label: 'تقديم',       href: 'academy-apply.html', order: 60, enabled: true }
    ],
    ctaButton: {
      enabled: true,
      label: 'دخول',
      href: 'login.html',
      icon: 'login'
    }
  },

  // =============================================================
  // 3) ترتيب التبويبات في الصفحة
  //    الأصغر = الأول. عايز Hero يبقى آخر حاجة؟ خليه 999.
  // =============================================================
  sections: [

    // -----------------------------------------------------------
    // HERO — أول حاجة بيشوفها الزائر
    // -----------------------------------------------------------
    {
      id: 'hero',
      enabled: true,
      order: 10,
      badge: 'منصة النقابة الرقمية',
      title: 'تحقق من شهاداتك',
      titleGradient: 'بثقة وشفافية',
      subtitle: 'نظام رقمي متكامل للتحقق من الشهادات وإدارة الأكاديميات',
      description: 'منصة النقابة تتيح لك التحقق من صحة أي شهادة صادرة عن الأكاديميات المعتمدة في ثوانٍ، مع متابعة كاملة للطلبات والشهادات.',
      primaryCta: {
        enabled: true,
        label: 'تحقق الآن',
        href: 'verify.html',
        icon: 'search'
      },
      secondaryCta: {
        enabled: true,
        label: 'تصفح الأكاديميات',
        href: 'academies.html',
        icon: 'arrow-left'
      },
      codeCard: {
        enabled: true,
        filename: 'verify.sh',
        codeLines: [
          '$ itws verify --id 29001010101234',
          '> searching certificates...',
          '> found 3 certificates',
          '> status: ACTIVE',
          '> done in 0.42s'
        ]
      }
    },

    // -----------------------------------------------------------
    // STATS — أرقام سريعة
    // -----------------------------------------------------------
    {
      id: 'stats',
      enabled: true,
      order: 15,
      items: [
        { id: 'academies',   label: 'أكاديمية معتمدة', value: '150+',  icon: 'building' },
        { id: 'certificates',label: 'شهادة موثقة',     value: '12K+',  icon: 'certificate' },
        { id: 'students',    label: 'متدرب',           value: '50K+',  icon: 'users' },
        { id: 'branches',    label: 'فرع',             value: '27',    icon: 'map-pin' }
      ]
    },

    // -----------------------------------------------------------
    // ABOUT — عن المنصة
    // -----------------------------------------------------------
    {
      id: 'about',
      enabled: true,
      order: 20,
      badge: 'عن المنصة',
      title: 'منصة رقمية',
      titleGradient: 'متكاملة',
      description: 'صممت المنصة لتكون البوابة الرقمية الموحدة لنقابة تكنولوجيا المعلومات، حيث تربط بين المتدربين والأكاديميات والفروع والإدارة في نظام واحد شفاف وآمن.',
      items: [
        { id: 'speed',   icon: 'zap',       title: 'تحقق فوري',      description: 'التحقق من الشهادات في أقل من ثانية' },
        { id: 'secure',  icon: 'shield',    title: 'أمان متكامل',    description: 'تشفير كامل وحماية للبيانات وفق أحدث المعايير' },
        { id: 'track',   icon: 'eye',       title: 'شفافية كاملة',   description: 'تتبع كل طلب خطوة بخطوة مع سجل كامل' }
      ]
    },

    // -----------------------------------------------------------
    // HEAD — كلمة النقيب
    // -----------------------------------------------------------
    {
      id: 'head',
      enabled: true,
      order: 25,
      badge: 'كلمة النقيب',
      title: 'رسالة من',
      titleGradient: 'النقيب',
      personName: 'أ.د. محمد النقيب',
      personRole: 'نقيب تكنولوجيا المعلومات',
      personImage: 'assets/images/head.jpg',
      message: 'نؤمن بأن التحول الرقمي ليس مجرد تقنية، بل ثقافة. منصتنا هي خطوتنا الأولى نحو نقابة رقمية تخدم أعضاءها على مدار الساعة، وتضمن لهم الشفافية والسرعة والدقة في كل معاملة.',
      signature: '— نقيب تكنولوجيا المعلومات'
    },

    // -----------------------------------------------------------
    // FEATURES — المميزات
    // -----------------------------------------------------------
    {
      id: 'features',
      enabled: true,
      order: 30,
      badge: 'المميزات',
      title: 'لماذا',
      titleGradient: 'منصتنا',
      description: 'كل ما تحتاجه في مكان واحد، مصمم بأحدث التقنيات ووفق أعلى معايير الجودة',
      items: [
        {
          id: 'verify', icon: 'shield-check',
          title: 'تحقق موثوق',
          description: 'كل شهادة مربوطة بقاعدة بيانات مركزية مع hash فريد يضمن عدم التزوير',
          link: 'verify.html', linkLabel: 'جرّب الآن'
        },
        {
          id: 'multi', icon: 'layers',
          title: 'إدارة متعددة المستويات',
          description: 'أدوار متعددة من النقيب حتى المتدرب مع صلاحيات دقيقة لكل مستوى',
          link: 'academies.html', linkLabel: 'اعرف أكثر'
        },
        {
          id: 'realtime', icon: 'activity',
          title: 'تحديثات فورية',
          description: 'كل تغيير في البيانات يظهر فوراً لكل المستخدمين المتصلين عبر realtime',
          link: 'track.html', linkLabel: 'تابع طلبك'
        },
        {
          id: 'reports', icon: 'bar-chart',
          title: 'تقارير تحليلية',
          description: 'لوحة تحكم شاملة مع رسوم بيانية وتقارير قابلة للتصدير بصيغ متعددة',
          link: 'login.html', linkLabel: 'دخول الإدارة'
        },
        {
          id: 'mobile', icon: 'smartphone',
          title: 'متوافق مع الجوال',
          description: 'تجربة سلسة على جميع الأجهزة مع دعم كامل للـ PWA والوضع الليلي',
          link: 'home.html', linkLabel: 'اكتشف'
        },
        {
          id: 'api', icon: 'code',
          title: 'واجهات API',
          description: 'واجهات برمجية موثقة تتيح الربط مع أنظمة الأكاديميات الحالية',
          link: 'academies.html', linkLabel: 'للمطورين'
        }
      ]
    },

    // -----------------------------------------------------------
    // SERVICES — الخدمات / الأنواع
    // -----------------------------------------------------------
    {
      id: 'services',
      enabled: true,
      order: 40,
      badge: 'الخدمات',
      title: 'خدمات',
      titleGradient: 'النقابة',
      description: 'مجموعة متكاملة من الخدمات الرقمية لأعضاء النقابة والأكاديميات',
      items: [
        { id: 'verify-service',   icon: 'search',      title: 'التحقق من الشهادات', description: 'تحقق من أي شهادة صادرة عن أكاديمية معتمدة', link: 'verify.html' },
        { id: 'academy-reg',      icon: 'building',    title: 'تسجيل الأكاديميات',  description: 'قدّم طلب اعتماد أكاديميتك إلكترونياً', link: 'academy-apply.html' },
        { id: 'student-portal',   icon: 'graduation',  title: 'بوابة المتدرب',       description: 'اعرض شهاداتك وحمّل سيرتك الذاتية', link: 'student.html' },
        { id: 'track-service',    icon: 'clock',       title: 'متابعة الطلبات',      description: 'تابع حالة طلبك لحظة بلحظة', link: 'track.html' },
        { id: 'branch-portal',    icon: 'map-pin',     title: 'بوابة الفروع',        description: 'إدارة الفرع والأكاديميات التابعة له', link: 'login.html' },
        { id: 'admin-portal',     icon: 'settings',    title: 'لوحة الإدارة',        description: 'إدارة كاملة للنظام والصلاحيات', link: 'login.html' }
      ]
    },

    // -----------------------------------------------------------
    // STEPS — خطوات العمل
    // -----------------------------------------------------------
    {
      id: 'steps',
      enabled: true,
      order: 50,
      badge: 'كيف تعمل',
      title: 'خطوات',
      titleGradient: 'بسيطة',
      description: 'من التسجيل حتى استلام الشهادة، كل شيء رقمي وشفاف',
      items: [
        { number: '01', icon: 'user-plus',  title: 'سجّل حسابك',       description: 'أنشئ حسابك كمتدرب أو أكاديمية في دقيقة واحدة' },
        { number: '02', icon: 'file-text',  title: 'قدّم طلبك',        description: 'املأ النموذج وارفع المستندات المطلوبة' },
        { number: '03', icon: 'check-circle', title: 'مراجعة واعتماد', description: 'فريق النقابة يراجع طلبك ويصدر القرار' },
        { number: '04', icon: 'award',      title: 'استلم شهادتك',     description: 'حمّل شهادتك الرقمية الموثقة فوراً' }
      ]
    },

    // -----------------------------------------------------------
    // CTA — نداء أخير
    // -----------------------------------------------------------
    {
      id: 'cta',
      enabled: true,
      order: 60,
      badge: 'ابدأ الآن',
      title: 'جاهز للانضمام',
      titleGradient: 'إلينا؟',
      description: 'انضم لآلاف المتدربين والأكاديميات الذين يثقون بمنصتنا',
      primaryCta:   { enabled: true, label: 'سجّل حساب جديد', href: 'login.html?mode=register', icon: 'user-plus' },
      secondaryCta: { enabled: true, label: 'تواصل معنا',    href: 'home.html#contact',       icon: 'mail' }
    },

    // -----------------------------------------------------------
    // FOOTER
    // -----------------------------------------------------------
    {
      id: 'footer',
      enabled: true,
      order: 70,
      brandName: 'نقابة تكنولوجيا المعلومات',
      tagline: 'نحو نقابة رقمية تخدم أعضاءها على مدار الساعة',
      columns: [
        {
          id: 'about', title: 'عن النقابة',
          links: [
            { label: 'من نحن', href: 'home.html#about' },
            { label: 'الرؤية والرسالة', href: 'home.html#vision' },
            { label: 'مجلس النقابة', href: 'home.html#board' },
            { label: 'الفروع', href: 'home.html#branches' }
          ]
        },
        {
          id: 'services', title: 'الخدمات',
          links: [
            { label: 'التحقق من شهادة', href: 'verify.html' },
            { label: 'تسجيل أكاديمية', href: 'academy-apply.html' },
            { label: 'بوابة المتدرب', href: 'student.html' },
            { label: 'متابعة طلب', href: 'track.html' }
          ]
        },
        {
          id: 'contact', title: 'تواصل معنا',
          links: [
            { label: 'info@itws.gov.eg', href: 'mailto:info@itws.gov.eg' },
            { label: '+20 2 1234 5678', href: 'tel:+20212345678' },
            { label: 'القاهرة — مدينة نصر', href: 'home.html#contact' }
          ]
        }
      ],
      social: [
        { id: 'facebook', icon: 'facebook', href: 'https://facebook.com/itws', label: 'فيسبوك' },
        { id: 'twitter',  icon: 'twitter',  href: 'https://twitter.com/itws',  label: 'تويتر' },
        { id: 'linkedin', icon: 'linkedin', href: 'https://linkedin.com/company/itws', label: 'لينكدإن' },
        { id: 'youtube',  icon: 'youtube',  href: 'https://youtube.com/@itws', label: 'يوتيوب' }
      ],
      copyright: '© 2025 نقابة تكنولوجيا المعلومات والبرمجيات. جميع الحقوق محفوظة.',
      bottomLinks: [
        { label: 'سياسة الخصوصية', href: 'home.html#privacy' },
        { label: 'الشروط والأحكام', href: 'home.html#terms' },
        { label: 'خريطة الموقع', href: 'home.html#sitemap' }
      ]
    }
  ]
};

// =============================================================
// مثال: لو عايز تخفي تبويب مؤقتاً
// =============================================================
// غير enabled: true → enabled: false
//
// مثال: لو عايز تغير ترتيب "about" يبقى الأول قبل "hero"
// غير order: 20 → order: 5
//
// مثال: لو عايز تضيف تبويب جديد خالص
// ضيف object جديد في sections array:
// {
//   id: 'my-new-section',
//   enabled: true,
//   order: 35,
//   customHtml: '<div class="section"><h2>محتوى جديد</h2></div>'
// }
// =============================================================
