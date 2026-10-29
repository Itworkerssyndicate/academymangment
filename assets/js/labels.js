/**
 * ================================================================
 * ITWS LABELS — V2 (EXPANDED)
 * assets/js/labels.js
 * ================================================================
 * نظام النصوص المركزي متعدد المستويات.
 *
 * الفكرة:
 *   أي نص في المنصة بيتكتب كده:
 *     Labels.t('nav.home')                       → "الرئيسية"
 *     Labels.t('verify.result_count', {count:3}) → "3 نتائج"
 *     Labels.t('verify.result_count', {count:0}) → "لا توجد نتائج"
 *
 * ترتيب المصادر:
 *   1. DB (labels table) — لو محمّلة
 *   2. Embedded defaults — ~180 label
 *   3. fallback arg — القيمة اللي تبعتها
 *   4. الـ key نفسه — عشان ما يكسرش
 *
 * المزايا:
 *   - Interpolation {name} {count} {year} ...
 *   - Arabic pluralization (zero/one/two/few/many/other)
 *   - applyTo(root) — يطبق [data-label] على DOM
 *   - forPage(name) — كل نصوص صفحة مرة واحدة
 *   - Realtime sync — لو الأدمن غيّر نص
 *   - Batch load من DB
 *   - getDebugInfo()
 *
 * الترتيب في <head>:
 *   <script src="assets/js/settings-defaults.js"></script>
 *   <script src="assets/js/config.js"></script>
 *   <script src="assets/js/themes-data.js"></script>
 *   <script src="assets/js/theme.js"></script>
 *   <script src="assets/js/app-settings.js"></script>
 *   <script src="assets/js/labels.js"></script>          ← إنت هنا
 *
 * ES5-safe. Silent. بدون console.error.
 * ================================================================
 */

