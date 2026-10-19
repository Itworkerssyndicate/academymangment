-- ============================================
-- [50/50] ITWS Platform - Seed Data
-- Path: supabase/seed.sql
-- ============================================
-- ⚠️ شغّله بعد schema.sql (48/50) و rls-policies.sql (49/50)
-- 💡 يملأ الإعدادات الافتراضية + الثيمات + التصنيفات
-- 💡 كل قيمة قابلة للتعديل من /admin/settings
-- 💡 آمن لإعادة التشغيل (ON CONFLICT DO NOTHING)
-- ============================================

-- ============================================
-- 1. SPLASH SCREEN SETTINGS
-- ============================================
INSERT INTO public.settings (key, value) VALUES (
  'splash',
  '{
    "enabled": true,
    "min_duration_ms": 2200,
    "max_duration_ms": 6000,
    "loading_texts": [
      "جاري تحميل الإعدادات...",
      "جاري التحقق من الجلسة...",
      "جاري تجهيز المنصة...",
      "على وشك الدخول..."
    ],
    "show_logo": true,
    "show_hexagon": true,
    "show_rings": true,
    "show_particles": true,
    "show_progress_circular": true,
    "show_progress_bar": true,
    "show_status_text": true,
    "show_president_footer": true,
    "show_shimmer": true,
    "particles_count": 18,
    "animation_level": "full",
    "status_loading": "جاري التحميل",
    "status_redirecting": "على وشك الدخول..."
  }'::jsonb
) ON CONFLICT (key) DO NOTHING;

-- ============================================
-- 2. APP IDENTITY
-- ============================================
INSERT INTO public.settings (key, value) VALUES (
  'app_identity',
  '{
    "union_name": "نقابة تكنولوجيا المعلومات والبرمجيات",
    "union_name_en": "ITWS",
    "committee_name": "لجنة التحول الرقمي والتدريب",
    "committee_head_name": "د. أحمد محمد",
    "president_name": "المحاسب / محمود جميل",
    "president_label": "النقيب العام:",
    "president_footer": "النقيب العام:",
    "footer_text": "© 2026 نقابة تكنولوجيا المعلومات والبرمجيات",
    "logo_url": null,
    "stamp_url": null,
    "contact_email": "info@itws.eg",
    "contact_phone": "01234567890",
    "website_url": "https://itws.eg"
  }'::jsonb
) ON CONFLICT (key) DO NOTHING;

-- ============================================
-- 3. BEHAVIOR
-- ============================================
INSERT INTO public.settings (key, value) VALUES (
  'behavior',
  '{
    "font_family": "Cairo",
    "font_size": "16px",
    "redirect_guest_to": "/home.html",
    "redirect_admin_to": "/admin/index.html",
    "redirect_user_to": "/home.html",
    "session_timeout_minutes": 30,
    "max_login_attempts": 5,
    "heartbeat_interval_ms": 60000,
    "online_threshold_ms": 120000,
    "enable_registration": false,
    "enable_theme_picker_for_visitors": true,
    "enable_dark_mode_toggle": true,
    "enable_search": true,
    "enable_cv_builder": true,
    "home_show_stats": true,
    "home_show_recent_academies": true,
    "home_show_quick_actions": true,
    "home_stats_academies_count": 6,
    "search_min_chars": 2,
    "search_debounce_ms": 300,
    "search_max_results": 50,
    "pagination_admin_size": 20,
    "pagination_public_size": 12
  }'::jsonb
) ON CONFLICT (key) DO NOTHING;

-- ============================================
-- 4. THEME
-- ============================================
INSERT INTO public.settings (key, value) VALUES (
  'theme',
  '{
    "default_theme": "watanii_dark",
    "allow_user_override": true,
    "fade_transition_ms": 200
  }'::jsonb
) ON CONFLICT (key) DO NOTHING;

-- ============================================
-- 5. ACCREDITATION
-- ============================================
INSERT INTO public.settings (key, value) VALUES (
  'accreditation',
  '{
    "stages": {
      "submitted": "تم التقديم",
      "documents_review": "مراجعة المستندات",
      "site_visit": "زيارة الموقع",
      "committee_review": "لجنة المراجعة",
      "final_approval": "الموافقة النهائية",
      "approved": "معتمدة",
      "rejected": "مرفوضة"
    },
    "sla_days": {
      "submitted": 3,
      "documents_review": 3,
      "site_visit": 14,
      "committee_review": 7,
      "final_approval": 5
    },
    "min_branches": 1,
    "min_courses": 1,
    "require_payment_receipt": false,
    "require_place_photo": true,
    "require_tax_card": true,
    "require_commercial_registry": true
  }'::jsonb
) ON CONFLICT (key) DO NOTHING;

-- ============================================
-- 6. CERTIFICATES
-- ============================================
INSERT INTO public.settings (key, value) VALUES (
  'certificates',
  '{
    "code_prefix": "NTI",
    "code_pattern": "NTI-{year}-{random}",
    "random_length": 6,
    "grades": ["A+", "A", "B+", "B", "C+", "C", "D", "F"],
    "show_qr": true,
    "show_stamp": true,
    "show_committee_head_signature": true,
    "show_president_signature": true
  }'::jsonb
) ON CONFLICT (key) DO NOTHING;

-- ============================================
-- 7. SECURITY
-- ============================================
INSERT INTO public.settings (key, value) VALUES (
  'security',
  '{
    "max_login_attempts": 5,
    "lockout_minutes": 15,
    "session_timeout_minutes": 30,
    "require_email_verification": false,
    "allow_password_reset": true
  }'::jsonb
) ON CONFLICT (key) DO NOTHING;

-- ============================================
-- 8. UPLOADS
-- ============================================
INSERT INTO public.settings (key, value) VALUES (
  'uploads',
  '{
    "max_image_size_mb": 2,
    "max_document_size_mb": 10,
    "allowed_image_types": ["image/jpeg", "image/png", "image/webp", "image/svg+xml"],
    "allowed_document_types": ["application/pdf", "image/jpeg", "image/png"],
    "cloudinary_cloud_name": "dvxh9l4lv",
    "cloudinary_upload_preset": "itwsAcaCertification"
  }'::jsonb
) ON CONFLICT (key) DO NOTHING;

-- ============================================
-- 9. FOOTER
-- ============================================
INSERT INTO public.settings (key, value) VALUES (
  'footer',
  '{
    "show_social_links": true,
    "show_president": true,
    "show_copyright": true,
    "copyright_text": "© 2026 نقابة تكنولوجيا المعلومات والبرمجيات",
    "social_facebook": "",
    "social_twitter": "",
    "social_linkedin": "",
    "social_youtube": ""
  }'::jsonb
) ON CONFLICT (key) DO NOTHING;

-- ============================================
-- 10. FEATURES
-- ============================================
INSERT INTO public.settings (key, value) VALUES (
  'features',
  '{
    "enable_ai_cv": true,
    "enable_ocr": true,
    "enable_qr_code": true,
    "enable_pdf_export": true,
    "enable_excel_export": true,
    "enable_whatsapp_share": true,
    "enable_email_notifications": false
  }'::jsonb
) ON CONFLICT (key) DO NOTHING;