(function () {
  'use strict';

  // =============================================================
  // Embedded Defaults — ~180 label
  // =============================================================

  var DEFAULTS = {

    // ----- Common -----
    'common.yes': 'نعم',
    'common.no': 'لا',
    'common.ok': 'حسناً',
    'common.cancel': 'إلغاء',
    'common.save': 'حفظ',
    'common.delete': 'حذف',
    'common.edit': 'تعديل',
    'common.add': 'إضافة',
    'common.close': 'إغلاق',
    'common.back': 'رجوع',
    'common.next': 'التالي',
    'common.previous': 'السابق',
    'common.submit': 'إرسال',
    'common.search': 'بحث',
    'common.filter': 'تصفية',
    'common.reset': 'إعادة تعيين',
    'common.loading': 'جاري التحميل...',
    'common.saving': 'جاري الحفظ...',
    'common.processing': 'جاري المعالجة...',
    'common.success': 'تم بنجاح',
    'common.error': 'حدث خطأ',
    'common.warning': 'تحذير',
    'common.info': 'معلومة',
    'common.confirm': 'تأكيد',
    'common.required': 'مطلوب',
    'common.optional': 'اختياري',
    'common.all': 'الكل',
    'common.none': 'لا شيء',
    'common.other': 'أخرى',
    'common.more': 'المزيد',
    'common.less': 'أقل',
    'common.show': 'عرض',
    'common.hide': 'إخفاء',
    'common.copy': 'نسخ',
    'common.copied': 'تم النسخ',
    'common.print': 'طباعة',
    'common.download': 'تحميل',
    'common.upload': 'رفع',
    'common.refresh': 'تحديث',
    'common.retry': 'إعادة المحاولة',
    'common.view': 'عرض',
    'common.details': 'التفاصيل',
    'common.actions': 'إجراءات',
    'common.status': 'الحالة',
    'common.date': 'التاريخ',
    'common.time': 'الوقت',
    'common.name': 'الاسم',
    'common.email': 'البريد الإلكتروني',
    'common.phone': 'رقم الهاتف',
    'common.address': 'العنوان',
    'common.notes': 'ملاحظات',
    'common.description': 'الوصف',
    'common.type': 'النوع',
    'common.category': 'الفئة',
    'common.count': 'العدد',
    'common.total': 'الإجمالي',

    // ----- Nav -----
    'nav.home': 'الرئيسية',
    'nav.verify': 'التحقق',
    'nav.student': 'المتدرب',
    'nav.academies': 'الأكاديميات',
    'nav.track': 'متابعة طلب',
    'nav.apply': 'تقديم',
    'nav.login': 'دخول',
    'nav.logout': 'خروج',
    'nav.profile': 'الملف الشخصي',
    'nav.settings': 'الإعدادات',
    'nav.dashboard': 'لوحة التحكم',
    'nav.admin': 'الإدارة',
    'nav.portal': 'بوابة الأكاديمية',
    'nav.branch': 'بوابة الفرع',
    'nav.notifications': 'الإشعارات',
    'nav.help': 'المساعدة',
    'nav.contact': 'تواصل معنا',

    // ----- Auth -----
    'auth.login': 'تسجيل الدخول',
    'auth.logout': 'تسجيل الخروج',
    'auth.register': 'إنشاء حساب',
    'auth.forgot_password': 'نسيت كلمة المرور؟',
    'auth.reset_password': 'إعادة تعيين كلمة المرور',
    'auth.change_password': 'تغيير كلمة المرور',
    'auth.email': 'البريد الإلكتروني',
    'auth.password': 'كلمة المرور',
    'auth.confirm_password': 'تأكيد كلمة المرور',
    'auth.current_password': 'كلمة المرور الحالية',
    'auth.new_password': 'كلمة المرور الجديدة',
    'auth.remember_me': 'تذكرني',
    'auth.no_account': 'ليس لديك حساب؟',
    'auth.have_account': 'لديك حساب بالفعل؟',
    'auth.sign_up': 'سجّل الآن',
    'auth.sign_in': 'ادخل',
    'auth.welcome_back': 'مرحباً بعودتك',
    'auth.login_subtitle': 'أدخل بياناتك للوصول إلى حسابك',
    'auth.login_required': 'يجب تسجيل الدخول للمتابعة',
    'auth.invalid_credentials': 'بيانات الدخول غير صحيحة',
    'auth.session_expired': 'انتهت صلاحية الجلسة، يرجى الدخول مرة أخرى',
    'auth.logout_confirm': 'هل تريد تسجيل الخروج؟',
    'auth.logout_success': 'تم تسجيل الخروج بنجاح',
    'auth.password_changed': 'تم تغيير كلمة المرور بنجاح',
    'auth.password_min': 'كلمة المرور يجب أن تكون 8 أحرف على الأقل',
    'auth.password_weak': 'كلمة المرور ضعيفة',
    'auth.password_medium': 'كلمة المرور متوسطة',
    'auth.password_strong': 'كلمة المرور قوية',
    'auth.email_invalid': 'البريد الإلكتروني غير صحيح',
    'auth.password_mismatch': 'كلمتا المرور غير متطابقتين',
    'auth.account_locked': 'تم قفل الحساب مؤقتاً، حاول لاحقاً',

    // ----- Home -----
    'home.hero_badge': 'منصة النقابة الرقمية',
    'home.hero_title': 'تحقق من شهاداتك',
    'home.hero_gradient': 'بثقة وشفافية',
    'home.hero_subtitle': 'نظام رقمي متكامل للتحقق من الشهادات وإدارة الأكاديميات',
    'home.hero_desc': 'منصة النقابة تتيح لك التحقق من صحة أي شهادة صادرة عن الأكاديميات المعتمدة في ثوانٍ',
    'home.cta_verify': 'تحقق الآن',
    'home.cta_browse': 'تصفح الأكاديميات',
    'home.about_badge': 'عن المنصة',
    'home.about_title': 'منصة رقمية',
    'home.about_gradient': 'متكاملة',
    'home.head_badge': 'كلمة النقيب',
    'home.head_title': 'رسالة من',
    'home.head_gradient': 'النقيب',
    'home.features_badge': 'المميزات',
    'home.features_title': 'لماذا',
    'home.features_gradient': 'منصتنا',
    'home.services_badge': 'الخدمات',
    'home.services_title': 'خدمات',
    'home.services_gradient': 'النقابة',
    'home.steps_badge': 'كيف تعمل',
    'home.steps_title': 'خطوات',
    'home.steps_gradient': 'بسيطة',
    'home.cta_badge': 'ابدأ الآن',
    'home.cta_title': 'جاهز للانضمام',
    'home.cta_gradient': 'إلينا؟',
    'home.cta_desc': 'انضم لآلاف المتدربين والأكاديميات الذين يثقون بمنصتنا',
    'home.cta_primary': 'سجّل حساب جديد',
    'home.cta_secondary': 'تواصل معنا',

    // ----- Verify -----
    'verify.title': 'التحقق من الشهادات',
    'verify.subtitle': 'تحقق من صحة أي شهادة صادرة عن أكاديمية معتمدة',
    'verify.badge': 'التحقق الرقمي',
    'verify.search_label': 'رقم الشهادة أو كود التحقق',
    'verify.search_placeholder': 'مثال: ITWS-2025-A1B2C3',
    'verify.search_button': 'تحقق',
    'verify.searching': 'جاري التحقق...',
    'verify.not_found': 'لم يتم العثور على شهادة بهذا الرقم',
    'verify.not_found_hint': 'تأكد من الرقم أو تواصل مع الأكاديمية المصدرة',
    'verify.valid': 'شهادة صحيحة وموثقة',
    'verify.invalid': 'شهادة غير صحيحة أو ملغاة',
    'verify.revoked': 'هذه الشهادة تم إلغاؤها',
    'verify.revoked_on': 'تم الإلغاء بتاريخ {date}',
    'verify.revoked_reason': 'سبب الإلغاء: {reason}',
    'verify.certificate_number': 'رقم الشهادة',
    'verify.student_name': 'اسم المتدرب',
    'verify.academy': 'الأكاديمية',
    'verify.course': 'الدورة',
    'verify.issue_date': 'تاريخ الإصدار',
    'verify.expiry_date': 'تاريخ الانتهاء',
    'verify.grade': 'التقدير',
    'verify.hours': 'عدد الساعات',
    'verify.print': 'طباعة',
    'verify.download_pdf': 'تحميل PDF',
    'verify.share': 'مشاركة',
    'verify.copy_link': 'نسخ الرابط',
    'verify.url_hint': 'يمكنك التحقق مباشرة عبر الرابط: verify.html?id=XXX',
    'verify.result_count': '{count} نتيجة',
    'verify.instructions': 'أدخل رقم الشهادة أو كود التحقق للبدء',

    // ----- Student -----
    'student.title': 'بوابة المتدرب',
    'student.subtitle': 'اعرض شهاداتك، حمّل سيرتك الذاتية، وتابع تقدمك',
    'student.search_national_id': 'ابحث بالرقم القومي',
    'student.national_id_label': 'الرقم القومي (14 رقم)',
    'student.national_id_placeholder': '29001010101234',
    'student.national_id_invalid': 'الرقم القومي يجب أن يكون 14 رقم',
    'student.search_button': 'بحث',
    'student.searching': 'جاري البحث...',
    'student.not_found': 'لا يوجد متدرب بهذا الرقم القومي',
    'student.profile': 'الملف الشخصي',
    'student.certificates': 'الشهادات',
    'student.certificate_count': '{count} شهادة',
    'student.no_certificates': 'لا توجد شهادات حتى الآن',
    'student.build_cv': 'بناء السيرة الذاتية',
    'student.download_cv': 'تحميل السيرة الذاتية',
    'student.cv_title': 'السيرة الذاتية',
    'student.privacy_note': 'بياناتك محمية ولن يتم مشاركتها',
    'student.track_number': 'رقم المتابعة',

    // ----- Academies -----
    'academies.title': 'دليل الأكاديميات',
    'academies.subtitle': 'تصفح الأكاديميات المعتمدة من النقابة',
    'academies.search_placeholder': 'ابحث بالاسم أو المدينة...',
    'academies.filter_category': 'الفئة',
    'academies.filter_governorate': 'المحافظة',
    'academies.filter_rating': 'التقييم',
    'academies.sort': 'ترتيب حسب',
    'academies.sort_name': 'الاسم',
    'academies.sort_rating': 'التقييم',
    'academies.sort_newest': 'الأحدث',
    'academies.no_results': 'لا توجد أكاديميات تطابق البحث',
    'academies.view_details': 'عرض التفاصيل',
    'academies.rating': 'التقييم',
    'academies.reviews_count': '({count} تقييم)',
    'academies.branches_count': '{count} فرع',
    'academies.courses_count': '{count} دورة',
    'academies.verified': 'معتمدة',
    'academies.apply_now': 'تقديم الآن',

    // ----- Academy Details -----
    'academy_details.about': 'عن الأكاديمية',
    'academy_details.branches': 'الفروع',
    'academy_details.courses': 'الدورات',
    'academy_details.reviews': 'التقييمات',
    'academy_details.contact': 'تواصل',
    'academy_details.website': 'الموقع الإلكتروني',
    'academy_details.write_review': 'اكتب تقييمك',
    'academy_details.your_rating': 'تقييمك',
    'academy_details.your_comment': 'تعليقك',
    'academy_details.submit_review': 'إرسال التقييم',
    'academy_details.review_thanks': 'شكراً على تقييمك',
    'academy_details.no_reviews': 'لا توجد تقييمات حتى الآن',
    'academy_details.total_reviews': '{count} تقييم',
    'academy_details.average_rating': 'متوسط التقييم',

    // ----- Academy Apply -----
    'apply.title': 'تقديم طلب اعتماد أكاديمية',
    'apply.subtitle': 'قدّم طلب اعتماد أكاديميتك إلكترونياً',
    'apply.step_basic': 'البيانات الأساسية',
    'apply.step_contact': 'بيانات التواصل',
    'apply.step_documents': 'المستندات',
    'apply.step_review': 'المراجعة والإرسال',
    'apply.academy_name': 'اسم الأكاديمية',
    'apply.academy_name_placeholder': 'مثال: أكاديمية النيل للتقنية',
    'apply.owner_name': 'اسم المالك',
    'apply.owner_national_id': 'الرقم القومي للمالك',
    'apply.commercial_register': 'رقم السجل التجاري',
    'apply.tax_card': 'رقم البطاقة الضريبية',
    'apply.governorate': 'المحافظة',
    'apply.city': 'المدينة',
    'apply.address': 'العنوان التفصيلي',
    'apply.phone': 'رقم الهاتف',
    'apply.email': 'البريد الإلكتروني',
    'apply.website': 'الموقع الإلكتروني (اختياري)',
    'apply.category': 'فئة الأكاديمية',
    'apply.documents': 'المستندات المطلوبة',
    'apply.doc_commercial': 'صورة السجل التجاري',
    'apply.doc_tax': 'صورة البطاقة الضريبية',
    'apply.doc_owner_id': 'صورة بطاقة المالك',
    'apply.doc_premises': 'عقد مكان الأكاديمية',
    'apply.upload_button': 'رفع ملف',
    'apply.file_selected': 'تم اختيار: {name}',
    'apply.file_too_large': 'حجم الملف يتجاوز الحد المسموح',
    'apply.file_wrong_type': 'نوع الملف غير مسموح',
    'apply.submit_application': 'إرسال الطلب',
    'apply.submitting': 'جاري الإرسال...',
    'apply.success': 'تم إرسال طلبك بنجاح',
    'apply.success_tracking': 'رقم المتابعة: {tracking}',
    'apply.review_check': 'أقر بأن جميع البيانات صحيحة',
    'apply.next_step': 'التالي',
    'apply.prev_step': 'السابق',

    // ----- Track -----
    'track.title': 'متابعة طلب',
    'track.subtitle': 'تابع حالة طلبك لحظة بلحظة',
    'track.search_label': 'رقم الطلب أو البريد الإلكتروني',
    'track.search_placeholder': 'أدخل رقم الطلب',
    'track.search_button': 'متابعة',
    'track.searching': 'جاري البحث...',
    'track.not_found': 'لم يتم العثور على طلب بهذا الرقم',
    'track.status': 'حالة الطلب',
    'track.submitted_at': 'تاريخ التقديم',
    'track.last_update': 'آخر تحديث',
    'track.current_stage': 'المرحلة الحالية',
    'track.timeline': 'سجل المراحل',
    'track.stage_submitted': 'تم التقديم',
    'track.stage_under_review': 'قيد المراجعة',
    'track.stage_documents_check': 'فحص المستندات',
    'track.stage_site_visit': 'زيارة ميدانية',
    'track.stage_approved': 'تم الاعتماد',
    'track.stage_rejected': 'مرفوض',
    'track.sla_days': 'المدة المتوقعة',
    'track.sla_days_value': '{count} يوم',
    'track.notes': 'ملاحظات',

    // ----- Admin -----
    'admin.dashboard': 'لوحة التحكم',
    'admin.settings': 'الإعدادات',
    'admin.users': 'المستخدمون',
    'admin.requests': 'الطلبات',
    'admin.branches': 'الفروع',
    'admin.academies': 'الأكاديميات',
    'admin.certificates': 'الشهادات',
    'admin.reports': 'التقارير',
    'admin.activities': 'سجل الأنشطة',
    'admin.login_logs': 'سجل الدخول',
    'admin.union_courses': 'دورات النقابة',
    'admin.permissions': 'الصلاحيات',
    'admin.roles': 'الأدوار',
    'admin.welcome': 'مرحباً {name}',
    'admin.total_academies': 'إجمالي الأكاديميات',
    'admin.total_students': 'إجمالي المتدربين',
    'admin.total_certificates': 'إجمالي الشهادات',
    'admin.total_requests': 'إجمالي الطلبات',
    'admin.pending_requests': 'طلبات معلقة',
    'admin.recent_activity': 'آخر الأنشطة',
    'admin.quick_actions': 'إجراءات سريعة',

    // ----- Portal -----
    'portal.dashboard': 'لوحة الأكاديمية',
    'portal.certificates': 'الشهادات',
    'portal.issue_certificate': 'إصدار شهادة جديدة',
    'portal.my_certificates': 'شهاداتي',
    'portal.profile': 'الملف الشخصي',
    'portal.courses': 'الدورات',
    'portal.reports': 'التقارير',
    'portal.application': 'طلب الاعتماد',
    'portal.students': 'المتدربون',
    'portal.ratings': 'التقييمات',
    'portal.issued_today': 'صادر اليوم',
    'portal.total_issued': 'إجمالي الشهادات الصادرة',

    // ----- Branch -----
    'branch.dashboard': 'لوحة الفرع',
    'branch.academies': 'أكاديميات الفرع',
    'branch.certificates': 'شهادات الفرع',
    'branch.users': 'مستخدمو الفرع',
    'branch.requests': 'طلبات الفرع',
    'branch.reports': 'تقارير الفرع',
    'branch.total_academies': 'أكاديميات الفرع',
    'branch.total_certificates': 'شهادات الفرع',
    'branch.total_users': 'مستخدمو الفرع',

    // ----- Errors -----
    'error.400': 'طلب غير صحيح',
    'error.401': 'غير مصرح لك بالدخول',
    'error.403': 'ليس لديك صلاحية للوصول',
    'error.404': 'الصفحة غير موجودة',
    'error.500': 'حدث خطأ في السيرفر',
    'error.generic': 'حدث خطأ غير متوقع',
    'error.network': 'تعذر الاتصال بالشبكة',
    'error.timeout': 'انتهت مدة الطلب، حاول مرة أخرى',
    'error.validation': 'يرجى تصحيح البيانات المدخلة',
    'error.required_field': 'هذا الحقل مطلوب',
    'error.field_too_short': 'القيمة قصيرة جداً',
    'error.field_too_long': 'القيمة طويلة جداً',
    'error.invalid_format': 'الصيغة غير صحيحة',
    'error.not_authorized': 'ليس لديك صلاحية لهذا الإجراء',
    'error.rate_limited': 'عدد المحاولات تجاوز الحد، حاول لاحقاً',
    'error.offline': 'أنت غير متصل بالإنترنت',
    'error.session_expired': 'انتهت صلاحية الجلسة',
    'error.unexpected': 'حدث خطأ غير متوقع، يرجى المحاولة مرة أخرى',
    'error.not_found_generic': 'العنصر المطلوب غير موجود',
    'error.already_exists': 'العنصر موجود بالفعل',
    'error.permission_denied': 'تم رفض الإذن',

    // ----- Notifications -----
    'notif.welcome': 'مرحباً بك في منصة النقابة',
    'notif.certificate_issued': 'تم إصدار شهادة جديدة',
    'notif.certificate_revoked': 'تم إلغاء شهادة',
    'notif.request_submitted': 'تم استلام طلبك',
    'notif.request_updated': 'تم تحديث حالة طلبك',
    'notif.request_approved': 'تم اعتماد طلبك',
    'notif.request_rejected': 'تم رفض طلبك',
    'notif.rating_received': 'تلقيت تقييماً جديداً',
    'notif.password_changed': 'تم تغيير كلمة المرور',
    'notif.new_message': 'لديك رسالة جديدة',
    'notif.mark_all_read': 'تحديد الكل كمقروء',
    'notif.no_notifications': 'لا توجد إشعارات',
    'notif.unread_count': '{count} إشعار غير مقروء',

    // ----- Pages -----
    'page.home_title': 'الرئيسية | نقابة تكنولوجيا المعلومات',
    'page.verify_title': 'التحقق من الشهادات | نقابة تكنولوجيا المعلومات',
    'page.student_title': 'بوابة المتدرب | نقابة تكنولوجيا المعلومات',
    'page.academies_title': 'دليل الأكاديميات | نقابة تكنولوجيا المعلومات',
    'page.academy_details_title': 'تفاصيل الأكاديمية | نقابة تكنولوجيا المعلومات',
    'page.apply_title': 'تقديم طلب اعتماد | نقابة تكنولوجيا المعلومات',
    'page.track_title': 'متابعة الطلب | نقابة تكنولوجيا المعلومات',
    'page.login_title': 'تسجيل الدخول | نقابة تكنولوجيا المعلومات',
    'page.reset_password_title': 'إعادة تعيين كلمة المرور | نقابة تكنولوجيا المعلومات',
    'page.404_title': 'الصفحة غير موجودة | نقابة تكنولوجيا المعلومات',
    'page.admin_title': 'لوحة الإدارة | نقابة تكنولوجيا المعلومات',
    'page.portal_title': 'بوابة الأكاديمية | نقابة تكنولوجيا المعلومات',
    'page.branch_title': 'بوابة الفرع | نقابة تكنولوجيا المعلومات',

    // ----- Footer -----
    'footer.copyright': '© 2025 نقابة تكنولوجيا المعلومات والبرمجيات. جميع الحقوق محفوظة.',
    'footer.about': 'عن النقابة',
    'footer.services': 'الخدمات',
    'footer.contact': 'تواصل معنا',
    'footer.privacy': 'سياسة الخصوصية',
    'footer.terms': 'الشروط والأحكام',
    'footer.sitemap': 'خريطة الموقع'
  };

  // =============================================================
  // Page Groups — كل صفحة وكل مفاتيحها
  // =============================================================

  var PAGE_GROUPS = {
    verify: [
      'verify.title', 'verify.subtitle', 'verify.badge', 'verify.search_label',
      'verify.search_placeholder', 'verify.search_button', 'verify.searching',
      'verify.not_found', 'verify.not_found_hint', 'verify.valid', 'verify.invalid',
      'verify.revoked', 'verify.revoked_on', 'verify.revoked_reason',
      'verify.certificate_number', 'verify.student_name', 'verify.academy',
      'verify.course', 'verify.issue_date', 'verify.expiry_date', 'verify.grade',
      'verify.hours', 'verify.print', 'verify.download_pdf', 'verify.share',
      'verify.copy_link', 'verify.url_hint', 'verify.result_count', 'verify.instructions'
    ],
    student: [
      'student.title', 'student.subtitle', 'student.search_national_id',
      'student.national_id_label', 'student.national_id_placeholder',
      'student.national_id_invalid', 'student.search_button', 'student.searching',
      'student.not_found', 'student.profile', 'student.certificates',
      'student.certificate_count', 'student.no_certificates', 'student.build_cv',
      'student.download_cv', 'student.cv_title', 'student.privacy_note', 'student.track_number'
    ],
    academies: [
      'academies.title', 'academies.subtitle', 'academies.search_placeholder',
      'academies.filter_category', 'academies.filter_governorate', 'academies.filter_rating',
      'academies.sort', 'academies.sort_name', 'academies.sort_rating', 'academies.sort_newest',
      'academies.no_results', 'academies.view_details', 'academies.rating',
      'academies.reviews_count', 'academies.branches_count', 'academies.courses_count',
      'academies.verified', 'academies.apply_now'
    ],
    track: [
      'track.title', 'track.subtitle', 'track.search_label', 'track.search_placeholder',
      'track.search_button', 'track.searching', 'track.not_found', 'track.status',
      'track.submitted_at', 'track.last_update', 'track.current_stage', 'track.timeline',
      'track.stage_submitted', 'track.stage_under_review', 'track.stage_documents_check',
      'track.stage_site_visit', 'track.stage_approved', 'track.stage_rejected',
      'track.sla_days', 'track.sla_days_value', 'track.notes'
    ],
    apply: [
      'apply.title', 'apply.subtitle', 'apply.step_basic', 'apply.step_contact',
      'apply.step_documents', 'apply.step_review', 'apply.academy_name',
      'apply.academy_name_placeholder', 'apply.owner_name', 'apply.owner_national_id',
      'apply.commercial_register', 'apply.tax_card', 'apply.governorate', 'apply.city',
      'apply.address', 'apply.phone', 'apply.email', 'apply.website', 'apply.category',
      'apply.documents', 'apply.doc_commercial', 'apply.doc_tax', 'apply.doc_owner_id',
      'apply.doc_premises', 'apply.upload_button', 'apply.file_selected',
      'apply.file_too_large', 'apply.file_wrong_type', 'apply.submit_application',
      'apply.submitting', 'apply.success', 'apply.success_tracking', 'apply.review_check',
      'apply.next_step', 'apply.prev_step'
    ],
    login: [
      'auth.login', 'auth.email', 'auth.password', 'auth.remember_me',
      'auth.forgot_password', 'auth.sign_in', 'auth.welcome_back',
      'auth.login_subtitle', 'auth.no_account', 'auth.sign_up'
    ],
    admin: [
      'admin.dashboard', 'admin.settings', 'admin.users', 'admin.requests',
      'admin.branches', 'admin.academies', 'admin.certificates', 'admin.reports',
      'admin.activities', 'admin.login_logs', 'admin.union_courses',
      'admin.permissions', 'admin.roles', 'admin.welcome', 'admin.total_academies',
      'admin.total_students', 'admin.total_certificates', 'admin.total_requests',
      'admin.pending_requests', 'admin.recent_activity', 'admin.quick_actions'
    ],
    portal: [
      'portal.dashboard', 'portal.certificates', 'portal.issue_certificate',
      'portal.my_certificates', 'portal.profile', 'portal.courses', 'portal.reports',
      'portal.application', 'portal.students', 'portal.ratings',
      'portal.issued_today', 'portal.total_issued'
    ],
    branch: [
      'branch.dashboard', 'branch.academies', 'branch.certificates',
      'branch.users', 'branch.requests', 'branch.reports',
      'branch.total_academies', 'branch.total_certificates', 'branch.total_users'
    ]
  };

  // =============================================================
  // State
  // =============================================================

  var state = {
    db: {},                    // { key: value } من DB
    dbLoaded: false,
    dbLoadPromise: null,
    cache: {},                 // resolved cache
    listeners: [],
    subscribers: {},           // key → [cb]
    loading: false,
    lastError: null,
    currentLang: 'ar'
  };

  // =============================================================
  // Interpolation
  // =============================================================

  function interpolate(template, params) {
    if (!template || !params) { return template; }
    return String(template).replace(/\{([a-zA-Z0-9_]+)\}/g, function (match, name) {
      if (params[name] !== undefined && params[name] !== null) {
        return String(params[name]);
      }
      return match;
    });
  }

  // =============================================================
  // Arabic Pluralization
  // =============================================================
  // قواعد العربي:
  //   zero  : 0            → "لا توجد X"
  //   one   : 1            → "X واحدة"
  //   two   : 2            → "X اثنتان"
  //   few   : 3-10         → "X قليلة"
  //   many  : 11-99        → "X كثيرة"
  //   other : 100+         → "X"

  function arabicPlural(count) {
    var n = Math.abs(Math.floor(count));
    if (n === 0) { return 'zero'; }
    if (n === 1) { return 'one'; }
    if (n === 2) { return 'two'; }
    var mod100 = n % 100;
    if (mod100 >= 3 && mod100 <= 10) { return 'few'; }
    if (mod100 >= 11 && mod100 <= 99) { return 'many'; }
    return 'other';
  }

  // =============================================================
  // Resolve Label
  // =============================================================

  function resolve(key, params, fallback) {
    var value;

    // 1. DB
    if (state.dbLoaded && state.db[key] !== undefined) {
      value = state.db[key];
    }
    // 2. Defaults
    else if (DEFAULTS[key] !== undefined) {
      value = DEFAULTS[key];
    }
    // 3. Plural variants — لو المفتاح مش موجود، شوف .zero/.one/.two/.few/.many/.other
    else if (params && params.count !== undefined) {
      var pluralKey = arabicPlural(params.count);
      if (state.dbLoaded && state.db[key + '.' + pluralKey] !== undefined) {
        value = state.db[key + '.' + pluralKey];
      } else if (DEFAULTS[key + '.' + pluralKey] !== undefined) {
        value = DEFAULTS[key + '.' + pluralKey];
      }
    }
    // 4. fallback
    else if (fallback !== undefined) {
      value = fallback;
    }
    // 5. last resort
    else {
      value = key;
    }

    // Interpolate
    if (params && typeof value === 'string') {
      value = interpolate(value, params);
    }

    return value;
  }

  // =============================================================
  // t — public API
  // =============================================================

  function t(key, params, fallback) {
    if (!key) { return fallback || ''; }

    // Cache: key + params hash (لو مفيش params نستخدم key بس)
    var cacheKey = key;
    if (params && typeof params === 'object') {
      try {
        cacheKey = key + '::' + JSON.stringify(params);
      } catch (e) {}
    }

    if (state.cache[cacheKey] !== undefined) {
      return state.cache[cacheKey];
    }

    var value = resolve(key, params, fallback);
    state.cache[cacheKey] = value;
    return value;
  }

  // =============================================================
  // tPlural — نسخة صريحة
  // =============================================================

  function tPlural(key, count, params, fallback) {
    var p = params || {};
    p.count = count;
    // جرّب plural variants أولاً
    var pluralKey = arabicPlural(count);
    var variantKey = key + '.' + pluralKey;
    var direct = resolve(variantKey, p, undefined);
    if (direct !== variantKey) {
      return direct;
    }
    // fallback: key الأساسي مع interpolation
    return t(key, p, fallback);
  }

  // =============================================================
  // has
  // =============================================================

  function has(key) {
    if (!key) { return false; }
    if (state.dbLoaded && state.db[key] !== undefined) { return true; }
    if (DEFAULTS[key] !== undefined) { return true; }
    return false;
  }

  // =============================================================
  // getGroup — كل label في مجموعة (مثلاً 'verify')
  // =============================================================

  function forPage(pageName) {
    if (!pageName || !PAGE_GROUPS[pageName]) { return {}; }
    var keys = PAGE_GROUPS[pageName];
    var out = {};
    for (var i = 0; i < keys.length; i++) {
      var k = keys[i];
      out[k] = t(k);
    }
    return out;
  }

  function getPageKeys(pageName) {
    return (PAGE_GROUPS[pageName] || []).slice();
  }

  // =============================================================
  // applyTo — يطبق [data-label] و [data-label-attr]
  // =============================================================
  // أمثلة:
  //   <span data-label="nav.home"></span>
  //   <button data-label="common.save"></button>
  //   <input data-label-attr="placeholder" data-label="auth.email" />
  //   <span data-label="verify.result_count" data-label-count="3"></span>
  //   <span data-label="common.count" data-label-params='{"count":5}'></span>

  function applyTo(root) {
    var scope = root || document;
    if (!scope || !scope.querySelectorAll) { return 0; }

    var nodes = scope.querySelectorAll('[data-label]');
    var applied = 0;

    for (var i = 0; i < nodes.length; i++) {
      var node = nodes[i];

      var key = node.getAttribute('data-label');
      if (!key) { continue; }

      // params
      var params = null;
      var paramsAttr = node.getAttribute('data-label-params');
      if (paramsAttr) {
        try { params = JSON.parse(paramsAttr); } catch (e) { params = null; }
      }

      // count
      var countAttr = node.getAttribute('data-label-count');
      if (countAttr !== null) {
        params = params || {};
        params.count = parseInt(countAttr, 10) || 0;
      }

      var value = params ? t(key, params) : t(key);

      // attr mode?
      var attr = node.getAttribute('data-label-attr');
      if (attr) {
        try {
          node.setAttribute(attr, value);
        } catch (e) {}
      } else {
        node.textContent = value;
      }

      node.setAttribute('data-label-applied', '1');
      applied++;
    }

    return applied;
  }

  // =============================================================
  // DB load
  // =============================================================

  function loadFromDb() {
    if (!window.sb) {
      return Promise.resolve(false);
    }
    if (state.dbLoadPromise) {
      return state.dbLoadPromise;
    }

    state.loading = true;

    state.dbLoadPromise = window.sb
      .from('labels')
      .select('key, ar_value, en_value')
      .then(function (res) {
        state.loading = false;

        if (res && res.error) {
          state.lastError = res.error.message || 'db_error';
          state.dbLoaded = false;
          return false;
        }

        var rows = (res && res.data) || [];
        var db = {};

        for (var i = 0; i < rows.length; i++) {
          var row = rows[i];
          if (!row || !row.key) { continue; }
          var val = row.ar_value;
          if (val === null || val === undefined) {
            val = row.en_value || '';
          }
          db[row.key] = val;
        }

        state.db = db;
        state.dbLoaded = true;

        // clear cache
        state.cache = {};

        notifyChange('*', null, 'db-loaded');

        if (window.__itwsDebug) {
          window.__itwsDebug('Labels: DB loaded', { count: rows.length });
        }

        return true;
      })
      .catch(function (err) {
        state.loading = false;
        state.lastError = (err && err.message) || 'load_failed';
        state.dbLoaded = false;
        return false;
      });

    return state.dbLoadPromise;
  }

  // =============================================================
  // Realtime
  // =============================================================

  function watchRealtime() {
    try {
      if (!window.Realtime || typeof window.Realtime.subscribe !== 'function') {
        return;
      }
      window.Realtime.subscribe('labels', function (payload) {
        try {
          if (!payload) { return; }
          var row = payload.new || payload.old;
          if (!row || !row.key) { return; }

          var key = row.key;
          var value;

          if (payload.new) {
            value = row.ar_value;
            if (value === null || value === undefined) {
              value = row.en_value || '';
            }
            state.db[key] = value;
          } else if (payload.old) {
            delete state.db[key];
          }

          // clear cache
          state.cache = {};

          notifyChange(key, value, 'realtime');
        } catch (e) {}
      }, { debounce: 500 });
    } catch (e) {}
  }

  // =============================================================
  // Listeners
  // =============================================================

  function notifyChange(key, value, source) {
    for (var i = 0; i < state.listeners.length; i++) {
      try {
        state.listeners[i](key, value, source);
      } catch (e) {}
    }
    var subs = state.subscribers[key];
    if (subs) {
      for (var j = 0; j < subs.length; j++) {
        try { subs[j](value, source); } catch (e) {}
      }
    }
  }

  function onChange(cb) {
    if (typeof cb === 'function') { state.listeners.push(cb); }
  }

  function subscribe(key, cb) {
    if (!key || typeof cb !== 'function') { return; }
    if (!state.subscribers[key]) { state.subscribers[key] = []; }
    state.subscribers[key].push(cb);
  }

  function unsubscribe(key, cb) {
    if (!state.subscribers[key]) { return; }
    var arr = state.subscribers[key];
    for (var i = arr.length - 1; i >= 0; i--) {
      if (arr[i] === cb) { arr.splice(i, 1); }
    }
  }

  // =============================================================
  // Init
  // =============================================================

  function init() {
    // جرب تحمل من DB
    if (window.sb) {
      loadFromDb().then(function () {
        watchRealtime();
        // أعد تطبيق [data-label] بعد ما الـ DB تحمل
        if (document.readyState !== 'loading') {
          applyTo(document);
        }
      });
    } else {
      // استنى supabase-client
      var tries = 0;
      var maxTries = 30;
      var interval = setInterval(function () {
        tries++;
        if (window.sb) {
          clearInterval(interval);
          loadFromDb().then(function () {
            watchRealtime();
            if (document.readyState !== 'loading') {
              applyTo(document);
            }
          });
        } else if (tries >= maxTries) {
          clearInterval(interval);
        }
      }, 100);
    }

    // Realtime لو متاح
    if (window.Realtime) {
      watchRealtime();
    }

    // applyTo تلقائي على DOMContentLoaded
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', function () {
        applyTo(document);
      });
    } else {
      applyTo(document);
    }

    if (window.__itwsDebug) {
      window.__itwsDebug('Labels initialized', {
        embedded: Object.keys(DEFAULTS).length,
        hasSupabase: !!window.sb
      });
    }
  }

  // =============================================================
  // Debug
  // =============================================================

  function getDebugInfo() {
    return {
      embedded: Object.keys(DEFAULTS).length,
      dbLoaded: state.dbLoaded,
      dbCount: Object.keys(state.db).length,
      cacheSize: Object.keys(state.cache).length,
      listeners: state.listeners.length,
      lastError: state.lastError,
      pageGroups: Object.keys(PAGE_GROUPS).length
    };
  }

  // =============================================================
  // Export
  // =============================================================

  window.Labels = {
    // Read
    t:               t,
    translate:       t,
    tPlural:         tPlural,
    has:             has,

    // Page groups
    forPage:         forPage,
    getPageKeys:     getPageKeys,

    // DOM
    applyTo:         applyTo,

    // Lifecycle
    reload:          function () {
      state.cache = {};
      state.dbLoadPromise = null;
      return loadFromDb();
    },
    loadFromDb:      loadFromDb,

    // Listeners
    onChange:        onChange,
    subscribe:       subscribe,
    unsubscribe:     unsubscribe,

    // Status
    isLoaded:        function () { return state.dbLoaded; },
    isLoading:       function () { return state.loading; },
    getDebugInfo:    getDebugInfo,

    // Helpers
    interpolate:     interpolate,
    arabicPlural:    arabicPlural,

    // Direct access
    _defaults:       DEFAULTS,
    _pageGroups:     PAGE_GROUPS,

    version:         '2.0.0'
  };

  // Alias
  window.T = window.Labels.t;

  // =============================================================
  // Init immediately
  // =============================================================

  init();

})();