-- ============================================
-- 11. THEMES (6 ثيمات)
-- ============================================
INSERT INTO public.themes (id, name, colors, is_active, sort_order) VALUES

  ('watanii_dark', 'وطني داكن', '{
    "primary":"#CE1126","primary-hover":"#E63946","primary-soft":"rgba(206,17,38,0.14)","primary-text":"#FFFFFF",
    "accent":"#FFFFFF","accent-hover":"#E5E7EB","accent-soft":"rgba(255,255,255,0.08)",
    "bg":"#0A0E14","bg-alt":"#05080D","surface":"#131820","surface-elevated":"#1C2430","surface-hover":"#252F3D",
    "text":"#F8FAFC","text-secondary":"#94A3B8","text-muted":"#64748B","text-inverse":"#0A0E14",
    "border":"rgba(255,255,255,0.08)","border-strong":"rgba(255,255,255,0.16)","border-focus":"#CE1126",
    "success":"#10B981","success-soft":"rgba(16,185,129,0.12)",
    "error":"#EF4444","error-soft":"rgba(239,68,68,0.12)",
    "warning":"#F59E0B","warning-soft":"rgba(245,158,11,0.12)",
    "info":"#3B82F6","info-soft":"rgba(59,130,246,0.12)",
    "shadow":"0 8px 32px rgba(0,0,0,0.5)","shadow-lg":"0 20px 60px rgba(0,0,0,0.6)"
  }'::jsonb, true, 1),

  ('watanii_light', 'وطني فاتح', '{
    "primary":"#CE1126","primary-hover":"#A50D1F","primary-soft":"rgba(206,17,38,0.08)","primary-text":"#FFFFFF",
    "accent":"#0F172A","accent-hover":"#1E293B","accent-soft":"rgba(15,23,42,0.05)",
    "bg":"#FAFAFA","bg-alt":"#F0F0F0","surface":"#FFFFFF","surface-elevated":"#F3F4F6","surface-hover":"#E5E7EB",
    "text":"#0F172A","text-secondary":"#4B5563","text-muted":"#9CA3AF","text-inverse":"#FFFFFF",
    "border":"rgba(0,0,0,0.08)","border-strong":"rgba(0,0,0,0.15)","border-focus":"#CE1126",
    "success":"#059669","success-soft":"rgba(5,150,105,0.1)",
    "error":"#CE1126","error-soft":"rgba(206,17,38,0.1)",
    "warning":"#D97706","warning-soft":"rgba(217,119,6,0.1)",
    "info":"#1E40AF","info-soft":"rgba(30,64,175,0.1)",
    "shadow":"0 8px 32px rgba(0,0,0,0.08)","shadow-lg":"0 20px 60px rgba(0,0,0,0.12)"
  }'::jsonb, true, 2),

  ('tech_blue', 'تكنولوجي', '{
    "primary":"#3B82F6","primary-hover":"#2563EB","primary-soft":"rgba(59,130,246,0.12)","primary-text":"#FFFFFF",
    "accent":"#06B6D4","accent-hover":"#0891B2","accent-soft":"rgba(6,182,212,0.15)",
    "bg":"#0F172A","bg-alt":"#0A0F1E","surface":"#1E293B","surface-elevated":"#334155","surface-hover":"#475569",
    "text":"#F1F5F9","text-secondary":"#94A3B8","text-muted":"#64748B","text-inverse":"#0F172A",
    "border":"rgba(148,163,184,0.12)","border-strong":"rgba(148,163,184,0.25)","border-focus":"#3B82F6",
    "success":"#10B981","success-soft":"rgba(16,185,129,0.12)",
    "error":"#EF4444","error-soft":"rgba(239,68,68,0.12)",
    "warning":"#F59E0B","warning-soft":"rgba(245,158,11,0.12)",
    "info":"#60A5FA","info-soft":"rgba(96,165,250,0.12)",
    "shadow":"0 8px 32px rgba(0,0,0,0.4)","shadow-lg":"0 20px 60px rgba(0,0,0,0.5)"
  }'::jsonb, true, 3),

  ('light_formal', 'رسمي فاتح', '{
    "primary":"#1E40AF","primary-hover":"#1E3A8A","primary-soft":"rgba(30,64,175,0.08)","primary-text":"#FFFFFF",
    "accent":"#C9A84C","accent-hover":"#B8953E","accent-soft":"rgba(201,168,76,0.12)",
    "bg":"#F8FAFC","bg-alt":"#F1F5F9","surface":"#FFFFFF","surface-elevated":"#F1F5F9","surface-hover":"#E2E8F0",
    "text":"#0F172A","text-secondary":"#475569","text-muted":"#94A3B8","text-inverse":"#FFFFFF",
    "border":"rgba(15,23,42,0.08)","border-strong":"rgba(15,23,42,0.15)","border-focus":"#1E40AF",
    "success":"#059669","success-soft":"rgba(5,150,105,0.1)",
    "error":"#DC2626","error-soft":"rgba(220,38,38,0.1)",
    "warning":"#D97706","warning-soft":"rgba(217,119,6,0.1)",
    "info":"#1E40AF","info-soft":"rgba(30,64,175,0.1)",
    "shadow":"0 8px 32px rgba(0,0,0,0.08)","shadow-lg":"0 20px 60px rgba(0,0,0,0.12)"
  }'::jsonb, true, 4),

  ('emerald', 'زمردي', '{
    "primary":"#10B981","primary-hover":"#059669","primary-soft":"rgba(16,185,129,0.12)","primary-text":"#0A1F1A",
    "accent":"#0D9488","accent-hover":"#0F766E","accent-soft":"rgba(13,148,136,0.15)",
    "bg":"#0A1F1A","bg-alt":"#061410","surface":"#112E26","surface-elevated":"#1A3D33","surface-hover":"#214D42",
    "text":"#ECFDF5","text-secondary":"#A7F3D0","text-muted":"#6EE7B7","text-inverse":"#0A1F1A",
    "border":"rgba(16,185,129,0.15)","border-strong":"rgba(16,185,129,0.3)","border-focus":"#10B981",
    "success":"#22D3EE","success-soft":"rgba(34,211,238,0.12)",
    "error":"#EF4444","error-soft":"rgba(239,68,68,0.12)",
    "warning":"#F59E0B","warning-soft":"rgba(245,158,11,0.12)",
    "info":"#06B6D4","info-soft":"rgba(6,182,212,0.12)",
    "shadow":"0 8px 32px rgba(0,0,0,0.5)","shadow-lg":"0 20px 60px rgba(0,0,0,0.6)"
  }'::jsonb, true, 5),

  ('midnight_gold', 'ليلي ذهبي', '{
    "primary":"#C9A84C","primary-hover":"#D4B85C","primary-soft":"rgba(201,168,76,0.12)","primary-text":"#000000",
    "accent":"#FFFFFF","accent-hover":"#E5E7EB","accent-soft":"rgba(255,255,255,0.08)",
    "bg":"#000000","bg-alt":"#050505","surface":"#0A0A0A","surface-elevated":"#171717","surface-hover":"#262626",
    "text":"#FAFAFA","text-secondary":"#A3A3A3","text-muted":"#525252","text-inverse":"#000000",
    "border":"rgba(201,168,76,0.15)","border-strong":"rgba(201,168,76,0.3)","border-focus":"#C9A84C",
    "success":"#10B981","success-soft":"rgba(16,185,129,0.12)",
    "error":"#EF4444","error-soft":"rgba(239,68,68,0.12)",
    "warning":"#F59E0B","warning-soft":"rgba(245,158,11,0.12)",
    "info":"#3B82F6","info-soft":"rgba(59,130,246,0.12)",
    "shadow":"0 8px 32px rgba(201,168,76,0.1)","shadow-lg":"0 20px 60px rgba(201,168,76,0.15)"
  }'::jsonb, true, 6)

ON CONFLICT (id) DO NOTHING;

-- ============================================
-- 12. ACADEMY CATEGORIES
-- ============================================
INSERT INTO public.academy_categories (name, name_en, color, sort_order) VALUES
  ('أمن سيبراني', 'Cybersecurity', '#EF4444', 1),
  ('تطوير برمجيات', 'Software Development', '#3B82F6', 2),
  ('ذكاء اصطناعي', 'Artificial Intelligence', '#8B5CF6', 3),
  ('علم البيانات', 'Data Science', '#10B981', 4),
  ('حوسبة سحابية', 'Cloud Computing', '#06B6D4', 5),
  ('شبكات', 'Networks', '#F59E0B', 6),
  ('تصميم UI/UX', 'UI/UX Design', '#EC4899', 7),
  ('تسويق رقمي', 'Digital Marketing', '#F97316', 8)
ON CONFLICT (name) DO NOTHING;
